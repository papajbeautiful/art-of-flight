/**
 * Grid Mode: Neural Grid Cursor Reveal with Auto Fade
 * Aircraft positions light up neon grid cells that fade over time
 * Credit: Gaurav Gajjar — MIT License
 * https://codepen.io/gauravgajjar/pen/azvvWPx
 */
class BirdsVisualization extends AircraftVisualization {
  constructor(canvas, ctx) {
    super(canvas, ctx);
    this.gridLayer = document.getElementById('gridLayer');
    this.gridCanvas = document.getElementById('gridCanvas');
    this.gridCtx = null;
    this.grid = [];
    this.initialized = false;
    this.active = false;
    this.animFrame = null;

    Object.assign(this.options, {
      squareSize: 10,
      glowColor: '#00FFCC',
      fadeDelay: 500,
      fadeSpeed: 0.02,
      accentColor: '#00FFCC'
    });

    // Cached RGB string for grid drawing
    this._glowRgb = '0, 255, 204';
  }

  get extraOptionKeys() {
    return ['fadeDelay', 'fadeSpeed'];
  }

  onOptionsChanged(options) {
    if (options.squareSize !== undefined) {
      this.options.squareSize = options.squareSize;
      if (this.initialized) this.initGrid();
    }
    if (options.glowColor !== undefined) {
      this.options.glowColor = options.glowColor;
      const rgb = hexToRgbIcon(options.glowColor);
      this._glowRgb = `${rgb.r}, ${rgb.g}, ${rgb.b}`;
    }
  }

  isActive() { return this.active; }

  show() {
    if (this.gridLayer) this.gridLayer.style.display = 'block';
    this.active = true;

    if (!this.initialized) {
      this.initGridCanvas();
    }
    this.startAnimation();
  }

  hide() {
    if (this.gridLayer) this.gridLayer.style.display = 'none';
    this.active = false;
    this.stopAnimation();
  }

  initGridCanvas() {
    if (!this.gridCanvas) return;

    this.gridCtx = this.gridCanvas.getContext('2d');
    this.resizeGrid();
    this.initGrid();
    this.initialized = true;

    this._resizeHandler = () => {
      if (this.active) {
        this.resizeGrid();
        this.initGrid();
      }
    };
    window.addEventListener('resize', this._resizeHandler);

    console.log('Grid visualization initialized');
  }

  resizeGrid() {
    if (!this.gridCanvas) return;
    // Hi-DPI backing store; drawing stays in CSS pixels (matches constellation)
    const dpr = window.devicePixelRatio || 1;
    this.gridCanvas.width = Math.round(window.innerWidth * dpr);
    this.gridCanvas.height = Math.round(window.innerHeight * dpr);
    if (!this.gridCtx) this.gridCtx = this.gridCanvas.getContext('2d');
    this.gridCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  initGrid() {
    this.grid = [];
    const w = window.innerWidth;
    const h = window.innerHeight;
    const size = this.options.squareSize;

    for (let x = 0; x < w; x += size) {
      for (let y = 0; y < h; y += size) {
        this.grid.push({
          x,
          y,
          alpha: 0,
          fading: false,
          lastTouched: 0
        });
      }
    }
  }

  getCellAt(x, y) {
    const size = this.options.squareSize;
    const col = Math.floor(x / size);
    const row = Math.floor(y / size);
    // Grid is filled column-major in initGrid (outer x, inner y) — rows per
    // column must use the same CSS-pixel height initGrid used.
    const idx = col * Math.ceil(window.innerHeight / size) + row;
    return this.grid[idx] || null;
  }

  lightUpCell(x, y) {
    const cell = this.getCellAt(x, y);
    if (cell && cell.alpha === 0) {
      cell.alpha = 1;
      cell.lastTouched = Date.now();
      cell.fading = false;
    }
  }

  startAnimation() {
    if (this.animFrame) return;
    const animate = () => {
      this.drawGrid();
      this.animFrame = requestAnimationFrame(animate);
    };
    this.animFrame = requestAnimationFrame(animate);
  }

  stopAnimation() {
    if (this.animFrame) {
      cancelAnimationFrame(this.animFrame);
      this.animFrame = null;
    }
  }

  drawGrid() {
    if (!this.gridCtx || !this.gridCanvas) return;

    const ctx = this.gridCtx;
    const w = window.innerWidth;
    const h = window.innerHeight;
    const size = this.options.squareSize;
    const color = this._glowRgb;
    const now = Date.now();

    ctx.clearRect(0, 0, w, h);

    for (let i = 0; i < this.grid.length; i++) {
      const cell = this.grid[i];

      if (cell.alpha > 0 && !cell.fading && now - cell.lastTouched > this.options.fadeDelay) {
        cell.fading = true;
      }

      if (cell.fading) {
        cell.alpha -= this.options.fadeSpeed;
        if (cell.alpha <= 0) {
          cell.alpha = 0;
          cell.fading = false;
        }
      }

      if (cell.alpha > 0) {
        const centerX = cell.x + size / 2;
        const centerY = cell.y + size / 2;

        const gradient = ctx.createRadialGradient(
          centerX, centerY, 5,
          centerX, centerY, size
        );
        gradient.addColorStop(0, `rgba(${color}, ${cell.alpha})`);
        gradient.addColorStop(1, `rgba(${color}, 0)`);

        ctx.strokeStyle = gradient;
        ctx.lineWidth = 1.3;
        ctx.strokeRect(cell.x + 0.5, cell.y + 0.5, size - 1, size - 1);
      }
    }
  }

  /** Light up grid cells under each visible aircraft */
  onActiveAircraft(activeAircraft, now) {
    for (const aircraft of activeAircraft) {
      this.lightUpCell(aircraft.x, aircraft.y);
    }
  }

  clear() {
    super.clear();
    this.grid = [];
    this.hide();
  }
}
