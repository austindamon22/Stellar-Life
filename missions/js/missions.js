/* Stellar Life — missions.js: fleet explorer, atmosphere, orbit map, mirrors, timeline, detectors */
(function () {
  'use strict';
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const { M, BANDS, WHERE } = window.MISSIONS;
  const NS = 'http://www.w3.org/2000/svg';
  const NOW = 2026.83;
  const store = { get(k) { try { return localStorage.getItem('missions-' + k); } catch (e) { return null; } }, set(k, v) { try { localStorage.setItem('missions-' + k, v); } catch (e) { /* unavailable */ } } };
  const tok = () => { const c = getComputedStyle(document.documentElement), g = (n) => c.getPropertyValue(n).trim(); return { fg: g('--fg'), muted: g('--muted'), faint: g('--faint'), line: g('--line'), accent: g('--accent'), surface: g('--surface'), bg: g('--bg'), gw: g('--ms-gw') || '#b9c0d8', band: (k) => g('--ms-b-' + k) }; };
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const BMAP = Object.fromEntries(BANDS.map((b) => [b.k, b]));
  const bandCol = (k) => (k === 'gw' ? tok().gw : tok().band(k) || BMAP[k].col);          // resolved colour, for SVG (darker variants on the light theme)
  const bandCss = (k) => (k === 'gw' ? 'var(--ms-gw)' : `var(--ms-b-${k}, ${BMAP[k].col})`);    // CSS colour, follows the theme by itself
  const byId = Object.fromEntries(M.map((m) => [m.id, m]));
  const status = (m) => m.st || (m.end ? 'Ended ' + m.end : 'Operating');
  const live = (m) => (typeof m.live === 'boolean' ? m.live : !m.end);   // still a current facility: timeline arrow
  const stCls = (m) => (m.live === 'pause' ? 'pause' : live(m) ? 'on' : '');   // status colour: green only while observing
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
  // label on a coloured fill: a semi-transparent surface pill behind the text (needs the SVG on screen for getBBox)
  function pill(parent, x, y, s, attrs) {
    const t = txt(parent, x, y, s, attrs), b = t.getBBox(), T = tok();
    const r = el('rect', { x: b.x - 4, y: b.y - 1, width: b.width + 8, height: b.height + 2, rx: (b.height + 2) / 2, fill: T.surface, opacity: 0.82 });
    parent.insertBefore(r, t); return t;
  }

  /* ---------- Tabs ---------- */
  const tabs = $$('.tabs [role=tab]');
  const drawn = {};
  function showTab(id, focus) {
    tabs.forEach((t) => { const on = t.getAttribute('aria-controls') === id; t.setAttribute('aria-selected', String(on)); t.tabIndex = on ? 0 : -1; $('#' + t.getAttribute('aria-controls')).hidden = !on; if (on && focus) t.focus(); });
    store.set('tab', id);
    if (id !== 'detect' && C.playing) { ccdStop(); C.t = 1; }   // a tab switch ends playback on a clean, finished frame
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
  segBuild($('#msBandSeg'), [['all', 'All light', null]].concat(BANDS.map((b) => [b.k, b.name, bandCss(b.k)])), F.band, setBand);
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
    const box = $('#msGrid'); $('.ms-layout').appendChild($('#msDetail')); box.innerHTML = '';
    const one = list.length === 1;
    const what = F.band === 'all' ? '' : F.band === 'insitu' ? (one ? ' that measures things on the spot' : ' that measure things on the spot') : F.band === 'gw' ? (one ? ' that detects gravitational waves' : ' that detect gravitational waves') : (one ? ' that observes in ' : ' that observe in ') + BMAP[F.band].name.toLowerCase();
    $('#msCount').textContent = list.length + (one ? ' mission' : ' missions') + what + '.';
    list.forEach((m) => {
      const li = document.createElement('li'), b = document.createElement('button');
      b.type = 'button'; b.className = 'ms-card'; b.setAttribute('aria-pressed', String(m.id === F.sel));
      b.innerHTML = `<span class="ms-yr">${m.y}${m.end ? '–' + m.end : ''}</span><b>${esc(m.name)}</b><span class="ms-who">${esc(m.who)}</span><span class="ms-bands">${m.bands.map((k) => `<span class="ms-dot" style="background:${bandCss(k)}" title="${BMAP[k].name}"></span>`).join('')}</span><span class="ms-st ${stCls(m)}">${esc(status(m))}</span>`;
      b.addEventListener('click', () => select(m.id, true));
      li.appendChild(b); box.appendChild(li);
    });
    if (!list.some((m) => m.id === F.sel) && list.length) F.sel = list[0].id;
    $$('.ms-card', box).forEach((b, i) => b.setAttribute('aria-pressed', String(list[i].id === F.sel)));
    detail(); placeDetail();
  }
  // Phones and narrow windows: the detail panel sits in the grid, right after the row holding the chosen card.
  const narrowQ = matchMedia('(max-width: 900px)');
  function placeDetail() {
    const det = $('#msDetail'), lay = $('.ms-layout'); let slot = $('#msDetailSlot');
    const cur = $$('#msGrid .ms-card').find((b) => b.getAttribute('aria-pressed') === 'true');
    if (!narrowQ.matches || !cur) { if (det.parentElement !== lay) lay.appendChild(det); if (slot) slot.remove(); return; }
    if (!slot) { slot = document.createElement('li'); slot.id = 'msDetailSlot'; slot.className = 'ms-slot'; }
    slot.remove();
    const li = cur.parentElement; let end = li;
    if (li.offsetParent) for (let n = li.nextElementSibling; n && n.offsetTop === li.offsetTop; n = n.nextElementSibling) end = n;
    end.after(slot); slot.appendChild(det);
  }
  narrowQ.addEventListener('change', placeDetail);
  function select(id, scroll) {
    F.sel = id; store.set('sel', id);
    $$('#msGrid .ms-card').forEach((b) => b.setAttribute('aria-pressed', String(b.querySelector('b').textContent === byId[id].name)));
    detail(); placeDetail();
    const cur = $$('#msGrid .ms-card').find((b) => b.getAttribute('aria-pressed') === 'true');
    if (scroll && cur && narrowQ.matches) cur.parentElement.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
  }
  function apText(m) {
    if (m.id === 'eht') return 'Virtual dish the size of Earth (12,700 km)';
    if (m.id === 'alma') return '66 dishes of 7–12 m, spread up to 16 km';
    if (m.id === 'chandra') return '1.2 m nested grazing-incidence mirrors';
    if (m.id === 'gaia') return 'Two 1.45 × 0.5 m mirrors';
    if (m.id === 'tess') return 'Four 10.5 cm lenses';
    if (m.id === 'ligo') return 'Two 4 km laser arms per site';
    if (m.id === 'xmm') return 'Three modules of 58 nested grazing-incidence mirrors';
    if (m.id === 'hipparcos') return '29 cm Schmidt telescope viewing two fields at once';
    if (m.id === 'vla') return '27 dishes of 25 m, spread up to 36 km';
    if (m.id === 'nustar') return 'Two sets of 133 nested grazing-incidence shells';
    if (m.id === 'ixpe') return 'Three nested grazing-incidence mirror modules';
    if (m.id === 'spherex') return '20 cm telescope';
    return m.ap ? m.ap + ' m mirror' : null;
  }
  function detail() {
    const m = byId[F.sel], box = $('#msDetail');
    if (!m) { box.innerHTML = ''; return; }
    const rows = [['Operated by', m.who], ['Launched / began', m.y], ['Status', status(m)], ['Where', m.whereTxt]];
    const ap = apText(m); if (ap) rows.push(['Collector', ap]);
    rows.push(['Sees', m.bands.map((k) => `<span class="ms-tag" style="--c:${bandCss(k)}">${BMAP[k].name}</span>`).join(' ')]);
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
  // Water bands at 1.4 and 1.9 μm leave the H (1.6 μm) and K (2.2 μm) windows open; 60 GHz (5 mm) is oxygen.
  const ATM = [[-13, 25], [-12, 29], [-11, 36], [-10, 58], [-9, 100], [-8, 125], [-7.5, 135], [-7.2, 125], [-7, 110], [-6.85, 100], [-6.75, 80], [-6.7, 55], [-6.6, 48], [-6.52, 25], [-6.48, 4], [-6.45, 0], [-5.88, 0], [-5.85, 2.5], [-5.82, 0], [-5.75, 0], [-5.72, 2.5], [-5.69, 0], [-5.6, 0], [-5.55, 1.5], [-5.4, 0], [-5.25, 6], [-5.1, 0], [-4.9, 0], [-4.75, 8], [-4.5, 12], [-4, 14], [-3.5, 8], [-3.2, 4], [-3, 2], [-2.85, 1], [-2.79, 6], [-2.75, 1], [-2.6, 0.3], [-2.5, 0], [-2.43, 0], [-2.4, 8], [-2.37, 0], [-2.32, 0], [-2.28, 15], [-2.24, 0], [-2, 0], [1.15, 0], [1.2, 150], [2, 150]];   // ionosphere reflects radio longer than ~15 m (below ~20 MHz)
  const BSPAN = [['gamma', -13, -11], ['xray', -11, -8], ['uv', -8, -6.42], ['vis', -6.42, -6.125], ['ir', -6.125, -3], ['micro', -3, -0.523], ['radio', -0.523, 2]];   // microwave 1 mm–30 cm, radio beyond
  const atmAt = (lx) => { for (let i = 1; i < ATM.length; i++) if (lx <= ATM[i][0]) { const [a, ha] = ATM[i - 1], [b, hb] = ATM[i]; return ha + (hb - ha) * (lx - a) / (b - a); } return 150; };
  function lamText(lx) {
    const l = Math.pow(10, lx);
    if (l >= 1) return +l.toPrecision(2) + ' m';
    if (l >= 1e-3) return +(l * 1e3).toPrecision(2) + ' mm';
    if (l >= 1e-6) return +(l * 1e6).toPrecision(2) + ' μm';
    if (l >= 1e-10) return +(l * 1e9).toPrecision(2) + ' nm';
    return +(l * 1e12).toPrecision(2) + ' pm';
  }
  const A = { lx: null };
  function atmo() {
    const svg = $('#msAtmo'); svg.innerHTML = ''; const T = tok();
    const X0 = 128, X1 = 885, Y0 = 34, Y1 = 290, LX0 = -13, LX1 = 2, HMAX = 150;
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
    // altitude labels sit in the left gutter, centred on their lines (Everest and aircraft are only ~13 px apart, so they nudge apart)
    [[0, 'sea level', 0], [8.8, 'Everest 8.8 km', 4], [13, 'aircraft ~13 km', -3], [40, 'balloons ~40 km', 0], [100, 'space 100 km', 0], [150, '150 km', 0]].forEach(([h, s, dy]) => {
      el('line', { x1: X0 - 3, x2: X1, y1: Y(h), y2: Y(h), stroke: T.line, 'stroke-dasharray': h ? '3 4' : '', opacity: 0.8 }, svg);
      txt(svg, X0 - 6, Y(h) + 4 + dy, s, { 'font-size': 11, fill: T.muted, 'text-anchor': 'end' });
    });
    txt(svg, 12, (Y0 + Y1) / 2, 'altitude', { 'font-size': 11, fill: T.faint, transform: `rotate(-90 12 ${(Y0 + Y1) / 2})`, 'text-anchor': 'middle' });
    BSPAN.forEach(([k, a, b]) => {
      txt(svg, k === 'uv' ? (X(a) + X(b)) / 2 - 14 : (X(a) + X(b)) / 2, Y0 - 18, BMAP[k].name.split(' /')[0], { 'text-anchor': 'middle', 'font-size': k === 'vis' ? 10 : 12, dy: k === 'vis' ? 12 : 0, 'font-weight': 600, fill: BMAP[k].col === '#ffffff' ? T.fg : T.fg });
      el('line', { x1: X(a), x2: X(a), y1: Y0 - 12, y2: Y0, stroke: T.line }, svg);
    });
    for (let lx = -12; lx <= 2; lx += 2) txt(svg, X(lx), Y1 + 16, lamText(lx), { 'text-anchor': lx === 2 ? 'end' : 'middle', 'font-size': 11, fill: T.faint });
    txt(svg, X1, Y1 + 32, 'wavelength →', { 'text-anchor': 'end', 'font-size': 11, fill: T.faint });
    const lab = { 'font-size': 11, fill: T.fg };
    pill(svg, X(-6.27), Y(0) - 18, 'optical window', Object.assign({ 'text-anchor': 'middle' }, lab));
    pill(svg, X(-0.5), Y(0) - 18, 'radio window', Object.assign({ 'text-anchor': 'middle' }, lab));
    pill(svg, X(-4.3), Y(14) - 8, 'water vapour', Object.assign({ 'text-anchor': 'middle' }, lab));
    pill(svg, X(-6.47) + 6, Y(26), '← ozone', Object.assign({ 'text-anchor': 'start' }, lab));
    pill(svg, X(-2.28), Y(15) - 6, 'oxygen', Object.assign({ 'text-anchor': 'middle' }, lab));
    pill(svg, X(1.15) - 6, Y(90), 'ionosphere →', Object.assign({ 'text-anchor': 'end' }, lab));
    const cur = el('line', { y1: Y0, y2: Y1, stroke: T.fg, 'stroke-width': 1, opacity: 0 }, svg);
    const out = $('#msAtmoOut');
    const hit = el('rect', { x: X0, y: Y0, width: X1 - X0, height: Y1 - Y0, fill: 'transparent', style: 'cursor:crosshair', class: 'ms-hit', tabindex: 0, role: 'slider', 'aria-label': 'Wavelength', 'aria-valuemin': LX0, 'aria-valuemax': LX1, 'aria-orientation': 'horizontal' }, svg);
    const show = (lx) => {
      lx = Math.max(LX0, Math.min(LX1, lx)); A.lx = lx;
      cur.setAttribute('x1', X(lx)); cur.setAttribute('x2', X(lx)); cur.setAttribute('opacity', 0.7);
      const h = atmAt(lx), band = BSPAN.find(([, a, b]) => lx >= a && lx < b) || BSPAN[6];
      const where = lx > 1.12 ? 'reflected by the ionosphere (~100–300 km up): only spacecraft see it'
        : h < 0.3 ? 'reaches the ground: telescopes on Earth work here'
        : h < 15 ? `stopped about ${h.toFixed(0)} km up: high mountains or aircraft help`
        : h < 50 ? `stopped about ${h.toFixed(0)} km up: needs balloons or spacecraft`
        : h <= 100 ? `stopped about ${h.toFixed(0)} km up: needs rockets or spacecraft`
        : `stopped about ${h.toFixed(0)} km up: only spacecraft see it`;
      const l = Math.pow(10, lx), ms = M.filter((m) => m.kind !== 'probe' && sees(m, l)).sort((a, b) => b.y - a.y).map((m) => SHORT[m.id] || m.name);
      const list = ms.length ? ' Observed by: ' + (ms.length > 7 ? ms.slice(0, 6).join(', ') + ' and ' + (ms.length - 6) + ' more' : ms.join(', ')) + '.' : ' None of the missions here observes this wavelength.';
      const s = `${lamText(lx)} (${BMAP[band[0]].name.toLowerCase()}): ${where}.`;
      out.textContent = s + list;
      hit.setAttribute('aria-valuenow', lx.toFixed(2)); hit.setAttribute('aria-valuetext', s);
    };
    const probe = (e) => { const r = svg.getBoundingClientRect(), sx = (e.clientX - r.left) / r.width * 900; show(LX0 + (sx - X0) / (X1 - X0) * (LX1 - LX0)); };
    hit.addEventListener('pointerdown', probe);
    hit.addEventListener('pointermove', (e) => { if (e.pointerType !== 'touch') probe(e); });   // touch: tap only, so swiping the strip doesn't change the readout
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
    { k: 'ground', name: 'Earth’s surface', d: null, ids: ['eht', 'ligo', 'alma', 'rubin', 'vla'] },
    { k: 'leo', row: 0, name: 'Low orbit', d: 500, ids: ['hubble', 'fermi', 'cobe', 'swift', 'xrism', 'nustar', 'ixpe', 'spherex', 'cgro'] },
    { k: 'geo', row: 1, an: 'end', name: '36,000 km', full: 'Out to ~36,000 km (geosynchronous height)', d: 3.6e4, ids: ['sdo', 'hipparcos'] },
    { k: 'heo', row: 2, an: 'end', name: 'High Earth orbit', full: 'High Earth orbit (out to 115,000–140,000 km)', d: 1.3e5, ids: ['chandra', 'xmm'] },
    { k: 'moon', row: 3, an: 'start', name: 'TESS, out to the Moon', full: 'Out to ~375,000 km, near the Moon’s distance', d: 3.75e5, ids: ['tess'] },
    { k: 'lpt', row: 2, an: 'start', name: 'L1 and L2', d: 1.5e6, ids: ['soho', 'jwst', 'gaia', 'wmap', 'planck', 'euclid', 'roman', 'herschel'] },
    { k: 'sun', row: 1, an: 'end', off: -7, name: 'Near the Sun', d: 1.5e8, ids: ['parker'] },
    { k: 'mars', row: 2, an: 'end', off: -7, name: 'Mars', d: 2.3e8, ids: ['curiosity', 'perseverance'] },
    { k: 'trail', row: 0, an: 'end', off: 7, name: 'Earth-trailing', full: 'Earth-trailing orbit around the Sun: they drift out to ~250 million km from Earth', d: 2.5e8, ids: ['spitzer', 'kepler'] },   // drawn after Near the Sun and Mars: its haloed label sits over their leaders
    { k: 'comet', row: 3, an: 'end', off: 7, name: 'Comet 67P', d: 4e8, ids: ['rosetta'] },
    { k: 'cruise', row: 4, an: 'end', name: 'Cruising', full: 'Cruising near Earth’s orbit, ahead of a 3 Dec 2026 Earth flyby on the way to Jupiter', d: 6e7, ids: ['clipper'] },
    { k: 'jup', row: 3, an: 'start', name: 'Jupiter', d: 6.3e8, ids: ['juno'] },
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
    el('line', { x1: X(1.496e8), x2: X(1.496e8), y1: 52, y2: AX, stroke: T.line, 'stroke-dasharray': '2 4' }, svg);   // starts below row 3's labels
    txt(svg, X(1.496e8) - 4, 62, '1 AU: Earth–Sun', { 'font-size': 10, fill: T.faint, 'text-anchor': 'end' });   // left of the line: leaders to its right
    const ROWS = [170, 128, 86, 44, 193];   // row 4 sits just above the axis
    PLACES.forEach((p) => {
      const x = p.d ? X(p.d) : 46, y = p.d ? ROWS[p.row] : 160;
      const on = p.k === orbitSel, n = p.ids.length;
      const grp = el('g', n ? { tabindex: 0, role: 'button', 'aria-pressed': String(on), 'aria-label': `${p.name}: ${n} mission${n > 1 ? 's' : ''}`, style: 'cursor:pointer' } : {}, svg);
      const cy = AX + (p.off || 0);   // the 1.5–4 × 10⁸ km cluster alternates just above and below the axis
      if (p.d) el('line', { x1: x, x2: x, y1: y + 6, y2: cy, stroke: on ? T.accent : T.line }, grp);
      el('circle', { cx: x, cy: p.d ? cy : AX - 22, r: n ? 4 + Math.sqrt(n) : 4, fill: n ? (on ? T.accent : T.muted) : T.faint, opacity: p.d ? 1 : 0 }, grp);
      const label = p.d ? p.name + (n ? ` (${n})` : '') : '';
      if (label) {
        const t = txt(grp, x, y, label, Object.assign({ 'text-anchor': p.an || 'middle', 'font-size': 12, 'font-weight': on ? 700 : 500, fill: on ? T.accent : T.fg }, halo()));
        t.setAttribute('class', 'ms-orbit-l');
      }
      if (!p.d) txt(grp, 46, AX - 26, 'ground (' + n + ')', Object.assign({ 'text-anchor': 'middle', 'font-size': 12, 'font-weight': on ? 700 : 500, fill: on ? T.accent : T.fg }, halo()));
      if (n) {   // transparent hit area: the label plus a strip down its leader line to the dot
        const t = grp.querySelector('text'), b = t.getBBox(), first = grp.firstChild;
        const hr = (a) => grp.insertBefore(el('rect', Object.assign({ fill: 'transparent', 'pointer-events': 'all' }, a)), first);
        hr({ x: b.x - 3, y: b.y - 3, width: b.width + 6, height: b.height + 6 });
        if (p.d) hr({ x: x - 3, y: b.y + b.height, width: 6, height: Math.max(0, cy + 6 - b.y - b.height) });   // narrow: neighbours sit 5 px apart
        else hr({ x: 46 - 18, y: b.y + b.height, width: 36, height: AX + 18 - b.y - b.height });
      }
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
  const MIR = [['jwst', 'Webb', 6.5, 25.4], ['herschel', 'Herschel', 3.5, 9.6], ['hubble', 'Hubble', 2.4, HUB_A], ['roman', 'Roman', 2.4, HUB_A], ['planck', 'Planck', 1.5, null], ['gaia', 'Gaia', 1.45, null], ['wmap', 'WMAP', 1.4, null], ['euclid', 'Euclid', 1.2, 1.1], ['chandra', 'Chandra', 1.2, null], ['kepler', 'Kepler', 0.95, 0.71], ['spitzer', 'Spitzer', 0.85, 0.57], ['tess', 'TESS', 0.105, 0.0087]];   // TESS: one camera's lens
  // Ground giants (table and the lower, smaller-scale row): [key, name, D (m), area (m²), [λ min, λ max] of their instruments]
  const GROUND = [['rubin', 'Rubin', 8.4, 35, null], ['keck', 'Keck (each of two)', 10, 76, [3e-7, 5.3e-6]], ['elt', 'ELT (building)', 39, 978, [4e-7, 1.35e-5]]];
  // flat-topped hexagons (vertices at k·60°): columns 1.5 s apart, rows √3 s apart
  function hexPath(cells, s, ox, oy, k) { let d = ''; cells.forEach(([q, r]) => { const hx = ox + 1.5 * s * q, hy = oy + Math.sqrt(3) * s * (r + q / 2); for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3; d += (i ? 'L' : 'M') + (hx + s * k * Math.cos(a)).toFixed(1) + ',' + (hy + s * k * Math.sin(a)).toFixed(1); } d += 'Z'; }); return d; }
  function hexCells(test, n) { const out = []; for (let q = -n; q <= n; q++) for (let r = -n; r <= n; r++) if (test(q, r)) out.push([q, r]); return out; }
  const ring = (q, r) => Math.max(Math.abs(q), Math.abs(r), Math.abs(q + r));
  const WEBB = hexCells((q, r) => ring(q, r) >= 1 && ring(q, r) <= 2, 2);          // 18: wings are the q = ±2 columns of three
  const KECK = hexCells((q, r) => ring(q, r) >= 1 && ring(q, r) <= 3, 3);          // 36
  const ELT = hexCells((q, r) => { const x = 1.05 * q, y = Math.sqrt(3) * 0.7 * (r + q / 2), d = Math.hypot(x, y); return d <= 18.7 && d >= 5; }, 30);   // 798 segments, 1.4 m across
  function webb(g, cx, cy, S, thin) { el('path', { d: hexPath(WEBB, 1.32 / Math.sqrt(3) * S, cx, cy, 0.96), fill: '#d9a93a', stroke: '#8a6a1a', 'stroke-width': thin ? 0.5 : 1 }, g); }
  const ELL = { planck: [1.9, 1.5], wmap: [1.4, 1.6] };   // off-axis elliptical primaries: [width, height] in m (ESA; Bennett et al. 2003)
  function mirrors() {
    const svg = $('#msMirror'); svg.innerHTML = ''; const T = tok();
    const S = 27.5, base = 250, gap = 0.42; let x = 26;
    const lab = (X, Y, s, a) => txt(svg, X, Y, s, Object.assign({ 'text-anchor': 'middle', 'font-size': 12, 'font-weight': 600, fill: T.fg }, halo(), a || {}));
    const size = (X, Y, s) => txt(svg, X, Y, s, { 'text-anchor': 'middle', 'font-size': 11, fill: T.muted });
    const person = (px, b, S) => { const ph = 1.75 * S, pg = el('g', { fill: T.muted }, svg); el('circle', { cx: px, cy: b - ph + 0.12 * S, r: 0.12 * S }, pg); el('rect', { x: px - 0.2 * S, y: b - ph + 0.27 * S, width: 0.4 * S, height: 0.7 * S, rx: Math.min(4, S / 7) }, pg); el('rect', { x: px - 0.17 * S, y: b - ph + 0.95 * S, width: 0.14 * S, height: 0.8 * S }, pg); el('rect', { x: px + 0.03 * S, y: b - ph + 0.95 * S, width: 0.14 * S, height: 0.8 * S }, pg); };
    person(x + 0.3 * S, base, S);
    txt(svg, 12, base + 16, 'person 1.75 m', { 'text-anchor': 'start', 'font-size': 11, fill: T.muted });
    x += 0.6 * S + gap * S;
    el('line', { x1: 10, x2: 890, y1: base, y2: base, stroke: T.line }, svg);
    let small = 0;
    MIR.forEach(([id, name, D]) => {
      const E = ELL[id], r = D / 2 * S, rx = E ? E[0] / 2 * S : r, ry = E ? E[1] / 2 * S : r, cx = x + rx, cy = base - ry;
      const g = el('g', {}, svg);
      if (E) el('ellipse', { cx, cy, rx, ry, fill: '#8a7dff', opacity: 0.9 }, g);
      else if (id === 'jwst') webb(g, cx, cy, S);
      else if (id === 'gaia') el('rect', { x: x, y: base - 0.5 * S, width: D * S, height: 0.5 * S, rx: 3, fill: '#c7cfe0' }, g);
      else if (id === 'chandra') [1, 0.86, 0.72, 0.6].forEach((f) => el('circle', { cx, cy, r: r * f, fill: 'none', stroke: '#5ee6d0', 'stroke-width': 2 }, g));
      else {
        el('circle', { cx, cy, r: Math.max(1.5, r), fill: '#c7cfe0', opacity: 0.9 }, g);
        if (r > 6) el('circle', { cx, cy, r: r * (id === 'hubble' || id === 'roman' ? 0.33 : 0.25), fill: T.surface }, g);
      }
      const big = D >= 1.3, lv = big ? 0 : (small++) % 3;   // small telescopes: three label heights, with leader lines
      const top = id === 'gaia' ? base - 0.5 * S : base - 2 * Math.max(1.5, r);
      if (big) lab(cx, cy - ry - 8, name);
      else { const ly = base - 44 - lv * 17; el('line', { x1: cx, x2: cx, y1: ly + 3, y2: top - 2, stroke: T.faint, 'stroke-width': 1 }, svg); lab(cx, ly, name); }
      size(cx, base + 16 + (E ? 14 : lv * 14), E ? E[0] + ' × ' + E[1] + ' m' : D + ' m');   // the wider ellipse labels drop a line, clear of Gaia's
      x += Math.max(E ? E[0] : D, 0.55) * S + gap * S;
    });
    txt(svg, 890, 18, 'space telescopes, drawn to scale · Webb: 18 gold-coated beryllium segments', { 'text-anchor': 'end', 'font-size': 11, fill: T.faint });

    // ground giants, one sixth of the scale
    const S2 = S / 6, b2 = 540, y2 = 312;
    el('line', { x1: 10, x2: 890, y1: y2 - 14, y2: y2 - 14, stroke: T.line, 'stroke-dasharray': '2 4' }, svg);
    txt(svg, 12, y2 + 4, 'Ground giants, at one sixth of the scale above', { 'font-size': 12, 'font-weight': 600, fill: T.fg });
    txt(svg, 890, y2 + 4, 'Webb and a person repeated for size', { 'text-anchor': 'end', 'font-size': 11, fill: T.faint });
    el('line', { x1: 10, x2: 890, y1: b2, y2: b2, stroke: T.line }, svg);
    let x2 = 30;
    person(x2, b2, S2); size(x2, b2 + 16, 'person'); x2 += 34;
    const row2 = [['jwst', 'Webb', 6.5], ['rubin', 'Rubin', 8.4], ['keck', 'Keck', 10], ['elt', 'ELT', 39]];
    row2.forEach(([id, name, D]) => {
      const r = D / 2 * S2, hv = id === 'keck' ? 3.5 * Math.sqrt(3) * 0.9 * S2 : r, cx = x2 + r, cy = b2 - hv, g = el('g', {}, svg);   // Keck's hexagon is taller than wide
      if (id === 'jwst') webb(g, cx, cy, S2, true);
      else if (id === 'keck') el('path', { d: hexPath(KECK, 1.8 / 2 * S2, cx, cy, 0.94), fill: '#c7cfe0', stroke: T.line, 'stroke-width': 0.4 }, g);
      else if (id === 'elt') { el('path', { d: hexPath(ELT, 0.7 * S2, cx, cy, 0.9), fill: '#c7cfe0' }, g); }
      else { el('circle', { cx, cy, r, fill: '#c7cfe0', opacity: 0.9 }, g); el('circle', { cx, cy, r: r * 5 / 8.4, fill: '#9aa6bf' }, g); el('circle', { cx, cy, r: r * 0.2, fill: T.surface }, g); }
      lab(cx, cy - hv - 8, name);
      size(cx, b2 + 16, D + ' m');
      x2 += D * S2 + 46;
    });
    const nx = x2 - 10;
    [['ELT (ESO, Chile): 798 segments, each 1.4 m.', T.fg], ['Being built; first light planned for 2029,', T.muted], ['science from December 2030.', T.muted], ['', ''], ['Keck (Hawaii): two telescopes,', T.fg], ['each with 36 segments.', T.muted], ['', ''], ['Rubin (Chile): one 8.4 m mirror whose', T.fg], ['darker centre is its third mirror (5 m).', T.muted]].forEach(([s, c], i) => { if (s) txt(svg, nx, y2 + 60 + i * 18, s, { 'font-size': 12, fill: c }); });
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
    const OUT = '<span class="ms-outtxt">outside its band</span><span class="ms-dash" aria-hidden="true">—</span>';
    const rows = MIR.filter(([id]) => !['chandra', 'gaia', 'planck', 'wmap'].includes(id)).map(([id, name, D, A]) => {
      const ok = sees(byId[id], lam);
      return [ok, [name, D + ' m', A ? ratio(A) + (id === 'tess' ? '*' : '') : '—', ok ? angText(1.22 * lam / D) : OUT]];
    });
    rows.push(null);
    GROUND.forEach(([id, name, D, A, lr]) => { const ok = lr ? lam >= lr[0] && lam <= lr[1] : sees(byId[id], lam); rows.push([ok, [name, D + ' m', ratio(A), ok ? angText(1.22 * lam / D) : OUT]]); });
    const alma = sees(byId.alma, lam);
    rows.push([alma, ['ALMA (interferometer)', '12 m dishes, up to 16 km apart', '—', alma ? angText(1.22 * lam / 12) + ' per dish;<br>' + angText(1.22 * lam / 16000) + ' as an array' : OUT]]);
    rows.push([true, ['Event Horizon Telescope (at its 1.3 mm)', '12,700 km (Earth)', '—', angText(1.22 * 1.3e-3 / 1.2742e7)]]);
    const eye = lam >= 3.8e-7 && lam <= 7.5e-7;
    rows.push([eye, ['Your eye', '7 mm pupil', '1/100,000', eye ? angText(1.22 * lam / 0.007) : OUT]]);
    $('#msMirTable tbody').innerHTML = rows.map((row) => { if (!row) return '<tr class="ms-sub"><td colspan="4">On the ground: air blurs these unless adaptive optics corrects it</td></tr>'; const [ok, r] = row; return `<tr${ok ? '' : ' class="ms-out"'}>${r.map((c) => `<td>${c}</td>`).join('')}</tr>`; }).join('');
  }
  $('#msLam').addEventListener('input', mirTable);

  /* ================= Timeline ================= */
  const SHORT = { xmm: 'XMM-Newton', swift: 'Swift', hipparcos: 'Hipparcos', herschel: 'Herschel', sdo: 'SDO', xrism: 'XRISM', rubin: 'Rubin', hubble: 'Hubble', jwst: 'Webb', chandra: 'Chandra', spitzer: 'Spitzer', kepler: 'Kepler', tess: 'TESS', gaia: 'Gaia', cobe: 'COBE', wmap: 'WMAP', planck: 'Planck', fermi: 'Fermi', soho: 'SOHO', euclid: 'Euclid', roman: 'Roman', voyager: 'Voyagers', cassini: 'Cassini', juno: 'Juno', nh: 'New Horizons', parker: 'Parker', rosetta: 'Rosetta', curiosity: 'Curiosity', perseverance: 'Perseverance', clipper: 'Europa Clipper', eht: 'EHT', ligo: 'LIGO', alma: 'ALMA', nustar: 'NuSTAR', ixpe: 'IXPE', cgro: 'Compton GRO', spherex: 'SPHEREx', vla: 'VLA' };
  const MAINBAND = { xmm: 'xray', swift: 'gamma', sdo: 'uv', rubin: 'vis', voyager: 'insitu', cassini: 'insitu', juno: 'micro', nh: 'vis', parker: 'insitu', rosetta: 'insitu', curiosity: 'insitu', perseverance: 'insitu', clipper: 'insitu', soho: 'uv', tess: 'vis', cobe: 'micro', euclid: 'vis', roman: 'ir', spherex: 'ir', vla: 'radio' };
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
      el('rect', { x: X(m.y), y: y + 4, width: Math.max(3, X(end) - X(m.y)), height: RH - 8, rx: 3, fill: col, 'fill-opacity': act ? 0.95 : 0.5, stroke: col, 'stroke-width': 1 }, g);   // solid outline keeps ended bars visible
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
    ['radio', 'Radio and millimetre: antennas and receivers', 'A dish reflects radio waves to a receiver that records the wave itself, including its phase. Because the phase is kept, dishes far apart can be combined into one giant telescope (interferometry).', 'vla'],
    ['micro', 'Microwave: bolometers', 'A tiny absorber warms up when light hits it, and a thermometer reads the rise. Cooled to a tenth of a degree above absolute zero, Planck’s bolometers sensed millionths of a degree.', 'planck'],
    ['ir', 'Infrared: HgCdTe and Si:As arrays', 'Like a camera chip, but made of materials that respond to lower-energy photons. Each pixel has its own amplifier. They must be cold, or their own heat swamps the sky.', 'jwst'],
    ['vis', 'Visible: CCD and CMOS sensors', 'In silicon, each photon frees an electron, which is stored in a pixel until readout. The best detectors catch over 90% of the photons that hit them; film caught a few percent.', 'gaia'],
    ['uv', 'Ultraviolet: photon counters', 'Microchannel plates turn each photon into an avalanche of electrons, so single photons can be counted and timed. UV-boosted CCDs are used too.', 'hubble'],
    ['xray', 'X-ray: grazing mirrors and energy-measuring CCDs', 'An X-ray photon frees about one electron for every 3.65 eV of its energy, so the size of each charge packet tells the photon’s energy: a spectrum from a camera.', 'chandra'],
    ['gamma', 'Gamma rays: particle trackers', 'No mirror can focus gamma rays. Instead, each one turns into an electron and a positron in a stack of tungsten and silicon; their tracks point back to the source and a calorimeter measures their energy.', 'fermi'],
    ['gw', 'Gravitational waves: laser interferometers', 'Laser light bounces along two 4 km arms at right angles. A passing wave stretches one arm and squeezes the other by as little as 10⁻¹⁹ m, which shifts how the beams combine.', 'ligo'],
    ['insitu', 'On the spot: the lab goes there', 'Mass spectrometers weigh molecules, magnetometers measure fields, and lasers vaporise rock so its light can be split into a spectrum. Some questions need a sample.', 'curiosity'],
  ];
  const ICE = `<div class="bh-feat gx-card"><b><span class="ms-dot" style="background:${tok().muted}"></span>Neutrinos: a cubic kilometre of ice</b><span>Neutrinos barely interact, so the detector has to be enormous. IceCube, at the South Pole, has 5,160 light sensors frozen 1.5–2.5 km deep in the ice; they catch the faint blue flash when a rare neutrino hits an atom.</span><span class="ms-ex">Another messenger, not light</span></div>`;
  $('#msDet').innerHTML = DET.map(([k, t, d, ex]) => (k === 'insitu' ? ICE : '') + `<button type="button" class="bh-feat" data-k="${k}" data-ex="${ex}"><b><span class="ms-dot" style="background:${bandCss(k)}"></span>${esc(t)}</b><span>${esc(d)}</span><span class="ms-ex">Example: ${esc(byId[ex].name)} →</span></button>`).join('');
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
  // Photon landing pixels for the exposure animation: drawn in proportion to Q (bright spots get more), plus a few uniform background hits
  const PH_N = 14, PH_WAVES = 3;
  const PHOT = (() => {
    let seed = 7; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    const cells = []; Q.forEach((row, r) => row.forEach((q, c) => cells.push([r, c, Math.max(0, q - 0.06)])));   // star light only; background added separately
    const tot = cells.reduce((a, x) => a + x[2], 0);
    const pick = () => { let u = rnd() * tot; for (const x of cells) { u -= x[2]; if (u <= 0) return x; } return cells[cells.length - 1]; };
    return Array.from({ length: PH_WAVES }, () => Array.from({ length: PH_N }, (_, i) => {
      const [r, c] = i % 7 === 6 ? [Math.floor(rnd() * N), Math.floor(rnd() * N)] : pick();   // 2 of 14 are background
      return { r, c, jx: (rnd() - 0.5) * 16, jy: (rnd() - 0.5) * 12 };
    }));
  })();
  const C = { step: 0, t: 1, raf: 0, playing: false, last: 0, dyn: null };
  const CP = 34, CGX = 40, CGY = 20, CSY = CGY + N * CP + 14;     // pixel size, grid origin, readout-row top
  segBuild($('#msCCDStep'), STEPS.map(([s], i) => [String(i), (i + 1) + '. ' + s]), '0', (k) => { ccdStop(); C.step = +k; C.t = 1; ccdDraw(); });
  const qFill = (parent, x, y, q) => el('rect', { x: x + 4, y: y + CP - 3 - (CP - 8) * q, width: CP - 8, height: (CP - 8) * q, rx: 2, fill: '#5aa6ff', opacity: 0.9 }, parent);
  // Builds the static picture for the current step once; ccdUpdate() then moves only what animates.
  function ccdDraw() {
    const svg = $('#msCCD'); if (!svg || svg.closest('[hidden]')) return;
    svg.innerHTML = ''; const T = tok(), P = CP, gx = CGX, gy = CGY;
    segSync($('#msCCDStep'), String(C.step));
    $('#msCCDOut').textContent = STEPS[C.step][1];
    if (C.step === 3) {
      for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) { const v = Math.round(255 * Math.pow(Q[r][c], 0.7)); el('rect', { x: gx + c * P + 1, y: gy + r * P + 1, width: P - 2, height: P - 2, fill: `rgb(${v},${v},${v})` }, svg); }
    } else for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) el('rect', { x: gx + c * P + 1, y: gy + r * P + 1, width: P - 2, height: P - 2, rx: 3, fill: T.surface, stroke: T.line }, svg);
    el('rect', { x: gx - 4, y: CSY - 4, width: N * P + 8, height: P + 8, rx: 6, fill: 'none', stroke: T.faint, 'stroke-dasharray': '4 3' }, svg);
    txt(svg, gx - 6, CSY + P + 22, 'readout row', { 'font-size': 11, fill: T.muted });
    const ax = gx + N * P + 40, ay = CSY + P / 2;
    el('path', { d: `M${ax - 14},${ay - 14} L${ax + 12},${ay} L${ax - 14},${ay + 14} Z`, fill: T.surface, stroke: T.fg }, svg);
    txt(svg, ax - 2, ay + 32, 'amplifier', { 'text-anchor': 'middle', 'font-size': 11, fill: T.muted });
    if (C.step === 3) txt(svg, gx + N * P + 20, gy + 40, 'two stars', { 'font-size': 12, fill: T.muted });
    txt(svg, gx, gy - 6, C.step === 3 ? 'pixel values as brightness' : 'pixels (charge wells)', { 'font-size': 11, fill: T.muted });
    const D = C.dyn = { step: C.step };
    if (C.step === 0) {
      D.fills = Q.map((row, r) => row.map((q, c) => qFill(svg, gx + c * P, gy + r * P, 0)));
      D.ph = Array.from({ length: PH_N }, () => el('circle', { cx: gx, cy: gy, r: 2.5, fill: '#ffd166' }, svg));
    } else if (C.step === 1) {
      D.rows = Q.map((row, r) => { const g = el('g', {}, svg); row.forEach((q, c) => qFill(g, gx + c * P, gy + r * P, q)); return g; });
    } else if (C.step === 2) {
      for (let r = 0; r < N - 1; r++) for (let c = 0; c < N; c++) qFill(svg, gx + c * P, gy + (r + 1) * P, Q[r][c]);
      D.ser = Q[N - 1].map((q) => qFill(svg, gx, CSY, q));
      D.now = txt(svg, ax + 20, ay + 4, '', { 'font-size': 12, 'font-family': 'var(--font-mono)', fill: T.accent, 'font-weight': 600 });
      D.prev = [0, 1].map((i) => txt(svg, ax + 34, ay - 12 - i * 15, '', { 'font-size': 11, 'font-family': 'var(--font-mono)', fill: T.muted, opacity: 0.85 - i * 0.25 }));
      D.more = txt(svg, ax + 34, ay - 42, '', { 'font-size': 11, fill: T.faint });
    }
    ccdUpdate();
  }
  function ccdUpdate() {
    const D = C.dyn, t = C.t, P = CP; if (!D || D.step !== C.step) return;
    const show = (e, on) => e.setAttribute('display', on ? 'inline' : 'none');
    if (C.step === 0) {
      D.fills.forEach((row, r) => row.forEach((e, c) => { const h = (P - 8) * Q[r][c] * t; e.setAttribute('height', h); e.setAttribute('y', CGY + r * P + P - 3 - h); }));
      D.ph.forEach((e, i) => {
        const u = t * PH_WAVES + i / PH_N, w = Math.min(PH_WAVES - 1, Math.floor(u)), f = u - Math.floor(u), ph = PHOT[w][i];
        const ty = CGY + ph.r * P + P / 2 + ph.jy;   // falls from above the chip onto its pixel
        show(e, t < 1 && u < PH_WAVES);
        e.setAttribute('cx', CGX + ph.c * P + P / 2 + ph.jx); e.setAttribute('cy', CGY - 14 + (ty - CGY + 14) * f);
      });
    } else if (C.step === 1) {
      const dy = t * P; D.rows.forEach((g, r) => g.setAttribute('transform', `translate(0,${r === N - 1 ? dy * (14 + P) / P : dy})`));
    } else if (C.step === 2) {
      const row = Q[N - 1], k = Math.min(N, Math.floor(t * (N + 0.999)));
      D.ser.forEach((e, c) => { show(e, c + k < N); e.setAttribute('x', CGX + (c + k) * P + 4); });   // shifted right by k
      const vals = []; for (let c = N - 1; c >= N - k; c--) vals.push(Math.round(row[c] * 4000));
      // newest value beside the amplifier, the two before it stacked above (keeps everything inside the 440-wide view)
      D.now.textContent = '→ ' + (vals.length ? vals[vals.length - 1] : '');
      const prev = vals.slice(-3, -1).reverse(); D.prev.forEach((e, i) => { e.textContent = prev[i] != null ? String(prev[i]) : ''; });
      D.more.textContent = vals.length > 3 ? '…' : '';
    }
  }
  function ccdStop(paused) { C.playing = false; cancelAnimationFrame(C.raf); const b = $('#msCCDPlay'); if (b) b.textContent = paused && C.t < 1 ? 'Resume' : 'Play'; }
  function ccdLoop(ts) {
    if (!C.playing) return;
    const dt = Math.min(0.1, (ts - (C.last || ts)) / 1000); C.last = ts;
    C.t += dt / [2.4, 1.2, 3, 1.5][C.step];
    if (C.t >= 1) {
      if (C.step < 3) { C.step++; C.t = 0; ccdDraw(); }
      else { C.t = 1; ccdUpdate(); ccdStop(); return; }
    } else ccdUpdate();
    C.raf = requestAnimationFrame(ccdLoop);
  }
  $('#msCCDPlay').addEventListener('click', () => {
    if (C.playing) { ccdStop(true); return; }
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) { C.step = (C.step + 1) % 4; C.t = 1; ccdDraw(); return; }
    if (C.t >= 1) { if (C.step === 3) C.step = 0; C.t = 0; ccdDraw(); }   // a finished step replays; a paused one resumes where it stopped
    C.playing = true; C.last = 0; $('#msCCDPlay').textContent = 'Pause';
    C.raf = requestAnimationFrame(ccdLoop);
  });

  /* ---------- Wide figures on phones: fade only the side that has more to scroll, plus a hint ---------- */
  function wideFade(box) {
    const max = box.scrollWidth - box.clientWidth;
    box.classList.toggle('fade-r', max > 2 && box.scrollLeft < max - 2);
    box.classList.toggle('fade-l', max > 2 && box.scrollLeft > 2);
  }
  $$('.ms-wide').forEach((box) => {
    const hint = document.createElement('p'); hint.className = 'note ms-swipe'; hint.setAttribute('aria-hidden', 'true'); hint.textContent = 'swipe to see more →';
    box.after(hint);
    box.addEventListener('scroll', () => wideFade(box), { passive: true });
  });
  const fadeAll = () => $$('.ms-wide').forEach(wideFade);
  addEventListener('resize', fadeAll);
  tabs.forEach((t) => t.addEventListener('click', () => requestAnimationFrame(fadeAll)));

  /* ---------- Boot ---------- */
  function redraw() { const id = (tabs.find((t) => t.getAttribute('aria-selected') === 'true') || tabs[0]).getAttribute('aria-controls'); showTab(id); if (id === 'fleet') grid(); }
  let rT = 0, lastW = innerWidth;
  addEventListener('resize', () => { if (innerWidth === lastW) return; lastW = innerWidth; clearTimeout(rT); rT = setTimeout(() => { if (!$('#compare').hidden) timeline(); if (!$('#fleet').hidden) placeDetail(); }, 150); });
  matchMedia('(prefers-color-scheme: light)').addEventListener('change', () => { redraw(); });
  grid();
  const hashTab = location.hash.slice(1), saved = store.get('tab');
  const start = tabs.some((t) => t.getAttribute('aria-controls') === hashTab) ? hashTab : tabs.some((t) => t.getAttribute('aria-controls') === saved) ? saved : 'fleet';
  showTab(start);
  requestAnimationFrame(fadeAll);
})();
