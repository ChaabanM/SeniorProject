from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from typing import Dict, List, Optional, Tuple

from config import Settings

REQUIRED_HEADERS = [
    "scan_id",
    "event_time_stamps",
    "date",
    "dataset_id",
    "item_id",
    "item_name",
    "location_id",
    "event_type",
    "quantity",
]

OPTIONAL_HEADERS = [
    "lot_number",
    "lot_expiry",
    "reason",
]

ALLOWED_EVENT_TYPES = {"RECEIPT", "ISSUE", "ADJUSTMENT_WASTE"}


@dataclass
class IngestRow:
    scan_id: str
    event_time_stamps: str
    date: str
    dataset_id: str
    item_id: int
    item_name: str
    location_id: str
    event_type: str
    quantity: float
    lot_number: Optional[str]
    lot_expiry: Optional[str]
    reason: Optional[str]
    sheet_row_index: int


def _normalize_header(value: str) -> str:
    return value.strip().lower()


def parse_sheet(values: List[List[str]], settings: Settings) -> Tuple[List[IngestRow], List[str]]:
    if not values:
        return [], ["Sheet is empty"]
    header = values[0]
    header_map: Dict[str, int] = {_normalize_header(h): idx for idx, h in enumerate(header)}

    missing = [h for h in REQUIRED_HEADERS if h not in header_map]
    if missing:
        return [], [f"Missing required headers: {', '.join(missing)}"]

    rows: List[IngestRow] = []
    errors: List[str] = []

    for offset, row in enumerate(values[1:], start=2):
        try:
            parsed = _parse_row(row, header_map, settings, offset)
            if parsed is not None:
                rows.append(parsed)
        except ValueError as exc:
            errors.append(f"row {offset}: {exc}")
    return rows, errors


def _get_value(row: List[str], header_map: Dict[str, int], key: str) -> str:
    idx = header_map.get(key)
    if idx is None or idx >= len(row):
        return ""
    return str(row[idx]).strip()


def _parse_row(
    row: List[str],
    header_map: Dict[str, int],
    settings: Settings,
    sheet_row_index: int,
) -> Optional[IngestRow]:
    scan_id = _get_value(row, header_map, "scan_id")
    event_time_stamps = _get_value(row, header_map, "event_time_stamps")
    date_value = _get_value(row, header_map, "date")
    dataset_id = _get_value(row, header_map, "dataset_id")
    item_id_raw = _get_value(row, header_map, "item_id")
    item_name = _get_value(row, header_map, "item_name")
    location_id = _get_value(row, header_map, "location_id").upper()
    event_type = _get_value(row, header_map, "event_type").upper()
    quantity_raw = _get_value(row, header_map, "quantity")

    if not scan_id:
        raise ValueError("scan_id is required")
    if not event_time_stamps:
        raise ValueError("event_time_stamps is required")
    if not date_value:
        raise ValueError("date is required")
    if not dataset_id:
        raise ValueError("dataset_id is required")
    if dataset_id != settings.active_dataset_id:
        return None
    if not item_id_raw:
        raise ValueError("item_id is required")
    if not item_name:
        raise ValueError("item_name is required")
    if not location_id:
        raise ValueError("location_id is required")
    if not event_type:
        raise ValueError("event_type is required")
    if event_type not in ALLOWED_EVENT_TYPES:
        raise ValueError(f"event_type must be one of {sorted(ALLOWED_EVENT_TYPES)}")
    if not quantity_raw:
        raise ValueError("quantity is required")

    try:
        datetime.fromisoformat(event_time_stamps.replace(" ", "T"))
    except ValueError as exc:
        raise ValueError("event_time_stamps must be ISO-like datetime") from exc
    try:
        datetime.fromisoformat(date_value)
    except ValueError as exc:
        raise ValueError("date must be YYYY-MM-DD") from exc

    try:
        item_id = int(float(item_id_raw))
    except ValueError as exc:
        raise ValueError("item_id must be numeric") from exc
    try:
        quantity = float(quantity_raw)
    except ValueError as exc:
        raise ValueError("quantity must be numeric") from exc

    lot_number = _get_value(row, header_map, "lot_number") if "lot_number" in header_map else ""
    lot_expiry = _get_value(row, header_map, "lot_expiry") if "lot_expiry" in header_map else ""
    reason = _get_value(row, header_map, "reason") if "reason" in header_map else ""

    return IngestRow(
        scan_id=scan_id,
        event_time_stamps=event_time_stamps,
        date=date_value,
        dataset_id=dataset_id,
        item_id=item_id,
        item_name=item_name,
        location_id=location_id,
        event_type=event_type,
        quantity=quantity,
        lot_number=lot_number or None,
        lot_expiry=lot_expiry or None,
        reason=reason or None,
        sheet_row_index=sheet_row_index,
    )
