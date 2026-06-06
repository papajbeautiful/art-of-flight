/**
 * Wave Mode: Interactive Line Text Distortion
 * Aircraft positions distort horizontal lines across the screen
 * Credit: BL/S® Studio — MIT License
 * https://codepen.io/blacklead-studio/pen/azOzePJ
 */
class ConstellationVisualization {
  constructor(canvas, ctx) {
    this.canvas = canvas;
    this.ctx = ctx;
    this.waveLayer = document.getElementById('waveLayer');
    this.waveCanvas = document.getElementById('waveCanvas');
    this.waveCtx = null;
    this.lines = [];
    this.aircraftPositions = new Map();
    this.trails = new Map();
    this.maxTrailLength = 100;
    this.initialized = false;
    this.active = false;
    this.animFrame = null;

    // Settings
    this.options = {
      lineCount: 200,
      lineColor: '#ffdfc4',
      lineWidth: 0.5,
      distortRadius: 100,
      distortStrength: 10,
      springBack: 0.1,
      showAirborneAircraft: true,
      showGroundAircraft: false,
      aircraftIcon: 'glow',
      accentColor: '#FFDFC4',
      inboundColor: '',
      outboundColor: '',
      dotSize: 18,
      // Trail/label/aircraft overlay
      showTrails: false,
      showCallsigns: false,
      showAltitude: false,
      showSpeed: false,
      showRoute: false,
      showCoordinates: false,
      inboundLabelFormat: '{airline} {type} from {origin}',
      outboundLabelFormat: '{airline} {type} to {destination}',
      trailLength: 100,
      aircraftScale: 1.0,
      labelTextScale: 1.0,
      labelBgOpacity: 0.7,
      labelBgColor: '#000000'
    };
  }

  _hexToRgb(hex) {
    if (!hex || hex.length < 7) return { r: 255, g: 223, b: 196 };
    return {
      r: parseInt(hex.slice(1, 3), 16),
      g: parseInt(hex.slice(3, 5), 16),
      b: parseInt(hex.slice(5, 7), 16)
    };
  }

  setDisplayOptions(options) {
    if (!options) return;
    if (options.lineCount !== undefined) {
      this.options.lineCount = options.lineCount;
      if (this.initialized) this.initLines();
    }
    if (options.lineColor !== undefined) this.options.lineColor = options.lineColor;
    if (options.lineWidth !== undefined) this.options.lineWidth = options.lineWidth;
    if (options.distortRadius !== undefined) this.options.distortRadius = options.distortRadius;
    if (options.distortStrength !== undefined) this.options.distortStrength = options.distortStrength;
    if (options.springBack !== undefined) this.options.springBack = options.springBack;
    const keys = [
      'showAirborneAircraft', 'showGroundAircraft', 'aircraftIcon',
      'accentColor', 'inboundColor', 'outboundColor', 'dotSize',
      'showTrails', 'showCallsigns', 'showAltitude', 'showSpeed',
      'showRoute', 'showCoordinates', 'inboundLabelFormat',
      'outboundLabelFormat', 'aircraftScale', 'labelTextScale',
      'labelBgOpacity', 'labelBgColor'
    ];
    keys.forEach(k => { if (options[k] !== undefined) this.options[k] = options[k]; });
    if (options.trailLength !== undefined) {
      this.options.trailLength = options.trailLength;
      this.maxTrailLength = options.trailLength;
    }
  }

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

    window.addEventListener('resize', () => {
      if (this.active) {
        this.resizeWave();
        this.initLines();
      }
    });

    console.log('Wave visualization initialized');
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
        line.push({
          x,
          y,
          baseX: x,
          baseY: y
        });
      }
      this.lines.push(line);
    }
  }

  updateLines() {
    const radius = this.options.distortRadius;
    const maxSpeed = this.options.distortStrength;
    const spring = this.options.springBack;

    // Collect active aircraft positions
    const positions = [];
    for (const [id, aircraft] of this.aircraftPositions.entries()) {
      if (aircraft.altitude <= 0 && !this.options.showGroundAircraft) continue;
      positions.push({ x: aircraft.x, y: aircraft.y, velocity: aircraft.velocity });
    }

    this.lines.forEach(line => {
      line.forEach(point => {
        for (const pos of positions) {
          const dx = point.x - pos.x;
          const dy = point.y - pos.y;
          const distance = Math.sqrt(dx * dx + dy * dy);

          if (distance < radius) {
            const angle = Math.atan2(dy, dx);
            const force = (radius - distance) / radius;
            const speed = maxSpeed * (1 + (pos.velocity || 0) / 500);

            point.x += Math.cos(angle) * force * speed;
            point.y += Math.sin(angle) * force * speed;
          }
        }

        const springX = (point.baseX - point.x) * spring;
        const springY = (point.baseY - point.y) * spring;
        point.x += springX;
        point.y += springY;
      });
    });
  }

  drawLines() {
    if (!this.waveCtx) return;

    const ctx = this.waveCtx;
    const w = window.innerWidth;
    const h = window.innerHeight;

    ctx.clearRect(0, 0, w, h);

    this.lines.forEach(line => {
      if (line.length < 2) return;

      ctx.beginPath();
      ctx.moveTo(line[0].x, line[0].y);

      for (let i = 1; i < line.length; i++) {
        const prev = line[i - 1];
        const current = line[i];
        const midX = (prev.x + current.x) / 2;
        const midY = (prev.y + current.y) / 2;
        ctx.quadraticCurveTo(prev.x, prev.y, midX, midY);
      }

      ctx.strokeStyle = this.options.lineColor;
      ctx.lineWidth = this.options.lineWidth;
      ctx.stroke();
    });
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

  getAircraftColor(flight) {
    if (flight) {
      const isInbound = window.theArtOfFlight?.isInbound?.(flight);
      if (isInbound && this.options.inboundColor) return this.options.inboundColor;
      if (!isInbound && this.options.outboundColor) return this.options.outboundColor;
    }
    return this.options.accentColor;
  }

  getAirlineColor(callsign, flight) {
    if (flight) {
      const isInbound = window.theArtOfFlight?.isInbound?.(flight);
      if (isInbound && this.options.inboundColor) return this.options.inboundColor;
      if (!isInbound && this.options.outboundColor) return this.options.outboundColor;
    }
    const airlineColors = {
      'QFA': '#e21e3a', 'VOZ': '#cc0033', 'JST': '#ff6000',
      'UAL': '#0033a0', 'AAL': '#c8102e', 'DAL': '#003a70',
      'QTR': '#5c0633', 'UAE': '#c8102e', 'SIA': '#003087',
    };
    const code = (callsign || '').substring(0, 3);
    return airlineColors[code] || this.options.accentColor;
  }

  update(flights) {
    if (!this.active) return;

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

    for (const [id, aircraft] of this.aircraftPositions.entries()) {
      const ease = 0.08;
      aircraft.x += (aircraft.targetX - aircraft.x) * ease;
      aircraft.y += (aircraft.targetY - aircraft.y) * ease;

      const isOnGround = aircraft.altitude <= 0;
      if (!(isOnGround && !this.options.showGroundAircraft)) {
        // Trail tracking
        if (!this.trails.has(id)) this.trails.set(id, []);
        const trail = this.trails.get(id);
        if (trail.length === 0 ||
            Math.abs(aircraft.x - trail[trail.length - 1].x) > 2 ||
            Math.abs(aircraft.y - trail[trail.length - 1].y) > 2) {
          trail.push({ x: aircraft.x, y: aircraft.y, time: now });
        }
        if (trail.length > this.maxTrailLength) trail.shift();
      }

      if (now - aircraft.lastUpdate > 30000) {
        this.aircraftPositions.delete(id);
        this.trails.delete(id);
      }
    }
  }

  latLonToScreen(lat, lon) {
    if (window.theArtOfFlight?.coordSystem?.isLocked) {
      return window.theArtOfFlight.coordSystem.toScreen(lat, lon);
    }
    return { x: (this.canvas.clientWidth || this.canvas.width) / 2, y: (this.canvas.clientHeight || this.canvas.height) / 2 };
  }

  formatRouteText(flight) {
    if (!flight) return '';
    const isInbound = window.theArtOfFlight?.isInbound?.(flight);
    const template = isInbound
      ? (this.options.inboundLabelFormat || '')
      : (this.options.outboundLabelFormat || '');

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

  drawAircraftMarker(x, y, heading, color) {
    this.ctx.save();
    this.ctx.translate(x, y);
    this.ctx.rotate((heading || 0) * Math.PI / 180);
    const size = 15 * this.options.aircraftScale;
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
    const s = this.options.labelTextScale;
    const bgAlpha = this.options.labelBgOpacity;

    // Draw trails
    if (this.options.showTrails) {
      for (const [id, trail] of this.trails.entries()) {
        if (trail.length < 2) continue;
        const aircraft = this.aircraftPositions.get(id);
        if (!aircraft) continue;
        const trailOpacity = aircraft.flight?.opacity ?? 1;
        this.ctx.strokeStyle = aircraft.color;
        this.ctx.lineWidth = 2;
        this.ctx.globalAlpha = 0.3 * trailOpacity;
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
      if (aircraft.altitude <= 0 && !this.options.showGroundAircraft) continue;
      const opacity = aircraft.flight?.opacity ?? 1;
      this.ctx.globalAlpha = opacity;

      // Draw aircraft icon
      if (this.options.showAirborneAircraft && aircraft.altitude > 0) {
        drawAircraftIcon(this.ctx, aircraft.x, aircraft.y, aircraft.heading,
          aircraft.color, this.options.aircraftIcon, this.options.aircraftScale,
          this.options.dotSize, opacity);
      } else if (aircraft.altitude <= 0 && this.options.showGroundAircraft) {
        drawAircraftIcon(this.ctx, aircraft.x, aircraft.y, aircraft.heading,
          aircraft.color, this.options.aircraftIcon, this.options.aircraftScale,
          this.options.dotSize, opacity);
      }

      // Labels
      let routeText = '';
      if (this.options.showRoute) routeText = this.formatRouteText(aircraft.flight);

      const showAnyLabel = this.options.showCallsigns ||
                          this.options.showAltitude ||
                          this.options.showSpeed ||
                          routeText ||
                          this.options.showCoordinates;

      if (showAnyLabel) {
        let lineCount = 0;
        if (this.options.showCallsigns) lineCount++;
        if (routeText) lineCount++;
        if (this.options.showAltitude || this.options.showSpeed) lineCount++;
        if (this.options.showCoordinates) lineCount++;

        const lineH = Math.round(14 * s);
        const labelWidth = Math.round(150 * s);
        const labelHeight = Math.round(10 * s) + (lineCount * lineH);
        const labelX = aircraft.x + 20;
        const labelY = aircraft.y - 10 - labelHeight;

        this.ctx.fillStyle = getLabelBgStyle(this.options.labelBgColor, bgAlpha);
        this.ctx.fillRect(labelX, labelY, labelWidth, labelHeight);

        let currentY = labelY + lineH;

        if (this.options.showCallsigns) {
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

        if (this.options.showAltitude || this.options.showSpeed) {
          this.ctx.fillStyle = '#aaa';
          this.ctx.font = `${Math.round(11 * s)}px monospace`;
          let dataText = '';
          if (this.options.showAltitude) dataText += `${Math.round(aircraft.altitude)}ft`;
          if (this.options.showSpeed) {
            if (dataText) dataText += ' \u2022 ';
            dataText += `${Math.round(aircraft.velocity)}kts`;
          }
          this.ctx.fillText(dataText, labelX + 5, currentY);
          currentY += lineH;
        }

        if (this.options.showCoordinates) {
          this.ctx.fillStyle = '#666';
          this.ctx.font = `${Math.round(9 * s)}px monospace`;
          this.ctx.fillText(`${aircraft.lat.toFixed(4)}, ${aircraft.lon.toFixed(4)}`, labelX + 5, currentY);
        }
      }

      this.ctx.globalAlpha = 1;
    }
  }

  clear() {
    this.aircraftPositions.clear();
    this.trails.clear();
    this.lines = [];
    this.hide();
  }
}
