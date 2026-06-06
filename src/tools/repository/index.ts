import { z } from "zod";
import type { ToolRegistry } from "../../contracts/tool";

type Env = {
  STATE_KV: KVNamespace;
  GITHUB_OWNER?: string;
  GITHUB_REPO?: string;
  GITHUB_BRANCH?: string;
  GITHUB_TOKEN?: string;
};

type GitHubContent = {
  content?: string;
  encoding?: string;
  html_url?: string;
  path?: string;
  sha?: string;
};

const pathSchema = z
  .string()
  .min(1)
  .max(512)
  .refine(isValidMemoryPath, {
    message: "path must identify a file inside the memory directory"
  })
  .transform(normalizeMemoryPath);

const readSchema = z.object({
  path: pathSchema,
  ref: z.string().min(1).max(255).optional()
});

const saveSchema = z.object({
  path: pathSchema,
  content: z.string().max(1_000_000),
  message: z.string().min(1).max(500).optional(),
  branch: z.string().min(1).max(255).optional()
});

type ReadArgs = z.infer<typeof readSchema>;
type SaveArgs = z.infer<typeof saveSchema>;

class RepositoryError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(
    code: string,
    message: string,
    status = 500
  ) {
    super(message);
    this.name = "RepositoryError";
    this.code = code;
    this.status = status;
  }
}

function pathParts(input: string): string[] {
  return input
    .trim()
    .replaceAll("\\", "/")
    .replace(/^memory\//, "")
    .split("/");
}

function isValidMemoryPath(input: string): boolean {
  const trimmed = input.trim();
  const parts = pathParts(input);

  return Boolean(trimmed) &&
    !trimmed.startsWith("/") &&
    !trimmed.startsWith("\\") &&
    !trimmed.endsWith("/") &&
    !trimmed.endsWith("\\") &&
    parts.every((part) => part && part !== "." && part !== "..");
}

function normalizeMemoryPath(
  input: string
): string {
  return `memory/${pathParts(input).join("/")}`;
}

function repositoryConfig(env: Env) {
  const owner = env.GITHUB_OWNER?.trim();
  const repo = env.GITHUB_REPO?.trim();

  if (!owner || !repo) {
    throw new RepositoryError(
      "REPOSITORY_NOT_CONFIGURED",
      "GITHUB_OWNER and GITHUB_REPO must be configured"
    );
  }

  return {
    owner,
    repo,
    branch: env.GITHUB_BRANCH?.trim() || "main"
  };
}

function encodePath(path: string): string {
  return path
    .split("/")
    .map(encodeURIComponent)
    .join("/");
}

function encodeBase64(value: string): string {
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  const chunkSize = 0x8000;

  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(
      ...bytes.subarray(index, index + chunkSize)
    );
  }

  return btoa(binary);
}

function decodeBase64(value: string): string {
  const binary = atob(value.replace(/\s/g, ""));
  const bytes = Uint8Array.from(binary, (character) =>
    character.charCodeAt(0)
  );

  return new TextDecoder().decode(bytes);
}

async function githubRequest(
  env: Env,
  url: string,
  init?: RequestInit
): Promise<Response> {
  const headers = new Headers(init?.headers);
  headers.set("accept", "application/vnd.github+json");
  headers.set("x-github-api-version", "2022-11-28");
  headers.set("user-agent", "runtime-mcp");

  if (env.GITHUB_TOKEN) {
    headers.set("authorization", `Bearer ${env.GITHUB_TOKEN}`);
  }

  return fetch(url, {
    ...init,
    headers
  });
}

async function githubError(
  response: Response,
  fallback: string
): Promise<RepositoryError> {
  const body = await response.json().catch(() => null) as {
    message?: string;
  } | null;

  return new RepositoryError(
    "GITHUB_API_ERROR",
    body?.message || fallback,
    response.status
  );
}

function contentsUrl(
  owner: string,
  repo: string,
  path: string
): string {
  return `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/${encodePath(path)}`;
}

async function findExistingFile(
  env: Env,
  url: string,
  branch: string
): Promise<GitHubContent | null> {
  const response = await githubRequest(
    env,
    `${url}?ref=${encodeURIComponent(branch)}`
  );

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    throw await githubError(response, "Failed to inspect repository file");
  }

  return response.json() as Promise<GitHubContent>;
}

export function registerRepositoryTools(
  registry: ToolRegistry<Env>
) {
  registry.raw_read = {
    description:
      "Read the raw text of a file from the repository memory folder",

    inputSchema: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description:
            "File path relative to memory/, for example notes/project.md"
        },
        ref: {
          type: "string",
          description: "Optional branch, tag, or commit SHA"
        }
      },
      required: ["path"],
      additionalProperties: false
    },

    validate: (args) => readSchema.parse(args),

    execute: async (rawArgs, { env }) => {
      const args = rawArgs as ReadArgs;

      try {
        const config = repositoryConfig(env);
        const ref = args.ref || config.branch;
        const url = contentsUrl(config.owner, config.repo, args.path);
        const response = await githubRequest(
          env,
          `${url}?ref=${encodeURIComponent(ref)}`
        );

        if (response.status === 404) {
          return {
            ok: true,
            found: false,
            path: args.path,
            ref,
            content: null
          };
        }

        if (!response.ok) {
          throw await githubError(response, "Failed to read repository file");
        }

        const file = await response.json() as GitHubContent;

        if (file.encoding !== "base64" || typeof file.content !== "string") {
          throw new RepositoryError(
            "UNSUPPORTED_REPOSITORY_CONTENT",
            "The requested path is not a readable repository file"
          );
        }

        return {
          ok: true,
          found: true,
          path: file.path || args.path,
          ref,
          sha: file.sha,
          content: decodeBase64(file.content),
          url: file.html_url
        };
      } catch (error) {
        if (error instanceof RepositoryError) {
          return {
            ok: false,
            error: {
              code: error.code,
              message: error.message,
              status: error.status
            }
          };
        }

        throw error;
      }
    }
  };

  registry.raw_save = {
    description:
      "Create or update a raw text file in the repository memory folder",

    inputSchema: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description:
            "File path relative to memory/, for example notes/project.md"
        },
        content: {
          type: "string",
          description: "Complete raw text to save"
        },
        message: {
          type: "string",
          description: "Optional Git commit message"
        },
        branch: {
          type: "string",
          description: "Optional target branch"
        }
      },
      required: ["path", "content"],
      additionalProperties: false
    },

    validate: (args) => saveSchema.parse(args),

    execute: async (rawArgs, { env }) => {
      const args = rawArgs as SaveArgs;

      try {
        if (!env.GITHUB_TOKEN) {
          throw new RepositoryError(
            "GITHUB_TOKEN_REQUIRED",
            "GITHUB_TOKEN must be configured to save repository files"
          );
        }

        const config = repositoryConfig(env);
        const branch = args.branch || config.branch;
        const url = contentsUrl(config.owner, config.repo, args.path);
        const existing = await findExistingFile(env, url, branch);
        const response = await githubRequest(env, url, {
          method: "PUT",
          headers: {
            "content-type": "application/json; charset=utf-8"
          },
          body: JSON.stringify({
            message:
              args.message || `Update ${args.path} through runtime-mcp`,
            content: encodeBase64(args.content),
            branch,
            ...(existing?.sha ? { sha: existing.sha } : {})
          })
        });

        if (!response.ok) {
          throw await githubError(response, "Failed to save repository file");
        }

        const result = await response.json() as {
          commit?: { html_url?: string; sha?: string };
          content?: GitHubContent;
        };

        return {
          ok: true,
          saved: true,
          created: !existing,
          path: result.content?.path || args.path,
          branch,
          sha: result.content?.sha,
          commitSha: result.commit?.sha,
          url: result.content?.html_url,
          commitUrl: result.commit?.html_url
        };
      } catch (error) {
        if (error instanceof RepositoryError) {
          return {
            ok: false,
            error: {
              code: error.code,
              message: error.message,
              status: error.status
            }
          };
        }

        throw error;
      }
    }
  };
}
