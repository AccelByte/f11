import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve, join, dirname } from 'node:path';
import { spawn } from 'node:child_process';
import { performance } from 'node:perf_hooks';

// Use a local Playwright installation or the desktop's bundled package directory.
const require = createRequire(import.meta.url);
const webRequire = createRequire(new URL('../../apps/web/package.json', import.meta.url));
const { chromium } = require(process.env.DEMO_PLAYWRIGHT_PATH || 'playwright');
const out = resolve(
  process.env.DEMO_OUTPUT || 'artifacts/demo',
  new Date().toISOString().replace(/[:.]/g, '-'),
);
await mkdir(out, { recursive: true });
const seed = process.env.DEMO_SEED || 'football11-demo-v1';
const server = spawn(
  process.execPath,
  [
    join(dirname(webRequire.resolve('vite/package.json')), 'bin/vite.js'),
    '--config',
    'tools/demo/vite.config.mjs',
  ],
  { stdio: 'pipe', windowsHide: true },
);
let serverLog = '';
server.stderr.on('data', (data) => {
  serverLog += data;
});
server.stdout.on('data', (data) => {
  serverLog += data;
});
let browser;
const cues = [];
const errors = [];
const externalRequests = [];
const pause = (ms) => new Promise((done) => setTimeout(done, ms));
try {
  let ready = false;
  for (let attempt = 0; attempt < 80; attempt++) {
    if (server.exitCode !== null) throw new Error(`Preview exited: ${serverLog}`);
    try {
      ready = (await fetch('http://127.0.0.1:4187')).ok;
    } catch {}
    if (ready) break;
    await pause(250);
  }
  if (!ready) throw new Error(`Preview did not start: ${serverLog}`);
  browser = await chromium.launch({
    headless: !process.argv.includes('--headed'),
    ...(process.env.DEMO_BROWSER_PATH ? { executablePath: process.env.DEMO_BROWSER_PATH } : {}),
  });
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    deviceScaleFactor: 1,
    recordVideo: { dir: out, size: { width: 1920, height: 1080 } },
  });
  await context.route('**/*', (route) => {
    if (new URL(route.request().url()).origin === 'http://127.0.0.1:4187') return route.continue();
    externalRequests.push(route.request().url());
    return route.abort();
  });
  const page = await context.newPage();
  const start = performance.now();
  const mark = (name, extra = {}) =>
    cues.push({ name, seconds: (performance.now() - start) / 1000, ...extra });
  page.on('pageerror', (error) => {
    errors.push(error.message);
    console.error(error.message);
  });
  await page.goto(`http://127.0.0.1:4187/?seed=${encodeURIComponent(seed)}`);
  await page
    .locator('.offer-entry')
    .first()
    .waitFor({ timeout: 30000 })
    .catch(async (error) => {
      await page.screenshot({ path: join(out, 'failure.png') });
      console.error((await page.locator('body').innerText()).slice(0, 3000), serverLog);
      throw error;
    });
  // A visible presentation cursor, since browser video does not capture the OS pointer.
  await page.evaluate(() => {
    const cursor = document.createElement('div');
    cursor.id = 'demo-cursor';
    cursor.style.cssText =
      'position:fixed;left:0;top:0;width:20px;height:20px;border:2px solid white;border-radius:50%;background:#b8f35a88;box-shadow:0 0 0 5px #b8f35a22;z-index:9999;pointer-events:none;transform:translate(-50%,-50%)';
    document.body.append(cursor);
    document.addEventListener('mousemove', (e) => {
      cursor.style.left = `${e.clientX}px`;
      cursor.style.top = `${e.clientY}px`;
    });
  });
  async function point(locator) {
    await locator.scrollIntoViewIfNeeded();
    const box = await locator.boundingBox();
    if (!box) throw new Error('Missing target bounds');
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 24 });
    return box;
  }
  mark('opening');
  await page.screenshot({ path: join(out, '01-draft.png') });
  await pause(2200);
  for (let pick = 0; pick < 11; pick++) {
    const card = page.locator('.offer-card, .offer-entry').first();
    const box = await point(card);
    if (pick === 0) mark('selection-focus', { box });
    await pause(pick === 0 ? 1800 : 450);
    await card.click();
    const slot = page.getByRole('button', { name: /^Place selected player at / }).first();
    await slot.waitFor();
    if (pick === 0) {
      await page.screenshot({ path: join(out, '02-player-selected.png') });
      await pause(1800);
      mark('placement');
    }
    await point(slot);
    await pause(pick === 0 ? 1000 : 350);
    await slot.click();
    await page.waitForFunction(
      (count) =>
        JSON.parse(document.querySelector('#demo-evidence').textContent).actions.length === count,
      pick + 1,
    );
    mark(`pick-${pick + 1}`);
    if (pick === 0) {
      await pause(1600);
      mark('draft-montage');
    } else await pause(500);
  }
  await page.getByRole('heading', { name: 'Your Football 11', exact: true }).waitFor();
  await page.locator('.result-grid').scrollIntoViewIfNeeded();
  await pause(500);
  mark('lineup');
  await page.screenshot({ path: join(out, '03-lineup.png') });
  await pause(5500);
  mark('end');
  const evidence = JSON.parse(await page.locator('#demo-evidence').textContent());
  if (
    evidence.actions.length !== 11 ||
    evidence.result?.roster.length !== 11 ||
    (await page.locator('.formation-slot.is-filled').count()) !== 11
  )
    throw new Error('Incomplete XI');
  if (errors.length || externalRequests.length)
    throw new Error(`Capture errors: ${JSON.stringify({ errors, externalRequests })}`);
  const video = page.video();
  await context.close();
  await video.saveAs(join(out, 'raw.webm'));
  await video.delete();
  await writeFile(
    join(out, 'cues.json'),
    JSON.stringify(
      { seed, width: 1920, height: 1080, cues, evidence, errors, externalRequests },
      null,
      2,
    ),
  );
  console.log(`Capture verified: 11 legal placements, complete XI, no external requests.\n${out}`);
} finally {
  if (browser) await browser.close();
  server.kill();
}
