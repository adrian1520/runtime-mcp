import { server, type Env } from "../server";
import { verifyBearer } from "../auth/bearer";
import { ZodError } from "zod";

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
      ...init,

      headers: {
        "content-type":
          "application/json; charset=utf-8",

        "cache-control":
          "no-store",

        "access-control-allow-origin":
          "*",

        "access-control-allow-methods":
          "POST, OPTIONS",

        "access-control-allow-headers":
          "content-type, authorization",

        ...(init?.headers ?? {})
      }
    }
  );
}

export async function handleToolsRoute(
  request: Request,
  env: Env,
  requestId: string
): Promise<Response | null> {

  const url =
    new URL(request.url);

  /*
   * Route guard
   */

  if (
    !url.pathname.startsWith(
      "/tools/"
    )
  ) {
    return null;
  }

  /*
   * CORS preflight
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
            "POST, OPTIONS",

          "access-control-allow-headers":
            "content-type, authorization"
        }
      }
    );
  }

  /*
   * Method validation
   */

  if (
    request.method !==
    "POST"
  ) {

    return json(
      {

        ok: false,

        error: {

          code:
            "METHOD_NOT_ALLOWED",

          message:
            "POST method required"
        },

        requestId,

        ts:
          Date.now()
      },
      {
        status: 405
      }
    );
  }

  /*
   * Bearer auth
   */

  const auth =
    verifyBearer(
      request,
      env.API_KEY
    );

  if (!auth.ok) {

    return json(
      {

        ok: false,

        error: {

          code:
            auth.code,

          message:
            auth.message
        },

        requestId,

        ts:
          Date.now()
      },
      {
        status:
          auth.status
      }
    );
  }

  /*
   * Resolve tool
   */

  const toolName =
    url.pathname.replace(
      "/tools/",
      ""
    );

  const tool =
    Object.prototype.hasOwnProperty.call(
      server.tools,
      toolName
    )
      ? server.tools[
          toolName as keyof typeof server.tools
        ]
      : null;

  if (!tool) {

    return json(
      {

        ok: false,

        error: {

          code:
            "TOOL_NOT_FOUND",

          message:
            `Unknown tool: ${toolName}`
        },

        requestId,

        ts:
          Date.now()
      },
      {
        status: 404
      }
    );
  }

  /*
   * Parse request body
   */

  let body: unknown;

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

        requestId,

        ts:
          Date.now()
      },
      {
        status: 400
      }
    );
  }

  /*
   * Validate input
   */

  let validated: unknown;

  try {

    validated =
      tool.validate(
        body
      );

  } catch (
    error
  ) {

    if (
      error instanceof
      ZodError
    ) {

      return json(
        {

          ok: false,

          error: {

            code:
              "VALIDATION_ERROR",

            issues:
              error.issues
          },

          requestId,

          ts:
            Date.now()
        },
        {
          status: 400
        }
      );
    }

    return json(
      {

        ok: false,

        error: {

          code:
            "VALIDATION_FAILED",

          message:
            "Tool validation failed"
        },

        requestId,

        ts:
          Date.now()
      },
      {
        status: 400
      }
    );
  }

  /*
   * Execute tool safely
   */

  try {

    const result =
      await tool.execute(
        validated,
        {
          env,
          requestId
        }
      );

    return json(
      {

        ok: true,

        tool:
          toolName,

        result,

        requestId,

        ts:
          Date.now()
      },
      {
        status: 200
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
            "TOOL_EXECUTION_FAILED",

          message:
            error?.message ??
            "Unknown runtime error"
        },

        tool:
          toolName,

        requestId,

        ts:
          Date.now()
      },
      {
        status: 500
      }
    );
  }
}