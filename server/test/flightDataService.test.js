/**
 * Unit tests for FlightDataService reliability behavior.
 * Run: node --test server/test/
 */
const { test } = require('node:test');
const assert = require('node:assert');
const FlightDataService = require('../flightDataService');

// ── Helpers ──────────────────────────────────────────────────

const AC = (over = {}) => ({
  hex: 'abc123', flight: 'QFA1 ', alt_baro: 30000, lat: -33.9, lon: 151.2,
  gs: 450, track: 90, baro_rate: 0, r: 'VH-ABC', t: 'B738', ...over
});

function okJson(body) {
  return { ok: true, status: 200, json: async () => body };
}

function makeService(fetchImpl, options = {}) {
  return new FlightDataService({
    fetchImpl,
    cacheDuration: 0,        // disable request dedup in tests
    routeLookupDelay: 0,
    backoffBase: 50,
    ...options
  });
}

const ROUTE_BODY = {
  response: {
    flightroute: {
      origin: { icao_code: 'YSSY', municipality: 'Sydney' },
      destination: { icao_code: 'YMML', municipality: 'Melbourne' }
    }
  }
};

// ── Fallback chain ───────────────────────────────────────────

test('falls back to the next source when the first fails', async () => {
  const calls = [];
  const service = makeService(async (url) => {
    calls.push(url);
    if (url.includes('adsb.lol')) throw new Error('boom');
    if (url.includes('adsb.fi')) return okJson({ ac: [AC()] });
    throw new Error('unexpected source');
  });

  const result = await service.getFlightsInRadius(-33.89, 151.14, 30);
  assert.equal(result.source, 'adsb.fi');
  assert.equal(result.stale, false);
  assert.equal(result.flights.length, 1);
  assert.equal(result.flights[0].callsign, 'QFA1');
  assert.ok(calls.some(u => u.includes('adsb.lol')), 'tried adsb.lol first');
});

test('falls through to the third source on double failure', async () => {
  const service = makeService(async (url) => {
    if (url.includes('airplanes.live')) return okJson({ ac: [AC()] });
    return { ok: false, status: 503, json: async () => ({}) };
  });

  const result = await service.getFlightsInRadius(-33.89, 151.14, 30);
  assert.equal(result.source, 'airplanes.live');
  assert.equal(result.flights.length, 1);
});

test('a 200-with-zero-aircraft source does not mask later sources', async () => {
  // Seen live 12/06/2026: adsb.fi answered 0 for Sydney while
  // airplanes.live saw 52 — empty answers must fall through
  const service = makeService(async (url) => {
    if (url.includes('adsb.lol')) throw new Error('down');
    if (url.includes('adsb.fi')) return okJson({ ac: [] });
    return okJson({ ac: [AC()] });
  });

  const result = await service.getFlightsInRadius(-33.89, 151.14, 30);
  assert.equal(result.source, 'airplanes.live');
  assert.equal(result.flights.length, 1);
  // The empty source answered correctly — it must NOT be circuit-broken
  assert.ok(service.sourceAvailable('adsb.fi'), 'adsb.fi not marked failed');
});

test('an empty sky is served when every reachable source agrees', async () => {
  const service = makeService(async () => okJson({ ac: [] }));

  const result = await service.getFlightsInRadius(-33.89, 151.14, 30);
  assert.equal(result.flights.length, 0);
  assert.equal(result.stale, false);
  assert.equal(result.source, 'adsb.lol');
});

test('the source that delivered is tried FIRST on the next request', async () => {
  // Live failure mode 12/06/2026: a dead head-of-chain source added its
  // full timeout to EVERY poll (9.4s responses). Once a source delivers,
  // the next request must go straight to it.
  const calls = [];
  const service = makeService(async (url) => {
    if (url.includes('api.adsb.lol')) { calls.push('adsb.lol'); throw new Error('down'); }
    if (url.includes('adsb.fi')) { calls.push('adsb.fi'); return okJson({ ac: [] }); }
    calls.push('airplanes.live');
    return okJson({ ac: [AC()] });
  });

  await service.getFlightsInRadius(-33.89, 151.14, 30);   // walks the chain
  calls.length = 0;
  const result = await service.getFlightsInRadius(-33.89, 151.14, 30);

  assert.equal(result.source, 'airplanes.live');
  assert.deepEqual(calls, ['airplanes.live'], 'second request hit only the preferred source');
});

// ── Serve-stale-on-error ─────────────────────────────────────

test('serves last good payload when every source fails', async () => {
  let healthy = true;
  const service = makeService(async () => {
    if (healthy) return okJson({ ac: [AC()] });
    throw new Error('all down');
  });

  const first = await service.getFlightsInRadius(-33.89, 151.14, 30);
  assert.equal(first.stale, false);

  healthy = false;
  service.sourceHealth.clear(); // bypass breaker so all sources are retried
  const second = await service.getFlightsInRadius(-33.89, 151.14, 30);
  assert.equal(second.stale, true);
  assert.equal(second.flights.length, 1, 'stale flights preserved');
  assert.ok(second.dataAgeSeconds >= 0);
  assert.equal(second.source, 'adsb.lol');
});

test('returns empty stale payload when nothing has ever succeeded', async () => {
  const service = makeService(async () => { throw new Error('down'); });
  const result = await service.getFlightsInRadius(-33.89, 151.14, 30);
  assert.equal(result.stale, true);
  assert.deepEqual(result.flights, []);
  assert.equal(result.dataAgeSeconds, null);
});

// ── Circuit breaker ──────────────────────────────────────────

test('failing source is skipped while backing off', async () => {
  const calls = [];
  const service = makeService(async (url) => {
    calls.push(url);
    if (url.includes('adsb.lol')) throw new Error('boom');
    return okJson({ ac: [] });
  });

  await service.getFlightsInRadius(-33.89, 151.14, 30);
  const lolCallsAfterFirst = calls.filter(u => u.includes('adsb.lol')).length;
  assert.equal(lolCallsAfterFirst, 1);

  // Immediately again: adsb.lol should be inside its backoff window
  await service.getFlightsInRadius(-33.89, 151.14, 30);
  const lolCallsAfterSecond = calls.filter(u => u.includes('adsb.lol')).length;
  assert.equal(lolCallsAfterSecond, 1, 'adsb.lol skipped during backoff');

  // After the backoff window it gets retried
  await new Promise(r => setTimeout(r, 60));
  await service.getFlightsInRadius(-33.89, 151.14, 30);
  const lolCallsAfterBackoff = calls.filter(u => u.includes('adsb.lol')).length;
  assert.equal(lolCallsAfterBackoff, 2, 'adsb.lol retried after backoff');
});

// ── Route cache ──────────────────────────────────────────────

test('routes are looked up once and cached', async () => {
  let routeCalls = 0;
  const service = makeService(async (url) => {
    if (url.includes('adsbdb')) { routeCalls++; return okJson(ROUTE_BODY); }
    return okJson({ ac: [AC()] });
  });

  await service.getFlightsInRadius(-33.89, 151.14, 30);
  await service.processRouteQueue(); // ensure queue drained
  assert.equal(routeCalls, 1);

  const second = await service.getFlightsInRadius(-33.89, 151.14, 30);
  await service.processRouteQueue();
  assert.equal(routeCalls, 1, 'cached route reused');
  assert.equal(second.flights[0].originCity, 'Sydney');
  assert.equal(second.flights[0].destinationCity, 'Melbourne');
});

test('unknown callsigns are negative-cached with a cooldown', async () => {
  let routeCalls = 0;
  const service = makeService(async (url) => {
    if (url.includes('adsbdb')) { routeCalls++; return { ok: false, status: 404, json: async () => ({}) }; }
    return okJson({ ac: [AC()] });
  }, { routeNegativeTtl: 30 });

  await service.getFlightsInRadius(-33.89, 151.14, 30);
  await service.processRouteQueue();
  assert.equal(routeCalls, 1);

  // Within cooldown: no re-lookup
  await service.getFlightsInRadius(-33.89, 151.14, 30);
  await service.processRouteQueue();
  assert.equal(routeCalls, 1);

  // After cooldown expiry: retried
  await new Promise(r => setTimeout(r, 40));
  await service.getFlightsInRadius(-33.89, 151.14, 30);
  await service.processRouteQueue();
  assert.equal(routeCalls, 2);
});

test('network failure during route lookup is not cached', async () => {
  let fail = true;
  let routeCalls = 0;
  const service = makeService(async (url) => {
    if (url.includes('adsbdb')) {
      routeCalls++;
      if (fail) throw new Error('net down');
      return okJson(ROUTE_BODY);
    }
    return okJson({ ac: [AC()] });
  });

  await service.getFlightsInRadius(-33.89, 151.14, 30);
  await service.processRouteQueue();
  assert.equal(routeCalls, 1);
  assert.equal(service.routeCache.size, 0, 'failure not cached');

  fail = false;
  const result = await service.getFlightsInRadius(-33.89, 151.14, 30);
  await service.processRouteQueue();
  assert.equal(routeCalls, 2, 'retried next cycle');
});

test('route cache is bounded (LRU eviction)', () => {
  const service = makeService(async () => okJson({ ac: [] }), { routeCacheMax: 3 });
  for (let i = 0; i < 10; i++) {
    service.setCachedRoute(`CS${i}`, { origin: 'A', originCity: 'a', destination: 'B', destinationCity: 'b' }, 60000);
  }
  assert.equal(service.routeCache.size, 3);
  assert.ok(service.getCachedRoute('CS9'), 'most recent survives');
  assert.equal(service.getCachedRoute('CS0'), null, 'oldest evicted');
});

// ── Parsing ──────────────────────────────────────────────────

test('parseAdsbFlight treats 0 as a valid value', () => {
  const service = makeService(async () => okJson({ ac: [] }));
  const flight = service.parseAdsbFlight(AC({ alt_baro: 'ground', gs: 0, track: 0, baro_rate: 0 }));
  assert.equal(flight.altitudeFeet, 0);
  assert.equal(flight.velocityKnots, 0);
  assert.equal(flight.heading, 0);
  assert.equal(flight.verticalRate, 0);
  assert.equal(flight.onGround, true);
});

test('parseAdsbFlight handles missing fields as null', () => {
  const service = makeService(async () => okJson({ ac: [] }));
  const flight = service.parseAdsbFlight({ hex: 'aaa' });
  assert.equal(flight.callsign, 'UNKNOWN');
  assert.equal(flight.altitudeFeet, null);
  assert.equal(flight.velocityKnots, null);
  assert.equal(flight.heading, null);
});
