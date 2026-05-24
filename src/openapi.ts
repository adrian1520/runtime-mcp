import type { Env } from "./server";
import { server } from "./server";

export function buildOpenApi(baseUrl: string) {
  const paths: Record<string, any> = {};

  // explicit REST endpoints per tool
  for (const [name, tool] of Object.entries(server.tools)) {
    const path = `/tools/${name}`;
    paths[path] = {
      post: {
        operationId: name,
        summary: tool.description,
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: tool.inputSchema
            }
          }
        },
        responses: {
          "200": {
            description: "OK"
          }
        }
      }
    };
  }

  return {
    openapi: "3.1.0",
    info: {
      title: "runtime-mcp",
      version: "1.0.0"
    },
    servers: [{ url: baseUrl }],
    paths
  };
}