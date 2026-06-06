# 🚀 Quick Start Guide

## ✨ Your App is Running NOW!

The server is currently running at: **http://localhost:3000**

### 🖥️ View on Your Computer

Open your browser and go to:
```
http://localhost:3000
```

### 📺 Display on TV

1. **Get your computer's IP address** (you can use one of these):
   - `192.168.1.116` (Ethernet)
   - `10.163.32.195` (WiFi)

2. **On your TV browser**, navigate to:
   ```
   http://192.168.1.116:3000
   ```
   OR
   ```
   http://10.163.32.195:3000
   ```

3. **Enable full-screen mode** (usually F11 key or browser menu)

## 🎨 First Time Setup

1. Click the **⚙️ gear icon** in the top-right corner
2. Configure your location:
   - Location name: (e.g., "Summer Hill, NSW")
   - Latitude: `-33.8914` (default for Summer Hill)
   - Longitude: `151.1382` (default for Summer Hill)
3. Choose your visualization mode:
   - 💧 **Ripple** - Calming water ripples
   - ✈️ **Reality** - Actual aircraft with flight data
   - 🕊️ **Birds** - Organic, nature-inspired
   - ✨ **Constellation** - Mesmerizing stars
4. Click **Save Settings**

## ⌨️ Keyboard Shortcuts

- **I** - Toggle flight information overlay
- **ESC** - Close settings panel

## 🔄 Restart the Server

If you need to restart:

### Windows:
```bash
start.bat
```

### Mac/Linux:
```bash
bash start.sh
```

### Using Docker:
```bash
docker-compose up -d
```

## 🛑 Stop the Server

### Kill current process:
```bash
# Find the process
ps aux | grep "node server.js"

# Kill it
kill [PID]
```

### If using Docker:
```bash
docker-compose down
```

## 📊 Current Status

✅ Server is running on port 3000
✅ Flight data API is working
✅ Currently tracking **45 aircraft** in the Sydney area
✅ All 4 visualization modes ready

## 🎯 What's Working Right Now

- Real-time flight data from OpenSky Network
- Multiple visualization modes (Ripple, Reality, Birds, Constellation)
- Configurable location and radius
- Beautiful settings interface
- Flight information overlay
- Persistent settings in browser

## 🐛 Troubleshooting

**No flights showing?**
- Check your location coordinates
- Increase the search radius in settings
- Wait a few moments for data to load

**Can't access from TV?**
- Make sure TV and computer are on same WiFi network
- Try the other IP address listed above
- Check your firewall settings

**Performance issues?**
- Reduce "Max Flights to Display"
- Try Ripple mode (lightest)
- Increase "Update Interval" to 15-20 seconds

## 🎨 Tips for Best Display

1. Use **Constellation mode** for a calming, ambient display
2. Use **Reality mode** to actually learn about flights overhead
3. Use **Birds mode** for something organic and playful
4. Use **Ripple mode** for minimalist, zen-like art

Enjoy your flight art installation! ✈️✨
