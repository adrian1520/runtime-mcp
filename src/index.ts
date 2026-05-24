import { createMcpHandler } from "@modelcontextprotocol/sdk/server/cloudflare";
import { server } from "./server";

export default createMcpHandler(server);