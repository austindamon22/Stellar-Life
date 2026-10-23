/* Stellar Life — spacetime.js
 * Embedding diagram of the spatial geometry around a mass (Flamm's
 * paraboloid outside, uniform-density interior inside), coloured by the
 * rate of proper time dτ/dt. Dependency-free canvas projection.
 */
(function (global) {
  'use strict';
  const P = global.Phys, D = global.Data;
  const TAU = Math.PI * 2;
  const reduceMotion = global.matchMedia && global.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Colour ramp for "how much slower does time run": 0 → cool, 1 → hot
  const RAMP = ['#3f5f8f', '#5aa9ff', '#ffc93c', '#ff8a3c', '#ff4d4d'];
  function ramp(f) {
    f = Math.max(0, Math.min(1, f)) * (RAMP.length - 1);
    const i = Math.min(RAMP.length - 2, Math.floor(f));
    return D.mix(RAMP[i], RAMP[i + 1], f - i);
  }

  class Spacetime {
    constructor(canvas) {
      this.cv = canvas; this.ctx = canvas.getContext('2d');
      this.yaw = 0.4; this.pitch = 0.55; this.t = 0; this.probe = 2; this.running = false; this.visible = false;
      this._drag();
      new ResizeObserver(() => this._resize()).observe(canvas);
      if ('IntersectionObserver' in global) new IntersectionObserver((e) => { this.visible = e[0].isIntersecting; if (this.visible) this.start(); }).observe(canvas);
      this._resize();
    }
    _resize() {
      const r = this.cv.getBoundingClientRect(), dpr = Math.min(global.devicePixelRatio || 1, 2);
      this.dpr = dpr; this.W = this.cv.width = Math.max(200, r.width * dpr | 0); this.H = this.cv.height = Math.max(200, r.height * dpr | 0);
      this.draw();
    }
    _drag() {
      let down = false, x0, y0, a, b;
      this.cv.addEventListener('pointerdown', (e) => { down = true; x0 = e.clientX; y0 = e.clientY; a = this.yaw; b = this.pitch; this.cv.setPointerCapture(e.pointerId); this.user = true; });
      this.cv.addEventListener('pointermove', (e) => { if (!down) return; this.yaw = a + (e.clientX - x0) * 0.01; this.pitch = Math.max(0.12, Math.min(1.3, b + (e.clientY - y0) * 0.01)); this.draw(); });
      const up = () => { down = false; };
      this.cv.addEventListener('pointerup', up); this.cv.addEventListener('pointercancel', up);
    }

    // obj: {name, M (kg), R (m), bh (bool), T (surface K)}
    setObject(obj) {
      this.obj = obj;
      const rs = P.schwarzschildRadius(obj.M);
      this.rs = rs;
      if (obj.bh) { this.unit = rs; this.rMin = 1; this.rMax = 10; this.Rin = 1; }
      else { this.unit = obj.R; this.rMin = 0; this.rMax = 6; this.Rin = 1; }
      const R = obj.bh ? rs * 1.0000001 : obj.R;
      this.prof = P.embeddingProfile(R, rs, this.rMin * this.unit, this.rMax * this.unit, 160)
        .map((p) => ({ r: p.r / this.unit, depth: p.depth / this.unit }));
      const trueDepth = this.prof[0].depth / this.rMax * 3; // world units
      this.exag = trueDepth >= 0.45 ? 1 : 1.1 / Math.max(trueDepth, 1e-30);
      this.dil = (x) => P.dilationAt(x * this.unit, obj.bh ? 0 : obj.R, rs);
      if (obj.bh) this.dil = (x) => P.dilationOutside(x * this.unit, rs);
      // reference for colour scaling: largest slowdown shown
      this.fMax = 1 - this.dil(obj.bh ? 1.02 : 0);
      if (this.probe < this.rMin || this.probe > this.rMax) this.probe = obj.bh ? 1.5 : 1;
      this.draw();
    }
    setProbe(x) { this.probe = x; this.draw(); }

    start() {
      if (this.running) return; this.running = true; let last = performance.now();
      const loop = (now) => {
        if (!this.visible || document.hidden) { this.running = false; return; }
        const dt = Math.min(0.05, (now - last) / 1000); last = now; this.t += dt;
        if (!this.user && !reduceMotion) this.yaw += dt * 0.08;
        this.draw(); requestAnimationFrame(loop);
      };
      requestAnimationFrame(loop);
    }

    depthAt(x) {
      const p = this.prof; if (x <= p[0].r) return p[0].depth;
      const i = Math.min(p.length - 2, Math.floor((x - p[0].r) / (p[p.length - 1].r - p[0].r) * (p.length - 1)));
      const a = p[i], b = p[i + 1], f = (x - a.r) / (b.r - a.r);
      return a.depth + (b.depth - a.depth) * f;
    }

    project(x, y, z) {
      const cy = Math.cos(this.yaw), sy = Math.sin(this.yaw), cp = Math.cos(this.pitch), sp = Math.sin(this.pitch);
      const X = cy * x + sy * z, Z1 = -sy * x + cy * z;
      const Y = cp * y - sp * Z1, Z = sp * y + cp * Z1;
      const dist = 8, k = dist / (dist - Z);
      const s = Math.min(this.W, this.H) * 0.17;
      return [this.W / 2 + X * s * k, this.H * 0.42 - Y * s * k, Z];
    }

    draw() {
      const c = this.ctx; if (!c || !this.obj) return;
      const W = this.W, H = this.H, dpr = this.dpr;
      c.clearRect(0, 0, W, H);
      const cs = getComputedStyle(document.documentElement);
      const muted = cs.getPropertyValue('--muted').trim(), mono = cs.getPropertyValue('--font-mono').trim();
      const sc = 3 / this.rMax; // world per unit radius
      const pos = (x, th) => { const rw = x * sc; return [rw * Math.cos(th), -this.depthAt(x) * sc * this.exag, rw * Math.sin(th)]; };
      const fOut = 1 - this.dil(this.rMax);
      const colorAt = (x) => { const f = 1 - this.dil(x); const span = this.fMax - fOut; return ramp(span > 0 ? (f - fOut) / span : 0); };

      // rings
      const nR = 26, nS = 48;
      c.lineWidth = 1.1 * dpr;
      for (let i = 0; i <= nR; i++) {
        const x = this.rMin + (this.rMax - this.rMin) * Math.pow(i / nR, 1.15);
        c.strokeStyle = colorAt(x); c.globalAlpha = 0.85; c.beginPath();
        for (let k = 0; k <= 96; k++) { const p = this.project(...pos(x, k / 96 * TAU)); if (k === 0) c.moveTo(p[0], p[1]); else c.lineTo(p[0], p[1]); }
        c.stroke();
      }
      // spokes, coloured along their length
      for (let s = 0; s < nS; s++) {
        const th = s / nS * TAU; let prev = null;
        for (let k = 0; k <= 60; k++) {
          const x = this.rMin + (this.rMax - this.rMin) * Math.pow(k / 60, 1.15);
          const p = this.project(...pos(x, th));
          if (prev) { c.strokeStyle = colorAt(x); c.beginPath(); c.moveTo(prev[0], prev[1]); c.lineTo(p[0], p[1]); c.stroke(); }
          prev = p;
        }
      }
      c.globalAlpha = 1;

      // the object itself
      const o = this.obj;
      const bottom = this.project(0, -this.depthAt(this.rMin) * sc * this.exag, 0);
      const s = Math.min(W, H) * 0.17;
      if (o.bh) {
        const rr = 1 * sc * s;
        c.fillStyle = '#000'; c.beginPath(); c.arc(bottom[0], bottom[1] - rr * 0.2, rr, 0, TAU); c.fill();
        c.strokeStyle = 'rgba(255,214,150,0.9)'; c.lineWidth = 1.5 * dpr; c.stroke();
      } else {
        const rr = sc * s * 0.92;
        const rgb = P.blackbodyRGB(o.T || 5772);
        const top = this.project(0, -this.depthAt(0) * sc * this.exag + sc * 0.92, 0);
        const g = c.createRadialGradient(top[0] - rr * 0.3, top[1] - rr * 0.3, rr * 0.1, top[0], top[1], rr);
        g.addColorStop(0, `rgb(${Math.min(255, rgb[0] + 40)},${Math.min(255, rgb[1] + 40)},${Math.min(255, rgb[2] + 40)})`);
        g.addColorStop(1, `rgb(${rgb[0] * 0.55 | 0},${rgb[1] * 0.55 | 0},${rgb[2] * 0.55 | 0})`);
        c.fillStyle = g; c.globalAlpha = 0.92; c.beginPath(); c.arc(top[0], top[1], rr, 0, TAU); c.fill(); c.globalAlpha = 1;
      }

      // probe ring
      const pulse = 0.6 + 0.4 * Math.sin(this.t * 3);
      c.strokeStyle = `rgba(255,255,255,${0.55 + 0.4 * pulse})`; c.lineWidth = 2.2 * dpr; c.setLineDash([6 * dpr, 5 * dpr]);
      c.beginPath();
      for (let k = 0; k <= 96; k++) { const p = this.project(...pos(this.probe, k / 96 * TAU)); if (k === 0) c.moveTo(p[0], p[1]); else c.lineTo(p[0], p[1]); }
      c.stroke(); c.setLineDash([]);
      // a ticking clock marker on the probe ring: its phase advances at dτ/dt
      const rate = this.dil(this.probe);
      this.clockPhase = (this.clockPhase || 0) + 0.016 * rate * 4;
      const cp = this.project(...pos(this.probe, -0.6));
      c.fillStyle = '#ffffff'; c.beginPath(); c.arc(cp[0], cp[1], 7 * dpr, 0, TAU); c.fill();
      c.strokeStyle = '#111'; c.lineWidth = 1.5 * dpr; c.beginPath(); c.moveTo(cp[0], cp[1]);
      c.lineTo(cp[0] + Math.sin(this.clockPhase) * 6 * dpr, cp[1] - Math.cos(this.clockPhase) * 6 * dpr); c.stroke();
      const far = this.project(...pos(this.rMax, -0.6));
      this.farPhase = (this.farPhase || 0) + 0.016 * 4;
      c.fillStyle = '#ffffff'; c.beginPath(); c.arc(far[0], far[1], 7 * dpr, 0, TAU); c.fill();
      c.beginPath(); c.moveTo(far[0], far[1]); c.lineTo(far[0] + Math.sin(this.farPhase) * 6 * dpr, far[1] - Math.cos(this.farPhase) * 6 * dpr); c.stroke();

      c.font = `${11 * dpr}px ${mono}`; c.fillStyle = muted; c.textAlign = 'left';
      c.fillText(this.exag === 1 ? 'depth: true scale (spatial curvature)' : `depth exaggerated ×${this.exag < 1e5 ? Math.round(this.exag).toLocaleString('en-US') : this.exag.toExponential(1)}`, 12 * dpr, H - 14 * dpr);
      c.textAlign = 'right';
      c.fillText('drag to rotate', W - 12 * dpr, H - 14 * dpr);
      c.textAlign = 'center';
      c.fillText('probe clock', cp[0], cp[1] - 12 * dpr);
      c.fillText('distant clock', far[0], far[1] - 12 * dpr);
    }

    stats() {
      const o = this.obj, x = this.probe, r = x * this.unit, rs = this.rs;
      const rate = this.dil(x);
      const surf = o.bh ? null : P.dilationOutside(o.R, rs);
      return { rs, compact: o.bh ? 1 : rs / o.R, rate, r, x, unitName: o.bh ? 'r_s' : 'R', surf, vesc: r > rs ? Math.sqrt(rs / Math.max(r, o.bh ? r : o.R)) : 1, exag: this.exag };
    }
  }

  global.Spacetime = Spacetime;
  global.SpacetimeRamp = ramp;
})(window);
