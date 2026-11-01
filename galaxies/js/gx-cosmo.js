/* Galaxies — gx-cosmo.js: the Big Bang
 * - No centre: an expanding field of galaxies seen from any galaxy you pick
 * - Build a universe: scale factor a(t) from the Friedmann equation for any mix of
 *   matter and dark energy (aligned at today)
 * - The cosmic background cooling: Planck spectrum at T = 2.725 (1 + z) K
 * - Big Bang helium: Y = 2(n/p) / (1 + n/p)
 * - Timeline from the Planck time to today with the temperature at each moment
 */
(function (global) {
  'use strict';
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const TAU = Math.PI * 2, NS = 'http://www.w3.org/2000/svg';
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const el = (t, a, p) => { const e = document.createElementNS(NS, t); for (const k in a) e.setAttribute(k, a[k]); if (p) p.appendChild(e); return e; };
  const txt = (p, x, y, s, a) => {
    const at = Object.assign({ x, y }, a || {});
    if (!at.style) at.style = 'paint-order: stroke; stroke: var(--surface); stroke-width: 3px; stroke-linejoin: round';
    if (at['font-size']) { const svg = p.ownerSVGElement || p, vb = svg.viewBox && svg.viewBox.baseVal, cw = svg.clientWidth; if (vb && vb.width && cw) at['font-size'] = Math.max(+at['font-size'], 9.5 * vb.width / cw).toFixed(1); }
    const t = el('text', at, p); t.textContent = s; return t;
  };
  const css = () => { const c = getComputedStyle(document.documentElement); const g = (n) => c.getPropertyValue(n).trim(); return { fg: g('--fg'), muted: g('--muted'), faint: g('--faint'), soft: g('--line-soft'), line: g('--line'), accent: g('--accent'), surface: g('--surface'), good: g('--good'), bad: g('--bad') }; };
  const facts = (box, rows) => { box.innerHTML = rows.map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join(''); };
  function sig(x, n = 3) {
    if (!isFinite(x)) return '—'; if (x === 0) return '0';
    const a = Math.abs(x);
    if (a >= 1e5 || a < 1e-3) { const e = Math.floor(Math.log10(a)); const m = x / Math.pow(10, e); return m.toPrecision(n).replace(/\.?0+$/, '') + ' × 10<sup>' + e + '</sup>'; }
    return x.toLocaleString('en-US', { maximumSignificantDigits: n });
  }

  // Planck 2018-like flat ΛCDM
  const COS = { H0: 67.7, Om: 0.31, Or: 9.1e-5 };
  const TH = 977.79 / COS.H0;                     // Hubble time, Gyr
  const E = (a) => Math.sqrt(COS.Or / a ** 4 + COS.Om / a ** 3 + (1 - COS.Om - COS.Or));
  function ageAt(a) { const n = 1500; let s = 0; for (let i = 0; i < n; i++) { const x = (i + 0.5) / n, aa = a * x * x; s += 2 * x * a / n / (aa * E(aa)); } return s * TH; }
  const AGE0 = ageAt(1);
  // critical density ρc = 3H0² / 8πG
  const H0SI = COS.H0 * 1e3 / 3.0857e22, RHO_C = 3 * H0SI * H0SI / (8 * Math.PI * 6.6743e-11);
  // scale factor at a cosmic time t (Gyr), by bisection in log a
  function aAt(tGyr) { let lo = -12, hi = 0.5; for (let i = 0; i < 60; i++) { const m = (lo + hi) / 2; if (ageAt(Math.pow(10, m)) < tGyr) lo = m; else hi = m; } return Math.pow(10, (lo + hi) / 2); }

  /* ---------- 1. No centre ---------- */
  const Expand = (() => {
    const cv = $('#xpCanvas'); if (!cv) return null;
    let s = 99; const rnd = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
    const gal = Array.from({ length: 70 }, (_, i) => ({ x: (rnd() * 2 - 1) * 1.6, y: (rnd() * 2 - 1) * 1.1, r: 2.5 + rnd() * 3, hue: rnd(), tilt: rnd() * TAU, i }));
    let home = 0, best = 1e9;
    gal.forEach((g, i) => { const d = Math.hypot(g.x, g.y); if (d < best) { best = d; home = i; } });
    let ph = 0, raf = 0, open = false, last = 0;
    // matter-like expansion a = (1 + u)^(2/3), u: 0 → 1 then restart: decelerating, so the arrows shrink as it slows
    const U = () => ph % 1;
    const scaleA = () => Math.pow(1 + U(), 2 / 3);
    const adot = () => (2 / 3) * Math.pow(1 + U(), -1 / 3);
    function draw() {
      const r = cv.getBoundingClientRect(), dpr = Math.min(devicePixelRatio || 1, 2);
      const W = Math.round(r.width * dpr), H = Math.round(r.height * dpr); if (!W) return;
      if (cv.width !== W || cv.height !== H) { cv.width = W; cv.height = H; }
      const c = cv.getContext('2d'); c.fillStyle = '#04050b'; c.fillRect(0, 0, W, H);
      const a = scaleA(), h = gal[home], sc = Math.min(W, H) * 0.32;
      const P = (g) => [W / 2 + (g.x - h.x) * a * sc, H / 2 - (g.y - h.y) * a * sc];
      const fade = Math.min(1, (1 - U()) * 10, U() * 10 + 0.15);
      c.globalAlpha = fade;
      gal.forEach((g) => {
        const [x, y] = P(g);
        if (g !== h) {
          // recession velocity v = ȧ × (comoving distance) = H × (physical distance): Hubble's law from any galaxy
          const k = adot() * 0.42, dx = (g.x - h.x) * sc * k, dy = -(g.y - h.y) * sc * k;
          {
            c.strokeStyle = 'rgba(255,190,110,0.75)'; c.lineWidth = 1.4 * dpr;
            c.beginPath(); c.moveTo(x, y); c.lineTo(x + dx, y + dy); c.stroke();
            const ang = Math.atan2(dy, dx), L = 6 * dpr;
            c.beginPath(); c.moveTo(x + dx, y + dy); c.lineTo(x + dx - L * Math.cos(ang - 0.4), y + dy - L * Math.sin(ang - 0.4)); c.lineTo(x + dx - L * Math.cos(ang + 0.4), y + dy - L * Math.sin(ang + 0.4)); c.closePath(); c.fillStyle = 'rgba(255,190,110,0.85)'; c.fill();
          }
        }
        c.save(); c.translate(x, y); c.rotate(g.tilt);
        const gr = c.createRadialGradient(0, 0, 0, 0, 0, g.r * dpr * 2.2);
        const col = g.hue < 0.5 ? '170,200,255' : '255,220,170';
        gr.addColorStop(0, `rgba(${col},1)`); gr.addColorStop(1, `rgba(${col},0)`);
        c.scale(1, 0.55); c.fillStyle = gr; c.beginPath(); c.arc(0, 0, g.r * dpr * 2.2, 0, TAU); c.fill(); c.restore();
      });
      const [hx, hy] = P(h);
      c.strokeStyle = '#7fe6ad'; c.lineWidth = 2 * dpr; c.beginPath(); c.arc(hx, hy, 11 * dpr, 0, TAU); c.stroke();
      c.font = `600 ${12 * dpr}px ui-monospace, Menlo, monospace`; c.fillStyle = '#7fe6ad'; c.fillText('you', hx + 14 * dpr, hy - 10 * dpr);
      c.fillStyle = 'rgba(255,255,255,.8)'; c.font = `${12 * dpr}px ui-monospace, Menlo, monospace`;
      c.globalAlpha = 1;
      c.fillText(`scale factor a = ${a.toFixed(2)}  ·  expansion rate H = ${(adot() / a / (2 / 3)).toFixed(2)} × start`, 10 * dpr, 20 * dpr);
    }
    function loop(now) {
      if (!open) { raf = 0; return; }
      const dt = last ? Math.min(0.05, (now - last) / 1000) : 0; last = now;
      if (!reduceMotion) ph += dt * 0.12;
      draw(); raf = requestAnimationFrame(loop);
    }
    cv.addEventListener('click', (e) => {
      const r = cv.getBoundingClientRect(), dpr = cv.width / r.width, px = (e.clientX - r.left) * dpr, py = (e.clientY - r.top) * dpr;
      const W = cv.width, H = cv.height, a = scaleA(), h = gal[home], sc = Math.min(W, H) * 0.32;
      let bi = home, bd = 1e9;
      gal.forEach((g, i) => { const x = W / 2 + (g.x - h.x) * a * sc, y = H / 2 - (g.y - h.y) * a * sc, d = Math.hypot(x - px, y - py); if (d < bd) { bd = d; bi = i; } });
      if (bd < 40 * dpr) { home = bi; draw(); }
    });
    let tabOpen = false, vis = true;
    new IntersectionObserver((e) => { vis = e[0].isIntersecting; set(); }).observe(cv);
    const set = () => { open = tabOpen && vis && !document.hidden; if (open && !raf) { last = 0; raf = requestAnimationFrame(loop); } };
    document.addEventListener('visibilitychange', set);
    return { setOpen(on) { tabOpen = on; set(); if (on) draw(); } };
  })();

  /* ---------- 2. Build a universe ---------- */
  const Fate = (() => {
    const S = { Om: 0.31, OL: 0.69 };
    const PRE = [
      ['Our universe', 0.31, 0.69], ['Matter only (flat)', 1, 0], ['Closed: big crunch', 3, 0], ['Open, no dark energy', 0.3, 0], ['Dark energy only', 0, 1],
    ];
    // (da/dt)^2 / H0^2 as a function of a
    const f = (a) => COS.Or / (a * a) + S.Om / a + (1 - S.Om - S.OL - COS.Or) + S.OL * a * a;
    // integrate a(t) from today, backwards to a → 0 and forwards to t = +50 Gyr (times in Gyr)
    function trace(dir) {
      const pts = [[0, 1]]; let a = 1, t = 0, sgn = 1, turned = false, bounce = false;   // sgn: +1 while expanding
      const dtau = 0.0015;                                    // in Hubble times
      for (let i = 0; i < 60000; i++) {
        const fa = f(a);
        if (fa <= 0) { if (dir > 0) { sgn = -sgn; turned = true; } else { bounce = true; break; } }
        const step = (aa) => sgn * Math.sqrt(Math.max(0, f(aa)));
        const k1 = step(a), k2 = step(a + k1 * dtau / 2), k3 = step(a + k2 * dtau / 2), k4 = step(a + k3 * dtau);
        let an = a + dir * (k1 + 2 * k2 + 2 * k3 + k4) / 6 * dtau;
        if (f(an) < 0 && dir > 0 && !turned) { sgn = -sgn; turned = true; an = a; }
        a = an; t += dir * dtau * TH;
        if (i % 8 === 0) pts.push([t, a]);
        if (a < 1e-3) { pts.push([t, 0]); return { pts, end: 'zero', t }; }
        if (Math.abs(t) > 60 || a > 8) break;
      }
      return { pts, end: bounce ? 'bounce' : turned ? 'turn' : 'open', t };
    }
    function draw() {
      const svg = $('#fateSvg'); if (!svg) return; svg.innerHTML = '';
      // phones: the y-axis title goes horizontally above the plot (a rotated one collides with the enlarged tick labels)
      const narrow = svg.clientWidth > 0 && svg.clientWidth < 520;
      const W = 620, H = 360, ml = 46, mr = 14, mt = narrow ? 36 : 14, mb = 40, k = css();
      const X = (t) => ml + (t + 20) / 60 * (W - ml - mr), Y = (a) => mt + (1 - a / 3) * (H - mt - mb);
      for (let a = 0; a <= 3; a += 0.5) { el('line', { x1: ml, x2: W - mr, y1: Y(a), y2: Y(a), stroke: k.soft }, svg); txt(svg, ml - 6, Y(a) + 4, a, { 'text-anchor': 'end', fill: k.muted, 'font-size': 11 }); }
      for (let t = -20; t <= 40; t += narrow ? 20 : 10) txt(svg, X(t), H - mb + 16, (t > 0 ? '+' : '') + t, { 'text-anchor': t === -20 ? 'start' : t === 40 ? 'end' : 'middle', fill: k.muted, 'font-size': 11 });
      txt(svg, (ml + W) / 2, H - 4, 'billions of years from today', { 'text-anchor': 'middle', fill: k.muted, 'font-size': 12 });
      if (narrow) txt(svg, 4, 18, 'size of the universe (today = 1)', { fill: k.muted, 'font-size': 11 });
      else { const yl = txt(svg, 12, (mt + H - mb) / 2, 'size of the universe (today = 1)', { 'text-anchor': 'middle', fill: k.muted, 'font-size': 11 }); yl.setAttribute('transform', `rotate(-90 12 ${(mt + H - mb) / 2})`); }
      el('line', { x1: X(0), x2: X(0), y1: mt, y2: H - mb, stroke: k.faint, 'stroke-dasharray': '3 3' }, svg);
      txt(svg, X(0) + 4, mt + 12, 'today', { fill: k.muted, 'font-size': 11 });
      // ours, for reference
      const ref = Object.assign({}, S); S.Om = 0.31; S.OL = 0.69;
      const r0 = trace(-1), r1 = trace(1); Object.assign(S, ref);
      const path = (pts, attrs) => { const d = pts.filter(([t, a]) => t >= -20 && t <= 40 && a <= 3.05).map(([t, a], i) => (i ? 'L' : 'M') + X(t).toFixed(1) + ',' + Y(Math.min(3.05, a)).toFixed(1)).join(''); if (d) el('path', Object.assign({ d, fill: 'none' }, attrs), svg); };
      const isOurs = Math.abs(S.Om - 0.31) < 0.005 && Math.abs(S.OL - 0.69) < 0.005;
      if (!isOurs) { path(r0.pts.slice().reverse().concat(r1.pts), { stroke: k.faint, 'stroke-width': 1.5, 'stroke-dasharray': '5 4' }); { const ra = r1.pts.find(([t]) => t >= 20) || r1.pts[r1.pts.length - 1]; txt(svg, X(Math.min(ra[0], 20)) + 6, Math.max(mt + 14, Y(Math.min(2.9, ra[1])) + 4), 'ours', { fill: k.faint, 'font-size': 11 }); } }
      const b = trace(-1), fw = trace(1);
      path(b.pts.slice().reverse().concat(fw.pts), { stroke: k.accent, 'stroke-width': 3 });
      // outcome text
      const Ok = 1 - S.Om - S.OL, q0 = S.Om / 2 - S.OL;
      // age by quadrature: t0 = ∫₀¹ da / (a H) with a = x² (accurate near a → 0); null if f(a) < 0 somewhere (a bounce)
      let age = null;
      if (b.end === 'zero') {
        let sum = 0, ok = true; const n = 4000;
        for (let i = 0; i < n; i++) { const x = (i + 0.5) / n, a = x * x, fa = f(a); if (fa <= 0) { ok = false; break; } sum += 2 * x / Math.sqrt(fa) / n; }
        age = ok ? sum * TH : null;
      }
      const deOnly = S.Om < 0.005 && S.OL > 0.5;
      let fate;
      if (fw.end === 'turn' || fw.end === 'zero') fate = `<b style="color:var(--bad)">Big Crunch</b>: expansion stops and reverses${fw.end === 'zero' ? `, collapsing ~${Math.round(fw.t)} billion years from now` : ''}.`;
      else if (S.OL > 0.01 && q0 < 0) fate = '<b style="color:var(--good)">Expands forever, faster and faster</b> (dark energy wins): the Big Freeze.';
      else fate = '<b>Expands forever</b>, slowing down but never stopping.';
      facts($('#fateOut'), [
        ['Geometry', Math.abs(Ok) < 0.01 ? 'Flat' : Ok > 0 ? 'Open (negatively curved)' : 'Closed (positively curved, finite)'],
        ['Age of this universe', age == null ? 'no Big Bang (it bounces)' : deOnly ? `~${age.toFixed(0)} billion years, only because of the tiny radiation term (0.009%); pure dark energy has no beginning` : age.toFixed(1) + ' billion years'],
        ['Today the expansion is', q0 < 0 ? 'speeding up' : 'slowing down'],
        ['Fate', fate],
        ['Matter density today', `${sig(S.Om * RHO_C, 2)} kg/m³ (≈ ${sig(S.Om * RHO_C / 1.67e-27, 2)} H atoms per m³)`],
      ]);
      $('#fOmOut').textContent = S.Om.toFixed(2); $('#fOLOut').textContent = S.OL.toFixed(2);
    }
    const pre = $('#fatePre');
    if (pre) PRE.forEach(([nm, m, l], i) => {
      const bt = document.createElement('button'); bt.type = 'button'; bt.textContent = nm; bt.setAttribute('aria-pressed', String(i === 0));
      bt.addEventListener('click', () => { S.Om = m; S.OL = l; $('#fOm').value = m; $('#fOL').value = l; $$('button', pre).forEach((x) => x.setAttribute('aria-pressed', String(x === bt))); draw(); });
      pre.appendChild(bt);
    });
    const sl = (id, k) => { const i = $(id); if (i) i.addEventListener('input', () => { S[k] = +i.value; $$('#fatePre button').forEach((x) => x.setAttribute('aria-pressed', 'false')); draw(); }); };
    sl('#fOm', 'Om'); sl('#fOL', 'OL');
    return { draw, trace, S };
  })();

  /* ---------- 3. The cosmic background cooling ---------- */
  function bbRGB(T) {
    const t = Math.min(40000, Math.max(1000, T)) / 100;
    const r = t <= 66 ? 255 : 329.7 * Math.pow(t - 60, -0.1332);
    const g = t <= 66 ? 99.47 * Math.log(t) - 161.12 : 288.12 * Math.pow(t - 60, -0.0755);
    const b = t >= 66 ? 255 : t <= 19 ? 0 : 138.52 * Math.log(t - 10) - 305.04;
    const cl = (v) => Math.max(0, Math.min(255, Math.round(v)));
    return [cl(r), cl(g), cl(b)];
  }
  const zFromV = (v) => Math.pow(10, v / 1000 * Math.log10(1101)) - 1;
  function cmb() {
    const svg = $('#cmbSvg'); if (!svg) return; svg.innerHTML = '';
    const z = zFromV(+$('#cmbZ').value), T = 2.725 * (1 + z), k = css();
    const W = 620, H = 300, ml = 20, mr = 14, mt = 14, mb = 44;
    const L0 = -7, L1 = -2;                                  // log10 wavelength in m: 100 nm .. 1 cm
    const X = (lg) => ml + (lg - L0) / (L1 - L0) * (W - ml - mr);
    // visible band
    // band starts below the label row, so "visible" sits above it
    el('rect', { x: X(Math.log10(380e-9)), y: mt + 20, width: X(Math.log10(750e-9)) - X(Math.log10(380e-9)), height: H - mt - mb - 20, fill: 'url(#visg)', opacity: 0.35 }, svg);
    const defs = el('defs', {}, svg), lg = el('linearGradient', { id: 'visg', x1: 0, x2: 1, y1: 0, y2: 0 }, defs);
    ['#7a3cff', '#3c6cff', '#2ccf6a', '#f7e93a', '#ff9a2e', '#ff3a2e'].forEach((c, i) => el('stop', { offset: i / 5, 'stop-color': c }, lg));
    [['UV', -6.8], ['visible', (Math.log10(380e-9) + Math.log10(750e-9)) / 2], ['infrared', -5.3], ['microwave', -2.7]].forEach(([s, x]) => { if (x > L0 && x < L1) txt(svg, X(x), mt + 14, s, { 'text-anchor': 'middle', fill: k.muted, 'font-size': 11 }); });
    // Planck curve, normalised to its peak
    const hc_k = 0.014388;                                    // hc/k in m K
    const B = (l) => 1 / (Math.pow(l, 5) * (Math.exp(hc_k / (l * T)) - 1));
    const lp = 2.897771955e-3 / T, Bp = B(lp);
    let d = '';
    for (let i = 0; i <= 400; i++) { const lgL = L0 + (L1 - L0) * i / 400, l = Math.pow(10, lgL), y = B(l) / Bp; d += (i ? 'L' : 'M') + X(lgL).toFixed(1) + ',' + (mt + 20 + (1 - Math.min(1, y || 0)) * (H - mt - mb - 20)).toFixed(1); }
    el('path', { d, fill: 'none', stroke: k.accent, 'stroke-width': 2.5 }, svg);
    el('line', { x1: X(Math.log10(lp)), x2: X(Math.log10(lp)), y1: mt + 20, y2: H - mb, stroke: k.faint, 'stroke-dasharray': '3 3' }, svg);
    el('line', { x1: ml, x2: W - mr, y1: H - mb, y2: H - mb, stroke: k.line }, svg);
    [[-7, '100 nm', 'start'], [-6, '1 μm', 'middle'], [-5, '10 μm', 'middle'], [-4, '100 μm', 'middle'], [-3, '1 mm', 'middle'], [-2, '1 cm', 'end']].forEach(([x, s, an]) => txt(svg, X(x), H - mb + 16, s, { 'text-anchor': an, fill: k.muted, 'font-size': 11 }));
    txt(svg, (ml + W) / 2, H - 6, 'wavelength (log scale) · curve normalised to its peak', { 'text-anchor': 'middle', fill: k.muted, 'font-size': 11 });
    const age = ageAt(1 / (1 + z));
    const peak = lp < 1e-6 ? sig(lp * 1e9, 3) + ' nm' : lp < 1e-3 ? sig(lp * 1e6, 3) + ' μm' : sig(lp * 1e3, 3) + ' mm';
    $('#cmbZOut').textContent = z < 10 ? z.toFixed(2) : Math.round(z).toLocaleString('en-US');
    const [r, g, b] = bbRGB(T), glow = T > 1500 ? Math.min(1, (T - 1500) / 1500) : 0;
    $('#cmbSwatch').style.background = glow ? `rgb(${Math.round(r * glow)},${Math.round(g * glow)},${Math.round(b * glow)})` : '#000';
    $('#cmbSwatchT').textContent = glow ? (T > 2500 ? 'what you would see: an orange-white glow filling the whole sky, as bright as a lamp filament' : 'what you would see: a deep red-orange glow filling the whole sky') : 'what you would see: darkness (the light is infrared or microwave)';
    facts($('#cmbOut'), [
      ['Temperature T = 2.725 (1 + z)', (T < 10 ? T.toFixed(3) : sig(T, 4)) + ' K'],
      ['Peak wavelength (Wien)', peak],
      ['Universe’s age', age < 0.001 ? '~' + sig(age * 1e9, 2) + ' years' : age < 1 ? Math.round(age * 1000) + ' million years' : age.toFixed(2) + ' billion years'],
    ]);
  }

  /* ---------- 3b. Illustrative CMB ripple map (random pattern, not real data) ---------- */
  let mapDone = false;
  function cmbMap() {
    const cv = $('#cmbMap'); if (!cv || mapDone) return; mapDone = true;
    const W = cv.width, H = cv.height, c = cv.getContext('2d'), img = c.createImageData(W, H), d = img.data;
    let s = 2718; const rnd = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
    // smooth value noise: a few octaves of bilinearly interpolated random grids
    const oct = [[6, 1], [12, 0.8], [24, 0.6], [48, 0.45], [96, 0.3]].map(([n, w]) => {
      const gw = n + 1, gh = Math.ceil(n / 2) + 1, g = new Float32Array(gw * gh);
      for (let i = 0; i < g.length; i++) g[i] = rnd() * 2 - 1;
      return { n, w, gw, gh, g };
    });
    const sm = (t) => t * t * (3 - 2 * t);
    const val = (u, v) => {
      let sum = 0;
      oct.forEach((o) => {
        const x = u * o.n, y = v * (o.gh - 1), ix = Math.min(o.gw - 2, x | 0), iy = Math.min(o.gh - 2, y | 0), fx = sm(x - ix), fy = sm(y - iy), g = o.g, gw = o.gw;
        const a = g[iy * gw + ix], b = g[iy * gw + ix + 1], cc = g[(iy + 1) * gw + ix], dd = g[(iy + 1) * gw + ix + 1];
        sum += o.w * (a + (b - a) * fx + (cc - a) * fy + (a - b - cc + dd) * fx * fy);
      });
      return sum / 1.6;
    };
    const ramp = [[0, [20, 40, 140]], [0.3, [70, 140, 230]], [0.5, [245, 240, 225]], [0.7, [250, 160, 60]], [1, [190, 40, 30]]];
    const col = (t) => { t = Math.max(0, Math.min(1, t)); for (let i = 1; i < ramp.length; i++) if (t <= ramp[i][0]) { const [t0, c0] = ramp[i - 1], [t1, c1] = ramp[i], f = (t - t0) / (t1 - t0); return c0.map((x, k) => x + (c1[k] - x) * f); } return ramp[4][1]; };
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const nx = (x + 0.5) / W * 2 - 1, ny = (y + 0.5) / H * 2 - 1, r2 = nx * nx + ny * ny, i = (y * W + x) * 4;
      if (r2 > 1) { d[i + 3] = 0; continue; }
      const edge = Math.min(1, (1 - r2) * 60);                       // soft rim
      const [r, g, b] = col(0.5 + 0.55 * val((x + 0.5) / W, (y + 0.5) / H));
      d[i] = r; d[i + 1] = g; d[i + 2] = b; d[i + 3] = 255 * edge;
    }
    c.putImageData(img, 0, 0);
  }

  /* ---------- 4. Big Bang helium ---------- */
  function bbn() {
    const x = +$('#npR').value, Y = 2 * x / (1 + x);
    $('#npOut').textContent = `1 : ${(1 / x).toFixed(1)}`;
    const svg = $('#bbnSvg'); svg.innerHTML = '';
    const k = css(), cx = 90, cy = 90, R = 76;
    const arc = (a0, a1, col) => { const p0 = [cx + R * Math.sin(a0), cy - R * Math.cos(a0)], p1 = [cx + R * Math.sin(a1), cy - R * Math.cos(a1)]; el('path', { d: `M${cx},${cy} L${p0[0]},${p0[1]} A${R},${R} 0 ${a1 - a0 > Math.PI ? 1 : 0} 1 ${p1[0]},${p1[1]} Z`, fill: col }, svg); };
    arc(0, TAU * Y - 1e-6, '#ffd166'); if (Y < 0.9999) arc(TAU * Y, TAU - 1e-6, '#5aa6ff');
    txt(svg, 190, 70, `Helium-4: ${(Y * 100).toFixed(1)}%`, { fill: '#e0a83a', 'font-size': 15, 'font-weight': 700 });
    txt(svg, 190, 96, `Hydrogen: ${((1 - Y) * 100).toFixed(1)}%`, { fill: '#5aa6ff', 'font-size': 15, 'font-weight': 700 });
    txt(svg, 190, 122, 'by mass · observed: ~24.5% He', { fill: k.muted, 'font-size': 12 });
    $('#bbnMath').innerHTML = `Every neutron ends up in a helium-4 nucleus (2 protons + 2 neutrons). With 1 neutron for every ${(1 / x).toFixed(1)} protons, take 2 neutrons + ${(2 / x).toFixed(1)} protons: 2 neutrons and 2 protons make one helium (mass ≈ 4); the other ${(2 / x - 2).toFixed(1)} protons stay hydrogen. Helium share = 4 / ${(2 / x + 2).toFixed(1)} = <b>${(Y * 100).toFixed(1)}%</b>. In symbols, Y = 2(n/p) / (1 + n/p).`;
  }

  /* ---------- 5. Timeline ---------- */
  const SEC_PER_YR = 3.15576e7;
  const EV = [
    [5.4e-44, 'Planck time', 'Earliest moment current physics can describe. All four forces may have been one.'],
    [1e-36, 'Inflation', '~10⁻³⁶ to 10⁻³² s: space grows by a factor of ~10²⁶ or more. It solves the flatness problem (why the density is so close to critical) and the horizon problem (why regions that could never have exchanged light have the same temperature). Strongly supported but not proven.'],
    [1e-12, 'Electroweak split', 'The weak and electromagnetic forces become different. Particles get mass from the Higgs field.'],
    [1e-5, 'Protons and neutrons form', 'Quarks bind into protons and neutrons at ~10¹² K.'],
    [1, 'Neutrinos decouple', 'Weak reactions stop turning neutrons into protons and back: the n/p ratio freezes at about 1 : 6.'],
    [180, 'Nucleosynthesis', '3–20 minutes: neutrons and protons fuse into helium-4 (~25%), some deuterium, helium-3 and lithium. Then too cool and thin to make more.'],
    [4.7e4 * SEC_PER_YR, 'Matter takes over', 'Matter outweighs radiation; clumps of dark matter start to grow.'],
    [3.8e5 * SEC_PER_YR, 'Recombination: the CMB', 'At ~3000 K electrons join nuclei into atoms. Space turns transparent and the light that’s now the cosmic microwave background flies free.'],
    [1.5e8 * SEC_PER_YR, 'First stars', 'After the "dark ages", the first stars and galaxies light up (cosmic dawn), ~100–200 million years after the Big Bang.'],
    [1e9 * SEC_PER_YR, 'Reionization ends', 'Ultraviolet light from early galaxies has re-ionized the gas between them.'],
    [3.3e9 * SEC_PER_YR, 'Cosmic noon', 'Star formation and quasar activity peak (z ≈ 2).'],
    [7.7e9 * SEC_PER_YR, 'Dark energy takes over', 'The expansion stops slowing down and starts speeding up (z ≈ 0.65).'],
    [9.2e9 * SEC_PER_YR, 'Sun forms', 'From gas enriched by earlier generations of stars.'],
    [AGE0 * 1e9 * SEC_PER_YR, 'Today', `${AGE0.toFixed(1)} billion years. The background is 2.725 K.`],
  ];
  // Bar position: log time up to 1 year (40%), log 1 yr–100 Myr (22%), then linear in time to today (38%),
  // so the late epochs are spread out enough to see and tap.
  const T0 = 5.4e-44, Y1 = SEC_PER_YR, Y8 = 1e8 * SEC_PER_YR, TN = AGE0 * 1e9 * SEC_PER_YR;
  const lg = Math.log10;
  function posOf(t) {
    if (t <= Y1) return 0.4 * (lg(t) - lg(T0)) / (lg(Y1) - lg(T0));
    if (t <= Y8) return 0.4 + 0.22 * (lg(t) - lg(Y1)) / (lg(Y8) - lg(Y1));
    return 0.62 + 0.38 * (t - Y8) / (TN - Y8);
  }
  function timeOf(x) {
    if (x <= 0.4) return Math.pow(10, lg(T0) + x / 0.4 * (lg(Y1) - lg(T0)));
    if (x <= 0.62) return Math.pow(10, lg(Y1) + (x - 0.4) / 0.22 * (lg(Y8) - lg(Y1)));
    return Y8 + (x - 0.62) / 0.38 * (TN - Y8);
  }
  let selIdx = null;
  function tempAt(sec) {
    // T = 2.725 K / a from the expansion; before 1 s use the radiation-era form T ≈ 1.3 × 10^10 K / √(t in s)
    // (valid only after inflation and reheating: the timeline shows text instead before ~10⁻³² s)
    // early on more particle species share the heat (g* = 106.75 above ~100 GeV, ~61.75 above the quark–hadron
    // transition, 10.75 before e± annihilation), lowering T at a given time by (10.75/g*)^(1/4)
    if (sec < 1) { const g = sec < 2e-11 ? 106.75 : sec < 2e-5 ? 61.75 : 10.75; return 1.33e10 / Math.sqrt(sec) * Math.pow(10.75 / g, 0.25); }
    return 2.7255 / aAt(sec / SEC_PER_YR / 1e9);
  }
  // No radiation-era T ∝ t^(-1/2) before inflation ends (~10⁻³² s): the Planck temperature at the Planck time,
  // then a model-dependent story (inflation cools space; reheating afterwards)
  const INFL_END = 1e-32;
  function tempText(sec) {
    if (sec <= T0 * 1.0001) return '~10<sup>32</sup> K <small>(Planck temperature)</small>';
    if (sec < INFL_END) return '<small>Cools during inflation; reheated afterwards to as much as ~10<sup>28</sup> K (model-dependent)</small>';
    return sig(tempAt(sec), 2) + ' K';
  }
  // singular unit when the shown number is exactly 1 ("1 second", not "1 seconds")
  const unit = (v, one, many) => { const s = sig(v, 2); return s + ' ' + (s === '1' ? one : many); };
  function fmtTime(sec) {
    if (sec < 1) return sig(sec, 2) + ' s';
    if (sec < 120) return unit(sec, 'second', 'seconds');
    if (sec < 7200) return unit(sec / 60, 'minute', 'minutes');
    if (sec < 2 * SEC_PER_YR) return unit(sec / 86400, 'day', 'days');
    const y = sec / SEC_PER_YR;
    if (y < 1e6) return unit(y, 'year', 'years');
    if (y < 1e9) return sig(y / 1e6, 3) + ' million years';
    return sig(y / 1e9, 3) + ' billion years';
  }
  function timeline() {
    const sec = selIdx != null ? EV[selIdx][0] : timeOf(+$('#tlS').value / 1000);
    let ci = 0; EV.forEach((e, i) => { if (e[0] <= sec * 1.0001) ci = i; });
    if (selIdx != null) ci = selIdx;
    const cur = EV[ci], next = EV[ci + 1];
    const exact = selIdx != null || Math.abs(posOf(sec) - posOf(cur[0])) < 0.012;
    $('#tlOut').innerHTML = `<p class="tl-time">${fmtTime(sec)} after the Big Bang</p><p class="tl-T">${tempText(sec)}</p>`
      + (exact ? `<h4>${cur[1]}</h4><p>${cur[2]}</p>` : `<h4>Between epochs</h4><p>Last: <b>${cur[1]}</b>.${next ? ` Next: <b>${next[1]}</b> at ${fmtTime(next[0])}.` : ''}</p>`);
    $$('#tlMarks button, #tlChips button').forEach((b) => b.setAttribute('aria-pressed', String(exact && b.dataset.i === String(ci))));
  }
  function marks() {
    const box = $('#tlMarks'); box.innerHTML = '';
    const lab = $('#tlLabels'); lab.innerHTML = '';
    [[T0, '10⁻⁴³ s', 0], [1, '1 s', 1], [Y1, '1 yr', 0], [Y8, '100 Myr', 0], [5e9 * SEC_PER_YR, '5 Gyr', 1], [TN, 'now', 0]].forEach(([t, s2, minor]) => {
      const sp = document.createElement('span'); sp.textContent = s2; sp.style.left = (posOf(t) * 100) + '%'; if (minor) sp.className = 'tl-minor'; lab.appendChild(sp);
    });
    // dashed lines where the scale changes
    [Y1, Y8].forEach((t) => { const br = document.createElement('i'); br.className = 'tl-break'; br.style.left = (posOf(t) * 100) + '%'; box.appendChild(br); });
    const chips = $('#tlChips'); chips.innerHTML = '';
    EV.forEach((e, i) => {
      const b = document.createElement('button'); b.type = 'button'; b.dataset.i = i; b.title = e[1];
      b.style.left = (posOf(e[0]) * 100) + '%';
      b.setAttribute('aria-label', e[1]);
      const pick = () => { selIdx = i; $('#tlS').value = Math.round(posOf(e[0]) * 1000); timeline(); };
      b.addEventListener('click', pick);
      box.appendChild(b);
      const ch = document.createElement('button'); ch.type = 'button'; ch.textContent = e[1]; ch.dataset.i = i; ch.addEventListener('click', pick); chips.appendChild(ch);
    });
  }

  let inited = false;
  function init() {
    if (inited) return; inited = true;
    $('#cmbZ').addEventListener('input', cmb);
    $('#npR').addEventListener('input', bbn);
    $('#tlS').addEventListener('input', () => { selIdx = null; timeline(); });
    marks();
  }
  global.GXCosmo = {
    setOpen(on) { if (on) { init(); Fate.draw(); cmb(); cmbMap(); bbn(); timeline(); } if (Expand) Expand.setOpen(on); },
    redraw() { Fate.draw(); cmb(); bbn(); },
    Fate, ageAt, aAt, tempAt, AGE0,
  };
})(window);
