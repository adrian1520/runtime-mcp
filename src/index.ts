import type { Env }
  from "./server";

import { buildOpenApi }
  from "./openapi";

import { handleToolsRoute }
  from "./routes/tools";

import { handleRpcRoute }
  from "./routes/rpc";

import { handleResourcesRoute }
  from "./routes/resources";

function requestId():
  string {

  return crypto.randomUUID();
}

function json(
  data: unknown,
  init?: ResponseInit
): Response {

  return new Response(
    JSON.stringify(
      data,
      null,
      2
    ),
    {
      status:
        init?.status,

      statusText:
        init?.statusText,

      headers: {

        "content-type":
          "application/json; charset=utf-8",

        "cache-control":
          "no-store",

        "access-control-allow-origin":
          "*",

        "access-control-allow-methods":
          "GET, POST, OPTIONS",

        "access-control-allow-headers":
          "content-type, authorization",

        ...(init?.headers ?? {})
      }
    }
  );
}

export default {

  async fetch(
    request: Request,
    env: Env
  ): Promise<Response> {

    const rid =
      requestId();

    const url =
      new URL(
        request.url
      );

    try {

      /*
       * Global CORS preflight
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

          service:
            "runtime-mcp",

          version:
            "1.0.0",

          requestId:
            rid,

          ts:
            Date.now()
        });
      }

      /*
       * OPENAPI
       */

      if (
        url.pathname ===
        "/openapi.json"
      ) {

        const baseUrl =
          `${url.protocol}//${url.host}`;

        return json(
          buildOpenApi(
            baseUrl
          )
        );
      }

      /*
       * TOOLS
       */

      const tools =
        await handleToolsRoute(
          request,
          env,
          rid
        );

      if (tools) {
        return tools;
      }

      /*
       * RPC
       */

      const rpc =
        await handleRpcRoute(
          request,
          env,
          rid
        );

      if (rpc) {
        return rpc;
      }

      /*
       * RESOURCES
       */

      const resources =
        await handleResourcesRoute(
          request,
          env,
          rid
        );

      if (resources) {
        return resources;
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

          requestId:
            rid,

          ts:
            Date.now()
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

          requestId:
            rid,

          ts:
            Date.now()
        },
        {
          status: 500
        }
      );
    }
  }
};