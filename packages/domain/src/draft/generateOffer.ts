import { DomainError } from '../errors.js';
import { safeSlotsAfterSelection } from '../formation/feasibility.js';
import { ratingForSlot } from '../formation/eligibility.js';
import { createDerivedRandomSource } from '../random/seed.js';
import type { DraftOffer, DraftOfferCard, PlayerSeason, SlotCode } from '../types.js';
import type { ConstraintProfile } from './constraints.js';
import { DEFAULT_DRAFT_CONFIG, MIN_OFFERED_PLAYERS, validateDraftConfig } from './config.js';

export interface GenerateOfferInput {
  seed: string;
  round: number;
  rerollOrdinal: number;
  openSlots: readonly SlotCode[];
  players: readonly PlayerSeason[];
  profiles: readonly ConstraintProfile[];
  selectedIdentityIds: ReadonlySet<string>;
  cooldownUntilRoundByPlayerSeasonId: Readonly<Record<string, number>>;
  rejectedPlayerSeasonIds?: ReadonlySet<string>;
  previousConstraintKey?: string;
  excludedConstraintKey?: string;
  rerollsRemaining?: number;
  maxOfferedPlayers?: number;
}

function createCard(player: PlayerSeason, safeSlotCodes: SlotCode[]): DraftOfferCard {
  return {
    playerSeasonId: player.id,
    playerIdentityId: player.playerIdentityId,
    safeSlotCodes,
    ratingsBySlot: Object.fromEntries(
      safeSlotCodes.map((slot) => [slot, ratingForSlot(player, slot)]),
    ),
  };
}

export function generateOffer(input: GenerateOfferInput): DraftOffer {
  const config = validateDraftConfig({
    maxOfferedPlayers: input.maxOfferedPlayers ?? DEFAULT_DRAFT_CONFIG.maxOfferedPlayers,
    maxRerolls: input.rerollsRemaining ?? DEFAULT_DRAFT_CONFIG.maxRerolls,
  });
  const playerById = new Map(input.players.map((player) => [player.id, player]));
  const constraintRandom = createDerivedRandomSource(input.seed, input.round, 'constraint');
  const shuffledProfiles = constraintRandom.shuffle(
    input.profiles
      .filter((profile) => profile.key !== input.excludedConstraintKey)
      .toSorted((left, right) => left.key.localeCompare(right.key)),
  );
  const orderedProfiles = input.previousConstraintKey
    ? [
        ...shuffledProfiles.filter((profile) => profile.key !== input.previousConstraintKey),
        ...shuffledProfiles.filter((profile) => profile.key === input.previousConstraintKey),
      ]
    : shuffledProfiles;
  const rejectedIds = input.rejectedPlayerSeasonIds ?? new Set<string>();

  const cardsForProfile = (
    profile: ConstraintProfile,
    excludedIds: ReadonlySet<string>,
  ): DraftOfferCard[] =>
    profile.playerSeasonIds.flatMap((id): DraftOfferCard[] => {
      const player = playerById.get(id);
      if (
        player === undefined ||
        input.selectedIdentityIds.has(player.playerIdentityId) ||
        excludedIds.has(player.id) ||
        (input.cooldownUntilRoundByPlayerSeasonId[player.id] ?? 0) >= input.round
      ) {
        return [];
      }
      const safeSlotCodes = safeSlotsAfterSelection(
        player,
        input.openSlots,
        input.players,
        input.selectedIdentityIds,
      );
      return safeSlotCodes.length ? [createCard(player, safeSlotCodes)] : [];
    });

  for (const profile of orderedProfiles) {
    const cards = cardsForProfile(profile, rejectedIds);

    if (cards.length < MIN_OFFERED_PLAYERS) continue;
    const offerRandom = createDerivedRandomSource(
      input.seed,
      input.round,
      input.rerollOrdinal,
      profile.key,
      'offer',
    );
    const selectedCards = offerRandom.shuffle(cards).slice(0, config.maxOfferedPlayers);
    const rerollRejectedIds = new Set([
      ...rejectedIds,
      ...selectedCards.map((card) => card.playerSeasonId),
    ]);
    const rerollAvailable =
      config.maxRerolls > 0 &&
      input.profiles.some(
        (candidateProfile) =>
          candidateProfile.key !== profile.key &&
          cardsForProfile(candidateProfile, rerollRejectedIds).length >= MIN_OFFERED_PLAYERS,
      );
    return {
      round: input.round,
      rerollOrdinal: input.rerollOrdinal,
      constraint: { key: profile.key, clubCode: profile.clubCode, eraCode: profile.eraCode },
      cards: selectedCards,
      rerollAvailable,
      rerollUnavailableReason: rerollAvailable
        ? null
        : config.maxRerolls <= 0
          ? 'NO_REROLLS_REMAINING'
          : 'INSUFFICIENT_ALTERNATIVE_TEAM_CARDS',
      diagnostics: [],
    };
  }

  throw new DomainError(
    'CONTENT_UNSATISFIABLE',
    `No club/era constraint can produce ${MIN_OFFERED_PLAYERS} forward-safe cards.`,
    { round: input.round, openSlotCount: input.openSlots.length },
  );
}
