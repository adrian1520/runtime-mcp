import type { RuntimeRegistry } from "../registry";
import type { CapabilityDescriptor } from "./capability";

export class CapabilityRegistry implements RuntimeRegistry<CapabilityDescriptor> {
  private readonly capabilities = new Map<string, CapabilityDescriptor>();

  async register(definition: CapabilityDescriptor): Promise<void> {
    this.capabilities.set(definition.id, definition);
  }

  async get(id: string): Promise<CapabilityDescriptor | null> {
    return this.capabilities.get(id) ?? null;
  }

  async list(): Promise<CapabilityDescriptor[]> {
    return [...this.capabilities.values()];
  }

  async exists(id: string): Promise<boolean> {
    return this.capabilities.has(id);
  }

  async remove(id: string): Promise<void> {
    this.capabilities.delete(id);
  }
}
