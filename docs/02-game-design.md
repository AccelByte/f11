# Game Design

**Last updated:** September 4, 2026
**Status:** Core MVP rules confirmed; scoring configuration pending validation

## Player fantasy

The player is assembling an all-time starting XI under imperfect constraints,
balancing star power against position coverage, chemistry, and tactical fit.

## Objective

Draft an XI capable of completing a 38-match league season undefeated, ideally
with a perfect or near-perfect points total.

## MVP formation and player-position model

The MVP uses one confirmed 4-3-3 with eleven explicit formation slots:

- Goalkeeper
- Left back
- Two centre backs
- Right back
- Defensive midfielder
- Central midfielder
- Attacking midfielder
- Left forward
- Centre forward
- Right forward

Formation slots are seats in the XI; they are not player identities or generic
player categories. Use the canonical codes `GK`, `LB`, `CB`, `RB`, `DM`, `CM`,
`AM`, `LW`, `CF`, and `RW`. `FW` may be retained as a broad content/search tag,
but it is not a placeable formation slot. Use `CF`, not `FC`, as the centre-
forward code.

Every player-season record stores its own rating for each legal position. A
future licensed catalogue could, for example, contain `RW: 99`, `CF: 97`, and
`LW: 94` for one player-season. The active synthetic content instead uses a
tested 55–94 range with a scarce 90-plus tier. A card may be placed only in a
position present in that record; there is no generic
natural/secondary/makeshift penalty in the MVP.

Every offer card shows all legal positions and their ratings. When the player
previews or chooses a formation slot, the UI also shows the exact rating that
will be used for that placement. The player never has to guess whether a card
is legal or how much strength it contributes in the selected position.

The MVP content manifest gives every named 2023/24 player card a unique
identity. Once selected, that card leaves the run's virtual deck. A future
multi-season content version may contain several seasons of the same player, in
which case selecting one version must remove every card sharing that
`playerIdentityId`.

When an offer is resolved, every card not selected enters a two-round cooldown:
it is unavailable in the next two numbered rounds and becomes eligible again
in the third. Cards discarded by a reroll follow the same cooldown and are also
excluded from the replacement offer in the current round. Cooldown changes
availability, never identity uniqueness.

## Draft loop

1. Start a random, daily, friend-room, or saved-opponent challenge.
2. Receive a deterministic challenge seed and simulation version.
3. Reveal a club and era constraint.
4. Receive up to the configured maximum of fifteen eligible role-card offers.
5. Optionally spend one of the configured maximum of five run-wide rerolls to
   replace both the club/era constraint and every visible player.
6. Select one player and place that player in an open compatible slot.
7. Repeat until all eleven positions are filled.
8. Submit selections to the authoritative game API.
9. Receive the simulated 38-match record and explanation.
10. Save, compare, replay, or share the result.

## Confirmed rules

- The starting XI contains eleven players.
- The first version has one formation.
- A round offers multiple meaningful choices rather than one forced player.
- Rerolls are limited across the whole run.
- A reroll must produce at least three safe cards from a different club/era
  constraint. If no alternate team can do so, the action is disabled and the
  reroll remains unspent.
- Each Sites-issued challenge freezes an AGS Game Record revision. The active
  configuration accepts 3–15 offers and 0–5 rerolls; revision `1` uses 15 and 5.
- The same seed must reproduce the same eligible offers.
- The final score is calculated by the server, not trusted from the browser.
- Position eligibility and rating come from the selected player-season data.
- A selected player-season cannot appear again in that run.

## Functional MVP content baseline

Each round combines:

- A club.
- A season or era.
- Three to fifteen role-card records eligible for remaining positions, capped by configuration.

The active prototype pool uses public-domain OpenFootball Premier League
2023/24 results and all 20 squad tables: 380 matches and 1,041 named player
cards. Names, clubs, shirt numbers, broad positions, and available birth years
are observed source data.

Points, attack, defence, clean sheets, control, resilience, consistency, and
away performance inform position-weighted club-role quality. Broad source roles
are deterministically mapped to formation positions. Available age and matched
height facts affect appropriate attributes and a position-specific age curve;
missing physical details are sampled from the OpenFootball Players population.
Every fine-grained position, rating, trait, and attribute remains synthetic and
non-official. The frozen manifest is never regenerated during a run. Player,
club, and competition use still requires public-product rights review.

## Draft tension

Each offer should create at least one real trade-off:

- Best individual versus scarce position.
- Best position versus a lower-rated legal position.
- Superstar versus teammate chemistry.
- Attacking quality versus defensive cover.
- Immediate strength versus preserving future flexibility.

If most rounds have an obvious answer, content generation or eligibility rules
need revision.

## Scoring dimensions

The result should visibly separate individual power from team fit.

| Dimension | Meaning |
|---|---|
| Quality | Best position rating represented by the selected player-season |
| Positioning | How close the selected slot rating is to that player's best position rating |
| Chemistry | Real teammate overlap and relevant shared experience |
| Tactical balance | Width, creation, ball-winning, pace, defensive cover, and role compatibility |
| Leadership | Captains, organizers, and experienced players |

Exact coefficients are versioned implementation data and do not need to appear
in the player UI. The categories and high-level reasons remain visible to
preserve trust, while the design documentation records the proposed formulas
for review and reproducibility.

The proposed deterministic formulas, offer-generation rules, dead-end
prevention, and initial coefficient baseline are specified in
[Phase 1A — Core mechanics engine](phases/phase-01a-core-mechanics-engine.md).
They are sufficient for a Functional MVP once they are deterministic,
versioned, bounded, and capable of producing valid results. Distribution
quality and competitive calibration are later tuning work and do not block the
first playable implementation.

## Result contract

A result should contain:

- Final XI and formation.
- Wins, draws, losses, and points.
- Overall quality and chemistry summaries.
- Strongest team characteristic.
- Most important weakness.
- Short natural-language tactical explanation.
- Seed, mode, and simulation version.
- Public result identifier for sharing.

Example:

    32W–4D–2L · 100 points

    Elite attack and midfield control, but aggressive fullbacks leave the
    defensive transition exposed.

The MVP has no decorative goal or goal-difference output because it has no
approved goal model. A season with no losses receives the **Invincible** label.
A 38-win, 114-point season receives the rarer **Perfect** label.

## Session-length target

The first playtest target is approximately **six minutes**. The full XI must
feel substantial without becoming repetitive; playtests may still compare
four- and eight-minute pacing before the target is frozen for release.
