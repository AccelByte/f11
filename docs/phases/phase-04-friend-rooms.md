# Phase 4 Detailed Plan — AGS Friend Rooms

**Last updated:** September 4, 2026
**Status:** Development integration implemented and primary multi-browser loop verified; production trust and recovery exit cases remain
**Parent roadmap:** [07 — MVP roadmap](../07-mvp-roadmap.md)

## Planning outcome

Phase 4 adds a visible `Play with friends` path around the already-proven draft.
An authenticated player creates an AGS-backed room as its first member. The session
is discoverable with `joinability=OPEN` while waiting between rounds, so other
authenticated players can browse and join a compatible room with an open slot; a
native session code remains an optional direct-join path. Starting a round changes
joinability to `CLOSED` before locking participants. `REVEAL` changes it back to
`OPEN`, then the room counts down into another challenge without replacing the AGS
session.

The mode is simultaneous but not a shared simulation. Every participant receives
the same challenge ID, base seed, and mechanics versions, then derives a deterministic
player seed from that challenge and the authenticated AGS user ID before making
private draft choices. Different members therefore receive different streams while
each member can reproduce their own draft after reconnecting. AGS owns the online
room wrapper; Football 11 continues to own offers, selections, assessment,
simulation, and replay validation.

This document now records both the approved design and the implementation evidence
for P4-01 through P4-07. The primary three-origin create/join/start/draft/reveal/
replay loop is working against live AGS Session and Lobby services. Production
authority and the remaining abandon/timeout/host-loss browser matrix are still open.
The service-level plan and evidence are recorded in
[`docs/12-accelbyte-integration-guide.md#stage-5`](../12-accelbyte-integration-guide.md#stage-5).

## Implementation evidence

- The live `football11-friend-room-v1` template is `NONE`, nonpersistent, initially
  `OPEN`, code-enabled, and configured for 1–8 players.
- Session/Lobby clients share the authenticated SDK and are instantiated only after
  Device login installs its token.
- The room browser, direct joins, readiness, leader start, `OPEN`/`CLOSED`
  transitions, private drafts, progress, comparison, countdown, and replay are
  implemented in the web app.
- Session V2 websocket messages are refresh hints; canonical Session reads plus a
  four-second fallback poll own convergence.
- A redacted live probe passes create/read/discover/join/update/close/reopen/code/
  migration/leave behavior, including attributes-only updates while `CLOSED`.
- Three isolated browser origins pass the primary flow. The room is hidden during
  drafting, reappears during countdown, and advances from ordinal 2 to 3 in the same
  AGS session with a fresh challenge and base seed.
- Mid-draft reload restores a 3/11 action prefix. A browser race that could reopen a
  locally completed copy of the same challenge was found and fixed.
- The compact Session-attribute aggregate is development-only authority. Ranked room
  replay now binds the authenticated player to canonical Session membership,
  challenge versions, and server-derived player seed; leader/start mutations and
  receipt-backed comparison acceptance still need the trusted boundary.

## Repository evidence

- `apps/web/app/page.tsx` now exposes home, room discovery, room, draft, and result
  screens with online lifecycle coordination.
- `apps/web/src/services/ags/authGateway.ts` owns a private authenticated SDK
  instance. A future room integration needs one application-owned authenticated
  session context; it must not create a second token store or expose tokens to
  React components.
- `apps/web/package.json` pins `@accelbyte/sdk` 4.3.3, IAM 6.3.6, Session 5.3.6,
  and Lobby 5.2.8.
- `apps/web/src/game/session.ts` includes a constructor that accepts the room's
  challenge ID, base seed, strategy, mechanics-version bundle, and authenticated
  player identity without changing domain rules.
- `@football-11/domain` is framework-free and deterministic. Existing tests prove
  complete seeded drafts, rerolls, replay hashes, assessment, and 38-match results.
- `@football-11/contracts` now includes versioned room, progress, result-summary,
  and comparison contracts.
- Local persistence produces `LocalRunRecordV1`, while Phase 2 provides verified
  Cloud Save synchronization and trusted replay. Completed room records preserve
  their AGS session context through both stores, while in-progress action prefixes
  remain user-scoped in browser `sessionStorage`.
- Bundled AGS references establish IAM user-token calls, Session membership and
  reconnect responsibilities, and the need to verify exact lifecycle names.
- A local read-only inspection of AccelByte Unreal SDK 28.9.0 provides supporting
  cross-SDK evidence: Session models define `OPEN` and `CLOSED` joinability, `NONE`
  server type, `MinPlayers`, `MaxPlayers`, `Persistent`, availability queries, and
  session codes. `UpdateGameSession` accepts an update request whose base fields
  include `Joinability`. Lobby receives a websocket envelope named
  `messageSessionNotif`, dispatches the `OnSessionMembersChanged` topic, and exposes
  joined/updated/ended topics. The membership payload includes session ID, members,
  joiner ID, leader ID, the full session, and impacted user IDs. This does not prove
  that the TypeScript SDK exposes the same operations, event names, or subscription
  helpers.
- Authenticated AGS CLI 0.5.0 created and read back the target Shared Cloud Session
  template. The attempted Public-client permission change did not persist in IAM
  readback, so it is not claimed as configuration evidence; real Device-user calls
  prove create/get/update/join/leave/code access for this integration.
- Resolved TypeScript package types expose create, available-query, get, update,
  join, leave, code generation/revocation, and join-by-code operations. Lobby exposes
  a raw `messageSessionNotif` envelope through `Lobby.WebSocket.onMessage`; typed V2
  topic payloads are not exported, so notifications remain validation-and-refresh
  hints rather than authoritative room state.
- Live template metadata corrects one earlier assumption: AGS `persistent=true`
  applies only to dedicated-server sessions. Football 11's `type=NONE` template
  uses `persistent=false`; repeated rounds reuse one active session until leave,
  expiry, or termination.

## Revised product contract

The creator minimum, configurable eight-member cap, controlled discovery, optional
code, and same-active-session repeat-round lifecycle reflect the September 3 product
revisions. Closing joinability during an active round resolves the previous late-join
question: no new member enters an in-flight participant set. The primary operations
and transition races are now live-verified; production authority remains separate.

| Rule                | Proposed baseline                                                                                                                                                                                                                                                                                                                                                           |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Room size           | Create and start with 1 member; maximum 8 session members. All limits are configuration values.                                                                                                                                                                                                                                                                             |
| Join path           | The session is discoverable while `joinability=OPEN` and it has a slot. Join by session ID is primary; the native session code is optional.                                                                                                                                                                                                                                 |
| Joinability window  | `OPEN` in `WAITING`, `REVEAL`, and `COUNTDOWN`; `CLOSED` in `STARTING` and `DRAFTING`. A join attempt during an active round is rejected rather than added to the session.                                                                                                                                                                                                  |
| Readiness           | For the first round, every intended active participant opts in; a solo creator may start. During repeat play, the intermission locks only active opted-in members, so an idle member cannot block the room.                                                                                                                                                                 |
| Start authority     | The current AGS session leader may start the first round or skip the countdown; timer expiry may start later rounds without the leader. Duplicate starts for one ordinal return the same challenge.                                                                                                                                                                         |
| Replay              | Entering `REVEAL` reopens AGS joinability and starts a configurable intermission countdown (initial value: 30 seconds), then the same active session closes joinability and advances to a fresh challenge ordinal/base seed. Every participant derives a new player stream. The no-server template is nonpersistent because AGS reserves `persistent=true` for DS sessions. |
| Draft privacy       | Other members see display name, presence, ready state, selected count, and finish state—not offers, picks, slots, scores, or XI                                                                                                                                                                                                                                             |
| Result reveal       | A player sees their accepted result immediately; the round comparison opens when all locked participants finish or the configurable 15-minute challenge deadline expires                                                                                                                                                                                                    |
| Ranking             | Points descending, then wins, then composite score; exact equality remains a tie and finish speed is never a tiebreaker                                                                                                                                                                                                                                                     |
| Disconnect          | Temporary disconnect marks a member inactive but preserves the locked challenge and replay prefix until the deadline                                                                                                                                                                                                                                                        |
| Explicit leave      | Before start, remove the member; after start, mark that participant abandoned without changing everyone else's seed or result                                                                                                                                                                                                                                               |
| Session termination | Football 11 uses `TERMINATED` only when the AGS session ends, expires, is explicitly destroyed, or cannot recover. AGS `joinability=CLOSED` is temporary and does not terminate the session.                                                                                                                                                                                |
| Host loss           | Before the first round, use native leader migration if verified; otherwise close. During later rounds, locked play and the auto-start timer do not depend on host presence.                                                                                                                                                                                                 |

The 1-player minimum, 8-player maximum, 15-minute round deadline, and 30-second
intermission countdown must be configuration values so product testing can change
them without rewriting the state model.

## Non-goals

- Do not start or modify Phase 2 implementation as part of Phase 4 planning.
- Do not begin Phase 3 daily challenges or sharing.
- Do not submit Matchmaking tickets, configure a ruleset, or form rooms from queues.
- Do not allocate AMS or run a dedicated/listen server.
- Do not synchronize card pools, block a card selected by another member, expose
  live picks, or add spectating/chat. New membership is disabled during an active
  draft and resumes at reveal.
- Do not add a Durable Object, D1, AGS Extend, or a separate Worker without a
  verified storage, atomicity, or runtime gap.
- Do not write room values to AGS Statistics or Leaderboards; comparison is scoped
  to the current room.

## Dependency map

| Phase 4 item                              | Required Phase 2 evidence                                                                                                                                                               | Can be designed or prototyped independently                                                                        |
| ----------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| P4-01 — AGS game session                  | P2-01 is complete. Needs an authenticated SDK/session owner and live Session/Lobby package and operation discovery. P2-06 blocks public release, not development.                       | Session adapter interface, room state reducer, mock connection/session gateway, and UI states                      |
| P4-02 — Open discovery and optional code  | P4-01 plus verified available-session query, join-by-ID, code retrieval/generate/join/revoke operations, and `OPEN`/`CLOSED` joinability updates; no P2B dependency for a service smoke | Browse/join UI, code-entry normalization, generic error mapping, joinability-transition races, and mocked flows    |
| P4-03 — Membership/readiness/start        | The completed P2-03 Sites handler must be extended to authorize leader/membership mutations.                                                                                            | Pure membership guards, readiness reducer, idempotent command tests, and working development UX                    |
| P4-04 — Per-player deterministic drafting | Wire the completed P2-03 replay boundary and P2-02 Cloud Save contract into room challenge issuance and durable recovery.                                                               | Multi-client deterministic fixtures and a game-session constructor that derives from challenge and player identity |
| P4-05 — Progress/comparison               | P2B record mapping and P2C trusted replay/identity binding are required. P2D Statistics and P2E Leaderboards are not required.                                                          | Privacy projections, comparison sorting/ties, timeout views, and fixtures                                          |

There is no Phase 3 dependency. Phase 4 may be implemented after its Phase 2
prerequisites even while Phase 3 remains intentionally deferred.

## Architecture and trust boundaries

```text
React room and draft UI
  -> room machine and Football 11 view models
  -> AGS browser adapters using the authenticated player's in-memory token
       -> online connection / OPEN Session query and join / membership events
       -> optional native session code retrieval and direct join
  -> Sites server room API using the same bearer identity as request context
       -> validate token and namespace
       -> verify session membership and current leader when required
       -> create/fetch the immutable challenge
       -> replay action prefixes and completed runs with @football-11/domain
       -> persist trusted room/run records through the Phase 2 storage boundary
  -> React renders projections; it never owns room or football authority
```

### Simulation boundary

- `@football-11/domain` remains the only owner of offer generation, legal draft
  transitions, assessment, season simulation, explanations, and state hashes.
- The browser runs the domain package for responsive play, but its output is a
  preview until trusted replay accepts the same challenge and ordered actions.
- The trusted handler chooses supported content/rules/RNG/offer/assessment/season/
  explanation versions. It ignores client-claimed scores and roster summaries.
- A shared round base seed establishes one challenge, while a versioned derivation
  with the challenge ID and AGS user ID gives each participant a distinct, replayable
  offer and simulation stream.

### Render boundary

- React/DOM owns room navigation, session-code input, roster/readiness, progress, draft,
  reconnect banners, and comparison views.
- The room machine supplies render-ready state. Components do not interpret raw
  generated SDK responses or decide whether a transition is legal.
- Presentation-only state—focus, copy-code feedback, expanded result rows, animation,
  and retry button state—is not persisted as room evidence.

### Network and authority boundary

- AGS Session is authoritative for the live session identity, current `OPEN` or
  `CLOSED` joinability, available-slot discovery, membership, leader, inactive
  members, leave, and optional code validity, subject to TypeScript operation
  verification.
- Session attributes may carry only a small phase/revision pointer if their size,
  visibility, writer authorization, and conditional-update behavior are verified.
  They are not assumed to be the authoritative run database.
- The trusted Sites handler is authoritative for round ordinal, participant locking,
  start idempotency, challenge seed/version selection, replay-prefix validation,
  completion, abandonment, deadline, intermission countdown, next-round start, and
  comparison projection.
- Before start, trusted mutations validate current AGS membership and leader state,
  change joinability to `CLOSED`, then reconcile the canonical roster before locking
  participants. After a round starts, progress and submission authorize the validated
  user against that round's immutable participant roster. The reveal transition
  changes joinability back to `OPEN` before publishing the next-round countdown.
- Phase 2's selected AGS Cloud Save pattern is the preferred durable record store.
  Before using it for a room aggregate, verify server-side cross-player/global
  record support, visibility, limits, and create-if-absent/update semantics. If it
  cannot satisfy the contract, document that exact gap before selecting another
  store.
- Realtime events are hints that prompt refresh. Every client reconciles from an
  authoritative snapshot by revision after reconnect, focus return, or a missed
  event. No event is treated as the only durable record of a transition.

## Room and client state models

The authoritative room lifecycle is deliberately smaller than the UI lifecycle:

```text
WAITING
  -> STARTING
  -> DRAFTING
  -> REVEAL
  -> COUNTDOWN
  -> STARTING (next round)

Any phase -> TERMINATED  explicit end, session expiry, or unrecoverable session loss
DRAFTING -> REVEAL      all round participants terminal or deadline reached
REVEAL -> COUNTDOWN     comparison published and intermission timer begins
COUNTDOWN -> STARTING   at least one active opted-in member is available
```

`READY` is a derived first-round start guard, not a persisted phase. A room can be
created and started by one member. During `COUNTDOWN`, each active member may opt in
or sit out; timer expiry locks only opted-in members, with a minimum of one.
`CREATING`, `DISCOVERING`, `JOINING`, `RECONNECTING`, `ERROR`, and `OFFLINE` are
client/member states rather than authoritative room phases.

AGS joinability is a separate state: `OPEN` in `WAITING`, `REVEAL`, and `COUNTDOWN`,
then `CLOSED` throughout `STARTING` and `DRAFTING`. `TERMINATED` is the irreversible
Football 11 phase for an ended or unrecoverable AGS session; temporary
`joinability=CLOSED` never means the room has ended.

Each accepted transition increments a monotonic `roomRevision`. Commands include an
idempotency key and expected revision. A stale client refreshes instead of guessing.

## Proposed serializable contracts

These are Football 11 contracts, not assumed AGS SDK shapes. They belong under
`packages/contracts` when implementation is approved.

```ts
type RoomPhase = 'WAITING' | 'STARTING' | 'DRAFTING' | 'REVEAL' | 'COUNTDOWN' | 'TERMINATED';
type MemberPresence = 'ACTIVE' | 'INACTIVE' | 'LEFT';
type MemberRunStatus = 'NOT_STARTED' | 'DRAFTING' | 'FINISHED' | 'ABANDONED';

type FriendRoomMemberV1 = {
  userId: string;
  displayName: string;
  role: 'LEADER' | 'MEMBER';
  presence: MemberPresence;
  ready: boolean;
  nextRoundOptIn: boolean;
  joinedAt: string;
};

type FriendRoomSnapshotV1 = {
  schemaVersion: 'football11-friend-room-v1';
  roomId: string;
  agsSessionId: string;
  phase: RoomPhase;
  revision: number;
  joinability: 'OPEN' | 'CLOSED';
  maxMembers: number;
  leaderUserId: string;
  members: FriendRoomMemberV1[];
  roundOrdinal: number;
  challengeId: string | null;
  countdownEndsAt: string | null;
  serverTime: string;
};

type RoomChallengeV1 = {
  schemaVersion: 'football11-room-challenge-v1';
  challengeId: string;
  roomId: string;
  agsSessionId: string;
  roundOrdinal: number;
  seed: string;
  versions: MechanicsVersion;
  formationId: FormationId;
  participantUserIds: string[];
  startedAt: string;
  deadlineAt: string;
};

type RoomProgressPrivateV1 = {
  challengeId: string;
  userId: string;
  runRevision: number;
  actions: DraftAction[];
  stateHashes: string[];
  selectedCount: number;
  status: MemberRunStatus;
  updatedAt: string;
};

type RoomProgressPublicV1 = Pick<
  RoomProgressPrivateV1,
  'userId' | 'selectedCount' | 'status' | 'updatedAt'
>;

type RoomComparisonEntryV1 = {
  userId: string;
  displayName: string;
  status: 'FINISHED' | 'ABANDONED' | 'TIMED_OUT';
  result: RunResult | null;
  rank: number | null;
};
```

The server derives the public progress projection from a replay-valid private action
prefix. Clients never write `selectedCount`, `status`, `rank`, or result totals as
authoritative values. Display-name enrichment is a separate AGS call and permission
check from Session access.

### Command contracts

Every mutation returns the newest room snapshot and is safe to retry:

- `createRoom({ idempotencyKey })`
- `queryOpenRooms({ cursor, filters })`
- `joinRoom({ roomId, idempotencyKey })`
- `getOptionalJoinCode({ roomId })`
- `generateSessionCode({ roomId, idempotencyKey })`
- `joinRoomByCode({ code, idempotencyKey })`
- `setReady({ roomId, ready, expectedRevision, idempotencyKey })`
- `setNextRoundOptIn({ roomId, optedIn, expectedRevision, idempotencyKey })`
- `startRoom({ roomId, expectedRevision, idempotencyKey })`
- `saveProgress({ challengeId, runRevision, actions, idempotencyKey })`
- `submitRun({ challengeId, actions, idempotencyKey })`
- `leaveRoom({ roomId, expectedRevision, idempotencyKey })`
- `revokeSessionCode({ roomId, expectedRevision, idempotencyKey })`

The physical split between direct browser-to-AGS calls and Sites server endpoints is
decided only after operation and permission discovery. Football 11 command semantics
remain stable across that split.

## P4-01 — Create AGS game session

### Player outcome

After verified Device ID login, `Play with friends` reaches an online-ready state.
The host creates a room and sees a waiting lobby with their identity as leader.

### Planned work

1. Discover and pin the compatible TypeScript Session/Lobby packages and resolved
   versions; inspect their local source before naming SDK methods.
2. Refactor the private SDK ownership in `authGateway.ts` into one authenticated
   application service that can supply authorized module clients without exposing a
   token. This is shared auth code and requires plan approval before editing.
3. Add `onlineConnectionGateway` only if the selected browser Session flow requires
   a Lobby/WebSocket connection for events.
4. Add `sessionGateway` behind Football 11 types and error codes.
5. Create a nonpersistent, server type `NONE`, no-Matchmaking session with initial
   joinability `OPEN`, using the verified template/configuration, one initial member,
   and configurable maximum 8; keep it active and reuse it across rounds until
   leave, expiry, or termination.
6. Reconcile the returned session into `FriendRoomSnapshotV1` and render creating,
   waiting, offline, retry, and close states.

### AGS verification gate

- Exact session template/config ID and environment.
- Session type/server allocation fields that prove no AMS claim is triggered.
- Browser create/read/leave operations and whether Lobby connection is mandatory.
- Member, leader, inactive-timeout, nonpersistent `NONE`, minimum 1, configurable
  maximum 8, and session-lifetime behavior.
- Public user-token permissions for create/read/leave and any event subscription.

### Acceptance tests

- Adapter tests map generated SDK responses/errors without leaking SDK types.
- A double-click sends one create command and returns one room/session identity.
- One authenticated browser creates a minimum-1, maximum-8, nonpersistent no-DS session
  with initial joinability `OPEN` and reads back itself as leader.
- Offline and expired-token failures stay recoverable and never show a false room.

## P4-02 — Discover and join an open room with optional native code

### Player outcome

Any authenticated player can browse compatible available Football 11 sessions and
join one by session ID while it has an open slot. The creator can retrieve/display a
native code as an optional direct path, but the code is not required for the initial
integration.

### Planned work

1. Discover the exact available-session query and join-by-ID operations. Query only
   compatible `OPEN`, non-full Football 11 rooms using a versioned mode attribute.
2. Add browse, refresh, pagination/empty, joining, full-race, stale-result, and
   recoverable-error states. Never treat a query result as proof that a slot remains.
3. Discover the native code retrieval/generate/join/revoke operations, then add them
   as a secondary manual path without making the main flow depend on them.
4. Normalize code input for whitespace and case only as the verified contract allows;
   never log or persist the code in analytics or local storage.
5. Keep joinability `OPEN` during `WAITING`, `REVEAL`, and `COUNTDOWN`; change it to
   `CLOSED` before `STARTING` locks participants and keep it closed through
   `DRAFTING`. Reopen it when the trusted room enters `REVEAL`.

### AGS verification gate

- Confirm the TypeScript Session package exposes available-session query, attribute
  filters, pagination, join-by-ID, full/open fields, and update joinability for the
  selected environment.
- Confirm Session Management exposes code retrieval or generation, join-by-code,
  expiry, and revocation for the selected environment and SDK version.
- Verify code format, case sensitivity, lifetime, regeneration behavior, rate limits,
  room-full response, and whether revoke affects existing members.
- Discover permissions separately for query, join-by-ID, joinability update, code
  retrieval/generation, join-by-code, and revoke.

Unreal SDK 28.9.0 provides `QueryGameSessions`, `JoinGameSession`,
`JoinGameSessionByCode`, `GenerateNewGameSessionCode`, and
`RevokeGameSessionCode`, but their presence is supporting evidence only. The web
implementation now uses the corresponding TypeScript operations and has live service
evidence for discovery, ID/code join, close/reopen, revoke, and regeneration.

### Acceptance tests

- Query tests exclude full, closed, wrong-mode, and incompatible-version sessions.
- Two distinct authenticated test users discover/join the same AGS session ID and
  both reconcile the same roster.
- A query-to-join slot race returns a visible full/stale result without partial local
  membership.
- Starting a round removes the room from discovery and rejects both join-by-ID and
  join-by-code until `REVEAL` reopens joinability.
- Optional code retrieval, entry, normalization, copy, retry, and revocation work
  without affecting discovery/join-by-ID during an `OPEN` window.
- Codes never appear in logs, URLs, persisted browser state, or error telemetry.

## P4-03 — Membership, readiness, and start rules

### Player outcome

All clients see the same roster, presence, leader, readiness/opt-in state, round
ordinal, and countdown. The leader can start the first round; later rounds start
automatically when the countdown expires and at least one active member is opted in.
Each accepted start locks that ordinal's participants and returns one challenge, even
when requests retry or arrive concurrently.

### Planned work

1. Implement the pure room reducer and selectors: `canJoin`, `canReady`, `canStart`,
   `canOptInNextRound`, `canLeave`, `shouldReveal`, and `shouldAutoStart`.
2. Reconcile AGS roster/leader/inactive events by session revision or fetched
   snapshot, not event arrival order. Use the V2 membership websocket as an
   invalidation signal when the TypeScript SDK exposes it, then fetch canonical
   session state.
3. Let members update only their own readiness. The trusted start handler validates
   the caller's AGS token, namespace, current session, leader role, member count, and
   first-round readiness guard. A solo leader is valid.
4. At first start or countdown expiry, change AGS joinability to `CLOSED`, refetch the
   canonical session, and verify that roster, revision, and eligibility still satisfy
   the guard. If they do not, create no challenge and reopen/reconcile the room.
5. Lock 1–8 eligible user IDs for the next `roundOrdinal`, then create/fetch one
   challenge from a deterministic round identity or verified create-if-absent record.
6. Before publishing `REVEAL` and its countdown, change joinability back to `OPEN`
   and confirm the canonical Session state.
7. Return `409 STALE_ROOM_REVISION` for an obsolete view and the canonical challenge
   for any duplicate accepted start.

### Acceptance tests

- A solo creator can start. No round locks zero participants, more than the configured
  maximum, an ineligible member, or a non-leader caller for a manual first start.
- A user cannot set another member's readiness or forge leader status.
- Two concurrent starts for one ordinal create one challenge ID/base seed and one
  participant set.
- A join racing with start either completes before the post-close roster check or is
  rejected by `joinability=CLOSED`. A changed/unready roster aborts that start and
  reopens the room; no player is half-included.
- `REVEAL` reopens joinability and starts one countdown; duplicate expiry handling
  closes joinability and creates one next ordinal.
- Before-start leader loss follows the verified migration-or-close rule.

## P4-04 — Per-player deterministic simultaneous drafting

### Player outcome

Every participant locked for one round ordinal receives the same challenge ID, base
seed, strategy marker, and mechanics versions. Each client combines the base seed,
challenge ID, and authenticated AGS user ID into a compact deterministic player seed,
then drafts independently through the existing UI. No player's choice or seed changes
another player's offer stream, and closed joinability prevents new membership during
the active draft.

### Planned work

1. Add an explicit game-session factory input for authoritative `challengeId`,
   `roundOrdinal`, base `seed`, `seedStrategy`, `versions`, and authenticated player
   identity; keep random solo creation as a separate caller.
2. Load only version combinations supported by the trusted handler and checked-in
   content package.
3. Persist replay-valid action prefixes through the Phase 2 storage boundary. Each
   update includes `runRevision`; the server rejects regression and conflicting
   histories, replays the prefix, and derives the public progress projection.
4. On reconnect, fetch the canonical challenge and latest accepted action prefix,
   replay it locally, then resume. Never merge two divergent action histories.
5. Submit the complete ordered actions to the existing trusted replay path and use
   the accepted result as the member's finish transition.
6. On the next ordinal, create a fresh challenge/base seed and derive a fresh stream
   for every participant; never merge action prefixes or results from two room rounds.

### Acceptance tests

- Recreating one member's session for the same challenge reproduces the same seed,
  opening offer, and replay path.
- Two members sharing one challenge derive distinct seeds and opening offers without
  cross-player exclusions.
- A new ordinal changes each member's derived stream, while an unmarked legacy
  challenge retains the former shared-seed replay path.
- Join-by-ID and join-by-code attempts during drafting fail cleanly while existing
  participants continue unaffected.
- Refresh after rounds 0, 5, and 11 restores the exact accepted prefix and offer.
- Unsupported versions, altered seed, illegal selection, invalid reroll, stale
  prefix, and conflicting history are rejected without advancing public progress.
- A browser-computed score is never accepted without trusted replay.

## P4-05 — Progress and comparison results

### Player outcome

During drafting, room members see only approved progress. On reveal, they see a
stable comparison of accepted results plus clear abandoned/timed-out states and the
countdown to the next round in the same room.

### Planned work

1. Project only display name, presence, selected count, and status while drafting.
2. Fetch snapshots after room events, every bounded polling interval while visible,
   on window focus, and after reconnect. Back off while offline or hidden.
3. Let each finished player see their own accepted result immediately, but keep other
   scores/XIs private until `REVEAL`.
4. Reveal when all locked participants are terminal or `deadlineAt` passes. Convert
   unfinished non-abandoned participants to `TIMED_OUT` in the comparison projection.
5. Sort finished entries by points, wins, then composite; assign competition ranks
   with equal values tied. Abandoned/timed-out entries remain unranked.
6. Reopen AGS joinability before publishing comparison, then start a configurable
   intermission countdown. Allow members to opt in/out, admit compatible newcomers,
   and automatically start one fresh ordinal when at least one eligible member
   remains.
7. Preserve immutable accepted results by room ID plus ordinal after the room advances
   or the session closes, according to Phase 2 retention rules.

### Acceptance tests

- Public progress cannot expose action lists, offered cards, selected players, slots,
  hashes, or provisional scores.
- A fabricated selected count/result is ignored; the server projection reflects only
  replay-valid evidence.
- Reveal does not happen early, happens once when all finish, and happens at the
  deadline when one player is unfinished.
- Reveal confirms `joinability=OPEN`; a compatible newcomer can then join and opt in
  for the next ordinal without receiving the completed challenge.
- Countdown starts once, exposes server-relative remaining time, and creates exactly
  one next ordinal at expiry; with zero opted-in members it pauses instead of looping.
- Sorting, tied ranks, abandon, timeout, and zero-finished edge cases are deterministic.
- A missed event or reconnect converges to the same revision and comparison in every
  browser.

## Expected UX transitions

### Host

```text
Home
  -> Play with friends
  -> Connecting online
  -> Creating room
  -> Open waiting room + roster + optional code
  -> Start enabled when guard passes
  -> Starting (AGS joinability closes; round participants lock)
  -> Drafting + private draft + public progress rail
  -> Own result waiting room
  -> Comparison reveal + next-round countdown
  -> Fresh round in the same room, or close/leave
```

### Joining member

```text
Home
  -> Browse open rooms
  -> Join available room by session ID
  -> optionally enter a direct session code
  -> Joining
  -> Waiting room + roster
  -> Ready
  -> Drafting
  -> Own result waiting room
  -> Comparison reveal + next-round countdown
  -> Fresh round in the same room, sit out, or leave
```

Back/cancel is state-specific: cancel create/join returns home; leaving `WAITING` or
`COUNTDOWN` removes membership; leaving `DRAFTING` requires an abandon warning;
leaving a result screen does not delete an accepted result. Closing the room is a
separate explicit leader action and is never implied by finishing a round.

## Failure, reconnect, and convergence contract

| Condition                                      | Required behavior                                                                                                                                                                                           |
| ---------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Open-room query is empty/stale                 | Show refreshable empty state; joining a stale/full result fails cleanly without local membership                                                                                                            |
| Invalid, expired, or unknown code              | Stay on join screen, show one generic retryable message, and do not reveal whether a private room exists                                                                                                    |
| Full or non-joinable room                      | Show a terminal join explanation and return to discovery/code entry                                                                                                                                         |
| Join attempted during `STARTING` or `DRAFTING` | AGS rejects the non-joinable session; show a retryable unavailable state and return to discovery without local membership                                                                                   |
| Member joins during `REVEAL` or `COUNTDOWN`    | Show the completed-round comparison/intermission context and allow opt-in for the next participant lock; never expose the completed challenge's private state                                               |
| Lost connection in waiting room                | Disable mutations, show reconnecting, then reconcile room and readiness from a fresh snapshot                                                                                                               |
| Lost connection during draft                   | Keep local UI read-only until identity/session recovers; fetch the accepted prefix and resume from canonical state                                                                                          |
| Local actions ahead of accepted prefix         | Retry the exact idempotent progress command; on conflict, stop and show recovery instead of merging                                                                                                         |
| Member inactive before start                   | Start remains disabled until recovery or removal under the verified Session policy                                                                                                                          |
| Member inactive after start                    | Preserve participant slot and accepted prefix until deadline                                                                                                                                                |
| Explicit leave after start                     | Confirm abandonment, mark terminal, and keep others drafting                                                                                                                                                |
| Host double-starts                             | Return the original challenge and revision                                                                                                                                                                  |
| Host disappears before start                   | Follow native leader migration if verified; otherwise close with an explanation                                                                                                                             |
| Host disappears after start                    | Continue the locked challenge and timer; no host is required for submit/reveal/automatic next round                                                                                                         |
| Optional code is revoked                       | Code-based joins fail, but the room remains discoverable/joinable by session ID during an `OPEN` window while a slot exists                                                                                 |
| Progress event is missed/out of order          | Fetch by room ID and replace local network state with the higher authoritative revision                                                                                                                     |
| AGS session ends after start                   | Treat the room as `TERMINATED`; preserve the trusted active challenge/results through its deadline but schedule no next round                                                                               |
| Deadline passes                                | Treat a request as timely only when the trusted handler receives it at or before `deadlineAt`; finish processing those idempotently, reject later writes, mark remaining players timed out, and reveal once |
| Countdown expires with no opted-in member      | Keep the room open in an idle/waiting state; do not create empty challenges or a timer loop                                                                                                                 |

## Authorization plan

```text
Browser caller:          authenticated web game/browser UI
Environment:             Shared Cloud development by repository Phase 2 evidence;
                         re-check against runtime config and permission catalog
Browser token:           AGS user access token held by the SDK in memory
Browser IAM client:      public; no secret
Trusted caller:          Sites server handler for start, progress validation,
                         trusted submit, and any privileged Session/storage call
Trusted token:           validated user context plus service token where required
Trusted IAM client:      confidential; secret only in hosted secret storage
AGS calls:               Session/Lobby connection, create/read/query/join/leave,
                         member/leader lookup, optional code get/generate/join/revoke,
                         joinability/update, display-name lookup, and selected
                         Cloud Save operations
Permission discovery:    live API/CLI metadata plus real user-token calls
Required permissions:    operation metadata recorded in the service evidence;
                         the attempted client-group mutation did not persist
Verified access:         yes for the development browser operations; not yet for
                         the future confidential trusted caller
```

If server-side Session validation cannot be performed safely with a confidential
caller, Phase 4 start is blocked until the correct target-environment pattern is
verified. A public browser client never receives a client secret or service token.

## Security and abuse controls

- Treat public room discovery as an enumeration surface: return only the minimum
  display fields, filter by Football 11 mode/version, paginate and rate-limit queries,
  and never expose private session attributes or member identifiers unnecessarily.
- Treat session join codes as temporary bearer-like join secrets: sufficient entropy,
  short lifetime, host revocation, no telemetry value, no URL inclusion by default,
  and rate limits on generation and join attempts.
- Return uniform invalid-code responses to reduce room enumeration. Apply per-user,
  per-room, and coarse network throttles at the trusted edge where supported.
- Validate namespace, token audience/issuer, user identity, and session/challenge
  identity on every trusted mutation. Check current membership/leader authority for
  pre-start commands and the locked participant roster for post-start commands;
  never accept those relationships as body claims.
- Use idempotency keys scoped to caller and operation. Store only hashes of keys when
  retention is needed; reject key reuse with different payloads.
- Enforce monotonic room and run revisions to prevent replay, regression, duplicate
  starts, or late progress after reveal.
- Bound action arrays, payload sizes, polling frequency, display-name length, room
  members, and retained room history before domain replay.
- Escape display names and never render member-provided rich text.
- Do not expose member user IDs in public copy/share surfaces; UI-facing IDs are
  room-scoped aliases where practical.
- Keep selections private server-side and in transit; progress projections contain
  only the approved fields.
- Record security-relevant outcomes with opaque room/request references, never tokens,
  Device IDs, full session join codes, secrets, or complete private action histories.

## AGS capabilities requiring live verification

Before P4-01 implementation, run a read-only auth/tool preflight and record:

1. Compatible TypeScript Session/Lobby packages and their resolved source versions.
2. Exact operations for online connection, session create/read/query/update/join/leave,
   roster, leader, inactive membership, optional code get/generate/join/revoke, and
   joinability.
3. Available-session query filters, pagination, attribute visibility, capacity race
   behavior, and whether `OPEN` plus available/non-full is sufficient for discovery.
4. Whether native code retrieval, generation, and revocation are available for game
   sessions in the selected Shared Cloud environment and public user-token flow.
5. Exact session template/configuration, server type `NONE`, `OPEN`/`CLOSED`
   joinability updates, update authorization, transition latency/failure behavior,
   minimum 1, configurable maximum 8, persistence, code lifetime, session lifetime,
   inactive timeout, and leader migration.
6. Event delivery requirements and guarantees: connection dependency, event types,
   ordering, redelivery, reconnect subscription, and snapshot recovery.
7. Session attribute limits, visibility, writer authorization, and conditional update
   semantics; do not assume they can hold trusted phase/progress state.
8. Sites server token-validation and server-to-Session pattern, confidential-client
   permissions, and separately authorized display-name lookups.
9. Phase 2 Cloud Save's server-side/cross-player record model, payload/key limits,
   privacy, create-if-absent/update behavior, retention, and readback consistency.
10. Shared Cloud permission groups and actions mapped from the live permission catalog
    for every browser and confidential-client operation.

Any missing capability becomes an explicit blocker or architecture decision. It does
not authorize silently substituting Matchmaking, AMS, Extend, D1, or Durable Objects.

### V2 websocket evidence and TypeScript fallback order

AccelByte Unreal SDK 28.9.0 shows that Lobby receives `messageSessionNotif` envelopes
with `Topic`, `Payload`, `SentAt`, `SequenceID`, and `SequenceNumber`. It dispatches at
least `OnSessionJoined`, `OnSessionMembersChanged`, `OnGameSessionUpdated`, and
`OnSessionEnded`; the membership event contains the complete reconciliation inputs
listed in the repository evidence above.

For the browser integration, use this fallback order:

1. Prefer an official typed TypeScript Lobby/V2 Session subscription when resolved
   package source exposes one.
2. If the TypeScript SDK exposes an official raw notification hook but not typed topic
   constants, the adapter may recognize `messageSessionNotif` plus
   `OnSessionMembersChanged`/updated/ended and validate the payload before use.
3. Do not build a private websocket client or depend on guessed transport URLs. If no
   supported hook exists, use bounded authoritative Session polling for Phase 4 and
   record realtime membership as a TypeScript SDK capability gap.

In all three cases, notifications are invalidation hints. Sequence gaps, reconnects,
unknown payloads, and out-of-order messages trigger a fresh Session query/read; they
never mutate the room reducer as unverified truth.

## Planned code ownership

Implementation should keep changes separated so Phase 2 adapters remain reusable:

```text
packages/contracts/
  room contracts and API request/response unions
apps/web/src/game/
  authoritative-challenge constructor; no room networking
apps/web/src/services/ags/
  shared authenticated SDK owner, online connection, Session, session-code adapters
apps/web/src/services/rooms/
  trusted room API client and public/private projection types
apps/web/src/state/
  pure room machine, guards, reconciliation, and selectors
apps/web/src/features/rooms/
  create, join, waiting lobby, progress rail, comparison UI
apps/web/app/api/rooms/ (candidate only)
  trusted commands using the Phase 2C-verified Sites route/runtime convention
```

## Verification plan

### Contract and unit tests

- Parse/version room snapshots, challenges, progress, and comparison payloads.
- Exercise every legal/illegal room transition, start guard, revision conflict,
  deadline, abandonment, reveal, countdown, next-round ordinal, and ranking tie.
- Prove private-to-public projection cannot leak selections or provisional results.
- Prove identical challenge/actions reproduce identical hashes across two clients.

### Adapter tests

- Mock the pinned generated clients and verify token attachment, response mapping,
  event reconciliation, retry safety, and redacted errors.
- Test open query/join, `OPEN`/`CLOSED` transition races, optional native code
  get/create/join/revoke, membership-event invalidation, and session end/migration
  outcomes without importing generated SDK types into React or contracts.

### Trusted-handler tests

- Reject missing/expired/wrong-namespace identity, non-member/non-leader mutations,
  tampered challenge data, illegal actions, unsupported versions, stale revisions,
  duplicate/conflicting idempotency keys, oversized payloads, and late submission.
- Prove double start and double submit have one canonical effect.
- Prove progress and comparison are derived from replayed evidence.

### Multi-browser service and game-flow tests

Use two normal isolated browser contexts plus a third join-attempt context:

1. Host and member authenticate as distinct users.
2. Host creates a minimum-1, maximum-8, `OPEN`, no-DS room and can start solo.
3. A member discovers and joins by session ID; both reconcile the same roster.
4. Optional code join works when present; revoking the code does not remove the room
   from discovery during an `OPEN` window.
5. Start closes joinability; both locked participants receive one challenge
   ID/base-seed/version bundle, derive distinct player streams, and complete private
   drafts.
6. Progress remains private and converges after an intentionally missed event.
7. One browser reloads mid-draft and resumes the accepted prefix.
8. A third context cannot join by ID or code during the draft.
9. Trusted results reveal together, sort deterministically, reopen joinability, and
   start one countdown. The third user then joins and can opt in for the next ordinal.
10. Countdown expiry closes joinability and advances exactly once to a fresh challenge
    ordinal in the same AGS session.
11. Repeat with disconnect, explicit abandon, host loss, timeout, invalid code, full
    room, stale query, stale revision, and duplicate command cases.

Service evidence and game-flow evidence are reported separately. SDK/API logs alone
can be `Smoke-verified`; Phase 4 is `Complete` only when the visible multi-browser
create/join/start/draft/reconnect/compare path passes.

## Remaining delivery order

1. Preserve the passing development integration while the completed P2-02/P2-03
   storage and replay services are connected to authority-sensitive room mutations.
2. Run visible explicit-abandon, deadline-timeout, and host-loss browser cases.
3. Repeat leader/start/result tamper, stale-revision, and duplicate-command cases
   against the trusted handler.
4. Complete the release security, dependency, accessibility, and performance gates.

## Phase exit checklist

- [x] Joinability is service-verified as `OPEN` while waiting/revealed/counting down,
      `CLOSED` while starting/drafting, and recoverable across failed transition races.
- [x] Session template and no-DS behavior are live-verified.
- [ ] Exact SDK packages, primary operations, template limits, and event behavior are
      discovered; code/rate/full-room limits and future trusted-caller permissions still
      need release verification.
- [x] Create, open query, join-by-ID, optional code, roster, leave, revoke, and
      reconnect are service-verified.
- [ ] Trusted membership/leader validation and start idempotency pass.
- [x] Every round's locked participants receive the same immutable challenge metadata,
      derive distinct deterministic player streams, and can resume the same replay
      prefix; closed joinability prevents mid-round membership. Legacy challenges
      without the marker retain shared-seed replay behavior.
- [x] Development progress contains only approved public fields and reconciles after
      missed events. Ranked replay verifies canonical Session membership, participant
      lock, challenge versions, and server-derived player seed before settlement.
- [ ] Comparison contains only trusted results, applies reveal/deadline/tie rules,
      and advances exactly once to a new ordinal after the countdown.
- [ ] Multi-browser success, failure, reconnect, abandonment, and host cases pass.
- [x] No Matchmaking ticket, AMS allocation, secret-bearing browser client,
      unnecessary Durable Object, or Phase 3 implementation is introduced.

**Exit criterion:** 1–8 authenticated browser clients create, discover, or join one
active AGS-managed room during an `OPEN` window, optionally retrieve/use a native
code, close joinability while a per-player deterministic participant set drafts,
recover from the approved disconnect cases, reopen at reveal, compare trusted results,
and
automatically advance to a fresh challenge in the same session.
