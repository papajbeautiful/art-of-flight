/**
 * Flight Manager: Handles fetching, prediction, and lifecycle (fade in/out)
 */
class FlightManager {
  constructor() {
    this.flights = [];
    this.lastUpdate = 0;
    this.updateInterval = 10000;
    this.isUpdating = false;

    // ?mock=1 (static) or ?mock=moving — server-side frozen fixtures (testing)
    this.mockMode = new URLSearchParams(window.location.search).get('mock') || '';

    // Connection health: timeout + exponential backoff so a struggling
    // server isn't hammered, and the UI can show a signal-lost state
    this.fetchTimeout = 8000;
    this.consecutiveFailures = 0;
    this.backoffUntil = 0;
    this.lastSuccessTime = 0;
    this.upstreamStale = false;       // server reached, but its sources are down
    this.upstreamAgeSeconds = 0;

    this.predictor = new PositionPredictor();

    this.location = {
      name: 'Sydney Opera House, NSW, Australia',
      latitude: -33.8568,
      longitude: 151.2153
    };

    this.radius = 50;
    this.maxFlights = 50;

    // Aircraft lifecycle: tracks opacity for fade in/out
    // { icao24: { opacity, fading, flight, lastSeen } }
    this.aircraftState = new Map();

    // Fade duration in ms
    this.fadeDuration = 1500;
  }

  setLocation(name, lat, lon) {
    this.location = { name, latitude: lat, longitude: lon };
  }

  setRadius(radius) {
    this.radius = radius;
  }

  setUpdateInterval(interval) {
    this.updateInterval = interval * 1000;
  }

  setMaxFlights(max) {
    this.maxFlights = max;
  }

  async fetchFlights() {
    if (this.isUpdating) {
      return this.flights;
    }

    const now = Date.now();
    if (now - this.lastUpdate < this.updateInterval) {
      return this.flights;
    }
    if (now < this.backoffUntil) {
      return this.flights;
    }

    this.isUpdating = true;

    try {
      const url = `/api/flights?lat=${this.location.latitude}&lon=${this.location.longitude}&radius=${this.radius}${this.mockMode ? `&mock=${this.mockMode}` : ''}`;
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), this.fetchTimeout);
      let response;
      try {
        response = await fetch(url, { signal: controller.signal });
      } finally {
        clearTimeout(timeout);
      }
      const data = await response.json();

      if (data.success) {
        this.consecutiveFailures = 0;
        this.backoffUntil = 0;
        this.lastSuccessTime = now;
        this.upstreamStale = !!data.stale;
        this.upstreamAgeSeconds = data.dataAgeSeconds ?? 0;
        this.flights = data.flights.slice(0, this.maxFlights);
        this.lastUpdate = now;

        // Track which aircraft are currently in the API response
        const activeIds = new Set();

        this.flights.forEach(flight => {
          if (!flight.latitude || !flight.longitude) return;

          const id = flight.icao24;
          activeIds.add(id);

          // Update position predictor
          this.predictor.update(
            id,
            flight.latitude,
            flight.longitude,
            flight.heading || 0,
            flight.velocityKnots || 0,
            now
          );

          // Update lifecycle state
          if (!this.aircraftState.has(id)) {
            // New aircraft — fade in
            this.aircraftState.set(id, {
              opacity: 0,
              fading: 'in',
              fadeStart: now,
              flight: flight,
              lastSeen: now
            });
          } else {
            const state = this.aircraftState.get(id);
            state.flight = flight;
            state.lastSeen = now;

            // If it was fading out, reverse to fade in
            if (state.fading === 'out') {
              state.fading = 'in';
              state.fadeStart = now - (state.opacity * this.fadeDuration);
            }
          }
        });

        // Mark aircraft no longer in response as fading out
        for (const [id, state] of this.aircraftState.entries()) {
          if (!activeIds.has(id) && state.fading !== 'out') {
            state.fading = 'out';
            state.fadeStart = now - ((1 - state.opacity) * this.fadeDuration);
          }
        }

        console.log(`Updated: ${this.flights.length} flights in view`);
        return this.flights;
      } else {
        console.error('Failed to fetch flights:', data.error);
        this.noteFailure();
        return this.flights;
      }
    } catch (error) {
      console.error('Error fetching flights:', error);
      this.noteFailure();
      return this.flights;
    } finally {
      this.isUpdating = false;
    }
  }

  /** Exponential backoff: 2s, 4s, 8s ... capped at 60s */
  noteFailure() {
    this.consecutiveFailures += 1;
    const backoff = Math.min(2000 * Math.pow(2, this.consecutiveFailures - 1), 60000);
    this.backoffUntil = Date.now() + backoff;
  }

  /**
   * Connection health for the signal-lost overlay.
   * "Trouble" is either the server being unreachable (fetch failures) or
   * the server reporting that its upstream sources are down (stale data).
   */
  getConnectionState() {
    const now = Date.now();
    const sinceSuccess = this.lastSuccessTime ? Math.round((now - this.lastSuccessTime) / 1000) : null;

    let dataAgeSeconds = null;
    if (this.consecutiveFailures > 0) {
      dataAgeSeconds = sinceSuccess;
    } else if (this.upstreamStale) {
      dataAgeSeconds = this.upstreamAgeSeconds;
    }

    return {
      failing: this.consecutiveFailures >= 2,
      stale: this.upstreamStale,
      dataAgeSeconds
    };
  }

  /**
   * Get flights with smooth predicted positions and fade opacity.
   * Called every frame from the animation loop.
   */
  getFlights() {
    const now = Date.now();
    const result = [];

    // Update opacity for all tracked aircraft
    for (const [id, state] of this.aircraftState.entries()) {
      const elapsed = now - state.fadeStart;
      const progress = Math.min(elapsed / this.fadeDuration, 1);

      if (state.fading === 'in') {
        state.opacity = progress;
      } else if (state.fading === 'out') {
        state.opacity = 1 - progress;

        // Fully faded out — remove from tracking
        // (was cleanup(now, 0), which wiped EVERY aircraft's predictor state
        // and caused all remaining planes to snap on their next update)
        if (state.opacity <= 0) {
          this.aircraftState.delete(id);
          this.predictor.remove(id);
          continue;
        }
      }

      // Get predicted position
      const predicted = this.predictor.predict(id, now);
      const flight = { ...state.flight };

      if (predicted) {
        flight.latitude = predicted.lat;
        flight.longitude = predicted.lon;
      }

      flight.opacity = state.opacity;
      result.push(flight);
    }

    return result;
  }

  getRawFlights() {
    return this.flights;
  }

  getFlightCount() {
    return this.flights.length;
  }

  getStatus() {
    const secondsSinceUpdate = Math.floor((Date.now() - this.lastUpdate) / 1000);

    return {
      count: this.flights.length,
      location: this.location.name,
      lastUpdate: secondsSinceUpdate,
      radius: this.radius
    };
  }
}
