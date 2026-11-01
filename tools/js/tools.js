/* Stellar Life — tools.js: spectrograph and telescope optics */
(function () {
  'use strict';
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const TAU = Math.PI * 2, C_KMS = 299792.458;
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const store = { get(k) { try { return localStorage.getItem('tools-' + k); } catch (e) { return null; } }, set(k, v) { try { localStorage.setItem('tools-' + k, v); } catch (e) { /* unavailable */ } } };
  const two = (s) => `<small>${s}</small>`;   // long explanation as a smaller second line
  const facts = (box, rows) => { box.innerHTML = rows.map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join(''); };
  function sig(x, n = 3) {
    if (!isFinite(x)) return '—'; if (x === 0) return '0';
    const a = Math.abs(x);
    if (a >= 1e5 || a < 1e-3) { const e = Math.floor(Math.log10(a)); return (x / Math.pow(10, e)).toPrecision(n).replace(/\.?0+$/, '') + ' × 10<sup>' + e + '</sup>'; }
    return x.toLocaleString('en-US', { maximumSignificantDigits: n });
  }
  const tok = () => { const c = getComputedStyle(document.documentElement), g = (n) => c.getPropertyValue(n).trim(); return { fg: g('--fg'), muted: g('--muted'), faint: g('--faint'), line: g('--line'), accent: g('--accent'), surface: g('--surface') }; };
  function sizeCanvas(cv) {
    const r = cv.getBoundingClientRect(), d = Math.min(devicePixelRatio || 1, 2);
    const W = Math.max(50, Math.round(r.width * d)), H = Math.max(30, Math.round(r.height * d));
    if (cv.width !== W || cv.height !== H) { cv.width = W; cv.height = H; }
    return [cv.getContext('2d'), W, H, d];
  }

  /* ---------- Tabs ---------- */
  const tabs = $$('.tabs [role=tab]');
  function showTab(id, focus) {
    tabs.forEach((t) => { const on = t.getAttribute('aria-controls') === id; t.setAttribute('aria-selected', String(on)); t.tabIndex = on ? 0 : -1; $('#' + t.getAttribute('aria-controls')).hidden = !on; if (on && focus) t.focus(); });
    store.set('tab', id);
    if (location.hash.slice(1) !== id) history.replaceState(null, '', '#' + id);
    if (id === 'spec') { drawLayout(); spec(); quizDraw(); } else { optics(); scope(); }
  }
  tabs.forEach((t, i) => {
    t.addEventListener('click', () => showTab(t.getAttribute('aria-controls')));
    t.addEventListener('keydown', (e) => {
      const n = tabs.length;
      if (e.key === 'ArrowRight') showTab(tabs[(i + 1) % n].getAttribute('aria-controls'), true);
      if (e.key === 'ArrowLeft') showTab(tabs[(i - 1 + n) % n].getAttribute('aria-controls'), true);
      if (e.key === 'Home' || e.key === 'End') { e.preventDefault(); showTab(tabs[e.key === 'Home' ? 0 : n - 1].getAttribute('aria-controls'), true); }
    });
  });

  /* ================= Spectroscopy ================= */
  // Visible lines, air wavelengths in nm (rounded from NIST ASD), with rough relative strengths
  const LINES = {
    H: { name: 'Hydrogen', l: [[656.28, 1], [486.13, 0.6], [434.05, 0.4], [410.17, 0.3]] },
    He: { name: 'Helium', l: [[587.56, 1], [447.15, 0.5], [501.57, 0.4], [667.82, 0.4], [492.19, 0.25], [471.31, 0.2], [706.52, 0.3]] },
    Na: { name: 'Sodium', l: [[588.995, 1], [589.592, 0.8]] },
    Mg: { name: 'Magnesium', l: [[518.36, 1], [517.27, 0.8], [516.73, 0.6]] },
    Ca: { name: 'Calcium', l: [[393.37, 1], [396.85, 1], [422.67, 0.6]] },
    Fe: { name: 'Iron', l: [[438.35, 0.6], [440.48, 0.5], [527.04, 0.6], [495.76, 0.5], [466.81, 0.4], [430.79, 0.5]] },
    Hg: { name: 'Mercury', l: [[435.83, 1], [546.07, 1], [404.66, 0.6], [576.96, 0.6], [579.07, 0.6]] },
    Ne: { name: 'Neon', l: [[640.22, 1], [585.25, 0.6], [633.44, 0.7], [614.31, 0.7], [703.24, 0.6], [692.95, 0.5], [659.9, 0.5], [650.65, 0.6], [621.73, 0.5], [594.48, 0.6]] },
  };
  // How strongly each element's lines can form in a star's atmosphere at temperature T (0..1).
  // Simple smooth curves: H (Balmer) peaks near 9,500 K; He I needs > ~15,000 K; metals fade in hot stars.
  const logBump = (T, T0, sLo, sHi) => { const x = Math.log(T / T0), s = x < 0 ? sLo : sHi; return Math.exp(-x * x / (2 * s * s)); };
  const cool = (T, T0) => 1 / (1 + Math.pow(T / T0, 4));
  const TSTR = {
    H: (T) => logBump(T, 9500, 0.42, 0.6),
    He: (T) => logBump(T, 22000, 0.25, 0.5),
    Ne: (T) => 0.25 * logBump(T, 20000, 0.2, 0.4),      // Ne I: weak, only in hot B stars
    Na: (T) => cool(T, 6500), Mg: (T) => cool(T, 7000), Fe: (T) => cool(T, 7000),
    Hg: () => 0,                                         // lab-lamp element: seen only as Hg II in rare hot HgMn stars
    Ca: (T) => cool(T, 11000),                         // Ca II H & K (ionised calcium): strong from M stars well into A stars
    CaI: (T) => 0.6 * cool(T, 5500),                   // neutral Ca I 422.67 nm: weaker, fades above ~5,500 K
  };
  const L0 = 380, L1 = 750;
  // wavelength (nm) → sRGB 0-255 (Bruton's piecewise fit with edge fall-off)
  function wlRGB(l) {
    let r = 0, g = 0, b = 0;
    if (l < 440) { r = -(l - 440) / 60; b = 1; } else if (l < 490) { g = (l - 440) / 50; b = 1; } else if (l < 510) { g = 1; b = -(l - 510) / 20; } else if (l < 580) { r = (l - 510) / 70; g = 1; } else if (l < 645) { r = 1; g = -(l - 645) / 65; } else { r = 1; }
    const f = l < 420 ? 0.3 + 0.7 * (l - 380) / 40 : l > 700 ? 0.3 + 0.7 * (750 - l) / 50 : 1;
    return [r, g, b].map((v) => Math.round(255 * Math.pow(Math.max(0, v * f), 0.8)));
  }
  const planck = (l, T) => 1 / (Math.pow(l * 1e-9, 5) * (Math.exp(0.014388 / (l * 1e-9 * T)) - 1));
  // Colour of a blackbody: integrate Planck × CIE 1931 colour-matching functions
  // (multi-lobe Gaussian fit of Wyman, Sloan & Shirley 2013) → linear sRGB → gamma.
  const gl = (l, m, s1, s2) => { const t = (l - m) / (l < m ? s1 : s2); return Math.exp(-0.5 * t * t); };
  function bbRGB(T) {
    let X = 0, Y = 0, Z = 0;
    for (let l = 380; l <= 780; l += 5) {
      const p = planck(l, T);
      X += p * (1.056 * gl(l, 599.8, 37.9, 31.0) + 0.362 * gl(l, 442.0, 16.0, 26.7) - 0.065 * gl(l, 501.1, 20.4, 26.2));
      Y += p * (0.821 * gl(l, 568.8, 46.9, 40.5) + 0.286 * gl(l, 530.9, 16.3, 31.1));
      Z += p * (1.217 * gl(l, 437.0, 11.8, 36.0) + 0.681 * gl(l, 459.0, 26.0, 13.8));
    }
    let rgb = [3.2406 * X - 1.5372 * Y - 0.4986 * Z, -0.9689 * X + 1.8758 * Y + 0.0415 * Z, 0.0557 * X - 0.2040 * Y + 1.0570 * Z].map((v) => Math.max(0, v));
    const m = Math.max(...rgb); rgb = rgb.map((v) => v / m);
    return rgb.map((v) => Math.round(255 * (v <= 0.0031308 ? 12.92 * v : 1.055 * Math.pow(v, 1 / 2.4) - 0.055)));
  }
  const colourName = (T) => T < 3700 ? 'orange-red' : T < 5200 ? 'orange' : T < 6000 ? 'yellowish white' : T < 7500 ? 'white' : T < 10000 ? 'bluish white' : 'blue-white';
  const S = { src: 'abs', els: new Set(['H', 'Na']), T: 5800, v: 0, disp: 'grating' };
  const vFrom = (s) => Math.sign(s) * 30000 * Math.pow(Math.abs(s) / 1000, 2);   // fine control near zero, up to ±30,000 km/s
  const shiftF = () => { const b = S.v / C_KMS; return Math.sqrt((1 + b) / (1 - b)); };      // relativistic Doppler
  // where a wavelength lands on the detector, 0..1
  const nPrism = (l) => 1.5046 + 4200 / (l * l);                                           // BK7-like glass (Cauchy)
  function xOf(l) {
    if (S.disp === 'grating') return (l - L0) / (L1 - L0);
    return (nPrism(L0) - nPrism(l)) / (nPrism(L0) - nPrism(L1));
  }
  // column → wavelength, inverted by bisection; cached per disperser and canvas width
  const lamCache = new Map();
  function colLam(W) {
    const key = S.disp + ':' + W; let a = lamCache.get(key); if (a) return a;
    a = new Float64Array(W);
    for (let x = 0; x < W; x++) { const t = (x + 0.5) / W; let lo = L0, hi = L1; for (let i = 0; i < 30; i++) { const m = (lo + hi) / 2; if (xOf(m) < t) lo = m; else hi = m; } a[x] = (lo + hi) / 2; }
    lamCache.set(key, a); return a;
  }
  function renderStrip(cv, mode, els, T, f, opts) {
    const [c, W, H] = sizeCanvas(cv);
    const img = c.createImageData(W, H), d = img.data;
    // invert x → λ by bisection once per column
    const lamCol = colLam(W);
    // brightness relative to the brightest visible wavelength; a tiny floor keeps absorption lines readable at the dim end.
    // A Doppler shift moves the whole spectrum, continuum included: what lands at λ was emitted at λ / f.
    let pmax = 0; for (let l = L0; l <= L1; l += 5) pmax = Math.max(pmax, planck(l / f, T));
    // emission (lab lamp) lines ignore T; absorption depths scale with how well each element's lines form at T
    const lines = []; els.forEach((k) => { LINES[k].l.forEach(([l, s]) => { const w = mode !== 'abs' ? 1 : TSTR[k === 'Ca' && l === 422.67 ? 'CaI' : k](T); lines.push([l * f, s * w]); }); });
    for (let x = 0; x < W; x++) {
      const lam = lamCol[x], rgb = wlRGB(lam);
      let I = mode === 'emit' ? 0 : 0.03 + 0.97 * planck(lam / f, T) / pmax;
      // line profile in pixel units so lines stay crisp in both disperser modes
      let line = 0;
      lines.forEach(([l, s]) => { if (l < L0 || l > L1 || s < 0.01) return; const dx = (xOf(l) * W - x) / Math.max(1, W / 420); line += s * Math.exp(-dx * dx / 1.3); });
      if (mode === 'emit') I = Math.min(1.2, line * 1.1);
      else if (mode === 'abs') I *= Math.max(0.04, 1 - Math.min(0.96, line * 0.95));
      for (let y = 0; y < H; y++) { const k = (y * W + x) * 4; d[k] = rgb[0] * I; d[k + 1] = rgb[1] * I; d[k + 2] = rgb[2] * I; d[k + 3] = 255; }
    }
    c.putImageData(img, 0, 0);
    if (opts && opts.ticks) {
      const dpr = Math.min(devicePixelRatio || 1, 2);
      c.font = `${10 * dpr}px ui-monospace, Menlo, monospace`; c.fillStyle = 'rgba(255,255,255,0.85)'; c.strokeStyle = 'rgba(255,255,255,0.5)';
      [400, 450, 500, 550, 600, 650, 700].forEach((l) => { const x = xOf(l) * W; c.beginPath(); c.moveTo(x, H); c.lineTo(x, H - 6 * dpr); c.stroke(); c.textAlign = l === 400 ? 'left' : 'center'; c.save(); c.lineWidth = 3 * dpr; c.lineJoin = 'round'; c.strokeStyle = 'rgba(0,0,0,0.6)'; c.strokeText(l + '', x, H - 9 * dpr); c.restore(); c.fillText(l + '', x, H - 9 * dpr); });
    }
  }
  function spec(speedOnly) {
    const f = shiftF();
    renderStrip($('#spCanvas'), S.src, S.src === 'cont' ? [] : S.els, S.T, f, { ticks: true });
    if (!speedOnly) renderStrip($('#spLabCanvas'), 'emit', S.els, S.T, 1, { ticks: true });   // lab strip never depends on speed
    $('#spTOut').textContent = S.T.toLocaleString('en-US') + ' K';
    $('#spVOut').innerHTML = S.v === 0 ? '0 (at rest)' : `${S.v > 0 ? 'away' : 'toward us'} ${sig(Math.abs(S.v), 2)} km/s`;
    $('#spT').disabled = S.src === 'emit';
    const solid = S.src === 'cont';
    $$('#spEls input').forEach((i) => { i.disabled = solid; });
    $('#spEls').classList.toggle('is-off', solid);
    $('#spElsHint').hidden = !solid;
    const peak = 2.897771955e6 / S.T, z = f - 1;
    const where = peak < 380 ? 'ultraviolet (bluer than visible)' : peak > 750 ? 'infrared (redder than visible)' : 'visible';
    const ha = 656.28 * f;
    const [r, g, b] = bbRGB(S.T);
    const rows = [
      ['What this is', S.src === 'cont' ? 'Hot, dense source: continuous spectrum' : S.src === 'emit' ? 'Hot, thin gas: emission lines' : 'Cooler gas in front of a hot source: absorption lines'],
      ['Colour of the glow', S.src === 'emit' ? '—' : `<span class="sp-sw" style="background:rgb(${r},${g},${b})"></span>${colourName(S.T)}`],
      ['Peak of the glow (Wien)', S.src === 'emit' ? '—' : `${Math.round(peak)} nm, ${where}` + (S.v ? '; before the Doppler shift' : '')],
      ['Redshift z', (z >= 0 ? '+' : '') + z.toFixed(z && Math.abs(z) < 0.001 ? 6 : 4)],
    ];
    if (S.els.has('H') && !solid) rows.push(['Hydrogen-alpha (656.28 nm) lands at', S.v === 0 ? '656.28 nm' : `${ha.toFixed(2)} nm (moved ${(ha - 656.28).toFixed(2)} nm)`]);
    facts($('#spOut'), rows);
  }
  function drawLayout() {
    const svg = $('#spLayout'); if (!svg) return; const k = tok();
    const NS = 'http://www.w3.org/2000/svg';
    const el = (t, a) => { const e = document.createElementNS(NS, t); for (const n in a) e.setAttribute(n, a[n]); svg.appendChild(e); return e; };
    const tx = (x, y, s) => { const t = el('text', { x, y, 'text-anchor': 'middle', 'font-size': 13, fill: k.muted, style: 'paint-order: stroke; stroke: var(--surface); stroke-width: 3px' }); t.textContent = s; };
    const prism = S.disp === 'prism';
    svg.innerHTML = ''; svg.setAttribute('viewBox', `0 0 900 ${prism ? 200 : 180}`);
    el('rect', { x: 0, y: 0, width: 900, height: prism ? 200 : 180, rx: 12, fill: k.surface });
    // source
    el('circle', { cx: 50, cy: 80, r: 18, fill: '#ffd27a' }); tx(50, 125, 'light source');
    el('path', { d: 'M68 80 L180 80', stroke: k.fg, 'stroke-width': 2 });
    // slit
    el('rect', { x: 180, y: 40, width: 6, height: 34, fill: k.fg }); el('rect', { x: 180, y: 86, width: 6, height: 34, fill: k.fg }); tx(183, 145, 'slit');
    // collimator lens
    el('path', { d: 'M180 80 L300 56 M180 80 L300 104', stroke: k.fg, 'stroke-width': 1.5, opacity: 0.8 });
    el('ellipse', { cx: 300, cy: 80, rx: 7, ry: 34, fill: 'rgba(150,200,255,0.35)', stroke: '#9cc8ff' }); tx(300, 145, 'collimator');
    // collimated beam runs right up to the disperser; inside an apex-up prism at minimum deviation it runs parallel to the base
    if (prism) {
      el('path', { d: 'M300 56 L460 56 M300 104 L430 104', stroke: k.fg, 'stroke-width': 1.5, opacity: 0.8 });
      el('path', { d: 'M460 56 L480 56 L510 104 L430 104 Z', fill: k.fg, opacity: 0.12 });
      el('path', { d: 'M460 56 L480 56 M430 104 L510 104', stroke: k.fg, 'stroke-width': 1.5, opacity: 0.5 });
    } else el('path', { d: 'M300 56 L440 56 M300 104 L440 104', stroke: k.fg, 'stroke-width': 1.5, opacity: 0.8 });
    // disperser
    if (!prism) { for (let i = 0; i < 9; i++) el('line', { x1: 440 + i * 2, y1: 40, x2: 440 + i * 2, y2: 120, stroke: k.fg, 'stroke-width': 1 }); tx(448, 145, 'diffraction grating'); }
    else { el('path', { d: 'M420 120 L470 40 L520 120 Z', fill: 'rgba(150,200,255,0.25)', stroke: '#9cc8ff' }); tx(470, 145, 'prism'); }
    // After the disperser each colour is its own parallel (collimated) band at its own angle; the camera lens
    // brings each band to its own point on the detector: one image of the slit per wavelength.
    const cols = [420, 470, 520, 570, 620, 680], n = cols.length, stroke = (l) => { const [r, g, b] = wlRGB(l); return `rgb(${r},${g},${b})`; };
    const deg = Math.PI / 180;
    // exit aperture (two edge points), optical axis angle after the disperser, lens and detector distance along it
    const P1 = prism ? [480, 56] : [456, 56], P2 = prism ? [510, 104] : [456, 104], ax = prism ? 9 * deg : 0;
    const C0 = [(P1[0] + P2[0]) / 2, (P1[1] + P2[1]) / 2], d = [Math.cos(ax), Math.sin(ax)], pp = [-d[1], d[0]];
    const at = (s, o) => [C0[0] + d[0] * s + pp[0] * o, C0[1] + d[1] * s + pp[1] * o];
    const L = prism ? at(160, 0) : [640, 80], Dc = prism ? at(312, 0) : [800, 80];
    cols.forEach((l, i) => {
      // grating: red diffracted most (bends down); prism: violet refracted most (bends down)
      const rank = prism ? n - 1 - i : i, th = ax + (prism ? (rank - 2.5) * 1.5 : (rank - 2.5) * 2.2) * deg, u = [Math.cos(th), Math.sin(th)];
      const hit = (P) => { const t = ((L[0] - P[0]) * d[0] + (L[1] - P[1]) * d[1]) / (u[0] * d[0] + u[1] * d[1]); return [P[0] + u[0] * t, P[1] + u[1] * t]; };
      const A = hit(P1), B = hit(P2), F = [Dc[0] + pp[0] * (rank - 2.5) * 12, Dc[1] + pp[1] * (rank - 2.5) * 12], c = stroke(l);
      const f = (p) => p[0].toFixed(1) + ' ' + p[1].toFixed(1);
      el('path', { d: `M${f(P1)} L${f(A)} L${f(F)} L${f(B)} L${f(P2)} Z`, fill: c, opacity: 0.05 });
      el('path', { d: `M${f(P1)} L${f(A)} L${f(F)} L${f(B)} L${f(P2)}`, fill: 'none', stroke: c, 'stroke-width': 1.6, opacity: 0.9 });
      el('circle', { cx: F[0], cy: F[1], r: 2.6, fill: c });
    });
    const rot = (p) => `rotate(${(ax / deg).toFixed(2)} ${p[0].toFixed(1)} ${p[1].toFixed(1)})`;
    el('ellipse', { cx: L[0], cy: L[1], rx: 7, ry: 42, fill: 'rgba(150,200,255,0.35)', stroke: '#9cc8ff', transform: rot(L) });
    el('rect', { x: Dc[0], y: Dc[1] - 42, width: 14, height: 84, fill: '#2a3256', stroke: k.fg, transform: rot(Dc) });
    if (prism) { tx(L[0] - 10, 190, 'camera lens'); tx(Dc[0] - 50, 190, 'detector (CCD)'); }
    else { tx(640, 145, 'camera lens'); tx(810, 145, 'detector (CCD)'); }
    tx(450, 22, 'Each wavelength leaves the disperser at its own angle and lands on its own spot on the detector');
  }
  // controls
  [['cont', 'Hot glowing solid'], ['emit', 'Hot thin gas'], ['abs', 'Star (gas in front)']].forEach(([k, label]) => {
    const b = document.createElement('button'); b.type = 'button'; b.textContent = label; b.setAttribute('aria-pressed', String(k === S.src));
    b.addEventListener('click', () => { S.src = k; $$('#spSource button').forEach((x) => x.setAttribute('aria-pressed', String(x === b))); spec(); });
    $('#spSource').appendChild(b);
  });
  const elBox = (box, set, onChange) => Object.entries(LINES).forEach(([k, e]) => {
    const lab = document.createElement('label'); lab.className = 'gx-check';
    lab.innerHTML = `<input type="checkbox" value="${k}"${set && set.has(k) ? ' checked' : ''}> ${e.name}`;
    if (k === 'Hg') lab.title = 'Lab-lamp element; not seen in normal stars';
    if (k === 'Ca') lab.title = 'H & K (393, 397 nm) are ionised calcium (Ca II), strong into A stars; the 423 nm line is neutral Ca I, seen only in cool stars';
    if (k === 'Ne') lab.title = 'Lab-lamp element; only weak lines in hot B stars';
    lab.querySelector('input').addEventListener('change', (ev) => onChange(k, ev.target.checked));
    box.appendChild(lab);
  });
  elBox($('#spEls'), S.els, (k, on) => { if (on) S.els.add(k); else S.els.delete(k); spec(); });
  $('#spT').addEventListener('input', (e) => { S.T = +e.target.value; spec(); });
  $('#spV').addEventListener('input', (e) => { S.v = Math.round(vFrom(+e.target.value)); spec(true); });
  [['grating', 'Grating'], ['prism', 'Prism']].forEach(([k, label]) => {
    const b = document.createElement('button'); b.type = 'button'; b.textContent = label; b.setAttribute('aria-pressed', String(k === S.disp));
    b.addEventListener('click', () => { S.disp = k; $$('#spDisp button').forEach((x) => x.setAttribute('aria-pressed', String(x === b))); drawLayout(); spec(); quizDraw(); });
    $('#spDisp').appendChild(b);
  });

  // Mystery spectrum: pick a star temperature, then elements whose lines actually form at that temperature
  const QPOOL = ['H', 'He', 'Na', 'Mg', 'Ca', 'Fe'];
  const QSTARS = [[4500, 'an orange K-type star'], [6000, 'a yellow-white star on the G/F border, a little hotter than the Sun (G2, 5,772 K)'], [9500, 'a white A-type star'], [20000, 'a blue-white B-type star']];
  const Q = { T: 6000, type: '', ans: new Set(), pick: new Set(), key: '' };
  function quizNew() {
    let key = Q.key, tries = 0;
    while (key === Q.key && tries++ < 50) {
      const [T, type] = QSTARS[Math.floor(Math.random() * QSTARS.length)];
      // hydrogen is always visible when its lines form (≥ 0.3); then 0–2 random extras from the rest of the pool
      const pool = QPOOL.filter((k) => TSTR[k](T) >= 0.3), hasH = pool.includes('H');
      const rest = pool.filter((k) => k !== 'H').sort(() => Math.random() - 0.5);
      const base = hasH ? ['H'] : [], nx = Math.floor(Math.random() * (Math.min(2, rest.length) + 1));
      let ans = base.concat(rest.slice(0, nx)); if (!ans.length) ans = rest.slice(0, 1);
      Q.T = T; Q.type = type; Q.ans = new Set(ans);
      key = T + ':' + [...Q.ans].sort().join(',');
    }
    Q.key = key;
    Q.pick = new Set(); $$('#spQuizEls input').forEach((i) => { i.checked = false; }); $('#spQuizOut').textContent = '';
    $('#spQuizT').textContent = `This star: about ${Q.T.toLocaleString('en-US')} K, ${Q.type}.`;
    quizDraw();
  }
  function quizDraw() { const cv = $('#spQuiz'); if (cv && !cv.closest('[hidden]')) renderStrip(cv, 'abs', Q.ans, Q.T, 1, { ticks: true }); }
  const qbox = $('#spQuizEls');
  QPOOL.forEach((k) => {
    const lab = document.createElement('label'); lab.className = 'gx-check';
    lab.innerHTML = `<input type="checkbox" value="${k}"> ${LINES[k].name}`;
    lab.querySelector('input').addEventListener('change', (ev) => { if (ev.target.checked) Q.pick.add(k); else Q.pick.delete(k); });
    qbox.appendChild(lab);
  });
  $('#spCheck').addEventListener('click', () => {
    if (!Q.pick.size) { $('#spQuizOut').innerHTML = 'Tick at least one element first.'; return; }
    const missed = [...Q.ans].filter((k) => !Q.pick.has(k)), extra = [...Q.pick].filter((k) => !Q.ans.has(k));
    const names = (a) => a.map((k) => LINES[k].name).join(', ');
    $('#spQuizOut').innerHTML = !missed.length && !extra.length ? `<b style="color:var(--good)">Exactly right:</b> ${names([...Q.ans])}.` : `<b>Not quite.</b> ${missed.length ? 'Missed: ' + names(missed) + '. ' : ''}${extra.length ? 'Not present: ' + names(extra) + '. ' : ''}The answer: ${names([...Q.ans])}.`;
  });
  $('#spNext').addEventListener('click', quizNew);

  /* ================= Telescopes: ray tracing ================= */
  const OP = { mode: 'lens', h: 1, color: true };
  const MODES = [['lens', 'Refractor: single lens'], ['achro', 'Refractor: achromat'], ['para', 'Reflector: parabolic mirror'], ['sph', 'Reflector: spherical mirror']];
  // Schott BK7 crown and F2 flint at 656.3 nm (C, red), 546.1 nm (e, green), 486.1 nm (F, blue)
  const GLASS = { r: 1.5143, g: 1.5187, b: 1.5224 };
  const FLINT = { r: 1.6150, g: 1.6241, b: 1.6321 };
  const RCOL = { r: 'rgba(255,80,70,0.9)', g: 'rgba(90,230,120,0.9)', b: 'rgba(90,150,255,0.95)', w: 'rgba(255,255,255,0.85)' };
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1]], add = (a, b) => [a[0] + b[0], a[1] + b[1]], mul = (a, s) => [a[0] * s, a[1] * s];
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1], nrm = (a) => { const l = Math.hypot(a[0], a[1]); return [a[0] / l, a[1] / l]; };
  function hitCircle(p, d, c, R, far) {
    const oc = sub(p, c), b = dot(oc, d), cc = dot(oc, oc) - R * R, disc = b * b - cc;
    if (disc < 0) return null; const t = far ? -b + Math.sqrt(disc) : -b - Math.sqrt(disc);
    return t > 1e-6 ? add(p, mul(d, t)) : null;
  }
  function refract(d, n, eta) {     // n points against d
    const ci = -dot(n, d), s2 = eta * eta * (1 - ci * ci);
    if (s2 > 1) return null;
    return nrm(add(mul(d, eta), mul(n, eta * ci - Math.sqrt(1 - s2))));
  }
  const reflect = (d, n) => nrm(sub(d, mul(n, 2 * dot(d, n))));
  // World units: mm. Aperture 100 mm (radius 50), focal length ~400 mm.
  const F0 = 400, AP = 50, RIM = AP + 4;
  // Spherical surfaces [vertex x, signed radius] (centre at vertex + R); ns[i] = index after surface i.
  function traceSurf(y0, surfs, ns) {
    let p = [-160, y0], d = [1, 0], n0 = 1; const pts = [p];
    for (let i = 0; i < surfs.length; i++) {
      const [v, R] = surfs[i], c = [v + R, 0], q = hitCircle(p, d, c, Math.abs(R), R < 0); if (!q) return null;
      let N = nrm(sub(q, c)); if (R < 0) N = mul(N, -1);
      d = refract(d, N, n0 / ns[i]); if (!d) return null;
      pts.push(q); p = q; n0 = ns[i];
    }
    return { pts, p, d };
  }
  function axisCross(r) { if (!r || Math.abs(r.d[1]) < 1e-9) return null; const t = -r.p[1] / r.d[1]; return t > 0 ? r.p[0] + r.d[0] * t : null; }
  // Single biconvex BK7 lens, f ≈ 400 mm in green
  const RL = 2 * F0 * (GLASS.g - 1), TH = 14;
  const LENS = [[-TH / 2, RL], [TH / 2, -RL]];
  const traceLens = (y0, n) => traceSurf(y0, LENS, [n, 1]);
  // Cemented achromat: equi-convex BK7 crown (R = ±175 mm, 18.4 mm thick) + F2 flint (3 mm), f ≈ 400 mm.
  // The flint's back radius is solved so red (C) and blue (F) paraxial foci coincide.
  const ACH = (() => {
    const tc = 18.4, tf = 3, S0 = [[-tc / 2, 175], [tc / 2, -175], [tc / 2 + tf, -6000]];
    const foc = (iR, col) => { S0[2][1] = 1 / iR; return axisCross(traceSurf(0.5, S0, [GLASS[col], FLINT[col], 1])); };
    let a = -1 / 400, b = -1 / 1e5; const g = (x) => foc(x, 'r') - foc(x, 'b');
    for (let i = 0; i < 60; i++) { const m = (a + b) / 2; if (g(a) * g(m) <= 0) b = m; else a = m; }
    S0[2][1] = 2 / (a + b); return S0;
  })();
  const traceAchro = (y0, col) => traceSurf(y0, ACH, [GLASS[col], FLINT[col], 1]);
  function traceMirror(y0, para) {
    const Xm = 420, f = F0;                    // mirror vertex at x = 420, opening to the left
    let q, n;
    if (para) { const x = Xm - y0 * y0 / (4 * f); q = [x, y0]; n = nrm([1, y0 / (2 * f)]); }   // surface x = Xm − y²/4f
    else { const c = [Xm - 2 * f, 0]; q = hitCircle([-160, y0], [1, 0], c, 2 * f, true); if (!q) return null; n = nrm(sub(q, c)); }
    const nIn = dot(n, [1, 0]) > 0 ? mul(n, -1) : n;
    const d = reflect([1, 0], nIn);
    return { pts: [[-160, y0], q], p: q, d, mirror: true };
  }
  const traceMode = (y0, col) => OP.mode === 'lens' ? traceLens(y0, GLASS[col === 'w' ? 'g' : col]) : OP.mode === 'achro' ? traceAchro(y0, col === 'w' ? 'g' : col) : traceMirror(y0, OP.mode === 'para');
  // surface x at height y (for drawing)
  const sagX = ([v, R], y) => v + R - Math.sign(R) * Math.sqrt(R * R - y * y);
  function surfPath(c, X, Y, sA, sB, fill, stroke) {
    c.beginPath();
    for (let y = -RIM; y <= RIM; y += 1) { const px = X(sagX(sA, y)), py = Y(y); if (y === -RIM) c.moveTo(px, py); else c.lineTo(px, py); }
    for (let y = RIM; y >= -RIM; y -= 1) c.lineTo(X(sagX(sB, y)), Y(y));
    c.closePath(); c.fillStyle = fill; c.fill(); c.strokeStyle = stroke; c.stroke();
  }
  function optics() {
    const cv = $('#opCanvas'); if (!cv || cv.closest('[hidden]')) return;
    const [c, W, H, dpr] = sizeCanvas(cv);
    c.fillStyle = '#05060d'; c.fillRect(0, 0, W, H);
    // narrow (square) canvas: optics in the top band, zoom inset below them so it never covers the beam or mirror
    const narrow = W / H < 1.5;
    const xMin = -170, xMax = 470, sc = W / (xMax - xMin), yMid = narrow ? Math.max(H * 0.28, (RIM + 8) * sc + 4 * dpr) : H / 2;
    const X = (x) => (x - xMin) * sc, Y = (y) => yMid - y * sc;
    c.strokeStyle = 'rgba(255,255,255,0.18)'; c.lineWidth = 1 * dpr; c.setLineDash([4 * dpr, 4 * dpr]); c.beginPath(); c.moveTo(0, yMid); c.lineTo(W, yMid); c.stroke(); c.setLineDash([]);
    const mirror = OP.mode === 'para' || OP.mode === 'sph';
    // optic outline, drawn to the true surface shapes
    c.lineWidth = 1.5 * dpr;
    if (OP.mode === 'lens') surfPath(c, X, Y, LENS[0], LENS[1], 'rgba(150,200,255,0.18)', '#9cc8ff');
    else if (OP.mode === 'achro') { surfPath(c, X, Y, ACH[0], ACH[1], 'rgba(150,200,255,0.2)', '#9cc8ff'); surfPath(c, X, Y, ACH[1], ACH[2], 'rgba(255,200,140,0.28)', '#ffc890'); }
    else {
      c.lineWidth = 2 * dpr; c.strokeStyle = '#cfd6ee'; c.beginPath();
      for (let y = -RIM; y <= RIM; y += 1) { const x = OP.mode === 'para' ? 420 - y * y / (4 * F0) : (420 - 2 * F0) + Math.sqrt(4 * F0 * F0 - y * y); const px = X(x), py = Y(y); if (y === -RIM) c.moveTo(px, py); else c.lineTo(px, py); }
      c.stroke();
    }
    const colours = OP.color ? ['r', 'g', 'b'] : [mirror ? 'w' : 'g'];
    // Focus readouts come from un-offset rays: paraxial (0.5 mm from the axis) and marginal (beam edge)
    const foci = {};
    colours.forEach((col) => { foci[col] = { par: axisCross(traceMode(0.5, col)), mar: axisCross(traceMode(AP * OP.h, col)) }; });
    // Drawn rays: each colour is offset a hair so all three stay visible instead of adding up to white
    const heights = [-1, -0.66, -0.33, 0.33, 0.66, 1].map((v) => v * AP * OP.h);
    const rays = [];
    colours.forEach((col, ci) => {
      const off = colours.length > 1 ? (ci - 1) * 2.2 : 0;
      heights.forEach((h0) => { const r = traceMode(h0 + (h0 > 0 ? -off : off), col); if (r) rays.push([col, r]); });
    });
    // the inset uses exact (un-offset) heights so it shows the true geometry near the focus
    const irays = [];
    colours.forEach((col) => [-1, -0.8, -0.6, -0.4, -0.2, 0.2, 0.4, 0.6, 0.8, 1].forEach((v) => { const r = traceMode(v * AP * OP.h, col); if (r) irays.push([col, r]); }));
    const strokeRays = (Xf, Yf, lw, set) => {
      c.globalCompositeOperation = 'lighter';
      (set || rays).forEach(([col, r]) => {
        const end = add(r.p, mul(r.d, 520));
        c.strokeStyle = RCOL[col]; c.lineWidth = lw; c.beginPath();
        r.pts.forEach((p, i) => (i ? c.lineTo(Xf(p[0]), Yf(p[1])) : c.moveTo(Xf(p[0]), Yf(p[1]))));
        c.lineTo(Xf(end[0]), Yf(end[1])); c.stroke();
      });
      c.globalCompositeOperation = 'source-over';
    };
    strokeRays(X, Y, 1.4 * dpr);
    // focus marker and label (kept inside the canvas)
    const g = foci[colours.includes('g') ? 'g' : colours[0]];
    const fx = g.par != null ? g.par : g.mar;
    c.font = `${11 * dpr}px ui-monospace, Menlo, monospace`;
    if (fx != null) {
      c.fillStyle = '#ffd27a'; c.beginPath(); c.arc(X(fx), yMid, 3.5 * dpr, 0, TAU); c.fill();
      const right = X(fx) + 6 * dpr + c.measureText('focus').width < W - 4 * dpr;
      c.textAlign = right ? 'left' : 'right'; c.fillText('focus', right ? X(fx) + 6 * dpr : X(fx) - 6 * dpr, yMid - 8 * dpr); c.textAlign = 'left';
    }
    // Zoom inset around the focus: shows the colour and edge/centre focus differences
    const marks = [];
    colours.forEach((col) => { if (foci[col].par != null) marks.push([foci[col].par, col, 'par']); });
    const mcol = colours.includes('g') ? 'g' : colours[0];
    if (foci[mcol].mar != null) marks.push([foci[mcol].mar, mcol, 'mar']);
    if (marks.length && fx != null) {
      const top = narrow ? yMid + (RIM + 10) * sc : 0;
      const iw = narrow ? W - 16 * dpr : Math.round(W * 0.38), ih = narrow ? Math.round(H - top - 8 * dpr) : Math.round(H * 0.32);
      const ix = W - iw - 8 * dpr, iy = H - ih - 8 * dpr;
      const xs = marks.map((m) => m[0]), lo = Math.min(...xs), hi = Math.max(...xs), spread = hi - lo, cx = (lo + hi) / 2;
      const Z = Math.round(clamp(0.6 * iw / (sc * Math.max(spread, 1e-3)), 8, 400) / 2) * 2, zs = sc * Z, icy = iy + ih * 0.47;
      const ZX = (x) => ix + iw / 2 + (x - cx) * zs, ZY = (y) => icy - y * zs;
      // box in the main view showing the zoomed region
      const bw = iw / Z, bh = ih / Z;
      c.strokeStyle = 'rgba(255,210,122,0.7)'; c.lineWidth = 1 * dpr;
      if (bw >= 10 * dpr) c.strokeRect(X(cx) - bw / 2, yMid - bh / 2, bw, bh);
      else { c.setLineDash([2 * dpr, 2 * dpr]); c.beginPath(); c.moveTo(X(cx), yMid); c.lineTo(clamp(X(cx), ix + 8 * dpr, ix + iw - 8 * dpr), iy); c.stroke(); c.setLineDash([]); }   // box too small to see: leader to the inset
      c.save(); c.beginPath(); c.rect(ix, iy, iw, ih); c.clip();
      c.fillStyle = '#0b0d1a'; c.fillRect(ix, iy, iw, ih);
      c.strokeStyle = 'rgba(255,255,255,0.18)'; c.setLineDash([3 * dpr, 3 * dpr]); c.beginPath(); c.moveTo(ix, icy); c.lineTo(ix + iw, icy); c.stroke(); c.setLineDash([]);
      strokeRays(ZX, ZY, 1 * dpr, irays);
      c.font = `${10 * dpr}px ui-monospace, Menlo, monospace`;
      const LAB = { r: 'R', g: 'G', b: 'B', w: '' };
      // markers; labels of same-kind markers that land on top of each other are merged (e.g. "R B" when red and blue share
      // a focus). Centre (filled) labels sit in the first row; edge (hollow) labels get their own row with a leader line.
      const base = icy + 6 * dpr, pts = marks.map((m) => [ZX(m[0]), m[1], m[2]]).sort((a, b) => a[0] - b[0]);
      pts.forEach(([px, col, kind]) => {
        c.fillStyle = col === 'w' ? '#ffd27a' : RCOL[col]; c.strokeStyle = c.fillStyle;
        c.beginPath(); c.moveTo(px, base); c.lineTo(px - 4 * dpr, base + 7 * dpr); c.lineTo(px + 4 * dpr, base + 7 * dpr); c.closePath();
        if (kind === 'par') c.fill(); else { c.lineWidth = 1.2 * dpr; c.stroke(); }
      });
      ['par', 'mar'].forEach((kind) => {
        const groups = [];
        pts.filter((m) => m[2] === kind).forEach((m) => { const g = groups[groups.length - 1]; if (g && m[0] - g.x < 16 * dpr) g.m.push(m); else groups.push({ x: m[0], m: [m] }); });
        groups.forEach((g, gi) => {
          const t = g.m.map(([, col]) => kind === 'mar' ? (col === 'w' ? 'edge' : LAB[col] + ' edge') : (col === 'w' ? 'centre' : LAB[col])).join(' ');
          const tw = c.measureText(t).width / 2 + 4 * dpr, tx = clamp(g.x, ix + tw, ix + iw - tw);
          const ty = kind === 'par' ? base + 19 * dpr + (gi % 2) * 11 * dpr : base + 44 * dpr;
          if (kind === 'mar') {   // leader from the hollow marker(s) down to its own label row
            c.strokeStyle = 'rgba(255,255,255,0.45)'; c.lineWidth = 1 * dpr; c.beginPath();
            g.m.forEach(([px]) => { c.moveTo(px, base + 8 * dpr); c.lineTo(tx, ty - 9 * dpr); }); c.stroke();
          }
          c.fillStyle = 'rgba(255,255,255,0.85)'; c.textAlign = 'center';
          c.fillText(t, tx, ty);
        });
      });
      c.restore();
      c.strokeStyle = 'rgba(255,210,122,0.7)'; c.lineWidth = 1 * dpr; c.strokeRect(ix + 0.5, iy + 0.5, iw - 1, ih - 1);
      c.fillStyle = 'rgba(255,255,255,0.85)'; c.textAlign = 'left'; c.font = `${10 * dpr}px ui-monospace, Menlo, monospace`;
      const zt = `zoom ×${Z} at the focus`;
      c.save(); c.fillStyle = 'rgba(11,13,26,0.85)'; c.beginPath();
      if (c.roundRect) c.roundRect(ix + 3 * dpr, iy + 3 * dpr, c.measureText(zt).width + 6 * dpr, 14 * dpr, 3 * dpr); else c.rect(ix + 3 * dpr, iy + 3 * dpr, c.measureText(zt).width + 6 * dpr, 14 * dpr);
      c.fill(); c.restore();
      c.fillText(zt, ix + 6 * dpr, iy + 13 * dpr);
    }
    let html = '';
    const mm = (v) => (v == null || !isFinite(v) ? '—' : Math.abs(v) < 0.05 ? Math.abs(v).toFixed(2) + ' mm' : Math.abs(v).toFixed(1) + ' mm');
    const ca = foci.r && foci.b && foci.r.par != null && foci.b.par != null ? foci.r.par - foci.b.par : null;
    const sa = (col) => foci[col] && foci[col].par != null && foci[col].mar != null ? foci[col].par - foci[col].mar : null;
    if (OP.mode === 'lens') {
      html = `<p class="h">Single lens, 100 mm, f ≈ 400 mm</p><p class="nm">Chromatic aberration</p><p>Blue bends more than red, so red light focuses ${OP.color ? mm(ca) + ' farther away' : 'farther away (turn on the colours to measure it)'}. Every star gets a coloured halo. Rays near the edge of the beam also focus ${mm(sa(mcol))} closer to the lens than central rays (spherical aberration).</p>`;
    } else if (OP.mode === 'achro') {
      const ss = foci.g && foci.r && foci.g.par != null && foci.r.par != null ? foci.r.par - foci.g.par : null;
      html = `<p class="h">Achromatic doublet, 100 mm, f ≈ 400 mm</p><p class="nm">Red and blue share a focus</p><p>A positive crown-glass lens cemented to a weaker negative flint-glass lens: the flint's stronger dispersion cancels the crown's, so red and blue focus together. ${OP.color ? `Green still focuses ${mm(ss)} closer to the lens, the leftover "secondary spectrum" (about f/2000).` : 'A small leftover "secondary spectrum" remains (turn on the colours to see it).'} Edge and centre rays differ by only ${mm(sa(mcol))}. Apochromats add special glass to shrink the leftover colour further.</p>`;
    } else if (OP.mode === 'para') {
      html = `<p class="h">Parabolic mirror, 100 mm, f = 400 mm</p><p class="nm">One perfect focus</p><p>A parabola sends every ray parallel to its axis to exactly one point, at every wavelength. Off axis it suffers coma: stars toward the edge of the field grow little comet-shaped tails. Hubble and Keck use the Ritchey–Chrétien design, two hyperbolic mirrors that cancel coma as well. The focus drawn here sits inside the incoming beam, so real reflectors add a secondary mirror: a flat one sends the light out the side of the tube (Newtonian), a convex one sends it back through a hole in the primary (Cassegrain).</p>`;
    } else {
      html = `<p class="h">Spherical mirror, 100 mm, f = 400 mm</p><p class="nm">Spherical aberration</p><p>Easy to grind, but edge rays focus ${mm(sa(mcol))} closer to the mirror than central ones, blurring the image. Hubble's mirror was ground in 1979–81 to a slightly wrong curve (2.2 μm too flat at the edge), giving it this flaw. It was found after the 1990 launch and corrected in December 1993 by the COSTAR optics and a new camera (WFPC2).</p>`;
    }
    $('#opOut').innerHTML = html;
    $('#opHOut').textContent = Math.round(AP * OP.h * 2) + ' mm wide beam';
  }
  MODES.forEach(([k, label]) => {
    const b = document.createElement('button'); b.type = 'button'; b.textContent = label; b.setAttribute('aria-pressed', String(k === OP.mode));
    b.addEventListener('click', () => { OP.mode = k; $$('#opMode button').forEach((x) => x.setAttribute('aria-pressed', String(x === b))); optics(); });
    $('#opMode').appendChild(b);
  });
  $('#opH').addEventListener('input', (e) => { OP.h = +e.target.value; optics(); });
  $('#opColor').addEventListener('change', (e) => { OP.color = e.target.checked; optics(); });

  /* ================= Telescope calculator ================= */
  // kind: eye | bino | ground (custom too) | ao (ground + adaptive optics) | space | ir (infrared space telescope)
  const TC = { D: 203, F: 1200, E: 25, px: 3.72, kind: 'ground' };
  const PRE = [
    ['Your eye', 7, 17, 'eye'], ['Binoculars 50 mm', 50, 200, 'bino'], ['80 mm refractor', 80, 600, 'ground'], ['8″ Dobsonian', 203, 1200, 'ground'],
    ['11″ Schmidt-Cassegrain', 279, 2800, 'ground'], ['Hubble (2.4 m)', 2400, 57600, 'space', 4.0], ['Webb (6.5 m)', 6500, 131400, 'ir', 25.4], ['Keck (10 m)', 10000, 150000, 'ao', 76],
  ];   // optional 5th entry: real collecting area in m² (central obstruction, segments), overriding π(D/2)²
  const logMap = (lo, hi) => ({ from: (s) => lo * Math.pow(hi / lo, s / 1000), to: (v) => Math.round(Math.log(v / lo) / Math.log(hi / lo) * 1000) });
  const DS = logMap(5, 12000), FS = logMap(15, 150000);
  const TARGETS = [
    ['Andromeda Galaxy', 'mag 3.4', 3.4, null], ['Jupiter’s four big moons', 'mag 5–6', 5.7, 30], ['Uranus', 'mag 5.7', 5.7, null], ['Saturn’s rings', '~40″ across', 6, 6],
    ['Double star Epsilon Lyrae, each pair', '2.3″ apart', 5, 2.3], ['Neptune', 'mag 7.8', 7.8, null], ['Whirlpool Galaxy (M51)', 'mag 8.4', 8.4, null],
    ['Cassini Division in Saturn’s rings', '0.7″ wide, but a high-contrast dark line: shows at ~1.5″', 6, 1.5], ['Proxima Centauri', 'mag 11.1, southern sky only', 11.1, null], ['Quasar 3C 273 (2.4 billion ly)', 'mag 12.9', 12.9, null], ['Pluto', 'mag 14.4', 14.4, null],
  ];
  const lenTxt = (v) => v >= 1000 ? sig(v / 1000, 3) + ' m' : Math.round(v) + ' mm';
  function scope() {
    const { D, F, px, kind } = TC, E = kind === 'bino' ? 25 : TC.E;   // binoculars: built-in eyepieces, fixed 8×
    const space = kind === 'space' || kind === 'ir', visual = kind === 'eye' || kind === 'bino' || (kind === 'ground' && D <= 1000);
    const mlim = 7.7 + 5 * Math.log10(D / 10) - (kind === 'bino' ? 1.5 : 0), dawes = 116 / D, diff = (lam) => 1.22 * lam / (D / 1000) * 206265;
    const M = F / E, maxM = 2 * D, exitP = D / M, eyepiece = kind === 'bino' || (kind === 'ground' && D <= 1000);
    $('#tcD').value = DS.to(D); $('#tcDOut').textContent = lenTxt(D);
    $('#tcF').value = FS.to(F); $('#tcFOut').textContent = lenTxt(F);
    $('#tcEOut').textContent = kind === 'bino' ? 'fixed (8×)' : E + ' mm'; $('#tcEHint').hidden = kind !== 'bino'; $('#tcPxOut').textContent = px.toFixed(2) + ' μm';
    $('#tcF').disabled = kind === 'eye' || kind === 'bino'; $('#tcE').disabled = !eyepiece || kind === 'bino'; $('#tcPx').disabled = kind === 'eye' || kind === 'bino';
    // finest detail actually reachable, and the note that goes with it
    let res, resRow;
    if (kind === 'eye') { res = 60; resRow = ['Finest detail', '~60″ (1′)' + two('The retina, not the 7 mm opening, sets the eye’s limit.')]; }
    else if (kind === 'ir') { res = diff(2e-6); resRow = ['Finest detail at 2 μm (1.22λ/D)', `${sig(res, 2)}″`]; }
    else if (space) { res = dawes; resRow = ['Finest detail (Dawes 116″/D)', `${sig(dawes, 2)}″` + two('No air in the way.')]; }
    else if (kind === 'ao') { res = Math.max(dawes, diff(2.2e-6)); resRow = ['Finest detail (Dawes 116″/D)', `${sig(dawes, 2)}″ in theory` + two(`~${sig(diff(2.2e-6), 1)}″ in infrared with adaptive optics, ~0.5″ without.`)]; }
    else {
      res = Math.max(dawes, 1.0); let note = dawes < 1 ? two('Air turbulence usually limits you to ~1–2″.') : '';
      if (kind === 'bino') { res = Math.max(res, 60 / M); note = two(`At ${Math.round(M)}×, your eye sees ~${Math.round(60 / M)}″ at best.`); }
      resRow = ['Finest detail (Dawes 116″/D)', `${sig(dawes, 2)}″` + note];
    }
    const rows = [TC.area ? ['Light gathered vs your eye (mirror area / 7 mm pupil)', sig(TC.area / (Math.PI * 0.0035 * 0.0035), 3) + '×' + two(`Collecting area ${TC.area} m².`)]
      : ['Light gathered vs your eye (D/7 mm)²', sig(Math.pow(D / 7, 2), 3) + '×']];
    if (kind === 'ir') rows.push(['What it sees', 'Infrared, 0.6–28 μm' + two('Mostly redder than the eye can see.')]);
    if (space) rows.push(['Faintest objects (deep camera exposures)', kind === 'ir' ? '~mag 30+' + two('Deep infrared fields.') : '~mag 30' + two('Hubble Ultra Deep Field.')]);
    else rows.push([visual ? 'Faintest star by eye' : 'Faintest star by eye (if you could look)', `mag ${mlim.toFixed(1)}` + (kind === 'bino' ? two('Hand-held; on a tripod about 1 mag fainter.') : visual ? '' : two('Long camera exposures go far fainter.'))]);
    rows.push(resRow);
    if (kind !== 'ir') rows.push(['Diffraction limit at 550 nm (1.22λ/D)', `${sig(diff(550e-9), 2)}″`]);
    if (kind !== 'eye' && kind !== 'bino') rows.push(['Focal ratio', 'f/' + sig(F / D, 2)]);
    if (eyepiece) rows.push(['Magnification F / eyepiece', `${Math.round(M)}×` + (M > maxM ? two('<b style="color:var(--bad)">Over the useful maximum.</b>') : '')], ...(kind === 'bino' ? [] : [['Highest useful magnification (~2 × D in mm)', Math.round(maxM) + '×']]), ['Exit pupil D / M', sig(exitP, 2) + ' mm' + (exitP > 7 ? two('Wider than your pupil: light wasted.') : '')]);
    if (kind !== 'eye' && kind !== 'bino') rows.push(['Camera plate scale (206.265 × pixel / F)', `${sig(206.265 * px / F, 2)}″ per pixel`]);
    facts($('#tcOut'), rows);
    const reach = space ? 30 : mlim;
    $('#tcTargets').innerHTML = TARGETS.map(([nm, info, mag, r]) => {
      const okMag = mag <= reach, okRes = r == null || res <= r;
      return `<li class="${okMag && okRes ? 'ok' : 'no'}"><b>${nm}</b> <span>${info}${!okMag ? ' · too faint' : !okRes ? ' · too fine' : ''}</span></li>`;
    }).join('');
  }
  PRE.forEach(([nm, D, F, kind, area], i) => {
    const b = document.createElement('button'); b.type = 'button'; b.textContent = nm; b.setAttribute('aria-pressed', String(i === 3));
    b.addEventListener('click', () => { Object.assign(TC, { D, F, kind, area: area || null }); $$('#tcPre button').forEach((x) => x.setAttribute('aria-pressed', String(x === b))); scope(); });
    $('#tcPre').appendChild(b);
  });
  $('#tcD').addEventListener('input', (e) => {
    // keep a sensible focal ratio: carry over f/3–f/15 from a ground scope, otherwise start at f/6
    const ratio = TC.F / TC.D, keep = (TC.kind === 'ground' || TC.kind === 'bino') && ratio >= 3 && ratio <= 15;
    TC.D = Math.round(DS.from(+e.target.value));
    TC.F = clamp(Math.round(TC.D * (keep ? ratio : 6)), 15, 150000);
    TC.kind = 'ground'; TC.area = null; $$('#tcPre button').forEach((x) => x.setAttribute('aria-pressed', 'false')); scope();
  });
  // focal length never shorter than the aperture (f/1); the slider snaps back to agree with the label
  $('#tcF').addEventListener('input', (e) => { TC.F = Math.max(Math.round(FS.from(+e.target.value)), TC.D); $$('#tcPre button').forEach((x) => x.setAttribute('aria-pressed', 'false')); scope(); });
  $('#tcE').addEventListener('input', (e) => { TC.E = +e.target.value; scope(); });
  $('#tcPx').addEventListener('input', (e) => { TC.px = +e.target.value; scope(); });

  /* ---------- Boot ---------- */
  new ResizeObserver(() => { if (!$('#spec').hidden) { spec(); quizDraw(); } else optics(); }).observe($('main'));
  const redraw = () => { if (!$('#spec').hidden) { drawLayout(); spec(); } else optics(); };
  matchMedia('(prefers-color-scheme: light)').addEventListener('change', redraw);
  new MutationObserver(redraw).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  quizNew();
  const h = location.hash.slice(1), ids = tabs.map((t) => t.getAttribute('aria-controls'));
  showTab(ids.includes(h) ? h : (ids.includes(store.get('tab')) ? store.get('tab') : 'spec'));
  addEventListener('hashchange', () => { const id = location.hash.slice(1); if (ids.includes(id) && $('#' + id).hidden) showTab(id); });
  window.__tools = { xOf, wlRGB, bbRGB, TSTR, traceLens, traceAchro, traceMirror, axisCross, GLASS, FLINT, ACH, S, TC, Q };
})();
