import { z } from "zod";

type Env = {
  STATE_KV: KVNamespace;
};

type ToolContext = {
  env: Env;
  requestId: string;
};

type ToolDefinition = {
  description: string;
  inputSchema: Record<string, unknown>;
  validate: (args: unknown) => any;
  execute: (
    args: any,
    context: ToolContext
  ) => Promise<unknown>;
};

const memoryPutSchema = z.object({
  key: z
    .string()
    .min(1)
    .max(256)
    .regex(/^[a-zA-Z0-9:_-]+$/),

  value: z.any(),

  ttl: z
    .number()
    .int()
    .positive()
    .max(60 * 60 * 24 * 30)
    .optional()
});

const memoryGetSchema = z.object({
  key: z
    .string()
    .min(1)
    .max(256)
    .regex(/^[a-zA-Z0-9:_-]+$/)
});

const memoryDeleteSchema = z.object({
  key: z
    .string()
    .min(1)
    .max(256)
    .regex(/^[a-zA-Z0-9:_-]+$/)
});

const memoryListSchema = z.object({
  prefix: z.string().optional(),
  limit: z.number().int().min(1).max(100).optional()
});

function buildMemoryKey(key: string): string {
  return `memory:${key}`;
}

function createSuccess(data: unknown) {
  return {
    ok: true,
    data,
    ts: Date.now()
  };
}

function createError(
  code: string,
  message: string
) {
  return {
    ok: false,
    error: {
      code,
      message
    },
    ts: Date.now()
  };
}

async function appendAuditLog(
  env: Env,
  action: string,
  payload: unknown
) {
  const id = crypto.randomUUID();

  await env.STATE_KV.put(
    `provenance:${Date.now()}:${id}`,
    JSON.stringify({
      action,
      payload,
      ts: Date.now()
    })
  );
}

export const server: {
  tools: Record<string, ToolDefinition>;
} = {

  tools: {

    memory_put: {

      description:
        "Store structured memory in Cloudflare KV",

      inputSchema: {
        type: "object",
        properties: {
          key: {
            type: "string"
          },
          value: {},
          ttl: {
            type: "number"
          }
        },
        required: ["key", "value"]
      },

      validate(args: unknown) {
        return memoryPutSchema.parse(args);
      },

      async execute(
        rawArgs,
        { env, requestId }
      ) {

        try {

          const args =
            memoryPutSchema.parse(rawArgs);

          const key = buildMemoryKey(args.key);

          const payload = {
            value: args.value,
            ts: Date.now(),
            requestId
          };

          await env.STATE_KV.put(
            key,
            JSON.stringify(payload),
            args.ttl
              ? {
                  expirationTtl: args.ttl
                }
              : undefined
          );

          await appendAuditLog(
            env,
            "memory_put",
            {
              key: args.key
            }
          );

          return createSuccess({
            key: args.key,
            stored: true
          });

        } catch (error: any) {

          return createError(
            "MEMORY_PUT_FAILED",
            error?.message ??
              "Unknown error"
          );
        }
      }
    },

    memory_get: {

      description:
        "Retrieve structured memory from Cloudflare KV",

      inputSchema: {
        type: "object",
        properties: {
          key: {
            type: "string"
          }
        },
        required: ["key"]
      },

      validate(args: unknown) {
        return memoryGetSchema.parse(args);
      },

      async execute(
        rawArgs,
        { env }
      ) {

        try {

          const args =
            memoryGetSchema.parse(rawArgs);

          const key = buildMemoryKey(args.key);

          const value =
            await env.STATE_KV.get(key);

          if (!value) {

            return createSuccess({
              key: args.key,
              value: null,
              found: false
            });
          }

          return createSuccess({
            key: args.key,
            value: JSON.parse(value),
            found: true
          });

        } catch (error: any) {

          return createError(
            "MEMORY_GET_FAILED",
            error?.message ??
              "Unknown error"
          );
        }
      }
    },

    memory_delete: {

      description:
        "Delete memory from Cloudflare KV",

      inputSchema: {
        type: "object",
        properties: {
          key: {
            type: "string"
          }
        },
        required: ["key"]
      },

      validate(args: unknown) {
        return memoryDeleteSchema.parse(args);
      },

      async execute(
        rawArgs,
        { env }
      ) {

        try {

          const args =
            memoryDeleteSchema.parse(rawArgs);

          await env.STATE_KV.delete(
            buildMemoryKey(args.key)
          );

          await appendAuditLog(
            env,
            "memory_delete",
            {
              key: args.key
            }
          );

          return createSuccess({
            key: args.key,
            deleted: true
          });

        } catch (error: any) {

          return createError(
            "MEMORY_DELETE_FAILED",
            error?.message ??
              "Unknown error"
          );
        }
      }
    },

    memory_list: {

      description:
        "List stored memory keys",

      inputSchema: {
        type: "object",
        properties: {
          prefix: {
            type: "string"
          },
          limit: {
            type: "number"
          }
        }
      },

      validate(args: unknown) {
        return memoryListSchema.parse(args);
      },

      async execute(
        rawArgs,
        { env }
      ) {

        try {

          const args =
            memoryListSchema.parse(rawArgs);

          const result =
            await env.STATE_KV.list({
              prefix: buildMemoryKey(
                args.prefix ?? ""
              ),
              limit: args.limit ?? 50
            });

          return createSuccess({
            keys: result.keys.map(
              (k) => k.name
            ),
            count: result.keys.length,
            complete: result.list_complete
          });

        } catch (error: any) {

          return createError(
            "MEMORY_LIST_FAILED",
            error?.message ??
              "Unknown error"
          );
        }
      }
    }
  }
};