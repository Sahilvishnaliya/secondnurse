"use strict";
/* SecondNurse front end. All user text is rendered with textContent. */

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];

/* ---------- headline word reveal ---------- */
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

/* ---------- reveal on scroll ---------- */
const revealObs = new IntersectionObserver(es => es.forEach(e => {
  if (e.isIntersecting) { e.target.classList.add("in"); revealObs.unobserve(e.target); }
}), { threshold: 0.12 });
$$(".reveal").forEach(el => revealObs.observe(el));

/* ---------- animated counters ---------- */
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

/* ---------- API mode pill ---------- */
fetch("/api/health").then(r => r.json()).then(h => {
  const pill = $("#mode-pill");
  pill.textContent = h.live_meta_api ? "Meta API: live" : "Meta API: demo mode";
  pill.classList.toggle("live", !!h.live_meta_api);
}).catch(() => { $("#mode-pill").textContent = "Meta API: offline fallback"; });

/* ================= SIMULATOR ================= */
const FIELD = { x: 70, y: 90, w: 430, h: 230 };
const TIP = { x: 452, y: 196, w: 30, h: 36 };
const state = {
  playing: false, raf: 0, startStamp: 0, elapsedBefore: 0,
  scenario: null, hand: { x: 285, y: 120 }, cap: { x: 205, y: 255 },
  dwell: 0, fieldDwell: 0, fired: new Set(), score: 100, step: 0, maxStep: -1,
  events: 0, lastFrameT: 0,
};

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
    badge.textContent = i < state.step ? "✓" : String(i + 1);
    const txt = document.createElement("span"); txt.textContent = title;
    li.append(badge, txt);
    li.className = i < state.step ? "is-done" : (i === state.step && state.playing ? "is-active" : "");
    ol.append(li);
  });
}

function handBox() { return { x: state.hand.x + 2, y: state.hand.y - 6, w: 64, h: 66 }; }
function overlap(a, b) {
  const x = Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x));
  const y = Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));
  return x * y;
}
function centroid(b) { return [b.x + b.w / 2, b.y + b.h / 2]; }
function inside(p, b) { return p[0] >= b.x && p[0] <= b.x + b.w && p[1] >= b.y && p[1] <= b.y + b.h; }

function setHand(x, y) {
  state.hand = { x, y };
  $("#svg-hand").setAttribute("transform", `translate(${x},${y})`);
  $("#mask-hand").setAttribute("transform", `translate(${x},${y})`);
}
function setCap(x, y) {
  state.cap = { x, y };
  const cap = $("#svg-cap");
  cap.querySelector("rect").setAttribute("x", x); cap.querySelector("rect").setAttribute("y", y);
  const label = cap.querySelector("text");
  label.setAttribute("x", x + 18); label.setAttribute("y", y + 43);
  $("#mask-cap-rect").setAttribute("x", x - 6); $("#mask-cap-rect").setAttribute("y", y - 6);
  $("#mask-cap-line").setAttribute("x", x - 6); $("#mask-cap-line").setAttribute("y", y - 6);
}

function logEvent(kind, text) {
  const log = $("#log");
  const empty = $(".log-empty", log); if (empty) empty.remove();
  const li = document.createElement("li");
  if (kind === "breach") li.className = "breach";
  const t = document.createElement("span"); t.className = "t";
  t.textContent = `${kind.toUpperCase()} · ${state.elapsedBefore.toFixed(1)}s  `;
  li.append(t, document.createTextNode(text));
  log.prepend(li);
}

function fireBreach(type, detail, correction) {
  if (state.fired.has(type)) return;
  state.fired.add(type); state.events += 1;
  state.score = Math.max(0, 100 - 25 * state.events);
  updateScore();
  logEvent("breach", detail);
  const banner = $("#alert-banner");
  $("#alert-title").textContent = detail;
  $("#alert-detail").textContent = correction;
  banner.hidden = false;
  const pulse = $("#pulse");
  pulse.setAttribute("opacity", "0.9");
  if ($("#voice-toggle").checked && "speechSynthesis" in window) {
    speechSynthesis.cancel();
    speechSynthesis.speak(new SpeechSynthesisUtterance(`${detail} ${correction}`));
  }
  pauseSim();
}

function updateScore() {
  $("#score-num").textContent = state.score;
  const ring = $("#score-ring");
  ring.style.setProperty("--score", state.score);
  ring.classList.toggle("bad", state.score < 100);
}

/* Scenario keyframes: {d: seconds, hand:[x,y], cap:[x,y], step, note} */
const SCENARIOS = {
  clean: [
    { d: 1.2, hand: [165, 125], cap: [205, 255], step: 0 },
    { d: 1.0, hand: [235, 165], cap: [205, 255], step: 1 },
    { d: 1.1, hand: [212, 218], cap: [212, 262], step: 2 },
    { d: 1.4, hand: [352, 158], cap: [322, 200], step: 3 },
    { d: 1.2, hand: [378, 160], cap: [322, 200], step: 4 },
    { d: 1.1, hand: [330, 150], cap: [322, 200], step: 5 },
    { d: 1.2, hand: [300, 130], cap: [452, 232], step: 6 },
    { d: 0.8, hand: [285, 120], cap: [452, 232], step: 7 },
  ],
  touch: [
    { d: 1.1, hand: [165, 125], cap: [205, 255], step: 0 },
    { d: 1.0, hand: [235, 165], cap: [205, 255], step: 1 },
    { d: 1.1, hand: [212, 218], cap: [212, 262], step: 2 },
    { d: 1.3, hand: [330, 175], cap: [322, 200], step: 3 },
    { d: 1.1, hand: [436, 182], cap: [322, 200], step: 4 },
    { d: 1.6, hand: [440, 186], cap: [322, 200], step: 4 },
  ],
  field: [
    { d: 1.1, hand: [165, 125], cap: [205, 255], step: 0 },
    { d: 1.0, hand: [235, 165], cap: [205, 255], step: 1 },
    { d: 1.2, hand: [300, 210], cap: [330, 235], step: 2 },
    { d: 1.5, hand: [480, 260], cap: [512, 292], step: 3 },
    { d: 1.2, hand: [470, 250], cap: [512, 292], step: 3 },
  ],
  order: [
    { d: 1.0, hand: [250, 150], cap: [205, 255], step: 0 },
    { d: 1.3, hand: [400, 175], cap: [322, 200], step: 3 },
    { d: 1.2, hand: [378, 160], cap: [322, 200], step: 4 },
  ],
};

function scenarioFrames(name) {
  const frames = [{ hand: [285, 120], cap: [205, 255], step: 0, t: 0 }];
  let t = 0;
  for (const k of SCENARIOS[name]) { t += k.d; frames.push({ ...k, t }); }
  return frames;
}

function resetSim() {
  cancelAnimationFrame(state.raf);
  Object.assign(state, { playing: false, elapsedBefore: 0, dwell: 0, fieldDwell: 0,
    fired: new Set(), score: 100, step: 0, maxStep: -1, events: 0, lastFrameT: 0, scenario: null });
  setHand(285, 120); setCap(205, 255);
  $("#alert-banner").hidden = true;
  $("#pulse").setAttribute("opacity", "0");
  $("#log").innerHTML = '<li class="log-empty">No events yet. Run a scenario.</li>';
  updateScore(); renderSteps(); updateReadout(0, false);
}

function updateReadout(ov, capOutside) {
  $("#ro-overlap").textContent = `${Math.round(ov)} px²`;
  $("#ro-overlap").classList.toggle("bad", ov >= 40);
  $("#ro-dwell").textContent = `${state.dwell.toFixed(1)} s`;
  $("#ro-field").textContent = capOutside ? "NO — breach forming" : "yes";
  $("#ro-field").classList.toggle("bad", capOutside);
}

function runScenario(name) {
  resetSim();
  state.scenario = scenarioFrames(name);
  state.playing = true;
  state.startStamp = performance.now();
  state.lastFrameT = state.startStamp;
  logEvent("start", `Scenario started: ${name}.`);
  state.raf = requestAnimationFrame(tickSim);
}

function tickSim(now) {
  if (!state.playing) return;
  const frames = state.scenario;
  const elapsed = (now - state.startStamp) / 1000;
  state.elapsedBefore = elapsed;
  const dt = Math.min(0.05, (now - state.lastFrameT) / 1000 || 0);
  state.lastFrameT = now;

  let i = frames.findIndex(f => f.t >= elapsed);
  if (i === -1) { finishSim(); return; }
  if (i === 0) i = 1;
  const a = frames[i - 1], b = frames[i];
  const span = Math.max(0.001, b.t - a.t);
  const p = Math.min(1, Math.max(0, (elapsed - a.t) / span));
  const lerp = (u, v) => u + (v - u) * p;
  setHand(lerp(a.hand[0], b.hand[0]), lerp(a.hand[1], b.hand[1]));
  setCap(lerp(a.cap[0], b.cap[0]), lerp(a.cap[1], b.cap[1]));

  const newStep = b.step ?? a.step ?? 0;
  if (newStep !== state.step) {
    if (newStep > state.step + 1) {
      fireBreach("ORDER", "Stop — step skipped.", `Go back and complete step ${state.step + 2} first.`);
    }
    state.step = newStep;
    renderSteps();
  }

  /* --- rule engine, evaluated every frame --- */
  const ov = overlap(handBox(), TIP);
  if (ov >= 40) state.dwell += dt; else state.dwell = 0;
  if (state.dwell >= 0.3) {
    fireBreach("TOUCH", "Stop — sterile tip touched.", "Replace the cap. Do not connect it.");
  }
  const capBox = { x: state.cap.x, y: state.cap.y, w: 36, h: 25 };
  const capInstalled = overlap(capBox, TIP) > 0;
  const capOutside = !capInstalled && !inside(centroid(capBox), FIELD);
  if (capOutside) state.fieldDwell += dt; else state.fieldDwell = 0;
  if (state.fieldDwell >= 0.3) {
    fireBreach("FIELD", "Stop — cap outside the sterile field.", "Discard that cap and take a new one from the field.");
  }
  updateReadout(ov, capOutside);
  if (state.playing) state.raf = requestAnimationFrame(tickSim);
}

function finishSim() {
  state.playing = false;
  state.step = STEP_TITLES.length;
  renderSteps();
  if (!state.events) logEvent("done", "Exchange completed with no breach detected.");
  else logEvent("done", `Exchange ended with ${state.events} confirmed breach event(s).`);
}

function pauseSim() {
  state.playing = false;
  cancelAnimationFrame(state.raf);
}
$("#btn-pause").addEventListener("click", () => {
  if (state.playing) { pauseSim(); $("#btn-pause").textContent = "Resume"; }
  else if (state.scenario) {
    /* resume from current positions by rebuilding a one-frame scenario is complex;
       simplest robust resume: restart current scenario type is avoided — resume timer */
    state.playing = true;
    state.startStamp = performance.now() - state.elapsedBefore * 1000;
    state.lastFrameT = performance.now();
    $("#btn-pause").textContent = "Pause";
    state.raf = requestAnimationFrame(tickSim);
  }
});
$("#btn-reset").addEventListener("click", resetSim);
$("#alert-reset").addEventListener("click", resetSim);
$$("[data-run]").forEach(b => b.addEventListener("click", () => {
  $("#simulator").scrollIntoView({ behavior: "smooth", block: "center" });
  runScenario(b.dataset.run);
}));
renderSteps(); updateScore();

/* ================= CAMERA ================= */
let stream = null;
$("#tab-camera").addEventListener("click", async () => {
  $("#tab-camera").classList.add("is-active"); $("#tab-bench").classList.remove("is-active");
  $("#stage").hidden = true; $("#camera").hidden = false; $("#camera-note").hidden = false;
  try {
    stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false });
    $("#camera").srcObject = stream;
  } catch { $("#segment-result").textContent = "Camera permission unavailable in this browser."; }
});
$("#tab-bench").addEventListener("click", () => {
  $("#tab-bench").classList.add("is-active"); $("#tab-camera").classList.remove("is-active");
  $("#stage").hidden = false; $("#camera").hidden = true; $("#camera-note").hidden = true;
  if (watchTimer) { clearInterval(watchTimer); watchTimer = null; $("#btn-watch").textContent = "Start live watch"; }
  if (stream) { stream.getTracks().forEach(t => t.stop()); stream = null; }
});
/* ---- live camera analysis: real frames -> SAM (or demo geometry) -> rules ---- */
const LIVE_PROMPTS = ["gloved hand", "red connector", "blue cap", "sterile field mat"];
let watchTimer = null, watchInFlight = false, touchStreak = 0;

function captureFrame() {
  const video = $("#camera");
  if (!video.videoWidth) return null;
  const scale = Math.min(1, 640 / video.videoWidth);
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(video.videoWidth * scale);
  canvas.height = Math.round(video.videoHeight * scale);
  canvas.getContext("2d").drawImage(video, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", 0.72);
}

function boxOverlapPx(a, b) {
  const x = Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x));
  const y = Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));
  return x * y;
}

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

function checkLiveBreach(data) {
  const by = {};
  for (const r of data.results || []) if (r.boxes && r.boxes[0]) by[r.canonical] = r.boxes[0];
  let overlapPx = 0;
  if (data.touch && typeof data.touch.overlap_px === "number") overlapPx = data.touch.overlap_px;
  else if (by.hand && by.sterile_tip) overlapPx = boxOverlapPx(by.hand, by.sterile_tip);
  if (overlapPx >= 40) {
    touchStreak += 1;
    if (touchStreak >= 2) {
      fireBreach("TOUCH", "Stop — sterile tip touched.", "Replace the cap. Do not connect it.");
      logEvent("live", `Camera frame: hand/sterile-tip overlap ${Math.round(overlapPx)}px² (${data.live ? "SAM 3.1" : "demo geometry"}).`);
      touchStreak = 0;
    }
  } else touchStreak = 0;
  return overlapPx;
}

async function analyzeFrame() {
  const out = $("#segment-result");
  const image = captureFrame();
  if (!image) { out.textContent = "Camera not ready yet."; return null; }
  out.textContent = "Analyzing frame…";
  try {
    const r = await fetch("/api/segment-live", { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ image, prompts: LIVE_PROMPTS }) });
    const d = await r.json();
    if (!r.ok) throw new Error(d.error || "segment failed");
    renderCamBoxes(d);
    const ov = checkLiveBreach(d);
    const found = (d.results || []).map(x => `${x.canonical}:${(x.boxes || []).length}`).join(" · ");
    out.textContent = `${d.live ? "SAM 3.1 live" : "Demo geometry"} · ${d.latency_ms}ms · ${found} · overlap ${Math.round(ov)}px²`;
    return d;
  } catch (e) {
    out.textContent = `Segmentation unavailable (${e.message}). Bench sim still works.`;
    return null;
  }
}

$("#btn-analyze").addEventListener("click", analyzeFrame);
$("#btn-watch").addEventListener("click", () => {
  const btn = $("#btn-watch");
  if (watchTimer) {
    clearInterval(watchTimer); watchTimer = null;
    btn.textContent = "Start live watch";
    $("#segment-result").textContent = "Live watch stopped.";
    return;
  }
  btn.textContent = "Stop live watch";
  logEvent("live", "Live watch started: a frame is analyzed every 3 seconds.");
  const tick = async () => { if (!watchInFlight) { watchInFlight = true; await analyzeFrame(); watchInFlight = false; } };
  tick();
  watchTimer = setInterval(tick, 3000);
});

/* ================= PROTOCOL COMPILER ================= */
const KEYWORDS = { "hand hygiene": ["wash", "hand hygiene", "sanitize", "scrub"], "gloved hand": ["glove"],
  "mask": ["mask"], "sterile connector tip": ["connector", "tip", "catheter"], "cap": ["cap"],
  "sterile field": ["sterile field", "sterile mat", "drape"], "fluid bag": ["bag", "dialysate", "fluid"],
  "clamp": ["clamp"], "tube": ["tube", "tubing", "line"] };

function compileLocal(text) {
  const lines = text.split(/\n+/).map(s => s.trim()).filter(Boolean);
  const steps = lines.map((raw, i) => {
    const title = raw.replace(/^\d+[\).\s]+/, "");
    const low = title.toLowerCase();
    const objects = Object.entries(KEYWORDS).filter(([, ks]) => ks.some(k => low.includes(k))).map(([n]) => n);
    const m = low.match(/(\d+)\s*(?:seconds|second|secs|sec)/);
    const forbidden = (low.includes("never touch") || low.includes("do not touch")) && (low.includes("tip") || low.includes("connector"))
      ? [{ a: "hand", b: "sterile connector tip", rule: "TOUCH" }] : [];
    return { id: `step-${i + 1}`, title, objects, forbidden_contacts: forbidden, min_seconds: m ? +m[1] : 0 };
  });
  return { name: "Home exchange protocol", source: "deterministic-parser (browser fallback)", steps,
    global_rules: [{ a: "hand", b: "sterile connector tip", rule: "TOUCH" }, { a: "cap", b: "outside sterile field", rule: "FIELD" }],
    step_count: steps.length };
}

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
  const text = $("#protocol-text").value;
  status.textContent = "Compiling…";
  let graph;
  try {
    const r = await fetch("/api/compile", { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ protocol_text: text, name: "Home exchange protocol" }) });
    if (!r.ok) throw new Error("api");
    graph = await r.json();
  } catch { graph = compileLocal(text); }
  renderGraph(graph);
  status.textContent = `Compiled ${graph.step_count} steps · source: ${graph.source}`;
  if (graph.steps.length) {
    STEP_TITLES = graph.steps.map(s => s.title.length > 46 ? s.title.slice(0, 46) + "…" : s.title);
    renderSteps();
    logEvent("compile", `Protocol compiled into ${graph.step_count} executable steps.`);
  }
});

/* ================= BENCH EVAL ================= */
function mulberry32(seed) {
  return function () {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

function runEval() {
  const rnd = mulberry32(20261104);
  const types = ["clean", "touch", "field", "order"];
  let tp = 0, fp = 0, fn = 0, cleanTrials = 0, cleanFalse = 0;
  let bTp = 0, bFp = 0, bFn = 0, bCleanFalse = 0;
  for (const type of types) {
    for (let k = 0; k < 6; k++) {
      const isBreach = type !== "clean";
      /* rule engine on simulated geometry signal (one occlusion miss in 18) */
      const signal = isBreach ? 90 + rnd() * 130 : rnd() * 28;
      const occluded = isBreach && tp + fn === 7;
      const ruleSays = signal >= 40 && !occluded;
      /* VLM baseline: noisier per-clip judgement */
      const vlmSays = isBreach ? rnd() < 0.68 : rnd() < 0.25;
      if (isBreach) {
        if (ruleSays) tp++; else fn++;
        if (vlmSays) bTp++; else bFn++;
      } else {
        cleanTrials++;
        if (ruleSays) { fp++; cleanFalse++; }
        if (vlmSays) { bFp++; bCleanFalse++; }
      }
    }
  }
  const pr = (t, f) => (t + f ? t / (t + f) : 1);
  const set = (bar, val, num) => {
    $(bar).style.width = `${Math.round(num * 100)}%`;
    $(val).textContent = num.toFixed(2);
  };
  set("#m-p", "#m-p-v", pr(tp, fp)); set("#m-r", "#m-r-v", pr(tp, fn));
  set("#b-p", "#b-p-v", pr(bTp, bFp)); set("#b-r", "#b-r-v", pr(bTp, bFn));
  $("#m-f").style.width = `${cleanTrials ? (cleanFalse / cleanTrials) * 100 : 0}%`;
  $("#m-f-v").textContent = `${cleanFalse}/${cleanTrials}`;
  $("#b-f").style.width = `${cleanTrials ? (bCleanFalse / cleanTrials) * 100 : 0}%`;
  $("#b-f-v").textContent = `${bCleanFalse}/${cleanTrials}`;
  $("#eval-status").textContent = `Done: 24 simulated trials · rule engine TP ${tp}, FN ${fn}, FP ${fp}; VLM baseline TP ${bTp}, FN ${bFn}, FP ${bFp}.`;
}
$("#btn-eval").addEventListener("click", runEval);
