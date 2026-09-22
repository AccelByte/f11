import { describe, expect, it } from 'vitest';
import { createGameSession, rerollOffer, selectPlayer } from './session';
describe('React session integration', () => {
  it('uses shared mechanics to complete and resolve an eleven-player run', () => {
    let session = createGameSession('phase-1b-browser-integration');

    for (let round = 1; round <= 11; round += 1) {
      const card = session.snapshot.offer?.cards[0];
      const slot = card?.safeSlotCodes[0];
      expect(card, `round ${round} card`).toBeDefined();
      expect(slot, `round ${round} slot`).toBeDefined();
      if (!card || !slot) throw new Error(`Missing legal action in round ${round}.`);
      session = selectPlayer(session, card.playerSeasonId, slot);
    }

    expect(session.snapshot.offer).toBeNull();
    expect(Object.keys(session.snapshot.state.roster)).toHaveLength(11);
    expect(session.actions).toHaveLength(11);
    expect(session.resolved?.result.roster).toHaveLength(11);
    expect(session.resolved?.result.season.matches).toHaveLength(38);
    expect(session.resolved?.result.finalStateHash).toBe(session.snapshot.state.stateHash);
  });

  it('routes rerolls through the shared draft transition', () => {
    const initial = createGameSession('phase-1b-reroll-integration');
    expect(initial.snapshot.offer?.cards).toHaveLength(15);
    expect(initial.snapshot.offer?.rerollAvailable).toBe(true);

    const rerolled = rerollOffer(initial);
    expect(rerolled.snapshot.state.round).toBe(1);
    expect(rerolled.snapshot.state.rerollsRemaining).toBe(4);
    expect(rerolled.snapshot.state.currentConstraint).not.toEqual(
      initial.snapshot.state.currentConstraint,
    );
    expect(rerolled.snapshot.state.currentOfferIds).not.toEqual(
      initial.snapshot.state.currentOfferIds,
    );
  });

  it('replays the same seed and selections to the same result', () => {
    const run = () => {
      let session = rerollOffer(createGameSession('offline-replay'));
      while (session.snapshot.offer) {
        const card = session.snapshot.offer.cards[0]!;
        session = selectPlayer(session, card.playerSeasonId, card.safeSlotCodes[0]!);
      }
      return session.resolved;
    };
    expect(run()).toEqual(run());
  });
});
