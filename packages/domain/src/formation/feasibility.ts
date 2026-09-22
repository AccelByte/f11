import { canOccupySlot, compatibleSlots } from './eligibility.js';
import type { PlayerSeason, SlotCode } from '../types.js';

export interface FeasibilityInput {
  openSlots: readonly SlotCode[];
  players: readonly PlayerSeason[];
  excludedIdentityIds?: ReadonlySet<string>;
}

export interface FeasibilityResult {
  completable: boolean;
  matchedPlayerIdBySlot: Partial<Record<SlotCode, string>>;
}

interface CompiledEligibility {
  identityIdsBySlot: Record<SlotCode, string[]>;
  playerIdByIdentityAndSlot: Map<string, Partial<Record<SlotCode, string>>>;
}

const eligibilityCache = new WeakMap<readonly PlayerSeason[], CompiledEligibility>();

function compileEligibility(players: readonly PlayerSeason[]): CompiledEligibility {
  const cached = eligibilityCache.get(players);
  if (cached) return cached;
  const identityIdsBySlot = Object.fromEntries(
    (['GK', 'LB', 'LCB', 'RCB', 'RB', 'DM', 'CM', 'AM', 'LW', 'CF', 'RW'] as const).map((slot) => [
      slot,
      [] as string[],
    ]),
  ) as Record<SlotCode, string[]>;
  const playerIdByIdentityAndSlot = new Map<string, Partial<Record<SlotCode, string>>>();
  for (const player of players.toSorted((left, right) => left.id.localeCompare(right.id))) {
    const bySlot = playerIdByIdentityAndSlot.get(player.playerIdentityId) ?? {};
    for (const slot of Object.keys(identityIdsBySlot) as SlotCode[]) {
      if (!canOccupySlot(player, slot) || bySlot[slot] !== undefined) continue;
      bySlot[slot] = player.id;
      identityIdsBySlot[slot].push(player.playerIdentityId);
    }
    playerIdByIdentityAndSlot.set(player.playerIdentityId, bySlot);
  }
  for (const slot of Object.keys(identityIdsBySlot) as SlotCode[]) {
    identityIdsBySlot[slot] = [...new Set(identityIdsBySlot[slot])].toSorted();
  }
  const compiled = { identityIdsBySlot, playerIdByIdentityAndSlot };
  eligibilityCache.set(players, compiled);
  return compiled;
}

export function findCompletionMatching({
  openSlots,
  players,
  excludedIdentityIds = new Set<string>(),
}: FeasibilityInput): FeasibilityResult {
  const compiled = compileEligibility(players);
  const sortedSlots = openSlots.toSorted(
    (left, right) =>
      compiled.identityIdsBySlot[left].length - compiled.identityIdsBySlot[right].length ||
      left.localeCompare(right),
  );
  const matchedSlotByIdentity = new Map<string, SlotCode>();

  const tryMatch = (slot: SlotCode, visitedIdentities: Set<string>): boolean => {
    for (const identityId of compiled.identityIdsBySlot[slot]) {
      if (excludedIdentityIds.has(identityId) || visitedIdentities.has(identityId)) continue;
      visitedIdentities.add(identityId);
      const previousSlot = matchedSlotByIdentity.get(identityId);
      if (previousSlot === undefined || tryMatch(previousSlot, visitedIdentities)) {
        matchedSlotByIdentity.set(identityId, slot);
        return true;
      }
    }
    return false;
  };

  for (const slot of sortedSlots) {
    if (!tryMatch(slot, new Set())) return { completable: false, matchedPlayerIdBySlot: {} };
  }

  const matchedPlayerIdBySlot: Partial<Record<SlotCode, string>> = {};
  for (const [identityId, slot] of matchedSlotByIdentity) {
    const playerId = compiled.playerIdByIdentityAndSlot.get(identityId)?.[slot];
    if (playerId) matchedPlayerIdBySlot[slot] = playerId;
  }
  return { completable: true, matchedPlayerIdBySlot };
}

export function isCompletable(input: FeasibilityInput): boolean {
  return findCompletionMatching(input).completable;
}

export function safeSlotsAfterSelection(
  player: PlayerSeason,
  openSlots: readonly SlotCode[],
  catalogue: readonly PlayerSeason[],
  selectedIdentityIds: ReadonlySet<string>,
): SlotCode[] {
  return compatibleSlots(player, openSlots).filter((slot) =>
    isCompletable({
      openSlots: openSlots.filter((openSlot) => openSlot !== slot),
      players: catalogue,
      excludedIdentityIds: new Set([...selectedIdentityIds, player.playerIdentityId]),
    }),
  );
}
