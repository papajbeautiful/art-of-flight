/**
 * Deterministic screenshot harness for theARTofFLIGHT.
 *
 * Starts the server, loads each visualization mode with the frozen flight
 * fixture (?mock=1&deterministic=1&mode=X), waits for everything to settle,
 * and captures one PNG per mode at TV resolution (1920x1080 @ 2x DPR).
 *
 * Usage:
 *   node tools/screenshot-modes.mjs [outDir] [--modes=a,b,c] [--port=3177]
 *
 * Notes:
 *   - Do NOT freeze the clock: aircraft fade-in is wall-clock driven and a
 *     frozen Date.now() renders everything at opacity 0. The fixture instead
 *     has zero velocities, so aircraft hold still after the ~3s settle.
 *   - 'map' is excluded by default (renders empty without a maps backend).
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');

const args = process.argv.slice(2);
const outDir = path.resolve(args.find(a => !a.startsWith('--')) || path.join(__dirname, 'screenshots', 'latest'));
const modesArg = args.find(a => a.startsWith('--modes='));
const portArg = args.find(a => a.startsWith('--port='));
const OFFLINE = args.includes('--offline'); // abort all non-localhost requests — proves the kiosk renders with zero CDN/network dependencies
const fixtureArg = args.find(a => a.startsWith('--fixture='));
const FIXTURE = fixtureArg ? fixtureArg.split('=')[1] : '1'; // '1' static (pixel guard) | 'moving' (motion review)
const settleArg = args.find(a => a.startsWith('--settle='));

const ALL_MODES = ['aurora', 'ink', 'patterns', 'contrails', 'ripple', 'constellation', 'radar', 'reality', 'map', 'departures'];
const MODES = modesArg ? modesArg.split('=')[1].split(',') : ALL_MODES;
const PORT = portArg ? parseInt(portArg.split('=')[1], 10) : 3177;
// > 3s idle-fade + 0.8s chrome fade + fade-in/easing convergence; the moving
// fixture defaults longer so trails have time to form
const SETTLE_MS = settleArg ? parseInt(settleArg.split('=')[1], 10) : (FIXTURE === 'moving' ? 12000 : 6000);

fs.mkdirSync(outDir, { recursive: true });

// ── Start server ──
const server = spawn(process.execPath, ['server.js'], {
  cwd: path.join(ROOT, 'server'),
  env: { ...process.env, PORT: String(PORT) },
  stdio: 'pipe'
});
const serverReady = new Promise((resolve, reject) => {
  const onData = (d) => { if (String(d).includes('running on port')) resolve(); };
  server.stdout.on('data', onData);
  server.on('error', reject);
  server.on('exit', (code) => reject(new Error(`server exited early (code ${code})`)));
  setTimeout(() => reject(new Error('server start timeout')), 15000);
});

function findBrowser() {
  const candidates = [
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/usr/bin/google-chrome',
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    'C:/Program Files/Microsoft/Edge/Application/msedge.exe'
  ];
  const found = candidates.find(p => fs.existsSync(p));
  if (!found) throw new Error('No Chrome/Edge/Chromium found for screenshots');
  return found;
}

try {
  await serverReady;
  console.log(`server up on :${PORT}`);

  const browser = await chromium.launch({ executablePath: findBrowser(), headless: true });
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    deviceScaleFactor: 2 // 4K-TV-equivalent backing resolution
  });

  for (const mode of MODES) {
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });

    if (OFFLINE) {
      await page.route(/^(?!.*localhost).*$/, (route) => route.abort());
    }

    await page.goto(`http://localhost:${PORT}/?mock=${FIXTURE}&deterministic=1&mode=${mode}`, { waitUntil: 'load' });
    await page.waitForTimeout(SETTLE_MS);

    // Screenshot FIRST — the WebGL modes animate on wall-clock, so the
    // capture must happen at a consistent time after load
    const file = path.join(outDir, `${mode}.png`);
    await page.screenshot({ path: file });

    // Frame-rate probe (after capture): a beauty change that tanks framerate
    // on a 24/7 TV must not ship invisibly
    const fps = await page.evaluate(() => new Promise((resolve) => {
      let frames = 0;
      const t0 = performance.now();
      const tick = () => {
        frames++;
        const elapsed = performance.now() - t0;
        if (elapsed < 2000) requestAnimationFrame(tick);
        else resolve(Math.round(frames / (elapsed / 1000)));
      };
      requestAnimationFrame(tick);
    }));
    const errNote = errors.length ? `  [${errors.length} console error(s): ${errors[0].slice(0, 120)}]` : '';
    console.log(`captured ${mode}.png  (${fps} fps)${errNote}`);
    await page.close();
  }

  await browser.close();
  console.log(`\nDone -> ${outDir}`);
} finally {
  server.kill();
}
