import { MemoryStore } from "./memory-store";

import type {
  Checkpoint,
  WorkflowDefinition,
  RecoveryState
} from "./types";

import type { Env } from "../server";

export class RecoveryManager {
  readonly memory = new MemoryStore();

  async resume(
    env: Env,
    requestId: string,
    workflowId: string
  ): Promise<RecoveryState> {
    const definition = await this.memory.get(
      env,
      requestId,
      `workflow/${workflowId}/definition`
    );

    const checkpoint = await this.memory.get(
      env,
      requestId,
      `workflow/${workflowId}/checkpoint`
    );

    const workflowDefinition =
      definition as WorkflowDefinition | null;

    const workflowCheckpoint =
      checkpoint as Checkpoint | null;

    const completed =
      workflowCheckpoint?.completed ?? [];

    const remaining =
      workflowDefinition?.tasks
        .filter(
          task => !completed.includes(task.id)
        )
        .map(
          task => task.id
        ) ?? [];

    return {
      workflowId,
      definition: workflowDefinition,
      checkpoint: workflowCheckpoint,
      completed,
      remaining
    };
  }
}
