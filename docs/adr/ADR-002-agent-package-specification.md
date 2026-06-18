# ADR-002 — Agent Package Specification & Lifecycle

Status: Accepted

Depends on: ADR-001 Agent Runtime Platform

## Decision

Agent becomes the primary execution unit of the platform.

Each agent is stored in GitHub and may contain:
- prompts
- memory
- knowledge
- workflows
- tools
- UI
- Python scripts

## Layout

```text
agents/
 └─ runtime-mcp/
     ├─ agent.json
     ├─ system.md
     ├─ knowledge/
     ├─ memory/
     ├─ workflows/
     ├─ tools.json
     ├─ resources.json
     ├─ ui/
     └─ python/
```

## Lifecycle

Created → Loaded → Opened → Executing → Suspended → Closed

## Core Operations

- agent_create
- agent_open
- agent_read
- agent_update
- agent_execute
- agent_analyze
- agent_evolve
- agent_snapshot
- agent_restore

## Persistence

GitHub is the system of record.

KV stores:
- active sessions
- active agent
- cache
- indexes
- execution state

## Long-Term Goal

Transform Runtime MCP into an Agent Runtime Platform capable of loading, executing, evolving and presenting agents through MCP, GitHub persistence, Python execution and React UI.
