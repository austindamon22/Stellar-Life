/* Stellar Life — Black holes, tab 5 "Frontiers": tested/untested board, shadow-size calculator, quiz */
(function () {
  'use strict';
  const B = window.BK, { $, $$, C, el, txt, fit, sig, sciH, mSun, facts, clamp } = B;
  const TAG = { obs: ['obs', 'Observed'], thy: ['thy', 'Theory, not observed'], spec: ['spec', 'Untested idea'], next: ['next', 'Coming'] };
  const BOARD = [
    { k: 'm87', t: 'obs', name: 'The shadow of M87*', s: 'First image of a black hole, April 2019.', d: 'A ring 42 ± 3 μas across around a dark centre, the size general relativity predicts for 6.5 billion M☉. Images from 2018 onward show the same ring size while the brightest part and the polarisation pattern shift: the ring is set by gravity, the details by turbulent gas. The bright ring is about 10% larger than the shadow edge itself, a factor calibrated with simulations. Polarised light traces magnetic fields at the edge.', why: 'A ring that changed size from year to year, or disagreed with the mass from the motions of stars and gas.' },
    { k: 'sgr', t: 'obs', name: 'The shadow of Sgr A*', s: 'Our galaxy\'s black hole, imaged in May 2022.', d: 'A ring 51.8 ± 2.3 μas across. The EHT compared it with the 4.3 million M☉ and distance known from orbiting stars, which give θ<sub>g</sub> = GM/(c²D) ≈ 4.8–5.1 μas and a shadow of about 50–53 μas. For Sgr A* the ring-to-shadow factor is about 1 within the errors, unlike the roughly 10% for M87*. Two black holes 1,500 times apart in mass look alike, as the theory says they should. A polarised image (2024) shows ordered magnetic fields like M87*\'s.', why: 'A shadow size off from the stellar-orbit mass by more than the errors.' },
    { k: 's2', t: 'obs', name: 'The star S2', s: 'Gravitational redshift (2018) and orbit precession (2020).', d: 'S2 circles Sgr A* every 16 years, passing 120 AU from it at 7,700 km/s. The GRAVITY instrument saw its light stretched by gravity exactly as general relativity predicts (2018), and its orbit turning by 12 arcminutes per lap (2020), the same effect as Mercury\'s orbit (0.1 arcseconds per lap), about 7,000 times larger per orbit.', why: 'Deviations in the orbit as S2 and fainter stars are tracked closer in, or signs of a spread-out dark mass instead of one point.' },
    { k: 'gw', t: 'obs', name: 'Mergers heard', s: 'Hundreds of signals since 2015.', d: 'Every waveform so far matches general relativity\'s predictions for black holes. GW250114 (2025) confirmed the area theorem and found two ringdown tones fitting one Kerr black hole. GW170817 showed gravitational waves travel at the speed of light to within about one part in 10<sup>15</sup>.', why: 'A ringdown whose tones need two different masses or spins, or "echoes" after the ringdown, which would hint at structure at the horizon. Searched for; not found.' },
    { k: 'spin', t: 'obs', name: 'Spins from X-rays', s: 'Measured, but model-dependent.', d: 'The iron line from the inner disk is smeared by Doppler shifts and gravity; how far it smears shows how close the disk reaches, and so the spin. Many supermassive black holes come out spinning fast (a* above 0.9). Different methods sometimes disagree, and merging black holes heard by LIGO mostly spin slowly.', why: 'Better disk models changing the numbers. This is already a lively debate.' },
    { k: 'hawk', t: 'thy', name: 'Hawking radiation', s: 'Never seen from a real black hole.', d: 'A 1 M☉ black hole would glow at 60 billionths of a kelvin, hopelessly buried under the 2.7 K background. "Analogue" horizons for sound waves in Bose–Einstein condensates (Steinhauer 2016; Muñoz de Nova et al. 2019) show spontaneous, thermal, entangled emission matching Hawking\'s formula. That tests the mechanism, not gravity itself.', why: 'The final flash of a small primordial black hole, seen as a gamma-ray burst with a predicted spectrum, would confirm it. No candidate yet.' },
    { k: 'pbh', t: 'spec', name: 'Primordial black holes', s: 'A hypothesis, not found.', d: 'Lensing surveys, the microwave background and gamma-ray limits rule them out as all of the dark matter, except in a window around about 10<sup>14</sup> to 10<sup>20</sup> kg (asteroid masses) that is still open (Carr &amp; Kühnel 2020).', why: 'A microlensing event with no visible lens, a merger with a component below 1 M☉ (no star leaves that), or an evaporation flash.' },
    { k: 'info', t: 'spec', name: 'Information and the Page curve', s: 'Islands and replica wormholes (2019).', d: 'Semiclassical gravity, done carefully, reproduces the Page curve: information comes out. The calculations are in simplified models, and how the information is carried is not settled.', why: 'A sound calculation showing the Page curve fails in a realistic black hole would reopen the paradox.' },
    { k: 'string', t: 'spec', name: 'String theory microstates', s: 'Strominger–Vafa, 1996.', d: 'Counting the string states of certain extremal, supersymmetric black holes gives exactly S = A/4, Bekenstein and Hawking\'s entropy. The "fuzzball" proposal (Mathur, 2000s) goes further: each microstate is a horizonless tangle of strings and branes.', why: 'Structure or echoes near the horizon in ringdowns or EHT images. None seen; the effects may be far too small to see.' },
    { k: 'lqg', t: 'spec', name: 'Loop quantum gravity', s: 'Space made of quanta of area.', d: 'Counting the quantum states of a horizon gives entropy proportional to area; the factor 1/4 is matched by fixing a free constant (the Barbero–Immirzi parameter). Models suggest the singularity is replaced by a bounce.', why: 'Any observable trace of discrete spacetime, for example in the light of black holes formed after a bounce. Nothing seen.' },
    { k: 'ads', t: 'spec', name: 'AdS/CFT (holography)', s: 'Maldacena, 1997.', d: 'Gravity in anti-de Sitter space is exactly equivalent to an ordinary quantum theory on its boundary. A black hole there is a hot state of the boundary theory, which never loses information. Our universe is not anti-de Sitter, so how much carries over is open.', why: 'A holographic description of our own expanding universe would make it testable; none is complete.' },
    { k: 'amps', t: 'spec', name: 'Firewalls (AMPS 2012)', s: 'A paradox, not a prediction.', d: 'Almheiri, Marolf, Polchinski and Sully argued that if the radiation carries information out, an infalling observer cannot see smooth empty space at the horizon; they would hit a wall of energy. Most theorists expect a subtler way out, but which is open.', why: 'A full quantum gravity calculation of what an infaller sees. Not observable with any planned instrument.' },
    { k: 'erepr', t: 'spec', name: 'ER = EPR', s: 'Maldacena & Susskind, 2013.', d: 'A conjecture that entangled systems are connected by wormholes (Einstein–Rosen bridges): for entangled black holes, literally. It helped inspire the island calculations.', why: 'It is a framework more than a prediction; progress is mathematical.' },
    { k: 'ngeht', t: 'next', name: 'Sharper images', s: 'ngEHT and the proposed BHEX.', d: 'More telescopes and a higher frequency (345 GHz) aim for movies of M87*. BHEX, a proposed radio dish in space working with the ground array, would reach high enough resolution to pick out the thin photon ring, a sharp test of the Kerr geometry.', why: 'A photon ring with the wrong shape for the measured mass and spin.' },
    { k: 'lisa', t: 'next', name: 'LISA', s: 'Launch planned around 2035.', d: 'Will hear supermassive black holes merge and small bodies spiral into them over thousands of orbits, mapping spacetime around a black hole far more precisely than any merger heard so far.', why: 'A map that does not match Kerr: the no-hair theorem tested directly.' },
    { k: 'ground', t: 'next', name: 'Next ground runs', s: 'IR1 (planned late 2026, start not yet confirmed), then O5; Einstein Telescope and Cosmic Explorer later.', d: 'After O4 ended in November 2025, a six-month run (IR1) was planned to begin in late October or mid-November 2026 while upgrades are prepared; its start had not been confirmed when this page was checked (12 Nov 2026). Proposed next-generation detectors with 10 to 40 km arms would hear black hole mergers from across the observable universe.', why: 'Louder ringdowns with several tones each; any mismatch would challenge the no-hair theorem.' },
    { k: 'pbhsearch', t: 'next', name: 'Microlensing surveys', s: 'Roman and Rubin.', d: 'NASA\'s Nancy Grace Roman Space Telescope launched on 30 August 2026; its bulge microlensing survey begins after commissioning and will catch lensing by free-floating black holes too; the Rubin Observatory\'s survey (from 2025) watches the whole southern sky.', why: 'Dark lenses of unusual masses would point to primordial black holes.' },
  ];
  let filt = 'all', sel = null;
  const box = $('#bkBoard');
  BOARD.forEach((b) => {
    const btn = document.createElement('button'); btn.type = 'button'; btn.className = 'bh-feat'; btn.dataset.k = b.k; btn.setAttribute('aria-pressed', 'false');
    btn.innerHTML = `<span class="bk-tag ${TAG[b.t][0]}">${TAG[b.t][1]}</span><b>${b.name}</b><span>${b.s}</span>`;
    btn.addEventListener('click', () => pick(b.k));
    box.appendChild(btn);
  });
  function pick(k) {
    sel = k; const b = BOARD.find((x) => x.k === k);
    $$('#bkBoard .bh-feat').forEach((n) => n.setAttribute('aria-pressed', String(n.dataset.k === k)));
    $('#bkBoardOut').innerHTML = `<p class="h">${TAG[b.t][1]}</p><p class="nm">${b.name}</p><p>${b.d}</p><p class="bk-why"><b>What would change our minds:</b> ${b.why}</p>`;
  }
  const FILTERS = [['all', 'All'], ['obs', TAG.obs[1]], ['thy', TAG.thy[1]], ['spec', TAG.spec[1]], ['next', TAG.next[1]]];
  B.seg($('#bkBoardSeg'), FILTERS.map(([k, l]) => ({ k, label: l })), (k) => {
    filt = k;
    $$('#bkBoard .bh-feat').forEach((n) => { const t = BOARD.find((x) => x.k === n.dataset.k).t; n.hidden = !(k === 'all' || t === k || (k === 'untested' && (t === 'thy' || t === 'spec'))); });
    const first = BOARD.find((b) => k === 'all' || b.t === k || (k === 'untested' && (b.t === 'thy' || b.t === 'spec')));
    if (!sel || $(`#bkBoard [data-k="${sel}"]`).hidden) pick(first.k);
  }, { init: 'all' });
  pick('m87');

  /* ---------- shadow sizes ---------- */
  const SH = [['m87', 'M87*', 6.5e9, 16.8], ['sgr', 'Sgr A*', 4.3e6, 0.00828], ['m31', 'M31* (Andromeda)', 1.4e8, 0.77], ['cena', 'Centaurus A', 5.5e7, 3.8]];
  const sh = { lm: +$('#bkShM').value, ld: +$('#bkShD').value };
  const theta = (m, dMpc) => 2 * Math.sqrt(27) * C.GMsun * m / (C.c * C.c) / (dMpc * 1e6 * C.pc) * 206264.806e6; // μas
  const EHT = 20;
  const shSvg = $('#bkShadow');
  function shadow() {
    const rows = SH.map(([k, n, m, d]) => [n, theta(m, d), false]).concat([['Your choice', theta(Math.pow(10, sh.lm), Math.pow(10, sh.ld)), true]]);
    const { w, h, fs, sm } = fit(shSvg, (w, fs) => fs * 2 + rows.length * fs * 2.9 + fs * 3);
    const g = el(shSvg, 'g'), x0 = 10, x1 = w - 14, X = B.logMap(-1, 2.5, x0, x1), top = fs * 2;
    for (let e = -1; e <= 2; e++) { el(g, 'line', { x1: X(Math.pow(10, e)), y1: top, x2: X(Math.pow(10, e)), y2: h - fs * 3, class: 'bk-grid' }); txt(g, X(Math.pow(10, e)), h - fs * 3 + sm + 2, e === -1 ? '0.1' : String(Math.pow(10, e)), { fs: sm, cls: 'bk-m', anchor: 'middle', halo: false }); }
    txt(g, x1, h - 4, 'Shadow diameter, μas (log scale) →', { fs: sm, cls: 'bk-m', anchor: 'end', halo: false });
    el(g, 'line', { x1: X(EHT), y1: top - 4, x2: X(EHT), y2: h - fs * 3, stroke: 'var(--bk-good)', 'stroke-width': 2, 'stroke-dasharray': '6 4' });
    const eL = 'EHT resolution ≈ 20 μas', eR = X(EHT) + 5 + B.tw(eL, sm) > w - 4;
    txt(g, eR ? X(EHT) - 5 : X(EHT) + 5, top - 8, eL, { fs: sm, fill: 'var(--bk-good)', cls: 'bk-t', anchor: eR ? 'end' : 'start' });
    rows.forEach(([n, th, mine], i) => {
      const y = top + 6 + i * fs * 2.9, v = clamp(th, 0.1, 316);
      txt(g, x0, y + fs * 0.9, n, { fs: sm, w: mine ? 700 : 400 });
      el(g, 'rect', { x: x0, y: y + fs * 1.25, width: Math.max(2, X(v) - x0), height: fs * 0.9, rx: 3, fill: mine ? 'var(--accent)' : 'var(--muted)' });
      const lab = sig(th, 3) + ' μas', lw = B.tw(lab, sm), xe = X(EHT);
      let lx = X(v) + 6 + lw > x1 ? X(v) - 6 : X(v) + 6;
      // keep the value off the EHT line: jump past it when the text would sit on it
      if (lx > X(v) && lx - 4 < xe && lx + lw + 4 > xe) lx = xe + 6;
      txt(g, lx, y + fs * 2.0, lab, { fs: sm, mono: true, anchor: lx < X(v) ? 'end' : 'start' });
    });
  }
  function shOut() {
    const m = Math.pow(10, sh.lm), d = Math.pow(10, sh.ld), th = theta(m, d);
    $('#bkShMOut').innerHTML = mSun(m);
    $('#bkShDOut').innerHTML = d < 1 ? `${sig(d * 1000, 3)} kpc (${B.bigWords(d * 1e6 * 3.2616)} light-years)` : `${sig(d, 3)} Mpc (${B.bigWords(d * 3.2616e6)} light-years)`;
    facts($('#bkShFacts'), [
      ['Shadow diameter (no spin)', `${sig(th, 3)} μas`],
      ['Physical diameter', B.lenKm(2 * Math.sqrt(27) * C.GMsun * m / (C.c * C.c) / 1000)],
      ['Like an object on the Moon this wide', th / 5.37 < 100 ? `${sig(th / 5.37, 2)} cm` : `${sig(th / 537, 2)} m`],
      ['Can the EHT resolve it?', th >= EHT * 1.5 ? '<b>Yes</b>' : th >= EHT * 0.75 ? '<b>Barely</b>' : '<b>No</b>, too small'],
    ].concat(sh.k === 'sgr' ? [['What the EHT measured', 'Ring 51.8 ± 2.3 μas, compared with a mass and distance prior from orbiting stars: θ<sub>g</sub> ≈ 4.8–5.1 μas, shadow ≈ 50–53 μas. For Sgr A* the ring-to-shadow factor is about 1 within the errors (unlike about 10% for M87*).']]
      : sh.k === 'm87' ? [['What the EHT measured', 'Ring 42 ± 3 μas; the bright ring is about 10% larger than the shadow edge, a factor calibrated with simulations.']] : []));
  }
  const drawSh = B.figure(shSvg, shadow);
  const shSet = B.seg($('#bkShSeg'), SH.map(([k, n]) => ({ k, label: n })), (k) => { const p = SH.find((x) => x[0] === k); sh.k = k; sh.lm = Math.log10(p[2]); sh.ld = Math.log10(p[3]); $('#bkShM').value = sh.lm; $('#bkShD').value = sh.ld; shOut(); drawSh(); }, { init: 'm87' });
  $('#bkShM').addEventListener('input', (e) => { sh.lm = +e.target.value; sh.k = null; shSet(null); shOut(); drawSh(); });
  $('#bkShD').addEventListener('input', (e) => { sh.ld = +e.target.value; sh.k = null; shSet(null); shOut(); drawSh(); });
  sh.k = 'm87'; sh.lm = Math.log10(6.5e9); sh.ld = Math.log10(16.8); $('#bkShM').value = sh.lm; $('#bkShD').value = sh.ld;
  shOut();

  /* ---------- quiz (same pattern as the Stars page quiz) ---------- */
  const QUIZ = [
    { q: 'If the Sun were replaced by a black hole of the same mass, what would happen to Earth\'s orbit?', a: ['Nothing: the orbit would stay the same', 'Earth would be pulled in', 'Earth would slowly spiral inward', 'Earth would fly off into space'], c: 0, e: 'Outside it, a black hole pulls like any other object of the same mass at the same distance. Earth would keep its orbit (and freeze, without sunlight).' },
    { q: 'About how big is the event horizon (Schwarzschild radius) of a non-spinning 10 M☉ black hole?', a: ['About 30 km', 'About 3 km', 'About 300 km', 'About the size of the Sun'], c: 0, e: 'r<sub>s</sub> = 2GM/c² ≈ 2.95 km for each solar mass, so about 30 km for 10 M☉.' },
    { q: 'Where is the innermost stable circular orbit (ISCO) of a non-spinning black hole?', a: ['3 r<sub>s</sub> (6 GM/c²)', 'At the horizon, 1 r<sub>s</sub>', '1.5 r<sub>s</sub>', '10 r<sub>s</sub>'], c: 0, e: '1.5 r<sub>s</sub> is the photon sphere, where light can orbit. Matter has no stable circular orbit inside 3 r<sub>s</sub>. Spin moves the ISCO in, down to 0.5 r<sub>s</sub> (1 GM/c²) for orbits going with a maximal spin.' },
    { q: 'Which black hole could you fall into, feet first, and cross the horizon in one piece?', a: ['A supermassive one, like Sgr A*', 'A 10 M☉ one', 'None: you are always torn apart first', 'Only a fast-spinning one'], c: 0, e: 'The stretch at the horizon falls as 1/M². At a 10 M☉ hole it is about 20 million g; at Sgr A* it is far below 1 g.' },
    { q: 'Where does most of a quasar\'s light come from?', a: ['Hot gas in the disk outside the horizon', 'From inside the event horizon', 'Always from its jets', 'From the stars of its galaxy'], c: 0, e: 'Nothing escapes the horizon. Gas heated as it spirals in, mostly in the inner disk a few r<sub>s</sub> out, makes the light. Only about one quasar in ten has strong jets.' },
    { q: 'Gas falling onto a rapidly spinning black hole can release up to what share of its rest-mass energy?', a: ['About 42% (around 32% for a realistic top spin)', 'About 0.7%, like fusion', 'All of it, 100%', 'Less than 0.1%'], c: 0, e: 'η = 1 − E<sub>ISCO</sub>: 5.7% with no spin, 42% in the limit a* = 1. Hydrogen fusion releases 0.7%.' },
    { q: 'GW150914 merged black holes of 36 and 29 M☉. What is its chirp mass, the combination that sets how the inspiral speeds up?', a: ['About 28 M☉', 'About 65 M☉', 'About 32 M☉', 'About 62 M☉'], c: 0, e: 'ℳ = (m₁m₂)<sup>3/5</sup>/(m₁+m₂)<sup>1/5</sup> = 28.1 M☉. 65 M☉ is the total, 62 M☉ the remnant.' },
    { q: 'Which of these has been confirmed by observation?', a: ['Hawking\'s area theorem, in the merger GW250114', 'Hawking radiation from a black hole', 'A primordial black hole', 'A firewall at the horizon'], c: 0, e: 'GW250114\'s final horizon was larger than the two starting ones combined, as the 1971 theorem requires. The others remain unobserved.' },
    { q: 'Every known black hole is colder than the 2.7 K microwave background. What does that mean for it today?', a: ['It absorbs more than it emits, so it grows', 'It evaporates faster', 'It is about to explode', 'Its mass cannot change at all'], c: 0, e: 'Hawking temperature is 6.17 × 10<sup>−8</sup> K × (M☉/M). Only holes lighter than about 4.5 × 10<sup>22</sup> kg (less than a Moon) are hotter than the background.' },
    { q: 'In quantum field theory in curved spacetime, what creates particles from the vacuum?', a: ['Spacetime changing, so waves that meant "no particles" before mean "some particles" after', 'Particles leaking out through the singularity', 'Friction in the accretion disk', 'Gravitational waves colliding'], c: 0, e: 'This is the Bogoliubov mixing of positive and negative frequencies. Parker found it for the expanding universe (1968); Hawking for a collapsing star (1974).' },
  ];
  let qi = 0, score = 0, answered = false, seed = (Date.now() & 0xffff);
  function order(k, n) {
    let s = (seed * 31 + k * 977 + 13) >>> 0; const r = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
    const o = Array.from({ length: n }, (_, i) => i);
    for (let i = n - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [o[i], o[j]] = [o[j], o[i]]; }
    return o;
  }
  function quiz() {
    const qb = $('#bkQuiz');
    if (qi >= QUIZ.length) {
      const f = score / QUIZ.length;
      qb.innerHTML = `<div class="card"><p class="progress">Done</p><h3>${score} / ${QUIZ.length}</h3><p class="muted">${f >= 0.85 ? 'Excellent.' : f >= 0.65 ? 'Solid. Review the ones you missed.' : 'Go back through the tabs, then try again.'}</p><div class="actions"><button class="btn btn-primary" type="button" id="bkQRestart">Restart</button></div></div>`;
      $('#bkQRestart').addEventListener('click', () => { qi = 0; score = 0; seed = (seed * 7 + 1) & 0xffff; quiz(); $('#bkQuiz legend').focus(); });
      return;
    }
    const q = QUIZ[qi]; answered = false;
    qb.innerHTML = `<form class="card" id="bkQForm" novalidate>
      <p class="progress">Question ${qi + 1} of ${QUIZ.length} · score ${score}</p>
      <fieldset><legend tabindex="-1">${q.q}</legend>
        ${order(qi, q.a.length).map((i) => `<label class="opt"><input type="radio" name="bkqa" value="${i}"> ${q.a[i]}</label>`).join('')}
      </fieldset>
      <p class="err" id="bkQErr" hidden>Pick an answer first.</p>
      <p class="fb" id="bkQFb" aria-live="polite" hidden></p>
      <div class="actions"><button class="btn btn-primary" type="submit" id="bkQBtn">Check</button></div>
    </form>`;
    const form = $('#bkQForm');
    form.addEventListener('change', () => { $('#bkQErr').hidden = true; });
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      if (answered) { qi++; quiz(); const lg = $('#bkQuiz legend'); if (lg) lg.focus(); else $('#bkQRestart').focus(); return; }
      const s = form.querySelector('input[name=bkqa]:checked');
      if (!s) { $('#bkQErr').hidden = false; return; }
      answered = true;
      const pickI = +s.value, ok = pickI === q.c; if (ok) score++;
      $('.progress', form).textContent = `Question ${qi + 1} of ${QUIZ.length} · score ${score}`;
      $$('.opt', form).forEach((o) => { const inp = o.querySelector('input'), i = +inp.value; if (i === q.c) o.classList.add('right'); else if (i === pickI) o.classList.add('wrong'); inp.disabled = true; });
      const fb = $('#bkQFb'); fb.hidden = false; fb.className = 'fb ' + (ok ? 'ok' : 'no');
      fb.innerHTML = `<b>${ok ? 'Correct.' : 'Not quite.'}</b> ${q.e}`;
      $('#bkQBtn').textContent = qi === QUIZ.length - 1 ? 'See score' : 'Next question';
    });
  }
  quiz();
  window.BKfrontiers = { theta, QUIZ };
})();
