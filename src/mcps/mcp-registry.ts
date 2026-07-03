import type { RuntimeRegistry } from "../runtime/registry";
import type { McpManifest } from "./manifest";

export class McpRegistry implements RuntimeRegistry<McpManifest> {
  private readonly mcps = new Map<string, McpManifest>();

  async register(definition: McpManifest): Promise<void> {
    this.mcps.set(definition.id, definition);
  }

  async get(id: string): Promise<McpManifest | null> {
    return this.mcps.get(id) ?? null;
  }

  async list(): Promise<McpManifest[]> {
    return [...this.mcps.values()];
  }

  async exists(id: string): Promise<boolean> {
    return this.mcps.has(id);
  }

  async remove(id: string): Promise<void> {
    this.mcps.delete(id);
  }
}
