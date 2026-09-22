# Detailed Delivery Plans

> Connected-project reference: implementation claims and source paths below refer to the connected branch, not this offline starter. See the [starter path](../12-accelbyte-integration-guide.md#offline-baseline) for the current sequence.

**Last updated:** September 3, 2026
**Status:** Functional MVP complete; Phase 2 AGS Foundation is next

These documents turn the product roadmap into an ordered delivery contract.
Each phase produces a usable increment, has explicit evidence requirements, and
must close its exit checklist before dependent work begins.

## Phase map

| Phase                           | Outcome                                                                                                                                               | Depends on                           | Detailed plan                                    |
| ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------ | ------------------------------------------------ |
| 0 — Design lock                 | Rules, content boundary, simulation contract, and architecture are implementable                                                                      | None                                 | [Phase 0](phase-00-design-lock.md)               |
| 1A — Core mechanics engine      | Deterministic offers, roster assessment, and season simulation work headlessly                                                                        | Phase 0                              | [Phase 1A](phase-01a-core-mechanics-engine.md)   |
| 1B — Local React Functional MVP | One guest draft works end to end in React and reloads from a checksummed device-local record                                                          | Phase 1A                             | [Phase 1B](phase-01-solo-vertical-slice.md)      |
| 2 — AGS foundation              | Device ID, Cloud Save, trusted replay, Statistics, and Leaderboards work                                                                              | Phase 1                              | [Phase 2](phase-02-ags-foundation.md)            |
| 3 — Sharing and daily challenge | Stable public results and one fair daily seed work                                                                                                    | Phase 2                              | [Phase 3](phase-03-sharing-and-daily.md)         |
| 4 — Friend rooms                | One to eight authenticated browsers reuse one active no-server AGS session between rounds; joinability closes during each draft and reopens at reveal | Phase 2                              | [Phase 4](phase-04-friend-rooms.md)              |
| 5 — Saved-XI competition        | A player can challenge a valid nearby ranked XI                                                                                                       | Phase 2; Phase 1 simulation contract | [Phase 5](phase-05-saved-xi-competition.md)      |
| 6 — Connected release hardening | The integrated product is secure, recoverable, deployable, and release-approved                                                                       | Phases 0–5                           | [Phase 6](phase-06-mvp-hardening-and-release.md) |

Phase 0 supporting evidence:

- [Frozen content and scoring contract](phase-00-content-contract.md)
- [Phase 0 exit review](phase-00-exit-review.md)

Phase 1A is the first code gate: React consumes mechanics only after
determinism, legality, cooldown, and completion checks pass. Competitive
calibration is a later pass and does not block the Functional MVP. Phases 3, 4,
and 5 may be developed in parallel after Phase 2 if their schema
and Statistics changes do not overlap. Phase 6 starts continuously, but it
cannot exit until both features are integrated.

## Estimation assumptions

- One developer/product owner directing agentic AI for implementation, test
  generation, documentation, code review, and bounded parallel tasks.
- One builder-day means one focused human-led working day with agents operating
  inside that workflow; it is not the sum of agent runtime or tokens.
- Calendar ranges assume five-day weeks, normal review latency, and the phase
  dependencies above. Independent research, test generation, and verification
  can overlap, but human decisions and acceptance gates remain serialized.
- Legal approval, procurement, unavailable AGS namespace access, and other
  external waiting time are excluded. Add 20–30% contingency when those inputs
  are not ready before the phase starts.
- Competitive tuning is excluded from the Functional MVP estimate.

## Phase estimates

| Phase                           | Estimated effort | Estimated elapsed time | Primary uncertainty                                                              |
| ------------------------------- | ---------------: | ---------------------: | -------------------------------------------------------------------------------- |
| 0 — Design lock                 | 1–2 builder-days |              Completed | Public-product rights are carried as a nonblocking release decision              |
| 1A — Core mechanics engine      | 2–3 builder-days |       2–3 working days | Constraint-aware continuation with cooldowns and reproducible synthetic data     |
| 1B — Functional MVP             | 2–3 builder-days |       2–3 working days | React, local identity/storage, Sites build, and complete player-flow states      |
| 2 — AGS foundation              | 4–7 builder-days |           1–1.75 weeks | IAM, Cloud Save limits, trusted replay, namespace configuration, and permissions |
| 3 — Sharing and daily challenge | 2–4 builder-days |             0.5–1 week | Result-specific HTML, image rendering, and crawler behavior                      |
| 4 — Friend rooms                | 5–8 builder-days |           1.25–2 weeks | Session events, reconnects, timeouts, host rules, and multi-browser behavior     |
| 5 — Saved-XI competition        | 4–7 builder-days |           1–1.75 weeks | Head-to-head contract, rating settlement, anti-farming, and version policy       |
| 6 — Connected release hardening | 4–7 builder-days |           1–1.75 weeks | Browser matrix, security findings, recovery rehearsal, and release sign-off      |

The Functional MVP totals **5–8 builder-days** and approximately **1–1.5
calendar weeks**. The connected phases add **19–33 builder-days** and roughly
**3.75–6.75 calendar weeks**. The full path is therefore approximately **24–41
builder-days** or **5–9 calendar weeks**, excluding external waiting time and
later competitive tuning.

### Under-two-week Functional MVP schedule

| Working day | Target                                                                                                          |
| ----------- | --------------------------------------------------------------------------------------------------------------- |
| 1           | Freeze the narrow scope, schemas, fixture content, and synthetic-data generator                                 |
| 2–3         | Implement deterministic RNG, offers, deck removal, cooldowns, and completion checks                             |
| 4–5         | Implement assessment, season simulation, explanations, golden tests, and automated completion runs              |
| 6–7         | Build the React draft and result flow with visible ratings and basic responsive behavior                        |
| 8           | Add local guest identity, checksummed save/readback, run end-to-end checks, and prepare the ChatGPT Sites build |

To protect this schedule, the Functional MVP contains one random solo mode,
one formation, stored synthetic content, functional presentation, and a narrow
browser target. The validated OpenFootball 2023/24 named-squad catalogue is
active for mechanics work; replacement club identifiers preserve the schedule if third-party rights are
not approved. AGS identity/Cloud Save/Statistics/Leaderboards, daily/share flows, friend rooms, Saved-XI competition,
competitive tuning, broad browser QA, and production polish remain outside the
eight-day target.

## Completion language

- **Implemented:** code and configuration exist, but the intended path has not
  passed its full acceptance test.
- **Smoke-verified:** a service or API path works without proving the complete
  player experience.
- **Game-flow integrated:** the visible player path is wired, but the final
  requested state has not been fully verified.
- **Complete:** the intended player path, service evidence, error handling, and
  phase acceptance tests all pass in the target environment.

For AGS-backed work, use the stricter AGS meanings of smoke-verified,
game-flow integrated, and complete. A successful SDK call alone never closes a
player-facing phase.

## Rules that apply to every phase

1. Preserve simulation and content version identifiers in every stored result.
2. Keep domain rules outside React components and rendering code.
3. Treat Phase 1B records as player-authored until trusted replay exists.
4. Use a checksummed local record in Phase 1B; move rich records to AGS Cloud Save in Phase 2 and reserve Statistics for trusted numeric integrations.
5. Do not expose AGS confidential credentials or hosting secrets to the browser.
6. Add loading, empty, success, recoverable-error, and terminal-error UI where
   those states can occur.
7. Add unit, contract, integration, and player-flow evidence in proportion to
   the change.
8. Update the focused design document and decision register when a phase closes
   an open question.
9. Do not silently add deferred scope such as Phaser, AGS Matchmaking, AMS,
   Analytics, Achievements, Store, Entitlements, or voice chat.

## Phase completion packet

Every phase closes with a short evidence record containing:

- implemented scope and intentionally deferred scope;
- files, migrations, environment configuration, and AGS resources changed;
- automated test results;
- manual/browser evidence;
- security or authorization evidence when applicable;
- known limitations and follow-up work;
- rollback or recovery notes;
- explicit phase status.

## Functional MVP definition of done

The Functional MVP is complete when Phases 0, 1A, and 1B demonstrate:

```text
Open app
  -> obtain or restore a random local guest profile
  -> complete one deterministic random draft
  -> see legal positions and ratings on every offered card
  -> save and reload a checksummed, explainable, reproducible 38-match result on the same device
```

## Connected release target

Phases 2–6 extend the proven game into the complete connected journey:

```text
Open app
  -> continue as guest
  -> complete an authoritative random or daily draft
  -> view and share a stable result
  -> see the trusted statistic and leaderboard position
  -> create or join a friend room and compare results
  -> challenge a valid nearby saved XI
  -> recover cleanly from expected errors
```

Connected production approval also requires a deliberate decision on Device ID account
loss. Either ship a verified account-upgrade/linking path or explicitly accept
and communicate the risk.
