from __future__ import annotations

from datetime import date, datetime, time, timedelta
from typing import Optional

from django.utils import timezone


EXPIRY_STATUS_EXPIRED = "expired"
EXPIRY_STATUS_CRITICAL = "critical"
EXPIRY_STATUS_WARNING = "warning"
EXPIRY_STATUS_NORMAL = "normal"
EXPIRY_STATUS_UNKNOWN = "unknown"

ALERT_EXPIRY_STATUSES = (
    EXPIRY_STATUS_EXPIRED,
    EXPIRY_STATUS_CRITICAL,
    EXPIRY_STATUS_WARNING,
)

VALID_EXPIRY_STATUSES = (
    EXPIRY_STATUS_EXPIRED,
    EXPIRY_STATUS_CRITICAL,
    EXPIRY_STATUS_WARNING,
    EXPIRY_STATUS_NORMAL,
)

EXPIRY_CUTOFF_TIME = time(23, 59)


def _current_datetime(value: Optional[date | datetime] = None) -> datetime:
    if value is None:
        return timezone.localtime()
    if isinstance(value, datetime):
        if timezone.is_aware(value):
            return timezone.localtime(value)
        return timezone.make_aware(value, timezone.get_current_timezone())
    return timezone.make_aware(datetime.combine(value, time.min), timezone.get_current_timezone())


def _today(today: Optional[date | datetime] = None) -> date:
    return _current_datetime(today).date()


def _as_date(value) -> Optional[date]:
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


def _as_expiry_datetime(value) -> Optional[datetime]:
    if value is None:
        return None
    if isinstance(value, datetime):
        if timezone.is_aware(value):
            return timezone.localtime(value)
        return timezone.make_aware(value, timezone.get_current_timezone())
    if isinstance(value, date):
        return timezone.make_aware(datetime.combine(value, EXPIRY_CUTOFF_TIME), timezone.get_current_timezone())
    if isinstance(value, str):
        normalized_value = value.replace("Z", "+00:00")
        if "T" in normalized_value:
            parsed = datetime.fromisoformat(normalized_value)
            return _as_expiry_datetime(parsed)
        return _as_expiry_datetime(date.fromisoformat(normalized_value[:10]))
    return None


def build_expiry_datetime(manufacture_date: date, shelf_life_days: int) -> datetime:
    expire_day = manufacture_date + timedelta(days=shelf_life_days - 1)
    return timezone.make_aware(datetime.combine(expire_day, EXPIRY_CUTOFF_TIME), timezone.get_current_timezone())


def normalize_expiry_datetime(value) -> Optional[datetime]:
    return _as_expiry_datetime(value)


def calc_days_until_expiry(expire_date: Optional[date | datetime], today: Optional[date | datetime] = None) -> Optional[int]:
    expire_at = _as_expiry_datetime(expire_date)
    if expire_at is None:
        return None

    current = _current_datetime(today)
    expire_local_date = expire_at.date()
    current_local_date = current.date()
    if current > expire_at:
        return -max(1, (current_local_date - expire_local_date).days)
    return (expire_local_date - current_local_date).days


def calc_expiry_progress(
    manufacture_date: Optional[date],
    shelf_life_days: Optional[int],
    today: Optional[date | datetime] = None,
) -> Optional[float]:
    manufacture_date = _as_date(manufacture_date)
    if manufacture_date is None or shelf_life_days is None:
        return None
    if shelf_life_days <= 0:
        return 1.01

    elapsed_days = (_today(today) - manufacture_date).days
    return round(elapsed_days / shelf_life_days, 4)


def calc_expiry_status(
    manufacture_date: Optional[date],
    shelf_life_days: Optional[int],
    today: Optional[date | datetime] = None,
    *,
    expire_date: Optional[date | datetime] = None,
) -> str:
    expire_at = _as_expiry_datetime(expire_date)
    if expire_at is None and manufacture_date is not None and shelf_life_days is not None:
        manufacture = _as_date(manufacture_date)
        if manufacture is not None:
            expire_at = build_expiry_datetime(manufacture, shelf_life_days)

    if expire_at is not None and _current_datetime(today) > expire_at:
        return EXPIRY_STATUS_EXPIRED

    progress = calc_expiry_progress(manufacture_date, shelf_life_days, today)

    if progress is None:
        return EXPIRY_STATUS_UNKNOWN
    if progress > 1.0:
        return EXPIRY_STATUS_EXPIRED
    if progress > 0.9:
        return EXPIRY_STATUS_CRITICAL
    if progress > 0.75:
        return EXPIRY_STATUS_WARNING
    return EXPIRY_STATUS_NORMAL
