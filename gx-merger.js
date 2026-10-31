/* Galaxies — gx-merger.js
 * Galaxy collision in the style of Toomre & Toomre (1972): two softened point-mass
 * galaxies on a parabolic orbit, each carrying a disk of test-particle stars.
 * Units: G = 1, length 10 kpc, mass 10^11 M☉, so the time unit is ~47 Myr.
 * Optional approximate dynamical friction lets the cores sink together and merge.
 */
(function (global) {
  'use strict';
  const T_UNIT_MYR = 47.1, EPS2 = 0.06;

  class Merger {
    constructor(canvas) {
      this.c = canvas; this.ctx = canvas.getContext('2d');
      this.opts = { peri: 1.0, tiltA: 15, tiltB: 60, q: 1, friction: true, n: 4200 };
      this.yaw = 0.3; this.pitch = 1.0; this.running = false; this.speed = 1;
      this._drag();
      this.reset();
    }
    set(o) { Object.assign(this.opts, o); this.reset(); }

    reset() {
      const o = this.opts, m1 = 1, m2 = o.q, M = m1 + m2;
      this.m = [m1, m2];
      // parabolic relative orbit in the x-y plane, starting at separation D0 = 50 kpc,
      // about 200 million years before closest approach for equal masses
      const D0 = 5, qp = o.peri;
      const cf = Math.min(1, 2 * qp / D0 - 1), f = -Math.acos(cf);
      const h = Math.sqrt(2 * M * qp);
      const rel = [D0 * Math.cos(f), D0 * Math.sin(f), 0];
      const vr = (M / h) * Math.sin(f), vt = (M / h) * (1 + Math.cos(f));
      const rv = [vr * Math.cos(f) - vt * Math.sin(f), vr * Math.sin(f) + vt * Math.cos(f), 0];
      this.core = [
        { x: rel.map((v) => -v * m2 / M), v: rv.map((v) => -v * m2 / M) },
        { x: rel.map((v) => v * m1 / M), v: rv.map((v) => v * m1 / M) },
      ];
      // disks: spin axis tilted from the orbit's angular momentum (+z) by tiltA / tiltB degrees
      const N = o.n, P = new Float32Array(N * 2 * 3), V = new Float32Array(N * 2 * 3);
      let s = 12345; const rnd = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
      [0, 1].forEach((g) => {
        const tilt = (g ? o.tiltB : o.tiltA) * Math.PI / 180, az = g ? 1.1 : -0.4;
        // basis: n = spin axis; e1, e2 span the disk
        const n = [Math.sin(tilt) * Math.cos(az), Math.sin(tilt) * Math.sin(az), Math.cos(tilt)];
        let e1 = [-Math.sin(az), Math.cos(az), 0];
        const e2 = [n[1] * e1[2] - n[2] * e1[1], n[2] * e1[0] - n[0] * e1[2], n[0] * e1[1] - n[1] * e1[0]];
        const mc = this.m[g], scale = Math.sqrt(mc);       // smaller galaxy, smaller disk
        for (let i = 0; i < N; i++) {
          const k = (g * N + i) * 3;
          const r = scale * (0.18 + 0.9 * Math.sqrt(rnd())), ph = rnd() * Math.PI * 2;
          const vc = Math.sqrt(mc * r * r / Math.pow(r * r + EPS2, 1.5));
          for (let a = 0; a < 3; a++) {
            P[k + a] = this.core[g].x[a] + r * (Math.cos(ph) * e1[a] + Math.sin(ph) * e2[a]);
            V[k + a] = this.core[g].v[a] + vc * (-Math.sin(ph) * e1[a] + Math.cos(ph) * e2[a]);
          }
        }
      });
      this.P = P; this.V = V; this.N = N; this.t = 0; this.minSep = 1e9;
      this.draw();
    }

    _acc(x, y, z, out) {
      let ax = 0, ay = 0, az = 0;
      for (let g = 0; g < 2; g++) {
        const c = this.core[g].x, dx = c[0] - x, dy = c[1] - y, dz = c[2] - z;
        const r2 = dx * dx + dy * dy + dz * dz + EPS2, f = this.m[g] / (r2 * Math.sqrt(r2));
        ax += f * dx; ay += f * dy; az += f * dz;
      }
      out[0] = ax; out[1] = ay; out[2] = az;
    }
    _coreAcc() {
      const a = this.core[0].x, b = this.core[1].x, d = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
      const r2 = d[0] * d[0] + d[1] * d[1] + d[2] * d[2] + EPS2 * 2, r = Math.sqrt(r2), inv = 1 / (r2 * Math.sqrt(r2));
      const acc = [d.map((v) => v * this.m[1] * inv), d.map((v) => -v * this.m[0] * inv)];
      if (this.opts.friction) {
        // crude dynamical friction: drag on the relative motion while the halos overlap
        const va = this.core[0].v, vb = this.core[1].v, M = this.m[0] + this.m[1];
        const k = 0.3 * Math.exp(-r2 / 1.2);
        for (let i = 0; i < 3; i++) { const dv = vb[i] - va[i]; acc[0][i] += k * dv * this.m[1] / M; acc[1][i] -= k * dv * this.m[0] / M; }
      }
      this.sep = r;
      return acc;
    }
    step(dt) {
      // leapfrog: kick-drift-kick for the cores and the stars
      let ac = this._coreAcc();
      for (let g = 0; g < 2; g++) for (let i = 0; i < 3; i++) this.core[g].v[i] += ac[g][i] * dt / 2;
      const P = this.P, V = this.V, n = this.N * 2, a = [0, 0, 0];
      for (let j = 0; j < n; j++) { const k = j * 3; this._acc(P[k], P[k + 1], P[k + 2], a); V[k] += a[0] * dt / 2; V[k + 1] += a[1] * dt / 2; V[k + 2] += a[2] * dt / 2; }
      for (let g = 0; g < 2; g++) for (let i = 0; i < 3; i++) this.core[g].x[i] += this.core[g].v[i] * dt;
      for (let j = 0; j < n * 3; j++) P[j] += V[j] * dt;
      ac = this._coreAcc();
      for (let g = 0; g < 2; g++) for (let i = 0; i < 3; i++) this.core[g].v[i] += ac[g][i] * dt / 2;
      for (let j = 0; j < n; j++) { const k = j * 3; this._acc(P[k], P[k + 1], P[k + 2], a); V[k] += a[0] * dt / 2; V[k + 1] += a[1] * dt / 2; V[k + 2] += a[2] * dt / 2; }
      this.t += dt; this.minSep = Math.min(this.minSep, this.sep);
    }

    play(on) {
      this.running = on;
      if (!on) { cancelAnimationFrame(this.raf); return; }
      const loop = () => {
        if (!this.running) return;
        // faster playback = more fixed-size substeps per frame, so the integration stays stable
        for (let i = 0; i < 3 * this.speed; i++) this.step(0.012);
        this.draw();
        if (this.onTick) this.onTick();
        if (this.t * T_UNIT_MYR > 3000) { this.play(false); if (this.onEnd) this.onEnd(); return; }
        this.raf = requestAnimationFrame(loop);
      };
      this.raf = requestAnimationFrame(loop);
    }

    _drag() {
      let down = false, x0 = 0, y0 = 0, a = 0, b = 0;
      this.c.addEventListener('pointerdown', (e) => { down = true; x0 = e.clientX; y0 = e.clientY; a = this.yaw; b = this.pitch; this.c.setPointerCapture(e.pointerId); });
      this.c.addEventListener('pointermove', (e) => { if (!down) return; this.yaw = a + (e.clientX - x0) * 0.01; this.pitch = Math.max(-1.55, Math.min(1.55, b + (e.clientY - y0) * 0.01)); if (!this.running) this.draw(); });
      const up = () => { down = false; };
      this.c.addEventListener('pointerup', up); this.c.addEventListener('pointercancel', up);
    }

    draw() {
      const c = this.c, ctx = this.ctx, r = c.getBoundingClientRect(), dpr = Math.min(global.devicePixelRatio || 1, 2);
      const W = Math.max(100, Math.round(r.width * dpr)), H = Math.max(100, Math.round(r.height * dpr));
      if (c.width !== W || c.height !== H) { c.width = W; c.height = H; }
      ctx.clearRect(0, 0, W, H);
      // camera: view the centre of mass; orbit plane = x-y
      const cy = Math.cos(this.yaw), sy = Math.sin(this.yaw), cp = Math.cos(this.pitch), sp = Math.sin(this.pitch);
      const M = this.m[0] + this.m[1];
      const com = [0, 1, 2].map((i) => (this.core[0].x[i] * this.m[0] + this.core[1].x[i] * this.m[1]) / M);
      const sc = Math.min(W, H) / 9;
      const proj = (x, y, z) => {
        x -= com[0]; y -= com[1]; z -= com[2];
        const x1 = x * cy - y * sy, y1 = x * sy + y * cy;      // spin about the orbit axis
        const Y = y1 * cp - z * sp;                               // tilt
        return [W / 2 + x1 * sc, H / 2 + Y * sc];
      };
      ctx.globalCompositeOperation = 'lighter';
      const sz = Math.max(1.6, dpr * 1.5), P = this.P;
      ['rgba(120,170,255,0.55)', 'rgba(255,190,110,0.55)'].forEach((col, g) => {
        ctx.fillStyle = col;
        for (let j = g * this.N; j < (g + 1) * this.N; j++) {
          const p = proj(P[j * 3], P[j * 3 + 1], P[j * 3 + 2]);
          if (p[0] < -5 || p[1] < -5 || p[0] > W + 5 || p[1] > H + 5) continue;
          ctx.fillRect(p[0], p[1], sz, sz);
        }
      });
      this.core.forEach((cr, g) => {
        const p = proj(cr.x[0], cr.x[1], cr.x[2]);
        const grd = ctx.createRadialGradient(p[0], p[1], 0, p[0], p[1], 14 * dpr);
        grd.addColorStop(0, g ? 'rgba(255,230,180,0.95)' : 'rgba(210,230,255,0.95)'); grd.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = grd; ctx.beginPath(); ctx.arc(p[0], p[1], 14 * dpr, 0, Math.PI * 2); ctx.fill();
      });
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = 'rgba(255,255,255,0.85)'; ctx.font = `${12 * dpr}px ui-monospace, Menlo, monospace`;
      ctx.fillText(`t = ${Math.round(this.t * T_UNIT_MYR)} million years`, 12 * dpr, 20 * dpr);
      // scale bar: 20 kpc
      const bar = 2 * sc;
      ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.lineWidth = 1.5 * dpr;
      ctx.beginPath(); ctx.moveTo(12 * dpr, H - 14 * dpr); ctx.lineTo(12 * dpr + bar, H - 14 * dpr); ctx.stroke();
      ctx.fillText('20 kpc (65,000 ly)', 12 * dpr, H - 20 * dpr);
    }
  }
  Merger.T_UNIT_MYR = T_UNIT_MYR;
  global.Merger = Merger;
})(window);
