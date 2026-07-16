from pathlib import Path
from typing import Any
from backend.common.validation import validate_dpi
from ._shared import first_pdf, options_int

def run(inputs: list[Path], output_dir: Path, options: dict[str, Any]) -> dict[str, Any]:
    import fitz
    pdf = first_pdf(inputs); dpi = validate_dpi(options_int(options, "dpi", 300))
    doc = fitz.open(pdf)
    for i, page in enumerate(doc, start=1):
        page.get_pixmap(dpi=dpi).save(output_dir / f"page_{i:03d}.png")
    return {"pages": len(doc), "dpi": dpi, "format": "png"}
