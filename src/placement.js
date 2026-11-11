// Where to place the content panel, as a small optimisation (after Lindlbauer et al. 2019, who
// choose what to show and where in MR by optimising a cost). Candidates are positions around the
// tracked painting; each is scored on screen visibility, closeness to the painting (spatial
// contiguity, Mayer 2009) and how much of the painting it covers. If no anchored candidate is
// visible enough, the panel is pinned to the screen. Hysteresis avoids flicker.
//
// Input rects are in screen pixels: { x, y, w, h } (top-left origin).

export const PLACEMENT_DEFAULTS = {
  MIN_VISIBLE: 0.85,        // [N] an anchored placement must show at least this share of the panel
  W_DISTANCE: 0.15,         // [N] penalty per panel-diagonal of distance to the painting
  W_OCCLUDE: 0.6,           // [N] penalty per share of the painting covered by the panel
  KEEP_MARGIN: 0.1,         // [N] switch only if the new score is this much better
  MAX_OCCLUDE: 0.5,         // [N] never cover more than half of the painting
};

const area = (r) => Math.max(0, r.w) * Math.max(0, r.h);
export function intersect(a, b) {
  const x = Math.max(a.x, b.x), y = Math.max(a.y, b.y);
  const w = Math.min(a.x + a.w, b.x + b.w) - x, h = Math.min(a.y + a.h, b.y + b.h) - y;
  return w > 0 && h > 0 ? { x, y, w, h } : { x, y, w: 0, h: 0 };
}
function gap(a, b) {               // distance between rectangle edges (0 if they touch or overlap)
  const dx = Math.max(0, Math.max(a.x, b.x) - Math.min(a.x + a.w, b.x + b.w));
  const dy = Math.max(0, Math.max(a.y, b.y) - Math.min(a.y + a.h, b.y + b.h));
  return Math.hypot(dx, dy);
}

export function scorePlacement(panel, art, viewport, cfg = PLACEMENT_DEFAULTS) {
  const visible = area(panel) ? area(intersect(panel, viewport)) / area(panel) : 0;
  const diag = Math.hypot(panel.w, panel.h) || 1;
  const distance = gap(panel, art) / diag;
  const occluded = area(art) ? area(intersect(panel, art)) / area(art) : 0;
  const score = visible - cfg.W_DISTANCE * distance - cfg.W_OCCLUDE * occluded;
  return { visible, distance, occluded, score };
}

// candidates: [{ name, rect }], current: name or "pinned". Returns { choice, scores, reason }.
export function choosePlacement(candidates, art, viewport, current = null, cfg = PLACEMENT_DEFAULTS) {
  const scores = candidates.map((c) => ({ name: c.name, ...scorePlacement(c.rect, art, viewport, cfg) }));
  const ok = scores.filter((s) => s.visible >= cfg.MIN_VISIBLE && s.occluded <= cfg.MAX_OCCLUDE).sort((a, b) => b.score - a.score);
  if (!ok.length) return { choice: "pinned", scores, reason: "no anchored position keeps the panel on screen" };
  const best = ok[0];
  const cur = ok.find((s) => s.name === current);
  if (cur && best.score - cur.score < cfg.KEEP_MARGIN) return { choice: cur.name, scores, reason: "current position still good (hysteresis)" };
  return { choice: best.name, scores, reason: `best score ${best.score.toFixed(2)} (visible ${(best.visible * 100).toFixed(0)}%)` };
}
