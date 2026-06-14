import { Workflow } from "./workflow";
import { Executor } from "./executor";
import { MemoryStore } from "./memory-store";
import { ProvenanceRecorder } from "./provenance-recorder";

import type {
  Goal,
  Checkpoint,
  TaskResult
} from "./types";

import type { Env } from "../server";

export class WorkflowEngine {
  readonly workflow = new Workflow();
  readonly executor = new Executor();
  readonly memory = new MemoryStore();
  readonly provenance = new ProvenanceRecorder();

  async run(
    goal: Goal,
    env: Env,
    requestId: string
  ) {
    const graph =
      this.workflow.create(
        goal
      );

    const completed =
      new Set<string>();

    const results:
      TaskResult[] = [];

    await this.provenance.append(
      env,
      requestId,
      "workflow_started",
      {
        workflowId:
          goal.id
      }
    );

    while (true) {

      const nextTasks =
        graph.next(
          completed
        );

      if (
        nextTasks.length === 0
      ) {
        break;
      }

      for (
        const task
        of nextTasks
      ) {

        let result:
          TaskResult = {
            taskId:
              task.id,
            success:
              true
          };

        try {

          if (
            task.tool
          ) {

            result.output =
              await this.executor.runTool(
                task.tool,
                task.input,
                env,
                requestId
              );
          }

        } catch (
          error
        ) {

          result = {
            taskId:
              task.id,
            success:
              false,
            error:
              error instanceof Error
                ? error.message
                : "Unknown error"
          };

          await this.provenance.append(
            env,
            requestId,
            "task_failed",
            {
              workflowId:
                goal.id,
              taskId:
                task.id,
              error:
                result.error
            }
          );
        }

        completed.add(
          task.id
        );

        results.push(
          result
        );

        const checkpoint:
          Checkpoint = {
            workflowId:
              goal.id,
            completed:
              [...completed],
            lastTask:
              task.id
          };

        await this.memory.put(
          env,
          requestId,
          `workflow/${goal.id}/checkpoint`,
          checkpoint
        );

        await this.provenance.append(
          env,
          requestId,
          "task_completed",
          {
            workflowId:
              goal.id,
            taskId:
              task.id,
            success:
              result.success
          }
        );
      }
    }

    await this.memory.put(
      env,
      requestId,
      `workflow/${goal.id}/result`,
      {
        workflowId:
          goal.id,
        completed:
          [...completed],
        results
      }
    );

    await this.provenance.append(
      env,
      requestId,
      "workflow_completed",
      {
        workflowId:
          goal.id,
        completed:
          completed.size
      }
    );

    return {
      workflowId:
        goal.id,
      completed:
        [...completed],
      results
    };
  }
}
