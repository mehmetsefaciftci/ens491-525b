// Empirical Bayes population prior from pilot study files.
// Uses each participant's practice-artwork pick (asked anyway for the fixed comparison arm) to
// estimate how common "detailed" and "audio" are in this population, and writes a prior with
// STRENGTH pseudo-counts to content/population-prior.json. The adaptive arm then starts from the
// population tendency instead of a neutral 50/50, without using the visitor's own answer.
// Usage: node tools/population-prior.mjs <study files or folder> [--strength 4]
import { readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const args = process.argv.slice(2);
const si = args.indexOf("--strength"); const STRENGTH = si >= 0 ? +args.splice(si, 2)[1] : 4;
const files = args.flatMap((p) => statSync(p).isDirectory() ? readdirSync(p).filter((f) => f.endsWith(".json")).map((f) => join(p, f)) : [p]);
let n = 0, det = 0, nm = 0, aud = 0;
for (const f of files) {
  const j = JSON.parse(readFileSync(f, "utf8")); if (j.kind !== "ca-guide-study-session") continue;
  if (j.events?.some((e) => e.e === "nocam_mode")) continue;           // simulated test sessions are not pilot data
  const p = j.study.participant; if (!p?.format_preference) continue;
  n++; if (p.format_preference.startsWith("detailed")) det++;
  if (!p.accessibility?.length) { nm++; if (p.format_preference.endsWith("audio")) aud++; }
}
if (!n) { console.log("No real (camera) pilot sessions found; no prior written."); process.exit(0); }
const pd = (det + 1) / (n + 2), pa = (aud + 1) / (nm + 2);            // Laplace smoothing
const prior = { _note: `Population prior from ${n} pilot participants (detailed ${det}/${n}, audio ${aud}/${nm}); strength ${STRENGTH} pseudo-counts.`,
  n, a_d: +(STRENGTH * pd).toFixed(3), b_d: +(STRENGTH * (1 - pd)).toFixed(3), a_a: +(STRENGTH * pa).toFixed(3), b_a: +(STRENGTH * (1 - pa)).toFixed(3),
  created: new Date().toISOString() };
writeFileSync("content/population-prior.json", JSON.stringify(prior, null, 1) + "\n");
console.log(prior._note, "->", "content/population-prior.json");
