import { Workflow } from "./workflow";
import { TaskGraph } from "./task-graph";
import { Executor } from "./executor";
import { MemoryStore } from "./memory-store";
import { ProvenanceRecorder } from "./provenance-recorder";
import { RecoveryManager } from "./recovery-manager";

import type {
  Goal,
  Checkpoint,
  TaskResult,
  WorkflowDefinition,
  WorkflowStatus,
  RuntimeState,
} from "./types";

import type { Env } from "../server";

export class WorkflowEngine {
  readonly workflow = new Workflow();
  readonly executor = new Executor();
  readonly memory = new MemoryStore();
  readonly provenance = new ProvenanceRecorder();
  readonly recovery = new RecoveryManager();

  private async updateStatus(
    workflowId: string,
    state: RuntimeState,
    env: Env,
    requestId: string,
    lastTask?: string,
  ) {
    const status: WorkflowStatus = {
      workflowId,
      state,
      updatedAt: new Date().toISOString(),
      lastTask,
    };

    await this.memory.put(
      env,
      requestId,
      `workflow/${workflowId}/status`,
      status,
    );
  }

  private async executeGraph(
    workflowId: string,
    graph: TaskGraph,
    completed: Set<string>,
    env: Env,
    requestId: string,
  ): Promise<{
    results: TaskResult[];
    hasFailures: boolean;
  }> {
    const results: TaskResult[] = [];
    let hasFailures = false;

    while (true) {
      const nextTasks = graph.next(completed);

      if (nextTasks.length === 0) {
        break;
      }

      for (const task of nextTasks) {
        let result: TaskResult = {
          taskId: task.id,
          success: true,
        };

        try {
          if (task.tool) {
            result.output = await this.executor.runTool(
              task.tool,
              task.input,
              env,
              requestId,
            );
          }
        } catch (error) {
          hasFailures = true;

          result = {
            taskId: task.id,
            success: false,
            error: error instanceof Error ? error.message : "Unknown error",
          };

          await this.updateStatus(
            workflowId,
            "FAILED",
            env,
            requestId,
            task.id,
          );

          await this.provenance.append(env, requestId, "task_failed", {
            workflowId,
            taskId: task.id,
            error: result.error,
          });
        }

        completed.add(task.id);

        results.push(result);

        const checkpoint: Checkpoint = {
          workflowId,
          completed: [...completed],
          lastTask: task.id,
        };

        await this.memory.put(
          env,
          requestId,
          `workflow/${workflowId}/checkpoint`,
          checkpoint,
        );

        await this.provenance.append(env, requestId, "task_completed", {
          workflowId,
          taskId: task.id,
          success: result.success,
        });
      }
    }

    return {
      results,
      hasFailures,
    };
  }

  async run(goal: Goal, env: Env, requestId: string) {
    const tasks = this.workflow.planner.build(goal);

    const definition: WorkflowDefinition = {
      workflowId: goal.id,
      goal,
      tasks,
    };

    await this.memory.put(
      env,
      requestId,
      `workflow/${goal.id}/definition`,
      definition,
    );

    await this.updateStatus(goal.id, "EXECUTION", env, requestId);

    const graph = new TaskGraph(tasks);

    const completed = new Set<string>();

    await this.provenance.append(env, requestId, "workflow_started", {
      workflowId: goal.id,
    });

    const execution = await this.executeGraph(
      goal.id,
      graph,
      completed,
      env,
      requestId,
    );

    const finalResult = {
      workflowId: goal.id,
      completed: [...completed],
      results: execution.results,
    };

    await this.memory.put(
      env,
      requestId,
      `workflow/${goal.id}/result`,
      finalResult,
    );

    await this.provenance.append(env, requestId, "workflow_completed", {
      workflowId: goal.id,
      completed: completed.size,
    });

    await this.updateStatus(
      goal.id,
      execution.hasFailures ? "FAILED" : "COMPLETE",
      env,
      requestId,
    );

    return finalResult;
  }

  async resume(workflowId: string, env: Env, requestId: string) {
    const state = await this.recovery.resume(env, requestId, workflowId);

    if (!state.definition) {
      throw new Error(`Workflow definition not found: ${workflowId}`);
    }

    const graph = new TaskGraph(state.definition.tasks);

    const completed = new Set<string>(state.completed);

    await this.updateStatus(workflowId, "RECOVERY", env, requestId);

    await this.provenance.append(env, requestId, "workflow_resumed", {
      workflowId,
      completed: completed.size,
      remaining: state.remaining.length,
    });

    const execution = await this.executeGraph(
      workflowId,
      graph,
      completed,
      env,
      requestId,
    );

    const finalResult = {
      workflowId,
      completed: [...completed],
      results: execution.results,
    };

    await this.memory.put(
      env,
      requestId,
      `workflow/${workflowId}/result`,
      finalResult,
    );

    await this.provenance.append(env, requestId, "workflow_completed", {
      workflowId,
      completed: completed.size,
    });

    await this.updateStatus(
      workflowId,
      execution.hasFailures ? "FAILED" : "COMPLETE",
      env,
      requestId,
    );

    return finalResult;
  }
}
