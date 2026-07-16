from pathlib import Path
from typing import Any
from ._shared import first_pdf

def run(inputs: list[Path], output_dir: Path, options: dict[str, Any]) -> dict[str, Any]:
    import ocrmypdf
    pdf = first_pdf(inputs); output = output_dir / "result.pdf"
    ocrmypdf.ocr(str(pdf), str(output), deskew=bool(options.get("deskew", True)), skip_text=True)
    return {"output": "result.pdf"}
