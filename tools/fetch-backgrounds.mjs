/**
 * Curate the built-in background library from Wikimedia Commons.
 *
 * One-time tooling (like the pmtiles extraction) — the app itself never
 * touches the network for backgrounds; images are vendored into
 * public/backgrounds/ and served by our own Express server.
 *
 * Only CC0 / public-domain images are accepted so the public repo can
 * redistribute them. Every image's title/author/license/source URL is
 * recorded in public/backgrounds/manifest.json, which also drives the
 * settings-panel gallery.
 *
 * Run: node tools/fetch-backgrounds.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, '..', 'public', 'backgrounds');
const THUMBS = path.join(OUT, 'thumbs');
fs.mkdirSync(THUMBS, { recursive: true });

const UA = 'theARTofFLIGHT/1.0 (https://github.com/papajbeautiful/art-of-flight; background curation script)';
const API = 'https://commons.wikimedia.org/w/api.php';

// theme slug -> [search terms, how many to keep]
// Themes are chosen to flatter the visualization modes: water for Ripple,
// night skies for Reality/Waves, space for Tubes/Grid, paper/charts for
// Patterns' Koblin-style accumulation, skies for Contrails-adjacent looks.
const THEMES = [
  ['night-sky', 'milky way night sky stars landscape photograph', 4],
  ['aurora', 'aurora borealis night sky photograph', 4],
  ['nebula', 'nebula hubble space telescope', 4],
  ['earth-night', 'earth at night from international space station', 3],
  ['clouds', 'clouds seen from ISS NASA photograph', 3],
  ['dusk', 'dramatic sunset sky clouds photograph', 3],
  ['ocean', 'dark ocean water surface photograph', 3],
  ['moon', 'full moon photograph night', 2],
  ['storm', 'lightning storm night photograph', 2],
  ['city-night', 'city aerial view night lights photograph', 3],
  ['chart', 'antique nautical chart ocean', 2],
  ['paper', 'marbled paper endpaper book', 2]
];

const OK_LICENSE = /^(cc0|public domain|pd[\s-]|no restrictions)/i;
const stripHtml = (s) => (s || '').replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
const slugify = (s) => s.toLowerCase().replace(/\.[a-z]+$/, '').replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '').slice(0, 48).replace(/-+$/, '');

async function commonsSearch(terms) {
  const params = new URLSearchParams({
    action: 'query', format: 'json', generator: 'search',
    gsrsearch: `${terms} filetype:bitmap filew:>1919 fileh:>1079`,
    gsrnamespace: '6', gsrlimit: '40',
    prop: 'imageinfo', iiprop: 'url|size|mime|extmetadata', iiurlwidth: '1920'
  });
  const res = await fetch(`${API}?${params}`, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`Commons API ${res.status} for "${terms}"`);
  const json = await res.json();
  return Object.values(json.query?.pages || {});
}

async function download(url, file, attempt = 1) {
  const res = await fetch(url, { headers: { 'User-Agent': UA } });
  if (res.status === 429 && attempt <= 3) {            // thumbor rate limit
    await new Promise(r => setTimeout(r, 2000 * attempt));
    return download(url, file, attempt + 1);
  }
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  fs.writeFileSync(file, Buffer.from(await res.arrayBuffer()));
  return fs.statSync(file).size;
}

// Idempotent: start from a clean slate so failed runs leave no orphans
for (const dir of [OUT, THUMBS]) {
  for (const f of fs.readdirSync(dir)) {
    if (/\.(jpe?g|png)$/i.test(f)) fs.unlinkSync(path.join(dir, f));
  }
}

const manifest = [];
const seenPages = new Set();
let totalBytes = 0;

for (const [theme, terms, keep] of THEMES) {
  const pages = await commonsSearch(terms);
  let kept = 0;

  for (const page of pages) {
    if (kept >= keep) break;
    if (seenPages.has(page.pageid)) continue;
    const info = page.imageinfo?.[0];
    if (!info) continue;

    const meta = info.extmetadata || {};
    const license = stripHtml(meta.LicenseShortName?.value);
    if (!OK_LICENSE.test(license)) continue;
    if (!/^image\/(jpeg|png)$/.test(info.mime)) continue;
    const ratio = info.width / info.height;
    if (ratio < 1.2 || ratio > 2.6) continue;           // landscape, TV-friendly
    if (!info.thumburl) continue;

    const title = page.title.replace(/^File:/, '');
    const id = `${theme}-${slugify(title)}`;
    if (manifest.some(m => m.id === id)) continue;       // slug collision (e.g. numbered series)
    const file = `${id}.${info.mime === 'image/png' ? 'png' : 'jpg'}`;
    try {
      const bytes = await download(info.thumburl, path.join(OUT, file));
      // Thumbor only renders bucketed widths (250/330/500/960/1920...)
      const thumbUrl = info.thumburl.replace(/\/1920px-/, '/330px-');
      try {
        await download(thumbUrl, path.join(THUMBS, file));
      } catch (e) {
        fs.unlinkSync(path.join(OUT, file));            // no orphans
        throw e;
      }
      totalBytes += bytes;
      kept++;
      seenPages.add(page.pageid);
      manifest.push({
        id, file: `/backgrounds/${file}`, thumb: `/backgrounds/thumbs/${file}`,
        theme, title,
        artist: stripHtml(meta.Artist?.value) || 'Unknown',
        license,
        source: info.descriptionurl
      });
      console.log(`  ✓ [${theme}] ${title}  (${license}, ${(bytes / 1024).toFixed(0)}KB)`);
    } catch (e) {
      console.log(`  ✗ [${theme}] ${title}: ${e.message}`);
    }
    await new Promise(r => setTimeout(r, 600));          // be polite to Commons
  }
  console.log(`${theme}: kept ${kept}/${keep}`);
}

manifest.sort((a, b) => a.id.localeCompare(b.id));
fs.writeFileSync(path.join(OUT, 'manifest.json'), JSON.stringify(manifest, null, 2));
console.log(`\n${manifest.length} backgrounds, ${(totalBytes / 1024 / 1024).toFixed(1)}MB -> ${OUT}`);
