import type {
  DraftChallengeReceiptV1,
  DraftConfigSnapshotV1,
  FriendRoomChallengeV1,
  IssuedDraftChallengeV1,
  TrustedLeaderboardViewV1,
  TrustedRunReceiptV1,
  TrustedRunSubmissionResponseV1,
  TrustedRunSubmissionV1,
} from '@football-11/contracts';
import {
  DEFAULT_MECHANICS_VERSION,
  MAX_DRAFT_REROLLS,
  SLOT_CODES,
  resolveRun,
  stateHash,
  validateDraftConfig,
  type DraftAction,
  type MechanicsVersion,
  type RunResult,
} from '@football-11/domain';

import { assessmentConfig, constraintProfiles, leagueProfile, players } from '../game/content';
import { deriveFriendRoomPlayerSeed } from '../game/session';
import { parseDraftChallengeReceipt } from './draftChallenges';

export const TRUSTED_SUBMISSION_MAX_BYTES = 64 * 1024;
export const TRUSTED_SETTLEMENT_RECORD_KEY = 'football11_trusted_settlement_v1';
export const TRUSTED_POINTS_STAT_CODE = 'football11bestpoints';
export const TRUSTED_LEADERBOARD_CODE = 'football11-best-points';
const MAX_ACTIONS = 11 + MAX_DRAFT_REROLLS;

export interface AuthenticatedPlayer {
  userId: string;
  namespace: string;
}

export interface TrustedRoomSnapshot {
  sessionId: string;
  namespace: string;
  configurationName: string;
  activeMemberUserIds: string[];
  challenge: FriendRoomChallengeV1;
}

export interface TrustedReplayGateway {
  authenticatePlayer: (accessToken: string) => Promise<AuthenticatedPlayer>;
  readRoom: (sessionId: string, accessToken: string) => Promise<TrustedRoomSnapshot>;
  readActiveDraftChallenge: (userId: string) => Promise<unknown>;
  readReceipt: (userId: string) => Promise<unknown>;
  settleBestPoints: (
    userId: string,
    points: number,
    receipt: TrustedRunReceiptV1,
  ) => Promise<number>;
  writeReceipt: (userId: string, receipt: TrustedRunReceiptV1) => Promise<void>;
  readLeaderboard: (
    userId: string,
    expectedBestPoints: number,
    accessToken: string,
  ) => Promise<TrustedLeaderboardViewV1>;
}

export class TrustedReplayError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'TrustedReplayError';
  }
}

export function parseTrustedSubmission(value: unknown): TrustedRunSubmissionV1 {
  if (
    !isRecord(value) ||
    (!hasExactKeys(value, submissionKeys) && !hasExactKeys(value, roomSubmissionKeys))
  ) {
    throw badRequest('INVALID_SUBMISSION', 'The ranked-run submission has an unsupported shape.');
  }
  if (value.schemaVersion !== 'football11-trusted-submit-v1') {
    throw badRequest('UNSUPPORTED_SCHEMA', 'This ranked-run submission version is not supported.');
  }
  const runId = boundedString(value.runId, 'runId', 96);
  const challengeId = boundedString(value.challengeId, 'challengeId', 128);
  const roomSessionId =
    'roomSessionId' in value ? boundedString(value.roomSessionId, 'roomSessionId', 128) : undefined;
  const seed = boundedString(value.seed, 'seed', 128);
  const versions = parseVersions(value.versions);
  const draftConfig = parseDraftConfigSnapshot(value.draftConfig);
  if (
    !Array.isArray(value.actions) ||
    value.actions.length < 11 ||
    value.actions.length > MAX_ACTIONS
  ) {
    throw badRequest(
      'INVALID_ACTIONS',
      `A ranked run must contain eleven selections and at most ${MAX_DRAFT_REROLLS} rerolls.`,
    );
  }
  const actions = value.actions.map(parseAction);
  if (actions.filter((action) => action.type === 'select').length !== 11) {
    throw badRequest(
      'INVALID_ACTIONS',
      'A ranked run must contain exactly eleven player selections.',
    );
  }
  if (actions.filter((action) => action.type === 'reroll').length > draftConfig.maxRerolls) {
    throw badRequest(
      'INVALID_ACTIONS',
      `A ranked run can contain at most ${draftConfig.maxRerolls} rerolls.`,
    );
  }
  return {
    schemaVersion: 'football11-trusted-submit-v1',
    runId,
    challengeId,
    ...(roomSessionId ? { roomSessionId } : {}),
    seed,
    versions,
    draftConfig,
    actions,
  };
}

export async function settleTrustedRun(
  input: unknown,
  accessToken: string,
  gateway: TrustedReplayGateway,
  options: { namespace: string; now?: () => Date },
): Promise<TrustedRunSubmissionResponseV1> {
  if (!accessToken) {
    throw new TrustedReplayError(401, 'MISSING_SESSION', 'Sign in to verify and rank this run.');
  }

  const submission = parseTrustedSubmission(input);
  assertSupportedVersions(submission.versions);

  const player = await gateway.authenticatePlayer(accessToken);
  if (!player.userId || player.namespace !== options.namespace) {
    throw new TrustedReplayError(
      403,
      'WRONG_NAMESPACE',
      'The player session does not belong to this Football 11 namespace.',
    );
  }

  const issued = assertIssuedChallenge(
    parseDraftChallengeReceipt(await gateway.readActiveDraftChallenge(player.userId)),
    submission,
    player.userId,
  );

  const replaySeed = submission.roomSessionId
    ? await resolveRoomReplaySeed(
        submission,
        submission.roomSessionId,
        player,
        accessToken,
        gateway,
        options.namespace,
      )
    : issued.seed;
  const result = replaySubmission(submission, replaySeed, issued.draftConfig);

  const resultHash = stateHash(result);
  const existing = await gateway.readReceipt(player.userId);
  const previous = existing === null ? null : parseTrustedReceipt(existing);
  if (previous?.runId === submission.runId) {
    if (previous.resultHash !== resultHash) {
      throw new TrustedReplayError(
        409,
        'SETTLEMENT_CONFLICT',
        'This run identifier already belongs to a different trusted result.',
      );
    }
    return {
      result,
      receipt: previous,
      duplicate: true,
      leaderboard: await gateway.readLeaderboard(player.userId, previous.points, accessToken),
    };
  }

  const receipt: TrustedRunReceiptV1 = {
    schemaVersion: 'football11-trusted-receipt-v1',
    runId: submission.runId,
    resultId: result.resultId,
    resultHash,
    finalStateHash: result.finalStateHash,
    points: result.season.points,
    verifiedAt: (options.now ?? (() => new Date()))().toISOString(),
  };

  const bestPoints = await gateway.settleBestPoints(player.userId, receipt.points, receipt);
  await gateway.writeReceipt(player.userId, receipt);
  return {
    result,
    receipt,
    duplicate: false,
    leaderboard: await gateway.readLeaderboard(player.userId, bestPoints, accessToken),
  };
}

export function replayTrustedSubmission(input: unknown): {
  submission: TrustedRunSubmissionV1;
  result: RunResult;
} {
  const submission = parseTrustedSubmission(input);
  assertSupportedVersions(submission.versions);
  return {
    submission,
    result: replaySubmission(submission, submission.seed, submission.draftConfig),
  };
}

function replaySubmission(
  submission: TrustedRunSubmissionV1,
  seed: string,
  draftConfig: DraftConfigSnapshotV1,
): RunResult {
  let replay;
  try {
    replay = resolveRun(
      {
        challengeId: submission.challengeId,
        seed,
        versions: DEFAULT_MECHANICS_VERSION,
        players,
        profiles: constraintProfiles,
        actions: submission.actions,
        assessmentConfig,
        leagueProfile,
        draftConfig,
      },
      players,
      constraintProfiles,
    );
  } catch {
    throw badRequest(
      'REPLAY_REJECTED',
      'The submitted actions do not reproduce a complete legal Football 11 run.',
    );
  }
  if (replay.result.resultId !== submission.runId) {
    throw badRequest('RUN_ID_MISMATCH', 'The run identifier does not match the trusted replay.');
  }
  return replay.result;
}

async function resolveRoomReplaySeed(
  submission: TrustedRunSubmissionV1,
  roomSessionId: string,
  player: AuthenticatedPlayer,
  accessToken: string,
  gateway: TrustedReplayGateway,
  expectedNamespace: string,
): Promise<string> {
  const room = await gateway.readRoom(roomSessionId, accessToken);
  if (
    room.sessionId !== roomSessionId ||
    room.namespace !== expectedNamespace ||
    room.configurationName !== 'football11-friend-room-v1'
  ) {
    throw new TrustedReplayError(
      403,
      'ROOM_SCOPE_MISMATCH',
      'The ranked run does not belong to a compatible Football 11 room.',
    );
  }
  if (
    !room.activeMemberUserIds.includes(player.userId) ||
    !room.challenge.participantUserIds.includes(player.userId)
  ) {
    throw new TrustedReplayError(
      403,
      'ROOM_MEMBERSHIP_MISMATCH',
      'The authenticated player is not a locked participant in this room round.',
    );
  }
  if (room.challenge.challengeId !== submission.challengeId) {
    throw badRequest(
      'ROOM_CHALLENGE_MISMATCH',
      'The submitted challenge is not the active challenge in this AGS room.',
    );
  }
  if (stateHash(room.challenge.versions) !== stateHash(submission.versions)) {
    throw badRequest(
      'ROOM_VERSION_MISMATCH',
      'The submitted version bundle does not match the AGS room challenge.',
    );
  }
  if (stateHash(room.challenge.draftConfig) !== stateHash(submission.draftConfig)) {
    throw badRequest(
      'ROOM_CONFIG_MISMATCH',
      'The submitted draft configuration does not match the AGS room challenge.',
    );
  }

  let expectedSeed: string;
  try {
    expectedSeed = deriveFriendRoomPlayerSeed(room.challenge, player.userId);
  } catch {
    throw badRequest(
      'UNSUPPORTED_ROOM_SEED_STRATEGY',
      'This room uses a seed strategy that the trusted service does not support.',
    );
  }
  if (submission.seed !== expectedSeed) {
    throw badRequest(
      'ROOM_SEED_MISMATCH',
      'The submitted seed does not match the authenticated player and AGS room challenge.',
    );
  }
  return expectedSeed;
}

function assertSupportedVersions(versions: MechanicsVersion): void {
  if (stateHash(versions) !== stateHash(DEFAULT_MECHANICS_VERSION)) {
    throw badRequest(
      'UNSUPPORTED_VERSION',
      'This run uses a mechanics or content version that is not accepted for ranking.',
    );
  }
}

function parseVersions(value: unknown): MechanicsVersion {
  if (!isRecord(value) || !hasExactKeys(value, versionKeys)) {
    throw badRequest('INVALID_VERSIONS', 'The ranked run has an invalid version bundle.');
  }
  for (const key of versionKeys) {
    if (typeof value[key] !== 'string' || value[key].length === 0 || value[key].length > 128) {
      throw badRequest('INVALID_VERSIONS', 'The ranked run has an invalid version bundle.');
    }
  }
  return value as unknown as MechanicsVersion;
}

function parseDraftConfigSnapshot(value: unknown): DraftConfigSnapshotV1 {
  if (
    !isRecord(value) ||
    !hasExactKeys(value, draftConfigKeys) ||
    value.schemaVersion !== 1 ||
    typeof value.revision !== 'string' ||
    value.revision.length === 0 ||
    value.revision.length > 64
  ) {
    throw badRequest('INVALID_DRAFT_CONFIG', 'The ranked run has invalid draft configuration.');
  }
  try {
    return {
      schemaVersion: 1,
      revision: value.revision,
      ...validateDraftConfig({
        maxOfferedPlayers: value.maxOfferedPlayers as number,
        maxRerolls: value.maxRerolls as number,
      }),
    };
  } catch {
    throw badRequest('INVALID_DRAFT_CONFIG', 'The ranked run has invalid draft configuration.');
  }
}

function assertIssuedChallenge(
  receipt: DraftChallengeReceiptV1,
  submission: TrustedRunSubmissionV1,
  userId: string,
): IssuedDraftChallengeV1 {
  const challenge = receipt.challenge;
  const isRoom = challenge.schemaVersion === 'football11-room-challenge-v1';
  if (
    receipt.userId !== userId ||
    receipt.roomSessionId !== submission.roomSessionId ||
    challenge.challengeId !== submission.challengeId ||
    stateHash(challenge.versions) !== stateHash(submission.versions) ||
    stateHash(challenge.draftConfig) !== stateHash(submission.draftConfig) ||
    Boolean(submission.roomSessionId) !== isRoom ||
    (!isRoom && challenge.seed !== submission.seed)
  ) {
    throw new TrustedReplayError(
      409,
      'DRAFT_CHALLENGE_MISMATCH',
      'The submitted run does not match the active server-issued draft challenge.',
    );
  }
  return challenge;
}

function parseAction(value: unknown, index: number): DraftAction {
  if (!isRecord(value) || (value.type !== 'select' && value.type !== 'reroll')) {
    throw badRequest('INVALID_ACTION', `Action ${index + 1} has an unsupported shape.`);
  }
  if (
    !Number.isInteger(value.round) ||
    (value.round as number) < 1 ||
    (value.round as number) > 11
  ) {
    throw badRequest('INVALID_ACTION', `Action ${index + 1} has an invalid round.`);
  }
  if (value.type === 'reroll') {
    if (!hasExactKeys(value, rerollKeys)) {
      throw badRequest('INVALID_ACTION', `Action ${index + 1} has an unsupported shape.`);
    }
    return { type: 'reroll', round: value.round as number };
  }
  if (!hasExactKeys(value, selectKeys)) {
    throw badRequest('INVALID_ACTION', `Action ${index + 1} has an unsupported shape.`);
  }
  const playerSeasonId = boundedString(value.playerSeasonId, 'playerSeasonId', 160);
  if (
    typeof value.slotCode !== 'string' ||
    !SLOT_CODES.includes(value.slotCode as (typeof SLOT_CODES)[number])
  ) {
    throw badRequest('INVALID_ACTION', `Action ${index + 1} has an invalid formation slot.`);
  }
  return {
    type: 'select',
    round: value.round as number,
    playerSeasonId,
    slotCode: value.slotCode as (typeof SLOT_CODES)[number],
  };
}

export function parseTrustedReceipt(value: unknown): TrustedRunReceiptV1 {
  if (
    !isRecord(value) ||
    value.schemaVersion !== 'football11-trusted-receipt-v1' ||
    typeof value.runId !== 'string' ||
    typeof value.resultId !== 'string' ||
    typeof value.resultHash !== 'string' ||
    typeof value.finalStateHash !== 'string' ||
    typeof value.points !== 'number' ||
    !Number.isFinite(value.points) ||
    typeof value.verifiedAt !== 'string'
  ) {
    throw new TrustedReplayError(
      502,
      'INVALID_SETTLEMENT_RECEIPT',
      'The trusted settlement receipt could not be verified.',
    );
  }
  return value as unknown as TrustedRunReceiptV1;
}

function boundedString(value: unknown, field: string, maximum: number): string {
  if (typeof value !== 'string' || value.length === 0 || value.length > maximum) {
    throw badRequest('INVALID_SUBMISSION', `The ${field} field is invalid.`);
  }
  return value;
}

function hasExactKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  const actual = Object.keys(value).toSorted();
  const expected = keys.toSorted();
  return actual.length === expected.length && actual.every((key, index) => key === expected[index]);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function badRequest(code: string, message: string): TrustedReplayError {
  return new TrustedReplayError(400, code, message);
}

const submissionKeys = [
  'schemaVersion',
  'runId',
  'challengeId',
  'seed',
  'versions',
  'draftConfig',
  'actions',
] as const;
const roomSubmissionKeys = [...submissionKeys, 'roomSessionId'] as const;
const versionKeys = [
  'contentVersion',
  'rulesVersion',
  'rngVersion',
  'offerVersion',
  'assessmentVersion',
  'seasonVersion',
  'explanationVersion',
] as const;
const draftConfigKeys = ['schemaVersion', 'revision', 'maxOfferedPlayers', 'maxRerolls'] as const;
const rerollKeys = ['type', 'round'] as const;
const selectKeys = ['type', 'round', 'playerSeasonId', 'slotCode'] as const;
