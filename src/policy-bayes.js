// Bayesian expected-utility policy (proposed revision of the fixed-step policy in policy.js).
//
// User state is a belief, not a counter:
//   theta_d ~ Beta(a_d, b_d)   probability that the visitor wants optional detail
//   theta_a ~ Beta(a_a, b_a)   probability that the visitor prefers audio over text
// Context is uncertain too:
//   noise level L ~ Normal(L_measured, NOISE_SD_DB)  -> P(noisy) = P(L > threshold);
//   a missing noise channel uses the prior P_NOISY_UNKNOWN instead of an ad-hoc penalty
//   motion: P(moving) from the accelerometer (reading text while walking costs more)
//
// U(a | belief, x) = I(a, theta_d, k) + M(a, theta_a) - D(a, x) - c_switch(a)
//   I(detailed) = theta_d * V_WANTED + (1 - theta_d) * V_UNWANTED - familiarity term
//   I(brief)    = I_BRIEF
//   M(audio)    = G_MODALITY * (theta_a - 0.5),  M(text) = 0
//   D(a, x)     = D_BASE[density] * modality multiplier(P(noisy), P(moving))
// The decision maximises the posterior expected utility. An automatic switch also needs
// P(U_new > U_current) >= SWITCH_CONFIDENCE, estimated by Monte Carlo over the posterior;
// that probability is logged as the decision's confidence.
//
// Evidence -> pseudo-counts: implicit signals (skip, complete, replay, dwell) weigh less than
// explicit ones (request more, override). Evidence decays by FORGET at each new artwork so the
// model can follow a visitor whose interest changes (fatigue).
// Timing rules are unchanged from policy.js (one auto change per artwork at a segment boundary,
// manual override wins, tracking loss / dropped noise channel -> keep current).

import { ACTIONS, defaultConfig, feasibleActions } from "./policy.js";

export function bayesConfig() {
  return {
    ...defaultConfig(),
    PRIOR_DETAIL: [2, 2],        // [N] weak, neutral prior
    PRIOR_AUDIO: [2, 2],         // [N]
    V_WANTED: 1.6,               // [N] value of detail the visitor wants
    V_UNWANTED: 0.4,             // [N] value of detail the visitor does not want (< I_BRIEF)
    //   (V_WANTED + V_UNWANTED) / 2 = 1.0 = I_DETAILED [P], so the neutral prior reproduces Appendix A
    G_MODALITY: 1.0,               // [N] a stated preference (2 pseudo-counts) must outweigh the text/audio cost gap in a quiet room
    W_IMPLICIT: 1.0,             // [N] skip / complete / replay
    W_EXPLICIT: 2.0,             // [N] request more / manual override
    W_DWELL: 0.5,                // [N] long dwell / leaving early
    FORGET: 0.85,                // [N] evidence kept per new artwork
    NOISE_SD_DB: 5.0,            // [N] uncertainty of an uncalibrated phone microphone
    P_NOISY_UNKNOWN: 0.3,        // [N] prior P(noisy) when the noise channel is missing
    MOTION_TEXT_PENALTY: 0.5,    // [N] text cost x (1 + 0.5 * P(moving))
    SWITCH_CONFIDENCE: 0.75,     // [N] P(improvement) required for an automatic switch
    PREF_PSEUDO: 2.0,            // [N] weight of the format chosen on the practice artwork
    LOAD_WEIGHT: 0.5,            // [N] scales the Appendix A high-minus-low demand cost by excess load
    LOAD_BASE: 0.168,            // P(high load) with no evidence (= logistic(B0) in load.js)
    MC_SAMPLES: 400,
  };
}

// The format the visitor picked on the practice artwork (proposal: fair comparator) becomes a
// moderate prior instead of a fixed choice: PREF_PSEUDO counts go to the stated side.
export function newBelief(C, over = {}) {
  const b = {
    familiarity: 4, accessibility: [], format_preference: null,
    a_d: C.PRIOR_DETAIL[0], b_d: C.PRIOR_DETAIL[1],
    a_a: C.PRIOR_AUDIO[0], b_a: C.PRIOR_AUDIO[1],
    p_high: null,
    ...over,
  };
  const p = b.format_preference;
  if (p && over.a_d == null) {
    if (p.startsWith("detailed")) b.a_d += C.PREF_PSEUDO; else b.b_d += C.PREF_PSEUDO;
    if (p.endsWith("audio")) b.a_a += C.PREF_PSEUDO; else b.b_a += C.PREF_PSEUDO;
  }
  return b;
}

const clone = (o) => JSON.parse(JSON.stringify(o));
const r4 = (v) => Math.round(v * 1e4) / 1e4;
const argmax = (o) => Object.keys(o).reduce((b, k) => (o[k] > o[b] ? k : b));

// Standard normal CDF (Abramowitz-Stegun 7.1.26), enough for a probability of being noisy.
function phi(z) {
  const t = 1 / (1 + 0.3275911 * Math.abs(z) / Math.SQRT2);
  const y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-(z * z) / 2);
  return z >= 0 ? (1 + y) / 2 : (1 - y) / 2;
}

export function pNoisy(C, noiseDb) {
  if (noiseDb == null) return C.P_NOISY_UNKNOWN;
  return phi((noiseDb - C.NOISY_THRESHOLD_DBA) / C.NOISE_SD_DB);
}

// Deterministic PRNG so the scenario suite and the logs are reproducible.
function mulberry32(seed) {
  return () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
function gammaSample(k, rnd) {           // Marsaglia-Tsang, k >= 1 (priors keep k >= 1)
  if (k < 1) return gammaSample(k + 1, rnd) * Math.pow(rnd(), 1 / k);
  const d = k - 1 / 3, c = 1 / Math.sqrt(9 * d);
  for (;;) {
    let x, v;
    do { const u1 = rnd(), u2 = rnd(); x = Math.sqrt(-2 * Math.log(u1 + 1e-12)) * Math.cos(2 * Math.PI * u2); v = 1 + c * x; } while (v <= 0);
    v = v * v * v; const u = rnd();
    if (u < 1 - 0.0331 * x ** 4 || Math.log(u) < 0.5 * x * x + d * (1 - v + Math.log(v))) return d * v;
  }
}
const betaSample = (a, b, rnd) => { const x = gammaSample(a, rnd); return x / (x + gammaSample(b, rnd)); };

function familiarityTerm(C, s) {
  return C.FAMILIARITY_DETAIL_PENALTY_MAX * Math.max(0, s.familiarity - 4) / 3.0;   // as in policy.js
}

// Utility of each feasible action for given parameter values (theta_d, theta_a, pNoisy, pMoving, pLoad).
// Behavioural load: excess P(high load) above its no-evidence level adds a share of the Appendix A
// cost difference C_HIGH - C_LOW, which is largest for detailed content.
function utilityAt(C, s, a, td, ta, pn, pm, current, pl = 0) {
  const dens = a.split("_")[0], aud = a.endsWith("audio");
  let I = dens === "brief" ? C.I_BRIEF : td * C.V_WANTED + (1 - td) * C.V_UNWANTED - familiarityTerm(C, s);
  const M = aud ? C.G_MODALITY * (ta - 0.5) : 0;
  let D;
  if (s.p_high != null) {                // optional validated-demand branch, unchanged (Appendix A)
    const mult = aud ? (1 + pn * (C.AUDIO_MULT_NOISY - 1)) : C.TEXT_MULT;
    D = mult * ((1 - s.p_high) * C.C_LOW[a] + s.p_high * C.C_HIGH[a]);
  } else {
    const mult = aud ? C.AUDIO_MULT_QUIET + pn * (C.AUDIO_MULT_NOISY - C.AUDIO_MULT_QUIET)
                     : C.TEXT_MULT * (1 + C.MOTION_TEXT_PENALTY * pm);
    D = C.D_BASE[dens] * mult;
  }
  const Lc = s.p_high == null ? C.LOAD_WEIGHT * Math.max(0, pl - C.LOAD_BASE) * (C.C_HIGH[a] - C.C_LOW[a]) : 0;
  const S = current != null && a !== current ? C.C_SWITCH : 0;
  return { U: I + M - D - Lc - S, I, M, D, L: Lc, S };
}

export function evaluate(C, s, ctx, current, { useHistory = true, seed = 1, base = null } = {}) {
  // No-history ablation: forget behaviour evidence but keep the starting prior (incl. stated preference).
  const b0 = base || { a_d: C.PRIOR_DETAIL[0], b_d: C.PRIOR_DETAIL[1], a_a: C.PRIOR_AUDIO[0], b_a: C.PRIOR_AUDIO[1] };
  const st = useHistory ? s : { ...s, ...b0 };
  const pn = pNoisy(C, ctx.noise), pm = ctx.pMoving ?? 0, pl = ctx.pLoad ?? 0;
  const md = st.a_d / (st.a_d + st.b_d), ma = st.a_a / (st.a_a + st.b_a);
  const acts = feasibleActions(st);
  const utils = {}, terms = {};
  for (const a of acts) { const r = utilityAt(C, st, a, md, ma, pn, pm, current, pl); utils[a] = r.U; terms[a] = r; }
  const best = argmax(utils);
  // Monte Carlo over the posterior: how often is `best` really better than `ref`?
  const ref = current && current !== best ? current : null;
  const rnd = mulberry32(seed);
  let wins = 0, bestWins = 0;
  for (let i = 0; i < C.MC_SAMPLES; i++) {
    const td = betaSample(st.a_d, st.b_d, rnd), ta = betaSample(st.a_a, st.b_a, rnd);
    const noisyDraw = ctx.noise == null ? (rnd() < C.P_NOISY_UNKNOWN ? 1 : 0)
      : (ctx.noise + C.NOISE_SD_DB * Math.sqrt(-2 * Math.log(rnd() + 1e-12)) * Math.cos(2 * Math.PI * rnd()) > C.NOISY_THRESHOLD_DBA ? 1 : 0);
    const u = {};
    for (const a of acts) u[a] = utilityAt(C, st, a, td, ta, noisyDraw, pm, current, pl).U;
    if (ref && u[best] > u[ref]) wins++;
    if (argmax(u) === best) bestWins++;
  }
  const flags = [];
  if (ctx.noise == null) flags.push("noise_unknown");
  flags.push(st.p_high != null ? "p_high_valid" : "p_high_unknown");
  if (pl > C.LOAD_BASE) flags.push("behavioural_load_estimate");
  return { utils, terms, best, flags, pNoisy: pn, pMoving: pm, pLoad: pl, meanDetail: md, meanAudio: ma,
    pImprove: ref ? wins / C.MC_SAMPLES : null, pBest: bestWins / C.MC_SAMPLES };
}

export class BayesSession {
  constructor(user, { useHistory = true, config = bayesConfig(), clock = () => Date.now() / 1000 } = {}) {
    this.C = config;
    this.live = newBelief(config, clone(user));
    this.frozen = clone(this.live);
    this.base = { a_d: this.live.a_d, b_d: this.live.b_d, a_a: this.live.a_a, b_a: this.live.b_a };
    this.useHistory = useHistory;
    this.clock = clock;
    this.artwork = null; this.current = null; this.autoChanges = 0; this.locked = false;
    this.lastNoiseKnown = false; this.log = []; this.lastUtils = null; this.n = 0;
  }

  _ctx(obs) {
    const f = obs.optional_sensor_features || {};
    return { noise: obs.noise_or_missing ?? null, pMoving: f.p_moving ?? 0, pLoad: f.p_load ?? 0 };
  }
  _state(obs) {
    const s = clone(this.frozen);
    const f = obs.optional_sensor_features || {};
    s.p_high = (obs.quality_flags || []).includes("p_high_validated") ? f.p_high ?? null : null;
    return s;
  }
  _emit(obs, action, kind, ev, reason) {
    const d = { timestamp: obs.timestamp, artwork_id: obs.artwork_id || "-", action, keep_or_switch: kind,
      utility_by_action: Object.fromEntries(Object.entries(ev?.utils || {}).map(([k, v]) => [k, r4(v)])),
      reason, flags: ev?.flags || [], noise_dba: obs.noise_or_missing ?? null, policy: "bayes",
      belief: { detail_mean: r4(this.frozen.a_d / (this.frozen.a_d + this.frozen.b_d)), audio_mean: r4(this.frozen.a_a / (this.frozen.a_a + this.frozen.b_a)) },
      p_noisy: ev ? r4(ev.pNoisy) : null, p_load: ev ? r4(ev.pLoad) : null, confidence: ev ? (ev.pImprove ?? ev.pBest) : null };
    if (action) { d.modality = action.split("_")[1]; d.density = action.split("_")[0]; }
    this.log.push(d); if (ev) this.lastUtils = ev;
    return d;
  }

  recognize(obs) {
    if (!obs.tracking_valid || obs.artwork_id == null) {
      this.log.push({ timestamp: obs.timestamp, artwork_id: obs.artwork_id || "-", action: null, keep_or_switch: "none",
        reason: "artwork not recognised / tracking invalid: no content shown yet" });
      return null;
    }
    // New artwork: decay old evidence towards the prior, then commit it.
    const C = this.C, L = this.live, B = this.base;
    if (this.artwork != null) for (const k of ["a_d", "b_d", "a_a", "b_a"]) L[k] = B[k] + (L[k] - B[k]) * C.FORGET;
    this.frozen = clone(L);
    this.artwork = obs.artwork_id; this.autoChanges = 0; this.locked = false;
    const ev = evaluate(C, this._state(obs), this._ctx(obs), null, { useHistory: this.useHistory, seed: ++this.n, base: this.base });
    this.current = ev.best; this.lastNoiseKnown = obs.noise_or_missing != null;
    return this._emit(obs, ev.best, "initial", ev,
      `highest expected utility (${ev.utils[ev.best].toFixed(3)}); best in ${(ev.pBest * 100).toFixed(0)}% of posterior draws`);
  }

  boundary(obs) {
    if (this.current == null) { this.log.push({ timestamp: obs.timestamp, artwork_id: obs.artwork_id || "-", action: null, keep_or_switch: "none", reason: "no current content" }); return null; }
    const C = this.C;
    const ev = evaluate(C, this._state(obs), this._ctx(obs), this.current, { useHistory: this.useHistory, seed: ++this.n, base: this.base });
    const u = ev.utils;
    const noiseKnown = obs.noise_or_missing != null, dropped = this.lastNoiseKnown && !noiseKnown;
    this.lastNoiseKnown = noiseKnown || this.lastNoiseKnown;
    const keep = (r) => this._emit(obs, this.current, "keep", ev, r);
    if (!obs.tracking_valid) return keep("tracking lost: keep current");
    if (this.locked) return keep("manual override wins for this artwork");
    if (this.autoChanges >= C.MAX_AUTO_CHANGES_PER_ARTWORK) return keep("automatic-change limit for this artwork reached");
    if (dropped) return keep("noise channel dropped: insufficient evidence to change");
    if (ev.best === this.current) return keep("current action still has highest expected utility");
    if (!(u[ev.best] > u[this.current])) return keep("no expected gain");
    if (ev.pImprove < C.SWITCH_CONFIDENCE)
      return keep(`expected gain ${(u[ev.best] - u[this.current]).toFixed(3)} but P(improvement) ${ev.pImprove.toFixed(2)} < ${C.SWITCH_CONFIDENCE}`);
    const gain = u[ev.best] + C.C_SWITCH - u[this.current];   // same convention as policy.js
    this.current = ev.best; this.autoChanges += 1;
    return this._emit(obs, ev.best, "switch", ev,
      `expected gain ${gain.toFixed(3)} > switch cost ${C.C_SWITCH}; P(improvement) ${ev.pImprove.toFixed(2)} >= ${C.SWITCH_CONFIDENCE}`);
  }

  event(name, timestamp = this.clock()) {
    const C = this.C, s = this.live, cur = this.current || "";
    if (name === "skip_detail" && cur.startsWith("detailed")) s.b_d += C.W_IMPLICIT;
    else if (name === "complete_detail") s.a_d += C.W_IMPLICIT;
    else if (name === "replay" && cur.startsWith("brief")) s.a_d += C.W_IMPLICIT;
    else if (name === "request_more") s.a_d += C.W_EXPLICIT;
    else if (name === "dwell_long") s.a_d += C.W_DWELL;
    else if (name === "left_early") s.b_d += C.W_DWELL;
    else if (name.startsWith("override:")) {
      const nw = name.split(":")[1];
      if (cur.endsWith("audio") && nw.endsWith("text")) s.b_a += C.W_EXPLICIT;
      if (cur.endsWith("text") && nw.endsWith("audio")) s.a_a += C.W_EXPLICIT;
      if (cur.startsWith("detailed") && nw.startsWith("brief")) s.b_d += C.W_EXPLICIT;
      if (cur.startsWith("brief") && nw.startsWith("detailed")) s.a_d += C.W_EXPLICIT;
      this.current = nw; this.locked = true;
      return this._emit({ timestamp, artwork_id: this.artwork, tracking_valid: true }, nw, "override", null, "manual override by user");
    }
    this.log.push({ timestamp, artwork_id: this.artwork || "-", event: name,
      belief: { a_d: r4(s.a_d), b_d: r4(s.b_d), a_a: r4(s.a_a), b_a: r4(s.b_a) } });
    return null;
  }
}

export { ACTIONS };
