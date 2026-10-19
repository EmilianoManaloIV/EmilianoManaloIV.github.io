// Wireframe meshes and projection. Pure functions with no DOM access, so they
// can be unit-tested in Node. A mesh is { vertices: [[x, y, z]], edges: [[i, j]] }.

const TAU = Math.PI * 2;

// Torus around the y axis. R is the ring radius, r the tube radius.
export function torus(R, r, ringSegments, tubeSegments) {
  const vertices = [];
  const edges = [];
  for (let i = 0; i < ringSegments; i++) {
    const u = (i / ringSegments) * TAU;
    for (let j = 0; j < tubeSegments; j++) {
      const v = (j / tubeSegments) * TAU;
      const d = R + r * Math.cos(v);
      vertices.push([d * Math.cos(u), r * Math.sin(v), d * Math.sin(u)]);
      const a = i * tubeSegments + j;
      edges.push([a, i * tubeSegments + ((j + 1) % tubeSegments)]);
      edges.push([a, ((i + 1) % ringSegments) * tubeSegments + j]);
    }
  }
  return { vertices, edges };
}

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

// Dome with a turned-up brim, like the banner art in the Figma design.
export function dome(segments = 24) {
  const profile = [];
  for (let k = 0; k <= 6; k++) {
    const a = (k / 6) * (Math.PI / 2);
    profile.push([Math.sin(a), 0.75 * Math.cos(a)]);
  }
  profile.push([1.25, 0.05], [1.4, 0.18]);
  return lathe(profile, segments);
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

// Rippling height field used for the wave surface. t is time in seconds.
export function waveHeight(x, z, t) {
  const r = Math.hypot(x, z);
  // A ripple from the centre plus a diagonal travelling swell; |height| <= 0.29.
  return 0.22 * Math.sin(r * 6 - t * 2.2) * Math.exp(-r) + 0.07 * Math.sin(x * 3 + z * 2 + t * 1.4);
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

// Perspective projection to screen space. Larger distance means a flatter view.
export function project([x, y, z], cx, cy, scale, distance = 4) {
  const k = distance / (distance + z);
  return [cx + x * scale * k, cy - y * scale * k];
}
