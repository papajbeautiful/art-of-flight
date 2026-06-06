/**
 * Map Mode: Google Maps with Snazzy Map styles
 * Aircraft, trails, labels drawn on canvas overlay
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

    // Google Map state
    this.googleMap = null;
    this.mapDiv = document.getElementById('googleMap');
    this.currentStyleKey = 'assassins_creed';
    this.mapSynced = false;
    this.syncPending = false;
  }

  onOptionsChanged(options) {
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
    if (this.googleMap && !this.mapSynced && !this.syncPending) {
      this.syncMapView();
    }
    super.update(flights);
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

    // Fallback to the shared coordinate system
    return super.latLonToScreen(lat, lon);
  }

  clear() {
    super.clear();
    this.hideMap();
  }
}
