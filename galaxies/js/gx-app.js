/* Galaxies — gx-app.js: tabs and every interactive module on galaxies.html */
(function () {
  'use strict';
  const G = window.GX, TAU = Math.PI * 2;
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const store = {
    get(k) { try { return localStorage.getItem('galaxies-' + k); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem('galaxies-' + k, v); } catch (e) { /* storage unavailable */ } },
  };
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const css = () => { const c = getComputedStyle(document.documentElement); const g = (n) => c.getPropertyValue(n).trim(); return { fg: g('--fg'), muted: g('--muted'), faint: g('--faint'), line: g('--line'), soft: g('--line-soft'), accent: g('--accent'), good: g('--good'), bad: g('--bad'), surface: g('--surface'), mono: g('--font-mono') }; };
  // number formatting: 3 sig figs, × 10^n for big/small numbers (HTML)
  function sig(x, n = 3) {
    if (!isFinite(x)) return '—'; if (x === 0) return '0';
    const a = Math.abs(x);
    if (a >= 1e5 || a < 1e-3) { const e = Math.floor(Math.log10(a)); const m = x / Math.pow(10, e); return m.toPrecision(n).replace(/\.?0+$/, '') + ' × 10<sup>' + e + '</sup>'; }
    return x.toLocaleString('en-US', { maximumSignificantDigits: n });
  }
  const NS = 'http://www.w3.org/2000/svg';
  function el(tag, attrs, parent) { const e = document.createElementNS(NS, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); if (parent) parent.appendChild(e); return e; }
  // SVG text: keep at least ~9.5 px on screen when a chart is scaled down on phones
  function txt(parent, x, y, s, attrs) {
    const a = Object.assign({ x, y }, attrs || {});
    if (a['font-size']) { const svg = parent.ownerSVGElement || parent, vb = svg.viewBox && svg.viewBox.baseVal, cw = svg.clientWidth; if (vb && vb.width && cw) a['font-size'] = Math.max(+a['font-size'], 9.5 * vb.width / cw).toFixed(1); }
    if (!a.style) a.style = 'paint-order: stroke; stroke: var(--surface); stroke-width: 3px; stroke-linejoin: round';   // halo keeps labels readable over lines
    const t = el('text', a, parent); t.textContent = s; return t;
  }
  const facts = (box, rows) => { box.innerHTML = rows.map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join(''); };

  /* ================= Tabs ================= */
  const tabs = $$('.gx-tabs [role=tab]');
  const onTab = {};
  function showTab(id, focus) {
    tabs.forEach((t) => {
      const on = t.getAttribute('aria-controls') === id;
      t.setAttribute('aria-selected', String(on)); t.tabIndex = on ? 0 : -1;
      $('#' + t.getAttribute('aria-controls')).hidden = !on;
      if (on && focus) t.focus();
    });
    store.set('tab', id);
    const nav = $('.gx-tabs'), on = tabs.find((t) => t.getAttribute('aria-controls') === id);
    if (nav && on && nav.scrollWidth > nav.clientWidth) nav.scrollLeft = on.offsetLeft - (nav.clientWidth - on.offsetWidth) / 2;
    Object.entries(onTab).forEach(([k, fn]) => fn(k === id));
  }
  tabs.forEach((t, i) => {
    t.addEventListener('click', () => showTab(t.getAttribute('aria-controls')));
    t.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowRight') showTab(tabs[(i + 1) % tabs.length].getAttribute('aria-controls'), true);
      if (e.key === 'ArrowLeft') showTab(tabs[(i - 1 + tabs.length) % tabs.length].getAttribute('aria-controls'), true);
      if (e.key === 'Home') { e.preventDefault(); showTab(tabs[0].getAttribute('aria-controls'), true); }
      if (e.key === 'End') { e.preventDefault(); showTab(tabs[tabs.length - 1].getAttribute('aria-controls'), true); }
    });
  });
  window.addEventListener('hashchange', () => { const h = location.hash.slice(1); if (tabs.some((t) => t.getAttribute('aria-controls') === h)) showTab(h); });

  /* ================= Milky Way 3D ================= */
  const MW = (() => {
    const canvas = $('#mwCanvas'), ov = $('#mwOverlay');
    const pg = new G.PointGL(canvas);
    if (!pg.ok) { $('#mwFallback').hidden = false; return { setOpen() {}, kick() {} }; }
    const MWm = G.milkyWay;
    pg.setCloud(MWm(matchMedia('(max-width: 600px)').matches ? 0.6 : 1));
    const S = { yaw: -1.2, pitch: -0.6, dist: 31, fov: 50, vis: [1, 1, 1, 1, 1, 1, 1, 0], pop: false, labels: true, spin: !reduceMotion, wind: false, t: 0, earth: false, lookYaw: 0, lookPitch: 0 };
    const VIEWS = {
      // all views from the north Galactic pole side (-y): the disk turns clockwise, as the real one does
      tilt: { label: 'Tilted', s: { yaw: -1.2, pitch: -0.6, dist: 31, fov: 50, earth: false } },
      face: { label: 'Face-on (from the north)', s: { yaw: -Math.PI / 2, pitch: -1.55, dist: 40, fov: 50, earth: false } },
      edge: { label: 'Edge-on', s: { yaw: -1.4, pitch: -0.03, dist: 42, fov: 50, earth: false } },
      earth: { label: 'From Earth', s: { earth: true, fov: 100, lookYaw: 0, lookPitch: 0 } },
      halo: { label: 'Whole halo', s: { yaw: -1.2, pitch: -0.4, dist: 330, fov: 50, earth: false }, vis: { 7: 1, 5: 1 } },
    };
    const omega = (R) => (S.wind ? 1 / Math.max(R, 0.4) : 0.06);
    const rot = (p, R) => { const a = -S.t * omega(R), c = Math.cos(a), s = Math.sin(a); return [c * p[0] - s * p[2], p[1], s * p[0] + c * p[2]]; };
    const sunPos = () => rot([-G.R_SUN_GC, -0.02, 0], G.R_SUN_GC);
    let raf = 0, open = false, onScreen = true, last = 0, dirty = true;
    // quality: share of the star points drawn; drops if frames are slow, recovers if fast
    const Q = { q: 1, avg: 16 };
    const TW = new Map();

    function camera(W, H) {
      const P = G.M4.persp(S.fov * Math.PI / 180, W / H, 0.02, 3000);
      let V;
      if (S.earth) {
        const e = sunPos(), toC = G.norm([-e[0], -e[1], -e[2]]);
        const base = Math.atan2(toC[0], toC[2]) + S.lookYaw, pt = S.lookPitch;
        const d = [Math.sin(base) * Math.cos(pt), Math.sin(pt), Math.cos(base) * Math.cos(pt)];
        V = G.M4.lookAt(e, [e[0] + d[0], e[1] + d[1], e[2] + d[2]], [0, -1, 0]);
      } else {
        const e = [S.dist * Math.cos(S.pitch) * Math.sin(S.yaw), S.dist * Math.sin(S.pitch), S.dist * Math.cos(S.pitch) * Math.cos(S.yaw)];
        V = G.M4.lookAt(e, [0, 0, 0], Math.abs(S.pitch) > 1.5 ? [-Math.sin(S.yaw), 0, -Math.cos(S.yaw)] : [0, -1, 0]);
      }
      return G.M4.mul(P, V);
    }
    function draw() {
      const r = canvas.getBoundingClientRect(), dpr = Math.min(devicePixelRatio || 1, 2);
      const W = Math.max(100, Math.round(r.width * dpr)), H = Math.max(100, Math.round(r.height * dpr));
      if (canvas.width !== W || canvas.height !== H) { canvas.width = W; canvas.height = H; ov.width = W; ov.height = H; }
      const mvp = camera(W, H);
      const scale = H / (2 * Math.tan(S.fov * Math.PI / 360)) * (S.earth ? 0.6 : 1);
      const count = S.vis[7] ? pg.n : Math.round(pg.nStars * Q.q);
      pg.draw(mvp, { scale, t: S.t, wind: S.wind, pop: S.pop, vis: S.vis, popOf: MWm.POP, max: S.earth ? 5 : 16, count, gain: S.vis[7] ? 1 : 1 / Math.max(Q.q, 0.3) });
      overlay(mvp, W, H, dpr);
      dirty = false;
    }
    function overlay(mvp, W, H, d) {
      const c = ov.getContext('2d'); c.clearRect(0, 0, W, H);
      const boxes = [];
      const hits = (b) => boxes.some((o) => b[0] < o[2] && b[2] > o[0] && b[1] < o[3] && b[3] > o[1]);
      const proj = (p) => { const q = G.M4.apply(mvp, p); if (q[2] <= 0.05 || Math.abs(q[0]) > 1.05 || Math.abs(q[1]) > 1.05) return null; return [(q[0] + 1) / 2 * W, (1 - q[1]) / 2 * H]; };
      const small = W / d < 520;      // phone-sized canvas: smaller labels, only the Sun's neighbourhood
      const fs = small ? 9.5 : 11;
      const tag = (p, s, col, dot) => {
        const q = proj(p); if (!q) return;
        c.font = `600 ${fs * d}px ui-monospace, Menlo, monospace`; c.textBaseline = 'middle';
        const key = s + '|' + fs * d; let w = TW.get(key); if (w == null) { w = c.measureText(s).width; TW.set(key, w); }   // text widths cached
        if (dot) { c.fillStyle = col; c.beginPath(); c.arc(q[0], q[1], 3.5 * d, 0, TAU); c.fill(); c.strokeStyle = 'rgba(0,0,0,.6)'; c.lineWidth = d; c.stroke(); }
        const x = Math.min(W - w - 10 * d, q[0] + 8 * d);
        let y = Math.max(10 * d, q[1] - (dot ? 10 * d : 0)), tries = 0;
        const hb = (fs * 0.73) * d, box = (yy) => [x - 4 * d, yy - hb, x + w + 4 * d, yy + hb];
        while (hits(box(y)) && tries < 5) { y += (2 * hb + 2 * d); tries++; }
        if (hits(box(y)) || y > H - 8 * d) return;
        boxes.push(box(y));
        if (tries) { c.strokeStyle = 'rgba(255,255,255,0.4)'; c.lineWidth = d; c.beginPath(); c.moveTo(q[0], q[1]); c.lineTo(x - 4 * d, y); c.stroke(); }
        c.fillStyle = 'rgba(6,8,18,0.7)'; c.fillRect(x - 4 * d, y - hb, w + 8 * d, 2 * hb);
        c.fillStyle = col; c.textAlign = 'left'; c.fillText(s, x, y);
      };
      // the Sun is always marked, even with labels off
      if (!S.earth) tag(sunPos(), S.labels ? 'Sun (you are here)' : 'Sun', '#ffd27a', true);
      if (!S.labels) return;
      tag([0, -0.3, 0], 'Sgr A* (centre)', '#ffffff', true);
      const clutter = S.earth || Math.abs(S.pitch) < 0.3 || S.dist > 100;
      if (!S.wind && !clutter && small) {
        // the arms just inside and outside the Sun's orbit, labelled near it, plus our own spur
        const near = (k, ph) => { const tp = Math.tan(13 * Math.PI / 180); let R = MWm.ARM_R0 * Math.exp(tp * ((((ph - MWm.ARMS[k].phi0) % TAU) + TAU) % TAU)); while (R > 13) R /= Math.exp(tp * TAU); return R; };
        [[0, 'Sagittarius Arm', Math.PI - 0.35], [3, 'Perseus Arm', Math.PI + 0.45]].forEach(([k, nm, ph]) => { const R = near(k, ph); tag(rot([R * Math.cos(ph), 0, R * Math.sin(ph)], R), nm, '#9cc8ff', false); });
        tag(rot([-8.6, 0, 0.9], 8.6), 'Orion Spur', '#9cc8ff', false);
      } else if (!S.wind && !clutter) {
        MWm.ARMS.forEach((a, k) => { const R = 11.5, ph = MWm.armPhi(R, k); tag(rot([R * Math.cos(ph), 0, R * Math.sin(ph)], R), a.name, '#9cc8ff', false); });
        if (!S.earth) tag(rot([-8.6, 0, 0.9], 8.6), 'Orion Spur', '#9cc8ff', false);
        const b = MWm.BAR_ANGLE; tag(rot([-4.3 * Math.cos(b), -0.2, 4.3 * Math.sin(b)], 4.3), 'Bar (near end)', '#ffb27a', false);
      }
      if (S.vis[7]) tag([0, -150, 0], 'Dark-matter halo (~200 kpc)', '#b9a0ff', false);
      if (S.vis[6] && !S.earth && S.dist < 100) tag([14, -18, -10], 'Globular clusters', '#ffe2a0', false);
    }
    function loop(now) {
      if (!open || !onScreen || document.hidden) { raf = 0; return; }
      const raw = last ? now - last : 16, dt = Math.min(0.05, raw / 1000); last = now;
      if (S.spin && raw < 200) {
        Q.avg = Q.avg * 0.9 + raw * 0.1;
        if (Q.avg > 30 && Q.q > 0.3) { Q.q = Math.max(0.3, Q.q * 0.85); Q.avg = 20; }
        else if (Q.avg < 18 && Q.q < 1) { Q.q = Math.min(1, Q.q * 1.05); Q.avg = 17; }
      }
      if (S.spin) { S.t += dt * (S.wind ? 6 : 1.2); dirty = true; }
      if (dirty) draw();
      if (S.wind) windInfo();
      // nothing moves: stop until kick() restarts the loop
      if (!S.spin) { raf = 0; return; }
      raf = requestAnimationFrame(loop);
    }
    const kick = () => { dirty = true; if (!raf && open) { last = 0; raf = requestAnimationFrame(loop); } };
    let windShown = null;
    function windInfo() {
      const orbits = S.t / G.R_SUN_GC / TAU, myr = Math.round(orbits * galYear());
      if (myr === windShown) return; windShown = myr;
      $('#mwWindNote .h').textContent = `The winding problem · ${myr} million years`;
    }
    const galYear = () => TAU * G.R_SUN_GC / G.V_SUN * G.MYR_PER_KPC_KMS;

    // drag
    let down = false, x0 = 0, y0 = 0, a0 = 0, b0 = 0;
    canvas.addEventListener('pointerdown', (e) => { down = true; x0 = e.clientX; y0 = e.clientY; a0 = S.earth ? S.lookYaw : S.yaw; b0 = S.earth ? S.lookPitch : S.pitch; canvas.setPointerCapture(e.pointerId); });
    canvas.addEventListener('pointermove', (e) => {
      if (!down) return;
      const dx = (e.clientX - x0) * 0.008, dy = (e.clientY - y0) * 0.008;
      if (S.earth) { S.lookYaw = a0 - dx; S.lookPitch = Math.max(-1.4, Math.min(1.4, b0 + dy)); }
      else { S.yaw = a0 - dx; S.pitch = Math.max(-1.55, Math.min(1.55, b0 + dy)); }
      $$('#mwViews button').forEach((b) => b.setAttribute('aria-pressed', 'false'));
      kick();
    });
    const up = () => { down = false; }; canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', up);

    // UI
    const vbox = $('#mwViews');
    Object.entries(VIEWS).forEach(([k, v]) => {
      const b = document.createElement('button'); b.type = 'button'; b.textContent = v.label; b.setAttribute('aria-pressed', String(k === 'tilt'));
      b.addEventListener('click', () => {
        Object.assign(S, v.s); $$('button', vbox).forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
        S.vis[7] = k === 'halo' ? 1 : 0;
        if (v.vis) Object.entries(v.vis).forEach(([g, on]) => { S.vis[g] = on; });
        syncLayers(); kick();
      });
      vbox.appendChild(b);
    });
    const lbox = $('#mwLayers');
    const swatch = ['#ffd9a0', '#a6c8ff', '#ff6fa0', '#ffbf8a', '#ff9e66', '#ff8a5c', '#ffe2a0', '#a98bff'];
    MWm.GROUPS.forEach((name, g) => {
      const lab = document.createElement('label'); lab.className = 'gx-check';
      lab.innerHTML = `<input type="checkbox" data-g="${g}"><span class="dot" style="background:${swatch[g]}"></span>${name}`;
      lab.querySelector('input').addEventListener('change', (e) => { S.vis[g] = e.target.checked ? 1 : 0; if (g === 7 && e.target.checked && S.dist < 200 && !S.earth) S.dist = 330; kick(); });
      lbox.appendChild(lab);
    });
    function syncLayers() { $$('input', lbox).forEach((i) => { i.checked = !!S.vis[+i.dataset.g]; }); }
    syncLayers();
    const tog = (id, key, after) => { const i = $(id); i.checked = !!S[key]; i.addEventListener('change', () => { S[key] = i.checked; if (after) after(); kick(); }); };
    tog('#mwPop', 'pop', () => { $('#mwPopKey').hidden = !S.pop; });
    tog('#mwLabels', 'labels');
    tog('#mwSpin', 'spin');
    tog('#mwWind', 'wind', () => { S.t = 0; $('#mwWindNote').hidden = !S.wind; if (S.wind) { S.spin = true; $('#mwSpin').checked = true; S.vis[2] = S.vis[2]; } });

    const gy = galYear();
    facts($('#mwFacts'), [
      ['Type', 'Barred spiral (SBbc)'],
      ['Disk diameter', '~100,000 ly (~30 kpc)'],
      ['Thin disk thickness', '~1,000 ly'],
      ['Stars', '100–400 billion'],
      ['Sun to centre', `~26,700 ly (${G.R_SUN_GC} kpc; often rounded to 26,000)`],
      ['Sun’s orbital speed', `${G.V_SUN} km/s`],
      ['One orbit (galactic year)', `~${Math.round(gy)} million years`],
      ['Total mass, with dark matter', '~1 × 10<sup>12</sup> M☉ (Gaia-era estimates 0.7–1.5)'],
      ['Central black hole', '4.3 million M☉ (GRAVITY 2019–22: 4.2–4.3 million, depending on the distance used)'],
    ]);
    new IntersectionObserver((e) => { onScreen = e[0].isIntersecting; if (onScreen) kick(); }).observe(canvas);
    new ResizeObserver(() => kick()).observe(canvas);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) kick(); });
    return { setOpen(on) { open = on; if (on) kick(); }, kick, _S: S, _raf: () => raf };
  })();
  onTab.mw = (on) => MW.setOpen(on);

  /* ---------- Rotation curve ---------- */
  const RC = (() => {
    // Approximate measurements (Sofue 2013 inside 5 kpc; Eilers et al. 2019 outside)
    const DATA = [[1, 190], [2, 215], [3, 220], [4, 224], [5, 226], [6, 228], [7, 229], [8.2, 229], [10, 227], [12, 224], [14, 221], [16, 218], [18, 214], [20, 210], [22, 205], [25, 200]];
    const Gk = G.G_KPC;
    const vBulge2 = (r) => Gk * 1.8e10 * r / Math.pow(r + 0.6, 2);       // bulge + bar (Bland-Hawthorn & Gerhard 2016)
    const vDisk2 = (r) => Gk * 6.5e10 * r * r / Math.pow(r * r + 3.3 * 3.3, 1.5);   // stellar + gas disk
    const vVis2 = (r) => vBulge2(r) + vDisk2(r);
    const vHalo2 = (r, v, c) => v * v * (1 - (c / r) * Math.atan(r / c));
    const S = { v: 0, c: 6 };
    const rms = (v, c) => Math.sqrt(DATA.reduce((s, [r, d]) => s + Math.pow(Math.sqrt(vVis2(r) + vHalo2(r, v, c)) - d, 2), 0) / DATA.length);
    function best() { let b = [1e9, 0, 0]; for (let v = 100; v <= 320; v += 1) for (let c = 0.5; c <= 20; c += 0.25) { const e = rms(v, c); if (e < b[0]) b = [e, v, c]; } return b; }
    function draw() {
      const svg = $('#rcSvg'); svg.innerHTML = '';
      const narrow = svg.clientWidth > 0 && svg.clientWidth < 520;
      const W = 640, H = 380, ml = 52, mr = 16, mt = narrow ? 70 : 16, mb = 44, k = css();
      const X = (r) => ml + r / 26 * (W - ml - mr), Y = (v) => mt + (1 - v / 320) * (H - mt - mb);
      for (let v = 0; v <= 300; v += 50) { el('line', { x1: ml, x2: W - mr, y1: Y(v), y2: Y(v), stroke: k.soft }, svg); txt(svg, ml - 8, Y(v) + 4, v, { 'text-anchor': 'end', fill: k.muted, 'font-size': 11 }); }
      for (let r = 0; r <= 25; r += 5) txt(svg, X(r), H - mb + 18, r, { 'text-anchor': 'middle', fill: k.muted, 'font-size': 11 });
      txt(svg, (ml + W - mr) / 2, H - 6, 'distance from the Galactic Centre (kpc)', { 'text-anchor': 'middle', fill: k.muted, 'font-size': 12 });
      if (narrow) txt(svg, 4, mt - 8, 'speed, km/s', { fill: k.muted, 'font-size': 12 });
      else { const yl = txt(svg, 14, (mt + H - mb) / 2, 'orbital speed (km/s)', { 'text-anchor': 'middle', fill: k.muted, 'font-size': 12 }); yl.setAttribute('transform', `rotate(-90 14 ${(mt + H - mb) / 2})`); }
      const path = (fn, attrs) => { let d = ''; for (let i = 1; i <= 130; i++) { const r = i / 130 * 26; d += (i > 1 ? 'L' : 'M') + X(r).toFixed(1) + ',' + Y(Math.sqrt(Math.max(0, fn(r)))).toFixed(1); } el('path', Object.assign({ d, fill: 'none' }, attrs), svg); };
      path(vVis2, { stroke: '#ff9e5e', 'stroke-width': 2, 'stroke-dasharray': '6 4' });
      if (S.v > 0) path((r) => vHalo2(r, S.v, S.c), { stroke: '#a98bff', 'stroke-width': 2, 'stroke-dasharray': '2 3' });
      path((r) => vVis2(r) + vHalo2(r, S.v, S.c), { stroke: k.accent, 'stroke-width': 3 });
      DATA.forEach(([r, v]) => el('circle', { cx: X(r), cy: Y(v), r: 4.5, fill: k.fg, stroke: k.surface, 'stroke-width': 1.5 }, svg));
      el('line', { x1: X(8.2), x2: X(8.2), y1: mt, y2: H - mb, stroke: k.accent, 'stroke-dasharray': '3 3' }, svg);
      txt(svg, X(8.2) + 5, mt + 12, 'Sun', { fill: k.accent, 'font-size': 11 });
      // legend
      const lg = [['measured', k.fg, 'dot'], [narrow ? 'visible only' : 'visible stars + gas only', '#ff9e5e', '6 4'], ['dark-matter halo', '#a98bff', '2 3'], ['total model', k.accent, '']];
      lg.forEach(([s, col, dash], i) => {
        // narrow screens: legend in two columns above the plot; wide: bottom right
        const y = narrow ? 18 + Math.floor(i / 2) * 22 : H - mb - 14 - (lg.length - 1 - i) * 17, x = narrow ? 8 + (i % 2) * 300 : W - mr - 190;
        if (dash === 'dot') el('circle', { cx: x + 10, cy: y - 4, r: 4, fill: col }, svg);
        else el('line', { x1: x, x2: x + 22, y1: y - 4, y2: y - 4, stroke: col, 'stroke-width': dash ? 2 : 3, 'stroke-dasharray': dash }, svg);
        txt(svg, x + 30, y, s, { fill: k.muted, 'font-size': 11 });
      });
      const e = rms(S.v, S.c);
      const r25 = 25, vt2 = vVis2(r25) + vHalo2(r25, S.v, S.c), Mtot = vt2 * r25 / Gk, Mvis = vVis2(r25) * r25 / Gk;
      const measured = 200 * 200 * 25 / Gk;
      facts($('#rcStats'), [
        ['Fit error (rms)', `${e.toFixed(0)} km/s ${e < 8 ? '· <b style="color:var(--good)">good fit</b>' : ''}`],
        ['Mass inside 25 kpc (from data)', sig(measured, 2) + ' M☉'],
        ['Visible mass inside 25 kpc', sig(Mvis, 2) + ' M☉'],
        ['Dark matter share (model)', S.v ? Math.round((1 - Mvis / Mtot) * 100) + '%' : '0%'],
      ]);
      $('#rcVOut').textContent = S.v + ' km/s'; $('#rcCOut').textContent = S.c + ' kpc';
    }
    $('#rcV').addEventListener('input', (e) => { S.v = +e.target.value; draw(); });
    $('#rcC').addEventListener('input', (e) => { S.c = +e.target.value; draw(); });
    $('#rcFit').addEventListener('click', () => { const b = best(); S.v = b[1]; S.c = b[2]; $('#rcV').value = S.v; $('#rcC').value = S.c; draw(); });
    $('#rcNone').addEventListener('click', () => { S.v = 0; $('#rcV').value = 0; draw(); });
    return { draw, best };
  })();

  /* ---------- Stars around Sgr A* ---------- */
  const SGR = (() => {
    const STARS = {
      // tp = year of pericentre passage
      S2: { P: 16.05, a: 0.1255, e: 0.8847, w: 1.2, tp: 2018.38, col: '#ffd27a' },
      S38: { P: 19.2, a: 0.1416, e: 0.818, w: 3.4, tp: 2003.19, col: '#8fd0ff' },
      S55: { P: 12.8, a: 0.1078, e: 0.7209, w: 5.2, tp: 2009.31, col: '#ff8fb8' },
    };
    const S = { star: 'S2', P: 16.05, a: 0.1255, d: 8.18, yr: 2010 };
    const canvas = $('#sgrCanvas'); let raf = 0, open = false, last = 0;
    const calc = () => {
      const aAU = S.a * S.d * 1000, M = Math.pow(aAU, 3) / (S.P * S.P);       // Kepler III in AU, yr, M☉
      const e = (STARS[S.star] || STARS.S2).e, rp = aAU * (1 - e);
      const vp = 2 * Math.PI * Math.sqrt(M * (2 / rp - 1 / aAU)) * 4.74047;      // AU/yr → km/s
      const rsAU = 2 * 6.6743e-11 * M * G.MSUN_KG / (G.C_KMS * 1e3) ** 2 / 1.495978707e11;
      return { aAU, M, rp, vp, rsAU, e };
    };
    function steps() {
      const c = calc();
      $('#sgrSteps').innerHTML = `
        <li><b>Turn the angle into a size.</b> At distance d (pc), 1″ spans d AU: a = ${S.a}″ × ${sig(S.d * 1000, 4)} pc = <b>${sig(c.aAU, 4)} AU</b>.</li>
        <li><b>Kepler's third law</b> in solar units (AU, years): M = a³ / P² = ${sig(c.aAU, 4)}³ / ${S.P}² = <b>${sig(c.M, 3)} M☉</b>.</li>
        <li><b>Check it's a black hole.</b> At closest approach ${S.star} is ${sig(c.rp, 3)} AU (${sig(c.rp * 8.317 / 60, 2)} light-hours) from the centre, moving ${sig(c.vp, 3)} km/s (${(c.vp / G.C_KMS * 100).toFixed(1)}% of c). Millions of solar masses inside a region that small can only be a black hole (r<sub>s</sub> = ${sig(c.rsAU, 2)} AU).</li>
        <li class="note">Why the distance matters: M ∝ a³ ∝ d³, so a 1% distance error is a 3% mass error.</li>`;
      $('#sgrPOut').textContent = S.P.toFixed(2) + ' yr'; $('#sgrAOut').textContent = S.a.toFixed(4) + '″'; $('#sgrDOut').textContent = S.d.toFixed(2) + ' kpc';
    }
    // Kepler's equation for the position at time t (years)
    // the selected star is drawn with the slider values, so editing P and a changes its orbit
    const el2 = (nm) => (nm === S.star ? Object.assign({}, STARS[nm], { P: S.P, a: S.a }) : STARS[nm]);
    function pos(st, t) {
      const ph = ((t - st.tp) / st.P) % 1, Mn = TAU * (ph < 0 ? ph + 1 : ph), e = st.e; let E = Mn;
      for (let i = 0; i < 12; i++) E = E - (E - e * Math.sin(E) - Mn) / (1 - e * Math.cos(E));
      const x = st.a * (Math.cos(E) - e), y = st.a * Math.sqrt(1 - e * e) * Math.sin(E);
      return [x * Math.cos(st.w) - y * Math.sin(st.w), x * Math.sin(st.w) + y * Math.cos(st.w)];
    }
    function draw() {
      const r = canvas.getBoundingClientRect(), dpr = Math.min(devicePixelRatio || 1, 2);
      const W = Math.round(r.width * dpr), H = Math.round(r.height * dpr); if (!W || !H) return;
      if (canvas.width !== W || canvas.height !== H) { canvas.width = W; canvas.height = H; }
      const c = canvas.getContext('2d'); c.clearRect(0, 0, W, H);
      const reach = Object.keys(STARS).reduce((m, nm) => { const st = el2(nm); return Math.max(m, st.a * (1 + st.e)); }, 0) * 1.12, sc = Math.min(W, H) / 2 / reach, cx = W / 2, cy = H / 2;
      c.fillStyle = '#05060d'; c.fillRect(0, 0, W, H);
      Object.keys(STARS).forEach((nm, k) => {
        const st = el2(nm), sel = nm === S.star;
        c.beginPath();
        for (let i = 0; i <= 240; i++) { const p = pos(st, st.P * i / 240); i ? c.lineTo(cx + p[0] * sc, cy - p[1] * sc) : c.moveTo(cx + p[0] * sc, cy - p[1] * sc); }
        c.strokeStyle = st.col; c.globalAlpha = sel ? 0.8 : 0.3; c.lineWidth = (sel ? 1.6 : 1) * dpr; c.stroke(); c.globalAlpha = 1;
        const p = pos(st, S.yr);
        c.fillStyle = st.col; c.beginPath(); c.arc(cx + p[0] * sc, cy - p[1] * sc, (sel ? 5 : 3.5) * dpr, 0, TAU); c.fill();
        c.font = `${11 * dpr}px ui-monospace, Menlo, monospace`;
        const ox = [8, 8, -34][k] * dpr, oy = [-8, 14, -8][k] * dpr;              // stagger labels so they don't stack
        c.fillText(nm, cx + p[0] * sc + ox, cy - p[1] * sc + oy);
      });
      const g = c.createRadialGradient(cx, cy, 0, cx, cy, 10 * dpr); g.addColorStop(0, '#fff'); g.addColorStop(0.3, '#ffb35c'); g.addColorStop(1, 'rgba(255,120,40,0)');
      c.fillStyle = g; c.beginPath(); c.arc(cx, cy, 10 * dpr, 0, TAU); c.fill();
      c.fillStyle = '#fff'; c.font = `600 ${11 * dpr}px ui-monospace, Menlo, monospace`; c.textAlign = 'right'; c.fillText('Sgr A*', cx - 10 * dpr, cy + 22 * dpr); c.textAlign = 'left';
      c.fillStyle = 'rgba(255,255,255,.85)'; c.font = `${12 * dpr}px ui-monospace, Menlo, monospace`;
      c.fillText(`year ${S.yr.toFixed(1)}`, 10 * dpr, 20 * dpr);
      // 0.05″ scale bar = 0.05 × 8180 AU ≈ 400 AU
      const bl = 0.05 * sc; c.strokeStyle = '#fff'; c.lineWidth = 1.5 * dpr; c.beginPath(); c.moveTo(10 * dpr, H - 14 * dpr); c.lineTo(10 * dpr + bl, H - 14 * dpr); c.stroke();
      c.fillText(`0.05″ ≈ ${Math.round(0.05 * S.d * 1000)} AU`, 10 * dpr, H - 20 * dpr);
    }
    function loop(now) {
      if (!open) { raf = 0; return; }
      const dt = last ? Math.min(0.05, (now - last) / 1000) : 0; last = now;
      if (!reduceMotion) { S.yr += dt * 1.6; if (S.yr > 2040) S.yr = 1995; }
      draw(); raf = requestAnimationFrame(loop);
    }
    const sb = $('#sgrStars');
    Object.keys(STARS).forEach((k) => {
      const b = document.createElement('button'); b.type = 'button'; b.textContent = k; b.setAttribute('aria-pressed', String(k === 'S2'));
      b.addEventListener('click', () => { S.star = k; S.P = STARS[k].P; S.a = STARS[k].a; $('#sgrP').value = S.P; $('#sgrA').value = S.a; $$('button', sb).forEach((x) => x.setAttribute('aria-pressed', String(x === b))); steps(); draw(); });
      sb.appendChild(b);
    });
    [['#sgrP', 'P'], ['#sgrA', 'a'], ['#sgrD', 'd']].forEach(([id, k]) => $(id).addEventListener('input', (e) => { S[k] = +e.target.value; steps(); draw(); }));
    steps();
    let vis = true;
    new IntersectionObserver((e) => { vis = e[0].isIntersecting; set(); }).observe(canvas);
    const set = () => { const want = open0 && vis && !document.hidden; open = want; if (want && !raf) { last = 0; raf = requestAnimationFrame(loop); } };
    let open0 = false;
    document.addEventListener('visibilitychange', set);
    return { setOpen(on) { open0 = on; set(); if (on) { steps(); draw(); } }, calc };
  })();
  const prevMw = onTab.mw; onTab.mw = (on) => { prevMw(on); SGR.setOpen(on); if (on) RC.draw(); };

  /* ================= Galaxy types ================= */
  const TYPES = {
    E0: { cls: 'E', name: 'E0 elliptical', ex: 'M87 (Virgo cluster)', d: 'Round. Old, reddish stars on random orbits; almost no gas or dust, so almost no new stars. The biggest galaxies in the universe are giant ellipticals at the centres of clusters.' },
    E3: { cls: 'E', name: 'E3 elliptical', ex: 'M32 is E2', d: 'Looks moderately flattened (b/a = 0.7). Same contents as any elliptical: old stars, little gas.' },
    E5: { cls: 'E', name: 'E5 elliptical', ex: 'M110 (Andromeda’s satellite)', d: 'Looks strongly flattened (b/a = 0.5).' },
    E7: { cls: 'E', name: 'E7 elliptical', ex: '—', d: 'The flattest ellipticals look (b/a = 0.3). Flatter than that and it’s a disk.' },
    S0: { cls: 'S0', name: 'S0 lenticular', ex: 'NGC 5866 (Spindle Galaxy)', d: 'A disk and a bulge but no spiral arms and little gas. Between ellipticals and spirals: a disk galaxy that has stopped forming stars.' },
    Sa: { cls: 'S', name: 'Sa spiral', ex: 'Sombrero Galaxy (M104)', d: 'Big bright bulge, tightly wound smooth arms, little gas.' },
    Sb: { cls: 'S', name: 'Sb spiral', ex: 'Andromeda (M31)', d: 'Medium bulge, moderately wound arms with dust lanes and young blue stars.' },
    Sc: { cls: 'S', name: 'Sc spiral', ex: 'Whirlpool (M51), Triangulum (M33)', d: 'Small bulge, loose, clumpy arms full of gas, dust, blue stars and pink star-forming nebulae.' },
    SBa: { cls: 'SB', name: 'SBa barred spiral', ex: 'NGC 4314', d: 'A bar of stars through the centre; arms start at the bar’s ends. Big bulge, tight arms.' },
    SBb: { cls: 'SB', name: 'SBb barred spiral', ex: 'NGC 1300; the Milky Way is SBbc', d: 'Bar plus moderately wound arms. About two-thirds of nearby disk galaxies have a bar.' },
    SBc: { cls: 'SB', name: 'SBc barred spiral', ex: 'NGC 1073', d: 'Bar, small bulge, loose arms rich in gas.' },
    Irr: { cls: 'Irr', name: 'Irregular', ex: 'Large and Small Magellanic Clouds', d: 'No regular shape. Usually small, gas-rich, blue and forming stars, often stirred up by a bigger neighbour.' },
  };
  const VIEW = (k) => (k[0] === 'E' ? { tilt: 0 } : k === 'Irr' ? { tilt: 1.1 } : k === 'S0' ? { tilt: 0.32 } : { tilt: 1.15, rot: 0.6 });
  function renderFork() {
    const box = $('#fork'); box.innerHTML = '';
    const order = [['E0', 'e'], ['E3', 'e'], ['E5', 'e'], ['E7', 'e'], ['S0', 'j'], ['Sa', 's'], ['Sb', 's'], ['Sc', 's'], ['SBa', 'b'], ['SBb', 'b'], ['SBc', 'b'], ['Irr', 'i']];
    order.forEach(([k, row], i) => {
      const b = document.createElement('button'); b.type = 'button'; b.className = `fork-item fk-${row}`; b.dataset.k = k;
      b.style.setProperty('--i', i);
      const cv = document.createElement('canvas'); cv.width = 150; cv.height = 150; cv.setAttribute('aria-hidden', 'true');
      b.appendChild(cv); const l = document.createElement('span'); l.textContent = k; b.appendChild(l);
      b.addEventListener('click', () => pickType(k));
      box.appendChild(b);
      G.splat(cv, G.galaxyType(k, 11 + i, 9000), Object.assign({ zoom: 1.05, gain: 1.4 }, VIEW(k)));
    });
    const lines = el('svg', { class: 'fork-lines', 'aria-hidden': 'true' }); box.appendChild(lines);
    // The fork itself: a stem through the ellipticals to S0, then two prongs (normal and barred spirals)
    const drawLines = () => {
      lines.innerHTML = '';
      const bb = box.getBoundingClientRect(); if (!bb.width || matchMedia('(max-width: 980px)').matches) { lines.style.display = 'none'; return; }
      lines.style.display = 'block'; lines.setAttribute('viewBox', `0 0 ${bb.width} ${bb.height}`);
      const ctr = (k) => { const r = box.querySelector(`[data-k="${k}"]`).getBoundingClientRect(); return [r.left - bb.left + r.width / 2, r.top - bb.top + r.height / 2]; };
      const seg = (a, b2) => el('line', { x1: a[0], y1: a[1], x2: b2[0], y2: b2[1], stroke: 'var(--accent)', 'stroke-width': 3, 'stroke-linecap': 'round', opacity: 0.7 }, lines);
      seg(ctr('E0'), ctr('S0')); seg(ctr('S0'), ctr('Sa')); seg(ctr('S0'), ctr('SBa')); seg(ctr('Sa'), ctr('Sc')); seg(ctr('SBa'), ctr('SBc'));
    };
    drawLines();
    if (!renderFork.ro) { renderFork.ro = new ResizeObserver(() => drawLines()); renderFork.ro.observe(box); }
    pickType('Sb');
  }
  function pickType(k) {
    $$('.fork-item').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.k === k)));
    const t = TYPES[k];
    const prop = {
      E: [['Stars', 'Old and red (mostly metal-rich, unlike halo stars)'], ['Gas and dust', 'Very little'], ['New stars', 'Almost none'], ['Motion', 'Random orbits, little rotation']],
      S0: [['Stars', 'Mostly old'], ['Gas and dust', 'Little'], ['New stars', 'Little'], ['Motion', 'Disk rotates']],
      S: [['Stars', 'Old bulge and halo, young disk'], ['Gas and dust', 'Plenty, in the disk'], ['New stars', 'Yes, in the arms'], ['Motion', 'Disk rotates in an orderly way']],
      SB: [['Stars', 'Old bulge and bar, young disk'], ['Gas and dust', 'Plenty, in the disk'], ['New stars', 'Yes, in the arms'], ['Motion', 'Disk rotates; the bar funnels gas inward']],
      Irr: [['Stars', 'Many young, blue'], ['Gas and dust', 'Lots'], ['New stars', 'Many'], ['Motion', 'Disordered']],
    }[t.cls];
    $('#typeInfo').innerHTML = `<h3>${t.name}</h3><p>${t.d}</p><dl class="facts">${prop.map(([a, b]) => `<div><dt>${a}</dt><dd>${b}</dd></div>`).join('')}<div><dt>Example</dt><dd>${t.ex}</dd></div></dl>`;
  }

  /* ---------- Classify ---------- */
  const CLS = (() => {
    const POOL = ['E0', 'E3', 'E6', 'S0', 'Sa', 'Sb', 'Sc', 'SBa', 'SBb', 'SBc', 'Irr', 'Sb', 'SBb', 'E4'];
    const CH = [['E', 'Elliptical'], ['S0', 'Lenticular (S0)'], ['S', 'Spiral'], ['SB', 'Barred spiral'], ['Irr', 'Irregular']];
    const WHY = {
      E: 'Smooth, featureless, reddish light that fades steadily outward. No disk, no arms.',
      S0: 'A bright bulge in a smooth disk, but no spiral arms and no blue knots.',
      S: 'Arms wind out from a round central bulge. Blue knots in the arms are young stars.',
      SB: 'The arms start at the ends of a straight bar of stars through the centre.',
      Irr: 'No symmetry: clumps of blue stars and pink nebulae scattered about.',
    };
    let cur = null, n = 0, right = 0, done = false, seed = 100;
    function next() {
      seed++; const r = G.rng(seed * 977);
      const k = POOL[(r() * POOL.length) | 0];
      const base = TYPES[k] || { cls: 'E' };
      cur = { k, cls: k === 'E6' || k === 'E4' ? 'E' : base.cls };
      const cv = $('#clsCanvas');
      const disk = cur.cls !== 'E';
      G.splat(cv, G.galaxyType(k === 'E6' ? 'E6' : k, seed, 14000), { tilt: disk ? 0.7 + r() * 0.75 : 0, rot: r() * TAU, roll: r() * TAU, zoom: 0.95 + r() * 0.15, gain: 1.3 });
      done = false; $('#clsOut').textContent = '';
      $$('#clsChoices button').forEach((b) => { b.className = 'btn'; b.disabled = false; });
    }
    function answer(c, btn) {
      if (done) return; done = true; n++;
      const ok = c === cur.cls; if (ok) right++;
      $$('#clsChoices button').forEach((b) => { b.disabled = true; if (b.dataset.c === cur.cls) b.className = 'btn cls-right'; });
      if (!ok) btn.className = 'btn cls-wrong';
      const PLAIN = { E: 'an elliptical', S0: 'a lenticular', S: 'a spiral', SB: 'a barred spiral', Irr: 'an irregular' };
      $('#clsOut').innerHTML = `<b>${ok ? 'Yes.' : 'No, it’s ' + PLAIN[cur.cls] + ' (' + cur.k + ').'}</b> ${WHY[cur.cls]}`;
      $('#clsScore').textContent = `${right} of ${n} right`;
    }
    CH.forEach(([c, label]) => { const b = document.createElement('button'); b.type = 'button'; b.className = 'btn'; b.dataset.c = c; b.textContent = label; b.addEventListener('click', () => answer(c, b)); $('#clsChoices').appendChild(b); });
    $('#clsNext').addEventListener('click', next);
    return { next };
  })();

  /* ---------- Mass-to-light ---------- */
  function ml() {
    const v = +$('#mlV').value, R = +$('#mlR').value, L = Math.pow(10, +$('#mlL').value);
    const M = v * v * R / G.G_KPC;
    $('#mlVOut').textContent = v + ' km/s'; $('#mlROut').textContent = R + ' kpc (' + sig(R * G.KPC_LY, 2) + ' ly)'; $('#mlLOut').innerHTML = sig(L, 2) + ' L☉';
    const r = M / L;
    facts($('#mlOut'), [['Mass inside R: M = v²R/G', sig(M, 3) + ' M☉'], ['Mass-to-light ratio', `<b>${sig(r, 2)}</b> M☉ / L☉`], ['Verdict', r > 15 ? 'Mostly dark matter' : r > 6 ? 'Some dark matter, or old faint stars' : 'Stars can explain it']]);
  }
  ['#mlV', '#mlR', '#mlL'].forEach((i) => $(i).addEventListener('input', ml));
  let typesInit = false;
  onTab.types = (on) => { if (on && !typesInit) { typesInit = true; renderFork(); CLS.next(); ml(); } };

  /* ---------- Distance ladder: standard candles ---------- */
  const DL = { method: 'ceph' };
  function dlad() {
    const m = +$('#dlM').value, P = +$('#dlP').value;
    let M, range, name;
    let plural, deep = 0;
    if (DL.method === 'ceph') { M = -2.43 * (Math.log10(P) - 1) - 4.05; range = deep = 40; name = 'Cepheid'; plural = 'Cepheids'; }
    // Type Ia: big surveys reach ~2,000 Mpc (z ≈ 0.4); HST/JWST find a few out to z ≈ 2 (luminosity distance ~15,000 Mpc)
    else { M = -19.3; range = 2000; deep = 15000; name = 'Type Ia supernova'; plural = 'Type Ia supernovae'; }
    const dpc = Math.pow(10, (m - M + 5) / 5), dMpc = dpc / 1e6;
    $('#dlPOut').textContent = P + ' days'; $('#dlMOut').textContent = m.toFixed(1);
    $('#dlCeph').hidden = DL.method !== 'ceph';
    facts($('#dlOut'), [
      ['True brightness M', M.toFixed(2) + (DL.method === 'ceph' ? ' (from the period)' : ' (all Type Ia peak about the same)')],
      ['Distance modulus m − M', (m - M).toFixed(2)],
      ['Distance', `<b>${sig(dMpc, 3)} Mpc</b> (${dpc * 3.26156 >= 1e9 ? sig(dpc * 3.26156 / 1e9, 3) + ' billion' : sig(dpc * 3.26156 / 1e6, 3) + ' million'} ly)${dMpc > 1000 ? '<br><span class="note">this far out, expansion matters: this is the "luminosity distance"</span>' : ''}`],
      ['Usable?', dMpc > deep ? `<b style="color:var(--bad)">Too far: a single ${name} can't be seen out there</b>` : dMpc > range ? `Yes, but beyond most surveys: only the deepest HST/JWST searches find ${plural} this far (out to z ≈ 2)` : `Yes: ${plural} work to ~${range >= 1000 ? sig(range * 3.26156 / 1000, 2) + ' billion' : sig(range * 3.26156, 2) + ' million'} ly`],
    ]);
  }
  [['ceph', 'Cepheid'], ['ia', 'Type Ia supernova']].forEach(([k, nm]) => {
    const b = document.createElement('button'); b.type = 'button'; b.textContent = nm; b.setAttribute('aria-pressed', String(k === 'ceph'));
    b.addEventListener('click', () => { DL.method = k; $$('#dlMethod button').forEach((x) => x.setAttribute('aria-pressed', String(x === b))); $('#dlM').value = k === 'ceph' ? 24.5 : 18; dlad(); });
    $('#dlMethod').appendChild(b);
  });
  ['#dlM', '#dlP'].forEach((i) => $(i).addEventListener('input', dlad));

  /* ================= Active galaxies ================= */
  const AGN = (() => {
    const S = { ang: 30, lum: 39.5, jet: false };
    function classify() {
      const L = S.lum, a = S.ang, bright = L >= 38.5;
      if (S.jet) {
        if (a <= 10) return { name: bright ? 'Blazar (flat-spectrum radio quasar)' : 'Blazar (BL Lac object)', type: 'blazar', why: 'You are looking straight down the jet. Its light is beamed toward you by relativistic motion, so it swamps everything else: a bright, rapidly flickering, almost featureless spectrum.' };
        if (a < 45) return { name: bright ? 'Radio-loud quasar' : 'Broad-line radio galaxy', type: 1, why: 'You see past the torus into the centre: fast-moving gas near the black hole gives broad emission lines. The jets light up radio lobes.' };
        return { name: 'Radio galaxy (narrow lines only)', type: 2, why: 'The dusty torus hides the centre. You see the giant radio jets and lobes, and only narrow lines from slow gas far from the black hole.' };
      }
      if (a < 45) return { name: bright ? 'Quasar (type 1)' : 'Seyfert 1 galaxy', type: 1, why: 'Clear view of the accretion disk and the broad-line region: a bright blue continuum plus broad lines (gas orbiting at thousands of km/s).' };
      return { name: bright ? 'Type 2 (obscured) quasar' : 'Seyfert 2 galaxy', type: 2, why: 'The dusty torus blocks the accretion disk and the fast gas. Only narrow lines from slower gas above the torus get out (plus infrared from the warm dust).' };
    }
    function draw() {
      const svg = $('#agnSvg'); svg.innerHTML = '';
      const W = 620, H = 460, cx = 300, cy = 235, k = css(), cl = classify();
      // on-screen font size after txt() enlarges small text on phones
      const fsz = (n) => Math.max(n, svg.clientWidth ? 9.5 * W / svg.clientWidth : 0);
      const labY = cy + 112, labHalf = fsz(12) * 0.3 * 27 + 8;   // "accretion disk + black hole": 27 chars
      // jets first and fainter, so the cones and labels sit on top
      if (S.jet) [-1, 1].forEach((s) => {
        el('path', { d: `M${cx - 4},${cy} L${cx - 13},${cy + s * 210} L${cx + 13},${cy + s * 210} L${cx + 4},${cy} Z`, fill: 'url(#jg)', opacity: 0.75 }, svg);
      });
      // narrow-line region cones
      [-1, 1].forEach((s) => {
        // ionization cones: half-angle 45°, the same opening the torus leaves
        el('path', { d: `M${cx},${cy} L${cx - 165},${cy + s * 165} L${cx + 165},${cy + s * 165} Z`, fill: 'rgba(120,200,160,0.10)', stroke: 'rgba(120,200,160,0.3)' }, svg);
        for (let i = 0; i < 14; i++) {
          const t = 0.45 + (i * 0.37) % 0.55, u = ((i * 0.61) % 1) * 2 - 1, x = cx + u * 165 * t * 0.8, y = cy + s * 165 * t;
          // keep the label row under the disk clear of dots
          if (s > 0 && Math.abs(x - cx) < labHalf && y > labY - fsz(12) - 5 && y < labY + 7) continue;
          el('circle', { cx: x, cy: y, r: 4, fill: '#7fd6a8', opacity: 0.8 }, svg);
        }
      });
      const defs = el('defs', {}, svg);
      const lg = el('linearGradient', { id: 'jg', x1: 0, y1: 0, x2: 0, y2: 1 }, defs);
      el('stop', { offset: '0', 'stop-color': '#9fb8ff', 'stop-opacity': 0.25 }, lg); el('stop', { offset: '0.5', 'stop-color': '#cfd9ff', 'stop-opacity': 0.95 }, lg); el('stop', { offset: '1', 'stop-color': '#9fb8ff', 'stop-opacity': 0.25 }, lg);
      // torus (cross-section), sized so a sightline from the centre just grazes it at 45° from the axis
      [-1, 1].forEach((s) => el('ellipse', { cx: cx + s * 85, cy, rx: 55, ry: 65, fill: '#6b3a22', stroke: '#a8643c', 'stroke-width': 2 }, svg));
      // broad-line region
      for (let i = 0; i < 18; i++) { const a = i / 18 * TAU, rr = 14 + (i % 3) * 5; el('circle', { cx: cx + rr * Math.cos(a), cy: cy + rr * Math.sin(a) * 0.8, r: 3.2, fill: '#ff9ac0' }, svg); }
      // accretion disk + black hole
      el('ellipse', { cx, cy, rx: 34, ry: 5, fill: '#fff1c9', stroke: '#ffc76b' }, svg);
      el('circle', { cx, cy, r: 5.5, fill: '#000', stroke: '#fff', 'stroke-width': 1 }, svg);
      // labels
      const lab = (x, y, s, anchor) => txt(svg, x, y, s, { fill: k.muted, 'font-size': 12, 'text-anchor': anchor || 'start' });
      lab(cx - 150, cy + 5, 'dusty torus', 'end'); lab(cx + 95, cy - 92, 'broad-line clouds');
      // narrow-line region: outside the cone, with a leader into it
      lab(cx - 176, cy - 150, 'narrow-line', 'end'); lab(cx - 176, cy - 134, 'region', 'end');
      el('line', { x1: cx - 172, y1: cy - 142, x2: cx - 95, y2: cy - 122, stroke: k.faint }, svg);
      // below the torus, leader up to the disk
      lab(cx, labY, 'accretion disk + black hole', 'middle'); el('line', { x1: cx, y1: cy + 98, x2: cx, y2: cy + 9, stroke: k.faint }, svg);
      if (S.jet) lab(cx - 20, 34, 'relativistic jet', 'end');
      el('line', { x1: cx + 92, y1: cy - 88, x2: cx + 20, y2: cy - 18, stroke: k.faint }, svg);
      // observer + sightline
      const th = S.ang * Math.PI / 180, R = 205, ox = cx + R * Math.sin(th), oy = cy - R * Math.cos(th);
      const blocked = cl.type === 2;
      el('line', { x1: ox, y1: oy, x2: cx, y2: cy, stroke: blocked ? '#ff6b5e' : '#ffd27a', 'stroke-width': 2.5, 'stroke-dasharray': '7 5' }, svg);
      const eye = el('g', { transform: `translate(${ox},${oy}) rotate(${S.ang - 90})` }, svg);
      el('path', { d: 'M-14,0 Q0,-11 14,0 Q0,11 -14,0 Z', fill: k.surface, stroke: k.fg, 'stroke-width': 1.5 }, eye);
      el('circle', { cx: 0, cy: 0, r: 4.5, fill: k.fg }, eye);
      if (S.ang > 60) {
        // near edge-on: "you" just above the eye, unless that lands on the "broad-line clouds" label (y ≈ cy − 108 … cy − 88): then right of the eye
        const up = oy - 16 > cy - 80;
        txt(svg, up ? ox : ox + 18, up ? oy - 16 : oy + 5, 'you', { fill: k.fg, 'font-size': 12, 'font-weight': 600, 'text-anchor': up ? 'middle' : 'start' });
        // warning in the clear top-right corner, away from the torus
        if (blocked) txt(svg, W - 10, 40, 'view blocked by dust', { fill: '#ff6b5e', 'font-size': 12, 'font-weight': 600, 'text-anchor': 'end' });
      } else {
        // keep "you" clear of the "broad-line clouds" label (y ≈ cy − 108 … cy − 88) on the right side
        const youY = ox > cx + 60 && oy - 12 > cy - 112 ? Math.max(oy + 26, cy - 64) : oy - 12;
        txt(svg, Math.min(W - 10, ox + 14), youY, 'you', { fill: k.fg, 'font-size': 12, 'font-weight': 600, 'text-anchor': ox > W - 60 ? 'end' : 'start' });
        if (blocked) txt(svg, (ox + cx) / 2 + 10, (oy + cy) / 2 + 22, 'view blocked by dust', { fill: '#ff6b5e', 'font-size': 12, 'font-weight': 600 });
      }
      // footnote kept left of the jet (x < cx − 20); line step from the real font size (txt() enlarges it on phones)
      const fn = ['Not to scale: torus ~1–10 pc,', 'narrow-line region ~1 kpc,', 'jets up to ~1 Mpc.'], step = fsz(11) * 1.25;
      fn.forEach((s, i) => txt(svg, 10, H - 8 - (fn.length - 1 - i) * step, s, { fill: k.faint, 'font-size': 11 }));
      $('#agnClass').innerHTML = `<p class="h">You'd call it</p><p class="nm">${cl.name}</p><p>${cl.why}</p>`;
      $('#agnAngOut').textContent = S.ang + '°';
      $('#agnLumOut').innerHTML = sig(Math.pow(10, S.lum), 2) + ' W (' + sig(Math.pow(10, S.lum) / 9.6e36, 2) + '× the Milky Way)';
      spectrum(cl);
    }
    function spectrum(cl) {
      const svg = $('#specSvg'); svg.innerHTML = '';
      const W = 420, H = 180, ml = 30, mr = 10, mt = 14, mb = 30, k = css();
      const X = (l) => ml + (l - 420) / (700 - 420) * (W - ml - mr);
      const gauss = (l, c, s) => Math.exp(-0.5 * Math.pow((l - c) / s, 2));
      const lines = [[486.1, 0.6, 'Hβ'], [500.7, 1.0, '[O III]'], [495.9, 0.35, ''], [656.3, 1.3, 'Hα']];
      const f = (l) => {
        let cont = cl.type === 'blazar' ? 1.4 * Math.pow(l / 550, 0.6) : cl.type === 1 ? 0.55 * Math.pow(l / 550, -1.2) : 0.18 * Math.pow(l / 550, 0.4);
        let y = cont;
        lines.forEach(([c, a, nm]) => {
          const narrow = (nm === '[O III]' || nm === '' ? a : a * 0.35) * gauss(l, c, 0.7);
          const broad = (nm === 'Hβ' || nm === 'Hα') ? a * gauss(l, c, c * 0.0085) : 0;     // FWHM ~ 5000 km/s
          y += cl.type === 'blazar' ? narrow * 0.08 : cl.type === 1 ? narrow * 0.6 + broad : narrow * 0.9;
        });
        return y;
      };
      let d = '', max = 0; for (let l = 420; l <= 700; l += 0.5) max = Math.max(max, f(l));
      for (let l = 420; l <= 700; l += 0.5) d += (l === 420 ? 'M' : 'L') + X(l).toFixed(1) + ',' + (mt + (1 - f(l) / (max * 1.08)) * (H - mt - mb)).toFixed(1);
      el('line', { x1: ml, x2: W - mr, y1: H - mb, y2: H - mb, stroke: k.line }, svg);
      el('path', { d, fill: 'none', stroke: k.accent, 'stroke-width': 2 }, svg);
      [450, 500, 550, 600, 650, 700].forEach((l) => txt(svg, X(l), H - mb + 14, l, { 'text-anchor': 'middle', fill: k.muted, 'font-size': 10 }));
      txt(svg, W / 2, H - 2, 'wavelength (nm, rest frame) — schematic', { 'text-anchor': 'middle', fill: k.muted, 'font-size': 10 });
      if (cl.type !== 'blazar') [[486.1, 'Hβ', 'end'], [500.7, '[O III]', 'start'], [656.3, 'Hα', 'middle']].forEach(([c, s, an]) => txt(svg, X(c) + (an === 'end' ? -2 : an === 'start' ? 2 : 0), mt + 2, s, { 'text-anchor': an, fill: k.muted, 'font-size': 10 }));
    }
    $('#agnAng').addEventListener('input', (e) => { S.ang = +e.target.value; draw(); });
    $('#agnLum').addEventListener('input', (e) => { S.lum = +e.target.value; draw(); });
    $('#agnJet').addEventListener('change', (e) => { S.jet = e.target.checked; draw(); });
    return { draw };
  })();
  function quasar() {
    const L = Math.pow(10, +$('#qL').value), eff = +$('#qEff').value, M = Math.pow(10, +$('#qM').value);
    const mdot = L / (eff * Math.pow(G.C_KMS * 1e3, 2));            // kg/s
    const msunYr = mdot * G.YR_S / G.MSUN_KG, Ledd = 1.26e31 * M;
    $('#qLOut').innerHTML = sig(L, 2) + ' W'; $('#qEffOut').textContent = (eff * 100).toFixed(1) + '%'; $('#qMOut').innerHTML = sig(M, 2) + ' M☉';
    facts($('#qOut'), [
      ['Compared with the Milky Way', sig(L / 9.6e36, 2) + '× brighter'],
      ['Mass swallowed', `<b>${sig(msunYr, 2)} M☉ per year</b>`],
      ['…in Earths per day', sig(msunYr * 332946 / 365.25, 2)],
      ['Eddington limit for this mass', sig(Ledd, 2) + ' W'],
      ['L / L<sub>Edd</sub>', sig(L / Ledd, 2) + (L > Ledd ? ' · <b style="color:var(--bad)">over the limit: needs a bigger hole</b>' : '')],
    ]);
  }
  ['#qL', '#qEff', '#qM'].forEach((i) => $(i).addEventListener('input', quasar));
  function variability() {
    const v = +$('#vT').value, lo = Math.log10(3600), hi = Math.log10(10 * G.YR_S);
    const dt = Math.pow(10, lo + v / 1000 * (hi - lo));
    const km = G.C_KMS * dt, au = km / 1.495978707e8;
    const tt = dt < 2 * 86400 ? sig(dt / 3600, 2) + ' hours' : dt < 2 * G.YR_S ? sig(dt / 86400, 2) + ' days' : sig(dt / G.YR_S, 2) + ' years';
    $('#vTOut').textContent = tt;
    const cmp = au < 1 ? 'smaller than Earth’s orbit' : au < 30 ? `inside Neptune’s orbit (${sig(au / 30 * 100, 2)}% of its 30 AU)` : `${sig(au / 30, 2)}× Neptune’s distance from the Sun`;
    facts($('#vOut'), [['Maximum size ≈ c × Δt', sig(au, 2) + ' AU (' + sig(km, 2) + ' km)'], ['For comparison', cmp], ['r<sub>s</sub> of a 10<sup>9</sup> M☉ black hole', '20 AU']]);
  }
  $('#vT').addEventListener('input', variability);
  let agnInit = false;
  onTab.agn = (on) => { if (on) { AGN.draw(); if (!agnInit) { agnInit = true; quasar(); variability(); } } };

  /* ================= Evolution ================= */
  const HUB = (() => {
    // Approximate distances (Mpc) and redshift velocities (km/s)
    const DATA = [['Andromeda', 0.78, -301], ['M81', 3.6, -34], ['Centaurus A', 3.8, 547], ['NGC 4258', 7.6, 448], ['M87 / Virgo', 16.8, 1284], ['Fornax cluster', 19, 1379], ['Hydra cluster', 50, 3777], ['Perseus cluster', 75, 5366], ['Coma cluster', 99, 6925]];
    function bestH() { let n = 0, d = 0; DATA.forEach(([, D, v]) => { if (D > 10) { n += D * v; d += D * D; } }); return n / d; }
    function draw() {
      const H0 = +$('#h0').value, svg = $('#hubSvg'); svg.innerHTML = '';
      const narrow = svg.clientWidth > 0 && svg.clientWidth < 520;
      const W = 620, H = 400, ml = 66, mr = 16, mt = narrow ? 34 : 16, mb = 44, k = css();
      const X = (d) => ml + d / 110 * (W - ml - mr), Y = (v) => mt + (1 - (v + 500) / 8500) * (H - mt - mb);
      for (let v = 0; v <= 8000; v += 2000) { el('line', { x1: ml, x2: W - mr, y1: Y(v), y2: Y(v), stroke: k.soft }, svg); txt(svg, ml - 8, Y(v) + 4, v.toLocaleString('en-US'), { 'text-anchor': 'end', fill: k.muted, 'font-size': 11 }); }
      for (let d = 0; d <= 100; d += 20) txt(svg, X(d), H - mb + 18, d, { 'text-anchor': 'middle', fill: k.muted, 'font-size': 11 });
      txt(svg, (ml + W) / 2, H - 6, 'distance (Mpc; 1 Mpc = 3.26 million ly)', { 'text-anchor': 'middle', fill: k.muted, 'font-size': 12 });
      if (narrow) txt(svg, 4, 18, 'velocity, km/s', { fill: k.muted, 'font-size': 12 });
      else { const yl = txt(svg, 14, (mt + H - mb) / 2, 'recession velocity (km/s)', { 'text-anchor': 'middle', fill: k.muted, 'font-size': 12 }); yl.setAttribute('transform', `rotate(-90 14 ${(mt + H - mb) / 2})`); }
      el('line', { x1: X(0), y1: Y(0), x2: X(110), y2: Y(H0 * 110), stroke: k.accent, 'stroke-width': 2.5 }, svg);
      DATA.forEach(([nm, d, v]) => el('circle', { cx: X(d), cy: Y(v), r: 5, fill: k.fg, stroke: k.surface, 'stroke-width': 1.5 }, svg));
      // labels: on the side of the dot away from the fit line (above-left if the dot is above it, else below-right),
      // scoring each spot: leaving the plot is worst, then covering another label or dot, then crossing the line
      // labels may run into the left margin, but not over the y tick labels
      const tfs = Math.max(11, svg.clientWidth ? 9.5 * W / svg.clientWidth : 0);
      const boxes = DATA.map(([, d, v]) => ({ x0: X(d) - 6, x1: X(d) + 6, y0: Y(v) - 6, y1: Y(v) + 6 }));
      for (let v = 0; v <= 8000; v += 2000) boxes.push({ x0: 0, x1: ml - 4, y0: Y(v) + 4 - tfs, y1: Y(v) + 4 + tfs * 0.25 });
      const lineY = (x) => Y(H0 * (x - ml) / (W - ml - mr) * 110);
      const hits = (a, b) => a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;
      // (own dot left out: every spot is offset to clear it; the line only exists right of the y axis)
      const cost = (r, own) => { const lx0 = Math.max(r.x0, ml), lx1 = Math.max(r.x1, ml), l0 = lineY(lx0), l1 = lineY(lx1);
        return (r.x0 >= 2 && r.x1 <= W - mr && r.y0 >= mt && r.y1 <= H - mb ? 0 : 1000)
          + (boxes.some((b, j) => j !== own && hits(r, b)) ? 100 : 0)
          + (r.x1 > ml && Math.min(l0, l1) - 1 < r.y1 && Math.max(l0, l1) + 1 > r.y0 ? 10 : 0); };
      // top-down, so of a close pair the upper dot's label takes the spot above and the lower one goes beside its dot
      DATA.map((r, i) => [r, i]).sort((a, b) => b[0][2] - a[0][2]).forEach(([[nm, d, v], i]) => {
        if (!(d > 10 || i === 0)) return;
        // Andromeda (blueshifted, at the origin): phones level with its dot to the right, clear of the x ticks; desktop just below
        if (i === 0) { txt(svg, X(d) + (narrow ? 10 : 8), Y(v) + (narrow ? 5 : 16), nm, { fill: k.muted, 'font-size': 11 }); return; }
        const t = txt(svg, 0, 0, nm, { fill: k.muted, 'font-size': 11 });
        const fs = +t.getAttribute('font-size'), w = t.getComputedTextLength ? t.getComputedTextLength() : 0, tw = w || nm.length * fs * 0.56;
        const above = v > H0 * d, px = X(d), py = Y(v);
        // [dx, baseline dy, anchor]: A on the upper-left side of the dot, B its mirror on the lower-right
        const A = [[-8, -8, 'end'], [-9, fs * 0.35, 'end'], [0, -10, 'middle'], [6, -10, 'end'], [-6, -10, 'start'], [-8, -8 - fs, 'end'], [6, -10 - fs, 'end'], [-6, -10 - fs, 'start']];
        const B = [[8, fs + 6, 'start'], [9, fs * 0.35, 'start'], [0, fs + 9, 'middle'], [-6, fs + 9, 'start'], [6, fs + 9, 'end'], [8, 2 * fs + 6, 'start'], [-6, 2 * fs + 9, 'start'], [6, 2 * fs + 9, 'end']];
        const order = (above ? A.concat(B) : B.concat(A)).concat([[8, -8, 'start'], [-8, fs + 6, 'end']]);
        // box of the label at a spot: measured when the chart is on screen, else estimated; 2 px side padding
        const rect = ([dx, dy, an]) => {
          t.setAttribute('x', px + dx); t.setAttribute('y', py + dy); t.setAttribute('text-anchor', an);
          const bb = w ? t.getBBox() : null;
          if (bb && bb.width) return { x0: bb.x - 2, x1: bb.x + bb.width + 2, y0: bb.y + bb.height * 0.12, y1: bb.y + bb.height * 0.92 };   // line box → glyphs
          const x0 = an === 'end' ? px + dx - tw : an === 'middle' ? px + dx - tw / 2 : px + dx; return { x0: x0 - 2, x1: x0 + tw + 2, y0: py + dy - fs, y1: py + dy + fs * 0.3 };
        };
        let pick = order[0], best = Infinity;
        // a second-row spot (|dy| > 1.5 fs) reads as belonging to another dot: dearer than grazing the line under its halo
        order.forEach((c, j) => { const sc = cost(rect(c), i) + (Math.abs(c[1]) > 1.5 * fs ? 15 : 0) + j * 0.1; if (sc < best) { best = sc; pick = c; } });
        t.setAttribute('x', px + pick[0]); t.setAttribute('y', py + pick[1]); t.setAttribute('text-anchor', pick[2]);
        boxes.push(rect(pick));
      });
      const b = bestH();
      const rms = Math.sqrt(DATA.filter((x) => x[1] > 10).reduce((s, [, d, v]) => s + Math.pow(v - H0 * d, 2), 0) / DATA.filter((x) => x[1] > 10).length);
      $('#h0Out').textContent = H0 + ' km/s/Mpc';
      facts($('#hubOut'), [['Line misses the clusters by (rms)', Math.round(rms) + ' km/s' + (rms < 300 ? ' · <b style="color:var(--good)">good fit</b>' : '')], ['Best fit through the clusters', b.toFixed(1) + ' km/s/Mpc'], ['Hubble time 1/H<sub>0</sub>', (G.MYR_PER_KPC_KMS / H0).toFixed(1) + ' billion years']]);
    }
    $('#h0').addEventListener('input', draw);
    return { draw, bestH };
  })();

  // Flat ΛCDM with radiation (Planck 2018-like): age and lookback by integrating da / (a H(a))
  const COS = { H0: 67.7, Om: 0.31, Or: 9.1e-5 };
  const E = (a) => Math.sqrt(COS.Or / (a * a * a * a) + COS.Om / (a * a * a) + (1 - COS.Om - COS.Or));
  const tH = G.MYR_PER_KPC_KMS / COS.H0;                       // Hubble time in Gyr (977.8/H0)
  function ageAt(a) { const n = 2000; let s = 0; for (let i = 0; i < n; i++) { const x = (i + 0.5) / n, aa = a * x * x; s += 2 * x * a / n / (aa * E(aa)); } return s * tH; }
  function comoving(z) { const n = 2000; let s = 0; for (let i = 0; i < n; i++) { const zz = (i + 0.5) / n * z; s += 1 / E(1 / (1 + zz)) * z / n; } return s * tH; } // Gly (c/H0 = tH in Gly)
  const AGE0 = ageAt(1);
  // slider 0–3000 on log(1 + z), z = 0 … 1100 (the cosmic background), fine enough steps at low z
  const Z_MAX = 1100, V_MAX = 3000;
  const zFrom = (v) => Math.pow(10, v / V_MAX * Math.log10(Z_MAX + 1)) - 1;
  const vFrom = (z) => Math.round(Math.log10(z + 1) / Math.log10(Z_MAX + 1) * V_MAX);
  const ZEX = [['Virgo cluster', 0.0043], ['3C 273 (first quasar)', 0.158], ['Cosmic noon', 2], ['Most distant luminous quasar (2021)', 7.64], ['JADES-GS-z14-0 (JWST)', 14.32], ['Cosmic background', 1100]];
  function lookback(zOverride) {
    const z = zOverride != null ? zOverride : zFrom(+$('#zS').value);
    const a = 1 / (1 + z), age = ageAt(a), lb = AGE0 - age, dc = comoving(Math.min(z, 1100));
    $('#zOut').textContent = z < 0.1 ? z.toFixed(4) : z < 10 ? z.toFixed(2) : z.toFixed(1);
    facts($('#zFacts'), [
      ['Light left', `<b>${lb < 1 ? Math.round(lb * 1000) + ' million' : lb.toFixed(2) + ' billion'} years ago</b>`],
      ['Universe’s age then', age < 0.001 ? '~' + sig(age * 1e9, 2) + ' years' : age < 1 ? Math.round(age * 1000) + ' million years' : age.toFixed(2) + ' billion years'],
      ['Universe’s size then', (a * 100 < 1 ? (a * 100).toFixed(2) : (a * 100).toPrecision(3)) + '% of today'],
      ['Distance to it now (comoving)', dc.toFixed(dc < 1 ? 3 : 1) + ' billion ly'],
      ['Wavelengths stretched by', (1 + z).toPrecision(4).replace(/\.?0+$/, '') + '×'],
    ]);
    const bar = $('#zBar'), f = age / AGE0;
    bar.innerHTML = `<div class="zb-track"><span class="zb-fill" style="width:${(f * 100).toFixed(2)}%"></span><span class="zb-mark" style="left:${(f * 100).toFixed(2)}%"></span></div>
      <div class="zb-labels"><span>Big Bang</span><span>now (${AGE0.toFixed(1)} billion years)</span></div>`;
  }
  $('#zS').addEventListener('input', () => { $$('#zEx button').forEach((b) => b.setAttribute('aria-pressed', 'false')); lookback(); });
  ZEX.forEach(([nm, z]) => {
    const b = document.createElement('button'); b.type = 'button'; b.textContent = nm; b.setAttribute('aria-pressed', 'false');
    b.addEventListener('click', () => { $$('#zEx button').forEach((x) => x.setAttribute('aria-pressed', String(x === b))); $('#zS').value = vFrom(Math.min(z, Z_MAX)); lookback(z); });
    $('#zEx').appendChild(b);
  });

  // Merger
  const MG = (() => {
    const m = new window.Merger($('#mgCanvas'));
    const PRE = {
      pro: { label: 'Both prograde: long tails', o: { peri: 1.0, tiltA: 15, tiltB: 30, q: 1 } },
      mix: { label: 'Prograde + retrograde', o: { peri: 1.0, tiltA: 10, tiltB: 170, q: 1 } },
      minor: { label: 'Minor merger', o: { peri: 0.9, tiltA: 20, tiltB: 40, q: 0.3 } },
      wide: { label: 'Wide fly-by', o: { peri: 2.6, tiltA: 10, tiltB: 50, q: 1 } },
    };
    const sync = () => {
      const o = m.opts;
      $('#mgPeri').value = o.peri; $('#mgPeriOut').textContent = Math.round(o.peri * 10) + ' kpc';
      $('#mgTA').value = o.tiltA; $('#mgTAOut').textContent = o.tiltA + '°' + (o.tiltA < 45 ? ' (prograde)' : o.tiltA > 135 ? ' (retrograde)' : '');
      $('#mgTB').value = o.tiltB; $('#mgTBOut').textContent = o.tiltB + '°' + (o.tiltB < 45 ? ' (prograde)' : o.tiltB > 135 ? ' (retrograde)' : '');
      $('#mgQ').value = o.q; $('#mgQOut').textContent = o.q.toFixed(2);
      $('#mgDF').checked = o.friction;
    };
    const play = (on) => { m.play(on); $('#mgPlay').textContent = on ? 'Pause' : 'Play'; $('#mgPlay').setAttribute('aria-pressed', String(on)); };
    m.onEnd = () => play(false);
    m.speed = 2;
    [1, 2, 4].forEach((v) => {
      const b = document.createElement('button'); b.type = 'button'; b.textContent = v + '×'; b.setAttribute('aria-pressed', String(v === m.speed));
      b.addEventListener('click', () => { m.speed = v; $$('#mgSpeed button').forEach((x) => x.setAttribute('aria-pressed', String(x === b))); });
      $('#mgSpeed').appendChild(b);
    });
    Object.entries(PRE).forEach(([k, p]) => {
      const b = document.createElement('button'); b.type = 'button'; b.textContent = p.label; b.setAttribute('aria-pressed', String(k === 'pro'));
      b.addEventListener('click', () => { $$('#mgPresets button').forEach((x) => x.setAttribute('aria-pressed', String(x === b))); play(false); m.set(p.o); sync(); play(true); });
      $('#mgPresets').appendChild(b);
    });
    m.set(PRE.pro.o);
    const inp = (id, key, f) => $(id).addEventListener('input', (e) => { $$('#mgPresets button').forEach((x) => x.setAttribute('aria-pressed', 'false')); play(false); m.set({ [key]: f(+e.target.value) }); sync(); });
    inp('#mgPeri', 'peri', (v) => v); inp('#mgTA', 'tiltA', (v) => v); inp('#mgTB', 'tiltB', (v) => v); inp('#mgQ', 'q', (v) => v);
    $('#mgDF').addEventListener('change', (e) => { play(false); m.set({ friction: e.target.checked }); sync(); });
    $('#mgPlay').addEventListener('click', () => play(!m.running));
    $('#mgReset').addEventListener('click', () => { play(false); m.reset(); });
    sync();
    new ResizeObserver(() => { if (!m.running) m.draw(); }).observe($('#mgCanvas'));
    // pause when scrolled away, resume when back
    let resume = false;
    new IntersectionObserver((e) => {
      if (!e[0].isIntersecting && m.running) { resume = true; play(false); }
      else if (e[0].isIntersecting && resume && !$('#evo').hidden) { resume = false; play(true); }
    }).observe($('#mgCanvas'));
    return { stop() { play(false); }, draw() { m.draw(); }, m };
  })();
  onTab.evo = (on) => { if (on) { lookback(); MG.draw(); } else MG.stop(); };
  const prevTypes = onTab.types; onTab.types = (on) => { prevTypes(on); if (on) { HUB.draw(); dlad(); } };
  onTab.bang = (on) => { if (window.GXCosmo) window.GXCosmo.setOpen(on); };
  onTab.life = (on) => { if (window.GXLife) window.GXLife.setOpen(on); };

  /* ================= Quiz ================= */
  const QUIZ = [
    { q: 'Why does the Milky Way look like a band of light across our sky?', a: ['It is a cloud in the Solar System', 'We are inside a flat disk and see it edge-on', 'It is the halo of old stars', 'It is light from Andromeda'], c: 1, e: 'Looking along the plane of the disk we see many stars; looking out of the plane, few.' },
    { q: 'Where is the Sun in the Milky Way?', a: ['At the centre', 'In the halo', 'In the disk, about 26,000 ly from the centre', 'At the outer edge of the disk'], c: 2, e: 'About 8 kpc out, in a minor arm (the Orion Spur) between the Sagittarius and Perseus arms.' },
    { q: 'Stars far out in the Milky Way orbit just as fast as stars near the Sun. This tells us…', a: ['The outer disk is hotter', 'There is a lot of unseen mass (dark matter) at large radii', 'Gravity is weaker there', 'The galaxy is shrinking'], c: 1, e: 'v² = GM(<r)/r. A flat curve means M(<r) keeps growing with r, far beyond the visible stars.' },
    { q: 'Which stars belong to Population II?', a: ['Young, metal-rich disk stars', 'Old, metal-poor halo and globular-cluster stars', 'Stars in spiral arms', 'O and B stars'], c: 1, e: 'Population II formed early, before many supernovae had enriched the gas with heavy elements.' },
    { q: 'Spiral arms do not wind up because…', a: ['Stars in the arms orbit faster', 'They are density waves that stars move through', 'Dark matter holds them in place', 'They are only 1 million years old'], c: 1, e: 'The pattern is a slow-moving compression wave. Gas piles up in it and forms bright young stars.' },
    { q: 'S2 orbits Sgr A* with a = 1,000 AU and P = 16 years. Roughly what mass does Kepler’s third law give?', a: ['4,000 M☉', '400,000 M☉', '4 million M☉', '4 billion M☉'], c: 2, e: 'M = a³/P² = 10⁹ / 256 ≈ 4 × 10⁶ M☉ (AU, years, solar masses).' },
    { q: 'An E0 galaxy and an E7 galaxy differ in…', a: ['Age', 'How flattened they look from Earth', 'Number of spiral arms', 'Amount of dark matter'], c: 1, e: 'E number = 10(1 − b/a), the apparent flattening. It depends partly on our viewing angle.' },
    { q: 'Which type of galaxy is most likely to be forming lots of new stars?', a: ['Giant elliptical', 'S0', 'Sc spiral or irregular', 'E5 elliptical'], c: 2, e: 'Star formation needs cold gas. Late-type spirals and irregulars have plenty; ellipticals and S0s have little.' },
    { q: 'Is the Hubble tuning fork an evolutionary sequence?', a: ['Yes, ellipticals become spirals', 'Yes, spirals become ellipticals by flattening', 'No, it is a classification by shape', 'Only for barred spirals'], c: 2, e: 'Galaxies change mainly by mergers and gas loss, not by moving along the fork.' },
    { q: 'A quasar varies in brightness over a few days. Its energy source must be…', a: ['About a few light-days across or smaller', 'Bigger than the whole galaxy', 'Exactly one light-year across', 'Impossible to estimate'], c: 0, e: 'A source can’t vary coherently faster than light can cross it.' },
    { q: 'What powers a quasar?', a: ['Nuclear fusion in a giant star', 'Gas falling onto a supermassive black hole', 'Dark matter annihilation', 'Many supernovae at once'], c: 1, e: 'Accretion releases ~10% of mc², about 15× more efficient than hydrogen fusion (0.7%).' },
    { q: 'In the unified model, a Seyfert 2 differs from a Seyfert 1 mainly because…', a: ['It has no black hole', 'Its black hole is smaller', 'We see it through the dusty torus', 'It is much farther away'], c: 2, e: 'Same engine; the torus hides the broad-line region from our angle, so only narrow lines show.' },
    { q: 'A blazar is an active galaxy seen…', a: ['Edge-on through the torus', 'Looking almost straight down its jet', 'From inside the galaxy', 'With no accretion disk'], c: 1, e: 'Relativistic beaming makes the jet’s light dominate and flicker rapidly.' },
    { q: 'With H₀ = 70 km/s/Mpc, a galaxy 100 Mpc away recedes at about…', a: ['70 km/s', '700 km/s', '7,000 km/s', '70,000 km/s'], c: 2, e: 'v = H₀d = 70 × 100 = 7,000 km/s (like the Coma cluster).' },
    { q: 'Why do we see more quasars at large distances than nearby?', a: ['Nearby ones are hidden by dust', 'Looking far away is looking back to when quasars were common', 'Quasars move away from us', 'Our telescopes can’t see nearby objects'], c: 1, e: 'Quasar activity peaked ~10 billion years ago (z ≈ 2), when galaxies had lots of gas to feed their black holes.' },
    { q: 'The habitable zone is the range of distances where…', a: ['Life definitely exists', 'Liquid water could exist on a planet\'s surface', 'A planet has an atmosphere', 'Stars can form'], c: 1, e: 'It\'s about temperature: not so hot that water boils away, not so cold it freezes. Venus, well inside the inner edge, is not habitable.' },
    { q: 'Around a red dwarf, the habitable zone is…', a: ['Farther out than around the Sun', 'Much closer in, because the star is dim', 'The same as around the Sun', 'Nonexistent'], c: 1, e: 'Its edges scale as √L. A star 1/400 as bright has its zone 1/20 as far away, close enough that planets usually become tidally locked.' },
    { q: 'Why are A-type stars poor places to look for complex life?', a: ['Their planets are too cold', 'They live only ~1 billion years, less than life on Earth took to get complex', 'They have no planets', 'They are too far away'], c: 1, e: 'Earth needed ~4 billion years to produce animals. A 2 M☉ star leaves the main sequence after ~1 billion.' },
    { q: 'Which Drake-equation terms have we actually measured?', a: ['All of them', 'Star formation rate, fraction of stars with planets, and habitable planets per system', 'Only L', 'None of them'], c: 1, e: 'Kepler and other surveys pinned down planets. How often life, intelligence and technology arise is still unknown.' },
    { q: 'Why is Enceladus a target in the search for life?', a: ['It has a thick oxygen atmosphere', 'It sprays a salty, organic-rich subsurface ocean into space', 'It is in the Sun\'s habitable zone', 'Fossils were found there'], c: 1, e: 'Cassini sampled the plumes: water, salts, organics and molecular hydrogen, a possible energy source for microbes.' },
    { q: 'Where did the Big Bang happen?', a: ['At the centre of the universe', 'Near the Milky Way', 'Everywhere: all of space was in it', 'At the edge of the universe'], c: 2, e: 'Space itself expanded from a hot, dense state everywhere at once. Every galaxy sees the others receding, so there is no centre.' },
    { q: 'The cosmic microwave background was emitted at ~3000 K but is 2.7 K today because…', a: ['It lost energy hitting dust', 'Expansion stretched its wavelengths ~1100×', 'It was always 2.7 K', 'Stars absorbed it'], c: 1, e: 'T falls as 1/a: the universe has grown ~1100× since recombination, so 3000 K → 2.7 K.' },
    { q: 'Why is about 25% of ordinary matter helium?', a: ['Stars made it all', 'In the first minutes, almost every neutron (about 1 per 7 protons) ended up in helium-4', 'Helium is the most stable element', 'It came from the Sun'], c: 1, e: 'Y = 2(n/p)/(1 + n/p) = 2(1/7)/(8/7) = 0.25.' },
    { q: 'What does dark energy do?', a: ['Holds galaxies together', 'Makes the expansion speed up', 'Slows the expansion', 'Makes up the CMB'], c: 1, e: 'Its density stays constant as space grows while matter thins out, so about 6 billion years ago it began to speed up the expansion.' },
    { q: 'Roughly what is our universe made of?', a: ['90% stars, 10% gas', '5% ordinary matter, 27% dark matter, 68% dark energy', '50% dark matter, 50% ordinary matter', '68% ordinary matter, 32% dark energy'], c: 1, e: 'Planck 2018: 4.9% ordinary, 26.8% dark matter, 68.3% dark energy.' },
    { q: 'If the universe had lots of matter and no dark energy (Ω_m = 3), it would…', a: ['Expand faster forever', 'Expand forever, slowing', 'Stop expanding and collapse in a Big Crunch', 'Stay the same size'], c: 2, e: 'Enough gravity halts the expansion and pulls everything back together.' },
    { q: 'When two spiral galaxies merge, the result is usually…', a: ['A bigger spiral', 'An elliptical galaxy', 'An irregular forever', 'Two separate galaxies'], c: 1, e: 'The orderly disk orbits get scrambled into random orbits; gas is used up in a starburst or blown out.' },
  ];
  let qi = 0, score = 0, answered = false, seed = 1;
  const order = (i, n) => { const r = G.rng(i * 31 + seed * 101), a = Array.from({ length: n }, (_, k) => k); for (let k = n - 1; k > 0; k--) { const j = (r() * (k + 1)) | 0; [a[k], a[j]] = [a[j], a[k]]; } return a; };
  function quiz() {
    const box = $('#gQuiz');
    if (qi >= QUIZ.length) {
      box.innerHTML = `<div class="card"><p class="progress">Done</p><h3>${score} / ${QUIZ.length}</h3><p class="muted">${score / QUIZ.length >= 0.85 ? 'Excellent.' : score / QUIZ.length >= 0.65 ? 'Solid. Review the ones you missed.' : 'Work back through the tabs, then try again.'}</p><div class="actions"><button class="btn btn-primary" type="button" id="gqR">Restart</button></div></div>`;
      $('#gqR').addEventListener('click', () => { qi = 0; score = 0; seed++; quiz(); }); return;
    }
    const q = QUIZ[qi]; answered = false;
    box.innerHTML = `<form class="card" id="gqF" novalidate><p class="progress">Question ${qi + 1} of ${QUIZ.length} · score ${score}</p>
      <fieldset><legend>${q.q}</legend>${order(qi, q.a.length).map((i) => `<label class="opt"><input type="radio" name="qa" value="${i}"> ${q.a[i]}</label>`).join('')}</fieldset>
      <p class="err" id="gqE" hidden>Pick an answer first.</p><p class="fb" id="gqFb" hidden></p>
      <div class="actions"><button class="btn btn-primary" type="submit" id="gqB">Check</button></div></form>`;
    const f = $('#gqF');
    f.addEventListener('change', () => { $('#gqE').hidden = true; });
    f.addEventListener('submit', (e) => {
      e.preventDefault();
      if (answered) { qi++; quiz(); return; }
      const sel = f.querySelector('input:checked'); if (!sel) { $('#gqE').hidden = false; return; }
      answered = true; const p = +sel.value, ok = p === q.c; if (ok) score++;
      $$('.opt', f).forEach((o) => { const i = +o.querySelector('input').value; if (i === q.c) o.classList.add('right'); else if (i === p) o.classList.add('wrong'); o.querySelector('input').disabled = true; });
      const fb = $('#gqFb'); fb.hidden = false; fb.className = 'fb ' + (ok ? 'ok' : 'no'); fb.innerHTML = `<b>${ok ? 'Correct.' : 'Not quite.'}</b> ${q.e}`;
      $('#gqB').textContent = qi === QUIZ.length - 1 ? 'See score' : 'Next question';
    });
  }
  quiz();

  /* ================= Theme + boot ================= */
  const redraw = () => { if (!$('#mw').hidden) { RC.draw(); MW.kick(); } if (!$('#agn').hidden) AGN.draw(); if (!$('#types').hidden) HUB.draw(); if (!$('#bang').hidden && window.GXCosmo) window.GXCosmo.redraw(); };
  matchMedia('(prefers-color-scheme: light)').addEventListener('change', redraw);
  new MutationObserver(redraw).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  const ids = tabs.map((t) => t.getAttribute('aria-controls'));
  const h = location.hash.slice(1);
  showTab(ids.includes(h) ? h : (ids.includes(store.get('tab')) ? store.get('tab') : 'mw'));
  window.__gx = { MW, RC, SGR, HUB, MG, ageAt, comoving, AGE0 };
})();
