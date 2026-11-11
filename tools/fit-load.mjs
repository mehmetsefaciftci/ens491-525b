// Fit the behavioural load weights on pilot data and report participant-independent accuracy.
// Samples: (1) calibration (?calib=1): 0-back = 0, 2-back = 1; (2) artworks: load features at the
// end of each artwork, labelled 1 if that block's NASA-TLX mental demand is at or above the
// participant's own median (within-person high/low). Usage:
//   node tools/fit-load.mjs <study files or folder>
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { FEATURES, fitLogistic, leaveOneSubjectOut } from "../src/fit.js";

const files = process.argv.slice(2).flatMap((p) => statSync(p).isDirectory() ? readdirSync(p).filter((f) => f.endsWith(".json")).map((f) => join(p, f)) : [p]);
const calib = [], art = [];
for (const f of files) {
  const j = JSON.parse(readFileSync(f, "utf8")); if (j.kind !== "ca-guide-study-session") continue;
  const P = `P${j.study.participant.number}`;
  for (const c of j.study.calibration || []) calib.push({ participant: P, y: c.label, x: FEATURES.map((k) => c.features[k] ?? 0), nback: c.nback, paas: c.paas, cond: c.condition });
  const tlx = j.study.blocks.map((b) => b.tlx_mental_demand).filter((v) => v != null).sort((a, b) => a - b);
  const med = tlx.length ? tlx[Math.floor((tlx.length - 1) / 2)] : null;
  for (const b of j.study.blocks) for (const a of b.artworks)
    if (a.load_features && med != null) art.push({ participant: P, y: b.tlx_mental_demand > med ? 1 : 0, x: FEATURES.map((k) => a.load_features[k] ?? 0) });
}
const fmt = (r) => `${r.n} samples, ${r.participants} participants, balanced accuracy ${r.balanced_accuracy?.toFixed(2) ?? "–"}, AUC ${r.auc?.toFixed(2) ?? "–"}`;
console.log(`Calibration samples: ${calib.length}; artwork samples: ${art.length}`);
if (calib.length) {
  const by = (c) => calib.filter((s) => s.cond === c);
  for (const c of ["0-back", "2-back"]) { const g = by(c); if (g.length) console.log(`  ${c}: n-back hit rate ${(g.reduce((s, x) => s + x.nback.hits / Math.max(1, x.nback.targets), 0) / g.length).toFixed(2)}, mean Paas ${(g.reduce((s, x) => s + x.paas, 0) / g.length).toFixed(1)} (manipulation check)`); }
  console.log(`LOSO on calibration: ${fmt(leaveOneSubjectOut(calib))}`);
}
if (art.length) console.log(`LOSO on artworks (TLX above own median): ${fmt(leaveOneSubjectOut(art))}`);
const all = [...calib, ...art];
if (new Set(all.map((s) => s.y)).size === 2) {
  const m = fitLogistic(all.map((s) => s.x), all.map((s) => s.y));
  const W = { pace: "W_PACE", replay: "W_REPLAY", stepdown: "W_STEPDOWN", hesitate: "W_HESITATE", walking: "W_WALK", noise_audio: "W_NOISE_AUDIO" };
  console.log("\nFitted weights for LOAD_DEFAULTS in src/load.js (use only if LOSO accuracy is clearly above 0.5):");
  console.log(JSON.stringify({ B0: +m.b.toFixed(3), ...Object.fromEntries(FEATURES.map((k, i) => [W[k], +m.w[i].toFixed(3)])) }, null, 1));
} else console.log("Not enough labelled data of both classes to fit.");
