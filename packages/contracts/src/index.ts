import type {
  DraftAction,
  DraftConfig,
  DraftOffer,
  DraftState,
  FormationId,
  HeadToHeadResult,
  MechanicsVersion,
  RosterAssignment,
  RunResult,
  TeamUnitRatings,
} from '@football-11/domain';

export interface DraftConfigSnapshotV1 extends DraftConfig {
  schemaVersion: 1;
  revision: string;
}

export interface IssueDraftChallengeRequestV1 {
  schemaVersion: 1;
  idempotencyKey: string;
  roomSessionId?: string;
  roundSeconds?: number;
}

export interface IssuedSoloDraftChallengeV1 {
  schemaVersion: 1;
  kind: 'solo';
  challengeId: string;
  seed: string;
  versions: MechanicsVersion;
  draftConfig: DraftConfigSnapshotV1;
  issuedAt: string;
}

export interface DraftChallengeReceiptV1 {
  schemaVersion: 1;
  idempotencyKey: string;
  userId: string;
  roomSessionId?: string;
  challenge: IssuedDraftChallengeV1;
}

export interface ApiError {
  code: string;
  message: string;
  details: Record<string, string | number | boolean | null>;
}

export interface CreateRandomChallengeRequest {
  formationId?: FormationId;
}

export interface ChallengeResponse {
  challengeId: string;
  versions: MechanicsVersion;
  state: DraftState;
  offer: DraftOffer;
}

export interface GetChallengeResponse extends ChallengeResponse {}

export interface SubmitRunRequest {
  challengeId: string;
  actions: DraftAction[];
  idempotencyKey: string;
}

export interface SubmitRunResponse {
  result: RunResult;
}

export interface GetResultResponse {
  result: RunResult;
}

export interface LocalRunRecordV1 {
  schemaVersion: 'football11-local-run-v1';
  runId: string;
  localProfileId: string;
  /** Present when this run came from an AGS friend-room session. */
  roomSessionId?: string;
  seed: string;
  versions: MechanicsVersion;
  draftConfig?: DraftConfigSnapshotV1;
  actions: DraftAction[];
  stateHashes: string[];
  result: RunResult;
  createdAt: string;
  authority: 'player';
  checksum: string;
}

export type FriendRoomPhase =
  | 'WAITING'
  | 'STARTING'
  | 'DRAFTING'
  | 'REVEAL'
  | 'COUNTDOWN'
  | 'TERMINATED';

export type FriendRoomRunStatus =
  | 'NOT_STARTED'
  | 'DRAFTING'
  | 'FINISHED'
  | 'ABANDONED'
  | 'TIMED_OUT';

export type FriendRoomSeedStrategyV1 = 'shared-v1' | 'per-player-v1';

export interface FriendRoomChallengeV1 {
  schemaVersion: 'football11-room-challenge-v1';
  challengeId: string;
  roundOrdinal: number;
  seed: string;
  /** Absent challenges use the legacy shared-v1 behavior. */
  seedStrategy?: FriendRoomSeedStrategyV1;
  versions: MechanicsVersion;
  draftConfig: DraftConfigSnapshotV1;
  participantUserIds: string[];
  startedAt: string;
  deadlineAt: string;
}

export type IssuedDraftChallengeV1 = IssuedSoloDraftChallengeV1 | FriendRoomChallengeV1;

export interface IssueDraftChallengeResponseV1 {
  schemaVersion: 1;
  challenge: IssuedDraftChallengeV1;
}

export interface FriendRoomProgressV1 {
  selectedCount: number;
  status: FriendRoomRunStatus;
  updatedAt: string;
}

export interface FriendRoomResultSummaryV1 {
  challengeId: string;
  userId: string;
  points: number;
  wins: number;
  draws: number;
  losses: number;
  composite: number;
  finalStateHash: string;
  submittedAt: string;
}

/**
 * Compact Football 11 state carried in AGS game-session attributes for the
 * development friend-room integration. Draft actions and offers are never
 * included in this public projection.
 */
export interface FriendRoomStateV1 {
  schemaVersion: 'football11-room-state-v1';
  phase: FriendRoomPhase;
  revision: number;
  roundOrdinal: number;
  readyUserIds: string[];
  challenge: FriendRoomChallengeV1 | null;
  progressByUserId: Record<string, FriendRoomProgressV1>;
  resultByUserId: Record<string, FriendRoomResultSummaryV1>;
  countdownEndsAt: string | null;
  updatedAt: string;
}

export interface FriendRoomComparisonEntryV1 {
  userId: string;
  status: Extract<FriendRoomRunStatus, 'FINISHED' | 'ABANDONED' | 'TIMED_OUT'>;
  result: FriendRoomResultSummaryV1 | null;
  rank: number | null;
}

export interface CloudRunRecordV1 {
  schemaVersion: 'football11-cloud-run-v1';
  runId: string;
  ownerUserId: string;
  /** Present when this run came from an AGS friend-room session. */
  roomSessionId?: string;
  seed: string;
  versions: MechanicsVersion;
  draftConfig?: DraftConfigSnapshotV1;
  actions: DraftAction[];
  stateHashes: string[];
  result: RunResult;
  createdAt: string;
  authority: 'player' | 'trusted';
  checksum: string;
}

export interface TrustedRunSubmissionV1 {
  schemaVersion: 'football11-trusted-submit-v1';
  runId: string;
  challengeId: string;
  /** Lets the trusted service bind a room run to canonical AGS session state. */
  roomSessionId?: string;
  seed: string;
  versions: MechanicsVersion;
  draftConfig: DraftConfigSnapshotV1;
  actions: DraftAction[];
}

export interface TrustedRunReceiptV1 {
  schemaVersion: 'football11-trusted-receipt-v1';
  runId: string;
  resultId: string;
  resultHash: string;
  finalStateHash: string;
  points: number;
  verifiedAt: string;
}

export interface LeaderboardEntryV1 {
  rank: number;
  points: number;
  label: string;
  isCurrentPlayer: boolean;
}

export interface TrustedLeaderboardViewV1 {
  status: 'ranked' | 'unranked' | 'empty' | 'stale';
  bestPoints: number;
  rank: number | null;
  entries: LeaderboardEntryV1[];
}

export interface TrustedRunSubmissionResponseV1 {
  result: RunResult;
  receipt: TrustedRunReceiptV1;
  duplicate: boolean;
  leaderboard: TrustedLeaderboardViewV1;
}

export interface SavedXiRecordV1 {
  schemaVersion: 'football11-saved-xi-v1';
  savedXiId: string;
  ownerUserId: string;
  sourceRunId: string;
  sourceResultId: string;
  formationId: FormationId;
  roster: RosterAssignment[];
  units: TeamUnitRatings;
  versions: MechanicsVersion;
  headToHeadVersion: 'head-to-head-v1';
  seasonPoints: number;
  publishedAt: string;
}

export interface SavedXiViewV1 {
  savedXiId: string;
  sourceResultId: string;
  roster: RosterAssignment[];
  units: TeamUnitRatings;
  versions: MechanicsVersion;
  seasonPoints: number;
  publishedAt: string;
}

export interface PublishSavedXiResponseV1 {
  savedXi: SavedXiViewV1;
  replaced: boolean;
}

export interface IssuedSavedXiChallengeV1 {
  schemaVersion: 'football11-saved-xi-challenge-v1';
  matchId: string;
  token: string;
  challengerUserId: string;
  challengerXi: SavedXiRecordV1;
  opponentXi: SavedXiRecordV1;
  opponentLabel: string;
  opponentRank: number;
  matchSeed: string;
  issuedAt: string;
  expiresAt: string;
  consumedAt: string | null;
}

export interface SavedXiChallengePreviewV1 {
  matchId: string;
  token: string;
  opponentLabel: string;
  opponentRank: number;
  opponentXi: SavedXiViewV1;
  expiresAt: string;
}

export interface AsyncMatchRecordV1 {
  schemaVersion: 'football11-async-match-v1';
  matchId: string;
  challengerUserId: string;
  challengerXiId: string;
  opponentUserId: string;
  opponentXiId: string;
  opponentLabel: string;
  opponentRank: number;
  result: HeadToHeadResult;
  scoreBefore: number;
  scoreAfter: number;
  settlementStatus: 'pending' | 'settled';
  createdAt: string;
  settledAt: string | null;
}

export interface AsyncMatchViewV1 {
  matchId: string;
  challengerXiId: string;
  opponentXiId: string;
  opponentLabel: string;
  opponentRank: number;
  result: Omit<HeadToHeadResult, 'evidence'>;
  scoreBefore: number;
  scoreAfter: number;
  settlementStatus: 'pending' | 'settled';
  createdAt: string;
  settledAt: string | null;
}

export interface AsyncMatchHistoryV1 {
  schemaVersion: 'football11-async-history-v1';
  matches: AsyncMatchRecordV1[];
}

export interface SavedXiCompetitionStatusV1 {
  savedXi: SavedXiViewV1 | null;
  challengeScore: number;
  activeChallenge: SavedXiChallengePreviewV1 | null;
  history: AsyncMatchViewV1[];
}

export interface ResolveSavedXiChallengeRequestV1 {
  schemaVersion: 'football11-resolve-saved-xi-challenge-v1';
  token: string;
}

export interface ResolveSavedXiChallengeResponseV1 {
  match: AsyncMatchViewV1;
  duplicate: boolean;
}

export type ApiResponse<T> = { ok: true; data: T } | { ok: false; error: ApiError };
