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

    // Per-mode options
    this.options = {
      lineOpacity: 1.0,
      lineWidth: 1.0,
      haloWidth: 1.0,
      inboundColor: 'time',   // 'time' = time-of-day palette, or a fixed color key
      outboundColor: 'time',
      showGroundAircraft: false,
      showLeadingDot: true,
      dotSize: 2.5,
      showStats: true
    };

    // Handle canvas resize
    this._resizeHandler = () => this.handleResize();
    window.addEventListener('resize', this._resizeHandler);

    // Inbound/outbound color palettes
    this.inboundPalettes = {
      night:  ['rgba(40, 80, 255, 1)', 'rgba(80, 120, 255, 1)', 'rgba(120, 170, 255, 1)', 'rgba(180, 210, 255, 1)'],
      dawn:   ['rgba(255, 140, 40, 1)', 'rgba(255, 180, 80, 1)', 'rgba(255, 210, 140, 1)', 'rgba(255, 230, 180, 1)'],
      day:    ['rgba(60, 180, 255, 1)', 'rgba(120, 210, 255, 1)', 'rgba(180, 230, 255, 1)', 'rgba(230, 245, 255, 1)'],
      dusk:   ['rgba(180, 60, 255, 1)', 'rgba(200, 120, 255, 1)', 'rgba(220, 160, 255, 1)', 'rgba(240, 200, 255, 1)']
    };

    this.outboundPalettes = {
      night:  ['rgba(255, 60, 80, 1)', 'rgba(255, 100, 120, 1)', 'rgba(255, 150, 160, 1)', 'rgba(255, 200, 210, 1)'],
      dawn:   ['rgba(80, 200, 120, 1)', 'rgba(120, 220, 150, 1)', 'rgba(160, 235, 180, 1)', 'rgba(200, 245, 210, 1)'],
      day:    ['rgba(255, 170, 50, 1)', 'rgba(255, 195, 100, 1)', 'rgba(255, 215, 150, 1)', 'rgba(255, 235, 200, 1)'],
      dusk:   ['rgba(255, 180, 60, 1)', 'rgba(255, 200, 100, 1)', 'rgba(255, 220, 150, 1)', 'rgba(255, 235, 190, 1)']
    };

    // Fixed color options (non time-based)
    this.fixedColors = {
      cyan:    'rgba(0, 240, 255, 1)',
      blue:    'rgba(60, 120, 255, 1)',
      gold:    'rgba(255, 210, 60, 1)',
      magenta: 'rgba(255, 60, 180, 1)',
      green:   'rgba(80, 255, 120, 1)',
      white:   'rgba(220, 230, 255, 1)',
      red:     'rgba(255, 80, 80, 1)',
      orange:  'rgba(255, 160, 50, 1)'
    };

    // Load saved paths
    this.loadPaths();
    this.checkMidnightReset();
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
    if (options.lineOpacity !== undefined) this.options.lineOpacity = options.lineOpacity;
    if (options.lineWidth !== undefined) this.options.lineWidth = options.lineWidth;
    if (options.haloWidth !== undefined) this.options.haloWidth = options.haloWidth;
    if (options.inboundColor !== undefined) this.options.inboundColor = options.inboundColor;
    if (options.outboundColor !== undefined) this.options.outboundColor = options.outboundColor;
    if (options.showGroundAircraft !== undefined) this.options.showGroundAircraft = options.showGroundAircraft;
    if (options.showLeadingDot !== undefined) this.options.showLeadingDot = options.showLeadingDot;
    if (options.dotSize !== undefined) this.options.dotSize = options.dotSize;
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
    const opacityScale = this.options.lineOpacity;
    const lineScale = this.options.lineWidth;
    const haloScale = this.options.haloWidth;
    const segOpacity = seg.opacity ?? 1;

    const passes = [
      { width: 4.0 * haloScale, alpha: 0.06 * opacityScale * segOpacity },
      { width: 1.8 * lineScale, alpha: 0.12 * opacityScale * segOpacity },
      { width: 0.6 * lineScale, alpha: 0.25 * opacityScale * segOpacity },
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

    if (this.lastResetDate !== today) {
      console.log('New day detected — resetting flight patterns');
      this.reset();
      this.lastResetDate = today;
      this.savePaths();
    }
  }

  getTimeOfDay() {
    // Fixed palette in deterministic screenshot runs
    if (window.__DETERMINISTIC__) return 'day';
    const hour = new Date().getHours();
    if (hour >= 0 && hour < 6) return 'night';
    if (hour >= 6 && hour < 9) return 'dawn';
    if (hour >= 9 && hour < 18) return 'day';
    return 'dusk';
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

  getColorForFlight(altitude, timeOfDay, inbound) {
    const colorOption = inbound ? this.options.inboundColor : this.options.outboundColor;

    // Fixed color mode
    if (colorOption !== 'time' && this.fixedColors[colorOption]) {
      return this.fixedColors[colorOption];
    }

    // Time-of-day palette
    const palettes = inbound ? this.inboundPalettes : this.outboundPalettes;
    const palette = palettes[timeOfDay];
    const normalized = Math.min(altitude / 45000, 1);
    const index = Math.floor(normalized * (palette.length - 1));
    return palette[Math.min(index, palette.length - 1)];
  }

  update(flights) {
    const now = Date.now();
    const timeOfDay = this.getTimeOfDay();

    this.checkMidnightReset();

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
          color: this.getColorForFlight(flight.altitudeFeet || 0, timeOfDay, inbound !== false),
          heading: flight.heading || 0,
          direction: direction,
          opacity: flight.opacity ?? 1,
          startTime: now,
          lastUpdate: now
        });
      } else {
        const flightData = this.activeFlights.get(id);
        const lastPos = flightData.positions[flightData.positions.length - 1];

        // Calculate screen distance to decide if we should add a segment
        const lastScreen = this.latLonToScreen(lastPos.lat, lastPos.lon);
        const currScreen = this.latLonToScreen(flight.latitude, flight.longitude);
        const dx = currScreen.x - lastScreen.x;
        const dy = currScreen.y - lastScreen.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance > 1.5) {
          // Create bezier control point from previous trajectory
          const prevPos = flightData.positions.length > 1
            ? flightData.positions[flightData.positions.length - 2]
            : lastPos;

          // Update direction classification
          flightData.direction = direction;
          flightData.color = this.getColorForFlight(flight.altitudeFeet || 0, timeOfDay, inbound !== false);

          const segOpacity = flight.opacity ?? 1;
          const segment = {
            lat1: lastPos.lat,
            lon1: lastPos.lon,
            lat2: flight.latitude,
            lon2: flight.longitude,
            clat: lastPos.lat + (flight.latitude - prevPos.lat) * 0.3,
            clon: lastPos.lon + (flight.longitude - prevPos.lon) * 0.3,
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
      if (flightData.positions.length < 2) continue;

      const opacity = flightData.opacity ?? 1;
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

      // Bright dot at current position
      if (this.options.showLeadingDot) {
        const lastPos = this.latLonToScreen(pos[pos.length - 1].lat, pos[pos.length - 1].lon);
        this.ctx.globalAlpha = 0.7 * opacity;
        this.ctx.fillStyle = flightData.color;
        this.ctx.beginPath();
        this.ctx.arc(lastPos.x, lastPos.y, this.options.dotSize, 0, Math.PI * 2);
        this.ctx.fill();
      }
    }

    // Reset
    this.ctx.globalAlpha = 1;
    this.ctx.globalCompositeOperation = 'source-over';

    // Stats overlay
    if (this.options.showStats) {
      this.drawStats();
    }
  }

  drawStats() {
    // Wall-clock dependent — masked in deterministic screenshot runs
    if (window.__DETERMINISTIC__) return;

    const now = Date.now();
    const elapsed = now - this.startTime;
    const hours = Math.floor(elapsed / 3600000);
    const minutes = Math.floor((elapsed % 3600000) / 60000);
    const h = this.viewHeight;

    // Count inbound/outbound
    let inCount = 0, outCount = 0;
    for (const [, fd] of this.activeFlights) {
      if (fd.direction === 'inbound') inCount++;
      else if (fd.direction === 'outbound') outCount++;
    }

    this.ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    this.ctx.fillRect(16, h - 76, 230, 60);

    this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    this.ctx.lineWidth = 1;
    this.ctx.strokeRect(16, h - 76, 230, 60);

    this.ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
    this.ctx.font = '9px "Space Mono", monospace';
    this.ctx.fillText('FLIGHT PATTERNS', 26, h - 58);

    this.ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
    this.ctx.fillText(`${this.segmentCount} paths | ${this.activeFlights.size} active | ${hours}h ${minutes}m`, 26, h - 44);

    // Inbound/outbound breakdown
    this.ctx.fillText(`${inCount} inbound | ${outCount} outbound`, 26, h - 30);

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    const hoursUntil = Math.floor((tomorrow - now) / 3600000);

    this.ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
    this.ctx.fillText(`resets in ${hoursUntil}h`, 26, h - 20);
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
