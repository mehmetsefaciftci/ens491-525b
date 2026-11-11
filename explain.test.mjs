// Visitor-facing reasons and question parity (01_Plan sections 1 and 4).
import assert from "node:assert/strict";
import { visitorReason, ParitySchedule, NEUTRAL_QUESTION } from "../src/explain.js";
import { FixedSession } from "../src/policy-fixed.js";

let n = 0;
const t = (name, fn) => { fn(); n++; console.log(`ok - ${name}`); };

t("noise switch audio -> text is explained and can be undone", () => {
  const r = visitorReason("detailed_audio", { action: "detailed_text", keep_or_switch: "switch", p_noisy: 0.9, belief: { detail_mean: 0.5 } });
  assert.match(r.text, /noisy/); assert.equal(r.undo, "detailed_audio");
});
t("density switch after skips names the skips", () => {
  const r = visitorReason("detailed_text", { action: "brief_text", keep_or_switch: "switch", p_noisy: 0.2, belief: { detail_mean: 0.3 } });
  assert.match(r.text, /skipped detail/); assert.equal(r.undo, "detailed_text");
});
t("switch to audio after split attention names it", () => {
  const r = visitorReason("brief_text", { action: "brief_audio", keep_or_switch: "switch", p_noisy: 0.2 }, { splitAttention: true });
  assert.match(r.text, /looked away/);
});
t("no unsupported cause is invented", () => {
  const r = visitorReason("brief_text", { action: "brief_audio", keep_or_switch: "switch", p_noisy: null });
  assert.match(r.text, /fits best/);
});
t("keeps and missing decisions get no line", () => {
  assert.equal(visitorReason("brief_text", { action: "brief_text", keep_or_switch: "keep" }), null);
  assert.equal(visitorReason(null, null), null);
});
t("initial choice is explained without undo", () => {
  const r = visitorReason(null, { action: "detailed_text", keep_or_switch: "initial", p_noisy: 0.8 });
  assert.match(r.text, /Picked for you/); assert.equal(r.undo, null);
});
t("parity: default schedule when the fixed arm runs first", () => {
  const p = new ParitySchedule({ maxQuestions: 2 });
  assert.deepEqual(p.positions(), [0, 1]); assert.match(p.source(), /default/);
});
t("parity: yoked to the adaptive arm when it ran first, capped", () => {
  const p = new ParitySchedule({ maxQuestions: 2 });
  p.recordAdaptive([1, 3, 5]);
  assert.deepEqual(p.positions(), [1, 3]); assert.ok(p.shouldAsk(3)); assert.ok(!p.shouldAsk(0));
});
t("parity: the neutral answer never changes the fixed arm's format", () => {
  const s = new FixedSession({ format_preference: "brief_audio" }, { clock: () => 0 });
  const obs = (id) => ({ timestamp: 0, artwork_id: id, tracking_valid: true, noise_or_missing: 70, quality_flags: [] });
  const d1 = s.recognize(obs("A1"));
  for (const [v] of NEUTRAL_QUESTION.options) s.event?.(`answer:${v}`, 0);   // even if forwarded by mistake
  const d2 = s.recognize(obs("A2"));
  assert.equal(d1.action, d2.action);
});
console.log(`explain: ${n}/${n} passed`);
