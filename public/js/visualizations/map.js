/**
 * Map Mode: Google Maps with Snazzy Map styles
 * Aircraft, trails, labels, and compass drawn on canvas overlay
 */
class MapVisualization {
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
      accentColor: '#00F0FF',
      inboundColor: '',
      outboundColor: '',
      dotSize: 8
    };

    // Google Map state
    this.googleMap = null;
    this.mapDiv = document.getElementById('googleMap');
    this.currentStyleKey = 'assassins_creed';
    this.mapSynced = false;
    this.syncPending = false;
  }

  setDisplayOptions(options) {
    if (!options) return;
    const keys = [
      'showTrails', 'showCallsigns', 'showAltitude', 'showSpeed',
      'showRoute', 'showCoordinates', 'showAirborneAircraft',
      'showGroundAircraft', 'aircraftIcon', 'labelFormat',
      'inboundLabelFormat', 'outboundLabelFormat', 'aircraftScale',
      'labelTextScale', 'labelBgOpacity', 'labelBgColor', 'accentColor',
      'inboundColor', 'outboundColor', 'dotSize'
    ];
    keys.forEach(k => { if (options[k] !== undefined) this.displayOptions[k] = options[k]; });
    if (options.trailLength !== undefined) {
      this.displayOptions.trailLength = options.trailLength;
      this.maxTrailLength = options.trailLength;
    }

    // Handle map style changes
    if (options.mapStyle !== undefined) {
      this.setMapStyle(options.mapStyle);
    }

    // Handle custom map style JSON
    if (options.customMapStyle && options.mapStyle === 'custom') {
      this.applyCustomStyle(options.customMapStyle);
    }
  }

  applyCustomStyle(jsonString) {
    try {
      const parsed = JSON.parse(jsonString);
      if (Array.isArray(parsed)) {
        if (typeof setCustomMapStyle === 'function') {
          setCustomMapStyle(parsed);
        }
        if (this.googleMap) {
          this.googleMap.setOptions({ styles: parsed });
        }
      }
    } catch (e) {
      console.error('Invalid custom map style JSON:', e);
    }
  }

  initGoogleMap() {
    if (this.googleMap || typeof google === 'undefined') return;

    const style = MAP_STYLES[this.currentStyleKey] || MAP_STYLES.assassins_creed;

    this.googleMap = new google.maps.Map(this.mapDiv, {
      center: { lat: -33.8914, lng: 151.1382 },
      zoom: 12,
      disableDefaultUI: true,
      gestureHandling: 'none',
      keyboardShortcuts: false,
      clickableIcons: false,
      styles: style.styles
    });

    console.log('Google Map initialized');
  }

  showMap() {
    if (!this.mapDiv) return;
    this.mapDiv.style.display = 'block';

    if (!this.googleMap && typeof google !== 'undefined') {
      this.initGoogleMap();
    }

    this.mapSynced = false;
    this.syncPending = false;
  }

  hideMap() {
    if (!this.mapDiv) return;
    this.mapDiv.style.display = 'none';
  }

  syncMapView() {
    if (!this.googleMap || !window.theArtOfFlight?.coordSystem?.isLocked) return;

    const coordSystem = window.theArtOfFlight.coordSystem;
    const bounds = coordSystem.getVisibleBounds();

    const mapBounds = new google.maps.LatLngBounds(
      new google.maps.LatLng(bounds.south, bounds.west),
      new google.maps.LatLng(bounds.north, bounds.east)
    );

    this.syncPending = true;
    this.googleMap.fitBounds(mapBounds, 0);

    // Wait for fitBounds to take effect before marking synced
    google.maps.event.addListenerOnce(this.googleMap, 'idle', () => {
      this.mapSynced = true;
      this.syncPending = false;
    });
  }

  setMapStyle(styleKey) {
    if (styleKey === this.currentStyleKey && this.googleMap) return;
    this.currentStyleKey = styleKey;

    if (this.googleMap && MAP_STYLES[styleKey]) {
      this.googleMap.setOptions({ styles: MAP_STYLES[styleKey].styles });
    }
  }

  update(flights) {
    const now = Date.now();

    if (this.googleMap && !this.mapSynced && !this.syncPending) {
      this.syncMapView();
    }

    flights.forEach(flight => {
      if (!flight.latitude || !flight.longitude) return;

      const id = flight.icao24;
      const position = this.latLonToScreen(flight.latitude, flight.longitude);

      if (!this.aircraftPositions.has(id)) {
        this.aircraftPositions.set(id, {
          x: position.x,
          y: position.y,
          targetX: position.x,
          targetY: position.y,
          lat: flight.latitude,
          lon: flight.longitude,
          heading: flight.heading || 0,
          altitude: flight.altitudeFeet || 0,
          velocity: flight.velocityKnots || 0,
          callsign: flight.callsign,
          flight: flight,
          color: this.getAirlineColor(flight.callsign, flight),
          lastUpdate: now
        });

        this.trails.set(id, []);
      } else {
        const aircraft = this.aircraftPositions.get(id);
        aircraft.targetX = position.x;
        aircraft.targetY = position.y;
        aircraft.lat = flight.latitude;
        aircraft.lon = flight.longitude;
        aircraft.heading = flight.heading || aircraft.heading;
        aircraft.altitude = flight.altitudeFeet || 0;
        aircraft.velocity = flight.velocityKnots || 0;
        aircraft.lastUpdate = now;
        aircraft.flight = flight;
        aircraft.color = this.getAirlineColor(flight.callsign, flight);
      }
    });

    for (const [id, aircraft] of this.aircraftPositions.entries()) {
      const ease = 0.15;
      aircraft.x += (aircraft.targetX - aircraft.x) * ease;
      aircraft.y += (aircraft.targetY - aircraft.y) * ease;

      if (!this.trails.has(id)) {
        this.trails.set(id, []);
      }

      const trail = this.trails.get(id);

      if (trail.length === 0 ||
          Math.abs(aircraft.x - trail[trail.length - 1].x) > 2 ||
          Math.abs(aircraft.y - trail[trail.length - 1].y) > 2) {
        trail.push({ x: aircraft.x, y: aircraft.y, time: now });
      }

      if (trail.length > this.maxTrailLength) {
        trail.shift();
      }

      if (now - aircraft.lastUpdate > 30000) {
        this.aircraftPositions.delete(id);
        this.trails.delete(id);
      }
    }
  }

  latLonToScreen(lat, lon) {
    // Use Google Maps' own projection for pixel-perfect alignment
    if (this.googleMap) {
      const projection = this.googleMap.getProjection();
      const bounds = this.googleMap.getBounds();
      if (projection && bounds) {
        const ne = bounds.getNorthEast();
        const sw = bounds.getSouthWest();
        const topRight = projection.fromLatLngToPoint(ne);
        const bottomLeft = projection.fromLatLngToPoint(sw);
        const point = projection.fromLatLngToPoint(new google.maps.LatLng(lat, lon));

        const w = this.canvas.clientWidth || this.canvas.width;
        const h = this.canvas.clientHeight || this.canvas.height;
        const x = (point.x - bottomLeft.x) / (topRight.x - bottomLeft.x) * w;
        const y = (point.y - topRight.y) / (bottomLeft.y - topRight.y) * h;
        return { x, y };
      }
    }

    // Fallback to coordinate system
    if (window.theArtOfFlight?.coordSystem?.isLocked) {
      return window.theArtOfFlight.coordSystem.toScreen(lat, lon);
    }
    return { x: (this.canvas.clientWidth || this.canvas.width) / 2, y: (this.canvas.clientHeight || this.canvas.height) / 2 };
  }

  getAirlineColor(callsign, flight) {
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

  draw() {
    const s = this.displayOptions.labelTextScale;
    const bgAlpha = this.displayOptions.labelBgOpacity;

    if (this.displayOptions.showTrails) {
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
          this.ctx.fillText(`${aircraft.lat.toFixed(4)}, ${aircraft.lon.toFixed(4)}`, labelX + 5, currentY);
        }
      }

      this.ctx.globalAlpha = 1;
    }

  }

  drawAircraft(x, y, heading, color) {
    this.ctx.save();
    this.ctx.translate(x, y);
    this.ctx.rotate((heading || 0) * Math.PI / 180);

    const size = 15 * this.displayOptions.aircraftScale;

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
    this.hideMap();
  }
}
