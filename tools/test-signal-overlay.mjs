/**
 * E2E test: the signal-lost overlay appears when the server dies and
 * auto-dismisses when it recovers.
 *
 * Run: node tools/test-signal-overlay.mjs
 */
import { spawn } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const PORT = 3178;

function startServer() {
  const srv = spawn(process.execPath, ['server.js'], {
    cwd: path.join(ROOT, 'server'),
    env: { ...process.env, PORT: String(PORT) },
    stdio: 'pipe'
  });
  return new Promise((resolve, reject) => {
    srv.stdout.on('data', (d) => { if (String(d).includes('running on port')) resolve(srv); });
    srv.on('error', reject);
    setTimeout(() => reject(new Error('server start timeout')), 10000);
  });
}

function findBrowser() {
  const candidates = [
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'
  ];
  return candidates.find(p => fs.existsSync(p));
}

let failures = 0;
const check = (name, cond) => {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}`);
  if (!cond) failures++;
};

let server = await startServer();
const browser = await chromium.launch({ executablePath: findBrowser(), headless: true });
const page = await browser.newPage();

const overlayVisible = () => page.evaluate(() => {
  const el = document.getElementById('signalOverlay');
  return el ? !el.classList.contains('hidden') : false;
});
const overlayDetail = () => page.evaluate(() => {
  const el = document.getElementById('signalDetail');
  return el ? el.textContent : '';
});

try {
  await page.goto(`http://localhost:${PORT}/?mock=1&deterministic=1&mode=reality`, { waitUntil: 'load' });
  await page.waitForTimeout(4000);
  check('overlay hidden while healthy', !(await overlayVisible()));

  // Kill the server: polls (2s interval) start failing; 2 consecutive
  // failures plus backoff should surface the overlay within ~15s
  server.kill();
  await page.waitForTimeout(15000);
  check('overlay shown after server death', await overlayVisible());
  const detail = await overlayDetail();
  check(`overlay detail mentions last signal ("${detail}")`, /last signal .* ago/.test(detail));

  // Recovery: backoff caps at ~16s here, so allow time for the next poll
  server = await startServer();
  await page.waitForTimeout(20000);
  check('overlay auto-dismissed after recovery', !(await overlayVisible()));
} finally {
  await browser.close();
  server.kill();
}

process.exit(failures ? 1 : 0);
