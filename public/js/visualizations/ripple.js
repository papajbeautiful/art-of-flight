/**
 * Ripple Mode: Liquid Background (threejs-components)
 * Aircraft trigger displacement on a full-screen liquid WebGL layer
 * Credit: Kevin Levron — CC BY-NC-SA 4.0
 * https://codepen.io/soju22/pen/wvyBorP
 */
class RippleVisualization extends AircraftVisualization {
  constructor(canvas, ctx) {
    super(canvas, ctx);
    this.rippleCanvas = document.getElementById('rippleCanvas');
    this.rippleLayer = document.getElementById('rippleLayer');
    this.liquidApp = null;
    this.initialized = false;
    this.active = false;

    // Virtual pointer — smoothly follows aircraft
    this.virtualX = null;
    this.virtualY = null;
    this.focusIndex = 0;
    this.focusStartTime = 0;

    Object.assign(this.options, {
      backgroundImage: '',
      displacementScale: 5,
      metalness: 0.75,
      roughness: 0.25,
      focusDuration: 3000,
      trackingSpeed: 0.25,
      trackAllAircraft: false
    });
  }

  get extraOptionKeys() {
    return ['displacementScale', 'metalness', 'roughness', 'focusDuration',
            'trackingSpeed', 'trackAllAircraft'];
  }

  onOptionsChanged(options) {
    // Live-update material properties
    if (this.liquidApp?.liquidPlane) {
      this.liquidApp.liquidPlane.material.metalness = this.options.metalness;
      this.liquidApp.liquidPlane.material.roughness = this.options.roughness;
      if (this.liquidApp.liquidPlane.uniforms?.displacementScale) {
        this.liquidApp.liquidPlane.uniforms.displacementScale.value = this.options.displacementScale;
      }
    }

    // Handle background image as liquid texture (clearing it reverts to the
    // generated dark-water texture)
    if (options.backgroundImage !== undefined && options.backgroundImage !== this.options.backgroundImage) {
      this.options.backgroundImage = options.backgroundImage;
      if (this.liquidApp) {
        this.liquidApp.loadImage(options.backgroundImage || this._darkWaterTexture());
      }
    }
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
      // Block real mouse/pointer/touch events at WINDOW level BEFORE library init.
      // The library may register event handlers on window/document during init.
      // By adding our capture-phase handler first, we can block trusted events.
      this._blockMouseEvents();

      // Vendored locally (was cdn.jsdelivr.net) — a 24/7 kiosk must not
      // depend on a CDN being reachable to render its primary mode
      const { default: LiquidBackground } = await import('/vendor/threejs-components/liquid1.min.js');

      this.liquidApp = LiquidBackground(this.rippleCanvas);

      // Liquid surface texture: the user's image, or a generated deep-night
      // gradient. Without any texture the library renders a stark white
      // liquid — the worst possible default for a dark ambient display.
      if (this.options.backgroundImage) {
        this.liquidApp.loadImage(this.options.backgroundImage);
      } else {
        this.liquidApp.loadImage(this._darkWaterTexture());
      }

      this.liquidApp.liquidPlane.material.metalness = this.options.metalness;
      this.liquidApp.liquidPlane.material.roughness = this.options.roughness;
      this.liquidApp.liquidPlane.uniforms.displacementScale.value = this.options.displacementScale;
      this.liquidApp.setRain(false);

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
   * Generated deep-night water texture (radial gradient with faint nebula
   * accents) — no external asset, kiosk-safe.
   */
  _darkWaterTexture() {
    const c = document.createElement('canvas');
    c.width = c.height = 1024;
    const g = c.getContext('2d');

    const base = g.createRadialGradient(512, 400, 80, 512, 512, 780);
    base.addColorStop(0, '#1c2f52');
    base.addColorStop(0.5, '#0c1730');
    base.addColorStop(1, '#040810');
    g.fillStyle = base;
    g.fillRect(0, 0, 1024, 1024);

    // Cool glow pools — luminance variation is what makes the liquid's
    // displacement visibly catch light
    const pools = [
      { x: 280, y: 300, r: 340, color: 'rgba(50, 110, 200, 0.45)' },
      { x: 760, y: 640, r: 400, color: 'rgba(90, 60, 190, 0.35)' },
      { x: 560, y: 180, r: 260, color: 'rgba(0, 190, 215, 0.30)' },
      { x: 180, y: 800, r: 300, color: 'rgba(20, 140, 170, 0.25)' }
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
        // Don't block UI elements (settings, mode selector, buttons, etc.)
        if (e.target && e.target.closest &&
            e.target.closest('#settingsPanel, .settings-btn, .mode-selector, .info-overlay, button, input, select, textarea, label, a')) {
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
    this.virtualX = null;
    this.virtualY = null;
    this._removeMouseBlockers();
  }

  /** Drive the liquid effect with virtual pointer(s) */
  onActiveAircraft(activeAircraft, now) {
    if (activeAircraft.length === 0 || !this.initialized || !this.rippleCanvas) return;

    const rect = this.rippleCanvas.getBoundingClientRect();

    if (this.options.trackAllAircraft) {
      // Round-robin cap: an event per aircraft per frame is a perf footgun
      // at 50+ aircraft (3000+ synthetic events/sec through the WebGL lib).
      // 12/frame still touches every aircraft several times a second.
      const cap = Math.min(activeAircraft.length, 12);
      this._trackAllOffset = ((this._trackAllOffset || 0) + cap) % activeAircraft.length;
      for (let i = 0; i < cap; i++) {
        const ac = activeAircraft[(this._trackAllOffset + i) % activeAircraft.length];
        this.rippleCanvas.dispatchEvent(new PointerEvent('pointermove', {
          clientX: ac.x + rect.left,
          clientY: ac.y + rect.top,
          bubbles: true
        }));
      }
    } else {
      // Single smooth virtual pointer cycling through aircraft
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

      this.rippleCanvas.dispatchEvent(new PointerEvent('pointermove', {
        clientX: this.virtualX + rect.left,
        clientY: this.virtualY + rect.top,
        bubbles: true
      }));
    }
  }

  clear() {
    super.clear();
    this.destroyLiquid();
    this.hideRipples();
  }
}
