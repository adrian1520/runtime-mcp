# runtime-mcp

A Cloudflare Workers runtime that exposes MCP tools as JSON-RPC methods and as
HTTP endpoints suitable for GPT Actions.

## GPT Actions

Deploy the Worker, then import `https://<your-worker>/openapi.json` into a GPT
Action. Every registered tool is exposed as `POST /tools/<tool-name>`.

When `API_KEY` is configured, send it as a bearer token. Authentication is
disabled when `API_KEY` is unset.

## Repository-backed raw memory

The runtime provides two GPT Action operations for durable text files committed
under this repository's `memory/` directory:

- `raw_save` (`POST /tools/raw_save`) creates or updates a UTF-8 text file.
- `raw_read` (`POST /tools/raw_read`) returns a UTF-8 text file without parsing
  or changing it.

Paths are always relative to `memory/`. For example, a request path of
`projects/runtime.md` accesses `memory/projects/runtime.md`. Absolute paths,
empty segments, and `.` or `..` traversal segments are rejected.

Configure these Cloudflare Worker variables:

```toml
[vars]
GITHUB_OWNER = "your-github-owner"
GITHUB_REPO = "your-repository"
GITHUB_BRANCH = "main"
```

Configure a fine-grained GitHub token with Contents read/write permission as a
secret:

```sh
wrangler secret put GITHUB_TOKEN
```

`raw_read` can read a public repository without `GITHUB_TOKEN`; private
repository reads and all writes require the token. Keep `API_KEY` enabled in
production so untrusted callers cannot commit files through `raw_save`.

### Save example

```json
{
  "path": "projects/runtime.md",
  "content": "# Runtime notes\n\nPersistent context for the GPT.",
  "message": "Update runtime memory"
}
```

### Read example

```json
{
  "path": "projects/runtime.md"
}
```
