import type { DraftOfferCard } from '@football-11/domain';

function averageLegalPositionRating(card: DraftOfferCard): number {
  const ratings = card.safeSlotCodes.flatMap((slot) => {
    const rating = card.ratingsBySlot[slot];
    return typeof rating === 'number' ? [rating] : [];
  });

  if (ratings.length === 0) return Number.NEGATIVE_INFINITY;
  return ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length;
}

export function orderOfferCardsForSelection(cards: readonly DraftOfferCard[]): DraftOfferCard[] {
  return cards
    .map((card, offerIndex) => ({
      card,
      offerIndex,
      sortRating: averageLegalPositionRating(card),
    }))
    .toSorted(
      (left, right) => right.sortRating - left.sortRating || left.offerIndex - right.offerIndex,
    )
    .map(({ card }) => card);
}
