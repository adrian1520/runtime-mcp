import { Workflow } from "./workflow";
import { StateMachine } from "./state-machine";
import type { Goal, ExecutionResult } from "./types";

export class Agent {
  readonly workflow = new Workflow();
  readonly state = new StateMachine();

  async execute(goal: Goal): Promise<ExecutionResult> {
    try {
      this.state.transition("PLANNING");
      const graph = this.workflow.create(goal);
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
