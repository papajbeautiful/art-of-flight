# 📺 TV Display Setup Guide

## 🎯 Quick Setup (3 Steps)

### Step 1: Keep the Server Running
The server is already running on your computer. Keep it running while displaying on TV.

### Step 2: Get the URL
On your TV's web browser, navigate to either:

```
http://192.168.1.116:3000
```
OR
```
http://10.163.32.195:3000
```

### Step 3: Go Full Screen
- Press F11 on most TV browsers
- Or find "Full Screen" in the browser menu
- Some TVs have a dedicated full-screen button

---

## 🎨 Recommended Settings for TV Display

### Initial Setup (Click ⚙️ in top right):

1. **Location**: Set to your actual location for accurate overhead flights
   - Default: Summer Hill, NSW, Australia (-33.8914, 151.1382)
   - Change to your coordinates if elsewhere

2. **Radius**: 25-40 km
   - Bigger radius = more planes
   - Smaller radius = only directly overhead

3. **Visualization Mode**: Choose based on your preference
   - **Ripple** → Calming ambient art
   - **Constellation** → Mesmerizing star field
   - **Birds** → Playful, organic
   - **Reality** → Educational, informative

4. **Update Interval**: 15-20 seconds
   - Saves bandwidth
   - Still plenty responsive

5. **Max Flights**: 30-50
   - Good balance of activity and performance

6. **Show Flight Info**: Turn OFF for cleaner display
   - Press "I" key anytime to toggle back on

### TV-Specific Tips:

✅ **Disable TV sleep mode** - Keep display always on
✅ **Disable screensaver** - No interruptions
✅ **Set brightness** - Adjust to room lighting
✅ **Enable "PC/Game Mode"** - Reduces input lag
✅ **Disable motion smoothing** - Better for canvas animations

---

## 🖥️ Supported TV Browsers

### ✅ Tested & Working:
- Samsung Smart TV Browser
- LG webOS Browser
- Android TV (Chrome)
- Fire TV Silk Browser
- Apple TV (with third-party browser)

### ⚠️ May Need Tweaking:
- Older Smart TV browsers (2015 and earlier)
- Some budget TV browsers with limited HTML5 support

If your TV browser doesn't work well, use a **Chromecast, Roku, or Fire Stick** instead!

---

## 🔧 Troubleshooting TV Display

### Problem: Can't Connect to Server

**Solution:**
1. Make sure TV and computer are on the **same WiFi network**
2. Check your computer's firewall settings
3. Try the alternative IP address
4. Verify server is still running: `http://localhost:3000` on computer

### Problem: Slow Performance

**Solution:**
1. Reduce "Max Flights" to 20-30
2. Increase "Update Interval" to 20-30 seconds
3. Switch to Ripple mode (lightest)
4. Close other apps on TV

### Problem: Display Looks Weird

**Solution:**
1. Try different visualization modes
2. Ensure full-screen mode is enabled
3. Clear TV browser cache
4. Disable TV's motion smoothing/interpolation

### Problem: No Flights Appearing

**Solution:**
1. Check location settings are correct
2. Increase search radius to 50km
3. Wait 15-30 seconds for initial data load
4. Some times of day have less air traffic

---

## 🌟 Best Practices

### For Living Room Display:
- **Mode**: Constellation or Ripple
- **Info**: OFF (clean aesthetic)
- **Radius**: 30km
- **Update**: 15 seconds

### For Office/Educational:
- **Mode**: Reality
- **Info**: ON (shows flight details)
- **Radius**: 40km
- **Update**: 10 seconds
- **Show Labels**: ON

### For Bedroom/Meditation:
- **Mode**: Ripple or Birds
- **Info**: OFF
- **Radius**: 20km (less activity)
- **Update**: 20 seconds

### For Waiting Room/Public:
- **Mode**: Constellation or Reality
- **Info**: ON (people like reading flight info)
- **Radius**: 35km
- **Update**: 10 seconds

---

## 📱 Alternative: Raspberry Pi Setup

If you want a dedicated device instead of your computer:

1. **Install on Raspberry Pi 4**
   ```bash
   git clone <your-repo>
   cd theARTofFLIGHT
   docker-compose up -d
   ```

2. **Auto-start Chromium in kiosk mode**
   Add to `/etc/xdg/lxsession/LXDE-pi/autostart`:
   ```
   @chromium-browser --kiosk --app=http://localhost:3000
   ```

3. **Connect Pi to TV via HDMI**

4. **Benefits**:
   - No computer needed
   - Low power consumption
   - Silent operation
   - Dedicated display

---

## 🎨 Pro Tips

1. **Time of Day**: Most flights are during business hours (6am-10pm)
2. **Near Airports**: Living near an airport = lots of activity!
3. **Flight Paths**: You'll notice patterns - regular routes repeated daily
4. **Weather**: Flight patterns change with weather conditions
5. **Zoom Level**: Play with radius to find your sweet spot
6. **Mode Switching**: Different modes for different times of day

---

## 🔄 Keeping It Running 24/7

### On Windows:
```batch
# Use the start.bat script
# Or with Docker for auto-restart:
docker-compose up -d --restart unless-stopped
```

### On Mac/Linux:
```bash
# Use the start.sh script
# Or with Docker:
docker-compose up -d
```

### Auto-start on Boot (Windows):
1. Create shortcut to `start.bat`
2. Press `Win+R`, type `shell:startup`
3. Copy shortcut to Startup folder

---

## 📊 What You'll See

Real-time data including:
- ✈️ Aircraft positions updating every 10 seconds
- 📍 Actual overhead flights in your area
- 🎨 Beautiful artistic visualizations
- 📊 Flight data (altitude, speed, heading)
- 🌍 Country of origin
- 🏢 Airline information (Qantas, Virgin, etc.)

---

## 💡 Remember

- Press **I** to toggle info overlay on/off
- Press **ESC** to close settings panel
- Click **⚙️** anytime to adjust settings
- Settings are saved in browser - won't reset

---

Enjoy your flight art installation! ✈️✨

**Your digital sky is alive!**
