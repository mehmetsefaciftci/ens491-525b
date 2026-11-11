// Compare content-selection policies on simulated museum visits.
//
// The visitor simulator is written independently of the policies: visitors have a latent
// interest in detail that can fade over the visit, a modality preference or constraint, and
// they move through quiet, borderline and noisy rooms, sometimes walking. They react with
// skips, requests, replays, overrides and early exits with fixed probabilities (see VISITOR).
// "Suitable" is judged against the hidden truth, which no policy sees.
//
// This is a design analysis under stated assumptions, not evidence of user benefit; the user
// study tests that. Usage: node sim/compare.mjs [visitors=2000] [--md out.md] [--json out.json]
import { writeFileSync } from "node:fs";
import { performance } from "node:perf_hooks";
import { Session, newUserState, defaultConfig } from "../src/policy.js";
import { BayesSession, bayesConfig } from "../src/policy-bayes.js";
import { practicePrior } from "../src/study.js";

const NV = +(process.argv.find((a) => /^\d+$/.test(a)) || 2000);
const ART = 8, BRIEF_SEGS = 2, DET_SEGS = 5, THR = 60;
const VISITOR = {             // simulator assumptions (all [N], stated in the report)
  fatigueShare: 0.4, fatigueStep: 0.08, audioOnly: 0.1, textOnly: 0.1,
  room: { quiet: 0.5, borderline: 0.15, noisy: 0.35 }, walking: 0.2,
  pSkipUnwanted: 0.8, pLeaveEarly: 0.5, pRequestMore: 0.4, pReplay: 0.2, pDwell: 0.5,
  pOverrideNoisyAudio: 0.6, pOverrideStrongPref: 0.3, micSd: 3, pStatedWrong: 0.15,
};

function rng(seed) { return () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const gauss = (r) => Math.sqrt(-2 * Math.log(r() + 1e-12)) * Math.cos(2 * Math.PI * r());

function makeVisitor(r) {
  const u = r();
  const constraint = u < VISITOR.audioOnly ? "no_text" : u < VISITOR.audioOnly + VISITOR.textOnly ? "no_audio" : null;
  const v = { d0: 0.1 + 0.8 * r(), fatigue: r() < VISITOR.fatigueShare, aff: r(), constraint, fam: 1 + Math.floor(r() * 7) };
  // Format the visitor states on the practice artwork; each half is wrong with pStatedWrong.
  const dens = (v.d0 > 0.5) !== (r() < VISITOR.pStatedWrong) ? "detailed" : "brief";
  const mod = constraint === "no_text" ? "audio" : constraint === "no_audio" ? "text" : (v.aff > 0.5) !== (r() < VISITOR.pStatedWrong) ? "audio" : "text";
  v.stated = `${dens}_${mod}`;
  // Practice behaviour (no question): the visitor tries each allowed format; finishing a sample
  // follows the hidden preferences with noise. Same practicePrior() as the app uses.
  const fmts = ["brief_text", "detailed_text", "brief_audio", "detailed_audio"].filter((f) => allowed(v, f));
  v.practice = fmts.map((f) => {
    const det = f.startsWith("detailed"), aud = f.endsWith("audio");
    const likeD = det ? v.d0 : 1 - v.d0, likeM = v.constraint ? 0.8 : aud ? v.aff : 1 - v.aff;
    const completed = r() < 0.15 + 0.7 * (det ? likeD : 0.5) * (0.4 + 0.6 * likeM) / 0.5 * 0.5;
    return { format: f, completed, ratio: completed ? 1 + 0.3 * r() : 0.1 + 0.5 * r() };
  });
  return v;
}
function makeRoom(r) {
  const u = r(), R = VISITOR.room;
  const db = u < R.quiet ? 45 + 4 * gauss(r) : u < R.quiet + R.borderline ? 56 + 8 * r() : 72 + 4 * gauss(r);
  return { db, noisy: db > THR, walking: r() < VISITOR.walking };
}
// Ground truth: is format f suitable for this visitor at this artwork?
function suitable(f, v, wants, room) {
  const det = f.startsWith("detailed"), aud = f.endsWith("audio");
  if ((v.constraint === "no_text" && !aud) || (v.constraint === "no_audio" && aud)) return false;
  if (det !== wants) return false;
  if (v.constraint) return true;
  const audioOk = !room.noisy, textOk = !room.walking;
  if (audioOk && textOk) return aud === v.aff > 0.5;
  return aud ? audioOk : textOk;
}
const allowed = (v, f) => !(v.constraint === "no_text" && f.endsWith("text")) && !(v.constraint === "no_audio" && f.endsWith("audio"));

// ---------------------------------------------------------------- policies with a common interface
function sessionPolicy(name, make) {
  return { name, start(v) { this.s = make(v); },
    recognize(obs) { return this.s.recognize(obs)?.action; }, boundary(obs) { return this.s.boundary(obs)?.action; },
    event(e) { this.s.event(e, 0); } };
}
const POLICIES = [
  { name: "Fixed (visitor's stated choice)", start(v) { this.f = v.stated; },
    recognize() { return this.f; }, boundary() { return null; }, event() {} },
  { name: "Rule-based (starts from stated choice)", start(v) { this.v = v; this.dens = v.stated.split("_")[0]; this.pref = v.stated.split("_")[1]; this.skips = 0; },
    pick(obs) { let mod = obs.noise_or_missing > THR ? "text" : this.pref;
      if (this.v.constraint === "no_text") mod = "audio"; if (this.v.constraint === "no_audio") mod = "text"; return `${this.dens}_${mod}`; },
    recognize(obs) { this.cur = this.pick(obs); this.changed = false; return this.cur; },
    boundary(obs) { if (this.changed || this.locked) return null; const n = this.pick(obs); if (n !== this.cur) { this.cur = n; this.changed = true; return n; } return null; },
    event(e) { if (e === "skip_detail" && ++this.skips >= 2) { this.dens = "brief"; this.skips = 0; }
      if (e === "request_more") this.dens = "detailed"; if (e.startsWith("override:")) this.cur = e.split(":")[1]; } },
  sessionPolicy("Fixed-step utility (current)", (v) => new Session(newUserState({ familiarity: v.fam, accessibility: v.constraint ? [v.constraint] : [] }), { config: defaultConfig() })),
  sessionPolicy("Bayesian, neutral prior", (v) => new BayesSession({ familiarity: v.fam, accessibility: v.constraint ? [v.constraint] : [] }, { config: bayesConfig() })),
  sessionPolicy("Bayesian, practice behaviour as prior (no question)", (v) => { const pp = practicePrior(v.practice);
    return new BayesSession({ familiarity: v.fam, accessibility: v.constraint ? [v.constraint] : [], a_d: 2 + pp.a_d, b_d: 2 + pp.b_d, a_a: 2 + pp.a_a, b_a: 2 + pp.b_a }, { config: bayesConfig() }); }),
  sessionPolicy("Bayesian, stated choice as prior", (v) => new BayesSession({ familiarity: v.fam, accessibility: v.constraint ? [v.constraint] : [], format_preference: v.stated }, { config: bayesConfig() })),
  sessionPolicy("Bayesian, stated prior, no history (ablation)", (v) => new BayesSession({ familiarity: v.fam, accessibility: v.constraint ? [v.constraint] : [], format_preference: v.stated }, { config: bayesConfig(), useHistory: false })),
];

// ---------------------------------------------------------------- one visit
function visit(policy, v, seed) {
  const r = rng(seed);                      // same visitor + rooms + reactions for every policy
  policy.start(v);
  let segs = 0, ok = 0, okLate = 0, segsLate = 0, effort = 0, switches = 0, times = [];
  for (let k = 0; k < ART; k++) {
    const room = makeRoom(r), dk = v.fatigue ? Math.max(0.02, v.d0 - VISITOR.fatigueStep * k) : v.d0;
    const wants = r() < dk;
    const obs = () => ({ timestamp: k, artwork_id: `A${k}`, tracking_valid: true, noise_or_missing: room.db + VISITOR.micSd * gauss(r),
      optional_sensor_features: { p_moving: room.walking ? 0.8 : 0.1 }, quality_flags: [] });
    let t = performance.now(); let f = policy.recognize(obs()); times.push(performance.now() - t);
    if (!f) continue;
    // visitor may override at the start
    const strongPref = !v.constraint && Math.abs(v.aff - 0.5) > 0.3;
    if (f.endsWith("audio") && room.noisy && allowed(v, f.replace("audio", "text")) && r() < VISITOR.pOverrideNoisyAudio) {
      f = f.replace("audio", "text"); policy.event(`override:${f}`); effort++; }
    else if (strongPref && (f.endsWith("audio") !== v.aff > 0.5) && r() < VISITOR.pOverrideStrongPref) {
      f = f.endsWith("audio") ? f.replace("audio", "text") : f.replace("text", "audio"); policy.event(`override:${f}`); effort++; }
    let i = 0, ended = false;
    while (!ended) {
      const n = f.startsWith("detailed") ? DET_SEGS : BRIEF_SEGS;
      if (i >= n) break;
      const good = suitable(f, v, wants, room); segs++; ok += good; if (k >= 4) { segsLate++; okLate += good; }
      if (f.startsWith("detailed") && i === BRIEF_SEGS && !wants) {           // first optional segment
        if (r() < VISITOR.pSkipUnwanted) { policy.event("skip_detail"); effort++; ended = true; break; }
        if (r() < VISITOR.pLeaveEarly) { policy.event("left_early"); ended = true; break; }
      }
      if (i < n - 1) { t = performance.now(); const nf = policy.boundary(obs()); times.push(performance.now() - t);
        if (nf && nf !== f) { switches++; f = nf; if (i + 1 >= (f.startsWith("detailed") ? DET_SEGS : BRIEF_SEGS)) break; } }
      i++;
    }
    if (!ended && f.startsWith("detailed") && i >= DET_SEGS) policy.event("complete_detail");
    if (f.startsWith("brief") && wants) {
      if (r() < VISITOR.pRequestMore) { policy.event("request_more"); effort++; }
      else if (r() < VISITOR.pReplay) policy.event("replay");
      if (r() < VISITOR.pDwell) policy.event("dwell_long");
    }
  }
  return { suit: ok / segs, suitLate: segsLate ? okLate / segsLate : NaN, effort, switches, times };
}

// ---------------------------------------------------------------- run
const out = [];
for (const p of POLICIES) {
  const rows = [], times = [];
  for (let i = 0; i < NV; i++) {
    const vr = rng(1000 + i), v = makeVisitor(vr);
    const res = visit(p, v, 50000 + i); rows.push(res); times.push(...res.times);
  }
  const mean = (k) => rows.reduce((a, r) => a + r[k], 0) / rows.length;
  const ci = (k) => { const m = mean(k), sd = Math.sqrt(rows.reduce((a, r) => a + (r[k] - m) ** 2, 0) / (rows.length - 1)); return 1.96 * sd / Math.sqrt(rows.length); };
  times.sort((a, b) => a - b);
  const grp = (pred) => { const g = rows.filter((_, i) => pred(makeVisitor(rng(1000 + i)))); return g.reduce((a, r) => a + r.suit, 0) / g.length; };
  out.push({ policy: p.name, suitable: mean("suit"), suitable_ci: ci("suit"), suitable_late: mean("suitLate"), suitable_late_ci: ci("suitLate"),
    effort: mean("effort"), switches: mean("switches"),
    suitable_audio_only: grp((v) => v.constraint === "no_text"), suitable_fatigue: grp((v) => v.fatigue),
    us_median: times[Math.floor(times.length / 2)] * 1000, us_p99: times[Math.floor(times.length * 0.99)] * 1000 });
}

const pct = (x) => `${(100 * x).toFixed(1)}%`;
console.log(`${NV} simulated visitors x ${ART} artworks\n`);
console.table(out.map((o) => ({ policy: o.policy, "suitable": `${pct(o.suitable)} ±${(100 * o.suitable_ci).toFixed(1)}`, "artworks 5-8": pct(o.suitable_late),
  "audio-only": pct(o.suitable_audio_only), "fading interest": pct(o.suitable_fatigue), "visitor actions": o.effort.toFixed(2),
  "auto switches": o.switches.toFixed(2), "µs/decision (p50/p99)": `${o.us_median.toFixed(0)}/${o.us_p99.toFixed(0)}` })));

const mdIdx = process.argv.indexOf("--md");
if (mdIdx > 0) writeFileSync(process.argv[mdIdx + 1], [
  `# Policy comparison on simulated visits`, "", `${NV} simulated visitors × ${ART} artworks; same visitors, rooms and reactions for every policy (common random numbers).`,
  `"Suitable" = share of content segments shown in a format that fits the visitor's hidden interest, constraint, room noise and walking state.`, "",
  "| Policy | Suitable (95% CI) | Artworks 5–8 | Audio-only visitors | Fading interest | Visitor actions / visit | Auto switches / visit | µs per decision (p50 / p99) |",
  "|---|---|---|---|---|---|---|---|",
  ...out.map((o) => `| ${o.policy} | ${pct(o.suitable)} ± ${(100 * o.suitable_ci).toFixed(1)} | ${pct(o.suitable_late)} | ${pct(o.suitable_audio_only)} | ${pct(o.suitable_fatigue)} | ${o.effort.toFixed(2)} | ${o.switches.toFixed(2)} | ${o.us_median.toFixed(0)} / ${o.us_p99.toFixed(0)} |`),
  "", "Simulator assumptions:", "```json", JSON.stringify(VISITOR, null, 1), "```",
  "Limits: the simulator encodes our assumptions about visitor behaviour; it compares policies under those assumptions and does not show that visitors learn more or feel less loaded. Timing is Node.js on a laptop, not the phone."].join("\n") + "\n");
const jIdx = process.argv.indexOf("--json");
if (jIdx > 0) writeFileSync(process.argv[jIdx + 1], JSON.stringify({ visitors: NV, assumptions: VISITOR, results: out }, null, 1));
