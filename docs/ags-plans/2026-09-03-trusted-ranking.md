# Stage 3: Trusted replay and ranking

[Integration tutorial](../12-accelbyte-integration-guide.md#stage-3) · [All plans](README.md)

**Status:** Not started on the offline starter branch.

## Prerequisites

Device ID and Cloud Save work. Choose a server runtime and configure confidential credentials only there.

## Implementation scope

Add a small authenticated backend that binds requests to the current player and replays seed/config/actions with packages/domain. Reject invalid or incompatible evidence and ignore client-calculated totals. Store an idempotent private server-owned receipt before updating configured Statistics and Leaderboards. The browser submits evidence and displays verified results and errors.

Keep `apps/web/src/game/session.ts` as the adapter around `packages/domain`;
preserve the existing draft, reroll, and season behavior. Inspect the actual
branch and installed SDK signatures before choosing API calls. The online
reference implementation is on public main (development master); it is not
present on the offline starter. Inspect only the relevant feature when needed.

## Acceptance checks

Legal replay succeeds; forged totals do not affect scores; illegal actions and wrong versions fail; retries do not duplicate writes; a different user cannot claim another result; all secrets remain server-side.

Run `npm run typecheck`, `npm test`, and `npm run build`. Record automated,
live-service, and browser evidence separately in the progress tracker. Missing
credentials or service access are blockers, not successful verification.

## Outside this step

Authoritative random challenge issuance is the next stage. Do not call client-chosen seeds cheat-proof; keep this remaining trust boundary explicit.

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



### Player flow
1. A signed-in AGS Device ID guest completes a locally replayable run.
2. The result screen offers **Verify and rank this run**; ordinary Cloud Save
   remains player-owned and does not imply a ranked result.
3. The browser submits only the run identity, seed, supported version bundle,
   and ordered actions with the in-memory AGS player access token.
4. The Sites managed server handler validates that token with AGS IAM, derives
   the user from the verified current-user response, replays the actions with
   the shared domain/content packages, and ignores client-reported totals.
5. An accepted replay updates a server-owned best-points statistic using the
   retry-safe `MAX` strategy, then stores a private `SERVER`-set Cloud Save
   settlement receipt. Writing the statistic before the receipt makes a retry
   self-healing without requiring D1.
6. The handler reads the configured all-time leaderboard and returns only a
   sanitized rank-range view. The browser shows trusted score, rank, nearby
   entries, and explicit loading, unranked, empty, stale, and retry states.

### Trust and authorization
- Browser caller: Public IAM client plus the player's user access token; no
  client secret is present in browser source, build output, or storage.
- Trusted caller: the Sites Cloudflare Worker runtime plus a Confidential IAM
  client secret held only in local ignored configuration and Sites secrets.
- Shared Cloud permissions: Cloud Save player-record create/read/update and
  Statistics user-value create/read/update. The exact module/group readback is
  verified after client creation.
- Player token validation: authenticated AGS current-user lookup, exact
  namespace check, and non-empty user ID.
- Accepted versions: exact equality with the repository's
  `DEFAULT_MECHANICS_VERSION`; unsupported versions fail before mutation.
- Input bounds: JSON content type, 64 KB request limit, bounded identifiers and
  seed, and no more than eleven selections plus the configured five rerolls.

### Namespace resources
- Confidential client: `Football 11 Sites Trusted Replay`.
- Statistic: `football11bestpoints`, public, `SERVER`-set, 0–114, no cycle. AGS
  statistic codes accept lowercase letters and digits, so the earlier
  underscore-separated draft identifier was revised before creation.
- Settlement strategy: Statistics v2 `MAX`; duplicate calls cannot increase a
  score twice and lower scores cannot replace a higher score.
- Leaderboard: `football11-best-points`, descending, all time.
- Receipt key: `football11_trusted_settlement_v1`, private and `SERVER`-set.

### Authorization preflight
```text
Caller:                browser player + Sites backend service
Environment:           AGS Shared Cloud
Environment evidence:  project public config and CLI base URL use gamingservices.accelbyte.io
Token source:          user access token for submission; service token for settlement
IAM client type:       Public in browser; Confidential in Sites runtime
Secret location:       ignored local server config and Sites hosted secret storage only
AGS calls:             IAM current user; Cloud Save admin player record; Statistics v2 MAX; Leaderboard v3 reads
Permission discovery:  installed SDK endpoint contracts plus live CLI catalog/readback
Required permissions:  Cloud Save player-record create/read/update; Statistics user-value create/read/update
Shared Cloud groups:   m_cloud_save/g_player_records and m_statistics/g_user_statistics_value, actions 1/2/4
Verified access:       confidential client and exact groups/actions read back; live local-Worker smoke passed
```

## Agent handoff prompt

```text
Use the AccelByte AGS skill and docs/ags-plans/2026-09-03-trusted-ranking.md as the
implementation plan for this stage only. Inspect the current branch and completed
prerequisites first. Resolve any missing environment or authorization settings
before dependent implementation. Preserve existing offline mechanics, implement
the scoped player flow, and run every acceptance check. Record automated,
browser, and live-service evidence separately in docs/10-progress-tracker.md.
Report blockers honestly and stop before the next stage.
```
