require('dotenv').config();

const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const FlightDataService = require('./flightDataService');

const app = express();
const PORT = process.env.PORT || 3000;

// Frozen flight fixtures for deterministic testing:
//   ?mock=1       static fixture (zero velocities) — exact pixel guard
//   ?mock=moving  real velocities — motion review (trails, easing)
const mockFixtures = new Map();
function getMockFixture(kind) {
  const file = kind === 'moving' ? 'flights-moving.json' : 'flights.json';
  if (!mockFixtures.has(file)) {
    mockFixtures.set(file, JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', file), 'utf8')));
  }
  return mockFixtures.get(file);
}

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

// Initialize flight data service
const flightService = new FlightDataService();

// API Routes
app.get('/api/flights', async (req, res) => {
  try {
    // Deterministic fixture for screenshot/regression testing
    if (req.query.mock) {
      const fixture = getMockFixture(req.query.mock);
      return res.json({
        success: true,
        count: fixture.flights.length,
        flights: fixture.flights,
        stale: false,
        dataAgeSeconds: 0,
        source: 'fixture',
        timestamp: Date.now()
      });
    }

    const { lat, lon, radius = 30 } = req.query;

    if (!lat || !lon) {
      return res.status(400).json({
        error: 'Missing required parameters: lat and lon'
      });
    }

    const result = await flightService.getFlightsInRadius(
      parseFloat(lat),
      parseFloat(lon),
      parseFloat(radius)
    );

    res.json({
      success: true,
      count: result.flights.length,
      flights: result.flights,
      stale: result.stale,
      dataAgeSeconds: result.dataAgeSeconds,
      source: result.source,
      timestamp: Date.now()
    });
  } catch (error) {
    console.error('Error fetching flights:', error);
    res.status(500).json({
      error: 'Failed to fetch flight data',
      message: error.message
    });
  }
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: Date.now(),
    service: 'theARTofFLIGHT'
  });
});

// Serve the main app
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🎨 theARTofFLIGHT server running on port ${PORT}`);
  console.log(`📡 Access the visualization at http://localhost:${PORT}`);
});
