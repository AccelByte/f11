import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import {
  DEFAULT_MECHANICS_VERSION,
  applyDraftAction,
  buildConstraintProfiles,
  createDraft,
  replayDraft,
  generateOffer,
  buildConstraintProfiles as profilesFor,
  type DraftAction,
  type PlayerCatalogue,
} from '../src/index.js';
import { makePlayerSeason } from '../../test-fixtures/src/index.ts';

const catalogue = JSON.parse(
  readFileSync(
    new URL('../../../data/content/openfootball-pl-2023-24-named-squads-v2.json', import.meta.url),
    'utf8',
  ),
) as PlayerCatalogue;
const players = catalogue.playerSeasons;
const profiles = buildConstraintProfiles(players);

function create(seed = 'draft-state-v1') {
  return createDraft({
    challengeId: `challenge-${seed}`,
    seed,
    versions: DEFAULT_MECHANICS_VERSION,
    players,
    profiles,
  });
}

function firstSelection(snapshot: ReturnType<typeof createDraft>): DraftAction {
  const card = snapshot.offer?.cards[0];
  const slotCode = card?.safeSlotCodes[0];
  if (!card || !slotCode) throw new Error('fixture has no selectable card');
  return {
    type: 'select',
    round: snapshot.state.round,
    playerSeasonId: card.playerSeasonId,
    slotCode,
  };
}

describe('draft state transitions', () => {
  it('pins the golden challenge offer and first-action state hashes', () => {
    const initial = createDraft({
      challengeId: 'golden-challenge-v1',
      seed: 'golden-draft-v1',
      versions: { ...DEFAULT_MECHANICS_VERSION, contentVersion: catalogue.contentVersion },
      players,
      profiles,
    });
    expect(initial.offer?.constraint.key).toBe('brentford::2020s');
    expect(initial.offer?.cards.map((card) => card.playerSeasonId)).toEqual([
      'openfootball-brentford-2023-24-kristoffer-ajer-1998',
      'openfootball-brentford-2023-24-keane-lewis-potter-2001',
      'openfootball-brentford-2023-24-sergio-reguil-n-1996',
      'openfootball-brentford-2023-24-mathias-jensen-1996',
      'openfootball-brentford-2023-24-ethan-brierley-2003',
      'openfootball-brentford-2023-24-frank-onyeka-1998',
      'openfootball-brentford-2023-24-rico-henry-1997',
      'openfootball-brentford-2023-24-mads-roerslev-1999',
      'openfootball-brentford-2023-24-ryan-trevitt-2003',
      'openfootball-brentford-2023-24-josh-dasilva-1998',
      'openfootball-brentford-2023-24-shandon-baptiste-1998',
      'openfootball-brentford-2023-24-yunus-emre-konak-2006',
      'openfootball-brentford-2023-24-val-adedokun-2003',
      'openfootball-brentford-2023-24-ben-mee-1989',
      'openfootball-brentford-2023-24-aaron-hickey-2002',
    ]);
    expect(initial.state.stateHash).toBe('4cca9e7accf8689bc050071bad44999e');
    const next = applyDraftAction(
      initial,
      {
        type: 'select',
        round: 1,
        playerSeasonId: 'openfootball-brentford-2023-24-kristoffer-ajer-1998',
        slotCode: 'LB',
      },
      players,
      profiles,
    );
    expect(next.offer?.constraint.key).toBe('afc-bournemouth::2020s');
    expect(next.offer?.cards.map((card) => card.playerSeasonId)).toEqual([
      'openfootball-afc-bournemouth-2023-24-james-hill-2002',
      'openfootball-afc-bournemouth-2023-24-alex-scott-2003',
      'openfootball-afc-bournemouth-2023-24-marcos-senesi-1997',
      'openfootball-afc-bournemouth-2023-24-tyler-adams-1999',
      'openfootball-afc-bournemouth-2023-24-ryan-christie-1995',
      'openfootball-afc-bournemouth-2023-24-illya-zabarnyi-2002',
      'openfootball-afc-bournemouth-2023-24-michael-dacosta-gonzalez-2005',
      'openfootball-afc-bournemouth-2023-24-max-aarons-2000',
      'openfootball-afc-bournemouth-2023-24-enes-nal-1997',
      'openfootball-afc-bournemouth-2023-24-mark-travers-1999',
      'openfootball-afc-bournemouth-2023-24-dominic-sadi-2003',
      'openfootball-afc-bournemouth-2023-24-max-kinsey-wellings-2005',
      'openfootball-afc-bournemouth-2023-24-justin-kluivert-1999',
      'openfootball-afc-bournemouth-2023-24-romain-faivre-1998',
      'openfootball-afc-bournemouth-2023-24-chris-mepham-1997',
    ]);
    expect(next.state.stateHash).toBe('e2676300153cb63f6f23db12455410b0');
  });

  it('creates the same state, offer, and hash from the same challenge input', () => {
    expect(create()).toEqual(create());
  });

  it('selects only an offered safe placement and cools the two passed cards through round 3', () => {
    const initial = create();
    const action = firstSelection(initial);
    const passedIds = initial.offer?.cards
      .filter((card) => card.playerSeasonId !== action.playerSeasonId)
      .map((card) => card.playerSeasonId);
    const next = applyDraftAction(initial, action, players, profiles);

    expect(next.state.round).toBe(2);
    expect(next.state.roster[action.slotCode]).toBe(action.playerSeasonId);
    expect(next.state.selectedIdentityIds).toHaveLength(1);
    for (const id of passedIds ?? []) {
      expect(next.state.cooldownUntilRoundByPlayerSeasonId[id]).toBe(3);
      expect(next.offer?.cards.some((card) => card.playerSeasonId === id)).toBe(false);
    }
    expect(next.state.stateHash).not.toBe(initial.state.stateHash);
  });

  it('rerolls the team and players without reusing visible cards', () => {
    const initial = create('reroll-state-v1');
    const originalIds = initial.offer?.cards.map((card) => card.playerSeasonId) ?? [];
    const next = applyDraftAction(
      initial,
      { type: 'reroll', round: initial.state.round },
      players,
      profiles,
    );

    expect(next.offer?.constraint).not.toEqual(initial.offer?.constraint);
    expect(next.state.rerollsRemaining).toBe(4);
    expect(next.state.rerollOrdinal).toBe(1);
    expect(next.state.rejectedOfferIdsByRound['1']).toEqual(originalIds.toSorted());
    expect(next.offer?.cards.every((card) => !originalIds.includes(card.playerSeasonId))).toBe(
      true,
    );
    for (const id of originalIds) expect(next.state.cooldownUntilRoundByPlayerSeasonId[id]).toBe(3);
  });

  it('preserves the reroll when no different team is playable', () => {
    const compact = [
      makePlayerSeason('gk', { GK: 70 }),
      makePlayerSeason('lb', { LB: 70 }),
      makePlayerSeason('cb-one', { CB: 70 }),
      makePlayerSeason('cb-two', { CB: 70 }),
      makePlayerSeason('rb', { RB: 70 }),
      makePlayerSeason('dm', { DM: 70 }),
      makePlayerSeason('cm', { CM: 70 }),
      makePlayerSeason('am', { AM: 70 }),
      makePlayerSeason('lw', { LW: 70 }),
      makePlayerSeason('cf', { CF: 70 }),
      makePlayerSeason('rw', { RW: 70 }),
    ];
    const compactProfiles = profilesFor(compact);
    const initial = createDraft({
      challengeId: 'no-alternate-team-v2',
      seed: 'no-alternate-team-v2',
      versions: DEFAULT_MECHANICS_VERSION,
      players: compact,
      profiles: compactProfiles,
    });
    expect(initial.offer?.rerollAvailable).toBe(false);

    expect(() =>
      applyDraftAction(
        initial,
        { type: 'reroll', round: initial.state.round },
        compact,
        compactProfiles,
      ),
    ).toThrowError(expect.objectContaining({ code: 'REROLL_UNAVAILABLE' }));
    expect(initial.state.rerollsRemaining).toBe(5);
    expect(initial.state.rerollOrdinal).toBe(0);
  });

  it('keeps discarded cards out for rounds 2 and 3, then allows them in round 4', () => {
    const compact = ['one', 'two', 'three'].map((id) => makePlayerSeason(id, { GK: 70 }));
    const compactProfiles = profilesFor(compact);
    const cooldown = { [compact[0]?.id ?? '']: 3 };
    const common = {
      seed: 'cooldown-window-v1',
      rerollOrdinal: 0,
      openSlots: ['GK'] as const,
      players: compact,
      profiles: compactProfiles,
      selectedIdentityIds: new Set<string>(),
      cooldownUntilRoundByPlayerSeasonId: cooldown,
    };
    expect(() => generateOffer({ ...common, round: 3 })).toThrowError(
      expect.objectContaining({ code: 'CONTENT_UNSATISFIABLE' }),
    );
    expect(
      generateOffer({ ...common, round: 4 })
        .cards.map((card) => card.playerSeasonId)
        .toSorted(),
    ).toEqual(compact.map((player) => player.id).toSorted());
  });

  it('permits at most five successful rerolls across a run', () => {
    let snapshot = create('five-rerolls-v1');
    let used = 0;
    while (used < 5) {
      if (snapshot.offer?.rerollAvailable) {
        snapshot = applyDraftAction(
          snapshot,
          { type: 'reroll', round: snapshot.state.round },
          players,
          profiles,
        );
        used += 1;
      } else {
        snapshot = applyDraftAction(snapshot, firstSelection(snapshot), players, profiles);
      }
    }
    expect(snapshot.state.rerollsRemaining).toBe(0);
    expect(() =>
      applyDraftAction(
        snapshot,
        { type: 'reroll', round: snapshot.state.round },
        players,
        profiles,
      ),
    ).toThrowError(expect.objectContaining({ code: 'NO_REROLLS' }));
  });

  it('rejects stale, unoffered, and unsafe actions without mutating the snapshot', () => {
    const initial = create('invalid-actions-v1');
    const before = JSON.stringify(initial);
    expect(() =>
      applyDraftAction(initial, { ...firstSelection(initial), round: 99 }, players, profiles),
    ).toThrowError(expect.objectContaining({ code: 'INVALID_ROUND' }));
    expect(() =>
      applyDraftAction(
        initial,
        { type: 'select', round: 1, playerSeasonId: 'not-offered', slotCode: 'GK' },
        players,
        profiles,
      ),
    ).toThrowError(expect.objectContaining({ code: 'PLAYER_NOT_OFFERED' }));
    expect(JSON.stringify(initial)).toBe(before);
  });

  it('completes and replays eleven deterministic first-card selections', () => {
    let snapshot = create('complete-draft-v1');
    const actions: DraftAction[] = [];
    while (snapshot.offer) {
      const action = firstSelection(snapshot);
      actions.push(action);
      snapshot = applyDraftAction(snapshot, action, players, profiles);
    }

    expect(actions).toHaveLength(11);
    expect(Object.keys(snapshot.state.roster)).toHaveLength(11);
    expect(new Set(snapshot.state.selectedIdentityIds).size).toBe(11);
    const replay = replayDraft(
      {
        challengeId: 'challenge-complete-draft-v1',
        seed: 'complete-draft-v1',
        versions: DEFAULT_MECHANICS_VERSION,
        players,
        profiles,
      },
      actions,
      players,
      profiles,
    );
    expect(replay.snapshot).toEqual(snapshot);
    expect(replay.stateHashes).toHaveLength(12);
  });
});
