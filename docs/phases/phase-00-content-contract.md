# Phase 0 Content and Scoring Contract

> Connected-project reference: implementation claims and source paths below refer to the connected branch, not this offline starter. See the [starter path](../12-accelbyte-integration-guide.md#offline-baseline) for the current sequence.

**Last updated:** September 4, 2026
**Status:** Frozen for Phase 1A implementation
**Parent:** [Phase 0 — Design lock](phase-00-design-lock.md)

## Functional MVP assumptions

- Working product name: **Football 11**.
- Working objective: build an all-time starting XI and discover whether it can
  complete a perfect 38-match season.
- Initial prototype language: English.
- Initial prototype audience: global football fans; launch geography remains a
  later go-to-market decision and does not change the mechanics contract.
- Presentation: React DOM interface with no canvas game engine in the
  Functional MVP.

## Mechanics content pool

Use the complete validated OpenFootball Premier League 2023/24 named-squad
catalogue as the active mechanics pool:

- 380 matches.
- 20 club squad tables.
- 1,041 named player cards.
- One unique observed player identity per card.

Do not reduce the mechanics pool to the earlier 60–80 planning estimate before
the Phase 1A offer analyzer has measured position scarcity, repeated offers,
constraint gaps, and reroll availability. Final release curation is a content
and rights decision, not a Phase 1A entry requirement.

## Position-role policy

The following fine-grained roles are accepted for the Functional MVP candidate.
They are inferred gameplay constructs, not observed claims about a player's
career.

| Fictional primary role | Football 11 eligibility |
|---|---|
| Goalkeeper | `GK` |
| Left back | `LB`, `LW` |
| Centre back | `CB`, `DM` |
| Right back | `RB`, `RW` |
| Holding midfielder | `DM`, `CM` |
| Central midfielder | `CM`, `DM`, `AM` |
| Attacking midfielder | `AM`, `CM` |
| Left winger | `LW`, `AM`, `CF` |
| Centre forward | `CF`, `LW`, `RW` |
| Right winger | `RW`, `AM`, `CF` |

Secondary positions receive a four-point step-down from the preceding modeled
eligibility. The role counts and shared `2020s` club constraint protect draft
feasibility. An absent canonical position is illegal; there is no generic
makeshift penalty.

## Frozen catalogue contract

The machine-readable contract is
`data/schema/player-catalogue-v1.schema.json`. The checked-in validator also
enforces cross-record rules that JSON Schema alone does not express conveniently:

- unique card, real-player identity, and source-player identifiers;
- known club references and matching content versions;
- at least one legal canonical position per player;
- integer ratings and gameplay attributes in `0..100`;
- complete v1 attribute and tactical-trait keys;
- synthetic, non-official rating provenance with matching generator and seed;
- exact player/team counts and position-coverage summary;
- a canonical SHA-256 hash of all player records.

Run:

```powershell
python tools/catalogue/validate_catalogue.py
```

## Assessment configuration

`data/config/assessment-v1.json` freezes:

- the eleven unique `4-3-3-v1` slot identifiers;
- composite weights: Quality 35%, Positioning 20%, Chemistry 20%, Tactical
  balance 20%, and Leadership 5%;
- neutral, same-season, and same-club chemistry affinities;
- sixteen weighted formation-adjacency edges;
- six tactical axes, their role weights, minimums, and contribution weights;
- leadership treatment and attack/defence/control unit weights;
- deterministic rounding policy.

All weight groups sum to `1.0`. These are mechanically frozen inputs for the
first implementation, not a claim of competitive balance. Any coefficient
change after Phase 1A golden vectors exist requires a new configuration version.

`data/config/league-profile-v1.json` freezes nineteen abstract opponents. Each
is played home and away for exactly 38 matches. These are not licensed real
clubs.

## Golden roster fixtures

`data/fixtures/phase-00-golden-rosters-v1.json` contains three valid XIs and one
invalid XI. A Python reference calculation freezes the Phase 0 expected inputs
and outputs that the Phase 1A TypeScript engine must reproduce.

| Fixture | Purpose | Composite | Quality | Positioning | Chemistry |
|---|---|---:|---:|---:|---:|
| `elite-balanced` | Highest effective slot ratings | 84.41 | 85.00 | 100.00 | 54.00 |
| `star-heavy-mispositioned` | Legal but lower-rated placements | 81.08 | 80.91 | 89.61 | 54.90 |
| `single-club-coherent` | Lower-quality single-club XI with strong affinity | 88.37 | 82.00 | 97.10 | 82.00 |
| `duplicate-identity` | Same identity in both centre-back seats | Rejected | — | — | — |

The coherent XI outperforming the raw-rating XI is intentional evidence that
team fit is not cosmetic. This is a correctness fixture, not balance approval.

`data/fixtures/phase-00-draft-cases-v1.json` freezes selected-card removal,
passed-card cooldown timing, reroll replacement exclusion, failed-reroll
resource behavior, and the forward-safe-placement requirement.

`data/fixtures/phase-00-match-cases-v1.json` freezes the match-strength delta
and normalized win/draw/loss probabilities for even, stronger, and weaker team
inputs. Phase 1A adds exact sampled 38-match outcomes after `rng-v1` exists.

Regenerate and verify:

```powershell
python tools/phase0/prepare_phase0_fixtures.py
python -m unittest discover -s tools/phase0 -p "test_*.py" -v
```

## Rights boundary

OpenFootball is the active public-domain source. Preserve repository and pinned
revision provenance. Gameplay cards must separate observed identities and broad
roles from inferred positions and synthetic, non-official ratings. Public use
of player identities and club/competition names or marks still requires
product/legal approval independent of the dataset's public-domain status.

That decision does not block Phase 1A or a private Functional MVP: the exact
schema can be populated with replacement club identifiers while preserving
mechanics and golden contract shapes.
