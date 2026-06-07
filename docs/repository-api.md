# Repository REST API

## GET /repository/tree

Query params:
- path (optional)
- recursive (optional, default=false)

Response:
{
  "path": "src",
  "entries": [
    {
      "name": "index.ts",
      "path": "src/index.ts",
      "type": "file"
    }
  ]
}

## GET /repository/file

Query params:
- path (required)

Response:
{
  "path": "src/index.ts",
  "content": "...",
  "sha": "..."
}

Implementation should use GitHub Contents API for directory listing and file retrieval and expose endpoints for GPT Actions.