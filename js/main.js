// Progressive enhancement: wireframes, live terminal, headline scramble, device
// readout, and the theme and motion toggles. The page works without this file.
// No dependencies and no network requests: device values are only displayed.
import { torus, dome, grid, cube, sphere, waveHeight, rotate, project } from "./geometry.js";

const root = document.documentElement;
const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
const systemDark = matchMedia("(prefers-color-scheme: dark)");
const banner = document.querySelector(".banner");
const terminal = document.querySelector(".terminal");
let motion = !reducedMotion.matches;
let bannerVisible = false;
let time = 0;
const rand = (max) => Math.floor(Math.random() * max);
const pad = (n, len = 2) => String(n).padStart(len, "0");

/* ---------- Wireframe scenes ---------- */

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

const painters = {
  banner(ctx, w, h, t) {
    const s = Math.min(w, h);
    strokeMesh(ctx, meshes.dome, (p) =>
      project(rotate(p, 0.45, t * 0.35), w * 0.36, h * 0.36, s * 0.24),
    );
    strokeMesh(ctx, meshes.wave, ([x, , z]) =>
      project(rotate([x, waveHeight(x, z, t), z], 0.55, -0.6), w * 0.62, h * 0.72, s * 0.42),
    );
  },
  cube(ctx, w, h, t) {
    strokeMesh(ctx, meshes.cube, (p) =>
      project(rotate(p, 0.55 + t * 0.12, t * 0.22), w / 2, h / 2, Math.min(w, h) * 0.24, 5),
    );
  },
  globe(ctx, w, h, t) {
    strokeMesh(ctx, meshes.globe, (p) => project(rotate(p, 0.35, t * 0.6), w / 2, h / 2, w * 0.44, 6));
  },
  torus(ctx, w, h, t) {
    strokeMesh(ctx, meshes.torus, (p) =>
      project(rotate(p, 1.0 + Math.sin(t * 0.3) * 0.25, t * 0.4), w / 2, h / 2, Math.min(w, h) * 0.3),
    );
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
function tick(now) {
  frame = 0;
  time += Math.min((now - (last || now)) / 1000, 0.1);
  last = now;
  for (const scene of scenes) if (scene.visible) draw(scene);
  schedule();
}

/* ---------- Live terminal, sized to fill its box ---------- */

const cursor = document.createElement("span");
cursor.className = "cursor";
const script = [
  () => `TRML                         LAB`,
  () => `VRS 02.${pad(rand(400), 3)}.${pad(rand(20))}`,
  () => `OS SYS LOAD`,
  () => `CRS LOAD /${pad(rand(99))}`,
  () => `OPERATION : RUN [${(90 + Math.random() * 9.9).toFixed(1)}%] : PRP ALL`,
  () => `SET R ON FUN          HLD   A-${rand(9)}`,
  () => `SPC FUN               SPR   F-${rand(9)}`,
  () => `PWR ${rand(900) + 100}-${rand(900) + 100}-${rand(900) + 100}       GAP`,
  () => `MESH SYNC  ${pad(rand(99))}/${pad(rand(99))}      OK`,
  () => `VTX ${rand(4096)}  EDG ${rand(8192)}  FPS ${50 + rand(11)}`,
  () => `LFT ${pad(rand(60))}  RGT ${pad(rand(60))}  SPN`,
  () => `WND UPD TO LVL ${rand(12)}/12  PRP   I-I`,
];
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
  if (target) fillTerminal();
}

// Top the console up to a full screen so it never starts or resizes into a near-empty box.
function fillTerminal() {
  while (lines.length < maxLines) lines.push(script[step++ % script.length]());
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
    target = script[step++ % script.length]();
    current = "";
  }
  renderTerminal();
  typing = setTimeout(type, current === "" ? 260 : 22);
}

function startTerminal() {
  if (!terminal || typing) return;
  if (!target) {
    target = script[step++]();
    fillTerminal();
  }
  type();
}

/* ---------- Headline decode scramble ---------- */

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
  scrambledOnce = true;
  scrambleStart = performance.now();
  scrambleFrame();
}

function startScramble() {
  if (scrambleTimer || !words.length) return;
  scrambleTimer = setTimeout(beginScramble, scrambledOnce ? 12000 : 300);
}

// Pausing always leaves the real words in place.
function stopScramble() {
  clearTimeout(scrambleTimer);
  scrambleTimer = 0;
  scrambleStart = 0;
  words.forEach((el, i) => (el.textContent = originals[i]));
}

/* ---------- Device readout: the visitor's own machine, display only ---------- */

const field = (name) => document.querySelector(`[data-device="${name}"]`);
const loadedAt = Date.now();
const ua = navigator.userAgent;
const uaData = navigator.userAgentData;
const os = uaData?.platform || (ua.match(/Windows|iPhone|iPad|Android|Mac|Linux/) || ["Unknown"])[0];
const brand = uaData?.brands?.find((b) => !/Not|Chromium/.test(b.brand));
// Safari reports its version as "Version/17"; its "Safari/605" token is the WebKit build.
const [, name = "Browser", version = ""] = ua.match(/(Firefox|Edg|Chrome|Version)\/(\d+)/) || [];
const browser = brand ? `${brand.brand} ${brand.version}` : `${name === "Version" ? "Safari" : name} ${version}`;
let clockTimer = 0;

function showDevice() {
  if (!field("title")) return;
  const memory = navigator.deviceMemory ? `${navigator.deviceMemory} GB` : "mem N/A";
  field("title").textContent = `${os} · ${browser}`;
  field("spec").textContent = `${navigator.hardwareConcurrency || "?"} cores · ${memory}`;
  field("display").textContent = `${screen.width}×${screen.height} @${devicePixelRatio}x · vp ${innerWidth}×${innerHeight}`;
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

/* ---------- One gate for all motion ---------- */
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

/* ---------- Toggles ---------- */
// Fixed accessible names; aria-pressed carries the state, and the visible
// ": on/off" suffix is aria-hidden so the state is not announced twice.

const motionButton = document.getElementById("motion-toggle");
const themeButton = document.getElementById("theme-toggle");
const showState = (button, on) => {
  button.setAttribute("aria-pressed", String(on));
  button.querySelector("[data-state]").textContent = on ? ": on" : ": off";
};

function setMotion(on) {
  motion = on;
  root.classList.toggle("motion-off", !on);
  showState(motionButton, on);
  schedule();
}

function isDark() {
  const chosen = root.getAttribute("data-theme");
  return chosen ? chosen === "dark" : systemDark.matches;
}

function syncThemeButton() {
  showState(themeButton, isDark());
}

motionButton.addEventListener("click", () => setMotion(!motion));
reducedMotion.addEventListener("change", (e) => setMotion(!e.matches));

themeButton.addEventListener("click", () => {
  const next = isDark() ? "light" : "dark";
  root.setAttribute("data-theme", next);
  try {
    localStorage.setItem("theme", next);
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
