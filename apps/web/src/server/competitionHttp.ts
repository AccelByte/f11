import { TrustedReplayError } from './trustedReplay';

export const COMPETITION_REQUEST_MAX_BYTES = 128 * 1024;

export function bearerToken(request: Request): string {
  const authorization = request.headers.get('authorization') ?? '';
  return /^Bearer ([^\s]+)$/i.exec(authorization)?.[1] ?? '';
}

export async function readJsonBody(request: Request): Promise<unknown> {
  const contentType = request.headers.get('content-type') ?? '';
  if (!contentType.toLowerCase().includes('application/json')) {
    throw new TrustedReplayError(415, 'JSON_REQUIRED', 'This request must use JSON.');
  }
  const declaredLength = Number(request.headers.get('content-length') ?? 0);
  if (Number.isFinite(declaredLength) && declaredLength > COMPETITION_REQUEST_MAX_BYTES) {
    throw new TrustedReplayError(413, 'REQUEST_TOO_LARGE', 'The request is too large.');
  }
  const raw = await request.text();
  if (new TextEncoder().encode(raw).byteLength > COMPETITION_REQUEST_MAX_BYTES) {
    throw new TrustedReplayError(413, 'REQUEST_TOO_LARGE', 'The request is too large.');
  }
  try {
    return JSON.parse(raw);
  } catch {
    throw new TrustedReplayError(400, 'INVALID_JSON', 'The request is not valid JSON.');
  }
}

export async function competitionResponse(operation: () => Promise<unknown>): Promise<Response> {
  try {
    return json({ ok: true, data: await operation() }, 200);
  } catch (caught) {
    const error =
      caught instanceof TrustedReplayError
        ? caught
        : new TrustedReplayError(
            502,
            'COMPETITION_SERVICE_UNAVAILABLE',
            'Saved-XI competition is temporarily unavailable. Try again.',
          );
    return json(
      { ok: false, error: { code: error.code, message: error.message, details: {} } },
      error.status,
    );
  }
}

function json(body: unknown, status: number): Response {
  return Response.json(body, {
    status,
    headers: {
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
