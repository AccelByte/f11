# Football 11 Prototype Data

## Active source

The active catalogue uses the complete 2023/24 English Premier League results
and all 20 club squad tables from OpenFootball England, plus player-profile
matches from OpenFootball Players. Both repositories describe their data as
free and public domain. The exact input revisions are pinned in the generated
manifest and adapter:

```text
data/content/openfootball-pl-2023-24-named-squads-v2.json
```

The source contains 380 results and 1,041 named squad entries across 20 clubs.
Player name, club membership, shirt number, broad position, and 1,011 birth
years are observed. OpenFootball Players supplies an unambiguous height match
for 538 entries; missing heights and 30 missing birth years use deterministic
position-population models. The source has no player appearances or event
statistics, so those remain zero rather than being invented.

## Rating model

The adapter derives percentile indices within each season from points, goals
for, goals against, clean sheets, goal difference, second-half goal difference,
home/away results, and match-to-match consistency. It applies position-specific
weights: forwards and wingers emphasize attack, defenders and goalkeepers
emphasize defence and clean sheets, and midfielders blend control with attack or
defence according to role.

The observed `GK`, `DF`, `MF`, and `FW` values are deterministically mapped to
playable sub-positions. Age affects pace, leadership, and distance from a
position-specific peak; height affects aerial presence. Position templates,
club-season indices, and small seeded variation then produce attributes and raw
ratings. Primary raw ratings are a 55/45 blend of club-role quality and relevant
attributes, with an age-curve penalty; secondary positions receive a four-point
step-down. A monotonic, piecewise-linear calibration then preserves the 55-point
floor and middle of the pool while stretching the strongest modeled cards into
a scarce 90–94 elite band.

In the frozen v2 catalogue, the median best-position rating is 72, the 95th
percentile is 86, 14 of 1,041 players (1.34%) reach 90 or higher, and the maximum
is 94. Automated generation tests freeze those distribution gates. The curve
improves game differentiation; it does not add player-performance evidence or
turn these values into real-world scouting claims.

The catalogue conforms to `football11-player-catalogue-v1`. The
`observedStatsBombPositions` field is a legacy v1 property name; OpenFootball
cards label the observed squad position explicitly.

## Public-domain notice and remaining rights

- OpenFootball England: <https://github.com/openfootball/england>
- Pinned England revision: <https://github.com/openfootball/england/tree/0690446f794fde748ea4b994244def699c6a65b2>
- OpenFootball Players: <https://github.com/openfootball/players>
- Pinned Players revision: <https://github.com/openfootball/players/tree/125d20f7cc06cac7e758b40df535a7695632680a>
- CC0 1.0 summary: <https://creativecommons.org/publicdomain/zero/1.0/>

Public-domain data status does not independently settle player publicity rights
or grant rights to league or club names, crests, kits, or other marks. A public
release using real player identities and club/competition identifiers still
needs explicit legal review.

`football-data.org` remains unsuitable as a checked-in free source: its API is
subscription-bound, its published free service is non-commercial, and its terms
restrict continued use after cancellation.

## Rebuild

From the repository root, clone and check out the two pinned inputs in the
ignored cache, then regenerate and validate:

```powershell
git clone https://github.com/openfootball/england.git .cache/openfootball-england
git -C .cache/openfootball-england checkout 0690446f794fde748ea4b994244def699c6a65b2
git clone https://github.com/openfootball/players.git .cache/openfootball-players
git -C .cache/openfootball-players checkout 125d20f7cc06cac7e758b40df535a7695632680a
python tools/openfootball/prepare_openfootball.py
python -m unittest discover -s tools/openfootball -p "test_*.py" -v
python tools/catalogue/validate_catalogue.py
python tools/phase0/prepare_phase0_fixtures.py
python -m unittest discover -s tools/phase0 -p "test_*.py" -v
```

The output has no generation timestamp, is sorted deterministically, and stores
the source revisions, generator version, seed, public-domain notice, disclaimer,
and SHA-256 player hash. Re-running the pinned inputs reproduces it byte for
byte.

## Phase 0 contract and fixtures

- `schema/player-catalogue-v1.schema.json` — machine-readable catalogue shape.
- `config/assessment-v1.json` — formation, chemistry, tactical, composite, and
  team-unit coefficients.
- `config/league-profile-v1.json` — nineteen abstract opponents played home and
  away.
- `fixtures/phase-00-golden-rosters-v1.json` — three valid reference XIs and one
  duplicate-identity rejection case.
- `fixtures/phase-00-draft-cases-v1.json` — selection, cooldown, reroll, and
  forward-feasibility cases.
- `fixtures/phase-00-match-cases-v1.json` — match delta and probability vectors.

The v2 rating-only revision preserves every v1 player identity, club, era, and
legal position. A refreshed 10,000/10,000 complete-draft analysis found no dead
ends and exposed every card at least once. Each offer groups one 2023/24 club
squad under the `2020s` era constraint.

Offer presentation is configured by the server-owned AGS Game Record
`football11_game_config_v1`. Sites validates and freezes its active revision in
every new challenge; the domain accepts 3–15 offers and 0–5 rerolls, while
revision `1` uses 15 and 5. Browser generation and trusted replay consume the
same challenge snapshot, and no draft-limit environment variables remain.

## Current limitations

- Names and club squads are real 2023/24 records, but exact formation positions
  are inferred from broad source positions.
- Missing birth years and heights are modeled; appearances remain unavailable;
  all attributes and ratings are synthetic.
- Club results are the only performance evidence; there are no player events,
  minutes, goals, assists, or defensive actions in the selected inputs.
- The catalogue materially increases the browser bundle and currently triggers
  the build's large-chunk warning; catalogue loading/code-splitting is a follow-up.
- Competitive records created under the retired content version must not share
  a leaderboard with this differently calibrated catalogue without an explicit
  migration or new-board decision.
