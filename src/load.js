// Behavioural estimate of cognitive load, without cameras or physiological sensors.
//
// P(high load) = logistic(z), z = B0 + sum of evidence terms:
//   reading pace     time on a text segment / expected reading time; reading much slower than
//                    expected suggests effort (very fast reading is skimming, not load)
//   replays          replaying content the visitor has just seen
//   step-downs       manual overrides from detailed to brief, or from audio to text in noise
//   hesitation       long gaps before acting after a segment ends (audio)
//   environment      walking, and noise while listening, add extraneous load
// Evidence decays per artwork. The weights are provisional [N]; the study validates the
// estimate against Raw NASA-TLX mental demand and Paas effort after every block
// (tools/analyze-study.mjs reports the correlation). It is a proxy, never a diagnosis.

export const LOAD_DEFAULTS = {
  B0: -1.6,                  // [N] prior log-odds: P(high) about 0.17 with no evidence
  W_PACE: 1.2,               // [N] per unit of (pace ratio - 1) above 1, capped at 2 units
  W_REPLAY: 0.6,             // [N] per replay
  W_STEPDOWN: 0.9,           // [N] per manual step-down
  W_HESITATE: 0.4,           // [N] per hesitation longer than HESITATE_S
  W_WALK: 0.6,               // [N] x P(moving)
  W_NOISE_AUDIO: 0.6,        // [N] x P(noisy), only while listening
  HESITATE_S: 6,             // [N]
  WORDS_PER_S: 3.3,          // typical silent reading speed (about 200 words per minute)
  DECAY: 0.6,                // [N] behavioural evidence kept per new artwork
};

export const words = (text) => (text.trim().match(/\S+/g) || []).length;

export class LoadEstimator {
  constructor(cfg = LOAD_DEFAULTS) { this.cfg = cfg; this.e = { pace: 0, replay: 0, stepdown: 0, hesitate: 0 }; this.ctx = { pMoving: 0, pNoisy: 0, audio: false }; this.trace = []; }

  newArtwork() { for (const k in this.e) this.e[k] *= this.cfg.DECAY; }
  context({ pMoving = 0, pNoisy = 0, audio = false } = {}) { this.ctx = { pMoving, pNoisy, audio }; }

  // A text segment of `text` was on screen for `seconds` before the visitor moved on.
  segmentRead(text, seconds) {
    const expected = Math.max(2, words(text) / this.cfg.WORDS_PER_S);
    const ratio = seconds / expected;
    this.e.pace += Math.min(2, Math.max(0, ratio - 1));
    this.trace.push({ kind: "pace", ratio: +ratio.toFixed(2) });
  }
  replay() { this.e.replay += 1; this.trace.push({ kind: "replay" }); }
  stepDown(from, to) {
    const down = (from.startsWith("detailed") && to.startsWith("brief")) || (from.endsWith("audio") && to.endsWith("text") && this.ctx.pNoisy > 0.5);
    if (down) { this.e.stepdown += 1; this.trace.push({ kind: "stepdown", from, to }); }
  }
  hesitation(seconds) { if (seconds > this.cfg.HESITATE_S) { this.e.hesitate += 1; this.trace.push({ kind: "hesitate", s: +seconds.toFixed(1) }); } }

  terms() {
    const c = this.cfg, e = this.e, x = this.ctx;
    return { prior: c.B0, pace: c.W_PACE * e.pace, replay: c.W_REPLAY * e.replay, stepdown: c.W_STEPDOWN * e.stepdown,
      hesitate: c.W_HESITATE * e.hesitate, walking: c.W_WALK * x.pMoving, noise_audio: x.audio ? c.W_NOISE_AUDIO * x.pNoisy : 0 };
  }
  pHigh() {
    const z = Object.values(this.terms()).reduce((s, v) => s + v, 0);
    return 1 / (1 + Math.exp(-z));
  }
}
