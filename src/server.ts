import type { ToolRegistry } from "./contracts/tool";

import { registerMemoryTools } from "./tools/memory";

import { registerProvenanceTools } from "./tools/provenance";

import { registerRepositoryTools } from "./tools/repository";

export type Env = {
  STATE_KV: KVNamespace;

  API_KEY?: string;

  GITHUB_OWNER?: string;

  GITHUB_REPO?: string;

  GITHUB_BRANCH?: string;

  GITHUB_TOKEN?: string;
};

export const server: {
  tools: ToolRegistry<Env>;
} = {
  tools: {},
};

/*
 * REGISTER TOOLS
 */

registerMemoryTools(server.tools);

registerProvenanceTools(server.tools);

registerRepositoryTools(server.tools);
