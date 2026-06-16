import { Executor } from "./executor";
import type { Env } from "../server";

export class ProvenanceRecorder {
  constructor(private readonly executor = new Executor()) {}

  async append(env: Env, requestId: string, action: string, payload: unknown) {
    return this.executor.runTool(
      "provenance_append",
      { action, payload },
      env,
      requestId,
    );
  }

  async query(env: Env, requestId: string, prefix?: string) {
    return this.executor.runTool(
      "provenance_query",
      { prefix },
      env,
      requestId,
    );
  }
}
