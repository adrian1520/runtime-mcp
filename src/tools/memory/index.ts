import { z } from "zod";
import type { ToolRegistry } from "../../contracts/tool";

type Env = {
  STATE_KV: KVNamespace;
};

function keyOf(k: string) {
  return `memory:${k}`;
}

const putSchema = z.object({
  key: z.string().min(1).max(256).regex(/^[a-zA-Z0-9:_-]+$/),
  value: z.any(),
  ttl: z.number().int().positive().max(60 * 60 * 24 * 30).optional()
});

const getSchema = z.object({
  key: z.string().min(1).max(256).regex(/^[a-zA-Z0-9:_-]+$/)
});

const delSchema = z.object({
  key: z.string().min(1).max(256).regex(/^[a-zA-Z0-9:_-]+$/)
});

const listSchema = z.object({
  prefix: z.string().optional(),
  limit: z.number().int().min(1).max(100).optional()
});

export function registerMemoryTools(registry: ToolRegistry<Env>) {
  registry.memory_put = {
    description: "Store memory in KV",
    inputSchema: {
      type: "object",
      properties: {
        key: { type: "string" },
        value: {},
        ttl: { type: "integer" }
      },
      required: ["key", "value"],
      additionalProperties: false
    },
    validate: (args) => putSchema.parse(args),
    execute: async (args, { env }) => {
      const payload = { value: args.value, ts: Date.now() };
      await env.STATE_KV.put(
        keyOf(args.key),
        JSON.stringify(payload),
        args.ttl ? { expirationTtl: args.ttl } : undefined
      );
      return { ok: true };
    }
  };

  registry.memory_get = {
    description: "Get memory from KV",
    inputSchema: {
      type: "object",
      properties: { key: { type: "string" } },
      required: ["key"],
      additionalProperties: false
    },
    validate: (args) => getSchema.parse(args),
    execute: async (args, { env }) => {
      const raw = await env.STATE_KV.get(keyOf(args.key));
      return { ok: true, value: raw ? JSON.parse(raw) : null };
    }
  };

  registry.memory_delete = {
    description: "Delete memory from KV",
    inputSchema: {
      type: "object",
      properties: { key: { type: "string" } },
      required: ["key"],
      additionalProperties: false
    },
    validate: (args) => delSchema.parse(args),
    execute: async (args, { env }) => {
      await env.STATE_KV.delete(keyOf(args.key));
      return { ok: true };
    }
  };

  registry.memory_list = {
    description: "List memory keys",
    inputSchema: {
      type: "object",
      properties: {
        prefix: { type: "string" },
        limit: { type: "integer" }
      },
      additionalProperties: false
    },
    validate: (args) => listSchema.parse(args),
    execute: async (args, { env }) => {
      const prefix = `memory:${args.prefix ?? ""}`;
      const res = await env.STATE_KV.list({
        prefix,
        limit: args.limit ?? 50
      });
      return {
        ok: true,
        keys: res.keys.map((k) => k.name),
        complete: res.list_complete
      };
    }
  };
}