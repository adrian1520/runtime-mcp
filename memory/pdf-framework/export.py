"""Export helpers for framework results."""
from __future__ import annotations
import json
from dataclasses import asdict
from models import ProcessingResult

def to_dict(result: ProcessingResult) -> dict:
    return asdict(result)

def to_json(result: ProcessingResult) -> str:
    return json.dumps(to_dict(result), ensure_ascii=False, indent=2, default=str)
