/**
 * Departures Mode: split-flap airport board
 *
 * A DOM component, not a canvas mode — it consumes the flight LIST rather
 * than screen positions, so it deliberately does NOT extend
 * AircraftVisualization. It implements the same outer interface
 * (setDisplayOptions / setPalette / show / hide / update / draw / clear)
 * so app.js treats it like any other mode.
 *
 * The board is a machine, not a table: every character sits on its own
 * flap plate (dark gradient, split line, 1ch fixed width) under a
 * perspective transform; changed characters spin through a couple of
 * intermediate glyphs with a left-to-right cascade before settling, the
 * way a Solari board hunts for its letter. ALT rounds to 100 ft and SPD
 * to 5 kt before diffing so live data doesn't keep the board in permanent
 * churn. A flap clock and the configured location name anchor the header.
 *
 * Determinism: under window.__DETERMINISTIC__ the clock reads 00:00 and
 * the idle courtesy flips never fire — first-time cell fills skip the
 * flip (prev === undefined), so the static fixture renders at rest.
 */
class DeparturesVisualization {
  constructor(canvas, ctx) {
    this.canvas = canvas;
    this.ctx = ctx;
    this.layer = document.getElementById('departuresLayer');
    this.board = document.getElementById('departuresBoard');
    this.active = false;

    this.options = {
      maxRows: 10,
      showStatus: true,
      flipStagger: true,
      showGroundAircraft: false
    };
    this.palette = (typeof PALETTES !== 'undefined') ? PALETTES.ember : null;

    this._lastRefresh = 0;
    this._rowEls = new Map();   // icao24 -> row element
    this._cellText = new Map(); // icao24|col -> last text
    this._clockEl = null;
  }

  /** Solari character drum — intermediates are picked along this ring */
  static CHARSET = ' ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789→—.,:';

  setDisplayOptions(options) {
    if (!options) return;
    ['maxRows', 'showStatus', 'flipStagger', 'showGroundAircraft'].forEach(k => {
      if (options[k] !== undefined) this.options[k] = options[k];
    });
  }

  setPalette(palette) {
    if (!palette) return;
    this.palette = palette;
    if (this.layer) {
      this.layer.style.setProperty('--board-color', palette.primary);
      this.layer.style.setProperty('--board-in', palette.inbound);
      this.layer.style.setProperty('--board-out', palette.outbound);
    }
  }

  show() {
    if (this.layer) this.layer.style.display = 'flex';
    this.active = true;
    // The board is a place: the header carries the configured location
    const subtitle = this.layer?.querySelector('.board-subtitle');
    const name = window.theArtOfFlight?.settingsManager?.settings?.locationName;
    if (subtitle && name) subtitle.textContent = name.toUpperCase();
    this._ensureClock();
  }

  hide() {
    if (this.layer) this.layer.style.display = 'none';
    this.active = false;
  }

  // ── Split-flap machinery ──────────────────────────────────

  _ensureClock() {
    if (this._clockEl || !this.layer) return;
    const header = this.layer.querySelector('.board-header');
    if (!header) return;
    this._clockEl = document.createElement('span');
    this._clockEl.className = 'board-clock';
    header.appendChild(this._clockEl);
  }

  _clockText() {
    if (window.__DETERMINISTIC__) return '00:00';
    const d = new Date();
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  }

  _buildChars(el, text) {
    el.replaceChildren();
    for (const ch of text) {
      const span = document.createElement('span');
      span.className = 'flap-char';
      span.textContent = ch === ' ' ? ' ' : ch;
      el.appendChild(span);
    }
  }

  /** Glyphs the drum shows on its way from one character to another */
  _cyclePath(from, to) {
    const CS = DeparturesVisualization.CHARSET;
    const a = CS.indexOf(from), b = CS.indexOf(to);
    if (a < 0 || b < 0) return [to];
    const dist = (b - a + CS.length) % CS.length;
    const steps = Math.min(3, Math.max(1, dist));
    const path = [];
    for (let s = 1; s < steps; s++) path.push(CS[(a + Math.round(dist * s / steps)) % CS.length]);
    path.push(to);
    return path;
  }

  _flapChar(span, ch) {
    span.classList.remove('flap-flip');
    void span.offsetWidth; // restart the animation
    span.classList.add('flap-flip');
    setTimeout(() => { span.textContent = ch === ' ' ? ' ' : ch; }, 150);
  }

  /** Set a cell's text, spinning changed characters with an L→R cascade */
  _setCell(rowId, el, col, text, baseDelay) {
    const key = `${rowId}|${col}`;
    const prev = this._cellText.get(key);
    if (prev === text) return;
    this._cellText.set(key, text);

    if (prev === undefined) {
      this._buildChars(el, text);
      return;
    }

    let spans = Array.from(el.children);
    if (spans.length !== text.length) {
      // Length changed: rebuild plates carrying over what we can, then spin
      const carried = prev.padEnd(text.length, ' ').slice(0, text.length);
      this._buildChars(el, carried);
      spans = Array.from(el.children);
    }

    for (let i = 0; i < text.length; i++) {
      const cur = spans[i].textContent === ' ' ? ' ' : spans[i].textContent;
      const to = text[i];
      if (cur === to) continue;
      const path = this._cyclePath(cur, to);
      path.forEach((ch, s) => {
        setTimeout(() => {
          if (spans[i].isConnected) this._flapChar(spans[i], ch);
        }, baseDelay + i * 40 + s * 95);
      });
    }
  }

  // ── Data shaping ──────────────────────────────────────────

  /** Same predicate drives the GROUND status tag and the hide-grounded filter */
  _isGround(flight) {
    return flight.onGround || (flight.altitudeFeet ?? 0) <= 0;
  }

  /** Direction tag from the shared inbound heuristic */
  _status(flight) {
    if (this._isGround(flight)) return 'GROUND';
    const inbound = window.theArtOfFlight?.isInbound?.(flight);
    if (inbound === true) return 'INBOUND';
    if ((flight.distance ?? 99) < 5) return 'OVERHEAD';
    return 'OUTBOUND';
  }

  _rowData(flight) {
    const route = (flight.originCity || flight.destinationCity)
      ? `${(flight.originCity || '———').toUpperCase()} → ${(flight.destinationCity || '———').toUpperCase()}`
      : '—';
    // Round before diffing: jittering live data must not churn the board
    const alt = flight.altitudeFeet != null ? Math.round(flight.altitudeFeet / 100) * 100 : null;
    const spd = flight.velocityKnots != null ? Math.round(flight.velocityKnots / 5) * 5 : null;
    return {
      callsign: flight.callsign || '———',
      airline: (flight.airlineName || flight.aircraftType || '—').toUpperCase(),
      route: route,
      alt: alt != null ? `${alt.toLocaleString()}FT` : '—',
      spd: spd != null ? `${spd}KT` : '—',
      status: this._status(flight)
    };
  }

  update(flights) {
    if (!this.active || !this.board) return;

    // The board is data-driven, not frame-driven — refresh at most 1/sec
    const now = Date.now();
    if (now - this._lastRefresh < 1000) return;
    this._lastRefresh = now;

    // Flap clock (spins on minute change)
    if (this._clockEl) {
      this._setCell('__clock', this._clockEl, 'clock', this._clockText(), 0);
    }

    const rows = flights
      // Some transponders broadcast garbage callsigns (e.g. '@@@@@@@@')
      .filter(f => f.callsign && f.callsign !== 'UNKNOWN' && /[A-Z0-9]/.test(f.callsign))
      .filter(f => this.options.showGroundAircraft || !this._isGround(f))
      .sort((a, b) => (a.distance ?? 999) - (b.distance ?? 999))
      .slice(0, this.options.maxRows);

    const liveIds = new Set(rows.map(f => f.icao24));

    // Remove departed rows
    for (const [id, el] of this._rowEls.entries()) {
      if (!liveIds.has(id)) {
        el.classList.add('board-row-exit');
        setTimeout(() => el.remove(), 500);
        this._rowEls.delete(id);
        for (const col of ['callsign', 'airline', 'route', 'alt', 'spd', 'status']) {
          this._cellText.delete(`${id}|${col}`);
        }
      }
    }

    // Add / update rows
    rows.forEach((flight, index) => {
      const id = flight.icao24;
      const data = this._rowData(flight);
      let row = this._rowEls.get(id);

      if (!row) {
        row = document.createElement('div');
        row.className = 'board-row board-row-enter';
        row.style.animationDelay = `${index * 0.06}s`;
        for (const col of ['callsign', 'airline', 'route', 'alt', 'spd', 'status']) {
          const cell = document.createElement('span');
          cell.className = `board-cell board-${col}`;
          cell.dataset.col = col;
          row.appendChild(cell);
        }
        this.board.appendChild(row);
        this._rowEls.set(id, row);
      }

      // Keep DOM order in sync with distance order
      const currentIndex = Array.prototype.indexOf.call(this.board.children, row);
      if (currentIndex !== index) {
        this.board.insertBefore(row, this.board.children[index] || null);
      }

      row.querySelectorAll('.board-cell').forEach((cell, cellIndex) => {
        const col = cell.dataset.col;
        if (col === 'status' && !this.options.showStatus) { cell.textContent = ''; return; }
        const flipDelay = this.options.flipStagger ? cellIndex * 70 : 0;
        this._setCell(id, cell, col, data[col], flipDelay);
        if (col === 'status') {
          cell.className = `board-cell board-status status-${data.status.toLowerCase()}`;
          cell.dataset.col = 'status';
        }
      });

      row.classList.toggle('board-row-ground', data.status === 'GROUND');
    });

    // Idle life: every so often one random character does a courtesy flip
    if (!window.__DETERMINISTIC__ &&
        !window.matchMedia('(prefers-reduced-motion: reduce)').matches &&
        Math.random() < 0.035) {
      const chars = this.board.querySelectorAll('.flap-char');
      if (chars.length) {
        const span = chars[Math.floor(Math.random() * chars.length)];
        const ch = span.textContent === ' ' ? ' ' : span.textContent;
        this._flapChar(span, ch);
      }
    }

    // Empty state
    const empty = this.board.parentElement.querySelector('.board-empty');
    if (empty) empty.style.display = rows.length === 0 ? 'block' : 'none';
  }

  draw() {
    // DOM mode — nothing rendered on canvas
  }

  clear() {
    if (this.board) this.board.replaceChildren();
    this._rowEls.clear();
    this._cellText.clear();
    this.hide();
  }
}
