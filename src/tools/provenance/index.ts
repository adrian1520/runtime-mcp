import { z } from "zod";
import type { ToolRegistry } from "../../contracts/tool";

type Env = {
  STATE_KV: KVNamespace;
};

const appendSchema = z.object({
  action: z
    .string()
    .min(1)
    .max(128),

  payload: z.any()
});

const querySchema = z.object({
  prefix: z
    .string()
    .max(512)
    .optional(),

  limit: z
    .number()
    .int()
    .min(1)
    .max(100)
    .optional(),

  cursor: z
    .string()
    .optional()
});

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

/*
 * SAFE JSON PARSING
 */

function safeParse(
  value: string
): unknown {

  try {

    return JSON.parse(
      value
    );

  } catch {

    return {
      error:
        "INVALID_STORED_JSON"
    };
  }
}

export function registerProvenanceTools(
  registry: ToolRegistry<Env>
) {

  /*
   * PROVENANCE APPEND
   *
   * Immutable append-only audit trail.
   */

  registry.provenance_append = {

    description:
      "Append provenance event (audit log)",

    inputSchema: {
      type: "object",

      properties: {

        action: {
          type: "string"
        },

        payload: {}
      },

      required: [
        "action",
        "payload"
      ],

      additionalProperties: false
    },

    validate: (args) =>
      appendSchema.parse(args),

    execute: async (
      args,
      {
        env,
        requestId
      }
    ) => {

      const id =
        crypto.randomUUID();

      const ts =
        Date.now();

      /*
       * Lexicographically sortable key
       */

      const key =
        `prov:${ts
          .toString()
          .padStart(
            16,
            "0"
          )}:${id}`;

      const payload = {

        type:
          "provenance_event",

        source:
          "runtime-mcp",

        id,

        ts,

        requestId,

        version: 1,

        action:
          args.action,

        payload:
          args.payload
      };

      await env.STATE_KV.put(
        key,

        safeStringify(
          payload
        )
      );

      return {

        ok: true,

        id,

        key,

        ts
      };
    }
  };

  /*
   * PROVENANCE QUERY
   */

  registry.provenance_query = {

    description:
      "Query provenance events by prefix",

    inputSchema: {
      type: "object",

      properties: {

        prefix: {
          type: "string"
        },

        limit: {
          type: "integer"
        },

        cursor: {
          type: "string"
        }
      },

      additionalProperties: false
    },

    validate: (args) =>
      querySchema.parse(args),

    execute: async (
      args,
      { env }
    ) => {

      const normalizedPrefix =
        (args.prefix ?? "")
          .replace(
            /^prov:/,
            ""
          )
          .trim();

      const prefix =
        `prov:${normalizedPrefix}`;

      const res =
        await env.STATE_KV.list({

          prefix,

          limit:
            args.limit ?? 50,

          cursor:
            args.cursor
        });

      const items =
        await Promise.all(

          res.keys.map(
            async (k) => {

              const raw =
                await env.STATE_KV.get(
                  k.name
                );

              if (!raw) {
                return null;
              }

              return safeParse(
                raw
              );
            }
          )
        );

      const filtered =
        items.filter(
          (v) => v !== null
        );

      return {

        ok: true,

        items:
          filtered,

        count:
          filtered.length,

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