# Football 11

A football drafting experiment: build a 4-3-3 XI, assess its strengths, and
simulate a league season using deterministic game mechanics. The connected
prototype adds AccelByte guest identity, saved runs, trusted ranking, friend
rooms, and asynchronous Saved-XI challenges.

[Play Football 11](https://accelbyte.github.io/f11/)

## Run locally

Use Node.js 22.13 or newer and npm:

```sh
npm ci
```

Copy `apps/web/.env.example` to `apps/web/.env.local` and configure your own
AccelByte environment and clients. Public browser configuration and confidential
server credentials are separate; never put a secret in a `NEXT_PUBLIC_*` value.
Connected gameplay needs the corresponding backend resources described in
[the integration tutorial](docs/12-accelbyte-integration-guide.md).

```sh
npm run dev --workspace @football-11/web
```

For a browser-only UI preview, use
`npm run preview:local --workspace @football-11/web`. Trusted API features require
a running backend; this preview alone does not provide them.

## Checks and project layout

```sh
npm run typecheck
npm test
npm run build
```

- `apps/web`: React UI and trusted server routes.
- `packages`: shared contracts, content, deterministic mechanics, and fixtures.
- `data`: versioned catalogue, scoring configuration, fixtures, and provenance.
- `tools`: data preparation, validation, smoke checks, and demo capture.
- `docs`: design decisions, implementation evidence, and remaining work.

Start with the [AGS signup, AI-plugin setup, and prompting tutorial](docs/12-accelbyte-integration-guide.md),
or read the [project documents](docs/README.md),
[progress tracker](docs/10-progress-tracker.md).

## Data and rights

The catalogue uses pinned OpenFootball sources with CC0 provenance; player
ratings and detailed formation positions are synthetic or inferred, not official
performance measurements. See [data credits](data/README.md) and the
[rights assessment](docs/08-content-legal-and-risks.md). Public source availability
does not resolve the separately tracked player, club, and competition rights
questions.

Detailed [agent integration plans](docs/ags-plans/README.md) provide the implementation
contract for each tutorial stage.
