# Phase 3 Detailed Plan — Sharing and Daily Challenge

**Last updated:** September 3, 2026
**Status:** Deferred until Phase 2 AGS Foundation is complete
**Parent roadmap:** [07 — MVP roadmap](../07-mvp-roadmap.md)

## Work estimate — one developer with agentic AI

- **Effort:** 2–4 builder-days.
- **Elapsed time:** 0.5–1 week.
- **Primary uncertainty:** result-specific HTML and images rendering correctly
  across social crawlers and share targets.

## Phase outcome

Players receive one version-pinned daily challenge, can reopen recent local
results, and can share a stable public result whose preview works outside the
application.

## Entry conditions

- Phase 1A mechanics, Phase 1B Functional MVP, and Phase 2 AGS Foundation are complete.
- Trusted results are immutable, authenticated, and reproducible from stored evidence.
- Public-safe result fields are distinguished from private/internal fields.
- The content-rights policy identifies which names and imagery may be public.

## Delivery slices

| Slice | Outcome |
|---|---|
| 3A — Daily lifecycle | One canonical challenge is active for each UTC period |
| 3B — Public result | A stable URL renders public-safe result content |
| 3C — Share assets | Landscape metadata and vertical share output match the result |
| 3D — Synced history | The authenticated player can reopen recent result identifiers |

## Slice 3A — Daily lifecycle

1. Define the challenge period using UTC and record start/end timestamps.
2. Pin seed, content version, rules version, and simulation version at creation.
3. Enforce one canonical daily challenge per period and mode.
4. Use a scheduled Worker trigger or idempotent lazy creation; document which
   path is authoritative.
5. Decide whether replay is allowed and which attempt is rank-eligible before
   enabling the Phase 2 leaderboard for daily competition.
6. Keep random and daily result categories separate.

The daily challenge must not change because new content is deployed during its
active period.

## Slice 3B — Public result

Proposed route: `GET /results/{publicResultId}`.

The response must:

- use an opaque public identifier rather than a sequential database key;
- expose only approved XI, record, explanation, and version labels;
- return stable metadata for crawlers that do not execute React;
- show a clear unavailable state for private, removed, or unknown results;
- never expose AGS tokens, private account data, internal coefficients, or raw
  validation evidence.

Use the Sites managed server runtime for the public projection and result-specific
server-rendered metadata unless verification identifies a blocking limitation. Reuse
the trusted AGS-connected result contract from Phase 2. AGS Extend remains an
alternative for a demonstrated integration advantage, while a separately provisioned
Worker remains the final fallback.

## Slice 3C — Share assets

1. Define one landscape Open Graph composition.
2. Define one vertical player-export composition.
3. Render both from the stored public result contract, not browser state.
4. Include formation, key names or approved identifiers, record, and one short
   explanation without overcrowding.
5. Cache by public result ID plus renderer version.
6. Provide a text/link fallback when image generation fails.
7. Verify Discord, WhatsApp, X, and Slack preview behavior.

If player photos or club marks remain legally unresolved, use the original
text-first visual system.

## Slice 3D — Synced history

Store the durable result index under the authenticated AGS player, with a bounded
browser cache of public result IDs and lightweight display metadata. The trusted
public result projection remains the source of truth for shared output.

- Missing or removed results remain understandable in history.
- Clearing local storage removes only the cache and does not delete AGS data.
- Signed-in players can restore the durable history on another session.
- Offline history may show cached entries but must not claim they are freshly synced.

## Suggested contracts

- `GET /v1/challenges/daily/current`
- `GET /v1/results/{resultId}` for application data
- `GET /results/{publicResultId}` for public HTML
- `GET /results/{publicResultId}/og` for the landscape asset
- a browser export action for the vertical asset, backed by the same public
  result model

Route names are application-owned proposals and should be finalized with the
deployment choice.

## Abuse, caching, and privacy

- Rate-limit image generation and deduplicate concurrent renders.
- Cache immutable result payloads aggressively; version mutable renderer code.
- Sanitize all text inserted into metadata or images.
- Prevent private or rejected runs from receiving public routes.
- Add a removal/takedown path for content-rights issues.
- Avoid placing raw personal identifiers in public URLs or image metadata.

## Verification

- Two requests for the same daily period return the same challenge and versions.
- A deployment during the day does not mutate the active challenge.
- Boundary tests cover period rollover and concurrent creation.
- A public link works with JavaScript disabled enough to expose metadata.
- Preview validators show the correct result-specific image and text.
- Images match the underlying immutable result after cache hits.
- Unknown, private, and removed results do not leak data.
- Local history reopens valid results and handles unavailable ones.
- Mobile and desktop sharing affordances remain usable.

## Exit checklist

- [ ] Daily period and replay policy are decided.
- [ ] Exactly one canonical challenge is produced per period.
- [ ] Public-safe result projection is implemented and reviewed.
- [ ] Stable public HTML and metadata are deployed in a test environment.
- [ ] Landscape and vertical share outputs are verified.
- [ ] Local history has bounded storage and failure behavior.
- [ ] Caching, sanitization, privacy, and takedown behavior are documented.

**Exit criterion:** a daily result can be reproduced, reopened, and shared at a
stable public URL with correct result-specific metadata.
