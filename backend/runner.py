from __future__ import annotations

import argparse
import importlib
import json
import platform
import time
from pathlib import Path
from typing import Any

from backend.common.artifacts import manifest
from backend.common.filesystem import ensure_dirs, write_json, write_request_files
from backend.common.logging import configure

ALLOWED = {"render", "ocr", "split", "merge", "metadata", "image_to_pdf", "pdf_to_images", "searchable", "rotate", "crop"}

def dependency_versions() -> dict[str, str]:
    versions: dict[str, str] = {"python": platform.python_version()}
    for name in ["pypdf", "fitz", "PIL", "ocrmypdf"]:
        try:
            module = importlib.import_module(name)
            versions[name] = str(getattr(module, "__version__", "installed"))
        except Exception:
            versions[name] = "not-installed"
    return versions

def main() -> int:
    parser = argparse.ArgumentParser(description="Runtime MCP GitHub Actions PDF backend")
    parser.add_argument("--operation", required=True, choices=sorted(ALLOWED))
    parser.add_argument("--request", required=True, type=Path)
    parser.add_argument("--workdir", required=True, type=Path)
    args = parser.parse_args()
    input_dir = args.workdir / "input"; output_dir = args.workdir / "output"
    ensure_dirs(input_dir, output_dir)
    logger = configure(output_dir / "execution.log")
    start = time.monotonic()
    status: dict[str, Any] = {"operation": args.operation, "success": False, "warnings": [], "dependencyVersions": dependency_versions()}
    try:
        request = json.loads(args.request.read_text(encoding="utf-8"))
        if request.get("operation") != args.operation:
            raise ValueError("request operation does not match workflow input")
        inputs = write_request_files(request, input_dir)
        logger.info("prepared %s input file(s)", len(inputs))
        module = importlib.import_module(f"backend.pdf.{args.operation}")
        result = module.run(inputs, output_dir, request.get("options") or {})
        status.update({"success": True, "result": result})
        return 0
    except Exception as exc:  # noqa: BLE001 - top-level CLI must log diagnostics
        logger.exception("backend execution failed")
        status.update({"error": {"type": type(exc).__name__, "message": str(exc)}})
        return 1
    finally:
        status["durationSeconds"] = round(time.monotonic() - start, 3)
        write_json(output_dir / "execution.json", status)
        write_json(output_dir / "artifacts.json", manifest(output_dir))

if __name__ == "__main__":
    raise SystemExit(main())
