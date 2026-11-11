// Study mode UI (?study=1): consent -> profile -> practice (format choice) -> 4 counterbalanced
// blocks (system x room) with per-artwork interaction time -> Raw NASA-TLX mental demand and Paas
// after each block -> SUS after each system -> core/optional recall -> results file.
// The participant sees the systems as "Guide A" and "Guide B"; the condition names stay in the log.
import { blockOrder, assignArtworks, SUS_ITEMS, susScore, scoreRecall } from "./study.js";

const PER_BLOCK = 2;
const PRACTICE = {
  brief: "Practice painting: a harbour at sunset, painted in oil around 1900.",
  detailed: "Practice painting: a harbour at sunset, painted in oil around 1900. The painter worked outdoors and finished the picture in one evening. Small boats in the foreground show that the harbour was still used for fishing.",
};

export function initStudy(api) {
  const { $, now } = api;
  const sheet = $("#study"), bar = $("#studyBar");
  const S = { started_at: new Date().toISOString(), blocks: [], sus: {}, recall: [], sessions: {} };
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
    const kn = (api.art.prior_knowledge || []).map((k) => `<label><input type="checkbox" name="kn" value="${k.tag}" /> ${k.label}</label>`).join("");
    show(`<h1>About you</h1>
      <label>Participant number (from the experimenter) <input type="number" id="pid" min="1" inputmode="numeric" /></label>
      <div class="q">How familiar are you with Ottoman painting? ${scale("fam", 1, 7, "not at all", "very")}</div>
      <fieldset><legend>Do you need a format?</legend>
        <label><input type="radio" name="acc" value="" checked /> no preference</label>
        <label><input type="radio" name="acc" value="no_audio" /> text only</label>
        <label><input type="radio" name="acc" value="no_text" /> audio only</label></fieldset>
      <fieldset><legend>Before today I already knew…</legend>${kn}</fieldset>
      <p id="msg" class="msg"></p><button id="go" class="primary">Continue</button>`);
    $("#go").onclick = () => {
      const pid = parseInt($("#pid").value, 10), fam = val("fam");
      if (!(pid >= 1) || !fam) { $("#msg").textContent = "Please enter the participant number and answer the familiarity question."; return; }
      const acc = sheet.querySelector("input[name=acc]:checked").value;
      S.participant = { number: pid, familiarity: fam, accessibility: acc ? [acc] : [],
        known: [...sheet.querySelectorAll("input[name=kn]:checked")].map((x) => x.value) };
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
    sheet.querySelectorAll("[data-try]").forEach((b) => (b.onclick = () => {
      const a = b.dataset.try, text = PRACTICE[a.split("_")[0]];
      if ("speechSynthesis" in window) speechSynthesis.cancel();
      if (a.endsWith("audio") && "speechSynthesis" in window) {
        $("#sample").textContent = "🔊 (listening…)";
        const u = new SpeechSynthesisUtterance(text); u.lang = api.content.lang || "en-US"; speechSynthesis.speak(u);
      } else $("#sample").textContent = text;
      (S.practice_tried ||= []).push(a);
    }));
    $("#go").onclick = () => {
      const p = sheet.querySelector("input[name=pref]:checked");
      if (!p) { $("#msg").textContent = "Please choose a format."; return; }
      if ("speechSynthesis" in window) speechSynthesis.cancel();
      S.participant.format_preference = p.value;
      blockIntro(0);
    };
  }

  // ------------------------------------------------------------------ 4. blocks
  function blockIntro(b) {
    const blk = order[b];
    show(`<h1>Part ${b + 1} of 4</h1><p>You will use <b>${guideName[blk.system]}</b> with ${PER_BLOCK} paintings.</p>
      <div class="consent"><b>Experimenter:</b> room condition <b>${blk.room.toUpperCase()}</b> —
      ${blk.room === "noise" ? "start the museum noise recording now." : "make sure the noise recording is off."}</div>
      <button id="go" class="primary">Start part ${b + 1}</button>`);
    $("#go").onclick = async () => {
      $("#go").disabled = true;
      if (!sensorsReady) {                       // first tap: camera, microphone, motion (iOS needs a tap)
        try { await api.initSensors(); sensorsReady = true; }
        catch (e) { $("#go").disabled = false; sheet.insertAdjacentHTML("beforeend", `<p class="msg">Could not start: ${e.message || e}</p>`); return; }
      }
      const user = { familiarity: S.participant.familiarity, accessibility: S.participant.accessibility,
        format_preference: S.participant.format_preference, known: S.participant.known };
      if (!S.sessions[blk.system]) S.sessions[blk.system] = api.beginSystem(blk.system, user);
      else api.setSession(S.sessions[blk.system]);
      api.meta.events.push({ t: now(), e: "block_start", block: b + 1, ...blk });
      S.blocks[b] = { ...blk, guide: guideName[blk.system], artworks: [], started_t: now() };
      hide(); artwork(b, 0);
    };
  }

  function artwork(b, k) {
    const label = `${artworksPerBlock[b][k]}-p${b + 1}`;
    bar.innerHTML = `<span class="grow">Part ${b + 1}/4 · painting ${k + 1}/${PER_BLOCK}: point the phone at the painting.</span>`
      + (api.simulateTarget ? `<button id="sim" class="small">Simulate painting</button>` : "");
    bar.classList.remove("hidden");
    if (api.simulateTarget) $("#sim").onclick = api.simulateTarget;
    api.expectArtwork(label, (d) => {
      bar.innerHTML = `<span class="grow">${guideName[order[b].system]} · painting ${k + 1}/${PER_BLOCK}. Tap Done when you have finished with this painting.</span><button id="done" class="primary small">Done</button>`;
      $("#done").onclick = () => {
        const t = api.finishArtwork();
        S.blocks[b].artworks.push({ label, first_format: d?.action ?? null, recognized_t: t.recognized_t, done_t: t.done_t,
          interaction_s: t.recognized_t != null ? +(t.done_t - t.recognized_t).toFixed(2) : null });
        if (k + 1 < PER_BLOCK) artwork(b, k + 1); else blockQuestions(b);
      };
    });
  }

  function blockQuestions(b) {
    bar.classList.add("hidden");
    show(`<h1>About part ${b + 1}</h1>
      <div class="q"><b>Mental demand:</b> how mentally demanding was this part?
        <input type="range" id="tlx" min="0" max="100" step="5" value="50" /><div class="ends"><span>very low</span><output id="tlxOut">50</output><span>very high</span></div></div>
      <div class="q"><b>Effort:</b> how much mental effort did you invest? ${scale("paas", 1, 9, "very, very low", "very, very high")}</div>
      <p id="msg" class="msg"></p><button id="go" class="primary">Continue</button>`);
    let moved = false;
    $("#tlx").oninput = (e) => { moved = true; $("#tlxOut").textContent = e.target.value; };
    $("#go").onclick = () => {
      const paas = val("paas");
      if (!paas || !moved) { $("#msg").textContent = "Please move the slider and choose an effort rating."; return; }
      Object.assign(S.blocks[b], { tlx_mental_demand: +$("#tlx").value, paas, ended_t: now() });
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
