# Phase 5 Detailed Plan — Saved-XI Competition

**Last updated:** September 4, 2026
**Status:** Done
**Parent roadmap:** [07 — MVP roadmap](../07-mvp-roadmap.md)

## Work estimate — one developer with agentic AI

- **Effort:** 4–7 builder-days.
- **Elapsed time:** 1–1.75 weeks.
- **Resolved uncertainty:** public cross-player Saved-XI lookup uses the
  authenticated player token, while private storage and Statistics settlement
  use the existing confidential client.

## Phase outcome

An authenticated player can save one eligible XI, request a nearby ranked
opponent, play a deterministic asynchronous matchup, and receive an
authoritative stored result with controlled competitive-statistic effects.

This is leaderboard-driven opponent discovery, not AGS Matchmaking. It uses no
ticket, match pool, realtime opponent, game session, or dedicated server.

## Entry conditions

- Phase 1 simulation and replay contracts are stable.
- Phase 2 identity, trusted replay, Statistics, and Leaderboards are complete.
- Saved-XI replacement, visibility, exact-version compatibility, Challenge
  Score, and rematch rules are approved.
- Required leaderboard, profile enrichment, Statistics write, and readback
  operations are discovered and authorized.

## Delivery slices

| Slice | Outcome |
|---|---|
| 5A — Eligible Saved XI | One authoritative XI is available under the approved replacement policy |
| 5B — Nearby discovery | Worker obtains and filters a rank window without trusting browser candidates |
| 5C — Match resolution | Compatible XIs produce one deterministic authoritative result |
| 5D — Competitive update | Approved statistics change exactly once |
| 5E — History and rematch policy | Players can understand prior outcomes and cooldowns |

## Approved v1 product decisions

- The challenger uses one explicitly published trusted personal-best XI.
- Publishing or replacing an eligible XI requires confirmation; it is never
  replaced silently.
- The existing best-season-points Leaderboard supplies nearby discovery. Search
  approximately ten ranks in either direction and expand once to fifty when
  filtering leaves no candidate.
- Challenge Score is challenger-only personal progress, not an Elo rating or a
  v1 leaderboard. A win adds 3, a draw adds 0, and a loss subtracts 2 without
  allowing the score to fall below zero. The opponent's value never changes.
- A challenge is one neutral match and may end in a draw.
- Only exact mechanics-version matches compete in v1.
- Challenge tokens are single-use, expire after ten minutes, and cannot select
  an opponent faced by that challenger during the previous 24 hours.
- If no candidate survives filtering and one expansion, return an honest
  no-opponent state without a statistic effect.

## Approved head-to-head mechanics contract

`head-to-head-v1` is separate from the 38-match league model. It gives equal
weight to the challenger's attack against the opponent's defence and the
challenger's defence against the opponent's attack: each duel contributes
42.5%, while the control difference contributes 15%. This makes the probability
vector symmetric when the XIs are reversed.

The trusted boundary supplies one match seed. The domain function canonicalizes
the Saved-XI identifiers before deriving its random stream, so reversing caller
roles preserves the underlying sampled match and only inverts win and loss.
Draws remain possible. The stored evidence pins the matchup version, canonical
identifiers, seed, roll, probabilities, outcome, and Challenge Score delta.

The headless contract is implemented with golden, symmetry, replay, score-floor,
and 10,000-seed distribution tests before any AGS Statistics connection.

## Slice 5A — Eligible Saved XI

The Worker creates or replaces a Saved XI only after replaying the submission,
matching it to the authenticated player's trusted receipt, and proving that its
points equal the current personal best. It stores:

- owner AGS user ID from validated identity;
- source run and immutable result ID;
- formation and ordered slot assignments;
- content, rules, and simulation versions;
- competitive summary fields needed for discovery;
- publication timestamp and exact mechanics versions.

The browser cannot upload an arbitrary XI or mark it eligible without Worker
validation. An issued challenge embeds both authoritative XI snapshots, so an
explicit later replacement cannot change a match that has already been issued.

## Slice 5B — Nearby opponent discovery

Implemented sequence:

```text
Player selects Challenge nearby XI
  -> trusted application boundary validates caller identity against AGS
  -> trusted boundary resolves current rank or approved fallback band
  -> trusted boundary queries an AGS around-me or rank-range window
  -> trusted boundary removes self, incompatible, private, blocked, invalid, and recent opponents
  -> trusted boundary expands the window only under the approved rule
  -> trusted boundary selects one candidate using an auditable random/rotation rule
  -> trusted boundary returns a public opponent preview and opaque challenge token
```

The browser may display the Phase 2 leaderboard directly, but it must not
submit the opponent candidate list used for authoritative selection.

Treat display-name/profile enrichment as a separate AGS operation and
permission. If enrichment fails, use a safe anonymous label without blocking a
valid competitive result.

## Slice 5C — Match resolution

1. Load both authoritative Saved XI records.
2. Validate eligibility and version compatibility again at resolution time.
3. Pin matchup rules and simulation version.
4. Generate a private deterministic match seed and record its input evidence.
5. Simulate in the trusted application boundary connected to AGS; never accept a
   browser outcome.
6. Store the asynchronous match before applying statistics.
7. Return outcome, probability, score, and settlement fields while removing the
   private seed evidence and raw opponent user ID from browser projections.

The challenge token must expire or become single-use according to the approved
anti-farming policy.

## Slice 5D — Competitive Statistics

- Store one native AGS Challenge Score statistic for the challenger only. Start
  at zero; apply win `+3`, draw `0`, and loss `-2`, with a zero minimum.
- Keep the full match, XIs, explanation, and version evidence in AGS Cloud Save.
- Use the private, `SERVER`-set `football11challengescore` definition with a zero
  minimum. Settlement computes the floored absolute value in trusted code and
  writes it with `OVERRIDE` for retry safety.
- The opponent's statistic never changes in v1.
- Apply one idempotency record or settlement state so retries cannot double
  count.
- Read back the challenger's resulting Challenge Score. It does not feed a v1
  Leaderboard; the existing best-season-points Leaderboard remains the discovery
  index.
- Treat configuration changes to tied statistics as migration-sensitive.

Direct score posting to AGS Leaderboards is not the ingestion path; rankings
follow the configured Statistics values.

## Application API

- `PUT /api/saved-xi` explicitly publishes or replaces an eligible trusted result.
- `GET /api/saved-xi` returns the caller's Saved XI, Challenge Score, active or
  repairable challenge, and bounded history.
- `POST /api/opponents/nearby` selects one eligible opponent in the trusted
  application boundary connected to AGS.
- `POST /api/asynchronous-matches` resolves one issued challenge or idempotently
  repairs the same pending settlement when its token is replayed.
- `GET /api/asynchronous-matches` returns the same authenticated status projection.

Payloads must carry opaque identifiers and are validated through shared
contracts.

## Abuse controls

- Server-derived player and opponent identities.
- Expiring or single-use challenge tokens.
- Rematch cooldown and recent-opponent exclusion.
- A rolling limit of 20 challenges per 24 hours, aligned with the bounded
  20-match history that proves rematch exclusion.
- Idempotent match creation and statistic settlement.
- No statistic update for incompatible, invalid, replayed, or abandoned
  challenges.
- Audit fields for selection window, exclusions, seed, versions, and settlement.
- A repair path for a stored match whose Statistics settlement temporarily
  failed.

## Authorization plan

```text
Browser caller:         authenticated web game/browser UI
Browser token:          AGS user access token
Worker caller:          backend service
Worker token:           service token
Worker IAM client:      confidential; secret in Cloudflare secret storage
AGS calls:              all-time Leaderboard window, public bulk player records,
                        private/admin player records, Statistics update/readback
Permission discovery:   installed SDK contracts, AGS CLI describe, and live probes
Required permissions:   player public Cloud Save read; confidential Cloud Save
                        player-record and Statistics user-value create/read/update
Verified access:        yes; redacted two-player local-Worker/live-AGS smoke passes
```

## Failure behavior

| Condition | Expected result |
|---|---|
| Player is unranked | Use the approved unranked pool or explain how to qualify |
| No candidate survives filtering | Expand once by rule or return no-opponent state |
| Candidate XI was replaced | Revalidate token against preserved version or select again |
| Versions are incompatible | Do not simulate or update Statistics |
| Match storage succeeds but stat update fails | Mark settlement pending and retry idempotently |
| Profile enrichment fails | Show safe fallback label; retain valid match |
| Challenge is replayed | Return original result or reject without new stat effects |

## Verification

- Saved XI can only originate from a validated owned run.
- Rank-window filtering removes self, recent, private, invalid, and incompatible
  candidates.
- Selection is auditable and cannot be overridden by the browser.
- Replaying the same match evidence reproduces the same outcome.
- Duplicate submission creates one match and one settlement effect.
- Challenge Score is read back after settlement, while the existing Leaderboard
  continues to supply discovery candidates.
- Tampered IDs, tokens, versions, and challenge tokens fail safely.
- UI covers loading, unranked, no opponent, preview, resolving, result,
  settlement pending, and retryable error.

## Exit checklist

- [x] Saved-XI eligibility and replacement rules are approved.
- [x] Exact-version compatibility and Challenge Score rules are approved.
- [x] Worker-owned nearby discovery is implemented.
- [x] Match resolution is deterministic and stored with complete evidence.
- [x] Competitive Statistics settle exactly once and read back correctly.
- [x] Challenge Score readback is correct and the existing Leaderboard supplies
      valid discovery candidates.
- [x] Anti-farming, cooldown, replay, and repair paths are verified.
- [x] No AGS Matchmaking or AMS resource is involved.

## Verification result

The final local suite passes 94 tests, type-checking, lint review of the changed
surface, and the Vinext production build. A desktop browser fixture verified the
loaded competition hierarchy, opponent preview, score, resolve action, and
history in the shipped CSS; the layout collapses to one column at 780px and to
two-column XI facts at 480px. The redacted two-player smoke then exercised the
real Worker routes against Shared Cloud and read back trusted publication,
public discovery, duplicate resolution, private seed projection, challenger-only
score, zero floor, `SERVER`-owned Cloud Save records, settled immutable history,
and same-opponent cooldown. No user IDs, tokens, client secret, or private match
seed are printed by the smoke result.

**Exit criterion:** a player can challenge a valid nearby ranked XI and receive
a reproducible authoritative result with exactly-once competitive settlement.
