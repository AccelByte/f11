# Technical Architecture

**Last updated:** September 4, 2026
**Status:** Historical local MVP retained; connected runtime uses AGS Cloud Save as durable run storage

## Architecture goals

- Prove the complete draft and simulation loop with the smallest deployable web stack.
- Keep mechanics deterministic, replayable, and testable outside React.
- Keep the Functional MVP independent of online-service credentials and availability.
- Make local identity and persistence replaceable by AGS adapters in Phase 2.
- State the trust limit clearly: browser execution and local checksums are not tamper-proof.

## Functional MVP stack

### Browser application

- React and TypeScript with a Sites/vinext production build.
- React DOM, CSS transitions, and accessible pointer, touch, and keyboard controls.
- The framework-free `@football-11/domain` package for every rule and calculation.
- Web Crypto for fresh seed and local-profile material; mechanics never call `Math.random()`.
- Versioned browser storage for one local guest profile and the latest run record.

ChatGPT Sites is the hosting abstraction. The Functional MVP has no AGS SDK,
application-owned Cloudflare Worker, D1 database, server secret, or required network call.

### Local application services

- `getOrCreateLocalIdentity` creates/restores a random profile without fingerprinting.
- `createLocalRunRecord` serializes seed, versions, actions, state hashes, and result.
- `saveLocalRun` and `loadLatestLocalRun` own the versioned browser-storage key.
- `stateHash` checks the complete stored payload before the UI says saved or restored.

Browser storage is acceptable here because the product explicitly defines Phase 1B
as device-local. It is not account sync, durable cloud persistence, or competitive authority.

This describes the completed historical Phase 1B milestone. In the connected
runtime, completed-run persistence has moved fully to AGS Cloud Save; the old
latest-run browser key is no longer read or written. A legacy value may remain
on an existing device, but the connected runtime ignores it.

## Functional MVP flow

```text
ChatGPT Sites-ready React app
  -> obtains or restores a random local guest profile
  -> loads and checksum-verifies the latest local run when present
  -> creates a cryptographically seeded, version-pinned challenge
  -> executes offers, selections, assessment, and season simulation in domain
  -> writes the replayable run/result record to versioned browser storage
  -> reads it back, verifies the checksum, and renders the full result
```

## Phase 2 AGS boundary

All AGS work begins in Phase 2 — AGS Foundation:

- IAM Device ID replaces the local profile adapter with an AGS guest identity.
- Cloud Save replaces/adds remote persistence for rich game/run records.
- The Sites managed server runtime is the first-choice trusted replay and
  user-binding boundary.
- Statistics receives only accepted numeric aggregates.
- Leaderboards present trusted ranking values.

The connected player flow keeps a newly completed replay envelope in React state,
writes the corresponding record directly to the player's private Cloud Save slot,
reads it back, and reports success only after schema, owner, checksum, version, and
deterministic replay verification. A later completion replaces the previous latest
cloud record. Reload recovery reads Cloud Save directly instead of reconciling a
second durable browser copy.

React components continue to use application-owned interfaces rather than generated
SDK types. ChatGPT Sites remains the client host and can add server-side request
handlers without introducing a separately provisioned Worker. AGS Extend remains an
option only if live verification shows that its tighter AGS integration or a Sites
runtime limitation materially improves this flow. D1 and a separate application-owned
Worker remain deferred until a concrete storage or runtime requirement justifies them.

## Authority boundary

| Concern | Functional MVP | Phase 2 connected authority |
|---|---|---|
| Presentation | Browser | Browser |
| Offer generation and replay | Shared domain package in browser | Same versioned mechanics in a Sites server handler |
| Assessment and season result | Browser; reproducible, not tamper-proof | Sites server replay derives the canonical result |
| Full run/result record | Checksummed device-local record | AGS Cloud Save under authenticated user; no durable browser duplicate |
| Aggregate progression | Deferred | AGS Statistics after accepted replay |
| Ranking | Deferred | AGS Leaderboards |
| Identity | Random local profile | AGS IAM Device ID plus later account linking |

## Package and dependency boundaries

```text
apps/
  web/                 React product client, local adapters, Sites config
packages/
  domain/              deterministic rules; framework-free
  contracts/           serializable local and later cloud record contracts
  content/             versioned content loaders
  test-fixtures/       golden inputs and expected outputs
data/                  schemas, configs, content, fixtures, reports
tools/                 mechanics/import utilities
docs/                  source design documents
```

`packages/domain` imports no React, network, storage, AGS SDK, Cloudflare, or D1
runtime. Every stored run includes the exact versions required for replay.

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

Domain state is plain serializable data. Presentation state—focus, selected card,
expanded panels, and animation timing—is never part of replay evidence.

## Functional MVP browser and input baseline

| Surface | Required baseline |
|---|---|
| Desktop Chromium | Latest two stable Chrome and Edge releases |
| Desktop Firefox | Latest two stable releases |
| Desktop Safari | Safari 17 and later |
| Mobile Safari | iOS 17 and later |
| Mobile Chromium | Latest two stable Android Chrome releases |
| Viewports | 360×640 minimum, 390×844 primary mobile, 1280×720 primary desktop |
| Input | Pointer, touch, and keyboard; no hover-only action |

## Security and trust baseline

- Local profile IDs are random, versioned, and not browser fingerprints.
- A checksum mismatch prevents saved/restored claims but does not create competitive trust.
- The UI labels Phase 1B results player-authoritative, never ranked or server-verified.
- Phase 2 browser code may contain only public AGS client configuration, never a secret.
- OAuth tokens must not be copied into `localStorage` when AGS is introduced.
- Trusted-service credentials belong only in hosted Sites secrets or another approved
  server-side secret mechanism, never in client-visible environment variables.
- Competitive writes wait for trusted replay and server-owned Statistics operations.

Draft breadth comes from server-owned AGS Game Record
`football11_game_config_v1`. Each start request authenticates the player, reads
and validates the active numeric-schema revision in Sites, and freezes that
revision plus its 3–15 offer and 0–5 reroll limits into a private challenge
receipt. The browser cannot create a draft before receiving the challenge, and
trusted replay rejects a substituted revision or limits. Missing, malformed, or
unavailable configuration fails closed with a retryable start state. Operators
can change later games by adding and activating a revision without changing a
game already in progress.
