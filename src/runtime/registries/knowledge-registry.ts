import type { RuntimeRegistry } from "../registry";

export interface KnowledgeDefinition {
  id: string;
  version: string;
  name: string;
  description?: string;
}

export class KnowledgeRegistry implements RuntimeRegistry<KnowledgeDefinition> {
  private readonly knowledge = new Map<string, KnowledgeDefinition>();

  async register(definition: KnowledgeDefinition): Promise<void> {
    this.knowledge.set(definition.id, definition);
  }

  async get(id: string): Promise<KnowledgeDefinition | null> {
    return this.knowledge.get(id) ?? null;
  }

  async list(): Promise<KnowledgeDefinition[]> {
    return [...this.knowledge.values()];
  }

  async exists(id: string): Promise<boolean> {
    return this.knowledge.has(id);
  }

  async remove(id: string): Promise<void> {
    this.knowledge.delete(id);
  }
}
