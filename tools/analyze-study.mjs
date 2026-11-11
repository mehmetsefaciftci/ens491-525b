// Analyse study result files (from ?study=1) into the three project criteria plus the
// algorithm measures:
//   recall accuracy (core, and optional facts conditional on exposure), interaction time,
//   usability (SUS), mental demand (Raw NASA-TLX item), effort (Paas),
//   decisions, switches, overrides, decision latency, explanation coverage, filtered facts.
// Writes a Markdown summary and a long-format CSV (one row per participant x measure x condition)
// ready for a mixed-effects analysis.
// Usage: node tools/analyze-study.mjs <file-or-folder>... [--md out.md] [--csv out.csv]
import { readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const args = process.argv.slice(2);
const opt = (k) => { const i = args.indexOf(k); return i >= 0 ? args.splice(i, 2)[1] : null; };
const mdOut = opt("--md"), csvOut = opt("--csv");
const files = args.flatMap((p) => statSync(p).isDirectory() ? readdirSync(p).filter((f) => f.endsWith(".json")).map((f) => join(p, f)) : [p]);
if (!files.length) { console.error("usage: node tools/analyze-study.mjs <file-or-folder>... [--md out.md] [--csv out.csv]"); process.exit(1); }

const mean = (a) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : null);
const median = (a) => { if (!a.length) return null; const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };
const baseId = (label) => label.replace(/#\d+.*$/, "").replace(/-p\d+$/, "");
const rows = [];                       // long format
const perP = [];

for (const f of files) {
  const j = JSON.parse(readFileSync(f, "utf8"));
  if (j.kind !== "ca-guide-study-session") { console.warn(`skip ${f}: not a study session`); continue; }
  const S = j.study, P = `P${String(S.participant.number).padStart(2, "0")}`;
  const sim = j.events.some((e) => e.e === "nocam_mode");
  const add = (measure, value, system = "", room = "") => value != null && rows.push({ participant: P, system, room, measure, value });

  for (const b of S.blocks) {
    add("tlx_mental_demand", b.tlx_mental_demand, b.system, b.room);
    add("paas_effort", b.paas, b.system, b.room);
    for (const a of b.artworks) add("interaction_time_s", a.interaction_s, b.system, b.room);
  }
  for (const [sys, s] of Object.entries(S.sus)) add("sus", s.score, sys);

  // Recall: attribute each item to the condition in which its artwork was shown; optional items
  // count only if the covered segment was actually shown (exposure).
  const condOf = {};
  for (const b of S.schedule) for (const a of b.artworks) (condOf[baseId(a)] ||= new Set()).add(`${b.system}|${b.room}`);
  const exposed = new Set(j.exposure.map((e) => e.seg));
  const rec = { core: [], optional: [], optional_not_exposed: 0 };
  for (const r of S.recall) {
    const conds = condOf[r.artwork] || new Set();
    const [system, room] = conds.size === 1 ? [...conds][0].split("|") : ["multiple", ""];
    if (r.type === "core") { rec.core.push(r.correct_auto); add("recall_core_correct", r.correct_auto ? 1 : 0, system, room); }
    else if (exposed.has(r.covers)) { rec.optional.push(r.correct_auto); add("recall_optional_correct_exposed", r.correct_auto ? 1 : 0, system, room); }
    else rec.optional_not_exposed++;
  }

  // Algorithm measures per system.
  const alg = {};
  for (const [sys, log] of Object.entries(j.decision_logs)) {
    const d = log.filter((x) => "keep_or_switch" in x && x.action);
    const auto = d.filter((x) => x.keep_or_switch !== "override");
    const lat = d.map((x) => x.latency_ms).filter((x) => x != null);
    const comp = d.map((x) => x.compute_ms).filter((x) => x != null);
    alg[sys] = { decisions: d.length, switches: d.filter((x) => x.keep_or_switch === "switch").length,
      overrides: d.filter((x) => x.keep_or_switch === "override").length,
      latency_ms_median: median(lat), latency_ms_max: lat.length ? Math.max(...lat) : null,
      compute_ms_median: median(comp), compute_ms_max: comp.length ? Math.max(...comp) : null,
      explained: auto.length ? auto.filter((x) => x.reason && (sys === "fixed" || Object.keys(x.utility_by_action || {}).length)).length / auto.length : null,
      filtered_facts: d.reduce((s, x) => s + (x.filtered?.length || 0), 0) };
    add("overrides", alg[sys].overrides, sys); add("auto_switches", alg[sys].switches, sys);
  }
  perP.push({ P, file: f, simulated: sim, participant: S.participant, schedule: S.schedule, rec, alg, sus: S.sus });
}

// ---------------------------------------------------------------- outputs
const cell = (m, sys, room) => { const v = rows.filter((r) => r.measure === m && r.system === sys && (room == null || r.room === room)).map((r) => +r.value); return v.length ? mean(v) : null; };
const f1 = (v, d = 1) => (v == null ? "–" : (+v).toFixed(d));
const lines = [
  "# Study analysis", "",
  `${perP.length} session file(s): ${perP.map((p) => `${p.P}${p.simulated ? " (simulated input)" : ""}`).join(", ")}.`, "",
  "## Project criteria by condition (means)", "",
  "| Measure | Adaptive, quiet | Adaptive, noise | Fixed, quiet | Fixed, noise |", "|---|---|---|---|---|",
  ...[["Interaction time per artwork (s)", "interaction_time_s"], ["Raw NASA-TLX mental demand (0–100)", "tlx_mental_demand"], ["Paas effort (1–9)", "paas_effort"]]
    .map(([n, m]) => `| ${n} | ${f1(cell(m, "adaptive", "quiet"))} | ${f1(cell(m, "adaptive", "noise"))} | ${f1(cell(m, "fixed", "quiet"))} | ${f1(cell(m, "fixed", "noise"))} |`),
  "", "| Measure | Adaptive | Fixed |", "|---|---|---|",
  `| SUS (0–100) | ${f1(cell("sus", "adaptive", null))} | ${f1(cell("sus", "fixed", null))} |`,
  `| Core recall (share correct) | ${f1(cell("recall_core_correct", "adaptive", null), 2)} | ${f1(cell("recall_core_correct", "fixed", null), 2)} |`,
  `| Optional recall, exposed facts only | ${f1(cell("recall_optional_correct_exposed", "adaptive", null), 2)} | ${f1(cell("recall_optional_correct_exposed", "fixed", null), 2)} |`,
  `| Manual overrides per session | ${f1(cell("overrides", "adaptive", null))} | ${f1(cell("overrides", "fixed", null))} |`,
  "", "## Algorithm measures per session", "",
  "| Participant | System | Decisions | Auto switches | Overrides | Policy compute median / max (ms) | Shown on screen median / max (ms) | Explained decisions | Facts filtered |", "|---|---|---|---|---|---|---|---|---|",
  ...perP.flatMap((p) => Object.entries(p.alg).map(([s, a]) => `| ${p.P} | ${s} | ${a.decisions} | ${a.switches} | ${a.overrides} | ${f1(a.compute_ms_median, 2)} / ${f1(a.compute_ms_max, 2)} | ${f1(a.latency_ms_median)} / ${f1(a.latency_ms_max)} | ${a.explained == null ? "–" : (100 * a.explained).toFixed(0) + "%"} | ${a.filtered_facts} |`)),
  "", "Policy compute = time inside the policy call; shown on screen = until the next painted frame (inflated when the browser renders in the background).",
  "Recall items are scored automatically by keyword groups; check them by hand. Recall is attributed to a condition only when its artwork appeared in exactly one condition (\"multiple\" otherwise, e.g. while one artwork is reused in testing).",
  "Inference (participant-aware effect estimates with 95% CIs) is run on the CSV, e.g. a mixed-effects model with participant and artwork as random effects.",
];
const md = lines.join("\n") + "\n";
console.log(md);
if (mdOut) writeFileSync(mdOut, md);
if (csvOut) writeFileSync(csvOut, "participant,system,room,measure,value\n" + rows.map((r) => [r.participant, r.system, r.room, r.measure, r.value].join(",")).join("\n") + "\n");
