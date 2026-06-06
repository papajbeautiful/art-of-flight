/**
 * Main Application
 * theARTofFLIGHT - Museum-grade flight visualization art installation
 */

// URL overrides (testing/kiosk):
//   ?mode=reality        force a visualization mode for this session
//   ?mock=1              serve a frozen flight fixture from the server
//   ?deterministic=1     seeded random + default settings, for reproducible screenshots
const URL_PARAMS = new URLSearchParams(window.location.search);
window.__DETERMINISTIC__ = URL_PARAMS.get('deterministic') === '1';

if (window.__DETERMINISTIC__) {
  // Seeded PRNG (mulberry32) so per-frame randomness is reproducible
  let __seed = 0x2F6E2B1;
  Math.random = function () {
    __seed |= 0; __seed = (__seed + 0x6D2B79F5) | 0;
    let t = Math.imul(__seed ^ (__seed >>> 15), 1 | __seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  // Accumulated patterns art would differ run-to-run — start clean
  try { localStorage.removeItem('theARTofFLIGHT_patterns'); } catch (e) { /* ok */ }
}

class TheArtOfFlight {
  constructor() {
    this.canvas = document.getElementById('canvas');
    this.ctx = this.canvas.getContext('2d');

    this.flightManager = new FlightManager();
    this.settingsManager = new SettingsManager();

    // Initialize stable coordinate system
    this.coordSystem = new CoordinateSystem(this.canvas);

    // Per-mode background images: { mode: { image: Image, url: string } }
    this.backgroundImages = {};

    // Google Maps API state
    this.googleMapsLoaded = false;
    this.googleMapsLoading = false;

    // Initialize visualizations
    this.visualizations = {
      ripple: new RippleVisualization(this.canvas, this.ctx),
      reality: new RealityVisualization(this.canvas, this.ctx),
      birds: new BirdsVisualization(this.canvas, this.ctx),
      constellation: new ConstellationVisualization(this.canvas, this.ctx),
      tubes: new TubesVisualization(this.canvas, this.ctx),
      map: new MapVisualization(this.canvas, this.ctx),
      patterns: new PatternsVisualization(this.canvas, this.ctx)
    };

    // ?mode= URL override (session-only; not persisted unless the user saves)
    const urlMode = URL_PARAMS.get('mode');
    if (urlMode && this.visualizations[urlMode]) {
      this.settingsManager.set('mode', urlMode);
      this.settingsManager.updateUI();
    }

    this.currentMode = this.settingsManager.get('mode');
    this.previousMode = null;
    this.transitionProgress = 1;
    this.isTransitioning = false;
    this.isRunning = false;

    this.init();
  }

  init() {
    this.resizeCanvas();
    window.addEventListener('resize', () => this.resizeCanvas());

    // Show initial mode's layer
    this.activateModeLayer(this.currentMode);

    this.applySettings(this.settingsManager.settings);

    this.settingsManager.onChange((settings) => {
      this.applySettings(settings);
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'i' || e.key === 'I') {
        this.settingsManager.toggleInfo();
      }
    });

    this.fetchServerConfig();
    this.start();
  }

  resizeCanvas() {
    // Hi-DPI: render at device resolution while all drawing code keeps
    // working in CSS-pixel units (CSS displays the canvas at 100vw/100vh).
    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = Math.round(window.innerWidth * dpr);
    this.canvas.height = Math.round(window.innerHeight * dpr);
    // Setting width/height resets the context transform — reapply the DPR scale
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  /** Logical (CSS pixel) canvas dimensions — use these for layout math */
  get viewWidth() { return this.canvas.clientWidth || window.innerWidth; }
  get viewHeight() { return this.canvas.clientHeight || window.innerHeight; }

  applySettings(settings) {
    // Update flight manager
    this.flightManager.setLocation(
      settings.locationName,
      settings.latitude,
      settings.longitude
    );
    this.flightManager.setRadius(settings.radius);
    this.flightManager.setUpdateInterval(settings.updateInterval);
    this.flightManager.setMaxFlights(settings.maxFlights);

    // Update per-mode background images
    this.updateBackgroundImages(settings);

    // Load Google Maps API if key is available
    const apiKey = settings.googleMapsApiKey;
    if (apiKey && !this.googleMapsLoaded && !this.googleMapsLoading) {
      this.loadGoogleMapsAPI(apiKey);
    }

    // Update visualization mode with transition
    if (this.currentMode !== settings.mode) {
      this.switchMode(settings.mode);
    }

    // Distribute per-mode settings to each visualization
    this.distributeSettings(settings);

    // Apply per-mode UI accent color
    this.applyUIAccentColor(settings);

    // Update info overlay
    const infoOverlay = document.getElementById('infoOverlay');
    if (settings.showInfoPanel) {
      infoOverlay.classList.remove('hidden');
    } else {
      infoOverlay.classList.add('hidden');
    }
  }

  /**
   * Send per-mode settings to each visualization
   */
  distributeSettings(settings) {
    const modeSettings = settings.modeSettings || {};

    Object.keys(this.visualizations).forEach(mode => {
      const viz = this.visualizations[mode];
      if (viz.setDisplayOptions && modeSettings[mode]) {
        viz.setDisplayOptions(modeSettings[mode]);
      }
    });
  }

  /**
   * Format a flight label using the current mode's labelFormat template.
   * Variables: {airline}, {type}, {callsign}, {origin}, {destination}, {altitude}, {speed}
   * Produces text like "Qantas A380 to Melbourne" from "{airline} {type} to {destination}"
   * Falls back to "Origin → Destination" if no template or no data matches.
   */
  /**
   * Determine if a flight is inbound (destination near home) or outbound (origin near home)
   */
  isInbound(flight) {
    const homeLat = this.settingsManager.settings.latitude;
    const homeLon = this.settingsManager.settings.longitude;
    const radius = this.settingsManager.settings.radius;

    // Check if destination airport is close to home (inbound)
    if (flight.destinationLat && flight.destinationLon) {
      const dLat = flight.destinationLat - homeLat;
      const dLon = flight.destinationLon - homeLon;
      const dist = Math.sqrt(dLat * dLat + dLon * dLon) * 111;
      if (dist < radius * 1.5) return true;
    }

    // Heuristic: if heading roughly toward home, likely inbound
    if (flight.heading !== undefined && flight.latitude && flight.longitude) {
      const bearingToHome = Math.atan2(homeLon - flight.longitude, homeLat - flight.latitude) * 180 / Math.PI;
      const normalized = ((bearingToHome - flight.heading + 540) % 360) - 180;
      if (Math.abs(normalized) < 60) return true;
    }

    return false;
  }

  formatLabel(flight) {
    const modeOpts = this.settingsManager.settings.modeSettings?.[this.currentMode] || {};

    // Pick template based on inbound/outbound
    const inbound = this.isInbound(flight);
    const template = inbound
      ? (modeOpts.inboundLabelFormat || modeOpts.labelFormat || '')
      : (modeOpts.outboundLabelFormat || modeOpts.labelFormat || '');

    const airline = flight.airlineName || '';
    const type = flight.aircraftType || '';
    const callsign = flight.callsign || '';
    const origin = flight.originCity || '';
    const destination = flight.destinationCity || '';
    const altitude = flight.altitudeFeet ? `${Math.round(flight.altitudeFeet).toLocaleString()}ft` : '';
    const speed = flight.velocityKnots ? `${Math.round(flight.velocityKnots)}kts` : '';

    if (template && (origin || destination || airline)) {
      let text = template
        .replace(/\{airline\}/gi, airline)
        .replace(/\{type\}/gi, type)
        .replace(/\{callsign\}/gi, callsign)
        .replace(/\{origin\}/gi, origin)
        .replace(/\{destination\}/gi, destination)
        .replace(/\{altitude\}/gi, altitude)
        .replace(/\{speed\}/gi, speed);

      // Clean up: collapse multiple spaces, trim dangling words like "to" at end
      text = text.replace(/\s{2,}/g, ' ').trim();
      text = text.replace(/\b(to|from|via)\s*$/i, '').trim();
      if (text && text !== callsign) return text;
    }

    // Fallback: classic format
    if (origin && destination) return `${origin} \u2192 ${destination}`;
    if (origin) return `From ${origin}`;
    if (destination) return `To ${destination}`;
    return '';
  }

  /**
   * Apply the active mode's UI accent color to CSS variables
   */
  applyUIAccentColor(settings) {
    const mode = settings.mode || this.currentMode;
    const modeOpts = settings.modeSettings?.[mode] || {};
    const color = modeOpts.uiAccentColor || '#00F0FF';

    const root = document.documentElement;
    root.style.setProperty('--accent', color);

    // Derive dim/glow variants
    const r = parseInt(color.slice(1, 3), 16);
    const g = parseInt(color.slice(3, 5), 16);
    const b = parseInt(color.slice(5, 7), 16);
    root.style.setProperty('--accent-dim', `rgba(${r}, ${g}, ${b}, 0.15)`);
    root.style.setProperty('--accent-glow', `rgba(${r}, ${g}, ${b}, 0.4)`);
  }

  activateModeLayer(mode) {
    const layerMethods = {
      map: 'showMap',
      ripple: 'showRipples',
      birds: 'show',
      constellation: 'show',
      tubes: 'show'
    };
    const method = layerMethods[mode];
    if (method && this.visualizations[mode]?.[method]) {
      this.visualizations[mode][method]();
    }
  }

  switchMode(newMode) {
    console.log(`Transitioning from ${this.currentMode} to ${newMode}`);

    // If switching TO patterns mode, fully clear canvas first
    if (newMode === 'patterns') {
      this.ctx.fillStyle = '#000000';
      this.ctx.fillRect(0, 0, this.viewWidth, this.viewHeight);
    }

    // Show/hide layer-based visualizations
    const layerModes = {
      map: { show: 'showMap', hide: 'hideMap' },
      ripple: { show: 'showRipples', hide: 'hideRipples' },
      birds: { show: 'show', hide: 'hide' },
      constellation: { show: 'show', hide: 'hide' },
      tubes: { show: 'show', hide: 'hide' }
    };

    // Hide previous layer mode
    if (layerModes[this.currentMode]) {
      const viz = this.visualizations[this.currentMode];
      const method = layerModes[this.currentMode].hide;
      if (viz[method]) viz[method]();
    }

    // Show new layer mode
    if (layerModes[newMode]) {
      const viz = this.visualizations[newMode];
      const method = layerModes[newMode].show;
      if (viz[method]) viz[method]();
    }

    this.previousMode = this.currentMode;
    this.currentMode = newMode;
    this.isTransitioning = true;
    this.transitionProgress = 0;

    this.animateTransition();
  }

  animateTransition() {
    const duration = 1000;
    const startTime = Date.now();

    const animate = () => {
      const elapsed = Date.now() - startTime;
      this.transitionProgress = Math.min(elapsed / duration, 1);

      if (this.transitionProgress < 1) {
        requestAnimationFrame(animate);
      } else {
        this.isTransitioning = false;

        if (this.previousMode && this.visualizations[this.previousMode]) {
          this.visualizations[this.previousMode].clear();
        }

        console.log(`Transition complete: now in ${this.currentMode} mode`);
      }
    };

    animate();
  }

  async start() {
    if (this.isRunning) return;

    this.isRunning = true;
    this.updateStatus('Initializing...');

    // Show ripple layer if starting in ripple mode
    if (this.currentMode === 'ripple') {
      this.visualizations.ripple.showRipples();
    }

    await this.updateFlights();
    this.animate();
    this.startFlightUpdates();
  }

  async updateFlights() {
    try {
      this.updateStatus('Scanning airspace...');
      const flights = await this.flightManager.fetchFlights();

      if (flights.length > 0) {
        if (!this.coordSystem.isLocked) {
          const settings = this.settingsManager.settings;
          this.coordSystem.lockToUserLocation(
            settings.latitude,
            settings.longitude,
            settings.radius
          );
        }

        this.updateStatus(`${flights.length} aircraft overhead`);
        this.updateFlightInfo(flights);
      } else {
        this.updateStatus('No aircraft detected');
      }
    } catch (error) {
      console.error('Failed to update flights:', error);
      this.updateStatus('Signal lost');
    }
  }

  startFlightUpdates() {
    setInterval(async () => {
      await this.updateFlights();
    }, this.settingsManager.get('updateInterval') * 1000);
  }

  updateStatus(message) {
    const statusText = document.getElementById('statusText');
    if (statusText) {
      statusText.textContent = message;
    }
  }

  /**
   * Graceful info panel update — DOM diffing with enter/exit animations.
   * New flights slide in, exiting flights fade out, existing flights update in-place.
   */
  updateFlightInfo(flights) {
    const flightInfo = document.getElementById('flightInfo');
    if (!flightInfo) return;

    // Track currently displayed flight IDs
    if (!this._displayedFlights) this._displayedFlights = new Map();

    const topFlights = flights.slice(0, 8);
    const newIds = new Set(topFlights.map(f => f.icao24));

    // Phase 1: Mark flights that left for exit animation
    for (const [id, el] of this._displayedFlights.entries()) {
      if (!newIds.has(id)) {
        if (!el.classList.contains('flight-item-exit')) {
          el.classList.add('flight-item-exit');
          // Remove after animation
          setTimeout(() => {
            if (el.parentNode) el.parentNode.removeChild(el);
            this._displayedFlights.delete(id);
          }, 400);
        }
      }
    }

    // Phase 2: Update existing + add new flights
    topFlights.forEach((flight, index) => {
      const id = flight.icao24;
      const existing = this._displayedFlights.get(id);

      const altitude = flight.altitudeFeet
        ? `${Math.round(flight.altitudeFeet).toLocaleString()}ft`
        : '';
      const speed = flight.velocityKnots ? `${Math.round(flight.velocityKnots)}kts` : '';
      const distance = flight.distance ? `${flight.distance.toFixed(1)}km` : '';

      const airlineName = flight.airlineName || null;
      const airlineColor = flight.airlineColor || '#888888';
      const originCity = flight.originCity || null;
      const destinationCity = flight.destinationCity || null;

      // Build route text using label format template
      const routeText = this.formatLabel(flight);

      const dataParts = [altitude, speed, distance].filter(Boolean);
      const dataLine = dataParts.join(' \u2022 ');

      if (existing && !existing.classList.contains('flight-item-exit')) {
        // Update in-place — just change text content, no re-render
        const airlineEl = existing.querySelector('.flight-airline');
        const callsignEl = existing.querySelector('.flight-callsign');
        const routeEl = existing.querySelector('.flight-route');
        const detailsEl = existing.querySelector('.flight-details');

        if (airlineName) {
          if (airlineEl) {
            airlineEl.textContent = airlineName;
          } else {
            const el = document.createElement('div');
            el.className = 'flight-airline';
            el.textContent = airlineName;
            existing.insertBefore(el, existing.firstChild);
          }
        }

        if (callsignEl) {
          callsignEl.textContent = flight.callsign + (flight.aircraftType ? ' \u2022 ' + flight.aircraftType : '');
        }

        if (routeText) {
          if (routeEl) {
            routeEl.textContent = routeText;
          } else {
            const el = document.createElement('div');
            el.className = 'flight-route';
            el.textContent = routeText;
            // Insert after callsign
            const after = callsignEl || existing.firstChild;
            if (after && after.nextSibling) {
              existing.insertBefore(el, after.nextSibling);
            } else {
              existing.appendChild(el);
            }
          }
        }

        if (detailsEl) {
          detailsEl.textContent = dataLine;
        }

        existing.style.borderLeftColor = airlineColor;
      } else if (!existing) {
        // Create new flight element with enter animation
        const el = document.createElement('div');
        el.className = 'flight-item flight-item-enter';
        el.dataset.flightId = id;
        el.style.borderLeftColor = airlineColor;
        el.style.animationDelay = `${index * 0.05}s`;

        if (airlineName) {
          const airEl = document.createElement('div');
          airEl.className = 'flight-airline';
          airEl.textContent = airlineName;
          el.appendChild(airEl);
        }

        const csEl = document.createElement('div');
        csEl.className = 'flight-callsign';
        csEl.textContent = flight.callsign + (flight.aircraftType ? ' \u2022 ' + flight.aircraftType : '');
        el.appendChild(csEl);

        if (routeText) {
          const rtEl = document.createElement('div');
          rtEl.className = 'flight-route';
          rtEl.textContent = routeText;
          el.appendChild(rtEl);
        }

        if (dataLine) {
          const dtEl = document.createElement('div');
          dtEl.className = 'flight-details';
          dtEl.textContent = dataLine;
          el.appendChild(dtEl);
        }

        flightInfo.appendChild(el);
        this._displayedFlights.set(id, el);
      }
    });

    // Show empty state if no flights
    if (topFlights.length === 0 && this._displayedFlights.size === 0) {
      if (!flightInfo.querySelector('.no-signal')) {
        const p = document.createElement('p');
        p.className = 'no-signal';
        p.style.cssText = 'opacity: 0.3; font-size: 9px;';
        p.textContent = 'NO SIGNAL';
        flightInfo.appendChild(p);
      }
    } else {
      const noSignal = flightInfo.querySelector('.no-signal');
      if (noSignal) noSignal.remove();
    }
  }

  animate() {
    if (!this.isRunning) return;

    // Clear canvas based on mode
    // Layer-based modes need transparent canvas so their DOM layer shows through
    const layerBasedModes = ['map', 'ripple', 'birds', 'constellation', 'tubes'];
    if (layerBasedModes.includes(this.currentMode)) {
      this.ctx.clearRect(0, 0, this.viewWidth, this.viewHeight);
    } else if (this.currentMode === 'patterns') {
      this.ctx.fillStyle = '#000000';
      this.ctx.fillRect(0, 0, this.viewWidth, this.viewHeight);
      this.drawBackground();
    } else {
      this.ctx.fillStyle = 'rgba(10, 10, 10, 0.15)';
      this.ctx.fillRect(0, 0, this.viewWidth, this.viewHeight);
      this.drawBackground();
    }

    // Get current flights
    const flights = this.flightManager.getFlights();

    if (this.isTransitioning) {
      const easeProgress = this.easeInOutCubic(this.transitionProgress);

      if (this.previousMode && this.visualizations[this.previousMode]) {
        this.ctx.globalAlpha = 1 - easeProgress;
        this.visualizations[this.previousMode].update(flights);
        this.visualizations[this.previousMode].draw();
      }

      this.ctx.globalAlpha = easeProgress;
      const currentViz = this.visualizations[this.currentMode];
      if (currentViz) {
        currentViz.update(flights);
        currentViz.draw();
      }

      this.ctx.globalAlpha = 1;
    } else {
      const currentViz = this.visualizations[this.currentMode];
      if (currentViz) {
        currentViz.update(flights);
        currentViz.draw();
      }
    }

    // Draw home marker if enabled for current mode
    this.drawHomeMarker();

    requestAnimationFrame(() => this.animate());
  }

  /**
   * Draw a home location marker on the canvas
   */
  drawHomeMarker() {
    const modeOpts = this.settingsManager.settings.modeSettings?.[this.currentMode] || {};
    if (!modeOpts.showHomeMarker) return;
    if (!this.coordSystem?.isLocked) return;

    const lat = this.settingsManager.settings.latitude;
    const lon = this.settingsManager.settings.longitude;
    const pos = this.coordSystem.toScreen(lat, lon);
    const color = modeOpts.homeMarkerColor || '#FF0055';
    const icon = modeOpts.homeMarkerIcon || 'crosshair';

    const ctx = this.ctx;
    ctx.save();

    const pulse = (Math.sin(Date.now() / 800) + 1) / 2;

    // Always draw the subtle pulse ring
    ctx.strokeStyle = color;
    ctx.lineWidth = 1;
    ctx.globalAlpha = 0.3 * (1 - pulse);
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, 12 + pulse * 10, 0, Math.PI * 2);
    ctx.stroke();

    ctx.strokeStyle = color;
    ctx.fillStyle = color;

    switch (icon) {
      case 'crosshair':
        ctx.globalAlpha = 0.6;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, 8, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = 0.9;
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 0.25;
        ctx.lineWidth = 0.5;
        ctx.beginPath();
        ctx.moveTo(pos.x - 16, pos.y); ctx.lineTo(pos.x - 5, pos.y);
        ctx.moveTo(pos.x + 5, pos.y); ctx.lineTo(pos.x + 16, pos.y);
        ctx.moveTo(pos.x, pos.y - 16); ctx.lineTo(pos.x, pos.y - 5);
        ctx.moveTo(pos.x, pos.y + 5); ctx.lineTo(pos.x, pos.y + 16);
        ctx.stroke();
        break;

      case 'pin':
        ctx.globalAlpha = 0.8;
        ctx.beginPath();
        ctx.arc(pos.x, pos.y - 8, 6, Math.PI, 0);
        ctx.lineTo(pos.x, pos.y + 4);
        ctx.closePath();
        ctx.fill();
        ctx.globalAlpha = 1;
        ctx.fillStyle = '#0a0a0a';
        ctx.beginPath();
        ctx.arc(pos.x, pos.y - 8, 2.5, 0, Math.PI * 2);
        ctx.fill();
        break;

      case 'star':
        ctx.globalAlpha = 0.8;
        ctx.beginPath();
        for (let i = 0; i < 5; i++) {
          const a = (i * 72 - 90) * Math.PI / 180;
          const r = 10;
          ctx[i === 0 ? 'moveTo' : 'lineTo'](pos.x + Math.cos(a) * r, pos.y + Math.sin(a) * r);
          const a2 = ((i * 72) + 36 - 90) * Math.PI / 180;
          ctx.lineTo(pos.x + Math.cos(a2) * r * 0.4, pos.y + Math.sin(a2) * r * 0.4);
        }
        ctx.closePath();
        ctx.fill();
        break;

      case 'diamond':
        ctx.globalAlpha = 0.8;
        ctx.beginPath();
        ctx.moveTo(pos.x, pos.y - 10);
        ctx.lineTo(pos.x + 7, pos.y);
        ctx.lineTo(pos.x, pos.y + 10);
        ctx.lineTo(pos.x - 7, pos.y);
        ctx.closePath();
        ctx.fill();
        break;

      case 'home':
        ctx.globalAlpha = 0.8;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(pos.x, pos.y - 10);
        ctx.lineTo(pos.x - 9, pos.y - 1);
        ctx.lineTo(pos.x + 9, pos.y - 1);
        ctx.closePath();
        ctx.stroke();
        ctx.strokeRect(pos.x - 6, pos.y - 1, 12, 10);
        ctx.fillRect(pos.x - 2, pos.y + 3, 4, 6);
        break;

      case 'circle':
        ctx.globalAlpha = 0.6;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, 8, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = 0.9;
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, 3, 0, Math.PI * 2);
        ctx.fill();
        break;

      case 'square':
        ctx.globalAlpha = 0.6;
        ctx.lineWidth = 1.5;
        ctx.strokeRect(pos.x - 8, pos.y - 8, 16, 16);
        ctx.globalAlpha = 0.9;
        ctx.fillRect(pos.x - 3, pos.y - 3, 6, 6);
        break;

      case 'triangle':
        ctx.globalAlpha = 0.8;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(pos.x, pos.y - 10);
        ctx.lineTo(pos.x - 9, pos.y + 7);
        ctx.lineTo(pos.x + 9, pos.y + 7);
        ctx.closePath();
        ctx.stroke();
        break;

      case 'pulse':
        ctx.globalAlpha = 0.25 * (1 - pulse);
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, 6 + pulse * 14, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = 0.4 * (1 - pulse * 0.5);
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, 4 + pulse * 6, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = 0.9;
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, 3, 0, Math.PI * 2);
        ctx.fill();
        break;

      case 'target':
        ctx.globalAlpha = 0.4;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, 12, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = 0.6;
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, 7, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = 0.9;
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, 3, 0, Math.PI * 2);
        ctx.fill();
        break;

      default:
        // Fallback: simple dot
        ctx.globalAlpha = 0.9;
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, 4, 0, Math.PI * 2);
        ctx.fill();
    }

    ctx.restore();
  }

  /**
   * Check each mode's backgroundImage setting and load/unload as needed
   */
  updateBackgroundImages(settings) {
    const modeSettings = settings.modeSettings || {};
    const bgModes = ['ripple', 'reality', 'birds', 'constellation', 'tubes', 'patterns'];

    bgModes.forEach(mode => {
      const url = modeSettings[mode]?.backgroundImage || '';
      const cached = this.backgroundImages[mode];

      // Layer-based modes use CSS backgrounds on their DOM layer divs
      // Ripple mode uses the image as a liquid texture instead of CSS background
      const layerDivIds = {
        birds: 'gridLayer',
        constellation: 'waveLayer',
        tubes: 'tubesLayer'
      };

      if (url && (!cached || cached.url !== url)) {
        // Load new image for this mode
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
          this.backgroundImages[mode] = { image: img, url };
          console.log(`Background loaded for ${mode} mode`);

          // Update layer CSS background for layer-based modes
          if (layerDivIds[mode]) {
            this.updateLayerBackground(layerDivIds[mode], url);
          }
        };
        img.onerror = () => {
          console.error(`Failed to load background for ${mode}:`, url);
          delete this.backgroundImages[mode];
        };
        img.src = url;
      } else if (!url && cached) {
        // Clear image for this mode
        delete this.backgroundImages[mode];

        if (layerDivIds[mode]) {
          this.updateLayerBackground(layerDivIds[mode], '');
        }
      }
    });
  }

  /**
   * Update a layer div's CSS background image
   */
  updateLayerBackground(layerId, url) {
    const layer = document.getElementById(layerId);
    if (!layer) return;

    if (url) {
      layer.style.backgroundImage = `url("${url}")`;
      layer.style.backgroundSize = 'cover';
      layer.style.backgroundPosition = 'center';
    } else {
      layer.style.backgroundImage = '';
    }
  }

  drawBackground() {
    // Layer-based modes use CSS backgrounds on their layer divs, not canvas drawing
    const layerModes = ['map', 'ripple', 'birds', 'constellation', 'tubes'];
    if (layerModes.includes(this.currentMode)) return;

    const cached = this.backgroundImages[this.currentMode];
    if (!cached || !cached.image) return;

    const img = cached.image;
    const w = this.viewWidth;
    const h = this.viewHeight;

    const imgRatio = img.width / img.height;
    const canvasRatio = w / h;

    let drawW, drawH, drawX, drawY;
    if (canvasRatio > imgRatio) {
      drawW = w;
      drawH = w / imgRatio;
      drawX = 0;
      drawY = (h - drawH) / 2;
    } else {
      drawH = h;
      drawW = h * imgRatio;
      drawX = (w - drawW) / 2;
      drawY = 0;
    }

    this.ctx.globalAlpha = 0.3;
    this.ctx.drawImage(img, drawX, drawY, drawW, drawH);
    this.ctx.globalAlpha = 1;
  }

  async loadGoogleMapsAPI(apiKey) {
    if (this.googleMapsLoaded || this.googleMapsLoading) return;
    this.googleMapsLoading = true;

    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&callback=__gmapsReady`;
      script.async = true;
      script.defer = true;

      // Google calls this when the API is fully ready
      window.__gmapsReady = () => {
        this.googleMapsLoaded = true;
        this.googleMapsLoading = false;
        console.log('Google Maps API loaded');

        if (this.visualizations.map && this.visualizations.map.initGoogleMap) {
          this.visualizations.map.initGoogleMap();
          if (this.currentMode === 'map') {
            this.visualizations.map.showMap();
          }
        }

        resolve();
      };

      script.onerror = () => {
        this.googleMapsLoading = false;
        console.error('Failed to load Google Maps API');
        reject(new Error('Failed to load Google Maps API'));
      };
      document.head.appendChild(script);
    });
  }

  async fetchServerConfig() {
    try {
      const response = await fetch('/api/config');
      const config = await response.json();
      if (config.googleMapsApiKey && !this.settingsManager.get('googleMapsApiKey')) {
        this.settingsManager.set('googleMapsApiKey', config.googleMapsApiKey);
        this.settingsManager.updateUI();
        this.loadGoogleMapsAPI(config.googleMapsApiKey);
      }
    } catch (e) {
      // Server config is optional
    }
  }

  easeInOutCubic(t) {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  }

  stop() {
    this.isRunning = false;
  }
}

// Initialize the app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  console.log('%ctheARTofFLIGHT', 'font-size: 24px; font-weight: bold; background: linear-gradient(135deg, #0047FF, #00F0FF); -webkit-background-clip: text; -webkit-text-fill-color: transparent;');
  console.log('%cMuseum-grade flight visualization', 'font-size: 12px; color: #00F0FF;');

  const app = new TheArtOfFlight();

  window.theArtOfFlight = app;

  console.log('System initialized');
  console.log('Press "I" to toggle data overlay');
  console.log('Click settings to configure');
});
