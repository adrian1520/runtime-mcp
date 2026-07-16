from __future__ import annotations

import hashlib
from pathlib import Path

def manifest(output_dir: Path) -> dict[str, object]:
    files = []
    for path in sorted(p for p in output_dir.rglob("*") if p.is_file()):
        files.append({
            "path": path.relative_to(output_dir).as_posix(),
            "sizeBytes": path.stat().st_size,
            "sha256": hashlib.sha256(path.read_bytes()).hexdigest(),
        })
    return {"files": files}
