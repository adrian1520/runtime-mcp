import type { WorkflowDefinition } from "../types";
import type { RuntimeRegistry } from "../registry";

export class WorkflowRegistry
  implements RuntimeRegistry<WorkflowDefinition> {

  private readonly workflows =
    new Map<string, WorkflowDefinition>();

  async register(
    definition: WorkflowDefinition
  ): Promise<void> {
    this.workflows.set(
      definition.workflowId,
      definition
    );
  }

  async get(
    id: string
  ): Promise<WorkflowDefinition | null> {
    return this.workflows.get(id) ?? null;
  }

  async list(): Promise<WorkflowDefinition[]> {
    return [...this.workflows.values()];
  }

  async exists(
    id: string
  ): Promise<boolean> {
    return this.workflows.has(id);
  }

  async remove(
    id: string
  ): Promise<void> {
    this.workflows.delete(id);
  }
}
