/**
 * Ripple Mode: wakes on dark water (threejs-components liquid)
 * Credit: Kevin Levron — CC BY-NC-SA 4.0
 * https://codepen.io/soju22/pen/wvyBorP
 *
 * Every aircraft disturbs the water directly: continuous addDrop() wakes
 * whose strength follows ground speed (still air = still water — which also
 * keeps the zero-velocity pixel-guard fixture stable), whose radius follows
 * altitude (high cruisers = wide faint swells, low traffic = tight sharp
 * wakes), and which deepen when an aircraft is descending. Interference
 * patterns between wakes are the point — the 'persistence' knob maps to the
 * sim's attenuation so ripples can linger and overlap.
 *
 * The old single "virtual cursor" + synthetic PointerEvent apparatus (one
 * aircraft at a time, focus-slew streaks across the screen) is gone; the
 * lib's addDrop API is called directly in normalized [-1,1] coords.
 *
 * The water texture is generated from the palette ramp (deep-night pools of
 * the palette's own light), regenerated on palette swap; a user background
 * image overrides it as the liquid surface.
 */
class RippleVisualization extends AircraftVisualization {
  constructor(canvas, ctx) {
    super(canvas, ctx);
    this.rippleCanvas = document.getElementById('rippleCanvas');
    this.rippleLayer = document.getElementById('rippleLayer');
    this.liquidApp = null;
    this.initialized = false;
    this.active = false;
    this._dropOffset = 0;
    this._raining = false;
    this._baseAttenuation = null;

    Object.assign(this.options, {
      backgroundImage: '',
      displacementScale: 5,
      metalness: 0.75,
      roughness: 0.25,
      persistence: 0.5
    });
  }

  get extraOptionKeys() {
    return ['displacementScale', 'metalness', 'roughness', 'persistence'];
  }

  onOptionsChanged(options) {
    // Live-update material properties
    if (this.liquidApp?.liquidPlane) {
      this.liquidApp.liquidPlane.material.metalness = this.options.metalness;
      this.liquidApp.liquidPlane.material.roughness = this.options.roughness;
      if (this.liquidApp.liquidPlane.uniforms?.displacementScale) {
        this.liquidApp.liquidPlane.uniforms.displacementScale.value = this.options.displacementScale;
      }
      this._applyPersistence();
    }

    // Handle background image as liquid texture (clearing it reverts to the
    // palette-tinted dark-water texture)
    if (options.backgroundImage !== undefined && options.backgroundImage !== this._appliedBackground) {
      this._appliedBackground = options.backgroundImage;
      if (this.liquidApp) {
        this.liquidApp.loadImage(options.backgroundImage || this._darkWaterTexture());
      }
    }
  }

  onPaletteChanged() {
    if (this.liquidApp && !this.options.backgroundImage) {
      this.liquidApp.loadImage(this._darkWaterTexture());
    }
  }

  /**
   * persistence 0..1 → sim attenuation. 0.5 keeps the library default;
   * higher lets ripples ring and interfere, lower calms the water fast.
   * The attenuation semantic is "damping per step, just below 1", so we
   * scale its distance from 1 and clamp away from runaway.
   */
  _applyPersistence() {
    try {
      const lp = this.liquidApp?.liquidPlane;
      if (!lp || lp.attenuation === undefined) return;
      if (this._baseAttenuation == null) this._baseAttenuation = lp.attenuation;
      const gap = 1 - this._baseAttenuation;
      const factor = 2 - 2 * this.options.persistence; // 1.0 at p=.5, 0 at p=1
      lp.attenuation = Math.min(0.9995, 1 - gap * Math.max(0.15, factor));
    } catch (e) { /* vendored internals — degrade silently */ }
  }

  isActive() { return this.active; }

  showRipples() {
    if (this.rippleLayer) this.rippleLayer.style.display = 'block';
    this.active = true;

    if (!this.initialized) {
      this.initLiquid();
    }
  }

  hideRipples() {
    if (this.rippleLayer) this.rippleLayer.style.display = 'none';
    this.active = false;
  }

  async initLiquid() {
    if (!this.rippleCanvas) {
      console.warn('Ripple canvas not found');
      return;
    }

    try {
      // Block real mouse/pointer/touch events at WINDOW level BEFORE library
      // init — the lib listens for trusted pointer events on the document and
      // a wandering mouse must not disturb the artwork.
      this._blockMouseEvents();

      // Vendored locally (was cdn.jsdelivr.net) — a 24/7 kiosk must not
      // depend on a CDN being reachable to render its primary mode
      const { default: LiquidBackground } = await import('/vendor/threejs-components/liquid1.min.js');

      this.liquidApp = LiquidBackground(this.rippleCanvas);

      // Liquid surface texture: the user's image, or the palette-tinted
      // deep-night water. Without any texture the library renders a stark
      // white liquid — the worst possible default for a dark ambient display.
      this._appliedBackground = this.options.backgroundImage || '';
      this.liquidApp.loadImage(this.options.backgroundImage || this._darkWaterTexture());

      this.liquidApp.liquidPlane.material.metalness = this.options.metalness;
      this.liquidApp.liquidPlane.material.roughness = this.options.roughness;
      this.liquidApp.liquidPlane.uniforms.displacementScale.value = this.options.displacementScale;
      this.liquidApp.setRain(false);
      this._applyPersistence();

      // Also force pointer-events:none on the canvas itself
      this.rippleCanvas.style.pointerEvents = 'none';

      this.initialized = true;
      console.log('Liquid Background initialized');
    } catch (e) {
      console.error('Failed to initialize Liquid Background:', e);
      this.initialized = false;
    }
  }

  /**
   * Generated deep-night water texture, tinted from the palette ramp —
   * pools of the palette's own light catching the displacement. No external
   * asset, kiosk-safe.
   */
  _darkWaterTexture() {
    const ramp = this.palette?.ramp || ['#071019', '#0e3a40', '#16847e', '#52e0c4', '#b79cff'];
    const rgb = (hex) => `${parseInt(hex.slice(1, 3), 16)}, ${parseInt(hex.slice(3, 5), 16)}, ${parseInt(hex.slice(5, 7), 16)}`;

    const c = document.createElement('canvas');
    c.width = c.height = 1024;
    const g = c.getContext('2d');

    const base = g.createRadialGradient(512, 400, 80, 512, 512, 780);
    base.addColorStop(0, `rgba(${rgb(ramp[1])}, 1)`);
    base.addColorStop(0.55, `rgba(${rgb(ramp[0])}, 1)`);
    base.addColorStop(1, '#020407');
    g.fillStyle = base;
    g.fillRect(0, 0, 1024, 1024);

    // Glow pools — luminance variation is what makes the liquid's
    // displacement visibly catch light
    const pools = [
      { x: 280, y: 300, r: 340, color: `rgba(${rgb(ramp[2])}, 0.40)` },
      { x: 760, y: 640, r: 400, color: `rgba(${rgb(ramp[4])}, 0.22)` },
      { x: 560, y: 180, r: 260, color: `rgba(${rgb(ramp[3])}, 0.26)` },
      { x: 180, y: 800, r: 300, color: `rgba(${rgb(ramp[2])}, 0.20)` }
    ];
    for (const p of pools) {
      const glow = g.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r);
      glow.addColorStop(0, p.color);
      glow.addColorStop(1, 'rgba(0, 0, 0, 0)');
      g.fillStyle = glow;
      g.fillRect(0, 0, 1024, 1024);
    }

    return c.toDataURL('image/png');
  }

  _blockMouseEvents() {
    // Block all trusted pointer/mouse/touch events at the window capture phase
    // when ripple mode is active. Programmatic events (isTrusted=false) pass through.
    const eventTypes = ['pointermove', 'pointerdown', 'pointerup',
                        'mousemove', 'mousedown', 'mouseup',
                        'touchmove', 'touchstart', 'touchend'];

    this._windowBlockers = [];
    eventTypes.forEach(type => {
      const blocker = (e) => {
        if (!this.active || !e.isTrusted) return;
        // Don't block UI elements (settings panel, hint pill, inputs, etc.)
        if (e.target && e.target.closest &&
            e.target.closest('#settingsPanel, .hint-pill, .info-overlay, button, input, select, textarea, label, a')) {
          return;
        }
        e.stopImmediatePropagation();
      };
      window.addEventListener(type, blocker, { capture: true });
      this._windowBlockers.push({ type, blocker });
    });
  }

  _removeMouseBlockers() {
    if (this._windowBlockers) {
      this._windowBlockers.forEach(({ type, blocker }) => {
        window.removeEventListener(type, blocker, { capture: true });
      });
      this._windowBlockers = null;
    }
  }

  destroyLiquid() {
    if (this.liquidApp) {
      try {
        if (this.liquidApp.dispose) this.liquidApp.dispose();
      } catch (e) { /* ok */ }
    }
    this.liquidApp = null;
    this.initialized = false;
    this._baseAttenuation = null;
    this._raining = false;
    this._removeMouseBlockers();
  }

  /** Every aircraft wakes the water — drops fed straight into the sim */
  onActiveAircraft(activeAircraft, now) {
    if (!this.initialized || !this.liquidApp?.liquidPlane?.addDrop) return;

    // Idle life: with an empty sky, sparse ambient rain keeps the surface
    // alive overnight (never under the deterministic pixel guard)
    const wantRain = activeAircraft.length === 0 && !window.__DETERMINISTIC__;
    if (wantRain !== this._raining) {
      this._raining = wantRain;
      try {
        this.liquidApp.setRain(wantRain);
        if (wantRain && this.liquidApp.setRainTime) this.liquidApp.setRainTime(3.5);
      } catch (e) { /* ok */ }
    }
    if (!activeAircraft.length) return;

    const w = this.rippleCanvas.clientWidth || window.innerWidth;
    const h = this.rippleCanvas.clientHeight || window.innerHeight;

    // Cap sim work per frame; rotate so every aircraft still wakes the
    // water several times a second at full traffic
    const cap = Math.min(activeAircraft.length, 16);
    this._dropOffset = (this._dropOffset + cap) % activeAircraft.length;

    for (let i = 0; i < cap; i++) {
      const ac = activeAircraft[(this._dropOffset + i) % activeAircraft.length];
      const v = ac.velocity || 0;
      if (v <= 1) continue; // still aircraft leave still water (fixture-safe)

      const fade = ac.flight?.opacity ?? 1;
      const altT = Math.min((ac.altitude || 0) / 38000, 1);
      const descending = (ac.flight?.verticalRate ?? 0) < -300;

      // Speed → strength, altitude → radius, descent → weight
      let strength = (0.0008 + Math.min(v / 500, 1) * 0.0030) * fade;
      if (descending) strength *= 1.45;
      const radius = 0.014 + altT * 0.030;

      const nx = (ac.x / w) * 2 - 1;
      const ny = -((ac.y / h) * 2 - 1);
      this.liquidApp.liquidPlane.addDrop(nx, ny, radius, strength);
    }
  }

  clear() {
    super.clear();
    this.destroyLiquid();
    this.hideRipples();
  }
}
