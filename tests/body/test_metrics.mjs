// Unit tests for web/body.js pure metrics, with synthetic landmark sequences (no camera, no MediaPipe).
// Run: node tests/body/test_metrics.mjs
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';
import assert from 'node:assert/strict';

const here = path.dirname(fileURLToPath(import.meta.url));
const bodyPath = path.join(here, '..', '..', 'web', 'body.js');
const require = createRequire(import.meta.url);
const BodyTrack = require(bodyPath);
const M = BodyTrack._metrics;
const CFG = M.CONFIG;

let seed = 7;
function rnd() { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; }
const J = (a = 0.002) => (rnd() * 2 - 1) * a;

const ASPECT = 4 / 3;
const FPS = 12;
const OUT = { v: 0.05 }; // hand points below the image

// One MediaPipe-style pose (33 normalised landmarks). Shoulder width = 0.30 * 4/3 = 0.4 units.
function pose(o = {}) {
  const dx = o.dx || 0;
  const head = o.slouch ? 0.10 : 0;          // slouch: the whole head drops toward the shoulder line
  const look = o.lookDown ? 1 : 0;           // looking down: nose, eyes, mouth drop, ears stay
  const lm = [];
  const P = (x, y, v = 0.99) => ({ x: x + dx + J(), y: y + J(), z: 0, visibility: v });
  lm[0] = P(0.5 + (o.turn || 0), 0.50 + head + 0.08 * look);
  [[0.48, 1], [0.47, 2], [0.46, 3], [0.52, 4], [0.53, 5], [0.54, 6]].forEach(([x, i]) => { lm[i] = P(x, 0.46 + head + 0.04 * look); });
  lm[7] = P(0.56, 0.45 + head);
  lm[8] = P(0.44, 0.45 + head);
  lm[9] = P(0.47, 0.56 + head + 0.06 * look);
  lm[10] = P(0.53, 0.56 + head + 0.06 * look);
  lm[11] = P(0.65, 0.80);
  lm[12] = P(0.35, 0.80);
  lm[13] = P(0.72, 1.05, 0.3);
  lm[14] = P(0.28, 1.05, 0.3);
  for (let i = 15; i <= 22; i++) lm[i] = P(i % 2 ? 0.70 : 0.30, 1.12, OUT.v);
  if (o.touch) { // right hand at the mouth/cheek
    lm[16] = P(0.45, 0.66, 0.95); lm[18] = P(0.46, 0.60, 0.95); lm[20] = P(0.47, 0.58, 0.95); lm[22] = P(0.48, 0.61, 0.95);
  }
  if (o.gesture != null) { // both hands up at chest level, moving side to side
    const g = 0.1 * Math.sin(o.gesture * 2.5);
    for (let i = 15; i <= 22; i += 2) lm[i] = P(0.66 + g + J(0.01), 0.86 + J(0.01), 0.9);
    for (let i = 16; i <= 22; i += 2) lm[i] = P(0.34 - g + J(0.01), 0.86 + J(0.01), 0.9);
  }
  for (let i = 23; i <= 32; i++) lm[i] = P(0.5, 1.4, 0.01);
  return lm;
}
function sequence(scn, dur = 60) {
  const frames = [];
  for (let k = 0; k < dur * FPS; k++) {
    const t = k / FPS, o = scn(t);
    frames.push({ t, lm: o === null ? null : M.prepFrame(pose(o), ASPECT) });
  }
  return frames;
}
const inAny = (t, wins) => wins.some(([a, b]) => t >= a && t < b);

let passed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log('ok   ' + name); }
  catch (e) { console.log('FAIL ' + name + '\n     ' + (e && e.message)); process.exitCode = 1; }
}
const show = (r) => JSON.stringify(r.counts) + ' marks=' + JSON.stringify(r.marks.map((m) => m.t + ' ' + m.type)) + ' line="' + r.line + '"';

test('geometry: shoulder width, ear ratio, facing', () => {
  const lm = M.prepFrame(pose(), ASPECT);
  assert.ok(Math.abs(M.shoulderWidth(lm) - 0.4) < 0.02);
  assert.ok(Math.abs(M.slouchRatio(lm) - 0.875) < 0.03);
  assert.equal(M.facing(lm), 'ok');
  assert.equal(M.facing(M.prepFrame(pose({ turn: 0.05 }), ASPECT)), 'off');
  assert.equal(M.nearFace(lm, 0.4), null, 'hands out of frame = unknown');
  assert.equal(M.nearFace(M.prepFrame(pose({ touch: true }), ASPECT), 0.4), true);
  assert.equal(M.nearFace(M.prepFrame(pose({ gesture: 1 }), ASPECT), 0.4), false);
  assert.equal(M.fmtTime(42.9), '0:42');
  assert.equal(M.fmtTime(62), '1:02');
});

test('visibility not populated: points still usable, hands judged by position', () => {
  const raw = pose().map((p) => ({ x: p.x, y: p.y, z: 0, visibility: 0 }));
  const lm = M.prepFrame(raw, ASPECT);
  assert.ok(M.shoulderWidth(lm) > 0);
  assert.equal(M.nearFace(lm, 0.4), null);
});

test('sit tall, then slouch 20-30 s -> 1 slouch at about 0:20', () => {
  const r = M.summarize(sequence((t) => ({ slouch: t >= 20 && t < 30 })));
  console.log('     ' + show(r));
  assert.deepEqual(r.counts, { face_touch: 0, sway: 0, slouch: 1 });
  assert.equal(r.marks[0].type, 'slouch');
  assert.equal(r.marks[0].label, 'Shoulders forward');
  assert.ok(r.marks[0].sec >= 19.5 && r.marks[0].sec <= 20.5, 'mark at ' + r.marks[0].sec);
  assert.equal(r.marks[0].line, 'Shoulders came forward at ' + r.marks[0].t + '. Sit tall: it can help you feel calmer and more confident.');
  assert.equal(r.line, 'Sit tall: it can help you feel calmer and more confident.');
});

test('slouch for only 3 s -> not counted (needs 4+ s)', () => {
  assert.equal(M.summarize(sequence((t) => ({ slouch: t >= 20 && t < 23 }))).counts.slouch, 0);
});

test('looking down (nose drops, ears stay) -> not a slouch', () => {
  assert.equal(M.summarize(sequence((t) => ({ lookDown: t >= 20 && t < 32 }))).counts.slouch, 0);
});

const ATTEMPT1 = [[1, 2.5], [10, 11.5], [20, 21.5], [30, 31.4], [40, 42], [50, 50.5]];
let a1, a2;
test('four face-touch events -> face_touch 4 (baseline touch and 0.5 s touch ignored)', () => {
  a1 = M.summarize(sequence((t) => ({ touch: inAny(t, ATTEMPT1) })));
  console.log('     ' + show(a1));
  assert.deepEqual(a1.counts, { face_touch: 4, sway: 0, slouch: 0 });
  const m = a1.marks[0];
  assert.equal(m.type, 'face_touch');
  assert.equal(m.label, 'Hands near your face');
  assert.equal(m.n, 4);
  assert.equal(m.t, '0:10');
  assert.equal(m.line, 'Hands near your face 4 times. They pull attention from your words.');
  assert.equal(a1.line, 'Hands near your face pull attention from your words.');
});

test('second try with one touch -> "Face touches: 4 → 1"', () => {
  a2 = M.summarize(sequence((t) => ({ touch: inAny(t, [[30, 31.5]]) })));
  assert.equal(a2.counts.face_touch, 1);
  assert.equal(a2.marks[0].line, 'Hands near your face once. They pull attention from your words.');
  assert.equal(BodyTrack.changeLine(a1, a2), 'Face touches: 4 → 1');
  assert.equal(BodyTrack.changeLine(a2, a1), null, 'no line when it got worse');
});

test('sway 15-25 s (0.3 shoulder widths, 2 s period) -> 1 sway', () => {
  const r = M.summarize(sequence((t) => ({ dx: t >= 15 && t < 25 ? 0.045 * Math.sin(Math.PI * (t - 15)) : 0 })));
  console.log('     ' + show(r));
  assert.deepEqual(r.counts, { face_touch: 0, sway: 1, slouch: 0 });
  assert.equal(r.marks[0].label, 'Swaying side to side');
  assert.ok(r.marks[0].sec >= 15 && r.marks[0].sec <= 16.5, 'mark at ' + r.marks[0].sec);
});

test('slow drift (0.5 shoulder widths over 60 s) -> no sway', () => {
  assert.equal(M.summarize(sequence((t) => ({ dx: 0.15 * t / 60 }))).counts.sway, 0);
});

test('small sway below 0.1 shoulder widths -> no sway', () => {
  assert.equal(M.summarize(sequence((t) => ({ dx: t >= 15 && t < 40 ? 0.01 * Math.sin(Math.PI * (t - 15)) : 0 }))).counts.sway, 0);
});

test('three issues -> max 2 marks, most frequent then longest first', () => {
  const r = M.summarize(sequence((t) => ({
    touch: inAny(t, [[8, 9.5], [40, 41.5]]),
    slouch: t >= 15 && t < 27,
    dx: t >= 44 && t < 54 ? 0.045 * Math.sin(Math.PI * (t - 44)) : 0
  })));
  console.log('     ' + show(r));
  assert.deepEqual(r.counts, { face_touch: 2, sway: 1, slouch: 1 });
  assert.equal(r.marks.length, 2);
  assert.deepEqual(r.marks.map((m) => m.type), ['face_touch', 'slouch']);
});

test('calm speech, hands out of frame -> nothing marked, neutral line', () => {
  const r = M.summarize(sequence(() => ({})));
  assert.deepEqual(r.counts, { face_touch: 0, sway: 0, slouch: 0 });
  assert.equal(r.marks.length, 0);
  assert.equal(r.tracked, true);
  assert.equal(r.line, 'You probably did better than it felt.');
});

test('hands visible and moving -> gestures line (only when hands are seen)', () => {
  const r = M.summarize(sequence((t) => ({ gesture: t })));
  assert.equal(r.counts.face_touch, 0);
  assert.equal(r.line, 'Show it with your hands: gestures help people follow you.');
});

test('no pose at all -> not tracked, empty line', () => {
  const r = M.summarize(sequence(() => null));
  assert.equal(r.tracked, false);
  assert.equal(r.line, '');
  assert.deepEqual(r.counts, { face_touch: 0, sway: 0, slouch: 0 });
});

test('live dots: unknown hands out of frame, off only after the full rule', () => {
  const live = M.makeLive(CFG);
  const at = {};
  sequence((t) => ({ touch: t >= 5 && t < 6.5, slouch: t >= 10 && t < 16 }), 20)
    .forEach((f) => { at[Math.round(f.t * FPS)] = live.push(f); });
  assert.equal(at[2 * FPS].hands, 'unknown');
  assert.equal(at[2 * FPS].facing, 'ok');
  assert.equal(at[Math.round(5.5 * FPS)].hands, 'ok', 'under 1 s is not off yet');
  assert.equal(at[Math.round(6.2 * FPS)].hands, 'off');
  assert.equal(at[8 * FPS].hands, 'unknown');
  assert.equal(at[12 * FPS].posture, 'ok', 'under 4 s is not off yet');
  assert.equal(at[Math.round(15.5 * FPS)].posture, 'off');
  assert.equal(at[19 * FPS].posture, 'ok');
});

test('assets: local /vendor/mediapipe first, pinned CDN fallback', () => {
  const src = M.assetSources();
  assert.equal(src[0].name, 'local');
  assert.ok(src[0].bundle.endsWith('/vendor/mediapipe/vision_bundle.mjs'));
  assert.ok(src[0].wasm.endsWith('/vendor/mediapipe/wasm'));
  assert.ok(src[0].model.endsWith('/vendor/mediapipe/pose_landmarker_lite.task'));
  assert.equal(src[1].bundle, 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/vision_bundle.mjs');
  assert.equal(src[1].wasm, 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm');
});

test('tone guard: no banned words anywhere in body.js or its output', () => {
  const src = fs.readFileSync(bodyPath, 'utf8');
  const all = src + JSON.stringify([a1, a2]);
  assert.ok(!/nervous|eye contact|power.?pose|hormone|lying/i.test(all));
});

console.log(`\n${passed} passed${process.exitCode ? ', some FAILED' : ''}`);
