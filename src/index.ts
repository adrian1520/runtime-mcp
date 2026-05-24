import { server } from "./server";

type Env = {
  STATE_KV: KVNamespace;
};

type ToolCallBody = {
  name: string;
  arguments?: unknown;
};

function json(
  data: unknown,
  init?: ResponseInit
): Response {

  return new Response(
    JSON.stringify(data, null, 2),
    {
      headers: {
        "content-type":
          "application/json; charset=utf-8",

        "cache-control":
          "no-store",

        "access-control-allow-origin": "*",

        "access-control-allow-methods":
          "GET, POST, OPTIONS",

        "access-control-allow-headers":
          "content-type"
      },

      ...init
    }
  );
}

function createRequestId(): string {
  return crypto.randomUUID();
}

function createToolManifest() {

  return Object.entries(server.tools).map(
    ([name, tool]) => ({
      name,
      description: tool.description,
      inputSchema: tool.inputSchema
    })
  );
}

export default {

  async fetch(
    request: Request,
    env: Env,
    ctx: ExecutionContext
  ): Promise<Response> {

    const requestId = createRequestId();

    const url = new URL(request.url);

    try {

      if (request.method === "OPTIONS") {
        return new Response(null, {
          status: 204,
          headers: {
            "access-control-allow-origin": "*",
            "access-control-allow-methods":
              "GET, POST, OPTIONS",
            "access-control-allow-headers":
              "content-type"
          }
        });
      }

      /*
       * HEALTH
       */

      if (
        url.pathname === "/health"
      ) {

        return json({
          ok: true,
          service: "runtime-mcp",
          version: "1.0.0",
          ts: Date.now(),
          requestId
        });
      }

      /*
       * MCP MANIFEST
       */

      if (
        url.pathname === "/mcp" &&
        request.method === "GET"
      ) {

        return json({
          name: "runtime-mcp",
          version: "1.0.0",

          capabilities: {
            tools: true,
            kv: true,
            provenance: true
          },

          tools: createToolManifest(),

          ts: Date.now(),
          requestId
        });
      }

      /*
       * TOOLS LIST
       */

      if (
        url.pathname === "/mcp/tools" &&
        request.method === "GET"
      ) {

        return json({
          tools: createToolManifest(),
          requestId
        });
      }

      /*
       * TOOL CALL
       */

      if (
        url.pathname === "/mcp/call" &&
        request.method === "POST"
      ) {

        let body: ToolCallBody;

        try {

          body =
            await request.json();

        } catch {

          return json(
            {
              ok: false,
              error: {
                code: "INVALID_JSON",
                message:
                  "Request body must be valid JSON"
              },
              requestId
            },
            {
              status: 400
            }
          );
        }

        if (
          !body ||
          typeof body.name !== "string"
        ) {

          return json(
            {
              ok: false,
              error: {
                code: "INVALID_TOOL_NAME",
                message:
                  "Tool name is required"
              },
              requestId
            },
            {
              status: 400
            }
          );
        }

        const tool =
          server.tools[body.name];

        if (!tool) {

          return json(
            {
              ok: false,
              error: {
                code: "TOOL_NOT_FOUND",
                message:
                  `Unknown tool: ${body.name}`
              },
              requestId
            },
            {
              status: 404
            }
          );
        }

        try {

          const validated =
            tool.validate(
              body.arguments ?? {}
            );

          const result =
            await tool.execute(
              validated,
              {
                env,
                requestId
              }
            );

          return json({
            ok: true,
            tool: body.name,
            result,
            requestId,
            ts: Date.now()
          });

        } catch (error: any) {

          return json(
            {
              ok: false,
              error: {
                code:
                  "TOOL_EXECUTION_FAILED",

                message:
                  error?.message ??
                  "Unknown execution error"
              },

              tool: body.name,
              requestId,
              ts: Date.now()
            },
            {
              status: 500
            }
          );
        }
      }

      /*
       * NOT FOUND
       */

      return json(
        {
          ok: false,
          error: {
            code: "NOT_FOUND",
            message:
              "Endpoint not found"
          },
          requestId
        },
        {
          status: 404
        }
      );

    } catch (error: any) {

      return json(
        {
          ok: false,
          error: {
            code:
              "INTERNAL_SERVER_ERROR",

            message:
              error?.message ??
              "Unexpected runtime error"
          },

          requestId,
          ts: Date.now()
        },
        {
          status: 500
        }
      );
    }
  }
};