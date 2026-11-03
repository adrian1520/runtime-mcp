import { MemoryStore } from "./memory-store";
import { TaskGraph } from "./task-graph";
import type { Checkpoint, WorkflowDefinition, RecoveryState } from "./types";
import type { Env } from "../server";

type PriorResult = {
  results?: Array<{ taskId?: unknown; success?: unknown }>;
};

export class RecoveryManager {
  constructor(readonly memory = new MemoryStore(undefined, true)) {}

  async resume(env: Env, requestId: string, workflowId: string): Promise<RecoveryState> {
    const [definition, checkpoint, priorResult] = await Promise.all([
      this.memory.get(env, requestId, "workflow/" + workflowId + "/definition"),
      this.memory.get(env, requestId, "workflow/" + workflowId + "/checkpoint"),
      this.memory.get(env, requestId, "workflow/" + workflowId + "/result"),
    ]);

    const workflowDefinition = definition as WorkflowDefinition | null;
    if (!workflowDefinition) {
      return {
        workflowId,
        definition: null,
        checkpoint: null,
        completed: [],
        remaining: [],
        failed: [],
      };
    }

    if (
      workflowDefinition.workflowId !== workflowId ||
      !Array.isArray(workflowDefinition.tasks)
    ) {
      throw new Error("Invalid workflow definition: " + workflowId);
    }

    const graph = new TaskGraph(workflowDefinition.tasks);
    const taskIds = new Set(graph.tasks.map((task) => task.id));
    const workflowCheckpoint = checkpoint as Checkpoint | null;

    let completedFromCheckpoint: string[] = [];
    let failedFromCheckpoint: string[] = [];

    if (workflowCheckpoint) {
      if (
        workflowCheckpoint.workflowId !== workflowId ||
        !Array.isArray(workflowCheckpoint.completed) ||
        (workflowCheckpoint.failed !== undefined &&
          !Array.isArray(workflowCheckpoint.failed))
      ) {
        throw new Error("Invalid workflow checkpoint: " + workflowId);
      }
      completedFromCheckpoint = workflowCheckpoint.completed;
      failedFromCheckpoint = workflowCheckpoint.failed ?? [];
    }

    const assertKnownUniqueIds = (ids: string[], label: string): void => {
      const seen = new Set<string>();
      for (const id of ids) {
        if (typeof id !== "string" || !taskIds.has(id)) {
          throw new Error(
            "Checkpoint contains unknown " + label + " task id: " + String(id),
          );
        }
        if (seen.has(id)) {
          throw new Error(
            "Checkpoint contains duplicate " + label + " task id: " + id,
          );
        }
        seen.add(id);
      }
    };

    assertKnownUniqueIds(completedFromCheckpoint, "completed");
    assertKnownUniqueIds(failedFromCheckpoint, "failed");

    const overlap = failedFromCheckpoint.find((id) =>
      completedFromCheckpoint.includes(id),
    );
    if (overlap) {
      throw new Error(
        "Checkpoint task cannot be both completed and failed: " + overlap,
      );
    }

    // Reconstruct old failures only for checkpoints written before failed[] existed.
    const isLegacyCheckpoint =
      !workflowCheckpoint || workflowCheckpoint.failed === undefined;
    const result = priorResult as PriorResult | null;
    const failuresFromResult =
      isLegacyCheckpoint && Array.isArray(result?.results)
        ? result!.results!
            .filter(
              (item) =>
                item?.success === false && typeof item.taskId === "string",
            )
            .map((item) => item.taskId as string)
        : [];

    assertKnownUniqueIds([...new Set(failuresFromResult)], "result-failed");

    const failed = [
      ...new Set([...failedFromCheckpoint, ...failuresFromResult]),
    ];
    const completed = completedFromCheckpoint.filter(
      (id) => !failed.includes(id),
    );
    const normalizedCheckpoint: Checkpoint | null = workflowCheckpoint
      ? { ...workflowCheckpoint, completed, failed }
      : null;
    const remaining = graph.tasks
      .filter((task) => !completed.includes(task.id))
      .map((task) => task.id);

    return {
      workflowId,
      definition: workflowDefinition,
      checkpoint: normalizedCheckpoint,
      completed,
      remaining,
      failed,
    };
  }
}
