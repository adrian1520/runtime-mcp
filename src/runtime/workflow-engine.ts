import { Workflow } from "./workflow";
import { MemoryStore } from "./memory-store";
import { ProvenanceRecorder } from "./provenance-recorder";
import type { Goal } from "./types";
import type { Env } from "../server";

export class WorkflowEngine {
  readonly workflow = new Workflow();
  readonly memory = new MemoryStore();
  readonly provenance = new ProvenanceRecorder();

  async start(
    goal: Goal,
    env: Env,
    requestId: string
  ) {
    const graph = this.workflow.create(goal);

    await this.memory.put(
      env,
      requestId,
      `workflow/${goal.id}`,
      { goal }
    );

    await this.provenance.append(
      env,
      requestId,
      "workflow_started",
      { goalId: goal.id }
    );

    return graph;
  }
}
