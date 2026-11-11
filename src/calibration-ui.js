// Pilot-only load calibration (?calib=1), after Mehler et al. 2012: the participant reads a short
// text while hearing a digit every 2.5 s. Low load = 0-back (tap when you hear "three"); high
// load = 2-back (tap when the digit equals the one two before). The reading behaviour recorded by
// the load estimator becomes a labelled sample (0 / 1) for tools/fit-load.mjs; n-back accuracy and
// a Paas rating check that the manipulation worked.
import { LoadEstimator } from "./load.js";

const TEXTS = {
  a: ["Public museums opened across Europe in the eighteenth century, when royal and private collections began to admit paying or invited visitors.",
      "Early displays covered every wall from floor to ceiling, so visitors had to choose for themselves which works deserved attention.",
      "In the nineteenth century curators started to hang fewer works at eye level and to add printed labels with names and dates."],
  b: ["Many painters of the nineteenth century travelled to study the light and buildings of distant cities before returning to their studios.",
      "They filled sketchbooks with quick drawings of streets, clothing and objects, and later combined them into large finished canvases.",
      "Because the final pictures were assembled from many studies, a single scene often shows details seen in different places and years."],
};
const STEP_MS = 2500, WINDOW_MS = 2300;

export function runCalibration(api, participantNumber, done) {
  const { $, now } = api;
  const sheet = $("#study");
  const order = participantNumber % 2 ? ["2-back", "0-back"] : ["0-back", "2-back"];
  const results = [];
  const show = (html) => { sheet.innerHTML = html; sheet.classList.remove("hidden"); sheet.scrollTop = 0; };

  function intro(i) {
    const cond = order[i];
    show(`<h1>Reading with digits (${i + 1} of 2)</h1>
      <div class="consent">You will read three short sentences at your own pace and tap <b>Next</b> after each.
      At the same time you will hear a digit every few seconds.<br><br>
      ${cond === "0-back" ? "Tap <b>MATCH</b> whenever you hear the digit <b>three</b>."
        : "Tap <b>MATCH</b> whenever the digit you hear is the <b>same as the one two digits before</b> (for example 4 – 7 – <b>4</b>)."}</div>
      <button id="go" class="primary">Start</button>`);
    $("#go").onclick = () => run(i);
  }

  function run(i) {
    const cond = order[i], texts = TEXTS[i === 0 ? "a" : "b"], L = new LoadEstimator();
    const digits = [], targets = [], taps = [];
    let seg = 0, shownAt = performance.now(), timer = null, stopped = false;
    const speak = (d) => { if ("speechSynthesis" in window) { const u = new SpeechSynthesisUtterance(String(d)); u.lang = "en-US"; speechSynthesis.speak(u); } };
    const nextDigit = () => {
      if (stopped) return;
      const k = digits.length;
      let d, isTarget;
      if (cond === "0-back") { isTarget = Math.random() < 0.3; d = isTarget ? 3 : [1, 2, 4, 5, 6, 7, 8, 9][Math.floor(Math.random() * 8)]; }
      else { isTarget = k >= 2 && Math.random() < 0.3; d = isTarget ? digits[k - 2] : (() => { let x; do x = 1 + Math.floor(Math.random() * 9); while (k >= 2 && x === digits[k - 2]); return x; })(); }
      digits.push(d); targets.push({ t: performance.now(), isTarget, hit: false }); speak(d);
      timer = setTimeout(nextDigit, STEP_MS);
    };
    const render = () => {
      sheet.innerHTML = `<h1>${cond === "0-back" ? "Tap MATCH on “three”" : "Tap MATCH when it matches two back"}</h1>
        <div class="consent" style="font-size:18px">${texts[seg]}</div>
        <div class="scale"><button id="match" class="primary">MATCH</button><button id="next">Next ▸</button></div>`;
      $("#match").onclick = () => {
        const t = performance.now(), last = targets[targets.length - 1];
        const ok = last && last.isTarget && !last.hit && t - last.t < WINDOW_MS;
        if (ok) last.hit = true; taps.push({ t, correct: !!ok });
      };
      $("#next").onclick = () => {
        L.segmentRead(texts[seg], (performance.now() - shownAt) / 1000);
        seg++; shownAt = performance.now();
        if (seg < texts.length) render(); else finish();
      };
    };
    const finish = () => {
      stopped = true; clearTimeout(timer); if ("speechSynthesis" in window) speechSynthesis.cancel();
      const nT = targets.filter((x) => x.isTarget).length, hits = targets.filter((x) => x.hit).length;
      const fa = taps.filter((x) => !x.correct).length;
      show(`<h1>How much effort was that?</h1><div class="scale">${Array.from({ length: 9 }, (_, k) => `<label><input type="radio" name="cp" value="${k + 1}" /> ${k + 1}</label>`).join("")}</div>
        <div class="ends"><span>very, very low</span><span>very, very high</span></div><p id="msg" class="msg"></p><button id="go" class="primary">Continue</button>`);
      $("#go").onclick = () => {
        const x = sheet.querySelector("input[name=cp]:checked");
        if (!x) { $("#msg").textContent = "Please choose a rating."; return; }
        results.push({ condition: cond, label: cond === "2-back" ? 1 : 0, features: L.features(), pace: L.trace.filter((e) => e.kind === "pace").map((e) => e.ratio),
          nback: { digits: digits.length, targets: nT, hits, misses: nT - hits, false_alarms: fa }, paas: +x.value, t: now() });
        if (i + 1 < order.length) intro(i + 1); else done(results);
      };
    };
    render(); timer = setTimeout(nextDigit, 800);
  }

  intro(0);
}
