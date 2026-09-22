import { describe, expect, it } from 'vitest';

import {
  DEFAULT_MECHANICS_VERSION,
  FORMATION_4_3_3,
  POSITION_BY_SLOT,
  type DraftState,
} from '../src/index.js';

describe('frozen Phase 0 domain contracts', () => {
  it('maps both centre-back slots to the CB player-data rating', () => {
    expect(POSITION_BY_SLOT.LCB).toBe('CB');
    expect(POSITION_BY_SLOT.RCB).toBe('CB');
    expect(FORMATION_4_3_3.slots).toHaveLength(11);
  });

  it('keeps state JSON serializable without losing contract data', () => {
    const state: DraftState = {
      challengeId: 'challenge-contract-test',
      seed: 'seed-contract-test',
      formationId: '4-3-3-v1',
      round: 1,
      roster: {},
      selectedIdentityIds: [],
      maxOfferedPlayers: 15,
      rerollsRemaining: 5,
      rerollOrdinal: 0,
      currentConstraint: null,
      currentOfferIds: [],
      rejectedOfferIdsByRound: {},
      cooldownUntilRoundByPlayerSeasonId: {},
      versions: DEFAULT_MECHANICS_VERSION,
      stateHash: 'pending',
    };

    expect(JSON.parse(JSON.stringify(state))).toEqual(state);
  });
});
