import { server, type Env } from "../server";
import { TaskGraph } from "./task-graph";
import { MemoryStore } from "./memory-store";
import { ProvenanceRecorder } from "./provenance-recorder";
import type { ExecutionPlan, ExecutionResult, Task, TaskExecutionResult } from "./contracts";

export class Executor {
  constructor(
    private readonly memory = new MemoryStore(undefined, true),
    private readonly provenance = new ProvenanceRecorder(undefined, true),
  ) {}

  async runTool(
    toolName: string,
    args: unknown,
    env: Env,
    requestId: string,
  ): Promise<unknown> {
    const tool = server.tools[toolName];
    if (!tool) throw new Error(`Tool not found: ${toolName}`);
    const validated = tool.validate(args);
    return tool.execute(validated, { env, requestId });
  }

  async execute(
    plan: ExecutionPlan,
    env?: Env,
    requestId: string = crypto.randomUUID(),
  ): Promise<ExecutionResult> {
    const tasks = plan.tasks.map((task) => ({ ...task }));
    const graph = new TaskGraph(tasks);
    const completed = new Set<string>();
    const failed = new Set<string>();
    const results: TaskExecutionResult[] = [];

    while (completed.size + failed.size < tasks.length) {
      const ready = graph.next(completed, failed);
      if (ready.length === 0) break;

      for (const task of ready) {
        task.status = "running";
        const result = await this.executeTask(task, plan, env, requestId);
        results.push(result);
        if (result.success) {
          task.status = "completed";
          completed.add(task.id);
        } else {
          task.status = "failed";
          failed.add(task.id);
        }
      }
    }

    const success = failed.size === 0 && completed.size === tasks.length;
    return { plan, tasks, results, success };
  }

  private async executeTask(
    task: Task,
    plan: ExecutionPlan,
    env: Env | undefined,
    requestId: string,
  ): Promise<TaskExecutionResult> {
    try {
      const output = task.tool && env
        ? await this.runTool(task.tool, task.input ?? {}, env, requestId)
        : { skipped: !task.tool, description: task.description };

      if (env) {
        await this.memory.put(env, requestId, `runtime/${plan.goal.id}/tasks/${task.id}`, output);
        await this.provenance.append(env, requestId, "task_executed", {
          goalId: plan.goal.id,
          taskId: task.id,
          tool: task.tool,
        });
      }

      return { taskId: task.id, success: true, output };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      if (env) {
        await this.provenance.append(env, requestId, "task_failed", {
          goalId: plan.goal.id,
          taskId: task.id,
          error: message,
        });
      }
      return { taskId: task.id, success: false, error: message };
    }
  }
}
