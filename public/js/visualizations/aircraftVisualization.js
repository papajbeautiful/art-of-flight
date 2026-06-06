/**
 * AircraftVisualization — shared base class for aircraft-tracking modes.
 *
 * Owns the lifecycle every canvas mode previously duplicated:
 *   - aircraft records (position easing toward API targets, metadata)
 *   - trail sampling and pruning
 *   - 30s stale-aircraft cleanup
 *   - trail / icon / label rendering with the shared option set
 *
 * Subclass tuning knobs (set after super()):
 *   this.ease            position easing per frame (1 = snap to target)
 *   this.trailThreshold  min px movement before a trail point (0 = any move)
 *   this.pruneAfterMs    drop aircraft unseen for this long
 *
 * Subclass hooks:
 *   isActive()                    gate update() on layer visibility
 *   onActiveAircraft(list, now)   drive mode effects (WebGL pointers, grid cells)
 *   onOptionsChanged(options)     react to live option changes
 *   latLonToScreen(lat, lon)      override projection (map mode)
 *
 * Patterns mode does NOT extend this — it is an accumulation artwork with
 * genuinely different state (segment history, persistence).
 */

/** Airline livery colors by 3-letter ICAO callsign prefix (shared by all modes) */
const AIRCRAFT_AIRLINE_COLORS = {
  'QFA': '#e21e3a', 'VOZ': '#cc0033', 'JST': '#ff6000',
  'UAL': '#0033a0', 'AAL': '#c8102e', 'DAL': '#003a70',
  'QTR': '#5c0633', 'UAE': '#c8102e', 'SIA': '#003087',
};

class AircraftVisualization {
  constructor(canvas, ctx) {
    this.canvas = canvas;
    this.ctx = ctx;
    this.aircraftPositions = new Map();
    this.trails = new Map();
    this.maxTrailLength = 100;

    // Per-mode tuning
    this.ease = 0.08;
    this.trailThreshold = 2;
    this.pruneAfterMs = 30000;

    this.options = {
      showAirborneAircraft: true,
      showGroundAircraft: false,
      aircraftIcon: 'glow',
      accentColor: '#00F0FF',
      inboundColor: '',
      outboundColor: '',
      dotSize: 8,
      showTrails: false,
      showCallsigns: false,
      showAltitude: false,
      showSpeed: false,
      showRoute: false,
      showCoordinates: false,
      labelFormat: '',
      inboundLabelFormat: '{airline} {type} from {origin}',
      outboundLabelFormat: '{airline} {type} to {destination}',
      trailLength: 100,
      aircraftScale: 1.0,
      labelTextScale: 1.0,
      labelBgOpacity: 0.7,
      labelBgColor: '#000000'
    };
  }

  // ── Options ───────────────────────────────────────────────

  get baseOptionKeys() {
    return [
      'showAirborneAircraft', 'showGroundAircraft', 'aircraftIcon',
      'accentColor', 'inboundColor', 'outboundColor', 'dotSize',
      'showTrails', 'showCallsigns', 'showAltitude', 'showSpeed',
      'showRoute', 'showCoordinates', 'labelFormat', 'inboundLabelFormat',
      'outboundLabelFormat', 'aircraftScale', 'labelTextScale',
      'labelBgOpacity', 'labelBgColor'
    ];
  }

  /** Subclasses list their mode-specific option keys here */
  get extraOptionKeys() { return []; }

  setDisplayOptions(options) {
    if (!options) return;
    [...this.baseOptionKeys, ...this.extraOptionKeys].forEach(k => {
      if (options[k] !== undefined) this.options[k] = options[k];
    });
    if (options.trailLength !== undefined) {
      this.options.trailLength = options.trailLength;
      this.maxTrailLength = options.trailLength;
    }
    this.onOptionsChanged(options);
  }

  /** HOOK: live option side effects (materials, grid rebuilds, map styles) */
  onOptionsChanged(options) {}

  // ── State hooks ───────────────────────────────────────────

  /** HOOK: layer-based modes return their visibility flag */
  isActive() { return true; }

  /** HOOK: drive mode-specific effects with this frame's visible aircraft */
  onActiveAircraft(activeAircraft, now) {}

  // ── Tracking ──────────────────────────────────────────────

  update(flights) {
    if (!this.isActive()) return;

    const now = Date.now();

    flights.forEach(flight => {
      if (!flight.latitude || !flight.longitude) return;

      const id = flight.icao24;
      const newPos = this.latLonToScreen(flight.latitude, flight.longitude);

      if (!this.aircraftPositions.has(id)) {
        this.aircraftPositions.set(id, {
          x: newPos.x,
          y: newPos.y,
          targetX: newPos.x,
          targetY: newPos.y,
          lat: flight.latitude,
          lon: flight.longitude,
          velocity: flight.velocityKnots || 0,
          altitude: flight.altitudeFeet || 0,
          heading: flight.heading || 0,
          callsign: flight.callsign || '',
          lastUpdate: now,
          flight: flight,
          color: this.getAirlineColor(flight.callsign, flight)
        });
        this.trails.set(id, []);
      } else {
        const aircraft = this.aircraftPositions.get(id);
        aircraft.targetX = newPos.x;
        aircraft.targetY = newPos.y;
        aircraft.lat = flight.latitude;
        aircraft.lon = flight.longitude;
        aircraft.velocity = flight.velocityKnots || 0;
        aircraft.altitude = flight.altitudeFeet || 0;
        aircraft.heading = flight.heading || 0;
        aircraft.callsign = flight.callsign || aircraft.callsign;
        aircraft.lastUpdate = now;
        aircraft.flight = flight;
        aircraft.color = this.getAirlineColor(flight.callsign, flight);
      }
    });

    // Ease positions, sample trails, prune stale aircraft
    const activeAircraft = [];
    for (const [id, aircraft] of this.aircraftPositions.entries()) {
      aircraft.x += (aircraft.targetX - aircraft.x) * this.ease;
      aircraft.y += (aircraft.targetY - aircraft.y) * this.ease;

      const isOnGround = aircraft.altitude <= 0;
      if (!(isOnGround && !this.options.showGroundAircraft)) {
        activeAircraft.push(aircraft);

        if (!this.trails.has(id)) this.trails.set(id, []);
        const trail = this.trails.get(id);
        if (trail.length === 0 ||
            Math.abs(aircraft.x - trail[trail.length - 1].x) > this.trailThreshold ||
            Math.abs(aircraft.y - trail[trail.length - 1].y) > this.trailThreshold) {
          trail.push({ x: aircraft.x, y: aircraft.y, time: now });
        }
        if (trail.length > this.maxTrailLength) trail.shift();
      }

      if (now - aircraft.lastUpdate > this.pruneAfterMs) {
        this.aircraftPositions.delete(id);
        this.trails.delete(id);
      }
    }

    this.onActiveAircraft(activeAircraft, now);
  }

  // ── Projection ────────────────────────────────────────────

  latLonToScreen(lat, lon) {
    if (window.theArtOfFlight?.coordSystem?.isLocked) {
      return window.theArtOfFlight.coordSystem.toScreen(lat, lon);
    }
    return {
      x: (this.canvas.clientWidth || this.canvas.width) / 2,
      y: (this.canvas.clientHeight || this.canvas.height) / 2
    };
  }

  // ── Colors & labels ───────────────────────────────────────

  getAirlineColor(callsign, flight) {
    if (flight) {
      const isInbound = window.theArtOfFlight?.isInbound?.(flight);
      if (isInbound && this.options.inboundColor) return this.options.inboundColor;
      if (!isInbound && this.options.outboundColor) return this.options.outboundColor;
    }
    const code = (callsign || '').substring(0, 3);
    return AIRCRAFT_AIRLINE_COLORS[code] || this.options.accentColor;
  }

  formatRouteText(flight) {
    if (!flight) return '';
    const isInbound = window.theArtOfFlight?.isInbound?.(flight);
    const template = isInbound
      ? (this.options.inboundLabelFormat || this.options.labelFormat || '')
      : (this.options.outboundLabelFormat || this.options.labelFormat || '');

    const airline = flight.airlineName || '';
    const type = flight.aircraftType || '';
    const callsign = flight.callsign || '';
    const origin = flight.originCity || '';
    const destination = flight.destinationCity || '';

    if (template && (origin || destination || airline)) {
      let text = template
        .replace(/\{airline\}/gi, airline)
        .replace(/\{type\}/gi, type)
        .replace(/\{callsign\}/gi, callsign)
        .replace(/\{origin\}/gi, origin)
        .replace(/\{destination\}/gi, destination);
      text = text.replace(/\s{2,}/g, ' ').trim();
      text = text.replace(/\b(to|from|via)\s*$/i, '').trim();
      if (text && text !== callsign) return text;
    }

    if (origin && destination) return `${origin} → ${destination}`;
    if (origin) return `From ${origin}`;
    if (destination) return `To ${destination}`;
    return '';
  }

  // ── Rendering ─────────────────────────────────────────────

  draw() {
    const s = this.options.labelTextScale;
    const bgAlpha = this.options.labelBgOpacity;

    if (this.options.showTrails) {
      this.drawTrails();
    }

    for (const [id, aircraft] of this.aircraftPositions.entries()) {
      const isOnGround = aircraft.altitude <= 0;
      if (isOnGround && !this.options.showGroundAircraft) continue;

      const opacity = aircraft.flight?.opacity ?? 1;
      this.ctx.globalAlpha = opacity;

      // Icon: airborne gated by showAirborneAircraft, ground by showGroundAircraft
      const showIcon = isOnGround ? this.options.showGroundAircraft : this.options.showAirborneAircraft;
      if (showIcon) {
        // Subtle breathing pulse for aircraft in motion (phase offset by
        // position so planes don't pulse in sync). Static aircraft — and the
        // zero-velocity pixel-guard fixture — render at exact scale.
        let iconScale = this.options.aircraftScale;
        if (aircraft.velocity > 50) {
          iconScale *= 1 + 0.05 * Math.sin(Date.now() / 280 + aircraft.x * 0.05);
        }
        drawAircraftIcon(this.ctx, aircraft.x, aircraft.y, aircraft.heading,
          aircraft.color, this.options.aircraftIcon, iconScale,
          this.options.dotSize, opacity);
      }

      this.drawLabel(aircraft, s, bgAlpha);

      this.ctx.globalAlpha = 1;
    }
  }

  drawTrails() {
    // Contrail look: per-segment alpha ramp (dissolving tail) with a width
    // taper toward the aircraft, instead of the old flat 0.3-alpha line.
    for (const [id, trail] of this.trails.entries()) {
      if (trail.length < 2) continue;
      const aircraft = this.aircraftPositions.get(id);
      if (!aircraft) continue;
      const trailOpacity = aircraft.flight?.opacity ?? 1;
      const n = trail.length;

      this.ctx.strokeStyle = aircraft.color;
      this.ctx.lineCap = 'round';
      for (let i = 1; i < n; i++) {
        const t = i / n; // 0 = oldest, 1 = newest
        this.ctx.globalAlpha = 0.45 * t * t * trailOpacity;
        this.ctx.lineWidth = 0.6 + 1.8 * t;
        this.ctx.beginPath();
        this.ctx.moveTo(trail[i - 1].x, trail[i - 1].y);
        this.ctx.lineTo(trail[i].x, trail[i].y);
        this.ctx.stroke();
      }
    }
    this.ctx.globalAlpha = 1;
    this.ctx.lineCap = 'butt';
  }

  drawLabel(aircraft, s, bgAlpha) {
    let routeText = '';
    if (this.options.showRoute) routeText = this.formatRouteText(aircraft.flight);

    const showAnyLabel = this.options.showCallsigns ||
                        this.options.showAltitude ||
                        this.options.showSpeed ||
                        routeText ||
                        this.options.showCoordinates;
    if (!showAnyLabel) return;

    let lineCount = 0;
    if (this.options.showCallsigns) lineCount++;
    if (routeText) lineCount++;
    if (this.options.showAltitude || this.options.showSpeed) lineCount++;
    if (this.options.showCoordinates) lineCount++;

    const lineH = Math.round(14 * s);
    const labelWidth = Math.round(150 * s);
    const labelHeight = Math.round(12 * s) + (lineCount * lineH);
    const labelX = aircraft.x + 20;
    const labelY = aircraft.y - 10 - labelHeight;
    const pad = Math.round(10 * s);
    const radius = Math.min(5, labelHeight / 2);

    // Card: rounded background + livery accent bar down the left edge
    this.ctx.fillStyle = getLabelBgStyle(this.options.labelBgColor, bgAlpha);
    this.ctx.beginPath();
    if (this.ctx.roundRect) {
      this.ctx.roundRect(labelX, labelY, labelWidth, labelHeight, radius);
    } else {
      this.ctx.rect(labelX, labelY, labelWidth, labelHeight);
    }
    this.ctx.fill();

    this.ctx.fillStyle = aircraft.color;
    this.ctx.beginPath();
    if (this.ctx.roundRect) {
      this.ctx.roundRect(labelX, labelY, 3, labelHeight, [radius, 0, 0, radius]);
    } else {
      this.ctx.rect(labelX, labelY, 3, labelHeight);
    }
    this.ctx.fill();

    let currentY = labelY + lineH;

    if (this.options.showCallsigns) {
      this.ctx.fillStyle = aircraft.color;
      this.ctx.font = `bold ${Math.round(13 * s)}px "Space Mono", monospace`;
      this.ctx.fillText(aircraft.callsign, labelX + pad, currentY);
      currentY += lineH;
    }

    if (routeText) {
      this.ctx.fillStyle = 'rgba(255, 255, 255, 0.65)';
      this.ctx.font = `${Math.round(10 * s)}px "Work Sans", sans-serif`;
      this.ctx.fillText(routeText, labelX + pad, currentY);
      currentY += lineH;
    }

    if (this.options.showAltitude || this.options.showSpeed) {
      this.ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
      this.ctx.font = `${Math.round(10 * s)}px "Space Mono", monospace`;
      let dataText = '';
      if (this.options.showAltitude) dataText += `${Math.round(aircraft.altitude).toLocaleString()}ft`;
      if (this.options.showSpeed) {
        if (dataText) dataText += ' • ';
        dataText += `${Math.round(aircraft.velocity)}kts`;
      }
      this.ctx.fillText(dataText, labelX + pad, currentY);
      currentY += lineH;
    }

    if (this.options.showCoordinates) {
      this.ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
      this.ctx.font = `${Math.round(9 * s)}px "Space Mono", monospace`;
      this.ctx.fillText(`${aircraft.lat.toFixed(4)}, ${aircraft.lon.toFixed(4)}`, labelX + pad, currentY);
    }
  }

  // ── Cleanup ───────────────────────────────────────────────

  clear() {
    this.aircraftPositions.clear();
    this.trails.clear();
  }
}
