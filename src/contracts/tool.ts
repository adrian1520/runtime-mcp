export type JsonSchema =
  | {
      type: "object";

      properties?: Record<string, JsonSchema>;

      required?: readonly string[];

      additionalProperties?: boolean;
    }
  | {
      type: "string" | "number" | "integer" | "boolean" | "array" | "null";

      items?: JsonSchema;
    }
  | Record<string, unknown>;

export type ToolContext<Env> = {
  readonly env: Env;

  readonly requestId: string;
};

export type ToolDefinition<Env, TArgs = unknown, TResult = unknown> = {
  readonly description: string;

  readonly inputSchema: JsonSchema;

  readonly outputSchema?: JsonSchema;

  readonly validate: (args: unknown) => TArgs;

  readonly execute: (args: TArgs, ctx: ToolContext<Env>) => Promise<TResult>;
};

export type ToolRegistry<Env> = Record<string, ToolDefinition<Env, any, any>>;
