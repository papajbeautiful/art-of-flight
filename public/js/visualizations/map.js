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
      labelFormat: '{airline} {type} to {destination}'
    });

    this.map = null;
    this.mapDiv = document.getElementById('mapContainer');
    this.currentStyleKey = 'dark';
    this.mapSynced = false;
    this.syncPending = false;
    this.loading = false;
  }

  onOptionsChanged(options) {
    if (options.mapStyle !== undefined) {
      this.setMapStyle(options.mapStyle);
    }
  }

  static styleUrl(key) {
    return `/vendor/maplibre/style-${key}.json`;
  }

  static validStyles() {
    return ['dark', 'black', 'grayscale'];
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
        center: [151.1382, -33.8914],
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
    // Old installs may have stored Google/Snazzy style keys — map them to dark
    if (!MapVisualization.validStyles().includes(styleKey)) styleKey = 'dark';
    if (styleKey === this.currentStyleKey && this.map) return;
    this.currentStyleKey = styleKey;

    if (this.map) {
      this.map.setStyle(MapVisualization.styleUrl(styleKey));
    }
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
