import { Executor } from "./executor";
import { MemoryStore } from "./memory-store";
import { Planner } from "./planner";
import { ProvenanceRecorder } from "./provenance-recorder";
import { WorkflowEngine } from "./workflow-engine";
import type { Goal } from "./contracts";
import type { Env } from "../server";

export class AgentRuntime {
  readonly planner: Planner;
  readonly executor: Executor;
  readonly memory: MemoryStore;
  readonly provenance: ProvenanceRecorder;
  readonly workflow: WorkflowEngine;

  constructor() {
    this.planner = new Planner();
    this.executor = new Executor();
    this.memory = new MemoryStore(this.executor);
    this.provenance = new ProvenanceRecorder(this.executor);
    this.workflow = new WorkflowEngine(this.planner, this.executor, this.memory, this.provenance);
  }

  async run(goal: Goal, env?: Env, requestId?: string) {
    const plan = await this.planner.createPlan(goal);
    return this.executor.execute(plan, env, requestId ?? crypto.randomUUID());
  }
}
