// Power of the planned within-subject study by Monte Carlo (paired t-test, two-sided alpha 0.05).
// H1: adaptive vs fixed (each participant contributes the mean of their adaptive and fixed cells).
// H2: interaction = (fixed - adaptive in noise) - (fixed - adaptive in quiet), also a paired contrast.
// Effect sizes are dz = mean difference / SD of the differences. Usage: node sim/power.mjs [--md out.md]
import { writeFileSync } from "node:fs";

function rng(seed) { return () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const gauss = (r) => Math.sqrt(-2 * Math.log(r() + 1e-12)) * Math.cos(2 * Math.PI * r());
// two-sided critical t (df) by bisection on the t CDF computed with a simple series via incomplete beta
function tCdf(t, df) {
  const x = df / (df + t * t);
  const ib = incBeta(x, df / 2, 0.5);
  return t > 0 ? 1 - 0.5 * ib : 0.5 * ib;
}
function incBeta(x, a, b) {          // regularized incomplete beta, continued fraction (Numerical Recipes)
  if (x <= 0) return 0; if (x >= 1) return 1;
  const lbeta = lgamma(a + b) - lgamma(a) - lgamma(b);
  const front = Math.exp(Math.log(x) * a + Math.log(1 - x) * b + lbeta);
  if (x < (a + 1) / (a + b + 2)) return front * cf(x, a, b) / a;
  return 1 - front * cf(1 - x, b, a) / b;
}
function cf(x, a, b) {
  let c = 1, d = 1 - (a + b) * x / (a + 1); d = 1 / (Math.abs(d) < 1e-30 ? 1e-30 : d); let h = d;
  for (let m = 1; m < 200; m++) {
    const m2 = 2 * m; let aa = m * (b - m) * x / ((a + m2 - 1) * (a + m2));
    d = 1 + aa * d; d = 1 / (Math.abs(d) < 1e-30 ? 1e-30 : d); c = 1 + aa / c; h *= d * c;
    aa = -(a + m) * (a + b + m) * x / ((a + m2) * (a + m2 + 1));
    d = 1 + aa * d; d = 1 / (Math.abs(d) < 1e-30 ? 1e-30 : d); c = 1 + aa / c; const del = d * c; h *= del;
    if (Math.abs(del - 1) < 1e-10) break;
  }
  return h;
}
function lgamma(z) { const g = 7, p = [0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313, -176.61502916214059, 12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7];
  if (z < 0.5) return Math.log(Math.PI / Math.sin(Math.PI * z)) - lgamma(1 - z); z -= 1; let x = p[0]; for (let i = 1; i < g + 2; i++) x += p[i] / (z + i);
  const t = z + g + 0.5; return 0.5 * Math.log(2 * Math.PI) + (z + 0.5) * Math.log(t) - t + Math.log(x); }
function tCrit(df) { let lo = 0, hi = 10; for (let i = 0; i < 60; i++) { const m = (lo + hi) / 2; if (1 - tCdf(m, df) > 0.025) lo = m; else hi = m; } return lo; }

function power(n, dz, reps = 20000, seed = 1) {
  const r = rng(seed), tc = tCrit(n - 1); let hits = 0;
  for (let k = 0; k < reps; k++) {
    let s = 0, ss = 0;
    for (let i = 0; i < n; i++) { const d = dz + gauss(r); s += d; ss += d * d; }
    const m = s / n, sd = Math.sqrt((ss - n * m * m) / (n - 1));
    if (Math.abs(m / (sd / Math.sqrt(n))) > tc) hits++;
  }
  return hits / reps;
}
function nFor(dz, target = 0.8) { for (let n = 6; n < 400; n++) if (power(n, dz, 4000, n) >= target) return n; return null; }

const rows = [];
for (const dz of [0.3, 0.4, 0.5, 0.6, 0.8]) rows.push({ dz, power24: power(24, dz), n80: nFor(dz) });
let mdz = 0; for (let dz = 0.3; dz < 1.2; dz += 0.01) if (power(24, dz, 6000, 3) >= 0.8) { mdz = dz; break; }
console.table(rows.map((r) => ({ dz: r.dz, "power at n=24": r.power24.toFixed(2), "n for 80%": r.n80 })));
console.log(`Minimum detectable effect at n=24 (80% power): dz ≈ ${mdz.toFixed(2)}`);

const mi = process.argv.indexOf("--md");
if (mi > 0) writeFileSync(process.argv[mi + 1], [
  "# Power of the planned study", "",
  "Paired t-test, two-sided α = 0.05, Monte Carlo (20,000 runs per cell). dz = mean within-person difference / SD of the differences.",
  "H1 (adaptive vs fixed) and H2 (the noise × system interaction, as a difference of differences) are both paired contrasts, so the same table applies; the interaction effect is usually smaller than the main effect.", "",
  "| dz | Power at n = 24 | n for 80% power |", "|---|---|---|",
  ...rows.map((r) => `| ${r.dz} | ${r.power24.toFixed(2)} | ${r.n80} |`), "",
  `Minimum detectable effect at n = 24 with 80% power: **dz ≈ ${mdz.toFixed(2)}** (a medium-to-large effect).`, "",
  "Implication: n = 24 can detect H1 only if the effect is at least medium; H2 needs a larger sample or should be reported as exploratory with an effect size and confidence interval."].join("\n") + "\n");
