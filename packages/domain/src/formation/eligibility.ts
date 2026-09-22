import { POSITION_BY_SLOT } from '../formation.js';
import type { PlayerSeason, SlotCode } from '../types.js';

export function ratingForSlot(player: PlayerSeason, slotCode: SlotCode): number | null {
  return player.ratingsByPosition[POSITION_BY_SLOT[slotCode]] ?? null;
}

export function canOccupySlot(player: PlayerSeason, slotCode: SlotCode): boolean {
  return ratingForSlot(player, slotCode) !== null;
}

export function compatibleSlots(player: PlayerSeason, openSlots: readonly SlotCode[]): SlotCode[] {
  return openSlots.filter((slotCode) => canOccupySlot(player, slotCode));
}
