from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path

from dotenv import load_dotenv


@dataclass(frozen=True)
class Settings:
    google_sheet_id: str
    google_sheet_range: str
    google_service_account_json: Path
    sqlite_db_path: Path
    active_dataset_id: str
    state_file: Path
    poll_interval_seconds: int


def load_settings() -> Settings:
    base_dir = Path(__file__).resolve().parent
    load_dotenv(base_dir / ".env")

    sheet_id = os.getenv("GOOGLE_SHEET_ID", "").strip()
    if not sheet_id:
        raise ValueError("GOOGLE_SHEET_ID is required")

    sheet_range = os.getenv("GOOGLE_SHEET_RANGE", "Sheet1!A:L").strip()
    service_account_path = Path(
        os.getenv("GOOGLE_SERVICE_ACCOUNT_JSON", "./service-account.json")
    )
    db_path = Path(
        os.getenv("SQLITE_DB_PATH", "../database/seeds/dss_inventory_demo.db")
    )
    state_file = Path(os.getenv("STATE_FILE", "./state.json"))

    if not service_account_path.is_absolute():
        service_account_path = (base_dir / service_account_path).resolve()
    if not db_path.is_absolute():
        db_path = (base_dir / db_path).resolve()
    if not state_file.is_absolute():
        state_file = (base_dir / state_file).resolve()

    if not service_account_path.exists():
        raise FileNotFoundError(
            "Google service account JSON not found. Copy backend/service-account.example.json "
            f"to {service_account_path.name} or set GOOGLE_SERVICE_ACCOUNT_JSON to the local file path."
        )

    return Settings(
        google_sheet_id=sheet_id,
        google_sheet_range=sheet_range,
        google_service_account_json=service_account_path,
        sqlite_db_path=db_path,
        active_dataset_id=os.getenv(
            "ACTIVE_DATASET_ID", "real_data_final_updated_2026_03_29"
        ).strip(),
        state_file=state_file,
        poll_interval_seconds=max(1, int(os.getenv("POLL_INTERVAL_SECONDS", "3"))),
    )
