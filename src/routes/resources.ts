import type { Env } from "../server";

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
      headers: {

        "content-type":
          "application/json; charset=utf-8",

        "cache-control":
          "no-store",

        "access-control-allow-origin":
          "*",

        "access-control-allow-methods":
          "GET, OPTIONS",

        "access-control-allow-headers":
          "content-type"
      },

      ...init
    }
  );
}

export async function handleResourcesRoute(
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
      "/resources"
    ) &&
    !url.pathname.startsWith(
      "/ui"
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
            "GET, OPTIONS",

          "access-control-allow-headers":
            "content-type"
        }
      }
    );
  }

  /*
   * Serve UI widget
   * Mapped paths:
   *  - /ui
   *  - /ui/widget/result.html
   *  - /resources/ui/widget/result.html
   *
   * Implementation: fetch the committed raw HTML from the repository's
   * raw.githubusercontent URL. For private repositories you can replace this
   * with a repository API fetch using GITHUB_TOKEN or embed the HTML at
   * build time.
   */

  const uiPaths = new Set([
    "/ui",
    "/ui/widget/result.html",
    "/resources/ui/widget/result.html"
  ]);

  if (uiPaths.has(url.pathname) && request.method === "GET") {
    try {
      const rawUrl =
        "https://raw.githubusercontent.com/adrian1520/runtime-mcp/main/src/routes/ui.html";

      const fetched = await fetch(rawUrl);

      if (!fetched.ok) {
        throw new Error(`Failed to fetch UI (${fetched.status})`);
      }

      const html = await fetched.text();

      return new Response(html, {
        headers: {
          "content-type": "text/html; profile=mcp-app; charset=utf-8",
          "cache-control": "no-cache",
          "access-control-allow-origin": "*",
          "access-control-allow-methods": "GET, OPTIONS"
        }
      });
    } catch (error: any) {
      return json(
        {
          ok: false,

          error: {
            code: "UI_FETCH_ERROR",
            message: error?.message ?? "Failed to load UI widget"
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

  /*
   * GET /resources
   *
   * Runtime resources manifest
   */

  if (
    url.pathname ===
      "/resources" &&
    request.method === "GET"
  ) {

    return json({

      ok: true,

      resources: [

        {
          id:
            "memory",

          type:
            "kv_namespace",

          description:
            "Mutable runtime memory storage"
        },

        {
          id:
            "provenance",

          type:
            "append_only_log",

          description:
            "Immutable provenance audit events"
        }
      ],

      capabilities: {

        memory: true,

        provenance: true,

        pagination: true
      },

      requestId,

      ts:
        Date.now()
    });
  }

  /*
   * GET /resources/memory
   */

  if (
    url.pathname ===
      "/resources/memory" &&
    request.method === "GET"
  ) {

    try {

      const res =
        await env.STATE_KV.list({

          prefix:
            "memory:",

          limit: 100
        });

      return json({

        ok: true,

        resource:
          "memory",

        keys:
          res.keys.map(
            (k) =>
              k.name.replace(
                /^memory:/,
                ""
              )
          ),

        count:
          res.keys.length,

        complete:
          res.list_complete,

        cursor:
          "cursor" in res
            ? res.cursor
            : undefined,

        requestId,

        ts:
          Date.now()
      });

    } catch (
      error: any
    ) {

      return json(
        {

          ok: false,

          error: {

            code:
              "MEMORY_RESOURCE_ERROR",

            message:
              error?.message ??
              "Failed to load memory resources"
          },

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

  /*
   * GET /resources/provenance
   */

  if (
    url.pathname ===
      "/resources/provenance" &&
    request.method === "GET"
  ) {

    try {

      const res =
        await env.STATE_KV.list({

          prefix:
            "prov:",

          limit: 100
        });

      return json({

        ok: true,

        resource:
          "provenance",

        keys:
          res.keys.map(
            (k) => k.name
          ),

        count:
          res.keys.length,

        complete:
          res.list_complete,

        cursor:
          "cursor" in res
            ? res.cursor
            : undefined,

        requestId,

        ts:
          Date.now()
      });

    } catch (
      error: any
    ) {

      return json(
        {

          ok: false,

          error: {

            code:
              "PROVENANCE_RESOURCE_ERROR",

            message:
              error?.message ??
              "Failed to load provenance resources"
          },

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

  /*
   * Resource route exists
   * but endpoint not found
   */

  return json(
    {

      ok: false,

      error: {

        code:
          "RESOURCE_NOT_FOUND",

        message:
          "Unknown resource endpoint"
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
