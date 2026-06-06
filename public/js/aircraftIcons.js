/**
 * Shared aircraft icon drawing utility
 * Used by all visualization modes for consistent icon rendering
 */
function hexToRgbIcon(hex) {
  if (!hex || hex.length < 7) return { r: 0, g: 240, b: 255 };
  return {
    r: parseInt(hex.slice(1, 3), 16),
    g: parseInt(hex.slice(3, 5), 16),
    b: parseInt(hex.slice(5, 7), 16)
  };
}

/**
 * Glow gradients are origin-centered (drawn under translate) so they can be
 * cached. At steady state (opacity 1) every glow icon reuses one gradient
 * per color/size instead of allocating ~50+ gradient objects per frame.
 * Fading aircraft (continuous opacity) miss the cache — same as before.
 */
const _glowGradientCache = new Map();

function getGlowGradient(ctx, rgb, gs, opacity) {
  const key = `${rgb.r},${rgb.g},${rgb.b}|${gs}|${opacity}`;
  let gradient = _glowGradientCache.get(key);
  if (!gradient) {
    gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, gs);
    gradient.addColorStop(0, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${0.6 * opacity})`);
    gradient.addColorStop(0.4, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${0.15 * opacity})`);
    gradient.addColorStop(1, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0)`);
    if (_glowGradientCache.size > 256) _glowGradientCache.clear();
    _glowGradientCache.set(key, gradient);
  }
  return gradient;
}

function drawAircraftIcon(ctx, x, y, heading, color, iconType, scale, dotSize, opacity) {
  if (!iconType || iconType === 'none') return;
  if (opacity === undefined) opacity = 1;
  if (scale === undefined) scale = 1;
  if (dotSize === undefined) dotSize = 8;

  ctx.save();

  switch (iconType) {
    case 'chevron': {
      ctx.translate(x, y);
      ctx.rotate((heading || 0) * Math.PI / 180);
      const s = 15 * scale;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(0, -s);
      ctx.lineTo(-s * 0.6, s * 0.8);
      ctx.lineTo(0, s * 0.5);
      ctx.lineTo(s * 0.6, s * 0.8);
      ctx.closePath();
      ctx.fill();
      break;
    }
    case 'glow': {
      const rgb = hexToRgbIcon(color);
      const gs = dotSize;
      ctx.translate(x, y);
      ctx.fillStyle = getGlowGradient(ctx, rgb, gs, opacity);
      ctx.beginPath();
      ctx.arc(0, 0, gs, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${0.9 * opacity})`;
      ctx.beginPath();
      ctx.arc(0, 0, Math.max(2, gs * 0.25), 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case 'dot': {
      const r = (dotSize || 6) * 0.5;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case 'diamond': {
      ctx.translate(x, y);
      ctx.rotate(Math.PI / 4);
      const ds = 7 * scale;
      ctx.fillStyle = color;
      ctx.fillRect(-ds, -ds, ds * 2, ds * 2);
      break;
    }
    case 'circle': {
      const cr = 8 * scale;
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(x, y, cr, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(x, y, 2, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case 'crosshair': {
      const ch = 10 * scale;
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(x - ch, y);
      ctx.lineTo(x + ch, y);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x, y - ch);
      ctx.lineTo(x, y + ch);
      ctx.stroke();
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(x, y, 2, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case 'arrow': {
      ctx.translate(x, y);
      ctx.rotate((heading || 0) * Math.PI / 180);
      const as = 12 * scale;
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, as);
      ctx.lineTo(0, -as);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, -as);
      ctx.lineTo(-as * 0.4, -as * 0.4);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, -as);
      ctx.lineTo(as * 0.4, -as * 0.4);
      ctx.stroke();
      break;
    }
    case 'plane': {
      ctx.translate(x, y);
      ctx.rotate((heading || 0) * Math.PI / 180);
      const ps = 12 * scale;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(0, -ps);
      ctx.lineTo(-ps * 0.15, -ps * 0.4);
      ctx.lineTo(-ps * 0.9, ps * 0.1);
      ctx.lineTo(-ps * 0.9, ps * 0.25);
      ctx.lineTo(-ps * 0.15, ps * 0.1);
      ctx.lineTo(-ps * 0.4, ps * 0.8);
      ctx.lineTo(-ps * 0.4, ps * 0.9);
      ctx.lineTo(0, ps * 0.7);
      ctx.lineTo(ps * 0.4, ps * 0.9);
      ctx.lineTo(ps * 0.4, ps * 0.8);
      ctx.lineTo(ps * 0.15, ps * 0.1);
      ctx.lineTo(ps * 0.9, ps * 0.25);
      ctx.lineTo(ps * 0.9, ps * 0.1);
      ctx.lineTo(ps * 0.15, -ps * 0.4);
      ctx.closePath();
      ctx.fill();
      break;
    }
    case 'triangle': {
      ctx.translate(x, y);
      ctx.rotate((heading || 0) * Math.PI / 180);
      const ts = 12 * scale;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(0, -ts);
      ctx.lineTo(-ts * 0.7, ts * 0.7);
      ctx.lineTo(ts * 0.7, ts * 0.7);
      ctx.closePath();
      ctx.fill();
      break;
    }
  }

  ctx.restore();
}

/**
 * Get label background fill style from labelBgColor + opacity
 */
function getLabelBgStyle(labelBgColor, bgAlpha) {
  const rgb = hexToRgbIcon(labelBgColor || '#000000');
  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${bgAlpha})`;
}
