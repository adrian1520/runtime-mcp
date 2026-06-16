import type { TaskNode } from "./types";

export class TaskGraph {
  constructor(readonly tasks: TaskNode[]) {}

  roots(): TaskNode[] {
    return this.tasks.filter((task) => task.dependsOn.length === 0);
  }

  getTask(id: string): TaskNode | undefined {
    return this.tasks.find((task) => task.id === id);
  }

  next(completed: Set<string>): TaskNode[] {
    return this.tasks.filter((task) => {
      if (completed.has(task.id)) {
        return false;
      }

      return task.dependsOn.every((dep) => completed.has(dep));
    });
  }
}
