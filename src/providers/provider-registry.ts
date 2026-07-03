import type { RuntimeRegistry } from "../runtime/registry";
import type { Provider } from "./provider";

export class ProviderRegistry implements RuntimeRegistry<Provider> {
  private readonly providers = new Map<string, Provider>();

  async register(definition: Provider): Promise<void> {
    this.providers.set(definition.id, definition);
  }

  async get(id: string): Promise<Provider | null> {
    return this.providers.get(id) ?? null;
  }

  async list(): Promise<Provider[]> {
    return [...this.providers.values()];
  }

  async exists(id: string): Promise<boolean> {
    return this.providers.has(id);
  }

  async remove(id: string): Promise<void> {
    this.providers.delete(id);
  }

  async resolve(capability: string): Promise<Provider | null> {
    return (
      [...this.providers.values()].find((provider) =>
        provider.capabilities.includes(capability),
      ) ?? null
    );
  }
}
