/**
 * E2E test: runtime mode switching via the keyboard (digit shortcuts).
 *
 * Screenshot baselines load each mode fresh (?mode=X) — they never exercise
 * clear(), layer show/hide, WebGL teardown, or the 1s crossfade where two
 * modes update+draw simultaneously. This sweep presses each mode's digit
 * key (the only mode switcher outside the settings panel) through every
 * mode (twice, including the nasty transitions) and fails on any page
 * error or console error.
 *
 * It also asserts layer teardown after every transition: a layer div that
 * fails to hide on switch-away throws nothing and self-heals never — on a
 * 24/7 kiosk it would sit on top of every subsequent mode. We read computed
 * display on all layer containers and require exactly the active
 * mode's layer (if any) to be visible.
 *
 * Run: node tools/test-mode-switching.mjs
 */
import { spawn } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const PORT = 3196;

// Digit-key order — must match MODE_ORDER in public/js/settings.js
const MODE_ORDER = ['aurora', 'ink', 'patterns', 'contrails', 'ripple',
  'constellation', 'radar', 'reality', 'map', 'departures'];

// Two full cycles plus deliberately nasty transitions:
// accum->accum (aurora->ink), opaque-canvas->opaque-canvas
// (contrails->radar), DOM->WebGL (departures->ripple), map round-trips.
const SEQUENCE = [
  'reality', 'aurora', 'ink', 'constellation', 'map', 'patterns',
  'contrails', 'radar', 'departures', 'ripple',
  'aurora', 'contrails', 'radar', 'departures', 'ripple',
  'map', 'reality', 'patterns', 'ink', 'constellation', 'ripple'
];

// Display-toggled layer containers and the one mode each belongs to.
// Modes not listed here (reality/patterns/contrails/radar/aurora/ink) draw
// on the shared #canvas — for those, ALL layer divs must be hidden.
const LAYER_OWNERS = {
  rippleLayer: 'ripple',
  waveLayer: 'constellation',
  mapContainer: 'map',
  departuresLayer: 'departures'
};

function findBrowser() {
  const candidates = [
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/usr/bin/google-chrome',
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'
  ];
  return candidates.find(p => fs.existsSync(p));
}

const server = spawn(process.execPath, ['server.js'], {
  cwd: path.join(ROOT, 'server'),
  env: { ...process.env, PORT: String(PORT) },
  stdio: 'pipe'
});
await new Promise((resolve, reject) => {
  server.stdout.on('data', (d) => { if (String(d).includes('running on port')) resolve(); });
  server.on('error', reject);
  setTimeout(() => reject(new Error('server start timeout')), 10000);
});

const browser = await chromium.launch({ executablePath: findBrowser(), headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });

const problems = [];
page.on('pageerror', (e) => problems.push(`pageerror: ${String(e).slice(0, 200)}`));
page.on('console', (msg) => {
  if (msg.type() === 'error') problems.push(`console: ${msg.text().slice(0, 200)}`);
});

let failures = 0;
try {
  await page.goto(`http://localhost:${PORT}/?mock=1&deterministic=1&mode=ripple`, { waitUntil: 'load' });
  await page.waitForTimeout(3000);

  for (const mode of SEQUENCE) {
    const before = problems.length;
    const digit = String((MODE_ORDER.indexOf(mode) + 1) % 10);
    await page.keyboard.press(digit);
    await page.waitForTimeout(1600); // 1s crossfade + clear() of previous mode

    // Layer teardown: exactly the active mode's layer (if any) may be visible
    const visibleLayers = await page.evaluate((ids) => ids.filter((id) => {
      const el = document.getElementById(id);
      return el && getComputedStyle(el).display !== 'none';
    }), Object.keys(LAYER_OWNERS));
    const expected = Object.keys(LAYER_OWNERS).filter((id) => LAYER_OWNERS[id] === mode);
    const layersOk = visibleLayers.length === expected.length &&
      expected.every((id) => visibleLayers.includes(id));
    if (!layersOk) {
      problems.push(`layers: expected [${expected}] visible, got [${visibleLayers}]`);
    }

    const ok = problems.length === before;
    console.log(`${ok ? 'PASS' : 'FAIL'}  -> ${mode}${ok ? '' : `  (${problems.slice(before).join(' | ')})`}`);
    if (!ok) failures++;
  }

  // Sanity: app still alive and rendering after the whole sweep
  const alive = await page.evaluate(() =>
    !!window.theArtOfFlight && window.theArtOfFlight.isRunning &&
    window.theArtOfFlight.currentMode === 'ripple');
  console.log(`${alive ? 'PASS' : 'FAIL'}  app alive and in expected mode after sweep`);
  if (!alive) failures++;
} finally {
  await browser.close();
  server.kill();
}

console.log(failures ? `\n${failures} FAILURES` : '\nAll mode transitions clean');
process.exit(failures ? 1 : 0);
