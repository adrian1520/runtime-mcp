# Future Refactor V9 - Execution Environments

## Purpose

Decouple providers from execution infrastructure.

Runtime executes environments.
Environments execute providers.
Providers implement capabilities.

## Architecture

Goal
 -> Capability
 -> Provider
 -> Execution Environment
 -> Runtime Kernel

## Environment Types

- local-process
- local-worker
- docker
- cloudflare-worker
- remote-mcp
- serverless
- browser
- sandbox

## Environment Descriptor

id: worker-env
kind: cloudflare-worker
version: 1.0.0
capabilities: []
limits:
  cpu:
  memory:
  timeout:

## Isolation

Every environment defines:
- resource limits
- permission boundaries
- network access
- storage access

## Scheduling

Execution Planner selects:
- capability
- provider
- environment

before execution.

## Portability

The same provider can run in multiple environments.

github-provider
 ├─ local-process
 ├─ cloudflare-worker
 └─ remote-mcp

## Observability

Environment metrics:
- latency
- resource usage
- error rate
- throughput

## Long-Term Goal

Execution environments become the deployment abstraction layer of Runtime-MCP.