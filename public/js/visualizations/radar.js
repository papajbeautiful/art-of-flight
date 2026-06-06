/**
 * Radar Mode: CRT phosphor scope
 *
 * A rotating sweep beam centered on the home location. Aircraft ignite as
 * phosphor blips when the beam passes and decay until the next sweep.
 * Range rings, bearing ticks, scanlines, and a vignette complete the CRT.
 */
class RadarVisualization extends AircraftVisualization {
  constructor(canvas, ctx) {
    super(canvas, ctx);

    Object.assign(this.options, {
      sweepSeconds: 6,
      phosphorColor: '#3DFF8C',
      ringCount: 4,
      showSweep: true,
      showRings: true,
      showScanlines: true,
      blipPersistence: 0.85,  // fraction of a sweep the blip stays visible
      // Blips replace base icons; labels render in phosphor style
      showAirborneAircraft: false,
      showCallsigns: true,
      accentColor: '#3DFF8C'
    });

    this._lastSweepAngle = 0;
    this._blipState = new Map(); // icao24 -> { litAt }
    this._vignette = null;
    this._vignetteSize = '';
  }

  get extraOptionKeys() {
    return ['sweepSeconds', 'phosphorColor', 'ringCount', 'showSweep',
            'showRings', 'showScanlines', 'blipPersistence'];
  }

  /** Scope center: the configured home location */
  center() {
    const s = window.theArtOfFlight?.settingsManager?.settings;
    if (s && window.theArtOfFlight.coordSystem?.isLocked) {
      return window.theArtOfFlight.coordSystem.toScreen(s.latitude, s.longitude);
    }
    const w = this.canvas.clientWidth || this.canvas.width;
    const h = this.canvas.clientHeight || this.canvas.height;
    return { x: w / 2, y: h / 2 };
  }

  /** Current sweep angle in radians (fixed in deterministic runs) */
  sweepAngle(now) {
    if (window.__DETERMINISTIC__) return Math.PI * 0.37;
    return ((now / (this.options.sweepSeconds * 1000)) % 1) * Math.PI * 2;
  }

  draw() {
    const w = this.canvas.clientWidth || this.canvas.width;
    const h = this.canvas.clientHeight || this.canvas.height;
    const now = Date.now();
    const ctx = this.ctx;
    const c = this.center();
    const phosphor = hexToRgbIcon(this.options.phosphorColor);
    const rgb = `${phosphor.r}, ${phosphor.g}, ${phosphor.b}`;
    const maxRadius = Math.hypot(Math.max(c.x, w - c.x), Math.max(c.y, h - c.y));
    const ringRadius = Math.min(w, h) * 0.46;

    // Scope background
    ctx.fillStyle = '#020604';
    ctx.fillRect(0, 0, w, h);
    const bgGlow = ctx.createRadialGradient(c.x, c.y, 0, c.x, c.y, ringRadius * 1.15);
    bgGlow.addColorStop(0, `rgba(${rgb}, 0.07)`);
    bgGlow.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = bgGlow;
    ctx.fillRect(0, 0, w, h);

    // Range rings + bearing ticks
    if (this.options.showRings) {
      ctx.strokeStyle = `rgba(${rgb}, 0.16)`;
      ctx.lineWidth = 1;
      for (let i = 1; i <= this.options.ringCount; i++) {
        ctx.beginPath();
        ctx.arc(c.x, c.y, (ringRadius * i) / this.options.ringCount, 0, Math.PI * 2);
        ctx.stroke();
      }
      // Crosshair axes
      ctx.strokeStyle = `rgba(${rgb}, 0.10)`;
      ctx.beginPath();
      ctx.moveTo(c.x - ringRadius, c.y); ctx.lineTo(c.x + ringRadius, c.y);
      ctx.moveTo(c.x, c.y - ringRadius); ctx.lineTo(c.x, c.y + ringRadius);
      ctx.stroke();
      // Bearing ticks every 30°
      ctx.strokeStyle = `rgba(${rgb}, 0.25)`;
      for (let deg = 0; deg < 360; deg += 30) {
        const a = (deg - 90) * Math.PI / 180;
        ctx.beginPath();
        ctx.moveTo(c.x + Math.cos(a) * (ringRadius - 8), c.y + Math.sin(a) * (ringRadius - 8));
        ctx.lineTo(c.x + Math.cos(a) * ringRadius, c.y + Math.sin(a) * ringRadius);
        ctx.stroke();
      }
    }

    // Sweep beam (trailing phosphor wedge behind the leading edge)
    const sweep = this.sweepAngle(now);
    if (this.options.showSweep) {
      if (ctx.createConicGradient) {
        const cone = ctx.createConicGradient(sweep, c.x, c.y);
        cone.addColorStop(0, `rgba(${rgb}, 0.30)`);
        cone.addColorStop(0.12, `rgba(${rgb}, 0.05)`);
        cone.addColorStop(0.3, 'rgba(0, 0, 0, 0)');
        cone.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.save();
        ctx.beginPath();
        ctx.arc(c.x, c.y, ringRadius, 0, Math.PI * 2);
        ctx.clip();
        // Conic gradients run clockwise from the start angle; mirror so the
        // phosphor trails BEHIND the beam
        ctx.translate(c.x, c.y);
        ctx.scale(1, -1);
        ctx.translate(-c.x, -c.y);
        ctx.fillStyle = cone;
        ctx.fillRect(0, 0, w, h);
        ctx.restore();
      }
      // Leading edge line
      ctx.strokeStyle = `rgba(${rgb}, 0.8)`;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(c.x, c.y);
      ctx.lineTo(c.x + Math.cos(-sweep) * ringRadius, c.y + Math.sin(-sweep) * ringRadius);
      ctx.stroke();
    }

    // Blips: ignite when the beam passes, decay until the next sweep
    const sweepPeriod = this.options.sweepSeconds * 1000;
    for (const [id, aircraft] of this.aircraftPositions.entries()) {
      const isOnGround = aircraft.altitude <= 0;
      if (isOnGround && !this.options.showGroundAircraft) continue;

      const fade = aircraft.flight?.opacity ?? 1;
      let intensity = 1;

      if (!window.__DETERMINISTIC__) {
        // Bearing of the aircraft from the scope center (canvas angle,
        // matching the sweep's coordinate convention)
        const bearing = Math.atan2(-(aircraft.y - c.y), aircraft.x - c.x);
        const norm = (a) => ((a % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
        const since = norm(sweep - bearing) / (Math.PI * 2); // 0..1 of a revolution since lit

        let state = this._blipState.get(id);
        if (!state) { state = { lastLit: 0 }; this._blipState.set(id, state); }
        if (since < 0.04) state.lastLit = now;

        const age = (now - state.lastLit) / (sweepPeriod * this.options.blipPersistence);
        intensity = Math.max(0, 1 - age);
        if (intensity <= 0.01) continue;
      }

      const r = 4 + Math.min((aircraft.altitude || 0) / 40000, 1) * 3;
      const blipGlow = ctx.createRadialGradient(aircraft.x, aircraft.y, 0, aircraft.x, aircraft.y, r * 3);
      blipGlow.addColorStop(0, `rgba(${rgb}, ${0.85 * intensity * fade})`);
      blipGlow.addColorStop(0.4, `rgba(${rgb}, ${0.25 * intensity * fade})`);
      blipGlow.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = blipGlow;
      ctx.beginPath();
      ctx.arc(aircraft.x, aircraft.y, r * 3, 0, Math.PI * 2);
      ctx.fill();

      // Phosphor callsign tag
      if (this.options.showCallsigns && aircraft.callsign && intensity > 0.25) {
        ctx.fillStyle = `rgba(${rgb}, ${0.7 * intensity * fade})`;
        ctx.font = `${Math.round(10 * this.options.labelTextScale)}px "Space Mono", monospace`;
        ctx.fillText(aircraft.callsign, aircraft.x + r * 3 + 4, aircraft.y + 3);
        if (this.options.showAltitude && aircraft.altitude > 0) {
          ctx.fillStyle = `rgba(${rgb}, ${0.4 * intensity * fade})`;
          ctx.font = `${Math.round(8 * this.options.labelTextScale)}px "Space Mono", monospace`;
          ctx.fillText(`${Math.round(aircraft.altitude / 100)}`, aircraft.x + r * 3 + 4, aircraft.y + 14);
        }
      }
    }

    // Prune blip state for departed aircraft
    for (const id of this._blipState.keys()) {
      if (!this.aircraftPositions.has(id)) this._blipState.delete(id);
    }

    // Scanlines + vignette (CRT texture)
    if (this.options.showScanlines) {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.10)';
      for (let y = 0; y < h; y += 3) {
        ctx.fillRect(0, y, w, 1);
      }
    }

    const sizeKey = `${w}x${h}`;
    if (!this._vignette || this._vignetteSize !== sizeKey) {
      this._vignette = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.35, w / 2, h / 2, Math.max(w, h) * 0.72);
      this._vignette.addColorStop(0, 'rgba(0, 0, 0, 0)');
      this._vignette.addColorStop(1, 'rgba(0, 0, 0, 0.55)');
      this._vignetteSize = sizeKey;
    }
    ctx.fillStyle = this._vignette;
    ctx.fillRect(0, 0, w, h);
  }

  clear() {
    super.clear();
    this._blipState.clear();
  }
}
