// Neon Coast cover renderer: turns photos, a layout and a colour grade into a
// GTA-poster-style cover on a 2D canvas. Every drawing here is procedural —
// no Rockstar artwork, logo or font is used. Lettering is Anton (titles) and
// Pacifico (script subtitle), both shipped under the SIL Open Font License.

/** Five gradient-map grades: each maps a pixel's luminance onto a sunset/neon ramp. */
export const GRADES = {
  sunset: {
    label: 'Sunset',
    stops: [[0, [26, 8, 46]], [0.28, [122, 32, 86]], [0.55, [226, 84, 66]], [0.78, [255, 166, 88]], [1, [255, 238, 190]]],
  },
  neon: {
    label: 'Neon Night',
    stops: [[0, [6, 8, 38]], [0.3, [64, 20, 110]], [0.55, [198, 40, 140]], [0.78, [255, 90, 170]], [1, [190, 250, 255]]],
  },
  pink: {
    label: 'Vice Pink',
    stops: [[0, [30, 6, 40]], [0.3, [120, 24, 110]], [0.55, [230, 60, 150]], [0.8, [255, 140, 190]], [1, [255, 230, 240]]],
  },
  teal: {
    label: 'Teal Dawn',
    stops: [[0, [4, 26, 34]], [0.3, [16, 90, 110]], [0.55, [40, 170, 160]], [0.8, [140, 230, 200]], [1, [240, 255, 230]]],
  },
  gold: {
    label: 'Golden Hour',
    stops: [[0, [34, 18, 8]], [0.3, [110, 66, 22]], [0.55, [205, 130, 40]], [0.8, [255, 195, 90]], [1, [255, 244, 200]]],
  },
};

/** Layouts: how the cover's panels are arranged. `panels` is the panel count. */
export const LAYOUTS = {
  grid4: { label: 'Four Panel', panels: 4 },
  hero3: { label: 'Hero + Three', panels: 4 },
  full: { label: 'Full Bleed', panels: 1 },
  nine: { label: 'Nine Panel', panels: 9 },
  tilt: { label: 'Tilted Snaps', panels: 3 },
};

/** Export sizes: square, portrait and wide post sizes. */
export const SIZES = {
  '1080x1080': { label: 'Square 1080 × 1080', w: 1080, h: 1080 },
  '1080x1350': { label: 'Portrait 1080 × 1350', w: 1080, h: 1350 },
  '1920x1080': { label: 'Wide 1920 × 1080', w: 1920, h: 1080 },
};

const INK = '#150826';
const PAPER = '#fff6ea';
const GOLD = '#ffc53d';
const NEON_PINK = '#ff7ad9';

/** Small deterministic PRNG (mulberry32) so the grain is identical every render. */
export function seededRandom(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Loads the two cover fonts so canvas text uses them instead of a fallback. */
export async function ensureCoverFonts() {
  try {
    await Promise.all([
      document.fonts.load('100px Anton'),
      document.fonts.load('60px Pacifico'),
    ]);
    await document.fonts.ready;
  } catch (err) {
    // A missing font falls back to a bold sans; the cover still draws.
  }
}

/** Rectangle of every panel for a layout inside a cover of w x h. */
export function panelRects(layout, w, h) {
  const gap = Math.max(6, Math.round(Math.min(w, h) * 0.008));
  const band = Math.round(h * 0.24); // title band reserved at the foot
  const top = 0;
  const bottom = h - band;
  const inner = (x, y, pw, ph) => ({ x: x + gap, y: y + gap, w: pw - gap * 2, h: ph - gap * 2, rot: 0 });
  if (layout === 'full') return [inner(0, top, w, bottom)];
  if (layout === 'grid4') {
    const hw = w / 2;
    const hh = (bottom - top) / 2;
    return [
      inner(0, top, hw, hh), inner(hw, top, hw, hh),
      inner(0, top + hh, hw, hh), inner(hw, top + hh, hw, hh),
    ];
  }
  if (layout === 'hero3') {
    const heroW = Math.round(w * 0.62);
    const rh = (bottom - top) / 3;
    return [
      inner(0, top, heroW, bottom - top),
      inner(heroW, top, w - heroW, rh),
      inner(heroW, top + rh, w - heroW, rh),
      inner(heroW, top + rh * 2, w - heroW, rh),
    ];
  }
  if (layout === 'nine') {
    const cw = w / 3;
    const ch = (bottom - top) / 3;
    const rects = [];
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 3; c++) rects.push(inner(c * cw, top + r * ch, cw, ch));
    }
    return rects;
  }
  // tilt: three polaroid-style snapshots, slightly rotated, over a sunset sky.
  const pw = w * 0.36;
  const ph = (bottom - top) * 0.62;
  const cy = top + (bottom - top) * 0.16;
  return [
    { x: w * 0.05, y: cy, w: pw, h: ph, rot: -0.07 },
    { x: w * 0.32, y: cy + ph * 0.1, w: pw, h: ph, rot: 0.04 },
    { x: w * 0.59, y: cy, w: pw, h: ph, rot: -0.03 },
  ];
}

/** Maps one luminance value (0..1) through a grade's colour stops. */
export function gradeColor(stops, lum) {
  for (let i = 1; i < stops.length; i++) {
    if (lum <= stops[i][0]) {
      const [t0, c0] = stops[i - 1];
      const [t1, c1] = stops[i];
      const f = (lum - t0) / Math.max(0.0001, t1 - t0);
      return [
        Math.round(c0[0] + (c1[0] - c0[0]) * f),
        Math.round(c0[1] + (c1[1] - c0[1]) * f),
        Math.round(c0[2] + (c1[2] - c0[2]) * f),
      ];
    }
  }
  return stops[stops.length - 1][1];
}

/** Graded copies, cached per photo and grade: the grade never depends on the panel. */
const gradedCache = new WeakMap();

/** Returns a canvas holding `img` graded with `gradeName` at its full frame. */
export function gradedFull(img, gradeName) {
  let byGrade = gradedCache.get(img);
  if (!byGrade) {
    byGrade = new Map();
    gradedCache.set(img, byGrade);
  }
  const cached = byGrade.get(gradeName);
  if (cached) return cached;
  const cap = 1600;
  const scale = Math.min(1, cap / Math.max(img.naturalWidth, img.naturalHeight));
  const cw = Math.max(2, Math.round(img.naturalWidth * scale));
  const ch = Math.max(2, Math.round(img.naturalHeight * scale));
  const canvas = document.createElement('canvas');
  canvas.width = cw;
  canvas.height = ch;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0, cw, ch);
  const grade = GRADES[gradeName] || GRADES.sunset;
  const data = ctx.getImageData(0, 0, cw, ch);
  const px = data.data;
  for (let i = 0; i < px.length; i += 4) {
    const lum = (0.2126 * px[i] + 0.7152 * px[i + 1] + 0.0722 * px[i + 2]) / 255;
    const [r, g, b] = gradeColor(grade.stops, lum);
    // Keep a whisper of the photo's own hue so faces stay recognisable.
    px[i] = Math.round(r * 0.86 + px[i] * 0.14);
    px[i + 1] = Math.round(g * 0.86 + px[i + 1] * 0.14);
    px[i + 2] = Math.round(b * 0.86 + px[i + 2] * 0.14);
  }
  ctx.putImageData(data, 0, 0);
  byGrade.set(gradeName, canvas);
  return canvas;
}

/** Draws one photo into a panel rect with cover-fit, zoom and pan offsets. */
export function drawPanelPhoto(ctx, img, rect, panel, gradeName) {
  if (!img) return;
  const graded = gradedFull(img, gradeName);
  const zoom = panel.zoom || 1;
  const fit = Math.max(rect.w / graded.width, rect.h / graded.height);
  const dw = graded.width * fit * zoom;
  const dh = graded.height * fit * zoom;
  // Pan offsets are fractions of the panel; clamp them so the photo always
  // covers the panel and no gap ever shows at an edge.
  const maxOx = (dw - rect.w) / (2 * rect.w);
  const maxOy = (dh - rect.h) / (2 * rect.h);
  const ox = Math.max(-maxOx, Math.min(maxOx, panel.ox || 0));
  const oy = Math.max(-maxOy, Math.min(maxOy, panel.oy || 0));
  const dx = rect.x + (rect.w - dw) / 2 + ox * rect.w;
  const dy = rect.y + (rect.h - dh) / 2 + oy * rect.h;
  ctx.save();
  ctx.beginPath();
  ctx.rect(rect.x, rect.y, rect.w, rect.h);
  ctx.clip();
  ctx.drawImage(graded, dx, dy, dw, dh);
  ctx.restore();
}

/** Fills an empty panel with a flat sunset sky so a cover never has holes. */
export function drawEmptyPanel(ctx, rect, gradeName) {
  const grade = GRADES[gradeName] || GRADES.sunset;
  const sky = ctx.createLinearGradient(rect.x, rect.y, rect.x, rect.y + rect.h);
  sky.addColorStop(0, `rgb(${grade.stops[1][1].join(',')})`);
  sky.addColorStop(0.6, `rgb(${grade.stops[2][1].join(',')})`);
  sky.addColorStop(1, `rgb(${grade.stops[3][1].join(',')})`);
  ctx.fillStyle = sky;
  ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
  ctx.fillStyle = 'rgba(255, 240, 200, 0.9)';
  ctx.beginPath();
  ctx.arc(rect.x + rect.w * 0.7, rect.y + rect.h * 0.32, Math.min(rect.w, rect.h) * 0.14, 0, Math.PI * 2);
  ctx.fill();
}

/** Draws a five-pointed star centred at (x, y). */
export function drawStar(ctx, x, y, radius, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? radius : radius * 0.45;
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const px = x + Math.cos(a) * r;
    const py = y + Math.sin(a) * r;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fill();
}

/** Rows of halftone dots across the title band, denser toward its foot. */
export function drawHalftone(ctx, x, y, w, h, color) {
  const step = Math.max(10, Math.round(Math.min(w, h) * 0.02));
  ctx.fillStyle = color;
  for (let row = 0; row * step < h; row++) {
    for (let col = 0; col * step < w; col++) {
      const f = (row * step) / h;
      const r = step * 0.08 + step * 0.22 * f;
      ctx.beginPath();
      ctx.arc(x + col * step + (row % 2 ? step / 2 : 0), y + row * step, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

/** Deterministic film grain: a small noise tile drawn as a repeating pattern. */
export function grainTile(seed) {
  const rand = seededRandom(seed);
  const tile = document.createElement('canvas');
  tile.width = 128;
  tile.height = 128;
  const ctx = tile.getContext('2d');
  const data = ctx.createImageData(128, 128);
  for (let i = 0; i < data.data.length; i += 4) {
    const v = Math.floor(rand() * 255);
    data.data[i] = v;
    data.data[i + 1] = v;
    data.data[i + 2] = v;
    data.data[i + 3] = Math.floor(rand() * 26);
  }
  ctx.putImageData(data, 0, 0);
  return tile;
}

/** Shrinks `size` until `text` fits `maxWidth` in the given font family. */
export function fitFontSize(ctx, text, maxWidth, startSize, family, weight) {
  let size = startSize;
  ctx.font = `${weight} ${size}px ${family}`;
  while (size > 10 && ctx.measureText(text).width > maxWidth) {
    size -= 2;
    ctx.font = `${weight} ${size}px ${family}`;
  }
  return size;
}

/** The title band: halftone, big gradient title, neon script subtitle, stars. */
export function drawTitleBand(ctx, state, w, h) {
  const bandH = Math.round(h * 0.24);
  const bandY = h - bandH;
  const band = ctx.createLinearGradient(0, bandY - bandH * 0.4, 0, h);
  band.addColorStop(0, 'rgba(16, 6, 34, 0)');
  band.addColorStop(0.45, 'rgba(16, 6, 34, 0.88)');
  band.addColorStop(1, '#100622');
  ctx.fillStyle = band;
  ctx.fillRect(0, bandY - bandH * 0.4, w, bandH * 1.4);
  if (state.halftone) drawHalftone(ctx, 0, bandY + bandH * 0.55, w, bandH * 0.45, 'rgba(255, 122, 217, 0.16)');

  const title = (state.title || 'NEON COAST').trim().toUpperCase() || 'NEON COAST';
  const titleSize = fitFontSize(ctx, title, w * 0.92, Math.round(h * 0.11), 'Anton, sans-serif', '400');
  const titleY = bandY + bandH * 0.42;
  const grad = ctx.createLinearGradient(0, titleY - titleSize, 0, titleY);
  grad.addColorStop(0, '#ffe98a');
  grad.addColorStop(0.5, '#ff9e57');
  grad.addColorStop(1, '#ff2975');
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = INK;
  ctx.lineWidth = Math.max(3, titleSize * 0.09);
  ctx.strokeText(title, w / 2, titleY);
  ctx.fillStyle = grad;
  ctx.fillText(title, w / 2, titleY);

  const subtitle = (state.subtitle || '').trim();
  if (subtitle) {
    const subSize = fitFontSize(ctx, subtitle, w * 0.7, Math.round(h * 0.038), 'Pacifico, cursive', '400');
    ctx.font = `${subSize}px Pacifico, cursive`;
    ctx.shadowColor = NEON_PINK;
    ctx.shadowBlur = subSize * 0.6;
    ctx.fillStyle = '#ffd7f2';
    ctx.fillText(subtitle, w / 2, bandY + bandH * 0.68);
    ctx.shadowBlur = 0;
  }

  // Heat meter: five gold stars under the lettering.
  const starR = Math.max(6, Math.round(h * 0.011));
  const starY = bandY + bandH * 0.88;
  const gap = starR * 2.6;
  const startX = w / 2 - gap * 2;
  for (let i = 0; i < 5; i++) drawStar(ctx, startX + i * gap, starY, starR, GOLD);

  // Badge ribbon, top right of the cover.
  const badge = (state.badge || '').trim();
  if (badge) {
    const bSize = Math.max(12, Math.round(h * 0.02));
    ctx.font = `${bSize}px Anton, sans-serif`;
    const bw = ctx.measureText(badge).width + bSize * 1.6;
    const bh = bSize * 2;
    ctx.save();
    ctx.translate(w - bw * 0.55, bh * 0.9);
    ctx.rotate(0.1);
    ctx.fillStyle = '#1c0b33';
    ctx.strokeStyle = GOLD;
    ctx.lineWidth = Math.max(2, bSize * 0.12);
    ctx.fillRect(-bw / 2, -bh / 2, bw, bh);
    ctx.strokeRect(-bw / 2, -bh / 2, bw, bh);
    ctx.fillStyle = GOLD;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(badge, 0, 1);
    ctx.restore();
  }
}

/** Soft dark corners so the panels read as one poster. */
export function drawVignette(ctx, w, h) {
  const r = Math.hypot(w, h) / 2;
  const vg = ctx.createRadialGradient(w / 2, h / 2, r * 0.45, w / 2, h / 2, r);
  vg.addColorStop(0, 'rgba(10, 4, 24, 0)');
  vg.addColorStop(1, 'rgba(10, 4, 24, 0.42)');
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, w, h);
}

/**
 * Renders the whole cover onto `canvas` at its own size.
 * `state`: layout, grade, title, subtitle, badge, panels [{photo, zoom, ox, oy}],
 * grain, vignette, halftone. `photos`: array of images (or null) by pool index.
 */
export function drawCover(canvas, state, photos) {
  const ctx = canvas.getContext('2d');
  const w = canvas.width;
  const h = canvas.height;
  ctx.fillStyle = '#1c0b33';
  ctx.fillRect(0, 0, w, h);

  const layout = state.layout || 'grid4';
  if (layout === 'tilt') {
    const sky = ctx.createLinearGradient(0, 0, 0, h);
    sky.addColorStop(0, '#2b0f54');
    sky.addColorStop(0.45, '#c22a72');
    sky.addColorStop(0.75, '#ff7a4d');
    sky.addColorStop(1, '#ffc46b');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#fff3c4';
    ctx.beginPath();
    ctx.arc(w * 0.5, h * 0.3, Math.min(w, h) * 0.11, 0, Math.PI * 2);
    ctx.fill();
  }

  const rects = panelRects(layout, w, h);
  const panels = state.panels || [];
  rects.forEach((rect, i) => {
    const panel = panels[i] || { photo: null, zoom: 1, ox: 0, oy: 0 };
    const img = panel.photo != null ? photos[panel.photo] : null;
    ctx.save();
    if (rect.rot) {
      ctx.translate(rect.x + rect.w / 2, rect.y + rect.h / 2);
      ctx.rotate(rect.rot);
      ctx.translate(-rect.w / 2, -rect.h / 2);
    }
    if (layout === 'tilt') {
      ctx.fillStyle = PAPER;
      ctx.shadowColor = 'rgba(10, 4, 24, 0.55)';
      ctx.shadowBlur = Math.round(Math.min(w, h) * 0.02);
      ctx.shadowOffsetY = Math.round(Math.min(w, h) * 0.01);
      ctx.fillRect(-Math.round(rect.w * 0.04), -Math.round(rect.h * 0.04), rect.w * 1.08, rect.h * 1.14);
      ctx.shadowBlur = 0;
      ctx.shadowOffsetY = 0;
    }
    const inner = { x: layout === 'tilt' ? 0 : rect.x, y: layout === 'tilt' ? 0 : rect.y, w: rect.w, h: rect.h };
    if (img) drawPanelPhoto(ctx, img, inner, panel, state.grade);
    else drawEmptyPanel(ctx, inner, state.grade);
    ctx.lineWidth = Math.max(3, Math.round(Math.min(w, h) * 0.006));
    ctx.strokeStyle = INK;
    ctx.strokeRect(inner.x, inner.y, inner.w, inner.h);
    ctx.restore();
  });

  drawTitleBand(ctx, state, w, h);
  if (state.vignette) drawVignette(ctx, w, h);
  if (state.grain) {
    const tile = grainTile(20261121);
    const pattern = ctx.createPattern(tile, 'repeat');
    ctx.fillStyle = pattern;
    ctx.fillRect(0, 0, w, h);
  }
}
