import { DomainError } from '../errors.js';
import { SLOT_CODES } from '../types.js';
import { stateHash } from '../stateHash.js';
import type {
  DraftAction,
  DraftOffer,
  DraftState,
  MechanicsVersion,
  PlayerSeason,
  SlotCode,
} from '../types.js';
import type { ConstraintProfile } from './constraints.js';
import { DEFAULT_DRAFT_CONFIG, validateDraftConfig, type DraftConfig } from './config.js';
import { generateOffer } from './generateOffer.js';

export interface DraftSnapshot {
  state: DraftState;
  offer: DraftOffer | null;
}

export interface CreateDraftInput {
  challengeId: string;
  seed: string;
  versions: MechanicsVersion;
  players: readonly PlayerSeason[];
  profiles: readonly ConstraintProfile[];
  draftConfig?: DraftConfig;
}

function withHash(state: DraftState): DraftState {
  return { ...state, stateHash: stateHash({ ...state, stateHash: '' }) };
}

function openSlots(state: DraftState): SlotCode[] {
  return SLOT_CODES.filter((slot) => state.roster[slot] === undefined);
}

function offerForState(
  state: DraftState,
  players: readonly PlayerSeason[],
  profiles: readonly ConstraintProfile[],
  rejectedPlayerSeasonIds?: ReadonlySet<string>,
  excludedConstraintKey?: string,
): DraftOffer {
  return generateOffer({
    seed: state.seed,
    round: state.round,
    rerollOrdinal: state.rerollOrdinal,
    openSlots: openSlots(state),
    players,
    profiles,
    selectedIdentityIds: new Set(state.selectedIdentityIds),
    cooldownUntilRoundByPlayerSeasonId: state.cooldownUntilRoundByPlayerSeasonId,
    rerollsRemaining: state.rerollsRemaining,
    maxOfferedPlayers: state.maxOfferedPlayers,
    ...(rejectedPlayerSeasonIds ? { rejectedPlayerSeasonIds } : {}),
    ...(state.currentConstraint ? { previousConstraintKey: state.currentConstraint.key } : {}),
    ...(excludedConstraintKey ? { excludedConstraintKey } : {}),
  });
}

function attachOffer(state: DraftState, offer: DraftOffer): DraftSnapshot {
  const nextState = withHash({
    ...state,
    currentConstraint: offer.constraint,
    currentOfferIds: offer.cards.map((card) => card.playerSeasonId),
  });
  return { state: nextState, offer };
}

export function createDraft(input: CreateDraftInput): DraftSnapshot {
  const draftConfig = validateDraftConfig(input.draftConfig ?? DEFAULT_DRAFT_CONFIG);
  const initial = withHash({
    challengeId: input.challengeId,
    seed: input.seed,
    formationId: '4-3-3-v1',
    round: 1,
    roster: {},
    selectedIdentityIds: [],
    maxOfferedPlayers: draftConfig.maxOfferedPlayers,
    rerollsRemaining: draftConfig.maxRerolls,
    rerollOrdinal: 0,
    currentConstraint: null,
    currentOfferIds: [],
    rejectedOfferIdsByRound: {},
    cooldownUntilRoundByPlayerSeasonId: {},
    versions: input.versions,
    stateHash: '',
  });
  return attachOffer(initial, offerForState(initial, input.players, input.profiles));
}

export function applyDraftAction(
  snapshot: DraftSnapshot,
  action: DraftAction,
  players: readonly PlayerSeason[],
  profiles: readonly ConstraintProfile[],
): DraftSnapshot {
  const { state, offer } = snapshot;
  if (!offer || action.round !== state.round) {
    throw new DomainError('INVALID_ROUND', 'The action does not target the current round.');
  }

  if (action.type === 'reroll') {
    if (state.rerollsRemaining <= 0) throw new DomainError('NO_REROLLS', 'No rerolls remain.');
    if (!offer.rerollAvailable) {
      throw new DomainError(
        'REROLL_UNAVAILABLE',
        offer.rerollUnavailableReason ?? 'A replacement offer is unavailable.',
      );
    }
    const rejected = new Set([
      ...(state.rejectedOfferIdsByRound[String(state.round)] ?? []),
      ...offer.cards.map((card) => card.playerSeasonId),
    ]);
    const cooldown = { ...state.cooldownUntilRoundByPlayerSeasonId };
    for (const id of offer.cards.map((card) => card.playerSeasonId)) cooldown[id] = state.round + 2;
    const candidate = withHash({
      ...state,
      rerollsRemaining: state.rerollsRemaining - 1,
      rerollOrdinal: state.rerollOrdinal + 1,
      rejectedOfferIdsByRound: {
        ...state.rejectedOfferIdsByRound,
        [String(state.round)]: [...rejected].toSorted(),
      },
      cooldownUntilRoundByPlayerSeasonId: cooldown,
    });
    const replacement = offerForState(candidate, players, profiles, rejected, offer.constraint.key);
    return attachOffer(candidate, replacement);
  }

  const card = offer.cards.find((candidate) => candidate.playerSeasonId === action.playerSeasonId);
  if (!card)
    throw new DomainError('PLAYER_NOT_OFFERED', 'The selected player is not in the offer.');
  if (!card.safeSlotCodes.includes(action.slotCode)) {
    throw new DomainError('UNSAFE_SLOT', 'The selected slot is not a forward-safe placement.');
  }
  const player = players.find((candidate) => candidate.id === card.playerSeasonId);
  if (!player)
    throw new DomainError('PLAYER_NOT_FOUND', 'The selected player is missing from content.');

  const cooldown = { ...state.cooldownUntilRoundByPlayerSeasonId };
  for (const other of offer.cards) {
    if (other.playerSeasonId !== card.playerSeasonId)
      cooldown[other.playerSeasonId] = state.round + 2;
  }
  const next = withHash({
    ...state,
    round: state.round + 1,
    roster: { ...state.roster, [action.slotCode]: player.id },
    selectedIdentityIds: [...state.selectedIdentityIds, player.playerIdentityId].toSorted(),
    rerollOrdinal: 0,
    currentOfferIds: [],
    cooldownUntilRoundByPlayerSeasonId: cooldown,
  });
  if (openSlots(next).length === 0) return { state: next, offer: null };
  return attachOffer(next, offerForState(next, players, profiles));
}
