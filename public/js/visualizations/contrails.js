/**
 * Contrails Mode: long-exposure sky photography
 *
 * Aircraft lay down luminous vapor trails on a time-of-day sky gradient.
 * Trails accumulate on an offscreen canvas and slowly dissolve, like a
 * long-exposure photograph that keeps developing.
 */
class ContrailsVisualization extends AircraftVisualization {
  constructor(canvas, ctx) {
    super(canvas, ctx);

    // Last laid-down point per aircraft, so segments connect
    // (must exist before _syncAccumSize clears it)
    this.lastPoints = new Map();

    // Accumulation canvas (device-pixel backing, CSS-pixel drawing — same
    // convention as patterns)
    this.accumCanvas = document.createElement('canvas');
    this.accumCtx = this.accumCanvas.getContext('2d');
    this._syncAccumSize();

    Object.assign(this.options, {
      skyMode: 'auto',        // auto | night | dusk | day | dawn
      trailWidth: 2.0,
      trailGlow: 1.0,
      dissolveMinutes: 4,     // ~time for a trail to fade to nothing
      showLeadingGlow: true,
      // The leading glint IS the aircraft in this mode; base icons off
      showAirborneAircraft: false,
      accentColor: '#FFE8C8'
    });

    this._resizeHandler = () => this._syncAccumSize();
    window.addEventListener('resize', this._resizeHandler);
  }

  get extraOptionKeys() {
    return ['skyMode', 'trailWidth', 'trailGlow', 'dissolveMinutes', 'showLeadingGlow'];
  }

  _syncAccumSize() {
    this.accumCanvas.width = this.canvas.width;
    this.accumCanvas.height = this.canvas.height;
    const dpr = window.devicePixelRatio || 1;
    this.accumCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.lastPoints.clear();
  }

  /** Current sky period (pinned in deterministic runs) */
  skyPeriod() {
    const mode = this.options.skyMode;
    if (mode && mode !== 'auto') return mode;
    if (window.__DETERMINISTIC__) return 'night';
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 8) return 'dawn';
    if (hour >= 8 && hour < 17) return 'day';
    if (hour >= 17 && hour < 20) return 'dusk';
    return 'night';
  }

  /** Sky gradients + trail tint per period */
  static SKY = {
    night: { stops: [[0, '#03040c'], [0.55, '#0a1226'], [1, '#16233f']], trail: '#cfe4ff', leading: '#ffffff' },
    dawn:  { stops: [[0, '#1a2340'], [0.5, '#5c3a55'], [0.82, '#c96f4a'], [1, '#f0b46a']], trail: '#ffd9b0', leading: '#fff3e0' },
    day:   { stops: [[0, '#3d7ab8'], [0.6, '#7fb2dd'], [1, '#cfe5f4']], trail: '#ffffff', leading: '#ffffff' },
    dusk:  { stops: [[0, '#0d0a20'], [0.45, '#3b1e4e'], [0.8, '#94405c'], [1, '#e08850']], trail: '#ffc8d8', leading: '#fff0f4' }
  };

  /** Lay down trail segments into the accumulation buffer */
  onActiveAircraft(activeAircraft, now) {
    // The main canvas is sized after construction — keep the accumulation
    // buffer in sync (same guard patterns uses)
    if (this.accumCanvas.width !== this.canvas.width ||
        this.accumCanvas.height !== this.canvas.height) {
      this._syncAccumSize();
    }

    const sky = ContrailsVisualization.SKY[this.skyPeriod()];
    const g = this.accumCtx;
    const seen = new Set();

    for (const aircraft of activeAircraft) {
      seen.add(aircraft.flight?.icao24 || aircraft.callsign);
      const key = aircraft.flight?.icao24 || aircraft.callsign;
      const prev = this.lastPoints.get(key);
      const opacity = aircraft.flight?.opacity ?? 1;

      if (prev) {
        const dx = aircraft.x - prev.x;
        const dy = aircraft.y - prev.y;
        const dist = dx * dx + dy * dy;
        if (dist > 1) {
          // Altitude shapes the trail: high = thin bright cirrus streak,
          // low = soft wide plume
          const altT = Math.min((aircraft.altitude || 0) / 38000, 1);
          const w = this.options.trailWidth * (1.8 - altT);
          const glow = this.options.trailGlow;

          g.lineCap = 'round';
          g.strokeStyle = aircraft.color !== this.options.accentColor ? aircraft.color : sky.trail;
          // Soft halo + bright core. Unlike patterns (which builds luminosity
          // from hours of overlap), each segment is laid once — it must be
          // visible on its own; the dissolve handles the fade-out.
          const passes = [
            { width: w * 6, alpha: 0.05 * glow * opacity },
            { width: w * 2.4, alpha: 0.16 * glow * opacity },
            { width: w * 0.9, alpha: 0.55 * glow * opacity }
          ];
          for (const pass of passes) {
            g.globalAlpha = pass.alpha;
            g.lineWidth = pass.width;
            g.beginPath();
            g.moveTo(prev.x, prev.y);
            g.lineTo(aircraft.x, aircraft.y);
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

    // Slow dissolve: erase a whisper of the accumulation each frame.
    // dissolveMinutes ≈ time to fade to ~2%.
    const framesToFade = Math.max(1, this.options.dissolveMinutes * 60 * 60);
    g.globalCompositeOperation = 'destination-out';
    g.globalAlpha = 4 / framesToFade;
    g.fillRect(0, 0, this.canvas.clientWidth || this.canvas.width, this.canvas.clientHeight || this.canvas.height);
    g.globalCompositeOperation = 'source-over';
    g.globalAlpha = 1;
  }

  draw() {
    const w = this.canvas.clientWidth || this.canvas.width;
    const h = this.canvas.clientHeight || this.canvas.height;
    const sky = ContrailsVisualization.SKY[this.skyPeriod()];

    // Sky
    const grad = this.ctx.createLinearGradient(0, 0, 0, h);
    for (const [stop, color] of sky.stops) grad.addColorStop(stop, color);
    this.ctx.fillStyle = grad;
    this.ctx.fillRect(0, 0, w, h);

    // Accumulated contrails
    this.ctx.globalCompositeOperation = 'screen';
    this.ctx.drawImage(this.accumCanvas, 0, 0, w, h);
    this.ctx.globalCompositeOperation = 'source-over';

    // Leading glints + (optional) base icons/labels
    if (this.options.showLeadingGlow) {
      for (const [id, aircraft] of this.aircraftPositions.entries()) {
        const isOnGround = aircraft.altitude <= 0;
        if (isOnGround && !this.options.showGroundAircraft) continue;
        const opacity = aircraft.flight?.opacity ?? 1;
        drawAircraftIcon(this.ctx, aircraft.x, aircraft.y, aircraft.heading,
          sky.leading, 'glow', this.options.aircraftScale, 6, opacity * 0.9);
      }
    }

    super.draw();
  }

  clear() {
    super.clear();
    this.lastPoints.clear();
    this.accumCtx.save();
    this.accumCtx.setTransform(1, 0, 0, 1, 0, 0);
    this.accumCtx.clearRect(0, 0, this.accumCanvas.width, this.accumCanvas.height);
    this.accumCtx.restore();
  }
}
