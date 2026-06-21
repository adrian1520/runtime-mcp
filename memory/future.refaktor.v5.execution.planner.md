# Future Refactor V5 - Execution Planner

## Purpose

Execution Planner converts a Goal and Capability Graph into an executable DAG.

Current:
Goal -> Planner -> Tasks

Future:
Goal -> Planner -> Capability Graph -> Execution Planner -> DAG -> Executor

---

## Responsibilities

- Expand capabilities
- Resolve dependencies
- Detect parallelism
- Generate execution DAG
- Optimize execution order
- Estimate cost
- Estimate latency
- Support recovery checkpoints

---

## Execution Node

interface ExecutionNode {
  id: string
  capability: string
  provider?: string
  dependencies: string[]
  priority: number
  retryPolicy: RetryPolicy
}

---

## Planning Pipeline

Goal
 -> Capability Discovery
 -> Capability Expansion
 -> Dependency Analysis
 -> DAG Generation
 -> Provider Resolution
 -> Execution Plan

---

## Parallel Execution

Example:

repository.search
 ├─ repository.read:A
 ├─ repository.read:B
 └─ repository.read:C

A, B and C execute concurrently.

---

## Recovery Model

Every node creates a checkpoint.

Failed execution resumes from nearest valid checkpoint.

---

## Cost Model

Each capability exposes:
- estimated cost
- estimated latency
- token budget
- resource requirements

Planner optimizes execution path.

---

## Long-Term Goal

Execution Planner becomes the orchestration brain of Runtime-MCP.