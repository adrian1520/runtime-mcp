---
name: github-actions-python-backend
description: Design and implement Python execution backends that run entirely inside GitHub Actions. Use this skill whenever long-running, CPU-intensive, or file-processing tasks should be executed by GitHub Actions instead of the MCP runtime.
---

# GitHub Actions Python Backend

## Goal

Design a backend where GitHub Actions is the compute layer.

The MCP must never perform heavy computation.

Instead:

User
↓

MCP

↓

GitHub Actions

↓

Python Backend

↓

Artifact

↓

MCP

↓

Chat

The MCP is responsible only for orchestration.

---

# Architecture Principles

The Python backend must be:

- Stateless
- Deterministic
- Idempotent
- Reproducible
- Restartable

Avoid storing state inside GitHub runners.

Everything required for execution should be provided through:

- workflow inputs
- uploaded files
- repository content
- artifacts

---

# Responsibilities

## MCP

Responsible for:

- validating requests
- uploading inputs
- dispatching workflows
- polling workflow status
- downloading artifacts
- returning files to ChatGPT

Never execute heavy processing locally.

---

## GitHub Actions

Responsible for:

- provisioning runtime
- installing dependencies
- executing Python
- generating artifacts
- publishing logs

---

## Python Backend

Responsible for:

- business logic
- validation
- processing
- report generation
- artifact generation

Python code should contain no GitHub-specific logic.

---

# Processing Pipeline

Preferred execution order:

Validate input

↓

Create workspace

↓

Download files

↓

Execute Python backend

↓

Generate outputs

↓

Validate outputs

↓

Upload artifacts

↓

Generate execution summary

---

# PDF Processing

Preferred libraries:

- PyMuPDF
- OCRmyPDF
- pypdf
- Pillow
- OpenCV
- Tesseract
- pdfplumber

Supported operations include:

- OCR
- searchable PDF
- page extraction
- page rendering
- image conversion
- merge
- split
- rotate
- crop
- watermark
- metadata extraction
- thumbnail generation
- page optimization

Keep each operation modular.

---

# Workflow Inputs

Prefer strongly typed inputs.

Examples:

- input_file
- page
- dpi
- format
- language
- output_type

Validate all inputs before execution.

---

# Outputs

Always generate predictable outputs.

Example:

output/

    result.pdf

    page_001.png

    metadata.json

    execution.json

    logs.txt

Avoid random filenames.

---

# Logging

Every backend should produce:

- execution log
- warnings
- processing statistics
- execution time
- software versions

Logs should be uploaded as artifacts.

---

# Error Handling

Never silently ignore failures.

Always:

- exit with non-zero status
- produce readable error messages
- upload diagnostic logs

---

# Performance

Prefer:

- multiprocessing
- chunked processing
- streaming large files
- temporary workspaces

Avoid unnecessary memory usage.

---

# Extensibility

Every new feature should be implemented as an independent processing module.

Example:

backend/

    pdf/

        render.py

        ocr.py

        merge.py

        split.py

        crop.py

        metadata.py

        watermark.py

Each module should expose a consistent interface.

---

# Security

Never trust workflow inputs.

Always validate:

- file type
- file size
- page count
- DPI
- output format

Reject malformed files.

Never execute arbitrary user code.

---

# Coding Standards

Prefer:

- type hints
- pathlib
- dataclasses
- logging
- argparse or typer
- pytest

Avoid global mutable state.

---

# Verification

Before considering work complete verify:

✓ workflow executes successfully

✓ artifacts are uploaded

✓ outputs are reproducible

✓ logs are generated

✓ errors are actionable

✓ temporary files are cleaned

✓ execution is deterministic

The backend should be usable by any MCP tool without modification.