import { createMcpHandler } from "@modelcontextprotocol/sdk/server/cloudflare";
import { server } from "./server";

const mcpHandler = createMcpHandler(server);

export default {
  async fetch(request, env, ctx) {

    const url = new URL(request.url);

    if (url.pathname === "/health") {
      return Response.json({
        ok: true,
        service: "runtime-mcp"
      });
    }

    return mcpHandler.fetch(request, env, ctx);
  }
};