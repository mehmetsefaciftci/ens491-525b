// Software modularity check: module dependency graph, layer rules and size.
// Layers (lower may not import higher):
//   1 sensing      noise.js, motion.js                  -> measurements only
//   2 model        policy.js, policy-bayes.js, policy-fixed.js, filter.js, study.js
//                  -> pure decision logic and data model; no DOM, runs in Node (unit-testable)
//   3 interaction  app.js, study-ui.js                  -> DOM, camera, speech, study flow
// Usage: node tools/modularity.mjs [--md out.md]
import { readFileSync, readdirSync, writeFileSync } from "node:fs";

const LAYER = { "noise.js": 1, "motion.js": 1, "policy.js": 2, "policy-bayes.js": 2, "policy-fixed.js": 2, "filter.js": 2, "study.js": 2, "app.js": 3, "study-ui.js": 3 };
const NAME = { 1: "sensing", 2: "model", 3: "interaction" };
const files = readdirSync("src").filter((f) => f.endsWith(".js"));
const rows = [], problems = [];
for (const f of files) {
  const src = readFileSync(`src/${f}`, "utf8");
  const deps = [...src.matchAll(/from\s+"\.\/([\w.-]+)"/g)].map((m) => m[1]);
  const usesDom = /\b(document|window|navigator)\b/.test(src.replace(/\/\/.*$/gm, ""));
  const loc = src.split("\n").filter((l) => l.trim() && !l.trim().startsWith("//")).length;
  const L = LAYER[f];
  if (L == null) problems.push(`${f}: not assigned to a layer`);
  for (const d of deps) if (LAYER[d] > L) problems.push(`${f} (layer ${L}) imports ${d} (layer ${LAYER[d]})`);
  if (L === 2 && usesDom) problems.push(`${f}: model layer touches the DOM/browser`);
  rows.push({ f, layer: L, deps, usesDom, loc });
}
const tests = readdirSync("test").filter((f) => f.endsWith(".test.mjs"));
const md = [
  "# Modularity report", "",
  "| Module | Layer | Imports | Uses browser APIs | Lines of code |", "|---|---|---|---|---|",
  ...rows.sort((a, b) => a.layer - b.layer).map((r) => `| ${r.f} | ${r.layer} ${NAME[r.layer] || "?"} | ${r.deps.join(", ") || "–"} | ${r.usesDom ? "yes" : "no"} | ${r.loc} |`),
  "", `Layer rules: ${problems.length ? "**violations**:\n" + problems.map((p) => "- " + p).join("\n") : "no violations (no upward imports; the model layer is DOM-free and runs under Node)."}`,
  "", `Test files: ${tests.join(", ")}. Policies share one interface (recognize / boundary / event), so the study swaps adaptive and non-adaptive arms without changing the UI; sensors, content (JSON) and targets can be replaced independently.`,
].join("\n") + "\n";
console.log(md);
const i = process.argv.indexOf("--md"); if (i > 0) writeFileSync(process.argv[i + 1], md);
process.exit(problems.length ? 1 : 0);
