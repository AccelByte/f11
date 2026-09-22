# Football 11: from offline mechanics to online features

Start with the playable offline game, set up AGS and the AI plugin, then add
one online feature at a time. This document contains the setup instructions,
copy-ready handoff prompts and supporting service reference material. Detailed
implementation plans and acceptance checks live in [ags-plans](ags-plans/README.md). All online stages are **not started** on the offline branch.

## Contents

- [Run the offline baseline](#offline-baseline)
- [Sign up for AGS](#part-1--sign-up-for-ags)
- [Integration stages](#integration-stages)
- [Debugging and completion checks](#debugging-and-completion)
- [Connected implementation reference](#implementation-reference)

<a id="offline-baseline"></a>
## Run the offline baseline

The public `main` branch contains the connected game. To follow this tutorial from
the offline baseline, switch to `offline-starter` and create a working
branch. Use Node.js 22.13 or newer:

```sh
npm ci
npm run dev
```

Open the URL printed by Vite. Complete eleven picks, try a reroll, and inspect
the season result. No environment file, account, or backend is needed. Runs stay
in memory until reload. Create your own working branch before adding features.

The mechanics live in `packages/domain`; `apps/web/src/game/session.ts` owns the
local run and action transitions; `apps/web/app/page.tsx` renders the game. Add
identity and storage around those boundaries, and reuse the domain code for
later server replay. Keep the existing mechanics tests passing throughout.

The following setup uses Codex and a Public Cloud development namespace (also
called Shared Cloud). A Claude Code installation alternative is included.

## Before you start

Have the following ready:

- An email address you can access and your game studio's name.
- Codex installed and signed in. If you need to install it, use the
  [official Codex documentation](https://learn.chatgpt.com/docs).
- A local game/application project folder that Codex can open. Football 11 uses
  React and TypeScript; the prompts below also tell the assistant to inspect your
  actual project before selecting an SDK.

You will use three places during this tutorial:

| Place | What you do there |
| --- | --- |
| AGS Admin Portal in your browser | Register, select a game, and view its configuration |
| Codex | Install the plugin, connect tools, and send the example prompts |
| Terminal | Run explicitly labeled commands, if using a command-line setup |

**Commands go in the terminal; prompts go in the Codex conversation.** Replace
values written as `<YOUR_...>` before sending a prompt. Enter passwords and
verification codes directly in the sign-in page, not in the conversation.

## Part 1 — Sign up for AGS

### Step 1. Open the registration page

1. Open [Sign up to AccelByte](https://prod.gamingservices.accelbyte.io/auth/register?utm_source=github&utm_medium=source-code&utm_campaign=sa-content&utm_content=2026-09-18-82-0-inspired-prototype).
2. Check that the page heading says **Sign up to AccelByte**.
3. If your studio already has an account, use **Sign in** or ask its administrator
   for an invitation instead of creating a duplicate studio.

**Expected result:** the signup form is visible.

### Step 2. Complete the signup form

1. Enter your name in **Your name**.
2. Enter an address you can access in **Email Address**.
3. Enter your studio name in **Game studio name**.
4. Read the linked **Terms Of Services** and **Privacy Policy**. If you agree,
   select the agreement checkbox.
5. Click **Get started for FREE**.
6. Complete the account-activation instructions AGS displays and sends to your
   email. If a verification email is requested but missing, check spam and use
   the resend option if offered.
7. Open the [AGS Admin Portal](https://prod.gamingservices.accelbyte.io/admin)
   and sign in with the account you just activated.

**Expected result:** you can access your studio in the Admin Portal. Account
activation screens may vary; follow their instructions rather than assuming the
initial form also asks for a password.

### Step 3. Open your game's namespace

A namespace is the container for one game's players, configuration, and services.
AGS onboarding creates a first game namespace as part of registration. Use that
namespace if it is the game you want to integrate.

To create a separate development game:

1. Open **Your Titles**. If you are inside a namespace and see the sidebar, open
   the upper-left **NAMESPACE** dropdown and choose **View All**.
2. On **Your Titles**, click **+ CREATE**.
3. On **New Game Setup**, enter a **Game Name**, such as `Football 11 Dev`.
4. Review the generated **Game Title ID** before completing the form. The display
   name can change later; the Game Title ID cannot.
5. Complete the form and open the resulting game namespace.

**Expected result:** the portal shows the intended development game. Record the
actual namespace identifier shown by AGS; do not derive it from the display name.

### Step 4. Collect the connection information

1. Record your Admin Portal URL and game namespace identifier in a private note.
2. In the selected game, open **Foundations → Identity & Access → IAM Clients**.
3. If an appropriate game client already exists, choose **View** and note its
   **Client ID**, **Namespace**, **Redirect URI**, and **Base URL**.
4. If no game client exists, leave Client ID blank for now. The setup prompt in
   Part 3 will help create the right client for your project.

Keep the **Base URL** supplied by AGS distinct from the Admin Portal URL. A browser
application needs a **Public** client with no embedded secret. A trusted backend
may later need a separate Confidential client; its secret stays on the server.

**Expected result:** you know which game and environment the assistant should use.
You do not need to configure every AGS service before installing the plugin.

## Part 2 — Install and connect the AccelByte AI plugin

### Step 5. Open your project in Codex

1. Open Codex and select your local game/application project folder.
2. Start a conversation associated with that project.
3. Confirm that it is the application source folder, not a downloaded plugin folder.

**Expected result:** the assistant can inspect your project to determine its engine,
framework, SDK, and existing configuration.

### Step 6. Install AccelByte AI Plugins

The marketplace source is `AccelByte/ai-plugins`; the plugin is named
`accelbyte-ai-plugins`.

1. In Codex, open the plugin manager using `/plugins` where available.
2. Choose **Add Marketplace**, enter `AccelByte/ai-plugins`, and confirm.
3. Find **accelbyte-ai-plugins** in that marketplace and install or enable it.
4. Restart/reload Codex and reopen your project conversation.

If your version does not expose **Add Marketplace**, register the source from a
terminal where the Codex CLI is installed:

```sh
codex plugin marketplace add AccelByte/ai-plugins
```

Then restart/reload Codex, open its plugin manager, and install/enable the plugin.
**Adding the marketplace only makes the plugin discoverable; it does not finish
activation.** The exact plugin-manager layout can differ between Codex versions.

**Expected result:** AccelByte AI Plugins appears as installed and enabled.

#### If your team uses Claude Code instead

Run these commands in the Claude Code conversation:

```text
/plugin marketplace add AccelByte/ai-plugins
/plugin install accelbyte-ai-plugins@accelbyte
/reload-plugins
```

Then use the same natural-language prompts below. For Cursor, Kiro, or OpenCode,
follow the corresponding section in the [official plugin installation guide](https://github.com/AccelByte/ai-plugins/blob/main/INSTALL.md).

### Step 7. Verify that the assistant can use the plugin

Paste this into Codex:

```text
Use the AccelByte AGS skill from AccelByte AI Plugins.
Confirm that the skill is available, inspect this project's framework or engine,
and explain which AGS SDK fits it. Do not change files or contact a live
namespace yet. If the skill is unavailable, say so instead of answering from memory.
```

**Expected result:** the assistant identifies the available skill and your project,
then gives a grounded SDK recommendation. It should not claim to have checked your
live namespace, because that connection has not been verified yet.

The plugin supplies instructions and references. An **MCP server** supplies tools
that let the assistant access a live service. Installing the plugin does not, by
itself, authenticate the assistant to your AGS account.

### Step 8. Configure the AGS API MCP connection

First obtain the MCP URL for your deployment. The plugin documents this Public/
Shared Cloud pattern:

```text
https://{studio}-{game}.prod.gamingservices.accelbyte.io/mcp/{studio}-{game}
```

Both occurrences must contain the actual AGS namespace/host values for your
environment. Do not insert the human-readable studio/game names or use the generic
registration host. If you cannot match this pattern to your environment, ask your
studio administrator or AccelByte support for its AGS API MCP URL.

Send this prompt with your confirmed values:

```text
Use the AccelByte AGS skill to set up the AGS API MCP connection for this project.

AI tool: Codex
Deployment: Public/Shared Cloud development environment
Game namespace: <YOUR_GAME_NAMESPACE>
AGS API MCP URL: <YOUR_CONFIRMED_MCP_URL>

Inspect existing MCP configuration first. Reuse a matching entry; otherwise add
only this AGS API connection in the project's .codex/config.toml. Do not replace
unrelated settings. Show the configuration change and the server name, then tell
me how to authenticate. Do not modify resources in AGS.
```

1. Check that the proposed URL and namespace match your development environment.
2. Review the configuration change and apply it when the assistant requests that step.
3. Note the configured MCP server name, for example `ags-api`.
4. Restart/reload Codex if it does not load the new tools automatically.

**Expected result:** Codex has an AGS API MCP entry for your deployment. A reachable
URL or a saved config file is not yet proof of authenticated access.

### Step 9. Authenticate and verify a live read

1. Open **Settings → MCP servers** in the desktop client and select
   **Authenticate** for the AGS entry when offered. Alternatively, use the terminal:

   ```sh
   codex mcp login <YOUR_CONFIGURED_SERVER_NAME>
   ```

2. Complete AGS sign-in in the browser and review the requested access. Use the
   account that can access your development game.
3. Return to Codex. If necessary, restart/reload so the tools become available.
4. Send this prompt:

   ```text
   Use the AGS API MCP connection to check my development setup read-only.
   Target game namespace: <YOUR_GAME_NAMESPACE>.
   First verify that authentication is fresh. Then read the target namespace
   configuration or its IAM client list, if my account has access.
   Report which live operation succeeded and whether it confirms the intended
   namespace. Do not create or update anything. Do not print credentials or tokens.
   ```

**Expected result:** the assistant reports an actual successful authenticated read
for the intended environment. A generic explanation of namespaces is not sufficient.
If access is rejected, resolve sign-in or permissions before starting integration.

## Prepare the project connection

Send one prompt at a time and inspect its result before moving to the next step.
These examples use plain language, so they do not depend on a host's slash-command
syntax. In hosts that expose the plugin commands, `/ags init` starts clean-slate
setup and `/ags <your request>` routes later work.

### Step 10. Prepare the project connection

Paste this prompt and fill in the values you collected:

```text
Use the AccelByte AGS skill to connect this project to my existing development game.

Admin Portal: <YOUR_ADMIN_PORTAL_URL>
Game namespace: <YOUR_GAME_NAMESPACE>
AGS Base URL: <YOUR_AGS_BASE_URL>
Public client ID: <YOUR_CLIENT_ID_OR_WRITE_NOT_CREATED_YET>

Inspect existing configuration and installed SDK versions first. Reuse existing
resources that fit. If a client is missing, show the exact client configuration
needed for this project's first guest-login integration before creating it.
Keep browser configuration public-only and secrets server-side. Configure the
connection, and report which connection checks passed and what remains.
Do not add gameplay, matchmaking, or other services in this step.
```

1. Verify the proposed target before accepting any AGS resource creation.
2. If the assistant requests an SDK installation as a separate step, send:

   ```text
   Use the AccelByte AGS skill to install or verify the SDK appropriate to the
   detected project. Reuse compatible existing packages, configure the development
   connection, and run the relevant build/type checks. Do not implement another feature.
   ```

3. If a local operation requires the AGS CLI, ask the plugin to install/verify it
   for your OS. Follow its setup instructions, then run `ags auth login` and
   `ags auth status` for the intended profile. CLI authentication is separate from
   MCP authentication; do not assume signing in to one signs in to both.

**Expected result:** the correct SDK/configuration is in place, the project checks
pass, and any missing provider/client access is explicitly identified.


<a id="integration-stages"></a>
## Integration stages

Complete and verify one stage before starting the next. The detailed plans are in
[docs/ags-plans](ags-plans/README.md); each stage below provides its agent handoff.

| Stage | Feature |
| --- | --- |
| 1 | [Device ID guest login](#stage-1) |
| 2 | [Private Cloud Save](#stage-2) |
| 3 | [Trusted replay and ranking](#stage-3) |
| 4 | [Server-issued draft configuration](#stage-4) |
| 5 | [Friend rooms](#stage-5) |
| 6 | [Asynchronous Saved-XI competition](#stage-6) |

<a id="stage-1"></a>
### Stage 1: Device ID guest login

Use the [detailed agent plan](ags-plans/2026-09-02-device-id-login.md) for prerequisites,
implementation scope, design details, and acceptance checks.

```text
Use the AccelByte AGS skill and docs/ags-plans/2026-09-02-device-id-login.md as the
implementation plan for this stage only. Inspect the current branch and completed
prerequisites first. Resolve any missing environment or authorization settings
before dependent implementation. Preserve existing offline mechanics, implement
the scoped player flow, and run every acceptance check. Record automated,
browser, and live-service evidence separately in docs/10-progress-tracker.md.
Report blockers honestly and stop before the next stage.
```

<a id="stage-2"></a>
### Stage 2: Private Cloud Save

Use the [detailed agent plan](ags-plans/2026-09-03-cloud-save-run-sync.md) for prerequisites,
implementation scope, design details, and acceptance checks.

```text
Use the AccelByte AGS skill and docs/ags-plans/2026-09-03-cloud-save-run-sync.md as the
implementation plan for this stage only. Inspect the current branch and completed
prerequisites first. Resolve any missing environment or authorization settings
before dependent implementation. Preserve existing offline mechanics, implement
the scoped player flow, and run every acceptance check. Record automated,
browser, and live-service evidence separately in docs/10-progress-tracker.md.
Report blockers honestly and stop before the next stage.
```

<a id="stage-3"></a>
### Stage 3: Trusted replay and ranking

Use the [detailed agent plan](ags-plans/2026-09-03-trusted-ranking.md) for prerequisites,
implementation scope, design details, and acceptance checks.

```text
Use the AccelByte AGS skill and docs/ags-plans/2026-09-03-trusted-ranking.md as the
implementation plan for this stage only. Inspect the current branch and completed
prerequisites first. Resolve any missing environment or authorization settings
before dependent implementation. Preserve existing offline mechanics, implement
the scoped player flow, and run every acceptance check. Record automated,
browser, and live-service evidence separately in docs/10-progress-tracker.md.
Report blockers honestly and stop before the next stage.
```

<a id="stage-4"></a>
### Stage 4: Server-issued draft configuration

Use the [detailed agent plan](ags-plans/2026-09-04-game-record-draft-config.md) for prerequisites,
implementation scope, design details, and acceptance checks.

```text
Use the AccelByte AGS skill and docs/ags-plans/2026-09-04-game-record-draft-config.md as the
implementation plan for this stage only. Inspect the current branch and completed
prerequisites first. Resolve any missing environment or authorization settings
before dependent implementation. Preserve existing offline mechanics, implement
the scoped player flow, and run every acceptance check. Record automated,
browser, and live-service evidence separately in docs/10-progress-tracker.md.
Report blockers honestly and stop before the next stage.
```

<a id="stage-5"></a>
### Stage 5: Friend rooms

Use the [detailed agent plan](ags-plans/2026-09-03-friend-room-session.md) for prerequisites,
implementation scope, design details, and acceptance checks.

```text
Use the AccelByte AGS skill and docs/ags-plans/2026-09-03-friend-room-session.md as the
implementation plan for this stage only. Inspect the current branch and completed
prerequisites first. Resolve any missing environment or authorization settings
before dependent implementation. Preserve existing offline mechanics, implement
the scoped player flow, and run every acceptance check. Record automated,
browser, and live-service evidence separately in docs/10-progress-tracker.md.
Report blockers honestly and stop before the next stage.
```

<a id="stage-6"></a>
### Stage 6: Asynchronous Saved-XI competition

Use the [detailed agent plan](ags-plans/2026-09-03-saved-xi-head-to-head.md) for prerequisites,
implementation scope, design details, and acceptance checks.

```text
Use the AccelByte AGS skill and docs/ags-plans/2026-09-03-saved-xi-head-to-head.md as the
implementation plan for this stage only. Inspect the current branch and completed
prerequisites first. Resolve any missing environment or authorization settings
before dependent implementation. Preserve existing offline mechanics, implement
the scoped player flow, and run every acceptance check. Record automated,
browser, and live-service evidence separately in docs/10-progress-tracker.md.
Report blockers honestly and stop before the next stage.
```

<a id="debugging-and-completion"></a>
## Debugging and completion

If a step fails, paste a redacted error and describe the expected behavior:

```text
Use the AccelByte AGS skill to diagnose this integration failure.
Feature: <LOGIN_OR_STORAGE_OR_SESSION>
Expected: <WHAT_SHOULD_HAPPEN>
Observed: <WHAT_ACTUALLY_HAPPENED>
Environment: development
HTTP status and redacted error: <ERROR_WITHOUT_TOKENS_OR_SECRETS>

Inspect the current configuration and relevant code. Identify the failing
operation and its caller before suggesting changes. Show the smallest supported
fix and the check that would prove it worked. Do not broaden permissions blindly.
```

**Expected result:** a diagnosis tied to an operation and evidence, followed by a
specific fix and verification—not a replacement of the entire integration.

## Common setup problems

| Problem | What to do |
| --- | --- |
| Marketplace added but skill unavailable | Install/enable `accelbyte-ai-plugins`, restart Codex, and repeat Step 7 |
| `/plugins` or Add Marketplace is missing | Use the documented marketplace CLI command, then the client's plugin manager; update the client if plugin support is absent |
| `codex` command is not recognized | Use the installed app's UI, or install the CLI through the official Codex instructions and reopen the terminal |
| Plugin answers questions but cannot read AGS | Complete MCP configuration and authentication in Steps 8–9 |
| MCP URL returns 401 | It may be reachable but unauthenticated; complete sign-in and retry the live read |
| MCP URL returns 404 or points to the wrong game | Confirm the deployment-specific host and namespace path |
| Live operation is forbidden | Confirm the correct account/game and inspect the exact operation's required access |
| Assistant tries to implement too much | Restate one feature, its boundaries, and its acceptance checks |

## You have finished when

- You can sign in to the AGS Admin Portal and select your development game.
- AccelByte AI Plugins is installed, enabled, and recognized by the assistant.
- An authenticated live read confirms access to your intended AGS environment.
- You have used a focused prompt to implement or verify guest login and reviewed
  the resulting evidence.

Use the implementation reference below when a stage needs more service detail.
For each completed stage, record local, browser, and live-service evidence
separately. Unverified stages remain open.

## Sources and verification

The signup form and official namespace/client documentation were inspected on
September 17, 2026. Plugin installation and MCP URL instructions were checked
against the installed AccelByte AI Plugins **0.6.13** documentation; use the
upstream installation guide for later releases. No account was registered and no
plugin installation or live AGS authentication was performed to write this tutorial.

- [AGS signup](https://prod.gamingservices.accelbyte.io/auth/register?utm_source=github&utm_medium=source-code&utm_campaign=sa-content&utm_content=2026-09-18-82-0-inspired-prototype)
- [Public Cloud introduction](https://docs.accelbyte.io/gaming-services/getting-started/shared-cloud/shared-cloud-intro/)
- [Create a game namespace](https://docs.accelbyte.io/gaming-services/modules/foundations/identity-access/how-to/namespaces/create-a-game-namespace/)
- [Get Client ID and connection values](https://docs.accelbyte.io/gaming-services/getting-started/get-client-id/)
- [AccelByte AI Plugins README](https://github.com/AccelByte/ai-plugins/blob/main/README.md)
- [AccelByte AI Plugins installation guide](https://github.com/AccelByte/ai-plugins/blob/main/INSTALL.md)
- [OpenAI: add a plugin marketplace](https://developers.openai.com/plugins/build/plugins#add-a-marketplace-from-the-cli)
- [OpenAI: MCP configuration and authentication](https://learn.chatgpt.com/docs/extend/mcp)

<a id="implementation-reference"></a>
## Connected implementation reference

These reference notes describe the connected project. Its source paths and
completed verification claims are background, not features implemented in the
offline starter. Follow the stages above to build your own integration.

<a id="reference-1"></a>
### 01 — Registration and setup



### Outcome

You have a development game namespace, separate browser and server OAuth clients,
and a local checkout configured to use them. This is developer onboarding; player
login is covered in the next chapter.

### Register and create the namespace

1. Follow the [official getting-started guide](https://docs.accelbyte.io/gaming-services/getting-started/)
   to register a developer account, verify it, and complete studio onboarding.
   For an existing studio, use an administrator invitation.
2. Open the studio Admin Portal and confirm you can administer game resources.
3. Create or select a development **game namespace**. Use its identifier in the
   application, rather than substituting the studio/publisher identifier.
4. Obtain the AGS service base URL for that environment. Portal, application, and
   AGS service URLs serve different purposes.
5. Record the base URL, game namespace, client IDs, and frontend/backend origins
   in private configuration. Keep server secrets in a separate secret store.

Existing project evidence uses Shared Cloud. Confirm your own deployment model
before configuring permissions. Shared Cloud uses module/group grants; Private
Cloud/BYOC may use resource/action grants. A custom hostname alone does not prove
the model; inspect the environment's permission catalogue.

### Configure the OAuth clients

Create a Public client for browser login and a Confidential client for the trusted
backend. Configure the Public client's redirect URI to match the application.
Device ID login does not navigate an OAuth callback; a future redirect-based
provider needs its actual callback registered separately.

| Caller | Runtime token | Operations to verify |
| --- | --- | --- |
| Browser Public client | Player token from Device ID login | Current user, own Player Records, Session lifecycle, Lobby connection |
| Backend acting for a player | Forwarded player token | Current-user validation, Session reads, Leaderboard reads, public Saved-XI reads |
| Backend Confidential client | Service token from server credentials | Game Record read; Player Record create/read/update; Statistics user-value create/read/update |

Enable Device ID authentication for development. Grant only the operations needed.
The existing Game Record integration records Shared Cloud module/group
`m_cloud_save/g_game_records` with **READ**; verify the equivalent in your environment.
Discover other exact grants from current API metadata and the permission catalogue;
service names alone do not establish group IDs.

Public clients still require player tokens for authenticated resource calls.
Successful login does not prove Cloud Save, Session, or server Statistics access.

### Configure the checkout and SDK

Use Node.js 22.13 or newer. From the repository root:

```powershell
npm ci
if (-not (Test-Path -LiteralPath apps/web/.env.local)) {
  Copy-Item apps/web/.env.example apps/web/.env.local
}
```

This preserves an existing `.env.local`. Fill it using your own values:

| Variable | Purpose |
| --- | --- |
| `NEXT_PUBLIC_ACCELBYTE_BASE_URL` | Browser-safe AGS service URL |
| `NEXT_PUBLIC_ACCELBYTE_NAMESPACE` | Browser-safe game namespace |
| `NEXT_PUBLIC_ACCELBYTE_CLIENT_ID` | Browser-safe Public client ID |
| `NEXT_PUBLIC_ACCELBYTE_REDIRECT_URI` | Public client redirect configuration |
| `ACCELBYTE_SERVER_CLIENT_ID` | Server-side Confidential client ID |
| `ACCELBYTE_SERVER_CLIENT_SECRET` | Server secret store or ignored local environment only |

Never put a secret in `NEXT_PUBLIC_*`. Keep access/refresh tokens out of environment
files, browser storage, screenshots, and published diagnostics.

The SDK packages are already declared. `npm ci` installs their lockfile versions:

| Package | Use |
| --- | --- |
| `@accelbyte/sdk` | SDK configuration and in-memory tokens |
| `@accelbyte/sdk-iam` | Login and current-user verification |
| `@accelbyte/sdk-cloudsave` | Player Records and Game Records |
| `@accelbyte/sdk-social` | Statistics APIs |
| `@accelbyte/sdk-leaderboard` | Ranking reads |
| `@accelbyte/sdk-session` | Game sessions |
| `@accelbyte/sdk-lobby` | Session notification socket |

Start with `npm run dev --workspace @football-11/web`. The UI-only preview does
not provide trusted API routes. Complete the resource chapters before expecting
all connected features to work in a new namespace.

### Troubleshooting and acceptance

| Symptom | First check |
| --- | --- |
| Missing browser configuration | Public values existed when the frontend was built |
| Unexpected namespace at login | Client, base URL, and namespace belong to one environment |
| `SERVER_NOT_CONFIGURED` | Confidential credentials reached the server runtime |
| One service is forbidden | That exact call's token and environment-specific authorization |

Setup passes when configuration loads without secrets in browser output,
operator access works, and chapter 02's token/current-user check passes. Record
service access evidence as each later chapter is completed.

Sources: environment example (connected-branch path: `../../apps/web/.env.example`),
[SDK packages](../apps/web/package.json),
browser configuration (connected-branch path: `../../apps/web/src/services/ags/config.ts`), and
server configuration (connected-branch path: `../../apps/web/src/server/agsServerGateway.ts`).

<a id="reference-2"></a>
### 02 — Login and identity



### Outcome and prerequisites

Guest sign-in returns an authenticated AGS player; reloading the same browser
origin restores that identity. Complete the Public client and Device ID setup in
[chapter 01](#reference-1). Guest login is implemented; account
upgrade/linking is not.

### Connect the authentication flow

1. Read `football11.ags-device.v1` from browser storage. If absent, generate and
   store a random UUID with `crypto.randomUUID()`. It is not an AGS user ID or fingerprint.
2. Construct the SDK with base URL, namespace, Public client ID, and redirect URI.
   Do not supply a client secret.
3. Use `DeviceGuestAuth` to call `AgsAuthGateway.loginWithDevice`. The wrapper shares
   an in-flight promise to prevent concurrent login requests.
4. The adapter calls `IamOAuthClient.exchangeTokenOauthByPlatformId` for `device`,
   with the device ID, `createHeadless: true`, and `skipSetCookie: true`.
5. Require an access token and user ID, check the returned namespace, then install
   access and refresh tokens on the SDK instance in memory.
6. Call `IamUserClient.getCurrentUser()` and require its user ID to match the login
   response before exposing the authenticated identity.
7. Reuse the authenticated SDK for Cloud Save, Session, and Lobby. For the trusted
   application API, send the current access token in `Authorization: Bearer ...`.

Recorded IAM operations are `POST /iam/v3/oauth/platforms/device/token` and
`GET /iam/v3/public/users/me`. The first obtains a token; the second requires it.
Development evidence required no additional Shared Cloud permission group for
these public operations. Verify provider/client behavior in your own namespace.

### Identity and session lifetime

| Value | Lifetime and use |
| --- | --- |
| Random Device ID | Persisted for this browser origin; restores the development guest |
| AGS user ID | Returned by authenticated IAM; owns saves and submissions |
| Access/refresh tokens | SDK memory; never persisted by the application |
| Display name | Presentation only; never an authorization key |

Reload authenticates again with the stored Device ID. Different profiles, cleared
storage, or another origin can produce a different guest. Moving from Sites to
GitHub Pages does not transfer browser identity automatically.

Handle expiry/rejection with visible sign-in and retry. An in-memory refresh token
is not proof that every long-running Session/Lobby recovery case works; test those
separately. Keep the `DeviceGuestAuth` instance stable so its request guard survives
ordinary UI rerenders.

### Verification

```sh
npm run ags:auth:smoke
```

This creates development identities. Confirm token minting, current-user lookup,
same-device restoration, and different-device separation. In the actual browser:

- [ ] Sign-in shows progress and completes only after user verification.
- [ ] Reload preserves the same guest on the same origin.
- [ ] An isolated profile gets a different guest.
- [ ] Failed login leaves a retryable state.
- [ ] Browser storage contains no access or refresh token.

### Troubleshooting

| Symptom | Investigation |
| --- | --- |
| Token request rejected | Device ID provider, Public client, namespace, and base URL |
| Current-user read fails after login | Token installed before lookup; correct SDK instance |
| Wrong guest after reload | Origin/profile changed or Device ID cleared/replaced |
| Repeated login requests | Stable `DeviceGuestAuth` instance and pending-request guard |
| Downstream unauthorized | Same authenticated SDK or current bearer token reaches that call |

### Remaining account recovery work

Choose a supported durable provider, implement upgrade/linking to the existing
guest identity, and prove that the same AGS user and saves return on another device.
Alternatively, explicitly accept and communicate unrecoverable guest accounts
before connected-product release. Developer registration does not provide player recovery.

Sources: auth gateway (connected-branch path: `../../apps/web/src/services/ags/authGateway.ts`),
request deduplication (connected-branch path: `../../apps/web/src/services/ags/deviceAuth.ts`),
Device ID storage (connected-branch path: `../../apps/web/src/services/ags/deviceIdentity.ts`), and
[login evidence](#stage-1).

<a id="reference-3"></a>
### 03 — Player storage with Cloud Save



### Outcome and prerequisites

An authenticated player can save a completed run, verify readback, and restore it
after reload. Finish [login](#reference-2) first. Ordinary saves use
the player's token and do not need a Confidential client.

Cloud Save is the durable latest-run store. Despite its `services/local` path,
`runStore.ts` now maps and validates records rather than persisting completed runs
in browser storage. The older local/cloud reconciliation plan is historical.

### Record ownership and configuration

The application creates Player Records as needed. Do not seed empty placeholders
that fail validation. The namespace Game Record in chapter 04 is created by an operator.

| Key | Visibility / writer | Purpose |
| --- | --- | --- |
| `football11_latest_run_v1` | Private / player | Latest completed run |
| `football11_active_draft_challenge_v1` | Private / server | Player-bound issued challenge |
| `football11_trusted_settlement_v1` | Private / server | Accepted ranked-result receipt |
| `football11_saved_xi_v1` | Public / server | Published eligible XI |
| `football11_saved_xi_challenge_v1` | Private / server | Opponent challenge and private evidence |
| `football11_async_history_v1` | Private / server | Competition history and recovery |

Visibility and authority are separate: public Saved XIs remain `SERVER`-owned.
Private player-written saves do not become trusted competitive results.

### Connect save and restore

1. Convert the in-memory completion with `createCloudRunRecord`, binding its owner
   to the authenticated AGS user. Reject mismatched ownership.
2. Include seed, version bundle, actions, state hashes, result, timestamp, optional
   room context, and frozen configuration needed to reproduce the record.
3. Check serialized UTF-8 size. The application guard is **250 × 1024 bytes**;
   this project policy is not a universal AGS service-limit claim.
4. Read the latest record. If valid with the same checksum, return `already-saved`.
5. Otherwise write the candidate with `__META.is_public: false`, then read back.
   A new completion deliberately replaces an older or damaged latest slot.
6. Check namespace/key/user in the response, then validate ownership, schema,
   checksum, supported versions, replayed result, and state hashes.
7. Report success only for matching readback. On reload, read and validate AGS data
   before restoring it into application state.

The adapter uses `PublicPlayerRecordApi.getRecord_ByUserId_ByKey` and
`updateRecord_ByUserId_ByKey` on the authenticated SDK. A read returning `404`
means no save yet. A checksum catches corruption, but a modified browser can
recompute it; protected results still require trusted server validation.

### Failure and concurrency behavior

After a failed save, the result remains in the current tab for retry. It is not a
durable offline backup; reloading can lose the unsaved result. Legacy locally
persisted latest-run values are ignored.

This is one latest slot, not history or multi-device merging. The current path
does not use optimistic-concurrency writes. Concurrent different completions can
overwrite one another; readback detects mismatches but does not provide transactional
history. Design durable history separately in [chapter 09](#reference-9).

| Symptom | Investigation |
| --- | --- |
| Save rejected with 401/403 | Reauthenticate; verify the owning player's token |
| Readback differs | Concurrent writers, returned owner/key, and checksum |
| Unsupported version | Release migration policy; do not bypass validation |
| Browser network error without status | Browser network/CORS and transport, separately from AGS authorization |
| Node passes but browser fails | Reproduce on the deployed origin; Node does not enforce browser CORS |

### Acceptance

```sh
npm run ags:cloud-save:smoke
```

The smoke uses a separate development test-record key. Also verify the real latest
slot in the browser:

- [ ] Save and matching readback succeed for the authenticated owner.
- [ ] Same-guest reload restores the result; another guest cannot restore it as its own.
- [ ] An identical retry is harmless; a new completion replaces the previous latest value.
- [ ] Malformed, incompatible, and unavailable saves produce understandable recovery states.

The tracker retains a Pages browser persistence investigation. Close it with
deployed save/reload evidence before declaring that deployment complete.

Sources: record mapping/validation (connected-branch path: `../../apps/web/src/services/local/runStore.ts`),
Cloud Save gateway (connected-branch path: `../../apps/web/src/services/ags/authGateway.ts`),
contracts (connected-branch path: `../../packages/contracts/src/index.ts`), and
[current storage responsibility](05-ags-and-cloudflare.md).

<a id="reference-4"></a>
### 04 — Game configuration and issued challenges



### Outcome and prerequisites

The backend reads shared configuration from an AGS Game Record and freezes it into
each issued challenge. Existing challenges retain their original revision when an
operator changes the active configuration. This integration is implemented.

You need player login, the trusted backend's Confidential client, permission to
read Game Records, and permission to create/read/update server-owned Player Records.
The next chapter explains the backend's authentication boundary.

### Configure the Game Record

Create `football11_game_config_v1` in the game namespace as a server-owned Game
Record. The value must match this exact schema:

```json
{
  "schemaVersion": 1,
  "activeRevision": "1",
  "revisions": {
    "1": {
      "maxOfferedPlayers": 15,
      "maxRerolls": 5
    }
  }
}
```

`schemaVersion` is numeric; revision identifiers are strings. The active revision
must exist. Offer limits must be integers from 3–15 and reroll limits integers from
0–5. The parser rejects unsupported shapes and unexpected keys at the validated
levels rather than silently using defaults.

The runtime Confidential client reads this record; it does not need permission to
edit configuration. Operators use their own authorized administration access to
create or activate revisions. Recorded Shared Cloud access is
`m_cloud_save/g_game_records` **READ**.

### Connect challenge issuance

1. The authenticated browser posts a request to `/api/draft-challenges`. Reuse
   the existing request builder and `IssueDraftChallengeRequestV1` contract.
2. The route requires JSON, applies a 4 KiB body limit, and passes the bearer token
   to `issueDraftChallenge`.
3. The backend validates the player through IAM and confirms the game namespace.
4. It checks `football11_active_draft_challenge_v1`. The same idempotency key and
   room context return the existing challenge rather than issuing a different one.
5. For a new challenge, `GameRecordAdminApi.getRecord_ByKey` reads the configuration
   using the service token. The gateway verifies namespace, key, and server ownership.
6. The backend validates the active revision, creates the challenge, and stores a
   private `SERVER`-owned player receipt containing its frozen configuration.
7. The browser uses the returned challenge. Trusted result submission later compares
   its seed, versions, revision, and configuration against the stored receipt.

Solo issuance stores one player's receipt. Room issuance additionally reads the
canonical Session, validates the leader/start conditions, identifies eligible
participants, and writes their challenge receipts. This does not finish the room
mutation-authority work described in [chapter 07](#reference-7).

There is one active-challenge record per player. Starting a different challenge
supersedes the previous unfinished challenge. It is not a queue of outstanding runs.

### Change configuration safely

1. Add a new revision with valid values before selecting it as active.
2. Change `activeRevision` to that revision using operator access.
3. Issue a new challenge and confirm it receives the new snapshot.
4. Submit an existing eligible challenge and confirm it still uses its old snapshot.
5. Retain old revisions while issued challenges can still be submitted.

The backend must fail visibly when configuration is absent or invalid. A browser
fallback would bypass the server-issued contract and should not be added.

### Troubleshooting and acceptance

| Symptom | Investigation |
| --- | --- |
| Start fails while login works | Game Record exists in the same namespace; service token can read it |
| Configuration rejected | Numeric schema version, string revision, valid ranges, exact field names |
| Changed limits rejected at submission | Submitted snapshot differs from the stored issued challenge |
| Old unfinished run rejected | A newer active challenge may have superseded its receipt |
| Same retry issues new data | Request did not preserve its idempotency key/room context |

- [ ] Valid configuration produces a player-bound receipt and challenge.
- [ ] Missing/malformed configuration produces an error, with no fallback challenge.
- [ ] A retry with the same request identity returns the existing challenge.
- [ ] Revision changes affect new challenges; forged snapshots fail trusted submission.

Sources: [configuration plan and schema](#stage-4),
issuance service (connected-branch path: `../../apps/web/src/server/draftChallenges.ts`),
HTTP route (connected-branch path: `../../apps/web/app/api/draft-challenges/route.ts`), and
browser adapter (connected-branch path: `../../apps/web/src/services/ags/draftChallenges.ts`).

<a id="reference-5"></a>
### 05 — Trusted backend and protected writes



### Outcome and prerequisites

The application derives the player from AGS authentication, validates submitted
evidence outside the browser, and writes competitive data using server credentials.
Trusted ranking and Saved-XI settlement are implemented; full room mutation and
comparison authority remain unfinished.

Complete setup, login, and Game Record configuration. A running server is required;
the static preview alone cannot provide trusted endpoints.

### Keep two authentication contexts

| Context | How it authenticates | Responsibilities |
| --- | --- | --- |
| Player request | Browser bearer token, validated with IAM current-user lookup | Identify the user; read Session and public ranking/discovery data |
| Protected backend operation | Confidential client credentials exchanged for a service token | Read configuration; write protected records and Statistics |

`AgsServerGateway` creates separate SDK contexts for these operations. A server
token establishes service permission; it does not establish which player owns an
incoming request. Derive that identity from the validated player token and check
the expected namespace.

The server reads `ACCELBYTE_SERVER_CLIENT_ID` and `ACCELBYTE_SERVER_CLIENT_SECRET`.
Base URL, namespace, and Public client ID can use the public configuration fallback;
the source also supports server-side `ACCELBYTE_BASE_URL`, `ACCELBYTE_NAMESPACE`,
and `ACCELBYTE_PUBLIC_CLIENT_ID` overrides. Keep both contexts on the intended environment.

### Connect the trusted submission

The implemented route is `POST /api/runs/submit`. Use the request contract and
browser adapter rather than posting a displayed score or a user ID.

1. Require `application/json`, a valid JSON body within 64 KiB, and a bearer token.
2. Parse the exact `TrustedRunSubmissionV1` schema: run/challenge identity, seed,
   version bundle, frozen configuration, ordered actions, and optional room ID.
3. Validate supported versions and bounded actions. Unexpected fields and malformed
   or incomplete evidence are rejected.
4. Call IAM to derive the authenticated user and check its namespace.
5. Read that user's private active-challenge receipt. Require the submission to
   match the server-issued player, challenge, seed, versions, and configuration.
6. For a room result, read the canonical Session with the player token. Check
   namespace/template, active membership, locked participation, active challenge,
   and the server's derivation of the player's seed.
7. Replay through the shared packages and derive the result and hash on the server.
   A client-provided total is not used to authorize an update.
8. Read the trusted settlement receipt. A matching previous run/result is a duplicate;
   the same run ID with a different result hash is a conflict.
9. Settle the Statistic, persist/read back the private server-owned receipt, then
   return a sanitized ranking view.

The browser receives `{ ok: true, data: ... }` or
`{ ok: false, error: { code, message, details } }`. Responses use `no-store`.
Treat a failed protected submission separately from ordinary Cloud Save status.

### Retry and authority boundaries

Best-points settlement uses `MAX` before storing its receipt. If the statistic write
succeeds but the receipt fails, retrying the same accepted result cannot inflate
the best score. The receipt records the result hash and binds duplicate handling
to that result. This is the implemented recovery pattern, not a multi-resource
database transaction.

Saved-XI Challenge Score uses a different pattern: pending history and an absolute
score write. Follow [chapter 08](#reference-8); do not replace it with
an additive retry.

Keep server credentials outside browser bundles. Do not trust a submitted owner,
an unverified decoded token, a display name, or a `trusted` label stored by a player.
Server-owned AGS metadata and server validation establish the protected write path.

### Troubleshooting and acceptance

| Symptom | Investigation |
| --- | --- |
| 401 / missing session | Bearer token supplied and still valid |
| 403 / wrong namespace | Browser token and backend target are from the same game namespace |
| Schema or version rejection | Client build matches deployed server and issued contract |
| Receipt/configuration read fails | Correct key, namespace, ownership metadata, and service permissions |
| 409 settlement conflict | Same run identifier was submitted with different evidence |
| 502 upstream failure | Inspect redacted stage-specific error and AGS response; retry the original operation |

- [ ] A legal issued submission produces a verified receipt and numeric update.
- [ ] Duplicate accepted evidence does not double-apply a result.
- [ ] Wrong namespace, seed, configuration, versions, membership, and tampered evidence fail.
- [ ] Rejected input causes no competitive mutation.
- [ ] Receipt metadata is private and `SERVER`-owned on readback.

Sources: trusted route (connected-branch path: `../../apps/web/app/api/runs/submit/route.ts`),
replay service (connected-branch path: `../../apps/web/src/server/trustedReplay.ts`),
AGS gateway (connected-branch path: `../../apps/web/src/server/agsServerGateway.ts`), and
[trusted ranking evidence](#stage-3).

<a id="reference-6"></a>
### 06 — Statistics and Leaderboards



### Outcome and prerequisites

Accepted results update server-owned numeric values, and players can read the
associated ranking. Complete the [trusted backend](#reference-5) first.
The integration is implemented, but fair ranking across the content-version
migration remains a release decision.

Statistics stores numeric values; Cloud Save stores structured evidence. The
application uses `@accelbyte/sdk-social` for Statistics APIs and
`@accelbyte/sdk-leaderboard` for ranking reads.

### Configure the resources

Create these resources in the same game namespace:

| Resource | Setting | Value |
| --- | --- | --- |
| Best-points Statistic | Code | `football11bestpoints` |
| Best-points Statistic | Visibility / setter | Public / `SERVER` |
| Best-points Statistic | Bounds / cycle | 0–114 / no cycle |
| Leaderboard | Code | `football11-best-points` |
| Leaderboard | Backing Statistic | `football11bestpoints` |
| Leaderboard | Ordering / period | Descending / all-time |
| Challenge Score Statistic | Code | `football11challengescore` |
| Challenge Score Statistic | Visibility / setter | Private (`SERVERONLY`) / `SERVER` |
| Challenge Score Statistic | Default / minimum | 0 / 0 |
| Challenge Score Statistic | Leaderboard | None |

Use the checked-in Challenge Score definition (connected-branch path: `../../tools/ags/resources/football11-challenge-score.stat.json`)
when creating that Statistic. The runtime uses `MAX` for best points and `OVERRIDE`
for Challenge Score; these are update strategies chosen per server operation.
Verify Confidential-client access to create/read/update user values and player-token
access to ranking reads using the environment's actual permission metadata.

### Connect best-points settlement

1. After trusted replay, obtain the authenticated user ID and server-derived points.
2. Call `UserStatisticAdminApi.updateStatitemValueBulk_v2` with the Statistic code,
   user ID, points, and `updateStrategy: 'MAX'`.
3. Check the matching item's `success` flag. An HTTP-successful bulk response alone
   does not prove that this user's update succeeded.
4. Read through `createStatitemValueBulkGetOrDefault_ByUserId_v2` and require a
   finite value at least as high as the accepted points.
5. Persist the trusted receipt as described in chapter 05.

Lower results cannot replace a higher best, and repeating the same value cannot
inflate it. Challenge Score can decrease, so its settlement uses the separate
pending-history/absolute-value workflow in chapter 08.

### Connect ranking reads

The server's read path uses a player-token SDK context:

1. Read the user's all-time rank with
   `LeaderboardDataV3Api.getUser_ByLeaderboardCode_ByUserId_v3`.
2. Treat `404` as not yet ranked, not as a zero-point ranked entry.
3. Read a five-entry neighborhood with `getAlltime_ByLeaderboardCode_v3`, exclude
   hidden entries, and project only the fields needed by the application.
4. Compare materialized ranking points with the expected settled best. Return
   `ranked`, `stale`, `empty`, or `unranked` as appropriate.

A Statistic update and a materialized Leaderboard read may not be visible at the
same instant. Keep a stale/pending state and retry reads; do not resubmit an additive
score to force a refresh. This project uses sanitized display labels, so adding
profile enrichment would require separately verified IAM calls and permissions.

### Resolve content-version migration

The current catalogue recalibration changes the score distribution. Choose a new
Statistic/Leaderboard pair or an explicit reset/migration before treating old and
new scores as comparable. A resource-code change requires updates to
`TRUSTED_POINTS_STAT_CODE`, `TRUSTED_LEADERBOARD_CODE`, smoke checks, and Saved-XI
discovery. Rehearse it in development before production; this guide performs no reset.

### Troubleshooting and acceptance

| Symptom | Investigation |
| --- | --- |
| Statistic update fails | Exact code, setter policy, service token, and per-item response |
| Statistic correct but rank absent | Leaderboard linkage and materialization; retry ranking reads |
| Browser can change protected values | Review setter policy and authorization before release |
| Saved-XI discovery sees incompatible scores | Content-version migration and resource-code alignment |

Run `npm run ags:trusted-ranking:smoke` with the backend configured as in chapter 10.
Verify accepted update/readback, unchanged best after duplicate/lower submissions,
rejection without mutation, and correct empty/unranked/stale handling. Resolve the
tracked migration decision before marking ranking ready for connected release.

Sources: gateway calls (connected-branch path: `../../apps/web/src/server/agsServerGateway.ts`),
resource constants (connected-branch path: `../../apps/web/src/server/trustedReplay.ts`),
ranking client (connected-branch path: `../../apps/web/src/services/ags/trustedRanking.ts`), and
[ranking plan](#stage-3).

<a id="reference-7"></a>
### 07 — Sessions and Lobby



### Outcome and prerequisites

Authenticated players create, discover, join, and leave a shared room. Membership
and room state converge through canonical Session reads, accelerated by Lobby
notifications. The development loop is implemented; trusted room authority and
the full recovery matrix remain unfinished.

Complete login, Game Records, and the trusted backend first. Session owns the room;
Lobby supplies notifications. This flow needs no Matchmaking, AMS, or dedicated server.

### Configure the Session template

Create the template in the application's game namespace:

| Setting | Value |
| --- | --- |
| Name | `football11-friend-room-v1` |
| Server type | `NONE` |
| Persistent | `false` |
| Initial joinability | `OPEN` |
| Minimum / maximum players | 1 / 8 |
| Session TTL | 24 hours |
| Inactive timeout | 120 seconds |
| Invite timeout | 60 seconds |
| Native join-code generation | Enabled |

The recorded environment reserves persistent sessions for dedicated-server
sessions. Use this nonpersistent template for the no-server room.

Verify player-token access to create/read/query/join/update/leave and code operations
in your environment. The earlier plan explicitly did not treat an unpersisted
Public-client permission edit as proof; successful authenticated operations are
the relevant evidence. Do not replace that with an assumed grant list.

Application settings are separate from template lifetime settings:

| Browser variable | Default | Accepted range |
| --- | --- | --- |
| `NEXT_PUBLIC_FRIEND_ROOM_MAX_PLAYERS` | 8 | Integer 1–8 |
| `NEXT_PUBLIC_FRIEND_ROOM_ROUND_SECONDS` | 900 | Integer 30–3600 |
| `NEXT_PUBLIC_FRIEND_ROOM_COUNTDOWN_SECONDS` | 30 | Integer 3–300 |

### Connect Session operations

Create `AgsSessionGateway` from the shared SDK only after login has installed its
token. Keep Session initialization behind the browser/hydration boundary.

| Application operation | Current SDK operation |
| --- | --- |
| Create room | `createGamesession` |
| Discover rooms | `createGamesession_ByNS` |
| Restore own sessions | `getUsersMeGamesessions` |
| Read canonical snapshot | `getGamesession_BySessionId` |
| Join by ID / code | `createJoin_BySessionId` / `createGamesessionJoinCode` |
| Update state | `patchGamesession_BySessionId` |
| Revoke / regenerate code | `deleteCode_BySessionId` / `updateCode_BySessionId` |
| Leave | `deleteLeave_BySessionId` |

Validate returned namespace, template name, server type, and supported joinability.
Discovery presents compatible, non-full, open rooms. Store the compact application
room aggregate in the `football11Room` Session attribute; do not treat arbitrary
unvalidated attributes as a valid room.

An update reads the current snapshot, computes the next aggregate, and patches with
the current Session `version`. A `409` causes a fresh read and bounded retry; do not
keep replaying a stale version. The adapter currently permits four attempts.

Keep rooms open while waiting and between rounds; close joining for an active round.
Challenge issuance goes through the trusted backend, which stores player-bound
receipts. The Session snapshot carries the canonical room challenge used by trusted
submission checks.

### Connect Lobby notifications

1. Create `Lobby.WebSocket` from the authenticated SDK.
2. Call `connect()` before registering callbacks: the installed SDK creates its
   native socket during that call.
3. Listen for `messageSessionNotif` with `OnSessionJoined`,
   `OnSessionMembersChanged`, `OnGameSessionUpdated`, or `OnSessionEnded`.
4. Treat the message as a refresh hint. Read the canonical Session instead of
   applying the message payload as authoritative state.
5. Retain the four-second polling fallback for missed events and reconnects.
6. Remove listeners and disconnect when leaving the room or disposing the connection.

The TypeScript adapter receives raw envelopes and tolerates missing session IDs.
Notification delivery alone is not proof of state convergence; compare canonical
snapshots on separate clients.

### Complete authority and recovery work

Existing cooperative browser guards do not stop a modified member client from
altering the room aggregate. Finish these items before competitive acceptance:

1. Move leader/start mutations through the trusted boundary, checking the live
   leader, membership, readiness, and expected Session state there.
2. Build comparison output from trusted result receipts instead of accepting
   member-written result summaries from Session attributes.
3. Verify hosted room-context submission, including rejected membership/seed changes.
4. Capture explicit exit behavior for abandonment, timeout, host loss, and reconnect.

Ranked room replay already checks canonical membership and challenge context.
That protection does not make every room update or displayed comparison trusted.

### Verification and troubleshooting

```sh
node --env-file=apps/web/.env.local tools/ags/smoke-friend-room.mjs
```

This creates test identities/sessions against AGS. Also use two isolated browser
profiles to verify create/join, shared membership/readiness, closed-join rejection,
code revoke/regeneration, reopen, next-round state, reconnect, and leave cleanup.

| Symptom | Investigation |
| --- | --- |
| Room absent from discovery | Joinability, capacity, template/namespace compatibility, valid attributes |
| Join returns 403 | Closed room or authorization; inspect canonical state and actual response |
| Repeated 409 updates | Concurrent writes and stale Session versions |
| No Lobby refreshes | Login order, socket setup/listener order, event topic, polling fallback |
| Reload cannot restore room | Own-session query, membership, session lifetime, compatible saved room context |

Acceptance requires both service lifecycle evidence and browser convergence/recovery,
plus completion of the authority items above. The tracker still marks those exits open.

Sources: Session adapter (connected-branch path: `../../apps/web/src/services/ags/sessionGateway.ts`),
Lobby adapter (connected-branch path: `../../apps/web/src/services/ags/lobbyGateway.ts`),
room state (connected-branch path: `../../apps/web/src/state/friendRoomMachine.ts`), and
[Session evidence](#stage-5).

<a id="reference-8"></a>
### 08 — Saved-XI discovery and settlement



### Outcome and prerequisites

The backend publishes an eligible record, selects a compatible opponent from AGS
ranking data, and settles a challenge into private AGS state. This integration is
implemented and uses no Matchmaking queue or shared live Session.

Complete trusted replay, best-points ranking, and the private Challenge Score
Statistic in chapters 05–06. At least two compatible published records are needed
to verify successful opponent discovery; an empty candidate set is a valid outcome.

### Resource and route map

| Resource | Ownership and purpose |
| --- | --- |
| `football11_saved_xi_v1` | Public, `SERVER`-owned Player Record; one published XI per user |
| `football11_saved_xi_challenge_v1` | Private, `SERVER`-owned Player Record; issued token, snapshots, seed |
| `football11_async_history_v1` | Private, `SERVER`-owned Player Record; up to 20 matches and recovery state |
| `football11challengescore` | Private, `SERVER`-set Statistic; default/minimum zero; no Leaderboard |

The application writes Player Records at runtime. Create the Statistic first using
the resource definition (connected-branch path: `../../tools/ags/resources/football11-challenge-score.stat.json`).

| Application API | Purpose |
| --- | --- |
| `GET /api/saved-xi` | Read competition status |
| `PUT /api/saved-xi` | Publish or replace an eligible XI |
| `POST /api/opponents/nearby` | Issue an opponent challenge |
| `GET /api/asynchronous-matches` | Read competition status/history |
| `POST /api/asynchronous-matches` | Resolve the issued challenge |

All routes require the player's bearer token. They are application-owned routes,
not native AGS endpoint names.

### Publish the record

1. Authenticate the requesting player through IAM.
2. Replay the submitted run and read that player's trusted settlement receipt.
3. Require receipt run ID, result hash, and points to match the replay.
4. Read the server-owned best-points Statistic. Only a trusted run tied with that
   current best can be published.
5. Write the public `SERVER`-owned record and verify its metadata/readback. An
   explicit replacement updates this one slot; it does not create unlimited entries.

Public records contain the data required for discovery, including their owner
identity. The application's public-facing response is a separate sanitized
projection; do not claim the underlying public AGS record is anonymous.

### Discover and issue a challenge

1. Load the requesting player's Saved XI, private history, and existing challenge.
2. Refuse new issuance while a settlement is pending or the rolling daily limit is reached.
3. Reuse an existing unconsumed, unexpired challenge instead of creating a new opponent.
4. Read nearby entries from `football11-best-points` at ±10 ranks, expanding once
   to ±50 if needed. The backend chooses the candidate set; the browser does not.
5. Bulk-read public Saved XIs using the player token. Exclude self, missing/invalid
   records, incompatible versions, and recent opponents.
6. Select a surviving candidate and store full snapshots plus a private seed in
   the server-owned challenge record. Return an opaque token and sanitized preview.

Current limits are a ten-minute token lifetime, 24-hour same-opponent exclusion,
20 matches in a rolling 24 hours, and at most 20 stored history entries. These are
application rules enforced by the backend, not generic AGS defaults.

### Resolve without double-applying a score

1. Authenticate, load the issued challenge, and require the exact token.
2. If history already contains its match, return the settled result or repair the
   same pending settlement. Do not perform a new resolution for a duplicate request.
3. Otherwise reject consumed/expired challenges and incompatible snapshots.
4. Derive the result on the server and calculate the absolute next Challenge Score.
5. Persist immutable match evidence with `settlementStatus: 'pending'` in history,
   then mark the issued challenge consumed.
6. Write the absolute target using Statistics `OVERRIDE`, verify exact readback,
   and mark the history entry settled.

Only the challenger changes. An absolute retry plus the stored target repairs a
partial failure without applying the change again. This documented retry behavior
does not imply cross-record transactional isolation under arbitrary concurrent
requests; concurrency/abuse review remains part of release hardening.

### Verification and troubleshooting

Run `npm run ags:saved-xi:smoke` with the backend and namespace configured as in
chapter 10. The smoke creates two development players and changes test data.

- [ ] Only a matching trusted personal-best run can be published.
- [ ] Published metadata is public and server-owned; challenges/history remain private.
- [ ] Discovery is backend-selected and excludes incompatible/recent opponents.
- [ ] Duplicate resolution returns the same result and leaves the opponent's score unchanged.
- [ ] Pending settlement recovers after retry/reload without another score change.
- [ ] Expired, wrong-token, and daily-limit cases return understandable errors.

| Symptom | Investigation |
| --- | --- |
| `RUN_NOT_TRUSTED` | Receipt and submitted replay describe the same run |
| `NOT_PERSONAL_BEST` | Trusted result equals the current best Statistic |
| No opponent | Other published records, rank materialization, versions, cooldowns |
| Pending settlement blocks search | Retry the original resolution and inspect Statistic readback |
| Challenge expired | Request a new challenge after checking existing settlement state |

Sources: competition service (connected-branch path: `../../apps/web/src/server/savedXiCompetition.ts`),
AGS gateway (connected-branch path: `../../apps/web/src/server/agsServerGateway.ts`),
browser adapter (connected-branch path: `../../apps/web/src/services/ags/savedXiCompetition.ts`), and
[recorded evidence](#stage-6).

<a id="reference-9"></a>
### 09 — Daily challenges, public results, and history



### Status and prerequisites

These integrations remain planned. This chapter describes the implementation work
needed to complete the guide's scope; none of the proposed resources or routes
below should be assumed to exist.

Reuse authenticated identity, server-issued challenges, trusted result receipts,
and AGS-backed storage from the earlier chapters. A latest-run slot and a bounded
Saved-XI match history do not constitute general result history.

### Establish the contracts first

| Concern | Contract to decide |
| --- | --- |
| Daily identity | UTC period, mode/category, canonical challenge ID, start/end time |
| Versioning | Pinned seed, content/rules/simulation versions, configuration snapshot |
| Attempts | Replay eligibility and which attempt can affect daily ranking |
| Public result | Opaque public ID, approved fields, removal/unavailable behavior |
| History | Retention, bounded index or pagination, ownership, missing-result handling |
| Storage authority | Server-writable canonical daily/result records; private player history |

Choose final record keys and API contracts when implementing. Verify the target
Cloud Save operations and concurrency guarantees before choosing how canonical
creation works; a single read-then-write check is not proof of uniqueness.

### Implement the daily lifecycle

1. Use server time to determine the active UTC period.
2. Create or return one canonical challenge for that period and category.
3. Freeze seed, versions, and configuration at creation; deployments must not
   silently alter a still-active daily challenge.
4. Choose scheduled creation or idempotent lazy creation. Prove behavior when
   concurrent requests race, and record which path is authoritative.
5. Bind player participation to the canonical challenge through server-owned receipts.
6. Enforce the chosen attempt/ranking rule at trusted submission time. Keep daily
   categories separate from random-run ranking unless comparability is explicitly established.

The current Game Record supports shared configuration. An AGS Game Record is a
candidate for canonical daily data, but the final storage/concurrency design is
still to be implemented and verified.

### Publish a trusted public projection

1. Start from an accepted server result and retain its immutable evidence privately.
2. Generate an opaque public result identifier, separate from the private player key.
3. Publish only approved summary fields needed by the result route.
4. Serve the stable public projection through the backend; do not expose tokens,
   private account data, or raw validation evidence.
5. Return an unavailable response for unknown/private/removed results and provide
   a removal path for published data.

The Phase 3 plan proposes `/results/{publicResultId}` and related data routes;
they are not implemented endpoints. Share-image design is outside this integration
guide, but any downstream renderer must consume the same approved public projection.

### Add durable player history

Store a durable history index under the authenticated AGS user. Define a bounded
size or pagination before choosing record layout. Write references only after the
associated result is safely stored, and design retry/reconciliation for partial failures.

A browser cache can improve read performance, but must not become the durable source.
After identity restoration, retrieve the authoritative AGS index and handle removed
or unavailable results. Cross-device history depends on the recovery/linking work
in chapter 02; a fresh Device ID does not recover a previous guest's records.

### Acceptance and likely failure cases

- [ ] Concurrent requests for one UTC period return the same canonical challenge.
- [ ] Midnight rollover produces a new challenge without altering the old one.
- [ ] A deployment during the period leaves active versions/configuration unchanged.
- [ ] Attempt eligibility is enforced on the server and retries cannot add extra ranked attempts.
- [ ] Only accepted results receive public projections; removed/private results do not leak.
- [ ] History survives cache removal and restores for the same authenticated account.
- [ ] Partial writes recover without dangling or duplicate visible history entries.

Investigate duplicate daily challenges as a concurrency problem, changed challenges
as a version-freezing problem, and lost history as an identity or durable-index
problem. Do not mask any of them by rebuilding authoritative state from browser storage.

Source: [Phase 3 contracts and exit criteria](phases/phase-03-sharing-and-daily.md).
Keep P3-01 through P3-05 in the [tracker](10-progress-tracker.md) open until their
implementation and acceptance evidence exists.

<a id="reference-10"></a>
### 10 — Deployment and integration verification



### Outcome

The intended deployment can authenticate players, persist/recover data, run trusted
operations, and recover room/settlement state. Passing local tests or creating AGS
resources alone does not establish this outcome.

### Configure both runtime boundaries

1. Supply browser-safe AGS values before building the frontend. Its bundle needs
   the correct base URL, game namespace, and Public client ID.
2. Put Confidential-client credentials in the backend secret store. Configure the
   server's namespace/base URL consistently with the browser.
3. Deploy the trusted API routes with the server runtime. A static frontend can
   call them but cannot execute them.
4. For same-origin hosting, leave `NEXT_PUBLIC_API_ORIGIN` empty. The adapter uses
   relative `/api/...` requests.
5. For a split deployment, configure the trusted API origin and allow only the
   intended frontend origins in the backend CORS policy. The generic adapter accepts
   an HTTPS origin, without credentials, query, fragment, or a path prefix.

**Current Pages-build detail:** `vite.preview.config.ts` hardcodes the existing
Sites API origin in Pages mode. Setting `NEXT_PUBLIC_API_ORIGIN` alone does not
retarget that build. For another backend, update that explicit Pages configuration
and the backend origin allowlist together. `FOOTBALL11_PAGES_URL` changes the Pages
frontend URL/base-path configuration, not the API backend.

Register callback URLs when using redirect-based login. The current Device ID flow
does not redirect. Browser identity is scoped to the frontend origin, so moving
origins may create a new guest even when both deployments use the same namespace.

### Run repository checks

```sh
npm ci
npm run verify
```

`verify` runs formatting, typechecking, lint, tests, and the production build.
It does not prove live AGS access. For static Pages output also run:

```sh
npm run build:pages --workspace @football-11/web
```

Inspect public output for private configuration before publishing. For this
documentation change, no application tests or live smokes were rerun; the commands
here are the verification procedure for an actual integration/deployment.

### Run live development checks

These commands create test identities/records, sessions, and Statistic values.
Use a development namespace, keep credentials in the ignored environment file,
and retain redacted output rather than tokens or raw identity dumps.

```sh
npm run ags:auth:smoke
npm run ags:cloud-save:smoke
node --env-file=apps/web/.env.local tools/ags/smoke-friend-room.mjs
```

For trusted ranking and Saved-XI checks, build first and start the trusted backend.
The smoke scripts default to `http://127.0.0.1:8787`; use the actual running server
address if it differs. Configure custom targets in the same PowerShell session:

```powershell
$env:FOOTBALL11_TRUSTED_ROUTE_URL = 'https://your-backend.example/api/runs/submit'
$env:FOOTBALL11_COMPETITION_BASE_URL = 'https://your-backend.example'
npm run ags:trusted-ranking:smoke
npm run ags:saved-xi:smoke
```

Replace the placeholder origin. The ranking smoke derives `/api/draft-challenges`
from its target origin unless `FOOTBALL11_CHALLENGE_ROUTE_URL` overrides it.
The npm smoke scripts load AGS credentials from `apps/web/.env.local`; setting the
route URL does not change their AGS namespace automatically.

| Check | Evidence to retain |
| --- | --- |
| Auth | Token mint/current-user success; same-device and different-device behavior |
| Cloud Save | Write/readback/replay checks and payload size |
| Trusted ranking | Valid acceptance, duplicate handling, tamper rejection, receipt/Statistic/rank readback |
| Sessions | Create/query/join/code/update/leave lifecycle |
| Saved-XI | Two-player discovery, protected record metadata, duplicate resolution, unchanged opponent score |

### Verify in the deployed browser

- [ ] Same-guest login and reload work on the real frontend origin.
- [ ] Latest-run Cloud Save reports success, then restores after reload.
- [ ] Trusted challenge issuance and result submission reach the intended backend.
- [ ] A rejected or expired token causes an actionable error, not a silent success.
- [ ] Two isolated players converge on room state and recover from reconnect/leave.
- [ ] Saved-XI pending settlement and duplicate resolution recover correctly.
- [ ] Cross-origin preflights allow the required method and Authorization/Content-Type
      headers; errors retain appropriate CORS headers; unapproved origins are rejected.

A Node smoke cannot validate browser CORS. The existing Pages Cloud Save warning
must be closed with actual deployed save/reload evidence. Likewise, Lobby notification
delivery does not replace multi-client Session convergence checks.

### Integration completion gates

| Remaining item | Evidence needed |
| --- | --- |
| Account recovery/loss policy | Verified linking flow or explicit accepted account-loss policy |
| Content-version rankings | Applied and verified migration/reset/new-resource decision |
| Room authority | Server-enforced mutations and comparison based on trusted receipts |
| Room recovery | Hosted context, abandonment, timeout, and host-loss verification |
| Daily/public/history | Chapter 09 implemented and its acceptance checks passed |
| Deployed persistence | Browser save/readback/reload succeeds on the target origin |
| Release operations | Narrow permissions, dependency/security review, reconciliation, migration and rollback rehearsal |

Record namespace/environment labels, build/version, test date, expected/observed
outcome, and redacted evidence in the [progress tracker](10-progress-tracker.md).
Mark a feature complete only after its acceptance passes. Unresolved AGS integration
gates do not retroactively invalidate the standalone Functional MVP.

This guide covers integration completion. The project's separate rights and product
release gates remain in the [connected-release checklist](phases/phase-06-mvp-hardening-and-release.md).

Sources: [hosting guide](11-github-pages.md),
API URL adapter (connected-branch path: `../../apps/web/src/services/apiUrl.ts`),
Pages build configuration (connected-branch path: `../../apps/web/vite.preview.config.ts`),
CORS policy (connected-branch path: `../../apps/web/src/server/apiCors.ts`), and
smoke scripts (connected-branch path: `../../tools/ags/`).
