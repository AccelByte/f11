# Stage 2: Private Cloud Save

[Integration tutorial](../12-accelbyte-integration-guide.md#stage-2) · [All plans](README.md)

**Status:** Not started on the offline starter branch.

## Prerequisites

Device ID login has passed live and browser checks.

## Implementation scope

Define a versioned, serializable run record containing the seed, mechanics/content versions, draft config, actions, and result checksum. Save only the authenticated player's latest completed run as a private Player Record. Read it back before reporting success. Validate ownership, schema, versions, and deterministic replay on restore. Offer explicit retry; keep an unsaved result visible after failure.

Keep `apps/web/src/game/session.ts` as the adapter around `packages/domain`;
preserve the existing draft, reroll, and season behavior. Inspect the actual
branch and installed SDK signatures before choosing API calls. The online
reference implementation is on public main (development master); it is not
present on the offline starter. Inspect only the relevant feature when needed.

## Acceptance checks

A completed draft is saved and read back; reload restores it; a second player cannot read it as their own; incompatible or tampered records are rejected; failures remain visible and retryable.

Run `npm run typecheck`, `npm test`, and `npm run build`. Record automated,
live-service, and browser evidence separately in the progress tracker. Missing
credentials or service access are blockers, not successful verification.

## Outside this step

Ranked scores, trusted receipts, public records, and room state. Player-written results are not trusted ranking evidence.

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
After login, an authenticated player can upload a complete verified local run,
read it back from AGS Cloud Save, restore it in a clean browser session, and see
clear `syncing`, `synced`, `offline`, `malformed`, `rejected`, and `conflict`
states without losing the verified local record.

### Non-goals
- Trusting a browser-computed score for competitive use.
- Statistics or Leaderboard mutation.
- Trusted replay or protected server-owned records.
- Multi-run history, public result sharing, or D1 persistence.
- Account linking or guest upgrade; that release decision remains deferred.

### Affected areas
- Shared cloud-run contract and record validation.
- AGS browser gateway using the existing in-memory SDK session.
- Local-to-cloud reconciliation and readback verification.
- Home/result sync states and retry actions.
- Focused adapter, reconciliation, and player-flow tests.
- Phase tracker and reader-facing article evidence.

### AGS modules
- IAM, already complete, supplies the authenticated player token.
- Cloud Save public player records own the generic replayable save document.

### Service selection
- **Selected:** AGS Cloud Save player records. The document is a custom,
  versioned save snapshot containing replay evidence and presentation facts.
- **Reserved for later:** AGS Statistics stores only the accepted numeric best
  score; it cannot preserve the complete actions, versions, hashes, and result.
- **Rejected:** Leaderboards, Achievements, Inventory, Session, and other native
  services because none model this generic save document.
- **Rejected:** D1 because Phase 2B needs player-owned Cloud Save synchronization,
  not application-owned relational storage.

### Authorization plan
```text
Caller:                web game/browser UI
Environment:           shared cloud
Environment evidence:  ignored browser config and authenticated AGS CLI target the same development host and namespace
Token source:          authenticated Device ID user's access token
IAM client type:       public
Secret location:       none
AGS calls:             GET and PUT /cloudsave/v1/namespaces/{namespace}/users/{userId}/records/{key}; optimistic-concurrency PUT for an existing record
Permission discovery:  authenticated AGS CLI operation metadata
Required permissions:  NAMESPACE:{namespace}:USER:{userId}:CLOUDSAVE:RECORD [READ, UPDATE]
Shared Cloud groups:   runtime self-service call; no confidential-client group is required for the player's own public record
Verified access:       pending the live write/readback smoke
```

The browser may access only the signed-in player's record. It must reject a
record whose embedded owner differs from the authenticated user. No client
secret may be added to browser configuration or source.

### Implementation steps
1. Add a versioned `CloudRunRecordV1` contract and strict validation/checksum
   helpers without weakening the existing local record contract.
2. Use a stable, documented latest-run record key that satisfies Cloud Save key
   constraints.
3. Add the exact Cloud Save SDK package/version compatible with the pinned core
   SDK and inspect its resolved types before calling it.
4. Extend the existing AGS gateway so Cloud Save calls reuse the authenticated
   SDK instance and in-memory user token.
5. Implement GET, first-write PUT, readback verification, and optimistic
   concurrency for same-run retries.
6. Reconcile safely: automatically upload when no cloud record exists, accept
   an identical record as already synced, and surface different-run conflicts
   without silently overwriting either copy.
7. After login, restore a valid cloud run when no local run exists. Never replace
   a valid but different local run without an explicit later product decision.
8. Add visible loading, synced, offline/error, malformed/rejected, and conflict
   states with retry behavior on the existing home and result screens.
9. Add unit tests for mapping, checksums, validation, owner/version rejection,
   reconciliation, idempotent retry, and error mapping.
10. Run the repository verification suite, a live development-namespace
    write/readback/replay smoke, and the visible player flow.

### Risks and open questions
1. Confirm the current service's record-key and JSON payload limits from live
   API/SDK documentation before finalizing the key and payload policy.
2. A single latest-run slot deliberately does not provide history. Synced
   history remains Phase 3.
3. Device ID storage loss still loses access to the AGS guest. Account upgrade
   remains deferred by product direction and does not block this development
   slice.

## Agent handoff prompt

```text
Use the AccelByte AGS skill and docs/ags-plans/2026-09-03-cloud-save-run-sync.md as the
implementation plan for this stage only. Inspect the current branch and completed
prerequisites first. Resolve any missing environment or authorization settings
before dependent implementation. Preserve existing offline mechanics, implement
the scoped player flow, and run every acceptance check. Record automated,
browser, and live-service evidence separately in docs/10-progress-tracker.md.
Report blockers honestly and stop before the next stage.
```
