import { DomainError } from '../errors.js';
import { createDerivedRandomSource } from '../random/seed.js';
import type { TeamUnitRatings } from '../types.js';

export type HeadToHeadOutcome = 'win' | 'draw' | 'loss';

export interface HeadToHeadProfile {
  version: 'head-to-head-v1';
  weights: {
    attackDefenceDuel: number;
    control: number;
  };
  outcomeModel: {
    deltaScale: number;
    drawBase: number;
    drawDeltaScale: number;
  };
  challengeScore: {
    initial: number;
    minimum: number;
    win: number;
    draw: number;
    loss: number;
  };
}

export interface HeadToHeadParticipant {
  savedXiId: string;
  units: TeamUnitRatings;
}

export interface HeadToHeadProbabilities {
  delta: number;
  winProbability: number;
  drawProbability: number;
  lossProbability: number;
}

export interface HeadToHeadResult {
  version: HeadToHeadProfile['version'];
  challengerSavedXiId: string;
  opponentSavedXiId: string;
  outcome: HeadToHeadOutcome;
  challengeScoreDelta: number;
  probabilities: HeadToHeadProbabilities;
  evidence: {
    matchSeed: string;
    canonicalSavedXiIds: [string, string];
    canonicalRoll: number;
  };
}

export function calculateHeadToHeadProbabilities(
  challenger: TeamUnitRatings,
  opponent: TeamUnitRatings,
  profile: HeadToHeadProfile,
): HeadToHeadProbabilities {
  validateProfile(profile);
  validateUnits(challenger);
  validateUnits(opponent);

  const attackingEdge = challenger.attack - opponent.defence;
  const defendingEdge = challenger.defence - opponent.attack;
  const controlEdge = challenger.control - opponent.control;
  const delta =
    profile.weights.attackDefenceDuel * (attackingEdge + defendingEdge) +
    profile.weights.control * controlEdge;
  const winWeight = Math.exp(delta / profile.outcomeModel.deltaScale);
  const lossWeight = Math.exp(-delta / profile.outcomeModel.deltaScale);
  const drawWeight = Math.exp(
    profile.outcomeModel.drawBase - Math.abs(delta) / profile.outcomeModel.drawDeltaScale,
  );
  const total = winWeight + drawWeight + lossWeight;

  return {
    delta,
    winProbability: winWeight / total,
    drawProbability: drawWeight / total,
    lossProbability: lossWeight / total,
  };
}

export function simulateHeadToHead(
  challenger: HeadToHeadParticipant,
  opponent: HeadToHeadParticipant,
  profile: HeadToHeadProfile,
  matchSeed: string,
): HeadToHeadResult {
  if (!challenger.savedXiId.trim() || !opponent.savedXiId.trim()) {
    throw new DomainError('INVALID_SAVED_XI_ID', 'A head-to-head participant needs a Saved-XI ID.');
  }
  if (challenger.savedXiId === opponent.savedXiId) {
    throw new DomainError('SAME_SAVED_XI', 'A Saved XI cannot challenge itself.');
  }
  if (!matchSeed.trim()) {
    throw new DomainError('INVALID_MATCH_SEED', 'A head-to-head match needs a trusted seed.');
  }

  const canonical = [challenger, opponent].toSorted((left, right) =>
    left.savedXiId < right.savedXiId ? -1 : left.savedXiId > right.savedXiId ? 1 : 0,
  );
  const canonicalFirst = canonical[0];
  const canonicalSecond = canonical[1];
  if (!canonicalFirst || !canonicalSecond) {
    throw new DomainError('INVALID_PARTICIPANTS', 'A head-to-head match needs two participants.');
  }
  const canonicalProbabilities = calculateHeadToHeadProbabilities(
    canonicalFirst.units,
    canonicalSecond.units,
    profile,
  );
  const canonicalRoll = createDerivedRandomSource(
    matchSeed,
    'head-to-head',
    profile.version,
    canonicalFirst.savedXiId,
    canonicalSecond.savedXiId,
    'match',
  ).nextFloat();
  const canonicalOutcome = sampleOutcome(canonicalRoll, canonicalProbabilities);
  const challengerIsCanonicalFirst = challenger.savedXiId === canonicalFirst.savedXiId;
  const outcome = challengerIsCanonicalFirst ? canonicalOutcome : invertOutcome(canonicalOutcome);
  const probabilities = challengerIsCanonicalFirst
    ? canonicalProbabilities
    : invertProbabilities(canonicalProbabilities);

  return {
    version: profile.version,
    challengerSavedXiId: challenger.savedXiId,
    opponentSavedXiId: opponent.savedXiId,
    outcome,
    challengeScoreDelta: challengeScoreDelta(outcome, profile),
    probabilities,
    evidence: {
      matchSeed,
      canonicalSavedXiIds: [canonicalFirst.savedXiId, canonicalSecond.savedXiId],
      canonicalRoll,
    },
  };
}

export function challengeScoreDelta(
  outcome: HeadToHeadOutcome,
  profile: HeadToHeadProfile,
): number {
  validateProfile(profile);
  return profile.challengeScore[outcome];
}

export function applyChallengeScore(
  current: number,
  outcome: HeadToHeadOutcome,
  profile: HeadToHeadProfile,
): number {
  if (!Number.isFinite(current)) {
    throw new DomainError('INVALID_CHALLENGE_SCORE', 'Challenge Score must be finite.');
  }
  return Math.max(profile.challengeScore.minimum, current + challengeScoreDelta(outcome, profile));
}

function sampleOutcome(roll: number, probabilities: HeadToHeadProbabilities): HeadToHeadOutcome {
  if (roll < probabilities.winProbability) return 'win';
  if (roll < probabilities.winProbability + probabilities.drawProbability) return 'draw';
  return 'loss';
}

function invertOutcome(outcome: HeadToHeadOutcome): HeadToHeadOutcome {
  return outcome === 'win' ? 'loss' : outcome === 'loss' ? 'win' : 'draw';
}

function invertProbabilities(probabilities: HeadToHeadProbabilities): HeadToHeadProbabilities {
  return {
    delta: -probabilities.delta,
    winProbability: probabilities.lossProbability,
    drawProbability: probabilities.drawProbability,
    lossProbability: probabilities.winProbability,
  };
}

function validateUnits(units: TeamUnitRatings): void {
  if (![units.attack, units.defence, units.control].every(Number.isFinite)) {
    throw new DomainError('INVALID_TEAM_UNITS', 'Head-to-head unit ratings must be finite.');
  }
}

function validateProfile(profile: HeadToHeadProfile): void {
  const totalWeight = 2 * profile.weights.attackDefenceDuel + profile.weights.control;
  if (
    profile.weights.attackDefenceDuel < 0 ||
    profile.weights.control < 0 ||
    Math.abs(totalWeight - 1) > 1e-12
  ) {
    throw new DomainError(
      'INVALID_HEAD_TO_HEAD_WEIGHTS',
      'Head-to-head weights must be non-negative and total one symmetrically.',
    );
  }
  if (profile.outcomeModel.deltaScale <= 0 || profile.outcomeModel.drawDeltaScale <= 0) {
    throw new DomainError(
      'INVALID_HEAD_TO_HEAD_MODEL',
      'Head-to-head probability scales must be positive.',
    );
  }
  if (
    !Object.values(profile.challengeScore).every(Number.isFinite) ||
    profile.challengeScore.initial < profile.challengeScore.minimum
  ) {
    throw new DomainError(
      'INVALID_CHALLENGE_SCORE_CONFIG',
      'Challenge Score values must be finite and start at or above the minimum.',
    );
  }
}
