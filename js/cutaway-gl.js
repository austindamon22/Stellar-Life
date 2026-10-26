/* Stellar Life — cutaway-gl.js
 * GPU renderer for the star cutaway: a sphere with one octant removed.
 *  - Cut faces are coloured by composition (radial lookup table built from the evolution model).
 *  - Convective zones boil, radiative zones shimmer outward, fusion zones glow.
 *  - "True scale" remaps radius so every layer has its real size; zoom goes to 10^6x.
 *    Face hits are computed relative to the star's centre, so precision holds when zoomed.
 *  - Surface: blackbody colour from T_eff, linear limb darkening (u = 0.6), granulation.
 */
(function (global) {
  'use strict';
  const NL = 512;          // lookup-table bins
  const MAXMAP = 12, MAXB = 10;

  const VS = 'attribute vec2 p; void main(){ gl_Position = vec4(p, 0.0, 1.0); }';
  const FS = `
precision highp float;
uniform vec2 uRes;
uniform vec3 uR0, uR1, uR2, uLo;
uniform float uS, uT, uPix, uGran, uHalo, uFlash, uPulse, uCompact;
uniform vec3 uSurf;
uniform sampler2D uLut;
uniform float uMapR[${MAXMAP}], uMapX[${MAXMAP}], uMapN;
uniform float uBnd[${MAXB}], uBndN;

float hash(vec3 p){ p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float noise(vec3 x){
  vec3 i = floor(x); vec3 f = fract(x); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(hash(i), hash(i + vec3(1,0,0)), f.x), mix(hash(i + vec3(0,1,0)), hash(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(hash(i + vec3(0,0,1)), hash(i + vec3(1,0,1)), f.x), mix(hash(i + vec3(0,1,1)), hash(i + vec3(1,1,1)), f.x), f.y), f.z);
}
// Cell pattern: bright upwelling centres, dark lanes (like granulation / convection cells)
float cells(vec3 x){
  vec3 i = floor(x); vec3 f = fract(x); float d = 1.0;
  for (int a = -1; a <= 1; a++) for (int b = -1; b <= 1; b++) for (int c = -1; c <= 1; c++) {
    vec3 g = vec3(float(a), float(b), float(c));
    vec3 o = vec3(hash(i + g), hash(i + g + 7.1), hash(i + g + 13.7));
    d = min(d, length(g + o - f));
  }
  return d;
}

// true radius fraction -> display radius (piecewise linear), and the local slope dr/dx
vec2 remap(float x){
  float r = x, sl = 1.0;
  for (int i = 0; i < ${MAXMAP - 1}; i++) {
    if (float(i) < uMapN - 1.0) {
      float x0 = uMapX[i], x1 = uMapX[i + 1];
      if (x >= x0 && x <= x1) {
        sl = (uMapR[i + 1] - uMapR[i]) / max(x1 - x0, 1e-12);
        r = uMapR[i] + (x - x0) * sl;
      }
    }
  }
  return vec2(clamp(r, 0.0, 1.0), sl);
}
vec4 lut(float r){ return texture2D(uLut, vec2(clamp(r, 0.0, 1.0) * ${(NL - 1) / NL} + ${0.5 / NL}, 0.25)); }
float conv(float r){ return texture2D(uLut, vec2(clamp(r, 0.0, 1.0) * ${(NL - 1) / NL} + ${0.5 / NL}, 0.75)).r; }

void main(){
  float m = 0.5 * min(uRes.x, uRes.y);
  vec2 q = (gl_FragCoord.xy - 0.5 * uRes) / m * uS;
  float qq = dot(q, q);
  float px = uS / m;                 // one pixel in world units
  float dq = sqrt(qq);

  // Outside the star: halo
  if (dq > 1.0 + px) {
    float a = uHalo * exp(-(dq - 1.0) * (uCompact > 0.5 ? 9.0 : 5.0));
    gl_FragColor = vec4(uSurf * a, a);
    return;
  }
  float mu = sqrt(max(1.0 - qq, 0.0));
  vec3 entry = q.x * uR0 + q.y * uR1 + mu * uR2;
  vec3 col;
  bool face = false;
  if (entry.x > 0.0 && entry.y > 0.0 && entry.z > 0.0) {
    // Inside the removed octant: find the nearest of the planes x=0, y=0, z=0
    float best = 1e9; vec3 hit = vec3(0.0); vec3 nrm = vec3(0.0); float dEdge = 1.0;
    for (int i = 0; i < 3; i++) {
      float r2 = i == 0 ? uR2.x : i == 1 ? uR2.y : uR2.z;
      if (abs(r2) < 1e-6) continue;
      float r0 = i == 0 ? uR0.x : i == 1 ? uR0.y : uR0.z;
      float r1 = i == 0 ? uR1.x : i == 1 ? uR1.y : uR1.z;
      float s = (q.x * r0 + q.y * r1) / r2;              // depth along the ray, relative to the centre
      vec3 h = q.x * uR0 + q.y * uR1 - uR2 * s;
      if (i == 0) h.x = 0.0; else if (i == 1) h.y = 0.0; else h.z = 0.0;
      bool inside = h.x >= -1e-12 && h.y >= -1e-12 && h.z >= -1e-12 && dot(h, h) <= 1.0;
      if (inside && s > -mu && s < best) {
        best = s; hit = h;
        nrm = i == 0 ? vec3(1,0,0) : i == 1 ? vec3(0,1,0) : vec3(0,0,1);
        dEdge = i == 0 ? min(h.y, h.z) : i == 1 ? min(h.x, h.z) : min(h.x, h.y);
      }
    }
    if (best < 1e8) {
      face = true;
      float rr = length(hit);
      vec2 rm = remap(rr);
      float r = rm.x;
      vec3 ps = rr > 0.0 ? hit * (r / rr) : hit;          // display-space position for textures
      vec4 L = lut(r);
      col = L.rgb;
      float cv = conv(r);
      // convection: boiling cells that drift
      if (cv > 0.5) {
        // rising hot blobs and sinking cool lanes, drifting over time
        float n1 = noise(ps * 9.0 + vec3(0.0, uT * 0.25, uT * 0.12));
        float n2 = noise(ps * 24.0 - vec3(uT * 0.3, 0.0, uT * 0.2));
        float lane = smoothstep(0.05, 0.45, cells(ps * 13.0 + vec3(0.0, uT * 0.18, 0.0)));
        col *= (0.86 + 0.2 * n1 + 0.08 * n2) * (0.9 + 0.1 * lane);
      } else {
        // radiative zones: faint ripples moving outward (energy diffusing as light)
        col *= 1.0 + 0.045 * sin(r * 150.0 - uT * 1.6) * (1.0 - L.a);
      }
      // fusion glow, with a soft bloom from neighbouring radii
      float bloom = 0.0;
      for (int k = 1; k <= 4; k++) {
        float dk = float(k) * 0.009;
        bloom += (lut(r - dk).a + lut(r + dk).a) * (1.0 - float(k) * 0.2);
      }
      vec3 hot = vec3(1.0, 0.88, 0.6);
      float flick = 0.85 + 0.15 * uPulse;
      float g = clamp(L.a * (0.62 * flick) + uFlash * L.a * 0.6, 0.0, 0.93);
      col = mix(col, hot, g) + hot * bloom * 0.06 * flick;
      // shading: face light + soft shadow where the faces meet
      float lam = 0.74 + 0.26 * max(0.0, dot(nrm, uLo));
      float ao = 1.0 - 0.25 * exp(-dEdge / (uS * 0.05));
      col *= lam * ao;
      // crisp layer boundaries (one pixel wide at any zoom)
      float pixR = uPix * rm.y;
      for (int j = 0; j < ${MAXB}; j++) {
        if (float(j) < uBndN) {
          float d = abs(r - uBnd[j]);
          col *= 1.0 - 0.5 * (1.0 - smoothstep(0.6 * pixR, 1.6 * pixR, d));
        }
      }
      // photosphere rim on the cut edge
      if (rr > 1.0 - 2.0 * px) col = mix(col, uSurf, 0.7);
    }
  }
  if (!face) {
    // Surface: blackbody colour, limb darkening I/I0 = 1 - u(1 - mu), u = 0.6
    float I = 1.0 - 0.6 * (1.0 - mu);
    if (uGran > 0.0) {
      float c = cells(entry * uGran + vec3(uT * 0.05, uT * 0.03, 0.0));
      I *= (0.94 + 0.08 * smoothstep(0.8, 0.15, c)) * (0.97 + 0.05 * noise(entry * uGran * 3.0 + uT * 0.1));
    }
    col = uSurf * I;
  }
  float edgeA = 1.0 - smoothstep(1.0 - px, 1.0 + px, dq);
  float ha = uHalo * exp(-max(dq - 1.0, 0.0) * 5.0) * (1.0 - edgeA);
  gl_FragColor = vec4(min(col, 1.0) * edgeA + uSurf * ha, edgeA + ha);
}`;

  function compile(gl, type, src) {
    const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
    return s;
  }

  class CutawayGL {
    constructor(host) {
      const c = document.createElement('canvas');
      c.className = 'cut-gl'; c.setAttribute('aria-hidden', 'true');
      host.parentNode.insertBefore(c, host);
      this.c = c;
      const gl = c.getContext('webgl', { premultipliedAlpha: true, alpha: true, antialias: false });
      this.ok = false;
      if (!gl) { c.remove(); return; }
      try {
        const p = gl.createProgram();
        gl.attachShader(p, compile(gl, gl.VERTEX_SHADER, VS));
        gl.attachShader(p, compile(gl, gl.FRAGMENT_SHADER, FS));
        gl.bindAttribLocation(p, 0, 'p'); gl.linkProgram(p);
        if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
        this.p = p;
      } catch (e) { console.warn('Cutaway shader failed, using the software renderer:', e.message); c.remove(); return; }
      this.gl = gl; this.ok = true;
      this.u = {};
      const n = gl.getProgramParameter(this.p, gl.ACTIVE_UNIFORMS);
      for (let i = 0; i < n; i++) { const a = gl.getActiveUniform(this.p, i); this.u[a.name.replace('[0]', '')] = gl.getUniformLocation(this.p, a.name); }
      const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
      gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
      this.tex = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, this.tex);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      this.data = new Uint8Array(NL * 2 * 4);
      c.addEventListener('webglcontextlost', (e) => { e.preventDefault(); this.ok = false; c.style.display = 'none'; });
    }

    show(on) { if (this.c) this.c.style.display = on ? 'block' : 'none'; }

    /* Upload the radial table. src: { rgb (N*3, 0-255), glow (N, 0-1), conv (N) , N } */
    setLut(src) {
      const d = this.data, N = src.N;
      for (let i = 0; i < NL; i++) {
        const j = Math.min(N - 1, Math.floor((i + 0.5) / NL * N));
        d[i * 4] = src.rgb[j * 3]; d[i * 4 + 1] = src.rgb[j * 3 + 1]; d[i * 4 + 2] = src.rgb[j * 3 + 2];
        d[i * 4 + 3] = Math.round(Math.min(1, Math.max(0, src.glow[j])) * 255);
        const k = (NL + i) * 4;
        d[k] = src.conv && src.conv[j] ? 255 : 0; d[k + 1] = 0; d[k + 2] = 0; d[k + 3] = 255;
      }
      const gl = this.gl;
      gl.bindTexture(gl.TEXTURE_2D, this.tex);
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, NL, 2, 0, gl.RGBA, gl.UNSIGNED_BYTE, d);
    }

    /* o: { W, H, R (3x3 rows), Lo, s, t, map [[r,x]..], bounds [r..], surf [0-1], gran, halo, flash, pulse, compact } */
    render(o) {
      const gl = this.gl, c = this.c, u = this.u;
      if (c.width !== o.W || c.height !== o.H) { c.width = o.W; c.height = o.H; }
      gl.viewport(0, 0, o.W, o.H);
      gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
      gl.useProgram(this.p);
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, this.tex); gl.uniform1i(u.uLut, 0);
      gl.uniform2f(u.uRes, o.W, o.H);
      gl.uniform3fv(u.uR0, o.R[0]); gl.uniform3fv(u.uR1, o.R[1]); gl.uniform3fv(u.uR2, o.R[2]); gl.uniform3fv(u.uLo, o.Lo);
      gl.uniform1f(u.uS, o.s); gl.uniform1f(u.uT, o.t);
      gl.uniform1f(u.uPix, o.s / (0.5 * Math.min(o.W, o.H)));
      gl.uniform1f(u.uGran, o.gran); gl.uniform1f(u.uHalo, o.halo); gl.uniform1f(u.uFlash, o.flash); gl.uniform1f(u.uPulse, o.pulse); gl.uniform1f(u.uCompact, o.compact ? 1 : 0);
      gl.uniform3fv(u.uSurf, o.surf);
      const mr = new Float32Array(MAXMAP), mx = new Float32Array(MAXMAP);
      const map = o.map.slice(0, MAXMAP);
      map.forEach(([r, x], i) => { mr[i] = r; mx[i] = x; });
      gl.uniform1fv(u.uMapR, mr); gl.uniform1fv(u.uMapX, mx); gl.uniform1f(u.uMapN, map.length);
      const bd = new Float32Array(MAXB); const b = o.bounds.slice(0, MAXB); b.forEach((r, i) => { bd[i] = r; });
      gl.uniform1fv(u.uBnd, bd); gl.uniform1f(u.uBndN, b.length);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }
  }

  global.CutawayGL = CutawayGL;
})(window);
