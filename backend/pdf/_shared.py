from __future__ import annotations

from pathlib import Path
from typing import Any

from backend.common.validation import validate_pdf

def first_pdf(inputs: list[Path]) -> Path:
    pdf = inputs[0]
    validate_pdf(pdf)
    return pdf

def options_int(options: dict[str, Any], key: str, default: int) -> int:
    value = options.get(key, default)
    if not isinstance(value, int):
        raise ValueError(f"{key} must be an integer")
    return value
