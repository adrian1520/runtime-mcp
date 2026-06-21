# Future Refactor V7 - MCP Package Format

## Purpose

Define the canonical structure of an installable MCP package.

## Package Layout

mcp-package/
 ├── manifest.yaml
 ├── agents/
 ├── tools/
 ├── workflows/
 ├── providers/
 ├── knowledge/
 ├── assets/
 ├── tests/
 └── README.md

## Package Types

- specialization
- provider-pack
- capability-pack
- knowledge-pack
- workflow-pack

## Package Lifecycle

Install
 -> Validate
 -> Resolve Dependencies
 -> Register Capabilities
 -> Activate
 -> Execute
 -> Upgrade
 -> Remove

## Versioning

Semantic Versioning required.

major.minor.patch

## Distribution

Local Package
Remote Package
Marketplace Package
Git Repository Package

## Compatibility

Packages target Runtime API versions.

runtime:
  min: 2.0.0
  max: 3.x

## Long-Term Goal

Package becomes the deployable unit of the MCP ecosystem.