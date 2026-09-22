# Football 11 Design Documents

**Last updated:** September 22, 2026
**Status:** Active development

This directory contains the game design, implementation plans, and verification
evidence for Football 11.

## Document map

| Document                                                                | Purpose                                                             |
| ----------------------------------------------------------------------- | ------------------------------------------------------------------- |
| [01 — Product brief](01-product-brief.md)                               | Product thesis, audience, goals, and success signals                |
| [02 — Game design](02-game-design.md)                                   | Core loop, draft rules, formation, scoring, and results             |
| [03 — Game modes](03-game-modes.md)                                     | Random, daily, friends, and leaderboard-opponent modes              |
| [04 — Technical architecture](04-technical-architecture.md)             | Frontend, backend, authority boundaries, and deployment             |
| [05 — AGS-first responsibility map](05-ags-and-cloudflare.md)           | Sites hosting, AGS storage, and deferred trusted-service boundaries |
| [06 — Data and simulation](06-data-and-simulation.md)                   | Domain entities, stored records, determinism, and validation        |
| [07 — MVP roadmap](07-mvp-roadmap.md)                                   | Scope, phases, acceptance criteria, and deferred work               |
| [08 — Content, legal, and risks](08-content-legal-and-risks.md)         | Content strategy, licensing constraints, and product risks          |
| [09 — Decisions and open questions](09-decisions-and-open-questions.md) | Decision log, assumptions, and unresolved choices                   |
| [10 — Progress tracker](10-progress-tracker.md)                         | Per-phase items, status, evidence, blockers, and next action        |
| [11 — GitHub Pages deployment](11-github-pages.md) | Build and publish the frontend with the Sites backend |
| [12 — AGS and AI-plugin tutorial](12-accelbyte-integration-guide.md)   | Explicit signup, plugin installation, MCP sign-in, and copy-ready integration prompts |
| [AGS service references](12-accelbyte-integration-guide.md#implementation-reference)              | Supporting implementation detail for login, storage, configuration, backend, ranking, sessions, and verification |

## Detailed delivery plans

| Plan                                                                                  | Purpose                                                                                                                              |
| ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| [Detailed phase index](phases/README.md)                                              | Functional MVP boundary and ordered connected-release phases                                                                         |
| [Phase 0 — Design lock](phases/phase-00-design-lock.md)                               | Rules, content, simulation, and architecture gates                                                                                   |
| [Phase 0 — Content contract](phases/phase-00-content-contract.md)                     | Frozen schema, position mapping, scoring configuration, and golden rosters                                                           |
| [Phase 0 — Exit review](phases/phase-00-exit-review.md)                               | Evidence and formal handoff into Phase 1A                                                                                            |
| [Phase 1A — Core mechanics engine](phases/phase-01a-core-mechanics-engine.md)         | Deterministic offers, dead-end prevention, assessment, simulation, and balance analysis                                              |
| [Phase 1B — Local React Functional MVP](phases/phase-01-solo-vertical-slice.md)       | React, local guest identity, checksummed replay storage, and Sites-ready build                                                       |
| [Phase 2 — AGS foundation](phases/phase-02-ags-foundation.md)                         | Device ID, Cloud Save, trusted replay, Statistics, and Leaderboards                                                                  |
| [Phase 3 — Sharing and daily](phases/phase-03-sharing-and-daily.md)                   | Daily lifecycle, public results, share assets, and synced history                                                                    |
| [Phase 4 — Friend rooms](phases/phase-04-friend-rooms.md)                             | Discoverable AGS Session room with draft-time join closure, optional direct-join code, repeated rounds, and multi-browser comparison |
| [Phase 5 — Saved-XI competition](phases/phase-05-saved-xi-competition.md)             | Leaderboard-driven opponent discovery and settlement without Matchmaking                                                             |
| [Phase 6 — Connected release hardening](phases/phase-06-mvp-hardening-and-release.md) | Security, recovery, QA, operations, deployment, and final connected-release gate                                                     |
| [AGS plan — Device ID guest login](12-accelbyte-integration-guide.md#stage-1)           | Approval-gated first AGS integration slice                                                                                           |
| [AGS evidence — Friend room Session](12-accelbyte-integration-guide.md#stage-5)     | Approved Phase 4 contract, implementation boundary, live service probe, and multi-browser evidence                                   |

## Prepared prototype data

The active reproducible catalogue and regeneration instructions are in
[Football 11 Prototype Data](../data/README.md). The public-domain OpenFootball
Premier League 2023/24 named-squad manifest is used by the app, fixtures, and
analysis. Cards use observed 2023/24 player names and squad membership, with
inferred formation positions and synthetic ratings; club/competition rights and
final football curation remain open.

## Status language

- **Confirmed:** agreed and treated as the current source of truth.
- **Proposed:** recommended direction that still needs validation.
- **Open:** unresolved and should not be silently assumed.
- **Deferred:** intentionally outside the first MVP.

## Maintenance rules

1. Update the focused document first; do not turn this index into a second specification.
2. Record material changes in the decision log.
3. Keep product rules separate from implementation details.
4. Treat replay and persistence contracts as versioned interfaces; do not call
   player-authored MVP records authoritative.
5. Do not mark a feature complete until its acceptance criteria are verified.

Detailed [agent integration plans](ags-plans/README.md) provide the implementation
contract for each tutorial stage.
