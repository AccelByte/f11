# Stage 6: Asynchronous Saved-XI competition

[Integration tutorial](../12-accelbyte-integration-guide.md#stage-6) · [All plans](README.md)

**Status:** Not started on the offline starter branch.

## Prerequisites

Trusted ranking and replay are complete. Server-owned result and identity binding are available.

## Implementation scope

Let players explicitly publish a compatible verified XI. Discover nearby leaderboard opponents and resolve asynchronous matches on the trusted backend using the existing head-to-head mechanics. Bind immutable snapshots to expiring single-use challenges; define cooldowns, bounded history, scoring, and retry repair before implementing them.

Keep `apps/web/src/game/session.ts` as the adapter around `packages/domain`;
preserve the existing draft, reroll, and season behavior. Inspect the actual
branch and installed SDK signatures before choosing API calls. The online
reference implementation is on public main (development master); it is not
present on the offline starter. Inspect only the relevant feature when needed.

## Acceptance checks

Only verified XIs publish; incompatible/self opponents are excluded; repeated settlement is idempotent; expiry and cooldowns hold; two-player checks prove only the intended score changes.

Run `npm run typecheck`, `npm test`, and `npm run build`. Record automated,
live-service, and browser evidence separately in the progress tracker. Missing
credentials or service access are blockers, not successful verification.

## Outside this step

Realtime matches, Elo, and silently replacing a published XI after every draft.

## Agent execution checklist

1. Read this entire plan, the repository instructions, and the current progress
   tracker. On `offline-starter` or a learner's branch, confirm prerequisite
   stages through their evidence; do not infer readiness from connected notes.
2. Inspect the current manifests, domain code, UI state, and any existing service
   adapters. Choose a narrow implementation boundary and list the files to change.
3. Use the applicable AGS skill to verify the selected namespace, caller type,
   SDK signatures, and least-privilege resource settings. Keep secrets on the
   trusted server and out of source, screenshots, and logs. If access is missing,
   record the blocker; do not substitute mock results for live verification.
4. Implement only this stage's scope and relevant design details below. Preserve
   deterministic mechanics and offline play. Do not copy the entire connected
   application or bring in later stages to make this one pass.
5. Add meaningful coverage for the new state transitions and failure cases, run
   the acceptance checks, and verify the player-visible flow in the browser.
6. Update the tracker with changed files, commands/results, redacted live evidence,
   and remaining blockers. Mark the stage Done only when its acceptance checks
   pass. Summarize what the next agent can rely on, then stop.

## Connected design reference

The following detailed design notes are recovered from the original connected
implementation plans. They explain service choices, data contracts, authority,
and integration boundaries. Resource names and source paths are examples from
that implementation; inspect the current branch and namespace before using them.
Past-tense descriptions are reference behavior, not proof that this stage is
implemented or verified in the learner's branch. The scope and acceptance checks
above govern this stage; defer any later-stage feature mentioned below.



### Confirmed boundary
Football 11 publishes one explicit, trusted personal-best XI per player. The
player may replace it with a later eligible personal best; ordinary completed
runs do not publish implicitly. The existing best-season-points Leaderboard is
used only to find nearby players. It is not a competitive matchmaking queue,
and the flow does not use AGS Matchmaking, Session Management, AMS, or a
dedicated server.

Each challenge runs one deterministic neutral `head-to-head-v1` match. Only the
challenger's private Challenge Score changes: a win adds `3`, a draw adds `0`,
and a loss subtracts `2` without crossing zero. The opponent's score and Saved
XI never change as a side effect of being challenged. Two-sided Elo and a
Challenge Score leaderboard are deliberately outside v1.

### Player flow
1. An authenticated player completes a trusted replay and explicitly publishes
   or replaces the resulting personal-best XI.
2. The trusted handler reads nearby entries from the existing season-points
   Leaderboard, excludes the caller, incompatible or unavailable XIs, and any
   opponent challenged in the preceding 24 hours, then expands the search from
   ±10 to ±50 positions when necessary.
3. The player previews one eligible opponent and receives an opaque, single-use
   challenge token that expires after ten minutes.
4. The trusted handler consumes the token, verifies both immutable XI snapshots
   and their versions, simulates the match from canonical server-owned evidence,
   and stores the result.
5. Settlement applies an absolute server-owned Statistic value exactly once.
   A reload can repair a consumed-but-unsettled match from the stored evidence
   without creating another match or applying the delta twice.
6. The player sees the result, current Challenge Score, cooldown/expiry states,
   and bounded immutable match history. Public responses do not expose raw
   opponent user IDs, seeds, or private simulation evidence.

### Versioned mechanics
`data/config/head-to-head-v1.json` gives each attack-versus-defence duel 42.5%
of the team comparison and control 15%. Canonical participant ordering makes a
seed and XI pair reproducible regardless of which participant is presented
first. Strict content, assessment, formation, Saved-XI schema, and head-to-head
versions prevent unlike evidence from being compared silently.

### AGS service selection
- **IAM** authenticates the browser's player token at every trusted route.
- **Cloud Save** holds the server-owned Saved-XI snapshot, issued challenge,
  bounded immutable history, and settlement evidence that Statistics cannot
  model.
- **Statistics** holds the private, `SERVER`-set
  `football11challengescore`, with a minimum and default of zero.
- **Leaderboards** supplies candidates through the already trusted
  best-season-points ranking; there is no Challenge Score leaderboard.
- **Public Player Record bulk reads** retrieve candidate Saved XIs through the
  authenticated player context. Confidential admin bulk reads were rejected by
  the live service and are not part of the final path.

Cloud Save record metadata tags were also excluded after the live service
rejected that shape. These findings are encoded in the gateway rather than
left as deployment assumptions.

### Trusted HTTP surface
```text
GET  /api/saved-xi
PUT  /api/saved-xi
POST /api/opponents/nearby
GET  /api/asynchronous-matches
POST /api/asynchronous-matches
```

Every route requires a bearer token, applies JSON and request-size checks where
relevant, disables caching, and returns sanitized errors. The browser never
submits an authoritative outcome, score, opponent identity, or simulation seed.

### Remaining release considerations
The mechanics are structurally verified, but outcome calibration still needs
player-facing balance testing before a production release. Production Device
guest recovery and public-content rights remain separate release gates. Phase
4's authoritative room mutations, abandon, timeout, and host-loss work also
remain unfinished; completing Phase 5 does not close those items.

The source and live development integration are complete. Publishing this new
build to the existing public Sites project is a separate deployment action and
must be explicitly authorized because it changes a public application.

## Agent handoff prompt

```text
Use the AccelByte AGS skill and docs/ags-plans/2026-09-03-saved-xi-head-to-head.md as the
implementation plan for this stage only. Inspect the current branch and completed
prerequisites first. Resolve any missing environment or authorization settings
before dependent implementation. Preserve existing offline mechanics, implement
the scoped player flow, and run every acceptance check. Record automated,
browser, and live-service evidence separately in docs/10-progress-tracker.md.
Report blockers honestly and stop before the next stage.
```
