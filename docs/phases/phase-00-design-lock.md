# Phase 0 Detailed Plan — Design Lock

**Last updated:** September 3, 2026
**Status:** Complete for Phase 1A; public-content rights carried separately
**Parent roadmap:** [07 — MVP roadmap](../07-mvp-roadmap.md)

## Work estimate — one developer with agentic AI

- **Effort:** 1–2 builder-days.
- **Elapsed time:** Completed September 2, 2026.
- **Carried uncertainty:** public-product rights and final release curation do
  not block private mechanics implementation.

## Phase outcome

The football rules, content boundary, data contracts, simulation behavior, and
technical boundaries are specific enough that independent implementations can
build the same game without filling gaps differently.

## Entry conditions

- Product thesis and web-first direction are accepted.
- React, the framework-free domain package, local persistence, and ChatGPT Sites
  form the Functional MVP stack; AGS begins in Phase 2.
- The team accepts a curated, text-first prototype while licensing is reviewed.

## Required decisions

### Product and session

- Working product name and public one-line objective.
- Initial geography and language assumption.
- Which result facts appear on the public result and share card.

The first draft-duration target is six minutes. **Invincible** means zero
losses; **Perfect** means 38 wins and 114 points. The MVP result does not show
goals or goal difference until a goal model is approved.

### Formation and eligibility baseline

- Use `GK`, `LB`, two `CB`, `RB`, `DM`, `CM`, `AM`, `LW`, `CF`, and `RW`.
- Store each legal position and its rating on the player-season record; an
  absent position is illegal and there is no generic makeshift category.
- Use `CF`, not `FC`; broad categories such as `FW` are not formation slots.
- Allow at most one selected card per unique identity in the MVP content.
- Remove a selected card from the run's virtual deck.
- When a round resolves, put each unselected card on cooldown for the next two
  rounds; it becomes eligible again in the third round.
- Begin with the configured run-wide allowance, defaulting to five rerolls.
  Replace the current constraint with a different playable club/era and replace
  every visible card. Rerolled cards enter the same cooldown and are excluded
  from the replacement offer in the current round.

Before the mechanics version is frozen, the content fixtures must supply every
approved position rating and prove the formation has adequate coverage.

### Content

- Evaluate the prepared OpenFootball Premier League 2023/24 named-squad catalogue,
  pinned to the England and Players revisions recorded in the manifest.
- Record that the catalogue contains 380 matches, 20 clubs, and 1,041 named
  squad cards; it is not the final curated set.
- Generate ratings and attributes once from a documented deterministic seed and
  generator version, then store the resulting content manifest.
- Prototype policy for player names, club identifiers, photos, logos, and kits.
- Source provenance and license status recorded per player-season.
- Minimum coverage per position so deterministic offers cannot dead-end.
- Public-product rights decision for club and competition names/marks, with a
  replacement-identifier fallback if approval is not available.

### Simulation

- Inputs for Quality, Positioning, Chemistry, Tactical balance, and Leadership.
- Score ranges and normalization rules.
- Deterministic seed algorithm and runtime-stability requirements.
- Mapping from assessment scores to wins, draws, losses, and points.
- Structured explanation-fact vocabulary.
- Content, rules, and simulation version format.
- Initial sanity ranges for weak, average, strong, and elite fixture XIs.
  Competitive target bands and tuning are post-Functional-MVP work.

## Work sequence

### 0A — Lock the paper rules

1. Write the eleven slot definitions and an eligibility matrix.
2. Walk through at least one draft without UI assumptions.
3. Exercise scarcity cases: no rated player for a slot, duplicate identity,
   reroll near the end, and an offer with multiple valid placements.
4. Record every unresolved judgment as a rule or explicit rejection.

### 0B — Define the player-season contract

1. Finalize stable identifiers and source provenance.
2. Define position, trait, quality, leadership, and teammate-overlap fields.
3. Separate human-readable labels from stable codes.
4. Define validation rules for missing, inconsistent, or duplicate records and
   for reproducible synthetic-data generation.
5. Create representative fixtures for every position and major tactical trait.

### 0C — Prove deterministic generation

1. Specify exactly which inputs affect an offer.
2. Define stable sorting before seeded choice so database order cannot change a
   result.
3. Define reroll consumption and seed advancement.
4. Prove the generator always leaves a path to a valid XI or returns a
   diagnosable content error.
5. Record golden seeds with their expected offer sequences.

### 0D — Prove assessment and simulation

1. Score a deliberately strong balanced XI.
2. Score a star-heavy but structurally poor XI.
3. Score a lower-quality but coherent XI.
4. Confirm explanations cite actual scoring facts.
5. Confirm identical inputs reproduce identical results across repeated runs.
6. Record distribution observations and tuning hypotheses without blocking the
   Functional MVP on competitive calibration.

### 0E — Lock implementation boundaries

1. Use `apps/web/` as the React product client.
2. Confirm the `apps/web`, `apps/worker`, and shared-package layout or record an
   equivalent layout.
3. Define ownership for domain, contracts, content, migrations, and fixtures.
4. Define environment names and configuration ownership without adding secrets.
5. Record the initial browser and viewport support matrix.

## Deliverables

- Final 4-3-3 slot and per-player position-rating table.
- Versioned `PlayerSeason`, `Challenge`, `DraftRun`, and `SimulationResult`
  schemas in design form.
- Seed and reroll specification.
- Assessment and explanation specification.
- Golden fixture set with expected outputs.
- Content provenance, reuse-term, and synthetic-generator register.
- Source-layout and environment decision.
- Updated decision log with every closed question.

Frozen artifacts and evidence are recorded in the
[Phase 0 content and scoring contract](phase-00-content-contract.md). The formal
gate result is in the [Phase 0 exit review](phase-00-exit-review.md).

## Verification

- A complete eleven-round draft can be executed from the rules alone.
- Golden seeds always yield the expected offers.
- At least one invalid roster is rejected for each validation category.
- Fixture XIs produce stable scores and explanation facts.
- Every content record passes schema and position-coverage validation.
- A reviewer can identify which system owns every stored value.

## Risks and stop conditions

- Stop implementation if a legal review prohibits the proposed prototype
  content representation.
- Stop if the content set cannot satisfy slot coverage or avoid dead ends.
- Record obvious-choice and distribution issues for later tuning; they do not
  block a mechanically correct Functional MVP.
- Do not hide unresolved football judgments inside coefficients.
- Do not begin UI implementation while the deterministic contract can still
  change shape substantially.

## Exit checklist

- [x] Product objective and initial audience assumption are recorded.
- [x] Formation, eligibility, duplicates, and rerolls are decided.
- [x] Content boundary and provenance policy are approved for private mechanics
  work; public-product rights remain a later release decision.
- [x] First reproducible data candidate and synthetic generator are prepared.
- [x] Data and version contracts are stable enough to implement.
- [x] Golden generator, assessment, and match fixtures exist in design form,
  including
  two-round cooldown cases.
- [x] Architecture and repository layout are selected.
- [x] No blocking question remains for the headless mechanics phase.

Next implementation gate:
[Phase 1A — Core mechanics engine](phase-01a-core-mechanics-engine.md).

**Exit criterion:** a paper or data-driven draft can be completed, validated,
scored, explained, and reproduced without UI-specific assumptions.
