# ✈️ theARTofFLIGHT

A beautiful, real-time flight visualization art installation that displays aircraft overhead in artistic ways. Perfect for digital art displays, TVs, or public installations.

![theARTofFLIGHT](https://img.shields.io/badge/status-live-success) ![Docker](https://img.shields.io/badge/docker-ready-blue) ![License](https://img.shields.io/badge/license-MIT-green)

## 🎨 Features

### Visualization Modes

1. **💧 Ripple Mode** - Aircraft create expanding water ripples, like raindrops on a pond
2. **✈️ Reality Mode** - Actual aircraft with livery colors, flight paths, and detailed information
3. **🕊️ Birds Mode** - Each plane represented as an animated bird with flapping wings
4. **✨ Constellation Mode** - Aircraft as stars with trailing paths and particles

### Capabilities

- 🌍 **Fully Configurable** - Set your location anywhere in the world
- 🎛️ **Beautiful Settings GUI** - Easy-to-use interface for all settings
- 📡 **Real-time Flight Data** - Uses OpenSky Network API (free, no API key needed)
- 🖥️ **TV-Ready** - Display on any TV with a web browser
- 🐳 **Docker-Based** - Easy deployment with Docker
- 💾 **Persistent Settings** - Your preferences are saved in browser storage
- 🎯 **Configurable Radius** - Choose how wide an area to monitor (5-100km)
- ⚡ **Performance Options** - Adjust update intervals and max aircraft count

## 🚀 Quick Start

### Option 1: Docker (Recommended)

1. **Clone or download this repository**

2. **Build and run with Docker Compose:**

```bash
docker-compose up -d
```

3. **Access the visualization:**

Open your browser to `http://localhost:3000`

4. **Display on TV:**
   - Open your TV's web browser
   - Navigate to `http://[your-computer-ip]:3000`
   - Press F11 or enable full-screen mode

### Option 2: Manual Setup

1. **Install Node.js** (v18 or higher)

2. **Install dependencies:**

```bash
cd server
npm install
```

3. **Start the server:**

```bash
npm start
```

4. **Open in browser:**

Navigate to `http://localhost:3000`

## ⚙️ Configuration

### First Time Setup

1. Click the **⚙️ Settings** button (top right)
2. Configure your location:
   - Enter location name
   - Enter latitude/longitude (you can get this from Google Maps)
   - Or use the defaults (Summer Hill, NSW, Australia)
3. Choose your preferred visualization mode
4. Adjust search radius (default: 30km)
5. Click **Save Settings**

### Settings Options

| Setting | Description | Default |
|---------|-------------|---------|
| Location Name | Descriptive name for your location | Summer Hill, NSW |
| Latitude | Your latitude coordinate | -33.8914 |
| Longitude | Your longitude coordinate | 151.1382 |
| Search Radius | How wide to search for aircraft (km) | 30 km |
| Visualization Mode | Ripple, Reality, Birds, or Constellation | Ripple |
| Show Flight Info | Display flight information overlay | On |
| Show Labels | Show aircraft labels (Reality mode) | On |
| Show Paths | Show flight paths/trails | On |
| Update Interval | How often to fetch new data (seconds) | 10s |
| Max Flights | Maximum aircraft to display | 50 |

### Keyboard Shortcuts

- **I** - Toggle flight information overlay
- **ESC** - Close settings panel

## 🖥️ TV Display Setup

### Smart TV Browser Method

1. **Start the server** on your computer:
   ```bash
   docker-compose up -d
   ```

2. **Find your computer's IP address:**
   - Windows: `ipconfig`
   - Mac/Linux: `ifconfig`
   - Look for your local IP (usually 192.168.x.x)

3. **On your TV:**
   - Open the web browser app
   - Navigate to `http://[your-ip]:3000`
   - Enable full-screen mode

4. **Recommended TV settings:**
   - Disable sleep/screensaver
   - Set to maximum brightness
   - Enable "game mode" or "PC mode" for reduced latency

### Raspberry Pi Method (Alternative)

1. **Install on Raspberry Pi:**
   ```bash
   git clone [your-repo]
   cd theARTofFLIGHT
   docker-compose up -d
   ```

2. **Auto-start on boot:**
   Create a startup script to open Chromium in kiosk mode:
   ```bash
   chromium-browser --kiosk --app=http://localhost:3000
   ```

3. **Connect Pi to TV via HDMI**

## 🌐 Flight Data Source

This app uses the **OpenSky Network API**, a free, community-driven flight tracking service. No API key required!

- **Coverage:** Global
- **Update Rate:** ~10 seconds
- **Data Points:** Position, altitude, speed, heading, callsign, country
- **Limitations:** Subject to API rate limits (be nice to the free service!)

### Data Privacy

- All flight data is publicly available ADS-B information
- No personal data is collected or stored
- Your location settings are stored only in your browser's localStorage

## 🛠️ Development

### Project Structure

```
theARTofFLIGHT/
├── server/
│   ├── server.js              # Express server
│   ├── flightDataService.js   # Flight data API integration
│   └── package.json
├── public/
│   ├── index.html             # Main app page
│   ├── css/
│   │   └── style.css          # Styles
│   └── js/
│       ├── app.js             # Main application controller
│       ├── flightManager.js   # Flight data management
│       ├── settings.js        # Settings UI and persistence
│       └── visualizations/
│           ├── ripple.js      # Ripple visualization
│           ├── reality.js     # Reality visualization
│           ├── birds.js       # Birds visualization
│           └── constellation.js # Constellation visualization
├── Dockerfile
├── docker-compose.yml
└── README.md
```

### Adding New Visualization Modes

1. Create a new file in `public/js/visualizations/yourmode.js`
2. Implement the visualization class with these methods:
   - `constructor(canvas, ctx)`
   - `update(flights)` - Update visualization state
   - `draw()` - Render to canvas
   - `clear()` - Clean up
3. Add your mode to `public/js/app.js` in the `visualizations` object
4. Add a button in `index.html` settings panel

### API Endpoints

- `GET /api/flights?lat={lat}&lon={lon}&radius={radius}` - Get flights in area
- `GET /api/health` - Health check

## 🐛 Troubleshooting

### No flights appearing

- Check your location settings are correct
- Increase search radius
- Verify your internet connection
- Some areas have less air traffic than others
- OpenSky Network API might be experiencing rate limits

### Performance issues

- Reduce "Max Flights to Display" setting
- Increase "Update Interval"
- Try a simpler visualization mode (Ripple is the lightest)
- Close other browser tabs/applications

### TV browser not working

- Ensure your TV and computer are on the same network
- Try disabling your computer's firewall temporarily
- Use your computer's IP address, not "localhost"
- Some TV browsers have limited HTML5 support - try Reality or Ripple modes

## 📝 TODO / Future Ideas

- [ ] Geographic map projection for accurate positioning
- [ ] More visualization modes (heat map, vector field, sound waves)
- [ ] Flight route information and destination tracking
- [ ] Historical flight path replay
- [ ] Multi-location support (airports, flight corridors)
- [ ] Custom color schemes and themes
- [ ] Export/import settings
- [ ] Mobile app version
- [ ] AR mode for tablets/phones

## 🙏 Credits

- Flight data provided by [OpenSky Network](https://opensky-network.org/)
- Inspired by the beauty of aviation and data visualization

## 📄 License

MIT License - Feel free to use this for personal or commercial installations!

## 🤝 Contributing

Contributions are welcome! Feel free to:

- Report bugs
- Suggest new visualization modes
- Improve performance
- Add new features
- Improve documentation

## 💡 Tips for Best Results

1. **Location Matters** - Living near an airport or flight corridor? You'll see more action!
2. **Time of Day** - Peak flight times are typically morning and evening
3. **Radius Sweet Spot** - 20-40km balances quantity and relevance
4. **Mode Selection** - Ripple is calming, Reality is informative, Birds is playful, Constellation is mesmerizing
5. **TV Placement** - Mount in a living room, office, or public space for maximum impact

---

Made with ✈️ and ❤️

**theARTofFLIGHT** - Where aviation meets art
