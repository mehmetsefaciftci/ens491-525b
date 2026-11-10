// Explainable expected-utility policy + session timing rules.
// Line-by-line port of the Python prototype (ca_guide/config.py, policy.py, runtime.py).
// Parity with Python is checked by test/parity.test.mjs on the same 20 scenarios.
//
// U(a|s) = I(a,k) + B(a,h) - D(a,x) - C_optional(a,p,q) - c_switch(a) - R_uncertainty(a,s)
//
// Tags: [P] stated in the draft proposal, [D] derived from proposal numbers,
//       [N] new provisional value (to be agreed with the supervisor / tuned in the pilot).

export const ACTIONS = ["brief_text", "detailed_text", "brief_audio", "detailed_audio"];

export function defaultConfig() {
  const TEXT_MULT = 1.30;                       // [P]
  const D_TEXT = { brief: 0.10, detailed: 0.52 }; // [P] Appendix A worked example
  return {
    I_BRIEF: 0.50,                              // [P]
    I_DETAILED: 1.00,                           // [P]
    FAMILIARITY_DETAIL_PENALTY_MAX: 0.10,       // [N]
    TEXT_MULT,
    AUDIO_MULT_QUIET: 1.00,                     // [P]
    AUDIO_MULT_NOISY: 2.20,                     // [P]
    D_BASE: { brief: D_TEXT.brief / TEXT_MULT, detailed: D_TEXT.detailed / TEXT_MULT }, // [D]
    NOISY_THRESHOLD_DBA: 60.0,                  // [N]
    C_LOW:  { brief_text: 0.19, detailed_text: 0.30, brief_audio: 0.18, detailed_audio: 0.35 }, // [P]
    C_HIGH: { brief_text: 0.35, detailed_text: 1.16, brief_audio: 0.35, detailed_audio: 1.15 }, // [P]
    B_STEP: 0.15,                               // [P]
    SKIPS_FOR_PENALTY: 2,                       // [P]
    AUDIO_OVERRIDE_PENALTY: 0.15,               // [N]
    OVERRIDES_FOR_PENALTY: 2,                   // [N]
    B_BOUND: 0.30,                              // [N]
    C_SWITCH: 0.05,                             // [N]
    R_NOISE_UNKNOWN: 0.05,                      // [N]
    MAX_AUTO_CHANGES_PER_ARTWORK: 1,            // [P]
  };
}

export function newUserState(over = {}) {
  return {
    prior_knowledge: 0.5,
    familiarity: 4,
    format_preference: null,
    accessibility: [],          // "no_audio" | "no_text"
    detail_skip_streak: 0,
    b_detailed: 0.0,
    audio_to_text_overrides: 0,
    replays: 0,
    overrides: [],
    p_high: null,
    ...over,
  };
}

const clone = (o) => JSON.parse(JSON.stringify(o));
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const r4 = (v) => Math.round(v * 1e4) / 1e4;

export function feasibleActions(state) {
  let acts = [...ACTIONS];
  if (state.accessibility.includes("no_audio")) acts = acts.filter((a) => !a.endsWith("audio"));
  if (state.accessibility.includes("no_text")) acts = acts.filter((a) => !a.endsWith("text"));
  return acts;
}

function infoValue(C, a, state) {
  if (a.startsWith("brief")) return C.I_BRIEF;
  const over = Math.max(0, state.familiarity - 4) / 3.0;
  return C.I_DETAILED - C.FAMILIARITY_DETAIL_PENALTY_MAX * over;
}

function behaviourTerm(C, a, state, useHistory) {
  if (!useHistory) return 0.0;
  let b = 0.0;
  if (a.startsWith("detailed")) b += state.b_detailed;
  if (a.endsWith("audio") && state.audio_to_text_overrides >= C.OVERRIDES_FOR_PENALTY) b -= C.AUDIO_OVERRIDE_PENALTY;
  return clamp(b, -C.B_BOUND, C.B_BOUND);
}

export function isNoisy(C, noiseDba) {
  return noiseDba == null ? null : noiseDba > C.NOISY_THRESHOLD_DBA;
}

function modalityMult(C, a, noisy) {
  if (a.endsWith("text")) return C.TEXT_MULT;
  return noisy ? C.AUDIO_MULT_NOISY : C.AUDIO_MULT_QUIET;
}

function contextCost(C, a, noisy) {
  return C.D_BASE[a.split("_")[0]] * modalityMult(C, a, noisy);
}

function demandCost(C, a, noisy, p) {
  return modalityMult(C, a, noisy) * ((1 - p) * C.C_LOW[a] + p * C.C_HIGH[a]);
}

// Returns {utils, terms, flags}. `terms` breaks each utility into its parts for the explanation panel.
export function utilities(C, state, noiseDba, current, useHistory = true) {
  const noisy = isNoisy(C, noiseDba);
  const flags = [];
  if (noisy === null) flags.push("noise_unknown");
  const validated = state.p_high != null;
  flags.push(validated ? "p_high_valid" : "p_high_unknown");
  const utils = {}, terms = {};
  for (const a of feasibleActions(state)) {
    const I = infoValue(C, a, state);
    const B = behaviourTerm(C, a, state, useHistory);
    const D = validated ? demandCost(C, a, noisy, state.p_high) : contextCost(C, a, noisy);
    const S = current != null && a !== current ? C.C_SWITCH : 0;
    const R = noisy === null && a.endsWith("audio") ? C.R_NOISE_UNKNOWN : 0;
    utils[a] = I + B - D - S - R;
    terms[a] = { I, B, D, S, R };
  }
  return { utils, terms, flags };
}

const argmax = (o) => Object.keys(o).reduce((b, k) => (o[k] > o[b] ? k : b));

// Session runtime: decision timing rules (proposal Section 3, item 5).
export class Session {
  constructor(user, { useHistory = true, config = defaultConfig(), clock = () => Date.now() / 1000 } = {}) {
    this.C = config;
    this.live = clone(user);
    this.frozen = clone(user);
    this.useHistory = useHistory;
    this.clock = clock;
    this.artwork = null;
    this.current = null;
    this.autoChanges = 0;
    this.locked = false;
    this.lastNoiseKnown = false;
    this.log = [];
    this.lastUtils = null;
  }

  _stateFor(obs) {
    const s = clone(this.frozen);
    const f = obs.optional_sensor_features || {};
    s.p_high = (obs.quality_flags || []).includes("p_high_validated") ? f.p_high ?? null : null;
    return s;
  }

  _emit(obs, action, kind, res, reason) {
    const d = {
      timestamp: obs.timestamp, artwork_id: obs.artwork_id || "-", action, keep_or_switch: kind,
      utility_by_action: Object.fromEntries(Object.entries(res.utils || {}).map(([k, v]) => [k, r4(v)])),
      reason, flags: res.flags || [], noise_dba: obs.noise_or_missing ?? null,
    };
    if (action) { d.modality = action.split("_")[1]; d.density = action.split("_")[0]; }
    this.log.push(d);
    this.lastUtils = res;
    return d;
  }

  _noDecision(obs, reason) {
    this.log.push({ timestamp: obs.timestamp, artwork_id: obs.artwork_id || "-", action: null, keep_or_switch: "none", reason });
    return null;
  }

  recognize(obs) {
    if (!obs.tracking_valid || obs.artwork_id == null)
      return this._noDecision(obs, "artwork not recognised / tracking invalid: no content shown yet");
    this.frozen = clone(this.live);            // commit behaviour history gathered so far
    this.artwork = obs.artwork_id; this.autoChanges = 0; this.locked = false;
    const res = utilities(this.C, this._stateFor(obs), obs.noise_or_missing, null, this.useHistory);
    const best = argmax(res.utils);
    this.current = best;
    this.lastNoiseKnown = obs.noise_or_missing != null;
    return this._emit(obs, best, "initial", res, `highest utility at recognition (${res.utils[best].toFixed(3)})`);
  }

  boundary(obs) {
    if (this.current == null) return this._noDecision(obs, "no current content");
    const C = this.C;
    const res = utilities(C, this._stateFor(obs), obs.noise_or_missing, this.current, this.useHistory);
    const u = res.utils;
    const noiseKnown = obs.noise_or_missing != null;
    const dropped = this.lastNoiseKnown && !noiseKnown;
    this.lastNoiseKnown = noiseKnown || this.lastNoiseKnown;
    const keep = (r) => this._emit(obs, this.current, "keep", res, r);
    if (!obs.tracking_valid) return keep("tracking lost: keep current");
    if (this.locked) return keep("manual override wins for this artwork");
    if (this.autoChanges >= C.MAX_AUTO_CHANGES_PER_ARTWORK) return keep("automatic-change limit for this artwork reached");
    if (dropped) return keep("noise channel dropped: insufficient evidence to change");
    const best = argmax(u);
    if (best !== this.current && u[best] > u[this.current]) {
      const gain = u[best] + C.C_SWITCH - u[this.current];
      this.current = best; this.autoChanges += 1;
      return this._emit(obs, best, "switch", res, `gain ${gain.toFixed(3)} > switch cost ${C.C_SWITCH}`);
    }
    if (best === this.current) return keep("current action still has highest utility");
    const gain = u[best] + C.C_SWITCH - u[this.current];
    return keep(`gain ${gain.toFixed(3)} <= switch cost ${C.C_SWITCH}`);
  }

  event(name, timestamp = this.clock()) {
    const C = this.C, s = this.live, cur = this.current || "";
    if (name === "skip_detail" && cur.startsWith("detailed")) {
      s.detail_skip_streak += 1;
      if (s.detail_skip_streak >= C.SKIPS_FOR_PENALTY) { s.b_detailed -= C.B_STEP; s.detail_skip_streak = 0; }
    } else if (name === "complete_detail") {
      s.detail_skip_streak = 0;
    } else if (name === "replay") {
      s.replays += 1;
      if (cur.startsWith("brief")) s.b_detailed += C.B_STEP;
    } else if (name === "request_more") {
      s.b_detailed += C.B_STEP;
    } else if (name.startsWith("override:")) {
      const nw = name.split(":")[1];
      if (cur.endsWith("audio") && nw.endsWith("text")) s.audio_to_text_overrides += 1;
      s.overrides.push(nw);
      this.current = nw; this.locked = true;
      return this._emit({ timestamp, artwork_id: this.artwork, tracking_valid: true }, nw, "override", {}, "manual override by user");
    }
    s.b_detailed = clamp(s.b_detailed, -C.B_BOUND, C.B_BOUND);
    this.log.push({ timestamp, artwork_id: this.artwork || "-", event: name, b_detailed: r4(s.b_detailed) });
    return null;
  }
}
