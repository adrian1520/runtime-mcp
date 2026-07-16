# GitHub Actions PDF Backend

This repository includes a GitHub Actions execution backend for long-running PDF and image workloads. The MCP runtime is only an orchestration layer: it validates requests, uploads request JSON to the repository, dispatches `runtime-pdf-backend.yml`, polls the run, downloads the artifact ZIP, and returns that ZIP to ChatGPT as base64.

## Tools

The MCP registers these tools:

- `github_actions_pdf_render`
- `github_actions_pdf_ocr`
- `github_actions_pdf_split`
- `github_actions_pdf_merge`
- `github_actions_pdf_metadata`
- `github_actions_image_to_pdf`
- `github_actions_pdf_to_images`
- `github_actions_pdf_searchable`
- `github_actions_pdf_rotate`
- `github_actions_pdf_crop`

All tools accept deterministic input files and operation options:

```json
{
  "files": [
    { "name": "input.pdf", "mimeType": "application/pdf", "base64": "...", "sizeBytes": 12345 }
  ],
  "options": { "dpi": 300 },
  "timeoutSeconds": 300
}
```

## Backend contract

Adding a new operation should require:

1. Add `backend/pdf/<operation>.py` with `run(inputs, output_dir, options)`.
2. Add one MCP tool mapping in `src/tools/github-actions/index.ts`.
3. Optionally add one workflow input or option validation rule.

The Python business logic has no dependency on GitHub Actions. GitHub Actions provisions dependencies and calls `python -m backend.runner`.

## Artifact layout

Artifacts are deterministic and uploaded even on failures when diagnostics exist:

```text
output/
  result.pdf
  page_001.png
  metadata.json
  execution.json
  artifacts.json
  execution.log
```

## Security model

- MCP validates MIME type, base64 syntax, file names, file counts, and file size before dispatch.
- Workflows use least-privilege `contents: read` and `actions: read` permissions.
- The workflow only accepts request files under `.github/runtime-mcp/requests/*.json`.
- Python validates PDF parseability, page counts, DPI, and file sizes before processing.
- Operation names are allow-listed; arbitrary Python execution is not supported.
