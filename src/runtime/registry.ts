export interface RuntimeRegistry<T> {
  register(definition: T): Promise<void>;
  get(id: string): Promise<T | null>;
  list(): Promise<T[]>;
  exists(id: string): Promise<boolean>;
  remove(id: string): Promise<void>;
}

export interface RegistryRecord {
  id: string;
  version: string;
  kind: "tool" | "workflow" | "agent" | "knowledge";
  createdAt: string;
  updatedAt: string;
}
