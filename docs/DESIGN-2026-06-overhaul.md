# theARTofFLIGHT — 2026-06 Overhaul Design

Goal: make the installation truly beautiful, the settings intuitive and
consistent, and the chrome invisible until summoned. Brief from Joel:

> "The settings pages are quite confusing and different for each mode — make
> this easier, more intuitive, consistent: a base set of settings for each
> mode (background, colour etc.) and then some mode-specific settings. The
> effects should be beautiful and truly artistic — add or remove effects as
> you see fit. Options shouldn't show on page load — keyboard shortcut
> instead."

## 1. Mode roster

Survey verdict (art-director pass + per-file review): every mode has a
strong-concept/weak-execution gap; two modes are generic cursor-toys with no
flight semantics.

| Mode | Verdict | Action |
|------|---------|--------|
| ripple | Strong material (WebGL liquid), weak choreography — one fake cursor, focus-slew streaks | **Elevate**: direct `addDrop()` wakes per aircraft, data-mapped drops, idle rain, palette-tinted water |
| reality | Reference mode | Keep; benefits from base-class label/trail upgrades |
| birds (Grid) | Generic codepen port, 95% empty canvas, no flight meaning | **Remove** |
| constellation (Waves) | Poetic premise (invisible field made visible), 3/10 execution | **Rework**: smoothstep kernel, directional wakes, luminance response, damped springs |
| tubes | 775KB vendor cursor-toy; uncurated neon; no flight semantics | **Remove** (vendor blob deleted) |
| map | Solid stage, dashboard feel | **Polish**: Nocturne style, luminous aircraft, restrained labels |
| patterns | Best premise in the repo (Koblin homage), alphas 5× too hot → clips to neon spaghetti | **Elevate**: exposure control, continuous OKLCH-ish ramps, comet head, gallery-placard stats |
| contrails | Strong long-exposure premise; flat sky, ghost-smear fade bug | **Elevate**: richer skies + stars, trail aging/diffusion, residue fix |
| radar | Clearest identity; sweep is a flat pie slice, echoes follow the plane (wrong) | **Elevate**: true phosphor history, additive bloom, ignition flash, ATC detailing |
| departures | Great concept, "flip" is a flat squash | **Elevate**: true per-character split-flap with perspective, clock, status colour |
| **aurora** (new) | — | Flow-field ribbons: aircraft drag luminous curl-noise ribbons through the night; additive accumulation; palette gradients. The new beautiful default. |
| **ink** (new) | — | Sumi-e: aircraft as calligraphic brush strokes on paper; speed → stroke character; ink wash fades; works with the marbled-paper backgrounds. |

Final roster (10): ripple, reality, constellation, map, patterns, contrails,
radar, departures, aurora, ink. Default mode: **aurora**.

**Mode key aliases** (URL `?mode=` + stored settings migration):
`waves→constellation`, `board→departures`, `grid→aurora`, `birds→aurora`,
`tubes→ripple`. Fixes the Panarea dash, which already sends `waves`/`grid`/
`board` (silently broken today). The dash's `FLIGHT_MODES` list is updated to
canonical keys in the same session (cross-repo rule).

## 2. Settings architecture (v2)

One mental model: **Scene** (where/what data) + **Look** (shared across all
modes) + **Mode** (only that mode's knobs).

```
settings = {
  version: 2,
  // Scene
  locationName, latitude, longitude, radius, updateInterval, maxFlights,
  mode, showInfoPanel (default false),
  // Look — applies to whichever mode is active
  look: {
    background: '',        // gallery path / URL / data-URL upload
    palette: 'aurora',     // named palette or 'custom'
    customPalette: { accent, inbound, outbound },
    aircraftIcon: 'glow', aircraftScale: 1.0,
    trails: false, trailLength: 100,
    labels: 'minimal',     // off | minimal | standard | detailed
    labelScale: 1.0,
    homeMarker: false, homeMarkerIcon: 'crosshair',
  },
  // Mode-specific knobs ONLY (no duplicated base keys)
  modeSettings: { ripple: {...}, radar: {...}, ... }
}
```

**Palettes** are the consistency lever: six curated palettes, each defining
semantic slots `{ ui, primary, secondary, inbound, outbound, ramp[5], glow }`.
Modes interpret them artistically (radar tints phosphor from `primary`,
patterns ramps altitude through `ramp`, departures sets board colour from
`primary`, aurora gradients along `ramp`). Set once, beautiful everywhere.

- **Aurora** — deep teal → cyan → violet (default)
- **Ember** — charcoal / amber / vermilion (sodium-vapour night; the classic board amber)
- **Porcelain** — ink blue / warm white minimalism
- **Dawn** — rose / coral / gold
- **Abyss** — indigo / ice blue
- **Phosphor** — CRT greens
- Custom — three pickers (accent/inbound/outbound), ramp derived

**Labels** collapse 10 controls into one preset: off / minimal (callsign) /
standard (+route) / detailed (+altitude/speed). Format-string templates leave
the UI (sensible defaults remain in code).

**Removed**: per-mode background/colour/label duplication, panel
background/opacity/font pickers (the panel is designed, not themed), the
Google-Fonts `loadFont()` CDN path (violated the offline invariant).

**Migration v1→v2**: location/data/mode preserved; `look` seeded from the
active mode's old settings where mappable; everything else falls to new
defaults. Stored under the same localStorage key with `version: 2`.

## 3. Chrome: hidden until summoned

- Bottom mode bar and gear button are **deleted**. No UI on load.
- `S` toggles the settings panel. `I` info overlay, `F` fullscreen,
  `1–9,0` direct mode select, `←/→` cycle modes, `Esc` closes.
- Mode switches show a transient **toast** (mode name in display type,
  fades over ~2s) so keyboard switching is self-confirming.
- Mouse users: moving the mouse reveals a small **hint pill**
  ("S settings · 1–0 modes", bottom-centre) that is itself clickable to open
  settings; it fades with the existing idle timer. Visibility uses
  opacity+visibility+pointer-events together — no invisible hotspots
  (the old chrome kept pointer-events on invisible buttons).
- First-ever load (no saved settings): pill shows for ~8s regardless of
  mouse, then obeys idle rules.
- `?chrome=0` unchanged: pill, toast, panel all dead — dash embeds stay pure.
- Signal-lost overlay untouched (deliberately independent of all chrome).
- Info overlay default off; loses its gear-clearance offset.

## 4. Settings panel redesign

Structure: one panel, four sections — **Modes** (card grid with icons,
click to switch), **Look** (background gallery, palette swatches, aircraft,
trails, labels, home marker), **Scene** (location, radius, data, info panel),
**Mode** (active mode's specific knobs). About menu folded into a footer link.

Design-language fixes from the CSS audit: type floor raised to 10px+
(11px labels, 12–13px section heads), accent reserved for interactive/active
states, two hairline tokens, filled slider tracks, visible focus ring,
tabular-nums on readouts, scrim behind the panel, panel exit animation,
keyboard-shortcut footer.

## 5. Shared rendering upgrades (base class)

- `setPalette(palette)` — distributed by app.js alongside options.
- Label cards: measured width (not fixed 150px), greedy vertical de-overlap
  so stacked aircraft never collide labels (visible bug in baseline).
- Trails: two-pass glow (wide faint under-stroke + bright core).
- All modes must multiply `flight.opacity` (fade lifecycle) — unchanged rule.

## 6. Verification & tooling

- `findBrowser()` in all three Playwright tools gains Linux candidates
  (`/usr/bin/chromium` etc.) so the harness runs on the Pi.
- `ALL_MODES`, mode-switch `SEQUENCE`/`LAYER_OWNERS`, `ALLOWED_PCT` updated
  for the new roster; stale baselines removed; **baseline fully re-captured**
  in the same commit (intentional visual change).
- New modes follow determinism rules: anything animated is either
  velocity-gated (zero-velocity fixture → still frame) or gated on
  `window.__DETERMINISTIC__`.
- Review by eye on `--fixture=moving` for all motion work; FPS per mode must
  stay near 60 (24/7 kiosk).
- Server untouched; server tests must still pass.

## 7. Deploy

Push to GitHub → dockerhost `git pull` in `C:\Git\art-of-flight` →
`docker compose build flightart && up -d flightart` → update dash
`FLIGHT_MODES` (panarea repo) + rebuild dash → verify `flight.panarea.casa`
and the dash embed (`?mode=…&chrome=0`).
