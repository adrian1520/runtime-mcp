import type { Executor } from "./executor";
import type { Env } from "../server";

export class MemoryStore {
  constructor(
    private readonly executor?: Executor,
    private readonly lazyExecutor = false,
  ) {}

  private get runner(): Executor {
    if (this.executor) return this.executor;
    // Lazy dynamic require is unavailable in ESM, so import statically via runtime constructor boundary.
    throw new Error("MemoryStore requires an Executor for tool-backed operations");
  }

  async put(env: Env, requestId: string, key: string, value: unknown, ttl?: number) {
    if (this.lazyExecutor) {
      const { Executor } = await import("./executor");
      return new Executor(undefined, undefined).runTool("memory_put", { key, value, ttl }, env, requestId);
    }
    return this.runner.runTool("memory_put", { key, value, ttl }, env, requestId);
  }

  async get(env: Env, requestId: string, key: string) {
    if (this.lazyExecutor) {
      const { Executor } = await import("./executor");
      return new Executor(undefined, undefined).runTool("memory_get", { key }, env, requestId);
    }
    return this.runner.runTool("memory_get", { key }, env, requestId);
  }

  async exists(env: Env, requestId: string, key: string) {
    if (this.lazyExecutor) {
      const { Executor } = await import("./executor");
      return new Executor(undefined, undefined).runTool("memory_exists", { key }, env, requestId);
    }
    return this.runner.runTool("memory_exists", { key }, env, requestId);
  }
}
