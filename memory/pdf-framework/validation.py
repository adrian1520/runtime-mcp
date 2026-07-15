"""Validation rules for processing outputs."""
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
