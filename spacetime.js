/* Stellar Life — spacetime.js
 * A shared gravity well for every object, drawn in units of the object's own
 * Schwarzschild radius rₛ on a log radial scale.
 *
 * Outside any spherical mass the geometry depends only on the mass
 * (Birkhoff's theorem), so measured in rₛ every object has the SAME well.
 * What differs is where the surface cuts it off: a denser object lets the
 * well go deeper before you hit matter. A black hole has no surface at all.
 *
 * Height = how strongly time is slowed, D = log10(1 / (1 − dτ/dt)), so the
 * vertical axis is the gravitational potential on a log scale.
 * Colour = dτ/dt (proper-time rate).
 */
(function (global) {
  'use strict';
  const P = global.Phys, D = global.Data;
  const TAU = Math.PI * 2;
  const reduceMotion = global.matchMedia && global.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const RAMP = ['#3f5f8f', '#5aa9ff', '#ffc93c', '#ff8a3c', '#ff4d4d'];
  function ramp(f) {
    f = Math.max(0, Math.min(1, f)) * (RAMP.length - 1);
    const i = Math.min(RAMP.length - 2, Math.floor(f));
    return D.mix(RAMP[i], RAMP[i + 1], f - i);
  }
  const X_HI = 9.9;          // log10(r / rₛ) at the rim of the sheet
  const W_RIM = 3.0;         // world radius of the rim
  const W_HOR = 0.22;        // world radius of r = rₛ
  const K_H = 0.21;          // world height per decade of D

  // rate of proper time at radius r (units of rₛ) for an object of radius R (units of rₛ; 0 = black hole)
  function rate(r, R) {
    if (!R || r >= R) return r <= 1 ? 0 : Math.sqrt(1 - 1 / r);
    return Math.max(0, P.dilationInside(r, Math.max(R, 9 / 8), 1)); // interior valid only above the Buchdahl bound
  }
  const depthD = (rt) => Math.log10(1 / Math.max(1e-300, 1 - rt)); // large far away, 0 at the horizon

  class Spacetime {
    constructor(canvas) {
      this.cv = canvas; this.ctx = canvas.getContext('2d');
      this.yaw = 0.5; this.pitch = 0.62; this.t = 0; this.running = false; this.visible = false;
      this.xProbe = 4; this.markers = [];
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
      this.cv.addEventListener('pointermove', (e) => { if (!down) return; this.yaw = a + (e.clientX - x0) * 0.01; this.pitch = Math.max(0.15, Math.min(1.35, b + (e.clientY - y0) * 0.01)); this.draw(); });
      const up = () => { down = false; };
      this.cv.addEventListener('pointerup', up); this.cv.addEventListener('pointercancel', up);
    }

    // obj: { name, M (kg), R (m) or 0 for a black hole, T (K) }
    setObject(obj, markers) {
      this.obj = obj;
      this.rs = P.schwarzschildRadius(obj.M);
      this.Rrs = obj.R ? obj.R / this.rs : 0; // radius in units of rₛ
      this.markers = markers || [];
      const xS = this.Rrs ? Math.log10(this.Rrs) : 0;
      if (obj.name !== this._lastName && !obj.morph) this.xProbe = Math.min(X_HI, Math.max(xS, 0.004) + 0.5);
      if (this.xProbe < xS || this.xProbe > X_HI) this.xProbe = Math.min(X_HI, Math.max(xS, 0.004) + 0.5);
      this._lastName = obj.name;
      this.draw();
    }
    setProbe(x) { this.xProbe = x; this.draw(); }
    probeMin() { return this.Rrs ? Math.log10(this.Rrs) : Math.log10(1.002); }

    start() {
      if (this.running) return; this.running = true; let last = performance.now();
      const loop = (now) => {
        if (!this.visible || document.hidden) { this.running = false; return; }
        const dt = Math.min(0.05, (now - last) / 1000); last = now; this.t += dt;
        if (!this.user && !reduceMotion) this.yaw += dt * 0.07;
        if (this.onTick) this.onTick(dt);
        this.draw(); requestAnimationFrame(loop);
      };
      requestAnimationFrame(loop);
    }

    // world radius for r (units of rₛ)
    wOf(r) {
      const R = this.Rrs;
      const outside = (x) => W_HOR + (x / X_HI) * (W_RIM - W_HOR);
      if (R && r < R) return outside(Math.log10(R)) * (r / R);
      return outside(Math.log10(Math.max(r, 1)));
    }
    hOf(r) {
      const Dfar = depthD(rate(Math.pow(10, X_HI), 0));
      return (depthD(rate(Math.max(r, 1.000001), this.Rrs)) - Dfar) * K_H;
    }
    project(x, y, z) {
      const cy = Math.cos(this.yaw), sy = Math.sin(this.yaw), cp = Math.cos(this.pitch), sp = Math.sin(this.pitch);
      const X = cy * x + sy * z, Z1 = -sy * x + cy * z;
      const Y = cp * y - sp * Z1, Z = sp * y + cp * Z1;
      const dist = 9, k = dist / (dist - Z);
      const s = Math.min(this.W / 6.8, this.H / 5.6);
      return [this.W / 2 + X * s * k, this.H * 0.4 - Y * s * k, Z];
    }

    tokens() {
      if (!this._tok) {
        const cs = getComputedStyle(document.documentElement), g = (k) => cs.getPropertyValue(k).trim();
        this._tok = { muted: g('--muted'), mono: g('--font-mono'), fg: g('--fg') };
      }
      return this._tok;
    }
    refreshTheme() { this._tok = null; this._geo = null; this.draw(); }

    // World-space geometry for the current object, cached until the object changes.
    geometry() {
      const key = this.Rrs + '|' + this.obj.name;
      if (this._geo && this._geo.key === key) return this._geo;
      const R = this.Rrs, xS = R ? Math.log10(R) : 0;
      const world = (r, th) => { const w = this.wOf(r); return [w * Math.cos(th), this.hOf(r), w * Math.sin(th)]; };
      const bucket = (r) => { const n = 1 - depthD(rate(Math.max(r, 1.000001), R)) / 6; return Math.max(0, Math.min(24, Math.round(n * 24))); };
      const segs = []; // [bucket, inside, x1,y1,z1, x2,y2,z2]
      const rings = [];
      for (let x = 0; x <= X_HI + 1e-9; x += 0.33) if (x >= xS) rings.push(Math.pow(10, x));
      if (R) { rings.unshift(R); for (let k = 5; k >= 1; k--) rings.unshift(R * k / 6); } else rings.unshift(1.0001);
      rings.forEach((r) => {
        const bk = bucket(r), ins = r < R ? 1 : 0;
        let prev = world(r, 0);
        for (let k = 1; k <= 72; k++) { const p = world(r, k / 72 * TAU); segs.push([bk, ins, ...prev, ...p]); prev = p; }
      });
      const nS = 40, steps = 60;
      for (let sI = 0; sI < nS; sI++) {
        const th = sI / nS * TAU; let prev = null;
        for (let k = 0; k <= steps; k++) {
          const f = k / steps;
          const r = R ? (f < 0.12 ? R * (f / 0.12) : Math.pow(10, xS + (X_HI - xS) * (f - 0.12) / 0.88)) : Math.pow(10, X_HI * f) * 1.0001;
          const p = world(Math.max(r, 1e-6), th);
          if (prev) segs.push([bucket(r), r < R ? 1 : 0, ...prev, ...p]);
          prev = p;
        }
      }
      const colors = []; for (let i = 0; i <= 24; i++) colors.push(ramp(i / 24));
      this._geo = { key, segs, colors, ring: (r) => { const a = []; for (let k = 0; k <= 96; k++) a.push(world(r, k / 96 * TAU)); return a; } };
      return this._geo;
    }

    draw() {
      const c = this.ctx; if (!c || !this.obj) return;
      const W = this.W, H = this.H, dpr = this.dpr, tok = this.tokens();
      c.clearRect(0, 0, W, H);
      const R = this.Rrs, geo = this.geometry();
      const proj = (p) => this.project(p[0], p[1], p[2]);
      const pt = (r, th) => { const w = this.wOf(r); return this.project(w * Math.cos(th), this.hOf(r), w * Math.sin(th)); };
      const pathOf = (pts) => { c.beginPath(); pts.forEach((p, i) => { const q = proj(p); if (i) c.lineTo(q[0], q[1]); else c.moveTo(q[0], q[1]); }); };

      // mesh: one stroke per colour bucket (fast)
      c.lineWidth = 1.05 * dpr;
      [1, 0].forEach((ins) => {
        const paths = {};
        geo.segs.forEach((s) => {
          if (s[1] !== ins) return;
          const a = this.project(s[2], s[3], s[4]), b = this.project(s[5], s[6], s[7]);
          (paths[s[0]] || (paths[s[0]] = [])).push(a[0], a[1], b[0], b[1]);
        });
        c.globalAlpha = ins ? 0.5 : 0.82;
        Object.keys(paths).forEach((k) => {
          const arr = paths[k]; c.strokeStyle = geo.colors[k]; c.beginPath();
          for (let i = 0; i < arr.length; i += 4) { c.moveTo(arr[i], arr[i + 1]); c.lineTo(arr[i + 2], arr[i + 3]); }
          c.stroke();
        });
      });
      c.globalAlpha = 1;

      // object
      if (R) {
        const rgb = P.blackbodyRGB(this.obj.T || 5772);
        c.fillStyle = `rgba(${rgb[0]},${rgb[1]},${rgb[2]},0.32)`;
        pathOf(geo.ring(R)); c.fill();
        c.strokeStyle = `rgb(${rgb[0]},${rgb[1]},${rgb[2]})`; c.lineWidth = 2.2 * dpr; c.stroke();
        const bottom = pt(0, 0);
        const g = c.createRadialGradient(bottom[0], bottom[1], 0, bottom[0], bottom[1], 10 * dpr);
        g.addColorStop(0, `rgba(${rgb[0]},${rgb[1]},${rgb[2]},1)`); g.addColorStop(1, `rgba(${rgb[0]},${rgb[1]},${rgb[2]},0)`);
        c.fillStyle = g; c.beginPath(); c.arc(bottom[0], bottom[1], 10 * dpr, 0, TAU); c.fill();
      } else {
        pathOf(geo.ring(1.0001)); c.closePath();
        c.fillStyle = '#000'; c.fill();
        c.strokeStyle = 'rgba(255,190,110,0.95)'; c.lineWidth = 2 * dpr; c.stroke();
      }

      // markers: where other objects' surfaces would sit on this same well
      c.font = `${11 * dpr}px ${tok.mono}`; c.textAlign = 'left';
      this.markers.forEach((m, mi) => {
        if (m.r <= 0 || Math.log10(m.r) > X_HI) return;
        const r = Math.max(m.r, 1.0001);
        if (R && r < R) return;
        c.strokeStyle = tok.muted; c.globalAlpha = 0.7; c.setLineDash([2 * dpr, 4 * dpr]); c.lineWidth = dpr;
        pathOf(geo.ring(r)); c.stroke(); c.setLineDash([]); c.globalAlpha = 1;
        const lp = pt(r, Math.PI / 2 + 0.35 + mi * 0.55);
        c.fillStyle = tok.muted; c.fillText(m.label, lp[0] + 4 * dpr, lp[1] + 12 * dpr);
      });

      // probe ring and clocks
      const rp = Math.pow(10, this.xProbe);
      const pulse = 0.6 + 0.4 * Math.sin(this.t * 3);
      c.strokeStyle = tok.fg; c.globalAlpha = 0.5 + 0.45 * pulse; c.lineWidth = 2.2 * dpr; c.setLineDash([6 * dpr, 5 * dpr]);
      pathOf(geo.ring(rp)); c.stroke(); c.setLineDash([]); c.globalAlpha = 1;
      const rt = rate(rp, R);
      this.clockA = (this.clockA || 0) + 0.06 * rt; this.clockB = (this.clockB || 0) + 0.06;
      const drawClock = (p, ang, label) => {
        c.fillStyle = '#ffffff'; c.beginPath(); c.arc(p[0], p[1], 7.5 * dpr, 0, TAU); c.fill();
        c.strokeStyle = '#222'; c.lineWidth = 1.2 * dpr; c.stroke();
        c.lineWidth = 1.6 * dpr; c.beginPath(); c.moveTo(p[0], p[1]); c.lineTo(p[0] + Math.sin(ang) * 6 * dpr, p[1] - Math.cos(ang) * 6 * dpr); c.stroke();
        c.fillStyle = tok.fg; c.textAlign = 'center'; c.fillText(label, p[0], p[1] - 13 * dpr);
      };
      drawClock(pt(rp, -0.7), this.clockA, 'probe clock');
      drawClock(pt(Math.pow(10, X_HI), -0.7), this.clockB, 'far clock');
    }

    stats() {
      const o = this.obj, R = this.Rrs, rp = Math.pow(10, this.xProbe);
      return { rs: this.rs, Rrs: R, r: rp, rate: rate(rp, R), surf: R ? rate(R, R) : 0, centre: R ? rate(0, R) : 0, vesc: R ? Math.sqrt(1 / Math.max(rp, R)) : Math.sqrt(1 / rp) };
    }
  }

  /* ---------- Two clocks falling into a black hole ----------
   * Free fall from rest at r0 = 10 rₛ. Units: rₛ and rₛ/c.
   * Far view: Schwarzschild coordinate time t (ignores light-travel delay).
   * Own view: proper time τ along the cycloid r = (r0/2)(1+cos η),
   *           τ = (r0/2)√(r0/rₛ)(η + sin η).
   */
  class ClockRace {
    constructor(canvas) {
      this.cv = canvas; this.ctx = canvas.getContext('2d'); this.t = 0; this.Msun = 10; this.visible = false; this.running = false;
      this.r0 = 10;
      this._solve();
      new ResizeObserver(() => this._resize()).observe(canvas);
      if ('IntersectionObserver' in global) new IntersectionObserver((e) => { this.visible = e[0].isIntersecting; if (this.visible) this.start(); }).observe(canvas);
      this._resize();
    }
    _solve() {
      const r0 = this.r0, A = Math.sqrt(1 - 1 / r0);
      // proper-time cycloid
      const etaH = Math.acos(2 / r0 - 1), k = (r0 / 2) * Math.sqrt(r0);
      this.tauH = k * (etaH + Math.sin(etaH)); this.tauS = k * Math.PI;
      // coordinate time: integrate dr/dt
      const T = [0], Rr = [r0 * (1 - 1e-9)], Tau = [0];
      let r = Rr[0], t = 0, tau = 0;
      while (r > 1 + 1e-7 && t < 400) {
        const drdtau = -Math.sqrt(Math.max(1e-30, 1 / r - 1 / r0));
        const dtdtau = A / (1 - 1 / r);
        const dtau = Math.min(0.05, (r - 1) * 0.02 + 1e-6);
        r += drdtau * dtau; tau += dtau; t += dtdtau * dtau;
        T.push(t); Rr.push(Math.max(r, 1)); Tau.push(tau);
      }
      this.T = T; this.Rr = Rr; this.Tau = Tau;
    }
    farAt(t) { // r and τ at coordinate time t
      const T = this.T; if (t >= T[T.length - 1]) return { r: this.Rr[T.length - 1], tau: this.Tau[T.length - 1] };
      let lo = 0, hi = T.length - 1; while (hi - lo > 1) { const m = (lo + hi) >> 1; if (T[m] < t) lo = m; else hi = m; }
      const f = (t - T[lo]) / (T[hi] - T[lo] || 1);
      return { r: this.Rr[lo] + (this.Rr[hi] - this.Rr[lo]) * f, tau: this.Tau[lo] + (this.Tau[hi] - this.Tau[lo]) * f };
    }
    ownAt(tau) { // r at proper time τ (solve η + sin η = τ / k)
      const k = (this.r0 / 2) * Math.sqrt(this.r0), target = Math.min(Math.PI, tau / k);
      let eta = target; for (let i = 0; i < 30; i++) { const f = eta + Math.sin(eta) - target, d = 1 + Math.cos(eta); eta -= f / Math.max(d, 1e-3); eta = Math.max(0, Math.min(Math.PI, eta)); }
      return (this.r0 / 2) * (1 + Math.cos(eta));
    }
    _resize() {
      const r = this.cv.getBoundingClientRect(), dpr = Math.min(global.devicePixelRatio || 1, 2);
      this.dpr = dpr; this.W = this.cv.width = Math.max(200, r.width * dpr | 0); this.H = this.cv.height = Math.max(160, r.height * dpr | 0);
      this.draw();
    }
    start() {
      if (this.running) return; this.running = true; let last = performance.now();
      const loop = (now) => {
        if (!this.visible || document.hidden) { this.running = false; return; }
        const dt = Math.min(0.05, (now - last) / 1000); last = now; this.t += dt * (reduceMotion ? 0.4 : 1);
        this.draw(); requestAnimationFrame(loop);
      };
      requestAnimationFrame(loop);
    }
    draw() {
      const c = this.ctx; if (!c) return;
      const W = this.W, H = this.H, dpr = this.dpr;
      c.clearRect(0, 0, W, H);
      if (!this._tok) { const cs = getComputedStyle(document.documentElement), g = (k) => cs.getPropertyValue(k).trim(); this._tok = { muted: g('--muted'), fg: g('--fg'), mono: g('--font-mono'), line: g('--line') }; }
      const { muted, fg, mono, line } = this._tok;
      const loop = 14, tt = this.t % loop;
      const unit = P.schwarzschildRadius(this.Msun * P.K.Msun) / P.K.c; // seconds per rₛ/c
      const fmtS = (x) => { const s = x * unit; return s < 1e-3 ? (s * 1e6).toFixed(0) + ' μs' : (s * 1e3).toFixed(2) + ' ms'; };
      const stacked = W / dpr < 620;
      const pw = stacked ? W : W / 2, ph = stacked ? H / 2 : H, pad = 12 * dpr;
      c.font = `${11 * dpr}px ${mono}`;
      const panel = (x0, y0, title, draw) => {
        c.strokeStyle = line; c.lineWidth = dpr; c.strokeRect(x0 + pad / 2, y0 + pad / 2, pw - pad, ph - pad);
        c.fillStyle = fg; c.textAlign = 'left'; c.font = `500 ${12 * dpr}px ${mono}`; c.fillText(title, x0 + pad, y0 + pad + 12 * dpr); c.font = `${11 * dpr}px ${mono}`;
        const k = (pw - pad * 3) / (this.r0 + 1.8), xStart = x0 + pad * 1.5 + k;
        const axis = (r) => xStart + r * k;
        const yA = y0 + ph * 0.4;
        const xh = axis(1), xc = axis(0), rad = xh - xc;
        c.fillStyle = '#000'; c.beginPath(); c.arc(xc, yA, rad, 0, TAU); c.fill();
        c.strokeStyle = 'rgba(255,210,150,0.9)'; c.lineWidth = 1.4 * dpr; c.stroke();
        c.strokeStyle = line; c.lineWidth = dpr; c.beginPath(); c.moveTo(xh, yA); c.lineTo(axis(this.r0), yA); c.stroke();
        c.fillStyle = muted; c.textAlign = 'center'; c.fillText('horizon', xh, yA + rad + 13 * dpr);
        c.fillText('10 rₛ', axis(this.r0), yA + 13 * dpr);
        draw(axis, yA, x0 + pad, y0 + ph - pad);
      };
      const clock = (x, y, ang, col) => {
        c.fillStyle = col; c.beginPath(); c.arc(x, y, 9 * dpr, 0, TAU); c.fill();
        c.strokeStyle = '#222'; c.lineWidth = 1.2 * dpr; c.stroke();
        c.strokeStyle = '#111'; c.lineWidth = 1.6 * dpr; c.beginPath(); c.moveTo(x, y); c.lineTo(x + Math.sin(ang) * 7 * dpr, y - Math.cos(ang) * 7 * dpr); c.stroke();
      };
      const lines = (x, yb, arr) => { c.textAlign = 'left'; arr.slice().reverse().forEach(([t, col], i) => { c.fillStyle = col; c.fillText(t, x, yb - i * 15 * dpr); }); };
      // far observer: coordinate time runs 0..~140 rₛ/c over the loop
      const tFar = Math.pow(tt / loop, 1.6) * 140;
      const far = this.farAt(tFar);
      panel(0, 0, 'Seen from far away', (axis, yA, xL, yB) => {
        const red = Math.sqrt(Math.max(0, 1 - 1 / far.r));
        c.globalAlpha = 0.2 + 0.8 * red;
        clock(axis(far.r), yA - 24 * dpr, far.tau * 0.6, `rgb(255,${Math.round(255 * red)},${Math.round(255 * red * red)})`);
        c.globalAlpha = 1;
        lines(xL, yB, [[`far-away time t = ${tFar.toFixed(1)} rₛ/c`, fg], [`falling clock shows τ = ${far.tau.toFixed(2)}`, fg], [far.r < 1.01 ? 'appears frozen at the horizon, fading red' : 'ticks slower, light reddens', muted]]);
      });
      const tauNow = Math.min(this.tauS, (tt / loop) * this.tauS * 1.12);
      const rOwn = this.ownAt(tauNow);
      panel(stacked ? 0 : pw, stacked ? ph : 0, 'The clock\'s own time', (axis, yA, xL, yB) => {
        if (tauNow < this.tauS) clock(axis(rOwn), yA - 24 * dpr, tauNow * 0.6, '#ffffff');
        lines(xL, yB, [[`own time τ = ${tauNow.toFixed(2)} rₛ/c (${fmtS(tauNow)})`, fg], [`crosses horizon at τ = ${this.tauH.toFixed(2)}`, fg],
          [tauNow >= this.tauS - 1e-6 ? `reaches r = 0 at τ = ${this.tauS.toFixed(2)} (${fmtS(this.tauS)})` : (rOwn < 1 ? 'inside: every path leads to r = 0' : 'nothing special happens at the horizon'), muted]]);
      });
    }
  }

  global.Spacetime = Spacetime;
  global.ClockRace = ClockRace;
  global.SpacetimeRate = rate;
})(window);
