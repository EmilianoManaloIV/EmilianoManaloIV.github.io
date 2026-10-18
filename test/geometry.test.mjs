import { test } from "node:test";
import assert from "node:assert/strict";
import { torus, lathe, dome, grid, waveHeight, rotate, project } from "../js/geometry.js";

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
  for (const mesh of [torus(1, 0.3, 10, 6), dome(), grid(5)]) {
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

test("wave height changes over time", () => {
  assert.notEqual(waveHeight(0.3, 0.2, 0), waveHeight(0.3, 0.2, 1));
});
