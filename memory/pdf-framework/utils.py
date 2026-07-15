"""Small utility functions."""
from __future__ import annotations
from pathlib import Path
from typing import Iterable

def ensure_directory(path: str) -> Path:
    target = Path(path)
    target.mkdir(parents=True, exist_ok=True)
    return target

def write_text(path: str, content: str) -> None:
    Path(path).write_text(content, encoding="utf-8")

def join_nonempty(parts: Iterable[str], separator: str = "\n") -> str:
    return separator.join(part for part in parts if part)
