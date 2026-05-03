from __future__ import annotations

import sqlite3
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Iterable, Set

from mapper import IngestRow


@dataclass
class InsertResult:
    inserted: int
    skipped_duplicates: int


def ensure_meta_table(conn: sqlite3.Connection) -> None:
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS ingest_scan_ids (
          scan_id TEXT PRIMARY KEY,
          ingested_at TEXT NOT NULL
        )
        """
    )
    conn.commit()


def fetch_existing_scan_ids(conn: sqlite3.Connection, scan_ids: Iterable[str]) -> Set[str]:
    ids = [s for s in scan_ids if s]
    if not ids:
        return set()
    placeholders = ",".join(["?"] * len(ids))
    rows = conn.execute(
        f"SELECT scan_id FROM ingest_scan_ids WHERE scan_id IN ({placeholders})",
        ids,
    ).fetchall()
    return {str(r[0]) for r in rows}


def insert_rows(db_path: Path, rows: list[IngestRow]) -> InsertResult:
    if not rows:
        return InsertResult(inserted=0, skipped_duplicates=0)

    conn = sqlite3.connect(str(db_path))
    try:
        ensure_meta_table(conn)
        existing = fetch_existing_scan_ids(conn, (r.scan_id for r in rows))
        inserted = 0
        skipped = 0
        now = datetime.utcnow().isoformat()

        for row in rows:
            if row.scan_id in existing:
                skipped += 1
                continue
            receipts_qty = row.quantity if row.event_type == "RECEIPT" else 0
            issues_qty = row.quantity if row.event_type == "ISSUE" else 0
            conn.execute(
                """
                INSERT INTO raw_inventory_v (
                  dataset_id, date, location_id, item_id, item_name,
                  event_time_stamps, event_type, quantity,
                  receipts_qty, issues_qty, reason, lot_number, lot_expiry
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    row.dataset_id,
                    row.date,
                    row.location_id,
                    row.item_id,
                    row.item_name,
                    row.event_time_stamps,
                    row.event_type,
                    row.quantity,
                    receipts_qty,
                    issues_qty,
                    row.reason,
                    row.lot_number,
                    row.lot_expiry,
                ),
            )
            conn.execute(
                "INSERT INTO ingest_scan_ids (scan_id, ingested_at) VALUES (?, ?)",
                (row.scan_id, now),
            )
            existing.add(row.scan_id)
            inserted += 1
        conn.commit()
        return InsertResult(inserted=inserted, skipped_duplicates=skipped)
    finally:
        conn.close()
