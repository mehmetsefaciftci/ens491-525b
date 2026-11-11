// Context-aware information filtering: which content segments a chosen format shows.
//
// The policy chooses modality and density; this layer filters the information itself.
//  - Core segments are never filtered: every format carries the same core facts (QR2), which
//    keeps core-fact recall comparable across conditions.
//  - Optional detail is filtered by user state and context:
//      * facts the visitor reported knowing before the visit are dropped (no redundant detail),
//      * while the visitor is walking, detail is cut to the highest-priority segments,
//      * in a noisy room with audio (e.g. an audio-only visitor) detail is cut the same way,
//        because long audio is the content most likely to be missed.
// Every dropped segment is returned with its reason, so the decision log can explain it.

export const FILTER_DEFAULTS = {
  MOVING_P: 0.5,            // [N] P(moving) above which detail is shortened
  NOISY_P: 0.5,             // [N] P(noisy) above which audio detail is shortened
  MAX_OPTIONAL_SHORT: 1,    // [N] optional segments kept when shortened
};

export function selectSegments(art, action, { known = [], pMoving = 0, pNoisy = 0 } = {}, cfg = FILTER_DEFAULTS) {
  const segments = [...art.core];
  const filtered = [];
  if (!action || !action.startsWith("detailed")) return { segments, filtered };
  let optional = [];
  for (const s of art.detail) {
    if (s.tag && known.includes(s.tag)) filtered.push({ id: s.id, reason: `visitor already knows: ${s.tag}` });
    else optional.push(s);
  }
  const shorten = pMoving > cfg.MOVING_P ? "walking" : action.endsWith("audio") && pNoisy > cfg.NOISY_P ? "noisy room, audio" : null;
  if (shorten && optional.length > cfg.MAX_OPTIONAL_SHORT) {
    const ranked = [...optional].sort((a, b) => (a.priority ?? 9) - (b.priority ?? 9));
    const keep = new Set(ranked.slice(0, cfg.MAX_OPTIONAL_SHORT).map((s) => s.id));
    for (const s of optional) if (!keep.has(s.id)) filtered.push({ id: s.id, reason: `${shorten}: shortened to top ${cfg.MAX_OPTIONAL_SHORT}` });
    optional = optional.filter((s) => keep.has(s.id));
  }
  return { segments: segments.concat(optional), filtered };
}
