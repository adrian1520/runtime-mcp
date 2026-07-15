"""Backend abstraction. Execution happens only in Python Tool, never inside MCP."""
from __future__ import annotations
from typing import Dict, Any, List
from models import Document

class PyPdfBackend:
    name = "pypdf"
    def load(self, path: str) -> Document:
        with open(path, "rb") as handle:
            return Document(path=path, bytes_data=handle.read())
    def metadata(self, document: Document) -> Dict[str, Any]:
        try:
            from pypdf import PdfReader
            reader = PdfReader(document.path)
            return {str(k): str(v) for k, v in (reader.metadata or {}).items()}
        except Exception as exc:
            return {"metadata_error": str(exc)}
    def extract_text(self, document: Document) -> List[str]:
        from pypdf import PdfReader
        reader = PdfReader(document.path)
        return [(page.extract_text() or "") for page in reader.pages]

class BackendRegistry:
    def __init__(self) -> None:
        self._backends = {"pypdf": PyPdfBackend()}
    def get(self, name: str):
        return self._backends[name]
    def names(self):
        return sorted(self._backends.keys())
