import type { DraftAction, PlayerSeason } from '../types.js';
import type { CreateDraftInput, DraftSnapshot } from './applyAction.js';
import { applyDraftAction, createDraft } from './applyAction.js';
import type { ConstraintProfile } from './constraints.js';

export interface DraftReplay {
  snapshot: DraftSnapshot;
  stateHashes: string[];
}

export function replayDraft(
  input: CreateDraftInput,
  actions: readonly DraftAction[],
  players: readonly PlayerSeason[],
  profiles: readonly ConstraintProfile[],
): DraftReplay {
  let snapshot = createDraft(input);
  const stateHashes = [snapshot.state.stateHash];
  for (const action of actions) {
    snapshot = applyDraftAction(snapshot, action, players, profiles);
    stateHashes.push(snapshot.state.stateHash);
  }
  return { snapshot, stateHashes };
}
