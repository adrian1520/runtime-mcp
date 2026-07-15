"""Session state used by ChatGPT while running modules in Python Tool."""
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
