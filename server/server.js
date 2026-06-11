require('dotenv').config();

const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const FlightDataService = require('./flightDataService');

const app = express();
const PORT = process.env.PORT || 3000;

// Frozen flight fixtures for deterministic testing:
//   ?mock=1       static fixture (zero velocities) — exact pixel guard
//   ?mock=moving  real velocities — motion review (trails, easing)
const mockFixtures = new Map();
function getMockFixture(kind) {
  const file = kind === 'moving' ? 'flights-moving.json' : 'flights.json';
  if (!mockFixtures.has(file)) {
    mockFixtures.set(file, JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', file), 'utf8')));
  }
  return mockFixtures.get(file);
}

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

// Initialize flight data service
const flightService = new FlightDataService();

// API Routes
app.get('/api/flights', async (req, res) => {
  try {
    // Deterministic fixture for screenshot/regression testing
    if (req.query.mock) {
      const fixture = getMockFixture(req.query.mock);
      return res.json({
        success: true,
        count: fixture.flights.length,
        flights: fixture.flights,
        stale: false,
        dataAgeSeconds: 0,
        source: 'fixture',
        timestamp: Date.now()
      });
    }

    const { lat, lon, radius = 30 } = req.query;

    if (!lat || !lon) {
      return res.status(400).json({
        error: 'Missing required parameters: lat and lon'
      });
    }

    const result = await flightService.getFlightsInRadius(
      parseFloat(lat),
      parseFloat(lon),
      parseFloat(radius)
    );

    res.json({
      success: true,
      count: result.flights.length,
      flights: result.flights,
      stale: result.stale,
      dataAgeSeconds: result.dataAgeSeconds,
      source: result.source,
      timestamp: Date.now()
    });
  } catch (error) {
    console.error('Error fetching flights:', error);
    res.status(500).json({
      error: 'Failed to fetch flight data',
      message: error.message
    });
  }
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: Date.now(),
    service: 'theARTofFLIGHT'
  });
});

// ── Geocoding (Scene → "find address") ──────────────────────
// Proxies Nominatim so the browser never talks to a third party and the
// polite User-Agent contract is honoured server-side. User-initiated only.
const geocodeFetch = require('node-fetch');
const crypto = require('crypto');
const os = require('os');

// Wikimedia/Nominatim robot policy: descriptive UA with a contact
const UA = 'theARTofFLIGHT/2.0 (https://github.com/papajbeautiful/art-of-flight; kiosk art installation) node-fetch/2';
app.get('/api/geocode', async (req, res) => {
  const q = (req.query.q || '').toString().trim();
  if (!q) return res.status(400).json({ error: 'Missing query parameter: q' });
  try {
    const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&q=${encodeURIComponent(q)}`;
    const response = await geocodeFetch(url, {
      headers: { 'User-Agent': 'theARTofFLIGHT/2.0 (kiosk geocoder; github.com/papajbeautiful/art-of-flight)' },
      timeout: 8000
    });
    if (!response.ok) throw new Error(`Nominatim HTTP ${response.status}`);
    const data = await response.json();
    res.json({
      success: true,
      results: (Array.isArray(data) ? data : []).map(r => ({
        name: r.display_name,
        lat: parseFloat(r.lat),
        lon: parseFloat(r.lon)
      }))
    });
  } catch (error) {
    console.error('Geocode failed:', error.message);
    res.status(502).json({ error: 'Geocoding failed', message: error.message });
  }
});

// ── Background image search (Look → Background) ─────────────
// Live search over all of Wikimedia Commons (the curated gallery's source,
// but the whole repository instead of 30 picks). No API key; generous
// limits; user-initiated only. Licence + artist metadata travel with each
// result and surface in the tile tooltip. (Openverse was tried first but
// its anonymous rate limit is too tight for interactive search.)
app.get('/api/backgrounds/search', async (req, res) => {
  const q = (req.query.q || '').toString().trim();
  if (!q) return res.status(400).json({ error: 'Missing query parameter: q' });
  try {
    // iiurlwidth=2560 → MediaWiki renders a display-sized thumb (≈0.5-2MB);
    // originals from ESO/NASA can exceed 100MB and Wikimedia rate-limits
    // heavy original fetches. The 480px tile thumb is derived from the same
    // rendition path.
    const url = 'https://commons.wikimedia.org/w/api.php?' + new URLSearchParams({
      action: 'query',
      format: 'json',
      generator: 'search',
      gsrsearch: `filetype:bitmap ${q}`,
      gsrnamespace: '6',
      gsrlimit: '24',
      prop: 'imageinfo',
      iiprop: 'url|size|extmetadata',
      iiurlwidth: '2560'
    });
    const response = await geocodeFetch(url, {
      headers: { 'User-Agent': UA },
      timeout: 12000
    });
    if (!response.ok) throw new Error(`Commons HTTP ${response.status}`);
    const data = await response.json();
    const pages = Object.values((data.query || {}).pages || {});
    const stripTags = (s) => (s || '').replace(/<[^>]+>/g, '').trim();
    const results = pages
      .sort((a, b) => (a.index || 0) - (b.index || 0)) // search relevance
      .map(p => {
        const ii = (p.imageinfo || [])[0] || {};
        const em = ii.extmetadata || {};
        // Commons rounds iiurlwidth up to its thumbnail buckets (2560 →
        // 3840px) — derive the tile thumb from whatever bucket came back
        const display = ii.thumburl || ii.url;
        const thumb = display && /\/\d+px-/.test(display)
          ? display.replace(/\/\d+px-/, '/480px-')
          : display;
        return {
          title: (p.title || '').replace(/^File:/, '').replace(/\.[a-z]+$/i, ''),
          artist: stripTags((em.Artist || {}).value) || 'Unknown',
          license: (em.LicenseShortName || {}).value || 'See source',
          thumb,
          full: display,
          width: ii.width || 0
        };
      })
      .filter(r => r.full && r.width >= 1400)
      .map(({ width, ...r }) => r);
    res.json({ success: true, results });
  } catch (error) {
    console.error('Background search failed:', error.message);
    res.status(502).json({ error: 'Background search failed', message: error.message });
  }
});

// Same-origin image proxy: keeps remote backgrounds CORS-clean for canvas
// and WebGL texture use (the ripple liquid needs same-origin pixels).
// Successful fetches are cached on disk so a chosen background hits the
// upstream exactly once — Wikimedia 429s repeat fetchers, and a kiosk
// reloads daily.
const BG_CACHE_DIR = path.join(os.tmpdir(), 'aof-bgcache');
fs.mkdirSync(BG_CACHE_DIR, { recursive: true });

app.get('/api/backgrounds/fetch', async (req, res) => {
  const raw = (req.query.url || '').toString();
  let target;
  try {
    target = new URL(raw);
  } catch {
    return res.status(400).json({ error: 'Invalid url' });
  }
  // Basic egress hygiene: https only, no IP literals / internal hostnames
  const host = target.hostname.toLowerCase();
  const looksInternal = /^(localhost|.*\.local|.*\.internal|.*\.lan)$/.test(host) ||
    /^\d{1,3}(\.\d{1,3}){3}$/.test(host) || host.includes(':');
  if (target.protocol !== 'https:' || looksInternal) {
    return res.status(400).json({ error: 'Refusing to proxy this url' });
  }

  const key = crypto.createHash('sha1').update(target.href).digest('hex');
  const binPath = path.join(BG_CACHE_DIR, `${key}.bin`);
  const metaPath = path.join(BG_CACHE_DIR, `${key}.meta`);

  try {
    if (fs.existsSync(binPath) && fs.existsSync(metaPath)) {
      res.set('Content-Type', fs.readFileSync(metaPath, 'utf8'));
      res.set('Cache-Control', 'public, max-age=604800, immutable');
      return fs.createReadStream(binPath).pipe(res);
    }

    const response = await geocodeFetch(target.href, {
      headers: { 'User-Agent': UA },
      timeout: 25000,
      size: 40 * 1024 * 1024
    });
    const type = response.headers.get('content-type') || '';
    if (!response.ok || !type.startsWith('image/')) {
      return res.status(502).json({ error: `Upstream returned ${response.status} ${type}` });
    }
    // Buffer fully so the disk cache never stores a truncated stream
    const buf = await response.buffer();
    fs.writeFileSync(binPath, buf);
    fs.writeFileSync(metaPath, type);
    res.set('Content-Type', type);
    res.set('Cache-Control', 'public, max-age=604800, immutable');
    res.send(buf);
  } catch (error) {
    console.error('Background fetch failed:', error.message);
    res.status(502).json({ error: 'Background fetch failed', message: error.message });
  }
});

// Serve the main app
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🎨 theARTofFLIGHT server running on port ${PORT}`);
  console.log(`📡 Access the visualization at http://localhost:${PORT}`);
});
