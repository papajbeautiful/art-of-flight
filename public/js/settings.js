/**
 * Settings Manager: Tabbed UI with per-mode settings
 */
class SettingsManager {
  constructor() {
    this.settings = this.loadSettings();
    this.callbacks = [];
    this.currentTab = this.settings.mode || 'ripple';

    this.modeLabels = {
      ripple: 'Ripple', reality: 'Reality', birds: 'Grid',
      constellation: 'Waves', tubes: 'Tubes', map: 'Map', patterns: 'Patterns'
    };

    this.initUI();
    this.initCustomCursor();
  }

  getDefaults() {
    return {
      locationName: 'Summer Hill, NSW, Australia',
      latitude: -33.8914,
      longitude: 151.1382,
      radius: 30,
      mode: 'ripple',
      showInfoPanel: true,
      googleMapsApiKey: '',
      updateInterval: 2,
      maxFlights: 50,
      // UI styling
      panelBgColor: '#080a10',
      panelBgOpacity: 0.92,
      headerFont: 'Space Mono',
      bodyFont: 'Work Sans',

      // Per-mode settings
      modeSettings: {
        ripple: {
          backgroundImage: '',
          uiAccentColor: '#00F0FF',
          showHomeMarker: false,
          homeMarkerColor: '#FF0055',
          homeMarkerIcon: 'crosshair',
          displacementScale: 5,
          metalness: 0.75,
          roughness: 0.25,
          inboundLabelFormat: '{airline} {type} from {origin}',
          outboundLabelFormat: '{airline} {type} to {destination}',
          showTrails: false,
          showCallsigns: false,
          showAltitude: false,
          showSpeed: false,
          showRoute: false,
          showCoordinates: false,
          showAirborneAircraft: true,
          showGroundAircraft: false,
          aircraftIcon: 'glow',
          trailLength: 100,
          aircraftScale: 1.0,
          labelTextScale: 1.0,
          labelBgOpacity: 0.7,
          labelBgColor: '#000000',
          accentColor: '#00F0FF',
          inboundColor: '',
          outboundColor: '',
          dotSize: 8,
          focusDuration: 3000,
          trackingSpeed: 0.25,
          trackAllAircraft: false
        },
        reality: {
          backgroundImage: '',
          uiAccentColor: '#4CAF50',
          showHomeMarker: false,
          homeMarkerColor: '#FF0055',
          homeMarkerIcon: 'crosshair',
          inboundLabelFormat: '{airline} {type} from {origin}',
          outboundLabelFormat: '{airline} {type} to {destination}',
          showTrails: true,
          showCallsigns: true,
          showAltitude: true,
          showSpeed: true,
          showRoute: true,
          showCoordinates: false,
          showAirborneAircraft: true,
          showGroundAircraft: false,
          aircraftIcon: 'chevron',
          trailLength: 100,
          aircraftScale: 1.0,
          labelTextScale: 1.0,
          labelBgOpacity: 0.7,
          labelBgColor: '#000000',
          accentColor: '#4CAF50',
          inboundColor: '',
          outboundColor: ''
        },
        birds: {
          backgroundImage: '',
          uiAccentColor: '#00FF88',
          showHomeMarker: false,
          homeMarkerColor: '#FF0055',
          homeMarkerIcon: 'crosshair',
          squareSize: 60,
          glowColor: '#00FF88',
          fadeDelay: 5000,
          fadeSpeed: 0.02,
          inboundLabelFormat: '{airline} {type} from {origin}',
          outboundLabelFormat: '{airline} {type} to {destination}',
          showTrails: false,
          showCallsigns: false,
          showAltitude: false,
          showSpeed: false,
          showRoute: false,
          showCoordinates: false,
          showAirborneAircraft: true,
          showGroundAircraft: false,
          aircraftIcon: 'glow',
          trailLength: 100,
          aircraftScale: 1.0,
          labelTextScale: 1.0,
          labelBgOpacity: 0.7,
          labelBgColor: '#000000',
          accentColor: '#00FF88',
          inboundColor: '',
          outboundColor: '',
          dotSize: 8
        },
        constellation: {
          backgroundImage: '',
          uiAccentColor: '#FFFFFF',
          showHomeMarker: false,
          homeMarkerColor: '#FF0055',
          homeMarkerIcon: 'crosshair',
          lineCount: 200,
          lineColor: '#FFFFFF',
          lineWidth: 0.5,
          distortRadius: 120,
          distortStrength: 15,
          springBack: 0.05,
          inboundLabelFormat: '{airline} {type} from {origin}',
          outboundLabelFormat: '{airline} {type} to {destination}',
          showTrails: false,
          showCallsigns: false,
          showAltitude: false,
          showSpeed: false,
          showRoute: false,
          showCoordinates: false,
          showAirborneAircraft: true,
          showGroundAircraft: false,
          aircraftIcon: 'glow',
          trailLength: 100,
          aircraftScale: 1.0,
          labelTextScale: 1.0,
          labelBgOpacity: 0.7,
          labelBgColor: '#000000',
          accentColor: '#FFFFFF',
          inboundColor: '',
          outboundColor: '',
          dotSize: 8
        },
        tubes: {
          backgroundImage: '',
          uiAccentColor: '#F967FB',
          showHomeMarker: false,
          homeMarkerColor: '#FF0055',
          homeMarkerIcon: 'crosshair',
          tubeColor1: '#f967fb',
          tubeColor2: '#53bc28',
          tubeColor3: '#6958d5',
          lightColor1: '#83f36e',
          lightColor2: '#fe8a2e',
          lightColor3: '#ff008a',
          lightColor4: '#60aed5',
          lightIntensity: 200,
          inboundLabelFormat: '{airline} {type} from {origin}',
          outboundLabelFormat: '{airline} {type} to {destination}',
          showTrails: false,
          showCallsigns: false,
          showAltitude: false,
          showSpeed: false,
          showRoute: false,
          showCoordinates: false,
          showAirborneAircraft: true,
          showGroundAircraft: false,
          aircraftIcon: 'glow',
          trailLength: 100,
          aircraftScale: 1.0,
          labelTextScale: 1.0,
          labelBgOpacity: 0.7,
          labelBgColor: '#000000',
          accentColor: '#F967FB',
          inboundColor: '',
          outboundColor: '',
          dotSize: 8,
          focusDuration: 3000,
          trackingSpeed: 0.03,
          trackAllAircraft: false
        },
        map: {
          mapStyle: 'assassins_creed',
          customMapStyle: '',
          uiAccentColor: '#00F0FF',
          showHomeMarker: false,
          homeMarkerColor: '#FF0055',
          homeMarkerIcon: 'crosshair',
          inboundLabelFormat: '{airline} {type} from {origin}',
          outboundLabelFormat: '{airline} {type} to {destination}',
          showTrails: true,
          showCallsigns: true,
          showAltitude: true,
          showSpeed: true,
          showRoute: true,
          showCoordinates: false,
          showAirborneAircraft: true,
          showGroundAircraft: false,
          aircraftIcon: 'chevron',
          trailLength: 100,
          aircraftScale: 1.0,
          labelTextScale: 1.0,
          labelBgOpacity: 0.7,
          labelBgColor: '#000000',
          accentColor: '#00F0FF',
          inboundColor: '',
          outboundColor: '',
          googleMapsApiKey: ''
        },
        patterns: {
          backgroundImage: '',
          uiAccentColor: '#00F0FF',
          showHomeMarker: false,
          homeMarkerColor: '#FF0055',
          homeMarkerIcon: 'crosshair',
          showGroundAircraft: false,
          lineOpacity: 1.0,
          lineWidth: 1.0,
          haloWidth: 1.0,
          inboundColor: 'time',
          outboundColor: 'time',
          showLeadingDot: true,
          dotSize: 2.5,
          showStats: true
        }
      }
    };
  }

  loadSettings() {
    const stored = localStorage.getItem('theARTofFLIGHT_settings');
    const defaults = this.getDefaults();

    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        const merged = { ...defaults, ...parsed };
        if (parsed.modeSettings) {
          merged.modeSettings = { ...defaults.modeSettings };
          for (const mode of Object.keys(defaults.modeSettings)) {
            merged.modeSettings[mode] = {
              ...defaults.modeSettings[mode],
              ...(parsed.modeSettings[mode] || {})
            };
          }
        }
        this.migrateOldSettings(merged, parsed);
        return merged;
      } catch (e) {
        console.error('Failed to parse stored settings:', e);
        return defaults;
      }
    }

    return defaults;
  }

  migrateOldSettings(merged, parsed) {
    const displayKeys = ['showTrails', 'showCallsigns', 'showAltitude', 'showSpeed', 'showCoordinates'];

    displayKeys.forEach(key => {
      if (parsed[key] !== undefined && !parsed.modeSettings) {
        if (merged.modeSettings.reality[key] !== undefined) merged.modeSettings.reality[key] = parsed[key];
        if (merged.modeSettings.map[key] !== undefined) merged.modeSettings.map[key] = parsed[key];
      }
    });

    if (parsed.mapStyle !== undefined && !parsed.modeSettings) {
      merged.modeSettings.map.mapStyle = parsed.mapStyle;
    }

    if (parsed.backgroundImage && typeof parsed.backgroundImage === 'string') {
      const bgModes = ['ripple', 'reality', 'birds', 'constellation', 'tubes', 'patterns'];
      bgModes.forEach(mode => {
        if (!merged.modeSettings[mode].backgroundImage) {
          merged.modeSettings[mode].backgroundImage = parsed.backgroundImage;
        }
      });
    }

    // Migrate showAircraftDots -> aircraftIcon + showAirborneAircraft
    for (const mode of Object.keys(merged.modeSettings)) {
      const ms = merged.modeSettings[mode];
      if (ms.showAircraftDots !== undefined && ms.aircraftIcon === undefined) {
        ms.aircraftIcon = ms.showAircraftDots ? 'glow' : 'chevron';
        ms.showAirborneAircraft = true;
        delete ms.showAircraftDots;
      }
    }
  }

  saveSettings() {
    localStorage.setItem('theARTofFLIGHT_settings', JSON.stringify(this.settings));
    this.notifyChange();
  }

  resetSettings() {
    this.settings = this.getDefaults();
    this.saveSettings();
    this.updateUI();
    this.switchTab(this.currentTab);
  }

  get(key) { return this.settings[key]; }
  set(key, value) { this.settings[key] = value; }

  getModeSetting(mode, key) {
    return this.settings.modeSettings[mode]?.[key];
  }

  setModeSetting(mode, key, value) {
    if (!this.settings.modeSettings[mode]) this.settings.modeSettings[mode] = {};
    this.settings.modeSettings[mode][key] = value;
  }

  onChange(callback) { this.callbacks.push(callback); }
  notifyChange() { this.callbacks.forEach(cb => cb(this.settings)); }

  initCustomCursor() {
    const cursor = document.getElementById('customCursor');
    document.addEventListener('mousemove', (e) => {
      cursor.style.left = e.clientX + 'px';
      cursor.style.top = e.clientY + 'px';
    });
    document.addEventListener('mousedown', () => cursor.classList.add('active'));
    document.addEventListener('mouseup', () => cursor.classList.remove('active'));
  }

  initUI() {
    const settingsBtn = document.getElementById('settingsBtn');
    const settingsPanel = document.getElementById('settingsPanel');
    const closeSettings = document.getElementById('closeSettings');

    settingsBtn.addEventListener('click', () => settingsPanel.classList.add('visible'));
    closeSettings.addEventListener('click', () => settingsPanel.classList.remove('visible'));
    settingsPanel.addEventListener('click', (e) => {
      if (e.target === settingsPanel) settingsPanel.classList.remove('visible');
    });

    // Bottom mode selector
    this.initModeButtons('.mode-btn');

    // Save button
    document.getElementById('saveSettings').addEventListener('click', () => {
      this.saveSettings();
      settingsPanel.classList.remove('visible');
      const btn = document.getElementById('saveSettings');
      const orig = btn.innerHTML;
      btn.innerHTML = '<span>Saved</span>';
      setTimeout(() => { btn.innerHTML = orig; }, 2000);
    });

    // Reset button
    document.getElementById('resetSettings').addEventListener('click', () => {
      if (confirm('Reset all settings to defaults?')) this.resetSettings();
    });

    // Keyboard
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') settingsPanel.classList.remove('visible');
    });

    // Build tabs & render initial
    this.buildTabs();
    this.switchTab(this.currentTab);
    this.updateUI();
    this.applyUIStyles();
  }

  initModeButtons(selector) {
    document.querySelectorAll(selector).forEach(btn => {
      btn.addEventListener('click', () => {
        const mode = btn.getAttribute('data-mode');
        document.querySelectorAll('.mode-btn').forEach(b => {
          b.classList.toggle('active', b.getAttribute('data-mode') === mode);
        });
        this.set('mode', mode);
        // Switch to mode tab in settings panel
        this.switchTab(mode);
        this.notifyChange();
      });
    });
  }

  buildTabs() {
    const container = document.getElementById('settingsTabs');
    if (!container) return;

    const tabs = [
      { id: 'global', label: 'Global' },
      { id: 'ripple', label: 'Ripple' },
      { id: 'reality', label: 'Reality' },
      { id: 'birds', label: 'Grid' },
      { id: 'constellation', label: 'Waves' },
      { id: 'tubes', label: 'Tubes' },
      { id: 'map', label: 'Map' },
      { id: 'patterns', label: 'Patterns' },
      { id: 'about', label: 'About' }
    ];

    let html = '';
    tabs.forEach(tab => {
      const active = tab.id === this.currentTab ? ' active' : '';
      const isCurrent = tab.id === this.settings.mode ? ' current-mode' : '';
      html += `<button class="tab-btn${active}${isCurrent}" data-tab="${tab.id}">${tab.label}</button>`;
    });
    container.innerHTML = html;

    container.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const tabId = btn.dataset.tab;
        // If clicking a mode tab, also switch the active visualization
        if (this.settings.modeSettings[tabId] !== undefined) {
          this.set('mode', tabId);
          // Update bottom bar
          document.querySelectorAll('.mode-btn').forEach(b => {
            b.classList.toggle('active', b.getAttribute('data-mode') === tabId);
          });
          // Update current-mode indicator on tabs
          container.querySelectorAll('.tab-btn').forEach(t => {
            t.classList.toggle('current-mode', t.dataset.tab === tabId);
          });
          this.notifyChange();
        }
        this.switchTab(tabId);
      });
    });
  }

  switchTab(tabId) {
    this.currentTab = tabId;

    // Update tab button states
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tab === tabId);
    });

    // Render content
    const container = document.getElementById('settingsTabContent');
    if (!container) return;

    container.classList.remove('loaded');

    let html = '';
    if (tabId === 'global') html = this.renderGlobalTab();
    else if (tabId === 'about') html = this.renderAboutTab();
    else html = this.renderModeTab(tabId);

    container.innerHTML = html;

    // Wire events
    this.wireUpTabContent(container, tabId);

    // Trigger animation
    requestAnimationFrame(() => container.classList.add('loaded'));
  }

  // ─── Global Tab ─────────────────────────────────────────

  renderGlobalTab() {
    const s = this.settings;
    const fonts = {
      header: ['Space Mono', 'JetBrains Mono', 'Fira Code', 'IBM Plex Mono', 'Source Code Pro', 'Roboto Mono'],
      body: ['Work Sans', 'Outfit', 'Plus Jakarta Sans', 'DM Sans', 'Manrope', 'Nunito Sans']
    };

    return `
      <div class="tab-columns">
        <div class="tab-column">
          <h4>Location</h4>
          <div class="input-group">
            <label>Location Name</label>
            <input type="text" data-global-key="locationName" value="${s.locationName}" placeholder="City, Country">
          </div>
          <div class="input-row">
            <div class="input-group">
              <label>Latitude</label>
              <input type="number" data-global-key="latitude" step="0.0001" value="${s.latitude}">
            </div>
            <div class="input-group">
              <label>Longitude</label>
              <input type="number" data-global-key="longitude" step="0.0001" value="${s.longitude}">
            </div>
          </div>
          <div class="input-group">
            <label>Radius <span class="slider-value" data-value-for="radius">${s.radius}</span><span class="slider-unit">km</span></label>
            <input type="range" data-global-key="radius" min="5" max="100" step="5" value="${s.radius}">
          </div>

          <h4>Performance</h4>
          <div class="input-group">
            <label>Update Interval <span class="slider-value" data-value-for="updateInterval">${s.updateInterval}</span><span class="slider-unit">s</span></label>
            <input type="range" data-global-key="updateInterval" min="1" max="30" step="1" value="${s.updateInterval}">
          </div>
          <div class="input-group">
            <label>Max Flights <span class="slider-value" data-value-for="maxFlights">${s.maxFlights}</span></label>
            <input type="range" data-global-key="maxFlights" min="10" max="200" step="10" value="${s.maxFlights}">
          </div>
        </div>

        <div class="tab-column">
          <h4>Display</h4>
          <div class="checkbox-group">
            <label class="toggle-label">
              <input type="checkbox" data-global-key="showInfoPanel" ${s.showInfoPanel ? 'checked' : ''}>
              <span class="toggle-check"></span>
              <span class="toggle-text">Information Panel</span>
            </label>
          </div>

          <h4>UI Styling</h4>
          <div class="input-group input-group-color">
            <label>Panel Background</label>
            <input type="color" data-global-key="panelBgColor" value="${s.panelBgColor || '#080a10'}">
          </div>
          <div class="input-group">
            <label>Panel Opacity <span class="slider-value" data-value-for="panelBgOpacity">${s.panelBgOpacity || 0.92}</span></label>
            <input type="range" data-global-key="panelBgOpacity" min="0.3" max="1.0" step="0.05" value="${s.panelBgOpacity || 0.92}">
          </div>
          <div class="input-group">
            <label>Header Font</label>
            <select data-global-key="headerFont">
              ${fonts.header.map(f => `<option value="${f}" ${(s.headerFont || 'Space Mono') === f ? 'selected' : ''}>${f}</option>`).join('')}
            </select>
          </div>
          <div class="input-group">
            <label>Body Font</label>
            <select data-global-key="bodyFont">
              ${fonts.body.map(f => `<option value="${f}" ${(s.bodyFont || 'Work Sans') === f ? 'selected' : ''}>${f}</option>`).join('')}
            </select>
          </div>
        </div>
      </div>
    `;
  }

  // ─── Mode Tab ───────────────────────────────────────────

  getModeSchemas() {
    // Common overlay fields (column 2)
    const overlayFields = (mode) => {
      const hasAircraftIcon = !['patterns'].includes(mode);
      const hasDotSize = ['ripple', 'birds', 'constellation', 'tubes'].includes(mode);
      const hasTrackAll = ['ripple', 'tubes'].includes(mode);

      const fields = [];

      if (hasAircraftIcon) {
        fields.push(
          { key: 'showAirborneAircraft', label: 'Airborne Aircraft', type: 'checkbox', col: 2 },
          { key: 'showGroundAircraft', label: 'Ground Aircraft', type: 'checkbox', col: 2 },
          { key: 'aircraftIcon', label: 'Aircraft Icon', type: 'aircrafticon', col: 2 }
        );
      } else {
        fields.push(
          { key: 'showGroundAircraft', label: 'Ground Aircraft', type: 'checkbox', col: 2 }
        );
      }

      if (hasTrackAll) {
        fields.push({ key: 'trackAllAircraft', label: 'Track All Aircraft', type: 'checkbox', col: 2,
          tooltip: 'Drive effect with all aircraft simultaneously instead of cycling through one at a time' });
      }

      if (hasAircraftIcon) {
        fields.push(
          { key: 'showTrails', label: 'Flight Trails', type: 'checkbox', col: 2 },
          { key: 'showCallsigns', label: 'Callsigns', type: 'checkbox', col: 2 },
          { key: 'showAltitude', label: 'Altitude', type: 'checkbox', col: 2 },
          { key: 'showSpeed', label: 'Speed', type: 'checkbox', col: 2 },
          { key: 'showRoute', label: 'Route Info', type: 'checkbox', col: 2 },
          { key: 'showCoordinates', label: 'Coordinates', type: 'checkbox', col: 2 },
          { key: 'inboundLabelFormat', label: 'Inbound Label', type: 'text', col: 2,
            placeholder: '{airline} {type} from {origin}',
            tooltip: '{airline} {type} {callsign} {origin} {destination}' },
          { key: 'outboundLabelFormat', label: 'Outbound Label', type: 'text', col: 2,
            placeholder: '{airline} {type} to {destination}' },
          { key: 'trailLength', label: 'Trail Length', type: 'range', min: 20, max: 300, step: 10, unit: '', col: 2 },
          { key: 'aircraftScale', label: 'Aircraft Scale', type: 'range', min: 0.5, max: 2.0, step: 0.1, unit: 'x', col: 2 },
          { key: 'labelTextScale', label: 'Label Scale', type: 'range', min: 0.5, max: 2.0, step: 0.1, unit: 'x', col: 2 },
          { key: 'labelBgOpacity', label: 'Label BG Opacity', type: 'range', min: 0, max: 1.0, step: 0.05, unit: '', col: 2 },
          { key: 'labelBgColor', label: 'Label BG Color', type: 'color', col: 2 }
        );
        if (hasDotSize) {
          fields.push({ key: 'dotSize', label: 'Dot Size', type: 'range', min: 2, max: 30, step: 1, unit: 'px', col: 2 });
        }
      }

      return fields;
    };

    // Common appearance fields (column 1)
    const colorFields = (mode) => {
      const fields = [
        { key: 'uiAccentColor', label: 'UI Accent', type: 'color', col: 1 },
        { key: 'accentColor', label: 'Default Aircraft', type: 'color', col: 1 },
        { key: 'inboundColor', label: 'Inbound Override', type: 'color', col: 1 },
        { key: 'outboundColor', label: 'Outbound Override', type: 'color', col: 1 }
      ];
      return fields;
    };

    const homeMarkerFields = () => [
      { key: 'showHomeMarker', label: 'Home Marker', type: 'checkbox', col: 1 },
      { key: 'homeMarkerColor', label: 'Marker Color', type: 'color', col: 1, showWhen: { key: 'showHomeMarker', value: true } },
      { key: 'homeMarkerIcon', label: 'Marker Icon', type: 'iconselect', col: 1, showWhen: { key: 'showHomeMarker', value: true } }
    ];

    const bgField = () => [
      { key: 'backgroundImage', label: 'Background Image', type: 'background', col: 1 }
    ];

    return {
      ripple: [
        // Col 1: Effect
        ...bgField(),
        { key: 'displacementScale', label: 'Displacement', type: 'range', min: 1, max: 15, step: 0.5, unit: '', col: 1 },
        { key: 'metalness', label: 'Metalness', type: 'range', min: 0, max: 1.0, step: 0.05, unit: '', col: 1 },
        { key: 'roughness', label: 'Roughness', type: 'range', min: 0, max: 1.0, step: 0.05, unit: '', col: 1 },
        { key: 'focusDuration', label: 'Focus Duration', type: 'range', min: 1000, max: 10000, step: 500, unit: 'ms', col: 1 },
        { key: 'trackingSpeed', label: 'Tracking Speed', type: 'range', min: 0.05, max: 0.5, step: 0.05, unit: '', col: 1 },
        ...homeMarkerFields(),
        ...colorFields('ripple'),
        // Col 2: Overlay
        ...overlayFields('ripple')
      ],
      reality: [
        ...bgField(),
        ...homeMarkerFields(),
        ...colorFields('reality'),
        ...overlayFields('reality')
      ],
      birds: [
        ...bgField(),
        { key: 'squareSize', label: 'Grid Size', type: 'range', min: 5, max: 150, step: 5, unit: 'px', col: 1 },
        { key: 'glowColor', label: 'Grid Glow', type: 'color', col: 1 },
        { key: 'fadeDelay', label: 'Fade Delay', type: 'range', min: 100, max: 60000, step: 500, unit: 'ms', col: 1 },
        { key: 'fadeSpeed', label: 'Fade Speed', type: 'range', min: 0.005, max: 0.1, step: 0.001, unit: '', col: 1 },
        ...homeMarkerFields(),
        ...colorFields('birds'),
        ...overlayFields('birds')
      ],
      constellation: [
        ...bgField(),
        { key: 'lineCount', label: 'Line Density', type: 'range', min: 20, max: 600, step: 10, unit: '', col: 1 },
        { key: 'lineColor', label: 'Line Color', type: 'color', col: 1 },
        { key: 'lineWidth', label: 'Line Width', type: 'range', min: 0.1, max: 3.0, step: 0.1, unit: 'px', col: 1 },
        { key: 'distortRadius', label: 'Distort Radius', type: 'range', min: 30, max: 300, step: 10, unit: 'px', col: 1 },
        { key: 'distortStrength', label: 'Distort Strength', type: 'range', min: 2, max: 30, step: 1, unit: '', col: 1 },
        { key: 'springBack', label: 'Spring Back', type: 'range', min: 0.01, max: 0.3, step: 0.01, unit: '', col: 1 },
        ...homeMarkerFields(),
        ...colorFields('constellation'),
        ...overlayFields('constellation')
      ],
      tubes: [
        ...bgField(),
        { key: 'tubeColor1', label: 'Tube 1', type: 'color', col: 1 },
        { key: 'tubeColor2', label: 'Tube 2', type: 'color', col: 1 },
        { key: 'tubeColor3', label: 'Tube 3', type: 'color', col: 1 },
        { key: 'lightColor1', label: 'Light 1', type: 'color', col: 1 },
        { key: 'lightColor2', label: 'Light 2', type: 'color', col: 1 },
        { key: 'lightColor3', label: 'Light 3', type: 'color', col: 1 },
        { key: 'lightColor4', label: 'Light 4', type: 'color', col: 1 },
        { key: 'lightIntensity', label: 'Light Intensity', type: 'range', min: 50, max: 500, step: 25, unit: '', col: 1 },
        { key: 'focusDuration', label: 'Focus Duration', type: 'range', min: 1000, max: 10000, step: 500, unit: 'ms', col: 1 },
        { key: 'trackingSpeed', label: 'Tracking Speed', type: 'range', min: 0.01, max: 0.3, step: 0.01, unit: '', col: 1 },
        ...homeMarkerFields(),
        ...colorFields('tubes'),
        ...overlayFields('tubes')
      ],
      map: [
        { key: 'mapStyle', label: 'Map Style', type: 'select', col: 1, options: [
          { value: 'assassins_creed', label: "Assassin's Creed IV" },
          { value: 'carmela', label: 'Carmela' },
          { value: '23_sul', label: '23 SUL' },
          { value: 'arch', label: 'Arch' },
          { value: 'vibrant_village', label: 'Vibrant Village' },
          { value: 'wy', label: 'WY' },
          { value: 'subtle_greyscale', label: 'Subtle Greyscale' },
          { value: 'custom', label: 'Custom JSON' }
        ]},
        { key: 'customMapStyle', label: 'Custom Style JSON', type: 'textarea', col: 1,
          placeholder: 'Paste Snazzy Maps JSON...', showWhen: { key: 'mapStyle', value: 'custom' } },
        { key: 'googleMapsApiKey', label: 'Google Maps API Key', type: 'text', col: 1, placeholder: 'API key...', global: true },
        ...homeMarkerFields(),
        ...colorFields('map'),
        ...overlayFields('map')
      ],
      patterns: [
        ...bgField(),
        ...homeMarkerFields(),
        { key: 'uiAccentColor', label: 'UI Accent', type: 'color', col: 1 },
        { key: 'lineOpacity', label: 'Line Opacity', type: 'range', min: 0.3, max: 2.0, step: 0.1, unit: 'x', col: 1 },
        { key: 'lineWidth', label: 'Line Width', type: 'range', min: 0.5, max: 4.0, step: 0.5, unit: 'px', col: 1 },
        { key: 'haloWidth', label: 'Halo Width', type: 'range', min: 0.5, max: 4.0, step: 0.5, unit: 'px', col: 1 },
        { key: 'inboundColor', label: 'Inbound Color', type: 'select', col: 1, options: [
          { value: 'time', label: 'Time of Day' }, { value: 'cyan', label: 'Cyan' },
          { value: 'blue', label: 'Blue' }, { value: 'gold', label: 'Gold' },
          { value: 'magenta', label: 'Magenta' }, { value: 'green', label: 'Green' },
          { value: 'white', label: 'White' }, { value: 'red', label: 'Red' },
          { value: 'orange', label: 'Orange' }
        ]},
        { key: 'outboundColor', label: 'Outbound Color', type: 'select', col: 1, options: [
          { value: 'time', label: 'Time of Day' }, { value: 'cyan', label: 'Cyan' },
          { value: 'blue', label: 'Blue' }, { value: 'gold', label: 'Gold' },
          { value: 'magenta', label: 'Magenta' }, { value: 'green', label: 'Green' },
          { value: 'white', label: 'White' }, { value: 'red', label: 'Red' },
          { value: 'orange', label: 'Orange' }
        ]},
        { key: 'showLeadingDot', label: 'Leading Dot', type: 'checkbox', col: 2 },
        { key: 'dotSize', label: 'Dot Size', type: 'range', min: 1, max: 8, step: 0.5, unit: 'px', col: 2 },
        { key: 'showStats', label: 'Stats Overlay', type: 'checkbox', col: 2 },
        { key: 'showGroundAircraft', label: 'Ground Aircraft', type: 'checkbox', col: 2 },
        { key: 'resetPatterns', label: 'Reset Patterns', type: 'button', col: 2,
          buttonClass: 'btn-danger btn-sm', description: 'Clears accumulated flight pattern artwork' }
      ]
    };
  }

  renderModeTab(mode) {
    const schemas = this.getModeSchemas();
    const schema = schemas[mode] || [];
    const ms = this.settings.modeSettings[mode] || {};
    const label = this.modeLabels[mode] || mode;

    const col1 = schema.filter(f => f.col === 1);
    const col2 = schema.filter(f => f.col === 2);

    return `
      <div class="tab-columns">
        <div class="tab-column">
          <h4>${label} Effect</h4>
          ${this.renderSchemaFields(col1, ms, mode)}
        </div>
        <div class="tab-column">
          <h4>Aircraft &amp; Labels</h4>
          ${this.renderSchemaFields(col2, ms, mode)}
        </div>
      </div>
    `;
  }

  renderSchemaFields(fields, modeSettings, mode) {
    let html = '';

    fields.forEach(field => {
      // showWhen condition
      if (field.showWhen) {
        const condValue = modeSettings[field.showWhen.key];
        if (condValue !== field.showWhen.value) return;
      }

      const value = field.global ? this.settings[field.key] : modeSettings[field.key];

      switch (field.type) {
        case 'checkbox':
          html += `
            <label class="toggle-label">
              <input type="checkbox" data-mode-key="${field.key}" data-global="${!!field.global}" ${value ? 'checked' : ''}>
              <span class="toggle-check"></span>
              <span class="toggle-text">${field.label}</span>
            </label>`;
          if (field.tooltip) html += `<p class="setting-hint">${field.tooltip}</p>`;
          break;

        case 'range': {
          const dp = field.step < 0.01 ? 3 : (field.step < 0.1 ? 2 : (field.step < 1 ? 1 : 0));
          const dv = typeof value === 'number' ? (Number.isInteger(value) ? value : value.toFixed(dp)) : value;
          html += `
            <div class="input-group">
              <label>${field.label} <span class="slider-value" data-value-for="${field.key}">${dv}</span><span class="slider-unit">${field.unit || ''}</span></label>
              <input type="range" data-mode-key="${field.key}" data-global="${!!field.global}" min="${field.min}" max="${field.max}" step="${field.step}" value="${value}">
            </div>`;
          break;
        }

        case 'select': {
          const opts = (field.options || []).map(o =>
            `<option value="${o.value}" ${value === o.value ? 'selected' : ''}>${o.label}</option>`
          ).join('');
          html += `
            <div class="input-group">
              <label>${field.label}</label>
              <select data-mode-key="${field.key}" data-global="${!!field.global}">${opts}</select>
            </div>`;
          break;
        }

        case 'textarea':
          html += `
            <div class="input-group">
              <label>${field.label}</label>
              <textarea data-mode-key="${field.key}" placeholder="${field.placeholder || ''}" rows="4" class="custom-style-textarea">${value || ''}</textarea>
            </div>`;
          break;

        case 'text':
          html += `
            <div class="input-group">
              <label>${field.label}</label>
              <input type="text" data-mode-key="${field.key}" data-global="${!!field.global}" value="${value || ''}" placeholder="${field.placeholder || ''}">
              ${field.tooltip ? `<p class="setting-hint">${field.tooltip}</p>` : ''}
            </div>`;
          break;

        case 'color':
          html += `
            <div class="input-group input-group-color">
              <label>${field.label}</label>
              <input type="color" data-mode-key="${field.key}" data-global="${!!field.global}" value="${value || '#ffffff'}">
            </div>`;
          break;

        case 'iconselect':
          html += this.renderIconSelect(field, value);
          break;

        case 'aircrafticon':
          html += this.renderAircraftIconSelect(field, value);
          break;

        case 'background':
          html += this.renderBackgroundField(mode, modeSettings);
          break;

        case 'button':
          html += `
            <div class="input-group">
              <button class="btn ${field.buttonClass || ''}" data-action="${field.key}"><span>${field.label}</span></button>
              ${field.description ? `<p class="setting-hint">${field.description}</p>` : ''}
            </div>`;
          break;
      }
    });

    return html;
  }

  renderIconSelect(field, value) {
    const icons = ['crosshair', 'pin', 'star', 'diamond', 'home', 'circle', 'square', 'triangle', 'pulse', 'target'];
    const svgs = {
      crosshair: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="2" x2="12" y2="8"/><line x1="12" y1="16" x2="12" y2="22"/><line x1="2" y1="12" x2="8" y2="12"/><line x1="16" y1="12" x2="22" y2="12"/><circle cx="12" cy="12" r="4"/></svg>',
      pin: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>',
      star: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>',
      diamond: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2L2 12l10 10 10-10L12 2z"/></svg>',
      home: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 12l9-9 9 9"/><path d="M5 10v10h14V10"/><rect x="9" y="14" width="6" height="6"/></svg>',
      circle: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3" fill="currentColor"/></svg>',
      square: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="4" y="4" width="16" height="16"/><rect x="9" y="9" width="6" height="6" fill="currentColor"/></svg>',
      triangle: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3L3 21h18L12 3z"/></svg>',
      pulse: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><circle cx="12" cy="12" r="7" opacity="0.5"/><circle cx="12" cy="12" r="10" opacity="0.25"/></svg>',
      target: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2" fill="currentColor"/></svg>'
    };

    return `
      <div class="input-group">
        <label>${field.label}</label>
        <div class="icon-select-grid" data-mode-key="${field.key}">
          ${icons.map(i => `<button class="icon-select-btn ${value === i ? 'active' : ''}" data-icon="${i}" title="${i}">${svgs[i]}</button>`).join('')}
        </div>
      </div>`;
  }

  renderAircraftIconSelect(field, value) {
    const icons = ['chevron', 'glow', 'dot', 'diamond', 'circle', 'crosshair', 'arrow', 'plane', 'triangle', 'none'];
    const svgs = {
      chevron: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 3l-5 16 5-5 5 5z"/></svg>',
      glow: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="5" fill="currentColor" opacity="0.3"/><circle cx="12" cy="12" r="3" fill="currentColor"/></svg>',
      dot: '<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="5"/></svg>',
      diamond: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 4L6 12l6 8 6-8z"/></svg>',
      circle: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2" fill="currentColor"/></svg>',
      crosshair: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><line x1="12" y1="6" x2="12" y2="10"/><line x1="12" y1="14" x2="12" y2="18"/><line x1="6" y1="12" x2="10" y2="12"/><line x1="14" y1="12" x2="18" y2="12"/><circle cx="12" cy="12" r="2" fill="currentColor"/></svg>',
      arrow: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 4l-4 12h3v4h2v-4h3z"/></svg>',
      plane: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2L9 9H3l2 3-2 3h6l3 7 3-7h6l-2-3 2-3h-6z"/></svg>',
      triangle: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 4L6 18h12z"/></svg>',
      none: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" opacity="0.3"><line x1="6" y1="6" x2="18" y2="18"/><line x1="18" y1="6" x2="6" y2="18"/></svg>'
    };

    return `
      <div class="input-group">
        <label>${field.label}</label>
        <div class="icon-select-grid" data-mode-key="${field.key}">
          ${icons.map(i => `<button class="icon-select-btn ${value === i ? 'active' : ''}" data-icon="${i}" title="${i}">${svgs[i]}</button>`).join('')}
        </div>
      </div>`;
  }

  renderBackgroundField(mode, modeSettings) {
    if (mode === 'map') return '';
    const url = modeSettings.backgroundImage || '';
    const hasPreview = !!url;

    return `
      <div class="input-group">
        <label>Image URL</label>
        <div class="bg-input-row">
          <input type="text" data-bg-url value="${(url && !url.startsWith('data:')) ? url : ''}" placeholder="https://example.com/image.jpg">
          <label class="file-upload-btn" title="Upload">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round">
              <path d="M12 16V4m0 0l-4 4m4-4l4 4"/>
              <path d="M2 17l.621 2.485A2 2 0 004.56 21h14.88a2 2 0 001.94-1.515L22 17"/>
            </svg>
            <input type="file" accept="image/*" data-bg-file class="visually-hidden">
          </label>
        </div>
      </div>
      <div class="bg-preview ${hasPreview ? '' : 'hidden'}" data-bg-preview>
        <img src="${url}" alt="Preview" data-bg-preview-img>
        <button class="clear-bg-btn" data-bg-clear title="Remove">&times;</button>
      </div>`;
  }

  // ─── About Tab ──────────────────────────────────────────

  renderAboutTab() {
    return `
      <div class="about-header">
        <h3>theARTofFLIGHT</h3>
        <p class="about-tagline">Museum-grade flight visualization art installation</p>
      </div>
      <div class="tab-columns">
        <div class="tab-column about-section">
          <h4>Effect Credits</h4>
          <div class="credits-list">
            <div class="credit-item">
              <span class="credit-mode">Ripple</span>
              <span class="credit-info">Liquid Background by <a href="https://codepen.io/soju22" target="_blank" rel="noopener">Kevin Levron</a></span>
              <span class="credit-license">CC BY-NC-SA 4.0</span>
            </div>
            <div class="credit-item">
              <span class="credit-mode">Grid</span>
              <span class="credit-info">Neural Grid Reveal by <a href="https://codepen.io/gauravgajjar" target="_blank" rel="noopener">Gaurav Gajjar</a></span>
              <span class="credit-license">MIT License</span>
            </div>
            <div class="credit-item">
              <span class="credit-mode">Waves</span>
              <span class="credit-info">Line Text Distortion by <a href="https://codepen.io/blacklead-studio" target="_blank" rel="noopener">BL/S&reg; Studio</a></span>
              <span class="credit-license">MIT License</span>
            </div>
            <div class="credit-item">
              <span class="credit-mode">Tubes</span>
              <span class="credit-info">Neon 3D Tubes Cursor by <a href="https://codepen.io/soju22" target="_blank" rel="noopener">Kevin Levron</a></span>
              <span class="credit-license">MIT License</span>
            </div>
          </div>
        </div>
        <div class="tab-column about-section">
          <h4>Data Sources</h4>
          <div class="credits-list">
            <div class="credit-item">
              <span class="credit-mode">Positions</span>
              <span class="credit-info">ADSB.lol — Real-time ADS-B aircraft data</span>
              <span class="credit-license">Open Data</span>
            </div>
            <div class="credit-item">
              <span class="credit-mode">Routes</span>
              <span class="credit-info">OpenSky Network — Flight route lookup</span>
              <span class="credit-license">Open Data</span>
            </div>
          </div>

          <h4>Technology</h4>
          <div class="credits-list">
            <div class="credit-item">
              <span class="credit-mode">Maps</span>
              <span class="credit-info">Google Maps + Snazzy Maps styles</span>
            </div>
            <div class="credit-item">
              <span class="credit-mode">WebGL</span>
              <span class="credit-info">Three.js via threejs-components</span>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  // ─── Wire Up Events ─────────────────────────────────────

  wireUpTabContent(container, tabId) {
    const isGlobal = tabId === 'global';

    if (isGlobal) {
      this.wireUpGlobalControls(container);
    } else if (tabId !== 'about') {
      this.wireUpModeControls(container, tabId);
    }
  }

  wireUpGlobalControls(container) {
    // Text/number inputs
    container.querySelectorAll('input[type="text"][data-global-key], input[type="number"][data-global-key]').forEach(el => {
      el.addEventListener('change', (e) => {
        const key = e.target.dataset.globalKey;
        const val = e.target.type === 'number' ? parseFloat(e.target.value) : e.target.value.trim();
        this.set(key, val);
        this.notifyChange();
      });
    });

    // Checkboxes
    container.querySelectorAll('input[type="checkbox"][data-global-key]').forEach(el => {
      el.addEventListener('change', (e) => {
        this.set(e.target.dataset.globalKey, e.target.checked);
        this.notifyChange();
      });
    });

    // Range sliders
    container.querySelectorAll('input[type="range"][data-global-key]').forEach(el => {
      el.addEventListener('input', (e) => {
        const key = e.target.dataset.globalKey;
        const val = parseFloat(e.target.value);
        const disp = container.querySelector(`[data-value-for="${key}"]`);
        if (disp) disp.textContent = Number.isInteger(val) ? val : val.toFixed(2);
        this.set(key, val);
        if (key === 'panelBgOpacity' || key === 'panelBgColor') this.applyUIStyles();
        this.notifyChange();
      });
    });

    // Color inputs
    container.querySelectorAll('input[type="color"][data-global-key]').forEach(el => {
      el.addEventListener('input', (e) => {
        this.set(e.target.dataset.globalKey, e.target.value);
        this.applyUIStyles();
        this.notifyChange();
      });
    });

    // Selects (font selects)
    container.querySelectorAll('select[data-global-key]').forEach(el => {
      el.addEventListener('change', (e) => {
        this.set(e.target.dataset.globalKey, e.target.value);
        this.applyUIStyles();
        this.notifyChange();
      });
    });
  }

  wireUpModeControls(container, mode) {
    // Checkboxes
    container.querySelectorAll('input[type="checkbox"][data-mode-key]').forEach(el => {
      el.addEventListener('change', (e) => {
        const key = e.target.dataset.modeKey;
        const isGlobal = e.target.dataset.global === 'true';
        if (isGlobal) this.set(key, e.target.checked);
        else this.setModeSetting(mode, key, e.target.checked);
        // Re-render if this might toggle conditional fields
        if (key === 'showHomeMarker') this.switchTab(mode);
        this.notifyChange();
      });
    });

    // Range sliders
    container.querySelectorAll('input[type="range"][data-mode-key]').forEach(el => {
      el.addEventListener('input', (e) => {
        const key = e.target.dataset.modeKey;
        const isGlobal = e.target.dataset.global === 'true';
        const val = parseFloat(e.target.value);
        const disp = container.querySelector(`[data-value-for="${key}"]`);
        if (disp) {
          const step = parseFloat(e.target.step);
          disp.textContent = Number.isInteger(val) ? val : val.toFixed(step < 0.01 ? 3 : (step < 0.1 ? 2 : 1));
        }
        if (isGlobal) this.set(key, val);
        else this.setModeSetting(mode, key, val);
        this.notifyChange();
      });
    });

    // Selects
    container.querySelectorAll('select[data-mode-key]').forEach(el => {
      el.addEventListener('change', (e) => {
        const key = e.target.dataset.modeKey;
        const isGlobal = e.target.dataset.global === 'true';
        if (isGlobal) this.set(key, e.target.value);
        else this.setModeSetting(mode, key, e.target.value);
        // Re-render for conditional fields
        this.switchTab(mode);
        this.notifyChange();
      });
    });

    // Text inputs
    container.querySelectorAll('input[type="text"][data-mode-key]').forEach(el => {
      el.addEventListener('change', (e) => {
        const key = e.target.dataset.modeKey;
        const isGlobal = e.target.dataset.global === 'true';
        if (isGlobal) this.set(key, e.target.value.trim());
        else this.setModeSetting(mode, key, e.target.value.trim());
        this.notifyChange();
      });
    });

    // Color inputs
    container.querySelectorAll('input[type="color"][data-mode-key]').forEach(el => {
      el.addEventListener('input', (e) => {
        const key = e.target.dataset.modeKey;
        const isGlobal = e.target.dataset.global === 'true';
        if (isGlobal) this.set(key, e.target.value);
        else this.setModeSetting(mode, key, e.target.value);
        this.notifyChange();
      });
    });

    // Textareas (custom map style)
    container.querySelectorAll('textarea[data-mode-key]').forEach(el => {
      el.addEventListener('change', (e) => {
        const key = e.target.dataset.modeKey;
        const raw = e.target.value.trim();
        if (key === 'customMapStyle' && raw) {
          try {
            const parsed = JSON.parse(raw);
            if (!Array.isArray(parsed)) { alert('Must be a JSON array'); return; }
            this.setModeSetting(mode, key, raw);
            e.target.style.borderColor = 'rgba(0, 240, 255, 0.3)';
          } catch (err) { alert('Invalid JSON: ' + err.message); e.target.style.borderColor = 'rgba(255, 0, 85, 0.5)'; return; }
        } else {
          this.setModeSetting(mode, key, raw);
        }
        this.notifyChange();
      });
    });

    // Icon select grids (home marker + aircraft icon)
    container.querySelectorAll('.icon-select-grid').forEach(grid => {
      const key = grid.dataset.modeKey;
      grid.querySelectorAll('.icon-select-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.preventDefault();
          grid.querySelectorAll('.icon-select-btn').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          this.setModeSetting(mode, key, btn.dataset.icon);
          this.notifyChange();
        });
      });
    });

    // Background image controls
    const bgUrl = container.querySelector('[data-bg-url]');
    const bgFile = container.querySelector('[data-bg-file]');
    const bgClear = container.querySelector('[data-bg-clear]');
    const bgPreview = container.querySelector('[data-bg-preview]');
    const bgPreviewImg = container.querySelector('[data-bg-preview-img]');

    if (bgUrl) {
      bgUrl.addEventListener('change', (e) => {
        const url = e.target.value.trim();
        this.setModeSetting(mode, 'backgroundImage', url);
        if (bgPreview && bgPreviewImg) {
          if (url) { bgPreviewImg.src = url; bgPreview.classList.remove('hidden'); }
          else bgPreview.classList.add('hidden');
        }
        this.notifyChange();
      });
    }

    if (bgFile) {
      bgFile.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
          const dataUrl = ev.target.result;
          this.setModeSetting(mode, 'backgroundImage', dataUrl);
          if (bgUrl) bgUrl.value = '';
          if (bgPreview && bgPreviewImg) { bgPreviewImg.src = dataUrl; bgPreview.classList.remove('hidden'); }
          this.notifyChange();
        };
        reader.readAsDataURL(file);
      });
    }

    if (bgClear) {
      bgClear.addEventListener('click', () => {
        this.setModeSetting(mode, 'backgroundImage', '');
        if (bgUrl) bgUrl.value = '';
        if (bgPreview) bgPreview.classList.add('hidden');
        this.notifyChange();
      });
    }

    // Buttons (e.g., reset patterns)
    container.querySelectorAll('[data-action]').forEach(el => {
      el.addEventListener('click', (e) => {
        if (e.currentTarget.dataset.action === 'resetPatterns') {
          if (confirm('Reset accumulated flight patterns?')) {
            if (window.theArtOfFlight?.visualizations?.patterns) {
              window.theArtOfFlight.visualizations.patterns.reset();
              window.theArtOfFlight.visualizations.patterns.savePaths();
            }
          }
        }
      });
    });
  }

  // ─── UI Styling ─────────────────────────────────────────

  applyUIStyles() {
    const root = document.documentElement;
    const bg = this.settings.panelBgColor || '#080a10';
    const opacity = this.settings.panelBgOpacity || 0.92;
    const headerFont = this.settings.headerFont || 'Space Mono';
    const bodyFont = this.settings.bodyFont || 'Work Sans';

    // Parse bg color to rgba
    const r = parseInt(bg.slice(1, 3), 16);
    const g = parseInt(bg.slice(3, 5), 16);
    const b = parseInt(bg.slice(5, 7), 16);
    root.style.setProperty('--panel-bg', `rgba(${r}, ${g}, ${b}, ${opacity})`);
    root.style.setProperty('--header-font', `'${headerFont}'`);
    root.style.setProperty('--body-font', `'${bodyFont}'`);

    // Load fonts if not default
    if (headerFont !== 'Space Mono') this.loadFont(headerFont);
    if (bodyFont !== 'Work Sans') this.loadFont(bodyFont);
  }

  loadFont(fontName) {
    if (document.querySelector(`link[data-font="${fontName}"]`)) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.dataset.font = fontName;
    link.href = `https://fonts.googleapis.com/css2?family=${fontName.replace(/ /g, '+')}:wght@300;400;500;600;700&display=swap`;
    document.head.appendChild(link);
  }

  // ─── Bottom Bar & Global UI ─────────────────────────────

  updateUI() {
    const currentMode = this.get('mode');
    document.querySelectorAll('.mode-btn').forEach(btn => {
      btn.classList.toggle('active', btn.getAttribute('data-mode') === currentMode);
    });
  }

  toggleInfo() {
    const current = this.get('showInfoPanel');
    this.set('showInfoPanel', !current);
    this.notifyChange();
  }
}
