from datetime import time

from django.db import migrations, models
from django.utils import timezone


def move_expiry_to_cutoff(apps, schema_editor):
    existing_tables = set(schema_editor.connection.introspection.table_names())
    if "batches" not in existing_tables:
        return

    if schema_editor.connection.vendor == "postgresql":
        with schema_editor.connection.cursor() as cursor:
            cursor.execute(
                """
                SELECT data_type
                FROM information_schema.columns
                WHERE table_name = 'batches'
                  AND column_name = 'expire_date'
                """
            )
            row = cursor.fetchone()
            data_type = row[0] if row else None
            condition_sql = "" if data_type == "date" else "AND expire_date::time = time '00:00:00'"
            cursor.execute(
                f"""
                UPDATE batches
                SET expire_date = (expire_date::date::timestamp + time '23:59:00')
                WHERE expire_date IS NOT NULL
                  {condition_sql}
                """
            )
        return

    Batch = apps.get_model("inventory", "Batch")
    for batch in Batch.objects.exclude(expire_date__isnull=True):
        expire_at = batch.expire_date
        if timezone.is_aware(expire_at):
            local_expire_at = timezone.localtime(expire_at)
        else:
            local_expire_at = expire_at
        if local_expire_at.time() == time.min:
            batch.expire_date = local_expire_at.replace(hour=23, minute=59, second=0, microsecond=0)
            batch.save(update_fields=["expire_date"])


def move_expiry_to_day_start(apps, schema_editor):
    existing_tables = set(schema_editor.connection.introspection.table_names())
    if "batches" not in existing_tables:
        return

    if schema_editor.connection.vendor == "postgresql":
        with schema_editor.connection.cursor() as cursor:
            cursor.execute(
                """
                UPDATE batches
                SET expire_date = expire_date::date
                WHERE expire_date IS NOT NULL
                """
            )
        return

    Batch = apps.get_model("inventory", "Batch")
    for batch in Batch.objects.exclude(expire_date__isnull=True):
        batch.expire_date = batch.expire_date.date()
        batch.save(update_fields=["expire_date"])


class Migration(migrations.Migration):
    dependencies = [
        ("inventory", "0002_performance_indexes"),
    ]

    operations = [
        migrations.AlterField(
            model_name="batch",
            name="expire_date",
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.RunPython(move_expiry_to_cutoff, reverse_code=move_expiry_to_day_start),
    ]
