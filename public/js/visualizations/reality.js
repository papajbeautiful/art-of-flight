/**
 * Reality Mode: Show actual aircraft with livery colors and flight information
 */
class RealityVisualization {
  constructor(canvas, ctx) {
    this.canvas = canvas;
    this.ctx = ctx;
    this.aircraftPositions = new Map();
    this.trails = new Map();
    this.maxTrailLength = 100;

    // Per-mode display options
    this.displayOptions = {
      showTrails: true,
      showCallsigns: true,
      showAltitude: true,
      showSpeed: true,
      showRoute: true,
      showCoordinates: false,
      showAirborneAircraft: true,
      showGroundAircraft: false,
      aircraftIcon: 'chevron',
      labelFormat: '{airline} {type} to {destination}',
      trailLength: 100,
      aircraftScale: 1.0,
      labelTextScale: 1.0,
      labelBgOpacity: 0.7,
      labelBgColor: '#000000',
      accentColor: '#4CAF50',
      inboundColor: '',
      outboundColor: '',
      dotSize: 8
    };
  }

  setDisplayOptions(options) {
    if (!options) return;
    const keys = [
      'inboundColor', 'outboundColor', 'showTrails', 'showCallsigns',
      'showAltitude', 'showSpeed', 'showRoute', 'showCoordinates',
      'showAirborneAircraft', 'showGroundAircraft', 'aircraftIcon',
      'labelFormat', 'inboundLabelFormat', 'outboundLabelFormat',
      'aircraftScale', 'labelTextScale', 'labelBgOpacity', 'labelBgColor',
      'accentColor', 'dotSize'
    ];
    keys.forEach(k => { if (options[k] !== undefined) this.displayOptions[k] = options[k]; });
    if (options.trailLength !== undefined) {
      this.displayOptions.trailLength = options.trailLength;
      this.maxTrailLength = options.trailLength;
    }
  }

  update(flights) {
    const now = Date.now();

    flights.forEach(flight => {
      const id = flight.icao24;
      const position = this.latLonToPosition(flight.latitude, flight.longitude);

      this.aircraftPositions.set(id, {
        x: position.x,
        y: position.y,
        heading: flight.heading || 0,
        altitude: flight.altitudeFeet || 0,
        velocity: flight.velocityKnots || 0,
        callsign: flight.callsign,
        flight: flight,
        color: this.getAirlineColor(flight.callsign, flight),
        lastUpdate: now
      });

      if (!this.trails.has(id)) {
        this.trails.set(id, []);
      }

      const trail = this.trails.get(id);
      trail.push({ x: position.x, y: position.y, time: now });

      if (trail.length > this.maxTrailLength) {
        trail.shift();
      }
    });

    const timeout = 30000;
    for (const [id, data] of this.aircraftPositions.entries()) {
      if (now - data.lastUpdate > timeout) {
        this.aircraftPositions.delete(id);
        this.trails.delete(id);
      }
    }
  }

  latLonToPosition(lat, lon) {
    if (window.theArtOfFlight?.coordSystem?.isLocked) {
      return window.theArtOfFlight.coordSystem.toScreen(lat, lon);
    }
    return { x: this.canvas.width / 2, y: this.canvas.height / 2 };
  }

  getAirlineColor(callsign, flight) {
    // Use inbound/outbound color override if set
    if (flight) {
      const isInbound = window.theArtOfFlight?.isInbound?.(flight);
      if (isInbound && this.displayOptions.inboundColor) return this.displayOptions.inboundColor;
      if (!isInbound && this.displayOptions.outboundColor) return this.displayOptions.outboundColor;
    }

    const airlineColors = {
      'QFA': '#e21e3a', 'VOZ': '#cc0033', 'JST': '#ff6000',
      'UAL': '#0033a0', 'AAL': '#c8102e', 'DAL': '#003a70',
      'QTR': '#5c0633', 'UAE': '#c8102e', 'SIA': '#003087',
    };
    const code = callsign.substring(0, 3);
    return airlineColors[code] || this.displayOptions.accentColor;
  }

  drawAircraft(x, y, heading, color, scale = 1) {
    this.ctx.save();
    this.ctx.translate(x, y);
    this.ctx.rotate((heading || 0) * Math.PI / 180);

    const size = 15 * scale * this.displayOptions.aircraftScale;

    this.ctx.fillStyle = color;
    this.ctx.beginPath();
    this.ctx.moveTo(0, -size);
    this.ctx.lineTo(-size * 0.6, size * 0.8);
    this.ctx.lineTo(0, size * 0.5);
    this.ctx.lineTo(size * 0.6, size * 0.8);
    this.ctx.closePath();
    this.ctx.fill();

    this.ctx.restore();
  }

  draw() {
    const s = this.displayOptions.labelTextScale;
    const bgAlpha = this.displayOptions.labelBgOpacity;

    if (this.displayOptions.showTrails) {
      for (const [id, trail] of this.trails.entries()) {
        if (trail.length < 2) continue;

        const aircraft = this.aircraftPositions.get(id);
        if (!aircraft) continue;

        const opacity = aircraft.flight?.opacity ?? 1;
        this.ctx.strokeStyle = aircraft.color;
        this.ctx.lineWidth = 2;
        this.ctx.globalAlpha = 0.3 * opacity;

        this.ctx.beginPath();
        this.ctx.moveTo(trail[0].x, trail[0].y);

        for (let i = 1; i < trail.length; i++) {
          this.ctx.lineTo(trail[i].x, trail[i].y);
        }

        this.ctx.stroke();
      }

      this.ctx.globalAlpha = 1;
    }

    for (const [id, aircraft] of this.aircraftPositions.entries()) {
      const opacity = aircraft.flight?.opacity ?? 1;
      const isOnGround = aircraft.altitude <= 0;

      // Skip ground aircraft if setting disabled
      if (isOnGround && !this.displayOptions.showGroundAircraft) continue;

      this.ctx.globalAlpha = opacity;

      // Draw aircraft icon
      if (isOnGround || this.displayOptions.showAirborneAircraft) {
        drawAircraftIcon(this.ctx, aircraft.x, aircraft.y, aircraft.heading,
          aircraft.color, this.displayOptions.aircraftIcon,
          this.displayOptions.aircraftScale, this.displayOptions.dotSize, opacity);
      }

      // Build route string using label format
      let routeText = '';
      if (this.displayOptions.showRoute) {
        routeText = this.formatRouteText(aircraft.flight);
      }

      const showAnyLabel = this.displayOptions.showCallsigns ||
                          this.displayOptions.showAltitude ||
                          this.displayOptions.showSpeed ||
                          routeText ||
                          this.displayOptions.showCoordinates;

      if (showAnyLabel) {
        let lineCount = 0;
        if (this.displayOptions.showCallsigns) lineCount++;
        if (routeText) lineCount++;
        if (this.displayOptions.showAltitude || this.displayOptions.showSpeed) lineCount++;
        if (this.displayOptions.showCoordinates) lineCount++;

        const lineH = Math.round(14 * s);
        const labelWidth = Math.round(150 * s);
        const labelHeight = Math.round(10 * s) + (lineCount * lineH);
        const labelX = aircraft.x + 20;
        const labelY = aircraft.y - 10 - labelHeight;

        this.ctx.fillStyle = getLabelBgStyle(this.displayOptions.labelBgColor, bgAlpha);
        this.ctx.fillRect(labelX, labelY, labelWidth, labelHeight);

        let currentY = labelY + lineH;

        if (this.displayOptions.showCallsigns) {
          this.ctx.fillStyle = aircraft.color;
          this.ctx.font = `bold ${Math.round(14 * s)}px monospace`;
          this.ctx.fillText(aircraft.callsign, labelX + 5, currentY);
          currentY += lineH;
        }

        if (routeText) {
          this.ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
          this.ctx.font = `${Math.round(10 * s)}px "Work Sans", sans-serif`;
          this.ctx.fillText(routeText, labelX + 5, currentY);
          currentY += lineH;
        }

        if (this.displayOptions.showAltitude || this.displayOptions.showSpeed) {
          this.ctx.fillStyle = '#aaa';
          this.ctx.font = `${Math.round(11 * s)}px monospace`;

          let dataText = '';
          if (this.displayOptions.showAltitude) {
            dataText += `${Math.round(aircraft.altitude)}ft`;
          }
          if (this.displayOptions.showSpeed) {
            if (dataText) dataText += ' \u2022 ';
            dataText += `${Math.round(aircraft.velocity)}kts`;
          }

          this.ctx.fillText(dataText, labelX + 5, currentY);
          currentY += lineH;
        }

        if (this.displayOptions.showCoordinates) {
          this.ctx.fillStyle = '#666';
          this.ctx.font = `${Math.round(9 * s)}px monospace`;
          this.ctx.fillText(`${aircraft.flight.latitude.toFixed(4)}, ${aircraft.flight.longitude.toFixed(4)}`, labelX + 5, currentY);
        }
      }

      this.ctx.globalAlpha = 1;
    }
  }

  formatRouteText(flight) {
    if (!flight) return '';

    // Pick inbound vs outbound template
    const isInbound = window.theArtOfFlight?.isInbound?.(flight);
    const template = isInbound
      ? (this.displayOptions.inboundLabelFormat || this.displayOptions.labelFormat || '')
      : (this.displayOptions.outboundLabelFormat || this.displayOptions.labelFormat || '');

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

    if (origin && destination) return `${origin} \u2192 ${destination}`;
    if (origin) return `From ${origin}`;
    if (destination) return `To ${destination}`;
    return '';
  }

  clear() {
    this.aircraftPositions.clear();
    this.trails.clear();
  }
}
