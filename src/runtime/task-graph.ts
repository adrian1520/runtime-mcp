import type { Task } from "./contracts";

export class TaskGraph {
  constructor(readonly tasks: Task[]) {}

  roots(): Task[] {
    return this.tasks.filter((task) => task.dependsOn.length === 0);
  }

  getTask(id: string): Task | undefined {
    return this.tasks.find((task) => task.id === id);
  }

  next(completed: Set<string>, failed = new Set<string>()): Task[] {
    return this.tasks.filter((task) => {
      if (completed.has(task.id) || failed.has(task.id)) return false;
      return task.dependsOn.every((dep) => completed.has(dep));
    });
  }
}
