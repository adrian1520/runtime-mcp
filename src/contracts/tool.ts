export type JsonSchema =
  | {
      type: "object";
      properties?: Record<string, JsonSchema | any>;
      required?: string[];
      additionalProperties?: boolean;
    }
  | {
      type: "string" | "number" | "integer" | "boolean" | "array" | "null";
      items?: JsonSchema;
    }
  | Record<string, any>;

export type ToolContext<Env> = {
  env: Env;
  requestId: string;
};

export type ToolDefinition<Env> = {
  description: string;
  inputSchema: JsonSchema;
  validate: (args: unknown) => any;
  execute: (args: any, ctx: ToolContext<Env>) => Promise<unknown>;
};

export type ToolRegistry<Env> = Record<string, ToolDefinition<Env>>;