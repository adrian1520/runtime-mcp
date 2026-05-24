import { z } from "zod";
import type { ToolRegistry } from "../../contracts/tool";

type Env = {
  STATE_KV: KVNamespace;
};

const appendSchema = z.object({
  action: z.string().min(1).max(128),
  payload: z.any()
});

const querySchema = z.object({
  prefix: z.string().optional(),
  limit: z.number().int().min(1).max(100).optional()
});

export function registerProvenanceTools(registry: ToolRegistry<Env>) {
  registry.provenance_append = {
    description: "Append provenance event (audit log)",
    inputSchema: {
      type: "object",
      properties: {
        action: { type: "string" },
        payload: {}
      },
      required: ["action", "payload"],
      additionalProperties: false
    },
    validate: (args) => appendSchema.parse(args),
    execute: async (args, { env, requestId }) => {
      const id = crypto.randomUUID();
      const ts = Date.now();
      const key = `prov:${ts}:${id}`;
      await env.STATE_KV.put(
        key,
        JSON.stringify({ id, ts, requestId, action: args.action, payload: args.payload })
      );
      return { ok: true, id, key };
    }
  };

  registry.provenance_query = {
    description: "Query provenance events by prefix",
    inputSchema: {
      type: "object",
      properties: {
        prefix: { type: "string" },
        limit: { type: "integer" }
      },
      additionalProperties: false
    },
    validate: (args) => querySchema.parse(args),
    execute: async (args, { env }) => {
      const res = await env.STATE_KV.list({
        prefix: `prov:${args.prefix ?? ""}`,
        limit: args.limit ?? 50
      });
      const items = [];
      for (const k of res.keys) {
        const v = await env.STATE_KV.get(k.name);
        if (v) items.push(JSON.parse(v));
      }
      return { ok: true, items, complete: res.list_complete };
    }
  };
}