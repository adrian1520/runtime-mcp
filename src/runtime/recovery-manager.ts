import { MemoryStore } from "./memory-store";
import type { Env } from "../server";

export class RecoveryManager {
  readonly memory = new MemoryStore();

  async resume(
    env: Env,
    requestId: string,
    workflowId: string
  ) {
    const state = await this.memory.get(
      env,
      requestId,
      `workflow/${workflowId}`
    );

    return {
      workflowId,
      recovered: true,
      state
    };
  }
}
