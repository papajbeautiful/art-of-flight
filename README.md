```
                                  ·  ·  ── ── ─── ─────────────────────── ─=≡✈

      ▀█▀ █ █ █▀▀     ▄▀█ █▀█ ▀█▀     █▀█ █▀▀
       █  █▀█ ██▄     █▀█ █▀▄  █      █▄█ █▀

      █▀▀  █    █  █▀▀  █ █  ▀█▀
      █▀   █▄▄  █  █▄█  █▀█   █

                                          every plane a brushstroke
```

A real-time flight visualization art installation. Aircraft overhead become
ripples, contrails, radar blips, and accumulating flight-path art — designed
to run 24/7 on a TV or kiosk display.

![status](https://img.shields.io/badge/status-live-success) ![Docker](https://img.shields.io/badge/docker-ready-blue) ![License](https://img.shields.io/badge/license-MIT-green)

## 🎨 Visualization Modes

| Mode | What you see |
|------|--------------|
| 💧 **Ripple** | Aircraft perturb a dark liquid WebGL surface — night water |
| ✈️ **Reality** | Aircraft with livery colors, contrail trails, and info cards |
| 🟩 **Grid** | Neon grid cells light up and fade as aircraft pass |
| 🌊 **Waves** | Horizontal lines distort around aircraft and spring back |
| 🧵 **Tubes** | Glowing 3D tubes trail the aircraft (WebGL) |
| 🗺️ **Map** | Dark vector map (self-hosted tiles) with live aircraft overlay |
| 🌌 **Patterns** | Koblin-style flight-path art that accumulates all day |
| 🛫 **Contrails** | Long-exposure sky: luminous vapor trails on a time-of-day sky |
| 📡 **Radar** | CRT phosphor scope: rotating sweep, decaying blips, range rings |
| 🛬 **Board** | Split-flap departure board of live overhead flights |

## ⚡ Capabilities

- 🌍 **Configurable location** — anywhere in the world (map tiles ship for
  the Sydney region; see *Map tiles* below to re-extract for your area)
- 📡 **Free flight data, no API keys** — adsb.lol → adsb.fi → airplanes.live
  fallback chain with per-source circuit breakers; routes via adsbdb.com
- 🛡️ **Kiosk-grade reliability** — serve-stale-on-error, client backoff, an
  on-brand "listening for aircraft" overlay when data stops, auto-recovery
- 📦 **Zero CDN dependencies** — fonts, WebGL libraries, map renderer, and
  map tiles are all served locally; the display renders with no internet
  beyond the flight APIs themselves
- 🖥️ **4K-crisp** — all canvases render at native device resolution
- 🎛️ **Deep per-mode settings** — tabbed UI, persisted in localStorage
- 🖼️ **30 built-in backgrounds** — CC0/public-domain night skies, auroras,
  nebulae, oceans, antique charts (per-image credits in
  `public/backgrounds/manifest.json`) — selectable per mode, or upload
  your own image
- 🐳 **Docker-ready**

## 🚀 Quick Start

```bash
cd server
npm install
npm start
```

Open **http://localhost:3000**. That's it — no keys, no build step.

### Docker

```bash
docker-compose up -d
```

### Display on a TV

1. Find your computer's IP (`ipconfig` on Windows, `ifconfig` on Mac/Linux —
   look for `192.168.x.x`)
2. On the TV browser: `http://<your-ip>:3000`
3. Press **F** (or F11) for fullscreen

See [TV_SETUP.md](TV_SETUP.md) for kiosk recommendations.

## ⚙️ Configuration

Click **⚙️** (top right). Key settings:

| Setting | Default | Notes |
|---------|---------|-------|
| Location | Sydney Opera House (-33.8568, 151.2153) | Set yours for overhead accuracy |
| Radius | 50 km | quiet hours are real — go 75–100 km for a fuller board |
| Update interval | 2 s | How often to poll the server |
| Max flights | 50 | |
| Per-mode tabs | — | Each mode has its own colors, trails, labels, effects |

Keyboard: **I** info panel · **F** fullscreen · **ESC** close settings.

URL parameters: `?mode=radar` force a mode · `?mock=1` frozen test fixture ·
`?deterministic=1` reproducible rendering (testing).

## 🌐 Flight Data

- **Positions**: [adsb.lol](https://adsb.lol) with automatic fallback to
  [adsb.fi](https://adsb.fi) and [airplanes.live](https://airplanes.live) —
  all free, community-run ADS-B aggregators (readsb-compatible JSON)
- **Routes**: [adsbdb.com](https://www.adsbdb.com) (origin → destination),
  cached server-side (7 days; unknown callsigns retried after 2 h)
- If every source is down, the server serves the last good data flagged
  `stale` and the display shows a quiet signal-lost overlay until recovery

All data is public ADS-B broadcast information. Settings live only in your
browser's localStorage.

## 🗺️ Map tiles (Map mode)

Map mode uses [MapLibre GL](https://maplibre.org) with a self-hosted
[Protomaps](https://protomaps.com) extract (`public/tiles/sydney.pmtiles`,
~12 MB, © OpenStreetMap contributors). To re-center on your region:

```bash
pmtiles extract https://build.protomaps.com/<YYYYMMDD>.pmtiles \
  public/tiles/sydney.pmtiles --bbox=<w>,<s>,<e>,<n> --maxzoom=11
node tools/generate-map-styles.mjs   # regenerate the dark/black/grayscale styles
```

## 🛠️ Development

```
theARTofFLIGHT/
├── server/                    Express API + data services (+ unit tests)
├── public/
│   ├── js/
│   │   ├── app.js             Orchestration, render loop, mode switching
│   │   ├── flightManager.js   Polling, backoff, fade lifecycle
│   │   ├── positionPredictor.js  Smooth dead-reckoning between polls
│   │   ├── coordinateSystem.js   Locked projection
│   │   ├── settings.js        Settings UI + persistence
│   │   └── visualizations/    aircraftVisualization.js (base class) + 10 modes
│   ├── vendor/                Vendored libs (threejs-components, maplibre)
│   ├── fonts/  tiles/  css/
└── tools/                     Screenshot harness, fixtures, style generator
```

See **CLAUDE.md** for architecture details, rendering conventions, and the
invariants that keep the kiosk reliable.

### Adding a visualization mode

1. Extend `AircraftVisualization` (`public/js/visualizations/`) — you get
   aircraft tracking, easing, trails, and label rendering for free; override
   the hooks (`onActiveAircraft`, `isActive`, `latLonToScreen`) for your effect
2. Register it in `app.js` (`visualizations`), add a mode button in
   `index.html`, and a settings schema in `settings.js`
3. Add it to `ALL_MODES` in `tools/screenshot-modes.mjs` and re-baseline

### Verification

```bash
node --test server/test/*.test.js          # server unit tests
node tools/screenshot-modes.mjs tools/screenshots/candidate
node tools/compare-screenshots.mjs tools/screenshots/baseline tools/screenshots/candidate
node tools/test-signal-overlay.mjs         # failure/recovery E2E
```

The committed baseline (`tools/screenshots/baseline/`) is a deterministic
pixel guard across all 10 modes. `--fixture=moving` reviews motion (trails,
easing) by eye; `--offline` proves the no-CDN guarantee.

### API

- `GET /api/flights?lat=&lon=&radius=` →
  `{ success, count, flights[], stale, dataAgeSeconds, source, timestamp }`
- `GET /api/health`

## 🙏 Credits

- Flight data: [adsb.lol](https://adsb.lol), [adsb.fi](https://adsb.fi),
  [airplanes.live](https://airplanes.live), [adsbdb.com](https://www.adsbdb.com)
- Maps: [MapLibre GL](https://maplibre.org), [Protomaps](https://protomaps.com),
  © [OpenStreetMap](https://www.openstreetmap.org/copyright) contributors
- WebGL effects: [threejs-components](https://github.com/klevron/threejs-components)
  by Kevin Levron (Ripple: CC BY-NC-SA 4.0, Tubes: MIT); Grid reveal by
  Gaurav Gajjar (MIT); Line distortion by BL/S® Studio (MIT)
- Patterns mode inspired by Aaron Koblin's *Flight Patterns*

## 📄 License

MIT — effect libraries retain their own licenses (see About tab in settings).

---

**theARTofFLIGHT** — where aviation meets art. Made with ✈️ and ❤️
