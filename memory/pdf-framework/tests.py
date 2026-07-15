"""Smoke tests intended to be copied into Python Tool with the framework modules."""
from __future__ import annotations
from models import FrameworkConfig
from framework_core import PdfFramework

def test_default_config() -> None:
    cfg = FrameworkConfig()
    assert cfg.backend == "pypdf"
    assert cfg.plugins == ["metadata", "text", "validate"]

def test_framework_constructs() -> None:
    fw = PdfFramework(FrameworkConfig(plugins=["metadata", "text", "validate"]))
    assert fw.config.backend == "pypdf"
