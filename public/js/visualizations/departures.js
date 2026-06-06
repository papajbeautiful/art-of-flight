/**
 * Departures Mode: split-flap airport board
 *
 * A DOM component, not a canvas mode — it consumes the flight LIST rather
 * than screen positions, so it deliberately does NOT extend
 * AircraftVisualization. It implements the same outer interface
 * (setDisplayOptions / show / hide / update / draw / clear) so app.js
 * treats it like any other mode.
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
      boardColor: '#FFB300',
      showStatus: true,
      flipStagger: true,
      showGroundAircraft: true
    };

    this._lastRefresh = 0;
    this._rowEls = new Map();   // icao24 -> row element
    this._cellText = new Map(); // icao24|col -> last text
  }

  setDisplayOptions(options) {
    if (!options) return;
    ['maxRows', 'boardColor', 'showStatus', 'flipStagger', 'showGroundAircraft'].forEach(k => {
      if (options[k] !== undefined) this.options[k] = options[k];
    });
    if (this.layer && options.boardColor) {
      this.layer.style.setProperty('--board-color', this.options.boardColor);
    }
  }

  show() {
    if (this.layer) this.layer.style.display = 'flex';
    this.active = true;
  }

  hide() {
    if (this.layer) this.layer.style.display = 'none';
    this.active = false;
  }

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
    return {
      callsign: flight.callsign || '———',
      airline: (flight.airlineName || flight.aircraftType || '—').toUpperCase(),
      route: route,
      alt: flight.altitudeFeet != null ? `${Math.round(flight.altitudeFeet).toLocaleString()}FT` : '—',
      spd: flight.velocityKnots != null ? `${Math.round(flight.velocityKnots)}KT` : '—',
      status: this._status(flight)
    };
  }

  /** Set a cell's text with a split-flap flip when it changes */
  _setCell(rowId, el, col, text, flipDelay) {
    const key = `${rowId}|${col}`;
    const prev = this._cellText.get(key);
    if (prev === text) return;
    this._cellText.set(key, text);

    if (prev === undefined) {
      el.textContent = text;
      return;
    }

    // Flip: rotate down to 90°, swap text at the midpoint, rotate back
    setTimeout(() => {
      el.classList.remove('flap-flip');
      // Force reflow so the animation restarts
      void el.offsetWidth;
      el.classList.add('flap-flip');
      setTimeout(() => { el.textContent = text; }, 150);
    }, flipDelay);
  }

  update(flights) {
    if (!this.active || !this.board) return;

    // The board is data-driven, not frame-driven — refresh at most 1/sec
    const now = Date.now();
    if (now - this._lastRefresh < 1000) return;
    this._lastRefresh = now;

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
      });

      row.classList.toggle('board-row-ground', data.status === 'GROUND');
    });

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
