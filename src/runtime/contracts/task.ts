export type TaskStatus = "pending" | "running" | "completed" | "failed";

export interface Task {
  id: string;
  description: string;
  tool?: string;
  input?: unknown;
  dependsOn: string[];
  status: TaskStatus;
}
