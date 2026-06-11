/**
 * Compare two screenshot directories pixel-by-pixel (pixelmatch).
 *
 * Usage: node tools/compare-screenshots.mjs <baselineDir> <candidateDir> [--threshold=0.1]
 *
 * Writes diff PNGs next to the candidate as <mode>.diff.png when mismatched.
 * Exit code 1 if any mode differs beyond tolerance.
 */
import fs from 'node:fs';
import path from 'node:path';
import { PNG } from 'pngjs';
import pixelmatch from 'pixelmatch';

const [baseDir, candDir] = process.argv.slice(2).filter(a => !a.startsWith('--'));
const thresholdArg = process.argv.find(a => a.startsWith('--threshold='));
const THRESHOLD = thresholdArg ? parseFloat(thresholdArg.split('=')[1]) : 0.1;

// Allowed mismatch (% of pixels) per mode. Ripple (WebGL) animates on the
// library's internal clock and can't be seeded — its ambient motion produces
// small frame-to-frame diffs even with identical input. Constellation's
// damped springs settle on a load-dependent timeline, so antialiased line
// edges shift between busy and quiet runs (measured 0.015-0.054% on the Pi).
// Everything else must be pixel-exact.
const ALLOWED_PCT = { 'ripple.png': 2.5, 'constellation.png': 0.15 };

if (!baseDir || !candDir) {
  console.error('Usage: node tools/compare-screenshots.mjs <baselineDir> <candidateDir>');
  process.exit(2);
}

const baselines = fs.readdirSync(baseDir).filter(f => f.endsWith('.png') && !f.includes('.diff.'));
let failures = 0;

for (const file of baselines) {
  const candPath = path.join(candDir, file);
  if (!fs.existsSync(candPath)) {
    console.log(`MISSING  ${file} (no candidate)`);
    failures++;
    continue;
  }

  const a = PNG.sync.read(fs.readFileSync(path.join(baseDir, file)));
  const b = PNG.sync.read(fs.readFileSync(candPath));

  if (a.width !== b.width || a.height !== b.height) {
    console.log(`SIZE     ${file} (${a.width}x${a.height} vs ${b.width}x${b.height})`);
    failures++;
    continue;
  }

  const diff = new PNG({ width: a.width, height: a.height });
  const mismatched = pixelmatch(a.data, b.data, diff.data, a.width, a.height, { threshold: THRESHOLD });
  const pct = (mismatched / (a.width * a.height)) * 100;
  const allowed = ALLOWED_PCT[file] ?? 0;

  if (pct <= allowed) {
    console.log(`OK       ${file}${mismatched ? `  (${pct.toFixed(3)}% within ${allowed}% tolerance)` : ''}`);
  } else {
    const diffPath = path.join(candDir, file.replace('.png', '.diff.png'));
    fs.writeFileSync(diffPath, PNG.sync.write(diff));
    console.log(`DIFF     ${file}  ${mismatched}px (${pct.toFixed(3)}%, allowed ${allowed}%) -> ${path.basename(diffPath)}`);
    failures++;
  }
}

process.exit(failures > 0 ? 1 : 0);
