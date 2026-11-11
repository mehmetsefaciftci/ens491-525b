// Bayesian policy on the original 20 scenarios (compared with their fixed-step expectations)
// plus new scenarios S21-S26 for the weaknesses the revision addresses.
// Usage: node test/bayes.test.mjs [--md out.md]
import { readFileSync, writeFileSync } from "node:fs";
import { BayesSession } from "../src/policy-bayes.js";

const ref = JSON.parse(readFileSync(new URL("./python_reference.json", import.meta.url), "utf8"));
const Q = 45, N = 72, NT = ["no_text"], NA = ["no_audio"];

const NEW = [
  { id: "S21", title: "Audio-only visitor skips detail twice -> brief audio next (fixes S18)",
    user: { accessibility: NT }, steps: [["rec", "A1", Q, {}], ["ev", "skip_detail"], ["ev", "skip_detail"], ["rec", "A2", Q, {}]],
    expect: [[0, "detailed_audio", "initial"], [3, "brief_audio", "initial"]] },
  { id: "S22", title: "Walking in a noisy room: text costs more, brief text wins",
    user: {}, steps: [["rec", "A1", N, { move: 0.9 }]], expect: [[0, "brief_text", "initial"]] },
  { id: "S23", title: "Leaving early twice plus one skip -> brief next",
    user: { accessibility: NA }, steps: [["rec", "A1", Q, {}], ["ev", "left_early"], ["ev", "left_early"], ["ev", "skip_detail"], ["rec", "A2", Q, {}]],
    expect: [[4, "brief_text", "initial"]] },
  { id: "S24", title: "Noise just above threshold: expected gain, but too uncertain to switch",
    user: {}, steps: [["rec", "A1", Q, {}], ["seg", 61, {}]], expect: [[0, "detailed_audio", "initial"], [1, "detailed_audio", "keep"]] },
  { id: "S25", title: "Clearly noisy after an uncertain reading -> switch with high confidence",
    user: {}, steps: [["rec", "A1", Q, {}], ["seg", 61, {}], ["seg", N, {}]], expect: [[1, "detailed_audio", "keep"], [2, "detailed_text", "switch"]] },
  { id: "S26", title: "Interest fades: old skips decay, explicit request restores detail",
    user: { accessibility: NA }, steps: [["rec", "A1", Q, {}], ["ev", "skip_detail"], ["ev", "skip_detail"], ["rec", "A2", Q, {}],
      ["ev", "request_more"], ["rec", "A3", Q, {}]], expect: [[3, "brief_text", "initial"], [5, "detailed_text", "initial"]] },
  { id: "S27", title: "High behavioural load on the previous artwork -> brief text next",
    user: { accessibility: NA }, steps: [["rec", "A1", Q, {}], ["rec", "A2", Q, { load: 0.85 }]], expect: [[0, "detailed_text", "initial"], [1, "brief_text", "initial"]] },
  { id: "S28", title: "Load at its no-evidence level changes nothing",
    user: { accessibility: NA }, steps: [["rec", "A1", Q, { load: 0.168 }]], expect: [[0, "detailed_text", "initial"]] },
];

export function run(sc, { useHistory = true } = {}) {
  const s = new BayesSession(sc.user, { useHistory });
  const results = []; let t = 0;
  for (const step of sc.steps) {
    t += 1; const before = s.log.length;
    if (step[0] === "ev") s.event(step[1], t);
    else {
      let art, noise, extra;
      if (step[0] === "rec") [, art, noise, extra] = step; else { [, noise, extra] = step; art = s.artwork; }
      const f = {}; const flags = [];
      if ("p" in extra) { f.p_high = extra.p; flags.push("p_high_validated"); }
      if ("move" in extra) f.p_moving = extra.move;
      if ("load" in extra) f.p_load = extra.load;
      const obs = { timestamp: t, artwork_id: art, tracking_valid: extra.tracking ?? true, noise_or_missing: noise,
        optional_sensor_features: f, quality_flags: flags };
      step[0] === "rec" ? s.recognize(obs) : s.boundary(obs);
    }
    const e = s.log.slice(before).find((x) => "keep_or_switch" in x);
    results.push(e ? [e.action, e.keep_or_switch, e.confidence] : [null, null, null]);
  }
  return results;
}

const rows = []; let failNew = 0, same = 0;
for (const sc of ref) {
  const r = run({ ...sc, user: { familiarity: sc.user.familiarity, accessibility: sc.user.accessibility } });
  const old = sc.py_with_history.map((x) => x.slice(0, 2).join("/"));
  const now = r.map((x) => x.slice(0, 2).join("/"));
  const eq = JSON.stringify(old) === JSON.stringify(now);
  if (eq) same++;
  rows.push({ id: sc.id, title: sc.title, eq, old: old.filter((x) => x !== "/").join(" → "), now: now.filter((x) => x !== "/").join(" → ") });
}
const newRows = [];
for (const sc of NEW) {
  const r = run(sc);
  const problems = sc.expect.filter(([i, a, k]) => r[i][0] !== a || r[i][1] !== k).map(([i, a, k]) => `step ${i}: expected ${a}/${k}, got ${r[i][0]}/${r[i][1]}`);
  if (problems.length) failNew++;
  newRows.push({ id: sc.id, title: sc.title, ok: !problems.length, got: r.filter((x) => x[1]).map((x) => `${x[0]}/${x[1]}${x[2] != null ? ` (p=${(+x[2]).toFixed(2)})` : ""}`).join(" → "), problems });
}

for (const r of rows) console.log(`${r.eq ? "same" : "DIFF"}  ${r.id}  ${r.title}${r.eq ? "" : `\n      fixed-step: ${r.old}\n      bayes:      ${r.now}`}`);
console.log("");
for (const r of newRows) { console.log(`${r.ok ? "pass" : "FAIL"}  ${r.id}  ${r.title}\n      ${r.got}`); r.problems.forEach((p) => console.log("      " + p)); }
console.log(`\nOriginal 20: ${same}/20 same decisions as the fixed-step policy. New scenarios: ${NEW.length - failNew}/${NEW.length} pass.`);

const mdIdx = process.argv.indexOf("--md");
if (mdIdx > 0) {
  const md = [`# Bayesian policy: scenario results`, "", `Original 20 scenarios: ${same}/20 identical to the fixed-step policy. New scenarios: ${NEW.length - failNew}/${NEW.length} pass.`, "",
    "| ID | Scenario | Same as fixed-step | Fixed-step | Bayesian |", "|---|---|---|---|---|",
    ...rows.map((r) => `| ${r.id} | ${r.title} | ${r.eq ? "yes" : "**no**"} | ${r.eq ? "" : r.old} | ${r.eq ? "" : r.now} |`), "",
    "| ID | New scenario | Result | Decisions (confidence) |", "|---|---|---|---|",
    ...newRows.map((r) => `| ${r.id} | ${r.title} | ${r.ok ? "pass" : "FAIL"} | ${r.got} |`)].join("\n");
  writeFileSync(process.argv[mdIdx + 1], md + "\n");
}
process.exit(failNew ? 1 : 0);
