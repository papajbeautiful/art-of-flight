/**
 * Curated colour palettes — the consistency lever of the Look settings.
 *
 * Every palette defines the same semantic slots; modes interpret them
 * artistically rather than exposing raw colour pickers per mode:
 *   ui         chrome accent (panel highlights, toasts, focus rings)
 *   primary    the mode's lead colour (radar phosphor, board text, glints)
 *   secondary  quiet companion (home marker, dim detailing, rings)
 *   inbound    aircraft heading home
 *   outbound   aircraft leaving
 *   ramp       5 stops dark→bright for gradients/altitude mapping
 *   glow       rgba() halo colour for additive light
 *
 * Keep these deliberate. A palette is a colour script, not a swatch dump.
 */

const PALETTES = {
  aurora: {
    name: 'Aurora',
    ui: '#6fe3cf',
    primary: '#52e0c4',
    secondary: '#5f7d9c',
    inbound: '#52e0c4',
    outbound: '#b79cff',
    ramp: ['#071019', '#0e3a40', '#16847e', '#52e0c4', '#b79cff'],
    glow: 'rgba(82, 224, 196, 0.40)'
  },
  ember: {
    name: 'Ember',
    ui: '#ffc266',
    primary: '#ffb300',
    secondary: '#996f33',
    inbound: '#ffb300',
    outbound: '#ff5d3a',
    ramp: ['#140b06', '#3d1d0a', '#8a4511', '#e08a2e', '#ffd9a0'],
    glow: 'rgba(255, 179, 0, 0.35)'
  },
  porcelain: {
    name: 'Porcelain',
    ui: '#d9d4c9',
    primary: '#e8e3d8',
    secondary: '#6e7f8f',
    inbound: '#cfe0ea',
    outbound: '#e8d9bd',
    ramp: ['#0a0c10', '#23303f', '#4f6478', '#9fb4c4', '#f4efe6'],
    glow: 'rgba(232, 227, 216, 0.30)'
  },
  dawn: {
    name: 'Dawn',
    ui: '#ffab8a',
    primary: '#ff9d76',
    secondary: '#9c5e72',
    inbound: '#ffb88f',
    outbound: '#e86a8a',
    ramp: ['#160a14', '#4a1830', '#a13a52', '#e87a5d', '#ffd28f'],
    glow: 'rgba(255, 157, 118, 0.35)'
  },
  abyss: {
    name: 'Abyss',
    ui: '#8ec2ff',
    primary: '#7fb8ff',
    secondary: '#3d5a8a',
    inbound: '#aee3ff',
    outbound: '#5d7df5',
    ramp: ['#05070f', '#101b3c', '#23408c', '#4a7be0', '#aee3ff'],
    glow: 'rgba(127, 184, 255, 0.35)'
  },
  phosphor: {
    name: 'Phosphor',
    ui: '#54ff9c',
    primary: '#3dff8c',
    secondary: '#1f7a4d',
    inbound: '#3dff8c',
    outbound: '#c8ff7a',
    ramp: ['#020604', '#073019', '#0e5c2e', '#3dff8c', '#ccffdd'],
    glow: 'rgba(61, 255, 140, 0.40)'
  }
};

/** hex '#rrggbb' → {h,s,l} (0-360, 0-1, 0-1) */
function _hexToHsl(hex) {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l };
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h;
  switch (max) {
    case r: h = ((g - b) / d + (g < b ? 6 : 0)) * 60; break;
    case g: h = ((b - r) / d + 2) * 60; break;
    default: h = ((r - g) / d + 4) * 60;
  }
  return { h, s, l };
}

function _hslToHex(h, s, l) {
  const f = (n) => {
    const k = (n + h / 30) % 12;
    const a = s * Math.min(l, 1 - l);
    const c = l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
    return Math.round(c * 255).toString(16).padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

/**
 * Build a palette object from three user-picked colours. The ramp is derived
 * from the accent: deep shadow → accent → airy highlight, hue held.
 */
function buildCustomPalette(accent, inbound, outbound) {
  const a = /^#[0-9a-f]{6}$/i.test(accent || '') ? accent : '#52e0c4';
  const { h, s } = _hexToHsl(a);
  const ramp = [
    _hslToHex(h, Math.min(s, 0.5), 0.05),
    _hslToHex(h, Math.min(s, 0.7), 0.16),
    _hslToHex(h, s, 0.32),
    a,
    _hslToHex(h, Math.max(s - 0.25, 0.15), 0.82)
  ];
  const r = parseInt(a.slice(1, 3), 16), g = parseInt(a.slice(3, 5), 16), b = parseInt(a.slice(5, 7), 16);
  return {
    name: 'Custom',
    ui: a,
    primary: a,
    secondary: _hslToHex(h, Math.max(s - 0.3, 0.1), 0.42),
    inbound: inbound || a,
    outbound: outbound || a,
    ramp,
    glow: `rgba(${r}, ${g}, ${b}, 0.38)`
  };
}

/** Resolve a palette key (+custom colours) to a palette object. */
function resolvePalette(key, customColors) {
  if (key === 'custom') {
    const c = customColors || {};
    return buildCustomPalette(c.accent, c.inbound, c.outbound);
  }
  return PALETTES[key] || PALETTES.aurora;
}
