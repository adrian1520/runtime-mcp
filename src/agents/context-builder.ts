export interface ContextBuilder {
  build(sessionId: string): Promise<string>;
}
