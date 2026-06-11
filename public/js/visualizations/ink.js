/**
 * Ink — sumi-e brushwork on washi.
 *
 * The one bright mode: aircraft are calligraphy brushes on warm paper.
 * Pressure follows flight: slow or turning aircraft pool wide wet strokes
 * (with a soft bleed halo); fast straight cruisers cut thin dry flicks whose
 * ink granulates as the brush runs dry. Sharp heading changes flick tiny
 * droplets outward of the turn. Strokes accumulate like a day's painting and
 * the wash lifts them off over minutes. A cinnabar hanko seals the sheet.
 *
 * Ink colour derives from the palette's deepest ramp stop, desaturated and
 * deepened so it always reads as ink; the palette primary appears only as a
 * quiet accent ring on the leading brush tip.
 *
 * Architecture (all layers device-resolution):
 *   paper      opaque washi, generated once per resize from a FIXED seed —
 *              identical every run (pixel-guard friendly)
 *   accum      transparent ink layer; strokes stamp in, wash lifts out
 *   composite  paper × accum, maintained incrementally via dirty rects so
 *              draw() is a single 1:1 blit (no per-frame full-canvas multiply)
 *
 * Deterministic fixture (zero velocity): per-aircraft press marks from
 * per-id seeded PRNGs, no wash, no motion — an exactly stable frame.
 */

class InkVisualization extends AircraftVisualization {
  constructor(canvas, ctx) {
    super(canvas, ctx);

    this.ease = 0.10;
    this.trailThreshold = 0;

    // Mode knobs (settings.js modeSettings.ink)
    this.strokeWeight = 1.0;
    this.wash = 1.0; // wash speed multiplier (ink lift-off)

    // Ink layers live at CSS resolution: the kiosk TV is 1080p (1:1), and on
    // hi-DPR the gentle upscale softens strokes the way absorbent paper does.
    // Crisp elements (labels, tips, tapers) draw on the main canvas at full res.
    this.paper = null;
    this.accum = document.createElement('canvas');
    this.accumCtx = this.accum.getContext('2d');
    this.composite = document.createElement('canvas');
    this.compositeCtx = this.composite.getContext('2d');

    this._fadeDebt = 0;
    this._lastFrame = 0;
    this._brush = new Map();  // icao24 → brush state (pos, dir, turn, rng…)
    this._dirty = [];         // device-px rects of composite to rebuild
    this._inkRGB = null;      // cached "r, g, b" for the current palette
  }

  get extraOptionKeys() { return ['strokeWeight', 'wash']; }

  onOptionsChanged(options) {
    if (options.strokeWeight !== undefined) this.strokeWeight = options.strokeWeight;
    if (options.wash !== undefined) this.wash = options.wash;
  }

  onPaletteChanged() { this._inkRGB = null; }

  // ── Deterministic helpers ─────────────────────────────────

  _mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  _seedFrom(str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  /** Stable 0..1 value noise keyed on integer-quantised coordinates */
  _hash01(x, y) {
    let h = (Math.imul(Math.floor(x), 374761393) + Math.imul(Math.floor(y), 668265263)) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  }

  _angleDelta(a, b) {
    return ((a - b) % 360 + 540) % 360 - 180;
  }

  // ── Ink colour ────────────────────────────────────────────

  _ink(alpha) {
    if (!this._inkRGB) {
      const c = this.palette?.ramp?.[0] || '#0a0c10';
      let r = parseInt(c.slice(1, 3), 16);
      let g = parseInt(c.slice(3, 5), 16);
      let b = parseInt(c.slice(5, 7), 16);
      // Desaturate toward luma, deepen toward black — always reads as ink,
      // with only a whisper of the palette's temperature left in it.
      const luma = 0.299 * r + 0.587 * g + 0.114 * b;
      r = Math.round((r + (luma - r) * 0.45) * 0.5);
      g = Math.round((g + (luma - g) * 0.45) * 0.5);
      b = Math.round((b + (luma - b) * 0.45) * 0.5);
      this._inkRGB = `${r}, ${g}, ${b}`;
    }
    return `rgba(${this._inkRGB}, ${alpha})`;
  }

  // ── Washi paper (generated once per resize, fixed seed) ───

  _makePaper(w, h) {
    const paper = document.createElement('canvas');
    paper.width = w;
    paper.height = h;
    const p = paper.getContext('2d');
    const rng = this._mulberry32(0xA1F07);

    // Base: warm cream with a gentle top-light
    p.fillStyle = '#ece3d0';
    p.fillRect(0, 0, w, h);
    const sheen = p.createLinearGradient(0, 0, 0, h);
    sheen.addColorStop(0, 'rgba(255, 252, 240, 0.30)');
    sheen.addColorStop(0.55, 'rgba(255, 250, 236, 0.05)');
    sheen.addColorStop(1, 'rgba(168, 146, 110, 0.10)');
    p.fillStyle = sheen;
    p.fillRect(0, 0, w, h);

    // Low-frequency tonal blotches — big soft stains, barely there
    for (let i = 0; i < 20; i++) {
      const x = rng() * w, y = rng() * h;
      const r = (0.09 + rng() * 0.22) * Math.max(w, h);
      const dark = rng() < 0.55;
      const a = 0.018 + rng() * 0.028;
      const g = p.createRadialGradient(x, y, r * 0.05, x, y, r);
      g.addColorStop(0, dark ? `rgba(146, 120, 82, ${a})` : `rgba(255, 252, 240, ${a * 1.5})`);
      g.addColorStop(1, 'rgba(0, 0, 0, 0)');
      p.fillStyle = g;
      p.fillRect(x - r, y - r, r * 2, r * 2);
    }

    // Fibre flecks: short dark hairs at random angles, occasional darker speck
    p.lineWidth = 0.7;
    p.lineCap = 'round';
    const flecks = Math.round((w * h) / 2600);
    for (let i = 0; i < flecks; i++) {
      const x = rng() * w, y = rng() * h;
      const ang = rng() * Math.PI, len = 1 + rng() * 3.5;
      p.strokeStyle = rng() < 0.16 ? 'rgba(96, 76, 50, 0.10)' : 'rgba(124, 102, 70, 0.05)';
      p.beginPath();
      p.moveTo(x, y);
      p.lineTo(x + Math.cos(ang) * len, y + Math.sin(ang) * len);
      p.stroke();
    }
    // A few long curved hair fibres
    p.strokeStyle = 'rgba(112, 92, 62, 0.05)';
    for (let i = 0; i < 28; i++) {
      const x = rng() * w, y = rng() * h;
      const ang = rng() * Math.PI * 2, len = 8 + rng() * 16;
      const mx = x + Math.cos(ang) * len * 0.5 + (rng() - 0.5) * 6;
      const my = y + Math.sin(ang) * len * 0.5 + (rng() - 0.5) * 6;
      p.beginPath();
      p.moveTo(x, y);
      p.quadraticCurveTo(mx, my, x + Math.cos(ang) * len, y + Math.sin(ang) * len);
      p.stroke();
    }

    this._deckle(p, w, h, rng);

    // Soft overall vignette beneath the deckle
    const vg = p.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.42, w / 2, h / 2, Math.hypot(w, h) * 0.62);
    vg.addColorStop(0, 'rgba(0, 0, 0, 0)');
    vg.addColorStop(1, 'rgba(98, 82, 56, 0.15)');
    p.fillStyle = vg;
    p.fillRect(0, 0, w, h);

    this._drawSeal(p, w, h, rng);
    return paper;
  }

  /** Deckle-edge: irregular darker rim, blobs bleeding in from off-canvas */
  _deckle(p, w, h, rng) {
    const blob = (x, y) => {
      const r = 9 + rng() * 28;
      const a = 0.018 + rng() * 0.050;
      const g = p.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, `rgba(92, 76, 50, ${a})`);
      g.addColorStop(1, 'rgba(0, 0, 0, 0)');
      p.fillStyle = g;
      p.fillRect(x - r, y - r, r * 2, r * 2);
    };
    const step = 22;
    for (let x = 0; x < w + step; x += step) {
      blob(x + (rng() - 0.5) * step, -2 - rng() * 7);
      blob(x + (rng() - 0.5) * step, h + 2 + rng() * 7);
    }
    for (let y = 0; y < h + step; y += step) {
      blob(-2 - rng() * 7, y + (rng() - 0.5) * step);
      blob(w + 2 + rng() * 7, y + (rng() - 0.5) * step);
    }
  }

  /** Hanko: cinnabar seal, bottom-right — a seal is always vermilion */
  _drawSeal(p, w, h, rng) {
    const s = 28, margin = 30;
    p.save();
    p.translate(w - margin - s / 2, h - margin - s / 2);
    p.rotate(-0.05);
    p.globalAlpha = 0.85;

    // Stamp body
    p.fillStyle = '#9e2b25';
    p.beginPath();
    if (p.roundRect) p.roundRect(-s / 2, -s / 2, s, s, 4.5);
    else p.rect(-s / 2, -s / 2, s, s);
    p.fill();

    // Uneven impression: darker pools of paste
    for (let i = 0; i < 4; i++) {
      p.fillStyle = `rgba(118, 26, 22, ${0.16 + rng() * 0.16})`;
      p.beginPath();
      p.arc((rng() - 0.5) * s * 0.7, (rng() - 0.5) * s * 0.7, 2 + rng() * 4, 0, Math.PI * 2);
      p.fill();
    }

    // Aircraft glyph carved out in paper tone
    const k = s * 0.046;
    const pts = [
      [0, -9], [1.6, -3.2], [8.8, 2.4], [8.8, 4.2], [1.9, 2.8],
      [1.4, 6.0], [4.2, 8.2], [4.2, 9.4], [0, 8.4]
    ];
    p.fillStyle = '#ece3d0';
    p.beginPath();
    p.moveTo(pts[0][0] * k, pts[0][1] * k);
    for (let i = 1; i < pts.length; i++) p.lineTo(pts[i][0] * k, pts[i][1] * k);
    for (let i = pts.length - 2; i >= 1; i--) p.lineTo(-pts[i][0] * k, pts[i][1] * k);
    p.closePath();
    p.fill();

    // Nicks where the stamp didn't take
    p.fillStyle = '#ece3d0';
    for (let i = 0; i < 5; i++) {
      const edge = rng() * 4 | 0;
      const t = (rng() - 0.5) * s * 0.9;
      const ex = edge === 0 ? t : edge === 1 ? t : edge === 2 ? -s / 2 : s / 2;
      const ey = edge === 0 ? -s / 2 : edge === 1 ? s / 2 : t;
      p.beginPath();
      p.arc(ex, ey, 0.5 + rng() * 1.1, 0, Math.PI * 2);
      p.fill();
    }
    p.restore();
  }

  // ── Layer management ──────────────────────────────────────

  _syncSize() {
    const w = this.canvas.clientWidth || window.innerWidth;
    const h = this.canvas.clientHeight || window.innerHeight;
    if (!w || !h) return false;
    if (this.accum.width !== w || this.accum.height !== h) {
      this.accum.width = w;
      this.accum.height = h;
      this.composite.width = w;
      this.composite.height = h;
      this.paper = this._makePaper(w, h);
      this._brush.clear();
      this._dirty.length = 0;
      this._recomposeFull();
    }
    return true;
  }

  _recomposeFull() {
    const c = this.compositeCtx;
    c.globalCompositeOperation = 'source-over';
    c.drawImage(this.paper, 0, 0);
    c.globalCompositeOperation = 'multiply';
    c.drawImage(this.accum, 0, 0);
    c.globalCompositeOperation = 'source-over';
  }

  /** Rebuild paper × ink in all dirty rects with a single clipped pass */
  _recomposeDirty() {
    const c = this.compositeCtx;
    const W = this.composite.width, H = this.composite.height;
    c.save();
    c.beginPath();
    for (const [x, y, w, h] of this._dirty) {
      const x0 = Math.max(0, x), y0 = Math.max(0, y);
      const x1 = Math.min(W, x + w), y1 = Math.min(H, y + h);
      if (x1 > x0 && y1 > y0) c.rect(x0, y0, x1 - x0, y1 - y0);
    }
    c.clip();
    c.drawImage(this.paper, 0, 0);
    c.globalCompositeOperation = 'multiply';
    c.drawImage(this.accum, 0, 0);
    c.restore();
  }

  /** Mark a CSS-space bbox dirty (padded) */
  _addDirty(x0, y0, x1, y1, pad) {
    this._dirty.push([
      Math.floor(Math.min(x0, x1) - pad),
      Math.floor(Math.min(y0, y1) - pad),
      Math.ceil(Math.abs(x1 - x0) + pad * 2),
      Math.ceil(Math.abs(y1 - y0) + pad * 2)
    ]);
  }

  // ── Brush marks ───────────────────────────────────────────

  /**
   * First touch: a directional dab — the brush lands and pulls slightly
   * along the aircraft's heading, so every mark is calligraphy from frame
   * one. Deterministic: heading + per-id rng only.
   */
  _press(ctx, x, y, heading, op, rng) {
    const sw = this.strokeWeight;
    const ang = (((heading != null ? heading : 0) - 90) * Math.PI) / 180;
    const dx = Math.cos(ang), dy = Math.sin(ang);

    // Soft bleed halo, elongated along the landing pull
    ctx.fillStyle = this._ink(0.045 * op);
    for (const t of [-3.5, 0, 3.5]) {
      ctx.beginPath();
      ctx.arc(x + dx * t * sw, y + dy * t * sw, 9.5 * sw, 0, Math.PI * 2);
      ctx.fill();
    }

    // Body: blobs strung along the axis, fat at centre, tapering at ends
    for (let i = 0; i < 6; i++) {
      const t = (i / 5 - 0.5) * 13 * sw;                 // -6.5sw … +6.5sw
      const taper = 1 - Math.abs(i / 5 - 0.5) * 1.3;     // 0.35 … 1 … 0.35
      const jx = (rng() - 0.5) * 2.4 * sw, jy = (rng() - 0.5) * 2.4 * sw;
      ctx.fillStyle = this._ink((0.16 + rng() * 0.13) * taper * op);
      ctx.beginPath();
      ctx.arc(x + dx * t + jx, y + dy * t + jy, (1.6 + 3.4 * taper) * sw, 0, Math.PI * 2);
      ctx.fill();
    }

    // Dark wet core, just behind centre (where the brush first lands)
    ctx.fillStyle = this._ink(0.55 * op);
    ctx.beginPath();
    ctx.arc(x - dx * 1.5 * sw, y - dy * 1.5 * sw, 4.4 * sw, 0, Math.PI * 2);
    ctx.fill();
  }

  /** Droplets flicked outward of a sharp turn */
  _splat(ctx, x, y, dirX, dirY, side, op, rng) {
    const px = dirY * side, py = -dirX * side; // outward of the turn
    const n = 2 + Math.floor(rng() * 3);
    for (let i = 0; i < n; i++) {
      const spread = (rng() - 0.5) * 1.1;
      const ca = Math.cos(spread), sa = Math.sin(spread);
      const ox = px * ca - py * sa, oy = px * sa + py * ca;
      const d = 6 + rng() * 20;
      const r = (0.7 + rng() * 1.8) * this.strokeWeight;
      ctx.fillStyle = this._ink((0.16 + rng() * 0.18) * op);
      ctx.beginPath();
      ctx.arc(x + ox * d, y + oy * d, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // ── Per-frame painting ────────────────────────────────────

  onActiveAircraft(activeAircraft, now) {
    if (!this._syncSize()) return;
    this._checkDayReset();
    const ctx = this.accumCtx;

    const dt = this._lastFrame ? Math.min((now - this._lastFrame) / 1000, 0.1) : 0.016;
    this._lastFrame = now;

    // Wash: ink lifts off over minutes (half-life ~3 min at wash 1.0).
    // Skipped under the deterministic fixture so the pixel-guard frame is
    // exactly stable; 12s of wash is invisible in the moving review anyway.
    let fullRecompose = false;
    if (!window.__DETERMINISTIC__) {
      this._fadeDebt += 0.0040 * this.wash * dt;
      if (this._fadeDebt >= 2 / 255) {
        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.globalCompositeOperation = 'destination-out';
        ctx.fillStyle = `rgba(0, 0, 0, ${this._fadeDebt})`;
        ctx.fillRect(0, 0, this.accum.width, this.accum.height);
        ctx.restore();
        this._fadeDebt = 0;
        fullRecompose = true;
      }
    }

    const cs = window.theArtOfFlight?.coordSystem;
    const locked = !cs || cs.isLocked;

    for (const aircraft of activeAircraft) {
      const id = aircraft.flight?.icao24 || aircraft.callsign;
      const op = aircraft.flight?.opacity ?? 1;
      const speed = aircraft.velocity || 0;
      let b = this._brush.get(id);

      if (!b) {
        // Wait for a real projection and a converged easing position so the
        // press lands where the aircraft actually is (no centre-ghost strokes)
        if (!locked) continue;
        if (Math.abs(aircraft.x - aircraft.targetX) > 30 ||
            Math.abs(aircraft.y - aircraft.targetY) > 30) continue;
        b = {
          x: aircraft.x, y: aircraft.y,
          dirX: 0, dirY: 0, hasDir: false,
          turn: 0, width: 3.2 * this.strokeWeight, phase: 0,
          heading: aircraft.heading, splatAt: 0, pressed: false,
          rng: this._mulberry32(this._seedFrom(String(id)))
        };
        this._brush.set(id, b);
      }

      // Press once the fade-in has substance (one-time, per-id seeded)
      if (!b.pressed && op > 0.85) {
        b.pressed = true;
        this._press(ctx, aircraft.x, aircraft.y, aircraft.heading, op, b.rng);
        this._addDirty(aircraft.x, aircraft.y, aircraft.x, aircraft.y, 13 * this.strokeWeight);
      }

      const dh = this._angleDelta(aircraft.heading, b.heading);
      b.heading = aircraft.heading;

      const dx = aircraft.x - b.x, dy = aircraft.y - b.y;
      const dist = Math.hypot(dx, dy);

      if (dist >= 80) { // projection jump — lift the brush, no stroke
        b.x = aircraft.x; b.y = aircraft.y;
        b.phase = 0; b.hasDir = false;
        continue;
      }

      // Splatter on sharp heading change — velocity-gated, cooled down
      if (Math.abs(dh) > 25 && speed > 40 && dist > 0.3 && b.hasDir &&
          now - b.splatAt > 1600) {
        b.splatAt = now;
        this._splat(ctx, aircraft.x, aircraft.y, b.dirX, b.dirY, Math.sign(dh) || 1, op, b.rng);
        this._addDirty(aircraft.x, aircraft.y, aircraft.x, aircraft.y, 32);
      }

      if (dist < 0.05) continue;

      const ux = dx / dist, uy = dy / dist;
      if (b.hasDir && dist > 0.25) {
        const dot = Math.max(-1, Math.min(1, ux * b.dirX + uy * b.dirY));
        const inst = Math.acos(dot) * 57.29578 / Math.max(dt, 0.001); // deg/s
        b.turn += (Math.min(inst, 40) - b.turn) * 0.18;
      }
      if (dist > 0.25) { b.dirX = ux; b.dirY = uy; b.hasDir = true; }

      // Brush pressure: slow or turning = wet pooling; fast straight = dry flick
      const speedT = Math.min(speed / 420, 1);
      const turnT = Math.min(b.turn / 6, 1);
      const wet = Math.min(0.8 * (1 - speedT) + 0.5 * turnT, 1);
      const width = (2.2 + 9.0 * wet) * this.strokeWeight;
      b.width = width;
      const baseA = (0.16 + 0.34 * wet) * op;
      const dry = Math.max(0, speedT * 1.4 - 0.35);
      const spacing = Math.max(0.8, width * 0.36);

      // Stamp at fixed spacing along the path — deposition is frame-rate
      // independent (6fps harness and 60fps kiosk lay down the same ink)
      let t = b.phase, n = 0;
      while (t <= dist && n < 220) {
        const sx = b.x + ux * t, sy = b.y + uy * t;
        // Organic edge: tiny deterministic perpendicular jitter
        const j = (this._hash01(sx * 7.13, sy * 5.71) - 0.5) * width * 0.36;
        const px = sx - uy * j, py = sy + ux * j;
        let a = baseA;
        if (dry > 0) { // granulation: the brush runs dry at speed
          const g = this._hash01(sx * 2.3, sy * 2.3);
          a *= 1 - Math.min(dry, 1) * (0.8 - 0.8 * g);
        }
        if (wet > 0.3) { // wet bleed halo under the stroke
          ctx.fillStyle = this._ink(a * 0.14);
          ctx.beginPath();
          ctx.arc(px, py, width * 1.1, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.fillStyle = this._ink(a);
        ctx.beginPath();
        ctx.arc(px, py, width * 0.5, 0, Math.PI * 2);
        ctx.fill();
        t += spacing;
        n++;
      }
      b.phase = Math.max(t - dist, 0);
      this._addDirty(b.x, b.y, aircraft.x, aircraft.y, width * 1.6 + 3);
      b.x = aircraft.x;
      b.y = aircraft.y;
    }

    // Rebuild the painting where it changed
    if (fullRecompose) {
      this._recomposeFull();
    } else if (this._dirty.length) {
      this._recomposeDirty();
    }
    this._dirty.length = 0;

    // GC stale brush state
    if (this._brush.size > activeAircraft.length + 20) {
      const live = new Set(activeAircraft.map(a => a.flight?.icao24 || a.callsign));
      for (const key of this._brush.keys()) {
        if (!live.has(key)) this._brush.delete(key);
      }
    }
  }

  // ── Presentation ──────────────────────────────────────────

  draw() {
    if (!this._syncSize()) return;
    const ctx = this.ctx;
    const w = this.canvas.clientWidth || window.innerWidth;
    const h = this.canvas.clientHeight || window.innerHeight;

    // The painting: paper × ink, pre-composited — one blit
    ctx.drawImage(this.composite, 0, 0, w, h);

    const accent = this.palette?.primary || '#52e0c4';
    for (const [, aircraft] of this.aircraftPositions.entries()) {
      const isOnGround = aircraft.altitude <= 0;
      if (isOnGround && !this.options.showGroundAircraft) continue;
      const op = aircraft.flight?.opacity ?? 1;
      const b = this._brush.get(aircraft.flight?.icao24 || aircraft.callsign);

      // Living brush head: a wet tapered tip at the stroke's leading edge
      // (velocity-gated — the zero-velocity fixture renders only the dot)
      if (b && b.hasDir && (aircraft.velocity || 0) >= 1) {
        const wv = Math.max(b.width, 2.2);
        const len = 9 + wv * 2.6;
        const tipX = aircraft.x + b.dirX * len * 0.35;
        const tipY = aircraft.y + b.dirY * len * 0.35;
        const baseX = aircraft.x - b.dirX * len;
        const baseY = aircraft.y - b.dirY * len;
        const pxv = -b.dirY * wv * 0.5, pyv = b.dirX * wv * 0.5;
        ctx.fillStyle = this._ink(0.65 * op);
        ctx.beginPath();
        ctx.moveTo(baseX + pxv, baseY + pyv);
        ctx.lineTo(baseX - pxv, baseY - pyv);
        ctx.lineTo(tipX, tipY);
        ctx.closePath();
        ctx.fill();
      }

      // Quiet tip: dark point + faint accent ring
      ctx.fillStyle = this._ink(0.85 * op);
      ctx.beginPath();
      ctx.arc(aircraft.x, aircraft.y, 2.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = accent;
      ctx.globalAlpha = 0.30 * op;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(aircraft.x, aircraft.y, 5.0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    // Labels only — icons are replaced by the brush tips
    const savedIcon = this.options.aircraftIcon;
    this.options.aircraftIcon = 'none';
    super.draw();
    this.options.aircraftIcon = savedIcon;
  }

  /**
   * Mode switch: the day's painting stays on the sheet. Only brush state
   * resets (a stale brush would drag a stroke across the paper on
   * re-entry); the ink itself persists until the day rolls over.
   */
  clear() {
    super.clear();
    this._brush.clear();
    this._fadeDebt = 0;
  }

  _checkDayReset() {
    const today = new Date().toDateString();
    if (this._day && this._day !== today) {
      const a = this.accumCtx;
      a.save();
      a.setTransform(1, 0, 0, 1, 0, 0);
      a.clearRect(0, 0, this.accum.width, this.accum.height);
      a.restore();
      this._dirty.length = 0;
      if (this.paper) this._recomposeFull();
    }
    this._day = today;
  }
}
