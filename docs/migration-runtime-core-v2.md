# Migration Notes: Runtime Core v2

## What changed

- New runtime contracts live in `src/runtime/contracts`.
- `Planner.createPlan(goal)` returns an `ExecutionPlan` with dependency-aware tasks.
- `AgentRuntime.run(goal, env, requestId)` is the primary orchestration entrypoint.
- `Executor.execute(plan, env, requestId)` executes dependency-ready tasks, stores task output, and records provenance.
- Repository MCP tools now include `repository.files`, `repository.read`, `repository.search`, `repository.symbols`, `repository.index`, and `repository.dependencies`.

## Compatibility

- `/mcp` remains the MCP endpoint.
- Existing registered tools remain discoverable.
- `repository.query` remains available as a compatibility shim.
- `raw_read` and `raw_save` remain available.

## Recommended client migration

- Prefer `repository.read` over `repository.query` for direct file reads.
- Prefer `repository.files`, `repository.search`, and `repository.symbols` before loading file content.
- Use `AgentRuntime` for runtime-owned plans instead of calling planner/executor placeholders directly.
