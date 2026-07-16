from pathlib import Path
from typing import Any
from ._shared import first_pdf, options_int

def run(inputs: list[Path], output_dir: Path, options: dict[str, Any]) -> dict[str, Any]:
    from pypdf import PdfReader, PdfWriter
    angle = options_int(options, "angle", 90)
    if angle not in {90, 180, 270}: raise ValueError("angle must be 90, 180, or 270")
    reader = PdfReader(str(first_pdf(inputs))); writer = PdfWriter()
    for page in reader.pages: writer.add_page(page.rotate(angle))
    with (output_dir / "result.pdf").open("wb") as handle: writer.write(handle)
    return {"pages": len(reader.pages), "angle": angle, "output": "result.pdf"}
