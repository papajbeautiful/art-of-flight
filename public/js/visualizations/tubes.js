/**
 * Tubes Mode: Neon 3D Tubes Cursor Trail
 * Aircraft positions drive glowing 3D tube trails via WebGL
 * Credit: Kevin Levron — MIT License
 * https://codepen.io/soju22/pen/qEbdVjK
 */
class TubesVisualization extends AircraftVisualization {
  constructor(canvas, ctx) {
    super(canvas, ctx);
    this.tubesLayer = document.getElementById('tubesLayer');
    this.tubesCanvas = document.getElementById('tubesCanvas');
    this.tubesApp = null;
    this.initialized = false;
    this.active = false;
    this.virtualX = null;
    this.virtualY = null;
    this.focusIndex = 0;
    this.focusStartTime = 0;

    Object.assign(this.options, {
      tubeColor1: '#f967fb',
      tubeColor2: '#53bc28',
      tubeColor3: '#6958d5',
      lightColor1: '#83f36e',
      lightColor2: '#fe8a2e',
      lightColor3: '#ff008a',
      lightColor4: '#60aed5',
      lightIntensity: 200,
      focusDuration: 3000,
      trackingSpeed: 0.03,
      trackAllAircraft: false,
      accentColor: '#F967FB'
    });
  }

  get extraOptionKeys() {
    return ['tubeColor1', 'tubeColor2', 'tubeColor3',
            'lightColor1', 'lightColor2', 'lightColor3', 'lightColor4',
            'lightIntensity', 'focusDuration', 'trackingSpeed', 'trackAllAircraft'];
  }

  isActive() { return this.active; }

  show() {
    if (this.tubesLayer) this.tubesLayer.style.display = 'block';
    this.active = true;

    if (!this.initialized) {
      this.initTubes();
    }
  }

  hide() {
    if (this.tubesLayer) this.tubesLayer.style.display = 'none';
    this.active = false;
  }

  async initTubes() {
    if (!this.tubesCanvas) {
      console.warn('Tubes canvas not found');
      return;
    }

    try {
      // Vendored locally (was cdn.jsdelivr.net) — kiosk must not depend on a CDN
      const { default: TubesCursor } = await import('/vendor/threejs-components/tubes1.min.js');

      this.tubesApp = TubesCursor(this.tubesCanvas, {
        tubes: {
          colors: [this.options.tubeColor1, this.options.tubeColor2, this.options.tubeColor3],
          lights: {
            intensity: this.options.lightIntensity,
            colors: [this.options.lightColor1, this.options.lightColor2, this.options.lightColor3, this.options.lightColor4]
          }
        }
      });

      // Block real mouse — intercept trusted events, allow programmatic ones
      this.tubesCanvas.addEventListener('pointermove', (e) => {
        if (e.isTrusted) e.stopImmediatePropagation();
      }, { capture: true });
      this.tubesCanvas.addEventListener('pointerdown', (e) => {
        if (e.isTrusted) e.stopImmediatePropagation();
      }, { capture: true });
      this.tubesCanvas.addEventListener('pointerup', (e) => {
        if (e.isTrusted) e.stopImmediatePropagation();
      }, { capture: true });

      this.initialized = true;
      console.log('Tubes visualization initialized');
    } catch (e) {
      console.error('Failed to initialize Tubes:', e);
      this.initialized = false;
    }
  }

  destroyTubes() {
    if (this.tubesApp) {
      try {
        if (this.tubesApp.dispose) this.tubesApp.dispose();
      } catch (e) { /* ok */ }
    }
    this.tubesApp = null;
    this.initialized = false;
    this.virtualX = null;
    this.virtualY = null;
  }

  /** Drive tubes with virtual pointer(s) */
  onActiveAircraft(activeAircraft, now) {
    if (activeAircraft.length === 0 || !this.initialized || !this.tubesCanvas) return;

    const rect = this.tubesCanvas.getBoundingClientRect();

    if (this.options.trackAllAircraft) {
      for (const ac of activeAircraft) {
        this.tubesCanvas.dispatchEvent(new PointerEvent('pointermove', {
          clientX: ac.x + rect.left,
          clientY: ac.y + rect.top,
          bubbles: true
        }));
      }
    } else {
      if (!this.focusStartTime || now - this.focusStartTime > this.options.focusDuration) {
        this.focusIndex = (this.focusIndex + 1) % activeAircraft.length;
        this.focusStartTime = now;
      }

      const target = activeAircraft[this.focusIndex % activeAircraft.length];

      if (this.virtualX == null) {
        this.virtualX = target.x;
        this.virtualY = target.y;
      }

      this.virtualX += (target.x - this.virtualX) * this.options.trackingSpeed;
      this.virtualY += (target.y - this.virtualY) * this.options.trackingSpeed;

      this.tubesCanvas.dispatchEvent(new PointerEvent('pointermove', {
        clientX: this.virtualX + rect.left,
        clientY: this.virtualY + rect.top,
        bubbles: true
      }));
    }
  }

  clear() {
    super.clear();
    this.destroyTubes();
    this.hide();
  }
}
