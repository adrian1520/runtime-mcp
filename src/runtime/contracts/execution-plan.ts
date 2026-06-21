import type { Goal } from "./goal";
import type { Task } from "./task";

export interface ExecutionPlan {
  goal: Goal;
  tasks: Task[];
}
