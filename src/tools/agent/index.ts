import { z } from "zod";

import type { ToolDefinition, ToolRegistry } from "../../contracts/tool";
import { AgentRuntime } from "../../runtime/agent-runtime";
import type { Env } from "../../server";

const GoalSchema = z.object({
  id: z.string().min(1, "Goal.id is required"),
  objective: z.string().min(1, "Goal.objective is required"),
});

const Validator = z.object({
  goal: GoalSchema,
});

const inputSchema = {
  type: "object",
  properties: {
    goal: {
      type: "object",
      description: "Runtime goal",
      properties: {
        id: {
          type: "string",
          description: "Unique workflow identifier",
        },
        objective: {
          type: "string",
          description: "Natural language objective",
        },
      },
      required: ["id", "objective"],
      additionalProperties: true,
    },
  },
  required: ["goal"],
  additionalProperties: false,
} as const;

export function registerAgentTools(registry: ToolRegistry<Env>): void {
  const tool: ToolDefinition<Env> = {
    description: "Execute Agent Runtime workflow.",

    inputSchema,

    validate(args) {
      return Validator.parse(args);
    },

    async execute(args, context) {
      const runtime = new AgentRuntime();

      try {
        return await runtime.run(args.goal, context.env, context.requestId);
      } catch (error) {
        return {
          success: false,
          requestId: context.requestId,
          error:
            error instanceof Error ? error.message : "Unknown runtime error",
        };
      }
    },
  };

  registry["agent.run"] = tool;
}
