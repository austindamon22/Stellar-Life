# Stellar Life

Interactive astronomy built from real physics. Watch a star live and die, cut it open to see its fusion shells at their true size, fly around a ray-traced black hole, explore the Milky Way in 3D, and rewind the universe to its first minutes.

No build step and no dependencies: plain HTML, CSS and JavaScript (WebGL for the 3D views, with fallbacks).

## Sections

| Section | What's in it |
|---|---|
| **Life of a Star** (`stars/`) | Birth-mass slider and every life path; GPU cutaway with true-scale layers; fusion chains; how gold and platinum are made; H-R diagram; spacetime and time dilation; black hole camera; star clusters; the distance ladder; star birth; novae, supernovae and mergers; calculators; quiz |
| **Galaxies & Cosmology** (`galaxies/`) | The Milky Way in 3D; rotation curve and dark matter; weighing Sgr A*; galaxy types and distances; Hubble's law; quasars and the unified model; galaxy collisions; lookback time; the Big Bang; habitable zones and the Drake equation; quiz |
| Solar System, Tools of Astronomy, Missions & Telescopes | Coming next (see `ROADMAP.md`) |

Sources and model simplifications are listed on the site's [Sources page](sources.html).

## Run it locally

Open `index.html` in a browser.

## Publish with GitHub Pages

Settings → Pages → Deploy from a branch → `main`, folder `/ (root)`. The site appears at `https://<username>.github.io/<repository>/`.

## Layout

```
index.html          home page
sources.html        sources and simplifications
stars/              Life of a Star (index.html + js/)
galaxies/           Galaxies & Cosmology (index.html + js/)
shared/style.css    design tokens, layout, light and dark themes
```

## License

MIT. See `LICENSE`.
