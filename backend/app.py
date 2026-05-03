from __future__ import annotations

import logging

from flask import Flask, jsonify

from sheets_worker import build_worker

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s - %(message)s")

app = Flask(__name__)
worker = build_worker()
worker.start()


@app.get("/health")
def health() -> tuple[dict, int]:
    return {"ok": True, "service": "google-sheet-ingestor"}, 200


@app.get("/status")
def status() -> tuple[dict, int]:
    s = worker.status
    return (
        {
            "running": s.running,
            "last_sync_at": s.last_sync_at,
            "last_error": s.last_error,
            "inserted_last_run": s.inserted_last_run,
            "skipped_duplicates_last_run": s.skipped_duplicates_last_run,
            "inserted_total": s.inserted_total,
            "last_processed_row": s.last_processed_row,
            "parse_errors_last_run": s.parse_errors_last_run,
        },
        200,
    )


@app.post("/sync-now")
def sync_now() -> tuple[dict, int]:
    try:
        worker.run_once()
        return jsonify({"ok": True, "message": "Sync completed"}), 200
    except Exception as exc:  # noqa: BLE001
        return jsonify({"ok": False, "error": str(exc)}), 500


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5055, debug=False)
