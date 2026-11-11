// Unit tests for the information filter, the non-adaptive comparator and the study logic.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { selectSegments } from "../src/filter.js";
import { FixedSession } from "../src/policy-fixed.js";
import { blockOrder, assignArtworks, susScore, scoreRecall, practicePrior } from "../src/study.js";
import { LoadEstimator } from "../src/load.js";

const art = JSON.parse(readFileSync(new URL("../content/artworks.json", import.meta.url), "utf8")).artworks[0];
const ids = (r) => r.segments.map((s) => s.id).join(",");
let n = 0; const t = (name, fn) => { fn(); n++; console.log("pass  " + name); };

t("brief shows core only", () => assert.equal(ids(selectSegments(art, "brief_text")), "c1,c2"));
t("detailed shows core + all optional", () => assert.equal(ids(selectSegments(art, "detailed_text")), "c1,c2,d1,d2,d3"));
t("known facts are filtered with a reason", () => {
  const r = selectSegments(art, "detailed_audio", { known: ["setting"] });
  assert.equal(ids(r), "c1,c2,d2,d3"); assert.match(r.filtered[0].reason, /already knows: setting/); });
t("walking keeps the top-priority optional fact", () => assert.equal(ids(selectSegments(art, "detailed_text", { pMoving: 0.9 })), "c1,c2,d2"));
t("noisy audio is shortened, noisy text is not", () => {
  assert.equal(ids(selectSegments(art, "detailed_audio", { pNoisy: 0.8 })), "c1,c2,d2");
  assert.equal(ids(selectSegments(art, "detailed_text", { pNoisy: 0.8 })), "c1,c2,d1,d2,d3"); });
t("core facts are never filtered", () => assert.equal(ids(selectSegments(art, "detailed_audio", { known: ["setting", "interpretation", "collection"], pMoving: 1 })), "c1,c2"));

t("fixed comparator keeps the stated format", () => {
  const s = new FixedSession({ format_preference: "brief_audio" });
  assert.equal(s.recognize({ timestamp: 1, artwork_id: "A", tracking_valid: true, noise_or_missing: 75 }).action, "brief_audio");
  assert.equal(s.boundary({ timestamp: 2, artwork_id: "A", tracking_valid: true, noise_or_missing: 80 }).keep_or_switch, "keep"); });
t("fixed comparator: override lasts one artwork", () => {
  const s = new FixedSession({ format_preference: "detailed_audio" });
  s.recognize({ timestamp: 1, artwork_id: "A", tracking_valid: true });
  assert.equal(s.event("override:brief_text", 2).action, "brief_text");
  assert.equal(s.recognize({ timestamp: 3, artwork_id: "B", tracking_valid: true }).action, "detailed_audio"); });
t("fixed comparator respects an audio-only constraint", () =>
  assert.equal(new FixedSession({ format_preference: "detailed_text", accessibility: ["no_text"] }).fixed, "detailed_audio"));

t("four counterbalanced orders, systems contiguous", () => {
  const seen = new Set();
  for (let p = 0; p < 4; p++) { const o = blockOrder(p); seen.add(o.map((b) => b.system[0] + b.room[0]).join(""));
    assert.equal(o[0].system, o[1].system); assert.equal(o[2].system, o[3].system); assert.notEqual(o[0].room, o[1].room); }
  assert.equal(seen.size, 4); });
t("artwork rotation: 8 artworks, each seen once per participant, each in every block across participants", () => {
  const A = ["a", "b", "c", "d", "e", "f", "g", "h"];
  for (let p = 0; p < 4; p++) assert.equal(new Set(assignArtworks(A, p).flat()).size, 8);
  const blocksOfA = new Set([0, 1, 2, 3].map((p) => assignArtworks(A, p).findIndex((b) => b.includes("a"))));
  assert.equal(blocksOfA.size, 4); });
t("SUS scoring", () => { assert.equal(susScore([5, 1, 5, 1, 5, 1, 5, 1, 5, 1]), 100); assert.equal(susScore([3, 3, 3, 3, 3, 3, 3, 3, 3, 3]), 50); assert.equal(susScore([1, 2]), null); });
t("recall scoring with alternatives and Turkish input", () => {
  const q = art.recall;
  assert.ok(scoreRecall("Osman Hamdi Bey, 1906", q[0].keywords));
  assert.ok(!scoreRecall("Osman Hamdi", q[0].keywords));
  assert.ok(scoreRecall("bir NEY", q[1].keywords));
  assert.ok(scoreRecall("beş", q[2].keywords));
  assert.ok(scoreRecall("Bursa Yeşil Cami", q[3].keywords));
  assert.ok(!scoreRecall("Topkapı", q[4].keywords)); });
t("load: no evidence stays near the prior", () => assert.ok(Math.abs(new LoadEstimator().pHigh() - 0.168) < 0.01));
t("load: slow reading, replays and a step-down raise P(high load)", () => {
  const L = new LoadEstimator(); const base = L.pHigh();
  L.segmentRead("one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen", 15);
  L.replay(); L.stepDown("detailed_text", "brief_text");
  assert.ok(L.pHigh() > 0.6 && L.pHigh() > base, `got ${L.pHigh()}`); });
t("load: fast reading (skimming) is not load", () => { const L = new LoadEstimator(); L.segmentRead("a b c d e f g h i j", 1); assert.ok(L.pHigh() < 0.2); });
t("load: evidence decays at a new artwork", () => { const L = new LoadEstimator(); L.replay(); L.replay(); const p1 = L.pHigh(); L.newArtwork(); assert.ok(L.pHigh() < p1); });
t("load: walking and noise while listening add load", () => { const L = new LoadEstimator(); L.context({ pMoving: 1, pNoisy: 1, audio: true }); assert.ok(L.pHigh() > 0.4); });
t("practice prior: finishing detailed audio and abandoning text -> detail and audio", () => {
  const p = practicePrior([{ format: "detailed_audio", ratio: 1.0, completed: true }, { format: "brief_text", ratio: 0.2, completed: false }]);
  assert.ok(p.a_d > p.b_d && p.a_a > p.b_a, JSON.stringify(p)); });
t("practice prior: abandoning detailed and reading brief text fully -> brief and text", () => {
  const p = practicePrior([{ format: "detailed_audio", ratio: 0.2, completed: false }, { format: "brief_text", ratio: 1.2, completed: true }]);
  assert.ok(p.b_d > p.a_d && p.b_a > p.a_a, JSON.stringify(p)); });
t("practice prior: capped", () => {
  const many = Array.from({ length: 20 }, () => ({ format: "detailed_audio", ratio: 1, completed: true }));
  const p = practicePrior(many); assert.ok(p.a_d <= 2 && p.a_a <= 2); });
console.log(`\n${n} unit tests pass.`);
