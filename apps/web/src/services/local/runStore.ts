import type { CloudRunRecordV1, LocalRunRecordV1 } from '@football-11/contracts';
import {
  DEFAULT_DRAFT_CONFIG,
  DEFAULT_MECHANICS_VERSION,
  resolveRun,
  stateHash,
  validateDraftConfig,
} from '@football-11/domain';

import { assessmentConfig, constraintProfiles, leagueProfile, players } from '../../game/content';
import type { GameSession } from '../../game/session';

export const CLOUD_RUN_RECORD_KEY = 'football11_latest_run_v1';
export const CLOUD_SAVE_RECOMMENDED_MAX_BYTES = 250 * 1024;

type UnsignedLocalRun = Omit<LocalRunRecordV1, 'checksum'>;
type UnsignedCloudRun = Omit<CloudRunRecordV1, 'checksum'>;

export type CloudRunSaveResult = { status: 'saved' | 'already-saved'; record: CloudRunRecordV1 };

export interface CloudRunGateway {
  readLatest(ownerUserId: string): Promise<unknown>;
  writeLatest(ownerUserId: string, record: CloudRunRecordV1): Promise<void>;
}

function checksumFor(record: UnsignedLocalRun): string {
  return stateHash(record);
}

function cloudChecksumFor(record: UnsignedCloudRun): string {
  return stateHash(record);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function createLocalRunRecord(
  profileId: string,
  session: GameSession,
  createdAt = new Date().toISOString(),
  roomSessionId?: string,
): LocalRunRecordV1 {
  const resolved = session.resolved;
  if (!resolved) throw new Error('Cannot save an incomplete Football 11 run.');
  const unsigned = {
    schemaVersion: 'football11-local-run-v1',
    runId: resolved.result.resultId,
    localProfileId: profileId,
    ...(roomSessionId ? { roomSessionId } : {}),
    seed: session.seed,
    versions: resolved.result.versions,
    draftConfig: session.draftConfig,
    actions: [...session.actions],
    stateHashes: [...resolved.stateHashes],
    result: resolved.result,
    createdAt,
    authority: 'player',
  } as const satisfies UnsignedLocalRun;
  return { ...unsigned, checksum: checksumFor(unsigned) };
}

export function createCloudRunRecord(
  ownerUserId: string,
  local: LocalRunRecordV1,
): CloudRunRecordV1 {
  if (local.localProfileId !== ownerUserId) {
    throw new Error('The local run belongs to a different authenticated player.');
  }
  const unsigned = {
    schemaVersion: 'football11-cloud-run-v1',
    runId: local.runId,
    ownerUserId,
    ...(local.roomSessionId ? { roomSessionId: local.roomSessionId } : {}),
    seed: local.seed,
    versions: local.versions,
    ...(local.draftConfig ? { draftConfig: local.draftConfig } : {}),
    actions: [...local.actions],
    stateHashes: [...local.stateHashes],
    result: local.result,
    createdAt: local.createdAt,
    authority: 'player',
  } as const satisfies UnsignedCloudRun;
  return { ...unsigned, checksum: cloudChecksumFor(unsigned) };
}

export function verifyCloudRunRecord(
  value: unknown,
  expectedOwnerUserId: string,
): CloudRunRecordV1 {
  if (!isCloudRunRecord(value)) {
    throw new Error('The Cloud Save run has an unsupported shape.');
  }
  if (value.ownerUserId !== expectedOwnerUserId) {
    throw new Error('The Cloud Save run belongs to a different authenticated player.');
  }

  const { checksum, ...unsigned } = value;
  if (cloudChecksumFor(unsigned) !== checksum) {
    throw new Error('The Cloud Save run checksum does not match.');
  }
  if (stateHash(value.versions) !== stateHash(DEFAULT_MECHANICS_VERSION)) {
    throw new Error('The Cloud Save run uses an unsupported mechanics or content version.');
  }

  const replay = resolveRun(
    {
      challengeId: value.result.challengeId,
      seed: value.seed,
      versions: value.versions,
      players,
      profiles: constraintProfiles,
      actions: value.actions,
      assessmentConfig,
      leagueProfile,
      draftConfig: value.draftConfig ?? DEFAULT_DRAFT_CONFIG,
    },
    players,
    constraintProfiles,
  );
  if (
    stateHash(replay.result) !== stateHash(value.result) ||
    stateHash(replay.stateHashes) !== stateHash(value.stateHashes)
  ) {
    throw new Error('The Cloud Save run does not reproduce its saved result and state hashes.');
  }
  return value;
}

export function createLocalRunRecordFromCloud(record: CloudRunRecordV1): LocalRunRecordV1 {
  const unsigned = {
    schemaVersion: 'football11-local-run-v1',
    runId: record.runId,
    localProfileId: record.ownerUserId,
    ...(record.roomSessionId ? { roomSessionId: record.roomSessionId } : {}),
    seed: record.seed,
    versions: record.versions,
    ...(record.draftConfig ? { draftConfig: record.draftConfig } : {}),
    actions: [...record.actions],
    stateHashes: [...record.stateHashes],
    result: record.result,
    createdAt: record.createdAt,
    authority: 'player',
  } as const satisfies UnsignedLocalRun;
  return { ...unsigned, checksum: checksumFor(unsigned) };
}

export async function saveLatestCloudRun(
  gateway: CloudRunGateway,
  ownerUserId: string,
  local: LocalRunRecordV1,
): Promise<CloudRunSaveResult> {
  const candidate = createCloudRunRecord(ownerUserId, local);
  const payloadBytes = new TextEncoder().encode(JSON.stringify(candidate)).byteLength;
  if (payloadBytes > CLOUD_SAVE_RECOMMENDED_MAX_BYTES) {
    throw new Error('The replayable run exceeds the recommended Cloud Save payload size.');
  }

  const currentValue = await gateway.readLatest(ownerUserId);
  if (currentValue !== null) {
    try {
      const current = verifyCloudRunRecord(currentValue, ownerUserId);
      if (current.checksum === candidate.checksum) {
        return { status: 'already-saved', record: current };
      }
    } catch {
      // A valid current run can repair an obsolete or damaged latest slot.
    }
  }

  await gateway.writeLatest(ownerUserId, candidate);
  const readbackValue = await gateway.readLatest(ownerUserId);
  if (readbackValue === null) throw new Error('Cloud Save write readback returned no record.');
  const readback = verifyCloudRunRecord(readbackValue, ownerUserId);
  if (readback.checksum !== candidate.checksum) {
    throw new Error('Cloud Save write readback did not match the uploaded run.');
  }
  return { status: 'saved', record: readback };
}

export async function restoreLatestCloudRun(
  gateway: CloudRunGateway,
  ownerUserId: string,
): Promise<LocalRunRecordV1 | null> {
  const value = await gateway.readLatest(ownerUserId);
  if (value === null) return null;
  return createLocalRunRecordFromCloud(verifyCloudRunRecord(value, ownerUserId));
}

function isCloudRunRecord(value: unknown): value is CloudRunRecordV1 {
  if (!isRecord(value)) return false;
  return (
    value.schemaVersion === 'football11-cloud-run-v1' &&
    typeof value.runId === 'string' &&
    typeof value.ownerUserId === 'string' &&
    (value.roomSessionId === undefined ||
      (typeof value.roomSessionId === 'string' && value.roomSessionId.length > 0)) &&
    typeof value.seed === 'string' &&
    typeof value.createdAt === 'string' &&
    (value.authority === 'player' || value.authority === 'trusted') &&
    typeof value.checksum === 'string' &&
    Array.isArray(value.actions) &&
    Array.isArray(value.stateHashes) &&
    isRecord(value.versions) &&
    (value.draftConfig === undefined || isDraftConfigSnapshot(value.draftConfig)) &&
    isRecord(value.result) &&
    typeof value.result.challengeId === 'string'
  );
}

function isDraftConfigSnapshot(value: unknown): boolean {
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
