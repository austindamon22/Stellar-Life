/* Stellar Life — Black holes, tab 2 "Feeding": nesting diagram, AGN engine and spectrum, Eddington calculator, quasar era */
(function () {
  'use strict';
  const B = window.BK, { $, $$, C, el, txt, fit, sig, sci, sciH, mSun, facts, Kerr, clamp } = B;
  const bindHit = (n, fn) => { n.addEventListener('click', fn); n.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fn(); } }); };

  /* ---------- nesting ---------- */
  const NEST = {
    all: { name: 'All black holes', d: 'Every object whose mass lies inside its own event horizon, from about 3 M☉ up (or smaller, if primordial black holes exist). Most are dark and alone, with nothing to feed on.' },
    smbh: { name: 'Supermassive black holes', d: 'Black holes of about 100,000 M☉ and up, at the centres of nearly all large galaxies. Most of the time they are quiet. Our own Sgr A* shines at far less than a millionth of its Eddington limit.' },
    agn: { name: 'Active galactic nuclei (AGN)', d: 'A supermassive black hole fed with enough gas to glow: from roughly 10<sup>35</sup> W to more than 10<sup>40</sup> W (the Sun gives 3.8 × 10<sup>26</sup> W). The names below overlap: they describe brightness, viewing angle and jets, not separate species.' },
    quasar: { name: 'Quasar', sub: 'the brightest', d: 'The most luminous AGN, outshining their whole host galaxy so they look like stars ("quasi-stellar"). 3C 273, identified by Maarten Schmidt in 1963, is the nearest bright one, about 2.4 billion light-years away. Only about one in ten is radio-loud.' },
    seyfert: { name: 'Seyfert galaxy', sub: 'modest, host visible', d: 'A fainter AGN in a galaxy whose stars still show, usually a spiral (Carl Seyfert, 1943). Type 1 shows broad emission lines; in Type 2 the dusty torus hides the broad-line clouds, a key clue to the unified picture.' },
    blazar: { name: 'Blazar', sub: 'jet aimed at us', d: 'An AGN with a jet pointing within a few degrees of us. Relativistic beaming boosts the jet\'s light and speeds up its changes, so blazars can flicker within minutes. They dominate the gamma-ray sky.' },
    radio: { name: 'Radio galaxy', sub: 'jets seen side-on', d: 'Jets seen from the side, feeding giant lobes of radio emission. Cygnus A\'s lobes span nearly 500,000 light-years; Porphyrion\'s, found in 2024, about 23 million light-years, the largest known.' },
    liner: { name: 'LINER', sub: 'the faintest', d: 'Low-ionisation nuclear emission-line region (Heckman 1980): the weakest kind of activity, common in nearby galaxies. Many are lit by a slowly feeding black hole; in some, old hot stars or shocks may do it instead. Still debated.' },
  };
  const CHIPS = ['quasar', 'seyfert', 'blazar', 'radio', 'liner'];
  let nestSel = 'agn';
  const nestSvg = $('#bkNest');
  function nest() {
    let cols = 5;
    const { w, h, fs, sm } = fit(nestSvg, (w, fs) => { cols = Math.max(3, Math.min(5, Math.floor((w - 140) / 150))); const rows = Math.ceil(5 / cols); return 8 + fs * 2.3 * 3 + rows * (fs * 3.4 + 10) + 3 * 14; });
    const rows = Math.ceil(5 / cols), pad = 16, head = fs * 2.3, chipH = fs * 3.4;
    const g = el(nestSvg, 'g');
    const box = (k, x, y, ww, hh, fill) => {
      const hit = el(g, 'g', { class: 'bk-hit', role: 'button', tabindex: 0, 'aria-label': NEST[k].name });
      const on = nestSel === k;
      el(hit, 'rect', { x, y, width: ww, height: hh, rx: 12, fill, 'fill-opacity': on ? 0.3 : 0.14, stroke: on ? 'var(--accent)' : 'var(--line)', 'stroke-width': on ? 2.5 : 1.2, class: 'bk-focus' });
      txt(hit, x + 14, y + fs * 1.45, NEST[k].name, { fs, w: 600 });
      bindHit(hit, () => pickNest(k));
      return hit;
    };
    let x = 4, y = 4, ww = w - 8, hh = h - 8;
    box('all', x, y, ww, hh, 'var(--bk-stellar)');
    x += pad; y += head; ww -= 2 * pad; hh -= head + 14;
    box('smbh', x, y, ww, hh, 'var(--bk-smbh)');
    x += pad; y += head; ww -= 2 * pad; hh -= head + 14;
    box('agn', x, y, ww, hh, 'var(--bk-blr)');
    const cx0 = x + pad, cw = (ww - 2 * pad - (cols - 1) * 10) / cols;
    CHIPS.forEach((k, i) => {
      const r = Math.floor(i / cols), c = i % cols, cx = cx0 + c * (cw + 10), cy = y + head + r * (chipH + 10);
      const hit = el(g, 'g', { class: 'bk-hit', role: 'button', tabindex: 0, 'aria-label': NEST[k].name });
      const on = nestSel === k;
      el(hit, 'rect', { x: cx, y: cy, width: cw, height: chipH, rx: 8, fill: on ? 'var(--accent)' : 'var(--surface)', stroke: on ? 'var(--accent)' : 'var(--line)', 'stroke-width': 1.5, class: 'bk-focus' });
      txt(hit, cx + cw / 2, cy + fs * 1.4, NEST[k].name, { fs, anchor: 'middle', w: 600, halo: false, fill: on ? 'var(--accent-ink)' : undefined });
      txt(hit, cx + cw / 2, cy + fs * 2.65, NEST[k].sub, { fs: sm, anchor: 'middle', halo: false, cls: on ? 'bk-t' : 'bk-m', fill: on ? 'var(--accent-ink)' : undefined });
      bindHit(hit, () => pickNest(k));
    });
    void rows;
  }
  const nestSet = B.seg($('#bkNestSeg'), Object.keys(NEST).map((k) => ({ k, label: NEST[k].name.replace(' (AGN)', '') })), (k) => pickNest(k), { init: nestSel });
  function pickNest(k) {
    nestSel = k; nestSet(k); drawNest();
    const lvl = { all: 'Outer box', smbh: 'Inside: all black holes', agn: 'Inside: supermassive black holes' }[k] || 'A kind of AGN';
    $('#bkNestOut').innerHTML = `<p class="h">${lvl}</p><p class="nm">${NEST[k].name}</p><p>${NEST[k].d}</p>`;
  }

  /* ---------- engine ---------- */
  const PART = {
    disk: { name: 'Accretion disk', c: 'var(--bk-disk)', band: 'Visible and ultraviolet (the "big blue bump")', d: 'Gas orbits faster the closer in it is, so neighbouring rings rub against each other (through magnetic turbulence). The heat makes each ring glow at its own temperature. Around a 100-million-M☉ black hole the inner disk reaches about 100,000 K; around a stellar-mass one, millions of degrees, so it shines in X-rays.', size: 'Inner edge at the ISCO; most light from within about 100 r<sub>s</sub> (light-days across for 10<sup>8</sup> M☉).' },
    corona: { name: 'Corona', c: 'var(--bk-cor)', band: 'X-rays', d: 'A small, very hot cloud of electrons (around a billion kelvin) near the inner disk. Ultraviolet photons from the disk bounce off these fast electrons and gain energy each time (inverse Compton scattering), coming out as X-rays. What heats the corona is not fully known.', size: 'About 10 r<sub>s</sub>, judged from how fast the X-rays flicker and from X-ray echoes off the disk.' },
    blr: { name: 'Broad-line clouds', c: 'var(--bk-blr)', band: 'Emission lines in the ultraviolet and visible', d: 'Gas clouds lit by the disk glow in spectral lines of hydrogen, carbon and magnesium. They orbit at thousands of km/s, so Doppler shifts smear each line broad. Timing how long the lines take to echo a change in the disk (reverberation mapping) gives their distance; with their speed, that weighs the black hole.', size: 'Light-days to light-months from the centre.' },
    torus: { name: 'Dusty torus', c: 'var(--bk-tor)', band: 'Infrared', d: 'Farther out, where it is cool enough (below about 1,500 K) for dust to survive, a thick ring of dust absorbs ultraviolet and visible light and gives it out again as heat, in the infrared. Seen edge-on, it hides the disk and the broad-line clouds.', size: 'Starts around a light-year out for a bright AGN; several light-years across.' },
    jet: { name: 'Jets', c: 'var(--bk-jet)', band: 'Radio to gamma rays', d: 'Twisted magnetic fields, probably tapping the black hole\'s spin (Blandford &amp; Znajek 1977), fling plasma out at nearly the speed of light. Electrons spiralling in the field give synchrotron light, mostly radio; the same electrons kick photons up to gamma-ray energies by inverse Compton scattering.', size: 'From near the horizon out to hundreds of thousands of light-years.' },
  };
  let part = 'disk';
  const engSvg = $('#bkEngine');
  function engine() {
    const { w, h, fs, sm } = fit(engSvg, (w) => Math.max(300, w * 0.7));
    const g = el(engSvg, 'g'), cx = w / 2, cy = h / 2 + 6;
    const op = (k) => (part === k ? 1 : 0.38);
    const grp = (k) => { const n = el(g, 'g', { class: 'bk-hit', role: 'button', tabindex: 0, 'aria-label': PART[k].name, opacity: op(k) }); bindHit(n, () => pickPart(k)); return n; };
    // jets
    const jg = grp('jet');
    [-1, 1].forEach((s) => {
      el(jg, 'path', { d: `M${cx - 4},${cy + s * 8} L${cx - 15},${cy + s * (h / 2 - 8)} L${cx + 15},${cy + s * (h / 2 - 8)} L${cx + 4},${cy + s * 8}Z`, fill: PART.jet.c, 'fill-opacity': 0.55, stroke: PART.jet.c, class: 'bk-focus' });
      [0.45, 0.7, 0.88].forEach((f) => el(jg, 'circle', { cx, cy: cy + s * f * (h / 2 - 8), r: 4, fill: PART.jet.c }));
    });
    // torus
    const tg = grp('torus'), tx = Math.min(w * 0.36, w / 2 - 50), trx = Math.min(w * 0.11, 70), tryy = h * 0.13;
    [-1, 1].forEach((s) => el(tg, 'ellipse', { cx: cx + s * tx, cy, rx: trx, ry: tryy, fill: PART.torus.c, 'fill-opacity': 0.6, stroke: PART.torus.c, 'stroke-width': 2, class: 'bk-focus' }));
    // broad-line clouds
    const bg = grp('blr');
    const pts = [[-0.17, -0.09], [-0.12, -0.15], [-0.21, 0.08], [-0.1, 0.13], [0.11, -0.13], [0.18, -0.07], [0.15, 0.12], [0.22, 0.05], [-0.05, -0.19], [0.06, 0.18], [-0.23, -0.02], [0.24, -0.02]];
    pts.forEach(([a, b]) => el(bg, 'circle', { cx: cx + a * w * 0.9, cy: cy + b * h, r: 5, fill: PART.blr.c, class: 'bk-focus' }));
    // disk
    const dg = grp('disk'), dr = tx - trx - 12;
    el(dg, 'ellipse', { cx, cy, rx: dr, ry: 6, fill: PART.disk.c, 'fill-opacity': 0.55, class: 'bk-focus' });
    el(dg, 'ellipse', { cx, cy, rx: dr * 0.45, ry: 4.5, fill: PART.disk.c });
    // corona
    const cg = grp('corona');
    el(cg, 'ellipse', { cx, cy: cy - 9, rx: 34, ry: 14, fill: PART.corona.c, 'fill-opacity': 0.45, stroke: PART.corona.c, 'stroke-dasharray': '3 3', class: 'bk-focus' });
    // black hole
    el(g, 'circle', { cx, cy, r: 9, fill: 'var(--bk-hor)', stroke: 'var(--muted)', 'stroke-width': 1.2 });
    // labels (all, in fixed spots away from each other)
    const L = (k, x, y, a) => txt(g, x, y, PART[k].name, { fs: part === k ? fs : sm, anchor: a, w: part === k ? 700 : 400, cls: part === k ? 'bk-t' : 'bk-m' });
    L('jet', cx + 22, fs + 6, 'start');
    L('torus', cx + tx, cy + tryy + fs * 1.4, 'middle');
    L('disk', cx + dr * 0.55, cy + fs * 1.6, 'middle');
    L('corona', cx - 40, cy - 30, 'end');
    L('blr', cx - tx + trx * 0.2, cy - tryy - fs * 0.9, 'middle');
    txt(g, 8, h - 8, 'Side view · not to scale', { fs: sm, cls: 'bk-m' });
  }
  const sedSvg = $('#bkSed');
  const LINES = [15.39, 15.29, 15.03, 14.79, 14.66];
  const curve = {
    disk: (x) => Math.exp(-((x - 15.35) ** 2) / (2 * 0.5 ** 2)),
    corona: (x) => 0.5 * Math.exp(-((x - 18.3) ** 2) / (2 * 0.85 ** 2)),
    torus: (x) => 0.78 * Math.exp(-((x - 13.4) ** 2) / (2 * 0.42 ** 2)),
    blr: (x) => LINES.reduce((s, c, i) => s + (0.6 - i * 0.06) * Math.exp(-((x - c) ** 2) / (2 * 0.018 ** 2)), 0),
    jet: (x) => 0.42 * Math.exp(-((x - 12.3) ** 2) / (2 * 1.5 ** 2)) + 0.36 * Math.exp(-((x - 22.6) ** 2) / (2 * 1.5 ** 2)),
  };
  const PEAK = { disk: [15.35, 1, 'Disk: thermal'], corona: [18.3, 0.5, 'Corona: inverse Compton'], torus: [13.4, 0.78, 'Torus: warm dust'], blr: [15.39, 0.6, 'Broad emission lines'], jet: [12.3, 0.42, 'Jet: synchrotron'] };
  function sed() {
    const { w, h, fs, sm } = fit(sedSvg, (w, fs) => fs * 4.9 + 190 + fs * 2.9 + 10);
    const g = el(sedSvg, 'g'), x0 = 16, x1 = w - 16, X = B.linMap(8, 26, x0, x1);
    const yb = fs * 1.2, yb2 = yb + fs * 1.5, top = yb2 + fs * 2.2, bot = top + 190, Y = B.linMap(0, 1.3, bot, top);
    const BANDS = [[8, 11.5, 'Radio'], [11.5, 14.6, 'Infrared'], [14.6, 14.9, 'Visible'], [14.9, 16.5, 'Ultraviolet'], [16.5, 19.5, 'X-ray'], [19.5, 26, 'Gamma ray']];
    BANDS.forEach(([a, b, n], i) => {
      el(g, 'rect', { x: X(a), y: top - 4, width: X(b) - X(a), height: bot - top + 4, fill: i % 2 ? 'var(--surface-2)' : 'var(--surface)' });
      if (n === 'Visible') {
        el(g, 'rect', { x: X(a), y: top - 4, width: X(b) - X(a), height: 6, fill: 'url(#bkRainbow)' });
        txt(g, X((a + b) / 2), yb2 + fs * 0.9, n, { fs: sm, anchor: 'middle', cls: 'bk-m' });
        el(g, 'line', { x1: X((a + b) / 2), y1: yb2 + fs * 1.2, x2: X((a + b) / 2), y2: top - 4, stroke: 'var(--faint)' });
      } else txt(g, X((a + b) / 2), yb, n, { fs: sm, anchor: 'middle', cls: 'bk-m' });
    });
    const defs = el(sedSvg, 'defs'), lg = el(defs, 'linearGradient', { id: 'bkRainbow' });
    ['#d0342c', '#f28c28', '#f2d32a', '#3fae49', '#2f6fd6', '#7a3fd0'].forEach((c, i) => el(lg, 'stop', { offset: (i / 5).toFixed(2), 'stop-color': c }));
    el(g, 'line', { x1: x0, y1: bot, x2: x1, y2: bot, class: 'bk-axis', 'stroke-width': 1.5 });
    for (let e = 8; e <= 26; e += 2) { el(g, 'line', { x1: X(e), y1: bot, x2: X(e), y2: bot + 5, class: 'bk-axis' }); txt(g, X(e), bot + 5 + sm, B.pow10(e), { fs: sm, cls: 'bk-m', anchor: 'middle', halo: false }); }
    txt(g, x1, bot + 5 + sm * 2.3, 'Frequency in Hz →', { fs: sm, cls: 'bk-m', anchor: 'end', halo: false });
    txt(g, x0, bot + 5 + sm * 2.3, 'Schematic shapes, not data', { fs: sm, cls: 'bk-m', halo: false });
    const order = Object.keys(curve).filter((k) => k !== part).concat(part);
    order.forEach((k) => {
      let d = '';
      for (let i = 0; i <= 900; i++) { const x = 8 + 18 * i / 900, y = curve[k](x); d += (i ? 'L' : 'M') + X(x).toFixed(1) + ',' + Y(y).toFixed(1); }
      el(g, 'path', { d, fill: 'none', stroke: PART[k].c, 'stroke-width': k === part ? 3 : 1.5, 'stroke-opacity': k === part ? 1 : 0.45 });
    });
    const [px, py, pl] = PEAK[part];
    txt(g, clamp(X(px), B.tw(pl, fs) / 2 + 4, w - B.tw(pl, fs) / 2 - 4), Y(py) - 10, pl, { fs, anchor: 'middle', w: 700 });
    if (part === 'jet') txt(g, X(22.6), Y(0.36) - 10, 'Jet: inverse Compton', { fs, anchor: 'middle', w: 700 });
    void h;
  }
  const partSet = B.seg($('#bkPartSeg'), Object.keys(PART).map((k) => ({ k, label: `<span class="bk-sw" style="background:${PART[k].c}"></span>${PART[k].name}` })), (k) => pickPart(k), { init: part });
  function pickPart(k) {
    part = k; partSet(k); drawEngine(); drawSed();
    const p = PART[k];
    $('#bkPartOut').innerHTML = `<p class="h">Shines in: ${p.band}</p><p class="nm">${p.name}</p><p>${p.d}</p><p><b>Size:</b> ${p.size}</p>`;
  }

  /* ---------- Eddington ---------- */
  const eff = $('#bkEff');
  const ed = { lm: +$('#bkEM').value, lL: +$('#bkEL').value, a: +$('#bkEA').value };
  const tSal = C.sigT * C.c / (4 * Math.PI * C.G * C.mp) / C.yr; // 4.5e8 yr
  function eddCalc() {
    const m = Math.pow(10, ed.lm), L = Math.pow(10, ed.lL), eta = Kerr.eta(ed.a);
    const Ledd = C.LeddSun * m, mdot = L / (eta * C.c * C.c), mdotSun = mdot * C.yr / C.Msun;
    const rin = Kerr.isco(ed.a, true) * C.GMsun * m / (C.c * C.c);
    const T = Math.pow(3 * C.GMsun * m * mdot / (8 * Math.PI * C.sSB * rin ** 3) * 0.05665, 0.25);
    return { m, L, eta, Ledd, mdot, mdotSun, T, ratio: L / Ledd, te: eta / (1 - eta) * tSal };
  }
  function band(lam) { if (lam < 3e-9) return 'X-rays'; if (lam < 3e-8) return 'extreme ultraviolet / soft X-rays'; if (lam < 3.8e-7) return 'ultraviolet'; if (lam < 7.5e-7) return 'visible'; return 'infrared'; }
  function eddOut() {
    const r = eddCalc();
    $('#bkEMOut').innerHTML = mSun(r.m);
    $('#bkELOut').innerHTML = `${sciH(r.L, 2)} W`;
    $('#bkEAOut').textContent = `${ed.a.toFixed(3)} → η = ${(r.eta * 100).toFixed(1)}%`;
    const lam = 2.898e-3 / r.T;
    facts($('#bkEFacts'), [
      ['Eddington luminosity', `${sciH(r.Ledd, 2)} W`],
      ['Brightness / Eddington', `${r.ratio >= 0.1 && r.ratio < 10 ? r.ratio.toPrecision(3) : sciH(r.ratio, 2, 0.001)}${r.ratio > 1.005 ? ' <b>(above the limit)</b>' : ''}`],
      ['Gas swallowed', `${sciH(r.mdotSun, 2, 0.001)} M☉ per year`],
      ['Fusion would need', `${sig(r.eta / 0.007, 3)} × as much fuel`],
      r.ratio > 0.3
        ? ['Hottest part of the disk', `<span class="bk-off">${sciH(r.T, 2)} K, peaks in ${band(lam)}</span> <b>Thin-disk model not valid above about 0.3 L<sub>Edd</sub></b> (the disk puffs up into a slim / super-Eddington disk)`]
        : ['Hottest part of the disk', `${sciH(r.T, 2)} K, peaks in ${band(lam)}`],
      ['Mass doubles at the limit every', B.yrs(r.te * Math.LN2)],
      ['Compared with the Sun', `${sciH(r.L / 3.828e26, 2)} × its light`],
    ]);
    $$('#bkEFacts .bk-off').forEach((n) => n.closest('div').classList.add('bk-invalid'));
    drawEff();
  }
  function effChart() {
    const r = eddCalc();
    const rows = [['Fission (uranium-235)', 0.0009, 'var(--muted)'], ['Fusion (hydrogen → helium)', 0.007, 'var(--muted)'], [`Accretion, a* = ${ed.a.toFixed(3)}`, r.eta, 'var(--accent)'], ['Accretion, a* → 1 (limit)', 1 - 1 / Math.sqrt(3), 'var(--bk-isco)'], ['Matter + antimatter', 1, 'var(--bk-ergo)']];
    let rowH = 0;
    const { w, h, fs, sm } = fit(eff, (w, fs) => { rowH = fs * 2.9; return rows.length * fs * 2.9 + fs * 1.8 + 8; });
    rowH = fs * 2.9;
    const g = el(eff, 'g'), x0 = 8, x1 = w - 70, X = B.linMap(0, 1, x0, x1);
    txt(g, x0, fs, 'Share of rest-mass energy turned into energy', { fs: sm, cls: 'bk-m', halo: false });
    rows.forEach(([n, v, c], i) => {
      const y = fs * 1.8 + 8 + i * rowH;
      txt(g, x0, y + fs * 0.9, n, { fs: sm, halo: false });
      el(g, 'rect', { x: x0, y: y + fs * 1.25, width: Math.max(2, X(v) - x0), height: fs * 0.9, rx: 3, fill: c });
      txt(g, Math.max(x0 + 2, X(v)) + 6, y + fs * 2.0, v < 0.01 ? (v * 100).toFixed(2) + '%' : (v * 100).toFixed(1) + '%', { fs: sm, mono: true, halo: false });
    });
    void h;
  }

  /* ---------- quasar era ---------- */
  const ERA = [
    { k: 'peak', name: 'Quasar peak', z: 2.5, d: 'Bright quasars were most common around z ≈ 2 to 3, when galaxies were rich in gas and merging often. Since then their numbers have fallen by a factor of tens, as galaxies used up and heated their gas (Richards et al. 2006).' },
    { k: 'j0313', name: 'J0313–1806', z: 7.64, m: 1.6e9, d: 'The most distant quasar known when found (Wang et al. 2021): a black hole of about 1.6 billion M☉ already in place 670 million years after the Big Bang.' },
    { k: 'uhz1', name: 'UHZ1', z: 10.1, m: 4e7, d: 'Found in X-rays by Chandra behind a lensing galaxy cluster also seen by JWST (Bogdán et al. 2024). Its black hole, roughly 10<sup>7</sup> to 10<sup>8</sup> M☉, weighs about as much as all its galaxy\'s stars, as expected if it started as a heavy "direct-collapse" seed.' },
    { k: 'gnz11', name: 'GN-z11', z: 10.6, m: 1.6e6, d: 'A bright young galaxy whose spectrum suggests a feeding black hole of about 1.6 million M☉ (Maiolino et al. 2024). Some argue the lines come from stars instead; not settled.' },
    { k: 'lrd', name: 'Little red dots', z: 6.5, zr: [4, 9], d: 'Compact, very red sources JWST finds in large numbers, mostly 0.6 to 1.5 billion years after the Big Bang, then they fade away. Broad hydrogen lines suggest black holes, but they are weak in X-rays and barely vary. Proposed: dust-hidden AGN, or black holes wrapped in dense gas ("black hole stars"). No consensus yet.' },
  ];
  let eraSel = 'j0313', eraFocus = null;
  const eraSvg = $('#bkEra');
  function era() {
    const { w, h, fs, sm } = fit(eraSvg, (w, fs) => fs * 2.2 + 170 + fs * 3 + 3 * fs * 1.6 + 10);
    const g = el(eraSvg, 'g'), x0 = 18, x1 = w - 18, X = B.logMap(-1, Math.log10(13.8), x0, x1);
    const top = fs * 2.2, bot = top + 170, Y = B.linMap(0, 1.1, bot, top);
    // redshift axis on top
    el(g, 'line', { x1: x0, y1: top - 6, x2: x1, y2: top - 6, class: 'bk-axis' });
    [0, 0.5, 1, 2, 3, 5, 7, 10, 20].forEach((z) => { const x = X(B.ageAtZ(z)); if (x < x0 - 1) return; el(g, 'line', { x1: x, y1: top - 6, x2: x, y2: top - 11, class: 'bk-axis' }); txt(g, x, top - 14, 'z = ' + z, { fs: sm, cls: 'bk-m', anchor: 'middle', halo: false }); });
    // little red dots band, quasar peak band
    const lr = ERA[4], zr = lr.zr;
    el(g, 'rect', { x: X(B.ageAtZ(zr[1])), y: top, width: X(B.ageAtZ(zr[0])) - X(B.ageAtZ(zr[1])), height: bot - top, fill: 'var(--bk-blr)', 'fill-opacity': eraSel === 'lrd' ? 0.22 : 0.09 });
    el(g, 'rect', { x: X(B.ageAtZ(3)), y: top, width: X(B.ageAtZ(2)) - X(B.ageAtZ(3)), height: bot - top, fill: 'var(--accent)', 'fill-opacity': eraSel === 'peak' ? 0.2 : 0.08 });
    // schematic density curve
    const n = (z) => Math.pow(10, z < 2.5 ? -0.25 * (z - 2.5) ** 2 : -0.47 * (z - 2.5));
    let d = '';
    for (let i = 0; i <= 400; i++) { const t = Math.pow(10, -1 + (Math.log10(13.8) + 1) * i / 400), z = B.zAtAge(t); d += (i ? 'L' : 'M') + X(t).toFixed(1) + ',' + Y(n(z)).toFixed(1); }
    el(g, 'path', { d, fill: 'none', stroke: 'var(--accent)', 'stroke-width': 2.5 });
    txt(g, x1 - 4, Y(0.62), 'How common bright quasars were', { fs: sm, cls: 'bk-m', anchor: 'end' });
    txt(g, x1 - 4, Y(0.62) + sm * 1.3, '(schematic)', { fs: sm, cls: 'bk-m', anchor: 'end' });
    el(g, 'line', { x1: x0, y1: bot, x2: x1, y2: bot, class: 'bk-axis', 'stroke-width': 1.5 });
    [0.1, 0.2, 0.5, 1, 2, 5, 13.8].forEach((t) => { el(g, 'line', { x1: X(t), y1: bot, x2: X(t), y2: bot + 5, class: 'bk-axis' }); txt(g, X(t), bot + 5 + sm, t < 1 ? (t * 1000) + ' Myr' : t + ' Gyr', { fs: sm, cls: 'bk-m', anchor: t === 0.1 ? 'start' : t === 13.8 ? 'end' : 'middle', halo: false }); });
    txt(g, x1, bot + 5 + sm * 2.2, 'Time since the Big Bang (log scale) →', { fs: sm, cls: 'bk-m', anchor: 'end', halo: false });
    // markers with labels in rows below the axis title
    const rowsY = [0, 1, 2].map((i) => bot + fs * 3.6 + i * fs * 1.6), used = rowsY.map(() => []), placed = [], boxes = [];
    ERA.forEach((o) => {
      if (o.k === 'peak' || o.k === 'lrd') return;
      const x = X(B.ageAtZ(o.z)), wd = B.tw(o.name, sm) + 10;
      let lx = clamp(x - wd / 2, 2, w - wd - 2), row = 0;
      for (; row < 3; row++) if (!used[row].some(([a, b]) => lx < b + 6 && lx + wd + 6 > a)) break;
      row = Math.min(row, 2); used[row].push([lx, lx + wd]);
      placed.push([o, x, lx, wd, row]); boxes.push([lx + 3, lx + wd - 3, rowsY[row] - sm * 0.95, rowsY[row] + sm * 0.3]);
    });
    // markers on the curve that sit close together are fanned out sideways (at least 6 px apart), with a short tie to their true place
    const mk = placed.map(([o, x]) => ({ x, y: Y(n(o.z)), dx: x })).sort((p, q) => p.x - q.x);
    for (let i = 1; i < mk.length; i++) if (mk[i].dx - mk[i - 1].dx < 15 && Math.abs(mk[i].y - mk[i - 1].y) < 15) { const c = (mk[i].dx + mk[i - 1].dx) / 2; mk[i - 1].dx = Math.min(mk[i - 1].dx, c - 7.5); mk[i].dx = Math.max(mk[i].dx, c + 7.5); }
    placed.forEach(([o, x, lx, wd, row]) => {
      const on = eraSel === o.k, m = mk.find((q) => q.x === x);
      el(g, 'line', { x1: x, y1: m.y, x2: x, y2: bot, stroke: 'var(--faint)', 'stroke-dasharray': '2 3' });
      if (Math.abs(m.dx - x) > 0.5) el(g, 'line', { x1: x, y1: m.y, x2: m.dx, y2: m.y - 9, stroke: 'var(--faint)' });
      el(g, 'circle', { cx: m.dx, cy: Math.abs(m.dx - x) > 0.5 ? m.y - 9 : m.y, r: on ? 6.5 : 4.5, fill: on ? 'var(--accent)' : 'var(--fg)', stroke: 'var(--surface)', 'stroke-width': 1.5 });
      B.vline(g, x, bot + fs * 2.6, rowsY[row] - sm * 0.95 - 3, boxes, { stroke: 'var(--faint)' });
      txt(g, lx + wd / 2, rowsY[row], o.name, { fs: sm, anchor: 'middle', w: on ? 700 : 400 });
    });
    const lx = X(B.ageAtZ(6.5));
    eraFocus = eraSel === 'lrd' ? lx : eraSel === 'peak' ? X(B.ageAtZ(2.5)) : (placed.find(([o]) => o.k === eraSel) || [0, null])[1];
    txt(g, lx, top + fs * 1.3, 'Little red dots', { fs: sm, anchor: 'middle', w: eraSel === 'lrd' ? 700 : 400 });
    void h;
  }
  const eraSet = B.seg($('#bkEraSeg'), ERA.map((o) => ({ k: o.k, label: o.name })), (k) => pickEra(k, true), { init: eraSel });
  function grow(o) { // could a seed born at z = 30 reach this mass by redshift z, at the Eddington limit with η = 0.1?
    const dt = (B.ageAtZ(o.z) - B.ageAtZ(30)) * 1e3, te = 0.1 / 0.9 * tSal / 1e6; // Myr
    return { dt, te, light: 100 * Math.exp(dt / te), heavy: 1e5 * Math.exp(dt / te) };
  }
  function pickEra(k, user) {
    eraSel = k; eraSet(k); drawEra();
    // on narrow screens the figure scrolls sideways: bring the chosen marker or band to the middle
    const box = eraSvg.parentElement;
    if (user && box.scrollWidth > box.clientWidth + 1 && eraFocus != null) {
      const sc = eraSvg.getBoundingClientRect().width / (eraSvg.__w || 1);
      box.scrollTo({ left: clamp(eraFocus * sc - box.clientWidth / 2, 0, box.scrollWidth - box.clientWidth), behavior: B.reduce ? 'auto' : 'smooth' });
    }
    const o = ERA.find((x) => x.k === k), t = B.ageAtZ(o.z);
    $('#bkEraOut').innerHTML = `<p class="h">${o.zr ? 'z ≈ 4 to 9' : 'z ≈ ' + o.z}</p><p class="nm">${o.name}</p><p>${o.d}</p>`;
    const rows = [['Age of the universe then', o.zr ? `${sig(B.ageAtZ(o.zr[1]), 2)} to ${sig(B.ageAtZ(o.zr[0]), 2)} billion years` : `${sig(t, 2)} billion years`]];
    if (o.m) {
      const gr = grow(o), ok = (s) => (s >= o.m ? '<b>yes</b>' : '<b>no</b>');
      rows.push(['Black hole mass (estimate)', mSun(o.m)], ['Time since z = 30', `${Math.round(gr.dt)} million years = ${sig(gr.dt / gr.te, 3)} e-folds`],
        ['From a 100 M☉ star seed', `${sciH(Math.min(gr.light, 1e12), 1)} M☉: ${ok(gr.light)}`], ['From a 100,000 M☉ heavy seed', `${sciH(Math.min(gr.heavy, 1e14), 1)} M☉: ${ok(gr.heavy)}`]);
    } else rows.push(['Growth check', o.k === 'lrd' ? 'Masses too uncertain to test' : 'Not one object']);
    facts($('#bkEraFacts'), rows);
  }

  /* ---------- wiring ---------- */
  const drawNest = B.figure(nestSvg, nest), drawEngine = B.figure(engSvg, engine), drawSed = B.figure(sedSvg, sed), drawEff = B.figure(eff, effChart), drawEra = B.figure(eraSvg, era);
  $('#bkEM').addEventListener('input', (e) => { ed.lm = +e.target.value; eddOut(); });
  $('#bkEL').addEventListener('input', (e) => { ed.lL = +e.target.value; eddOut(); });
  $('#bkEA').addEventListener('input', (e) => { ed.a = +e.target.value; eddOut(); });
  pickNest(nestSel); pickPart(part); eddOut(); pickEra(eraSel);
  window.BKfeeding = { eddCalc, ed, grow, ERA };
})();
