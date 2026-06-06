/**
 * Grid Mode: Neural Grid Cursor Reveal with Auto Fade
 * Aircraft positions light up neon grid cells that fade over time
 * Credit: Gaurav Gajjar — MIT License
 * https://codepen.io/gauravgajjar/pen/azvvWPx
 */
class BirdsVisualization {
  constructor(canvas, ctx) {
    this.canvas = canvas;
    this.ctx = ctx;
    this.gridLayer = document.getElementById('gridLayer');
    this.gridCanvas = document.getElementById('gridCanvas');
    this.gridCtx = null;
    this.grid = [];
    this.aircraftPositions = new Map();
    this.trails = new Map();
    this.maxTrailLength = 100;
    this.initialized = false;
    this.active = false;
    this.animFrame = null;

    // Settings
    this.options = {
      squareSize: 10,
      glowColor: '#00FFCC',
      fadeDelay: 500,
      fadeSpeed: 0.02,
      showAirborneAircraft: true,
      showGroundAircraft: false,
      aircraftIcon: 'glow',
      accentColor: '#00FFCC',
      inboundColor: '',
      outboundColor: '',
      dotSize: 8,
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

    // Cached RGB string for grid drawing
    this._glowRgb = '0, 255, 204';
  }

  _hexToRgb(hex) {
    if (!hex || hex.length < 7) return { r: 0, g: 255, b: 204 };
    return {
      r: parseInt(hex.slice(1, 3), 16),
      g: parseInt(hex.slice(3, 5), 16),
      b: parseInt(hex.slice(5, 7), 16)
    };
  }

  _hexToRgbString(hex) {
    const { r, g, b } = this._hexToRgb(hex);
    return `${r}, ${g}, ${b}`;
  }

  setDisplayOptions(options) {
    if (!options) return;
    if (options.squareSize !== undefined) {
      this.options.squareSize = options.squareSize;
      if (this.initialized) this.initGrid();
    }
    if (options.glowColor !== undefined) {
      this.options.glowColor = options.glowColor;
      this._glowRgb = this._hexToRgbString(options.glowColor);
    }
    if (options.fadeDelay !== undefined) this.options.fadeDelay = options.fadeDelay;
    if (options.fadeSpeed !== undefined) this.options.fadeSpeed = options.fadeSpeed;
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
    if (this.gridLayer) this.gridLayer.style.display = 'block';
    this.active = true;

    if (!this.initialized) {
      this.initGridCanvas();
    }
    this.startAnimation();
  }

  hide() {
    if (this.gridLayer) this.gridLayer.style.display = 'none';
    this.active = false;
    this.stopAnimation();
  }

  initGridCanvas() {
    if (!this.gridCanvas) return;

    this.gridCtx = this.gridCanvas.getContext('2d');
    this.resizeGrid();
    this.initGrid();
    this.initialized = true;

    window.addEventListener('resize', () => {
      if (this.active) {
        this.resizeGrid();
        this.initGrid();
      }
    });

    console.log('Grid visualization initialized');
  }

  resizeGrid() {
    if (!this.gridCanvas) return;
    this.gridCanvas.width = window.innerWidth;
    this.gridCanvas.height = window.innerHeight;
  }

  initGrid() {
    this.grid = [];
    const w = this.gridCanvas?.width || window.innerWidth;
    const h = this.gridCanvas?.height || window.innerHeight;
    const size = this.options.squareSize;

    for (let x = 0; x < w; x += size) {
      for (let y = 0; y < h; y += size) {
        this.grid.push({
          x,
          y,
          alpha: 0,
          fading: false,
          lastTouched: 0
        });
      }
    }
  }

  getCellAt(x, y) {
    const size = this.options.squareSize;
    const col = Math.floor(x / size);
    const row = Math.floor(y / size);
    const idx = col * Math.ceil((this.gridCanvas?.height || window.innerHeight) / size) + row;
    return this.grid[idx] || null;
  }

  lightUpCell(x, y) {
    const cell = this.getCellAt(x, y);
    if (cell && cell.alpha === 0) {
      cell.alpha = 1;
      cell.lastTouched = Date.now();
      cell.fading = false;
    }
  }

  startAnimation() {
    if (this.animFrame) return;
    const animate = () => {
      this.drawGrid();
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

  drawGrid() {
    if (!this.gridCtx || !this.gridCanvas) return;

    const ctx = this.gridCtx;
    const w = this.gridCanvas.width;
    const h = this.gridCanvas.height;
    const size = this.options.squareSize;
    const color = this._glowRgb;
    const now = Date.now();

    ctx.clearRect(0, 0, w, h);

    for (let i = 0; i < this.grid.length; i++) {
      const cell = this.grid[i];

      if (cell.alpha > 0 && !cell.fading && now - cell.lastTouched > this.options.fadeDelay) {
        cell.fading = true;
      }

      if (cell.fading) {
        cell.alpha -= this.options.fadeSpeed;
        if (cell.alpha <= 0) {
          cell.alpha = 0;
          cell.fading = false;
        }
      }

      if (cell.alpha > 0) {
        const centerX = cell.x + size / 2;
        const centerY = cell.y + size / 2;

        const gradient = ctx.createRadialGradient(
          centerX, centerY, 5,
          centerX, centerY, size
        );
        gradient.addColorStop(0, `rgba(${color}, ${cell.alpha})`);
        gradient.addColorStop(1, `rgba(${color}, 0)`);

        ctx.strokeStyle = gradient;
        ctx.lineWidth = 1.3;
        ctx.strokeRect(cell.x + 0.5, cell.y + 0.5, size - 1, size - 1);
      }
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
      if (isOnGround && !this.options.showGroundAircraft) continue;

      // Light up grid cells at aircraft position
      this.lightUpCell(aircraft.x, aircraft.y);

      // Trail tracking
      if (!this.trails.has(id)) this.trails.set(id, []);
      const trail = this.trails.get(id);
      if (trail.length === 0 ||
          Math.abs(aircraft.x - trail[trail.length - 1].x) > 2 ||
          Math.abs(aircraft.y - trail[trail.length - 1].y) > 2) {
        trail.push({ x: aircraft.x, y: aircraft.y, time: now });
      }
      if (trail.length > this.maxTrailLength) trail.shift();

      // Remove stale aircraft
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
    return { x: this.canvas.width / 2, y: this.canvas.height / 2 };
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
    this.grid = [];
    this.hide();
  }
}
