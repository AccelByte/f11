# Data and Simulation

**Last updated:** September 4, 2026
**Status:** Initial domain contract

## Design principles

- Store enough evidence to reproduce every competitive result.
- Version content generation and simulation independently when useful.
- Keep rich football records in the domain database.
- Store only ranking/progression values in AGS Statistics.
- Never trust a score calculated by the browser.

## Core entities

### Player-season

- Stable identifier.
- Player display name.
- Club.
- Season or era.
- Position-specific ratings for every legal formation position.
- Quality attributes.
- Tactical traits.
- Leadership value.
- Teammate-overlap references or derivable career history.
- Content and licensing status.
- Data version.

The active catalogue is derived from the 380 OpenFootball English Premier
League results and all 20 club squad tables for 2023/24. It contains 1,041 named
squad entries. Player names, clubs, shirt numbers, broad positions, and
available birth years are observed rather than invented. OpenFootball does not
supply player performance histories, so the game keeps appearances at zero and
does not assign unsupported event statistics to the named players.

Observed points, goals, defensive record, clean sheets, goal difference,
second-half results, away performance, and consistency become within-season
club indices. Position-specific weights turn those indices into a club-role
baseline. The source `GK`, `DF`, `MF`, and `FW` values are deterministically
mapped to formation positions. Birth year provides age where available;
unambiguous OpenFootball Players matches provide 538 heights, while missing
physical values use position-population samples. Position templates and a
small seeded variation produce raw attributes and ratings. A monotonic
piecewise-linear calibration preserves the 55-point floor and median while
stretching only the upper tail into an elite band. In content v2, the median
best-position rating is 72, the 95th percentile is 86, 14 of 1,041 cards reach
90 or higher, and the maximum is 94. Generation tests enforce those gates.
These modeled values remain synthetic, non-official gameplay constructs.

The active catalogue lives at
`data/content/openfootball-pl-2023-24-named-squads-v2.json`. It stores both
pinned source revisions, the generation seed and version, a player-record hash,
and explicit observed-versus-modeled provenance. Runtime code reads this frozen
manifest and never invents ratings per request. The source repositories describe
their data as public domain; club, competition, and mark rights remain a release
review, including the real-player publicity implications of a public release.

Each named player card has a unique `playerIdentityId`.
The position map uses placeable formation codes such as `RW`, `CF`, and `LW`;
broad labels such as `FW` may be search tags but are not formation slots.

Current modeled-position coverage is: `GK` 131, `LB` 343, `CB` 343, `RB` 343,
`DM` 361, `CM` 361, `AM` 361, `LW` 206, `CF` 206, and `RW` 206. The 2020s
club/era grouping and forward-feasibility checks passed 10,000 complete seeded
drafts. Content v2 changes ratings only and preserves the analyzed identities,
clubs, eras, and legal-position maps, but this remains mechanics and calibration
evidence rather than validation of real player ability.

### Challenge

- Challenge identifier.
- Mode.
- Seed.
- Content version.
- Rules version.
- Simulation version.
- Formation.
- Reroll allowance.
- Active period for daily challenges.
- Optional AGS session identifier for friend rooms.

### Draft run

- Run identifier.
- Challenge identifier.
- AGS user identifier.
- Offered choices for every round.
- Selected player and roster slot for every round.
- Rerolls used.
- Submission timestamp.
- Validation outcome.
- Final result identifier.

### Saved XI

- Owner AGS user identifier.
- Formation and slot assignments.
- Source run identifier.
- Public visibility state.
- Content and simulation versions.
- Quality, chemistry, and balance summary.
- Creation and replacement timestamps.

### Simulation result

- Result identifier.
- Source run and XI.
- Input checksum.
- Simulation version.
- Category scores.
- Wins, draws, losses, points, and optional Invincible or Perfect label.
- Explanation facts and rendered summary.
- Creation timestamp.

### Asynchronous match

- Match identifier.
- Challenger and opponent XI identifiers.
- Selection-window evidence.
- Rules and simulation versions.
- Outcome.
- Statistic updates.
- Creation timestamp.

## Deterministic challenge contract

Given the same:

- Seed.
- Content version.
- Rules version.
- Formation.
- Maximum offered players and initial reroll allowance.
- Prior selections.
- Reroll decisions.

the generator must produce the same eligible offers.

Determinism enables daily fairness, friend comparison, bug reproduction, and
auditable disputes.

The implementation algorithm—including derived RNG streams, constraint and
offer selection, maximum-matching feasibility, rerolls, assessment formulas,
and the 38-match model—is defined in
[Phase 1A — Core mechanics engine](phases/phase-01a-core-mechanics-engine.md).

## Submission and validation

The browser submits:

- Challenge identifier.
- Selected player identifiers and slots.
- Reroll actions.
- A replay or sequence token if required.

The Worker:

1. Loads the authoritative challenge.
2. Reconstructs every offer.
3. Confirms that each selected player was eligible.
4. Confirms formation, uniqueness, slot compatibility, and reroll limits.
5. Computes category scores.
6. Runs the versioned simulation.
7. Stores the full result.
8. Updates only trusted aggregates in AGS Statistics.

## Candidate AGS statistics

These are proposals, not namespace configuration:

- Runs played.
- Best season points.
- Daily season points.
- Invincible seasons, meaning zero losses.
- Perfect seasons, meaning 38 wins and 114 points.
- Saved-XI rating or asynchronous wins, once the rating model is approved.

Avoid one AGS statistic per tactical coefficient. The full breakdown belongs in
the domain result record.

## Simulation layers

### Layer 1: roster assessment

- Quality.
- Positioning.
- Chemistry.
- Tactical balance.
- Leadership.

### Layer 2: season model

Translate the assessment into a distribution of wins, draws, and losses using a
seeded deterministic process. The versioned baseline formula is documented in
[Phase 1A](phases/phase-01a-core-mechanics-engine.md) and executed only by the
trusted mechanics path.

### Layer 3: explanation

Generate explanations from structured facts, not unconstrained prose. Every
sentence should correspond to an actual scoring signal.

## Version compatibility

Old results remain immutable. A rebalance creates a new simulation version.
Saved-XI opponent rules must explicitly choose whether to:

- Preserve historical outcomes.
- Re-simulate both XIs under the newest compatible version.
- Restrict competition to equal versions.

That choice is open and must be resolved before public ranked competition.
