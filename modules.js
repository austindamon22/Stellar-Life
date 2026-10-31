/* Stellar Life — modules.js
 * Course modules for OpenStax Astronomy ch. 19–23:
 *   clusters (cluster H-R diagram aging), distances (radar → parallax →
 *   standard candles), star birth (ISM, extinction, pre-main-sequence
 *   tracks, nebular hypothesis), binaries & bursts (novae, Type Ia,
 *   light curves).
 */
(function (global) {
  'use strict';
  const P = global.Phys, D = global.Data, F = D.Fmt, L = P.LIMITS;
  const $ = (s, r) => (r || document).querySelector(s);
  const NS = 'http://www.w3.org/2000/svg';
  const el = (tag, attrs, parent) => { const e = document.createElementNS(NS, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); if (parent) parent.appendChild(e); return e; };
  const txt = (parent, s, attrs) => { const t = el('text', Object.assign({ 'font-size': 11 }, attrs), parent); t.textContent = s; return t; };
  const supL = (svg, n, attrs) => { const t = el('text', Object.assign({ 'font-size': 11 }, attrs), svg); t.innerHTML = `10<tspan dy="-5" font-size="8">${n}</tspan>`; return t; };
  const css = () => { const s = getComputedStyle(document.documentElement); const g = (k) => s.getPropertyValue(k).trim(); return { fg: g('--fg'), muted: g('--muted'), faint: g('--faint'), line: g('--line-soft'), accent: g('--accent'), mono: g('--font-mono') }; };
  function rng(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }

  /* ======================= Clusters ======================= */
  const Clusters = {
    init() {
      const r = rng(42), a = 2.35, lo = 0.15, hi = 25;
      const A = Math.pow(lo, 1 - a), B = Math.pow(hi, 1 - a);
      this.stars = [];
      for (let i = 0; i < 4000; i++) {
        const M = Math.pow(A + r() * (B - A), 1 / (1 - a)); // Salpeter IMF
        this.stars.push({ M, jT: (r() - 0.5) * 0.012, jL: (r() - 0.5) * 0.06 });
      }
      this.cv = $('#clCanvas'); this.ctx = this.cv.getContext('2d');
      this.age = 1e8;
      $('#clAge').addEventListener('input', (e) => { this.setAge(Math.pow(10, +e.target.value / 100)); this.syncPresets(); });
      document.querySelectorAll('[data-cl]').forEach((b) => b.addEventListener('click', () => { this.setAge(parseFloat(b.dataset.cl)); $('#clAge').value = Math.round(Math.log10(this.age) * 100); this.syncPresets(); }));
      $('#clBS').addEventListener('change', () => this.draw());
      new ResizeObserver(() => this.draw()).observe(this.cv);
      this.setAge(1e8); this.syncPresets();
    },
    syncPresets() { document.querySelectorAll('[data-cl]').forEach((b) => b.setAttribute('aria-pressed', Math.abs(Math.log10(parseFloat(b.dataset.cl)) - Math.log10(this.age)) < 0.02 ? 'true' : 'false')); },
    turnoff(age) { let lo = 0.1, hi = 25; for (let i = 0; i < 60; i++) { const m = Math.sqrt(lo * hi); if (P.msLifetime(m) + P.preMSTime(m) > age) lo = m; else hi = m; } return Math.sqrt(lo * hi); },
    position(M, age) {
      const tpre = P.preMSTime(M);
      if (age < tpre) {
        const a = P.hrPosition('protostar', M), b = P.hrPosition('zams', M), f = age / tpre;
        return { logT: a.logT + (b.logT - a.logT) * f, logL: a.logL + (b.logL - a.logL) * f, kind: 'pre' };
      }
      const ph = global.Evo.phases(M);
      let t = age - tpre;
      for (let i = 0; i < ph.length; i++) {
        if (t < ph[i].dur) { const at = global.Evo.at(M, i + t / ph[i].dur); return { logT: at.logT, logL: at.logL, kind: i === 0 ? 'ms' : 'giant' }; }
        t -= ph[i].dur;
      }
      if (M >= L.supernova) return null; // neutron star or black hole: not on the diagram
      // white dwarf cooling (Mestel: L ∝ t^-1.4 at roughly fixed radius)
      const m = P.whiteDwarfMass(M), R = P.whiteDwarfRadius(m);
      const Lw = Math.min(5, 1e-3 * Math.pow(Math.max(t, 1e5) / 1e9, -1.4)); // Mestel cooling: ~10⁻³ L☉ at 1 Gyr
      const T = P.K.Tsun * Math.pow(Lw / (R * R), 0.25);
      return { logT: Math.log10(T), logL: Math.log10(Lw), kind: 'wd' };
    },
    setAge(age) {
      this.age = age;
      const to = this.turnoff(age), z = P.zams(to);
      const sp = [['O', 30000], ['B', 10000], ['A', 7500], ['F', 6000], ['G', 5200], ['K', 3700], ['M', 0]].find(([, T]) => z.T >= T)[0];
      $('#clAgeOut').textContent = F.years(age).replace(/<[^>]+>/g, '');
      const counts = { ms: 0, giant: 0, wd: 0, gone: 0 };
      this.pts = this.stars.map((s) => { const p = this.position(s.M, age); if (!p) counts.gone++; else counts[p.kind === 'pre' ? 'ms' : p.kind]++; return p; });
      const none = to > 24.5;
      $('#clRead').innerHTML = [
        ['Turnoff mass', none ? 'none yet' : F.sig(to, 3) + ' M☉'], ['Turnoff star', none ? 'no star has left the main sequence' : `${sp}-type, ${F.sig(z.T, 2)} K`],
        ['Giants now', counts.giant], ['White dwarfs', counts.wd], ['Neutron stars / black holes', counts.gone],
      ].map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join('');
      this.draw();
    },
    draw() {
      const cv = this.cv, c = this.ctx, C = css();
      const rect = cv.getBoundingClientRect(), dpr = Math.min(global.devicePixelRatio || 1, 2);
      cv.width = rect.width * dpr; cv.height = rect.height * dpr;
      const W = cv.width, H = cv.height, ml = 54 * dpr, mr = 12 * dpr, mt = 14 * dpr, mb = 34 * dpr;
      const tMin = 3.38, tMax = 4.75, lMin = -4.8, lMax = 6.2;
      const X = (lT) => ml + (tMax - lT) / (tMax - tMin) * (W - ml - mr), Y = (lL) => mt + (lMax - lL) / (lMax - lMin) * (H - mt - mb);
      c.clearRect(0, 0, W, H);
      c.font = `${11 * dpr}px ${C.mono}`; c.fillStyle = C.muted; c.strokeStyle = C.line; c.lineWidth = dpr;
      for (let l = -4; l <= 6; l += 2) { c.beginPath(); c.moveTo(ml, Y(l)); c.lineTo(W - mr, Y(l)); c.stroke(); c.textAlign = 'right'; c.fillText('10' + String(l).replace('-', '⁻').replace(/\d/g, (d) => '⁰¹²³⁴⁵⁶⁷⁸⁹'[d]), ml - 6 * dpr, Y(l) + 4 * dpr); }
      let lastX = -1e9;
      [30000, 10000, 6000, 4000, 3000].forEach((T) => { const x = X(Math.log10(T)); c.beginPath(); c.moveTo(x, mt); c.lineTo(x, H - mb); c.stroke(); if (x - lastX < 34 * dpr) return; lastX = x; c.textAlign = 'center'; c.fillText(T >= 10000 ? T / 1000 + 'k' : T.toLocaleString('en-US'), x, H - mb + 15 * dpr); });
      const bgc = getComputedStyle(document.documentElement).getPropertyValue('--bg').trim();
      const light = (() => { const n = parseInt(bgc.replace('#', ''), 16); return ((n >> 16) & 255) + ((n >> 8) & 255) + (n & 255) > 450; })();
      c.textAlign = 'center'; c.fillText('Surface temperature (K)', (ml + W) / 2, H - 6 * dpr);
      // ZAMS reference line
      c.strokeStyle = C.accent; c.globalAlpha = 0.35; c.setLineDash([4 * dpr, 4 * dpr]); c.beginPath();
      for (let lm = Math.log10(0.1); lm <= Math.log10(25); lm += 0.05) { const z = P.zams(Math.pow(10, lm)); const x = X(Math.log10(z.T)), y = Y(Math.log10(z.L)); if (lm === Math.log10(0.1)) c.moveTo(x, y); else c.lineTo(x, y); }
      c.stroke(); c.setLineDash([]); c.globalAlpha = 1;
      this.pts.forEach((p, i) => {
        if (!p) return;
        const s = this.stars[i], T = Math.pow(10, p.logT), col = P.blackbodyRGB(T);
        const x = X(p.logT + s.jT), y = Y(p.logL + s.jL);
        if (x < ml || x > W - mr || y < mt || y > H - mb) return;
        const rad = (p.kind === 'wd' ? 1.3 : 1.2 + Math.max(0, p.logL) * 0.4) * dpr;
        c.fillStyle = `rgb(${col})`; c.beginPath(); c.arc(x, y, rad, 0, Math.PI * 2); c.fill();
        if (light) { c.strokeStyle = 'rgba(20,24,48,0.45)'; c.lineWidth = 0.8 * dpr; c.stroke(); }
      });
      // blue stragglers: merged or mass-gaining stars above the turnoff
      if ($('#clBS').checked && this.age > 1e9) {
        const to = this.turnoff(this.age), r = rng(7);
        for (let k = 0; k < 10; k++) {
          const z = P.zams(to * (1.15 + r() * 0.8)); const x = X(Math.log10(z.T) + (r() - 0.5) * 0.02), y = Y(Math.log10(z.L) + 0.1);
          c.strokeStyle = '#8fb6ff'; c.lineWidth = 1.5 * dpr; c.beginPath(); c.arc(x, y, 3.5 * dpr, 0, Math.PI * 2); c.stroke();
        }
        c.fillStyle = '#8fb6ff'; c.textAlign = 'left'; const z = P.zams(to * 1.6); c.fillText('blue stragglers', X(Math.log10(z.T)) + 8 * dpr, Y(Math.log10(z.L) + 0.1) - 6 * dpr);
      }
      // turnoff marker
      const tom = this.turnoff(this.age);
      if (tom > 24.5) return;
      const tL = P.hrPosition('ms', tom).logL;  // where the main sequence ends for the turnoff mass
      const zt = { L: Math.pow(10, tL) };
      c.strokeStyle = C.fg; c.lineWidth = dpr; c.setLineDash([2 * dpr, 3 * dpr]);
      c.beginPath(); c.moveTo(ml, Y(tL)); c.lineTo(W - mr, Y(tL)); c.stroke(); c.setLineDash([]);
      const lab = 'main-sequence turnoff', ly = Y(Math.log10(zt.L)) - 6 * dpr, lw = c.measureText(lab).width;
      c.fillStyle = bgc; c.globalAlpha = 0.85; c.fillRect(ml + 4 * dpr, ly - 11 * dpr, lw + 8 * dpr, 15 * dpr); c.globalAlpha = 1;
      c.fillStyle = C.fg; c.textAlign = 'left'; c.fillText(lab, ml + 8 * dpr, ly);
      c.fillStyle = C.muted; c.textAlign = 'right'; c.fillText('dashed: zero-age main sequence', W - mr - 6 * dpr, mt + 12 * dpr);
    },
  };

  /* ======================= Distances ======================= */
  const Distances = {
    init() {
      $('#radarT').addEventListener('input', () => this.radar());
      $('#plx').addEventListener('input', () => this.parallax());
      document.querySelectorAll('[data-plx]').forEach((b) => b.addEventListener('click', () => { this.exact = parseFloat(b.dataset.plx); $('#plx').value = Math.round(Math.log10(this.exact) * 100); this.parallax(); }));
      $('#plx').addEventListener('input', () => { this.exact = null; }, true);
      ['#candleType', '#candleP', '#candleM'].forEach((id) => $(id).addEventListener('input', () => this.candle()));
      this.radar(); this.parallax(); this.candle(); this.leavitt(); this.ladder();
    },
    radar() {
      const t = parseFloat($('#radarT').value), out = $('#radarOut');
      if (!(t > 0)) { out.innerHTML = '<span class="err">Enter a positive round-trip time.</span>'; return; }
      const d = P.K.c * t / 2;
      out.innerHTML = `distance = c × t / 2 = <b>${F.sig(d / 1e3, 4)} km</b>${Math.abs(d - 3.844e8) < 3e7 ? ' (about the Moon\'s distance)' : ''} · ${F.sig(d / 1.495978707e11, 3)} AU`;
    },
    parallax() {
      const mas = this.exact || Math.pow(10, +$('#plx').value / 100), p = mas / 1000;
      const dpc = 1 / p;
      $('#plxOut').textContent = mas >= 10 ? mas.toFixed(0) : mas.toFixed(2);
      const rel = mas < 0.1 ? 'beyond Gaia\'s reach for most stars' : mas < 1 ? 'Gaia territory (Hipparcos limit was ~1 mas)' : mas < 10 ? 'Hipparcos could measure this' : 'measurable from the ground';
      $('#plxRes').innerHTML = `d = 1 / p = <b>${F.sig(dpc, 4)} pc</b> = ${F.sig(dpc * 3.2616, 4)} light-years · <span class="muted">${rel}</span>`;
      const svg = $('#plxSvg'), C = css(); svg.innerHTML = '';
      const sx = 70, sy = 150, rOrb = 50, star = 360;
      const ang = Math.max(0.08, Math.min(0.42, 0.08 + 0.34 * (Math.log10(mas) + 1) / 4));
      el('ellipse', { cx: sx, cy: sy, rx: 12, ry: rOrb, fill: 'none', stroke: C.muted, 'stroke-dasharray': '3 4' }, svg);
      el('circle', { cx: sx, cy: sy, r: 9, fill: '#ffcf6b' }, svg); txt(svg, 'Sun', { x: sx - 14, y: sy + 4, 'text-anchor': 'end', fill: C.muted });
      el('circle', { cx: sx, cy: sy - rOrb, r: 5, fill: '#5aa9ff' }, svg); txt(svg, 'Earth (January)', { x: sx + 10, y: sy - rOrb - 6, fill: C.muted });
      el('circle', { cx: sx, cy: sy + rOrb, r: 5, fill: '#5aa9ff' }, svg); txt(svg, 'Earth (July)', { x: sx + 10, y: sy + rOrb + 16, fill: C.muted });
      const ty = sy, tx = sx + (star - sx) * (1 - ang);
      el('line', { x1: sx, y1: sy - rOrb, x2: tx, y2: ty, stroke: C.accent }, svg);
      el('line', { x1: sx, y1: sy + rOrb, x2: tx, y2: ty, stroke: C.accent }, svg);
      el('line', { x1: sx, y1: sy, x2: tx, y2: ty, stroke: C.muted, 'stroke-dasharray': '2 4' }, svg);
      el('circle', { cx: tx, cy: ty, r: 6, fill: '#ffffff' }, svg); txt(svg, 'nearby star', { x: tx + 10, y: ty + 4, fill: C.fg });
      txt(svg, 'p', { x: tx - 32, y: ty - 6, fill: C.accent, 'font-size': 13 });
      txt(svg, '1 AU', { x: sx - 22, y: sy - rOrb / 2, fill: C.muted, 'text-anchor': 'end' });
      txt(svg, 'angle exaggerated: real parallaxes are under 1″', { x: 10, y: 290, fill: C.muted, 'font-size': 13 });
    },
    candleM(type, P_d) {
      if (type === 'cep') return -2.43 * (Math.log10(P_d) - 1) - 4.05;  // V-band Leavitt law (Benedict et al. 2007)
      if (type === 'rr') return 0.6;                                      // RR Lyrae: all ~the same
      return -19.3;                                                       // Type Ia peak
    },
    candle() {
      const type = $('#candleType').value, Pd = parseFloat($('#candleP').value), m = parseFloat($('#candleM').value);
      $('#candlePRow').hidden = type !== 'cep';
      const out = $('#candleOut');
      if (type === 'cep' && !(Pd > 0)) { out.innerHTML = '<span class="err">Enter the period in days.</span>'; return; }
      if (!isFinite(m)) { out.innerHTML = '<span class="err">Enter the apparent magnitude.</span>'; return; }
      const M = this.candleM(type, Pd), Lsun = Math.pow(10, -0.4 * (M - 4.83));
      const dpc = Math.pow(10, (m - M + 5) / 5);
      const steps = type === 'cep' ? [`(a) period P = ${Pd} days`, `(b) Leavitt law → M<sub>V</sub> = ${M.toFixed(2)} (≈ ${F.sig(Lsun, 2)} L☉)`] : [`(a) ${type === 'rr' ? 'RR Lyrae: no period needed' : 'Type Ia: peak brightness is nearly uniform'}`, `(b) M = ${M.toFixed(1)} (≈ ${F.sig(Lsun, 2)} L☉)`];
      steps.push(`(c) measured apparent magnitude m = ${m}`);
      steps.push(`(d) m − M = 5 log₁₀ d − 5 → d = <b>${dpc > 1e6 ? F.sig(dpc / 1e6, 3) + ' Mpc' : dpc > 1e3 ? F.sig(dpc / 1e3, 3) + ' kpc' : F.sig(dpc, 3) + ' pc'}</b> (${F.sig(dpc * 3.2616, 3)} ly)`);
      out.innerHTML = steps.map((s) => `<span>${s}</span>`).join('') + '<span class="muted">Ignores dust. Extinction makes stars look fainter, so uncorrected distances come out too large.</span>';
    },
    leavitt() {
      const svg = $('#leavittSvg'), C = css(); svg.innerHTML = '';
      const W = 460, H = 240, ml = 52, mr = 12, mt = 14, mb = 38;
      const X = (lp) => ml + (lp - (-0.6)) / (2.1 - (-0.6)) * (W - ml - mr), Y = (lL) => mt + (5.2 - lL) / (5.2 - 0.8) * (H - mt - mb);
      for (let l = 1; l <= 5; l++) { el('line', { x1: ml, x2: W - mr, y1: Y(l), y2: Y(l), stroke: C.line }, svg); supL(svg, l, { x: ml - 6, y: Y(l) + 4, 'text-anchor': 'end', fill: C.muted }); }
      [0.3, 1, 3, 10, 30, 100].forEach((d) => { const x = X(Math.log10(d)); txt(svg, d + ' d', { x, y: H - mb + 15, 'text-anchor': 'middle', fill: C.muted }); });
      txt(svg, 'Pulsation period (days, log)', { x: (ml + W) / 2, y: H - 6, 'text-anchor': 'middle', fill: C.muted });
      const pts = []; for (let lp = 0; lp <= 2.0; lp += 0.05) { const M = this.candleM('cep', Math.pow(10, lp)); pts.push(`${X(lp)},${Y(Math.log10(Math.pow(10, -0.4 * (M - 4.83))))}`); }
      el('polyline', { points: pts.join(' '), fill: 'none', stroke: '#a98bff', 'stroke-width': 2.5 }, svg);
      txt(svg, 'Cepheids (high mass)', { x: X(2.05), y: Y(4.75), fill: '#a98bff', 'text-anchor': 'end' });
      const yR = Y(Math.log10(49)); el('line', { x1: X(-0.5), x2: X(0), y1: yR, y2: yR, stroke: '#ffc93c', 'stroke-width': 2.5 }, svg);
      txt(svg, 'RR Lyrae: all ~50 L☉', { x: X(-0.5), y: yR - 8, fill: '#ffc93c' });
    },
    ladder() {
      const svg = $('#ladderSvg'), C = css(); svg.innerHTML = '';
      const H = 236, W = Math.round(Math.max(330, Math.min(620, svg.parentElement.clientWidth - 16 || 620))), ml = W < 480 ? 118 : 150, mr = 14;
      svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
      const X = (lpc) => ml + (lpc - (-8.5)) / (10 - (-8.5)) * (W - ml - mr);
      const rows = [['Radar', -8.2, -4.4, '#8ea2c8'], ['Parallax', 0.1, 4.0, '#5aa9ff'], ['RR Lyrae', 3, 6.0, '#ffc93c'], ['Cepheids', 3, 7.6, '#a98bff'], ['Type Ia supernovae', 6.5, 9.5, '#ff8a3c']];
      rows.forEach(([n, a, b, col], i) => {
        const y = 22 + i * 30;
        txt(svg, W < 480 && n.startsWith('Type Ia') ? 'Type Ia SNe' : n, { x: ml - 8, y: y + 4, 'text-anchor': 'end', fill: C.fg });
        el('rect', { x: X(a), y: y - 6, width: X(b) - X(a), height: 12, rx: 6, fill: col, opacity: 0.85 }, svg);
      });
      const marks = W < 480
        ? [[-7.9, 'Moon', 182, 'start'], [-5.31, 'Sun', 196, 'middle'], [0.11, 'Proxima', 182, 'middle'], [5.9, 'Andromeda', 196, 'middle'], [9.3, 'far galaxies', 210, 'end']]
        : [[-7.9, 'Moon', 182, 'start'], [-5.31, 'Sun (1 AU)', 182, 'middle'], [0.11, 'Proxima', 182, 'middle'], [3.9, 'Galactic centre', 196, 'middle'], [5.9, 'Andromeda', 182, 'middle'], [7.2, 'Virgo cluster', 210, 'middle'], [9.3, 'distant galaxies', 196, 'end']];
      marks.forEach(([lpc, n, y, anchor]) => {
        el('line', { x1: X(lpc), x2: X(lpc), y1: 166, y2: y - 10, stroke: C.muted }, svg);
        txt(svg, n, { x: X(lpc), y, 'text-anchor': anchor, fill: C.muted, 'font-size': 10 });
      });
      txt(svg, W < 480 ? 'parsecs, log scale' : 'distance in parsecs (log scale) · each rung calibrates the next', { x: ml, y: 160, fill: C.faint, 'font-size': 10 });
    },
  };

  /* ======================= Star birth ======================= */
  const Birth = {
    init() {
      $('#av').addEventListener('input', () => this.extinction());
      $('#avT').addEventListener('input', () => this.extinction());
      this.extinction(); this.tracks(); this.nebular(0);
      document.querySelectorAll('[data-neb]').forEach((b) => b.addEventListener('click', () => this.nebular(+b.dataset.neb)));
    },
    extinction() {
      const Av = +$('#av').value / 10, T = +$('#avT').value;
      const rgb = P.blackbodyRGB(T);
      // A_λ ≈ A_V (0.55 μm / λ): blue light is scattered more than red
      const lam = [0.65, 0.55, 0.45];
      const seen = rgb.map((v, i) => v * Math.pow(10, -0.4 * Av * (0.55 / lam[i])));
      const k = 255 / Math.max(1, ...seen);
      const norm = seen.map((v) => Math.min(255, v * k) | 0);
      $('#avOut').textContent = Av.toFixed(1);
      $('#avTOut').textContent = T.toLocaleString('en-US');
      $('#swTrue').style.background = `rgb(${rgb})`;
      const dim = Math.pow(10, -0.4 * Av);
      $('#swSeen').style.background = `rgb(${norm.map((v) => Math.round(v * Math.max(0.06, dim))).join(',')})`;
      const pct = Math.pow(10, -0.4 * Av) * 100;
      $('#avRes').innerHTML = `Starlight dimmed to <b>${pct >= 10 ? pct.toFixed(0) : pct.toPrecision(2)}%</b> in visible light · reddening E(B−V) ≈ A<sub>V</sub>/3.1 = <b>${(Av / 3.1).toFixed(2)}</b> mag. Distances from brightness would be overestimated ×${Math.pow(10, Av / 5).toFixed(2)} if you ignore it.`;
    },
    tracks() {
      const svg = $('#pmsSvg'), C = css(); svg.innerHTML = '';
      const W = 520, H = 320, ml = 50, mr = 14, mt = 14, mb = 36;
      const tMin = 3.48, tMax = 4.6, lMin = -1.6, lMax = 5;
      const X = (lT) => ml + (tMax - lT) / (tMax - tMin) * (W - ml - mr), Y = (lL) => mt + (lMax - lL) / (lMax - lMin) * (H - mt - mb);
      for (let l = -1; l <= 5; l += 2) { el('line', { x1: ml, x2: W - mr, y1: Y(l), y2: Y(l), stroke: C.line }, svg); supL(svg, l, { x: ml - 6, y: Y(l) + 4, 'text-anchor': 'end', fill: C.muted }); }
      [30000, 10000, 6000, 4000].forEach((T) => txt(svg, T >= 10000 ? T / 1000 + 'k' : String(T), { x: X(Math.log10(T)), y: H - mb + 15, 'text-anchor': 'middle', fill: C.muted }));
      txt(svg, 'Surface temperature (K)', { x: (ml + W) / 2, y: H - 6, 'text-anchor': 'middle', fill: C.muted });
      // ZAMS line
      const zp = []; for (let lm = Math.log10(0.3); lm <= Math.log10(20); lm += 0.05) { const z = P.zams(Math.pow(10, lm)); zp.push(`${X(Math.log10(z.T))},${Y(Math.log10(z.L))}`); }
      el('polyline', { points: zp.join(' '), fill: 'none', stroke: C.accent, 'stroke-width': 2, opacity: 0.6 }, svg);
      txt(svg, 'main sequence', { x: X(4.4), y: Y(3.9) - 4, fill: C.accent });
      [0.5, 1, 3, 9, 15].forEach((M) => {
        const z = P.zams(M), lT = Math.log10(z.T), lL = Math.log10(z.L);
        let pts;
        if (M < 2.5) pts = [[3.6, lL + 1.4], [3.62, lL + 0.35], [lT, lL]];         // Hayashi (down), Henyey (left)
        else pts = [[3.66, lL + 0.25], [lT - 0.05, lL + 0.15], [lT, lL]];            // mostly Henyey
        el('polyline', { points: pts.map(([a, b]) => `${X(a)},${Y(b)}`).join(' '), fill: 'none', stroke: C.fg, 'stroke-width': 1.4, 'stroke-dasharray': '5 3' }, svg);
        el('circle', { cx: X(lT), cy: Y(lL), r: 4, fill: `rgb(${P.blackbodyRGB(z.T)})` }, svg);
        txt(svg, `${M} M☉ · ${F.years(P.preMSTime(M)).replace(/<sup>(.*?)<\/sup>/g, '^$1')}`, { x: X(pts[0][0]) + 2, y: Y(pts[0][1]) - 9, 'text-anchor': 'end', fill: C.muted, 'font-size': 10 });
      });
    },
    nebular(k) {
      const steps = [
        ['Globule collapses', 'Gas and dust in a molecular cloud contract under gravity into a dense globule.'],
        ['Disk forms', 'Spin flattens the material into a disk around the protostar. Jets (Herbig-Haro objects) blast out along the axis.'],
        ['Rings separate', 'The disk differentiates into rings and gaps, as seen around HL Tau.'],
        ['Planetesimals', 'Dust in the rings clumps into larger bodies. The protostar reaches the main sequence.'],
        ['Planetary system', 'Planetesimals merge into planets; the leftover gas is blown away by the young star.'],
      ];
      document.querySelectorAll('[data-neb]').forEach((b) => b.setAttribute('aria-pressed', +b.dataset.neb === k ? 'true' : 'false'));
      $('#nebText').innerHTML = `<b>${k + 1}. ${steps[k][0]}.</b> ${steps[k][1]}`;
      const svg = $('#nebSvg'), C = css(); svg.innerHTML = '';
      const cx = 210, cy = 110, r = rng(3 + k);
      if (k === 0) { for (let i = 0; i < 260; i++) { const a = r() * 6.283, d = Math.pow(r(), 0.7) * 90; el('circle', { cx: cx + Math.cos(a) * d * 1.3, cy: cy + Math.sin(a) * d * 0.8, r: 1.4, fill: i % 6 ? '#5aa9ff' : '#9c7a5c', opacity: 0.6 }, svg); } }
      if (k >= 1) {
        el('ellipse', { cx, cy, rx: 170, ry: 34, fill: '#7c6a8e', opacity: k === 1 ? 0.55 : 0.18 }, svg);
        if (k >= 2) [60, 95, 135].forEach((rr, i) => el('ellipse', { cx, cy, rx: rr, ry: rr * 0.2, fill: 'none', stroke: '#c8a87a', 'stroke-width': k === 2 ? 7 : 2, opacity: k === 2 ? 0.6 : 0.3 }, svg));
        if (k >= 3) for (let i = 0; i < (k === 3 ? 40 : 0); i++) { const rr = [60, 95, 135][i % 3], a = r() * 6.283; el('circle', { cx: cx + Math.cos(a) * rr, cy: cy + Math.sin(a) * rr * 0.2, r: 2 + r() * 2, fill: '#c8b39a' }, svg); }
        if (k === 4) [[60, 4, '#c97b4b'], [95, 5, '#5aa9ff'], [135, 9, '#e8c48a']].forEach(([rr, s, col], i) => el('circle', { cx: cx + rr * Math.cos(1 + i * 2), cy: cy + rr * 0.2 * Math.sin(1 + i * 2), r: s, fill: col }, svg));
        el('circle', { cx, cy, r: k >= 3 ? 12 : 9, fill: k >= 3 ? '#ffe08a' : '#ff9a4a' }, svg);
        if (k === 1) { el('line', { x1: cx, y1: cy - 14, x2: cx, y2: 5, stroke: '#bfe1ff', 'stroke-width': 2 }, svg); el('line', { x1: cx, y1: cy + 14, x2: cx, y2: 215, stroke: '#bfe1ff', 'stroke-width': 2 }, svg); }
      }
    },
  };

  /* ======================= Binaries & bursts ======================= */
  const Binaries = {
    init() {
      this.reset();
      $('#wdRun').addEventListener('click', () => this.toggle());
      $('#wdReset').addEventListener('click', () => { this.stop(); this.reset(); });
      $('#wdRate').addEventListener('change', () => { this.stop(); this.reset(); });
      $('#wdM0').addEventListener('input', () => { this.stop(); this.reset(); });
      this.curves();
    },
    reset() {
      this.M = +$('#wdM0').value / 100; this.env = 0; this.novae = 0; this.t = 0; this.done = false;
      $('#wdM0Out').textContent = this.M.toFixed(2);
      $('#wdLog').innerHTML = ''; this.render();
    },
    stop() { if (this.raf) cancelAnimationFrame(this.raf); this.raf = null; $('#wdRun').textContent = 'Start accreting'; $('#wdRun').setAttribute('aria-pressed', 'false'); },
    toggle() {
      if (this.raf) { this.stop(); return; }
      if (this.done) this.reset();
      $('#wdRun').textContent = 'Pause'; $('#wdRun').setAttribute('aria-pressed', 'true');
      let last = performance.now();
      const step = (now) => {
        const dt = Math.min(0.05, (now - last) / 1000); last = now;
        this.tick(dt); this.render();
        if (!this.done) this.raf = requestAnimationFrame(step); else this.stop();
      };
      this.raf = requestAnimationFrame(step);
    },
    // Ignition mass of the hydrogen layer falls steeply with white dwarf mass (schematic).
    ignition() { return 1e-4 * Math.pow(10, -2.6 * (this.M - 0.6)); },
    tick(dt) {
      const steady = $('#wdRate').value === 'high';
      const rate = steady ? 1e-7 : 1e-9;          // Msun per year
      const yearsPerSec = steady ? 6e5 : 4e5;
      const dm = rate * yearsPerSec * dt;
      this.t += yearsPerSec * dt;
      if (steady) { this.M += dm; }               // burns steadily: white dwarf grows
      else {
        this.env += dm;
        if (this.env >= this.ignition()) {        // thermonuclear runaway on the surface
          this.novae++; this.flash = 1;
          this.log(`Nova #${this.novae} at ${F.years(this.t).replace(/<[^>]+>/g, '')}: envelope of ${F.sig(this.env, 2).replace(/<sup>(.*?)<\/sup>/g, '^$1')} M☉ ejected. White dwarf survives.`);
          this.env = 0; this.M += 0.0;            // ejects about what it gained (debated)
        }
      }
      if (this.M >= 1.38) { this.done = true; this.flash = 3; this.log('Reached ~1.38 M☉: carbon ignites in the core → Type Ia supernova. Nothing is left.'); }
      if (!steady && this.novae >= 12) { this.done = true; this.log('Recurrent novae keep blasting off the new gas, so this white dwarf barely grows. (Whether novae let white dwarfs grow is still debated.)'); }
    },
    log(s) { const li = document.createElement('li'); li.textContent = s; $('#wdLog').prepend(li); },
    render() {
      const f = Math.min(1, (this.M - 0.5) / (1.4 - 0.5));
      $('#wdBar').style.width = (f * 100) + '%';
      $('#wdMass').textContent = this.M.toFixed(3) + ' M☉';
      $('#wdEnv').style.width = Math.min(100, this.env / this.ignition() * 100) + '%';
      const fl = $('#wdFlash');
      if (this.flash > 0) { fl.style.opacity = Math.min(1, this.flash).toFixed(2); this.flash = Math.max(0, this.flash - 0.04); fl.dataset.big = this.done && this.M >= 1.38 ? '1' : ''; }
      else fl.style.opacity = 0;
    },
    curves() {
      const svg = $('#lcSvg'), C = css(); svg.innerHTML = '';
      const W = 560, H = 260, ml = 56, mr = 30, mt = 16, mb = 38;
      const X = (d) => ml + d / 200 * (W - ml - mr), Y = (M) => mt + (M - (-20)) / ((-4) - (-20)) * (H - mt - mb);
      [-20, -15, -10, -5].forEach((m) => { el('line', { x1: ml, x2: W - mr, y1: Y(m), y2: Y(m), stroke: C.line }, svg); txt(svg, String(m), { x: ml - 6, y: Y(m) + 4, 'text-anchor': 'end', fill: C.muted }); });
      [0, 50, 100, 150, 200].forEach((d) => txt(svg, d + ' d', { x: X(d), y: H - mb + 15, 'text-anchor': 'middle', fill: C.muted }));
      txt(svg, 'Days after explosion', { x: (ml + W) / 2, y: H - 6, 'text-anchor': 'middle', fill: C.muted });
      txt(svg, 'Abs. magnitude (brighter ↑)', { x: 12, y: (mt + H - mb) / 2, 'text-anchor': 'middle', fill: C.muted, 'font-size': 10, transform: `rotate(-90 12 ${(mt + H - mb) / 2})` });
      const curve = (fn, col, label, lx, ly, anchor) => {
        const pts = []; for (let d = 0; d <= 200; d += 0.5) { const v = Math.min(-4, fn(d)); pts.push(`${X(d)},${Y(v)}`); if (fn(d) > -4 && d > 5) break; }
        el('polyline', { points: pts.join(' '), fill: 'none', stroke: col, 'stroke-width': 2.4 }, svg);
        txt(svg, label, { x: X(lx), y: Y(ly), fill: col, 'text-anchor': anchor || 'start' });
      };
      const rise = (d, t, pk) => d < t ? pk + 6 * Math.pow(1 - d / t, 2) : null;
      curve((d) => rise(d, 18, -19.3) ?? (d < 50 ? -19.3 + (d - 18) * 0.09 : -16.4 + (d - 50) * 0.014), '#ff8a3c', 'Type Ia: peak −19.3, no hydrogen', 30, -19.6);
      curve((d) => rise(d, 12, -17) ?? (d < 100 ? -17 + (d - 12) * 0.006 : -16.5 + Math.min(3, (d - 100) * 0.12) + (d - 100) * 0.008), '#5aa9ff', 'Type II-P: ~100-day plateau', 198, -11.8, 'end');
      curve((d) => rise(d, 2, -8) ?? (-8 + (d - 2) * 0.05), '#a98bff', 'Nova: ~−8, white dwarf survives', 20, -8.6);
    },
  };


  /* ======================= Extras: ch. 19.4, 20, 21.4–5, 24.1, 24.5–6 ======================= */
  const SPEC = { // absolute visual magnitude by class and type (approximate, standard tables)
    V: [['O5', -5.7], ['B0', -4.0], ['B5', -1.2], ['A0', 0.65], ['F0', 2.7], ['G2 (Sun)', 4.83], ['K0', 5.9], ['K5', 7.4], ['M0', 8.8], ['M5', 12.3]],
    III: [['G0', 0.9], ['G5', 0.9], ['K0', 0.7], ['K5', -0.2], ['M0', -0.4]],
    I: [['B0', -6.2], ['A0', -6.3], ['F0', -6.6], ['G0', -6.4], ['K0', -6.0], ['M0', -5.6]],
  };
  const Extras = {
    init() {
      const fill = () => { const cl = $('#spClass').value; $('#spType').innerHTML = SPEC[cl].map(([t, m], i) => `<option value="${i}">${t}</option>`).join(''); this.spec(); };
      $('#spClass').addEventListener('change', fill); $('#spType').addEventListener('change', () => this.spec()); $('#spM').addEventListener('input', () => this.spec());
      fill();
      ['#exRp', '#exRs'].forEach((q) => $(q).addEventListener('input', () => this.transit()));
      ['#exMp', '#exP'].forEach((q) => $(q).addEventListener('input', () => this.doppler()));
      $('#smbh').addEventListener('input', () => this.smbh());
      this.transit(); this.doppler(); this.smbh(); this.spin(); this.eqp();
    },
    spec() {
      const cl = $('#spClass').value, row = SPEC[cl][+$('#spType').value || 0], m = parseFloat($('#spM').value), out = $('#spOut');
      if (!isFinite(m)) { out.innerHTML = '<span class="err">Enter the apparent magnitude.</span>'; return; }
      const M = row[1], d = Math.pow(10, (m - M + 5) / 5);
      out.innerHTML = `<span>${row[0]} ${cl} → M<sub>V</sub> ≈ ${M} (≈ ${F.sig(Math.pow(10, -0.4 * (M - 4.83)), 2)} L☉)</span><span>d = 10<sup>(m − M + 5)/5</sup> = <b>${d > 1e3 ? F.sig(d / 1e3, 3) + ' kpc' : F.sig(d, 3) + ' pc'}</b> (${F.sig(d * 3.2616, 3)} ly)</span><span class="muted">Stars of one type scatter by ~±0.5 mag, so these distances carry ~±25% error.</span>`;
    },
    transit() {
      const rp = +$('#exRp').value / 10, rs = +$('#exRs').value / 100;
      $('#exRpOut').textContent = rp.toFixed(1); $('#exRsOut').textContent = rs.toFixed(2);
      const ratio = rp * 0.009168 / rs, depth = Math.min(1, ratio * ratio);
      $('#exTr').innerHTML = ratio >= 1 ? '<span class="err">Planet as large as the star: not a physical transit. Make the star bigger or the planet smaller.</span>' : `depth = (R<sub>p</sub>/R<sub>★</sub>)² = <b>${depth >= 0.001 ? (depth * 100).toFixed(2) + '%' : Math.round(depth * 1e6) + ' ppm'}</b> · Earth–Sun 84 ppm, Jupiter–Sun ~1%`;
      const svg = $('#exLC'), C = css(); svg.innerHTML = '';
      const W = 420, H = 120, y0 = 30, scale = Math.min(70, Math.max(6, Math.sqrt(depth) * 400));
      const pts = []; for (let x = 10; x <= W - 10; x += 2) { const u = (x - W / 2) / 70; const f = Math.abs(u) > 1 ? 0 : Math.abs(u) > 0.8 ? (1 - Math.abs(u)) / 0.2 : 1; pts.push(`${x},${y0 + f * scale}`); }
      el('polyline', { points: pts.join(' '), fill: 'none', stroke: C.accent, 'stroke-width': 2 }, svg);
      txt(svg, 'brightness', { x: 10, y: 18, fill: C.muted, 'font-size': 10 });
      txt(svg, 'time →', { x: W - 10, y: H - 6, 'text-anchor': 'end', fill: C.muted, 'font-size': 10 });
      txt(svg, 'dip exaggerated for small planets', { x: 10, y: H - 6, fill: C.muted, 'font-size': 10 });
    },
    doppler() {
      const mp = Math.pow(10, +$('#exMp').value / 100 - 0.0) ; // 1 .. 3162 Earth masses
      const Pd = Math.pow(10, +$('#exP').value / 100);         // 1 .. 10,000 days
      $('#exMpOut').textContent = mp < 10 ? mp.toFixed(1) : Math.round(mp).toLocaleString('en-US');
      $('#exPOut').textContent = Pd < 365 ? `${Pd.toFixed(Pd < 10 ? 1 : 0)} days` : `${(Pd / 365.25).toFixed(1)} years`;
      const K = 28.4 * (mp / 317.8) * Math.pow(Pd / 365.25, -1 / 3);
      const verdict = K < 0.3 ? 'too small for today\'s instruments' : K < 1 ? 'at the edge of the best spectrographs' : 'detectable';
      $('#exDop').innerHTML = `star wobbles at K ≈ <b>${K < 1 ? K.toFixed(2) : F.sig(K, 3)} m/s</b> (Sun-like star) · ${verdict}`;
    },
    smbh() {
      const M = Math.pow(10, 5 + +$('#smbh').value / 1000 * 5); // 1e5 .. 1e10 Msun
      $('#smbhOut').textContent = M >= 1e9 ? F.sig(M / 1e9, 3) + ' billion' : F.sig(M / 1e6, 3) + ' million';
      const rs = P.schwarzschildRadius(M * P.K.Msun), au = rs / 1.495978707e11;
      const rho = M * P.K.Msun / (4 / 3 * Math.PI * rs * rs * rs);
      $('#smbhRes').innerHTML = `<span>r<sub>s</sub> = <b>${F.sig(rs / 1e3, 3)} km</b> = ${F.sig(au, 3)} AU</span><span>average density inside r<sub>s</sub>: ${F.sig(rho / 1000, 3)} g/cm³ ${rho < 1100 && rho > 900 ? '(about water!)' : rho < 1000 ? '(less than water)' : ''}</span>`;
    },
    spin() {
      const svg = $('#spinSvg'), C = css(); svg.innerHTML = '';
      const atom = (cx, up) => {
        el('circle', { cx, cy: 75, r: 26, fill: 'none', stroke: C.muted, 'stroke-dasharray': '3 3' }, svg);
        el('circle', { cx, cy: 75, r: 8, fill: '#ff6b5e' }, svg);
        el('circle', { cx: cx + 26, cy: 75, r: 5, fill: '#5aa9ff' }, svg);
        el('path', { d: `M ${cx} 64 L ${cx} 52 M ${cx - 4} 56 L ${cx} 52 L ${cx + 4} 56`, stroke: C.fg, fill: 'none', 'stroke-width': 1.6 }, svg);
        const d = up ? `M ${cx + 26} 66 L ${cx + 26} 54 M ${cx + 22} 58 L ${cx + 26} 54 L ${cx + 30} 58` : `M ${cx + 26} 84 L ${cx + 26} 96 M ${cx + 22} 92 L ${cx + 26} 96 L ${cx + 30} 92`;
        el('path', { d, stroke: '#5aa9ff', fill: 'none', 'stroke-width': 1.6 }, svg);
      };
      atom(70, true); atom(270, false);
      el('path', { d: 'M 120 75 L 226 75 M 218 69 L 226 75 L 218 81', stroke: C.muted, fill: 'none', 'stroke-width': 1.5 }, svg);
      txt(svg, 'spin flip (rare)', { x: 172, y: 66, 'text-anchor': 'middle', fill: C.muted, 'font-size': 10 });
      el('path', { d: 'M 300 60 q 8 -10 16 0 t 16 0 t 16 0 t 16 0 t 16 0', stroke: '#e0a800', 'stroke-width': 2, fill: 'none' }, svg);
      txt(svg, 'spins parallel', { x: 70, y: 130, 'text-anchor': 'middle', fill: C.muted });
      txt(svg, 'spins opposite', { x: 270, y: 130, 'text-anchor': 'middle', fill: C.muted });
      txt(svg, '21-cm photon', { x: 350, y: 44, 'text-anchor': 'middle', fill: '#e0a800' });
    },
    eqp() {
      const svg = $('#eqpSvg'), C = css(); svg.innerHTML = '';
      const box = (x, title, sub) => {
        el('rect', { x, y: 30, width: 150, height: 120, rx: 8, fill: 'none', stroke: C.muted }, svg);
        el('path', { d: `M ${x + 10} 70 Q ${x + 75} 74 ${x + 140} 86`, stroke: C.accent, 'stroke-width': 2, fill: 'none' }, svg);
        el('path', { d: `M ${x + 10} 70 L ${x + 140} 70`, stroke: C.muted, 'stroke-dasharray': '3 4', fill: 'none' }, svg);
        txt(svg, title, { x: x + 75, y: 22, 'text-anchor': 'middle', fill: C.fg });
        const [s1, s2] = sub.split(' | ');
        txt(svg, s1, { x: x + 75, y: 168, 'text-anchor': 'middle', fill: C.muted, 'font-size': 10 });
        txt(svg, s2, { x: x + 75, y: 182, 'text-anchor': 'middle', fill: C.muted, 'font-size': 10 });
      };
      box(30, 'Rocket, deep space', 'floor pushes up | at 9.8 m/s²');
      box(240, 'Room on Earth', 'gravity pulls down | at 9.8 m/s²');
      txt(svg, '=', { x: 210, y: 95, 'text-anchor': 'middle', fill: C.fg, 'font-size': 22 });
      txt(svg, 'beam bends (exaggerated)', { x: 210, y: 140, 'text-anchor': 'middle', fill: C.accent, 'font-size': 10 });
    },
  };

  global.Modules = { Clusters, Distances, Birth, Binaries, Extras };
})(window);
