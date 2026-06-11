/**
 * Aurora — aircraft drag curtains of auroral light across a deep night sky.
 *
 * Each aircraft is the bright lower edge of an auroral curtain. Strands
 * weave around the flight path on two slow incommensurate folds (like
 * curtain folds seen edge-on), breathe in width and luminance along their
 * length, and are stamped into a low-res offscreen accumulation buffer as
 * C1-continuous quadratic ribbons. Colour is the palette ramp: altitude
 * picks the band, dark stops skin the curtain edges, bright stops live in
 * the narrow core — auroras glow from the inside.
 *
 * The empty sky holds the wall on its own: a prerendered night gradient,
 * a handful of seeded pin-prick stars (a few breathe very slowly), and an
 * extremely faint horizon glow from ramp[1].
 *
 * Deterministic fixture (zero velocity): no light is laid (velocity-gated),
 * stars come from a private seeded PRNG and the twinklers hold still —
 * the frame is sky + glints + labels, pixel-stable for the guard.
 *
 * Performance: the accumulation buffer runs at half CSS resolution (soft
 * light upscales beautifully), the sky is prerendered at device resolution,
 * and ribbon stamps are cadence-driven (~3/s per aircraft), so the per-frame
 * cost is two full-canvas blits plus sprites — not per-pixel gradient math.
 */

class AuroraVisualization extends AircraftVisualization {
  constructor(canvas, ctx) {
    super(canvas, ctx);

    this.ease = 0.10;
    this.trailThreshold = 0; // we sample our own motion

    // Mode knobs (settings.js modeSettings.aurora)
    this.flow = 1.0;     // fold energy: how fast/deep the curtains dance
    this.glow = 1.0;     // light intensity
    this.density = 1.0;  // strand count multiplier

    // Offscreen accumulation buffer (device pixels, drawn in CSS px) —
    // 1:1 with the backing store so the per-frame composite takes the fast
    // unscaled-blit path (24/7 kiosk budget)
    this.accum = document.createElement('canvas');
    this.accumCtx = this.accum.getContext('2d');
    this._fadeDebt = 0;     // fractional erase accumulator (8-bit safe)
    this._lastFrame = 0;
    this._lastLightAt = 0;  // when dark long enough, skip the composite

    // Per-aircraft curtain state: head position, fold phase, strand chains
    this._curtains = new Map();

    // Night-sky scenography (rebuilt on resize / palette swap)
    this._sky = null;        // prerendered: gradient + stars + horizon glow
    this._skyKey = '';
    this._twinklers = [];    // small set of live-drawn breathing stars
    this._starRgb = { r: 255, g: 255, b: 255 };
    this._glowSprite = null; // soft halo under each aircraft, palette-tinted
  }

  get extraOptionKeys() { return ['flow', 'glow', 'density']; }

  onOptionsChanged(options) {
    if (options.flow !== undefined) this.flow = options.flow;
    if (options.glow !== undefined) this.glow = options.glow;
    if (options.density !== undefined) this.density = options.density;
  }

  onPaletteChanged() {
    this._skyKey = ''; // regenerate sky, stars tint and halo sprite
  }

  // ── Colour helpers ────────────────────────────────────────

  _hexRgb(hex) {
    return {
      r: parseInt(hex.slice(1, 3), 16),
      g: parseInt(hex.slice(3, 5), 16),
      b: parseInt(hex.slice(5, 7), 16)
    };
  }

  /** Sample the palette ramp with a fractional index (0..4), lerped. */
  _rampColor(t, alpha) {
    const ramp = this.palette?.ramp || ['#071019', '#0e3a40', '#16847e', '#52e0c4', '#b79cff'];
    const idx = Math.max(0, Math.min(ramp.length - 1.001, t));
    const i = Math.floor(idx);
    const f = idx - i;
    const a = this._hexRgb(ramp[i]);
    const b = this._hexRgb(ramp[Math.min(i + 1, ramp.length - 1)]);
    const r = Math.round(a.r + (b.r - a.r) * f);
    const g = Math.round(a.g + (b.g - a.g) * f);
    const bl = Math.round(a.b + (b.b - a.b) * f);
    return `rgba(${r}, ${g}, ${bl}, ${alpha})`;
  }

  /** Private seeded PRNG — star field is identical every run, independent
   *  of Math.random call ordering elsewhere. */
  _mulberry(seed) {
    let a = seed >>> 0;
    return () => {
      a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // ── Sky scenography ───────────────────────────────────────

  _ensureSky(w, h) {
    const ramp = this.palette?.ramp || ['#071019', '#0e3a40', '#16847e', '#52e0c4', '#b79cff'];
    const key = `${w}x${h}|${ramp.join('')}`;
    if (key === this._skyKey && this._sky) return;
    this._skyKey = key;

    const dpr = window.devicePixelRatio || 1;
    const sky = document.createElement('canvas');
    sky.width = Math.max(1, Math.round(w * dpr));
    sky.height = Math.max(1, Math.round(h * dpr));
    const sctx = sky.getContext('2d');
    sctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // Deep night: near-black zenith carrying a hint of the palette's
    // darkest stop, settling into that stop toward the horizon
    const deep = this._hexRgb(ramp[0]);
    const grad = sctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, `rgb(${Math.round(deep.r * 0.30)}, ${Math.round(deep.g * 0.30)}, ${Math.round(deep.b * 0.38)})`);
    grad.addColorStop(0.60, `rgb(${Math.round(deep.r * 0.85)}, ${Math.round(deep.g * 0.85)}, ${Math.round(deep.b * 0.90)})`);
    grad.addColorStop(1, `rgb(${deep.r}, ${deep.g}, ${deep.b})`);
    sctx.fillStyle = grad;
    sctx.fillRect(0, 0, w, h);

    // Pin-prick stars — denser high in the sky, all alpha ≤ 0.35.
    // Most are baked; a few are kept aside to breathe live.
    const top = this._hexRgb(ramp[4]);
    const star = {
      r: Math.round(top.r * 0.3 + 255 * 0.7),
      g: Math.round(top.g * 0.3 + 255 * 0.7),
      b: Math.round(top.b * 0.3 + 255 * 0.7)
    };
    this._starRgb = star;
    const rnd = this._mulberry(0x5EEDA17);
    const count = Math.round((w * h) / 20000);
    this._twinklers = [];
    sctx.fillStyle = `rgb(${star.r}, ${star.g}, ${star.b})`;
    for (let i = 0; i < count; i++) {
      const x = rnd() * w;
      const y = rnd() * rnd() * h * 0.94; // thinner toward the horizon
      const r = 0.4 + rnd() * 0.75;
      const a = Math.min(0.35, (0.08 + rnd() * 0.26) * (1 - 0.5 * (y / h)));
      const ph = rnd() * Math.PI * 2;
      if (rnd() < 0.2 && this._twinklers.length < 14) {
        this._twinklers.push({ x, y, r, a, ph });
      } else {
        sctx.globalAlpha = a;
        sctx.beginPath();
        sctx.arc(x, y, r, 0, Math.PI * 2);
        sctx.fill();
      }
    }
    sctx.globalAlpha = 1;

    // Extremely faint horizon glow — the palette's first lit stop
    const lit = this._hexRgb(ramp[1]);
    const hg = sctx.createLinearGradient(0, h * 0.72, 0, h);
    hg.addColorStop(0, `rgba(${lit.r}, ${lit.g}, ${lit.b}, 0)`);
    hg.addColorStop(1, `rgba(${lit.r}, ${lit.g}, ${lit.b}, 0.16)`);
    sctx.fillStyle = hg;
    sctx.fillRect(0, h * 0.72, w, h * 0.28);

    this._sky = sky;
    this._glowSprite = this._makeGlowSprite();
  }

  _makeGlowSprite() {
    const s = 96;
    const c = document.createElement('canvas');
    c.width = c.height = s;
    const g = c.getContext('2d');
    const m = (this.palette?.glow || 'rgba(82, 224, 196, 0.40)').match(/[\d.]+/g) || ['82', '224', '196'];
    const [r, gg, b] = m;
    const grad = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    grad.addColorStop(0, `rgba(${r}, ${gg}, ${b}, 0.40)`);
    grad.addColorStop(0.3, `rgba(${r}, ${gg}, ${b}, 0.15)`);
    grad.addColorStop(0.65, `rgba(${r}, ${gg}, ${b}, 0.045)`);
    grad.addColorStop(1, `rgba(${r}, ${gg}, ${b}, 0)`);
    g.fillStyle = grad;
    g.fillRect(0, 0, s, s);
    return c;
  }

  // ── Curtain accumulation ──────────────────────────────────

  _syncAccumSize() {
    const w = this.canvas.clientWidth || window.innerWidth;
    const h = this.canvas.clientHeight || window.innerHeight;
    const dpr = window.devicePixelRatio || 1;
    const aw = Math.max(1, Math.round(w * dpr));
    const ah = Math.max(1, Math.round(h * dpr));
    if (this.accum.width !== aw || this.accum.height !== ah) {
      this.accum.width = aw;
      this.accum.height = ah;
      this.accumCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
      this._curtains.clear();
    }
  }

  onActiveAircraft(activeAircraft, now) {
    this._syncAccumSize();
    this._checkDayReset();
    const ctx = this.accumCtx;

    // Resuming after time in another mode: the preserved buffer is live
    // art again — wake the composite/dissolve gates
    if (this._lastFrame && now - this._lastFrame > 5000) this._lastLightAt = now;

    // Dissolve: delta-corrected destination-out with fractional debt so the
    // buffer truly reaches zero. ~0.066/s ⇒ a crossing stays readable for
    // roughly half a minute, then breathes out.
    const dt = this._lastFrame ? Math.min((now - this._lastFrame) / 1000, 0.1) : 0.016;
    this._lastFrame = now;
    this._fadeDebt += 0.0009 * dt * 60;
    if (this._fadeDebt >= 1 / 255 && now - this._lastLightAt < 90000) {
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.globalCompositeOperation = 'destination-out';
      ctx.fillStyle = `rgba(0, 0, 0, ${Math.min(this._fadeDebt, 1)})`;
      ctx.fillRect(0, 0, this.accum.width, this.accum.height);
      ctx.restore();
      this._fadeDebt = 0;
    }

    ctx.save();
    // source-over accumulation is self-limiting: repeated stamping converges
    // to the stroke colour, so loitering aircraft glow palette-true instead
    // of blowing out to white (additive 'lighter' had no ceiling)
    ctx.globalCompositeOperation = 'source-over';
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    const strands = Math.max(2, Math.round(4 * this.density));
    const foldHz = (0.55 + 0.75 * this.flow) / 4200; // rad/ms — stately folds

    for (const aircraft of activeAircraft) {
      const id = aircraft.flight?.icao24 || aircraft.callsign || '?';
      let cur = this._curtains.get(id);
      const opacity = aircraft.flight?.opacity ?? 1;

      if (!cur) {
        // Per-aircraft fold phase from a stable id hash (deterministic)
        let hsh = 2166136261;
        for (let i = 0; i < id.length; i++) {
          hsh ^= id.charCodeAt(i);
          hsh = Math.imul(hsh, 16777619);
        }
        cur = {
          x: aircraft.x, y: aircraft.y,
          phase: ((hsh >>> 0) % 1000) / 1000 * Math.PI * 2,
          arc: 0,
          lastStamp: now,
          head: null,
          strands: []
        };
        this._curtains.set(id, cur);
        continue;
      }

      // Velocity gate: still aircraft — and the zero-velocity pixel-guard
      // fixture — lay no light
      if (!(aircraft.velocity > 1)) {
        cur.x = aircraft.x;
        cur.y = aircraft.y;
        continue;
      }

      const dx = aircraft.x - cur.x;
      const dy = aircraft.y - cur.y;
      const dist = Math.hypot(dx, dy);

      if (dist >= 80) { // projection re-lock / teleport: restart the curtain
        cur.x = aircraft.x;
        cur.y = aircraft.y;
        cur.strands.length = 0;
        cur.head = null;
        cur.lastStamp = now;
        continue;
      }

      // Stamp cadence: when the head has travelled, or when the folds have
      // had time to carry the strands sideways (slow aircraft still dance)
      if (dist < 2.5 && now - cur.lastStamp < 300) continue;
      cur.lastStamp = now;
      cur.arc += dist;
      this._lastLightAt = now;

      // Ribbon normal: across the motion, falling back to across the heading
      let nx, ny;
      if (dist > 0.05) {
        nx = -dy / dist;
        ny = dx / dist;
      } else {
        const hr = (aircraft.heading || 0) * Math.PI / 180;
        nx = Math.cos(hr);
        ny = Math.sin(hr);
      }

      // Perceptual altitude curve: most traffic near an airport sits low,
      // so give the band a strong start and let cruisers max it out
      const altT = Math.pow(Math.min(Math.max(aircraft.altitude || 0, 0) / 24000, 1), 0.55);
      const halfW = 9 + 18 * altT;          // cruisers drape grander curtains
      const baseT = 0.7 + 1.5 * altT;       // altitude picks the ramp band
      const tFold = now * foldHz;

      cur.x = aircraft.x;
      cur.y = aircraft.y;

      const g = this.glow * opacity;
      // Curtain-body breathing (arc-keyed so the pulses sit IN the trail)
      const brB = 0.5 + 0.5 * Math.sin(cur.arc * 0.16 + tFold * 0.8 + cur.phase);
      const wMulB = 0.8 + 0.35 * brB;

      // ── Curtain body: two soft band passes along a gently swaying centre
      // line — dark outer skin, brighter interior (the glow lives inside)
      const sway = halfW * 0.25 * Math.sin(tFold * 0.55 + cur.phase * 1.3);
      const cx2 = aircraft.x + nx * sway;
      const cy2 = aircraft.y + ny * sway;
      if (!cur.head) {
        cur.head = { x0: cx2, y0: cy2, x1: cx2, y1: cy2 };
      } else {
        const hch = cur.head;
        const segB = Math.hypot(cx2 - hch.x1, cy2 - hch.y1);
        if (segB >= 0.6) {
          const ax = (hch.x0 + hch.x1) / 2, ay = (hch.y0 + hch.y1) / 2;
          const bx = (hch.x1 + cx2) / 2, by = (hch.y1 + cy2) / 2;
          ctx.beginPath();
          ctx.moveTo(ax, ay);
          ctx.quadraticCurveTo(hch.x1, hch.y1, bx, by);

          // Deposition normalised by segment length: slow and fast aircraft
          // leave the same exposure per pixel
          let lw = 2.3 * halfW * wMulB;
          ctx.lineWidth = lw;
          ctx.strokeStyle = this._rampColor(baseT * 0.7, 0.55 * g * segB / (segB + lw));
          ctx.stroke();

          lw = 1.2 * halfW * wMulB;
          ctx.lineWidth = lw;
          ctx.strokeStyle = this._rampColor(baseT + 0.6 + 0.3 * brB, 0.62 * g * segB / (segB + lw));
          ctx.stroke();

          hch.x0 = hch.x1; hch.y0 = hch.y1;
          hch.x1 = cx2; hch.y1 = cy2;
        }
      }

      // ── Bright filaments: strands weave around each other inside the
      // band on two incommensurate folds, like curtain folds seen edge-on
      for (let i = 0; i < strands; i++) {
        const ph = cur.phase + (i / strands) * Math.PI * 2;
        const off = halfW * (0.72 * Math.sin(tFold + ph) + 0.38 * Math.sin(tFold * 0.43 + ph * 2.6));
        const hx = aircraft.x + nx * off;
        const hy = aircraft.y + ny * off;

        let s = cur.strands[i];
        if (!s) {
          cur.strands[i] = { x0: hx, y0: hy, x1: hx, y1: hy };
          continue;
        }

        const seglen = Math.hypot(hx - s.x1, hy - s.y1);
        if (seglen < 0.6) continue; // sub-pixel deposit would quantise away

        // C1-continuous filament: quadratic through chain midpoints
        const ax = (s.x0 + s.x1) / 2, ay = (s.y0 + s.y1) / 2;
        const bx = (s.x1 + hx) / 2, by = (s.y1 + hy) / 2;

        // Luminance breathes along the strand, phase-offset per strand
        const br = 0.5 + 0.5 * Math.sin(cur.arc * 0.16 + tFold * 0.8 + ph * 2.2);

        ctx.beginPath();
        ctx.moveTo(ax, ay);
        ctx.quadraticCurveTo(s.x1, s.y1, bx, by);

        let lw = (3.4 + 2.6 * altT) * (0.75 + 0.5 * br);
        ctx.lineWidth = lw;
        ctx.strokeStyle = this._rampColor(baseT + 1.0 + 0.4 * br, (0.20 + 0.10 * br) * g * seglen / (seglen + lw));
        ctx.stroke();

        lw = 1.6 + 1.0 * br;
        ctx.lineWidth = lw;
        ctx.strokeStyle = this._rampColor(baseT + 1.8 + 0.5 * br, (0.28 + 0.16 * br) * g * seglen / (seglen + lw));
        ctx.stroke();

        s.x0 = s.x1; s.y0 = s.y1;
        s.x1 = hx; s.y1 = hy;
      }
    }

    ctx.restore();

    // GC stale curtains (no removal callback — detect absence)
    if (this._curtains.size > activeAircraft.length + 20) {
      const live = new Set(activeAircraft.map(a => a.flight?.icao24 || a.callsign || '?'));
      for (const k of this._curtains.keys()) {
        if (!live.has(k)) this._curtains.delete(k);
      }
    }
  }

  // ── Composition ───────────────────────────────────────────

  draw() {
    const w = this.canvas.clientWidth || window.innerWidth;
    const h = this.canvas.clientHeight || window.innerHeight;
    const ctx = this.ctx;

    this._ensureSky(w, h);

    // Deep night base (prerendered gradient + stars + horizon glow);
    // a user background glows softly between the night and the curtains
    ctx.drawImage(this._sky, 0, 0, w, h);
    this.drawBackgroundImage(0.45);

    // A few stars breathe, very slowly (held still under the fixture)
    const det = window.__DETERMINISTIC__;
    const tNow = Date.now();
    const sc = this._starRgb;
    ctx.fillStyle = `rgb(${sc.r}, ${sc.g}, ${sc.b})`;
    for (const st of this._twinklers) {
      ctx.globalAlpha = det ? st.a : st.a * (0.62 + 0.38 * Math.sin(tNow / 2600 + st.ph));
      ctx.beginPath();
      ctx.arc(st.x, st.y, st.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // The curtains — screened over the sky so the light blooms without
    // blowing out. Skipped once the buffer has fully dissolved (quiet
    // nights and the zero-velocity fixture render sky + glints only).
    if (tNow - this._lastLightAt < 90000) {
      ctx.save();
      ctx.globalCompositeOperation = 'screen';
      ctx.drawImage(this.accum, 0, 0, w, h);
      ctx.restore();
    }

    // Soft auroral halo beneath each aircraft glint
    if (this._glowSprite) {
      ctx.save();
      ctx.globalCompositeOperation = 'screen';
      for (const [, aircraft] of this.aircraftPositions.entries()) {
        const isOnGround = aircraft.altitude <= 0;
        if (isOnGround ? !this.options.showGroundAircraft : !this.options.showAirborneAircraft) continue;
        const opacity = aircraft.flight?.opacity ?? 1;
        const altT = Math.min(Math.max(aircraft.altitude || 0, 0) / 38000, 1);
        let d = (34 + 30 * altT) * (this.options.aircraftScale || 1);
        // Gentle breath in motion only (fixture aircraft hold exact size)
        if (aircraft.velocity > 50) d *= 1 + 0.07 * Math.sin(tNow / 520 + aircraft.x * 0.03);
        ctx.globalAlpha = opacity * (0.5 + 0.3 * this.glow);
        ctx.drawImage(this._glowSprite, aircraft.x - d / 2, aircraft.y - d / 2, d, d);
      }
      ctx.restore();
      ctx.globalAlpha = 1;
    }

    // Icons / trails / labels per the user's Look
    super.draw();
  }

  /**
   * Mode switch: keep the day's light. Only aircraft tracking and strand
   * chains reset (stale chains would draw teleport filaments on re-entry);
   * the accumulation buffer carries today's artwork across modes and only
   * resets on day rollover (_checkDayReset).
   */
  clear() {
    super.clear();
    this._curtains.clear();
  }

  _checkDayReset() {
    const today = new Date().toDateString();
    if (this._day && this._day !== today) {
      this.accumCtx.save();
      this.accumCtx.setTransform(1, 0, 0, 1, 0, 0);
      this.accumCtx.clearRect(0, 0, this.accum.width, this.accum.height);
      this.accumCtx.restore();
      this._lastLightAt = 0;
    }
    this._day = today;
  }
}
