import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import {
  CallToolRequestSchema,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  ReadResourceRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { verifyBearer } from "../auth/bearer";
import type { JsonSchema, ToolDefinition } from "../contracts/tool";
import { server, type Env } from "../server";
import { widgetHtml } from "../routes/widget-html";
import {
  getPdfResource,
  pdfProjectContext,
  pdfResources,
} from "../pdf-project/catalog";

const OUTPUT_TEMPLATE = "ui://widget/result.html";

const repositoryQuerySchema: JsonSchema = {
  type: "object",
  properties: {
    query: {
      type: "string",
    },
  },
  required: ["query"],
  additionalProperties: false,
};

const appMetadata = {
  ui: {
    resourceUri: OUTPUT_TEMPLATE,
  },
  "openai/outputTemplate": OUTPUT_TEMPLATE,
  "openai/toolInvocation/invoking": "Querying repository…",
  "openai/toolInvocation/invoked": "Repository result ready",
};

const toolAnnotations: Record<
  string,
  {
    readOnlyHint: boolean;
    destructiveHint: boolean;
    openWorldHint: boolean;
  }
> = {
  memory_put: {
    readOnlyHint: false,
    destructiveHint: false,
    openWorldHint: false,
  },
  memory_get: {
    readOnlyHint: true,
    destructiveHint: false,
    openWorldHint: false,
  },
  memory_exists: {
    readOnlyHint: true,
    destructiveHint: false,
    openWorldHint: false,
  },
  memory_delete: {
    readOnlyHint: false,
    destructiveHint: true,
    openWorldHint: false,
  },
  memory_list: {
    readOnlyHint: true,
    destructiveHint: false,
    openWorldHint: false,
  },
  provenance_append: {
    readOnlyHint: false,
    destructiveHint: false,
    openWorldHint: false,
  },
  provenance_query: {
    readOnlyHint: true,
    destructiveHint: false,
    openWorldHint: false,
  },
  raw_read: {
    readOnlyHint: true,
    destructiveHint: false,
    openWorldHint: false,
  },
  raw_save: {
    readOnlyHint: false,
    destructiveHint: true,
    openWorldHint: true,
  },
  "repository.files": {
    readOnlyHint: true,
    destructiveHint: false,
    openWorldHint: false,
  },
  "repository.read": {
    readOnlyHint: true,
    destructiveHint: false,
    openWorldHint: true,
  },
  "repository.search": {
    readOnlyHint: true,
    destructiveHint: false,
    openWorldHint: false,
  },
  "repository.symbols": {
    readOnlyHint: true,
    destructiveHint: false,
    openWorldHint: false,
  },
  "repository.index": {
    readOnlyHint: true,
    destructiveHint: false,
    openWorldHint: false,
  },
  "repository.dependencies": {
    readOnlyHint: true,
    destructiveHint: false,
    openWorldHint: false,
  },
};

const genericObjectOutputSchema = {
  type: "object" as const,
  additionalProperties: true,
};

function mcpHeaders(headers?: HeadersInit): Headers {
  const result = new Headers(headers);

  result.set("access-control-allow-origin", "*");
  result.set("access-control-allow-methods", "GET, POST, OPTIONS");
  result.set(
    "access-control-allow-headers",
    [
      "content-type",
      "authorization",
      "mcp-protocol-version",
      "mcp-session-id",
      "last-event-id",
    ].join(", "),
  );
  result.set(
    "access-control-expose-headers",
    "mcp-protocol-version, mcp-session-id",
  );
  result.set("cache-control", "no-store");

  return result;
}

function withMcpHeaders(response: Response): Response {
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: mcpHeaders(response.headers),
  });
}

function errorResponse(
  status: number,
  code: number,
  message: string,
): Response {
  return new Response(
    JSON.stringify({
      jsonrpc: "2.0",
      id: null,
      error: {
        code,
        message,
      },
    }),
    {
      status,
      headers: mcpHeaders({
        "content-type": "application/json; charset=utf-8",
      }),
    },
  );
}

function serializedResult(result: unknown): string {
  const serialized = JSON.stringify(result, null, 2);
  return serialized ?? String(result);
}

function resultContent(result: unknown) {
  return {
    ...(result !== null && typeof result === "object" && !Array.isArray(result)
      ? { structuredContent: result as Record<string, unknown> }
      : {}),
    content: [
      {
        type: "text" as const,
        text: serializedResult(result),
      },
    ],
  };
}

async function executeTool(
  tool: ToolDefinition<Env>,
  args: unknown,
  env: Env,
  requestId: string,
) {
  const validated = tool.validate(args);
  return tool.execute(validated, {
    env,
    requestId,
  });
}

async function executeRepositoryQuery(
  args: unknown,
  env: Env,
  requestId: string,
) {
  if (
    args === null ||
    typeof args !== "object" ||
    Array.isArray(args) ||
    Object.keys(args).some((key) => key !== "query") ||
    typeof (args as { query?: unknown }).query !== "string"
  ) {
    throw new Error("arguments must contain only a string query");
  }

  const repositoryReader = server.tools.raw_read;
  if (!repositoryReader) {
    throw new Error("Repository reader is not available");
  }

  return executeTool(
    repositoryReader,
    {
      path: (args as { query: string }).query,
    },
    env,
    requestId,
  );
}

function createMcpServer(env: Env, requestId: string): Server {
  const mcp = new Server(
    {
      name: "repository-worker",
      version: "1.0.0",
    },
    {
      capabilities: {
        resources: {},
        tools: {},
      },
      instructions: [
        "This MCP is a project environment for a production PDF framework.",
        "It exposes PDF upload and processing tools backed by GitHub Actions for heavy PDF operations.",
        `Project context: ${JSON.stringify(pdfProjectContext)}`,
        "Start by reading pdf-framework://skills/build_pdf_framework, pdf-framework://skills/process_pdf, or pdf-framework://skills/extend_framework as appropriate.",
        "Use repository.query to read a repository memory file by path, or call any registered worker tool directly.",
      ].join("\n"),
    },
  );

  mcp.setRequestHandler(ListResourcesRequestSchema, async () => ({
    resources: [
      {
        name: "Repository result widget",
        uri: OUTPUT_TEMPLATE,
        mimeType: "text/html;profile=mcp-app",
      },
      ...pdfResources.map((resource) => ({
        name: resource.name,
        uri: resource.uri,
        mimeType: resource.mimeType,
        description: resource.description,
      })),
    ],
  }));

  mcp.setRequestHandler(ReadResourceRequestSchema, async (request) => {
    if (request.params.uri === OUTPUT_TEMPLATE) {
      return {
        contents: [
          {
            uri: OUTPUT_TEMPLATE,
            mimeType: "text/html;profile=mcp-app",
            text: widgetHtml,
            _meta: {
              ui: {
                prefersBorder: false,
              },
            },
          },
        ],
      };
    }

    const pdfResource = getPdfResource(request.params.uri);
    if (!pdfResource) {
      throw new Error(`Unknown resource: ${request.params.uri}`);
    }

    return {
      contents: [
        {
          uri: pdfResource.uri,
          mimeType: pdfResource.mimeType,
          text: pdfResource.text,
        },
      ],
    };
  });

  mcp.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: [
      {
        name: "repository.query",
        title: "Query repository",
        description: "Execute repository worker request",
        inputSchema: repositoryQuerySchema,
        outputSchema: genericObjectOutputSchema,
        annotations: {
          readOnlyHint: true,
          destructiveHint: false,
          openWorldHint: true,
        },
        _meta: appMetadata,
      },
      ...Object.entries(server.tools).map(([name, tool]) => ({
        name,
        title: name.replaceAll("_", " "),
        description: tool.description,
        inputSchema: tool.inputSchema,
        outputSchema: tool.outputSchema ?? genericObjectOutputSchema,
        annotations: toolAnnotations[name] ?? {
          readOnlyHint: false,
          destructiveHint: false,
          openWorldHint: true,
        },
      })),
    ],
  }));

  mcp.setRequestHandler(CallToolRequestSchema, async (request) => {
    try {
      const result =
        request.params.name === "repository.query"
          ? await executeRepositoryQuery(
              request.params.arguments ?? {},
              env,
              requestId,
            )
          : await (async () => {
              const tool = server.tools[request.params.name];
              if (!tool) {
                throw new Error(`Unknown tool: ${request.params.name}`);
              }

              return executeTool(
                tool,
                request.params.arguments ?? {},
                env,
                requestId,
              );
            })();

      return resultContent(result);
    } catch (error) {
      return {
        isError: true,
        content: [
          {
            type: "text" as const,
            text:
              error instanceof Error ? error.message : "Tool execution failed",
          },
        ],
      };
    }
  });

  return mcp;
}

export async function handleMcpRoute(
  request: Request,
  env: Env,
  requestId: string,
): Promise<Response | null> {
  const url = new URL(request.url);
  if (url.pathname !== "/mcp") {
    return null;
  }

  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: mcpHeaders(),
    });
  }

  if (request.method !== "GET" && request.method !== "POST") {
    return errorResponse(405, -32000, "Method not allowed");
  }

  const auth = verifyBearer(request, env.API_KEY);
  if (!auth.ok) {
    return errorResponse(auth.status, -32001, auth.message);
  }

  if (request.method === "GET") {
    return errorResponse(
      405,
      -32000,
      "SSE notifications are not available in stateless mode",
    );
  }

  const transport = new WebStandardStreamableHTTPServerTransport({
    enableJsonResponse: true,
  });
  const mcp = createMcpServer(env, requestId);

  await mcp.connect(transport);

  return withMcpHeaders(await transport.handleRequest(request));
}
