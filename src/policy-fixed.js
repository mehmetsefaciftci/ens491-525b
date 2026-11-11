// Non-adaptive comparator for the controlled study: the format the participant chose on the
// practice artwork, kept for every artwork. Manual override still works within an artwork
// (both study arms keep the same controls) but is not carried to the next artwork.
// Same interface as Session (policy.js) and BayesSession (policy-bayes.js).
import { ACTIONS, feasibleActions } from "./policy.js";

export class FixedSession {
  constructor(user, { clock = () => Date.now() / 1000 } = {}) {
    this.live = { familiarity: 4, accessibility: [], ...user };
    this.frozen = this.live;
    const feasible = feasibleActions(this.live);
    const pref = user.format_preference;
    // An infeasible stated choice (e.g. text for an audio-only visitor) keeps its density.
    this.fixed = feasible.includes(pref) ? pref
      : feasible.find((a) => pref && a.startsWith(pref.split("_")[0])) || feasible[0];
    this.clock = clock; this.useHistory = false;
    this.artwork = null; this.current = null; this.locked = false; this.log = []; this.lastUtils = null;
  }
  _emit(obs, action, kind, reason) {
    const d = { timestamp: obs.timestamp, artwork_id: obs.artwork_id || "-", action, keep_or_switch: kind,
      utility_by_action: {}, reason, flags: ["non_adaptive"], noise_dba: obs.noise_or_missing ?? null, policy: "fixed" };
    if (action) { d.modality = action.split("_")[1]; d.density = action.split("_")[0]; }
    this.log.push(d); return d;
  }
  recognize(obs) {
    if (!obs.tracking_valid || obs.artwork_id == null) {
      this.log.push({ timestamp: obs.timestamp, artwork_id: obs.artwork_id || "-", action: null, keep_or_switch: "none", reason: "artwork not recognised" });
      return null;
    }
    this.artwork = obs.artwork_id; this.current = this.fixed; this.locked = false;
    return this._emit(obs, this.fixed, "initial", "fixed condition: the participant's own choice");
  }
  boundary(obs) {
    if (this.current == null) return null;
    return this._emit(obs, this.current, "keep", this.locked ? "manual override wins for this artwork" : "fixed condition: no adaptation");
  }
  event(name, timestamp = this.clock()) {
    if (name.startsWith("override:")) {
      this.current = name.split(":")[1]; this.locked = true;
      return this._emit({ timestamp, artwork_id: this.artwork, tracking_valid: true }, this.current, "override", "manual override by user");
    }
    this.log.push({ timestamp, artwork_id: this.artwork || "-", event: name });
    return null;
  }
}

export { ACTIONS };
