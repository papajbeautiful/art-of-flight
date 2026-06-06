/**
 * Position Predictor - Smooth Flight Tracking
 *
 * Uses velocity + heading to move aircraft continuously at 60fps.
 * When new API data arrives, gently corrects any drift without visible snapping.
 *
 * Key design:
 *   - Display position moves FORWARD by velocity every frame (never freezes)
 *   - Extrapolated target = lastKnownPos + velocity * timeSinceUpdate
 *   - Gentle correction steers display toward target (fixes drift from turns etc.)
 *   - updateTime only resets when position actually changes (ignores cached responses)
 */
class PositionPredictor {
  constructor() {
    this.aircraft = new Map();
  }

  /**
   * Update with actual data from API.
   * Only resets extrapolation clock when position has genuinely changed,
   * so cached server responses don't interrupt smooth movement.
   */
  update(id, actualLat, actualLon, heading, velocityKnots, timestamp) {
    if (!this.aircraft.has(id)) {
      this.aircraft.set(id, {
        actualLat,
        actualLon,
        heading: heading || 0,
        velocity: velocityKnots || 0,
        updateTime: timestamp,
        lastPredictTime: 0,
        displayLat: actualLat,
        displayLon: actualLon
      });
    } else {
      const a = this.aircraft.get(id);

      // Only reset extrapolation clock when position genuinely changed
      const moved = Math.abs(actualLat - a.actualLat) > 0.00005
                 || Math.abs(actualLon - a.actualLon) > 0.00005;

      if (moved) {
        a.actualLat = actualLat;
        a.actualLon = actualLon;
        a.updateTime = timestamp;
      }

      // Always update kinematics (heading/speed can change between position updates)
      // Explicit null checks: heading 0 (due north) and velocity 0 (stopped)
      // are valid values — `if (heading)` froze stale kinematics on them.
      if (heading !== undefined && heading !== null) a.heading = heading;
      if (velocityKnots !== undefined && velocityKnots !== null) a.velocity = velocityKnots;
    }
  }

  /**
   * Get smooth predicted position.
   * Called every frame (~60fps) from the animation loop.
   */
  predict(id, currentTime) {
    if (!this.aircraft.has(id)) return null;

    const a = this.aircraft.get(id);

    // Frame delta in seconds (capped to avoid jumps after tab-switch etc.)
    const dt = a.lastPredictTime
      ? Math.min((currentTime - a.lastPredictTime) / 1000, 0.1)
      : 0;
    a.lastPredictTime = currentTime;

    // Skip if no velocity data
    if (!a.velocity || a.velocity < 1) {
      return { lat: a.displayLat, lon: a.displayLon };
    }

    // Convert velocity to degrees per second
    const headingRad = a.heading * Math.PI / 180;
    const speedKmPerSec = a.velocity * 1.852 / 3600;
    const cosLat = Math.cos(a.displayLat * Math.PI / 180) || 0.001;
    const dLatPerSec = (speedKmPerSec * Math.cos(headingRad)) / 111.32;
    const dLonPerSec = (speedKmPerSec * Math.sin(headingRad)) / (111.32 * cosLat);

    // Step 1: Move display forward at current velocity (continuous motion)
    a.displayLat += dLatPerSec * dt;
    a.displayLon += dLonPerSec * dt;

    // Step 2: Gently correct toward where the plane SHOULD be
    // (extrapolated target = last known position + velocity * elapsed)
    const elapsedSinceUpdate = Math.min((currentTime - a.updateTime) / 1000, 20);
    const targetLat = a.actualLat + dLatPerSec * elapsedSinceUpdate;
    const targetLon = a.actualLon + dLonPerSec * elapsedSinceUpdate;

    // Correction factor: 5% per frame at 60fps → ~95% corrected in 1 second
    const correction = 0.05;
    a.displayLat += (targetLat - a.displayLat) * correction;
    a.displayLon += (targetLon - a.displayLon) * correction;

    return {
      lat: a.displayLat,
      lon: a.displayLon
    };
  }

  /** Remove a single aircraft (e.g. after its fade-out completes) */
  remove(id) {
    this.aircraft.delete(id);
  }

  cleanup(currentTime, maxAge = 60000) {
    for (const [id, a] of this.aircraft.entries()) {
      if (currentTime - a.updateTime > maxAge) {
        this.aircraft.delete(id);
      }
    }
  }

  clear() {
    this.aircraft.clear();
  }
}
