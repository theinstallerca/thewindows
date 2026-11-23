// The enlarged-picture overlay used on the window type pages and in the gallery: a picture opened
// over the page at the largest size that fits; wheel, pinch, +/- or double-click zooms, drag moves,
// Esc / Close / a click outside the picture closes.
//
// Expects this markup inside `zoom`: .zoom-view > .zoom-pan > .zoom-content > img, and a .zoom-btns
// group whose buttons carry data-z = out | in | reset | close (and optionally prev | next).
export function createZoom(zoom: HTMLElement, opts: { max?: number; onStep?: (dir: -1 | 1) => void } = {}) {
  const view = zoom.querySelector<HTMLElement>('.zoom-view')!, pan = zoom.querySelector<HTMLElement>('.zoom-pan')!;
  const content = zoom.querySelector<HTMLElement>('.zoom-content')!, img = content.querySelector('img')!;
  const MAX = opts.max ?? 6;
  const Z = { s: 1, x: 0, y: 0 };
  let ratio = 1, from: HTMLElement | null = null;

  // --inv lets anything drawn on the picture (markers) scale back down and keep its size on screen
  const apply = () => { pan.style.transform = `translate(${Z.x}px,${Z.y}px) scale(${Z.s})`; content.style.setProperty('--inv', String(1 / Z.s)); };
  // zoom to scale ns, keeping the point under (cx, cy) where it is
  function zoomAt(ns: number, cx?: number, cy?: number) {
    ns = Math.max(1, Math.min(MAX, ns));
    const r = view.getBoundingClientRect();
    const px = (cx ?? r.left + r.width / 2) - r.left - pan.offsetLeft, py = (cy ?? r.top + r.height / 2) - r.top - pan.offsetTop;
    Z.x = px - (px - Z.x) * (ns / Z.s); Z.y = py - (py - Z.y) * (ns / Z.s); Z.s = ns;
    if (ns === 1) Z.x = Z.y = 0;
    apply();
  }
  function layout() {
    const w = Math.floor(Math.min(view.clientWidth - 24, (view.clientHeight - 24) / ratio));
    content.style.width = w + 'px'; content.style.height = Math.round(w * ratio) + 'px';
    Z.s = 1; Z.x = Z.y = 0; apply();
  }
  /** Show a picture. w and h are its pixel size, known before it loads. */
  function show(src: string, w: number, h: number, alt = '') {
    ratio = h / w;
    if (img.getAttribute('src') !== src) { img.src = src; img.alt = alt; }
    layout();
  }
  function open(src: string, w: number, h: number, opener?: HTMLElement, alt = '') {
    from = opener ?? null;
    zoom.hidden = false; document.documentElement.style.overflow = 'hidden';
    show(src, w, h, alt);
    zoom.querySelector<HTMLElement>('.zoom-close')?.focus();
  }
  function close() { zoom.hidden = true; document.documentElement.style.overflow = ''; from?.focus({ preventScroll: true }); }

  zoom.querySelector('.zoom-btns')!.addEventListener('click', (ev) => {
    const a = (ev.target as HTMLElement).closest('button')?.dataset.z; if (!a) return;
    if (a === 'close') close(); else if (a === 'reset') zoomAt(1);
    else if (a === 'prev') opts.onStep?.(-1); else if (a === 'next') opts.onStep?.(1);
    else zoomAt(Z.s * (a === 'in' ? 1.5 : 1 / 1.5));
  });
  view.addEventListener('wheel', (ev) => { ev.preventDefault(); zoomAt(Z.s * Math.exp(-ev.deltaY * (ev.deltaMode ? 0.05 : 0.0015)), ev.clientX, ev.clientY); }, { passive: false });
  view.addEventListener('dblclick', (ev) => zoomAt(Z.s > 1 ? 1 : 2.5, ev.clientX, ev.clientY));
  const pts = new Map<number, { x: number; y: number }>(); let pinch = 0, moved = false, onBg = false;
  view.addEventListener('pointerdown', (ev) => {
    if (ev.pointerType === 'mouse' && ev.button !== 0) return;
    view.setPointerCapture(ev.pointerId); pts.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
    moved = false; onBg = ev.target === view;
    if (pts.size === 2) { const [a, b] = [...pts.values()]; pinch = Math.hypot(a.x - b.x, a.y - b.y); }
    view.classList.add('grabbing');
  });
  view.addEventListener('pointermove', (ev) => {
    const p = pts.get(ev.pointerId); if (!p) return;
    const dx = ev.clientX - p.x, dy = ev.clientY - p.y; p.x = ev.clientX; p.y = ev.clientY;
    if (Math.abs(dx) + Math.abs(dy) > 2) moved = true;
    if (pts.size === 1) { Z.x += dx; Z.y += dy; apply(); }
    else if (pts.size === 2) { const [a, b] = [...pts.values()], d = Math.hypot(a.x - b.x, a.y - b.y); if (pinch) zoomAt(Z.s * d / pinch, (a.x + b.x) / 2, (a.y + b.y) / 2); pinch = d; }
  });
  const up = (ev: PointerEvent) => { if (!pts.delete(ev.pointerId)) return; pinch = 0; if (!pts.size) { view.classList.remove('grabbing'); if (onBg && !moved && ev.type === 'pointerup') close(); } };
  view.addEventListener('pointerup', up); view.addEventListener('pointercancel', up);
  document.addEventListener('keydown', (ev) => {
    if (zoom.hidden) return;
    if (ev.key === 'Escape') close(); else if (ev.key === '+' || ev.key === '=') zoomAt(Z.s * 1.5); else if (ev.key === '-') zoomAt(Z.s / 1.5); else if (ev.key === '0') zoomAt(1);
    else if (ev.key === 'ArrowLeft') opts.onStep?.(-1); else if (ev.key === 'ArrowRight') opts.onStep?.(1);
  });
  addEventListener('resize', () => { if (!zoom.hidden) layout(); });
  return { open, show, close };
}
