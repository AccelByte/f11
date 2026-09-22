import {
  applyDraftAction,
  createDraft,
  resolveRun,
  DEFAULT_DRAFT_CONFIG,
  DEFAULT_MECHANICS_VERSION,
  type DraftAction,
  type DraftSnapshot,
  type ResolvedRun,
  type SlotCode,
  type DraftConfig,
} from '@football-11/domain';
import { assessmentConfig, constraintProfiles, leagueProfile, players } from './content';

export interface GameSession {
  challengeId: string;
  seed: string;
  draftConfig: DraftConfig;
  snapshot: DraftSnapshot;
  actions: DraftAction[];
  resolved: ResolvedRun | null;
}

/** Local deterministic starting point; online challenge issuance is a later tutorial stage. */
export function createGameSession(seed: string): GameSession {
  if (!seed.trim()) throw new Error('A draft seed is required.');
  const challengeId = `local-${seed}`;
  const draftConfig = { ...DEFAULT_DRAFT_CONFIG };
  return {
    challengeId,
    seed,
    draftConfig,
    snapshot: createDraft({
      challengeId,
      seed,
      versions: DEFAULT_MECHANICS_VERSION,
      players,
      profiles: constraintProfiles,
      draftConfig,
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
