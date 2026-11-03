export type BearerAuthResult =
  | { ok: true }
  | {
      ok: false;
      status: 401;
      code: "UNAUTHORIZED";
      message: string;
    }
  | {
      ok: false;
      status: 503;
      code: "AUTH_NOT_CONFIGURED";
      message: string;
    };

function constantTimeEqual(actual: string, expected: string): boolean {
  const length = Math.max(actual.length, expected.length);
  let difference = actual.length ^ expected.length;

  for (let index = 0; index < length; index += 1) {
    difference |=
      (actual.charCodeAt(index) || 0) ^ (expected.charCodeAt(index) || 0);
  }

  return difference === 0;
}

/**
 * Missing credentials fail closed by default. Local development can opt in
 * only with the explicit ALLOW_INSECURE_DEV_AUTH flag.
 */
export function verifyBearer(
  request: Request,
  apiKey?: string,
  allowInsecureDevAuth = false,
): BearerAuthResult {
  const expected = apiKey?.trim();

  if (!expected) {
    if (allowInsecureDevAuth) return { ok: true };

    return {
      ok: false,
      status: 503,
      code: "AUTH_NOT_CONFIGURED",
      message: "API authentication is not configured",
    };
  }

  const authorization = request.headers.get("authorization");
  const match = authorization?.match(/^Bearer\s+(.+)$/i);
  if (!match) {
    return {
      ok: false,
      status: 401,
      code: "UNAUTHORIZED",
      message: "A valid Bearer Authorization header is required",
    };
  }

  if (!constantTimeEqual(match[1]!, expected)) {
    return {
      ok: false,
      status: 401,
      code: "UNAUTHORIZED",
      message: "Invalid API key",
    };
  }

  return { ok: true };
}
