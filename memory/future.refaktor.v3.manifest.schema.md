# Future Refactor V3 - MCP Manifest Specification

## Purpose
McpManifest is the canonical contract describing an MCP package. Every MCP package must contain exactly one manifest.

## Goals
- Discovery
- Validation
- Dependency resolution
- Capability exposure
- Marketplace compatibility
- Runtime loading

## Manifest Structure

schemaVersion: 1.0
id: github-mcp
name: GitHub MCP
version: 1.0.0
kind: specialization

metadata:
  author:
  license:
  description:
  homepage:

runtime:
  minRuntimeVersion:
  maxRuntimeVersion:

capabilities: []
dependencies: []
agents: []
tools: []
workflows: []
knowledge: []

mvp:
  enabled: true
  features: []

## Capability Contract
Capabilities are globally unique identifiers.

Examples:
- repository.read
- repository.search
- workflow.execute
- documentation.generate
- architecture.analyze

## Dependency Model
Dependencies may target:
- Runtime Core
- Other MCP Packages
- Shared Capability Packs

Example:
- coding-mcp >=1.0.0
- github-mcp >=1.2.0

## Validation Rules
- unique package id
- semantic version required
- capability uniqueness
- dependency graph acyclic
- manifest schema validation mandatory

## Package Identity
Canonical format:

publisher/package-name@version

Example:

adrian1520/github-mcp@1.0.0

## Runtime Load Sequence
Manifest Load
 -> Validation
 -> Dependency Resolution
 -> Capability Registration
 -> Agent Registration
 -> Workflow Registration
 -> Runtime Activation