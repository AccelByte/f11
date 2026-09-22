import { describe, expect, it, vi } from 'vitest';
import type {
  AsyncMatchHistoryV1,
  AsyncMatchRecordV1,
  IssuedSavedXiChallengeV1,
  SavedXiRecordV1,
  TrustedRunReceiptV1,
  TrustedRunSubmissionV1,
} from '@football-11/contracts';
import { stateHash } from '@football-11/domain';

import { createGameSession, selectPlayer } from '../game/session';
import { soloDraftChallenge } from '../test/draftChallenge';
import {
  getSavedXiCompetitionStatus,
  issueSavedXiChallenge,
  publishSavedXi,
  resolveSavedXiChallenge,
  type NearbyLeaderboardCandidate,
  type SavedXiCompetitionGateway,
} from './savedXiCompetition';
import { replayTrustedSubmission } from './trustedReplay';

const fixedNow = new Date('2026-09-03T12:00:00.000Z');
const options = { namespace: 'game-ns', now: () => fixedNow };

function completedSubmission(seed = 'saved-xi-test-seed'): TrustedRunSubmissionV1 {
  let session = createGameSession(soloDraftChallenge(seed));
  while (!session.resolved) {
    const card = session.snapshot.offer?.cards[0];
    const slot = card?.safeSlotCodes[0];
    if (!card || !slot) throw new Error('Expected a safe selection.');
    session = selectPlayer(session, card.playerSeasonId, slot);
  }
  return {
    schemaVersion: 'football11-trusted-submit-v1',
    runId: session.resolved.result.resultId,
    challengeId: session.challengeId,
    seed: session.seed,
    versions: session.resolved.result.versions,
    draftConfig: session.draftConfig,
    actions: session.actions,
  };
}

interface FakeGateway extends SavedXiCompetitionGateway {
  bestPoints: number;
  challenge: IssuedSavedXiChallengeV1 | null;
  challengeScore: number;
  failNextSettlement: boolean;
  history: AsyncMatchHistoryV1 | null;
  nearbyByRadius: Map<number, NearbyLeaderboardCandidate[]>;
  radiusCalls: number[];
  receipt: TrustedRunReceiptV1 | null;
  savedXis: Map<string, SavedXiRecordV1>;
  settlementCalls: number;
}

function fakeGateway(): FakeGateway {
  return {
    bestPoints: 0,
    challenge: null,
    challengeScore: 0,
    failNextSettlement: false,
    history: null,
    nearbyByRadius: new Map(),
    radiusCalls: [],
    receipt: null,
    savedXis: new Map(),
    settlementCalls: 0,
    authenticatePlayer: vi.fn(async () => ({ userId: 'user-1', namespace: 'game-ns' })),
    readReceipt: vi.fn(async function (this: FakeGateway) {
      return this.receipt;
    }),
    readBestPoints: vi.fn(async function (this: FakeGateway) {
      return this.bestPoints;
    }),
    readSavedXi: vi.fn(async function (this: FakeGateway, userId: string) {
      return this.savedXis.get(userId) ?? null;
    }),
    readSavedXis: vi.fn(async function (
      this: FakeGateway,
      userIds: string[],
      _accessToken: string,
    ) {
      return userIds.flatMap((userId) => {
        const value = this.savedXis.get(userId);
        return value ? [{ userId, value }] : [];
      });
    }),
    writeSavedXi: vi.fn(async function (
      this: FakeGateway,
      userId: string,
      record: SavedXiRecordV1,
    ) {
      this.savedXis.set(userId, record);
    }),
    readIssuedChallenge: vi.fn(async function (this: FakeGateway) {
      return this.challenge;
    }),
    writeIssuedChallenge: vi.fn(async function (
      this: FakeGateway,
      _userId: string,
      challenge: IssuedSavedXiChallengeV1,
    ) {
      this.challenge = challenge;
    }),
    readMatchHistory: vi.fn(async function (this: FakeGateway) {
      return this.history;
    }),
    writeMatchHistory: vi.fn(async function (
      this: FakeGateway,
      _userId: string,
      history: AsyncMatchHistoryV1,
    ) {
      this.history = history;
    }),
    readNearbyLeaderboardCandidates: vi.fn(async function (
      this: FakeGateway,
      _userId: string,
      _accessToken: string,
      radius: number,
    ) {
      this.radiusCalls.push(radius);
      return this.nearbyByRadius.get(radius) ?? [];
    }),
    readChallengeScore: vi.fn(async function (this: FakeGateway) {
      return this.challengeScore;
    }),
    setChallengeScore: vi.fn(async function (
      this: FakeGateway,
      _userId: string,
      score: number,
      _match: AsyncMatchRecordV1,
    ) {
      this.settlementCalls += 1;
      if (this.failNextSettlement) {
        this.failNextSettlement = false;
        throw new Error('temporary settlement failure');
      }
      this.challengeScore = score;
      return score;
    }),
  };
}

function trustedReceipt(input: TrustedRunSubmissionV1): TrustedRunReceiptV1 {
  const { result } = replayTrustedSubmission(input);
  return {
    schemaVersion: 'football11-trusted-receipt-v1',
    runId: result.resultId,
    resultId: result.resultId,
    resultHash: stateHash(result),
    finalStateHash: result.finalStateHash,
    points: result.season.points,
    verifiedAt: fixedNow.toISOString(),
  };
}

function savedXi(userId: string, input: TrustedRunSubmissionV1): SavedXiRecordV1 {
  const { result } = replayTrustedSubmission(input);
  return {
    schemaVersion: 'football11-saved-xi-v1',
    savedXiId: `xi-${userId}`,
    ownerUserId: userId,
    sourceRunId: result.resultId,
    sourceResultId: result.resultId,
    formationId: '4-3-3-v1',
    roster: result.roster,
    units: result.assessment.units,
    versions: result.versions,
    headToHeadVersion: 'head-to-head-v1',
    seasonPoints: result.season.points,
    publishedAt: fixedNow.toISOString(),
  };
}

async function issuedChallenge(target: FakeGateway) {
  const input = completedSubmission('challenger-xi');
  target.savedXis.set('user-1', savedXi('user-1', input));
  target.savedXis.set('user-2', savedXi('user-2', completedSubmission('opponent-xi')));
  target.nearbyByRadius.set(10, [
    { userId: 'user-1', rank: 1, points: 80 },
    { userId: 'user-2', rank: 2, points: 79 },
  ]);
  const ids = ['selection', 'challenge-token', 'server-only-match-seed'];
  return issueSavedXiChallenge('token', target, {
    ...options,
    randomId: () => ids.shift() ?? 'fallback',
  });
}

describe('Saved-XI competition', () => {
  it('publishes only a trusted personal-best XI and reports replacement', async () => {
    const input = completedSubmission();
    const receipt = trustedReceipt(input);
    const target = fakeGateway();
    target.receipt = receipt;
    target.bestPoints = receipt.points;

    const published = await publishSavedXi(input, 'token', target, options);
    expect(published.replaced).toBe(false);
    expect(published.savedXi.seasonPoints).toBe(receipt.points);
    expect(target.savedXis.get('user-1')?.ownerUserId).toBe('user-1');

    target.bestPoints += 1;
    await expect(publishSavedXi(input, 'token', target, options)).rejects.toMatchObject({
      code: 'NOT_PERSONAL_BEST',
      status: 409,
    });
  });

  it('expands the rank window, filters incompatible XIs, and reuses an active token', async () => {
    const ownInput = completedSubmission('own-discovery');
    const target = fakeGateway();
    target.savedXis.set('user-1', savedXi('user-1', ownInput));
    const incompatible = savedXi('user-2', completedSubmission('old-opponent'));
    incompatible.versions = { ...incompatible.versions, rulesVersion: 'rules-v0' };
    target.savedXis.set('user-2', incompatible);
    target.savedXis.set('user-3', savedXi('user-3', completedSubmission('valid-opponent')));
    target.nearbyByRadius.set(10, [{ userId: 'user-2', rank: 2, points: 70 }]);
    target.nearbyByRadius.set(50, [{ userId: 'user-3', rank: 8, points: 66 }]);
    const ids = ['selection', 'issued-token', 'private-seed'];
    const requestOptions = { ...options, randomId: () => ids.shift() ?? 'fallback' };

    const first = await issueSavedXiChallenge('token', target, requestOptions);
    const second = await issueSavedXiChallenge('token', target, requestOptions);

    expect(first).toEqual(second);
    expect(first.opponentLabel).not.toContain('user-3');
    expect(first.opponentRank).toBe(8);
    expect(target.radiusCalls).toEqual([10, 50]);
  });

  it('settles one challenger-only score and returns the original result on replay', async () => {
    const target = fakeGateway();
    target.challengeScore = 1;
    const challenge = await issuedChallenge(target);
    const request = {
      schemaVersion: 'football11-resolve-saved-xi-challenge-v1',
      token: challenge.token,
    } as const;

    const first = await resolveSavedXiChallenge(request, 'token', target, options);
    const second = await resolveSavedXiChallenge(request, 'token', target, options);

    expect(first.duplicate).toBe(false);
    expect(second.duplicate).toBe(true);
    expect(second.match).toEqual(first.match);
    expect(target.challengeScore).toBe(first.match.scoreAfter);
    expect(first.match.scoreAfter).toBeGreaterThanOrEqual(0);
    expect(first.match.result).not.toHaveProperty('evidence');
    expect(target.settlementCalls).toBe(1);
    expect(target.history?.matches).toHaveLength(1);
  });

  it('repairs a stored pending match without applying a different score', async () => {
    const target = fakeGateway();
    const challenge = await issuedChallenge(target);
    target.failNextSettlement = true;
    const request = {
      schemaVersion: 'football11-resolve-saved-xi-challenge-v1',
      token: challenge.token,
    } as const;

    await expect(resolveSavedXiChallenge(request, 'token', target, options)).rejects.toThrow(
      'temporary settlement failure',
    );
    expect(target.history?.matches[0]?.settlementStatus).toBe('pending');
    const expectedScore = target.history?.matches[0]?.scoreAfter;

    const reloaded = await getSavedXiCompetitionStatus('token', target, {
      ...options,
      now: () => new Date(fixedNow.getTime() + 60 * 60 * 1000),
    });
    expect(reloaded.activeChallenge?.token).toBe(challenge.token);

    const repaired = await resolveSavedXiChallenge(request, 'token', target, options);
    expect(repaired.duplicate).toBe(true);
    expect(repaired.match.settlementStatus).toBe('settled');
    expect(target.challengeScore).toBe(expectedScore);
    expect(target.settlementCalls).toBe(2);
  });

  it('rejects expired challenges and hides them from status', async () => {
    const target = fakeGateway();
    const challenge = await issuedChallenge(target);
    const later = {
      ...options,
      now: () => new Date(fixedNow.getTime() + 11 * 60 * 1000),
    };

    await expect(
      resolveSavedXiChallenge(
        { schemaVersion: 'football11-resolve-saved-xi-challenge-v1', token: challenge.token },
        'token',
        target,
        later,
      ),
    ).rejects.toMatchObject({ code: 'CHALLENGE_EXPIRED', status: 410 });
    const status = await getSavedXiCompetitionStatus('token', target, later);
    expect(status.activeChallenge).toBeNull();
  });
});
