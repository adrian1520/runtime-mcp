import { server, type Env } from "../server";
import { verifyBearer } from "../auth/bearer";

export async function handleToolsRoute(
  request: Request,
  env: Env,
  requestId: string
): Promise<Response | null> {
  const url = new URL(request.url);

  if (!url.pathname.startsWith("/tools/")) return null;
  if (request.method !== "POST") {
    return Response.json({ ok: false, error: { code: "METHOD_NOT_ALLOWED" } }, { status: 405 });
  }

  const auth = verifyBearer(request, env.API_KEY);
  if (!auth.ok) {
    return Response.json({ ok: false, error: { code: auth.code, message: auth.message }, requestId }, { status: auth.status });
  }

  const toolName = url.pathname.replace("/tools/", "");
  const tool = server.tools[toolName];

  if (!tool) {
    return Response.json({ ok: false, error: { code: "TOOL_NOT_FOUND" }, requestId }, { status: 404 });
  }

  const body = await request.json().catch(() => null);
  if (!body) {
    return Response.json({ ok: false, error: { code: "INVALID_JSON" }, requestId }, { status: 400 });
  }

  const validated = tool.validate(body);
  const result = await tool.execute(validated, { env, requestId });

  return Response.json({ ok: true, tool: toolName, result, requestId }, { status: 200 });
}