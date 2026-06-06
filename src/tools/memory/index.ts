import { z } from "zod";
import type { ToolRegistry } from "../../contracts/tool";

type Env = {
  STATE_KV: KVNamespace;
};

function keyOf(k: string) {
  return `memory:${k}`;
}

/*
 * PRODUCTION KEY SEMANTICS
 *
 * Supports:
 * - user/preferences/favorite_color
 * - session/current/task
 * - project/runtime/state
 *
 * GPT-generated hierarchical keys are valid.
 */

const keySchema = z
  .string()
  .min(1)
  .max(512);

const putSchema = z.object({
  key: keySchema,

  value: z.any(),

  ttl: z
    .number()
    .int()
    .positive()
    .max(60 * 60 * 24 * 30)
    .optional()
});

const getSchema = z.object({
  key: keySchema
});

const delSchema = z.object({
  key: keySchema
});

const listSchema = z.object({
  prefix: z
    .string()
    .max(512)
    .optional(),

  limit: z
    .number()
    .int()
    .min(1)
    .max(100)
    .optional()
});

function sanitizeKey(
  key: string
): string {

  return key
    .replace(/^memory:/, "")
    .trim();
}

/*
 * SAFE JSON SERIALIZATION
 *
 * Prevents crashes for:
 * - BigInt
 * - circular references
 * - unsupported structures
 */

function safeStringify(
  value: unknown
): string {

  const seen =
    new WeakSet<object>();

  return JSON.stringify(
    value,

    (_, v) => {

      if (
        typeof v === "bigint"
      ) {
        return v.toString();
      }

      if (
        typeof v === "object" &&
        v !== null
      ) {

        const obj =
          v as object;

        if (
          seen.has(obj)
        ) {
          return "[Circular]";
        }

        seen.add(obj);
      }

      return v;
    }
  );
}

export function registerMemoryTools(
  registry: ToolRegistry<Env>
) {

  /*
   * MEMORY PUT
   */

  registry.memory_put = {

    description:
      "Store structured memory in KV",

    inputSchema: {
      type: "object",

      properties: {

        key: {
          type: "string"
        },

        value: {},

        ttl: {
          type: "integer"
        }
      },

      required: [
        "key",
        "value"
      ],

      additionalProperties: false
    },

    validate: (args) =>
      putSchema.parse(args),

    execute: async (
      args,
      { env }
    ) => {

      const payload = {

        value: args.value,

        ts: Date.now(),

        version: 1,

        type:
          Array.isArray(args.value)
            ? "array"
            : typeof args.value
      };

      await env.STATE_KV.put(
        keyOf(args.key),

        safeStringify(payload),

        args.ttl
          ? {
              expirationTtl:
                args.ttl
            }
          : undefined
      );

      return {

        ok: true,

        key: sanitizeKey(
          args.key
        ),

        stored: true,

        ts: payload.ts
      };
    }
  };

  /*
   * MEMORY GET
   */

  registry.memory_get = {

    description:
      "Get structured memory from KV",

    inputSchema: {
      type: "object",

      properties: {
        key: {
          type: "string"
        }
      },

      required: [
        "key"
      ],

      additionalProperties: false
    },

    validate: (args) =>
      getSchema.parse(args),

    execute: async (
      args,
      { env }
    ) => {

      const raw =
        await env.STATE_KV.get(
          keyOf(args.key)
        );

      if (!raw) {

        return {

          ok: true,

          key: sanitizeKey(
            args.key
          ),

          found: false,

          value: null
        };
      }

      try {

        return {

          ok: true,

          key: sanitizeKey(
            args.key
          ),

          found: true,

          value:
            JSON.parse(raw)
        };

      } catch {

        return {

          ok: false,

          error:
            "INVALID_STORED_JSON",

          key: sanitizeKey(
            args.key
          )
        };
      }
    }
  };

  /*
   * MEMORY EXISTS
   */

  registry.memory_exists = {

    description:
      "Check if memory key exists",

    inputSchema: {
      type: "object",

      properties: {
        key: {
          type: "string"
        }
      },

      required: [
        "key"
      ],

      additionalProperties: false
    },

    validate: (args) =>
      getSchema.parse(args),

    execute: async (
      args,
      { env }
    ) => {

      const raw =
        await env.STATE_KV.get(
          keyOf(args.key),
          "text"
        );

      return {

        ok: true,

        key: sanitizeKey(
          args.key
        ),

        exists:
          raw !== null
      };
    }
  };

  /*
   * MEMORY DELETE
   */

  registry.memory_delete = {

    description:
      "Delete memory from KV",

    inputSchema: {
      type: "object",

      properties: {
        key: {
          type: "string"
        }
      },

      required: [
        "key"
      ],

      additionalProperties: false
    },

    validate: (args) =>
      delSchema.parse(args),

    execute: async (
      args,
      { env }
    ) => {

      await env.STATE_KV.delete(
        keyOf(args.key)
      );

      return {

        ok: true,

        key: sanitizeKey(
          args.key
        ),

        deleted: true,

        ts: Date.now()
      };
    }
  };

  /*
   * MEMORY LIST
   */

  registry.memory_list = {

    description:
      "List stored memory keys",

    inputSchema: {
      type: "object",

      properties: {

        prefix: {
          type: "string"
        },

        limit: {
          type: "integer"
        }
      },

      additionalProperties: false
    },

    validate: (args) =>
      listSchema.parse(args),

    execute: async (
      args,
      { env }
    ) => {

      const normalizedPrefix =
        sanitizeKey(
          args.prefix ?? ""
        );

      const prefix =
        `memory:${normalizedPrefix}`;

      const res =
        await env.STATE_KV.list({
          prefix,
          limit:
            args.limit ?? 50
        });

      return {

        ok: true,

        keys:
          res.keys.map((k) =>
            sanitizeKey(k.name)
          ),

        count:
          res.keys.length,

        complete:
          res.list_complete,

        cursor:
          "cursor" in res
            ? res.cursor
            : undefined
      };
    }
  };
}