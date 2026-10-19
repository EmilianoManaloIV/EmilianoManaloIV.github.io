// Motion, console, headline, device readout, and toggles; see ADR 0002. No network use.
import { torus, dome, grid, cube, sphere, waveHeight, rotate, project, bezierPatches, uprightUnit, fitUnit, headset, icosphere, fitScale } from "./geometry.js";
import { teapotPoints, teapotPatches } from "./models.js";

const root = document.documentElement;
const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
const systemDark = matchMedia("(prefers-color-scheme: dark)");
const banner = document.querySelector(".banner");
const terminal = document.querySelector(".terminal");
// Clips in posts and project cards (ADR 0007) play only under the motion gate below.
const clips = document.querySelectorAll("video[data-clip]");
// Motion runs only where the visitor can pause it (WCAG 2.2.2). Every page has a
// toggle in the shared footer, plus one in the home banner; all share one state.
// A remembered choice wins; otherwise reduced-motion visitors start paused.
const motionButtons = [...document.querySelectorAll("[data-motion-toggle]")];
const pausable = motionButtons.length > 0;
let savedMotion = null;
try {
  savedMotion = localStorage.getItem("motion");
} catch (e) {
  // Storage can be blocked; the system setting still applies.
}
let motion = pausable && (savedMotion ? savedMotion === "on" : !reducedMotion.matches);
let bannerVisible = false;
let time = 0;
const rand = (max) => Math.floor(Math.random() * max);
const pad = (n, len = 2) => String(n).padStart(len, "0");

// == Wireframe scenes

const meshes = {
  dome: dome(28),
  wave: grid(18),
  torus: torus(1, 0.42, 36, 16),
  cube: cube(4),
  globe: sphere(10, 7),
  teapot: uprightUnit(bezierPatches(teapotPoints, teapotPatches, 3, 6)),
  headset: fitUnit(headset()),
  icosa: icosphere(1),
};

function strokeMesh(ctx, mesh, transform) {
  ctx.beginPath();
  const points = mesh.vertices.map(transform);
  for (const [a, b] of mesh.edges) {
    ctx.moveTo(points[a][0], points[a][1]);
    ctx.lineTo(points[b][0], points[b][1]);
  }
  ctx.stroke();
}

// One source of truth for motion: [x angle, y angle] at time t. The painters
// and the console telemetry both read these, so the numbers match the shapes.
const TAU = Math.PI * 2;
const poses = {
  dome: (t) => [0.45, t * 0.35],
  wave: () => [0.55, -0.6], // the surface itself ripples with phase t * 2.2
  cube: (t) => [0.55 + t * 0.12, t * 0.22],
  globe: (t) => [0.35, t * 0.6],
  torus: (t) => [1 + Math.sin(t * 0.3) * 0.25, t * 0.4],
  teapot: (t) => [0.35 + Math.sin(t * 0.25) * 0.15, t * 0.3],
  headset: (t) => [0.3 + Math.sin(t * 0.2) * 0.12, 2.6 + t * 0.28],
  ambient: (t) => [0.4 + Math.sin(t * 0.05) * 0.2, (t * TAU) / 90], // one turn per 90 s
};
// Hands-on models (ADR 0009): a visitor's own turn, added on top of the pose.
const turns = {};
const posed = (name) => poses[name](time).map((a, i) => a + (turns[name]?.[i] || 0));

// Banner layout: the dome and wave at their designed spots, shrunk and nudged only
// when they would spill past the canvas (narrow phones). Measured once per size
// over sampled poses, so the moving shapes never hit the edge.
let layoutKey = "";
let layout = null;
function bannerLayout(w, h) {
  if (layoutKey === `${w}x${h}`) return layout;
  const m = 8;
  // A collapsed or tiny canvas has nothing to fit; avoid a negative or NaN scale.
  if (w <= 4 * m || h <= 4 * m) return { dome: [w * 0.36, h * 0.36, 0], wave: [w * 0.62, h * 0.72, 0] };
  const s = Math.min(w, h);
  const place = (k, ox, oy) => ({
    dome: [w * 0.36 + ox, h * 0.36 + oy, s * 0.24 * k],
    wave: [w * 0.62 + ox, h * 0.72 + oy, s * 0.42 * k],
  });
  const bounds = (spots) => {
    const box = [Infinity, Infinity, -Infinity, -Infinity];
    const add = ([x, y]) => {
      box[0] = Math.min(box[0], x);
      box[1] = Math.min(box[1], y);
      box[2] = Math.max(box[2], x);
      box[3] = Math.max(box[3], y);
    };
    for (let i = 0; i < 8; i++) {
      const t = i * 2.5;
      const [dx, dy] = poses.dome(t);
      for (const p of meshes.dome.vertices) add(project(rotate(p, dx, dy), ...spots.dome));
      for (const [x, , z] of meshes.wave.vertices) add(project(rotate([x, waveHeight(x, z, t), z], ...poses.wave(t)), ...spots.wave));
    }
    return box;
  };
  let box = bounds(place(1, 0, 0));
  const k = Math.min(1, (w - 2 * m) / (box[2] - box[0]), (h - 2 * m) / (box[3] - box[1]));
  box = bounds(place(k, 0, 0));
  const shift = (lo, hi, size) => (lo < m ? m - lo : hi > size - m ? size - m - hi : 0);
  layoutKey = `${w}x${h}`;
  layout = place(k, shift(box[0], box[2], w), shift(box[1], box[3], h));
  return layout;
}

const painters = {
  banner(ctx, w, h, t) {
    const spots = bannerLayout(w, h);
    const [dx, dy] = poses.dome(t);
    const [wx, wy] = poses.wave(t);
    strokeMesh(ctx, meshes.dome, (p) => project(rotate(p, dx, dy), ...spots.dome));
    strokeMesh(ctx, meshes.wave, ([x, , z]) => project(rotate([x, waveHeight(x, z, t), z], wx, wy), ...spots.wave));
  },
  cube(ctx, w, h, t) {
    const [ax, ay] = poses.cube(t);
    strokeMesh(ctx, meshes.cube, (p) => project(rotate(p, ax, ay), w / 2, h / 2, Math.min(w, h) * 0.24, 5));
  },
  globe(ctx, w, h, t) {
    const [ax, ay] = poses.globe(t);
    strokeMesh(ctx, meshes.globe, (p) => project(rotate(p, ax, ay), w / 2, h / 2, w * 0.44, 6));
  },
  torus(ctx, w, h) {
    const [ax, ay] = posed("torus");
    strokeMesh(ctx, meshes.torus, (p) => project(rotate(p, ax, ay), w / 2, h / 2, Math.min(w, h) * 0.3));
  },
  teapot(ctx, w, h) {
    const [ax, ay] = posed("teapot");
    strokeMesh(ctx, meshes.teapot, (p) => project(rotate(p, ax, ay), w / 2, h / 2, Math.min(w, h) * 0.6, 5));
  },
  // The big-screen ambient sphere (ADR 0009): large, cropped by the right edge, and
  // drifting gently with the page so it reads as depth behind it.
  ambient(ctx, w, h) {
    const [ax, ay] = poses.ambient(ambientTime);
    const y = h * 0.5 + Math.sin(scrollY / 900) * h * 0.12;
    strokeMesh(ctx, meshes.icosa, (p) => project(rotate(p, ax, ay), w * 0.94, y, h * 0.42, 6));
  },
  headset(ctx, w, h) {
    const [ax, ay] = posed("headset");
    // Its strap swings toward the viewer as it turns, so it is sized to stay inside
    // its frame at any angle, with a little breathing room (ADR 0009).
    strokeMesh(ctx, meshes.headset, (p) => project(rotate(p, ax, ay), w / 2, h / 2, (Math.min(w, h) / 2) * 0.94 * headsetFit, 5));
  },
};

const scenes = [...document.querySelectorAll("canvas[data-scene]")].map((canvas) => ({
  canvas,
  ctx: canvas.getContext("2d"),
  paint: painters[canvas.dataset.scene],
  visible: false,
  color: "",
}));
// The ambient sphere is always "on screen" where it shows, so it runs on its own
// slow timer (about 15 frames a second, with its own clock) instead of keeping the
// full-rate frame loop busy on every big-screen page.
const ambient = scenes.find((s) => s.canvas.dataset.scene === "ambient");
const motionScenes = scenes.filter((s) => s !== ambient);
let ambientTime = 0;
const headsetFit = fitScale(meshes.headset, 5);
let ambientTimer = 0;

// Pixel ratio per scene, capped at 2. The full-screen ambient sphere draws at 1x:
// faint thin lines don't need retina sharpness, and it saves most of the fill.
const ratio = (scene) => (scene.canvas.dataset.scene === "ambient" ? 1 : Math.min(devicePixelRatio || 1, 2));

function resize(scene) {
  const dpr = ratio(scene);
  const { clientWidth: w, clientHeight: h } = scene.canvas;
  scene.canvas.width = Math.round(w * dpr);
  scene.canvas.height = Math.round(h * dpr);
  scene.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function draw(scene) {
  const { ctx, canvas } = scene;
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  // Never draw into a stale bitmap: the observer can arrive after the first frames,
  // and pixel ratio changes (zoom, rotation, another monitor) don't trigger it.
  const dpr = ratio(scene);
  if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) resize(scene);
  ctx.clearRect(0, 0, w, h);
  ctx.strokeStyle = scene.color;
  ctx.globalAlpha = 0.85;
  ctx.lineWidth = 0.75;
  scene.paint(ctx, w, h, time);
}

function refreshColors() {
  for (const scene of scenes) {
    scene.color = getComputedStyle(scene.canvas).color;
    draw(scene);
  }
}

let frame = 0;
let last = 0;
let frames = 0;
let dt = 16.7;
const revs = {};
function tick(now) {
  frame = 0;
  const delta = now - (last || now);
  time += Math.min(delta / 1000, 0.1);
  last = now;
  frames++;
  if (delta) dt += (delta - dt) * 0.1;
  // Log each full Y turn a shape completes, only while the console is on screen
  // to read it; off screen the count still advances so nothing replays stale.
  for (const name of ["dome", "cube", "globe", "torus"]) {
    const rev = Math.floor(poses[name](time)[1] / TAU);
    if (bannerVisible && rev > (revs[name] ?? rev)) log(`${name.toUpperCase().padEnd(6)} REV ${pad(rev)} COMPLETE`);
    revs[name] = rev;
  }
  for (const scene of motionScenes) if (scene.visible) draw(scene);
  schedule();
}

// == Live console: telemetry from the shapes above, sized to fill its box

const cursor = document.createElement("span");
cursor.className = "cursor";
const angle = (a) => (((a % TAU) + TAU) % TAU).toFixed(3);
const pose = (name) => posed(name).map((a, i) => `${i ? "RY" : "RX"} ${angle(a)}`).join("  ");
const shown = (name) => (scenes.find((s) => s.canvas.dataset.scene === name)?.visible ? 1 : 0);
// Each line names the scene it reports on. The home console reports everything; a
// subpage's echo reports only what is on that page (ADR 0009).
const sceneOf = (mesh) => (mesh === "dome" || mesh === "wave" ? "banner" : mesh === "icosa" ? "ambient" : mesh);
// A scene counts only if it is actually shown (the ambient sphere is display:none
// below 1600px, for instance).
const onPage = (scene) => !scene || scenes.some((s) => s.canvas.dataset.scene === scene && s.canvas.getClientRects().length);
// Console names fit the 6-character column; the headset is an HMD (head-mounted display).
const label = (mesh) => (mesh === "headset" ? "HMD" : mesh.toUpperCase());
const script = [
  ["banner", () => `DOME   ${pose("dome")}  VTX ${meshes.dome.vertices.length}`],
  ["banner", () => `WAVE   PHASE ${angle(time * 2.2)}  CTR ${(Math.round(waveHeight(0, 0, time) * 1000) / 1000 || 0).toFixed(3)}`],
  ["cube", () => `CUBE   ${pose("cube")}  EDG ${meshes.cube.edges.length}`],
  ["globe", () => `GLOBE  RY ${angle(poses.globe(time)[1])}  VTX ${meshes.globe.vertices.length}`],
  ["torus", () => `TORUS  ${pose("torus")}  VIS ${shown("torus")}`],
  ["teapot", () => `TEAPOT ${pose("teapot")}  PATCH ${teapotPatches.length / 16}`],
  ["headset", () => `HMD    ${pose("headset")}  VTX ${meshes.headset.vertices.length}`],
  // Before any frame is drawn, DT and FPS would be placeholders; say so instead.
  [null, () => (frames ? `FRAME  ${frames}  DT ${dt.toFixed(1)}ms  FPS ${Math.round(1000 / dt)}` : "FRAME  IDLE  NO SCENE ON SCREEN")],
  ["banner", () => `SCENE  BANNER ${shown("banner")}  CUBE ${shown("cube")}  GLOBE ${shown("globe")}  TORUS ${shown("torus")}`],
]
  .filter(([scene]) => onPage(scene))
  .map(([, line]) => line);
// Events jump the queue so they type next; capped so a long pause can't pile them up.
const events = [];
const log = (line) => events.push(line) > 4 && events.shift();
const next = () => events.shift() || script[step++ % script.length]();
const lines = [];
let maxLines = 8;
let current = "";
let target = "";
let step = 0;
let typing = 0;

function fitTerminal() {
  if (terminal) {
    const style = getComputedStyle(terminal);
    const inner = terminal.clientHeight - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom);
    maxLines = Math.max(3, Math.floor(inner / parseFloat(style.lineHeight)) - 1);
  } else {
    maxLines = 12; // subpages: the echoes alone, which show about a dozen lines
  }
  while (lines.length > maxLines) lines.shift();
  if (!target) target = next();
  fillTerminal();
}

// Start like a real console: a boot log of the loaded meshes, then one telemetry
// pass; it grows from there instead of repeating identical time-zero readings.
function fillTerminal() {
  if (!lines.length) {
    for (const [name, mesh] of Object.entries(meshes)) {
      if (onPage(sceneOf(name))) lines.push(`LOAD   ${label(name).padEnd(6)} VTX ${mesh.vertices.length}  EDG ${mesh.edges.length}`);
    }
    for (let i = 0; i < script.length; i++) lines.push(next());
  }
  while (lines.length > maxLines) lines.shift();
  renderTerminal();
}

// Faint copies of the console behind empty areas (ADR 0008), refreshed per finished
// line. Subpages have echoes but no console; the same telemetry runs for them alone.
const echoes = document.querySelectorAll(".terminal-echo");
let echoSeen = false;
let lineAt = 0;
function renderTerminal() {
  if (terminal) {
    terminal.textContent = lines.concat(current).join("\n");
    terminal.append(cursor);
  }
  if (!current) for (const echo of echoes) echo.textContent = lines.join("\n");
}

function type() {
  typing = 0;
  if (current.length < target.length) {
    // Typed a character at a time where someone can read it; whole lines otherwise.
    current = terminal ? target.slice(0, current.length + 1) : target;
  } else {
    lines.push(current);
    while (lines.length > maxLines) lines.shift();
    // On a subpage with no model on screen, no frames advance the shapes' clock, so
    // the echo would repeat frozen readings; keep the clock running in real time.
    if (!terminal) {
      const now = performance.now();
      if (!frame) time += Math.min((now - (lineAt || now)) / 1000, 3);
      lineAt = now;
    }
    target = next();
    current = "";
  }
  renderTerminal();
  typing = setTimeout(type, current !== "" ? 22 : terminal ? 260 : 1800);
}

function startTerminal() {
  if (typing || !(terminal || echoes.length)) return;
  if (!target) fitTerminal();
  type();
}

// == Headline decode scramble

const words = [...document.querySelectorAll("[data-scramble]")];
const originals = words.map((el) => el.textContent);
const glyphs = "01<>/\\|_-+=*#%";
let scrambleTimer = 0;
let scrambleStart = 0;
let scrambledOnce = false;

function scrambleFrame() {
  const elapsed = performance.now() - scrambleStart;
  let done = true;
  words.forEach((el, i) => {
    let out = "";
    for (let c = 0; c < originals[i].length; c++) {
      const locked = elapsed >= i * 220 + c * 45 + 150;
      if (!locked) done = false;
      out += locked ? originals[i][c] : glyphs[rand(glyphs.length)];
    }
    el.textContent = out;
  });
  if (done) {
    scrambleStart = 0;
    scrambleTimer = setTimeout(beginScramble, 12000);
  } else {
    scrambleTimer = setTimeout(scrambleFrame, 40);
  }
}

function beginScramble() {
  log("DECODE HEADLINE");
  scrambledOnce = true;
  scrambleStart = performance.now();
  scrambleFrame();
}

function startScramble() {
  if (scrambleTimer || !words.length) return;
  scrambleTimer = setTimeout(beginScramble, scrambledOnce ? 12000 : 300);
}

// Pausing always leaves the real words in place. The early return keeps the
// per-frame gate from rewriting the words while the banner is off screen.
function stopScramble() {
  if (!scrambleTimer && !scrambleStart) return;
  clearTimeout(scrambleTimer);
  scrambleTimer = 0;
  scrambleStart = 0;
  words.forEach((el, i) => (el.textContent = originals[i]));
}

// == Device readout: the visitor's own machine, display only

const field = (name) => document.querySelector(`[data-device="${name}"]`);
const loadedAt = Date.now();
const ua = navigator.userAgent;
const uaData = navigator.userAgentData;
// Checked in order: Android UAs also contain "Linux", and iPads can claim "Mac".
const os = uaData?.platform || ["Windows", "Android", "iPhone", "iPad", "Mac", "Linux"].find((k) => ua.includes(k)) || "Unknown";
const brand = uaData?.brands?.find((b) => !/Not|Chromium/.test(b.brand));
// iOS uses CriOS/FxiOS; Safari's version is "Version/17", its "Safari/605" token is WebKit.
const [, name = "Browser", version = ""] = ua.match(/(Firefox|FxiOS|Edg|CriOS|Chrome|Version)\/(\d+)/) || [];
const names = { Version: "Safari", CriOS: "Chrome", FxiOS: "Firefox" };
const browser = brand ? `${brand.brand} ${brand.version}` : `${names[name] || name} ${version}`;
let clockTimer = 0;

function showDevice() {
  if (!field("title")) return;
  const memory = navigator.deviceMemory ? `${navigator.deviceMemory} GB` : "mem N/A";
  field("title").textContent = `${os} · ${browser}`;
  field("spec").textContent = `${navigator.hardwareConcurrency || "?"} cores · ${memory}`;
  field("display").textContent = `${screen.width}×${screen.height} @${+devicePixelRatio.toFixed(2)}x · vp ${innerWidth}×${innerHeight}`;
  field("clock-title").textContent = "Local";
  field("link-title").textContent = "Link";
  showClock();
}

function showClock() {
  const now = new Date();
  const up = Math.floor((Date.now() - loadedAt) / 1000);
  const net = navigator.connection?.effectiveType || (navigator.onLine ? "online" : "offline");
  field("clock").textContent = `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
  field("link").textContent = `${net} · up ${pad(Math.floor(up / 60))}:${pad(up % 60)}`;
}

function tickClock() {
  showClock();
  clockTimer = setTimeout(tickClock, 1000 - (Date.now() % 1000));
}

// == One gate for all motion
// Everything moves only when motion is on, the tab is visible, and its element is on screen.

function schedule() {
  const awake = motion && !document.hidden;
  // Clips change only when their gate does, so a visitor's own play or pause holds
  // until motion, visibility, or the clip's place on screen changes.
  for (const clip of clips) {
    const want = awake && clip.seen === true;
    if (want !== clip.want) want ? clip.play().catch(() => {}) : clip.pause();
    clip.want = want;
  }
  if (awake && motionScenes.some((s) => s.visible)) {
    if (!frame) frame = requestAnimationFrame(tick);
  } else {
    last = 0;
  }
  if (awake && ambient?.visible) {
    ambientTimer ||= setInterval(() => {
      ambientTime += 1 / 15;
      draw(ambient);
    }, 1000 / 15);
  } else {
    clearInterval(ambientTimer);
    ambientTimer = 0;
  }
  if (awake && (bannerVisible || echoSeen)) {
    startTerminal();
  } else {
    clearTimeout(typing);
    typing = 0;
  }
  if (awake && bannerVisible) {
    startScramble();
    if (!clockTimer && field("clock")) tickClock();
  } else {
    stopScramble();
    clearTimeout(clockTimer);
    clockTimer = 0;
  }
}

const resizer = new ResizeObserver((entries) => {
  for (const entry of entries) {
    if (entry.target === terminal) {
      fitTerminal();
      continue;
    }
    const scene = scenes.find((s) => s.canvas === entry.target);
    resize(scene);
    draw(scene);
  }
});
const watcher = new IntersectionObserver((entries) => {
  for (const entry of entries) {
    if (entry.target === banner) bannerVisible = entry.isIntersecting;
    else if (entry.target.localName === "video") entry.target.seen = entry.isIntersecting;
    else if (entry.target.localName === "pre") echoSeen = entry.isIntersecting;
    else scenes.find((s) => s.canvas === entry.target).visible = entry.isIntersecting;
  }
  schedule();
});
for (const scene of scenes) {
  resizer.observe(scene.canvas);
  watcher.observe(scene.canvas);
}
for (const clip of clips) watcher.observe(clip);
// On subpages the echo is what's on screen; on the home page the banner gates it.
if (!terminal) for (const echo of echoes) watcher.observe(echo);
if (terminal) resizer.observe(terminal);
if (banner) watcher.observe(banner);
document.addEventListener("visibilitychange", schedule);
addEventListener("resize", showDevice);

// == Hands-on models (ADR 0009): direct manipulation with visible feedback.
// Focusable canvases turn by drag or arrow keys; Home or "Reset view" undoes it.
// Redraws happen even with motion paused, since the visitor drives this motion,
// at most once per frame however fast the pointer reports.

function redraw(scene) {
  scene.pending ||= requestAnimationFrame(() => {
    scene.pending = 0;
    draw(scene);
  });
}

// The model follows the hand: dragging right brings its front to the right, and
// dragging down brings it down. (rotate() puts the near side at -z.)
function turn(scene, dx, dy) {
  const t = (turns[scene.canvas.dataset.scene] ||= [0, 0]);
  t[0] -= dy;
  t[1] -= dx;
  redraw(scene);
}

function reset(scene) {
  const name = scene.canvas.dataset.scene;
  delete turns[name];
  redraw(scene);
  log(`USER RESET ${name.toUpperCase()}`);
}

const KEYS = { ArrowUp: [0, -0.2], ArrowDown: [0, 0.2], ArrowLeft: [-0.2, 0], ArrowRight: [0.2, 0] };
for (const scene of scenes.filter((s) => s.canvas.tabIndex >= 0)) {
  const { canvas } = scene;
  const name = canvas.dataset.scene.toUpperCase();
  let drag = null; // { id, x, y } for the one pointer turning the model
  canvas.addEventListener("pointerdown", (e) => {
    // Primary button or a touch only, one pointer at a time.
    if (drag || !e.isPrimary || e.button !== 0) return;
    drag = { id: e.pointerId, x: e.clientX, y: e.clientY };
    canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener("pointermove", (e) => {
    if (drag?.id !== e.pointerId) return;
    turn(scene, (e.clientX - drag.x) / 90, (e.clientY - drag.y) / 90);
    drag.x = e.clientX;
    drag.y = e.clientY;
  });
  const release = (e) => {
    if (drag?.id !== e.pointerId) return;
    log(`USER ROTATE ${name}`);
    drag = null;
  };
  for (const type of ["pointerup", "pointercancel", "lostpointercapture"]) canvas.addEventListener(type, release);
  canvas.addEventListener("keydown", (e) => {
    // Leave browser shortcuts (Alt+Left is Back) alone.
    if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
    if (e.key === "Home") reset(scene);
    else if (KEYS[e.key]) turn(scene, ...KEYS[e.key]);
    else return;
    e.preventDefault();
    // One log line per press, so a held key can't push other events out of the queue.
    if (KEYS[e.key] && !e.repeat) log(`USER ROTATE ${name}`);
  });
  canvas.closest(".model").querySelector("[data-reset]")?.addEventListener("click", () => reset(scene));
}

// == Toggles
// Fixed accessible names; aria-pressed carries the state, and the visible
// ": on/off" suffix is aria-hidden so the state is not announced twice.

const themeButton = document.getElementById("theme-toggle");
const showState = (button, on) => {
  button.setAttribute("aria-pressed", String(on));
  button.querySelector("[data-state]").textContent = on ? ": on" : ": off";
};

function setMotion(on) {
  if (on && !motion) log("MOTION RESUME");
  // Typing stops as soon as motion halts, so print the halt line immediately.
  // The half-typed line stays as an interrupted entry; it retypes in full on resume.
  if (!on && motion && target) {
    if (current) lines.push(current);
    current = "";
    lines.push("MOTION HALT");
    while (lines.length > maxLines) lines.shift();
    renderTerminal();
  }
  motion = on;
  root.classList.toggle("motion-off", !on);
  for (const button of motionButtons) showState(button, on);
  schedule();
}

// A click is a choice to remember, across pages and visits.
function chooseMotion() {
  setMotion(!motion);
  savedMotion = motion ? "on" : "off";
  try {
    localStorage.setItem("motion", savedMotion);
  } catch (e) {
    // The choice still applies on this page.
  }
}

function isDark() {
  const chosen = root.getAttribute("data-theme");
  return chosen ? chosen === "dark" : systemDark.matches;
}

function syncThemeButton() {
  showState(themeButton, isDark());
}

for (const button of motionButtons) button.addEventListener("click", chooseMotion);
// The system setting only decides when the visitor hasn't chosen.
reducedMotion.addEventListener("change", (e) => {
  if (!savedMotion) setMotion(pausable && !e.matches);
});

themeButton.addEventListener("click", () => {
  const theme = isDark() ? "light" : "dark";
  root.setAttribute("data-theme", theme);
  try {
    localStorage.setItem("theme", theme);
  } catch (e) {
    // The choice still applies for this visit.
  }
  syncThemeButton();
  refreshColors();
});
systemDark.addEventListener("change", () => {
  syncThemeButton();
  refreshColors();
});

showDevice();
syncThemeButton();
setMotion(motion);
refreshColors();
root.classList.add("js-ready");
