import { apiPreflight, withApiCors } from '@/src/server/apiCors';

import type { ApiResponse, IssueDraftChallengeResponseV1 } from '@football-11/contracts';

import { AgsServerGateway, readAgsServerConfig } from '@/src/server/agsServerGateway';
import { DRAFT_CHALLENGE_MAX_BYTES, issueDraftChallenge } from '@/src/server/draftChallenges';
import { TrustedReplayError } from '@/src/server/trustedReplay';

async function handlePOST(request: Request): Promise<Response> {
  try {
    const contentType = request.headers.get('content-type') ?? '';
    if (!contentType.toLowerCase().includes('application/json')) {
      throw new TrustedReplayError(415, 'JSON_REQUIRED', 'Draft requests must use JSON.');
    }
    const declaredLength = Number(request.headers.get('content-length') ?? 0);
    if (Number.isFinite(declaredLength) && declaredLength > DRAFT_CHALLENGE_MAX_BYTES) {
      throw new TrustedReplayError(413, 'REQUEST_TOO_LARGE', 'The draft request is too large.');
    }
    const raw = await request.text();
    if (new TextEncoder().encode(raw).byteLength > DRAFT_CHALLENGE_MAX_BYTES) {
      throw new TrustedReplayError(413, 'REQUEST_TOO_LARGE', 'The draft request is too large.');
    }
    let input: unknown;
    try {
      input = JSON.parse(raw);
    } catch {
      throw new TrustedReplayError(400, 'INVALID_JSON', 'The draft request is not valid JSON.');
    }
    const authorization = request.headers.get('authorization') ?? '';
    const match = /^Bearer ([^\s]+)$/i.exec(authorization);
    const accessToken = match?.[1] ?? '';
    const config = readAgsServerConfig();
    const data = await issueDraftChallenge(input, accessToken, new AgsServerGateway(config), {
      namespace: config.namespace,
    });
    return json<ApiResponse<IssueDraftChallengeResponseV1>>({ ok: true, data }, 200);
  } catch (caught) {
    const error =
      caught instanceof TrustedReplayError
        ? caught
        : new TrustedReplayError(
            502,
            'DRAFT_CHALLENGE_UNAVAILABLE',
            'A new draft could not be issued. Try again.',
          );
    return json<ApiResponse<IssueDraftChallengeResponseV1>>(
      { ok: false, error: { code: error.code, message: error.message, details: {} } },
      error.status,
    );
  }
}

function json<T>(body: T, status: number): Response {
  return Response.json(body, {
    status,
    headers: {
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}

export const POST = withApiCors(handlePOST);

export function OPTIONS(request: Request): Response {
  return apiPreflight(request, ['POST']);
}
