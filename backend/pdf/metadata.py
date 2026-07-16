from pathlib import Path
from typing import Any
from backend.common.filesystem import write_json
from ._shared import first_pdf

def run(inputs: list[Path], output_dir: Path, options: dict[str, Any]) -> dict[str, Any]:
    from pypdf import PdfReader
    pdf = first_pdf(inputs); reader = PdfReader(str(pdf))
    data = {"pages": len(reader.pages), "metadata": {str(k): str(v) for k, v in (reader.metadata or {}).items()}}
    write_json(output_dir / "metadata.json", data)
    return data
