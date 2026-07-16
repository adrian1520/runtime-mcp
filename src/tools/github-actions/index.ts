import { z } from "zod";
import type { ToolRegistry } from "../../contracts/tool";
import {
  bytesToBase64,
  fileReferenceJsonSchema,
  fileReferenceSchema,
  normalizeUploadedFile,
  validateUploadedFile,
  type UploadedFile,
} from "../../files/uploaded-file.js";

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

const TOOL_OPERATIONS: Record<
  string,
  {
    operation: Operation;
    description: string;
    minFiles?: number;
    allowedMimeTypes?: string[];
  }
> = {
  render_pdf: {
    operation: "render",
    description:
      "Render pages from an uploaded PDF into image files using the GitHub Actions PDF backend.",
  },
  ocr_pdf: {
    operation: "ocr",
    description:
      "Run OCR on an uploaded PDF using the GitHub Actions PDF backend and return the result artifact.",
  },
  split_pdf: {
    operation: "split",
    description:
      "Split an uploaded PDF into separate PDF files according to the supplied options.",
  },
  merge_pdfs: {
    operation: "merge",
    minFiles: 2,
    description: "Merge two or more uploaded PDF files into one PDF.",
  },
  rotate_pdf: {
    operation: "rotate",
    description:
      "Rotate pages in an uploaded PDF according to the supplied options.",
  },
  crop_pdf: {
    operation: "crop",
    description:
      "Crop pages in an uploaded PDF according to the supplied options.",
  },
  searchable_pdf: {
    operation: "searchable",
    description:
      "Create a searchable PDF from an uploaded PDF by applying OCR text.",
  },
  pdf_metadata: {
    operation: "metadata",
    description: "Extract metadata from an uploaded PDF.",
  },
  pdf_to_images: {
    operation: "pdf_to_images",
    description: "Convert pages from an uploaded PDF into image files.",
  },
  images_to_pdf: {
    operation: "image_to_pdf",
    allowedMimeTypes: ["image/png", "image/jpeg", "image/tiff", "image/webp"],
    description:
      "Convert one or more uploaded image files (PNG, JPEG, TIFF, or WebP) into a PDF.",
  },
};

const MAX_POLL_SECONDS = 540;
const WORKFLOW_ID = "runtime-pdf-backend.yml";
const REQUEST_ROOT = ".github/runtime-mcp/requests";
const POLL_INTERVAL_MS = 3_000;

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

const actionRequestSchema = z.object({
  files: z.array(fileReferenceSchema).min(1).max(20),
  options: z.record(z.unknown()).optional().default({}),
  timeoutSeconds: z
    .number()
    .int()
    .min(30)
    .max(MAX_POLL_SECONDS)
    .optional()
    .default(300),
});

const uploadPdfRequestSchema = z.object({
  file: fileReferenceSchema,
});

type RawActionRequest = z.infer<typeof actionRequestSchema>;
type ActionFile = {
  name: string;
  mimeType: string;
  base64: string;
  sizeBytes: number;
};
type ActionRequest = Omit<RawActionRequest, "files"> & { files: ActionFile[] };

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

function toActionFile(file: UploadedFile): ActionFile {
  return {
    name: file.filename,
    mimeType: file.mimeType,
    base64: bytesToBase64(file.bytes),
    sizeBytes: file.size,
  };
}

export async function normalizeActionRequest(
  args: RawActionRequest,
  allowedMimeTypes = ["application/pdf"],
): Promise<ActionRequest> {
  const files = await Promise.all(
    args.files.map((file, index) => normalizeUploadedFile(file, index)),
  );
  for (const file of files)
    validateUploadedFile(
      {
        filename: file.filename,
        mimeType: file.mimeType,
        bytes: file.bytes,
        declaredSize: file.size,
      },
      allowedMimeTypes,
    );
  return { ...args, files: files.map(toActionFile) };
}

export async function normalizePdfUpload(
  args: z.infer<typeof uploadPdfRequestSchema>,
) {
  const file = await normalizeUploadedFile(args.file, 0);
  validateUploadedFile({
    filename: file.filename,
    mimeType: file.mimeType,
    bytes: file.bytes,
    declaredSize: file.size,
  });
  return {
    id: file.id,
    filename: file.filename,
    mimeType: file.mimeType,
    size: file.size,
    source: file.source,
    base64: bytesToBase64(file.bytes),
  };
}

function config(env: Env) {
  const owner = env.GITHUB_OWNER?.trim();
  const repo = env.GITHUB_REPO?.trim();
  const token = env.GITHUB_TOKEN?.trim();
  if (!owner || !repo || !token)
    throw new GitHubActionsError(
      "GITHUB_ACTIONS_NOT_CONFIGURED",
      "GITHUB_OWNER, GITHUB_REPO, and GITHUB_TOKEN are required",
    );
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
  if (!response.ok)
    throw await githubError(response, `GitHub API request failed: ${path}`);
  return response.json() as Promise<T>;
}

function encodePath(path: string): string {
  return path.split("/").map(encodeURIComponent).join("/");
}
function utf8Base64(value: string): string {
  return bytesToBase64(new TextEncoder().encode(value));
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
  const response = await github(
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
  );
  if (response.status !== 204)
    throw await githubError(response, "Failed to dispatch workflow");
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
  return bytesToBase64(new Uint8Array(await response.arrayBuffer()));
}

async function executeOperation(
  operation: Operation,
  args: RawActionRequest,
  env: Env,
  requestId: string,
  allowedMimeTypes: string[],
  minFiles: number,
) {
  const normalizedArgs = await normalizeActionRequest(args, allowedMimeTypes);
  if (normalizedArgs.files.length < minFiles)
    throw new GitHubActionsError(
      "INVALID_INPUT",
      `${operation} requires at least ${minFiles} file(s)`,
      400,
    );
  const actionRequestId = `${requestId}-${crypto.randomUUID()}`;
  const requestPath = await putRequest(env, actionRequestId, {
    operation,
    requestId: actionRequestId,
    files: normalizedArgs.files,
    options: normalizedArgs.options,
  });
  await dispatch(env, operation, requestPath, actionRequestId);
  const run = await pollRun(
    env,
    actionRequestId,
    normalizedArgs.timeoutSeconds,
  );
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

const actionInputSchema = {
  type: "object",
  properties: {
    files: {
      type: "array",
      minItems: 1,
      maxItems: 20,
      items: fileReferenceJsonSchema,
    },
    options: { type: "object", additionalProperties: true },
    timeoutSeconds: { type: "integer", minimum: 30, maximum: MAX_POLL_SECONDS },
  },
  required: ["files"],
  additionalProperties: false,
} as const;
const uploadInputSchema = {
  type: "object",
  properties: { file: fileReferenceJsonSchema },
  required: ["file"],
  additionalProperties: false,
} as const;
const actionOutputSchema = {
  type: "object",
  properties: {
    ok: { type: "boolean" },
    requestId: { type: "string" },
    operation: { type: "string" },
    workflow: { type: "object", additionalProperties: true },
    artifact: { type: "object", additionalProperties: true },
  },
  required: ["ok", "requestId", "operation", "artifact"],
  additionalProperties: true,
} as const;
const uploadOutputSchema = {
  type: "object",
  properties: {
    id: { type: "string" },
    filename: { type: "string" },
    mimeType: { type: "string" },
    size: { type: "integer" },
    source: { type: "string" },
    base64: { type: "string" },
  },
  required: ["id", "filename", "mimeType", "size", "source", "base64"],
  additionalProperties: false,
} as const;

export function registerGitHubActionsTools(registry: ToolRegistry<Env>) {
  registry.upload_pdf = {
    description:
      "Validate a ChatGPT-uploaded PDF, normalize it into the runtime UploadedFile model, and return a reusable base64 PDF payload for other PDF tools.",
    inputSchema: uploadInputSchema,
    outputSchema: uploadOutputSchema,
    validate: (args) => uploadPdfRequestSchema.parse(args),
    execute: (args) => normalizePdfUpload(args),
  };

  for (const [name, definition] of Object.entries(TOOL_OPERATIONS)) {
    registry[name] = {
      description:
        definition.description +
        " Inputs are ChatGPT file uploads/MCP file objects, base64 file objects, readable paths, file:// URIs, or HTTPS download_url values.",
      inputSchema: actionInputSchema,
      outputSchema: actionOutputSchema,
      validate: (args) => actionRequestSchema.parse(args),
      execute: (args, { env, requestId }) =>
        executeOperation(
          definition.operation,
          args,
          env,
          requestId,
          definition.allowedMimeTypes ?? ["application/pdf"],
          definition.minFiles ?? 1,
        ),
    };
  }
}
