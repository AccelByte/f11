import type {
  DraftChallengeReceiptV1,
  DraftConfigSnapshotV1,
  IssuedSoloDraftChallengeV1,
} from '@football-11/contracts';
import { DEFAULT_MECHANICS_VERSION } from '@football-11/domain';

export const TEST_DRAFT_CONFIG: DraftConfigSnapshotV1 = {
  schemaVersion: 1,
  revision: '1',
  maxOfferedPlayers: 15,
  maxRerolls: 5,
};

export function soloDraftChallenge(seed: string): IssuedSoloDraftChallengeV1 {
  return {
    schemaVersion: 1,
    kind: 'solo',
    challengeId: `challenge-${seed}`,
    seed,
    versions: DEFAULT_MECHANICS_VERSION,
    draftConfig: TEST_DRAFT_CONFIG,
    issuedAt: '2026-09-04T00:00:00.000Z',
  };
}

export function draftChallengeReceipt(
  userId: string,
  challenge: DraftChallengeReceiptV1['challenge'],
  roomSessionId?: string,
): DraftChallengeReceiptV1 {
  return {
    schemaVersion: 1,
    idempotencyKey: `test-key-${challenge.challengeId}`.replace(/[^A-Za-z0-9-]/g, '-').slice(0, 96),
    userId,
    ...(roomSessionId ? { roomSessionId } : {}),
    challenge,
  };
}
