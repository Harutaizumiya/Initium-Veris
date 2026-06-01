from django.db import migrations


def allow_adjust_operations(apps, schema_editor):
    if schema_editor.connection.vendor != "postgresql":
        return

    with schema_editor.connection.cursor() as cursor:
        cursor.execute("ALTER TABLE batch_operations DROP CONSTRAINT IF EXISTS batch_operations_operation_type_check")
        cursor.execute(
            """
            ALTER TABLE batch_operations
            ADD CONSTRAINT batch_operations_operation_type_check
            CHECK (operation_type IN ('add', 'loss', 'deduct', 'adjust'))
            """
        )
        cursor.execute("ALTER TABLE batch_operations DROP CONSTRAINT IF EXISTS batch_operations_quantity_positive_check")
        cursor.execute("ALTER TABLE batch_operations DROP CONSTRAINT IF EXISTS batch_operations_quantity_non_zero_check")
        cursor.execute(
            """
            ALTER TABLE batch_operations
            ADD CONSTRAINT batch_operations_quantity_non_zero_check
            CHECK (
                (operation_type = 'adjust' AND quantity <> 0)
                OR (operation_type IN ('add', 'loss', 'deduct') AND quantity > 0)
            )
            """
        )


def restore_operation_constraints(apps, schema_editor):
    if schema_editor.connection.vendor != "postgresql":
        return

    with schema_editor.connection.cursor() as cursor:
        cursor.execute("ALTER TABLE batch_operations DROP CONSTRAINT IF EXISTS batch_operations_operation_type_check")
        cursor.execute(
            """
            ALTER TABLE batch_operations
            ADD CONSTRAINT batch_operations_operation_type_check
            CHECK (operation_type IN ('add', 'loss', 'deduct'))
            """
        )
        cursor.execute("ALTER TABLE batch_operations DROP CONSTRAINT IF EXISTS batch_operations_quantity_non_zero_check")
        cursor.execute("ALTER TABLE batch_operations DROP CONSTRAINT IF EXISTS batch_operations_quantity_positive_check")
        cursor.execute(
            """
            ALTER TABLE batch_operations
            ADD CONSTRAINT batch_operations_quantity_positive_check
            CHECK (quantity > 0)
            """
        )


class Migration(migrations.Migration):
    dependencies = [
        ("inventory", "0004_stocktakes"),
    ]

    operations = [
        migrations.RunPython(allow_adjust_operations, reverse_code=restore_operation_constraints),
    ]
