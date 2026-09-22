# Public source preparation — September 10, 2026

> Connected-project reference: implementation claims and source paths below refer to the connected branch, not this offline starter. See the [starter path](../12-accelbyte-integration-guide.md#offline-baseline) for the current sequence.

Tracker: DOC-04, **In progress**. The user supplied `AccelByte/f11` as the new
repository. SSH confirms it is accessible and has no refs. GitHub's
unauthenticated repository API returns 404, so public visibility is not yet
verified. The existing Functional MVP is unaffected.

The source export uses current tracked and non-ignored untracked files, including
the existing uncommitted gameplay changes. It is copied into an independent
directory and initialized as a new Git repository; no original Git objects,
branches, tags, or remotes are copied. The original checkout remains intact.

The export excludes Sites hosting bindings, local environment
files other than the placeholder `.env.example`, dependencies, caches, generated
builds, and recordings. Its ignore rules also exclude future hosting-binding
additions. The new README explains configuration and the limits
of a source-only release.

The existing source checkout passes all 138 tests across 26 files. Exported files
were scanned for recognizable GitHub, AWS, Slack, JWT, and private-key patterns,
and compared in memory against the two configured private environment values.
No matches were found. URL and email matches outside the dependency lockfile
were reviewed; they were public references, public deployment URLs, local URLs,
or test/example values. This is a targeted pre-publication scan, not a claim of
an exhaustive security audit or a fresh deployment test.

Local Git verification confirms one root commit with no parent and 182 files;
the excluded paths are absent from its tree and the export working tree is clean.

Remaining acceptance: push only `main` to `AccelByte/f11` and verify the remote
commit and public visibility. Source publication
does not resolve the separate public-product rights item P0-05.

## Remote verification

The push succeeded. SSH readback confirms remote HEAD and refs/heads/main both
resolve to 8bb7cb0852c2b8a27f6313a686409fa772cdc6fe. The exported repository
still has exactly one commit and a clean working tree. Only public visibility
remains unverified. This post-push evidence is recorded in the original working
repository without adding a second commit to the source release.

## AccelByte Pages diagnosis

Browser inspection of https://accelbyte.github.io/f11/ on September 10 shows
the Football 11 README rendered as documentation, including Run locally and
Public source snapshot sections. The source publication did not deploy the
compiled game. The Pages URL is reachable publicly; this observation alone
does not establish source repository visibility.

The static build configuration still uses the personal-account Pages URL for
metadata and redirect configuration. The Sites CORS wrapper currently allows
only that personal Pages origin, in addition to same-origin requests. Serving
the game at the AccelByte URL requires compiled frontend deployment and a
backend CORS release for the AccelByte origin. No deployment was changed during
this diagnosis.
