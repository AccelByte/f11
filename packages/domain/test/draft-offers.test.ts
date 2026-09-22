import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { makePlayerSeason } from '../../test-fixtures/src/index.ts';
import {
  SLOT_CODES,
  buildConstraintProfiles,
  findCompletionMatching,
  generateOffer,
  safeSlotsAfterSelection,
  type PlayerCatalogue,
  type PlayerSeason,
} from '../src/index.js';

const catalogue = JSON.parse(
  readFileSync(
    new URL('../../../data/content/openfootball-pl-2023-24-named-squads-v2.json', import.meta.url),
    'utf8',
  ),
) as PlayerCatalogue;

describe('formation eligibility and feasibility', () => {
  it('finds a complete deterministic matching for the release catalogue', () => {
    const result = findCompletionMatching({
      openSlots: SLOT_CODES,
      players: catalogue.playerSeasons,
    });
    expect(result.completable).toBe(true);
    expect(Object.keys(result.matchedPlayerIdBySlot).toSorted()).toEqual(SLOT_CODES.toSorted());
  });

  it('rejects a roster when a scarce slot has no remaining eligible identity', () => {
    const goalkeeper = makePlayerSeason('gk', { GK: 80 });
    const striker = makePlayerSeason('cf', { CF: 80 });
    expect(
      findCompletionMatching({ openSlots: ['GK', 'CF'], players: [goalkeeper, striker] })
        .completable,
    ).toBe(true);
    expect(
      findCompletionMatching({
        openSlots: ['GK', 'CF'],
        players: [goalkeeper, striker],
        excludedIdentityIds: new Set([goalkeeper.playerIdentityId]),
      }).completable,
    ).toBe(false);
  });

  it('never uses two seasons of one identity to fill two slots', () => {
    const left = makePlayerSeason('same-left', { LB: 80 }, { playerIdentityId: 'same' });
    const right = makePlayerSeason('same-right', { RB: 80 }, { playerIdentityId: 'same' });
    expect(
      findCompletionMatching({ openSlots: ['LB', 'RB'], players: [left, right] }).completable,
    ).toBe(false);
  });

  it('removes a candidate slot when taking it would strand the roster', () => {
    const flexible = makePlayerSeason('flex', { GK: 80, CF: 75 });
    const goalkeeper = makePlayerSeason('gk', { GK: 70 });
    expect(
      safeSlotsAfterSelection(flexible, ['GK', 'CF'], [flexible, goalkeeper], new Set()),
    ).toEqual(['CF']);
  });
});

describe('club and era offers', () => {
  const profiles = buildConstraintProfiles(catalogue.playerSeasons);
  const baseInput = {
    seed: 'phase-1a-offer-golden',
    round: 1,
    rerollOrdinal: 0,
    openSlots: SLOT_CODES,
    selectedIdentityIds: new Set<string>(),
    cooldownUntilRoundByPlayerSeasonId: {},
  } as const;

  it('builds stable profiles with sorted player IDs', () => {
    expect(profiles).toHaveLength(20);
    expect(profiles.every((profile) => profile.playerSeasonIds.length >= 3)).toBe(true);
    expect(
      profiles.every(
        (profile) =>
          JSON.stringify(profile.playerSeasonIds) ===
          JSON.stringify(profile.playerSeasonIds.toSorted()),
      ),
    ).toBe(true);
  });

  it('returns up to fifteen deterministic forward-safe cards', () => {
    const first = generateOffer({ ...baseInput, players: catalogue.playerSeasons, profiles });
    const replay = generateOffer({
      ...baseInput,
      players: catalogue.playerSeasons.toReversed(),
      profiles: profiles.toReversed(),
    });

    expect(replay).toEqual(first);
    expect(first.cards).toHaveLength(15);
    expect(new Set(first.cards.map((card) => card.playerSeasonId)).size).toBe(15);
    expect(first.cards.every((card) => card.safeSlotCodes.length > 0)).toBe(true);
    expect(
      first.cards.every(
        (card) => Object.keys(card.ratingsBySlot).length === card.safeSlotCodes.length,
      ),
    ).toBe(true);
  });

  it('honors a lower configured offer limit', () => {
    const offer = generateOffer({
      ...baseInput,
      maxOfferedPlayers: 6,
      players: catalogue.playerSeasons,
      profiles,
    });
    expect(offer.cards).toHaveLength(6);
  });

  it('honors selected, cooldown, and same-round rejected exclusions', () => {
    const first = generateOffer({ ...baseInput, players: catalogue.playerSeasons, profiles });
    const offeredPlayers = first.cards.map((card) =>
      catalogue.playerSeasons.find((player) => player.id === card.playerSeasonId),
    );
    const selected = offeredPlayers[0];
    const cooling = offeredPlayers[1];
    const rejected = offeredPlayers[2];
    expect(selected && cooling && rejected).toBeTruthy();

    const next = generateOffer({
      ...baseInput,
      rerollOrdinal: 1,
      players: catalogue.playerSeasons,
      profiles,
      selectedIdentityIds: new Set([selected?.playerIdentityId ?? '']),
      cooldownUntilRoundByPlayerSeasonId: { [cooling?.id ?? '']: 1 },
      rejectedPlayerSeasonIds: new Set([rejected?.id ?? '']),
    });
    const nextIds = new Set(next.cards.map((card) => card.playerSeasonId));
    expect(nextIds.has(selected?.id ?? '')).toBe(false);
    expect(nextIds.has(cooling?.id ?? '')).toBe(false);
    expect(nextIds.has(rejected?.id ?? '')).toBe(false);
  });

  it('moves the previous constraint behind valid alternatives', () => {
    const first = generateOffer({ ...baseInput, players: catalogue.playerSeasons, profiles });
    const next = generateOffer({
      ...baseInput,
      players: catalogue.playerSeasons,
      profiles,
      previousConstraintKey: first.constraint.key,
    });
    expect(next.constraint.key).not.toBe(first.constraint.key);
  });

  it('makes rerolls depend on and select a different playable team', () => {
    const compactPlayers = ['home-one', 'home-two', 'home-three']
      .map((id) => makePlayerSeason(id, { GK: 70 }))
      .concat(
        ['away-one', 'away-two', 'away-three'].map((id) =>
          makePlayerSeason(id, { GK: 70 }, { clubCode: 'away-fc', clubsObserved: ['away-fc'] }),
        ),
      );
    const compactProfiles = buildConstraintProfiles(compactPlayers);
    const common = {
      seed: 'different-team-reroll-v2',
      round: 1,
      openSlots: ['GK'] as const,
      players: compactPlayers,
      profiles: compactProfiles,
      selectedIdentityIds: new Set<string>(),
      cooldownUntilRoundByPlayerSeasonId: {},
    };
    const first = generateOffer({ ...common, rerollOrdinal: 0 });
    expect(first.cards).toHaveLength(3);
    expect(first.rerollAvailable).toBe(true);

    const rerolled = generateOffer({
      ...common,
      rerollOrdinal: 1,
      rejectedPlayerSeasonIds: new Set(first.cards.map((card) => card.playerSeasonId)),
      excludedConstraintKey: first.constraint.key,
    });
    expect(rerolled.constraint.key).not.toBe(first.constraint.key);
    expect(
      rerolled.cards.every((card) =>
        first.cards.every((original) => original.playerSeasonId !== card.playerSeasonId),
      ),
    ).toBe(true);
  });

  it('disables reroll when no different team can provide three safe cards', () => {
    const compactPlayers = ['one', 'two', 'three', 'four'].map((id) =>
      makePlayerSeason(id, { GK: 70 }),
    );
    const offer = generateOffer({
      seed: 'no-alternative-team-v2',
      round: 1,
      rerollOrdinal: 0,
      openSlots: ['GK'],
      players: compactPlayers,
      profiles: buildConstraintProfiles(compactPlayers),
      selectedIdentityIds: new Set(),
      cooldownUntilRoundByPlayerSeasonId: {},
    });
    expect(offer.rerollAvailable).toBe(false);
    expect(offer.rerollUnavailableReason).toBe('INSUFFICIENT_ALTERNATIVE_TEAM_CARDS');
  });
});

describe('offer behavior with compact fixtures', () => {
  it('throws CONTENT_UNSATISFIABLE when no constraint can show three cards', () => {
    const players: PlayerSeason[] = [
      makePlayerSeason('one', { GK: 70 }),
      makePlayerSeason('two', { GK: 71 }),
    ];
    expect(() =>
      generateOffer({
        seed: 'unsat',
        round: 1,
        rerollOrdinal: 0,
        openSlots: ['GK'],
        players,
        profiles: buildConstraintProfiles(players),
        selectedIdentityIds: new Set(),
        cooldownUntilRoundByPlayerSeasonId: {},
      }),
    ).toThrowError(expect.objectContaining({ code: 'CONTENT_UNSATISFIABLE' }));
  });
});
