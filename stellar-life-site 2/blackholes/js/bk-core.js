/* Stellar Life — Black holes: shared helpers (constants, SVG drawing, formatting, lazy drawing, animation loops) */
(function () {
  'use strict';
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const NS = 'http://www.w3.org/2000/svg';
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  // SI constants (CODATA 2018; IAU 2015 nominal solar GM)
  const C = {
    G: 6.6743e-11, c: 2.99792458e8, hbar: 1.054571817e-34, kB: 1.380649e-23, GMsun: 1.32712440018e20,
    sigT: 6.6524587e-29, mp: 1.67262192e-27, sSB: 5.670374419e-8, yr: 3.15576e7, AU: 1.495978707e11, pc: 3.0856775815e16,
  };
  C.Msun = C.GMsun / C.G;                    // 1.98841e30 kg
  C.rsSun = 2 * C.GMsun / (C.c * C.c);       // 2953.25 m
  C.tSun = C.GMsun / Math.pow(C.c, 3);       // 4.9255e-6 s
  C.LeddSun = 4 * Math.PI * C.GMsun * C.mp * C.c / C.sigT; // 1.257e31 W
  C.TH = C.hbar * Math.pow(C.c, 3) / (8 * Math.PI * C.GMsun * C.kB); // Hawking T for 1 Msun: 6.17e-8 K
  C.Tcmb = 2.7255;
  C.ageU = 13.8e9;

  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const SUP = { '-': '⁻', '−': '⁻', 0: '⁰', 1: '¹', 2: '²', 3: '³', 4: '⁴', 5: '⁵', 6: '⁶', 7: '⁷', 8: '⁸', 9: '⁹' };
  const supU = (n) => String(n).split('').map((ch) => SUP[ch] || ch).join('');
  const grp = (x) => x.toLocaleString('en-US', { maximumFractionDigits: 0 });
  function sig(x, n) { // n significant figures, grouped thousands
    if (!isFinite(x)) return '∞';
    if (x === 0) return '0';
    const v = Number(Number(x).toPrecision(n)), a = Math.abs(v);
    const dec = a >= 1 ? Math.max(0, n - 1 - Math.floor(Math.log10(a))) : n - 1 - Math.floor(Math.log10(a));
    return v.toLocaleString('en-US', { maximumFractionDigits: Math.min(12, dec), minimumFractionDigits: 0 });
  }
  function parts(x, d) { let ex = Math.floor(Math.log10(Math.abs(x))), m = x / Math.pow(10, ex); if (Math.abs(+m.toFixed(d)) >= 10) { m /= 10; ex += 1; } return [m.toFixed(d), ex]; }
  // plain-text scientific notation (for SVG): 1.26 × 10³¹ ; numbers between 0.01 and 1e5 are written out
  function sci(x, d = 2, lo = 0.01, hi = 1e5) {
    if (!isFinite(x)) return '∞'; if (x === 0) return '0';
    const a = Math.abs(x); if (a >= lo && a < hi) return sig(x, d + 1);
    const [m, ex] = parts(x, d); return `${m} × 10${supU(ex)}`;
  }
  function sciH(x, d = 2, lo = 0.01, hi = 1e5) { // HTML version with <sup>
    if (!isFinite(x)) return '∞'; if (x === 0) return '0';
    const a = Math.abs(x); if (a >= lo && a < hi) return sig(x, d + 1);
    const [m, ex] = parts(x, d); return `${m} × 10<sup>${String(ex).replace('-', '−')}</sup>`;
  }
  const pow10 = (e) => (e === 0 ? '1' : e === 1 ? '10' : '10' + supU(e));
  const pow10H = (e) => (e === 0 ? '1' : e === 1 ? '10' : `10<sup>${String(e).replace('-', '−')}</sup>`);
  function bigWords(x, d = 3) { // 4.3 million, 6.5 billion
    const a = Math.abs(x);
    if (a >= 1e12) return sciH(x, d - 1, 0, 0);
    if (a >= 1e9) return sig(x / 1e9, d) + ' billion';
    if (a >= 1e6) return sig(x / 1e6, d) + ' million';
    if (a >= 1e4) return grp(Math.round(Number(x.toPrecision(d))));
    return sig(x, d);
  }
  const mSun = (m) => `${bigWords(m)} M☉`;
  function yrs(y) {
    if (!isFinite(y)) return '∞';
    if (y < 1 / 3.15576e7 * 1e-3) return sciH(y * 3.15576e7, 1) + ' s';
    if (y < 1 / 3.15576e7 * 120) return sig(y * 3.15576e7, 2) + ' s';
    if (y < 2 / 8766) return sig(y * 525960, 2) + ' minutes';
    if (y < 2 / 365.25) return sig(y * 8766, 2) + ' hours';
    if (y < 0.1) return sig(y * 365.25, 2) + ' days';
    if (y < 2) return sig(y * 12, 2) + ' months';
    if (y < 1e6) return sig(y, y < 100 ? 2 : 3) + ' years';
    if (y < 1e9) return sig(y / 1e6, 2) + ' million years';
    if (y < 1e12) return sig(y / 1e9, 2) + ' billion years';
    return sciH(y, 1) + ' years';
  }
  const secs = (s) => yrs(s / C.yr);
  function lenKm(km) { // a length in words
    if (km < 1) return sig(km * 1000, 3) + ' m';
    if (km < 1e6) return grp(Math.round(Number(km.toPrecision(3)))) + ' km';
    const au = km * 1e3 / C.AU;
    if (au < 5000) return sciH(km, 2) + ' km (' + sig(au, au < 10 ? 2 : 3) + ' AU)';
    return sciH(km, 2) + ' km (' + sig(km * 1e3 / 9.4607e15, 2) + ' light-years)';
  }
  // rows whose value is mostly words get .bk-prose (body font; on phones the value sits left-aligned under its label)
  const wordy = (v) => { const t = String(v).replace(/<[^>]+>/g, ''); return (t.match(/[A-Za-z]{3,}/g) || []).filter((w) => !/^(km|AU|kpc|Mpc|Myr|Gyr|kg|days|hours|minutes|months|years|million|billion|light|μas)$/.test(w)).length >= 2; };
  function facts(box, rows) { box.innerHTML = rows.map(([k, v]) => `<div${wordy(v) ? ' class="bk-prose"' : ''}><dt>${k}</dt><dd>${v}</dd></div>`).join(''); }

  /* ---------- SVG ---------- */
  function el(parent, tag, attrs, text) {
    const n = document.createElementNS(NS, tag);
    if (attrs) for (const k in attrs) if (attrs[k] !== undefined && attrs[k] !== null) n.setAttribute(k, attrs[k]);
    if (text !== undefined) n.textContent = text;
    if (parent) parent.appendChild(n);
    return n;
  }
  // text with a halo; o: {fs, cls, anchor, halo, w (weight), mono, fill, base}
  function txt(parent, x, y, s, o = {}) {
    const cls = [o.cls || 'bk-t', o.halo === false ? '' : 'bk-halo', o.mono ? 'bk-mono' : ''].join(' ').trim();
    const t = el(parent, 'text', { x: +x.toFixed(1), y: +y.toFixed(1), class: cls, 'font-size': o.fs || 15, 'text-anchor': o.anchor || 'start', 'font-weight': o.w, fill: o.fill, 'dominant-baseline': o.base }, s);
    if (o.haloColor) t.style.stroke = o.haloColor;
    return t;
  }
  // set the viewBox to the rendered width so 1 unit = 1 CSS px; fs ≈ 15 px on wide figures, 12.5 px on phones
  function fit(svg, hOf) {
    const w = Math.max(240, Math.round(svg.getBoundingClientRect().width || svg.parentElement.clientWidth || 600));
    const fs = w >= 420 ? 15 : 12.5, sm = w >= 420 ? 13.5 : 12;
    const h = Math.round(typeof hOf === 'function' ? hOf(w, fs) : hOf);
    svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
    svg.setAttribute('height', h);
    while (svg.firstChild) svg.removeChild(svg.firstChild);
    svg.__w = w;
    return { w, h, fs, sm };
  }
  const logMap = (d0, d1, r0, r1) => (v) => r0 + (Math.log10(v) - d0) / (d1 - d0) * (r1 - r0);
  const linMap = (d0, d1, r0, r1) => (v) => r0 + (v - d0) / (d1 - d0) * (r1 - r0);
  const tw = (s, fs) => s.length * fs * 0.56; // rough text width before measuring
  // vertical leader line from y1 down to y2 at x, broken where it would cross a label box [l, r, t, b]
  function vline(parent, x, y1, y2, boxes, attrs) {
    const cuts = boxes.filter(([l, r, t, b]) => x > l - 2 && x < r + 2 && b > y1 && t < y2).map(([, , t, b]) => [t - 3, b + 3]).sort((p, q) => p[0] - q[0]);
    let y = y1;
    cuts.forEach(([t, b]) => { if (t > y + 1) el(parent, 'line', Object.assign({ x1: x, y1: y, x2: x, y2: t }, attrs)); y = Math.max(y, b); });
    if (y2 > y + 1) el(parent, 'line', Object.assign({ x1: x, y1: y, x2: x, y2: y2 }, attrs));
  }

  /* ---------- segmented buttons ---------- */
  function seg(box, items, onPick, opt = {}) {
    box.innerHTML = '';
    const btns = items.map((it) => {
      const b = document.createElement('button'); b.type = 'button'; b.innerHTML = it.label; b.dataset.k = it.k;
      b.setAttribute('aria-pressed', 'false');
      b.addEventListener('click', () => { set(it.k); onPick(it.k, it); });
      box.appendChild(b); return b;
    });
    function set(k) { btns.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.k === String(k)))); }
    if (opt.init !== undefined) set(opt.init);
    return set;
  }

  /* ---------- lazy drawing: redraw a figure when its tab is shown or its width changes ---------- */
  const figs = [];
  const shown = (svg) => svg.getClientRects().length > 0;
  function figure(svg, draw) {
    const f = { svg, draw, w: -1 };
    f.run = () => { if (!shown(svg)) return; draw(); f.w = svg.getBoundingClientRect().width; };
    figs.push(f);
    if ('ResizeObserver' in window) {
      let q = 0;
      new ResizeObserver(() => { if (q) return; q = requestAnimationFrame(() => { q = 0; const w = svg.getBoundingClientRect().width; if (w > 0 && Math.abs(w - f.w) > 0.5) f.run(); }); }).observe(svg);
    }
    return f.run;
  }
  document.addEventListener('bk:tab', () => requestAnimationFrame(() => figs.forEach((f) => { if (shown(f.svg) && f.w <= 0) f.run(); })));
  document.addEventListener('bk:theme', () => figs.forEach((f) => f.run()));

  /* ---------- animation loop that runs only while playing, visible on screen and its tab is shown ---------- */
  function loop(target, step) {
    const L = { playing: !reduce, vis: false, raf: 0, last: 0 };
    const tick = (now) => {
      L.raf = 0;
      if (!L.playing || !L.vis || !shown(target)) return;
      const dt = L.last ? Math.min(0.05, (now - L.last) / 1000) : 0; L.last = now;
      step(dt);
      L.raf = requestAnimationFrame(tick);
    };
    L.sync = () => { if (L.playing && L.vis && shown(target)) { if (!L.raf) { L.last = 0; L.raf = requestAnimationFrame(tick); } } else if (L.raf) { cancelAnimationFrame(L.raf); L.raf = 0; } };
    L.set = (on) => { L.playing = on; L.sync(); };
    if ('IntersectionObserver' in window) new IntersectionObserver((es) => { L.vis = es[es.length - 1].isIntersecting; L.sync(); }).observe(target);
    else L.vis = true;
    document.addEventListener('bk:tab', () => requestAnimationFrame(L.sync));
    document.addEventListener('visibilitychange', () => { if (document.hidden) { if (L.raf) cancelAnimationFrame(L.raf); L.raf = 0; } else L.sync(); });
    return L;
  }

  /* ---------- Kerr geometry, units of GM/c² (Bardeen, Press & Teukolsky 1972) ---------- */
  const Kerr = {
    horizon: (a) => 1 + Math.sqrt(Math.max(0, 1 - a * a)),
    isco(a, pro = true) {
      const z1 = 1 + Math.cbrt(1 - a * a) * (Math.cbrt(1 + a) + Math.cbrt(1 - a));
      const z2 = Math.sqrt(3 * a * a + z1 * z1);
      return 3 + z2 + (pro ? -1 : 1) * Math.sqrt(Math.max(0, (3 - z1) * (3 + z1 + 2 * z2)));
    },
    photon: (a, pro = true) => 2 * (1 + Math.cos(2 / 3 * Math.acos(pro ? -a : a))),
    eta(a) { // radiative efficiency 1 − E_isco for prograde orbits
      if (a > 0.999999) return 1 - 1 / Math.sqrt(3);
      const r = Kerr.isco(a, true), s = Math.sqrt(r);
      const E = (r * s - 2 * s + a) / (Math.pow(r, 0.75) * Math.sqrt(r * s - 3 * s + 2 * a));
      return 1 - E;
    },
  };
  // age of a flat ΛCDM universe at redshift z, in Gyr (Planck 2018: H0 = 67.7, Ωm = 0.31)
  function ageAtZ(z) {
    const H0 = 67.7 * 1000 / (C.pc * 1e6), Om = 0.31, OL = 0.69;
    const t = 2 / (3 * H0 * Math.sqrt(OL)) * Math.asinh(Math.sqrt(OL / Om) * Math.pow(1 + z, -1.5));
    return t / C.yr / 1e9;
  }
  function zAtAge(t) { let lo = 0, hi = 2000; for (let i = 0; i < 80; i++) { const m = Math.sqrt(lo * hi + 1e-9) || (lo + hi) / 2; if (ageAtZ(m) > t) lo = m; else hi = m; } return (lo + hi) / 2; }

  window.BK = { $, $$, C, reduce, clamp, sig, sci, sciH, pow10, pow10H, supU, bigWords, mSun, yrs, secs, lenKm, facts, el, txt, fit, logMap, linMap, tw, vline, seg, figure, loop, Kerr, ageAtZ, zAtAge };
})();
