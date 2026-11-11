// Fitting the behavioural load estimate to labelled data (pure functions, unit-tested).
// Protocol after Fridman et al. 2018 and Pluisch et al. 2025: labels come from a controlled load
// manipulation (0-back = low, 2-back = high) and, secondarily, from questionnaires; the model is
// evaluated participant-independently (leave-one-subject-out), so the reported accuracy is for an
// unseen visitor.

export const FEATURES = ["pace", "replay", "stepdown", "hesitate", "walking", "noise_audio"];

// L2-regularised logistic regression by gradient descent. X: rows of FEATURES, y: 0/1.
export function fitLogistic(X, y, { l2 = 0.1, lr = 0.2, iters = 3000 } = {}) {
  const d = X[0].length; let w = new Array(d).fill(0), b = 0;
  const n = X.length;
  for (let it = 0; it < iters; it++) {
    const gw = new Array(d).fill(0); let gb = 0;
    for (let i = 0; i < n; i++) {
      const z = b + X[i].reduce((s, x, k) => s + x * w[k], 0), p = 1 / (1 + Math.exp(-z)), e = p - y[i];
      for (let k = 0; k < d; k++) gw[k] += e * X[i][k];
      gb += e;
    }
    for (let k = 0; k < d; k++) w[k] -= lr * (gw[k] / n + l2 * w[k]);
    b -= lr * gb / n;
  }
  return { w, b };
}
export const predict = (m, x) => 1 / (1 + Math.exp(-(m.b + x.reduce((s, v, k) => s + v * m.w[k], 0))));

export function balancedAccuracy(y, p, thr = 0.5) {
  let tp = 0, tn = 0, P = 0, N = 0;
  y.forEach((t, i) => { if (t) { P++; if (p[i] >= thr) tp++; } else { N++; if (p[i] < thr) tn++; } });
  return P && N ? (tp / P + tn / N) / 2 : null;
}
export function auc(y, p) {
  const pos = p.filter((_, i) => y[i]), neg = p.filter((_, i) => !y[i]);
  if (!pos.length || !neg.length) return null;
  let s = 0; for (const a of pos) for (const c of neg) s += a > c ? 1 : a === c ? 0.5 : 0;
  return s / (pos.length * neg.length);
}

// samples: [{ participant, x: [..FEATURES], y }]. Returns held-out predictions and metrics.
export function leaveOneSubjectOut(samples, opts) {
  const parts = [...new Set(samples.map((s) => s.participant))];
  const yy = [], pp = [];
  for (const P of parts) {
    const train = samples.filter((s) => s.participant !== P), test = samples.filter((s) => s.participant === P);
    if (!train.length || new Set(train.map((s) => s.y)).size < 2) continue;
    const m = fitLogistic(train.map((s) => s.x), train.map((s) => s.y), opts);
    for (const s of test) { yy.push(s.y); pp.push(predict(m, s.x)); }
  }
  return { n: yy.length, participants: parts.length, balanced_accuracy: balancedAccuracy(yy, pp), auc: auc(yy, pp) };
}
