/**
 * Flight Patterns Mode: Aaron Koblin inspired
 *
 * Key techniques:
 * - Off-screen accumulation canvas that NEVER fades (only resets at midnight)
 * - Ultra-thin lines with very low alpha (2-5%)
 * - Additive blending — luminosity emerges from density, not from glow effects
 * - No shadowBlur — all glow is emergent from overlapping paths
 * - Bezier curve interpolation for smooth flight arcs
 * - Inbound vs outbound aircraft rendered with distinct color palettes
 * - Path segments stored in lat/lon (normalized) so resize works correctly
 */
class PatternsVisualization {
  constructor(canvas, ctx) {
    this.canvas = canvas;
    this.ctx = ctx;

    // Off-screen accumulation canvas — NEVER cleared except at midnight
    this.accumCanvas = document.createElement('canvas');
    this.accumCtx = this.accumCanvas.getContext('2d');
    this.resizeAccumCanvas();

    // Track active flights
    this.activeFlights = new Map();
    this.pathSegments = []; // Stored in lat/lon for resize-safe persistence

    // Time tracking
    this.lastResetDate = null;
    this.startTime = Date.now();
    this.segmentCount = 0;

    // Track last canvas size for detecting actual resize
    this._lastW = this.canvas.width;
    this._lastH = this.canvas.height;

    // Per-mode options. Exposure scales all three accumulation passes
    // coherently — the Koblin look needs whisper-thin alphas that build into
    // luminosity over hours, so exposure 1.0 is deliberately quiet.
    this.options = {
      exposure: 1.0,
      lineWidth: 1.0,
      showGroundAircraft: false,
      showStats: false
    };

    // Resolved palette (palettes.js) — patterns doesn't extend the base
    // class, so it keeps its own copy via setPalette()
    this.palette = (typeof PALETTES !== 'undefined') ? PALETTES.aurora : null;

    // Midnight "developing in reverse": fade state instead of a hard cut
    this._fadeOut = null; // { start } while the day's artwork dissolves

    // Comet-head sprite cache, keyed by colour
    this._cometCache = new Map();

    // Handle canvas resize
    this._resizeHandler = () => this.handleResize();
    window.addEventListener('resize', this._resizeHandler);

    // Load saved paths
    this.loadPaths();
    this.checkMidnightReset();
  }

  setPalette(palette) {
    if (!palette) return;
    this.palette = palette;
    this._cometCache.clear();
  }

  handleResize() {
    const newW = this.canvas.width;
    const newH = this.canvas.height;

    // Only resize accum if dimensions actually changed
    if (newW !== this._lastW || newH !== this._lastH) {
      this._lastW = newW;
      this._lastH = newH;
      this.resizeAccumCanvas();
    }
  }

  resizeAccumCanvas() {
    // Mirror the main canvas backing store (device pixels) and draw in CSS
    // pixels via the same DPR transform, so accumulated art stays crisp.
    this.accumCanvas.width = this.canvas.width;
    this.accumCanvas.height = this.canvas.height;
    const dpr = window.devicePixelRatio || 1;
    this.accumCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    // Redraw all segments from lat/lon → current screen coords
    this.redrawAccumulated();
  }

  /** Logical (CSS pixel) canvas dimensions */
  get viewWidth() { return this.canvas.clientWidth || this.canvas.width; }
  get viewHeight() { return this.canvas.clientHeight || this.canvas.height; }

  redrawAccumulated() {
    this.accumCtx.fillStyle = '#000000';
    this.accumCtx.fillRect(0, 0, this.accumCanvas.width, this.accumCanvas.height);

    if (!this.pathSegments || this.pathSegments.length === 0) return;

    this.accumCtx.globalCompositeOperation = 'lighter';
    this.accumCtx.lineCap = 'round';

    this.pathSegments.forEach(seg => {
      this.drawSegmentToAccum(seg);
    });

    this.accumCtx.globalCompositeOperation = 'source-over';
  }

  setDisplayOptions(options) {
    if (!options) return;
    if (options.exposure !== undefined) this.options.exposure = options.exposure;
    if (options.lineWidth !== undefined) this.options.lineWidth = options.lineWidth;
    if (options.showGroundAircraft !== undefined) this.options.showGroundAircraft = options.showGroundAircraft;
    if (options.showStats !== undefined) this.options.showStats = options.showStats;
  }

  /**
   * Convert a stored lat/lon segment to screen pixel coordinates
   */
  segToScreen(seg) {
    const p1 = this.latLonToScreen(seg.lat1, seg.lon1);
    const p2 = this.latLonToScreen(seg.lat2, seg.lon2);

    const result = {
      x1: p1.x, y1: p1.y,
      x2: p2.x, y2: p2.y,
      color: seg.color,
      direction: seg.direction
    };

    if (seg.clat !== undefined && seg.clon !== undefined) {
      const cp = this.latLonToScreen(seg.clat, seg.clon);
      result.cx = cp.x;
      result.cy = cp.y;
    }

    return result;
  }

  drawSegmentToAccum(seg) {
    const screen = this.segToScreen(seg);
    const exposure = this.options.exposure;
    const lineScale = this.options.lineWidth;
    const segOpacity = seg.opacity ?? 1;

    // Whisper-thin passes — density becomes luminosity over hours, the way
    // the original Flight Patterns plates work. Hot alphas clip to flat
    // white within minutes and destroy the topography.
    const passes = [
      { width: 4.0 * lineScale, alpha: 0.020 * exposure * segOpacity },
      { width: 1.8 * lineScale, alpha: 0.050 * exposure * segOpacity },
      { width: 0.6 * lineScale, alpha: 0.085 * exposure * segOpacity },
    ];

    passes.forEach(pass => {
      this.accumCtx.strokeStyle = screen.color;
      this.accumCtx.globalAlpha = pass.alpha;
      this.accumCtx.lineWidth = pass.width;

      this.accumCtx.beginPath();
      this.accumCtx.moveTo(screen.x1, screen.y1);

      if (screen.cx !== undefined && screen.cy !== undefined) {
        this.accumCtx.quadraticCurveTo(screen.cx, screen.cy, screen.x2, screen.y2);
      } else {
        this.accumCtx.lineTo(screen.x2, screen.y2);
      }

      this.accumCtx.stroke();
    });
  }

  checkMidnightReset() {
    const now = new Date();
    const today = now.toDateString();
    if (this.lastResetDate === today || this._fadeOut) return;

    // Midnight is a moment, not a cut: the finished day develops in
    // reverse over ~45s before the new sheet begins. Deterministic runs
    // (and an empty canvas) reset instantly.
    if (!window.__DETERMINISTIC__ && this.pathSegments.length > 0 && this.lastResetDate !== null) {
      console.log('New day — dissolving the finished artwork');
      this._fadeOut = { start: Date.now() };
    } else {
      this.reset();
      this.savePaths();
    }
  }

  /** Advance the midnight dissolve; returns true while it runs */
  _advanceFadeOut() {
    if (!this._fadeOut) return false;
    const elapsed = Date.now() - this._fadeOut.start;
    if (elapsed >= 45000) {
      this._fadeOut = null;
      this.reset();
      this.savePaths();
      return false;
    }
    // Darken the accumulated art a little each frame — under the 'screen'
    // composite this reads as the image sinking back into the dark
    this.accumCtx.fillStyle = 'rgba(0, 0, 0, 0.04)';
    this.accumCtx.fillRect(0, 0, this.viewWidth, this.viewHeight);
    return true;
  }

  /**
   * Time-of-day as a continuous warmth/lightness modulation (crossfaded by
   * minute — the accumulated canvas records the day as smooth colour epochs)
   */
  getTimeModulation() {
    if (window.__DETERMINISTIC__) return { warmth: 0, lift: 0 };
    const d = new Date();
    const t = d.getHours() + d.getMinutes() / 60;
    // Warmth peaks at dawn (6:30) and dusk (18:30); lift peaks midday
    const dawn = Math.exp(-Math.pow((t - 6.5) / 1.5, 2));
    const dusk = Math.exp(-Math.pow((t - 18.5) / 1.5, 2));
    const day = Math.exp(-Math.pow((t - 12.5) / 3.5, 2));
    return { warmth: Math.min(1, dawn + dusk), lift: day * 0.5 };
  }

  /**
   * Determine if a flight is inbound (heading toward user) or outbound (heading away)
   */
  isInbound(flight) {
    const cs = window.theArtOfFlight?.coordSystem;
    if (!cs || !cs.isLocked || !flight.heading) return null;

    // Bearing from aircraft to user location
    const dLat = cs.centerLat - flight.latitude;
    const dLon = cs.centerLon - flight.longitude;
    const bearingToUser = Math.atan2(dLon, dLat) * 180 / Math.PI;

    // Normalize both to 0–360
    const heading = ((flight.heading % 360) + 360) % 360;
    const bearing = ((bearingToUser % 360) + 360) % 360;

    // If difference < 90°, aircraft is heading toward user (inbound)
    let diff = Math.abs(heading - bearing);
    if (diff > 180) diff = 360 - diff;

    return diff < 90;
  }

  _hexRgb(hex) {
    return [
      parseInt(hex.slice(1, 3), 16),
      parseInt(hex.slice(3, 5), 16),
      parseInt(hex.slice(5, 7), 16)
    ];
  }

  /**
   * Continuous colour: altitude lerps through the palette ramp (no banding),
   * direction pulls gently toward the palette's inbound/outbound inks, and
   * the hour of day warms or lifts the result by a few percent — the
   * never-cleared canvas records dawn-to-dusk as smooth colour epochs.
   */
  getColorForFlight(altitude, inbound) {
    const ramp = this.palette?.ramp || ['#071019', '#0e3a40', '#16847e', '#52e0c4', '#b79cff'];
    const t = Math.min((altitude || 0) / 45000, 1) * (ramp.length - 1.001);
    const i = Math.floor(t);
    const f = t - i;
    const a = this._hexRgb(ramp[Math.max(1, i)]); // skip ramp[0]: too dark for 'lighter'
    const b = this._hexRgb(ramp[Math.min(Math.max(1, i) + 1, ramp.length - 1)]);
    let r = a[0] + (b[0] - a[0]) * f;
    let g = a[1] + (b[1] - a[1]) * f;
    let bl = a[2] + (b[2] - a[2]) * f;

    // Direction ink: desaturated pull toward inbound/outbound (two inks,
    // not two neons); unknown direction stays on the pure ramp
    if (inbound !== null) {
      const ink = this._hexRgb(inbound ? (this.palette?.inbound || '#52e0c4') : (this.palette?.outbound || '#b79cff'));
      r = r * 0.65 + ink[0] * 0.35;
      g = g * 0.65 + ink[1] * 0.35;
      bl = bl * 0.65 + ink[2] * 0.35;
    }

    const { warmth, lift } = this.getTimeModulation();
    r = Math.min(255, r * (1 + 0.12 * warmth + 0.06 * lift));
    g = Math.min(255, g * (1 + 0.04 * warmth + 0.06 * lift));
    bl = Math.min(255, bl * (1 - 0.08 * warmth + 0.06 * lift));

    return `rgba(${Math.round(r)}, ${Math.round(g)}, ${Math.round(bl)}, 1)`;
  }

  update(flights) {
    const now = Date.now();

    this.checkMidnightReset();
    if (this._advanceFadeOut()) return; // hold new strokes while dissolving

    // Ensure accum canvas matches main canvas size
    if (this.accumCanvas.width !== this.canvas.width ||
        this.accumCanvas.height !== this.canvas.height) {
      this._lastW = this.canvas.width;
      this._lastH = this.canvas.height;
      this.resizeAccumCanvas();
    }

    flights.forEach(flight => {
      if (!flight.latitude || !flight.longitude) return;

      // Skip ground aircraft if setting disabled
      const isOnGround = (flight.altitudeFeet || 0) <= 0;
      if (isOnGround && !this.options.showGroundAircraft) return;

      const id = flight.icao24;
      const inbound = this.isInbound(flight);
      const direction = inbound === null ? 'unknown' : (inbound ? 'inbound' : 'outbound');

      if (!this.activeFlights.has(id)) {
        this.activeFlights.set(id, {
          id: id,
          positions: [{ lat: flight.latitude, lon: flight.longitude }],
          altitude: flight.altitudeFeet || 0,
          color: this.getColorForFlight(flight.altitudeFeet || 0, inbound),
          heading: flight.heading || 0,
          direction: direction,
          opacity: flight.opacity ?? 1,
          verticalRate: flight.verticalRate ?? 0,
          lastCp: null,
          startTime: now,
          lastUpdate: now
        });
      } else {
        const flightData = this.activeFlights.get(id);
        // Fade lifecycle applies even to stationary aircraft (the static
        // fixture never moves — heads must still fade in)
        flightData.opacity = flight.opacity ?? 1;
        const lastPos = flightData.positions[flightData.positions.length - 1];

        // Calculate screen distance to decide if we should add a segment
        const lastScreen = this.latLonToScreen(lastPos.lat, lastPos.lon);
        const currScreen = this.latLonToScreen(flight.latitude, flight.longitude);
        const dx = currScreen.x - lastScreen.x;
        const dy = currScreen.y - lastScreen.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance > 1.5) {
          // Update direction classification
          flightData.direction = direction;
          flightData.color = this.getColorForFlight(flight.altitudeFeet || 0, inbound);
          flightData.verticalRate = flight.verticalRate ?? 0;

          // C1 continuity: reflect the previous control point about the
          // joint so consecutive quadratics share a tangent (no kinks).
          // First segment falls back to forward extrapolation.
          let clat, clon;
          if (flightData.lastCp) {
            clat = 2 * lastPos.lat - flightData.lastCp.lat;
            clon = 2 * lastPos.lon - flightData.lastCp.lon;
            // Clamp runaway reflections (data jumps) to the segment scale
            const span = Math.abs(flight.latitude - lastPos.lat) + Math.abs(flight.longitude - lastPos.lon);
            if (Math.abs(clat - lastPos.lat) + Math.abs(clon - lastPos.lon) > span * 1.5) {
              clat = lastPos.lat + (flight.latitude - lastPos.lat) * 0.3;
              clon = lastPos.lon + (flight.longitude - lastPos.lon) * 0.3;
            }
          } else {
            const prevPos = flightData.positions.length > 1
              ? flightData.positions[flightData.positions.length - 2]
              : lastPos;
            clat = lastPos.lat + (flight.latitude - prevPos.lat) * 0.3;
            clon = lastPos.lon + (flight.longitude - prevPos.lon) * 0.3;
          }
          flightData.lastCp = { lat: clat, lon: clon };

          const segOpacity = flight.opacity ?? 1;
          const segment = {
            lat1: lastPos.lat,
            lon1: lastPos.lon,
            lat2: flight.latitude,
            lon2: flight.longitude,
            clat: clat,
            clon: clon,
            color: flightData.color,
            direction: direction,
            timestamp: now,
            altitude: flight.altitudeFeet || 0,
            opacity: segOpacity
          };

          // Draw directly to accumulation canvas
          this.accumCtx.globalCompositeOperation = 'lighter';
          this.accumCtx.lineCap = 'round';
          this.drawSegmentToAccum(segment);
          this.accumCtx.globalCompositeOperation = 'source-over';

          // Save for persistence — bounded: the accumulation CANVAS keeps the
          // full day's art, but the live segment array (used only to redraw
          // after a resize) is capped so an 18-hour kiosk day can't grow RAM
          // and resize-redraw cost without limit.
          this.pathSegments.push(segment);
          this.segmentCount++;
          if (this.pathSegments.length > 20000) {
            this.pathSegments = this.pathSegments.slice(-15000);
          }

          flightData.positions.push({ lat: flight.latitude, lon: flight.longitude });
          flightData.lastUpdate = now;
          flightData.altitude = flight.altitudeFeet || 0;
          flightData.opacity = flight.opacity ?? 1;

          if (flightData.positions.length > 8) {
            flightData.positions = flightData.positions.slice(-8);
          }
        }
      }
    });

    // Clean up inactive flights
    for (const [id, flightData] of this.activeFlights.entries()) {
      if (now - flightData.lastUpdate > 60000) {
        this.activeFlights.delete(id);
      }
    }

    // Periodically save paths
    if (Math.random() < 0.003) {
      this.savePaths();
    }
  }

  latLonToScreen(lat, lon) {
    if (window.theArtOfFlight?.coordSystem?.isLocked) {
      return window.theArtOfFlight.coordSystem.toScreen(lat, lon);
    }
    return { x: this.viewWidth / 2, y: this.viewHeight / 2 };
  }

  draw() {
    // Composite accumulation canvas onto main canvas.
    // Destination size is in CSS pixels (the context is DPR-scaled), so the
    // device-resolution accum buffer maps 1:1 to device pixels — stays crisp.
    this.ctx.globalCompositeOperation = 'screen';
    this.ctx.drawImage(this.accumCanvas, 0, 0, this.viewWidth, this.viewHeight);
    this.ctx.globalCompositeOperation = 'source-over';

    // Draw active flight leading edges
    this.ctx.globalCompositeOperation = 'lighter';
    this.ctx.lineCap = 'round';

    for (const [id, flightData] of this.activeFlights.entries()) {
      const opacity = flightData.opacity ?? 1;

      // Comet glint draws even for single-position flights — the static
      // fixture (zero velocity) then still composes, and the pixel guard
      // gets real coverage instead of a black frame
      if (flightData.positions.length < 2) {
        const p = this.latLonToScreen(flightData.positions[0].lat, flightData.positions[0].lon);
        const sprite = this._cometSprite(flightData.color);
        this.ctx.globalAlpha = 0.9 * opacity;
        this.ctx.drawImage(sprite, p.x - 11, p.y - 11, 22, 22);
        continue;
      }
      this.ctx.strokeStyle = flightData.color;
      this.ctx.globalAlpha = 0.5 * opacity;
      this.ctx.lineWidth = 1.2 * this.options.lineWidth;

      this.ctx.beginPath();
      const pos = flightData.positions;
      const p0 = this.latLonToScreen(pos[0].lat, pos[0].lon);
      this.ctx.moveTo(p0.x, p0.y);

      for (let i = 1; i < pos.length; i++) {
        const pi = this.latLonToScreen(pos[i].lat, pos[i].lon);
        if (i >= 2) {
          const prev = this.latLonToScreen(pos[i - 2].lat, pos[i - 2].lon);
          const cur = this.latLonToScreen(pos[i - 1].lat, pos[i - 1].lon);
          const cpx = cur.x + (pi.x - prev.x) * 0.2;
          const cpy = cur.y + (pi.y - prev.y) * 0.2;
          this.ctx.quadraticCurveTo(cpx, cpy, pi.x, pi.y);
        } else {
          this.ctx.lineTo(pi.x, pi.y);
        }
      }
      this.ctx.stroke();

      // Comet glint at the leading edge — the one "alive" element. A cached
      // radial sprite breathing gently with climb/descent.
      const lastPos = this.latLonToScreen(pos[pos.length - 1].lat, pos[pos.length - 1].lon);
      const sprite = this._cometSprite(flightData.color);
      let s = 22;
      if (!window.__DETERMINISTIC__) {
        const vr = Math.max(-1, Math.min(1, (flightData.verticalRate || 0) / 2500));
        s *= 1 + 0.10 * Math.sin(Date.now() / (520 - 140 * vr) + lastPos.x * 0.05);
      }
      this.ctx.globalAlpha = 0.9 * opacity;
      this.ctx.drawImage(sprite, lastPos.x - s / 2, lastPos.y - s / 2, s, s);
    }

    // Reset
    this.ctx.globalAlpha = 1;
    this.ctx.globalCompositeOperation = 'source-over';

    // Stats overlay
    if (this.options.showStats) {
      this.drawStats();
    }
  }

  /** Cached comet-glint sprite per colour (origin-centred radial gradient) */
  _cometSprite(color) {
    let sprite = this._cometCache.get(color);
    if (sprite) return sprite;
    const m = color.match(/[\d.]+/g) || ['255', '255', '255'];
    const s = 44;
    sprite = document.createElement('canvas');
    sprite.width = sprite.height = s;
    const g = sprite.getContext('2d');
    const grad = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    grad.addColorStop(0, 'rgba(255, 255, 255, 0.95)');
    grad.addColorStop(0.18, `rgba(${m[0]}, ${m[1]}, ${m[2]}, 0.85)`);
    grad.addColorStop(0.45, `rgba(${m[0]}, ${m[1]}, ${m[2]}, 0.22)`);
    grad.addColorStop(1, `rgba(${m[0]}, ${m[1]}, ${m[2]}, 0)`);
    g.fillStyle = grad;
    g.fillRect(0, 0, s, s);
    if (this._cometCache.size > 64) this._cometCache.clear();
    this._cometCache.set(color, sprite);
    return sprite;
  }

  drawStats() {
    // Wall-clock dependent — masked in deterministic screenshot runs
    if (window.__DETERMINISTIC__) return;

    // Gallery placard: one thin letter-spaced caption, no box
    const h = this.viewHeight;
    const ui = this.palette?.ui || '#6fe3cf';
    const m = this._hexRgb(ui);
    this.ctx.fillStyle = `rgba(${m[0]}, ${m[1]}, ${m[2]}, 0.35)`;
    this.ctx.font = '10px "Space Mono", monospace';
    const paths = this.segmentCount.toLocaleString();
    this.ctx.fillText(`F L I G H T   P A T T E R N S   —   ${paths} PATHS   —   ${this.activeFlights.size} ALOFT   —   RESETS 00:00`, 24, h - 24);
  }

  savePaths() {
    try {
      const recentSegments = this.pathSegments.slice(-5000);
      const data = {
        lastResetDate: this.lastResetDate,
        startTime: this.startTime,
        segmentCount: this.segmentCount,
        pathSegments: recentSegments.map(s => ({
          lat1: s.lat1,
          lon1: s.lon1,
          lat2: s.lat2,
          lon2: s.lon2,
          clat: s.clat,
          clon: s.clon,
          color: s.color,
          direction: s.direction || 'unknown',
          timestamp: s.timestamp,
          altitude: s.altitude
        }))
      };

      localStorage.setItem('theARTofFLIGHT_patterns', JSON.stringify(data));
    } catch (e) {
      console.error('Failed to save patterns:', e);
    }
  }

  loadPaths() {
    try {
      const stored = localStorage.getItem('theARTofFLIGHT_patterns');
      if (!stored) return;

      const data = JSON.parse(stored);
      const today = new Date().toDateString();

      if (data.lastResetDate === today) {
        this.lastResetDate = data.lastResetDate;
        this.startTime = data.startTime || Date.now();
        this.segmentCount = data.segmentCount || 0;

        // Check if stored data uses the new lat/lon format or old pixel format
        const segs = data.pathSegments || [];
        if (segs.length > 0 && segs[0].lat1 !== undefined) {
          // New format — lat/lon based
          this.pathSegments = segs;
        } else {
          // Old pixel-based format — discard (can't convert without knowing old dimensions)
          console.log('Discarding old pixel-based pattern data');
          this.pathSegments = [];
          this.segmentCount = 0;
        }

        console.log(`Restored ${this.pathSegments.length} path segments from today`);
      } else {
        this.reset();
      }
    } catch (e) {
      console.error('Failed to load patterns:', e);
      this.reset();
    }
  }

  reset() {
    this.activeFlights.clear();
    this.pathSegments = [];
    this.segmentCount = 0;
    this.startTime = Date.now();
    this.lastResetDate = new Date().toDateString();

    this.accumCtx.fillStyle = '#000000';
    this.accumCtx.fillRect(0, 0, this.accumCanvas.width, this.accumCanvas.height);

    console.log('Flight patterns reset — starting fresh artwork');
  }

  clear() {
    // Don't clear on mode switch — preserve accumulated art
  }
}
