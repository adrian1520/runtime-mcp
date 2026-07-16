from pathlib import Path
from typing import Any
from backend.common.validation import validate_pdf

def run(inputs: list[Path], output_dir: Path, options: dict[str, Any]) -> dict[str, Any]:
    from pypdf import PdfWriter
    if len(inputs) < 2: raise ValueError("merge requires at least two PDFs")
    writer = PdfWriter(); pages = 0
    for pdf in inputs:
        pages += validate_pdf(pdf); writer.append(str(pdf))
    with (output_dir / "result.pdf").open("wb") as handle: writer.write(handle)
    return {"pages": pages, "files": len(inputs), "output": "result.pdf"}
