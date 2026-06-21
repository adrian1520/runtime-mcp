# Future Refactor: Runtime-MCP as Modular MCP Platform

## Vision

Transform runtime-mcp from a runtime framework into a modular MCP platform.

Core principle:

Runtime Core = execution engine
MCP Specializations = installable capability packs

The runtime remains stable while new MCPs are composed from agents, tools, workflows and manifests.

---

## Target Architecture

Layer 1: Runtime Core
- AgentRuntime
- Planner
- Executor
- WorkflowEngine
- TaskGraph
- StateMachine
- MemoryStore
- ProvenanceRecorder
- RecoveryManager

Layer 2: Shared Registries
- AgentRegistry
- ToolRegistry
- WorkflowRegistry
- KnowledgeRegistry
- McpRegistry (new)

Layer 3: Shared Tools
- Repository Tools
- Memory Tools
- Provenance Tools
- Future External Connectors

Layer 4: Agents
- Runtime Agents
- Domain Agents
- Composite Agents

Layer 5: MCP Specializations
- github-mcp
- coding-mcp
- research-mcp
- architecture-mcp
- contract-mcp
- custom-mcp

---

## New Directory Structure

src/
  runtime/
  tools/
  agents/
  registries/
  mcps/

mcps/
  github-mcp/
  coding-mcp/
  research-mcp/
  architecture-mcp/
  contract-mcp/
  custom-mcp/

---

## MCP Manifest

Each MCP must declare:

- identity
- version
- tools
- agents
- workflows
- capabilities
- MVP scope

Example:

id: github-mcp
version: 1.0.0

capabilities:
  - repository.search
  - repository.read
  - architecture.analysis

---

## MCP Registry

Introduce McpRegistry.

Responsibilities:

- register MCPs
- load MCPs
- unload MCPs
- discover capabilities
- resolve dependencies
- expose metadata

Example API:

register(mcp)
get(id)
list()
load(id)
unload(id)

---

## MCP Builder

Introduce McpBuilder.

Purpose:

- compose MCPs from reusable modules
- enforce manifest validation
- simplify packaging

Pipeline:

Builder
 -> Agents
 -> Tools
 -> Workflows
 -> Manifest
 -> MCP Package

---

## MVP Model

Every MCP must support MVP mode.

MVP goals:

- minimum dependencies
- fast startup
- limited feature set
- easy validation

Example:

github-mcp MVP
- repository search
- repository read
- dependency summary
- architecture summary

Full Version
- pull requests
- releases
- issues
- security analysis
- documentation generation

---

## Agent Composition

Agents become reusable building blocks.

Examples:

RepositoryAgent
DocumentationAgent
ArchitectureAgent
PatchAgent
ContractAgent
ResearchAgent

Composite Agent:

CodeReviewAgent
  -> RepositoryAgent
  -> ArchitectureAgent
  -> DocumentationAgent

---

## Workflow Standardization

Every workflow should follow:

Goal
 -> Plan
 -> Execute
 -> Validate
 -> Store
 -> Audit
 -> Result

Workflow metadata should be serializable and resumable.

---

## Marketplace Phase

Future phase:

McpMarketplace

Purpose:

- discover MCP packages
- install MCP packages
- upgrade MCP packages
- dependency resolution
- version management

Example:

marketplace install github-mcp
marketplace install research-mcp

---

## Packaging Model

Each MCP becomes a standalone package.

Structure:

mcps/github-mcp/
  manifest.json
  agents/
  tools/
  workflows/
  README.md

This enables distribution without modifying Runtime Core.

---

## Long-Term Goal

Runtime-MCP evolves into:

Runtime Core
 + MCP Registry
 + MCP Builder
 + MCP Marketplace
 + Installable MCP Packages

Result:

A modular ecosystem where Runtime Core remains stable while capabilities evolve through independently installable MCP specializations.