import { server } from "./server";

export default {
  async fetch(request: Request, env: any): Promise<Response> {

    const url = new URL(request.url);

    if (url.pathname === "/health") {
      return Response.json({
        ok: true,
        service: "runtime-mcp"
      });
    }

    if (url.pathname === "/mcp") {

      return Response.json({
        name: "runtime-mcp",
        version: "1.0.0",
        tools: server.tools
      });
    }

    if (url.pathname === "/mcp/call" && request.method === "POST") {

      const body = await request.json();

      const tool = server.tools[body.name];

      if (!tool) {
        return Response.json(
          {
            error: "Tool not found"
          },
          {
            status: 404
          }
        );
      }

      const result = await tool.execute(
        body.arguments,
        env
      );

      return Response.json(result);
    }

    return new Response("Not Found", {
      status: 404
    });
  }
};