const fetch = require('node-fetch');
const { getAirportCity } = require('./airports');

/**
 * ADS-B position sources, tried in order. All serve the same readsb-style
 * JSON ({ ac: [...] }), so one parser covers the whole chain.
 */
const POSITION_SOURCES = [
  { name: 'adsb.lol', url: (lat, lon, nm) => `https://api.adsb.lol/v2/lat/${lat}/lon/${lon}/dist/${nm}/` },
  { name: 'adsb.fi', url: (lat, lon, nm) => `https://opendata.adsb.fi/api/v2/lat/${lat}/lon/${lon}/dist/${nm}` },
  { name: 'airplanes.live', url: (lat, lon, nm) => `https://api.airplanes.live/v2/point/${lat}/${lon}/${nm}` }
];

const MS = { SECOND: 1000, MINUTE: 60000, HOUR: 3600000, DAY: 86400000 };

class FlightDataService {
  constructor(options = {}) {
    this.fetch = options.fetchImpl || fetch;
    this.sources = options.sources || POSITION_SOURCES;
    this.requestTimeout = options.requestTimeout ?? 8000;

    // Short-TTL request dedup (concurrent clients / rapid polls)
    this.cache = new Map();
    this.cacheDuration = options.cacheDuration ?? 1500;
    this.cacheMaxKeys = options.cacheMaxKeys ?? 50;

    // Serve-stale-on-error: last successful payload per location key.
    // A 24/7 kiosk should keep showing slightly-old aircraft over nothing.
    this.lastGood = new Map();

    // Circuit breaker per source: consecutive failures => exponential backoff
    this.sourceHealth = new Map();
    this.backoffBase = options.backoffBase ?? 30 * MS.SECOND;
    this.backoffMax = options.backoffMax ?? 5 * MS.MINUTE;

    // Route cache: callsign -> { origin, originCity, destination,
    // destinationCity, expiresAt }. Bounded LRU; negative results get a
    // shorter TTL so newly-filed routes eventually appear.
    // (adsb.lol's routeset API now returns 201 with an empty body, so route
    // lookups go to adsbdb.com instead — per-callsign, politely throttled.)
    this.routeCache = new Map();
    this.routeCacheMax = options.routeCacheMax ?? 2000;
    this.routePositiveTtl = options.routePositiveTtl ?? 7 * MS.DAY;
    this.routeNegativeTtl = options.routeNegativeTtl ?? 2 * MS.HOUR;
    this.routeLookupUrl = options.routeLookupUrl || 'https://api.adsbdb.com/v0/callsign/';
    this.routeLookupsPerCycle = options.routeLookupsPerCycle ?? 5;
    this.routeLookupDelay = options.routeLookupDelay ?? 300;
    this.pendingRouteLookups = [];
    this.routeQueueRunning = false;
  }

  // ── Geometry ──────────────────────────────────────────────

  calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371;
    const dLat = this.toRad(lat2 - lat1);
    const dLon = this.toRad(lon2 - lon1);
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(this.toRad(lat1)) * Math.cos(this.toRad(lat2)) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  toRad(degrees) {
    return degrees * Math.PI / 180;
  }

  // ── Circuit breaker ───────────────────────────────────────

  sourceAvailable(name) {
    const health = this.sourceHealth.get(name);
    return !health || Date.now() >= health.retryAt;
  }

  markSourceFailure(name) {
    const health = this.sourceHealth.get(name) || { failures: 0, retryAt: 0 };
    health.failures += 1;
    const backoff = Math.min(this.backoffBase * Math.pow(2, health.failures - 1), this.backoffMax);
    health.retryAt = Date.now() + backoff;
    this.sourceHealth.set(name, health);
    console.warn(`[${name}] failure #${health.failures}, backing off ${Math.round(backoff / 1000)}s`);
  }

  markSourceSuccess(name) {
    this.sourceHealth.delete(name);
  }

  // ── Position fetching ─────────────────────────────────────

  async fetchFromSource(source, lat, lon, distNm) {
    const response = await this.fetch(source.url(lat, lon, distNm), {
      headers: { 'User-Agent': 'theARTofFLIGHT/2.0' },
      timeout: this.requestTimeout
    });
    if (!response.ok) {
      throw new Error(`${source.name} HTTP ${response.status}`);
    }
    const data = await response.json();
    return data.ac || [];
  }

  /**
   * Fetch flights near a point. Never throws for upstream problems —
   * degrades through the source chain, then to the last good payload.
   *
   * Returns { flights, stale, dataAgeSeconds, source }.
   */
  async getFlightsInRadius(lat, lon, radiusKm = 30) {
    const cacheKey = `${lat},${lon},${radiusKm}`;
    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.cacheDuration) {
      return cached.payload;
    }

    const distNm = Math.ceil(radiusKm * 0.539957);

    for (const source of this.sources) {
      if (!this.sourceAvailable(source.name)) continue;

      try {
        const ac = await this.fetchFromSource(source, lat, lon, distNm);
        this.markSourceSuccess(source.name);

        const flights = ac
          .map(a => this.parseAdsbFlight(a))
          .filter(flight => {
            if (!flight.latitude || !flight.longitude) return false;
            const distance = this.calculateDistance(lat, lon, flight.latitude, flight.longitude);
            flight.distance = distance;
            return distance <= radiusKm;
          })
          .sort((a, b) => a.distance - b.distance);

        this.queueRouteLookups(flights);
        this.attachRoutes(flights);

        const payload = { flights, stale: false, dataAgeSeconds: 0, source: source.name };
        this.setCache(cacheKey, payload);
        this.lastGood.set(cacheKey, { flights, timestamp: Date.now(), source: source.name });
        console.log(`[${source.name}] ${flights.length} flights within ${radiusKm}km`);
        return payload;
      } catch (error) {
        this.markSourceFailure(source.name);
      }
    }

    // Every source failed or is backing off — serve the last good payload
    const last = this.lastGood.get(cacheKey);
    if (last) {
      const ageSeconds = Math.round((Date.now() - last.timestamp) / 1000);
      console.warn(`All sources down — serving stale data (${ageSeconds}s old)`);
      return { flights: last.flights, stale: true, dataAgeSeconds: ageSeconds, source: last.source };
    }

    console.warn('All sources down and no cached data available');
    return { flights: [], stale: true, dataAgeSeconds: null, source: null };
  }

  setCache(key, payload) {
    this.cache.set(key, { payload, timestamp: Date.now() });
    while (this.cache.size > this.cacheMaxKeys) {
      this.cache.delete(this.cache.keys().next().value);
    }
  }

  // ── Parsing ───────────────────────────────────────────────

  parseAdsbFlight(ac) {
    // Explicit null checks throughout: 0 is a valid altitude (on ground),
    // velocity (stopped), heading (due north), and vertical rate (level).
    const altBaro = ac.alt_baro === 'ground' ? 0 : (ac.alt_baro ?? null);
    const callsign = (ac.flight || '').trim() || 'UNKNOWN';

    return {
      icao24: ac.hex || '',
      callsign: callsign,
      country: '',
      latitude: ac.lat ?? null,
      longitude: ac.lon ?? null,
      baroAltitude: altBaro,
      onGround: ac.alt_baro === 'ground',
      velocity: ac.gs ?? null,
      heading: ac.track ?? null,
      verticalRate: ac.baro_rate ?? null,
      registration: ac.r || '',
      aircraftType: ac.t || '',
      category: ac.category || '',
      positionAge: ac.seen_pos ?? null,
      altitudeFeet: altBaro != null ? Math.round(altBaro) : null,
      velocityKnots: ac.gs != null ? Math.round(ac.gs) : null,
      velocityKmh: ac.gs != null ? Math.round(ac.gs * 1.852) : null,
      ...this.getAirlineInfo(callsign)
    };
  }

  // ── Route enrichment ──────────────────────────────────────

  /** Get a cached, unexpired route (refreshing its LRU position) or null */
  getCachedRoute(callsign) {
    const entry = this.routeCache.get(callsign);
    if (!entry) return null;
    if (Date.now() >= entry.expiresAt) {
      this.routeCache.delete(callsign);
      return null;
    }
    // LRU touch: re-insert so iteration order tracks recency
    this.routeCache.delete(callsign);
    this.routeCache.set(callsign, entry);
    return entry;
  }

  setCachedRoute(callsign, route, ttl) {
    this.routeCache.set(callsign, { ...route, expiresAt: Date.now() + ttl });
    while (this.routeCache.size > this.routeCacheMax) {
      this.routeCache.delete(this.routeCache.keys().next().value);
    }
  }

  attachRoutes(flights) {
    flights.forEach(flight => {
      const route = this.getCachedRoute(flight.callsign);
      if (route && route.origin) {
        flight.origin = route.origin;
        flight.originCity = route.originCity;
        flight.destination = route.destination;
        flight.destinationCity = route.destinationCity;
      }
    });
  }

  queueRouteLookups(flights) {
    flights.forEach(f => {
      if (!f.callsign || f.callsign === 'UNKNOWN') return;
      if (this.getCachedRoute(f.callsign)) return;
      if (this.pendingRouteLookups.includes(f.callsign)) return;
      this.pendingRouteLookups.push(f.callsign);
    });

    if (this.pendingRouteLookups.length > 0 && !this.routeQueueRunning) {
      this.routeQueueRunning = true;
      // Fire-and-forget; errors are contained inside
      this.processRouteQueue().finally(() => { this.routeQueueRunning = false; });
    }
  }

  async processRouteQueue() {
    // Throttled drain: a few lookups per cycle, spaced out — polite to
    // adsbdb.com, and the cache means steady-state traffic is tiny.
    while (this.pendingRouteLookups.length > 0) {
      const batch = this.pendingRouteLookups.splice(0, this.routeLookupsPerCycle);

      for (const callsign of batch) {
        try {
          const route = await this.lookupRoute(callsign);
          if (route) {
            this.setCachedRoute(callsign, route, this.routePositiveTtl);
            console.log(`Route: ${callsign}  ${route.origin} (${route.originCity}) -> ${route.destination} (${route.destinationCity})`);
          } else {
            // Known-unknown: cache with a cooldown so we retry eventually
            this.setCachedRoute(callsign,
              { origin: null, originCity: null, destination: null, destinationCity: null },
              this.routeNegativeTtl);
          }
        } catch (error) {
          // Network/API failure — leave uncached (retried next cycle), and
          // stop draining for now rather than hammering a struggling API
          console.warn(`Route lookup failed for ${callsign}: ${error.message}`);
          return;
        }

        if (this.routeLookupDelay > 0) {
          await new Promise(r => setTimeout(r, this.routeLookupDelay));
        }
      }
    }
  }

  /**
   * Look up a route on adsbdb.com. Returns route fields, or null when the
   * API affirmatively doesn't know the callsign. Throws on network failure.
   */
  async lookupRoute(callsign) {
    const response = await this.fetch(`${this.routeLookupUrl}${encodeURIComponent(callsign)}`, {
      headers: { 'User-Agent': 'theARTofFLIGHT/2.0' },
      timeout: this.requestTimeout
    });

    // adsbdb answers 404 for unknown callsigns — a definitive "no route"
    if (response.status === 404) return null;
    if (!response.ok) throw new Error(`adsbdb HTTP ${response.status}`);

    const data = await response.json();
    const fr = data?.response?.flightroute;
    if (!fr?.origin?.icao_code || !fr?.destination?.icao_code) return null;

    return {
      origin: fr.origin.icao_code,
      originCity: fr.origin.municipality || getAirportCity(fr.origin.icao_code),
      destination: fr.destination.icao_code,
      destinationCity: fr.destination.municipality || getAirportCity(fr.destination.icao_code)
    };
  }

  // ── Airline lookup ────────────────────────────────────────

  getAirlineInfo(callsign) {
    const airlineMap = {
      'QFA': { airlineName: 'Qantas', airlineColor: '#e21e3a' },
      'QJE': { airlineName: 'QantasLink', airlineColor: '#e21e3a' },
      'QLK': { airlineName: 'QantasLink', airlineColor: '#e21e3a' },
      'VOZ': { airlineName: 'Virgin Australia', airlineColor: '#cc0033' },
      'JST': { airlineName: 'Jetstar', airlineColor: '#ff6000' },
      'RXA': { airlineName: 'Rex Airlines', airlineColor: '#003366' },
      'BNZ': { airlineName: 'Bonza', airlineColor: '#7b2d8b' },
      'ANZ': { airlineName: 'Air New Zealand', airlineColor: '#001f3d' },
      'UAL': { airlineName: 'United Airlines', airlineColor: '#0033a0' },
      'AAL': { airlineName: 'American Airlines', airlineColor: '#c8102e' },
      'DAL': { airlineName: 'Delta Air Lines', airlineColor: '#003a70' },
      'SWA': { airlineName: 'Southwest', airlineColor: '#304cb2' },
      'BAW': { airlineName: 'British Airways', airlineColor: '#2e5c99' },
      'DLH': { airlineName: 'Lufthansa', airlineColor: '#05164d' },
      'AFR': { airlineName: 'Air France', airlineColor: '#002157' },
      'KLM': { airlineName: 'KLM', airlineColor: '#00a1de' },
      'QTR': { airlineName: 'Qatar Airways', airlineColor: '#5c0633' },
      'UAE': { airlineName: 'Emirates', airlineColor: '#c8102e' },
      'ETD': { airlineName: 'Etihad', airlineColor: '#bd8b13' },
      'SIA': { airlineName: 'Singapore Airlines', airlineColor: '#003087' },
      'CPA': { airlineName: 'Cathay Pacific', airlineColor: '#005d30' },
      'ANA': { airlineName: 'ANA', airlineColor: '#00467f' },
      'JAL': { airlineName: 'Japan Airlines', airlineColor: '#c8102e' },
      'KAL': { airlineName: 'Korean Air', airlineColor: '#003b7a' },
      'CCA': { airlineName: 'Air China', airlineColor: '#c8102e' },
      'CES': { airlineName: 'China Eastern', airlineColor: '#003087' },
      'CSN': { airlineName: 'China Southern', airlineColor: '#005baa' },
      'THY': { airlineName: 'Turkish Airlines', airlineColor: '#c8102e' },
      'SAA': { airlineName: 'South African Airways', airlineColor: '#003580' },
      'AIC': { airlineName: 'Air India', airlineColor: '#e1251b' },
      'MAS': { airlineName: 'Malaysia Airlines', airlineColor: '#0c2340' },
      'THA': { airlineName: 'Thai Airways', airlineColor: '#4e2181' },
      'EVA': { airlineName: 'EVA Air', airlineColor: '#007a3e' },
      'VIR': { airlineName: 'Virgin Atlantic', airlineColor: '#e01a22' },
      'EZY': { airlineName: 'easyJet', airlineColor: '#ff6600' },
      'RYR': { airlineName: 'Ryanair', airlineColor: '#073590' },
      'ACA': { airlineName: 'Air Canada', airlineColor: '#f01428' },
      'LAN': { airlineName: 'LATAM', airlineColor: '#1b0088' },
      'AVA': { airlineName: 'Avianca', airlineColor: '#e31837' },
      'IBE': { airlineName: 'Iberia', airlineColor: '#d2232a' },
      'TAP': { airlineName: 'TAP Portugal', airlineColor: '#00a651' },
      'SAS': { airlineName: 'SAS', airlineColor: '#000080' },
      'FIN': { airlineName: 'Finnair', airlineColor: '#003580' },
      'ICE': { airlineName: 'Icelandair', airlineColor: '#003888' },
      'RAM': { airlineName: 'Royal Air Maroc', airlineColor: '#c7102e' },
      'ETH': { airlineName: 'Ethiopian Airlines', airlineColor: '#008751' },
      'FDX': { airlineName: 'FedEx', airlineColor: '#4d148c' },
      'UPS': { airlineName: 'UPS', airlineColor: '#351c15' }
    };

    const code = callsign.substring(0, 3);
    return airlineMap[code] || { airlineName: null, airlineColor: '#888888' };
  }
}

module.exports = FlightDataService;
