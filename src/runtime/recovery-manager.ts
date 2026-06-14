import { MemoryStore } from "./memory-store";
import type { Checkpoint } from "./types";
import type { Env } from "../server";

export class RecoveryManager {
  readonly memory = new MemoryStore();

  async resume(
    env: Env,
    requestId: string,
    workflowId: string
  ) {
    const checkpoint = await this.memory.get(
      env,
      requestId,
      `workflow/${workflowId}/checkpoint`
    );

    return {
      workflowId,
      recovered: checkpoint != null,
      checkpoint: checkpoint as Checkpoint | null
    };
  }
}
