# Stage 4: Server-issued draft configuration

[Integration tutorial](../12-accelbyte-integration-guide.md#stage-4) · [All plans](README.md)

**Status:** Not started on the offline starter branch.

## Prerequisites

Authenticated trusted replay is available.

## Implementation scope

Read bounded draft settings from a versioned Game Record through the server. Issue an unpredictable challenge tied to the authenticated player, with frozen seed, versions, config, and expiry. Start a browser draft only after issuance succeeds. Submission must match the issued record; do not trust edited browser config.

Keep `apps/web/src/game/session.ts` as the adapter around `packages/domain`;
preserve the existing draft, reroll, and season behavior. Inspect the actual
branch and installed SDK signatures before choosing API calls. The online
reference implementation is on public main (development master); it is not
present on the offline starter. Inspect only the relevant feature when needed.

## Acceptance checks

Missing/invalid settings fail visibly; changed settings apply to later drafts only; altered seed/config and expired or reused challenges are rejected; valid retries are idempotent.

Run `npm run typecheck`, `npm test`, and `npm run build`. Record automated,
live-service, and browser evidence separately in the progress tracker. Missing
credentials or service access are blockers, not successful verification.

## Outside this step

Friend rooms and changes to the deterministic mechanics.

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



### Goal
When a player starts a game, the Sites server reads the active revision from
AGS, validates it, freezes it into the issued challenge, and returns that
challenge to the browser. An already-started game keeps its frozen values even
if an operator activates a later revision. Trusted replay accepts only the
server-issued configuration bound to that player and challenge.

### Non-goals
- Moving football rules, player ratings, or the catalogue into Game Records.
- Letting the browser read AGS Game Records or hold a Confidential client
  secret.
- Silently falling back to checked-in or environment values when AGS is
  missing, unavailable, or malformed.
- Building an in-game administration screen for live configuration.

### Service selection
- **Selected:** AGS Cloud Save Game Records. The value is namespace-global,
  versioned custom JSON that applies equally to every player and game mode.
- **Also used:** existing private, `SERVER`-set Player Records to bind the
  issued challenge and frozen config to the authenticated player. This prevents
  a browser from substituting another valid revision or larger limits during
  trusted replay. Starting a newer game deliberately supersedes the player's
  previous unfinished challenge.
- **Rejected:** public deployment environment values, because they are baked
  into the browser build and cannot provide a live authoritative per-game read.
- **Rejected:** Statistics, because the configuration is structured global
  JSON rather than player progression or a ranked numeric value.
- **Rejected:** D1, because AGS Game Records directly model the requested
  namespace-level configuration and are already available through the installed
  SDK.

### Record contract
Key: `football11_game_config_v1`

```json
{
  "schemaVersion": 1,
  "activeRevision": "1",
  "revisions": {
    "1": {
      "maxOfferedPlayers": 15,
      "maxRerolls": 5
    }
  }
}
```

This new configuration contract uses a numeric schema version so parsing and
migration comparisons remain simple. Existing run, room, and receipt schema
identifiers are outside this change. Operators add a revision before switching
`activeRevision`. Old revisions stay
available while an issued challenge can still be submitted. Sites rejects
unknown fields, missing revisions, non-integer values, and values outside the
domain bounds.

### Player flow
1. A signed-in player chooses a solo game, or the eligible friend-room leader
   starts a round.
2. The browser calls a Sites challenge endpoint with the player's AGS access
   token. The start control shows a loading state and cannot create a local
   draft first.
3. Sites validates the player and namespace, reads
   `football11_game_config_v1` with its service token, selects and validates the
   active revision, and issues the challenge with the frozen configuration.
4. Sites stores the issued challenge as a private, server-owned player record.
   For a room round, every locked participant receives the same challenge
   configuration while retaining their per-player derived seed.
5. The browser creates the deterministic draft only from the returned challenge
   and keeps the snapshot in its game session and room challenge contract.
6. Trusted submission loads the player's server-owned challenge receipt and,
   for room runs, the canonical AGS Session challenge. It replays with the
   frozen config and rejects mismatched challenge, revision, limits, seed,
   versions, membership, or action counts.
7. Missing, unavailable, or invalid Game Record data fails closed with a visible
   retryable start error. It does not silently use defaults.

### Affected areas
- `packages/contracts`: issued challenge, friend-room challenge, and trusted
  submission configuration snapshot contracts.
- `packages/domain`: retain the existing bounds and deterministic mechanics;
  use the frozen config throughout one run.
- `apps/web/src/server`: Game Record read/validation, challenge issuance,
  server-owned challenge receipt, and replay binding.
- `apps/web/app/api`: authenticated solo and friend-room challenge endpoints.
- `apps/web/src/game` and `apps/web/app/page.tsx`: remove environment reads,
  start through Sites, freeze config in the session, and show loading/error
  states.
- Environment examples and Sites preview configuration: remove the two public
  draft-limit variables; keep AGS connection values and secrets unchanged.
- Tests, mechanics report, project docs, article, and progress tracker.

### Authorization plan
```text
Caller:                browser player + Sites backend service
Environment:           AGS Shared Cloud
Environment evidence:  project config and authenticated CLI target use gamingservices.accelbyte.io; grouped client-permission catalogue is available
Token source:          player access token for challenge requests; service token for Game Record reads and challenge receipts
IAM client type:       Public in browser; Confidential in Sites runtime
Secret location:       ignored local server config and Sites hosted secret storage only
AGS calls:             IAM current user; GET /cloudsave/v1/admin/namespaces/{namespace}/records/{key}; existing Cloud Save admin player-record create/read/update; room Session read where applicable
Permission discovery:  live `ags describe` contract, Shared Cloud permission catalogue, installed SDK declarations, and live client readback
Required permissions:  ADMIN:NAMESPACE:{namespace}:CLOUDSAVE:RECORD [READ], plus the already-granted player-record permissions
Shared Cloud groups:   m_cloud_save / g_game_records / action 2 (READ); existing m_cloud_save / g_player_records / actions 1,2,4
Verified access:       yes — Confidential caller, g_game_records READ only, server-owned record read back with numeric schema 1
```

### Residual risks and operating rules
- The active-challenge player-record slot intentionally supports one current
  game per player. Starting a second game invalidates ranking for the older
  unfinished game; the UI must say this if concurrent tabs are detected.
- Room challenge issuance writes participant receipts before the room challenge
  becomes visible. The endpoint must be idempotent so a partial upstream failure
  can be retried safely.
- Old config revisions need a retention rule tied to the maximum accepted
  challenge lifetime before operators remove them.
- The permission and initial record were provisioned only after approval and
  were read back to verify the exact caller, ownership, key, schema, and values.

## Agent handoff prompt

```text
Use the AccelByte AGS skill and docs/ags-plans/2026-09-04-game-record-draft-config.md as the
implementation plan for this stage only. Inspect the current branch and completed
prerequisites first. Resolve any missing environment or authorization settings
before dependent implementation. Preserve existing offline mechanics, implement
the scoped player flow, and run every acceptance check. Record automated,
browser, and live-service evidence separately in docs/10-progress-tracker.md.
Report blockers honestly and stop before the next stage.
```
