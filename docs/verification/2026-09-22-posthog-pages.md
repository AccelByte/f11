# PostHog Pages publication — September 22, 2026

The connected source and compiled frontend were atomically published to
`AccelByte/f11` as parentless snapshots. Remote readback matched both published
commits, and each published branch has exactly one reachable commit. The
`offline-starter` branch was not changed.

The Pages snapshot is `7a793eb0fe9e33982d8abdc5a4a405dd73ada48f`. It contains
seven static files, including `.nojekyll`, and no source ancestry, environment
files, server output, or source maps. The first source snapshot was `8193fd0`;
the current source snapshot may additionally contain this verification record.

Pre-publication checks passed:

- Typecheck and all 143 tests, including three analytics regressions.
- Focused analytics tests and the Pages build after the final configuration change.
- Formatting and lint for changed code; full lint has existing warnings.
- Source and compiled-tree checks against recognizable credential patterns and
  configured private values: no matches in 185 source files or seven static files.
- Source documentation relative links and whitespace checks.
- Analytics ingestion preflight: HTTP 200, allowed Pages origin, POST, and
  content-type header.

The full formatting check reports issues in 59 untouched files. No unrelated
formatting changes were included.

At the post-push check, the live Pages root still served the previous bundle.
GitHub's public Actions listing showed no deployment for the new Pages commit,
and that commit had no check runs. Publication of the branch is verified;
deployment of the new build and receipt of an actual browser pageview are not
yet verified. A repository administrator should inspect or trigger the Pages
deployment, then perform the analytics acceptance checks in
[the Pages guide](../11-github-pages.md#demo-visit-analytics).

This release does not alter the game backend or establish that a PostHog
dashboard insight has been configured.
