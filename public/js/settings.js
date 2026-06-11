/**
 * Settings v2 — one mental model: Scene / Look / Mode.
 *
 *   Scene  where you are + what data flows (location, radius, cadence)
 *   Look   shared across every mode: background, palette, aircraft,
 *          trails, labels, home marker
 *   Mode   only the active mode's own knobs
 *
 * The panel is hidden until summoned (S, or the hint pill). Changes apply
 * live and autosave (debounced) — there is no Save button to forget on a
 * kiosk. ?deterministic=1 ignores storage entirely.
 *
 * Palettes (palettes.js) carry all colour: modes receive a resolved palette
 * object and interpret its semantic slots artistically.
 */

const SETTINGS_VERSION = 2;
const SETTINGS_KEY = 'theARTofFLIGHT_settings';

/** Mode metadata for the Modes section and toasts. Order = digit shortcuts. */
const MODE_META = {
  aurora: {
    label: 'Aurora', desc: 'Luminous ribbons trail each aircraft',
    icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"><path d="M3 16c4-7 7-9 9-6s5 1 9-4"/><path d="M3 19c4-5 7-7 9-4s5 0 9-3" opacity="0.55"/><path d="M3 13c4-9 7-11 9-8s5 2 9-5" opacity="0.3"/></svg>'
  },
  ink: {
    label: 'Ink', desc: 'Sumi-e brushwork on paper',
    icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round"><path d="M4 18C8 16 9 9 12 7s6 0 8-3" stroke-width="2.4" opacity="0.85"/><path d="M5 21c3-1 11-2 14-6" stroke-width="0.8" opacity="0.4"/></svg>'
  },
  patterns: {
    label: 'Patterns', desc: 'A day of flight paths, accumulated',
    icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round"><path d="M2 12c4-8 8-8 10 0s6 8 10 0"/><path d="M2 8c4-6 8-6 10 0s6 6 10 0" opacity="0.5"/><path d="M2 16c4-6 8-6 10 0s6 6 10 0" opacity="0.5"/></svg>'
  },
  contrails: {
    label: 'Contrails', desc: 'Long-exposure sky photography',
    icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"><path d="M3 20L17 6" opacity="0.4"/><path d="M5 21L19 7" opacity="0.7"/><circle cx="19.5" cy="6.5" r="1.6" fill="currentColor" stroke="none"/><path d="M8 21l9-9" opacity="0.25"/></svg>'
  },
  ripple: {
    label: 'Ripple', desc: 'Wakes on dark water',
    icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="2.5"/><circle cx="12" cy="12" r="6" opacity="0.5"/><circle cx="12" cy="12" r="10" opacity="0.25"/></svg>'
  },
  constellation: {
    label: 'Waves', desc: 'An invisible field, made visible',
    icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round"><path d="M2 6h20"/><path d="M2 10c4-3 8 3 10 0s6-3 10 0"/><path d="M2 14c4 3 8-3 10 0s6 3 10 0"/><path d="M2 18h20"/></svg>'
  },
  radar: {
    label: 'Radar', desc: 'CRT phosphor sweep',
    icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4.5" opacity="0.4"/><path d="M12 12L19 5" stroke-linecap="round"/><path d="M12 12L19 5A9 9 0 0 1 21 12z" fill="currentColor" opacity="0.25" stroke="none"/><circle cx="8" cy="15" r="1.3" fill="currentColor" stroke="none"/></svg>'
  },
  reality: {
    label: 'Reality', desc: 'Pure data, no theatre',
    icon: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 3l-5 16 5-5 5 5z"/></svg>'
  },
  map: {
    label: 'Map', desc: 'Aircraft over the city',
    icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="1"/><line x1="3" y1="12" x2="21" y2="12" opacity="0.3"/><line x1="12" y1="3" x2="12" y2="21" opacity="0.3"/><circle cx="12" cy="12" r="2.5" fill="currentColor" opacity="0.6"/></svg>'
  },
  departures: {
    label: 'Board', desc: 'Split-flap departures board',
    icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"><rect x="3" y="4" width="18" height="16" rx="1.5"/><line x1="6" y1="8.5" x2="18" y2="8.5" opacity="0.8"/><line x1="6" y1="12" x2="18" y2="12" opacity="0.55"/><line x1="6" y1="15.5" x2="14" y2="15.5" opacity="0.3"/></svg>'
  }
};

const MODE_ORDER = Object.keys(MODE_META);

/** Legacy / friendly mode-key aliases (URL params, dash embed, v1 settings) */
const MODE_ALIASES = {
  waves: 'constellation',
  board: 'departures',
  grid: 'aurora',
  birds: 'aurora',
  tubes: 'ripple'
};

function resolveModeKey(key) {
  if (!key) return null;
  if (MODE_META[key]) return key;
  return MODE_ALIASES[key] || null;
}

/** Escape user-typed values for safe interpolation into HTML attributes. */
function esc(v) {
  return String(v ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

class SettingsManager {
  constructor() {
    this.settings = this.loadSettings();
    this.callbacks = [];
    this.currentSection = 'modes';
    this._saveTimer = null;
    this._rendered = false;

    // Built-in background library (vendored CC0/public-domain images).
    this.bgLibrary = [];
    fetch('/backgrounds/manifest.json')
      .then(r => r.ok ? r.json() : [])
      .then(list => { this.bgLibrary = Array.isArray(list) ? list : []; })
      .catch(() => {});

    this.initUI();
  }

  getDefaults() {
    return {
      version: SETTINGS_VERSION,
      // Scene
      locationName: 'Sydney Opera House, NSW, Australia',
      latitude: -33.8568,
      longitude: 151.2153,
      radius: 50,
      updateInterval: 2,
      maxFlights: 50,
      includeGround: false,
      mode: 'aurora',
      showInfoPanel: false,
      // Look — shared across all modes
      look: {
        background: '',
        palette: 'aurora',
        customPalette: { accent: '#52e0c4', inbound: '#52e0c4', outbound: '#b79cff' },
        aircraftIcon: 'glow',
        aircraftScale: 1.0,
        trails: false,
        trailLength: 100,
        labels: 'minimal',
        labelScale: 1.0,
        homeMarker: false,
        homeMarkerIcon: 'crosshair'
      },
      // Mode-specific knobs only — no duplicated base keys
      modeSettings: {
        aurora: { flow: 1.0, glow: 1.0, density: 1.0 },
        ink: { strokeWeight: 1.0, wash: 1.0 },
        patterns: { exposure: 1.0, lineWidth: 1.0, showStats: false },
        contrails: { skyMode: 'auto', trailWidth: 2.0, dissolveMinutes: 6 },
        ripple: { displacementScale: 5, metalness: 0.75, roughness: 0.25, persistence: 0.5 },
        constellation: { lineCount: 200, distortRadius: 120, distortStrength: 15 },
        radar: { sweepSeconds: 6, ringCount: 4, showScanlines: true },
        reality: {},
        map: { mapStyle: 'nocturne', spotlightLabels: true },
        departures: { maxRows: 10, showStatus: true, flipStagger: true }
      }
    };
  }

  // ─── Load / migrate / save ──────────────────────────────

  loadSettings() {
    if (window.__DETERMINISTIC__) return this.getDefaults();

    const stored = localStorage.getItem(SETTINGS_KEY);
    const defaults = this.getDefaults();
    if (!stored) return defaults;

    try {
      const parsed = JSON.parse(stored);
      if (parsed.version === SETTINGS_VERSION) {
        return this.mergeSettings(defaults, parsed);
      }
      return this.migrateV1(defaults, parsed);
    } catch (e) {
      console.error('Failed to parse stored settings:', e);
      return defaults;
    }
  }

  mergeSettings(defaults, parsed) {
    const merged = { ...defaults, ...parsed };
    merged.look = { ...defaults.look, ...(parsed.look || {}) };
    merged.look.customPalette = { ...defaults.look.customPalette, ...((parsed.look || {}).customPalette || {}) };
    merged.modeSettings = { ...defaults.modeSettings };
    for (const mode of Object.keys(defaults.modeSettings)) {
      merged.modeSettings[mode] = {
        ...defaults.modeSettings[mode],
        ...((parsed.modeSettings || {})[mode] || {})
      };
    }
    merged.mode = resolveModeKey(merged.mode) || defaults.mode;
    return merged;
  }

  /** v1 → v2: keep scene + active-mode look hints; colours fall to palettes. */
  migrateV1(defaults, old) {
    const s = { ...defaults };
    ['locationName', 'latitude', 'longitude', 'radius', 'updateInterval', 'maxFlights', 'showInfoPanel']
      .forEach(k => { if (old[k] !== undefined) s[k] = old[k]; });

    s.mode = resolveModeKey(old.mode) || defaults.mode;

    const om = (old.modeSettings || {})[old.mode] || {};
    if (om.backgroundImage) s.look.background = om.backgroundImage;
    if (om.aircraftIcon) s.look.aircraftIcon = om.aircraftIcon;
    if (typeof om.aircraftScale === 'number') s.look.aircraftScale = om.aircraftScale;
    if (typeof om.showTrails === 'boolean') s.look.trails = om.showTrails;
    if (typeof om.trailLength === 'number') s.look.trailLength = om.trailLength;
    if (typeof om.labelTextScale === 'number') s.look.labelScale = om.labelTextScale;
    if (typeof om.showHomeMarker === 'boolean') s.look.homeMarker = om.showHomeMarker;
    if (om.homeMarkerIcon) s.look.homeMarkerIcon = om.homeMarkerIcon;
    s.look.labels = om.showCallsigns
      ? ((om.showAltitude || om.showSpeed) ? 'detailed' : (om.showRoute ? 'standard' : 'minimal'))
      : 'off';

    // Carry over mode-specific knobs that survived the v2 schema
    const carry = (mode, keys) => {
      const src = (old.modeSettings || {})[mode] || {};
      keys.forEach(k => { if (src[k] !== undefined) s.modeSettings[mode][k] = src[k]; });
    };
    carry('ripple', ['displacementScale', 'metalness', 'roughness']);
    carry('constellation', ['lineCount', 'distortRadius', 'distortStrength']);
    carry('radar', ['sweepSeconds', 'ringCount', 'showScanlines']);
    carry('contrails', ['skyMode', 'trailWidth', 'dissolveMinutes']);
    carry('departures', ['maxRows', 'showStatus', 'flipStagger']);
    carry('patterns', ['lineWidth']);
    carry('map', ['mapStyle']);

    return s;
  }

  saveSettings() {
    if (window.__DETERMINISTIC__) return;
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(this.settings));
  }

  /** Live-apply + debounced autosave. Every input path funnels through here. */
  applyChange() {
    this.notifyChange();
    clearTimeout(this._saveTimer);
    this._saveTimer = setTimeout(() => {
      this.saveSettings();
      this.flashSaved();
    }, 400);
  }

  resetSettings() {
    this.settings = this.getDefaults();
    this.saveSettings();
    this.renderSection(this.currentSection);
    this.notifyChange();
  }

  // ─── Accessors ──────────────────────────────────────────

  get(key) { return this.settings[key]; }
  set(key, value) { this.settings[key] = value; }

  getLook(key) { return this.settings.look[key]; }
  setLook(key, value) { this.settings.look[key] = value; }

  getModeSetting(mode, key) { return this.settings.modeSettings[mode]?.[key]; }
  setModeSetting(mode, key, value) {
    if (!this.settings.modeSettings[mode]) this.settings.modeSettings[mode] = {};
    this.settings.modeSettings[mode][key] = value;
  }

  getActivePalette() {
    return resolvePalette(this.settings.look.palette, this.settings.look.customPalette);
  }

  /** Translate the labels preset into the base-class boolean flags. */
  getLabelFlags() {
    const preset = this.settings.look.labels;
    return {
      showCallsigns: preset !== 'off',
      showRoute: preset === 'standard' || preset === 'detailed',
      showAltitude: preset === 'detailed',
      showSpeed: preset === 'detailed',
      showCoordinates: false
    };
  }

  onChange(callback) { this.callbacks.push(callback); }
  notifyChange() { this.callbacks.forEach(cb => cb(this.settings)); }

  // ─── Panel shell ────────────────────────────────────────

  initUI() {
    this.panel = document.getElementById('settingsPanel');
    if (!this.panel) return;

    this.panel.addEventListener('click', (e) => {
      if (e.target === this.panel) this.close();
    });
    document.getElementById('closeSettings')?.addEventListener('click', () => this.close());

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.isOpen()) this.close();
    });

    // Section nav
    const nav = document.getElementById('settingsNav');
    if (nav) {
      const sections = [
        { id: 'modes', label: 'Modes' },
        { id: 'look', label: 'Look' },
        { id: 'scene', label: 'Scene' },
        { id: 'mode', label: 'Mode' },
        { id: 'about', label: 'About' }
      ];
      nav.innerHTML = sections.map(s =>
        `<button class="nav-btn${s.id === this.currentSection ? ' active' : ''}" data-section="${s.id}">${s.label}</button>`
      ).join('');
      nav.querySelectorAll('.nav-btn').forEach(btn => {
        btn.addEventListener('click', () => this.showSection(btn.dataset.section));
      });
    }

    document.getElementById('resetSettings')?.addEventListener('click', () => {
      if (confirm('Reset all settings to defaults?')) this.resetSettings();
    });
  }

  isOpen() { return this.panel?.classList.contains('visible'); }

  open(section) {
    if (!this.panel) return;
    if (section) this.currentSection = section;
    this.renderSection(this.currentSection);
    this.panel.classList.add('visible');
    document.body.classList.add('settings-open');
  }

  close() {
    this.panel?.classList.remove('visible');
    document.body.classList.remove('settings-open');
  }

  toggle() { this.isOpen() ? this.close() : this.open(); }

  showSection(id) {
    this.currentSection = id;
    document.querySelectorAll('#settingsNav .nav-btn').forEach(b =>
      b.classList.toggle('active', b.dataset.section === id));
    this.renderSection(id);
  }

  flashSaved() {
    const el = document.getElementById('savedFlash');
    if (!el) return;
    el.classList.add('show');
    clearTimeout(this._savedFlashTimer);
    this._savedFlashTimer = setTimeout(() => el.classList.remove('show'), 1200);
  }

  renderSection(id) {
    const body = document.getElementById('settingsBody');
    if (!body) return;
    body.classList.remove('loaded');

    let html = '';
    switch (id) {
      case 'modes': html = this.renderModes(); break;
      case 'look': html = this.renderLook(); break;
      case 'scene': html = this.renderScene(); break;
      case 'mode': html = this.renderModeSection(); break;
      case 'about': html = this.renderAbout(); break;
    }
    body.innerHTML = html;
    this.wireSection(body, id);
    requestAnimationFrame(() => body.classList.add('loaded'));
  }

  // ─── Sections ───────────────────────────────────────────

  renderModes() {
    const active = this.settings.mode;
    const cards = MODE_ORDER.map((key, i) => {
      const m = MODE_META[key];
      const digit = (i + 1) % 10;
      return `
        <button class="mode-card${key === active ? ' active' : ''}" data-pick-mode="${key}">
          <span class="mode-card-icon">${m.icon}</span>
          <span class="mode-card-name">${m.label}</span>
          <span class="mode-card-desc">${m.desc}</span>
          <kbd class="mode-card-key">${digit}</kbd>
        </button>`;
    }).join('');
    return `<div class="mode-grid">${cards}</div>`;
  }

  renderLook() {
    const look = this.settings.look;
    const paletteCards = Object.entries(PALETTES).map(([key, p]) => `
      <button class="palette-card${look.palette === key ? ' active' : ''}" data-pick-palette="${key}" title="${p.name}">
        <span class="palette-ramp">${p.ramp.map(c => `<i style="background:${c}"></i>`).join('')}</span>
        <span class="palette-name">${p.name}</span>
      </button>`).join('') + `
      <button class="palette-card${look.palette === 'custom' ? ' active' : ''}" data-pick-palette="custom" title="Custom">
        <span class="palette-ramp palette-ramp-custom"><i></i><i></i><i></i><i></i><i></i></span>
        <span class="palette-name">Custom</span>
      </button>`;

    const customPickers = look.palette === 'custom' ? `
      <div class="input-row">
        <div class="input-group input-group-color"><label>Accent</label>
          <input type="color" data-custom-color="accent" value="${look.customPalette.accent}"></div>
        <div class="input-group input-group-color"><label>Inbound</label>
          <input type="color" data-custom-color="inbound" value="${look.customPalette.inbound}"></div>
        <div class="input-group input-group-color"><label>Outbound</label>
          <input type="color" data-custom-color="outbound" value="${look.customPalette.outbound}"></div>
      </div>` : '';

    const labelPresets = ['off', 'minimal', 'standard', 'detailed'].map(p =>
      `<button class="seg-btn${look.labels === p ? ' active' : ''}" data-label-preset="${p}">${p[0].toUpperCase()}${p.slice(1)}</button>`
    ).join('');

    return `
      <div class="settings-group">
        <h4>Palette</h4>
        <p class="group-hint">One colour script, applied across every mode.</p>
        <div class="palette-grid">${paletteCards}</div>
        ${customPickers}
      </div>

      <div class="settings-group">
        <h4>Background</h4>
        ${this.renderBackgroundField()}
      </div>

      <div class="tab-columns">
        <div class="tab-column settings-group">
          <h4>Aircraft</h4>
          ${this.renderAircraftIconSelect(look.aircraftIcon)}
          <div class="input-group">
            <label>Size <span class="slider-value" data-value-for="aircraftScale">${look.aircraftScale.toFixed(1)}</span><span class="slider-unit">×</span></label>
            <input type="range" data-look-key="aircraftScale" min="0.5" max="2.0" step="0.1" value="${look.aircraftScale}">
          </div>
          <label class="toggle-label">
            <input type="checkbox" data-look-key="trails" ${look.trails ? 'checked' : ''}>
            <span class="toggle-check"></span><span class="toggle-text">Flight trails</span>
          </label>
          <div class="input-group" ${look.trails ? '' : 'style="display:none"'} data-show-for="trails">
            <label>Trail length <span class="slider-value" data-value-for="trailLength">${look.trailLength}</span></label>
            <input type="range" data-look-key="trailLength" min="20" max="300" step="10" value="${look.trailLength}">
          </div>
        </div>

        <div class="tab-column settings-group">
          <h4>Labels</h4>
          <div class="seg-control">${labelPresets}</div>
          <div class="input-group">
            <label>Label size <span class="slider-value" data-value-for="labelScale">${look.labelScale.toFixed(1)}</span><span class="slider-unit">×</span></label>
            <input type="range" data-look-key="labelScale" min="0.5" max="2.0" step="0.1" value="${look.labelScale}">
          </div>

          <h4>Home marker</h4>
          <label class="toggle-label">
            <input type="checkbox" data-look-key="homeMarker" ${look.homeMarker ? 'checked' : ''}>
            <span class="toggle-check"></span><span class="toggle-text">Mark home location</span>
          </label>
          ${look.homeMarker ? this.renderIconSelect('homeMarkerIcon', look.homeMarkerIcon) : ''}
        </div>
      </div>`;
  }

  renderScene() {
    const s = this.settings;
    return `
      <div class="tab-columns">
        <div class="tab-column settings-group">
          <h4>Location</h4>
          <div class="input-group">
            <label>Name</label>
            <input type="text" data-scene-key="locationName" value="${esc(s.locationName)}" placeholder="City, Country">
          </div>
          <div class="input-row">
            <div class="input-group"><label>Latitude</label>
              <input type="number" data-scene-key="latitude" step="0.0001" value="${s.latitude}"></div>
            <div class="input-group"><label>Longitude</label>
              <input type="number" data-scene-key="longitude" step="0.0001" value="${s.longitude}"></div>
          </div>
          <div class="input-group">
            <label>Radius <span class="slider-value" data-value-for="radius">${s.radius}</span><span class="slider-unit">km</span></label>
            <input type="range" data-scene-key="radius" min="5" max="100" step="5" value="${s.radius}">
          </div>
        </div>

        <div class="tab-column settings-group">
          <h4>Data</h4>
          <div class="input-group">
            <label>Update interval <span class="slider-value" data-value-for="updateInterval">${s.updateInterval}</span><span class="slider-unit">s</span></label>
            <input type="range" data-scene-key="updateInterval" min="1" max="30" step="1" value="${s.updateInterval}">
          </div>
          <div class="input-group">
            <label>Max flights <span class="slider-value" data-value-for="maxFlights">${s.maxFlights}</span></label>
            <input type="range" data-scene-key="maxFlights" min="10" max="200" step="10" value="${s.maxFlights}">
          </div>
          <label class="toggle-label">
            <input type="checkbox" data-scene-key="includeGround" ${s.includeGround ? 'checked' : ''}>
            <span class="toggle-check"></span><span class="toggle-text">Include ground traffic</span>
          </label>
          <h4>Display</h4>
          <label class="toggle-label">
            <input type="checkbox" data-scene-key="showInfoPanel" ${s.showInfoPanel ? 'checked' : ''}>
            <span class="toggle-check"></span><span class="toggle-text">Information panel <kbd>I</kbd></span>
          </label>
        </div>
      </div>`;
  }

  renderModeSection() {
    const mode = this.settings.mode;
    const meta = MODE_META[mode];
    const schema = this.getModeSchemas()[mode] || [];
    const ms = this.settings.modeSettings[mode] || {};

    if (!schema.length) {
      return `
        <div class="settings-group">
          <h4>${meta.label}</h4>
          <p class="group-hint">${meta.desc}. This mode has no extra settings — it follows your Look.</p>
        </div>`;
    }
    return `
      <div class="settings-group">
        <h4>${meta.label}</h4>
        <p class="group-hint">${meta.desc}</p>
        ${this.renderSchemaFields(schema, ms, mode)}
      </div>`;
  }

  renderAbout() {
    return `
      <div class="about-header">
        <h3>theARTofFLIGHT</h3>
        <p class="about-tagline">Live aircraft as art — a 24/7 installation</p>
      </div>
      <div class="tab-columns">
        <div class="tab-column settings-group">
          <h4>Effect lineage</h4>
          <div class="credits-list">
            <div class="credit-item">
              <span class="credit-mode">Ripple</span>
              <span class="credit-info">Liquid background by <a href="https://codepen.io/soju22" target="_blank" rel="noopener">Kevin Levron</a></span>
              <span class="credit-license">CC BY-NC-SA 4.0</span>
            </div>
            <div class="credit-item">
              <span class="credit-mode">Waves</span>
              <span class="credit-info">After "Line Text Distortion" by <a href="https://codepen.io/blacklead-studio" target="_blank" rel="noopener">BL/S&reg; Studio</a></span>
              <span class="credit-license">MIT License</span>
            </div>
            <div class="credit-item">
              <span class="credit-mode">Patterns</span>
              <span class="credit-info">Homage to Aaron Koblin's <em>Flight Patterns</em></span>
            </div>
          </div>
        </div>
        <div class="tab-column settings-group">
          <h4>Data</h4>
          <div class="credits-list">
            <div class="credit-item">
              <span class="credit-mode">Positions</span>
              <span class="credit-info">adsb.lol / adsb.fi / airplanes.live — open ADS-B data</span>
            </div>
            <div class="credit-item">
              <span class="credit-mode">Routes</span>
              <span class="credit-info">adsbdb.com route lookup</span>
            </div>
            <div class="credit-item">
              <span class="credit-mode">Maps</span>
              <span class="credit-info">MapLibre GL + Protomaps tiles &copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors</span>
            </div>
            <div class="credit-item">
              <span class="credit-mode">Backgrounds</span>
              <span class="credit-info">CC0/public-domain images via Wikimedia Commons (per-image credits in backgrounds/manifest.json)</span>
            </div>
          </div>
        </div>
      </div>`;
  }

  // ─── Mode schemas (mode-specific knobs ONLY) ────────────

  getModeSchemas() {
    return {
      aurora: [
        { key: 'flow', label: 'Flow energy', type: 'range', min: 0.3, max: 2.0, step: 0.1, unit: '×' },
        { key: 'glow', label: 'Glow', type: 'range', min: 0.3, max: 2.0, step: 0.1, unit: '×' },
        { key: 'density', label: 'Ribbon density', type: 'range', min: 0.3, max: 2.0, step: 0.1, unit: '×' }
      ],
      ink: [
        { key: 'strokeWeight', label: 'Stroke weight', type: 'range', min: 0.4, max: 2.5, step: 0.1, unit: '×' },
        { key: 'wash', label: 'Ink wash', type: 'range', min: 0.3, max: 2.0, step: 0.1, unit: '×' }
      ],
      patterns: [
        { key: 'exposure', label: 'Exposure', type: 'range', min: 0.3, max: 3.0, step: 0.1, unit: '×' },
        { key: 'lineWidth', label: 'Line weight', type: 'range', min: 0.5, max: 4.0, step: 0.5, unit: 'px' },
        { key: 'showStats', label: 'Gallery placard', type: 'checkbox' },
        { key: 'resetPatterns', label: 'Reset artwork', type: 'button', buttonClass: 'btn-danger btn-sm', description: 'Clears the accumulated flight-path artwork' }
      ],
      contrails: [
        { key: 'skyMode', label: 'Sky', type: 'select', options: [
          { value: 'auto', label: 'Follow time of day' },
          { value: 'night', label: 'Night' }, { value: 'dawn', label: 'Dawn' },
          { value: 'day', label: 'Day' }, { value: 'dusk', label: 'Dusk' }
        ]},
        { key: 'trailWidth', label: 'Trail width', type: 'range', min: 0.5, max: 6, step: 0.5, unit: 'px' },
        { key: 'dissolveMinutes', label: 'Dissolve time', type: 'range', min: 1, max: 20, step: 1, unit: 'min' }
      ],
      ripple: [
        { key: 'displacementScale', label: 'Wake height', type: 'range', min: 1, max: 15, step: 0.5 },
        { key: 'metalness', label: 'Metalness', type: 'range', min: 0, max: 1.0, step: 0.05 },
        { key: 'roughness', label: 'Roughness', type: 'range', min: 0, max: 1.0, step: 0.05 },
        { key: 'persistence', label: 'Ripple persistence', type: 'range', min: 0, max: 1.0, step: 0.05 }
      ],
      constellation: [
        { key: 'lineCount', label: 'Line density', type: 'range', min: 20, max: 600, step: 10 },
        { key: 'distortRadius', label: 'Field radius', type: 'range', min: 30, max: 300, step: 10, unit: 'px' },
        { key: 'distortStrength', label: 'Field strength', type: 'range', min: 2, max: 30, step: 1 }
      ],
      radar: [
        { key: 'sweepSeconds', label: 'Sweep period', type: 'range', min: 2, max: 15, step: 1, unit: 's' },
        { key: 'ringCount', label: 'Range rings', type: 'range', min: 2, max: 8, step: 1 },
        { key: 'showScanlines', label: 'CRT scanlines', type: 'checkbox' }
      ],
      reality: [],
      map: [
        { key: 'mapStyle', label: 'Map style', type: 'select', options: [
          { value: 'nocturne', label: 'Nocturne' }, { value: 'dark', label: 'Dark' },
          { value: 'black', label: 'Black' }, { value: 'grayscale', label: 'Grayscale' }
        ]},
        { key: 'spotlightLabels', label: 'Spotlight labels (nearest 3 only)', type: 'checkbox' }
      ],
      departures: [
        { key: 'maxRows', label: 'Rows', type: 'range', min: 4, max: 16, step: 1 },
        { key: 'showStatus', label: 'Status column', type: 'checkbox' },
        { key: 'flipStagger', label: 'Staggered flips', type: 'checkbox' }
      ]
    };
  }

  renderSchemaFields(fields, modeSettings, mode) {
    let html = '';
    fields.forEach(field => {
      const value = modeSettings[field.key];
      switch (field.type) {
        case 'checkbox':
          html += `
            <label class="toggle-label">
              <input type="checkbox" data-mode-key="${field.key}" ${value ? 'checked' : ''}>
              <span class="toggle-check"></span>
              <span class="toggle-text">${field.label}</span>
            </label>`;
          break;
        case 'range': {
          const dp = field.step < 0.1 ? 2 : (field.step < 1 ? 1 : 0);
          const dv = typeof value === 'number' ? (Number.isInteger(value) && field.step >= 1 ? value : value.toFixed(dp)) : value;
          html += `
            <div class="input-group">
              <label>${field.label} <span class="slider-value" data-value-for="${field.key}">${dv}</span><span class="slider-unit">${field.unit || ''}</span></label>
              <input type="range" data-mode-key="${field.key}" min="${field.min}" max="${field.max}" step="${field.step}" value="${value}">
            </div>`;
          break;
        }
        case 'select': {
          const opts = (field.options || []).map(o =>
            `<option value="${o.value}" ${value === o.value ? 'selected' : ''}>${o.label}</option>`).join('');
          html += `
            <div class="input-group">
              <label>${field.label}</label>
              <select data-mode-key="${field.key}">${opts}</select>
            </div>`;
          break;
        }
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

  // ─── Reusable field renderers ───────────────────────────

  renderIconSelect(key, value) {
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
        <label>Marker icon</label>
        <div class="icon-select-grid" data-look-icons="${key}">
          ${icons.map(i => `<button class="icon-select-btn ${value === i ? 'active' : ''}" data-icon="${i}" title="${i}">${svgs[i]}</button>`).join('')}
        </div>
      </div>`;
  }

  renderAircraftIconSelect(value) {
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
        <label>Icon</label>
        <div class="icon-select-grid" data-look-icons="aircraftIcon">
          ${icons.map(i => `<button class="icon-select-btn ${value === i ? 'active' : ''}" data-icon="${i}" title="${i}">${svgs[i]}</button>`).join('')}
        </div>
      </div>`;
  }

  renderBackgroundField() {
    const url = this.settings.look.background || '';
    const tiles = [
      `<button class="bg-tile bg-tile-none ${url ? '' : 'active'}" data-bg-pick="" title="No background">×</button>`,
      ...this.bgLibrary.map(bg => `
        <button class="bg-tile ${url === bg.file ? 'active' : ''}" data-bg-pick="${bg.file}"
                title="${bg.title.replace(/"/g, '&quot;')} — ${bg.artist.replace(/"/g, '&quot;')} (${bg.license})">
          <img src="${bg.thumb}" alt="" loading="lazy">
        </button>`)
    ].join('');

    return `
      <p class="group-hint">Applies to every mode that can host an image. Map mode ignores it.</p>
      <div class="bg-gallery">${tiles}</div>
      <div class="input-group">
        <label>Image URL</label>
        <div class="bg-input-row">
          <input type="text" data-bg-url value="${(url && !url.startsWith('data:')) ? esc(url) : ''}" placeholder="https://example.com/image.jpg">
          <label class="file-upload-btn" title="Upload">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round">
              <path d="M12 16V4m0 0l-4 4m4-4l4 4"/>
              <path d="M2 17l.621 2.485A2 2 0 004.56 21h14.88a2 2 0 001.94-1.515L22 17"/>
            </svg>
            <input type="file" accept="image/*" data-bg-file class="visually-hidden">
          </label>
        </div>
      </div>`;
  }

  // ─── Wiring ─────────────────────────────────────────────

  wireSection(container, sectionId) {
    // Mode cards
    container.querySelectorAll('[data-pick-mode]').forEach(card => {
      card.addEventListener('click', () => {
        this.set('mode', card.dataset.pickMode);
        container.querySelectorAll('.mode-card').forEach(c =>
          c.classList.toggle('active', c.dataset.pickMode === card.dataset.pickMode));
        this.applyChange();
      });
    });

    // Palette cards
    container.querySelectorAll('[data-pick-palette]').forEach(card => {
      card.addEventListener('click', () => {
        this.setLook('palette', card.dataset.pickPalette);
        this.renderSection('look');
        this.applyChange();
      });
    });
    container.querySelectorAll('input[data-custom-color]').forEach(el => {
      el.addEventListener('input', (e) => {
        this.settings.look.customPalette[e.target.dataset.customColor] = e.target.value;
        this.applyChange();
      });
    });

    // Label preset segments
    container.querySelectorAll('[data-label-preset]').forEach(btn => {
      btn.addEventListener('click', () => {
        this.setLook('labels', btn.dataset.labelPreset);
        container.querySelectorAll('[data-label-preset]').forEach(b =>
          b.classList.toggle('active', b.dataset.labelPreset === btn.dataset.labelPreset));
        this.applyChange();
      });
    });

    // Generic inputs by scope
    const scopes = [
      { attr: 'data-look-key', set: (k, v) => this.setLook(k, v), rerenderOn: ['trails', 'homeMarker'] },
      { attr: 'data-scene-key', set: (k, v) => this.set(k, v), rerenderOn: [] },
      { attr: 'data-mode-key', set: (k, v) => this.setModeSetting(this.settings.mode, k, v), rerenderOn: [] }
    ];

    scopes.forEach(scope => {
      container.querySelectorAll(`input[type="checkbox"][${scope.attr}]`).forEach(el => {
        el.addEventListener('change', (e) => {
          const key = e.target.getAttribute(scope.attr);
          scope.set(key, e.target.checked);
          if (scope.rerenderOn.includes(key)) this.renderSection(sectionId);
          this.applyChange();
        });
      });
      container.querySelectorAll(`input[type="range"][${scope.attr}]`).forEach(el => {
        el.addEventListener('input', (e) => {
          const key = e.target.getAttribute(scope.attr);
          const val = parseFloat(e.target.value);
          const disp = container.querySelector(`[data-value-for="${key}"]`);
          if (disp) {
            const step = parseFloat(e.target.step);
            disp.textContent = (Number.isInteger(val) && step >= 1) ? val : val.toFixed(step < 0.1 ? 2 : 1);
          }
          scope.set(key, val);
          this.applyChange();
        });
      });
      container.querySelectorAll(`select[${scope.attr}]`).forEach(el => {
        el.addEventListener('change', (e) => {
          scope.set(e.target.getAttribute(scope.attr), e.target.value);
          this.applyChange();
        });
      });
      container.querySelectorAll(`input[type="text"][${scope.attr}], input[type="number"][${scope.attr}]`).forEach(el => {
        el.addEventListener('change', (e) => {
          const val = e.target.type === 'number' ? parseFloat(e.target.value) : e.target.value.trim();
          scope.set(e.target.getAttribute(scope.attr), val);
          this.applyChange();
        });
      });
    });

    // Icon grids (look scope)
    container.querySelectorAll('.icon-select-grid[data-look-icons]').forEach(grid => {
      const key = grid.dataset.lookIcons;
      grid.querySelectorAll('.icon-select-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.preventDefault();
          grid.querySelectorAll('.icon-select-btn').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          this.setLook(key, btn.dataset.icon);
          this.applyChange();
        });
      });
    });

    // Background controls
    const bgUrl = container.querySelector('[data-bg-url]');
    const bgFile = container.querySelector('[data-bg-file]');
    const bgTiles = container.querySelectorAll('[data-bg-pick]');
    const syncTiles = (url) => bgTiles.forEach(t => t.classList.toggle('active', t.dataset.bgPick === url));

    bgTiles.forEach(tile => {
      tile.addEventListener('click', () => {
        const url = tile.dataset.bgPick;
        this.setLook('background', url);
        syncTiles(url);
        if (bgUrl) bgUrl.value = (url && !url.startsWith('data:')) ? '' : bgUrl.value;
        this.applyChange();
      });
    });
    if (bgUrl) {
      bgUrl.addEventListener('change', (e) => {
        const url = e.target.value.trim();
        this.setLook('background', url);
        syncTiles(url);
        this.applyChange();
      });
    }
    if (bgFile) {
      bgFile.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
          this.setLook('background', ev.target.result);
          syncTiles(ev.target.result);
          if (bgUrl) bgUrl.value = '';
          this.applyChange();
        };
        reader.readAsDataURL(file);
      });
    }

    // Action buttons (mode section)
    container.querySelectorAll('[data-action]').forEach(el => {
      el.addEventListener('click', (e) => {
        if (e.currentTarget.dataset.action === 'resetPatterns') {
          if (confirm('Reset the accumulated flight-path artwork?')) {
            const viz = window.theArtOfFlight?.visualizations?.patterns;
            if (viz) { viz.reset(); viz.savePaths?.(); }
          }
        }
      });
    });
  }

  // ─── App-facing helpers ─────────────────────────────────

  toggleInfo() {
    this.set('showInfoPanel', !this.get('showInfoPanel'));
    this.applyChange();
  }
}
