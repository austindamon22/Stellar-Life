/* Stellar Life — render3d.js
 * Dependency-free 3D stage viewer.
 * - Cutaway stars are ray-traced per pixel: a sphere with one octant removed,
 *   so the two cut faces show the nested layers.
 * - Particle scenes (cloud, collapse, disk, nebula, supernova, binaries,
 *   mergers) are projected 3D points.
 * - The black hole view lenses a background star field with the point-mass
 *   lens equation.
 */
(function (global) {
  'use strict';
  const P = global.Phys, D = global.Data;
  const TAU = Math.PI * 2;
  const reduceMotion = global.matchMedia && global.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const hexRGB = (h) => { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
  const rgba = (h, a) => { const [r, g, b] = hexRGB(h); return `rgba(${r},${g},${b},${a})`; };
  const lerp = (a, b, t) => a + (b - a) * t;
  const ease = (t) => t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
  const frac = (x) => x - Math.floor(x);

  // Deterministic pseudo-random generator so scenes look the same each load.
  function rng(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }
  function gauss(r) { const u = r() || 1e-9, v = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(TAU * v); }

  function rotMatrix(yaw, pitch) {
    const cy = Math.cos(yaw), sy = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch);
    // R = Rx(pitch) * Ry(yaw); rows are camera axes expressed in object space
    return [
      [cy, 0, sy],
      [sp * sy, cp, -sp * cy],
      [-cp * sy, sp, cp * cy],
    ];
  }

  class StageView {
    constructor(canvas, opts) {
      this.cv = canvas;
      this.ctx = canvas.getContext('2d');
      this.rt = document.createElement('canvas');
      this.RT = (opts && opts.res) || 360;
      this.rt.width = this.rt.height = this.RT;
      this.rctx = this.rt.getContext('2d');
      this.img = this.rctx.createImageData(this.RT, this.RT);
      this.buf = new Uint32Array(this.img.data.buffer);
      this.yaw = -0.785; this.pitch = 0.38; this.userRot = false;
      this.spec = { mode: 'cloud' };
      this.t = 0; this.last = 0; this.running = false; this.visible = true;
      this.labels = true;
      this.pts = [];
      this._initParticles(this.spec);
      this._bindDrag();
      this._resize();
      new ResizeObserver(() => this._resize()).observe(canvas);
      if ('IntersectionObserver' in global) {
        new IntersectionObserver((e) => { this.visible = e[0].isIntersecting; if (this.visible) this.start(); }).observe(canvas);
      }
      document.addEventListener('visibilitychange', () => { if (!document.hidden) this.start(); });
    }

    _resize() {
      const r = this.cv.getBoundingClientRect();
      const dpr = Math.min(global.devicePixelRatio || 1, 2);
      this.W = Math.max(200, Math.round(r.width * dpr));
      this.H = Math.max(200, Math.round(r.height * dpr));
      this.cv.width = this.W; this.cv.height = this.H;
      this.dpr = dpr;
      this.draw();
    }

    _bindDrag() {
      let down = false, x0 = 0, y0 = 0, yaw0 = 0, p0 = 0;
      const cv = this.cv;
      cv.addEventListener('pointerdown', (e) => { down = true; x0 = e.clientX; y0 = e.clientY; yaw0 = this.yaw; p0 = this.pitch; cv.setPointerCapture(e.pointerId); this.userRot = true; });
      cv.addEventListener('pointermove', (e) => {
        if (!down) return;
        this.yaw = yaw0 + (e.clientX - x0) * 0.01;
        this.pitch = Math.max(-1.3, Math.min(1.3, p0 + (e.clientY - y0) * 0.01));
        this.draw();
      });
      const up = () => { down = false; };
      cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
      cv.addEventListener('dblclick', () => { this.userRot = false; });
    }

    setStage(spec) {
      this.spec = spec;
      this.t = 0;
      this.userRot = false;
      this.yaw = -0.785; this.pitch = spec.mode === 'disk' || spec.mode === 'binary' || spec.mode === 'merger' ? 0.42 : 0.38;
      this.layers = spec.layers ? spec.layers.map((l) => Object.assign({}, l, { rgb: hexRGB(l.color) })) : null;
      this.surfRGB = P.blackbodyRGB(spec.surfaceT || 5772);
      this._initParticles(spec);
      this.start();
    }

    start() {
      if (this.running) return;
      this.running = true; this.last = performance.now();
      const loop = (now) => {
        if (!this.visible || document.hidden) { this.running = false; return; }
        const dt = Math.min(0.05, (now - this.last) / 1000); this.last = now;
        this.t += dt * (reduceMotion ? 0.3 : 1);
        if (!this.userRot && !reduceMotion) {
          if (this.spec.mode === 'cutaway') this.yaw = -0.785 + 0.45 * Math.sin(this.t * 0.25);
          else if (this.spec.mode !== 'bh') this.yaw += dt * 0.12;
        }
        this.draw();
        requestAnimationFrame(loop);
      };
      requestAnimationFrame(loop);
    }

    colors() {
      const cs = getComputedStyle(document.documentElement);
      return { fg: cs.getPropertyValue('--fg').trim() || '#e7e9f3', muted: cs.getPropertyValue('--muted').trim() || '#9aa1bd', bg: cs.getPropertyValue('--bg').trim() || '#0b0e1a', mono: cs.getPropertyValue('--font-mono').trim() || 'monospace' };
    }

    // Project an object-space point to canvas pixels (orthographic + mild perspective).
    proj(x, y, z, R, scale, cx, cy) {
      const X = R[0][0] * x + R[0][1] * y + R[0][2] * z;
      const Y = R[1][0] * x + R[1][1] * y + R[1][2] * z;
      const Z = R[2][0] * x + R[2][1] * y + R[2][2] * z;
      const k = 1 / (1 - Z * 0.12);
      return [cx + X * scale * k, cy - Y * scale * k, Z];
    }

    label(text, x, y, align) {
      if (!this.labels) return;
      const c = this.ctx, col = this._col;
      c.font = `${11 * this.dpr}px ${col.mono}`;
      c.textAlign = align || 'left';
      c.fillStyle = col.muted;
      c.fillText(text, x, y);
    }

    draw() {
      const c = this.ctx; if (!c) return;
      this._col = this.colors();
      c.clearRect(0, 0, this.W, this.H);
      const m = this.spec.mode;
      if (m === 'cutaway') this.drawCutaway();
      else if (m === 'bh') this.drawBH();
      else this.drawParticles();
    }

    /* ---------------- Cutaway ray tracer ---------------- */
    drawCutaway() {
      const RT = this.RT, buf = this.buf, R = rotMatrix(this.yaw, this.pitch);
      const s = 1.25, t = this.t, spec = this.spec;
      const L = this.layers || [];
      const R0 = R[0], R1 = R[1], R2 = R[2];
      const d = [-R2[0], -R2[1], -R2[2]];
      const V = R2;
      let ln = [-0.45, 0.55, 0.7]; const lm = Math.hypot(...ln); ln = ln.map((v) => v / lm);
      const Lo = [ln[0] * R0[0] + ln[1] * R1[0] + ln[2] * R2[0], ln[0] * R0[1] + ln[1] * R1[1] + ln[2] * R2[1], ln[0] * R0[2] + ln[1] * R1[2] + ln[2] * R2[2]];
      const surf = this.surfRGB;
      const compact = spec.compact;
      const pulse = 0.5 + 0.5 * Math.sin(t * 3);
      const flash = spec.flash ? (0.5 + 0.5 * Math.sin(t * 9)) * (frac(t / 3) < 0.4 ? 1 : 0.2) : 0;
      // Collapse animation: iron core shrinks on a 4 s loop.
      const collapseF = spec.collapse ? Math.min(1, frac(t / 4) * 1.6) : 0;
      const radii = L.map((l, i) => (spec.collapse && i === 0) ? l.r * (1 - 0.75 * ease(collapseF)) : l.r);

      for (let j = 0; j < RT; j++) {
        const v = (1 - (j + 0.5) / RT * 2) * s;
        for (let i = 0; i < RT; i++) {
          const u = ((i + 0.5) / RT * 2 - 1) * s;
          const ox = u * R0[0] + v * R1[0] + 3 * R2[0];
          const oy = u * R0[1] + v * R1[1] + 3 * R2[1];
          const oz = u * R0[2] + v * R1[2] + 3 * R2[2];
          const b = ox * d[0] + oy * d[1] + oz * d[2];
          const cc = ox * ox + oy * oy + oz * oz - 1;
          const disc = b * b - cc;
          const idx = j * RT + i;
          if (disc < 0) { buf[idx] = 0; continue; }
          const t0 = -b - Math.sqrt(disc);
          const px = ox + d[0] * t0, py = oy + d[1] * t0, pz = oz + d[2] * t0;
          let r, g, bl;
          if (!(px > 0 && py > 0 && pz > 0)) {
            // Outer surface: limb darkening + granulation
            const mu = Math.max(0, px * V[0] + py * V[1] + pz * V[2]);
            const I = 1 - 0.6 * (1 - mu);
            let gran = 1;
            if (!compact) gran = 0.965 + 0.035 * Math.sin(px * 47 + t * 0.6) * Math.sin(py * 41 - t * 0.4) * Math.sin(pz * 43 + t * 0.3);
            const k = I * gran;
            r = surf[0] * k; g = surf[1] * k; bl = surf[2] * k;
          } else {
            // Cut faces: nearest of the three planes x=0, y=0, z=0
            let best = 1e9, nx = 0, ny = 0, nz = 0, hx = 0, hy = 0, hz = 0;
            if (d[0] !== 0) { const tt = -ox / d[0]; if (tt > t0) { const y = oy + d[1] * tt, z = oz + d[2] * tt; if (y >= 0 && z >= 0 && y * y + z * z <= 1 && tt < best) { best = tt; nx = 1; ny = 0; nz = 0; hx = 0; hy = y; hz = z; } } }
            if (d[1] !== 0) { const tt = -oy / d[1]; if (tt > t0) { const x = ox + d[0] * tt, z = oz + d[2] * tt; if (x >= 0 && z >= 0 && x * x + z * z <= 1 && tt < best) { best = tt; nx = 0; ny = 1; nz = 0; hx = x; hy = 0; hz = z; } } }
            if (d[2] !== 0) { const tt = -oz / d[2]; if (tt > t0) { const x = ox + d[0] * tt, y = oy + d[1] * tt; if (x >= 0 && y >= 0 && x * x + y * y <= 1 && tt < best) { best = tt; nx = 0; ny = 0; nz = 1; hx = x; hy = y; hz = 0; } } }
            if (best === 1e9) { buf[idx] = 0; continue; }
            const rr = Math.sqrt(hx * hx + hy * hy + hz * hz);
            let li = L.length - 1;
            for (let q = 0; q < L.length; q++) { if (rr <= radii[q]) { li = q; break; } }
            const lay = L[li] || { rgb: [128, 128, 128] };
            const lam = 0.68 + 0.32 * Math.max(0, nx * Lo[0] + ny * Lo[1] + nz * Lo[2]);
            r = lay.rgb[0] * lam; g = lay.rgb[1] * lam; bl = lay.rgb[2] * lam;
            const inner = li > 0 ? radii[li - 1] : 0;
            if (lay.glow) {
              const w = 0.55 - 0.4 * (rr / radii[li]) + 0.15 * pulse + 0.4 * flash;
              r = lerp(r, 255, w); g = lerp(g, 236, w); bl = lerp(bl, 190, w);
            }
            if (lay.rim && rr - inner < 0.016) {
              const w = 1 - (rr - inner) / 0.016;
              const gk = 0.55 + 0.25 * pulse;
              r = lerp(r, 255, w * gk); g = lerp(g, 240, w * gk); bl = lerp(bl, 200, w * gk);
            }
            if (lay.pulse) { const gk = 1 + 0.4 * pulse; r *= gk; g *= gk; bl *= gk; }
            if (Math.abs(rr - radii[li]) < 0.004 && li < L.length - 1) { r *= 0.55; g *= 0.55; bl *= 0.55; }
          }
          r = r > 255 ? 255 : r; g = g > 255 ? 255 : g; bl = bl > 255 ? 255 : bl;
          buf[idx] = (255 << 24) | ((bl | 0) << 16) | ((g | 0) << 8) | (r | 0);
        }
      }
      this.rctx.putImageData(this.img, 0, 0);

      const c = this.ctx, W = this.W, H = this.H;
      const size = Math.min(W, H);
      const cx = W / 2, cy = H / 2, rad = size / 2 / s;
      // Halo behind luminous stars
      if (!compact) {
        const hg = c.createRadialGradient(cx, cy, rad * 0.95, cx, cy, rad * 1.35);
        hg.addColorStop(0, `rgba(${surf[0]},${surf[1]},${surf[2]},0.35)`);
        hg.addColorStop(1, `rgba(${surf[0]},${surf[1]},${surf[2]},0)`);
        c.fillStyle = hg; c.beginPath(); c.arc(cx, cy, rad * 1.35, 0, TAU); c.fill();
      }
      c.imageSmoothingEnabled = true;
      c.drawImage(this.rt, cx - size / 2, cy - size / 2, size, size);

      if (spec.beams) this._drawBeams(R, cx, cy, rad);
      if (spec.collapse) {
        const f = ease(collapseF);
        this.label(f < 0.98 ? 'iron core collapsing (~0.25 s)' : 'core bounce → shock', 12 * this.dpr, H - 14 * this.dpr);
      }
      this.label('drag to rotate · not to scale', W - 12 * this.dpr, H - 14 * this.dpr, 'right');
    }

    _drawBeams(R, cx, cy, rad) {
      const c = this.ctx, t = this.t;
      const spin = t * 2.2;
      const tilt = 0.6; // magnetic axis offset from spin axis (rad)
      // spin axis = object y. Magnetic axis rotates around it.
      const m = [Math.sin(tilt) * Math.cos(spin), Math.cos(tilt), Math.sin(tilt) * Math.sin(spin)];
      const perp = [Math.cos(spin + Math.PI / 2), 0, Math.sin(spin + Math.PI / 2)];
      const half = 0.34, len = 2.8;
      const P2 = (v) => this.proj(v[0], v[1], v[2], R, rad, cx, cy);
      c.save();
      c.globalCompositeOperation = 'lighter';
      [1, -1].forEach((sgn) => {
        const tip1 = [], tip2 = [];
        for (let k = 0; k < 3; k++) {
          tip1.push(sgn * (m[k] * Math.cos(half) + perp[k] * Math.sin(half)) * len);
          tip2.push(sgn * (m[k] * Math.cos(half) - perp[k] * Math.sin(half)) * len);
        }
        const base = [sgn * m[0], sgn * m[1], sgn * m[2]];
        const b = P2(base), a1 = P2(tip1), a2 = P2(tip2);
        const g = c.createLinearGradient(b[0], b[1], (a1[0] + a2[0]) / 2, (a1[1] + a2[1]) / 2);
        g.addColorStop(0, 'rgba(190,170,255,0.9)'); g.addColorStop(0.5, 'rgba(150,190,255,0.35)'); g.addColorStop(1, 'rgba(120,200,255,0)');
        c.fillStyle = g;
        c.beginPath(); c.moveTo(b[0], b[1]); c.lineTo(a1[0], a1[1]); c.lineTo(a2[0], a2[1]); c.closePath(); c.fill();
      });
      c.restore();
      // spin axis
      const top = P2([0, 1.6, 0]), bot = P2([0, -1.6, 0]);
      c.save(); c.setLineDash([4 * this.dpr, 4 * this.dpr]); c.strokeStyle = this._col.muted; c.lineWidth = this.dpr;
      c.beginPath(); c.moveTo(top[0], top[1]); c.lineTo(bot[0], bot[1]); c.stroke(); c.restore();
      this.label('spin axis', top[0] + 6 * this.dpr, top[1] + 12 * this.dpr);
      this.label('beams from magnetic poles', 12 * this.dpr, 20 * this.dpr);
    }

    /* ---------------- Particle scenes ---------------- */
    _initParticles(spec) {
      const r = rng(7 + spec.mode.length * 13 + (spec.kind ? spec.kind.length : 0));
      const pts = [];
      const m = spec.mode;
      if (m === 'cloud' || m === 'collapse') {
        const centers = [[-0.35, 0.2, 0.1], [0.35, -0.15, -0.2], [0.05, 0.35, -0.35], [0.15, -0.35, 0.35]];
        for (let i = 0; i < 1600; i++) {
          const ci = i % 4;
          const lumpy = 0.55 + 0.25 * r();
          const p = [gauss(r) * lumpy, gauss(r) * lumpy * 0.7, gauss(r) * lumpy];
          pts.push({ p, ci, dust: r() < 0.16, s: 0.6 + r() * 1.2, ph: r() * TAU });
        }
        this.centers = centers;
      } else if (m === 'disk') {
        for (let i = 0; i < 1300; i++) {
          const rad = 0.22 + Math.pow(r(), 0.7) * 1.25;
          pts.push({ rad, th: r() * TAU, y: gauss(r) * 0.02 * rad, s: 0.6 + r() * 1.1, big: r() < 0.012 });
        }
        for (let i = 0; i < 160; i++) pts.push({ jet: true, sgn: r() < 0.5 ? 1 : -1, ph: r(), off: gauss(r) * 0.015 });
      } else if (m === 'pn') {
        for (let i = 0; i < 1400; i++) {
          const th = Math.acos(2 * r() - 1), ph = r() * TAU;
          const dir = [Math.sin(th) * Math.cos(ph), Math.cos(th), Math.sin(th) * Math.sin(ph)];
          pts.push({ dir, k: 0.85 + 0.3 * r(), outer: r() < 0.55, ph: r() });
        }
      } else if (m === 'supernova') {
        const shells = [['Fe', 0.25], ['Ni', 0.28], ['Si', 0.4], ['O', 0.55], ['C', 0.65], ['He', 0.8], ['H', 1.0]];
        for (let i = 0; i < 2000; i++) {
          const sh = shells[Math.min(shells.length - 1, Math.floor(Math.pow(r(), 0.8) * shells.length))];
          const th = Math.acos(2 * r() - 1), ph = r() * TAU;
          const dir = [Math.sin(th) * Math.cos(ph), Math.cos(th), Math.sin(th) * Math.sin(ph)];
          pts.push({ dir, el: sh[0], v: sh[1] * (0.85 + 0.3 * r()), s: 0.7 + r() });
        }
        for (let i = 0; i < 300; i++) {
          const th = Math.acos(2 * r() - 1), ph = r() * TAU;
          pts.push({ nu: true, dir: [Math.sin(th) * Math.cos(ph), Math.cos(th), Math.sin(th) * Math.sin(ph)] });
        }
      } else if (m === 'binary') {
        for (let i = 0; i < 700; i++) pts.push({ disk: true, rad: 0.06 + Math.pow(r(), 0.6) * 0.32, th: r() * TAU, s: 0.5 + r() });
        for (let i = 0; i < 220; i++) pts.push({ stream: true, ph: r(), off: gauss(r) * 0.02 });
        for (let i = 0; i < 600; i++) { const th = Math.acos(2 * r() - 1), ph = r() * TAU; pts.push({ ej: true, dir: [Math.sin(th) * Math.cos(ph), Math.cos(th), Math.sin(th) * Math.sin(ph)], v: 0.6 + r() * 0.6 }); }
      } else if (m === 'merger') {
        const els = ['Au', 'Pt', 'Ne', 'Fe', 'Au', 'Pt'];
        for (let i = 0; i < 900; i++) { const th = Math.acos(2 * r() - 1), ph = r() * TAU; pts.push({ dir: [Math.sin(th) * Math.cos(ph), Math.cos(th) * 0.6, Math.sin(th) * Math.sin(ph)], v: 0.4 + r() * 0.8, el: els[i % els.length] }); }
      }
      this.pts = pts;
    }

    drawParticles() {
      const c = this.ctx, W = this.W, H = this.H, t = this.t, dpr = this.dpr;
      const R = rotMatrix(this.yaw, this.pitch);
      const size = Math.min(W, H), cx = W / 2, cy = H / 2, sc = size * 0.32;
      const pr = (x, y, z) => this.proj(x, y, z, R, sc, cx, cy);
      const m = this.spec.mode;
      const dot = (x, y, rad, col) => { c.fillStyle = col; c.beginPath(); c.arc(x, y, rad, 0, TAU); c.fill(); };
      const glowBall = (x, y, rad, col, a) => {
        const g = c.createRadialGradient(x, y, 0, x, y, rad);
        g.addColorStop(0, rgba('#ffffff', a)); g.addColorStop(0.25, rgba(col, a)); g.addColorStop(1, rgba(col, 0));
        c.fillStyle = g; c.beginPath(); c.arc(x, y, rad, 0, TAU); c.fill();
      };

      if (m === 'cloud') {
        const T = 9, ph = frac(t / T);
        const sx = lerp(-2.4, 0.5, Math.min(1, ph / 0.75));
        // radiation from a distant hot source (secondary effect)
        c.save(); c.strokeStyle = rgba(D.EL.gam.c, 0.35); c.lineWidth = dpr;
        for (let k = 0; k < 5; k++) {
          const y0 = cy + (k - 2) * size * 0.09; c.beginPath();
          for (let x = 0; x < size * 0.18; x += 2) { const xx = cx - size * 0.48 + x; c.lineTo(xx, y0 + Math.sin(x * 0.25 - t * 8 + k) * 3 * dpr); }
          c.stroke();
        }
        c.restore();
        for (const q of this.pts) {
          let [x, y, z] = q.p;
          if (x < sx) x = sx - (sx - x) * 0.4; // gas piles up behind the shock
          const s = pr(x, y, z);
          const dense = x < sx && sx - x < 0.5;
          const col = q.dust ? '#9c7a5c' : (dense ? D.mix(D.EL.H.c, '#ffffff', 0.35) : D.EL.H.c);
          dot(s[0], s[1], q.s * dpr * (dense ? 1.15 : 1), rgba(col, q.dust ? 0.55 : 0.45));
        }
        // shock front: a spherical cap moving through the cloud
        c.save(); c.globalCompositeOperation = 'lighter';
        for (let k = 0; k < 260; k++) {
          const a = (k / 260 - 0.5) * 1.6, b = ((k * 37) % 260) / 260 * TAU;
          const Rs = 3;
          const x = sx - Rs + Rs * Math.cos(a), y = Rs * Math.sin(a) * Math.cos(b), z = Rs * Math.sin(a) * Math.sin(b) * 0.9;
          if (Math.abs(y) > 1.4 || Math.abs(z) > 1.4) continue;
          const s = pr(x, y, z);
          dot(s[0], s[1], 1.4 * dpr, rgba('#ffb454', 0.5));
        }
        c.restore();
        const sl = pr(sx, 1.25, 0);
        this.label('supernova shock front', sl[0], Math.max(16 * dpr, sl[1]), 'center');
        this.label('UV / X-ray / γ radiation (secondary: heats gas)', 12 * dpr, 18 * dpr);
        this.label('molecular cloud · ~10 K · H₂ + dust', 12 * dpr, H - 14 * dpr);
      } else if (m === 'collapse') {
        const T = 9, ph = Math.min(1, frac(t / T) / 0.8), e = ease(ph);
        for (const q of this.pts) {
          const cc = this.centers[q.ci];
          const dx = q.p[0] * 0.9, dy = q.p[1] * 0.9, dz = q.p[2] * 0.9;
          const sh = lerp(1, 0.07, e);
          const ang = e * e * 4 / (0.3 + Math.hypot(dx, dz));
          const ca = Math.cos(ang), sa = Math.sin(ang);
          const rx = dx * ca - dz * sa, rz = dx * sa + dz * ca;
          const x = lerp(q.p[0], cc[0] + rx * sh, e), y = lerp(q.p[1], cc[1] + dy * sh * 0.5, e), z = lerp(q.p[2], cc[2] + rz * sh, e);
          const s = pr(x, y, z);
          const col = q.dust ? '#9c7a5c' : D.mix(D.EL.H.c, '#ffb454', e);
          dot(s[0], s[1], q.s * dpr, rgba(col, 0.45 + 0.3 * e));
        }
        if (e > 0.6) for (const cc of this.centers) { const s = pr(...cc); glowBall(s[0], s[1], size * 0.05 * (e - 0.4), '#ffb454', 0.8 * (e - 0.6) / 0.4); }
        this.label('clumps above the Jeans mass collapse', 12 * dpr, 18 * dpr);
        this.label('fragmentation → star cluster', 12 * dpr, H - 14 * dpr);
      } else if (m === 'disk') {
        const items = [];
        for (const q of this.pts) {
          if (q.jet) {
            const f = frac(q.ph + t * 0.35);
            const s = pr(q.off, q.sgn * (0.12 + f * 1.6), q.off);
            items.push([s[2], () => dot(s[0], s[1], 1.3 * dpr, rgba('#bfe1ff', 0.7 * (1 - f)))]);
            continue;
          }
          const om = 0.9 * Math.pow(q.rad, -1.5);
          const th = q.th + t * om * 0.6;
          const x = q.rad * Math.cos(th), z = q.rad * Math.sin(th);
          const s = pr(x, q.y, z);
          const heat = Math.max(0, 1 - (q.rad - 0.22) / 0.9);
          const col = q.big ? '#c8b39a' : D.mix('#7c6a8e', '#ffb06a', heat);
          items.push([s[2], () => dot(s[0], s[1], (q.big ? 2.6 : q.s) * dpr, rgba(col, q.big ? 0.95 : 0.6))]);
        }
        const star = pr(0, 0, 0);
        items.push([0, () => glowBall(star[0], star[1], size * 0.09, '#ff9a4a', 1)]);
        items.sort((a, b) => a[0] - b[0]).forEach((it) => it[1]());
        this.label('protostar (no fusion yet)', star[0], star[1] + size * 0.14, 'center');
        this.label('jets carry away angular momentum', 12 * dpr, 18 * dpr);
        this.label('disk → planetesimals → planets (nebular hypothesis)', 12 * dpr, H - 14 * dpr);
      } else if (m === 'pn') {
        const age = frac(t / 12);
        const Rn = 0.25 + age * 1.1;
        for (const q of this.pts) {
          const k = q.k * (q.outer ? 1 : 0.8);
          const x = q.dir[0] * Rn * k, y = q.dir[1] * Rn * k * 1.35, z = q.dir[2] * Rn * k;
          const s = pr(x, y, z);
          dot(s[0], s[1], 1.1 * dpr, rgba(q.outer ? D.EL.H.c : D.EL.O.c, 0.55 * (1 - age * 0.6)));
        }
        const s = pr(0, 0, 0);
        glowBall(s[0], s[1], size * 0.06, '#cfe2ff', 1);
        this.label('hot exposed core (~100,000 K) → white dwarf', s[0], s[1] + size * 0.09, 'center');
        this.label('ejected envelope: hydrogen (outer), oxygen (inner)', 12 * dpr, 18 * dpr);
      } else if (m === 'supernova') {
        const T = 10, ph = frac(t / T), time = ph * T;
        const heavyStar = (this.spec.M || 15) > P.LIMITS.blackHole;
        if (time < 0.9) {
          const s = pr(0, 0, 0);
          glowBall(s[0], s[1], size * (0.05 + time * 0.25), '#ffffff', 1 - time / 0.9);
        }
        for (const q of this.pts) {
          if (q.nu) {
            const rr = time * 2.2; if (rr > 2.2) continue;
            const s = pr(q.dir[0] * rr, q.dir[1] * rr, q.dir[2] * rr);
            dot(s[0], s[1], 1.2 * dpr, rgba(D.EL.nu.c, Math.max(0, 0.8 - time * 0.6)));
            continue;
          }
          const rr = Math.max(0, time - 0.4) * q.v * 0.38;
          const s = pr(q.dir[0] * rr, q.dir[1] * rr, q.dir[2] * rr);
          dot(s[0], s[1], q.s * dpr, rgba(D.EL[q.el].c, Math.max(0, 0.85 - ph * 0.5)));
        }
        const cs = pr(0, 0, 0);
        if (heavyStar) { dot(cs[0], cs[1], 5 * dpr, '#000000'); c.strokeStyle = 'rgba(255,190,120,0.8)'; c.lineWidth = 1.2 * dpr; c.beginPath(); c.arc(cs[0], cs[1], 6.5 * dpr, 0, TAU); c.stroke(); }
        else glowBall(cs[0], cs[1], 9 * dpr, '#bcd4ff', 1);
        this.label(time < 1.2 ? 'neutrino burst: ~99% of the energy' : 'ejecta layered by element (inner = iron peak)', 12 * dpr, 18 * dpr);
        this.label(heavyStar ? 'remnant at centre: black hole' : 'remnant at centre: neutron star', 12 * dpr, 34 * dpr);
        this._legend(['H', 'He', 'C', 'O', 'Si', 'Fe', 'Ni'], H);
      } else if (m === 'binary') {
        this._drawBinary(c, R, sc, cx, cy, size, pr, dot, glowBall);
      } else if (m === 'merger') {
        this._drawMerger(c, R, sc, cx, cy, size, pr, dot, glowBall);
      }
    }

    _legend(els, H) {
      const c = this.ctx, dpr = this.dpr;
      let x = 12 * dpr; const y = H - 14 * dpr;
      c.font = `${11 * dpr}px ${this._col.mono}`; c.textAlign = 'left';
      els.forEach((e) => {
        c.fillStyle = D.EL[e].c; c.beginPath(); c.arc(x + 4 * dpr, y - 4 * dpr, 4 * dpr, 0, TAU); c.fill();
        c.fillStyle = this._col.muted; c.fillText(e, x + 11 * dpr, y);
        x += (c.measureText(e).width + 24 * dpr);
      });
    }

    _drawBinary(c, R, sc, cx, cy, size, pr, dot, glowBall) {
      const t = this.t, dpr = this.dpr, kind = this.spec.kind;
      const T = 10, ph = frac(t / T);
      const donorX = -0.75, accX = 0.65;
      const isBH = kind === 'xrb-bh', isNS = kind === 'xrb-ns';
      const exploded = kind === 'sn1a' && ph > 0.7;
      const items = [];
      // donor star
      const ds = pr(donorX, 0, 0);
      items.push([ds[2], () => {
        const rad = sc * 0.48;
        const g = c.createRadialGradient(ds[0] - rad * 0.3, ds[1] - rad * 0.3, rad * 0.1, ds[0], ds[1], rad);
        const col = isBH ? '#9fc4ff' : '#ff9a5a';
        g.addColorStop(0, D.mix(col, '#ffffff', 0.5)); g.addColorStop(1, D.mix(col, '#000000', 0.25));
        c.fillStyle = g; c.beginPath(); c.arc(ds[0], ds[1], rad, 0, TAU); c.fill();
      }]);
      // accretion disk + stream
      if (!exploded) {
        for (const q of this.pts) {
          if (q.disk) {
            const th = q.th + t * 1.2 * Math.pow(q.rad / 0.2, -1.5);
            const s = pr(accX + q.rad * Math.cos(th), 0, q.rad * Math.sin(th));
            const heat = 1 - (q.rad - 0.06) / 0.32;
            const col = (isBH || isNS) ? D.mix('#ff7a3a', '#dff0ff', heat) : D.mix('#ff7a3a', '#fff0c8', heat);
            items.push([s[2], () => dot(s[0], s[1], q.s * dpr, rgba(col, 0.75))]);
          } else if (q.stream) {
            const f = frac(q.ph + t * 0.25);
            const x = lerp(donorX + 0.46, accX - 0.05, f), z = Math.sin(f * Math.PI) * 0.25 + q.off, y = q.off;
            const s = pr(x, y, z);
            items.push([s[2], () => dot(s[0], s[1], 1.2 * dpr, rgba('#ffb06a', 0.7))]);
          }
        }
      }
      const as = pr(accX, 0, 0);
      items.push([as[2] + 0.01, () => {
        if (exploded) return;
        if (isBH) { dot(as[0], as[1], 6 * dpr, '#000000'); c.strokeStyle = 'rgba(255,220,170,0.9)'; c.lineWidth = 1.2 * dpr; c.beginPath(); c.arc(as[0], as[1], 7.5 * dpr, 0, TAU); c.stroke(); }
        else glowBall(as[0], as[1], (isNS ? 7 : 9) * dpr, '#dfe9ff', 1);
      }]);
      items.sort((a, b) => a[0] - b[0]).forEach((it) => it[1]());

      if (kind === 'nova') {
        const f = frac(t / 5);
        if (f < 0.35) { c.strokeStyle = rgba('#ffe7a8', 0.9 * (1 - f / 0.35)); c.lineWidth = 2 * dpr; c.beginPath(); c.arc(as[0], as[1], (10 + f * 260) * dpr, 0, TAU); c.stroke(); glowBall(as[0], as[1], size * 0.12 * (1 - f / 0.35), '#ffe7a8', 0.9); }
        this.label('surface hydrogen ignites → nova (white dwarf survives)', 12 * dpr, 18 * dpr);
      } else if (kind === 'sn1a') {
        if (ph > 0.7) {
          const f = (ph - 0.7) / 0.3;
          glowBall(as[0], as[1], size * (0.1 + f * 0.5), '#fff4d6', Math.max(0, 1 - f * 1.1));
          for (const q of this.pts) if (q.ej) { const rr = f * q.v * 1.6; const s = pr(accX + q.dir[0] * rr, q.dir[1] * rr, q.dir[2] * rr); dot(s[0], s[1], 1.2 * dpr, rgba(q.v > 0.9 ? D.EL.Si.c : D.EL.Ni.c, 0.8 * (1 - f))); }
          this.label('carbon detonates: white dwarf destroyed, ~0.6 M☉ of ⁵⁶Ni', 12 * dpr, 18 * dpr);
        } else this.label('white dwarf gains mass toward ~1.4 M☉', 12 * dpr, 18 * dpr);
      } else {
        this.label('accretion disk heats to ~10⁷ K → X-rays', 12 * dpr, 18 * dpr);
        this.label(isBH ? 'black hole (Cygnus X-1 type)' : 'neutron star', as[0], as[1] + 30 * dpr, 'center');
      }
      this.label(isBH ? 'blue supergiant donor' : 'donor star', ds[0], ds[1] + sc * 0.48 + 16 * dpr, 'center');
    }

    _drawMerger(c, R, sc, cx, cy, size, pr, dot, glowBall) {
      const t = this.t, dpr = this.dpr, kind = this.spec.kind;
      const T = 11, time = frac(t / T) * T, tm = 6.5;
      // gravitational-wave ripples
      c.save(); c.lineWidth = 1.2 * dpr;
      for (let k = 0; k < 8; k++) {
        const rr = ((time * 0.35 + k * 0.22) % 1.8) + 0.1;
        const amp = time < tm ? 0.25 + 0.75 * (time / tm) : Math.max(0, 1 - (time - tm) / 2);
        c.strokeStyle = rgba('#8fb6ff', 0.35 * amp * (1 - rr / 1.9));
        c.beginPath();
        for (let a = 0; a <= 64; a++) { const th = a / 64 * TAU; const s = pr(rr * Math.cos(th), 0, rr * Math.sin(th)); if (a === 0) c.moveTo(s[0], s[1]); else c.lineTo(s[0], s[1]); }
        c.stroke();
      }
      c.restore();
      if (time < tm) {
        const f = time / tm;
        const a = 0.75 * Math.pow(1 - f, 0.25);
        const phase = -8 * Math.pow(1 - f, 0.625) * 6; // chirp: phase ~ (1-f)^(5/8)
        [0, Math.PI].forEach((o) => {
          const s = pr(a * Math.cos(phase + o), 0, a * Math.sin(phase + o));
          if (kind === 'bh') { dot(s[0], s[1], 7 * dpr, '#000000'); c.strokeStyle = 'rgba(255,220,170,0.8)'; c.lineWidth = dpr; c.beginPath(); c.arc(s[0], s[1], 8.5 * dpr, 0, TAU); c.stroke(); }
          else glowBall(s[0], s[1], 9 * dpr, '#cfe0ff', 1);
        });
        this.label('inspiral: orbit shrinks as gravitational waves carry energy away', 12 * dpr, 18 * dpr);
      } else {
        const f = (time - tm) / (T - tm);
        const s = pr(0, 0, 0);
        if (kind === 'ns') {
          glowBall(s[0], s[1], size * (0.06 + 0.25 * Math.min(1, f * 3)), '#ffcf7a', Math.max(0, 1 - f));
          if (f < 0.15) { // short GRB jets along the axis
            c.strokeStyle = rgba('#ffffff', 1 - f / 0.15); c.lineWidth = 3 * dpr;
            const a = pr(0, 1.6, 0), b = pr(0, -1.6, 0); c.beginPath(); c.moveTo(a[0], a[1]); c.lineTo(b[0], b[1]); c.stroke();
          }
          for (const q of this.pts) { const rr = f * q.v * 1.3; const p = pr(q.dir[0] * rr, q.dir[1] * rr, q.dir[2] * rr); dot(p[0], p[1], 1.3 * dpr, rgba(D.EL[q.el].c, 0.85 * (1 - f * 0.7))); }
          this.label(f < 0.15 ? 'short gamma-ray burst along the jet axis' : 'kilonova: r-process ejecta (gold, platinum, lanthanides)', 12 * dpr, 18 * dpr);
          this._legend(['Au', 'Pt', 'Fe'], this.H);
        } else {
          const ring = 1 + 0.15 * Math.exp(-f * 6) * Math.sin(f * 60);
          dot(s[0], s[1], 10 * dpr * ring, '#000000');
          c.strokeStyle = 'rgba(255,220,170,0.85)'; c.lineWidth = 1.4 * dpr; c.beginPath(); c.arc(s[0], s[1], 12 * dpr * ring, 0, TAU); c.stroke();
          this.label('merged black hole "rings down"; no light emitted', 12 * dpr, 18 * dpr);
        }
      }
    }

    /* ---------------- Black hole with lensing ---------------- */
    drawBH() {
      const c = this.ctx, W = this.W, H = this.H, dpr = this.dpr, t = this.t;
      const cx = W / 2, cy = H / 2, size = Math.min(W, H);
      const rs = size * 0.075;
      const thetaE = rs * 2.4; // Einstein radius in pixels (illustrative)
      if (!this._stars) {
        const r = rng(99); this._stars = [];
        for (let i = 0; i < 420; i++) this._stars.push([r() * 2 - 1, r() * 2 - 1, 0.5 + r() * 1.3, r()]);
      }
      const drift = t * 0.02;
      c.save();
      for (const s of this._stars) {
        let x = ((s[0] + drift + 1) % 2) - 1, y = s[1];
        const bx = x * W * 0.6, by = y * H * 0.6;
        const beta = Math.hypot(bx, by) || 1e-3;
        // point-mass lens equation: theta = (beta ± sqrt(beta^2 + 4 thetaE^2)) / 2
        const root = Math.sqrt(beta * beta + 4 * thetaE * thetaE);
        const tp = (beta + root) / 2, tm = (beta - root) / 2;
        const ux = bx / beta, uy = by / beta;
        const mag = (th) => { const u = beta / thetaE; return (u * u + 2) / (2 * u * Math.sqrt(u * u + 4)) + (th > 0 ? 0.5 : -0.5); };
        const a1 = Math.min(1, 0.35 + 0.25 * Math.abs(mag(1)));
        c.fillStyle = `rgba(230,236,255,${a1 * 0.8})`;
        c.beginPath(); c.arc(cx + ux * tp, cy + uy * tp, s[2] * dpr * Math.min(2.2, Math.sqrt(Math.abs(mag(1)))), 0, TAU); c.fill();
        const a2 = Math.min(1, Math.abs(mag(-1)));
        if (Math.abs(tm) > rs * 2.6) { c.fillStyle = `rgba(230,236,255,${a2 * 0.7})`; c.beginPath(); c.arc(cx + ux * tm, cy + uy * tm, s[2] * dpr * 0.8, 0, TAU); c.fill(); }
      }
      c.restore();
      // shadow (2.6 r_s), photon ring, horizon, ISCO
      const shadow = rs * Math.sqrt(27) / 2;
      const g = c.createRadialGradient(cx, cy, shadow * 0.98, cx, cy, shadow * 1.18);
      g.addColorStop(0, 'rgba(255,214,150,0.95)'); g.addColorStop(0.25, 'rgba(255,170,90,0.45)'); g.addColorStop(1, 'rgba(255,170,90,0)');
      c.fillStyle = g; c.beginPath(); c.arc(cx, cy, shadow * 1.18, 0, TAU); c.fill();
      c.fillStyle = '#000000'; c.beginPath(); c.arc(cx, cy, shadow, 0, TAU); c.fill();
      c.save(); c.setLineDash([3 * dpr, 4 * dpr]); c.lineWidth = dpr;
      c.strokeStyle = 'rgba(255,255,255,0.55)'; c.beginPath(); c.arc(cx, cy, rs, 0, TAU); c.stroke();
      c.strokeStyle = 'rgba(143,182,255,0.75)'; c.beginPath(); c.ellipse(cx, cy, rs * 3, rs * 3 * 0.35, 0, 0, TAU); c.stroke();
      c.restore();
      const lx = cx + shadow * 1.25;
      this.label('event horizon r_s (dashed, inside shadow)', 12 * dpr, 18 * dpr);
      this.label('shadow ≈ 2.6 r_s · photon ring at its edge', 12 * dpr, 34 * dpr);
      this.label('innermost stable orbit: 3 r_s (blue)', 12 * dpr, H - 30 * dpr);
      this.label('background stars lensed: θ = ½(β ± √(β² + 4θ_E²))', 12 * dpr, H - 14 * dpr);
    }
  }

  global.StageView = StageView;
})(window);
