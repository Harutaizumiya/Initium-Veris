from django.conf import settings
from django.db import models
from django.db.models.functions import Now
from django.utils import timezone


class Product(models.Model):
    id = models.BigAutoField(primary_key=True)
    barcode = models.CharField(max_length=255, unique=True)
    product_name = models.CharField(max_length=255)
    shelf_life_days = models.IntegerField()
    location = models.CharField(max_length=255, blank=True, null=True)
    category = models.CharField(max_length=255, blank=True, null=True)
    unit = models.CharField(max_length=255, blank=True, null=True)
    created_at = models.DateTimeField(blank=True, db_default=Now())
    updated_at = models.DateTimeField(blank=True, db_default=Now())
    manufacturer = models.TextField()

    class Meta:
        managed = False
        db_table = "product"


class Batch(models.Model):
    id = models.AutoField(primary_key=True)
    product = models.ForeignKey(Product, on_delete=models.DO_NOTHING, related_name="batches", db_column="product_id")
    batch_code = models.CharField(max_length=255)
    quantity = models.DecimalField(max_digits=12, decimal_places=2, blank=True, null=True)
    received_at = models.DateTimeField(blank=True, db_default=Now())
    manufacture_date = models.DateField(blank=True, null=True)
    expire_date = models.DateTimeField(blank=True, null=True)
    status = models.CharField(max_length=255, blank=True, null=True)
    remarks = models.CharField(max_length=255, blank=True, null=True)

    class Meta:
        managed = False
        db_table = "batches"


class BatchOperation(models.Model):
    id = models.BigAutoField(primary_key=True)
    batch = models.ForeignKey(Batch, on_delete=models.DO_NOTHING, related_name="operations", db_column="batch_id")
    reversed_operation = models.ForeignKey(
        "self",
        on_delete=models.DO_NOTHING,
        related_name="reversal_operations",
        db_column="reversed_operation_id",
        blank=True,
        null=True,
    )
    operation_type = models.CharField(max_length=20)
    quantity = models.DecimalField(max_digits=12, decimal_places=2)
    quantity_after = models.DecimalField(max_digits=12, decimal_places=2)
    remarks = models.CharField(max_length=255, blank=True, null=True)
    created_at = models.DateTimeField(blank=True, db_default=Now())
    operator = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.DO_NOTHING,
        related_name="batch_operations",
        db_column="operator_id",
        blank=True,
        null=True,
    )

    class Meta:
        managed = False
        db_table = "batch_operations"
        indexes = [
            models.Index(fields=["batch", "-created_at", "-id"], name="batch_ops_batch_created_idx"),
            models.Index(fields=["operation_type"], name="batch_operations_type_idx"),
            models.Index(fields=["operator"], name="batch_ops_operator_idx"),
        ]
        constraints = [
            models.UniqueConstraint(fields=["reversed_operation"], name="batch_operations_reversed_operation_uniq"),
        ]


class BatchQrCredential(models.Model):
    id = models.BigAutoField(primary_key=True)
    batch = models.ForeignKey(Batch, on_delete=models.DO_NOTHING, related_name="qr_credentials", db_column="batch_id")
    batch_code = models.CharField(max_length=255)
    token_hash = models.CharField(max_length=64, unique=True)
    issued_at = models.DateTimeField(blank=True, db_default=Now())
    revoked_at = models.DateTimeField(blank=True, null=True)
    created_by = models.CharField(max_length=255, blank=True, null=True)

    class Meta:
        managed = False
        db_table = "batch_qr_credentials"
        indexes = [
            models.Index(fields=["batch", "revoked_at"], name="batch_qr_batch_rev_idx"),
            models.Index(fields=["batch_code"], name="batch_qr_credentials_code_idx"),
        ]


class QrScanAuditLog(models.Model):
    id = models.CharField(max_length=40, primary_key=True)
    raw_qr = models.TextField()
    batch = models.ForeignKey(
        Batch,
        on_delete=models.DO_NOTHING,
        related_name="qr_scan_audit_logs",
        db_column="batch_id",
        blank=True,
        null=True,
    )
    batch_code = models.CharField(max_length=255, blank=True, null=True)
    source = models.CharField(max_length=50)
    device_id = models.CharField(max_length=255, blank=True, null=True)
    client_scan_id = models.CharField(max_length=255, blank=True, null=True)
    scanner_user = models.CharField(max_length=255, blank=True, null=True)
    scanner_user_account = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.DO_NOTHING,
        related_name="qr_scan_audit_logs",
        db_column="scanner_user_id",
        blank=True,
        null=True,
    )
    scanned_at_client = models.DateTimeField(blank=True, null=True)
    scanned_at_server = models.DateTimeField(blank=True, db_default=Now())
    ip_address = models.GenericIPAddressField(blank=True, null=True)
    user_agent = models.TextField(blank=True, null=True)
    result_status = models.CharField(max_length=20)
    result_message = models.TextField()
    failure_reason = models.CharField(max_length=255, blank=True, null=True)

    class Meta:
        managed = False
        db_table = "qr_scan_audit_logs"
        indexes = [
            models.Index(fields=["batch", "-scanned_at_server"], name="qr_audit_batch_scan_idx"),
            models.Index(fields=["source", "device_id", "client_scan_id"], name="qr_audit_client_scan_idx"),
            models.Index(fields=["result_status"], name="qr_scan_audit_logs_status_idx"),
            models.Index(fields=["scanner_user_account"], name="qr_audit_scanner_idx"),
        ]


class InventoryAuditLog(models.Model):
    RESOURCE_PRODUCT = "product"
    RESOURCE_BATCH = "batch"
    ACTION_CREATE = "create"
    ACTION_UPDATE = "update"
    ACTION_DELETE = "delete"
    ACTION_STATUS_UPDATE = "status_update"

    resource_type = models.CharField(max_length=50)
    resource_id = models.CharField(max_length=64)
    action = models.CharField(max_length=50)
    actor = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.DO_NOTHING, related_name="inventory_audit_logs")
    snapshot = models.JSONField()
    created_at = models.DateTimeField(default=timezone.now)

    class Meta:
        db_table = "inventory_audit_logs"
        indexes = [
            models.Index(fields=["resource_type", "resource_id", "-created_at"], name="inv_audit_resource_idx"),
            models.Index(fields=["actor", "-created_at"], name="inv_audit_actor_idx"),
            models.Index(fields=["action"], name="inv_audit_action_idx"),
        ]


class StocktakeTask(models.Model):
    TYPE_DAILY = "daily"
    TYPE_WEEKLY = "weekly"
    TYPE_MONTHLY = "monthly"

    STATUS_DRAFT = "draft"
    STATUS_ACTIVE = "active"
    STATUS_SUBMITTED = "submitted"
    STATUS_APPROVED = "approved"
    STATUS_CANCELLED = "cancelled"

    id = models.BigAutoField(primary_key=True)
    task_type = models.CharField(max_length=20)
    scope_config = models.JSONField(default=dict)
    status = models.CharField(max_length=20, default=STATUS_DRAFT)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.DO_NOTHING,
        related_name="created_stocktake_tasks",
        blank=True,
        null=True,
    )
    submitted_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.DO_NOTHING,
        related_name="submitted_stocktake_tasks",
        blank=True,
        null=True,
    )
    approved_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.DO_NOTHING,
        related_name="approved_stocktake_tasks",
        blank=True,
        null=True,
    )
    created_at = models.DateTimeField(default=timezone.now)
    started_at = models.DateTimeField(blank=True, null=True)
    submitted_at = models.DateTimeField(blank=True, null=True)
    approved_at = models.DateTimeField(blank=True, null=True)

    class Meta:
        db_table = "stocktake_tasks"
        indexes = [
            models.Index(fields=["status", "-created_at"], name="stocktake_tasks_status_idx"),
            models.Index(fields=["task_type", "-created_at"], name="stocktake_tasks_type_idx"),
            models.Index(fields=["created_by", "-created_at"], name="stocktake_tasks_creator_idx"),
        ]


class StocktakeItem(models.Model):
    STATUS_PENDING = "pending"
    STATUS_COUNTED = "counted"
    STATUS_RECOUNT_REQUIRED = "recount_required"
    STATUS_APPROVED = "approved"

    id = models.BigAutoField(primary_key=True)
    task = models.ForeignKey(StocktakeTask, on_delete=models.CASCADE, related_name="items")
    batch = models.ForeignKey(Batch, on_delete=models.DO_NOTHING, related_name="stocktake_items")
    product = models.ForeignKey(Product, on_delete=models.DO_NOTHING, related_name="stocktake_items")
    snapshot_quantity = models.DecimalField(max_digits=12, decimal_places=2)
    counted_quantity = models.DecimalField(max_digits=12, decimal_places=2, blank=True, null=True)
    difference_quantity = models.DecimalField(max_digits=12, decimal_places=2, blank=True, null=True)
    status = models.CharField(max_length=20, default=STATUS_PENDING)
    remarks = models.CharField(max_length=255, blank=True, null=True)
    counted_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.DO_NOTHING,
        related_name="counted_stocktake_items",
        blank=True,
        null=True,
    )
    counted_at = models.DateTimeField(blank=True, null=True)

    class Meta:
        db_table = "stocktake_items"
        indexes = [
            models.Index(fields=["task", "status"], name="stocktake_item_task_status_idx"),
            models.Index(fields=["batch"], name="stocktake_items_batch_idx"),
            models.Index(fields=["product"], name="stocktake_items_product_idx"),
        ]
        constraints = [
            models.UniqueConstraint(fields=["task", "batch"], name="stocktake_items_task_batch_uniq"),
        ]


class StocktakeAuditLog(models.Model):
    id = models.BigAutoField(primary_key=True)
    task = models.ForeignKey(StocktakeTask, on_delete=models.CASCADE, related_name="audit_logs")
    action = models.CharField(max_length=50)
    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.DO_NOTHING,
        related_name="stocktake_audit_logs",
        blank=True,
        null=True,
    )
    snapshot = models.JSONField(default=dict)
    created_at = models.DateTimeField(default=timezone.now)

    class Meta:
        db_table = "stocktake_audit_logs"
        indexes = [
            models.Index(fields=["task", "-created_at"], name="stocktake_audit_task_idx"),
            models.Index(fields=["actor", "-created_at"], name="stocktake_audit_actor_idx"),
            models.Index(fields=["action"], name="stocktake_audit_action_idx"),
        ]
