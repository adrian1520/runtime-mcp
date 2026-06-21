import type { Executor } from "./executor";
import type { Env } from "../server";

export class ProvenanceRecorder {
  constructor(
    private readonly executor?: Executor,
    private readonly lazyExecutor = false,
  ) {}

  private async run(tool: string, args: unknown, env: Env, requestId: string) {
    if (this.lazyExecutor) {
      const { Executor } = await import("./executor");
      return new Executor(undefined, undefined).runTool(
        tool,
        args,
        env,
        requestId,
      );
    }
    if (!this.executor)
      throw new Error("ProvenanceRecorder requires an Executor");
    return this.executor.runTool(tool, args, env, requestId);
  }

  async append(env: Env, requestId: string, action: string, payload: unknown) {
    return this.run("provenance_append", { action, payload }, env, requestId);
  }

  async query(env: Env, requestId: string, prefix?: string) {
    return this.run("provenance_query", { prefix }, env, requestId);
  }
}
