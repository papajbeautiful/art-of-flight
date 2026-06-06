/**
 * Stable Coordinate System
 * Locks the projection so aircraft move smoothly across the screen
 */
class CoordinateSystem {
  constructor(canvas) {
    this.canvas = canvas;
    this.centerLat = null;
    this.centerLon = null;
    this.scale = null;
    this.isLocked = false;
  }

  /**
   * Logical (CSS pixel) canvas dimensions.
   * The backing store is DPR-scaled, so canvas.width is device pixels —
   * all projection math works in CSS pixels to match the scaled context.
   */
  get viewWidth() { return this.canvas.clientWidth || this.canvas.width; }
  get viewHeight() { return this.canvas.clientHeight || this.canvas.height; }

  /**
   * Initialize and lock the projection based on current flights
   */
  lock(flights, padding = 0.8) {
    if (!flights || flights.length === 0) return;

    const bounds = this.calculateBounds(flights);

    // Set center point (won't change)
    this.centerLat = (bounds.minLat + bounds.maxLat) / 2;
    this.centerLon = (bounds.minLon + bounds.maxLon) / 2;

    // Calculate scale to fit all flights with padding
    const latRange = bounds.maxLat - bounds.minLat || 0.1;
    const lonRange = bounds.maxLon - bounds.minLon || 0.1;

    const scaleX = (this.viewWidth * padding) / lonRange;
    const scaleY = (this.viewHeight * padding) / latRange;
    this.scale = Math.min(scaleX, scaleY);

    this.isLocked = true;

    console.log(`Coordinate system locked: center=(${this.centerLat.toFixed(4)}, ${this.centerLon.toFixed(4)}), scale=${this.scale.toFixed(2)}`);
  }

  /**
   * Update center and scale if new flights expand the bounds
   */
  /**
   * Lock to user's configured location instead of flight bounds
   */
  lockToUserLocation(lat, lon, radiusKm) {
    this.centerLat = lat;
    this.centerLon = lon;

    // Calculate scale based on radius
    const kmPerDegree = 111; // Approximate
    const degreesRadius = radiusKm / kmPerDegree;

    const scaleX = (this.viewWidth * 0.4) / degreesRadius;
    const scaleY = (this.viewHeight * 0.4) / degreesRadius;
    this.scale = Math.min(scaleX, scaleY);

    this.isLocked = true;

    console.log(`Map locked to user location: (${lat.toFixed(4)}, ${lon.toFixed(4)}), radius: ${radiusKm}km`);
  }

  /**
   * Update is now a no-op - map stays fixed
   */
  update(flights, padding = 0.8) {
    // Map stays locked - do nothing
  }

  /**
   * Convert lat/lon to screen coordinates
   */
  toScreen(lat, lon) {
    if (!this.isLocked) {
      return { x: this.viewWidth / 2, y: this.viewHeight / 2 };
    }

    const x = this.viewWidth / 2 + (lon - this.centerLon) * this.scale;
    const y = this.viewHeight / 2 - (lat - this.centerLat) * this.scale;

    return { x, y };
  }

  /**
   * Convert screen coordinates to lat/lon
   */
  toLatLon(x, y) {
    if (!this.isLocked) {
      return { lat: this.centerLat || 0, lon: this.centerLon || 0 };
    }

    const lon = this.centerLon + (x - this.viewWidth / 2) / this.scale;
    const lat = this.centerLat - (y - this.viewHeight / 2) / this.scale;

    return { lat, lon };
  }

  /**
   * Get the visible bounds in lat/lon
   */
  getVisibleBounds() {
    const topLeft = this.toLatLon(0, 0);
    const bottomRight = this.toLatLon(this.viewWidth, this.viewHeight);

    return {
      north: topLeft.lat,
      south: bottomRight.lat,
      west: topLeft.lon,
      east: bottomRight.lon
    };
  }

  calculateBounds(flights) {
    let minLat = Infinity, maxLat = -Infinity;
    let minLon = Infinity, maxLon = -Infinity;

    flights.forEach(f => {
      if (f.latitude && f.longitude) {
        minLat = Math.min(minLat, f.latitude);
        maxLat = Math.max(maxLat, f.latitude);
        minLon = Math.min(minLon, f.longitude);
        maxLon = Math.max(maxLon, f.longitude);
      }
    });

    return { minLat, maxLat, minLon, maxLon };
  }

  unlock() {
    this.isLocked = false;
  }

  reset() {
    this.centerLat = null;
    this.centerLon = null;
    this.scale = null;
    this.isLocked = false;
  }
}
