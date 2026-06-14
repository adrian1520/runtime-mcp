import { WorkflowEngine } from "./workflow-engine";
import { StateMachine } from "./state-machine";
import type { Goal, ExecutionResult } from "./types";
import type { Env } from "../server";

export class Agent {
  readonly engine = new WorkflowEngine();
  readonly state = new StateMachine();

  async execute(
    goal: Goal,
    env: Env,
    requestId: string
  ): Promise<ExecutionResult> {
    try {
      this.state.transition("PLANNING");
      const graph = await this.engine.start(goal, env, requestId);
      this.state.transition("EXECUTION");
      this.state.transition("VALIDATION");
      this.state.transition("COMPLETE");

      return {
        success: true,
        state: this.state.current,
        result: graph
      };
    } catch (error) {
      return {
        success: false,
        state: "FAILED",
        error: error instanceof Error ? error.message : "Unknown runtime error"
      };
    }
  }
}
