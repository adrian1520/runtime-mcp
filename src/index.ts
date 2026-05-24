import type { Env } from "./server";
import { buildOpenApi } from "./openapi";
import { handleToolsRoute } from "./routes/tools";
import { handleRpcRoute } from "./routes/rpc";
import { handleResourcesRoute } from "./routes/resources";

function requestId() {
  return crypto.randomUUID();
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const rid = requestId();
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: {
          "access-control-allow-origin": "*",
          "access-control-allow-methods": "GET, POST, OPTIONS",
          "access-control-allow-headers": "content-type, authorization"
        }
      });
    }

    if (url.pathname === "/health") {
      return Response.json({ ok: true, service: "runtime-mcp", version: "1.0.0", requestId: rid });
    }

    if (url.pathname === "/openapi.json") {
      const baseUrl = `${url.protocol}//${url.host}`;
      return Response.json(buildOpenApi(baseUrl));
    }

    const tools = await handleToolsRoute(request, env, rid);
    if (tools) return tools;

    const rpc = await handleRpcRoute(request, env, rid);
    if (rpc) return rpc;

    const resources = await handleResourcesRoute(request, env, rid);
    if (resources) return resources;

    return Response.json({ ok: false, error: { code: "NOT_FOUND" }, requestId: rid }, { status: 404 });
  }
};