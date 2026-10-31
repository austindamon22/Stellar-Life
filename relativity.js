/* Stellar Life — relativity.js
 * Evidence for general relativity (OpenStax ch. 24): light bending,
 * Mercury's perihelion, gravitational redshift, GPS and LIGO's chirp.
 */
(function (global) {
  'use strict';
  const P = global.Phys, F = global.Data.Fmt;
  const NS = 'http://www.w3.org/2000/svg';
  const el = (tag, attrs, parent) => { const e = document.createElementNS(NS, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); if (parent) parent.appendChild(e); return e; };
  const css = () => { const s = getComputedStyle(document.documentElement); const g = (k) => s.getPropertyValue(k).trim(); return { fg: g('--fg'), muted: g('--muted'), line: g('--line'), accent: g('--accent') }; };
  const reduce = () => global.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Deflection of light grazing a mass: α = 4GM / (c² b)  (radians)
  const deflection = (M, b) => 4 * P.K.G * M / (P.K.c * P.K.c * b);
  const ARCSEC = 180 / Math.PI * 3600;

  function lightBend(svg, b) {
    const C = css(); svg.innerHTML = '';
    const W = 420, H = 220, sx = 210, sy = 150, R = 34;
    const alpha = deflection(P.K.Msun, b * P.K.Rsun) * ARCSEC;
    // Geometry (exaggerated): light from the star passes above the Sun at P and is
    // bent down toward Earth. Tracing the arriving ray straight back puts the star
    // HIGHER: farther from the Sun than it really is.
    const yb = Math.max(78, sy - R - 4 - (b - 1) * 6); // closest approach above the limb
    const ex = W - 14, ey = yb + 46;                 // Earth, below the ray
    const yApp = yb - (ey - yb) * (sx - 14) / (ex - sx);
    const bend = Math.max(18, 30 * Math.min(1, alpha / 1.75)); // drawn deflection (kept legible; exaggerated)
    const yTrue = yApp + bend;
    el('circle', { cx: sx, cy: sy, r: R, fill: '#ffcf6b' }, svg);
    el('text', { x: sx, y: sy + 4, 'text-anchor': 'middle', 'font-size': 11, fill: '#3a2400' }, svg).textContent = 'Sun';
    el('path', { d: `M ${ex} ${ey} L ${14} ${yApp}`, stroke: C.fg, 'stroke-dasharray': '2 5', fill: 'none', opacity: 0.6 }, svg);
    el('path', { d: `M 14 ${yTrue} Q ${sx - 30} ${yb - 2} ${sx} ${yb} T ${ex} ${ey}`, stroke: C.accent, 'stroke-width': 2.2, fill: 'none' }, svg);
    el('circle', { cx: 14, cy: yTrue, r: 4.5, fill: '#ffffff', stroke: '#333' }, svg);
    el('text', { x: 24, y: yTrue + 15, 'font-size': 11, fill: C.muted }, svg).textContent = 'true position';
    el('circle', { cx: 14, cy: yApp, r: 4.5, fill: 'none', stroke: C.fg }, svg);
    el('text', { x: 24, y: yApp - 6, 'font-size': 11, fill: C.fg }, svg).textContent = 'apparent position (pushed away from the Sun)';
    el('circle', { cx: ex, cy: ey, r: 5, fill: '#5aa9ff' }, svg);
    el('text', { x: ex - 8, y: ey + 18, 'text-anchor': 'end', 'font-size': 11, fill: C.muted }, svg).textContent = 'Earth';
    el('text', { x: 14, y: H - 8, 'font-size': 11, fill: C.muted }, svg).textContent = 'bend hugely exaggerated';
    return alpha;
  }

  function mercury(canvas) {
    const c = canvas.getContext('2d'); let t = 0, run = false, vis = false;
    const draw = () => {
      const dpr = Math.min(global.devicePixelRatio || 1, 2);
      const W = canvas.width, H = canvas.height, C = css();
      c.clearRect(0, 0, W, H);
      const a = Math.min(W, H) * 0.32, e = 0.45, cx = W / 2, cy = H / 2;
      const prec = 0.18; // radians per orbit, exaggerated ~10^5 x
      const orbits = 5;
      for (let k = 0; k < orbits; k++) {
        c.strokeStyle = C.muted; c.globalAlpha = 0.18 + 0.15 * k; c.lineWidth = dpr; c.beginPath();
        for (let i = 0; i <= 120; i++) { const th = i / 120 * Math.PI * 2; const rr = a * (1 - e * e) / (1 + e * Math.cos(th)); const ph = th + k * prec; const x = cx + rr * Math.cos(ph) - a * e * 0; const y = cy + rr * Math.sin(ph) * 0.92; if (i) c.lineTo(x, y); else c.moveTo(x, y); }
        c.stroke();
      }
      c.globalAlpha = 1;
      const th = (t * 1.6) % (Math.PI * 2), k = Math.floor(t * 1.6 / (Math.PI * 2)) % orbits;
      const rr = a * (1 - e * e) / (1 + e * Math.cos(th));
      const ph = th + k * prec;
      c.fillStyle = '#ffcf6b'; c.beginPath(); c.arc(cx, cy, 8 * dpr, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#c9c4bd'; c.beginPath(); c.arc(cx + rr * Math.cos(ph), cy + rr * Math.sin(ph) * 0.92, 4.5 * dpr, 0, Math.PI * 2); c.fill();
      c.font = `${11 * dpr}px ${getComputedStyle(document.documentElement).getPropertyValue('--font-mono')}`; c.fillStyle = C.muted;
      c.fillText('perihelion advance exaggerated ~100,000×', 10 * dpr, H - 10 * dpr);
    };
    const loop = (now) => { if (!vis) { run = false; return; } t += reduce() ? 0.004 : 0.016; draw(); requestAnimationFrame(loop); };
    const size = () => { const dpr = Math.min(global.devicePixelRatio || 1, 2), r = canvas.getBoundingClientRect(); canvas.width = Math.max(1, r.width * dpr); canvas.height = Math.max(1, r.height * dpr); draw(); };
    new ResizeObserver(size).observe(canvas);
    new IntersectionObserver((en) => { vis = en[0].isIntersecting; if (vis && !run) { run = true; requestAnimationFrame(loop); } }).observe(canvas);
    size();
  }

  // Mercury: Δφ per orbit = 6πGM / (c² a (1 − e²))
  function mercuryNumbers() {
    const a = 5.7909e10, e = 0.2056, period = 87.969;
    const dphi = 6 * Math.PI * P.K.G * P.K.Msun / (P.K.c * P.K.c * a * (1 - e * e));
    const perCentury = dphi * ARCSEC * (36525 / period);
    return { perOrbit: dphi * ARCSEC, perCentury };
  }

  // Gravitational redshift from a surface: 1 + z = 1 / √(1 − r_s/R)
  function redshiftRows() {
    const rows = [
      ['Earth', P.K.Mearth, P.K.Rearth],
      ['Sun', P.K.Msun, P.K.Rsun],
      ['Sirius B (white dwarf)', 1.02 * P.K.Msun, 0.0081 * P.K.Rsun],
      ['Neutron star', 1.4 * P.K.Msun, 12e3],
    ];
    return rows.map(([n, M, R]) => { const rs = P.schwarzschildRadius(M); const z = 1 / Math.sqrt(1 - rs / R) - 1; return [n, z, z * P.K.c / 1e3]; });
  }

  // LIGO chirp, GW150914-like (detector-frame chirp mass ~30 Msun)
  function chirp(svg, playhead) {
    const C = css(); svg.innerHTML = '';
    const W = 560, H = 200, ml = 36, mr = 12, mt = 16, mb = 34;
    const Mc = 30 * 4.925491e-6; // G Mc / c^3 in seconds
    const fOf = (tau) => (1 / Math.PI) * Math.pow(5 / (256 * tau), 3 / 8) * Math.pow(Mc, -5 / 8);
    const t0 = -0.20, tMerge = 0, tEnd = 0.03;
    const X = (t) => ml + (t - t0) / (tEnd - t0) * (W - ml - mr), Y = (h) => mt + (1 - h) / 2 * (H - mt - mb);
    let ph = 0, last = t0, d = '', fPeak = 250, tPeakTau = null;
    const pts = [];
    for (let t = t0; t <= tEnd; t += 0.00015) {
      let f, A;
      const tau = tMerge - t;
      if (tau > 0) { f = fOf(tau); if (f > fPeak) { f = fPeak; if (tPeakTau === null) tPeakTau = t; } A = Math.pow(f / fPeak, 2 / 3); }
      else { f = fPeak; A = Math.exp(-t / 0.004); }
      if (tPeakTau !== null && tau > 0) A = 1;
      ph += 2 * Math.PI * f * (t - last); last = t;
      pts.push([t, A * Math.sin(ph)]);
    }
    el('line', { x1: ml, x2: W - mr, y1: Y(0), y2: Y(0), stroke: C.line }, svg);
    d = pts.map((p, i) => `${i ? 'L' : 'M'}${X(p[0]).toFixed(1)},${Y(p[1] * 0.9).toFixed(1)}`).join(' ');
    el('path', { d, stroke: C.accent, 'stroke-width': 1.3, fill: 'none' }, svg);
    [-0.2, -0.15, -0.1, -0.05, 0].forEach((t) => { el('text', { x: X(t), y: H - 16, 'text-anchor': 'middle', 'font-size': 10, fill: C.muted }, svg).textContent = t.toFixed(2) + ' s'; });
    el('text', { x: X(-0.19), y: mt + 10, 'font-size': 10, fill: C.muted }, svg).textContent = `inspiral: ${Math.round(fOf(0.19))} Hz`;
    el('text', { x: X(-0.006), y: mt + 10, 'text-anchor': 'end', 'font-size': 10, fill: C.muted }, svg).textContent = 'merger ~250 Hz';
    el('text', { x: X(0.029), y: mt + 10, 'text-anchor': 'end', 'font-size': 10, fill: C.muted }, svg).textContent = 'ringdown';
    el('text', { x: ml, y: H - 3, 'font-size': 10, fill: C.muted }, svg).textContent = 'strain (peak ~10⁻²¹) vs time before merger';
    if (playhead != null) el('line', { x1: X(playhead), x2: X(playhead), y1: mt, y2: H - mb, stroke: '#ffffff', opacity: 0.7 }, svg);
    return { fOf, t0, tEnd };
  }

  global.Rel = { deflection, ARCSEC, lightBend, mercury, mercuryNumbers, redshiftRows, chirp };
})(window);
