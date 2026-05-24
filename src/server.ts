import { z } from "zod";

export const server = {

  tools: {

    memory_put: {

      description: "Store memory in KV",

      schema: {
        key: z.string(),
        value: z.any()
      },

      async execute(args: any, env: any) {

        await env.STATE_KV.put(
          `memory:${args.key}`,
          JSON.stringify({
            value: args.value,
            ts: Date.now()
          })
        );

        return {
          ok: true
        };
      }
    },

    memory_get: {

      description: "Get memory from KV",

      schema: {
        key: z.string()
      },

      async execute(args: any, env: any) {

        const value = await env.STATE_KV.get(
          `memory:${args.key}`
        );

        return {
          value: value
            ? JSON.parse(value)
            : null
        };
      }
    }
  }
};