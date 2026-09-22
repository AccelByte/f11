# Football 11 — Offline starter

Build a 4-3-3 XI, reroll teams, and simulate a 38-match season with deterministic
game mechanics. This tutorial starting point runs entirely in the browser, with
no login, backend, credentials, or online features. Runs remain in memory until
reload.

## Run

Use Node.js 22.13 or newer:

```sh
npm ci
npm run dev
```

Open the URL printed by Vite. No environment file is required.

```sh
npm run typecheck
npm test
npm run build
npm run preview
```

## Add online features step by step

Follow the [complete offline-to-online tutorial](docs/12-accelbyte-integration-guide.md).
It includes signup, plugin setup, six integration plans, prompts, and acceptance
checks. Implement and verify one stage before moving to the next.

## Layout

- `apps/web`: local React game and Vite build.
- `packages/domain`: deterministic rules and simulation.
- `packages/content` and `packages/test-fixtures`: catalogue and fixtures.
- `data`: versioned player data, configuration, and source provenance.
- `docs/12-accelbyte-integration-guide.md`: the complete integration tutorial.

## Data credits

The named 2023/24 squad catalogue uses pinned OpenFootball sources with CC0
provenance. Ratings are synthetic and formation positions are inferred; they
are not official player ratings. See [data credits](data/README.md) and the
[rights assessment](docs/08-content-legal-and-risks.md).

Detailed [agent integration plans](docs/ags-plans/README.md) provide the implementation
contract for each tutorial stage.
