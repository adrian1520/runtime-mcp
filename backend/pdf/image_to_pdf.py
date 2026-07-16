from pathlib import Path
from typing import Any
from backend.common.validation import validate_size

def run(inputs: list[Path], output_dir: Path, options: dict[str, Any]) -> dict[str, Any]:
    from PIL import Image
    images = []
    for path in inputs:
        validate_size(path)
        img = Image.open(path).convert("RGB")
        images.append(img)
    images[0].save(output_dir / "result.pdf", save_all=True, append_images=images[1:])
    return {"images": len(images), "output": "result.pdf"}
