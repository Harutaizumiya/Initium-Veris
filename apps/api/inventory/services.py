from __future__ import annotations

import hashlib
import secrets
from datetime import date, datetime, time, timedelta
from decimal import Decimal
from uuid import uuid4

from django.conf import settings
from django.db import DatabaseError, IntegrityError, connection, transaction
from django.db.models import Exists, OuterRef, Q
from django.utils import timezone

from common.cache_utils import (
    CACHE_GROUP_INVENTORY_READ,
    CACHE_GROUP_PRODUCT_CATEGORIES,
    invalidate_cache_groups,
)
from common.exceptions import ConflictApiError, NotFoundApiError, ValidationApiError
from inventory.expiry import (
    ALERT_EXPIRY_STATUSES,
    EXPIRY_STATUS_EXPIRED,
    build_expiry_datetime,
    calc_days_until_expiry,
    calc_expiry_progress,
    calc_expiry_status,
    normalize_expiry_datetime,
)
from inventory.models import (
    Batch,
    BatchOperation,
    BatchQrCredential,
    InventoryAuditLog,
    Product,
    QrScanAuditLog,
    StocktakeAuditLog,
    StocktakeItem,
    StocktakeTask,
)


QR_CODE_PREFIX = "OB1"
QR_SCAN_SOURCES = ("web_camera", "mobile_camera", "handheld")

QR_SCAN_STATUS_VALID = "valid"
QR_SCAN_STATUS_NEAR_EXPIRY = "near_expiry"
QR_SCAN_STATUS_EXPIRED = "expired"
QR_SCAN_STATUS_INVALID = "invalid"
QR_SCAN_STATUS_REVOKED = "revoked"
QR_SCAN_STATUS_NOT_FOUND = "not_found"

QR_SCAN_STATUSES = (
    QR_SCAN_STATUS_VALID,
    QR_SCAN_STATUS_NEAR_EXPIRY,
    QR_SCAN_STATUS_EXPIRED,
    QR_SCAN_STATUS_INVALID,
    QR_SCAN_STATUS_REVOKED,
    QR_SCAN_STATUS_NOT_FOUND,
)

STOCKTAKE_TASK_TYPES = (
    StocktakeTask.TYPE_DAILY,
    StocktakeTask.TYPE_WEEKLY,
    StocktakeTask.TYPE_MONTHLY,
)
STOCKTAKE_TASK_STATUSES = (
    StocktakeTask.STATUS_DRAFT,
    StocktakeTask.STATUS_ACTIVE,
    StocktakeTask.STATUS_SUBMITTED,
    StocktakeTask.STATUS_APPROVED,
    StocktakeTask.STATUS_CANCELLED,
)
STOCKTAKE_ITEM_STATUSES = (
    StocktakeItem.STATUS_PENDING,
    StocktakeItem.STATUS_COUNTED,
    StocktakeItem.STATUS_RECOUNT_REQUIRED,
    StocktakeItem.STATUS_APPROVED,
)
STOCKTAKE_ADJUST_OPERATION_TYPE = "adjust"


def _raise_conflict(detail: str, exc: Exception) -> None:
    raise ConflictApiError(detail) from exc


def _format_date(value) -> str | None:
    if value is None:
        return None
    if isinstance(value, datetime):
        if timezone.is_aware(value):
            return timezone.localtime(value).isoformat()
        return value.isoformat()
    if isinstance(value, date):
        return value.isoformat()
    return str(value)


def _format_local_date(value) -> str | None:
    if value is None:
        return None
    if isinstance(value, datetime):
        if timezone.is_aware(value):
            return timezone.localtime(value).date().isoformat()
        return value.date().isoformat()
    if isinstance(value, date):
        return value.isoformat()
    return str(value)[:10]


def _format_decimal(value) -> str | None:
    if value is None:
        return None
    return f"{Decimal(value):.2f}"


def _decimal_or_zero(value) -> Decimal:
    if value is None:
        return Decimal("0")
    return Decimal(str(value))


def _obj_value(obj, field: str, default=None):
    if isinstance(obj, dict):
        return obj.get(field, default)
    return getattr(obj, field, default)


def _actor_id(actor) -> int | None:
    return getattr(actor, "id", None)


def _json_value(value):
    if isinstance(value, Decimal):
        return _format_decimal(value)
    if isinstance(value, datetime):
        return value.isoformat()
    if isinstance(value, date):
        return value.isoformat()
    if isinstance(value, dict):
        return {key: _json_value(item) for key, item in value.items()}
    if isinstance(value, (list, tuple, set)):
        return [_json_value(item) for item in value]
    return value


def _product_value(batch, field: str, default=None):
    product = _obj_value(batch, "product")
    if product is None:
        return default
    return _obj_value(product, field, default)


def _category_name(value) -> str:
    return value or "未分类"


def _as_local_date(value) -> date | None:
    if value is None:
        return None
    if isinstance(value, datetime):
        if timezone.is_aware(value):
            return timezone.localtime(value).date()
        return value.date()
    if isinstance(value, date):
        return value
    if isinstance(value, str):
        return date.fromisoformat(value[:10])
    return None


def _month_start(value: date) -> date:
    return date(value.year, value.month, 1)


def _add_months(value: date, months: int) -> date:
    month_index = value.year * 12 + value.month - 1 + months
    return date(month_index // 12, month_index % 12 + 1, 1)


def _month_label(value: date) -> str:
    return f"{value.year:04d}-{value.month:02d}"


def _month_starts(*, end_month: date, months: int) -> list[date]:
    start_month = _add_months(end_month, -(months - 1))
    return [_add_months(start_month, index) for index in range(months)]


def _start_of_day(value: date) -> datetime:
    return timezone.make_aware(datetime.combine(value, time.min), timezone.get_current_timezone())


def _batch_days_until_expiry(batch, now: date | datetime) -> int | None:
    return calc_days_until_expiry(_obj_value(batch, "expire_date"), now)


def _batch_expiry_progress(batch, now: date | datetime) -> float | None:
    return calc_expiry_progress(
        _obj_value(batch, "manufacture_date"),
        _product_value(batch, "shelf_life_days"),
        now,
    )


def _batch_expiry_status(batch, now: date | datetime) -> str:
    return calc_expiry_status(
        _obj_value(batch, "manufacture_date"),
        _product_value(batch, "shelf_life_days"),
        now,
        expire_date=_obj_value(batch, "expire_date"),
    )


def _is_near_expiry_batch(batch, now: date | datetime) -> bool:
    days = _batch_days_until_expiry(batch, now)
    return days is not None and 0 <= days <= 7


def _is_expired_batch(batch, now: date | datetime) -> bool:
    days = _batch_days_until_expiry(batch, now)
    return (days is not None and days < 0) or _batch_expiry_status(batch, now) == EXPIRY_STATUS_EXPIRED


def _expiry_sort_key(batch, now: date | datetime):
    days = _batch_days_until_expiry(batch, now)
    progress = _batch_expiry_progress(batch, now) or 0
    quantity = _decimal_or_zero(_obj_value(batch, "quantity"))
    return (
        days is None,
        days if days is not None else 999999,
        -progress,
        -quantity,
        -(_obj_value(batch, "id") or 0),
    )


class ProductService:
    searchable_fields = ("barcode", "product_name", "category", "location", "unit", "manufacturer")

    @classmethod
    def list_products(cls, *, search: str | None, page: int, size: int):
        try:
            queryset = Product.objects.all().order_by("id")
            if search:
                query = Q()
                for field in cls.searchable_fields:
                    query |= Q(**{f"{field}__icontains": search})
                queryset = queryset.filter(query)

            total = queryset.count()
            offset = (page - 1) * size
            return list(queryset[offset : offset + size]), total
        except DatabaseError as exc:
            _raise_conflict("Unable to list products", exc)

    @staticmethod
    def get_product(product_id: int):
        try:
            return Product.objects.get(pk=product_id)
        except Product.DoesNotExist as exc:
            raise NotFoundApiError(f"Product {product_id} not found") from exc
        except DatabaseError as exc:
            _raise_conflict("Unable to load product", exc)

    @staticmethod
    def get_product_by_barcode(barcode: str):
        try:
            return Product.objects.get(barcode=barcode)
        except Product.DoesNotExist as exc:
            raise NotFoundApiError(f"Product with barcode {barcode} not found") from exc
        except DatabaseError as exc:
            _raise_conflict("Unable to load product", exc)

    @staticmethod
    def _snapshot(product) -> dict:
        return {
            "id": _obj_value(product, "id"),
            "barcode": _obj_value(product, "barcode"),
            "product_name": _obj_value(product, "product_name"),
            "shelf_life_days": _obj_value(product, "shelf_life_days"),
            "location": _obj_value(product, "location"),
            "category": _obj_value(product, "category"),
            "unit": _obj_value(product, "unit"),
            "manufacturer": _obj_value(product, "manufacturer"),
            "created_at": _json_value(_obj_value(product, "created_at")),
            "updated_at": _json_value(_obj_value(product, "updated_at")),
        }

    @staticmethod
    def create_product(data: dict, *, actor=None):
        try:
            with transaction.atomic():
                product = Product.objects.create(**data)
                InventoryAuditService.record_product(product, action=InventoryAuditLog.ACTION_CREATE, actor=actor)
        except IntegrityError as exc:
            raise ConflictApiError("Barcode already exists") from exc
        except DatabaseError as exc:
            _raise_conflict("Unable to create product", exc)
        product.refresh_from_db(fields=["created_at", "updated_at"])
        invalidate_cache_groups(CACHE_GROUP_INVENTORY_READ, CACHE_GROUP_PRODUCT_CATEGORIES)
        return product

    @staticmethod
    def update_product(product_id: int, data: dict, *, actor=None):
        try:
            product = Product.objects.get(pk=product_id)
        except Product.DoesNotExist as exc:
            raise NotFoundApiError(f"Product {product_id} not found") from exc

        for field, value in data.items():
            setattr(product, field, value)

        try:
            with transaction.atomic():
                product.save(update_fields=list(data.keys()))
                InventoryAuditService.record_product(product, action=InventoryAuditLog.ACTION_UPDATE, actor=actor)
        except IntegrityError as exc:
            raise ConflictApiError("Barcode already exists") from exc
        except DatabaseError as exc:
            _raise_conflict("Unable to update product", exc)

        product.refresh_from_db(fields=["updated_at"])
        invalidate_cache_groups(CACHE_GROUP_INVENTORY_READ, CACHE_GROUP_PRODUCT_CATEGORIES)
        return product

    @staticmethod
    def delete_product(product_id: int, *, actor=None):
        try:
            product = Product.objects.get(pk=product_id)
        except Product.DoesNotExist as exc:
            raise NotFoundApiError(f"Product {product_id} not found") from exc

        deleted_id = product.id
        try:
            with transaction.atomic():
                InventoryAuditService.record_product(product, action=InventoryAuditLog.ACTION_DELETE, actor=actor)
                product.delete()
        except IntegrityError as exc:
            _raise_conflict("Unable to delete product", exc)
        except DatabaseError as exc:
            _raise_conflict("Unable to delete product", exc)
        invalidate_cache_groups(CACHE_GROUP_INVENTORY_READ, CACHE_GROUP_PRODUCT_CATEGORIES)
        return {"id": deleted_id}

    @staticmethod
    def list_categories(search: str | None):
        try:
            queryset = Product.objects.exclude(category__isnull=True).exclude(category__exact="")
            if search:
                queryset = queryset.filter(category__icontains=search)
            return list(queryset.order_by("category").values_list("category", flat=True).distinct())
        except DatabaseError as exc:
            _raise_conflict("Unable to list categories", exc)


class InventoryAuditService:
    @staticmethod
    def record(*, resource_type: str, resource_id, action: str, actor, snapshot: dict) -> None:
        if actor is None:
            return
        InventoryAuditLog.objects.create(
            resource_type=resource_type,
            resource_id=str(resource_id),
            action=action,
            actor=actor,
            snapshot=snapshot,
        )

    @classmethod
    def record_product(cls, product, *, action: str, actor) -> None:
        cls.record(
            resource_type=InventoryAuditLog.RESOURCE_PRODUCT,
            resource_id=_obj_value(product, "id"),
            action=action,
            actor=actor,
            snapshot=ProductService._snapshot(product),
        )

    @classmethod
    def record_batch(cls, batch, *, action: str, actor) -> None:
        cls.record(
            resource_type=InventoryAuditLog.RESOURCE_BATCH,
            resource_id=_obj_value(batch, "id"),
            action=action,
            actor=actor,
            snapshot=BatchService._snapshot(batch),
        )


class DashboardService:
    @staticmethod
    def _active_batches() -> list:
        return list(
            Batch.objects.select_related("product")
            .only(
                "id",
                "batch_code",
                "quantity",
                "received_at",
                "manufacture_date",
                "expire_date",
                "status",
                "remarks",
                "product__id",
                "product__barcode",
                "product__product_name",
                "product__unit",
                "product__manufacturer",
                "product__category",
                "product__shelf_life_days",
            )
            .filter(quantity__gt=Decimal("0"))
            .exclude(status="used_up")
        )

    @classmethod
    def get_overview(cls) -> dict:
        try:
            now = timezone.now()
            today = timezone.localdate()
            batches = cls._active_batches()
            total_quantity = sum((_decimal_or_zero(_obj_value(batch, "quantity")) for batch in batches), Decimal("0"))
            near_expiry_batches = [batch for batch in batches if _is_near_expiry_batch(batch, now)]
            expired_batches = [batch for batch in batches if _is_expired_batch(batch, now)]
            healthy_batches = [
                batch
                for batch in batches
                if not _is_near_expiry_batch(batch, now) and not _is_expired_batch(batch, now)
            ]

            return {
                "current_inventory_quantity": total_quantity,
                "near_expiry_batch_count": len(near_expiry_batches),
                "expired_batch_count": len(expired_batches),
                "batch_health_rate": cls._health_rate(len(healthy_batches), len(batches)),
                "expiry_trend_30d": cls._expiry_trend_30d(batches, today),
                "category_inventory_distribution": cls._category_inventory_distribution(batches, total_quantity),
                "top_near_expiry_batches": sorted(near_expiry_batches, key=lambda batch: _expiry_sort_key(batch, now))[
                    :5
                ],
            }
        except DatabaseError as exc:
            _raise_conflict("Unable to build dashboard overview", exc)

    @staticmethod
    def _health_rate(healthy_count: int, total_count: int) -> float:
        if total_count == 0:
            return 1.0
        return round(healthy_count / total_count, 4)

    @staticmethod
    def _expiry_trend_30d(batches: list, today: date) -> list[dict]:
        buckets = {
            today + timedelta(days=offset): {
                "date": (today + timedelta(days=offset)).isoformat(),
                "batch_count": 0,
                "quantity": Decimal("0"),
            }
            for offset in range(31)
        }
        for batch in batches:
            expire_date = _as_local_date(_obj_value(batch, "expire_date"))
            if expire_date not in buckets:
                continue
            bucket = buckets[expire_date]
            bucket["batch_count"] += 1
            bucket["quantity"] += _decimal_or_zero(_obj_value(batch, "quantity"))
        return list(buckets.values())

    @staticmethod
    def _category_inventory_distribution(batches: list, total_quantity: Decimal) -> list[dict]:
        buckets: dict[str, dict] = {}
        for batch in batches:
            category = _category_name(_product_value(batch, "category"))
            bucket = buckets.setdefault(
                category,
                {"category": category, "batch_count": 0, "quantity": Decimal("0"), "ratio": 0.0},
            )
            bucket["batch_count"] += 1
            bucket["quantity"] += _decimal_or_zero(_obj_value(batch, "quantity"))

        for bucket in buckets.values():
            if total_quantity > 0:
                bucket["ratio"] = round(float(bucket["quantity"] / total_quantity), 4)

        return sorted(buckets.values(), key=lambda item: (-item["quantity"], item["category"]))


class AnalyticsService:
    range_month_choices = {"1m": 1, "3m": 3, "6m": 6, "12m": 12}

    @staticmethod
    def _active_batches() -> list:
        return DashboardService._active_batches()

    @staticmethod
    def _effective_operations(start_at: datetime, end_at: datetime) -> list:
        reversal_queryset = BatchOperation.objects.filter(reversed_operation_id=OuterRef("pk"))
        return list(
            BatchOperation.objects.select_related("batch__product")
            .only(
                "id",
                "operation_type",
                "quantity",
                "created_at",
                "reversed_operation_id",
                "batch__id",
                "batch__product__id",
                "batch__product__category",
            )
            .filter(created_at__gte=start_at, created_at__lt=end_at)
            .annotate(is_reverted=Exists(reversal_queryset))
            .filter(reversed_operation_id__isnull=True, is_reverted=False)
        )

    @classmethod
    def get_summary(cls, *, range_value: str = "6m") -> dict:
        try:
            now = timezone.now()
            today = timezone.localdate()
            months = cls.range_month_choices[range_value]
            current_month = _month_start(today)
            months_in_range = _month_starts(end_month=current_month, months=months)
            period_start = months_in_range[0]
            period_end = today
            start_at = _start_of_day(period_start)
            end_at = _start_of_day(period_end + timedelta(days=1))
            active_batches = cls._active_batches()
            operations = cls._effective_operations(start_at, end_at)

            return {
                "range": range_value,
                "period": {
                    "start": period_start.isoformat(),
                    "end": period_end.isoformat(),
                },
                "inventory_change_count": len(operations),
                "current_month_loss_quantity": cls._loss_quantity(
                    operations,
                    start_date=current_month,
                    end_date=period_end,
                ),
                "average_stock_age_days": cls._average_stock_age_days(active_batches, today),
                "monthly_inventory_loss_trend": cls._monthly_inventory_loss_trend(
                    active_batches,
                    operations,
                    months_in_range,
                    period_end,
                ),
                "category_operation_summary": cls._category_operation_summary(operations),
                "high_risk_inventory_ranking": cls._high_risk_inventory_ranking(active_batches, now),
            }
        except DatabaseError as exc:
            _raise_conflict("Unable to build analytics summary", exc)

    @staticmethod
    def _loss_quantity(operations: list, *, start_date: date, end_date: date) -> Decimal:
        total = Decimal("0")
        for operation in operations:
            operation_date = _as_local_date(_obj_value(operation, "created_at"))
            if operation_date is None or not start_date <= operation_date <= end_date:
                continue
            if _obj_value(operation, "operation_type") == "loss":
                total += _decimal_or_zero(_obj_value(operation, "quantity"))
        return total

    @staticmethod
    def _average_stock_age_days(active_batches: list, today: date) -> float | None:
        ages: list[int] = []
        for batch in active_batches:
            received_date = _as_local_date(_obj_value(batch, "received_at"))
            if received_date is None:
                continue
            ages.append((today - received_date).days)
        if not ages:
            return None
        return round(sum(ages) / len(ages), 1)

    @staticmethod
    def _monthly_inventory_loss_trend(
        active_batches: list,
        operations: list,
        months_in_range: list[date],
        period_end: date,
    ) -> list[dict]:
        month_keys = {_month_label(month): month for month in months_in_range}
        buckets = {
            _month_label(month): {
                "month": _month_label(month),
                "inventory_quantity": Decimal("0"),
                "loss_quantity": Decimal("0"),
            }
            for month in months_in_range
        }

        for batch in active_batches:
            received_date = _as_local_date(_obj_value(batch, "received_at"))
            if received_date is None or received_date > period_end:
                continue
            month = _month_label(_month_start(received_date))
            if month in month_keys:
                buckets[month]["inventory_quantity"] += _decimal_or_zero(_obj_value(batch, "quantity"))

        for operation in operations:
            operation_date = _as_local_date(_obj_value(operation, "created_at"))
            if operation_date is None or operation_date > period_end:
                continue
            month = _month_label(_month_start(operation_date))
            if month in month_keys and _obj_value(operation, "operation_type") == "loss":
                buckets[month]["loss_quantity"] += _decimal_or_zero(_obj_value(operation, "quantity"))

        return list(buckets.values())

    @staticmethod
    def _category_operation_summary(operations: list) -> list[dict]:
        buckets: dict[str, dict] = {}
        for operation in operations:
            batch = _obj_value(operation, "batch")
            category = _category_name(_product_value(batch, "category"))
            bucket = buckets.setdefault(
                category,
                {
                    "category": category,
                    "inbound_quantity": Decimal("0"),
                    "outbound_loss_quantity": Decimal("0"),
                    "operation_count": 0,
                },
            )
            operation_type = _obj_value(operation, "operation_type")
            quantity = _decimal_or_zero(_obj_value(operation, "quantity"))
            if operation_type == "add":
                bucket["inbound_quantity"] += quantity
            elif operation_type in BatchOperationService.decrease_operation_types:
                bucket["outbound_loss_quantity"] += quantity
            bucket["operation_count"] += 1

        return sorted(
            buckets.values(),
            key=lambda item: (-(item["inbound_quantity"] + item["outbound_loss_quantity"]), item["category"]),
        )

    @staticmethod
    def _high_risk_inventory_ranking(active_batches: list, now: date | datetime) -> list:
        high_risk_batches = [
            batch
            for batch in active_batches
            if _is_expired_batch(batch, now)
            or (_batch_days_until_expiry(batch, now) is not None and _batch_days_until_expiry(batch, now) <= 30)
            or _batch_expiry_status(batch, now) in ALERT_EXPIRY_STATUSES
        ]
        return sorted(high_risk_batches, key=lambda batch: _expiry_sort_key(batch, now))[:10]


class BatchService:
    @staticmethod
    def _generate_batch_code() -> str:
        return f"BATCH-{datetime.now().strftime('%Y%m%d')}-{uuid4().hex[:8]}"

    @staticmethod
    def _normalize_expire_date(value):
        return normalize_expiry_datetime(value)

    @staticmethod
    def _snapshot(batch) -> dict:
        return {
            "id": _obj_value(batch, "id"),
            "product_id": _obj_value(batch, "product_id", _obj_value(_obj_value(batch, "product"), "id")),
            "batch_code": _obj_value(batch, "batch_code"),
            "quantity": _json_value(_obj_value(batch, "quantity")),
            "received_at": _json_value(_obj_value(batch, "received_at")),
            "manufacture_date": _json_value(_obj_value(batch, "manufacture_date")),
            "expire_date": _json_value(_obj_value(batch, "expire_date")),
            "status": _obj_value(batch, "status"),
            "remarks": _obj_value(batch, "remarks"),
        }

    @classmethod
    def create_batch(cls, data: dict, *, actor=None):
        try:
            product = Product.objects.get(pk=data["product_id"])
        except Product.DoesNotExist as exc:
            raise NotFoundApiError(f"Product {data['product_id']} not found") from exc
        except DatabaseError as exc:
            _raise_conflict("Unable to load product", exc)

        expire_date = data.get("expire_date")
        if expire_date is None:
            expire_date = build_expiry_datetime(data["manufacture_date"], product.shelf_life_days)
        else:
            expire_date = cls._normalize_expire_date(expire_date)

        payload = {
            "product": product,
            "batch_code": data.get("batch_code") or cls._generate_batch_code(),
            "quantity": Decimal("0.00"),
            "manufacture_date": data["manufacture_date"],
            "expire_date": expire_date,
            "status": data.get("status", "unopened"),
            "remarks": data.get("remarks"),
        }
        try:
            with transaction.atomic():
                batch = Batch.objects.create(**payload)
                QrCredentialService.issue_for_batch(batch)
                InventoryAuditService.record_batch(batch, action=InventoryAuditLog.ACTION_CREATE, actor=actor)
        except IntegrityError as exc:
            if cls._is_stale_primary_key_sequence_error(exc):
                try:
                    with transaction.atomic():
                        cls._sync_batch_id_sequence()
                        batch = Batch.objects.create(**payload)
                        QrCredentialService.issue_for_batch(batch)
                        InventoryAuditService.record_batch(batch, action=InventoryAuditLog.ACTION_CREATE, actor=actor)
                except IntegrityError as retry_exc:
                    raise ConflictApiError("Unable to create batch") from retry_exc
                except DatabaseError as retry_exc:
                    _raise_conflict("Unable to create batch", retry_exc)
            else:
                raise ConflictApiError("Unable to create batch") from exc
        except DatabaseError as exc:
            _raise_conflict("Unable to create batch", exc)
        batch.refresh_from_db(fields=["received_at"])
        invalidate_cache_groups(CACHE_GROUP_INVENTORY_READ)
        return batch

    @staticmethod
    def get_batch(batch_id: int):
        try:
            return Batch.objects.select_related("product").get(pk=batch_id)
        except Batch.DoesNotExist as exc:
            raise NotFoundApiError(f"Batch {batch_id} not found") from exc
        except DatabaseError as exc:
            _raise_conflict("Unable to load batch", exc)

    @classmethod
    def update_batch(cls, batch_id: int, data: dict, *, actor=None, action: str = InventoryAuditLog.ACTION_UPDATE):
        batch = cls.get_batch(batch_id)
        update_data = dict(data)
        if "expire_date" in update_data and update_data["expire_date"] is not None:
            update_data["expire_date"] = cls._normalize_expire_date(update_data["expire_date"])

        for field, value in update_data.items():
            setattr(batch, field, value)

        try:
            with transaction.atomic():
                batch.save(update_fields=list(update_data.keys()))
                InventoryAuditService.record_batch(batch, action=action, actor=actor)
        except IntegrityError as exc:
            raise ConflictApiError("Unable to update batch") from exc
        except DatabaseError as exc:
            _raise_conflict("Unable to update batch", exc)
        invalidate_cache_groups(CACHE_GROUP_INVENTORY_READ)
        return batch

    @classmethod
    def update_batch_status(cls, batch_id: int, status: str, *, actor=None):
        return cls.update_batch(
            batch_id,
            {"status": status},
            actor=actor,
            action=InventoryAuditLog.ACTION_STATUS_UPDATE,
        )

    @classmethod
    def delete_batch(cls, batch_id: int, *, actor=None):
        batch = cls.get_batch(batch_id)
        deleted_id = batch.id
        try:
            with transaction.atomic():
                InventoryAuditService.record_batch(batch, action=InventoryAuditLog.ACTION_DELETE, actor=actor)
                batch.delete()
        except IntegrityError as exc:
            _raise_conflict("Unable to delete batch", exc)
        except DatabaseError as exc:
            _raise_conflict("Unable to delete batch", exc)
        invalidate_cache_groups(CACHE_GROUP_INVENTORY_READ)
        return {"id": deleted_id}

    @staticmethod
    def _is_stale_primary_key_sequence_error(exc: IntegrityError) -> bool:
        message = str(exc)
        return 'duplicate key value violates unique constraint "batches_pkey"' in message

    @staticmethod
    def _sync_batch_id_sequence() -> None:
        with connection.cursor() as cursor:
            cursor.execute(
                """
                SELECT setval(
                    pg_get_serial_sequence('public.batches', 'id'),
                    COALESCE((SELECT MAX(id) FROM public.batches), 0),
                    true
                )
                """
            )

    @staticmethod
    def list_batches(*, product_id: int | None, status: str | None, expired_only: bool, page: int, size: int):
        try:
            queryset = Batch.objects.select_related("product").all().order_by("-received_at", "-id")
            if product_id:
                queryset = queryset.filter(product_id=product_id)
            if status:
                queryset = queryset.filter(status=status)
            if expired_only:
                queryset = queryset.filter(expire_date__lt=timezone.now())

            total = queryset.count()
            offset = (page - 1) * size
            return list(queryset[offset : offset + size]), total
        except DatabaseError as exc:
            _raise_conflict("Unable to list batches", exc)

    @staticmethod
    def list_expiry_alerts(
        *,
        product_id: int | None,
        status: str | None,
        category: str | None,
        location: str | None,
        expiry_status: str | None,
        days_lte: int,
        include_expired: bool,
        page: int,
        size: int,
    ):
        try:
            now = timezone.now()
            today = timezone.localdate()
            latest_expire_date = build_expiry_datetime(today + timedelta(days=days_lte), 1)
            queryset = (
                Batch.objects.select_related("product")
                .only(
                    "id",
                    "batch_code",
                    "quantity",
                    "received_at",
                    "manufacture_date",
                    "expire_date",
                    "status",
                    "remarks",
                    "product__id",
                    "product__barcode",
                    "product__product_name",
                    "product__unit",
                    "product__manufacturer",
                    "product__category",
                    "product__location",
                    "product__shelf_life_days",
                )
                .exclude(expire_date__isnull=True)
            )

            if product_id:
                queryset = queryset.filter(product_id=product_id)
            if status:
                queryset = queryset.filter(status=status)
            if category:
                queryset = queryset.filter(product__category=category)
            if location:
                queryset = queryset.filter(product__location=location)

            if include_expired:
                queryset = queryset.filter(expire_date__lte=latest_expire_date)
            else:
                queryset = queryset.filter(expire_date__gte=now, expire_date__lte=latest_expire_date)

            batches = list(queryset)
            allowed_statuses = (expiry_status,) if expiry_status else ALERT_EXPIRY_STATUSES
            filtered_batches = []
            for batch in batches:
                status_value = calc_expiry_status(
                    batch.manufacture_date,
                    batch.product.shelf_life_days,
                    now,
                    expire_date=batch.expire_date,
                )
                if status_value not in allowed_statuses:
                    continue
                days_until_expiry = calc_days_until_expiry(batch.expire_date, now)
                expiry_progress = calc_expiry_progress(batch.manufacture_date, batch.product.shelf_life_days, now) or 0
                filtered_batches.append((batch, days_until_expiry, expiry_progress))

            filtered_batches.sort(
                key=lambda item: (
                    item[1] is None,
                    item[1] or 0,
                    -item[2],
                    -item[0].id,
                )
            )

            total = len(filtered_batches)
            offset = (page - 1) * size
            return [item[0] for item in filtered_batches[offset : offset + size]], total
        except DatabaseError as exc:
            _raise_conflict("Unable to list expiry alerts", exc)


class QrCredentialService:
    @staticmethod
    def generate_token() -> str:
        return secrets.token_urlsafe(24)

    @staticmethod
    def hash_token(token: str) -> str:
        return hashlib.sha256(f"{token}{settings.QR_TOKEN_PEPPER}".encode("utf-8")).hexdigest()

    @staticmethod
    def format_qr_code(batch_code: str, token: str) -> str:
        return f"{QR_CODE_PREFIX}|{batch_code}|{token}"

    @classmethod
    def issue_for_batch(cls, batch: Batch, *, created_by: str | None = None):
        token = cls.generate_token()
        credential = BatchQrCredential.objects.create(
            batch=batch,
            batch_code=batch.batch_code,
            token_hash=cls.hash_token(token),
            created_by=created_by,
        )
        return credential, cls.format_qr_code(batch.batch_code, token)

    @classmethod
    def build_label_payload(cls, batch_id: int, *, created_by: str | None = None) -> dict:
        try:
            batch = Batch.objects.select_related("product").get(pk=batch_id)
            _credential, qr_code = cls.issue_for_batch(batch, created_by=created_by)
        except Batch.DoesNotExist as exc:
            raise NotFoundApiError(f"Batch {batch_id} not found") from exc
        except DatabaseError as exc:
            _raise_conflict("Unable to build batch label payload", exc)

        return {
            "batchCode": batch.batch_code,
            "productName": batch.product.product_name,
            "barcode": batch.product.barcode,
            "quantity": _format_decimal(batch.quantity),
            "location": batch.product.location,
            "expireDate": _format_local_date(batch.expire_date),
            "qrCode": qr_code,
        }

    @classmethod
    def backfill_missing_credentials(cls, *, created_by: str | None = "backfill") -> int:
        try:
            active_batch_ids = BatchQrCredential.objects.filter(revoked_at__isnull=True).values_list(
                "batch_id",
                flat=True,
            )
            batches = Batch.objects.exclude(id__in=active_batch_ids)
            count = 0
            with transaction.atomic():
                for batch in batches:
                    cls.issue_for_batch(batch, created_by=created_by)
                    count += 1
            return count
        except DatabaseError as exc:
            _raise_conflict("Unable to backfill batch QR credentials", exc)


class QrScanService:
    pending_message = "pending"
    default_source = "web_camera"
    max_list_items = 1000

    @classmethod
    def scan_qr(cls, data: dict, context: dict | None = None) -> dict:
        context = context or {}
        data = {**data, "source": data.get("source") or cls.default_source}
        try:
            duplicate = cls._find_duplicate(data)
            if duplicate is not None:
                return cls._result_from_audit(duplicate, client_scan_id=data.get("client_scan_id"))

            with transaction.atomic():
                audit = cls._create_audit(data, context)
                result = cls._resolve_scan_result(data["qr"])
                cls._apply_audit_result(audit, result)
        except DatabaseError as exc:
            _raise_conflict("Unable to record QR scan", exc)
        return cls._public_result(result, audit.id, client_scan_id=data.get("client_scan_id"))

    @classmethod
    def scan_bulk(cls, items: list[dict], context: dict | None = None) -> dict:
        return {"items": [cls.scan_qr(item, context) for item in items]}

    @classmethod
    def list_scans(cls, *, days: int = 1) -> dict:
        start_date = timezone.localdate() - timedelta(days=max(days, 1) - 1)
        start_at = timezone.make_aware(
            datetime.combine(start_date, time.min),
            timezone.get_current_timezone(),
        )
        audits = (
            QrScanAuditLog.objects.select_related("batch__product", "scanner_user_account")
            .filter(scanned_at_server__gte=start_at)
            .order_by("-scanned_at_server", "-id")[: cls.max_list_items]
        )
        return {"items": [cls._audit_list_item(audit) for audit in audits]}

    @staticmethod
    def _generate_audit_id() -> str:
        return f"scan_{uuid4().hex}"

    @classmethod
    def _find_duplicate(cls, data: dict):
        client_scan_id = data.get("client_scan_id")
        if not client_scan_id:
            return None
        return (
            QrScanAuditLog.objects.filter(
                source=data["source"],
                device_id=data.get("device_id"),
                client_scan_id=client_scan_id,
            )
            .order_by("scanned_at_server", "id")
            .first()
        )

    @classmethod
    def _create_audit(cls, data: dict, context: dict):
        return QrScanAuditLog.objects.create(
            id=cls._generate_audit_id(),
            raw_qr=data["qr"],
            source=data["source"],
            device_id=data.get("device_id"),
            client_scan_id=data.get("client_scan_id"),
            scanner_user=context.get("scanner_user"),
            scanner_user_account_id=context.get("scanner_user_id"),
            scanned_at_client=data.get("scanned_at"),
            scanned_at_server=timezone.now(),
            ip_address=context.get("ip_address"),
            user_agent=context.get("user_agent"),
            result_status=QR_SCAN_STATUS_INVALID,
            result_message=cls.pending_message,
        )

    @classmethod
    def _resolve_scan_result(cls, qr: str) -> dict:
        parsed = cls._parse_qr(qr)
        if parsed is None:
            return cls._result(
                status=QR_SCAN_STATUS_INVALID,
                message="二维码格式错误",
                failure_reason="invalid_format",
            )

        batch_code, token = parsed
        token_hash = QrCredentialService.hash_token(token)
        credential = (
            BatchQrCredential.objects.filter(batch_code=batch_code, token_hash=token_hash)
            .order_by("-issued_at", "-id")
            .first()
        )
        if credential is None:
            return cls._result(
                status=QR_SCAN_STATUS_INVALID,
                message="二维码无效",
                batch_code=batch_code,
                failure_reason="token_mismatch",
            )

        if credential.revoked_at is not None:
            return cls._result(
                status=QR_SCAN_STATUS_REVOKED,
                message="二维码已吊销",
                batch_code=credential.batch_code,
                batch_id=credential.batch_id,
                failure_reason="credential_revoked",
            )

        try:
            batch = Batch.objects.select_related("product").get(pk=credential.batch_id)
        except Batch.DoesNotExist:
            return cls._result(
                status=QR_SCAN_STATUS_NOT_FOUND,
                message="批次不存在",
                batch_code=credential.batch_code,
                batch_id=credential.batch_id,
                failure_reason="batch_not_found",
            )

        return cls._result_for_batch(batch)

    @staticmethod
    def _parse_qr(qr: str) -> tuple[str, str] | None:
        parts = qr.split("|")
        if len(parts) != 3:
            return None
        prefix, batch_code, token = parts
        if prefix != QR_CODE_PREFIX or not batch_code or not token:
            return None
        return batch_code, token

    @classmethod
    def _result_for_batch(cls, batch: Batch) -> dict:
        remaining_days = calc_days_until_expiry(batch.expire_date)
        if remaining_days is None:
            status = QR_SCAN_STATUS_VALID
            message = "该批次未设置到期日"
        elif remaining_days < 0:
            status = QR_SCAN_STATUS_EXPIRED
            message = "该批次已过期"
        elif remaining_days <= settings.QR_SCAN_NEAR_EXPIRY_DAYS:
            status = QR_SCAN_STATUS_NEAR_EXPIRY
            message = "该批次临近到期"
        else:
            status = QR_SCAN_STATUS_VALID
            message = "该批次仍在效期内"

        return cls._result(
            status=status,
            message=message,
            batch_code=batch.batch_code,
            batch_id=batch.id,
            product_name=batch.product.product_name,
            expire_date=batch.expire_date,
            remaining_days=remaining_days,
        )

    @staticmethod
    def _result(
        *,
        status: str,
        message: str,
        batch_code: str | None = None,
        batch_id: int | None = None,
        product_name: str | None = None,
        expire_date=None,
        remaining_days: int | None = None,
        failure_reason: str | None = None,
    ) -> dict:
        return {
            "batchCode": batch_code,
            "productName": product_name,
            "status": status,
            "message": message,
            "expireDate": _format_date(expire_date),
            "remainingDays": remaining_days,
            "_batch_id": batch_id,
            "_failure_reason": failure_reason,
        }

    @staticmethod
    def _public_result(result: dict, audit_id: str, *, client_scan_id: str | None = None) -> dict:
        payload = {
            "auditId": audit_id,
            "batchCode": result.get("batchCode"),
            "productName": result.get("productName"),
            "status": result["status"],
            "message": result["message"],
            "expireDate": result.get("expireDate"),
            "remainingDays": result.get("remainingDays"),
        }
        if client_scan_id:
            payload["clientScanId"] = client_scan_id
        return payload

    @classmethod
    def _apply_audit_result(cls, audit, result: dict) -> None:
        audit.batch_id = result.get("_batch_id")
        audit.batch_code = result.get("batchCode")
        audit.result_status = result["status"]
        audit.result_message = result["message"]
        audit.failure_reason = result.get("_failure_reason")
        audit.save(
            update_fields=[
                "batch_id",
                "batch_code",
                "result_status",
                "result_message",
                "failure_reason",
            ]
        )

    @classmethod
    def _result_from_audit(cls, audit, *, client_scan_id: str | None = None) -> dict:
        product_name = None
        expire_date = None
        remaining_days = None
        if audit.batch_id is not None:
            try:
                batch = audit.batch
            except Batch.DoesNotExist:
                batch = None
            if batch is not None:
                product_name = batch.product.product_name
                expire_date = _format_date(batch.expire_date)
                remaining_days = calc_days_until_expiry(batch.expire_date)

        result = {
            "batchCode": audit.batch_code,
            "productName": product_name,
            "status": audit.result_status,
            "message": audit.result_message,
            "expireDate": expire_date,
            "remainingDays": remaining_days,
        }
        return cls._public_result(result, audit.id, client_scan_id=client_scan_id)

    @classmethod
    def _audit_list_item(cls, audit) -> dict:
        payload = cls._result_from_audit(audit, client_scan_id=audit.client_scan_id)
        payload["scannedAt"] = audit.scanned_at_server
        payload["scannerUser"] = cls._audit_scanner_name(audit)
        return payload

    @staticmethod
    def _audit_scanner_name(audit) -> str | None:
        if getattr(audit, "scanner_user_account", None) is not None:
            return str(audit.scanner_user_account)
        return audit.scanner_user


def _actor_snapshot(actor) -> dict | None:
    if actor is None:
        return None
    return {
        "id": getattr(actor, "id", None),
        "username": getattr(actor, "username", None),
        "display": str(actor),
    }


class StocktakeService:
    active_item_statuses = (StocktakeItem.STATUS_COUNTED, StocktakeItem.STATUS_APPROVED)

    @classmethod
    def list_tasks(cls, *, task_type: str | None, status: str | None, page: int, size: int):
        try:
            queryset = StocktakeTask.objects.select_related("created_by", "submitted_by", "approved_by").order_by(
                "-created_at",
                "-id",
            )
            if task_type:
                queryset = queryset.filter(task_type=task_type)
            if status:
                queryset = queryset.filter(status=status)
            total = queryset.count()
            offset = (page - 1) * size
            return list(queryset[offset : offset + size]), total
        except DatabaseError as exc:
            _raise_conflict("Unable to list stocktake tasks", exc)

    @classmethod
    def get_task(cls, task_id: int):
        try:
            return StocktakeTask.objects.select_related("created_by", "submitted_by", "approved_by").get(pk=task_id)
        except StocktakeTask.DoesNotExist as exc:
            raise NotFoundApiError(f"Stocktake task {task_id} not found") from exc
        except DatabaseError as exc:
            _raise_conflict("Unable to load stocktake task", exc)

    @classmethod
    def list_items(cls, task_id: int):
        return list(
            StocktakeItem.objects.select_related("batch__product", "product", "counted_by")
            .filter(task_id=task_id)
            .order_by("batch__product__product_name", "batch__batch_code", "id")
        )

    @classmethod
    def task_stats(cls, task) -> dict:
        items = list(getattr(task, "_prefetched_items", None) or StocktakeItem.objects.filter(task=task))
        total_items = len(items)
        counted_items = sum(1 for item in items if item.status in cls.active_item_statuses)
        pending_items = sum(1 for item in items if item.status == StocktakeItem.STATUS_PENDING)
        recount_items = sum(1 for item in items if item.status == StocktakeItem.STATUS_RECOUNT_REQUIRED)
        difference_items = sum(1 for item in items if _decimal_or_zero(item.difference_quantity) != Decimal("0"))
        total_difference_quantity = sum(
            (_decimal_or_zero(item.difference_quantity) for item in items),
            Decimal("0"),
        )
        return {
            "total_items": total_items,
            "counted_items": counted_items,
            "pending_items": pending_items,
            "recount_items": recount_items,
            "difference_items": difference_items,
            "total_difference_quantity": total_difference_quantity,
            "progress": round(counted_items / total_items, 4) if total_items else 0,
        }

    @classmethod
    def create_task(cls, data: dict, *, actor=None):
        scope_config = data.get("scope_config") or {}
        try:
            with transaction.atomic():
                task = StocktakeTask.objects.create(
                    task_type=data["task_type"],
                    scope_config=scope_config,
                    status=StocktakeTask.STATUS_DRAFT,
                    created_by=actor,
                )
                batches = cls._default_scope_batches(task.task_type, scope_config)
                added_ids = cls._add_batches(task, batches)
                cls._record_audit(
                    task,
                    "create",
                    actor=actor,
                    snapshot={
                        "task_type": task.task_type,
                        "scope_config": scope_config,
                        "default_item_count": len(added_ids),
                    },
                )
                cls._record_audit(
                    task,
                    "generate_default_scope",
                    actor=actor,
                    snapshot={"batch_ids": added_ids},
                )
        except DatabaseError as exc:
            _raise_conflict("Unable to create stocktake task", exc)
        return task

    @classmethod
    def update_scope(cls, task_id: int, data: dict, *, actor=None):
        try:
            with transaction.atomic():
                task = StocktakeTask.objects.select_for_update().get(pk=task_id)
                if task.status not in {StocktakeTask.STATUS_DRAFT, StocktakeTask.STATUS_ACTIVE}:
                    raise ConflictApiError("Stocktake scope cannot be changed in the current status")

                removed_ids: list[int] = []
                if data.get("remove_batch_ids"):
                    if task.status != StocktakeTask.STATUS_DRAFT:
                        raise ConflictApiError("Active stocktake items cannot be removed")
                    removed_ids = list(data["remove_batch_ids"])
                    StocktakeItem.objects.filter(task=task, batch_id__in=removed_ids).delete()

                batches = cls._scope_batches_from_adjustment(data)
                added_ids = cls._add_batches(task, batches)
                if data.get("scope_config"):
                    task.scope_config = {**(task.scope_config or {}), **data["scope_config"]}
                    task.save(update_fields=["scope_config"])

                cls._record_audit(
                    task,
                    "update_scope",
                    actor=actor,
                    snapshot={
                        "added_batch_ids": added_ids,
                        "removed_batch_ids": removed_ids,
                        "status": task.status,
                    },
                )
        except StocktakeTask.DoesNotExist as exc:
            raise NotFoundApiError(f"Stocktake task {task_id} not found") from exc
        except IntegrityError as exc:
            raise ConflictApiError("Unable to update stocktake scope") from exc
        except DatabaseError as exc:
            _raise_conflict("Unable to update stocktake scope", exc)
        return task

    @classmethod
    def start_task(cls, task_id: int, *, actor=None):
        task = cls.get_task(task_id)
        if task.status != StocktakeTask.STATUS_DRAFT:
            raise ConflictApiError("Only draft stocktakes can be started")
        if not StocktakeItem.objects.filter(task=task).exists():
            raise ConflictApiError("Stocktake task has no items")
        task.status = StocktakeTask.STATUS_ACTIVE
        task.started_at = timezone.now()
        try:
            with transaction.atomic():
                task.save(update_fields=["status", "started_at"])
                cls._record_audit(task, "start", actor=actor, snapshot={"status": task.status})
        except DatabaseError as exc:
            _raise_conflict("Unable to start stocktake task", exc)
        return task

    @classmethod
    def count_item(cls, task_id: int, item_id: int, data: dict, *, actor=None):
        try:
            with transaction.atomic():
                task = StocktakeTask.objects.select_for_update().get(pk=task_id)
                if task.status != StocktakeTask.STATUS_ACTIVE:
                    raise ConflictApiError("Stocktake quantities can only be entered while active")
                item = StocktakeItem.objects.select_for_update().select_related("batch__product").get(
                    pk=item_id,
                    task=task,
                )
                counted_quantity = data["counted_quantity"]
                item.counted_quantity = counted_quantity
                item.difference_quantity = counted_quantity - item.snapshot_quantity
                item.status = data.get("status") or StocktakeItem.STATUS_COUNTED
                item.remarks = data.get("remarks")
                item.counted_by = actor
                item.counted_at = timezone.now()
                item.save(
                    update_fields=[
                        "counted_quantity",
                        "difference_quantity",
                        "status",
                        "remarks",
                        "counted_by",
                        "counted_at",
                    ]
                )
                cls._record_audit(
                    task,
                    "count_item",
                    actor=actor,
                    snapshot=cls._item_snapshot(item),
                )
        except StocktakeTask.DoesNotExist as exc:
            raise NotFoundApiError(f"Stocktake task {task_id} not found") from exc
        except StocktakeItem.DoesNotExist as exc:
            raise NotFoundApiError(f"Stocktake item {item_id} not found") from exc
        except DatabaseError as exc:
            _raise_conflict("Unable to count stocktake item", exc)
        return item

    @classmethod
    def submit_task(cls, task_id: int, *, actor=None):
        try:
            with transaction.atomic():
                task = StocktakeTask.objects.select_for_update().get(pk=task_id)
                if task.status != StocktakeTask.STATUS_ACTIVE:
                    raise ConflictApiError("Only active stocktakes can be submitted")
                blocking_count = StocktakeItem.objects.filter(
                    task=task,
                    status__in=[StocktakeItem.STATUS_PENDING, StocktakeItem.STATUS_RECOUNT_REQUIRED],
                ).count()
                if blocking_count:
                    raise ConflictApiError("Stocktake has pending or recount-required items")
                task.status = StocktakeTask.STATUS_SUBMITTED
                task.submitted_by = actor
                task.submitted_at = timezone.now()
                task.save(update_fields=["status", "submitted_by", "submitted_at"])
                cls._record_audit(task, "submit", actor=actor, snapshot=cls.task_stats(task))
        except StocktakeTask.DoesNotExist as exc:
            raise NotFoundApiError(f"Stocktake task {task_id} not found") from exc
        except DatabaseError as exc:
            _raise_conflict("Unable to submit stocktake task", exc)
        return task

    @classmethod
    def approve_task(cls, task_id: int, data: dict, *, actor=None):
        try:
            with transaction.atomic():
                task = StocktakeTask.objects.select_for_update().get(pk=task_id)
                if task.status != StocktakeTask.STATUS_SUBMITTED:
                    raise ConflictApiError("Only submitted stocktakes can be approved")
                items = list(
                    StocktakeItem.objects.select_for_update()
                    .select_related("batch__product", "product")
                    .filter(task=task)
                    .order_by("id")
                )
                if any(item.counted_quantity is None for item in items):
                    raise ConflictApiError("Stocktake has uncounted items")

                operations = []
                for item in items:
                    difference = _decimal_or_zero(item.difference_quantity)
                    if difference == Decimal("0"):
                        item.status = StocktakeItem.STATUS_APPROVED
                        item.save(update_fields=["status"])
                        continue

                    batch = Batch.objects.select_for_update().get(pk=item.batch_id)
                    if batch.quantity is None:
                        raise ConflictApiError("Batch quantity is unavailable")
                    quantity_after = batch.quantity + difference
                    if quantity_after < Decimal("0"):
                        raise ConflictApiError("Stocktake adjustment would make inventory negative")

                    update_fields = BatchOperationService._apply_batch_quantity_state(batch, quantity_after)
                    batch.quantity = quantity_after
                    batch.save(update_fields=update_fields)
                    operation = BatchOperation.objects.create(
                        batch=batch,
                        operation_type=STOCKTAKE_ADJUST_OPERATION_TYPE,
                        quantity=difference,
                        quantity_after=quantity_after,
                        remarks=cls._adjustment_remarks(task, item, data.get("remarks")),
                        operator=actor,
                    )
                    operations.append(operation)
                    item.status = StocktakeItem.STATUS_APPROVED
                    item.save(update_fields=["status"])
                    cls._record_audit(
                        task,
                        "create_inventory_adjustment",
                        actor=actor,
                        snapshot={
                            "item": cls._item_snapshot(item),
                            "operation_id": operation.id,
                            "quantity_after": _json_value(quantity_after),
                        },
                    )

                task.status = StocktakeTask.STATUS_APPROVED
                task.approved_by = actor
                task.approved_at = timezone.now()
                task.save(update_fields=["status", "approved_by", "approved_at"])
                cls._record_audit(
                    task,
                    "approve",
                    actor=actor,
                    snapshot={
                        "remarks": data.get("remarks"),
                        "adjustment_operation_ids": [operation.id for operation in operations],
                    },
                )
        except StocktakeTask.DoesNotExist as exc:
            raise NotFoundApiError(f"Stocktake task {task_id} not found") from exc
        except Batch.DoesNotExist as exc:
            raise NotFoundApiError("Stocktake batch not found") from exc
        except DatabaseError as exc:
            _raise_conflict("Unable to approve stocktake task", exc)
        invalidate_cache_groups(CACHE_GROUP_INVENTORY_READ)
        return task

    @classmethod
    def cancel_task(cls, task_id: int, data: dict, *, actor=None):
        try:
            with transaction.atomic():
                task = StocktakeTask.objects.select_for_update().get(pk=task_id)
                if task.status not in {
                    StocktakeTask.STATUS_DRAFT,
                    StocktakeTask.STATUS_ACTIVE,
                    StocktakeTask.STATUS_SUBMITTED,
                }:
                    raise ConflictApiError("Stocktake cannot be cancelled in the current status")
                task.status = StocktakeTask.STATUS_CANCELLED
                task.save(update_fields=["status"])
                cls._record_audit(task, "cancel", actor=actor, snapshot={"remarks": data.get("remarks")})
        except StocktakeTask.DoesNotExist as exc:
            raise NotFoundApiError(f"Stocktake task {task_id} not found") from exc
        except DatabaseError as exc:
            _raise_conflict("Unable to cancel stocktake task", exc)
        return task

    @staticmethod
    def list_audit_logs(task_id: int):
        try:
            StocktakeTask.objects.only("id").get(pk=task_id)
            return list(
                StocktakeAuditLog.objects.select_related("actor")
                .filter(task_id=task_id)
                .order_by("-created_at", "-id")
            )
        except StocktakeTask.DoesNotExist as exc:
            raise NotFoundApiError(f"Stocktake task {task_id} not found") from exc
        except DatabaseError as exc:
            _raise_conflict("Unable to list stocktake audit logs", exc)

    @classmethod
    def _record_audit(cls, task, action: str, *, actor=None, snapshot: dict | None = None):
        StocktakeAuditLog.objects.create(
            task=task,
            action=action,
            actor=actor,
            snapshot=_json_value({**(snapshot or {}), "actor": _actor_snapshot(actor)}),
        )

    @classmethod
    def _add_batches(cls, task, batches: list[Batch]) -> list[int]:
        added_ids: list[int] = []
        existing_ids = set(StocktakeItem.objects.filter(task=task).values_list("batch_id", flat=True))
        for batch in batches:
            if batch.id in existing_ids:
                continue
            StocktakeItem.objects.create(
                task=task,
                batch=batch,
                product=batch.product,
                snapshot_quantity=_decimal_or_zero(batch.quantity),
                status=StocktakeItem.STATUS_PENDING,
            )
            added_ids.append(batch.id)
            existing_ids.add(batch.id)
        return added_ids

    @classmethod
    def _default_scope_batches(cls, task_type: str, scope_config: dict) -> list[Batch]:
        if task_type == StocktakeTask.TYPE_DAILY:
            return cls._daily_scope_batches(scope_config)
        if task_type == StocktakeTask.TYPE_WEEKLY:
            return cls._weekly_scope_batches(scope_config)
        if task_type == StocktakeTask.TYPE_MONTHLY:
            return cls._monthly_scope_batches(scope_config)
        raise ValidationApiError("Invalid stocktake task type")

    @classmethod
    def _base_batch_queryset(cls):
        return Batch.objects.select_related("product").filter(quantity__gt=Decimal("0")).exclude(status="used_up")

    @classmethod
    def _daily_scope_batches(cls, scope_config: dict) -> list[Batch]:
        now = timezone.now()
        today_start = _start_of_day(timezone.localdate())
        touched_ids = BatchOperation.objects.filter(created_at__gte=today_start).values_list("batch_id", flat=True)
        query = Q(id__in=touched_ids)
        product_ids = cls._int_list(scope_config.get("product_ids"))
        categories = cls._string_list(scope_config.get("categories"))
        if product_ids:
            query |= Q(product_id__in=product_ids)
        if categories:
            query |= Q(product__category__in=categories)
        batches = list(cls._base_batch_queryset().filter(query).order_by("product__product_name", "batch_code"))
        near_expiry_batches = [batch for batch in cls._base_batch_queryset() if _is_near_expiry_batch(batch, now)]
        return cls._dedupe_batches([*near_expiry_batches, *batches])

    @classmethod
    def _weekly_scope_batches(cls, scope_config: dict) -> list[Batch]:
        recent_start = timezone.now() - timedelta(days=7)
        recent_ids = BatchOperation.objects.filter(created_at__gte=recent_start).values_list("batch_id", flat=True)
        queryset = cls._base_batch_queryset()
        categories = cls._string_list(scope_config.get("categories"))
        locations = cls._string_list(scope_config.get("locations"))
        if categories:
            queryset = queryset.filter(product__category__in=categories)
        if locations:
            queryset = queryset.filter(product__location__in=locations)
        scoped = list(queryset.order_by("product__product_name", "batch_code"))
        recent = list(cls._base_batch_queryset().filter(id__in=recent_ids))
        return cls._dedupe_batches([*scoped, *recent])

    @classmethod
    def _monthly_scope_batches(cls, scope_config: dict) -> list[Batch]:
        queryset = Batch.objects.select_related("product").filter(quantity__gt=Decimal("0"))
        if not scope_config.get("include_used_up"):
            queryset = queryset.exclude(status="used_up")
        product_ids = cls._int_list(scope_config.get("product_ids"))
        categories = cls._string_list(scope_config.get("categories"))
        locations = cls._string_list(scope_config.get("locations"))
        if product_ids:
            queryset = queryset.filter(product_id__in=product_ids)
        if categories:
            queryset = queryset.filter(product__category__in=categories)
        if locations:
            queryset = queryset.filter(product__location__in=locations)
        return list(queryset.order_by("product__product_name", "batch_code"))

    @classmethod
    def _scope_batches_from_adjustment(cls, data: dict) -> list[Batch]:
        batches: list[Batch] = []
        batch_ids = cls._int_list(data.get("add_batch_ids"))
        product_ids = cls._int_list(data.get("add_product_ids"))
        categories = cls._string_list(data.get("add_categories"))
        locations = cls._string_list(data.get("add_locations"))
        expiry_statuses = cls._string_list(data.get("add_expiry_statuses"))
        recent_days = data.get("add_recent_changes_days")
        if batch_ids:
            batches.extend(cls._base_batch_queryset().filter(id__in=batch_ids))
        if product_ids:
            batches.extend(cls._base_batch_queryset().filter(product_id__in=product_ids))
        if categories:
            batches.extend(cls._base_batch_queryset().filter(product__category__in=categories))
        if locations:
            batches.extend(cls._base_batch_queryset().filter(product__location__in=locations))
        if expiry_statuses:
            now = timezone.now()
            batches.extend(
                batch
                for batch in cls._base_batch_queryset()
                if _batch_expiry_status(batch, now) in set(expiry_statuses)
            )
        if recent_days:
            start_at = timezone.now() - timedelta(days=int(recent_days))
            recent_ids = BatchOperation.objects.filter(created_at__gte=start_at).values_list("batch_id", flat=True)
            batches.extend(cls._base_batch_queryset().filter(id__in=recent_ids))
        return cls._dedupe_batches(batches)

    @staticmethod
    def _dedupe_batches(batches) -> list[Batch]:
        output: list[Batch] = []
        seen: set[int] = set()
        for batch in batches:
            if batch.id in seen:
                continue
            seen.add(batch.id)
            output.append(batch)
        return output

    @staticmethod
    def _int_list(value) -> list[int]:
        if not value:
            return []
        return [int(item) for item in value]

    @staticmethod
    def _string_list(value) -> list[str]:
        if not value:
            return []
        return [str(item).strip() for item in value if str(item).strip()]

    @staticmethod
    def _item_snapshot(item) -> dict:
        return {
            "id": item.id,
            "task_id": item.task_id,
            "batch_id": item.batch_id,
            "product_id": item.product_id,
            "snapshot_quantity": _json_value(item.snapshot_quantity),
            "counted_quantity": _json_value(item.counted_quantity),
            "difference_quantity": _json_value(item.difference_quantity),
            "status": item.status,
            "remarks": item.remarks,
        }

    @staticmethod
    def _adjustment_remarks(task, item, approval_remarks: str | None) -> str:
        parts = [f"stocktake:{task.id}", f"item:{item.id}"]
        if approval_remarks:
            parts.append(approval_remarks)
        return " | ".join(parts)[:255]


class BatchOperationService:
    decrease_operation_types = {"loss", "deduct"}
    reverse_operation_types = {
        "add": "deduct",
        "loss": "add",
        "deduct": "add",
    }

    @classmethod
    def create_operation(cls, batch_id: int, data: dict, *, actor=None):
        try:
            with transaction.atomic():
                batch = Batch.objects.select_for_update().get(pk=batch_id)
                if batch.quantity is None:
                    raise ConflictApiError("Batch quantity is unavailable")

                quantity = data["quantity"]
                quantity_after = cls._apply_quantity(
                    current_quantity=batch.quantity,
                    operation_type=data["operation_type"],
                    quantity=quantity,
                )
                if quantity_after < Decimal("0"):
                    raise ConflictApiError("Insufficient batch quantity")

                update_fields = cls._apply_batch_quantity_state(batch, quantity_after)
                batch.quantity = quantity_after
                batch.save(update_fields=update_fields)
                operation = BatchOperation.objects.create(
                    batch=batch,
                    reversed_operation=data.get("reversed_operation"),
                    operation_type=data["operation_type"],
                    quantity=quantity,
                    quantity_after=quantity_after,
                    remarks=data.get("remarks"),
                    operator=actor,
                )
        except Batch.DoesNotExist as exc:
            raise NotFoundApiError(f"Batch {batch_id} not found") from exc
        except IntegrityError as exc:
            raise ConflictApiError("Unable to create batch operation") from exc
        except DatabaseError as exc:
            _raise_conflict("Unable to create batch operation", exc)

        operation.refresh_from_db(fields=["created_at"])
        invalidate_cache_groups(CACHE_GROUP_INVENTORY_READ)
        return operation, batch

    @classmethod
    def revert_operation(cls, *, batch_id: int, operation_id: int, data: dict, actor=None):
        try:
            with transaction.atomic():
                original_operation = BatchOperation.objects.select_for_update().get(pk=operation_id, batch_id=batch_id)
                if original_operation.reversed_operation_id is not None:
                    raise ConflictApiError("Reversal operation cannot be reverted")
                if original_operation.operation_type == STOCKTAKE_ADJUST_OPERATION_TYPE:
                    raise ConflictApiError("Stocktake adjustment operations cannot be reverted")
                if BatchOperation.objects.filter(reversed_operation_id=original_operation.id).exists():
                    raise ConflictApiError("Batch operation has already been reverted")

                batch = Batch.objects.select_for_update().get(pk=batch_id)
                if batch.quantity is None:
                    raise ConflictApiError("Batch quantity is unavailable")

                operation_type = cls.reverse_operation_types[original_operation.operation_type]
                quantity_after = cls._apply_quantity(
                    current_quantity=batch.quantity,
                    operation_type=operation_type,
                    quantity=original_operation.quantity,
                )
                if quantity_after < Decimal("0"):
                    raise ConflictApiError("Insufficient batch quantity")

                update_fields = cls._apply_batch_quantity_state(batch, quantity_after)
                batch.quantity = quantity_after
                batch.save(update_fields=update_fields)
                reversal_operation = BatchOperation.objects.create(
                    batch=batch,
                    reversed_operation=original_operation,
                    operation_type=operation_type,
                    quantity=original_operation.quantity,
                    quantity_after=quantity_after,
                    remarks=data.get("remarks"),
                    operator=actor,
                )
        except BatchOperation.DoesNotExist as exc:
            raise NotFoundApiError(f"Batch operation {operation_id} not found") from exc
        except IntegrityError as exc:
            raise ConflictApiError("Batch operation has already been reverted") from exc
        except DatabaseError as exc:
            _raise_conflict("Unable to revert batch operation", exc)

        reversal_operation.refresh_from_db(fields=["created_at"])
        invalidate_cache_groups(CACHE_GROUP_INVENTORY_READ)
        return reversal_operation, batch

    @classmethod
    def _apply_quantity(cls, *, current_quantity: Decimal, operation_type: str, quantity: Decimal) -> Decimal:
        if operation_type == "add":
            return current_quantity + quantity
        if operation_type in cls.decrease_operation_types:
            return current_quantity - quantity
        raise ConflictApiError("Unsupported batch operation")

    @staticmethod
    def _apply_batch_quantity_state(batch: Batch, quantity_after: Decimal) -> list[str]:
        update_fields = ["quantity"]
        if quantity_after == Decimal("0"):
            if batch.status != "used_up":
                batch.status = "used_up"
                update_fields.append("status")
        elif batch.status == "used_up":
            batch.status = None
            update_fields.append("status")
        return update_fields

    @staticmethod
    def list_operations(*, batch_id: int, operation_type: str | None, page: int, size: int):
        try:
            Batch.objects.only("id").get(pk=batch_id)
            reversal_queryset = BatchOperation.objects.filter(reversed_operation_id=OuterRef("pk"))
            queryset = (
                BatchOperation.objects.filter(batch_id=batch_id)
                .annotate(is_reverted=Exists(reversal_queryset))
                .order_by("-created_at", "-id")
            )
            if operation_type:
                queryset = queryset.filter(operation_type=operation_type)

            total = queryset.count()
            offset = (page - 1) * size
            return list(queryset[offset : offset + size]), total
        except Batch.DoesNotExist as exc:
            raise NotFoundApiError(f"Batch {batch_id} not found") from exc
        except DatabaseError as exc:
            _raise_conflict("Unable to list batch operations", exc)
