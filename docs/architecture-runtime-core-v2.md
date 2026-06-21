# Runtime Core Architecture v2

```text
User Goal
    │
    ▼
AgentRuntime
    │
    ├── ContextBuilder (external or caller-supplied context)
    ├── Planner ───────────────► ExecutionPlan / task DAG
    ├── Executor ──────────────► Tool selection and execution
    ├── WorkflowEngine ────────► retries, checkpoints, recovery
    ├── MemoryStore ───────────► durable runtime outputs
    ├── ProvenanceRecorder ────► execution audit trail
    └── ToolRegistry ──────────► capability metadata and routing
```

`runtime-mcp` owns runtime planning, execution, orchestration, memory updates,
provenance events, and MCP tool routing. GPT or any other model remains an
external reasoning client that calls `/mcp`; the runtime does not embed an
OpenAI API client.
