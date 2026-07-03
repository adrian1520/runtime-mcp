export interface Provider {
  id: string;
  capabilities: string[];
  execute(capability: string, input: unknown): Promise<unknown>;
}
