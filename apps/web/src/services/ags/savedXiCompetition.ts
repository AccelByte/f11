import { apiUrl } from '../apiUrl';

import type {
  ApiResponse,
  AsyncMatchViewV1,
  LocalRunRecordV1,
  PublishSavedXiResponseV1,
  ResolveSavedXiChallengeResponseV1,
  SavedXiChallengePreviewV1,
  SavedXiCompetitionStatusV1,
  SavedXiViewV1,
  TrustedRunSubmissionV1,
} from '@football-11/contracts';

export type SavedXiCompetitionRequest = (
  input: RequestInfo | URL,
  init?: RequestInit,
) => Promise<Response>;

export async function loadSavedXiCompetition(
  accessToken: string,
  request: SavedXiCompetitionRequest = fetch,
): Promise<SavedXiCompetitionStatusV1> {
  return call('/api/saved-xi', accessToken, request, { method: 'GET' }, isStatus);
}

export async function publishPersonalBestXi(
  record: LocalRunRecordV1,
  accessToken: string,
  request: SavedXiCompetitionRequest = fetch,
): Promise<PublishSavedXiResponseV1> {
  if (!record.draftConfig) {
    throw new Error('This legacy saved result cannot be published. Complete a new draft first.');
  }
  const submission: TrustedRunSubmissionV1 = {
    schemaVersion: 'football11-trusted-submit-v1',
    runId: record.runId,
    challengeId: record.result.challengeId,
    seed: record.seed,
    versions: record.versions,
    draftConfig: record.draftConfig,
    actions: [...record.actions],
  };
  return call(
    '/api/saved-xi',
    accessToken,
    request,
    jsonRequest('PUT', submission),
    isPublishResponse,
  );
}

export async function findNearbySavedXiOpponent(
  accessToken: string,
  request: SavedXiCompetitionRequest = fetch,
): Promise<SavedXiChallengePreviewV1> {
  return call('/api/opponents/nearby', accessToken, request, { method: 'POST' }, isChallenge);
}

export async function resolveSavedXiMatch(
  token: string,
  accessToken: string,
  request: SavedXiCompetitionRequest = fetch,
): Promise<ResolveSavedXiChallengeResponseV1> {
  return call(
    '/api/asynchronous-matches',
    accessToken,
    request,
    jsonRequest('POST', {
      schemaVersion: 'football11-resolve-saved-xi-challenge-v1',
      token,
    }),
    isResolveResponse,
  );
}

async function call<T>(
  path: string,
  accessToken: string,
  request: SavedXiCompetitionRequest,
  init: RequestInit,
  isData: (value: unknown) => value is T,
): Promise<T> {
  if (!accessToken) throw new Error('Sign in again to use Saved-XI competition.');
  const headers = new Headers(init.headers);
  headers.set('Authorization', `Bearer ${accessToken}`);
  const response = await request(apiUrl(path), {
    ...init,
    headers,
  });
  const payload: unknown = await response.json().catch(() => null);
  if (!isApiResponse(payload, isData)) {
    throw new Error('Saved-XI competition returned an unreadable response. Try again.');
  }
  if (!payload.ok) throw new CompetitionClientError(payload.error.code, payload.error.message);
  return payload.data;
}

export class CompetitionClientError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'CompetitionClientError';
  }
}

function jsonRequest(method: string, body: unknown): RequestInit {
  return {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  };
}

function isApiResponse<T>(
  value: unknown,
  isData: (value: unknown) => value is T,
): value is ApiResponse<T> {
  if (!isRecord(value) || typeof value.ok !== 'boolean') return false;
  if (value.ok) return isData(value.data);
  return (
    isRecord(value.error) &&
    typeof value.error.code === 'string' &&
    typeof value.error.message === 'string'
  );
}

function isStatus(value: unknown): value is SavedXiCompetitionStatusV1 {
  return (
    isRecord(value) &&
    (value.savedXi === null || isSavedXi(value.savedXi)) &&
    isFiniteNumber(value.challengeScore) &&
    (value.activeChallenge === null || isChallenge(value.activeChallenge)) &&
    Array.isArray(value.history) &&
    value.history.every(isMatch)
  );
}

function isPublishResponse(value: unknown): value is PublishSavedXiResponseV1 {
  return isRecord(value) && typeof value.replaced === 'boolean' && isSavedXi(value.savedXi);
}

function isResolveResponse(value: unknown): value is ResolveSavedXiChallengeResponseV1 {
  return isRecord(value) && typeof value.duplicate === 'boolean' && isMatch(value.match);
}

function isSavedXi(value: unknown): value is SavedXiViewV1 {
  return (
    isRecord(value) &&
    typeof value.savedXiId === 'string' &&
    typeof value.sourceResultId === 'string' &&
    Array.isArray(value.roster) &&
    value.roster.length === 11 &&
    isUnits(value.units) &&
    isRecord(value.versions) &&
    isFiniteNumber(value.seasonPoints) &&
    isTimestamp(value.publishedAt)
  );
}

function isChallenge(value: unknown): value is SavedXiChallengePreviewV1 {
  return (
    isRecord(value) &&
    typeof value.matchId === 'string' &&
    typeof value.token === 'string' &&
    typeof value.opponentLabel === 'string' &&
    typeof value.opponentRank === 'number' &&
    Number.isInteger(value.opponentRank) &&
    value.opponentRank > 0 &&
    isSavedXi(value.opponentXi) &&
    isTimestamp(value.expiresAt)
  );
}

function isMatch(value: unknown): value is AsyncMatchViewV1 {
  return (
    isRecord(value) &&
    typeof value.matchId === 'string' &&
    typeof value.challengerXiId === 'string' &&
    typeof value.opponentXiId === 'string' &&
    typeof value.opponentLabel === 'string' &&
    Number.isInteger(value.opponentRank) &&
    isRecord(value.result) &&
    (value.result.outcome === 'win' ||
      value.result.outcome === 'draw' ||
      value.result.outcome === 'loss') &&
    isFiniteNumber(value.result.challengeScoreDelta) &&
    isRecord(value.result.probabilities) &&
    isFiniteNumber(value.result.probabilities.winProbability) &&
    isFiniteNumber(value.result.probabilities.drawProbability) &&
    isFiniteNumber(value.result.probabilities.lossProbability) &&
    !('evidence' in value.result) &&
    isFiniteNumber(value.scoreBefore) &&
    isFiniteNumber(value.scoreAfter) &&
    (value.settlementStatus === 'pending' || value.settlementStatus === 'settled') &&
    isTimestamp(value.createdAt) &&
    (value.settledAt === null || isTimestamp(value.settledAt))
  );
}

function isUnits(value: unknown): boolean {
  return (
    isRecord(value) &&
    isFiniteNumber(value.attack) &&
    isFiniteNumber(value.defence) &&
    isFiniteNumber(value.control)
  );
}

function isTimestamp(value: unknown): value is string {
  return typeof value === 'string' && Number.isFinite(Date.parse(value));
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
