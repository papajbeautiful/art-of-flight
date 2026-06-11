/**
 * Aurora — luminous ribbons trail each aircraft.
 *
 * Each aircraft drags a band of flowing strands through the night; the
 * strands oscillate around the true track like curtains of light, are
 * stamped into an offscreen accumulation buffer with additive blending,
 * and dissolve slowly. Colour comes from the palette ramp: altitude picks
 * the base stop, each strand drifts a step brighter.
 *
 * Deterministic fixture (zero velocity): no segments are laid, leaving the
 * sky gradient + soft glints — stable for the pixel guard.
 */

class AuroraVisualization extends AircraftVisualization {
  constructor(canvas, ctx) {
    super(canvas, ctx);

    this.ease = 0.10;
    this.trailThreshold = 0; // we sample our own motion

    // Mode knobs (settings.js modeSettings.aurora)
    this.flow = 1.0;     // oscillation energy
    this.glow = 1.0;     // stroke intensity
    this.density = 1.0;  // strand count multiplier

    // Offscreen accumulation buffer (device pixels, drawn in CSS px)
    this.accum = document.createElement('canvas');
    this.accumCtx = this.accum.getContext('2d');
    this._fadeDebt = 0; // fractional erase accumulator (8-bit safe)

    // Per-aircraft previous positions + phase offsets
    this._last = new Map();
  }

  get extraOptionKeys() { return ['flow', 'glow', 'density']; }

  onOptionsChanged(options) {
    if (options.flow !== undefined) this.flow = options.flow;
    if (options.glow !== undefined) this.glow = options.glow;
    if (options.density !== undefined) this.density = options.density;
  }

  _syncAccumSize() {
    const dpr = window.devicePixelRatio || 1;
    const w = Math.round((this.canvas.clientWidth || window.innerWidth) * dpr);
    const h = Math.round((this.canvas.clientHeight || window.innerHeight) * dpr);
    if (this.accum.width !== w || this.accum.height !== h) {
      this.accum.width = w;
      this.accum.height = h;
      this.accumCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
  }

  /** Sample the palette ramp with a fractional index (0..4), lerped. */
  _rampColor(t, alpha) {
    const ramp = this.palette?.ramp || ['#071019', '#0e3a40', '#16847e', '#52e0c4', '#b79cff'];
    const idx = Math.max(0, Math.min(ramp.length - 1.001, t));
    const i = Math.floor(idx);
    const f = idx - i;
    const a = ramp[i], b = ramp[Math.min(i + 1, ramp.length - 1)];
    const pr = parseInt(a.slice(1, 3), 16), pg = parseInt(a.slice(3, 5), 16), pb = parseInt(a.slice(5, 7), 16);
    const qr = parseInt(b.slice(1, 3), 16), qg = parseInt(b.slice(3, 5), 16), qb = parseInt(b.slice(5, 7), 16);
    const r = Math.round(pr + (qr - pr) * f);
    const g = Math.round(pg + (qg - pg) * f);
    const bl = Math.round(pb + (qb - pb) * f);
    return `rgba(${r}, ${g}, ${bl}, ${alpha})`;
  }

  onActiveAircraft(activeAircraft, now) {
    this._syncAccumSize();
    const ctx = this.accumCtx;

    // Dissolve: delta-corrected destination-out with fractional debt so the
    // buffer actually reaches zero (8-bit quantisation guard)
    const dt = this._lastFrame ? Math.min((now - this._lastFrame) / 1000, 0.1) : 0.016;
    this._lastFrame = now;
    this._fadeDebt += 0.025 * dt * 60;
    if (this._fadeDebt >= 1 / 255) {
      ctx.save();
      ctx.globalCompositeOperation = 'destination-out';
      ctx.fillStyle = `rgba(0, 0, 0, ${this._fadeDebt})`;
      ctx.fillRect(0, 0, this.accum.width, this.accum.height);
      ctx.restore();
      this._fadeDebt = 0;
    }

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineCap = 'round';

    const strands = Math.max(1, Math.round(3 * this.density));

    for (const aircraft of activeAircraft) {
      const id = aircraft.callsign + (aircraft.flight?.icao24 || '');
      const prev = this._last.get(id);
      const opacity = aircraft.flight?.opacity ?? 1;

      if (prev) {
        const dx = aircraft.x - prev.x;
        const dy = aircraft.y - prev.y;
        const dist = Math.hypot(dx, dy);

        if (dist > 0.4 && dist < 80) {
          // Perpendicular unit vector for strand offsets
          const px = -dy / dist, py = dx / dist;
          // Altitude → ramp position (low = deep stops, cruise = bright)
          const altT = Math.min((aircraft.altitude || 0) / 38000, 1);

          for (let sIdx = 0; sIdx < strands; sIdx++) {
            const phase = prev.phase + sIdx * 2.1;
            const wave = Math.sin(now / (900 - 300 * this.flow) + phase);
            const wave2 = Math.sin(now / 2300 + phase * 1.7);
            const offset = (sIdx - (strands - 1) / 2) * 7 + wave * 9 * this.flow + wave2 * 4;

            const x1 = prev.x + px * prev.offset?.[sIdx] || prev.x + px * offset;
            const y1 = prev.y + py * (prev.offset?.[sIdx] ?? offset);
            const x2 = aircraft.x + px * offset;
            const y2 = aircraft.y + py * offset;

            const t = 1 + altT * 2 + sIdx * 0.45;
            // Wide soft pass + narrow core
            ctx.strokeStyle = this._rampColor(t, 0.045 * this.glow * opacity);
            ctx.lineWidth = 7;
            ctx.beginPath();
            ctx.moveTo(x1, y1);
            ctx.lineTo(x2, y2);
            ctx.stroke();

            ctx.strokeStyle = this._rampColor(t + 0.6, 0.12 * this.glow * opacity);
            ctx.lineWidth = 1.6;
            ctx.beginPath();
            ctx.moveTo(x1, y1);
            ctx.lineTo(x2, y2);
            ctx.stroke();

            if (!prev.offset) prev.offset = [];
            prev.offset[sIdx] = offset;
          }
        }
        prev.x = aircraft.x;
        prev.y = aircraft.y;
      } else {
        this._last.set(id, { x: aircraft.x, y: aircraft.y, phase: (aircraft.x + aircraft.y) * 0.01, offset: null });
      }
    }

    ctx.restore();

    // GC stale entries (no removal callback — detect absence)
    if (this._last.size > activeAircraft.length + 20) {
      const liveIds = new Set(activeAircraft.map(a => a.callsign + (a.flight?.icao24 || '')));
      for (const id of this._last.keys()) {
        if (!liveIds.has(id)) this._last.delete(id);
      }
    }
  }

  draw() {
    const w = this.canvas.clientWidth || window.innerWidth;
    const h = this.canvas.clientHeight || window.innerHeight;
    const ctx = this.ctx;

    // Night-sky base: vertical gradient from the palette's deepest stop
    const ramp = this.palette?.ramp || ['#071019'];
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, '#010204');
    grad.addColorStop(0.65, ramp[0]);
    grad.addColorStop(1, '#010204');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    // Composite the accumulated ribbons
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    ctx.drawImage(this.accum, 0, 0, w, h);
    ctx.restore();

    // Soft glints at each aircraft head + base-class labels
    super.draw();
  }

  clear() {
    super.clear();
    this._last.clear();
    this.accumCtx.clearRect(0, 0, this.accum.width, this.accum.height);
  }
}
