from django.test import SimpleTestCase

from inventory.management.commands.sync_sequences import Command, SequenceState


class FakePrimaryKey:
    column = "id"

    def get_internal_type(self):
        return "BigAutoField"


class FakeModelMeta:
    app_label = "inventory"
    db_table = "batches"
    pk = FakePrimaryKey()


class FakeModel:
    _meta = FakeModelMeta()


class FakeCursor:
    def __init__(self, *, sequence_name="public.batches_id_seq"):
        self.sequence_name = sequence_name
        self.queries = []
        self.params = []
        self.last_query = ""

    def execute(self, query, params=None):
        self.last_query = query
        self.queries.append(query)
        self.params.append(params)

    def fetchone(self):
        if "pg_get_serial_sequence" in self.last_query:
            return [self.sequence_name]
        if "COALESCE(MAX" in self.last_query:
            return [10]
        if "last_value" in self.last_query:
            return [5, True]
        if "seqincrement" in self.last_query:
            return [1]
        return [None]


class SyncSequencesCommandTests(SimpleTestCase):
    def test_sequence_state_detects_drift(self):
        command = Command()
        cursor = FakeCursor()

        state = command._sequence_state(cursor, FakeModel)

        self.assertEqual(state.table_name, "batches")
        self.assertEqual(state.pk_column, "id")
        self.assertEqual(state.sequence_name, "public.batches_id_seq")
        self.assertEqual(state.max_id, 10)
        self.assertEqual(state.inferred_next_value, 6)
        self.assertTrue(state.needs_sync)

    def test_sync_sequence_uses_setval_target(self):
        command = Command()
        cursor = FakeCursor()
        state = SequenceState(
            table_name="batches",
            pk_column="id",
            sequence_name="public.batches_id_seq",
            max_id=10,
            last_value=5,
            is_called=True,
            increment_by=1,
        )

        command._sync_sequence(cursor, state)

        self.assertEqual(cursor.params[-1], ["public.batches_id_seq", 10, True])

    def test_sequence_state_skips_models_without_serial_sequence(self):
        command = Command()
        cursor = FakeCursor(sequence_name=None)

        self.assertIsNone(command._sequence_state(cursor, FakeModel))
