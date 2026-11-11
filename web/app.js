/* Breakpoint UI controller (owner: ui). Vanilla JS, Chrome only, no build step.
   Talks to /api (CONTRACT.md). Uses window.Chain (chain.js), window.BodyTrack (body.js) and
   window.Speech (speech.js) when present; every call is guarded so the page works without them. */
(function () {
  'use strict';

  // ---------------------------------------------------------------- exact strings (copy.md)
  const T = {
    eyebrow: "Today's motion",
    youArgue: (s) => 'You argue: ' + s,
    theirArgument: 'Their argument',
    theirAttack: 'Their attack',
    modeAttack: 'Attack their argument',
    modeDefend: 'Defend your point',
    helperAttack: 'They make their case. You take it apart.',
    helperDefend: 'They attack your point. You hold it.',
    prep: '30 seconds to think. 60 to take it apart.',
    startAttack: 'Start 60s rebuttal',
    startDefend: 'Start defence',
    newMotion: 'New motion',
    recorded: 'Recorded run',
    point: (n) => 'Point ' + n,
    listening: 'Listening…',
    micHint: 'Speak toward the laptop.',
    camLoading: 'Getting the camera ready…',
    camBlocked: "Camera is off. You can still practise; we'll skip the delivery notes.",
    camBlockedBtn: 'Practise without camera',
    micBlocked: "We can't hear you. Allow the microphone, or type your rebuttal.",
    typeInstead: 'Type instead',
    noWords: "We didn't catch any words. Try again a little louder.",
    titleBroke: "Here's where it broke",
    titleHolds: 'It holds.',
    holds: 'Holds',
    breaks: 'Breaks',
    hintTitle: 'One question before you try again',
    tryAgain: 'Try again',
    seeHeard: 'See what the judge heard',
    delivery: 'Your delivery',
    footer: (model, cost) => 'Judged by ' + model + ' on GMI · ' + cost,
    slow: 'The judge is thinking a bit longer…',
    judgeError: "The judge couldn't answer this time.",
    useRecorded: 'Use the recorded example',
    lowConf: 'Not sure about this one. Check with your coach.',
    secondTitle: 'Second try',
    fixed: (n) => 'Fixed in ' + n + ' tries.',
    closer: 'Closer. One more try?',
    showModel: 'Show a model answer',
    compareHelper: 'Compare it with yours.',
    faceChange: (a, b) => 'Face touches: ' + a + ' → ' + b,
    nextMotion: 'Next motion',
    coachTitle: 'Your class this week',
    sample: 'SAMPLE',
    mostCommon: 'Most common break',
    review: 'Needs your review',
    reviewHelper: "The AI asks you when it isn't sure.",
    agree: 'Agree',
    disagree: 'Disagree',
    // Homework (copy.md "Homework link", "Student entry", "Coach view")
    hwCreate: 'Create homework link',
    hwMotion: 'Motion',
    hwMode: 'Mode',
    hwHelper: "Students don't need an account.",
    hwCopy: 'Copy link',
    hwCopied: 'Copied. Paste it into LINE, Google Classroom or Canvas.',
    hwEyebrow: 'Homework from your coach',
    hwName: 'First name only',
    hwNamePh: 'e.g. Amy',
    hwNameHelper: 'Your coach sees your first name and how your tries went.',
    hwStart: 'Start',
    hwDone: 'Done. Your coach can see your tries.',
    hwHeader: (motion, n) => 'Homework · ' + motion + ' · ' + n + (n === 1 ? ' student did it' : ' students did it'),
    hwFirstBreak: (label, count) => 'Most common first break: ' + label + ' (' + count + ')',
    hwHeld: 'Held first time',
    hwFixed: 'Fixed',
    hwTries: (n) => n + (n === 1 ? ' try' : ' tries'),
    // Not in copy.md: short structural labels (flagged to design in the hand-off).
    hwLinkLabel: 'Homework link',
    hwBadLink: "This homework link doesn't work. Ask your coach for a new one.",
    hwNone: 'No homework links yet.',
    hwLinkError: "The link couldn't be made this time.",
    yourPoint: 'Your point',
    theChallenge: 'The challenge',
    checking: 'Checking every link…',
    attempt: (n) => 'Attempt ' + n,
    oneWay: 'One way to say it',
    heardTitle: 'What the judge heard',
    classList: 'Class',
    colStudent: 'Student',
    colBreak: 'Last break',
    colTries: 'Tries',
    aiSaid: 'The AI said',
    reviewEmpty: 'Nothing to check right now.',
    saved: (v) => (v === 'agree' ? 'You agreed.' : 'You disagreed.'),
    classError: "The class list couldn't load."
  };

  // Delivery lines (copy.md, "Delivery lines"); never label the child.
  const DELIVERY = {
    slouch: (t) => 'Shoulders came forward at ' + t + '. Sit tall: it can help you feel calmer and more confident.',
    face: (n) => 'Hands near your face ' + (n === 1 ? 'once' : n + ' times') + '. They pull attention from your words.',
    sway: (t) => 'Swaying at ' + t + '. Plant your feet and let your words do the moving.',
    hard: 'You probably did better than it felt.'
  };
  const MARK_LABEL = { slouch: 'Shoulders forward', face_touch: 'Hand near face', sway: 'Swaying' };

  // Break copy by type. The four copy.md labels are used as written; other types fall back to CONTRACT.md.
  const BREAK_COPY = {
    dropped_argument: {
      label: 'Dropped their second argument',
      why: 'You answered their first point. Their second point is still standing.',
      hint: 'Their second point is still standing. What happens to it if you say nothing?'
    },
    no_link: { label: 'No link', why: '', hint: '' },
    new_argument_while_defending: {
      label: 'Switched arguments while defending',
      why: 'They attacked your point, and you moved to a new one instead of answering it.',
      hint: 'What exactly did they say was wrong with your point?'
    },
    number_without_so_what: {
      label: 'A number with no "so what"',
      why: "You attacked their number but didn't say why it matters.",
      hint: "If that number were true, would it change the judge's decision? Why?"
    },
    missed_the_attack: { label: 'You answered a different point, not their attack' },
    missed_the_challenge: { label: 'Missed the challenge' },
    no_condition: { label: 'No condition or limit' },
    ignored_best_counterpoint: { label: 'Ignored their best point' },
    off_point: { label: 'Off point' },
    none: { label: 'Every link you attacked holds' }
  };
  const COPY_LABEL_TYPES = ['dropped_argument', 'no_link', 'new_argument_while_defending', 'number_without_so_what'];
  const LINKS = ['claim', 'reason', 'evidence', 'impact'];

  // Optional price table for the footer cost, US$ per million tokens: [{match:'deepseek', in:0, out:0}].
  // Empty on purpose: until a verified GMI price is filled in, the footer shows the token count.
  const PRICES = Array.isArray(window.BREAKPOINT_PRICES) ? window.BREAKPOINT_PRICES : [];

  // ---------------------------------------------------------------- SAMPLE data (synthetic)
  // The four SAMPLE transcripts, copied from samples/transcripts.json (not served by the server).
  const SAMPLE_TRANSCRIPTS = [
    {
      id: 'phones-attack-dropped', label: 'SAMPLE: attacks only their first point', motion_id: 'phones', mode: 'attack', attempt: 1, expected_break: 'dropped_argument',
      transcript: "I disagree with the ban. They say phones make students learn less because notifications pull attention away. But the problem is the notifications, not the phone. A teacher can ask everyone to switch on focus mode, and then nothing buzzes in the lesson. Also phones help us look things up when we don't understand a word, so learning can be faster with a phone. So a full ban goes too far."
    },
    {
      id: 'phones-attack-fixed', label: 'SAMPLE: second try, answers both points', motion_id: 'phones', mode: 'attack', attempt: 2, expected_break: 'none',
      transcript: 'I disagree with the ban. Their first point is that notifications pull attention away. But the problem is the notifications, not the phone, because focus mode stops every buzz during the lesson. Their second point is bullying. A ban in class does not stop the group chat, because the chat keeps running at lunch and after school. So the student who is targeted still sees every message. The ban moves the bullying out of sight, which makes it harder for teachers to notice and stop it.'
    },
    {
      id: 'phones-attack-nolink', label: 'SAMPLE: touches both points but gives no reasons', motion_id: 'phones', mode: 'attack', attempt: 1, expected_break: 'no_link',
      transcript: 'Their first point is wrong. Phones are not bad, everyone has a phone now. And bullying happens anyway. So we should not ban phones. Phones are the future.'
    },
    {
      id: 'phones-defend-switch', label: 'SAMPLE: defends by switching to a new argument', motion_id: 'phones', mode: 'defend', attempt: 1, expected_break: 'new_argument_while_defending',
      transcript: 'Okay but phones are really important for safety. If there is an emergency, parents need to call their kids. That is why we cannot ban phones.'
    }
  ];

  // SAMPLE delivery summaries for recorded runs (shown with the SAMPLE badge).
  // Same shape as BodyTrack.stop().
  const SAMPLE_BODY = {
    1: {
      marks: [
        { t: '0:18', sec: 18, type: 'face_touch', label: 'Hands near your face', n: 4, line: 'Hands near your face 4 times. They pull attention from your words.' },
        { t: '0:42', sec: 42, type: 'slouch', label: 'Shoulders forward', n: 1, line: 'Shoulders came forward at 0:42. Sit tall: it can help you feel calmer and more confident.' }
      ],
      counts: { face_touch: 4, sway: 0, slouch: 1 }, line: 'Hands near your face pull attention from your words.', tracked: true, coverage: 0.9
    },
    2: {
      marks: [{ t: '0:35', sec: 35, type: 'face_touch', label: 'Hands near your face', n: 1, line: 'Hands near your face once. They pull attention from your words.' }],
      counts: { face_touch: 1, sway: 0, slouch: 0 }, line: 'You probably did better than it felt.', tracked: true, coverage: 0.92
    }
  };

  function linksFor(map) { // map: {"A1.reason":"broken", ...} -> 8 link entries
    const out = [];
    ['A1', 'A2'].forEach((arg) => LINKS.forEach((link) => out.push({ arg: arg, link: link, status: map[arg + '.' + link] || 'untouched' })));
    return out;
  }

  // Last-resort replay results for the recorded run, used only when /api/analyze cannot answer.
  const LOCAL_REPLAY = {
    'phones-attack-dropped': {
      attempt: 1,
      attacks: [
        { arg: 'A1', link: 'reason', quote: 'the problem is the notifications, not the phone', holds: true },
        { arg: 'A1', link: 'claim', quote: "phones help us look things up when we don't understand a word", holds: true }
      ],
      links: linksFor({ 'A1.claim': 'broken', 'A1.reason': 'broken' }),
      break: { type: 'dropped_argument', arg: 'A2', link: 'claim', label: 'Dropped their second argument', why: 'You answered their first point. Their second point is still standing.' },
      hint: 'Their second point is still standing. What happens to it if you say nothing?',
      landed: 'Your attack landed on their first point: the notifications are the problem, not the phone.',
      confidence: 0.9, source: 'replay', model: null, tokens: { in: 0, out: 0 }, ms: 0, model_answer: null
    },
    'phones-attack-fixed': {
      attempt: 2,
      attacks: [
        { arg: 'A1', link: 'reason', quote: 'the problem is the notifications, not the phone, because focus mode stops every buzz', holds: true },
        { arg: 'A2', link: 'reason', quote: 'A ban in class does not stop the group chat, because the chat keeps running at lunch and after school', holds: true },
        { arg: 'A2', link: 'impact', quote: 'The ban moves the bullying out of sight, which makes it harder for teachers to notice and stop it', holds: true }
      ],
      links: linksFor({ 'A1.reason': 'broken', 'A2.reason': 'broken', 'A2.impact': 'broken' }),
      break: { type: 'none', arg: null, link: null, label: 'Every link you attacked holds', why: 'You answered both of their points, and each answer says why.' },
      hint: 'Which of your two answers would hurt their case most if the judge believed it?',
      landed: 'You answered both points, and each answer has a "because".',
      confidence: 0.88, source: 'replay', model: null, tokens: { in: 0, out: 0 }, ms: 0, model_answer: null
    },
    'phones-attack-nolink': {
      attempt: 1,
      attacks: [
        { arg: 'A1', link: 'claim', quote: 'Phones are not bad, everyone has a phone now', holds: false },
        { arg: 'A2', link: 'claim', quote: 'bullying happens anyway', holds: false }
      ],
      links: linksFor({ 'A1.claim': 'attacked', 'A2.claim': 'attacked' }),
      break: { type: 'no_link', arg: 'A1', link: 'claim', label: 'No link', why: 'You said "everyone has a phone now", but never showed why that leads to students learning more.' },
      hint: "What would have to be true for 'everyone has a phone' to lead to better learning?",
      landed: 'You answered both of their points, not just the first.',
      confidence: 0.8, source: 'replay', model: null, tokens: { in: 0, out: 0 }, ms: 0, model_answer: null
    },
    'phones-defend-switch': {
      attempt: 1,
      attacks: [],
      links: [],
      break: { type: 'new_argument_while_defending', arg: null, link: null, label: 'Switched arguments while defending', why: 'They attacked your point, and you moved to a new one instead of answering it.' },
      hint: 'What exactly did they say was wrong with your point?',
      landed: 'You gave a clear reason: parents need to reach their kids in an emergency.',
      confidence: 0.85, source: 'replay', model: null, tokens: { in: 0, out: 0 }, ms: 0, model_answer: null
    }
  };

  // Used only if /api/motions is not ready (engine still being built).
  const FALLBACK_MOTIONS = [{
    id: 'phones',
    motion: 'This house would ban phones in middle-school classrooms.',
    side: 'CON',
    opponent: {
      args: [
        { id: 'A1', claim: 'Phones in class make students learn less', reason: 'Notifications pull attention away from the lesson', evidence: '', impact: 'Every lesson loses minutes of focus' },
        { id: 'A2', claim: 'Phones bring bullying into the classroom', reason: 'Group chats keep running during school', evidence: '', impact: "Students who are targeted can't escape it, even in class" }
      ]
    },
    attack_on_you: {
      target: 'Phones help students learn: they can look things up the moment they get stuck.',
      attack: "Students don't look things up. The moment the teacher turns around, they open games and group chats."
    }
  }];

  // SAMPLE review items for the coach view when the real queue is empty (never real students).
  const SAMPLE_REVIEW = [
    { id: 'sample-review-1', name: 'SAMPLE Student B', sample: true, transcript: SAMPLE_TRANSCRIPTS[2].transcript, result: { break: { type: 'no_link', label: 'No link' }, confidence: 0.52 } },
    { id: 'sample-review-2', name: 'SAMPLE Student D', sample: true, transcript: SAMPLE_TRANSCRIPTS[3].transcript, result: { break: { type: 'new_argument_while_defending', label: 'Switched arguments while defending' }, confidence: 0.47 } }
  ];

  // ---------------------------------------------------------------- state
  const state = {
    motions: [],
    motionId: 'phones',
    mode: 'attack',
    attempts: [],      // [{result, transcript, body, sampleBody, recorded, sampleId, mode, motionId}]
    pending: null,     // attempt being judged: {transcript, body, recorded, sampleId, attempt, slow, failed}
    live: null,        // live session
    pickerOpen: false,
    screen: null,
    health: null,
    reviewed: {},
    assignment: null,  // homework link opened at /a/<id>: {id, data, error}
    student: '',       // first name typed on a homework link
    hw: { motionId: null, mode: 'attack', link: null, busy: false, error: '' }
  };
  let coachToken = 0;

  // ---------------------------------------------------------------- helpers
  const $ = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));

  function h(tag, props) {
    const el = document.createElement(tag);
    if (props) {
      Object.keys(props).forEach((k) => {
        const v = props[k];
        if (v == null || v === false) return;
        if (k === 'class') el.className = v;
        else if (k === 'style' && typeof v === 'object') Object.keys(v).forEach((p) => el.style.setProperty(p, v[p]));
        else if (k.slice(0, 2) === 'on' && typeof v === 'function') el.addEventListener(k.slice(2), v);
        else if (v === true) el.setAttribute(k, '');
        else el.setAttribute(k, String(v));
      });
    }
    add(el, Array.prototype.slice.call(arguments, 2));
    return el;
  }
  function add(el, kids) {
    (Array.isArray(kids) ? kids : [kids]).flat(Infinity).forEach((k) => {
      if (k == null || k === false || k === '') return;
      el.append(k instanceof Node ? k : document.createTextNode(String(k)));
    });
    return el;
  }
  function clone(o) { return o == null ? o : JSON.parse(JSON.stringify(o)); }
  function hasText(s) { return typeof s === 'string' && s.trim().length > 0; }
  function clamp(n, a, b) { return Math.max(a, Math.min(b, n)); }
  function fmtTime(sec) { sec = Math.max(0, Math.floor(sec)); return Math.floor(sec / 60) + ':' + String(sec % 60).padStart(2, '0'); }
  function parseTime(t) {
    if (typeof t === 'number') return t;
    const m = String(t || '').match(/^(\d+):(\d{1,2})$/);
    return m ? Number(m[1]) * 60 + Number(m[2]) : Number(t) || 0;
  }
  function reducedMotion() { return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches; }
  function announce(text) { const a = $('#announcer'); if (a) { a.textContent = ''; setTimeout(() => { a.textContent = text; }, 30); } }
  function withTimeout(p, ms) {
    return new Promise((resolve, reject) => {
      const t = setTimeout(() => reject(new Error('timeout')), ms);
      Promise.resolve(p).then((v) => { clearTimeout(t); resolve(v); }, (e) => { clearTimeout(t); reject(e); });
    });
  }
  function getChain() { try { return window.Chain || (typeof Chain !== 'undefined' ? Chain : null); } catch (e) { return null; } } // eslint-disable-line no-undef
  function getBody() { try { return window.BodyTrack || (typeof BodyTrack !== 'undefined' ? BodyTrack : null); } catch (e) { return null; } } // eslint-disable-line no-undef

  async function request(url, opts, ms) {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), ms || 8000);
    try {
      const res = await fetch(url, Object.assign({ signal: ctl.signal, headers: { Accept: 'application/json', 'Content-Type': 'application/json' } }, opts || {}));
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        const e = new Error((data && data.error) || ('HTTP ' + res.status));
        e.status = res.status;
        throw e;
      }
      return data;
    } finally { clearTimeout(timer); }
  }
  const getJSON = (url, ms) => request(url, { method: 'GET' }, ms);
  const postJSON = (url, body, ms) => request(url, { method: 'POST', body: JSON.stringify(body) }, ms);

  // ---------------------------------------------------------------- motions and modes
  function argsOf(m) { return (m && m.opponent && Array.isArray(m.opponent.args)) ? m.opponent.args : []; }
  function motionById(id) { return state.motions.find((m) => m.id === id) || null; }
  function currentMotion() { return motionById(state.motionId) || state.motions[0] || null; }
  function sideLabel(side) {
    const s = String(side || '').toUpperCase();
    if (['CON', 'AGAINST', 'OPP', 'OPPOSITION', 'NEG'].indexOf(s) >= 0) return 'Against';
    if (['PRO', 'FOR', 'PROP', 'PROPOSITION', 'GOV', 'AFF'].indexOf(s) >= 0) return 'For';
    return side ? String(side) : 'Against';
  }
  function textOf(v) {
    if (typeof v === 'string') return v;
    if (v && typeof v === 'object') return v.text || v.claim || v.question || v.attack || '';
    return '';
  }
  function attackOn(m) {
    const a = (m && m.attack_on_you) || null;
    if (!a) return null;
    return { target: a.target, targetText: textOf(a.target), attack: textOf(a.attack) };
  }
  function availableModes(m) {
    const out = [];
    if (argsOf(m).length) out.push('attack');
    const a = attackOn(m);
    if (a && (a.attack || a.targetText)) out.push('defend');
    if (!out.length && (m && (m.challenge || m.preset === 'challenge' || m.mode === 'challenge'))) out.push('challenge');
    if (!out.length) out.push('attack');
    return out;
  }
  function ensureMode() {
    const m = currentMotion();
    const modes = availableModes(m);
    if (modes.indexOf(state.mode) < 0) state.mode = modes[0];
  }

  // ---------------------------------------------------------------- break wording
  function breakType(r) { return (r && r.break && r.break.type) || 'none'; }
  function isUnsure(r) { return r && typeof r.confidence === 'number' && r.confidence < 0.6; }
  function breakLabel(brk, mode) {
    const type = (brk && brk.type) || 'none';
    const engine = brk && hasText(brk.label) ? brk.label.trim() : '';
    if (type === 'none') return engine || (mode === 'defend' ? 'Your defence answered their attack' : BREAK_COPY.none.label);
    if (COPY_LABEL_TYPES.indexOf(type) >= 0) {
      const c = BREAK_COPY[type].label;
      // keep the engine's longer "No link: X does not prove Y"; otherwise the copy.md label as written
      return (engine && engine.toLowerCase().indexOf(c.toLowerCase()) === 0) ? engine : c;
    }
    return engine || (BREAK_COPY[type] && BREAK_COPY[type].label) || type.replace(/_/g, ' ');
  }
  function breakWhy(brk) {
    const type = (brk && brk.type) || 'none';
    if (brk && hasText(brk.why)) return brk.why.trim();
    return (BREAK_COPY[type] && BREAK_COPY[type].why) || '';
  }
  function shortLabel(type) { return (BREAK_COPY[type] && BREAK_COPY[type].label) || String(type || '').replace(/_/g, ' '); }

  function shortModel(model) { return String(model).split('/').pop(); }
  function costText(r) {
    if (typeof r.cost_usd === 'number') return '~$' + fmtUsd(r.cost_usd);
    const tin = Number(r.tokens && r.tokens.in) || 0;
    const tout = Number(r.tokens && r.tokens.out) || 0;
    const model = String(r.model || '').toLowerCase();
    const price = PRICES.find((p) => p && p.match && model.indexOf(String(p.match).toLowerCase()) >= 0);
    if (price && (tin || tout)) return '~$' + fmtUsd((tin * price.in + tout * price.out) / 1e6);
    if (tin || tout) return '~' + (tin + tout).toLocaleString('en-US') + ' tokens';
    return '~';
  }
  function fmtUsd(v) { return v < 0.01 ? v.toFixed(4) : v.toFixed(3); }
  function footerText(r) {
    if (!r || r.source === 'replay') return T.recorded;
    const model = r.model || (state.health && state.health.model) || 'the judge';
    return T.footer(shortModel(model), costText(r));
  }

  // ---------------------------------------------------------------- routing
  function parseHash() {
    const raw = location.hash.replace(/^#\/?/, '');
    const i = raw.indexOf('?');
    const name = (i >= 0 ? raw.slice(0, i) : raw) || 'motion';
    const params = new URLSearchParams(i >= 0 ? raw.slice(i + 1) : '');
    return { name: name, params: params };
  }
  function motionHash() { return '#motion?' + new URLSearchParams({ m: state.motionId, mode: state.mode }).toString(); }
  function go(name, opts) {
    const target = name === 'motion' ? motionHash() : '#' + name;
    if (location.hash === target) { route(); return; }
    if (opts && opts.replace) { history.replaceState(null, '', target); route(); }
    else location.hash = target;
  }
  function syncMotionHash() { if (state.screen === 'motion') history.replaceState(null, '', motionHash()); }

  function route() {
    const r = parseHash();
    if (r.name !== 'live' && state.live) abortLive();
    if (r.name === 'coach') { show('coach'); renderCoach(); return; }
    if (r.name === 'live') {
      if (!state.live) { go('motion', { replace: true }); return; }
      show('live');
      if (!state.live.begun) beginLive(state.live);
      return;
    }
    if (r.name === 'report') {
      if (!state.pending && !state.attempts.length) { go('motion', { replace: true }); return; }
      show('report'); renderReport(); return;
    }
    if (r.name === 'second') {
      if (state.attempts.length < 2) { go(state.attempts.length ? 'report' : 'motion', { replace: true }); return; }
      show('second'); renderSecond(); return;
    }
    // motion card
    const m = r.params.get('m');
    const mode = r.params.get('mode');
    if (!state.assignment) { // a homework link fixes the motion and mode
      if (m && motionById(m) && m !== state.motionId) { state.motionId = m; state.attempts = []; }
      if (mode && mode !== state.mode && ['attack', 'defend', 'challenge'].indexOf(mode) >= 0) { state.mode = mode; state.attempts = []; }
    }
    ensureMode();
    show('motion');
    renderMotion();
    if (location.hash !== motionHash() && state.motions.length) history.replaceState(null, '', motionHash());
  }

  function show(name) {
    const prev = state.screen;
    state.screen = name;
    $$('.screen').forEach((s) => {
      const on = s.getAttribute('data-screen') === name;
      s.hidden = !on;
      if (on && prev !== name) {
        s.classList.remove('is-entering');
        void s.offsetWidth; // restart the enter animation
        s.classList.add('is-entering');
      }
    });
    $$('.topnav a').forEach((a) => {
      const coach = a.getAttribute('data-nav') === 'coach';
      if (coach === (name === 'coach')) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
    });
    document.title = name === 'coach' ? 'Breakpoint · Coach view' : 'Breakpoint';
    if (prev !== name) {
      window.scrollTo(0, 0);
      const main = $('#main');
      if (main && name !== 'live') main.focus({ preventScroll: true });
    }
  }

  // ---------------------------------------------------------------- 1. motion card
  function renderMotion() {
    const root = $('#screen-motion');
    root.textContent = '';
    const loadingHw = state.assignment && !state.assignment.data && !state.assignment.error;
    if (!state.motions.length || loadingHw) {
      root.append(h('div', { class: 'skeleton', 'aria-busy': 'true' },
        h('div', { class: 'skel', style: { 'max-width': '160px' } }), h('div', { class: 'skel lg' }),
        h('div', { class: 'points' }, h('div', { class: 'skel card-skel' }), h('div', { class: 'skel card-skel' }))));
      return;
    }
    const hwk = state.assignment;
    if (hwk && hwk.error) {
      root.append(h('div', { class: 'state-panel', role: 'alert' }, h('p', { class: 'eyebrow' }, T.hwEyebrow), h('h1', null, T.hwBadLink)));
      return;
    }
    const m = currentMotion();
    const modes = availableModes(m);
    const mode = state.mode;
    const pairModes = !hwk && modes.indexOf('attack') >= 0 && modes.indexOf('defend') >= 0;

    const toggle = pairModes ? h('div', { class: 'mode' },
      h('div', { class: 'mode-toggle', role: 'group', 'aria-label': 'Exchange' },
        h('button', { type: 'button', 'aria-pressed': String(mode === 'attack'), onclick: () => setMode('attack') }, T.modeAttack),
        h('button', { type: 'button', 'aria-pressed': String(mode === 'defend'), onclick: () => setMode('defend') }, T.modeDefend)),
      h('p', { class: 'helper' }, mode === 'defend' ? T.helperDefend : T.helperAttack)) : null;

    let block;
    let chainHost = null;
    const C = getChain();
    if (C && typeof C.render === 'function' && mode !== 'challenge') {
      // chain.js draws the plain opponent chain (result null); the cards below are the fallback
      chainHost = h('div', { class: 'mc-chain' });
      // in defend mode chain.js labels its own row "Their attack", so the section label would repeat it
      block = h('section', { class: 'mc-block', 'aria-label': mode === 'defend' ? T.theirAttack : T.theirArgument },
        mode === 'defend' ? null : h('h2', { class: 'eyebrow' }, T.theirArgument), chainHost);
    } else if (mode === 'defend') block = defendBlock(m);
    else if (mode === 'challenge') block = challengeBlock(m);
    else block = attackBlock(m);

    let actions;
    if (hwk && !state.student) {
      // homework link: ask for a first name once, then start that motion and mode
      const input = h('input', { id: 'hw-name', type: 'text', name: 'given-name', autocomplete: 'given-name', maxlength: '30', placeholder: T.hwNamePh, required: true, 'aria-describedby': 'hw-name-help' });
      actions = h('form', {
        class: 'hw-join', novalidate: true,
        onsubmit: (e) => {
          e.preventDefault();
          const name = input.value.trim().split(/\s+/)[0] || '';
          if (!name) { input.focus(); input.setAttribute('aria-invalid', 'true'); return; }
          state.student = name.slice(0, 30);
          try { localStorage.setItem('bp-student-' + hwk.id, state.student); } catch (err) { /* private window */ }
          startLive();
        }
      },
        h('label', { for: 'hw-name', class: 'field-label' }, T.hwName),
        h('div', { class: 'hw-join-row' }, input, h('button', { type: 'submit', class: 'btn btn-primary btn-lg' }, T.hwStart)),
        h('p', { class: 'helper', id: 'hw-name-help' }, T.hwNameHelper));
    } else {
      actions = h('div', { class: 'mc-actions' },
        h('button', { type: 'button', class: 'btn btn-primary btn-lg', id: 'btn-start', onclick: () => startLive() }, mode === 'defend' ? T.startDefend : T.startAttack),
        hwk ? null : h('button', { type: 'button', class: 'btn btn-secondary', onclick: startRecorded }, T.recorded),
        (!hwk && state.motions.length > 1) ? h('button', { type: 'button', class: 'btn btn-text', id: 'btn-new-motion', 'aria-expanded': String(state.pickerOpen), 'aria-controls': 'motion-picker', onclick: togglePicker }, T.newMotion) : null,
        mode === 'attack' ? h('p', { class: 'helper' }, T.prep) : null);
    }

    const picker = (state.pickerOpen && !hwk) ? h('div', { class: 'picker', id: 'motion-picker' },
      state.motions.map((mm) => h('button', { type: 'button', 'aria-pressed': String(mm.id === m.id), onclick: () => pickMotion(mm.id) },
        h('span', { class: 'tag' }, sideLabel(mm.side)), h('span', null, mm.motion)))) : null;

    root.append(h('div', { class: 'mc' },
      h('div', { class: 'mc-head' },
        h('p', { class: 'eyebrow' }, hwk ? T.hwEyebrow : T.eyebrow),
        h('h1', { class: 'mc-motion', id: 'motion-title' }, m.motion),
        h('div', { class: 'mc-meta' }, h('span', { class: 'chip chip-side' }, T.youArgue(sideLabel(m.side))))),
      toggle, block, actions, picker));
    if (chainHost) {
      try { C.render(chainHost, m, null, { animate: !reducedMotion(), mode: mode }); } catch (e) {
        console.warn('Chain.render (motion card) failed, using cards:', e);
        block.replaceWith(mode === 'defend' ? defendBlock(m) : attackBlock(m));
      }
    }
  }

  function chainRows(obj) {
    return h('ol', { class: 'chainlist' }, LINKS.filter((k) => k !== 'evidence' || hasText(obj.evidence)).filter((k) => hasText(obj[k])).map((k) =>
      h('li', null, h('span', { class: 'tag' }, k.toUpperCase()), h('span', { class: 'ctext' }, obj[k]))));
  }
  function attackBlock(m) {
    const args = argsOf(m);
    return h('section', { class: 'mc-block', 'aria-labelledby': 'their-arg' },
      h('h2', { class: 'eyebrow', id: 'their-arg' }, T.theirArgument),
      h('div', { class: 'points' + (args.length === 1 ? ' is-single' : '') }, args.map((a, i) =>
        h('article', { class: 'card point-card', 'aria-label': T.point(i + 1) },
          h('div', { class: 'point-card-head' }, h('span', { class: 'eyebrow' }, T.point(i + 1))),
          chainRows(a)))));
  }
  function defendBlock(m) {
    const a = attackOn(m) || {};
    const target = (a.target && typeof a.target === 'object' && a.target.claim) ? chainRows(a.target) : h('p', { class: 'attack-text' }, a.targetText);
    return h('div', { class: 'points' },
      h('article', { class: 'card point-card' }, h('div', { class: 'point-card-head' }, h('h2', { class: 'eyebrow' }, T.yourPoint)), target),
      h('article', { class: 'card point-card' }, h('div', { class: 'point-card-head' }, h('h2', { class: 'eyebrow' }, T.theirAttack)), h('p', { class: 'attack-text' }, a.attack)));
  }
  function challengeBlock(m) {
    const q = textOf(m.challenge) || textOf(m.question);
    return h('div', { class: 'points is-single' },
      h('article', { class: 'card point-card' }, h('div', { class: 'point-card-head' }, h('h2', { class: 'eyebrow' }, T.theChallenge)),
        hasText(m.claim) ? h('p', { class: 'muted' }, m.claim) : null,
        h('p', { class: 'attack-text' }, q)));
  }

  function setMode(mode) {
    if (mode === state.mode) return;
    state.mode = mode;
    state.attempts = [];
    syncMotionHash();
    renderMotion();
    const b = $('.mode-toggle button[aria-pressed="true"]');
    if (b) b.focus({ preventScroll: true });
  }
  function togglePicker() {
    state.pickerOpen = !state.pickerOpen;
    renderMotion();
    const b = $('#btn-new-motion');
    if (b) b.focus({ preventScroll: true });
    const p = $('#motion-picker');
    if (p) p.scrollIntoView({ block: 'nearest', behavior: reducedMotion() ? 'auto' : 'smooth' });
  }
  function pickMotion(id) {
    state.pickerOpen = false;
    if (id !== state.motionId) { state.motionId = id; state.attempts = []; ensureMode(); }
    syncMotionHash();
    renderMotion();
    const t = $('#btn-start');
    if (t) t.focus({ preventScroll: true });
  }
  function nextMotion() {
    const i = state.motions.findIndex((m) => m.id === state.motionId);
    const next = state.motions[(i + 1) % state.motions.length] || state.motions[0];
    state.motionId = next.id;
    state.attempts = [];
    state.pending = null;
    state.pickerOpen = false;
    ensureMode();
    go('motion');
  }

  // ---------------------------------------------------------------- 2. live
  function startLive() {
    if (!currentMotion()) return;
    if (state.live) abortLive();
    state.pending = null;
    state.live = {
      begun: false, running: false, ended: false, typed: false,
      camOk: false, bodyOk: false, bodyStarted: false, stream: null,
      startedAt: 0, timer: null, speechText: '', body: null,
      attempt: state.attempts.length + 1
    };
    go('live');
  }

  function setStatus(text, idle) {
    $('#live-status-text').textContent = text || '';
    $('.live').classList.toggle('is-idle', !!idle);
  }
  function liveMsg(text, actions) {
    const box = $('#live-msg');
    if (!text) { box.hidden = true; return; }
    $('#live-msg-text').textContent = text;
    const acts = $('#live-msg-actions');
    acts.textContent = '';
    (actions || []).forEach((a) => acts.append(h('button', { type: 'button', class: 'btn ' + (a.primary ? 'btn-primary' : 'btn-secondary'), onclick: a.onclick }, a.label)));
    box.hidden = false;
  }

  function resetLiveUI(L) {
    $('#live-elapsed').textContent = '0:00';
    setStatus(T.camLoading, true);
    const tr = $('#transcript');
    tr.textContent = '';
    tr.classList.add('is-empty');
    tr.hidden = false;
    $('#typebox').hidden = true;
    $('#type-input').value = '';
    $('#btn-type').hidden = false;
    $('#btn-done').disabled = false;
    liveMsg(null);
    $('#mic-hint').hidden = true;
    const dots = $('#body-dots');
    dots.hidden = true;
    $$('#body-dots li').forEach((li) => li.classList.remove('is-on'));
    const cam = $('#cam');
    cam.hidden = false;
    cam.classList.remove('is-off');
    $('#cam-state').hidden = false;
    $('#cam-state-text').textContent = T.camLoading;
    $('#cam-state-btn').hidden = true;
    const badges = $('#live-badges');
    badges.textContent = '';
    if (L.attempt > 1) badges.append(h('span', { class: 'badge' }, T.secondTitle));
    renderLivePoints();
  }

  function renderLivePoints() {
    const el = $('#live-points');
    el.textContent = '';
    const m = currentMotion();
    if (!m) return;
    if (state.mode === 'defend') {
      const a = attackOn(m);
      if (a && a.attack) add(el, [T.theirAttack + ': ', h('b', null, a.attack)]);
      return;
    }
    if (state.mode === 'challenge') { add(el, [T.theChallenge + ': ', h('b', null, textOf(m.challenge))]); return; }
    argsOf(m).forEach((a, i) => { if (i) el.append(' · '); add(el, [T.point(i + 1) + ': ', h('b', null, a.claim)]); });
  }

  async function beginLive(L) {
    L.begun = true;
    resetLiveUI(L);
    const camOk = await startCamera(L);
    if (L !== state.live) return;
    if (!camOk) {
      $('#cam-state-text').textContent = T.camBlocked;
      const btn = $('#cam-state-btn');
      btn.textContent = T.camBlockedBtn;
      btn.hidden = false;
      btn.onclick = () => { $('#cam').hidden = true; runLive(L); };
      setStatus('', true);
      btn.focus({ preventScroll: true });
      return;
    }
    $('#cam-state').hidden = true;
    await initBody(L);
    if (L !== state.live) return;
    runLive(L);
  }

  async function startCamera(L) {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return false;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' }, audio: false });
      if (L !== state.live) { stream.getTracks().forEach((t) => t.stop()); return false; }
      L.stream = stream;
      const v = $('#cam-video');
      v.srcObject = stream;
      try { await v.play(); } catch (e) { /* autoplay is muted; ignore */ }
      if (v.readyState < 2) {
        await withTimeout(new Promise((res) => v.addEventListener('loadeddata', res, { once: true })), 4000).catch(() => {});
      }
      L.camOk = true;
      return true;
    } catch (e) {
      console.warn('camera unavailable:', e && e.name);
      return false;
    }
  }

  async function initBody(L) {
    const BT = getBody();
    if (!BT || typeof BT.init !== 'function' || !L.camOk) return;
    try {
      const r = await withTimeout(BT.init($('#cam-video')), 8000);
      L.bodyOk = !!(r && r.ok);
    } catch (e) {
      console.warn('body tracking off:', e && e.message);
      L.bodyOk = false;
    }
    if (!L.bodyOk || L !== state.live) return;
    $('#body-dots').hidden = false;
    if (typeof BT.onStatus === 'function') {
      try {
        BT.onStatus((st) => {
          if (state.live !== L || !st) return;
          ['posture', 'hands', 'facing'].forEach((k) => {
            const li = $('#body-dots li[data-k="' + k + '"]');
            if (li) li.classList.toggle('is-on', st[k] === 'ok'); // shows tracking only, never a judgement colour
          });
        });
      } catch (e) { /* optional */ }
    }
  }

  function runLive(L) {
    if (L !== state.live || L.running || L.ended) return;
    L.running = true;
    L.startedAt = performance.now();
    setStatus(L.typed ? '' : T.listening, !!L.typed);
    if (L.camOk && !$('#cam').hidden) {
      const hint = $('#mic-hint');
      hint.hidden = false;
      setTimeout(() => { hint.hidden = true; }, 3000);
    }
    const BT = getBody();
    if (L.bodyOk && BT && typeof BT.start === 'function') {
      try { BT.start(); L.bodyStarted = true; } catch (e) { L.bodyOk = false; $('#body-dots').hidden = true; }
    }
    if (!L.typed) {
      const S = window.Speech;
      const ok = S && S.supported && S.start((text, info) => onSpeechText(L, text, info), (st) => onSpeechState(L, st));
      if (!ok) onSpeechState(L, { type: 'unsupported' });
    }
    L.timer = setInterval(() => tick(L), 200);
    tick(L);
    if (!L.typed) $('#btn-done').focus({ preventScroll: true });
  }

  function tick(L) {
    if (L !== state.live || !L.running) return;
    const sec = (performance.now() - L.startedAt) / 1000;
    $('#live-elapsed').textContent = fmtTime(Math.min(sec, 60));
    if (sec >= 60 && !L.typed) finishLive(L);
  }

  function onSpeechText(L, text, info) {
    if (L !== state.live) return;
    L.speechText = text;
    const tr = $('#transcript');
    const segs = (info && info.segments) || [];
    tr.textContent = '';
    tr.classList.toggle('is-empty', !segs.length);
    segs.slice(-4).forEach((s, i, arr) => {
      tr.append(h('span', { class: 'line' + (i === arr.length - 1 ? ' is-last' : '') + (s.final ? '' : ' is-interim') }, s.text));
    });
    if (text) { const box = $('#live-msg'); if (!box.hidden && box.getAttribute('data-kind') === 'no-speech') liveMsg(null); }
  }

  function onSpeechState(L, st) {
    if (L !== state.live || L.typed || !st) return;
    const box = $('#live-msg');
    if (st.type === 'listening') { setStatus(T.listening, false); return; }
    if (st.type === 'hearing') { if (box.getAttribute('data-kind') === 'no-speech') liveMsg(null); return; }
    if (st.type === 'no-speech') {
      liveMsg(T.noWords, [{ label: T.typeInstead, onclick: () => switchToTyping(L) }]);
      box.setAttribute('data-kind', 'no-speech');
      return;
    }
    // mic blocked, unsupported, network or other errors: offer typing
    liveMsg(T.micBlocked, [{ label: T.typeInstead, primary: true, onclick: () => switchToTyping(L) }]);
    box.setAttribute('data-kind', 'mic');
    setStatus('', true);
  }

  function switchToTyping(L) {
    L = L || state.live;
    if (!L || L.ended) return;
    L.typed = true;
    let sofar = L.speechText || '';
    if (window.Speech) { try { sofar = window.Speech.stop() || sofar; } catch (e) { /* ignore */ } }
    const ta = $('#type-input');
    if (!ta.value) ta.value = sofar;
    $('#typebox').hidden = false;
    $('#transcript').hidden = true;
    $('#btn-type').hidden = true;
    liveMsg(null);
    if (!L.running) {
      if ($('#cam-state-btn') && !$('#cam-state-btn').hidden) $('#cam').hidden = true; // camera was blocked
      runLive(L);
    }
    setStatus('', true);
    ta.focus();
  }

  async function finishLive(L) {
    L = L || state.live;
    if (!L || L !== state.live || L.ended) return;
    L.ended = true;
    clearInterval(L.timer);
    $('#btn-done').disabled = true;
    setStatus('', true);
    let text = '';
    if (L.typed) text = $('#type-input').value.trim();
    else if (window.Speech && window.Speech.supported) {
      try { text = await window.Speech.finish(); } catch (e) { text = L.speechText; }
    }
    if (!text) text = (L.speechText || '').trim();
    const BT = getBody();
    if (L.bodyStarted && BT && typeof BT.stop === 'function' && !L.body) {
      try { L.body = normalizeBody(await withTimeout(BT.stop(), 4000)); } catch (e) { L.body = null; }
      L.bodyStarted = false;
    }
    stopCamera(L);
    if (L !== state.live) return;
    if (!text) {
      // nothing heard: one plain line, one way forward
      L.ended = false;
      L.typed = true;
      $('#btn-done').disabled = false;
      liveMsg(T.noWords, [
        { label: T.tryAgain, primary: true, onclick: () => startLive() },
        { label: T.typeInstead, onclick: () => { liveMsg(null); $('#typebox').hidden = false; $('#transcript').hidden = true; $('#btn-type').hidden = true; $('#type-input').focus(); } }
      ]);
      return;
    }
    state.live = null;
    submitAttempt({ transcript: text, body: L.body, sampleBody: false, recorded: false });
  }

  function stopCamera(L) {
    if (L && L.stream) { L.stream.getTracks().forEach((t) => { try { t.stop(); } catch (e) { /* ignore */ } }); L.stream = null; }
    const v = $('#cam-video');
    if (v) v.srcObject = null;
  }

  function abortLive() {
    const L = state.live;
    if (!L) return;
    state.live = null;
    L.ended = true;
    clearInterval(L.timer);
    if (window.Speech) { try { window.Speech.abort(); } catch (e) { /* ignore */ } }
    const BT = getBody();
    if (L.bodyStarted && BT && typeof BT.stop === 'function') { try { Promise.resolve(BT.stop()).catch(() => {}); } catch (e) { /* ignore */ } }
    stopCamera(L);
  }

  // body.js rule: hide the delivery strip when tracked is false or the line is empty.
  function normalizeBody(b) {
    if (!b || typeof b !== 'object' || b.ok === false || b.tracked === false || !hasText(b.line)) return null;
    return Object.assign({}, b, {
      marks: Array.isArray(b.marks) ? b.marks.filter((m) => m && (m.t != null || typeof m.sec === 'number')).slice(0, 2) : [],
      counts: (b.counts && typeof b.counts === 'object') ? b.counts : {}
    });
  }

  // ---------------------------------------------------------------- recorded run
  function recordedSampleId(mode, attempt) {
    if (mode === 'defend') return attempt === 1 ? 'phones-defend-switch' : null;
    if (mode === 'attack') return attempt === 1 ? 'phones-attack-dropped' : 'phones-attack-fixed';
    return null;
  }
  function startRecorded() {
    if (state.motionId !== 'phones' && motionById('phones')) { state.motionId = 'phones'; }
    ensureMode();
    if (state.mode === 'challenge') state.mode = 'attack';
    state.attempts = [];
    state.pickerOpen = false;
    runRecorded(1);
  }
  function runRecorded(attempt) {
    const id = recordedSampleId(state.mode, attempt);
    const s = SAMPLE_TRANSCRIPTS.find((x) => x.id === id);
    if (!s) { startLive(); return; }
    submitAttempt({ transcript: s.transcript, body: clone(SAMPLE_BODY[attempt > 1 ? 2 : 1]), sampleBody: true, recorded: true, sampleId: id });
  }
  function useRecordedExample() {
    if (state.motionId !== 'phones') { state.motionId = 'phones'; state.attempts = []; }
    ensureMode();
    if (state.mode === 'challenge') state.mode = 'attack';
    let attempt = state.attempts.length + 1;
    if (!recordedSampleId(state.mode, attempt)) { state.attempts = []; attempt = 1; }
    state.pending = null;
    runRecorded(attempt);
  }
  function tryAgain(fromAttempt) {
    if (fromAttempt && fromAttempt.recorded && recordedSampleId(state.mode, state.attempts.length + 1)) {
      runRecorded(state.attempts.length + 1);
      return;
    }
    startLive();
  }

  // ---------------------------------------------------------------- judging
  function submitAttempt(p) {
    state.pending = Object.assign({}, p, { attempt: state.attempts.length + 1, slow: false, failed: false });
    if (state.screen === 'report') renderReport(); else go('report');
    runAnalyze();
  }

  async function runAnalyze() {
    const P = state.pending;
    if (!P) return;
    const m = currentMotion();
    const prev = state.attempts.length ? state.attempts[state.attempts.length - 1].result : null;
    const req = { motion_id: m.id, motion: m, mode: state.mode, transcript: P.transcript, attempt: P.attempt, previous: prev };
    const slowTimer = setTimeout(() => {
      if (state.pending === P) { P.slow = true; if (state.screen === 'report') renderReport(); }
    }, 8000);
    let result = null;
    try {
      result = await postJSON('/api/analyze', req, 45000);
      if (!result || result.error || !result.break) throw new Error((result && result.error) || 'no verdict');
    } catch (e) {
      console.warn('analyze failed:', e && e.message);
      result = null;
    }
    clearTimeout(slowTimer);
    if (state.pending !== P) return; // superseded by another run
    if (!result && P.sampleId && LOCAL_REPLAY[P.sampleId]) {
      result = clone(LOCAL_REPLAY[P.sampleId]);
      result.source = 'replay';
    }
    if (!result) {
      P.failed = true;
      if (state.screen === 'report') renderReport();
      return;
    }
    result = normalizeResult(result, P);
    const entry = {
      result: result, transcript: P.transcript, body: P.body || null, sampleBody: !!P.sampleBody,
      recorded: !!P.recorded, sampleId: P.sampleId || null, mode: state.mode, motionId: m.id
    };
    state.attempts.push(entry);
    state.pending = null;
    saveAttempt(entry);
    announce(isUnsure(result) ? T.lowConf : breakLabel(result.break, entry.mode));
    if (state.attempts.length >= 2) go('second');
    else if (state.screen === 'report') renderReport();
    else go('report');
  }

  function normalizeResult(r, P) {
    r = Object.assign({}, r);
    r.attacks = Array.isArray(r.attacks) ? r.attacks : [];
    r.links = Array.isArray(r.links) ? r.links : [];
    r.break = Object.assign({ type: 'none' }, r.break || {});
    r.attempt = r.attempt || P.attempt;
    if (typeof r.confidence !== 'number') r.confidence = Number(r.confidence);
    if (!isFinite(r.confidence)) r.confidence = 1;
    if (!r.source) r.source = 'gmi';
    return r;
  }

  function saveAttempt(entry) {
    const n = state.attempts.indexOf(entry) + 1 || entry.result.attempt || 1;
    postJSON('/api/attempts', {
      result: entry.result, motion_id: entry.motionId, mode: entry.mode, body: entry.body,
      transcript: entry.transcript, recorded: entry.recorded, attempt: n,
      assignment_id: state.assignment ? state.assignment.id : null,
      student: (state.assignment && state.student) ? state.student : 'You'
    }, 8000).catch((e) => console.warn('attempt not saved:', e && e.message));
  }
  function doneLine() { return h('p', { class: 'hw-done', role: 'status' }, T.hwDone); }

  // ---------------------------------------------------------------- 3. report
  function renderReport() {
    const root = $('#screen-report');
    root.textContent = '';
    const P = state.pending;
    if (P && P.failed) { root.append(errorView()); return; }
    if (P) { root.append(waitView(P)); return; }
    const a = state.attempts[state.attempts.length - 1];
    if (!a) { go('motion', { replace: true }); return; }
    const view = reportView(a);
    root.append(view.el);
    drawChain(view.chainBox, motionById(a.motionId) || currentMotion(), a.result, a.mode);
  }

  function waitView(P) {
    const excerpt = P.transcript.length > 150 ? P.transcript.slice(0, 150).replace(/\s+\S*$/, '') + '…' : P.transcript;
    return h('div', { class: 'wait', role: 'status', 'aria-live': 'polite' },
      P.recorded ? h('span', { class: 'badge' }, T.recorded) : null,
      h('div', { class: 'wait-line', 'aria-hidden': 'true' }),
      h('p', { class: 'wait-text' }, P.slow ? T.slow : T.checking),
      h('p', { class: 'wait-sub' }, '“' + excerpt + '”'));
  }

  function errorView() {
    return h('div', { class: 'state-panel', role: 'alert' },
      h('h1', null, T.judgeError),
      h('div', { class: 'state-actions' },
        h('button', { type: 'button', class: 'btn btn-primary', onclick: () => { const P = state.pending; if (!P) return; P.failed = false; P.slow = false; renderReport(); runAnalyze(); } }, T.tryAgain),
        state.assignment ? null : h('button', { type: 'button', class: 'btn btn-secondary', onclick: useRecordedExample }, T.useRecorded)));
  }

  function reportView(a) {
    const r = a.result;
    const brk = r.break || {};
    const type = breakType(r);
    const none = type === 'none';
    const unsure = isUnsure(r);
    const label = breakLabel(brk, a.mode);
    const why = breakWhy(brk);
    const n = state.attempts.indexOf(a) + 1 || r.attempt || 1;
    const anim = !reducedMotion();
    const hasChain = !!(getChain() && typeof getChain().render === 'function');
    // with chain.js animating, the verdict lands as the break marker opens (~1.1 s)
    const k = hasChain ? 1.7 : 1;
    const d = (ms) => ({ '--d': (anim ? Math.round(ms * k) : 0) + 'ms' });

    let title, verdict, whyLine = null;
    if (unsure) {
      // chain.js prints the low-confidence line inside the diagram; print it here only without chain.js
      title = null;
      verdict = hasChain ? null : h('h1', { class: 'verdict is-unsure reveal', style: d(150) }, T.lowConf);
    } else if (none) {
      title = null;
      verdict = h('h1', { class: 'verdict is-hero is-holds reveal', style: d(150) }, T.titleHolds);
      // chain.js prints "Every link you attacked holds" under the diagram: don't repeat it
      const extra = hasChain ? (hasText(brk.why) && brk.why.trim() !== label ? brk.why.trim() : '') : label;
      whyLine = extra ? h('p', { class: 'why reveal', style: d(300) }, extra) : null;
    } else {
      title = h('p', { class: 'eyebrow' }, T.titleBroke);
      verdict = h('h1', { class: 'verdict reveal' + (label.length <= 30 ? ' is-hero' : ''), style: d(650) }, label);
      whyLine = why ? h('p', { class: 'why reveal', style: d(800) }, why) : null;
    }

    const chainBox = h('div', { class: 'chain-box' });
    const heardId = 'heard-' + n;
    const heard = h('div', { class: 'heard', id: heardId, hidden: true },
      h('p', { class: 'tag' }, T.heardTitle), h('p', null, '“' + a.transcript + '”'));
    const heardBtn = h('button', {
      type: 'button', class: 'btn btn-text', 'aria-expanded': 'false', 'aria-controls': heardId,
      onclick: (e) => { const open = heard.hidden; heard.hidden = !open; e.currentTarget.setAttribute('aria-expanded', String(open)); }
    }, T.seeHeard);

    const hint = hasText(r.hint) ? r.hint.trim() : ((BREAK_COPY[type] && BREAK_COPY[type].hint) || '');
    const primary = (none && !unsure)
      ? (state.assignment ? doneLine() : h('button', { type: 'button', class: 'btn btn-primary btn-lg', onclick: nextMotion }, T.nextMotion))
      : h('button', { type: 'button', class: 'btn btn-primary btn-lg', onclick: () => tryAgain(a) }, T.tryAgain);
    const secondary = (none && !unsure) ? h('button', { type: 'button', class: 'btn btn-secondary', onclick: () => tryAgain(a) }, T.tryAgain) : null;

    const fix = h('section', { class: 'card fix-card reveal', style: d(950), 'aria-label': T.hintTitle },
      hint ? h('h2', { class: 'eyebrow' }, T.hintTitle) : null,
      hint ? h('p', { class: 'hint' }, hint) : null,
      h('div', { class: 'fix-actions' }, primary, secondary, heardBtn),
      heard);

    const delivery = a.body ? deliveryView(a.body, { sample: a.sampleBody, delay: anim ? 1150 : 0 }) : null;

    const el = h('div', { class: 'report' },
      h('div', { class: 'report-head' },
        title || h('span'),
        h('div', { class: 'badges' },
          a.recorded ? h('span', { class: 'badge' }, T.recorded) : null,
          n > 1 ? h('span', { class: 'badge' }, T.attempt(n)) : null)),
      h('div', { class: 'report-grid' },
        h('div', { class: 'report-main' },
          hasText(r.landed) ? h('p', { class: 'landed reveal', style: d(0) }, r.landed) : null,
          verdict, whyLine, chainBox),
        h('div', { class: 'report-side' }, fix, delivery)),
      h('footer', { class: 'report-foot' }, h('span', null, footerText(r)), a.recorded && r.source !== 'replay' ? h('span', null, T.recorded) : null));
    return { el: el, chainBox: chainBox };
  }

  // Up to two delivery lines: body.js gives each mark a ready-made copy.md line; else build one; else the safe line.
  function deliveryLines(body) {
    const out = [];
    (body.marks || []).forEach((m) => { if (hasText(m.line) && out.indexOf(m.line) < 0) out.push(m.line); });
    if (!out.length) {
      const c = body.counts || {};
      const marks = body.marks || [];
      const ft = Number(c.face_touch) || 0;
      const slouch = marks.find((m) => m.type === 'slouch');
      const sway = marks.find((m) => m.type === 'sway');
      if (ft > 0) out.push(DELIVERY.face(ft));
      else if (slouch) out.push(DELIVERY.slouch(slouch.t));
      else if (sway) out.push(DELIVERY.sway(sway.t));
    }
    if (!out.length && hasText(body.line)) out.push(body.line);
    return out.slice(0, 2);
  }

  function faceChangeText(b1, b2) {
    if (!b1 || !b2) return null;
    const BT = getBody();
    if (BT && typeof BT.changeLine === 'function') {
      try { return BT.changeLine(b1, b2) || null; } catch (e) { /* fall through */ }
    }
    const f1 = Number(b1.counts && b1.counts.face_touch);
    const f2 = Number(b2.counts && b2.counts.face_touch);
    return (isFinite(f1) && isFinite(f2) && f2 < f1) ? T.faceChange(f1, f2) : null;
  }

  function deliveryView(body, opts) {
    opts = opts || {};
    const marks = (body.marks || []).slice(0, 2).map((m) => ({
      t: m.t != null ? String(m.t) : fmtTime(m.sec || 0),
      sec: clamp(typeof m.sec === 'number' ? m.sec : parseTime(m.t), 0, 60),
      label: m.label || MARK_LABEL[m.type] || ''
    }));
    const lines = deliveryLines(body);
    if (!marks.length && !lines.length) return null;
    // mark 1 is labelled above the track and mark 2 below it, so two labels never collide
    const strip = h('div', { class: 'strip', role: 'img', 'aria-label': 'Timeline 0:00 to 1:00' + (marks.length ? ': ' + marks.map((m) => m.t + ' ' + m.label).join(', ') : '') },
      h('div', { class: 'strip-track' }),
      h('span', { class: 'strip-tick is-start' }, '0:00'),
      h('span', { class: 'strip-tick is-end' }, '1:00'),
      marks.map((m) => h('span', { class: 'strip-dot', style: { '--p': String(m.sec / 60) } })),
      marks.map((m, i) => {
        const p = m.sec / 60;
        return h('span', { class: 'strip-label is-' + (p < 0.2 ? 'start' : p > 0.8 ? 'end' : 'mid') + (i === 1 ? ' is-below' : ''), style: { '--p': String(p) } }, m.t + ' ' + m.label);
      }));
    return h('section', { class: 'card delivery-card reveal', style: { '--d': (opts.delay || 0) + 'ms' }, 'aria-label': T.delivery },
      h('div', { class: 'delivery-head' }, h('h2', { class: 'eyebrow' }, T.delivery), opts.sample ? h('span', { class: 'badge' }, T.sample) : null),
      strip,
      lines.map((l) => h('p', { class: 'delivery-line' }, l)));
  }

  // ---------------------------------------------------------------- chain (chain.js or fallback)
  function drawChain(box, motion, result, mode) {
    const C = getChain();
    if (C && typeof C.render === 'function') {
      try {
        C.render(box, motion, result, { animate: !reducedMotion(), mode: mode });
        return;
      } catch (e) {
        console.warn('Chain.render failed, using the simple list:', e);
        box.textContent = '';
      }
    }
    box.append(fallbackChain(motion, result, mode, false));
  }

  function linkChip(holds) { return h('span', { class: 'chip ' + (holds ? 'chip-hold' : 'chip-break') }, holds ? T.holds : T.breaks); }

  function fallbackChain(motion, result, mode, compact) {
    const args = argsOf(motion);
    const brk = result.break || {};
    const attacks = result.attacks || [];
    const links = result.links || [];
    if (mode === 'defend' || !args.length) return fallbackDefend(motion, result, compact);
    const wrap = h('div', { class: 'fb' + (args.length === 1 ? ' is-single' : '') });
    args.forEach((arg, i) => {
      const mine = attacks.filter((x) => x.arg === arg.id);
      const isBreak = brk.type && brk.type !== 'none' && brk.arg === arg.id;
      const dropped = isBreak && !mine.length;
      let pointChip = null;
      if (isBreak) pointChip = linkChip(false);
      else if (mine.length) pointChip = linkChip(mine.every((x) => x.holds));
      const rows = LINKS.filter((k) => k !== 'evidence' || hasText(arg.evidence)).filter((k) => hasText(arg[k])).map((k) => {
        const st = ((links.find((l) => l.arg === arg.id && l.link === k) || {}).status) || 'untouched';
        const at = mine.find((x) => x.link === k);
        const isBreakLink = isBreak && !dropped && brk.link === k;
        const chip = at ? linkChip(!!at.holds) : (isBreakLink ? linkChip(false) : null);
        return h('li', { class: 'fb-link is-' + st + (isBreakLink ? ' is-break' : '') },
          h('span', { class: 'tag' }, k.toUpperCase()), chip,
          h('span', { class: 'ctext' }, arg[k]),
          (!compact && at && hasText(at.quote)) ? h('q', { class: 'quote' }, at.quote) : null);
      });
      wrap.append(h('div', { class: 'fb-point' + (isBreak ? ' is-break' : '') },
        h('div', { class: 'fb-point-head' }, h('span', { class: 'eyebrow' }, T.point(i + 1)), pointChip),
        compact && !isBreak ? h('p', { class: 'ctext' }, arg.claim) : h('ol', { class: 'fb-links' }, rows)));
    });
    return wrap;
  }

  function fallbackDefend(motion, result, compact) {
    const a = attackOn(motion) || {};
    const brk = result.break || {};
    const broke = brk.type && brk.type !== 'none';
    const answers = (result.attacks || []).filter((x) => hasText(x.quote));
    return h('div', { class: 'fb is-single' },
      h('div', { class: 'fb-point' + (broke ? ' is-break' : '') },
        h('div', { class: 'fb-point-head' }, h('span', { class: 'eyebrow' }, T.theirAttack), linkChip(!broke)),
        h('p', { class: 'ctext' }, a.attack || ''),
        compact ? null : answers.map((x) => h('div', { class: 'fb-link' }, h('q', { class: 'quote' }, x.quote), linkChip(!!x.holds)))));
  }

  // ---------------------------------------------------------------- 4. second try
  function renderSecond() {
    const root = $('#screen-second');
    root.textContent = '';
    const first = state.attempts[0];
    const latest = state.attempts[state.attempts.length - 1];
    const r1 = first.result, r2 = latest.result;
    const n = state.attempts.length;
    const fixed = breakType(r2) === 'none';
    const unsure = isUnsure(r2);
    const firstHeld = breakType(r1) === 'none';
    const anim = !reducedMotion();
    const d = (ms) => ({ '--d': (anim ? ms : 0) + 'ms' });

    let line, lineClass;
    const chainPrintsUnsure = !!(getChain() && typeof getChain().compare === 'function');
    if (unsure) { line = chainPrintsUnsure ? T.secondTitle : T.lowConf; lineClass = 'second-line is-closer'; }
    else if (fixed && !firstHeld) { line = T.fixed(n); lineClass = 'second-line is-fixed'; }
    else if (fixed) { line = T.titleHolds; lineClass = 'second-line is-fixed'; }
    else { line = T.closer; lineClass = 'second-line is-closer'; }

    const sub = fixed
      ? (hasText(r2.landed) ? r2.landed : '')
      : breakLabel(r2.break, latest.mode) + (breakWhy(r2.break) ? '. ' + breakWhy(r2.break) : '');

    const face = faceChangeText(first.body, latest.body) ? h('p', { class: 'face-change reveal', style: d(500) }, faceChangeText(first.body, latest.body)) : null;

    const compareBox = h('div', { class: 'compare-box reveal', style: d(150) });
    const hint = (!fixed && hasText(r2.hint)) ? r2.hint.trim() : '';
    const modelId = 'model-answer';
    const model = (!fixed && hasText(r2.model_answer) && n >= 2)
      ? h('div', { class: 'model-answer card', id: modelId, hidden: true },
        h('p', { class: 'eyebrow' }, T.oneWay), h('p', { class: 'ma-text' }, r2.model_answer.trim()), h('p', { class: 'helper' }, T.compareHelper))
      : null;

    const actions = fixed
      ? [state.assignment ? doneLine() : h('button', { type: 'button', class: 'btn btn-primary btn-lg', onclick: nextMotion }, T.nextMotion)]
      : [
        h('button', { type: 'button', class: 'btn btn-primary btn-lg', onclick: () => tryAgain(latest) }, T.tryAgain),
        model ? h('button', {
          type: 'button', class: 'btn btn-secondary', 'aria-expanded': 'false', 'aria-controls': modelId,
          onclick: (e) => { const open = model.hidden; model.hidden = !open; e.currentTarget.setAttribute('aria-expanded', String(open)); }
        }, T.showModel) : null,
        state.assignment ? null : h('button', { type: 'button', class: 'btn btn-text', onclick: nextMotion }, T.nextMotion)
      ];

    root.append(h('div', { class: 'second' },
      h('div', { class: 'report-head' },
        h('p', { class: 'eyebrow' }, T.secondTitle),
        h('div', { class: 'badges' }, latest.recorded ? h('span', { class: 'badge' }, T.recorded) : null, latest.sampleBody && face ? h('span', { class: 'badge' }, T.sample) : null)),
      h('div', { class: 'second-top' },
        h('div', null,
          h('h1', { class: lineClass + ' reveal', style: d(0) }, line),
          sub ? h('p', { class: 'second-sub reveal', style: d(250) }, sub) : null,
          hint ? h('p', { class: 'hint reveal', style: Object.assign({ 'margin-top': '12px' }, d(350)) }, hint) : null),
        face),
      compareBox,
      h('div', { class: 'second-actions' }, actions),
      model,
      h('footer', { class: 'report-foot' }, h('span', null, footerText(r2)))));

    drawCompare(compareBox, motionById(latest.motionId) || currentMotion(), r1, r2, latest.mode, n);
  }

  function drawCompare(box, motion, r1, r2, mode, n) {
    const C = getChain();
    if (C && typeof C.compare === 'function') {
      try { C.compare(box, motion, r1, r2, { animate: !reducedMotion(), mode: mode }); return; } catch (e) { console.warn('Chain.compare failed, using the simple list:', e); box.textContent = ''; }
    }
    box.append(h('div', { class: 'compare-cols' },
      h('div', { class: 'compare-col' }, h('p', { class: 'eyebrow' }, T.attempt(1)), fallbackChain(motion, r1, mode, true)),
      h('div', { class: 'compare-col' }, h('p', { class: 'eyebrow' }, T.attempt(n)), fallbackChain(motion, r2, mode, true))));
  }

  // ---------------------------------------------------------------- 5. coach view (small supporting panel)
  function motionShort(m, a) {
    if (a && hasText(a.title)) return a.title.trim();
    const text = (m && (m.short || m.motion)) || (a && a.motion_id) || '';
    const s = String(text).replace(/^this house (would|believes( that)?|should|supports|regrets)\s+/i, '').replace(/[.。]\s*$/, '');
    return s ? s.charAt(0).toUpperCase() + s.slice(1) : '';
  }

  let toastTimer = null;
  function toast(msg) {
    const el = $('#toast');
    if (!el) return;
    el.textContent = msg;
    el.classList.add('is-on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { el.classList.remove('is-on'); }, 3000);
  }

  async function renderCoach() {
    const root = $('#screen-coach');
    const token = ++coachToken;
    root.textContent = '';
    if (!state.motions.length) await loadMotions();
    if (token !== coachToken) return;
    const listBox = h('div', { class: 'hw-list', 'aria-busy': 'true' }, h('div', { class: 'wait-line', 'aria-hidden': 'true' }));
    const classBox = h('div', { class: 'coach-col', 'aria-busy': 'true' }, h('div', { class: 'wait-line', 'aria-hidden': 'true' }));
    root.append(h('div', { class: 'coach' },
      h('h1', { class: 'sr-only' }, 'Coach view'),
      h('div', { class: 'coach-grid' },
        h('div', { class: 'coach-col' }, homeworkCreateCard(listBox), listBox),
        classBox)));
    const res = await Promise.all([
      getJSON('/api/assignments', 8000).catch(() => null),
      getJSON('/api/class', 8000).catch(() => null)
    ]);
    if (token !== coachToken || state.screen !== 'coach') return;
    fillHomeworkList(listBox, res[0]);
    fillSampleClass(classBox, res[1]);
  }

  function homeworkCreateCard(listBox) {
    const hw = state.hw;
    if (!hw.motionId || !motionById(hw.motionId)) hw.motionId = (currentMotion() || {}).id;
    const card = h('section', { class: 'card hw-card', 'aria-labelledby': 'hw-card-title' });

    async function createLink() {
      if (hw.busy) return;
      const m = motionById(hw.motionId);
      if (!m) return;
      hw.busy = true; hw.error = ''; paint();
      try {
        const a = await postJSON('/api/assignments', { motion_id: m.id, mode: hw.mode, title: motionShort(m), due: '' }, 8000);
        if (!a || !a.url) throw new Error('no link');
        hw.link = a.url;
      } catch (e) {
        hw.error = T.hwLinkError;
      }
      hw.busy = false;
      paint();
      const u = $('#hw-url');
      if (u) u.focus({ preventScroll: true });
      getJSON('/api/assignments', 8000).then((list) => { if (state.screen === 'coach') fillHomeworkList(listBox, list); }).catch(() => {});
    }

    async function copyLink() {
      const input = $('#hw-url');
      if (!input) return;
      let ok = false;
      try {
        if (navigator.clipboard && navigator.clipboard.writeText) { await navigator.clipboard.writeText(input.value); ok = true; }
      } catch (e) { ok = false; }
      if (!ok) {
        input.focus(); input.select();
        try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
      }
      if (ok) toast(T.hwCopied); else { input.focus(); input.select(); }
    }

    function paint() {
      card.textContent = '';
      const m = motionById(hw.motionId);
      const modes = availableModes(m).filter((x) => x !== 'challenge');
      if (modes.indexOf(hw.mode) < 0) hw.mode = modes[0] || 'attack';
      const select = h('select', { id: 'hw-motion', onchange: (e) => { hw.motionId = e.target.value; hw.link = null; paint(); const s = $('#hw-motion'); if (s) s.focus(); } },
        state.motions.map((mm) => h('option', { value: mm.id, selected: mm.id === hw.motionId }, mm.motion)));
      const modeCtl = modes.length > 1
        ? h('div', { class: 'mode-toggle', role: 'group', 'aria-labelledby': 'hw-mode-label' }, modes.map((md) =>
          h('button', { type: 'button', 'aria-pressed': String(md === hw.mode), onclick: () => { hw.mode = md; hw.link = null; paint(); const b = $('.hw-card .mode-toggle button[aria-pressed="true"]'); if (b) b.focus(); } }, md === 'defend' ? T.modeDefend : T.modeAttack)))
        : h('p', { class: 'muted' }, hw.mode === 'defend' ? T.modeDefend : T.modeAttack);
      add(card, [
        h('h2', { class: 'eyebrow', id: 'hw-card-title' }, T.hwLinkLabel),
        h('div', { class: 'field' }, h('label', { for: 'hw-motion', class: 'field-label' }, T.hwMotion), select),
        h('div', { class: 'field' }, h('span', { class: 'field-label', id: 'hw-mode-label' }, T.hwMode), modeCtl),
        h('div', { class: 'hw-create' },
          h('button', { type: 'button', class: 'btn btn-primary', 'aria-busy': hw.busy ? 'true' : null, onclick: createLink }, T.hwCreate),
          h('p', { class: 'helper' }, T.hwHelper)),
        hw.error ? h('p', { class: 'hw-error', role: 'alert' }, hw.error) : null,
        hw.link ? h('div', { class: 'hw-link' },
          h('label', { for: 'hw-url', class: 'sr-only' }, T.hwLinkLabel),
          h('input', { id: 'hw-url', class: 'mono', type: 'text', readonly: true, value: hw.link, onfocus: (e) => e.target.select() }),
          h('button', { type: 'button', class: 'btn btn-secondary', onclick: copyLink }, T.hwCopy)) : null
      ]);
    }
    paint();
    return card;
  }

  function submissionLine(s) {
    const tries = Number(s.tries) || 0;
    const head = (s.name || 'Student') + ' · ' + T.hwTries(tries);
    if (!s.first_break) return [head];
    if (s.first_break === 'none') return [head + ' · ' + T.hwHeld];
    const first = shortLabel(s.first_break);
    if (s.fixed) return [head + ' · ' + first + ' → ', h('span', { class: 'chip chip-hold' }, T.hwFixed)];
    if (tries <= 1 || !s.last_break) return [head + ' · ' + first];
    return [head + ' · ' + first + ' → ' + shortLabel(s.last_break)];
  }

  function fillHomeworkList(box, list) {
    box.removeAttribute('aria-busy');
    box.textContent = '';
    if (!Array.isArray(list)) return; // optional panel: the create card still works without it
    if (!list.length) { box.append(h('p', { class: 'muted hw-empty' }, T.hwNone)); return; }
    list.slice(0, 6).forEach((a) => {
      const subs = Array.isArray(a.submissions) ? a.submissions : [];
      const firsts = {};
      subs.forEach((s) => { if (s.first_break && s.first_break !== 'none') firsts[s.first_break] = (firsts[s.first_break] || 0) + 1; });
      const top = Object.keys(firsts).sort((x, y) => firsts[y] - firsts[x])[0];
      box.append(h('section', { class: 'card hw-item' },
        h('h2', { class: 'hw-item-title' }, T.hwHeader(motionShort(motionById(a.motion_id), a), subs.length)),
        subs.length ? h('ul', { class: 'hw-subs' }, subs.map((s) => h('li', null, submissionLine(s)))) : null,
        top ? h('p', { class: 'hw-foot' }, T.hwFirstBreak(shortLabel(top), firsts[top])) : null));
    });
  }

  function fillSampleClass(box, data) {
    box.removeAttribute('aria-busy');
    box.textContent = '';
    if (!data || !Array.isArray(data.students)) {
      box.append(h('div', { class: 'card' }, h('p', { class: 'muted' }, T.classError),
        h('div', { class: 'state-actions', style: { 'margin-top': '12px' } }, h('button', { type: 'button', class: 'btn btn-secondary', onclick: renderCoach }, T.tryAgain))));
      return;
    }
    const entries = Object.keys(data.breaks || {}).map((k) => [k, Number(data.breaks[k]) || 0]).filter((e) => e[1] > 0 && e[0] !== 'none').sort((a, b) => b[1] - a[1]);
    const total = Number(data.total) || entries.reduce((s, e) => s + e[1], 0) || 1;
    const max = entries.length ? entries[0][1] : 1;
    const top = entries[0];

    const breaksCard = h('section', { class: 'card', 'aria-labelledby': 'class-week' },
      h('div', { class: 'coach-head' }, h('h2', { id: 'class-week' }, T.coachTitle), h('span', { class: 'badge' }, T.sample)),
      h('p', { class: 'eyebrow', style: { 'margin-top': '16px' } }, T.mostCommon),
      top ? h('p', { class: 'top-break' }, shortLabel(top[0]), h('span', { class: 'of' }, ' · ' + top[1] + ' of ' + total)) : null,
      h('ul', { class: 'bars' }, entries.map((e, i) => h('li', { class: 'bar-row' + (i === 0 ? ' is-top' : '') },
        h('div', { class: 'bar-label' }, h('b', null, shortLabel(e[0])), h('span', { class: 'mono' }, e[1] + ' of ' + total)),
        h('div', { class: 'bar-track', 'aria-hidden': 'true' }, h('div', { class: 'bar-fill', style: { '--w': '0' }, 'data-w': String(e[1] / max) }))))));

    let review = Array.isArray(data.review) ? data.review.filter((x) => x && !x.verdict) : [];
    if (!review.length) review = SAMPLE_REVIEW;
    const reviewCard = h('section', { class: 'card', 'aria-labelledby': 'needs-review' },
      h('h2', { class: 'eyebrow', id: 'needs-review' }, T.review),
      h('p', { class: 'helper', style: { 'margin-top': '4px' } }, T.reviewHelper),
      h('ul', { class: 'review-list' }, review.slice(0, 3).map(reviewItem)));

    const classCard = h('section', { class: 'card', 'aria-labelledby': 'class-list' },
      h('div', { class: 'coach-head', style: { 'margin-bottom': '12px' } }, h('h2', { class: 'eyebrow', id: 'class-list' }, T.classList), h('span', { class: 'badge' }, T.sample)),
      h('table', { class: 'ctable' },
        h('thead', null, h('tr', null, h('th', { scope: 'col' }, T.colStudent), h('th', { scope: 'col' }, T.colBreak), h('th', { scope: 'col', class: 'num' }, T.colTries))),
        h('tbody', null, data.students.map((s) => h('tr', null,
          h('td', null, s.name || ''),
          h('td', null, s.last_break === 'none' ? h('span', { class: 'chip chip-hold' }, T.holds) : shortLabel(s.last_break)),
          h('td', { class: 'num' }, s.tries != null ? String(s.tries) : ''))))));

    add(box, [breaksCard, reviewCard, classCard]);
    requestAnimationFrame(() => requestAnimationFrame(() => {
      $$('.bar-fill', box).forEach((b) => b.style.setProperty('--w', b.getAttribute('data-w')));
    }));
  }

  function reviewItem(item) {
    const r = item.result || {};
    const brk = r.break || {};
    const actions = h('div', { class: 'review-actions' });
    function paintActions() {
      actions.textContent = '';
      const v = state.reviewed[item.id];
      if (v) { actions.append(h('p', { class: 'review-done', role: 'status' }, T.saved(v))); return; }
      ['agree', 'disagree'].forEach((verdict) => {
        actions.append(h('button', {
          type: 'button', class: 'btn btn-secondary',
          onclick: async () => {
            const btns = $$('button', actions);
            btns.forEach((b) => { b.disabled = true; });
            try {
              if (!item.sample) await postJSON('/api/review', { id: item.id, verdict: verdict }, 8000);
              state.reviewed[item.id] = verdict;
              paintActions();
            } catch (err) {
              btns.forEach((b) => { b.disabled = false; });
            }
          }
        }, verdict === 'agree' ? T.agree : T.disagree));
      });
    }
    paintActions();
    return h('li', { class: 'review-item' },
      h('div', { class: 'r-head' },
        h('span', { class: 'r-name' }, item.name || item.student || 'You'),
        item.sample ? h('span', { class: 'badge' }, T.sample) : null),
      h('p', { class: 'r-verdict' }, T.aiSaid + ': ', h('span', { class: 'chip chip-break' }, breakLabel(brk, item.mode))),
      hasText(item.transcript) ? h('p', { class: 'r-quote' }, '“' + item.transcript + '”') : null,
      actions);
  }

  // ---------------------------------------------------------------- boot
  function wireLive() {
    $('#btn-done').addEventListener('click', () => {
      const L = state.live;
      if (!L) return;
      if (!L.running) { // camera still blocked or loading: there is nothing to judge yet
        if (L.typed) finishLive(L);
        return;
      }
      finishLive(L);
    });
    $('#btn-type').addEventListener('click', () => switchToTyping(state.live));
    document.addEventListener('visibilitychange', () => {
      // the recogniser stops when the tab hides; speech.js restarts it on return
    });
  }

  async function loadMotions() {
    let list = null;
    try {
      const data = await getJSON('/api/motions', 4000);
      list = Array.isArray(data) ? data : (data && Array.isArray(data.motions) ? data.motions : null);
    } catch (e) { list = null; }
    if (list && list.length && list.every((m) => m && m.id && m.motion)) state.motions = list;
    else {
      console.warn('motions API not ready: using the built-in demo motion');
      state.motions = clone(FALLBACK_MOTIONS);
    }
    if (!motionById(state.motionId)) state.motionId = state.motions[0].id;
  }

  async function boot() {
    wireLive();
    window.addEventListener('hashchange', route);
    getJSON('/api/health', 4000).then((hdata) => { state.health = hdata; }).catch(() => {});
    // A homework link: /a/<id> serves this page; the assignment fixes motion and mode.
    const am = location.pathname.match(/^\/a\/([A-Za-z0-9_-]+)\/?$/);
    if (am) {
      state.assignment = { id: am[1], data: null, error: false };
      const nav = $('#topnav');
      if (nav) nav.hidden = true;
      try { state.student = localStorage.getItem('bp-student-' + am[1]) || ''; } catch (e) { state.student = ''; }
    }
    const first = parseHash();
    if (first.name === 'coach' && !state.assignment) route(); else { show('motion'); renderMotion(); }
    await loadMotions();
    if (state.assignment) {
      try {
        const a = await getJSON('/api/assignments/' + encodeURIComponent(state.assignment.id), 8000);
        if (!a || !a.motion_id || !motionById(a.motion_id)) throw new Error('unknown homework');
        state.assignment.data = a;
        state.motionId = a.motion_id;
        state.mode = a.mode || 'attack';
        ensureMode();
      } catch (e) {
        console.warn('homework link failed:', e && e.message);
        state.assignment.error = true;
      }
      go('motion', { replace: true });
      return;
    }
    const p = parseHash();
    if (p.name === 'motion' || p.name === 'coach') route();
    else go('motion', { replace: true });
  }

  // Exposed for the team's console checks only.
  window.BreakpointUI = { state: state, runRecorded: runRecorded, go: go };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
