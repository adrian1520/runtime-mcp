import type { ToolDescriptor } from './types';

export interface ToolCatalog {
  list(): Promise<ToolDescriptor[]>;
  get(id: string): Promise<ToolDescriptor | null>;
}
