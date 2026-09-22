import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { performance } from 'node:perf_hooks';
import { execFileSync } from 'node:child_process';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.DEMO_PLAYWRIGHT_PATH || 'playwright');
const target = 'https://football-11-play.damar-indra.chatgpt.site/';
const out = resolve('artifacts/demo', `friends-${new Date().toISOString().replace(/[:.]/g, '-')}`);
await mkdir(out, { recursive: true });
const origin = performance.now();
const now = () => (performance.now() - origin) / 1000;
const pause = (ms) => new Promise((done) => setTimeout(done, ms));
const players = [];
const shots = [];
const checks = {};
const errors = [];
const network = [];
let roomId;
let success = false;
let failure;
const browser = await chromium.launch({
  headless: !process.argv.includes('--headed'),
  ...(process.env.DEMO_BROWSER_PATH ? { executablePath: process.env.DEMO_BROWSER_PATH } : {}),
});

async function waitFor(predicate, message, timeout = 45000) {
  const end = performance.now() + timeout;
  while (performance.now() < end) {
    if (await predicate()) return;
    await pause(250);
  }
  throw new Error(message);
}

async function click(player, locator, hold = 500) {
  await locator.waitFor({ state: 'visible' });
  await locator.scrollIntoViewIfNeeded();
  const box = await locator.boundingBox();
  if (!box) throw new Error('Missing click target');
  await player.page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 24 });
  await pause(hold);
  await locator.click({ timeout: 20000 });
}

async function shot(name, view, action, options = {}) {
  console.log(`Scene: ${name}`);
  const start = now();
  await action();
  shots.push({ name, view, start, end: now(), ...options });
}

async function draftEvidence(player) {
  return player.page.evaluate(() => {
    const key = Object.keys(sessionStorage).find((key) =>
      key.startsWith('football11.ags.friend-room.draft.v1.'),
    );
    if (!key) return null;
    const draft = JSON.parse(sessionStorage.getItem(key));
    return {
      count: draft.actions.length,
      roster: Object.keys(draft.snapshot.state.roster).length,
      points: draft.resolved?.result.season.points,
      wins: draft.resolved?.result.season.wins,
      hash: draft.resolved?.result.finalStateHash,
    };
  });
}

async function pick(player, ordinal, showcase = false) {
  const cards = player.page.locator('.offer-entry');
  const card = cards.nth(player.name === 'A' ? 0 : Math.min(1, (await cards.count()) - 1));
  await click(player, card, showcase ? 1200 : 250);
  if (showcase) await pause(1500);
  const slot = player.page.getByRole('button', { name: /^Place selected player at / }).first();
  await click(player, slot, showcase ? 900 : 250);
  await waitFor(
    async () => (await draftEvidence(player))?.count === ordinal,
    `${player.name} pick ${ordinal} did not persist locally`,
  );
  await pause(showcase ? 1300 : 450);
}

try {
  for (const name of ['A', 'B']) {
    const context = await browser.newContext({
      viewport: { width: 1920, height: 1080 },
      recordVideo: { dir: out, size: { width: 1920, height: 1080 } },
    });
    const videoStart = now();
    const page = await context.newPage();
    page.setDefaultTimeout(25000);
    const player = { name, context, page, videoStart, latest: null, userId: null };
    players.push(player);
    page.on('pageerror', () => errors.push({ player: name, type: 'pageerror' }));
    // Observe real responses. Do not save bodies, headers, tokens, or raw identifiers.
    page.on('response', async (response) => {
      try {
        const url = new URL(response.url());
        const service = ['iam', 'session', 'cloudsave', 'lobby'].find((s) =>
          url.pathname.startsWith(`/${s}/`),
        );
        if (service)
          network.push({
            player: name,
            service,
            status: response.status(),
            method: response.request().method(),
          });
        if (!response.ok()) return;
        if (url.pathname.includes('/users/me')) {
          const data = await response.json();
          if (data.userId) player.userId = data.userId;
        }
        if (url.pathname.includes('/gamesessions')) {
          const data = await response.json();
          if (data.id && data.attributes?.football11Room && (!roomId || data.id === roomId))
            player.latest = data;
        }
      } catch {
        /* Responses with no JSON body do not contribute to state evidence. */
      }
    });
    await page.goto(target, { waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: 'Continue as guest', exact: true }).waitFor();
    await page.getByRole('button', { name: 'Continue as guest', exact: true }).click();
    await page
      .getByRole('button', { name: 'Play with friends', exact: true })
      .waitFor({ timeout: 40000 });
    await page.evaluate(() => {
      const cursor = document.createElement('div');
      cursor.style.cssText =
        'position:fixed;left:20px;top:20px;width:20px;height:20px;border:2px solid white;border-radius:50%;background:#b8f35a88;box-shadow:0 0 0 5px #b8f35a22;z-index:9999;pointer-events:none;transform:translate(-50%,-50%)';
      document.body.append(cursor);
      document.addEventListener('mousemove', (e) => {
        cursor.style.left = `${e.clientX}px`;
        cursor.style.top = `${e.clientY}px`;
      });
    });
  }
  // A visual slate aligns the actual first encoded frame with the shared clock.
  // Page creation can precede video capture by several seconds on a cold browser.
  for (const player of players) {
    player.syncAt = now();
    await player.page.evaluate(() => {
      const slate = document.createElement('div');
      slate.id = 'capture-sync-slate';
      slate.style.cssText = 'position:fixed;inset:0;background:rgb(255,0,255);z-index:2147483647';
      document.body.append(slate);
    });
    await pause(1000);
    await player.page.locator('#capture-sync-slate').evaluate((node) => node.remove());
    await pause(300);
  }
  const [a, b] = players;
  checks.distinctGuests = Boolean(a.userId && b.userId && a.userId !== b.userId);
  if (!checks.distinctGuests) throw new Error('Two independent AGS identities were not verified');
  console.log('Live preflight: two distinct AGS guests authenticated.');

  await shot('Create a friend room', 'A', async () => {
    await click(a, a.page.getByRole('button', { name: 'Play with friends', exact: true }));
    await click(a, a.page.getByRole('button', { name: 'Create room', exact: true }));
    await a.page.getByRole('heading', { name: 'Waiting room', exact: true }).waitFor();
    await waitFor(() => Boolean(a.latest), 'No live room response');
    roomId = a.latest.id;
    await pause(1600);
    await a.page.screenshot({ path: join(out, '01-host-room.png') });
  });
  await shot('Join your friend', 'B', async () => {
    await click(b, b.page.getByRole('button', { name: 'Play with friends', exact: true }));
    const code = (await a.page.locator('.room-code strong').innerText()).trim();
    if (!code || code === 'Revoked') throw new Error('Room code was not generated');
    await b.page.getByPlaceholder('ABC123').pressSequentially(code, { delay: 140 });
    await click(b, b.page.getByRole('button', { name: 'Join by code', exact: true }));
    await b.page.getByRole('heading', { name: 'Waiting room', exact: true }).waitFor();
    await waitFor(
      () =>
        a.latest?.members.filter((m) => ['JOINED', 'CONNECTED'].includes(m.statusV2 || m.status))
          .length === 2 && b.latest?.id === roomId,
      'Both guests did not converge on the same room',
    );
    await pause(1800);
    await b.page.screenshot({ path: join(out, '02-guest-joined.png') });
  });
  checks.sameRoom = a.latest.id === b.latest.id;
  await shot('Both players ready', 'split', async () => {
    await click(a, a.page.getByRole('button', { name: 'Ready up', exact: true }));
    await a.page.getByRole('button', { name: 'Ready', exact: true }).waitFor();
    await click(b, b.page.getByRole('button', { name: 'Ready up', exact: true }));
    await b.page.getByRole('button', { name: 'Ready', exact: true }).waitFor();
    await waitFor(
      () => players.every((p) => p.latest?.attributes.football11Room.readyUserIds.length === 2),
      'Ready state did not synchronize',
    );
    await pause(1600);
  });
  checks.bothReady = true;
  await shot('Host starts the shared round', 'A', async () => {
    await click(a, a.page.getByRole('button', { name: 'Start round', exact: true }));
    await Promise.all(
      players.map((p) => p.page.locator('.offer-entry').first().waitFor({ timeout: 60000 })),
    );
    await pause(1600);
  });
  checks.sharedChallenge =
    a.latest.attributes.football11Room.challenge.challengeId ===
    b.latest.attributes.football11Room.challenge.challengeId;
  await shot('Player A - first selection', 'A', () => pick(a, 1, true));
  await a.page.screenshot({ path: join(out, '03-host-first-pick.png') });
  await shot('Player B - their own selection', 'B', () => pick(b, 1, true));
  await b.page.screenshot({ path: join(out, '04-guest-first-pick.png') });
  await shot(
    'Remaining drafts - accelerated',
    'split',
    async () => {
      for (let ordinal = 2; ordinal <= 11; ordinal++) {
        // Stagger real room writes to reduce optimistic version conflicts.
        await pick(a, ordinal);
        await pick(b, ordinal);
      }
    },
    { speed: 4 },
  );
  const drafts = await Promise.all(players.map(draftEvidence));
  checks.bothCompletedXI = drafts.every(
    (d) => d?.count === 11 && d.roster === 11 && Number.isFinite(d.points),
  );
  if (!checks.bothCompletedXI) throw new Error('Both real drafts did not complete');
  await waitFor(
    () =>
      players.every((p) =>
        ['REVEAL', 'COUNTDOWN'].includes(p.latest?.attributes.football11Room.phase),
      ),
    'Room reveal did not synchronize',
    60000,
  );
  await Promise.all(players.map((p) => p.page.locator('.comparison-row').nth(1).waitFor()));
  const results = players.map((p) => {
    const progress = p.latest.attributes.football11Room.progressByUserId;
    const resultByUserId = p.latest.attributes.football11Room.resultByUserId;
    return players.map((who) => ({
      status: progress[who.userId]?.status,
      selected: progress[who.userId]?.selectedCount,
      points: resultByUserId[who.userId]?.points,
      wins: resultByUserId[who.userId]?.wins,
    }));
  });
  checks.matchingResults =
    JSON.stringify(results[0]) === JSON.stringify(results[1]) &&
    results[0].every(
      (r, i) => r.status === 'FINISHED' && r.selected === 11 && r.points === drafts[i].points,
    );
  if (!checks.matchingResults) throw new Error('The two views disagree on the final results');
  await shot('One room - the same results', 'split', async () => {
    for (const player of players)
      await player.page.locator('.room-comparison').scrollIntoViewIfNeeded();
    await pause(1200);
    await a.page.screenshot({ path: join(out, '05-host-reveal.png') });
    await b.page.screenshot({ path: join(out, '06-guest-reveal.png') });
    await pause(5000);
  });
  checks.results = results[0].map((r, i) => ({ player: players[i].name, ...r }));
  checks.pageErrors = errors.length;
  if (errors.length) throw new Error('Browser page errors occurred');
  success = true;
} catch (error) {
  failure = error.message.replace(/[a-f0-9]{24,}/gi, '[redacted]');
  console.error(failure);
  for (const player of players) {
    await player.page.screenshot({ path: join(out, `failure-${player.name}.png`) }).catch(() => {});
    console.error(
      `Player ${player.name}: ${(await player.page.locator('body').innerText()).replace(/[a-f0-9]{24,}/gi, '[redacted]').slice(0, 1800)}`,
    );
  }
} finally {
  // Only leave the capture's own room, using each player's ordinary UI.
  for (const player of [...players].reverse()) {
    try {
      if (await player.page.getByRole('button', { name: 'Leave room', exact: true }).isVisible()) {
        await player.page.getByRole('button', { name: 'Leave room', exact: true }).click();
        await player.page.getByRole('button', { name: 'Play with friends', exact: true }).waitFor();
        checks[`player${player.name}LeftRoom`] = true;
      }
    } catch {
      checks[`player${player.name}LeftRoom`] = false;
    }
    const video = player.page.video();
    await player.context.close();
    await video.saveAs(join(out, `player-${player.name}.webm`));
    await video.delete();
  }
  await browser.close();
  for (const player of players) {
    if (player.syncAt === undefined) continue;
    try {
      const pixels = execFileSync(
        process.env.FFMPEG_PATH || 'ffmpeg',
        [
          '-hide_banner',
          '-loglevel',
          'error',
          '-i',
          join(out, `player-${player.name}.webm`),
          '-vf',
          'fps=25,scale=1:1',
          '-pix_fmt',
          'rgb24',
          '-f',
          'rawvideo',
          'pipe:1',
        ],
        { windowsHide: true, maxBuffer: 1024 * 1024 },
      );
      let frame = -1;
      for (let i = 0; i < pixels.length; i += 3) {
        if (pixels[i] > 230 && pixels[i + 1] < 30 && pixels[i + 2] > 230) {
          frame = i / 3;
          break;
        }
      }
      if (frame < 0) throw new Error('Visual sync marker missing');
      player.videoStart = player.syncAt - frame / 25;
      checks[`player${player.name}VideoCalibrated`] = true;
    } catch {
      success = false;
      failure = 'Video synchronization could not be verified';
      checks[`player${player.name}VideoCalibrated`] = false;
    }
  }
  await writeFile(
    join(out, 'friends-cues.json'),
    JSON.stringify(
      {
        target,
        success,
        failure,
        players: players.map((p) => ({ name: p.name, videoStart: p.videoStart })),
        shots,
        checks,
        network,
        errors,
      },
      null,
      2,
    ),
  );
  console.log(`Capture ${success ? 'verified' : 'incomplete'}: ${out}`);
}
if (!success) process.exitCode = 1;
