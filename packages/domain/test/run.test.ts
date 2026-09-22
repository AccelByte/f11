import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import {
  DEFAULT_MECHANICS_VERSION,
  applyDraftAction,
  buildConstraintProfiles,
  createDraft,
  resolveRun,
  type AssessmentConfig,
  type DraftAction,
  type LeagueProfile,
  type PlayerCatalogue,
} from '../src/index.js';

const readJson = (path: string): unknown =>
  JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'));
const catalogue = readJson(
  '../../../data/content/openfootball-pl-2023-24-named-squads-v2.json',
) as PlayerCatalogue;
const assessmentConfig = readJson('../../../data/config/assessment-v1.json') as AssessmentConfig;
const leagueProfile = readJson('../../../data/config/league-profile-v1.json') as LeagueProfile;
const players = catalogue.playerSeasons;
const profiles = buildConstraintProfiles(players);

function completeActions(seed: string): DraftAction[] {
  let snapshot = createDraft({
    challengeId: `challenge-${seed}`,
    seed,
    versions: DEFAULT_MECHANICS_VERSION,
    players,
    profiles,
  });
  const actions: DraftAction[] = [];
  while (snapshot.offer) {
    const card = snapshot.offer.cards[0];
    const slotCode = card?.safeSlotCodes[0];
    if (!card || !slotCode) throw new Error('no legal fixture action');
    const action: DraftAction = {
      type: 'select',
      round: snapshot.state.round,
      playerSeasonId: card.playerSeasonId,
      slotCode,
    };
    actions.push(action);
    snapshot = applyDraftAction(snapshot, action, players, profiles);
  }
  return actions;
}

describe('complete deterministic run', () => {
  it('resolves the same replay into the same assessment, season, and explanation', () => {
    const seed = 'resolved-run-v1';
    const actions = completeActions(seed);
    const input = {
      challengeId: `challenge-${seed}`,
      seed,
      versions: DEFAULT_MECHANICS_VERSION,
      players,
      profiles,
      actions,
      assessmentConfig,
      leagueProfile,
    };
    const first = resolveRun(input, players, profiles);
    const replay = resolveRun(input, players, profiles);
    expect(replay).toEqual(first);
    expect(first.result.roster).toHaveLength(11);
    expect(first.result.season.matches).toHaveLength(38);
    expect(first.stateHashes).toHaveLength(12);
    expect(first.result.explanation.facts.length).toBeGreaterThanOrEqual(2);
  });

  it('rejects incomplete action evidence', () => {
    expect(() =>
      resolveRun(
        {
          challengeId: 'incomplete',
          seed: 'incomplete',
          versions: DEFAULT_MECHANICS_VERSION,
          players,
          profiles,
          actions: [],
          assessmentConfig,
          leagueProfile,
        },
        players,
        profiles,
      ),
    ).toThrowError(expect.objectContaining({ code: 'INCOMPLETE_DRAFT' }));
  });
});
