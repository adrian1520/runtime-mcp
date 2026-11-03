import { Workflow } from "./workflow";
import { TaskGraph } from "./task-graph";
import { Executor } from "./executor";
import { MemoryStore } from "./memory-store";
import { ProvenanceRecorder } from "./provenance-recorder";
import { RecoveryManager } from "./recovery-manager";
import { Planner } from "./planner";

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
  readonly workflow: Workflow;

  constructor(
    planner = new Planner(),
    readonly executor = new Executor(),
    readonly memory = new MemoryStore(executor),
    readonly provenance = new ProvenanceRecorder(executor),
    readonly recovery = new RecoveryManager(),
  ) {
    this.workflow = new Workflow(planner);
  }

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
      ...(lastTask ? { lastTask } : {}),
    };

    await this.memory.put(
      env,
      requestId,
      "workflow/" + workflowId + "/status",
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
    failed: string[];
    blocked: string[];
  }> {
    const results: TaskResult[] = [];
    const failed = new Set<string>();

    while (true) {
      const nextTasks = graph.next(completed, failed);
      if (nextTasks.length === 0) break;

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
          result = {
            taskId: task.id,
            success: false,
            error: error instanceof Error ? error.message : "Unknown error",
          };
          failed.add(task.id);
          await this.updateStatus(
            workflowId,
            "FAILED",
            env,
            requestId,
            task.id,
          );
        }

        if (result.success) completed.add(task.id);
        results.push(result);

        const checkpoint: Checkpoint = {
          workflowId,
          completed: [...completed],
          failed: [...failed],
          lastTask: task.id,
        };

        await this.memory.put(
          env,
          requestId,
          "workflow/" + workflowId + "/checkpoint",
          checkpoint,
        );

        await this.provenance.append(
          env,
          requestId,
          result.success ? "task_completed" : "task_failed",
          {
            workflowId,
            taskId: task.id,
            success: result.success,
            ...(result.error ? { error: result.error } : {}),
          },
        );
      }
    }

    const blocked = graph.tasks
      .filter((task) => !completed.has(task.id) && !failed.has(task.id))
      .map((task) => task.id);

    return {
      results,
      hasFailures: failed.size > 0,
      failed: [...failed],
      blocked,
    };
  }

  async run(goal: Goal, env: Env, requestId: string) {
    const tasks = this.workflow.planner.build(goal);
    const graph = new TaskGraph(tasks);

    const definition: WorkflowDefinition = {
      workflowId: goal.id,
      goal,
      tasks,
    };

    await this.memory.put(
      env,
      requestId,
      "workflow/" + goal.id + "/definition",
      definition,
    );

    await this.updateStatus(goal.id, "EXECUTION", env, requestId);

    // Start a fresh attempt so a prior result cannot contaminate recovery.
    await this.memory.put(
      env,
      requestId,
      "workflow/" + goal.id + "/checkpoint",
      { workflowId: goal.id, completed: [], failed: [] } satisfies Checkpoint,
    );

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

    const success = !execution.hasFailures && execution.blocked.length === 0;
    const finalResult = {
      workflowId: goal.id,
      completed: [...completed],
      failed: execution.failed,
      blocked: execution.blocked,
      success,
      results: execution.results,
    };

    await this.memory.put(
      env,
      requestId,
      "workflow/" + goal.id + "/result",
      finalResult,
    );

    await this.provenance.append(env, requestId, "workflow_completed", {
      workflowId: goal.id,
      completed: completed.size,
      failed: execution.failed,
      blocked: execution.blocked,
      success,
    });

    await this.updateStatus(
      goal.id,
      success ? "COMPLETE" : "FAILED",
      env,
      requestId,
    );

    return finalResult;
  }

  async resume(workflowId: string, env: Env, requestId: string) {
    const state = await this.recovery.resume(env, requestId, workflowId);

    if (!state.definition) {
      throw new Error("Workflow definition not found: " + workflowId);
    }

    const graph = new TaskGraph(state.definition.tasks);
    const completed = new Set<string>(state.completed);

    await this.updateStatus(workflowId, "RECOVERY", env, requestId);

    await this.provenance.append(env, requestId, "workflow_resumed", {
      workflowId,
      completed: completed.size,
      failedToRetry: state.failed.length,
      remaining: state.remaining.length,
    });

    // Failed tasks are retried on resume; successful tasks remain checkpointed.
    const execution = await this.executeGraph(
      workflowId,
      graph,
      completed,
      env,
      requestId,
    );

    const success = !execution.hasFailures && execution.blocked.length === 0;
    const finalResult = {
      workflowId,
      completed: [...completed],
      failed: execution.failed,
      blocked: execution.blocked,
      success,
      results: execution.results,
    };

    await this.memory.put(
      env,
      requestId,
      "workflow/" + workflowId + "/result",
      finalResult,
    );

    await this.provenance.append(env, requestId, "workflow_completed", {
      workflowId,
      completed: completed.size,
      failed: execution.failed,
      blocked: execution.blocked,
      success,
    });

    await this.updateStatus(
      workflowId,
      success ? "COMPLETE" : "FAILED",
      env,
      requestId,
    );

    return finalResult;
  }
}
