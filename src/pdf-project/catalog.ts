export type PdfResource = {
  uri: string;
  name: string;
  mimeType: string;
  description: string;
  text: string;
};

const version = "0.1.0";
const modules = [
  "framework_core.py",
  "execution.py",
  "plugins.py",
  "models.py",
  "validation.py",
  "backends.py",
  "session.py",
  "export.py",
  "utils.py",
  "tests.py",
] as const;

const moduleSources: Record<(typeof modules)[number], string> = {
  "models.py": `"""Data models for the PDF processing framework."""
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
`,
  "plugins.py": `"""Plugin interfaces and built-in plugin registry."""
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
`,
  "backends.py": `"""Backend abstraction. Execution happens only in Python Tool, never inside MCP."""
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
`,
  "validation.py": `"""Validation rules for processing outputs."""
from __future__ import annotations
from typing import List
from models import ProcessingResult

class ResultValidator:
    def validate(self, result: ProcessingResult) -> List[str]:
        warnings: List[str] = []
        if not result.document.path.lower().endswith(".pdf"):
            warnings.append("Input path does not end with .pdf")
        if "text" in result.artifacts and not any(result.artifacts["text"]):
            warnings.append("No extractable text was found")
        return warnings
`,
  "execution.py": `"""Deterministic execution pipeline for Python Tool."""
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
`,
  "export.py": `"""Export helpers for framework results."""
from __future__ import annotations
import json
from dataclasses import asdict
from models import ProcessingResult

def to_dict(result: ProcessingResult) -> dict:
    return asdict(result)

def to_json(result: ProcessingResult) -> str:
    return json.dumps(to_dict(result), ensure_ascii=False, indent=2, default=str)
`,
  "session.py": `"""Session state used by ChatGPT while running modules in Python Tool."""
from __future__ import annotations
from dataclasses import dataclass, field
from typing import Dict, Any, List

@dataclass
class ProjectSession:
    project_version: str = "0.1.0"
    completed_steps: List[str] = field(default_factory=list)
    notes: Dict[str, Any] = field(default_factory=dict)
    def record(self, step: str, **metadata: Any) -> None:
        self.completed_steps.append(step)
        if metadata:
            self.notes[step] = metadata
`,
  "utils.py": `"""Small utility functions."""
from __future__ import annotations
from pathlib import Path
from typing import Iterable

def ensure_directory(path: str) -> Path:
    target = Path(path)
    target.mkdir(parents=True, exist_ok=True)
    return target

def write_text(path: str, content: str) -> None:
    Path(path).write_text(content, encoding="utf-8")

def join_nonempty(parts: Iterable[str], separator: str = "\n") -> str:
    return separator.join(part for part in parts if part)
`,
  "framework_core.py": `"""Public facade for the PDF framework."""
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
`,
  "tests.py": `"""Smoke tests intended to be copied into Python Tool with the framework modules."""
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
`,
};

const skills = {
  build_pdf_framework: `# build_pdf_framework\n\nArchitecture skill for iteratively building the production PDF framework.\n\nProject structure: framework_core.py is the facade, execution.py orchestrates deterministic plugin execution, plugins.py contains plugin contracts and built-ins, models.py defines DTOs, backends.py isolates PDF libraries, validation.py checks outputs, export.py serializes results, session.py tracks Python Tool work, utils.py contains filesystem helpers, tests.py provides smoke tests.\n\nCoding standard: pure Python modules, typed public interfaces, dataclasses for state, no side effects on import, no execution inside MCP. Keep plugins small and ordered.\n\nDependencies: Python 3.11+, pypdf for PDF reading, pytest for tests. MCP itself only stores and serves source/context.\n\nWorkflow: read project context, fetch required module resources, write modules into Python Tool, install dependencies there, run tests, process PDFs, update MCP memory with decisions and completed stages.\n\nIteration: add one capability per iteration, update module version metadata in project context, add tests, record architectural decisions in memory.`,
  process_pdf: `# process_pdf\n\nUse this skill when ChatGPT needs to process a PDF.\n\nPlugin order: backend load happens in PipelineExecutor, then metadata, text, validation, export. Custom plugins must declare name and order and be registered before execution.\n\nPython Tool usage: fetch all required resources, write files into a temporary project directory, install pypdf if missing, import PdfFramework from framework_core, call PdfFramework().process_to_json(path).\n\nMCP never executes framework code and never reads user PDFs. It only supplies context, source modules, and project memory.`,
  extend_framework: `# extend_framework\n\nUse this skill to add plugins, backends, exporters, or models.\n\nPlugins: implement name, order, run(result, context), register in default_registry or a custom registry.\n\nBackends: expose load(path), metadata(document), extract_text(document), and register by backend name.\n\nExporters: add pure functions in export.py and keep ProcessingResult as the canonical exchange object.\n\nModels: extend dataclasses in models.py with backward-compatible defaults. Update validation and tests with every schema change.`,
} as const;

export const pdfProjectContext = {
  project: "production-pdf-framework",
  version,
  manifest: {
    runtime: "Python Tool in ChatGPT",
    mcpRole: "knowledge/resources/memory/context/source only",
    executionPolicy: "Framework code is never executed by MCP",
    dependencies: ["python>=3.11", "pypdf", "pytest"],
  },
  modules: modules.map((name) => ({ name, version, uri: `pdf-framework://source/${name}` })),
  plugins: ["metadata", "text", "validate"],
  backends: ["pypdf"],
  configuration: { defaultBackend: "pypdf", defaultExport: "json" },
  memory: {
    currentVersion: version,
    completedStages: ["mcp-resource-catalog", "skills", "project-context", "source-modules"],
    decisions: [
      "MCP stores code and context only; Python Tool performs all execution.",
      "Resources are versioned by project context and stable URI names.",
      "Plugin execution is deterministic by numeric order.",
    ],
    dependencyGraph: {
      "framework_core.py": ["models.py", "execution.py", "export.py"],
      "execution.py": ["models.py", "plugins.py", "backends.py", "validation.py"],
      "plugins.py": ["models.py"],
      "backends.py": ["models.py", "pypdf"],
      "validation.py": ["models.py"],
      "export.py": ["models.py"],
      "session.py": [],
      "utils.py": [],
      "tests.py": ["models.py", "framework_core.py"],
    },
  },
} as const;

const contextResource: PdfResource = {
  uri: "pdf-framework://context/project",
  name: "PDF framework project context",
  mimeType: "application/json",
  description: "Automatically consumable project manifest, module versions, plugins, backends, config, and memory summary.",
  text: JSON.stringify(pdfProjectContext, null, 2),
};

const allSourceResource: PdfResource = {
  uri: "pdf-framework://source/all",
  name: "Complete PDF framework source repository",
  mimeType: "application/json",
  description: "All versioned Python modules in one resource for bulk retrieval into Python Tool.",
  text: JSON.stringify({ version, modules: moduleSources }, null, 2),
};

export const pdfResources: PdfResource[] = [
  contextResource,
  ...Object.entries(skills).map(([name, text]) => ({
    uri: `pdf-framework://skills/${name}`,
    name,
    mimeType: "text/markdown",
    description: `Skill instructions for ${name}`,
    text,
  })),
  ...modules.map((name) => ({
    uri: `pdf-framework://source/${name}`,
    name,
    mimeType: "text/x-python",
    description: `Version ${version} source module ${name}`,
    text: moduleSources[name],
  })),
  allSourceResource,
];

export function getPdfResource(uri: string): PdfResource | undefined {
  return pdfResources.find((resource) => resource.uri === uri);
}
