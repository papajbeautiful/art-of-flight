/**
 * Flight Manager: Handles fetching, prediction, and lifecycle (fade in/out)
 */
class FlightManager {
  constructor() {
    this.flights = [];
    this.lastUpdate = 0;
    this.updateInterval = 10000;
    this.isUpdating = false;

    // ?mock=1 — ask the server for its frozen flight fixture (testing)
    this.mockMode = new URLSearchParams(window.location.search).get('mock') === '1';

    this.predictor = new PositionPredictor();

    this.location = {
      name: 'Summer Hill, NSW, Australia',
      latitude: -33.8914,
      longitude: 151.1382
    };

    this.radius = 30;
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

    this.isUpdating = true;

    try {
      const url = `/api/flights?lat=${this.location.latitude}&lon=${this.location.longitude}&radius=${this.radius}${this.mockMode ? '&mock=1' : ''}`;
      const response = await fetch(url);
      const data = await response.json();

      if (data.success) {
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
        return this.flights;
      }
    } catch (error) {
      console.error('Error fetching flights:', error);
      return this.flights;
    } finally {
      this.isUpdating = false;
    }
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
        if (state.opacity <= 0) {
          this.aircraftState.delete(id);
          this.predictor.cleanup(now, 0); // allow predictor to clean up too
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
