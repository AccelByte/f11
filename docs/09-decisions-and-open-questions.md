# Decisions and Open Questions

> Connected-project reference: implementation claims and source paths below refer to the connected branch, not this offline starter. See the [starter path](12-accelbyte-integration-guide.md#offline-baseline) for the current sequence.

**Last updated:** September 4, 2026
**Status:** Living decision register

## Confirmed decisions

| Date       | Decision                                                                                                         | Rationale                                                                                                                                                                                                        |
| ---------- | ---------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-09-02 | Build for football, not esports                                                                                  | Aligns with the intended all-time starting-XI fantasy                                                                                                                                                            |
| 2026-09-02 | Preserve a full eleven-player draft                                                                              | The formation is central to the result and sharing fantasy                                                                                                                                                       |
| 2026-09-02 | Launch web-first                                                                                                 | Direct shared-link entry and one deployable client                                                                                                                                                               |
| 2026-09-02 | Use React-first for the MVP                                                                                      | The game is primarily cards, choices, formation UI, and reveals                                                                                                                                                  |
| 2026-09-02 | Keep simulation state outside rendering components                                                               | Enables deterministic tests and later presentation changes                                                                                                                                                       |
| 2026-09-02 | Host the Functional MVP React build with ChatGPT Sites                                                           | Avoid application-owned hosting infrastructure during “it works” validation                                                                                                                                      |
| 2026-09-02 | Defer application-owned Cloudflare Worker and D1 work                                                            | Remove a backend and migration dependency from the Functional MVP                                                                                                                                                |
| 2026-09-02 | Keep Phase 1B local and defer AGS until after the Functional MVP                                                 | Prove “it works” without credentials or network dependencies; preserve adapter boundaries for IAM and Cloud Save                                                                                                 |
| 2026-09-03 | Make AGS Foundation Phase 2 and move sharing/daily to Phase 3                                                    | Supersedes the original Phase 3 numbering: the core mechanics and local Functional MVP are proven, so establish identity, persistence, trust, Statistics, and Leaderboards before connected sharing              |
| 2026-09-04 | Retire durable local run saves after Cloud Save integration                                                      | AGS Cloud Save is the sole durable latest-result store; the browser keeps only an in-memory submission envelope, and each newly completed run replaces the prior cloud latest value after verified readback       |
| 2026-09-02 | Use AGS for identity, sessions, statistics, and leaderboards                                                     | Avoid rebuilding native game-backend capabilities                                                                                                                                                                |
| 2026-09-03 | Use discoverable AGS sessions with controlled joinability; keep native session codes optional                    | Sessions are `OPEN` for browsing/joining while waiting, revealed, or counting down, `CLOSED` while starting/drafting, and reopened at reveal; join-by-ID remains primary while codes are a secondary direct path |
| 2026-09-02 | Friends draft simultaneously in one live room                                                                    | Creates shared presence while preserving independent decisions                                                                                                                                                   |
| 2026-09-03 | Create and start friend rooms with one member; configure the maximum at 8 initially                              | A creator can establish or play in a room before others join, while the cap remains tunable                                                                                                                      |
| 2026-09-03 | Keep one AGS session across repeated friend-room rounds                                                          | Result reveal starts a configurable countdown, then locks a fresh participant set, challenge ordinal, and seed instead of closing the room; 30 seconds is the proposed initial value for playtesting             |
| 2026-09-02 | Treat leaderboard opponents as asynchronous discovery                                                            | No matchmaking ticket, session allocation, or dedicated server needed                                                                                                                                            |
| 2026-09-03 | Use a neutral symmetric `head-to-head-v1` match for Saved-XI challenges                                          | Equal attack/defence duel weights plus a smaller control weight make role reversal auditable; canonical Saved-XI ordering preserves deterministic results                                                        |
| 2026-09-03 | Start with challenger-only Challenge Score instead of two-sided Elo                                              | Win/draw/loss applies `+3/0/-2` with a zero floor while the opponent remains unchanged, avoiding offline rating loss and two-player settlement in the first competitive slice                                    |
| 2026-09-04 | Publish a Saved XI only through an explicit trusted personal-best action                                      | Ordinary completions cannot silently replace a player's asynchronous opponent; a later eligible personal best can be chosen deliberately                                                                        |
| 2026-09-04 | Use ten-minute single-use challenge tokens and a 24-hour same-opponent cooldown                               | Short-lived opaque authority prevents client-selected evidence and replay, while the cooldown encourages varied nearby opponents                                                                                |
| 2026-09-04 | Keep Phase 5 history immutable, bounded, and repairable                                                        | A consumed challenge can be settled exactly once after interruption without duplicating the match or applying its score delta twice                                                                             |
| 2026-09-02 | Exclude Analytics, Achievements, Store, and Entitlements from MVP                                                | Reduce initial integration surface                                                                                                                                                                               |
| 2026-09-02 | Label Functional MVP results player-authoritative                                                                | Determinism supports replay, but a browser-only calculation is not tamper-proof                                                                                                                                  |
| 2026-09-03 | Require a trusted service before ranked competition                                                              | Evaluate the existing Sites managed server runtime first; use AGS Extend only for a verified AGS-integration advantage, and a separately provisioned Worker only for a demonstrated runtime gap                  |
| 2026-09-02 | Use one 4-3-3 with `GK`, `LB`, two `CB`, `RB`, `DM`, `CM`, `AM`, `LW`, `CF`, and `RW`                            | Keeps the first formation explicit and auditable                                                                                                                                                                 |
| 2026-09-02 | Store legal position ratings on each player-season record                                                        | Player eligibility and strength come from football data rather than generic placement labels                                                                                                                     |
| 2026-09-02 | Use `CF` as the centre-forward code; keep `FW` only as a broad tag                                               | Prevents category labels from becoming ambiguous formation slots                                                                                                                                                 |
| 2026-09-02 | Allow one player-season card per real player identity in MVP content                                             | Enforces no duplicates while deferring multi-season identity removal                                                                                                                                             |
| 2026-09-02 | Remove a selected card from that run's virtual deck                                                              | A chosen player cannot be offered again in the same run                                                                                                                                                          |
| 2026-09-02 | Test a six-minute draft target first                                                                             | Balances eleven meaningful choices with browser-session pacing                                                                                                                                                   |
| 2026-09-02 | Rank only the first authoritative daily completion                                                               | Later replays remain practice rather than score fishing                                                                                                                                                          |
| 2026-09-02 | Use Invincible for zero losses and Perfect for 38 wins / 114 points                                              | Separates an undefeated season from the literal maximum record                                                                                                                                                   |
| 2026-09-02 | Exclude goals and goal difference from MVP results                                                               | No credible versioned goal model exists yet                                                                                                                                                                      |
| 2026-09-02 | Keep rerolled cards out of the same-round replacement, then apply the normal two-round cooldown                  | Preserves reroll value and prevents immediate later repetition                                                                                                                                                   |
| 2026-09-02 | Show legal positions and their ratings on every offer card                                                       | Players should see the exact data used for placement decisions                                                                                                                                                   |
| 2026-09-02 | Give every passed-over card a two-round cooldown                                                                 | Avoids immediate repetition while allowing unselected cards to return later                                                                                                                                      |
| 2026-09-02 | Define Phase 1B as a local Functional MVP boundary                                                               | Proves the standalone game works before online features expand scope                                                                                                                                             |
| 2026-09-02 | Defer competitive balance tuning until after the Functional MVP                                                  | Correctness and reproducibility block implementation; calibration does not                                                                                                                                       |
| 2026-09-02 | Prepare StatsBomb Open Data Premier League 2015/16 as the first prototype data candidate (superseded 2026-09-03) | Historical bootstrap decision; later Wyscout content was itself superseded by OpenFootball on 2026-09-04                                                                                                         |
| 2026-09-02 | Treat StatsBomb as metadata provenance, not the source of Football 11 ratings (superseded 2026-09-03)            | Historical constraint; the retired catalogue and importer are no longer active                                                                                                                                   |
| 2026-09-02 | Use the full validated 550-player StatsBomb candidate for Phase 1A (superseded 2026-09-03)                       | Historical mechanics baseline was replaced by Wyscout and then OpenFootball                                                                                                                                      |
| 2026-09-02 | Accept the documented StatsBomb-to-Football-11 position mapping (superseded 2026-09-03)                          | Historical mapping; the active OpenFootball catalogue uses fictional role cards                                                                                                                                  |
| 2026-09-03 | Prepare the Wyscout PL 2017/18 CC BY 4.0 dataset (superseded 2026-09-04)                                        | Historical licensed candidate; its catalogue and importer were retired when the five-season OpenFootball source became active                                                                                    |
| 2026-09-03 | Promote Wyscout/Figshare PL 2017/18 (superseded 2026-09-04)                                                     | Historical application content version replaced by `openfootball-premier-league-2020-2025-club-role-v1`                                                                                                         |
| 2026-09-04 | Use five complete OpenFootball EPL seasons, 2020/21–2024/25                                                       | The public-domain result source provides 1,900 matches and 27 clubs while keeping the starter scope bounded                                                                                                       |
| 2026-09-04 | Represent content as fictional club-season role cards                                                             | OpenFootball lacks complete five-season player evidence; observed club results can support club strength, while all individual fields remain explicitly synthetic                                                |
| 2026-09-04 | Group draft constraints by club and `2020s` era                                                                    | Individual cards retain season provenance, while a shared era gives all 27 club profiles enough positional depth for bounded offers and 10,000/10,000 complete drafts                                            |
| 2026-09-04 | Replace the five-season fictional pool with named 2023/24 squads                                                   | This is the only selected OpenFootball Premier League season with all 20 club squad tables. Preserve observed identities and broad roles, infer formation positions, and keep ratings explicitly synthetic.       |
| 2026-09-04 | Make offer and reroll limits deployment-configurable                                                              | Defaults are 15 visible safe cards and 5 run-wide rerolls; validated environment bounds are 3–15 and 0–5, and trusted replay uses the same server configuration                                                  |
| 2026-09-04 | Make rerolls replace the team constraint as well as the visible players                                         | `rules-v2` deterministically excludes the current club/era, requires a different team with at least three safe cards, and preserves the reroll when none is available                                           |
| 2026-09-03 | Keep football-data.org out of the checked-in catalogue                                                           | Its subscription terms are application-bound and post-cancellation restrictive; free access is stated as non-commercial                                                                                          |
| 2026-09-02 | Freeze `assessment-v1` and `league-profile-v1` as mechanics inputs                                               | Phase 1A needs exact configuration and reference outputs; competitive tuning remains later                                                                                                                       |
| 2026-09-02 | Keep the Functional MVP as a React DOM interface without Phaser                                                  | Cards, formation placement, and result screens do not need a continuous canvas runtime                                                                                                                           |
| 2026-09-02 | Use npm workspaces with separate web, domain, contract, content, and fixture packages                            | Preserves simulation/render/storage boundaries and matches the one-developer agentic workflow                                                                                                                    |
| 2026-09-02 | Treat Phase 0 as complete for Phase 1A while carrying public-content rights separately                           | The rights decision does not block private mechanics work because replacement identities preserve the schema                                                                                                     |

## Proposed decisions awaiting validation

- Use club plus era as the random offer constraint.
- Use the prepared OpenFootball Premier League 2023/24 named-squad pool
  for prototype evaluation, subject to football curation and club/competition rights review.
- Generate synthetic ratings and gameplay attributes once, deterministically,
  and store them in a versioned manifest.
- Treat 60–80 records only as a possible later release-curation estimate, not a
  Phase 1A or Functional MVP acceptance gate.
- Offer up to fifteen players per round, subject to the configured cap and safe availability.
- Use five visible assessment dimensions.
- Store rich player run/result records in AGS Cloud Save starting in Phase 2.
- Store only trusted aggregate competitive values in AGS Statistics.
- Avoid Durable Objects for the initial friend-room mode.
- Use the AccelByte TypeScript SDK behind an application-owned adapter rather
  than importing generated SDK types throughout React components.
- Use Device ID as a development/staging guest entry, with production gated on
  an account-upgrade/linking policy.

## Open product questions

1. What is the product name and one-line public objective?
2. Is launch Indonesia/SEA-first or global-first?
3. Does legal/product review approve real player identities and club names/marks
   for a public game, or must the release use replacement identities?
4. Which 60–80 players, if that estimate holds, form the first curated pool?
5. Are real player names acceptable for the prototype?
6. Which result metrics appear on the public share card?

## Open football-design questions

1. How much real teammate overlap should influence chemistry?
2. How are cross-era tactical differences represented?
3. How are goalkeeper quality and defensive organization represented fairly?

## Open friend-room verification questions

1. What explicit abandon, deadline-timeout, and host-loss UX should ship after the
   already verified primary loop and native leader migration?
2. Which Phase 2 trusted-handler operations will own leader/start transitions and
   replay-derived result submission for production?

## Open technical questions

1. Durable provider and UX for upgrading/linking a Device ID guest.
2. Production hardening values for the verified AGS Session template timeouts and
   code/rate/full-room limits.
3. Trusted authority and permission shape for Phase 4 leader/start mutations and
   room-result acceptance.
4. Result-image rendering technology.

## Next decisions to make

The local Functional MVP, connected Phase 2 foundation, Phase 4 development room
loop, and Phase 5 Saved-XI competition are working. The highest-leverage next
decisions are:

1. Select the trusted authority for Phase 4 leader/start transitions and
   replay-derived room-result acceptance.
2. Finish the friend-room abandon, timeout, and host-loss contract against that
   boundary.
3. Define Phase 3 daily-seed lifecycle and public-safe immutable result access.
4. Choose the production guest-upgrade and account-loss policy.
5. Resolve public-content rights and release curation.
6. Balance-test `head-to-head-v1` before treating its current calibration as a
   production competitive model.

These remain honest release gates without reopening the verified Phase 5 service
and mechanics contract.

## Saved-XI mechanics boundary

Phase 5 is implemented and verified end to end. `head-to-head-v1` provides one
neutral match, symmetric attack/defence duels, a smaller control contribution,
canonical deterministic sampling, draws, and strict version equality. Trusted
publication stores an explicit personal-best XI; nearby discovery reads the
existing season-points Leaderboard; opaque ten-minute tokens, 24-hour cooldown,
immutable history, and idempotent repair protect settlement. The private,
server-set Challenge Score changes only for the challenger by `+3/0/-2` with a
zero floor, and no Challenge Score leaderboard exists. Live two-player AGS smoke
evidence covers the connected path. Two-sided Elo remains deliberately deferred.

## Delivery decision order

The detailed Phase 0–6 plans are indexed in
[Detailed MVP delivery plans](phases/README.md). Open questions should be closed
at the phase that first depends on them:

1. Phase 0 closes the minimum football rules, content contract, simulation, and
   repository layout needed for implementation.
2. Phase 1B closes the local Functional MVP when one visible random run saves,
   reloads, and reproduces on the same device.
3. Phase 2 closes AGS environment, SDK, IAM, Cloud Save, trusted replay,
   Statistics, and Leaderboard setup one approved integration slice at a time.
4. Phase 3 closes daily replay and public share-content rules on top of that
   authenticated and trusted foundation.
5. Phase 4 closes room size, joinability, host, reconnect, timeout, and result
   visibility rules.
6. Phase 5 closes Saved-XI replacement, rating, cooldown, and version
   compatibility rules.
7. Phase 6 closes production Device ID risk, release budgets, and go/no-go
   ownership.
