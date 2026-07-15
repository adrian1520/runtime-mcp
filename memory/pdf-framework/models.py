"""Data models for the PDF processing framework."""
from __future__ import annotations
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional

@dataclass
class Document:
    path: str
    bytes_data: Optional[bytes] = None
    metadata: Dict[str, Any] = field(default_factory=dict)
    pages: List[Dict[str, Any]] = field(default_factory=list)

@dataclass
class ProcessingResult:
    document: Document
    artifacts: Dict[str, Any] = field(default_factory=dict)
    warnings: List[str] = field(default_factory=list)
    errors: List[str] = field(default_factory=list)

@dataclass
class FrameworkConfig:
    backend: str = "pypdf"
    plugins: List[str] = field(default_factory=lambda: ["metadata", "text", "validate"])
    export_format: str = "json"
    options: Dict[str, Any] = field(default_factory=dict)
