import type {
  AsyncMatchHistoryV1,
  AsyncMatchRecordV1,
  AsyncMatchViewV1,
  IssuedSavedXiChallengeV1,
  PublishSavedXiResponseV1,
  ResolveSavedXiChallengeRequestV1,
  ResolveSavedXiChallengeResponseV1,
  SavedXiChallengePreviewV1,
  SavedXiCompetitionStatusV1,
  SavedXiRecordV1,
  SavedXiViewV1,
} from '@football-11/contracts';
import {
  applyChallengeScore,
  simulateHeadToHead,
  stateHash,
  type MechanicsVersion,
} from '@football-11/domain';

import { headToHeadProfile } from '../game/content';
import {
  TrustedReplayError,
  parseTrustedReceipt,
  replayTrustedSubmission,
  type AuthenticatedPlayer,
} from './trustedReplay';

export const SAVED_XI_RECORD_KEY = 'football11_saved_xi_v1';
export const SAVED_XI_CHALLENGE_RECORD_KEY = 'football11_saved_xi_challenge_v1';
export const ASYNC_MATCH_HISTORY_RECORD_KEY = 'football11_async_history_v1';
export const CHALLENGE_SCORE_STAT_CODE = 'football11challengescore';
export const CHALLENGE_TOKEN_TTL_MS = 10 * 60 * 1000;
export const REMATCH_COOLDOWN_MS = 24 * 60 * 60 * 1000;
export const MAX_MATCHES_PER_24_HOURS = 20;
export const MAX_MATCH_HISTORY = 20;

export interface NearbyLeaderboardCandidate {
  userId: string;
  rank: number;
  points: number;
}

export interface SavedXiCompetitionGateway {
  authenticatePlayer(accessToken: string): Promise<AuthenticatedPlayer>;
  readReceipt(userId: string): Promise<unknown>;
  readBestPoints(userId: string): Promise<number>;
  readSavedXi(userId: string): Promise<unknown>;
  readSavedXis(
    userIds: string[],
    accessToken: string,
  ): Promise<Array<{ userId: string; value: unknown }>>;
  writeSavedXi(userId: string, record: SavedXiRecordV1): Promise<void>;
  readIssuedChallenge(userId: string): Promise<unknown>;
  writeIssuedChallenge(userId: string, challenge: IssuedSavedXiChallengeV1): Promise<void>;
  readMatchHistory(userId: string): Promise<unknown>;
  writeMatchHistory(userId: string, history: AsyncMatchHistoryV1): Promise<void>;
  readNearbyLeaderboardCandidates(
    userId: string,
    accessToken: string,
    radius: number,
  ): Promise<NearbyLeaderboardCandidate[]>;
  readChallengeScore(userId: string): Promise<number>;
  setChallengeScore(userId: string, score: number, match: AsyncMatchRecordV1): Promise<number>;
}

export interface CompetitionOptions {
  namespace: string;
  now?: () => Date;
  randomId?: () => string;
}

export async function publishSavedXi(
  input: unknown,
  accessToken: string,
  gateway: SavedXiCompetitionGateway,
  options: CompetitionOptions,
): Promise<PublishSavedXiResponseV1> {
  const player = await authenticate(accessToken, gateway, options.namespace);
  const { submission, result } = replayTrustedSubmission(input);
  const receiptValue = await gateway.readReceipt(player.userId);
  if (receiptValue === null) {
    throw conflict('RUN_NOT_TRUSTED', 'Verify this run before publishing its XI.');
  }
  const receipt = parseTrustedReceipt(receiptValue);
  if (
    receipt.runId !== submission.runId ||
    receipt.resultHash !== stateHash(result) ||
    receipt.points !== result.season.points
  ) {
    throw conflict('RUN_NOT_TRUSTED', 'The trusted receipt does not match this run.');
  }
  const bestPoints = await gateway.readBestPoints(player.userId);
  if (result.season.points !== bestPoints) {
    throw conflict(
      'NOT_PERSONAL_BEST',
      'Only a trusted run tied with the current personal best can be published.',
    );
  }

  const existingValue = await gateway.readSavedXi(player.userId);
  const existing = existingValue === null ? null : parseSavedXi(existingValue, player.userId);
  const publishedAt = now(options).toISOString();
  const savedXi: SavedXiRecordV1 = {
    schemaVersion: 'football11-saved-xi-v1',
    savedXiId: `xi-${stateHash({
      ownerUserId: player.userId,
      resultId: result.resultId,
      headToHeadVersion: headToHeadProfile.version,
    }).slice(0, 32)}`,
    ownerUserId: player.userId,
    sourceRunId: submission.runId,
    sourceResultId: result.resultId,
    formationId: '4-3-3-v1',
    roster: result.roster.map((assignment) => ({ ...assignment })),
    units: { ...result.assessment.units },
    versions: { ...result.versions },
    headToHeadVersion: headToHeadProfile.version,
    seasonPoints: result.season.points,
    publishedAt,
  };
  await gateway.writeSavedXi(player.userId, savedXi);
  return {
    savedXi: savedXiView(savedXi),
    replaced: existing !== null && existing.savedXiId !== savedXi.savedXiId,
  };
}

export async function getSavedXiCompetitionStatus(
  accessToken: string,
  gateway: SavedXiCompetitionGateway,
  options: CompetitionOptions,
): Promise<SavedXiCompetitionStatusV1> {
  const player = await authenticate(accessToken, gateway, options.namespace);
  const [savedValue, score, challengeValue, historyValue] = await Promise.all([
    gateway.readSavedXi(player.userId),
    gateway.readChallengeScore(player.userId),
    gateway.readIssuedChallenge(player.userId),
    gateway.readMatchHistory(player.userId),
  ]);
  const savedXi = savedValue === null ? null : parseSavedXi(savedValue, player.userId);
  const challenge = challengeValue === null ? null : parseChallenge(challengeValue, player.userId);
  const history = parseHistory(historyValue, player.userId);
  const pendingMatch = history.matches.find((match) => match.settlementStatus === 'pending');
  const activeChallenge =
    challenge &&
    ((challenge.consumedAt === null && Date.parse(challenge.expiresAt) > now(options).getTime()) ||
      pendingMatch?.matchId === challenge.matchId)
      ? challengePreview(challenge)
      : null;
  return {
    savedXi: savedXi ? savedXiView(savedXi) : null,
    challengeScore: score,
    activeChallenge,
    history: history.matches.map(matchView),
  };
}

export async function issueSavedXiChallenge(
  accessToken: string,
  gateway: SavedXiCompetitionGateway,
  options: CompetitionOptions,
): Promise<SavedXiChallengePreviewV1> {
  const player = await authenticate(accessToken, gateway, options.namespace);
  const currentTime = now(options);
  const [savedValue, challengeValue, historyValue] = await Promise.all([
    gateway.readSavedXi(player.userId),
    gateway.readIssuedChallenge(player.userId),
    gateway.readMatchHistory(player.userId),
  ]);
  if (savedValue === null) {
    throw conflict('NO_SAVED_XI', 'Publish a trusted personal-best XI before challenging.');
  }
  const challengerXi = parseSavedXi(savedValue, player.userId);
  const history = parseHistory(historyValue, player.userId);
  if (history.matches.some((match) => match.settlementStatus === 'pending')) {
    throw conflict(
      'SETTLEMENT_PENDING',
      'Finish the pending Challenge Score settlement before requesting another opponent.',
    );
  }
  const recentMatches = history.matches.filter(
    (match) => currentTime.getTime() - Date.parse(match.createdAt) < REMATCH_COOLDOWN_MS,
  );
  if (recentMatches.length >= MAX_MATCHES_PER_24_HOURS) {
    throw new TrustedReplayError(
      429,
      'DAILY_CHALLENGE_LIMIT',
      'The 24-hour Saved-XI challenge limit has been reached.',
    );
  }
  if (challengeValue !== null) {
    const existing = parseChallenge(challengeValue, player.userId);
    if (existing.consumedAt === null && Date.parse(existing.expiresAt) > currentTime.getTime()) {
      return challengePreview(existing);
    }
  }

  let candidates = await compatibleCandidates(
    player,
    accessToken,
    challengerXi,
    recentMatches,
    gateway,
    10,
  );
  if (candidates.length === 0) {
    candidates = await compatibleCandidates(
      player,
      accessToken,
      challengerXi,
      recentMatches,
      gateway,
      50,
    );
  }
  if (candidates.length === 0) {
    throw new TrustedReplayError(
      404,
      'NO_COMPATIBLE_OPPONENT',
      'No compatible nearby Saved XI is available right now.',
    );
  }

  const randomId = options.randomId ?? (() => crypto.randomUUID());
  const selectionNonce = randomId();
  const selected =
    candidates[Number.parseInt(stateHash(selectionNonce).slice(0, 8), 16) % candidates.length];
  if (!selected) {
    throw new TrustedReplayError(502, 'SELECTION_FAILED', 'Opponent selection failed safely.');
  }
  const token = randomId();
  const matchId = `match-${stateHash(token).slice(0, 32)}`;
  const issuedAt = currentTime.toISOString();
  const challenge: IssuedSavedXiChallengeV1 = {
    schemaVersion: 'football11-saved-xi-challenge-v1',
    matchId,
    token,
    challengerUserId: player.userId,
    challengerXi,
    opponentXi: selected.savedXi,
    opponentLabel: safeOpponentLabel(selected.candidate.userId),
    opponentRank: selected.candidate.rank,
    matchSeed: randomId(),
    issuedAt,
    expiresAt: new Date(currentTime.getTime() + CHALLENGE_TOKEN_TTL_MS).toISOString(),
    consumedAt: null,
  };
  await gateway.writeIssuedChallenge(player.userId, challenge);
  return challengePreview(challenge);
}

export async function resolveSavedXiChallenge(
  input: unknown,
  accessToken: string,
  gateway: SavedXiCompetitionGateway,
  options: CompetitionOptions,
): Promise<ResolveSavedXiChallengeResponseV1> {
  const player = await authenticate(accessToken, gateway, options.namespace);
  const request = parseResolveRequest(input);
  const challengeValue = await gateway.readIssuedChallenge(player.userId);
  if (challengeValue === null) {
    throw new TrustedReplayError(404, 'CHALLENGE_NOT_FOUND', 'Request a new opponent first.');
  }
  const challenge = parseChallenge(challengeValue, player.userId);
  if (challenge.token !== request.token) {
    throw new TrustedReplayError(403, 'INVALID_CHALLENGE_TOKEN', 'The challenge token is invalid.');
  }
  const history = parseHistory(await gateway.readMatchHistory(player.userId), player.userId);
  const existing = history.matches.find((match) => match.matchId === challenge.matchId);
  if (existing) {
    const settled = await settlePendingMatch(existing, history, player.userId, gateway, options);
    return { match: matchView(settled), duplicate: true };
  }
  const currentTime = now(options);
  if (challenge.consumedAt !== null) {
    throw conflict('CHALLENGE_ALREADY_USED', 'This challenge was already consumed.');
  }
  if (Date.parse(challenge.expiresAt) <= currentTime.getTime()) {
    throw new TrustedReplayError(410, 'CHALLENGE_EXPIRED', 'This challenge has expired.');
  }
  assertCompatible(challenge.challengerXi, challenge.opponentXi);
  const result = simulateHeadToHead(
    {
      savedXiId: challenge.challengerXi.savedXiId,
      units: challenge.challengerXi.units,
    },
    { savedXiId: challenge.opponentXi.savedXiId, units: challenge.opponentXi.units },
    headToHeadProfile,
    challenge.matchSeed,
  );
  const scoreBefore = await gateway.readChallengeScore(player.userId);
  const scoreAfter = applyChallengeScore(scoreBefore, result.outcome, headToHeadProfile);
  const match: AsyncMatchRecordV1 = {
    schemaVersion: 'football11-async-match-v1',
    matchId: challenge.matchId,
    challengerUserId: player.userId,
    challengerXiId: challenge.challengerXi.savedXiId,
    opponentUserId: challenge.opponentXi.ownerUserId,
    opponentXiId: challenge.opponentXi.savedXiId,
    opponentLabel: challenge.opponentLabel,
    opponentRank: challenge.opponentRank,
    result,
    scoreBefore,
    scoreAfter,
    settlementStatus: 'pending',
    createdAt: currentTime.toISOString(),
    settledAt: null,
  };
  const pendingHistory = prependMatch(history, match);
  await gateway.writeMatchHistory(player.userId, pendingHistory);
  await gateway.writeIssuedChallenge(player.userId, {
    ...challenge,
    consumedAt: currentTime.toISOString(),
  });
  const settled = await settlePendingMatch(match, pendingHistory, player.userId, gateway, options);
  return { match: matchView(settled), duplicate: false };
}

async function settlePendingMatch(
  match: AsyncMatchRecordV1,
  history: AsyncMatchHistoryV1,
  userId: string,
  gateway: SavedXiCompetitionGateway,
  options: CompetitionOptions,
): Promise<AsyncMatchRecordV1> {
  if (match.settlementStatus === 'settled') return match;
  const observed = await gateway.setChallengeScore(userId, match.scoreAfter, match);
  if (observed !== match.scoreAfter) {
    throw new TrustedReplayError(
      502,
      'CHALLENGE_SCORE_READBACK_FAILED',
      'AGS did not return the expected Challenge Score after settlement.',
    );
  }
  const settled: AsyncMatchRecordV1 = {
    ...match,
    settlementStatus: 'settled',
    settledAt: now(options).toISOString(),
  };
  await gateway.writeMatchHistory(userId, {
    ...history,
    matches: history.matches.map((candidate) =>
      candidate.matchId === settled.matchId ? settled : candidate,
    ),
  });
  return settled;
}

async function compatibleCandidates(
  player: AuthenticatedPlayer,
  accessToken: string,
  challengerXi: SavedXiRecordV1,
  recentMatches: AsyncMatchRecordV1[],
  gateway: SavedXiCompetitionGateway,
  radius: number,
): Promise<Array<{ candidate: NearbyLeaderboardCandidate; savedXi: SavedXiRecordV1 }>> {
  const nearby = (
    await gateway.readNearbyLeaderboardCandidates(player.userId, accessToken, radius)
  ).filter((candidate) => candidate.userId !== player.userId);
  const recentOpponentIds = new Set(recentMatches.map((match) => match.opponentUserId));
  const values = await gateway.readSavedXis(
    nearby.map((candidate) => candidate.userId),
    accessToken,
  );
  const valueByUserId = new Map(values.map((record) => [record.userId, record.value]));
  const compatible: Array<{
    candidate: NearbyLeaderboardCandidate;
    savedXi: SavedXiRecordV1;
  }> = [];
  for (const candidate of nearby) {
    if (recentOpponentIds.has(candidate.userId)) continue;
    const value = valueByUserId.get(candidate.userId);
    if (value === undefined) continue;
    try {
      const savedXi = parseSavedXi(value, candidate.userId);
      assertCompatible(challengerXi, savedXi);
      compatible.push({ candidate, savedXi });
    } catch {
      // Invalid or incompatible public records are excluded, never trusted.
    }
  }
  return compatible;
}

function assertCompatible(challenger: SavedXiRecordV1, opponent: SavedXiRecordV1): void {
  if (
    challenger.headToHeadVersion !== headToHeadProfile.version ||
    opponent.headToHeadVersion !== headToHeadProfile.version ||
    !sameVersions(challenger.versions, opponent.versions)
  ) {
    throw conflict(
      'INCOMPATIBLE_XI_VERSION',
      'The Saved XIs do not use the same supported mechanics version.',
    );
  }
}

function sameVersions(left: MechanicsVersion, right: MechanicsVersion): boolean {
  return stateHash(left) === stateHash(right);
}

async function authenticate(
  accessToken: string,
  gateway: SavedXiCompetitionGateway,
  namespace: string,
): Promise<AuthenticatedPlayer> {
  if (!accessToken) {
    throw new TrustedReplayError(401, 'MISSING_SESSION', 'Sign in to use Saved-XI competition.');
  }
  const player = await gateway.authenticatePlayer(accessToken);
  if (!player.userId || player.namespace !== namespace) {
    throw new TrustedReplayError(
      403,
      'WRONG_NAMESPACE',
      'The player session does not belong to this Football 11 namespace.',
    );
  }
  return player;
}

function parseResolveRequest(value: unknown): ResolveSavedXiChallengeRequestV1 {
  if (
    !isRecord(value) ||
    value.schemaVersion !== 'football11-resolve-saved-xi-challenge-v1' ||
    typeof value.token !== 'string' ||
    value.token.length === 0 ||
    value.token.length > 128 ||
    Object.keys(value).length !== 2
  ) {
    throw new TrustedReplayError(
      400,
      'INVALID_CHALLENGE_REQUEST',
      'The challenge request is invalid.',
    );
  }
  return {
    schemaVersion: 'football11-resolve-saved-xi-challenge-v1',
    token: value.token,
  };
}

function parseSavedXi(value: unknown, expectedUserId: string): SavedXiRecordV1 {
  if (
    !isRecord(value) ||
    value.schemaVersion !== 'football11-saved-xi-v1' ||
    typeof value.savedXiId !== 'string' ||
    value.ownerUserId !== expectedUserId ||
    typeof value.sourceRunId !== 'string' ||
    typeof value.sourceResultId !== 'string' ||
    value.formationId !== '4-3-3-v1' ||
    !Array.isArray(value.roster) ||
    value.roster.length !== 11 ||
    !isUnits(value.units) ||
    !isRecord(value.versions) ||
    value.headToHeadVersion !== 'head-to-head-v1' ||
    typeof value.seasonPoints !== 'number' ||
    !Number.isFinite(value.seasonPoints) ||
    typeof value.publishedAt !== 'string'
  ) {
    throw new TrustedReplayError(502, 'INVALID_SAVED_XI', 'A stored Saved XI is invalid.');
  }
  return value as unknown as SavedXiRecordV1;
}

function parseChallenge(value: unknown, expectedUserId: string): IssuedSavedXiChallengeV1 {
  if (
    !isRecord(value) ||
    value.schemaVersion !== 'football11-saved-xi-challenge-v1' ||
    typeof value.matchId !== 'string' ||
    typeof value.token !== 'string' ||
    value.challengerUserId !== expectedUserId ||
    typeof value.opponentLabel !== 'string' ||
    typeof value.opponentRank !== 'number' ||
    typeof value.matchSeed !== 'string' ||
    typeof value.issuedAt !== 'string' ||
    typeof value.expiresAt !== 'string' ||
    !(value.consumedAt === null || typeof value.consumedAt === 'string')
  ) {
    throw new TrustedReplayError(502, 'INVALID_CHALLENGE', 'A stored challenge is invalid.');
  }
  parseSavedXi(value.challengerXi, expectedUserId);
  if (!isRecord(value.opponentXi) || typeof value.opponentXi.ownerUserId !== 'string') {
    throw new TrustedReplayError(502, 'INVALID_CHALLENGE', 'A stored opponent XI is invalid.');
  }
  parseSavedXi(value.opponentXi, value.opponentXi.ownerUserId);
  return value as unknown as IssuedSavedXiChallengeV1;
}

function parseHistory(value: unknown, expectedUserId: string): AsyncMatchHistoryV1 {
  if (value === null) {
    return { schemaVersion: 'football11-async-history-v1', matches: [] };
  }
  if (
    !isRecord(value) ||
    value.schemaVersion !== 'football11-async-history-v1' ||
    !Array.isArray(value.matches) ||
    value.matches.length > MAX_MATCH_HISTORY ||
    value.matches.some(
      (match) =>
        !isRecord(match) ||
        match.schemaVersion !== 'football11-async-match-v1' ||
        match.challengerUserId !== expectedUserId ||
        typeof match.matchId !== 'string' ||
        typeof match.opponentUserId !== 'string' ||
        (match.settlementStatus !== 'pending' && match.settlementStatus !== 'settled'),
    )
  ) {
    throw new TrustedReplayError(502, 'INVALID_MATCH_HISTORY', 'Stored match history is invalid.');
  }
  return value as unknown as AsyncMatchHistoryV1;
}

function prependMatch(
  history: AsyncMatchHistoryV1,
  match: AsyncMatchRecordV1,
): AsyncMatchHistoryV1 {
  return {
    schemaVersion: 'football11-async-history-v1',
    matches: [match, ...history.matches.filter((item) => item.matchId !== match.matchId)].slice(
      0,
      MAX_MATCH_HISTORY,
    ),
  };
}

function savedXiView(savedXi: SavedXiRecordV1): SavedXiViewV1 {
  return {
    savedXiId: savedXi.savedXiId,
    sourceResultId: savedXi.sourceResultId,
    roster: savedXi.roster.map((assignment) => ({ ...assignment })),
    units: { ...savedXi.units },
    versions: { ...savedXi.versions },
    seasonPoints: savedXi.seasonPoints,
    publishedAt: savedXi.publishedAt,
  };
}

function challengePreview(challenge: IssuedSavedXiChallengeV1): SavedXiChallengePreviewV1 {
  return {
    matchId: challenge.matchId,
    token: challenge.token,
    opponentLabel: challenge.opponentLabel,
    opponentRank: challenge.opponentRank,
    opponentXi: savedXiView(challenge.opponentXi),
    expiresAt: challenge.expiresAt,
  };
}

function matchView(match: AsyncMatchRecordV1): AsyncMatchViewV1 {
  const { evidence: _privateEvidence, ...publicResult } = match.result;
  return {
    matchId: match.matchId,
    challengerXiId: match.challengerXiId,
    opponentXiId: match.opponentXiId,
    opponentLabel: match.opponentLabel,
    opponentRank: match.opponentRank,
    result: publicResult,
    scoreBefore: match.scoreBefore,
    scoreAfter: match.scoreAfter,
    settlementStatus: match.settlementStatus,
    createdAt: match.createdAt,
    settledAt: match.settledAt,
  };
}

function safeOpponentLabel(userId: string): string {
  return `Player ${stateHash(userId).slice(0, 4).toUpperCase()}`;
}

function isUnits(value: unknown): boolean {
  return (
    isRecord(value) &&
    typeof value.attack === 'number' &&
    Number.isFinite(value.attack) &&
    typeof value.defence === 'number' &&
    Number.isFinite(value.defence) &&
    typeof value.control === 'number' &&
    Number.isFinite(value.control)
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function now(options: CompetitionOptions): Date {
  return (options.now ?? (() => new Date()))();
}

function conflict(code: string, message: string): TrustedReplayError {
  return new TrustedReplayError(409, code, message);
}
