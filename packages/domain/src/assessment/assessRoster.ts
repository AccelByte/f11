import { DomainError } from '../errors.js';
import { POSITION_BY_SLOT } from '../formation.js';
import { ratingForSlot } from '../formation/eligibility.js';
import type {
  CategoryScores,
  PlayerAttributes,
  PlayerSeason,
  RosterAssessment,
  RosterAssignment,
  SlotCode,
  TacticalAxisResult,
} from '../types.js';

type AttributeKey = keyof PlayerAttributes;

export interface AssessmentConfig {
  version: 'assessment-v1';
  compositeWeights: Record<keyof CategoryScores, number>;
  chemistry: {
    neutralAffinity: number;
    sameCompetitionSeasonAffinity: number;
    sameClubSeasonAffinity: number;
    edges: [SlotCode, SlotCode, number][];
  };
  tacticalAxes: Record<
    string,
    {
      attributes: Partial<Record<AttributeKey, number>>;
      slots: Partial<Record<SlotCode, number>>;
      minimum: number;
      maximum: number | null;
      weight: number;
    }
  >;
  leadership: { highestWeight: number; topThreeMeanWeight: number };
  unitWeights: {
    attack: Record<'attackingSlotRating' | 'chanceCreation' | 'pace' | 'widthSupply', number>;
    defence: Record<
      'defensiveSlotRating' | 'goalkeeping' | 'ballWinning' | 'defensiveCover' | 'aerialPresence',
      number
    >;
    control: Record<
      'midfieldSlotRating' | 'chanceCreation' | 'ballWinning' | 'positioning' | 'chemistry',
      number
    >;
  };
  rounding: { intermediateDecimals: number; resultDecimals: number };
}

function mean(values: readonly number[]): number {
  if (!values.length)
    throw new DomainError('EMPTY_MEAN', 'Cannot calculate the mean of no values.');
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function round(value: number, decimals: number): number {
  const scale = 10 ** decimals;
  return Math.round((value + Number.EPSILON) * scale) / scale;
}

function weighted<Key extends string>(
  values: Record<Key, number>,
  weights: Readonly<Record<Key, number>>,
): number {
  return (Object.keys(weights) as Key[]).reduce((sum, key) => sum + values[key] * weights[key], 0);
}

export function assessRoster(
  assignments: readonly RosterAssignment[],
  players: readonly PlayerSeason[],
  config: AssessmentConfig,
): RosterAssessment {
  if (assignments.length !== 11)
    throw new DomainError('FORMATION_SLOTS_MISMATCH', 'A roster needs 11 assignments.');
  const playerById = new Map(players.map((player) => [player.id, player]));
  const playerBySlot = new Map<SlotCode, PlayerSeason>();
  const identities = new Set<string>();
  const effectiveBySlot = new Map<SlotCode, number>();
  for (const assignment of assignments) {
    if (playerBySlot.has(assignment.slotId))
      throw new DomainError('DUPLICATE_SLOT', 'A slot is assigned twice.');
    if (POSITION_BY_SLOT[assignment.slotId] !== assignment.position) {
      throw new DomainError(
        'SLOT_POSITION_MISMATCH',
        'Assignment position does not match its slot.',
      );
    }
    const player = playerById.get(assignment.playerSeasonId);
    if (!player)
      throw new DomainError('UNKNOWN_PLAYER_SEASON', 'Roster player is missing from content.');
    if (identities.has(player.playerIdentityId)) {
      throw new DomainError('DUPLICATE_PLAYER_IDENTITY', 'A player identity may appear only once.');
    }
    const rating = ratingForSlot(player, assignment.slotId);
    if (rating === null)
      throw new DomainError('ILLEGAL_POSITION', 'Player has no rating for the assigned slot.');
    identities.add(player.playerIdentityId);
    playerBySlot.set(assignment.slotId, player);
    effectiveBySlot.set(assignment.slotId, rating);
  }

  const rosterPlayers = [...playerBySlot.values()];
  const quality = mean(
    rosterPlayers.map((player) => Math.max(...Object.values(player.ratingsByPosition))),
  );
  const positioning = mean(
    [...playerBySlot].map(
      ([slot, player]) =>
        (100 * (effectiveBySlot.get(slot) ?? 0)) /
        Math.max(...Object.values(player.ratingsByPosition)),
    ),
  );
  let affinityTotal = 0;
  let edgeWeightTotal = 0;
  for (const [left, right, weight] of config.chemistry.edges) {
    const leftPlayer = playerBySlot.get(left);
    const rightPlayer = playerBySlot.get(right);
    if (!leftPlayer || !rightPlayer)
      throw new DomainError('FORMATION_SLOTS_MISMATCH', 'Chemistry slot is missing.');
    const affinity =
      leftPlayer.clubCode === rightPlayer.clubCode &&
      leftPlayer.seasonCode === rightPlayer.seasonCode
        ? config.chemistry.sameClubSeasonAffinity
        : leftPlayer.seasonCode === rightPlayer.seasonCode
          ? config.chemistry.sameCompetitionSeasonAffinity
          : config.chemistry.neutralAffinity;
    affinityTotal += affinity * weight;
    edgeWeightTotal += weight;
  }
  const chemistry = affinityTotal / edgeWeightTotal;

  const tacticalAxes: Record<string, TacticalAxisResult> = {};
  for (const [axis, axisConfig] of Object.entries(config.tacticalAxes)) {
    let supplyTotal = 0;
    let slotWeightTotal = 0;
    for (const [slot, slotWeight] of Object.entries(axisConfig.slots)) {
      if (slotWeight === undefined) continue;
      const player = playerBySlot.get(slot as SlotCode);
      if (!player) throw new DomainError('FORMATION_SLOTS_MISMATCH', 'Tactical slot is missing.');
      const attributeValue = Object.entries(axisConfig.attributes).reduce(
        (sum, [attribute, weight]) =>
          sum + player.attributes[attribute as AttributeKey] * (weight ?? 0),
        0,
      );
      supplyTotal += attributeValue * slotWeight;
      slotWeightTotal += slotWeight;
    }
    const supply = supplyTotal / slotWeightTotal;
    const score =
      supply < axisConfig.minimum
        ? (100 * supply) / axisConfig.minimum
        : axisConfig.maximum === null || supply <= axisConfig.maximum
          ? 100
          : Math.max(60, 100 - (40 * (supply - axisConfig.maximum)) / (100 - axisConfig.maximum));
    tacticalAxes[axis] = { supply: round(supply, 2), score: round(score, 2) };
  }
  const tacticalBalance = Object.entries(config.tacticalAxes).reduce(
    (sum, [axis, axisConfig]) => sum + (tacticalAxes[axis]?.score ?? 0) * axisConfig.weight,
    0,
  );
  const leadershipValues = rosterPlayers
    .map((player) => player.leadership)
    .toSorted((a, b) => b - a);
  const leadership =
    config.leadership.highestWeight * (leadershipValues[0] ?? 0) +
    config.leadership.topThreeMeanWeight * mean(leadershipValues.slice(0, 3));
  const rawCategories: CategoryScores = {
    quality,
    positioning,
    chemistry,
    tacticalBalance,
    leadership,
  };
  const categories = Object.fromEntries(
    Object.entries(rawCategories).map(([key, value]) => [
      key,
      round(value, config.rounding.resultDecimals),
    ]),
  ) as unknown as CategoryScores;
  const composite = round(
    weighted(rawCategories, config.compositeWeights),
    config.rounding.resultDecimals,
  );

  const groupMean = (
    slots: readonly SlotCode[],
    selector: (player: PlayerSeason, slot: SlotCode) => number,
  ) => mean(slots.map((slot) => selector(playerBySlot.get(slot)!, slot)));
  const attackSlots = ['AM', 'LW', 'CF', 'RW'] as const;
  const defenceSlots = ['GK', 'LB', 'LCB', 'RCB', 'RB', 'DM'] as const;
  const midfieldSlots = ['DM', 'CM', 'AM'] as const;
  const attackInputs = {
    attackingSlotRating: groupMean(attackSlots, (_player, slot) => effectiveBySlot.get(slot) ?? 0),
    chanceCreation: groupMean(attackSlots, (player) => player.attributes.chanceCreation),
    pace: groupMean(attackSlots, (player) => player.attributes.pace),
    widthSupply: tacticalAxes.width?.supply ?? 0,
  };
  const defenceInputs = {
    defensiveSlotRating: groupMean(defenceSlots, (_player, slot) => effectiveBySlot.get(slot) ?? 0),
    goalkeeping: playerBySlot.get('GK')?.attributes.goalkeeping ?? 0,
    ballWinning: groupMean(defenceSlots, (player) => player.attributes.ballWinning),
    defensiveCover: groupMean(defenceSlots, (player) => player.attributes.defensiveCover),
    aerialPresence: groupMean(defenceSlots, (player) => player.attributes.aerialPresence),
  };
  const controlInputs = {
    midfieldSlotRating: groupMean(midfieldSlots, (_player, slot) => effectiveBySlot.get(slot) ?? 0),
    chanceCreation: groupMean(midfieldSlots, (player) => player.attributes.chanceCreation),
    ballWinning: groupMean(midfieldSlots, (player) => player.attributes.ballWinning),
    positioning,
    chemistry,
  };
  return {
    categories,
    tacticalAxes,
    composite,
    units: {
      attack: round(
        weighted(attackInputs, config.unitWeights.attack),
        config.rounding.resultDecimals,
      ),
      defence: round(
        weighted(defenceInputs, config.unitWeights.defence),
        config.rounding.resultDecimals,
      ),
      control: round(
        weighted(controlInputs, config.unitWeights.control),
        config.rounding.resultDecimals,
      ),
    },
  };
}
