from __future__ import annotations

import logging
import threading
import time
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Optional

from config import Settings, load_settings
from db_writer import insert_rows
from google_client import fetch_sheet_values
from mapper import parse_sheet
from state_store import load_state, save_state

logger = logging.getLogger("ingestor_worker")


@dataclass
class WorkerStatus:
    running: bool = False
    last_sync_at: Optional[str] = None
    last_error: Optional[str] = None
    inserted_last_run: int = 0
    skipped_duplicates_last_run: int = 0
    inserted_total: int = 0
    last_processed_row: int = 1
    parse_errors_last_run: list[str] = field(default_factory=list)


class SheetsWorker:
    def __init__(self, settings: Settings) -> None:
        self.settings = settings
        self.status = WorkerStatus()
        self._thread: Optional[threading.Thread] = None
        self._stop_event = threading.Event()

        state = load_state(self.settings.state_file)
        self.status.last_processed_row = int(state.get("last_processed_row", 1))
        self.status.inserted_total = int(state.get("inserted_total", 0))
        self.status.last_sync_at = state.get("last_sync_at")

    def start(self) -> None:
        if self._thread and self._thread.is_alive():
            return
        self._stop_event.clear()
        self._thread = threading.Thread(target=self._run_loop, daemon=True)
        self._thread.start()

    def stop(self) -> None:
        self._stop_event.set()
        if self._thread and self._thread.is_alive():
            self._thread.join(timeout=3)

    def _run_loop(self) -> None:
        self.status.running = True
        while not self._stop_event.is_set():
            try:
                self.run_once()
                self.status.last_error = None
            except Exception as exc:  # noqa: BLE001
                self.status.last_error = str(exc)
                logger.exception("Worker run failed: %s", exc)
            self._stop_event.wait(self.settings.poll_interval_seconds)
        self.status.running = False

    def run_once(self) -> None:
        sheet_values = fetch_sheet_values(self.settings)
        rows, parse_errors = parse_sheet(sheet_values, self.settings)
        self.status.parse_errors_last_run = parse_errors

        # Dedupe is only by scan_id (ingest_scan_ids). Row-based gating caused false
        # "not syncing" when last_processed_row matched the last sheet row but new
        # edits/rows needed pickup, or after DB cleanup without resetting state.
        result = insert_rows(self.settings.sqlite_db_path, rows)
        self.status.inserted_last_run = result.inserted
        self.status.skipped_duplicates_last_run = result.skipped_duplicates
        self.status.inserted_total += result.inserted

        if rows:
            self.status.last_processed_row = max(r.sheet_row_index for r in rows)

        now = datetime.now(tz=timezone.utc).isoformat()
        self.status.last_sync_at = now
        save_state(
            self.settings.state_file,
            {
                "last_processed_row": self.status.last_processed_row,
                "inserted_total": self.status.inserted_total,
                "last_sync_at": self.status.last_sync_at,
            },
        )


def build_worker() -> SheetsWorker:
    settings = load_settings()
    return SheetsWorker(settings)
