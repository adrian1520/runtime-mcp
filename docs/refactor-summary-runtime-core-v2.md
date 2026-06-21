# Runtime Core Refactor v2 Summary

The codebase now models an agent runtime rather than only a simple MCP tool gateway.
The new runtime core introduces explicit goal, task, plan, and execution result
contracts; a dependency-aware planner; an executor that records memory and
provenance; an orchestration `AgentRuntime`; capability metadata for registered
runtime tools; and repository-specific MCP tools backed by generated repository
indexes.

No OpenAI-specific dependency or API integration was added. The runtime remains
MCP-compatible and continues exposing tools through `/mcp`.
