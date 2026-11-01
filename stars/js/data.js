/* Stellar Life — data.js
 * Element colours, the life-stage definitions, fusion reactions,
 * nucleosynthesis data, quiz and glossary.
 */
(function (global) {
  'use strict';
  const P = global.Phys;
  const L = P.LIMITS;

  /* ---------- One colour per element, used everywhere ---------- */
  const EL = {
    H:  { c: '#5aa9ff', name: 'Hydrogen' },
    He: { c: '#ffc93c', name: 'Helium' },
    C:  { c: '#97a0b3', name: 'Carbon' },
    N:  { c: '#a98bff', name: 'Nitrogen' },
    O:  { c: '#26c6b0', name: 'Oxygen' },
    Ne: { c: '#ff6fae', name: 'Neon' },
    Mg: { c: '#c98cff', name: 'Magnesium' },
    Si: { c: '#e8914a', name: 'Silicon' },
    Fe: { c: '#ff5248', name: 'Iron' },
    Ni: { c: '#9ad45b', name: 'Nickel' },
    n:  { c: '#8ea2c8', name: 'Neutron matter' },
    Au: { c: '#e6a400', name: 'Gold' },
    Pt: { c: '#cdd5df', name: 'Platinum' },
    Be: { c: '#f08a5d', name: 'Beryllium' },
    pos: { c: '#ff8a65', name: 'Positron' },
    nu: { c: '#5ee6a8', name: 'Neutrino' },
    gam: { c: '#ffe066', name: 'Gamma ray' },
  };

  function mix(a, b, t) {
    const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
    const ch = (p, s) => (p >> s) & 255;
    const m = (s) => Math.round(ch(pa, s) + (ch(pb, s) - ch(pa, s)) * t);
    return '#' + ((1 << 24) + (m(16) << 16) + (m(8) << 8) + m(0)).toString(16).slice(1);
  }

  /* ---------- Formatting ---------- */
  function sig(x, n = 3) {
    if (!isFinite(x)) return '—';
    if (x === 0) return '0';
    const a = Math.abs(x);
    if (a >= 1e5 || a < 1e-3) {
      const e = Math.floor(Math.log10(a));
      const m = x / Math.pow(10, e);
      return m.toPrecision(n).replace(/\.?0+$/, '') + ' × 10<sup>' + e + '</sup>';
    }
    return x.toLocaleString('en-US', { maximumSignificantDigits: n });
  }
  // Keep SVG text legible when a fixed-viewBox chart is shrunk on a phone: at least `px` CSS pixels.
  function minFont(svg, px) {
    if (!svg || !svg.viewBox || !svg.viewBox.baseVal) return;
    const vw = svg.viewBox.baseVal.width, cw = svg.clientWidth;
    if (!vw || !cw || cw >= vw) return;
    const need = (px || 9.5) * vw / cw;
    // Read the size actually used (a stylesheet rule can override the attribute) and raise it inline.
    svg.querySelectorAll('text, tspan').forEach((t) => {
      const f = parseFloat(getComputedStyle(t).fontSize) || parseFloat(t.getAttribute('font-size') || '12');
      const n = t.tagName === 'tspan' ? need * 0.95 : need;
      if (f < n) { t.setAttribute('font-size', n.toFixed(1)); t.style.fontSize = n.toFixed(1) + 'px'; }
    });
  }
  function years(y) {
    if (typeof y === 'string') return y;
    if (y <= 0) return '0 years';
    const s = y * P.K.yr;
    if (s < 60) return sig(s, 2) + ' seconds';
    if (s < 86400 * 2) return sig(s / 3600, 2) + ' hours';
    if (y < 1.5) return sig(y * 365.25, 2) + ' days';
    if (y < 1e3) return sig(y, 2) + ' years';
    if (y < 1e6) return sig(y / 1e3, 2) + ' thousand years';
    if (y < 1e9) return sig(y / 1e6, 2) + ' million years';
    if (y < 1e12) return sig(y / 1e9, 2) + ' billion years';
    return sig(y / 1e12, 2) + ' trillion years';
  }
  const Fmt = { minFont, sig, years };

  /* ---------- Cutaway layer sets ----------
   * r = outer radius as a fraction of the drawn star (NOT to scale; real
   * cores are far smaller — each set lists true sizes in its note).
   * glow = actively fusing, rim = thin burning shell at the layer's base. */
  const Lyr = (r, color, name, note, opts) => Object.assign({ r, color, name, note }, opts || {});

  function layers(stageId, M) {
    const H = EL.H.c, He = EL.He.c;
    const CO = mix(EL.C.c, EL.O.c, 0.45);
    switch (stageId) {
      case 'zams':
      case 'ms': {
        const coreCol = stageId === 'zams' ? H : mix(H, He, 0.7);
        const fuse = M > L.cno ? 'CNO cycle' : 'p-p chain';
        const coreNote = stageId === 'zams'
          ? `Hydrogen → helium by the ${fuse}. Core is ~${M > L.cno ? '20' : '25'}% of the radius.`
          : `Core now mostly helium. Hydrogen is nearly used up here.`;
        if (M < L.fullyConvective) return [
          Lyr(0.28, coreCol, 'Fusing core', coreNote, { glow: true }),
          Lyr(1.0, H, 'Convective zone', 'The whole star churns, so fresh hydrogen keeps reaching the core. Red dwarfs burn almost all of their hydrogen.'),
        ];
        if (M <= L.cno) return [
          Lyr(0.25, coreCol, 'Fusing core', coreNote, { glow: true }),
          Lyr(0.71, mix(H, '#2f5fb0', 0.35), 'Radiative zone', 'Energy moves outward as photons, absorbed and re-emitted. In the Sun this random walk takes ~100,000+ years.'),
          Lyr(1.0, mix(H, '#ffffff', 0.15), 'Convective envelope', 'Gas boils like a pot. Hot blobs rise, cool ones sink. The Sun\'s granulation is the top of this layer.'),
        ];
        return [
          Lyr(0.3, coreCol, 'Convective core', coreNote + ' CNO is so temperature-sensitive that the core convects.', { glow: true }),
          Lyr(1.0, H, 'Radiative envelope', 'Energy travels outward as radiation. The envelope barely mixes with the core.'),
        ];
      }
      case 'subgiant':
      case 'rgb':
      case 'heflash':
        return [
          Lyr(0.13, He, 'Inert helium core', stageId === 'heflash'
            ? 'Degenerate helium ignites in a runaway flash. Most of the energy is absorbed by the core, so the surface shows almost nothing.'
            : 'No fusion. Contracts and heats up. Real size ~0.1% of the star\'s radius.', { glow: stageId === 'heflash' }),
          Lyr(0.2, H, 'Hydrogen-burning shell', 'H → He in a thin shell around the core. This shell now powers the star.', { rim: true }),
          Lyr(1.0, mix(H, '#ff8b5a', 0.25), 'Convective envelope', 'Swollen to tens of solar radii and cool (~3,500–5,000 K), so the star looks red.'),
        ];
      case 'hb':
      case 'blueloop':
      case 'rsg':
        return [
          Lyr(0.15, mix(He, EL.C.c, 0.35), 'Helium-burning core', 'Triple-alpha: 3 ⁴He → ¹²C, then ¹²C + ⁴He → ¹⁶O. Needs ~10⁸ K.', { glow: true }),
          Lyr(0.22, He, 'Helium layer', 'Ash from earlier hydrogen burning.'),
          Lyr(0.27, H, 'Hydrogen-burning shell', 'Still fusing H → He at its base.', { rim: true }),
          Lyr(1.0, stageId === 'rsg' ? mix(H, '#ff7b4a', 0.35) : mix(H, '#ffffff', 0.1), 'Envelope', stageId === 'rsg' ? 'Hundreds of solar radii for a red supergiant.' : 'Hydrogen envelope.'),
        ];
      case 'agb':
        return [
          Lyr(0.12, CO, 'Carbon-oxygen core', 'Degenerate C/O ash. Too low in mass to ever ignite carbon. This becomes the white dwarf.'),
          Lyr(0.17, He, 'Helium-burning shell', 'Ignites in thermal pulses every ~10⁴–10⁵ years.', { rim: true }),
          Lyr(0.22, He, 'Intershell', 'Site of the s-process: slow neutron capture makes barium, strontium, lead.'),
          Lyr(0.26, H, 'Hydrogen-burning shell', 'H → He.', { rim: true }),
          Lyr(1.0, mix(H, '#ff7b4a', 0.35), 'Convective envelope', 'Huge and loosely held. Strong winds strip it away.'),
        ];
      case 'onion':
      case 'corecollapse':
        return [
          Lyr(0.11, EL.Fe.c, 'Iron core', 'Iron-peak nuclei (Fe, Ni). Fusing iron absorbs energy, so nothing burns here. ~1.4 M☉, about the size of Earth.', { pulse: stageId === 'corecollapse' }),
          Lyr(0.18, EL.Si.c, 'Silicon shell', 'Si → Fe-peak elements. Lasts about a day.', { rim: true }),
          Lyr(0.26, EL.O.c, 'Oxygen shell', 'O → Si, S. Lasts months.', { rim: true }),
          Lyr(0.34, EL.Ne.c, 'Neon shell', 'Ne → O, Mg. Lasts about a year.', { rim: true }),
          Lyr(0.42, EL.C.c, 'Carbon shell', 'C → Ne, Na, Mg. Lasts centuries.', { rim: true }),
          Lyr(0.53, He, 'Helium shell', 'He → C, O.', { rim: true }),
          Lyr(1.0, mix(H, '#ff7b4a', 0.3), 'Hydrogen envelope', 'H → He at its base. The surface has not had time to react to what the core is doing.', { rim: true }),
        ];
      case 'pn':
      case 'wd':
      case 'nova':
      case 'sn1a':
        return [
          Lyr(0.96, CO, 'Carbon-oxygen interior', 'Degenerate matter: a teaspoon weighs ~5 tonnes. Held up by electron degeneracy pressure.'),
          Lyr(0.99, He, 'Helium layer', 'Thin.'),
          Lyr(1.0, H, 'Hydrogen atmosphere', 'Very thin. About Earth-sized overall.'),
        ];
      case 'hewd':
      case 'rd_far':
        return [
          Lyr(0.99, He, 'Helium interior', 'A red dwarf fuses nearly all of its hydrogen to helium, then cools as a helium white dwarf.'),
          Lyr(1.0, H, 'Hydrogen atmosphere', 'Thin.'),
        ];
      case 'ns':
      case 'pulsar':
      case 'xrb':
      case 'kilonova':
        return [
          Lyr(0.45, mix(EL.n.c, '#5a4a9e', 0.5), 'Inner core', 'Unknown. Possibly hyperons or free quarks. Above ~2× nuclear density.'),
          Lyr(0.88, EL.n.c, 'Outer core', 'Superfluid neutrons with ~5–10% protons and electrons.'),
          Lyr(0.97, mix(EL.n.c, EL.Fe.c, 0.3), 'Inner crust', 'Neutron-rich nuclei swimming in free neutrons.'),
          Lyr(1.0, EL.Fe.c, 'Outer crust', 'Solid lattice of iron-group nuclei, ~1 km thick. ~12 km total radius.'),
        ];
      default: return null;
    }
  }

  /* ---------- Life stages ----------
   * Each stage: title, phase (group), view(M) → render spec, fusion(M),
   * support (what holds it up), duration(M), body(M) → HTML, misc. */
  const yrs = Fmt.years;
  const msT = (M) => P.msLifetime(M);

  const STAGES = {
    cloud: {
      title: 'Molecular cloud', phase: 'Birth',
      view: () => ({ mode: 'cloud' }),
      fusion: () => 'None',
      support: { kind: 'thermal', label: 'Gas pressure and turbulence balance gravity' },
      duration: () => 'millions of years, until parts collapse',
      temp: () => '~10–20 K',
      body: () => `
        <p>Stars form inside cold, dense clouds of molecular hydrogen (H₂) and dust, at about 10 K. Cold gas has low pressure, so gravity has an easier job.</p>
        <p><b>What tips it over.</b> Collapse can be triggered by a <dfn data-g="shock">shock wave</dfn>: the expanding blast from a nearby supernova, a collision between clouds, or a spiral-arm density wave. The shock compresses part of the cloud until its own gravity wins.</p>
        <p class="muted"><b>Current research:</b> most star formation is thought to come from supersonic turbulence plus the cloud's own self-gravity. Turbulence makes dense filaments and clumps that collapse on their own; triggering by outside shocks accounts for only a minority of stars.</p>
        <p><b>Radiation is secondary.</b> X-rays, UV and gamma rays from hot stars and supernovae mostly heat and ionize gas, which <i>resists</i> collapse. They can squeeze the edge of a cloud (radiation-driven implosion), but compression (from shocks or turbulence) does most of the work.</p>`,
      facts: (M) => [['Typical density', '10²–10⁶ molecules/cm³'], ['Composition', '~74% H, ~25% He, ~1–2% heavier (by mass)']],
      myth: 'Gamma rays from a supernova do not "ignite" a cloud. Radiation heats gas, and hot gas pushes back against gravity.',
    },
    collapse: {
      title: 'Collapse and fragmentation', phase: 'Birth',
      view: () => ({ mode: 'collapse' }),
      fusion: () => 'None',
      support: { kind: 'losing', label: 'Gravity beats gas pressure' },
      duration: () => P.freeFallTime(1e4) / P.K.yr,
      temp: () => 'starts ~10 K, rising',
      body: () => `
        <p>A clump collapses once its mass exceeds the <dfn data-g="jeans">Jeans mass</dfn>, the mass at which gravity outweighs thermal pressure. Colder and denser gas has a smaller Jeans mass, so it collapses more easily.</p>
        <p>As it collapses, density rises and the Jeans mass drops, so the cloud <b>fragments</b> into many clumps. That is why stars are born in <dfn data-g="open">clusters</dfn>, not one at a time.</p>
        <p>The collapse time is set by the <dfn data-g="freefall">free-fall time</dfn>, about a few hundred thousand years at typical densities.</p>`,
      facts: () => [['Jeans mass at 10 K, 10⁴ cm⁻³', Fmt.sig(P.jeansMass(10, 1e4) / P.K.Msun, 2) + ' M☉'], ['Free-fall time', yrs(P.freeFallTime(1e4) / P.K.yr)]],
      myth: 'The cloud does not heat up first and then collapse. Collapse comes first, and the collapse causes the heating.',
    },
    protostar: {
      title: 'Protostar and disk', phase: 'Birth',
      view: () => ({ mode: 'disk' }),
      fusion: () => 'None yet (deuterium burns briefly)',
      support: { kind: 'thermal', label: 'Heat from contraction, not fusion' },
      duration: (M) => P.preMSTime(M),
      temp: () => 'core rising toward 10⁷ K',
      body: (M) => `
        <p>Falling gas turns gravitational energy into heat. The core glows, but it is <b>not fusing hydrogen</b>. Its light comes from contraction (the <dfn data-g="kh">Kelvin–Helmholtz</dfn> mechanism).</p>
        <p><b>Why a disk.</b> The clump had a slight spin. As it shrinks, it spins faster (conservation of angular momentum, L = Iω). Material along the spin axis falls straight in, but material in the equator is held out by rotation, so it flattens into a disk.</p>
        <p><b>Nebular hypothesis.</b> Planets form in this disk: dust grains stick, grow into planetesimals, then planets. That is why the planets orbit in nearly one plane and in the same direction the Sun spins.</p>
        <p>Bipolar jets blast out along the spin axis, carrying away angular momentum so the star can keep accreting. Where they hit surrounding gas they make glowing <dfn data-g="hh">Herbig-Haro objects</dfn>.</p>
        <p>Once the dust clears, a young low-mass star is seen as a <dfn data-g="ttauri">T Tauri star</dfn>: still contracting, variable, with a disk and strong winds.</p>
        ${M < 0.12 ? '<p><b>Just above the line.</b> Below ~0.08 M☉ a collapsing clump never gets hot enough to fuse hydrogen; it becomes a <dfn data-g="brown">brown dwarf</dfn>, glowing faintly as it contracts and cools.</p>' : ''}`,
      facts: (M) => [['Contraction time (approx.)', yrs(P.preMSTime(M))], ['H-R track', M < 2 ? 'Hayashi track (cool, bright, convective)' : 'Henyey track (radiative)']],
      myth: 'A protostar is not a star yet. No core hydrogen fusion means no main sequence.',
    },
    zams: {
      tr: ['High-mass stars (about 1.5 M☉ and up) use the CNO cycle; low-mass stars use the p-p chain.', 'The crossover is usually quoted near 1.3 M☉ (core ~17 million K). Both numbers are approximate; the change is gradual.'],
      title: 'Zero-age main sequence', phase: 'Main sequence',
      view: () => ({ mode: 'cutaway' }),
      fusion: (M) => M > L.cno ? 'H → He by the CNO cycle' : 'H → He by the p-p chain',
      support: { kind: 'fusion', label: 'Thermal pressure from fusion energy' },
      duration: () => 'the moment fusion takes over',
      temp: (M) => M > L.cno ? 'core > 1.7 × 10⁷ K' : 'core ~1–1.5 × 10⁷ K',
      body: (M) => `
        <p>This is the <dfn data-g="zams">zero-age main sequence</dfn>. At about 10 million K, protons collide hard enough to overcome their electrical repulsion (with help from quantum tunnelling), and hydrogen fusion starts. Contraction stops.</p>
        <p><b>Why it stops.</b> Fusion energy heats the core, raising its pressure until it exactly balances the weight of the layers above. This balance is <dfn data-g="hydro">hydrostatic equilibrium</dfn>, dP/dr = −G M(r) ρ / r².</p>
        <p>${M > L.cno
          ? `At ${M.toFixed(1)} M☉ the core is hot enough for the <b>CNO cycle</b> to dominate. Its rate rises roughly as T¹⁶⁻²⁰, so energy release is concentrated in the very centre and the core convects.`
          : `At ${M.toFixed(1)} M☉ the <b>p-p chain</b> dominates. Its rate rises only as ~T⁴, so it runs steadily in a broad core.`}</p>`,
      facts: (M) => { const h = P.hrPosition('zams', M), Lz = Math.pow(10, h.logL), Tz = Math.pow(10, h.logT), Rz = Math.sqrt(Lz) / Math.pow(Tz / P.K.Tsun, 2); return [['Luminosity at ZAMS', Fmt.sig(Lz, 3) + ' L☉' + (Math.abs(M - 1) < 0.05 ? ' (the young Sun)' : '')], ['Radius', Fmt.sig(Rz, 3) + ' R☉'], ['Surface temperature', Fmt.sig(Tz, 3) + ' K']]; },
      myth: 'Fusion does not make the star explode outward. It balances gravity. Too much fusion makes the core expand and cool, which slows fusion. It is self-regulating.',
    },
    ms: {
      tr: ['The Sun spends about 11 billion years on the main sequence.', 'Models give roughly 10–11 billion years, depending on how the end is defined. This app uses 10 billion years as the round model value; the Sun is ~4.6 billion years in.'],
      title: 'Main sequence', phase: 'Main sequence',
      view: () => ({ mode: 'cutaway' }),
      fusion: (M) => M > L.cno ? 'H → He (CNO cycle)' : 'H → He (p-p chain)',
      support: { kind: 'fusion', label: 'Thermal pressure from fusion energy' },
      duration: (M) => msT(M),
      temp: (M) => M > L.cno ? 'core 2–4 × 10⁷ K' : 'core ~1.5 × 10⁷ K',
      body: (M) => `
        <p>The longest stage: about 90% of a star's life. The core slowly converts hydrogen to helium.</p>
        <p><b>Why heavy stars die young.</b> Luminosity rises steeply with mass (L ∝ M^3.5 for mid-range stars), but fuel only rises as M. So lifetime falls fast. A rough rule is t ≈ 10¹⁰ yr × M^−2.5, which works near 1 M☉ but fails in both directions further out: it gives too long a life for 2–10 M☉ stars and too short a life above ~20 M☉, where L rises only about as fast as M and winds strip mass.</p>
        <p>As helium builds up, the core contracts slightly and heats, so the star slowly brightens. The Sun is about 30% brighter now than when it formed.</p>
        ${M < L.redDwarfFate ? '<p>A red dwarf this small lives longer than the current age of the universe (13.8 billion years). Because convection stirs the whole star, it burns nearly all of its hydrogen instead of ~10% in a core, so it outlives even the M^−2.5 rule by ~10× (trillions of years). <b>No red dwarf has ever left the main sequence.</b></p>' : ''}`,
      facts: (M) => [['Main-sequence lifetime', yrs(msT(M))], ['Rule-of-thumb lifetime (M^−2.5)', yrs(P.simpleLifetime(M))], ['Mass converted to energy', '0.7% of the hydrogen fused']],
      myth: 'More fuel does not mean a longer life. A 10 M☉ star has 10× the fuel but burns it thousands of times faster.',
    },
    rd_far: {
      title: 'Blue dwarf (far future)', phase: 'Red dwarf fate',
      view: () => ({ mode: 'cutaway', stageLayers: 'hewd', surfaceT: 7000 }),
      fusion: () => 'Last hydrogen → helium',
      support: { kind: 'fusion', label: 'Fusion, fading out' },
      duration: () => 'trillions of years from now',
      temp: () => 'surface up to ~8,000 K',
      body: () => `
        <p>Because the whole star convects, a red dwarf burns almost all its hydrogen, not just a core. Models predict it gets slightly hotter and bluer near the end (a "blue dwarf"), never swelling into a giant.</p>
        <p>This is theoretical. The universe is too young for any to exist yet.</p>`,
      facts: () => [['Status', 'Predicted, never observed']],
      myth: 'Red dwarfs never become red giants. They are too small to ignite helium.',
    },
    hewd: {
      title: 'Helium white dwarf', phase: 'Remnant',
      view: () => ({ mode: 'cutaway', surfaceT: 10000 }),
      fusion: () => 'None',
      support: { kind: 'edeg', label: 'Electron degeneracy pressure' },
      duration: () => 'cools forever',
      temp: () => 'cooling',
      body: () => `
        <p>The end state of a red dwarf: a helium white dwarf that slowly cools. Never too massive for electron degeneracy to support, so no supernova.</p>
        <p>(Helium white dwarfs observed today form differently: a binary partner strips a red giant's envelope early.)</p>`,
      facts: (M) => [['Mass', Fmt.sig(P.whiteDwarfMass(M), 2) + ' M☉']],
      myth: '',
    },
    subgiant: {
      title: 'Subgiant: core runs dry', phase: 'Post main sequence',
      view: () => ({ mode: 'cutaway' }),
      fusion: () => 'H → He in a shell around an inert He core',
      support: { kind: 'shell', label: 'Shell fusion; core supported by contraction heat' },
      duration: (M) => msT(M) * (M < L.heliumFlash ? 0.04 : 0.01),
      temp: () => 'core heating',
      body: (M) => `
        <p>Core hydrogen runs out. The helium core has no fusion, so it loses pressure support, <b>contracts and heats</b>.</p>
        <p>That heat ignites hydrogen in a <dfn data-g="shell">shell</dfn> around the core. The shell burns hotter than the old core did, so the star gets brighter.</p>
        <p><b>Why the envelope swells.</b> The extra energy from the shell pushes the outer layers out. Bigger surface area at the same luminosity means a cooler surface, so the star moves right on the H-R diagram.</p>
        ${M >= L.heliumFlash ? '<p>For stars above ~2 M☉ this crossing is so fast it leaves a gap in the H-R diagram (the <b>Hertzsprung gap</b>).</p>' : ''}`,
      facts: (M) => [['Duration', yrs(msT(M) * (M < L.heliumFlash ? 0.04 : 0.01))]],
      myth: 'The core does not cool when fusion stops. It contracts, and contraction heats it.',
    },
    rgb: {
      tr: ['A Sun-like red giant grows to about 165 times its original diameter (and about 180 on the asymptotic giant branch).', 'Models range from ~170 to ~250 R☉ (0.8–1.2 AU) at the red-giant tip (e.g. Sackmann 1993; Schröder & Smith 2008). Whether Earth is swallowed depends on how much mass the Sun loses and on tides; it is still debated.'],
      title: 'Red giant branch', phase: 'Post main sequence',
      view: () => ({ mode: 'cutaway' }),
      fusion: () => 'H → He in a shell',
      support: { kind: 'shell', label: 'Shell fusion; core supported by degeneracy or heat' },
      duration: (M) => msT(M) * (M < L.heliumFlash ? 0.09 : 0.01),
      temp: () => 'surface ~3,100–4,500 K',
      body: (M) => `
        <p>The envelope expands to ~100+ solar radii: the Sun will reach roughly 0.8–1.2 AU at the red-giant tip, engulfing Mercury and Venus and possibly Earth. The surface cools to red.</p>
        <p>Helium ash from the shell rains onto the core, which keeps growing and heating.</p>
        ${M < L.heliumFlash
          ? `<p><b>The core becomes degenerate.</b> Electrons are packed so tightly that quantum rules (Pauli exclusion) provide the pressure, not heat. Degenerate pressure does not depend on temperature, which sets up the helium flash.</p>`
          : `<p>At ${M.toFixed(1)} M☉ the core stays non-degenerate, so helium will ignite smoothly with no flash.</p>`}`,
      facts: (M) => [['Peak luminosity', M < L.heliumFlash ? '~2,000–3,000 L☉ at the tip' : Fmt.sig(P.zams(M).L * 4, 2) + ' L☉']],
      myth: 'A red giant is not hotter than before. Its surface is cooler. It is brighter only because it is enormous.',
    },
    heflash: {
      tr: ['Within minutes helium fuses into carbon and the core explodes in what astronomers call a helium flash.', 'Nothing explodes. The flash releases enormous power for a few hours, but it is absorbed inside the core, lifting the degeneracy. The surface shows almost nothing; the core then expands and the star dims onto the horizontal branch.'],
      title: 'Helium flash', phase: 'Post main sequence',
      view: () => ({ mode: 'cutaway', flash: true }),
      fusion: () => 'Runaway triple-alpha in the core',
      support: { kind: 'edeg', label: 'Electron degeneracy, then thermal pressure' },
      duration: () => 'peak runaway lasts hours',
      temp: () => 'core ~10⁸ K',
      body: () => `
        <p>The degenerate core reaches ~10⁸ K and helium ignites. In normal gas, heating raises pressure, the core expands and cools, and fusion slows down. <b>Degenerate gas does not expand when heated</b>, so fusion speeds up, which heats it further: a runaway.</p>
        <p>For a few hours the core may produce ~10¹⁰ L☉, comparable to a whole galaxy. Almost none of it reaches the surface. It goes into lifting the degeneracy. Then the core expands and burns helium steadily.</p>`,
      facts: () => [['Mass range', 'below ~2 M☉']],
      myth: 'The helium flash is not visible from outside. The star does not explode.',
    },
    hb: {
      title: 'Horizontal branch / red clump', phase: 'Helium burning',
      view: () => ({ mode: 'cutaway' }),
      fusion: () => 'He → C, O in core (triple-alpha); H → He in shell',
      support: { kind: 'fusion', label: 'Thermal pressure from helium fusion' },
      duration: (M) => msT(M) * 0.012,
      temp: () => 'core ~10⁸ K',
      body: () => `
        <p>The star shrinks and settles, burning helium steadily in the core by the <b>triple-alpha process</b> and hydrogen in a shell.</p>
        <p>A Sun-like star (with the Sun's metal content) sits in the <b>red clump</b>. Old, <dfn data-g="metalpoor">metal-poor</dfn> stars in <dfn data-g="globular">globular clusters</dfn> spread along a bluer <b>horizontal branch</b>. Where it crosses the <dfn data-g="strip">instability strip</dfn>, stars pulsate as <dfn data-g="rrlyrae">RR Lyrae</dfn> variables: standard candles used to find the distance to the galactic centre.</p>
        <p>Helium burning yields only ~10% as much energy per unit mass as hydrogen burning, so this phase is short.</p>`,
      facts: (M) => [['Duration', yrs(msT(M) * 0.012)], ['Luminosity', '~50 L☉']],
      myth: '',
    },
    blueloop: {
      tr: ['Cepheids are higher-mass, more luminous pulsating stars.', 'Classical Cepheids are roughly 4–10 M☉ stars crossing the instability strip during core helium burning; the exact mass range depends on metal content.'],
      title: 'Core helium burning (blue loop)', phase: 'Helium burning',
      view: () => ({ mode: 'cutaway' }),
      fusion: () => 'He → C, O in core; H → He in shell',
      support: { kind: 'fusion', label: 'Thermal pressure from helium fusion' },
      duration: (M) => msT(M) * 0.15,
      temp: () => 'core ~1–2 × 10⁸ K',
      body: (M) => `
        <p>Helium ignites gently (no flash, because the core is not degenerate). During helium burning the star makes a loop toward the blue side of the H-R diagram.</p>
        ${M >= 4 ? `<p><b>Cepheids.</b> At ${M.toFixed(1)} M☉ the loop crosses the instability strip. The star pulsates regularly, and its period tracks its luminosity (the Leavitt law). That makes <dfn data-g="cepheid">Cepheid variables</dfn> standard candles out to other galaxies.</p>` : '<p>Below ~4 M☉ the loop is short and stays red of the instability strip.</p>'}`,
      facts: (M) => [['Duration', yrs(msT(M) * 0.15)]],
      myth: '',
    },
    agb: {
      title: 'Asymptotic giant branch', phase: 'Late giant',
      view: () => ({ mode: 'cutaway' }),
      fusion: () => 'He → C, O and H → He in two shells',
      support: { kind: 'shell', label: 'Two burning shells around a degenerate C/O core' },
      duration: (M) => msT(M) * (M < L.heliumFlash ? 0.002 : 0.01),
      temp: () => 'surface ~3,000 K',
      body: () => `
        <p>Core helium runs out. Now the core is degenerate carbon and oxygen, and the star has <b>two</b> burning shells. It climbs to a second, brighter red giant phase.</p>
        <p>The helium shell fires in <b>thermal pulses</b>, dredging fresh carbon to the surface (carbon stars). Between the shells, the <dfn data-g="sprocess">s-process</dfn> builds barium, strontium and lead by slow neutron capture.</p>
        <p>The core will never reach the ~6 × 10⁸ K needed to fuse carbon. Strong winds strip the envelope: a Sun-like star loses about half its mass, and a 5 M☉ star about 80% (leaving a ~1 M☉ white dwarf).</p>`,
      facts: (M) => [['Peak luminosity', Fmt.sig(P.agbLuminosity(M), 2) + ' L☉'], ['Core (future white dwarf)', Fmt.sig(P.whiteDwarfMass(M), 2) + ' M☉']],
      myth: '',
    },
    pn: {
      title: 'Planetary nebula', phase: 'Death (low mass)',
      view: () => ({ mode: 'pn' }),
      fusion: () => 'Shell fusion shuts off',
      support: { kind: 'edeg', label: 'Core supported by electron degeneracy' },
      duration: () => 2e4,
      temp: () => 'central star ~100,000 K',
      body: () => `
        <p>The last of the envelope drifts off. The exposed core is extremely hot (~100,000 K) and floods the gas with UV, making it glow. The shell expands at ~20–30 km/s and fades in ~10,000–50,000 years.</p>
        <p>The name is a historical mistake. Early telescopes showed round disks that looked like planets. They have nothing to do with planets.</p>
        <p>This returns carbon, nitrogen and s-process elements to space for the next generation of stars.</p>`,
      facts: () => [['Visible lifetime', '~10,000–50,000 years']],
      myth: 'A planetary nebula is not related to planets, and it is not an explosion.',
    },
    wd: {
      tr: ['The Chandrasekhar limit is 1.4 solar masses.', 'More precisely ~1.44 M☉ for a carbon-oxygen white dwarf (it depends slightly on composition). 1.4 is the usual rounded value.'],
      title: 'White dwarf', phase: 'Remnant',
      view: () => ({ mode: 'cutaway', surfaceT: 25000 }),
      fusion: () => 'None. Shines from stored heat.',
      support: { kind: 'edeg', label: 'Electron degeneracy pressure' },
      duration: () => 'cools for > 10¹⁵ years',
      temp: () => 'starts ~100,000 K, cools',
      body: (M) => `
        <p>A carbon-oxygen core about the size of Earth with ~${P.whiteDwarfMass(M).toFixed(2)} M☉. No fusion. It glows only from leftover heat.</p>
        <p><b>What holds it up.</b> Electron <dfn data-g="degeneracy">degeneracy pressure</dfn>: electrons cannot share quantum states, so they resist compression even at zero temperature.</p>
        <p><b>Odd rule:</b> more massive white dwarfs are <i>smaller</i>. Above the <dfn data-g="chandra">Chandrasekhar limit</dfn> (~1.4 M☉) degeneracy pressure cannot win and it would collapse.</p>
        <p>The coolest white dwarfs in a cluster give its minimum age, which is how globular clusters are dated to 10–13 billion years.</p>`,
      facts: (M) => { const m = P.whiteDwarfMass(M), R = P.whiteDwarfRadius(m); return [['Mass', m.toFixed(2) + ' M☉'], ['Radius', Fmt.sig(R * P.K.Rsun / 1e3, 3) + ' km'], ['Density', Fmt.sig(m * P.K.Msun / (4 / 3 * Math.PI * Math.pow(R * P.K.Rsun, 3)) / 1000, 2) + ' g/cm³']]; },
      myth: 'A lone white dwarf never explodes. It just fades toward a cold "black dwarf" (none exist yet).',
    },
    nova: {
      title: 'Nova (binary)', phase: 'Binary outcomes',
      view: () => ({ mode: 'binary', kind: 'nova' }),
      fusion: () => 'Runaway H fusion on the white dwarf surface',
      support: { kind: 'edeg', label: 'White dwarf survives' },
      duration: () => 'weeks to fade; repeats every ~10⁴ yr',
      temp: () => '',
      body: () => `
        <p>A white dwarf pulls hydrogen off a close partner. The gas piles up on its surface, compressed and heated by the white dwarf's strong gravity. At ~10⁷ K it ignites in a thermonuclear runaway and blasts off.</p>
        <p>The star brightens 10,000–1,000,000× for weeks. <b>The white dwarf survives</b> and can repeat (recurrent novae).</p>`,
      facts: () => [['Brightening', '~10⁴–10⁶×']],
      myth: 'A nova is not a small supernova. Only a surface layer explodes.',
    },
    sn1a: {
      tr: ['Hydrogen accumulates on the white dwarf until it nears ~1.38 M☉, just short of the Chandrasekhar limit; carbon then ignites in a runaway and the star explodes (single-degenerate model).', 'Still debated. Many Type Ia supernovae may come from two white dwarfs merging (double-degenerate model). Both explain the missing hydrogen lines.'],
      title: 'Type Ia supernova (binary)', phase: 'Binary outcomes',
      view: () => ({ mode: 'binary', kind: 'sn1a' }),
      fusion: () => 'Runaway carbon fusion through the whole white dwarf',
      support: { kind: 'none', label: 'Nothing. Star destroyed.' },
      duration: () => 'peaks in ~3 weeks',
      temp: () => '',
      body: () => `
        <p>A white dwarf grows (from a partner, or by merging with another white dwarf) until it nears ~1.4 M☉. Carbon ignites in the degenerate core and burns through the entire star in about a second.</p>
        <p><b>Nothing is left.</b> The explosion makes ~0.6 M☉ of radioactive ⁵⁶Ni, whose decay (⁵⁶Ni → ⁵⁶Co → ⁵⁶Fe) powers the light. Type Ia supernovae make much of the universe's iron.</p>
        <p>Peak brightness is nearly uniform, so they are standard candles. They revealed the accelerating expansion of the universe (Nobel Prize, 2011).</p>
        <p><b>Spectrum test:</b> no hydrogen lines.</p>`,
      facts: () => [['Peak luminosity', '~5 × 10⁹ L☉'], ['Remnant', 'none']],
      myth: 'Type Ia is not a core collapse. No neutron star or black hole is left.',
    },
    rsg: {
      title: 'Supergiant: helium burning', phase: 'Massive star',
      view: () => ({ mode: 'cutaway' }),
      fusion: () => 'He → C, O in core; H → He in shell',
      support: { kind: 'fusion', label: 'Thermal pressure from helium fusion' },
      duration: (M) => msT(M) * 0.12,
      temp: () => 'core ~2 × 10⁸ K',
      body: (M) => `
        <p>The core ignites helium smoothly. The envelope swells to hundreds of solar radii. ${M <= L.blackHole ? 'It becomes a <b>red supergiant</b> like Betelgeuse.' : 'Stars this heavy lose so much mass in winds that they may stay blue or become <b>Wolf-Rayet stars</b> with their hydrogen stripped away.'}</p>
        <p>Massive stars lose mass constantly through winds, which affects what remnant they leave.</p>`,
      facts: (M) => [['Duration', yrs(msT(M) * 0.12)], ['Luminosity', Fmt.sig(P.zams(M).L * 1.4, 2) + ' L☉']],
      myth: '',
    },
    onion: {
      title: 'Onion shells up to iron', phase: 'Massive star',
      view: () => ({ mode: 'cutaway' }),
      fusion: () => 'C, Ne, O, Si burning in nested shells',
      support: { kind: 'fusion', label: 'Fusion, ever faster' },
      duration: (M) => { const t = (e) => window.Evo ? window.Evo.burnTime(e, M) : null, c = t('C'), si = t('Si'); return c ? `C ~${Fmt.sig(c, 2)} yr → Si ~${si * 365.25 < 2 ? Fmt.sig(si * 365.25 * 24, 2) + ' hours' : Fmt.sig(si * 365.25, 2) + ' days'}` : 'C centuries → Si days'; },
      temp: () => 'core 10⁹ K and rising',
      body: () => `
        <p>Each time a fuel runs out, the core contracts, heats, and ignites the next one. The result is an onion of shells, each <dfn data-g="burning">burning</dfn> at its base.</p>
        <p><b>Why each stage is shorter.</b> Each fuel releases less energy per gram, and at these temperatures neutrinos carry energy straight out of the core. In a 25 M☉ star, carbon burning lasts ~500 years, neon ~1 year, oxygen ~5 months and silicon <b>about a day</b>.</p>
        <p><b>The iron wall.</b> Silicon burning makes iron-peak nuclei. These sit at the top of the <dfn data-g="binding">binding-energy curve</dfn>, so fusing them absorbs energy instead of releasing it. The iron core grows with no energy source.</p>
        <p>The surface has no idea. Light takes far longer to leave than the core takes to finish.</p>`,
      facts: () => [['Si burning (25 M☉)', '~0.7 days'], ['Core temperature', '~3.6 × 10⁹ K']],
      myth: 'Iron is not "unburnable" because it is heavy. It is because iron-peak nuclei are the most tightly bound. Fusion past them costs energy.',
    },
    corecollapse: {
      tr: ['Stars above about 8 M☉ explode; the heaviest leave black holes, lighter ones neutron stars.', 'The mapping is not a clean cut. Simulations find "islands of explodability": some 20–30 M☉ stars may fail to explode and collapse straight to black holes, while some heavier ones explode. The ~25 M☉ black-hole cutoff here is a rough average.'],
      title: 'Core collapse', phase: 'Massive star',
      view: () => ({ mode: 'cutaway', collapse: true }),
      fusion: () => 'None in the core',
      support: { kind: 'losing', label: 'Electron degeneracy fails' },
      duration: () => 1 / P.K.yr * 0.3,
      temp: () => '> 10¹⁰ K',
      body: () => `
        <p>The iron core passes ~1.4 M☉. Two things kill its support at once: electrons are squeezed into protons (p + e⁻ → n + ν), and high-energy photons break iron apart (photodisintegration). Both remove pressure.</p>
        <p>The core collapses in about <b>a quarter of a second</b>, at up to ~25% of light speed, from Earth-sized to ~20 km.</p>
        <p>At nuclear density, neutron degeneracy and the strong force stiffen the core. Infalling matter slams into it and rebounds as a shock wave.</p>`,
      facts: () => [['Collapse time', '~0.25 s'], ['Neutrinos released', '~10⁵⁸']],
      myth: 'The core does not explode. It collapses. The outer layers are what get blown off.',
    },
    sn2: {
      tr: ['Free neutrons made during core collapse are captured by nuclei, building elements heavier than iron, which the Type II blast spreads into space.', 'Ordinary core-collapse supernovae make iron-peak elements and some lighter neutron-capture elements, but probably little gold or platinum. The GW170817 kilonova (2017) showed neutron star mergers make heavy r-process elements; rare collapsars may add some.'],
      title: 'Type II supernova', phase: 'Massive star',
      view: () => ({ mode: 'supernova' }),
      fusion: () => 'Explosive nucleosynthesis in the outgoing shock',
      support: { kind: 'none', label: 'Outer layers ejected' },
      duration: () => 'months to fade',
      temp: () => '',
      body: (M) => `
        <p>The rebound shock stalls, then is re-energized by neutrinos from the hot core. It blows off the outer layers at ~10,000 km/s.</p>
        <p><b>Energy budget.</b> ~99% of the energy leaves as neutrinos. Only ~1% becomes motion and ~0.01% light, and that light can rival a whole galaxy. Neutrinos from SN 1987A were detected on Earth hours before the light arrived.</p>
        <p>The shock fuses fresh elements as it passes through the shells, and scatters everything the star made over its life.</p>
        <p><b>Spectrum test:</b> hydrogen lines present (the envelope survived).</p>
        ${M > L.blackHole ? '<p>Above ~25 M☉, some stars may collapse straight to a black hole with a weak explosion or none (a "failed supernova").</p>' : ''}`,
      facts: () => [['Peak luminosity', '~10⁹ L☉'], ['Energy in neutrinos', '~3 × 10⁴⁶ J (~99%)']],
      myth: 'Ordinary Type II supernovae are not the main source of gold. Current evidence points to neutron star mergers. See the heavy-elements tab.',
    },
    ns: {
      tr: ['A neutron star is left if the remnant is between 1.4 and 3 M☉; it is about 12 miles across.', 'Observed pulsars reach ~2.0–2.1 M☉ and theory puts the maximum (TOV limit) near 2.2–2.3 M☉. 12 miles ≈ 20 km diameter, i.e. ~10–12 km radius.'],
      title: 'Neutron star', phase: 'Remnant',
      view: () => ({ mode: 'cutaway', surfaceT: 1e6, compact: 'ns' }),
      fusion: () => 'None',
      support: { kind: 'ndeg', label: 'Neutron degeneracy + strong force' },
      duration: () => 'cools over ~10⁶–10⁷ yr',
      temp: () => 'surface ~10⁶ K (X-rays)',
      body: () => `
        <p>About 1.4 M☉ packed into a sphere ~12 km in radius (~24 km across), about the size of a city. Density is around that of an atomic nucleus: a teaspoon would weigh ~10⁹ tonnes.</p>
        <p><b>What holds it up.</b> Neutron degeneracy pressure plus the repulsive core of the strong force. Above ~2–2.3 M☉ (the <dfn data-g="tov">TOV limit</dfn>, not precisely known) nothing can stop collapse to a black hole.</p>
        <p><b>Spin and field.</b> The collapse conserves angular momentum and magnetic flux, so the star spins many times a second with a field ~10⁸–10¹¹ T (10¹²–10¹⁵ gauss).</p>`,
      facts: () => { const M = P.NS_MASS * P.K.Msun, R = P.NS_RADIUS_KM * 1e3, rs = P.schwarzschildRadius(M); return [['Escape velocity', Fmt.sig(P.escapeVelocity(M, R) / P.K.c, 2) + ' c'], ['rₛ / R (compactness)', Fmt.sig(rs / R, 2)], ['Surface gravity', Fmt.sig(P.surfaceGravity(M, R) / 9.81, 2) + ' g']]; },
      myth: 'A neutron star is not "a pulsar later." Pulsar describes how we see some neutron stars.',
    },
    pulsar: {
      tr: ['Pulsars are best detected by radio telescopes; their visible light is practically impossible to detect.', 'True for almost all pulsars. A few young ones, like the Crab pulsar, do pulse in visible light and X-rays.'],
      title: 'Pulsar (a neutron star seen from the beam)', phase: 'Remnant',
      view: () => ({ mode: 'cutaway', surfaceT: 1e6, compact: 'ns', beams: true }),
      fusion: () => 'None',
      support: { kind: 'ndeg', label: 'Neutron degeneracy + strong force' },
      duration: () => 'radio-active for ~10⁷ yr',
      temp: () => '',
      body: () => `
        <p>The magnetic axis is tilted from the spin axis. Charged particles stream along the field and beam radiation out of both magnetic poles. As the star spins, the beams sweep around like a <b>lighthouse</b>.</p>
        <p>If a beam crosses Earth, we see a pulse every rotation. That is a pulsar. If the beams miss us, it is still a neutron star, just not a pulsar from our viewpoint.</p>
        <p>Pulsars spin down as they radiate. Millisecond pulsars are old ones spun back up by stealing matter from a partner.</p>
        <p><b>Magnetar:</b> a neutron star with an extreme field (~10¹¹ T). Not a separate kind of object.</p>`,
      facts: () => [['Periods', '~1.4 ms to over a minute'], ['First discovered', '1967, Jocelyn Bell Burnell']],
      myth: 'Pulsars do not turn on and off. The beam is steady; it only seems to pulse because it sweeps past us.',
    },
    xrb: {
      title: 'X-ray binary', phase: 'Binary outcomes',
      view: (M) => ({ mode: 'binary', kind: M > L.blackHole ? 'xrb-bh' : 'xrb-ns' }),
      fusion: () => 'Partner star only',
      support: { kind: 'none', label: '' },
      duration: () => '',
      temp: () => 'disk ~10⁷ K',
      body: (M) => `
        <p>Gas flowing from a partner star cannot fall straight in. It has too much angular momentum, so it forms an <b>accretion disk</b>. Friction heats the inner disk to ~10⁷ K, hot enough to glow in X-rays.</p>
        <p>This is how we find ${M > L.blackHole ? 'black holes (Cygnus X-1 was the first, measured at ~21 M☉)' : 'neutron stars that are not pulsars'}: weigh the unseen companion from the visible star's orbit. Above ~3 M☉, it has to be a black hole.</p>`,
      facts: () => [['Detection', 'X-ray telescopes + orbital mass']],
      myth: 'An X-ray binary is a system, not a type of remnant.',
    },
    kilonova: {
      title: 'Neutron star merger (kilonova)', phase: 'Binary outcomes',
      view: () => ({ mode: 'merger', kind: 'ns' }),
      fusion: () => 'r-process: rapid neutron capture',
      support: { kind: 'none', label: '' },
      duration: () => 'glows for days to weeks',
      temp: () => '',
      body: () => `
        <p>Two neutron stars spiral together as they radiate <b>gravitational waves</b>. On 17 August 2017, LIGO and Virgo detected one (GW170817). 1.7 seconds later a short <b>gamma-ray burst</b> arrived, then a glowing <b>kilonova</b>.</p>
        <p>The kilonova's spectrum showed freshly made heavy elements. Neutron-rich debris undergoes the <dfn data-g="rprocess">r-process</dfn> and makes gold, platinum and uranium. This is the leading source of the universe's gold.</p>`,
      facts: () => [['Ejected heavy elements', '~0.05 M☉ (GW170817)'], ['Remnant', 'likely a black hole']],
      myth: '',
    },
    bh: {
      tr: ['Anything that falls past the event horizon cannot get out, and time effectively stops there.', 'Time only appears to stop to a distant observer. A falling clock crosses the horizon in finite time on its own reading (see the Spacetime tab).'],
      title: 'Black hole', phase: 'Remnant',
      view: (M) => ({ mode: 'bh' }),
      fusion: () => 'None',
      support: { kind: 'none', label: 'Nothing can resist gravity' },
      duration: (M) => { const m = P.blackHoleMass(M), e = Math.floor(Math.log10(2e67 * m ** 3)), sup = String(e).replace(/\d/g, (d) => '⁰¹²³⁴⁵⁶⁷⁸⁹'[d]); return `effectively forever (~10${sup} yr to evaporate a ${Fmt.sig(m, 2)} M☉ hole; Hawking time ≈ 2×10⁶⁷ yr × (M/M☉)³)`; },
      temp: () => '',
      body: (M) => {
        const m = P.blackHoleMass(M), rs = P.schwarzschildRadius(m * P.K.Msun) / 1e3;
        return `
        <p>If the remnant core is above the TOV limit, nothing known can stop it. It collapses to a <dfn data-g="singularity">singularity</dfn> (where general relativity breaks down) surrounded by an <dfn data-g="horizon">event horizon</dfn>.</p>
        <p><b>Schwarzschild radius</b> rₛ = 2GM/c². For a ~${m.toFixed(0)} M☉ black hole, rₛ ≈ ${rs.toFixed(0)} km. Inside it, every path into the future leads inward. Even light cannot escape.</p>
        <p>Key distances for a non-spinning hole: photon sphere at 1.5 rₛ (light can orbit), innermost stable orbit at 3 rₛ (inner edge of accretion disks).</p>
        <p><b><dfn data-g="tidal">Tidal forces</dfn>.</b> Gravity pulls harder on your feet than your head if you fall in feet-first, stretching you (spaghettification). For a ~10 M☉ black hole this kills long before the horizon; for a supermassive one you could cross the horizon without noticing.</p>
        <p>An isolated black hole is dark. We detect them by their effect on nearby matter, by gravitational lensing, and by gravitational waves.</p>
        <p><a href="#blackhole" class="tab-link">See what one looks like in the Black hole camera tab →</a></p>`;
      },
      facts: (M) => { const m = P.blackHoleMass(M); return [['Mass (rough)', '~' + m.toFixed(0) + ' M☉'], ['Schwarzschild radius', Fmt.sig(P.schwarzschildRadius(m * P.K.Msun) / 1e3, 3) + ' km']]; },
      myth: 'Black holes do not suck everything in. At a distance, a 10 M☉ black hole pulls exactly like a 10 M☉ star.',
    },
    bhmerger: {
      title: 'Black hole merger', phase: 'Binary outcomes',
      view: () => ({ mode: 'merger', kind: 'bh' }),
      fusion: () => 'None',
      support: { kind: 'none', label: '' },
      duration: () => 'final orbits take a fraction of a second',
      temp: () => '',
      body: () => `
        <p>Two black holes orbit, radiating <b>gravitational waves</b>: ripples in spacetime itself. The orbit shrinks, speeds up, and they merge.</p>
        <p>The first detection, GW150914 (2015), was two black holes of ~36 and ~29 M☉ merging into ~62 M☉. The missing ~3 M☉ left as gravitational-wave energy (E = mc²). LIGO measured a stretch of space smaller than 1/1000 of a proton's width.</p>
        <p>Usually no light: there is no matter to heat.</p>`,
      facts: () => [['GW150914 energy', '~3 M☉ c²'], ['Nobel Prize', '2017']],
      myth: '',
    },
  };

  function stagePath(M, binary) {
    const p = ['cloud', 'collapse', 'protostar', 'zams', 'ms'];
    if (M < L.redDwarfFate) { p.push('rd_far', 'hewd'); return p; }
    if (M < L.supernova) {
      p.push('subgiant', 'rgb');
      if (M < L.heliumFlash) p.push('heflash', 'hb'); else p.push('blueloop');
      p.push('agb', 'pn', 'wd');
      if (binary) p.push('nova', 'sn1a');
      return p;
    }
    p.push('rsg', 'onion', 'corecollapse', 'sn2');
    if (M < L.blackHole) { p.push('ns', 'pulsar'); if (binary) p.push('xrb', 'kilonova'); }
    else { p.push('bh'); if (binary) p.push('xrb', 'bhmerger'); }
    return p;
  }

  // Photosphere temperature for the 3D surface colour.
  function surfaceTemp(stageId, M) {
    const st = STAGES[stageId], v = st.view(M);
    if (v.surfaceT) return v.surfaceT;
    const hr = P.hrPosition(stageId, M);
    return hr ? Math.pow(10, hr.logT) : 5772;
  }

  /* ---------- Fusion reactions ---------- */
  // Species: label, element colour key, size (nucleons), kind
  const S = {
    p:   { t: '¹H', el: 'H', a: 1 },
    d:   { t: '²H', el: 'H', a: 2 },
    he3: { t: '³He', el: 'He', a: 3 },
    he4: { t: '⁴He', el: 'He', a: 4 },
    be8: { t: '⁸Be', el: 'Be', a: 8 },
    c12: { t: '¹²C', el: 'C', a: 12 },
    c12s:{ t: '¹²C*', el: 'C', a: 12, excited: true },
    c13: { t: '¹³C', el: 'C', a: 13 },
    n13: { t: '¹³N', el: 'N', a: 13 },
    n14: { t: '¹⁴N', el: 'N', a: 14 },
    n15: { t: '¹⁵N', el: 'N', a: 15 },
    o15: { t: '¹⁵O', el: 'O', a: 15 },
    o16: { t: '¹⁶O', el: 'O', a: 16 },
    pos: { t: 'e⁺', el: 'pos', a: 0.3, kind: 'lepton' },
    nu:  { t: 'νₑ', el: 'nu', a: 0.3, kind: 'lepton' },
    gam: { t: 'γ', el: 'gam', a: 0, kind: 'gamma' },
  };

  const REACTIONS = {
    pp: {
      name: 'Proton–proton chain (pp-I)',
      where: 'Cores below ~1.3 M☉, T ≈ 4–17 million K. Powers the Sun (~99% of its energy).',
      rate: 'Rate ∝ T⁴ (gentle). Limited by step 1, a weak-force reaction.',
      net: '4 ¹H → ⁴He + 2e⁺ + 2νₑ + γ rays &nbsp;·&nbsp; <b>26.73 MeV</b> (0.71% of the mass)',
      steps: [
        { in: ['p', 'p'], out: ['d', 'pos', 'nu'], q: '1.44 MeV incl. annihilation', note: 'A proton turns into a neutron (weak force) while fusing. So unlikely that an average proton in the Sun waits ~10 billion years. This is why the Sun lasts so long.' },
        { in: ['d', 'p'], out: ['he3', 'gam'], q: '5.49 MeV', note: 'Fast: about a second. Happens twice per helium made (once after each step 1).' },
        { in: ['he3', 'he3'], out: ['he4', 'p', 'p'], q: '12.86 MeV', note: 'Two ³He nuclei merge. Two protons are returned to the pool.' },
      ],
      extra: 'Side branches: pp-II (³He + ⁴He → ⁷Be, ~17% in the Sun) and pp-III (~0.02%, which makes the high-energy ⁸B neutrinos behind the solar neutrino problem).',
    },
    cno: {
      name: 'CNO cycle (CNO-I)',
      where: 'Cores above ~1.3 M☉, T > ~17 million K. About 1% of the Sun\'s energy (confirmed by Borexino neutrinos, 2020).',
      rate: 'Rate ∝ T¹⁶⁻²⁰ (extremely steep). Carbon is a catalyst: it is returned at the end.',
      net: '4 ¹H → ⁴He + 2e⁺ + 2νₑ + γ rays &nbsp;·&nbsp; <b>26.73 MeV</b>, same net result as pp',
      steps: [
        { in: ['c12', 'p'], out: ['n13', 'gam'], q: '1.94 MeV', note: 'Carbon-12 captures a proton.' },
        { in: ['n13'], out: ['c13', 'pos', 'nu'], q: '2.22 MeV', note: 'β⁺ decay, half-life ~10 minutes. A proton becomes a neutron.' },
        { in: ['c13', 'p'], out: ['n14', 'gam'], q: '7.55 MeV', note: 'Second proton capture.' },
        { in: ['n14', 'p'], out: ['o15', 'gam'], q: '7.30 MeV', note: 'The slowest step, the bottleneck. Material piles up as ¹⁴N, which is why CNO-processed gas is nitrogen-rich.' },
        { in: ['o15'], out: ['n15', 'pos', 'nu'], q: '2.75 MeV', note: 'β⁺ decay, half-life ~2 minutes.' },
        { in: ['n15', 'p'], out: ['c12', 'he4'], q: '4.97 MeV', note: 'An alpha particle (⁴He) splits off. Carbon-12 is back, ready to start again.' },
      ],
      extra: 'Same reaction, different route: four protons in, one helium out. The C, N and O nuclei are only borrowed.',
    },
    ta: {
      name: 'Triple-alpha process',
      where: 'Helium cores at ~100 million K: horizontal branch, red clump, supergiants.',
      rate: 'Rate ∝ T⁴⁰ (absurdly steep). This is why the degenerate helium flash runs away.',
      net: '3 ⁴He → ¹²C + γ &nbsp;·&nbsp; <b>7.275 MeV</b>, then ¹²C + ⁴He → ¹⁶O',
      steps: [
        { in: ['he4', 'he4'], out: ['be8'], q: '−0.092 MeV', note: '⁸Be is unstable and falls apart in ~10⁻¹⁶ s. Only at very high density does a third helium arrive in time.' },
        { in: ['be8', 'he4'], out: ['c12s'], q: '−0.288 MeV (up to the Hoyle resonance)', note: 'Forms carbon-12 in an excited state at 7.65 MeV: the Hoyle state, predicted by Fred Hoyle in 1953 because carbon exists.' },
        { in: ['c12s'], out: ['c12', 'gam'], q: '7.65 MeV', note: 'Only about 1 in 2,400 Hoyle states settles into stable carbon, mostly by a gamma cascade through the 4.44 MeV level. The rest break back up. Budget: −0.092 − 0.288 + 7.654 = 7.275 MeV.' },
        { in: ['c12', 'he4'], out: ['o16', 'gam'], q: '7.16 MeV', note: 'Alpha capture makes oxygen. The balance of these two steps sets the carbon-to-oxygen ratio of the universe.' },
      ],
      extra: 'Life depends on this: carbon and oxygen both come mostly from helium burning.',
    },
  };

  // Advanced burning in a 25 Msun star (Woosley, Heger & Weaver 2002, Table 1).
  const BURNING = [
    { fuel: 'H', products: 'He', T: '3.8 × 10⁷', time: '6.7 million yr', el: 'H' },
    { fuel: 'He', products: 'C, O', T: '2.0 × 10⁸', time: '840,000 yr', el: 'He' },
    { fuel: 'C', products: 'Ne, Na, Mg', T: '8.4 × 10⁸', time: '520 yr', el: 'C' },
    { fuel: 'Ne', products: 'O, Mg', T: '1.6 × 10⁹', time: '0.9 yr', el: 'Ne' },
    { fuel: 'O', products: 'Si, S', T: '2.1 × 10⁹', time: '0.4 yr', el: 'O' },
    { fuel: 'Si', products: 'Fe, Ni, Cr', T: '3.7 × 10⁹', time: '~0.7 day', el: 'Si' },
  ];

  // Binding energy per nucleon (MeV), selected nuclides.
  const BINDING = [
    ['¹H', 1, 0, 'H'], ['²H', 2, 1.112, 'H'], ['³He', 3, 2.573, 'He'], ['⁴He', 4, 7.074, 'He'],
    ['⁷Li', 7, 5.606], ['⁹Be', 9, 6.463, 'Be'], ['¹²C', 12, 7.680, 'C'], ['¹⁴N', 14, 7.476, 'N'],
    ['¹⁶O', 16, 7.976, 'O'], ['²⁰Ne', 20, 8.032, 'Ne'], ['²⁴Mg', 24, 8.261, 'Mg'], ['²⁸Si', 28, 8.448, 'Si'],
    ['³²S', 32, 8.493], ['⁴⁰Ca', 40, 8.551], ['⁵⁶Fe', 56, 8.790, 'Fe'], ['⁶²Ni', 62, 8.795, 'Ni'],
    ['⁸⁴Kr', 84, 8.717], ['¹²⁰Sn', 120, 8.505], ['¹³⁸Ba', 138, 8.393], ['¹⁹⁵Pt', 195, 7.927, 'Pt'],
    ['¹⁹⁷Au', 197, 7.916, 'Au'], ['²⁰⁸Pb', 208, 7.867], ['²³⁸U', 238, 7.570],
  ];

  /* ---------- Quiz ---------- */
  const QUIZ = [
    { q: 'What can trigger collapse in a molecular cloud?', a: ['Gamma rays from a supernova', 'A shock wave compressing the gas', 'The cloud heating up', 'Magnetic fields'], c: 1, e: 'Shocks compress gas past the Jeans mass. Radiation mostly heats gas, which resists collapse. (Most star formation is thought to come from turbulence plus self-gravity; outside triggers are a minority.)' },
    { q: 'A protostar shines because of…', a: ['Hydrogen fusion', 'Helium fusion', 'Gravitational contraction', 'Radioactive decay'], c: 2, e: 'Kelvin–Helmholtz contraction. Fusion starts at the zero-age main sequence.' },
    { q: 'Why do planets orbit in nearly one plane?', a: ['Gravity from the galaxy', 'They formed in a flattened, spinning disk', 'The Sun pulled them into line', 'Collisions'], c: 1, e: 'Conservation of angular momentum flattens the collapsing cloud into a disk (nebular hypothesis).' },
    { q: 'Which process dominates core fusion in a 10 M☉ star?', a: ['p-p chain', 'CNO cycle', 'Triple-alpha', 'r-process'], c: 1, e: 'Above ~1.3 M☉ the core is hot enough for the steeply temperature-dependent CNO cycle.' },
    { q: 'What happens to the core right after hydrogen runs out?', a: ['It cools and dies', 'It contracts and heats', 'It explodes', 'It fuses iron'], c: 1, e: 'Without fusion pressure, gravity compresses it, and compression heats it.' },
    { q: 'What powers a red giant?', a: ['Helium fusion in the core', 'Hydrogen fusion in a shell around an inert helium core', 'Carbon fusion', 'Contraction only'], c: 1, e: 'The inert helium core is surrounded by a hydrogen-burning shell.' },
    { q: 'Why does the helium flash run away?', a: ['Helium is explosive', 'Degenerate gas does not expand when heated', 'The envelope falls in', 'Neutrinos'], c: 1, e: 'Degeneracy pressure does not depend on temperature, so there is no thermostat until degeneracy lifts.' },
    { q: 'The triple-alpha process makes…', a: ['Helium from hydrogen', 'Carbon from helium', 'Iron from silicon', 'Gold from iron'], c: 1, e: '3 ⁴He → ¹²C via unstable ⁸Be and the Hoyle state.' },
    { q: 'Why does fusion stop at iron?', a: ['Iron is too heavy to move', 'Iron-peak nuclei are the most tightly bound, so fusing them costs energy', 'The star runs out of time', 'Iron is magnetic'], c: 1, e: 'Past the binding-energy peak (~⁵⁶Fe/⁶²Ni), fusion absorbs energy.' },
    { q: 'A pulsar is…', a: ['A stage after a neutron star', 'A neutron star whose beam sweeps across Earth', 'A pulsating red giant', 'A black hole'], c: 1, e: 'Same object; it depends on our viewing angle.' },
    { q: 'Which supernova leaves no remnant?', a: ['Type II', 'Type Ia', 'Both', 'Neither'], c: 1, e: 'Type Ia destroys the white dwarf completely.' },
    { q: 'Spectrum test: hydrogen lines are present in…', a: ['Type Ia', 'Type II', 'Both', 'Neither'], c: 1, e: 'Type II stars keep their hydrogen envelope. White dwarfs have none.' },
    { q: 'Schwarzschild radius of a 10 M☉ black hole?', a: ['~3 km', '~30 km', '~300 km', '~3,000 km'], c: 1, e: 'rₛ ≈ 2.95 km per solar mass, so ~29.5 km.' },
    { q: 'A clock near a neutron star, compared with a distant clock, runs…', a: ['Faster', 'Slower', 'The same', 'Backward'], c: 1, e: 'dτ/dt = √(1 − rₛ/r) < 1. At a neutron star surface it is ~0.8.' },
    { q: 'Where does most gold come from?', a: ['Main-sequence fusion', 'AGB stars', 'Neutron star mergers (r-process)', 'Type Ia supernovae'], c: 2, e: 'Rapid neutron capture in neutron-rich merger debris, confirmed by the GW170817 kilonova.' },
    { q: 'One parsec is the distance at which a star shows a parallax of…', a: ['1 degree', '1 arcminute', '1 arcsecond', '1 milliarcsecond'], c: 2, e: 'Parallax of one arcsecond. 1 pc = 3.26 light-years. d (pc) = 1 / p (arcsec).' },
    { q: 'A radar pulse returns from the Moon after 2.5 s. The distance is about…', a: ['750,000 km', '375,000 km', '190,000 km', '3 million km'], c: 1, e: 'd = c t / 2 = 3 × 10⁵ km/s × 2.5 s / 2 ≈ 375,000 km.' },
    { q: 'What makes a Cepheid a standard candle?', a: ['All Cepheids have the same luminosity', 'Its period tells you its luminosity', 'Its colour tells you its distance', 'It never changes brightness'], c: 1, e: 'Leavitt\'s period–luminosity law: longer period, brighter star. Compare with apparent brightness to get distance.' },
    { q: 'RR Lyrae stars differ from Cepheids because…', a: ['They are more massive', 'They all have about the same luminosity (~50 L☉)', 'They are only found in open clusters', 'They do not pulsate'], c: 1, e: 'Low-mass horizontal-branch stars, all about equally bright. Found in globular clusters.' },
    { q: 'An H II region glows red because…', a: ['Dust reflects starlight', 'Hydrogen ionized by hot stars recombines and emits H-alpha', 'It is very cold', 'It is redshifted'], c: 1, e: 'UV from O/B stars ionizes hydrogen; recombination emits 656 nm red light.' },
    { q: 'Interstellar dust makes background stars look…', a: ['Bluer and brighter', 'Redder and dimmer', 'Redshifted', 'Unchanged'], c: 1, e: 'Extinction dims; blue scatters more, so stars look redder (reddening). Not a Doppler shift.' },
    { q: 'Herbig-Haro objects are…', a: ['Dead stars', 'Glowing gas hit by jets from protostars', 'Planetary nebulae', 'Galaxies'], c: 1, e: 'Polar jets from young stars slam into surrounding gas.' },
    { q: 'A cluster with many red giants and no hot blue main-sequence stars is…', a: ['Young', 'Old', 'Still forming', 'Impossible'], c: 1, e: 'Massive stars have already died; the turnoff has moved down the main sequence.' },
    { q: 'Blue stragglers are explained by…', a: ['Late star formation', 'Mass transfer or mergers between stars', 'Dust', 'Errors in measurement'], c: 1, e: 'In crowded globular clusters, stars gain mass from partners or collide, looking younger than the cluster.' },
    { q: 'How long does a Sun-like star spend fusing helium in its core (the usual round number)?', a: ['11 billion years', '1.3 billion years', '100 million years', '20 million years'], c: 2, e: 'About 100 million years at ~50 L☉ and ~10× its original size.' },
    { q: 'Why does a Type Ia supernova leave no hydrogen lines?', a: ['Hydrogen is destroyed by the blast', 'White dwarfs are made of carbon and oxygen, not hydrogen', 'It is too far away', 'Hydrogen lines are blocked by dust'], c: 1, e: 'The exploding star is a C/O white dwarf. Type II stars keep their hydrogen envelope.' },
    { q: 'Mercury\'s orbit advances 43″ per century more than Newton predicts. This is explained by…', a: ['An unseen planet', 'General relativity', 'Solar wind', 'Measurement error'], c: 1, e: 'Spacetime curvature near the Sun. GR predicts exactly the missing 43″.' },
    { q: 'GPS satellite clocks, before correction, run…', a: ['Slower by ~38 μs/day', 'Faster by ~38 μs/day', 'Exactly on time', 'Faster by ~38 s/day'], c: 1, e: '+45 μs/day from weaker gravity, −7 μs/day from speed: net ~38 μs/day fast.' },
    { q: 'A 1 M☉ white dwarf and the Sun have the same mass. Far from both, their gravity is…', a: ['Stronger for the white dwarf', 'Identical', 'Stronger for the Sun', 'Zero for the white dwarf'], c: 1, e: 'Outside, only mass matters (Birkhoff\'s theorem). The white dwarf\'s well just goes deeper because its surface is smaller.' },
    { q: 'Short gamma-ray bursts (under ~2 s) come mainly from…', a: ['Collapsing massive stars', 'Neutron star mergers', 'Novae', 'Solar flares'], c: 1, e: 'Merging neutron stars (or a neutron star and a black hole). Long bursts come from collapsars.' },
    { q: 'The dark "shadow" in the EHT image of M87* is…', a: ['The event horizon itself', 'About 2.6 times wider than the event horizon', 'Smaller than the event horizon', 'A cloud of dust in front of the hole'], c: 1, e: 'Light aimed within b = (3√3/2) rₛ ≈ 2.6 rₛ falls in, so the hole blocks a patch of sky much larger than its horizon.' },
    { q: 'Why does an accretion disk around a non-spinning black hole have a hole in the middle at ~3 rₛ?', a: ['The gas there is too hot to glow', 'No stable circular orbits exist inside 3 rₛ, so gas plunges in', 'Radiation pressure pushes the gas out', 'The event horizon is at 3 rₛ'], c: 1, e: 'Inside the innermost stable circular orbit (ISCO, 3 rₛ) orbits are unstable; gas spirals straight in.' },
    { q: 'In a picture of a black hole with its disk seen nearly edge-on, the bright arch over the top of the hole is…', a: ['A jet', 'The near side of the disk', 'The far side of the disk, its light bent over the hole', 'The photon sphere glowing'], c: 2, e: 'Light from the part of the disk behind the hole curves up and over it on its way to you (gravitational lensing).' },
    { q: 'One side of a black hole\'s accretion disk looks much brighter mainly because…', a: ['That side is closer to us', 'Gas on that side moves toward us, so it is Doppler-boosted', 'That side is hotter', 'Dust blocks the other side'], c: 1, e: 'Relativistic beaming: brightness scales roughly as g⁴, and g > 1 for gas moving toward you at a sizable fraction of c.' },
  ];

  /* ---------- Glossary ---------- */
  const GLOSS = {
    shock: ['Shock wave', 'A sharp front of compressed gas moving faster than sound in the medium, e.g. a supernova blast.'],
    jeans: ['Jeans mass', 'Minimum mass for a gas clump to collapse under its own gravity. M_J ∝ T^(3/2) ρ^(−1/2).'],
    freefall: ['Free-fall time', 'Time for a cloud to collapse with no pressure support: t_ff = √(3π / 32Gρ).'],
    kh: ['Kelvin–Helmholtz contraction', 'A body radiates energy released by slow gravitational contraction. Timescale t ≈ GM²/(RL).'],
    hydro: ['Hydrostatic equilibrium', 'Outward pressure gradient exactly balancing inward gravity at every depth.'],
    shell: ['Shell burning', 'Fusion in a thin layer around an inert core.'],
    metalpoor: ['Metal-poor / metal-rich', 'In astronomy any element heavier than helium is a "metal". Old stars formed before many supernovae, so they are metal-poor.'],
    globular: ['Globular cluster', 'Dense, spherical, very old cluster of ~10⁴–10⁶ stars in a galaxy\'s halo.'],
    open: ['Open cluster', 'Loose group of young stars in a galaxy\'s disk, born from the same cloud.'],
    strip: ['Instability strip', 'Narrow region of the H-R diagram where stars pulsate: RR Lyrae, Cepheids.'],
    sprocess: ['s-process', 'Slow neutron capture (slower than beta decay). Happens in AGB stars. Makes Sr, Ba, Pb.'],
    rprocess: ['r-process', 'Rapid neutron capture (many captures before any beta decay). Happens in neutron star mergers. Makes Au, Pt, U.'],
    chandra: ['Chandrasekhar limit', '~1.4 M☉. Maximum mass electron degeneracy pressure can support.'],
    tov: ['TOV limit', 'Tolman–Oppenheimer–Volkoff limit, ~2–2.3 M☉. Maximum neutron-star mass.'],
    binding: ['Binding energy per nucleon', 'Energy needed to pull a nucleus apart, divided by its nucleon count. Peaks near iron and nickel.'],
    singularity: ['Singularity', 'Where general relativity predicts infinite density. Signals the theory breaking down, not necessarily a physical point.'],
    horizon: ['Event horizon', 'Boundary at rₛ from which nothing, not even light, can escape.'],
    proper: ['Proper time', 'The time measured by a clock carried along at a location. Differs from a distant observer\'s time in strong gravity.'],
    degeneracy: ['Degeneracy pressure', 'Quantum pressure from the Pauli exclusion principle: identical fermions cannot share a state. Does not depend on temperature.'],
    zams: ['ZAMS', 'Zero-age main sequence: the moment core hydrogen fusion becomes the star\'s energy source.'],
    blue: ['Blue straggler', 'A cluster star bluer and brighter than the turnoff, made younger-looking by mass transfer or merger.'],
    cepheid: ['Cepheid variable', 'Pulsating supergiant whose period tracks its luminosity, used as a standard candle.'],
    rrlyrae: ['RR Lyrae', 'Low-mass pulsating horizontal-branch star, ~50 L☉, used as a standard candle in globular clusters.'],
    hh: ['Herbig-Haro object', 'Glowing knot of gas where a protostar\'s jet slams into the surrounding cloud.'],
    ttauri: ['T Tauri star', 'A young (under ~10 million years), low-mass star still contracting toward the main sequence, often variable and surrounded by a disk.'],
    brown: ['Brown dwarf', 'An object of ~13–80 Jupiter masses (below ~0.08 M☉): too light to fuse ordinary hydrogen, so it slowly cools. Between a planet and a star.'],
    tidal: ['Tidal force', 'The difference in gravity across an object. Near a stellar black hole it stretches anything falling in (spaghettification).'],
    photonsphere: ['Photon sphere', 'The radius (1.5 rₛ for a non-spinning black hole) where light can travel in a circle around the hole. Unstable: a nudge sends it in or out.'],
    isco: ['ISCO', 'Innermost stable circular orbit: 3 rₛ for a non-spinning black hole. Closer in, no orbit is stable, so it marks the inner edge of the accretion disk.'],
    bhshadow: ['Black hole shadow', 'The dark patch a black hole casts on the light behind it. Radius ≈ 2.6 rₛ, larger than the event horizon because light is bent in.'],
    beaming: ['Doppler beaming', 'Light from a source moving toward you at high speed is blueshifted and concentrated forward, so it looks much brighter (∝ g⁴).'],
    burning: ['Burning / ash', 'Astronomer slang: "burning" means fusion, "ash" means its products (helium is hydrogen\'s ash).'],
  };

  global.Data = { EL, mix, Fmt, layers, STAGES, stagePath, surfaceTemp, S, REACTIONS, BURNING, BINDING, QUIZ, GLOSS };
})(window);
