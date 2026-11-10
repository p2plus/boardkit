// Tests for boardkit. The app is ONE html file by design; its testable
// core lives between /*CORE-START*/ and /*CORE-END*/ markers inside it.
// These tests extract that block and run it bare — if the core ever
// references document/window or leaves the file, they fail.
// Run: node --test
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const m = html.match(/\/\*CORE-START\*\/([\s\S]*?)\/\*CORE-END\*\//);
assert.ok(m, "core block found in index.html");

const core = new Function(`
  "use strict";
  ${m[1]}
  return { VERSION, makeTimer, timerState, timerStart, timerPause,
           timerReset, timerAddMinutes, fmtClock,
           parseNames, newBucket, drawFrom, bucketStatus };
`)();

const MIN = 60_000;
const seq = (...vals) => { let i = 0; return () => vals[i++ % vals.length]; };

// ---------------------------------------------------------------- timer

test("makeTimer rejects invalid durations", () => {
  assert.throws(() => core.makeTimer(0));
  assert.throws(() => core.makeTimer(-5 * MIN));
  assert.throws(() => core.makeTimer(Infinity));
  assert.throws(() => core.makeTimer(NaN));
});

test("idle timer reports full duration", () => {
  const t = core.makeTimer(10 * MIN);
  const s = core.timerState(t, 0);
  assert.equal(s.phase, "idle");
  assert.equal(s.remainingMs, 10 * MIN);
  assert.equal(s.progress, 1);
});

test("running timer counts down in real time", () => {
  let t = core.timerStart(core.makeTimer(10 * MIN), 1000);
  assert.equal(t.endAt, 1000 + 10 * MIN);
  assert.equal(core.timerState(t, 1000).remainingMs, 10 * MIN);
  assert.equal(core.timerState(t, 1000 + 5 * MIN).remainingMs, 5 * MIN);
  assert.equal(core.timerState(t, 1000 + 5 * MIN).phase, "running");
});

test("timer hits done exactly once past the end", () => {
  let t = core.timerStart(core.makeTimer(60_000), 0);
  const s = core.timerState(t, 60_001);
  assert.equal(s.phase, "done");
  assert.equal(s.remainingMs, 0);
});

test("pause freezes what is left; resume continues from it", () => {
  let t = core.timerStart(core.makeTimer(10 * MIN), 0);
  t = core.timerPause(t, 4 * MIN);                 // 6 min left
  assert.equal(t.endAt, null);
  assert.equal(core.timerState(t, 9 * MIN).remainingMs, 6 * MIN); // now ignored
  assert.equal(core.timerState(t, 9 * MIN).phase, "paused");
  t = core.timerStart(t, 100 * MIN);               // resume much later
  assert.equal(t.endAt, 100 * MIN + 6 * MIN);
  assert.equal(core.timerState(t, 100 * MIN + 6 * MIN).phase, "done");
});

test("reset returns to idle with the full duration", () => {
  let t = core.timerStart(core.makeTimer(5 * MIN), 0);
  t = core.timerPause(t, MIN);
  t = core.timerReset(t);
  assert.equal(t.phase, "idle");
  assert.equal(core.timerState(t, 999).remainingMs, 5 * MIN);
});

test("+1 min extends a running timer's end", () => {
  let t = core.timerStart(core.makeTimer(5 * MIN), 0);
  t = core.timerAddMinutes(t, 1, 0);
  assert.equal(t.endAt, 6 * MIN);
});

test("+1 min on a paused timer extends the frozen remainder; idle ignores it", () => {
  let t = core.timerStart(core.makeTimer(5 * MIN), 0);
  t = core.timerPause(t, 4 * MIN);                 // 1 min left
  t = core.timerAddMinutes(t, 1, 999);
  assert.equal(t.pausedLeftMs, 2 * MIN);
  const idle = core.timerAddMinutes(core.makeTimer(5 * MIN), 1, 0);
  assert.equal(core.timerState(idle, 0).remainingMs, 5 * MIN);
});

test("double start does not restart the clock", () => {
  let t = core.timerStart(core.makeTimer(5 * MIN), 1000);
  const again = core.timerStart(t, 50_000);
  assert.equal(again.endAt, t.endAt);
});

test("progress = remaining/duration (can exceed 1 after +1 min; UI clamps)", () => {
  let t = core.timerStart(core.makeTimer(4 * MIN), 0);
  assert.equal(core.timerState(t, MIN).progress, 0.75);
  t = core.timerAddMinutes(t, 2, 0);
  assert.equal(core.timerState(t, 0).progress, 1.5);
});

// ---------------------------------------------------------------- clock

test("fmtClock rounds up like a real countdown and grows the hour field", () => {
  assert.equal(core.fmtClock(0), "0:00");
  assert.equal(core.fmtClock(999), "0:01");          // ceil: 1 s shown
  assert.equal(core.fmtClock(59_999), "1:00");       // ceil at the minute edge
  assert.equal(core.fmtClock(60_000), "1:00");
  assert.equal(core.fmtClock(61_000), "1:01");
  assert.equal(core.fmtClock(3_599_000), "59:59");
  assert.equal(core.fmtClock(3_600_000), "1:00:00");
  assert.equal(core.fmtClock(3_661_000), "1:01:01");
  assert.equal(core.fmtClock(-1234), "0:00");        // clamp
});

// ---------------------------------------------------------------- names

test("parseNames splits lines, commas and semicolons; trims; drops empties", () => {
  assert.deepEqual(core.parseNames("Ada\nBen, Cem; Dilara\n\n  Efe  "), 
    ["Ada", "Ben", "Cem", "Dilara", "Efe"]);
});

test("parseNames dedupes case-insensitively and keeps the first spelling", () => {
  assert.deepEqual(core.parseNames("ada\nAda\nADA\nBerta"), ["ada", "Berta"]);
});

test("parseNames keeps umlauts; ß/ss count as different names (lowercase dedup only)", () => {
  assert.deepEqual(core.parseNames("Jürgen\nJÜRGEN"), ["Jürgen"]);
  assert.deepEqual(core.parseNames("Ärger\närger"), ["Ärger"]);
  assert.deepEqual(core.parseNames("Weiß\nWEISS"), ["Weiß", "WEISS"]);
});

// ---------------------------------------------------------------- bucket

test("newBucket copies its input (later mutation can't leak in)", () => {
  const names = ["A", "B"];
  const b = core.newBucket(names);
  names.push("C");
  assert.equal(core.bucketStatus(b).total, 2);
});

test("drawFrom removes the drawn name from the pool and logs history", () => {
  let b = core.newBucket(["Ada", "Ben", "Cem"]);
  const r1 = core.drawFrom(b, () => 0);              // always first
  assert.equal(r1.name, "Ada");
  assert.deepEqual(core.bucketStatus(r1.state), { total: 3, left: 2, round: 1 });
  const r2 = core.drawFrom(r1.state, () => 0);
  assert.equal(r2.name, "Ben");
  assert.deepEqual(r2.state.drawn, ["Ada", "Ben"]);
});

test("empty bucket auto-refills into the next round", () => {
  let b = core.newBucket(["Ada", "Ben"]);
  b = core.drawFrom(b, () => 0).state;
  b = core.drawFrom(b, () => 0).state;
  assert.equal(core.bucketStatus(b).left, 0);
  const r3 = core.drawFrom(b, () => 0.9);            // last element
  assert.equal(r3.name, "Ben");
  assert.equal(r3.state.round, 2);
  assert.ok(r3.state.drawn.includes("— Runde 2 —"));
  assert.equal(core.bucketStatus(r3.state).left, 1);
});

test("drawing from an empty name list yields null, not a crash", () => {
  const r = core.drawFrom(core.newBucket([]));
  assert.equal(r.name, null);
});

test("original order survives across draws and refills", () => {
  let b = core.newBucket(["A", "B", "C"]);
  for (let i = 0; i < 4; i++) b = core.drawFrom(b, seq(0.1, 0.5)).state;
  assert.deepEqual(b.names, ["A", "B", "C"]);
});

// ---------------------------------------------------------------- purity

test("core never touches the DOM (it must run from a bare file)", () => {
  assert.equal(typeof globalThis.document, "undefined");
});

test("single-file property: index.html has exactly one core block", () => {
  const count = html.split("/*CORE-START*/").length - 1;
  assert.equal(count, 1);
  assert.equal(html.split("/*CORE-END*/").length - 1, 1);
});
