import { test } from "node:test";
import assert from "node:assert/strict";
import { torus, lathe, dome, grid, sphere, cube, waveHeight, rotate, project, bezierPatches, uprightUnit, fitUnit, headset, icosphere, fitScale } from "../js/geometry.js";
import { teapotPoints, teapotPatches } from "../js/models.js";

const length = ([x, y, z]) => Math.hypot(x, y, z);

test("torus has one vertex per ring/tube pair and two edges each", () => {
  const mesh = torus(1, 0.4, 12, 8);
  assert.equal(mesh.vertices.length, 96);
  assert.equal(mesh.edges.length, 192);
});

test("lathe connects each ring to the previous one", () => {
  const mesh = lathe([[1, 0], [0.5, 1]], 6);
  assert.equal(mesh.vertices.length, 12);
  assert.equal(mesh.edges.length, 6 + 12);
});

test("every edge references an existing vertex", () => {
  for (const mesh of [torus(1, 0.3, 10, 6), dome(), grid(5), cube(2), sphere(8, 5)]) {
    for (const [a, b] of mesh.edges) {
      assert.ok(mesh.vertices[a] && mesh.vertices[b], `bad edge ${a}-${b}`);
    }
  }
});

test("grid has (n+1)^2 vertices and 2n(n+1) edges", () => {
  const mesh = grid(4);
  assert.equal(mesh.vertices.length, 25);
  assert.equal(mesh.edges.length, 40);
});

test("rotation preserves distance from the origin", () => {
  for (const point of [[1, 2, 3], [-0.5, 0.25, 4], [0, 0, 1]]) {
    const turned = rotate(point, 0.7, -1.3);
    assert.ok(Math.abs(length(turned) - length(point)) < 1e-9);
  }
});

test("projecting the origin lands on the screen center", () => {
  assert.deepEqual(project([0, 0, 0], 150, 80, 100), [150, 80]);
});

test("closer points project larger than farther points", () => {
  const near = project([1, 0, -1], 0, 0, 100);
  const far = project([1, 0, 1], 0, 0, 100);
  assert.ok(near[0] > far[0]);
});

test("cube(1) is the 8 corners and 12 edges of a cube", () => {
  const mesh = cube(1);
  assert.equal(mesh.vertices.length, 8);
  assert.equal(mesh.edges.length, 12);
});

test("subdivided cube shares face borders without duplicate edges", () => {
  const mesh = cube(3);
  const keys = mesh.edges.map(([a, b]) => `${Math.min(a, b)}-${Math.max(a, b)}`);
  assert.equal(new Set(keys).size, keys.length);
  // 12 cube edges, each split into 3 segments per grid line: 12 * n^2 = 108.
  assert.equal(mesh.edges.length, 108);
  // Surface lattice points of a 3x3x3 subdivision: 4^3 - 2^3 interior points.
  assert.equal(mesh.vertices.length, 56);
  for (const p of mesh.vertices) assert.ok(Math.max(...p.map(Math.abs)) === 1, `${p} is off the surface`);
});

test("sphere is rings-1 latitude rings on the unit sphere", () => {
  const mesh = sphere(12, 8);
  assert.equal(mesh.vertices.length, 12 * 7);
  assert.equal(mesh.edges.length, 12 * 7 + 12 * 6);
  for (const p of mesh.vertices) assert.ok(Math.abs(length(p) - 1) < 1e-9);
});

test("wave height changes over time", () => {
  assert.notEqual(waveHeight(0.3, 0.2, 0), waveHeight(0.3, 0.2, 1));
});

test("wave height stays within +-0.3, the bound ADR 0008 states", () => {
  for (let t = 0; t < 20; t += 0.7) {
    for (let x = -1; x <= 1; x += 0.1) for (let z = -1; z <= 1; z += 0.1) assert.ok(Math.abs(waveHeight(x, z, t)) <= 0.3);
  }
});

test("Bezier patch corners land exactly on their corner control points", () => {
  // One flat patch whose 16 control points sit on a 4x4 grid in the z = 0 plane.
  const points = [];
  for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) points.push(r, c, 0);
  const mesh = bezierPatches(points, [...Array(16).keys()], 1, 2);
  // lines = 1: curves at u = 0 and 1 and at v = 0 and 1, each 3 points long.
  assert.equal(mesh.vertices.length, 2 * 2 * 3);
  assert.equal(mesh.edges.length, 2 * 2 * 2);
  assert.deepEqual(mesh.vertices[0], [0, 0, 0]);
  assert.deepEqual(mesh.vertices[2], [0, 3, 0]);
  assert.deepEqual(mesh.vertices.at(-1), [3, 3, 0]);
  for (const [, , z] of mesh.vertices) assert.equal(z, 0);
});

test("the Utah teapot data is 32 patches over 290 points", () => {
  assert.equal(teapotPoints.length, 290 * 3);
  assert.equal(teapotPatches.length, 32 * 16);
  assert.ok(teapotPatches.every((i) => Number.isInteger(i) && i >= 0 && i < 290));
  const mesh = uprightUnit(bezierPatches(teapotPoints, teapotPatches, 3, 6));
  assert.equal(mesh.vertices.length, 32 * 2 * 4 * 7);
  assert.equal(mesh.edges.length, 32 * 2 * 4 * 6);
  // Upright and unmirrored: the teapot is longer (spout to handle, x) than it is deep
  // (z), and deeper than it is tall (y); the lid knob is its highest point, near the
  // middle; and the spout tip, its +x extreme, points up.
  const span = (c) => Math.max(...mesh.vertices.map((v) => v[c])) - Math.min(...mesh.vertices.map((v) => v[c]));
  assert.ok(Math.abs(span(0) - 2) < 1e-9, "x spans the unit box");
  assert.ok(span(0) > span(2) && span(2) > span(1), "x is length, z depth, y height");
  const top = mesh.vertices.reduce((a, v) => (v[1] > a[1] ? v : a));
  assert.ok(Math.abs(top[0]) < 0.2 && Math.abs(top[2]) < 0.2, "the lid knob is the top, near the middle");
  const tip = mesh.vertices.reduce((a, v) => (v[0] > a[0] ? v : a));
  assert.ok(tip[1] > 0, "the spout tip points up");
});

test("the VR headset is symmetric, wider than tall, with its strap behind the visor", () => {
  const raw = headset();
  // 5 visor rings of 24, 4 sensors of 8, 2 lenses of 16, 2 band arcs of 17, 2 top arcs of 11.
  assert.equal(raw.vertices.length, 5 * 24 + 4 * 8 + 2 * 16 + 2 * 17 + 2 * 11);
  for (const [a, b] of raw.edges) assert.ok(raw.vertices[a] && raw.vertices[b] && a !== b);
  const mesh = fitUnit(raw);
  // Mirror symmetry: every vertex has a twin at -x.
  const key = (v) => v.map((n) => (Math.abs(n) < 1e-6 ? 0 : n).toFixed(5)).join();
  const all = new Set(mesh.vertices.map(key));
  for (const [x, y, z] of mesh.vertices) assert.ok(all.has(key([-x || 0, y, z])), `no mirror for ${x}`);
  const span = (c) => Math.max(...mesh.vertices.map((v) => v[c])) - Math.min(...mesh.vertices.map((v) => v[c]));
  assert.ok(Math.abs(Math.max(span(0), span(1), span(2)) - 2) < 1e-9, "fits the unit box");
  assert.ok(span(0) > span(1), "wider than tall");
  // The visor is at the front (-z) and the band reaches well behind it.
  const front = Math.min(...mesh.vertices.map((v) => v[2]));
  const back = Math.max(...mesh.vertices.map((v) => v[2]));
  assert.ok(back - front > 1.5, "the strap reaches behind the visor");
  // The visor (the widest, tallest part) is at the front: points level with the
  // top of the shell are all in the front third.
  const tallest = Math.max(...mesh.vertices.map((v) => Math.abs(v[0])));
  const sides = mesh.vertices.filter((v) => Math.abs(v[0]) > tallest - 1e-6);
  assert.ok(sides.every((v) => v[2] < front + (back - front) / 3), "the widest points belong to the visor at the front");
});

test("the geodesic sphere has 12, then 42 vertices on the unit sphere", () => {
  const base = icosphere(0);
  assert.equal(base.vertices.length, 12);
  assert.equal(base.edges.length, 30);
  const mesh = icosphere(1);
  assert.equal(mesh.vertices.length, 42);
  assert.equal(mesh.edges.length, 120);
  for (const p of mesh.vertices) assert.ok(Math.abs(length(p) - 1) < 1e-9);
  // Every vertex joins five or six neighbours, as on a geodesic dome.
  const degree = new Array(42).fill(0);
  for (const [a, b] of mesh.edges) degree[a]++, degree[b]++;
  assert.ok(degree.every((d) => d === 5 || d === 6));
});

test("fitScale keeps a model inside its frame at every orientation", () => {
  for (const [name, mesh, distance] of [["headset", fitUnit(headset()), 5], ["torus", torus(1, 0.42, 36, 16), 4]]) {
    const scale = fitScale(mesh, distance); // in units of half the frame's shorter side
    let worst = 0;
    for (let ax = 0; ax < Math.PI * 2; ax += 0.07) {
      for (let ay = 0; ay < Math.PI * 2; ay += 0.07) {
        for (const p of mesh.vertices) {
          const [x, y] = project(rotate(p, ax, ay), 0, 0, scale, distance);
          worst = Math.max(worst, Math.abs(x), Math.abs(y));
        }
      }
    }
    assert.ok(worst <= 1 + 1e-9, `${name} reaches ${worst.toFixed(3)} of its frame`);
    assert.ok(worst > 0.85, `${name}: the bound should not be needlessly loose (${worst.toFixed(3)})`);
  }
});
