// Fixed demo scenes for screenshots: each ?shot= value sets up one scene the

/**
 * Runs one shot scene. `studio` is the editor's live wiring: its state,
 * applyState, sample loader, renderers and export shower.
 */
export async function runShot(name, params, studio) {
  await studio.loadSamples();
  if (name === 'editor') {
    studio.applyState({
      layout: 'grid4',
      grade: 'sunset',
      size: '1080x1080',
      title: 'NEON COAST',
      subtitle: 'Palm Drive Nights',
      badge: 'EST. 2026',
      panels: [
        { photo: 0, zoom: 1.15, ox: 0, oy: 0 },
        { photo: 1, zoom: 1.1, ox: 0, oy: 0 },
        { photo: 1, zoom: 1.35, ox: -0.08, oy: 0 },
        { photo: 0, zoom: 1.3, ox: 0.06, oy: 0 },
      ],
    });
    studio.renderAll();
  } else if (name === 'cover') {
    studio.applyState({
      layout: 'hero3',
      grade: 'neon',
      size: '1920x1080',
      title: 'NEON COAST',
      subtitle: 'Vice Nights',
      badge: 'EST. 2026',
      panels: [
        { photo: 0, zoom: 1.05, ox: 0, oy: 0.18 },
        { photo: 1, zoom: 1.1, ox: 0, oy: 0.25 },
        { photo: 0, zoom: 1.4, ox: 0.1, oy: 0 },
        { photo: 1, zoom: 1.1, ox: 0, oy: 0.25 },
      ],
    });
    await studio.showExport('1920x1080');
  } else if (name === 'cover-tall') {
    studio.applyState({
      layout: 'nine',
      grade: 'sunset',
      size: '1080x1350',
      title: 'PIER PRESSURE',
      subtitle: 'Golden Hour Club',
      badge: 'EST. 2026',
      panels: [
        { photo: 0, zoom: 1.25, ox: 0, oy: 0.12 },
        { photo: 1, zoom: 1.2, ox: 0, oy: 0 },
        { photo: 0, zoom: 1.5, ox: -0.1, oy: 0.12 },
        { photo: 1, zoom: 1.35, ox: 0.08, oy: 0 },
        { photo: 0, zoom: 1.15, ox: 0, oy: 0 },
        { photo: 1, zoom: 1.45, ox: 0, oy: -0.05 },
        { photo: 1, zoom: 1.2, ox: 0, oy: 0 },
        { photo: 0, zoom: 1.4, ox: 0.05, oy: 0.12 },
        { photo: 1, zoom: 1.25, ox: 0, oy: 0 },
      ],
    });
    await studio.showExport('1080x1350');
  } else if (name === 'cover-nine') {
    studio.applyState({
      layout: 'tilt',
      grade: 'gold',
      size: '1080x1080',
      title: 'GOLDEN HOUR',
      subtitle: 'Boulevard Days',
      badge: 'EST. 2026',
      panels: [
        { photo: 0, zoom: 1.2, ox: 0, oy: 0 },
        { photo: 1, zoom: 1.2, ox: 0, oy: 0 },
        { photo: 0, zoom: 1.35, ox: -0.08, oy: 0 },
      ],
    });
    await studio.showExport('1080x1080');
  } else {
    studio.renderAll();
  }
  requestAnimationFrame(() => requestAnimationFrame(() => { window.__shotReady = true; }));
}
