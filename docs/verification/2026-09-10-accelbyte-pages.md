# AccelByte Pages deployment — September 10, 2026

The compiled frontend is published to the separate `gh-pages` branch of
`AccelByte/f11`, commit `478c5412abaa4a84b278df19a1b62d5a8a164e78`.
Remote verification confirms `main` remains unchanged at
`8bb7cb0852c2b8a27f6313a686409fa772cdc6fe`, the single source-snapshot commit.
The deployment branch contains only six static files, including `.nojekyll`;
it contains no source history, environment files, or server bundle.

The build targets `https://accelbyte.github.io/f11/`; its metadata, asset paths,
and browser redirect configuration use that URL. `FOOTBALL11_PAGES_URL` can
override the target for a later build. The frontend continues to call the
existing Sites backend. Its CORS allowlist now supports both AccelByte Pages
and the previous personal-account Pages origin, with exact origin matching.

The Sites backend is publicly deployed as version 21 from source
`609a4523e2ea8a9041a9b1a785a37060d38ed630`. Deployment status is succeeded.
No runtime credentials or access-policy changes were needed.

Validation passed: typecheck, 140 tests, both production builds, lint with
warnings and no errors, static asset references, correct Pages metadata, and an
in-memory comparison of static output against configured private values with
no matches. A test-only variable rename removed two newly introduced lint
warnings; the five focused CORS tests passed again afterward.

Hosted HTTP checks pass for all fourteen preflight combinations across the
two allowed origins, seven methods/routes per origin. Both origins receive
readable 401 responses without authentication. An unapproved origin receives
403. The original Sites root returns 200. The Pages root now returns the game
bundle instead of the README. Browser verification confirms the actual game
screen, successful guest sign-in, and a Sites-issued first-round draft with
fifteen offered players and five rerolls from the AccelByte Pages origin. The
rendered draft screen was visually reviewed. DOC-05 is Done; this was a login
and draft-start smoke, not a full eleven-round regression.

The publication fixes the hosting configuration; it does not close the
separately tracked Cloud Save investigation for the earlier personal-account
Pages deployment or imply a complete multiplayer regression test.
