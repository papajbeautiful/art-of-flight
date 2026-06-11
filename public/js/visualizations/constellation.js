/**
 * Wave Mode: an invisible line field, made visible by passing aircraft
 *
 * A field of horizontal lines rests in the dark at whisper alpha. Aircraft
 * push through it: a smooth-bump kernel (liquid lens, not a tent) displaces
 * the field, shaped by heading into a bow-wake — compressed ahead of the
 * aircraft, drawn out behind — so a fast jet carves a visibly different
 * wake from a slow turboprop. Where the field bends it ignites: displaced
 * runs brighten from the palette's quiet secondary through primary toward
 * white at maximum bend. Springs are damped, so the field settles glassily
 * instead of jittering (the old undamped spring was the reason the pixel
 * guard needed a tolerance).
 *
 * Lineage: after a line-distortion study by BL/S® Studio (MIT) —
 * https://codepen.io/blacklead-studio/pen/azOzePJ — rebuilt for flight.
 */
class ConstellationVisualization extends AircraftVisualization {
  constructor(canvas, ctx) {
    super(canvas, ctx);
    this.waveLayer = document.getElementById('waveLayer');
    this.waveCanvas = document.getElementById('waveCanvas');
    this.waveCtx = null;
    this.lines = [];
    this.initialized = false;
    this.active = false;
    this.animFrame = null;

    Object.assign(this.options, {
      lineCount: 200,
      distortRadius: 120,
      distortStrength: 15
    });
  }

  get extraOptionKeys() {
    return ['lineCount', 'distortRadius', 'distortStrength'];
  }

  onOptionsChanged(options) {
    if (options.lineCount !== undefined && this.initialized) this.initLines();
  }

  isActive() { return this.active; }

  show() {
    if (this.waveLayer) this.waveLayer.style.display = 'block';
    this.active = true;

    if (!this.initialized) {
      this.initWaveCanvas();
    }
    this.startAnimation();
  }

  hide() {
    if (this.waveLayer) this.waveLayer.style.display = 'none';
    this.active = false;
    this.stopAnimation();
  }

  initWaveCanvas() {
    if (!this.waveCanvas) return;

    this.waveCtx = this.waveCanvas.getContext('2d');
    this.resizeWave();
    this.initLines();
    this.initialized = true;

    this._resizeHandler = () => {
      if (this.active) {
        this.resizeWave();
        this.initLines();
      }
    };
    window.addEventListener('resize', this._resizeHandler);
  }

  resizeWave() {
    if (!this.waveCanvas) return;
    const dpr = window.devicePixelRatio || 1;
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.waveCanvas.width = w * dpr;
    this.waveCanvas.height = h * dpr;
    this.waveCanvas.style.width = w + 'px';
    this.waveCanvas.style.height = h + 'px';
    if (this.waveCtx) {
      this.waveCtx.setTransform(1, 0, 0, 1, 0, 0);
      this.waveCtx.scale(dpr, dpr);
    }
  }

  initLines() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const linesCount = this.options.lineCount;
    const lineHeight = h / linesCount;
    const cellWidth = 5;
    const cols = Math.floor(w / cellWidth);

    this.lines = [];
    for (let i = 0; i < linesCount; i++) {
      const y = i * lineHeight;
      const line = [];

      for (let j = 0; j < cols; j++) {
        const x = j * cellWidth;
        line.push({ x, y, baseX: x, baseY: y, vx: 0, vy: 0 });
      }
      this.lines.push(line);
    }
  }

  updateLines() {
    const radius = this.options.distortRadius;
    const maxSpeed = this.options.distortStrength;

    // Damped spring constants: near-critical damping settles the field
    // glassily — no resting jitter
    const K = 0.06;
    const DAMP = 0.78;

    // Collect active aircraft with heading unit vectors (screen space)
    const positions = [];
    for (const [, aircraft] of this.aircraftPositions.entries()) {
      if (aircraft.altitude <= 0 && !this.options.showGroundAircraft) continue;
      const ha = ((aircraft.heading || 0) - 90) * Math.PI / 180;
      // Bow-wake asymmetry grows with speed
      const speedT = Math.min((aircraft.velocity || 0) / 480, 1);
      positions.push({
        x: aircraft.x, y: aircraft.y,
        hx: Math.cos(ha), hy: Math.sin(ha),
        ahead: 1 + 0.8 * speedT,    // compresses the field's reach ahead
        behind: 1 - 0.45 * speedT,  // elongates it behind
        speed: maxSpeed * (1 + (aircraft.velocity || 0) / 500)
      });
    }

    // Hot loop: lines x cols x aircraft. Cheap box-reject before the sqrt.
    // The wake reach can exceed `radius` behind the aircraft, so the reject
    // box uses the worst-case stretch.
    const rejectR = radius * 1.8;
    const radiusSq = radius * radius;

    this.lines.forEach(line => {
      line.forEach(point => {
        for (const pos of positions) {
          const dx = point.x - pos.x;
          if (dx > rejectR || dx < -rejectR) continue;
          const dy = point.y - pos.y;
          if (dy > rejectR || dy < -rejectR) continue;

          // Bow-wake warp: scale the longitudinal component so the kernel
          // reaches further behind the aircraft than ahead of it
          const L = dx * pos.hx + dy * pos.hy;            // along heading
          const T = -dx * pos.hy + dy * pos.hx;           // across heading
          const Lw = L * (L > 0 ? pos.ahead : pos.behind);
          const distSq = Lw * Lw + T * T;
          if (distSq >= radiusSq) continue;

          const distance = Math.sqrt(distSq);
          // Smooth bump (1-t²)² — a liquid lens, not a tent
          const t = distance / radius;
          const k = (1 - t * t);
          const force = k * k;
          const realDist = Math.sqrt(dx * dx + dy * dy) || 1;
          const scale = (force * pos.speed) / realDist;

          point.vx += dx * scale * 0.35;
          point.vy += dy * scale * 0.35;
        }

        // Damped spring return
        point.vx = (point.vx + (point.baseX - point.x) * K) * DAMP;
        point.vy = (point.vy + (point.baseY - point.y) * K) * DAMP;
        point.x += point.vx;
        point.y += point.vy;
      });
    });
  }

  drawLines() {
    if (!this.waveCtx) return;

    const ctx = this.waveCtx;
    const w = window.innerWidth;
    const h = window.innerHeight;
    const n = this.lines.length;

    const quiet = this.palette?.secondary || '#5f7d9c';
    const lead = this.palette?.primary || '#52e0c4';
    const q = hexToRgbIcon(quiet);
    const p = hexToRgbIcon(lead);

    ctx.clearRect(0, 0, w, h);
    ctx.lineWidth = 0.9;

    // Ignited runs are batched into alpha/colour buckets so the per-frame
    // stroke count stays tiny regardless of how much field is bent
    const buckets = [
      { min: 2, max: 6, path: new Path2D(), style: `rgba(${q.r + ((p.r - q.r) * 0.5) | 0}, ${q.g + ((p.g - q.g) * 0.5) | 0}, ${q.b + ((p.b - q.b) * 0.5) | 0}, 0.45)` },
      { min: 6, max: 14, path: new Path2D(), style: `rgba(${p.r}, ${p.g}, ${p.b}, 0.65)` },
      { min: 14, max: 1e9, path: new Path2D(), style: `rgba(${Math.min(255, p.r + 120)}, ${Math.min(255, p.g + 120)}, ${Math.min(255, p.b + 120)}, 0.9)` }
    ];

    this.lines.forEach((line, li) => {
      if (line.length < 2) return;

      // Depth profile: mid-field rests lighter than the edges
      const depth = Math.sin((li / (n - 1)) * Math.PI);
      const restAlpha = 0.10 + 0.10 * depth;

      ctx.beginPath();
      ctx.moveTo(line[0].x, line[0].y);
      for (let i = 1; i < line.length; i++) {
        const prev = line[i - 1];
        const current = line[i];
        const midX = (prev.x + current.x) / 2;
        const midY = (prev.y + current.y) / 2;
        ctx.quadraticCurveTo(prev.x, prev.y, midX, midY);
      }
      ctx.strokeStyle = `rgba(${q.r}, ${q.g}, ${q.b}, ${restAlpha})`;
      ctx.stroke();

      // Collect ignited runs into the shared bucket paths
      for (let i = 1; i < line.length; i++) {
        const pt = line[i];
        const ddx = pt.x - pt.baseX;
        const ddy = pt.y - pt.baseY;
        const disp = Math.sqrt(ddx * ddx + ddy * ddy);
        if (disp < 2) continue;
        const bucket = buckets.find(b => disp >= b.min && disp < b.max);
        if (!bucket) continue;
        const prev = line[i - 1];
        bucket.path.moveTo(prev.x, prev.y);
        bucket.path.lineTo(pt.x, pt.y);
      }
    });

    for (const b of buckets) {
      ctx.strokeStyle = b.style;
      ctx.stroke(b.path);
    }

    // The aircraft live IN the field: a bright knot at each distortion
    // centre, drawn additively on the wave canvas itself
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const [, aircraft] of this.aircraftPositions.entries()) {
      if (aircraft.altitude <= 0 && !this.options.showGroundAircraft) continue;
      const fade = aircraft.flight?.opacity ?? 1;
      const knot = ctx.createRadialGradient(aircraft.x, aircraft.y, 0, aircraft.x, aircraft.y, 14);
      knot.addColorStop(0, `rgba(255, 255, 255, ${0.7 * fade})`);
      knot.addColorStop(0.25, `rgba(${p.r}, ${p.g}, ${p.b}, ${0.5 * fade})`);
      knot.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = knot;
      ctx.beginPath();
      ctx.arc(aircraft.x, aircraft.y, 14, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  startAnimation() {
    if (this.animFrame) return;
    const animate = () => {
      this.updateLines();
      this.drawLines();
      this.animFrame = requestAnimationFrame(animate);
    };
    this.animFrame = requestAnimationFrame(animate);
  }

  stopAnimation() {
    if (this.animFrame) {
      cancelAnimationFrame(this.animFrame);
      this.animFrame = null;
    }
  }

  clear() {
    super.clear();
    this.lines = [];
    this.hide();
  }
}
