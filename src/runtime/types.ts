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

export interface Checkpoint {
  workflowId: string;
  completed: string[];
  lastTask?: string;
}

export interface TaskResult {
  taskId: string;
  success: boolean;
  output?: unknown;
  error?: string;
}

export interface ExecutionResult {
  success: boolean;
  state: RuntimeState;
  result?: unknown;
  error?: string;
  checkpoint?: Checkpoint;
}

export interface WorkflowDefinition {
  workflowId: string;
  goal: Goal;
  tasks: TaskNode[];
}

export interface RecoveryState {
  workflowId: string;
  checkpoint: Checkpoint | null;
  definition: WorkflowDefinition | null;
  completed: string[];
  remaining: string[];
}

export interface WorkflowMetadata {
  createdAt?: string;
  updatedAt?: string;
  version?: string;
}

export interface WorkflowSnapshot {
  definition: WorkflowDefinition;
  checkpoint?: Checkpoint;
  results?: TaskResult[];
  metadata?: WorkflowMetadata;
}
