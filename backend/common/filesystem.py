from __future__ import annotations

import base64
import json
from pathlib import Path
from typing import Any

from .validation import safe_name

def ensure_dirs(*paths: Path) -> None:
    for path in paths:
        path.mkdir(parents=True, exist_ok=True)

def write_request_files(request: dict[str, Any], input_dir: Path) -> list[Path]:
    ensure_dirs(input_dir)
    written: list[Path] = []
    for item in request["files"]:
        name = safe_name(item["name"])
        target = input_dir / name
        target.write_bytes(base64.b64decode(item["base64"], validate=True))
        written.append(target)
    return written

def write_json(path: Path, payload: dict[str, Any]) -> None:
    path.write_text(json.dumps(payload, indent=2, sort_keys=True) + "\n", encoding="utf-8")
