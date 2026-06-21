# Future Refactor V4 - Capability Registry Specification

## Purpose

Capability Registry becomes the primary discovery and routing layer of Runtime-MCP.

Runtime should not depend directly on MCP packages.
Runtime should depend on capabilities.

MCP packages become providers of capabilities.

---

## Core Principle

Runtime -> Capability -> Provider -> MCP Package

Instead of:

Runtime -> MCP Package

---

## Capability Definition

Capability is a globally unique contract.

Examples:

- repository.read
- repository.search
- repository.write
- workflow.execute
- memory.store
- memory.query
- architecture.analyze
- documentation.generate
- code.refactor
- code.patch

---

## Capability Descriptor

interface CapabilityDescriptor {
  id: string
  version: string
  description: string
  inputSchema: JsonSchema
  outputSchema: JsonSchema
  tags: string[]
}

---

## Provider Model

Multiple MCPs may implement the same capability.

Example:

repository.read
 ├─ github-mcp
 ├─ gitlab-mcp
 └─ localfs-mcp

Runtime selects provider dynamically.

---

## Capability Registry API

registerCapability()
registerProvider()
resolveCapability()
listCapabilities()
listProviders()

---

## Resolution Pipeline

Goal
 -> Planner
 -> Capability Selection
 -> Provider Resolution
 -> Tool Execution
 -> Result

---

## Provider Ranking

Ranking factors:

- priority
- version compatibility
- health score
- latency
- success rate
- policy constraints

---

## Fallback Execution

If provider fails:

github-mcp
 -> fail

fallback

localfs-mcp
 -> execute

---

## Capability Graph

Capabilities may depend on capabilities.

Example:

architecture.analyze
 ├─ repository.search
 ├─ repository.read
 └─ dependency.analyze

This forms a capability graph used by Planner.

---

## Agent Routing

Agents no longer bind to specific tools.

Agents request capabilities.

Runtime resolves providers.

This enables portability across MCP packages.

---

## Marketplace Integration

Marketplace indexes:

- packages
- capabilities
- providers
- versions

Users search by capability rather than package.

---

## Long-Term Goal

Capability Registry becomes the universal abstraction layer between Runtime Core and MCP ecosystem.