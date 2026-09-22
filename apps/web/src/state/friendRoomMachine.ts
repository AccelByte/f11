import type {
  FriendRoomChallengeV1,
  FriendRoomComparisonEntryV1,
  FriendRoomProgressV1,
  FriendRoomResultSummaryV1,
  FriendRoomRunStatus,
  FriendRoomStateV1,
} from '@football-11/contracts';

export const FRIEND_ROOM_ATTRIBUTE_KEY = 'football11Room';

const TERMINAL_STATUSES = new Set<FriendRoomRunStatus>(['FINISHED', 'ABANDONED', 'TIMED_OUT']);

export class FriendRoomStateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FriendRoomStateError';
  }
}

function unique(values: readonly string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}

function nextRevision(state: FriendRoomStateV1, updatedAt: string): FriendRoomStateV1 {
  return { ...state, revision: state.revision + 1, updatedAt };
}

export function createInitialFriendRoomState(updatedAt: string): FriendRoomStateV1 {
  return {
    schemaVersion: 'football11-room-state-v1',
    phase: 'WAITING',
    revision: 0,
    roundOrdinal: 0,
    readyUserIds: [],
    challenge: null,
    progressByUserId: {},
    resultByUserId: {},
    countdownEndsAt: null,
    updatedAt,
  };
}

export function readFriendRoomState(
  attributes: Record<string, unknown> | null | undefined,
): FriendRoomStateV1 {
  const value = attributes?.[FRIEND_ROOM_ATTRIBUTE_KEY];
  if (!value || typeof value !== 'object') {
    throw new FriendRoomStateError('The AGS session has no Football 11 room state.');
  }
  const candidate = value as Partial<FriendRoomStateV1>;
  if (
    candidate.schemaVersion !== 'football11-room-state-v1' ||
    !candidate.phase ||
    !Number.isInteger(candidate.revision) ||
    !Number.isInteger(candidate.roundOrdinal) ||
    !Array.isArray(candidate.readyUserIds) ||
    !candidate.progressByUserId ||
    !candidate.resultByUserId ||
    typeof candidate.updatedAt !== 'string'
  ) {
    throw new FriendRoomStateError('The AGS session contains incompatible Football 11 state.');
  }
  const challenge = candidate.challenge as { seedStrategy?: unknown } | null | undefined;
  if (
    challenge &&
    challenge.seedStrategy !== undefined &&
    challenge.seedStrategy !== 'shared-v1' &&
    challenge.seedStrategy !== 'per-player-v1'
  ) {
    throw new FriendRoomStateError('The AGS session uses an unsupported room seed strategy.');
  }
  return candidate as FriendRoomStateV1;
}

export function writeFriendRoomState(
  attributes: Record<string, unknown> | null | undefined,
  state: FriendRoomStateV1,
): Record<string, unknown> {
  return { ...attributes, [FRIEND_ROOM_ATTRIBUTE_KEY]: state };
}

export function setMemberReady(
  state: FriendRoomStateV1,
  userId: string,
  ready: boolean,
  updatedAt: string,
): FriendRoomStateV1 {
  if (!['WAITING', 'REVEAL', 'COUNTDOWN'].includes(state.phase)) {
    throw new FriendRoomStateError('Readiness cannot change during an active draft.');
  }
  const current = new Set(state.readyUserIds);
  if (ready) current.add(userId);
  else current.delete(userId);
  return nextRevision({ ...state, readyUserIds: [...current].toSorted() }, updatedAt);
}

export function canStartFriendRoom(
  state: FriendRoomStateV1,
  activeUserIds: readonly string[],
): boolean {
  if (!['WAITING', 'REVEAL', 'COUNTDOWN'].includes(state.phase)) return false;
  const active = unique(activeUserIds);
  const ready = new Set(state.readyUserIds);
  if (state.roundOrdinal === 0) return active.length > 0 && active.every((id) => ready.has(id));
  return active.some((id) => ready.has(id));
}

export function startFriendRoomRound(
  state: FriendRoomStateV1,
  activeUserIds: readonly string[],
  challenge: FriendRoomChallengeV1,
  updatedAt: string,
): FriendRoomStateV1 {
  if (!canStartFriendRoom(state, activeUserIds)) {
    throw new FriendRoomStateError('The room does not have an eligible ready participant set.');
  }
  if (challenge.roundOrdinal !== state.roundOrdinal + 1) {
    throw new FriendRoomStateError('The challenge ordinal does not follow the room ordinal.');
  }
  const active = new Set(activeUserIds);
  const participants =
    state.roundOrdinal === 0
      ? unique(activeUserIds)
      : unique(state.readyUserIds.filter((id) => active.has(id)));
  if (
    participants.length === 0 ||
    participants.some((id) => !challenge.participantUserIds.includes(id)) ||
    challenge.participantUserIds.some((id) => !participants.includes(id))
  ) {
    throw new FriendRoomStateError('The challenge participant lock is inconsistent.');
  }
  const progressByUserId = Object.fromEntries(
    participants.map((id) => [
      id,
      { selectedCount: 0, status: 'NOT_STARTED', updatedAt } satisfies FriendRoomProgressV1,
    ]),
  );
  return nextRevision(
    {
      ...state,
      phase: 'STARTING',
      roundOrdinal: challenge.roundOrdinal,
      readyUserIds: [],
      challenge,
      progressByUserId,
      resultByUserId: {},
      countdownEndsAt: null,
    },
    updatedAt,
  );
}

export function beginFriendRoomDraft(
  state: FriendRoomStateV1,
  updatedAt: string,
): FriendRoomStateV1 {
  if (state.phase !== 'STARTING' || !state.challenge) {
    throw new FriendRoomStateError('Only a starting room can begin drafting.');
  }
  return nextRevision({ ...state, phase: 'DRAFTING' }, updatedAt);
}

export function updateFriendRoomProgress(
  state: FriendRoomStateV1,
  userId: string,
  selectedCount: number,
  status: Extract<FriendRoomRunStatus, 'DRAFTING' | 'FINISHED'>,
  result: FriendRoomResultSummaryV1 | null,
  updatedAt: string,
): FriendRoomStateV1 {
  if (state.phase !== 'DRAFTING' || !state.challenge) {
    throw new FriendRoomStateError('Progress belongs to an active room draft.');
  }
  const previous = state.progressByUserId[userId];
  if (!previous) throw new FriendRoomStateError('Only locked participants can submit progress.');
  if (TERMINAL_STATUSES.has(previous.status)) return state;
  if (
    !Number.isInteger(selectedCount) ||
    selectedCount < previous.selectedCount ||
    selectedCount > 11
  ) {
    throw new FriendRoomStateError('Draft progress must be monotonic from zero to eleven.');
  }
  if (status === 'FINISHED' && (selectedCount !== 11 || !result)) {
    throw new FriendRoomStateError('A finished participant needs an eleven-player result.');
  }
  if (result && (result.challengeId !== state.challenge.challengeId || result.userId !== userId)) {
    throw new FriendRoomStateError('The submitted result does not match the active challenge.');
  }
  return nextRevision(
    {
      ...state,
      progressByUserId: {
        ...state.progressByUserId,
        [userId]: { selectedCount, status, updatedAt },
      },
      resultByUserId: result ? { ...state.resultByUserId, [userId]: result } : state.resultByUserId,
    },
    updatedAt,
  );
}

export function abandonFriendRoomParticipant(
  state: FriendRoomStateV1,
  userId: string,
  updatedAt: string,
): FriendRoomStateV1 {
  if (state.phase !== 'DRAFTING') return state;
  const previous = state.progressByUserId[userId];
  if (!previous || TERMINAL_STATUSES.has(previous.status)) return state;
  return nextRevision(
    {
      ...state,
      progressByUserId: {
        ...state.progressByUserId,
        [userId]: { ...previous, status: 'ABANDONED', updatedAt },
      },
    },
    updatedAt,
  );
}

export function shouldRevealFriendRoom(state: FriendRoomStateV1, now: string): boolean {
  if (state.phase !== 'DRAFTING' || !state.challenge) return false;
  return (
    Object.values(state.progressByUserId).every((progress) =>
      TERMINAL_STATUSES.has(progress.status),
    ) || Date.parse(now) >= Date.parse(state.challenge.deadlineAt)
  );
}

export function revealFriendRoom(
  state: FriendRoomStateV1,
  now: string,
  countdownSeconds: number,
): FriendRoomStateV1 {
  if (!shouldRevealFriendRoom(state, now)) {
    throw new FriendRoomStateError('The active room round is not ready to reveal.');
  }
  const deadlinePassed = state.challenge
    ? Date.parse(now) >= Date.parse(state.challenge.deadlineAt)
    : false;
  const progressByUserId = Object.fromEntries(
    Object.entries(state.progressByUserId).map(([id, progress]) => [
      id,
      !TERMINAL_STATUSES.has(progress.status) && deadlinePassed
        ? { ...progress, status: 'TIMED_OUT' as const, updatedAt: now }
        : progress,
    ]),
  );
  return nextRevision(
    {
      ...state,
      phase: 'REVEAL',
      readyUserIds: Object.entries(progressByUserId)
        .filter(([, progress]) => progress.status === 'FINISHED')
        .map(([id]) => id)
        .toSorted(),
      progressByUserId,
      countdownEndsAt: new Date(Date.parse(now) + countdownSeconds * 1_000).toISOString(),
    },
    now,
  );
}

export function beginFriendRoomCountdown(
  state: FriendRoomStateV1,
  updatedAt: string,
): FriendRoomStateV1 {
  if (state.phase !== 'REVEAL' || !state.countdownEndsAt) {
    throw new FriendRoomStateError('Only a revealed room can enter countdown.');
  }
  return nextRevision({ ...state, phase: 'COUNTDOWN' }, updatedAt);
}

export function isFriendRoomCountdownDue(state: FriendRoomStateV1, now: string): boolean {
  return (
    state.phase === 'COUNTDOWN' &&
    Boolean(state.countdownEndsAt) &&
    Date.parse(now) >= Date.parse(state.countdownEndsAt!)
  );
}

export function friendRoomComparison(state: FriendRoomStateV1): FriendRoomComparisonEntryV1[] {
  const entries = Object.entries(state.progressByUserId).map(([userId, progress]) => ({
    userId,
    status: (TERMINAL_STATUSES.has(progress.status) ? progress.status : 'TIMED_OUT') as
      | 'FINISHED'
      | 'ABANDONED'
      | 'TIMED_OUT',
    result: state.resultByUserId[userId] ?? null,
    rank: null as number | null,
  }));
  const sortedEntries = entries.toSorted((left, right) => {
    if (!left.result && !right.result) return left.userId.localeCompare(right.userId);
    if (!left.result) return 1;
    if (!right.result) return -1;
    return (
      right.result.points - left.result.points ||
      right.result.wins - left.result.wins ||
      right.result.composite - left.result.composite ||
      left.userId.localeCompare(right.userId)
    );
  });
  let previous: FriendRoomComparisonEntryV1 | null = null;
  sortedEntries.forEach((entry, index) => {
    if (!entry.result) return;
    const tied =
      previous?.result &&
      previous.result.points === entry.result.points &&
      previous.result.wins === entry.result.wins &&
      previous.result.composite === entry.result.composite;
    entry.rank = tied ? previous!.rank : index + 1;
    previous = entry;
  });
  return sortedEntries;
}
