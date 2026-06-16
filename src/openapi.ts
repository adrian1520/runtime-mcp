import { server } from "./server";

import type { JsonSchema } from "./contracts/tool";

type OpenApiSchema = JsonSchema;

type OpenApiResponse = {
  readonly description: string;
};

type OpenApiOperation = {
  readonly operationId: string;

  readonly summary: string;

  readonly tags: readonly string[];

  readonly requestBody?: {
    readonly required: boolean;

    readonly content: {
      readonly "application/json": {
        readonly schema: OpenApiSchema;
      };
    };
  };

  readonly responses: Record<string, OpenApiResponse>;
};

type OpenApiPathItem = {
  readonly get?: OpenApiOperation;

  readonly post?: OpenApiOperation;
};

export function buildOpenApi(baseUrl: string) {
  const paths: Record<string, OpenApiPathItem> = {};

  /*
   * TOOL ROUTES
   */

  for (const [name, tool] of Object.entries(server.tools)) {
    const path = `/tools/${name}`;

    paths[path] = {
      post: {
        operationId: name,

        summary: tool.description,

        tags: ["tools"],

        requestBody: {
          required: true,

          content: {
            "application/json": {
              schema: tool.inputSchema,
            },
          },
        },

        responses: {
          "200": {
            description: "Successful response",
          },

          "400": {
            description: "Validation or JSON error",
          },

          "404": {
            description: "Tool not found",
          },

          "500": {
            description: "Runtime execution error",
          },
        },
      },
    };
  }

  /*
   * HEALTH ROUTE
   */

  paths["/health"] = {
    get: {
      operationId: "health",

      summary: "Runtime health check",

      tags: ["system"],

      responses: {
        "200": {
          description: "Runtime healthy",
        },
      },
    },
  };

  /*
   * RESOURCES ROUTE
   */

  paths["/resources"] = {
    get: {
      operationId: "resources",

      summary: "Runtime resources manifest",

      tags: ["resources"],

      responses: {
        "200": {
          description: "Resources manifest",
        },
      },
    },
  };

  /*
   * OPENAPI DOCUMENT
   */

  return {
    openapi: "3.1.0",

    info: {
      title: "runtime-mcp",

      version: "1.0.0",

      description: "Production MCP runtime running on Cloudflare Workers",
    },

    servers: [
      {
        url: baseUrl,
      },
    ],

    tags: [
      {
        name: "tools",

        description: "MCP executable tools",
      },

      {
        name: "resources",

        description: "Runtime resources",
      },

      {
        name: "system",

        description: "Runtime system endpoints",
      },
    ],

    paths,
  };
}
