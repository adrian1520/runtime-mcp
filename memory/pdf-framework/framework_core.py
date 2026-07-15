"""Public facade for the PDF framework."""
from __future__ import annotations
from models import FrameworkConfig, ProcessingResult
from execution import PipelineExecutor
from export import to_json, to_dict

class PdfFramework:
    def __init__(self, config: FrameworkConfig | None = None) -> None:
        self.config = config or FrameworkConfig()
        self.executor = PipelineExecutor(self.config)
    def process(self, path: str) -> ProcessingResult:
        return self.executor.process(path)
    def process_to_json(self, path: str) -> str:
        return to_json(self.process(path))
    def process_to_dict(self, path: str) -> dict:
        return to_dict(self.process(path))
