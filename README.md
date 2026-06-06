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

## Streamable HTTP MCP endpoint

The Worker also exposes a standards-based MCP endpoint at:

```text
https://domain.example/mcp
```

`POST /mcp` handles MCP initialization, discovery, resource reads, and tool
calls. `GET /mcp` is present for Streamable HTTP compatibility and returns the
protocol-standard `405` response because this stateless server does not emit
server-initiated SSE notifications. The stateless transport is a good fit for
Cloudflare Workers and does not require an in-memory session to remain on one
isolate.

The MCP adapter is additive. Existing `/tools/*`, `/resources*`, `/mcp/rpc`,
`/openapi.json`, and `/health` behavior is unchanged. Every tool already in the
worker registry is advertised through MCP and executes the same `validate` and
`execute` functions used by the existing HTTP API.

### Repository adapter tool

In addition to the registered worker tools, MCP discovery includes:

```json
{
  "name": "repository.query",
  "description": "Execute repository worker request",
  "inputSchema": {
    "type": "object",
    "properties": {
      "query": {
        "type": "string"
      }
    },
    "required": ["query"],
    "additionalProperties": false
  }
}
```

`repository.query` is a thin adapter over the existing `raw_read` worker tool.
Its `query` value is the path relative to `memory/`; for example,
`{"query":"projects/runtime.md"}` executes the same repository read as
`raw_read` with `{"path":"projects/runtime.md"}`. The original worker result is
returned unchanged as MCP `structuredContent` and as JSON text content.

### Local usage

Install dependencies and start the Worker:

```sh
npm install
npm run dev
```

Initialize the MCP connection:

```sh
curl http://localhost:8787/mcp \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json, text/event-stream' \
  --data '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "initialize",
    "params": {
      "protocolVersion": "2025-11-25",
      "capabilities": {},
      "clientInfo": { "name": "local-test", "version": "1.0.0" }
    }
  }'
```

Discover tools:

```sh
curl http://localhost:8787/mcp \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json, text/event-stream' \
  -H 'MCP-Protocol-Version: 2025-11-25' \
  --data '{
    "jsonrpc": "2.0",
    "id": 2,
    "method": "tools/list",
    "params": {}
  }'
```

Call the repository adapter:

```sh
curl http://localhost:8787/mcp \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json, text/event-stream' \
  -H 'MCP-Protocol-Version: 2025-11-25' \
  --data '{
    "jsonrpc": "2.0",
    "id": 3,
    "method": "tools/call",
    "params": {
      "name": "repository.query",
      "arguments": { "query": "projects/runtime.md" }
    }
  }'
```

When `API_KEY` is configured, add `Authorization: Bearer <API_KEY>` to MCP
requests just as for the existing protected API. For a ChatGPT connector,
configure compatible connector authentication before exposing write-capable
tools; for an unauthenticated development deployment, leave `API_KEY` unset.

### Connect from ChatGPT

1. Deploy the Worker to an HTTPS URL.
2. In ChatGPT, enable developer mode under **Settings → Apps & Connectors →
   Advanced settings** (subject to organization policy).
3. Choose **Create** under **Settings → Apps & Connectors**.
4. Enter a name and description, then use the public connector URL:

   ```text
   https://domain.example/mcp
   ```

5. Create or refresh the connector and verify that `repository.query` and the
   worker's registered tools appear in discovery.

For local development, expose `http://localhost:8787/mcp` through an HTTPS
tunnel before adding it to ChatGPT.

### Apps SDK compatibility

The `repository.query` descriptor includes both the MCP Apps standard
`_meta.ui.resourceUri` field and the ChatGPT compatibility alias:

```json
{
  "_meta": {
    "ui": {
      "resourceUri": "ui://widget/result.html"
    },
    "openai/outputTemplate": "ui://widget/result.html"
  }
}
```

The same MCP server exposes `ui://widget/result.html` as a
`text/html;profile=mcp-app` resource. It is intentionally a small generic JSON
result view that can be replaced by a richer widget later without changing the
worker execution layer. Tool results include model-visible `structuredContent`
and text content, while all tool calls continue to use the existing worker
implementations.
