import type { RuntimeRegistry } from "../registry";
import type { AgentDefinition } from "../types";

export class AgentRegistry implements RuntimeRegistry<AgentDefinition> {
  private readonly agents = new Map<string, AgentDefinition>();

  async register(definition: AgentDefinition): Promise<void> {
    this.agents.set(definition.id, definition);
  }

  async get(id: string): Promise<AgentDefinition | null> {
    return this.agents.get(id) ?? null;
  }

  async list(): Promise<AgentDefinition[]> {
    return [...this.agents.values()];
  }

  async exists(id: string): Promise<boolean> {
    return this.agents.has(id);
  }

  async remove(id: string): Promise<void> {
    this.agents.delete(id);
  }
}