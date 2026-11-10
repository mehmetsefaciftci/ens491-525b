// Runs the 20 Python scenarios through the JavaScript policy and checks:
//  1) every expectation in the scenario definition holds,
//  2) every per-step decision (with and without history) equals the Python output,
//  3) every utility equals the Python value (4 decimals).
// Usage: node test/parity.test.mjs
import { readFileSync } from "node:fs";
import { Session, newUserState } from "../src/policy.js";

const ref = JSON.parse(readFileSync(new URL("./python_reference.json", import.meta.url), "utf8"));

function run(sc, useHistory) {
  const s = new Session(newUserState(sc.user), { useHistory });
  const results = [];
  let t = 0;
  for (const step of sc.steps) {
    t += 1;
    const before = s.log.length;
    if (step[0] === "ev") s.event(step[1], t);
    else {
      let art, noise, extra;
      if (step[0] === "rec") [, art, noise, extra] = step; else { [, noise, extra] = step; art = s.artwork; }
      const hasP = "p" in extra;
      const obs = { timestamp: t, artwork_id: art, tracking_valid: extra.tracking ?? true, noise_or_missing: noise,
        optional_sensor_features: hasP ? { p_high: extra.p } : null, quality_flags: hasP ? ["p_high_validated"] : [] };
      step[0] === "rec" ? s.recognize(obs) : s.boundary(obs);
    }
    const e = s.log.slice(before).find((x) => "keep_or_switch" in x);
    results.push(e ? [e.action, e.keep_or_switch, e.flags || []] : [null, null, []]);
  }
  const utils = s.log.filter((x) => "keep_or_switch" in x).map((x) => x.utility_by_action ?? null);
  return { results, utils };
}

let fail = 0, differ = 0;
for (const sc of ref) {
  const h = run(sc, true), n = run(sc, false);
  const problems = [];
  for (const [idx, act, kind] of sc.expect) {
    const [ga, gk] = h.results[idx];
    if (ga !== act || (kind && gk !== kind)) problems.push(`expect step ${idx}: ${act}/${kind}, got ${ga}/${gk}`);
  }
  if (sc.expect_flag && !h.results[sc.expect_flag[0]][2].includes(sc.expect_flag[1])) problems.push(`missing flag ${sc.expect_flag[1]}`);
  if (JSON.stringify(h.results) !== JSON.stringify(sc.py_with_history)) problems.push("decisions differ from Python (with history)");
  if (JSON.stringify(n.results) !== JSON.stringify(sc.py_no_history)) problems.push("decisions differ from Python (no history)");
  const pyU = sc.py_utilities.map((u) => (u && Object.keys(u).length ? u : null));
  const jsU = h.utils.map((u) => (u && Object.keys(u).length ? u : null));
  if (JSON.stringify(pyU) !== JSON.stringify(jsU)) problems.push("utilities differ from Python");
  const histMatters = JSON.stringify(h.results) !== JSON.stringify(n.results);
  if (histMatters) differ++;
  if (problems.length) fail++;
  console.log(`${problems.length ? "FAIL" : "pass"}  ${sc.id}  ${sc.title}${histMatters ? "  [history changes decisions]" : ""}`);
  problems.forEach((p) => console.log("      " + p));
}
console.log(`\n${ref.length - fail}/${ref.length} scenarios pass with Python parity; no-history ablation differs in ${differ}/${ref.length}.`);
process.exit(fail ? 1 : 0);
