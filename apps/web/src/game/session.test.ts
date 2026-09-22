import { describe, expect, it } from 'vitest';
import type { FriendRoomChallengeV1 } from '@football-11/contracts';
import { DEFAULT_MECHANICS_VERSION } from '@football-11/domain';

import {
  createGameSession,
  createGameSessionFromChallenge,
  deriveFriendRoomPlayerSeed,
  rerollOffer,
  selectPlayer,
} from './session';
import { soloDraftChallenge, TEST_DRAFT_CONFIG } from '../test/draftChallenge';

const roomChallenge: FriendRoomChallengeV1 = {
  schemaVersion: 'football11-room-challenge-v1',
  challengeId: 'room-round-1',
  roundOrdinal: 1,
  seed: '0123456789abcdef0123456789abcdef',
  seedStrategy: 'per-player-v1',
  versions: DEFAULT_MECHANICS_VERSION,
  draftConfig: TEST_DRAFT_CONFIG,
  participantUserIds: ['user-one', 'user-two'],
  startedAt: '2026-09-03T00:00:00.000Z',
  deadlineAt: '2026-09-03T00:15:00.000Z',
};

describe('React session integration', () => {
  it('uses shared mechanics to complete and resolve an eleven-player run', () => {
    let session = createGameSession(soloDraftChallenge('phase-1b-browser-integration'));

    for (let round = 1; round <= 11; round += 1) {
      const card = session.snapshot.offer?.cards[0];
      const slot = card?.safeSlotCodes[0];
      expect(card, `round ${round} card`).toBeDefined();
      expect(slot, `round ${round} slot`).toBeDefined();
      if (!card || !slot) throw new Error(`Missing legal action in round ${round}.`);
      session = selectPlayer(session, card.playerSeasonId, slot);
    }

    expect(session.snapshot.offer).toBeNull();
    expect(Object.keys(session.snapshot.state.roster)).toHaveLength(11);
    expect(session.actions).toHaveLength(11);
    expect(session.resolved?.result.roster).toHaveLength(11);
    expect(session.resolved?.result.season.matches).toHaveLength(38);
    expect(session.resolved?.result.finalStateHash).toBe(session.snapshot.state.stateHash);
  });

  it('routes rerolls through the shared draft transition', () => {
    const initial = createGameSession(soloDraftChallenge('phase-1b-reroll-integration'));
    expect(initial.snapshot.offer?.cards).toHaveLength(15);
    expect(initial.snapshot.offer?.rerollAvailable).toBe(true);

    const rerolled = rerollOffer(initial);
    expect(rerolled.snapshot.state.round).toBe(1);
    expect(rerolled.snapshot.state.rerollsRemaining).toBe(4);
    expect(rerolled.snapshot.state.currentConstraint).not.toEqual(
      initial.snapshot.state.currentConstraint,
    );
    expect(rerolled.snapshot.state.currentOfferIds).not.toEqual(
      initial.snapshot.state.currentOfferIds,
    );
  });

  it('derives a stable and distinct deterministic seed for each room participant', () => {
    const first = createGameSessionFromChallenge(roomChallenge, 'user-one');
    const restored = createGameSessionFromChallenge(roomChallenge, 'user-one');
    const other = createGameSessionFromChallenge(roomChallenge, 'user-two');

    expect(restored.seed).toBe(first.seed);
    expect(restored.snapshot.state.currentOfferIds).toEqual(first.snapshot.state.currentOfferIds);
    expect(other.seed).not.toBe(first.seed);
    expect(other.snapshot.state.currentOfferIds).not.toEqual(first.snapshot.state.currentOfferIds);
  });

  it('changes a participant seed on the next room cycle', () => {
    const current = deriveFriendRoomPlayerSeed(roomChallenge, 'user-one');
    const next = deriveFriendRoomPlayerSeed(
      {
        ...roomChallenge,
        challengeId: 'room-round-2',
        seed: 'fedcba9876543210fedcba9876543210',
      },
      'user-one',
    );

    expect(next).not.toBe(current);
  });

  it('keeps legacy room challenges replayable with their shared seed', () => {
    const legacy = { ...roomChallenge, seedStrategy: undefined };
    expect(deriveFriendRoomPlayerSeed(legacy, 'user-one')).toBe(legacy.seed);
    expect(deriveFriendRoomPlayerSeed(legacy, 'user-two')).toBe(legacy.seed);
  });
});
