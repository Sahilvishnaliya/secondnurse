"use strict";
/* SecondNurse front end — real mode only (live Muse Wonder + SAM 3.1).
   All user text is rendered with textContent. */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];

/* headline word reveal */
(() => {
  const h = $("#headline");
  const words = h.textContent.trim().split(/\s+/);
  h.textContent = "";
  words.forEach((w, i) => {
    const s = document.createElement("span");
    s.className = "w"; s.style.setProperty("--i", i); s.textContent = w;
    h.append(s, document.createTextNode(" "));
  });
})();

/* reveal on scroll */
const revealObs = new IntersectionObserver(es => es.forEach(e => {
  if (e.isIntersecting) { e.target.classList.add("in"); revealObs.unobserve(e.target); }
}), { threshold: 0.12 });
$$(".reveal").forEach(el => revealObs.observe(el));

/* animated counters */
const countObs = new IntersectionObserver(es => es.forEach(e => {
  if (!e.isIntersecting) return;
  countObs.unobserve(e.target);
  const el = e.target, end = parseFloat(el.dataset.count), dec = +(el.dataset.decimals || 0);
  const t0 = performance.now(), dur = 1300;
  (function tick(t) {
    const p = Math.min(1, (t - t0) / dur), ease = 1 - Math.pow(1 - p, 3);
    el.textContent = (end * ease).toFixed(dec);
    if (p < 1) requestAnimationFrame(tick);
  })(t0);
}), { threshold: 0.5 });
$$("[data-count]").forEach(el => countObs.observe(el));

/* API status */
let apiLive = false;
fetch("/api/health").then(r => r.json()).then(h => {
  apiLive = !!h.live_meta_api;
  const pill = $("#mode-pill");
  pill.textContent = apiLive ? "Real mode · Live" : "Real mode · SAM 3.1";
  pill.classList.toggle("live", apiLive);
  const dot = $("#stage-live-dot");
  if (dot) { dot.textContent = apiLive ? "Real mode · Live" : "Real mode · SAM 3.1"; dot.classList.add("on"); }
}).catch(() => { $("#mode-pill").textContent = "Meta API: unreachable"; });

/* ============ live session state ============ */
const state = { score: 100, events: 0, fired: new Set(), startedAt: null };
let STEP_TITLES = [
  "Wash and fully dry hands (20s)", "Mask and gloves on", "Supplies on the sterile field",
  "Uncap the sterile connector tip", "Connect the fluid bag tube", "Open clamp, start exchange",
  "Disconnect and recap the connector",
];
function renderSteps() {
  const ol = $("#steps"); ol.textContent = "";
  STEP_TITLES.forEach((title, i) => {
    const li = document.createElement("li");
    const badge = document.createElement("span"); badge.className = "step-ic";
    badge.textContent = String(i + 1);
    const txt = document.createElement("span"); txt.textContent = title;
    li.append(badge, txt); ol.append(li);
  });
}
function logEvent(kind, text) {
  const log = $("#log");
  const empty = $(".log-empty", log); if (empty) empty.remove();
  const li = document.createElement("li");
  if (kind === "breach") li.className = "breach";
  const t = document.createElement("span"); t.className = "t";
  const secs = state.startedAt ? ((Date.now() - state.startedAt) / 1000).toFixed(0) : "0";
  t.textContent = `${kind.toUpperCase()} · ${secs}s  `;
  li.append(t, document.createTextNode(text));
  log.prepend(li);
}
function updateScore() {
  $("#score-num").textContent = state.score;
  const ring = $("#score-ring");
  ring.style.setProperty("--score", state.score);
  ring.classList.toggle("bad", state.score < 100);
}
function fireBreach(type, detail, correction) {
  if (state.fired.has(type)) return;
  state.fired.add(type); state.events += 1;
  state.score = Math.max(0, 100 - 25 * state.events);
  updateScore();
  logEvent("breach", detail);
  $("#alert-title").textContent = detail;
  $("#alert-detail").textContent = correction;
  $("#alert-banner").hidden = false;
  if ($("#voice-toggle").checked && "speechSynthesis" in window) {
    speechSynthesis.cancel();
    speechSynthesis.speak(new SpeechSynthesisUtterance(`${detail} ${correction}`));
  }
  stopWatch();
}
function resetSession() {
  stopWatch();
  Object.assign(state, { score: 100, events: 0, fired: new Set(), startedAt: null });
  touchStreak = 0;
  $("#alert-banner").hidden = true;
  $("#log").innerHTML = '<li class="log-empty">No events yet. Start live watch.</li>';
  $("#ro-overlap").textContent = "—"; $("#ro-dwell").textContent = "0";
  $("#ro-field").textContent = "—"; $("#ro-latency").textContent = "—";
  $("#cam-overlay").textContent = "";
  updateScore();
}
$("#btn-reset").addEventListener("click", resetSession);
$("#alert-reset").addEventListener("click", resetSession);

/* ============ camera + live SAM ============ */
const LIVE_PROMPTS = ["gloved hand", "red connector", "blue cap", "sterile field mat"];
let stream = null, watchTimer = null, watchInFlight = false, touchStreak = 0;
let facing = "environment";
let overlapThreshold = Number(localStorage.getItem("sn-threshold") || 40);
let activePrompts = JSON.parse(localStorage.getItem("sn-prompts") || "null") || [...LIVE_PROMPTS];

async function startCamera() {
  try {
    if (stream) stream.getTracks().forEach(t => t.stop());
    stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: facing, width: { ideal: 1920 }, height: { ideal: 1080 } }, audio: false });
    const video = $("#camera");
    video.srcObject = stream;
    video.classList.toggle("mirrored", facing === "user");
    $("#cam-tools").hidden = false;
    $("#cam-empty").hidden = true;
    $("#camera-status").textContent = facing === "user"
      ? "Front camera live (mirrored preview). Analyze a frame or start live watch."
      : "Overhead/rear camera live. Analyze a frame or start live watch.";
    logEvent("camera", `Camera enabled (${facing === "user" ? "front" : "overhead/rear"}).`);
  } catch { $("#camera-status").textContent = "Camera permission unavailable in this browser or device."; }
}
$("#btn-camera").addEventListener("click", startCamera);

function setFacing(next) {
  facing = next;
  $("#btn-cam-front").classList.toggle("is-active", next === "user");
  $("#btn-cam-rear").classList.toggle("is-active", next !== "user");
  if (stream) startCamera();
}
$("#btn-cam-front").addEventListener("click", () => setFacing("user"));
$("#btn-cam-rear").addEventListener("click", () => setFacing("environment"));
$("#btn-fullscreen").addEventListener("click", () => {
  const wrap = $("#video-wrap");
  if (document.fullscreenElement) document.exitFullscreen();
  else if (wrap.requestFullscreen) wrap.requestFullscreen();
});

function stopCamera() {
  stopWatch();
  if (stream) { stream.getTracks().forEach(t => t.stop()); stream = null; }
  const video = $("#camera");
  video.srcObject = null;
  video.classList.remove("mirrored");
  $("#cam-overlay").textContent = "";
  $("#cam-tools").hidden = true;
  $("#cam-empty").hidden = false;
  $("#camera-status").textContent = "Camera is off. Enable it when the bench is framed.";
  $("#segment-result").textContent = "Not analyzed yet.";
  logEvent("camera", "Camera turned off.");
}
$("#btn-camera-off").addEventListener("click", stopCamera);

function captureFrame() {
  const video = $("#camera");
  if (!video.videoWidth) return null;
  const scale = Math.min(1, 640 / video.videoWidth);
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(video.videoWidth * scale);
  canvas.height = Math.round(video.videoHeight * scale);
  const ctx = canvas.getContext("2d");
  if (facing === "user") { ctx.translate(canvas.width, 0); ctx.scale(-1, 1); }
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", 0.72);
}
function boxOverlapPx(a, b) {
  const x = Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x));
  const y = Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));
  return x * y;
}
function centroid(b) { return [b.x + b.w / 2, b.y + b.h / 2]; }
function inside(p, b) { return p[0] >= b.x && p[0] <= b.x + b.w && p[1] >= b.y && p[1] <= b.y + b.h; }

function renderCamBoxes(data) {
  const overlay = $("#cam-overlay");
  overlay.textContent = "";
  for (const r of data.results || []) {
    const fw = r.frame_w || 640, fh = r.frame_h || 400;
    for (const b of r.boxes || []) {
      const el = document.createElement("div");
      el.className = `cam-box ${r.canonical || ""}`;
      el.style.left = `${(b.x / fw) * 100}%`; el.style.top = `${(b.y / fh) * 100}%`;
      el.style.width = `${(b.w / fw) * 100}%`; el.style.height = `${(b.h / fh) * 100}%`;
      const tag = document.createElement("span"); tag.textContent = b.label || r.prompt;
      el.append(tag); overlay.append(el);
    }
  }
}
function renderLiveResults(data, overlapPx) {
  const wrap = $("#live-results");
  wrap.textContent = "";
  const table = document.createElement("table");
  const head = document.createElement("tr");
  ["Object (SAM prompt)", "Found", "Confidence", "Mask"].forEach(t => {
    const th = document.createElement("th"); th.textContent = t; head.append(th);
  });
  table.append(head);
  for (const r of data.results || []) {
    const tr = document.createElement("tr");
    const b = (r.boxes || [])[0];
    [`${r.canonical} (“${r.prompt}”)`,
     b ? `${r.boxes.length} at ${Math.round(b.x)},${Math.round(b.y)}` : "not found",
     b && b.confidence != null ? b.confidence.toFixed(2) : "—",
     b && b.mask ? `${b.mask.w}×${b.mask.h}px` : "—",
    ].forEach(c => { const td = document.createElement("td"); td.textContent = c; tr.append(td); });
    table.append(tr);
  }
  const foot = document.createElement("p");
  foot.className = "mono";
  foot.textContent = `hand ∩ sterile tip: ${Math.round(overlapPx)}px² · method: ${(data.touch && data.touch.method) || "box"} · latency: ${data.latency_ms}ms · model: ${data.model}`;
  wrap.append(table, foot);
}
function checkLiveBreach(data) {
  const by = {};
  for (const r of data.results || []) if (r.boxes && r.boxes[0]) by[r.canonical] = r.boxes[0];
  let overlapPx = 0;
  if (data.touch && typeof data.touch.overlap_px === "number") overlapPx = data.touch.overlap_px;
  else if (by.hand && by.sterile_tip) overlapPx = boxOverlapPx(by.hand, by.sterile_tip);
  $("#ro-overlap").textContent = `${Math.round(overlapPx)} px²`;
  $("#ro-overlap").classList.toggle("bad", overlapPx >= overlapThreshold);
  $("#ro-latency").textContent = `${data.latency_ms} ms`;
  if (by.cap && by.field) {
    const capIn = inside(centroid(by.cap), by.field);
    $("#ro-field").textContent = capIn ? "yes" : "NO";
    $("#ro-field").classList.toggle("bad", !capIn);
  } else $("#ro-field").textContent = "—";
  if (overlapPx >= overlapThreshold) {
    touchStreak += 1;
    $("#ro-dwell").textContent = String(touchStreak);
    if (touchStreak >= 2) {
      logEvent("live", `SAM frame: hand/sterile-tip overlap ${Math.round(overlapPx)}px² on 2 consecutive frames.`);
      fireBreach("TOUCH", "Stop — sterile tip touched.", "Replace the cap. Do not connect it.");
      touchStreak = 0;
    }
  } else { touchStreak = 0; $("#ro-dwell").textContent = "0"; }
  return overlapPx;
}
async function analyzeFrame() {
  const out = $("#segment-result");
  const image = captureFrame();
  if (!image) { out.textContent = "Enable the camera first."; return null; }
  out.textContent = "Analyzing frame with SAM 3.1…";
  try {
    const r = await fetch("/api/segment-live", { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ image, prompts: activePrompts }) });
    const d = await r.json();
    if (!r.ok) throw new Error(d.error || "Segmentation failed.");
    renderCamBoxes(d);
    const ov = checkLiveBreach(d);
    renderLiveResults(d, ov);
    const found = (d.results || []).map(x => `${x.canonical}:${(x.boxes || []).length}`).join(" · ");
    out.textContent = `SAM 3.1 · ${d.latency_ms}ms · ${found} · overlap ${Math.round(ov)}px²`;
    return d;
  } catch (e) { out.textContent = e.message; return null; }
}
function stopWatch() {
  if (watchTimer) { clearInterval(watchTimer); watchTimer = null; }
  const btn = $("#btn-watch");
  if (btn) btn.innerHTML = '<svg class="ic"><use href="#i-play"/></svg> Start live watch';
}
$("#btn-analyze").addEventListener("click", analyzeFrame);
$("#btn-watch").addEventListener("click", () => {
  if (watchTimer) { stopWatch(); $("#segment-result").textContent = "Live watch stopped."; return; }
  if (!state.startedAt) state.startedAt = Date.now();
  $("#btn-watch").textContent = "Stop live watch";
  logEvent("live", "Live watch started: a frame is analyzed every 3 seconds.");
  const tick = async () => { if (!watchInFlight) { watchInFlight = true; await analyzeFrame(); watchInFlight = false; } };
  tick();
  watchTimer = setInterval(tick, 3000);
});

/* ============ model calibration (training on your bench) ============ */
const PROMPT_VARIANTS = {
  hand: ["gloved hand", "hand", "blue glove", "purple glove", "nitrile glove"],
  sterile_tip: ["red connector", "connector tip", "red tube connector", "red plug"],
  cap: ["blue cap", "cap", "blue bottle cap", "small blue cap"],
  field: ["sterile field mat", "green mat", "bench mat", "mat"],
};
const CANON_LABEL = { hand: "Hand / glove", sterile_tip: "Sterile connector tip", cap: "Cap", field: "Sterile field" };

const range = $("#threshold-range"), tval = $("#threshold-val");
range.value = overlapThreshold; tval.textContent = `${overlapThreshold}px²`;
range.addEventListener("input", () => {
  overlapThreshold = Number(range.value);
  tval.textContent = `${overlapThreshold}px²`;
  localStorage.setItem("sn-threshold", String(overlapThreshold));
});
if (localStorage.getItem("sn-prompts")) {
  $("#calib-status").textContent = `Calibrated prompts active: ${activePrompts.join(" · ")}`;
}

function scoreCandidate(result) {
  const b = (result.boxes || [])[0];
  if (!b) return { found: false, score: -1, box: null };
  const fw = result.frame_w || 640, fh = result.frame_h || 400;
  const areaRatio = (b.w * b.h) / Math.max(1, fw * fh);
  const sanity = areaRatio > 0.65 ? -0.6 : 0; // a "hand" covering the whole frame is a bad match
  return { found: true, box: b, score: (b.confidence ?? 0.5) + sanity + Math.min(0.2, areaRatio) };
}

$("#btn-calibrate").addEventListener("click", async () => {
  const status = $("#calib-status");
  const image = captureFrame();
  if (!image) { status.textContent = "Enable the camera first, with the full kit in frame."; return; }
  status.textContent = "Calibrating: testing SAM phrasings on your frame…";
  const chosen = {};
  const rows = [];
  try {
    for (const [canon, variants] of Object.entries(PROMPT_VARIANTS)) {
      const r = await fetch("/api/segment-live", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image, prompts: variants }) });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Calibration failed.");
      let best = null;
      (d.results || []).forEach((res, i) => {
        const s = scoreCandidate(res);
        rows.push({ canon, prompt: variants[i], ...s });
        if (s.found && (!best || s.score > best.score)) best = { prompt: variants[i], score: s.score, confidence: s.box.confidence };
      });
      if (best) chosen[canon] = best.prompt;
      status.textContent = `Calibrating… ${canon} done (${best ? `best: “${best.prompt}”` : "not found"}).`;
    }
  } catch (e) { status.textContent = e.message; return; }

  const order = ["hand", "sterile_tip", "cap", "field"];
  const next = order.map(k => chosen[k]).filter(Boolean);
  if (next.length >= 2) {
    activePrompts = next;
    localStorage.setItem("sn-prompts", JSON.stringify(activePrompts));
  }
  const wrap = $("#calib-results"); wrap.textContent = "";
  const table = document.createElement("table");
  const head = document.createElement("tr");
  ["Object", "Tested prompt", "Found", "Confidence", "Chosen"].forEach(t => {
    const th = document.createElement("th"); th.textContent = t; head.append(th);
  });
  table.append(head);
  for (const row of rows) {
    const tr = document.createElement("tr");
    [CANON_LABEL[row.canon], `“${row.prompt}”`, row.found ? "yes" : "no",
     row.found && row.box.confidence != null ? row.box.confidence.toFixed(2) : "—",
     chosen[row.canon] === row.prompt ? "✓ in use" : "",
    ].forEach(c => { const td = document.createElement("td"); td.textContent = c; tr.append(td); });
    table.append(tr);
  }
  wrap.append(table);
  const missing = order.filter(k => !chosen[k]).map(k => CANON_LABEL[k]);
  status.textContent = next.length >= 2
    ? `Calibration saved. Live watch now uses: ${activePrompts.join(" · ")}${missing.length ? ` · Not found: ${missing.join(", ")} — reposition and re-run for those.` : ""}`
    : "Calibration found too little — improve light/framing and re-run. Default prompts kept.";
  logEvent("calibrate", `Calibration finished: ${activePrompts.join(" · ")}`);
});

$("#btn-calib-reset").addEventListener("click", () => {
  activePrompts = [...LIVE_PROMPTS];
  localStorage.removeItem("sn-prompts");
  $("#calib-status").textContent = `Default prompts restored: ${activePrompts.join(" · ")}`;
});

/* ============ protocol compiler (Muse Wonder) ============ */
function renderGraph(g) {
  const wrap = $("#graph-cards"); wrap.textContent = "";
  g.steps.forEach((s, i) => {
    const card = document.createElement("div"); card.className = "graph-card";
    const h = document.createElement("h4");
    const n = document.createElement("span"); n.className = "mono"; n.textContent = `0${i + 1}`;
    h.append(n, document.createTextNode(s.title));
    const chips = document.createElement("div"); chips.className = "chips";
    (s.objects || []).forEach(o => { const c = document.createElement("span"); c.className = "chip"; c.textContent = o; chips.append(c); });
    (s.forbidden_contacts || []).forEach(f => { const c = document.createElement("span"); c.className = "chip warn"; c.textContent = `✕ ${f.a} → ${f.b}`; chips.append(c); });
    if (s.min_seconds) { const c = document.createElement("span"); c.className = "chip time"; c.textContent = `≥ ${s.min_seconds}s`; chips.append(c); }
    card.append(h, chips); wrap.append(card);
  });
  $("#graph-json").textContent = JSON.stringify(g, null, 2);
}
$("#btn-compile").addEventListener("click", async () => {
  const status = $("#compile-status");
  status.textContent = "Compiling with Muse Wonder…";
  try {
    const r = await fetch("/api/compile", { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ protocol_text: $("#protocol-text").value, name: "Home exchange protocol" }) });
    const graph = await r.json();
    if (!r.ok) throw new Error(graph.error || "Compilation failed.");
    renderGraph(graph);
    status.textContent = `Compiled ${graph.step_count} steps · source: ${graph.source}`;
    STEP_TITLES = graph.steps.map(s => s.title.length > 46 ? s.title.slice(0, 46) + "…" : s.title);
    renderSteps();
    logEvent("compile", `Protocol compiled into ${graph.step_count} executable steps.`);
  } catch (e) { status.textContent = e.message; }
});

renderSteps();
updateScore();
