// Wireframe meshes and projection. Pure functions with no DOM access, so they
// can be unit-tested in Node. A mesh is { vertices: [[x, y, z]], edges: [[i, j]] }.

const TAU = Math.PI * 2;

// Surface of revolution around the y axis from a profile of [radius, height].
export function lathe(profile, segments) {
  const vertices = [];
  const edges = [];
  profile.forEach(([radius, height], p) => {
    for (let s = 0; s < segments; s++) {
      const a = (s / segments) * TAU;
      vertices.push([radius * Math.cos(a), height, radius * Math.sin(a)]);
      const i = p * segments + s;
      edges.push([i, p * segments + ((s + 1) % segments)]);
      if (p > 0) edges.push([i, i - segments]);
    }
  });
  return { vertices, edges };
}

// Oblate spheroid (equatorial radius 1, polar radius POLAR) with a cylinder of radius
// BORE bored through its short axis, like the banner art in the Figma design (ADR 0014).
// One lathe profile runs from the bore's top rim over the outside to the bottom rim
// (`rings` evenly spaced latitude rings, plus two close to each rim for the thick lip
// Figma draws around the opening), then up the bore wall (3 rings); a last set of
// edges closes the wall back onto the top rim.
export const POLAR = 0.62;
export const BORE = 0.32;
export function piercedSpheroid(segments = 24, rings = 9) {
  const rim = Math.acos(BORE); // latitude where the bore meets the surface
  const lats = Array.from({ length: rings }, (_, k) => rim - (k / (rings - 1)) * 2 * rim);
  lats.splice(1, 0, rim - 0.05, rim - 0.12);
  lats.splice(-1, 0, 0.12 - rim, 0.05 - rim);
  const profile = lats.map((a) => [Math.cos(a), POLAR * Math.sin(a)]);
  const top = POLAR * Math.sin(rim);
  for (const f of [-0.5, 0, 0.5]) profile.push([BORE, f * top]);
  const mesh = lathe(profile, segments);
  const last = (profile.length - 1) * segments;
  for (let s = 0; s < segments; s++) mesh.edges.push([last + s, s]);
  return mesh;
}

// Sphere of radius 1 as latitude rings and meridians, skipping the degenerate poles.
export function sphere(segments = 12, rings = 8) {
  const profile = [];
  for (let k = 1; k < rings; k++) {
    const a = -Math.PI / 2 + (k / rings) * Math.PI;
    profile.push([Math.cos(a), Math.sin(a)]);
  }
  return lathe(profile, segments);
}

// Cube spanning -1..1 with every face subdivided into an n-by-n grid of lines.
// Faces share their border lines, so vertices and edges are de-duplicated.
export function cube(n = 1) {
  const vertices = [];
  const edges = [];
  const index = new Map();
  const seen = new Set();
  const vertex = (p) => {
    const key = p.join();
    if (!index.has(key)) index.set(key, vertices.push(p) - 1);
    return index.get(key);
  };
  const edge = (p, q) => {
    const [a, b] = [vertex(p), vertex(q)].sort((x, y) => x - y);
    const key = `${a}-${b}`;
    if (!seen.has(key)) {
      seen.add(key);
      edges.push([a, b]);
    }
  };
  const at = (i) => (i / n) * 2 - 1;
  for (let axis = 0; axis < 3; axis++) {
    const u = (axis + 1) % 3;
    const v = (axis + 2) % 3;
    for (const side of [-1, 1]) {
      const point = (i, j) => {
        const p = [0, 0, 0];
        p[axis] = side;
        p[u] = at(i);
        p[v] = at(j);
        return p;
      };
      for (let i = 0; i <= n; i++) {
        for (let j = 0; j < n; j++) {
          edge(point(i, j), point(i, j + 1));
          edge(point(j, i), point(j + 1, i));
        }
      }
    }
  }
  return { vertices, edges };
}

// Wireframe of bicubic Bezier patches, drawn as iso-lines: lines + 1 curves in each
// direction per patch, each split into `steps` segments. `points` is a flat x, y, z
// list and `patches` lists 16 point indices per patch, row by row (as in models.js).
export function bezierPatches(points, patches, lines = 3, steps = 6) {
  const vertices = [];
  const edges = [];
  const bern = (t) => [(1 - t) ** 3, 3 * t * (1 - t) ** 2, 3 * t * t * (1 - t), t ** 3];
  for (let p = 0; p < patches.length; p += 16) {
    const at = (u, v) => {
      const bu = bern(u);
      const bv = bern(v);
      const out = [0, 0, 0];
      for (let k = 0; k < 16; k++) {
        const w = bu[k >> 2] * bv[k & 3];
        const i = patches[p + k] * 3;
        for (let c = 0; c < 3; c++) out[c] += w * points[i + c];
      }
      return out;
    };
    for (let k = 0; k <= lines; k++) {
      for (const flip of [false, true]) {
        const start = vertices.length;
        for (let s = 0; s <= steps; s++) {
          vertices.push(flip ? at(s / steps, k / lines) : at(k / lines, s / steps));
          if (s) edges.push([start + s - 1, start + s]);
        }
      }
    }
  }
  return { vertices, edges };
}

// Turns a z-up mesh y-up, centres it on its bounding box, and scales its largest
// half-extent to 1, so imported models match the hand-built meshes' size.
export function uprightUnit({ vertices, edges }) {
  return fitUnit({ vertices: vertices.map(([x, y, z]) => [x, z, -y]), edges });
}

// Centres a mesh on its bounding box and scales its largest half-extent to 1.
export function fitUnit({ vertices, edges }) {
  const lo = [0, 1, 2].map((c) => Math.min(...vertices.map((v) => v[c])));
  const hi = [0, 1, 2].map((c) => Math.max(...vertices.map((v) => v[c])));
  const half = Math.max(...hi.map((h, c) => (h - lo[c]) / 2));
  return { vertices: vertices.map((v) => v.map((n, c) => (n - (lo[c] + hi[c]) / 2) / half)), edges };
}

// Geodesic sphere of radius 1: an icosahedron whose triangles are split into four
// `levels` times, with new points pushed out to the sphere. Level 1 has 42 vertices
// and 120 edges.
export function icosphere(levels = 1) {
  const g = (1 + Math.sqrt(5)) / 2;
  const unit = (v) => v.map((n) => n / Math.hypot(...v));
  let vertices = [
    [-1, g, 0], [1, g, 0], [-1, -g, 0], [1, -g, 0],
    [0, -1, g], [0, 1, g], [0, -1, -g], [0, 1, -g],
    [g, 0, -1], [g, 0, 1], [-g, 0, -1], [-g, 0, 1],
  ].map(unit);
  let faces = [
    [0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11],
    [1, 5, 9], [5, 11, 4], [11, 10, 2], [10, 7, 6], [7, 1, 8],
    [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8], [3, 8, 9],
    [4, 9, 5], [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1],
  ];
  for (let l = 0; l < levels; l++) {
    const middle = new Map();
    const mid = (a, b) => {
      const key = a < b ? `${a},${b}` : `${b},${a}`;
      if (!middle.has(key)) middle.set(key, vertices.push(unit(vertices[a].map((n, c) => n + vertices[b][c]))) - 1);
      return middle.get(key);
    };
    faces = faces.flatMap(([a, b, c]) => {
      const [ab, bc, ca] = [mid(a, b), mid(b, c), mid(c, a)];
      return [[a, ab, ca], [b, bc, ab], [c, ca, bc], [ab, bc, ca]];
    });
  }
  const seen = new Set();
  const edges = [];
  for (const face of faces) {
    for (let i = 0; i < 3; i++) {
      const [a, b] = [face[i], face[(i + 1) % 3]].sort((x, y) => x - y);
      if (!seen.has(`${a},${b}`)) {
        seen.add(`${a},${b}`);
        edges.push([a, b]);
      }
    }
  }
  return { vertices, edges };
}

// A VR headset, built from simple parts (ADR 0009): a rounded visor shell lofted
// from superellipse rings, four front sensors, two lenses on the face side, and a
// head band with a top strap reaching back. y is up, the front faces -z (toward
// the viewer in project()), and the wearer's head is behind it at +z.
export function headset() {
  const vertices = [];
  const edges = [];
  // A polyline through `points`, closed into a loop if asked.
  const line = (points, closed = false) => {
    const start = vertices.length;
    vertices.push(...points);
    for (let i = 1; i < points.length; i++) edges.push([start + i - 1, start + i]);
    if (closed) edges.push([start + points.length - 1, start]);
    return start;
  };
  const ring = (n, f) => Array.from({ length: n }, (_, i) => f((i / n) * TAU));
  // Visor: rounded-rectangle rings (superellipse, exponent 4), smaller at the front
  // edge for a bevel, joined lengthwise.
  const pow = (c) => Math.sign(c) * Math.abs(c) ** 0.5;
  const N = 24;
  const rings = [[-0.45, 0.86, 0.8], [-0.4, 0.96, 0.94], [-0.25, 1, 1], [0.15, 1, 1], [0.3, 0.97, 0.95]];
  const starts = rings.map(([z, sx, sy]) => line(ring(N, (a) => [sx * pow(Math.cos(a)), 0.55 * sy * pow(Math.sin(a)), z]), true));
  for (let r = 1; r < starts.length; r++) for (let i = 0; i < N; i++) edges.push([starts[r - 1] + i, starts[r] + i]);
  // Front sensors and the lenses on the face side.
  const circle = (cx, cy, z, radius, n) => line(ring(n, (a) => [cx + radius * Math.cos(a), cy + radius * Math.sin(a), z]), true);
  for (const x of [-0.6, 0.6]) for (const y of [-0.28, 0.28]) circle(x, y, -0.46, 0.07, 8);
  for (const x of [-0.42, 0.42]) circle(x, 0, 0.3, 0.24, 16);
  // Head band: two half-ellipses from the visor's sides around the back, tied together.
  const S = 16;
  const band = [-0.12, 0.12].map((y) => line(Array.from({ length: S + 1 }, (_, i) => {
    const a = (i / S) * Math.PI;
    return [0.98 * Math.cos(a), y, 0.05 + 1.6 * Math.sin(a)];
  })));
  for (let i = 0; i <= S; i += 4) edges.push([band[0] + i, band[1] + i]);
  // Top strap: two arcs from the visor top over to the back of the band.
  const T = 10;
  const top = [-0.12, 0.12].map((x) => line(Array.from({ length: T + 1 }, (_, i) => {
    const a = (i / T) * Math.PI;
    return [x, 0.55 + 0.35 * Math.sin(a) - 0.43 * (i / T), 0.05 + 0.8 * (1 - Math.cos(a))];
  })));
  for (let i = 0; i <= T; i += 5) edges.push([top[0] + i, top[1] + i]);
  return { vertices, edges };
}

// Flat n-by-n grid of lines spanning -1..1 on x and z. Heights are set per frame.
export function grid(n) {
  const vertices = [];
  const edges = [];
  for (let i = 0; i <= n; i++) {
    for (let j = 0; j <= n; j++) {
      vertices.push([(j / n) * 2 - 1, 0, (i / n) * 2 - 1]);
      const a = i * (n + 1) + j;
      if (j < n) edges.push([a, a + 1]);
      if (i < n) edges.push([a, a + n + 1]);
    }
  }
  return { vertices, edges };
}

// Integer hash to 0..1, so the terrain is the same on every visit (no Math.random).
function hash(i, j) {
  let h = (Math.imul(i, 374761393) + Math.imul(j, 668265263)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}

// Value noise in -0.5..0.5 with `f` cells per unit, repeating every 2 units along w.
// Straight-line blending between lattice points keeps the creases that make it jagged.
function noise(x, w, f) {
  const u = (x + 1) * f;
  const v = w * f;
  const i = Math.floor(u);
  const j = Math.floor(v);
  const p = 2 * f;
  const at = (a, b) => hash(a, ((b % p) + p) % p);
  const fu = u - i;
  const fv = v - j;
  const top = at(i, j) * (1 - fu) + at(i + 1, j) * fu;
  const bottom = at(i, j + 1) * (1 - fu) + at(i + 1, j + 1) * fu;
  return top * (1 - fv) + bottom * fv - 0.5;
}

// Broad hills as [x, w, height, width]: the tall peak right of centre and the smaller
// bumps around it, as in the Figma design.
const HILLS = [[0.2, 0.05, 0.5, 0.33], [-0.3, 0.45, 0.2, 0.25], [-0.45, -0.35, 0.14, 0.25], [0.55, -0.45, 0.12, 0.2]];
export const DRIFT = 0.08; // units per second toward the viewer

// Height of the terrain surface at grid point (x, z), both -1..1. t is time in seconds:
// the land drifts toward the viewer (-z) and repeats every 2 / DRIFT seconds. Edges
// fade to flat, as in Figma, so hills rise in at the back and sink at the front.
export function terrainHeight(x, z, t) {
  const w = z + t * DRIFT;
  const wrap = (d) => ((((d + 1) % 2) + 2) % 2) - 1; // nearest repeat of a w distance
  let h = 0;
  for (const [hx, hw, height, width] of HILLS) h += height * Math.exp(-((x - hx) ** 2 + wrap(w - hw) ** 2) / (width * width));
  h += 0.22 * noise(x, w, 2) + 0.11 * noise(x, w, 4) + 0.06 * noise(x, w, 8);
  const fade = (u) => {
    const s = Math.min(1, Math.max(0, (1 - Math.abs(u)) / 0.35));
    return s * s * (3 - 2 * s);
  };
  return h * fade(x) * fade(z);
}

// Rotate a point around the x axis, then the y axis.
export function rotate([x, y, z], ax, ay) {
  const cx = Math.cos(ax);
  const sx = Math.sin(ax);
  const y1 = y * cx - z * sx;
  const z1 = y * sx + z * cx;
  const cy = Math.cos(ay);
  const sy = Math.sin(ay);
  return [x * cy + z1 * sy, y1, -x * sy + z1 * cy];
}

// Turn a point around the y axis, tilt it around the x axis, then roll it in the
// screen plane (z axis). Unlike rotate(), the turn comes first, so a shape can spin
// on its own axis while that axis holds a fixed lean, as the banner art does.
export function orient(p, tilt, turn, roll = 0) {
  const [x, y, z] = rotate(rotate(p, 0, turn), tilt, 0);
  const c = Math.cos(roll);
  const s = Math.sin(roll);
  return [x * c - y * s, x * s + y * c, z];
}

// The largest projection scale, as a fraction of half the frame's shorter side, at
// which a mesh can never leave its frame, however it is turned. A point at radius r
// projects no further out than r * d / sqrt(d^2 - r^2) (the sight line tangent to its
// bounding sphere), so dividing by that bound keeps every orientation inside.
export function fitScale({ vertices }, distance = 4) {
  const r = Math.max(...vertices.map((v) => Math.hypot(...v)));
  return Math.sqrt(distance * distance - r * r) / (r * distance);
}

// Perspective projection to screen space. Larger distance means a flatter view.
export function project([x, y, z], cx, cy, scale, distance = 4) {
  const k = distance / (distance + z);
  return [cx + x * scale * k, cy - y * scale * k];
}
