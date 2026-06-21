import type { ExecutionPlan, Goal, Task } from "./contracts";

function slug(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);
}

export class Planner {
  async createPlan(goal: Goal): Promise<ExecutionPlan> {
    return { goal, tasks: this.build(goal) };
  }

  build(goal: Goal): Task[] {
    const objective = goal.objective.toLowerCase();

    if (objective.includes("audit") && objective.includes("repository")) {
      return this.withSequentialDependencies([
        {
          id: "scan-index",
          description: "Scan repository index",
          tool: "repository.index",
        },
        {
          id: "analyze-structure",
          description: "Analyze repository structure",
          tool: "repository.symbols",
        },
        { id: "generate-report", description: "Generate audit report" },
      ]);
    }

    const base = slug(goal.objective) || "goal";
    return this.withSequentialDependencies([
      { id: `${base}-plan`, description: `Plan work for: ${goal.objective}` },
      {
        id: `${base}-execute`,
        description: `Execute work for: ${goal.objective}`,
      },
      {
        id: `${base}-validate`,
        description: `Validate result for: ${goal.objective}`,
      },
    ]);
  }

  private withSequentialDependencies(
    tasks: Array<
      Omit<Task, "dependsOn" | "status"> & Partial<Pick<Task, "dependsOn">>
    >,
  ): Task[] {
    return tasks.map((task, index) => ({
      ...task,
      dependsOn:
        task.dependsOn ?? (index === 0 ? [] : [tasks[index - 1]?.id ?? ""]),
      status: "pending",
    }));
  }
}
