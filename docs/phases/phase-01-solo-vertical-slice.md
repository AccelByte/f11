# Phase 1B Detailed Plan — Local React Functional MVP

**Last updated:** September 3, 2026
**Status:** Complete; local Functional MVP exit checks passed
**Parent roadmap:** [07 — MVP roadmap](../07-mvp-roadmap.md)  
**Phase index:** [Detailed delivery plans](README.md)

## Work estimate — one developer with agentic AI

- **Effort:** 2–3 builder-days.
- **Elapsed time:** 2–3 working days.
- **Primary uncertainty:** responsive player-flow defects and packaging the
  existing React build for ChatGPT Sites.

## Why this phase exists

Phase 1A proves the rules headlessly. Phase 1B makes the same engine playable
in React and proves the complete game on one device before any online-service
dependency is introduced.

The Functional MVP is intentionally local. It creates a random local profile,
stores the latest replayable result in browser storage, and verifies a checksum
on readback. Results remain player-authoritative: the checksum detects accidental
or casual local modification, but it is not competitive security.

All AGS integration now begins in Phase 2 — AGS Foundation. That phase replaces
the local identity and persistence adapters with IAM Device ID and Cloud Save,
then adds trusted replay, Statistics, and Leaderboards. An application-owned
Cloudflare Worker and D1 remain deferred.

## Phase outcome

A player can open the React app, receive or restore a local guest profile,
complete eleven legal choices, use rerolls, see every relevant position rating,
receive the deterministic 38-match season result, save a checksummed replay
record locally, reload it, and view the same result.

## Entry conditions

- Phase 1A passes its golden, invariant, replay, and 10,000-seed suite.
- The React application consumes the shared domain/content packages directly.
- ChatGPT Sites build requirements are present for `apps/web`.

## Explicit non-goals

- AGS SDK installation, IAM Device ID, Cloud Save, Statistics, or Leaderboards.
- Application-owned Cloudflare Worker or D1 database.
- Server-authoritative or tamper-proof results.
- Daily challenges, sharing, rooms, saved-XI rivals, or account sync.
- Phaser, live match visuals, production polish, or broad balance tuning.
- Deployment before the user explicitly requests it.

## Package boundary

```text
apps/
  web/                   React UI, local adapters, Sites configuration
packages/
  domain/                deterministic engine; no React or storage imports
  contracts/             serializable local and later remote record shapes
  content/               pinned catalogue/configuration loaders
  test-fixtures/         golden runs and browser-flow fixtures
```

React components depend on application-owned identity and persistence
interfaces. Phase 2 can add AGS implementations behind those boundaries without
moving football rules into components or generated SDK types.

## Player flow

```text
Open app
  -> obtain or restore a random local profile identifier
  -> load and checksum-verify the latest local result when one exists
  -> start a random challenge using Web Crypto seed material
  -> domain creates the first deterministic offer, capped at fifteen safe cards
  -> player selects a legal player/slot or rerolls
  -> repeat until all eleven 4-3-3 slots are filled
  -> domain replays actions, assesses the XI, and simulates 38 matches
  -> app writes one versioned run/result record to local browser storage
  -> app reads it back and verifies its checksum
  -> result screen shows XI, W-D-L, points, categories, and explanation
```

## Browser state model

```text
booting
  -> local-profile-ready
  -> ready
  -> drafting
  -> calculating-result
  -> saving-local-result
  -> result
  -> recoverable-local-storage-error
```

Draft state contains only serializable mechanics data. Card selection, focus,
modal visibility, and animation timing are presentation-only.

## Local persistence contract

The MVP stores one latest-run record under a versioned browser key:

```ts
type LocalRunRecordV1 = {
  schemaVersion: 'football11-local-run-v1';
  runId: string;
  localProfileId: string;
  seed: string;
  versions: MechanicsVersion;
  actions: DraftAction[];
  stateHashes: string[];
  result: RunResult;
  createdAt: string;
  authority: 'player';
  checksum: string;
};
```

The checksum covers every field except itself. A malformed, unsupported, or
checksum-mismatched record is rejected and never labelled restored or verified.
Clearing browser storage removes the profile and saved result. This is expected
for the local MVP and must not be described as account sync.

## Work sequence

### 1B-A — React application shell

1. Create `apps/web` with React, TypeScript, the product theme, and Sites config.
2. Add home, draft, formation, and result surfaces.
3. Add explicit ready, draft, result, and recoverable-error states.

### 1B-B — Mechanics integration

1. Import the approved domain/content packages without copying rules.
2. Generate fresh seeds with Web Crypto and pin all mechanics versions.
3. Send every select/reroll action through the shared transition function.
4. Resolve through the shared replay/assessment/season pipeline.
5. Render only retained assessment, season, and explanation facts.

### 1B-C — Local identity and replay storage

1. Create a random, versioned local profile identifier without fingerprinting.
2. Keep identity and persistence behind small application adapters.
3. Save versions, seed, actions, state hashes, and the complete result.
4. Read back and checksum-verify the record before showing “Saved.”
5. Restore and expose the latest result on a later visit.

### 1B-D — Player surfaces

1. Show three offer cards with legal positions and ratings.
2. Preview the effective slot rating before committing a choice.
3. Show filled/open formation slots, round, rerolls, and cooldown behavior.
4. Show the final XI, record, five categories, units, explanation, and replay hash.
5. Support 360×640, 390×844, and 1280×720 without hover-only controls.

### 1B-E — Verification and Sites-ready build

1. Run the complete Phase 1A suite in the integrated workspace.
2. Complete a browser run including a reroll and all eleven placements.
3. Verify local save/readback, checksum rejection, and latest-result restoration.
4. Pass typecheck, unit/integration tests, lint, formatting, and production build.
5. Keep deployment user-triggered.

## Failure behavior

| Failure | Player behavior | Record behavior |
|---|---|---|
| Local storage unavailable | Explain that the draft cannot be saved | No verified-save claim |
| Invalid local action | Prevent and explain it | No state mutation |
| Local write/readback fails | Preserve the visible completed result | Do not claim “Saved” |
| Unsupported stored version | Explain that the prior result was not loaded | Preserve no false verified state |
| Local data is tampered | Reject on checksum mismatch | Never label restored, ranked, or trusted |

## Verification evidence

- The browser flow completed all eleven rounds after a reroll and rendered the
  deterministic result at desktop, 390×844, and 360×640 with no narrow-viewport
  horizontal overflow.
- `apps/web/src/game/session.test.ts` exercises direct shared-domain transitions
  and complete-run resolution.
- `apps/web/src/services/local/local-services.test.ts` proves stable random local
  identity, full replay-record roundtrip, and checksum rejection.
- The result UI labels every outcome player-authoritative and exposes the replay
  hash; it makes no ranked or server-verified claim.
- The Sites/vinext production artifact is prepared only after the root verification
  command passes. Deployment remains a separate explicit action.

## Exit checklist

- [x] A stable random local guest profile is created and restored without fingerprinting.
- [x] Eleven legal rounds can be completed through React.
- [x] The integrated run uses the exact Phase 1A transitions and result resolver.
- [x] A complete replayable record survives local write/readback and checksum verification.
- [x] The result includes XI, W-D-L, points, five categories, units, and explanation.
- [x] The UI labels the result player-authoritative, not ranked or server-verified.
- [x] The final format, lint, typecheck, test, and production-build command passes.
- [x] The ChatGPT Sites build is ready; deployment remains user-triggered.

**Exit criterion:** one visible random run works from local guest entry through a
saved, reloadable, deterministic result. This closes the standalone Functional
MVP; AGS identity, account sync, Cloud Save, and competitive trust begin in
Phase 2.
