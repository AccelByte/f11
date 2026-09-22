import type { PlayerSeason, PositionCode } from '@football-11/domain';

export function makePlayerSeason(
  id: string,
  ratingsByPosition: Partial<Record<PositionCode, number>>,
  overrides: Partial<PlayerSeason> = {},
): PlayerSeason {
  return {
    id,
    playerIdentityId: `identity-${id}`,
    sourcePlayerId: 1,
    displayName: `Player ${id}`,
    nickname: null,
    country: null,
    clubCode: 'fixture-fc',
    clubsObserved: ['fixture-fc'],
    seasonCode: 'fixture-season',
    eraCode: 'fixture-era',
    ratingsByPosition,
    observedStatsBombPositions: { Fixture: 1 },
    attributes: {
      aerialPresence: 50,
      ballWinning: 50,
      chanceCreation: 50,
      defensiveCover: 50,
      goalkeeping: 50,
      leadership: 50,
      pace: 50,
    },
    tacticalTraits: {},
    leadership: 50,
    squadSheetCount: 1,
    observedAppearanceCount: 1,
    observedStartCount: 1,
    dataVersion: 'fixture-v1',
    ratingProvenance: {
      kind: 'synthetic',
      generatorVersion: 'fixture-v1',
      seed: 'fixture-seed',
      officialRating: false,
    },
    ...overrides,
  };
}
