from pathlib import Path
from typing import Any
from ._shared import first_pdf

def run(inputs: list[Path], output_dir: Path, options: dict[str, Any]) -> dict[str, Any]:
    from pypdf import PdfReader, PdfWriter
    box = options.get("box")
    if not (isinstance(box, list) and len(box) == 4 and all(isinstance(v, (int, float)) for v in box)):
        raise ValueError("box must be [left, bottom, right, top]")
    reader = PdfReader(str(first_pdf(inputs))); writer = PdfWriter()
    for page in reader.pages:
        page.cropbox.lower_left = (box[0], box[1]); page.cropbox.upper_right = (box[2], box[3]); writer.add_page(page)
    with (output_dir / "result.pdf").open("wb") as handle: writer.write(handle)
    return {"pages": len(reader.pages), "box": box, "output": "result.pdf"}
