/* Stellar Life — Earth (builder B): water & erosion, air & magnetism, Moon & tides */
(function () {
  'use strict';
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const NS = 'http://www.w3.org/2000/svg';
  const tok = () => { const c = getComputedStyle(document.documentElement), g = (n) => c.getPropertyValue(n).trim(); return { fg: g('--fg'), muted: g('--muted'), faint: g('--faint'), line: g('--line'), accent: g('--accent'), surface: g('--surface'), bg: g('--bg'), good: g('--good'), bad: g('--bad') }; };
  const light = () => matchMedia('(prefers-color-scheme: light)').matches;
  const RM = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
  function el(tag, attrs, parent) { const e = document.createElementNS(NS, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); if (parent) parent.appendChild(e); return e; }
  function txt(parent, x, y, s, attrs) { const t = el('text', Object.assign({ x, y }, attrs || {}), parent); t.textContent = s; return t; }
  const halo = (w) => ({ stroke: tok().surface, 'stroke-width': w || 3.5, 'paint-order': 'stroke', 'stroke-linejoin': 'round' });
  const T = (o) => Object.assign({}, halo(), o);
  const fmt = (x, d) => Number(x).toLocaleString('en-US', { minimumFractionDigits: d || 0, maximumFractionDigits: d || 0 });
  function sig(x, n) { if (x === 0) return '0'; const d = Math.max(0, (n || 2) - 1 - Math.floor(Math.log10(Math.abs(x)))); return fmt(x, Math.min(d, 6)); }
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const R2D = 180 / Math.PI, D2R = Math.PI / 180;
  function svgPoint(svg, e) { const p = svg.createSVGPoint(); p.x = e.clientX; p.y = e.clientY; return p.matrixTransform(svg.getScreenCTM().inverse()); }
  function segBuild(box, items, cur, onPick) {
    box.innerHTML = '';
    items.forEach(([k, label]) => { const b = document.createElement('button'); b.type = 'button'; b.dataset.k = k; b.textContent = label; b.setAttribute('aria-pressed', String(k === cur)); b.addEventListener('click', () => onPick(k)); box.appendChild(b); });
  }
  const segSync = (box, cur) => $$('button', box).forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.k === cur)));
  function asButton(g, label, fn) {
    g.setAttribute('tabindex', '0'); g.setAttribute('role', 'button'); g.setAttribute('aria-label', label); g.style.cursor = 'pointer';
    g.addEventListener('click', fn);
    g.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fn(); } });
  }
  // arrowhead polygon at (x2,y2) pointing along (x1,y1)->(x2,y2)
  function head(parent, x1, y1, x2, y2, size, fill) {
    const a = Math.atan2(y2 - y1, x2 - x1), s = size, w = size * 0.62;
    const p = [[x2, y2], [x2 - s * Math.cos(a) + w * Math.sin(a), y2 - s * Math.sin(a) - w * Math.cos(a)], [x2 - s * Math.cos(a) - w * Math.sin(a), y2 - s * Math.sin(a) + w * Math.cos(a)]];
    return el('polygon', { points: p.map((q) => q.join(',')).join(' '), fill }, parent);
  }

  /* ---------- visibility + animation helpers ---------- */
  const anims = [];
  function watcher(node, tabId, onChange) {
    const w = { vis: true, node, tabId, onChange, active: false };
    w.sync = () => { const on = w.vis && !$('#' + tabId).hidden; if (on !== w.active) { w.active = on; onChange(on); } };
    if ('IntersectionObserver' in window) { w.vis = false; new IntersectionObserver((es) => { w.vis = es[es.length - 1].isIntersecting; w.sync(); }).observe(node); }
    anims.push(w); return w;
  }
  function loop(node, tabId, step) {
    const a = { playing: false, raf: 0, last: 0, visible: false };
    const run = () => { if (a.playing && a.visible && !a.raf) { a.last = 0; a.raf = requestAnimationFrame(tick); } else if ((!a.playing || !a.visible) && a.raf) { cancelAnimationFrame(a.raf); a.raf = 0; } };
    function tick(t) { const dt = a.last ? Math.min(0.1, (t - a.last) / 1000) : 0; a.last = t; a.raf = 0; step(dt); if (a.playing && a.visible) a.raf = requestAnimationFrame(tick); }
    watcher(node, tabId, (on) => { a.visible = on; run(); });
    a.set = (p) => { a.playing = p; run(); };
    return a;
  }

  /* ---------- curve helpers (log-log, Catmull-Rom) ---------- */
  function crInterp(pts, x) { // pts sorted by x: [[x,y]...]; returns y with Catmull-Rom between neighbours
    const n = pts.length; if (x <= pts[0][0]) { const [a, b] = [pts[0], pts[1]]; return a[1] + (b[1] - a[1]) * (x - a[0]) / (b[0] - a[0]); }
    if (x >= pts[n - 1][0]) { const [a, b] = [pts[n - 2], pts[n - 1]]; return b[1] + (b[1] - a[1]) * (x - b[0]) / (b[0] - a[0]); }
    let i = 0; while (pts[i + 1][0] < x) i++;
    const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(n - 1, i + 2)];
    const t = (x - p1[0]) / (p2[0] - p1[0]);
    const m1 = (p2[1] - p0[1]) / (p2[0] - p0[0]) * (p2[0] - p1[0]), m2 = (p3[1] - p1[1]) / (p3[0] - p1[0]) * (p2[0] - p1[0]);
    const t2 = t * t, t3 = t2 * t;
    return (2 * t3 - 3 * t2 + 1) * p1[1] + (t3 - 2 * t2 + t) * m1 + (-2 * t3 + 3 * t2) * p2[1] + (t3 - t2) * m2;
  }
  const logPts = (a) => a.map(([x, y]) => [Math.log10(x), Math.log10(y)]);

  /* =====================================================================
     WATER & EROSION
     ===================================================================== */
  // USGS Water Science School (after Gleick 1996). km³; fresh: share counts toward fresh water
  const RES = [
    { k: 'ocean', n: 'Oceans, seas & bays', v: 1338000000, fresh: false, col: '#2f6fb3', rt: 'about 3,000 years on average', d: 'Salty, about 3.5% dissolved salts. The oceans are 3.7 km deep on average and hold almost all of Earth\'s water. A molecule that evaporates from the sea usually comes back to it within days.' },
    { k: 'ice', n: 'Ice caps, glaciers & permanent snow', v: 24064000, fresh: true, col: '#9cc9e6', rt: '20–100 years in mountain glaciers; up to hundreds of thousands of years in Antarctica (ice cores reach 800,000 years)', d: 'Antarctica holds about 90% of it. Melted, all of it would raise sea level by roughly 70 m.' },
    { k: 'gws', n: 'Groundwater, salty', v: 12870000, fresh: false, col: '#6b7f99', rt: 'thousands of years or more', d: 'Deep underground water that has dissolved salts from the rock around it over long times.' },
    { k: 'gwf', n: 'Groundwater, fresh', v: 10530000, fresh: true, col: '#5a8f7b', rt: 'decades to centuries when shallow; 10,000 years or more when deep', d: 'Water filling the pores and cracks in rock and soil, mostly in the top kilometre or two. It feeds wells, springs and rivers between rains.' },
    { k: 'perm', n: 'Ground ice & permafrost', v: 300000, fresh: true, col: '#b8c7d6', rt: 'thousands of years', d: 'Frozen ground in the Arctic and high mountains. Some has stayed frozen since the last ice age.' },
    { k: 'lakef', n: 'Lakes, fresh', v: 91000, fresh: true, col: '#3d8fd1', rt: 'about 10–100 years (Lake Superior about 190 years)', d: 'Lake Baikal in Siberia alone holds about a fifth of all the liquid fresh water at the surface.' },
    { k: 'lakes', n: 'Lakes, salty', v: 85400, fresh: false, col: '#7a93b8', rt: 'decades to centuries', d: 'Mostly the Caspian Sea, which has no outlet, so salts carried in by rivers stay behind as the water evaporates.' },
    { k: 'soil', n: 'Soil moisture', v: 16500, fresh: true, col: '#8a6a43', rt: 'about 1–2 months', d: 'The water plants actually use. It is constantly refilled by rain and drawn up by roots.' },
    { k: 'atm', n: 'Atmosphere', v: 12900, fresh: true, col: '#a7b4c9', rt: 'about 9 days', d: 'Vapour and cloud. Rained out all at once it would cover Earth only about 2.5 cm deep, yet it delivers about 500,000 km³ of rain and snow a year, so it is replaced about 40 times a year.' },
    { k: 'swamp', n: 'Swamps & wetlands', v: 11470, fresh: true, col: '#6f8f4a', rt: 'years', d: 'Marshes, bogs and swamps: small in volume but home to a large share of freshwater life.' },
    { k: 'river', n: 'Rivers', v: 2120, fresh: true, col: '#4aa3df', rt: 'weeks to a few months', d: 'Tiny at any moment, but they move 40,000 km³ a year to the sea, so the water in rivers is replaced every couple of weeks to months.' },
    { k: 'bio', n: 'Living things', v: 1120, fresh: true, col: '#5fae63', rt: 'about a week', d: 'The water inside plants, animals and microbes. You are about 60% water.' },
  ];
  const TOTAL = RES.reduce((s, r) => s + r.v, 0), FRESH = RES.filter((r) => r.fresh).reduce((s, r) => s + r.v, 0);
  const W = { mode: 'all', scale: 'lin', sel: 'ocean' };
  const pct = (p) => (p >= 10 ? fmt(p, 1) : p >= 1 ? fmt(p, 2) : p >= 0.01 ? sig(p, 2) : sig(p, 1)) + '%';
  function resPaint() {
    const box = $('#ebRes'); box.innerHTML = '';
    const rows = RES.filter((r) => W.mode === 'all' || r.fresh), base = W.mode === 'all' ? TOTAL : FRESH;
    if (!rows.some((r) => r.k === W.sel)) W.sel = rows[0].k;
    rows.forEach((r) => {
      const p = 100 * r.v / base;
      const w = W.scale === 'lin' ? p : clamp((Math.log10(p) + 4) / 6 * 100, 0.5, 100);
      const b = document.createElement('button'); b.type = 'button'; b.className = 'eb-res-row'; b.setAttribute('aria-pressed', String(r.k === W.sel));
      b.innerHTML = `<span class="eb-res-n">${r.n}</span><span class="eb-res-bar"><i style="width:${Math.max(w, 0.4)}%;background:${r.col}"></i></span><span class="eb-res-v">${pct(p)}</span>`;
      b.addEventListener('click', () => { W.sel = r.k; resPaint(); });
      box.appendChild(b);
    });
    $('#ebResNote').textContent = W.scale === 'lin'
      ? 'Linear bars: honest about size, so most reservoirs are too thin to see.'
      : 'Logarithmic bars: each fifth of the bar is ten times more water, from 0.0001% to 100%. Good for seeing the small reservoirs, but it makes them look far bigger than they are.';
    const r = RES.find((q) => q.k === W.sel), p = 100 * r.v / base;
    $('#ebResOut').innerHTML = `<p class="h">${W.mode === 'all' ? 'Share of all water' : 'Share of fresh water'}</p><p class="nm">${r.n}: ${pct(p)}</p><p><b>${fmt(r.v)} km³.</b> ${r.d}</p><p><b>Typical stay:</b> ${r.rt}.</p>`;
  }
  function waterFacts() {
    const sph = Math.cbrt(6 * TOTAL / Math.PI), surf = RES.filter((r) => ['lakef', 'river', 'swamp'].includes(r.k)).reduce((s, r) => s + r.v, 0);
    $('#ebResFacts').innerHTML = [
      ['All water', fmt(TOTAL / 1e6, 0) + ' million km³'],
      ['Fresh water', fmt(FRESH / 1e6, 1) + ' million km³ (' + fmt(100 * FRESH / TOTAL, 1) + '%)'],
      ['Fresh water locked in ice', fmt(100 * 24064000 / FRESH, 1) + '%'],
      ['Fresh water in lakes, rivers, swamps', fmt(100 * surf / FRESH, 2) + '%'],
      ['All of it as one ball', fmt(Math.round(sph / 10) * 10) + ' km across'],
    ].map(([a, b]) => `<div><dt>${a}</dt><dd>${b}</dd></div>`).join('');
  }

  /* ---------- water cycle ---------- */
  const FLUX = {
    evap: { n: 'Evaporation from the ocean', f: 413, d: 'Sunlight supplies the energy: evaporating 1 kg of water takes about 2.5 MJ. This latent heat is the largest way the surface passes heat to the air, about 80 W/m² averaged over the globe.' },
    oprec: { n: 'Rain and snow on the ocean', f: 373, d: 'About 90% of the water that evaporates from the sea falls straight back on it.' },
    trans: { n: 'Vapour blown over land', f: 40, d: 'Winds carry the other 10% inland. This is the only net supply of fresh water from the sea to the continents.' },
    lprec: { n: 'Rain and snow on land', f: 113, d: 'Only about a third of it (40 of 113) is new water from the sea. The rest is recycled: evaporated from soil, lakes and leaves, and rained out again.' },
    et: { n: 'Evaporation and transpiration from land', f: 73, d: 'Plants pull water from the soil and release it through pores in their leaves. With evaporation from soil and lakes, this returns about two-thirds of land rain to the air.' },
    runoff: { n: 'Runoff to the sea', f: 40, d: 'Rivers and groundwater return to the sea exactly what the winds brought in, so the budget balances. This flow does most of the work of erosion, carrying an estimated 13 to 20 billion tonnes of sediment a year to the sea.' },
    infil: { n: 'Infiltration and groundwater flow', f: null, d: 'Some rain soaks into the ground and refills groundwater. It moves slowly, centimetres to metres a day, and can stay underground for thousands of years before seeping into a river or the sea. Its flow is counted in the 40 of runoff.' },
    cond: { n: 'Condensation', f: null, d: 'Rising air cools by about 6.5 °C per km. When it is cool enough, vapour condenses on specks of dust and sea salt into cloud droplets, releasing the heat it took to evaporate. That heat powers storms.' },
  };
  let cycSel = 'evap';
  function cycOut() { const f = FLUX[cycSel]; $('#ebCycleOut').innerHTML = `<b>${f.n}${f.f ? ': ' + f.f + ' thousand km³/yr' : ''}.</b> ${f.d}`; $$('#ebCycle .eb-fx').forEach((g) => g.classList.toggle('eb-on', g.dataset.k === cycSel)); }
  function cyclePaint() {
    const svg = $('#ebCycle'); svg.innerHTML = ''; const K = tok(), L = light();
    const wf = (f) => 3 + f * 0.048;
    const defs = el('defs', {}, svg);
    const sky = el('linearGradient', { id: 'ebSky', x1: 0, y1: 0, x2: 0, y2: 1 }, defs);
    el('stop', { offset: 0, 'stop-color': L ? '#cfe3f6' : '#18264a' }, sky); el('stop', { offset: 1, 'stop-color': L ? '#eef5fb' : '#22355f' }, sky);
    el('rect', { x: 0, y: 0, width: 900, height: 440, fill: 'url(#ebSky)' }, svg);
    // sun
    el('circle', { cx: 860, cy: 34, r: 20, fill: '#ffcf5a' }, svg);
    // ocean
    el('path', { d: 'M470 340 Q520 336 560 340 T660 340 T760 340 T900 340 V440 H470 Z', fill: L ? '#3d7fc4' : '#1d4f8f' }, svg);
    // land with mountain
    el('path', { d: 'M0 440 V300 L60 260 L150 175 L205 230 L250 250 L330 300 L420 318 L470 340 V440 Z', fill: L ? '#8b7a55' : '#5b4c33' }, svg);
    el('path', { d: 'M126 198 L150 175 L172 196 L160 192 L150 200 L138 194 Z', fill: '#f2f4f8' }, svg);
    // groundwater band
    el('path', { d: 'M0 395 Q200 380 470 392 V440 H0 Z', fill: L ? '#5f7f9a' : '#2f4a63', opacity: 0.8 }, svg);
    txt(svg, 18, 428, 'groundwater', { 'font-size': 14, fill: '#e8eef6' });
    // trees
    [[300, 300], [330, 304], [360, 309]].forEach(([x, y]) => { el('rect', { x: x - 1.5, y: y - 6, width: 3, height: 8, fill: '#4a3a24' }, svg); el('circle', { cx: x, cy: y - 12, r: 9, fill: '#3f8a4a' }, svg); });
    // clouds
    const cloud = (x, y, s) => { const g = el('g', { fill: L ? '#ffffff' : '#c9d3e6', opacity: 0.95 }, svg); [[0, 0, 26], [28, -10, 30], [58, 0, 24], [30, 8, 26]].forEach(([dx, dy, r]) => el('circle', { cx: x + dx * s, cy: y + dy * s, r: r * s }, g)); return g; };
    cloud(190, 88, 1.15); cloud(600, 82, 1.3);
    const ink = L ? '#0f1b33' : '#eef3fb', arrowCol = L ? '#1d5fa8' : '#9fd0ff';
    const LBL = { evap: ['Evaporation', 'from the ocean'], lprec: ['Rain & snow on land'], oprec: ['Rain and snow', 'on the ocean'] };
    function flux(k, pts, w, lx, ly, anchor, extra) {
      const g = el('g', { class: 'eb-fx', 'data-k': k }, svg);
      const d = 'M' + pts.map((p) => p.join(' ')).join(' L ');
      const hs = w * 1.25 + 8; const [ax, ay] = pts[pts.length - 2], [bx, by] = pts[pts.length - 1];
      const len = Math.hypot(bx - ax, by - ay), ex = bx - (bx - ax) / len * hs * 0.85, ey = by - (by - ay) / len * hs * 0.85;
      const d2 = 'M' + pts.slice(0, -1).map((p) => p.join(' ')).join(' L ') + ` L ${ex} ${ey}`;
      el('path', { d: d2, fill: 'none', stroke: 'transparent', 'stroke-width': Math.max(w, 22) }, g);
      el('path', { d: d2, fill: 'none', stroke: arrowCol, 'stroke-width': w, opacity: 0.85, class: 'eb-fx-line', ...(extra || {}) }, g);
      el('path', { d: d2, fill: 'none', stroke: L ? '#ffffff' : '#e8f4ff', 'stroke-width': Math.max(1.5, w * 0.35), 'stroke-dasharray': '3 15', 'stroke-linecap': 'round', class: 'eb-dash', opacity: 0.85 }, g);
      head(g, ax, ay, bx, by, hs, arrowCol);
      const f = FLUX[k];
      const lines = (LBL[k] || [f.n]).concat(f.f ? [f.f + ' thousand km³/yr'] : []);
      lines.forEach((s, j) => txt(g, lx, ly + j * 17, s, T({ 'font-size': 14, fill: ink, 'text-anchor': anchor || 'start', 'font-weight': j === lines.length - 1 && f.f ? 400 : 600, stroke: L ? '#eef5fb' : '#16213f' })));
      asButton(g, f.n + (f.f ? ', ' + f.f + ' thousand cubic kilometres per year' : ''), () => { cycSel = k; cycOut(); });
      return g;
    }
    flux('evap', [[740, 336], [740, 120]], wf(413), 762, 200, 'start');
    flux('oprec', [[630, 124], [630, 334]], wf(373), 608, 250, 'end');
    flux('trans', [[548, 56], [300, 56]], wf(40), 424, 30, 'middle');
    flux('lprec', [[200, 128], [200, 196]], wf(113), 186, 140, 'end');
    flux('et', [[330, 282], [330, 128]], wf(73), 348, 214, 'start');
    flux('runoff', [[205, 236], [255, 262], [330, 312], [400, 330], [478, 346]], wf(40), 300, 356, 'start');
    flux('infil', [[245, 262], [245, 310], [250, 382], [470, 405]], 4, 70, 330, 'start', { 'stroke-dasharray': '6 5' });
    // condensation label (clickable, at the ocean cloud)
    const cg = el('g', { class: 'eb-fx', 'data-k': 'cond' }, svg);
    el('rect', { x: 440, y: 106, width: 124, height: 26, fill: 'transparent' }, cg);
    txt(cg, 560, 124, 'condensation', T({ 'font-size': 14, fill: ink, 'font-weight': 600, 'text-anchor': 'end', stroke: L ? '#eef5fb' : '#16213f' }));
    asButton(cg, 'Condensation', () => { cycSel = 'cond'; cycOut(); });
    txt(svg, 680, 420, 'OCEAN', { 'font-size': 14, fill: '#e8eef6', 'letter-spacing': 2 });
    txt(svg, 40, 362, 'LAND', { 'font-size': 14, fill: '#f3ead8', 'letter-spacing': 2 });
    cycOut();
  }

  /* ---------- Hjulström–Sundborg ---------- */
  const HJ_E = logPts([[0.001, 500], [0.003, 200], [0.01, 60], [0.03, 33], [0.1, 23], [0.3, 20], [1, 21], [3, 42], [10, 105], [30, 190], [100, 330], [300, 560], [1000, 1000]]);
  const HJ_D = logPts([[0.001, 0.01], [0.01, 0.1], [0.03, 0.3], [0.1, 1.1], [0.3, 3.5], [1, 10], [3, 28], [10, 80], [30, 160], [100, 290], [300, 500], [1000, 850]]);
  const hjE = (ld) => Math.pow(10, crInterp(HJ_E, ld)), hjD = (ld) => Math.pow(10, crInterp(HJ_D, ld));
  const HJ = { ld: -0.3, lv: 1.5 };
  const HJPRE = [['clay', 'Clay', -2.7], ['silt', 'Silt', -1.5], ['sand', 'Fine sand', -0.7], ['csand', 'Coarse sand', 0], ['peb', 'Pebble', 1.3], ['boul', 'Boulder', 2.7]];
  const hx = (ld) => 58 + (ld + 3) / 6 * 328, hy = (lv) => 318 - (lv + 1) / 4 * 264;
  function grainName(d) { return d < 0.004 ? 'clay' : d < 0.0625 ? 'silt' : d < 2 ? 'sand' : d < 64 ? 'gravel' : d < 256 ? 'cobble' : 'boulder'; }
  function mmStr(d) { return d < 0.01 ? sig(d * 1000, 2) + ' µm' : d < 10 ? sig(d, 2) + ' mm' : d < 1000 ? fmt(d) + ' mm' : fmt(d / 1000, 1) + ' m'; }
  function vStr(v) { return v < 100 ? sig(v, 2) + ' cm/s' : sig(v / 100, 2) + ' m/s'; }
  function hjPaint() {
    const svg = $('#ebHj'); svg.innerHTML = ''; const K = tok(), L = light();
    const X0 = 58, X1 = 386, Y0 = 54, Y1 = 318;
    const N = 160, eP = [], dP = [];
    for (let i = 0; i <= N; i++) { const ld = -3 + 6 * i / N; eP.push([hx(ld), hy(clamp(Math.log10(hjE(ld)), -1.2, 3.2))]); dP.push([hx(ld), hy(clamp(Math.log10(hjD(ld)), -1.2, 3.2))]); }
    const clip = el('clipPath', { id: 'ebHjClip' }, el('defs', {}, svg)); el('rect', { x: X0, y: Y0, width: X1 - X0, height: Y1 - Y0 }, clip);
    const g = el('g', { 'clip-path': 'url(#ebHjClip)' }, svg);
    const line = (P) => P.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' ');
    el('path', { d: line(eP) + ` L ${X1} ${Y0 - 20} L ${X0} ${Y0 - 20} Z`, fill: L ? '#e98a3a' : '#d9822b', opacity: L ? 0.22 : 0.2 }, g);
    el('path', { d: line(eP) + ' L ' + dP.slice().reverse().map((p) => p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' L ') + ' Z', fill: '#3a8ee6', opacity: L ? 0.16 : 0.16 }, g);
    el('path', { d: line(dP) + ` L ${X1} ${Y1 + 20} L ${X0} ${Y1 + 20} Z`, fill: L ? '#b08d3c' : '#b49a5a', opacity: L ? 0.25 : 0.22 }, g);
    // grid
    for (let k = -3; k <= 3; k++) el('line', { x1: hx(k), x2: hx(k), y1: Y0, y2: Y1, stroke: K.line, 'stroke-width': 1, opacity: 0.6 }, g);
    for (let k = -1; k <= 3; k++) el('line', { x1: X0, x2: X1, y1: hy(k), y2: hy(k), stroke: K.line, 'stroke-width': 1, opacity: 0.6 }, g);
    el('path', { d: line(eP), fill: 'none', stroke: L ? '#b55a12' : '#f0a060', 'stroke-width': 2.5 }, g);
    el('path', { d: line(dP), fill: 'none', stroke: L ? '#7a6020' : '#d8c08a', 'stroke-width': 2, 'stroke-dasharray': '6 4' }, g);
    el('rect', { x: X0, y: Y0, width: X1 - X0, height: Y1 - Y0, fill: 'none', stroke: K.line }, svg);
    txt(svg, hx(1.6), hy(2.55), 'EROSION', T({ 'font-size': 13, fill: K.fg, 'text-anchor': 'middle', 'font-weight': 600, 'letter-spacing': 1 }));
    txt(svg, hx(-2.05), hy(0.55), 'TRANSPORT', T({ 'font-size': 13, fill: K.fg, 'text-anchor': 'middle', 'font-weight': 600, 'letter-spacing': 1 }));
    txt(svg, hx(1.4), hy(-0.55), 'DEPOSITION', T({ 'font-size': 13, fill: K.fg, 'text-anchor': 'middle', 'font-weight': 600, 'letter-spacing': 1 }));
    // axes
    ['0.001', '0.01', '0.1', '1', '10', '100', '1000'].forEach((s, i) => txt(svg, hx(i - 3), Y1 + 18, s, { 'font-size': 13, fill: K.muted, 'text-anchor': 'middle' }));
    ['0.1', '1', '10', '100', '1000'].forEach((s, i) => txt(svg, X0 - 6, hy(i - 1) + 4.5, s, { 'font-size': 13, fill: K.muted, 'text-anchor': 'end' }));
    txt(svg, (X0 + X1) / 2, 370, 'Grain size (mm)', { 'font-size': 13, fill: K.muted, 'text-anchor': 'middle' });
    txt(svg, 14, (Y0 + Y1) / 2, 'Flow velocity (cm/s)', { 'font-size': 13, fill: K.muted, 'text-anchor': 'middle', transform: `rotate(-90 14 ${(Y0 + Y1) / 2})` });
    // size classes on top
    [[-3, -2.4, 'clay'], [-2.4, -1.204, 'silt'], [-1.204, 0.301, 'sand'], [0.301, 1.806, 'gravel'], [1.806, 3, 'cobbles,|boulders']].forEach(([a, b, s], i) => {
      el('rect', { x: hx(a), y: 6, width: hx(b) - hx(a), height: 42, fill: i % 2 ? K.surface : K.line, opacity: i % 2 ? 1 : 0.35, stroke: K.line }, svg);
      const parts = s.split('|');
      parts.forEach((p, j) => txt(svg, (hx(a) + hx(b)) / 2, 31 + (j - (parts.length - 1) / 2) * 15, p, { 'font-size': 13, fill: K.fg, 'text-anchor': 'middle' }));
    });
    // marker
    const mx = hx(HJ.ld), my = hy(HJ.lv);
    el('line', { x1: mx, x2: mx, y1: Y0, y2: Y1, stroke: K.fg, 'stroke-width': 1, 'stroke-dasharray': '3 3', opacity: 0.6 }, svg);
    el('line', { x1: X0, x2: X1, y1: my, y2: my, stroke: K.fg, 'stroke-width': 1, 'stroke-dasharray': '3 3', opacity: 0.6 }, svg);
    el('circle', { cx: mx, cy: my, r: 7, fill: K.accent, stroke: K.surface, 'stroke-width': 2.5 }, svg);
  }
  function hjUpdate() {
    const d = Math.pow(10, HJ.ld), v = Math.pow(10, HJ.lv), E = hjE(HJ.ld), D = hjD(HJ.ld), nm = grainName(d);
    $('#ebHjDOut').textContent = mmStr(d) + ' (' + nm + ')';
    $('#ebHjVOut').textContent = vStr(v) + ' (' + sig(v * 0.036, 2) + ' km/h)';
    let h, p;
    if (v >= E) { h = 'Eroded'; p = `At ${vStr(v)} the flow can lift a ${mmStr(d)} ${nm} grain off the bed and carry it away. It needs at least about ${vStr(E)}.`; }
    else if (v >= D) { h = 'Kept moving, but not picked up'; p = `Lifting a resting ${nm} grain off the bed needs about ${vStr(E)}. One already in the flow keeps travelling until the water slows below about ${vStr(D)}.`; }
    else { h = 'Deposited'; p = `Below about ${vStr(D)} a ${mmStr(d)} grain sinks out of the water and settles on the bed.`; }
    let extra = '';
    if (d < 0.02 && v < E) extra = '<p><b>Why is clay so hard to erode?</b> Clay flakes are tiny and flat. They pack into a smooth layer held together by electrical attraction between the flakes (cohesion), and the flow cannot get under any single grain. Yet once stirred up, clay sinks so slowly that almost any current keeps it suspended. That is why muddy rivers stay muddy.</p>';
    else if (d >= 0.1 && d <= 2) extra = '<p>Sand around 0.1 to 2 mm is the easiest sediment to erode: too coarse to stick together, light enough to roll.</p>';
    else if (d > 64) extra = '<p>Boulders mostly move in floods. Flow speed rises a lot in a flood, and the force on a grain grows roughly with the square of the speed.</p>';
    $('#ebHjOut').innerHTML = `<p class="h">${mmStr(d)} ${nm} at ${vStr(v)}</p><p class="nm">${h}</p><p>${p}</p>${extra}`;
    segSync($('#ebHjPre'), (HJPRE.find((q) => Math.abs(q[2] - HJ.ld) < 0.005) || [''])[0]);
    hjPaint();
  }

  /* ---------- rock cycle ---------- */
  const ROCK = {
    igneous: { t: 'Rock type', n: 'Igneous rock', ex: 'Granite, basalt, obsidian', d: 'Forms when magma or lava cools and crystallises. Cooling slowly deep underground grows large crystals (granite); cooling fast at the surface gives fine grains or glass (basalt, obsidian). The ocean floor is mostly basalt.', w: 'Water lowers the melting point of hot mantle rock. Water carried down by sinking plates is why chains of volcanoes line the Pacific.' },
    sediment: { t: 'Loose material', n: 'Sediment', ex: 'Sand, mud, gravel, shells, dissolved minerals', d: 'Broken and dissolved pieces of older rock, plus the remains of living things.', w: 'Rivers, waves, glaciers and wind move it, and water sorts it by size: gravel near the source, mud far out in quiet water.' },
    sedimentary: { t: 'Rock type', n: 'Sedimentary rock', ex: 'Sandstone, shale, limestone', d: 'Layers of sediment buried, squeezed and glued together. Sedimentary rocks cover about three-quarters of the land but make up only a few percent of the crust by volume. They hold almost all fossils.', w: 'Water seeping through the buried sediment leaves minerals (calcite, silica, iron oxides) between the grains, cementing them. Limestone is mostly shells of sea creatures.' },
    metamorphic: { t: 'Rock type', n: 'Metamorphic rock', ex: 'Marble (from limestone), slate (from shale), quartzite (from sandstone), gneiss (from granite)', d: 'Any rock changed by heat and pressure without melting, usually many kilometres down or beside a body of magma. Minerals regrow, often lined up in bands.', w: 'Hot water-rich fluids speed up the regrowth of minerals and carry elements in and out. Many ore deposits, including much of the world\'s gold, formed this way.' },
    magma: { t: 'Molten rock', n: 'Magma', ex: 'Molten rock at roughly 700–1,300 °C', d: 'Forms where hot mantle rises and its pressure drops, where water is added to it, or where hot magma melts the crust above it.', w: 'Dissolved water and gas make magma explosive as it rises and the pressure drops, like opening a shaken bottle.' },
    cool: { t: 'Process', n: 'Cooling and crystallising', ex: 'Magma → igneous rock', d: 'As magma cools, minerals crystallise in a set order, starting with olivine at the highest temperatures and ending with quartz. Lava on the surface can harden in hours; a large granite body underground takes up to millions of years.', w: 'Sea water quenches lava almost instantly into pillow-shaped blobs and glass.' },
    weather: { t: 'Process', n: 'Weathering and erosion', ex: 'Any rock at the surface → sediment', d: 'Weathering breaks and dissolves rock where it is; erosion carries the pieces away. Rivers, glaciers, waves and wind all erode, but running water moves the most material.', w: 'Frost wedging, acidic rain and rivers carrying sand all depend on water. On the dry, airless Moon, rock wears down millions of times more slowly.' },
    depo: { t: 'Process', n: 'Deposition and cementation', ex: 'Sediment → sedimentary rock', d: 'When the water slows, its load settles (see the diagram above). New layers bury older ones, squeezing out water and pressing grains together, and minerals precipitate between them.', w: 'Water is both the delivery truck and the glue.' },
    heat: { t: 'Process', n: 'Heat and pressure', ex: 'Igneous or sedimentary rock → metamorphic rock', d: 'Rock buried deep, squeezed where plates collide or baked beside magma recrystallises into new minerals while staying solid.', w: 'A little water in the pore spaces lets atoms move between minerals much faster.' },
    melt: { t: 'Process', n: 'Melting', ex: 'Metamorphic (or any) rock → magma', d: 'Deep enough and hot enough, rock starts to melt. It melts partly: the first liquid is richer in silica than the rock it came from, which is how continents slowly separated from the mantle.', w: 'Wet rock melts at a temperature hundreds of degrees lower than dry rock. This is the main reason magma forms above subduction zones.' },
  };
  let rockSel = 'weather';
  function rockOut() { const r = ROCK[rockSel]; $('#ebRockOut').innerHTML = `<p class="h">${r.t}</p><p class="nm">${r.n}</p><p><b>${r.ex}.</b> ${r.d}</p><p><b>Water's part:</b> ${r.w}</p>`; $$('#ebRock [data-k]').forEach((g) => g.classList.toggle('eb-on', g.dataset.k === rockSel)); }
  function rockPaint() {
    const svg = $('#ebRock'); svg.innerHTML = ''; const K = tok(), L = light();
    const cx = 200, cy = 205, R = 140;
    const ang = [-90, -18, 54, 126, 198].map((a) => a * D2R);
    const P = ang.map((a) => [cx + R * Math.cos(a), cy + R * Math.sin(a)]);
    // order: igneous(top), sediment(UR), sedimentary(LR), metamorphic(LL), magma(UL)
    const NODES = [['igneous', 'Igneous', L ? '#c9b8a6' : '#8c7b6a'], ['sediment', 'Sediment', L ? '#e3cf9b' : '#a68f55'], ['sedimentary', 'Sedimentary', L ? '#d7b98a' : '#8f7146'], ['metamorphic', 'Metamorphic', L ? '#b6b9c9' : '#6c7391'], ['magma', 'Magma', '#e2562c']];
    const edges = [[4, 0, 'cool', 'cooling', 0.5], [0, 1, 'weather', 'weathering|& erosion', 0.5], [1, 2, 'depo', 'deposition|& cementing', 0.5], [2, 3, 'heat', 'heat &|pressure', 0.5, 36], [3, 4, 'melt', 'melting', 0.5], [0, 3, 'heat', 'heat &|pressure', 0.42], [3, 1, 'weather', 'weathering|& erosion', 0.4]];
    const gA = el('g', {}, svg), gC = el('g', {}, svg), gN = el('g', {}, svg);
    edges.forEach(([a, b, k, lab, t, off]) => {
      const [x1, y1] = P[a], [x2, y2] = P[b], len = Math.hypot(x2 - x1, y2 - y1), ux = (x2 - x1) / len, uy = (y2 - y1) / len;
      const s1 = 34, s2 = 38;
      const ax = x1 + ux * s1, ay = y1 + uy * s1, bx = x2 - ux * s2, by = y2 - uy * s2;
      el('line', { x1: ax, y1: ay, x2: bx - ux * 8, y2: by - uy * 8, stroke: K.muted, 'stroke-width': 2.2 }, gA);
      head(gA, ax, ay, bx, by, 13, K.muted);
      const mx = x1 + (x2 - x1) * t, my = y1 + (y2 - y1) * t + (off || 0), parts = lab.split('|');
      const g = el('g', { 'data-k': k, class: 'eb-chip' }, gC);
      const w = Math.max(...parts.map((p) => p.length)) * 7.1 + 14, h = parts.length * 16 + 8;
      el('rect', { x: mx - w / 2, y: my - h / 2, width: w, height: h, rx: 7, fill: K.surface, stroke: K.line, 'stroke-width': 1.2 }, g);
      parts.forEach((p, j) => txt(g, mx, my + 5 + (j - (parts.length - 1) / 2) * 16, p, { 'font-size': 13, fill: K.fg, 'text-anchor': 'middle' }));
      asButton(g, ROCK[k].n, () => { rockSel = k; rockOut(); });
    });
    NODES.forEach(([k, n, col], i) => {
      const [x, y] = P[i], w = n.length * 8.6 + 20, h = 40;
      const g = el('g', { 'data-k': k, class: 'eb-node' }, gN);
      el('rect', { x: x - w / 2, y: y - h / 2, width: w, height: h, rx: k === 'magma' ? 20 : 8, fill: col, stroke: K.line, 'stroke-width': 1.2 }, g);
      txt(g, x, y + 5.5, n, { 'font-size': 15, 'font-weight': 700, fill: k === 'magma' ? '#fff8ee' : '#1b1712', 'text-anchor': 'middle' });
      asButton(g, ROCK[k].n, () => { rockSel = k; rockOut(); });
    });
    rockOut();
  }

  function setupWater() {
    segBuild($('#ebResMode'), [['all', 'All water'], ['fresh', 'Fresh water only']], W.mode, (k) => { W.mode = k; segSync($('#ebResMode'), k); resPaint(); });
    segBuild($('#ebResScale'), [['lin', 'Linear'], ['log', 'Log scale']], W.scale, (k) => { W.scale = k; segSync($('#ebResScale'), k); resPaint(); });
    waterFacts(); resPaint();
    const play = $('#ebCyclePlay'), svg = $('#ebCycle');
    let flowing = !RM();
    const syncFlow = () => { play.setAttribute('aria-pressed', String(flowing)); play.textContent = flowing ? 'Pause flow' : 'Play flow'; };
    watcher(svg, 'water', (on) => svg.classList.toggle('eb-run', on && flowing));
    play.addEventListener('click', () => { flowing = !flowing; syncFlow(); svg.classList.toggle('eb-run', flowing && !$('#water').hidden); });
    syncFlow();
    segBuild($('#ebHjPre'), HJPRE.map(([k, n]) => [k, n]), 'csand', (k) => { const p = HJPRE.find((q) => q[0] === k); HJ.ld = p[2]; $('#ebHjD').value = p[2]; hjUpdate(); });
    $('#ebHjD').addEventListener('input', (e) => { HJ.ld = +e.target.value; hjUpdate(); });
    $('#ebHjV').addEventListener('input', (e) => { HJ.lv = +e.target.value; hjUpdate(); });
    HJ.ld = +$('#ebHjD').value; HJ.lv = +$('#ebHjV').value;
    const hs = $('#ebHj');
    const drag = (e) => { const p = svgPoint(hs, e); if (p.x < 58 || p.x > 386 || p.y < 54 || p.y > 318) return; HJ.ld = clamp((p.x - 58) / 328 * 6 - 3, -3, 3); HJ.lv = clamp((318 - p.y) / 264 * 4 - 1, -1, 3); $('#ebHjD').value = HJ.ld; $('#ebHjV').value = HJ.lv; hjUpdate(); };
    hs.addEventListener('pointerdown', (e) => { drag(e); hs.setPointerCapture(e.pointerId); });
    hs.addEventListener('pointermove', (e) => { if (e.buttons) drag(e); });
    hs.style.touchAction = 'pan-y';
  }
  function paintWater() { cyclePaint(); hjUpdate(); rockPaint(); }

  /* =====================================================================
     AIR & MAGNETISM
     ===================================================================== */
  const R0 = 6356.766;
  function atmT(z) { // geometric km → K, US Standard Atmosphere 1976
    if (z <= 86) {
      const h = R0 * z / (R0 + z);
      const B = [[0, 288.15, -6.5], [11, 216.65, 0], [20, 216.65, 1], [32, 228.65, 2.8], [47, 270.65, 0], [51, 270.65, -2.8], [71, 214.65, -2]];
      let i = B.length - 1; while (h < B[i][0]) i--;
      return B[i][1] + B[i][2] * (h - B[i][0]);
    }
    if (z <= 91) return 186.87;
    if (z <= 110) { const a = -19.9429, A = -76.3232, Tc = 263.1905; return Tc + A * Math.sqrt(Math.max(0, 1 - Math.pow((z - 91) / a, 2))); }
    if (z <= 120) return 240 + 12 * (z - 110);
    const xi = (z - 120) * (R0 + 120) / (R0 + z); return 1000 - 640 * Math.exp(-0.01875 * xi);
  }
  // pressure: hydrostatic integration to 86 km, then 1976 table (log-interpolated)
  const PTAB = [[86, 0.3734], [90, 0.1836], [100, 0.03201], [110, 0.007104], [120, 0.002538], [150, 4.542e-4], [200, 8.474e-5], [250, 2.477e-5], [300, 8.770e-6], [400, 1.452e-6], [500, 3.024e-7], [600, 8.213e-8]];
  const PLOW = (() => { const out = [[0, 101325]]; let p = 101325; const dz = 0.05; for (let z = 0; z < 86 - 1e-9; z += dz) { const zm = z + dz / 2, g = 9.80665 * Math.pow(6371 / (6371 + zm), 2); p *= Math.exp(-0.0289644 * g * dz * 1000 / (8.31446 * atmT(zm))); out.push([z + dz, p]); } return out; })();
  function atmP(z) {
    if (z <= 86) { const i = Math.min(PLOW.length - 2, Math.floor(z / 0.05)), a = PLOW[i], b = PLOW[i + 1]; return Math.exp(Math.log(a[1]) + (Math.log(b[1]) - Math.log(a[1])) * (z - a[0]) / (b[0] - a[0])); }
    let i = 0; while (i < PTAB.length - 2 && PTAB[i + 1][0] < z) i++;
    const a = PTAB[i], b = PTAB[i + 1]; return Math.exp(Math.log(a[1]) + (Math.log(b[1]) - Math.log(a[1])) * (z - a[0]) / (b[0] - a[0]));
  }
  const LAYERS = [[0, 11, 'Troposphere', '#5fa0d8'], [11, 50, 'Stratosphere', '#7fb4a0'], [50, 85, 'Mesosphere', '#9a8fd0'], [85, 600, 'Thermosphere', '#d08f7a']];
  const layerOf = (z) => (LAYERS.find((l) => z < l[1]) || LAYERS[3])[2];
  function atmWhat(z) {
    if (z < 2) return 'Where we live. Nearly all weather, cloud and water vapour is in the troposphere, warmed from below by the ground, so the air gets colder as you climb (about 6.5 °C per km).';
    if (z < 8) return 'The air thins fast. At about 5.5 km, half of the atmosphere\'s mass is below you. The pressure halves roughly every 5.5 km here.';
    if (z < 9.5) return 'Mount Everest\'s summit is 8.85 km up, with about a third of sea-level pressure. Climbers there breathe a third of the oxygen they would at sea level.';
    if (z < 13) return 'Airliners cruise at about 10 to 12 km, close to the tropopause, where the temperature stops falling. The tropopause is 8 km up near the poles and 16 to 18 km over the tropics.';
    if (z < 20) return 'The lower stratosphere: cold, very dry and calm. The temperature here holds steady before starting to rise.';
    if (z < 36) return 'The ozone layer. Most of the atmosphere\'s ozone is between about 15 and 35 km. It absorbs the Sun\'s ultraviolet light and is heated by it, which is why the stratosphere warms with height. Weather balloons burst at about 30 to 35 km.';
    if (z < 50) return 'The top of the stratosphere warms to about 271 K (−2 °C) at the stratopause, where ozone heating peaks.';
    if (z < 75) return 'The mesosphere: the temperature falls again. Too high for balloons and too low for satellites, so it is the least explored layer.';
    if (z < 86) return 'The coldest part of the atmosphere, about 187 K (−86 °C) near 85 km. Faint noctilucent clouds form near 83 km. Meteors glow and mostly burn up between about 100 and 70 km.';
    if (z < 99) return 'The thermosphere begins. The thin gas absorbs the Sun\'s extreme ultraviolet and X-rays, so temperature rises steeply with height.';
    if (z < 102) return 'The Kármán line, 100 km: the usual boundary of space. Above it, a wing would have to fly at orbital speed to get any lift.';
    if (z < 300) return 'Aurora glow here, mostly between 100 and 300 km, where particles from the magnetosphere hit oxygen and nitrogen atoms.';
    if (z < 470) return 'The International Space Station orbits at about 400 to 420 km. The air is thin but still causes drag, so the station needs regular engine boosts.';
    return 'The exosphere starts somewhere between about 500 and 1,000 km, depending on the Sun. Atoms here rarely collide, and the fastest escape to space.';
  }
  const A = { range: 'low', z: 8.8, pointer: false };
  function atmPaint() {
    const svg = $('#ebAtm'); svg.innerHTML = ''; const K = tok(), L = light();
    const lo = A.range === 'low', zmax = lo ? 120 : 600, tmin = lo ? 160 : 150, tmax = lo ? 380 : 1050;
    const X0 = 54, X1 = 388, Y0 = 16, Y1 = 410;
    const X = (t) => X0 + (t - tmin) / (tmax - tmin) * (X1 - X0), Y = (z) => Y1 - z / zmax * (Y1 - Y0);
    LAYERS.forEach(([a, b, n, col], i) => {
      if (a >= zmax) return;
      el('rect', { x: X0, y: Y(Math.min(b, zmax)), width: X1 - X0, height: Y(a) - Y(Math.min(b, zmax)), fill: col, opacity: L ? 0.16 : 0.13 }, svg);
    });
    // grid + axes
    const zt = lo ? [0, 20, 40, 60, 80, 100, 120] : [0, 100, 200, 300, 400, 500, 600];
    zt.forEach((z) => { el('line', { x1: X0, x2: X1, y1: Y(z), y2: Y(z), stroke: K.line, opacity: 0.5 }, svg); txt(svg, X0 - 6, Y(z) + 4.5, String(z), { 'font-size': 13, fill: K.muted, 'text-anchor': 'end' }); });
    const tt = lo ? [200, 250, 300, 350] : [200, 400, 600, 800, 1000];
    tt.forEach((t) => { el('line', { x1: X(t), x2: X(t), y1: Y0, y2: Y1, stroke: K.line, opacity: 0.35 }, svg); txt(svg, X(t), Y1 + 18, String(t), { 'font-size': 13, fill: K.muted, 'text-anchor': 'middle' }); });
    txt(svg, (X0 + X1) / 2, 452, 'Temperature (K)', { 'font-size': 13, fill: K.muted, 'text-anchor': 'middle' });
    txt(svg, 14, (Y0 + Y1) / 2, 'Height (km)', { 'font-size': 13, fill: K.muted, 'text-anchor': 'middle', transform: `rotate(-90 14 ${(Y0 + Y1) / 2})` });
    el('rect', { x: X0, y: Y0, width: X1 - X0, height: Y1 - Y0, fill: 'none', stroke: K.line }, svg);
    // features
    if (lo) {
      el('rect', { x: X0, y: Y(35), width: X1 - X0, height: Y(15) - Y(35), fill: '#7fb4a0', opacity: 0.18 }, svg);
      txt(svg, X1 - 6, Y(25) + 4, 'ozone layer', T({ 'font-size': 13, fill: K.fg, 'text-anchor': 'end' }));
      el('line', { x1: X0, x2: X1, y1: Y(100), y2: Y(100), stroke: K.fg, 'stroke-dasharray': '5 4', opacity: 0.7 }, svg);
      txt(svg, X1 - 6, Y(100) - 5, 'Kármán line', T({ 'font-size': 13, fill: K.fg, 'text-anchor': 'end' }));
      txt(svg, X1 - 6, Y(82) + 4, 'meteors burn up', T({ 'font-size': 13, fill: K.fg, 'text-anchor': 'end' }));
      txt(svg, X1 - 6, Y(8.8) + 4, '▲ Everest', T({ 'font-size': 13, fill: K.fg, 'text-anchor': 'end' }));
      [[5.5, 'Troposphere'], [44, 'Stratosphere'], [62, 'Mesosphere'], [110, 'Thermosphere']].forEach(([z, n]) => txt(svg, X0 + 6, Y(z) + 4, n, T({ 'font-size': 13, fill: K.fg, 'font-weight': 600 })));
    } else {
      el('rect', { x: X0, y: Y(300), width: X1 - X0, height: Y(100) - Y(300), fill: '#5ee6a8', opacity: 0.1 }, svg);
      txt(svg, X0 + 6, Y(200) + 4, 'aurora (100–300 km)', T({ 'font-size': 13, fill: K.fg }));
      el('line', { x1: X0, x2: X1, y1: Y(420), y2: Y(420), stroke: K.fg, 'stroke-dasharray': '5 4', opacity: 0.7 }, svg);
      txt(svg, X0 + 6, Y(420) - 6, 'Space Station (~420 km)', T({ 'font-size': 13, fill: K.fg }));
      txt(svg, X0 + 6, Y(540) + 4, 'Thermosphere', T({ 'font-size': 13, fill: K.fg, 'font-weight': 600 }));
      txt(svg, X1 - 6, Y(40) + 4, 'lower layers: switch to 0–120 km', T({ 'font-size': 13, fill: K.muted, 'text-anchor': 'end' }));
      el('line', { x1: X0, x2: X1, y1: Y(100), y2: Y(100), stroke: K.fg, 'stroke-dasharray': '2 4', opacity: 0.5 }, svg);
      txt(svg, X1 - 6, Y(100) - 5, '100 km', T({ 'font-size': 13, fill: K.muted, 'text-anchor': 'end' }));
    }
    // profile
    let d = ''; for (let i = 0; i <= 600; i++) { const z = zmax * i / 600; d += (i ? 'L' : 'M') + X(atmT(z)).toFixed(1) + ' ' + Y(z).toFixed(1); }
    el('path', { d, fill: 'none', stroke: K.accent, 'stroke-width': 3, 'stroke-linejoin': 'round' }, svg);
    // probe
    const z = Math.min(A.z, zmax), t = atmT(z);
    el('line', { x1: X0, x2: X1, y1: Y(z), y2: Y(z), stroke: K.fg, 'stroke-width': 1.2, opacity: 0.8 }, svg);
    el('circle', { cx: X(t), cy: Y(z), r: 6.5, fill: K.accent, stroke: K.surface, 'stroke-width': 2.5 }, svg);
  }
  function pStr(p) { return p >= 100 ? fmt(p / 100, p >= 1000 ? 0 : 1) + ' hPa' : p >= 0.01 ? sig(p, 2) + ' Pa' : sig(p / Math.pow(10, Math.floor(Math.log10(p))), 2) + ' × 10' + sup(Math.floor(Math.log10(p))) + ' Pa'; }
  function sup(n) { const m = { '-': '⁻', 0: '⁰', 1: '¹', 2: '²', 3: '³', 4: '⁴', 5: '⁵', 6: '⁶', 7: '⁷', 8: '⁸', 9: '⁹' }; return String(n).split('').map((c) => m[c]).join(''); }
  function fracStr(f) { if (f >= 0.01) return fmt(100 * f, f >= 0.1 ? 0 : 1) + '%'; const e = Math.floor(Math.log10(f)); return sig(f / Math.pow(10, e), 2) + ' × 10' + sup(e); }
  function atmUpdate() {
    const z = A.z, t = atmT(z), p = atmP(z);
    $('#ebAtmZOut').textContent = (z < 10 ? fmt(z, 1) : fmt(z)) + ' km';
    $('#ebAtmOut').innerHTML = `<p class="h">${layerOf(z)} · ${z < 10 ? fmt(z, 1) : fmt(z)} km</p><p class="nm">${fmt(t)} K (${fmt(t - 273.15)} °C)</p><p>${atmWhat(z)}</p>`;
    $('#ebAtmFacts').innerHTML = [
      ['Pressure', pStr(p)],
      ['Share of the air above this height', fracStr(p / 101325)],
      ['Scale height here (RT/Mg)', fmt(8.314 * t / (0.02896 * 9.81) / 1000, 1) + ' km' + (z > 100 ? ' (rough: lighter gases up here)' : '')],
    ].map(([a, b]) => `<div><dt>${a}</dt><dd>${b}</dd></div>`).join('');
    atmPaint();
  }
  function compPaint() {
    const C = [['Nitrogen N₂', 78.08, '#5f8fd8'], ['Oxygen O₂', 20.95, '#62c49a'], ['Argon Ar', 0.934, '#c59be0'], ['Carbon dioxide CO₂', 0.0426, '#e0a050'], ['Neon, helium, methane…', 0.0025, '#9aa2c2']];
    $('#ebComp').innerHTML = `<div class="eb-comp-bar">${C.map(([n, v, c]) => `<i style="width:${v}%;background:${c}" title="${n}"></i>`).join('')}</div><ul class="eb-comp-list">${C.map(([n, v, c]) => `<li><span class="dot" style="background:${c}"></span>${n}<b>${v >= 1 ? fmt(v, 2) + '%' : v >= 0.01 ? (v === 0.0426 ? '0.0426% (426 ppm)' : fmt(v, 3) + '%') : '~25 ppm'}</b></li>`).join('')}</ul>`;
  }
  function setupAir() {
    const zr = $('#ebAtmZ');
    segBuild($('#ebAtmRange'), [['low', '0–120 km'], ['high', '0–600 km']], A.range, (k) => { A.range = k; segSync($('#ebAtmRange'), k); zr.max = k === 'low' ? 120 : 600; zr.step = k === 'low' ? 0.5 : 2; if (A.z > +zr.max) A.z = +zr.max; if (k === 'high' && A.z < 100) A.z = 420; zr.value = A.z; atmUpdate(); });
    zr.addEventListener('input', () => { A.z = +zr.value; atmUpdate(); });
    const svg = $('#ebAtm');
    const probe = (e) => { const p = svgPoint(svg, e), zmax = A.range === 'low' ? 120 : 600; if (p.y < 16 || p.y > 410 || p.x < 54) return; A.z = Math.round(clamp((410 - p.y) / 394 * zmax, 0, zmax) * 2) / 2; zr.value = A.z; atmUpdate(); };
    svg.addEventListener('pointermove', (e) => { if (e.pointerType === 'mouse' || e.buttons) probe(e); });
    svg.addEventListener('pointerdown', probe);
    svg.style.touchAction = 'pan-y';
    compPaint();
    setupGh(); setupMag();
  }

  /* ---------- greenhouse ---------- */
  const SIG = 5.670374e-8;
  const G = { S: 1361, a: 0.3, e: 0.78, pre: 'earth' };
  const GPRE = { earth: ['Earth', 1361, 0.3, 0.78], none: ['Earth, no greenhouse', 1361, 0.3, 0], mars: ['Mars', 586, 0.25, 0.1], venus: ['Venus', 2601, 0.76, 1] };
  function ghCalc() { const Te = Math.pow(G.S * (1 - G.a) / (4 * SIG), 0.25), Ts = Te * Math.pow(2 / (2 - G.e), 0.25), Ta = Ts / Math.pow(2, 0.25); return { Te, Ts, Ta }; }
  function ghPaint() {
    const svg = $('#ebGh'); svg.innerHTML = ''; const K = tok(), L = light(); const { Te, Ts, Ta } = ghCalc();
    const inA = G.S * (1 - G.a) / 4, refl = G.S * G.a / 4, up = SIG * Math.pow(Ts, 4), thru = (1 - G.e) * up, lay = G.e * SIG * Math.pow(Ta, 4);
    const wd = (f) => 2 + f * 0.035;
    el('rect', { x: 0, y: 0, width: 400, height: 330, fill: L ? '#e9eef8' : '#0b1024' }, svg);
    txt(svg, 10, 22, 'SPACE', { 'font-size': 13, fill: K.muted, 'letter-spacing': 1.5 });
    // layer
    el('rect', { x: 0, y: 128, width: 400, height: 34, fill: L ? '#7a8fb8' : '#6d84c4', opacity: 0.12 + 0.55 * G.e }, svg);
    txt(svg, 392, 150, 'absorbing layer, ε = ' + fmt(G.e, 2), T({ 'font-size': 13, fill: K.fg, 'text-anchor': 'end', stroke: L ? '#e9eef8' : '#0b1024' }));
    // ground coloured by temperature
    const hot = clamp((Ts - 200) / 120, 0, 1);
    const gcol = Ts > 600 ? '#c8562a' : `rgb(${Math.round(90 + 110 * hot)},${Math.round(120 - 30 * hot)},${Math.round(160 - 120 * hot)})`;
    el('path', { d: 'M0 270 Q200 252 400 270 V330 H0 Z', fill: gcol }, svg);
    txt(svg, 200, 300, 'Surface ' + fmt(Ts) + ' K (' + fmt(Ts - 273.15) + ' °C)', { 'font-size': 15, 'font-weight': 700, fill: '#ffffff', 'text-anchor': 'middle', stroke: '#00000066', 'stroke-width': 3, 'paint-order': 'stroke' });
    const arr = (x1, y1, x2, y2, f, col) => { const w = wd(f), hs = w + 9, len = Math.hypot(x2 - x1, y2 - y1), ux = (x2 - x1) / len, uy = (y2 - y1) / len; if (f < 0.5) return; el('line', { x1, y1, x2: x2 - ux * hs * 0.8, y2: y2 - uy * hs * 0.8, stroke: col, 'stroke-width': w }, svg); head(svg, x1, y1, x2, y2, hs, col); };
    const sun = '#f2b630', ir = L ? '#c8452c' : '#ff7a5c';
    arr(40, 34, 92, 258, inA, sun);
    arr(118, 252, 150, 40, refl, L ? '#c9a227' : '#ffe08a');
    arr(220, 262, 220, 132, up, ir);
    arr(220, 128, 220, 36, thru, ir);
    arr(300, 128, 300, 36, lay, ir);
    arr(345, 162, 345, 258, lay, ir);
    const lab = (x, y, a, s1, s2, anchor) => { txt(svg, x, y, s1, T({ 'font-size': 13, fill: K.fg, 'text-anchor': anchor || 'start', stroke: L ? '#e9eef8' : '#0b1024' })); txt(svg, x, y + 15, s2, T({ 'font-size': 13, fill: K.fg, 'text-anchor': anchor || 'start', 'font-weight': 600, stroke: L ? '#e9eef8' : '#0b1024' })); };
    lab(24, 216, 0, 'sunlight', fmt(inA) + ' W/m²', 'start');
    lab(134, 84, 0, 'reflected', fmt(refl), 'start');
    lab(228, 206, 0, 'surface IR', fmt(up), 'start');
    if (thru >= 0.5) lab(228, 60, 0, 'escapes', fmt(thru), 'start');
    if (lay >= 0.5) { lab(308, 84, 0, 'layer IR', fmt(lay), 'start'); lab(337, 212, 0, 'back', fmt(lay), 'end'); }
  }
  function ghUpdate() {
    const { Te, Ts } = ghCalc();
    $('#ebGhSOut').textContent = fmt(G.S) + ' W/m²' + (Math.abs(G.S - 1361) < 1 ? ' (Earth)' : Math.abs(G.S - 2601) < 1 ? ' (Venus)' : Math.abs(G.S - 586) < 1 ? ' (Mars)' : '');
    $('#ebGhAOut').textContent = fmt(G.a, 2); $('#ebGhEOut').textContent = fmt(G.e, 2);
    $('#ebGhFacts').innerHTML = [
      ['No-greenhouse temperature, T<sub>e</sub>', fmt(Te) + ' K (' + fmt(Te - 273.15) + ' °C)'],
      ['Surface temperature in this model', fmt(Ts) + ' K (' + fmt(Ts - 273.15) + ' °C)'],
      ['Greenhouse warming', '+' + fmt(Ts - Te) + ' K'],
    ].map(([a, b]) => `<div><dt>${a}</dt><dd>${b}</dd></div>`).join('');
    const notes = {
      earth: 'Real Earth: about 288 K (15 °C) on average. With ε = 0 it would be about 255 K (−18 °C), frozen over. Water vapour and CO₂ supply most of the difference.',
      none: 'Without infrared-absorbing gases Earth would sit near 255 K (−18 °C). Clouds would vanish too, which would lower the albedo, so this is only a rough figure.',
      mars: 'Real Mars: about 210 K (−63 °C) on average. Its air is about 95% CO₂, but so thin (under 1% of Earth\'s surface pressure) that it adds only a few kelvin.',
      venus: 'Real Venus: about 737 K (464 °C), hotter than Mercury. This model stops at ' + fmt(Te * Math.pow(2, 0.25)) + ' K even with ε = 1. A thick atmosphere behaves like many layers, each warming the one below; a one-layer model cannot reach it.',
    };
    $('#ebGhNote').textContent = notes[G.pre] || 'Your own planet. Pick a preset to compare with a real one.';
    segSync($('#ebGhPre'), G.pre);
    ghPaint();
  }
  function setupGh() {
    segBuild($('#ebGhPre'), Object.entries(GPRE).map(([k, v]) => [k, v[0]]), G.pre, (k) => { const v = GPRE[k]; G.pre = k; G.S = v[1]; G.a = v[2]; G.e = v[3]; $('#ebGhS').value = G.S; $('#ebGhA').value = G.a; $('#ebGhE').value = G.e; ghUpdate(); });
    [['#ebGhS', 'S'], ['#ebGhA', 'a'], ['#ebGhE', 'e']].forEach(([id, k]) => $(id).addEventListener('input', (e) => { G[k] = +e.target.value; G.pre = Object.keys(GPRE).find((p) => GPRE[p][1] === G.S && Math.abs(GPRE[p][2] - G.a) < 1e-6 && Math.abs(GPRE[p][3] - G.e) < 1e-6) || ''; ghUpdate(); }));
  }

  /* ---------- magnetosphere ---------- */
  const M = { lp: 0.301 };
  const MPRE = [['quiet', 'Quiet (1 nPa)', 0], ['typ', 'Typical (2 nPa)', 0.301], ['storm', 'Storm (10 nPa)', 1], ['ext', 'Extreme (30 nPa)', 1.477]];
  const mpR = (P) => 10 * Math.pow(P / 2, -1 / 6);
  function magPaint() {
    const svg = $('#ebMag'); svg.innerHTML = ''; const K = tok(), L = light();
    const P = Math.pow(10, M.lp), r0 = mpR(P), k = 15, cx = 300, cy = 235;
    const X = (x) => cx + x * k, Y = (y) => cy - y * k;      // x: + = away from Sun (right)
    el('rect', { x: 0, y: 0, width: 900, height: 470, fill: L ? '#eef1f8' : '#060914' }, svg);
    const clip = el('clipPath', { id: 'ebMagClip' }, el('defs', {}, svg)); el('rect', { x: 0, y: 0, width: 900, height: 470 }, clip);
    const g = el('g', { 'clip-path': 'url(#ebMagClip)' }, svg);
    // magnetopause (Shue-like shape, flaring alpha 0.5 for display)
    const mp = (th) => r0 * Math.pow(2 / (1 + Math.cos(th)), 0.5);
    let dm = ''; for (let i = -170; i <= 170; i += 2) { const th = i * D2R, r = mp(th); dm += (i === -170 ? 'M' : 'L') + X(-r * Math.cos(th)).toFixed(1) + ' ' + Y(r * Math.sin(th)).toFixed(1); }
    const rb = 1.3 * r0, e = 0.8; let db = ''; for (let i = -120; i <= 120; i += 2) { const th = i * D2R, r = rb * (1 + e) / (1 + e * Math.cos(th)); db += (i === -120 ? 'M' : 'L') + X(-r * Math.cos(th)).toFixed(1) + ' ' + Y(r * Math.sin(th)).toFixed(1); }
    // magnetosheath fill
    el('path', { d: db, fill: L ? '#f6dcc4' : '#2a1a14', opacity: 0.7, stroke: 'none' }, g);
    el('path', { d: dm, fill: L ? '#e4ebf7' : '#0d1530', stroke: 'none' }, g);
    // solar wind
    const sw = L ? '#c46a1a' : '#ffb067';
    for (let i = 0; i < 9; i++) { const y = 30 + i * 52; const xe = Math.min(X(-rb * (1 + e) / (1 + e * Math.cos(Math.atan2(Math.abs((cy - y) / k), 1)))), 120) - 8; el('line', { x1: 8, y1: y, x2: Math.max(30, xe - 12), y2: y, stroke: sw, 'stroke-width': 2, opacity: 0.7, class: 'eb-sw' }, g); head(g, Math.max(30, xe - 12) - 10, y, Math.max(30, xe - 12) + 2, y, 9, sw); }
    el('path', { d: db, fill: 'none', stroke: sw, 'stroke-width': 2, 'stroke-dasharray': '7 5' }, g);
    el('path', { d: dm, fill: 'none', stroke: K.accent, 'stroke-width': 2.5 }, g);
    // field lines
    const fl = L ? '#3d5f9e' : '#7fa6e8';
    const Leff = (Lv) => Lv / Math.pow(1 + Math.pow(Lv / (0.96 * r0), 4), 0.25);
    const pathPts = (pts) => pts.map((p, i) => (i ? 'L' : 'M') + X(p[0]).toFixed(1) + ' ' + Y(p[1]).toFixed(1)).join(' ');
    [2, 3, 4.5, 6.5, 9, 13, 20].forEach((Lv) => { // dayside closed
      const Le = Leff(Lv), l0 = Math.acos(Math.sqrt(1 / Le)), pts = [];
      for (let i = 0; i <= 60; i++) { const lam = -l0 + 2 * l0 * i / 60, r = Le * Math.cos(lam) ** 2; pts.push([-r * Math.cos(lam), r * Math.sin(lam)]); }
      el('path', { d: pathPts(pts), fill: 'none', stroke: fl, 'stroke-width': 1.4, opacity: 0.9 }, g);
    });
    [2, 3, 4.5, 6.5, 8.5].forEach((Lv) => { // nightside closed, stretched
      const l0 = Math.acos(Math.sqrt(1 / Lv)), s = 1 + 0.03 * Lv * Lv * (10 / r0), pts = [];
      for (let i = 0; i <= 60; i++) { const lam = -l0 + 2 * l0 * i / 60, r = Lv * Math.cos(lam) ** 2; pts.push([r * Math.cos(lam) * (1 + (s - 1) * Math.cos(lam) ** 4), r * Math.sin(lam) * (1 - 0.03 * Lv * Math.cos(lam) ** 2)]); }
      el('path', { d: pathPts(pts), fill: 'none', stroke: fl, 'stroke-width': 1.4, opacity: 0.9 }, g);
    });
    const sc = r0 / 10;
    [[70, 2.6], [74, 4.6], [78, 6.8], [83, 9.2], [88, 11.8]].forEach(([lat, yT]) => { // open tail lines
      [1, -1].forEach((sg) => {
        const la = lat * D2R, x0 = Math.cos(la), y0 = Math.sin(la) * sg, Y2 = yT * sc * sg;
        const d = `M${X(x0)} ${Y(y0)} C ${X(x0 + 1.2)} ${Y(y0 + sg * 3.5 * sc)}, ${X(8)} ${Y(Y2)}, ${X(16)} ${Y(Y2)} L ${X(45)} ${Y(Y2 * 1.03)}`;
        el('path', { d, fill: 'none', stroke: fl, 'stroke-width': 1.4, opacity: 0.9 }, g);
      });
    });
    [[-88, 13.5], [-84, 15.5]].forEach(([lat, yT]) => { // dayside high-latitude lines swept over the poles
      [1, -1].forEach((sg) => {
        const la = Math.abs(lat) * D2R, x0 = -Math.cos(la), y0 = Math.sin(la) * sg, Y2 = yT * sc * sg;
        const d = `M${X(x0)} ${Y(y0)} C ${X(x0 - 2.5 * sc)} ${Y(y0 + sg * 6 * sc)}, ${X(2)} ${Y(Y2)}, ${X(16)} ${Y(Y2)} L ${X(45)} ${Y(Y2 * 1.03)}`;
        el('path', { d, fill: 'none', stroke: fl, 'stroke-width': 1.2, opacity: 0.6 }, g);
      });
    });
    // plasma sheet
    el('path', { d: `M${X(8)} ${Y(0)} L${X(45)} ${Y(0)}`, stroke: L ? '#b35bb0' : '#e28fe0', 'stroke-width': 5, opacity: 0.45 }, g);
    // Van Allen belts
    const belt = (L1, L2, lm, col, op) => { [-1, 1].forEach((side) => { let d = ''; const n = 40; for (let i = 0; i <= n; i++) { const lam = -lm + 2 * lm * i / n, Le = side < 0 ? Leff(L2) : L2, r = Le * Math.cos(lam) ** 2; d += (i ? 'L' : 'M') + X(side * r * Math.cos(lam)).toFixed(1) + ' ' + Y(r * Math.sin(lam)).toFixed(1); } for (let i = n; i >= 0; i--) { const lam = -lm + 2 * lm * i / n, Le = side < 0 ? Leff(L1) : L1, r = Le * Math.cos(lam) ** 2; d += 'L' + X(side * r * Math.cos(lam)).toFixed(1) + ' ' + Y(r * Math.sin(lam)).toFixed(1); } el('path', { d: d + 'Z', fill: col, opacity: op }, g); }); };
    belt(1.3, 2.4, 38 * D2R, L ? '#d0742c' : '#ff9a4a', 0.4);
    belt(3.2, 6.5, 50 * D2R, L ? '#c9a227' : '#ffd36a', 0.28);
    // Earth
    el('circle', { cx: X(0), cy: Y(0), r: k, fill: '#2f6fb3' }, g);
    el('path', { d: `M${X(0)} ${Y(1)} A ${k} ${k} 0 0 1 ${X(0)} ${Y(-1)} Z`, fill: '#0b1a33', opacity: 0.6 }, g);
    // aurora ovals
    [1, -1].forEach((sg) => el('ellipse', { cx: X(0.15), cy: Y(sg * 0.95), rx: 6, ry: 3, fill: '#5ee6a8', opacity: 0.95, class: 'eb-aur' }, g));
    // GEO
    el('circle', { cx: X(-6.6), cy: Y(0), r: 3.5, fill: K.fg }, g);
    const inside = r0 < 6.6;
    // labels
    const lb = (x, y, s, o) => txt(svg, x, y, s, Object.assign({ 'font-size': 14, fill: K.fg, stroke: L ? '#eef1f8' : '#060914', 'stroke-width': 4, 'paint-order': 'stroke', 'stroke-linejoin': 'round' }, o || {}));
    lb(12, 20, 'Solar wind →', { 'font-weight': 600, fill: sw });
    lb(X(-rb) - 6, Y(0) - 64, 'Bow shock', { 'text-anchor': 'end' });
    lb(X(-r0) + 6, Y(0) - 104, 'Magnetopause', { 'text-anchor': 'start', fill: K.accent, 'font-weight': 600 });
    lb(X(-6.6), Y(0) + 22, 'GEO orbit', { 'text-anchor': 'middle', 'font-size': 13 });
    lb(X(0), Y(-2.6) + 16, 'Van Allen belts', { 'text-anchor': 'middle', 'font-size': 13 });
    lb(X(0) + 12, Y(1.1) - 6, 'aurora', { 'font-size': 13, fill: L ? '#127a50' : '#5ee6a8' });
    lb(X(24), Y(0) - 10, 'plasma sheet', { 'text-anchor': 'middle', 'font-size': 13 });
    lb(X(24), Y(7.6 * sc) + 5, 'Magnetotail (to hundreds of Earth radii) →', { 'text-anchor': 'middle', 'font-weight': 600 });
    lb(890, 460, 'Moon: 60 Earth radii away, far off the right edge', { 'text-anchor': 'end', 'font-size': 13, fill: K.muted });
    lb(12, 460, 'Earth radius = ' + k + ' px here; distances to scale, field lines sketched', { 'font-size': 13, fill: K.muted });
    if (inside) lb(X(-6.6), Y(0) + 40, 'satellites exposed!', { 'text-anchor': 'middle', 'font-size': 13, fill: K.bad, 'font-weight': 600 });
  }
  function magUpdate() {
    const P = Math.pow(10, M.lp), r0 = mpR(P);
    $('#ebMagPOut').textContent = sig(P, 2) + ' nPa';
    $('#ebMagFacts').innerHTML = [
      ['Magnetopause, Sun side', fmt(r0, 1) + ' Earth radii (' + fmt(Math.round(r0 * 6371 / 1000) * 1000) + ' km)'],
      ['Bow shock, about', fmt(1.3 * r0, 1) + ' Earth radii'],
      ['Geostationary satellites (6.6 radii)', r0 < 6.6 ? 'outside the shield, in the solar wind' : 'inside the shield'],
    ].map(([a, b]) => `<div><dt>${a}</dt><dd>${b}</dd></div>`).join('');
    segSync($('#ebMagPre'), (MPRE.find((q) => Math.abs(q[2] - M.lp) < 0.006) || [''])[0]);
    magPaint();
  }
  function setupMag() {
    segBuild($('#ebMagPre'), MPRE.map(([a, b]) => [a, b]), 'typ', (kk) => { const p = MPRE.find((q) => q[0] === kk); M.lp = p[2]; $('#ebMagP').value = p[2]; magUpdate(); });
    $('#ebMagP').addEventListener('input', (e) => { M.lp = +e.target.value; magUpdate(); });
  }
  function paintAir() { atmUpdate(); ghUpdate(); magUpdate(); }

  /* =====================================================================
     MOON & TIDES
     ===================================================================== */
  const AM = 24.2, AS = 11.3;           // equilibrium tide semi-amplitudes at the equator, cm (M2, S2)
  const MOON_DEG_PER_H = 360 / (29.53 * 24);
  const TD = { phi: 0, h: 9, speed: 'day' };
  const phaseName = (p) => { p = ((p % 360) + 360) % 360; return p < 11.25 || p >= 348.75 ? 'New moon' : p < 78.75 ? 'Waxing crescent' : p < 101.25 ? 'First quarter' : p < 168.75 ? 'Waxing gibbous' : p < 191.25 ? 'Full moon' : p < 258.75 ? 'Waning gibbous' : p < 281.25 ? 'Last quarter' : 'Waning crescent'; };
  function tideAt(t, phiNow, hNow) { // t, hNow in hours; returns cm
    const th = (t - 12) * 15 * D2R;           // observer angle relative to sub-solar point
    const phi = (phiNow + (t - hNow) * MOON_DEG_PER_H) * D2R;
    return AM * Math.cos(2 * (th - phi)) + AS * Math.cos(2 * th);
  }
  const hhmm = (h) => { h = ((h % 24) + 24) % 24; let H = Math.floor(h), m = Math.round((h - H) * 60); if (m === 60) { H = (H + 1) % 24; m = 0; } return String(H).padStart(2, '0') + ':' + String(m).padStart(2, '0'); };
  function tidePaint() {
    const svg = $('#ebTide'); svg.innerHTML = ''; const K = tok(), L = light();
    const cx = 210, cy = 200, Re = 60, Ro = 152;
    const thS = Math.PI, thM = Math.PI + TD.phi * D2R, thO = Math.PI + (TD.h - 12) * 15 * D2R;
    const P = (r, th) => [cx + r * Math.cos(th), cy - r * Math.sin(th)];
    el('rect', { x: 0, y: 0, width: 400, height: 400, fill: L ? '#eef1f8' : '#060914' }, svg);
    // sunlight
    for (let i = 0; i < 6; i++) { const y = 60 + i * 56; el('line', { x1: 4, y1: y, x2: 30, y2: y, stroke: '#f2b630', 'stroke-width': 2 }, svg); head(svg, 20, y, 34, y, 8, '#f2b630'); }
    txt(svg, 8, 26, '← Sun (far away)', T({ 'font-size': 13, fill: K.fg, stroke: L ? '#eef1f8' : '#060914' }));
    // orbit
    el('circle', { cx, cy, r: Ro, fill: 'none', stroke: K.line, 'stroke-dasharray': '4 5' }, svg);
    // water envelope (exaggerated)
    let d = ''; for (let i = 0; i <= 180; i++) { const th = i / 180 * 2 * Math.PI, r = Re + 9 + 18 * Math.cos(2 * (th - thM)) * (AM / 24.2) + 18 * (AS / AM) * Math.cos(2 * (th - thS)); const [x, y] = P(r, th); d += (i ? 'L' : 'M') + x.toFixed(1) + ' ' + y.toFixed(1); }
    el('path', { d: d + 'Z', fill: L ? '#5b9be0' : '#3a7fd0', opacity: 0.55, stroke: L ? '#2f6fb3' : '#7fb6f0', 'stroke-width': 1.5 }, svg);
    // Earth with night side
    el('circle', { cx, cy, r: Re, fill: L ? '#5e8a4e' : '#3d6b3a' }, svg);
    el('path', { d: `M${cx} ${cy - Re} A ${Re} ${Re} 0 0 1 ${cx} ${cy + Re} Z`, fill: '#000', opacity: 0.45 }, svg);
    txt(svg, cx, cy + 5, 'N', { 'font-size': 14, 'font-weight': 700, fill: '#ffffff', 'text-anchor': 'middle' });
    // rotation arrow
    el('path', { d: `M${cx + 22} ${cy - 14} A 26 26 0 0 0 ${cx - 14} ${cy - 22}`, fill: 'none', stroke: '#ffffff', 'stroke-width': 1.5, opacity: 0.8 }, svg);
    head(svg, cx - 4, cy - 26, cx - 16, cy - 21, 7, '#ffffff');
    // Earth-Moon axis
    const [mx, my] = P(Ro, thM); el('line', { x1: cx, y1: cy, x2: mx, y2: my, stroke: K.faint, 'stroke-dasharray': '3 4' }, svg);
    // moon
    el('circle', { cx: mx, cy: my, r: 13, fill: '#555a66' }, svg);
    const ux = -1; // sunlit half faces left
    el('path', { d: `M${mx} ${my - 13} A 13 13 0 0 0 ${mx} ${my + 13} Z`, fill: '#e6e2d6' }, svg);
    txt(svg, mx + (Math.cos(thM) >= 0 ? 18 : -18), my + (Math.sin(thM) > 0.6 ? -14 : Math.sin(thM) < -0.6 ? 26 : 5), 'Moon', T({ 'font-size': 13, fill: K.fg, 'text-anchor': Math.cos(thM) >= 0 ? 'start' : 'end', stroke: L ? '#eef1f8' : '#060914' }));
    // observer
    const [ox, oy] = P(Re, thO);
    el('circle', { cx: ox, cy: oy, r: 6, fill: K.accent, stroke: '#ffffff', 'stroke-width': 2 }, svg);
    const [lx, ly] = P(Re + 40, thO);
    txt(svg, lx, ly + 5, 'you', T({ 'font-size': 13, 'font-weight': 600, fill: K.accent, 'text-anchor': 'middle', stroke: L ? '#eef1f8' : '#060914' }));
    txt(svg, 392, 392, 'bulges exaggerated; not to scale', T({ 'font-size': 13, fill: K.muted, 'text-anchor': 'end', stroke: L ? '#eef1f8' : '#060914' }));
  }
  function curvePaint() {
    const svg = $('#ebTideCurve'); svg.innerHTML = ''; const K = tok();
    const X0 = 44, X1 = 390, Y0 = 14, Y1 = 160, mid = (Y0 + Y1) / 2, sy = (Y1 - Y0) / 2 / 38;
    const X = (t) => X0 + t / 24 * (X1 - X0), Y = (h) => mid - h * sy;
    [-30, 0, 30].forEach((v) => { el('line', { x1: X0, x2: X1, y1: Y(v), y2: Y(v), stroke: K.line, opacity: v ? 0.5 : 0.9 }, svg); txt(svg, X0 - 6, Y(v) + 4.5, (v > 0 ? '+' : '') + v, { 'font-size': 13, fill: K.muted, 'text-anchor': 'end' }); });
    [0, 6, 12, 18, 24].forEach((t) => { txt(svg, X(t), Y1 + 20, hhmm(t === 24 ? 0 : t), { 'font-size': 13, fill: K.muted, 'text-anchor': t === 0 ? 'start' : t === 24 ? 'end' : 'middle' }); el('line', { x1: X(t), x2: X(t), y1: Y0, y2: Y1, stroke: K.line, opacity: 0.35 }, svg); });
    txt(svg, X0 + 4, Y0 + 12, 'cm', { 'font-size': 13, fill: K.muted });
    let d = ''; for (let i = 0; i <= 240; i++) { const t = 24 * i / 240; d += (i ? 'L' : 'M') + X(t).toFixed(1) + ' ' + Y(tideAt(t, TD.phi, TD.h)).toFixed(1); }
    el('path', { d, fill: 'none', stroke: '#3a8ee6', 'stroke-width': 2.5 }, svg);
    const hn = tideAt(TD.h, TD.phi, TD.h);
    el('line', { x1: X(TD.h), x2: X(TD.h), y1: Y0, y2: Y1, stroke: K.accent, 'stroke-width': 1.5 }, svg);
    el('circle', { cx: X(TD.h), cy: Y(hn), r: 5.5, fill: K.accent, stroke: K.surface, 'stroke-width': 2 }, svg);
  }
  function tideUpdate() {
    const phi = ((TD.phi % 360) + 360) % 360;
    $('#ebTideMOut').textContent = fmt(phi) + '° · ' + phaseName(phi).toLowerCase();
    $('#ebTideHOut').textContent = hhmm(TD.h);
    const amp = Math.sqrt(AM * AM + AS * AS + 2 * AM * AS * Math.cos(2 * phi * D2R)), range = 2 * amp, spring = 2 * (AM + AS);
    const c2 = Math.cos(2 * phi * D2R), kind = c2 > 0.7 ? 'Spring tide' : c2 < -0.7 ? 'Neap tide' : c2 > 0 ? 'Between neap and spring (tides growing toward spring)' : 'Between spring and neap';
    const kind2 = c2 > 0.7 || c2 < -0.7 ? kind : (Math.sin(2 * phi * D2R) > 0 ? 'Shrinking toward neap tide' : 'Growing toward spring tide');
    const highs = []; let prev = tideAt(-0.05, TD.phi, TD.h), cur = tideAt(0, TD.phi, TD.h);
    for (let i = 1; i <= 2400; i++) { const t = i / 100, nx = tideAt(t, TD.phi, TD.h); if (cur > prev && cur >= nx) highs.push(t - 0.01); prev = cur; cur = nx; }
    const hn = tideAt(TD.h, TD.phi, TD.h), rising = tideAt(TD.h + 0.05, TD.phi, TD.h) > hn;
    $('#ebTideOut').innerHTML = `<p class="h">${phaseName(phi)} · Sun and Moon ${c2 > 0.7 ? 'pulling along the same line' : c2 < -0.7 ? 'at right angles' : 'partly lined up'}</p><p class="nm">${kind2}</p><p>Tidal range today: <b>${fmt(range)} cm</b>, ${fmt(100 * range / spring)}% of a spring tide. High water at ${highs.map(hhmm).join(' and ')}; now ${hn >= 0 ? '+' : ''}${fmt(hn)} cm and ${rising ? 'rising' : 'falling'}.</p><p class="note">These are the equilibrium tide for an ocean-covered Earth at the equator (lunar 24 cm, solar 11 cm). Real coasts differ a lot: ocean basins slosh and funnel the water, from a few centimetres in the Mediterranean to 16 m in the Bay of Fundy, and high tide is often hours after the Moon passes overhead.</p>`;
    tidePaint(); curvePaint();
  }

  /* ---------- gap to scale ---------- */
  const PL = [['Mercury', 4879, 4879, '#a9a39a'], ['Venus', 12104, 12104, '#e3c88f'], ['Mars', 6792, 6752, '#c8653c'], ['Jupiter', 142984, 133708, '#d4a77a'], ['Saturn', 120536, 108728, '#e6cf92'], ['Uranus', 51118, 49946, '#9fd7df'], ['Neptune', 49528, 48682, '#5b7fe0']];
  const GAP = { fit: false, dist: 'mean', w: 'eq' };
  const DIST = { peri: ['Closest (perigee)', 363300], mean: ['Average', 384400], apo: ['Farthest (apogee)', 405500] };
  function gapPaint() {
    const svg = $('#ebGap'); svg.innerHTML = ''; const K = tok(), L = light();
    const k = 860 / 405500, ex = 22, H = GAP.fit ? 360 : 200, cy = GAP.fit ? 180 : 100, D = DIST[GAP.dist][1];
    svg.setAttribute('viewBox', '0 0 900 ' + H);
    const X = (km) => ex + km * k;
    el('rect', { x: 0, y: 0, width: 900, height: H, fill: L ? '#eef1f8' : '#060914' }, svg);
    const lb = (x, y, s, o) => txt(svg, x, y, s, Object.assign({ 'font-size': 14, fill: K.fg, stroke: L ? '#eef1f8' : '#060914', 'stroke-width': 4, 'paint-order': 'stroke', 'stroke-linejoin': 'round' }, o || {}));
    const gap0 = 6371, gap1 = D - 1737.4;
    if (!GAP.fit) {
      const n = Math.floor((gap1 - gap0) / 12742);
      for (let i = 0; i < n; i++) el('circle', { cx: X(gap0 + 6371 + i * 12742), cy, r: 6371 * k, fill: 'none', stroke: K.faint, 'stroke-width': 1, opacity: 0.7 }, svg);
      lb(X((gap0 + gap1) / 2), cy - 30, n + ' Earths fit in the gap, with ' + fmt(Math.round((gap1 - gap0 - n * 12742) / 100) * 100) + ' km left over', { 'text-anchor': 'middle' });
    } else {
      let x = gap0; const used = [];
      PL.forEach(([n, de, dp, col], i) => {
        const dd = GAP.w === 'eq' ? de : dp, rx = dd / 2 * k, ry = dp / 2 * k * (GAP.w === 'eq' ? 1 : 1);
        el('ellipse', { cx: X(x + dd / 2), cy, rx, ry: GAP.w === 'eq' ? rx * (dp / de) : rx, fill: col, opacity: 0.92 }, svg);
        used.push([n, X(x + dd / 2), rx]); x += dd;
      });
      used.forEach(([n, px, rx], i) => {
        if (rx > 30) lb(px, cy + 5, n, { 'text-anchor': 'middle', 'font-size': 14, 'font-weight': 600, fill: '#141830', stroke: 'none' });
        else { const up = i !== 1; const yy = up ? cy - 24 - (i === 2 ? 22 : 0) : cy + 42; el('line', { x1: px, x2: px, y1: up ? yy + 4 : cy + 10, y2: up ? cy - 8 : yy - 14, stroke: K.muted }, svg); lb(px, yy, n, { 'text-anchor': 'middle', 'font-size': 13 }); }
      });
      const over = x - gap1;
      if (over > 0) { el('rect', { x: X(gap1), y: cy - 34, width: over * k, height: 68, fill: K.bad, opacity: 0.25 }, svg); lb(X(gap1) - 4, 26, 'too long by ' + fmt(Math.round(over / 100) * 100) + ' km', { 'text-anchor': 'end', fill: K.bad, 'font-weight': 600 }); }
      else lb(X(gap1) - 4, 26, fmt(Math.round(-over / 100) * 100) + ' km to spare', { 'text-anchor': 'end', fill: L ? '#127a50' : '#5ee6a8', 'font-weight': 600 });
    }
    // Earth and Moon
    el('circle', { cx: X(0), cy, r: 6371 * k, fill: '#2f6fb3' }, svg);
    el('circle', { cx: X(D), cy, r: 1737.4 * k, fill: '#cfcabd' }, svg);
    lb(X(0), cy - (GAP.fit ? 46 : 22), 'Earth', { 'text-anchor': 'middle', 'font-weight': 600 });
    lb(X(D), cy + (GAP.fit ? 30 : -22), 'Moon', { 'text-anchor': 'middle', 'font-weight': 600 });
    // dimension line
    const yd = H - 28; el('line', { x1: X(0), x2: X(D), y1: yd, y2: yd, stroke: K.muted }, svg);
    [X(0), X(D)].forEach((x) => el('line', { x1: x, x2: x, y1: yd - 6, y2: yd + 6, stroke: K.muted }, svg));
    lb(X(D / 2), yd - 6, fmt(D) + ' km centre to centre (' + fmt(D / 12742, 1) + ' Earth diameters)', { 'text-anchor': 'middle', 'font-size': 13, fill: K.muted });
    lb(X(0), H - 6, 'true scale', { 'font-size': 13, fill: K.muted });
  }
  function gapUpdate() {
    const D = DIST[GAP.dist][1], gap = D - 6371 - 1737.4, sum = PL.reduce((s, p) => s + (GAP.w === 'eq' ? p[1] : p[2]), 0);
    $('#ebGapFit').setAttribute('aria-pressed', String(GAP.fit)); $('#ebGapFit').textContent = GAP.fit ? 'Show Earths instead' : 'Line up the planets';
    $('#ebGapDist').hidden = $('#ebGapW').hidden = !GAP.fit;
    segSync($('#ebGapDist'), GAP.dist); segSync($('#ebGapW'), GAP.w);
    $('#ebGapOut').innerHTML = !GAP.fit
      ? `The surfaces are ${fmt(Math.round(gap / 100) * 100)} km apart at the Moon's average distance. Light covers it in 1.3 seconds; the Apollo crews took about 3 days.`
      : `The seven other planets, ${GAP.w === 'eq' ? 'measured across their equators' : 'measured pole to pole'}, add up to ${fmt(sum)} km. The gap between the surfaces is ${fmt(Math.round(gap / 100) * 100)} km here, so they <b>${sum <= gap ? 'fit' : 'do not fit'}</b>. ` +
        'The popular claim that they all fit is true only with some care: Jupiter and Saturn are flattened by their fast spin, so they fit pole to pole at the average distance, but not across their equators unless the Moon is near its farthest.';
    gapPaint();
  }

  /* ---------- phases ---------- */
  const PH = { a: 60 };
  function moonDisk(parent, cx, cy, R, phi, dark, lit) {
    el('circle', { cx, cy, r: R, fill: dark }, parent);
    const p = ((phi % 360) + 360) % 360, c = Math.cos(p * D2R), rx = Math.abs(c) * R;
    if (p < 0.5 || p > 359.5) return;
    let d;
    if (p <= 180) d = `M${cx} ${cy - R} A ${R} ${R} 0 0 1 ${cx} ${cy + R} A ${rx} ${R} 0 0 ${p < 90 ? 0 : 1} ${cx} ${cy - R} Z`;
    else d = `M${cx} ${cy - R} A ${R} ${R} 0 0 0 ${cx} ${cy + R} A ${rx} ${R} 0 0 ${p > 270 ? 1 : 0} ${cx} ${cy - R} Z`;
    el('path', { d, fill: lit }, parent);
  }
  function phPaint() {
    const svg = $('#ebPh'); svg.innerHTML = ''; const K = tok(), L = light();
    el('rect', { x: 0, y: 0, width: 400, height: 340, fill: L ? '#eef1f8' : '#060914' }, svg);
    const ex = 130, ey = 180, Ro = 96, th = Math.PI + PH.a * D2R;
    for (let i = 0; i < 5; i++) { const y = 90 + i * 45; el('line', { x1: 4, y1: y, x2: 22, y2: y, stroke: '#f2b630', 'stroke-width': 2 }, svg); head(svg, 14, y, 26, y, 7, '#f2b630'); }
    txt(svg, 6, 24, '← Sun', T({ 'font-size': 13, fill: K.fg, stroke: L ? '#eef1f8' : '#060914' }));
    txt(svg, 6, 42, 'view from above the North Pole', T({ 'font-size': 13, fill: K.muted, stroke: L ? '#eef1f8' : '#060914' }));
    el('circle', { cx: ex, cy: ey, r: Ro, fill: 'none', stroke: K.line, 'stroke-dasharray': '4 5' }, svg);
    el('circle', { cx: ex, cy: ey, r: 20, fill: '#2f6fb3' }, svg);
    el('path', { d: `M${ex} ${ey - 20} A 20 20 0 0 1 ${ex} ${ey + 20} Z`, fill: '#000', opacity: 0.5 }, svg);
    const mx = ex + Ro * Math.cos(th), my = ey - Ro * Math.sin(th);
    el('line', { x1: ex, y1: ey, x2: mx, y2: my, stroke: K.faint, 'stroke-dasharray': '3 4' }, svg);
    const mg = el('g', { class: 'eb-drag' }, svg);
    el('circle', { cx: mx, cy: my, r: 22, fill: 'transparent' }, mg);
    el('circle', { cx: mx, cy: my, r: 13, fill: '#454a56' }, mg);
    el('path', { d: `M${mx} ${my - 13} A 13 13 0 0 0 ${mx} ${my + 13} Z`, fill: '#ece8dc' }, mg);
    el('circle', { cx: mx, cy: my, r: 15.5, fill: 'none', stroke: K.accent, 'stroke-width': 2 }, mg);
    // view from Earth
    const vx = 318, vy = 168, VR = 58;
    txt(svg, vx, 82, 'From Earth', T({ 'font-size': 13, fill: K.muted, 'text-anchor': 'middle', stroke: L ? '#eef1f8' : '#060914' }));
    el('rect', { x: vx - 74, y: vy - 74, width: 148, height: 148, rx: 12, fill: '#04050b' }, svg);
    moonDisk(svg, vx, vy, VR, PH.a, '#23262e', '#ece8dc');
    txt(svg, vx, 268, phaseName(PH.a), T({ 'font-size': 14, 'font-weight': 700, fill: K.fg, 'text-anchor': 'middle', stroke: L ? '#eef1f8' : '#060914' }));
    txt(svg, vx, 286, fmt(100 * (1 - Math.cos(PH.a * D2R)) / 2) + '% lit', T({ 'font-size': 13, fill: K.muted, 'text-anchor': 'middle', stroke: L ? '#eef1f8' : '#060914' }));
    txt(svg, 6, 330, 'not to scale', { 'font-size': 13, fill: K.muted });
  }
  function phUpdate() {
    const p = PH.a, f = (1 - Math.cos(p * D2R)) / 2, days = p / 360 * 29.53, transit = 12 + p / 15;
    $('#ebPhAOut').textContent = fmt(p) + '°';
    $('#ebPhOut').innerHTML = `<p class="h">${fmt(days, 1)} days after new moon</p><p class="nm">${phaseName(p)}: ${fmt(100 * f)}% lit</p><p>Highest in the sky around <b>${hhmm(transit)}</b>, rising about 6 hours earlier (${hhmm(transit - 6)}) and setting about 6 hours later (${hhmm(transit + 6)}). ${p < 11.25 || p > 348.75 ? 'It is up with the Sun, lost in its glare.' : p > 168.75 && p < 191.25 ? 'Opposite the Sun: up all night.' : p < 180 ? 'Best seen in the evening sky.' : 'Best seen in the morning sky.'} Each day it rises about 50 minutes later.</p>`;
    phPaint();
  }
  let tideLoop;
  function setupMoon() {
    const m = $('#ebTideM'), h = $('#ebTideH'), play = $('#ebTidePlay');
    m.addEventListener('input', () => { TD.phi = +m.value; tideUpdate(); });
    h.addEventListener('input', () => { TD.h = +h.value; tideUpdate(); });
    segBuild($('#ebTideSpeed'), [['day', 'Watch a day'], ['month', 'Watch a month']], TD.speed, (k) => { TD.speed = k; segSync($('#ebTideSpeed'), k); });
    tideLoop = loop($('#ebTide'), 'moon', (dt) => {
      if (TD.speed === 'day') { TD.h += dt * 2; TD.phi += dt * 2 * MOON_DEG_PER_H; if (TD.h >= 24) TD.h -= 24; }
      else TD.phi += dt * 1.5 * 360 / 29.53;
      TD.phi = (TD.phi + 360) % 360; m.value = Math.round(TD.phi); h.value = TD.h; tideUpdate();
    });
    play.addEventListener('click', () => { const on = play.getAttribute('aria-pressed') !== 'true'; play.setAttribute('aria-pressed', String(on)); play.textContent = on ? 'Pause' : 'Play'; tideLoop.set(on); });
    if (RM()) play.title = 'Animation is off by default because your system asks for reduced motion';
    // gap
    segBuild($('#ebGapDist'), Object.entries(DIST).map(([k, v]) => [k, v[0]]), GAP.dist, (k) => { GAP.dist = k; gapUpdate(); });
    segBuild($('#ebGapW'), [['eq', 'Across the equator'], ['pole', 'Pole to pole']], GAP.w, (k) => { GAP.w = k; gapUpdate(); });
    $('#ebGapFit').addEventListener('click', () => { GAP.fit = !GAP.fit; gapUpdate(); });
    // phases
    const a = $('#ebPhA'); a.addEventListener('input', () => { PH.a = +a.value; phUpdate(); });
    const ps = $('#ebPh'); let dragging = false;
    const dragTo = (e) => { const p = svgPoint(ps, e); const ang = Math.atan2(-(p.y - 180), p.x - 130) * R2D; PH.a = Math.round(((ang - 180) % 360 + 360) % 360) % 360; a.value = PH.a; phUpdate(); };
    ps.addEventListener('pointerdown', (e) => { const p = svgPoint(ps, e); const r = Math.hypot(p.x - 130, p.y - 180); if (r > 60 && r < 135 && p.x < 240) { dragging = true; ps.setPointerCapture(e.pointerId); dragTo(e); } });
    ps.addEventListener('pointermove', (e) => { if (dragging) dragTo(e); });
    ps.addEventListener('pointerup', () => { dragging = false; });
    ps.addEventListener('pointercancel', () => { dragging = false; });
  }
  function paintMoon() { tideUpdate(); gapUpdate(); phUpdate(); }

  /* ---------- tab wiring ---------- */
  const SETUP = { water: setupWater, air: setupAir, moon: setupMoon }, PAINT = { water: paintWater, air: paintAir, moon: paintMoon };
  const done = {};
  document.addEventListener('earth:tab', (e) => {
    const id = e.detail && e.detail.id;
    if (SETUP[id] && !done[id]) { SETUP[id](); done[id] = true; PAINT[id](); }
    anims.forEach((w) => w.sync());
  });
  document.addEventListener('earth:theme', () => Object.keys(done).forEach((id) => PAINT[id]()));
})();
