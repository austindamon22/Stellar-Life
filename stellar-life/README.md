# Stellar Life

An interactive walkthrough of a star's life, from a cold molecular cloud to a white dwarf, neutron star or black hole. Pick a birth mass and the app builds that star's path, shows it in a 3D cutaway, and traces it on the H-R diagram.

No build step, no dependencies. Plain HTML, CSS and JavaScript. It works offline (fonts fall back to system fonts).

## Features

- **Mass slider** (0.08–40 M☉, log scale) with presets, plus a binary-partner toggle that unlocks novae, Type Ia supernovae, X-ray binaries and mergers.
- **Life stages** that change with mass: cloud and shock trigger, collapse and fragmentation, protostar and disk (nebular hypothesis), ZAMS, main sequence, subgiant, red giant, helium flash, horizontal branch / blue loop, AGB, planetary nebula, white dwarf, supergiant, onion shells to iron, core collapse, Type II supernova, neutron star, pulsar, black hole.
- **3D cutaway** ray-traced in the browser: a star with one octant removed so the nested layers show, colour-coded by element, with fusing layers glowing. Drag to rotate.
- **Particle scenes** for clouds, collapse, disks, nebulae, supernovae, binaries and mergers; a black hole view that lenses background stars with the point-mass lens equation.
- **H-R diagram** with spectral classes, main-sequence band, instability strip (RR Lyrae, Cepheids) and the selected star's track. Click a point to jump to that stage.
- **Fusion**: step-through animations of the p-p chain, CNO cycle and triple-alpha process, a burning table up to iron, and the binding-energy curve.
- **Gold and platinum**: s-process vs r-process on a chart of nuclides, with magic-number waiting points and decay back to stability.
- **Spacetime**: an embedding diagram (Flamm's paraboloid) for Earth, the Sun, your star, a white dwarf, a neutron star and a black hole, coloured by the rate of proper time, with a movable probe clock.
- **Live equations**: Schwarzschild radius, time dilation, Stefan–Boltzmann, Wien, lifetimes, mass–luminosity, Jeans mass, E = mc², escape velocity, hydrostatic estimates, spin-up, white dwarf mass–radius, Kelvin–Helmholtz, photon sphere/ISCO, inverse-square law.
- **Quiz** (15 questions) and a glossary with hover definitions.

## Run it

Open `index.html` in a browser. That's it.

## Put it on GitHub Pages

1. Create a new repository on GitHub, e.g. `stellar-life`.
2. Upload every file in this folder (keep the `css/` and `js/` folders), or from a terminal:
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
index.html        page structure
css/style.css     design tokens, layout, light and dark themes
js/physics.js     constants and every equation / scaling relation
js/data.js        element colours, stage definitions, reactions, quiz, glossary
js/render3d.js    3D cutaway ray tracer and particle scenes
js/spacetime.js   embedding diagram and proper-time colouring
js/app.js         UI wiring
```

## Physics and sources

Constants are CODATA 2018 (G, c, σ, k_B) and IAU 2015 nominal solar values (M☉ = 1.98847 × 10³⁰ kg, R☉ = 6.957 × 10⁸ m, L☉ = 3.828 × 10²⁶ W, T☉ = 5772 K).

| Topic | Source / relation |
|---|---|
| Main-sequence lifetimes above 1 M☉ | Interpolated from Schaller et al. (1992) solar-metallicity grids |
| Lifetimes below 1 M☉ | t ≈ 10¹⁰ yr × M^−2.5 |
| Mass–luminosity, mass–radius | Standard piecewise textbook relations |
| White dwarf initial–final mass | Kalirai et al. (2008): M_wd = 0.109 M + 0.394 |
| White dwarf radius | Nauenberg (1972) approximation |
| AGB luminosity | Paczyński (1970) core-mass–luminosity relation |
| Advanced burning (25 M☉) | Woosley, Heger & Weaver (2002), Rev. Mod. Phys. 74, 1015 |
| Reaction Q-values | Standard nuclear data (p-p total 26.73 MeV, triple-alpha 7.275 MeV) |
| Binding energies | AME atomic mass evaluation values |
| Spacetime | Schwarzschild exterior; uniform-density Schwarzschild interior |
| Black hole lensing | Point-mass lens equation θ = ½(β ± √(β² + 4θ_E²)) |
| Kilonova / r-process | GW170817 / AT2017gfo observations |
| Blackbody colours | Tanner Helland fit to the blackbody locus |

## Simplifications

Read these before quoting numbers from the app on an exam.

- **Mass cutoffs are approximate.** ~0.5 M☉ (helium ignition), ~1.3 M☉ (p-p vs CNO), ~2 M☉ (helium flash), ~8 M☉ (supernova), ~25 M☉ (black hole). Real values depend on metallicity, rotation, mass loss and binarity, and which stars make black holes is still an active research question.
- **H-R tracks are schematic.** Stage positions come from scaling relations shaped to match published tracks, not from a stellar-evolution code.
- **Stage durations after the main sequence** are fractions of the main-sequence lifetime calibrated to a solar model, and to a 25 M☉ model for advanced burning.
- **Cutaway layers are not to scale.** Real giant cores are a tiny fraction of the radius; the legend gives true sizes.
- **Interior time dilation** uses a uniform-density star. Real stars are centrally concentrated.
- **The embedding diagram shows spatial curvature only.** For everyday gravity, time dilation matters more; that's what the colour shows.
- **Black hole remnant masses** are rough (~25% of birth mass, capped at 5–20 M☉).

## License

MIT. See `LICENSE`.
