import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import {
  calculateOutcomeProbabilities,
  seasonLabel,
  simulateSeason,
  type LeagueProfile,
  type TeamUnitRatings,
} from '../src/index.js';

const readJson = (path: string): unknown =>
  JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'));
const league = readJson('../../../data/config/league-profile-v1.json') as LeagueProfile;
const cases = readJson('../../../data/fixtures/phase-00-match-cases-v1.json') as {
  cases: Array<{
    id: string;
    team: TeamUnitRatings;
    opponent: TeamUnitRatings;
    venueBias: number;
    expected: OutcomeVector;
  }>;
};
type OutcomeVector = {
  delta: number;
  winProbability: number;
  drawProbability: number;
  lossProbability: number;
};

describe('season-v1', () => {
  it.each(cases.cases)(
    'reproduces probability vector $id',
    ({ team, opponent, venueBias, expected }) => {
      const actual = calculateOutcomeProbabilities(team, opponent, venueBias, league.outcomeModel);
      expect(actual.delta).toBe(expected.delta);
      expect(actual.winProbability).toBeCloseTo(expected.winProbability, 6);
      expect(actual.drawProbability).toBeCloseTo(expected.drawProbability, 6);
      expect(actual.lossProbability).toBeCloseTo(expected.lossProbability, 6);
      expect(actual.winProbability + actual.drawProbability + actual.lossProbability).toBeCloseTo(
        1,
        12,
      );
    },
  );

  it('returns the same bounded 38-match result for the same inputs', () => {
    const team = { attack: 79.5, defence: 77.25, control: 81.75 };
    const first = simulateSeason(team, league, 'season-golden-v1', 'roster-checksum-v1');
    expect(simulateSeason(team, league, 'season-golden-v1', 'roster-checksum-v1')).toEqual(first);
    expect(first.matches).toHaveLength(38);
    expect(first.wins + first.draws + first.losses).toBe(38);
    expect(first.points).toBe(first.wins * 3 + first.draws);
    expect(first.points).toBeGreaterThanOrEqual(0);
    expect(first.points).toBeLessThanOrEqual(114);
    expect([first.wins, first.draws, first.losses, first.points]).toEqual([21, 4, 13, 67]);
    expect(first.matches.map((match) => match.outcome[0]).join('')).toBe(
      'wwdwllwlwwwwwlwwwwlwwwdlwlwwwllldldwll',
    );
  });

  it('distinguishes Perfect from Invincible', () => {
    expect(seasonLabel(38, 0)).toBe('Perfect');
    expect(seasonLabel(30, 0)).toBe('Invincible');
    expect(seasonLabel(20, 1)).toBeNull();
  });
});
