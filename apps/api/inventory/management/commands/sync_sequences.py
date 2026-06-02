from __future__ import annotations

from dataclasses import dataclass
from typing import Iterable

from django.apps import apps
from django.core.management.base import BaseCommand, CommandError
from django.db import connection, models


SEQUENCE_APP_LABELS = ("accounts", "inventory")


@dataclass(frozen=True)
class SequenceState:
    table_name: str
    pk_column: str
    sequence_name: str
    max_id: int
    last_value: int
    is_called: bool
    increment_by: int

    @property
    def inferred_next_value(self) -> int:
        if self.is_called:
            return self.last_value + self.increment_by
        return self.last_value

    @property
    def needs_sync(self) -> bool:
        return self.inferred_next_value <= self.max_id

    @property
    def target_value(self) -> int:
        return self.max_id if self.max_id > 0 else 1

    @property
    def target_is_called(self) -> bool:
        return self.max_id > 0


class Command(BaseCommand):
    help = "Inspect or synchronize PostgreSQL sequences for integer primary-key models."

    def add_arguments(self, parser):
        parser.add_argument(
            "--apply",
            action="store_true",
            help="Apply setval updates. Without this flag the command only prints a dry-run report.",
        )
        parser.add_argument(
            "--app-label",
            action="append",
            choices=SEQUENCE_APP_LABELS,
            dest="app_labels",
            help="Limit synchronization to an app label. Defaults to accounts and inventory.",
        )

    def handle(self, *args, **options):
        if connection.vendor != "postgresql":
            raise CommandError("sync_sequences only supports PostgreSQL databases.")

        app_labels = tuple(options["app_labels"] or SEQUENCE_APP_LABELS)
        apply_changes = options["apply"]
        models_to_check = list(self._sequence_models(app_labels))

        if not models_to_check:
            self.stdout.write("No integer primary-key models found.")
            return

        with connection.cursor() as cursor:
            for model in models_to_check:
                state = self._sequence_state(cursor, model)
                if state is None:
                    self.stdout.write(
                        f"skip table={model._meta.db_table} pk={model._meta.pk.column} reason=no_serial_sequence"
                    )
                    continue

                action = "sync" if state.needs_sync else "ok"
                self._write_state(state, action=action, applied=False)

                if apply_changes and state.needs_sync:
                    self._sync_sequence(cursor, state)
                    updated_state = self._sequence_state(cursor, model)
                    if updated_state is None:
                        raise CommandError(f"Sequence disappeared while syncing {state.table_name}.")
                    self._write_state(updated_state, action="synced", applied=True)

    def _sequence_models(self, app_labels: tuple[str, ...]) -> Iterable[type[models.Model]]:
        for model in apps.get_models(include_auto_created=False):
            if model._meta.app_label not in app_labels:
                continue
            pk = model._meta.pk
            if pk is None or pk.get_internal_type() not in {"AutoField", "BigAutoField", "SmallAutoField"}:
                continue
            yield model

    def _sequence_state(self, cursor, model: type[models.Model]) -> SequenceState | None:
        table_name = model._meta.db_table
        pk_column = model._meta.pk.column
        cursor.execute("SELECT pg_get_serial_sequence(%s, %s)", [table_name, pk_column])
        row = cursor.fetchone()
        sequence_name = row[0] if row else None
        if not sequence_name:
            return None

        cursor.execute(
            f"SELECT COALESCE(MAX({self._quote_name(pk_column)}), 0) FROM {self._quote_qualified_name(table_name)}"
        )
        max_id = int(cursor.fetchone()[0] or 0)

        cursor.execute(f"SELECT last_value, is_called FROM {self._quote_qualified_name(sequence_name)}")
        last_value, is_called = cursor.fetchone()

        cursor.execute("SELECT seqincrement FROM pg_sequence WHERE seqrelid = %s::regclass", [sequence_name])
        increment_row = cursor.fetchone()
        increment_by = int(increment_row[0] if increment_row else 1)

        return SequenceState(
            table_name=table_name,
            pk_column=pk_column,
            sequence_name=sequence_name,
            max_id=max_id,
            last_value=int(last_value),
            is_called=bool(is_called),
            increment_by=increment_by,
        )

    def _sync_sequence(self, cursor, state: SequenceState) -> None:
        cursor.execute(
            "SELECT setval(%s::regclass, %s, %s)",
            [state.sequence_name, state.target_value, state.target_is_called],
        )

    def _write_state(self, state: SequenceState, *, action: str, applied: bool) -> None:
        prefix = "applied" if applied else "dry-run"
        self.stdout.write(
            f"{prefix} table={state.table_name} pk={state.pk_column} sequence={state.sequence_name} "
            f"max_id={state.max_id} last_value={state.last_value} is_called={state.is_called} "
            f"next_value={state.inferred_next_value} action={action}"
        )

    def _quote_name(self, name: str) -> str:
        return connection.ops.quote_name(name)

    def _quote_qualified_name(self, name: str) -> str:
        return ".".join(self._quote_name(part) for part in name.split("."))
