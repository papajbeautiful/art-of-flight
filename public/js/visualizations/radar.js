/**
 * Radar Mode: CRT phosphor scope
 *
 * A rotating sweep centered on home. The defining behaviour of a real PPI
 * scope: phosphor echoes stay WHERE the beam painted them — each crossing
 * stamps an echo at the aircraft's position into a small ring buffer, old
 * echoes hold position and decay exponentially, and the dotted track
 * history emerges. The newest echo ignites with a bluish-white flash that
 * settles into the palette's phosphor tone (two-tone P7 look).
 *
 * All light is additive ('lighter'): conic sweep (cached at angle 0 and
 * rotated), blip cores + halos, leader vectors. Instrument detailing —
 * compass numerals, range-ring distance labels, breathing station dot —
 * uses the palette's quiet slots. Scanlines come from a cached pattern.
 *
 * Deterministic runs freeze the sweep, force intensity 1, and skip echo
 * history / breathing — pixel-stable under the static fixture.
 */
class RadarVisualization extends AircraftVisualization {
  constructor(canvas, ctx) {
    super(canvas, ctx);

    Object.assign(this.options, {
      sweepSeconds: 6,
      ringCount: 4,
      showScanlines: true,
      // Blips replace base icons; tags render in phosphor style
      showAirborneAircraft: false,
      showCallsigns: true
    });

    this._blipState = new Map();   // icao24 → { lastLit, echoes: [{x,y,t}] }
    this._vignette = null;
    this._vignetteSize = '';
    this._scanPattern = null;
    this._cone = null;             // cached conic gradient (angle 0)
    this._coneKey = '';
  }

  get extraOptionKeys() {
    return ['sweepSeconds', 'ringCount', 'showScanlines'];
  }

  onPaletteChanged() { this._coneKey = ''; }

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

  _phosphor() {
    const hex = this.palette?.primary || '#3dff8c';
    const p = hexToRgbIcon(hex);
    return `${p.r}, ${p.g}, ${p.b}`;
  }

  _quiet() {
    const hex = this.palette?.secondary || '#1f7a4d';
    const p = hexToRgbIcon(hex);
    return `${p.r}, ${p.g}, ${p.b}`;
  }

  draw() {
    const w = this.canvas.clientWidth || this.canvas.width;
    const h = this.canvas.clientHeight || this.canvas.height;
    const now = Date.now();
    const ctx = this.ctx;
    const c = this.center();
    const rgb = this._phosphor();
    const quiet = this._quiet();
    const ringRadius = Math.min(w, h) * 0.46;

    // Scope background — near-black with a hint of the phosphor; a user
    // background ghosts through the glass at low alpha
    ctx.fillStyle = '#020403';
    ctx.fillRect(0, 0, w, h);
    this.drawBackgroundImage(0.18);
    const bgGlow = ctx.createRadialGradient(c.x, c.y, 0, c.x, c.y, ringRadius * 1.15);
    bgGlow.addColorStop(0, `rgba(${rgb}, 0.06)`);
    bgGlow.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = bgGlow;
    ctx.fillRect(0, 0, w, h);

    // Range rings + crosshair + bearing ticks + instrument lettering
    ctx.strokeStyle = `rgba(${rgb}, 0.15)`;
    ctx.lineWidth = 1;
    for (let i = 1; i <= this.options.ringCount; i++) {
      ctx.beginPath();
      ctx.arc(c.x, c.y, (ringRadius * i) / this.options.ringCount, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.strokeStyle = `rgba(${rgb}, 0.09)`;
    ctx.beginPath();
    ctx.moveTo(c.x - ringRadius, c.y); ctx.lineTo(c.x + ringRadius, c.y);
    ctx.moveTo(c.x, c.y - ringRadius); ctx.lineTo(c.x, c.y + ringRadius);
    ctx.stroke();

    ctx.strokeStyle = `rgba(${rgb}, 0.24)`;
    ctx.font = '9px "Space Mono", monospace';
    ctx.textAlign = 'center';
    for (let deg = 0; deg < 360; deg += 30) {
      const a = (deg - 90) * Math.PI / 180;
      ctx.beginPath();
      ctx.moveTo(c.x + Math.cos(a) * (ringRadius - 8), c.y + Math.sin(a) * (ringRadius - 8));
      ctx.lineTo(c.x + Math.cos(a) * ringRadius, c.y + Math.sin(a) * ringRadius);
      ctx.stroke();
      // Compass numerals just outside the rose
      ctx.fillStyle = `rgba(${quiet}, 0.55)`;
      const lx = c.x + Math.cos(a) * (ringRadius + 16);
      const ly = c.y + Math.sin(a) * (ringRadius + 16) + 3;
      ctx.fillText(String(deg).padStart(3, '0'), lx, ly);
    }
    ctx.textAlign = 'left';

    // Range-ring distance labels (km, from the configured scene radius)
    const sceneRadius = window.theArtOfFlight?.settingsManager?.settings?.radius || 50;
    const kmPerPx = sceneRadius / (Math.min(w, h) * 0.4);
    ctx.fillStyle = `rgba(${quiet}, 0.45)`;
    ctx.font = '8px "Space Mono", monospace';
    for (let i = 1; i <= this.options.ringCount; i++) {
      const rr = (ringRadius * i) / this.options.ringCount;
      const km = Math.round(rr * kmPerPx);
      ctx.fillText(`${km}`, c.x + rr * 0.7071 + 4, c.y - rr * 0.7071 - 4);
    }

    // ── Additive light from here down ──
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';

    // Sweep beam: conic gradient cached at angle 0, context-rotated
    const sweep = this.sweepAngle(now);
    if (ctx.createConicGradient) {
      const coneKey = `${rgb}`;
      if (this._coneKey !== coneKey) {
        this._coneKey = coneKey;
        // Exponential-ish falloff across the trailing wedge
        this._cone = ctx.createConicGradient(0, 0, 0);
        this._cone.addColorStop(0, `rgba(${rgb}, 0.34)`);
        this._cone.addColorStop(0.04, `rgba(${rgb}, 0.16)`);
        this._cone.addColorStop(0.10, `rgba(${rgb}, 0.07)`);
        this._cone.addColorStop(0.20, `rgba(${rgb}, 0.025)`);
        this._cone.addColorStop(0.32, 'rgba(0, 0, 0, 0)');
        this._cone.addColorStop(1, 'rgba(0, 0, 0, 0)');
      }
      ctx.save();
      ctx.beginPath();
      ctx.arc(c.x, c.y, ringRadius, 0, Math.PI * 2);
      ctx.clip();
      // Mirror so the phosphor trails BEHIND the beam, rotate to the sweep
      ctx.translate(c.x, c.y);
      ctx.scale(1, -1);
      ctx.rotate(sweep);
      ctx.fillStyle = this._cone;
      ctx.fillRect(-ringRadius, -ringRadius, ringRadius * 2, ringRadius * 2);
      ctx.restore();
    }
    // Leading edge: bright core + soft companion
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = `rgba(${rgb}, 0.75)`;
    ctx.beginPath();
    ctx.moveTo(c.x, c.y);
    ctx.lineTo(c.x + Math.cos(-sweep) * ringRadius, c.y + Math.sin(-sweep) * ringRadius);
    ctx.stroke();
    ctx.lineWidth = 4;
    ctx.strokeStyle = `rgba(${rgb}, 0.10)`;
    ctx.stroke();

    // Blips with phosphor echo history
    const sweepPeriod = this.options.sweepSeconds * 1000;
    const norm = (a) => ((a % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);

    for (const [id, aircraft] of this.aircraftPositions.entries()) {
      const isOnGround = aircraft.altitude <= 0;
      if (isOnGround && !this.options.showGroundAircraft) continue;

      const fade = aircraft.flight?.opacity ?? 1;
      const r = 3.5 + Math.min((aircraft.altitude || 0) / 40000, 1) * 3;
      let intensity = 1;
      let flash = 0;

      if (!window.__DETERMINISTIC__) {
        const bearing = Math.atan2(-(aircraft.y - c.y), aircraft.x - c.x);
        const since = norm(sweep - bearing) / (Math.PI * 2); // 0..1 revolution since beam crossing

        let state = this._blipState.get(id);
        if (!state) { state = { lastLit: 0, echoes: [] }; this._blipState.set(id, state); }
        if (since < 0.04 && now - state.lastLit > sweepPeriod * 0.5) {
          state.lastLit = now;
          // Stamp a fixed echo at the CURRENT position — track history
          state.echoes.push({ x: aircraft.x, y: aircraft.y, t: now });
          if (state.echoes.length > 8) state.echoes.shift();
        }

        const age = (now - state.lastLit) / sweepPeriod;
        intensity = Math.exp(-age * 2.2);
        flash = Math.max(0, 1 - age * 14); // brief ignition overshoot
        if (intensity <= 0.01 && !state.echoes.length) continue;

        // Echo history: fixed fading paint, oldest first
        for (const echo of state.echoes) {
          const eAge = (now - echo.t) / sweepPeriod;
          const eInt = Math.exp(-eAge * 1.1) * 0.5;
          if (eInt < 0.02) continue;
          ctx.fillStyle = `rgba(${rgb}, ${eInt * fade})`;
          ctx.beginPath();
          ctx.arc(echo.x, echo.y, Math.max(1.2, r * 0.45), 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // Two-tone phosphor: bluish-white ignition settling into the palette
      const coreW = Math.min(1, 0.35 + flash * 0.65);
      const core = `rgba(${Math.round(180 + 75 * coreW)}, ${Math.round(220 + 35 * coreW)}, 255, ${0.85 * intensity * fade})`;
      const halo = ctx.createRadialGradient(aircraft.x, aircraft.y, 0, aircraft.x, aircraft.y, r * (3 + flash));
      halo.addColorStop(0, flash > 0.1 ? core : `rgba(${rgb}, ${0.85 * intensity * fade})`);
      halo.addColorStop(0.35, `rgba(${rgb}, ${0.28 * intensity * fade})`);
      halo.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = halo;
      ctx.beginPath();
      ctx.arc(aircraft.x, aircraft.y, r * (3 + flash), 0, Math.PI * 2);
      ctx.fill();

      // Velocity leader: a line along heading, length ∝ ground speed
      if (aircraft.velocity > 30 && intensity > 0.1) {
        const ha = ((aircraft.heading || 0) - 90) * Math.PI / 180;
        const len = 10 + Math.min(aircraft.velocity / 500, 1) * 26;
        ctx.strokeStyle = `rgba(${rgb}, ${0.5 * intensity * fade})`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(aircraft.x + Math.cos(ha) * (r + 1), aircraft.y + Math.sin(ha) * (r + 1));
        ctx.lineTo(aircraft.x + Math.cos(ha) * (r + len), aircraft.y + Math.sin(ha) * (r + len));
        ctx.stroke();
      }

      // ATC data block with a short leader line
      if (this.options.showCallsigns && aircraft.callsign && intensity > 0.22) {
        const tx = aircraft.x + r * 3 + 10;
        const ty = aircraft.y - r * 2 - 4;
        ctx.strokeStyle = `rgba(${rgb}, ${0.3 * intensity * fade})`;
        ctx.lineWidth = 0.8;
        ctx.beginPath();
        ctx.moveTo(aircraft.x + r + 1, aircraft.y - r - 1);
        ctx.lineTo(tx - 3, ty + 3);
        ctx.stroke();
        ctx.fillStyle = `rgba(${rgb}, ${0.75 * intensity * fade})`;
        ctx.font = `${Math.round(10 * this.options.labelTextScale)}px "Space Mono", monospace`;
        ctx.fillText(aircraft.callsign, tx, ty);
        if (aircraft.altitude > 0) {
          ctx.fillStyle = `rgba(${rgb}, ${0.4 * intensity * fade})`;
          ctx.font = `${Math.round(8 * this.options.labelTextScale)}px "Space Mono", monospace`;
          const spd = aircraft.velocity > 0 ? ` ${Math.round(aircraft.velocity)}` : '';
          ctx.fillText(`${Math.round(aircraft.altitude / 100)}${spd}`, tx, ty + 11);
        }
      }
    }

    // Station dot at scope centre, breathing gently
    const breath = window.__DETERMINISTIC__ ? 0.5 : (Math.sin(now / 900) + 1) / 2;
    ctx.fillStyle = `rgba(${rgb}, ${0.5 + 0.3 * breath})`;
    ctx.beginPath();
    ctx.arc(c.x, c.y, 2.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = `rgba(${rgb}, ${0.18 * (1 - breath)})`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(c.x, c.y, 5 + breath * 4, 0, Math.PI * 2);
    ctx.stroke();

    ctx.restore(); // end additive

    // Prune blip state for departed aircraft
    for (const id of this._blipState.keys()) {
      if (!this.aircraftPositions.has(id)) this._blipState.delete(id);
    }

    // Scanlines from a cached pattern (one fill, no per-line rects)
    if (this.options.showScanlines) {
      if (!this._scanPattern) {
        const tile = document.createElement('canvas');
        tile.width = 1; tile.height = 3;
        const t = tile.getContext('2d');
        t.fillStyle = 'rgba(0, 0, 0, 0.10)';
        t.fillRect(0, 0, 1, 1);
        this._scanPattern = ctx.createPattern(tile, 'repeat');
      }
      ctx.fillStyle = this._scanPattern;
      ctx.fillRect(0, 0, w, h);
    }

    // Glass: static sheen + vignette
    const sizeKey = `${w}x${h}`;
    if (!this._vignette || this._vignetteSize !== sizeKey) {
      this._vignette = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.35, w / 2, h / 2, Math.max(w, h) * 0.72);
      this._vignette.addColorStop(0, 'rgba(0, 0, 0, 0)');
      this._vignette.addColorStop(1, 'rgba(0, 0, 0, 0.55)');
      this._sheen = ctx.createRadialGradient(w * 0.32, h * 0.2, 0, w * 0.32, h * 0.2, Math.max(w, h) * 0.5);
      this._sheen.addColorStop(0, 'rgba(255, 255, 255, 0.022)');
      this._sheen.addColorStop(1, 'rgba(255, 255, 255, 0)');
      this._vignetteSize = sizeKey;
    }
    ctx.fillStyle = this._sheen;
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = this._vignette;
    ctx.fillRect(0, 0, w, h);
  }

  clear() {
    super.clear();
    this._blipState.clear();
  }
}
