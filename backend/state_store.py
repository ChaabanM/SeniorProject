from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Dict


def load_state(path: Path) -> Dict[str, Any]:
    if not path.exists():
        return {"last_processed_row": 1, "last_sync_at": None, "inserted_total": 0}
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return {"last_processed_row": 1, "last_sync_at": None, "inserted_total": 0}


def save_state(path: Path, state: Dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(state, indent=2), encoding="utf-8")
