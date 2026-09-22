import { describe, expect, it } from 'vitest';
import { DEFAULT_MECHANICS_VERSION } from '@football-11/domain';
import type { FriendRoomChallengeV1 } from '@football-11/contracts';

import {
  abandonFriendRoomParticipant,
  beginFriendRoomCountdown,
  beginFriendRoomDraft,
  canStartFriendRoom,
  createInitialFriendRoomState,
  friendRoomComparison,
  isFriendRoomCountdownDue,
  readFriendRoomState,
  revealFriendRoom,
  setMemberReady,
  shouldRevealFriendRoom,
  startFriendRoomRound,
  updateFriendRoomProgress,
} from './friendRoomMachine';
import { TEST_DRAFT_CONFIG } from '../test/draftChallenge';

const start = '2026-09-03T00:00:00.000Z';
const challenge: FriendRoomChallengeV1 = {
  schemaVersion: 'football11-room-challenge-v1',
  challengeId: 'room-1-round-1',
  roundOrdinal: 1,
  seed: '0123456789abcdef0123456789abcdef',
  seedStrategy: 'per-player-v1',
  versions: DEFAULT_MECHANICS_VERSION,
  draftConfig: TEST_DRAFT_CONFIG,
  participantUserIds: ['one', 'two'],
  startedAt: start,
  deadlineAt: '2026-09-03T00:15:00.000Z',
};

function result(userId: string, points: number, wins: number, composite: number) {
  return {
    challengeId: challenge.challengeId,
    userId,
    points,
    wins,
    draws: 3,
    losses: 7,
    composite,
    finalStateHash: `${userId}-hash`,
    submittedAt: '2026-09-03T00:05:00.000Z',
  };
}

describe('friend room state machine', () => {
  it('requires every active member to opt in before the first round', () => {
    let state = createInitialFriendRoomState(start);
    state = setMemberReady(state, 'one', true, start);
    expect(canStartFriendRoom(state, ['one', 'two'])).toBe(false);
    state = setMemberReady(state, 'two', true, start);
    expect(canStartFriendRoom(state, ['one', 'two'])).toBe(true);
  });

  it('locks participants, keeps progress public-only, and reveals terminal runs', () => {
    let state = createInitialFriendRoomState(start);
    state = setMemberReady(state, 'one', true, start);
    state = setMemberReady(state, 'two', true, start);
    state = startFriendRoomRound(state, ['one', 'two'], challenge, start);
    expect(state.phase).toBe('STARTING');
    expect(state.readyUserIds).toEqual([]);

    state = beginFriendRoomDraft(state, start);
    state = updateFriendRoomProgress(
      state,
      'one',
      11,
      'FINISHED',
      result('one', 81, 25, 75),
      start,
    );
    state = abandonFriendRoomParticipant(state, 'two', start);
    expect(state.progressByUserId.one).toEqual({
      selectedCount: 11,
      status: 'FINISHED',
      updatedAt: start,
    });
    expect(state.progressByUserId.one).not.toHaveProperty('actions');
    expect(shouldRevealFriendRoom(state, start)).toBe(true);

    state = revealFriendRoom(state, start, 30);
    expect(state.phase).toBe('REVEAL');
    expect(state.countdownEndsAt).toBe('2026-09-03T00:00:30.000Z');
    state = beginFriendRoomCountdown(state, start);
    expect(isFriendRoomCountdownDue(state, '2026-09-03T00:00:29.000Z')).toBe(false);
    expect(isFriendRoomCountdownDue(state, '2026-09-03T00:00:30.000Z')).toBe(true);
  });

  it('times out unfinished participants and assigns deterministic tied ranks', () => {
    let state = createInitialFriendRoomState(start);
    state = setMemberReady(state, 'one', true, start);
    state = setMemberReady(state, 'two', true, start);
    state = startFriendRoomRound(state, ['one', 'two'], challenge, start);
    state = beginFriendRoomDraft(state, start);
    state = updateFriendRoomProgress(
      state,
      'one',
      11,
      'FINISHED',
      result('one', 80, 24, 74),
      start,
    );
    state = {
      ...state,
      resultByUserId: {
        ...state.resultByUserId,
        two: result('two', 80, 24, 74),
      },
      progressByUserId: {
        ...state.progressByUserId,
        two: { selectedCount: 11, status: 'FINISHED', updatedAt: start },
      },
    };
    state = revealFriendRoom(state, start, 30);
    expect(friendRoomComparison(state).map((entry) => entry.rank)).toEqual([1, 1]);

    let timeout = createInitialFriendRoomState(start);
    timeout = setMemberReady(timeout, 'one', true, start);
    timeout = setMemberReady(timeout, 'two', true, start);
    timeout = startFriendRoomRound(timeout, ['one', 'two'], challenge, start);
    timeout = beginFriendRoomDraft(timeout, start);
    timeout = revealFriendRoom(timeout, challenge.deadlineAt, 30);
    expect(
      Object.values(timeout.progressByUserId).every((item) => item.status === 'TIMED_OUT'),
    ).toBe(true);
  });

  it('starts later rounds with only opted-in active members', () => {
    let state = createInitialFriendRoomState(start);
    state = { ...state, roundOrdinal: 1, phase: 'COUNTDOWN' };
    state = setMemberReady(state, 'two', true, start);
    const next = {
      ...challenge,
      challengeId: 'room-1-round-2',
      roundOrdinal: 2,
      participantUserIds: ['two'],
    };
    state = startFriendRoomRound(state, ['one', 'two'], next, start);
    expect(Object.keys(state.progressByUserId)).toEqual(['two']);
  });

  it('rejects a future room seed strategy as incompatible state', () => {
    const state = {
      ...createInitialFriendRoomState(start),
      challenge: { ...challenge, seedStrategy: 'per-player-v2' },
    };

    expect(() => readFriendRoomState({ football11Room: state })).toThrow(
      'unsupported room seed strategy',
    );
  });
});
