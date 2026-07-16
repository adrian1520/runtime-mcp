---
name: github-actions-workflows
description: Design, implement, review, debug, optimize, and maintain GitHub Actions workflows for CI/CD, automation, artifact generation, reusable workflows, release pipelines, Python backends, and repository automation. Use this skill whenever work involves .github/workflows, workflow_dispatch, reusable workflows, composite actions, GitHub-hosted runners, self-hosted runners, artifacts, releases, caching, matrices, secrets, permissions, OIDC, deployment pipelines, or automation executed through GitHub Actions.
---

# GitHub Actions Workflows

## Goal

Produce production-quality GitHub Actions workflows that are:

- Secure
- Reproducible
- Modular
- Observable
- Idempotent
- Easy to maintain

Prefer reusable workflows over duplicated YAML whenever possible.

---

# Repository Inspection

Before creating or modifying workflows:

1. Inspect existing workflows.
2. Identify duplicated jobs.
3. Detect existing reusable workflows.
4. Detect deployment strategy.
5. Detect artifact flow.
6. Detect release process.
7. Detect cache usage.
8. Detect Python version management.
9. Detect package manager.
10. Preserve existing conventions.

Never replace a working workflow without justification.

---

# Workflow Design

Prefer:

- workflow_dispatch
- workflow_call
- reusable workflows
- composite actions
- matrices
- concurrency groups
- environments
- artifact reuse

Avoid duplicated YAML.

---

# Security

Always:

- use least-privilege permissions
- define permissions explicitly
- pin action versions
- prefer OIDC over long-lived secrets
- never expose secrets
- never print tokens
- mask sensitive output
- validate user inputs

---

# Python Jobs

Prefer:

- Python 3.12+
- pip cache
- uv when already used
- deterministic dependency installation

Always separate:

- dependencies
- build
- processing
- upload

---

# PDF Processing Backends

When workflows execute Python PDF processing:

Prefer:

- PyMuPDF
- OCRmyPDF
- Pillow
- pypdf

Typical pipeline:

Input
↓

Validate

↓

Download artifacts

↓

Execute Python backend

↓

Generate outputs

↓

Upload artifacts

↓

Return generated files

Support tasks such as:

- OCR
- searchable PDF
- page rendering
- page extraction
- PDF merge
- PDF split
- image conversion
- metadata extraction
- thumbnail generation

---

# Artifacts

Prefer artifacts over temporary commits.

Artifacts should have:

- meaningful names
- retention period
- predictable structure

Example:

artifacts/
    output.pdf
    page_38.png
    ocr.pdf
    logs.txt

---

# Caching

Use cache only for:

- pip
- uv
- npm
- pnpm
- cargo

Do not cache generated artifacts.

---

# Failure Handling

Every workflow should:

- fail fast
- validate inputs
- expose useful logs
- upload logs when processing fails

Avoid silent failures.

---

# Reusable Workflows

Extract repeated logic into reusable workflows.

Prefer:

workflow_call

instead of copying identical jobs.

---

# Outputs

Workflows should expose:

- outputs
- artifacts
- summary

Prefer GitHub Step Summary for human-readable execution results.

---

# MCP Integration

When GitHub Actions is used as an execution backend:

The MCP should:

1. validate request
2. upload inputs
3. dispatch workflow
4. monitor execution
5. download artifacts
6. return generated files to the user

GitHub Actions performs the computation.

The MCP acts only as an orchestration layer.

---

# Verification

Before completing work verify:

- YAML syntax
- workflow permissions
- action versions
- artifact upload
- cache correctness
- matrix correctness
- reusable workflow compatibility
- workflow_dispatch inputs
- workflow outputs
- error handling

Never consider the implementation complete until the workflow can execute successfully from a clean repository checkout.