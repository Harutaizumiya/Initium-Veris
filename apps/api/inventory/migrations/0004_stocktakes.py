from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion
import django.utils.timezone


class Migration(migrations.Migration):
    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ("inventory", "0003_batch_expire_datetime"),
    ]

    operations = [
        migrations.CreateModel(
            name="StocktakeTask",
            fields=[
                ("id", models.BigAutoField(primary_key=True, serialize=False)),
                ("task_type", models.CharField(max_length=20)),
                ("scope_config", models.JSONField(default=dict)),
                ("status", models.CharField(default="draft", max_length=20)),
                ("created_at", models.DateTimeField(default=django.utils.timezone.now)),
                ("started_at", models.DateTimeField(blank=True, null=True)),
                ("submitted_at", models.DateTimeField(blank=True, null=True)),
                ("approved_at", models.DateTimeField(blank=True, null=True)),
                (
                    "approved_by",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.DO_NOTHING,
                        related_name="approved_stocktake_tasks",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
                (
                    "created_by",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.DO_NOTHING,
                        related_name="created_stocktake_tasks",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
                (
                    "submitted_by",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.DO_NOTHING,
                        related_name="submitted_stocktake_tasks",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={"db_table": "stocktake_tasks"},
        ),
        migrations.CreateModel(
            name="StocktakeItem",
            fields=[
                ("id", models.BigAutoField(primary_key=True, serialize=False)),
                ("snapshot_quantity", models.DecimalField(decimal_places=2, max_digits=12)),
                ("counted_quantity", models.DecimalField(blank=True, decimal_places=2, max_digits=12, null=True)),
                ("difference_quantity", models.DecimalField(blank=True, decimal_places=2, max_digits=12, null=True)),
                ("status", models.CharField(default="pending", max_length=20)),
                ("remarks", models.CharField(blank=True, max_length=255, null=True)),
                ("counted_at", models.DateTimeField(blank=True, null=True)),
                (
                    "batch",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.DO_NOTHING,
                        related_name="stocktake_items",
                        to="inventory.batch",
                    ),
                ),
                (
                    "counted_by",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.DO_NOTHING,
                        related_name="counted_stocktake_items",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
                (
                    "product",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.DO_NOTHING,
                        related_name="stocktake_items",
                        to="inventory.product",
                    ),
                ),
                (
                    "task",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="items",
                        to="inventory.stocktaketask",
                    ),
                ),
            ],
            options={"db_table": "stocktake_items"},
        ),
        migrations.CreateModel(
            name="StocktakeAuditLog",
            fields=[
                ("id", models.BigAutoField(primary_key=True, serialize=False)),
                ("action", models.CharField(max_length=50)),
                ("snapshot", models.JSONField(default=dict)),
                ("created_at", models.DateTimeField(default=django.utils.timezone.now)),
                (
                    "actor",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.DO_NOTHING,
                        related_name="stocktake_audit_logs",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
                (
                    "task",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="audit_logs",
                        to="inventory.stocktaketask",
                    ),
                ),
            ],
            options={"db_table": "stocktake_audit_logs"},
        ),
        migrations.AddIndex(
            model_name="stocktaketask",
            index=models.Index(fields=["status", "-created_at"], name="stocktake_tasks_status_idx"),
        ),
        migrations.AddIndex(
            model_name="stocktaketask",
            index=models.Index(fields=["task_type", "-created_at"], name="stocktake_tasks_type_idx"),
        ),
        migrations.AddIndex(
            model_name="stocktaketask",
            index=models.Index(fields=["created_by", "-created_at"], name="stocktake_tasks_creator_idx"),
        ),
        migrations.AddIndex(
            model_name="stocktakeitem",
            index=models.Index(fields=["task", "status"], name="stocktake_item_task_status_idx"),
        ),
        migrations.AddIndex(
            model_name="stocktakeitem",
            index=models.Index(fields=["batch"], name="stocktake_items_batch_idx"),
        ),
        migrations.AddIndex(
            model_name="stocktakeitem",
            index=models.Index(fields=["product"], name="stocktake_items_product_idx"),
        ),
        migrations.AddConstraint(
            model_name="stocktakeitem",
            constraint=models.UniqueConstraint(fields=("task", "batch"), name="stocktake_items_task_batch_uniq"),
        ),
        migrations.AddIndex(
            model_name="stocktakeauditlog",
            index=models.Index(fields=["task", "-created_at"], name="stocktake_audit_task_idx"),
        ),
        migrations.AddIndex(
            model_name="stocktakeauditlog",
            index=models.Index(fields=["actor", "-created_at"], name="stocktake_audit_actor_idx"),
        ),
        migrations.AddIndex(
            model_name="stocktakeauditlog",
            index=models.Index(fields=["action"], name="stocktake_audit_action_idx"),
        ),
    ]
