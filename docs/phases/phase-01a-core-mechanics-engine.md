# Phase 1A Detailed Plan — Core Mechanics Engine

> Connected-project reference: implementation claims and source paths below refer to the connected branch, not this offline starter. See the [starter path](../12-accelbyte-integration-guide.md#offline-baseline) for the current sequence.

**Last updated:** September 4, 2026
**Status:** Complete; Phase 1B entry gate passed
**Parent roadmap:** [07 — MVP roadmap](../07-mvp-roadmap.md)  
**Phase index:** [Detailed delivery plans](README.md)

## Work estimate — one developer with agentic AI

- **Effort:** 2–3 builder-days.
- **Elapsed time:** 2–3 working days.
- **Primary uncertainty:** constraint-aware continuation across cooldown states
  and alternate-team bounded-offer reroll availability.

## Why this phase exists

The game must be fun, deterministic, and internally coherent before React,
Cloudflare routing, AGS, sharing, or multiplayer can add value. This phase
builds the draft generator, roster rules, assessment, season simulation, and
explanation system as a headless TypeScript library with a command-line fixture
runner.

No UI or online service is allowed to become a dependency of the mechanics.

## Phase outcome

Given a seed, content version, rules version, formation, and sequence of player
actions, the engine always produces the same legal offers and final result. It
can also prove that every offered player/slot choice leaves at least one path to
a complete XI.

## Entry conditions

- Phase 0 has approved the formation, position-rating eligibility, content boundary,
  reroll behavior, scoring categories, and explanation vocabulary.
- A representative validated player-season fixture set exists.
- Attribute values use documented ranges and provenance.
- Product owners accept that all coefficients below are a versioned MVP tuning
  baseline, not immutable football truth.
- Competitive calibration is explicitly deferred; this phase blocks only on
  correctness, determinism, reproducibility, and roster completion.

## Non-goals

- React screens or animations.
- Worker APIs, D1, authentication, or AGS integration.
- Real-time match simulation or a visual football match engine.
- Machine-learning or generative-AI scoring.
- Hiding subjective football choices inside undocumented constants.

## Package boundary

```text
packages/domain/src/
  random/
    RandomSource.ts
    seed.ts
    sfc32.ts
  formation/
    slots.ts
    eligibility.ts
    feasibility.ts
  draft/
    constraints.ts
    generateOffer.ts
    applyAction.ts
    replayDraft.ts
  assessment/
    quality.ts
    positioning.ts
    chemistry.ts
    tacticalBalance.ts
    leadership.ts
    teamRatings.ts
  simulation/
    leagueProfile.ts
    simulateMatch.ts
    simulateSeason.ts
  explanation/
    facts.ts
    templates.ts
  version.ts

packages/content/src/
  playerSeasons/
  formations/
  chemistryLinks/
  leagueProfiles/

packages/test-fixtures/
  seeds/
  rosters/
  expected/

tools/
  simulate-fixture.ts
  analyze-offers.ts
  analyze-balance.ts
```

Every function receives plain serializable inputs and returns plain
serializable outputs. No module imports React, browser storage, network clients,
D1, or AGS packages.

## Versioned mechanics contract

Every challenge pins:

```ts
type MechanicsVersion = {
  contentVersion: string;
  rulesVersion: string;
  rngVersion: "rng-v1";
  offerVersion: "offer-v1";
  assessmentVersion: "assessment-v1";
  seasonVersion: "season-v1";
  explanationVersion: "explanation-v1";
};
```

Any change that can alter an offer, legal placement, score, match outcome, or
explanation fact requires the corresponding version to change. Old result
replays load the old version or fail explicitly as unsupported; they must never
silently run under new rules.

## Core data model

The names are application-owned proposed contracts, not final code signatures.

```ts
type PlayerSeason = {
  id: string;
  playerIdentityId: string;
  displayName: string;
  clubCode: string;
  seasonCode: string;
  eraCode: string;
  ratingsByPosition: Partial<Record<PositionCode, number>>; // validated 0..100
  categoryTags: string[]; // e.g. FW; never used as placeable slots
  attributes: Record<string, number>; // validated 0..100
  tacticalTraits: Record<string, number>; // validated 0..100
  leadership: number; // validated 0..100
  dataVersion: string;
};

type DraftAction =
  | { type: "select"; round: number; playerSeasonId: string; slotCode: string }
  | { type: "reroll"; round: number };

type DraftState = {
  challengeId: string;
  round: number;
  roster: Record<string, string>;
  selectedIdentityIds: string[];
  rerollsRemaining: number;
  currentConstraint: string;
  currentOfferIds: string[];
  rejectedOfferIdsByRound: Record<number, string[]>;
  cooldownUntilRoundByPlayerSeasonId: Record<string, number>;
  versions: MechanicsVersion;
};
```

The MVP content validator permits at most one player-season record per
`playerIdentityId`. Selecting that card removes it from the run. A later
content version may allow multiple seasons in the catalogue, but the runtime
must still exclude every record sharing a selected `playerIdentityId`.

Whenever an offer is resolved by selection or reroll, each unselected card gets
`cooldownUntilRound = currentRound + 2`. It is excluded while
`round <= cooldownUntilRound` and becomes eligible at `currentRound + 3`.
Selected identities remain excluded for the rest of the run.

## Deterministic random-number design

### Rule

Never call `Math.random()` in domain, Worker, test, or replay code. All random
behavior receives a `RandomSource`.

### Proposed `rng-v1`

Use a documented string-to-seed hash such as `xmur3` to produce four unsigned
32-bit seeds, then use the integer-only `sfc32` generator. Pin the exact source
implementation with golden output vectors.

This generator is suitable for reproducible game randomness, not cryptography.
Opaque public identifiers, access tokens, and security nonces must use platform
cryptographic randomness instead.

### Independent derived streams

Derive a new stream from explicit state rather than consuming one global stream:

```text
base = seed | contentVersion | rulesVersion | mode

constraint stream = hash(base | round | "constraint")
offer stream      = hash(base | round | rerollOrdinal | "offer")
season stream     = hash(base | rosterChecksum | "season")
match stream      = hash(season stream | matchIndex)
```

This prevents an extra random call in an animation, explanation, or earlier
round from changing every later outcome. Stream labels are part of `rng-v1`.

## Constraint selection algorithm

Each round presents one club-plus-era constraint. At content-build time, create
a `ConstraintProfile` for every allowed pair:

```text
constraint key
eligible player-season IDs
position coverage bitset
candidate count per slot group
validation status
```

At runtime:

1. Determine currently open formation slots.
2. Deterministically shuffle active constraint profiles with the round's
   constraint stream.
3. Move the previous round's constraint behind alternatives when another valid
   profile exists, avoiding accidental immediate repetition.
4. For each profile in shuffled order, build its feasible candidates using the
   algorithm below.
5. Choose the first profile that can produce three valid offers.
6. If none can do so, return `CONTENT_UNSATISFIABLE` with diagnostic facts. Do
   not silently weaken the club/era rule.

The content-validation tool must exercise reachable draft states before a
content version can ship so the runtime error is exceptional rather than a
normal fallback.

## Candidate and placement algorithm

For the chosen constraint:

1. Begin with player-seasons in the active content version matching the club
   and era.
2. Exclude already selected `playerIdentityId` values.
3. Exclude cards whose two-round cooldown includes the current round.
4. Exclude the current rejected offer IDs when generating a same-round reroll.
   Exclude the current club/era profile as well, so the reroll changes teams.
5. Find each candidate's compatible open slots by looking up explicit entries
   in `ratingsByPosition`; an absent position is illegal.
6. For every candidate/slot pair, simulate that placement and call
   `isCompletable`.
7. Keep only candidate/slot pairs for which the remaining roster can still be
   completed.
8. Discard candidates with no safe slot.

The offer contains each player and the safe slot codes for that player. The
Worker later rejects a placement that was not in this set.

### `isCompletable` forward-feasibility check

Model remaining roster construction as a bipartite graph:

```text
left nodes:  remaining formation slots
right nodes: unselected player identities in the active content version
edge:        player can legally occupy slot
```

Run a deterministic maximum matching using sorted node IDs. With at most eleven
slots, a simple augmenting-path matcher is sufficient and easier to audit than
a more complex implementation.

The state is completable only when the maximum matching covers every remaining
slot. Memoize by the canonical tuple of open slots and selected identity IDs.

This maximum-matching check is necessary but not sufficient: it proves that a
roster can be completed from the catalogue, but not that every future round can
still present at least three cards under an allowed club-plus-era constraint.

### `hasPlayableContinuation` constraint-aware check

Before a candidate/slot pair becomes offerable, run a deterministic memoized
search from the resulting state:

1. If every slot is filled, return true.
2. Enumerate active constraint profiles in stable seeded order.
3. Build a candidate set using the same exclusions and maximum-matching
   rules as the real next round.
4. Keep a set only when every displayed candidate has at least one safe
   placement that itself reaches a playable continuation.
5. Return true when at least one constraint can produce such a set;
   otherwise return false with a diagnostic state signature.

Memoize by content/rules version, open slots, selected identities, active
cooldowns, round, and reroll exclusions. The content-build validator exhaustively walks all reachable
offer choices for the release fixture set. Runtime must not silently weaken the
constraint or exceed the validated deployment cap.

## Offer construction algorithm

The initial maximum offer size is fifteen. A validated AGS Game Record revision
may configure an integer from three to fifteen; a scarce constraint can return
fewer than the cap but never fewer than three. Sites freezes the selected value
into the challenge before draft creation.

1. Deterministically shuffle constraint-aware feasible candidates using the offer stream.
2. Keep only candidates with at least one forward-safe placement.
3. Return the first candidates in deterministic shuffled order, capped by the
   challenge's frozen `maxOfferedPlayers` value.

The headless analyzer reports dominance and fallback rates. It must not rewrite
an offer after seeing the player's eventual selection.

## Reroll algorithm

The recommended `offer-v1` rule is:

1. A run begins with the configured allowance, five by default and bounded to
   zero through five.
2. Exclude the current club/era constraint and select a different playable
   team through the same deterministic constraint stream.
3. Add the visible player-season IDs to `rejectedOfferIdsByRound[round]`.
4. Put those discarded cards on cooldown for the next two numbered rounds.
5. Increment `rerollOrdinal` and derive a new offer stream.
6. Generate up to the configured cap of new feasible candidates, excluding selected, cooling down,
   and rejected
   identities.
7. Consume the reroll only after a replacement offer is successfully produced.
8. If no different team can provide at least three safe replacements, disable
   reroll for that state and expose the reason; do not consume the resource.

Content validation must report how often rerolls would be unavailable. If the
rate is material, expand content or revise the alternate-team rule before UI
work begins.

Rejected cards are excluded from the current replacement offer and then follow
the normal two-round cooldown. Any card not selected from the final offer also
enters that cooldown when the round advances.

## Roster assessment algorithm

All intermediate values are clamped to `0..100` and retained as explanation
facts. Coefficients live in versioned configuration rather than component code.

### 1. Quality

Each player-season explicitly stores its legal position ratings. Define
`bestPositionRating` as the highest stored value for that record. Team Quality
`Q` is the mean best-position rating of all eleven selected players. This keeps
intrinsic player strength visible even when the user places a player in a
lower-rated legal position.

The selected slot's effective rating is read directly from
`ratingsByPosition[slot.code]`. Unit ratings use that effective value; they do
not recompute an undocumented natural or makeshift penalty.

### 2. Positioning

For each selected player:

```text
positionFit = 100 * selectedPositionRating / bestPositionRating
```

Team Positioning `P` is the mean `positionFit`, clamped to `0..100`. A player
used at their best recorded position contributes 100; a lower-rated but legal
position contributes proportionally. An absent position is invalid rather than
receiving a generic makeshift score.

### 3. Chemistry

The formation defines a weighted adjacency graph—for example, centre-back to
fullback, midfield-to-midfield, and midfield-to-forward links. Only edges in
that graph contribute.

Each content-version pair relationship provides or deterministically derives a
`pairAffinity` from `0..100`. The derivation order and values must be documented,
for example explicit teammate overlap before weaker same-league/era familiarity.
Unknown does not mean hostile; use a documented neutral baseline.

```text
C = sum(edge.weight * pairAffinity(edge.players)) / sum(edge.weight)
```

Relationship data must be symmetric and provenance-backed. Do not hand-edit a
specific player's chemistry to force a desired final record without recording
the content/rules change.

### 4. Tactical balance

`assessment-v1` starts with six visible axes:

- width;
- chance creation;
- ball winning;
- pace/direct threat;
- defensive cover;
- aerial presence.

Each axis calculates a role-weighted supply from the eleven players. The
formation configuration defines an acceptable minimum and optional maximum.

```text
if supply < minimum:
  axisScore = 100 * supply / minimum
else if maximum is absent or supply <= maximum:
  axisScore = 100
else:
  axisScore = max(60, 100 - 40 * (supply - maximum) / (100 - maximum))
```

Team Tactical Balance `T` is the configured weighted mean of axis scores.
Oversupply penalties apply only to axes where excess genuinely creates a
trade-off; otherwise the axis has no maximum.

### 5. Leadership

Leadership should reward both one captain and supporting organizers:

```text
L = 0.60 * highestLeadership
  + 0.40 * mean(topThreeLeadershipValues)
```

### Composite rating

Proposed `assessment-v1` baseline:

```text
R = 0.35Q + 0.20P + 0.20C + 0.20T + 0.05L
```

The UI should show the categories, not present `R` as objective football truth.
Balance tests may adjust these weights before the version is approved.

## Attack, defence, and control ratings

The season model needs more structure than one composite number. Formation slot
configuration defines normalized contribution weights for three units. Each
unit uses the selected position rating plus the retained attributes and traits;
broad content tags such as `FW` never decide placement:

- `A` — attack: finishing, chance creation, width, pace, and attacking slot
  quality;
- `D` — defence: goalkeeping, ball winning, defensive cover, aerial presence,
  and defensive slot quality;
- `M` — control: midfield quality, chance creation, ball winning, positioning,
  and chemistry.

Each unit is a `0..100` weighted mean derived from the same retained facts used
above. The exact attribute weights live in `assessment-v1.json` and must sum to
`1.0` per unit.

## Season simulation algorithm

### League profile

Create a versioned `league-profile-v1` containing nineteen abstract opponent
profiles. Each profile has `attack`, `defence`, and `control` ratings. Play each
profile once at home and once away for 38 matches. This provides a stable
difficulty curve without pretending to simulate licensed real clubs.

### Match strength difference

For each match:

```text
delta = 0.45 * (team.A - opponent.D)
      + 0.40 * (team.D - opponent.A)
      + 0.15 * (team.M - opponent.M)
      + venueBias

venueBias = +2 at home, -2 away
```

### Outcome weights

```text
winWeight  = exp(delta / 12)
lossWeight = exp(-delta / 12)
drawWeight = exp(-0.35 - abs(delta) / 18)

total = winWeight + drawWeight + lossWeight
P(win)  = winWeight / total
P(draw) = drawWeight / total
P(loss) = lossWeight / total
```

Use the match-specific deterministic random stream to sample the outcome. Sum
three points for a win and one for a draw. The MVP result contains no goals or
goal difference; add them only with a separately approved, versioned goal
model. Label a zero-loss season **Invincible** and a 38-win, 114-point season
**Perfect**.

These constants are an initial calibration model. They must be evaluated with
fixtures and population simulations, then frozen under `season-v1` or changed
with a new version.

## Explanation algorithm

Explanations are deterministic templates built from assessment and season facts.

1. Collect category scores and tactical-axis scores.
2. Sort by score, using stable fact keys as tie-breakers.
3. Select the strongest relevant fact and the weakest relevant fact.
4. Add a positioning or chemistry fact when it materially changed a unit score.
5. Render approved templates with player/slot names and measured values.
6. Store fact keys and values with the rendered explanation.

Example shape:

```text
Strong chance creation and midfield control drove the attack.
Lower-rated defensive placement and limited wide cover increased upset risk.
```

Every clause must trace to a retained fact. No unconstrained generated prose is
part of MVP result calculation.

## Action replay and validation

The canonical engine consumes an initial challenge plus ordered actions:

```text
create initial state
  -> generate expected offer
  -> validate action round and offered player
  -> validate chosen slot is forward-safe
  -> apply selection or reroll
  -> derive next state
  -> repeat until eleven slots are filled
  -> assess roster
  -> simulate season
  -> build explanation facts and result
```

Replaying the same action sequence must yield the same intermediate state hash
after every action, not only the same final points.

## Headless tools

Plan these developer commands:

```text
npm run mechanics:fixture -- --seed <seed> --actions <file>
npm run mechanics:offers -- --content-version <version>
npm run mechanics:balance -- --runs 10000
```

The fixture runner prints offers, legal slots, state hashes, category scores,
unit ratings, match outcomes, points, and explanation facts. It can emit JSON
for golden tests.

The offer analyzer reports:

- constraints with insufficient candidates;
- unreachable or over-scarce slots;
- states with no completion matching;
- reroll-unavailable rate;
- dominated-choice and quality-fallback rates;
- player/club/era appearance distribution.

The optional calibration analyzer runs at least three deterministic bot policies:

- random legal choice;
- highest immediate slot quality;
- fit-aware choice that protects scarce slots.

Compare their result distributions to create tuning evidence after the
Functional MVP. These comparisons do not block React integration.

## Verification strategy

### Golden tests

- Published RNG vectors for `xmur3` plus `sfc32`.
- Known seed produces exact constraints and offers.
- Known actions produce exact state hashes.
- Known XI produces exact category and unit scores.
- Known season seed produces exact 38 outcomes and points.
- Known facts produce exact explanation text.

### Property and invariant tests

- Offers contain three to fifteen unique player identities according to the configured cap and safe availability.
- Every offered player has at least one safe open slot.
- Every accepted offered placement leaves a completable roster.
- Every accepted offered placement leaves a constraint-aware path of future
  bounded offers to a complete XI.
- Selected player identities never repeat.
- Passed-over cards never appear during their next two rounds and become
  eligible again in the third when other rules permit.
- Rerolls never increase and are never consumed on failed generation.
- All category, axis, and unit scores stay within `0..100`.
- Wins plus draws plus losses always equal 38.
- Points always equal `3 * wins + draws`.
- Replay is identical across browser-compatible and Worker runtimes.
- No production mechanics path calls `Math.random()`.

### Completion checks and deferred calibration

- Run at least 10,000 seeded auto-drafts without a dead end.
- Record points, W/D/L, category, and perfect-season distributions.
- Record player, position, club, era, and constraint appearance rates.
- Later, verify obviously stronger balanced fixtures outperform weak fixtures over a
  large common seed set, without demanding monotonic results for every seed.
- Later, verify tactical and positioning changes materially affect distributions.
- Do not require target-band approval before the Functional MVP; open a tuning
  version when calibration begins.

## Implementation sequence

1. Add schemas and content validation.
2. Implement and freeze `rng-v1` golden vectors.
3. Implement formation eligibility and maximum-matching feasibility.
4. Implement constraint and offer generation.
5. Implement action application, rerolls, state hashes, and replay.
6. Implement five-category roster assessment.
7. Implement attack/defence/control derivation and league profile.
8. Implement 38-match season simulation.
9. Implement explanation facts and templates.
10. Add fixture and offer analyzers plus a non-blocking distribution report.
11. Freeze the first mechanically valid versions.
12. Tune data/configuration in a later balance pass using recorded distributions.

## Exit checklist

- [x] Mechanics run as a pure headless TypeScript package.
- [x] RNG implementation and derived streams have golden vectors.
- [x] Constraints and offers are deterministic and reproducible.
- [x] Every offered placement passes forward-feasibility matching.
- [x] Reroll behavior and exhaustion are deterministic.
- [x] Assessment categories and coefficients are versioned and explainable.
- [x] Season simulation produces valid deterministic 38-match records.
- [x] Every explanation clause traces to a retained fact.
- [x] Ten thousand automated drafts finish without a dead end.
- [x] Distribution and policy observations are recorded for later tuning.
- [x] No React, Worker, D1, or AGS dependency exists in the domain package.

Exit evidence: 42 tests pass; `npm run mechanics:fixture` resolves a complete
replayable result; `npm run mechanics:offers` completed 10,000 randomized runs
with 5,791 rerolls and zero failures. The checked-in report records points,
W/D/L, category, constraint, position, and player appearance distributions.

**Exit criterion:** a headless runner can generate, complete, replay, assess,
and simulate thousands of seeded drafts with no illegal offer or dead end. The
first mechanically valid versions may enter UI integration without competitive
balance approval.
