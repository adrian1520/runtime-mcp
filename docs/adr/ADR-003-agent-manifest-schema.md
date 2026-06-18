# ADR-003 Agent Manifest Schema

Status: Accepted

Defines the canonical schema for agent.json.

Required fields:
- id
- name
- version
- description
- entryWorkflow
- capabilities

Capabilities:
- memory
- github
- python
- ui
- analysis

This schema becomes the contract for AgentRegistry and AgentLoader.
