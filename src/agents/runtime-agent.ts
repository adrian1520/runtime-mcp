export interface AgentRuntime {
  run(goal: string, sessionId: string): Promise<unknown>;
}
