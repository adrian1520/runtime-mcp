import { server } from "./server";

type Env = {
  STATE_KV: KVNamespace;
  API_KEY?: string;
};

type ToolCallBody = {
  name: string;
  arguments?: unknown;
};

type JsonRpcRequest = {
  jsonrpc: "2.0";
  id?: string | number | null;
  method: string;
  params?: any;
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
          "content-type, authorization",

        "x-runtime":
          "runtime-mcp"
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

function unauthorized(
  requestId: string
): Response {

  return json(
    {
      ok: false,
      error: {
        code: "UNAUTHORIZED",
        message:
          "Invalid or missing API key"
      },
      requestId,
      ts: Date.now()
    },
    {
      status: 401
    }
  );
}

function verifyAuth(
  request: Request,
  env: Env
): boolean {

  if (!env.API_KEY) {
    return true;
  }

  const auth =
    request.headers.get(
      "authorization"
    );

  if (!auth) {
    return false;
  }

  return auth ===
    `Bearer ${env.API_KEY}`;
}

function jsonRpcResponse(
  id: string | number | null | undefined,
  result: unknown
) {

  return {
    jsonrpc: "2.0",
    id: id ?? null,
    result
  };
}

function jsonRpcError(
  id: string | number | null | undefined,
  code: number,
  message: string
) {

  return {
    jsonrpc: "2.0",
    id: id ?? null,
    error: {
      code,
      message
    }
  };
}

export default {

  async fetch(
    request: Request,
    env: Env,
    ctx: ExecutionContext
  ): Promise<Response> {

    const requestId =
      createRequestId();

    const url =
      new URL(request.url);

    try {

      /*
       * CORS
       */

      if (
        request.method ===
        "OPTIONS"
      ) {

        return new Response(
          null,
          {
            status: 204,
            headers: {
              "access-control-allow-origin":
                "*",

              "access-control-allow-methods":
                "GET, POST, OPTIONS",

              "access-control-allow-headers":
                "content-type, authorization"
            }
          }
        );
      }

      /*
       * HEALTH
       */

      if (
        url.pathname ===
        "/health"
      ) {

        return json({
          ok: true,
          service: "runtime-mcp",
          version: "1.0.0",
          runtime: "cloudflare-workers",
          ts: Date.now(),
          requestId
        });
      }

      /*
       * OPENAPI
       */

      if (
        url.pathname ===
          "/openapi.json" &&
        request.method ===
          "GET"
      ) {

        return json({
          openapi: "3.1.0",

          info: {
            title:
              "runtime-mcp",

            version: "1.0.0",

            description:
              "Production MCP-compatible edge runtime"
          },

          servers: [
            {
              url:
                `${url.protocol}//${url.host}`
            }
          ],

          paths: {

            "/mcp/call": {

              post: {

                operationId:
                  "callTool",

                summary:
                  "Execute runtime tool",

                requestBody: {

                  required: true,

                  content: {

                    "application/json": {

                      schema: {

                        type:
                          "object",

                        properties: {

                          name: {
                            type:
                              "string"
                          },

                          arguments:
                            {
                              type:
                                "object"
                            }
                        },

                        required:
                          [
                            "name"
                          ]
                      }
                    }
                  }
                },

                responses: {

                  "200": {

                    description:
                      "Tool execution result"
                  }
                }
              }
            }
          }
        });
      }

      /*
       * MCP MANIFEST
       */

      if (
        url.pathname ===
          "/mcp" &&
        request.method ===
          "GET"
      ) {

        return json({
          name:
            "runtime-mcp",

          version:
            "1.0.0",

          protocol:
            "mcp-compatible",

          capabilities: {
            tools: true,
            kv: true,
            provenance: true
          },

          tools:
            createToolManifest(),

          ts: Date.now(),
          requestId
        });
      }

      /*
       * TOOLS LIST
       */

      if (
        url.pathname ===
          "/mcp/tools" &&
        request.method ===
          "GET"
      ) {

        return json({
          tools:
            createToolManifest(),

          count:
            createToolManifest()
              .length,

          requestId,
          ts: Date.now()
        });
      }

      /*
       * JSON-RPC MCP
       */

      if (
        url.pathname ===
          "/mcp/rpc" &&
        request.method ===
          "POST"
      ) {

        if (
          !verifyAuth(
            request,
            env
          )
        ) {

          return unauthorized(
            requestId
          );
        }

        let rpcBody:
          JsonRpcRequest;

        try {

          rpcBody =
            await request.json();

        } catch {

          return json(
            jsonRpcError(
              null,
              -32700,
              "Parse error"
            ),
            {
              status: 400
            }
          );
        }

        if (
          rpcBody.method ===
          "tools/list"
        ) {

          return json(
            jsonRpcResponse(
              rpcBody.id,
              {
                tools:
                  createToolManifest()
              }
            )
          );
        }

        if (
          rpcBody.method ===
          "tools/call"
        ) {

          const toolName =
            rpcBody.params
              ?.name;

          const args =
            rpcBody.params
              ?.arguments ?? {};

          const tool =
            server.tools[
              toolName
            ];

          if (!tool) {

            return json(
              jsonRpcError(
                rpcBody.id,
                -32601,
                `Unknown tool: ${toolName}`
              ),
              {
                status: 404
              }
            );
          }

          try {

            const validated =
              tool.validate(
                args
              );

            const result =
              await tool.execute(
                validated,
                {
                  env,
                  requestId
                }
              );

            return json(
              jsonRpcResponse(
                rpcBody.id,
                result
              )
            );

          } catch (
            error: any
          ) {

            return json(
              jsonRpcError(
                rpcBody.id,
                -32000,
                error?.message ??
                  "Tool execution failed"
              ),
              {
                status: 500
              }
            );
          }
        }

        return json(
          jsonRpcError(
            rpcBody.id,
            -32601,
            "Method not found"
          ),
          {
            status: 404
          }
        );
      }

      /*
       * SIMPLE TOOL CALL
       */

      if (
        url.pathname ===
          "/mcp/call" &&
        request.method ===
          "POST"
      ) {

        if (
          !verifyAuth(
            request,
            env
          )
        ) {

          return unauthorized(
            requestId
          );
        }

        let body:
          ToolCallBody;

        try {

          body =
            await request.json();

        } catch {

          return json(
            {
              ok: false,
              error: {
                code:
                  "INVALID_JSON",

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
          typeof body.name !==
            "string"
        ) {

          return json(
            {
              ok: false,
              error: {
                code:
                  "INVALID_TOOL_NAME",

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
          server.tools[
            body.name
          ];

        if (!tool) {

          return json(
            {
              ok: false,
              error: {
                code:
                  "TOOL_NOT_FOUND",

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
              body.arguments ??
                {}
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

        } catch (
          error: any
        ) {

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

              tool:
                body.name,

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
            code:
              "NOT_FOUND",

            message:
              "Endpoint not found"
          },

          requestId,
          ts: Date.now()
        },
        {
          status: 404
        }
      );

    } catch (
      error: any
    ) {

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