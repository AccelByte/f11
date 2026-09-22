# Product Brief

> Connected-project reference: implementation claims and source paths below refer to the connected branch, not this offline starter. See the [starter path](12-accelbyte-integration-guide.md#offline-baseline) for the current sequence.

**Last updated:** September 3, 2026
**Status:** Living product definition

## One-sentence concept

Build an all-time football starting XI from constrained random offers, then
discover whether that team can complete a perfect 38-match season.

**Working product name:** Football 11. This name is sufficient for the private
Functional MVP and may still change before public branding work.

## Product thesis

Football 11 is a football debate generator disguised as a drafting game. The
simulation is not intended to reproduce every detail of real football. Its job
is to produce understandable, arguable outcomes that players want to share.

The strongest emotional loop is:

    Recognize a player
    → make a difficult selection
    → build a team with visible strengths and flaws
    → receive an explainable season result
    → compare and debate

## Confirmed direction

- Football is the only subject for the initial product.
- The player builds a full starting XI.
- Web and mobile browser are the first platforms.
- The product should open directly from shared links without installation.
- The Functional MVP uses a random local guest profile and checksummed browser
  persistence so the standalone game has no online-service prerequisite.
- AGS IAM Device ID and Cloud Save begin in Phase 2, after the local game and
  sharing foundations are proven.
- ChatGPT Sites hosts the React application; an application-owned Cloudflare
  Worker and D1 are deferred.
- The MVP excludes Analytics, Achievements, Store, and Entitlements.
- Multiplayer includes a live friend room and an asynchronous saved-XI opponent mode.
- Competitive authority is a connected-release concern; the browser-only MVP
  is reproducible but explicitly player-authoritative.

## Target audience

**Functional MVP audience assumption:** English-speaking football fans
comfortable debating all-time players, clubs, eras, formations, and tactical
balance. This is an implementation assumption, not a final launch-market
decision.

The geographic launch audience remains open. An Indonesia/SEA-first launch may
affect club selection, content language, sharing channels, and creator outreach.

## Player promise

Every completed draft should answer three questions:

1. How strong are the individual players?
2. Does the XI work as a football team?
3. Why did the simulated season succeed or fail?

## Product principles

- **Fast entry:** no mandatory registration screen before the first meaningful action.
- **Recognizable choices:** offers should trigger football knowledge and emotion.
- **Visible trade-offs:** quality, positioning, chemistry, and balance should be legible while drafting.
- **Explainable results:** the result can surprise the player, but must not feel arbitrary.
- **Share-first outcomes:** the XI, record, and key explanation must survive outside the app.
- **One sport done well:** no multi-sport platform during validation.

## Initial success signals

Exact targets are open, but the MVP should measure:

- Draft-start to draft-completion rate.
- Median completion time.
- Reroll usage by round.
- Replay rate within one session.
- Share-card generation and share-link opens.
- Daily challenge return rate.
- Friend-room creation, join, and completion rate.
- Percentage of players who challenge a saved leaderboard XI.

Product analytics collection itself is deferred from the first AGS footprint;
minimal operational measurements can be added after the playable loop is stable.
