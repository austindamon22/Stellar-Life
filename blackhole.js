/* Stellar Life — blackhole.js
 * "Black hole camera": a real-time ray tracer for a non-spinning
 * (Schwarzschild) black hole with a thin accretion disk.
 *
 * Physics (units: rₛ = 1, c = 1, so M = 1/2):
 *  - Photons are traced backwards from the camera. Each null geodesic
 *    stays in a plane, and its shape obeys u'' + u = (3/2) u^2 (u = 1/r).
 *    In Cartesian form that is x'' = -(3/2) h^2 x / r^5 with h = |x × x'|,
 *    which reproduces the exact Schwarzschild orbit shape.
 *  - The camera is a static observer at r0. A pixel's local angle α from
 *    the radial direction maps to impact parameter b = r0 sin α / √(1 − 1/r0).
 *    The integrator's starting direction is chosen to give exactly that b,
 *    so the shadow edge lands at sin α = (3√3/2) √(1 − 1/r0) / r0.
 *  - Disk: thin, Keplerian, inner edge at the ISCO (3 rₛ) by default.
 *    Temperature follows Shakura–Sunyaev with a zero-torque inner edge,
 *    T ∝ r^(−3/4) (1 − √(r_in/r))^(1/4).
 *  - Frequency shift g = ν_obs/ν_emit = √(1 − 1.5/r) / [(1 − Ω L_y) √(1 − 1/r0)],
 *    Ω = √(M/r³). Observed intensity ∝ g⁴ T⁴ (I/ν³ is invariant), colour from g·T.
 *    Temperatures are mapped into visible colours so differences show.
 */
(function (global) {
  'use strict';

  const VS = 'attribute vec2 p; void main(){ gl_Position = vec4(p, 0.0, 1.0); }';

  const FS_TRACE = `
precision highp float;
uniform vec2 R;
uniform vec3 cam, fw, rt, up;
uniform float tf, rin, rout, tm, dopp, grav, sky, disk, hl;

float hash(vec3 p){ p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float noise(vec3 x){
  vec3 i = floor(x); vec3 f = fract(x); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(hash(i), hash(i + vec3(1,0,0)), f.x), mix(hash(i + vec3(0,1,0)), hash(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(hash(i + vec3(0,0,1)), hash(i + vec3(1,0,1)), f.x), mix(hash(i + vec3(0,1,1)), hash(i + vec3(1,1,1)), f.x), f.y), f.z);
}
float fbm(vec3 x){ return 0.55 * noise(x) + 0.28 * noise(x * 2.03) + 0.17 * noise(x * 4.11); }

// Blackbody colour (fit, 1000-40000 K), unit peak
vec3 bb(float T){
  T = clamp(T, 1000.0, 40000.0) / 100.0;
  float r = T <= 66.0 ? 1.0 : clamp(1.292936 * pow(T - 60.0, -0.1332047), 0.0, 1.0);
  float g = T <= 66.0 ? clamp(0.3900816 * log(T) - 0.6318414, 0.0, 1.0) : clamp(1.1298909 * pow(T - 60.0, -0.0755148), 0.0, 1.0);
  float b = T >= 66.0 ? 1.0 : (T <= 19.0 ? 0.0 : clamp(0.5432068 * log(T - 10.0) - 1.1962541, 0.0, 1.0));
  return vec3(r, g, b);
}

// Disk palette: temperature (relative to the disk's peak, times g) mapped to visible colour.
// Cooler / redshifted = deep red, peak = gold, blueshifted = white then blue-white.
vec3 heat(float t){
  vec3 c = mix(vec3(0.55, 0.06, 0.02), vec3(1.0, 0.42, 0.08), smoothstep(0.3, 0.8, t));
  c = mix(c, vec3(1.0, 0.74, 0.32), smoothstep(0.8, 1.15, t));
  c = mix(c, vec3(1.0, 0.96, 0.88), smoothstep(1.15, 1.6, t));
  return mix(c, vec3(0.72, 0.84, 1.0), smoothstep(1.6, 2.4, t));
}

vec3 starLayer(vec3 d, float n, float thr, float size){
  vec3 c = floor(d * n);
  float h = hash(c);
  if (h < thr) return vec3(0.0);
  vec3 sp = (c + 0.5 + 0.35 * (vec3(hash(c + 1.7), hash(c + 3.1), hash(c + 5.3)) - 0.5)) / n;
  float dist = length(normalize(sp) - d);
  float k = exp(-dist * dist / (size * size));
  return k * bb(3000.0 + 9000.0 * hash(c + 9.1)) * (0.5 + 2.0 * (h - thr) / (1.0 - thr));
}

vec3 skyCol(vec3 d){
  if (sky > 1.5) return vec3(0.0);
  if (sky > 0.5) {
    // Lat-long grid: lensing shows as bent, stretched squares
    float th = acos(clamp(d.y, -1.0, 1.0));
    float ph = atan(d.z, d.x);
    float s = 3.14159265 / 12.0;
    float chk = mod(floor(th / s) + floor(ph / s), 2.0);
    vec3 base = d.y > 0.0 ? vec3(0.32, 0.20, 0.10) : vec3(0.10, 0.18, 0.32);
    vec2 q = abs(fract(vec2(th, ph) / s) - 0.5);
    float line = smoothstep(0.47, 0.5, max(q.x, q.y));
    return base * (0.55 + 0.45 * chk) + line * 0.25;
  }
  vec3 n = normalize(vec3(0.3, 1.0, 0.25));
  float band = exp(-pow(dot(d, n) / 0.2, 2.0));
  vec3 mw = band * (0.35 + 0.65 * fbm(d * 5.0)) * vec3(0.16, 0.14, 0.19);
  return mw + starLayer(d, 60.0, 0.985, 0.0045) + 0.7 * starLayer(d, 150.0, 0.988, 0.0028);
}

void main(){
  vec2 uv = (gl_FragCoord.xy - 0.5 * R) / (0.5 * R.y);
  vec3 d = normalize(fw + uv.x * tf * rt + uv.y * tf * up);
  vec3 x = cam;
  float r0 = length(x);
  vec3 rh = x / r0;
  // Local direction (static observer) -> integrator direction with the same impact parameter
  float dr = dot(d, rh);
  vec3 dt = d - dr * rh;
  float s = length(dt);
  float se = min(s / sqrt(max(1.0 - dr * dr / r0, 1e-6)), 1.0);
  vec3 tdir = s > 1e-7 ? dt / s : vec3(0.0);
  vec3 v = (dr >= 0.0 ? 1.0 : -1.0) * sqrt(max(1.0 - se * se, 0.0)) * rh + se * tdir;
  vec3 hv = cross(x, v);
  float h2 = dot(hv, hv);
  float bimp = se > 1e-6 ? 1.0 / sqrt(max(1.0 / (r0 * r0 * se * se) - 1.0 / (r0 * r0 * r0), 1e-9)) : 0.0;
  float Ly = h2 > 1e-12 ? -hv.y * bimp / sqrt(h2) : 0.0;   // photon's angular momentum about the disk axis (forward in time)
  float camRed = grav > 0.5 ? sqrt(1.0 - 1.0 / r0) : 1.0;

  vec3 col = vec3(0.0);
  float tr = 1.0;
  float nCross = 0.0;
  bool cap = false;
  bool esc = false;
  float rEsc = max(r0 * 1.25, 40.0);
  for (int i = 0; i < 600; i++) {
    float r = length(x);
    if (r < 1.0) { cap = true; break; }
    if (r > rEsc && dot(x, v) > 0.0) { esc = true; break; }
    float dl = clamp(0.04 * r, 0.008, 2.5);
    vec3 a = -1.5 * h2 * x / (r * r * r * r * r);
    vec3 xn = x + v * dl + 0.5 * a * dl * dl;
    float rn = length(xn);
    vec3 an = -1.5 * h2 * xn / (rn * rn * rn * rn * rn);
    vec3 vn = v + 0.5 * (a + an) * dl;
    if (x.y * xn.y < 0.0) {
      float t = x.y / (x.y - xn.y);
      vec3 p = mix(x, xn, t);
      float rr = length(p.xz);
      if (disk > 0.5 && rr > rin && rr < rout) {
        float Om = sqrt(0.5 / (rr * rr * rr));
        float gD = dopp > 0.5 ? sqrt(1.0 - 1.5 / rr) / (sqrt(1.0 - 1.0 / rr) * (1.0 - Om * Ly)) : 1.0;
        float gG = grav > 0.5 ? sqrt(1.0 - 1.0 / rr) / camRed : 1.0;
        float g = gD * gG;
        float xr = rr / rin;
        float fT = pow(xr, -0.75) * pow(max(1.0 - 1.0 / sqrt(xr), 0.0), 0.25) / 0.488;
        float ph = atan(p.z, p.x) + tm * Om * 0.9;
        float tex = 0.45 + 0.55 * fbm(vec3(cos(ph) * 2.2, sin(ph) * 2.2, log(rr) * 9.0));
        tex *= 0.88 + 0.12 * sin(log(rr) * 30.0 + tex * 4.0);
        float alpha = 0.92 * smoothstep(rin, rin * 1.04, rr) * (1.0 - smoothstep(rout * 0.75, rout, rr));
        vec3 em;
        if (hl > 0.5 && hl < 1.5) {
          vec3 pc = nCross < 0.5 ? vec3(1.0, 0.62, 0.22) : (nCross < 1.5 ? vec3(0.25, 0.85, 1.0) : vec3(1.0, 0.35, 0.95));
          em = pc * (0.55 + 0.6 * tex) * (nCross < 0.5 ? 1.0 : 1.6);
        } else {
          float gT = g * fT;
          em = heat(gT) * pow(gT, 4.0) * tex * 1.3;
          if (hl > 1.5 && hl < 2.5) {
            bool far = dot(p.xz, cam.xz) < 0.0;
            em = (far ? vec3(0.3, 0.75, 1.0) : vec3(1.0, 0.6, 0.25)) * (0.35 + 0.65 * tex) * (0.5 + 0.5 * min(pow(gT, 2.0), 2.0));
          }
          if (hl > 2.5 && rr < rin * 1.12) em = mix(em, vec3(0.35, 1.0, 0.6) * 1.6, 0.85);
        }
        col += tr * alpha * em;
        tr *= 1.0 - alpha;
      }
      nCross += 1.0;
    }
    x = xn; v = vn;
    if (tr < 0.02) break;
  }
  vec3 bg = (cap || !esc) ? vec3(0.0) : skyCol(normalize(v));
  col += tr * bg;
  // Tone map on luminance so colours stay saturated; the hottest parts burn toward white
  float L = dot(col, vec3(0.2126, 0.7152, 0.0722));
  vec3 m = col * (1.0 - exp(-L * 1.3)) / max(L, 1e-4);
  col = clamp(mix(m, vec3(1.0), smoothstep(1.2, 5.0, L) * 0.6), 0.0, 1.0);
  gl_FragColor = vec4(pow(col, vec3(0.92)), 1.0);
}`;

  const FS_SHOW = `
precision highp float;
uniform sampler2D T;
uniform vec2 R2, TR;
uniform float eht, sig;
vec3 afmhot(float x){ return clamp(vec3(2.0 * x, 2.0 * x - 0.5, 2.0 * x - 1.0), 0.0, 1.0); }
void main(){
  vec2 uv = gl_FragCoord.xy / R2;
  if (eht < 0.5) { gl_FragColor = vec4(texture2D(T, uv).rgb, 1.0); return; }
  // Blur to the EHT's resolution (beam FWHM ~ half the ring diameter), then false colour
  float acc = 0.0, wsum = 0.0;
  for (int i = -4; i <= 4; i++) for (int j = -4; j <= 4; j++) {
    vec2 o = vec2(float(i), float(j)) * 0.5;          // in units of sigma
    float w = exp(-0.5 * dot(o, o));
    vec3 c = texture2D(T, uv + o * sig / TR).rgb;
    acc += w * dot(c, vec3(0.3, 0.59, 0.11)); wsum += w;
  }
  gl_FragColor = vec4(afmhot(2.1 * acc / wsum), 1.0);
}`;

  function compile(gl, type, src) {
    const s = gl.createShader(type);
    gl.shaderSource(s, src); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
    return s;
  }
  function program(gl, fs) {
    const p = gl.createProgram();
    gl.attachShader(p, compile(gl, gl.VERTEX_SHADER, VS));
    gl.attachShader(p, compile(gl, gl.FRAGMENT_SHADER, fs));
    gl.bindAttribLocation(p, 0, 'p');
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
    const u = {};
    const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
    for (let i = 0; i < n; i++) { const a = gl.getActiveUniform(p, i); u[a.name] = gl.getUniformLocation(p, a.name); }
    return { p, u };
  }

  /* Exact angular radius of the shadow for a static observer at r0 (units rₛ) */
  const B_CRIT = 1.5 * Math.sqrt(3);                       // 2.598 rₛ
  const shadowAngle = (r0) => Math.asin(Math.min(1, B_CRIT * Math.sqrt(1 - 1 / r0) / r0));

  class BlackHoleView {
    constructor(canvas, overlay) {
      this.c = canvas; this.ov = overlay;
      this.s = { incl: 80, az: -90, dist: 26, rin: 3, rout: 12, dopp: true, grav: true, sky: false, disk: true, eht: false, labels: false, spin: true, hl: 0 };
      this.scale = (matchMedia('(pointer: coarse)').matches || innerWidth < 700) ? 0.35 : 0.5; this.t = 0; this.running = false; this.dirty = true; this.dragging = false;
      const gl = canvas.getContext('webgl', { antialias: false, preserveDrawingBuffer: false, alpha: false });
      if (!gl) { this.ok = false; return; }
      this.gl = gl;
      try {
        this.trace = program(gl, FS_TRACE);
        this.show = program(gl, FS_SHOW);
      } catch (e) { console.warn('Black hole shader failed:', e.message); this.ok = false; return; }
      this.ok = true;
      const buf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
      gl.enableVertexAttribArray(0);
      gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
      this.tex = gl.createTexture(); this.fbo = gl.createFramebuffer(); this.tw = 0; this.th = 0;
      this._pointer();
      canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); this.ok = false; });
    }

    set(patch) { Object.assign(this.s, patch); this.dirty = true; if (!this.running) this.frame(true); }

    camera() {
      const s = this.s, i = s.incl * Math.PI / 180, a = s.az * Math.PI / 180;
      const pos = [s.dist * Math.sin(i) * Math.cos(a), s.dist * Math.cos(i), s.dist * Math.sin(i) * Math.sin(a)];
      const fw = pos.map((v) => -v / s.dist);
      // world up = +y, but near face-on use the azimuth direction to stay stable
      let wu = [0, 1, 0];
      if (Math.abs(fw[1]) > 0.995) wu = [-Math.cos(a), 0, -Math.sin(a)];
      const cr = (u, v) => [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
      const nz = (v) => { const l = Math.hypot(...v); return v.map((x) => x / l); };
      const rt = nz(cr(fw, wu)), up = cr(rt, fw);
      const tf = Math.min(1.0, 1.18 * Math.max(s.rout, 7) / s.dist);
      return { pos, fw, rt, up, tf };
    }

    _size() {
      const r = this.c.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      const sc = this.dragging ? Math.min(this.scale, 0.5) : this.scale;
      const w = Math.max(64, Math.round(r.width * dpr * sc)), h = Math.max(48, Math.round(r.height * dpr * sc));
      const dw = Math.round(r.width * dpr), dh = Math.round(r.height * dpr);
      if (this.c.width !== dw || this.c.height !== dh) { this.c.width = dw; this.c.height = dh; }
      if (this.ov) { const ow = Math.round(r.width * Math.min(window.devicePixelRatio || 1, 2)), oh = Math.round(r.height * Math.min(window.devicePixelRatio || 1, 2)); if (this.ov.width !== ow || this.ov.height !== oh) { this.ov.width = ow; this.ov.height = oh; } }
      if (w !== this.tw || h !== this.th) {
        const gl = this.gl;
        this.tw = w; this.th = h;
        gl.bindTexture(gl.TEXTURE_2D, this.tex);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbo);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.tex, 0);
      }
    }

    render() {
      if (!this.ok) return;
      const gl = this.gl, s = this.s, cam = this.camera();
      this._size();
      // Pass 1: trace into a texture at render scale
      gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbo);
      gl.viewport(0, 0, this.tw, this.th);
      const T = this.trace; gl.useProgram(T.p);
      gl.uniform2f(T.u.R, this.tw, this.th);
      gl.uniform3fv(T.u.cam, cam.pos); gl.uniform3fv(T.u.fw, cam.fw); gl.uniform3fv(T.u.rt, cam.rt); gl.uniform3fv(T.u.up, cam.up);
      gl.uniform1f(T.u.tf, cam.tf); gl.uniform1f(T.u.rin, s.rin); gl.uniform1f(T.u.rout, s.rout); gl.uniform1f(T.u.tm, this.t);
      gl.uniform1f(T.u.dopp, s.dopp ? 1 : 0); gl.uniform1f(T.u.grav, s.grav ? 1 : 0); gl.uniform1f(T.u.sky, s.eht ? 2 : s.sky ? 1 : 0);
      gl.uniform1f(T.u.disk, s.disk ? 1 : 0); gl.uniform1f(T.u.hl, s.hl);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      // Pass 2: show (optionally blurred to EHT resolution)
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(0, 0, this.c.width, this.c.height);
      const S = this.show; gl.useProgram(S.p);
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, this.tex);
      gl.uniform1i(S.u.T, 0);
      gl.uniform2f(S.u.R2, this.c.width, this.c.height); gl.uniform2f(S.u.TR, this.tw, this.th);
      const shPx = Math.tan(shadowAngle(s.dist)) / cam.tf * this.th / 2;   // shadow radius in texture pixels
      gl.uniform1f(S.u.eht, s.eht ? 1 : 0); gl.uniform1f(S.u.sig, 0.425 * shPx);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      this._overlay(cam);
      this.dirty = false;
    }

    _overlay(cam) {
      const o = this.ov; if (!o) return;
      const x = o.getContext('2d'), W = o.width, H = o.height, k = W / (this.c.getBoundingClientRect().width || 1);
      x.clearRect(0, 0, W, H);
      if (!this.s.labels) return;
      const px = (ang) => Math.tan(ang) / cam.tf * H / 2;
      const cx = W / 2, cy = H / 2, rSh = px(shadowAngle(this.s.dist)), rHz = px(Math.asin(1 / this.s.dist));
      x.lineWidth = 1.5 * k; x.font = `${12 * k}px system-ui, sans-serif`; x.textBaseline = 'middle';
      x.setLineDash([5 * k, 4 * k]); x.strokeStyle = 'rgba(255,255,255,0.85)';
      x.beginPath(); x.arc(cx, cy, rSh, 0, Math.PI * 2); x.stroke();
      x.setLineDash([]); x.strokeStyle = 'rgba(120,230,170,0.95)';
      x.beginPath(); x.arc(cx, cy, rHz, 0, Math.PI * 2); x.stroke();
      const tag = (txt, tx, ty, col, align) => {
        x.textAlign = align; const w = x.measureText(txt).width, p = 4 * k;
        const bx = align === 'left' ? tx - p : tx - w - p;
        x.fillStyle = 'rgba(8,10,20,0.72)'; x.fillRect(bx, ty - 9 * k, w + 2 * p, 18 * k);
        x.fillStyle = col; x.fillText(txt, tx, ty);
      };
      const ang = -0.78;
      const ex = cx + rSh * Math.cos(ang), ey = cy + rSh * Math.sin(ang);
      x.strokeStyle = 'rgba(255,255,255,0.6)'; x.beginPath(); x.moveTo(ex, ey); x.lineTo(ex + 26 * k, ey - 26 * k); x.stroke();
      tag('Shadow edge: b = 2.6 rₛ', ex + 30 * k, ey - 28 * k, '#fff', 'left');
      const hx = cx - rHz * 0.7, hy = cy + rHz * 0.7;
      x.strokeStyle = 'rgba(120,230,170,0.8)'; x.beginPath(); x.moveTo(hx, hy); x.lineTo(hx - 30 * k, hy + 30 * k); x.stroke();
      tag('Horizon’s true size (1 rₛ)', hx - 34 * k, hy + 32 * k, '#7fe6ad', 'right');
    }

    frame(once) {
      const now = performance.now();
      if (this.s.spin && this.last) this.t += Math.min(0.1, (now - this.last) / 1000) * 30;
      // Adapt resolution only from back-to-back rendered frames (idle frames say nothing about cost)
      if (this.last && !once && this.prevDrew && !this.dragging) {
        const dt = now - this.last;
        this.avg = this.avg ? this.avg * 0.9 + dt * 0.1 : dt;
        if (this.avg > 45 && this.scale > 0.25) { this.scale = Math.max(0.25, this.scale * (this.avg > 100 ? 0.5 : 0.6)); this.avg = 30; }
        else if (this.avg < 20 && this.scale < 1) { this.scale = Math.min(1, this.scale * 1.05); this.avg = 24; }
      }
      this.last = now;
      const draw = this.s.spin || this.dirty || this.dragging;
      if (draw) this.render();
      this.prevDrew = draw && !once;
    }

    start() {
      if (!this.ok || this.running) { if (this.ok) this.render(); return; }
      this.running = true; this.last = 0;
      const loop = () => { if (!this.running) return; this.frame(false); this.raf = requestAnimationFrame(loop); };
      this.raf = requestAnimationFrame(loop);
    }
    stop() { this.running = false; cancelAnimationFrame(this.raf); this.last = 0; }

    _pointer() {
      let px = 0, py = 0, id = null;
      this.c.addEventListener('pointerdown', (e) => { id = e.pointerId; this.c.setPointerCapture(id); px = e.clientX; py = e.clientY; this.dragging = true; });
      this.c.addEventListener('pointermove', (e) => {
        if (e.pointerId !== id) return;
        const dx = e.clientX - px, dy = e.clientY - py; px = e.clientX; py = e.clientY;
        this.s.az -= dx * 0.4;
        this.s.incl = Math.max(0, Math.min(90, this.s.incl - dy * 0.3));
        this.dirty = true;
        if (this.onDrag) this.onDrag();
        if (!this.running) this.render();
      });
      const end = (e) => { if (e.pointerId !== id) return; id = null; this.dragging = false; this.dirty = true; if (!this.running) this.render(); };
      this.c.addEventListener('pointerup', end); this.c.addEventListener('pointercancel', end);
    }
  }

  /* ---------- Numbers for real black holes ---------- */
  const PC = 3.0857e16, MUAS = Math.PI / 180 / 3600 / 1e6;
  const HOLES = {
    cyg: { name: 'Cygnus X-1', M: 21.2, d: 2.22e3 * PC, note: 'A stellar-mass black hole eating a blue supergiant companion, 2.2 kpc away (Miller-Jones et al. 2021).', spinNote: ' (if non-spinning; Cyg X-1 spins near maximum, so its real inner edge is much smaller)' },
    sgr: { name: 'Sagittarius A*', M: 4.3e6, d: 8.28e3 * PC, ring: 51.8, note: 'The black hole at the centre of the Milky Way: 4.3 million M☉ at 8.28 kpc (GRAVITY 2022). Imaged by the EHT in 2022.' },
    m87: { name: 'M87*', M: 6.5e9, d: 16.8e6 * PC, ring: 42, note: 'The giant black hole in galaxy M87. The first black hole ever imaged (EHT, 2019).', spinNote: ' (if non-spinning; M87*’s spin is uncertain but likely high, which would shrink the inner edge)' },
  };
  function numbers(key) {
    const P = global.Phys.K, h = HOLES[key], F = global.Data.Fmt;
    const M = h.M * P.Msun, rs = 2 * P.G * M / (P.c * P.c);
    const rIsco = 3 * rs, Tisco = 2 * Math.PI * Math.sqrt(rIsco ** 3 / (P.G * M));
    const shadowD = 2 * B_CRIT * rs, theta = shadowD / h.d / MUAS;
    const tidal = 2 * P.G * M * 2 / rs ** 3;                     // head-to-toe stretch for a 2 m person at the horizon
    const len = (m) => (m < 1e9 ? F.sig(m / 1e3, 3) + ' km' : F.sig(m / 1.495978707e11, 3) + ' AU');
    const time = (s) => (s < 1 ? F.sig(s * 1e3, 2) + ' ms' : s < 7200 ? F.sig(s / 60, 2) + ' min' : s < 86400 * 3 ? F.sig(s / 3600, 2) + ' hours' : F.sig(s / 86400, 2) + ' days');
    return {
      note: h.note,
      rows: [
        ['Mass', F.sig(h.M, 3) + ' M☉'],
        ['Event horizon radius rₛ', len(rs)],
        ['Shadow diameter (2 × 2.6 rₛ)', len(shadowD)],
        ['Shadow size seen from Earth', theta >= 1 ? F.sig(theta, 2) + ' μas' : F.sig(theta * 1e3, 2) + ' nano-arcsec'],
        ...(h.ring ? [['EHT ring measured', h.ring + ' μas (bright ring just outside the shadow)']] : []),
        ['Orbit at inner edge (3 rₛ)', time(Tisco) + (h.spinNote || '')],
        ['Tidal stretch on you at the horizon', F.sig(tidal / 9.81, 2) + ' g' + (tidal / 9.81 > 100 ? ' (spaghettified)' : ' (you’d barely notice)')],
      ],
    };
  }

  /* ---------- UI ---------- */
  const PRESETS = {
    edge: { label: 'Edge-on glow', s: { incl: 82, az: -90, dist: 26, disk: true, sky: false, eht: false, hl: 0 } },
    tilt: { label: 'Tilted', s: { incl: 60, az: -90, dist: 22, disk: true, sky: false, eht: false, hl: 0 } },
    face: { label: 'Face-on', s: { incl: 3, az: -90, dist: 26, disk: true, sky: false, eht: false, hl: 0 } },
    eht: { label: 'M87* through the EHT', s: { incl: 17, az: -90, dist: 30, disk: true, sky: false, eht: true, hl: 0 }, hole: 'm87' },
    sky: { label: 'No disk: lensed sky', s: { incl: 85, az: -90, dist: 18, disk: false, sky: true, eht: false, hl: 0 } },
  };
  const HIGHLIGHTS = [
    ['0', 'Natural light'],
    ['1', 'Colour by light path'],
    ['2', 'Near side vs far side'],
    ['3', 'Inner edge (ISCO)'],
  ];

  function init() {
    const $ = (q) => document.querySelector(q);
    const canvas = $('#bhCanvas');
    if (!canvas) return null;
    const view = new BlackHoleView(canvas, $('#bhOverlay'));
    if (!view.ok) { $('#bhFallback').hidden = false; return view; }

    const sync = () => {
      const s = view.s;
      $('#bhIncl').value = Math.round(s.incl); $('#bhInclOut').textContent = Math.round(s.incl) + '°';
      $('#bhDist').value = Math.round(s.dist); $('#bhDistOut').textContent = Math.round(s.dist) + ' rₛ';
      $('#bhRout').value = s.rout; $('#bhRoutOut').textContent = s.rout + ' rₛ';
      for (const k of ['dopp', 'grav', 'sky', 'disk', 'eht', 'labels', 'spin']) { const el = $('#bh_' + k); if (el) el.checked = !!s[k]; }
      document.querySelectorAll('#bhHl button').forEach((b) => b.setAttribute('aria-pressed', String(+b.dataset.hl === s.hl)));
      document.querySelectorAll('[data-bhfeat]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.bhfeat === view.feat)));
      $('#bhEhtNote').hidden = !s.eht;
    };
    view.onDrag = () => { $('#bhIncl').value = Math.round(view.s.incl); $('#bhInclOut').textContent = Math.round(view.s.incl) + '°'; document.querySelectorAll('#bhPresets button').forEach((b) => b.setAttribute('aria-pressed', 'false')); };

    const pre = $('#bhPresets');
    Object.entries(PRESETS).forEach(([k, p]) => {
      const b = document.createElement('button'); b.type = 'button'; b.textContent = p.label; b.dataset.p = k; b.setAttribute('aria-pressed', String(k === 'edge'));
      b.addEventListener('click', () => {
        pre.querySelectorAll('button').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
        view.feat = null; view.set(p.s); if (p.hole) setHole(p.hole); sync();
      });
      pre.appendChild(b);
    });
    const hlBox = $('#bhHl');
    HIGHLIGHTS.forEach(([v, t]) => {
      const b = document.createElement('button'); b.type = 'button'; b.textContent = t; b.dataset.hl = v;
      b.addEventListener('click', () => { view.feat = null; view.set({ hl: +v, eht: false, disk: true, sky: false }); sync(); });
      hlBox.appendChild(b);
    });
    const slider = (id, key, fn) => $(id).addEventListener('input', (e) => { view.set({ [key]: fn(+e.target.value) }); sync(); });
    slider('#bhIncl', 'incl', (v) => v);
    slider('#bhDist', 'dist', (v) => v);
    slider('#bhRout', 'rout', (v) => v);
    for (const k of ['dopp', 'grav', 'sky', 'disk', 'eht', 'labels', 'spin']) {
      const el = $('#bh_' + k); if (!el) continue;
      el.addEventListener('change', () => { const patch = { [k]: el.checked }; if (k === 'eht' && el.checked) patch.hl = 0; view.feat = null; view.set(patch); sync(); });
    }

    // "What you're seeing": each feature sets up the view that shows it best
    const FEATS = {
      shadow: { s: { labels: true, hl: 0, eht: false, disk: true, sky: false } },
      ring: { s: { hl: 1, eht: false, disk: true, incl: 80, dist: 22, sky: false } },
      hat: { s: { hl: 2, eht: false, disk: true, incl: 84, sky: false } },
      beam: { s: { hl: 0, eht: false, disk: true, dopp: true, incl: 80, sky: false } },
      isco: { s: { hl: 3, eht: false, disk: true, incl: 55, sky: false } },
      lens: { s: { disk: false, sky: true, eht: false, hl: 0, incl: 85, dist: 18 } },
    };
    document.querySelectorAll('[data-bhfeat]').forEach((b) => b.addEventListener('click', () => {
      const f = FEATS[b.dataset.bhfeat];
      view.feat = b.dataset.bhfeat; pre.querySelectorAll('button').forEach((x) => x.setAttribute('aria-pressed', 'false'));
      view.set(f.s); sync();
    }));

    // Real holes
    function setHole(key) {
      document.querySelectorAll('#bhHoles button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.h === key)));
      const n = numbers(key);
      $('#bhNumbers').innerHTML = n.rows.map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join('');
      $('#bhHoleNote').textContent = n.note;
    }
    const hb = $('#bhHoles');
    Object.entries(HOLES).forEach(([k, h]) => {
      const b = document.createElement('button'); b.type = 'button'; b.textContent = h.name; b.dataset.h = k;
      b.addEventListener('click', () => setHole(k)); hb.appendChild(b);
    });
    setHole('sgr');

    if (matchMedia('(prefers-reduced-motion: reduce)').matches) view.s.spin = false;
    if (global.__bhTest) { view.s.spin = false; view.scale = 0.3; }   // automated screenshot tests run on a software GPU
    sync();

    // Only run while the tab is open and the canvas is on screen
    let onScreen = true, tabOpen = false;
    const update = () => { if (tabOpen && onScreen && !document.hidden) view.start(); else view.stop(); };
    new IntersectionObserver((e) => { onScreen = e[0].isIntersecting; update(); }).observe(canvas);
    document.addEventListener('visibilitychange', update);
    new ResizeObserver(() => { view.dirty = true; if (tabOpen && !view.running) view.render(); }).observe(canvas);
    global.BlackHole.view = view;
    view.setOpen = (on) => { tabOpen = on; update(); if (on) requestAnimationFrame(() => view.render()); };
    return view;
  }

  global.BlackHole = { init, BlackHoleView, shadowAngle, numbers, B_CRIT };
})(window);
