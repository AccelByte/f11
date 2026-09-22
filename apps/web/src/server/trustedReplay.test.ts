import { describe, expect, it, vi } from 'vitest';
import type {
  FriendRoomChallengeV1,
  TrustedLeaderboardViewV1,
  TrustedRunReceiptV1,
  TrustedRunSubmissionV1,
} from '@football-11/contracts';
import { DEFAULT_MECHANICS_VERSION } from '@football-11/domain';

import {
  createGameSession,
  createGameSessionFromChallenge,
  selectPlayer,
  type GameSession,
} from '../game/session';
import {
  draftChallengeReceipt,
  soloDraftChallenge,
  TEST_DRAFT_CONFIG,
} from '../test/draftChallenge';
import {
  parseTrustedSubmission,
  settleTrustedRun,
  type TrustedReplayGateway,
  type TrustedRoomSnapshot,
} from './trustedReplay';

function completedSubmission(seed = 'trusted-replay-test-seed'): TrustedRunSubmissionV1 {
  let session = createGameSession(soloDraftChallenge(seed));
  return completeSession(session);
}

function completeSession(initial: GameSession): TrustedRunSubmissionV1 {
  let session = initial;
  while (!session.resolved) {
    const offer = session.snapshot.offer;
    if (!offer) throw new Error('Expected a draft offer.');
    const card = offer.cards[0];
    const slot = card?.safeSlotCodes[0];
    if (!card || !slot) throw new Error('Expected a safe selection.');
    session = selectPlayer(session, card.playerSeasonId, slot);
  }
  return {
    schemaVersion: 'football11-trusted-submit-v1',
    runId: session.resolved.result.resultId,
    challengeId: session.challengeId,
    seed: session.seed,
    versions: DEFAULT_MECHANICS_VERSION,
    draftConfig: session.draftConfig,
    actions: session.actions,
  };
}

function rankedView(points: number): TrustedLeaderboardViewV1 {
  return {
    status: 'ranked',
    bestPoints: points,
    rank: 1,
    entries: [{ rank: 1, points, label: 'You', isCurrentPlayer: true }],
  };
}

function gateway(
  input: TrustedRunSubmissionV1,
  overrides: Partial<TrustedReplayGateway> = {},
): TrustedReplayGateway {
  const issued = soloDraftChallenge(input.seed);
  issued.challengeId = input.challengeId;
  issued.versions = input.versions;
  issued.draftConfig = input.draftConfig;
  return {
    authenticatePlayer: vi.fn(async () => ({ userId: 'user-1', namespace: 'game-ns' })),
    readRoom: vi.fn(async () => {
      throw new Error('A solo replay must not read an AGS room.');
    }),
    readActiveDraftChallenge: vi.fn(async () => draftChallengeReceipt('user-1', issued)),
    readReceipt: vi.fn(async () => null),
    settleBestPoints: vi.fn(async (_userId, points) => points),
    writeReceipt: vi.fn(async () => undefined),
    readLeaderboard: vi.fn(async (_userId, points) => rankedView(points)),
    ...overrides,
  };
}

function roomSnapshot(challenge: FriendRoomChallengeV1): TrustedRoomSnapshot {
  return {
    sessionId: 'session-1',
    namespace: 'game-ns',
    configurationName: 'football11-friend-room-v1',
    activeMemberUserIds: ['user-1'],
    challenge,
  };
}

describe('trusted replay settlement', () => {
  it('replays legal evidence, settles MAX points, stores a receipt, and returns AGS ranking', async () => {
    const input = completedSubmission();
    const target = gateway(input);
    const response = await settleTrustedRun(input, 'player-token', target, {
      namespace: 'game-ns',
      now: () => new Date('2026-09-03T12:00:00.000Z'),
    });

    expect(response.result.resultId).toBe(input.runId);
    expect(response.receipt.points).toBe(response.result.season.points);
    expect(response.receipt.verifiedAt).toBe('2026-09-03T12:00:00.000Z');
    expect(response.duplicate).toBe(false);
    expect(target.settleBestPoints).toHaveBeenCalledWith(
      'user-1',
      response.result.season.points,
      response.receipt,
    );
    expect(target.writeReceipt).toHaveBeenCalledWith('user-1', response.receipt);
  });

  it('replays a room run built from the authenticated participant seed', async () => {
    const challenge: FriendRoomChallengeV1 = {
      schemaVersion: 'football11-room-challenge-v1',
      challengeId: 'trusted-room-round-1',
      roundOrdinal: 1,
      seed: '0123456789abcdef0123456789abcdef',
      seedStrategy: 'per-player-v1',
      versions: DEFAULT_MECHANICS_VERSION,
      draftConfig: TEST_DRAFT_CONFIG,
      participantUserIds: ['user-1'],
      startedAt: '2026-09-03T12:00:00.000Z',
      deadlineAt: '2026-09-03T12:15:00.000Z',
    };
    const input = completeSession(createGameSessionFromChallenge(challenge, 'user-1'));
    input.roomSessionId = 'session-1';
    const target = gateway(input, {
      readActiveDraftChallenge: vi.fn(async () =>
        draftChallengeReceipt('user-1', challenge, 'session-1'),
      ),
      readRoom: vi.fn(async () => roomSnapshot(challenge)),
    });

    const response = await settleTrustedRun(input, 'player-token', target, {
      namespace: 'game-ns',
    });

    expect(response.result.resultId).toBe(input.runId);
    expect(input.seed).not.toBe(challenge.seed);
    expect(target.readRoom).toHaveBeenCalledWith('session-1', 'player-token');
  });

  it('rejects a room seed that is not derived for the authenticated participant', async () => {
    const challenge: FriendRoomChallengeV1 = {
      schemaVersion: 'football11-room-challenge-v1',
      challengeId: 'trusted-room-round-2',
      roundOrdinal: 2,
      seed: 'fedcba9876543210fedcba9876543210',
      seedStrategy: 'per-player-v1',
      versions: DEFAULT_MECHANICS_VERSION,
      draftConfig: TEST_DRAFT_CONFIG,
      participantUserIds: ['user-1'],
      startedAt: '2026-09-04T12:00:00.000Z',
      deadlineAt: '2026-09-04T12:15:00.000Z',
    };
    const input = completeSession(createGameSessionFromChallenge(challenge, 'user-1'));
    input.roomSessionId = 'session-1';
    input.seed = challenge.seed;
    const target = gateway(input, {
      readActiveDraftChallenge: vi.fn(async () =>
        draftChallengeReceipt('user-1', challenge, 'session-1'),
      ),
      readRoom: vi.fn(async () => roomSnapshot(challenge)),
    });

    await expect(
      settleTrustedRun(input, 'player-token', target, { namespace: 'game-ns' }),
    ).rejects.toMatchObject({ code: 'ROOM_SEED_MISMATCH', status: 400 });
    expect(target.settleBestPoints).not.toHaveBeenCalled();
  });

  it('rejects a room run when the authenticated player is not a locked active member', async () => {
    const challenge: FriendRoomChallengeV1 = {
      schemaVersion: 'football11-room-challenge-v1',
      challengeId: 'trusted-room-round-3',
      roundOrdinal: 3,
      seed: '00112233445566778899aabbccddeeff',
      seedStrategy: 'per-player-v1',
      versions: DEFAULT_MECHANICS_VERSION,
      draftConfig: TEST_DRAFT_CONFIG,
      participantUserIds: ['user-2'],
      startedAt: '2026-09-04T12:00:00.000Z',
      deadlineAt: '2026-09-04T12:15:00.000Z',
    };
    const input = completedSubmission('member-mismatch');
    input.challengeId = challenge.challengeId;
    input.roomSessionId = 'session-1';
    const target = gateway(input, {
      readActiveDraftChallenge: vi.fn(async () =>
        draftChallengeReceipt('user-1', challenge, 'session-1'),
      ),
      readRoom: vi.fn(async () => ({
        ...roomSnapshot(challenge),
        activeMemberUserIds: ['user-2'],
      })),
    });

    await expect(
      settleTrustedRun(input, 'player-token', target, { namespace: 'game-ns' }),
    ).rejects.toMatchObject({ code: 'ROOM_MEMBERSHIP_MISMATCH', status: 403 });
    expect(target.settleBestPoints).not.toHaveBeenCalled();
  });

  it('keeps legacy shared-seed room submissions verifiable', async () => {
    const challenge: FriendRoomChallengeV1 = {
      schemaVersion: 'football11-room-challenge-v1',
      challengeId: 'legacy-room-round',
      roundOrdinal: 1,
      seed: 'legacy-shared-seed',
      versions: DEFAULT_MECHANICS_VERSION,
      draftConfig: TEST_DRAFT_CONFIG,
      participantUserIds: ['user-1'],
      startedAt: '2026-09-03T12:00:00.000Z',
      deadlineAt: '2026-09-03T12:15:00.000Z',
    };
    const input = completeSession(createGameSessionFromChallenge(challenge, 'user-1'));
    input.roomSessionId = 'session-1';

    await expect(
      settleTrustedRun(
        input,
        'player-token',
        gateway(input, {
          readActiveDraftChallenge: vi.fn(async () =>
            draftChallengeReceipt('user-1', challenge, 'session-1'),
          ),
          readRoom: vi.fn(async () => roomSnapshot(challenge)),
        }),
        { namespace: 'game-ns' },
      ),
    ).resolves.toMatchObject({ duplicate: false });
  });

  it('returns an existing matching receipt without another statistic or receipt mutation', async () => {
    const input = completedSubmission('duplicate-seed');
    const firstGateway = gateway(input);
    const accepted = await settleTrustedRun(input, 'player-token', firstGateway, {
      namespace: 'game-ns',
    });
    const target = gateway(input, { readReceipt: vi.fn(async () => accepted.receipt) });

    const duplicate = await settleTrustedRun(input, 'player-token', target, {
      namespace: 'game-ns',
    });

    expect(duplicate.duplicate).toBe(true);
    expect(target.settleBestPoints).not.toHaveBeenCalled();
    expect(target.writeReceipt).not.toHaveBeenCalled();
  });

  it('rejects a tampered action before any competitive mutation', async () => {
    const input = completedSubmission('tampered-seed');
    input.actions[0] = { ...input.actions[0]!, round: 11 };
    const target = gateway(input);

    await expect(
      settleTrustedRun(input, 'player-token', target, { namespace: 'game-ns' }),
    ).rejects.toMatchObject({ code: 'REPLAY_REJECTED', status: 400 });
    expect(target.settleBestPoints).not.toHaveBeenCalled();
    expect(target.writeReceipt).not.toHaveBeenCalled();
  });

  it('rejects client changes to the frozen AGS draft configuration', async () => {
    const input = completedSubmission('tampered-config-seed');
    const target = gateway(input);
    input.draftConfig = { ...input.draftConfig, maxRerolls: 4 };

    await expect(
      settleTrustedRun(input, 'player-token', target, { namespace: 'game-ns' }),
    ).rejects.toMatchObject({ code: 'DRAFT_CHALLENGE_MISMATCH', status: 409 });
    expect(target.settleBestPoints).not.toHaveBeenCalled();
    expect(target.writeReceipt).not.toHaveBeenCalled();
  });

  it('rejects an unsupported mechanics version before authentication or mutation', async () => {
    const input = completedSubmission('version-seed');
    input.versions = { ...input.versions, rulesVersion: 'rules-v999' } as typeof input.versions;
    const target = gateway(input);

    await expect(
      settleTrustedRun(input, 'player-token', target, { namespace: 'game-ns' }),
    ).rejects.toMatchObject({ code: 'UNSUPPORTED_VERSION', status: 400 });
    expect(target.authenticatePlayer).not.toHaveBeenCalled();
    expect(target.settleBestPoints).not.toHaveBeenCalled();
  });

  it('rejects an authenticated player from another namespace before replay mutation', async () => {
    const input = completedSubmission('namespace-seed');
    const target = gateway(input, {
      authenticatePlayer: vi.fn(async () => ({ userId: 'user-1', namespace: 'other-ns' })),
    });

    await expect(
      settleTrustedRun(input, 'player-token', target, { namespace: 'game-ns' }),
    ).rejects.toMatchObject({ code: 'WRONG_NAMESPACE', status: 403 });
    expect(target.settleBestPoints).not.toHaveBeenCalled();
  });

  it('accepts five rerolls in the trusted submission boundary', () => {
    const input = completedSubmission('five-reroll-boundary-seed');
    input.actions = [
      { type: 'reroll', round: 1 },
      { type: 'reroll', round: 2 },
      { type: 'reroll', round: 3 },
      { type: 'reroll', round: 4 },
      { type: 'reroll', round: 5 },
      ...input.actions,
    ];

    expect(parseTrustedSubmission(input).actions).toHaveLength(16);
  });

  it('rejects a sixth reroll before authentication', async () => {
    const input = completedSubmission('reroll-limit-seed');
    input.actions = [
      { type: 'reroll', round: 1 },
      { type: 'reroll', round: 1 },
      { type: 'reroll', round: 1 },
      { type: 'reroll', round: 1 },
      { type: 'reroll', round: 1 },
      { type: 'reroll', round: 1 },
      ...input.actions,
    ];
    const target = gateway(input);

    await expect(
      settleTrustedRun(input, 'player-token', target, { namespace: 'game-ns' }),
    ).rejects.toMatchObject({ code: 'INVALID_ACTIONS', status: 400 });
    expect(target.authenticatePlayer).not.toHaveBeenCalled();
  });

  it('fails closed when a stored server receipt has an invalid shape', async () => {
    const input = completedSubmission('invalid-receipt-seed');
    const target = gateway(input, {
      readReceipt: vi.fn(async () => ({ runId: input.runId })),
    });

    await expect(
      settleTrustedRun(input, 'player-token', target, { namespace: 'game-ns' }),
    ).rejects.toMatchObject({ code: 'INVALID_SETTLEMENT_RECEIPT', status: 502 });
    expect(target.settleBestPoints).not.toHaveBeenCalled();
  });

  it('detects a conflicting receipt for the same run identifier', async () => {
    const input = completedSubmission('receipt-conflict-seed');
    const conflicting: TrustedRunReceiptV1 = {
      schemaVersion: 'football11-trusted-receipt-v1',
      runId: input.runId,
      resultId: input.runId,
      resultHash: 'different',
      finalStateHash: 'different',
      points: 0,
      verifiedAt: '2026-09-03T00:00:00.000Z',
    };
    const target = gateway(input, { readReceipt: vi.fn(async () => conflicting) });

    await expect(
      settleTrustedRun(input, 'player-token', target, { namespace: 'game-ns' }),
    ).rejects.toMatchObject({ code: 'SETTLEMENT_CONFLICT', status: 409 });
    expect(target.settleBestPoints).not.toHaveBeenCalled();
  });
});
