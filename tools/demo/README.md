# Draft demo capture

This local-only presentation harness uses the production `DraftScreen` and
`ResultScreen`, the full catalogue, and shared game mechanics. Every player is
selected and placed through the UI. It does not authenticate, save online, or
prove AGS behavior. The exported edit keeps an offline-demo label visible.

## Requirements and commands

Run from the repository root after `npm ci` and `npm run typecheck`.
Provide Playwright through a local installation or set `DEMO_PLAYWRIGHT_PATH`
to an installed Playwright package directory. Install its Chromium browser with
the Playwright CLI, or set `DEMO_BROWSER_PATH` to a compatible Chromium executable.
FFmpeg with libx264 and drawtext support must be on PATH (or set `FFMPEG_PATH`).

```powershell
npm run demo:capture
npm run demo:edit -- artifacts/demo/<timestamp>
```

For a visible browser suitable for OBS window capture:

```powershell
npm run demo:capture -- --headed
```

The script starts and stops its own local Vite server on port 4187. Keep that
port available. `DEMO_SEED` changes the draft; the default is
`football11-demo-v1`. A fresh browser context is used for every recording.
`DEMO_OUTPUT` changes the parent output directory. Captures have unique timestamp
directories and are ignored by Git.

## Outputs

- `raw.webm`: 1920×1080 browser recording, without audio.
- `01-draft.png`, `02-player-selected.png`, `03-lineup.png`: visual checks.
- `cues.json`: source timing cues, real draft actions, result, and error checks.
- `draft-demo.mp4`: edited H.264 video with a first-selection zoom, normal-speed
  placement, remaining picks at 3× speed, and a finished-XI hold.
- `edit.json`: source ranges and speed settings; intermediate shot files remain
  available for re-editing.

The cursor ring is a recording overlay, not game UI. The local harness header
also identifies the recording as offline. It is not linked from the production
application and does not change production authentication behavior.

Capture fails unless all eleven UI placements reach a complete result and no
page errors or external HTTP requests occur. Review screenshots and the edited
video before publishing. Browser capture timing is approximate; the cues support
editorial cuts, not frame-accurate performance measurement. For smoother match
footage, use OBS at 60 fps; browser video here is intended for a draft walkthrough.

The current game resolves a simulated season after drafting. This clip does not
depict a real-time football match. Record a separate live-environment journey
when demonstrating authentication, cloud persistence, or trusted rankings.

## Live two-player friend rooms

```powershell
npm run demo:friends:capture
npm run demo:friends:edit -- artifacts/demo/friends-<timestamp>
```

This uses the hosted game directly with two isolated browser contexts and fresh
AGS guest accounts. It creates a real room, joins it by its actual code, readies
both players, starts a shared challenge, completes 22 UI picks, and compares the
two live room result snapshots with the completed local drafts. HTTP responses
are observed without mocking; the evidence file saves only service/status counts
and sanitized checks, never credentials or full user/session identifiers.

Both guests leave the capture's room at the end where the UI allows it. Inspect
the cleanup flags in `friends-cues.json` if a capture fails. Guest profiles and
their normal completed-run cloud saves are real test data; the script does not
delete accounts or modify AGS configuration. Raw footage includes temporary room
codes and generated guest labels; check room cleanup before sharing footage.

The editor refuses an incomplete capture. It produces `friends-demo.mp4` and
`friends-demo.gif`, alternating host/friend views, enlarging membership and result
panels for split-screen shots, zooming first selections, and accelerating repeated
picks and waits with visible speed labels. The planned edit is at most 43 seconds;
the GIF uses 15 fps, 1280×720, and a hard cap of 999 frames. Verify its actual frame
count with `ffprobe -count_frames` before delivery. Timing cues share one clock,
with per-video offsets calibrated from a one-second magenta slate before the
first scene. These slates are excluded from the edit. The offsets are suitable for editorial synchronization,
not latency measurements. No audio is included.

The shared room comparison is client-coordinated AGS Session state. This recording
does not claim server-authoritative multiplayer scoring or trusted leaderboard
submission. Live guest login, membership, readiness, shared challenge, completed
drafts, and matching room results are the acceptance boundary.
