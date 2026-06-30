import { z } from "zod";

import type { ToolDefinition, ToolRegistry } from "../../contracts/tool";
import { AgentRuntime } from "../../runtime/agent-runtime";
import type { Goal } from "../../runtime/contracts";
import type { Env } from "../../server";

const inputSchema = {
  type: "object",
  properties: {
    goal: {
      type: "object",
      description: "Goal passed to AgentRuntime",
      additionalProperties: true,
    },
  },
  required: ["goal"],
  additionalProperties: false,
} as const;

const validator = z.object({
  goal: z.unknown(),
});

export function registerAgentTools(registry: ToolRegistry<Env>): void {
  const tool: ToolDefinition<Env> = {
    description: "Execute Agent Runtime goal.",

    inputSchema,

    validate(args) {
      return validator.parse(args);
    },

    async execute(args, context) {
      const runtime = new AgentRuntime();

      const goal = args.goal as Goal;

      return runtime.run(goal, context.env, context.requestId);
    },
  };

  registry["agent.run"] = tool;
}
