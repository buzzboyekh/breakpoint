/*
 * Breakpoint body track: web/body.js (owner: body). Vanilla JS, Chrome.
 * On device only: MediaPipe runs in this tab; no frame or landmark is sent anywhere.
 * Assets: /vendor/mediapipe/ by default (or window.BODY_ASSET_BASE if set before init), holding
 *   vision_bundle.mjs, wasm/vision_wasm_internal.{js,wasm} (+ nosimd pair), pose_landmarker_lite.task
 *   (tasks-vision 0.10.14). Falls back to jsDelivr + Google storage only if the local load fails.
 *
 *   await BodyTrack.init(videoEl) -> {ok:true, delegate, source} | {ok:false, reason, detail}
 *     reason: no_video_element | camera_denied | camera_unavailable | camera_busy | camera_error
 *             | load_failed | load_timeout | init_error. Never throws.
 *     If videoEl has no stream yet, init opens the camera (video only) and attaches it.
 *   BodyTrack.start()       call when the speech starts: first 3 s = baseline, then detection (~12 fps)
 *   BodyTrack.onStatus(cb)  cb({posture, hands, facing}), each "ok"|"off"|"unknown", on change; returns unsubscribe
 *   BodyTrack.stop()        -> {marks:[{t:"0:42", sec, type, label, n, line}] (max 2), counts:{face_touch,sway,slouch},
 *                              line, tracked, coverage}
 *   BodyTrack.changeLine(attempt1, attempt2) -> "Face touches: 4 → 1" when face touches went down, else null
 *   Live tuning: BodyTrack.CONFIG.x = ...; BodyTrack.resummarize() re-scores the last attempt;
 *   BodyTrack.inspect() shows baseline and raw events; BodyTrack.destroy() frees the model and our own camera.
 */
(function (root) {
  'use strict';

  var MP_VERSION = '0.10.14';
  var CDN_BASE = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@' + MP_VERSION;
  var CDN_MODEL = 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task';
  var LOCAL_BASE = '/vendor/mediapipe/';

  // Every threshold (CONTRACT.md "Body track"). Untested heuristics: tune live.
  // Distances are in shoulder widths (|landmark 11 - 12|), measured in pixel-proportional units.
  var CONFIG = {
    fps: 12,
    initTimeoutMs: 25000,
    baselineSec: 3,              // first 3 s of each attempt ("sit tall")
    baselineMinFrames: 5,
    handMinVisibility: 0.5,      // hand points 15-22 below this or outside the image = out of frame (unknown)
    faceMinVisibility: 0,        // face points 0-10 stay usable while a hand covers them
    shoulderMinVisibility: 0.3,
    shoulderMargin: 0.15,        // shoulders may sit just below the bottom edge when seated close
    // Slouch: ear height above the shoulder line drops >= 18% below baseline for 4+ s
    slouchDrop: 0.18,
    slouchMinSec: 4,
    slouchSmoothSec: 0.5,
    slouchGapSec: 0.6,
    // Sway: detrended shoulder-midpoint x reverses 3+ times by > 0.1 shoulder widths within 10 s
    swayAmp: 0.1,
    swayReversals: 3,
    swayWindowSec: 10,
    swayDetrendSec: 8,
    swaySmoothSec: 0.3,
    // Face/hair touch: any of 15-22 within 0.4 shoulder widths of any of 0-10 for >= 1 s; counted as events
    touchDist: 0.4,
    touchMinSec: 1.0,
    touchGapSec: 0.35,
    // Facing the screen: nose centred between the ears (a screen check, not a gaze claim)
    facingTolerance: 0.25,
    // Gestures seen: only picks the closing line when nothing else was noted
    gestureMinShare: 0.25,
    gestureMinRange: 0.5,
    maxMarks: 2,
    text: {
      labels: { slouch: 'Shoulders forward', sway: 'Swaying side to side', face_touch: 'Hands near your face' },
      // stop().line: one safe line for the main issue (CONTRACT.md safe lines; the sway line is copy.md's)
      lines: {
        face_touch: 'Hands near your face pull attention from your words.',
        slouch: 'Sit tall: it can help you feel calmer and more confident.',
        sway: 'Plant your feet and let your words do the moving.',
        gestures: 'Show it with your hands: gestures help people follow you.',
        none: 'You probably did better than it felt.'
      },
      // marks[].line: copy.md "Delivery lines" as written ({n}=1 uses the "once" form)
      markLines: {
        face_touch: 'Hands near your face {n} times. They pull attention from your words.',
        face_touch_once: 'Hands near your face once. They pull attention from your words.',
        slouch: 'Shoulders came forward at {t}. Sit tall: it can help you feel calmer and more confident.',
        sway: 'Swaying at {t}. Plant your feet and let your words do the moving.'
      },
      change: 'Face touches: {before} → {after}'
    }
  };

  // ---------------------------------------------------------------- pure helpers (no DOM, no MediaPipe)
  function median(a) {
    if (!a.length) return null;
    var s = a.slice().sort(function (x, y) { return x - y; }), m = s.length >> 1;
    return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
  }
  function pct(a, q) {
    var s = a.slice().sort(function (x, y) { return x - y; });
    return s[Math.min(s.length - 1, Math.max(0, Math.round(q * (s.length - 1))))];
  }
  function fmtTime(sec) {
    var s = Math.max(0, Math.floor(sec || 0)), r = s % 60;
    return Math.floor(s / 60) + ':' + (r < 10 ? '0' : '') + r;
  }
  function fill(tpl, vars) {
    return String(tpl).replace(/\{(\w+)\}/g, function (m, k) { return vars && vars[k] != null ? String(vars[k]) : m; });
  }
  // Centred moving average over a time window (seconds) on samples [{t, v}] sorted by t.
  function movingAvg(pts, win) {
    var out = new Array(pts.length), lo = 0, hi = 0, sum = 0, half = (win || 0) / 2;
    for (var i = 0; i < pts.length; i++) {
      var t = pts[i].t;
      while (hi < pts.length && pts[hi].t <= t + half) { sum += pts[hi].v; hi++; }
      while (pts[lo].t < t - half) { sum -= pts[lo].v; lo++; }
      out[i] = { t: t, v: sum / (hi - lo) };
    }
    return out;
  }
  function frameDt(frames, cfg) {
    var d = [];
    for (var i = 1; i < frames.length; i++) { var x = frames[i].t - frames[i - 1].t; if (x > 0) d.push(x); }
    var m = median(d);
    return m == null ? 1 / (cfg || CONFIG).fps : Math.min(0.5, Math.max(1 / 60, m));
  }
  // Runs of on-samples [{t, on}]; positives closer than gapSec join. Each sample covers dt seconds.
  function findRuns(samples, gapSec, minSec, dt) {
    var runs = [], cur = null, i;
    for (i = 0; i < samples.length; i++) {
      var s = samples[i];
      if (!s.on) continue;
      if (cur && s.t - cur.last <= gapSec + 1e-9) { cur.last = s.t; continue; }
      if (cur) runs.push(cur);
      cur = { start: s.t, last: s.t };
    }
    if (cur) runs.push(cur);
    var out = [];
    for (i = 0; i < runs.length; i++) {
      var end = runs[i].last + dt, dur = end - runs[i].start;
      if (dur >= minSec - 1e-6) out.push({ start: runs[i].start, end: end, dur: dur });
    }
    return out;
  }

  // Raw MediaPipe landmarks (normalised 0..1) -> points 0-22 in pixel-proportional units (x * width/height).
  // 23-32 (hips, legs) are dropped. If no visibility is populated at all, every point counts as visible.
  function prepFrame(raw, aspect) {
    if (!raw || !raw.length) return null;
    var a = aspect > 0 ? aspect : 1, hasVis = false, i;
    for (i = 0; i < raw.length; i++) {
      if (raw[i] && typeof raw[i].visibility === 'number' && raw[i].visibility > 0) { hasVis = true; break; }
    }
    var n = Math.min(raw.length, 23), out = new Array(n);
    for (i = 0; i < n; i++) {
      var p = raw[i];
      out[i] = (p && isFinite(p.x) && isFinite(p.y))
        ? { x: p.x * a, y: p.y, nx: p.x, ny: p.y, v: hasVis ? (typeof p.visibility === 'number' ? p.visibility : 1) : 1 }
        : null;
    }
    return out;
  }
  function inFrame(p, m) { return p.nx >= -m && p.nx <= 1 + m && p.ny >= -m && p.ny <= 1 + m; }
  function okHand(p, cfg) { return !!p && p.v >= cfg.handMinVisibility && inFrame(p, 0); }
  function okFace(p, cfg) { return !!p && p.v >= cfg.faceMinVisibility && inFrame(p, 0.05); }
  function okShoulder(p, cfg) { return !!p && p.v >= cfg.shoulderMinVisibility && inFrame(p, cfg.shoulderMargin); }

  function shoulderWidth(lm, cfg) {
    cfg = cfg || CONFIG;
    if (!lm || !okShoulder(lm[11], cfg) || !okShoulder(lm[12], cfg)) return null;
    var w = Math.hypot(lm[11].x - lm[12].x, lm[11].y - lm[12].y);
    return w > 1e-6 ? w : null;
  }
  // Ear height above the shoulder line, in shoulder widths. Ears, not nose: a dropping nose is looking down.
  function slouchRatio(lm, cfg) {
    cfg = cfg || CONFIG;
    var w = shoulderWidth(lm, cfg);
    if (w == null) return null;
    var ys = [];
    if (okFace(lm[7], cfg)) ys.push(lm[7].y);
    if (okFace(lm[8], cfg)) ys.push(lm[8].y);
    if (!ys.length) return null;
    var earY = ys.length === 2 ? (ys[0] + ys[1]) / 2 : ys[0];
    return ((lm[11].y + lm[12].y) / 2 - earY) / w;
  }
  function facing(lm, cfg) {
    cfg = cfg || CONFIG;
    if (!lm) return 'unknown';
    var n = lm[0], l = lm[7], r = lm[8];
    if (!okFace(n, cfg) || !okFace(l, cfg) || !okFace(r, cfg)) return 'unknown';
    var span = l.x - r.x;
    if (Math.abs(span) < 1e-6) return 'off';
    return Math.abs((n.x - r.x) / span - 0.5) <= cfg.facingTolerance ? 'ok' : 'off';
  }
  // true: a hand point is near a face point; false: hands visible, not near; null: hands out of frame (unknown).
  function nearFace(lm, w, cfg) {
    cfg = cfg || CONFIG;
    if (!lm || !(w > 0)) return null;
    var face = [], hand = false, lim = cfg.touchDist * w, i, k;
    for (i = 0; i <= 10; i++) if (okFace(lm[i], cfg)) face.push(lm[i]);
    if (!face.length) return null;
    for (i = 15; i <= 22; i++) {
      var p = lm[i];
      if (!okHand(p, cfg)) continue;
      hand = true;
      for (k = 0; k < face.length; k++) if (Math.hypot(p.x - face[k].x, p.y - face[k].y) <= lim) return true;
    }
    return hand ? false : null;
  }

  // frames: [{t: seconds since start(), lm: prepFrame(...) | null}] sorted by t.
  function computeBaseline(frames, cfg) {
    cfg = cfg || CONFIG;
    var t0 = null, i;
    for (i = 0; i < frames.length; i++) {
      if (frames[i].lm && shoulderWidth(frames[i].lm, cfg) != null) { t0 = frames[i].t; break; }
    }
    if (t0 == null) return null;
    var endT = Math.max(cfg.baselineSec, t0 + cfg.baselineSec), ws = [], rs = [];
    for (i = 0; i < frames.length && frames[i].t < endT; i++) {
      var lm = frames[i].lm;
      if (!lm) continue;
      var w = shoulderWidth(lm, cfg), r = slouchRatio(lm, cfg);
      if (w != null) ws.push(w);
      if (r != null) rs.push(r);
    }
    if (ws.length < cfg.baselineMinFrames) return null;
    return { start: t0, endT: endT, width: median(ws), ratio: rs.length >= cfg.baselineMinFrames ? median(rs) : null, n: ws.length };
  }

  function detectSlouch(frames, base, cfg) {
    cfg = cfg || CONFIG;
    if (!base || !(base.ratio > 0)) return [];
    var pts = [];
    for (var i = 0; i < frames.length; i++) {
      var f = frames[i];
      if (f.t < base.endT || !f.lm) continue;
      var r = slouchRatio(f.lm, cfg);
      if (r != null) pts.push({ t: f.t, v: r });
    }
    var thr = base.ratio * (1 - cfg.slouchDrop);
    var samples = movingAvg(pts, cfg.slouchSmoothSec).map(function (p) { return { t: p.t, on: p.v <= thr }; });
    return findRuns(samples, cfg.slouchGapSec, cfg.slouchMinSec, frameDt(frames, cfg));
  }

  // Zigzag: a reversal is an extreme where the motion turns and both legs exceed thr. Returns reversal times.
  function zigzag(pts, thr) {
    var revs = [];
    if (pts.length < 2) return revs;
    var dir = 0, hi = pts[0], lo = pts[0], ext = null;
    for (var i = 1; i < pts.length; i++) {
      var p = pts[i];
      if (dir === 0) {
        if (p.v > hi.v) hi = p;
        if (p.v < lo.v) lo = p;
        if (p.v - lo.v > thr) { dir = 1; ext = p; } else if (hi.v - p.v > thr) { dir = -1; ext = p; }
      } else if (dir === 1) {
        if (p.v >= ext.v) ext = p; else if (ext.v - p.v > thr) { revs.push(ext.t); dir = -1; ext = p; }
      } else {
        if (p.v <= ext.v) ext = p; else if (p.v - ext.v > thr) { revs.push(ext.t); dir = 1; ext = p; }
      }
    }
    return revs;
  }
  // One sway event = a stretch where every `need` consecutive reversals fit inside `win` seconds.
  function clusterReversals(revs, need, win) {
    var events = [], i = 0;
    while (i + need - 1 < revs.length) {
      if (revs[i + need - 1] - revs[i] <= win) {
        var j = i + need - 1;
        while (j + 1 < revs.length && revs[j + 1] - revs[j + 2 - need] <= win) j++;
        events.push({ start: revs[i], end: revs[j], dur: revs[j] - revs[i], reversals: j - i + 1 });
        i = j + 1;
      } else {
        i++;
      }
    }
    return events;
  }
  function detectSway(frames, base, cfg) {
    cfg = cfg || CONFIG;
    var res = { events: [], reversals: [] };
    if (!base || !(base.width > 0)) return res;
    var pts = [];
    for (var i = 0; i < frames.length; i++) {
      var f = frames[i], lm = f.lm;
      if (f.t < base.endT || !lm || !okShoulder(lm[11], cfg) || !okShoulder(lm[12], cfg)) continue;
      pts.push({ t: f.t, v: (lm[11].x + lm[12].x) / 2 / base.width });
    }
    if (pts.length < 3) return res;
    var trend = movingAvg(pts, cfg.swayDetrendSec);
    var det = pts.map(function (p, j) { return { t: p.t, v: p.v - trend[j].v }; });
    res.reversals = zigzag(movingAvg(det, cfg.swaySmoothSec), cfg.swayAmp);
    res.events = clusterReversals(res.reversals, cfg.swayReversals, cfg.swayWindowSec);
    return res;
  }

  function detectFaceTouches(frames, base, cfg) {
    cfg = cfg || CONFIG;
    if (!base) return [];
    var s = [];
    for (var i = 0; i < frames.length; i++) {
      var f = frames[i];
      if (f.t < base.endT) continue;
      s.push({ t: f.t, on: !!f.lm && nearFace(f.lm, shoulderWidth(f.lm, cfg) || base.width, cfg) === true });
    }
    return findRuns(s, cfg.touchGapSec, cfg.touchMinSec, frameDt(frames, cfg));
  }

  // Hands visible (not near the face) for a fair share of the speech and moving: only then praise gestures.
  function gesturesSeen(frames, base, cfg) {
    cfg = cfg || CONFIG;
    if (!base) return false;
    var n = 0, seen = 0, tr = { 15: { xs: [], ys: [] }, 16: { xs: [], ys: [] } }, i, k;
    for (i = 0; i < frames.length; i++) {
      var f = frames[i], lm = f.lm;
      if (f.t < base.endT || !lm) continue;
      n++;
      if (!okShoulder(lm[11], cfg) || !okShoulder(lm[12], cfg)) continue;
      var w = shoulderWidth(lm, cfg) || base.width;
      if (nearFace(lm, w, cfg) === true) continue;
      var mx = (lm[11].x + lm[12].x) / 2, my = (lm[11].y + lm[12].y) / 2, any = false;
      for (k = 15; k <= 16; k++) {
        if (!okHand(lm[k], cfg)) continue;
        any = true;
        tr[k].xs.push((lm[k].x - mx) / w);
        tr[k].ys.push((lm[k].y - my) / w);
      }
      if (any) seen++;
    }
    if (!n || seen / n < cfg.gestureMinShare) return false;
    var best = 0;
    for (k = 15; k <= 16; k++) {
      if (tr[k].xs.length < 5) continue;
      best = Math.max(best, pct(tr[k].xs, 0.95) - pct(tr[k].xs, 0.05), pct(tr[k].ys, 0.95) - pct(tr[k].ys, 0.05));
    }
    return best >= cfg.gestureMinRange;
  }

  var PRIORITY = { face_touch: 0, slouch: 1, sway: 2 };
  function summarize(frames, cfg, withDebug) {
    cfg = cfg || CONFIG;
    frames = frames || [];
    var T = cfg.text, seen = 0, i;
    var out = { marks: [], counts: { face_touch: 0, sway: 0, slouch: 0 }, line: '', tracked: false, coverage: 0 };
    for (i = 0; i < frames.length; i++) if (frames[i].lm) seen++;
    out.coverage = frames.length ? Math.round(seen / frames.length * 100) / 100 : 0;
    var base = frames.length ? computeBaseline(frames, cfg) : null;
    if (!base) {
      out.reason = frames.length ? 'no_baseline' : 'no_frames';
      if (withDebug) out.debug = { base: null };
      return out;
    }
    var slouch = detectSlouch(frames, base, cfg), sway = detectSway(frames, base, cfg), touch = detectFaceTouches(frames, base, cfg);
    out.tracked = true;
    out.counts = { face_touch: touch.length, sway: sway.events.length, slouch: slouch.length };
    var issues = [{ type: 'face_touch', ev: touch }, { type: 'slouch', ev: slouch }, { type: 'sway', ev: sway.events }]
      .filter(function (x) { return x.ev.length > 0; });
    issues.forEach(function (x) { x.total = x.ev.reduce(function (s, e) { return s + e.dur; }, 0); });
    issues.sort(function (a, b) { return (b.ev.length - a.ev.length) || (b.total - a.total) || (PRIORITY[a.type] - PRIORITY[b.type]); });
    out.marks = issues.slice(0, cfg.maxMarks).map(function (x) {
      var e = x.type === 'face_touch' ? x.ev[0] : x.ev.reduce(function (a, b) { return b.dur > a.dur ? b : a; });
      var n = x.ev.length, t = fmtTime(e.start);
      var tpl = x.type === 'face_touch' && n === 1 ? T.markLines.face_touch_once : T.markLines[x.type];
      return { t: t, sec: Math.round(e.start * 10) / 10, type: x.type, label: T.labels[x.type], n: n, line: fill(tpl, { t: t, n: n }) };
    });
    out.line = T.lines[issues.length ? issues[0].type : (gesturesSeen(frames, base, cfg) ? 'gestures' : 'none')];
    if (withDebug) out.debug = { base: base, slouch: slouch, sway: sway, touches: touch };
    return out;
  }

  function changeLine(before, after, cfg) {
    cfg = cfg || CONFIG;
    if (!before || !after || before.tracked === false || after.tracked === false) return null;
    var x = before.counts && before.counts.face_touch, y = after.counts && after.counts.face_touch;
    if (typeof x !== 'number' || typeof y !== 'number' || !(y < x)) return null;
    return fill(cfg.text.change, { before: x, after: y });
  }

  // Live dots: compares each frame to the attempt's own baseline. "off" only after the full duration rule.
  function makeLive(cfg) {
    cfg = cfg || CONFIG;
    var rs = [], ws = [], base = null, ema = null, slouchSince = null, touchSince = null;
    return {
      push: function (f) {
        var lm = f && f.lm, st = { posture: 'unknown', hands: 'unknown', facing: facing(lm, cfg) };
        if (!lm) return st;
        var r = slouchRatio(lm, cfg), w = shoulderWidth(lm, cfg);
        var nf = nearFace(lm, w || (base && base.width) || 0, cfg);
        if (!base) {
          if (r != null) rs.push(r);
          if (w != null) ws.push(w);
          if (f.t >= cfg.baselineSec && ws.length >= cfg.baselineMinFrames) base = { ratio: median(rs), width: median(ws) };
          st.posture = r != null ? 'ok' : 'unknown';
          st.hands = nf == null ? 'unknown' : 'ok';
          return st;
        }
        if (r != null && base.ratio > 0) {
          ema = ema == null ? r : ema + (r - ema) * Math.min(1, 1 / (cfg.fps * Math.max(cfg.slouchSmoothSec, 0.01)));
          if (ema <= base.ratio * (1 - cfg.slouchDrop)) { if (slouchSince == null) slouchSince = f.t; } else slouchSince = null;
          st.posture = slouchSince != null && f.t - slouchSince >= cfg.slouchMinSec ? 'off' : 'ok';
        }
        if (nf === true) {
          if (touchSince == null) touchSince = f.t;
          st.hands = f.t - touchSince >= cfg.touchMinSec ? 'off' : 'ok';
        } else {
          touchSince = null;
          st.hands = nf === false ? 'ok' : 'unknown';
        }
        return st;
      }
    };
  }

  // ---------------------------------------------------------------- MediaPipe + camera glue (browser only)
  var S = {
    phase: 'idle', video: null, landmarker: null, delegate: null, vision: null, fileset: null, model: null, source: null,
    loading: null, ownStream: null, running: false, raf: 0, t0: 0, due: 0, lastTs: 0,
    frames: [], live: null, listeners: [], status: null, errors: 0, recreating: false, lastFrames: [], lastError: null
  };
  function now() { return typeof performance !== 'undefined' ? performance.now() : Date.now(); }
  function errMsg(e) { return String((e && (e.message || e.name)) || e || 'error').slice(0, 300); }
  function absUrl(u) {
    try { return new URL(u, (typeof document !== 'undefined' && document.baseURI) || undefined).href; } catch (e) { return u; }
  }
  function assetSources() {
    var list = [], base = typeof root.BODY_ASSET_BASE === 'string' ? root.BODY_ASSET_BASE : LOCAL_BASE;
    if (base) {
      base = absUrl(base.replace(/\/+$/, '') + '/').replace(/\/+$/, '');
      list.push({ name: 'local', bundle: base + '/vision_bundle.mjs', wasm: base + '/wasm', model: base + '/pose_landmarker_lite.task' });
    }
    list.push({ name: 'cdn', bundle: CDN_BASE + '/vision_bundle.mjs', wasm: CDN_BASE + '/wasm', model: CDN_MODEL });
    return list;
  }
  // import() needs a JavaScript MIME type; server.py serves .mjs as application/octet-stream, so on failure
  // re-import the same file through a same-origin blob: URL (the bundle has no imports of its own).
  function importBundle(url) {
    return import(url).catch(function (e1) {
      return fetch(url).then(function (r) {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.text();
      }).then(function (code) {
        var blobUrl = URL.createObjectURL(new Blob([code], { type: 'text/javascript' }));
        return import(blobUrl).finally(function () { URL.revokeObjectURL(blobUrl); });
      }).catch(function (e2) { throw new Error('bundle: ' + errMsg(e1) + ' / ' + errMsg(e2)); });
    });
  }
  function landmarkerOptions(model, delegate) {
    return {
      baseOptions: { modelAssetPath: model, delegate: delegate },
      runningMode: 'VIDEO', numPoses: 1, outputSegmentationMasks: false,
      minPoseDetectionConfidence: 0.5, minPosePresenceConfidence: 0.5, minTrackingConfidence: 0.5
    };
  }
  // The first GPU detections are slow (measured: ~2 frames in 2.5 s cold, 12 fps warm). Pay that during init,
  // not during the speech; a delegate whose warm-up throws is dropped here instead of mid-attempt.
  function warmUp(lmk) {
    if (typeof document === 'undefined') return;
    var c = document.createElement('canvas');
    c.width = 640; c.height = 480;
    var g = c.getContext('2d');
    if (g) { g.fillStyle = '#808080'; g.fillRect(0, 0, 640, 480); }
    for (var i = 0; i < 3; i++) {
      var ts = Math.max(Math.round(now()), S.lastTs + 1);
      S.lastTs = ts;
      var r = lmk.detectForVideo(c, ts);
      if (r && typeof r.close === 'function') r.close();
    }
  }
  async function loadFrom(src) {
    var mod = await importBundle(src.bundle);
    var vision = mod && mod.PoseLandmarker ? mod : (mod && mod.default) || null;
    if (!vision || !vision.PoseLandmarker || !vision.FilesetResolver) throw new Error('bundle has no PoseLandmarker');
    var fileset = await vision.FilesetResolver.forVisionTasks(src.wasm);
    var lastErr = null, delegates = ['GPU', 'CPU'];
    for (var i = 0; i < delegates.length; i++) {
      var lmk = null;
      try {
        lmk = await vision.PoseLandmarker.createFromOptions(fileset, landmarkerOptions(src.model, delegates[i]));
        warmUp(lmk);
        return { landmarker: lmk, delegate: delegates[i], vision: vision, fileset: fileset };
      } catch (e) {
        lastErr = e;
        try { if (lmk && lmk.close) lmk.close(); } catch (_) {}
      }
    }
    throw lastErr || new Error('createFromOptions failed');
  }
  function loadModel() {
    if (S.landmarker) return Promise.resolve({ ok: true, delegate: S.delegate, source: S.source });
    if (S.loading) return S.loading;
    S.phase = 'loading';
    S.loading = (async function () {
      var errs = [], list = assetSources();
      for (var i = 0; i < list.length; i++) {
        try {
          var r = await loadFrom(list[i]);
          S.landmarker = r.landmarker; S.delegate = r.delegate; S.vision = r.vision; S.fileset = r.fileset;
          S.model = list[i].model; S.source = list[i].name; S.phase = 'ready';
          return { ok: true, delegate: r.delegate, source: list[i].name };
        } catch (e) {
          errs.push(list[i].name + ': ' + errMsg(e));
        }
      }
      S.phase = 'error'; S.loading = null; S.lastError = errs.join(' | ');
      return { ok: false, reason: 'load_failed', detail: S.lastError };
    })();
    return S.loading;
  }
  function cameraReason(e) {
    var n = e && e.name;
    if (n === 'NotAllowedError' || n === 'SecurityError' || n === 'PermissionDeniedError') return 'camera_denied';
    if (n === 'NotFoundError' || n === 'OverconstrainedError' || n === 'DevicesNotFoundError') return 'camera_unavailable';
    if (n === 'NotReadableError' || n === 'AbortError' || n === 'TrackStartError') return 'camera_busy';
    return 'camera_error';
  }
  async function ensureCamera(v) {
    if (v.srcObject || v.currentSrc || (v.getAttribute && v.getAttribute('src'))) {
      if (v.paused) { try { await v.play(); } catch (_) { /* the UI owns playback */ } }
      return;
    }
    var md = typeof navigator !== 'undefined' && navigator.mediaDevices;
    if (!md || !md.getUserMedia) { var e = new Error('getUserMedia unavailable'); e.name = 'NotFoundError'; throw e; }
    var stream = await md.getUserMedia({ video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' }, audio: false });
    S.ownStream = stream;
    v.muted = true; v.playsInline = true;
    if (v.setAttribute) v.setAttribute('playsinline', '');
    v.srcObject = stream;
    try { await v.play(); } catch (_) { /* muted autoplay is allowed; ignore */ }
  }

  async function init(videoEl) {
    try {
      if (!videoEl || typeof videoEl.play !== 'function') return { ok: false, reason: 'no_video_element' };
      S.video = videoEl;
      var model = loadModel(); // downloads while the camera prompt is open; never rejects
      try { await ensureCamera(videoEl); } catch (e) { return { ok: false, reason: cameraReason(e), detail: errMsg(e) }; }
      var timer = null;
      var res = await Promise.race([model, new Promise(function (r) {
        timer = setTimeout(function () { r({ ok: false, reason: 'load_timeout', detail: 'still loading after ' + CONFIG.initTimeoutMs + ' ms' }); }, CONFIG.initTimeoutMs);
      })]);
      clearTimeout(timer);
      return res;
    } catch (e) {
      return { ok: false, reason: 'init_error', detail: errMsg(e) };
    }
  }

  function emit(st) {
    if (!st) return;
    var p = S.status;
    if (p && p.posture === st.posture && p.hands === st.hands && p.facing === st.facing) return;
    S.status = { posture: st.posture, hands: st.hands, facing: st.facing };
    for (var i = 0; i < S.listeners.length; i++) {
      try { S.listeners[i]({ posture: st.posture, hands: st.hands, facing: st.facing }); } catch (_) { /* UI errors stay in the UI */ }
    }
  }
  function onStatus(cb) {
    if (typeof cb !== 'function') return function () {};
    if (S.listeners.indexOf(cb) < 0) S.listeners.push(cb);
    if (S.status) { try { cb({ posture: S.status.posture, hands: S.status.hands, facing: S.status.facing }); } catch (_) {} }
    return function () { S.listeners = S.listeners.filter(function (f) { return f !== cb; }); };
  }
  function stopLoop() {
    if (S.raf && typeof cancelAnimationFrame === 'function') cancelAnimationFrame(S.raf);
    S.raf = 0;
  }
  function onDetectError(e) {
    S.errors++;
    S.lastError = errMsg(e);
    if (S.delegate === 'GPU' && !S.recreating && S.vision && S.fileset) {
      S.recreating = true; // GPU failed mid-run: rebuild once on CPU, keep the loop going
      var old = S.landmarker;
      S.landmarker = null;
      try { if (old && old.close) old.close(); } catch (_) {}
      S.vision.PoseLandmarker.createFromOptions(S.fileset, landmarkerOptions(S.model, 'CPU')).then(function (l) {
        S.landmarker = l; S.delegate = 'CPU'; S.recreating = false;
      }, function (err) { S.recreating = false; S.phase = 'error'; S.lastError = errMsg(err); });
    } else if (S.errors > 30) {
      S.running = false; S.phase = 'error';
    }
  }
  function tick() {
    var t = now();
    if (t < S.due) return;
    var v = S.video, lmk = S.landmarker;
    if (!lmk || !v || v.readyState < 2 || !v.videoWidth || !v.videoHeight) return;
    var iv = 1000 / CONFIG.fps;
    S.due = S.due && t - S.due < iv ? S.due + iv : t + iv;
    var ts = Math.max(Math.round(t), S.lastTs + 1);
    S.lastTs = ts;
    var res = lmk.detectForVideo(v, ts);
    var raw = res && res.landmarks && res.landmarks[0];
    var frame = { t: (t - S.t0) / 1000, lm: raw ? prepFrame(raw, v.videoWidth / v.videoHeight) : null };
    if (res && typeof res.close === 'function') { try { res.close(); } catch (_) {} }
    S.frames.push(frame);
    emit(S.live.push(frame));
  }
  function loop() {
    if (!S.running) return;
    try { tick(); } catch (e) { onDetectError(e); }
    if (S.running) S.raf = requestAnimationFrame(loop);
  }
  function start() {
    stopLoop();
    S.frames = []; S.live = makeLive(CONFIG); S.status = null; S.errors = 0;
    S.t0 = now(); S.due = 0; S.running = true;
    emit({ posture: 'unknown', hands: 'unknown', facing: 'unknown' });
    if (typeof requestAnimationFrame === 'function') S.raf = requestAnimationFrame(loop);
    if (S.landmarker) return { ok: true };
    // still loading: keeps running and starts scoring once the model is ready
    return { ok: false, reason: S.phase === 'loading' ? 'not_ready' : 'not_initialised' };
  }
  function stop() {
    S.running = false;
    stopLoop();
    var frames = S.frames || [], out;
    try { out = summarize(frames, CONFIG); } catch (e) {
      out = { marks: [], counts: { face_touch: 0, sway: 0, slouch: 0 }, line: '', tracked: false, coverage: 0, reason: 'error' };
    }
    if (!frames.length && !S.landmarker) out.reason = S.phase === 'loading' ? 'not_ready' : 'not_initialised';
    S.lastFrames = frames;
    S.frames = [];
    return out;
  }
  function destroy() {
    S.running = false;
    stopLoop();
    try { if (S.landmarker && S.landmarker.close) S.landmarker.close(); } catch (_) {}
    S.landmarker = null; S.loading = null; S.phase = 'idle';
    if (S.ownStream) {
      try { S.ownStream.getTracks().forEach(function (tr) { tr.stop(); }); } catch (_) {}
      if (S.video && S.video.srcObject === S.ownStream) S.video.srcObject = null;
      S.ownStream = null;
    }
  }

  var BodyTrack = {
    version: MP_VERSION,
    CONFIG: CONFIG,
    init: init,
    start: start,
    stop: stop,
    onStatus: onStatus,
    destroy: destroy,
    changeLine: function (a, b) { return changeLine(a, b, CONFIG); },
    resummarize: function () { return summarize(S.lastFrames, CONFIG); },
    inspect: function () {
      var fr = S.running ? S.frames : S.lastFrames, r = summarize(fr, CONFIG, true);
      return { phase: S.phase, source: S.source, delegate: S.delegate, running: S.running, frames: fr.length,
        lastError: S.lastError, debug: r.debug, result: r };
    },
    get phase() { return S.phase; },
    _metrics: {
      CONFIG: CONFIG, prepFrame: prepFrame, shoulderWidth: shoulderWidth, slouchRatio: slouchRatio, facing: facing,
      nearFace: nearFace, computeBaseline: computeBaseline, detectSlouch: detectSlouch, detectSway: detectSway,
      detectFaceTouches: detectFaceTouches, gesturesSeen: gesturesSeen, summarize: summarize, changeLine: changeLine,
      makeLive: makeLive, zigzag: zigzag, clusterReversals: clusterReversals, findRuns: findRuns,
      movingAvg: movingAvg, fmtTime: fmtTime, assetSources: assetSources
    }
  };
  root.BodyTrack = BodyTrack;
  if (typeof module === 'object' && module && module.exports) module.exports = BodyTrack;
})(typeof window !== 'undefined' ? window : globalThis);
