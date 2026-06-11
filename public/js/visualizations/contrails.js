/**
 * Contrails Mode: long-exposure sky photography
 *
 * Aircraft lay down dissolving vapor trails on a time-of-day sky. Trails
 * accumulate on an offscreen canvas, spread and drift like real contrails
 * (a periodic low-alpha self-blit with a wind offset), and fade with a
 * fractional "fade debt" so they truly reach zero — a naive per-frame
 * destination-out below 1/255 alpha quantises to nothing and left
 * permanent ghost smears (fixed 06/2026).
 *
 * Sky periods crossfade by the minute (no hourly snaps); night and dusk
 * carry a seeded starfield. The night sky takes its depth from the palette
 * ramp so every palette produces a coherent nocturne; dawn/day/dusk are
 * fixed photographic scripts. Trails are altitude-tinted (cold cirrus high,
 * warm underlit plumes low) — livery colours are deliberately not used
 * here, they break the photographic unity.
 *
 * Deterministic fixture: period pinned to night, zero velocity lays no
 * segments, strobes collapse to a steady glow — pixel-stable.
 */
class ContrailsVisualization extends AircraftVisualization {
  constructor(canvas, ctx) {
    super(canvas, ctx);

    // Last laid-down point per aircraft, so segments connect
    // (must exist before _syncAccumSize clears it)
    this.lastPoints = new Map();

    this.accumCanvas = document.createElement('canvas');
    this.accumCtx = this.accumCanvas.getContext('2d');
    this._fadeDebt = 0;
    this._frame = 0;
    this._stars = null;       // prerendered starfield (seeded)
    this._starsKey = '';
    this._vignette = null;    // cached radial gradient
    this._vignetteKey = '';
    this._syncAccumSize();

    Object.assign(this.options, {
      skyMode: 'auto',        // auto | night | dusk | day | dawn
      trailWidth: 2.0,
      dissolveMinutes: 6,
      // The leading glint IS the aircraft in this mode; base icons off
      showAirborneAircraft: false,
      accentColor: '#FFE8C8'
    });

    this._resizeHandler = () => this._syncAccumSize();
    window.addEventListener('resize', this._resizeHandler);
  }

  get extraOptionKeys() {
    return ['skyMode', 'trailWidth', 'dissolveMinutes'];
  }

  onPaletteChanged() { this._starsKey = ''; }

  _syncAccumSize() {
    this.accumCanvas.width = this.canvas.width;
    this.accumCanvas.height = this.canvas.height;
    const dpr = window.devicePixelRatio || 1;
    this.accumCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.lastPoints.clear();
  }

  _mulberry(seed) {
    let a = seed >>> 0;
    return () => {
      a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  _hexRgb(hex) {
    return {
      r: parseInt(hex.slice(1, 3), 16),
      g: parseInt(hex.slice(3, 5), 16),
      b: parseInt(hex.slice(5, 7), 16)
    };
  }

  /**
   * Period weights, crossfaded by the minute over ~30 min boundaries.
   * Returns { night, dawn, day, dusk } summing to 1.
   */
  skyWeights() {
    const mode = this.options.skyMode;
    if (mode && mode !== 'auto') {
      return { night: 0, dawn: 0, day: 0, dusk: 0, [mode]: 1 };
    }
    if (window.__DETERMINISTIC__) return { night: 1, dawn: 0, day: 0, dusk: 0 };

    const d = new Date();
    const t = d.getHours() + d.getMinutes() / 60;
    // Anchor centres: night 1.5, dawn 6.5, day 12.5, dusk 18.5 (wraps)
    const anchors = [
      { key: 'night', from: 20, to: 29 },   // 20:00 → 05:00 (wrapped)
      { key: 'dawn', from: 5, to: 8 },
      { key: 'day', from: 8, to: 17 },
      { key: 'dusk', from: 17, to: 20 }
    ];
    const BLEND = 0.75; // hours of crossfade either side of a boundary
    const w = { night: 0, dawn: 0, day: 0, dusk: 0 };
    for (const a of anchors) {
      const tt = (t < a.from && a.to > 24) ? t + 24 : t;
      const rise = Math.min(1, Math.max(0, (tt - (a.from - BLEND)) / (2 * BLEND)));
      const fall = Math.min(1, Math.max(0, ((a.to + BLEND) - tt) / (2 * BLEND)));
      w[a.key] = Math.max(0, Math.min(rise, fall));
    }
    const sum = w.night + w.dawn + w.day + w.dusk;
    if (sum <= 0) return { night: 1, dawn: 0, day: 0, dusk: 0 };
    for (const k of Object.keys(w)) w[k] /= sum;
    return w;
  }

  /**
   * Sky colour scripts. The night script is generated from the palette ramp
   * (deep nocturne in every palette); the photographic periods are fixed.
   * All scripts share 4 stops so they can be blended per-channel.
   */
  _skyScripts() {
    const deep = this._hexRgb(this.palette?.ramp?.[0] || '#071019');
    const lit = this._hexRgb(this.palette?.ramp?.[1] || '#0e3a40');
    const nightStops = [
      [Math.round(deep.r * 0.25), Math.round(deep.g * 0.25), Math.round(deep.b * 0.35)],
      [Math.round(deep.r * 0.7), Math.round(deep.g * 0.7), Math.round(deep.b * 0.8)],
      [deep.r, deep.g, deep.b],
      [Math.round(deep.r * 0.6 + lit.r * 0.4), Math.round(deep.g * 0.6 + lit.g * 0.4), Math.round(deep.b * 0.6 + lit.b * 0.4)]
    ];
    return {
      night: { stops: nightStops, trail: [207, 228, 255], warm: 0.1 },
      dawn: { stops: [[26, 35, 64], [92, 58, 85], [201, 111, 74], [240, 180, 106]], trail: [255, 217, 176], warm: 0.8 },
      day: { stops: [[19, 60, 110], [45, 96, 156], [108, 152, 198], [170, 200, 224]], trail: [255, 255, 255], warm: 0.15 },
      dusk: { stops: [[13, 10, 32], [59, 30, 78], [148, 64, 92], [224, 136, 80]], trail: [255, 200, 216], warm: 0.7 }
    };
  }

  /** Blend the 4 scripts by weight → {stops[4][3], trail[3], warm} */
  _blendedSky() {
    const w = this.skyWeights();
    const s = this._skyScripts();
    const out = { stops: [[0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0]], trail: [0, 0, 0], warm: 0 };
    for (const key of ['night', 'dawn', 'day', 'dusk']) {
      const wk = w[key];
      if (!wk) continue;
      for (let i = 0; i < 4; i++) {
        for (let c = 0; c < 3; c++) out.stops[i][c] += s[key].stops[i][c] * wk;
      }
      for (let c = 0; c < 3; c++) out.trail[c] += s[key].trail[c] * wk;
      out.warm += s[key].warm * wk;
    }
    out.nightW = w.night;
    out.duskW = w.dusk;
    return out;
  }

  _ensureStars(w, h) {
    const key = `${w}x${h}`;
    if (this._stars && this._starsKey === key) return;
    this._starsKey = key;
    const dpr = window.devicePixelRatio || 1;
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(w * dpr));
    c.height = Math.max(1, Math.round(h * dpr));
    const g = c.getContext('2d');
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    const rnd = this._mulberry(0xC0117A);
    const count = Math.round((w * h) / 16000);
    g.fillStyle = '#e8f0ff';
    for (let i = 0; i < count; i++) {
      const x = rnd() * w;
      const y = rnd() * rnd() * h * 0.8; // sparse toward the horizon
      const r = 0.35 + rnd() * 0.8;
      g.globalAlpha = 0.10 + rnd() * 0.28;
      g.beginPath();
      g.arc(x, y, r, 0, Math.PI * 2);
      g.fill();
    }
    g.globalAlpha = 1;
    this._stars = c;
  }

  /** Lay down trail segments into the accumulation buffer */
  onActiveAircraft(activeAircraft, now) {
    if (this.accumCanvas.width !== this.canvas.width ||
        this.accumCanvas.height !== this.canvas.height) {
      this._syncAccumSize();
    }

    const sky = this._blendedSky();
    const g = this.accumCtx;
    const seen = new Set();
    this._frame++;

    for (const aircraft of activeAircraft) {
      const key = aircraft.flight?.icao24 || aircraft.callsign;
      seen.add(key);
      const prev = this.lastPoints.get(key);
      const opacity = aircraft.flight?.opacity ?? 1;

      if (prev) {
        const dx = aircraft.x - prev.x;
        const dy = aircraft.y - prev.y;
        const distSq = dx * dx + dy * dy;
        if (distSq > 1) {
          const dist = Math.sqrt(distSq);
          // Altitude shapes the trail: high = thin bright cirrus streak,
          // low = soft wide warm plume
          const altT = Math.min((aircraft.altitude || 0) / 38000, 1);
          const w = this.options.trailWidth * (1.8 - altT);

          // Colour script: cold blue-white high, sky-warmed low
          const cold = sky.trail;
          const warmTint = [255, 196, 150];
          const mixT = (1 - altT) * sky.warm;
          const r = Math.round(cold[0] + (warmTint[0] - cold[0]) * mixT);
          const gg = Math.round(cold[1] + (warmTint[1] - cold[1]) * mixT);
          const b = Math.round(cold[2] + (warmTint[2] - cold[2]) * mixT);

          // Cirrus breakup: low-frequency alpha modulation along the path
          const breakup = 0.75 + 0.25 * Math.sin(aircraft.x * 0.018 + aircraft.y * 0.013);

          g.lineCap = 'round';
          g.strokeStyle = `rgb(${r}, ${gg}, ${b})`;

          // Halo pass
          g.globalAlpha = 0.05 * opacity * breakup;
          g.lineWidth = w * 6;
          g.beginPath();
          g.moveTo(prev.x, prev.y);
          g.lineTo(aircraft.x, aircraft.y);
          g.stroke();

          // Twin-engine cores: two thin strokes offset perpendicular,
          // reading as one plume from the sofa
          const px = -dy / dist, py = dx / dist;
          const off = Math.max(0.7, w * 0.55);
          for (const o of [off, -off]) {
            g.globalAlpha = 0.30 * opacity * breakup;
            g.lineWidth = w * 0.8;
            g.beginPath();
            g.moveTo(prev.x + px * o, prev.y + py * o);
            g.lineTo(aircraft.x + px * o, aircraft.y + py * o);
            g.stroke();
          }
          g.globalAlpha = 1;
          this.lastPoints.set(key, { x: aircraft.x, y: aircraft.y });
        }
      } else {
        this.lastPoints.set(key, { x: aircraft.x, y: aircraft.y });
      }
    }

    for (const key of this.lastPoints.keys()) {
      if (!seen.has(key) && !this.aircraftPositions.has(key)) this.lastPoints.delete(key);
    }

    const cw = this.canvas.clientWidth || this.canvas.width;
    const ch = this.canvas.clientHeight || this.canvas.height;

    // Aging: every 6th frame, re-blit the buffer onto itself nudged downwind
    // at low alpha — old trails spread and shear like real contrails. The
    // added luminance is paid back through extra fade debt below.
    const AGE_EVERY = 6, AGE_ALPHA = 0.05;
    if (!window.__DETERMINISTIC__ && this._frame % AGE_EVERY === 0) {
      g.globalAlpha = AGE_ALPHA;
      g.drawImage(this.accumCanvas, 0.45, 0.18, cw, ch);
      g.globalAlpha = 1;
    }

    // Dissolve with fractional fade debt (8-bit safe — trails reach zero)
    const perFrame = 4 / Math.max(1, this.options.dissolveMinutes * 60 * 60);
    this._fadeDebt += perFrame + (window.__DETERMINISTIC__ ? 0 : AGE_ALPHA / AGE_EVERY * 0.9);
    if (this._fadeDebt >= 1 / 255) {
      g.globalCompositeOperation = 'destination-out';
      g.globalAlpha = Math.min(this._fadeDebt, 0.06);
      g.fillRect(0, 0, cw, ch);
      g.globalCompositeOperation = 'source-over';
      g.globalAlpha = 1;
      this._fadeDebt = 0;
    }
  }

  draw() {
    const w = this.canvas.clientWidth || this.canvas.width;
    const h = this.canvas.clientHeight || this.canvas.height;
    const sky = this._blendedSky();
    const ctx = this.ctx;

    // Sky: blended 4-stop gradient + soft horizon glow. A user background
    // sits beneath, with the sky as a translucent time-of-day wash over it.
    const hasBg = this.drawBackgroundImage(1.0);
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    const pos = [0, 0.45, 0.78, 1];
    sky.stops.forEach((s, i) => {
      grad.addColorStop(pos[i], `rgb(${Math.round(s[0])}, ${Math.round(s[1])}, ${Math.round(s[2])})`);
    });
    ctx.save();
    if (hasBg) ctx.globalAlpha = 0.55;
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
    ctx.restore();

    // Stars fade in with night (and a little at dusk)
    const starAlpha = (sky.nightW || 0) * 0.9 + (sky.duskW || 0) * 0.3;
    if (starAlpha > 0.02) {
      this._ensureStars(w, h);
      ctx.globalAlpha = starAlpha;
      ctx.drawImage(this._stars, 0, 0, w, h);
      ctx.globalAlpha = 1;
    }

    // Accumulated contrails
    ctx.globalCompositeOperation = 'screen';
    ctx.drawImage(this.accumCanvas, 0, 0, w, h);
    ctx.globalCompositeOperation = 'source-over';

    // Leading glints: steady warm glow + anti-collision strobe in motion
    // (hex — drawAircraftIcon's glow gradient parses hex colours only)
    const hx = (v) => Math.round(Math.min(255, v)).toString(16).padStart(2, '0');
    const leading = `#${hx(sky.trail[0] * 1.1)}${hx(sky.trail[1] * 1.05)}${hx(sky.trail[2])}`;
    for (const [, aircraft] of this.aircraftPositions.entries()) {
      const isOnGround = aircraft.altitude <= 0;
      if (isOnGround && !this.options.showGroundAircraft) continue;
      const opacity = aircraft.flight?.opacity ?? 1;
      drawAircraftIcon(this.ctx, aircraft.x, aircraft.y, aircraft.heading,
        leading, 'glow', this.options.aircraftScale, 6, opacity * 0.9);

      // Double-flash strobe on a 1.3s cycle — velocity-gated (fixture-safe)
      if (aircraft.velocity > 30 && !window.__DETERMINISTIC__) {
        const t = (Date.now() % 1300) / 1300;
        const flash = (t < 0.05 || (t > 0.12 && t < 0.17)) ? 1 : 0;
        if (flash) {
          ctx.globalAlpha = 0.85 * opacity;
          ctx.fillStyle = '#ffffff';
          ctx.beginPath();
          ctx.arc(aircraft.x, aircraft.y, 1.6 * this.options.aircraftScale, 0, Math.PI * 2);
          ctx.fill();
          ctx.globalAlpha = 1;
        }
      }
    }

    // Quiet vignette pulls the eye centre-frame
    const vKey = `${w}x${h}`;
    if (this._vignetteKey !== vKey) {
      this._vignetteKey = vKey;
      this._vignette = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.45, w / 2, h / 2, Math.hypot(w, h) * 0.6);
      this._vignette.addColorStop(0, 'rgba(0, 0, 0, 0)');
      this._vignette.addColorStop(1, 'rgba(0, 0, 0, 0.28)');
    }
    ctx.fillStyle = this._vignette;
    ctx.fillRect(0, 0, w, h);

    super.draw();
  }

  /**
   * Mode switch: the photograph keeps developing — the accumulated trails
   * survive switching away and back (the dissolve clock pauses while the
   * mode is inactive). Only the segment-connection state resets, so
   * re-entry doesn't draw a teleport streak. Trails dissolve within
   * minutes anyway, so no daily reset is needed here.
   */
  clear() {
    super.clear();
    this.lastPoints.clear();
    this._fadeDebt = 0;
  }
}
