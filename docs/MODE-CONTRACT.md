# Visualization Mode Contract (settings v2)

What every mode receives, must respect, and how to verify. Written for the
2026-06 overhaul; keep current if the distribution layer changes.

## What a mode receives

`setDisplayOptions(payload)` — payload is the shared Look mapped onto the
base option keys, plus that mode's own `modeSettings` spread on top:

```js
{
  showAirborneAircraft: true,
  showGroundAircraft: bool,        // Scene → "Include ground traffic"
  aircraftIcon: 'glow'|'chevron'|…|'none',
  aircraftScale: 0.5–2.0,
  accentColor: palette.primary,    // base-class default aircraft colour
  inboundColor: palette.inbound,
  outboundColor: palette.outbound,
  showTrails, trailLength,
  showCallsigns, showRoute, showAltitude, showSpeed, showCoordinates, // from the labels preset
  labelTextScale, labelBgOpacity: 0.55, labelBgColor: '#000000',
  inboundLabelFormat, outboundLabelFormat,
  backgroundImage: look.background, // '' or an image path/URL/dataURL
  ...modeSettings[mode]             // ONLY this mode's own knobs
}
```

`setPalette(palette)` — called before setDisplayOptions on every change:

```js
{ name, ui, primary, secondary, inbound, outbound,
  ramp: [c0_dark, c1, c2, c3, c4_bright],  // hex strings
  glow }                                    // rgba() string
```

Read it as `this.palette` (base class stores it; `onPaletteChanged(p)` hook
fires on swaps). **Interpret it artistically** — radar tints phosphor from
`primary`, patterns maps altitude through `ramp`, ink derives its ink from
`ramp[0]`. A mode that ignores the palette is wrong; a mode that uses raw
hardcoded colour scripts that clash with it is also wrong.

## Hard rules

- **CSS pixels everywhere.** The backing store is DPR-scaled and the context
  pre-transformed. Use `canvas.clientWidth/clientHeight`, never
  `canvas.width/height`, for layout.
- **0 is a valid value** for heading/velocity/altitude/verticalRate. Use
  `!= null` checks, never truthiness.
- **Multiply by `flight.opacity`** (0..1 fade lifecycle) on everything you
  draw. Aircraft linger up to 1.5s after their last API appearance.
- **Key per-aircraft state on `icao24`** and garbage-collect your own maps —
  there is no removal callback.
- **Determinism:** under the frozen zero-velocity fixture
  (`?mock=1&deterministic=1`) your mode must render a STABLE frame.
  Velocity-gate motion effects (zero velocity → still) or gate on
  `window.__DETERMINISTIC__`. `Math.random` is seeded in that mode —
  one-time generation (textures) is safe; per-frame randomness is not.
- **Performance:** 24/7 kiosk, ~50 aircraft, 60fps budget. No `shadowBlur`
  in per-frame paths; cache gradients (see `_glowGradientCache` in
  aircraftIcons.js); prefer offscreen accumulation + one drawImage.
- **Vendored-only:** never reference a CDN or external URL.
- **Fade buffers to zero:** a per-frame `destination-out` fill below
  1/255 alpha quantises to nothing and leaves permanent ghosts — accumulate
  fractional "fade debt" and apply it when it crosses 1/255
  (see aurora.js/ink.js).

## Base-class hooks (aircraftVisualization.js)

`isActive()` gate; `onActiveAircraft(list, now)` per-frame effect driver;
`onOptionsChanged(options)`; `onPaletteChanged(palette)`;
`latLonToScreen(lat, lon)` projection override. The base `draw()` renders
icons/trails/labels per the user's Look — call `super.draw()` for that
layer, or suppress pieces deliberately (see ink.js's icon suppression).

## Verify (every visual change)

```bash
node tools/screenshot-modes.mjs /tmp/aof-<mode> --modes=<mode> --port=<unique> --fixture=moving --settle=12000
node tools/screenshot-modes.mjs /tmp/aof-<mode>-static --modes=<mode> --port=<unique>
```

Look at the PNGs. Judge them like an art director, not a unit test. The
static shot is the future pixel-guard baseline; the moving shot is the real
artwork. The harness prints FPS — don't ship a mode under ~55 on desktop.
