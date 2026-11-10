// WebAR feasibility spike: live artwork tracking (MindAR) + microphone level + the same
// expected-utility policy as the Python prototype (src/policy.js, parity-tested).
import { MindARThree } from "mindar-image-three";
import { Compiler } from "mindar-image";
import { CSS3DObject } from "three/addons/renderers/CSS3DRenderer.js";
import { Session, newUserState, defaultConfig, utilities, ACTIONS } from "./policy.js";
import { NoiseMeter } from "./noise.js";

const BUILD = "spike-2026-11-11";
const $ = (s) => document.querySelector(s);
const params = new URLSearchParams(location.search);
const DEBUG = params.has("debug");
const t0 = performance.now();
const now = () => +((performance.now() - t0) / 1000).toFixed(3);   // seconds since page load
const LABEL = { brief_text: "Brief text", detailed_text: "Detailed text", brief_audio: "Brief audio", detailed_audio: "Detailed audio" };

const C = defaultConfig();
const noise = new NoiseMeter({ windowSec: 6, sampleHz: 10, calOffset: 90 });
const metrics = [];            // one sample per second
const meta = { build: BUILD, started_at: new Date().toISOString(), user_agent: navigator.userAgent,
  screen: `${screen.width}x${screen.height}@${devicePixelRatio}`, events: [] };
let session, content, art, targetAspect = 1.33, mindData = null;
let tracking = false, simulatedTracking = false, forceNoisy = false;
let visit = 0, pendingRecognition = true, frames = 0, lastLatency = null;
let panelObj = null, pinned = params.has("pin"), side = "right";

// ---------------------------------------------------------------- content player
const player = {
  action: null, idx: 0, finished: false, token: 0,
  segs() { return art.core.concat(this.action?.startsWith("detailed") ? art.detail : []); },
  isAudio() { return this.action?.endsWith("audio"); },
  stop() { this.token++; if ("speechSynthesis" in window) speechSynthesis.cancel(); },
  start(action, idx = 0) {
    this.stop(); this.action = action; this.idx = idx; this.finished = idx >= this.segs().length;
    if (this.finished) this.finish(false); else this.play();
  },
  play() {
    render();
    if (this.isAudio() && !this.finished) {
      const tok = this.token, seg = this.segs()[this.idx];
      speak(seg.text, () => { if (tok === this.token) segmentEnded(); });
    }
  },
  finish(completed) {
    this.stop(); this.finished = true;
    if (completed && this.action.startsWith("detailed")) session.event("complete_detail", now());
    render();
  },
};

let utter = null;   // keep a reference: some engines drop onend for garbage-collected utterances
function speak(text, onend) {
  if (!("speechSynthesis" in window)) { meta.events.push({ t: now(), e: "tts_unavailable" }); return; }
  utter = new SpeechSynthesisUtterance(text);
  utter.lang = content.lang || "en-US"; utter.rate = 1.0;
  utter.onend = onend; utter.onerror = onend;
  speechSynthesis.speak(utter);
}

// ---------------------------------------------------------------- policy glue
function makeObs(artworkId) {
  const flags = [];
  let lvl;
  if (forceNoisy) { lvl = 72; flags.push("noise_simulated"); }
  else { lvl = noise.level(); flags.push(lvl == null ? "noise_missing" : "noise_uncalibrated_estimate"); }
  if (simulatedTracking) flags.push("tracking_simulated");
  return { timestamp: now(), artwork_id: artworkId, tracking_valid: tracking, noise_or_missing: lvl,
    optional_sensor_features: null, quality_flags: flags };
}

// Latency = policy evaluation + DOM update + next painted frame.
function stamp(decision, tStart) {
  if (!decision) return;
  decision.quality_flags = decision.quality_flags || [];
  requestAnimationFrame(() => {
    decision.latency_ms = +(performance.now() - tStart).toFixed(1);
    lastLatency = decision.latency_ms; updateHud();
  });
}

function recognize() {
  pendingRecognition = false; visit++;
  const tStart = performance.now();
  const obs = makeObs(`${art.id}-visit${visit}`);
  const d = session.recognize(obs);
  if (d) { d.quality_flags = obs.quality_flags; player.start(d.action, 0); }
  stamp(d, tStart); updateHud();
}

function segmentEnded() {
  const segs = player.segs();
  if (player.idx >= segs.length - 1) return player.finish(true);
  const tStart = performance.now();
  const obs = makeObs(session.artwork);
  const d = session.boundary(obs);
  if (d) d.quality_flags = obs.quality_flags;
  const next = player.idx + 1;
  if (d && d.action !== player.action) player.start(d.action, next);
  else { player.idx = next; player.play(); }
  stamp(d, tStart); updateHud();
}

function onControl(act) {
  if (!session || !player.action) return;
  const mod = player.action.split("_")[1];
  if (act === "next") { player.stop(); segmentEnded(); }
  else if (act === "replay") { session.event("replay", now()); player.start(player.action, 0); }
  else if (act === "skip") { session.event("skip_detail", now()); player.finish(false); }
  else if (act === "more") {
    session.event("request_more", now());
    const target = `detailed_${mod}`;
    session.event(`override:${target}`, now());
    player.start(target, player.finished ? art.core.length : player.idx);
  }
  updateHud();
}

function onOverride(action) {
  if (!session || !player.action || action === player.action) return;
  const tStart = performance.now();
  const d = session.event(`override:${action}`, now());
  player.start(action, player.finished ? 0 : player.idx);
  stamp(d, tStart); updateHud();
}

// ---------------------------------------------------------------- rendering
function render() {
  const el = $("#panel");
  el.classList.remove("hidden");
  el.classList.toggle("audio", !!player.isAudio());
  const segs = player.action ? player.segs() : [];
  $("#pTitle").textContent = `${art.title} · ${art.artist}, ${art.year}`;
  $("#pFormat").textContent = player.action ? LABEL[player.action] + (session.locked ? " (your choice)" : "") : "";
  if (player.finished) {
    $("#pSeg").textContent = "end";
    $("#pText").textContent = "End of this artwork. Replay, ask for more detail, or move to the next artwork.";
  } else if (player.action) {
    const seg = segs[player.idx];
    $("#pSeg").textContent = `${player.idx + 1}/${segs.length}${seg.optional ? " · optional detail" : ""}`;
    $("#pText").textContent = player.isAudio() ? `🔊 ${seg.text}` : seg.text;   // caption = transcript
  }
  const seg = segs[player.idx];
  $("#bNext").classList.toggle("hidden", player.finished || player.isAudio());
  $("#bSkip").classList.toggle("hidden", player.finished || !player.action?.startsWith("detailed") || !seg?.optional);
  $("#bMore").classList.toggle("hidden", !player.action?.startsWith("brief"));
  const acc = session.live.accessibility;
  document.querySelectorAll("[data-ov]").forEach((b) => {
    const a = b.dataset.ov;
    b.setAttribute("aria-pressed", String(a === player.action));
    b.classList.toggle("hidden", (acc.includes("no_audio") && a.endsWith("audio")) || (acc.includes("no_text") && a.endsWith("text")));
  });
  placePanel();
}

function placePanel() {
  if (!panelObj || pinned) return;
  const el = $("#panel"), H = 1000 * targetAspect, gap = 50;
  if (side === "right") panelObj.position.set(500 + gap + 320, H / 2 - el.offsetHeight / 2, 0);
  else panelObj.position.set(0, -(H / 2 + gap + el.offsetHeight / 2), 0);
}

function setPinned(v) {
  pinned = v;
  const el = $("#panel");
  if (!panelObj) { el.classList.toggle("pinned", true); return; }
  if (v) { panelObj.parent?.remove(panelObj); el.removeAttribute("style"); el.classList.add("pinned"); document.body.appendChild(el); }
  else { el.classList.remove("pinned"); panelObj = new CSS3DObject(el); anchorRef.group.add(panelObj); placePanel(); }
  if (!player.action) el.classList.add("hidden");
}

function updateHud() {
  const lvl = forceNoisy ? 72 : noise.level();
  const noisy = lvl != null && lvl > C.NOISY_THRESHOLD_DBA;
  const hN = $("#hNoise");
  hN.textContent = lvl == null ? "noise: missing" : `≈${lvl.toFixed(0)} dB${forceNoisy ? " (sim)" : ""} · ${noisy ? "noisy" : "quiet"}`;
  hN.className = "pill " + (lvl == null ? "warn" : noisy ? "warn" : "ok");
  const hT = $("#hTrack");
  hT.textContent = tracking ? (simulatedTracking ? "tracking (sim)" : "artwork tracked") : "scanning…";
  hT.className = "pill " + (tracking ? "ok" : "");
  $("#hLat").textContent = lastLatency == null ? "decision – ms" : `decision ${lastLatency.toFixed(0)} ms`;
  if (!session) return;
  // Live utilities (what the policy would score now); decisions are only taken at boundaries.
  const st = JSON.parse(JSON.stringify(session.frozen));
  const live = utilities(C, st, lvl, player.action, session.useHistory);
  const bars = $("#hBars"); bars.innerHTML = "";
  for (const a of ACTIONS) {
    const v = live.utils[a];
    const name = document.createElement("span"); name.textContent = LABEL[a];
    const bar = document.createElement("span"); bar.className = "bar";
    const fill = document.createElement("i");
    fill.style.width = v == null ? "0" : `${Math.max(0, Math.min(1, (v + 0.2) / 1.2)) * 100}%`;
    bar.appendChild(fill);
    const val = document.createElement("span"); val.textContent = v == null ? "n/a" : v.toFixed(2);
    if (a === player.action) name.className = "chosen";
    if (v == null) [name, bar, val].forEach((e) => e.classList.add("na"));
    bars.append(name, bar, val);
  }
  const last = [...session.log].reverse().find((x) => "keep_or_switch" in x && x.action);
  const tr = player.action && live.terms[player.action];
  const termTxt = tr ? ` · now: I ${tr.I.toFixed(2)} + B ${tr.B.toFixed(2)} − D ${tr.D.toFixed(2)} − switch ${tr.S.toFixed(2)} − unc ${tr.R.toFixed(2)}` : "";
  $("#hReason").textContent = last
    ? `Last decision [${last.keep_or_switch}] ${LABEL[last.action]}: ${last.reason}${termTxt}. B(detailed) next artwork: ${session.live.b_detailed.toFixed(2)}.`
    : "Point the camera at the artwork.";
}

// ---------------------------------------------------------------- target image -> compiled .mind
async function sha256(buf) {
  const h = await crypto.subtle.digest("SHA-256", buf);
  return [...new Uint8Array(h)].map((b) => b.toString(16).padStart(2, "0")).join("").slice(0, 16);
}

async function loadTarget() {
  for (const url of [art.target, art.fallback_target]) {
    const res = await fetch(url, { cache: "no-cache" }).catch(() => null);
    if (!res || !res.ok) continue;
    const bytes = await res.arrayBuffer();
    const blobUrl = URL.createObjectURL(new Blob([bytes]));
    const img = await new Promise((ok, err) => { const i = new Image(); i.onload = () => ok(i); i.onerror = err; i.src = blobUrl; });
    targetAspect = img.naturalHeight / img.naturalWidth;
    meta.target = { url, width: img.naturalWidth, height: img.naturalHeight };
    // 1) precompiled file next to the image  2) browser cache  3) compile now (~10–60 s on a phone)
    const pre = await fetch(url.replace(/\.(jpe?g|png)$/i, ".mind")).catch(() => null);
    if (pre && pre.ok) { mindData = await pre.arrayBuffer(); meta.target.source = "precompiled"; }
    else {
      const key = `/mind-cache/${await sha256(bytes)}.mind`;
      const cache = "caches" in window ? await caches.open("ca-guide") : null;
      const hit = cache && (await cache.match(key));
      if (hit) { mindData = await hit.arrayBuffer(); meta.target.source = "cache"; }
      else {
        const tC = performance.now();
        const compiler = new Compiler();
        await compiler.compileImageTargets([img], (p) => busy(`Preparing artwork target… ${p.toFixed(0)}%`));
        mindData = (await compiler.exportData()).buffer;
        meta.target.source = "compiled_in_browser"; meta.target.compile_ms = Math.round(performance.now() - tC);
        if (cache) await cache.put(key, new Response(mindData));
      }
    }
    return URL.createObjectURL(new Blob([mindData]));
  }
  throw new Error("No target image found (targets/artwork.jpg or targets/placeholder.jpg).");
}

// ---------------------------------------------------------------- start-up
function busy(msg) { $("#busy").classList.toggle("hidden", !msg); $("#busyMsg").textContent = msg || ""; }
let anchorRef = null;

async function start() {
  const accVal = document.querySelector("input[name=acc]:checked").value;
  const user = newUserState({ familiarity: +$("#fam").value, accessibility: accVal ? [accVal] : [] });
  session = new Session(user, { config: C, clock: now });
  meta.user_state_at_start = user;
  if ("speechSynthesis" in window) speechSynthesis.speak(new SpeechSynthesisUtterance(""));  // unlock on iOS
  navigator.wakeLock?.request("screen").catch(() => {});

  busy("Starting microphone…");
  try { await noise.start(); } catch (e) { meta.events.push({ t: now(), e: "mic_unavailable", detail: String(e) }); }

  busy("Loading artwork target…");
  const src = await loadTarget();

  if (params.has("nocam")) {   // UI/policy testing without a camera (desktop); decisions are flagged tracking_simulated
    meta.events.push({ t: now(), e: "nocam_mode" });
    anchorRef = { onTargetLost: () => { tracking = false; updateHud(); } };
    const loop = () => { frames++; requestAnimationFrame(loop); }; loop();
    setPinned(true);
    $("#start").classList.add("hidden"); $("#hud").classList.remove("hidden"); busy(null);
    setInterval(tick, 1000); updateHud();
    return;
  }

  busy("Starting camera…");
  const mindar = new MindARThree({ container: $("#ar"), imageTargetSrc: src, uiLoading: "no", uiScanning: "no",
    filterMinCF: 0.0001, filterBeta: 0.001 });
  const { renderer, cssRenderer, scene, cssScene, camera } = mindar;
  anchorRef = mindar.addCSSAnchor(0);
  const tCam = performance.now();
  anchorRef.onTargetFound = () => {
    if (!meta.first_detection_ms) meta.first_detection_ms = Math.round(performance.now() - tCam);
    tracking = true; simulatedTracking = false; meta.events.push({ t: now(), e: "target_found" });
    if (pendingRecognition) recognize();
    updateHud();
  };
  anchorRef.onTargetLost = () => { tracking = false; meta.events.push({ t: now(), e: "target_lost" }); updateHud(); };
  await mindar.start();
  meta.camera_start_ms = Math.round(performance.now() - tCam);
  renderer.setAnimationLoop(() => { frames++; renderer.render(scene, camera); cssRenderer.render(cssScene, camera); });

  $("#panel").classList.remove("hidden");
  panelObj = new CSS3DObject($("#panel"));
  anchorRef.group.add(panelObj);
  $("#panel").classList.add("hidden");
  if (pinned) setPinned(true);

  $("#start").classList.add("hidden");
  $("#hud").classList.remove("hidden");
  busy(null);
  setInterval(tick, 1000);
  updateHud();
}

function tick() {
  const lvl = noise.level();
  metrics.push({ t: now(), fps: frames, noise_db: lvl == null ? null : +lvl.toFixed(1), tracking, format: player.action });
  $("#hFps").textContent = `${frames} fps`;
  frames = 0;
  updateHud();
}

// ---------------------------------------------------------------- export
function exportLog() {
  const fps = metrics.filter((m) => m.tracking).map((m) => m.fps).sort((a, b) => a - b);
  const lat = session.log.filter((d) => d.latency_ms != null).map((d) => d.latency_ms).sort((a, b) => a - b);
  const q = (arr, p) => (arr.length ? arr[Math.min(arr.length - 1, Math.floor(p * arr.length))] : null);
  const out = {
    meta: { ...meta, exported_at: new Date().toISOString(), config: C, noise_cal_offset: noise.calOffset,
      use_history: session.useHistory },
    summary: { decisions: session.log.filter((d) => "keep_or_switch" in d).length,
      fps_while_tracking_median: q(fps, 0.5), fps_while_tracking_p10: q(fps, 0.1),
      decision_latency_ms_median: q(lat, 0.5), decision_latency_ms_max: lat.at(-1) ?? null },
    decision_log: session.log, metrics,
  };
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([JSON.stringify(out, null, 1)], { type: "application/json" }));
  a.download = `ca-guide-session-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
  a.click();
}

// ---------------------------------------------------------------- wiring
function bindSettings() {
  const bind = (id, out, get, set, fmt = (v) => v) => {
    const el = $(id); el.value = get(); $(out).textContent = fmt(get());
    el.addEventListener("input", () => { set(+el.value); $(out).textContent = fmt(+el.value); updateHud(); });
  };
  bind("#thr", "#thrOut", () => C.NOISY_THRESHOLD_DBA, (v) => (C.NOISY_THRESHOLD_DBA = v));
  bind("#cal", "#calOut", () => Math.round(noise.calOffset), (v) => (noise.calOffset = v));
  bind("#bstep", "#bstepOut", () => C.B_STEP, (v) => (C.B_STEP = v), (v) => (+v).toFixed(2));
  $("#bCal").onclick = () => { const o = noise.calibrateTo(40); $("#cal").value = Math.round(o); $("#calOut").textContent = Math.round(o);
    meta.events.push({ t: now(), e: "calibrated_quiet_40", offset: o }); updateHud(); };
  $("#hist").onchange = (e) => { session.useHistory = e.target.checked; meta.events.push({ t: now(), e: "use_history", v: e.target.checked }); updateHud(); };
  $("#forceNoisy").onchange = (e) => { forceNoisy = e.target.checked; meta.events.push({ t: now(), e: "force_noisy", v: forceNoisy }); updateHud(); };
  $("#pin").checked = pinned;
  $("#pin").onchange = (e) => setPinned(e.target.checked);
  $("#side").onchange = (e) => { side = e.target.value; placePanel(); };
  $("#bMind").onclick = () => { if (!mindData) return; const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([mindData])); a.download = "artwork.mind"; a.click(); };
  $("#buildInfo").textContent = `Build ${BUILD}. Noise level is an uncalibrated estimate (dBFS + offset), not dBA.`;
}

$("#fam").oninput = (e) => ($("#famOut").textContent = e.target.value);
$("#startBtn").onclick = (ev) => {
  ev.target.disabled = true;
  start().catch((e) => { busy(null); ev.target.disabled = false; $("#startMsg").textContent = `Could not start: ${e.message || e}`; console.error(e); });
};
document.querySelectorAll("[data-act]").forEach((b) => (b.onclick = () => onControl(b.dataset.act)));
document.querySelectorAll("[data-ov]").forEach((b) => (b.onclick = () => onOverride(b.dataset.ov)));
$("#bExport").onclick = exportLog;
$("#bSettings").onclick = () => $("#settings").classList.remove("hidden");
$("#bClose").onclick = () => $("#settings").classList.add("hidden");
$("#hToggle").onclick = (e) => { const body = $("#hBody"); body.classList.toggle("hidden"); e.target.textContent = body.classList.contains("hidden") ? "▸" : "▾"; };
$("#bNewArt").onclick = () => {
  player.stop(); player.action = null; $("#panel").classList.add("hidden");
  pendingRecognition = true; meta.events.push({ t: now(), e: "next_artwork" });
  if (tracking) recognize();
  updateHud();
};
if (DEBUG || params.has("nocam")) {   // desktop testing without the printed artwork; every decision is flagged tracking_simulated
  const b = document.createElement("button"); b.className = "pill btn"; b.textContent = "Simulate target";
  b.onclick = () => { if (!anchorRef) return; if (tracking) { anchorRef.onTargetLost(); return; }
    tracking = true; simulatedTracking = true; if (pendingRecognition) recognize(); updateHud(); };
  $("#hud .hrow:last-child").appendChild(b);
  if (!pinned) pinned = true;
}

const resp = await fetch("content/artworks.json");
content = await resp.json();
art = content.artworks[0];
bindSettings();
