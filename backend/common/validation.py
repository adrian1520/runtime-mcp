from __future__ import annotations

from pathlib import Path

MAX_FILE_BYTES = 25 * 1024 * 1024
MAX_PAGES = 2000
MIN_DPI = 72
MAX_DPI = 2400
PDF_MIME = "application/pdf"
IMAGE_MIMES = {"image/png", "image/jpeg", "image/tiff", "image/webp"}

class ValidationError(ValueError):
    pass

def safe_name(name: str) -> str:
    if not name or any(part in {"", ".", ".."} for part in name.replace("\\", "/").split("/")):
        raise ValidationError(f"unsafe file name: {name!r}")
    if not all(c.isalnum() or c in "._-" for c in name):
        raise ValidationError(f"unsupported characters in file name: {name!r}")
    return name

def validate_size(path: Path, max_bytes: int = MAX_FILE_BYTES) -> None:
    size = path.stat().st_size
    if size <= 0 or size > max_bytes:
        raise ValidationError(f"{path.name} size {size} is outside allowed range 1..{max_bytes}")

def validate_dpi(dpi: int) -> int:
    if dpi < MIN_DPI or dpi > MAX_DPI:
        raise ValidationError(f"dpi must be between {MIN_DPI} and {MAX_DPI}")
    return dpi

def validate_pdf(path: Path, max_pages: int = MAX_PAGES) -> int:
    validate_size(path)
    try:
        from pypdf import PdfReader
        pages = len(PdfReader(str(path)).pages)
    except Exception as exc:  # noqa: BLE001 - convert third-party parser details
        raise ValidationError(f"invalid PDF {path.name}: {exc}") from exc
    if pages < 1 or pages > max_pages:
        raise ValidationError(f"PDF page count {pages} is outside allowed range 1..{max_pages}")
    return pages
