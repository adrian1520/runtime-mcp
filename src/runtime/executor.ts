import { server, type Env } from "../server";

export class Executor {
  async runTool(
    toolName: string,
    args: unknown,
    env: Env,
    requestId: string,
  ): Promise<unknown> {
    const tool = server.tools[toolName];

    if (!tool) {
      throw new Error(`Tool not found: ${toolName}`);
    }

    const validated = tool.validate(args);

    return tool.execute(validated, {
      env,
      requestId,
    });
  }
}
