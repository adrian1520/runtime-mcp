import { server, type Env } from "../server";
import { verifyBearer } from "../auth/bearer";

export async function handleRpcRoute(
  request: Request,
  env: Env,
  requestId: string
): Promise<Response | null> {
  const url = new URL(request.url);
  if (url.pathname !== "/mcp/rpc") return null;
  if (request.method !== "POST") return Response.json({ ok: false }, { status: 405 });

  const auth = verifyBearer(request, env.API_KEY);
  if (!auth.ok) {
    return Response.json({ ok: false, error: auth, requestId }, { status: auth.status });
  }

  const body = await request.json().catch(() => null);
  if (!body || body.jsonrpc !== "2.0" || typeof body.method !== "string") {
    return Response.json({ jsonrpc: "2.0", id: body?.id ?? null, error: { code: -32600, message: "Invalid Request" } }, { status: 400 });
  }

  if (body.method === "tools/list") {
    const tools = Object.entries(server.tools).map(([name, t]) => ({
      name,
      description: t.description,
      inputSchema: t.inputSchema
    }));
    return Response.json({ jsonrpc: "2.0", id: body.id ?? null, result: { tools } }, { status: 200 });
  }

  if (body.method === "tools/call") {
    const name = body.params?.name;
    const args = body.params?.arguments ?? {};
    const tool = server.tools[name];
    if (!tool) {
      return Response.json({ jsonrpc: "2.0", id: body.id ?? null, error: { code: -32601, message: `Unknown tool: ${name}` } }, { status: 404 });
    }
    const validated = tool.validate(args);
    const result = await tool.execute(validated, { env, requestId });
    return Response.json({ jsonrpc: "2.0", id: body.id ?? null, result }, { status: 200 });
  }

  return Response.json({ jsonrpc: "2.0", id: body.id ?? null, error: { code: -32601, message: "Method not found" } }, { status: 404 });
}