import { apiUrl } from '../apiUrl';

import type {
  ApiResponse,
  IssueDraftChallengeRequestV1,
  IssueDraftChallengeResponseV1,
  IssuedDraftChallengeV1,
} from '@football-11/contracts';

export type DraftChallengeRequest = (
  input: RequestInfo | URL,
  init?: RequestInit,
) => Promise<Response>;

export interface RequestDraftChallengeOptions {
  roomSessionId?: string;
  roundSeconds?: number;
  idempotencyKey?: string;
}

export async function requestDraftChallenge(
  accessToken: string,
  options: RequestDraftChallengeOptions = {},
  request: DraftChallengeRequest = fetch,
): Promise<IssuedDraftChallengeV1> {
  if (!accessToken) throw new Error('Sign in again before starting a draft.');
  const idempotencyKey = options.idempotencyKey ?? randomIdempotencyKey();
  const body: IssueDraftChallengeRequestV1 = options.roomSessionId
    ? {
        schemaVersion: 1,
        idempotencyKey,
        roomSessionId: options.roomSessionId,
        roundSeconds: options.roundSeconds ?? 900,
      }
    : { schemaVersion: 1, idempotencyKey };
  const response = await request(apiUrl('/api/draft-challenges'), {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  const payload: unknown = await response.json().catch(() => null);
  if (!isApiResponse(payload)) {
    throw new Error('Draft configuration returned an unreadable response. Try again.');
  }
  if (!payload.ok) throw new Error(payload.error.message);
  return payload.data.challenge;
}

function randomIdempotencyKey(): string {
  const values = new Uint8Array(16);
  globalThis.crypto.getRandomValues(values);
  return [...values].map((value) => value.toString(16).padStart(2, '0')).join('');
}

function isApiResponse(value: unknown): value is ApiResponse<IssueDraftChallengeResponseV1> {
  if (typeof value !== 'object' || value === null || !('ok' in value)) return false;
  if (value.ok === true) {
    return (
      'data' in value &&
      typeof value.data === 'object' &&
      value.data !== null &&
      'schemaVersion' in value.data &&
      value.data.schemaVersion === 1 &&
      'challenge' in value.data &&
      typeof value.data.challenge === 'object' &&
      value.data.challenge !== null
    );
  }
  return (
    value.ok === false &&
    'error' in value &&
    typeof value.error === 'object' &&
    value.error !== null &&
    'message' in value.error &&
    typeof value.error.message === 'string'
  );
}
