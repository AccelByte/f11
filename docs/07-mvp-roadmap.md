# MVP Roadmap

> Connected-project reference: implementation claims and source paths below refer to the connected branch, not this offline starter. See the [starter path](12-accelbyte-integration-guide.md#offline-baseline) for the current sequence.

**Last updated:** September 4, 2026
**Status:** Functional MVP complete; Phase 2 AGS Foundation is next

## Functional MVP outcome

A player can open the web app, complete one eleven-player random draft, see the
position ratings used for every choice, and receive an explainable,
reproducible 38-match season result. A random local profile and checksummed
browser record preserve the latest run on that device. This milestone ends at
Phase 1B and proves the game before any online-service dependency.

## Functional MVP scope

- Football only.
- One formation.
- OpenFootball Premier League 2023/24 results and named squad tables as the
  active public-domain foundation; player, club, and competition rights remain
  under review.
- Versioned, deterministic synthetic ratings and gameplay attributes.
- Club and era constraints.
- Up to fifteen offers per round, configurable down to three.
- Up to five run-wide rerolls, configurable down to zero.
- Visible legal positions and position-specific ratings on offer cards.
- A two-round cooldown for every passed-over card.
- Deterministic challenge generation.
- Browser-executed deterministic validation and simulation, clearly labelled
  player-authoritative.
- Random challenge.
- Random local guest identity and checksummed latest-result persistence.
- ChatGPT Sites-compatible static product build.

Catalogue size starts from formation coverage and viable-offer needs; 60–80
cards is a planning estimate rather than an MVP acceptance requirement.

## Connected release scope after the Functional MVP

- AGS IAM Device ID identity and Cloud Save game-data persistence.
- AGS Statistics and Leaderboards.
- Trusted replay/validation through the Sites managed server runtime first, with
  AGS Extend retained as an evidence-based alternative.
- Daily challenges and shareable public results.
- Discoverable AGS friend rooms with controlled between-round joinability and
  optional native session join codes.
- Saved-XI asynchronous competition.
- Production hardening for the integrated journey.

## Work estimate

Assuming one developer/product owner directing agentic AI for implementation,
tests, documentation, review, and bounded parallel work:

| Phase                           |           Effort |     Elapsed time |
| ------------------------------- | ---------------: | ---------------: |
| 0 — Design lock                 | 1–2 builder-days |    0.25–0.5 week |
| 1A — Core mechanics engine      | 2–3 builder-days | 2–3 working days |
| 1B — Functional MVP             | 2–3 builder-days | 2–3 working days |
| 2 — AGS foundation              | 4–7 builder-days |     1–1.75 weeks |
| 3 — Sharing and daily           | 2–4 builder-days |       0.5–1 week |
| 4 — Friend rooms                | 5–8 builder-days |     1.25–2 weeks |
| 5 — Saved-XI competition        | 4–7 builder-days |     1–1.75 weeks |
| 6 — Connected release hardening | 4–7 builder-days |     1–1.75 weeks |

Functional MVP: **5–8 builder-days / 1–1.5 calendar weeks**. Full connected
path: **24–41 builder-days / 5–9 calendar weeks**. A builder-day is one
human-led day with agentic implementation, test, documentation, and review
work. Estimates include normal iteration;
they exclude external legal/procurement waits and competitive balance tuning.
Add 20–30% contingency when the data source, rights position, AGS environment,
or required permissions are not ready at phase entry.

The eight-day target is protected by shipping one random solo mode, one
formation, stored synthetic content, local identity plus checksummed persistence, functional
visual polish, and a narrow browser target. The prepared OpenFootball-derived
manifest removes the data-pipeline discovery dependency, but final curation and third-party
rights remain outside the mechanics-critical path. If those rights are not
approved by implementation start, the engine uses the same schema with
placeholder identities and swaps content through a later version. Daily and
sharing, trusted competition, friend rooms, Saved-XI competition, tuning, and broad
release hardening remain outside the Functional MVP.

## Explicitly deferred

- Phaser.
- Native iOS and Android packaging.
- Multiple formations.
- Substitutes, managers, injuries, transfers, and live squads.
- AGS Matchmaking and AMS.
- Application-owned Cloudflare Worker and D1.
- Analytics, Achievements, Store, and Entitlements.
- Monetization.
- Voice chat.
- Real player photos and official club logos until licensing is resolved.

## Phase 0 — Design lock

**State:** Complete for Phase 1A. Public-content rights remain a nonblocking
release decision.

- Confirm the working title and product objective.
- Finalize 4-3-3 slot definitions and eligibility rules.
- Define player-season schema.
- Define scoring categories and explanation vocabulary.
- Evaluate and activate the prepared OpenFootball 2023/24 named-squad
  catalogue; retain source provenance, distinguish observed from synthetic
  fields, and keep independent player/club/competition rights as a release gate.
- Build a small correctness fixture set; record calibration observations for
  later tuning.

Detailed design: [Phase 0 — Design lock](phases/phase-00-design-lock.md).

**Exit criterion:** a paper or data-driven draft can be completed and scored
without UI-specific assumptions.

Evidence: [Phase 0 content contract](phases/phase-00-content-contract.md) and
[Phase 0 exit review](phases/phase-00-exit-review.md).

## Phase 1 — Core mechanics and solo vertical slice

### Phase 1A — Headless core mechanics

- Implement a versioned deterministic random source; never use `Math.random()`
  in mechanics.
- Implement club/era constraint selection and challenge-capped offer generation.
- Reject duplicate identities and impossible placements.
- Use forward-feasibility matching so every offered placement leaves a path to
  a complete XI.
- Implement deterministic rerolls that replace both the club/era constraint
  and its visible players.
- Calculate Quality, Positioning, Chemistry, Tactical balance, and Leadership.
- Derive attack, defence, and control ratings.
- Simulate a deterministic 38-match abstract league season.
- Generate explanations from retained calculation facts.
- Run golden and invariant tests plus 10,000 seeded completion checks.
- Emit distribution reports for later tuning without making balance approval a
  UI-integration gate.

Detailed design:
[Phase 1A — Core mechanics engine](phases/phase-01a-core-mechanics-engine.md).

**Exit criterion:** the headless engine completes and reproduces thousands of
seeded drafts without an illegal offer or dead end and always produces bounded,
valid results. Distribution observations are recorded but do not require
balance approval before UI integration.

### Phase 1B — Local React Functional MVP

- Build React draft flow.
- Integrate the approved core-mechanics package without duplicating rules.
- Add a random local guest identity behind a web adapter.
- Store the replayable run/result contract locally and checksum-verify readback.
- Render final XI, record, and explanation.
- Produce a ChatGPT Sites-compatible build; deployment remains user-triggered.

Detailed design:
[Phase 1B — Solo vertical slice](phases/phase-01-solo-vertical-slice.md).

**Exit criterion:** one full run works from guest entry through a saved,
reloadable, reproducible result. This closes the Functional MVP; trusted
competitive authority remains later.

## Connected release phases

Phases 2–6 build on the Functional MVP. They remain designed work, but they are
not required to prove that the core game works.

## Phase 2 — AGS foundation

- Complete Slice 2A: React guest identity through AGS IAM Device ID login.
- Complete Slice 2B: rich run/result persistence through AGS Cloud Save.
- Complete Slice 2C: trusted replay and authenticated user binding through the
  Sites managed server runtime unless verification favors AGS Extend.
- Complete Slice 2D: server-authoritative statistic configuration and update.
- Complete Slice 2E: player-facing leaderboard query and presentation.

Detailed design:
[Phase 2 — AGS foundation](phases/phase-02-ags-foundation.md).
The first approval-gated integration plan is
[Device ID guest login](12-accelbyte-integration-guide.md#stage-1).

**Exit criterion:** an authenticated completed run updates a statistic and
appears in the intended leaderboard through the visible game flow.

## Phase 3 — Sharing and daily challenge

- Add daily seed lifecycle after the AGS identity and trust foundation exists.
- Add public result route.
- Generate landscape Open Graph preview.
- Add vertical share-card output.
- Add synced result history with a bounded local cache.

Detailed design:
[Phase 3 — Sharing and daily challenge](phases/phase-03-sharing-and-daily.md).

**Exit criterion:** a trusted daily result can be reopened and shared at a stable
public URL with correct result-specific metadata.

## Phase 4 — Friend rooms

**Current state:** the development create/discover/join/start/draft/reveal/replay
loop is implemented and live-verified with three isolated browser origins. The
remaining exit work is trusted server/replay authority plus visible abandon,
deadline-timeout, and host-loss cases.

- Create a no-server AGS game session with a configurable 1-player minimum and
  an initial configurable maximum of 8. Reuse the same active session across rounds;
  the AGS template remains nonpersistent because persistence applies only to DS.
- Browse compatible non-full rooms and join by session ID.
- Retrieve, display, join with, and revoke an optional native session join code.
- Show room membership, readiness, and next-round opt-in state.
- Change joinability to `CLOSED` before locking one participant set, publish one
  round base seed, and derive deterministic per-player draft streams before reopening
  at reveal.
- Show trusted progress and comparison results, then count down into another
  round without closing the AGS session.
- Handle leave, reconnect, timeout, and host behavior.

Detailed design: [Phase 4 — AGS friend rooms](phases/phase-04-friend-rooms.md).

**Exit criterion:** one to eight browser clients create, discover, or join one
active room during an open window, cannot join an active draft, complete and
compare a trusted per-player deterministic round through the intended room UI, and
automatically advance to a fresh round in the same AGS session.

## Phase 5 — Saved-XI opponent discovery

- Save one eligible XI per player or define the replacement policy.
- Query nearby leaderboard entries.
- Filter and select an opponent through the trusted application boundary connected
  to AGS.
- Resolve and store the asynchronous matchup.
- Update the approved competitive statistic.
- Add rematch and version-safety rules.

Detailed design:
[Phase 5 — Saved-XI competition](phases/phase-05-saved-xi-competition.md).

**Exit criterion:** a player can challenge a valid nearby XI and receive a
reproducible result without an AGS matchmaking ticket.

## Phase 6 — Connected release hardening

- Freeze release content, rules, and simulation versions.
- Verify secrets, authorization, abuse protection, and privacy boundaries.
- Rehearse Cloud Save schema/version recovery, settlement repair, and rollback.
- Run the complete clean-browser player journey across the supported matrix.
- Complete accessibility, responsive, performance, and resilience checks.
- Prepare operational signals and failure runbooks.
- Resolve the production Device ID account-loss policy.
- Deploy and approve a production-like release candidate.

Detailed design:
[Phase 6 — Connected release hardening](phases/phase-06-mvp-hardening-and-release.md).

**Exit criterion:** the release candidate passes the complete player journey,
service evidence, security, recovery, accessibility, performance, content, and
operational gates with no unresolved go/no-go blocker.

## Verification strategy

- Unit tests for eligibility, rerolls, scoring, and seeded generation.
- Golden fixtures for known teams and expected explanation facts.
- Contract tests between browser and Worker.
- Replay tests proving stored runs reproduce.
- Multi-browser tests for AGS room create, join-by-code, progress, and results.
- Visual checks at mobile and desktop widths.
- Social-preview checks for Discord, WhatsApp, X, and Slack metadata.
- Abuse tests for modified selections, replayed submissions, and rating farming.
