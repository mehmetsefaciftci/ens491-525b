// Study mode UI (?study=1): consent -> profile -> practice (format choice) -> 4 counterbalanced
// blocks (system x room) with per-artwork interaction time -> Raw NASA-TLX mental demand and Paas
// after each block -> SUS after each system -> core/optional recall -> results file.
// The participant sees the systems as "Guide A" and "Guide B"; the condition names stay in the log.
import { blockOrder, assignArtworks, SUS_ITEMS, susScore, scoreRecall, practicePrior } from "./study.js";
import { words } from "./load.js";
import { runCalibration } from "./calibration-ui.js";

const PER_BLOCK = 2;
// Raw NASA-TLX (Hart 2006): six subscales, 0-100 in steps of 5, unweighted mean.
const TLX = [
  ["mental", "Mental demand", "How mentally demanding was this part?", "very low", "very high"],
  ["physical", "Physical demand", "How physically demanding was this part?", "very low", "very high"],
  ["temporal", "Temporal demand", "How hurried or rushed was the pace?", "very low", "very high"],
  ["performance", "Performance", "How successful were you in taking in the information?", "perfect", "failure"],
  ["effort", "Effort", "How hard did you have to work to reach your level of performance?", "very low", "very high"],
  ["frustration", "Frustration", "How insecure, discouraged, irritated, stressed or annoyed were you?", "very low", "very high"],
];
// Adaptive arm prior: "practice" = inferred from practice behaviour (default, no question used);
// "stated" = the format the participant picked. Set with ?prior=stated. The fixed arm always uses the pick.

const PRACTICE = {
  brief: "Practice painting: a harbour at sunset, painted in oil around 1900.",
  detailed: "Practice painting: a harbour at sunset, painted in oil around 1900. The painter worked outdoors and finished the picture in one evening. Small boats in the foreground show that the harbour was still used for fishing.",
};

export function initStudy(api) {
  const { $, now } = api;
  const PRIOR_MODE = new URLSearchParams(location.search).get("prior") === "stated" ? "stated" : "practice";
  const sheet = $("#study"), bar = $("#studyBar");
  const S = { started_at: new Date().toISOString(), blocks: [], sus: {}, recall: [], sessions: {}, adaptive_prior_mode: PRIOR_MODE };
  let sensorsReady = false, order, artworksPerBlock, guideName = {};

  const show = (html) => { sheet.innerHTML = html; sheet.classList.remove("hidden"); bar.classList.add("hidden"); sheet.scrollTop = 0; };
  const hide = () => sheet.classList.add("hidden");
  const scale = (name, from, to, left, right) => `<div class="scale">${Array.from({ length: to - from + 1 }, (_, i) =>
    `<label><input type="radio" name="${name}" value="${from + i}" /> ${from + i}</label>`).join("")}</div><div class="ends"><span>${left}</span><span>${right}</span></div>`;
  const val = (name) => { const x = sheet.querySelector(`input[name="${name}"]:checked`); return x ? +x.value : null; };

  // ------------------------------------------------------------------ 1. consent
  function consent() {
    show(`<h1>Before we start</h1>
      <div class="consent">You are invited to a study by Sabancı University students Mehmet Sefa Çiftci and Bahar Küçüközer,
      supervised by Selim Balcısoy. You will use this phone to look at reproductions of paintings, read or listen to short
      descriptions, and answer short questionnaires and a few questions about the paintings (about 40 minutes).<br><br>
      The camera is used only to recognise the paintings; no images are stored. The microphone measures only how loud the room
      is; no sound is recorded. Your answers and a log of how you used the guide are stored under a code, not your name.<br><br>
      Taking part is voluntary. You can stop at any time without giving a reason and ask for your data to be deleted.
      Some blocks play recorded museum noise at a comfortable level; tell the experimenter if it is uncomfortable.</div>
      <label><input type="checkbox" id="cOk" /> I have read this information and agree to take part.</label>
      <button id="go" class="primary" disabled>Continue</button>`);
    $("#cOk").onchange = (e) => ($("#go").disabled = !e.target.checked);
    $("#go").onclick = () => { S.consent = { given: true, t: now(), at: new Date().toISOString() }; profile(); };
  }

  // ------------------------------------------------------------------ 2. profile
  function profile() {
    // One painting: ask about its facts. Several paintings: ask which paintings the visitor already knows well.
    const multi = api.content.artworks.length > 1;
    const kn = multi
      ? api.content.artworks.map((a) => `<label><input type="checkbox" name="ka" value="${a.id}" /> ${a.title} (${a.artist})</label>`).join("")
      : (api.art.prior_knowledge || []).map((k) => `<label><input type="checkbox" name="kn" value="${k.tag}" /> ${k.label}</label>`).join("");
    show(`<h1>About you</h1>
      <label>Participant number (from the experimenter) <input type="number" id="pid" min="1" inputmode="numeric" /></label>
      <div class="q">How familiar are you with Ottoman painting? ${scale("fam", 1, 7, "not at all", "very")}</div>
      <details><summary>Accessibility (optional)</summary>
        <p class="fine">Only if you cannot use one of the formats, for example because of hearing or vision. The guide otherwise chooses by itself.</p>
        <label><input type="radio" name="acc" value="" checked /> I can use both text and audio</label>
        <label><input type="radio" name="acc" value="no_audio" /> I need text (cannot use audio)</label>
        <label><input type="radio" name="acc" value="no_text" /> I need audio (cannot read the text)</label></details>
      <fieldset><legend>${multi ? "Paintings I already know well (optional)" : "Before today I already knew… (optional)"}</legend>${kn}</fieldset>
      <p id="msg" class="msg"></p><button id="go" class="primary">Continue</button>`);
    $("#go").onclick = () => {
      const pid = parseInt($("#pid").value, 10), fam = val("fam");
      if (!(pid >= 1) || !fam) { $("#msg").textContent = "Please enter the participant number and answer the familiarity question."; return; }
      const acc = sheet.querySelector("input[name=acc]:checked").value;
      S.participant = { number: pid, familiarity: fam, accessibility: acc ? [acc] : [],
        known: [...sheet.querySelectorAll("input[name=kn]:checked")].map((x) => x.value),
        known_artworks: [...sheet.querySelectorAll("input[name=ka]:checked")].map((x) => x.value) };
      order = blockOrder(pid);
      const ids = Array.from({ length: 4 * PER_BLOCK }, (_, i) => api.content.artworks[i % api.content.artworks.length].id + (api.content.artworks.length < 4 * PER_BLOCK ? `#${i + 1}` : ""));
      artworksPerBlock = assignArtworks(ids, pid, PER_BLOCK);
      guideName = { [order[0].system]: "Guide A", [order[2].system]: "Guide B" };
      S.schedule = order.map((b, i) => ({ ...b, guide: guideName[b.system], artworks: artworksPerBlock[i] }));
      practice();
    };
  }

  // ------------------------------------------------------------------ 3. practice and format choice
  function practice() {
    const acc = S.participant.accessibility;
    const opts = ["brief_text", "detailed_text", "brief_audio", "detailed_audio"]
      .filter((a) => !(acc.includes("no_audio") && a.endsWith("audio")) && !(acc.includes("no_text") && a.endsWith("text")));
    show(`<h1>Practice</h1><p>Try each format, then pick the one you would like to use.</p>
      <div class="scale">${opts.map((a) => `<button data-try="${a}" class="small">Try ${a.replace("_", " ")}</button>`).join("")}</div>
      <div id="sample" class="consent">Tap a format to try it.</div>
      <fieldset><legend>My preferred format</legend>${opts.map((a) => `<label><input type="radio" name="pref" value="${a}" /> ${a.replace("_", " ")}</label>`).join("")}</fieldset>
      <p id="msg" class="msg"></p><button id="go" class="primary">Continue</button>`);
    // Each try is measured: how long a sample stayed on screen or was listened to, against its
    // expected duration, and whether audio played to the end. This is the implicit preference.
    const trials = []; let cur = null;
    const close = () => {
      if (!cur) return;
      const el = (performance.now() - cur.t0) / 1000;
      trials.push({ format: cur.format, seconds: +el.toFixed(2), ratio: +(cur.completed ? Math.max(1, el / cur.expected) : el / cur.expected).toFixed(2), completed: cur.completed });
      cur = null;
    };
    sheet.querySelectorAll("[data-try]").forEach((b) => (b.onclick = () => {
      close();
      const a = b.dataset.try, text = PRACTICE[a.split("_")[0]], aud = a.endsWith("audio");
      if ("speechSynthesis" in window) speechSynthesis.cancel();
      cur = { format: a, t0: performance.now(), expected: Math.max(2, words(text) / (aud ? 2.6 : 3.3)), completed: false };
      const me = cur;
      if (aud && "speechSynthesis" in window) {
        $("#sample").textContent = "🔊 (listening…)";
        const u = new SpeechSynthesisUtterance(text); u.lang = api.content.lang || "en-US";
        u.onend = () => { if (cur === me) { me.completed = true; close(); $("#sample").textContent = "🔊 (finished)"; } };
        speechSynthesis.speak(u);
      } else $("#sample").textContent = text;
    }));
    $("#go").onclick = () => {
      const p = sheet.querySelector("input[name=pref]:checked");
      if (!p) { $("#msg").textContent = "Please choose a format."; return; }
      if ("speechSynthesis" in window) speechSynthesis.cancel();
      close();
      S.participant.format_preference = p.value;
      S.practice_trials = trials;
      S.practice_prior = practicePrior(trials);
      if (new URLSearchParams(location.search).has("calib"))       // pilot only: labelled load calibration
        runCalibration(api, S.participant.number, (res) => { S.calibration = res; blockIntro(0); });
      else blockIntro(0);
    };
  }

  // ------------------------------------------------------------------ 4. blocks
  function blockIntro(b) {
    const blk = order[b];
    show(`<h1>Part ${b + 1} of 4</h1><p>You will use <b>${guideName[blk.system]}</b> with ${PER_BLOCK} paintings. The guide decides by itself how to present each painting; you can always change it with the buttons.</p>
      <details class="fine"><summary>For the experimenter</summary>Room condition: ${blk.room === "noise" ? "start the museum noise recording" : "noise recording off"}. The app measures the room level itself.</details>
      <button id="go" class="primary">Start part ${b + 1}</button>`);
    $("#go").onclick = async () => {
      $("#go").disabled = true;
      if (!sensorsReady) {                       // first tap: camera, microphone, motion (iOS needs a tap)
        try { await api.initSensors(); sensorsReady = true; }
        catch (e) { $("#go").disabled = false; sheet.insertAdjacentHTML("beforeend", `<p class="msg">Could not start: ${e.message || e}</p>`); return; }
      }
      const pp = S.practice_prior || { a_d: 0, b_d: 0, a_a: 0, b_a: 0 };
      const adaptivePractice = blk.system === "adaptive" && PRIOR_MODE === "practice";
      const user = { familiarity: S.participant.familiarity, accessibility: S.participant.accessibility, known: S.participant.known, known_artworks: S.participant.known_artworks,
        format_preference: adaptivePractice ? null : S.participant.format_preference,
        prior: adaptivePractice ? { a_d: 2 + pp.a_d, b_d: 2 + pp.b_d, a_a: 2 + pp.a_a, b_a: 2 + pp.b_a } : null };
      if (!S.sessions[blk.system]) S.sessions[blk.system] = api.beginSystem(blk.system, user);
      else api.setSession(S.sessions[blk.system]);
      api.meta.events.push({ t: now(), e: "block_start", block: b + 1, ...blk });
      S.blocks[b] = { ...blk, guide: guideName[blk.system], artworks: [], started_t: now() };
      hide(); artwork(b, 0);
    };
  }

  function artwork(b, k) {
    const label = `${artworksPerBlock[b][k]}-p${b + 1}`;
    const artId = artworksPerBlock[b][k].replace(/#\d+$/, "");
    const a = api.content.artworks.find((x) => x.id === artId);
    const prompt = `Part ${b + 1}/4 · painting ${k + 1}/${PER_BLOCK}: point the phone at <b>${a ? a.title : "the painting"}</b>.`;
    bar.innerHTML = `<span class="grow">${prompt}</span>`
      + (api.simulateTarget ? `<button id="sim" class="small">Simulate painting</button>` : "");
    bar.classList.remove("hidden");
    if (api.simulateTarget) $("#sim").onclick = api.simulateTarget;
    api.expectArtwork(label, artId, (d) => {
      bar.innerHTML = `<span class="grow">${guideName[order[b].system]} · painting ${k + 1}/${PER_BLOCK}. Tap Done when you have finished with this painting.</span><button id="done" class="primary small">Done</button>`;
      $("#done").onclick = () => {
        const t = api.finishArtwork();
        S.blocks[b].artworks.push({ label, first_format: d?.action ?? null, recognized_t: t.recognized_t, done_t: t.done_t,
          interaction_s: t.recognized_t != null ? +(t.done_t - t.recognized_t).toFixed(2) : null,
          p_load_end: t.p_load_end, load_terms: t.load_terms, load_features: t.load_features });
        if (k + 1 < PER_BLOCK) artwork(b, k + 1); else blockQuestions(b);
      };
    }, (other) => {                           // the camera found a different painting
      bar.querySelector(".grow").innerHTML = `${prompt}<br><small>That is “${other.title}”, not this one.</small>`;
      api.meta.events.push({ t: now(), e: "wrong_artwork", expected: artId, found: other.id });
    });
  }

  function blockQuestions(b) {
    bar.classList.add("hidden");
    show(`<h1>About part ${b + 1}</h1>
      ${TLX.map(([k, name, q, lo, hi]) => `<div class="q"><b>${name}:</b> ${q}
        <input type="range" id="tlx_${k}" min="0" max="100" step="5" value="50" /><div class="ends"><span>${lo}</span><output id="tlxo_${k}">–</output><span>${hi}</span></div></div>`).join("")}
      <div class="q"><b>Mental effort:</b> how much mental effort did you invest? ${scale("paas", 1, 9, "very, very low", "very, very high")}</div>
      <p id="msg" class="msg"></p><button id="go" class="primary">Continue</button>`);
    const moved = new Set();
    for (const [k] of TLX) $(`#tlx_${k}`).oninput = (e) => { moved.add(k); $(`#tlxo_${k}`).textContent = e.target.value; };
    $("#go").onclick = () => {
      const paas = val("paas");
      if (!paas || moved.size < TLX.length) { $("#msg").textContent = "Please set every slider and choose an effort rating."; return; }
      const tlx = Object.fromEntries(TLX.map(([k]) => [k, +$(`#tlx_${k}`).value]));
      const raw_tlx = +(Object.values(tlx).reduce((s, v) => s + v, 0) / TLX.length).toFixed(1);
      Object.assign(S.blocks[b], { tlx, raw_tlx, tlx_mental_demand: tlx.mental, paas, ended_t: now() });
      const sysDone = b % 2 === 1;                      // each system's two parts run back to back
      if (sysDone) sus(b); else blockIntro(b + 1);
    };
  }

  function sus(b) {
    const sys = order[b].system;
    show(`<h1>About ${guideName[sys]}</h1><p>1 = strongly disagree, 5 = strongly agree.</p>
      ${SUS_ITEMS.map((q, i) => `<div class="q">${i + 1}. ${q.replace("this guide", guideName[sys])} ${scale(`sus${i}`, 1, 5, "strongly disagree", "strongly agree")}</div>`).join("")}
      <p id="msg" class="msg"></p><button id="go" class="primary">Continue</button>`);
    $("#go").onclick = () => {
      const ans = SUS_ITEMS.map((_, i) => val(`sus${i}`));
      if (ans.some((a) => a == null)) { $("#msg").textContent = "Please answer all ten statements."; return; }
      S.sus[sys] = { answers: ans, score: susScore(ans), guide: guideName[sys] };
      if (b < 3) blockIntro(b + 1); else recall();
    };
  }

  // ------------------------------------------------------------------ 5. recall
  function recall() {
    const items = api.content.artworks.flatMap((a) => (a.recall || []).map((q) => ({ ...q, artwork: a.id })));
    show(`<h1>What do you remember?</h1><p>Answer briefly. It is fine to leave a question empty.</p>
      ${items.map((q, i) => `<div class="q"><label>${i + 1}. ${q.q}<input type="text" id="r${i}" autocomplete="off" /></label></div>`).join("")}
      <button id="go" class="primary">Finish</button>`);
    $("#go").onclick = () => {
      S.recall = items.map((q, i) => { const answer = $(`#r${i}`).value;
        return { id: q.id, artwork: q.artwork, covers: q.covers, type: q.type, answer, correct_auto: scoreRecall(answer, q.keywords || []) }; });
      finish();
    };
  }

  // ------------------------------------------------------------------ 6. results
  function results() {
    const logs = Object.fromEntries(Object.entries(S.sessions).map(([k, s]) => [k, s.log]));
    return { kind: "ca-guide-study-session", build: api.meta.build, study: { ...S, sessions: undefined },
      decision_logs: logs, exposure: api.meta.exposure, events: api.meta.events, metrics: api.metrics,
      device: { user_agent: api.meta.user_agent, screen: api.meta.screen }, finished_at: new Date().toISOString() };
  }
  function finish() {
    const core = S.recall.filter((r) => r.type === "core"), ok = core.filter((r) => r.correct_auto).length;
    show(`<h1>Thank you!</h1><p>The session is complete. Please hand the phone back to the experimenter.</p>
      <div class="consent"><b>Experimenter:</b> download the results file now and copy it to the study folder.
      Automatic core recall score: ${ok}/${core.length} (check by hand).</div>
      <button id="dl" class="primary">Download results</button>`);
    $("#dl").onclick = () => {
      const a = document.createElement("a");
      a.href = URL.createObjectURL(new Blob([JSON.stringify(results(), null, 1)], { type: "application/json" }));
      a.download = `study-P${String(S.participant.number).padStart(2, "0")}-${new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-")}.json`;
      a.click();
    };
  }

  consent();
}
