export type RuntimeState =
  | "DISCOVERY"
  | "PLANNING"
  | "EXECUTION"
  | "VALIDATION"
  | "COMPLETE"
  | "FAILED"
  | "RECOVERY";

export interface Goal {
  id: string;
  objective: string;
  metadata?: Record<string, unknown>;
}

export interface TaskNode {
  id: string;
  name: string;
  tool?: string;
  input?: unknown;
  dependsOn: string[];
}

export interface ExecutionContext {
  requestId: string;
  goal: Goal;
}

export interface ExecutionResult {
  success: boolean;
  state: RuntimeState;
  result?: unknown;
  error?: string;
}

export interface WorkflowDefinition {
  name: string;
  states: RuntimeState[];
}
