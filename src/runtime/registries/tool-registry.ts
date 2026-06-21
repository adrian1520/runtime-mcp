import type { RuntimeRegistry } from "../registry";
import type { ToolDefinition } from "../types";

export interface ToolCapability extends ToolDefinition {
  name: string;
  description: string;
  capabilities: string[];
  cost: number;
  risk: "low" | "medium" | "high";
}

export class ToolRegistry implements RuntimeRegistry<ToolCapability> {
  private readonly tools = new Map<string, ToolCapability>();

  async register(definition: ToolCapability): Promise<void> {
    this.tools.set(definition.id, definition);
  }

  async unregister(id: string): Promise<void> {
    this.tools.delete(id);
  }

  async get(id: string): Promise<ToolCapability | null> {
    return this.tools.get(id) ?? null;
  }

  async list(): Promise<ToolCapability[]> {
    return [...this.tools.values()];
  }

  async exists(id: string): Promise<boolean> {
    return this.tools.has(id);
  }

  async remove(id: string): Promise<void> {
    await this.unregister(id);
  }

  async findByCapability(capability: string): Promise<ToolCapability[]> {
    return [...this.tools.values()].filter((tool) =>
      tool.capabilities.includes(capability),
    );
  }

  async listCapabilities(): Promise<string[]> {
    return [...new Set([...this.tools.values()].flatMap((tool) => tool.capabilities))].sort();
  }
}
