# Future Refactor V12 - Implementation Roadmap

## Status
Architecture approved.

Focus shifts from documentation to implementation.

## Phase 1 - Foundation

Create:

src/mcps/
src/providers/
src/runtime/capabilities/

Implement:

- McpManifest
- McpRegistry
- CapabilityRegistry
- ProviderRegistry

Deliverable:

Runtime capable of registering MCP packages and capabilities.

---

## Phase 2 - Capability Resolution

Implement:

- CapabilityResolver
- ProviderResolver

Execution Flow:

Planner
 -> Capability
 -> Provider
 -> Tool

Deliverable:

Capabilities become execution entry points.

---

## Phase 3 - First MCP Package

Create:

mcps/github-mcp/

Implement:

- repository.read
- repository.search

Deliverable:

First installable MCP package.

---

## Phase 4 - Runtime Integration

Refactor Executor.

Current:
Goal -> Task -> Tool

Future:
Goal -> Capability -> Provider -> Tool

Deliverable:

Capability-driven execution.

---

## Phase 5 - Runtime Kernel MVP

Create:

src/kernel/

Implement:

- executeGoal()
- executeCapability()
- resolveProvider()

Deliverable:

Kernel facade operational.

---

## Phase 6 - Advanced Platform

Implement:

- Execution Planner
- Environment Manager
- Security Model
- Recovery Enhancements

---

## Phase 7 - Marketplace

Implement:

- Package Discovery
- Package Install
- Package Upgrade
- Trust Validation

---

## Success Criteria

1. MCP package can be installed.
2. Capability can be resolved.
3. Provider can execute capability.
4. Runtime can execute capability graph.
5. Kernel becomes primary execution interface.