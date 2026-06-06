# 🚀 Quick Start Guide

## Start the server

### Windows
```batch
start.bat
```

### Mac/Linux
```bash
bash start.sh
```

### Docker
```bash
docker-compose up -d
```

Then open **http://localhost:3000** — no API keys needed.

## 📺 Display on TV

1. **Get your computer's IP address**:
   - Windows: run `ipconfig` — look for an address like `192.168.x.x`
   - Mac/Linux: run `ifconfig` (or `ip addr`)

2. **On your TV browser**, navigate to:
   ```
   http://<your-computer-ip>:3000
   ```

3. **Press F** (or F11) for full-screen mode

## 🎨 First Time Setup

1. Click the **⚙️ gear icon** (top right)
2. On the **Global** tab, set your location:
   - Location name (e.g. "Sydney Opera House")
   - Latitude / longitude (defaults: -33.8568, 151.2153)
3. Pick a mode from the bottom bar — each has its own settings tab:
   Ripple · Reality · Grid · Waves · Tubes · Map · Patterns · Contrails ·
   Radar · Board
4. Click **Save Settings**

## ⌨️ Keyboard Shortcuts

- **I** — toggle flight information overlay
- **F** — toggle fullscreen
- **ESC** — close settings panel

## 🛑 Stop the Server

- `Ctrl+C` in the terminal running it, or
- `docker-compose down` if using Docker

## 🐛 Troubleshooting

**No flights showing?**
- Check your location coordinates
- Increase the search radius in settings
- Quiet airspace is normal at night — the display shows
  "LISTENING FOR AIRCRAFT" if the data feed itself is down

**Can't access from TV?**
- TV and computer must be on the same network
- Use the computer's IP, not `localhost`
- Check your firewall allows port 3000

**Performance issues?**
- Reduce "Max Flights"
- Increase "Update Interval"

Enjoy your flight art installation! ✈️✨
