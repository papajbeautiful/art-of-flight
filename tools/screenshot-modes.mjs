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

const ALL_MODES = ['ripple', 'reality', 'birds', 'constellation', 'tubes', 'patterns'];
const MODES = modesArg ? modesArg.split('=')[1].split(',') : ALL_MODES;
const PORT = portArg ? parseInt(portArg.split('=')[1], 10) : 3177;
const SETTLE_MS = 6000; // > 3s idle-fade + 0.8s chrome fade + fade-in/easing convergence

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
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    'C:/Program Files/Microsoft/Edge/Application/msedge.exe'
  ];
  const found = candidates.find(p => fs.existsSync(p));
  if (!found) throw new Error('No Chrome/Edge found for screenshots');
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

    await page.goto(`http://localhost:${PORT}/?mock=1&deterministic=1&mode=${mode}`, { waitUntil: 'load' });
    await page.waitForTimeout(SETTLE_MS);

    const file = path.join(outDir, `${mode}.png`);
    await page.screenshot({ path: file });
    const errNote = errors.length ? `  [${errors.length} console error(s): ${errors[0].slice(0, 120)}]` : '';
    console.log(`captured ${mode}.png${errNote}`);
    await page.close();
  }

  await browser.close();
  console.log(`\nDone -> ${outDir}`);
} finally {
  server.kill();
}
