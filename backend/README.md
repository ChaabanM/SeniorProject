# Google Sheet Ingestor (Flask)

Append-only ingestor from Google Sheets -> `raw_inventory_v` (SQLite).

## Setup

1. Create a venv and install deps:
   - `python -m venv .venv`
   - `.venv\\Scripts\\activate`
   - `pip install -r requirements.txt`
2. Copy `.env.example` to `.env` and update values if needed.
3. Copy `service-account.example.json` to `service-account.json` and fill in your Google service account details.
4. Share the Google Sheet with the service account email as Viewer.

## Run

- `python app.py`
- Or double-click `start_ingestor.bat`

## Endpoints

- `GET /health`
- `GET /status`
- `POST /sync-now`

## Auto-start on Windows

Install startup task (runs at user logon):

- `powershell -ExecutionPolicy Bypass -File .\install_startup_task.ps1`

Remove startup task:

- `powershell -ExecutionPolicy Bypass -File .\remove_startup_task.ps1`

## Notes

- Append-only mode.
- Dedupe uses `scan_id` in meta table `ingest_scan_ids`.
- Checkpoint file: `state.json` (last processed sheet row).
- Keep `service-account.json` local only; the repo includes `service-account.example.json` as the template.
