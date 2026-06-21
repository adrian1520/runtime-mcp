# ADR-004: Runtime Core v2 Agent Runtime Architecture

## Status

Accepted

## Context

The project started as an MCP-compatible gateway for Cloudflare Workers. Planning,
execution, workflow orchestration, memory management, provenance tracking, and
tool routing need to be owned by the runtime so external models can act only as
reasoning clients.

## Decision

Introduce an `AgentRuntime` orchestration layer composed of explicit runtime
contracts, a planner, an executor, a workflow engine, memory/provenance adapters,
and a capability-aware tool registry. Keep GPT and other models outside the
runtime boundary and available only through MCP clients/connectors.

## Consequences

- Runtime behavior is testable without model API dependencies.
- MCP discovery compatibility is preserved.
- Repository exploration can use generated index/tree metadata before reading
  whole files.
- Future DAG planning, branching, retries, and recovery can evolve behind stable
  contracts.
