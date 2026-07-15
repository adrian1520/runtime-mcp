"""Deterministic execution pipeline for Python Tool."""
from __future__ import annotations
from models import FrameworkConfig, ProcessingResult
from plugins import default_registry
from backends import BackendRegistry
from validation import ResultValidator

class PipelineExecutor:
    def __init__(self, config: FrameworkConfig) -> None:
        self.config = config
        self.backends = BackendRegistry()
        self.plugins = default_registry()
        self.validator = ResultValidator()
    def process(self, path: str) -> ProcessingResult:
        backend = self.backends.get(self.config.backend)
        document = backend.load(path)
        result = ProcessingResult(document=document)
        context = {"backend": backend, "validator": self.validator, "config": self.config}
        for plugin in self.plugins.ordered(self.config.plugins):
            result = plugin.run(result, context)
        return result
