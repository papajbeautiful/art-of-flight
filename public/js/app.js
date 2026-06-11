/**
 * Main Application
 * theARTofFLIGHT - live aircraft as art, 24/7
 *
 * Chrome philosophy: the art owns the screen. No buttons on load.
 *   S        settings panel
 *   I        info overlay
 *   F        fullscreen
 *   1-9, 0   direct mode select (MODE_ORDER)
 *   ← / →    cycle modes
 *   Esc      close settings
 * Moving the mouse reveals a hint pill (clickable, fades with idle).
 */

// URL overrides (testing/kiosk):
//   ?mode=reality        force a visualization mode for this session
//   ?mock=1              serve a frozen flight fixture from the server
//   ?deterministic=1     seeded random + default settings, for reproducible screenshots
const URL_PARAMS = new URLSearchParams(window.location.search);
window.__DETERMINISTIC__ = URL_PARAMS.get('deterministic') === '1';

// ?chrome=0 — embed/background mode: hide ALL chrome (pill, toast, panel,
// title) — used by the Panarea dash, which drives the mode via ?mode= and
// must never flash UI over the visualization.
window.__NO_CHROME__ = URL_PARAMS.get('chrome') === '0';
if (window.__NO_CHROME__) {
  document.documentElement.classList.add('no-chrome');
}

if (window.__DETERMINISTIC__) {
  // CSS hook: continuous decorative animations are disabled under the guard
  document.documentElement.classList.add('deterministic');
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

    // Single shared background image (Look → background)
    this.backgroundImage = null; // { image: Image, url: string }

    // Initialize visualizations
    this.visualizations = {
      aurora: new AuroraVisualization(this.canvas, this.ctx),
      ink: new InkVisualization(this.canvas, this.ctx),
      patterns: new PatternsVisualization(this.canvas, this.ctx),
      contrails: new ContrailsVisualization(this.canvas, this.ctx),
      ripple: new RippleVisualization(this.canvas, this.ctx),
      constellation: new ConstellationVisualization(this.canvas, this.ctx),
      radar: new RadarVisualization(this.canvas, this.ctx),
      reality: new RealityVisualization(this.canvas, this.ctx),
      map: new MapVisualization(this.canvas, this.ctx),
      departures: new DeparturesVisualization(this.canvas, this.ctx)
    };

    // Modes that live on their own DOM layer (shown/hidden on switch)
    this.layerModes = {
      map: { show: 'showMap', hide: 'hideMap' },
      ripple: { show: 'showRipples', hide: 'hideRipples' },
      constellation: { show: 'show', hide: 'hide' },
      departures: { show: 'show', hide: 'hide' }
    };

    // ?mode= URL override (session-only; aliases accepted: waves/board/grid…)
    const urlMode = resolveModeKey(URL_PARAMS.get('mode'));
    if (urlMode) this.settingsManager.set('mode', urlMode);

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
    if (this.layerModes[this.currentMode]) {
      const viz = this.visualizations[this.currentMode];
      const method = this.layerModes[this.currentMode].show;
      if (viz[method]) viz[method]();
    }

    this.applySettings(this.settingsManager.settings);

    this.settingsManager.onChange((settings) => {
      this.applySettings(settings);
    });

    this.initKeyboard();
    this.initHintPill();

    this.start();
  }

  // ─── Chrome: keyboard, toast, hint pill ─────────────────

  initKeyboard() {
    document.addEventListener('keydown', (e) => {
      // Don't hijack keys while typing in settings fields
      if (e.target && /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;

      const k = e.key;
      if (k === 'i' || k === 'I') {
        this.settingsManager.toggleInfo();
      } else if (k === 'f' || k === 'F') {
        this.toggleFullscreen();
      } else if ((k === 's' || k === 'S') && !window.__NO_CHROME__) {
        this.settingsManager.toggle();
      } else if (/^[0-9]$/.test(k)) {
        const idx = (parseInt(k, 10) + 9) % 10; // '1'→0 … '9'→8, '0'→9
        const mode = MODE_ORDER[idx];
        if (mode) this.userSwitchMode(mode);
      } else if (k === 'ArrowRight' || k === 'ArrowLeft') {
        const dir = k === 'ArrowRight' ? 1 : -1;
        const idx = MODE_ORDER.indexOf(this.currentMode);
        const mode = MODE_ORDER[(idx + dir + MODE_ORDER.length) % MODE_ORDER.length];
        this.userSwitchMode(mode);
      }
    });
  }

  /** Mode switch triggered by the user (keyboard) — toast + persist. */
  userSwitchMode(mode) {
    if (!this.visualizations[mode] || mode === this.currentMode) return;
    this.settingsManager.set('mode', mode);
    this.settingsManager.applyChange();
    this.showModeToast(MODE_META[mode].label);
  }

  showModeToast(label) {
    if (window.__NO_CHROME__ || window.__DETERMINISTIC__) return;
    const toast = document.getElementById('modeToast');
    if (!toast) return;
    toast.textContent = label;
    toast.classList.remove('show');
    // force reflow so the animation restarts
    void toast.offsetWidth;
    toast.classList.add('show');
    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => toast.classList.remove('show'), 2200);
  }

  initHintPill() {
    if (window.__NO_CHROME__) return;
    const pill = document.getElementById('hintPill');
    if (!pill) return;

    pill.addEventListener('click', () => this.settingsManager.open());

    // First-ever run: hold the hint on screen for a friendly beat
    if (!window.__DETERMINISTIC__ && !localStorage.getItem('theARTofFLIGHT_settings')) {
      document.body.classList.add('first-run');
      setTimeout(() => document.body.classList.remove('first-run'), 10000);
    }
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

  // ─── Settings distribution ──────────────────────────────

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

    // Shared background image
    this.updateBackgroundImage(settings);

    // Update visualization mode with transition
    if (this.currentMode !== settings.mode) {
      this.switchMode(settings.mode);
    }

    // Distribute Look + palette + mode-specific settings
    this.distributeSettings(settings);

    // Chrome accent from palette
    this.applyUIAccentColor();

    // Update info overlay
    const infoOverlay = document.getElementById('infoOverlay');
    if (infoOverlay) infoOverlay.classList.toggle('hidden', !settings.showInfoPanel);
  }

  /**
   * Compose each mode's options payload: shared Look (mapped to base-class
   * option keys) + palette colours + that mode's own settings. Modes also
   * receive the resolved palette object via setPalette().
   */
  distributeSettings(settings) {
    const look = settings.look;
    const palette = this.settingsManager.getActivePalette();
    const labelFlags = this.settingsManager.getLabelFlags();

    const base = {
      showAirborneAircraft: true,
      showGroundAircraft: settings.includeGround,
      aircraftIcon: look.aircraftIcon,
      aircraftScale: look.aircraftScale,
      accentColor: palette.primary,
      inboundColor: palette.inbound,
      outboundColor: palette.outbound,
      showTrails: look.trails,
      trailLength: look.trailLength,
      ...labelFlags,
      labelTextScale: look.labelScale,
      labelBgOpacity: 0.55,
      labelBgColor: '#000000',
      inboundLabelFormat: '{airline} {type} from {origin}',
      outboundLabelFormat: '{airline} {type} to {destination}',
      backgroundImage: look.background
    };

    Object.keys(this.visualizations).forEach(mode => {
      const viz = this.visualizations[mode];
      if (viz.setPalette) viz.setPalette(palette);
      if (viz.setDisplayOptions) {
        viz.setDisplayOptions({ ...base, ...(settings.modeSettings[mode] || {}) });
      }
    });

    // Waves mode hosts the background on its own layer div
    this.updateLayerBackground('waveLayer', look.background);
  }

  /**
   * Apply the active palette's UI accent to CSS variables
   */
  applyUIAccentColor() {
    const palette = this.settingsManager.getActivePalette();
    const color = palette.ui || '#6fe3cf';

    const root = document.documentElement;
    root.style.setProperty('--accent', color);

    // Derive dim/glow variants
    const r = parseInt(color.slice(1, 3), 16);
    const g = parseInt(color.slice(3, 5), 16);
    const b = parseInt(color.slice(5, 7), 16);
    root.style.setProperty('--accent-dim', `rgba(${r}, ${g}, ${b}, 0.15)`);
    root.style.setProperty('--accent-glow', `rgba(${r}, ${g}, ${b}, 0.4)`);
  }

  // ─── Inbound heuristic + labels (shared with modes) ─────

  /**
   * Determine if a flight is inbound (destination near home) or outbound
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
    const inbound = this.isInbound(flight);
    const template = inbound
      ? '{airline} {type} from {origin}'
      : '{airline} {type} to {destination}';

    const airline = flight.airlineName || '';
    const type = flight.aircraftType || '';
    const callsign = flight.callsign || '';
    const origin = flight.originCity || '';
    const destination = flight.destinationCity || '';

    if (origin || destination || airline) {
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

  // ─── Mode switching ─────────────────────────────────────

  switchMode(newMode) {
    console.log(`Transitioning from ${this.currentMode} to ${newMode}`);

    // Accumulation modes need a clean canvas to start from
    if (newMode === 'patterns' || newMode === 'aurora' || newMode === 'ink') {
      this.ctx.fillStyle = '#000000';
      this.ctx.fillRect(0, 0, this.viewWidth, this.viewHeight);
    }

    // Hide previous layer mode
    if (this.layerModes[this.currentMode]) {
      const viz = this.visualizations[this.currentMode];
      const method = this.layerModes[this.currentMode].hide;
      if (viz[method]) viz[method]();
    }

    // Show new layer mode
    if (this.layerModes[newMode]) {
      const viz = this.visualizations[newMode];
      const method = this.layerModes[newMode].show;
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

  // ─── Run loop ───────────────────────────────────────────

  async start() {
    if (this.isRunning) return;

    this.isRunning = true;
    this.updateStatus('Initializing...');

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

    this.updateSignalOverlay();
  }

  /**
   * Signal-lost overlay: the info panel is typically hidden on kiosks, so
   * data failures need their own quiet, on-brand surface. Shows when the
   * server is unreachable (2+ consecutive failures) or when the server
   * reports its upstream sources are down and data is over a minute old.
   * Auto-dismisses on recovery.
   */
  updateSignalOverlay() {
    const overlay = document.getElementById('signalOverlay');
    const detail = document.getElementById('signalDetail');
    if (!overlay) return;

    const state = this.flightManager.getConnectionState();
    const showOverlay = state.failing || (state.stale && (state.dataAgeSeconds ?? 0) > 60);

    if (showOverlay) {
      if (detail) {
        if (state.dataAgeSeconds != null && state.dataAgeSeconds > 0) {
          const age = state.dataAgeSeconds >= 120
            ? `${Math.round(state.dataAgeSeconds / 60)} minutes`
            : `${state.dataAgeSeconds} seconds`;
          detail.textContent = `last signal ${age} ago`;
        } else {
          detail.textContent = '';
        }
      }
      overlay.classList.remove('hidden');
    } else {
      overlay.classList.add('hidden');
    }
  }

  toggleFullscreen() {
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    } else {
      document.documentElement.requestFullscreen().catch(() => {});
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

      // Build route text using label format template
      const routeText = this.formatLabel(flight);

      const dataParts = [altitude, speed, distance].filter(Boolean);
      const dataLine = dataParts.join(' • ');

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
          callsignEl.textContent = flight.callsign + (flight.aircraftType ? ' • ' + flight.aircraftType : '');
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
        csEl.textContent = flight.callsign + (flight.aircraftType ? ' • ' + flight.aircraftType : '');
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
    if (this.layerModes[this.currentMode]) {
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

    // Draw home marker if enabled (shared Look setting)
    this.drawHomeMarker();

    requestAnimationFrame(() => this.animate());
  }

  /**
   * Draw a home location marker on the canvas. Colour comes from the
   * palette's secondary slot — quiet, present, never shouting.
   */
  drawHomeMarker() {
    const look = this.settingsManager.settings.look;
    if (!look.homeMarker) return;
    if (!this.coordSystem?.isLocked) return;
    // The board is a different object — a marker makes no sense over it
    if (this.currentMode === 'departures') return;

    const lat = this.settingsManager.settings.latitude;
    const lon = this.settingsManager.settings.longitude;
    const pos = this.coordSystem.toScreen(lat, lon);
    const palette = this.settingsManager.getActivePalette();
    const color = palette.secondary;
    const icon = look.homeMarkerIcon || 'crosshair';

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

  // ─── Background image (shared Look) ─────────────────────

  updateBackgroundImage(settings) {
    const url = settings.look.background || '';
    const cached = this.backgroundImage;

    if (url && (!cached || cached.url !== url)) {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        this.backgroundImage = { image: img, url };
      };
      img.onerror = () => {
        console.error('Failed to load background:', url);
        this.backgroundImage = null;
      };
      img.src = url;
    } else if (!url && cached) {
      this.backgroundImage = null;
    }
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
    // Layer-based modes host backgrounds on their layer divs; accumulation
    // and sky modes paint their own full-frame art
    const cached = this.backgroundImage;
    if (!cached || !cached.image) return;
    if (this.layerModes[this.currentMode]) return;

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
  console.log('%cLive aircraft as art', 'font-size: 12px; color: #00F0FF;');

  const app = new TheArtOfFlight();

  window.theArtOfFlight = app;

  console.log('System initialized');
  console.log('S settings · I info · F fullscreen · 1-0 modes · arrows cycle');
});
