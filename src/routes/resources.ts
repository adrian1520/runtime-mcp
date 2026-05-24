import type { Env } from "../server";

export async function handleResourcesRoute(
  request: Request,
  env: Env,
  requestId: string
): Promise<Response | null> {
  const url = new URL(request.url);
  if (!url.pathname.startsWith("/resources")) return null;

  return Response.json(
    {
      ok: false,
      error: { code: "NOT_IMPLEMENTED", message: "Resources not implemented yet" },
      requestId
    },
    { status: 501 }
  );
}