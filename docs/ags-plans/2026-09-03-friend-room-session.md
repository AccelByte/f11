# Stage 5: Friend rooms

[Integration tutorial](../12-accelbyte-integration-guide.md#stage-5) · [All plans](README.md)

**Status:** Not started on the offline starter branch.

## Prerequisites

Device ID works for two isolated players. Solo drafting works. Complete server-issued challenges first if rooms need verified results.

## Implementation scope

Plan an AGS Session template for small no-dedicated-server rooms and use Lobby for notifications. Implement create/discover/join/leave, readiness, reconnect, and a shared round lifecycle. Define member-specific seeds, deadlines, and result ownership explicitly before implementation. Keep every player's draft in the shared mechanics engine.

Keep `apps/web/src/game/session.ts` as the adapter around `packages/domain`;
preserve the existing draft, reroll, and season behavior. Inspect the actual
branch and installed SDK signatures before choosing API calls. The online
reference implementation is on public main (development master); it is not
present on the offline starter. Inspect only the relevant feature when needed.

## Acceptance checks

Two isolated guests converge on membership and readiness; draft/reveal transitions agree; leave/rejoin and interrupted connections recover; unauthorized mutations are rejected or clearly documented as an unresolved cooperative-prototype boundary.

Run `npm run typecheck`, `npm test`, and `npm run build`. Record automated,
live-service, and browser evidence separately in the progress tracker. Missing
credentials or service access are blockers, not successful verification.

## Outside this step

Matchmaking, AMS, dedicated servers, and claiming client-written room results are authoritative.

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



### Confirmed service contract
- Template: `football11-friend-room-v1`.
- Server type: `NONE`; Matchmaking, AMS, and a dedicated/listen server are not used.
- Persistence: `false`, because AGS persistent sessions are dedicated-server only.
- Initial joinability: `OPEN`.
- Capacity: minimum 1; application maximum configurable and bounded to 1–8, with 8
  as the current template/default value.
- Initial operations: public create, read, available-session query, join by ID,
  join by code, partial update, code revoke/regenerate, and leave.
- Lifecycle: 24-hour TTL, 120-second inactive timeout, 60-second invite timeout,
  and native code generation enabled.

Authenticated AGS CLI readback confirms this template. The TypeScript application
pins `@accelbyte/sdk` 4.3.3, IAM 6.3.6, Session 5.3.6, and Lobby 5.2.8. Generated
browser bundles identify their internal generated modules one patch lower; the
package manifests and lockfile remain the installation authority.

The earlier Public-client permission update did not persist in IAM readback, so it
is not claimed as configured evidence. Real Device-user Session calls nevertheless
prove that the target client can perform every operation used by the current flow.

### Lobby grounding
The TypeScript Lobby SDK exposes the raw `messageSessionNotif` websocket envelope,
but not typed Session V2 topic payloads. Inspection of the project's pinned Unreal
SDK confirms the relevant topic names:

- `OnSessionJoined`;
- `OnSessionMembersChanged`;
- `OnGameSessionUpdated`; and
- `OnSessionEnded`.

Football 11 therefore treats Lobby messages as invalidation hints and always reads
the canonical Session snapshot after a relevant notification. A four-second bounded
poll remains the missed-event and reconnect fallback. Browser QA also found that the
generated Lobby client creates its native socket inside `connect()`, so callbacks
must be registered after that call.

### Trust boundary and remaining release work
This is a functional development integration, not a production-authoritative room
aggregate. Every current Session member that has public update permission can PATCH
attributes, so browser checks for leader authority, readiness, progress, and result
submission are cooperative guards rather than an anti-cheat boundary. The completed
Phase 2 trusted replay service now binds ranked room evidence to canonical Session
membership and seed derivation. Trusted room-start mutations and receipt-backed
comparison acceptance are still required before Phase 4 results are suitable for
competitive release.

The remaining Phase 4 exit work is visible-browser coverage for explicit abandon,
deadline timeout, and host loss, followed by a repeat of the authority-sensitive
cases against the Phase 2 trusted handler. These gaps do not block continued
development of the primary friend-room loop, but they do block calling Phase 4
production-complete.

## Agent handoff prompt

```text
Use the AccelByte AGS skill and docs/ags-plans/2026-09-03-friend-room-session.md as the
implementation plan for this stage only. Inspect the current branch and completed
prerequisites first. Resolve any missing environment or authorization settings
before dependent implementation. Preserve existing offline mechanics, implement
the scoped player flow, and run every acceptance check. Record automated,
browser, and live-service evidence separately in docs/10-progress-tracker.md.
Report blockers honestly and stop before the next stage.
```
