import { POSITION_CODES, type PlayerSeason, type PositionCode } from '../types.js';

export interface ConstraintProfile {
  key: string;
  clubCode: string;
  eraCode: string;
  playerSeasonIds: string[];
  positionCoverage: Partial<Record<PositionCode, number>>;
}

export function buildConstraintProfiles(players: readonly PlayerSeason[]): ConstraintProfile[] {
  const grouped = new Map<string, PlayerSeason[]>();
  for (const player of players) {
    const key = `${player.clubCode}::${player.eraCode}`;
    const group = grouped.get(key) ?? [];
    group.push(player);
    grouped.set(key, group);
  }

  return [...grouped.entries()]
    .toSorted(([left], [right]) => left.localeCompare(right))
    .map(([key, group]) => {
      const positionCoverage: Partial<Record<PositionCode, number>> = {};
      for (const player of group) {
        for (const position of POSITION_CODES) {
          if (player.ratingsByPosition[position] === undefined) continue;
          positionCoverage[position] = (positionCoverage[position] ?? 0) + 1;
        }
      }
      return {
        key,
        clubCode: group[0]?.clubCode ?? '',
        eraCode: group[0]?.eraCode ?? '',
        playerSeasonIds: group.map((player) => player.id).toSorted(),
        positionCoverage,
      };
    });
}
