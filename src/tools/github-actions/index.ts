import { z } from "zod";
import type { ToolRegistry } from "../../contracts/tool";

type Env = {
  STATE_KV: KVNamespace;
  GITHUB_OWNER?: string;
  GITHUB_REPO?: string;
  GITHUB_BRANCH?: string;
  GITHUB_TOKEN?: string;
};

type Operation =
  | "render"
  | "ocr"
  | "split"
  | "merge"
  | "metadata"
  | "image_to_pdf"
  | "pdf_to_images"
  | "searchable"
  | "rotate"
  | "crop";

const OPERATIONS: Record<string, Operation> = {
  github_actions_pdf_render: "render",
  github_actions_pdf_ocr: "ocr",
  github_actions_pdf_split: "split",
  github_actions_pdf_merge: "merge",
  github_actions_pdf_metadata: "metadata",
  github_actions_image_to_pdf: "image_to_pdf",
  github_actions_pdf_to_images: "pdf_to_images",
  github_actions_pdf_searchable: "searchable",
  github_actions_pdf_rotate: "rotate",
  github_actions_pdf_crop: "crop",
};

const MAX_FILE_BYTES = 25 * 1024 * 1024;
const WORKFLOW_ID = "runtime-pdf-backend.yml";
const REQUEST_ROOT = ".github/runtime-mcp/requests";
const POLL_INTERVAL_MS = 3_000;
const MAX_POLL_SECONDS = 540;

class GitHubActionsError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status = 500,
  ) {
    super(message);
    this.name = "GitHubActionsError";
  }
}

const inputFileSchema = z.object({
  name: z
    .string()
    .min(1)
    .max(160)
    .regex(/^[A-Za-z0-9._-]+$/),
  mimeType: z.string().min(3).max(100),
  base64: z.string().min(1),
  sizeBytes: z.number().int().min(1).max(MAX_FILE_BYTES).optional(),
});

const actionRequestSchema = z.object({
  files: z.array(inputFileSchema).min(1).max(20),
  options: z.record(z.unknown()).optional().default({}),
  timeoutSeconds: z
    .number()
    .int()
    .min(30)
    .max(MAX_POLL_SECONDS)
    .optional()
    .default(300),
});

type ActionRequest = z.infer<typeof actionRequestSchema>;

type GitHubContent = { sha?: string };
type WorkflowRun = {
  id: number;
  status: "queued" | "in_progress" | "completed" | string;
  conclusion?: string | null;
  html_url?: string;
  display_title?: string;
  name?: string;
};
type Artifact = {
  id: number;
  name: string;
  size_in_bytes: number;
  archive_download_url: string;
  expired: boolean;
};

function validateBase64(input: string): number {
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(input.replace(/\s/g, ""))) {
    throw new GitHubActionsError(
      "INVALID_BASE64",
      "File content must be base64 encoded",
      400,
    );
  }
  return Math.floor((input.replace(/\s/g, "").length * 3) / 4);
}

function validateFiles(args: ActionRequest, operation: Operation): void {
  const allowed =
    operation === "image_to_pdf"
      ? ["image/png", "image/jpeg", "image/tiff", "image/webp"]
      : ["application/pdf"];
  for (const file of args.files) {
    const decodedBytes = validateBase64(file.base64);
    const sizeBytes = file.sizeBytes ?? decodedBytes;
    if (sizeBytes > MAX_FILE_BYTES) {
      throw new GitHubActionsError(
        "FILE_TOO_LARGE",
        `${file.name} exceeds ${MAX_FILE_BYTES} bytes`,
        400,
      );
    }
    if (!allowed.includes(file.mimeType)) {
      throw new GitHubActionsError(
        "INVALID_MIME_TYPE",
        `${file.name} must be one of: ${allowed.join(", ")}`,
        400,
      );
    }
  }
  if (operation === "merge" && args.files.length < 2) {
    throw new GitHubActionsError(
      "INVALID_INPUT",
      "PDF merge requires at least two PDF files",
      400,
    );
  }
}

function config(env: Env) {
  const owner = env.GITHUB_OWNER?.trim();
  const repo = env.GITHUB_REPO?.trim();
  const token = env.GITHUB_TOKEN?.trim();
  if (!owner || !repo || !token) {
    throw new GitHubActionsError(
      "GITHUB_ACTIONS_NOT_CONFIGURED",
      "GITHUB_OWNER, GITHUB_REPO, and GITHUB_TOKEN are required",
    );
  }
  return { owner, repo, token, branch: env.GITHUB_BRANCH?.trim() || "main" };
}

async function github(
  env: Env,
  path: string,
  init?: RequestInit,
): Promise<Response> {
  const cfg = config(env);
  const headers = new Headers(init?.headers);
  headers.set("accept", "application/vnd.github+json");
  headers.set("authorization", `Bearer ${cfg.token}`);
  headers.set("x-github-api-version", "2022-11-28");
  headers.set("user-agent", "runtime-mcp-github-actions");
  return fetch(
    `https://api.github.com/repos/${encodeURIComponent(cfg.owner)}/${encodeURIComponent(cfg.repo)}${path}`,
    { ...init, headers },
  );
}

async function githubJson<T>(
  env: Env,
  path: string,
  init?: RequestInit,
): Promise<T> {
  const response = await github(env, path, init);
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as {
      message?: string;
    } | null;
    throw new GitHubActionsError(
      "GITHUB_API_ERROR",
      body?.message || `GitHub API request failed: ${path}`,
      response.status,
    );
  }
  return response.json() as Promise<T>;
}

function encodePath(path: string): string {
  return path.split("/").map(encodeURIComponent).join("/");
}

function utf8Base64(value: string): string {
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000)
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
}

async function putRequest(
  env: Env,
  requestId: string,
  body: unknown,
): Promise<string> {
  const cfg = config(env);
  const path = `${REQUEST_ROOT}/${requestId}.json`;
  await githubJson(env, `/contents/${encodePath(path)}`, {
    method: "PUT",
    headers: { "content-type": "application/json; charset=utf-8" },
    body: JSON.stringify({
      message: `runtime-mcp request ${requestId}`,
      branch: cfg.branch,
      content: utf8Base64(JSON.stringify(body, null, 2)),
    }),
  });
  return path;
}

async function dispatch(
  env: Env,
  operation: Operation,
  requestPath: string,
  requestId: string,
): Promise<void> {
  const cfg = config(env);
  await github(
    env,
    `/actions/workflows/${encodeURIComponent(WORKFLOW_ID)}/dispatches`,
    {
      method: "POST",
      headers: { "content-type": "application/json; charset=utf-8" },
      body: JSON.stringify({
        ref: cfg.branch,
        inputs: { operation, request_path: requestPath, request_id: requestId },
      }),
    },
  ).then(async (response) => {
    if (response.status !== 204)
      throw await githubError(response, "Failed to dispatch workflow");
  });
}

async function githubError(
  response: Response,
  fallback: string,
): Promise<GitHubActionsError> {
  const body = (await response.json().catch(() => null)) as {
    message?: string;
  } | null;
  return new GitHubActionsError(
    "GITHUB_API_ERROR",
    body?.message || fallback,
    response.status,
  );
}

async function pollRun(
  env: Env,
  requestId: string,
  timeoutSeconds: number,
): Promise<WorkflowRun> {
  const deadline = Date.now() + timeoutSeconds * 1000;
  let run: WorkflowRun | null = null;
  while (Date.now() < deadline) {
    const runs = await githubJson<{ workflow_runs: WorkflowRun[] }>(
      env,
      `/actions/workflows/${encodeURIComponent(WORKFLOW_ID)}/runs?event=workflow_dispatch&per_page=30`,
    );
    run =
      runs.workflow_runs.find((candidate) =>
        candidate.display_title?.includes(requestId),
      ) ?? run;
    if (run?.status === "completed") return run;
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }
  throw new GitHubActionsError(
    "WORKFLOW_TIMEOUT",
    `Workflow did not complete within ${timeoutSeconds} seconds`,
    504,
  );
}

async function artifacts(env: Env, runId: number): Promise<Artifact[]> {
  const result = await githubJson<{ artifacts: Artifact[] }>(
    env,
    `/actions/runs/${runId}/artifacts`,
  );
  return result.artifacts.filter((artifact) => !artifact.expired);
}

async function downloadArtifactZip(
  env: Env,
  artifact: Artifact,
): Promise<string> {
  const response = await github(env, `/actions/artifacts/${artifact.id}/zip`);
  if (!response.ok)
    throw await githubError(
      response,
      `Failed to download artifact ${artifact.name}`,
    );
  const bytes = new Uint8Array(await response.arrayBuffer());
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000)
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
}

async function executeOperation(
  operation: Operation,
  args: ActionRequest,
  env: Env,
  requestId: string,
) {
  validateFiles(args, operation);
  const actionRequestId = `${requestId}-${crypto.randomUUID()}`;
  const requestPath = await putRequest(env, actionRequestId, {
    operation,
    requestId: actionRequestId,
    files: args.files,
    options: args.options,
  });
  await dispatch(env, operation, requestPath, actionRequestId);
  const run = await pollRun(env, actionRequestId, args.timeoutSeconds);
  const foundArtifacts = await artifacts(env, run.id);
  const resultArtifact =
    foundArtifacts.find(
      (artifact) => artifact.name === `runtime-mcp-${actionRequestId}`,
    ) ?? foundArtifacts[0];
  if (!resultArtifact)
    throw new GitHubActionsError(
      "ARTIFACT_NOT_FOUND",
      "Workflow completed but did not publish artifacts",
    );
  const artifactZipBase64 = await downloadArtifactZip(env, resultArtifact);
  return {
    ok: run.conclusion === "success",
    requestId: actionRequestId,
    operation,
    workflow: run,
    artifact: {
      name: resultArtifact.name,
      sizeBytes: resultArtifact.size_in_bytes,
      zipBase64: artifactZipBase64,
    },
  };
}

const schema = {
  type: "object",
  properties: {
    files: { type: "array", items: { type: "object" } },
    options: { type: "object", additionalProperties: true },
    timeoutSeconds: { type: "integer" },
  },
  required: ["files"],
  additionalProperties: false,
} as const;

export function registerGitHubActionsTools(registry: ToolRegistry<Env>) {
  for (const [name, operation] of Object.entries(OPERATIONS)) {
    registry[name] = {
      description: `Run PDF ${operation} in GitHub Actions. The MCP only validates, uploads inputs, dispatches, polls, and returns the artifact zip; all heavy processing runs in Python on GitHub-hosted runners.`,
      inputSchema: schema,
      validate: (args) => actionRequestSchema.parse(args),
      execute: (args, { env, requestId }) =>
        executeOperation(operation, args, env, requestId),
    };
  }
}
