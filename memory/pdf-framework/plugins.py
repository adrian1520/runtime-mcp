"""Plugin interfaces and built-in plugin registry."""
from __future__ import annotations
from typing import Protocol, Dict, List
from models import ProcessingResult

class Plugin(Protocol):
    name: str
    order: int
    def run(self, result: ProcessingResult, context: dict) -> ProcessingResult: ...

class PluginRegistry:
    def __init__(self) -> None:
        self._plugins: Dict[str, Plugin] = {}
    def register(self, plugin: Plugin) -> None:
        self._plugins[plugin.name] = plugin
    def get(self, name: str) -> Plugin:
        return self._plugins[name]
    def ordered(self, names: List[str]) -> List[Plugin]:
        return sorted((self.get(name) for name in names), key=lambda p: p.order)

class MetadataPlugin:
    name = "metadata"
    order = 20
    def run(self, result: ProcessingResult, context: dict) -> ProcessingResult:
        backend = context["backend"]
        result.document.metadata.update(backend.metadata(result.document))
        return result

class TextPlugin:
    name = "text"
    order = 30
    def run(self, result: ProcessingResult, context: dict) -> ProcessingResult:
        backend = context["backend"]
        result.artifacts["text"] = backend.extract_text(result.document)
        return result

class ValidationPlugin:
    name = "validate"
    order = 90
    def run(self, result: ProcessingResult, context: dict) -> ProcessingResult:
        validator = context["validator"]
        result.warnings.extend(validator.validate(result))
        return result

def default_registry() -> PluginRegistry:
    registry = PluginRegistry()
    registry.register(MetadataPlugin())
    registry.register(TextPlugin())
    registry.register(ValidationPlugin())
    return registry
