# Playable frontend on GitHub Pages

The static browser build targets `https://accelbyte.github.io/f11/` and calls
the existing public Sites backend. The original Sites frontend remains usable.
This split does not move trusted replay, draft issuance, settlement, or private
credentials into GitHub Pages.

## Build and publish

Run `npm run typecheck`, `npm test`, and `npm run build:pages --workspace
@football-11/web` from the repository root. The build reads only the explicitly
listed browser-safe values from `apps/web/.env.local` and fails when required
AGS connection values are missing. Vite emits `apps/web/build` with `/f11/`
asset paths and the Sites API origin. Do not upload `.env` files, server output,
source maps, private source history, or Sites credentials.

Publish the **contents** of `apps/web/build` plus an empty `.nojekyll` file to
the separate `gh-pages` branch of `git@github.com:AccelByte/f11.git`. In that repository's
Settings > Pages, choose **Deploy from a branch**, **gh-pages**, and **/(root)**.
Future frontend updates use the same build and a normal fast-forward push.
Keep source on `main` and compiled assets on `gh-pages`. Set
`FOOTBALL11_PAGES_URL` during a build to target another Pages URL.

Deploy API changes to the existing Sites project using its normal release
process. `apiCors.ts` explicitly allows `https://accelbyte.github.io` and the existing
`https://damarindraab.github.io` origin, handles
preflights, preserves authentication errors, and rejects other cross-origin
callers. All existing bearer-token and trusted replay checks remain active.
CORS allows an origin, not a repository path; other pages under the same GitHub
account share that origin, but they still require valid player authorization.

## Acceptance

### Demo visit analytics

The Pages source includes PostHog pageview tracking. Set
`NEXT_PUBLIC_POSTHOG_KEY` in the ignored `apps/web/.env.local` file to the intended
project's public browser ingestion key before building. Pages builds require this
value. Never substitute a PostHog personal API key. The project key is deliberately
included in the generated browser bundle; an environment variable does not make
browser configuration secret.

The tracker initializes only at the configured Pages origin and path. Local
previews and the Sites frontend do not initialize it. It asynchronously loads the
SDK, registers `game: f11` and `$lib: html-game`, and explicitly captures one
`$pageview` per document load. Automatic pageviews are disabled to avoid duplicates.
Button capture, page-leave events, session recording, heatmaps, performance and
exception capture, surveys, feature-flag requests, and external extension loading
are disabled. No AGS identity is passed to PostHog. Default browser persistence
can recognize returning browsers; page URL, referrer, and campaign parameters are
included by the SDK. Tracking failures do not block game startup.

After publishing, open the game with a recognizable UTM parameter and check the
browser's event request and the receiving PostHog project's activity feed. Verify
the first `$pageview` has both F11 labels, the correct URL and UTM property, and
appears only once per load. Refreshing should produce another pageview. Confirm
normal gameplay and that button clicks do not create autocapture events. An
existing dashboard needs an insight filtered to `game = f11`; installing the SDK
does not update dashboard filters or measure CTA clicks on other websites.

The source and Pages snapshots are published. Deployment and received-event
verification remain pending under `ANALYTICS-01`; see the
[publication record](verification/2026-09-22-posthog-pages.md).

### Game and API checks

Check the Pages root and referenced assets return 200, then initialize a guest,
start a draft, and finish a run through the Sites backend. OPTIONS requests for
all five API paths must return 204 with the exact Pages origin, correct method,
and Authorization/Content-Type headers. Error responses must also include CORS
headers; an unapproved origin must receive 403. Verify the original Sites root
still works. Record actual deployment and smoke results in P6-14.

Browser storage belongs to each origin. Existing Sites guest identity and local
drafts do not automatically transfer to GitHub Pages; Pages starts with its own
guest and local saves. The current Device ID guest flow does not navigate an
OAuth callback. Any future redirect-based login needs the Pages callback
registered in the corresponding public OAuth client.
