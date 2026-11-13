/* Galaxies — gx-life.js: life in the universe
 * - Habitable zone: conservative edges 0.99√L and 1.67√L AU (Kopparapu et al. 2013: moist/runaway greenhouse to maximum greenhouse),
 *   equilibrium temperature T = 278.6 K × (1 − A)^¼ L^¼ / √d, star lifetime from Stellar Life's relation.
 * - Drake equation with presets and the implied typical distance between civilizations.
 */
(function (global) {
  'use strict';
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const TAU = Math.PI * 2;
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const facts = (box, rows) => { box.innerHTML = rows.map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join(''); };
  function sig(x, n = 3) {
    if (!isFinite(x)) return '—'; if (x === 0) return '0';
    const a = Math.abs(x);
    if (a >= 1e5 || a < 1e-3) { const e = Math.floor(Math.log10(a)); const m = x / Math.pow(10, e); return m.toPrecision(n).replace(/\.?0+$/, '') + ' × 10<sup>' + e + '</sup>'; }
    return x.toLocaleString('en-US', { maximumSignificantDigits: n });
  }

  /* ---------- Habitable zone ---------- */
  // Main-sequence stars: L (L☉), T_eff (K), lifetime (Gyr, approx.)
  const STARS = {
    M: { name: 'M dwarf (0.15 M☉)', L: 0.0025, T: 3100, life: 4000 },
    K: { name: 'K dwarf (0.75 M☉)', L: 0.3, T: 4600, life: 25 },
    G: { name: 'Sun (G2, 1 M☉)', L: 1, T: 5772, life: 10 },
    F: { name: 'F star (1.4 M☉)', L: 4, T: 6600, life: 3 },
    A: { name: 'A star (2 M☉)', L: 16, T: 8500, life: 1.2 },
  };
  const PLANETS = {
    earth: { name: 'Earth', star: 'G', d: 1, A: 0.30, real: 288, note: 'Real average 288 K: the greenhouse effect adds ~33 K.' },
    venus: { name: 'Venus', star: 'G', d: 0.723, A: 0.76, real: 737, note: 'Real surface 737 K: a runaway greenhouse. Its bright clouds reflect 76% of sunlight, yet it is the hottest planet.' },
    mars: { name: 'Mars', star: 'G', d: 1.524, A: 0.25, real: 210, note: 'Inside the zone\'s outer edge, yet real average ~210 K: Mars is too small to hold a thick, warming atmosphere. Billions of years ago it had rivers and lakes.' },
    prox: { name: 'Proxima Centauri b', star: 'Mp', d: 0.0485, A: 0.3, real: null, note: 'Nearest exoplanet (4.2 ly). In the habitable zone, but its red-dwarf star flares violently and the planet is probably tidally locked.' },
    trap: { name: 'TRAPPIST-1e', star: 'Mt', d: 0.0293, A: 0.3, real: null, note: 'One of seven Earth-sized planets around an ultracool dwarf 40 ly away; JWST is checking whether it has an atmosphere.' },
  };
  // the two real red dwarfs
  STARS.Mp = { name: 'Proxima Centauri (M5.5)', L: 0.00155, T: 3040, life: 4000, hidden: true };
  STARS.Mt = { name: 'TRAPPIST-1 (M8)', L: 0.000553, T: 2570, life: 10000, hidden: true };
  const S = { star: 'G', d: 1, A: 0.3, planet: 'earth', ph: 0 };
  const Teq = () => 278.6 * Math.pow(1 - S.A, 0.25) * Math.pow(STARS[S.star].L, 0.25) / Math.sqrt(S.d);
  const hz = () => { const L = STARS[S.star].L; return [0.99 * Math.sqrt(L), 1.67 * Math.sqrt(L)]; };
  function bb(T) {
    const t = T / 100;
    const r = t <= 66 ? 255 : 329.7 * Math.pow(t - 60, -0.1332);
    const g = t <= 66 ? 99.47 * Math.log(t) - 161.12 : 288.12 * Math.pow(t - 60, -0.0755);
    const b = t >= 66 ? 255 : t <= 19 ? 0 : 138.52 * Math.log(t - 10) - 305.04;
    return [r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))));
  }
  let raf = 0, open = false, last = 0;
  function draw() {
    const cv = $('#hzCanvas'); if (!cv) return;
    const r = cv.getBoundingClientRect(), dpr = Math.min(devicePixelRatio || 1, 2);
    const W = Math.round(r.width * dpr), H = Math.round(r.height * dpr); if (!W) return;
    if (cv.width !== W || cv.height !== H) { cv.width = W; cv.height = H; }
    const c = cv.getContext('2d'); c.fillStyle = '#04050b'; c.fillRect(0, 0, W, H);
    const [hi, ho] = hz(), cx = W / 2, cy = H / 2;
    // scale so the outer HZ edge or the planet fits at ~85% of the half-size
    const span = Math.max(ho * 1.15, S.d * 1.15), sc = Math.min(W, H) * 0.46 / span;
    // habitable zone band
    c.beginPath(); c.arc(cx, cy, ho * sc, 0, TAU); c.arc(cx, cy, hi * sc, 0, TAU, true);
    c.fillStyle = 'rgba(90,220,140,0.22)'; c.fill('evenodd');
    c.strokeStyle = 'rgba(90,220,140,0.6)'; c.lineWidth = dpr;
    [hi, ho].forEach((rr) => { c.beginPath(); c.arc(cx, cy, rr * sc, 0, TAU); c.stroke(); });
    // too hot / too cold labels
    c.font = `${11 * dpr}px ui-monospace, Menlo, monospace`; c.textAlign = 'center';
    c.fillStyle = 'rgba(255,140,100,0.9)'; if (hi * sc > 40 * dpr) c.fillText('too hot', cx, cy - hi * sc * 0.55);
    c.fillStyle = 'rgba(120,200,255,0.9)'; c.fillText('too cold', cx, Math.min(H - 8 * dpr, cy + ho * sc + 18 * dpr));
    const pill = (t, x, y, col) => { const w = c.measureText(t).width; c.fillStyle = 'rgba(4,5,11,0.75)'; c.fillRect(x - w / 2 - 4 * dpr, y - 11 * dpr, w + 8 * dpr, 15 * dpr); c.fillStyle = col; c.fillText(t, x, y); };
    pill('habitable zone', cx - (hi + ho) / 2 * sc * 0.71, cy - (hi + ho) / 2 * sc * 0.71 + 4 * dpr, 'rgba(120,230,160,0.95)');
    // star (size grows mildly with L; not to scale)
    const st = STARS[S.star], [R, G, B] = bb(st.T), sr = (5 + 4 * Math.log10(st.L * 1000 + 1)) * dpr;
    const gr = c.createRadialGradient(cx, cy, 0, cx, cy, sr * 2.6);
    gr.addColorStop(0, '#fff'); gr.addColorStop(0.35, `rgb(${R},${G},${B})`); gr.addColorStop(1, `rgba(${R},${G},${B},0)`);
    c.fillStyle = gr; c.beginPath(); c.arc(cx, cy, sr * 2.6, 0, TAU); c.fill();
    // planet orbit + planet
    c.strokeStyle = 'rgba(255,255,255,0.35)'; c.setLineDash([4 * dpr, 4 * dpr]); c.beginPath(); c.arc(cx, cy, S.d * sc, 0, TAU); c.stroke(); c.setLineDash([]);
    const T = Teq(), inHZ = S.d >= hi && S.d <= ho;
    const px = cx + S.d * sc * Math.cos(S.ph), py = cy - S.d * sc * Math.sin(S.ph);
    c.fillStyle = inHZ ? '#5ad1ff' : T > 300 ? '#ff8a5c' : '#d9e6ff';
    c.beginPath(); c.arc(px, py, 6 * dpr, 0, TAU); c.fill();
    c.textAlign = 'left'; c.fillStyle = '#fff'; c.fillText(PLANETS[S.planet] && Math.abs(PLANETS[S.planet].d - S.d) < 1e-6 ? PLANETS[S.planet].name : 'your planet', px + 10 * dpr, py - 8 * dpr);
    // scale bar
    const nice = [0.01, 0.02, 0.05, 0.1, 0.2, 0.5, 1, 2, 5, 10].find((v) => v * sc > 60 * dpr) || 10;
    c.strokeStyle = '#fff'; c.lineWidth = 1.5 * dpr; c.beginPath(); c.moveTo(12 * dpr, H - 14 * dpr); c.lineTo(12 * dpr + nice * sc, H - 14 * dpr); c.stroke();
    c.fillStyle = '#fff'; c.fillText(nice + ' AU', 12 * dpr, H - 20 * dpr);
  }
  function readout() {
    const st = STARS[S.star], [hi, ho] = hz(), T = Teq(), inHZ = S.d >= hi && S.d <= ho;
    const pl = PLANETS[S.planet] && Math.abs(PLANETS[S.planet].d - S.d) < 1e-6 && Math.abs(PLANETS[S.planet].A - S.A) < 1e-6 ? PLANETS[S.planet] : null;
    // tidal locking: rough rule of thumb, planets inside ~0.5 √(M) AU of low-mass stars lock within a few Gyr
    const locked = st.L < 0.05 && S.d < 0.2;
    $('#hzDOut').textContent = S.d < 0.1 ? S.d.toFixed(4) + ' AU' : S.d.toFixed(2) + ' AU';
    $('#hzAOut').textContent = S.A.toFixed(2);
    facts($('#hzOut'), [
      ['Star', `${st.name}, ${sig(st.L, 2)} L☉, ${st.T.toLocaleString('en-US')} K`],
      ['Habitable zone (conservative)', `${sig(hi, 3)} – ${sig(ho, 3)} AU`],
      ['Planet', inHZ ? '<b style="color:var(--good)">in the habitable zone</b>' : S.d < hi ? '<b style="color:var(--bad)">too close: water boils off</b>' : '<b style="color:#5aa6ff">too far: water freezes</b>'],
      ['Equilibrium temperature (no greenhouse)', `${Math.round(T)} K (${Math.round(T - 273.15)} °C)`],
      ['Star’s main-sequence lifetime', st.life >= 100 ? `~${sig(st.life, 2)} billion years (longer than the universe has existed)` : `~${sig(st.life, 2)} billion years`],
      ['Enough time for complex life?', st.life >= 4 ? 'Yes: Earth needed ~4 billion years to make animals' : '<b style="color:var(--bad)">Probably not: the star dies first</b>'],
    ].concat(locked ? [['Tidally locked?', 'Likely: one side always faces the star']] : []));
    $('#hzNote').textContent = pl ? pl.note : '';
  }
  function update() { readout(); draw(); }
  function loop(now) {
    if (!open) { raf = 0; return; }
    const dt = last ? Math.min(0.05, (now - last) / 1000) : 0; last = now;
    if (!reduceMotion) S.ph += dt * 0.6 / Math.pow(Math.max(S.d / Math.sqrt(STARS[S.star].L), 0.2), 1.5) * 0.5;
    draw(); raf = requestAnimationFrame(loop);
  }

  /* ---------- Drake equation ---------- */
  const TERMS = [
    ['R', 'R*: new stars per year in the Milky Way', 0.5, 10, 0.1, 'log'],
    ['fp', 'f<sub>p</sub>: fraction of stars with planets', 0.01, 1, 0.01, 'lin'],
    ['ne', 'n<sub>e</sub>: habitable planets per system with planets', 0.01, 1, 0.01, 'lin'],
    ['fl', 'f<sub>l</sub>: fraction where life starts', 1e-6, 1, 0, 'log'],
    ['fi', 'f<sub>i</sub>: fraction that evolve intelligence', 1e-6, 1, 0, 'log'],
    ['fc', 'f<sub>c</sub>: fraction that make detectable signals', 1e-3, 1, 0, 'log'],
    ['L', 'L: years a civilization keeps signalling', 10, 1e8, 0, 'log'],
  ];
  const DRAKE_PRE = {
    pess: { label: 'Pessimist', v: { R: 1.5, fp: 1, ne: 0.1, fl: 1e-3, fi: 1e-3, fc: 0.1, L: 300 } },
    mid: { label: 'Middle', v: { R: 2, fp: 1, ne: 0.2, fl: 0.1, fi: 0.01, fc: 0.2, L: 100000 } },
    opt: { label: 'Optimist', v: { R: 3, fp: 1, ne: 0.4, fl: 1, fi: 0.5, fc: 0.5, L: 1e6 } },
  };
  const D = Object.assign({}, DRAKE_PRE.mid.v);
  const toSlider = (t, v) => (t[5] === 'log' ? Math.round((Math.log10(v) - Math.log10(t[2])) / (Math.log10(t[3]) - Math.log10(t[2])) * 1000) : Math.round((v - t[2]) / (t[3] - t[2]) * 1000));
  const fromSlider = (t, s) => (t[5] === 'log' ? Math.pow(10, Math.log10(t[2]) + s / 1000 * (Math.log10(t[3]) - Math.log10(t[2]))) : t[2] + s / 1000 * (t[3] - t[2]));
  function drake() {
    const N = TERMS.reduce((p, t) => p * D[t[0]], 1);
    TERMS.forEach((t) => { const o = $('#dk_' + t[0] + 'Out'); if (o) o.innerHTML = sig(D[t[0]], 2); });
    // typical spacing if N civilizations share the Milky Way's disk (radius 15 kpc, thickness ~0.3 kpc)
    const Vly3 = Math.PI * 15 * 15 * 0.3 * Math.pow(3261.56, 3), spacing = Math.cbrt(Vly3 / Math.max(N, 1e-30));
    const flat = Math.sqrt(Math.PI * 15 * 15 * Math.pow(3261.56, 2) / Math.max(N, 1e-30));    // 2D spacing once spacing exceeds the disk thickness
    const dist = spacing > 1000 ? flat : spacing;
    $('#dkN').innerHTML = N >= 1 ? sig(N, 2) : sig(N, 2);
    $('#dkMsg').innerHTML = N < 1
      ? `Fewer than one: we may be the only civilization signalling in the Milky Way right now.`
      : `If they're spread through the disk, the nearest would typically be <b>~${sig(dist, 2)} light-years</b> away. A radio message would take ${sig(dist, 2)} years one way${dist * 2 > D.L ? ', longer round-trip than they last' : ''}.`;
  }

  let inited = false;
  function init() {
    if (inited) return; inited = true;
    const sb = $('#hzStars');
    ['M', 'K', 'G', 'F', 'A'].forEach((k) => {
      const b = document.createElement('button'); b.type = 'button'; b.textContent = STARS[k].name.split(' (')[0]; b.dataset.k = k; b.setAttribute('aria-pressed', String(k === S.star));
      b.addEventListener('click', () => { S.star = k; S.planet = null; $$('button', sb).forEach((x) => x.setAttribute('aria-pressed', String(x === b))); $$('#hzPlanets button').forEach((x) => x.setAttribute('aria-pressed', 'false')); fitD(); update(); });
      sb.appendChild(b);
    });
    const pb = $('#hzPlanets');
    Object.entries(PLANETS).forEach(([k, p]) => {
      const b = document.createElement('button'); b.type = 'button'; b.textContent = p.name; b.setAttribute('aria-pressed', String(k === S.planet));
      b.addEventListener('click', () => { S.planet = k; S.star = p.star; S.d = p.d; S.A = p.A; setSliders(); $$('button', pb).forEach((x) => x.setAttribute('aria-pressed', String(x === b))); $$('#hzStars button').forEach((x) => x.setAttribute('aria-pressed', String(x.dataset.k === S.star))); update(); });
      pb.appendChild(b);
    });
    // distance slider: log scale 0.01 .. 10 AU
    const dS = $('#hzD');
    const setSliders = () => { dS.value = Math.round((Math.log10(S.d) + 2) / 3 * 1000); $('#hzA').value = S.A; };
    const fitD = () => { const [a, b] = hz(); S.d = Math.sqrt(a * b); setSliders(); };
    dS.addEventListener('input', () => { S.d = Math.pow(10, +dS.value / 1000 * 3 - 2); update(); });
    $('#hzA').addEventListener('input', (e) => { S.A = +e.target.value; update(); });
    setSliders();
    new ResizeObserver(() => draw()).observe($('#hzCanvas'));
    // Drake
    const box = $('#dkTerms');
    TERMS.forEach((t) => {
      const id = 'dk_' + t[0];
      const w = document.createElement('div'); w.className = 'dk-term';
      w.innerHTML = `<label for="${id}" class="probe-label">${t[1]} <output id="${id}Out"></output></label><input id="${id}" type="range" min="0" max="1000" step="1">`;
      box.appendChild(w);
      const inp = w.querySelector('input'); inp.value = toSlider(t, D[t[0]]);
      inp.addEventListener('input', () => { D[t[0]] = fromSlider(t, +inp.value); $$('#dkPre button').forEach((x) => x.setAttribute('aria-pressed', 'false')); drake(); });
    });
    Object.entries(DRAKE_PRE).forEach(([k, p]) => {
      const b = document.createElement('button'); b.type = 'button'; b.textContent = p.label; b.setAttribute('aria-pressed', String(k === 'mid'));
      b.addEventListener('click', () => { Object.assign(D, p.v); TERMS.forEach((t) => { $('#dk_' + t[0]).value = toSlider(t, D[t[0]]); }); $$('#dkPre button').forEach((x) => x.setAttribute('aria-pressed', String(x === b))); drake(); });
      $('#dkPre').appendChild(b);
    });
  }
  let tabOpen = false, vis = true, io = null;
  const set = () => { open = tabOpen && vis && !document.hidden; if (open && !raf) { last = 0; raf = requestAnimationFrame(loop); } };
  document.addEventListener('visibilitychange', set);
  global.GXLife = {
    setOpen(on) {
      tabOpen = on;
      if (on) { init(); update(); drake(); if (!io) { io = new IntersectionObserver((e) => { vis = e[0].isIntersecting; set(); }); io.observe($('#hzCanvas')); } }
      set();
    },
    Teq, hz, S, D,
  };
})(window);
