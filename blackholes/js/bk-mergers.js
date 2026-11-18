/* Stellar Life — Black holes, tab 3 "Mergers": chirp generator, orbit animation, detector bands, area theorem */
(function () {
  'use strict';
  const B = window.BK, { $, C, el, txt, fit, sig, sci, sciH, mSun, facts, clamp } = B;
  const TAU = Math.PI * 2;
  const PRE = [
    { k: 'gw150914', label: 'GW150914', m1: 36, m2: 29, z: 0.09, note: '<p class="h">Published (LIGO 2016)</p><p class="nm">GW150914</p><p>36 + 29 → 62 M☉, with 3.0 ± 0.5 M☉ radiated, about 1.3 billion light-years away. The first detection, 14 September 2015; Nobel Prize 2017.</p>' },
    { k: 'gw170817', label: 'GW170817', m1: 1.48, m2: 1.26, z: 0.01, note: '<p class="h">Published (LIGO–Virgo 2017)</p><p class="nm">GW170817: two neutron stars</p><p>Chirp mass 1.188 M☉ (well measured); the two masses, about 1.36–1.60 and 1.17–1.36 M☉, are not, so 1.48 + 1.26 is one pair that fits, 130 million light-years away. A gamma-ray burst followed 1.7 s later, then a kilonova seen by about 70 observatories, forging gold and platinum. The black hole ringdown sketched here does not apply: the stars touched and merged before reaching the ISCO frequency.</p>' },
    { k: 'gw190521', label: 'GW190521', m1: 85, m2: 66, z: 0.82, note: '<p class="h">Published (LIGO–Virgo 2020)</p><p class="nm">GW190521</p><p>85 + 66 → 142 M☉, about 8 M☉ radiated: the first intermediate-mass black hole seen forming. So heavy that only about four cycles fell in the detectors\' band; the signal lasted a tenth of a second.</p><p class="bk-why">Its holes were spinning and probably precessing, so the non-spinning fit above misses the published remnant by a few M☉.</p>' },
    { k: 'gw250114', label: 'GW250114', m1: 33.6, m2: 32.2, z: 0.09, note: '<p class="h">Published (LIGO–Virgo–KAGRA 2025)</p><p class="nm">GW250114</p><p>33.6 + 32.2 → 62.7 M☉, final spin 0.68. Signal-to-noise ratio about 80, the clearest signal yet, thanks to quieter detectors. It confirmed Hawking\'s area theorem and showed two ringdown tones consistent with a Kerr black hole.</p>' },
    { k: 'lisa', label: 'LISA pair', m1: 1e6, m2: 1e6, note: '<p class="h">Example</p><p class="nm">Two 1-million-M☉ black holes</p><p>The kind of merger LISA is built for, after galaxies merge. Its signal sits in LISA\'s band for months and could be seen from across the universe.</p>' },
    { k: 'pta', label: 'PTA pair', m1: 1e9, m2: 1e9, note: '<p class="h">Example</p><p class="nm">Two 1-billion-M☉ black holes</p><p>Pairs this heavy spend millions of years at nanohertz frequencies. Pulsar timing arrays hear the combined hum of many such pairs, all still spiralling in.</p>' },
  ];
  const st = { l1: +$('#bkM1').value, l2: +$('#bkM2').value, p: 0, preset: 'gw150914' };

  function model(m1in, m2in) {
    const m1 = Math.max(m1in, m2in), m2 = Math.min(m1in, m2in), M = m1 + m2, eta = m1 * m2 / (M * M), Mc = Math.pow(eta, 0.6) * M;
    const Ms = M * C.tSun, Tc = Mc * C.tSun;
    const tau = (f) => 5 / 256 * Math.pow(Tc, -5 / 3) * Math.pow(Math.PI * f, -8 / 3);
    const fOf = (t) => Math.pow(5 / 256 / t, 3 / 8) * Math.pow(Tc, -5 / 8) / Math.PI;
    const phi = (t) => 2 * Math.pow(t / (5 * Tc), 5 / 8); // GW phase before coalescence (leading order)
    const fisco = 1 / (Math.pow(6, 1.5) * Math.PI * Ms);
    const chi = 2 * Math.sqrt(3) * eta - 3.454 * eta * eta + 2.353 * eta ** 3;        // Rezzolla et al. 2008 (ApJL 674, L29), non-spinning limit
    const erad = 0.05719 * eta + 0.5435 * eta * eta;                                  // Barausse, Morozova & Rezzolla 2012, non-spinning
    const Mf = M * (1 - erad);
    const F = 1.5251 - 1.1568 * Math.pow(1 - chi, 0.1292), Q = 0.7 + 1.4187 * Math.pow(1 - chi, -0.499); // Berti, Cardoso & Will 2006 (l=m=2, n=0)
    const fring = F / (TAU * Mf * C.tSun), tdamp = Q / (Math.PI * fring);
    const area = (m, a) => 8 * Math.PI * Math.pow(m * C.GMsun / (C.c * C.c), 2) * (1 + Math.sqrt(1 - a * a));
    return { m1, m2, M, eta, Mc, Ms, Tc, tau, fOf, phi, fisco, chi, erad, Mf, fring, tdamp, Ai: area(m1, 0) + area(m2, 0), Af: area(Mf, chi) };
  }
  const cur = () => model(Math.pow(10, st.l1), Math.pow(10, st.l2));

  // waveform samples for the last 8 inspiral cycles, merger and ringdown
  function wave(md) {
    const ti = md.tau(md.fisco), xi = Math.pow(ti / (5 * md.Tc), 5 / 8), xs = xi + 8 * Math.PI, ts = 5 * md.Tc * Math.pow(xs, 8 / 5);
    const tm = 0.8 / md.fisco, tend = tm + 6 * md.tdamp, t0 = -(ts - ti);
    const N = 2400, out = []; let ph = 0, prev = t0;
    const Ai = Math.pow(md.fisco, 2 / 3), Ap = 1.45 * Ai;
    for (let i = 0; i <= N; i++) {
      const t = t0 + (tend - t0) * i / N; let f, A;
      if (t <= 0) { f = md.fOf(ti - t); A = Math.pow(f, 2 / 3); }
      else if (t <= tm) { const s = t / tm, u = s * s * (3 - 2 * s); f = md.fisco + (md.fring - md.fisco) * u; A = Ai + (Ap - Ai) * Math.sin(Math.PI / 2 * s); }
      else { f = md.fring; A = Ap * Math.exp(-(t - tm) / md.tdamp); }
      ph += TAU * f * (t - prev); prev = t;
      out.push({ t, f, A: A / Ap, h: (A / Ap) * Math.cos(ph), ph });
    }
    return { pts: out, t0, tm, tend };
  }
  function tUnit(span) { if (span < 1) return [1e3, 'ms']; if (span < 120) return [1, 's']; if (span < 7200) return [1 / 60, 'min']; if (span < 172800) return [1 / 3600, 'h']; return [1 / 86400, 'days']; }
  let W = null;
  const waveSvg = $('#bkWave');
  let cursor = null, wmap = null;
  function drawWaveFig() {
    const md = cur(); W = wave(md);
    const { w, h, fs, sm } = fit(waveSvg, (w, fs) => fs * 3.4 + 216 + fs * 2.6);
    const g = el(waveSvg, 'g'), x0 = 16, x1 = w - 16, X = B.linMap(W.t0, W.tend, x0, x1);
    const top = fs * 3.4, mid = top + 100, Y = B.linMap(-1.1, 1.1, mid + 100, mid - 100);
    const xm = X(0), xp = X(W.tm);
    el(g, 'rect', { x: xm, y: top - 4, width: xp - xm, height: 208, fill: 'var(--accent)', 'fill-opacity': 0.1 });
    el(g, 'rect', { x: xp, y: top - 4, width: x1 - xp, height: 208, fill: 'var(--bk-isco)', 'fill-opacity': 0.08 });
    [xm, xp].forEach((x) => el(g, 'line', { x1: x, y1: top - 4, x2: x, y2: top + 204, stroke: 'var(--faint)', 'stroke-dasharray': '3 4' }));
    el(g, 'line', { x1: x0, y1: mid, x2: x1, y2: mid, class: 'bk-grid' });
    let d = '', e1 = '', e2 = '';
    W.pts.forEach((p, i) => { const x = X(p.t).toFixed(1); d += (i ? 'L' : 'M') + x + ',' + Y(p.h).toFixed(1); e1 += (i ? 'L' : 'M') + x + ',' + Y(p.A).toFixed(1); e2 += (i ? 'L' : 'M') + x + ',' + Y(-p.A).toFixed(1); });
    el(g, 'path', { d: e1, fill: 'none', stroke: 'var(--faint)', 'stroke-dasharray': '2 4' });
    el(g, 'path', { d: e2, fill: 'none', stroke: 'var(--faint)', 'stroke-dasharray': '2 4' });
    el(g, 'path', { d, fill: 'none', stroke: 'var(--bk-wave)', 'stroke-width': 2 });
    txt(g, (x0 + xm) / 2, fs * 1.2, 'Inspiral', { fs, anchor: 'middle', w: 700 });
    txt(g, x1, fs * 1.2, 'Ringdown →', { fs, anchor: 'end', w: 700, fill: 'var(--bk-isco)', cls: 'bk-t' });
    txt(g, xm + (xp - xm) / 2 - 4, fs * 2.55, 'Merger ↓', { fs, anchor: 'end', w: 700, fill: 'var(--accent)', cls: 'bk-t' });
    // time axis
    const span = W.tend - W.t0, [k, u] = tUnit(span), ax = top + 208;
    el(g, 'line', { x1: x0, y1: ax, x2: x1, y2: ax, class: 'bk-axis' });
    const step = niceStep(span * k / (w >= 560 ? 8 : 6));
    for (let v = Math.ceil(W.t0 * k / step) * step; v <= W.tend * k + 1e-9; v += step) {
      const x = X(v / k); el(g, 'line', { x1: x, y1: ax, x2: x, y2: ax + 5, class: 'bk-axis' });
      txt(g, x, ax + 5 + sm, sig(v, 3) === '-0' ? '0' : sig(v, 3).replace('-', '−'), { fs: sm, cls: 'bk-m', anchor: 'middle', halo: false });
    }
    txt(g, x1, ax + 5 + sm * 2.2, `Time from the innermost stable orbit, ${u} →`, { fs: sm, cls: 'bk-m', anchor: 'end', halo: false });
    txt(g, x0, ax + 5 + sm * 2.2, 'Strain h (sketch, shape only)', { fs: sm, cls: 'bk-m', halo: false });
    cursor = el(g, 'line', { y1: top - 4, y2: top + 204, stroke: 'var(--fg)', 'stroke-width': 1.5, opacity: 0.8 });
    wmap = X; setCursor();
    const box = waveSvg.parentElement;
    if (box.scrollWidth > box.clientWidth + 2) box.scrollLeft = clamp((xm + x1) / 2 - box.clientWidth * 0.6, 0, box.scrollWidth - box.clientWidth);
    void h;
  }
  function niceStep(x) { const p = Math.pow(10, Math.floor(Math.log10(x))), m = x / p; return (m < 1.5 ? 1 : m < 3.5 ? 2 : m < 7.5 ? 5 : 10) * p; }

  /* orbit view */
  const orbSvg = $('#bkOrbit');
  let ob = null;
  function drawOrbitFig() {
    const { w, h, fs, sm } = fit(orbSvg, (w) => Math.min(500, w * 0.98));
    const g = el(orbSvg, 'g'), cx = w / 2, cy = h / 2 - 6;
    ob = { g, w, cx, cy, R: Math.min(w / 2, h / 2 - 14) - 6 };
    ob.trail = el(g, 'g', { fill: 'none', 'stroke-linecap': 'round' });
    ob.a = el(g, 'circle', { fill: 'var(--bk-hor)', stroke: 'var(--bk-ph)', 'stroke-width': 2 });
    ob.b = el(g, 'circle', { fill: 'var(--bk-hor)', stroke: 'var(--bk-ph)', 'stroke-width': 2 });
    ob.lab = txt(g, 8, h - 8, '', { fs: sm, cls: 'bk-m' });
    placeOrbit();
    void fs;
  }
  function stateAt(p) { if (!W) return null; const i = clamp(Math.round(p * (W.pts.length - 1)), 0, W.pts.length - 1); return W.pts[i]; }
  // positions of the two holes (CSS px) at a waveform sample during inspiral and merger
  function posAt(md, s, k) {
    const fo = s.t <= 0 ? s.f : md.fisco, sep = Math.pow(Math.PI * md.Ms * fo, -2 / 3) * (s.t <= 0 ? 1 : 1 - 0.7 * s.t / W.tm);
    const r1 = sep * md.m2 / md.M * k, r2 = sep * md.m1 / md.M * k, th = s.ph / 2, c = Math.cos(th), sn = Math.sin(th);
    return [ob.cx + r1 * c, ob.cy - r1 * sn, ob.cx - r2 * c, ob.cy + r2 * sn];
  }
  // fading trail: the last three quarters of an orbit, drawn in chunks that fade with age
  function drawTrail(md, k) {
    while (ob.trail.firstChild) ob.trail.removeChild(ob.trail.firstChild);
    const i0 = clamp(Math.round(st.p * (W.pts.length - 1)), 0, W.pts.length - 1), s0 = W.pts[i0];
    if (s0.t > W.tm) return;
    const pts = [];
    for (let i = i0; i >= 0 && s0.ph - W.pts[i].ph < 3 * Math.PI; i -= 2) pts.push(posAt(md, W.pts[i], k));
    if (pts.length < 3) return;
    const NC = 8, per = Math.ceil(pts.length / NC);
    for (let c = 0; c < NC; c++) {
      const seg = pts.slice(c * per, Math.min(pts.length, (c + 1) * per + 1));
      if (seg.length < 2) break;
      const op = (0.75 * (1 - c / NC)).toFixed(2);
      [0, 2].forEach((j) => el(ob.trail, 'path', { d: seg.map((q, n) => (n ? 'L' : 'M') + q[j].toFixed(1) + ',' + q[j + 1].toFixed(1)).join(''), stroke: 'var(--bk-ph)', 'stroke-width': 1.6, 'stroke-opacity': op }));
    }
  }
  function placeOrbit() {
    if (!ob || !W) return;
    const md = cur(), s = stateAt(st.p);
    const sep0 = Math.pow(Math.PI * md.Ms * W.pts[0].f, -2 / 3); // separation at window start, in GM/c²
    // scale: the starting separation spans about 70% of the box width, as long as both orbits (and the holes) fit
    const ext = Math.max(sep0 * md.m2 / md.M + 2 * md.m1 / md.M, sep0 * md.m1 / md.M + 2 * md.m2 / md.M);
    const k = Math.min(0.7 * ob.w / sep0, ob.R / ext);
    drawTrail(md, k);
    if (s.t <= W.tm) {
      const [ax, ay, bx, by] = posAt(md, s, k);
      ob.a.setAttribute('cx', ax); ob.a.setAttribute('cy', ay); ob.a.setAttribute('r', Math.max(3, 2 * md.m1 / md.M * k));
      ob.b.setAttribute('cx', bx); ob.b.setAttribute('cy', by); ob.b.setAttribute('r', Math.max(3, 2 * md.m2 / md.M * k));
      ob.b.style.display = '';
      ob.lab.textContent = s.t <= 0 ? `Inspiral · f = ${sig(s.f, 3)} Hz` : 'Merger';
    } else {
      const ring = 1 + 0.08 * Math.exp(-(s.t - W.tm) / md.tdamp) * Math.cos(s.ph);
      ob.a.setAttribute('cx', ob.cx); ob.a.setAttribute('cy', ob.cy); ob.a.setAttribute('r', Math.max(4, 2 * md.Mf / md.M * k * ring));
      ob.b.style.display = 'none';
      ob.lab.textContent = `Ringdown · f = ${sig(md.fring, 3)} Hz`;
    }
  }
  function setCursor() { if (cursor && W) { const s = stateAt(st.p), x = wmap(s.t).toFixed(1); cursor.setAttribute('x1', x); cursor.setAttribute('x2', x); } }
  const anim = B.loop(waveSvg.closest('.gx-block'), (dt) => { st.p += dt / 7; if (st.p > 1.08) st.p = 0; setCursor(); placeOrbit(); });
  anim.set(false);
  const playBtn = $('#bkGwPlay');
  const syncBtn = () => { playBtn.textContent = anim.playing ? 'Pause' : 'Play'; playBtn.setAttribute('aria-pressed', String(anim.playing)); };
  playBtn.addEventListener('click', () => { anim.set(!anim.playing); st.playing = anim.playing; syncBtn(); });
  if (B.reduce) st.p = 0.97;

  /* frequency bands */
  const bandSvg = $('#bkBands');
  function drawBands() {
    const md = cur();
    const { w, h, fs, sm } = fit(bandSvg, (w, fs) => fs * 2.2 + 70 + fs * 2.4 + 3 * fs * 1.6 + 16);
    const g = el(bandSvg, 'g'), x0 = 16, x1 = w - 16, X = B.linMap(-9, 4, x0, x1);
    const top = fs * 2.2, by0 = top, by1 = top + 40, ty = top + 56, ax = top + 70;
    [[-9, -7, 'Pulsar timing arrays', 'var(--bk-ergo)'], [-4, 0, 'LISA (2030s)', 'var(--bk-hot)'], [1, 3.7, 'LIGO · Virgo · KAGRA', 'var(--bk-isco)']].forEach(([a, b, n, c]) => {
      el(g, 'rect', { x: X(a), y: by0, width: X(b) - X(a), height: by1 - by0, rx: 6, fill: c, 'fill-opacity': 0.22, stroke: c });
      txt(g, clamp((X(a) + X(b)) / 2, B.tw(n, sm) / 2 + 2, w - B.tw(n, sm) / 2 - 2), top - 8, n, { fs: sm, anchor: 'middle', w: 600 });
    });
    // source track: from 1,000 years before merger to the ringdown
    const fA = md.fOf(1000 * C.yr + md.tau(md.fisco)), fZ = md.fring;
    const xA = X(clamp(Math.log10(fA), -9, 4)), xZ = X(clamp(Math.log10(fZ), -9, 4));
    el(g, 'line', { x1: xA, y1: ty, x2: xZ, y2: ty, stroke: 'var(--accent)', 'stroke-width': 4, 'stroke-linecap': 'round' });
    const bbox = bandSvg.parentElement;
    if (bbox.scrollWidth > bbox.clientWidth + 2) bbox.scrollLeft = clamp((xA + xZ) / 2 - bbox.clientWidth / 2, 0, bbox.scrollWidth - bbox.clientWidth);
    el(g, 'line', { x1: x0, y1: ax, x2: x1, y2: ax, class: 'bk-axis' });
    for (let e = -9; e <= 4; e++) { el(g, 'line', { x1: X(e), y1: ax, x2: X(e), y2: ax + 5, class: 'bk-axis' }); if (w >= 560 || e % 2 === 1 || e === 4) txt(g, X(e), ax + 5 + sm, B.pow10(e), { fs: sm, cls: 'bk-m', anchor: 'middle', halo: false }); }
    txt(g, x1, ax + 5 + sm * 2.2, 'Wave frequency, Hz →', { fs: sm, cls: 'bk-m', anchor: 'end', halo: false });
    const marks = [['1,000 yr', 1000 * C.yr], ['1 yr', C.yr], ['1 day', 86400], ['1 min', 60], ['1 s', 1]].map(([n, t]) => [n + ' left', Math.log10(md.fOf(t + md.tau(md.fisco)))]).filter(([, lf]) => lf < Math.log10(md.fisco) - 0.05);
    marks.push(['ISCO', Math.log10(md.fisco)], ['Ringdown', Math.log10(md.fring)]);
    const rowsY = [0, 1, 2].map((i) => ax + sm * 2.2 + fs * 1.7 + i * fs * 1.6), used = rowsY.map(() => []);
    const placed = [], boxes = [];
    marks.forEach(([n, lf]) => {
      if (lf < -9 || lf > 4) return;
      const x = X(lf), wd = B.tw(n, sm) + 8; let lx = clamp(x - wd / 2, 2, w - wd - 2), row = 0;
      for (; row < 3; row++) if (!used[row].some(([a, b]) => lx < b + 6 && lx + wd + 6 > a)) break;
      if (row > 2) return; used[row].push([lx, lx + wd]);
      placed.push([n, x, lx, wd, row]); boxes.push([lx + 2, lx + wd - 2, rowsY[row] - sm * 0.95, rowsY[row] + sm * 0.3]);
    });
    // the tick labels on the axis also block leader lines
    for (let e = -9; e <= 4; e++) boxes.push([X(e) - 14, X(e) + 14, ax + 5, ax + 5 + sm * 1.2]);
    boxes.push([x1 - B.tw('Wave frequency, Hz →', sm), x1, ax + 5 + sm * 1.3, ax + 5 + sm * 2.4]);
    placed.forEach(([n, x, lx, wd, row]) => {
      el(g, 'circle', { cx: x, cy: ty, r: 4, fill: 'var(--fg)', stroke: 'var(--surface)', 'stroke-width': 1.5 });
      B.vline(g, x, ty + 5, rowsY[row] - sm * 0.95 - 3, boxes, { stroke: 'var(--faint)', 'stroke-dasharray': '2 3' });
      txt(g, lx + wd / 2, rowsY[row], n, { fs: sm, anchor: 'middle' });
    });
    void h;
  }

  /* area theorem */
  const areaSvg = $('#bkArea');
  function drawArea() {
    const md = cur();
    const { w, h, fs, sm } = fit(areaSvg, (w, fs) => fs * 2 + 2 * fs * 3.4 + 8);
    const g = el(areaSvg, 'g'), x0 = 8, x1 = w - 90, X = B.linMap(0, md.Af * 1.05, x0, x1);
    txt(g, x0, fs, 'Total horizon area', { fs: sm, cls: 'bk-m', halo: false });
    [['Before: two horizons', md.Ai, 'var(--muted)'], ['After: one horizon', md.Af, 'var(--bk-isco)']].forEach(([n, v, c], i) => {
      const y = fs * 2 + i * fs * 3.4;
      txt(g, x0, y + fs * 0.9, n, { fs: sm, halo: false });
      el(g, 'rect', { x: x0, y: y + fs * 1.3, width: X(v) - x0, height: fs * 1.1, rx: 3, fill: c });
      txt(g, X(v) + 6, y + fs * 2.2, `${sci(v / 1e6, 2, 0.01, 1e6)} km²`, { fs: sm, mono: true, halo: false });
    });
    void h;
  }

  function readout() {
    const md = cur();
    $('#bkM1Out').innerHTML = mSun(Math.pow(10, st.l1)); $('#bkM2Out').innerHTML = mSun(Math.pow(10, st.l2));
    // time in band and wave cycles, for the detector band this pair's inspiral actually reaches
    const BD = md.fisco > 20 ? { lo: 20, hi: Infinity, n: 'band above 20 Hz (ground detectors)', none: 'never reaches 20 Hz' }
      : md.fisco > 1e-4 ? { lo: 1e-4, hi: 1, n: 'LISA band (10<sup>−4</sup> to 1 Hz)', none: 'never reaches 10<sup>−4</sup> Hz' }
        : { lo: 1e-9, hi: 1e-7, n: 'pulsar-timing band (10<sup>−9</sup> to 10<sup>−7</sup> Hz)', none: 'never reaches 10<sup>−9</sup> Hz' };
    const ns = Math.min(Math.pow(10, st.l1), Math.pow(10, st.l2)) < 3;
    const pz = PRE.find((x) => x.k === st.preset), z = (pz && pz.z) || 0, zs = 1 + z;
    let inB, inBand, cyc;
    const cycTo = (fa, fb) => (Math.pow(md.tau(fa) / (5 * md.Tc), 5 / 8) - Math.pow(md.tau(fb) / (5 * md.Tc), 5 / 8)) / Math.PI;
    if (md.fisco > 20) {
      // ground detectors hear f_det = f/(1 + z): count from 20 Hz at the detector, i.e. 20(1 + z) Hz at the source
      const fl = 20 * zs; inBand = 0; cyc = 0;
      if (md.fisco > fl) { inBand += md.tau(fl) - md.tau(md.fisco); cyc += cycTo(fl, md.fisco); }
      if (!ns) { // merger sweep (as sketched) and two ringdown damping times, where above 20 Hz at the detector
        const tm = 0.8 / md.fisco, N = 400;
        for (let i = 0; i < N; i++) { const u = (i + 0.5) / N, f = md.fisco + (md.fring - md.fisco) * u * u * (3 - 2 * u); if (f >= fl) { inBand += tm / N; cyc += f * tm / N; } }
        if (md.fring >= fl) { inBand += 2 * md.tdamp; cyc += 2 * md.fring * md.tdamp; }
      }
      inBand *= zs; inB = inBand > 0;
      BD.n = `band above 20 Hz, detector frame (${pz && pz.z ? 'z = ' + z : 'z = 0 for your own pair'}; ${ns ? 'inspiral' : 'to 2 ringdown damping times'})`;
    } else {
      const fTop = Math.min(BD.hi, md.fisco); inB = md.fisco > BD.lo;
      inBand = inB ? md.tau(BD.lo) - md.tau(fTop) : 0;
      cyc = inB ? cycTo(BD.lo, fTop) : 0;
    }
    const who = md.fisco > 10 ? 'LIGO · Virgo · KAGRA' : md.fisco > 0.1 ? 'Between bands (proposed deci-hertz detectors)' : md.fring > 1e-4 ? 'LISA' : 'None; pulsar timing arrays hear such pairs long before';
    facts($('#bkGwFacts'), [
      ['Total mass M', mSun(md.M)],
      ['Chirp mass ℳ', mSun(md.Mc)],
      ['Wave frequency at the ISCO', `${sciH(md.fisco, 2, 0.01)} Hz`],
      ['Time in the ' + BD.n, inB ? B.secs(inBand) + (md.fisco > BD.hi ? ', then it leaves the band upward' : '') : BD.none],
      ['Wave cycles in that band', inB ? (cyc >= 1e5 ? sciH(cyc, 2) : sig(cyc, 3)) : '0'],
      [ns ? 'Final mass (if a black hole forms)' : 'Final black hole (fit)', `${mSun(md.Mf)}, spin ${md.chi.toFixed(2)}`],
      ['Energy radiated as waves', `${mSun(md.M - md.Mf)} = ${sciH((md.M - md.Mf) * C.Msun * C.c * C.c, 1)} J`],
      ns ? ['Ringdown tone', 'Not applicable (neutron stars; remnant collapsed late or not at all)'] : ['Ringdown tone, source frame (the detector hears it lower by 1 + z)', `${sciH(md.fring, 2, 0.01)} Hz, fades in ${B.secs(md.tdamp)}` + (z ? `; ${sciH(md.fring / zs, 2, 0.01)} Hz at the detector` : '')],
      ['Who can hear the merger', who],
    ]);
    const pct = (md.Af / md.Ai - 1) * 100;
    facts($('#bkAreaFacts'), [
      ['Area before (sum)', `${sciH(md.Ai / 1e6, 2)} km²`],
      ['Area after', `${sciH(md.Af / 1e6, 2)} km²`],
      ['Change', `<b>+${pct.toFixed(0)}%</b>, while mass fell ${(md.erad * 100).toFixed(1)}%`],
    ]);
    const p = PRE.find((x) => x.k === st.preset);
    const fitNote = p && /^gw/.test(p.k) ? '<p class="bk-why">The calculator\'s readouts come from this page\'s non-spinning fit, so they can differ a little from the published values, which come from models with spinning and precessing black holes.</p>' : '';
    $('#bkGwNote').innerHTML = p ? p.note + fitNote : `<p class="h">Your pair</p><p class="nm">${B.bigWords(Math.pow(10, st.l1))} + ${B.bigWords(Math.pow(10, st.l2))} M☉</p><p>${ns ? 'A mass below about 3 M☉ is likely a neutron star, so the merger and ringdown sketch does not apply to it.' : 'Mass ratio ' + sig(md.m1 / md.m2, 3) + ' : 1. The more unequal the masses, the less energy is radiated and the slower the remnant spins.'}</p><p class="bk-why">Your own pair is treated as nearby (z = 0), so the detector hears the source-frame frequencies unchanged.</p>`;
  }
  const drawWave = B.figure(waveSvg, drawWaveFig), drawOrbit = B.figure(orbSvg, drawOrbitFig), drawB = B.figure(bandSvg, drawBands), drawA = B.figure(areaSvg, drawArea);
  const preSet = B.seg($('#bkGwSeg'), PRE.map((p) => ({ k: p.k, label: p.label })), (k) => {
    const p = PRE.find((x) => x.k === k); st.preset = k; st.l1 = Math.log10(p.m1); st.l2 = Math.log10(p.m2);
    $('#bkM1').value = st.l1; $('#bkM2').value = st.l2; update();
  }, { init: st.preset });
  // before Play, start where three quarters of an orbit lie behind, so a static trail shows
  function pTrail() { if (!W) return 0; const ph0 = W.pts[0].ph, i = W.pts.findIndex((q) => q.ph - ph0 >= 3 * Math.PI); return i > 0 ? i / (W.pts.length - 1) : 0; }
  function update() { stopAudio(); W = wave(cur()); if (!st.playing && st.p < 0.5) st.p = pTrail(); readout(); audioNote(); drawWave(); drawOrbit(); drawB(); drawA(); placeOrbit(); }
  $('#bkM1').addEventListener('input', (e) => { st.l1 = +e.target.value; st.preset = null; preSet(null); update(); });
  $('#bkM2').addEventListener('input', (e) => { st.l2 = +e.target.value; st.preset = null; preSet(null); update(); });
  syncBtn(); st.l1 = Math.log10(36); st.l2 = Math.log10(29); $('#bkM1').value = st.l1; $('#bkM2').value = st.l2; W = wave(cur()); if (!B.reduce) st.p = pTrail(); readout();

  /* listen: the chirp as sound. Real pitch when the real signal is audible (ground-detector events), otherwise shifted up */
  const AU = { ctx: null, src: null, gain: null };
  const lisBtn = $('#bkGwListen'), audNote = $('#bkGwAudioNote');
  function audioPlan(md) {
    const real = md.fisco > 25 && md.fring < 16000;              // already in the audio band
    const k = real ? 1 : 400 / md.fisco;                          // frequency scale (time runs 1/k as long)
    const fStart = real ? 25 : 50;                                // played start frequency, Hz
    const tIsco = md.tau(md.fisco);
    let pre = (md.tau(fStart / k) - tIsco) / k;                   // played seconds of inspiral
    pre = Math.min(pre, 3.2);
    const ns = md.m2 < 3;
    return { real, k, pre, tIsco, ns, tm: ns ? 0 : 0.8 / md.fisco / k, td: md.tdamp / k, fr: md.fring * k, fi: md.fisco * k };
  }
  function audioNote() {
    if (!audNote) return;
    const md = cur(), pl = audioPlan(md);
    audNote.innerHTML = pl.real
      ? `Listen plays the <b>real pitch</b> (source frame, z = 0): a ground-detector signal is already a sound wave's frequency (from ${sig(Math.max(25, md.fOf(pl.tIsco + pl.pre)), 2)} Hz, about ${sig(md.fisco, 2)} Hz at the ISCO${pl.ns ? ', where it stops: neutron stars have no black hole ringdown' : `, ${sig(md.fring, 2)} Hz in the ringdown sketch`}). Low notes may be faint on small speakers.`
      : `Listen plays this signal <b>shifted to audible pitch</b>: every frequency × ${sciH(pl.k, 2)} and time ÷ the same factor, so its shape is kept. The real wave is far below hearing (${sciH(md.fisco, 2, 0.01)} Hz at the ISCO).`;
  }
  function buildBuffer(ctx, md) {
    const pl = audioPlan(md), sr = ctx.sampleRate, dur = pl.pre + (pl.ns ? 0.03 : pl.tm + 6 * pl.td) + 0.05, N = Math.ceil(dur * sr);
    const buf = ctx.createBuffer(1, N, sr), d = buf.getChannelData(0);
    const Ai = Math.pow(pl.fi, 2 / 3), Ap = 1.45 * Ai;
    let ph = 0, peak = 0;
    for (let i = 0; i < N; i++) {
      const t = i / sr - pl.pre; let f, A;                        // t = 0 at the ISCO (played seconds)
      if (t <= 0) { f = md.fOf(pl.tIsco - t * pl.k) * pl.k; A = Math.pow(f, 2 / 3); }
      else if (t <= pl.tm) { const u = t / pl.tm, v = u * u * (3 - 2 * u); f = pl.fi + (pl.fr - pl.fi) * v; A = Ai + (Ap - Ai) * Math.sin(Math.PI / 2 * u); }
      else if (pl.ns) { f = pl.fi; A = Ai * Math.exp(-t / 0.01); }
      else { f = pl.fr; A = Ap * Math.exp(-(t - pl.tm) / pl.td); }
      ph += 2 * Math.PI * f / sr;
      const fade = Math.min(1, (i / sr) / 0.08, (N - i) / sr / 0.03); // soft start and end
      d[i] = (A / Ap) * fade * Math.sin(ph); peak = Math.max(peak, Math.abs(d[i]));
    }
    if (peak > 0) for (let i = 0; i < N; i++) d[i] *= 0.8 / peak;
    return buf;
  }
  function stopAudio() {
    if (AU.src) { try { AU.src.onended = null; AU.src.stop(); } catch (e) { /* already stopped */ } AU.src = null; }
    if (lisBtn) { lisBtn.textContent = 'Listen'; lisBtn.setAttribute('aria-pressed', 'false'); }
  }
  function playAudio() {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) { if (audNote) audNote.textContent = 'This browser cannot play sound.'; return; }
    try {
      if (!AU.ctx) { AU.ctx = new AC(); AU.gain = AU.ctx.createGain(); AU.gain.gain.value = 0.35; AU.gain.connect(AU.ctx.destination); }
      if (AU.ctx.state === 'suspended') AU.ctx.resume();
      const src = AU.ctx.createBufferSource(); src.buffer = buildBuffer(AU.ctx, cur()); src.connect(AU.gain);
      src.onended = () => { if (AU.src === src) stopAudio(); };
      src.start(); AU.src = src;
      lisBtn.textContent = 'Stop'; lisBtn.setAttribute('aria-pressed', 'true');
    } catch (e) { stopAudio(); }
  }
  if (lisBtn) {
    lisBtn.addEventListener('click', () => { if (AU.src) stopAudio(); else playAudio(); });
    document.addEventListener('visibilitychange', () => { if (document.hidden) stopAudio(); });
    if ('IntersectionObserver' in window) new IntersectionObserver((es) => es.forEach((e) => { if (!e.isIntersecting) stopAudio(); })).observe(lisBtn.closest('.gx-block'));
    ['bkM1', 'bkM2'].forEach((id) => $('#' + id).addEventListener('input', stopAudio));
  }
  audioNote();
  window.BKmergers = { model, st, wave, audioPlan };
})();
