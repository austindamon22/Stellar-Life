# Stellar Life

An interactive study tool for the life of stars, built around OpenStax *Astronomy* (2e) chapters 19–24. Pick a birth mass and the app builds that star's path, shows its interior in a ray-traced 3D cutaway, lets you scrub through the layers of fusion, and traces it on the H-R diagram.

No build step, no dependencies. Plain HTML, CSS and JavaScript. Works offline (fonts fall back to system fonts).

## Features

**The star**
- **Mass slider** (0.08–40 M☉, log scale) with presets, plus a binary-partner toggle for novae, Type Ia supernovae, X-ray binaries and mergers.
- **Life stages** that change with mass, from the shock-triggered cloud to a white dwarf, neutron star, pulsar or black hole.
- **Inside the star.** A scrubber runs from the zero-age main sequence to core collapse. The 3D cutaway and a composition-vs-radius chart update continuously: the hydrogen core turns to helium, burning moves into a shell, helium ignites, the AGB double shells pulse, and massive stars stack shells up to iron. Each layer is coloured by its actual mix of H, He, C, O, Ne, Si and Fe; glowing bands show where fusion is happening.
- **GPU cutaway** (WebGL, with a software fallback). Convective zones boil, radiative zones shimmer outward, fusion zones glow, and the surface shows granulation and limb darkening. Hover or tap the cut face for the layer, its real distance from the centre, composition and how energy moves there. **True scale** redraws every layer at its real size, with a scale bar and Earth / Sun for comparison; zoom up to a million times to find a red giant's Earth-sized core or a supergiant's iron core.
- **Life table** for the selected mass, plus your textbook's Sun table for comparison.
- **H-R diagram** with spectral classes, main-sequence band, instability strip (RR Lyrae, Cepheids), the star's track and a live marker that follows the scrubber.
- **Textbook vs current research** callouts wherever the course notes and recent results differ.

**Topic tabs**
- **Fusion:** step-through p-p chain, CNO cycle and triple-alpha animations; burning table to iron; binding-energy curve.
- **Gold & platinum:** s-process vs r-process on a chart of nuclides with magic-number waiting points.
- **Spacetime:** every object on one shared gravity well in units of its own r_s (log scale), so you see that outside a mass the well is identical and only the surface depth differs. "Same mass, denser and denser" morphs the Sun into a white dwarf, neutron star and black hole. A two-clock demo shows why time only *appears* to stop at the horizon. Evidence panel: Eddington's light bending, Mercury's 43″, gravitational redshift, GPS, LIGO's chirp.
- **Black hole camera:** a real-time ray tracer (WebGL). Every pixel follows a light ray through Schwarzschild spacetime to show the shadow, photon ring, the far side of the disk lensed over the top, Doppler beaming and the ISCO. Fly around it, colour the disk by light path, switch to a lensed grid sky, or blur it to Event Horizon Telescope resolution. Numbers for Cygnus X-1, Sgr A* and M87*.
- **Clusters:** a 4,000-star cluster ages on the H-R diagram; turnoff mass, giants, white dwarfs, blue stragglers; Pleiades, M67, Omega Centauri presets.
- **Distances:** radar, parallax (with real stars), Cepheid / RR Lyrae / Type Ia calculator following the textbook's four steps, Leavitt law, distance ladder.
- **Star birth:** ISM types, interactive dust extinction and reddening, pre-main-sequence tracks, the nebular hypothesis in five steps.
- **Binaries & bursts:** feed a white dwarf (novae vs Type Ia), light curves, X-ray binaries, gamma-ray bursts.
- **Equations:** 15 live calculators. **Quiz:** 34 questions on chapters 19–24. **Glossary** with hover definitions.

## Run it

Open `index.html` in a browser.

## Put it on GitHub Pages

1. Create a new repository on GitHub, e.g. `stellar-life`.
2. Upload every file in this folder (keep the `css/` and `js/` folders), or:
   ```bash
   git init
   git add .
   git commit -m "Stellar Life"
   git branch -M main
   git remote add origin https://github.com/YOUR-USERNAME/stellar-life.git
   git push -u origin main
   ```
3. On GitHub: **Settings → Pages → Build and deployment → Source: Deploy from a branch**, branch `main`, folder `/ (root)`. Save.
4. After a minute the site is live at `https://YOUR-USERNAME.github.io/stellar-life/`.

## Files

```
index.html         page structure
css/style.css      design tokens, layout, light and dark themes
js/physics.js      constants and every equation / scaling relation
js/data.js         element colours, stage text, reactions, quiz, glossary
js/evolution.js    continuous interior model (composition and burning vs radius)
js/cutaway-gl.js   GPU star cutaway (true scale, convection, glow)
js/render3d.js     stage viewer: cutaway fallback, particle scenes
js/spacetime.js    shared gravity well and the falling-clock demo
js/relativity.js   evidence for general relativity
js/blackhole.js    WebGL black hole ray tracer
js/modules.js      clusters, distances, star birth, binaries
js/app.js          UI wiring
```

## Physics and sources

Constants: CODATA 2018 (G, c, σ, k_B) and IAU 2015 nominal solar values (M☉ = 1.98847 × 10³⁰ kg, R☉ = 6.957 × 10⁸ m, L☉ = 3.828 × 10²⁶ W, T☉ = 5772 K).

| Topic | Source / relation |
|---|---|
| Course content, Sun stage table, cluster table | OpenStax *Astronomy* 2e, ch. 19–24 (course notes) |
| Main-sequence lifetimes above 1 M☉ | Interpolated from Schaller et al. (1992) grids |
| White dwarf initial–final mass | Kalirai et al. (2008) |
| White dwarf radius | Nauenberg (1972) |
| AGB luminosity | Paczyński (1970), floored at the textbook Sun value |
| Advanced burning timescales (25 M☉) | Woosley, Heger & Weaver (2002) |
| Reaction Q-values, binding energies | Standard nuclear data / AME |
| True-scale interiors | Sun: core ~0.25 R, convection zone base 0.713 R (standard solar model). Red giant degenerate He core ~0.03 R☉; AGB C/O core ~0.02 R☉; presupernova onion (Fe ~0.004 R☉ ≈ 3000 km, Si 0.012, O 0.05, Ne 0.1, C 0.3, He core ~1.2 R☉) approx. from Woosley, Heger & Weaver (2002). Order-of-magnitude values |
| Spacetime | Schwarzschild exterior, uniform-density interior; radial free fall (cycloid in proper time) |
| Light bending, Mercury | α = 4GM/(c²b); Δφ = 6πGM/(c²a(1−e²)) |
| LIGO chirp | Leading-order f(τ) = (1/π)(5/256τ)^{3/8}(GM_c/c³)^{−5/8}, M_c ≈ 30 M☉ |
| Cepheid law | M_V = −2.43(log P − 1) − 4.05 (Benedict et al. 2007) |
| White dwarf cooling (clusters) | Mestel law, L ∝ t^{−1.4} |
| Black hole camera | Null geodesics from u'' + u = (3/2)u² (exact Schwarzschild); shadow b = (3√3/2) r_s; thin disk T ∝ r^(−3/4)(1 − √(r_in/r))^(1/4) (Shakura & Sunyaev 1973); g = √(1 − 1.5 r_s/r)/(1 − ΩL); I ∝ g⁴. Sgr A* 4.3 × 10⁶ M☉ at 8.18 kpc, M87* 6.5 × 10⁹ M☉ at 16.8 Mpc (EHT), Cygnus X-1 21.2 M☉ at 2.22 kpc (Miller-Jones et al. 2021) |
| Kilonova / r-process | GW170817 / AT2017gfo |

## Simplifications

- **Mass cutoffs are approximate** (~0.5, ~1.3, ~2, ~8, ~25 M☉) and depend on metallicity, rotation, mass loss and binarity.
- **Interior structures are schematic.** Compositions follow the textbook picture, not a stellar-evolution code. The default view stretches layers so all are visible; True scale uses approximate real layer sizes (order of magnitude, see table) and stretches each layer linearly inside its true boundaries.
- **H-R tracks** come from scaling relations shaped to match published tracks.
- **Interior time dilation** assumes uniform density.
- **The falling-clock "far view"** uses Schwarzschild coordinate time and ignores light-travel delay.
- **Clusters** use solar composition; real globular clusters are metal-poor and have bluer horizontal branches.
- **The black hole camera** shows a non-spinning hole with a thin disk and maps disk temperature to visible colours. Real holes spin, and the EHT sees radio light from hot, thick gas.
- **The white-dwarf feeding demo** is schematic; whether novae let white dwarfs grow is still debated.

## Quality review log

The app was scored by independent reviewers (1–10 in physics accuracy, course alignment, teaching, visual quality, interaction, performance). The goal is three consecutive reviews scoring at least 8 in every category; every issue a reviewer raises is fixed before the next round, even on a pass.

| Round | Physics | Course | Teaching | Visual | Interaction | Performance | Result |
|---|---|---|---|---|---|---|---|
| 1 | 7 | 7 | 8 | 6 | 7 | 7 | fail — 22 issues fixed |
| 2 | 8 | 9 | 8 | 8 | 8 | 9 | pass — 17 issues fixed |
| 3 | 9 | 9 | 8 | 8 | 9 | 9 | pass — 12 issues fixed |
| 4 | 9 | 9 | 9 | 6 | 5 | 8 | fail (tabs all visible) — 14 issues fixed, count reset |
| 5 | 8 | 8 | 9 | 8 | 9 | 9 | pass — 12 issues fixed |
| 6, 7 | | | | | | | pending |


## License

MIT. See `LICENSE`.
