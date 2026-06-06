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

    // Handle background image as liquid texture
    if (options.backgroundImage !== undefined) {
      this.options.backgroundImage = options.backgroundImage;
      if (this.liquidApp && options.backgroundImage) {
        this.liquidApp.loadImage(options.backgroundImage);
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

      // Use user's background image as liquid texture, or skip for plain dark surface
      if (this.options.backgroundImage) {
        this.liquidApp.loadImage(this.options.backgroundImage);
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
      // Dispatch a pointermove for each aircraft every frame
      for (const ac of activeAircraft) {
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
