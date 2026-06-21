# Future Refactor V2 - Architecture Blueprint

## Objective
Transform runtime-mcp into a modular MCP platform with Runtime Core, MCP Registry, MCP Builder and MCP Marketplace.

## Component Architecture

Runtime Core
- AgentRuntime
- Planner
- Executor
- WorkflowEngine
- TaskGraph
- StateMachine
- MemoryStore
- ProvenanceRecorder
- RecoveryManager

Platform Layer
- McpRegistry
- McpBuilder
- PackageLoader
- DependencyResolver
- CapabilityResolver

Extension Layer
- MCP Packages
- Agents
- Tools
- Workflows
- Knowledge Packs

Distribution Layer
- Marketplace
- Package Repository
- Version Registry

## MCP Lifecycle
Discover -> Load -> Validate -> Register -> Execute -> Audit -> Unload

## Dependency Resolution
Runtime Core is dependency-free from MCP packages.
MCP packages depend on Runtime Core contracts only.

## Capability Model
Capabilities become first-class objects and are discoverable through McpRegistry.

## Future Goals
Hot-loading, version isolation, package sandboxing and remote package installation.