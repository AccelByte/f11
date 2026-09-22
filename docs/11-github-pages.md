# Playable frontend on GitHub Pages

> Connected-project reference: implementation claims and source paths below refer to the connected branch, not this offline starter. See the [starter path](12-accelbyte-integration-guide.md#offline-baseline) for the current sequence.

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
