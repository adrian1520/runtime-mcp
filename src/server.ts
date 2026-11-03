import type { ToolRegistry } from "./contracts/tool";

import { registerMemoryTools } from "./tools/memory";
import { registerProvenanceTools } from "./tools/provenance";
import { registerRepositoryTools } from "./tools/repository";
import { registerAgentTools } from "./tools/agent";
import { registerGitHubActionsTools } from "./tools/github-actions";

export type Env = {
  STATE_KV: KVNamespace;

  API_KEY?: string;

  /** Set to "true" only for isolated local development. */
  ALLOW_INSECURE_DEV_AUTH?: string;

  /** Comma-separated exact hostnames allowed for HTTPS file downloads. */
  FILE_DOWNLOAD_ALLOWED_HOSTS?: string;

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

registerAgentTools(server.tools);

registerGitHubActionsTools(server.tools);
