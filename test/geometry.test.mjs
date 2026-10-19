import { test } from "node:test";
import assert from "node:assert/strict";
import { torus, lathe, dome, grid, sphere, cube, waveHeight, rotate, project } from "../js/geometry.js";

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
