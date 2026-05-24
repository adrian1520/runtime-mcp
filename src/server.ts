import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

export const server = new McpServer({
  name: "runtime-mcp",
  version: "1.0.0"
});

server.tool(
  "memory_put",
  {
    key: z.string(),
    value: z.any()
  },
  async ({ key, value }, extra) => {

    const env = extra.env as any;

    await env.STATE_KV.put(
      `memory:${key}`,
      JSON.stringify(value)
    );

    return {
      content: [
        {
          type: "text",
          text: "stored"
        }
      ]
    };
  }
);

server.tool(
  "memory_get",
  {
    key: z.string()
  },
  async ({ key }, extra) => {

    const env = extra.env as any;

    const value = await env.STATE_KV.get(
      `memory:${key}`
    );

    return {
      content: [
        {
          type: "text",
          text: value ?? "null"
        }
      ]
    };
  }
);