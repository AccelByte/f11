# Service Responsibility Map

**Last updated:** September 4, 2026
**Status:** Connected runtime uses AGS Cloud Save as the sole durable latest-run store; Phase 4 friend rooms development-integrated

## Decision

Use ChatGPT Sites for the React build. Prove the complete game locally in Phase 1B,
then maximize AGS in Phase 2. Do not make AGS credentials, Cloudflare Worker code,
or D1 prerequisites for the Functional MVP.

| Concern                                                        | Phase 1B owner                   | Phase 2/later owner                                                                                          |
| -------------------------------------------------------------- | -------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Guest identity                                                 | Random local profile             | AGS IAM Device ID plus account linking                                                                       |
| Full run/result record                                         | Checksummed browser record       | AGS Cloud Save                                                                                               |
| Numeric progression                                            | Deferred                         | AGS Statistics after trusted replay                                                                          |
| Ranking                                                        | Deferred                         | AGS Leaderboards                                                                                             |
| Controlled-joinability friend rooms and optional session codes | Not in Phase 1B                  | AGS Session Management development integration implemented in Phase 4; trusted mutations remain Phase 2 work |
| React hosting                                                  | ChatGPT Sites-ready build        | ChatGPT Sites static client plus managed server runtime when required                                        |
| Deterministic mechanics                                        | Shared domain package in browser | Same package/version in the Sites server runtime                                                             |
| Trusted replay                                                 | Deferred                         | Evaluate the Sites managed server runtime first                                                              |
| Separate Worker / D1                                           | Deferred                         | Add only after a documented unmet requirement                                                                |

## Local-to-AGS migration

The Phase 1B adapters establish the contract without coupling screens to storage:

```text
LocalIdentity       -> Phase 2 IAM Device ID implementation
LocalRunRecordV1    -> Phase 2 CloudRunRecordV1 mapping
local save/readback -> Phase 2 Cloud Save write/readback
player checksum     -> retained integrity check, not trusted authority
```

That migration is now complete. The browser retains the Device ID needed to restore
the development guest, but it no longer persists or reads completed run records. Any
legacy latest-run value is ignored rather than imported. A completion is mapped
directly to the private Cloud Save record, written, read back, and replay-
verified. Because the key explicitly represents the latest run, a newer completion
replaces the previous cloud value, including an obsolete or damaged slot. Reload
recovery reads the cloud value directly, eliminating local/cloud reconciliation.

## Why Cloud Save, not Statistics

A run contains seed, version pins, ordered actions, state hashes, XI, assessment,
38 match outcomes, explanation facts, and the final hash. Cloud Save is the intended
AGS home for that structured player/game record. Statistics is reserved for small
trusted numeric values that drive leaderboards, achievements, or progression.

Phase 2 therefore stores rich game data in Cloud Save and writes Statistics only
after trusted replay accepts the run.

## Trust limitation

Phase 1B checksums catch malformed or modified local records but do not stop a player
from changing browser code and recomputing a checksum. Direct player Cloud Save writes
will have the same authority limitation. Competitive results require an authenticated
trusted replay boundary that derives both user identity and result.

The first implementation choice is a server-backed ChatGPT Sites deployment. Sites
server code runs in a managed Cloudflare Workers runtime, so the existing hosted app
can expose the authenticated replay endpoint without provisioning a second hosting
surface. The static Functional MVP remains unchanged; server execution is introduced
only for the connected competitive slice.

AGS Extend remains a valid alternative when live evidence shows that native AGS
authentication, routing, SDK access, latency, or operational integration materially
outweighs keeping the trusted endpoint with the Sites application. A separately
provisioned Cloudflare Worker is the final runtime fallback. D1 remains excluded unless
idempotency or another concrete relational/transactional requirement cannot be
represented safely with the selected AGS records and operations.

## Module growth path

1. **Phase 1B:** local profile + checksummed latest-run persistence.
2. **Phase 2:** IAM Device ID + Cloud Save + trusted replay + Statistics + Leaderboards.
3. **Phase 3:** daily challenges, public result sharing, share assets, and synced history.
4. **Phase 4:** the development integration now uses AGS Session Management for
   discoverable rooms whose joinability closes during drafts and reopens at reveal,
   optional native session join codes, and repeated rounds in one active no-server
   session. The template is nonpersistent because live AGS metadata reserves
   persistence for DS sessions. Production leader/result authority still routes
   through the Phase 2 trusted-boundary work.
5. **Phase 5:** trusted saved-XI discovery and settlement; add non-AGS storage only
   when evidence proves it necessary.

## Browser secret rules for Phase 2

- Use an AGS public client in the browser.
- Never ship a confidential client secret in browser JavaScript or client-visible
  Sites configuration; server-only values use hosted Sites secrets.
- Keep SDK access behind application adapters.
- Do not persist OAuth access tokens in browser storage.
- Verify exact SDK operations, permissions, Cloud Save limits, and namespace
  configuration against the selected versions before live integration.
