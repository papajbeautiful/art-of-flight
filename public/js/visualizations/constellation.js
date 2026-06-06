/**
 * Wave Mode: Interactive Line Text Distortion
 * Aircraft positions distort horizontal lines across the screen
 * Credit: BL/S® Studio — MIT License
 * https://codepen.io/blacklead-studio/pen/azOzePJ
 */
class ConstellationVisualization extends AircraftVisualization {
  constructor(canvas, ctx) {
    super(canvas, ctx);
    this.waveLayer = document.getElementById('waveLayer');
    this.waveCanvas = document.getElementById('waveCanvas');
    this.waveCtx = null;
    this.lines = [];
    this.initialized = false;
    this.active = false;
    this.animFrame = null;

    Object.assign(this.options, {
      lineCount: 200,
      lineColor: '#ffdfc4',
      lineWidth: 0.5,
      distortRadius: 100,
      distortStrength: 10,
      springBack: 0.1,
      dotSize: 18,
      accentColor: '#FFDFC4'
    });
  }

  get extraOptionKeys() {
    return ['lineColor', 'lineWidth', 'distortRadius', 'distortStrength', 'springBack'];
  }

  onOptionsChanged(options) {
    if (options.lineCount !== undefined) {
      this.options.lineCount = options.lineCount;
      if (this.initialized) this.initLines();
    }
  }

  isActive() { return this.active; }

  show() {
    if (this.waveLayer) this.waveLayer.style.display = 'block';
    this.active = true;

    if (!this.initialized) {
      this.initWaveCanvas();
    }
    this.startAnimation();
  }

  hide() {
    if (this.waveLayer) this.waveLayer.style.display = 'none';
    this.active = false;
    this.stopAnimation();
  }

  initWaveCanvas() {
    if (!this.waveCanvas) return;

    this.waveCtx = this.waveCanvas.getContext('2d');
    this.resizeWave();
    this.initLines();
    this.initialized = true;

    this._resizeHandler = () => {
      if (this.active) {
        this.resizeWave();
        this.initLines();
      }
    };
    window.addEventListener('resize', this._resizeHandler);

    console.log('Wave visualization initialized');
  }

  resizeWave() {
    if (!this.waveCanvas) return;
    const dpr = window.devicePixelRatio || 1;
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.waveCanvas.width = w * dpr;
    this.waveCanvas.height = h * dpr;
    this.waveCanvas.style.width = w + 'px';
    this.waveCanvas.style.height = h + 'px';
    if (this.waveCtx) {
      this.waveCtx.setTransform(1, 0, 0, 1, 0, 0);
      this.waveCtx.scale(dpr, dpr);
    }
  }

  initLines() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const linesCount = this.options.lineCount;
    const lineHeight = h / linesCount;
    const cellWidth = 5;
    const cols = Math.floor(w / cellWidth);

    this.lines = [];
    for (let i = 0; i < linesCount; i++) {
      const y = i * lineHeight;
      const line = [];

      for (let j = 0; j < cols; j++) {
        const x = j * cellWidth;
        line.push({
          x,
          y,
          baseX: x,
          baseY: y
        });
      }
      this.lines.push(line);
    }
  }

  updateLines() {
    const radius = this.options.distortRadius;
    const maxSpeed = this.options.distortStrength;
    const spring = this.options.springBack;

    // Collect active aircraft positions
    const positions = [];
    for (const [id, aircraft] of this.aircraftPositions.entries()) {
      if (aircraft.altitude <= 0 && !this.options.showGroundAircraft) continue;
      positions.push({ x: aircraft.x, y: aircraft.y, velocity: aircraft.velocity });
    }

    // Hot loop: lines x cols x aircraft. Cheap box-reject before the sqrt,
    // and dx/dist replaces cos(atan2()) — same math, no trig. This was the
    // single most expensive computation in the app (millions of sqrt+atan2
    // per frame at high line counts).
    const radiusSq = radius * radius;

    this.lines.forEach(line => {
      line.forEach(point => {
        for (const pos of positions) {
          const dx = point.x - pos.x;
          if (dx > radius || dx < -radius) continue;
          const dy = point.y - pos.y;
          if (dy > radius || dy < -radius) continue;
          const distSq = dx * dx + dy * dy;
          if (distSq >= radiusSq) continue;

          const distance = Math.sqrt(distSq);
          const force = (radius - distance) / radius;
          const speed = maxSpeed * (1 + (pos.velocity || 0) / 500);
          const scale = distance > 0 ? (force * speed) / distance : 0;

          point.x += dx * scale;
          point.y += dy * scale;
        }

        const springX = (point.baseX - point.x) * spring;
        const springY = (point.baseY - point.y) * spring;
        point.x += springX;
        point.y += springY;
      });
    });
  }

  drawLines() {
    if (!this.waveCtx) return;

    const ctx = this.waveCtx;
    const w = window.innerWidth;
    const h = window.innerHeight;

    ctx.clearRect(0, 0, w, h);

    this.lines.forEach(line => {
      if (line.length < 2) return;

      ctx.beginPath();
      ctx.moveTo(line[0].x, line[0].y);

      for (let i = 1; i < line.length; i++) {
        const prev = line[i - 1];
        const current = line[i];
        const midX = (prev.x + current.x) / 2;
        const midY = (prev.y + current.y) / 2;
        ctx.quadraticCurveTo(prev.x, prev.y, midX, midY);
      }

      ctx.strokeStyle = this.options.lineColor;
      ctx.lineWidth = this.options.lineWidth;
      ctx.stroke();
    });
  }

  startAnimation() {
    if (this.animFrame) return;
    const animate = () => {
      this.updateLines();
      this.drawLines();
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

  clear() {
    super.clear();
    this.lines = [];
    this.hide();
  }
}
