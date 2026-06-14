import { Workflow } from "./workflow";
import type { Goal } from "./types";

export class WorkflowEngine {
  readonly workflow = new Workflow();

  start(goal: Goal) {
    return this.workflow.create(goal);
  }
}
