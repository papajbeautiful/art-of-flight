/**
 * Capture a deterministic flight fixture for ?mock=1 testing.
 *
 * Takes a raw /api/flights response (server/fixtures/raw2.json by default),
 * enriches routes via adsbdb.com, zeroes velocities (static positions =>
 * reproducible screenshots), and writes server/fixtures/flights.json.
 *
 * Usage: node tools/capture-fixture.mjs [rawResponse.json]
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MOVING = process.argv.includes('--moving');
const rawPath = process.argv.slice(2).find(a => !a.startsWith('--')) || path.join(__dirname, '../server/fixtures/raw2.json');
const outPath = path.join(__dirname, MOVING ? '../server/fixtures/flights-moving.json' : '../server/fixtures/flights.json');

const raw = JSON.parse(fs.readFileSync(rawPath, 'utf8'));
const MAX_FLIGHTS = 25;

// --moving keeps real velocities (for by-eye motion review: trails, easing,
// pulse). The default zero-velocity fixture stays the exact pixel guard.
// Reuse routes already captured in flights.json to avoid re-querying adsbdb.
const existingRoutes = new Map();
if (MOVING) {
  try {
    const existing = JSON.parse(fs.readFileSync(path.join(__dirname, '../server/fixtures/flights.json'), 'utf8'));
    existing.flights.forEach(f => {
      if (f.originCity) existingRoutes.set(f.callsign, {
        origin: f.origin, originCity: f.originCity,
        destination: f.destination, destinationCity: f.destinationCity
      });
    });
  } catch { /* no existing fixture */ }
}

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function lookupRoute(callsign) {
  try {
    const res = await fetch(`https://api.adsbdb.com/v0/callsign/${encodeURIComponent(callsign)}`, {
      headers: { 'User-Agent': 'theARTofFLIGHT/2.0 (fixture capture)' },
      signal: AbortSignal.timeout(10000)
    });
    if (!res.ok) return null;
    const data = await res.json();
    const fr = data?.response?.flightroute;
    if (!fr?.origin || !fr?.destination) return null;
    return {
      origin: fr.origin.icao_code,
      originCity: fr.origin.municipality || fr.origin.name,
      destination: fr.destination.icao_code,
      destinationCity: fr.destination.municipality || fr.destination.name
    };
  } catch {
    return null;
  }
}

const flights = raw.flights.slice(0, MAX_FLIGHTS);
let routed = 0;

for (const f of flights) {
  if (!MOVING) {
    // Static positions: zero velocity so the client predictor holds aircraft still
    f.velocity = 0;
    f.velocityKnots = 0;
    f.velocityKmh = 0;
  }

  if (f.callsign && f.callsign !== 'UNKNOWN') {
    const cached = existingRoutes.get(f.callsign);
    const route = cached || await lookupRoute(f.callsign);
    if (route) {
      Object.assign(f, route);
      routed++;
      console.log(`route: ${f.callsign}  ${route.origin} (${route.originCity}) -> ${route.destination} (${route.destinationCity})`);
    }
    if (!cached) await sleep(400); // be polite to adsbdb
  }
}

fs.writeFileSync(outPath, JSON.stringify({ flights }, null, 2));
console.log(`\nWrote ${flights.length} flights (${routed} with routes) to ${outPath}`);
