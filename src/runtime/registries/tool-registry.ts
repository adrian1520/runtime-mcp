import type { RuntimeRegistry } from "../registry";

export interface ToolDefinition {
  id: string;
  version: string;
  name: string;
  description?: string;
}

export class ToolRegistry implements RuntimeRegistry<ToolDefinition> {
  private readonly tools = new Map<string, ToolDefinition>();

  async register(definition: ToolDefinition): Promise<void> {
    this.tools.set(definition.id, definition);
  }

  async get(id: string): Promise<ToolDefinition | null> {
    return this.tools.get(id) ?? null;
  }

  async list(): Promise<ToolDefinition[]> {
    return [...this.tools.values()];
  }

  async exists(id: string): Promise<boolean> {
    return this.tools.has(id);
  }

  async remove(id: string): Promise<void> {
    this.tools.delete(id);
  }
}
