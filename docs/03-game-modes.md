# Game Modes

**Last updated:** September 3, 2026
**Status:** Mode set confirmed; random mode complete and friend-room development loop verified

## Mode summary

| Mode               | Opponent or cohort                              | Synchronization                         | Persistent ranking           |
| ------------------ | ----------------------------------------------- | --------------------------------------- | ---------------------------- |
| Random run         | Self                                            | None                                    | Optional personal best       |
| Daily challenge    | Everyone receives one seed                      | Asynchronous                            | Daily leaderboard            |
| Play with friends  | Members of a discoverable open AGS game session | Live room, simultaneous repeated drafts | Per-round room comparison    |
| Challenge saved XI | Nearby leaderboard player                       | Asynchronous                            | Match record and leaderboard |

## Random run

Purpose: unlimited practice and replayability.

- A new server-issued seed is generated per run.
- No shared schedule is required.
- The result may update personal best statistics.
- Random runs should not dilute the daily leaderboard.

## Daily challenge

Purpose: create a shared public conversation.

- One deterministic seed is active for the challenge period.
- Every eligible player receives the same initial offer. Later offers remain
  identical only when the players have taken the same prior actions; divergent
  selections produce deterministic branches from the same seed.
- The simulation version is fixed for that challenge.
- The daily leaderboard ranks an authoritative result statistic.
- The first authoritative completed attempt is the ranked result. Later
  attempts are allowed as practice and cannot replace that result.

## Play with friends

Purpose: let players discover or directly join one long-lived active room, draft
simultaneously, compare, and continue into another round together.

### Implemented development flow

1. The host authenticates with AGS.
2. The host creates a no-server AGS game session as its first member, with initial
   joinability `OPEN`; minimum 1 and maximum 8 are configurable. AGS marks the
   `type=NONE` template nonpersistent because persistence is DS-only; Football 11
   keeps the same active session across rounds instead.
3. Other authenticated players browse compatible non-full rooms and join by session
   ID. A native session code remains retrievable as an optional direct-join path.
4. The room shows membership and readiness.
5. The host may start the first challenge alone or with ready members. Starting
   changes AGS joinability to `CLOSED` before the participant set locks.
6. Every participant locked for that round receives the same deterministic seed.
7. Each participant independently drafts an XI at the same time.
8. Progress is visible at a lightweight level, such as 7/11 or finished.
9. Results unlock for comparison when the completion rule is satisfied.
10. Reveal changes joinability back to `OPEN` and starts a configurable intermission
    countdown. The next start closes joinability again and locks opted-in members
    into a new challenge ordinal and seed.

### Room states

    WAITING
    → STARTING
    → DRAFTING
    → REVEAL
    → COUNTDOWN
    → STARTING

    Any phase → TERMINATED

`TERMINATED` is reserved for an ended or unrecoverable AGS session. AGS
`joinability=CLOSED` is temporary during `STARTING` and `DRAFTING`; it does not end
the room. Readiness is a guard/opt-in state rather than a room phase.

### Important boundary

AGS owns the room, controlled `OPEN`/`CLOSED` joinability, membership, availability,
leader, optional session code, and lightweight session state. The current development
integration carries round state in a compact Session attribute and keeps private
draft actions in the browser. The future trusted football handler will own participant
locks, challenge issuance, replay validation, countdown transitions, and accepted
results before competitive release.

### Open rules

- Whether the proposed 30-second initial intermission needs adjustment after
  playtesting; the value remains configurable.
- Visible-browser abandon, deadline-timeout, and host-loss behavior; the service
  probe already verifies the 120-second inactive template value and native leader
  migration.

## Challenge saved XI

Purpose: offer asynchronous competition without AGS Matchmaking tickets or a
dedicated game server.

### Proposed flow

1. Read the current player's leaderboard rank.
2. Query approximately ten nearby leaderboard entries.
3. Exclude the current player, invalid records, and recently faced opponents.
4. Randomly select one eligible opponent on the trusted backend.
5. Load that opponent's saved XI and simulation version.
6. Simulate or resolve the matchup under a version-compatible ruleset.
7. Store the match record and update authoritative statistics.

This feature is called opponent discovery or ghost competition in these
documents. It is not AGS Matchmaking.

### Open rules

- Whether the challenger drafts a new XI or uses their currently saved best XI.
- How rating changes are calculated.
- How to handle XIs created under old simulation versions.
- Rematch cooldown and anti-farming rules.
- Whether nearby range expands when fewer than ten eligible players exist.
