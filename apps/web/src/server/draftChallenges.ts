import type {
  DraftChallengeReceiptV1,
  DraftConfigSnapshotV1,
  FriendRoomChallengeV1,
  FriendRoomStateV1,
  IssueDraftChallengeRequestV1,
  IssueDraftChallengeResponseV1,
  IssuedDraftChallengeV1,
  IssuedSoloDraftChallengeV1,
} from '@football-11/contracts';
import { DEFAULT_MECHANICS_VERSION, validateDraftConfig } from '@football-11/domain';

import { canStartFriendRoom } from '../state/friendRoomMachine';
import { TrustedReplayError, type AuthenticatedPlayer } from './trustedReplay';

export const GAME_CONFIG_RECORD_KEY = 'football11_game_config_v1';
export const ACTIVE_DRAFT_CHALLENGE_RECORD_KEY = 'football11_active_draft_challenge_v1';
export const DRAFT_CHALLENGE_MAX_BYTES = 4 * 1024;

export interface DraftChallengeRoomSnapshot {
  sessionId: string;
  namespace: string;
  configurationName: string;
  leaderId: string;
  activeMemberUserIds: string[];
  state: FriendRoomStateV1;
}

export interface DraftChallengeGateway {
  authenticatePlayer(accessToken: string): Promise<AuthenticatedPlayer>;
  readDraftConfigRecord(): Promise<unknown>;
  readActiveDraftChallenge(userId: string): Promise<unknown>;
  writeActiveDraftChallenge(userId: string, receipt: DraftChallengeReceiptV1): Promise<void>;
  readRoomForDraftChallenge(
    sessionId: string,
    accessToken: string,
  ): Promise<DraftChallengeRoomSnapshot>;
}

interface DraftChallengeOptions {
  namespace: string;
  now?: () => Date;
  randomHex?: (bytes: number) => string;
}

export async function issueDraftChallenge(
  input: unknown,
  accessToken: string,
  gateway: DraftChallengeGateway,
  options: DraftChallengeOptions,
): Promise<IssueDraftChallengeResponseV1> {
  if (!accessToken) {
    throw new TrustedReplayError(401, 'MISSING_SESSION', 'Sign in before starting a draft.');
  }
  const request = parseIssueRequest(input);
  const player = await gateway.authenticatePlayer(accessToken);
  if (!player.userId || player.namespace !== options.namespace) {
    throw new TrustedReplayError(
      403,
      'WRONG_NAMESPACE',
      'The player session does not belong to this Football 11 namespace.',
    );
  }

  const existingValue = await gateway.readActiveDraftChallenge(player.userId);
  if (existingValue !== null) {
    const existing = parseDraftChallengeReceipt(existingValue);
    if (
      existing.idempotencyKey === request.idempotencyKey &&
      existing.roomSessionId === request.roomSessionId
    ) {
      return { schemaVersion: 1, challenge: existing.challenge };
    }
  }

  const draftConfig = parseDraftConfigRecord(await gateway.readDraftConfigRecord());
  const now = (options.now ?? (() => new Date()))();
  const random = options.randomHex ?? randomHex;
  if (request.roomSessionId) {
    const room = await gateway.readRoomForDraftChallenge(request.roomSessionId, accessToken);
    assertRoomCanIssue(room, player, options.namespace);
    const participants = eligibleParticipants(room.state, room.activeMemberUserIds);
    const challenge: FriendRoomChallengeV1 = {
      schemaVersion: 'football11-room-challenge-v1',
      challengeId: `${room.sessionId.slice(-8)}-r${room.state.roundOrdinal + 1}-${random(6)}`,
      roundOrdinal: room.state.roundOrdinal + 1,
      seed: random(16),
      seedStrategy: 'per-player-v1',
      versions: DEFAULT_MECHANICS_VERSION,
      draftConfig,
      participantUserIds: participants,
      startedAt: now.toISOString(),
      deadlineAt: new Date(now.getTime() + request.roundSeconds! * 1_000).toISOString(),
    };
    const writeOrder = [
      ...participants.filter((userId) => userId !== player.userId),
      player.userId,
    ];
    for (const userId of writeOrder) {
      await gateway.writeActiveDraftChallenge(userId, {
        schemaVersion: 1,
        idempotencyKey: request.idempotencyKey,
        userId,
        roomSessionId: room.sessionId,
        challenge,
      });
    }
    return { schemaVersion: 1, challenge };
  }

  const challenge: IssuedSoloDraftChallengeV1 = {
    schemaVersion: 1,
    kind: 'solo',
    challengeId: `random-${random(8)}`,
    seed: random(16),
    versions: DEFAULT_MECHANICS_VERSION,
    draftConfig,
    issuedAt: now.toISOString(),
  };
  await gateway.writeActiveDraftChallenge(player.userId, {
    schemaVersion: 1,
    idempotencyKey: request.idempotencyKey,
    userId: player.userId,
    challenge,
  });
  return { schemaVersion: 1, challenge };
}

export function parseDraftConfigRecord(value: unknown): DraftConfigSnapshotV1 {
  if (!isRecord(value) || !hasExactKeys(value, ['schemaVersion', 'activeRevision', 'revisions'])) {
    throw configError('AGS returned an unsupported draft configuration shape.');
  }
  if (
    value.schemaVersion !== 1 ||
    typeof value.activeRevision !== 'string' ||
    value.activeRevision.length === 0 ||
    value.activeRevision.length > 64 ||
    !isRecord(value.revisions)
  ) {
    throw configError('AGS returned an unsupported draft configuration version.');
  }
  const selected = value.revisions[value.activeRevision];
  if (!isRecord(selected) || !hasExactKeys(selected, ['maxOfferedPlayers', 'maxRerolls'])) {
    throw configError('The active AGS draft configuration revision is missing or malformed.');
  }
  try {
    const config = validateDraftConfig({
      maxOfferedPlayers: selected.maxOfferedPlayers as number,
      maxRerolls: selected.maxRerolls as number,
    });
    return {
      schemaVersion: 1,
      revision: value.activeRevision,
      ...config,
    };
  } catch {
    throw configError('The active AGS draft configuration is outside supported limits.');
  }
}

export function parseDraftChallengeReceipt(value: unknown): DraftChallengeReceiptV1 {
  if (
    !isRecord(value) ||
    value.schemaVersion !== 1 ||
    typeof value.idempotencyKey !== 'string' ||
    value.idempotencyKey.length === 0 ||
    typeof value.userId !== 'string' ||
    value.userId.length === 0 ||
    (value.roomSessionId !== undefined && typeof value.roomSessionId !== 'string') ||
    !isIssuedChallenge(value.challenge)
  ) {
    throw new TrustedReplayError(
      502,
      'INVALID_DRAFT_CHALLENGE_RECEIPT',
      'The trusted draft challenge receipt is invalid.',
    );
  }
  return value as unknown as DraftChallengeReceiptV1;
}

function parseIssueRequest(value: unknown): IssueDraftChallengeRequestV1 {
  if (!isRecord(value)) {
    throw badRequest('INVALID_CHALLENGE_REQUEST', 'The draft request has an unsupported shape.');
  }
  const roomRequest = 'roomSessionId' in value;
  const expected = roomRequest
    ? ['schemaVersion', 'idempotencyKey', 'roomSessionId', 'roundSeconds']
    : ['schemaVersion', 'idempotencyKey'];
  if (
    !hasExactKeys(value, expected) ||
    value.schemaVersion !== 1 ||
    typeof value.idempotencyKey !== 'string' ||
    !/^[A-Za-z0-9-]{8,96}$/.test(value.idempotencyKey)
  ) {
    throw badRequest('INVALID_CHALLENGE_REQUEST', 'The draft request has an unsupported shape.');
  }
  if (
    roomRequest &&
    (typeof value.roomSessionId !== 'string' ||
      value.roomSessionId.length === 0 ||
      value.roomSessionId.length > 128 ||
      !Number.isInteger(value.roundSeconds) ||
      (value.roundSeconds as number) < 30 ||
      (value.roundSeconds as number) > 3600)
  ) {
    throw badRequest('INVALID_CHALLENGE_REQUEST', 'The room draft request is invalid.');
  }
  return value as unknown as IssueDraftChallengeRequestV1;
}

function assertRoomCanIssue(
  room: DraftChallengeRoomSnapshot,
  player: AuthenticatedPlayer,
  namespace: string,
): void {
  if (
    room.namespace !== namespace ||
    room.configurationName !== 'football11-friend-room-v1' ||
    room.leaderId !== player.userId
  ) {
    throw new TrustedReplayError(
      403,
      'ROOM_CHALLENGE_FORBIDDEN',
      'Only the current leader of a compatible Football 11 room can start a round.',
    );
  }
  if (!canStartFriendRoom(room.state, room.activeMemberUserIds)) {
    throw new TrustedReplayError(
      409,
      'ROOM_NOT_READY',
      'The room does not have an eligible ready participant set.',
    );
  }
}

function eligibleParticipants(state: FriendRoomStateV1, activeUserIds: string[]): string[] {
  const active = [...new Set(activeUserIds)].toSorted();
  if (state.roundOrdinal === 0) return active;
  const ready = new Set(state.readyUserIds);
  return active.filter((userId) => ready.has(userId));
}

function isIssuedChallenge(value: unknown): value is IssuedDraftChallengeV1 {
  if (!isRecord(value) || !isDraftConfigSnapshot(value.draftConfig)) return false;
  if (
    typeof value.challengeId !== 'string' ||
    typeof value.seed !== 'string' ||
    !isRecord(value.versions)
  ) {
    return false;
  }
  if (value.schemaVersion === 1 && value.kind === 'solo') {
    return typeof value.issuedAt === 'string';
  }
  return (
    value.schemaVersion === 'football11-room-challenge-v1' &&
    Number.isInteger(value.roundOrdinal) &&
    Array.isArray(value.participantUserIds) &&
    typeof value.startedAt === 'string' &&
    typeof value.deadlineAt === 'string'
  );
}

function isDraftConfigSnapshot(value: unknown): value is DraftConfigSnapshotV1 {
  if (!isRecord(value) || value.schemaVersion !== 1 || typeof value.revision !== 'string') {
    return false;
  }
  try {
    validateDraftConfig({
      maxOfferedPlayers: value.maxOfferedPlayers as number,
      maxRerolls: value.maxRerolls as number,
    });
    return true;
  } catch {
    return false;
  }
}

function randomHex(bytes: number): string {
  const values = new Uint8Array(bytes);
  globalThis.crypto.getRandomValues(values);
  return [...values].map((value) => value.toString(16).padStart(2, '0')).join('');
}

function hasExactKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  const actual = Object.keys(value).toSorted();
  const expected = [...keys].toSorted();
  return actual.length === expected.length && actual.every((key, index) => key === expected[index]);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function badRequest(code: string, message: string): TrustedReplayError {
  return new TrustedReplayError(400, code, message);
}

function configError(message: string): TrustedReplayError {
  return new TrustedReplayError(503, 'DRAFT_CONFIG_UNAVAILABLE', message);
}
