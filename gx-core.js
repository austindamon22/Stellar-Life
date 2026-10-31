/* Galaxies — gx-core.js
 * Shared pieces: constants, seeded random numbers, 4x4 matrices, a WebGL point
 * renderer (additive glow, per-group visibility, disk rotation in the shader),
 * procedural galaxy generators (Milky Way model and Hubble types), and a CPU
 * splat renderer for small thumbnails.
 */
(function (global) {
  'use strict';
  const TAU = Math.PI * 2;

  const GX = {
    G_KPC: 4.30091e-6,        // G in kpc (km/s)^2 / M☉
    KPC_LY: 3261.56,          // light-years per kpc
    AU_PER_PC: 206264.806,
    C_KMS: 299792.458,
    LSUN_W: 3.828e26,
    MSUN_KG: 1.98847e30,
    YR_S: 3.15576e7,
    MYR_PER_KPC_KMS: 977.79,  // 1 kpc / (1 km/s) = 977.8 Myr
    R_SUN_GC: 8.2,            // kpc, Sun to Galactic Centre (GRAVITY 2019-21: 8.18-8.28)
    V_SUN: 230,               // km/s, circular speed at the Sun
  };

  function rng(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }
  function gauss(r) { const u = r() || 1e-9, v = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(TAU * v); }

  /* ---------- matrices (column-major, WebGL style) ---------- */
  const M4 = {
    persp(fovy, asp, n, f) { const t = 1 / Math.tan(fovy / 2), nf = 1 / (n - f); return [t / asp, 0, 0, 0, 0, t, 0, 0, 0, 0, (f + n) * nf, -1, 0, 0, 2 * f * n * nf, 0]; },
    lookAt(e, c, u) {
      const z = norm([e[0] - c[0], e[1] - c[1], e[2] - c[2]]), x = norm(cross(u, z)), y = cross(z, x);
      return [x[0], y[0], z[0], 0, x[1], y[1], z[1], 0, x[2], y[2], z[2], 0, -dot(x, e), -dot(y, e), -dot(z, e), 1];
    },
    mul(a, b) { const o = new Array(16); for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) { let s = 0; for (let k = 0; k < 4; k++) s += a[k * 4 + j] * b[i * 4 + k]; o[i * 4 + j] = s; } return o; },
    apply(m, p) { const x = p[0], y = p[1], z = p[2]; const w = m[3] * x + m[7] * y + m[11] * z + m[15]; return [(m[0] * x + m[4] * y + m[8] * z + m[12]) / w, (m[1] * x + m[5] * y + m[9] * z + m[13]) / w, w]; },
  };
  function cross(a, b) { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }
  function dot(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
  function norm(a) { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; }

  /* ---------- point cloud builder ---------- */
  class Cloud {
    constructor() { this.p = []; this.c = []; this.s = []; this.g = []; this.k = []; }
    add(x, y, z, col, size, group, kind) { this.p.push(x, y, z); this.c.push(col[0], col[1], col[2]); this.s.push(size); this.g.push(group); this.k.push(kind || 0); }
    get n() { return this.s.length; }
  }
  const mixc = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  const COL = {
    young: [0.62, 0.78, 1.0], blue: [0.75, 0.85, 1.0], white: [1.0, 0.97, 0.92],
    old: [1.0, 0.82, 0.55], red: [1.0, 0.62, 0.38], hii: [1.0, 0.38, 0.62], dm: [0.62, 0.45, 1.0], gc: [1.0, 0.88, 0.6],
  };
  // Population colours for "Population I vs II" mode
  const POP1 = [0.35, 0.65, 1.0], POP2 = [1.0, 0.45, 0.25];

  /* ---------- Milky Way model (kpc) ----------
   * Groups: 0 thin disk (old), 1 young disk / arms, 2 HII regions, 3 thick disk,
   * 4 bulge + bar, 5 stellar halo, 6 globular clusters, 7 dark-matter halo.
   * Kind 1 = rotates with the disk.
   */
  const ARMS = [
    { name: 'Perseus Arm', phi0: 0.35 },
    { name: 'Norma–Outer Arm', phi0: 0.35 + Math.PI / 2 },
    { name: 'Scutum–Centaurus Arm', phi0: 0.35 + Math.PI },
    { name: 'Sagittarius–Carina Arm', phi0: 0.35 + 3 * Math.PI / 2 },
  ];
  const PITCH = 13 * Math.PI / 180, ARM_R0 = 3.6, BAR_ANGLE = 27 * Math.PI / 180;
  const armPhi = (R, k) => ARMS[k].phi0 + Math.log(R / ARM_R0) / Math.tan(PITCH);
  function armDist(R, phi) {
    let best = 1e9, which = 0;
    for (let k = 0; k < ARMS.length; k++) {
      let d = (phi - armPhi(R, k)) % TAU; if (d > Math.PI) d -= TAU; if (d < -Math.PI) d += TAU;
      const s = Math.abs(d) * R; if (s < best) { best = s; which = k; }
    }
    return [best, which];
  }
  // Sun sits at (-R0, 0.02, 0); the bar's near end points toward positive longitude
  function milkyWay(scale) {
    const r = rng(42), cl = new Cloud(), f = scale || 1;
    const expR = (h, rmin, rmax) => { let R; do { R = -h * Math.log(1 - r() * 0.999); } while (R < rmin || R > rmax); return R; };
    // thin disk: old stars, mildly following the arms
    for (let i = 0; i < 38000 * f; i++) {
      const R = expR(2.6, 0.8, 16), phi = r() * TAU;
      const [d] = armDist(R, phi);
      if (r() > 0.45 + 0.55 * Math.exp(-(d * d) / (2 * 0.9 * 0.9))) { i--; continue; }
      const z = gauss(r) * 0.28;
      cl.add(R * Math.cos(phi), z, R * Math.sin(phi), mixc(COL.old, COL.white, r() * 0.4), 0.1 + r() * 0.1, 0, 1);
    }
    // young stars: tight on the arms
    for (let i = 0; i < 16000 * f; i++) {
      const R = expR(3.5, ARM_R0, 15.5), k = (r() * 4) | 0;
      const phi = armPhi(R, k) + gauss(r) * 0.42 / R;
      const z = gauss(r) * 0.09;
      cl.add(R * Math.cos(phi), z, R * Math.sin(phi), mixc(COL.young, COL.white, r() * 0.35), 0.1 + r() * 0.12, 1, 1);
    }
    // the local Orion Spur, between Sagittarius and Perseus near the Sun
    for (let i = 0; i < 1200 * f; i++) {
      const t = r(), R = 7.2 + 2.2 * t, phi = Math.PI - 0.25 + 0.5 * t + gauss(r) * 0.03;
      cl.add(R * Math.cos(phi), gauss(r) * 0.08, R * Math.sin(phi), COL.young, 0.1 + r() * 0.08, 1, 1);
    }
    // HII regions: pink star-forming knots on the arms
    for (let i = 0; i < 700 * f; i++) {
      const R = expR(4, ARM_R0 + 0.5, 14), k = (r() * 4) | 0, phi = armPhi(R, k) + gauss(r) * 0.15 / R;
      cl.add(R * Math.cos(phi), gauss(r) * 0.05, R * Math.sin(phi), COL.hii, 0.16 + r() * 0.14, 2, 1);
    }
    // thick disk
    for (let i = 0; i < 7000 * f; i++) {
      const R = expR(2.2, 0.8, 14), phi = r() * TAU;
      cl.add(R * Math.cos(phi), gauss(r) * 0.9, R * Math.sin(phi), mixc(COL.old, COL.red, r() * 0.4), 0.12 + r() * 0.06, 3, 1);
    }
    // bulge + bar: a boxy bar ~4.5 kpc half-length, 27° from the Sun–centre line
    const cb = Math.cos(BAR_ANGLE), sb = Math.sin(BAR_ANGLE);
    for (let i = 0; i < 9000 * f; i++) {
      let x, y, z;
      if (r() < 0.55) { x = gauss(r) * 1.6; y = gauss(r) * 0.45; z = gauss(r) * 0.5; if (Math.abs(x) > 4.5) { i--; continue; } }
      else { const a = 0.55, u = r(), rr = a * Math.sqrt(u) / (1 - Math.sqrt(u)); if (rr > 3) { i--; continue; } const th = Math.acos(2 * r() - 1), ph = r() * TAU; x = rr * Math.sin(th) * Math.cos(ph); y = rr * Math.cos(th) * 0.75; z = rr * Math.sin(th) * Math.sin(ph); }
      // rotate bar: long axis points from the centre toward the near side at +27°
      const X = x * -cb - z * sb, Z = x * sb - z * cb;
      cl.add(X, y, Z, mixc(COL.old, COL.red, 0.3 + r() * 0.5), 0.1 + r() * 0.1, 4, 1);
    }
    // unresolved starlight: dim, wide points that give the disk and bulge a smooth glow
    for (let i = 0; i < 9000 * f; i++) {
      const R = expR(2.6, 0.3, 15), phi = r() * TAU, [d] = armDist(R, phi);
      const k = 0.05 + 0.05 * Math.exp(-(d * d) / 0.8);
      cl.add(R * Math.cos(phi), gauss(r) * 0.25, R * Math.sin(phi), mixc(COL.old, COL.young, Math.exp(-(d * d) / 0.8) * 0.6).map((v) => v * k), 0.8 + r() * 0.6, 0, 1);
    }
    for (let i = 0; i < 2500 * f; i++) {
      const p = [gauss(r) * 1.1, gauss(r) * 0.5, gauss(r) * 0.9];
      cl.add(p[0] * -Math.cos(BAR_ANGLE) - p[2] * Math.sin(BAR_ANGLE), p[1], p[0] * Math.sin(BAR_ANGLE) - p[2] * Math.cos(BAR_ANGLE), COL.old.map((v) => v * 0.22), 0.7 + r() * 0.5, 4, 1);
    }
    // stellar halo: density ∝ r^-3.5 between 1 and 60 kpc
    const hs = (r1, r2) => { const a = Math.pow(r1, -0.5), b = Math.pow(r2, -0.5); return Math.pow(a - r() * (a - b), -2); };
    const sph = (rr) => { const th = Math.acos(2 * r() - 1), ph = r() * TAU; return [rr * Math.sin(th) * Math.cos(ph), rr * Math.cos(th), rr * Math.sin(th) * Math.sin(ph)]; };
    for (let i = 0; i < 3500 * f; i++) { const p = sph(hs(1.5, 60)); cl.add(p[0], p[1], p[2], COL.red, 0.15 + r() * 0.1, 5, 0); }
    // ~150 globular clusters
    for (let i = 0; i < 150; i++) { const p = sph(hs(0.8, 40)); cl.add(p[0], p[1], p[2], COL.gc, 0.35 + r() * 0.25, 6, 0); }
    // dark-matter halo (NFW-like, out to ~200 kpc; shown faint)
    for (let i = 0; i < 9000 * f; i++) {
      const rs = 16; let rr; do { const u = r(); rr = rs * u / (1 - u) * 1.2; } while (rr > 220 || rr < 0.5);
      const p = sph(rr); cl.add(p[0], p[1], p[2], COL.dm, 2.5 + r() * 3, 7, 0);
    }
    return cl;
  }
  milkyWay.ARMS = ARMS; milkyWay.armPhi = armPhi; milkyWay.ARM_R0 = ARM_R0; milkyWay.BAR_ANGLE = BAR_ANGLE;
  milkyWay.GROUPS = ['Thin disk (old stars)', 'Young stars on the arms', 'Star-forming nebulae', 'Thick disk', 'Bulge and bar', 'Stellar halo', 'Globular clusters', 'Dark-matter halo'];
  milkyWay.POP = [1, 1, 1, 2, 2, 2, 2, 0];    // stellar population of each group (0 = not stars)

  /* ---------- Hubble types (unit radius ~1) ----------
   * type: E0..E7 ('E', n), 'S0', 'Sa','Sb','Sc', 'SBa','SBb','SBc', 'Irr'
   */
  function galaxyType(type, seed, N) {
    const r = rng(seed || 7), cl = new Cloud(); N = N || 9000;
    const sph = (rr) => { const th = Math.acos(2 * r() - 1), ph = r() * TAU; return [rr * Math.sin(th) * Math.cos(ph), rr * Math.cos(th), rr * Math.sin(th) * Math.sin(ph)]; };
    const hern = (a, max) => { let rr; do { const u = r(); rr = a * Math.sqrt(u) / (1 - Math.sqrt(u)); } while (rr > max); return rr; };
    if (type[0] === 'E') {
      const n = +type.slice(1) || 0, q = 1 - n / 10;   // apparent axis ratio b/a
      for (let i = 0; i < N; i++) { const p = sph(hern(0.22, 1.3)); cl.add(p[0], p[1] * q, p[2] * q, mixc(COL.old, COL.red, r() * 0.5), 0.012, 0, 0); }
      return cl;
    }
    if (type === 'Irr') {
      const blobs = Array.from({ length: 7 }, () => [gauss(r) * 0.35, gauss(r) * 0.12, gauss(r) * 0.3, 0.1 + r() * 0.2]);
      for (let i = 0; i < N; i++) {
        const b = blobs[(r() * blobs.length) | 0];
        cl.add(b[0] + gauss(r) * b[3], b[1] + gauss(r) * b[3] * 0.4, b[2] + gauss(r) * b[3], r() < 0.6 ? mixc(COL.young, COL.white, r() * 0.5) : COL.old, 0.012, 0, 1);
        if (r() < 0.04) cl.add(b[0] + gauss(r) * b[3], 0, b[2] + gauss(r) * b[3], COL.hii, 0.03, 0, 1);
      }
      return cl;
    }
    const barred = type.startsWith('SB'), sub = type.slice(-1);
    const bulgeA = type === 'S0' ? 0.16 : { a: 0.15, b: 0.09, c: 0.05 }[sub];
    const bulgeFrac = type === 'S0' ? 0.45 : { a: 0.4, b: 0.25, c: 0.12 }[sub];
    const pitch = { a: 9, b: 15, c: 24 }[sub] * Math.PI / 180;
    const youngFrac = type === 'S0' ? 0 : { a: 0.25, b: 0.4, c: 0.55 }[sub];
    const r0 = barred ? 0.32 : 0.15, nArms = 2;
    for (let i = 0; i < N; i++) {
      const u = r();
      if (u < bulgeFrac) { const p = sph(hern(bulgeA, 0.6)); cl.add(p[0], p[1] * 0.8, p[2], mixc(COL.old, COL.red, r() * 0.4), 0.012, 0, 1); continue; }
      if (barred && u < bulgeFrac + 0.2) { cl.add((r() * 2 - 1) * r0 * 1.05, gauss(r) * 0.03, gauss(r) * 0.045, mixc(COL.old, COL.white, r() * 0.3), 0.012, 0, 1); continue; }
      let R; do { R = -0.28 * Math.log(1 - r()); } while (R > 1.2 || R < 0.05);
      let phi;
      const young = r() < youngFrac;
      if (type !== 'S0' && (young || r() < 0.55) && R > r0 * 0.9) {
        const k = (r() * nArms) | 0;
        phi = k * Math.PI + Math.log(R / r0) / Math.tan(pitch) + gauss(r) * (young ? 0.05 : 0.14) / Math.max(R, 0.2);
      } else phi = r() * TAU;
      const col = young ? mixc(COL.young, COL.white, r() * 0.4) : mixc(COL.old, COL.white, r() * 0.3);
      cl.add(R * Math.cos(phi), gauss(r) * 0.025, R * Math.sin(phi), col, 0.012, 0, 1);
      if (young && r() < 0.05 && sub !== 'a') cl.add(R * Math.cos(phi), 0, R * Math.sin(phi), COL.hii, 0.03, 0, 1);
    }
    return cl;
  }

  /* ---------- CPU splat renderer for thumbnails ----------
   * opts: { tilt (rad, 0 = face-on), rot (rad in-plane), roll (rad on sky), zoom }
   */
  function splat(canvas, cloud, opts) {
    const W = canvas.width, H = canvas.height, o = Object.assign({ tilt: 0.5, rot: 0, roll: 0, zoom: 1, gain: 1 }, opts);
    const acc = new Float32Array(W * H * 3);
    const ct = Math.cos(o.tilt), st = Math.sin(o.tilt), cr = Math.cos(o.rot), sr = Math.sin(o.rot), cq = Math.cos(o.roll), sq = Math.sin(o.roll);
    const sc = Math.min(W, H) * 0.42 * o.zoom;
    const P = cloud.p, C = cloud.c, n = cloud.n;
    for (let i = 0; i < n; i++) {
      let x = P[i * 3], y = P[i * 3 + 1], z = P[i * 3 + 2];
      const x1 = x * cr - z * sr, z1 = x * sr + z * cr;           // spin in the disk plane
      const y2 = y * ct - z1 * st;                                  // tilt about the x axis
      const X = x1 * cq - y2 * sq, Y = x1 * sq + y2 * cq;          // roll on the sky
      const px = W / 2 + X * sc, py = H / 2 - Y * sc;
      const ix = px | 0, iy = py | 0;
      if (ix < 1 || iy < 1 || ix >= W - 1 || iy >= H - 1) continue;
      const w = cloud.s[i] > 0.02 ? 2.2 : 0.55;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const k = ((iy + dy) * W + ix + dx) * 3, ww = (dx || dy) ? w * 0.35 : w;
        acc[k] += C[i * 3] * ww; acc[k + 1] += C[i * 3 + 1] * ww; acc[k + 2] += C[i * 3 + 2] * ww;
      }
    }
    const ctx = canvas.getContext('2d'), img = ctx.createImageData(W, H), d = img.data;
    const g = o.gain * 0.9;
    for (let i = 0; i < W * H; i++) {
      for (let c = 0; c < 3; c++) d[i * 4 + c] = 255 * (1 - Math.exp(-acc[i * 3 + c] * g));
      d[i * 4 + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
  }

  /* ---------- WebGL point renderer ---------- */
  const VS = `
attribute vec3 aP; attribute vec3 aC; attribute float aS; attribute float aG; attribute float aK;
uniform mat4 uMVP; uniform float uScale, uT, uWind, uPopMode, uMax;
uniform float uVis[8]; uniform float uPop[8];
varying vec3 vC; varying float vA;
void main(){
  int g = int(aG + 0.5);
  float vis = 0.0, pop = 0.0;
  for (int i = 0; i < 8; i++) { if (i == g) { vis = uVis[i]; pop = uPop[i]; } }
  vec3 p = aP;
  if (aK > 0.5) {
    float R = length(p.xz);
    // flat rotation curve: angular speed ∝ 1/R (stars) vs rigid pattern speed (arms)
    float om = uWind > 0.5 ? 1.0 / max(R, 0.4) : 0.06;
    float a = -uT * om;
    float c = cos(a), s = sin(a);
    p.xz = vec2(c * p.x - s * p.z, s * p.x + c * p.z);
  }
  vec4 q = uMVP * vec4(p, 1.0);
  gl_Position = vis > 0.5 ? q : vec4(2.0, 2.0, 2.0, 1.0);
  float sz = aS * uScale / max(q.w, 0.01);
  gl_PointSize = clamp(sz, 1.0, uMax);
  vec3 col = aC;
  if (uPopMode > 0.5 && pop > 0.5) col = pop < 1.5 ? vec3(0.35, 0.65, 1.0) : vec3(1.0, 0.45, 0.25);
  vC = col;
  // keep total light roughly fixed: tiny points get dimmer, clamped big points too
  float shown = clamp(sz, 1.0, uMax);
  vA = (g == 7 ? 0.22 : 0.32) * min(1.0, sz * sz / (shown * shown) + 0.15) * min(1.0, 0.35 + sz * 0.25);
}`;
  const FS = `
precision mediump float;
varying vec3 vC; varying float vA;
void main(){
  vec2 d = gl_PointCoord - 0.5;
  float r = dot(d, d) * 4.0;
  float a = exp(-r * 3.5) * vA;
  gl_FragColor = vec4(vC * a, a);
}`;
  class PointGL {
    constructor(canvas) {
      this.c = canvas;
      const gl = canvas.getContext('webgl', { antialias: false, premultipliedAlpha: true, alpha: true });
      this.ok = !!gl; if (!gl) return;
      this.gl = gl;
      const sh = (t, s) => { const o = gl.createShader(t); gl.shaderSource(o, s); gl.compileShader(o); if (!gl.getShaderParameter(o, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(o)); return o; };
      try {
        const p = gl.createProgram(); gl.attachShader(p, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(p, sh(gl.FRAGMENT_SHADER, FS));
        ['aP', 'aC', 'aS', 'aG', 'aK'].forEach((a, i) => gl.bindAttribLocation(p, i, a));
        gl.linkProgram(p); if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
        this.p = p;
      } catch (e) { console.warn('Galaxy shader failed:', e.message); this.ok = false; return; }
      this.u = {}; const n = gl.getProgramParameter(this.p, gl.ACTIVE_UNIFORMS);
      for (let i = 0; i < n; i++) { const a = gl.getActiveUniform(this.p, i); this.u[a.name.replace('[0]', '')] = gl.getUniformLocation(this.p, a.name); }
      this.bufs = [0, 1, 2, 3, 4].map(() => gl.createBuffer());
      this.n = 0;
    }
    setCloud(cl) {
      const gl = this.gl, data = [[cl.p, 3], [cl.c, 3], [cl.s, 1], [cl.g, 1], [cl.k, 1]];
      data.forEach(([arr, sz], i) => { gl.bindBuffer(gl.ARRAY_BUFFER, this.bufs[i]); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(arr), gl.STATIC_DRAW); });
      this.n = cl.n;
    }
    draw(mvp, o) {
      const gl = this.gl, c = this.c;
      gl.viewport(0, 0, c.width, c.height);
      gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
      gl.useProgram(this.p);
      [3, 3, 1, 1, 1].forEach((sz, i) => { gl.bindBuffer(gl.ARRAY_BUFFER, this.bufs[i]); gl.enableVertexAttribArray(i); gl.vertexAttribPointer(i, sz, gl.FLOAT, false, 0, 0); });
      gl.uniformMatrix4fv(this.u.uMVP, false, new Float32Array(mvp));
      gl.uniform1f(this.u.uScale, o.scale); gl.uniform1f(this.u.uMax, o.max || 40); gl.uniform1f(this.u.uT, o.t); gl.uniform1f(this.u.uWind, o.wind ? 1 : 0); gl.uniform1f(this.u.uPopMode, o.pop ? 1 : 0);
      gl.uniform1fv(this.u.uVis, new Float32Array(o.vis)); gl.uniform1fv(this.u.uPop, new Float32Array(o.popOf));
      gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE); gl.disable(gl.DEPTH_TEST);
      gl.drawArrays(gl.POINTS, 0, this.n);
    }
  }

  global.GX = Object.assign(GX, { TAU, rng, gauss, M4, cross, dot, norm, Cloud, COL, milkyWay, galaxyType, splat, PointGL, mixc });
})(window);
