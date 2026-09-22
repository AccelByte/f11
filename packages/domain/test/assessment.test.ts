import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import {
  assessRoster,
  type AssessmentConfig,
  type PlayerCatalogue,
  type RosterAssignment,
  type RosterAssessment,
} from '../src/index.js';

const readJson = (path: string): unknown =>
  JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'));
const catalogue = readJson(
  '../../../data/content/openfootball-pl-2023-24-named-squads-v2.json',
) as PlayerCatalogue;
const config = readJson('../../../data/config/assessment-v1.json') as AssessmentConfig;
const fixtures = readJson('../../../data/fixtures/phase-00-golden-rosters-v1.json') as {
  validRosters: Array<{
    id: string;
    assignments: RosterAssignment[];
    expectedAssessment: Pick<RosterAssessment, 'categories' | 'tacticalAxes' | 'composite'>;
  }>;
  invalidRosters: Array<{ id: string; assignments: RosterAssignment[] }>;
};

describe('assessment-v1', () => {
  it.each(fixtures.validRosters)('reproduces the $id Phase 0 vector', (fixture) => {
    const assessment = assessRoster(fixture.assignments, catalogue.playerSeasons, config);
    expect({
      categories: assessment.categories,
      tacticalAxes: assessment.tacticalAxes,
      composite: assessment.composite,
    }).toEqual(fixture.expectedAssessment);
    const expectedUnits = {
      'elite-balanced': { attack: 84.28, defence: 82.28, control: 79.99 },
      'star-heavy-mispositioned': { attack: 73.37, defence: 74.08, control: 67.26 },
      'single-club-coherent': { attack: 75.81, defence: 80.4, control: 77.84 },
    };
    expect(assessment.units).toEqual(expectedUnits[fixture.id as keyof typeof expectedUnits]);
  });

  it('rejects duplicate player identities', () => {
    const duplicate = fixtures.invalidRosters.find(
      (fixture) => fixture.id === 'duplicate-identity',
    );
    expect(duplicate).toBeDefined();
    expect(() =>
      assessRoster(duplicate?.assignments ?? [], catalogue.playerSeasons, config),
    ).toThrowError(expect.objectContaining({ code: 'DUPLICATE_PLAYER_IDENTITY' }));
  });

  it('does not grant same-club-season chemistry across different seasons', () => {
    const coherent = fixtures.validRosters.find((fixture) => fixture.id === 'single-club-coherent');
    expect(coherent).toBeDefined();
    const baseline = assessRoster(coherent?.assignments ?? [], catalogue.playerSeasons, config);
    const changedId = coherent?.assignments.find(
      (assignment) => assignment.slotId === 'AM',
    )?.playerSeasonId;
    const mixedSeasonPlayers = catalogue.playerSeasons.map((player) =>
      player.id === changedId ? { ...player, seasonCode: 'different-season' } : player,
    );
    const mixed = assessRoster(coherent?.assignments ?? [], mixedSeasonPlayers, config);
    expect(baseline.categories.chemistry).toBe(82);
    expect(mixed.categories.chemistry).toBeLessThan(baseline.categories.chemistry);
  });
});
