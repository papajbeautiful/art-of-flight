const fetch = require('node-fetch');
const { getAirportCity } = require('./airports');

class FlightDataService {
  constructor() {
    // ADSB.lol API — no auth required, fast position updates
    this.adsbUrl = 'https://api.adsb.lol/v2';

    // ADSB.lol routeset endpoint for batch route lookups
    this.routesetUrl = 'https://api.adsb.lol/api/0/routeset';

    // Position cache — short TTL for fresh data
    this.cache = new Map();
    this.cacheDuration = 1500; // 1.5 seconds

    // Route cache — successful routes cached indefinitely
    this.routeCache = new Map();

    // Batch route lookup state
    this.pendingRouteLookups = []; // [{callsign, lat, lng}]
    this.routeBatchTimer = null;
  }

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

  async getFlightsInRadius(lat, lon, radiusKm = 30) {
    const cacheKey = `${lat},${lon},${radiusKm}`;
    const cached = this.cache.get(cacheKey);

    if (cached && Date.now() - cached.timestamp < this.cacheDuration) {
      return cached.data;
    }

    try {
      // Convert km to nautical miles for ADSB.lol
      const distNm = Math.ceil(radiusKm * 0.539957);

      const url = `${this.adsbUrl}/lat/${lat}/lon/${lon}/dist/${distNm}/`;
      console.log(`Fetching flights from ADSB.lol...`);

      const response = await fetch(url, {
        headers: { 'User-Agent': 'theARTofFLIGHT/2.0' },
        timeout: 10000
      });

      if (!response.ok) {
        throw new Error(`ADSB.lol API error: ${response.status}`);
      }

      const data = await response.json();

      if (!data.ac || data.ac.length === 0) {
        console.log('No flights in area');
        this.cache.set(cacheKey, { data: [], timestamp: Date.now() });
        return [];
      }

      // Parse and filter flights
      const flights = data.ac
        .map(ac => this.parseAdsbFlight(ac))
        .filter(flight => {
          if (!flight.latitude || !flight.longitude) return false;
          const distance = this.calculateDistance(lat, lon, flight.latitude, flight.longitude);
          flight.distance = distance;
          return distance <= radiusKm;
        })
        .sort((a, b) => a.distance - b.distance);

      // Queue batch route lookups for flights without cached routes
      const needRoutes = flights.filter(f =>
        f.callsign && f.callsign !== 'UNKNOWN' &&
        !this.routeCache.has(f.callsign) &&
        f.latitude && f.longitude
      );
      if (needRoutes.length > 0) {
        this.queueBatchRouteLookup(needRoutes);
      }

      // Attach route data from cache
      flights.forEach(flight => {
        const route = this.routeCache.get(flight.callsign);
        if (route && route.origin) {
          flight.origin = route.origin;
          flight.originCity = route.originCity;
          flight.destination = route.destination;
          flight.destinationCity = route.destinationCity;
        }
      });

      this.cache.set(cacheKey, { data: flights, timestamp: Date.now() });
      console.log(`Found ${flights.length} flights within ${radiusKm}km`);
      return flights;

    } catch (error) {
      console.error('Error fetching flight data:', error.message);
      throw error;
    }
  }

  /**
   * Parse ADSB.lol aircraft object into our format
   */
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

  /**
   * Queue flights for batch route lookup via ADSB.lol routeset API
   */
  queueBatchRouteLookup(flights) {
    flights.forEach(f => {
      const already = this.pendingRouteLookups.find(p => p.callsign === f.callsign);
      if (!already) {
        this.pendingRouteLookups.push({
          callsign: f.callsign,
          lat: f.latitude,
          lng: f.longitude
        });
      }
    });

    // Debounce: fire batch request shortly after collecting
    if (!this.routeBatchTimer) {
      this.routeBatchTimer = setTimeout(() => this.processBatchRoutes(), 500);
    }
  }

  async processBatchRoutes() {
    this.routeBatchTimer = null;

    if (this.pendingRouteLookups.length === 0) return;

    // Take current batch
    const batch = this.pendingRouteLookups.splice(0);

    try {
      const body = { planes: batch };

      const response = await fetch(this.routesetUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'theARTofFLIGHT/2.0'
        },
        body: JSON.stringify(body),
        timeout: 10000
      });

      if (!response.ok) {
        console.warn(`Routeset API error: ${response.status}`);
        return;
      }

      const routes = await response.json();

      // Process results
      if (Array.isArray(routes)) {
        routes.forEach(route => {
          if (route.callsign && route._airports && route._airports.length >= 2) {
            const origin = route._airports[0];
            const dest = route._airports[route._airports.length - 1];

            this.routeCache.set(route.callsign, {
              origin: origin.icao,
              originCity: origin.location || getAirportCity(origin.icao),
              destination: dest.icao,
              destinationCity: dest.location || getAirportCity(dest.icao),
            });

            console.log(`Route: ${route.callsign}  ${origin.icao} (${origin.location}) → ${dest.icao} (${dest.location})`);
          } else if (route.callsign) {
            // No route found
            this.routeCache.set(route.callsign, {
              origin: null, originCity: null,
              destination: null, destinationCity: null
            });
          }
        });
      }

      // Mark any callsigns that weren't in the response as no-route
      batch.forEach(req => {
        if (!this.routeCache.has(req.callsign)) {
          this.routeCache.set(req.callsign, {
            origin: null, originCity: null,
            destination: null, destinationCity: null
          });
        }
      });

      console.log(`Batch route lookup: ${routes.length}/${batch.length} routes found`);

    } catch (error) {
      console.warn(`Batch route lookup failed: ${error.message}`);
      // Don't cache failures — they'll be retried on next fetch cycle
    }
  }

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
      'UPS': { airlineName: 'UPS', airlineColor: '#351c15' },
    };

    const code = callsign.substring(0, 3);
    return airlineMap[code] || { airlineName: null, airlineColor: '#888888' };
  }
}

module.exports = FlightDataService;
