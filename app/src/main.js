// Neon Coast Cover Studio: wires the editor page. Photos are read on the
// person's own machine and never uploaded; the cover renders live on canvas
// and exports as a PNG in the chosen post size.
import { drawCover, ensureCoverFonts, GRADES, LAYOUTS, panelRects, SIZES } from './cover.js';
import { runShot } from './shots.js';

const canvas = document.getElementById('cover');
const status = document.getElementById('status');
const panelList = document.getElementById('panels');
const poolList = document.getElementById('pool');

/** The pool of loaded photos: HTMLImageElement or null per slot. */
const photos = [];

/** Editor state; panels hold a pool index plus crop (zoom, pan offsets). */
let state = freshState();

function freshState() {
  return {
    layout: 'grid4',
    grade: 'sunset',
    size: '1080x1080',
    title: 'NEON COAST',
    subtitle: 'Palm Drive Nights',
    badge: 'EST. 2026',
    grain: true,
    vignette: true,
    halftone: true,
    panels: [],
  };
}

/** Panels for the current layout, keeping any crop the user already set. */
function syncPanels() {
  const count = LAYOUTS[state.layout].panels;
  const next = [];
  for (let i = 0; i < count; i++) {
    next.push(state.panels[i] || { photo: photos.length ? 0 : null, zoom: 1, ox: 0, oy: 0 });
  }
  state.panels = next;
}

/** A plain snapshot of the state (images stay in the pool, never in history). */
function snapshot() {
  return JSON.parse(JSON.stringify(state));
}

const undoStack = [];
const redoStack = [];
function pushHistory() {
  undoStack.push(snapshot());
  if (undoStack.length > 40) undoStack.shift();
  redoStack.length = 0;
  refreshHistoryButtons();
}
function undo() {
  if (!undoStack.length) return;
  redoStack.push(snapshot());
  state = undoStack.pop();
  syncPanels();
  renderAll();
  refreshHistoryButtons();
}
function redo() {
  if (!redoStack.length) return;
  undoStack.push(snapshot());
  state = redoStack.pop();
  syncPanels();
  renderAll();
  refreshHistoryButtons();
}
function refreshHistoryButtons() {
  document.getElementById('undo').disabled = !undoStack.length;
  document.getElementById('redo').disabled = !redoStack.length;
}

/** Applies a partial state change as one undoable step, then re-renders. */
function applyState(patch) {
  pushHistory();
  Object.assign(state, patch);
  syncPanels();
  renderAll();
}

/** Loads an image from a URL, resolving once it can be drawn. */
export function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`could not load ${url}`));
    img.src = url;
  });
}

/** Adds an image to the photo pool and gives empty panels a photo. */
function addPhoto(img) {
  photos.push(img);
  const idx = photos.length - 1;
  state.panels.forEach((p) => {
    if (p.photo == null) p.photo = idx;
  });
  renderPool();
  renderPanels();
}

/** Loads the kit's two free sample photos into the pool. */
async function loadSamples() {
  for (const src of ['samples/boulevard.jpg', 'samples/pier.jpg']) {
    try {
      addPhoto(await loadImage(src));
    } catch (err) {
      setStatus(`Sample ${src} failed to load`);
    }
  }
  renderAll();
}

function setStatus(text) {
  status.textContent = text;
}

/** Sizes the preview canvas to the chosen export aspect, capped for the page. */
function sizePreview() {
  const { w, h } = SIZES[state.size];
  const maxW = 640;
  const scale = Math.min(1, maxW / w, 560 / h);
  canvas.width = Math.round(w * scale);
  canvas.height = Math.round(h * scale);
}

async function render() {
  sizePreview();
  await ensureCoverFonts();
  drawCover(canvas, state, photos);
}

function renderAll() {
  render();
  renderPanels();
  renderPool();
  syncControlValues();
}

/** Keeps the toolbar controls showing the current state. */
function syncControlValues() {
  document.getElementById('title').value = state.title;
  document.getElementById('subtitle').value = state.subtitle;
  document.getElementById('badge').value = state.badge;
  document.querySelectorAll('[data-layout]').forEach((b) => {
    b.classList.toggle('active', b.dataset.layout === state.layout);
  });
  document.querySelectorAll('[data-grade]').forEach((b) => {
    b.classList.toggle('active', b.dataset.grade === state.grade);
  });
  document.querySelectorAll('[data-size]').forEach((b) => {
    b.classList.toggle('active', b.dataset.size === state.size);
  });
  document.getElementById('grain').checked = state.grain;
  document.getElementById('vignette').checked = state.vignette;
  document.getElementById('halftone').checked = state.halftone;
}

/** Rebuilds the photo pool strip (thumbnails + "use for all panels"). */
function renderPool() {
  poolList.innerHTML = '';
  photos.forEach((img, i) => {
    const thumb = document.createElement('canvas');
    thumb.width = 96;
    thumb.height = 72;
    const tctx = thumb.getContext('2d');
    const s = Math.max(96 / img.naturalWidth, 72 / img.naturalHeight);
    tctx.drawImage(img, (96 - img.naturalWidth * s) / 2, (72 - img.naturalHeight * s) / 2, img.naturalWidth * s, img.naturalHeight * s);
    const wrap = document.createElement('div');
    wrap.className = 'thumb';
    wrap.appendChild(thumb);
    const label = document.createElement('span');
    label.textContent = `Photo ${i + 1}`;
    wrap.appendChild(label);
    const fill = document.createElement('button');
    fill.type = 'button';
    fill.textContent = 'Fill all panels';
    fill.addEventListener('click', () => {
      applyState({ panels: state.panels.map((p) => ({ ...p, photo: i })) });
      setStatus(`Photo ${i + 1} fills every panel`);
    });
    wrap.appendChild(fill);
    poolList.appendChild(wrap);
  });
  document.getElementById('sampleBtn').disabled = photos.length >= 2;
}

/** Rebuilds the per-panel controls: photo pick, zoom slider, reset crop. */
function renderPanels() {
  panelList.innerHTML = '';
  state.panels.forEach((panel, i) => {
    const row = document.createElement('div');
    row.className = 'panel-row';
    const name = document.createElement('span');
    name.textContent = `Panel ${i + 1}`;
    row.appendChild(name);

    const pick = document.createElement('select');
    pick.setAttribute('aria-label', `Photo for panel ${i + 1}`);
    const none = document.createElement('option');
    none.value = '';
    none.textContent = 'Empty sky';
    pick.appendChild(none);
    photos.forEach((img, pi) => {
      const opt = document.createElement('option');
      opt.value = String(pi);
      opt.textContent = `Photo ${pi + 1}`;
      pick.appendChild(opt);
    });
    pick.value = panel.photo == null ? '' : String(panel.photo);
    pick.addEventListener('change', () => {
      pushHistory();
      panel.photo = pick.value === '' ? null : Number(pick.value);
      render();
    });
    row.appendChild(pick);

    const zoom = document.createElement('input');
    zoom.type = 'range';
    zoom.min = '1';
    zoom.max = '2.5';
    zoom.step = '0.05';
    zoom.value = String(panel.zoom || 1);
    zoom.setAttribute('aria-label', `Zoom for panel ${i + 1}`);
    zoom.addEventListener('input', () => {
      panel.zoom = Number(zoom.value);
      render();
    });
    // Record the pre-zoom state when the drag starts, not when it ends.
    zoom.addEventListener('pointerdown', pushHistory);
    row.appendChild(zoom);

    const reset = document.createElement('button');
    reset.type = 'button';
    reset.textContent = 'Reset crop';
    reset.addEventListener('click', () => {
      pushHistory();
      panel.zoom = 1;
      panel.ox = 0;
      panel.oy = 0;
      renderPanels();
      render();
    });
    row.appendChild(reset);
    panelList.appendChild(row);
  });
}

/** Drag on the preview pans the panel under the pointer. */
let dragPanel = null;
let dragStart = null;
function canvasPoint(e) {
  const r = canvas.getBoundingClientRect();
  return { x: (e.clientX - r.left) * (canvas.width / r.width), y: (e.clientY - r.top) * (canvas.height / r.height) };
}
/** Index of the panel under a preview point, or -1 when the point is on the title band. */
function panelAt(x, y) {
  const rects = panelRects(state.layout, canvas.width, canvas.height);
  for (let i = 0; i < rects.length; i++) {
    const r = rects[i];
    if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) return i;
  }
  return -1;
}
canvas.addEventListener('pointerdown', (e) => {
  canvas.setPointerCapture(e.pointerId);
  const p = canvasPoint(e);
  const hit = panelAt(p.x, p.y);
  if (hit < 0) return;
  pushHistory();
  dragPanel = hit;
  dragStart = p;
});
canvas.addEventListener('pointermove', (e) => {
  if (!dragStart) return;
  const p = canvasPoint(e);
  const panel = state.panels[dragPanel];
  if (panel) {
    panel.ox = Math.max(-0.5, Math.min(0.5, (panel.ox || 0) + (p.x - dragStart.x) / canvas.width));
    panel.oy = Math.max(-0.5, Math.min(0.5, (panel.oy || 0) + (p.y - dragStart.y) / canvas.height));
    dragStart = p;
    render();
  }
});
canvas.addEventListener('pointerup', () => {
  dragStart = null;
  dragPanel = null;
});

/** Renders the cover at full export resolution and downloads it as a PNG. */
export async function exportCover() {
  const { w, h } = SIZES[state.size];
  const off = document.createElement('canvas');
  off.width = w;
  off.height = h;
  await ensureCoverFonts();
  drawCover(off, state, photos);
  const name = `neon-coast-${state.size}.png`;
  const blob = await new Promise((resolve) => off.toBlob(resolve, 'image/png'));
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  setStatus(`Saved ${name} — ${w} × ${h}`);
  return off;
}

/** Renders the current cover at export resolution and shows it full-frame. */
export async function showExport(sizeKey) {
  const { w, h } = SIZES[sizeKey || state.size];
  const off = document.createElement('canvas');
  off.width = w;
  off.height = h;
  await ensureCoverFonts();
  drawCover(off, state, photos);
  document.body.classList.add('shot');
  const maxW = sizeKey === '1920x1080' ? 1280 : sizeKey === '1080x1350' ? 1024 : 1080;
  const maxH = sizeKey === '1920x1080' ? 720 : sizeKey === '1080x1350' ? 1280 : 1080;
  const scale = Math.min(maxW / w, maxH / h);
  canvas.width = Math.round(w * scale);
  canvas.height = Math.round(h * scale);
  const ctx = canvas.getContext('2d');
  ctx.drawImage(off, 0, 0, canvas.width, canvas.height);
  return off;
}

// ---- toolbar wiring ----
document.getElementById('photo').addEventListener('change', async (e) => {
  for (const file of e.target.files) {
    try {
      addPhoto(await loadImage(URL.createObjectURL(file)));
    } catch (err) {
      setStatus(`Could not read ${file.name}`);
    }
  }
  renderAll();
  setStatus(`${photos.length} photo${photos.length === 1 ? '' : 's'} loaded`);
});
document.getElementById('sampleBtn').addEventListener('click', () => {
  loadSamples();
  setStatus('Sample photos loaded');
});
document.getElementById('title').addEventListener('input', (e) => {
  state.title = e.target.value;
  render();
});
document.getElementById('title').addEventListener('change', pushHistory);
document.getElementById('subtitle').addEventListener('input', (e) => {
  state.subtitle = e.target.value;
  render();
});
document.getElementById('subtitle').addEventListener('change', pushHistory);
document.getElementById('badge').addEventListener('input', (e) => {
  state.badge = e.target.value;
  render();
});
document.getElementById('badge').addEventListener('change', pushHistory);
document.querySelectorAll('[data-layout]').forEach((b) => {
  b.addEventListener('click', () => applyState({ layout: b.dataset.layout }));
});
document.querySelectorAll('[data-grade]').forEach((b) => {
  b.addEventListener('click', () => applyState({ grade: b.dataset.grade }));
});
document.querySelectorAll('[data-size]').forEach((b) => {
  b.addEventListener('click', () => applyState({ size: b.dataset.size }));
});
document.getElementById('grain').addEventListener('change', (e) => applyState({ grain: e.target.checked }));
document.getElementById('vignette').addEventListener('change', (e) => applyState({ vignette: e.target.checked }));
document.getElementById('halftone').addEventListener('change', (e) => applyState({ halftone: e.target.checked }));
document.getElementById('undo').addEventListener('click', undo);
document.getElementById('redo').addEventListener('click', redo);
document.getElementById('export').addEventListener('click', exportCover);
document.getElementById('fillFirst').addEventListener('click', () => {
  if (!photos.length) return;
  applyState({ panels: state.panels.map((p) => ({ ...p, photo: 0 })) });
  setStatus('Photo 1 fills every panel');
});

// ---- boot: demo scenes for screenshots, or the live editor ----
const params = new URLSearchParams(location.search);
const shot = params.get('shot');
syncPanels();
refreshHistoryButtons();
if (shot) {
  runShot(shot, params, {
    state,
    applyState,
    loadSamples,
    render,
    renderAll,
    showExport,
    photos,
    addPhoto,
  });
} else {
  renderAll();
}
