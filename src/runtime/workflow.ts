import { Planner } from "./planner";
import { TaskGraph } from "./task-graph";
import type { Goal } from "./contracts";

export class Workflow {
  constructor(readonly planner = new Planner()) {}

  create(goal: Goal): TaskGraph {
    return new TaskGraph(this.planner.build(goal));
  }
}
