/* Stellar Life — app.js : UI wiring */
(function () {
  'use strict';
  const P = window.Phys, D = window.Data, F = D.Fmt, L = P.LIMITS;
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const NS = 'http://www.w3.org/2000/svg';
  const el = (tag, attrs, parent) => {
    const e = document.createElementNS(NS, tag);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  };
  const store = {
    get(k) { try { return localStorage.getItem('stellar-' + k); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem('stellar-' + k, v); } catch (e) { /* storage unavailable */ } },
  };
  const strip = (h) => String(h).replace(/<sup>(.*?)<\/sup>/g, '^$1').replace(/<[^>]+>/g, '');

  /* ---------- State ---------- */
  const LO = Math.log10(0.08), HI = Math.log10(40);
  const massFromSlider = (v) => Math.pow(10, LO + (HI - LO) * v / 1000);
  const sliderFromMass = (m) => Math.round((Math.log10(m) - LO) / (HI - LO) * 1000);
  const state = { M: 1, binary: false, path: [], idx: 3 };
  const savedM = parseFloat(store.get('mass'));
  if (savedM >= 0.08 && savedM <= 40) state.M = savedM;

  const view = new window.StageView($('#stageCanvas'), { res: 360 });

  /* ---------- Mass + path ---------- */
  function fateText(M) {
    const r = P.remnantOf(M);
    const t = F.years(P.msLifetime(M));
    const name = { hewd: 'helium white dwarf', wd: 'white dwarf', ns: 'neutron star', bh: 'black hole' }[r.type];
    let route = M < L.redDwarfFate ? 'red dwarf, never a giant' : M < L.supernova ? 'red giant → planetary nebula' : 'supergiant → Type II supernova';
    return `<b>${M.toFixed(M < 1 ? 2 : 1)} M☉</b> · main sequence ${t} · ${route} → <b>${name}</b> (~${r.mass.toFixed(r.type === 'bh' ? 0 : 2)} M☉)`;
  }

  // When the mass changes, stay at the same point in life: same stage if it exists, otherwise the
  // stage at the same relative place within the same era (e.g. AGB → onion, white dwarf → black hole).
  const ERA = { cloud: 0, collapse: 0, protostar: 0, zams: 1, ms: 1, subgiant: 2, rgb: 2, heflash: 2, hb: 2, blueloop: 2, agb: 2, rsg: 2, onion: 2, rd_far: 2, pn: 3, corecollapse: 3, sn2: 3, wd: 4, hewd: 4, ns: 4, pulsar: 4, bh: 4, nova: 5, sn1a: 5, xrb: 5, kilonova: 5, bhmerger: 5 };
  function equivalentStage(cur, oldPath, newPath) {
    const i = newPath.indexOf(cur); if (i >= 0) return i;
    let era = ERA[cur]; if (era == null) return Math.min(state.idx, newPath.length - 1);
    const oldEra = (oldPath || []).filter((id) => ERA[id] === era);
    const rel = oldEra.length > 1 ? oldEra.indexOf(cur) / (oldEra.length - 1) : 1;
    for (let tries = 0; tries < 6; tries++) {
      const cand = newPath.map((id, k) => [id, k]).filter(([id]) => ERA[id] === era);
      if (cand.length) return cand[Math.round(rel * (cand.length - 1))][1];
      era = era === 5 ? 4 : era === 3 ? 4 : era - 1;            // binary outcome → remnant; death → remnant
    }
    return Math.min(state.idx, newPath.length - 1);
  }

  function setMass(M, keepStage) {
    state.M = M;
    store.set('mass', String(M));
    $('#mass').value = sliderFromMass(M);
    $('#massOut').textContent = (M < 1 ? M.toFixed(2) : M < 10 ? M.toFixed(2) : M.toFixed(1)) + ' M☉';
    $$('.presets button').forEach((b) => b.setAttribute('aria-pressed', Math.abs(parseFloat(b.dataset.m) - M) < 0.005 ? 'true' : 'false'));
    $('#fateLine').innerHTML = fateText(M);
    const cur = state.path[state.idx], oldPath = state.path;
    state.path = D.stagePath(M, state.binary);
    state.idx = equivalentStage(cur, oldPath, state.path);
    buildScrub(); renderChips(); renderStage(); renderHR(); centerHR(); refreshEquations(); refreshSpaceObjects();
  }

  $('#mass').addEventListener('input', (e) => setMass(massFromSlider(+e.target.value)));
  $$('.presets button').forEach((b) => b.addEventListener('click', () => setMass(parseFloat(b.dataset.m))));
  $('#binary').addEventListener('change', (e) => { state.binary = e.target.checked; setMass(state.M); });

  /* ---------- Stage chips ---------- */
  function renderChips() {
    navEnds();
    const ol = $('#chips'); ol.innerHTML = ''; ol.style.position = 'relative';
    state.path.forEach((id, i) => {
      const st = D.STAGES[id];
      const li = document.createElement('li');
      const b = document.createElement('button');
      b.type = 'button';
      b.innerHTML = `<span class="ph">${i + 1} · ${st.phase}</span><span class="nm">${st.title}</span>`;
      if (i === state.idx) b.setAttribute('aria-current', 'step');
      b.addEventListener('click', () => go(i));
      li.appendChild(b); ol.appendChild(li);
    });
    const act = ol.querySelector('[aria-current]');
    if (act) {
      // Centre the current chip, then back off to a chip boundary so the first visible chip is whole
      let left = Math.min(ol.scrollWidth - ol.clientWidth, act.parentElement.offsetLeft - ol.clientWidth / 2 + act.offsetWidth / 2);
      const lis = [...ol.children]; let snap = 0;
      lis.forEach((li) => { if (li.offsetLeft - 2 <= left) snap = Math.max(0, li.offsetLeft - 2); });
      left = snap;
      ol.scrollTo({ left: Math.max(0, left), behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
    }
  }
  function go(i) {
    stopLife();
    state.idx = Math.max(0, Math.min(state.path.length - 1, i));
    renderChips(); renderStage(); renderHR(); centerHR();
  }
  function navEnds() { $('#prev').disabled = state.idx <= 0; $('#next').disabled = state.idx >= state.path.length - 1; }
  function centerHR() {
    const box = document.querySelector('.hr-box'), cur = document.querySelector('#hr .now');
    if (!box || !cur || box.scrollWidth <= box.clientWidth + 2) return;
    const bx = box.getBoundingClientRect(), cx = cur.getBoundingClientRect();
    box.scrollLeft += (cx.left + cx.width / 2) - (bx.left + bx.width / 2);
  }

  /* ---------- Inside the star: scrubber ---------- */
  const scrubN = () => window.Evo.phases(state.M).length;
  state.scrub = 0.46;
  function buildScrub() {
    const ph = window.Evo.phases(state.M), box = $('#scrubTicks');
    box.innerHTML = '';
    ph.forEach((p, i) => {
      const sp = document.createElement('span');
      sp.style.left = (i / ph.length * 100) + '%';
      sp.style.width = (100 / ph.length) + '%';
      sp.textContent = p.short || p.label; sp.title = p.label;
      box.appendChild(sp);
    });
    if (state.scrub > ph.length) state.scrub = 0.46;
    $('#scrub').value = Math.round(state.scrub / ph.length * 1000);
  }
  function onScrub(v) {
    state.scrub = Math.min(scrubN() - 1e-4, v / 1000 * scrubN());
    const at = window.Evo.at(state.M, state.scrub);
    const idx = state.path.indexOf(at.stage);
    if (idx >= 0 && idx !== state.idx) { state.idx = idx; renderChips(); renderStage(true); renderHR(); return; }
    const now = performance.now();
    const heavy = !lifeTimer || now - (onScrub.last || 0) > 140 || at.phaseIndex !== onScrub.phase;
    applyInterior(!heavy);
    if (heavy) { renderHR(); onScrub.last = now; onScrub.phase = at.phaseIndex; }
  }
  $('#scrub').addEventListener('input', (e) => { stopLife(); onScrub(+e.target.value); });
  $('#insideJump').addEventListener('click', () => { const i = state.path.indexOf('ms'); if (i >= 0) go(i); });
  let lifeTimer = null;
  function stopLife() { if (lifeTimer) { cancelAnimationFrame(lifeTimer); lifeTimer = null; } const b = $('#scrubPlay'); if (b) { b.textContent = 'Play life'; b.setAttribute('aria-pressed', 'false'); } }
  $('#scrubPlay').addEventListener('click', () => {
    if (lifeTimer) { stopLife(); return; }
    const b = $('#scrubPlay'); b.textContent = 'Pause'; b.setAttribute('aria-pressed', 'true');
    if (+$('#scrub').value >= 995) { $('#scrub').value = 0; }
    let last = performance.now();
    const step = (now) => {
      const dt = (now - last) / 1000; last = now;
      const perPhase = 5; // seconds of animation per phase
      let v = +$('#scrub').value + dt / (perPhase * scrubN()) * 1000;
      if (v >= 1000) { v = 999; $('#scrub').value = v; onScrub(v); stopLife(); return; }
      $('#scrub').value = v; onScrub(v);
      lifeTimer = requestAnimationFrame(step);
    };
    lifeTimer = requestAnimationFrame(step);
  });

  /* ---------- Cutaway tools: true scale, zoom, labels, probe ---------- */
  const RSUN_KM = 695700, EARTH_KM = 6371;
  const kmText = (km) => km >= 1e6 ? F.sig(km / RSUN_KM, 3) + ' R☉' : F.sig(km, 3) + ' km';
  const earths = (km) => { const e = km / EARTH_KM; return e < 0.1 ? F.sig(e * 100, 2) + '% of Earth' : e < 1.5 ? F.sig(e, 2) + '× Earth' : e < 200 ? F.sig(e, 2) + ' Earths' : F.sig(km / RSUN_KM, 2) + ' Suns'; };
  // Degenerate matter (C/O or He cores, white dwarfs) carries heat by electron conduction, not radiation
  const isDegen = (l) => !!l && (/degenera/i.test(l.name + ' ' + (l.note || '')) || l.name === 'Helium interior');
  const CONDUCT = '<span>Energy moves by <b>conduction (degenerate electrons)</b></span>';
  function layerAt(layers, r) { return layers.find((l) => r <= l.r + 1e-9) || layers[layers.length - 1]; }
  view.probeText = (h) => {
    if (h.surface) return state.interior && state.at ? `<b>Photosphere</b><span>The visible surface, ${Math.round(state.at.T).toLocaleString('en-US')} K. Darker toward the edge (limb darkening).</span>` : '';
    if (!state.interior || !state.at) {
      const L = view.layers || []; const l = L.find((x) => h.r <= x.r) || L[L.length - 1];
      return l ? `<b>${l.name}</b><span>${l.note || ''}</span>` + (isDegen(l) ? CONDUCT : '') : '';
    }
    const at = state.at, prof = at.profile, r = Math.min(0.9999, h.r), map = window.Evo.trueMap(prof, at.R);
    const l = layerAt(prof.layers, r), x = window.Evo.toTrue(map, r), km = x * at.R * RSUN_KM;
    const c = prof.comp(r), conv = prof.conv ? prof.conv(r) : 0, burn = prof.burn(r) > 0.05;
    return `<b>${l.name}</b>`
      + `<span>${kmText(km)} from the centre · ${F.sig(x * 100, 2)}% of the way out</span>`
      + `<span>${compText(c)}</span>`
      + `<span>Energy moves by <b>${conv ? 'convection' : isDegen(l) ? 'conduction (degenerate electrons)' : 'radiation'}</b>${burn ? ' · <b class="hot">fusion here</b>' : ''}</span>`;
  };
  function cutNote() {
    const n = $('#cutNote'); if (!n) return;
    if (!state.interior || !state.at) { n.textContent = ''; return; }
    const at = state.at, prof = at.profile, map = window.Evo.trueMap(prof, at.R), core = prof.layers[0];
    const x = window.Evo.toTrue(map, core.r), km = x * at.R * RSUN_KM;
    const starKm = at.R * RSUN_KM;
    const seen = x * view.zoom / 1.25 > 0.04;
    n.innerHTML = view.scaleMode === 'true'
      ? `<b>True scale${state.M >= 8 ? ' (shell radii are factor-of-two estimates from 15–25 M☉ models)' : ''}.</b> The ${core.name.toLowerCase()} is ${kmText(km)} in radius (${earths(km)}) inside a star of ${kmText(starKm)}: <b>${F.sig(x * 100, 2)}%</b> of the radius. ${seen ? (view.zoom > 1.5 ? `You're zoomed in ${F.sig(view.zoom, 2)}×.` : '') : 'Too small to see at this zoom: press <b>Zoom to core</b>.'}`
      : `<b>Schematic.</b> Layers are stretched so you can see them all. Real size of the ${core.name.toLowerCase()}: ${kmText(km)} (${F.sig(x * 100, 2)}% of the star's radius). Switch to true scale to see it.`;
  }
  const zoomOut = () => { const z = view.zoom; $('#cutZoomOut').innerHTML = '×' + (z < 10 ? z.toFixed(1) : F.sig(z, 2).replace(/^1 × /, '')); };
  function setZoom(z) { view.zoom = Math.max(1, Math.min(1e6, z)); $('#cutZoom').value = Math.round(Math.log10(view.zoom) * 100); zoomOut(); view.draw(); cutNote(); }
  function setScaleMode(mode, persist = true) {
    view.scaleMode = mode;
    $$('#cutScale button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.scale === mode)));
    $('#cutZoomWrap').hidden = mode !== 'true'; $('#cutCore').hidden = mode !== 'true';
    if (mode !== 'true') view.zoom = 1;
    setZoom(view.zoom); cutNote();
    if (persist) store.set('scale', mode);
  }
  $$('#cutScale button').forEach((b) => b.addEventListener('click', () => setScaleMode(b.dataset.scale)));
  $('#cutZoom').addEventListener('input', (e) => { cancelAnimationFrame(zoomAnim); setZoom(Math.pow(10, +e.target.value / 100)); });
  let zoomAnim = 0;
  $('#cutCore').addEventListener('click', () => {
    if (!state.at) return;
    const prof = state.at.profile, map = window.Evo.trueMap(prof, state.at.R);
    const x = window.Evo.toTrue(map, prof.layers[0].r);
    const goal = Math.max(1, Math.min(1e6, 1.25 * 0.42 / Math.max(x, 1e-9)));
    const z0 = Math.log10(view.zoom), z1 = Math.log10(goal), t0 = performance.now();
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) { setZoom(goal); return; }
    cancelAnimationFrame(zoomAnim);
    const stepZ = (now) => { const f = Math.min(1, (now - t0) / 1600), e = f < 0.5 ? 2 * f * f : 1 - Math.pow(-2 * f + 2, 2) / 2; setZoom(Math.pow(10, z0 + (z1 - z0) * e)); if (f < 1) zoomAnim = requestAnimationFrame(stepZ); };
    zoomAnim = requestAnimationFrame(stepZ);
  });
  $('#cutLabels').addEventListener('change', (e) => { view.labels = e.target.checked; view.draw(); });

  function applyInterior(light) {
    const M = state.M, at = window.Evo.at(M, state.scrub), prof = at.profile;
    state.at = at;
    view.setInterior(window.Evo.lut(prof, 384), at.T, { flash: !!prof.flash, prof, R: at.R, map: window.Evo.trueMap(prof, at.R) });
    cutNote();
    $('#scrubPhase').textContent = at.phase.label;
    const pct = Math.round(at.p * 100);
    $('#scrubAge').innerHTML = `Age ${F.years(at.age)} · ${pct}% through this phase (${at.phase.id === 'flash' ? 'peak runaway lasts hours; smaller flashes continue ~1–2 Myr' : 'lasts ' + F.years(at.phase.dur)})`;
    if (light) return;
    // legend from the profile (outside first)
    const box = $('#legend'); box.innerHTML = '';
    let r0 = 0;
    const rows = prof.layers.map((l) => { const mid = (r0 + l.r) / 2; const row = { l, mid, burning: false, whole: false }; let n = 0; for (let k = 1; k < 20; k++) { const rr = r0 + (l.r - r0) * k / 20; if (prof.burn(rr) > 0.05) { row.burning = true; n++; } } if (r0 > 0 && prof.burn(r0 + 0.006) > 0.05) row.burning = true; row.whole = r0 === 0 || n > 9; r0 = l.r; return row; });
    rows.reverse().forEach(({ l, mid, burning, whole }) => {
      const c = prof.comp(mid), col = compColor(c);
      const row = document.createElement('div'); row.className = 'row';
      row.innerHTML = `<span class="sw${burning ? ' glow' : ''}" style="background:${col};color:${burning ? '#ffc864' : col}"></span><span><span class="nm">${l.name}</span>${burning ? ` <span class="hint">· ${whole ? 'burning' : 'burning at its base'}</span>` : ''}<br><span class="hint">made of: ${compText(c)}</span><br><span class="nt">${l.note}</span></span>`;
      box.appendChild(row);
    });
    const h = document.createElement('p'); h.className = 'hint';
    h.textContent = 'Outer layer first. Colours blend by composition: blue hydrogen, yellow helium, grey carbon, teal oxygen, pink neon, orange silicon, red iron. Hover or tap the cut face for details.';
    box.appendChild(h);
    renderInside(at);
  }
  const ELS = () => window.Evo.ELS;
  function compColor(c) {
    let R = 0, G = 0, B = 0, s = 0;
    ELS().forEach((e) => { const w = c[e]; if (w > 0) { const n = parseInt(D.EL[e].c.slice(1), 16); R += ((n >> 16) & 255) * w; G += ((n >> 8) & 255) * w; B += (n & 255) * w; s += w; } });
    return `rgb(${R / s | 0},${G / s | 0},${B / s | 0})`;
  }
  function compText(c) {
    return ELS().filter((e) => c[e] >= 0.05).sort((a, b) => c[b] - c[a]).slice(0, 3).map((e) => `${e} ${Math.round(c[e] * 100)}%`).join(' · ');
  }

  function renderInside(at) {
    const svg = $('#compSvg'); svg.innerHTML = '';
    const H = 300, W = fitWidth(svg, 330, 560, H), ml = 40, mr = 12, mt = 30, mb = 40;
    const X = (r) => ml + r * (W - ml - mr), Y = (f) => mt + (1 - f) * (H - mt - mb);
    const css = getComputedStyle(document.documentElement);
    const muted = css.getPropertyValue('--muted').trim(), line = css.getPropertyValue('--line-soft').trim(), fg = css.getPropertyValue('--fg').trim();
    const prof = at.profile, N = 140, els = ELS();
    const samples = []; for (let i = 0; i <= N; i++) { const r = i / N; samples.push({ r, c: prof.comp(Math.min(0.999, r + 1e-4)), b: prof.burn(Math.min(0.999, r + 1e-4)) }); }
    // stacked areas
    let base = samples.map(() => 0);
    els.forEach((e) => {
      const top = samples.map((s, i) => base[i] + s.c[e]);
      if (Math.max(...samples.map((s) => s.c[e])) < 0.004) { base = top; return; }
      const d = samples.map((s, i) => `${i ? 'L' : 'M'}${X(s.r).toFixed(1)},${Y(top[i]).toFixed(1)}`).join(' ') + ' ' + samples.slice().reverse().map((s, k) => `L${X(s.r).toFixed(1)},${Y(base[N - k]).toFixed(1)}`).join(' ') + 'Z';
      el('path', { d, fill: D.EL[e].c, opacity: 0.9 }, svg);
      base = top;
    });
    // burning band
    const bandY = mt - 18;
    samples.forEach((s, i) => { if (i < N && s.b > 0.05) el('rect', { x: X(s.r), y: bandY, width: X(1 / N) - X(0) + 0.6, height: 8, fill: '#ffc864', opacity: Math.min(1, 0.25 + s.b) }, svg); });
    const bl = el('text', { x: ml, y: bandY - 4, 'font-size': 10, fill: muted }, svg); bl.textContent = 'fusion ↓';
    // layer boundaries
    prof.layers.slice(0, -1).forEach((l) => el('line', { x1: X(l.r), x2: X(l.r), y1: mt, y2: H - mb, stroke: fg, 'stroke-dasharray': '3 3', opacity: 0.45 }, svg));
    // axes
    [0, 0.5, 1].forEach((f) => { el('line', { x1: ml, x2: W - mr, y1: Y(f), y2: Y(f), stroke: line }, svg); const t = el('text', { x: ml - 6, y: Y(f) + 4, 'text-anchor': 'end', 'font-size': 11, fill: muted }, svg); t.textContent = (f * 100) + '%'; });
    const ax = el('text', { x: (ml + W) / 2, y: H - 10, 'text-anchor': 'middle', 'font-size': 11, fill: muted }, svg); ax.textContent = 'centre → surface (schematic, not to scale)';
    const t0 = el('text', { x: ml, y: H - mb + 15, 'font-size': 10, fill: muted }, svg); t0.textContent = 'centre';
    const t1 = el('text', { x: W - mr, y: H - mb + 15, 'text-anchor': 'end', 'font-size': 10, fill: muted }, svg); t1.textContent = 'surface';
    // element key
    let kx = ml + 70;
    els.forEach((e) => { if (Math.max(...samples.map((s) => s.c[e])) < 0.004) return; el('rect', { x: kx, y: bandY - 12, width: 9, height: 9, rx: 2, fill: D.EL[e].c }, svg); const t = el('text', { x: kx + 12, y: bandY - 4, 'font-size': 10, fill: muted }, svg); t.textContent = e; kx += 34; });

    // readouts
    const R = at.R;
    $('#insideRead').innerHTML = [
      ['Age', F.years(at.age)], ['Surface temperature', F.sig(at.T, 3) + ' K'],
      ['Luminosity', F.sig(at.L, 3) + ' L☉'], ['Radius', F.sig(R, 3) + ' R☉' + (R > 150 ? ' (≈ ' + F.sig(R / 215, 2) + ' AU)' : '')],
    ].map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join('');
    // burning list
    const burns = []; let r0 = 0;
    prof.layers.forEach((l) => { let mx = 0; for (let k = 1; k < 20; k++) mx = Math.max(mx, prof.burn(r0 + (l.r - r0) * k / 20)); if (mx > 0.05) burns.push(l); r0 = l.r; });
    $('#burnList').innerHTML = burns.length ? burns.map((l) => `<li><i></i><span><b>${l.name}.</b> ${l.note}</span></li>`).join('') : '<li class="none">No fusion: this layer structure is held up without nuclear energy.</li>';
    // life table
    const ph = window.Evo.phases(state.M);
    $('#lifeCap').textContent = `This ${state.M.toFixed(state.M < 1 ? 2 : 1)} M☉ star in the model (values at the middle of each phase)`;
    $('#lifeBody').innerHTML = ph.map((p, i) => {
      const a = window.Evo.at(state.M, i + 0.5);
      return `<tr class="${i === at.phaseIndex ? 'cur' : ''}"><td>${p.label}</td><td>${p.id === 'flash' ? 'peak runaway: hours <span class="muted">(smaller flashes continue ~1–2 Myr)</span>' : F.years(p.dur)}${['c', 'ne', 'o', 'si'].includes(p.id) ? ' <span class="muted">(from 15–25 M☉ models)</span>' : ''}</td><td>${F.sig(a.T, 2)} K</td><td>${F.sig(a.L, 2)} L☉</td><td>${F.sig(a.R, 2)} R☉</td></tr>`;
    }).join('');
    const sunLike = Math.abs(state.M - 1) < 0.08;
    $('#sunTable').innerHTML = sunLike ? `
      <div class="table-wrap"><table class="life"><caption>The Sun's future in round numbers, as usually quoted. Diameter in Suns.</caption>
      <thead><tr><th>Stage</th><th>Lasts</th><th>Surface T</th><th>Luminosity</th><th>Diameter</th></tr></thead><tbody>
      <tr><td>Main sequence</td><td>11 billion yr</td><td>6,000 K</td><td>1 L☉</td><td>1</td></tr>
      <tr><td>Becomes red giant</td><td>1.3 billion yr</td><td>3,100 K at minimum</td><td>2,300 L☉ at maximum</td><td>165</td></tr>
      <tr><td>Helium fusion</td><td>100 million yr</td><td>4,800 K</td><td>50 L☉</td><td>10</td></tr>
      <tr><td>Giant again</td><td>20 million yr</td><td>3,100 K</td><td>5,200 L☉</td><td>180</td></tr>
      </tbody></table></div>
      <p class="note">The model uses these luminosities and temperatures. Check the giant-again row with Stefan–Boltzmann yourself: 5,200 L☉ at 3,100 K gives R = √L / (T/5,772 K)² ≈ 250 R☉, so the table's 180 is a rounder figure. The red-giant row is consistent: 2,300 L☉ at 3,100 K → ≈ 165 R☉.</p>` : '';
  }
  $('#prev').addEventListener('click', () => go(state.idx - 1));
  $('#next').addEventListener('click', () => go(state.idx + 1));
  document.addEventListener('keydown', (e) => {
    if (/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)) return;
    if (e.defaultPrevented || (e.target.closest && e.target.closest('[role=tab],[role=group],button,svg,canvas,[tabindex]'))) return;
    if (e.key === 'ArrowRight') go(state.idx + 1);
    if (e.key === 'ArrowLeft') go(state.idx - 1);
  });

  /* ---------- Stage panel ---------- */
  const SUPPORT = {
    fusion: { g: 0.7, s: 0.7, col: 'var(--good)', v: 'Balanced: hydrostatic equilibrium' },
    thermal: { g: 0.5, s: 0.5, col: 'var(--good)', v: 'Balanced (no fusion)' },
    shell: { g: 0.75, s: 0.75, col: 'var(--warn)', v: 'Balanced, core contracting' },
    edeg: { g: 0.85, s: 0.85, col: '#a98bff', v: 'Balanced by quantum pressure' },
    ndeg: { g: 0.97, s: 0.97, col: '#8ea2c8', v: 'Balanced at nuclear density' },
    losing: { g: 0.95, s: 0.35, col: 'var(--bad)', v: 'Gravity is winning' },
    none: { g: 0, s: 0, col: 'var(--faint)', v: '' },
  };

  function legendFor(spec, id) {
    const box = $('#legend'); box.innerHTML = '';
    if (spec.layers) {
      [...spec.layers].reverse().forEach((l) => {
        const row = document.createElement('div'); row.className = 'row';
        row.innerHTML = `<span class="sw${l.glow || l.rim ? ' glow' : ''}" style="background:${l.color};color:${l.color}"></span><span><span class="nm">${l.name}</span>${l.glow || l.rim ? ' <span class="hint">· fusing</span>' : ''}<br><span class="nt">${l.note}</span></span>`;
        box.appendChild(row);
      });
      const h = document.createElement('p'); h.className = 'hint';
      h.textContent = 'Outer layer first. Layer thickness is not to scale. Glowing bands are where fusion is happening.';
      box.appendChild(h);
      return;
    }
    const notes = {
      cloud: 'Blue: hydrogen gas. Brown: dust. Amber: shock front. Wavy lines: radiation from hot stars, which heats gas.',
      collapse: 'Clumps above the Jeans mass fall in, spin up and heat (blue → orange).',
      disk: 'Inner disk is hotter (orange). Large dots: planetesimals. Blue streaks: bipolar jets.',
      pn: 'Blue: hydrogen. Teal: oxygen. Real nebulae glow red (hydrogen-alpha) and green-teal (doubly ionized oxygen).',
      supernova: 'Ejecta colour-coded by element. Green dots: the neutrino burst, which leaves first.',
      binary: 'Gas streams from the donor into an accretion disk around the compact star.',
      merger: 'Rings: gravitational waves. Colours in the ejecta: gold, platinum, iron-group.',
      bh: 'Real background stars are bent outward around the shadow and a faint second image appears inside.',
    };
    const p = document.createElement('p'); p.className = 'nt'; p.style.color = 'var(--muted)';
    p.style.fontSize = '.88rem'; p.textContent = notes[spec.mode] || '';
    box.appendChild(p);
    const h = document.createElement('p'); h.className = 'hint'; h.textContent = 'Drag to rotate. Double-click to resume auto-rotation.';
    box.appendChild(h);
  }

  function renderStage(fromScrub) {
    const id = state.path[state.idx], st = D.STAGES[id], M = state.M;
    const spec = Object.assign({}, st.view(M));
    spec.layers = spec.mode === 'cutaway' ? D.layers(spec.stageLayers || id, M) : null;
    if (!spec.surfaceT) spec.surfaceT = D.surfaceTemp(id, M);
    spec.M = M;
    const interiorScrub = spec.mode === 'cutaway' ? window.Evo.scrubForStage(M, id) : null;
    state.interior = interiorScrub != null;
    if (state.interior) spec.layers = null;
    if (fromScrub && view.spec.mode === 'cutaway' && spec.mode === 'cutaway' && state.interior) {
      view.spec = Object.assign({}, spec); // fresh spec, no stale keys; rotation lives on the view (yaw, pitch)
    } else {
      view.setStage(spec);
    }
    if (state.interior && !fromScrub) { state.scrub = interiorScrub; $('#scrub').value = Math.round(state.scrub / scrubN() * 1000); }
    $('#scrubBox').hidden = !state.interior;
    $('#cutTools').hidden = spec.mode !== 'cutaway';
    $('#cutScale [data-scale=true]').disabled = !state.interior;
    if (!state.interior && view.scaleMode === 'true') setScaleMode('schematic', false);
    else if (state.interior && view.scaleMode !== 'true' && store.get('scale') === 'true') setScaleMode('true', false);
    if (!state.interior) cutNote();
    ['#insideGrid', '#lifeWrap', '#sunTable'].forEach((q) => { $(q).hidden = !state.interior; });
    $('#insideEmpty').hidden = state.interior;
    if (!state.interior) {
      const why = { cloud: 'a cold gas cloud, not yet a star', collapse: 'a collapsing cloud, not yet a star', protostar: 'a protostar, shining by contraction, not fusion', pn: 'a planetary nebula around a hot carbon-oxygen core', wd: 'a white dwarf: carbon-oxygen, no fusion', hewd: 'a helium white dwarf: no fusion', nova: 'a white dwarf in a binary', sn1a: 'a white dwarf being destroyed', sn2: 'an exploding star: its layers are flying apart', ns: 'a neutron star: no fusion', pulsar: 'a neutron star: no fusion', bh: 'a black hole: no surface, no layers', xrb: 'a binary with a collapsed star', kilonova: 'a neutron star merger', bhmerger: 'a black hole merger' }[id] || 'not a fusing star';
      $('#insideWhy').textContent = why;
    }
    if (state.interior) applyInterior(); else legendFor(spec, id);
    $('#stPhase').textContent = `Stage ${state.idx + 1} of ${state.path.length} · ${st.phase}`;
    $('#stTitle').textContent = st.title;
    $('#stFusion').textContent = st.fusion(M);
    const dur = st.duration(M);
    $('#stDur').innerHTML = typeof dur === 'number' ? '~' + F.years(dur) : dur;
    $('#stTemp').innerHTML = st.temp ? st.temp(M) || '—' : '—';
    $('#stBody').innerHTML = st.body(M);
    const facts = st.facts ? st.facts(M) : [];
    $('#stFacts').innerHTML = facts.map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join('');
    $('#stMyth').textContent = st.myth || '';
    let trBox = $('#stTR');
    if (!trBox) { trBox = document.createElement('div'); trBox.id = 'stTR'; $('#stMyth').before(trBox); }
    trBox.innerHTML = st.tr ? `<div class="tr-callout"><div><p class="h">Classic picture</p><p>${st.tr[0]}</p></div><div><p class="h">What we know now</p><p>${st.tr[1]}</p></div></div>` : '';
    const s = SUPPORT[st.support.kind] || SUPPORT.none;
    $('#balance').innerHTML = st.support.kind === 'none' && !st.support.label ? '' : `
      <div class="bars">
        <span class="lbl">Gravity</span><span class="bar"><i style="width:${s.g * 100}%;background:var(--muted)"></i></span>
        <span class="lbl">Support</span><span class="bar"><i style="width:${s.s * 100}%;background:${s.col}"></i></span>
      </div>
      <p class="verdict">${st.support.label}${s.v ? ' · ' + s.v : ''}</p>`;
    bindTips($('.stage-panel'));
  }

  /* ---------- H-R diagram ---------- */
  // Fit an SVG's coordinate width to its box so text stays at its real size on phones.
  function fitWidth(svg, min, max, H) {
    const box = svg.parentElement; const w = Math.round(Math.max(min, Math.min(max, (box ? box.clientWidth - 16 : max) || max)));
    svg.setAttribute('viewBox', `0 0 ${w} ${H}`); return w;
  }
  function renderHR() {
    const svg = $('#hr'); svg.innerHTML = '';
    const H = 460, W = fitWidth(svg, 340, 640, H), narrow = W < 520, ml = narrow ? 50 : 62, mr = 14, mt = 40, mb = 48;
    const tMin = 3.38, tMax = 5.25, lMin = -4.5, lMax = 6.6;
    const X = (lT) => ml + (tMax - lT) / (tMax - tMin) * (W - ml - mr);
    const Y = (lL) => mt + (lMax - lL) / (lMax - lMin) * (H - mt - mb);
    const css = getComputedStyle(document.documentElement);
    const muted = css.getPropertyValue('--muted').trim(), faint = css.getPropertyValue('--faint').trim();
    const line = css.getPropertyValue('--line-soft').trim(), fg = css.getPropertyValue('--fg').trim(), accent = css.getPropertyValue('--accent').trim();
    const g = el('g', {}, svg);

    // spectral class strip with blackbody colours
    const classes = [['O', 5.25, 4.477], ['B', 4.477, 4.0], ['A', 4.0, 3.875], ['F', 3.875, 3.778], ['G', 3.778, 3.716], ['K', 3.716, 3.568], ['M', 3.568, 3.38]];
    classes.forEach(([n, a, b]) => {
      const T = Math.pow(10, (a + b) / 2), c = P.blackbodyRGB(T);
      el('rect', { x: X(a), y: mt - 22, width: X(b) - X(a), height: 10, fill: `rgb(${c})`, stroke: line, 'stroke-width': 1 }, g);
      const tx = el('text', { x: (X(a) + X(b)) / 2, y: mt - 28, 'text-anchor': 'middle', 'font-size': 11, fill: muted }, g); tx.textContent = n;
    });
    // grid
    for (let l = -4; l <= 6; l += 2) {
      el('line', { x1: ml, x2: W - mr, y1: Y(l), y2: Y(l), stroke: line }, g);
      const t = el('text', { x: ml - 8, y: Y(l) + 4, 'text-anchor': 'end', 'font-size': 11, fill: muted }, g);
      t.innerHTML = `10<tspan dy="-5" font-size="8">${l}</tspan>`;
    }
    (narrow ? [30000, 10000, 4000] : [40000, 20000, 10000, 6000, 4000, 3000]).forEach((T) => {
      const x = X(Math.log10(T));
      el('line', { x1: x, x2: x, y1: mt, y2: H - mb, stroke: line }, g);
      const t = el('text', { x, y: H - mb + 16, 'text-anchor': 'middle', 'font-size': 11, fill: muted }, g); t.textContent = T >= 10000 ? (T / 1000) + 'k' : T.toLocaleString('en-US');
    });
    const ax1 = el('text', { x: (ml + W - mr) / 2, y: H - 10, 'text-anchor': 'middle', 'font-size': 11, fill: muted }, g); ax1.textContent = 'Surface temperature (K) → cooler';
    const ax2 = el('text', { x: 14, y: (mt + H - mb) / 2, 'text-anchor': 'middle', 'font-size': 11, fill: muted, transform: `rotate(-90 14 ${(mt + H - mb) / 2})` }, g); ax2.textContent = 'Luminosity (L☉)';

    // main-sequence band
    const ms = [], tams = [];
    for (let lm = Math.log10(0.08); lm <= Math.log10(40) + 1e-9; lm += 0.05) {
      const M = Math.pow(10, lm), a = P.hrPosition('zams', M), b = P.hrPosition('ms', M);
      ms.push([X(a.logT), Y(a.logL)]);
      tams.push([X(b.logT), Y(b.logL)]);
    }
    const band = ms.concat(tams.reverse()).map((p) => p.join(',')).join(' ');
    el('polygon', { points: band, fill: accent, opacity: 0.13, stroke: accent, 'stroke-opacity': 0.35, 'stroke-width': 1 }, g);
    // instability strip
    const s1 = 0.6, s2 = 5;
    const strip = [[P.stripBlue(s1), s1], [P.stripRed(s1), s1], [P.stripRed(s2), s2], [P.stripBlue(s2), s2]].map(([t, l]) => X(t) + ',' + Y(l)).join(' ');
    el('polygon', { points: strip, fill: '#a98bff', opacity: 0.14 }, g);
    // region labels get a halo in the chart background so the track can't hide them
    const lab = (txt, x, y, opts) => { const t = el('text', Object.assign({ x, y, 'font-size': 11, fill: faint, style: 'paint-order: stroke; stroke: var(--hr-bg, var(--surface)); stroke-width: 4px; stroke-linejoin: round' }, opts || {}), g); t.textContent = txt; return t; };
    lab('Main sequence', X(narrow ? 4.3 : 4.2), Y(narrow ? 1.9 : 1.2), { class: 'region', transform: `rotate(-28 ${X(narrow ? 4.3 : 4.2)} ${Y(narrow ? 1.9 : 1.2)})` });
    lab('Giants', X(3.62), Y(2.15), narrow ? { class: 'region', 'text-anchor': 'end' } : { class: 'region' });
    lab('Supergiants', X(4.05), Y(5.75), { class: 'region' });
    lab('White dwarfs', X(4.62), Y(-3.2), { class: 'region' });
    if (!narrow) lab('Instability strip', X(3.86) + 4, Y(4.9), { 'font-size': 10 });
    if (!narrow) lab('RR Lyrae', X(3.82) - 7, Y(1.7) + 4, { 'font-size': 10, 'text-anchor': 'end' });
    el('circle', { cx: X(3.82), cy: Y(1.7), r: 3, fill: '#a98bff' }, g);
    if (!narrow) lab('Cepheids', X(3.745) - 7, Y(3.6) + 16, { 'font-size': 10, 'text-anchor': 'end' });
    el('circle', { cx: X(3.745), cy: Y(3.6), r: 3, fill: '#a98bff' }, g);
    // Sun
    el('circle', { cx: X(Math.log10(5772)), cy: Y(0), r: 5, fill: 'none', stroke: fg, 'stroke-width': 1.2 }, g);
    el('circle', { cx: X(Math.log10(5772)), cy: Y(0), r: 1.4, fill: fg }, g);
    if (Math.abs(state.M - 1) > 0.05) lab('Sun today', X(Math.log10(5772)) + 9, Y(0) + 15, { fill: muted });

    // this star's track
    const pts = state.path.map((id, i) => ({ id, i, p: P.hrPosition(id, state.M) })).filter((o) => o.p);
    const clampL = (l) => Math.min(lMax - 0.15, l);
    const d = pts.map((o, k) => `${k ? 'L' : 'M'}${X(o.p.logT).toFixed(1)},${Y(clampL(o.p.logL)).toFixed(1)}`).join(' ');
    el('path', { d, fill: 'none', stroke: accent, 'stroke-width': 2, 'stroke-linejoin': 'round', opacity: 0.85 }, g);
    pts.forEach((o) => {
      const cur = o.i === state.idx;
      const gp = el('g', { class: 'pt', tabindex: 0, role: 'button', 'aria-label': D.STAGES[o.id].title }, g);
      const T = Math.pow(10, o.p.logT), c = P.blackbodyRGB(T);
      const x = X(o.p.logT), y = Y(clampL(o.p.logL));
      if (o.p.off) {
        el('path', { d: `M${x},${y + 14} L${x},${y - 2} M${x - 5},${y + 3} L${x},${y - 3} L${x + 5},${y + 3}`, stroke: accent, 'stroke-width': 2, fill: 'none' }, gp);
        lab('supernova peak ~10⁹ L☉ (off chart)', x - 8, y + 6, { 'text-anchor': 'end', fill: muted, 'font-size': 10 });
      }
      el('circle', { cx: x, cy: y, r: cur ? 8 : 5, fill: `rgb(${c})`, stroke: cur ? fg : accent, 'stroke-width': cur ? 2.5 : 1.5, class: cur ? 'now' : '' }, gp);
      const hit = el('circle', { cx: x, cy: y, r: 12, fill: 'transparent' }, gp);
      const title = el('title', {}, gp); title.textContent = D.STAGES[o.id].title;
      gp.addEventListener('click', () => go(o.i));
      gp.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(o.i); } });
      if (cur) {
        const t = D.STAGES[o.id].title, tw = t.length * 7.2 + 10;
        const others = pts.filter((q) => q !== o).map((q) => [X(q.p.logT), Y(clampL(q.p.logL))]);
        const cands = [[13, -24], [13, 8], [-13 - tw, -24], [-13 - tw, 8], [-tw / 2, -40], [-tw / 2, 24]];
        let best = cands[0], bestHits = 1e9;
        cands.forEach(([dx, dy]) => {
          const bx = x + dx, by = y + dy;
          if (bx < ml || bx + tw > W - mr || by < mt - 8 || by + 19 > H - mb) return;
          const hits = others.filter(([px, py]) => px > bx - 6 && px < bx + tw + 6 && py > by - 6 && py < by + 25).length;
          if (hits < bestHits) { bestHits = hits; best = [dx, dy]; }
        });
        el('rect', { x: x + best[0], y: y + best[1], width: tw, height: 19, rx: 4, fill: css.getPropertyValue('--surface').trim(), opacity: 0.92 }, g);
        lab(t, x + best[0] + 5, y + best[1] + 14, { fill: fg, 'font-size': 12 });
        // hide any region label (Main sequence, Giants…) that the active label sits on
        const box = [x + best[0] - 4, y + best[1] - 4, x + best[0] + tw + 4, y + best[1] + 23];
        svg.querySelectorAll('text.region').forEach((r) => { try { const b = r.getBBox(); if (b.x < box[2] && b.x + b.width > box[0] && b.y < box[3] && b.y + b.height > box[1]) r.setAttribute('visibility', 'hidden'); } catch (e) { /* not rendered */ } });
      }
    });
    if (state.interior) {
      const a = window.Evo.at(state.M, state.scrub);
      const x = X(a.logT), y = Y(Math.min(lMax - 0.15, a.logL));
      el('circle', { cx: x, cy: y, r: 7, fill: 'none', stroke: accent, 'stroke-width': 1.6, 'stroke-dasharray': '2 2' }, g);
      el('circle', { cx: x, cy: y, r: 3.5, fill: fg }, g);
    }
    const cid = state.path[state.idx];
    if (!P.hrPosition(cid, state.M)) {
      const msg = { ns: 'Neutron stars: ~10⁶ K but city-sized, so far too faint to plot.', pulsar: 'Pulsars: seen in radio and X-ray beams, not on this diagram.', bh: 'Black holes emit no light of their own.', xrb: 'X-ray binaries shine in X-rays from the disk.', kilonova: 'Kilonova: a brief merger glow, not a star.', bhmerger: 'Black hole mergers emit gravitational waves, not light.', sn1a: 'Type Ia peak ~5 × 10⁹ L☉, off the chart.', cloud: 'Not a star yet: too cold to plot.', collapse: 'Not a star yet: too cold to plot.' }[cid] || '';
      lab(msg, ml + 10, H - mb - 10, { fill: muted, 'font-size': 11 });
    }
  }

  /* ---------- Tabs ---------- */
  const tabs = $$('.tabs [role=tab]');
  let bhView = null;
  function showTab(id, focus) {
    tabs.forEach((t) => {
      const on = t.getAttribute('aria-controls') === id;
      t.setAttribute('aria-selected', on ? 'true' : 'false');
      t.tabIndex = on ? 0 : -1;
      $('#' + t.getAttribute('aria-controls')).hidden = !on;
      if (on && focus) t.focus();
    });
    store.set('tab', id);
    if (id === 'spacetime') { refreshSpaceObjects(); requestAnimationFrame(() => { st._resize(); clockRace._resize(); }); }
    if (id === 'clusters' && window.Modules) window.Modules.Clusters.draw();
    if (id === 'elements' && !renderNP.raf) renderNP();
    if (bhView && bhView.setOpen) bhView.setOpen(id === 'blackhole');
    // charts drawn while their tab was hidden had no width to measure; enforce the phone minimum now
    requestAnimationFrame(() => $$('svg[viewBox]', $('#' + id)).forEach((s) => D.Fmt.minFont(s)));
  }
  // In-text links like <a href="#blackhole" class="tab-link"> open a tab
  document.addEventListener('click', (e) => {
    const a = e.target.closest && e.target.closest('a.tab-link');
    if (!a) return;
    e.preventDefault();
    showTab(a.getAttribute('href').slice(1));
    document.querySelector('.tabs').scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  });
  tabs.forEach((t, i) => {
    t.addEventListener('click', () => showTab(t.getAttribute('aria-controls')));
    t.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowRight') showTab(tabs[(i + 1) % tabs.length].getAttribute('aria-controls'), true);
      if (e.key === 'ArrowLeft') showTab(tabs[(i - 1 + tabs.length) % tabs.length].getAttribute('aria-controls'), true);
    });
  });

  /* ---------- Fusion reactions ---------- */
  let rxKey = 'pp', rxStep = 0, rxTimer = null, rxAnim = null;
  const rxName = (keys) => keys.map((k) => D.S[k].t).join(' + ');

  function nucleus(parent, sp, x, y) {
    const s = D.S[sp], col = D.EL[s.el].c, g = el('g', { transform: `translate(${x},${y})` }, parent);
    if (s.kind === 'gamma') {
      el('path', { d: 'M-16,0 q4,-7 8,0 t8,0 t8,0 t8,0', fill: 'none', stroke: col, 'stroke-width': 2.2 }, g);
      const t = el('text', { x: 0, y: -12, 'text-anchor': 'middle', 'font-size': 13, fill: col }, g); t.textContent = 'γ';
    } else if (s.kind === 'lepton') {
      el('circle', { r: 6, fill: col }, g);
      const t = el('text', { x: 0, y: -11, 'text-anchor': 'middle', 'font-size': 12, fill: col }, g); t.textContent = s.t;
    } else {
      const r = 11 + 4.2 * Math.sqrt(s.a);
      el('circle', { r, fill: col, stroke: s.excited ? '#ffffff' : 'rgba(0,0,0,.25)', 'stroke-width': s.excited ? 2 : 1, 'stroke-dasharray': s.excited ? '4 3' : 'none' }, g);
      const t = el('text', { x: 0, y: 4.5, 'text-anchor': 'middle', 'font-size': 13, 'font-weight': 500, fill: '#0b0e1a' }, g); t.textContent = s.t;
    }
    return g;
  }

  function drawStep(k, animate) {
    const R = D.REACTIONS[rxKey], st = R.steps[k], svg = $('#rxSvg');
    svg.innerHTML = '';
    const cy = 110, cx = 280;
    const css = getComputedStyle(document.documentElement), muted = css.getPropertyValue('--muted').trim();
    const cap = el('text', { x: 16, y: 24, 'font-size': 12, fill: muted }, svg); cap.textContent = `Step ${k + 1} of ${R.steps.length}`;
    const eq = el('text', { x: 544, y: 24, 'text-anchor': 'end', 'font-size': 12, fill: muted }, svg); eq.textContent = `${rxName(st.in)} → ${rxName(st.out)}`;
    const qv = el('text', { x: 280, y: 206, 'text-anchor': 'middle', 'font-size': 12, fill: css.getPropertyValue('--warn').trim() || D.EL.gam.c, 'font-weight': 600 }, svg); qv.textContent = st.q;
    const ins = st.in.map((sp, i) => ({ sp, x0: st.in.length === 1 ? 110 : 60 + i * 120, y0: cy + (i ? 18 : -18), node: null }));
    const outs = st.out.map((sp, i) => ({ sp, x1: 360 + (st.out.length === 1 ? 70 : i * (150 / Math.max(1, st.out.length - 1))), y1: cy + (i - (st.out.length - 1) / 2) * 46, node: null }));
    ins.forEach((o) => { o.node = nucleus(svg, o.sp, o.x0, o.y0); });
    const flash = el('circle', { cx, cy, r: 0, fill: '#ffffff', opacity: 0 }, svg);
    outs.forEach((o) => { o.node = nucleus(svg, o.sp, cx, cy); o.node.setAttribute('opacity', 0); });
    const dur = animate && !matchMedia('(prefers-reduced-motion: reduce)').matches ? 1700 : 0;
    const t0 = performance.now();
    cancelAnimationFrame(rxAnim);
    const frame = (now) => {
      const t = dur ? Math.min(1, (now - t0) / dur) : 1;
      const a = Math.min(1, t / 0.45), e = a * a * (3 - 2 * a);
      ins.forEach((o) => { o.node.setAttribute('transform', `translate(${o.x0 + (cx - o.x0) * e},${o.y0 + (cy - o.y0) * e})`); o.node.setAttribute('opacity', t < 0.5 ? 1 : 0); });
      const f = t >= 0.45 && t < 0.65 ? (t - 0.45) / 0.2 : (t >= 0.65 ? 1 : 0);
      flash.setAttribute('r', 10 + 40 * f); flash.setAttribute('opacity', t >= 0.45 && t < 0.7 ? (1 - f) * 0.8 : 0);
      const b = t < 0.5 ? 0 : Math.min(1, (t - 0.5) / 0.5), eb = b * b * (3 - 2 * b);
      outs.forEach((o) => { o.node.setAttribute('transform', `translate(${cx + (o.x1 - cx) * eb},${cy + (o.y1 - cy) * eb})`); o.node.setAttribute('opacity', b > 0 ? 1 : 0); });
      if (t < 1) rxAnim = requestAnimationFrame(frame);
    };
    rxAnim = requestAnimationFrame(frame);
    $$('#rxSteps button').forEach((b, i) => b.setAttribute('aria-current', i === k ? 'true' : 'false'));
    D.Fmt.minFont(svg);
  }

  function renderReaction() {
    const R = D.REACTIONS[rxKey];
    $('#rxName').textContent = R.name;
    $('#rxWhere').textContent = R.where;
    $('#rxRate').textContent = R.rate;
    $('#rxNet').innerHTML = 'Net: ' + R.net;
    $('#rxExtra').textContent = R.extra;
    const ol = $('#rxSteps'); ol.innerHTML = '';
    R.steps.forEach((s, i) => {
      const li = document.createElement('li');
      li.innerHTML = `<button type="button"><span class="rx-eq">${i + 1}. ${rxName(s.in)} → ${rxName(s.out)}</span><span class="q">${s.q}</span><span class="nt">${s.note}</span></button>`;
      li.firstChild.addEventListener('click', () => { stopPlay(); rxStep = i; drawStep(i, true); });
      ol.appendChild(li);
    });
    rxStep = 0; drawStep(0, false);
  }
  function stopPlay() { clearInterval(rxTimer); rxTimer = null; $('#rxPlay').textContent = 'Play all'; }
  $$('[data-rx]').forEach((b) => b.addEventListener('click', () => {
    stopPlay(); rxKey = b.dataset.rx;
    $$('[data-rx]').forEach((x) => x.setAttribute('aria-pressed', x === b ? 'true' : 'false'));
    renderReaction();
  }));
  $('#rxNext').addEventListener('click', () => { if (rxTimer) { clearInterval(rxTimer); rxTimer = setInterval(() => { rxStep = (rxStep + 1) % D.REACTIONS[rxKey].steps.length; drawStep(rxStep, true); }, 2600); } rxStep = (rxStep + 1) % D.REACTIONS[rxKey].steps.length; drawStep(rxStep, true); });
  $('#rxPrev').addEventListener('click', () => { if (rxTimer) { clearInterval(rxTimer); rxTimer = setInterval(() => { rxStep = (rxStep + 1) % D.REACTIONS[rxKey].steps.length; drawStep(rxStep, true); }, 2600); } const n = D.REACTIONS[rxKey].steps.length; rxStep = (rxStep - 1 + n) % n; drawStep(rxStep, true); });
  $('#rxPlay').addEventListener('click', () => {
    if (rxTimer) { stopPlay(); return; }
    $('#rxPlay').textContent = 'Pause';
    rxStep = 0; drawStep(0, true);
    rxTimer = setInterval(() => { rxStep = (rxStep + 1) % D.REACTIONS[rxKey].steps.length; drawStep(rxStep, true); }, 2600);
  });

  function renderBurning() {
    $('#burnBody').innerHTML = D.BURNING.map((b) => `<tr><td><span class="fuel"><i style="background:${D.EL[b.el].c}"></i>${D.EL[b.el].name}</span></td><td>${b.products}</td><td>${b.T}</td><td>${b.time}</td></tr>`).join('');
  }

  function renderBinding() {
    const svg = $('#bindSvg'); svg.innerHTML = '';
    const H = 300, W = fitWidth(svg, 330, 560, H), ml = 46, mr = 14, mt = 18, mb = 40;
    const X = (A) => ml + A / 240 * (W - ml - mr), Y = (b) => mt + (9.2 - b) / 9.2 * (H - mt - mb);
    const css = getComputedStyle(document.documentElement);
    const muted = css.getPropertyValue('--muted').trim(), line = css.getPropertyValue('--line-soft').trim(), fg = css.getPropertyValue('--fg').trim(), accent = css.getPropertyValue('--accent').trim();
    for (let b = 0; b <= 9; b += 3) { el('line', { x1: ml, x2: W - mr, y1: Y(b), y2: Y(b), stroke: line }, svg); const t = el('text', { x: ml - 8, y: Y(b) + 4, 'text-anchor': 'end', 'font-size': 11, fill: muted }, svg); t.textContent = b; }
    for (let A = 0; A <= 240; A += 40) { const t = el('text', { x: X(A), y: H - mb + 16, 'text-anchor': 'middle', 'font-size': 11, fill: muted }, svg); t.textContent = A; }
    const ax = el('text', { x: (ml + W) / 2, y: H - 6, 'text-anchor': 'middle', 'font-size': 11, fill: muted }, svg); ax.textContent = 'Mass number A (nucleons)';
    const ay = el('text', { x: 12, y: Y(4.5), 'text-anchor': 'middle', 'font-size': 11, fill: muted, transform: `rotate(-90 12 ${Y(4.5)})` }, svg); ay.textContent = 'MeV per nucleon';
    // peak zone
    el('rect', { x: X(50), y: mt, width: X(66) - X(50), height: H - mt - mb, fill: D.EL.Fe.c, opacity: 0.12 }, svg);
    const pk = el('text', { x: X(58), y: H - mb - 8, 'text-anchor': 'middle', 'font-size': 10, fill: D.EL.Fe.c }, svg); pk.textContent = 'iron peak';
    const smooth = D.BINDING.filter((b) => b[1] !== 9 && b[1] !== 7 && b[1] !== 14);
    el('path', { d: smooth.map((b, i) => `${i ? 'L' : 'M'}${X(b[1])},${Y(b[2])}`).join(' '), fill: 'none', stroke: muted, 'stroke-width': 1.2, opacity: 0.7 }, svg);
    const labelled = new Set(['²H', '⁴He', '¹²C', '¹⁶O', '²⁸Si', '⁵⁶Fe', '⁶²Ni', '¹⁹⁷Au', '²³⁸U']);
    D.BINDING.forEach((b) => {
      const col = b[3] ? D.EL[b[3]].c : muted;
      el('circle', { cx: X(b[1]), cy: Y(b[2]), r: labelled.has(b[0]) ? 4.5 : 3, fill: col }, svg);
      if (labelled.has(b[0])) {
        const off = { '²H': [8, 4, 'start'], '⁴He': [-7, 4, 'end'], '¹²C': [-6, 15, 'end'], '¹⁶O': [6, 16, 'start'], '²⁸Si': [0, 17, 'middle'], '⁵⁶Fe': [-6, 18, 'end'], '⁶²Ni': [6, -9, 'start'], '¹⁹⁷Au': [0, -10, 'middle'], '²³⁸U': [0, -10, 'middle'] }[b[0]];
        const t = el('text', { x: X(b[1]) + off[0], y: Y(b[2]) + off[1], 'text-anchor': off[2], 'font-size': 11, fill: fg }, svg); t.textContent = b[0];
      }
    });
    // arrows
    const arr = (x1, y1, x2, y2, txt, anchor, dy) => {
      el('path', { d: `M${x1},${y1} L${x2},${y2}`, stroke: accent, 'stroke-width': 1.5, fill: 'none', 'marker-end': 'url(#ah)' }, svg);
      const t = el('text', { x: (x1 + x2) / 2, y: (y1 + y2) / 2 + (dy == null ? 16 : dy), 'text-anchor': anchor || 'middle', 'font-size': 10, fill: accent }, svg); t.textContent = txt;
    };
    const defs = el('defs', {}, svg); const m = el('marker', { id: 'ah', viewBox: '0 0 10 10', refX: 8, refY: 5, markerWidth: 6, markerHeight: 6, orient: 'auto' }, defs);
    el('path', { d: 'M1,1 L9,5 L1,9', fill: 'none', stroke: accent, 'stroke-width': 1.6 }, m);
    arr(X(14), Y(5.6), X(44), Y(7.9), 'fusion releases energy', 'start');
    arr(X(225), Y(6.9), X(150), Y(7.85), 'fission releases energy', 'middle', -10);
    ['⁶²Ni is the most tightly bound;', '⁵⁶Fe is a hair behind.', 'Silicon burning ends at ⁵⁶Ni,', 'which decays to ⁵⁶Fe.'].forEach((line, i) => { const n = el('text', { x: X(70), y: Y(2.2) + i * 14, 'font-size': 10, fill: muted }, svg); n.textContent = line; });
    D.Fmt.minFont(svg);
  }

  /* ---------- Neutron capture chart ---------- */
  let npMode = 'r';
  function nStable(Z) { let A = 2 * Z; for (let k = 0; k < 30; k++) A = Z * (1.98 + 0.0155 * Math.pow(A, 2 / 3)); return A - Z; }
  function renderNP() {
    const svg = $('#npSvg'); svg.innerHTML = '';
    const W = 620, H = 420, ml = 44, mr = 14, mt = 16, mb = 40;
    const nMin = 26, nMax = 165, zMin = 24, zMax = 94;
    const X = (N) => ml + (N - nMin) / (nMax - nMin) * (W - ml - mr), Y = (Z) => mt + (zMax - Z) / (zMax - zMin) * (H - mt - mb);
    const css = getComputedStyle(document.documentElement);
    const muted = css.getPropertyValue('--muted').trim(), line = css.getPropertyValue('--line-soft').trim(), fg = css.getPropertyValue('--fg').trim(), faint = css.getPropertyValue('--faint').trim();
    const txt = (s, x, y, o) => { const t = el('text', Object.assign({ x, y, 'font-size': 11, fill: muted }, o || {}), svg); t.textContent = s; return t; };
    for (let N = 40; N <= 160; N += 20) { el('line', { x1: X(N), x2: X(N), y1: mt, y2: H - mb, stroke: line }, svg); txt(N, X(N), H - mb + 16, { 'text-anchor': 'middle' }); }
    for (let Z = 30; Z <= 90; Z += 10) { el('line', { x1: ml, x2: W - mr, y1: Y(Z), y2: Y(Z), stroke: line }, svg); txt(Z, ml - 8, Y(Z) + 4, { 'text-anchor': 'end' }); }
    txt('Neutrons N →', (ml + W) / 2, H - 6, { 'text-anchor': 'middle' });
    txt('Protons Z →', 12, Y(60), { 'text-anchor': 'middle', transform: `rotate(-90 12 ${Y(60)})` });
    // magic numbers
    [50, 82, 126].forEach((m) => { el('line', { x1: X(m), x2: X(m), y1: mt, y2: H - mb, stroke: '#a98bff', 'stroke-dasharray': '4 4', opacity: 0.7 }, svg); txt('N=' + m, X(m) + 4, mt + 12, { fill: '#a98bff', 'font-size': 10 }); });
    // valley of stability and drip line
    const valley = [], drip = [];
    for (let Z = zMin; Z <= zMax; Z++) { const n = nStable(Z); valley.push([X(n), Y(Z)]); drip.push([X(Math.min(nMax, n + 0.4 * Z + 8)), Y(Z)]); }
    el('path', { d: valley.map((p, i) => (i ? 'L' : 'M') + p.join(',')).join(' '), stroke: fg, 'stroke-width': 7, opacity: 0.22, fill: 'none', 'stroke-linecap': 'round' }, svg);
    txt('valley of stability', X(nStable(40)) - 10, Y(40) - 6, { 'text-anchor': 'end' });
    el('path', { d: drip.map((p, i) => (i ? 'L' : 'M') + p.join(',')).join(' '), stroke: faint, 'stroke-dasharray': '2 4', fill: 'none' }, svg);
    txt('neutron drip line (approx.)', X(nStable(34) + 0.4 * 34 + 10), Y(34) + 4, { 'font-size': 10 });

    // paths
    const pathPts = [];
    if (npMode === 's') {
      let Z = 26, N = 30;
      pathPts.push([N, Z]);
      while (Z < 83) {
        const target = Math.round(nStable(Z) + 1.5);
        while (N < target) { N++; pathPts.push([N, Z]); }
        Z++; N--; pathPts.push([N, Z]);
        if (N >= 126 && Z >= 82) break;
      }
    } else {
      let Z = 26, N = 30; pathPts.push([N, Z]);
      // neutron flood: jump far to the neutron-rich side, then climb with waiting points at magic N
      for (Z = 26; Z <= 80; Z++) {
        let n = nStable(Z) + 0.27 * Z + 4;
        [50, 82, 126].forEach((m) => { if (n >= m && n < m + 9) n = m; });
        pathPts.push([Math.round(n), Z]);
      }
    }
    const d = pathPts.map((p, i) => (i ? 'L' : 'M') + X(p[0]).toFixed(1) + ',' + Y(p[1]).toFixed(1)).join(' ');
    const col = npMode === 's' ? D.EL.Ni.c : D.EL.Au.c;
    const pathEl = el('path', { d, stroke: col, 'stroke-width': 2.2, fill: 'none', 'stroke-linejoin': 'round' }, svg);

    // r-process decay back to stability at the three peaks
    const decays = [];
    if (npMode === 'r') {
      [[80, 34, 'Se', 'peak 1, A≈80'], [130, 52, 'Te', 'peak 2, A≈130'], [195, 78, 'Pt', '¹⁹⁵Pt'], [197, 79, 'Au', '¹⁹⁷Au']].forEach(([A, Zs, sym, lbl]) => {
        // find the path point with Z + N closest to A
        let best = pathPts[0], bd = 1e9; pathPts.forEach((p) => { const dd = Math.abs(p[0] + p[1] - A); if (dd < bd) { bd = dd; best = p; } });
        const zS = best[1], nS = A - zS;
        decays.push({ from: [nS, zS], to: [A - Zs, Zs], sym, lbl });
      });
      decays.forEach((dc, i) => {
        el('path', { d: `M${X(dc.from[0])},${Y(dc.from[1])} L${X(dc.to[0])},${Y(dc.to[1])}`, stroke: D.EL[dc.sym] ? D.EL[dc.sym].c : fg, 'stroke-width': 1.6, 'stroke-dasharray': '5 3', fill: 'none', 'marker-end': 'url(#nah)' }, svg);
        if (i < 2) txt(dc.lbl, X(dc.to[0]) - 7, Y(dc.to[1]) + 4, { fill: D.EL[dc.sym] ? D.EL[dc.sym].c : fg, 'text-anchor': 'end', 'font-weight': 600, 'paint-order': 'stroke', stroke: css.getPropertyValue('--bg').trim() || '#000', 'stroke-width': 3 });
      });
    }
    const defs = el('defs', {}, svg); const mk = el('marker', { id: 'nah', viewBox: '0 0 10 10', refX: 8, refY: 5, markerWidth: 6, markerHeight: 6, orient: 'auto' }, defs);
    el('path', { d: 'M1,1 L9,5 L1,9', fill: 'none', stroke: fg, 'stroke-width': 1.6 }, mk);
    // landmark nuclei
    [['Fe', 26, 30, '⁵⁶Fe', 'Fe'], ['Sr', 38, 50, '⁸⁸Sr', null], ['Ba', 56, 82, '¹³⁸Ba', null], ['Pt', 78, 117, '¹⁹⁵Pt', 'Pt'], ['Au', 79, 118, '¹⁹⁷Au', 'Au'], ['Pb', 82, 126, '²⁰⁸Pb', null], ['U', 92, 146, '²³⁸U', null]].forEach(([s, Z, N, lbl, key]) => {
      const sb = npMode === 'r' && (s === 'Sr' || s === 'Ba');   // s-process landmarks: fade in r mode so the peaks aren't read as Sr/Ba
      el('circle', { cx: X(N), cy: Y(Z), r: sb ? 3.5 : 5, fill: key ? D.EL[key].c : fg, stroke: 'rgba(0,0,0,.4)', opacity: sb ? 0.3 : 1 }, svg);
      if (!sb) txt(lbl, X(N) + (s === 'Pt' ? -8 : 8), Y(Z) + (s === 'Pt' ? 14 : -6), { fill: fg, 'text-anchor': s === 'Pt' ? 'end' : 'start' });
    });
    D.Fmt.minFont(svg);
    // animated dot along the path
    const dot = el('circle', { r: 6, fill: '#ffffff', stroke: col, 'stroke-width': 2 }, svg);
    const len = pathEl.getTotalLength ? pathEl.getTotalLength() : 0;
    cancelAnimationFrame(renderNP.raf);
    const t0 = performance.now();
    const step = (now) => {
      if ($('#elements').hidden || !renderNP.onScreen) { renderNP.raf = null; return; }
      const f = ((now - t0) / 7000) % 1;
      if (len) { const p = pathEl.getPointAtLength(f * len); dot.setAttribute('cx', p.x); dot.setAttribute('cy', p.y); }
      renderNP.raf = requestAnimationFrame(step);
    };
    if (!matchMedia('(prefers-reduced-motion: reduce)').matches) renderNP.raf = requestAnimationFrame(step);
    else if (len) { const p = pathEl.getPointAtLength(len); dot.setAttribute('cx', p.x); dot.setAttribute('cy', p.y); }

    $('#npInfo').innerHTML = npMode === 'r' ? `
      <h3>r-process: how gold is made</h3>
      <ol>
        <li><b>Neutron flood.</b> In merger debris there are &gt;10²⁰ free neutrons per cm³. A seed nucleus swallows neutrons faster than it can decay, racing far to the neutron-rich side.</li>
        <li><b>Waiting points.</b> At magic neutron numbers (50, 82, 126) nuclei are extra stable and stop capturing. They wait for β⁻ decays, so the path climbs straight up in Z.</li>
        <li><b>Freeze-out.</b> After about a second the neutrons run out. The exotic nuclei β⁻-decay back toward stability along lines of constant A (dashed).</li>
        <li><b>Result.</b> Abundance peaks at A ≈ 80, 130 and 195. The third peak, from N = 126, is exactly where <b>platinum (195)</b> and <b>gold (197)</b> sit.</li>
      </ol>
      <p class="note">Evidence: the GW170817 kilonova (2017) glowed red from lanthanide-rich ejecta, and strontium was identified in its spectrum. Ordinary core-collapse supernovae appear to make little gold; rare collapsars may add some.</p>`
      : `
      <h3>s-process: the slow route</h3>
      <ol>
        <li><b>Gentle neutron source.</b> In AGB stars, ¹³C(α,n)¹⁶O and ²²Ne(α,n)²⁵Mg release neutrons between the burning shells.</li>
        <li><b>One at a time.</b> A nucleus captures a neutron only every few years to millennia, so any unstable isotope β⁻-decays before the next capture.</li>
        <li><b>Hugs stability.</b> The path zig-zags along the valley: capture (→), decay (↖).</li>
        <li><b>Stops at lead.</b> It ends at ²⁰⁸Pb and ²⁰⁹Bi, because heavier nuclei alpha-decay back. It cannot reach uranium, and makes only ~5% of gold.</li>
      </ol>
      <p class="note">Technetium (no stable isotopes, half-life ~4 million years) seen in red giant spectra in 1952 proved that stars make elements right now.</p>`;
  }
  $$('[data-np]').forEach((b) => b.addEventListener('click', () => {
    npMode = b.dataset.np;
    $$('[data-np]').forEach((x) => x.setAttribute('aria-pressed', x === b ? 'true' : 'false'));
    renderNP();
  }));

  /* ---------- Spacetime ---------- */
  const st = new window.Spacetime($('#stCanvas'));
  const clockRace = new window.ClockRace($('#clockCanvas'));
  let stKey = 'sun', morph = null;
  function spaceObjects() {
    const M = state.M, r = P.remnantOf(M), z = P.zams(M);
    const wdM = M < L.supernova && M >= L.redDwarfFate ? P.whiteDwarfMass(M) : 0.6;
    const bhM = r.type === 'bh' ? r.mass : 10;
    return {
      earth: { name: 'Earth', M: P.K.Mearth, R: P.K.Rearth, T: 288 },
      sun: { name: 'Sun', M: P.K.Msun, R: P.K.Rsun, T: 5772 },
      star: { name: `This star (${M.toFixed(1)} M☉)`, M: M * P.K.Msun, R: z.R * P.K.Rsun, T: z.T },
      wd: { name: `White dwarf (${wdM.toFixed(2)} M☉)`, M: wdM * P.K.Msun, R: P.whiteDwarfRadius(wdM) * P.K.Rsun, T: 25000 },
      ns: { name: 'Neutron star (1.4 M☉)', M: 1.4 * P.K.Msun, R: 12e3, T: 1e6 },
      bh: { name: `Black hole (${bhM.toFixed(0)} M☉)`, M: bhM * P.K.Msun, R: 0, T: 0 },
    };
  }
  // where each kind of object's surface sits, in units of its own rₛ (1 Msun for the compact ones)
  function markersFor() {
    const rs1 = P.schwarzschildRadius(P.K.Msun);
    return [
      { label: 'Sun surface', r: P.K.Rsun / rs1 },
      { label: 'white dwarf', r: P.whiteDwarfRadius(1.0) * P.K.Rsun / rs1 },
      { label: 'neutron star', r: 12e3 / P.schwarzschildRadius(1.4 * P.K.Msun) },
      { label: 'photon sphere 1.5 rₛ', r: 1.5 },
    ];
  }
  function refreshSpaceObjects() {
    if (morph) return;
    const objs = spaceObjects(), box = $('#stObjects');
    box.innerHTML = '';
    Object.entries(objs).forEach(([k, o]) => {
      const b = document.createElement('button'); b.type = 'button'; b.textContent = o.name;
      b.setAttribute('aria-pressed', k === stKey ? 'true' : 'false');
      b.addEventListener('click', () => { stopMorph(); stKey = k; refreshSpaceObjects(); });
      box.appendChild(b);
    });
    st.setObject(objs[stKey], markersFor());
    syncProbe();
    updateSpaceStats();
  }
  function syncProbe() {
    const lo = st.probeMin(), hi = 9.9;
    $('#probe').value = Math.round((st.xProbe - lo) / (hi - lo) * 1000);
  }
  const fmtLoss = (slow) => {
    const s = slow * 86400;
    return s > 3600 ? F.sig(s / 3600, 3) + ' h' : s > 60 ? F.sig(s / 60, 3) + ' min' : s > 1 ? F.sig(s, 3) + ' s' : s > 1e-3 ? F.sig(s * 1e3, 3) + ' ms' : s > 1e-6 ? F.sig(s * 1e6, 3) + ' μs' : F.sig(s * 1e9, 3) + ' ns';
  };
  function updateSpaceStats() {
    const s = st.stats(), o = st.obj;
    $('#probeOut').innerHTML = `${F.sig(s.r, s.r < 10 ? 4 : 3)} rₛ${s.Rrs && s.r <= s.Rrs * 1.0001 ? ' (surface)' : ''}`;
    const kind = !s.Rrs ? 'black hole' : s.Rrs < 10 ? 'neutron star' : s.Rrs < 1e5 ? 'white dwarf' : 'ordinary star or planet';
    $('#stHeadline').innerHTML = s.Rrs
      ? `<b>${o.name}</b>: surface at <b>${F.sig(s.Rrs, 3)} rₛ</b>. The well stops there, so it is ${s.Rrs > 1e5 ? 'shallow' : s.Rrs > 100 ? 'deeper' : 'very deep'}.`
      : `<b>${o.name}</b>: no surface. The well runs all the way down to the horizon at 1 rₛ and beyond.`;
    const rows = [
      ['Schwarzschild radius rₛ', s.rs < 1 ? F.sig(s.rs * 1000, 3) + ' mm' : F.sig(s.rs / 1000, 3) + ' km'],
      ['Radius in units of rₛ', s.Rrs ? F.sig(s.Rrs, 3) : '— (all horizon)'],
      ['Clock rate at probe, dτ/dt', s.rate > 0.999999 ? s.rate.toFixed(10) : F.sig(s.rate, 6)],
      ['Probe clock loses per day', fmtLoss(1 - s.rate)],
    ];
    if (s.Rrs) rows.push(['At the surface, clocks lose', fmtLoss(1 - s.surf) + ' per day'], ['At the centre (uniform model)', fmtLoss(1 - s.centre) + ' per day']);
    else rows.push(['At the horizon', 'dτ/dt → 0 (far-away view only)']);
    rows.push(['Escape speed at probe', F.sig(s.vesc, 3) + ' c']);
    $('#stStats').innerHTML = rows.map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join('');
  }
  $('#probe').addEventListener('input', (e) => { const lo = st.probeMin(), hi = 9.9; st.setProbe(lo + (hi - lo) * (+e.target.value) / 1000); updateSpaceStats(); });

  // Same mass, denser and denser: shrink a 1 Msun object from the Sun's size to a black hole
  function stopMorph() { if (!morph) return; morph = null; st.onTick = null; const b = $('#stMorph'); b.textContent = 'Same mass, denser and denser'; b.setAttribute('aria-pressed', 'false'); }
  $('#stMorph').addEventListener('click', () => {
    if (morph) { stopMorph(); refreshSpaceObjects(); return; }
    const b = $('#stMorph'); b.textContent = 'Stop'; b.setAttribute('aria-pressed', 'true');
    $$('#stObjects button').forEach((x) => x.setAttribute('aria-pressed', 'false'));
    const rs = P.schwarzschildRadius(P.K.Msun);
    const x0 = Math.log10(P.K.Rsun / rs), dur = 9;
    morph = { t: 0 };
    st.onTick = (dt) => {
      if (!morph) return;
      morph.t += dt;
      const f = Math.min(1, morph.t / dur);
      // Buchdahl: no static star can be smaller than 9/8 rₛ. Hold there, then collapse.
      const xB = Math.log10(9 / 8);
      let x = x0 * (1 - f), Rm, name;
      if (x > xB) {
        Rm = Math.pow(10, x) * rs;
        name = x > 4.8 ? '1 M☉ Sun-like star' : x > 3.0 ? '1 M☉ at white-dwarf density' : x > 0.95 ? '1 M☉ denser than any white dwarf' : x > 0.45 ? '1 M☉ at neutron-star size' : x > Math.log10(1.5) ? '1 M☉ approaching the photon sphere' : '1 M☉ inside the photon sphere';
      } else {
        if (morph.hold == null) morph.hold = morph.t;
        const held = morph.t - morph.hold;
        Rm = held < 2.2 ? 9 / 8 * rs : 0;
        name = Rm ? 'Buchdahl limit (9/8 rₛ): no static star can be more compact' : '1 M☉ black hole';
      }
      const T = Rm === 0 ? 0 : (x > 4.5 ? 5772 : x > 2 ? 25000 : 1e6);
      st.setObject({ name, M: P.K.Msun, R: Rm, T, morph: true }, markersFor());
      updateSpaceStats();
      if (Rm === 0 && morph.hold != null) { morph = null; st.onTick = null; b.textContent = 'Same mass, denser and denser'; b.setAttribute('aria-pressed', 'false'); }
    };
    st.start();
  });

  // Evidence panel
  function renderEvidence() {
    const b = +$('#bendB').value;
    $('#bendBOut').textContent = b.toFixed(1);
    const a = window.Rel.lightBend($('#bendSvg'), b);
    $('#bendOut').innerHTML = `α = 4GM/(c²b) = <b>${a.toFixed(2)}″</b> &nbsp;(Newtonian guess: ${(a / 2).toFixed(2)}″). Eddington measured ~1.6–2.0″ at the Sun's edge.`;
    const m = window.Rel.mercuryNumbers();
    $('#mercOut').innerHTML = `GR adds <b>${m.perCentury.toFixed(1)}″ per century</b> (${m.perOrbit.toFixed(3)}″ per orbit). Observed 574″, Newtonian planets explain 531″: the missing 43″ is exactly relativity.`;
    $('#zBody').innerHTML = window.Rel.redshiftRows().map(([n, z, v]) => `<tr><td>${n}</td><td>${F.sig(z, 3)}</td><td>${v < 1 ? F.sig(v * 1000, 3) + ' m/s' : F.sig(v, 3) + ' km/s'}</td></tr>`).join('');
    const gps = [['Weaker gravity', +45.7, '#5ee6a8'], ['Orbital speed', -7.2, '#ff6b5e'], ['Net per day', +38.5, '#ffb454']];
    $('#gps').innerHTML = gps.map(([k, v, c]) => `<div class="row"><span>${k}</span><span class="bar" style="width:${Math.abs(v) / 45.7 * 100}%;background:${c}"></span><span class="val">${v > 0 ? '+' : ''}${v} μs</span></div>`).join('');
    window.Rel.chirp($('#chirpSvg'));
  }
  $('#bendB').addEventListener('input', renderEvidence);
  window.Rel.mercury($('#mercCanvas'));

  /* ---------- Equations ---------- */
  const z = () => P.zams(state.M);
  const EQS = [
    { t: 'Schwarzschild radius', f: 'r<sub>s</sub> = 2GM / c²', ins: [['M', 'Mass (M☉)', () => state.M]],
      go: (v) => { const rs = P.schwarzschildRadius(v.M * P.K.Msun); return [['rₛ', F.sig(rs / 1e3, 4) + ' km'], ['per solar mass', '2.953 km']]; },
      why: 'Squeeze the mass inside this radius and light cannot escape. Earth: 8.9 mm.' },
    { t: 'Gravitational time dilation', f: 'dτ/dt = √(1 − r<sub>s</sub>/r)', ins: [['M', 'Mass (M☉)', () => 1.4], ['r', 'Distance r (km)', () => 12]],
      go: (v) => { const rs = P.schwarzschildRadius(v.M * P.K.Msun) / 1e3; if (v.r <= rs) return [['', 'r is inside the horizon (rₛ = ' + F.sig(rs, 3) + ' km)']]; const k = Math.sqrt(1 - rs / v.r); return [['dτ/dt', F.sig(k, 6)], ['clock at r per far hour', F.sig(60 * k, 5) + ' min']]; },
      why: 'Clocks deeper in gravity tick slower relative to distant clocks.' },
    { t: 'Stefan–Boltzmann law', f: 'L = 4πR²σT⁴', ins: [['R', 'Radius (R☉)', () => +z().R.toPrecision(3)], ['T', 'Surface T (K)', () => Math.round(z().T)]],
      go: (v) => { const Lw = P.luminositySB(v.R * P.K.Rsun, v.T); return [['L', F.sig(Lw / P.K.Lsun, 4) + ' L☉'], ['', F.sig(Lw, 3) + ' W']]; },
      why: 'Double the temperature: 16× the light. Double the radius: 4×.' },
    { t: 'Wien\'s law', f: 'λ<sub>max</sub> = b / T, b = 2.898 × 10⁻³ m·K', ins: [['T', 'Temperature (K)', () => Math.round(z().T)]],
      go: (v) => { const nm = P.wienPeak(v.T) * 1e9; const band = nm < 10 ? 'X-ray' : nm < 380 ? 'ultraviolet' : nm < 450 ? 'violet' : nm < 495 ? 'blue' : nm < 570 ? 'green' : nm < 590 ? 'yellow' : nm < 750 ? 'red' : 'infrared'; return [['λ_max', F.sig(nm, 4) + ' nm'], ['band', band]]; },
      why: 'Hotter means peak emission at shorter wavelength, which is why hot stars look blue.' },
    { t: 'Main-sequence lifetime', f: 't ≈ 10¹⁰ yr × (M/M☉)<sup>−2.5</sup>', ins: [['M', 'Mass (M☉)', () => state.M]],
      go: (v) => [['rule of thumb', F.years(P.simpleLifetime(v.M))], ['model grid', F.years(P.msLifetime(v.M))]],
      why: 'From t ∝ M/L with L ∝ M^3.5. The rule runs long for 2–10 M☉ and short above ~20 M☉ (there L ∝ M and winds matter); the model value interpolates stellar-evolution grids.' },
    { t: 'Mass–luminosity', f: 'L ≈ M<sup>4</sup> (0.43–2 M☉), 1.4 M<sup>3.5</sup> (2–55 M☉)', ins: [['M', 'Mass (M☉)', () => state.M]],
      go: (v) => [['L', F.sig(P.msLuminosity(v.M), 4) + ' L☉']],
      why: 'Heavier stars need hotter, denser cores to hold up their weight, so fusion runs far faster.' },
    { t: 'Jeans mass and collapse time', f: 'M<sub>J</sub> = (5kT / Gμm<sub>H</sub>)<sup>3/2</sup> (3 / 4πρ)<sup>1/2</sup>', ins: [['T', 'Cloud T (K)', () => 10], ['n', 'Density (molecules/cm³)', () => 10000]],
      go: (v) => [['M_J', F.sig(P.jeansMass(v.T, v.n) / P.K.Msun, 3) + ' M☉'], ['free-fall time', F.years(P.freeFallTime(v.n) / P.K.yr)]],
      why: 'μ = 2.33 for molecular gas. Colder or denser clouds collapse at lower mass.' },
    { t: 'Mass to energy (E = Δm c²)', f: '4 ¹H → ⁴He: Δm = 0.0287 u', ins: [['L', 'Luminosity (L☉)', () => +P.msLuminosity(state.M).toPrecision(3)]],
      go: (v) => { const e = P.ppEnergy(); const Lw = v.L * P.K.Lsun; return [['energy per He', e.MeV.toFixed(2) + ' MeV'], ['mass converted', (e.fraction * 100).toFixed(2) + '%'], ['mass → energy', F.sig(Lw / (P.K.c * P.K.c), 3) + ' kg/s'], ['hydrogen fused', F.sig(Lw / (P.K.c * P.K.c) / e.fraction, 3) + ' kg/s']]; },
      why: 'The Sun converts ~4.3 million tonnes of mass to energy every second.' },
    { t: 'Escape velocity and surface gravity', f: 'v<sub>esc</sub> = √(2GM/R) · g = GM/R²', ins: [['M', 'Mass (M☉)', () => state.M], ['R', 'Radius (km)', () => Math.round(z().R * P.K.Rsun / 1e3)]],
      go: (v) => { const m = v.M * P.K.Msun, r = v.R * 1e3, ve = P.escapeVelocity(m, r); return [['v_esc', F.sig(ve / 1e3, 4) + ' km/s'], ['v_esc / c', F.sig(ve / P.K.c, 3)], ['g', F.sig(P.surfaceGravity(m, r) / 9.81, 3) + ' Earth g']]; },
      why: 'When v_esc reaches c, R equals the Schwarzschild radius.' },
    { t: 'Hydrostatic estimates', f: 'dP/dr = −GM(r)ρ/r² ⇒ P<sub>c</sub> ~ GM²/R⁴, T<sub>c</sub> ~ GMμm<sub>H</sub>/kR', ins: [['M', 'Mass (M☉)', () => state.M], ['R', 'Radius (R☉)', () => +z().R.toPrecision(3)]],
      go: (v) => { const m = v.M * P.K.Msun, r = v.R * P.K.Rsun; return [['T_c (virial)', F.sig(P.virialCoreTemp(m, r), 3) + ' K'], ['P_c (order of mag.)', F.sig(P.centralPressureEstimate(m, r), 3) + ' Pa']]; },
      why: 'Sun: estimates give ~1.4 × 10⁷ K and ~10¹⁵ Pa. Real values are 1.57 × 10⁷ K and 2.5 × 10¹⁶ Pa (the core is denser than average).' },
    { t: 'Spin-up by collapse', f: 'I₁ω₁ = I₂ω₂ ⇒ P₂ = P₁ (R₂/R₁)²', ins: [['P1', 'Initial period (days)', () => 25], ['R1', 'Initial radius (km)', () => 696000], ['R2', 'Final radius (km)', () => 12]],
      go: (v) => { const p = P.spinUpPeriod(v.P1 * 86400, v.R1, v.R2); return [['P₂', p < 1 ? F.sig(p * 1e3, 3) + ' ms' : F.sig(p, 3) + ' s'], ['spins per second', F.sig(1 / p, 3)]]; },
      why: 'Like a skater pulling in their arms. Real cores lose angular momentum, so newborn pulsars spin at ~10–100 ms.' },
    { t: 'White dwarf mass–radius', f: 'R ≈ 0.0112 R☉ √((M/M<sub>ch</sub>)<sup>−2/3</sup> − (M/M<sub>ch</sub>)<sup>2/3</sup>)', ins: [['M', 'WD mass (M☉)', () => 0.6]],
      go: (v) => { if (v.M >= 1.44) return [['', 'Above the Chandrasekhar limit: no stable white dwarf']]; const R = P.whiteDwarfRadius(v.M) * P.K.Rsun / 1e3; return [['R', F.sig(R, 4) + ' km'], ['vs Earth', F.sig(R / 6371, 3) + ' R⊕']]; },
      why: 'More mass, smaller star. Radius goes to zero at the Chandrasekhar limit (~1.44 M☉).' },
    { t: 'Kelvin–Helmholtz time', f: 't<sub>KH</sub> = GM² / (RL)', ins: [['M', 'Mass (M☉)', () => state.M], ['R', 'Radius (R☉)', () => +z().R.toPrecision(3)], ['L', 'Luminosity (L☉)', () => +P.msLuminosity(state.M).toPrecision(3)]],
      go: (v) => [['t_KH', F.years(P.kelvinHelmholtz(v.M * P.K.Msun, v.R * P.K.Rsun, v.L * P.K.Lsun) / P.K.yr)]],
      why: 'How long contraction alone could power the star. For the Sun ~30 million years, far too short, which proved stars need nuclear fusion.' },
    { t: 'Photon sphere and innermost orbit', f: 'r<sub>ph</sub> = 1.5 r<sub>s</sub> · r<sub>ISCO</sub> = 3 r<sub>s</sub> (non-spinning)', ins: [['M', 'Black hole mass (M☉)', () => P.blackHoleMass(Math.max(state.M, 25))]],
      go: (v) => { const rs = P.schwarzschildRadius(v.M * P.K.Msun) / 1e3; return [['horizon rₛ', F.sig(rs, 4) + ' km'], ['photon sphere', F.sig(1.5 * rs, 4) + ' km'], ['ISCO', F.sig(3 * rs, 4) + ' km'], ['shadow radius', F.sig(Math.sqrt(27) / 2 * rs, 4) + ' km']]; },
      why: 'Light can circle at the photon sphere. Gas cannot orbit stably inside the ISCO, so accretion disks end there.' },
    { t: 'Inverse-square brightness', f: 'F = L / (4πd²)', ins: [['L', 'Luminosity (L☉)', () => +P.msLuminosity(state.M).toPrecision(3)], ['d', 'Distance (light-years)', () => 100]],
      go: (v) => { const Fl = v.L * P.K.Lsun / (4 * Math.PI * Math.pow(v.d * 9.4607e15, 2)); const Fsun = P.K.Lsun / (4 * Math.PI * Math.pow(1.495978707e11, 2)); return [['flux', F.sig(Fl, 3) + ' W/m²'], ['vs Sun from Earth', F.sig(Fl / Fsun, 3)]]; },
      why: 'This is why standard candles work: know L, measure F, solve for distance d.' },
  ];
  function renderEquations() {
    const grid = $('#eqGrid'); grid.innerHTML = '';
    EQS.forEach((q, qi) => {
      const card = document.createElement('div'); card.className = 'eq';
      card.innerHTML = `<h3>${q.t}</h3><div class="f">${q.f}</div><div class="ins"></div><div class="out" aria-live="polite"></div><p class="why">${q.why}</p>`;
      const ins = card.querySelector('.ins');
      q.ins.forEach(([k, label]) => {
        const id = `eq${qi}_${k}`;
        const lab = document.createElement('label'); lab.htmlFor = id;
        lab.innerHTML = `<span>${label}</span><input id="${id}" type="number" step="any" inputmode="decimal">`;
        ins.appendChild(lab);
      });
      const compute = () => {
        const v = {}; let bad = '';
        q.ins.forEach(([k, label]) => { const x = parseFloat($(`#eq${qi}_${k}`).value); if (!(x > 0)) bad = `Enter a positive number for ${label.charAt(0).toLowerCase() + label.slice(1)}.`; v[k] = x; });
        const out = card.querySelector('.out');
        if (bad) { out.innerHTML = `<span class="err">${bad}</span>`; return; }
        out.innerHTML = q.go(v).map(([k, val]) => `<span>${k ? k + ' = ' : ''}<b>${val}</b></span>`).join('');
      };
      card.addEventListener('input', compute);
      card._fill = () => { q.ins.forEach(([k, , def]) => { $(`#eq${qi}_${k}`).value = def(); }); compute(); };
      grid.appendChild(card);
    });
    refreshEquations();
  }
  function refreshEquations() { $$('#eqGrid .eq').forEach((c) => c._fill && c._fill()); }

  /* ---------- Quiz ---------- */
  let qi = 0, score = 0, answered = false, quizSeed = (Date.now() & 0xffff);
  // Shuffle answer order per question (new order each restart) so the right letter isn't predictable.
  function quizOrder(k, n) {
    let s = (quizSeed * 31 + k * 977 + 13) >>> 0; const r = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
    const o = Array.from({ length: n }, (_, i) => i);
    for (let i = n - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [o[i], o[j]] = [o[j], o[i]]; }
    return o;
  }
  function renderQuiz() {
    const box = $('#quizBox');
    if (qi >= D.QUIZ.length) {
      box.innerHTML = `<div class="card"><p class="progress">Done</p><h3>${score} / ${D.QUIZ.length}</h3><p class="muted">${score / D.QUIZ.length >= 0.85 ? 'Excellent.' : score / D.QUIZ.length >= 0.65 ? 'Solid. Review the ones you missed.' : 'Go back through the stages and the topic tabs, then try again.'}</p><div class="actions"><button class="btn btn-primary" type="button" id="qRestart">Restart</button></div></div>`;
      $('#qRestart').addEventListener('click', () => { qi = 0; score = 0; quizSeed = (quizSeed * 7 + 1) & 0xffff; renderQuiz(); });
      return;
    }
    const q = D.QUIZ[qi]; answered = false;
    box.innerHTML = `<form class="card" id="qForm" novalidate>
      <p class="progress">Question ${qi + 1} of ${D.QUIZ.length} · score ${score}</p>
      <fieldset><legend>${q.q}</legend>
        ${quizOrder(qi, q.a.length).map((i) => `<label class="opt"><input type="radio" name="qa" value="${i}" id="qa${i}"> ${q.a[i]}</label>`).join('')}
      </fieldset>
      <p class="err" id="qErr" hidden>Pick an answer first.</p>
      <p class="fb" id="qFb" hidden></p>
      <div class="actions"><button class="btn btn-primary" type="submit" id="qBtn">Check</button></div>
    </form>`;
    const form = $('#qForm');
    form.addEventListener('change', () => { $('#qErr').hidden = true; });
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      if (answered) { qi++; renderQuiz(); return; }
      const sel = form.querySelector('input[name=qa]:checked');
      if (!sel) { $('#qErr').hidden = false; return; }
      answered = true;
      const pick = +sel.value, ok = pick === q.c;
      if (ok) score++;
      $('.progress', form).textContent = `Question ${qi + 1} of ${D.QUIZ.length} · score ${score}`;
      $$('.opt', form).forEach((o) => { const i = +o.querySelector('input').value; if (i === q.c) o.classList.add('right'); else if (i === pick) o.classList.add('wrong'); o.querySelector('input').disabled = true; });
      const fb = $('#qFb'); fb.hidden = false; fb.className = 'fb ' + (ok ? 'ok' : 'no');
      fb.innerHTML = `<b>${ok ? 'Correct.' : 'Not quite.'}</b> ${q.e}`;
      $('#qBtn').textContent = qi === D.QUIZ.length - 1 ? 'See score' : 'Next question';
    });
  }

  /* ---------- Glossary + tooltips ---------- */
  function renderGlossary() {
    $('#glossList').innerHTML = Object.values(D.GLOSS).sort((a, b) => a[0].localeCompare(b[0])).map(([t, d]) => `<div><dt>${t}</dt><dd>${d}</dd></div>`).join('');
  }
  const tip = $('#tip');
  function showTip(target) {
    const g = D.GLOSS[target.dataset.g]; if (!g) return;
    tip.innerHTML = `<b>${g[0]}</b>${g[1]}`; tip.hidden = false;
    const r = target.getBoundingClientRect(), tw = tip.offsetWidth, th = tip.offsetHeight;
    let x = r.left + window.scrollX + r.width / 2 - tw / 2;
    x = Math.max(window.scrollX + 8, Math.min(x, window.scrollX + document.documentElement.clientWidth - tw - 8));
    let y = r.top + window.scrollY - th - 8; if (r.top < th + 16) y = r.bottom + window.scrollY + 8;
    tip.style.left = x + 'px'; tip.style.top = y + 'px';
  }
  function bindTips(root) {
    $$('dfn[data-g]', root).forEach((d) => {
      if (d._tip) return; d._tip = true; d.tabIndex = 0;
      d.addEventListener('mouseenter', () => showTip(d)); d.addEventListener('focus', () => showTip(d));
      d.addEventListener('mouseleave', () => { tip.hidden = true; }); d.addEventListener('blur', () => { tip.hidden = true; });
    });
  }

  /* ---------- Theme changes redraw SVG charts ---------- */
  const mq = matchMedia('(prefers-color-scheme: light)');
  const redraw = () => { st.refreshTheme(); clockRace._tok = null; renderHR(); renderBinding(); renderNP(); drawStep(rxStep, false); renderEvidence(); if (state.interior) applyInterior(); const MD = window.Modules; MD.Clusters.draw(); MD.Distances.parallax(); MD.Distances.leavitt(); MD.Distances.ladder(); MD.Birth.tracks(); MD.Birth.nebular(+((document.querySelector('[data-neb][aria-pressed=true]') || {}).dataset || {}).neb || 0); MD.Binaries.curves(); MD.Extras.transit(); MD.Extras.spin(); MD.Extras.eqp(); };
  if (mq.addEventListener) mq.addEventListener('change', redraw);
  new MutationObserver(redraw).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

  // r-process dot only animates while its chart is on screen
  renderNP.onScreen = true;
  new IntersectionObserver((e) => { renderNP.onScreen = e[0].isIntersecting; if (renderNP.onScreen && !renderNP.raf && !$('#elements').hidden) renderNP(); }).observe($('#npSvg'));
  // Charts whose coordinate width follows their box: redraw when the box resizes
  const reflow = (fn) => { let raf = 0, last = 0; return (entries) => { const w = Math.round(entries[0].contentRect.width); if (w === last || !w) return; last = w; cancelAnimationFrame(raf); raf = requestAnimationFrame(fn); }; };
  new ResizeObserver(reflow(() => renderHR())).observe(document.querySelector('.hr-box'));
  // mark tables that scroll sideways (CSS fades their right edge as a cue)
  const markScroll = () => $$('.table-wrap').forEach((w) => w.classList.toggle('scrolls', w.scrollWidth > w.clientWidth + 2));
  new ResizeObserver(() => markScroll()).observe(document.body);
  new MutationObserver(() => requestAnimationFrame(markScroll)).observe($('main'), { childList: true, subtree: true });
  new ResizeObserver(reflow(() => { if (state.interior) applyInterior(); })).observe($('#compSvg').parentElement);
  new ResizeObserver(reflow(() => renderBinding())).observe($('#bindSvg').parentElement);
  new ResizeObserver(reflow(() => window.Modules.Distances.ladder())).observe($('#ladderSvg').parentElement);

  /* ---------- Boot ---------- */
  renderBurning(); renderBinding(); renderReaction(); renderNP(); renderEquations(); renderQuiz(); renderGlossary(); renderEvidence();
  bhView = window.BlackHole ? window.BlackHole.init() : null;
  const MOD = window.Modules; MOD.Clusters.init(); MOD.Distances.init(); MOD.Birth.init(); MOD.Binaries.init(); MOD.Extras.init();
  bindTips(document);
  setMass(state.M);
  if (store.get('scale') === 'true') setScaleMode('true');
  const hashTab = (location.hash || '').slice(1);
  const startTab = ['fusion', 'elements', 'spacetime', 'blackhole', 'clusters', 'distances', 'birth', 'binaries', 'equations', 'quiz', 'glossary'].includes(hashTab) ? hashTab : (store.get('tab') || 'fusion');
  showTab(startTab);
})();
