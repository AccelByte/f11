# Phase 2 Detailed Plan — AGS Foundation

**Last updated:** September 3, 2026
**Status:** Complete in development; Slices 2A–2E pass through the public Sites Worker, with account upgrade/linking deferred as a connected-product release gate
**Parent roadmap:** [07 — MVP roadmap](../07-mvp-roadmap.md)
**Phase index:** [Detailed delivery plans](README.md)
**First AGS slice:** [Device ID guest login plan](../12-accelbyte-integration-guide.md#stage-1)

## Work estimate — one developer with agentic AI

- **Effort:** 4–7 builder-days.
- **Elapsed time:** 1–1.75 weeks, excluding namespace-access waits.
- **Primary uncertainty:** exact TypeScript SDK operations, browser Device ID
  support, Cloud Save limits, namespace configuration, Sites server-to-AGS
  authentication, permissions, and access latency.

## Why AGS work starts here

Phases 1A and 1B have proved the standalone game. Phase 2 is the first
online-service phase and moves every
AGS concern into one deliberate foundation:

1. IAM Device ID identity;
2. Cloud Save for rich game/run records;
3. trusted replay and authenticated user binding through the Sites managed server
   runtime unless evidence favors AGS Extend;
4. server-owned Statistics updates; and
5. player-facing Leaderboards.

This boundary keeps the Functional MVP independent of credentials, namespace
setup, and network availability while still maximizing AGS once connected work
begins. ChatGPT Sites continues to host the React client and is the first runtime to
evaluate for the trusted server endpoint. D1 is not part of the planned data path,
while AGS Extend and a separately provisioned Cloudflare Worker remain alternatives
only if a demonstrated integration or runtime requirement justifies them.

## Phase outcome

A player can enter the React application as an AGS guest, see locally proven
run data synchronized through Cloud Save, submit replay evidence to a trusted
server boundary connected to AGS, and see an accepted competitive value in the intended
leaderboard under the same AGS identity.

## Entry conditions

- Phase 1B has a stable local identity adapter and checksummed run-record contract.
- The target AGS Shared Cloud development environment, public browser client,
  and `apps/web` source root are selected.
- `@accelbyte/sdk` 4.3.3, `@accelbyte/sdk-iam` 6.3.6, and the Cloud Save,
  Statistics, and Leaderboard SDK packages are installed and verified through
  the repository lockfile and executable tests.
- Each live AGS slice has an approved game-flow plan and current read-only auth
  preflight before namespace inspection or mutation.

Slice 2B now has an approved plan at
[`docs/12-accelbyte-integration-guide.md#stage-2`](../12-accelbyte-integration-guide.md#stage-2).
It selects Cloud Save only for the generic replayable run document, keeps
competitive values in server-owned Statistics, and defines readback,
replay, conflict, and visible recovery evidence before completion.

Slices 2C–2E use the approved trusted-ranking plan at
[`docs/12-accelbyte-integration-guide.md#stage-3`](../12-accelbyte-integration-guide.md#stage-3).
The implementation packages the Vinext application as a Sites Worker with a
single ranked-run endpoint. It validates the AGS player, replays only the exact
supported mechanics/content version, settles a bounded `SERVER`-set best-points
statistic with `MAX`, stores a private server-owned receipt, and reads the live
all-time leaderboard with the player's authenticated token. A redacted smoke
against the built Worker proves acceptance, duplicate safety, tamper and version
rejection, receipt ownership, statistic readback, and rank materialization. The
same smoke passes through the deployed public Sites route, whose root also
returns HTTP 200.

## Delivery slices

| Slice | Player-visible outcome | AGS capability | Dependency |
|---|---|---|---|
| 2A — Guest identity | Continue as guest and restore the same player | IAM Device ID | Public IAM client and enabled login method |
| 2B — Cloud game data | Save and reload runs across sessions under the AGS user | Cloud Save | 2A and approved record/key limits |
| 2C — Trusted replay | Submit evidence without trusting a claimed user or result | Sites server runtime first | 2A–2B and approved trusted-service pattern |
| 2D — Competitive statistics | One accepted run updates the intended numeric value once | Statistics | 2C and configured stat definitions |
| 2E — Leaderboard UI | See rank, score, and nearby players | Leaderboards | 2D and configured leaderboard |

Each slice needs both service evidence and a visible player-flow check before
the next slice begins.

### Current Slice 2A evidence

The browser implementation has an application-owned AGS config reader, stable
random Device ID storage, deduplicated login service, SDK adapter, in-memory
token attachment, authenticated current-user verification, and visible
idle/restoring/logging-in/verifying/error/authenticated states. Five focused
adapter tests pass as part of the 52-test repository suite.

The development Device ID provider is active. A redacted live smoke check now
proves token minting, an authenticated current-user lookup, same-device
restoration, and clean-device separation without printing tokens or user IDs.
Browser QA through the local preview proves the first-use action, live login,
draft enablement, visible retry behavior, same-guest reload, and a different
guest from isolated browser storage. Source and resolved-SDK inspection confirm
that access and refresh tokens stay on the SDK instance rather than being
copied to application storage. Slice 2A is therefore complete in development.
Production use still needs account linking/upgrade or an explicit acceptance of
Device ID account-loss risk; that later release choice does not block the
Functional MVP or Slice 2B development.

---

## Slice 2A — React guest login with AGS Device ID

### Player flow

```text
Open app
  -> read the versioned random device identifier
  -> show Continue as guest on first use
  -> create crypto.randomUUID() if no identifier exists
  -> call the exact installed IAM SDK Device ID operation
  -> receive an AGS user session
  -> verify it with an authenticated current-user/profile call
  -> publish the authenticated player to the React application
```

“Guest” is product language; Device ID is the AGS mechanism. Never derive the
identifier from IP, user agent, canvas, hardware, or any other fingerprint.

### Adapter boundary

```ts
type AuthenticatedPlayer = {
  userId: string;
  displayName?: string;
  isGuest: boolean;
};

interface AuthGateway {
  loginWithDeviceId(deviceId: string): Promise<AuthenticatedPlayer>;
  logout(): Promise<void>;
}
```

AGS imports stay under `apps/web/src/services/ags`. React screens and the domain
package use application-owned types. Browser configuration contains only base
URL, namespace, and public client ID. No confidential secret may enter a browser
variable, JavaScript bundle, repository file, or response.

Keep tokens in memory or the SDK-supported session mechanism; do not copy them
into local storage. A failed retry reuses the existing device identifier. Normal
logout retains it. Destructive guest reset must warn about unrecoverable progress.

### Exit criterion

The visible React action reaches authenticated state, Device ID login returns a
non-empty AGS user ID/session, a second authenticated IAM lookup succeeds, reload
restores the same AGS user, and two clean profiles create different users.

---

## Slice 2B — AGS Cloud Save for game data

Cloud Save becomes the remote implementation of the persistence interface proven
in Phase 1B. It stores rich, player-owned game data rather than flattening a run
into Statistics calls.

Minimum record fields:

```ts
type CloudRunRecordV1 = {
  schemaVersion: 'football11-cloud-run-v1';
  runId: string;
  ownerUserId: string;
  seed: string;
  versions: MechanicsVersion;
  actions: DraftAction[];
  stateHashes: string[];
  result: RunResult;
  createdAt: string;
  authority: 'player' | 'trusted';
  checksum: string;
};
```

Implementation checkpoints:

1. Verify the exact Cloud Save SDK operations, permissions, key constraints,
   visibility rules, payload limits, and overwrite semantics.
2. Bind records to the authenticated AGS user returned by Slice 2A.
3. Use a stable `runId` so retries are idempotent.
4. Write and read back before showing “Synced.”
5. Check schema, owner, versions, and checksum on every read.
6. Define local-to-cloud reconciliation: the newest verified local result may
   upload after login, but a conflict never silently overwrites a different run.
7. Retain enough replay evidence to reproduce the final state hash. If payload
   limits require compaction, derive verbose views locally rather than dropping
   versions, actions, or hashes.

### Exit criterion

One authenticated player writes a complete run, reads it back in a clean session,
reproduces the same result/hash, and receives visible recoverable states for
offline, rejected, malformed, and conflicting records.

---

## Slice 2C — Trusted replay and user binding

Evaluate a server-backed Sites deployment first. It keeps the authoritative endpoint
with the existing hosted application while moving validation out of the player-controlled
browser. The trusted handler must derive the user from validated AGS authentication
context, replay the submitted actions through the same versioned mechanics package,
and ignore client-claimed result totals.

```text
Browser submits token/session context + seed + versions + ordered actions
  -> trusted Sites server handler validates the AGS player identity
  -> selects the exact supported content/mechanics versions
  -> replays every action and rejects illegal transitions
  -> derives assessment, 38-match season, explanation, and final hash
  -> writes or marks the Cloud Save record as trusted
  -> returns the canonical accepted result
```

The Slice 2C design must verify the Sites runtime's request contract, AGS token
validation path, server-side secret handling, outbound AGS operations, resource
limits, latency, and deployment behavior before implementation. Choose AGS Extend
instead only when this verification finds a material AGS-integration or runtime
advantage; choose a separately provisioned Worker only when neither managed route
fits. No D1 dependency is planned unless exactly-once settlement or another concrete
relational/transactional requirement proves it necessary.

### Exit criterion

Valid evidence produces one canonical result for the authenticated AGS user;
missing, expired, wrong-namespace, tampered, duplicate, and unsupported-version
submissions create no trusted result or competitive mutation.

---

## Slice 2D — Trusted Statistics update

Statistics stores only approved numeric aggregates that drive leaderboards or
progression. The full run remains in Cloud Save.

1. Finalize statistic codes, bounds, update strategy, and cycle/reset behavior.
2. Discover exact operations and permissions in the selected environment.
3. Update only after Slice 2C accepts the canonical replay.
4. Make settlement idempotent so a retry cannot double-increment a counter.
5. Read the value back and retain a settlement receipt/reference.

**Exit criterion:** one accepted run changes the intended statistic exactly once;
rejected, replayed, or duplicate submissions do not change it.

---

## Slice 2E — Leaderboard presentation

Show loading, unranked, ranked, empty, stale, and retryable-error states. Read
the configured leaderboard after the Statistics update; never display a locally
predicted rank. Keep leaderboard values separate from full Cloud Save records.

**Exit criterion:** the visible UI shows the exact trusted statistic for the
signed-in player and resolves the approved around-me or rank-range view.

## Phase-wide test matrix

| Scenario | Expected result |
|---|---|
| First visit | One AGS guest identity is created |
| Reload | Same AGS guest identity is restored |
| Parallel login clicks | One login request is in flight |
| Offline login/save | Recoverable UI; local record and device ID remain intact |
| Cleared browser storage | New guest identity with the approved account-loss warning |
| Wrong namespace/client | Visible configuration/auth error; no false local-to-cloud claim |
| Cloud Save readback differs | No “Synced” label; preserve the verified local record |
| Tampered replay evidence | Trusted submission rejected; no stat mutation |
| Duplicate submission | One trusted Cloud Save result and one statistic effect |
| Unranked player | Explicit unranked state, not rank zero |

## Phase exit checklist

- [x] Device ID login and authenticated verification are complete in React.
- [x] Cloud Save write/readback preserves the replayable record under the AGS user.
- [x] Exact SDK versions, operations, permissions, and limits are recorded.
- [x] Trusted replay derives identity and result without trusting browser totals.
- [x] Competitive Statistics settles an accepted run exactly once.
- [x] The player sees the resulting value/rank in the Leaderboard UI.
- [x] No confidential credential appears in the browser bundle or repository.
- [x] Device ID account-loss and upgrade requirements remain explicit release gates.

The trusted path passes focused tests, the built local Worker, and the published
Sites route with live AGS readback. The public root returns HTTP 200; a legal
replay is accepted, its duplicate is idempotent, tampered and unsupported
submissions are rejected, and the private `SERVER` receipt, Statistic value,
and Leaderboard rank all read back successfully.

Phase 2 exits when the React player flow proves AGS identity, remote game-data
persistence, trusted replay, Statistics, and Leaderboards end to end. Friend rooms
remain Phase 4, while daily challenges and public sharing follow in Phase 3.
AGS Matchmaking, AMS, D1, AGS Extend, and a separately provisioned Worker remain
deferred unless a later verified requirement selects one of them.

That development exit is now complete. Account upgrade/linking remains deferred:
it does not block the Functional MVP or this technical foundation, but it must be
resolved before an official connected-product release.
