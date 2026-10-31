/* Stellar Life — Earth, part A: the interior and seismic rays, plate boundaries and seafloor stripes, volcanoes */
(function () {
  'use strict';
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const store = { get(k) { try { return localStorage.getItem('earth-a-' + k); } catch (e) { return null; } }, set(k, v) { try { localStorage.setItem('earth-a-' + k, v); } catch (e) { /* unavailable */ } } };
  const facts = (box, rows) => { box.innerHTML = rows.map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join(''); };
  const tok = () => { const c = getComputedStyle(document.documentElement), g = (n) => c.getPropertyValue(n).trim(); return { fg: g('--fg'), muted: g('--muted'), faint: g('--faint'), line: g('--line'), accent: g('--accent'), surface: g('--surface'), surface2: g('--surface-2'), bg: g('--bg'), p: g('--ea-p'), s: g('--ea-s'), rho: g('--ea-rho'), good: g('--good') }; };
  let T = tok();
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const lerp = (a, b, u) => a + (b - a) * u;
  const n0 = (x) => Math.round(x).toLocaleString('en-US');
  const fx = (x, d) => x.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
  const halo = (w) => ` stroke="${T.bg}" stroke-width="${w || 5}" stroke-linejoin="round" paint-order="stroke"`;
  function tx(x, y, s, o) {
    o = o || {};
    return `<text x="${fx(x, 1)}" y="${fx(y, 1)}" font-size="${o.fs || 20}" fill="${o.fill || T.fg}"${o.anchor ? ` text-anchor="${o.anchor}"` : ''}${o.weight ? ` font-weight="${o.weight}"` : ''}${o.halo === false ? '' : halo(o.hw)}>${s}</text>`;
  }
  function seg(box, items, cur, onPick) {
    box.innerHTML = items.map(([k, label]) => `<button type="button" data-k="${k}" aria-pressed="${k === cur}">${label}</button>`).join('');
    box.addEventListener('click', (e) => { const b = e.target.closest('button'); if (!b) return; press(box, b.dataset.k); onPick(b.dataset.k); });
  }
  const press = (box, k) => $$('button', box).forEach((x) => x.setAttribute('aria-pressed', String(x.dataset.k === k)));
  function svgPt(svg, e) { const r = svg.getBoundingClientRect(), vb = svg.viewBox.baseVal; return [(e.clientX - r.left) / r.width * vb.width, (e.clientY - r.top) / r.height * vb.height]; }
  function arrow(x1, y1, x2, y2, col, w) {
    const a = Math.atan2(y2 - y1, x2 - x1), h = 12, c = Math.cos(a), s = Math.sin(a);
    const bx = x2 - h * c, by = y2 - h * s;
    return `<line x1="${fx(x1, 1)}" y1="${fx(y1, 1)}" x2="${fx(bx, 1)}" y2="${fx(by, 1)}" stroke="${col}" stroke-width="${w || 4}" stroke-linecap="round"/><polygon points="${fx(x2, 1)},${fx(y2, 1)} ${fx(bx - 7 * s, 1)},${fx(by + 7 * c, 1)} ${fx(bx + 7 * s, 1)},${fx(by - 7 * c, 1)}" fill="${col}"/>`;
  }
  const poly = (pts) => pts.map((p) => fx(p[0], 1) + ',' + fx(p[1], 1)).join(' ');

  /* ---------- animation loops: run only while their tab is shown, on screen and playing ---------- */
  let curTab = null;
  const loops = [];
  function makeLoop(tab, target, step) {
    const L = { play: !reduce, vis: false, raf: 0, last: 0 };
    function tick(now) { const dt = Math.min(0.05, (now - L.last) / 1000); L.last = now; step(dt); L.raf = requestAnimationFrame(tick); }
    L.sync = () => {
      const want = L.play && L.vis && curTab === tab;
      if (want && !L.raf) { L.last = performance.now(); L.raf = requestAnimationFrame(tick); } else if (!want && L.raf) { cancelAnimationFrame(L.raf); L.raf = 0; }
    };
    new IntersectionObserver((es) => { L.vis = es[es.length - 1].isIntersecting; L.sync(); }).observe(target);
    loops.push(L);
    return L;
  }
  const drawn = {}, redraw = {};
  document.addEventListener('earth:tab', (e) => {
    curTab = e.detail.id;
    if (curTab === 'inside' && !drawn.inside) { drawn.inside = true; initInside(); }
    if (curTab === 'plates' && !drawn.plates) { drawn.plates = true; initPlates(); }
    if (curTab === 'volcano' && !drawn.volcano) { drawn.volcano = true; initVolcano(); }
    loops.forEach((L) => L.sync());
  });
  document.addEventListener('earth:theme', () => { T = tok(); Object.keys(redraw).forEach((k) => redraw[k]()); });

  /* =====================================================================
     INSIDE EARTH
     PREM (Dziewonski & Anderson 1981), isotropic, radius r in km; the 3 km
     ocean layer is replaced by upper crust so rays start in rock.
     Returns [density g/cm³, Vp km/s, Vs km/s].
     ===================================================================== */
  const RE = 6371;
  function prem(r) {
    const x = r / RE, x2 = x * x, x3 = x2 * x;
    if (r <= 1221.5) return [13.0885 - 8.8381 * x2, 11.2622 - 6.3640 * x2, 3.6678 - 4.4475 * x2];
    if (r <= 3480) return [12.5815 - 1.2638 * x - 3.6426 * x2 - 5.5281 * x3, 11.0487 - 4.0362 * x + 4.8023 * x2 - 13.5732 * x3, 0];
    const rlm = 7.9565 - 6.4761 * x + 5.5283 * x2 - 3.0807 * x3;
    if (r <= 3630) return [rlm, 15.3891 - 5.3181 * x + 5.5242 * x2 - 2.5514 * x3, 6.9254 + 1.4672 * x - 2.0834 * x2 + 0.9783 * x3];
    if (r <= 5600) return [rlm, 24.9520 - 40.4673 * x + 51.4832 * x2 - 26.6419 * x3, 11.1671 - 13.7818 * x + 17.4575 * x2 - 9.2777 * x3];
    if (r <= 5701) return [rlm, 29.2766 - 23.6027 * x + 5.5242 * x2 - 2.5514 * x3, 22.3459 - 17.2473 * x - 2.0834 * x2 + 0.9783 * x3];
    if (r <= 5771) return [5.3197 - 1.4836 * x, 19.0957 - 9.8672 * x, 9.9839 - 4.9324 * x];
    if (r <= 5971) return [11.2494 - 8.0298 * x, 39.7027 - 32.6166 * x, 22.3512 - 18.5856 * x];
    if (r <= 6151) return [7.1089 - 3.8045 * x, 20.3926 - 12.2569 * x, 8.9496 - 4.4597 * x];
    if (r <= 6346.6) return [2.6910 + 0.6924 * x, 4.1875 + 3.9382 * x, 2.1519 + 2.3481 * x];
    if (r <= 6356) return [2.9, 6.8, 3.9];
    return [2.6, 5.8, 3.2];
  }
  // enclosed mass, gravity and pressure on a 1 km grid (index = radius in km)
  let PG = null;
  function pg() {
    if (PG) return PG;
    const N = RE, M = new Float64Array(N + 1), g = new Float64Array(N + 1), P = new Float64Array(N + 1), G = 6.674e-11;
    for (let i = 1; i <= N; i++) { const r = (i - 0.5) * 1e3; M[i] = M[i - 1] + 4 * Math.PI * r * r * prem(i - 0.5)[0] * 1000 * 1e3; g[i] = G * M[i] / Math.pow(i * 1e3, 2); }
    for (let i = N - 1; i >= 0; i--) P[i] = P[i + 1] + prem(i + 0.5)[0] * 1000 * (g[i] + g[i + 1]) / 2 * 1e3;
    PG = { M, g, P };
    return PG;
  }
  const pAt = (r) => pg().P[clamp(Math.round(r), 0, RE)] / 1e9;

  const LAY = [
    { k: 'crust', name: 'Crust', r0: 6336, r1: 6371, col: '#a3825a', depth: '0 to ~7 km (oceans), ~35 km (continents, up to ~70)', state: 'Solid rock', rho: '2.7 – 3.0', T: '~290 K at the surface; ~700 – 1,100 K at its base', comp: 'Continents: granite-like rock rich in silicon, aluminium and potassium. Ocean floor: basalt and gabbro', v: 'P 5.8 – 6.8, S 3.2 – 3.9', blurb: 'A thin skin of light rock. If Earth were an apple, the crust would be thinner than its peel. The deepest hole ever drilled, Kola in Russia, reached 12.3 km.' },
    { k: 'upper', name: 'Upper mantle', r0: 5961, r1: 6336, col: '#b9643c', depth: 'base of crust to 410 km', state: 'Solid, but creeps slowly. Its cold top is welded to the crust as the rigid plates', rho: '3.4 – 3.5', T: '~1,600 K under the plates; ~1,800 K at 410 km', comp: 'Peridotite: mostly olivine, plus pyroxene and garnet', v: 'P 8.0 – 8.9, S 4.4 – 4.8', blurb: 'Below the plates is the asthenosphere, a layer that is hot enough to be soft. It is still solid: S waves cross it, just a little slower.' },
    { k: 'tz', name: 'Transition zone', r0: 5711, r1: 5961, col: '#a5502e', depth: '410 – 660 km', state: 'Solid', rho: '3.7 – 4.0', T: '~1,800 – 2,000 K', comp: 'The same rock, squeezed: olivine repacks into denser wadsleyite, then ringwoodite, which can hold water in its crystals', v: 'P 9.1 – 10.3, S 4.9 – 5.6', blurb: 'Wave speeds jump at 410 and 660 km. The chemistry barely changes; the atoms rearrange into tighter crystals as pressure rises.' },
    { k: 'lower', name: 'Lower mantle', r0: 3480, r1: 5711, col: '#8a3d22', depth: '660 – 2,891 km', state: 'Solid; flows very slowly (cm per year)', rho: '4.4 – 5.6', T: '~2,000 K at the top; ~4,000 K at the base', comp: 'Bridgmanite (the most common mineral in Earth) with ferropericlase', v: 'P 10.8 – 13.7, S 5.9 – 7.3', blurb: 'The biggest layer by volume. Slabs of old ocean floor sink through it, and hot material rises from its base.' },
    { k: 'outer', name: 'Outer core', r0: 1221.5, r1: 3480, col: '#e38d30', depth: '2,891 – 5,150 km', state: 'Liquid', rho: '9.9 – 12.2', T: '~4,000 K at the top; ~5,000 – 6,000 K at the bottom', comp: 'Molten iron and nickel, with ~10% lighter elements (oxygen, silicon, sulfur, others)', v: 'P 8.1 – 10.4; S waves cannot cross a liquid', blurb: 'Churning liquid iron is an electrical conductor, and its motion generates Earth\'s magnetic field.' },
    { k: 'inner', name: 'Inner core', r0: 0, r1: 1221.5, col: '#f2c350', depth: '5,150 – 6,371 km', state: 'Solid', rho: '12.8 – 13.1', T: '~5,000 – 6,000 K, similar to the Sun\'s surface', comp: 'Iron–nickel alloy with a few percent lighter elements', v: 'P 11.0 – 11.3, S 3.5 – 3.7', blurb: 'A solid ball 2,443 km across, about 70% the width of the Moon. It slowly grows as the liquid around it freezes on.' }
  ];
  const LBY = Object.fromEntries(LAY.map((l) => [l.k, l]));
  const IN = { layer: store.get('layer') || 'outer', quake: 'tohoku', wave: 'both', tk: 22, fan: true, play: false, t: 0, hover: 2900 };
  if (!LBY[IN.layer]) IN.layer = 'outer';

  function annulus(cx, cy, r0, r1) {
    const c = (r) => `M${fx(cx - r, 2)},${cy} A${r},${r} 0 1,0 ${fx(cx + r, 2)},${cy} A${r},${r} 0 1,0 ${fx(cx - r, 2)},${cy} Z`;
    return r0 > 0 ? c(r1) + ' ' + c(r0) : c(r1);
  }

  function drawCut() {
    const svg = $('#eaCut'), cx = 230, cy = 240, R = 225, s = R / RE;
    let h = '';
    LAY.forEach((l) => {
      const on = l.k === IN.layer;
      h += `<path class="ea-hit" data-k="${l.k}" d="${annulus(cx, cy, l.r0 * s, l.r1 * s)}" fill="${l.col}" fill-rule="evenodd" stroke="${on ? T.fg : 'none'}" stroke-width="${on ? 3 : 0}" aria-hidden="true"/>`;
    });
    h += `<circle cx="${cx}" cy="${cy}" r="${R}" fill="none" stroke="${T.line}" stroke-width="1"/>`;
    // labels with leader lines: [layer, angle on the ring (deg, from +x, counter-clockwise), label y]
    const L = [['crust', 62, 6360, 42], ['upper', 44, 6150, 98], ['tz', 27, 5836, 152], ['lower', 0, 4600, 240], ['outer', -26, 2350, 330], ['inner', -62, 650, 420]];
    L.forEach(([k, a, rr, ly]) => {
      const l = LBY[k], on = k === IN.layer, ar = a * Math.PI / 180, px = cx + rr * s * Math.cos(ar), py = cy - rr * s * Math.sin(ar);
      h += `<g class="ea-hit" data-k="${k}"><polyline points="${fx(px, 1)},${fx(py, 1)} 466,${ly - 6} 474,${ly - 6}" fill="none" stroke="${on ? T.accent : T.muted}" stroke-width="${on ? 2.2 : 1.3}"/><circle cx="${fx(px, 1)}" cy="${fx(py, 1)}" r="3.5" fill="${on ? T.accent : T.fg}"/>`;
      h += tx(478, ly, l.name, { fs: 21, fill: on ? T.accent : T.fg, weight: on ? 700 : 500 }) + '</g>';
    });
    h += tx(8, 472, 'True scale', { fs: 18, fill: T.muted });
    svg.innerHTML = h;
  }
  function drawZoom() {
    const svg = $('#eaZoom'), y0 = 46, k = 1.2, y = (d) => y0 + d * k, on = IN.layer;
    const cr = LBY.crust.col, um = LBY.upper.col;
    let h = `<rect x="0" y="${y(0)}" width="640" height="${230 - y0}" fill="${um}" class="ea-hit" data-k="upper" stroke="${on === 'upper' ? T.fg : 'none'}" stroke-width="3"/>`;
    // ocean (left), margin, continent with mountain root (right)
    h += `<rect x="0" y="${y(0)}" width="300" height="${4 * k}" fill="#3a7fc0"/>`;
    const oc = [[0, y(4)], [300, y(4)], [380, y(0)], [640, y(0)], [640, y(35)], [600, y(40)], [570, y(66)], [530, y(70)], [495, y(45)], [470, y(35)], [380, y(33)], [300, y(11)], [0, y(11)]];
    h += `<polygon class="ea-hit" data-k="crust" points="${poly(oc)}" fill="${cr}" stroke="${on === 'crust' ? T.fg : 'none'}" stroke-width="3"/>`;
    h += `<polyline points="${poly([[495, y(0)], [520, y(0) - 6], [540, y(0) - 4], [560, y(0)]])}" fill="${cr}" stroke="none"/>`;
    h += `<line x1="0" y1="${y(100)}" x2="300" y2="${y(100)}" stroke="${T.fg}" stroke-dasharray="7 6" stroke-width="1.6"/><line x1="300" y1="${y(100)}" x2="640" y2="${y(150)}" stroke="${T.fg}" stroke-dasharray="7 6" stroke-width="1.6"/>`;
    h += tx(150, 36, 'Ocean ~4 km deep', { fs: 18, anchor: 'middle' });
    h += tx(500, 36, 'Mountains', { fs: 18, anchor: 'middle' });
    h += tx(150, y(11) + 22, 'Oceanic crust ~7 km', { fs: 19, anchor: 'middle' });
    h += tx(420, y(20), 'Continental crust ~35 km', { fs: 19, anchor: 'middle' });
    h += tx(548, y(70) + 22, 'Root ~70 km', { fs: 19, anchor: 'middle' });
    h += tx(150, y(70), 'Upper mantle', { fs: 19, anchor: 'middle' });
    h += tx(20, y(100) - 8, 'Base of the plates ~100 km', { fs: 18 });
    h += tx(636, y(150) - 8, 'deeper under old continents', { fs: 18, anchor: 'end' });
    h += tx(4, 18, 'Zoom: top 150 km (depth to scale, width not)', { fs: 18, fill: T.muted });
    svg.innerHTML = h;
  }
  function showLayer() {
    const l = LBY[IN.layer], G = pg(), share = (Math.pow(l.r1, 3) - Math.pow(l.r0, 3)) / Math.pow(RE, 3) * 100;
    const mass = (G.M[Math.round(l.r1)] - G.M[Math.round(l.r0)]) / G.M[RE] * 100;
    $('#eaLayerHead').innerHTML = `<p class="h">Layer</p><p class="nm">${l.name}</p><p>${l.blurb}</p>`;
    facts($('#eaLayerFacts'), [
      ['Depth', l.depth], ['State', l.state], ['Density (PREM)', l.rho + ' g/cm³'],
      ['Pressure', l.k === 'crust' ? 'up to ~1 GPa' : fx(pAt(l.r1), 0) + ' – ' + fx(pAt(l.r0), 0) + ' GPa'],
      ['Temperature (estimate)', l.T], ['Wave speeds', l.v + ' km/s'], ['Made of', l.comp],
      ['Share of Earth', `${share < 1.5 ? fx(share, 1) : n0(share)}% of volume, ${mass < 1.5 ? fx(mass, 1) : n0(mass)}% of mass`]
    ]);
    press($('#eaLayers'), IN.layer);
  }
  function pickLayer(k) { if (!LBY[k]) return; IN.layer = k; store.set('layer', k); drawCut(); drawZoom(); showLayer(); }

  /* ---------- PREM profile chart ---------- */
  function drawProf() {
    const svg = $('#eaProf'), X0 = 62, X1 = 626, Y0 = 18, Y1 = 250, xd = (d) => X0 + d / RE * (X1 - X0), yv = (v) => Y1 - v / 14 * (Y1 - Y0);
    let h = '';
    LAY.forEach((l, i) => { h += `<rect x="${fx(xd(RE - l.r1), 1)}" y="${Y0}" width="${fx(xd(RE - l.r0) - xd(RE - l.r1), 1)}" height="${Y1 - Y0}" fill="${l.col}" opacity="${i % 2 ? 0.16 : 0.1}"/>`; });
    for (let v = 0; v <= 14; v += 2) { h += `<line x1="${X0}" x2="${X1}" y1="${yv(v)}" y2="${yv(v)}" stroke="${T.line}" stroke-width="${v % 4 ? 0.6 : 1}"/>`; if (v % 4 === 0) h += tx(X0 - 8, yv(v) + 7, v, { fs: 18, anchor: 'end', fill: T.muted, halo: false }); }
    [0, 2000, 4000, 6000].forEach((d) => { h += tx(xd(d), Y1 + 24, n0(d), { fs: 18, anchor: d ? 'middle' : 'start', fill: T.muted, halo: false }); });
    h += tx(X1, Y1 + 46, 'Depth (km)', { fs: 18, anchor: 'end', fill: T.muted, halo: false });
    h += tx(X0, Y1 + 46, 'km/s  ·  g/cm³', { fs: 18, fill: T.muted, halo: false });
    // lines, sampled finely and on both sides of each discontinuity
    const B = [1221.5, 3480, 3630, 5600, 5701, 5771, 5971, 6151, 6346.6, 6356], rs = [];
    for (let r = 0; r <= RE; r += 10) rs.push(r);
    B.forEach((b) => { rs.push(b - 0.01, b + 0.01); });
    rs.sort((a, b) => b - a);
    const line = (j, col, w) => `<polyline points="${rs.map((r) => fx(xd(RE - r), 1) + ',' + fx(yv(prem(r)[j]), 1)).join(' ')}" fill="none" stroke="${col}" stroke-width="${w}" stroke-linejoin="round"/>`;
    h += line(0, T.rho, 2.6) + line(2, T.s, 2.6) + line(1, T.p, 2.6);
    h += tx(xd(4300), yv(prem(2071)[1]) - 10, 'P waves', { fs: 19, fill: T.p, weight: 600 });
    h += tx(xd(4300), yv(0) - 8, 'S waves: zero in the liquid', { fs: 19, fill: T.s, weight: 600, anchor: 'middle' });
    h += tx(xd(1500), yv(prem(4871)[0]) + 26, 'Density', { fs: 19, fill: T.rho, weight: 600 });
    h += `<g id="eaProfX"></g>`;
    svg.innerHTML = h;
    profHover(IN.hover);
  }
  function profHover(d) {
    IN.hover = d = clamp(d, 0, RE);
    const X0 = 62, X1 = 626, Y0 = 18, Y1 = 250, x = X0 + d / RE * (X1 - X0), r = RE - d, m = prem(Math.max(0, r - 0.001)), G = pg();
    const yv = (v) => Y1 - v / 14 * (Y1 - Y0);
    let h = `<line x1="${fx(x, 1)}" x2="${fx(x, 1)}" y1="${Y0}" y2="${Y1}" stroke="${T.fg}" stroke-width="1.4" stroke-dasharray="4 4"/>`;
    [[0, T.rho], [1, T.p], [2, T.s]].forEach(([j, c]) => { h += `<circle cx="${fx(x, 1)}" cy="${fx(yv(m[j]), 1)}" r="5" fill="${c}" stroke="${T.bg}" stroke-width="2"/>`; });
    $('#eaProfX').innerHTML = h;
    const layer = LAY.find((l) => r >= l.r0 && r <= l.r1) || LAY[0];
    facts($('#eaProfOut'), [['Depth', n0(d) + ' km'], ['Layer', layer.name], ['Density', fx(m[0], 2) + ' g/cm³'], ['P-wave speed', fx(m[1], 2) + ' km/s'], ['S-wave speed', m[2] ? fx(m[2], 2) + ' km/s' : 'none (liquid)'], ['Pressure', n0(G.P[Math.round(r)] / 1e9) + ' GPa'], ['Gravity', fx(G.g[Math.round(r)], 2) + ' m/s²'], ['Temperature', tempAt(d)]]);
  }
  function tempAt(d) { // rough geotherm estimate, K (see sources)
    const P = [[0, 290], [35, 800], [100, 1600], [410, 1800], [660, 2000], [2700, 2500], [2891, 4000], [5150, 5500], [6371, 5700]];
    for (let i = 1; i < P.length; i++) if (d <= P[i][0]) { const u = (d - P[i - 1][0]) / (P[i][0] - P[i - 1][0]); return '~' + n0(Math.round(lerp(P[i - 1][1], P[i][1], u) / 100) * 100) + ' K'; }
    return '—';
  }

  /* ---------- Seismic rays through PREM ----------
     Ray parameter p = r sin(i) / v is constant along a ray (Snell's law for
     spherical shells). Integrate dθ/dr = p / (r √(η² − p²)) and
     dt/dr = η² / (r √(η² − p²)), η = r / v, in 2 km shells from the surface down
     to the turning point; reflect where η falls below p (incl. the inner-core
     boundary). Δ and t for a deep source subtract the part above the source. */
  const QUAKES = { nepal: { label: 'Nepal 2015', d: 8.2, m: 'M7.8', note: '8 km deep' }, tohoku: { label: 'Tōhoku, Japan 2011', d: 29, m: 'M9.1', note: '29 km deep' }, bolivia: { label: 'Bolivia 1994', d: 631, m: 'M8.2', note: '631 km deep' } };
  const vel = (r, w) => prem(r)[w === 'S' ? 2 : 1];
  function trace(p, w, rs) {
    const dr = 2, pts = [[RE, 0, 0]];
    let r = RE, th = 0, t = 0, e0 = RE / vel(RE, w), ths = 0, ts = 0, gotS = rs >= RE, n = 0, stop = false, rt = 0;
    for (;;) {
      if (r < 150) { // near the centre the inner core is nearly uniform: finish with a straight segment
        const v = vel(0, w); rt = Math.min(r, p * v); th += Math.acos(clamp(rt / r, 0, 1)); t += Math.sqrt(Math.max(0, r * r - rt * rt)) / v; break;
      }
      const r1 = r - dr, v1 = vel(r1, w);
      if (v1 === 0) { stop = true; rt = r; break; }
      const e1 = r1 / v1;
      if (e1 <= p) { // turns (or reflects) inside this shell
        rt = e0 > e1 ? r - dr * clamp((e0 - p) / (e0 - e1), 0, 1) : r;
        const q = Math.sqrt(Math.max(e0 * e0 - p * p, 1e-9)), L = r - rt;
        if (!gotS && rs > rt) { ths = th + p * (r - rs) / (r * q); ts = t + e0 * e0 * (r - rs) / (r * q); gotS = true; }
        th += p * 2 * L / (r * q); t += (p * p / Math.max(rt, 1)) * 2 * L / q;
        break;
      }
      const e = (e0 + e1) / 2, q = Math.sqrt(e * e - p * p), rm = r - dr / 2, dth = p * dr / (rm * q), dt = e * e * dr / (rm * q);
      if (!gotS && r1 <= rs) { const u = (r - rs) / dr; ths = th + u * dth; ts = t + u * dt; gotS = true; }
      th += dth; t += dt; r = r1; e0 = e1;
      if (++n % 5 === 0) pts.push([r, th, t]);
    }
    if (!gotS) { ths = th; ts = t; }
    pts.push([rt, th, t]);
    const path = [];
    pts.forEach(([pr, pth, pt]) => { if (pr <= rs + 1e-6) path.push([pr, pth - ths, pt - ts]); });
    if (!path.length || path[0][0] < rs - 1e-6) path.unshift([rs, 0, 0]);
    let D = null, TT = null;
    if (!stop) {
      for (let i = pts.length - 2; i >= 0; i--) path.push([pts[i][0], 2 * th - pts[i][1] - ths, 2 * t - pts[i][2] - ts]);
      D = (2 * th - ths) * 180 / Math.PI; TT = 2 * t - ts;
    }
    let ph;
    if (w === 'S') ph = stop ? 'Sstop' : 'S';
    else ph = rt >= 3479 ? 'P' : rt > 1223.5 ? 'PKP' : rt >= 1219.5 ? 'PKiKP' : 'PKIKP';
    return { p, w, path, D, T: TT, rt, ph, stop, cmb: stop ? (th - ths) * 180 / Math.PI : null };
  }
  const fanCache = {};
  function fan(qk) {
    if (fanCache[qk]) return fanCache[qk];
    const rs = RE - QUAKES[qk].d, out = { P: [], S: [] };
    ['P', 'S'].forEach((w) => {
      const v = vel(rs, w);
      for (let a = 0; a <= 90.01; a += 2.5) out[w].push(trace(rs * Math.sin(a * Math.PI / 180) / v, w, rs));
    });
    // shadow-zone edges from a dense sweep
    let maxP = 0, minK = 180, maxS = 0;
    const vp = vel(rs, 'P'), vs = vel(rs, 'S');
    for (let k = 0; k <= 400; k++) {
      const a = k / 400 * 90, rp = trace(rs * Math.sin(a * Math.PI / 180) / vp, 'P', rs);
      if (rp.ph === 'P') maxP = Math.max(maxP, rp.D); else if (rp.ph === 'PKP') minK = Math.min(minK, rp.D);
      if (k % 2 === 0) { const r2 = trace(rs * Math.sin(a * Math.PI / 180) / vs, 'S', rs); if (!r2.stop) maxS = Math.max(maxS, r2.D); }
    }
    out.maxP = maxP; out.minK = minK; out.maxS = maxS;
    return (fanCache[qk] = out);
  }
  const RC = { cx: 320, cy: 322, R: 268 };
  function rxy(r, th) { const s = RC.R / RE; return [RC.cx + s * r * Math.sin(th), RC.cy - s * r * Math.cos(th)]; }
  function rayD(path, sgn) { return 'M' + path.map(([r, th]) => { const [x, y] = rxy(r, sgn * th); return fx(x, 1) + ',' + fx(y, 1); }).join('L'); }
  function arcD(r, a0, a1, sgn) { // degrees from the top, clockwise for sgn = 1
    const n = 40, pts = [];
    for (let i = 0; i <= n; i++) { const a = (a0 + (a1 - a0) * i / n) * Math.PI / 180; pts.push(RC.cx + sgn * r * Math.sin(a), RC.cy - r * Math.cos(a)); }
    let d = ''; for (let i = 0; i < pts.length; i += 2) d += (i ? 'L' : 'M') + fx(pts[i], 1) + ',' + fx(pts[i + 1], 1); return d;
  }
  const PHN = { P: 'P: mantle only', PKP: 'PKP: bent through the liquid outer core', PKiKP: 'PKiKP: bounced off the inner core', PKIKP: 'PKIKP: straight through the inner core', S: 'S: mantle only', Sstop: 'S: stopped by the liquid core' };
  const mmss = (s) => `${Math.floor(s / 60)} min ${String(Math.round(s % 60)).padStart(2, '0')} s`;
  function drawRays() {
    const svg = $('#eaRay'), F = fan(IN.quake), s = RC.R / RE;
    let h = '';
    LAY.forEach((l) => { h += `<path d="${annulus(RC.cx, RC.cy, l.r0 * s, l.r1 * s)}" fill="${l.col}" fill-rule="evenodd" opacity="0.32"/>`; });
    h += `<circle cx="${RC.cx}" cy="${RC.cy}" r="${RC.R}" fill="none" stroke="${T.muted}" stroke-width="1.4"/>`;
    [1221.5, 3480].forEach((r) => { h += `<circle cx="${RC.cx}" cy="${RC.cy}" r="${fx(r * s, 1)}" fill="none" stroke="${T.muted}" stroke-width="1"/>`; });
    const waves = IN.wave === 'both' ? ['S', 'P'] : [IN.wave];
    // shadow zones
    const sh = (a0, a1, col, r) => [1, -1].map((g) => `<path d="${arcD(r, a0, a1, g)}" fill="none" stroke="${col}" stroke-width="7" stroke-linecap="butt" opacity="0.85"/>`).join('');
    if (waves.includes('S')) h += sh(F.maxS, 180, T.s, RC.R + 10);
    if (waves.includes('P')) h += sh(F.maxP, F.minK, T.p, RC.R + (waves.length > 1 ? 19 : 10));
    // degree ticks
    for (let a = 0; a <= 180; a += 30) {
      [1, -1].forEach((g) => { if (a === 0 && g < 0) return; if (a === 180 && g < 0) return; const ar = a * Math.PI / 180, x1 = RC.cx + g * RC.R * Math.sin(ar), y1 = RC.cy - RC.R * Math.cos(ar), x2 = RC.cx + g * (RC.R - 9) * Math.sin(ar), y2 = RC.cy - (RC.R - 9) * Math.cos(ar); h += `<line x1="${fx(x1, 1)}" y1="${fx(y1, 1)}" x2="${fx(x2, 1)}" y2="${fx(y2, 1)}" stroke="${T.fg}" stroke-width="1.4"/>`; });
      if (a > 0 && a < 180) { const ar = a * Math.PI / 180, lr = RC.R - 26; h += tx(RC.cx + lr * Math.sin(ar), RC.cy - lr * Math.cos(ar) + 7, a + '°', { fs: 18, anchor: 'middle', fill: T.muted }); }
    }
    // rays
    if (IN.fan) waves.forEach((w) => F[w].forEach((ry) => { const col = w === 'S' ? T.s : T.p; [1, -1].forEach((g) => { h += `<path d="${rayD(ry.path, g)}" fill="none" stroke="${col}" stroke-width="1.2" opacity="0.55"/>`; }); if (ry.stop) { const [x, y] = rxy(3480, ry.cmb * Math.PI / 180); const [x2, y2] = rxy(3480, -ry.cmb * Math.PI / 180); h += `<circle cx="${fx(x, 1)}" cy="${fx(y, 1)}" r="2.2" fill="${col}"/><circle cx="${fx(x2, 1)}" cy="${fx(y2, 1)}" r="2.2" fill="${col}"/>`; } }));
    const rs = RE - QUAKES[IN.quake].d, sel = waves.map((w) => trace(rs * Math.sin(IN.tk * Math.PI / 180) / vel(rs, w), w, rs));
    sel.forEach((ry) => {
      const col = ry.w === 'S' ? T.s : T.p;
      h += `<path d="${rayD(ry.path, 1)}" fill="none" stroke="${T.bg}" stroke-width="7" opacity="0.8"/><path d="${rayD(ry.path, 1)}" fill="none" stroke="${col}" stroke-width="3.6"/>`;
      if (ry.stop) { const [x, y] = rxy(3480, ry.cmb * Math.PI / 180); h += `<path d="M${fx(x - 7, 1)},${fx(y - 7, 1)}L${fx(x + 7, 1)},${fx(y + 7, 1)}M${fx(x + 7, 1)},${fx(y - 7, 1)}L${fx(x - 7, 1)},${fx(y + 7, 1)}" stroke="${col}" stroke-width="3.5"/>`; } else { const [x, y] = rxy(RE, ry.D * Math.PI / 180); h += `<circle cx="${fx(x, 1)}" cy="${fx(y, 1)}" r="7" fill="${col}" stroke="${T.bg}" stroke-width="2.5"/>`; }
    });
    // quake marker
    const [qx, qy] = rxy(rs, 0);
    h += `<polygon points="${star(qx, qy, 11, 5)}" fill="#ffd23f" stroke="#5a3d00" stroke-width="1.5"/>`;
    h += tx(RC.cx, 22, 'Earthquake · 0°', { fs: 19, anchor: 'middle', weight: 600 });
    h += tx(RC.cx, RC.cy + RC.R + 2 - 14, '180°', { fs: 18, anchor: 'middle', fill: T.muted });
    h += tx(RC.cx, RC.cy + 6, 'Inner core', { fs: 17, anchor: 'middle', fill: T.fg });
    h += tx(RC.cx, RC.cy - 3480 * s + 34, 'Liquid outer core', { fs: 17, anchor: 'middle', fill: T.fg });
    h += tx(RC.cx, RC.cy - 3480 * s - 14, 'Mantle', { fs: 17, anchor: 'middle', fill: T.fg });
    h += `<g id="eaRayDots"></g>`;
    svg.innerHTML = h;
    rayDots();
    // readout
    const rows = [];
    sel.forEach((ry) => {
      const nm = ry.w === 'S' ? 'S' : 'P';
      rows.push([nm + ' path', PHN[ry.ph]]);
      if (ry.stop) rows.push([nm + ' ends', `hits the core at ${fx(ry.cmb, 1)}° and cannot continue as S`]);
      else rows.push([nm + ' arrives', `${fx(ry.D, 1)}° away (${n0(ry.D * 111.19)} km), after ${mmss(ry.T)}`]);
      rows.push([nm + ' deepest point', n0(RE - ry.rt) + ' km']);
    });
    const shadow = [];
    if (waves.includes('P')) shadow.push(`P: ${fx(F.maxP, 0)}° – ${fx(F.minK, 0)}°`);
    if (waves.includes('S')) shadow.push(`S: beyond ${fx(F.maxS, 0)}°`);
    rows.push(['Shadow zones (this model)', shadow.join('; ')]);
    facts($('#eaRayOut'), rows);
    $('#eaTkOut').textContent = fx(IN.tk, 1) + '°';
  }
  function star(x, y, R, r) { const p = []; for (let i = 0; i < 10; i++) { const a = i * Math.PI / 5 - Math.PI / 2, q = i % 2 ? r : R; p.push([x + q * Math.cos(a), y + q * Math.sin(a)]); } return poly(p); }
  function posAt(path, t) {
    if (t <= 0) return path[0];
    const last = path[path.length - 1];
    if (t >= last[2]) return null;
    let lo = 0, hi = path.length - 1;
    while (hi - lo > 1) { const m = (lo + hi) >> 1; if (path[m][2] <= t) lo = m; else hi = m; }
    const a = path[lo], b = path[hi], u = (t - a[2]) / ((b[2] - a[2]) || 1);
    return [lerp(a[0], b[0], u), lerp(a[1], b[1], u)];
  }
  function rayDots() {
    const g = $('#eaRayDots'); if (!g) return;
    if (!IN.play && IN.t === 0) { g.innerHTML = ''; return; }
    const F = fan(IN.quake), waves = IN.wave === 'both' ? ['S', 'P'] : [IN.wave];
    let h = '';
    waves.forEach((w) => F[w].forEach((ry) => { const q = posAt(ry.path, IN.t); if (!q) return; const col = w === 'S' ? T.s : T.p; [1, -1].forEach((sg) => { const [x, y] = rxy(q[0], sg * q[1]); h += `<circle cx="${fx(x, 1)}" cy="${fx(y, 1)}" r="4.2" fill="${col}" stroke="${T.bg}" stroke-width="1.5"/>`; }); }));
    h += tx(14, 30, 't = ' + mmss(IN.t), { fs: 20, weight: 600 });
    g.innerHTML = h;
  }

  function initInside() {
    seg($('#eaLayers'), LAY.map((l) => [l.k, l.name]), IN.layer, pickLayer);
    const hit = (e) => { const t = e.target.closest('.ea-hit'); if (t) pickLayer(t.dataset.k); };
    $('#eaCut').addEventListener('click', hit); $('#eaZoom').addEventListener('click', hit);
    $('#eaCut').addEventListener('pointerover', (e) => { if (e.pointerType === 'mouse') hit(e); });
    drawCut(); drawZoom(); showLayer();
    // profile chart
    const prof = $('#eaProf');
    drawProf();
    const mv = (e) => { const [x] = svgPt(prof, e); profHover((x - 62) / (626 - 62) * RE); };
    prof.addEventListener('pointermove', mv); prof.addEventListener('pointerdown', mv);
    prof.addEventListener('keydown', (e) => { const st = e.shiftKey ? 500 : 50; if (e.key === 'ArrowRight') { profHover(IN.hover + st); e.preventDefault(); } if (e.key === 'ArrowLeft') { profHover(IN.hover - st); e.preventDefault(); } if (e.key === 'Home') { profHover(0); e.preventDefault(); } if (e.key === 'End') { profHover(RE); e.preventDefault(); } });
    // rays
    seg($('#eaQuake'), Object.entries(QUAKES).map(([k, q]) => [k, `${q.label} · ${q.note}`]), IN.quake, (k) => { IN.quake = k; IN.t = 0; drawRays(); });
    seg($('#eaWave'), [['P', 'P waves'], ['S', 'S waves'], ['both', 'Both']], IN.wave, (k) => { IN.wave = k; drawRays(); });
    const tk = $('#eaTk'); tk.value = IN.tk; tk.addEventListener('input', () => { IN.tk = +tk.value; drawRays(); });
    const fn = $('#eaFan'); fn.checked = IN.fan; fn.addEventListener('change', () => { IN.fan = fn.checked; drawRays(); });
    const btn = $('#eaPlay');
    const loop = makeLoop('inside', $('#eaRay'), (dt) => { IN.t += dt * 140; if (IN.t > 1500) { IN.t = 0; IN.play = false; loop.play = false; loop.sync(); btn.textContent = 'Play the wavefronts'; } rayDots(); });
    loop.play = false;
    btn.addEventListener('click', () => {
      if (reduce) { IN.t = IN.t >= 1200 ? 0 : IN.t + 300; IN.play = IN.t > 0; rayDots(); btn.textContent = IN.t ? 'Step +5 min (' + mmss(IN.t) + ')' : 'Play the wavefronts'; return; }
      IN.play = !IN.play; loop.play = IN.play; if (IN.play && IN.t === 0) IN.t = 1; btn.textContent = IN.play ? 'Pause' : 'Play the wavefronts'; loop.sync(); rayDots();
    });
    if (reduce) btn.textContent = 'Step the wavefronts (+5 min)';
    drawRays();
    redraw.inside = () => { drawCut(); drawZoom(); drawProf(); drawRays(); };
  }

  /* =====================================================================
     PLATE TECTONICS
     ===================================================================== */
  const C = { water: '#3a7fc0', ocean: '#4d5866', oceanTk: '#a7b0bd', cont: '#a8875a', contTk: '#e2cfa8', magma: '#ff6a1a', magma2: '#ffd166', quake: '#ffe14d' };
  // a moving plate: polyline (in the direction of motion), per-point thickness, side (+1: thickness to the right of travel)
  function cum(pts) { const c = [0]; for (let i = 1; i < pts.length; i++) c.push(c[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1])); return c; }
  function at(pts, c, s) {
    let i = 1; while (i < pts.length - 1 && c[i] < s) i++;
    const a = pts[i - 1], b = pts[i], L = (c[i] - c[i - 1]) || 1, u = clamp((s - c[i - 1]) / L, 0, 1), dx = (b[0] - a[0]) / L, dy = (b[1] - a[1]) / L;
    return [lerp(a[0], b[0], u), lerp(a[1], b[1], u), -dy, dx, lerp(a[2], b[2], u)];
  }
  function belt(pts, side, fill, tick, phase, sp) {
    const c = cum(pts), tot = c[c.length - 1], top = [], bot = [];
    for (let i = 0; i < pts.length; i++) {
      const q = at(pts, c, c[i] + (i === pts.length - 1 ? -0.01 : 0.01));
      top.push([pts[i][0], pts[i][1]]); bot.push([pts[i][0] + side * q[2] * pts[i][2], pts[i][1] + side * q[3] * pts[i][2]]);
    }
    let h = `<polygon points="${poly(top.concat(bot.reverse()))}" fill="${fill}" stroke="rgba(0,0,0,.35)" stroke-width="1"/>`;
    sp = sp || 30;
    for (let s = ((phase % sp) + sp) % sp; s < tot; s += sp) {
      const q = at(pts, c, s), th = q[4];
      h += `<line x1="${fx(q[0] + side * q[2] * th * 0.18, 1)}" y1="${fx(q[1] + side * q[3] * th * 0.18, 1)}" x2="${fx(q[0] + side * q[2] * th * 0.82, 1)}" y2="${fx(q[1] + side * q[3] * th * 0.82, 1)}" stroke="${tick}" stroke-width="2.2" opacity="0.8"/>`;
    }
    return h;
  }
  const rnd = (i) => { const x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
  function quakes(list, t) { return list.map(([x, y], i) => { const o = reduce || !PL.play ? 0.9 : 0.25 + 0.75 * Math.pow(Math.max(0, Math.sin(t * (1.3 + rnd(i) * 1.7) + rnd(i + 9) * 6.3)), 6); return `<circle cx="${fx(x, 1)}" cy="${fx(y, 1)}" r="4" fill="${C.quake}" stroke="#5a4300" stroke-width="1.2" opacity="${fx(o, 2)}"/>`; }).join(''); }
  function bubblesUp(x0, y0, x1, y1, t, n, rate) { let h = ''; for (let i = 0; i < n; i++) { const u = ((t * rate + i / n) % 1 + 1) % 1, x = lerp(x0, x1, u) + Math.sin(u * 9 + i) * 5, y = lerp(y0, y1, u); h += `<circle cx="${fx(x, 1)}" cy="${fx(y, 1)}" r="${fx(4 + 2 * Math.sin(i), 1)}" fill="${C.magma}" opacity="${fx(0.9 - 0.5 * u, 2)}"/>`; } return h; }
  const asth = () => `<defs><linearGradient id="eaAst" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#d77a4c" stop-opacity="0.45"/><stop offset="1" stop-color="#a8391f" stop-opacity="0.7"/></linearGradient><linearGradient id="eaMg" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="${C.magma}" stop-opacity="0.15"/><stop offset="0.6" stop-color="${C.magma}" stop-opacity="0.85"/><stop offset="1" stop-color="${C.magma2}"/></linearGradient></defs><rect x="0" y="100" width="640" height="240" fill="url(#eaAst)"/>`;
  const slab = [[-20, 150, 36], [200, 152, 36], [280, 158, 36], [300, 166, 36], [340, 186, 36], [390, 218, 36], [440, 258, 36], [480, 298, 36], [512, 345, 36]];
  const slabQuakes = (() => { const c = cum(slab), out = []; for (let i = 0; i < 15; i++) { const s = c[3] + (c[c.length - 1] - c[3]) * (i + 0.5) / 15, q = at(slab, c, s), f = 0.25 + 0.5 * rnd(i + 3); out.push([q[0] + q[2] * 36 * f, q[1] + q[3] * 36 * f]); } return out; })();
  const SCENES = {
    div(t) {
      const fl = (x) => 124 + 44 * (1 - Math.exp(-Math.abs(x - 320) / 140)), th = (x) => 4 + 3.4 * Math.sqrt(Math.abs(x - 320));
      const R = [], L = [];
      for (let x = 323; x <= 660; x += 12) R.push([x, fl(x), th(x)]);
      for (let x = 317; x >= -20; x -= 12) L.push([x, fl(x), th(x)]);
      let h = asth();
      h += `<polygon points="${poly([[0, 90], [640, 90]].concat(R.slice().reverse().map((p) => [p[0], p[1] + 2])).concat(L.map((p) => [p[0], p[1] + 2])))}" fill="${C.water}" opacity="0.55"/>`;
      h += `<path d="M230,340 C290,250 306,190 316,128 L324,128 C334,190 350,250 410,340 Z" fill="url(#eaMg)"/>`;
      h += bubblesUp(320, 335, 320, 140, t, 7, 0.12);
      h += belt(R, -1, C.ocean, C.oceanTk, t * 14, 28) + belt(L, 1, C.ocean, C.oceanTk, t * 14, 28);
      h += `<line x1="320" y1="124" x2="320" y2="150" stroke="${C.magma2}" stroke-width="4"/>`;
      h += quakes([[306, 136], [331, 140], [314, 150], [339, 133], [300, 146]], t);
      h += arrow(240, 112, 140, 112, T.fg) + arrow(400, 112, 500, 112, T.fg);
      h += tx(320, 60, 'Mid-ocean ridge', { anchor: 'middle', weight: 600 }) + `<line x1="320" y1="66" x2="320" y2="118" stroke="${T.fg}" stroke-width="1.4"/>`;
      h += tx(320, 300, 'Magma rises', { anchor: 'middle' });
      h += tx(110, 197, 'Plate (lithosphere)', { anchor: 'middle', fs: 19 });
      h += tx(520, 244, 'Thickens as it cools', { anchor: 'middle', fs: 19 });
      h += tx(632, 330, 'Asthenosphere (soft, solid)', { anchor: 'end', fs: 19 });
      return h;
    },
    oc(t) {
      let h = asth() + `<rect x="0" y="90" width="372" height="80" fill="${C.water}" opacity="0.55"/>`;
      h += belt(slab, 1, C.ocean, C.oceanTk, t * 14, 28);
      const top = [[306, 168], [330, 140], [350, 106], [366, 90], [384, 80], [410, 58], [432, 38], [445, 25], [458, 36], [480, 52], [510, 70], [560, 80], [640, 82]];
      const bot = [[640, 170], [560, 176], [500, 190], [440, 204], [380, 186], [340, 177], [316, 172]];
      h += `<polygon points="${poly(top.concat(bot))}" fill="${C.cont}" stroke="rgba(0,0,0,.35)"/>`;
      for (let x = 400 + ((-t * 3) % 30 + 30) % 30; x < 640; x += 30) h += `<line x1="${fx(x, 1)}" y1="110" x2="${fx(x, 1)}" y2="150" stroke="${C.contTk}" stroke-width="2" opacity="0.7"/>`;
      h += `<ellipse cx="447" cy="160" rx="18" ry="9" fill="${C.magma}"/><line x1="446" y1="152" x2="445" y2="28" stroke="${C.magma}" stroke-width="4"/>`;
      h += bubblesUp(452, 258, 447, 172, t, 5, 0.18);
      h += plume(445, 24, t, 0.6);
      h += quakes(slabQuakes.concat([[360, 150], [420, 120]]), t);
      h += arrow(60, 120, 180, 120, T.fg) + arrow(620, 128, 570, 128, T.fg, 3);
      h += tx(300, 80, 'Trench', { anchor: 'middle', weight: 600 }) + `<line x1="300" y1="86" x2="301" y2="160" stroke="${T.fg}" stroke-width="1.4"/>`;
      h += tx(472, 22, 'Volcanic arc', { fs: 19 });
      h += tx(560, 162, 'Continent', { anchor: 'middle', fs: 19 });
      h += tx(120, 174, 'Oceanic plate', { anchor: 'middle', fs: 19 });
      h += tx(470, 240, 'Magma forms here', { fs: 19 });
      h += tx(468, 320, 'Sinking slab', { anchor: 'end', fs: 19 });
      return h;
    },
    oo(t) {
      let h = asth() + `<rect x="0" y="90" width="640" height="64" fill="${C.water}" opacity="0.55"/>`;
      h += belt(slab, 1, C.ocean, C.oceanTk, t * 14, 28);
      h += `<polygon points="${poly([[310, 168], [330, 152], [640, 150], [640, 186], [450, 188], [380, 190], [350, 184], [330, 176]])}" fill="#5b6675" stroke="rgba(0,0,0,.35)"/>`;
      h += `<polygon points="${poly([[392, 152], [432, 66], [440, 60], [452, 60], [460, 66], [500, 152]])}" fill="#5f5a55" stroke="rgba(0,0,0,.35)"/>`;
      h += `<ellipse cx="447" cy="168" rx="16" ry="8" fill="${C.magma}"/><line x1="446" y1="160" x2="446" y2="62" stroke="${C.magma}" stroke-width="4"/>`;
      h += bubblesUp(452, 258, 447, 178, t, 5, 0.18);
      h += plume(446, 58, t, 0.5);
      h += quakes(slabQuakes.concat([[400, 172]]), t);
      h += arrow(60, 120, 180, 120, T.fg);
      h += tx(300, 80, 'Trench', { anchor: 'middle', weight: 600 }) + `<line x1="300" y1="86" x2="301" y2="162" stroke="${T.fg}" stroke-width="1.4"/>`;
      h += tx(502, 72, 'Island arc', { fs: 19 });
      h += tx(120, 174, 'Older, denser plate', { anchor: 'middle', fs: 19 });
      h += tx(570, 175, 'Younger plate', { anchor: 'middle', fs: 19 });
      h += tx(470, 240, 'Magma forms here', { fs: 19 });
      h += tx(468, 320, 'Sinking slab', { anchor: 'end', fs: 19 });
      return h;
    },
    cc(t) {
      let h = asth();
      const india = [[-20, 96, 50], [240, 100, 50], [300, 116, 50], [360, 150, 48], [430, 180, 46], [520, 198, 44], [660, 206, 44]];
      h += belt(india, 1, C.cont, C.contTk, t * 9, 30);
      const top = [[282, 97], [300, 62], [318, 28], [334, 44], [352, 20], [372, 44], [396, 38], [430, 44], [640, 46]], bot = [[640, 198], [520, 192], [430, 175], [360, 145], [310, 118], [286, 102]];
      h += `<polygon points="${poly(top.concat(bot))}" fill="#9a7a50" stroke="rgba(0,0,0,.35)"/>`;
      h += `<polygon points="${poly([[350, 252], [384, 248], [428, 336], [394, 340]])}" fill="${C.ocean}" stroke="rgba(0,0,0,.35)"/>`;
      h += quakes([[300, 90], [330, 70], [352, 104], [380, 88], [410, 120], [440, 100], [470, 140], [325, 128], [500, 80]], t);
      h += arrow(60, 66, 180, 66, T.fg);
      h += tx(294, 40, 'Himalaya', { anchor: 'end', weight: 600 });
      h += tx(530, 32, 'Tibetan Plateau', { anchor: 'middle', fs: 19 });
      h += tx(120, 128, 'India', { anchor: 'middle', weight: 600 });
      h += tx(560, 128, 'Asia', { anchor: 'middle', weight: 600 });
      h += tx(340, 300, 'Old ocean floor broke off', { fs: 19, anchor: 'end' });
      return h;
    },
    tf(t) {
      const off = reduce || !PL.play ? 90 : (t * 18) % 200, x0 = 330;
      let h = `<rect x="0" y="0" width="640" height="170" fill="#b59c6c"/><rect x="0" y="170" width="640" height="170" fill="#8f8a5c"/>`;
      [[34, -1], [108, -1], [236, 1], [306, 1]].forEach(([y, dir]) => { for (let x = ((dir * t * 16) % 40 + 40) % 40 - 40; x < 660; x += 40) h += `<line x1="${fx(x, 1)}" y1="${y}" x2="${fx(x + 18, 1)}" y2="${y}" stroke="rgba(30,20,0,.35)" stroke-width="3" stroke-linecap="round"/>`; });
      h += `<path d="M${x0 - off / 2},0 C${x0 - off / 2 - 20},60 ${x0 - off / 2 + 18},120 ${x0 - off / 2},170 L${x0 + off / 2},170 C${x0 + off / 2 - 16},220 ${x0 + off / 2 + 22},290 ${x0 + off / 2},340" fill="none" stroke="#2f78c4" stroke-width="6" stroke-linejoin="round"/>`;
      h += `<path d="M0,171 L120,168 L240,172 L400,169 L520,172 L640,169" fill="none" stroke="#3a1d0a" stroke-width="3.5"/>`;
      h += quakes([[60, 170], [170, 170], [260, 171], [380, 169], [470, 171], [590, 170]], t);
      h += arrow(250, 140, 130, 140, '#1d1408') + arrow(390, 200, 510, 200, '#1d1408');
      h += tx(20, 72, 'North American plate', { fill: '#1d1408', halo: false, weight: 600 });
      h += tx(20, 278, 'Pacific plate', { fill: '#f6f1e1', halo: false, weight: 600 });
      h += tx(632, 158, 'San Andreas Fault', { anchor: 'end', fill: '#1d1408', halo: false, weight: 600 });
      h += tx(x0 + off / 2 + 26, 258, 'Stream offset by the fault', { fill: '#f6f1e1', halo: false, fs: 19 });
      h += tx(632, 330, 'Map view, from above', { anchor: 'end', fill: '#f6f1e1', halo: false, fs: 18 });
      return h;
    }
  };
  function plume(x, y, t, k) {
    if (reduce || !PL.play) return `<circle cx="${x}" cy="${y - 14}" r="9" fill="#9aa0a6" opacity="0.7"/>`;
    let h = '';
    for (let i = 0; i < 6; i++) { const u = ((t * 0.25 + i / 6) % 1), r = 5 + 16 * u * k; h += `<circle cx="${fx(x + 12 * u + Math.sin(i * 2) * 4, 1)}" cy="${fx(y - 6 - 60 * u * k, 1)}" r="${fx(r, 1)}" fill="#9aa0a6" opacity="${fx(0.75 * (1 - u), 2)}"/>`; }
    return h;
  }
  const BND = {
    div: { btn: 'Divergent', head: 'Divergent: plates pull apart', ex: 'Mid-Atlantic Ridge (Iceland sits on top of it); East Pacific Rise', rate: 'Mid-Atlantic ~2–5 cm/yr; East Pacific Rise up to ~15 cm/yr (full spreading)', makes: 'New ocean floor, a 65,000 km chain of undersea ridges', eq: 'Shallow, small to moderate', vol: 'Yes, mostly unseen on the sea floor', why: 'Hot mantle rises into the gap. As the pressure on it drops, part of it melts, without any extra heat. The melt fills the crack and freezes into new crust, so the ocean floor is youngest at the ridge and older the farther you go.' },
    oc: { btn: 'Ocean–continent', head: 'Convergent: ocean plate under a continent', ex: 'Nazca plate sinking under South America: the Andes and the Peru–Chile Trench', rate: '~6.5–8 cm/yr', makes: 'A deep trench, coastal mountains, a line of volcanoes', eq: 'Shallow to ~700 km deep, along the sinking slab. The largest on record: Chile 1960, M9.5', vol: 'Yes, often explosive (silica-rich)', why: 'Ocean floor is denser than continent, so it sinks. Near 100 km depth, water squeezed out of the slab lowers the melting point of the hot mantle above it. That melt rises to feed the volcanoes.' },
    oo: { btn: 'Ocean–ocean', head: 'Convergent: ocean plate under ocean plate', ex: 'Mariana Trench and Islands: the Pacific plate sinking under the Philippine Sea plate', rate: 'Varies along trenches; the Tonga Trench closes at up to ~24 cm/yr, the fastest measured', makes: 'The deepest trenches (Challenger Deep, ~10.9 km) and curved chains of volcanic islands', eq: 'Shallow to ~700 km deep', vol: 'Yes: island arcs such as the Marianas and Aleutians', why: 'When two ocean plates meet, the older one is colder and denser, so it sinks. The same water-driven melting builds volcanoes that grow up from the sea floor into islands.' },
    cc: { btn: 'Continent–continent', head: 'Collision: two continents meet', ex: 'India pushing into Asia: the Himalaya and the Tibetan Plateau', rate: '~4–5 cm/yr', makes: 'The highest mountains (Everest, 8,849 m) and the thickest crust (~70 km)', eq: 'Shallow, spread over a wide region (Nepal 2015, M7.8)', vol: 'Almost none', why: 'Continental rock is too light to sink far. The ocean between India and Asia closed about 50 million years ago. Since then the crust has crumpled, folded and stacked up instead of going down.' },
    tf: { btn: 'Transform', head: 'Transform: plates slide past', ex: 'San Andreas Fault, California', rate: 'Pacific vs North American plate ~5 cm/yr in total, shared among several faults; the San Andreas itself slips ~2–3.5 cm/yr', makes: 'A long straight fault; streams, roads and fences offset sideways', eq: 'Shallow (top ~15 km), can be large (San Francisco 1906, M7.9)', vol: 'None', why: 'Crust is neither made nor destroyed, just moved sideways. The fault stays locked while strain builds for decades to centuries, then slips all at once in an earthquake.' }
  };
  const PL = { b: store.get('bnd') || 'oc', play: !reduce, t: 0 };
  if (!BND[PL.b]) PL.b = 'oc';
  function drawBnd() { $('#eaBndSvg').innerHTML = SCENES[PL.b](PL.t); }
  function showBnd() {
    const b = BND[PL.b];
    $('#eaBndHead').innerHTML = `<p class="h">Boundary</p><p class="nm">${b.head}</p><p>${b.why}</p>`;
    facts($('#eaBndFacts'), [['Real example', b.ex], ['Speed', b.rate], ['Builds', b.makes], ['Earthquakes', b.eq], ['Volcanoes', b.vol]]);
    $('#eaBndSvg').setAttribute('aria-label', 'Animated ' + (PL.b === 'tf' ? 'map view' : 'cross-section') + ': ' + b.head + '. Example: ' + b.ex + '.');
    drawBnd();
  }

  /* ---------- seafloor magnetic stripes ----------
     Geomagnetic polarity timescale, GTS2012 (Ma): [start, end, +1 normal / -1 reversed] */
  const GPTS = [[0, 0.781, 1], [0.781, 0.988, -1], [0.988, 1.072, 1], [1.072, 1.173, -1], [1.173, 1.185, 1], [1.185, 1.778, -1], [1.778, 1.945, 1], [1.945, 2.128, -1], [2.128, 2.148, 1], [2.148, 2.581, -1], [2.581, 3.032, 1], [3.032, 3.116, -1], [3.116, 3.207, 1], [3.207, 3.330, -1], [3.330, 3.596, 1], [3.596, 4.187, -1], [4.187, 4.300, 1], [4.300, 4.493, -1], [4.493, 4.631, 1], [4.631, 4.799, -1], [4.799, 4.896, 1], [4.896, 4.997, -1], [4.997, 5.235, 1], [5.235, 6.033, -1]];
  const CHRONS = [['Brunhes', 0, 0.781], ['Matuyama', 0.781, 2.581], ['Gauss', 2.581, 3.596], ['Gilbert', 3.596, 6.033]];
  const MG = { v: +(store.get('rate') || 2.5), ship: null, pre: 'mar' };
  const MPRE = { rey: ['Reykjanes Ridge', 1], mar: ['Mid-Atlantic Ridge', 1.25], epr: ['East Pacific Rise', 7.5] };
  const KM = 200, mx = (d) => 320 + d / KM * 300;
  function anomaly(v) { // vertical field over vertically magnetized blocks, top 3 km and bottom 3.5 km below the ship
    const h1 = 3, h2 = 3.5, blocks = [];
    GPTS.forEach(([a, b, m]) => { const x1 = a * v * 10, x2 = b * v * 10; blocks.push([x1, x2, m], [-x2, -x1, m]); });
    const out = [];
    for (let i = 0; i <= 320; i++) {
      const x = -KM + 2 * KM * i / 320; let z = 0;
      blocks.forEach(([x1, x2, m]) => { z += m * (Math.atan((x2 - x) / h1) - Math.atan((x1 - x) / h1) - Math.atan((x2 - x) / h2) + Math.atan((x1 - x) / h2)); });
      out.push([x, z]);
    }
    return out;
  }
  function drawMag() {
    const svg = $('#eaMag'), v = MG.v, km = v * 10, edge = 6.033 * km;
    const nCol = T.accent, rCol = T.surface2;
    let h = '';
    // profile
    const A = anomaly(v), yA = (z) => 82 - z / 0.42 * 46;
    h += `<line x1="20" x2="620" y1="82" y2="82" stroke="${T.line}" stroke-width="1"/>`;
    const lim = MG.ship === null ? KM : MG.ship;
    const pts = A.filter(([x]) => x <= lim).map(([x, z]) => fx(mx(x), 1) + ',' + fx(yA(clamp(z, -0.6, 0.6)), 1)).join(' ');
    if (pts) h += `<polyline points="${pts}" fill="none" stroke="${T.fg}" stroke-width="2.2" stroke-linejoin="round"/>`;
    h += tx(20, 24, 'Ship\'s magnetometer', { fs: 18, fill: T.muted });
    h += tx(620, 24, 'stronger ↑  weaker ↓', { fs: 18, fill: T.muted, anchor: 'end' });
    // sea and ship
    h += `<rect x="20" y="148" width="600" height="38" fill="${C.water}" opacity="0.5"/>`;
    const sx = mx(MG.ship === null ? -KM * 0.82 : MG.ship);
    h += `<path d="M${fx(sx - 18, 1)},140 L${fx(sx + 18, 1)},140 L${fx(sx + 12, 1)},149 L${fx(sx - 12, 1)},149 Z M${fx(sx - 4, 1)},140 L${fx(sx - 4, 1)},128 L${fx(sx + 6, 1)},128 L${fx(sx + 6, 1)},140 Z" fill="${T.fg}"/>`;
    h += `<line x1="${fx(sx - 18, 1)}" y1="145" x2="${fx(sx - 40, 1)}" y2="152" stroke="${T.fg}" stroke-width="1.2"/>`;
    // stripes
    GPTS.forEach(([a, b, m]) => {
      [1, -1].forEach((g) => { let x1 = g * a * km, x2 = g * b * km; if (x1 > x2) [x1, x2] = [x2, x1]; x1 = clamp(x1, -KM, KM); x2 = clamp(x2, -KM, KM); if (x2 > x1) h += `<rect x="${fx(mx(x1), 2)}" y="186" width="${fx(mx(x2) - mx(x1), 2)}" height="28" fill="${m > 0 ? nCol : rCol}"/>`; });
    });
    if (edge < KM) [1, -1].forEach((g) => { const a = mx(g * edge), b = mx(g * KM); h += `<rect x="${fx(Math.min(a, b), 1)}" y="186" width="${fx(Math.abs(b - a), 1)}" height="28" fill="url(#eaHatch)"/>`; });
    h = `<defs><pattern id="eaHatch" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="8" height="8" fill="${T.surface}"/><line x1="0" y1="0" x2="0" y2="8" stroke="${T.line}" stroke-width="3"/></pattern></defs>` + h;
    h += `<rect x="20" y="186" width="600" height="28" fill="none" stroke="${T.line}"/>`;
    h += `<rect x="20" y="214" width="600" height="18" fill="#b9643c" opacity="0.45"/><path d="M308,232 L320,190 L332,232 Z" fill="${C.magma}"/>`;
    // axes
    [-200, -100, 0, 100, 200].forEach((d) => { h += `<line x1="${mx(d)}" x2="${mx(d)}" y1="232" y2="238" stroke="${T.muted}"/>` + tx(clamp(mx(d), 40, 600), 258, (d > 0 ? '+' : '') + d + (Math.abs(d) === 200 ? ' km' : ''), { fs: 18, anchor: 'middle', fill: T.muted, halo: false }); });
    // chron labels on the right side, only where they fit
    CHRONS.forEach(([nm, a, b]) => {
      const x1 = mx(a * km), x2 = mx(Math.min(b * km, KM));
      if (x1 >= 620) return;
      h += `<path d="M${fx(x1 + 1, 1)},272 v6 H${fx(x2 - 1, 1)} v-6" fill="none" stroke="${T.muted}" stroke-width="1.3"/>`;
      if (x2 - x1 > nm.length * 10.5) h += tx((x1 + x2) / 2, 300, nm, { fs: 18, anchor: 'middle', fill: T.fg, halo: false });
    });
    h += tx(20, 300, 'Age →', { fs: 18, fill: T.muted, halo: false });
    h += tx(320, 322, 'Ridge axis at 0. Each side is a mirror image.', { fs: 18, anchor: 'middle', fill: T.muted, halo: false });
    svg.innerHTML = h;
    const jar = (1.072 - 0.988) * km;
    $('#eaRateOut').textContent = `${fx(v, 2)} cm/yr each side (${fx(2 * v, 1)} full)`;
    facts($('#eaMagOut'), [
      ['1 million years of sea floor', `${fx(km, km < 10 ? 1 : 0)} km wide on each side`],
      ['Brunhes stripe (0 – 0.78 Ma)', `${fx(0.781 * km * 2, 0)} km wide, centred on the ridge`],
      ['Jaramillo event (80,000 years)', `${fx(jar, 1)} km wide: ${jar < 3.5 ? 'blurred out at this depth' : 'clearly visible'}`],
      ['Stripes shown back to', edge < KM ? '6.0 million years (hatched: older)' : `${fx(KM / km, 1)} million years`]
    ]);
  }

  function initPlates() {
    seg($('#eaBnd'), Object.entries(BND).map(([k, b]) => [k, b.btn]), PL.b, (k) => { PL.b = k; store.set('bnd', k); showBnd(); });
    const pb = $('#eaBndPlay');
    const loop = makeLoop('plates', $('#eaBndSvg'), (dt) => { PL.t += dt; drawBnd(); });
    const setBtn = () => { pb.textContent = PL.play ? 'Pause' : 'Play'; pb.setAttribute('aria-pressed', String(PL.play)); };
    if (reduce) { PL.play = false; loop.play = false; }
    setBtn();
    pb.addEventListener('click', () => { PL.play = !PL.play; loop.play = PL.play; setBtn(); loop.sync(); drawBnd(); });
    showBnd();
    // stripes
    const r = $('#eaRate');
    r.value = MG.v;
    const pre = Object.keys(MPRE).find((k) => Math.abs(MPRE[k][1] - MG.v) < 1e-6) || '';
    seg($('#eaMagPre'), Object.entries(MPRE).map(([k, [n, v]]) => [k, `${n} (${fx(v * 2, 1)} cm/yr)`]), pre, (k) => { MG.v = MPRE[k][1]; r.value = MG.v; store.set('rate', MG.v); drawMag(); });
    r.addEventListener('input', () => { MG.v = +r.value; store.set('rate', MG.v); press($('#eaMagPre'), Object.keys(MPRE).find((k) => Math.abs(MPRE[k][1] - MG.v) < 1e-6) || ''); drawMag(); });
    const sail = $('#eaSail');
    const sl = makeLoop('plates', $('#eaMag'), (dt) => { MG.ship += dt * 45; if (MG.ship >= KM) { MG.ship = null; sl.play = false; sl.sync(); sail.textContent = 'Sail across the ridge'; } drawMag(); });
    sl.play = false;
    sail.addEventListener('click', () => {
      if (reduce) { MG.ship = MG.ship === null ? -KM + 100 : MG.ship + 100; if (MG.ship >= KM) MG.ship = null; sail.textContent = MG.ship === null ? 'Sail across the ridge' : 'Sail on'; drawMag(); return; }
      if (sl.play) { sl.play = false; sl.sync(); MG.ship = null; sail.textContent = 'Sail across the ridge'; drawMag(); return; }
      MG.ship = -KM; sl.play = true; sl.sync(); sail.textContent = 'Stop'; drawMag();
    });
    drawMag();
    redraw.plates = () => { drawBnd(); drawMag(); };
  }

  /* =====================================================================
     VOLCANOES
     ===================================================================== */
  // log10 viscosity (Pa·s) at typical eruption temperature vs silica wt% — rough trend after Giordano et al. (2008)
  const VIS = [[45, 1], [52, 2.5], [60, 5], [66, 7.5], [72, 10], [77, 11.5]];
  const logVis = (si) => { for (let i = 1; i < VIS.length; i++) if (si <= VIS[i][0]) return lerp(VIS[i - 1][1], VIS[i][1], (si - VIS[i - 1][0]) / (VIS[i][0] - VIS[i - 1][0])); return VIS[VIS.length - 1][1]; };
  const ROCKS = [
    { max: 52, name: 'Basalt', T: '1,100 – 1,250 °C', gas: 'Low (well under 1–2% water)', style: 'Effusive: lava fountains and long, fast flows', shape: 'Shield volcano: wide, gentle slopes', ex: 'Mauna Loa and Kīlauea (Hawaiʻi), Iceland', esc: 'Bubbles rise and escape easily, so the gas leaves gently.' },
    { max: 57, name: 'Basaltic andesite', T: '1,050 – 1,150 °C', gas: 'Moderate', style: 'Mixed: lava flows and small explosions', shape: 'Cinder cones and young stratovolcanoes', ex: 'Parícutin (Mexico, 1943–52), Etna', esc: 'Bubbles still move, but more slowly; some gas bursts out.' },
    { max: 63, name: 'Andesite', T: '900 – 1,100 °C', gas: 'Moderate to high (~2–4% water)', style: 'Explosive: ash columns, pyroclastic flows, sticky lava domes', shape: 'Stratovolcano: steep cone of lava and ash layers', ex: 'Mount Fuji, Mount Hood, Soufrière Hills (Montserrat)', esc: 'Bubbles get stuck. Pressure builds until the magma bursts.' },
    { max: 69, name: 'Dacite', T: '800 – 1,000 °C', gas: 'High', style: 'Very explosive: Plinian ash columns, lava domes', shape: 'Stratovolcano, often with a dome', ex: 'Mount St. Helens 1980, Pinatubo 1991', esc: 'Gas is trapped. When it escapes, the magma shatters into ash.' },
    { max: 99, name: 'Rhyolite', T: '700 – 850 °C', gas: 'High (~4–6% water)', style: 'The most explosive; the largest eruptions empty the magma chamber', shape: 'Caldera: a huge collapse crater, or thick domes', ex: 'Yellowstone (2.1 million and 631,000 years ago), Toba', esc: 'Almost no gas can escape; the whole mass of magma can blow apart.' }
  ];
  const rockOf = (si) => ROCKS.find((r) => si < r.max) || ROCKS[ROCKS.length - 1];
  const VO = { si: +(store.get('si') || 50), bub: [], t: 0, vei: 5 };
  for (let i = 0; i < 40; i++) VO.bub.push({ x: 40 + rnd(i) * 110, y: 40 + rnd(i + 50) * 230, r0: 2 + rnd(i + 90) * 3 });
  function volProfile(si) {
    const wS = clamp((56 - si) / 6, 0, 1), wC = clamp((si - 66) / 5, 0, 1), wT = 1 - wS - wC > 0 ? 1 - wS - wC : 0, tot = wS + wC + wT;
    const pts = [];
    for (let x = 210; x <= 630; x += 5) {
      const dx = Math.abs(x - 420);
      const shield = dx < 210 ? 64 * Math.pow(1 - Math.pow(dx / 210, 2), 0.7) - (dx < 14 ? 4 : 0) : 0;
      const strato = 172 * Math.exp(-dx / 52) - (dx < 12 ? 172 * Math.exp(-12 / 52) * (1 - dx / 12) * 0.25 : 0);
      const cald = (dx > 70 ? 46 * Math.exp(-Math.pow((dx - 112) / 46, 2)) : -10 + 56 * Math.pow(dx / 70, 4)) + (dx < 26 ? 14 * (1 - dx / 26) : 0);
      pts.push([x, 250 - (wS * shield + wT * strato + wC * cald) / tot]);
    }
    return pts;
  }
  function drawVol() {
    const si = VO.si, lv = logVis(si), rk = rockOf(si), svg = $('#eaVol'), t = VO.t;
    const hot = clamp((si - 45) / 30, 0, 1), mcol = `rgb(${Math.round(lerp(255, 175, hot))},${Math.round(lerp(96, 52, hot))},${Math.round(lerp(26, 18, hot))})`;
    let h = '';
    // magma column with bubbles
    h += `<rect x="30" y="40" width="130" height="232" rx="10" fill="${mcol}"/><rect x="30" y="40" width="130" height="232" rx="10" fill="none" stroke="${T.line}" stroke-width="2"/>`;
    const gas = lerp(0.35, 1, hot);
    VO.bub.forEach((b, i) => { if (i / VO.bub.length > gas) return; const grow = 1 + (272 - b.y) / 140 * (lv > 6 ? 1.6 : 0.7); h += `<circle cx="${fx(b.x, 1)}" cy="${fx(b.y, 1)}" r="${fx(b.r0 * grow, 1)}" fill="rgba(255,240,220,.55)" stroke="rgba(255,255,255,.75)" stroke-width="1"/>`; });
    h += tx(95, 28, 'Gas bubbles', { fs: 18, anchor: 'middle' });
    // ground, chamber, edifice
    const prof = volProfile(si);
    h += `<rect x="200" y="250" width="440" height="50" fill="#6d5a48"/><ellipse cx="420" cy="283" rx="${fx(lerp(46, 110, hot), 1)}" ry="13" fill="${mcol}"/>`;
    const sumY = Math.min(...prof.filter(([x]) => Math.abs(x - 420) < 20).map((p) => p[1]));
    h += `<line x1="420" y1="272" x2="420" y2="${fx(sumY + 4, 1)}" stroke="${mcol}" stroke-width="5"/>`;
    h += `<polygon points="200,250 ${poly(prof)} 640,250" fill="#77685a" stroke="#3b3128" stroke-width="1.5"/>`;
    // eruption: lava flows for runny magma, ash column for sticky magma
    const eff = clamp((58 - si) / 8, 0, 1), exp = clamp((si - 54) / 14, 0, 1), anim = !reduce;
    if (eff > 0.05) {
      [1, -1].forEach((g) => { const fl = prof.filter(([x]) => g * (x - 420) >= 0 && Math.abs(x - 420) < 40 + 150 * eff); const d = 'M' + (g > 0 ? fl : fl.slice().reverse()).map((p) => fx(p[0], 1) + ',' + fx(p[1] - 2, 1)).join('L'); h += `<path d="${d}" fill="none" stroke="#ff7a1a" stroke-width="${fx(3 + 3 * eff, 1)}" stroke-linecap="round" opacity="${fx(0.5 + 0.5 * eff, 2)}" stroke-dasharray="14 8" stroke-dashoffset="${anim ? fx(-t * 30, 1) : 0}"/>`; });
      for (let i = 0; i < 5; i++) { const u = anim ? ((t * 1.3 + i / 5) % 1) : i / 5; const hgt = 30 * eff; h += `<circle cx="${fx(420 + Math.sin(i * 2.1) * 10 * u, 1)}" cy="${fx(sumY - hgt * Math.sin(Math.PI * u), 1)}" r="3.5" fill="#ffb347"/>`; }
    }
    if (exp > 0.05) {
      const top = lerp(sumY - 30, 22, exp);
      for (let i = 0; i < 12; i++) { const u = anim ? ((t * 0.18 + i / 12) % 1) : i / 12; const y = lerp(sumY - 6, top, u), r = lerp(8, 18 + 36 * exp, u) * (0.6 + 0.4 * exp); h += `<circle cx="${fx(420 + Math.sin(i * 1.7) * 10 * u + 26 * u * u, 1)}" cy="${fx(y, 1)}" r="${fx(r, 1)}" fill="#8f949b" opacity="${fx((0.25 + 0.5 * exp) * (1 - 0.5 * u), 2)}"/>`; }
      if (si > 60 && si < 72) { for (let i = 0; i < 6; i++) { const u = anim ? ((t * 0.3 + i / 6) % 1) : i / 6, fl = prof[Math.round(lerp(42, 66, u))]; h += `<circle cx="${fx(fl[0], 1)}" cy="${fx(fl[1] - 8, 1)}" r="${fx(8 + 8 * u, 1)}" fill="#a3a7ad" opacity="${fx(0.6 * (1 - u), 2)}"/>`; } }
    }
    h += tx(630, 290, 'Not to scale', { fs: 17, anchor: 'end', fill: '#f2ede4', halo: false });
    h += tx(420, 296, 'Magma chamber', { fs: 17, anchor: 'middle', fill: '#f2ede4', halo: false });
    svg.innerHTML = h;
    svg.setAttribute('aria-label', `${rk.name} magma: ${rk.style}. ${rk.shape}.`);
  }
  function showVol() {
    const si = VO.si, lv = logVis(si), rk = rockOf(si);
    $('#eaSiOut').textContent = fx(si, 0) + '% silica';
    $('#eaVolHead').innerHTML = `<p class="h">Magma</p><p class="nm">${rk.name}</p><p>${rk.esc}</p>`;
    const sup = (n) => '10<sup>' + Math.round(n) + '</sup>';
    facts($('#eaVolFacts'), [['Silica (SiO₂)', fx(si, 0) + '% by weight'], ['Eruption temperature', rk.T], ['Viscosity (rough)', `~${sup(lv)} Pa·s · ${lv < 2.2 ? 'about like honey' : lv < 4 ? 'like peanut butter or stiffer' : 'stiffer than any household goo'}`], ['Dissolved gas', rk.gas], ['Eruption style', rk.style], ['Volcano shape', rk.shape], ['Examples', rk.ex]]);
    $('#eaVisMark').style.left = clamp(lv / 12 * 100, 0, 100) + '%';
    $('#eaVisMark').setAttribute('aria-label', 'Viscosity about 10 to the ' + Math.round(lv) + ' pascal seconds');
  }
  /* VEI (Newhall & Self 1982) */
  const VEI = [
    ['Non-explosive', '< 10,000 m³', '< 100 m', 'Kīlauea\'s and Mauna Loa\'s lava flows'],
    ['Gentle', '10,000 – 1 million m³', '0.1 – 1 km', 'Stromboli\'s frequent small bursts'],
    ['Explosive', '1 – 10 million m³', '1 – 5 km', 'Common: many happen around the world each year'],
    ['Severe', '10 – 100 million m³', '3 – 15 km', 'Nevado del Ruiz, Colombia, 1985'],
    ['Cataclysmic', '0.1 – 1 km³', '10 – 25 km', 'Eyjafjallajökull, Iceland, 2010 (shut European airspace)'],
    ['Paroxysmal', '1 – 10 km³', '> 25 km', 'Mount St. Helens 1980; Vesuvius 79 CE'],
    ['Colossal', '10 – 100 km³', '> 25 km', 'Pinatubo 1991 (cooled the globe ~0.5 °C); Krakatau 1883'],
    ['Super-colossal', '100 – 1,000 km³', '> 25 km', 'Tambora 1815 (the "year without a summer" followed)'],
    ['Mega-colossal', '> 1,000 km³', '> 25 km', 'Yellowstone 2.1 million years ago; Toba ~74,000 years ago']
  ];
  const VEILOG = [3.5, 5, 6.5, 7.5, 8.5, 9.5, 10.5, 11.5, 12.4];
  function drawVei() {
    const svg = $('#eaVei'), y0 = 200, k = 18;
    let h = '';
    [[4, '10,000 m³'], [9, '1 km³'], [12, '1,000 km³']].forEach(([lg, lb]) => { const y = y0 - (lg - 3) * k; h += `<line x1="40" x2="630" y1="${y}" y2="${y}" stroke="${T.line}" stroke-dasharray="4 5"/>` + tx(44, y - 6, lb, { fs: 17, fill: T.muted }); });
    VEILOG.forEach((lg, i) => {
      const x = 74 + i * 62, hh = (lg - 3) * k, on = i === VO.vei;
      h += `<g class="ea-hit" data-v="${i}"><rect x="${x - 22}" y="${y0 - hh}" width="44" height="${hh}" rx="4" fill="${on ? T.accent : T.faint}" opacity="${on ? 1 : 0.55}"/><rect x="${x - 30}" y="10" width="60" height="226" fill="transparent"/>` + tx(x, y0 + 26, i, { fs: 20, anchor: 'middle', weight: on ? 700 : 500, fill: on ? T.accent : T.fg, halo: false }) + '</g>';
    });
    h += tx(630, 226 + 4, 'VEI', { fs: 17, anchor: 'end', fill: T.muted, halo: false });
    svg.innerHTML = h;
    const v = VEI[VO.vei];
    $('#eaVeiHead').innerHTML = `<p class="h">VEI ${VO.vei}</p><p class="nm">${v[0]}</p><p>Erupted volume ${v[1]}. ${VO.vei >= 2 ? 'Each step up is about ten times more material, and much rarer.' : 'Steps 0 to 2 cover the small end of the scale.'}</p>`;
    facts($('#eaVeiFacts'), [['Erupted volume', v[1]], ['Eruption column', v[2]], ['Example', v[3]]]);
    press($('#eaVeiBtns'), String(VO.vei));
  }
  /* Hawaiian hotspot track: oldest shield-lava K–Ar ages and distances from Kīlauea (Clague & Dalrymple 1987) */
  const HAW = [['Kīlauea', 0, 0, 10, -10, 'start'], ['Kohala', 0.43, 100, 12, 6, 'start'], ['W. Maui', 1.32, 221, -12, -6, 'end'], ['E. Molokaʻi', 1.76, 256, 12, 22, 'start'], ['W. Molokaʻi', 1.90, 280, -12, -10, 'end'], ['Koʻolau', 2.6, 339, -12, -8, 'end'], ['Waiʻanae', 3.7, 374, 12, 22, 'start'], ['Kauaʻi', 5.1, 519, -12, -8, 'end']];
  const HS = { v: +(store.get('hspd') || 6), fit: null };
  const hx = (a) => 70 + a / 6 * 550, hy = (d) => 300 - d / 600 * 270;
  function bestFit() { const n = HAW.length, ma = HAW.reduce((s, p) => s + p[1], 0) / n, md = HAW.reduce((s, p) => s + p[2], 0) / n; let sxy = 0, sxx = 0; HAW.forEach((p) => { sxy += (p[1] - ma) * (p[2] - md); sxx += (p[1] - ma) * (p[1] - ma); }); const b = sxy / sxx; return { b, a: md - b * ma }; }
  function drawHot() {
    const svg = $('#eaHot'), kmMyr = HS.v * 10;
    let h = '';
    for (let a = 0; a <= 6; a++) { h += `<line x1="${hx(a)}" x2="${hx(a)}" y1="30" y2="300" stroke="${T.line}" stroke-width="0.7"/>` + tx(hx(a), 324, a, { fs: 18, anchor: 'middle', fill: T.muted, halo: false }); }
    for (let d = 0; d <= 600; d += 100) { h += `<line x1="70" x2="620" y1="${hy(d)}" y2="${hy(d)}" stroke="${T.line}" stroke-width="0.7"/>` + tx(62, hy(d) + 6, d, { fs: 18, anchor: 'end', fill: T.muted, halo: false }); }
    h += tx(620, 348, 'Age of oldest lava (million years)', { fs: 18, anchor: 'end', fill: T.muted, halo: false });
    h += tx(8, 18, 'Distance from Kīlauea (km)', { fs: 18, fill: T.muted, halo: false });
    // the user's line through the hotspot (origin)
    const aEnd = Math.min(6, 600 / kmMyr);
    h += `<line x1="${hx(0)}" y1="${hy(0)}" x2="${fx(hx(aEnd), 1)}" y2="${fx(hy(aEnd * kmMyr), 1)}" stroke="${T.accent}" stroke-width="3"/>`;
    h += `<circle cx="${fx(hx(aEnd), 1)}" cy="${fx(hy(aEnd * kmMyr), 1)}" r="9" fill="${T.accent}" stroke="${T.bg}" stroke-width="2.5"/>`;
    if (HS.fit) { const { a, b } = HS.fit; h += `<line x1="${hx(0)}" y1="${fx(hy(a), 1)}" x2="${hx(6)}" y2="${fx(hy(a + 6 * b), 1)}" stroke="${T.fg}" stroke-width="2" stroke-dasharray="7 6"/>`; }
    HAW.forEach(([n, a, d, dx, dy, an]) => { h += `<circle cx="${fx(hx(a), 1)}" cy="${fx(hy(d), 1)}" r="6.5" fill="${T.p}" stroke="${T.bg}" stroke-width="2"/>` + tx(hx(a) + dx, hy(d) + dy, n, { fs: 18, anchor: an }); });
    svg.innerHTML = h;
    const rms = Math.sqrt(HAW.reduce((s, p) => s + Math.pow(p[2] - kmMyr * p[1], 2), 0) / HAW.length);
    $('#eaSpdOut').textContent = fx(HS.v, 1) + ' cm/yr';
    const rows = [['Your line', `${fx(HS.v, 1)} cm/yr = ${n0(kmMyr)} km per million years`], ['Average miss', `${n0(rms)} km`]];
    if (HS.fit) rows.push(['Best fit (dashed)', `${fx(HS.fit.b / 10, 1)} cm/yr`]);
    facts($('#eaHotOut'), rows);
  }

  function initVolcano() {
    const si = $('#eaSi'); si.value = VO.si;
    si.addEventListener('input', () => { VO.si = +si.value; store.set('si', VO.si); showVol(); drawVol(); });
    const loop = makeLoop('volcano', $('#eaVol'), (dt) => {
      VO.t += dt;
      const sp = 120 / Math.pow(10, (logVis(VO.si) - 1) / 2.2);
      VO.bub.forEach((b, i) => { b.y -= sp * dt * (0.7 + 0.6 * rnd(i)); if (b.y < 48) { b.y = 266; b.x = 40 + Math.random() * 110; } });
      drawVol();
    });
    loop.play = !reduce;
    showVol(); drawVol();
    seg($('#eaVeiBtns'), VEI.map((v, i) => [String(i), String(i)]), String(VO.vei), (k) => { VO.vei = +k; drawVei(); });
    $('#eaVei').addEventListener('click', (e) => { const g = e.target.closest('[data-v]'); if (g) { VO.vei = +g.dataset.v; drawVei(); } });
    drawVei();
    // hotspot
    const sp = $('#eaSpd'); sp.value = HS.v;
    sp.addEventListener('input', () => { HS.v = +sp.value; store.set('hspd', HS.v); drawHot(); });
    $('#eaFit').addEventListener('click', () => { HS.fit = bestFit(); drawHot(); });
    $('#eaFitClear').addEventListener('click', () => { HS.fit = null; drawHot(); });
    const hot = $('#eaHot');
    let drag = false;
    const setFrom = (e) => { const [x, y] = svgPt(hot, e), a = (x - 70) / 550 * 6, d = (300 - y) / 270 * 600; if (a > 0.3 && d > 0) { HS.v = clamp(Math.round(d / a / 10 * 10) / 10, +sp.min, +sp.max); sp.value = HS.v; store.set('hspd', HS.v); drawHot(); } };
    hot.addEventListener('pointerdown', (e) => { drag = true; hot.setPointerCapture(e.pointerId); setFrom(e); });
    hot.addEventListener('pointermove', (e) => { if (drag) setFrom(e); });
    hot.addEventListener('pointerup', () => { drag = false; });
    hot.addEventListener('pointercancel', () => { drag = false; });
    drawHot();
    redraw.volcano = () => { drawVol(); drawVei(); drawHot(); };
  }
})();
