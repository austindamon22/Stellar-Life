/* Stellar Life — Black holes, tab 1 "What they are": Kerr radii calculator, mass ladder, spaghettification */
(function () {
  'use strict';
  const B = window.BK, { $, C, el, txt, fit, sig, sci, sciH, mSun, lenKm, facts, Kerr, clamp } = B;
  const TAU = Math.PI * 2;
  const st = { logM: +$('#bkMass').value, a: +$('#bkSpin').value, th: [0.6, 2.4] };
  const M = () => Math.pow(10, st.logM);
  const kmT = (km) => (km < 1 ? sig(km * 1000, 3) + ' m' : km < 1e6 ? sig(km, 3) + ' km' : sci(km, 2) + ' km');

  const OBJ = [
    { k: 'cyg', name: 'Cygnus X-1', m: 21.2, d: 'The first object widely accepted as a black hole (early 1970s): 21 M☉, orbiting a blue supergiant star every 5.6 days, about 7,000 light-years away. Mass from Miller-Jones et al. (2021).' },
    { k: 'gaia', name: 'Gaia BH3', m: 33, d: 'A dormant black hole of 33 M☉ found in 2024 from the wobble of its companion star in Gaia data, about 1,900 light-years away. The most massive stellar black hole known in our galaxy.' },
    { k: 'gw15', name: 'GW150914 remnant', m: 62, d: 'Made when black holes of 36 and 29 M☉ merged about 1.3 billion years ago: the first gravitational-wave event ever detected (LIGO, 14 September 2015).' },
    { k: 'gw19', name: 'GW190521 remnant', m: 142, d: 'Made from 85 + 66 M☉: the clearest intermediate-mass black hole. Single stars are not expected to leave an 85 M☉ black hole (the pair-instability gap), so that one may itself be the product of an earlier merger.' },
    { k: 'sgr', name: 'Sgr A*', m: 4.3e6, d: 'At the centre of the Milky Way, 27,000 light-years away. Its mass comes from stars orbiting it, tracked since the 1990s (Nobel Prize 2020 for Genzel and Ghez). Imaged by the EHT in 2022.' },
    { k: 'm87', name: 'M87*', m: 6.5e9, d: 'In the giant elliptical galaxy M87, 55 million light-years away. The first black hole ever imaged (EHT, April 2019). Its jet stretches about 5,000 light-years.' },
    { k: 'ton', name: 'TON 618', m: 4e10, d: 'A very bright quasar whose light left it 10.8 billion years ago. About 40 billion M☉, estimated from the width of its emission lines; another line gives 66 billion. Uncertain by a large factor, like all masses this big.' },
  ];
  const CLASSES = [
    { k: 'stellar', lo: Math.log10(3), hi: 2, name: 'Stellar-mass', c: 'var(--bk-stellar)', d: 'About 3 to 100 M☉, left by massive stars. The Milky Way may hold around 100 million of them, almost all dark and unseen.' },
    { k: 'imbh', lo: 2, hi: 5, name: 'Intermediate-mass', c: 'var(--bk-imbh)', d: 'About 100 to 100,000 M☉. Long missing; the 142 M☉ remnant of GW190521 is the clearest case. Candidates hide in dense star clusters and dwarf galaxies.' },
    { k: 'smbh', lo: 5, hi: 10.8, name: 'Supermassive', c: 'var(--bk-smbh)', d: 'From about 100,000 to tens of billions of M☉. One sits at the centre of nearly every large galaxy, and its mass tracks the galaxy\'s central bulge.' },
  ];
  const PRESETS = [['cyg', 'Cyg X-1'], ['gw15', 'GW150914'], ['sgr', 'Sgr A*'], ['m87', 'M87*'], ['ton', 'TON 618']];

  /* ---------- rings ---------- */
  const ringsSvg = $('#bkRings');
  let dots = null;
  function rings() {
    const a = st.a, spin = a >= 0.001;
    const items = [
      { k: 'hor', name: 'Event horizon r₊', r: Kerr.horizon(a), c: 'var(--fg)', fill: 'var(--bk-hor)' },
      { k: 'ergo', name: 'Ergosphere edge, equator', r: 2, c: 'var(--bk-ergo)', dash: '2 5', show: spin },
      { k: 'php', name: spin ? 'Photon orbit, with the spin' : 'Photon sphere (light orbits)', r: Kerr.photon(a, true), c: 'var(--bk-ph)' },
      { k: 'phr', name: 'Photon orbit, against the spin', r: Kerr.photon(a, false), c: 'var(--bk-ph)', dash: '8 6', show: spin },
      { k: 'iscop', name: spin ? 'ISCO, with the spin' : 'ISCO (innermost stable orbit)', r: Kerr.isco(a, true), c: 'var(--bk-isco)' },
      { k: 'iscor', name: 'ISCO, against the spin', r: Kerr.isco(a, false), c: 'var(--bk-isco)', dash: '8 6', show: spin },
    ].filter((i) => i.show !== false);
    const wide = (ringsSvg.getBoundingClientRect().width || 600) >= 560;
    let rowH = 0;
    const { w, h, fs, sm } = fit(ringsSvg, (w, fs) => { rowH = fs * 2.55; return w >= 560 ? clamp(w - Math.min(270, w * 0.44), 330, 440) : w * 0.9 + (items.length + 1) * fs * 2.55 + 6; });
    rowH = fs * 2.55;
    let cx, cy, R, lx, ly;
    if (wide) { const LW = Math.min(270, w * 0.44); R = Math.min((w - LW) / 2 - 12, h / 2 - 12); cx = (w - LW) / 2; cy = h / 2; lx = w - LW + 8; ly = Math.max(14, (h - (items.length + 1) * rowH) / 2) + fs; }
    else { R = Math.min(w / 2 - 10, w * 0.45 - 6); cx = w / 2; cy = w * 0.45; lx = 10; ly = w * 0.9 + fs + 4; }
    const s = R / 9.3; // radii up to 9 GM/c²
    const g = el(ringsSvg, 'g');
    // faint reference grid: circles every 1 rₛ (2 GM/c²)
    for (let r = 2; r <= 9; r += 2) el(g, 'circle', { cx, cy, r: r * s, class: 'bk-grid', 'stroke-width': 1 });
    el(g, 'line', { x1: cx - 9.2 * s, y1: cy, x2: cx + 9.2 * s, y2: cy, class: 'bk-grid' });
    [...items].reverse().forEach((it) => {
      if (it.fill) el(g, 'circle', { cx, cy, r: it.r * s, fill: it.fill, stroke: it.c, 'stroke-width': 1.5 });
      else el(g, 'circle', { cx, cy, r: it.r * s, fill: 'none', stroke: it.c, 'stroke-width': 2.2, 'stroke-dasharray': it.dash });
    });
    if (spin) { // spin arrow inside the horizon
      const r = Kerr.horizon(a) * s * 0.55, a0 = -0.3, a1 = 3.6;
      const p = (t) => [cx + r * Math.cos(t), cy - r * Math.sin(t)];
      const [x0, y0] = p(a0), [x1, y1] = p(a1);
      el(g, 'path', { d: `M${x0},${y0} A${r},${r} 0 1 0 ${x1},${y1}`, fill: 'none', stroke: 'var(--muted)', 'stroke-width': 1.6 });
      const t = a1, tx = -Math.sin(t), ty = -Math.cos(t);
      el(g, 'path', { d: `M${x1 + tx * 6},${y1 + ty * 6} L${x1 - ty * 4 - tx * 2},${y1 + tx * 4 - ty * 2} L${x1 + ty * 4 - tx * 2},${y1 - tx * 4 - ty * 2}Z`, fill: 'var(--muted)' });
    }
    // orbiting test particles
    dots = { cx, cy, s, rp: Kerr.isco(a, true), rr: Kerr.isco(a, false), spin };
    dots.p = el(g, 'circle', { r: 5, fill: 'var(--bk-isco)', stroke: 'var(--surface)', 'stroke-width': 1.5 });
    dots.q = spin ? el(g, 'circle', { r: 5, fill: 'var(--surface)', stroke: 'var(--bk-isco)', 'stroke-width': 2 }) : null;
    placeDots();
    // legend
    const rs = C.rsSun * M() / 1000;
    items.forEach((it, i) => {
      const y = ly + i * rowH;
      el(g, 'line', { x1: lx, y1: y - fs * 0.35, x2: lx + 24, y2: y - fs * 0.35, stroke: it.c, 'stroke-width': it.fill ? 6 : 2.4, 'stroke-dasharray': it.dash });
      txt(g, lx + 32, y, it.name, { fs, halo: false });
      txt(g, lx + 32, y + fs * 1.15, `${(it.r / 2).toFixed(2)} rₛ · ${kmT(it.r / 2 * rs)}`, { fs: sm, cls: 'bk-m', mono: true, halo: false });
    });
    txt(g, lx, ly + items.length * rowH + fs * 0.2, `Drawn to scale · rings every 1 rₛ`, { fs: sm, cls: 'bk-m', halo: false });
  }
  function placeDots() {
    if (!dots) return;
    const { cx, cy, s } = dots;
    dots.p.setAttribute('cx', (cx + dots.rp * s * Math.cos(st.th[0])).toFixed(1)); dots.p.setAttribute('cy', (cy - dots.rp * s * Math.sin(st.th[0])).toFixed(1));
    if (dots.q) { dots.q.setAttribute('cx', (cx + dots.rr * s * Math.cos(st.th[1])).toFixed(1)); dots.q.setAttribute('cy', (cy - dots.rr * s * Math.sin(st.th[1])).toFixed(1)); }
  }
  const orb = B.loop(ringsSvg, (dt) => {
    if (!dots) return; const a = st.a, k = 23;
    st.th[0] += dt * k / (Math.pow(dots.rp, 1.5) + a);           // prograde: angular velocity dφ/dt = 1/(r^1.5 + a)
    st.th[1] -= dt * k / (Math.pow(dots.rr, 1.5) - a);           // retrograde
    placeDots();
  });
  const playBtn = $('#bkOrbPlay');
  const syncPlay = () => { playBtn.textContent = orb.playing ? 'Pause orbits' : 'Play orbits'; playBtn.setAttribute('aria-pressed', String(orb.playing)); };
  playBtn.addEventListener('click', () => { orb.set(!orb.playing); syncPlay(); });
  syncPlay();

  function density(m) { const r = C.rsSun * m; return m * C.Msun / (4 / 3 * Math.PI * r * r * r); }
  function densWord(rho) {
    if (rho > 2.3e17) return 'denser than an atomic nucleus';
    if (rho > 1e9) return 'denser than a white dwarf';
    if (rho > 1000) return 'denser than water';
    if (rho > 1.2) return 'less dense than water';
    return 'less dense than air';
  }
  function tideAt(m, r) { return 2 * C.GMsun * m * 2 / Math.pow(r, 3); } // m/s² across 2 m at radius r (m)
  function readout() {
    const m = M(), a = st.a, rs = C.rsSun * m / 1000;
    $('#bkMassOut').innerHTML = mSun(m);
    $('#bkSpinOut').textContent = a.toFixed(3);
    const tg = tideAt(m, C.rsSun * m) / 9.80665, rho = density(m);
    facts($('#bkBasicFacts'), [
      ['Mass', `${sciH(m * C.Msun, 2)} kg`],
      ['Schwarzschild radius r<sub>s</sub>', lenKm(rs)],
      ['Horizon r₊ at this spin', `${(Kerr.horizon(a) / 2).toFixed(3)} r<sub>s</sub>`],
      ['Photon orbit (with / against spin)', a < 0.001 ? '1.500 r<sub>s</sub>' : `${(Kerr.photon(a, true) / 2).toFixed(2)} / ${(Kerr.photon(a, false) / 2).toFixed(2)} r<sub>s</sub>`],
      ['ISCO (with / against spin)', a < 0.001 ? '3.000 r<sub>s</sub> = 6 GM/c²' : `${(Kerr.isco(a, true) / 2).toFixed(3)} / ${(Kerr.isco(a, false) / 2).toFixed(2)} r<sub>s</sub>`],
      ['Energy released by gas reaching the ISCO', `${(Kerr.eta(a) * 100).toFixed(1)}% of its mass`],
      ['Mean density inside r<sub>s</sub>', `${sciH(rho, 2)} kg/m³, ${densWord(rho)}`],
      ['Head-to-foot stretch at r<sub>s</sub> (2 m)', `${sciH(tg, 1)} g`],
    ].concat(a > 0.99 ? [['Near maximal spin', 'The horizon, photon orbit and ISCO crowd together in these radii, but the real (proper) distances between them stay apart: space near the hole is stretched']] : []));
  }

  /* ---------- ladder ---------- */
  const ladSvg = $('#bkLadder');
  let ladSel = 'cyg';
  function ladder() {
    const rowsN = 4;
    const { w, h, fs, sm } = fit(ladSvg, (w, fs) => fs * 2.2 + fs * 2.4 + 12 + fs * 2 + rowsN * fs * 1.6 + 22);
    const x0 = 22, x1 = w - 22, X = B.linMap(0, 11, x0, x1);
    const g = el(ladSvg, 'g');
    const yMark = fs * 1.3, yb0 = fs * 2.2, yb1 = yb0 + fs * 2.4, yAx = yb1 + 12;
    CLASSES.forEach((c) => {
      const hit = el(g, 'g', { class: 'bk-hit', role: 'button', tabindex: 0, 'aria-label': c.name + ' black holes' });
      el(hit, 'rect', { x: X(c.lo), y: yb0, width: X(c.hi) - X(c.lo), height: yb1 - yb0, rx: 6, fill: c.c, 'fill-opacity': ladSel === c.k ? 0.38 : 0.2, stroke: c.c, 'stroke-width': ladSel === c.k ? 2 : 1, class: 'bk-focus' });
      const label = (X(c.hi) - X(c.lo)) > B.tw(c.name, fs) + 10 ? c.name : c.name.split('-')[0];
      txt(hit, (X(c.lo) + X(c.hi)) / 2, (yb0 + yb1) / 2 + fs * 0.35, label, { fs, anchor: 'middle', w: 600 });
      bindHit(hit, () => pickLadder(c.k));
    });
    el(g, 'line', { x1: x0, y1: yAx, x2: x1, y2: yAx, class: 'bk-axis', 'stroke-width': 1.5 });
    for (let e = 0; e <= 11; e++) {
      el(g, 'line', { x1: X(e), y1: yAx, x2: X(e), y2: yAx + 6, class: 'bk-axis' });
      txt(g, e === 0 ? X(e) - 4 : X(e), yAx + 6 + fs, e === 0 ? '1 M☉' : B.pow10(e), { fs: sm, cls: 'bk-m', anchor: e === 0 ? 'start' : 'middle', halo: false });
    }
    // object labels in rows, greedy
    const rowsY = Array.from({ length: rowsN }, (_, i) => yAx + fs * 3.6 + i * fs * 1.6);
    const used = rowsY.map(() => []), placed = [], boxes = [];
    OBJ.forEach((o) => {
      const x = X(Math.log10(o.m)), wd = B.tw(o.name, sm) + 10;
      let lx = clamp(x - wd / 2, 2, w - wd - 2), row = 0;
      for (; row < rowsN; row++) if (!used[row].some(([a, b]) => lx < b + 6 && lx + wd + 6 > a)) break;
      row = Math.min(row, rowsN - 1); used[row].push([lx, lx + wd]);
      placed.push([o, x, lx, wd, row]); boxes.push([lx + 3, lx + wd - 3, rowsY[row] - sm * 0.95, rowsY[row] + sm * 0.3]);
    });
    for (let e = 0; e <= 11; e++) boxes.push(e === 0 ? [X(0) - 4, X(0) - 4 + B.tw('1 M☉', sm), yAx + 7, yAx + 6 + fs * 1.25] : [X(e) - 11, X(e) + 11, yAx + 7, yAx + 6 + fs * 1.25]);
    placed.forEach(([o, x, lx, wd, row]) => {
      const hit = el(g, 'g', { class: 'bk-hit', role: 'button', tabindex: 0, 'aria-label': `${o.name}, ${B.bigWords(o.m)} solar masses` });
      B.vline(hit, x, yAx, rowsY[row] - sm * 0.95 - 3, boxes, { stroke: 'var(--faint)', 'stroke-width': 1 });
      el(hit, 'circle', { cx: x, cy: yAx, r: ladSel === o.k ? 6.5 : 5, fill: ladSel === o.k ? 'var(--accent)' : 'var(--fg)', stroke: 'var(--surface)', 'stroke-width': 1.5, class: 'bk-focus' });
      txt(hit, lx + wd / 2, rowsY[row], o.name, { fs: sm, anchor: 'middle', w: ladSel === o.k ? 600 : 400 });
      bindHit(hit, () => pickObj(o.k));
    });
    // current mass marker
    const xm = X(st.logM);
    // drawn above and below the band, not across its label
    el(g, 'line', { x1: xm, y1: yMark + 4, x2: xm, y2: yb0, stroke: 'var(--accent)', 'stroke-width': 2 });
    el(g, 'line', { x1: xm, y1: yb1, x2: xm, y2: yAx, stroke: 'var(--accent)', 'stroke-width': 2 });
    el(g, 'path', { d: `M${(xm - 5).toFixed(1)},${(yb0 - 6).toFixed(1)}L${(xm + 5).toFixed(1)},${(yb0 - 6).toFixed(1)}L${xm.toFixed(1)},${yb0.toFixed(1)}Z`, fill: 'var(--accent)' });
    const lbl = 'Calculator: ' + B.bigWords(M()).replace(/<[^>]+>/g, '') + ' M☉';
    const lw = B.tw(lbl, sm);
    txt(g, clamp(xm, x0 + lw / 2, x1 - lw / 2), yMark, lbl, { fs: sm, anchor: 'middle', fill: 'var(--accent)', cls: 'bk-t', w: 600 });
  }
  function bindHit(n, fn) { n.addEventListener('click', fn); n.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fn(); } }); }
  function ladderOut() {
    const o = OBJ.find((x) => x.k === ladSel), c = CLASSES.find((x) => x.k === ladSel);
    const cls = o ? CLASSES.find((k) => Math.log10(o.m) >= k.lo && Math.log10(o.m) < k.hi) : c;
    $('#bkLadderOut').innerHTML = o ? `<p class="h">${cls.name} · ${mSun(o.m)}</p><p class="nm">${o.name}</p><p>${o.d}</p>` : `<p class="h">Class</p><p class="nm">${c.name} black holes</p><p>${c.d}</p>`;
  }
  function pickLadder(k) { ladSel = k; ladderOut(); drawLadder(); }
  function pickObj(k) { const o = OBJ.find((x) => x.k === k); ladSel = k; setMass(Math.log10(o.m)); presetSet(PRESETS.some((p) => p[0] === k) ? k : null); ladderOut(); }

  /* ---------- tides ---------- */
  const tideSvg = $('#bkTide');
  const TPRE = [['10', 10, '10 M☉'], ['1e3', 1e3, '1,000 M☉'], ['1e5', 1e5, '100,000 M☉'], ['sgr', 4.3e6, 'Sgr A*'], ['m87', 6.5e9, 'M87*']];
  const td = { m: 10, x: +$('#bkTideR').value };
  const G0 = 9.80665;
  function tide() {
    const { w, h, fs, sm } = fit(tideSvg, (w) => (w >= 560 ? 320 : 300));
    const g = el(tideSvg, 'g');
    const rM = C.rsSun * td.m * td.x, da = tideAt(td.m, rM), dg = da / G0, lg = Math.log10(dg);
    // scene
    const sceneH = h - 116, cy = sceneH / 2 + 8, Rb = Math.min(sceneH * 0.42, w * 0.2), bx = 14 - Rb * 0.25;
    el(g, 'circle', { cx: bx, cy, r: Rb, fill: 'var(--bk-hor)', stroke: 'var(--muted)', 'stroke-width': 1.5 });
    txt(g, bx + Rb * 0.55, cy - Rb - 8 > fs ? cy - Rb - 8 : cy + Rb + fs + 4, 'Horizon', { fs: sm, cls: 'bk-m', anchor: 'middle' });
    const gap = (td.x - 1) / 19, x0 = bx + Rb + 10 + gap * (w - bx - Rb - 220);
    const stretch = 1 + clamp((lg + 1) / 9, 0, 1) * 1.7, L = 64 * stretch, thin = 1 / Math.sqrt(stretch);
    const pg = el(g, 'g', { transform: `translate(${x0.toFixed(1)},${cy}) scale(1,${thin.toFixed(3)})` });
    const col = dg > 10 ? 'var(--bk-bad)' : 'var(--fg)';
    // feet at x=0 (toward hole), head at x=L
    el(pg, 'path', { d: `M0,-7 L${L * 0.42},-2 M0,7 L${L * 0.42},2 M${L * 0.42},0 L${L * 0.84},0 M${L * 0.74},0 L${L * 0.56},-16 M${L * 0.74},0 L${L * 0.56},16`, stroke: col, 'stroke-width': 4, 'stroke-linecap': 'round', fill: 'none' });
    el(pg, 'circle', { cx: L * 0.84 + 9, cy: 0, r: 9, fill: col });
    // arrows
    const al = clamp((lg + 4) / 14, 0.05, 1) * 70;
    const arrow = (xa, dir) => {
      const xb = xa + dir * al;
      el(g, 'line', { x1: xa, y1: cy, x2: xb, y2: cy, stroke: 'var(--accent)', 'stroke-width': 3 });
      el(g, 'path', { d: `M${xb + dir * 8},${cy} L${xb},${cy - 6} L${xb},${cy + 6}Z`, fill: 'var(--accent)' });
    };
    arrow(x0 - 6, -1); arrow(x0 + L * 0.84 + 24, 1);
    const lab = `Stretch: ${sci(dg, 1, 0.01, 1e4)} g`;
    txt(g, clamp(x0 + L * 0.42, B.tw(lab, fs) / 2 + 4, w - B.tw(lab, fs) / 2 - 4), cy - 34, lab, { fs, anchor: 'middle', w: 600 });
    txt(g, clamp(x0 + L * 0.42, 60, w - 60), cy + 44, `${sig(td.x, 3)} rₛ from the centre`, { fs: sm, cls: 'bk-m', anchor: 'middle' });
    // gauge
    const gy = h - 62, gx0 = 34, gx1 = w - 34, X = B.linMap(-8, 10, gx0, gx1);
    const zones = [[-8, -1, 'var(--bk-good)'], [-1, 1, 'var(--bk-ph)'], [1, 10, 'var(--bk-bad)']];
    zones.forEach(([a, b, c]) => el(g, 'rect', { x: X(a), y: gy, width: X(b) - X(a), height: 12, fill: c, 'fill-opacity': 0.35 }));
    el(g, 'rect', { x: gx0, y: gy, width: gx1 - gx0, height: 12, fill: 'none', stroke: 'var(--line)', rx: 2 });
    const ticks = w >= 560 ? [-8, -6, -4, -2, 0, 2, 4, 6, 8, 10] : [-8, -4, 0, 4, 8];
    ticks.forEach((e) => { el(g, 'line', { x1: X(e), y1: gy + 12, x2: X(e), y2: gy + 17, class: 'bk-axis' }); txt(g, X(e), gy + 17 + sm, e === 0 ? '1 g' : B.pow10(e) + ' g', { fs: sm, cls: 'bk-m', anchor: 'middle', halo: false }); });
    txt(g, X(-4.5), gy + 17 + sm * 2.3, 'not felt', { fs: sm, cls: 'bk-m', anchor: 'middle', halo: false });
    txt(g, X(5.5), gy + 17 + sm * 2.3, 'torn apart', { fs: sm, cls: 'bk-m', anchor: 'middle', halo: false });
    const xm = X(clamp(lg, -8, 10));
    el(g, 'path', { d: `M${xm},${gy - 2} L${xm - 7},${gy - 13} L${xm + 7},${gy - 13}Z`, fill: 'var(--accent)', stroke: 'var(--surface)', 'stroke-width': 1 });
    tideOut(da, dg, rM);
  }
  function tideOut(da, dg, rM) {
    const r10 = Math.cbrt(2 * C.GMsun * td.m * 2 / (10 * G0)), rs = C.rsSun * td.m;
    $('#bkTideROut').innerHTML = `${sig(td.x, 3)} r<sub>s</sub>`;
    facts($('#bkTideFacts'), [
      ['Mass', mSun(td.m)],
      ['Distance from the centre', lenKm(rM / 1000)],
      ['Stretch, head to feet', `${sciH(da, 2)} m/s² = ${sciH(dg, 2)} g`],
      ['Stretch reaches 10 g at', `${sig(r10 / rs, 3)} r<sub>s</sub>`],
      ['Verdict', r10 > rs ? '<b>Torn apart before the horizon</b>' : '<b>Crosses the horizon intact</b> (torn apart later, deeper in)'],
      ['Longest time from horizon to centre (πGM/c³)', B.secs(Math.PI * C.tSun * td.m)],
    ]);
  }

  /* ---------- wiring ---------- */
  const drawRings = B.figure(ringsSvg, rings), drawLadder = B.figure(ladSvg, ladder), drawTide = B.figure(tideSvg, tide);
  const presetSet = B.seg($('#bkPresets'), PRESETS.map(([k, l]) => ({ k, label: l })), (k) => pickObj(k), { init: 'cyg' });
  function setMass(lm) { st.logM = lm; $('#bkMass').value = lm; readout(); drawRings(); drawLadder(); }
  $('#bkMass').addEventListener('input', (e) => { st.logM = +e.target.value; presetSet(null); readout(); drawRings(); drawLadder(); });
  $('#bkSpin').addEventListener('input', (e) => { st.a = +e.target.value; readout(); drawRings(); });
  const tSet = B.seg($('#bkTideSeg'), TPRE.map(([k, , l]) => ({ k, label: l })), (k) => { td.m = TPRE.find((p) => p[0] === k)[1]; drawTide(); }, { init: '10' });
  $('#bkTideR').addEventListener('input', (e) => { td.x = +e.target.value; drawTide(); });
  pickObj('cyg');
  window.BKbasics = { st, td, tideAt, density, setMass, tSet };
})();
