import { apiUrl } from '../apiUrl';

import type {
  ApiResponse,
  LocalRunRecordV1,
  TrustedRunSubmissionResponseV1,
  TrustedRunSubmissionV1,
} from '@football-11/contracts';

export type TrustedRankingRequest = (
  input: RequestInfo | URL,
  init?: RequestInit,
) => Promise<Response>;

export async function submitTrustedRun(
  record: LocalRunRecordV1,
  accessToken: string,
  request: TrustedRankingRequest = fetch,
): Promise<TrustedRunSubmissionResponseV1> {
  if (!accessToken) throw new Error('Sign in again before verifying this run.');
  if (!record.draftConfig) {
    throw new Error(
      'This saved run predates authoritative draft configuration and cannot be ranked.',
    );
  }
  const submission: TrustedRunSubmissionV1 = {
    schemaVersion: 'football11-trusted-submit-v1',
    runId: record.runId,
    challengeId: record.result.challengeId,
    ...(record.roomSessionId ? { roomSessionId: record.roomSessionId } : {}),
    seed: record.seed,
    versions: record.versions,
    draftConfig: record.draftConfig,
    actions: [...record.actions],
  };
  const response = await request(apiUrl('/api/runs/submit'), {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(submission),
  });
  const payload: unknown = await response.json().catch(() => null);
  if (!isApiResponse(payload)) {
    throw new Error('Trusted ranking returned an unreadable response. Try again.');
  }
  if (!payload.ok) throw new Error(payload.error.message);
  return payload.data;
}

function isApiResponse(value: unknown): value is ApiResponse<TrustedRunSubmissionResponseV1> {
  if (typeof value !== 'object' || value === null || !('ok' in value)) return false;
  if (value.ok === true)
    return 'data' in value && typeof value.data === 'object' && value.data !== null;
  return (
    value.ok === false &&
    'error' in value &&
    typeof value.error === 'object' &&
    value.error !== null &&
    'message' in value.error &&
    typeof value.error.message === 'string'
  );
}
