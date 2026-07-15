import type { Env } from "../server";
import { widgetHtml } from "./widget-html";
import { getPdfResource, pdfResources } from "../pdf-project/catalog";

function json(data: unknown, init?: ResponseInit): Response {
  return new Response(JSON.stringify(data, null, 2), {
    headers: {
      "content-type": "application/json; charset=utf-8",

      "cache-control": "no-store",

      "access-control-allow-origin": "*",

      "access-control-allow-methods": "GET, OPTIONS",

      "access-control-allow-headers": "content-type",
    },

    ...init,
  });
}

export async function handleResourcesRoute(
  request: Request,
  env: Env,
  requestId: string,
): Promise<Response | null> {
  const url = new URL(request.url);

  /*
   * Route guard
   */

  if (
    !url.pathname.startsWith("/resources") &&
    !url.pathname.startsWith("/ui")
  ) {
    return null;
  }

  /*
   * CORS preflight
   */

  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,

      headers: {
        "access-control-allow-origin": "*",

        "access-control-allow-methods": "GET, OPTIONS",

        "access-control-allow-headers": "content-type",
      },
    });
  }

  /*
   * Serve UI widget
   * Mapped paths:
   *  - /ui
   *  - /ui/widget/result.html
   *  - /resources/ui/widget/result.html
   *
   * Implementation: serve the committed dashboard HTML shared with the MCP
   * resource template so Apps SDK and direct HTTP UI paths stay in sync.
   */

  const uiPaths = new Set([
    "/ui",
    "/ui/widget/result.html",
    "/resources/ui/widget/result.html",
  ]);

  if (uiPaths.has(url.pathname) && request.method === "GET") {
    return new Response(widgetHtml, {
      headers: {
        "content-type": "text/html; profile=mcp-app; charset=utf-8",
        "cache-control": "no-cache",
        "access-control-allow-origin": "*",
        "access-control-allow-methods": "GET, OPTIONS",
      },
    });
  }

  /*
   * GET /resources
   *
   * Runtime resources manifest
   */

  if (url.pathname === "/resources" && request.method === "GET") {
    return json({
      ok: true,

      resources: [
        {
          id: "memory",

          type: "kv_namespace",

          description: "Mutable runtime memory storage",
        },

        {
          id: "provenance",

          type: "append_only_log",

          description: "Immutable provenance audit events",
        },

        ...pdfResources.map((resource) => ({
          id: resource.uri,

          type: resource.mimeType,

          description: resource.description,
        })),
      ],

      capabilities: {
        memory: true,

        provenance: true,

        pagination: true,

        pdfFramework: true,
      },

      requestId,

      ts: Date.now(),
    });
  }



  /*
   * GET /resources/pdf-framework?uri=<resource-uri>
   * Static PDF framework project resources for clients that do not use MCP
   * readResource directly.
   */

  if (url.pathname === "/resources/pdf-framework" && request.method === "GET") {
    const uri = url.searchParams.get("uri");

    if (!uri) {
      return json({
        ok: true,

        resources: pdfResources.map((resource) => ({
          uri: resource.uri,
          name: resource.name,
          mimeType: resource.mimeType,
          description: resource.description,
        })),

        requestId,

        ts: Date.now(),
      });
    }

    const resource = getPdfResource(uri);

    if (!resource) {
      return json(
        {
          ok: false,
          error: {
            code: "PDF_RESOURCE_NOT_FOUND",
            message: `Unknown PDF framework resource: ${uri}`,
          },
          requestId,
          ts: Date.now(),
        },
        { status: 404 },
      );
    }

    return json({
      ok: true,

      resource,

      requestId,

      ts: Date.now(),
    });
  }
  /*
   * GET /resources/memory
   */

  if (url.pathname === "/resources/memory" && request.method === "GET") {
    try {
      const res = await env.STATE_KV.list({
        prefix: "memory:",

        limit: 100,
      });

      return json({
        ok: true,

        resource: "memory",

        keys: res.keys.map((k) => k.name.replace(/^memory:/, "")),

        count: res.keys.length,

        complete: res.list_complete,

        cursor: "cursor" in res ? res.cursor : undefined,

        requestId,

        ts: Date.now(),
      });
    } catch (error: any) {
      return json(
        {
          ok: false,

          error: {
            code: "MEMORY_RESOURCE_ERROR",

            message: error?.message ?? "Failed to load memory resources",
          },

          requestId,

          ts: Date.now(),
        },
        {
          status: 500,
        },
      );
    }
  }

  /*
   * GET /resources/provenance
   */

  if (url.pathname === "/resources/provenance" && request.method === "GET") {
    try {
      const res = await env.STATE_KV.list({
        prefix: "prov:",

        limit: 100,
      });

      return json({
        ok: true,

        resource: "provenance",

        keys: res.keys.map((k) => k.name),

        count: res.keys.length,

        complete: res.list_complete,

        cursor: "cursor" in res ? res.cursor : undefined,

        requestId,

        ts: Date.now(),
      });
    } catch (error: any) {
      return json(
        {
          ok: false,

          error: {
            code: "PROVENANCE_RESOURCE_ERROR",

            message: error?.message ?? "Failed to load provenance resources",
          },

          requestId,

          ts: Date.now(),
        },
        {
          status: 500,
        },
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
        code: "RESOURCE_NOT_FOUND",

        message: "Unknown resource endpoint",
      },

      requestId,

      ts: Date.now(),
    },
    {
      status: 404,
    },
  );
}
