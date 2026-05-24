export type BearerAuthResult =
  | { ok: true }
  | { ok: false; status: 401; code: "UNAUTHORIZED"; message: string };

export function verifyBearer(
  request: Request,
  apiKey?: string
): BearerAuthResult {
  // If no key configured, auth is disabled (useful for dev).
  if (!apiKey) return { ok: true };

  const auth = request.headers.get("authorization");
  if (!auth) {
    return {
      ok: false,
      status: 401,
      code: "UNAUTHORIZED",
      message: "Missing Authorization header"
    };
  }

  if (auth !== `Bearer ${apiKey}`) {
    return {
      ok: false,
      status: 401,
      code: "UNAUTHORIZED",
      message: "Invalid API key"
    };
  }

  return { ok: true };
}