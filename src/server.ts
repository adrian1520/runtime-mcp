import type { ToolRegistry } from "./contracts/tool";
import { registerMemoryTools } from "./tools/memory";
import { registerProvenanceTools } from "./tools/provenance";

export type Env = {
  STATE_KV: KVNamespace;
  API_KEY?: string;
};

export const server: {
  tools: ToolRegistry<Env>;
} = {
  tools: {}
};

registerMemoryTools(server.tools as any);
registerProvenanceTools(server.tools as any);