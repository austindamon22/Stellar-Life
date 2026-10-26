/* Stellar Life — evolution.js
 * Continuous interior model: for a birth mass and a scrubber position it
 * returns the composition profile (mass fractions of H, He, C, O, Ne, Si, Fe
 * versus radius), where fusion is happening, and the surface properties.
 *
 * Radii are DISPLAY radii (0 = centre, 1 = surface) and are not to scale:
 * real giant cores are a tiny fraction of the star. Compositions follow the
 * standard textbook picture (OpenStax Astronomy ch. 22–23; Woosley, Heger &
 * Weaver 2002) and are schematic, not the output of a stellar-evolution code.
 */
(function (global) {
  'use strict';
  const P = global.Phys, D = global.Data, L = P.LIMITS;
  const ELS = ['H', 'He', 'C', 'O', 'Ne', 'Si', 'Fe'];
  const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
  const lerp = (a, b, t) => a + (b - a) * t;

  // composition helpers -------------------------------------------------
  const C = (o) => { const c = {}; ELS.forEach((e) => { c[e] = o[e] || 0; }); return c; };
  const mixC = (a, b, t) => { const c = {}; ELS.forEach((e) => { c[e] = lerp(a[e], b[e], t); }); return c; };
  const ENV = C({ H: 0.70, He: 0.30 });               // textbook: 70% H, 30% He at birth
  const HE = C({ He: 1 });
  const CO = C({ C: 0.35, O: 0.60, He: 0.05 });       // helium ash
  const ONE = C({ O: 0.55, Ne: 0.45 });               // carbon ash (Ne + Mg lumped as Ne)
  const OMG = C({ O: 0.80, Ne: 0.20 });               // neon ash
  const SIS = C({ Si: 0.90, O: 0.10 });               // oxygen ash (Si + S)
  const FE = C({ Fe: 1 });                            // silicon ash (iron peak)
  const smooth = (x) => { x = clamp(x, 0, 1); return x * x * (3 - 2 * x); };
  // step from composition a (inside r0) to b (outside r1), smoothed
  const ramp = (r, r0, r1, a, b) => mixC(a, b, smooth((r - r0) / Math.max(1e-6, r1 - r0)));

  /* Each phase: { id, label, dur(M), path (stage ids whose H-R points the surface moves through),
   *   stages: [[p, stageId], ...] (chip shown while scrubbing),
   *   profile(p, M) → { comp(r), burn(r) → 0..1, layers:[{r, name, note}], flash? } }
   */

  // ---- Main sequence, radiative core (Sun-like: 0.35–1.3 Msun) ----
  function msRadiative(p) {
    const rc = 0.25;
    return {
      comp: (r) => {
        if (r >= rc) return ENV;
        const g = 1 - (r / rc) * (r / rc);              // most burning at the centre
        const y = clamp(0.30 + 0.76 * p * Math.pow(g, 0.8), 0.30, 1); // centre ≈65% He at p≈0.46 (today's Sun)
        return C({ H: 1 - y, He: y });
      },
      burn: (r) => r < rc ? Math.pow(1 - (r / rc) * (r / rc), 0.6) * clamp(1 - (0.30 + 0.76 * p * Math.pow(1 - (r / rc) * (r / rc), 0.8)), 0, 1) / 0.7 : 0,
      layers: [
        { r: rc, name: 'Core', note: p < 0.98 ? 'Hydrogen → helium (p-p chain). Helium "ash" builds up fastest at the centre.' : 'Centre is now pure helium. Fusion has moved out into a shell.' },
        { r: 0.71, name: 'Radiative zone', note: 'Energy diffuses outward as light. Composition never mixes with the core.' },
        { r: 1, name: 'Convective envelope', note: 'Churning hydrogen and helium, still at birth composition (70% / 30%).' },
      ],
    };
  }
  // ---- Main sequence, convective core (above ~1.3 Msun): uniform mixed core that recedes ----
  function msConvective(p, M, r0) {
    const rc = r0 * (1 - 0.35 * p);
    const y = 0.30 + 0.70 * p;
    return {
      comp: (r) => {
        if (r < rc) return C({ H: 1 - y, He: y });
        if (r < r0) { const f = (r - rc) / (r0 - rc); return C({ H: 1 - lerp(y, 0.30, f), He: lerp(y, 0.30, f) }); }
        return ENV;
      },
      burn: (r) => r < rc ? (1 - y) / 0.7 : 0,
      layers: [
        { r: rc, name: 'Convective core', note: 'CNO cycle. Convection keeps the core evenly mixed, so it turns to helium all at once.' },
        { r: r0, name: 'Gradient zone', note: 'Left behind as the convective core shrinks: helium-enriched, not mixed.' },
        { r: 1, name: 'Radiative envelope', note: 'Untouched birth composition.' },
      ],
    };
  }
  // ---- Fully convective red dwarf: the whole star turns to helium evenly ----
  function msFullyConvective(p) {
    const y = 0.30 + 0.68 * p;
    return {
      comp: () => C({ H: 1 - y, He: y }),
      burn: (r) => r < 0.3 ? (1 - (r / 0.3) * (r / 0.3)) * (1 - y) / 0.7 : 0,
      layers: [
        { r: 0.3, name: 'Fusing core', note: 'p-p chain.' },
        { r: 1, name: 'Convective star', note: 'Convection stirs the whole star, so all of its hydrogen eventually reaches the core.' },
      ],
    };
  }
  // ---- Hydrogen shell around an inert helium core (subgiant / red giant) ----
  function shellH(p, M) {
    const rc = 0.07 + 0.07 * p, w = 0.035;
    const degenerate = M < L.heliumFlash;
    return {
      comp: (r) => r < rc ? HE : r < rc + w * 2.2 ? ramp(r, rc, rc + w * 2.2, HE, ENV) : ENV,
      burn: (r) => (r >= rc && r < rc + w) ? 1 - Math.abs((r - rc) / w - 0.4) : 0,
      layers: [
        { r: rc, name: 'Inert helium core', note: degenerate ? 'No fusion. Contracting and heating; electrons become degenerate.' : 'No fusion. Contracting and heating toward helium ignition.' },
        { r: rc + w, name: 'Hydrogen-burning shell', note: 'Hydrogen → helium. Hotter than the old core, so the star brightens and swells.' },
        { r: 1, name: 'Hydrogen envelope', note: 'Convective, swollen to tens of solar radii, cool and red.' },
      ],
    };
  }
  // ---- Helium flash: ignition slightly off-centre (neutrino cooling keeps the very centre cooler) ----
  function heFlash(p) {
    const base = shellH(1, 1);
    const rc = 0.14;
    return {
      comp: base.comp,
      burn: (r) => Math.max(base.burn(r), r < rc ? Math.exp(-Math.pow((r - 0.06) / 0.025, 2)) * (0.6 + 0.4 * Math.sin(p * 40)) : 0),
      flash: true,
      layers: [
        { r: rc, name: 'Degenerate helium core', note: 'Helium ignites in a runaway, first in a ring just off-centre where it is hottest.' },
        { r: rc + 0.035, name: 'Hydrogen-burning shell', note: 'Still fusing.' },
        { r: 1, name: 'Hydrogen envelope', note: 'Sees almost none of the flash energy.' },
      ],
    };
  }
  // ---- Core helium burning + hydrogen shell (HB / blue loop / supergiant) ----
  function heCore(p, M, s) {
    s = s || 1;
    const rb = 0.10 * s, rl = 0.15 * s, rs = 0.18 * s;
    const core = mixC(HE, CO, p);
    return {
      comp: (r) => r < rb ? core : r < rl ? ramp(r, rb - 0.01, rb + 0.01, core, HE) : r < rs + 0.04 ? ramp(r, rs, rs + 0.04, HE, ENV) : ENV,
      burn: (r) => Math.max(r < rb ? (1 - p * 0.85) * (1 - Math.pow(r / rb, 2) * 0.5) : 0, (r >= rs && r < rs + 0.025) ? 0.8 : 0),
      layers: [
        { r: rb, name: 'Helium-burning core', note: 'Triple-alpha: 3 ⁴He → ¹²C, then ¹²C + ⁴He → ¹⁶O. Carbon and oxygen ash accumulate.' },
        { r: rs, name: 'Helium layer', note: 'Ash from hydrogen burning.' },
        { r: rs + 0.025, name: 'Hydrogen-burning shell', note: 'Still turning hydrogen into helium.' },
        { r: 1, name: 'Hydrogen envelope', note: M > 25 ? 'Blue supergiant: strong winds are stripping it; it may become a Wolf-Rayet star with no hydrogen left.' : M >= L.supernova ? 'Red supergiant: hundreds of solar radii.' : 'Smaller and hotter than on the red giant branch.' },
      ],
    };
  }
  // ---- AGB: degenerate C/O core with two burning shells ----
  function agb(p, M) {
    const rc = 0.10 + 0.03 * p, rhe = rc + 0.022, ri = rc + 0.07, rh = ri + 0.02;
    const pulse = Math.pow(Math.max(0, Math.sin(p * Math.PI * 7)), 6); // thermal pulses
    return {
      comp: (r) => r < rc ? CO : r < ri ? HE : r < rh + 0.03 ? ramp(r, rh, rh + 0.03, HE, ENV) : ENV,
      burn: (r) => Math.max((r >= rc && r < rhe) ? 0.35 + 0.65 * pulse : 0, (r >= ri && r < rh) ? 0.8 - 0.5 * pulse : 0),
      layers: [
        { r: rc, name: 'Carbon-oxygen core', note: 'Degenerate. Never hot enough to fuse carbon. This becomes the white dwarf.' },
        { r: rhe, name: 'Helium-burning shell', note: 'Fires in thermal pulses every ~10⁴–10⁵ years (watch it flare).' },
        { r: ri, name: 'Helium intershell', note: 'Slow neutron capture (s-process) makes barium, strontium, lead here.' },
        { r: rh, name: 'Hydrogen-burning shell', note: 'Hydrogen → helium.' },
        { r: 1, name: 'Hydrogen envelope', note: 'Loosely bound. Winds strip it away, ending as a planetary nebula.' },
      ],
    };
  }
  // ---- Advanced burning onion (k: 0 C, 1 Ne, 2 O, 3 Si, 4 collapse) ----
  const ONION_R = { Fe: 0.11, Si: 0.18, O: 0.26, Ne: 0.34, C: 0.42, He: 0.53 };
  function onion(k, p) {
    const R = ONION_R;
    // core region converting this phase, and what it is made of before/after
    const steps = [
      { rk: R.Ne, from: CO, to: ONE, name: 'Carbon-burning core', note: '¹²C + ¹²C → ²⁰Ne, ²³Na, ²⁴Mg. ~500 years in a 25 M☉ star.' },
      { rk: R.O, from: ONE, to: OMG, name: 'Neon-burning core', note: 'Photodisintegration: ²⁰Ne + γ → ¹⁶O + α, then α + ²⁰Ne → ²⁴Mg. ~1 year.' },
      { rk: R.Si, from: OMG, to: SIS, name: 'Oxygen-burning core', note: '¹⁶O + ¹⁶O → ²⁸Si, ³²S. ~5 months.' },
      { rk: R.Fe, from: SIS, to: FE, name: 'Silicon-burning core', note: 'Silicon rearranges into ⁵⁶Ni → ⁵⁶Fe (iron peak). About one day.' },
    ];
    const coll = k === 4;
    const squeeze = coll ? 1 - 0.75 * smooth(p * 1.4) : 1;
    const layerComp = (r) => {
      if (r >= R.He) return ENV;
      if (r >= R.C) return HE;
      // layers formed by earlier phases
      if (r >= R.Ne) return CO;
      if (k > 0 && r >= R.O) return ONE;
      if (k > 1 && r >= R.Si) return OMG;
      if (k > 2 && r >= R.Fe) return SIS;
      if (coll) return FE;
      const s = steps[k];
      return mixC(s.from, s.to, p);
    };
    const rims = [R.He, R.C];
    if (k >= 1) rims.push(R.Ne);
    if (k >= 2) rims.push(R.O);
    if (k >= 3) rims.push(R.Si);
    if (k >= 4) rims.push(R.Fe);
    // Legend, inside out. Each ash shell is named for what made it; a shell "burns at its
    // base" once the core inside it has used up that fuel (matches the rims drawn below).
    const layers = [];
    if (coll) layers.push({ r: R.Fe * squeeze, name: 'Iron core (collapsing)', note: 'No fusion can support it. Electron capture and photodisintegration remove pressure; it falls inward in ~0.25 s.' });
    else layers.push({ r: steps[k].rk, name: steps[k].name, note: steps[k].note });
    const base = (inner) => rims.indexOf(inner) >= 0;
    if (k >= 3) layers.push({ r: R.Si, name: 'Oxygen-ash shell (Si, S)', note: base(R.Fe) ? 'Made by oxygen burning. Silicon burns at its base.' : 'Made by oxygen burning.' });
    if (k >= 2) layers.push({ r: R.O, name: 'Neon-ash shell (O, Mg)', note: base(R.Si) ? 'Made by neon burning. Oxygen burns at its base.' : 'Made by neon burning.' });
    if (k >= 1) layers.push({ r: R.Ne, name: 'Carbon-ash shell (O, Ne, Mg)', note: base(R.O) ? 'Made by carbon burning. Neon burns at its base.' : 'Made by carbon burning.' });
    layers.push({ r: R.C, name: 'Carbon-oxygen layer', note: base(R.Ne) ? 'Helium ash. Carbon burns at its base.' : 'Helium ash, about to ignite carbon in the core.' });
    layers.push({ r: R.He, name: 'Helium layer', note: 'Hydrogen ash. Helium burns at its base.' });
    layers.push({ r: 1, name: 'Hydrogen envelope', note: 'Hydrogen burns at its base. The surface cannot react this fast.' });
    return {
      comp: (r) => layerComp(coll && r < R.Si ? Math.min(R.Si, r / squeeze) : r),
      burn: (r) => {
        let b = 0;
        if (!coll && r < steps[k].rk) b = (1 - 0.6 * p) * (1 - 0.4 * Math.pow(r / steps[k].rk, 2));
        rims.forEach((rr) => { if (r >= rr && r < rr + 0.014) b = Math.max(b, coll && rr <= R.Si ? 0.2 : 0.75); });
        return b;
      },
      collapse: coll ? p : 0,
      layers,
    };
  }

  // ---- Phase lists by mass -------------------------------------------
  const msT = (M) => P.msLifetime(M);
  function phases(M) {
    if (M < L.redDwarfFate) {
      const fully = M < L.fullyConvective;
      return [
        { id: 'ms', label: 'Main sequence', short: 'MS', dur: msT(M), path: ['zams', 'ms'], stages: [[0, 'zams'], [0.03, 'ms']], profile: (p) => fully ? msFullyConvective(p) : msRadiative(p) },
        { id: 'rd_far', label: 'Blue dwarf (far future)', short: 'Blue dwarf', dur: msT(M) * 0.05, path: ['ms', 'rd_far'], stages: [[0, 'rd_far']], profile: (p) => msFullyConvective(0.95 + 0.05 * p) },
      ];
    }
    if (M < L.heliumFlash) {
      return [
        { id: 'ms', label: 'Main sequence', short: 'MS', dur: msT(M), path: ['zams', 'ms'], stages: [[0, 'zams'], [0.03, 'ms']], profile: (p) => M <= L.cno ? msRadiative(p) : msConvective(p, M, 0.27) },
        { id: 'rgb', label: 'Subgiant → red giant', short: 'Red giant', dur: msT(M) * 0.13, path: ['ms', 'subgiant', 'rgb'], stages: [[0, 'subgiant'], [0.5, 'rgb']], profile: (p) => shellH(p, M) },
        { id: 'flash', label: 'Helium flash', short: 'He flash', dur: 1e-4, path: ['heflash'], stages: [[0, 'heflash']], profile: (p) => heFlash(p) },
        { id: 'hb', label: 'Core helium burning', short: 'He core', dur: msT(M) * 0.012, path: ['hb'], stages: [[0, 'hb']], profile: (p) => heCore(p, M) },
        { id: 'agb', label: 'Asymptotic giant branch', short: 'AGB', dur: msT(M) * 0.002, path: ['hb', 'agb', 'agb'], stages: [[0, 'agb']], profile: (p) => agb(p, M) },
      ];
    }
    if (M < L.supernova) {
      return [
        { id: 'ms', label: 'Main sequence', short: 'MS', dur: msT(M), path: ['zams', 'ms'], stages: [[0, 'zams'], [0.03, 'ms']], profile: (p) => msConvective(p, M, 0.30) },
        { id: 'rgb', label: 'Subgiant → red giant', short: 'Red giant', dur: msT(M) * 0.02, path: ['ms', 'subgiant', 'rgb'], stages: [[0, 'subgiant'], [0.5, 'rgb']], profile: (p) => shellH(p, M) },
        { id: 'hecore', label: 'Core helium burning', short: 'He core', dur: msT(M) * 0.15, path: ['blueloop'], stages: [[0, 'blueloop']], profile: (p) => heCore(p, M) },
        { id: 'agb', label: 'Asymptotic giant branch', short: 'AGB', dur: msT(M) * 0.01, path: ['blueloop', 'agb', 'agb'], stages: [[0, 'agb']], profile: (p) => agb(p, M) },
      ];
    }
    return [
      { id: 'ms', label: 'Main sequence', short: 'MS', dur: msT(M), path: ['zams', 'ms'], stages: [[0, 'zams'], [0.03, 'ms']], profile: (p) => msConvective(p, M, 0.34) },
      { id: 'hecore', label: 'Core helium burning', short: 'He core', dur: msT(M) * 0.12, path: ['ms', 'rsg'], stages: [[0, 'rsg']], profile: (p) => heCore(p, M, 1.25) },
      { id: 'c', label: 'Carbon burning', short: 'C', dur: 522, path: ['onion'], stages: [[0, 'onion']], profile: (p) => onion(0, p) },
      { id: 'ne', label: 'Neon burning', short: 'Ne', dur: 0.89, path: ['onion'], stages: [[0, 'onion']], profile: (p) => onion(1, p) },
      { id: 'o', label: 'Oxygen burning', short: 'O', dur: 0.40, path: ['onion'], stages: [[0, 'onion']], profile: (p) => onion(2, p) },
      { id: 'si', label: 'Silicon burning', short: 'Si', dur: 0.002, path: ['onion'], stages: [[0, 'onion']], profile: (p) => onion(3, p) },
      { id: 'collapse', label: 'Core collapse', short: 'Collapse', dur: 0.25 / P.K.yr, path: ['corecollapse'], stages: [[0, 'corecollapse']], profile: (p) => onion(4, p) },
    ];
  }

  // Where to put the scrubber when a stage chip is clicked.
  function scrubForStage(M, stageId) {
    const ph = phases(M);
    const pref = { ms: 0.46, zams: 0, rgb: 0.7, subgiant: 0.15, onion: 0 };
    for (let i = 0; i < ph.length; i++) {
      const hit = ph[i].stages.find((s) => s[1] === stageId);
      if (hit) {
        let p = hit[0];
        if (pref[stageId] != null && pref[stageId] >= p) p = pref[stageId];
        return i + Math.min(p, 0.999);
      }
    }
    return null;
  }

  // State at scrubber value s (0 .. phases.length)
  function at(M, s) {
    const ph = phases(M);
    const i = clamp(Math.floor(s), 0, ph.length - 1);
    const p = clamp(s - i, 0, 1);
    const phase = ph[i];
    const prof = phase.profile(p, M);
    let stage = phase.stages[0][1];
    phase.stages.forEach(([pp, id]) => { if (p >= pp) stage = id; });
    // age
    let age = 0; for (let k = 0; k < i; k++) age += ph[k].dur; age += phase.dur * p;
    // surface: interpolate the stage H-R points
    const pts = phase.path.map((id) => P.hrPosition(id, M)).filter(Boolean);
    let logT = pts[0].logT, logL = pts[0].logL;
    if (pts.length > 1) {
      const f = p * (pts.length - 1), j = Math.min(pts.length - 2, Math.floor(f)), q = f - j;
      logT = lerp(pts[j].logT, pts[j + 1].logT, q); logL = lerp(pts[j].logL, pts[j + 1].logL, q);
    }
    const T = Math.pow(10, logT), Lum = Math.pow(10, logL);
    const R = Math.sqrt(Lum) / Math.pow(T / P.K.Tsun, 2);
    return { phase, phaseIndex: i, p, profile: prof, stage, age, T, L: Lum, R, logT, logL, n: ph.length };
  }

  // Build a radial colour lookup table for the renderer.
  const hex = (h) => { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
  const ELRGB = {}; ELS.forEach((e) => { ELRGB[e] = hex(D.EL[e].c); });
  function lut(profile, N) {
    N = N || 256;
    const rgb = new Uint8ClampedArray(N * 3), glow = new Float32Array(N), edge = new Uint8Array(N);
    let prev = null;
    for (let i = 0; i < N; i++) {
      const r = (i + 0.5) / N, c = profile.comp(r);
      let R = 0, G = 0, B = 0, sum = 0;
      ELS.forEach((e) => { const w = c[e]; if (w > 0) { R += ELRGB[e][0] * w; G += ELRGB[e][1] * w; B += ELRGB[e][2] * w; sum += w; } });
      R /= sum; G /= sum; B /= sum;
      rgb[i * 3] = R; rgb[i * 3 + 1] = G; rgb[i * 3 + 2] = B;
      glow[i] = clamp(profile.burn(r), 0, 1);
      if (prev && Math.abs(prev[0] - R) + Math.abs(prev[1] - G) + Math.abs(prev[2] - B) > 22) edge[i] = 1;
      prev = [R, G, B];
    }
    // also mark named layer boundaries (e.g. radiative / convective zones of the same composition)
    (profile.layers || []).slice(0, -1).forEach((l) => { const i = Math.min(N - 1, Math.round(l.r * N)); edge[i] = 1; });
    return { rgb, glow, edge, N };
  }

  global.Evo = { ELS, phases, at, lut, scrubForStage, ENV };
})(window);
