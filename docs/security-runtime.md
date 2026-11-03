## Runtime security controls

### Authentication

All externally callable tools are protected by Bearer authentication. The Worker returns HTTP 503 with AUTH_NOT_CONFIGURED when API_KEY is absent, rather than silently disabling authentication.

Set API_KEY as a Cloudflare Worker secret with `wrangler secret put API_KEY`.
For an isolated local development instance only, explicitly set ALLOW_INSECURE_DEV_AUTH=true. Do not set this flag in production.

### Remote file downloads

HTTPS URL inputs are accepted only when the exact hostname appears in FILE_DOWNLOAD_ALLOWED_HOSTS (comma-separated, no wildcards). IP literals, local hostnames, custom ports, non-HTTPS URLs and redirects outside the allowlist are rejected. Downloads use a 15-second default timeout, a 25 MiB streaming byte limit and at most three redirects.

Configure the binding only for domains controlled by the operator:

```toml
[vars]
FILE_DOWNLOAD_ALLOWED_HOSTS = "files.example.com,uploads.example.net"
```

The native Worker fetch interface does not expose a DNS-pinned destination address to this code. The allowlist is therefore a trust boundary: only list hosts whose DNS records and content are controlled by the deployment owner. For high-risk environments, prefer direct base64 uploads over remote URLs.

### Workflow execution

Task graphs are validated for unique identifiers, valid dependencies and cycles before execution. Failed tasks remain separate from completed tasks; their dependents are blocked until retry. Resume validates persisted state and reconstructs failures written by earlier releases from the previous workflow result, repairing checkpoints produced by the old failure/completion bug.

GitHub Actions results must match the exact request id, workflow-dispatch event and configured branch. The backend must finish successfully and publish the request-specific artifact. Artifact downloads are streamed and size-limited; the runtime no longer falls back to an arbitrary artifact from the same run.
