export interface McpManifest {
  id: string;
  version: string;
  capabilities: string[];
  agents: string[];
  tools: string[];
  workflows: string[];
}
