# Stage 1: Device ID guest login

[Integration tutorial](../12-accelbyte-integration-guide.md#stage-1) · [All plans](README.md)

**Status:** Not started on the offline starter branch.

## Prerequisites

The offline draft completes successfully. Tutorial setup has selected a development namespace and browser-safe public client.

## Implementation scope

Add an explicit Continue as guest action, verify the authenticated current user, and keep stable device identity on this browser origin. Keep tokens in memory and secrets out of the browser. Expose pending, failure, and retry states. Keep offline play available.

Keep `apps/web/src/game/session.ts` as the adapter around `packages/domain`;
preserve the existing draft, reroll, and season behavior. Inspect the actual
branch and installed SDK signatures before choosing API calls. The online
reference implementation is on public main (development master); it is not
present on the offline starter. Inspect only the relevant feature when needed.

## Acceptance checks

First login succeeds; same-origin reload restores the same guest; an isolated profile gets a different guest; failed login offers retry without a success state.

Run `npm run typecheck`, `npm test`, and `npm run build`. Record automated,
live-service, and browser evidence separately in the progress tracker. Missing
credentials or service access are blockers, not successful verification.

## Outside this step

Cloud Save, ranking, sessions, and server-authoritative scoring.

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
A first-time player can intentionally continue as a guest, receive an AGS user
session, pass a second authenticated IAM lookup, and enter the game through the
visible React flow. Reloading the browser keeps the same local device identity.

### Non-goals
- Email/password, Steam, Epic, Google, console, or other provider login.
- Account linking or guest-account upgrade implementation.
- Worker token validation.
- Statistics or Leaderboards integration.
- Lobby, Session Management, friend rooms, Matchmaking, or AMS.
- Production approval for unrecoverable Device ID-only accounts.

### Affected areas
The intended production boundaries are:

- React application bootstrap and provider composition.
- Guest-login screen and authenticated shell.
- Application-owned AGS configuration/client factory.
- Application-owned auth gateway and error mapping.
- Local device-identity persistence.
- Focused auth unit tests and browser-flow tests.

The intended paths and adapter contract are documented in
[Phase 2 — AGS foundation](../phases/phase-02-ags-foundation.md). Implementation
belongs in `apps/web/`.

### AGS modules
- IAM only.

### Service selection
- **Selected:** AGS IAM Device ID identity because the slice is authentication
  and account identity.
- **Rejected:** Cloud Save, because it is not an identity provider and cannot
  issue an AGS user token.
- **Rejected:** D1-only guest accounts, because that would duplicate IAM and
  would not provide the AGS identity required by Sessions, Statistics, and
  Leaderboards.
- **Not yet selected:** any durable account provider for guest upgrade. That is
  a later product and IAM decision.

### Authorization plan
```text
Caller:                web game/browser UI
Environment:           shared cloud
Environment evidence:  ignored browser config and authenticated AGS CLI discovery agree on the selected development environment
Token source:          user access token minted by Device ID login
IAM client type:       public
Secret location:       none
AGS calls:             POST /iam/v3/oauth/platforms/device/token; GET /iam/v3/public/users/me
Permission discovery:  installed SDK source plus authenticated AGS CLI operation metadata
Required permissions:  none exposed for either public operation; the profile call uses the minted user token
Shared Cloud groups:   none required for these public operations
Verified access:       yes; token minting and authenticated current-user lookup pass in the development environment
```

The Device ID login/token-minting operation may run without a user token. The
verification lookup must attach the newly minted user token. Any design that
requires a client secret in React is rejected.

### Implementation steps
1. Use the existing `apps/web/` product source root and preserve its local
   identity adapter as a development/offline implementation.
2. Supply browser-safe AGS configuration for development without adding any
   secret to the client.
3. Install pinned compatible versions of `@accelbyte/sdk` and
   `@accelbyte/sdk-iam`; record declared and resolved versions.
4. Inspect the resolved SDK source/types and the target environment's API
   metadata to identify the exact Device ID login and verification operations.
5. Run the read-only authorization/provider preflight against the target
   namespace. Stop if the login method, client type, or required access is not
   verified.
6. Add a small AGS client factory and an application-owned `AuthGateway`.
7. Add device-identity persistence using a random UUID and a versioned storage
   key; do not fingerprint the browser.
8. Add `AuthProvider` state for idle, restoring, logging in, verifying,
   authenticated, and error.
9. Add the visible **Continue as guest** flow, guest disclosure, retry state,
   and configuration-error state.
10. Keep the session tab-local and retain the device identifier across reloads;
    explicit logout and destructive guest reset remain later account-management
    work so this login slice does not add an unsafe reset path.
11. Add unit tests for identity persistence, request de-duplication, error
    mapping, and state transitions.
12. Run the real development-namespace login, authenticated verification call,
    reload test, and clean-profile separation test.

### Risks and open questions
1. Which provider and UX will upgrade/link a guest before production social or
   competitive use?
2. Will the product require account linking before connected public release, or
   explicitly accept Device ID account-loss risk?
3. When account management is added, what should explicit logout and destructive
   guest reset do while preserving a clear account-loss warning?

## Agent handoff prompt

```text
Use the AccelByte AGS skill and docs/ags-plans/2026-09-02-device-id-login.md as the
implementation plan for this stage only. Inspect the current branch and completed
prerequisites first. Resolve any missing environment or authorization settings
before dependent implementation. Preserve existing offline mechanics, implement
the scoped player flow, and run every acceptance check. Record automated,
browser, and live-service evidence separately in docs/10-progress-tracker.md.
Report blockers honestly and stop before the next stage.
```
