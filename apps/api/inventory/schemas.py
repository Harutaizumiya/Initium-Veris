from datetime import date, datetime
from decimal import Decimal

from rest_framework import serializers
from django.utils import timezone

from inventory.expiry import VALID_EXPIRY_STATUSES, calc_days_until_expiry, calc_expiry_progress, calc_expiry_status
from inventory.models import Batch, BatchOperation, Product, StocktakeAuditLog, StocktakeItem, StocktakeTask
from inventory.services import QR_SCAN_SOURCES, QR_SCAN_STATUSES, STOCKTAKE_ITEM_STATUSES, STOCKTAKE_TASK_STATUSES, STOCKTAKE_TASK_TYPES


VALID_BATCH_OPERATION_TYPES = ("add", "loss", "deduct")
VALID_BATCH_OPERATION_FILTER_TYPES = (*VALID_BATCH_OPERATION_TYPES, "adjust")


class ProductListQuerySerializer(serializers.Serializer):
    search = serializers.CharField(required=False, allow_blank=True)
    page = serializers.IntegerField(required=False, default=1, min_value=1)
    size = serializers.IntegerField(required=False, default=20, min_value=1, max_value=100)


class CategoryQuerySerializer(serializers.Serializer):
    search = serializers.CharField(required=False, allow_blank=True)


class ProductCreateSerializer(serializers.Serializer):
    barcode = serializers.CharField()
    product_name = serializers.CharField()
    shelf_life_days = serializers.IntegerField(min_value=0)
    location = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    category = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    unit = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    manufacturer = serializers.CharField()


class ProductUpdateSerializer(serializers.Serializer):
    product_name = serializers.CharField(required=False)
    shelf_life_days = serializers.IntegerField(required=False, min_value=0)
    location = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    category = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    unit = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    manufacturer = serializers.CharField(required=False)


class ProductBatchListQuerySerializer(serializers.Serializer):
    status = serializers.CharField(required=False, allow_blank=False)
    expired_only = serializers.BooleanField(required=False, default=False)
    page = serializers.IntegerField(required=False, default=1, min_value=1)
    size = serializers.IntegerField(required=False, default=20, min_value=1, max_value=100)


class ProductOutputSerializer(serializers.ModelSerializer):
    class Meta:
        model = Product
        fields = [
            "id",
            "barcode",
            "product_name",
            "shelf_life_days",
            "location",
            "category",
            "unit",
            "manufacturer",
            "created_at",
            "updated_at",
        ]


class BatchListQuerySerializer(serializers.Serializer):
    product_id = serializers.IntegerField(required=False, min_value=1)
    status = serializers.CharField(required=False, allow_blank=False)
    expired_only = serializers.BooleanField(required=False, default=False)
    page = serializers.IntegerField(required=False, default=1, min_value=1)
    size = serializers.IntegerField(required=False, default=20, min_value=1, max_value=100)


class ExpiryAlertQuerySerializer(serializers.Serializer):
    product_id = serializers.IntegerField(required=False, min_value=1)
    status = serializers.CharField(required=False, allow_blank=False)
    category = serializers.CharField(required=False, allow_blank=False)
    location = serializers.CharField(required=False, allow_blank=False)
    expiry_status = serializers.ChoiceField(required=False, choices=VALID_EXPIRY_STATUSES)
    days_lte = serializers.IntegerField(required=False, default=30, min_value=0)
    include_expired = serializers.BooleanField(required=False, default=True)
    page = serializers.IntegerField(required=False, default=1, min_value=1)
    size = serializers.IntegerField(required=False, default=20, min_value=1, max_value=100)


class AnalyticsSummaryQuerySerializer(serializers.Serializer):
    range = serializers.ChoiceField(required=False, default="6m", choices=("1m", "3m", "6m", "12m"))


class BatchCreateSerializer(serializers.Serializer):
    product_id = serializers.IntegerField(min_value=1)
    batch_code = serializers.CharField(required=False, allow_blank=False)
    manufacture_date = serializers.DateField()
    expire_date = serializers.DateField(required=False, allow_null=True)
    status = serializers.CharField(required=False, allow_blank=False, default="unopened")
    remarks = serializers.CharField(required=False, allow_blank=True, allow_null=True)

    def validate(self, attrs):
        if "quantity" in self.initial_data:
            raise serializers.ValidationError({"quantity": "Use batch operations to change quantity."})
        return attrs


class BatchUpdateSerializer(serializers.Serializer):
    batch_code = serializers.CharField(required=False, allow_blank=False)
    manufacture_date = serializers.DateField(required=False)
    expire_date = serializers.DateField(required=False, allow_null=True)
    status = serializers.CharField(required=False, allow_blank=False)
    remarks = serializers.CharField(required=False, allow_blank=True, allow_null=True)

    def validate(self, attrs):
        if "quantity" in self.initial_data:
            raise serializers.ValidationError({"quantity": "Use batch operations to change quantity."})
        return attrs


class BatchStatusUpdateSerializer(serializers.Serializer):
    status = serializers.CharField()

    def validate_status(self, value):
        if value == "used_up":
            raise serializers.ValidationError("Use batch operations to mark inventory as used up.")
        return value


class BatchOperationCreateSerializer(serializers.Serializer):
    operation_type = serializers.ChoiceField(choices=VALID_BATCH_OPERATION_TYPES)
    quantity = serializers.DecimalField(max_digits=12, decimal_places=2, min_value=Decimal("0.01"))
    remarks = serializers.CharField(required=False, allow_blank=True, allow_null=True)


class BatchOperationRevertSerializer(serializers.Serializer):
    remarks = serializers.CharField(required=False, allow_blank=True, allow_null=True)


class BatchOperationListQuerySerializer(serializers.Serializer):
    operation_type = serializers.ChoiceField(required=False, choices=VALID_BATCH_OPERATION_FILTER_TYPES)
    page = serializers.IntegerField(required=False, default=1, min_value=1)
    size = serializers.IntegerField(required=False, default=20, min_value=1, max_value=100)


class QrScanRequestSerializer(serializers.Serializer):
    qr = serializers.CharField()
    source = serializers.ChoiceField(required=False, choices=QR_SCAN_SOURCES, allow_blank=True, allow_null=True)
    deviceId = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    clientScanId = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    scannedAt = serializers.DateTimeField(required=False, allow_null=True)

    def validate(self, attrs):
        for field in ("source", "deviceId", "clientScanId"):
            if attrs.get(field) == "":
                attrs[field] = None
        return attrs


class QrScanBulkRequestSerializer(serializers.Serializer):
    items = QrScanRequestSerializer(many=True, allow_empty=False)


class QrScanListQuerySerializer(serializers.Serializer):
    days = serializers.IntegerField(required=False, default=1)

    def validate_days(self, value):
        if value not in {1, 7}:
            raise serializers.ValidationError("days must be 1 or 7")
        return value


class BatchLabelPayloadSerializer(serializers.Serializer):
    batchCode = serializers.CharField()
    productName = serializers.CharField()
    barcode = serializers.CharField()
    quantity = serializers.CharField(allow_null=True)
    location = serializers.CharField(allow_null=True)
    expireDate = serializers.CharField(allow_null=True)
    qrCode = serializers.CharField()


class QrScanResultSerializer(serializers.Serializer):
    auditId = serializers.CharField()
    batchCode = serializers.CharField(allow_null=True)
    productName = serializers.CharField(allow_null=True)
    status = serializers.ChoiceField(choices=QR_SCAN_STATUSES)
    message = serializers.CharField()
    expireDate = serializers.CharField(allow_null=True)
    remainingDays = serializers.IntegerField(allow_null=True)
    clientScanId = serializers.CharField(required=False, allow_null=True)


class QrScanBulkResultSerializer(serializers.Serializer):
    items = QrScanResultSerializer(many=True)


class QrScanAuditItemSerializer(QrScanResultSerializer):
    scannedAt = serializers.DateTimeField()
    scannerUser = serializers.CharField(allow_null=True)


class QrScanAuditListSerializer(serializers.Serializer):
    items = QrScanAuditItemSerializer(many=True)


class ProductSummarySerializer(serializers.ModelSerializer):
    class Meta:
        model = Product
        fields = ["id", "barcode", "product_name", "unit", "manufacturer"]


class BatchOutputSerializer(serializers.ModelSerializer):
    product_id = serializers.IntegerField(source="product.id", read_only=True)
    product = ProductSummarySerializer(read_only=True)
    expire_date = serializers.SerializerMethodField()
    days_until_expiry = serializers.SerializerMethodField()
    expiry_progress = serializers.SerializerMethodField()
    expiry_status = serializers.SerializerMethodField()

    def get_expire_date(self, obj):
        value = self._value(obj, "expire_date")
        if value is None:
            return None
        if isinstance(value, datetime):
            return timezone.localtime(value).isoformat() if timezone.is_aware(value) else value.isoformat()
        if isinstance(value, date):
            return value.isoformat()
        return str(value)

    def get_days_until_expiry(self, obj):
        return calc_days_until_expiry(self._value(obj, "expire_date"))

    def get_expiry_progress(self, obj):
        return calc_expiry_progress(
            self._value(obj, "manufacture_date"),
            self._product_value(obj, "shelf_life_days"),
        )

    def get_expiry_status(self, obj):
        return calc_expiry_status(
            self._value(obj, "manufacture_date"),
            self._product_value(obj, "shelf_life_days"),
            expire_date=self._value(obj, "expire_date"),
        )

    @staticmethod
    def _value(obj, field):
        if isinstance(obj, dict):
            return obj.get(field)
        return getattr(obj, field, None)

    @classmethod
    def _product_value(cls, obj, field):
        product = cls._value(obj, "product")
        if isinstance(product, dict):
            return product.get(field)
        return getattr(product, field, None)

    class Meta:
        model = Batch
        fields = [
            "id",
            "product_id",
            "batch_code",
            "quantity",
            "received_at",
            "manufacture_date",
            "expire_date",
            "status",
            "remarks",
            "days_until_expiry",
            "expiry_progress",
            "expiry_status",
            "product",
        ]


class BatchQuantitySummarySerializer(serializers.ModelSerializer):
    class Meta:
        model = Batch
        fields = ["id", "quantity", "status"]


class BatchOperationOutputSerializer(serializers.ModelSerializer):
    is_reverted = serializers.SerializerMethodField()

    def get_is_reverted(self, obj):
        if isinstance(obj, dict):
            return bool(obj.get("is_reverted"))
        if hasattr(obj, "is_reverted"):
            return bool(obj.is_reverted)
        if not hasattr(obj, "reversal_operations"):
            return False
        return obj.reversal_operations.exists()

    class Meta:
        model = BatchOperation
        fields = [
            "id",
            "batch_id",
            "operation_type",
            "quantity",
            "quantity_after",
            "remarks",
            "created_at",
            "reversed_operation_id",
            "is_reverted",
        ]


class ExpiryTrendPointSerializer(serializers.Serializer):
    date = serializers.CharField()
    batch_count = serializers.IntegerField()
    quantity = serializers.DecimalField(max_digits=18, decimal_places=2)


class CategoryInventoryDistributionSerializer(serializers.Serializer):
    category = serializers.CharField()
    batch_count = serializers.IntegerField()
    quantity = serializers.DecimalField(max_digits=18, decimal_places=2)
    ratio = serializers.FloatField()


class DashboardOverviewSerializer(serializers.Serializer):
    current_inventory_quantity = serializers.DecimalField(max_digits=18, decimal_places=2)
    near_expiry_batch_count = serializers.IntegerField()
    expired_batch_count = serializers.IntegerField()
    batch_health_rate = serializers.FloatField()
    expiry_trend_30d = ExpiryTrendPointSerializer(many=True)
    category_inventory_distribution = CategoryInventoryDistributionSerializer(many=True)
    top_near_expiry_batches = BatchOutputSerializer(many=True)


class AnalyticsPeriodSerializer(serializers.Serializer):
    start = serializers.CharField()
    end = serializers.CharField()


class MonthlyInventoryLossTrendSerializer(serializers.Serializer):
    month = serializers.CharField()
    inventory_quantity = serializers.DecimalField(max_digits=18, decimal_places=2)
    loss_quantity = serializers.DecimalField(max_digits=18, decimal_places=2)


class CategoryOperationSummarySerializer(serializers.Serializer):
    category = serializers.CharField()
    inbound_quantity = serializers.DecimalField(max_digits=18, decimal_places=2)
    outbound_loss_quantity = serializers.DecimalField(max_digits=18, decimal_places=2)
    operation_count = serializers.IntegerField()


class AnalyticsSummarySerializer(serializers.Serializer):
    range = serializers.CharField()
    period = AnalyticsPeriodSerializer()
    inventory_change_count = serializers.IntegerField()
    current_month_loss_quantity = serializers.DecimalField(max_digits=18, decimal_places=2)
    average_stock_age_days = serializers.FloatField(allow_null=True)
    monthly_inventory_loss_trend = MonthlyInventoryLossTrendSerializer(many=True)
    category_operation_summary = CategoryOperationSummarySerializer(many=True)
    high_risk_inventory_ranking = BatchOutputSerializer(many=True)


class StocktakeListQuerySerializer(serializers.Serializer):
    task_type = serializers.ChoiceField(required=False, choices=STOCKTAKE_TASK_TYPES)
    status = serializers.ChoiceField(required=False, choices=STOCKTAKE_TASK_STATUSES)
    page = serializers.IntegerField(required=False, default=1, min_value=1)
    size = serializers.IntegerField(required=False, default=20, min_value=1, max_value=100)


class StocktakeCreateSerializer(serializers.Serializer):
    task_type = serializers.ChoiceField(choices=STOCKTAKE_TASK_TYPES)
    scope_config = serializers.DictField(required=False)


class StocktakeScopeUpdateSerializer(serializers.Serializer):
    add_batch_ids = serializers.ListField(child=serializers.IntegerField(min_value=1), required=False)
    add_product_ids = serializers.ListField(child=serializers.IntegerField(min_value=1), required=False)
    add_categories = serializers.ListField(child=serializers.CharField(allow_blank=False), required=False)
    add_locations = serializers.ListField(child=serializers.CharField(allow_blank=False), required=False)
    add_expiry_statuses = serializers.ListField(child=serializers.CharField(allow_blank=False), required=False)
    add_recent_changes_days = serializers.IntegerField(required=False, min_value=1, max_value=365)
    remove_batch_ids = serializers.ListField(child=serializers.IntegerField(min_value=1), required=False)
    scope_config = serializers.DictField(required=False)


class StocktakeItemCountSerializer(serializers.Serializer):
    counted_quantity = serializers.DecimalField(max_digits=12, decimal_places=2, min_value=Decimal("0"))
    status = serializers.ChoiceField(required=False, choices=("counted", "recount_required"))
    remarks = serializers.CharField(required=False, allow_blank=True, allow_null=True)


class StocktakeDecisionSerializer(serializers.Serializer):
    remarks = serializers.CharField(required=False, allow_blank=True, allow_null=True)


class StocktakeUserSerializer(serializers.Serializer):
    id = serializers.IntegerField(allow_null=True)
    username = serializers.CharField(allow_null=True)
    display = serializers.CharField(allow_null=True)


class StocktakeProductSerializer(serializers.ModelSerializer):
    class Meta:
        model = Product
        fields = ["id", "barcode", "product_name", "category", "location", "unit", "manufacturer"]


class StocktakeBatchSerializer(serializers.ModelSerializer):
    product = StocktakeProductSerializer(read_only=True)
    expire_date = serializers.SerializerMethodField()
    days_until_expiry = serializers.SerializerMethodField()
    expiry_status = serializers.SerializerMethodField()

    def get_expire_date(self, obj):
        return BatchOutputSerializer().get_expire_date(obj)

    def get_days_until_expiry(self, obj):
        return calc_days_until_expiry(obj.expire_date)

    def get_expiry_status(self, obj):
        return calc_expiry_status(obj.manufacture_date, obj.product.shelf_life_days, expire_date=obj.expire_date)

    class Meta:
        model = Batch
        fields = [
            "id",
            "product_id",
            "batch_code",
            "quantity",
            "received_at",
            "manufacture_date",
            "expire_date",
            "status",
            "remarks",
            "days_until_expiry",
            "expiry_status",
            "product",
        ]


class StocktakeItemOutputSerializer(serializers.ModelSerializer):
    batch = StocktakeBatchSerializer(read_only=True)
    product = StocktakeProductSerializer(read_only=True)
    counted_by = serializers.SerializerMethodField()

    def get_counted_by(self, obj):
        return user_payload(getattr(obj, "counted_by", None))

    class Meta:
        model = StocktakeItem
        fields = [
            "id",
            "task_id",
            "batch_id",
            "product_id",
            "snapshot_quantity",
            "counted_quantity",
            "difference_quantity",
            "status",
            "remarks",
            "counted_by",
            "counted_at",
            "batch",
            "product",
        ]


def user_payload(user):
    if user is None:
        return None
    return {
        "id": getattr(user, "id", None),
        "username": getattr(user, "username", None),
        "display": str(user),
    }


class StocktakeTaskOutputSerializer(serializers.ModelSerializer):
    created_by = serializers.SerializerMethodField()
    submitted_by = serializers.SerializerMethodField()
    approved_by = serializers.SerializerMethodField()
    stats = serializers.SerializerMethodField()
    items = serializers.SerializerMethodField()

    def get_created_by(self, obj):
        return user_payload(getattr(obj, "created_by", None))

    def get_submitted_by(self, obj):
        return user_payload(getattr(obj, "submitted_by", None))

    def get_approved_by(self, obj):
        return user_payload(getattr(obj, "approved_by", None))

    def get_stats(self, obj):
        from inventory.services import StocktakeService

        return StocktakeService.task_stats(obj)

    def get_items(self, obj):
        include_items = self.context.get("include_items", False)
        if not include_items:
            return None
        from inventory.services import StocktakeService

        return StocktakeItemOutputSerializer(StocktakeService.list_items(obj.id), many=True).data

    class Meta:
        model = StocktakeTask
        fields = [
            "id",
            "task_type",
            "scope_config",
            "status",
            "created_by",
            "submitted_by",
            "approved_by",
            "created_at",
            "started_at",
            "submitted_at",
            "approved_at",
            "stats",
            "items",
        ]


class StocktakeAuditLogSerializer(serializers.ModelSerializer):
    actor = serializers.SerializerMethodField()

    def get_actor(self, obj):
        return user_payload(getattr(obj, "actor", None))

    class Meta:
        model = StocktakeAuditLog
        fields = ["id", "task_id", "action", "actor", "snapshot", "created_at"]
