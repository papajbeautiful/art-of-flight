/**
 * Ripple Mode: Liquid Background (threejs-components)
 * Aircraft trigger displacement on a full-screen liquid WebGL layer
 * Credit: Kevin Levron — CC BY-NC-SA 4.0
 * https://codepen.io/soju22/pen/wvyBorP
 */
class RippleVisualization {
  constructor(canvas, ctx) {
    this.canvas = canvas;
    this.ctx = ctx;
    this.rippleCanvas = document.getElementById('rippleCanvas');
    this.rippleLayer = document.getElementById('rippleLayer');
    this.aircraftPositions = new Map();
    this.trails = new Map();
    this.maxTrailLength = 100;
    this.liquidApp = null;
    this.initialized = false;
    this.active = false;

    // Virtual pointer — smoothly follows aircraft
    this.virtualX = null;
    this.virtualY = null;
    this.focusIndex = 0;
    this.focusStartTime = 0;

    // Settings
    this.options = {
      backgroundImage: '',
      displacementScale: 5,
      metalness: 0.75,
      roughness: 0.25,
      showAirborneAircraft: true,
      showGroundAircraft: false,
      aircraftIcon: 'glow',
      accentColor: '#00F0FF',
      inboundColor: '',
      outboundColor: '',
      dotSize: 8,
      focusDuration: 3000,
      trackingSpeed: 0.25,
      trackAllAircraft: false,
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
    if (!hex || hex.length < 7) return { r: 0, g: 240, b: 255 };
    return {
      r: parseInt(hex.slice(1, 3), 16),
      g: parseInt(hex.slice(3, 5), 16),
      b: parseInt(hex.slice(5, 7), 16)
    };
  }

  setDisplayOptions(options) {
    if (!options) return;
    const keys = [
      'displacementScale', 'metalness', 'roughness', 'showAirborneAircraft',
      'showGroundAircraft', 'aircraftIcon', 'accentColor', 'inboundColor',
      'outboundColor', 'dotSize', 'focusDuration', 'trackingSpeed',
      'trackAllAircraft', 'showTrails', 'showCallsigns', 'showAltitude',
      'showSpeed', 'showRoute', 'showCoordinates', 'inboundLabelFormat',
      'outboundLabelFormat', 'aircraftScale', 'labelTextScale',
      'labelBgOpacity', 'labelBgColor'
    ];
    keys.forEach(k => { if (options[k] !== undefined) this.options[k] = options[k]; });
    if (options.trailLength !== undefined) {
      this.options.trailLength = options.trailLength;
      this.maxTrailLength = options.trailLength;
    }

    // Live-update material properties
    if (this.liquidApp?.liquidPlane) {
      this.liquidApp.liquidPlane.material.metalness = this.options.metalness;
      this.liquidApp.liquidPlane.material.roughness = this.options.roughness;
      if (this.liquidApp.liquidPlane.uniforms?.displacementScale) {
        this.liquidApp.liquidPlane.uniforms.displacementScale.value = this.options.displacementScale;
      }
    }

    // Handle background image as liquid texture
    if (options.backgroundImage !== undefined) {
      this.options.backgroundImage = options.backgroundImage;
      if (this.liquidApp) {
        if (options.backgroundImage) {
          this.liquidApp.loadImage(options.backgroundImage);
        }
      }
    }
  }

  showRipples() {
    if (this.rippleLayer) this.rippleLayer.style.display = 'block';
    this.active = true;

    if (!this.initialized) {
      this.initLiquid();
    }
  }

  hideRipples() {
    if (this.rippleLayer) this.rippleLayer.style.display = 'none';
    this.active = false;
  }

  async initLiquid() {
    if (!this.rippleCanvas) {
      console.warn('Ripple canvas not found');
      return;
    }

    try {
      // Block real mouse/pointer/touch events at WINDOW level BEFORE library init.
      // The library may register event handlers on window/document during init.
      // By adding our capture-phase handler first, we can block trusted events.
      this._blockMouseEvents();

      const { default: LiquidBackground } = await import('https://cdn.jsdelivr.net/npm/threejs-components@0.0.27/build/backgrounds/liquid1.min.js');

      this.liquidApp = LiquidBackground(this.rippleCanvas);

      // Use user's background image as liquid texture, or skip for plain dark surface
      if (this.options.backgroundImage) {
        this.liquidApp.loadImage(this.options.backgroundImage);
      }

      this.liquidApp.liquidPlane.material.metalness = this.options.metalness;
      this.liquidApp.liquidPlane.material.roughness = this.options.roughness;
      this.liquidApp.liquidPlane.uniforms.displacementScale.value = this.options.displacementScale;
      this.liquidApp.setRain(false);

      // Also force pointer-events:none on the canvas itself
      this.rippleCanvas.style.pointerEvents = 'none';

      this.initialized = true;
      console.log('Liquid Background initialized');
    } catch (e) {
      console.error('Failed to initialize Liquid Background:', e);
      this.initialized = false;
    }
  }

  _blockMouseEvents() {
    // Block all trusted pointer/mouse/touch events at the window capture phase
    // when ripple mode is active. Programmatic events (isTrusted=false) pass through.
    const eventTypes = ['pointermove', 'pointerdown', 'pointerup',
                        'mousemove', 'mousedown', 'mouseup',
                        'touchmove', 'touchstart', 'touchend'];

    this._windowBlockers = [];
    eventTypes.forEach(type => {
      const blocker = (e) => {
        if (!this.active || !e.isTrusted) return;
        // Don't block UI elements (settings, mode selector, buttons, etc.)
        if (e.target && e.target.closest &&
            e.target.closest('#settingsPanel, .settings-btn, .mode-selector, .info-overlay, button, input, select, textarea, label, a')) {
          return;
        }
        e.stopImmediatePropagation();
      };
      window.addEventListener(type, blocker, { capture: true });
      this._windowBlockers.push({ type, blocker });
    });
  }

  _removeMouseBlockers() {
    if (this._windowBlockers) {
      this._windowBlockers.forEach(({ type, blocker }) => {
        window.removeEventListener(type, blocker, { capture: true });
      });
      this._windowBlockers = null;
    }
  }

  destroyLiquid() {
    if (this.liquidApp) {
      try {
        if (this.liquidApp.dispose) this.liquidApp.dispose();
      } catch (e) { /* ok */ }
    }
    this.liquidApp = null;
    this.initialized = false;
    this.virtualX = null;
    this.virtualY = null;
    this._removeMouseBlockers();
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

    // Smooth interpolation + collect active aircraft + trail tracking
    const activeAircraft = [];
    for (const [id, aircraft] of this.aircraftPositions.entries()) {
      const ease = 0.08;
      aircraft.x += (aircraft.targetX - aircraft.x) * ease;
      aircraft.y += (aircraft.targetY - aircraft.y) * ease;

      const isOnGround = aircraft.altitude <= 0;
      if (!(isOnGround && !this.options.showGroundAircraft)) {
        activeAircraft.push(aircraft);

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

    // Drive the liquid effect with virtual pointer(s)
    if (activeAircraft.length > 0 && this.initialized && this.rippleCanvas) {
      const rect = this.rippleCanvas.getBoundingClientRect();

      if (this.options.trackAllAircraft) {
        // Dispatch a pointermove for each aircraft every frame
        for (const ac of activeAircraft) {
          this.rippleCanvas.dispatchEvent(new PointerEvent('pointermove', {
            clientX: ac.x + rect.left,
            clientY: ac.y + rect.top,
            bubbles: true
          }));
        }
      } else {
        // Single smooth virtual pointer cycling through aircraft
        if (!this.focusStartTime || now - this.focusStartTime > this.options.focusDuration) {
          this.focusIndex = (this.focusIndex + 1) % activeAircraft.length;
          this.focusStartTime = now;
        }

        const target = activeAircraft[this.focusIndex % activeAircraft.length];

        if (this.virtualX == null) {
          this.virtualX = target.x;
          this.virtualY = target.y;
        }

        this.virtualX += (target.x - this.virtualX) * this.options.trackingSpeed;
        this.virtualY += (target.y - this.virtualY) * this.options.trackingSpeed;

        this.rippleCanvas.dispatchEvent(new PointerEvent('pointermove', {
          clientX: this.virtualX + rect.left,
          clientY: this.virtualY + rect.top,
          bubbles: true
        }));
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
    this.destroyLiquid();
    this.hideRipples();
  }
}
