/* Stellar Life — Black holes, tab 4 "Quantum": Hawking calculator, particle creation in a changing spacetime, Unruh, Page curve */
(function () {
  'use strict';
  const B = window.BK, { $, C, el, txt, fit, sig, sci, sciH, mSun, facts, clamp } = B;

  /* ---------- Hawking ---------- */
  const hk = { lm: +$('#bkHM').value };
  const TofKg = (kg) => C.TH * C.Msun / kg;
  const lifeYr = (kg) => 5120 * Math.PI * Math.pow(C.G * kg, 2) * kg / (C.hbar * Math.pow(C.c, 4)) / C.yr;
  const Mcmb = C.TH * C.Msun / C.Tcmb;                 // 4.5e22 kg
  const Mnow = Math.cbrt(C.ageU / lifeYr(1));          // photons-only mass evaporating now (kg)
  const hawkSvg = $('#bkHawk');
  function hawk() {
    const { w, h, fs, sm } = fit(hawkSvg, (w, fs) => fs * 1.6 + 2 * 150 + fs * 3.2 + fs * 3);
    const g = el(hawkSvg, 'g'), x0 = 60, x1 = w - 12, X = B.linMap(8, 42, x0, x1);
    const p1 = fs * 1.6, p2 = p1 + 150 + fs * 3.2;
    const Y1 = B.linMap(-20, 16, p1 + 150, p1), Y2 = B.linMap(-2, 106, p2 + 150, p2);
    const panel = (y0, Y, lo, hi, step, unit, title) => {
      el(g, 'rect', { x: x0, y: y0, width: x1 - x0, height: 150, fill: 'none', stroke: 'var(--line)' });
      for (let e = lo; e <= hi; e += step) { const y = Y(e); el(g, 'line', { x1: x0, y1: y, x2: x1, y2: y, class: 'bk-grid' }); txt(g, x0 - 6, y + sm * 0.35, B.pow10(e), { fs: sm, cls: 'bk-m', anchor: 'end', halo: false }); }
      txt(g, x0, y0 - 6, title + ' (' + unit + ')', { fs: sm, cls: 'bk-m', halo: false });
    };
    panel(p1, Y1, -18, 12, 6, 'K', 'Hawking temperature');
    panel(p2, Y2, 0, 100, 20, 'years', 'Time to evaporate');
    const ticks = w >= 560 ? [10, 15, 20, 25, 30, 35, 40] : [10, 20, 30, 40];
    ticks.forEach((e) => { el(g, 'line', { x1: X(e), y1: p2 + 150, x2: X(e), y2: p2 + 155, class: 'bk-axis' }); txt(g, X(e), p2 + 155 + sm, B.pow10(e), { fs: sm, cls: 'bk-m', anchor: 'middle', halo: false }); });
    txt(g, x1, p2 + 155 + sm * 2.2, 'Black hole mass, kg →', { fs: sm, cls: 'bk-m', anchor: 'end', halo: false });
    const clip = (y, a, b) => clamp(y, a, b);
    // lines
    const L1 = (lm) => Math.log10(TofKg(Math.pow(10, lm))), L2 = (lm) => Math.log10(lifeYr(Math.pow(10, lm)));
    el(g, 'line', { x1: X(8), y1: clip(Y1(L1(8)), p1, p1 + 150), x2: X(42), y2: Y1(L1(42)), stroke: 'var(--bk-hot)', 'stroke-width': 2.5 });
    const xs = 8 + (Math.log10(Math.pow(10, -2)) - L2(8)) / 3; // where lifetime = 1e-2 yr
    el(g, 'line', { x1: X(Math.max(8, xs)), y1: Y2(Math.max(-2, L2(Math.max(8, xs)))), x2: X(42), y2: clip(Y2(L2(42)), p2, p2 + 150), stroke: 'var(--bk-hot)', 'stroke-width': 2.5 });
    // CMB and age
    // reference lines; their labels go on whichever side the chosen-mass line is not
    const xm0 = X(hk.lm), boxes = [];
    // labels placed first; vertical lines are then drawn with gaps where they would cross a label
    const lab = (x, y, s, o) => {
      const wd = B.tw(s, sm), l = o.anchor === 'end' ? x - wd : o.anchor === 'middle' ? x - wd / 2 : x;
      boxes.push([l, l + wd, y - sm * 0.85, y + sm * 0.25]); return txt(g, x, y, s, Object.assign({ fs: sm }, o));
    };
    // reference-line labels: try spots along the line (ends first, above and below) and take the first that
    // touches neither the data curve nor a vertical marker line
    const invX = (x) => 8 + (x - x0) / (x1 - x0) * 34;
    const refLab = (y, s, curveY, vxs) => {
      const wd = B.tw(s, sm) + 4, cands = [];
      for (let lx = x0 + 6; lx <= x1 - 6 - wd; lx += 8) cands.push(lx);
      cands.sort((a, b) => Math.min(a - x0, x1 - wd - a) - Math.min(b - x0, x1 - wd - b));
      const ok = (lx, ty, vx) => {
        const t = ty - sm * 0.85 - 2, b = ty + sm * 0.25 + 2;
        if (vx.some((x) => x > lx - 4 && x < lx + wd + 4)) return false;
        if (boxes.some(([l, r, bt, bb]) => l < lx + wd + 4 && r > lx - 4 && bt < b && bb > t)) return false;
        for (let x = lx - 2; x <= lx + wd + 2; x += 3) { const cy = curveY(invX(x)); if (cy > t && cy < b) return false; }
        return true;
      };
      // first pass also keeps clear of the vertical lines; second pass lets them through (they get a gap at the label)
      for (const v of [vxs, []]) for (const lx of cands) for (const ty of [y - 7, y + sm + 5]) if (ok(lx, ty, v)) return lab(lx, ty, s, { fill: 'var(--bk-cmb)', cls: 'bk-t' });
      return lab(x0 + 6, y + sm + 5, s, { fill: 'var(--bk-cmb)', cls: 'bk-t' });
    };
    el(g, 'line', { x1: x0, y1: Y1(Math.log10(C.Tcmb)), x2: x1, y2: Y1(Math.log10(C.Tcmb)), stroke: 'var(--bk-cmb)', 'stroke-width': 1.8, 'stroke-dasharray': '6 5' });

    el(g, 'line', { x1: x0, y1: Y2(10.14), x2: x1, y2: Y2(10.14), stroke: 'var(--bk-cmb)', 'stroke-width': 1.8, 'stroke-dasharray': '6 5' });
    const xc = X(Math.log10(Mcmb)), xn = X(Math.log10(Mnow));
    lab(xc - 6, p1 + 150 - 8, `${sci(Mcmb, 1)} kg`, { anchor: 'end' });
    lab(xn + 6, p2 + fs + 6, `${sci(Mnow, 1)} kg`, {});
    const sx = X(9.2), sw = B.tw('Small = hot', sm) + 8;
    lab(xm0 > sx - 6 && xm0 < sx + sw ? xm0 + 8 : sx, Y1(-12), 'Small = hot', { cls: 'bk-m' });
    const bx = X(33), bw = B.tw('Big = cold', sm) + 8, bHit = xm0 > bx - 6 && xm0 < bx + bw;
    lab(bHit ? xm0 - 8 : bx, Y1(12), 'Big = cold', { cls: 'bk-m', anchor: bHit ? 'end' : 'start' });
    refLab(Y1(Math.log10(C.Tcmb)), w >= 560 ? 'Microwave background, 2.7 K' : 'Background, 2.7 K', (lm) => Y1(L1(lm)), [xm0, xc]);
    refLab(Y2(10.14), 'Age of the universe', (lm) => Y2(L2(lm)), [xm0, xn]);
    B.vline(g, xc, p1, p1 + 150, boxes, { stroke: 'var(--faint)', 'stroke-dasharray': '2 4' });
    B.vline(g, xn, p2, p2 + 150, boxes, { stroke: 'var(--faint)', 'stroke-dasharray': '2 4' });
    // current mass
    const xm = xm0;
    B.vline(g, xm, p1, p1 + 150, boxes, { stroke: 'var(--accent)', 'stroke-width': 2 });
    B.vline(g, xm, p2, p2 + 150, boxes, { stroke: 'var(--accent)', 'stroke-width': 2 });
    el(g, 'circle', { cx: xm, cy: clip(Y1(L1(hk.lm)), p1, p1 + 150), r: 5.5, fill: 'var(--accent)', stroke: 'var(--surface)', 'stroke-width': 1.5 });
    el(g, 'circle', { cx: xm, cy: clip(Y2(L2(hk.lm)), p2, p2 + 150), r: 5.5, fill: 'var(--accent)', stroke: 'var(--surface)', 'stroke-width': 1.5 });
    void h;
  }
  function hawkOut() {
    const kg = Math.pow(10, hk.lm), T = TofKg(kg), life = lifeYr(kg), P = C.hbar * Math.pow(C.c, 6) / (15360 * Math.PI * C.G * C.G * kg * kg);
    const S = 4 * Math.PI * C.G * kg * kg / (C.hbar * C.c), rs = 2 * C.G * kg / (C.c * C.c);
    $('#bkHMOut').innerHTML = `${sciH(kg, 2)} kg = ${sciH(kg / C.Msun, 2, 0.01, 1e5)} M☉`;
    const lam = 2.898e-3 / T;
    facts($('#bkHFacts'), [
      ['Schwarzschild radius', rs < 1e-3 ? `${sciH(rs, 2)} m` : B.lenKm(rs / 1000)],
      ['Hawking temperature', `${sciH(T, 3)} K`],
      ['Against the 2.7 K background', T < C.Tcmb ? '<b>colder</b>: absorbs more than it emits, so it grows' : '<b>hotter</b>: a net emitter, it shrinks'],
      ['Typical wavelength of its glow (Wien peak)', (lam < 1e-3 ? `${sciH(lam, 2)} m` : lam < 1e3 ? `${sig(lam, 3)} m` : B.lenKm(lam / 1000)) + `, λ/r<sub>s</sub> ≈ ${sig(lam / rs, 2)}`],
      ['Power, blackbody estimate (photons, no greybody factors)', `${sciH(P, 2)} W`],
      ['Time to evaporate, blackbody estimate (photons, no greybody factors; if isolated)', (Math.abs(life / C.ageU - 1) <= 0.05 ? `${(life / 1e9).toPrecision(3)} billion years <b>(about the age of the universe)</b>` : B.yrs(life) + (life > C.ageU ? '' : ' <b>(shorter than the age of the universe)</b>'))],
      ['Entropy S/k<sub>B</sub>', sciH(S, 2)],
    ].concat(kg < 1e14 ? [['Evaporating about now', `${sciH(Mnow, 1)} kg (blackbody estimate; full particle content: about 5 × 10<sup>11</sup> kg; see the note below)`]] : []));
    const nowN = $('#bkHNow'); nowN.hidden = !(kg < 1e14);
    nowN.innerHTML = `<b>Evaporating about now</b>: ${sciH(Mnow, 1)} kg in the blackbody estimate (photons only, no greybody factors). The full calculation gives about 5 × 10<sup>11</sup> kg (Page 1976; Carr et al. 2010), about ${sig(5.1e11 / Mnow, 1)} times more, for two reasons: a hot hole also emits gravitons, neutrinos and, when hot enough, electrons, quarks and gluons, so it loses mass faster; and greybody factors (the chance a wave climbs out past the curved spacetime around the hole) cut each species below a perfect blackbody. The extra species win by far.`;
  }
  const HPRE = [['now', Math.log10(Mnow), 'Evaporating now (blackbody estimate)'], ['moon', Math.log10(7.35e22), 'Moon mass'], ['sun', Math.log10(C.Msun), '1 M☉'], ['sgr', Math.log10(4.3e6 * C.Msun), 'Sgr A*'], ['m87', Math.log10(6.5e9 * C.Msun), 'M87*']];

  /* ---------- particle creation in a changing spacetime ---------- */
  const MD = { A: 5, B: 4, m: 1, lr: +$('#bkRho').value, k: +$('#bkK').value };
  const wIn = (k) => Math.sqrt(k * k + MD.m * MD.m * (MD.A - MD.B)), wOut = (k) => Math.sqrt(k * k + MD.m * MD.m * (MD.A + MD.B));
  function betaExact(k, rho) { // Birrell & Davies (1982) eq. 3.92
    const wi = wIn(k), wo = wOut(k), wm = (wo - wi) / 2, pr = Math.PI / rho;
    const lg = (x) => (x > 30 ? x - Math.LN2 : Math.log(Math.sinh(x)));
    return Math.exp(2 * lg(pr * wm) - lg(pr * wi) - lg(pr * wo));
  }
  function integrate(k, rho) { // RK4 for χ'' + ω²(η)χ = 0 starting as a pure positive-frequency wave
    const T = Math.max(14, 8 / rho), N = 6000, hh = 2 * T / N;
    const w2 = (e) => k * k + MD.m * MD.m * (MD.A + MD.B * Math.tanh(rho * e));
    const wi = wIn(k), n0 = 1 / Math.sqrt(2 * wi);
    let e = -T, yr = n0 * Math.cos(wi * T), yi = n0 * Math.sin(wi * T); // e^{-iωη} at η = −T
    let vr = wi * yi, vi = -wi * yr;                                       // derivative: −iω χ
    const out = [];
    const f = (e, y, v) => [v, -w2(e) * y];
    for (let i = 0; i <= N; i++) {
      out.push([e, yr, yi]);
      if (i === N) break;
      const step = (y, v) => {
        const k1 = f(e, y, v), k2 = f(e + hh / 2, y + hh / 2 * k1[0], v + hh / 2 * k1[1]), k3 = f(e + hh / 2, y + hh / 2 * k2[0], v + hh / 2 * k2[1]), k4 = f(e + hh, y + hh * k3[0], v + hh * k3[1]);
        return [y + hh / 6 * (k1[0] + 2 * k2[0] + 2 * k3[0] + k4[0]), v + hh / 6 * (k1[1] + 2 * k2[1] + 2 * k3[1] + k4[1])];
      };
      [yr, vr] = step(yr, vr); [yi, vi] = step(yi, vi); e += hh;
    }
    const wo = wOut(k), ar = -wo * yi + vr, ai = wo * yr + vi; // iωχ + χ'
    return { pts: out, beta2: (ar * ar + ai * ai) / (2 * wo), T };
  }
  const modeSvg = $('#bkMode'), betaSvg = $('#bkBeta');
  let modeRes = null;
  function mode() {
    const rho = Math.pow(10, MD.lr); modeRes = integrate(MD.k, rho);
    const { w, h, fs, sm } = fit(modeSvg, (w, fs) => fs * 1.4 + 8 + 70 + fs * 2.6 + 170 + fs * 2.6);
    const g = el(modeSvg, 'g'), x0 = 12, x1 = w - 12, T = modeRes.T, X = B.linMap(-T, T, x0, x1);
    const t1 = fs * 1.4 + 8, Yc = B.linMap(1, 9, t1 + 70, t1);
    txt(g, x0, t1 - 10, 'Conformal factor C(η) = a²(η) (size of space squared)', { fs: sm, cls: 'bk-m', halo: false });
    let d = '';
    for (let i = 0; i <= 300; i++) { const e = -T + 2 * T * i / 300; d += (i ? 'L' : 'M') + X(e).toFixed(1) + ',' + Yc(MD.A + MD.B * Math.tanh(rho * e)).toFixed(1); }
    el(g, 'path', { d, fill: 'none', stroke: 'var(--accent)', 'stroke-width': 2.5 });
    const t2 = t1 + 70 + fs * 2.6, mid = t2 + 85, amp = 1 / Math.sqrt(2 * wIn(MD.k)), Y = B.linMap(-1.9 * amp, 1.9 * amp, t2 + 170, t2);
    txt(g, x0, t2 - 6, 'Field wave: real part, and its envelope |χ|', { fs: sm, cls: 'bk-m', halo: false });
    el(g, 'line', { x1: x0, y1: mid, x2: x1, y2: mid, class: 'bk-grid' });
    let wv = '', env = '';
    const P = modeRes.pts, stepN = Math.max(1, Math.floor(P.length / 1500));
    for (let i = 0; i < P.length; i += stepN) { const [e, r, im] = P[i], x = X(e).toFixed(1); wv += (i ? 'L' : 'M') + x + ',' + Y(r).toFixed(1); env += (i ? 'L' : 'M') + x + ',' + Y(Math.hypot(r, im)).toFixed(1); }
    el(g, 'path', { d: wv, fill: 'none', stroke: 'var(--bk-wave)', 'stroke-width': 1.4 });
    el(g, 'path', { d: env, fill: 'none', stroke: 'var(--bk-env)', 'stroke-width': 2.2 });
    const nar = w < 560;
    txt(g, x0 + 4, t2 + 170 + fs * 1.5, nar ? 'Before: one wave' : 'Before: one clean wave', { fs: sm });
    txt(g, x1 - 4, t2 + 170 + fs * 1.5, modeRes.beta2 > 1e-3 ? (nar ? 'After: envelope beats' : 'After: wave + mirror wave, envelope beats') : (nar ? 'After: one wave' : 'After: still one wave (almost no particles)'), { fs: sm, anchor: 'end' });
    B.vline(g, X(0), t1, t2 + 170, [[x0, x0 + B.tw('Field wave: real part, and its envelope |χ|', sm), t2 - 6 - sm * 0.85, t2 - 6 + sm * 0.25]], { stroke: 'var(--faint)', 'stroke-dasharray': '2 4' });
    void h;
  }
  function betaFig() {
    const rho = Math.pow(10, MD.lr);
    const { w, h, fs, sm } = fit(betaSvg, (w, fs) => fs * 1.3 + 150 + fs * 3.2 + 8);
    const g = el(betaSvg, 'g'), x0 = 50, x1 = w - 10, X = B.linMap(0, 3, x0, x1), top = fs * 1.3, Y = B.linMap(-12, 0, top + 150, top);
    txt(g, x0, top - 5, 'Particles per mode, |β|²', { fs: sm, cls: 'bk-m', halo: false });
    [-12, -9, -6, -3, 0].forEach((e) => { el(g, 'line', { x1: x0, y1: Y(e), x2: x1, y2: Y(e), class: 'bk-grid' }); txt(g, x0 - 5, Y(e) + sm * 0.35, B.pow10(e), { fs: sm, cls: 'bk-m', anchor: 'end', halo: false }); });
    let d = '';
    for (let i = 0; i <= 200; i++) { const k = 3 * i / 200, b = betaExact(k, rho); d += (i ? 'L' : 'M') + X(k).toFixed(1) + ',' + Y(clamp(Math.log10(Math.max(b, 1e-13)), -12.3, 0)).toFixed(1); }
    el(g, 'path', { d, fill: 'none', stroke: 'var(--accent)', 'stroke-width': 2.5 });
    const b0 = betaExact(MD.k, rho);
    el(g, 'circle', { cx: X(MD.k), cy: Y(clamp(Math.log10(Math.max(b0, 1e-13)), -12.3, 0)), r: 5.5, fill: 'var(--fg)', stroke: 'var(--surface)', 'stroke-width': 1.5 });
    [0, 1, 2, 3].forEach((k) => txt(g, X(k), top + 150 + sm + 4, String(k), { fs: sm, cls: 'bk-m', anchor: 'middle', halo: false }));
    txt(g, x1, top + 150 + sm * 2.3 + 4, 'Wavenumber k →', { fs: sm, cls: 'bk-m', anchor: 'end', halo: false });
    void h;
  }
  function modeOut() {
    const rho = Math.pow(10, MD.lr), ex = betaExact(MD.k, rho);
    $('#bkRhoOut').textContent = `ρ = ${sig(rho, 3)}${rho > 8 ? ' (sudden)' : rho < 0.6 ? ' (gentle)' : ''}`;
    $('#bkKOut').textContent = MD.k.toFixed(2);
    const num = modeRes ? modeRes.beta2 : integrate(MD.k, rho).beta2;
    facts($('#bkModeFacts'), [
      ['Frequency before / after', `${wIn(MD.k).toFixed(3)} / ${wOut(MD.k).toFixed(3)}`],
      ['Particles created |β|² (exact)', ex < 1e-12 ? '< 10<sup>−12</sup>' : sciH(ex, 3, 0.001)],
      ['Same, from the wave above', num < 1e-7 ? '≈ 0 (below the step-by-step accuracy)' : sciH(num, 3, 0.001)],
      ['Sudden-change limit', sciH(Math.pow(wOut(MD.k) - wIn(MD.k), 2) / (4 * wIn(MD.k) * wOut(MD.k)), 3, 0.001)],
    ]);
  }

  /* ---------- Unruh ---------- */
  const UK = C.hbar / (2 * Math.PI * C.c * C.kB); // K per m/s²
  const UPRE = [['g', Math.log10(9.80665), '1 g'], ['g9', Math.log10(9 * 9.80665), '9 g (pilot)'], ['ns', 12, 'Neutron star surface'], ['bh', Math.log10(Math.pow(C.c, 4) / (4 * C.GMsun)), 'Horizon of a 1 M☉ hole'], ['k1', Math.log10(1 / UK), '1 K']];
  let ua = +$('#bkUa').value;
  function unruhOut() {
    const a = Math.pow(10, ua), T = UK * a, Mbh = Math.pow(C.c, 4) / (4 * C.G * a);
    $('#bkUaOut').innerHTML = `${sciH(a, 2)} m/s²`;
    facts($('#bkUFacts'), [
      ['Unruh temperature', `${sciH(T, 3)} K`],
      ['In multiples of Earth\'s gravity', `${sciH(a / 9.80665, 2)} g`],
      ['Acceleration needed for 1 K', `${sciH(1 / UK, 2)} m/s²`],
      ['Black hole with this surface gravity', `${sciH(Mbh / C.Msun, 2, 0.01)} M☉: its Hawking temperature is the same ${sciH(T, 2)} K`],
    ]);
  }

  /* ---------- Page curve ---------- */
  const pageSvg = $('#bkPage');
  let pt = +$('#bkPt').value;
  const Sbh = (t) => Math.pow(Math.max(0, 1 - t), 2 / 3), Shaw = (t) => 1 - Sbh(t), Spage = (t) => Math.min(Sbh(t), Shaw(t));
  const tPage = 1 - Math.pow(0.5, 1.5);
  function page() {
    const { w, h, fs, sm } = fit(pageSvg, (w, fs) => (w >= 560 ? 300 : 270) + fs * 3);
    const g = el(pageSvg, 'g'), x0 = 40, x1 = w - 12, top = fs * 1.6, bot = h - fs * 3, X = B.linMap(0, 1, x0, x1), Y = B.linMap(0, 1.05, bot, top);
    [0, 0.5, 1].forEach((v) => { el(g, 'line', { x1: x0, y1: Y(v), x2: x1, y2: Y(v), class: 'bk-grid' }); txt(g, x0 - 5, Y(v) + sm * 0.35, String(v), { fs: sm, cls: 'bk-m', anchor: 'end', halo: false }); });
    txt(g, x0, top - 6, 'Entropy, as a share of the starting black hole entropy', { fs: sm, cls: 'bk-m', halo: false });
    const path = (fn) => { let d = ''; for (let i = 0; i <= 300; i++) { const t = i / 300; d += (i ? 'L' : 'M') + X(t).toFixed(1) + ',' + Y(fn(t)).toFixed(1); } return d; };
    el(g, 'path', { d: path(Sbh), fill: 'none', stroke: 'var(--muted)', 'stroke-width': 1.8, 'stroke-dasharray': '6 5' });
    el(g, 'path', { d: path(Shaw), fill: 'none', stroke: 'var(--bk-bad)', 'stroke-width': 2 });
    el(g, 'path', { d: path(Spage), fill: 'none', stroke: 'var(--bk-good)', 'stroke-width': 4 });
    txt(g, X(tPage) + 6, bot - 8, 'Page time', { fs: sm });
    txt(g, X(0.32), Y(Sbh(0.32)) - 7, 'Black hole entropy', { fs: sm, cls: 'bk-m' });
    txt(g, X(0.97), Y(0.99), "Hawking's calculation", { fs: sm, anchor: 'end', fill: 'var(--bk-bad)', cls: 'bk-t' });
    txt(g, X(0.15) + 6, Y(Shaw(0.15)) + fs * 1.2, 'Page curve', { fs: sm, anchor: 'start', fill: 'var(--bk-good)', cls: 'bk-t', w: 700 });
    const pb = [[X(0.32), X(0.32) + B.tw('Black hole entropy', sm), Y(Sbh(0.32)) - 7 - sm * 0.85, Y(Sbh(0.32)) - 7 + sm * 0.25], [X(0.97) - B.tw("Hawking's calculation", sm), X(0.97), Y(0.99) - sm * 0.85, Y(0.99) + sm * 0.25], [X(tPage) + 6, X(tPage) + 6 + B.tw('Page time', sm), bot - 8 - sm * 0.85, bot - 8 + sm * 0.25], [X(0.15) + 6, X(0.15) + 6 + B.tw('Page curve', sm) * 1.1, Y(Shaw(0.15)) + fs * 1.2 - sm * 0.85, Y(Shaw(0.15)) + fs * 1.2 + sm * 0.25]];
    B.vline(g, X(tPage), top, bot, pb, { stroke: 'var(--faint)', 'stroke-dasharray': '2 4' });
    B.vline(g, X(pt), top, bot, pb, { stroke: 'var(--accent)', 'stroke-width': 2 });
    el(g, 'circle', { cx: X(pt), cy: Y(Spage(pt)), r: 5.5, fill: 'var(--bk-good)', stroke: 'var(--surface)', 'stroke-width': 1.5 });
    el(g, 'line', { x1: x0, y1: bot, x2: x1, y2: bot, class: 'bk-axis' });
    [0, 0.25, 0.5, 0.75, 1].forEach((t) => txt(g, X(t), bot + sm + 4, String(t), { fs: sm, cls: 'bk-m', anchor: 'middle', halo: false }));
    txt(g, x1, bot + sm * 2.4 + 4, 'Time / lifetime →', { fs: sm, cls: 'bk-m', anchor: 'end', halo: false });
  }
  function pageOut() {
    $('#bkPtOut').textContent = `${(pt * 100).toFixed(1)}%`;
    facts($('#bkPFacts'), [
      ['Mass left', `${(Math.cbrt(1 - pt) * 100).toFixed(1)}%`],
      ['Black hole entropy', Sbh(pt).toFixed(3)],
      ['Radiation entropy, Hawking', Shaw(pt).toFixed(3)],
      ['Radiation entropy, Page curve', Spage(pt).toFixed(3)],
      ['Stage', pt < tPage ? 'Before the Page time: both agree' : '<b>After the Page time</b>: information must be coming out'],
    ]);
  }

  /* ---------- wiring ---------- */
  const drawHawk = B.figure(hawkSvg, hawk), drawMode = B.figure(modeSvg, () => { mode(); modeOut(); }), drawBeta = B.figure(betaSvg, betaFig), drawPage = B.figure(pageSvg, page);
  const hSet = B.seg($('#bkHSeg'), HPRE.map(([k, , l]) => ({ k, label: l })), (k) => { hk.lm = HPRE.find((p) => p[0] === k)[1]; $('#bkHM').value = hk.lm; hawkOut(); drawHawk(); }, { init: 'sun' });
  hk.lm = HPRE[2][1]; $('#bkHM').value = hk.lm;
  $('#bkHM').addEventListener('input', (e) => { hk.lm = +e.target.value; hSet(null); hawkOut(); drawHawk(); });
  $('#bkRho').addEventListener('input', (e) => { MD.lr = +e.target.value; drawMode(); drawBeta(); modeOut(); });
  $('#bkK').addEventListener('input', (e) => { MD.k = +e.target.value; drawMode(); drawBeta(); modeOut(); });
  const uSet = B.seg($('#bkUSeg'), UPRE.map(([k, , l]) => ({ k, label: l })), (k) => { ua = UPRE.find((p) => p[0] === k)[1]; $('#bkUa').value = ua; unruhOut(); }, { init: 'g' });
  ua = UPRE[0][1]; $('#bkUa').value = ua;
  $('#bkUa').addEventListener('input', (e) => { ua = +e.target.value; uSet(null); unruhOut(); });
  $('#bkPt').addEventListener('input', (e) => { pt = +e.target.value; pageOut(); drawPage(); });
  hawkOut(); modeOut(); unruhOut(); pageOut();
  window.BKquantum = { TofKg, lifeYr, Mcmb, Mnow, betaExact, integrate, UK };
})();
