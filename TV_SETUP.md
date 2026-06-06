# 📺 TV Display Setup Guide

## 🎯 Quick Setup (3 Steps)

### Step 1: Run the server
Start it on a computer (or Raspberry Pi) that stays on — `start.bat`,
`start.sh`, or `docker-compose up -d`.

### Step 2: Open it on the TV
Find the computer's IP (`ipconfig` on Windows, `ifconfig` on Mac/Linux),
then on the TV's browser:

```
http://<your-computer-ip>:3000
```

### Step 3: Go full screen
Press **F** (the app's fullscreen shortcut) or F11 / the browser's
full-screen menu.

---

## 🎨 Recommended Settings for TV Display

Click **⚙️** (top right):

1. **Location** — set your actual coordinates for accurate overhead flights
2. **Radius** — 25–40 km (bigger = more planes)
3. **Mode** — by room:
   - Living room ambience → **Ripple**, **Contrails**, or **Waves**
   - All-day generative art → **Patterns** (accumulates until midnight)
   - Conversation piece → **Radar** or **Board**
   - Educational → **Reality** or **Map**
4. **Update Interval** — 10–20 s for a remote display
5. **Max Flights** — 30–50
6. **Information Panel** — OFF for a clean display (press **I** to toggle).
   If the data feed drops, a quiet "LISTENING FOR AIRCRAFT" overlay appears
   on its own and disappears on recovery.

### TV-Specific Tips

- ✅ Disable TV sleep mode and screensaver
- ✅ Enable "PC/Game Mode" (reduces input lag)
- ✅ Disable motion smoothing (better for canvas animation)
- ✅ The UI chrome and mouse cursor auto-hide after 3 seconds idle

---

## 🔧 Troubleshooting

**Can't connect from the TV**
1. TV and computer must be on the **same network**
2. Use the computer's IP, not `localhost`
3. Allow port 3000 through the computer's firewall
4. Verify the server is up: open `http://localhost:3000` on the computer

**Slow performance**
1. Reduce "Max Flights" to 20–30
2. Increase "Update Interval"
3. Waves mode is the heaviest; Ripple/Board are light

**No flights appearing**
1. Check location settings
2. Increase radius to 50 km
3. Quiet hours (late night) genuinely have fewer flights
4. If the data sources are down you'll see the signal-lost overlay —
   it recovers automatically

---

## 📱 Dedicated Device: Raspberry Pi

1. Install and run:
   ```bash
   git clone https://github.com/papajbeautiful/art-of-flight.git
   cd theARTofFLIGHT
   docker-compose up -d
   ```
2. Auto-start Chromium in kiosk mode — add to
   `/etc/xdg/lxsession/LXDE-pi/autostart`:
   ```
   @chromium-browser --kiosk --app=http://localhost:3000
   ```
3. Connect the Pi to the TV via HDMI

---

## 🔄 Keeping It Running 24/7

- **Docker** restarts automatically (`restart: unless-stopped` is configured)
- **Windows auto-start**: put a shortcut to `start.bat` in `shell:startup`
- The app itself rides out data outages: server keeps the last good data,
  the client backs off and retries, and the overlay tells you what's
  happening — no manual intervention needed

---

Enjoy your flight art installation! ✈️✨
