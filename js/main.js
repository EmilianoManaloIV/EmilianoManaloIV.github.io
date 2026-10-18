// Progressive enhancement: wireframe animation, live terminal, theme and motion toggles.
// The page works without this file. No dependencies, no network requests.
import { torus, dome, grid, waveHeight, rotate, project } from "./geometry.js";

const root = document.documentElement;
const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
const systemDark = matchMedia("(prefers-color-scheme: dark)");
let motion = !reducedMotion.matches;
let time = 0;

/* ---------- Wireframe scenes ---------- */

const meshes = { dome: dome(28), wave: grid(18), torus: torus(1, 0.42, 36, 16) };

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

function schedule() {
  const running = motion && !document.hidden && scenes.some((s) => s.visible);
  if (running && !frame) frame = requestAnimationFrame(tick);
  if (!running) last = 0;
}

const resizer = new ResizeObserver((entries) => {
  for (const entry of entries) {
    const scene = scenes.find((s) => s.canvas === entry.target);
    resize(scene);
    draw(scene);
  }
});
const watcher = new IntersectionObserver((entries) => {
  for (const entry of entries) {
    scenes.find((s) => s.canvas === entry.target).visible = entry.isIntersecting;
  }
  schedule();
});
for (const scene of scenes) {
  resizer.observe(scene.canvas);
  watcher.observe(scene.canvas);
}
document.addEventListener("visibilitychange", schedule);

/* ---------- Live terminal ---------- */

const terminal = document.querySelector(".terminal");
const cursor = document.createElement("span");
cursor.className = "cursor";
const pad = (n, len = 2) => String(n).padStart(len, "0");
const rand = (max) => Math.floor(Math.random() * max);
const script = [
  () => `TRML                         LAB`,
  () => `VRS 02.${pad(rand(400), 3)}.${pad(rand(20))}`,
  () => `OS SYS LOAD`,
  () => `OPERATION : RUN [${(90 + Math.random() * 9.9).toFixed(1)}%] : PRP ALL`,
  () => `SET R ON FUN          HLD   A-${rand(9)}`,
  () => `SPC FUN               SPR   F-${rand(9)}`,
  () => `MESH SYNC  ${pad(rand(99))}/${pad(rand(99))}      OK`,
  () => `LFT ${pad(rand(60))}  RGT ${pad(rand(60))}  SPN`,
  () => `WND UPD TO LVL ${rand(12)}/12  PRP   I-I`,
];
const lines = [];
let current = "";
let target = "";
let step = 0;
let typing = 0;

function renderTerminal() {
  terminal.textContent = lines.concat(current).join("\n");
  terminal.append(cursor);
}

function type() {
  typing = 0;
  if (!motion) return;
  if (current.length < target.length) {
    current = target.slice(0, current.length + 1);
  } else {
    lines.push(current);
    if (lines.length > 8) lines.shift();
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
    renderTerminal();
  }
  type();
}

/* ---------- Toggles ---------- */

const motionButton = document.getElementById("motion-toggle");
const themeButton = document.getElementById("theme-toggle");

function setMotion(on) {
  motion = on;
  root.classList.toggle("motion-off", !on);
  motionButton.setAttribute("aria-pressed", String(on));
  motionButton.textContent = `Motion: ${on ? "on" : "off"}`;
  if (on) startTerminal();
  schedule();
}

function isDark() {
  const chosen = root.getAttribute("data-theme");
  return chosen ? chosen === "dark" : systemDark.matches;
}

function syncThemeButton() {
  const dark = isDark();
  themeButton.setAttribute("aria-pressed", String(dark));
  themeButton.textContent = dark ? "Theme: dark" : "Theme: light";
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

syncThemeButton();
setMotion(motion);
refreshColors();
