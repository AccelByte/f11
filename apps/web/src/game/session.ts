import {
  applyDraftAction,
  createDraft,
  deriveSeed,
  resolveRun,
  stateHash,
  type DraftAction,
  type DraftSnapshot,
  type ResolvedRun,
  type SlotCode,
} from '@football-11/domain';
import type {
  DraftConfigSnapshotV1,
  FriendRoomChallengeV1,
  IssuedSoloDraftChallengeV1,
} from '@football-11/contracts';

import { assessmentConfig, constraintProfiles, leagueProfile, players } from './content';
export interface GameSession {
  challengeId: string;
  seed: string;
  draftConfig: DraftConfigSnapshotV1;
  snapshot: DraftSnapshot;
  actions: DraftAction[];
  resolved: ResolvedRun | null;
}

export function createGameSession(input: IssuedSoloDraftChallengeV1): GameSession {
  return {
    challengeId: input.challengeId,
    seed: input.seed,
    draftConfig: input.draftConfig,
    snapshot: createDraft({
      challengeId: input.challengeId,
      seed: input.seed,
      versions: input.versions,
      players,
      profiles: constraintProfiles,
      draftConfig: input.draftConfig,
    }),
    actions: [],
    resolved: null,
  };
}

type FriendRoomGameChallenge = Pick<
  FriendRoomChallengeV1,
  'challengeId' | 'seed' | 'seedStrategy' | 'versions' | 'draftConfig'
>;

export function deriveFriendRoomPlayerSeed(
  input: Pick<FriendRoomChallengeV1, 'challengeId' | 'seed' | 'seedStrategy'>,
  playerUserId: string,
): string {
  const userId = playerUserId.trim();
  if (!userId) throw new Error('A room challenge requires an authenticated player ID.');
  if (input.seedStrategy === undefined || input.seedStrategy === 'shared-v1') return input.seed;
  if (input.seedStrategy !== 'per-player-v1') {
    throw new Error('The room challenge uses an unsupported seed strategy.');
  }
  return stateHash(deriveSeed(input.seed, 'room-player-v1', input.challengeId, userId));
}

export function createGameSessionFromChallenge(
  input: FriendRoomGameChallenge,
  playerUserId: string,
): GameSession {
  if (!input.challengeId.trim() || !input.seed.trim()) {
    throw new Error('A room challenge requires a challenge ID and seed.');
  }
  const playerSeed = deriveFriendRoomPlayerSeed(input, playerUserId);
  return {
    challengeId: input.challengeId,
    seed: playerSeed,
    draftConfig: input.draftConfig,
    snapshot: createDraft({
      challengeId: input.challengeId,
      seed: playerSeed,
      versions: input.versions,
      players,
      profiles: constraintProfiles,
      draftConfig: input.draftConfig,
    }),
    actions: [],
    resolved: null,
  };
}

function resolveIfComplete(session: GameSession, actions: DraftAction[], snapshot: DraftSnapshot) {
  if (snapshot.offer !== null) return null;
  return resolveRun(
    {
      challengeId: session.challengeId,
      seed: session.seed,
      versions: session.snapshot.state.versions,
      players,
      profiles: constraintProfiles,
      actions,
      assessmentConfig,
      leagueProfile,
      draftConfig: session.draftConfig,
    },
    players,
    constraintProfiles,
  );
}

export function selectPlayer(
  session: GameSession,
  playerSeasonId: string,
  slotCode: SlotCode,
): GameSession {
  const action = {
    type: 'select',
    round: session.snapshot.state.round,
    playerSeasonId,
    slotCode,
  } as const satisfies DraftAction;
  const actions = [...session.actions, action];
  const snapshot = applyDraftAction(session.snapshot, action, players, constraintProfiles);
  return { ...session, actions, snapshot, resolved: resolveIfComplete(session, actions, snapshot) };
}

export function rerollOffer(session: GameSession): GameSession {
  const action = {
    type: 'reroll',
    round: session.snapshot.state.round,
  } as const satisfies DraftAction;
  const actions = [...session.actions, action];
  const snapshot = applyDraftAction(session.snapshot, action, players, constraintProfiles);
  return { ...session, actions, snapshot, resolved: null };
}
