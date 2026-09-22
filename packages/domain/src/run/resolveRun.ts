import { assessRoster, type AssessmentConfig } from '../assessment/assessRoster.js';
import { DomainError } from '../errors.js';
import { buildExplanation } from '../explanation/buildExplanation.js';
import { POSITION_BY_SLOT } from '../formation.js';
import { simulateSeason, type LeagueProfile } from '../simulation/simulateSeason.js';
import { stateHash } from '../stateHash.js';
import { SLOT_CODES, type DraftAction, type PlayerSeason, type RunResult } from '../types.js';
import type { CreateDraftInput } from '../draft/applyAction.js';
import type { ConstraintProfile } from '../draft/constraints.js';
import { replayDraft } from '../draft/replayDraft.js';

export interface ResolveRunInput extends CreateDraftInput {
  actions: readonly DraftAction[];
  assessmentConfig: AssessmentConfig;
  leagueProfile: LeagueProfile;
}

export interface ResolvedRun {
  result: RunResult;
  stateHashes: string[];
}

export function resolveRun(
  input: ResolveRunInput,
  players: readonly PlayerSeason[],
  profiles: readonly ConstraintProfile[],
): ResolvedRun {
  const replay = replayDraft(input, input.actions, players, profiles);
  if (replay.snapshot.offer !== null || Object.keys(replay.snapshot.state.roster).length !== 11) {
    throw new DomainError('INCOMPLETE_DRAFT', 'A result requires eleven completed selections.');
  }
  const roster = SLOT_CODES.map((slotId) => {
    const playerSeasonId = replay.snapshot.state.roster[slotId];
    if (!playerSeasonId)
      throw new DomainError('FORMATION_SLOTS_MISMATCH', `Roster is missing ${slotId}.`);
    return { slotId, position: POSITION_BY_SLOT[slotId], playerSeasonId };
  });
  const assessment = assessRoster(roster, players, input.assessmentConfig);
  const rosterChecksum = stateHash(roster);
  const season = simulateSeason(assessment.units, input.leagueProfile, input.seed, rosterChecksum);
  const explanation = buildExplanation(assessment);
  const finalStateHash = replay.snapshot.state.stateHash;
  return {
    result: {
      resultId: `result-${stateHash({ challengeId: input.challengeId, finalStateHash })}`,
      challengeId: input.challengeId,
      versions: input.versions,
      roster,
      actions: [...input.actions],
      assessment,
      season,
      explanation,
      finalStateHash,
    },
    stateHashes: replay.stateHashes,
  };
}
