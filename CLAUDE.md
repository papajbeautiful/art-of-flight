# theARTofFLIGHT

Real-time flight visualization art installation. Express server proxies free
ADS-B data; a vanilla-JS canvas frontend renders aircraft near a configured
home location in multiple art modes. Designed to run 24/7 on a TV/kiosk —
**reliability and offline-resilience outrank features**.

## Running

```bash
cd server && npm install && npm start    # http://localhost:3000
```

No API keys. No build step. The frontend is plain script tags (load order
matters — see index.html; `aircraftVisualization.js` must precede the modes).

URL parameters (testing/kiosk):
- `?mode=<name>` — force a visualization mode for the session
- `?mock=1` — serve the frozen zero-velocity fixture (pixel-exact testing)
- `?mock=moving` — fixture with real velocities (motion/trail review)
- `?deterministic=1` — seeded Math.random, default settings, fixed palettes

Keys: `S` settings panel, `I` info panel, `F` fullscreen, `1-9,0` direct
mode select, `←/→` cycle modes, `Esc` closes settings. No chrome renders on
load — a hint pill appears on mouse movement; `?chrome=0` kills all chrome.

## Architecture

```
server/
  server.js             Express: /api/flights, /api/health, static, fixtures
  flightDataService.js  Source chain adsb.lol→adsb.fi→airplanes.live with
                        per-source circuit breaker; serve-stale-on-error;
                        route enrichment via adsbdb.com (throttled queue,
                        LRU cache: 7d positive / 2h negative TTL)
  airports.js           ICAO→city fallback lookup
public/js/
  app.js                Orchestration: rAF loop, mode transitions, DPR canvas,
                        signal-lost overlay, home marker
  flightManager.js      Polling w/ timeout+backoff, fade lifecycle, exposes
                        getConnectionState() for the overlay
  positionPredictor.js  Dead-reckoning between polls (smooth 60fps motion)
  coordinateSystem.js   Locked equirectangular projection (CSS-pixel space)
  aircraftIcons.js      Shared icon drawing (cached glow gradients)
  settings.js           Settings v2: Scene/Look/Mode panel, MODE_META +
                        MODE_ALIASES (waves→constellation, board→departures,
                        grid/birds→aurora, tubes→ripple), v1 migration,
                        debounced autosave. Mode schemas = mode-own knobs ONLY.
  palettes.js           Six curated palettes + custom; semantic slots
                        (ui/primary/secondary/inbound/outbound/ramp/glow)
  visualizations/
    aircraftVisualization.js  BASE CLASS — read this first. Owns aircraft
                              tracking/easing/trails/pruning + trail/icon/
                              label rendering. Subclass hooks: isActive(),
                              onActiveAircraft(), onOptionsChanged(),
                              latLonToScreen().
    ripple.js     WebGL liquid (vendored threejs-components) + dark-water texture
    reality.js    Pure base-class defaults (the reference mode)
    aurora.js     Flow-ribbon curtains (default mode)
    ink.js        Sumi-e brushwork on paper   constellation.js  Waves
    map.js        MapLibre + pmtiles
    patterns.js   Koblin-style accumulation — deliberately NOT on the base class
    contrails.js  Long-exposure sky           radar.js  CRT phosphor sweep
    departures.js Split-flap DOM board — NOT on the base class (consumes the
                  flight list, not screen coords; same outer interface)
public/backgrounds/
  30 vendored CC0/public-domain images + manifest.json (drives the settings
  gallery; per-image attribution lives here). Refresh/extend the library
  with `node tools/fetch-backgrounds.mjs` (Wikimedia Commons, license-
  filtered to CC0/PD only — this is a public repo, keep it that way).
```

## Hard-won invariants — do not regress

- **Zero network dependencies at runtime** beyond our own server and the
  ADS-B APIs. Fonts, threejs-components, maplibre, tiles are all vendored
  (`public/vendor/`, `public/fonts/`, `public/tiles/`). Never add a CDN
  reference. `node tools/screenshot-modes.mjs out --offline` proves it.
- **DPR canvas convention**: backing stores are device-pixel sized with a
  DPR `setTransform`; ALL drawing code works in CSS pixels. Never read
  `canvas.width` for layout — use `clientWidth` / the `viewWidth` getters.
- **0 is a valid value** for altitude/velocity/heading/vertical-rate.
  Use `?? null` / explicit null checks, never truthiness, on flight fields.
- **The server never throws for upstream failures** — it degrades through
  the source chain, then serves the last good payload with `stale:true` +
  `dataAgeSeconds`. The client surfaces that via the signal-lost overlay.
- **The 1.5s position cache** in flightDataService is deliberate request
  dedup, not a bug.
- New visualization modes: extend `AircraftVisualization` if they position
  aircraft on screen; read docs/MODE-CONTRACT.md first, then register in
  app.js `visualizations`, settings.js (`MODE_META` + `getModeSchemas()`),
  a script tag in index.html, and the tools (ALL_MODES + the switch sweep).

## Verification (the screenshot spine)

```bash
node --test server/test/*.test.js                 # server unit tests
node tools/screenshot-modes.mjs tools/screenshots/candidate
node tools/compare-screenshots.mjs tools/screenshots/baseline tools/screenshots/candidate
node tools/test-signal-overlay.mjs                # failure/recovery E2E
```

- `tools/screenshots/baseline/` is the committed pixel-guard (static fixture,
  1080p @ 2x DPR). Most modes must be **pixel-exact**; ripple (WebGL
  internal clock) and constellation have small documented tolerances in
  compare-screenshots.mjs.
- Behavior-preserving changes: compare against baseline before committing.
  Intentional visual changes: re-capture the baseline in the same commit and
  review by eye on the moving fixture (`--fixture=moving`).
- The static fixture is **motion-blind** (zero velocities → no trails, no
  easing). Anything touching motion/trails must be reviewed with
  `--fixture=moving` by eye — the pixel gate cannot see it.
- The harness prints FPS per mode — don't ship a change that tanks it.
- Refresh fixtures: `node tools/capture-fixture.mjs [--moving]` (captures
  live data, enriches routes via adsbdb, zeroes velocities unless --moving).
- Map tiles: 12MB Sydney-region pmtiles (z0-11). Re-extract for a new home
  location with the pmtiles CLI against `build.protomaps.com/<date>.pmtiles`;
  regenerate styles with `node tools/generate-map-styles.mjs`.

## Conventions

- Plain JavaScript, no build step, no frameworks. Script-tag globals.
- Settings flow: Scene/Look/Mode model (settings.js) → localStorage
  (autosaved, versioned, v1-migrating) → app.js `distributeSettings()`
  composes Look + resolved palette + modeSettings → each mode's
  `setPalette()` + `setDisplayOptions()` (whitelist via `extraOptionKeys`).
  Full payload/palette contract: docs/MODE-CONTRACT.md.
- Commit at phase/feature boundaries with detailed messages; the git log
  doubles as the change journal.
- Windows dev box: PowerShell cmdlets are deny-listed in this repo's Claude
  permissions — use POSIX commands via bash/git-bash.
