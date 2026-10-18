// Motion, console, headline, device readout, and toggles; see ADR 0002. No network use.
import { torus, dome, grid, cube, sphere, waveHeight, rotate, project } from "./geometry.js";

const root = document.documentElement;
const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
const systemDark = matchMedia("(prefers-color-scheme: dark)");
const banner = document.querySelector(".banner");
const terminal = document.querySelector(".terminal");
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
  wave: () => [0.55, -0.6], // the surface itself ripples with phase t * 1.6
  cube: (t) => [0.55 + t * 0.12, t * 0.22],
  globe: (t) => [0.35, t * 0.6],
  torus: (t) => [1 + Math.sin(t * 0.3) * 0.25, t * 0.4],
};

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
  torus(ctx, w, h, t) {
    const [ax, ay] = poses.torus(t);
    strokeMesh(ctx, meshes.torus, (p) => project(rotate(p, ax, ay), w / 2, h / 2, Math.min(w, h) * 0.3));
  },
};

const scenes = [...document.querySelectorAll("canvas[data-scene]")].map((canvas) => ({
  canvas,
  ctx: canvas.getContext("2d"),
  paint: painters[canvas.dataset.scene],
  visible: false,
  color: "",
}));

function resize(scene) {
  const dpr = Math.min(devicePixelRatio || 1, 2);
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
  const dpr = Math.min(devicePixelRatio || 1, 2);
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
  for (const scene of scenes) if (scene.visible) draw(scene);
  schedule();
}

// == Live console: telemetry from the shapes above, sized to fill its box

const cursor = document.createElement("span");
cursor.className = "cursor";
const angle = (a) => (((a % TAU) + TAU) % TAU).toFixed(3);
const pose = (name) => poses[name](time).map((a, i) => `${i ? "RY" : "RX"} ${angle(a)}`).join("  ");
const shown = (name) => (scenes.find((s) => s.canvas.dataset.scene === name)?.visible ? 1 : 0);
const script = [
  () => `DOME   ${pose("dome")}  VTX ${meshes.dome.vertices.length}`,
  () => `WAVE   PHASE ${angle(time * 1.6)}  CTR ${(Math.round(waveHeight(0, 0, time) * 1000) / 1000 || 0).toFixed(3)}`,
  () => `CUBE   ${pose("cube")}  EDG ${meshes.cube.edges.length}`,
  () => `GLOBE  RY ${angle(poses.globe(time)[1])}  VTX ${meshes.globe.vertices.length}`,
  () => `TORUS  ${pose("torus")}  VIS ${shown("torus")}`,
  () => `FRAME  ${frames}  DT ${dt.toFixed(1)}ms  FPS ${Math.round(1000 / dt)}`,
  () => `SCENE  BANNER ${shown("banner")}  CUBE ${shown("cube")}  GLOBE ${shown("globe")}  TORUS ${shown("torus")}`,
];
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
  const style = getComputedStyle(terminal);
  const inner = terminal.clientHeight - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom);
  maxLines = Math.max(3, Math.floor(inner / parseFloat(style.lineHeight)) - 1);
  while (lines.length > maxLines) lines.shift();
  if (!target) target = next();
  fillTerminal();
}

// Start like a real console: a boot log of the loaded meshes, then one telemetry
// pass; it grows from there instead of repeating identical time-zero readings.
function fillTerminal() {
  if (!lines.length) {
    for (const [name, mesh] of Object.entries(meshes)) {
      lines.push(`LOAD   ${name.toUpperCase().padEnd(6)} VTX ${mesh.vertices.length}  EDG ${mesh.edges.length}`);
    }
    for (let i = 0; i < script.length; i++) lines.push(next());
  }
  while (lines.length > maxLines) lines.shift();
  renderTerminal();
}

function renderTerminal() {
  terminal.textContent = lines.concat(current).join("\n");
  terminal.append(cursor);
}

function type() {
  typing = 0;
  if (current.length < target.length) {
    current = target.slice(0, current.length + 1);
  } else {
    lines.push(current);
    while (lines.length > maxLines) lines.shift();
    target = next();
    current = "";
  }
  renderTerminal();
  typing = setTimeout(type, current === "" ? 260 : 22);
}

function startTerminal() {
  if (!terminal || typing) return;
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
  if (awake && scenes.some((s) => s.visible)) {
    if (!frame) frame = requestAnimationFrame(tick);
  } else {
    last = 0;
  }
  if (awake && bannerVisible) {
    startTerminal();
    startScramble();
    if (!clockTimer && field("clock")) tickClock();
  } else {
    clearTimeout(typing);
    typing = 0;
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
    else scenes.find((s) => s.canvas === entry.target).visible = entry.isIntersecting;
  }
  schedule();
});
for (const scene of scenes) {
  resizer.observe(scene.canvas);
  watcher.observe(scene.canvas);
}
if (terminal) resizer.observe(terminal);
if (banner) watcher.observe(banner);
document.addEventListener("visibilitychange", schedule);
addEventListener("resize", showDevice);

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
