import type { ExecutionPlan } from "./execution-plan";
import type { Task } from "./task";

export interface TaskExecutionResult {
  taskId: string;
  success: boolean;
  output?: unknown;
  error?: string;
}

export interface ExecutionResult {
  plan: ExecutionPlan;
  tasks: Task[];
  results: TaskExecutionResult[];
  success: boolean;
}
