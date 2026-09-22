import { DomainError } from '../errors.js';

export interface DraftConfig {
  maxOfferedPlayers: number;
  maxRerolls: number;
}

export const MIN_OFFERED_PLAYERS = 3;
export const MAX_OFFERED_PLAYERS = 15;
export const MAX_DRAFT_REROLLS = 5;

export const DEFAULT_DRAFT_CONFIG: DraftConfig = {
  maxOfferedPlayers: MAX_OFFERED_PLAYERS,
  maxRerolls: MAX_DRAFT_REROLLS,
};

export function validateDraftConfig(config: DraftConfig): DraftConfig {
  if (
    !Number.isInteger(config.maxOfferedPlayers) ||
    config.maxOfferedPlayers < MIN_OFFERED_PLAYERS ||
    config.maxOfferedPlayers > MAX_OFFERED_PLAYERS
  ) {
    throw new DomainError(
      'INVALID_DRAFT_CONFIG',
      `maxOfferedPlayers must be an integer from ${MIN_OFFERED_PLAYERS} to ${MAX_OFFERED_PLAYERS}.`,
    );
  }
  if (
    !Number.isInteger(config.maxRerolls) ||
    config.maxRerolls < 0 ||
    config.maxRerolls > MAX_DRAFT_REROLLS
  ) {
    throw new DomainError(
      'INVALID_DRAFT_CONFIG',
      `maxRerolls must be an integer from 0 to ${MAX_DRAFT_REROLLS}.`,
    );
  }
  return { ...config };
}
