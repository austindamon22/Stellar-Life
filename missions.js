/* Stellar Life — missions.js: fleet explorer, atmosphere, orbit map, mirrors, timeline, detectors */
(function () {
  'use strict';
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const { M, BANDS, WHERE } = window.MISSIONS;
  const NS = 'http://www.w3.org/2000/svg';
  const NOW = 2026.83;
  const store = { get(k) { try { return localStorage.getItem('missions-' + k); } catch (e) { return null; } }, set(k, v) { try { localStorage.setItem('missions-' + k, v); } catch (e) { /* unavailable */ } } };
  const tok = () => { const c = getComputedStyle(document.documentElement), g = (n) => c.getPropertyValue(n).trim(); return { fg: g('--fg'), muted: g('--muted'), faint: g('--faint'), line: g('--line'), accent: g('--accent'), surface: g('--surface'), bg: g('--bg') }; };
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const BMAP = Object.fromEntries(BANDS.map((b) => [b.k, b]));
  const bandCol = (k) => (k === 'gw' ? tok().fg : BMAP[k].col);
  const byId = Object.fromEntries(M.map((m) => [m.id, m]));
  const status = (m) => m.st || (m.end ? 'Ended ' + m.end : 'Operating');
  const live = (m) => (typeof m.live === 'boolean' ? m.live : !m.end);   // one flag for status colour and timeline arrow
  const lams = (m) => (!m.lam ? [] : Array.isArray(m.lam[0]) ? m.lam : [m.lam]);
  const sees = (m, l) => lams(m).some(([a, b]) => l >= a * 0.999 && l <= b * 1.001);
  function el(tag, attrs, parent) {
    const e = document.createElementNS(NS, tag);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }
  function txt(parent, x, y, s, attrs) { const t = el('text', Object.assign({ x, y }, attrs || {}), parent); t.textContent = s; return t; }
  const halo = () => ({ stroke: tok().bg || '#05060c', 'stroke-width': 3, 'paint-order': 'stroke', 'stroke-linejoin': 'round' });

  /* ---------- Tabs ---------- */
  const tabs = $$('.tabs [role=tab]');
  const drawn = {};
  function showTab(id, focus) {
    tabs.forEach((t) => { const on = t.getAttribute('aria-controls') === id; t.setAttribute('aria-selected', String(on)); t.tabIndex = on ? 0 : -1; $('#' + t.getAttribute('aria-controls')).hidden = !on; if (on && focus) t.focus(); });
    store.set('tab', id);
    if (id !== 'detect') ccdStop();
    if (id === 'fleet') { bandSvg(); }
    if (id === 'why') { atmo(); orbit(); }
    if (id === 'compare') { mirrors(); mirTable(); timeline(); }
    if (id === 'detect') { ccdDraw(); }
    drawn[id] = true;
  }
  tabs.forEach((t, i) => {
    t.addEventListener('click', () => showTab(t.getAttribute('aria-controls')));
    t.addEventListener('keydown', (e) => {
      const n = tabs.length; let j = null;
      if (e.key === 'ArrowRight') j = (i + 1) % n; if (e.key === 'ArrowLeft') j = (i - 1 + n) % n;
      if (e.key === 'Home') j = 0; if (e.key === 'End') j = n - 1;
      if (j !== null) { e.preventDefault(); showTab(tabs[j].getAttribute('aria-controls'), true); }
    });
  });

  /* ================= Fleet ================= */
  const F = { band: 'all', kind: 'all', sel: store.get('sel') || 'jwst' };
  if (!byId[F.sel]) F.sel = 'jwst';
  const KINDS = [['all', 'All'], ['telescope', 'Space telescopes'], ['probe', 'Probes & rovers'], ['ground', 'On the ground']];
  const SPEC = ['radio', 'micro', 'ir', 'vis', 'uv', 'xray', 'gamma'];     // long → short wavelength, left to right

  function segBuild(box, items, cur, onPick) {
    box.innerHTML = '';
    items.forEach(([k, label, col]) => {
      const b = document.createElement('button'); b.type = 'button'; b.dataset.k = k;
      b.innerHTML = (col ? `<span class="ms-dot" style="background:${col}"></span>` : '') + esc(label);
      b.setAttribute('aria-pressed', String(k === cur));
      b.addEventListener('click', () => onPick(k));
      box.appendChild(b);
    });
  }
  const segSync = (box, cur) => $$('button', box).forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.k === cur)));
  function setBand(k) { F.band = (F.band === k && k !== 'all') ? 'all' : k; segSync($('#msBandSeg'), F.band); bandSvg(); grid(); }
  function setKind(k) { F.kind = k; segSync($('#msKind'), k); grid(); }
  segBuild($('#msBandSeg'), [['all', 'All light', null]].concat(BANDS.map((b) => [b.k, b.name, b.col])), F.band, setBand);
  segBuild($('#msKind'), KINDS, F.kind, setKind);

  function bandSvg() {
    const svg = $('#msBand'); svg.innerHTML = ''; const T = tok();
    const x0 = 10, w = 880 / SPEC.length;
    const defs = el('defs', {}, svg), g = el('linearGradient', { id: 'msVis', x1: 0, x2: 1 }, defs);
    [['0', '#ff3a2e'], ['.3', '#f7e93a'], ['.55', '#2ccf6a'], ['.8', '#3a7bff'], ['1', '#7a3cff']].forEach(([o, c]) => el('stop', { offset: o, 'stop-color': c }, g));
    SPEC.forEach((k, i) => {
      const b = BMAP[k], on = F.band === 'all' || F.band === k, x = x0 + i * w;
      const grp = el('g', { class: 'ms-bandbtn', tabindex: 0, role: 'button', 'aria-pressed': String(F.band === k), 'aria-label': b.name + ' (' + b.range + ')' }, svg);
      el('rect', { x: x + 1, y: 8, width: w - 2, height: 40, rx: 6, fill: k === 'vis' ? 'url(#msVis)' : b.col, opacity: on ? 0.9 : 0.25 }, grp);
      if (F.band === k) el('rect', { x: x + 1, y: 8, width: w - 2, height: 40, rx: 6, fill: 'none', stroke: T.fg, 'stroke-width': 2 }, grp);
      txt(grp, x + w / 2, 33, b.name.split(' /')[0], { 'text-anchor': 'middle', 'font-size': 14, 'font-weight': 600, fill: on ? '#0b0d18' : T.muted });
      txt(grp, x + w / 2, 66, b.range, { 'text-anchor': 'middle', 'font-size': 12, fill: T.muted });
      const n = M.filter((m) => m.bands.includes(k)).length;
      txt(grp, x + w / 2, 84, n + (n === 1 ? ' mission' : ' missions'), { 'text-anchor': 'middle', 'font-size': 11, fill: T.faint });
      grp.addEventListener('click', () => setBand(k));
      grp.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setBand(k); } });
    });
    // wavelength arrow
    txt(svg, x0, 108, '← longer wavelength, lower energy', { 'font-size': 11, fill: T.faint });
    txt(svg, 890, 108, 'shorter wavelength, higher energy →', { 'font-size': 11, fill: T.faint, 'text-anchor': 'end' });
  }

  function grid() {
    const list = M.filter((m) => (F.band === 'all' || m.bands.includes(F.band)) && (F.kind === 'all' || m.kind === F.kind)).sort((a, b) => a.y - b.y);
    const box = $('#msGrid'); box.innerHTML = '';
    const one = list.length === 1;
    const what = F.band === 'all' ? '' : F.band === 'insitu' ? (one ? ' that measures things on the spot' : ' that measure things on the spot') : F.band === 'gw' ? (one ? ' that detects gravitational waves' : ' that detect gravitational waves') : (one ? ' that observes in ' : ' that observe in ') + BMAP[F.band].name.toLowerCase();
    $('#msCount').textContent = list.length + (one ? ' mission' : ' missions') + what + '.';
    list.forEach((m) => {
      const li = document.createElement('li'), b = document.createElement('button');
      b.type = 'button'; b.className = 'ms-card'; b.setAttribute('aria-pressed', String(m.id === F.sel));
      b.innerHTML = `<span class="ms-yr">${m.y}${m.end ? '–' + m.end : ''}</span><b>${esc(m.name)}</b><span class="ms-who">${esc(m.who)}</span><span class="ms-bands">${m.bands.map((k) => `<span class="ms-dot" style="background:${bandCol(k)}" title="${BMAP[k].name}"></span>`).join('')}</span><span class="ms-st ${live(m) ? 'on' : ''}">${esc(status(m))}</span>`;
      b.addEventListener('click', () => select(m.id, true));
      li.appendChild(b); box.appendChild(li);
    });
    if (!list.some((m) => m.id === F.sel) && list.length) F.sel = list[0].id;
    $$('.ms-card', box).forEach((b, i) => b.setAttribute('aria-pressed', String(list[i].id === F.sel)));
    detail();
  }
  function select(id, scroll) {
    F.sel = id; store.set('sel', id);
    $$('#msGrid .ms-card').forEach((b) => b.setAttribute('aria-pressed', String(b.querySelector('b').textContent === byId[id].name)));
    detail();
    if (scroll && matchMedia('(max-width: 900px)').matches) $('#msDetail').scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
  }
  function apText(m) {
    if (m.id === 'eht') return 'Virtual dish the size of Earth (12,700 km)';
    if (m.id === 'alma') return '66 dishes of 7–12 m, spread up to 16 km';
    if (m.id === 'chandra') return '1.2 m nested grazing-incidence mirrors';
    if (m.id === 'gaia') return 'Two 1.45 × 0.5 m mirrors';
    if (m.id === 'tess') return 'Four 10.5 cm lenses';
    if (m.id === 'ligo') return 'Two 4 km laser arms per site';
    if (m.id === 'xmm') return 'Three modules of 58 nested grazing-incidence mirrors';
    if (m.id === 'hipparcos') return 'Schmidt telescope viewing two fields at once';
    return m.ap ? m.ap + ' m mirror' : null;
  }
  function detail() {
    const m = byId[F.sel], box = $('#msDetail');
    if (!m) { box.innerHTML = ''; return; }
    const rows = [['Operated by', m.who], ['Launched / began', m.y], ['Status', status(m)], ['Where', m.whereTxt]];
    const ap = apText(m); if (ap) rows.push(['Collector', ap]);
    rows.push(['Sees', m.bands.map((k) => `<span class="ms-tag" style="--c:${bandCol(k)}">${BMAP[k].name}</span>`).join(' ')]);
    box.innerHTML = `<h3>${esc(m.name)}</h3>
      <dl class="facts">${rows.map(([k, v]) => `<div><dt>${k}</dt><dd>${k === 'Sees' ? v : esc(v)}</dd></div>`).join('')}</dl>
      <h4>Instruments and detectors</h4>
      <ul class="ms-inst">${m.inst.map(([n, d]) => `<li><b>${esc(n)}</b><span>${esc(d)}</span></li>`).join('')}</ul>
      <h4>${m.found[0].startsWith('Goal') ? 'Goals' : 'What it found'}</h4>
      <ul class="ms-found">${m.found.map((f) => `<li>${esc(f.replace(/^Goal: /, ''))}</li>`).join('')}</ul>
      <p class="ms-sci">${esc(m.sci)}</p>`;
  }

  /* ================= Atmosphere ================= */
  // log10(wavelength in m) → altitude (km) where incoming light falls to half. Smoothed from standard absorption charts.
  const ATM = [[-13, 35], [-11, 38], [-10, 45], [-9, 80], [-8.5, 110], [-8, 130], [-7.5, 110], [-7.2, 80], [-6.9, 50], [-6.65, 35], [-6.55, 25], [-6.5, 6], [-6.45, 0], [-5.9, 0], [-5.8, 2], [-5.7, 0], [-5.55, 1.5], [-5.4, 0], [-5.25, 6], [-5.1, 0], [-4.9, 0], [-4.75, 8], [-4.5, 12], [-4, 14], [-3.5, 8], [-3.2, 4], [-3, 2], [-2.5, 0.5], [-2, 0], [1, 0], [1.3, 60], [1.6, 150], [2, 150]];
  const BSPAN = [['gamma', -13, -11], ['xray', -11, -8], ['uv', -8, -6.42], ['vis', -6.42, -6.125], ['ir', -6.125, -3], ['micro', -3, -2], ['radio', -2, 2]];
  const atmAt = (lx) => { for (let i = 1; i < ATM.length; i++) if (lx <= ATM[i][0]) { const [a, ha] = ATM[i - 1], [b, hb] = ATM[i]; return ha + (hb - ha) * (lx - a) / (b - a); } return 150; };
  function lamText(lx) {
    const l = Math.pow(10, lx);
    if (l >= 1) return (l < 10 ? l.toFixed(1) : Math.round(l)) + ' m';
    if (l >= 1e-3) return +(l * 1e3).toPrecision(2) + ' mm';
    if (l >= 1e-6) return +(l * 1e6).toPrecision(2) + ' μm';
    if (l >= 1e-9) return +(l * 1e9).toPrecision(2) + ' nm';
    return +(l * 1e12).toPrecision(2) + ' pm';
  }
  const A = { lx: null };
  function atmo() {
    const svg = $('#msAtmo'); svg.innerHTML = ''; const T = tok();
    const X0 = 60, X1 = 885, Y0 = 34, Y1 = 290, LX0 = -13, LX1 = 2, HMAX = 150;
    const X = (lx) => X0 + (lx - LX0) / (LX1 - LX0) * (X1 - X0);
    const Y = (h) => Y1 - Math.sqrt(Math.max(0, h) / HMAX) * (Y1 - Y0);
    const defs = el('defs', {}, svg);
    const g = el('linearGradient', { id: 'atmG', x1: X0, x2: X1, gradientUnits: 'userSpaceOnUse' }, defs);
    BSPAN.forEach(([k, a, b]) => {
      if (k === 'vis') { [['#7a3cff', a], ['#3a7bff', a + 0.08], ['#2ccf6a', a + 0.15], ['#f7e93a', a + 0.21], ['#ff3a2e', b]].forEach(([c, lx]) => el('stop', { offset: (X(lx) - X0) / (X1 - X0), 'stop-color': c }, g)); return; }
      el('stop', { offset: (X(a) - X0) / (X1 - X0) + 0.002, 'stop-color': BMAP[k].col }, g);
      el('stop', { offset: (X(b) - X0) / (X1 - X0) - 0.002, 'stop-color': BMAP[k].col }, g);
    });
    // note: our x axis runs short → long wavelength, so gamma is on the left here
    el('rect', { x: X0, y: Y0, width: X1 - X0, height: Y1 - Y0, fill: T.surface, stroke: T.line }, svg);
    let d = `M${X(LX0)},${Y0}`;
    for (let lx = LX0; lx <= LX1 + 1e-9; lx += 0.02) d += ` L${X(lx).toFixed(1)},${Y(atmAt(lx)).toFixed(1)}`;
    d += ` L${X(LX1)},${Y0} Z`;
    el('path', { d, fill: 'url(#atmG)', opacity: 0.75 }, svg);
    // altitude ticks
    [[0, 'sea level'], [8.8, 'Everest 8.8 km'], [13, 'airborne observatory ~13 km'], [40, 'balloons ~40 km'], [100, 'edge of space 100 km'], [150, '150 km']].forEach(([h, s], i) => {
      el('line', { x1: X0, x2: X1, y1: Y(h), y2: Y(h), stroke: T.line, 'stroke-dasharray': h ? '3 4' : '', opacity: 0.8 }, svg);
      txt(svg, X0 + 6, Y(h) - 4, s, Object.assign({ 'font-size': 11, fill: T.muted }, halo()));
    });
    txt(svg, 16, (Y0 + Y1) / 2, 'altitude', { 'font-size': 11, fill: T.faint, transform: `rotate(-90 16 ${(Y0 + Y1) / 2})`, 'text-anchor': 'middle' });
    BSPAN.forEach(([k, a, b]) => {
      txt(svg, k === 'uv' ? (X(a) + X(b)) / 2 - 14 : (X(a) + X(b)) / 2, Y0 - 18, BMAP[k].name.split(' /')[0], { 'text-anchor': 'middle', 'font-size': k === 'vis' ? 10 : 12, dy: k === 'vis' ? 12 : 0, 'font-weight': 600, fill: BMAP[k].col === '#ffffff' ? T.fg : T.fg });
      el('line', { x1: X(a), x2: X(a), y1: Y0 - 12, y2: Y0, stroke: T.line }, svg);
    });
    for (let lx = -12; lx <= 2; lx += 2) txt(svg, X(lx), Y1 + 16, lamText(lx), { 'text-anchor': 'middle', 'font-size': 11, fill: T.faint });
    txt(svg, X1, Y1 + 32, 'wavelength →', { 'text-anchor': 'end', 'font-size': 11, fill: T.faint });
    txt(svg, X(-6.27), Y(0) - 18, 'optical window', Object.assign({ 'text-anchor': 'middle', 'font-size': 11, fill: T.fg }, halo()));
    txt(svg, X(-0.5), Y(0) - 18, 'radio window', Object.assign({ 'text-anchor': 'middle', 'font-size': 11, fill: T.fg }, halo()));
    txt(svg, X(-4.3), Y(14) - 8, 'water vapour', Object.assign({ 'text-anchor': 'middle', 'font-size': 11, fill: T.fg }, halo()));
    txt(svg, X(-6.7), Y(40) - 6, 'ozone', Object.assign({ 'text-anchor': 'end', 'font-size': 11, fill: T.fg }, halo()));
    txt(svg, X(1.55), Y(120), 'ionosphere', Object.assign({ 'text-anchor': 'end', 'font-size': 11, fill: T.fg }, halo()));
    const cur = el('line', { y1: Y0, y2: Y1, stroke: T.fg, 'stroke-width': 1, opacity: 0 }, svg);
    const out = $('#msAtmoOut');
    const hit = el('rect', { x: X0, y: Y0, width: X1 - X0, height: Y1 - Y0, fill: 'transparent', style: 'cursor:crosshair', class: 'ms-hit', tabindex: 0, role: 'slider', 'aria-label': 'Wavelength', 'aria-valuemin': LX0, 'aria-valuemax': LX1, 'aria-orientation': 'horizontal' }, svg);
    const show = (lx) => {
      lx = Math.max(LX0, Math.min(LX1, lx)); A.lx = lx;
      cur.setAttribute('x1', X(lx)); cur.setAttribute('x2', X(lx)); cur.setAttribute('opacity', 0.7);
      const h = atmAt(lx), band = BSPAN.find(([, a, b]) => lx >= a && lx < b) || BSPAN[6];
      const where = h < 0.3 ? 'reaches the ground: telescopes on Earth work here' : h < 15 ? `stopped about ${h.toFixed(0)} km up: high mountains or aircraft help` : h < 50 ? `stopped about ${h.toFixed(0)} km up: needs balloons or space` : `stopped about ${h.toFixed(0)} km up: space only`;
      const l = Math.pow(10, lx), ms = M.filter((m) => m.kind !== 'probe' && sees(m, l)).sort((a, b) => b.y - a.y).map((m) => SHORT[m.id] || m.name);
      const list = ms.length ? ' Observed by: ' + (ms.length > 7 ? ms.slice(0, 6).join(', ') + ' and ' + (ms.length - 6) + ' more' : ms.join(', ')) + '.' : ' None of the missions here observes this wavelength.';
      const s = `${lamText(lx)} (${BMAP[band[0]].name.toLowerCase()}): ${where}.`;
      out.textContent = s + list;
      hit.setAttribute('aria-valuenow', lx.toFixed(2)); hit.setAttribute('aria-valuetext', s);
    };
    const probe = (e) => { const r = svg.getBoundingClientRect(), sx = (e.clientX - r.left) / r.width * 900; show(LX0 + (sx - X0) / (X1 - X0) * (LX1 - LX0)); };
    hit.addEventListener('pointermove', probe); hit.addEventListener('pointerdown', probe);
    hit.addEventListener('keydown', (e) => {
      const step = e.shiftKey ? 0.5 : 0.05, k = e.key; let lx = A.lx == null ? -6.3 : A.lx;
      if (k === 'ArrowRight' || k === 'ArrowUp') lx += step; else if (k === 'ArrowLeft' || k === 'ArrowDown') lx -= step;
      else if (k === 'PageUp') lx += 1; else if (k === 'PageDown') lx -= 1; else if (k === 'Home') lx = LX0; else if (k === 'End') lx = LX1; else return;
      e.preventDefault(); show(lx);
    });
    if (A.lx != null) show(A.lx);
    else { hit.setAttribute('aria-valuenow', -6.3); hit.setAttribute('aria-valuetext', 'Move across the chart, or use the arrow keys, to pick a wavelength'); }
    if (!out.textContent) out.textContent = 'Move across the chart (or focus it and use the arrow keys) to read off a wavelength.';
  }

  /* ================= Orbit map ================= */
  const PLACES = [
    { k: 'ground', name: 'Earth’s surface', d: null, ids: ['eht', 'ligo', 'alma', 'rubin'] },
    { k: 'leo', row: 0, name: 'Low orbit', d: 500, ids: ['hubble', 'fermi', 'cobe', 'swift', 'xrism'] },
    { k: 'geo', row: 1, an: 'end', name: '36,000 km', full: 'Out to ~36,000 km (geosynchronous height)', d: 3.6e4, ids: ['sdo', 'hipparcos'] },
    { k: 'heo', row: 2, an: 'end', name: 'High Earth orbit', full: 'High Earth orbit (out to 115,000–140,000 km)', d: 1.3e5, ids: ['chandra', 'xmm'] },
    { k: 'moon', row: 3, an: 'start', name: 'TESS, out to the Moon', full: 'Out to ~375,000 km, near the Moon’s distance', d: 3.75e5, ids: ['tess'] },
    { k: 'lpt', row: 2, an: 'start', name: 'L1 and L2', d: 1.5e6, ids: ['soho', 'jwst', 'gaia', 'wmap', 'planck', 'euclid', 'roman', 'herschel'] },
    { k: 'trail', row: 0, an: 'end', name: 'Earth-trailing', d: 1e8, ids: ['spitzer', 'kepler'] },
    { k: 'sun', row: 1, an: 'end', name: 'Near the Sun', d: 1.5e8, ids: ['parker'] },
    { k: 'mars', row: 2, an: 'end', name: 'Mars', d: 2.3e8, ids: ['curiosity', 'perseverance'] },
    { k: 'comet', row: 3, an: 'end', name: 'Comet 67P', d: 4e8, ids: ['rosetta'] },
    { k: 'jup', row: 3, an: 'start', name: 'Jupiter', d: 6.3e8, ids: ['juno', 'clipper'] },
    { k: 'sat', row: 2, an: 'start', name: 'Saturn', d: 1.3e9, ids: ['cassini'] },
    { k: 'kb', row: 1, an: 'start', name: 'Kuiper Belt', d: 9.3e9, ids: ['nh'] },
    { k: 'is', row: 0, an: 'start', name: 'Interstellar', d: 2.3e10, ids: ['voyager'] },
  ];
  let orbitSel = 'lpt';
  function orbit() {
    const svg = $('#msOrbit'); svg.innerHTML = ''; const T = tok();
    const X0 = 120, X1 = 830, L0 = 2, L1 = 11, AX = 210;
    const X = (d) => X0 + (Math.log10(d) - L0) / (L1 - L0) * (X1 - X0);
    el('line', { x1: 30, x2: X1 + 10, y1: AX, y2: AX, stroke: T.line, 'stroke-width': 2 }, svg);
    for (let e = L0; e <= L1; e++) {
      el('line', { x1: X(Math.pow(10, e)), x2: X(Math.pow(10, e)), y1: AX - 4, y2: AX + 4, stroke: T.faint }, svg);
      const s = e < 6 ? (Math.pow(10, e)).toLocaleString('en-US') + ' km' : e < 9 ? Math.pow(10, e - 6) + ' million km' : Math.pow(10, e - 9) + ' billion km';
      if (e % 1 === 0 && (e - L0) % 1 === 0) txt(svg, X(Math.pow(10, e)), AX + 20, s, { 'text-anchor': 'middle', 'font-size': 10.5, fill: T.faint });
    }
    txt(svg, 890, AX + 38, 'distance from Earth (typical; planets’ distances change through the year)', { 'text-anchor': 'end', 'font-size': 10.5, fill: T.faint });
    // Earth
    el('circle', { cx: 46, cy: AX, r: 16, fill: '#3d7fd1' }, svg);
    txt(svg, 46, AX + 32, 'Earth', { 'text-anchor': 'middle', 'font-size': 11, fill: T.muted });
    // 1 AU marker
    el('line', { x1: X(1.496e8), x2: X(1.496e8), y1: 24, y2: AX, stroke: T.line, 'stroke-dasharray': '2 4' }, svg);
    txt(svg, X(1.496e8) + 4, 22, '1 AU: Earth–Sun', { 'font-size': 10, fill: T.faint });
    const ROWS = [170, 128, 86, 44];
    PLACES.forEach((p) => {
      const x = p.d ? X(p.d) : 46, y = p.d ? ROWS[p.row] : 160;
      const on = p.k === orbitSel, n = p.ids.length;
      const grp = el('g', n ? { tabindex: 0, role: 'button', 'aria-pressed': String(on), 'aria-label': `${p.name}: ${n} mission${n > 1 ? 's' : ''}`, style: 'cursor:pointer' } : {}, svg);
      if (p.d) el('line', { x1: x, x2: x, y1: y + 6, y2: AX, stroke: on ? T.accent : T.line }, grp);
      el('circle', { cx: x, cy: p.d ? AX : AX - 22, r: n ? 5 + Math.sqrt(n) * 2 : 4, fill: n ? (on ? T.accent : T.muted) : T.faint, opacity: p.d ? 1 : 0 }, grp);
      const label = p.d ? p.name + (n ? ` (${n})` : '') : '';
      if (label) {
        const t = txt(grp, x, y, label, Object.assign({ 'text-anchor': p.an || 'middle', 'font-size': 12, 'font-weight': on ? 700 : 500, fill: on ? T.accent : T.fg }, halo()));
        t.setAttribute('class', 'ms-orbit-l');
      }
      if (!p.d) txt(grp, 46, AX - 26, 'ground (' + n + ')', Object.assign({ 'text-anchor': 'middle', 'font-size': 12, 'font-weight': on ? 700 : 500, fill: on ? T.accent : T.fg }, halo()));
      if (n) {
        const pick = () => { orbitSel = p.k; orbit(); };
        grp.addEventListener('click', pick);
        grp.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(); } });
      }
    });
    const p = PLACES.find((q) => q.k === orbitSel);
    $('#msOrbitOut').innerHTML = `<b>${esc(p.full || p.name)}:</b> ` + p.ids.map((id) => `<button type="button" class="btn ms-jump" data-id="${id}">${esc(byId[id].name)}</button>`).join(' ');
    $$('#msOrbitOut .ms-jump').forEach((b) => b.addEventListener('click', () => jumpTo(b.dataset.id)));
  }
  function jumpTo(id) {
    F.band = 'all'; F.kind = 'all'; segSync($('#msBandSeg'), 'all'); segSync($('#msKind'), 'all');
    F.sel = id; store.set('sel', id);
    showTab('fleet'); grid();
    $('#msDetail').scrollIntoView({ block: 'start' });
  }

  /* ================= Mirrors ================= */
  const HUB_A = 4.0;   // Hubble's collecting area after its secondary mirror's shadow (m²)
  const MIR = [['jwst', 'Webb', 6.5, 25.4], ['herschel', 'Herschel', 3.5, 9.6], ['hubble', 'Hubble', 2.4, HUB_A], ['roman', 'Roman', 2.4, HUB_A], ['planck', 'Planck', 1.5, null], ['gaia', 'Gaia', 1.45, null], ['wmap', 'WMAP', 1.4, null], ['euclid', 'Euclid', 1.2, 1.1], ['chandra', 'Chandra', 1.2, null], ['kepler', 'Kepler', 0.95, 0.71], ['spitzer', 'Spitzer', 0.85, 0.57], ['tess', 'TESS', 0.105, 0.035]];
  function mirrors() {
    const svg = $('#msMirror'); svg.innerHTML = ''; const T = tok();
    const S = 27.5, base = 268, gap = 0.42; let x = 26;
    // person for scale
    const px = x + 0.3 * S, ph = 1.75 * S;
    const pg = el('g', { fill: T.muted }, svg);
    el('circle', { cx: px, cy: base - ph + 0.12 * S, r: 0.12 * S }, pg);
    el('rect', { x: px - 0.2 * S, y: base - ph + 0.27 * S, width: 0.4 * S, height: 0.7 * S, rx: 4 }, pg);
    el('rect', { x: px - 0.17 * S, y: base - ph + 0.95 * S, width: 0.14 * S, height: 0.8 * S }, pg);
    el('rect', { x: px + 0.03 * S, y: base - ph + 0.95 * S, width: 0.14 * S, height: 0.8 * S }, pg);
    txt(svg, 12, base + 18, 'person 1.75 m', { 'text-anchor': 'start', 'font-size': 11, fill: T.muted });
    x += 0.6 * S + gap * S;
    el('line', { x1: 10, x2: 890, y1: base, y2: base, stroke: T.line }, svg);
    let small = 0;
    MIR.forEach(([id, name, D]) => {
      const r = D / 2 * S, cx = x + r, cy = base - r;
      const g = el('g', {}, svg);
      if (id === 'jwst') {
        const s = 1.32 / Math.sqrt(3) * S;                    // hexagon circumradius from 1.32 m flat-to-flat
        const hex = (hx, hy) => { let d = ''; for (let k = 0; k < 6; k++) { const a = Math.PI / 6 + k * Math.PI / 3; d += (k ? 'L' : 'M') + (hx + s * 0.97 * Math.cos(a)).toFixed(1) + ',' + (hy + s * 0.97 * Math.sin(a)).toFixed(1); } return d + 'Z'; };
        const w = Math.sqrt(3) * s;
        const cells = [];
        for (let q = -2; q <= 2; q++) for (let rr = -2; rr <= 2; rr++) { const sNum = -q - rr; if (Math.max(Math.abs(q), Math.abs(rr), Math.abs(sNum)) <= 2 && !(q === 0 && rr === 0)) cells.push([q, rr]); }
        cells.forEach(([q, rr]) => el('path', { d: hex(cx + w * (q + rr / 2), cy + 1.5 * s * rr), fill: '#d9a93a', stroke: '#8a6a1a', 'stroke-width': 1 }, g));
      } else if (id === 'gaia') {
        el('rect', { x: x, y: base - 0.5 * S, width: D * S, height: 0.5 * S, rx: 3, fill: '#c7cfe0' }, g);
      } else if (id === 'chandra') {
        [1, 0.86, 0.72, 0.6].forEach((f) => el('circle', { cx, cy, r: r * f, fill: 'none', stroke: '#5ee6d0', 'stroke-width': 2 }, g));
      } else {
        el('circle', { cx, cy, r: Math.max(1.5, r), fill: (id === 'planck' || id === 'wmap') ? '#8a7dff' : '#c7cfe0', opacity: 0.9 }, g);
        if (r > 6) el('circle', { cx, cy, r: r * (id === 'hubble' || id === 'roman' ? 0.33 : 0.25), fill: T.surface }, g);
      }
      const big = D >= 1.3, lv = big ? 0 : (small++) % 2;   // stagger the small telescopes' labels
      txt(svg, cx, big ? cy - r - 8 : base - r * 2 - 10 - lv * 16, name, Object.assign({ 'text-anchor': 'middle', 'font-size': 12, 'font-weight': 600, fill: T.fg }, halo()));
      txt(svg, cx, base + 18 + lv * 13, D + ' m', { 'text-anchor': 'middle', 'font-size': 11, fill: T.muted });
      x += Math.max(D, 0.55) * S + gap * S;
    });
    txt(svg, 890, 22, 'drawn to scale · Webb: 18 gold-coated beryllium segments', { 'text-anchor': 'end', 'font-size': 11, fill: T.faint });
  }
  const lamFrom = (s) => Math.pow(10, -7 + s / 1000 * 4.477);       // 100 nm … 3 mm
  function angText(rad) {
    const as = rad * 206264.8;
    if (as >= 60) return +(as / 60).toPrecision(2) + '′';
    if (as >= 1) return +as.toPrecision(2) + '″';
    if (as >= 1e-3) return +(as * 1e3).toPrecision(2) + ' mas';
    return +(as * 1e6).toPrecision(2) + ' μas';
  }
  const ratio = (A) => (A / HUB_A >= 1 ? +(A / HUB_A).toPrecision(2) + '×' : +(A / HUB_A).toPrecision(1) + '×');
  function mirTable() {
    const lam = lamFrom(+$('#msLam').value);
    $('#msLamOut').textContent = lamText(Math.log10(lam));
    const OUT = '<span class="ms-outtxt">outside its band</span>';
    const rows = MIR.filter(([id]) => !['chandra', 'gaia', 'planck', 'wmap'].includes(id)).map(([id, name, D, A]) => {
      const ok = sees(byId[id], lam);
      return [ok, [name, D + ' m', A ? ratio(A) : '—', ok ? angText(1.22 * lam / D) : OUT]];
    });
    rows.push([true, ['Event Horizon Telescope (at its 1.3 mm)', '12,700 km (Earth)', '—', angText(1.22 * 1.3e-3 / 1.2742e7)]]);
    const eye = lam >= 3.8e-7 && lam <= 7.5e-7;
    rows.push([eye, ['Your eye', '7 mm pupil', '1/100,000', eye ? angText(1.22 * lam / 0.007) : OUT]]);
    $('#msMirTable tbody').innerHTML = rows.map(([ok, r]) => `<tr${ok ? '' : ' class="ms-out"'}>${r.map((c) => `<td>${c}</td>`).join('')}</tr>`).join('');
  }
  $('#msLam').addEventListener('input', mirTable);

  /* ================= Timeline ================= */
  const SHORT = { xmm: 'XMM-Newton', swift: 'Swift', hipparcos: 'Hipparcos', herschel: 'Herschel', sdo: 'SDO', xrism: 'XRISM', rubin: 'Rubin', hubble: 'Hubble', jwst: 'Webb', chandra: 'Chandra', spitzer: 'Spitzer', kepler: 'Kepler', tess: 'TESS', gaia: 'Gaia', cobe: 'COBE', wmap: 'WMAP', planck: 'Planck', fermi: 'Fermi', soho: 'SOHO', euclid: 'Euclid', roman: 'Roman', voyager: 'Voyagers', cassini: 'Cassini', juno: 'Juno', nh: 'New Horizons', parker: 'Parker', rosetta: 'Rosetta', curiosity: 'Curiosity', perseverance: 'Perseverance', clipper: 'Europa Clipper', eht: 'EHT', ligo: 'LIGO', alma: 'ALMA' };
  const MAINBAND = { xmm: 'xray', swift: 'gamma', sdo: 'uv', rubin: 'vis', voyager: 'insitu', cassini: 'insitu', juno: 'micro', nh: 'vis', parker: 'insitu', rosetta: 'insitu', curiosity: 'insitu', perseverance: 'insitu', clipper: 'insitu', soho: 'uv', tess: 'vis', cobe: 'micro', euclid: 'vis', roman: 'ir' };
  function timeline() {
    const svg = $('#msTime'), box = svg.parentElement, T = tok();
    const W = Math.max(320, Math.round(box.clientWidth || 800)), narrow = W < 560;
    const list = M.slice().sort((a, b) => a.y - b.y), RH = narrow ? 17 : 19, top = 26, LW = narrow ? 92 : 130;
    const H = top + list.length * RH + 30, Y0 = 1975, Y1 = 2031;
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`); svg.setAttribute('height', H); svg.innerHTML = '';
    const X = (y) => LW + (y - Y0) / (Y1 - Y0) * (W - LW - 12);
    for (let y = 1980; y <= 2030; y += narrow ? 10 : 5) {
      el('line', { x1: X(y), x2: X(y), y1: top - 6, y2: H - 24, stroke: T.line, opacity: y % 10 ? 0.4 : 0.9 }, svg);
      txt(svg, X(y), H - 8, y, { 'text-anchor': 'middle', 'font-size': 11, fill: T.faint });
    }
    el('line', { x1: X(NOW), x2: X(NOW), y1: top - 14, y2: H - 24, stroke: T.accent, 'stroke-width': 1.5 }, svg);
    txt(svg, X(NOW), top - 16, 'today', { 'text-anchor': 'middle', 'font-size': 10.5, fill: T.accent });
    list.forEach((m, i) => {
      const y = top + i * RH, k = MAINBAND[m.id] || m.bands[0], col = bandCol(k);
      const on = m.id === F.sel, act = live(m), end = act ? NOW : Math.min(NOW, (m.end || NOW) + 0.9);
      const g = el('g', { tabindex: 0, role: 'button', 'aria-label': `${m.name}, ${m.y}${act ? ', still active' : ' to ' + m.end}. Open details.`, style: 'cursor:pointer', class: 'ms-tlrow' }, svg);
      el('rect', { x: 0, y: y, width: W, height: RH, fill: on ? T.surface : 'transparent' }, g);
      txt(g, LW - 8, y + RH * 0.7, SHORT[m.id], { 'text-anchor': 'end', 'font-size': narrow ? 11 : 12, fill: on ? T.accent : T.fg, 'font-weight': on ? 700 : 400 });
      el('rect', { x: X(m.y), y: y + 4, width: Math.max(3, X(end) - X(m.y)), height: RH - 8, rx: 3, fill: col, opacity: act ? 0.95 : 0.55 }, g);
      if (m.pre) el('rect', { x: X(m.y), y: y + 4, width: X(m.pre + 0.7) - X(m.y), height: RH - 8, rx: 3, fill: T.bg, opacity: 0.55 }, g);   // earlier, less sensitive phase drawn lighter
      if (act) el('path', { d: `M${X(end)},${y + 4} l6,${(RH - 8) / 2} l-6,${(RH - 8) / 2} z`, fill: col }, g);
      if (m.id === 'clipper') { el('circle', { cx: X(2030.3), cy: y + RH / 2, r: 4, fill: 'none', stroke: col, 'stroke-width': 1.5 }, g); if (!narrow) txt(g, X(2030.3) - 8, y + RH * 0.72, 'arrives', { 'text-anchor': 'end', 'font-size': 10, fill: T.muted }); }
      const open = () => jumpTo(m.id);
      g.addEventListener('click', open);
      g.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); } });
    });
  }

  /* ================= Detectors ================= */
  const DET = [
    ['radio', 'Radio and millimetre: antennas and receivers', 'A dish reflects radio waves to a receiver that records the wave itself, including its phase. Because the phase is kept, dishes far apart can be combined into one giant telescope (interferometry).', 'alma'],
    ['micro', 'Microwave: bolometers', 'A tiny absorber warms up when light hits it, and a thermometer reads the rise. Cooled to a tenth of a degree above absolute zero, Planck’s bolometers sensed millionths of a degree.', 'planck'],
    ['ir', 'Infrared: HgCdTe and Si:As arrays', 'Like a camera chip, but made of materials that respond to lower-energy photons. Each pixel has its own amplifier. They must be cold, or their own heat swamps the sky.', 'jwst'],
    ['vis', 'Visible: CCD and CMOS sensors', 'In silicon, each photon frees an electron, which is stored in a pixel until readout. The best detectors catch over 90% of the photons that hit them; film caught a few percent.', 'gaia'],
    ['uv', 'Ultraviolet: photon counters', 'Microchannel plates turn each photon into an avalanche of electrons, so single photons can be counted and timed. UV-boosted CCDs are used too.', 'hubble'],
    ['xray', 'X-ray: grazing mirrors and energy-measuring CCDs', 'An X-ray photon frees about one electron for every 3.65 eV of its energy, so the size of each charge packet tells the photon’s energy: a spectrum from a camera.', 'chandra'],
    ['gamma', 'Gamma rays: particle trackers', 'No mirror can focus gamma rays. Instead, each one turns into an electron and a positron in a stack of tungsten and silicon; their tracks point back to the source and a calorimeter measures their energy.', 'fermi'],
    ['gw', 'Gravitational waves: laser interferometers', 'Laser light bounces along two 4 km arms at right angles. A passing wave stretches one arm and squeezes the other by about 10⁻¹⁹ m, which shifts how the beams combine.', 'ligo'],
    ['insitu', 'On the spot: the lab goes there', 'Mass spectrometers weigh molecules, magnetometers measure fields, and lasers vaporise rock so its light can be split into a spectrum. Some questions need a sample.', 'curiosity'],
  ];
  $('#msDet').innerHTML = DET.map(([k, t, d, ex]) => `<button type="button" class="bh-feat" data-k="${k}" data-ex="${ex}"><b><span class="ms-dot" style="background:${BMAP[k].col}"></span>${esc(t)}</b><span>${esc(d)}</span><span class="ms-ex">Example: ${esc(byId[ex].name)} →</span></button>`).join('');
  $$('#msDet .bh-feat').forEach((b) => b.addEventListener('click', () => {
    const ex = byId[b.dataset.ex]; F.band = ex.bands.includes(b.dataset.k) ? b.dataset.k : ex.bands[0]; F.kind = 'all'; segSync($('#msBandSeg'), F.band); segSync($('#msKind'), 'all');
    F.sel = b.dataset.ex; store.set('sel', F.sel); showTab('fleet'); grid();
    $('#fleet').scrollIntoView({ block: 'start' });
  }));

  // CCD: bucket-brigade readout
  const N = 6;
  const Q = Array.from({ length: N }, (_, r) => Array.from({ length: N }, (_, c) => Math.min(1, 0.06 + Math.exp(-((c - 3.6) ** 2 + (r - 2.4) ** 2) / 1.3) + 0.55 * Math.exp(-((c - 1.2) ** 2 + (r - 4.3) ** 2) / 0.5))));
  const STEPS = [
    ['Expose', 'Photons strike the silicon. Each one frees an electron, which is trapped in the pixel it landed in. Brighter spots fill their pixel "wells" faster.'],
    ['Shift rows', 'After the exposure, voltages on the chip pass every row of charge down by one, like a bucket brigade. The bottom row drops into a single readout row.'],
    ['Read out', 'The readout row shifts sideways, one pixel at a time, into an amplifier. Each charge packet becomes a voltage, then a number. Repeat until every row is read.'],
    ['Image', 'The numbers are rebuilt into a picture. The count in each pixel is proportional to the light that fell there, which is what makes CCDs precise measuring tools, not just cameras.'],
  ];
  const C = { step: 0, t: 1, raf: 0, playing: false, last: 0 };
  segBuild($('#msCCDStep'), STEPS.map(([s], i) => [String(i), (i + 1) + '. ' + s]), '0', (k) => { ccdStop(); C.step = +k; C.t = 1; ccdDraw(); });
  function ccdDraw() {
    const svg = $('#msCCD'); if (!svg || svg.closest('[hidden]')) return;
    svg.innerHTML = ''; const T = tok();
    segSync($('#msCCDStep'), String(C.step));
    $('#msCCDOut').textContent = STEPS[C.step][1];
    const P = 34, gx = 40, gy = 20, t = C.t;
    const cell = (r, c, q, dx, dy) => {
      const x = gx + c * P + (dx || 0), y = gy + r * P + (dy || 0);
      el('rect', { x: x + 1, y: y + 1, width: P - 2, height: P - 2, rx: 3, fill: T.surface, stroke: T.line }, svg);
      if (q > 0.01) el('rect', { x: x + 4, y: y + P - 3 - (P - 8) * q, width: P - 8, height: (P - 8) * q, rx: 2, fill: '#5aa6ff', opacity: 0.9 }, svg);
    };
    const serialY = gy + N * P + 14;
    if (C.step === 0) {
      for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) cell(r, c, Q[r][c] * t);
      for (let i = 0; i < 14; i++) {                         // falling photons
        const c = (i * 7 + 3) % N, r = (i * 5 + 1) % N, ph = (t * 3 + i / 14) % 1;
        if (t < 1) el('circle', { cx: gx + c * P + P / 2 + ((i * 13) % 9) - 4, cy: gy + r * P * ph, r: 2.5, fill: '#ffd166' }, svg);
      }
    } else if (C.step === 1) {
      const dy = t * P;
      for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) cell(r, c, Q[r][c], 0, r === N - 1 ? dy * (14 + P) / P : dy);
    } else if (C.step === 2) {
      for (let r = 0; r < N - 1; r++) for (let c = 0; c < N; c++) cell(r + 1, c, Q[r][c]);
    } else {
      for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
        const v = Math.round(255 * Math.pow(Q[r][c], 0.7));
        el('rect', { x: gx + c * P + 1, y: gy + r * P + 1, width: P - 2, height: P - 2, fill: `rgb(${v},${v},${v})` }, svg);
      }
    }
    // serial register and amplifier
    el('rect', { x: gx - 4, y: serialY - 4, width: N * P + 8, height: P + 8, rx: 6, fill: 'none', stroke: T.faint, 'stroke-dasharray': '4 3' }, svg);
    txt(svg, gx - 6, serialY + P + 22, 'readout row', { 'font-size': 11, fill: T.muted });
    const ax = gx + N * P + 40, ay = serialY + P / 2;
    el('path', { d: `M${ax - 14},${ay - 14} L${ax + 12},${ay} L${ax - 14},${ay + 14} Z`, fill: T.surface, stroke: T.fg }, svg);
    txt(svg, ax - 2, ay + 32, 'amplifier', { 'text-anchor': 'middle', 'font-size': 11, fill: T.muted });
    if (C.step === 2) {
      const row = Q[N - 1], k = Math.min(N, Math.floor(t * (N + 0.999)));
      for (let c = 0; c < N; c++) {
        const pos = c + k;                                    // shifted right by k
        if (pos < N) { const x = gx + pos * P; el('rect', { x: x + 4, y: serialY + P - 3 - (P - 8) * row[c], width: P - 8, height: (P - 8) * row[c], rx: 2, fill: '#5aa6ff' }, svg); }
      }
      const readN = Math.min(N, k), vals = [];
      for (let c = N - 1; c >= N - readN; c--) vals.push(Math.round(row[c] * 4000));
      // newest value beside the amplifier, the two before it stacked above (keeps everything inside the 440-wide view)
      txt(svg, ax + 20, ay + 4, '→ ' + (vals.length ? vals[vals.length - 1] : ''), { 'font-size': 12, 'font-family': 'var(--font-mono)', fill: T.accent, 'font-weight': 600 });
      vals.slice(-3, -1).reverse().forEach((v, i) => txt(svg, ax + 34, ay - 12 - i * 15, String(v), { 'font-size': 11, 'font-family': 'var(--font-mono)', fill: T.muted, opacity: 0.85 - i * 0.25 }));
      if (vals.length > 3) txt(svg, ax + 34, ay - 42, '…', { 'font-size': 11, fill: T.faint });
    } else if (C.step === 1 && t >= 1) {
      Q[N - 1].forEach((q, c) => el('rect', { x: gx + c * P + 4, y: serialY + P - 3 - (P - 8) * q, width: P - 8, height: (P - 8) * q, rx: 2, fill: '#5aa6ff' }, svg));
    }
    if (C.step === 3) txt(svg, gx + N * P + 20, gy + 40, 'two stars', { 'font-size': 12, fill: T.muted });
    txt(svg, gx, gy - 6, C.step === 3 ? 'pixel values as brightness' : 'pixels (charge wells)', { 'font-size': 11, fill: T.muted });
  }
  function ccdStop() { C.playing = false; cancelAnimationFrame(C.raf); const b = $('#msCCDPlay'); if (b) b.textContent = 'Play'; }
  function ccdLoop(ts) {
    if (!C.playing) return;
    const dt = Math.min(0.1, (ts - (C.last || ts)) / 1000); C.last = ts;
    C.t += dt / [2.4, 1.2, 3, 1.5][C.step];
    if (C.t >= 1) { if (C.step < 3) { C.step++; C.t = 0; } else { C.t = 1; ccdDraw(); ccdStop(); return; } }
    ccdDraw();
    C.raf = requestAnimationFrame(ccdLoop);
  }
  $('#msCCDPlay').addEventListener('click', () => {
    if (C.playing) { ccdStop(); return; }
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) { C.step = (C.step + 1) % 4; C.t = 1; ccdDraw(); return; }
    if (C.step === 3 && C.t >= 1) C.step = 0;
    C.t = 0; C.playing = true; C.last = 0; $('#msCCDPlay').textContent = 'Pause';
    C.raf = requestAnimationFrame(ccdLoop);
  });

  /* ---------- Boot ---------- */
  function redraw() { const id = (tabs.find((t) => t.getAttribute('aria-selected') === 'true') || tabs[0]).getAttribute('aria-controls'); showTab(id); if (id === 'fleet') grid(); }
  let rT = 0, lastW = innerWidth;
  addEventListener('resize', () => { if (innerWidth === lastW) return; lastW = innerWidth; clearTimeout(rT); rT = setTimeout(() => { if (!$('#compare').hidden) timeline(); }, 150); });
  matchMedia('(prefers-color-scheme: light)').addEventListener('change', () => { redraw(); });
  grid();
  const hashTab = location.hash.slice(1), saved = store.get('tab');
  const start = tabs.some((t) => t.getAttribute('aria-controls') === hashTab) ? hashTab : tabs.some((t) => t.getAttribute('aria-controls') === saved) ? saved : 'fleet';
  showTab(start);
})();
