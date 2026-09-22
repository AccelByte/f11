import { describe, expect, it } from 'vitest';
import type { DraftOfferCard } from '@football-11/domain';

import { orderOfferCardsForSelection } from './offerPresentation';

function card(
  playerSeasonId: string,
  ratings: ReadonlyArray<readonly [DraftOfferCard['safeSlotCodes'][number], number]>,
): DraftOfferCard {
  return {
    playerSeasonId,
    playerIdentityId: `identity-${playerSeasonId}`,
    safeSlotCodes: ratings.map(([slot]) => slot),
    ratingsBySlot: Object.fromEntries(ratings),
  };
}

describe('offer presentation ordering', () => {
  it('orders by the average of every legal position rating without mutating the offer', () => {
    const cards = [
      card('two-balanced', [
        ['CM', 84],
        ['DM', 86],
      ]),
      card('single-high', [['CF', 87]]),
      card('two-low', [
        ['LW', 81],
        ['RW', 83],
      ]),
    ];

    expect(orderOfferCardsForSelection(cards).map(({ playerSeasonId }) => playerSeasonId)).toEqual([
      'single-high',
      'two-balanced',
      'two-low',
    ]);
    expect(cards.map(({ playerSeasonId }) => playerSeasonId)).toEqual([
      'two-balanced',
      'single-high',
      'two-low',
    ]);
  });

  it('retains the original offer order when average ratings are equal', () => {
    const cards = [
      card('first', [
        ['CM', 84],
        ['DM', 86],
      ]),
      card('second', [['GK', 85]]),
    ];

    expect(orderOfferCardsForSelection(cards).map(({ playerSeasonId }) => playerSeasonId)).toEqual([
      'first',
      'second',
    ]);
  });
});
