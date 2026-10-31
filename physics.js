/* Stellar Life — physics.js
 * Every equation and scaling relation used by the app lives here.
 * Constants: CODATA 2018 and IAU 2015 nominal solar values.
 * Scaling relations are standard approximations; see README "Simplifications".
 */
(function (global) {
  'use strict';

  const K = {
    G: 6.67430e-11,          // m^3 kg^-1 s^-2
    c: 2.99792458e8,         // m/s
    sigma: 5.670374419e-8,   // W m^-2 K^-4
    kB: 1.380649e-23,        // J/K
    mH: 1.6735575e-27,       // kg, hydrogen atom
    u: 1.66053906660e-27,    // kg, atomic mass unit
    MeV: 1.602176634e-13,    // J
    wien: 2.897771955e-3,    // m K
    Msun: 1.98847e30,        // kg
    Rsun: 6.957e8,           // m (IAU nominal)
    Lsun: 3.828e26,          // W (IAU nominal)
    Tsun: 5772,              // K (IAU nominal)
    Mearth: 5.9722e24,
    Rearth: 6.371e6,
    yr: 3.15576e7,           // s (Julian year)
  };

  // Approximate mass thresholds (solar masses). Real values depend on
  // metallicity, rotation and mass loss.
  const LIMITS = {
    brownDwarf: 0.08,     // below this: no sustained hydrogen fusion
    fullyConvective: 0.35,// below this: whole star convects
    redDwarfFate: 0.5,    // below this: no helium ignition, He white dwarf
    cno: 1.3,             // above this: CNO cycle dominates core fusion
    heliumFlash: 2.0,     // below this: degenerate core, helium flash
    supernova: 8,         // above this: core collapse
    blackHole: 25,        // above this: black hole (very approximate)
    chandrasekhar: 1.4,   // white dwarf maximum mass
    tov: 2.2,             // neutron star maximum mass (~2.0-2.3, uncertain)
  };

  const log10 = Math.log10;
  const clamp = (x, a, b) => Math.min(b, Math.max(a, x));

  /* ---------- Main sequence relations ---------- */

  // Piecewise mass-luminosity relation (L/Lsun) for main-sequence stars.
  function msLuminosity(M) {
    if (M < 0.43) return 0.23 * Math.pow(M, 2.3);
    if (M < 2) return Math.pow(M, 4);
    if (M < 55) return 1.4 * Math.pow(M, 3.5);
    return 32000 * M;
  }

  // Mass-radius relation (R/Rsun) for main-sequence stars.
  function msRadius(M) {
    return M < 1 ? Math.pow(M, 0.8) : Math.pow(M, 0.57);
  }

  // Stefan-Boltzmann solved for temperature, in solar units.
  function tempFromLR(L, R) {
    return K.Tsun * Math.pow(L / (R * R), 0.25);
  }

  function zams(M) {
    const L = msLuminosity(M);
    const R = msRadius(M);
    return { L, R, T: tempFromLR(L, R) };
  }

  // Hydrogen-burning lifetime in years.
  // Above 1 Msun: log-log interpolation of approximate model-grid values
  // (after Schaller et al. 1992, solar metallicity). Below 1 Msun the simple
  // scaling t = 1e10 yr * M^-2.5 is used.
  const LIFETIME_TABLE = [
    [1, 1.0e10], [1.5, 2.7e9], [2, 1.16e9], [3, 3.5e8], [5, 9.4e7],
    [7, 4.3e7], [9, 2.6e7], [12, 1.6e7], [15, 1.16e7], [20, 8.1e6],
    [25, 6.4e6], [40, 4.3e6], [60, 3.5e6], [120, 2.6e6],
  ];
  function msLifetime(M) {
    // Fully convective red dwarfs burn nearly all their hydrogen (Laughlin et al. 1997:
    // ~10^12 yr at 0.25 Msun, ~6 x 10^12 yr at 0.1 Msun). Blend into the M^-2.5 rule by 0.45 Msun.
    if (M < 0.45) {
      const rd = 1e12 * Math.pow(M / 0.25, -1.96), rule = 1e10 * Math.pow(M, -2.5);
      const f = clamp((M - 0.3) / 0.15, 0, 1);
      return Math.pow(10, log10(rd) * (1 - f) + log10(rule) * f);
    }
    if (M <= 1) return 1e10 * Math.pow(M, -2.5);
    const T = LIFETIME_TABLE;
    for (let i = 0; i < T.length - 1; i++) {
      const [m0, t0] = T[i], [m1, t1] = T[i + 1];
      if (M <= m1) {
        const f = (log10(M) - log10(m0)) / (log10(m1) - log10(m0));
        return Math.pow(10, log10(t0) + f * (log10(t1) - log10(t0)));
      }
    }
    return T[T.length - 1][1];
  }
  const simpleLifetime = (M) => 1e10 * Math.pow(M, -2.5);
  // Pre-main-sequence contraction time (yr), interpolated from Palla & Stahler-type values.
  const PMS = [[0.5, 1e8], [1, 4e7], [3, 2e6], [15, 1e5], [40, 3e4]];
  function preMSTime(M) {
    if (M <= PMS[0][0]) return PMS[0][1] * Math.pow(M / PMS[0][0], -1.3);
    for (let i = 0; i < PMS.length - 1; i++) {
      const [m0, t0] = PMS[i], [m1, t1] = PMS[i + 1];
      if (M <= m1) { const f = (log10(M) - log10(m0)) / (log10(m1) - log10(m0)); return Math.pow(10, log10(t0) + f * (log10(t1) - log10(t0))); }
    }
    return PMS[PMS.length - 1][1];
  }

  /* ---------- Remnants ---------- */

  // Initial-final mass relation for white dwarfs (Kalirai et al. 2008).
  function whiteDwarfMass(M) {
    if (M < LIMITS.redDwarfFate) return M * 0.95; // hypothetical He white dwarf
    return clamp(0.109 * M + 0.394, 0.5, 1.38);
  }
  // White dwarf radius (Rsun), Nauenberg 1972 approximation.
  function whiteDwarfRadius(Mwd) {
    const x = Math.min(Mwd, 1.43) / 1.44;
    return 0.0112 * Math.sqrt(Math.pow(x, -2 / 3) - Math.pow(x, 2 / 3));
  }
  const NS_MASS = 1.4, NS_RADIUS_KM = 12;
  // Very rough black hole mass from a single star (Msun).
  const blackHoleMass = (M) => clamp(0.25 * M, 5, 20);

  function remnantOf(M) {
    if (M < LIMITS.redDwarfFate) return { type: 'hewd', mass: whiteDwarfMass(M) };
    if (M < LIMITS.supernova) return { type: 'wd', mass: whiteDwarfMass(M) };
    if (M < LIMITS.blackHole) return { type: 'ns', mass: NS_MASS };
    return { type: 'bh', mass: blackHoleMass(M) };
  }

  /* ---------- Fundamental equations ---------- */

  const luminositySB = (R_m, T) => 4 * Math.PI * R_m * R_m * K.sigma * Math.pow(T, 4);
  const wienPeak = (T) => K.wien / T;                     // m
  const escapeVelocity = (M_kg, R_m) => Math.sqrt(2 * K.G * M_kg / R_m);
  const surfaceGravity = (M_kg, R_m) => K.G * M_kg / (R_m * R_m);
  const schwarzschildRadius = (M_kg) => 2 * K.G * M_kg / (K.c * K.c);

  // Gravitational time dilation, dtau/dt, outside a non-rotating mass.
  function dilationOutside(r, rs) {
    return r <= rs ? 0 : Math.sqrt(1 - rs / r);
  }
  // Inside a uniform-density star (Schwarzschild interior solution).
  function dilationInside(r, R, rs) {
    return 1.5 * Math.sqrt(1 - rs / R) - 0.5 * Math.sqrt(1 - rs * r * r / (R * R * R));
  }
  function dilationAt(r, R, rs) {
    return r >= R ? dilationOutside(r, rs) : dilationInside(r, R, rs);
  }

  // Embedding-diagram height z(r) of the spatial slice (Flamm's paraboloid
  // outside; uniform-density interior inside). Returns depth below the
  // value at rMax, sampled at n+1 points from rMin to rMax.
  function embeddingProfile(R, rs, rMin, rMax, n) {
    const slope = (r) => {
      const g = r >= R ? 1 - rs / r : 1 - rs * r * r / (R * R * R);
      return g <= 1e-9 ? 1e4 : Math.sqrt(Math.max(0, 1 / g - 1));
    };
    const rArr = [], zArr = [0];
    for (let i = 0; i <= n; i++) rArr.push(rMin + (rMax - rMin) * i / n);
    for (let i = 1; i <= n; i++) {
      const a = rArr[i - 1], b = rArr[i], m = (a + b) / 2;
      // Simpson's rule per segment
      const dz = (b - a) / 6 * (slope(a + 1e-12) + 4 * slope(m) + slope(b));
      zArr.push(zArr[i - 1] + dz);
    }
    const zTop = zArr[n];
    return rArr.map((r, i) => ({ r, depth: zTop - zArr[i] }));
  }

  // Jeans mass (kg) for temperature T (K) and number density n (per cm^3).
  function jeansMass(T, n_cm3, mu = 2.33) {
    const rho = n_cm3 * 1e6 * mu * K.mH;
    const a = Math.pow(5 * K.kB * T / (K.G * mu * K.mH), 1.5);
    const b = Math.sqrt(3 / (4 * Math.PI * rho));
    return a * b;
  }
  function freeFallTime(n_cm3, mu = 2.33) {
    const rho = n_cm3 * 1e6 * mu * K.mH;
    return Math.sqrt(3 * Math.PI / (32 * K.G * rho)); // s
  }
  // Kelvin-Helmholtz timescale (s): t = G M^2 / (R L)
  const kelvinHelmholtz = (M_kg, R_m, L_W) => K.G * M_kg * M_kg / (R_m * L_W);
  // Virial order-of-magnitude core temperature: T ~ G M mu mH / (k R)
  const virialCoreTemp = (M_kg, R_m, mu = 0.6) => K.G * M_kg * mu * K.mH / (K.kB * R_m);
  // Order-of-magnitude central pressure: P ~ G M^2 / R^4
  const centralPressureEstimate = (M_kg, R_m) => K.G * M_kg * M_kg / Math.pow(R_m, 4);

  // Energy from fusing 4 hydrogen atoms into helium-4 (atomic masses,
  // includes positron annihilation). Returns MeV and mass fraction.
  function ppEnergy() {
    const mH = 1.00782503207, mHe = 4.00260325413;
    const dm = 4 * mH - mHe;
    return { MeV: dm * 931.49410242, fraction: dm / (4 * mH) };
  }

  // Spin-up from conservation of angular momentum for a uniform sphere
  // shrinking from R1 to R2: P2 = P1 (R2/R1)^2.
  const spinUpPeriod = (P1, R1, R2) => P1 * Math.pow(R2 / R1, 2);

  /* ---------- H-R diagram positions (schematic tracks) ---------- */

  // Instability strip edges in log T as a function of log L (approximate).
  const stripBlue = (lL) => 3.87 - 0.045 * (lL - 1.5);
  const stripRed = (lL) => 3.78 - 0.045 * (lL - 1.5);

  function agbLuminosity(M) {
    // Core-mass luminosity relation (Paczynski 1970), floor for low masses.
    // Paczyński (1970) core-mass–luminosity relation L = 59,250 (Mc − 0.522), using the final white-dwarf mass as the
    // core mass at the AGB tip (an approximation); floored at the Sun's AGB-tip luminosity (~5,200 L☉).
    return clamp(59250 * (whiteDwarfMass(M) - 0.522), 5200, 5e4);
  }

  // Returns {logT, logL, off?} or null if the object is not on the diagram.
  function hrPosition(stageId, M) {
    const z = zams(M);
    const lT = log10(z.T), lL = log10(z.L);
    const P = (T, L, extra) => Object.assign({ logT: log10(T), logL: log10(L) }, extra || {});
    const pt = (logT, logL, extra) => Object.assign({ logT, logL }, extra || {});
    switch (stageId) {
      case 'protostar':
        return M < 2 ? P(Math.min(z.T * 0.85, 4200), z.L * 4) : pt(lT - 0.12, lL - 0.1);
      // ZAMS ~0.7 of the mid-main-sequence luminosity (the young Sun was ~0.7 L☉),
      // so the Sun passes (5,772 K, 1 L☉) about 46% of the way through.
      case 'zams': return P(z.T * Math.pow(0.7 / 0.79, 0.25), z.L * 0.7);
      case 'ms': { const f = clamp((M - 1) / 1.5, 0, 1); return pt(lT + 0.017 * (1 - f) - 0.07 * f, lL + 0.182 * (1 - f) + 0.2 * f); }
      case 'rd_far': return P(Math.min(8000, z.T * 2.4), z.L * 3);
      case 'subgiant':
        return M < LIMITS.heliumFlash ? P(5000, z.L * 2.8) : pt((lT + log10(4500)) / 2, lL + 0.3);
      case 'rgb':
        return M < LIMITS.heliumFlash ? P(3100, 2300) : P(4100, z.L * 4); // commonly quoted RGB tip: 3,100 K, 2,300 L☉ (→ ~165 R☉)
      case 'heflash': return P(3100, 2300);
      case 'hb': return P(4800, 50);
      case 'blueloop': {
        const L = lL + 0.75;
        return M >= 4 ? pt((stripBlue(L) + stripRed(L)) / 2, L) : pt(log10(5000), lL + 0.5);
      }
      case 'agb': return P(3100, agbLuminosity(M));
      case 'pn': return pt(5.0, log10(agbLuminosity(M)) - 0.1);
      case 'wd': case 'nova': {
        const m = whiteDwarfMass(M), R = whiteDwarfRadius(m), T = 25000;
        return P(T, R * R * Math.pow(T / K.Tsun, 4));
      }
      case 'hewd': {
        const m = whiteDwarfMass(M), R = whiteDwarfRadius(m), T = 10000;
        return P(T, R * R * Math.pow(T / K.Tsun, 4));
      }
      case 'rsg': case 'onion': case 'corecollapse': case 'sn2': {
        // red supergiant up to ~30 Msun; blue supergiant / Wolf-Rayet by ~40 Msun (strong winds)
        const f = clamp((M - 25) / 15, 0, 1);
        const lt = log10(3600) + f * (log10(25000) - log10(3600));
        return stageId === 'sn2' ? pt(lt, 9, { off: true }) : pt(lt, lL + log10(1.4) - f * 0.05);
      }
      default: return null;
    }
  }

  // Approximate blackbody colour (sRGB) for a temperature.
  // Based on Tanner Helland's fit to the CIE blackbody locus.
  function blackbodyRGB(T) {
    const t = clamp(T, 1000, 40000) / 100;
    let r, g, b;
    if (t <= 66) { r = 255; g = 99.4708025861 * Math.log(t) - 161.1195681661; }
    else { r = 329.698727446 * Math.pow(t - 60, -0.1332047592); g = 288.1221695283 * Math.pow(t - 60, -0.0755148492); }
    if (t >= 66) b = 255; else if (t <= 19) b = 0; else b = 138.5177312231 * Math.log(t - 10) - 305.0447927307;
    return [clamp(r, 0, 255) | 0, clamp(g, 0, 255) | 0, clamp(b, 0, 255) | 0];
  }

  global.Phys = {
    K, LIMITS, clamp, zams, msLuminosity, msRadius, tempFromLR, msLifetime, simpleLifetime, preMSTime,
    whiteDwarfMass, whiteDwarfRadius, NS_MASS, NS_RADIUS_KM, blackHoleMass, remnantOf,
    luminositySB, wienPeak, escapeVelocity, surfaceGravity, schwarzschildRadius,
    dilationOutside, dilationInside, dilationAt, embeddingProfile,
    jeansMass, freeFallTime, kelvinHelmholtz, virialCoreTemp, centralPressureEstimate,
    ppEnergy, spinUpPeriod, hrPosition, stripBlue, stripRed, agbLuminosity, blackbodyRGB,
  };
})(window);
