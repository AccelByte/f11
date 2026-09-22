import { describe, expect, it } from 'vitest';
import type { FriendRoomChallengeV1 } from '@football-11/contracts';
import { DEFAULT_MECHANICS_VERSION } from '@football-11/domain';

import { createGameSessionFromChallenge } from '../../game/session';
import { TEST_DRAFT_CONFIG } from '../../test/draftChallenge';
import { loadRoomDraft, roomDraftStorageKey, type RoomDraftStore } from './roomDraftStore';

class MemoryRoomDraftStore implements RoomDraftStore {
  readonly values = new Map<string, string>();

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }

  removeItem(key: string): void {
    this.values.delete(key);
  }
}

function challenge(participantUserIds = ['user-1']): FriendRoomChallengeV1 {
  return {
    schemaVersion: 'football11-room-challenge-v1',
    challengeId: 'legacy-room-round',
    roundOrdinal: 1,
    seed: 'legacy-shared-seed',
    versions: DEFAULT_MECHANICS_VERSION,
    draftConfig: TEST_DRAFT_CONFIG,
    participantUserIds,
    startedAt: '2026-09-03T00:00:00.000Z',
    deadlineAt: '2026-09-03T00:15:00.000Z',
  };
}

describe('friend-room draft storage', () => {
  it('scopes every new draft key to challenge and authenticated player', () => {
    const roomChallenge = challenge(['user-1', 'user-2']);

    expect(roomDraftStorageKey(roomChallenge, 'user-1')).not.toBe(
      roomDraftStorageKey(roomChallenge, 'user-2'),
    );
  });

  it('migrates an attributable single-player legacy draft to the scoped key', () => {
    const store = new MemoryRoomDraftStore();
    const roomChallenge = challenge();
    const session = createGameSessionFromChallenge(roomChallenge, 'user-1');
    const legacyKey = `football11.ags.friend-room.draft.v1.${roomChallenge.challengeId}`;
    store.setItem(legacyKey, JSON.stringify(session));

    expect(loadRoomDraft(store, roomChallenge, 'user-1')).toEqual(session);
    expect(store.getItem(legacyKey)).toBeNull();
    expect(store.getItem(roomDraftStorageKey(roomChallenge, 'user-1'))).not.toBeNull();
  });

  it('does not claim an ambiguous multi-player legacy draft', () => {
    const store = new MemoryRoomDraftStore();
    const roomChallenge = challenge(['user-1', 'user-2']);
    const legacyKey = `football11.ags.friend-room.draft.v1.${roomChallenge.challengeId}`;
    store.setItem(
      legacyKey,
      JSON.stringify(createGameSessionFromChallenge(roomChallenge, 'user-2')),
    );

    expect(loadRoomDraft(store, roomChallenge, 'user-1')).toBeNull();
    expect(store.getItem(legacyKey)).not.toBeNull();
  });
});
