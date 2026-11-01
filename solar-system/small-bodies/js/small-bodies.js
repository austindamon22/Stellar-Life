/* Stellar Life — Small bodies: tab controller, asteroid belt, comets, Kuiper belt & Oort cloud, impacts, meteors */
(function () {
  'use strict';
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const store = { get(k) { try { return localStorage.getItem('sb-' + k); } catch (e) { return null; } }, set(k, v) { try { localStorage.setItem('sb-' + k, v); } catch (e) { /* unavailable */ } } };
  const facts = (box, rows) => { box.innerHTML = rows.map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join(''); };
  const tok = () => {
    const c = getComputedStyle(document.documentElement), g = (n) => c.getPropertyValue(n).trim();
    return { fg: g('--fg'), muted: g('--muted'), faint: g('--faint'), line: g('--line'), lineSoft: g('--line-soft'), accent: g('--accent'), surface: g('--surface'), surface2: g('--surface-2'), bg: g('--bg'), good: g('--good'), bad: g('--bad'),
      ast: g('--sb-ast'), tro: g('--sb-tro'), ion: g('--sb-ion'), dust: g('--sb-dust'), heat: g('--sb-heat'), nep: g('--sb-nep'), plu: g('--sb-plu') };
  };
  let T = tok();
  const phoneMQ = matchMedia('(max-width: 640px)');
  const PH = () => phoneMQ.matches;
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const DEG = Math.PI / 180, TAU = Math.PI * 2;
  const fx = (x, d) => Number(x).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d, useGrouping: false }); // also used for SVG coordinates: no thousands separators
  const n0 = (x) => Math.round(x).toLocaleString('en-US');
  const sigf = (x, n) => Number(Number(x).toPrecision(n)).toLocaleString('en-US', { maximumFractionDigits: 12 });
  const SUP = { '-': '⁻', 0: '⁰', 1: '¹', 2: '²', 3: '³', 4: '⁴', 5: '⁵', 6: '⁶', 7: '⁷', 8: '⁸', 9: '⁹' };
  function sci(x, d) {
    if (!x) return '0';
    let ex = Math.floor(Math.log10(Math.abs(x))), m = x / Math.pow(10, ex);
    if (Math.abs(+m.toFixed(d)) >= 10) { m /= 10; ex += 1; }
    return `${m.toFixed(d)} × 10${String(ex).split('').map((c) => SUP[c]).join('')}`;
  }
  function yrs(y) { // a span of time in words
    if (y < 1 / 365.25 * 2) return sigf(y * 365.25 * 24, 2) + ' hours';
    if (y < 0.1) return sigf(y * 365.25, 2) + ' days';
    if (y < 2) return sigf(y * 12, 2) + ' months';
    if (y < 1e6) return sigf(y, y < 100 ? 2 : 3) + ' years';
    if (y < 1e9) return sigf(y / 1e6, 2) + ' million years';
    return sigf(y / 1e9, 2) + ' billion years';
  }
  function mulberry(seed) { return function () { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  function gauss(r) { let u = 0; while (u === 0) u = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(TAU * r()); }
  /* SVG text: sizes are given in rendered CSS pixels (desktop, phone) and turned into viewBox units */
  function U(svg) { const w = svg.getBoundingClientRect().width, vb = svg.viewBox.baseVal.width; return w > 0 ? vb / w : vb / 640; }
  const FS = (svg, d, p) => (PH() ? (p || 12) : (d || 14)) * U(svg);
  const FSs = (svg) => FS(svg, 12.5, 11.4);
  function tx(x, y, s, o) {
    o = o || {}; const f = o.fs || 14;
    return `<text x="${fx(x, 1)}" y="${fx(y, 1)}" font-size="${fx(f, 2)}" fill="${o.fill || T.fg}"${o.anchor ? ` text-anchor="${o.anchor}"` : ''}${o.weight ? ` font-weight="${o.weight}"` : ''}${o.halo === false ? '' : ` stroke="${o.hc || T.surface}" stroke-width="${fx(o.hw || f * 0.3, 1)}" stroke-linejoin="round" paint-order="stroke"`}${o.extra || ''}>${s}</text>`;
  }
  function arrow(x1, y1, x2, y2, col, w, h) {
    const a = Math.atan2(y2 - y1, x2 - x1), c = Math.cos(a), s = Math.sin(a); h = h || 11;
    const bx = x2 - h * c, by = y2 - h * s;
    return `<line x1="${fx(x1, 1)}" y1="${fx(y1, 1)}" x2="${fx(bx, 1)}" y2="${fx(by, 1)}" stroke="${col}" stroke-width="${w || 2.5}" stroke-linecap="round"/><polygon points="${fx(x2, 1)},${fx(y2, 1)} ${fx(bx - h * 0.55 * s, 1)},${fx(by + h * 0.55 * c, 1)} ${fx(bx + h * 0.55 * s, 1)},${fx(by - h * 0.55 * c, 1)}" fill="${col}"/>`;
  }
  function seg(box, items, cur, onPick) {
    box.innerHTML = items.map(([k, label]) => `<button type="button" data-k="${k}" aria-pressed="${k === cur}">${label}</button>`).join('');
    box.addEventListener('click', (e) => { const b = e.target.closest('button'); if (!b) return; onPick(b.dataset.k); });
  }
  const press = (box, k) => $$('button', box).forEach((x) => x.setAttribute('aria-pressed', String(x.dataset.k === k)));
  function svgPt(svg, e) { const r = svg.getBoundingClientRect(), vb = svg.viewBox.baseVal; return [(e.clientX - r.left) / r.width * vb.width, (e.clientY - r.top) / r.height * vb.height]; }
  function drag(svg, onPt) { // pointer drag on an SVG, reporting viewBox coordinates
    let on = false;
    svg.addEventListener('pointerdown', (e) => { on = true; try { svg.setPointerCapture(e.pointerId); } catch (er) { /* ignore */ } onPt(svgPt(svg, e)); });
    svg.addEventListener('pointermove', (e) => { if (on) onPt(svgPt(svg, e)); });
    ['pointerup', 'pointercancel'].forEach((n) => svg.addEventListener(n, () => { on = false; }));
  }
  const pts = (a) => a.map((p) => fx(p[0], 1) + ',' + fx(p[1], 1)).join(' ');
  function playBtn(btn, L, labels) {
    const sync = () => { btn.setAttribute('aria-pressed', String(L.play)); btn.textContent = L.play ? labels[0] : labels[1]; };
    btn.addEventListener('click', () => { L.play = !L.play; sync(); L.sync(); });
    sync(); return sync;
  }

  /* Kepler's equation E − e sin E = M, by Newton's method */
  function keplerE(M, e) {
    M = ((M % TAU) + TAU) % TAU;
    let E = e < 0.8 ? M : Math.PI;
    for (let i = 0; i < 60; i++) { const d = (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E)); E -= d; if (Math.abs(d) < 1e-12) break; }
    return E;
  }

  /* ---------- animation loops: run only while their tab is shown, on screen and playing ---------- */
  let curTab = null;
  const loops = [];
  function makeLoop(tab, target, step) {
    const L = { play: !reduce, vis: false, raf: 0, last: 0 };
    function tick(now) { const dt = Math.min(0.05, (now - L.last) / 1000); L.last = now; step(dt); L.raf = requestAnimationFrame(tick); }
    L.sync = () => {
      const want = L.play && L.vis && curTab === tab && !document.hidden;
      if (want && !L.raf) { L.last = performance.now(); L.raf = requestAnimationFrame(tick); } else if (!want && L.raf) { cancelAnimationFrame(L.raf); L.raf = 0; }
    };
    new IntersectionObserver((es) => { L.vis = es[es.length - 1].isIntersecting; L.sync(); }).observe(target);
    loops.push(L);
    return L;
  }
  document.addEventListener('visibilitychange', () => loops.forEach((L) => L.sync()));
  const drawn = {}, redraw = {};

  /* ---------- tabs (keyboard: arrows, Home, End; hash and last tab remembered) ---------- */
  const tabs = $$('.tabs [role=tab]');
  function show(id, focus) {
    tabs.forEach((t) => { const on = t.getAttribute('aria-controls') === id; t.setAttribute('aria-selected', String(on)); t.tabIndex = on ? 0 : -1; document.getElementById(t.getAttribute('aria-controls')).hidden = !on; if (on && focus) t.focus(); });
    curTab = id; store.set('tab', id);
    if (location.hash.slice(1) !== id) history.replaceState(null, '', '#' + id);
    document.dispatchEvent(new CustomEvent('sb:tab', { detail: { id } }));
  }
  tabs.forEach((t, i) => {
    t.addEventListener('click', () => show(t.getAttribute('aria-controls')));
    t.addEventListener('keydown', (e) => {
      const n = tabs.length; let j = null;
      if (e.key === 'ArrowRight') j = (i + 1) % n; if (e.key === 'ArrowLeft') j = (i - 1 + n) % n;
      if (e.key === 'Home') j = 0; if (e.key === 'End') j = n - 1;
      if (j !== null) { e.preventDefault(); show(tabs[j].getAttribute('aria-controls'), true); }
    });
  });
  const valid = (id) => tabs.some((t) => t.getAttribute('aria-controls') === id);
  addEventListener('hashchange', () => { const h = location.hash.slice(1); if (valid(h) && h !== curTab) show(h); });
  matchMedia('(prefers-color-scheme: light)').addEventListener('change', () => { T = tok(); Object.keys(redraw).forEach((k) => redraw[k]()); });
  // wide strips that scroll sideways on phones: fade only the side that has more, plus a swipe hint
  function wideInit() {
    $$('.sb-wide').forEach((w) => {
      if (w.__fade) return; w.__fade = true;
      const hint = document.createElement('p'); hint.className = 'sb-swipe note'; hint.textContent = 'Swipe to see more →'; hint.hidden = true;
      hint.setAttribute('aria-hidden', 'true'); w.after(hint); w.__hint = hint;
      w.addEventListener('scroll', () => wideSync(w), { passive: true });
    });
  }
  function wideSync(w) {
    const max = w.scrollWidth - w.clientWidth, more = w.clientWidth > 0 && max > 2;
    w.classList.toggle('fade-l', more && w.scrollLeft > 2);
    w.classList.toggle('fade-r', more && w.scrollLeft < max - 2);
    if (w.__hint) { w.__hint.hidden = !more; w.__hint.style.visibility = w.scrollLeft < max - 2 ? '' : 'hidden'; }
  }
  const wideAll = () => $$('.sb-wide').forEach(wideSync);
  document.addEventListener('sb:tab', (e) => {
    const id = e.detail.id;
    if (!drawn[id]) { drawn[id] = true; ({ belt: initBelt, comets: initComets, outer: initOuter, impacts: initImpacts, meteors: initMeteors })[id](); }
    loops.forEach((L) => L.sync());
    requestAnimationFrame(wideAll);
  });
  let rsz = 0, lastW = innerWidth;
  addEventListener('resize', () => { wideAll(); clearTimeout(rsz); rsz = setTimeout(() => { if (Math.abs(innerWidth - lastW) < 8) return; lastW = innerWidth; if (redraw[curTab]) redraw[curTab](); }, 150); });

  /* =====================================================================
     ASTEROID BELT
     ===================================================================== */
  const AJ = 5.20, PJ = Math.pow(AJ, 1.5);
  // p:q = asteroid laps per Jupiter laps; Kepler III: a = aJ (q/p)^(2/3)
  const RES = [[4, 1], [3, 1], [5, 2], [7, 3], [2, 1]].map(([p, q]) => ({ k: p + ':' + q, p, q, a: AJ * Math.pow(q / p, 2 / 3) }));
  const sgm = (x) => 1 / (1 + Math.exp(-x));
  const bump = (a, c, s) => Math.exp(-0.5 * Math.pow((a - c) / s, 2));
  /* A smooth model shaped like the numbers of known asteroids against semi-major axis (inner, middle,
     "pristine" and outer belt, the main families), with dips at the resonances. Not a catalogue. */
  function beltW(a) {
    let w = sgm((a - 2.115) / 0.012) * (1 - sgm((a - 3.262) / 0.01));
    const zone = a < 2.5 ? 1 - 0.3 * (a - 2.1) / 0.4 : a < 2.82 ? 0.88 : a < 2.955 ? 0.4 : 0.55;
    w *= zone + 0.28 * bump(a, 2.22, 0.035) + 0.18 * bump(a, 2.36, 0.04) + 0.22 * bump(a, 2.87, 0.012) + 0.18 * bump(a, 3.01, 0.018) + 0.34 * bump(a, 3.14, 0.035);
    w *= 1 - 0.97 * bump(a, RES[1].a, 0.0085);
    w *= 1 - 0.95 * bump(a, RES[2].a, 0.006);
    w *= 1 - 0.9 * bump(a, RES[3].a, 0.004);
    w += 0.035 * sgm((a - 3.32) / 0.01) * (1 - sgm((a - 3.62) / 0.03));
    return w;
  }
  function sampleA(r, lo, hi) { for (;;) { const a = lo + (hi - lo) * r(); if (r() * 1.45 < beltW(a)) return a; } }
  const PLANETS = [{ k: 'Mercury', a: 0.387, l0: 200 }, { k: 'Venus', a: 0.723, l0: 80 }, { k: 'Earth', a: 1, l0: 300 }, { k: 'Mars', a: 1.524, l0: 140 }, { k: 'Jupiter', a: AJ, l0: 35 }];
  const BV = { view: store.get('beltView') === 'close' ? 'close' : 'full', rings: false, t: 0, spd: -0.3, bodies: null, font: '' };
  function beltBodies() {
    const r = mulberry(11), N = 2600, NT = 520, n = N + NT;
    const B = { n, N, a: new Float32Array(n), e: new Float32Array(n), w: new Float32Array(n), M0: new Float32Array(n), mm: new Float32Array(n) };
    for (let i = 0; i < N; i++) {
      const a = sampleA(r, 2.0, 3.6); let e;
      do { e = Math.abs(gauss(r)) * 0.1; } while (e > 0.32 || a * (1 - e) < 1.75);
      B.a[i] = a; B.e[i] = e; B.w[i] = r() * TAU; B.M0[i] = r() * TAU; B.mm[i] = TAU / Math.pow(a, 1.5);
    }
    for (let i = N; i < n; i++) { // Trojans: offset from Jupiter's longitude (L4 leads by 60°), small radial wobble
      const l4 = r() < 0.6;
      B.a[i] = AJ * (1 + 0.012 * gauss(r)); B.e[i] = Math.abs(gauss(r)) * 0.035; B.w[i] = (l4 ? 60 : -60) * DEG + gauss(r) * 13 * DEG; B.M0[i] = r() * TAU; B.mm[i] = 0;
    }
    return B;
  }
  function beltDraw() {
    const cv = $('#sbBeltCv'), W = cv.clientWidth; if (!W) return;
    const dpr = Math.min(2, devicePixelRatio || 1), px = Math.round(W * dpr);
    if (cv.width !== px) { cv.width = px; cv.height = px; }
    const ctx = cv.getContext('2d'); ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, W, W);
    const full = BV.view === 'full', R = full ? 5.75 : 3.75, c = W / 2, s = (W / 2 - 8) / R, t = BV.t, B = BV.bodies;
    const font = (sz, wt) => `${wt || 500} ${sz}px ${BV.font}`;
    const label = (str, x, y, col, align, sz) => { ctx.font = font(sz || 12.5); ctx.textAlign = align || 'left'; ctx.lineJoin = 'round'; ctx.lineWidth = 3.5; ctx.strokeStyle = T.surface; ctx.strokeText(str, x, y); ctx.fillStyle = col; ctx.fillText(str, x, y); };
    ctx.lineWidth = 1; ctx.strokeStyle = T.line;
    PLANETS.forEach((p) => { if (p.a > R) return; ctx.beginPath(); ctx.arc(c, c, p.a * s, 0, TAU); ctx.stroke(); });
    // asteroids
    const lamJ = (PLANETS[4].l0 * DEG) + TAU * t / PJ;
    ctx.fillStyle = T.ast; ctx.globalAlpha = 0.85;
    const sz = W < 420 ? 1.3 : 1.6;
    for (let i = 0; i < B.n; i++) {
      if (i === B.N) { ctx.fillStyle = T.tro; }
      let X, Y;
      if (i < B.N) {
        const e = B.e[i], a = B.a[i], E = keplerE(B.M0[i] + B.mm[i] * t, e), x = a * (Math.cos(E) - e), y = a * Math.sqrt(1 - e * e) * Math.sin(E), cw = Math.cos(B.w[i]), sw = Math.sin(B.w[i]);
        X = x * cw - y * sw; Y = x * sw + y * cw;
      } else {
        const rr = B.a[i] * (1 + B.e[i] * Math.cos(B.M0[i] + TAU * t / PJ)), l = lamJ + B.w[i];
        X = rr * Math.cos(l); Y = rr * Math.sin(l);
      }
      if (X * X + Y * Y > R * R * 1.02) continue;
      const sx = c + X * s, sy = c - Y * s;
      ctx.fillRect(sx - sz / 2, sy - sz / 2, sz, sz);
    }
    ctx.globalAlpha = 1;
    if (BV.rings) {
      ctx.setLineDash([4, 4]); ctx.strokeStyle = T.accent; ctx.lineWidth = 1.2;
      RES.forEach((q, i) => {
        ctx.beginPath(); ctx.arc(c, c, q.a * s, 0, TAU); ctx.stroke();
        if (!full) { const an = (22 + i * 15) * DEG; label(q.k, c + q.a * s * Math.cos(an) + 3, c - q.a * s * Math.sin(an) - 3, T.accent, 'left', 12.5); }
      });
      ctx.setLineDash([]);
    }
    // Sun and planets
    ctx.fillStyle = '#ffc94d'; ctx.beginPath(); ctx.arc(c, c, full ? 5 : 6.5, 0, TAU); ctx.fill();
    PLANETS.forEach((p) => {
      if (p.a > R) return;
      const l = p.l0 * DEG + TAU * t / Math.pow(p.a, 1.5), x = c + p.a * s * Math.cos(l), y = c - p.a * s * Math.sin(l);
      ctx.fillStyle = p.k === 'Jupiter' ? '#e0b98a' : p.k === 'Mars' ? '#d0643a' : p.k === 'Earth' ? '#4f9be8' : T.fg;
      ctx.beginPath(); ctx.arc(x, y, p.k === 'Jupiter' ? 5.5 : 3.6, 0, TAU); ctx.fill();
      if (full && (p.k === 'Mercury' || p.k === 'Venus')) return;
      const ux = Math.cos(l), uy = -Math.sin(l);
      label(p.k, x + ux * 10, y + uy * 10 + 4, T.fg, ux >= 0 ? 'left' : 'right', 13);
    });
    if (full) [[60, 'L4'], [-60, 'L5']].forEach(([d, k]) => { const l = lamJ + d * DEG, rr = AJ * s + 22; label(k, c + rr * Math.cos(l), c - rr * Math.sin(l) + 4, T.tro, 'center', 13); });
    const P = (a) => fx(Math.pow(a, 1.5), 1);
    facts($('#sbBeltFacts'), [['Time passed', (t < 1000 ? fx(t, 1) : n0(t)) + ' years'], ['Jupiter orbits', fx(t / PJ, 2)], ['One lap at 2.2 / 3.2 AU', P(2.2) + ' / ' + P(3.2) + ' years'], ['Jupiter (5.20 AU)', fx(PJ, 2) + ' years']]);
  }
  function initBelt() {
    BV.bodies = beltBodies(); BV.font = getComputedStyle(document.body).fontFamily;
    seg($('#sbBeltView'), [['full', 'Out to Jupiter'], ['close', 'Belt close-up']], BV.view, (k) => { BV.view = k; store.set('beltView', k); press($('#sbBeltView'), k); beltDraw(); });
    const spd = $('#sbBeltSpd');
    const spdOut = () => { const v = Math.pow(10, +spd.value); $('#sbBeltSpdOut').textContent = (v < 1 ? sigf(v, 2) : fx(v, 1)) + ' years per second'; };
    spd.addEventListener('input', () => { spdOut(); }); spdOut();
    $('#sbBeltRings').addEventListener('change', (e) => { BV.rings = e.target.checked; beltDraw(); });
    const L = makeLoop('belt', $('#sbBeltCv'), (dt) => { BV.t += dt * Math.pow(10, +spd.value); beltDraw(); });
    playBtn($('#sbBeltPlay'), L, ['Pause', 'Play']);
    beltDraw();
    initHist(); initMass();
    redraw.belt = () => { beltDraw(); drawHist(); };
  }

  /* ---- Kirkwood histogram ---- */
  let HIST = null; const HA = { a: 2.5 };
  function histData() {
    if (HIST) return HIST;
    const r = mulberry(5), nb = 300, c = new Float64Array(nb);
    for (let i = 0; i < 90000; i++) { const a = sampleA(r, 2, 3.5), k = Math.floor((a - 2) / 0.005); if (k >= 0 && k < nb) c[k]++; }
    HIST = { c, max: Math.max.apply(null, Array.from(c)) };
    return HIST;
  }
  function drawHist() {
    const svg = $('#sbHist'), f = FS(svg, 14, 12), fs = FSs(svg), H = histData();
    const x = (a) => 60 + (a - 2) / 1.5 * 820, base = 296, top = 84, bw = 820 / 300;
    let d = '';
    H.c.forEach((n, i) => { if (!n) return; const h = n / H.max * (base - top); d += `M${fx(x(2 + i * 0.005), 2)},${base}v${fx(-h, 2)}h${fx(bw, 2)}v${fx(h, 2)}z`; });
    let h = `<path d="${d}" fill="${T.ast}" opacity="0.85"/>`;
    h += `<line x1="60" y1="${base}" x2="880" y2="${base}" stroke="${T.muted}" stroke-width="1.2"/>`;
    for (let a = 2; a <= 3.5001; a += 0.1) { const X = x(a), major = Math.abs(a * 4 - Math.round(a * 4)) < 1e-6; h += `<line x1="${fx(X, 1)}" y1="${base}" x2="${fx(X, 1)}" y2="${base + (major ? 7 : 4)}" stroke="${T.muted}"/>`; if (major) h += tx(X, base + 9 + f, fx(a, 2), { fs: f, anchor: 'middle', fill: T.muted }); }
    h += tx(470, base + 14 + 2 * f, 'Orbit size: semi-major axis (AU)', { fs: f, anchor: 'middle', fill: T.muted });
    h += tx(876, top - 6, 'more asteroids ↑', { fs, anchor: 'end', fill: T.muted });
    RES.forEach((q) => {
      const X = x(q.a);
      h += `<line x1="${fx(X, 1)}" y1="${fx(10 + 2.2 * f, 1)}" x2="${fx(X, 1)}" y2="${base}" stroke="${T.accent}" stroke-width="1.2" stroke-dasharray="4 4"/>`;
      h += tx(X, 6 + f, q.k, { fs: f, anchor: 'middle', fill: T.accent, weight: 700 }) + tx(X, 8 + 2 * f, fx(q.a, 2), { fs, anchor: 'middle', fill: T.accent });
    });
    const X = x(HA.a);
    h += `<line x1="${fx(X, 1)}" y1="${top - 10}" x2="${fx(X, 1)}" y2="${base}" stroke="${T.fg}" stroke-width="2"/><circle cx="${fx(X, 1)}" cy="${base}" r="7" fill="${T.fg}" stroke="${T.surface}" stroke-width="2"/>`;
    svg.innerHTML = h;
  }
  function histOut() {
    const a = HA.a, P = Math.pow(a, 1.5), laps = PJ / P;
    $('#sbHistAOut').textContent = fx(a, 3) + ' AU';
    const near = RES.reduce((b, q) => (Math.abs(q.a - a) < Math.abs(b.a - a) ? q : b), RES[0]);
    let msg;
    if (Math.abs(near.a - a) < 0.012) msg = `<b>In the ${near.k} resonance.</b> ${near.p} laps take exactly as long as ${near.q} of Jupiter's, so the two line up at the same points again and again. The tugs add up, the orbit stretches until it crosses Mars or Earth, and the asteroid is cleared out.`;
    else if (a < RES[0].a + 0.04) msg = 'Inside the belt\'s inner edge. The 4:1 resonance and a slower resonance with the turning of Saturn\'s orbit keep it clear. The Hungaria asteroids orbit just inside, near 1.9 AU, on steeply tilted orbits.';
    else if (a > RES[4].a + 0.02) msg = 'Past the 2:1 gap, the main belt ends. A thin group, the Cybeles, orbits out to about 3.7 AU, and the Hildas cluster at the 3:2 resonance near 3.97 AU.';
    else {
      const zone = a < RES[1].a ? 'inner belt (rich in stony S-types)' : a < RES[2].a ? 'middle belt' : a < RES[3].a ? 'thinly filled "pristine zone"' : 'outer belt (mostly dark C-types)';
      msg = `In the ${zone}. Jupiter's tugs come at ever-changing places in the orbit and mostly cancel out, so orbits here can last for billions of years. Nearest resonance: ${near.k} at ${fx(near.a, 2)} AU.`;
    }
    $('#sbHistOut').innerHTML = `<p class="h">Period from Kepler's third law</p><p class="nm">${fx(P, 2)} years · ${fx(laps, 2)} laps per Jupiter orbit</p><p>${msg}</p>`;
    press($('#sbRes'), Math.abs(near.a - a) < 0.0006 ? near.k : '');
  }
  function initHist() {
    const inp = $('#sbHistA');
    const set = (a) => { HA.a = clamp(a, 2, 3.5); inp.value = HA.a; drawHist(); histOut(); };
    seg($('#sbRes'), RES.map((q) => [q.k, `${q.k} · ${fx(q.a, 2)} AU`]), '', (k) => set(RES.find((q) => q.k === k).a));
    inp.addEventListener('input', () => set(+inp.value));
    drag($('#sbHist'), ([X]) => set(2 + (X - 60) / 820 * 1.5));
    set(RES[1].a);
  }
  /* ---- mass of the belt ---- */
  const MBELT = 2.39e21;
  const BIG = [
    { k: 'ceres', n: 'Ceres', m: 9.38e20, col: 'var(--accent)', d: '939 km', a: 2.77, type: 'C (dark, carbon-rich)', found: '1801, Giuseppe Piazzi', visit: 'Dawn, in orbit 2015–2018', txt: 'The only dwarf planet in the inner Solar System, big enough for its own gravity to pull it round. Dawn found a rocky, salty mantle with water ice; the bright spots in Occator crater are salts left where briny water seeped up and dried.' },
    { k: 'vesta', n: 'Vesta', m: 2.59e20, col: 'var(--sb-s)', d: '525 km', a: 2.36, type: 'V (basalt)', found: '1807, Heinrich Olbers', visit: 'Dawn, in orbit 2011–2012', txt: 'A melted, layered mini-planet with an iron core and a lava crust. A giant impact near its south pole dug the 500 km Rheasilvia basin; its debris reaches Earth as the HED meteorites.' },
    { k: 'pallas', n: 'Pallas', m: 2.04e20, col: 'var(--sb-m)', d: '512 km', a: 2.77, type: 'B (dark, bluish)', found: '1802, Heinrich Olbers', visit: 'Not yet visited', txt: 'Its orbit is tilted 35° to the planets\', so other asteroids hit it fast. Telescope images (VLT, 2020) show a surface battered with craters like a golf ball.' },
    { k: 'hygiea', n: 'Hygiea', m: 8.7e19, col: 'var(--sb-c)', d: '~434 km', a: 3.14, type: 'C (dark, carbon-rich)', found: '1849, Annibale de Gasparis', visit: 'Not yet visited', txt: 'Images from the VLT in 2019 showed it is nearly round, so it may qualify as a dwarf planet too.' },
    { k: 'rest', n: 'Everything else', m: 0, col: 'var(--faint)', d: 'mostly under 300 km', a: null, type: 'all types', found: 'over 1 million wider than 1 km', visit: 'about a dozen visited or flown past', txt: 'More than a million bodies wider than 1 km (ESA estimates 1.1 to 1.9 million) and countless smaller ones. Most of this mass is in the few hundred largest.' }
  ];
  BIG[4].m = MBELT - BIG.slice(0, 4).reduce((s, b) => s + b.m, 0);
  function initMass() {
    const bar = $('#sbMassBar'), sel = store.get('big') || 'ceres';
    bar.innerHTML = BIG.map((b) => `<i data-k="${b.k}" style="width:${fx(b.m / MBELT * 100, 2)}%;background:${b.col}"></i>`).join('');
    seg($('#sbMassSeg'), BIG.map((b) => [b.k, `<span class="sb-sw" style="background:${b.col}"></span>${b.n} ${fx(b.m / MBELT * 100, 0)}%`]), sel, pick);
    function pick(k) {
      const b = BIG.find((x) => x.k === k) || BIG[0]; store.set('big', b.k); press($('#sbMassSeg'), b.k);
      bar.classList.add('sel'); $$('i', bar).forEach((i) => i.classList.toggle('on', i.dataset.k === b.k));
      $('#sbMassHead').innerHTML = `<p class="h">${fx(b.m / MBELT * 100, 1)}% of the belt's mass</p><p class="nm">${b.n}</p><p>${b.txt}</p>`;
      facts($('#sbMassFacts'), [['Mass', sci(b.m, 2) + ' kg'], ['Size', b.d], ['Orbit', b.a ? fx(b.a, 2) + ' AU, ' + fx(Math.pow(b.a, 1.5), 1) + ' years' : '2.1 – 3.3 AU'], ['Type', b.type], ['Discovered', b.found], ['Spacecraft', b.visit]]);
    }
    pick(sel);
  }

  /* =====================================================================
     COMETS
     ===================================================================== */
  const COMETS = {
    halley: { n: 'Halley', full: '1P/Halley', e: 0.96714, q: 0.586, nuc: '15 × 8 km', last: '9 February 1986', next: '28 July 2061', note: 'Seen at every return since at least 240 BCE. Edmond Halley predicted its 1758 return.' },
    encke: { n: 'Encke', full: '2P/Encke', e: 0.8483, q: 0.336, nuc: '~4.8 km', last: '22 October 2023', next: 'early 2027', note: 'The shortest known period of any bright comet. Its dust makes the Taurid meteors.' },
    c67p: { n: '67P', full: '67P/Churyumov–Gerasimenko', e: 0.6405, q: 1.243, nuc: '4.1 × 3.3 × 1.8 km (big lobe)', last: '2 November 2021', next: 'spring 2028', note: 'A Jupiter-family comet: its orbit was reshaped by Jupiter, last in 1959.' },
    halebopp: { n: 'Hale–Bopp', full: 'C/1995 O1 (Hale–Bopp)', e: 1 - 0.914 / Math.pow(2400, 2 / 3), q: 0.914, nuc: '~60 km (uncertain)', last: '1 April 1997', next: 'around the year 4400', note: 'Visible to the naked eye for a record 18 months in 1996–97.' }
  };
  /* the time slider u (−1…1) maps to mean anomaly M = π u³: fine steps near perihelion, where a comet changes fastest */
  const tFromU = (u) => ((Math.PI * u * u * u / TAU) % 1 + 1) % 1, uFromT = (t) => Math.cbrt(((t + 0.5) % 1 - 0.5) * 2);
  const CO = { pre: COMETS[store.get('comet')] ? store.get('comet') : 'halley', e: 0, q: 0, view: 'whole', t: tFromU(-0.2), areas: false };
  const coGeom = () => { const e = CO.e, q = CO.q, a = q / (1 - e); return { e, q, a, b: a * Math.sqrt(1 - e * e), P: Math.pow(a, 1.5), Q: a * (1 + e) }; };
  function coState(t) {
    const g = coGeom(), E = keplerE(TAU * t, g.e);
    const x = g.a * (Math.cos(E) - g.e), y = g.b * Math.sin(E), r = g.a * (1 - g.e * Math.cos(E));
    let vx = -g.a * Math.sin(E), vy = g.b * Math.cos(E); const vl = Math.hypot(vx, vy); vx /= vl; vy /= vl;
    return { g, E, x, y, r, vx, vy, v: 29.78 * Math.sqrt(2 / r - 1 / g.a) };
  }
  const activity = (r) => (r < 3 ? 3 / r - 1 : 0);
  function coFrame() { // Sun position and scale for the orbit view
    const g = coGeom();
    if (CO.view === 'inner') return { sx: 300, sy: 220, s: 176 / 5.2 };
    const s = Math.min(540 / (2 * g.a), 390 / (2 * g.b));
    return { sx: 300 + g.a * g.e * s, sy: 220, s };
  }
  function drawOrb() {
    const svg = $('#sbOrb'), f = FS(svg, 13.5, 12), fs = FSs(svg), st = coState(CO.t), g = st.g, F = coFrame();
    const X = (x) => F.sx + x * F.s, Y = (y) => F.sy - y * F.s;
    let h = `<defs><clipPath id="sbOrbClip"><rect x="2" y="2" width="596" height="436"/></clipPath></defs><g clip-path="url(#sbOrbClip)">`;
    // planet orbits
    let lastR = -1e9;
    [['Earth', 1], ['Jupiter', 5.2], ['Saturn', 9.54], ['Neptune', 30.07]].forEach(([k, a]) => {
      const R = a * F.s; if (R < 6 || R > 900) return;
      h += `<circle cx="${fx(F.sx, 1)}" cy="${F.sy}" r="${fx(R, 1)}" fill="none" stroke="${T.muted}" stroke-width="1" stroke-dasharray="3 4" opacity="0.8"/>`;
      const an = 118 * DEG, lx = F.sx + R * Math.cos(an), ly = F.sy - R * Math.sin(an) - 4;
      if (R > 22 && R - lastR > 2.4 * f && ly > f + 4 && lx > 30) { h += tx(lx, ly, k, { fs, anchor: 'end', fill: T.muted }); lastR = R; }
    });
    // equal-time wedges
    if (CO.areas) {
      const K = 12;
      for (let k = 0; k < K; k++) {
        const p = [[X(0), Y(0)]];
        for (let j = 0; j <= 24; j++) { const E = keplerE(TAU * (k + j / 24) / K, g.e); p.push([X(g.a * (Math.cos(E) - g.e)), Y(g.b * Math.sin(E))]); }
        h += `<polygon points="${pts(p)}" fill="${T.accent}" opacity="${k % 2 ? 0.1 : 0.26}"/>`;
      }
    }
    // comet orbit
    const op = []; for (let j = 0; j <= 360; j++) { const E = j * DEG; op.push([X(g.a * (Math.cos(E) - g.e)), Y(g.b * Math.sin(E))]); }
    h += `<polyline points="${pts(op)}" fill="none" stroke="${T.fg}" stroke-width="1.6" opacity="0.75"/>`;
    // perihelion and aphelion labels
    const px = X(g.q), py = F.sy;
    h += `<circle cx="${fx(px, 1)}" cy="${py}" r="2.5" fill="${T.fg}"/>`;
    const near = px > 470;
    h += tx(near ? px - 6 : px + 7, py + f + 10, 'perihelion', { fs, anchor: near ? 'end' : 'start', fill: T.muted });
    const ax = X(-g.Q);
    if (ax > 20 && g.e > 0.05) h += `<circle cx="${fx(ax, 1)}" cy="${py}" r="2.5" fill="${T.fg}"/>` + tx(ax + 6, py + f + 10, 'aphelion', { fs, fill: T.muted });
    // Sun
    h += `<circle cx="${fx(F.sx, 1)}" cy="${F.sy}" r="7" fill="#ffc94d"/>` + tx(F.sx, F.sy - 13, 'Sun', { fs, anchor: 'middle' });
    // comet with tails (lengths exaggerated)
    const cx = X(st.x), cy = Y(st.y), A = activity(st.r);
    if (A > 0) {
      const Lt = clamp(24 * A, 10, 150), ux = st.x / st.r, uy = -st.y / st.r, vx = st.vx, vy = -st.vy; // screen units
      const dot = vx * ux + vy * uy; let wx = -(vx - dot * ux), wy = -(vy - dot * uy); const wl = Math.hypot(wx, wy) || 1; wx /= wl; wy /= wl;
      h += `<defs><linearGradient id="sbIonG" gradientUnits="userSpaceOnUse" x1="${fx(cx, 1)}" y1="${fx(cy, 1)}" x2="${fx(cx + ux * Lt * 1.15, 1)}" y2="${fx(cy + uy * Lt * 1.15, 1)}"><stop offset="0" stop-color="${T.ion}"/><stop offset="1" stop-color="${T.ion}" stop-opacity="0"/></linearGradient>`;
      const ex = cx + Lt * (0.82 * ux + 0.5 * wx), ey = cy + Lt * (0.82 * uy + 0.5 * wy);
      h += `<linearGradient id="sbDustG" gradientUnits="userSpaceOnUse" x1="${fx(cx, 1)}" y1="${fx(cy, 1)}" x2="${fx(ex, 1)}" y2="${fx(ey, 1)}"><stop offset="0" stop-color="${T.dust}" stop-opacity="0.95"/><stop offset="1" stop-color="${T.dust}" stop-opacity="0"/></linearGradient></defs>`;
      h += `<path d="M${fx(cx, 1)},${fx(cy, 1)} Q${fx(cx + Lt * (0.55 * ux + 0.04 * wx), 1)},${fx(cy + Lt * (0.55 * uy + 0.04 * wy), 1)} ${fx(ex, 1)},${fx(ey, 1)}" fill="none" stroke="url(#sbDustG)" stroke-width="${fx(clamp(2 + A, 3, 9), 1)}" stroke-linecap="round"/>`;
      h += `<line x1="${fx(cx, 1)}" y1="${fx(cy, 1)}" x2="${fx(cx + ux * Lt * 1.15, 1)}" y2="${fx(cy + uy * Lt * 1.15, 1)}" stroke="url(#sbIonG)" stroke-width="2.4"/>`;
      h += `<circle cx="${fx(cx, 1)}" cy="${fx(cy, 1)}" r="${fx(3 + Math.min(8, 2 * A), 1)}" fill="${T.dust}" opacity="0.35"/>`;
    }
    h += `<circle cx="${fx(cx, 1)}" cy="${fx(cy, 1)}" r="3.6" fill="${T.fg}" stroke="${T.surface}" stroke-width="1.5"/></g>`;
    h += tx(10, 430, CO.view === 'inner' ? 'Inner Solar System, to scale' : 'Whole orbit, to scale', { fs, fill: T.muted });
    svg.innerHTML = h;
    coOut(st); drawHead(st);
  }
  function coOut(st) {
    const g = st.g, ty = CO.t * g.P;
    const when = CO.t < 0.5 ? yrs(ty) + ' after perihelion' : yrs(g.P - ty) + ' before perihelion';
    $('#sbCoTOut').textContent = when;
    const act = st.r < 3 ? 'water ice sublimating: coma and tails' : st.r < 6 ? 'faint: only more volatile ices, if any' : 'frozen: a bare nucleus';
    facts($('#sbCoFacts'), [['Distance from the Sun', fx(st.r, st.r < 10 ? 2 : 0) + ' AU'], ['Speed', fx(st.v, 1) + ' km/s'], ['Period', yrs(g.P)], ['Perihelion / aphelion', fx(g.q, 2) + ' / ' + fx(g.Q, g.Q < 10 ? 2 : 0) + ' AU'], ['Activity', act]].concat(COMETS[CO.pre] ? [['Nucleus', COMETS[CO.pre].nuc], ['Last perihelion', COMETS[CO.pre].last], ['Next', COMETS[CO.pre].next]] : []));
    $('#sbCoEOut').textContent = fx(CO.e, CO.e > 0.99 ? 4 : 3);
    $('#sbCoQOut').textContent = fx(CO.q, 2) + ' AU';
  }
  function drawHead(st) {
    const svg = $('#sbHead'), f = FS(svg, 13.5, 12), fs = FSs(svg), A = activity(st.r);
    const hx = 190, hy = 170;
    // angle of the velocity from the anti-sun direction (math frame, y up)
    const ux = st.x / st.r, uy = st.y / st.r, ph = Math.atan2(ux * st.vy - uy * st.vx, ux * st.vx + uy * st.vy);
    const vX = Math.cos(ph), vY = -Math.sin(ph); // screen: anti-sun is +x
    const wY = Math.sin(ph) >= 0 ? 1 : -1; // dust lags on the side opposite the motion (screen y)
    let h = '';
    // Sun direction
    h += `<circle cx="-30" cy="${hy}" r="52" fill="#ffc94d"/>` + tx(8, 330, '← to the Sun', { fs: f, weight: 600 });
    const ang = Math.abs(ph) / DEG;
    if (A > 0) {
      const k = Math.min(1, A / 3.5), Lt = 120 + 270 * k, rc = 10 + 26 * Math.min(1, A / 4);
      h += `<defs><linearGradient id="sbHIon" x1="0" x2="1"><stop offset="0" stop-color="${T.ion}"/><stop offset="1" stop-color="${T.ion}" stop-opacity="0"/></linearGradient>`;
      const ex = hx + Lt * 0.86, ey = hy + wY * Lt * 0.38;
      h += `<linearGradient id="sbHDust" gradientUnits="userSpaceOnUse" x1="${hx}" y1="${hy}" x2="${fx(ex, 1)}" y2="${fx(ey, 1)}"><stop offset="0" stop-color="${T.dust}"/><stop offset="1" stop-color="${T.dust}" stop-opacity="0"/></linearGradient>`;
      h += `<radialGradient id="sbHComa"><stop offset="0" stop-color="${T.dust}" stop-opacity="0.75"/><stop offset="1" stop-color="${T.dust}" stop-opacity="0"/></radialGradient></defs>`;
      h += `<path d="M${hx},${hy - 5} Q${fx(hx + Lt * 0.5, 1)},${fx(hy + wY * Lt * 0.02, 1)} ${fx(ex, 1)},${fx(ey, 1)} L${fx(ex, 1)},${fx(ey + wY * 30 * (0.5 + k), 1)} Q${fx(hx + Lt * 0.45, 1)},${fx(hy + wY * Lt * 0.14, 1)} ${hx},${hy + 5}Z" fill="url(#sbHDust)" opacity="0.8"/>`;
      h += `<rect x="${hx}" y="${hy - 2.5}" width="${fx(Lt * 1.05, 1)}" height="5" fill="url(#sbHIon)"/>`;
      h += `<circle cx="${hx}" cy="${hy}" r="${fx(rc * 1.6, 1)}" fill="url(#sbHComa)"/>`;
      h += tx(Math.min(590, hx + Lt * 0.62), hy - wY * (f + 4) + (wY < 0 ? f * 0.7 : 0), 'ion tail', { fs, anchor: 'middle', fill: T.ion, weight: 600 });
      h += tx(Math.min(560, hx + Lt * 0.58), hy + wY * (Lt * 0.24 + 14 + (wY > 0 ? f * 0.7 : 0)), 'dust tail', { fs, anchor: 'middle', fill: T.dust, weight: 600 });
      h += tx(hx - 10, hy + (vY > 0 ? -1 : 1) * (rc * 1.6 + 6) + (vY > 0 ? 0 : f * 0.7), 'coma', { fs, anchor: 'end', fill: T.muted });
    } else {
      h += tx(300, hy + 70, st.r < 6 ? 'Too cold for water ice to sublimate: little or no coma' : 'Frozen: a bare nucleus, no coma, no tails', { fs: f, anchor: 'middle', fill: T.muted });
    }
    h += `<circle cx="${hx}" cy="${hy}" r="5" fill="${T.fg}" stroke="${T.surface}" stroke-width="1.5"/>`;
    // direction of travel
    const L = 78, ax = hx + vX * L, ay = hy + vY * L;
    h += arrow(hx + vX * 12, hy + vY * 12, ax, ay, T.accent, 2.6, 12);
    const lx = ax + vX * 10, ly = ay + vY * 10 + (vY > 0.3 ? f * 0.8 : vY < -0.3 ? -2 : 4);
    h += tx(clamp(lx, 8, 590), ly, 'travel', { fs, anchor: vX > 0.35 ? 'start' : vX < -0.35 ? 'end' : 'middle', fill: T.accent, weight: 600 });
    svg.innerHTML = h;
    const where = ang > 120 ? 'Coming in toward the Sun: the tails trail roughly behind.' : ang > 60 ? 'Near perihelion: the tails stick out sideways from the path.' : 'Heading away from the Sun: the comet travels tail first.';
    $('#sbHeadOut').innerHTML = `<p class="h">Tails versus direction of travel</p><p class="nm">${A > 0 ? n0(ang) + '° apart' : 'No tails at ' + fx(st.r, 1) + ' AU'}</p><p>${A > 0 ? where : 'Water ice only starts to sublimate within about 3 AU of the Sun. Drag the time slider toward perihelion.'}</p>`;
  }
  function initComets() {
    const eI = $('#sbCoE'), qI = $('#sbCoQ'), tI = $('#sbCoT');
    const pre = (k) => { const c = COMETS[k]; CO.pre = k; CO.e = c.e; CO.q = c.q; eI.value = c.e; qI.value = c.q; store.set('comet', k); press($('#sbCoPre'), k); drawOrb(); };
    seg($('#sbCoPre'), Object.keys(COMETS).map((k) => [k, COMETS[k].n]), CO.pre, (k) => { pre(k); });
    seg($('#sbCoView'), [['whole', 'Whole orbit'], ['inner', 'Near the Sun']], CO.view, (k) => { CO.view = k; press($('#sbCoView'), k); drawOrb(); });
    const custom = () => { CO.pre = 'custom'; CO.e = +eI.value; CO.q = +qI.value; press($('#sbCoPre'), ''); drawOrb(); };
    eI.addEventListener('input', custom); qI.addEventListener('input', custom);
    tI.addEventListener('input', () => { CO.t = tFromU(+tI.value); drawOrb(); });
    $('#sbCoAreas').addEventListener('change', (e) => { CO.areas = e.target.checked; drawOrb(); });
    // click or drag on the orbit: jump to the nearest point
    drag($('#sbOrb'), ([px, py]) => {
      const g = coGeom(), F = coFrame(); let best = 0, bd = 1e18;
      for (let j = 0; j < 720; j++) { const t = j / 720, E = keplerE(TAU * t, g.e), d = Math.pow(F.sx + g.a * (Math.cos(E) - g.e) * F.s - px, 2) + Math.pow(F.sy - g.b * Math.sin(E) * F.s - py, 2); if (d < bd) { bd = d; best = t; } }
      CO.t = best; tI.value = uFromT(best); drawOrb();
    });
    const L = makeLoop('comets', $('#sbOrb'), (dt) => { CO.t = (CO.t + dt / 18) % 1; tI.value = uFromT(CO.t); drawOrb(); });
    L.play = false;
    playBtn($('#sbCoPlay'), L, ['Pause', 'Play']);
    pre(CO.pre); tI.value = uFromT(CO.t);
    redraw.comets = drawOrb;
  }

  /* =====================================================================
     KUIPER BELT & OORT CLOUD
     ===================================================================== */
  const LX = (l) => 50 + l / 5.5 * 870;
  const MARKS = [ // [name, AU, lane, anchor]
    ['Earth', 1, 0, 'start'], ['Jupiter', 5.2, 1, 'middle'], ['Pluto (average)', 39.48, 0, 'end'], ['Neptune', 30.07, 1, 'end'],
    ['Sedna, closest', 76, 0, 'start'], ['Eris (now)', 96, 1, 'start'], ['Heliopause', 122, 2, 'start'], ['Voyager 1', 173, 3, 'start'],
    ['Sedna, farthest', 940, 1, 'middle'], ['Proxima Centauri', 268000, 0, 'end']
  ];
  const LANDMARKS = [['Neptune', 30.07], ['Edge of the Kuiper belt', 50], ['Voyager 1', 173], ['Oort cloud, inner edge', 2000], ['Oort cloud, outer edge', 100000], ['Proxima Centauri', 268000]];
  const OL = { l: Math.log10(30.07) };
  function drawLog() {
    const svg = $('#sbLog'), f = FS(svg, 14, 12), fs = FSs(svg), ax = 172;
    const lane = (i) => 26 + i * (f + 12);
    let h = '';
    // bands
    const band = (a0, a1, col, op, name, y) => { const x0 = LX(Math.log10(a0)), x1 = LX(Math.log10(a1)); h += `<rect x="${fx(x0, 1)}" y="${ax - 11}" width="${fx(x1 - x0, 1)}" height="22" rx="4" fill="${col}" opacity="${op}"/>`; if (name) h += tx((x0 + x1) / 2, y, name, { fs, anchor: 'middle', fill: T.fg, weight: 600 }); };
    band(30, 50, T.ast, 0.7, 'Kuiper belt', ax + 22 + 2 * f);
    band(2000, 100000, T.ion, 0.35, 'Oort cloud (inferred)', ax + 22 + 2 * f);
    band(2000, 20000, T.ion, 0.25, '', 0);
    h += `<line x1="${LX(0)}" y1="${ax}" x2="${LX(5.5)}" y2="${ax}" stroke="${T.muted}" stroke-width="1.4"/>`;
    for (let d = 0; d <= 5; d++) { const X = LX(d); h += `<line x1="${X}" y1="${ax - 6}" x2="${X}" y2="${ax + 6}" stroke="${T.muted}"/>` + tx(X, ax + 12 + f, d === 0 ? '1 AU' : n0(Math.pow(10, d)), { fs, anchor: d === 0 ? 'start' : 'middle', fill: T.muted }); for (let m = 2; m < 10 && d < 5.5; m++) { const xm = LX(d + Math.log10(m)); if (xm < LX(5.5)) h += `<line x1="${fx(xm, 1)}" y1="${ax - 3}" x2="${fx(xm, 1)}" y2="${ax + 3}" stroke="${T.muted}" opacity="0.6"/>`; } }
    // light-time axis
    const ly = ax + 50 + 2 * f;
    h += `<line x1="${LX(0)}" y1="${fx(ly, 1)}" x2="${LX(5.5)}" y2="${fx(ly, 1)}" stroke="${T.line}" stroke-width="1"/>`;
    [['8 light-min', 1], ['1 light-hour', 7.214], ['1 light-day', 173.14], ['1 light-week', 1212], ['1 light-year', 63241]].forEach(([k, a], i) => { const X = LX(Math.log10(a)); h += `<line x1="${fx(X, 1)}" y1="${fx(ly - 5, 1)}" x2="${fx(X, 1)}" y2="${fx(ly + 5, 1)}" stroke="${T.accent}" stroke-width="1.5"/>` + tx(X, ly + 8 + f, k, { fs, anchor: i === 0 ? 'start' : 'middle', fill: T.accent }); });
    h += tx(LX(5.5), ly - 8, 'light-travel time from the Sun', { fs, anchor: 'end', fill: T.muted });
    // markers
    MARKS.forEach(([k, a, ln, anc]) => {
      const X = LX(Math.log10(a)), y = lane(ln);
      h += `<line x1="${fx(X, 1)}" y1="${fx(y + 5, 1)}" x2="${fx(X, 1)}" y2="${ax - 12}" stroke="${T.faint}" stroke-width="1"/><circle cx="${fx(X, 1)}" cy="${ax}" r="4" fill="${T.fg}"/>`;
      h += tx(anc === 'end' ? X + 3 : anc === 'start' ? X - 3 : X, y, k, { fs, anchor: anc, fill: T.fg });
    });
    const X = LX(OL.l);
    h += `<line x1="${fx(X, 1)}" y1="${ax - 24}" x2="${fx(X, 1)}" y2="${ax + 24}" stroke="${T.accent}" stroke-width="2.2"/><circle cx="${fx(X, 1)}" cy="${ax}" r="8" fill="${T.accent}" stroke="${T.surface}" stroke-width="2"/>`;
    svg.innerHTML = h;
  }
  function logOut() {
    const a = Math.pow(10, OL.l), lt = a * 499.0048; // seconds
    const ltS = lt < 3600 ? fx(lt / 60, 1) + ' minutes' : lt < 86400 * 2 ? fx(lt / 3600, 1) + ' hours' : lt < 86400 * 365.25 ? fx(lt / 86400, 1) + ' days' : fx(lt / 86400 / 365.25, 2) + ' years';
    $('#sbLogXOut').textContent = (a < 100 ? fx(a, 1) : n0(a)) + ' AU';
    facts($('#sbLogOut'), [['Distance', (a < 100 ? fx(a, 1) : sigf(a, 3)) + ' AU'], ['In kilometres', sci(a * 1.495979e8, 2) + ' km'], ['Light takes', ltS], ['Voyager 1 (3.6 AU a year) takes', yrs(a / 3.57)], ['Sunlight compared with Earth', a < 1.01 ? 'the same' : '1 / ' + sigf(a * a, 3)]]);
    const lm = LANDMARKS.find(([, d]) => Math.abs(Math.log10(d) - OL.l) < 0.003);
    press($('#sbLogMarks'), lm ? lm[0] : '');
  }
  /* Pluto and Neptune, flat model, exact 3:2 */
  const PN = { frame: 'fixed', t: 0, aN: 30.07, aP: 39.48, eP: 0.2488, PN: 164.79, w: -35 * DEG, path: null, minSep: 0 };
  PN.PP = 1.5 * PN.PN;
  function pnPos(t) {
    const lN = PN.w + 90 * DEG + TAU * t / PN.PN; // Neptune 90° from Pluto's perihelion when Pluto is there
    const E = keplerE(TAU * t / PN.PP, PN.eP), x = PN.aP * (Math.cos(E) - PN.eP), y = PN.aP * Math.sqrt(1 - PN.eP * PN.eP) * Math.sin(E);
    const px = x * Math.cos(PN.w) - y * Math.sin(PN.w), py = x * Math.sin(PN.w) + y * Math.cos(PN.w);
    return { lN, nx: PN.aN * Math.cos(lN), ny: PN.aN * Math.sin(lN), px, py, r: Math.hypot(px, py) };
  }
  function pnPrep() {
    const p = []; let mn = 1e9;
    for (let i = 0; i <= 1200; i++) { const t = i / 1200 * 2 * PN.PP, s = pnPos(t), rot = -s.lN + 90 * DEG; p.push([s.px * Math.cos(rot) - s.py * Math.sin(rot), s.px * Math.sin(rot) + s.py * Math.cos(rot)]); mn = Math.min(mn, Math.hypot(s.px - s.nx, s.py - s.ny)); }
    PN.path = p; PN.minSep = mn;
  }
  function drawPN() {
    const svg = $('#sbPN'), f = FS(svg, 13.5, 12), fs = FSs(svg), c = 250, s = 228 / (PN.aP * (1 + PN.eP)), st = pnPos(PN.t);
    const rotF = PN.frame === 'rot';
    const rot = rotF ? -st.lN + 90 * DEG : 0, R = (x, y) => [c + s * (x * Math.cos(rot) - y * Math.sin(rot)), c - s * (x * Math.sin(rot) + y * Math.cos(rot))];
    let h = `<circle cx="${c}" cy="${c}" r="${fx(PN.aN * s, 1)}" fill="none" stroke="${T.nep}" stroke-width="1.6"${rotF ? ' stroke-dasharray="4 5" opacity="0.6"' : ''}/>`;
    if (rotF) h += `<polyline points="${pts(PN.path.map(([x, y]) => [c + s * x, c - s * y]))}" fill="none" stroke="${T.plu}" stroke-width="1.6" opacity="0.85"/>`;
    else { const op = []; for (let j = 0; j <= 240; j++) { const E = j / 240 * TAU, x = PN.aP * (Math.cos(E) - PN.eP), y = PN.aP * Math.sqrt(1 - PN.eP * PN.eP) * Math.sin(E); op.push(R(x * Math.cos(PN.w) - y * Math.sin(PN.w), x * Math.sin(PN.w) + y * Math.cos(PN.w))); } h += `<polyline points="${pts(op)}" fill="none" stroke="${T.plu}" stroke-width="1.6"/>`; }
    // perihelion inside Neptune's orbit
    const pq = PN.aP * (1 - PN.eP);
    if (!rotF) { const [qx, qy] = R(pq * Math.cos(PN.w), pq * Math.sin(PN.w)); h += `<circle cx="${fx(qx, 1)}" cy="${fx(qy, 1)}" r="3.5" fill="${T.plu}" stroke="${T.surface}" stroke-width="1.5"/>`; }
    h += `<circle cx="${c}" cy="${c}" r="6" fill="#ffc94d"/>`;
    const [nx, ny] = R(st.nx, st.ny), [px, py] = R(st.px, st.py);
    h += `<line x1="${fx(nx, 1)}" y1="${fx(ny, 1)}" x2="${fx(px, 1)}" y2="${fx(py, 1)}" stroke="${T.faint}" stroke-dasharray="2 4"/>`;
    h += `<circle cx="${fx(nx, 1)}" cy="${fx(ny, 1)}" r="8" fill="${T.nep}" stroke="${T.surface}" stroke-width="2"/><circle cx="${fx(px, 1)}" cy="${fx(py, 1)}" r="6" fill="${T.plu}" stroke="${T.surface}" stroke-width="2"/>`;
    const lab = (x, y, s2, col) => { const dx = x - c, dy = y - c, d = Math.hypot(dx, dy) || 1, ox = dx / d, oy = dy / d; return tx(x + ox * 14, y + oy * 14 + 4 + (oy > 0.5 ? f * 0.5 : 0), s2, { fs: f, anchor: ox > 0.3 ? 'start' : ox < -0.3 ? 'end' : 'middle', fill: col, weight: 600 }); };
    h += lab(nx, ny, 'Neptune', T.nep) + lab(px, py, 'Pluto', T.plu);
    h += tx(10, 492, rotF ? 'Turning with Neptune: Pluto\'s path never comes near it' : 'Seen from above, to scale', { fs, fill: T.muted });
    svg.innerHTML = h;
    facts($('#sbPNFacts'), [['Years since Pluto\'s perihelion', n0(PN.t % (2 * PN.PP))], ['Neptune laps / Pluto laps', fx(PN.t / PN.PN, 2) + ' / ' + fx(PN.t / PN.PP, 2)], ['Pluto from the Sun', fx(st.r, 1) + ' AU' + (st.r < PN.aN ? ' (inside Neptune\'s orbit)' : '')], ['Pluto to Neptune now', fx(Math.hypot(st.px - st.nx, st.py - st.ny), 1) + ' AU'], ['Closest they ever get (this model)', fx(PN.minSep, 1) + ' AU']]);
  }
  const DWARFS = [
    { k: 'moon', n: 'Moon (for scale)', d: 3474, col: '#9a9a9a', row: null },
    { k: 'pluto', n: 'Pluto', d: 2377, col: '#d9b48c', size: '2,377 km', m: '1.30 × 10²² kg', a: 39.5, P: 248, moons: '5', visit: 'New Horizons, 2015', txt: 'Water-ice mountains several kilometres high, a heart-shaped plain of frozen nitrogen (Sputnik Planitia) that slowly churns, and a thin, hazy atmosphere. Its largest moon, Charon, is half its width. New Horizons flew past on 14 July 2015.' },
    { k: 'eris', n: 'Eris', d: 2326, col: '#ececf0', size: '2,326 km', m: '1.66 × 10²² kg', a: 67.9, P: 559, moons: '1', visit: '—', txt: 'The most massive dwarf planet known, 27% heavier than Pluto though slightly smaller. Found in 2005 by Mike Brown, Chad Trujillo and David Rabinowitz. One of the brightest surfaces in the Solar System, probably fresh methane frost. It is now near its farthest point, about 96 AU from the Sun.' },
    { k: 'haumea', n: 'Haumea', d: 2322, d2: 1026, col: '#e4e9ee', size: '~2,320 × 1,700 × 1,030 km', m: '4.0 × 10²¹ kg', a: 43.1, P: 284, moons: '2', visit: '—', txt: 'Spins once every 3.9 hours, so fast that it is stretched into an egg shape more than twice as long as it is thick. It has a ring, found in 2017, and two moons, and is the largest of a family of icy fragments from an ancient collision.' },
    { k: 'makemake', n: 'Makemake', d: 1430, col: '#c98f68', size: '~1,430 km', m: '~3.1 × 10²¹ kg', a: 45.4, P: 306, moons: '1', visit: '—', txt: 'Reddish and coated in frozen methane and ethane. Its one known moon was found in 2016; its mass is still uncertain.' },
    { k: 'ceres', n: 'Ceres', d: 939, col: '#77716b', size: '939 km', m: '9.38 × 10²⁰ kg', a: 2.77, P: 4.6, moons: '0', visit: 'Dawn, 2015–2018', txt: 'The only dwarf planet in the inner Solar System, and the largest body in the asteroid belt. Dawn found briny water ice beneath its surface and salt deposits where it reached the top.' }
  ];
  const DW = { sel: store.get('dwarf') || 'pluto' };
  function drawDwarf() {
    const svg = $('#sbDwarf'), f = FS(svg, 14, 12), fs = FSs(svg), k = 200 / 3474, cy = 124;
    let x = 12, h = '';
    DWARFS.forEach((b) => {
      const rx = b.d / 2 * k, ry = (b.d2 || b.d) / 2 * k, cx = x + rx, on = b.k === DW.sel;
      h += `<g class="sb-hit" data-k="${b.k}"><ellipse cx="${fx(cx, 1)}" cy="${cy}" rx="${fx(rx, 1)}" ry="${fx(ry, 1)}" fill="${b.col}" stroke="${on ? T.accent : T.line}" stroke-width="${on ? 3.5 : 1}"/>`;
      h += tx(cx, cy + 100 + 8 + f, b.n, { fs: f, anchor: 'middle', fill: on ? T.accent : T.fg, weight: 600 }) + tx(cx, cy + 100 + 14 + 2 * f, n0(b.d) + ' km', { fs, anchor: 'middle', fill: T.muted }) + '</g>';
      x += 2 * rx + 22;
    });
    svg.innerHTML = h;
  }
  function dwarfPick(k) {
    const b = DWARFS.find((d) => d.k === k && d.k !== 'moon') || DWARFS[1]; DW.sel = b.k; store.set('dwarf', b.k);
    press($('#sbDwarfSeg'), b.k); drawDwarf();
    $$('#sbDwarfTable tbody tr').forEach((tr) => tr.classList.toggle('on', tr.dataset.k === b.k));
    $('#sbDwarfOut').innerHTML = `<p class="h">Dwarf planet</p><p class="nm">${b.n}</p><p>${b.txt}</p>`;
  }
  function initOuter() {
    const inp = $('#sbLogX');
    const set = (l) => { OL.l = clamp(l, 0, 5.5); inp.value = OL.l; drawLog(); logOut(); };
    seg($('#sbLogMarks'), LANDMARKS.map(([k]) => [k, k]), '', (k) => set(Math.log10(LANDMARKS.find((m) => m[0] === k)[1])));
    inp.addEventListener('input', () => set(+inp.value));
    drag($('#sbLog'), ([X]) => set((X - 50) / 870 * 5.5));
    set(OL.l);
    pnPrep();
    seg($('#sbPNFrame'), [['fixed', 'Seen from above'], ['rot', 'Turning with Neptune']], PN.frame, (k) => { PN.frame = k; press($('#sbPNFrame'), k); drawPN(); });
    const L = makeLoop('outer', $('#sbPN'), (dt) => { PN.t += dt * 25; drawPN(); });
    playBtn($('#sbPNPlay'), L, ['Pause', 'Play']);
    drawPN();
    $('#sbDwarfTable tbody').innerHTML = DWARFS.slice(1).map((b) => `<tr data-k="${b.k}"><td>${b.n}</td><td>${b.size}</td><td>${b.m}</td><td>${fx(b.a, b.a < 10 ? 2 : 1)} AU</td><td>${b.P < 10 ? fx(b.P, 1) : n0(b.P)} yr</td><td>${b.moons}</td><td>${b.visit}</td></tr>`).join('');
    seg($('#sbDwarfSeg'), DWARFS.slice(1).map((b) => [b.k, b.n]), DW.sel, dwarfPick);
    $('#sbDwarf').addEventListener('click', (e) => { const g = e.target.closest('.sb-hit'); if (g && g.dataset.k !== 'moon') dwarfPick(g.dataset.k); });
    dwarfPick(DW.sel);
    redraw.outer = () => { drawLog(); drawPN(); drawDwarf(); };
  }

  /* =====================================================================
     IMPACTS — atmospheric entry and crater size after Collins, Melosh & Marcus (2005)
     ===================================================================== */
  const MT = 4.184e15;
  const MATS = { ice: { n: 'Ice', rho: 1000 }, stone: { n: 'Stone', rho: 3000 }, iron: { n: 'Iron', rho: 7800 } };
  /* Atmospheric entry, the analytic method of Collins, Melosh & Marcus (2005). Air: ρ = 1 kg/m³ · e^(−z / 8 km), C_D = 2.
     Strength Y_i = 10^(2.107 + 0.0624 √ρ_i) Pa. Before break-up the body slows as v = v₀ exp(−3 ρ(z) C_D H / (4 ρ_i L sin θ)).
     It breaks up at the altitude z* where ρ(z) v² reaches Y_i (their eq. 11); the fragments then spread as a "pancake", and
     the airburst altitude is where it has spread to 7 times its size (eq. 18). Below z* the speed is integrated numerically. */
  function entry(L0, rho, v0, thDeg) {
    const H = 8000, CD = 2, fp = 7, s = Math.sin(thDeg * DEG), Y = Math.pow(10, 2.107 + 0.0624 * Math.sqrt(rho));
    const m = rho * Math.PI / 6 * Math.pow(L0, 3), E0 = 0.5 * m * v0 * v0, rz = (z) => Math.exp(-z / H);
    const vPre = (z) => v0 * Math.exp(-3 * rz(z) * CD * H / (4 * rho * L0 * s));
    const If = 4.07 * CD * H * Y / (rho * L0 * v0 * v0 * s);
    let zBreak = null, zBurst = null;
    const vk = new Float64Array(101); // speed at each whole km of height
    let kEnd = -1, vEnd, spread = 1;
    if (If < 1) {
      const zs = -H * (Math.log(Y / (v0 * v0)) + 1.308 - 0.314 * If - 1.303 * Math.sqrt(1 - If));
      if (zs > 0) zBreak = Math.min(zs, 99e3);
    }
    if (zBreak === null) { for (let k = 100; k >= 0; k--) vk[k] = vPre(k * 1000); vEnd = vk[0]; }
    else {
      const vb = vPre(zBreak), rb = rz(zBreak), l = L0 * s * Math.sqrt(rho / (CD * rb));
      const zb = zBreak - 2 * H * Math.log(1 + l / (2 * H) * Math.sqrt(fp * fp - 1));
      const Lz = (z) => L0 * Math.sqrt(1 + Math.pow(2 * H / l, 2) * Math.pow(Math.exp((zBreak - z) / (2 * H)) - 1, 2));
      const K = 0.75 * CD * rb / (rho * Math.pow(L0, 3) * s), zLow = Math.max(0, zb);
      for (let k = 100; k * 1000 >= zBreak; k--) vk[k] = vPre(k * 1000);
      let I = 0, z = zBreak, k = Math.floor(zBreak / 1000);
      const dz = 5;
      while (z > zLow) {
        const z2 = Math.max(zLow, z - dz), zm = (z + z2) / 2, Lm = Lz(zm);
        I += Math.exp((zBreak - zm) / H) * Lm * Lm * (z - z2); z = z2;
        while (k >= 0 && z <= k * 1000) { vk[k] = vb * Math.exp(-K * I); k--; }
      }
      vEnd = vb * Math.exp(-K * I);
      if (zb > 0) { zBurst = zb; kEnd = k; } else spread = Lz(0) / L0;
    }
    // energy lost in each 1 km layer; at an airburst what is left goes off at once
    const bins = new Float64Array(100);
    for (let k = 99; k > kEnd && k >= 0; k--) bins[k] = 0.5 * m * (vk[k + 1] * vk[k + 1] - vk[k] * vk[k]);
    if (zBurst !== null) { const kb = clamp(Math.floor(zBurst / 1000), 0, 99); bins[kb] = 0.5 * m * vk[kb + 1] * vk[kb + 1]; }
    const ground = zBurst === null;
    return { m, E0, Y, If, zBreak, zBurst, spread, vImp: ground ? vEnd : 0, Eimp: ground ? 0.5 * m * vEnd * vEnd : 0, bins, vk, kEnd };
  }
  function crater(L, rho, v, thDeg) { // final crater diameter (m) on a rock target, 2,500 kg/m³
    const Dtc = 1.161 * Math.pow(rho / 2500, 1 / 3) * Math.pow(L, 0.78) * Math.pow(v, 0.44) * Math.pow(9.81, -0.22) * Math.pow(Math.sin(thDeg * DEG), 1 / 3);
    if (Dtc * 1.25 <= 3200) return { Dtc, D: 1.25 * Dtc, simple: true, depth: 0.2 * 1.25 * Dtc };
    const Dk = 1.17 * Math.pow(Dtc / 1000, 1.13) / Math.pow(3.2, 0.13);
    return { Dtc, D: Dk * 1000, simple: false, depth: 400 * Math.pow(Dk, 0.3) };
  }
  // average years between impacts of bodies at least this wide (rough): Brown et al. (2002) fit below ~30 m, then other estimates
  function brownYears(D) { const E = 0.5 * 3000 * Math.PI / 6 * Math.pow(D, 3) * 4e8 / 4.184e12; return 1 / (3.7 * Math.pow(E, -0.9)); }
  function interval(D) {
    if (D <= 30) return brownYears(D);
    const N = [[Math.log10(30), Math.log10(brownYears(30))], [Math.log10(50), Math.log10(450)], [3, Math.log10(5e5)], [4, 8]];
    const l = Math.log10(D);
    for (let i = 0; i < N.length - 1; i++) if (l <= N[i + 1][0] || i === N.length - 2) { const u = (l - N[i][0]) / (N[i + 1][0] - N[i][0]); return Math.pow(10, N[i][1] + u * (N[i + 1][1] - N[i][1])); }
    return 1e8;
  }
  const IMP_PRE = {
    chel: { n: 'Chelyabinsk 2013', D: 19, mat: 'stone', v: 19, a: 18, obs: 'Burst about 30 km up, roughly 0.5 Mt (Popova et al. 2013)' },
    tung: { n: 'Tunguska 1908', D: 55, mat: 'stone', v: 20, a: 45, obs: 'Burst a few km up; 3 to 15 Mt, estimates vary' },
    meteor: { n: 'Meteor Crater', D: 40, mat: 'iron', v: 17, a: 45, obs: 'Crater 1.2 km wide, about 50,000 years ago; impactor about 40 m, hit at ~12 km/s (Melosh & Collins 2005)' },
    chix: { n: 'Chicxulub', D: 10000, mat: 'stone', v: 20, a: 60, obs: 'Crater about 180 km wide, 66 million years ago' }
  };
  const IM = { pre: 'chel', D: 19, mat: 'stone', v: 19, a: 18 };
  const fmtE = (J) => { const mt = J / MT; return mt >= 1 ? sigf(mt, mt < 1e4 ? 2 : 3) + ' Mt' : mt >= 1e-3 ? sigf(mt * 1e3, 2) + ' kt' : sigf(mt * 1e6, 2) + ' t'; };
  const fmtL = (m) => (m >= 1000 ? sigf(m / 1000, m >= 1e4 ? 3 : 2) + ' km' : sigf(m, 2) + ' m');
  function impact() {
    const rho = MATS[IM.mat].rho, en = entry(IM.D, rho, IM.v * 1000, IM.a);
    const cr = en.vImp > 3000 ? crater(IM.D, rho, en.vImp, IM.a) : null;
    return { rho, en, cr };
  }
  function drawImp(R) {
    const svg = $('#sbImp'), f = FS(svg, 13.5, 12), fs = FSs(svg), en = R.en;
    const x0 = 88, x1 = 572, y0 = 22, y1 = 314, Y = (km) => y1 - km / 100 * (y1 - y0), v0 = IM.v * 1000;
    let h = '';
    for (let km = 0; km <= 100; km += 20) h += `<line x1="${x0}" y1="${fx(Y(km), 1)}" x2="${x1}" y2="${fx(Y(km), 1)}" stroke="${T.lineSoft}"/>` + tx(x0 - 8, Y(km) + f * 0.35, km + ' km', { fs, anchor: 'end', fill: T.muted });
    let mx = 0; en.bins.forEach((b) => { mx = Math.max(mx, b); });
    en.bins.forEach((b, i) => { if (b <= 0) return; const w = b / mx * (x1 - x0); h += `<rect x="${x0}" y="${fx(Y(i + 1), 2)}" width="${fx(Math.max(1, w), 2)}" height="${fx(Y(i) - Y(i + 1), 2)}" fill="${T.heat}" opacity="0.75"/>`; });
    const vp = []; for (let k = 100; k > en.kEnd; k--) vp.push([x0 + en.vk[k] / v0 * (x1 - x0), Y(k)]);
    if (vp.length > 1) h += `<polyline points="${pts(vp)}" fill="none" stroke="${T.ion}" stroke-width="2.4"/>`;
    h += `<line x1="${x0}" y1="${y1}" x2="${x1}" y2="${y1}" stroke="${T.fg}" stroke-width="2"/>` + `<line x1="${x0}" y1="${y0}" x2="${x0}" y2="${y1}" stroke="${T.muted}"/>`;
    [0, 0.5, 1].forEach((u) => h += tx(x0 + u * (x1 - x0), y1 + 6 + f, fx(IM.v * u, u === 0.5 ? 1 : 0), { fs, anchor: u === 0 ? 'start' : u === 1 ? 'end' : 'middle', fill: T.ion }));
    h += tx((x0 + x1) / 2, y1 + 10 + 2 * f, 'speed, km/s', { fs, anchor: 'middle', fill: T.ion });
    const lineAt = (z, txt, col, dash, below) => { const yy = Y(z / 1000); h += `<line x1="${x0}" y1="${fx(yy, 1)}" x2="${x1}" y2="${fx(yy, 1)}" stroke="${col}" stroke-width="1.6"${dash ? ' stroke-dasharray="6 4"' : ''}/>` + tx(x1 - 4, below ? yy + f + 3 : yy - 6, txt, { fs, anchor: 'end', fill: col, weight: 600 }); };
    if (en.zBreak !== null) lineAt(en.zBreak, 'breaks up · ' + fx(en.zBreak / 1000, 0) + ' km', T.muted, true, false);
    if (en.zBurst !== null) lineAt(en.zBurst, 'airburst · ' + fx(en.zBurst / 1000, 0) + ' km', T.accent, false, Y(en.zBurst / 1000) + f + 3 < y1 - 4);
    if (en.vImp > 0) h += tx(x1 - 4, y1 - 8, 'hits the ground at ' + fx(en.vImp / 1000, 1) + ' km/s', { fs, anchor: 'end', fill: T.accent, weight: 600 });
    svg.innerHTML = h;
    // crater cross-section
    const cs = $('#sbCrater'), gy = 74; let c = '';
    c += `<rect x="0" y="${gy}" width="600" height="112" fill="#8a6a4a" opacity="0.35"/><line x1="0" y1="${gy}" x2="600" y2="${gy}" stroke="${T.fg}" stroke-width="1.5"/>`;
    if (R.cr) {
      const W = 420, k = W / R.cr.D, d = Math.max(4, R.cr.depth * k), x0c = 300 - W / 2, x1c = 300 + W / 2, rim = Math.max(2, d * 0.18);
      let path;
      if (R.cr.simple) path = `M${x0c - 30},${gy} Q${x0c - 8},${gy - rim} ${x0c},${gy - rim} C${x0c + W * 0.2},${gy + d} ${x1c - W * 0.2},${gy + d} ${x1c},${gy - rim} Q${x1c + 8},${gy - rim} ${x1c + 30},${gy} Z`;
      else path = `M${x0c - 30},${gy} L${x0c},${gy - rim} L${x0c + W * 0.12},${gy + d * 0.6} L${x0c + W * 0.25},${gy + d} L${300 - W * 0.06},${gy + d} L300,${gy + d * 0.45} L${300 + W * 0.06},${gy + d} L${x1c - W * 0.25},${gy + d} L${x1c - W * 0.12},${gy + d * 0.6} L${x1c},${gy - rim} L${x1c + 30},${gy} Z`;
      c += `<path d="${path}" fill="${T.surface}" stroke="${T.fg}" stroke-width="1.5"/>`;
      c += `<line x1="${x0c}" y1="${gy - 22}" x2="${x1c}" y2="${gy - 22}" stroke="${T.accent}" stroke-width="1.4"/><line x1="${x0c}" y1="${gy - 28}" x2="${x0c}" y2="${gy - 16}" stroke="${T.accent}"/><line x1="${x1c}" y1="${gy - 28}" x2="${x1c}" y2="${gy - 16}" stroke="${T.accent}"/>`;
      c += tx(300, gy - 28, (R.cr.simple ? 'simple crater ' : 'complex crater ') + fmtL(R.cr.D) + ' wide', { fs, anchor: 'middle', fill: T.accent, weight: 600 });
      const ri = Math.max(1.5, IM.D * k / 2);
      c += `<circle cx="${fx(x0c - 50, 1)}" cy="${gy - 22}" r="${fx(ri, 1)}" fill="${T.fg}"/>` + tx(8, Math.max(fs + 2, gy - 30 - ri), 'impactor', { fs, fill: T.muted });
      c += tx(300, 178, 'cross-section to scale · depth about ' + fmtL(R.cr.depth), { fs, anchor: 'middle', fill: T.fg, hc: T.surface });
    } else if (en.zBurst !== null) {
      c += `<circle cx="300" cy="26" r="12" fill="${T.accent}" opacity="0.9"/><path d="M200,${gy} Q300,-40 400,${gy}" fill="none" stroke="${T.accent}" stroke-width="1.5" stroke-dasharray="5 5"/>`;
      c += tx(300, 116, 'No crater: it exploded ' + fx(en.zBurst / 1000, 0) + ' km up.', { fs: f, anchor: 'middle', weight: 600 }) + tx(300, 120 + f + 4, 'The blast wave and heat reach the ground.', { fs, anchor: 'middle', fill: T.muted });
    } else {
      c += tx(300, 116, 'No explosion crater: braked by the air', { fs: f, anchor: 'middle', weight: 600 }) + tx(300, 120 + f + 4, 'Pieces may survive as meteorites.', { fs, anchor: 'middle', fill: T.muted });
    }
    cs.innerHTML = c;
  }
  function impOut(R) {
    const en = R.en, p = IMP_PRE[IM.pre];
    let nm, msg;
    if (R.cr) { nm = 'Crater about ' + fmtL(R.cr.D) + ' wide'; msg = `It reaches the ground at ${fx(en.vImp / 1000, 1)} km/s, keeping ${n0(en.Eimp / en.E0 * 100)}% of its energy. The crater is about ${n0(R.cr.D / IM.D)} times wider than the impactor${R.cr.simple ? ': a simple bowl.' : ': wide enough to collapse into a complex crater with a central peak.'}`; }
    else if (en.zBurst !== null) { nm = 'Airburst ' + fx(en.zBurst / 1000, 0) + ' km up'; msg = `The air in front of it builds up more pressure than the body can stand. It breaks up${en.zBreak ? ' at ' + fx(en.zBreak / 1000, 0) + ' km' : ''}, the fragments spread out, and nearly all its energy goes into the air at once.`; }
    else { nm = 'Braked by the air'; msg = `It reaches the ground at only ${fx(en.vImp / 1000, 1)} km/s or less: too slow for an explosion crater. Small bodies like this end up falling at a few hundred km/h and land as meteorites.`; }
    $('#sbImpHead').innerHTML = `<p class="h">Result</p><p class="nm">${nm}</p><p>${msg}</p>`;
    const iv = interval(IM.D);
    facts($('#sbImpFacts'), [['Mass', sci(en.m, 1) + ' kg'], ['Energy entering the air', fmtE(en.E0) + ' of TNT'], ['That is', sigf(en.E0 / (15e-3 * MT), 2) + ' × Hiroshima (15 kt)'], ['Strength (resists crushing to)', sigf(en.Y / 1e6, 2) + ' MPa'], ['Breaks up at', en.zBreak === null ? 'does not break up' : fx(en.zBreak / 1000, 0) + ' km' + (en.zBurst !== null ? '' : en.spread < 1.5 ? ', but lands before the pieces spread' : ', pieces spread to ' + fx(en.spread, 1) + '× its width')], ['This size or bigger hits Earth', 'every ' + yrs(iv) + ', roughly']].concat(p ? [['Observed', p.obs]] : []));
  }
  function drawFreq() {
    const svg = $('#sbFreq'), f = FS(svg, 13.5, 12), fs = FSs(svg);
    const x0 = 92, x1 = 616, y0 = 18, y1 = 318, X = (D) => x0 + (Math.log10(D) - 0) / 4.3 * (x1 - x0), Y = (y) => y1 - (Math.log10(y) + 2) / 11 * (y1 - y0);
    let h = '';
    [[1, '1 m'], [10, '10 m'], [100, '100 m'], [1000, '1 km'], [10000, '10 km']].forEach(([D, k]) => { h += `<line x1="${fx(X(D), 1)}" y1="${y0}" x2="${fx(X(D), 1)}" y2="${y1}" stroke="${T.lineSoft}"/>` + tx(X(D), y1 + 6 + f, k, { fs, anchor: D === 1 ? 'start' : 'middle', fill: T.muted }); });
    [[0.01, '4 days'], [1, '1 yr'], [100, '100 yr'], [1e4, '10⁴ yr'], [1e6, '1 Myr'], [1e8, '100 Myr']].forEach(([y, k]) => { h += `<line x1="${x0}" y1="${fx(Y(y), 1)}" x2="${x1}" y2="${fx(Y(y), 1)}" stroke="${T.lineSoft}"/>` + tx(x0 - 6, Y(y) + f * 0.35, k, { fs, anchor: 'end', fill: T.muted }); });
    h += `<line x1="${x0}" y1="${y1}" x2="${x1}" y2="${y1}" stroke="${T.muted}"/><line x1="${x0}" y1="${y0}" x2="${x0}" y2="${y1}" stroke="${T.muted}"/>`;
    h += tx((x0 + x1) / 2, y1 + 12 + 2 * f, 'impactor diameter', { fs, anchor: 'middle', fill: T.muted });
    const solid = [], dash = [];
    for (let l = 0; l <= 2.3; l += 0.02) { const D = Math.pow(10, l); (l <= 1.7 ? solid : dash).push([X(D), Y(brownYears(D))]); }
    dash.unshift(solid[solid.length - 1]);
    h += `<polyline points="${pts(solid)}" fill="none" stroke="${T.accent}" stroke-width="2.6"/><polyline points="${pts(dash)}" fill="none" stroke="${T.accent}" stroke-width="2" stroke-dasharray="6 5"/>`;
    h += tx(X(5), Y(brownYears(5)) + 8 + f, 'Brown et al. 2002', { fs, fill: T.accent, weight: 600 });
    [[19, 50, 100, 'Chelyabinsk size'], [50, 200, 1000, 'Tunguska size'], [1000, 3e5, 8e5, '1 km'], [10000, 5e7, 2e8, 'Chicxulub size']].forEach(([D, lo, hi, k]) => {
      const xx = X(D);
      h += `<line x1="${fx(xx, 1)}" y1="${fx(Y(lo), 1)}" x2="${fx(xx, 1)}" y2="${fx(Y(hi), 1)}" stroke="${T.fg}" stroke-width="2"/><circle cx="${fx(xx, 1)}" cy="${fx(Y(Math.sqrt(lo * hi)), 1)}" r="5" fill="${T.fg}"/>`;
      const right = D < 5000;
      h += tx(right ? xx + 10 : xx - 10, Y(Math.sqrt(lo * hi)) + f * 0.35, k, { fs, anchor: right ? 'start' : 'end', fill: T.fg });
    });
    const D = IM.D, iv = interval(D), xm = X(D), ym = Y(iv);
    h += `<line x1="${fx(xm, 1)}" y1="${y0}" x2="${fx(xm, 1)}" y2="${y1}" stroke="${T.ion}" stroke-width="1.6" stroke-dasharray="3 3"/><circle cx="${fx(xm, 1)}" cy="${fx(ym, 1)}" r="7" fill="none" stroke="${T.ion}" stroke-width="2.5"/>`;
    const lab = fmtL(D) + ': every ~' + yrs(iv), lr = xm + 8 + lab.length * 0.56 * fs < 636;
    h += tx(lr ? xm + 8 : xm - 8, y1 - 10, lab, { fs, anchor: lr ? 'start' : 'end', fill: T.ion, weight: 600 });
    svg.innerHTML = h;
  }
  /* DART: Dimorphos period 11.921 h before, 33.0 min shorter after (Thomas et al. 2023) */
  const DA = { t: 0, P0: 11.921, P1: 11.921 - 33 / 60 };
  function drawDart() {
    const svg = $('#sbDart'), f = FS(svg, 13.5, 12), fs = FSs(svg), c = 210, a0 = 1190, k = 150 / a0, a1 = a0 * Math.pow(DA.P1 / DA.P0, 2 / 3), th = DA.t * 24;
    const ang0 = -90 * DEG + TAU * th / DA.P0, ang1 = -90 * DEG + TAU * th / DA.P1;
    let h = `<circle cx="${c}" cy="${c}" r="${fx(a0 * k, 1)}" fill="none" stroke="${T.muted}" stroke-dasharray="4 5"/><circle cx="${c}" cy="${c}" r="${fx(a1 * k, 1)}" fill="none" stroke="${T.accent}" stroke-width="1.4"/>`;
    h += `<circle cx="${c}" cy="${c}" r="${fx(380 * k, 1)}" fill="#8b8178"/>` + tx(c, c + 5, 'Didymos', { fs: f, anchor: 'middle', fill: '#f5f1ea', hc: '#4a433d' });
    const g = [c + a0 * k * Math.cos(ang0), c - a0 * k * Math.sin(ang0)], p = [c + a1 * k * Math.cos(ang1), c - a1 * k * Math.sin(ang1)], r = 75 * k;
    h += `<circle cx="${fx(g[0], 1)}" cy="${fx(g[1], 1)}" r="${fx(r, 1)}" fill="none" stroke="${T.muted}" stroke-width="2" stroke-dasharray="3 2"/>`;
    h += `<circle cx="${fx(p[0], 1)}" cy="${fx(p[1], 1)}" r="${fx(r, 1)}" fill="${T.accent}"/>`;
    const side = Math.abs(Math.cos(ang0)) > 0.5, out = (q, ang, d, s2, col, wt) => { const ox = Math.cos(ang), oy = -Math.sin(ang); if (side) return tx(q[0], q[1] + (d > 0 ? r + 6 + fs : -r - 8), s2, { fs, anchor: 'middle', fill: col, weight: wt }); return tx(q[0] + ox * d, q[1] + oy * d + fs * 0.35, s2, { fs, anchor: ox > 0.35 ? 'start' : ox < -0.35 ? 'end' : 'middle', fill: col, weight: wt }); };
    h += out(g, ang0, 22, 'without DART', T.muted) + out(p, ang1, -24, 'Dimorphos', T.accent, 600);
    if (DA.t === 0) h += arrow(c + 175, p[1], p[0] + 14, p[1], T.fg, 2, 10) + tx(c + 175, p[1] - 10, 'DART', { fs, anchor: 'end', weight: 600 });
    svg.innerHTML = h;
    const orbits = th / DA.P1, dAng = ((ang1 - ang0) / DEG % 360 + 360) % 360, early = orbits * 33;
    $('#sbDartTOut').textContent = DA.t < 2 ? fx(th, 0) + ' hours' : fx(DA.t, 1) + ' days';
    facts($('#sbDartFacts'), [['Orbits since the impact', fx(orbits, 1)], ['Arrives early by', early < 120 ? fx(early, 0) + ' min' : fx(early / 60, 1) + ' hours'], ['Angle ahead of the old schedule', n0(dAng) + '°'], ['Orbit period before / after', '11 h 55 min / 11 h 22 min'], ['Orbit radius shrank by (Kepler III)', n0(a0 - a1) + ' m']]);
  }
  function initImpacts() {
    const dI = $('#sbImpD'), vI = $('#sbImpV'), aI = $('#sbImpA');
    const run = () => {
      $('#sbImpDOut').textContent = fmtL(IM.D); $('#sbImpVOut').textContent = fx(IM.v, 1) + ' km/s'; $('#sbImpAOut').textContent = n0(IM.a) + '°';
      press($('#sbImpRho'), IM.mat); press($('#sbImpPre'), IM.pre);
      const R = impact(); drawImp(R); impOut(R); drawFreq();
    };
    const pre = (k) => { const p = IMP_PRE[k]; Object.assign(IM, { pre: k, D: p.D, mat: p.mat, v: p.v, a: p.a }); dI.value = Math.log10(p.D); vI.value = p.v; aI.value = p.a; store.set('imp', k); run(); };
    seg($('#sbImpPre'), Object.keys(IMP_PRE).map((k) => [k, IMP_PRE[k].n]), IM.pre, pre);
    seg($('#sbImpRho'), Object.keys(MATS).map((k) => [k, `${MATS[k].n} · ${n0(MATS[k].rho)} kg/m³`]), IM.mat, (k) => { IM.mat = k; IM.pre = ''; run(); });
    dI.addEventListener('input', () => { IM.D = Math.pow(10, +dI.value); IM.pre = ''; run(); });
    vI.addEventListener('input', () => { IM.v = +vI.value; IM.pre = ''; run(); });
    aI.addEventListener('input', () => { IM.a = +aI.value; IM.pre = ''; run(); });
    pre(IMP_PRE[store.get('imp')] ? store.get('imp') : 'chel');
    const tI = $('#sbDartT');
    tI.addEventListener('input', () => { DA.t = +tI.value; drawDart(); });
    const L = makeLoop('impacts', $('#sbDart'), (dt) => { DA.t += dt * 1.5; if (DA.t > 30) DA.t = 0; tI.value = DA.t; drawDart(); });
    L.play = false;
    playBtn($('#sbDartPlay'), L, ['Pause', 'Play']);
    drawDart();
    redraw.impacts = run;
    const rd = redraw.impacts; redraw.impacts = () => { rd(); drawDart(); };
  }

  /* =====================================================================
     METEORS & METEORITES — IMO 2026 calendar values
     ===================================================================== */
  const MD = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
  const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const doy = (m, d) => MD[m - 1] + d - 1;
  const dstr = (dd) => { dd = ((Math.round(dd) % 365) + 365) % 365; let m = 11; while (MD[m] > dd) m--; return (dd - MD[m] + 1) + ' ' + MON[m]; };
  const SHOWERS = [
    { k: 'qua', n: 'Quadrantids', pk: doy(1, 3), s0: doy(12, 28) - 365, s1: doy(1, 12), zhr: 80, zn: '80 (60–200, varies)', sd: 0.4, rad: 'Boötes', ra: '15h 18m', dec: '+49.5°', v: 41, par: '2003 EH1, an asteroid that may be a dead comet', q: 1.19, e: 0.62, hemi: 'Northern', txt: 'A strong but brief shower: full strength lasts only about six hours, so many years it is missed. Named after an old constellation, Quadrans Muralis, now part of Boötes.' },
    { k: 'lyr', n: 'Lyrids', pk: doy(4, 22), s0: doy(4, 14), s1: doy(4, 30), zhr: 18, zn: '18', sd: 1.2, rad: 'Lyra', ra: '18h 04m', dec: '+34°', v: 49, par: 'Comet Thatcher (C/1861 G1)', q: 0.92, e: 0.983, hemi: 'Northern', txt: 'The oldest recorded shower: Chinese observers described meteors falling "like rain" in 687 BCE. Its parent comet takes about 415 years per orbit.' },
    { k: 'eta', n: 'Eta Aquariids', pk: doy(5, 6), s0: doy(4, 19), s1: doy(5, 28), zhr: 50, zn: '50', sd: 5, rad: 'Aquarius', ra: '22h 32m', dec: '−1°', v: 66, par: 'Comet Halley (1P)', q: 0.586, e: 0.967, hemi: 'Southern and tropics', txt: 'Dust from Halley\'s Comet, met where its orbit passes Earth\'s in May. The radiant rises only shortly before dawn, so it is best seen from the southern hemisphere.' },
    { k: 'per', n: 'Perseids', pk: doy(8, 12), s0: doy(7, 17), s1: doy(8, 24), zhr: 100, zn: '100', sd: 2.5, rad: 'Perseus', ra: '03h 12m', dec: '+58°', v: 59, par: 'Comet Swift–Tuttle (109P)', q: 0.96, e: 0.963, hemi: 'Northern', txt: 'The favourite shower of the northern summer, rich in bright meteors. Its parent, 26 km across, is the largest object known to pass repeatedly near Earth; it returns in 2126.' },
    { k: 'ori', n: 'Orionids', pk: doy(10, 21), s0: doy(10, 2), s1: doy(11, 7), zhr: 20, zn: '20', sd: 4, rad: 'Orion', ra: '06h 20m', dec: '+16°', v: 66, par: 'Comet Halley (1P)', q: 0.586, e: 0.967, hemi: 'Both hemispheres', txt: 'Halley\'s dust again, where its orbit passes Earth\'s in October. Fast meteors, often leaving glowing trains.' },
    { k: 'leo', n: 'Leonids', pk: doy(11, 17), s0: doy(11, 6), s1: doy(11, 30), zhr: 10, zn: '10–15; storms in 1833, 1966, 1999–2002', sd: 1.5, rad: 'Leo', ra: '10h 08m', dec: '+22°', v: 71, par: 'Comet Tempel–Tuttle (55P)', q: 0.976, e: 0.906, hemi: 'Both hemispheres', txt: 'The fastest shower: Leonids hit head-on at 71 km/s. Usually modest, but when Earth crosses a fresh, dense trail the rate can jump to thousands per hour, as in 1833 and 1966.' },
    { k: 'gem', n: 'Geminids', pk: doy(12, 14), s0: doy(12, 1), s1: doy(12, 20), zhr: 150, zn: '150', sd: 1.2, rad: 'Gemini', ra: '07h 28m', dec: '+32°', v: 35, par: 'Asteroid 3200 Phaethon', q: 0.14, e: 0.89, hemi: 'Both (best from the north)', txt: 'The strongest shower of the year, with slow, bright meteors. Its parent is a rocky asteroid that passes very close to the Sun, where heat cracks off its dust.' }
  ];
  const ME = { sel: SHOWERS.some((s) => s.k === store.get('shower')) ? store.get('shower') : 'per', day: doy(8, 12) };
  const shw = () => SHOWERS.find((s) => s.k === ME.sel);
  const lonE = (dd) => ((dd - 79.3) * 360 / 365.2422 + 180) * DEG; // Earth's heliocentric longitude, about
  function dayDist(a, b) { let d = (a - b) % 365; if (d > 182.5) d -= 365; if (d < -182.5) d += 365; return d; }
  const rateAt = (s, dd) => s.zhr * Math.exp(-0.5 * Math.pow(dayDist(dd, s.pk) / s.sd, 2));
  function drawCal() {
    const svg = $('#sbCal'), f = FS(svg, 14, 12), fs = FSs(svg), x0 = 40, x1 = 940, base = 214, X = (dd) => x0 + dd / 365 * (x1 - x0);
    let h = `<defs><clipPath id="sbCalClip"><rect x="${x0}" y="0" width="${x1 - x0}" height="${base + 1}"/></clipPath></defs>`;
    MD.forEach((m, i) => { const xa = X(m), xb = X(i < 11 ? MD[i + 1] : 365); h += `<line x1="${fx(xa, 1)}" y1="20" x2="${fx(xa, 1)}" y2="${base + 4}" stroke="${T.lineSoft}"/>` + tx((xa + xb) / 2, base + 8 + f, MON[i], { fs, anchor: 'middle', fill: T.muted }); });
    h += `<line x1="${x0}" y1="${base}" x2="${x1}" y2="${base}" stroke="${T.muted}"/>`;
    const lev = { lyr: 0, eta: 0 };
    h += `<g clip-path="url(#sbCalClip)">`;
    SHOWERS.forEach((s) => {
      const on = s.k === ME.sel, ht = 26 + s.zhr * 0.95, col = on ? T.accent : T.muted;
      [0, 365].forEach((off) => {
        if (s.s0 + off > 365 || s.s1 + off < 0) return;
        h += `<polygon class="sb-hit" data-k="${s.k}" points="${pts([[X(s.s0 + off), base], [X(s.pk + off), base - ht], [X(s.s1 + off), base]])}" fill="${col}" opacity="${on ? 0.85 : 0.45}" stroke="${col}" stroke-width="1.2"/>`;
      });
    });
    h += '</g>';
    SHOWERS.forEach((s) => {
      const on = s.k === ME.sel, ht = 26 + s.zhr * 0.95, xx = X(s.pk), y = base - ht - 8 - (lev[s.k] || 0);
      h += tx(clamp(xx, x0 + 36, x1 - 34), y, s.n, { fs, anchor: 'middle', fill: on ? T.accent : T.fg, weight: on ? 700 : 500, extra: ` class="sb-hit" data-k="${s.k}"` });
    });
    const td = new Date(), today = doy(td.getMonth() + 1, Math.min(td.getDate(), 28)) + Math.max(0, td.getDate() - 28);
    h += `<line x1="${fx(X(today), 1)}" y1="14" x2="${fx(X(today), 1)}" y2="${base + 4}" stroke="${T.fg}" stroke-width="1.5" stroke-dasharray="3 3"/>` + tx(X(today), base + 14 + 2 * f, 'today', { fs, anchor: 'middle', fill: T.fg, weight: 600 });
    h += tx(x0 + 4, 16, 'ZHR (peak rate) ↑', { fs, fill: T.muted });
    svg.innerHTML = h;
  }
  function shwOut() {
    const s = shw(), td = new Date(), now = doy(td.getMonth() + 1, 1) + td.getDate() - 1;
    let until = s.pk - now; if (until < -1) until += 365;
    $('#sbShwHead').innerHTML = `<p class="h">Peak around ${dstr(s.pk)}</p><p class="nm">${s.n}</p><p>${s.txt}</p>`;
    facts($('#sbShwFacts'), [['Next peak', until <= 0 ? 'now' : 'in ' + n0(until) + (until === 1 ? ' day' : ' days')], ['Active', dstr(s.s0) + ' – ' + dstr(s.s1)], ['ZHR at peak', s.zn], ['Radiant', `${s.rad} (RA ${s.ra}, Dec ${s.dec})`], ['Speed into the air', s.v + ' km/s'], ['Parent', s.par], ['Best seen from', s.hemi]]);
  }
  /* debris stream: the parent's orbit drawn flat, turned so the stream meets Earth's orbit at Earth's place on the peak date */
  const ST = { parts: null, key: '' };
  function streamGeom(s) {
    const q = s.q < 1 ? s.q : 0.97, e = s.e, p = q * (1 + e), th0 = Math.acos(clamp((p - 1) / e, -1, 1));
    const halley = s.k === 'eta' || s.k === 'ori';
    const w = halley ? lonE(doy(5, 6)) + th0 : lonE(s.pk) - th0;
    return { q, e, p, th0, w, halley, retro: ['eta', 'ori', 'per', 'leo'].includes(s.k) };
  }
  function streamParts(s) {
    if (ST.key === s.k) return ST.parts;
    const r = mulberry(s.k.charCodeAt(0) * 31 + s.k.charCodeAt(1)), g = streamGeom(s), P = [];
    const nuMax = Math.acos(clamp((g.p / 2.4 - 1) / g.e, -1, 1));
    for (let i = 0; i < 420; i++) P.push({ nu: (r() * 2 - 1) * nuMax, off: gauss(r) * 0.03, sp: 0.6 + r() * 0.8 });
    ST.parts = P; ST.key = s.k; ST.nuMax = nuMax;
    return P;
  }
  function drawStream(dt) {
    const svg = $('#sbStream'), f = FS(svg, 13.5, 12), fs = FSs(svg), s = shw(), g = streamGeom(s), P = streamParts(s), c = 230, k = 112;
    if (dt) P.forEach((pp) => { const rr = g.p / (1 + g.e * Math.cos(pp.nu)); pp.nu += (g.retro ? -1 : 1) * dt * 0.05 * pp.sp / (rr * rr); if (pp.nu > ST.nuMax) pp.nu -= 2 * ST.nuMax; if (pp.nu < -ST.nuMax) pp.nu += 2 * ST.nuMax; });
    const pos = (nu, off) => { const rr = g.p / (1 + g.e * Math.cos(nu)) + (off || 0), a = g.w + nu; return [c + k * rr * Math.cos(a), c - k * rr * Math.sin(a)]; };
    let h = `<defs><clipPath id="sbStClip"><rect x="2" y="2" width="456" height="456"/></clipPath></defs><g clip-path="url(#sbStClip)">`;
    const op = []; for (let j = -180; j <= 180; j++) { const nu = j * DEG * 0.999; const rr = g.p / (1 + g.e * Math.cos(nu)); if (rr < 3) op.push(pos(nu)); }
    h += `<polyline points="${pts(op)}" fill="none" stroke="${T.dust}" stroke-width="1" opacity="0.6"/>`;
    h += P.map((pp) => { const [x, y] = pos(pp.nu, pp.off); return `<circle cx="${fx(x, 1)}" cy="${fx(y, 1)}" r="1.5"/>`; }).join('').replace(/^/, `<g fill="${T.dust}" opacity="0.8">`) + '</g>';
    h += `<circle cx="${c}" cy="${c}" r="${k}" fill="none" stroke="${T.ion}" stroke-width="1.5"/>`;
    h += `<circle cx="${c}" cy="${c}" r="8" fill="#ffc94d"/>` + tx(c, c + 8 + f + 2, 'Sun', { fs, anchor: 'middle' });
    // crossing points
    const cross = g.halley ? [['eta', lonE(doy(5, 6))], ['ori', lonE(doy(10, 21))]] : [[s.k, lonE(s.pk)]];
    cross.forEach(([kk, l]) => {
      const x = c + k * Math.cos(l), y = c - k * Math.sin(l), ox = Math.cos(l), oy = -Math.sin(l), sh = SHOWERS.find((z) => z.k === kk);
      h += `<circle cx="${fx(x, 1)}" cy="${fx(y, 1)}" r="11" fill="none" stroke="${kk === s.k ? T.accent : T.muted}" stroke-width="2"/>`;
      const anc = ox > 0.3 ? 'start' : ox < -0.3 ? 'end' : 'middle', wd = sh.n.length * 0.56 * fs; let lx = x + ox * 20; const ly = y + oy * 24 + (oy > 0.3 ? fs * 0.4 : oy < -0.3 ? -fs * 0.9 : -fs * 0.3);
      if (anc === 'end') lx = Math.max(lx, 6 + wd); if (anc === 'start') lx = Math.min(lx, 454 - wd); if (anc === 'middle') lx = clamp(lx, 6 + wd / 2, 454 - wd / 2);
      const lc = kk === s.k ? T.accent : T.muted;
      h += tx(lx, ly, sh.n, { fs, anchor: anc, fill: lc, weight: 600 }) + tx(lx, ly + fs + 2, dstr(sh.pk), { fs, anchor: anc, fill: lc });
    });
    const le = lonE(ME.day), ex = c + k * Math.cos(le), ey = c - k * Math.sin(le);
    h += `<circle cx="${fx(ex, 1)}" cy="${fx(ey, 1)}" r="7" fill="#4f9be8" stroke="${T.surface}" stroke-width="2"/>`;
    h += tx(ex - Math.cos(le) * 16, ey + Math.sin(le) * 16 + f * 0.35, 'Earth', { fs: f, anchor: Math.cos(le) > 0.3 ? 'end' : Math.cos(le) < -0.3 ? 'start' : 'middle', fill: T.fg, weight: 600 });
    h += '</g>' + tx(8, 452, 'Dust along ' + s.par.replace(/,.*/, '').replace(/^Comet /, '') + '\'s orbit · not to scale', { fs, fill: T.muted });
    svg.innerHTML = h;
  }
  function dayOut() {
    const s = shw(), r = rateAt(s, ME.day);
    $('#sbDayOut').textContent = dstr(ME.day);
    $('#sbMeterBar').style.width = fx(clamp(r / 150 * 100, 0, 100), 1) + '%';
    $('#sbRate').innerHTML = r >= 1 ? `${s.n}: about <b>${n0(r)}</b> per hour (ZHR) on this date` : `${s.n}: not active on this date. A few random (sporadic) meteors still appear on any night.`;
  }
  /* sky: meteors fan out from the radiant (perspective of parallel paths) */
  const SKY = { stars: '', met: [], acc: 0 };
  function skyStars() { const r = mulberry(3); let h = ''; for (let i = 0; i < 90; i++) h += `<circle cx="${fx(r() * 420, 1)}" cy="${fx(r() * 300, 1)}" r="${fx(0.4 + r() * r() * 1.4, 2)}" fill="#fff" opacity="${fx(0.35 + r() * 0.6, 2)}"/>`; SKY.stars = h; }
  function drawSky(dt) {
    const svg = $('#sbSky'), f = FS(svg, 13, 12), s = shw(), rx = 210, ry = 120, rate = rateAt(s, ME.day);
    const spawn = (fromRad) => { const r = Math.random; const a = r() * TAU, d0 = 18 + r() * 120; SKY.met.push(fromRad ? { x: rx + Math.cos(a) * d0, y: ry + Math.sin(a) * d0, a, len: 30 + r() * 50, t: 0, dur: (0.35 + r() * 0.35) * 50 / s.v } : { x: r() * 420, y: r() * 300, a: r() * TAU, len: 25 + r() * 40, t: 0, dur: 0.5 }); };
    if (dt) {
      SKY.acc += dt * (0.25 + rate / 14); while (SKY.acc > 1) { SKY.acc -= 1; spawn(Math.random() < rate / (rate + 3)); }
      SKY.met.forEach((m) => { m.t += dt; }); SKY.met = SKY.met.filter((m) => m.t < m.dur).slice(-40);
    } else if (!SKY.met.length && rate > 1) { const r = mulberry(9); for (let i = 0; i < 14; i++) { const a = r() * TAU, d0 = 20 + r() * 110; SKY.met.push({ x: rx + Math.cos(a) * d0, y: ry + Math.sin(a) * d0, a, len: 30 + r() * 40, t: 0.6, dur: 1, still: true }); } }
    let h = `<rect width="420" height="300" fill="#070b1c"/>${SKY.stars}`;
    SKY.met.forEach((m) => {
      const u = m.still ? 1 : m.t / m.dur, head = m.len * Math.min(1, u * 1.3), tail = Math.max(0, head - 28), op = m.still ? 0.7 : Math.sin(Math.PI * u);
      h += `<line x1="${fx(m.x + Math.cos(m.a) * tail, 1)}" y1="${fx(m.y + Math.sin(m.a) * tail, 1)}" x2="${fx(m.x + Math.cos(m.a) * head, 1)}" y2="${fx(m.y + Math.sin(m.a) * head, 1)}" stroke="#fff6d8" stroke-width="1.8" stroke-linecap="round" opacity="${fx(op, 2)}"/>`;
    });
    h += `<circle cx="${rx}" cy="${ry}" r="6" fill="none" stroke="#ffc94d" stroke-width="1.6"/>` + tx(rx + 12, ry - 10, 'radiant · ' + s.rad, { fs: f, fill: '#e8eaf4', hc: '#070b1c', weight: 600 });
    h += tx(10, 290, rate >= 1 ? 'meteor rate sped up for the picture' : 'shower inactive: only sporadic meteors', { fs: FSs(svg), fill: '#c3c8e0', hc: '#070b1c' });
    svg.innerHTML = h;
  }
  const METS = [
    { k: 'oc', n: 'Ordinary chondrites', p: 80.0, col: 'var(--sb-oc)', txt: 'Stony meteorites that were never melted, full of chondrules. They come from S-type asteroids: grains brought back from Itokawa in 2010 proved the link.' },
    { k: 'cc', n: 'Carbonaceous chondrites', p: 4.4, col: 'var(--sb-cc)', txt: 'The most primitive: clays that hold water, carbon compounds and amino acids, as in the Murchison meteorite (Australia, 1969). Some, like Allende (Mexico, 1969), carry CAIs, the oldest solids. The Ryugu and Bennu samples are close relatives.' },
    { k: 'ec', n: 'Enstatite and other chondrites', p: 1.8, col: 'var(--sb-ec)', txt: 'Formed where oxygen was scarce, so their iron is metal, not oxide. Their isotopes are the closest match to Earth\'s, so material like this may have built much of our planet.' },
    { k: 'ach', n: 'Achondrites', p: 8.2, col: 'var(--sb-ach)', txt: 'Stone from bodies that melted and separated into crust, mantle and core. Most are HED meteorites from Vesta. A few hundred each are known from Mars and the Moon, blasted off by impacts.' },
    { k: 'irn', n: 'Irons', p: 4.6, col: 'var(--sb-irn)', txt: 'Iron–nickel from the cores of small worlds broken apart by collisions. Cut and etched, they show criss-cross Widmanstätten crystals, which only grow if the metal cooled by a few degrees per million years, deep inside a body. The largest, Hoba in Namibia, weighs about 60 tonnes.' },
    { k: 'sti', n: 'Stony-irons', p: 1.0, col: 'var(--sb-sti)', txt: 'Half metal, half rock. Pallasites, with green olivine crystals set in metal, may come from where a small world\'s core met its mantle.' }
  ];
  function initMeteorites() {
    const bar = $('#sbMetBar'), sel = METS.some((m) => m.k === store.get('met')) ? store.get('met') : 'oc';
    bar.innerHTML = METS.map((m) => `<i data-k="${m.k}" style="width:${m.p}%;background:${m.col}"></i>`).join('');
    seg($('#sbMetSeg'), METS.map((m) => [m.k, `<span class="sb-sw" style="background:${m.col}"></span>${m.n} ${fx(m.p, m.p < 10 ? 1 : 0)}%`]), sel, pick);
    function pick(k) {
      const m = METS.find((x) => x.k === k) || METS[0]; store.set('met', m.k); press($('#sbMetSeg'), m.k);
      bar.classList.add('sel'); $$('i', bar).forEach((i) => i.classList.toggle('on', i.dataset.k === m.k));
      $('#sbMetOut').innerHTML = `<p class="h">${fx(m.p, 1)}% of observed falls</p><p class="nm">${m.n}</p><p>${m.txt}</p>`;
    }
    pick(sel);
  }
  function initMeteors() {
    const dI = $('#sbDay');
    const pick = (k) => { ME.sel = k; store.set('shower', k); press($('#sbShw'), k); ME.day = shw().pk; dI.value = ME.day; SKY.met = []; drawCal(); shwOut(); drawStream(); dayOut(); drawSky(); };
    seg($('#sbShw'), SHOWERS.map((s) => [s.k, s.n]), ME.sel, pick);
    $('#sbCal').addEventListener('click', (e) => { const g = e.target.closest('.sb-hit'); if (g) pick(g.dataset.k); });
    dI.addEventListener('input', () => { ME.day = +dI.value; drawStream(); dayOut(); if (!Lsky.raf) { SKY.met = []; drawSky(); } });
    skyStars();
    const L = makeLoop('meteors', $('#sbStream'), (dt) => { ME.day = (ME.day + dt * 8) % 365; dI.value = ME.day; drawStream(dt); dayOut(); });
    L.play = false;
    playBtn($('#sbDayPlay'), L, ['Pause', 'Play the year']);
    const Lsky = makeLoop('meteors', $('#sbSky'), (dt) => drawSky(dt));
    playBtn($('#sbSkyPlay'), Lsky, ['Pause meteors', 'Play meteors']);
    $('#sbSkyPlay').addEventListener('click', () => { if (!Lsky.play) { SKY.met = []; drawSky(); } });
    pick(ME.sel);
    initMeteorites();
    redraw.meteors = () => { drawCal(); drawStream(); drawSky(); };
  }

  // hooks for automated checks
  window.SB = { keplerE, RES, entry, crater, interval, brownYears, coState: (e, q, t) => { const k = [CO.e, CO.q]; CO.e = e; CO.q = q; const r = coState(t); [CO.e, CO.q] = k; return r; }, pnMin: () => PN.minSep, show };
  // modules are defined above; start once the DOM is ready
  const start = () => { wideInit(); const h = location.hash.slice(1), s = store.get('tab'); show(valid(h) ? h : valid(s) ? s : 'belt'); };
  if (document.readyState === 'loading') addEventListener('DOMContentLoaded', start); else start();
})();
