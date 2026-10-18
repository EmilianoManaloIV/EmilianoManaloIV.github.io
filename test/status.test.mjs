import { test } from "node:test";
import assert from "node:assert/strict";
import { talkStatus, formatCountdown } from "../js/status.js";

const start = Date.parse("2026-11-05T14:00:00-08:00");
const end = Date.parse("2026-11-05T14:45:00-08:00");

test("missing or invalid times read as TBA", () => {
  assert.equal(talkStatus(start, NaN, NaN).state, "tba");
  assert.equal(talkStatus(start, Date.parse(""), end).state, "tba");
  assert.equal(talkStatus(start, end, start).state, "tba", "end before start");
});

test("states change exactly at the start and end", () => {
  assert.deepEqual(talkStatus(start - 1, start, end), { state: "upcoming", ms: 1 });
  assert.equal(talkStatus(start, start, end).state, "live");
  assert.equal(talkStatus(end - 1, start, end).state, "live");
  assert.equal(talkStatus(end, start, end).state, "ended");
});

test("countdown rounds up and picks the largest useful units", () => {
  assert.equal(formatCountdown(1), "in 1m");
  assert.equal(formatCountdown(59 * 60000 + 1), "in 1h 00m");
  assert.equal(formatCountdown(3 * 3600000 + 12 * 60000), "in 3h 12m");
  assert.equal(formatCountdown(2 * 86400000 + 4 * 3600000), "in 2d 04h");
});
