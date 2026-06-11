/**
 * Ink — sumi-e brushwork on paper.
 *
 * The one bright mode: aircraft are calligraphy brushes on warm paper.
 * Slow, low aircraft pool wide soft strokes; fast cruisers cut thin, dry
 * lines. Strokes accumulate like a day's painting and wash out slowly.
 * Ink is near-monochrome (the palette's deepest stop); the palette primary
 * appears only as a quiet accent on the leading brush tip.
 *
 * Deterministic fixture (zero velocity): a single brush press per aircraft,
 * stable for the pixel guard.
 */

class InkVisualization extends AircraftVisualization {
  constructor(canvas, ctx) {
    super(canvas, ctx);

    this.ease = 0.10;
    this.trailThreshold = 0;

    // Mode knobs (settings.js modeSettings.ink)
    this.strokeWeight = 1.0;
    this.wash = 1.0; // fade speed multiplier

    // Paper texture (generated once) + ink accumulation buffer
    this.paper = null;
    this.accum = document.createElement('canvas');
    this.accumCtx = this.accum.getContext('2d');
    this._fadeDebt = 0;
    this._last = new Map();
    this._pressed = new Set(); // fixture-safe single brush press per id
  }

  get extraOptionKeys() { return ['strokeWeight', 'wash']; }

  onOptionsChanged(options) {
    if (options.strokeWeight !== undefined) this.strokeWeight = options.strokeWeight;
    if (options.wash !== undefined) this.wash = options.wash;
  }

  _inkColor(alpha) {
    // Deep ink from the darkest ramp stop, enriched toward true black
    const c = this.palette?.ramp?.[0] || '#0a0c10';
    const r = Math.round(parseInt(c.slice(1, 3), 16) * 0.5);
    const g = Math.round(parseInt(c.slice(3, 5), 16) * 0.5);
    const b = Math.round(parseInt(c.slice(5, 7), 16) * 0.5);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  _makePaper(w, h) {
    const paper = document.createElement('canvas');
    paper.width = w; paper.height = h;
    const pctx = paper.getContext('2d');
    // Warm washi base with a soft vignette
    pctx.fillStyle = '#ece4d2';
    pctx.fillRect(0, 0, w, h);
    const vg = pctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.3, w / 2, h / 2, Math.max(w, h) * 0.75);
    vg.addColorStop(0, 'rgba(255, 252, 242, 0.35)');
    vg.addColorStop(1, 'rgba(120, 105, 80, 0.18)');
    pctx.fillStyle = vg;
    pctx.fillRect(0, 0, w, h);
    // Fibre flecks (seeded Math.random under ?deterministic=1)
    pctx.fillStyle = 'rgba(120, 100, 70, 0.05)';
    const flecks = Math.round((w * h) / 4000);
    for (let i = 0; i < flecks; i++) {
      const x = Math.random() * w, y = Math.random() * h;
      const len = 1 + Math.random() * 3;
      pctx.fillRect(x, y, len, 0.8);
    }
    return paper;
  }

  _syncSize() {
    const w = this.canvas.clientWidth || window.innerWidth;
    const h = this.canvas.clientHeight || window.innerHeight;
    const dpr = window.devicePixelRatio || 1;
    const dw = Math.round(w * dpr), dh = Math.round(h * dpr);
    if (this.accum.width !== dw || this.accum.height !== dh) {
      this.accum.width = dw;
      this.accum.height = dh;
      this.accumCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
      this.paper = this._makePaper(w, h);
      this._pressed.clear();
    }
  }

  onActiveAircraft(activeAircraft, now) {
    this._syncSize();
    const ctx = this.accumCtx;

    // Slow wash: ink lifts off the paper over ~tens of minutes
    const dt = this._lastFrame ? Math.min((now - this._lastFrame) / 1000, 0.1) : 0.016;
    this._lastFrame = now;
    this._fadeDebt += 0.0012 * this.wash * dt * 60;
    if (this._fadeDebt >= 1 / 255) {
      ctx.save();
      ctx.globalCompositeOperation = 'destination-out';
      ctx.fillStyle = `rgba(0, 0, 0, ${this._fadeDebt})`;
      ctx.fillRect(0, 0, this.accum.width, this.accum.height);
      ctx.restore();
      this._fadeDebt = 0;
    }

    ctx.save();
    ctx.lineCap = 'round';

    for (const aircraft of activeAircraft) {
      const id = aircraft.flight?.icao24 || aircraft.callsign;
      const prev = this._last.get(id);
      const opacity = aircraft.flight?.opacity ?? 1;
      const speed = aircraft.velocity || 0;

      if (!prev) {
        this._last.set(id, { x: aircraft.x, y: aircraft.y });
        // Brush press: the first touch leaves a soft pooled dot (also the
        // only mark under the zero-velocity fixture — deterministic)
        if (!this._pressed.has(id)) {
          this._pressed.add(id);
          ctx.fillStyle = this._inkColor(0.30 * opacity);
          ctx.beginPath();
          ctx.arc(aircraft.x, aircraft.y, 3.2 * this.strokeWeight, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = this._inkColor(0.12 * opacity);
          ctx.beginPath();
          ctx.arc(aircraft.x, aircraft.y, 6.5 * this.strokeWeight, 0, Math.PI * 2);
          ctx.fill();
        }
        continue;
      }

      const dx = aircraft.x - prev.x;
      const dy = aircraft.y - prev.y;
      const dist = Math.hypot(dx, dy);

      if (dist > 0.4 && dist < 80) {
        // Brush physics: slow = wide wet stroke, fast = thin dry cut
        const speedT = Math.min(speed / 480, 1);
        const width = (4.2 - 3.2 * speedT) * this.strokeWeight;
        const alpha = (0.16 - 0.09 * speedT) * opacity;

        // Main stroke
        ctx.strokeStyle = this._inkColor(alpha);
        ctx.lineWidth = width;
        ctx.beginPath();
        ctx.moveTo(prev.x, prev.y);
        ctx.lineTo(aircraft.x, aircraft.y);
        ctx.stroke();

        // Dry-brush bristles: two offset hairlines, fading with speed
        const px = -dy / dist, py = dx / dist;
        ctx.strokeStyle = this._inkColor(alpha * 0.5);
        ctx.lineWidth = 0.6;
        for (const o of [width * 0.7, -width * 0.7]) {
          ctx.beginPath();
          ctx.moveTo(prev.x + px * o, prev.y + py * o);
          ctx.lineTo(aircraft.x + px * o, aircraft.y + py * o);
          ctx.stroke();
        }

        prev.x = aircraft.x;
        prev.y = aircraft.y;
      } else if (dist >= 80) {
        prev.x = aircraft.x;
        prev.y = aircraft.y;
      }
    }

    ctx.restore();

    // GC stale ids
    if (this._last.size > activeAircraft.length + 20) {
      const liveIds = new Set(activeAircraft.map(a => a.flight?.icao24 || a.callsign));
      for (const id of this._last.keys()) {
        if (!liveIds.has(id)) { this._last.delete(id); this._pressed.delete(id); }
      }
    }
  }

  draw() {
    const w = this.canvas.clientWidth || window.innerWidth;
    const h = this.canvas.clientHeight || window.innerHeight;
    const ctx = this.ctx;

    this._syncSize();
    if (this.paper) ctx.drawImage(this.paper, 0, 0, w, h);

    // Ink sits ON the paper — multiply keeps the fibre showing through
    ctx.save();
    ctx.globalCompositeOperation = 'multiply';
    ctx.drawImage(this.accum, 0, 0, w, h);
    ctx.restore();

    // Leading brush tips: quiet accent from the palette
    const accent = this.palette?.primary || '#52e0c4';
    for (const [, aircraft] of this.aircraftPositions.entries()) {
      const isOnGround = aircraft.altitude <= 0;
      if (isOnGround && !this.options.showGroundAircraft) continue;
      const opacity = aircraft.flight?.opacity ?? 1;
      ctx.fillStyle = this._inkColor(0.85 * opacity);
      ctx.beginPath();
      ctx.arc(aircraft.x, aircraft.y, 2.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = accent;
      ctx.globalAlpha = 0.35 * opacity;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(aircraft.x, aircraft.y, 4.5, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    // Labels only (icons replaced by brush tips above)
    const savedIcon = this.options.aircraftIcon;
    this.options.aircraftIcon = 'none';
    super.draw();
    this.options.aircraftIcon = savedIcon;
  }

  clear() {
    super.clear();
    this._last.clear();
    this._pressed.clear();
    this.accumCtx.clearRect(0, 0, this.accum.width, this.accum.height);
  }
}
