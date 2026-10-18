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
  return 0.18 * Math.sin(r * 6 - t * 1.6) * Math.exp(-r * 1.2) + 0.05 * Math.sin(x * 3 + t);
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
