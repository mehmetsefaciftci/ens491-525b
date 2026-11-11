// Visitor-facing explanation of automatic decisions (01_Plan section 1: every decision is shown
// to the visitor with a one-line reason; #525: transparency for visitors and accessibility advocates).
// Model layer: DOM-free, runs under Node. The text is derived only from fields the policy already
// logs (action, keep_or_switch, p_noisy, belief) plus the context the app froze for this artwork,
// so the explanation can never disagree with the decision log.

const NAME = { brief_text: "brief text", detailed_text: "detailed text", brief_audio: "brief audio", detailed_audio: "detailed audio" };

export const EXPLAIN_DEFAULTS = {
  P_NOISY: 0.5,        // [N] p_noisy above this is reported as "the room seems noisy"
  P_MOVING: 0.5,       // [N] p_moving above this is reported as "you seem to be walking"
  DETAIL_LOW: 0.45,    // [N] belief that the visitor wants detail, below this = "you skipped detail"
  DETAIL_HIGH: 0.55,   // [N] above this = "you asked for more detail"
};

function modalityCause(to, d, ctx, cfg) {
  if (to === "text") return (d.p_noisy ?? 0) > cfg.P_NOISY ? "the room seems noisy" : null;
  if (ctx.splitAttention) return "you looked away from the painting while reading";
  if ((ctx.pMoving ?? 0) > cfg.P_MOVING) return "you seem to be walking";
  if (d.p_noisy != null && d.p_noisy <= cfg.P_NOISY) return "the room is quiet";
  return null;
}

function densityCause(to, d, cfg) {
  const m = d.belief?.detail_mean;
  if (m == null) return null;
  if (to === "brief" && m < cfg.DETAIL_LOW) return "you skipped detail earlier";
  if (to === "detailed" && m > cfg.DETAIL_HIGH) return "you asked for more detail earlier";
  return null;
}

// prev: the action shown before this decision (null on recognition). d: a policy decision.
// ctx: { splitAttention, pMoving }. Returns { text, undo } or null when nothing should be shown.
// Only automatic choices are explained: keeps and manual overrides get no line.
export function visitorReason(prev, d, ctx = {}, cfg = EXPLAIN_DEFAULTS) {
  if (!d || !d.action) return null;
  const kind = d.keep_or_switch;
  if (kind !== "switch" && kind !== "initial") return null;
  const [toDen, toMod] = d.action.split("_");
  const causes = [];
  if (kind === "initial" || !prev) {
    const c = toMod === "text" ? modalityCause("text", d, ctx, cfg) : null;
    if (c) causes.push(c);
    return { text: `Picked for you: ${NAME[d.action]}${causes.length ? ` (${causes.join("; ")})` : ""}. You can change it below.`, undo: null };
  }
  const [fromDen, fromMod] = prev.split("_");
  if (fromMod !== toMod) { const c = modalityCause(toMod, d, ctx, cfg); if (c) causes.push(c); }
  if (fromDen !== toDen) { const c = densityCause(toDen, d, cfg); if (c) causes.push(c); }
  const why = causes.length ? causes.join("; ") : "it now fits best";
  return { text: `Switched to ${NAME[d.action]}: ${why}.`, undo: prev };
}

// Question parity between arms (01_Plan section 4): the fixed arm gets the same number of one-tap
// questions at the same artwork positions, but its answers never change the presentation.
// Positions are yoked to this participant's adaptive arm when it ran first; otherwise a default
// schedule is used (DEFAULT_POSITIONS, capped at maxQuestions). The schedule is logged.
export class ParitySchedule {
  constructor({ maxQuestions = 2, defaultPositions = [0, 1] } = {}) {
    this.max = maxQuestions; this.defaults = defaultPositions; this.adaptive = null;
  }
  recordAdaptive(positions) { this.adaptive = [...positions]; }
  positions() { return (this.adaptive ?? this.defaults).slice(0, this.max); }
  source() { return this.adaptive ? "yoked to this participant's adaptive arm" : "default schedule (adaptive arm not run yet)"; }
  shouldAsk(position) { return this.positions().includes(position); }
}

export const NEUTRAL_QUESTION = {
  id: "interest",
  text: "How interesting did you find this painting?",
  options: [["1", "Not at all"], ["2", "A little"], ["3", "Quite"], ["4", "Very"]],
};
