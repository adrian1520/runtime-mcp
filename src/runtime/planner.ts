import type { ExecutionPlan, Goal, Task } from "./contracts";

function slug(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);
}

export class Planner {
  async createPlan(goal: Goal): Promise<ExecutionPlan> {
    this.validateGoal(goal);

    return {
      goal,
      tasks: this.build(goal),
    };
  }

  build(goal: Goal): Task[] {
    this.validateGoal(goal);

    const objective = goal.objective.trim().toLowerCase();

    if (
      objective.includes("audit") &&
      objective.includes("repository")
    ) {
      return this.withSequentialDependencies([
        {
          id: "scan-index",
          description: "Scan repository index",
          tool: "repository.index",
        },
        {
          id: "analyze-symbols",
          description: "Analyze repository symbols",
          tool: "repository.symbols",
        },
        {
          id: "analyze-dependencies",
          description: "Analyze dependencies",
          tool: "repository.dependencies",
        },
        {
          id: "generate-report",
          description: "Generate repository report",
        },
      ]);
    }

    if (
      objective.includes("search") ||
      objective.includes("find")
    ) {
      return this.withSequentialDependencies([
        {
          id: "search",
          description: `Search: ${goal.objective}`,
          tool: "repository.search",
          input: {
            query: goal.objective,
          },
        },
      ]);
    }

    if (
      objective.includes("read") ||
      objective.includes("open")
    ) {
      return this.withSequentialDependencies([
        {
          id: "read-file",
          description: goal.objective,
          tool: "repository.read",
        },
      ]);
    }

    const base = slug(goal.objective);

    return this.withSequentialDependencies([
      {
        id: `${base}-plan`,
        description: `Plan work for "${goal.objective}"`,
      },
      {
        id: `${base}-execute`,
        description: `Execute "${goal.objective}"`,
      },
      {
        id: `${base}-validate`,
        description: `Validate "${goal.objective}"`,
      },
    ]);
  }

  private validateGoal(goal: Goal): void {
    if (!goal) {
      throw new Error("Goal is required.");
    }

    if (typeof goal !== "object") {
      throw new Error("Goal must be an object.");
    }

    if (typeof goal.id !== "string" || goal.id.trim() === "") {
      throw new Error("Goal.id is required.");
    }

    if (
      typeof goal.objective !== "string" ||
      goal.objective.trim() === ""
    ) {
      throw new Error("Goal.objective is required.");
    }
  }

  private withSequentialDependencies(
    tasks: Array<
      Omit<Task, "dependsOn" | "status"> &
        Partial<Pick<Task, "dependsOn">>
    >,
  ): Task[] {
    return tasks.map((task, index) => ({
      ...task,
      dependsOn:
        task.dependsOn ??
        (index === 0 ? [] : [tasks[index - 1]!.id]),
      status: "pending",
    }));
  }
}