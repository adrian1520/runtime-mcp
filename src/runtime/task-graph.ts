import type { Task } from "./contracts";

export class TaskGraph {
  constructor(readonly tasks: Task[]) {
    this.validate();
  }

  private validate(): void {
    const byId = new Map<string, Task>();

    for (const task of this.tasks) {
      if (!task || typeof task.id !== "string" || task.id.trim() === "") {
        throw new Error("Every task must have a non-empty id.");
      }
      if (byId.has(task.id)) {
        throw new Error("Duplicate task id: " + task.id);
      }
      if (!Array.isArray(task.dependsOn)) {
        throw new Error("Task " + task.id + " must define dependsOn as an array.");
      }
      byId.set(task.id, task);
    }

    const indegree = new Map<string, number>();
    const dependents = new Map<string, string[]>();

    for (const task of this.tasks) {
      const uniqueDependencies = new Set<string>();

      for (const dependencyId of task.dependsOn) {
        if (typeof dependencyId !== "string" || dependencyId.trim() === "") {
          throw new Error("Task " + task.id + " contains an invalid dependency id.");
        }
        if (uniqueDependencies.has(dependencyId)) {
          throw new Error(
            "Task " + task.id + " contains duplicate dependency: " + dependencyId,
          );
        }
        uniqueDependencies.add(dependencyId);

        if (!byId.has(dependencyId)) {
          throw new Error(
            "Task " + task.id + " depends on unknown task: " + dependencyId,
          );
        }
        if (dependencyId === task.id) {
          throw new Error("Task " + task.id + " cannot depend on itself.");
        }

        const children = dependents.get(dependencyId) ?? [];
        children.push(task.id);
        dependents.set(dependencyId, children);
      }

      indegree.set(task.id, uniqueDependencies.size);
    }

    const queue = this.tasks
      .filter((task) => indegree.get(task.id) === 0)
      .map((task) => task.id);
    let visited = 0;

    while (queue.length > 0) {
      const id = queue.shift()!;
      visited += 1;

      for (const childId of dependents.get(id) ?? []) {
        const nextDegree = indegree.get(childId)! - 1;
        indegree.set(childId, nextDegree);
        if (nextDegree === 0) queue.push(childId);
      }
    }

    if (visited !== this.tasks.length) {
      throw new Error("Task graph contains a dependency cycle.");
    }
  }

  roots(): Task[] {
    return this.tasks.filter((task) => task.dependsOn.length === 0);
  }

  getTask(id: string): Task | undefined {
    return this.tasks.find((task) => task.id === id);
  }

  next(completed: Set<string>, failed = new Set<string>()): Task[] {
    return this.tasks.filter((task) => {
      if (completed.has(task.id) || failed.has(task.id)) return false;
      return task.dependsOn.every((dependencyId) => completed.has(dependencyId));
    });
  }
}
