from __future__ import annotations

from typing import List

from google.oauth2 import service_account
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError

from config import Settings


def fetch_sheet_values(settings: Settings) -> List[List[str]]:
    credentials = service_account.Credentials.from_service_account_file(
        str(settings.google_service_account_json),
        scopes=["https://www.googleapis.com/auth/spreadsheets.readonly"],
    )
    service = build("sheets", "v4", credentials=credentials, cache_discovery=False)
    try:
        response = (
            service.spreadsheets()
            .values()
            .get(spreadsheetId=settings.google_sheet_id, range=settings.google_sheet_range)
            .execute()
        )
    except HttpError as exc:
        hint = ""
        if exc.resp.status in (403, 404):
            hint = " Share the sheet with the service account email (Viewer) and check GOOGLE_SHEET_ID / GOOGLE_SHEET_RANGE (tab name must match, e.g. Sheet1)."
        raise RuntimeError(f"Google Sheets API error ({exc.resp.status}): {exc}{hint}") from exc
    return response.get("values", [])
