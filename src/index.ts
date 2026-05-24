import { createMcpHandler } from "@modelcontextprotocol/sdk/server/cloudflare";
import { server } from "./server";

const mcp = createMcpHandler(server);

export default {
  async fetch(request, env, ctx) {

    const url = new URL(request.url);

    if (url.pathname === "/health") {
      return Response.json({
        ok: true
      });
    }

    return mcp.fetch(request, env, ctx);
  }
};