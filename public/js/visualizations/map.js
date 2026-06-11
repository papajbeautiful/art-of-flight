/**
 * Map Mode: MapLibre GL over self-hosted Protomaps vector tiles
 * Aircraft, trails, labels drawn on the canvas overlay above the map.
 *
 * Fully self-contained: maplibre-gl + pmtiles are vendored, the regional
 * tile archive is served by our own Express server, and the styles are
 * symbol-free (no glyph/sprite assets). No API key, no network dependency.
 */
class MapVisualization extends AircraftVisualization {
  constructor(canvas, ctx) {
    super(canvas, ctx);

    this.ease = 0.15;

    Object.assign(this.options, {
      showTrails: true,
      showCallsigns: true,
      showAltitude: true,
      showSpeed: true,
      showRoute: true,
      aircraftIcon: 'chevron',
      labelFormat: '{airline} {type} to {destination}',
      spotlightLabels: true
    });

    this.map = null;
    this.mapDiv = document.getElementById('mapContainer');
    this.currentStyleKey = 'nocturne';
    this.mapSynced = false;
    this.syncPending = false;
    this.loading = false;

    this._haloCache = new Map();  // colour → radial sprite
    this._spotlight = new Set();  // icao24s allowed a full label this frame
    this._vignette = null;
    this._vignetteKey = '';
  }

  get extraOptionKeys() { return ['mapStyle', 'spotlightLabels']; }

  onOptionsChanged(options) {
    if (options.mapStyle !== undefined) {
      this.setMapStyle(options.mapStyle);
    }
  }

  static styleUrl(key) {
    return `/vendor/maplibre/style-${key}.json`;
  }

  static validStyles() {
    return ['nocturne', 'dark', 'black', 'grayscale'];
  }

  _loadScript(src) {
    return new Promise((resolve, reject) => {
      const existing = document.querySelector(`script[src="${src}"]`);
      if (existing) return resolve();
      const script = document.createElement('script');
      script.src = src;
      script.onload = resolve;
      script.onerror = () => reject(new Error(`Failed to load ${src}`));
      document.head.appendChild(script);
    });
  }

  _loadCss(href) {
    if (document.querySelector(`link[href="${href}"]`)) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = href;
    document.head.appendChild(link);
  }

  async initMapLibre() {
    if (this.map || this.loading || !this.mapDiv) return;
    this.loading = true;

    try {
      // Lazy-load the vendored map stack only when map mode is first shown
      this._loadCss('/vendor/maplibre/maplibre-gl.css');
      await this._loadScript('/vendor/maplibre/maplibre-gl.js');
      await this._loadScript('/vendor/maplibre/pmtiles.js');

      if (!MapVisualization._protocolRegistered) {
        const protocol = new pmtiles.Protocol();
        maplibregl.addProtocol('pmtiles', protocol.tile);
        MapVisualization._protocolRegistered = true;
      }

      this.map = new maplibregl.Map({
        container: this.mapDiv,
        style: MapVisualization.styleUrl(this.currentStyleKey),
        center: [151.2153, -33.8568],
        zoom: 10,
        attributionControl: false, // attribution lives in the About tab
        interactive: false         // kiosk display — the overlay owns the view
      });

      console.log('MapLibre initialized');
    } catch (e) {
      console.error('Failed to initialize MapLibre:', e);
      this.map = null;
    } finally {
      this.loading = false;
    }
  }

  showMap() {
    if (!this.mapDiv) return;
    this.mapDiv.style.display = 'block';

    if (!this.map) {
      this.initMapLibre();
    } else {
      this.map.resize();
    }

    this.mapSynced = false;
    this.syncPending = false;
  }

  hideMap() {
    if (!this.mapDiv) return;
    this.mapDiv.style.display = 'none';
  }

  syncMapView() {
    if (!this.map || !window.theArtOfFlight?.coordSystem?.isLocked) return;

    const bounds = window.theArtOfFlight.coordSystem.getVisibleBounds();

    this.syncPending = true;
    this.map.fitBounds(
      [[bounds.west, bounds.south], [bounds.east, bounds.north]],
      { padding: 0, duration: 0 }
    );

    this.map.once('idle', () => {
      this.mapSynced = true;
      this.syncPending = false;
    });
  }

  setMapStyle(styleKey) {
    // Old installs may have stored Google/Snazzy style keys — map them home
    if (!MapVisualization.validStyles().includes(styleKey)) styleKey = 'nocturne';
    if (styleKey === this.currentStyleKey && this.map) return;
    this.currentStyleKey = styleKey;

    if (this.map) {
      this.map.setStyle(MapVisualization.styleUrl(styleKey));
    }
  }

  /** Cached soft halo sprite per colour — landing lights, not markers */
  _halo(color) {
    let sprite = this._haloCache.get(color);
    if (sprite) return sprite;
    const s = 56;
    sprite = document.createElement('canvas');
    sprite.width = sprite.height = s;
    const g = sprite.getContext('2d');
    const m = hexToRgbIcon(color);
    const grad = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    grad.addColorStop(0, `rgba(${m.r}, ${m.g}, ${m.b}, 0.45)`);
    grad.addColorStop(0.35, `rgba(${m.r}, ${m.g}, ${m.b}, 0.14)`);
    grad.addColorStop(1, `rgba(${m.r}, ${m.g}, ${m.b}, 0)`);
    g.fillStyle = grad;
    g.fillRect(0, 0, s, s);
    if (this._haloCache.size > 64) this._haloCache.clear();
    this._haloCache.set(color, sprite);
    return sprite;
  }

  /** Spotlight policy: only the nearest few aircraft carry full cards */
  drawLabel(aircraft, s, bgAlpha) {
    if (this.options.spotlightLabels) {
      const id = aircraft.flight?.icao24;
      if (!this._spotlight.has(id)) return;
    }
    super.drawLabel(aircraft, s, bgAlpha);
  }

  draw() {
    const w = this.canvas.clientWidth || window.innerWidth;
    const h = this.canvas.clientHeight || window.innerHeight;
    const ctx = this.ctx;

    // Choose this frame's spotlight: the 3 nearest aircraft
    this._spotlight.clear();
    if (this.options.spotlightLabels) {
      const sorted = [];
      for (const [, aircraft] of this.aircraftPositions.entries()) {
        const d = aircraft.flight?.distance;
        sorted.push({ id: aircraft.flight?.icao24, d: d ?? 999 });
      }
      sorted.sort((a, b) => a.d - b.d).slice(0, 3).forEach(e => this._spotlight.add(e.id));
    }

    // Luminous halos beneath the icons — additive over the dark map
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const [, aircraft] of this.aircraftPositions.entries()) {
      const isOnGround = aircraft.altitude <= 0;
      if (isOnGround && !this.options.showGroundAircraft) continue;
      const fade = aircraft.flight?.opacity ?? 1;
      const sprite = this._halo(aircraft.color);
      const size = 34 * this.options.aircraftScale;
      ctx.globalAlpha = fade;
      ctx.drawImage(sprite, aircraft.x - size / 2, aircraft.y - size / 2, size, size);
    }
    ctx.restore();
    ctx.globalAlpha = 1;

    super.draw();

    // Night-photography vignette pulls the city glow centre-frame
    const vKey = `${w}x${h}`;
    if (this._vignetteKey !== vKey) {
      this._vignetteKey = vKey;
      this._vignette = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.42, w / 2, h / 2, Math.hypot(w, h) * 0.58);
      this._vignette.addColorStop(0, 'rgba(0, 0, 0, 0)');
      this._vignette.addColorStop(1, 'rgba(0, 0, 0, 0.42)');
    }
    ctx.fillStyle = this._vignette;
    ctx.fillRect(0, 0, w, h);
  }

  update(flights) {
    if (this.map && !this.mapSynced && !this.syncPending) {
      this.syncMapView();
    }
    super.update(flights);
  }

  latLonToScreen(lat, lon) {
    // MapLibre's own projection keeps the overlay pixel-aligned to the tiles
    if (this.map) {
      const p = this.map.project([lon, lat]);
      return { x: p.x, y: p.y };
    }
    return super.latLonToScreen(lat, lon);
  }

  clear() {
    super.clear();
    this.hideMap();
  }
}
