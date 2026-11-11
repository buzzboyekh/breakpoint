/* Breakpoint chain diagram: window.Chain (owner: chain). Vanilla JS for Chrome, no dependencies.
   Chain.render(container, motion, result, {animate}) draws the opponent's points as rows of
   CLAIM -> REASON -> (EVIDENCE) -> IMPACT, maps the student's rebuttal onto them and marks the
   one break (result.break) in var(--signal). Chain.compare(container, motion, resultA, resultB)
   shows "Try 1" and "Try 2" side by side. Colours, type sizes and durations come from tokens.css.
   Optional opts: mode ("attack"|"defend"|"challenge"), mini (compact rows), fixedFrom (internal). */
(function () {
  'use strict';

  var NS = 'http://www.w3.org/2000/svg';
  var LINKS = ['claim', 'reason', 'evidence', 'impact'];
  var TAGS = { claim: 'CLAIM', reason: 'REASON', evidence: 'EVIDENCE', impact: 'IMPACT',
    target: 'YOUR POINT', attack: 'THEIR ATTACK', challenge: 'THE CHALLENGE', answer: 'YOUR ANSWER' };
  var SHORT = { claim: 'CLAIM', reason: 'REASON', evidence: 'EVID.', impact: 'IMPACT',
    target: 'POINT', attack: 'ATTACK', challenge: 'ASK', answer: 'ANSWER' };
  var DEFEND_BREAKS = { missed_the_attack: 1, new_argument_while_defending: 1 };
  var CHALLENGE_BREAKS = { missed_the_challenge: 1, no_condition: 1, ignored_best_counterpoint: 1, off_point: 1 };
  var ORDINAL = ['first', 'second', 'third', 'fourth', 'fifth'];
  var LOW_CONF = 'Not sure about this one. Check with your coach.';

  var STYLE = [
    '.bp-chain{display:block;width:100%;height:auto;font-family:var(--font-sans)}',
    '.bp-chain text{font-family:var(--font-sans)}',
    '.bp-chain .bp-tag{font-family:var(--font-mono);font-size:var(--t-xs);letter-spacing:.08em;fill:var(--text-3)}',
    '.bp-chain .bp-text{font-size:var(--t-md);fill:var(--text)}',
    '.bp-chain .bp-box{fill:var(--surface);stroke:var(--line-strong);stroke-width:1}',
    '.bp-chain .is-struck .bp-text,.bp-chain .is-struck .bp-tag{fill:var(--text-2)}',
    '.bp-chain .bp-strike{stroke:var(--text);stroke-width:2;stroke-linecap:round}',
    '.bp-chain .is-dashed .bp-box{stroke:var(--text-2);stroke-dasharray:5 4}',
    '.bp-chain .is-signal .bp-box{stroke:var(--signal);stroke-width:2}',
    '.bp-chain .is-signal .bp-tag{fill:var(--signal)}',
    '.bp-chain .is-fixed .bp-box{stroke:var(--hold);stroke-width:2;fill:var(--surface-2)}',
    '.bp-chain .is-empty .bp-text{fill:var(--text-3)}',
    '.bp-chain .bp-line{stroke:var(--text-2);stroke-width:3;stroke-linecap:round;fill:none}',
    '.bp-chain .bp-tail{opacity:.4}',
    '.bp-chain .bp-badge{fill:var(--text-2)}',
    '.bp-chain .bp-row-label{font-size:var(--t-sm);font-weight:600;fill:var(--text-2)}',
    '.bp-chain .bp-row-text{font-size:var(--t-sm);font-weight:400;fill:var(--text-2)}',
    '.bp-chain .bp-chip text{font-size:var(--t-sm);font-weight:600}',
    '.bp-chain .bp-chip-holds rect{fill:var(--hold-soft);stroke:var(--text-2);stroke-width:1}',
    '.bp-chain .bp-chip-holds text{fill:var(--hold)}',
    '.bp-chain .bp-chip-breaks rect{fill:none;stroke:var(--line-strong);stroke-width:1;stroke-dasharray:3 3}',
    '.bp-chain .bp-chip-breaks text{fill:var(--text-2)}',
    '.bp-chain .bp-chip-signal rect{fill:var(--signal)}',
    '.bp-chain .bp-chip-signal text{fill:var(--ink-on-signal)}',
    '.bp-chain .bp-quote{font-size:var(--t-sm);fill:var(--text-2)}',
    '.bp-chain .bp-marker{fill:var(--signal)}',
    '.bp-chain .bp-ring{fill:none;stroke:var(--signal);stroke-width:2}',
    '.bp-chain .bp-leader{stroke:var(--signal);stroke-width:1.5;fill:none}',
    '.bp-chain .bp-label{font-size:var(--t-lg);font-weight:600;fill:var(--signal)}',
    '.bp-chain .bp-label.is-calm{fill:var(--text)}',
    '.bp-chain .bp-label.is-mini{font-size:var(--t-sm)}',
    '.bp-chain .bp-outline{fill:none;stroke:var(--signal);stroke-width:2}',
    '.bp-chain .bp-outline.is-fixed{stroke:var(--hold);stroke-width:1.5}',
    '.bp-chain .bp-fx{transform-box:fill-box;transform-origin:center}',
    '.bp-compare{container-type:inline-size}',
    '.bp-compare-grid{display:grid;grid-template-columns:minmax(0,1fr);gap:var(--s-6)}',
    '@container (min-width: 640px){.bp-compare-grid{grid-template-columns:minmax(0,1fr) minmax(0,1fr)}}',
    '.bp-compare-cell{min-width:0}',
    '.bp-compare-head{margin:0 0 var(--s-2);font-family:var(--font-sans);font-size:var(--t-sm);font-weight:600;line-height:1.4;color:var(--text-2)}'
  ].join('\n');

  function css() {
    if (document.getElementById('bp-chain-style')) return;
    var s = document.createElement('style');
    s.id = 'bp-chain-style';
    s.textContent = STYLE;
    (document.head || document.documentElement).appendChild(s);
  }

  function tokens() {
    var cs = getComputedStyle(document.documentElement);
    function v(n) { return cs.getPropertyValue(n).trim(); }
    function px(n, d) { var x = parseFloat(v(n)); return isFinite(x) && x > 0 ? x : d; }
    function ms(n, d) {
      var raw = v(n); if (!raw) return d;
      var x = parseFloat(raw); if (!isFinite(x)) return d;
      return /ms$/i.test(raw) ? x : (/s$/i.test(raw) ? x * 1000 : x);
    }
    return { xs: px('--t-xs', 12), sm: px('--t-sm', 14), md: px('--t-md', 16), lg: px('--t-lg', 20),
      sans: v('--font-sans') || 'system-ui, sans-serif', mono: v('--font-mono') || 'ui-monospace, monospace',
      slow: ms('--dur-slow', 520), dur: ms('--dur', 280), fast: ms('--dur-fast', 160),
      ease: v('--ease') || 'ease-out' };
  }

  /* ---------- text measuring and wrapping ---------- */
  var ctx2d = null;
  function measurer(size, family, weight, spacingEm) {
    if (!ctx2d) ctx2d = document.createElement('canvas').getContext('2d');
    var font = (weight || 400) + ' ' + size + 'px ' + family;
    ctx2d.font = font;
    if (ctx2d.font.indexOf(size + 'px') < 0) font = (weight || 400) + ' ' + size + 'px sans-serif';
    var extra = (spacingEm || 0) * size, cache = Object.create(null);
    return function (s) {
      if (!(s in cache)) { ctx2d.font = font; cache[s] = ctx2d.measureText(s).width * 1.03 + extra * s.length + 1; }
      return cache[s];
    };
  }
  function meters(tk) {
    return { md: measurer(tk.md, tk.sans, 400), sm: measurer(tk.sm, tk.sans, 400),
      sm6: measurer(tk.sm, tk.sans, 600), lg: measurer(tk.lg, tk.sans, 600),
      tag: measurer(tk.xs, tk.mono, 400, 0.08) };
  }
  function wrap(text, maxW, maxLines, m) {
    var clean = String(text == null ? '' : text).replace(/\s+/g, ' ').trim();
    if (!clean || maxW <= 4 || maxLines < 1) return { lines: [], cut: !!clean };
    var toks = [];
    clean.split(' ').forEach(function (w) {
      if (m(w) <= maxW) { toks.push(w); return; }
      var part = '';
      Array.from(w).forEach(function (ch) {
        if (part && m(part + ch) > maxW) { toks.push(part); part = ch; } else part += ch;
      });
      if (part) toks.push(part);
    });
    var lines = [], cur = '';
    toks.forEach(function (t) {
      var trial = cur ? cur + ' ' + t : t;
      if (!cur || m(trial) <= maxW) cur = trial; else { lines.push(cur); cur = t; }
    });
    if (cur) lines.push(cur);
    if (lines.length <= maxLines) return { lines: lines, cut: false };
    var out = lines.slice(0, maxLines), last = out[maxLines - 1];
    while (last.length > 1 && m(last + '…') > maxW) last = last.slice(0, -1);
    out[maxLines - 1] = last.replace(/[\s,.;:—-]+$/, '') + '…';
    return { lines: out, cut: true };
  }
  function clamp1(text, maxW, m) { return wrap(text, maxW, 1, m).lines[0] || ''; }
  function clean(s) { return s == null ? '' : String(s).replace(/\s+/g, ' ').trim(); }

  /* ---------- svg helpers ---------- */
  function r2(n) { return Math.round(n * 100) / 100; }
  function E(name, attrs, parent) {
    var e = document.createElementNS(NS, name);
    if (attrs) for (var k in attrs) if (attrs[k] != null) e.setAttribute(k, typeof attrs[k] === 'number' ? r2(attrs[k]) : attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }
  function T(parent, x, y, s, cls, anchor) {
    var t = E('text', { x: x, y: y, 'class': cls || null, 'text-anchor': anchor || null }, parent);
    t.textContent = s;
    return t;
  }
  function titled(g, s) { E('title', null, g).textContent = s; return g; }
  /* Safety net: shorten a rendered text until it fits (real glyph widths, whatever font loaded). */
  function fit(t, maxW, part) {
    part = part || t;
    try {
      var n = 0;
      while (t.getComputedTextLength() > maxW + 0.5 && part.textContent.length > 1 && n++ < 300) {
        part.textContent = part.textContent.replace(/…$/, '').slice(0, -1).replace(/\s+$/, '') + '…';
      }
    } catch (e) { /* not rendered yet: canvas measure already applied */ }
    return t;
  }
  function textLen(t, fallback) {
    try { var l = t.getComputedTextLength(); return l > 0 ? l : fallback; } catch (e) { return fallback; }
  }
  function lineLen(el) {
    var x1 = +el.getAttribute('x1'), y1 = +el.getAttribute('y1'), x2 = +el.getAttribute('x2'), y2 = +el.getAttribute('y2');
    return Math.sqrt((x2 - x1) * (x2 - x1) + (y2 - y1) * (y2 - y1));
  }

  /* ---------- animation timeline (transform, opacity, stroke-dashoffset only) ---------- */
  function Timeline(on, tk) { this.on = on; this.t = 0; this.end = 0; this.tk = tk; }
  Timeline.prototype.play = function (el, frames, at, dur, easing) {
    if (!this.on || !el || !el.animate) return;
    at = Math.max(0, at || 0); dur = Math.max(1, dur || 1);
    var o = { delay: at, duration: dur, easing: easing || this.tk.ease, fill: 'both' };
    try { el.animate(frames, o); } catch (e) { o.easing = 'ease-out'; try { el.animate(frames, o); } catch (e2) { return; } }
    if (at + dur > this.end) this.end = at + dur;
  };
  Timeline.prototype.fade = function (el, at, dy) {
    this.play(el, [{ opacity: 0, transform: 'translate(0px,' + (dy || 0) + 'px)' },
      { opacity: 1, transform: 'translate(0px,0px)' }], at, this.tk.dur);
  };
  Timeline.prototype.draw = function (el, at, dur, len) {
    if (!this.on || !el) return;
    len = len == null ? lineLen(el) : len;
    if (len < 0.5) return;
    el.setAttribute('stroke-dasharray', r2(len) + ' ' + r2(len + 8));
    this.play(el, [{ strokeDashoffset: len + 4 }, { strokeDashoffset: 0 }], at, dur, 'linear');
  };

  /* The row's chain line along one axis. Draws left to right (or top to bottom) in --dur-slow,
     stops at the break, the gap opens, then the rest (the tail) draws. */
  function chainLine(g, ax, c, p0, p1, gap, tl, t0, tk, tailDim) {
    var speed = Math.max(0.01, (p1 - p0) / Math.max(1, tk.slow));
    function mk(a, b, cls) {
      if (b - a < 0.5) return null;
      var at = ax === 'x' ? { x1: a, y1: c, x2: b, y2: c } : { x1: c, y1: a, x2: c, y2: b };
      at['class'] = cls;
      return E('line', at, g);
    }
    var res = {};
    if (!gap) {
      tl.draw(mk(p0, p1, 'bp-line'), t0, (p1 - p0) / speed);
      res.timeAt = function (p) { return t0 + (p - p0) / speed; };
      res.end = t0 + (p1 - p0) / speed;
      res.markerAt = res.end;
      return res;
    }
    var ga = gap[0], gb = gap[1];
    tl.draw(mk(p0, ga, 'bp-line'), t0, (ga - p0) / speed);
    var stopAt = t0 + (gb - p0) / speed, openAt = stopAt + 160, tailAt = openAt + tk.dur;
    if (tl.on) {
      var bridge = mk(ga, gb, 'bp-line bp-fx');
      tl.draw(bridge, t0 + (ga - p0) / speed, (gb - ga) / speed);
      tl.play(bridge, [{ opacity: 1, transform: 'scale(1,1)' },
        { opacity: 0, transform: ax === 'x' ? 'scale(0,1)' : 'scale(1,0)' }], openAt, tk.dur);
    }
    tl.draw(mk(gb, p1, 'bp-line' + (tailDim ? ' bp-tail' : '')), tailAt, (p1 - gb) / speed);
    res.markerAt = openAt + tk.dur * 0.4;
    res.timeAt = function (p) { return p <= gb ? t0 + (p - p0) / speed : tailAt + (p - gb) / speed; };
    res.end = Math.max(tailAt + (p1 - gb) / speed, res.markerAt + tk.dur);
    return res;
  }

  function marker(g, x, y, r, tl, at, tk) {
    if (tl.on) {
      var ring = E('circle', { 'class': 'bp-ring bp-fx', cx: x, cy: y, r: r }, g);
      tl.play(ring, [{ opacity: 0, transform: 'scale(1)', offset: 0 }, { opacity: 0.9, offset: 0.06 },
        { opacity: 0, transform: 'scale(2.6)', offset: 1 }], at, tk.slow * 1.6, 'ease-out');
    }
    var dot = E('circle', { 'class': 'bp-marker bp-fx', cx: x, cy: y, r: r }, g);
    tl.play(dot, [{ opacity: 0, transform: 'scale(.4)' }, { opacity: 1, transform: 'scale(1)' }], at, tk.dur);
    return dot;
  }

  function chipInfo(kind) {
    if (kind === 'holds') return { text: 'Holds', cls: 'holds' };
    if (kind === 'breaks') return { text: 'Breaks', cls: 'breaks' };
    if (kind === 'standing') return { text: 'Still standing', cls: 'signal' };
    return { text: 'Breaks', cls: 'signal' };
  }
  function chipW(info, M) { return Math.ceil(M.sm6(info.text)) + 20; }
  function chip(parent, x, y, info, w, tk) {
    var g = E('g', { 'class': 'bp-chip bp-chip-' + info.cls }, parent);
    E('rect', { x: x + 0.5, y: y + 0.5, width: w - 1, height: 23, rx: 11.5 }, g);
    fit(T(g, x + w / 2, y + 12 + tk.sm * 0.35, info.text, null, 'middle'), w - 12);
    return g;
  }
  function nodeClass(nd) {
    return 'bp-node' + (nd.outline ? ' is-' + nd.outline : '') + (nd.struck ? ' is-struck' : '') +
      (nd.fixed ? ' is-fixed' : '') + (nd.empty ? ' is-empty' : '');
  }
  function fitTag(nd, maxW, m) {
    if (m(nd.tag) <= maxW) return nd.tag;
    if (m(nd.short) <= maxW) return nd.short;
    return clamp1(nd.short, maxW, m);
  }
  function header(g, x, y, row, withText, maxW, M) {
    var hg = E('g', null, g);
    var t = E('text', { x: x, y: y }, hg);
    var a = E('tspan', { 'class': 'bp-row-label' }, t);
    a.textContent = row.label;
    var b = null;
    if (withText && row.headText) {
      var room = maxW - M.sm6(row.label) - M.sm(' · ');
      var c = room > 40 ? clamp1(row.headText, room, M.sm) : '';
      if (c) { b = E('tspan', { 'class': 'bp-row-text' }, t); b.textContent = ' · ' + c; }
      titled(hg, row.label + ': ' + row.headText);
    }
    fit(t, maxW, b || a);
    return hg;
  }

  /* ---------- data model ---------- */
  function findRow(rows, arg) {
    if (arg == null || arg === '') return null;
    var a = String(arg).trim().toUpperCase();
    for (var i = 0; i < rows.length; i++) if (String(rows[i].id).toUpperCase() === a) return rows[i];
    var m = a.match(/(\d+)/);
    if (m && rows[parseInt(m[1], 10) - 1]) return rows[parseInt(m[1], 10) - 1];
    return null;
  }
  function findNode(row, link) {
    if (!row || !link) return null;
    var l = String(link).toLowerCase();
    for (var i = 0; i < row.nodes.length; i++) if (row.nodes[i].link === l) return row.nodes[i];
    return null;
  }
  function mkNode(link, text) {
    return { link: link, tag: TAGS[link] || String(link).toUpperCase(), short: SHORT[link] || String(link).toUpperCase(),
      text: clean(text), status: 'untouched', quote: '', chip: null, outline: null, struck: false, fixed: false, empty: false };
  }
  function defaultLabel(type, row) {
    var ord = row ? (ORDINAL[row.index] || 'other') : 'second';
    var map = {
      dropped_argument: 'Dropped their ' + ord + ' argument',
      no_link: 'No link',
      number_without_so_what: 'A number with no "so what"',
      new_argument_while_defending: 'Switched arguments while defending',
      missed_the_attack: 'You answered a different point, not their attack',
      missed_the_challenge: 'You answered a different question',
      no_condition: 'No condition or limit',
      ignored_best_counterpoint: 'Their best point is still standing',
      off_point: 'Drifted off the point'
    };
    return map[type] || String(type).replace(/_/g, ' ').replace(/^\w/, function (c) { return c.toUpperCase(); });
  }

  function buildModel(motion, result, opts) {
    motion = motion || {};
    var r = result || {}, has = !!result;
    var bIn = r['break'] && typeof r['break'] === 'object' ? r['break'] : null;
    var type = bIn && bIn.type ? String(bIn.type) : 'none';
    var args = (motion.opponent && Array.isArray(motion.opponent.args) && motion.opponent.args) ||
      (Array.isArray(motion.args) && motion.args) || [];
    var mode = opts.mode || r.mode || (DEFEND_BREAKS[type] ? 'defend' : CHALLENGE_BREAKS[type] ? 'challenge' : '') || motion.mode || '';
    if (mode === 'defend' && !motion.attack_on_you) mode = '';
    if (mode === 'challenge' && !motion.challenge) mode = '';
    if (!mode) mode = args.length ? 'attack' : motion.attack_on_you ? 'defend' : motion.challenge ? 'challenge' : 'attack';
    var attacks = Array.isArray(r.attacks) ? r.attacks.filter(Boolean) : [];
    var unsure = has && typeof r.confidence === 'number' && r.confidence < 0.6 && opts.respectConfidence !== false;
    var rows = [];
    var brk = { type: type, live: false, row: null, node: null, seg: 0, label: '', calm: false, mode: mode };

    if (mode === 'attack') {
      args.forEach(function (a, i) {
        a = a || {};
        var row = { index: i, id: a.id || ('A' + (i + 1)), label: 'Point ' + (i + 1), nodes: [], headText: clean(a.claim) };
        LINKS.forEach(function (lk) {
          if (lk === 'evidence' && !clean(a.evidence)) return; // empty evidence: three nodes
          row.nodes.push(mkNode(lk, a[lk]));
        });
        rows.push(row);
      });
      var st = {}, hasLinks = false;
      (Array.isArray(r.links) ? r.links : []).forEach(function (l) {
        if (l && l.arg && l.link) { st[String(l.arg).toUpperCase() + ':' + String(l.link).toLowerCase()] = l.status; hasLinks = true; }
      });
      attacks.forEach(function (at) {
        var nd = findNode(findRow(rows, at.arg), at.link);
        if (!nd) return;
        if (!nd.quote && at.quote) nd.quote = clean(at.quote);
        if (!hasLinks && nd.status !== 'broken') nd.status = at.holds ? 'broken' : 'attacked';
      });
      if (hasLinks) rows.forEach(function (row) {
        row.nodes.forEach(function (nd) {
          var s = st[String(row.id).toUpperCase() + ':' + nd.link];
          if (s === 'broken' || s === 'attacked' || s === 'untouched') nd.status = s;
        });
      });
      rows.forEach(function (row) {
        row.nodes.forEach(function (nd) {
          nd.struck = nd.status === 'broken';
          nd.chip = nd.status === 'broken' ? 'holds' : nd.status === 'attacked' ? 'breaks' : null;
          nd.outline = nd.status === 'attacked' ? 'dashed' : null;
        });
      });
      if (has && type !== 'none' && !unsure) {
        var row = findRow(rows, bIn.arg);
        if (!row && type === 'dropped_argument') {
          row = rows.filter(function (rw) { return rw.nodes.every(function (n) { return n.status === 'untouched'; }); })[0] || null;
        }
        if (!row) row = rows.filter(function (rw) { return rw.nodes.some(function (n) { return n.status === 'attacked'; }); })[0] || rows[0] || null;
        if (row) {
          brk.live = true; brk.row = row;
          if (type === 'dropped_argument') { brk.seg = 0; row.standing = true; }
          else {
            var nd = findNode(row, bIn.link) || (String(bIn.link).toLowerCase() === 'evidence' ? findNode(row, 'reason') : null) ||
              row.nodes.filter(function (x) { return x.status === 'attacked'; })[0] || row.nodes[0];
            var idx = row.nodes.indexOf(nd);
            brk.node = nd; nd.struck = false; nd.chip = 'signal'; nd.outline = 'signal';
            brk.seg = type === 'number_without_so_what' && idx < row.nodes.length - 1 ? idx + 1 : idx;
          }
        }
        brk.label = clean(bIn.label) || defaultLabel(type, row);
      } else if (has) {
        brk.calm = true;
        brk.label = unsure ? LOW_CONF : (clean(bIn && bIn.label) || 'Every link you attacked holds');
      }
    } else {
      /* defend: their attack on your point; challenge: a claim plus a challenge question */
      var src = mode === 'defend' ? motion.attack_on_you : motion.challenge;
      var second = mode === 'defend' ? src.attack : (typeof src === 'string' ? src : (src.question || src.text || ''));
      var prow = { index: 0, id: 'A1', label: mode === 'defend' ? 'Their attack' : 'The challenge', nodes: [], headText: clean(second) };
      prow.nodes.push(mode === 'defend' ? mkNode('target', src.target) : mkNode('claim', motion.claim || motion.motion));
      prow.nodes.push(mkNode(mode === 'defend' ? 'attack' : 'challenge', second));
      if (has) {
        var q = attacks.map(function (a) { return clean(a.quote); }).filter(Boolean)[0] || '';
        var ans = mkNode('answer', q ? '“' + q + '”' : 'Nothing heard for this part');
        ans.empty = !q;
        prow.nodes.push(ans);
        if (type !== 'none' && !unsure) {
          brk.live = true; brk.row = prow; brk.node = ans; brk.seg = 2;
          ans.chip = 'signal'; ans.outline = 'signal';
          brk.label = clean(bIn.label) || defaultLabel(type, prow);
        } else {
          brk.calm = true;
          brk.label = unsure ? LOW_CONF : (clean(bIn && bIn.label) ||
            (mode === 'defend' ? 'Your defence answered their attack' : 'You answered the challenge'));
          if (!unsure) { prow.nodes[1].struck = true; ans.chip = 'holds'; }
        }
      }
      rows.push(prow);
    }

    rows.forEach(function (row) {
      if (brk.live && brk.row === row) row.verdict = row.standing ? 'standing' : 'break';
      else {
        var anyB = row.nodes.some(function (n) { return n.chip === 'breaks'; });
        var anyH = row.nodes.some(function (n) { return n.chip === 'holds'; });
        row.verdict = anyB ? 'breaks' : anyH ? 'holds' : null;
      }
    });
    var ff = opts.fixedFrom;
    if (ff && rows[ff.rowIndex] && rows[ff.rowIndex].verdict === 'holds') {
      var fr = rows[ff.rowIndex];
      var fnode = ff.type !== 'dropped_argument' && ff.link ? findNode(fr, ff.link) : null;
      if (fnode && fnode.chip === 'holds') fnode.fixed = true; else fr.fixed = true;
    }
    return { mode: mode, rows: rows, brk: brk };
  }

  function summary(model) {
    var parts = [];
    model.rows.forEach(function (row) {
      var bits = [row.label + (row.nodes[0] ? ': ' + row.nodes[0].text : '')];
      row.nodes.forEach(function (n) {
        var who = n.link === 'answer' ? 'your answer' : 'your attack on the ' + n.tag.toLowerCase();
        if (n.chip === 'holds') bits.push(who + ' holds');
        else if (n.chip) bits.push(who + ' breaks');
      });
      if (row.standing) bits.push('still standing');
      parts.push(bits.join(', ') + '.');
    });
    if (model.brk.label) parts.push(model.brk.label + '.');
    return parts.join(' ');
  }

  /* ---------- layout: horizontal rows (wide screens, and the mini rows of compare) ---------- */
  function hGeo(mini, model) {
    if (mini) return { PAD: 4, inset: 8, R: 4, lead: 38, gap: 28, gh: 10 };
    /* a break at the start of a row (dropped argument) gets a longer lead so its gap reads clearly */
    var startBreak = model && model.brk.live && model.brk.seg === 0;
    return { PAD: 4, inset: 12, R: 5, lead: startBreak ? 64 : 44, gap: 40, gh: 14 };
  }
  function needsVertical(model, W) {
    var k = hGeo(false, model), inner = W - 2 * k.PAD - 2 * k.inset - 2 * k.R - k.lead;
    return model.rows.some(function (row) {
      var n = Math.max(1, row.nodes.length);
      return (inner - k.gap * (n - 1)) / n < 140;
    });
  }

  function paintH(svg, model, W, tk, tl, mini) {
    var k = hGeo(mini, model), PAD = k.PAD, R = k.R, gap = k.gap;
    var badgeX = PAD + k.inset + R, x0 = badgeX + R + k.lead, right = W - PAD - k.inset, left = badgeX - R;
    var M = meters(tk);
    var LH = Math.round(tk.md * 1.4), QLH = Math.round(tk.sm * 1.45), LLH = Math.round(tk.lg * 1.3);
    var brk = model.brk, y = PAD + 10, last = y;
    model.rows.forEach(function (row) {
      var n = row.nodes.length;
      if (!n) return;
      var g = E('g', { 'class': 'bp-row' }, svg);
      var gOut = E('g', null, g), gLine = E('g', null, g), gNodes = E('g', null, g),
        gMark = E('g', null, g), gChips = E('g', null, g), gLabel = E('g', null, g);
      var nodeW = Math.max(24, (right - x0 - gap * (n - 1)) / n);
      var xs = row.nodes.map(function (_, i) { return x0 + i * (nodeW + gap); });
      var live = brk.live && brk.row === row, rowTop = y, t0 = tl.t;

      var hv = mini ? row.verdict : (row.standing ? 'standing' : null);
      var hinfo = hv ? chipInfo(hv) : null, hcw = hinfo ? chipW(hinfo, M) : 0;
      var hg = header(g, left, rowTop + 15, row, mini, right - left - (hcw ? hcw + 12 : 0), M);
      tl.fade(hg, t0, 4);
      var hchip = hinfo ? chip(g, right - hcw, rowTop - 2, hinfo, hcw, tk) : null;

      var nodesTop = rowTop + 24 + (mini ? 6 : 10);
      var wr = row.nodes.map(function (nd) { return mini ? null : wrap(nd.text, nodeW - 24, 3, M.md); });
      var maxL = 1;
      wr.forEach(function (w) { if (w && w.lines.length > maxL) maxL = w.lines.length; });
      var nodeH = mini ? 30 : 12 + tk.xs + 8 + maxL * LH + 8;
      var cy = nodesTop + nodeH / 2;

      var gp = null, gc = 0;
      if (live) {
        var s = Math.min(Math.max(0, brk.seg), n - 1);
        var a = s === 0 ? badgeX + R : xs[s - 1] + nodeW, b = xs[s];
        gc = (a + b) / 2;
        var gh = Math.max(3, Math.min(k.gh, (b - a) / 2 - 4));
        gp = [gc - gh, gc + gh];
      }
      var L = chainLine(gLine, 'x', cy, badgeX, xs[n - 1] + nodeW / 2, gp, tl, t0, tk, live && !row.standing);
      tl.fade(E('circle', { 'class': 'bp-badge', cx: badgeX, cy: cy, r: R }, gLine), t0 - 80, 0);

      var bandTop = nodesTop + nodeH + 10, bandH = 0;
      row.nodes.forEach(function (nd, i) {
        var nx = xs[i];
        var ng = titled(E('g', { 'class': nodeClass(nd) }, gNodes), nd.tag + ': ' + (nd.text || ''));
        E('rect', { 'class': 'bp-box', x: nx, y: nodesTop, width: nodeW, height: nodeH, rx: 8 }, ng);
        var strikes = [];
        if (mini) {
          var tg = fitTag(nd, nodeW - 8, M.tag);
          var te = fit(T(ng, nx + nodeW / 2, cy + tk.xs * 0.36, tg, 'bp-tag', 'middle'), nodeW - 8);
          if (nd.struck) {
            var tw = Math.min(textLen(te, M.tag(tg)), nodeW - 8);
            strikes.push(E('line', { 'class': 'bp-strike', x1: nx + (nodeW - tw) / 2, y1: cy, x2: nx + (nodeW + tw) / 2, y2: cy }, ng));
          }
        } else {
          fit(T(ng, nx + 12, nodesTop + 12 + tk.xs * 0.82, nd.tag, 'bp-tag'), nodeW - 24);
          var top = nodesTop + 12 + tk.xs + 8;
          wr[i].lines.forEach(function (ln, j) {
            var by = top + j * LH + (LH + tk.md * 0.7) / 2;
            var tx = fit(T(ng, nx + 12, by, ln, 'bp-text'), nodeW - 24);
            if (nd.struck) {
              var lw = Math.min(textLen(tx, M.md(ln)), nodeW - 24);
              strikes.push(E('line', { 'class': 'bp-strike', x1: nx + 12, y1: by - tk.md * 0.3, x2: nx + 12 + lw, y2: by - tk.md * 0.3 }, ng));
            }
          });
        }
        var at = L.timeAt(nx) - 40;
        tl.fade(ng, at, 6);
        strikes.forEach(function (sl) { tl.draw(sl, at + tk.dur, tk.fast * 2); });
        if (nd.fixed) tl.play(ng, [{ transform: 'scale(1)' }, { transform: 'scale(1.04)' }, { transform: 'scale(1)' }], L.end + 60, tk.slow);
        if (!mini && nd.chip) {
          var ci = chipInfo(nd.chip), cw = Math.min(nodeW, chipW(ci, M));
          var cg = E('g', null, gChips);
          chip(cg, nx, bandTop, ci, cw, tk);
          var h = 24;
          if (nd.quote) {
            titled(cg, 'You said: “' + nd.quote + '”');
            var q = wrap('“' + nd.quote + '”', nodeW, 2, M.sm);
            q.lines.forEach(function (ln, j) {
              fit(T(cg, nx, bandTop + 30 + j * QLH + (QLH + tk.sm * 0.7) / 2, ln, 'bp-quote'), nodeW);
            });
            h = 30 + q.lines.length * QLH;
          }
          bandH = Math.max(bandH, h);
          tl.fade(cg, at + tk.dur + tk.fast, 4);
        }
      });

      if (live) marker(gMark, gc, cy, mini ? 4.5 : 6, tl, L.markerAt, tk);

      var bottom = nodesTop + nodeH, finish = L.end;
      if (bandH) bottom = Math.max(bottom, bandTop + bandH);
      if (row.standing || row.fixed) {
        var ob = bottom + 10;
        var ol = E('rect', { 'class': 'bp-outline' + (row.standing ? '' : ' is-fixed'), x: PAD + 1, y: rowTop - 9,
          width: W - 2 * PAD - 2, height: ob - (rowTop - 9), rx: 12 }, gOut);
        tl.fade(ol, L.end + 40, 0);
        bottom = ob;
        finish = L.end + 40 + tk.dur;
      }
      if (hchip) tl.fade(hchip, L.end + 40, 4);

      if (live && brk.label) {
        if (mini) {
          var mg = titled(E('g', null, gLabel), brk.label);
          fit(T(mg, left, bottom + 10 + tk.sm, clamp1(brk.label, right - left, M.sm6), 'bp-label is-mini'), right - left);
          tl.fade(mg, finish + 60, 4);
          bottom = bottom + 10 + tk.sm + 4;
        } else {
          var lw2 = wrap(brk.label, right - left, 2, M.lg), widest = 0;
          lw2.lines.forEach(function (ln) { widest = Math.max(widest, M.lg(ln)); });
          var lx = row.standing ? left : Math.max(left, Math.min(gc - 10, right - widest));
          var ly = bottom + (row.standing ? 14 : 22);
          var lg = E('g', null, gLabel);
          if (lw2.cut) titled(lg, brk.label);
          lw2.lines.forEach(function (ln, j) {
            fit(T(lg, lx, ly + j * LLH + (LLH + tk.lg * 0.7) / 2, ln, 'bp-label'), right - lx);
          });
          var labAt = finish + 60;
          if (!row.standing) {
            var ld = E('line', { 'class': 'bp-leader', x1: gc, y1: cy + 10, x2: gc, y2: ly - 2 }, gLabel);
            tl.draw(ld, L.markerAt + tk.dur * 0.6, tk.dur);
            labAt = L.markerAt + tk.dur * 1.4;
          }
          tl.fade(lg, labAt, 6);
          bottom = ly + lw2.lines.length * LLH;
          finish = Math.max(finish, labAt + tk.dur);
        }
      }
      last = bottom;
      y = bottom + (mini ? 22 : 36);
      tl.t = Math.max(finish, L.end) + 120;
    });
    if (!mini && brk.calm && brk.label) last = calmLabel(svg, brk, left, right, last + 22, tk, tl, M);
    return last + PAD + 2;
  }

  function calmLabel(svg, brk, left, right, top, tk, tl, M) {
    var LLH = Math.round(tk.lg * 1.3);
    var w = wrap(brk.label, right - left, 2, M.lg);
    var g = E('g', null, svg);
    if (w.cut) titled(g, brk.label);
    w.lines.forEach(function (ln, j) {
      fit(T(g, left, top + j * LLH + (LLH + tk.lg * 0.7) / 2, ln, 'bp-label is-calm'), right - left);
    });
    tl.fade(g, tl.t, 6);
    return top + w.lines.length * LLH;
  }

  /* ---------- layout: vertical rows (phones and narrow columns) ---------- */
  function paintV(svg, model, W, tk, tl) {
    var PAD = 4, inset = 8, R = 5;
    var lineX = PAD + inset + R, cx = lineX + R + 16, right = W - PAD - inset, cw = Math.max(40, right - cx);
    var M = meters(tk);
    var LH = Math.round(tk.md * 1.4), QLH = Math.round(tk.sm * 1.45), LLH = Math.round(tk.lg * 1.3);
    var brk = model.brk, y = PAD + 10, last = y;
    model.rows.forEach(function (row) {
      var n = row.nodes.length;
      if (!n) return;
      var g = E('g', { 'class': 'bp-row' }, svg);
      var gOut = E('g', null, g), gLine = E('g', null, g), gNodes = E('g', null, g),
        gMark = E('g', null, g), gChips = E('g', null, g), gLabel = E('g', null, g);
      var live = brk.live && brk.row === row, rowTop = y, t0 = tl.t;
      var hinfo = row.standing ? chipInfo('standing') : null, hcw = hinfo ? chipW(hinfo, M) : 0;
      tl.fade(header(g, cx, rowTop + 15, row, false, right - cx - (hcw ? hcw + 12 : 0), M), t0, 4);
      var hchip = hinfo ? chip(g, right - hcw, rowTop - 2, hinfo, hcw, tk) : null;
      var badgeY = rowTop + 10, ny = rowTop + 24 + 16;

      var geo = row.nodes.map(function (nd) {
        var w = wrap(nd.text, cw - 24, 4, M.md);
        var h = 12 + tk.xs + 8 + Math.max(1, w.lines.length) * LH + 8;
        var o = { top: ny, h: h, cy: ny + h / 2, lines: w.lines, bandTop: ny + h + 8, bandH: 0 };
        if (nd.chip) {
          o.ci = chipInfo(nd.chip); o.cw = Math.min(cw, chipW(o.ci, M)); o.bandH = 24;
          if (nd.quote) {
            o.qx = cx + o.cw + 10;
            o.q = wrap('“' + nd.quote + '”', right - o.qx, 2, M.sm);
            o.bandH = Math.max(24, o.q.lines.length * QLH + 4);
          }
        }
        ny = ny + h + (o.bandH ? 8 + o.bandH : 0) + 16;
        return o;
      });

      var gp = null, gc = 0, s = Math.min(Math.max(0, brk.seg), n - 1);
      if (live) {
        var a = s === 0 ? badgeY + R : geo[s - 1].cy, b = geo[s].cy;
        gc = (a + b) / 2;
        var gh = Math.max(3, Math.min(12, (b - a) / 2 - 4));
        gp = [gc - gh, gc + gh];
      }
      var dim = live && !row.standing;
      var L = chainLine(gLine, 'y', lineX, badgeY, geo[n - 1].cy, gp, tl, t0, tk, dim);
      tl.fade(E('circle', { 'class': 'bp-badge', cx: lineX, cy: badgeY, r: R }, gLine), t0 - 80, 0);

      row.nodes.forEach(function (nd, i) {
        var o = geo[i];
        var stub = E('line', { 'class': 'bp-line' + (dim && i >= s ? ' bp-tail' : ''), x1: lineX, y1: o.cy, x2: cx - 2, y2: o.cy }, gLine);
        var at = L.timeAt(o.cy) - 40;
        tl.draw(stub, at, tk.fast);
        var ng = titled(E('g', { 'class': nodeClass(nd) }, gNodes), nd.tag + ': ' + (nd.text || ''));
        E('rect', { 'class': 'bp-box', x: cx, y: o.top, width: cw, height: o.h, rx: 8 }, ng);
        fit(T(ng, cx + 12, o.top + 12 + tk.xs * 0.82, nd.tag, 'bp-tag'), cw - 24);
        var top = o.top + 12 + tk.xs + 8, strikes = [];
        o.lines.forEach(function (ln, j) {
          var by = top + j * LH + (LH + tk.md * 0.7) / 2;
          var tx = fit(T(ng, cx + 12, by, ln, 'bp-text'), cw - 24);
          if (nd.struck) {
            var lw = Math.min(textLen(tx, M.md(ln)), cw - 24);
            strikes.push(E('line', { 'class': 'bp-strike', x1: cx + 12, y1: by - tk.md * 0.3, x2: cx + 12 + lw, y2: by - tk.md * 0.3 }, ng));
          }
        });
        tl.fade(ng, at, 6);
        strikes.forEach(function (sl) { tl.draw(sl, at + tk.dur, tk.fast * 2); });
        if (o.ci) {
          var cg = E('g', null, gChips);
          chip(cg, cx, o.bandTop, o.ci, o.cw, tk);
          if (o.q) {
            titled(cg, 'You said: “' + nd.quote + '”');
            o.q.lines.forEach(function (ln, j) {
              fit(T(cg, o.qx, o.bandTop + 12 + tk.sm * 0.35 + j * QLH, ln, 'bp-quote'), right - o.qx);
            });
          }
          tl.fade(cg, at + tk.dur + tk.fast, 4);
        }
      });

      if (live) marker(gMark, lineX, gc, 6, tl, L.markerAt, tk);
      var lastGeo = geo[n - 1];
      var bottom = lastGeo.top + lastGeo.h + (lastGeo.bandH ? 8 + lastGeo.bandH : 0), finish = L.end;
      if (row.standing || row.fixed) {
        var ob = bottom + 10;
        var ol = E('rect', { 'class': 'bp-outline' + (row.standing ? '' : ' is-fixed'), x: PAD + 1, y: rowTop - 9,
          width: W - 2 * PAD - 2, height: ob - (rowTop - 9), rx: 12 }, gOut);
        tl.fade(ol, L.end + 40, 0);
        bottom = ob; finish = L.end + 40 + tk.dur;
      }
      if (hchip) tl.fade(hchip, L.end + 40, 4);
      if (live && brk.label) {
        var lw2 = wrap(brk.label, right - cx, 3, M.lg);
        var ly = bottom + 14, lg = E('g', null, gLabel);
        if (lw2.cut) titled(lg, brk.label);
        lw2.lines.forEach(function (ln, j) {
          fit(T(lg, cx, ly + j * LLH + (LLH + tk.lg * 0.7) / 2, ln, 'bp-label'), right - cx);
        });
        var labAt = row.standing ? finish + 60 : L.markerAt + tk.dur * 1.2;
        tl.fade(lg, labAt, 6);
        bottom = ly + lw2.lines.length * LLH;
        finish = Math.max(finish, labAt + tk.dur);
      }
      last = bottom;
      y = bottom + 36;
      tl.t = Math.max(finish, L.end) + 120;
    });
    if (brk.calm && brk.label) last = calmLabel(svg, brk, lineX - R, right, last + 22, tk, tl, M);
    return last + PAD + 2;
  }

  /* ---------- public: render ---------- */
  var hosts = [];
  function isSvgEl(el) { return el && el.namespaceURI === NS && String(el.tagName).toLowerCase() === 'svg'; }

  function paint(host, st, wantAnim) {
    var motion = st.args[0], result = st.args[1], opts = st.args[2];
    var svg;
    if (isSvgEl(host)) {
      svg = host;
      while (svg.firstChild) svg.removeChild(svg.firstChild);
      svg.classList.add('bp-chain');
    } else {
      host.textContent = '';
      svg = E('svg', { 'class': 'bp-chain', xmlns: NS }, host);
    }
    svg.removeAttribute('viewBox');
    var W = Math.floor(svg.getBoundingClientRect().width || host.getBoundingClientRect().width || 0);
    st.pending = false;
    if (W < 40) { st.pending = !!wantAnim; st.w = 0; W = 640; } else st.w = W;
    var tk = tokens();
    var reduce = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    var tl = new Timeline(!!wantAnim && !st.pending && !reduce && tk.slow > 0, tk);
    var model = buildModel(motion, result, opts);
    var H = (!opts.mini && needsVertical(model, W)) ? paintV(svg, model, W, tk, tl) : paintH(svg, model, W, tk, tl, !!opts.mini);
    H = Math.max(24, Math.ceil(H));
    svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
    svg.setAttribute('role', 'img');
    svg.setAttribute('aria-label', summary(model));
    svg.setAttribute('data-break', model.brk.live ? model.brk.type : (model.brk.calm ? 'none' : ''));
    st.animEnd = Date.now() + (tl.on ? tl.end : 0);
    var ms = tl.on ? tl.end + 30 : 0;
    return { height: H, mode: model.mode, done: new Promise(function (res) { setTimeout(res, ms); }) };
  }

  function observe(host, st) {
    if (st.ro || typeof ResizeObserver === 'undefined') return;
    st.ro = new ResizeObserver(function () {
      if (st.raf) return;
      st.raf = requestAnimationFrame(function () {
        st.raf = 0;
        if (!host.isConnected) return;
        /* measure the svg, as paint() does: the host's own box may include padding */
        var el = isSvgEl(host) ? host : (host.querySelector('svg.bp-chain') || host);
        var w = Math.floor(el.getBoundingClientRect().width);
        if (w < 40 || Math.abs(w - st.w) < 1) return;
        paint(host, st, st.pending);
      });
    });
    st.ro.observe(host);
  }

  function render(container, motion, result, opts) {
    if (!container) return null;
    css();
    var st = container.__bpChain || (container.__bpChain = {});
    st.args = [motion || {}, result || null, Object.assign({}, opts || {})];
    clearTimeout(st.fontT);
    if (hosts.indexOf(container) < 0) hosts.push(container);
    var out = paint(container, st, !!(opts && opts.animate));
    observe(container, st);
    return out;
  }

  /* ---------- public: compare (Try 1 / Try 2) ---------- */
  function compare(container, motion, resultA, resultB, opts) {
    if (!container) return null;
    css();
    opts = opts || {};
    Array.prototype.forEach.call(container.querySelectorAll('.bp-compare-chart'), function (el) {
      if (el.__bpChain && el.__bpChain.ro) el.__bpChain.ro.disconnect();
    });
    container.textContent = '';
    var wrapEl = document.createElement('div');
    wrapEl.className = 'bp-compare';
    var grid = document.createElement('div');
    grid.className = 'bp-compare-grid';
    wrapEl.appendChild(grid);
    container.appendChild(wrapEl);
    var boxes = [opts.labelA || 'Try 1', opts.labelB || 'Try 2'].map(function (label) {
      var cell = document.createElement('div');
      cell.className = 'bp-compare-cell';
      var h = document.createElement('p');
      h.className = 'bp-compare-head';
      h.textContent = label;
      var box = document.createElement('div');
      box.className = 'bp-compare-chart';
      cell.appendChild(h); cell.appendChild(box); grid.appendChild(cell);
      return box;
    });
    var mA = buildModel(motion || {}, resultA || null, { mode: opts.mode });
    var fixedFrom = mA.brk.live ? { rowIndex: mA.brk.row.index, link: mA.brk.node ? mA.brk.node.link : null, type: mA.brk.type } : null;
    render(boxes[0], motion, resultA, { mini: true, animate: false, mode: opts.mode });
    var b = render(boxes[1], motion, resultB, { mini: true, animate: opts.animate !== false, mode: opts.mode, fixedFrom: fixedFrom });
    return { done: b ? b.done : Promise.resolve() };
  }

  /* Re-lay out once web fonts arrive (after any running animation), so wrapping uses real widths. */
  if (document.fonts && document.fonts.addEventListener) {
    document.fonts.addEventListener('loadingdone', function () {
      hosts = hosts.filter(function (h) { return h.isConnected; });
      hosts.forEach(function (h) {
        var st = h.__bpChain;
        if (!st || !st.args) return;
        clearTimeout(st.fontT);
        st.fontT = setTimeout(function () { if (h.isConnected) paint(h, st, false); },
          Math.max(0, (st.animEnd || 0) - Date.now()) + 30);
      });
    });
  }

  window.Chain = { render: render, compare: compare, version: '1.0' };
})();
