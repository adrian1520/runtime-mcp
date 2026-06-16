import { Executor } from "./executor";
import type { Env } from "../server";

export class MemoryStore {
  constructor(private readonly executor = new Executor()) {}

  async put(
    env: Env,
    requestId: string,
    key: string,
    value: unknown,
    ttl?: number,
  ) {
    return this.executor.runTool(
      "memory_put",
      { key, value, ttl },
      env,
      requestId,
    );
  }

  async get(env: Env, requestId: string, key: string) {
    return this.executor.runTool("memory_get", { key }, env, requestId);
  }

  async exists(env: Env, requestId: string, key: string) {
    return this.executor.runTool("memory_exists", { key }, env, requestId);
  }
}
