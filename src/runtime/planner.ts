import type { Goal, TaskNode } from "./types";

export class Planner {
  build(goal: Goal): TaskNode[] {
    void goal;

    return [
      { id: "analyse", name: "Analyse objective", dependsOn: [] },
      { id: "execute", name: "Execute plan", dependsOn: ["analyse"] },
      { id: "validate", name: "Validate result", dependsOn: ["execute"] },
    ];
  }
}
