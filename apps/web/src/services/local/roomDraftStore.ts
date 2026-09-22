import type { FriendRoomChallengeV1 } from '@football-11/contracts';

import { deriveFriendRoomPlayerSeed, type GameSession } from '../../game/session';

const ROOM_DRAFT_STORAGE_PREFIX = 'football11.ags.friend-room.draft.v1.';

export interface RoomDraftStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export function roomDraftStorageKey(challenge: FriendRoomChallengeV1, userId: string): string {
  return `${ROOM_DRAFT_STORAGE_PREFIX}${encodeURIComponent(challenge.challengeId)}.${encodeURIComponent(userId)}`;
}

export function loadRoomDraft(
  store: RoomDraftStore,
  challenge: FriendRoomChallengeV1,
  userId: string,
): GameSession | null {
  const playerSeed = deriveFriendRoomPlayerSeed(challenge, userId);
  const scopedKey = roomDraftStorageKey(challenge, userId);
  const legacyKey = `${ROOM_DRAFT_STORAGE_PREFIX}${challenge.challengeId}`;
  const canClaimLegacy =
    (challenge.seedStrategy === undefined || challenge.seedStrategy === 'shared-v1') &&
    challenge.participantUserIds.length === 1 &&
    challenge.participantUserIds[0] === userId;
  const keys = canClaimLegacy ? [scopedKey, legacyKey] : [scopedKey];

  for (const key of keys) {
    try {
      const stored = store.getItem(key);
      if (!stored) continue;
      const candidate = JSON.parse(stored) as GameSession;
      if (candidate.challengeId !== challenge.challengeId || candidate.seed !== playerSeed) {
        store.removeItem(key);
        continue;
      }
      if (key === legacyKey) {
        store.setItem(scopedKey, stored);
        store.removeItem(legacyKey);
      }
      return candidate;
    } catch {
      store.removeItem(key);
    }
  }
  return null;
}
