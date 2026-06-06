const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const FlightDataService = require('./flightDataService');

const app = express();
const PORT = process.env.PORT || 3000;

// Frozen flight fixture for deterministic testing (?mock=1)
let mockFixture = null;
function getMockFixture() {
  if (!mockFixture) {
    const fixturePath = path.join(__dirname, 'fixtures', 'flights.json');
    mockFixture = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));
  }
  return mockFixture;
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
    if (req.query.mock === '1') {
      const fixture = getMockFixture();
      return res.json({
        success: true,
        count: fixture.flights.length,
        flights: fixture.flights,
        timestamp: Date.now()
      });
    }

    const { lat, lon, radius = 30 } = req.query;

    if (!lat || !lon) {
      return res.status(400).json({
        error: 'Missing required parameters: lat and lon'
      });
    }

    const flights = await flightService.getFlightsInRadius(
      parseFloat(lat),
      parseFloat(lon),
      parseFloat(radius)
    );

    res.json({
      success: true,
      count: flights.length,
      flights,
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

// Config endpoint - passes server-side config to client
app.get('/api/config', (req, res) => {
  res.json({
    googleMapsApiKey: process.env.GOOGLE_MAPS_API_KEY || ''
  });
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
