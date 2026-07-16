from pathlib import Path
from typing import Any
from ._shared import first_pdf

def run(inputs: list[Path], output_dir: Path, options: dict[str, Any]) -> dict[str, Any]:
    from pypdf import PdfReader, PdfWriter
    reader = PdfReader(str(first_pdf(inputs)))
    for index, page in enumerate(reader.pages, start=1):
        writer = PdfWriter(); writer.add_page(page)
        with (output_dir / f"page_{index:03d}.pdf").open("wb") as handle: writer.write(handle)
    return {"pages": len(reader.pages)}
