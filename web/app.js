/* Breakpoint UI controller (owner: ui). Vanilla JS, Chrome only, no build step.
   Talks to /api (CONTRACT.md). Uses window.Chain (chain.js), window.BodyTrack (body.js) and
   window.Speech (speech.js) when present; every call is guarded so the page works without them. */
(function () {
  'use strict';

  // ---------------------------------------------------------------- exact strings (copy.md)
  const T = {
    eyebrow: "Tonight's question",
    youArgue: (s) => (s === 'For' ? 'You say yes. Answer them.' : 'You say no. Answer them.'),
    theirArgument: 'Someone says',
    theirAttack: 'Their attack',
    modeAttack: 'Answer back',
    modeDefend: 'Stand your ground',
    helperAttack: 'They make their case. You answer it.',
    helperDefend: 'They push back on your point. You stand your ground.',
    prep: '30 seconds to think. 60 to take it apart.',
    startAttack: 'Start your 60s answer',
    startDefend: 'Start defence',
    newMotion: 'New question',
    recorded: 'Recorded run',
    point: (n) => 'Point ' + n,
    listening: 'Listening…',
    micHint: 'Speak toward the laptop.',
    camLoading: 'Getting the camera ready…',
    camBlocked: "Camera is off. You can still practise; we'll skip the delivery notes.",
    camBlockedBtn: 'Practise without camera',
    micBlocked: "We can't hear you. Allow the microphone, or type your answer.",
    typeInstead: 'Type instead',
    noWords: "We didn't catch any words. Try again a little louder.",
    titleBroke: "Here's where it broke",
    titleHolds: 'It holds.',
    holds: 'Holds',
    breaks: 'Breaks',
    hintTitle: 'One question before you try again',
    tryAgain: 'Try again',
    seeHeard: 'See what the check heard',
    delivery: 'Your delivery',
    footer: (model, cost) => 'Checked by ' + model + ' on GMI · ' + cost,
    slow: 'The check is taking a bit longer…',
    judgeError: "The check couldn't answer this time.",
    useRecorded: 'Use the recorded example',
    lowConf: 'Your coach will go through this one with you.',
    coachLine: 'Your coach will go through this one with you.',
    secondTitle: 'Second try',
    fixed: (n) => 'Fixed in ' + n + ' tries.',
    closer: 'Closer. One more try?',
    showModel: 'Show a sentence starter',
    compareHelper: 'Compare it with yours.',
    faceChange: (a, b) => 'Face touches: ' + a + ' → ' + b,
    nextMotion: 'Next question',
    coachTitle: 'Your class this week',
    sample: 'SAMPLE',
    mostCommon: 'Most common break',
    review: 'Office hours',
    officeHours: 'Who needs ten minutes with me',
    reviewHelper: "Students who need a check-in with you.",
    officeHoursHelper: "Students who need a check-in with you.",
    agree: 'Agree',
    disagree: 'Disagree',
    // Homework (copy.md "Homework link", "Student entry", "Coach view")
    hwCreate: 'Create homework link',
    hwMotion: "Tonight's question",
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
    pnLabel: 'Note for parent',
    pnPh: 'One or two plain sentences a parent can read in 20 seconds.',
    pnSave: 'Save',
    pnSaved: 'Saved.',
    pnCopy: 'Copy parent link',
    pnCopied: 'Parent link copied.',
    pnError: "That didn't save. Try again.",
    pnCount: (n) => n + ' / 280',
    pTitle: (n) => n + ' · This week · Think Aloud',
    pQuestion: "Tonight's question",
    pDid: 'What they did',
    pTries: (n) => n + (n === 1 ? ' try' : ' tries'),
    pWeak: 'Weak spot on the first try',
    pCoach: 'From the coach',
    pNoNote: 'No note yet',
    pAsk: 'Ask at home',
    pWrote: 'What they wrote back',
    pNoAnswer: 'Not answered yet.',
    pFoot: 'Only people with this link can see this page. It shows first name only.',
    pBad: "This link doesn't work. Ask the coach for a new one.",
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
    oneWay: 'A sentence to start with',
    heardTitle: 'What the check heard',
    classList: 'Class',
    colStudent: 'Student',
    colBreak: 'Last break',
    colTries: 'Tries',
    aiSaid: 'The AI said',
    reviewEmpty: 'Nothing to check right now.',
    saved: (v) => (v === 'agree' ? 'You agreed.' : 'You disagreed.'),
    classError: "The class list couldn't load.",
    // What's next preview
    whatsNext: "What's next",
    nextSubline: "AI finds the gap. People close it. These are the next ways we send kids to people.",
    previewNotBuilt: "Preview · not built yet",
    backToCoach: "← Class overview",
    classOverviewTab: "Class overview",
    cardSmallGroupTitle: "Small-group rounds",
    cardSmallGroupLine: "Three kids, one question. Each one challenges another's answer.",
    cardBookTitle: "Book ten minutes",
    cardBookLine: "One-on-one or small-group office hours with the coach, booked from the kid's weak spot.",
    cardCommunityTitle: "Community questions",
    cardCommunityLine: "Homework that sends kids to a real person: a grandparent, a shop owner, a neighbour.",
    moreKinds: 'More kinds of homework',
    moreKindsSub: 'Same loop, different practice: say it, fix it, take it to a person.',
    cardPitchTitle: 'Pitch it',
    cardPitchLine: 'Sell an idea in 60 seconds. An AI customer pushes back.',
    cardNegotiateTitle: 'Negotiate',
    cardNegotiateLine: 'Strike a deal with an AI counterpart who wants something different.',
    cardTeamTitle: 'Team case',
    cardTeamLine: 'Two kids, one hard situation. They talk it through with a character and solve it together.',
    sideNote: 'Even with an AI assistant open, a kid still has to show up, say it out loud and answer the follow-up. The practice happens either way.'
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
      hint: "If that number were true, would it change anyone's mind? Why?"
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
      hint: 'Which of your two answers would hurt their case most?',
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
    motion: 'Should middle schools ban phones in class?',
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
    },
    take_home: "Ask someone at home: when did a phone help you learn something, and when did it get in the way?"
  }];

  // SAMPLE office hours items for the coach view when the real queue is empty (never real students).
  const SAMPLE_OFFICE_HOURS = [
    {
      id: 'sample-oh-1',
      student: 'Student B',
      name: 'SAMPLE Student B',
      motion: 'Phones in class',
      motion_id: 'phones',
      break_label: 'No link',
      tries: 2,
      reason: 'Not fixed in 2 tries',
      sample: true,
      transcript: SAMPLE_TRANSCRIPTS[2].transcript,
      result: { break: { type: 'no_link', label: 'No link' }, confidence: 0.8 }
    },
    {
      id: 'sample-oh-2',
      student: 'Student D',
      name: 'SAMPLE Student D',
      motion: 'Phones in class',
      motion_id: 'phones',
      break_label: 'Switched arguments while defending',
      tries: 1,
      reason: "The AI wasn't sure",
      sample: true,
      transcript: SAMPLE_TRANSCRIPTS[3].transcript,
      result: { break: { type: 'new_argument_while_defending', label: 'Switched arguments while defending' }, confidence: 0.47 }
    }
  ];
  const SAMPLE_REVIEW = SAMPLE_OFFICE_HOURS;

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
    hw: { motionId: null, mode: 'attack', link: null, busy: false, error: '' },
    nextSelected: 0,
    nextMoreSelected: null
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
    if (type === 'dropped_argument' && engine) return engine;
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
    const model = r.model || (state.health && state.health.model) || 'the AI model';
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
    if (r.name === 'next') { show('next'); renderNext(); return; }
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

  function updateTopbar(name) {
    const crumb = $('#crumb'), who = $('#who');
    if (!crumb || !who) return;
    const m = currentMotion();
    const hw = state.assignment && state.student;
    const n = name === 'report' || name === 'second' ? (state.attempts.length || 1) : (state.live ? state.live.attempt : 1);
    if (hw && m && name !== 'coach' && name !== 'motion') {
      crumb.textContent = 'Homework · ' + motionShort(m, null) + ' · Try ' + n;
      $('#who-initial').textContent = state.student.charAt(0).toUpperCase();
      $('#who-name').textContent = state.student;
      who.hidden = false;
    } else {
      crumb.textContent = hw && m ? 'Homework · ' + motionShort(m, null) : '';
      if (hw) { $('#who-initial').textContent = state.student.charAt(0).toUpperCase(); $('#who-name').textContent = state.student; who.hidden = false; } else who.hidden = true;
    }
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
    document.title = name === 'coach' ? 'Think Aloud · Coach view' : name === 'next' ? "Think Aloud · What's next" : 'Think Aloud';
    updateTopbar(name);
    if (prev !== name) {
      window.scrollTo(0, 0);
      const main = $('#main');
      if (main && name !== 'live') main.focus({ preventScroll: true });
    }
  }

  // ---------------------------------------------------------------- 1. motion card
  function pointCards(m, mode) {
    const ln = (k, v) => hasText(v) ? h('div', { class: 'ln' }, h('b', null, k), h('span', null, v)) : null;
    if (mode === 'defend') {
      const att = attackOn(m) || {};
      return h('div', { class: 'pts' },
        h('div', { class: 'pt' }, h('span', { class: 'label' }, T.yourPoint), h('div', { class: 'claim' }, textOf(att.target))),
        h('div', { class: 'pt' }, h('span', { class: 'label' }, T.theirAttack), h('div', { class: 'claim' }, textOf(att.attack))));
    }
    if (mode === 'challenge') {
      const ch = (m && m.challenge) || {};
      return h('div', { class: 'pts' },
        h('div', { class: 'pt' }, h('span', { class: 'label' }, T.yourPoint), h('div', { class: 'claim' }, textOf(ch.claim))),
        h('div', { class: 'pt' }, h('span', { class: 'label' }, T.theChallenge), h('div', { class: 'claim' }, textOf(ch.question))));
    }
    const args = argsOf(m);
    return h('div', { class: 'pts' + (args.length === 1 ? ' is-single' : '') },
      args.map((a, i) => h('div', { class: 'pt' },
        h('span', { class: 'label' }, T.point(i + 1)),
        h('div', { class: 'claim' }, textOf(a.claim)),
        ln('REASON', a.reason), ln('EVIDENCE', a.evidence), ln('IMPACT', a.impact))));
  }

  function renderMotion() {
    const root = $('#screen-motion');
    root.textContent = '';
    const loadingHw = state.assignment && !state.assignment.data && !state.assignment.error;
    if (!state.motions.length || loadingHw) {
      root.append(h('div', { class: 'skeleton', 'aria-busy': 'true' },
        h('div', { class: 'skel', style: { 'max-width': '160px' } }), h('div', { class: 'skel lg' }),
        h('div', { class: 'pts' }, h('div', { class: 'skel card-skel' }), h('div', { class: 'skel card-skel' }))));
      return;
    }
    const hwk = state.assignment;
    if (hwk && hwk.error) {
      root.append(h('div', { class: 'state-panel', role: 'alert' }, h('span', { class: 'label' }, T.hwEyebrow), h('h1', null, T.hwBadLink)));
      return;
    }
    const m = currentMotion();
    const modes = availableModes(m);
    const mode = state.mode;
    const pairModes = !hwk && modes.indexOf('attack') >= 0 && modes.indexOf('defend') >= 0;
    const needName = !!(hwk && !state.student);

    const toggle = pairModes ? h('div', { class: 'modes', role: 'group', 'aria-label': 'Exchange' },
      h('button', { type: 'button', 'aria-pressed': String(mode === 'attack'), onclick: () => setMode('attack') }, T.modeAttack),
      h('button', { type: 'button', 'aria-pressed': String(mode === 'defend'), onclick: () => setMode('defend') }, T.modeDefend)) : null;
    const modeHelp = pairModes ? h('p', { class: 'mode-help' }, mode === 'defend' ? T.helperDefend : T.helperAttack) : null;

    const startBtn = h('button', { type: 'button', class: 'btn primary', id: 'btn-start', onclick: () => startLive() },
      mode === 'defend' ? T.startDefend : T.startAttack, h('span', { class: 'arrow', 'aria-hidden': 'true' }, '→'));
    const go = needName ? null : h('div', { class: 'go' },
      h('div', { class: 'ring', 'aria-hidden': 'true' }, '1:00'),
      startBtn,
      hwk ? null : h('button', { type: 'button', class: 'btn btn-text', onclick: startRecorded }, T.recorded),
      (!hwk && state.motions.length > 1) ? h('button', { type: 'button', class: 'btn btn-text', id: 'btn-new-motion', 'aria-expanded': String(state.pickerOpen), 'aria-controls': 'motion-picker', onclick: togglePicker }, T.newMotion) : null,
      mode === 'attack' ? h('span', { class: 'help' }, T.prep) : null);

    const card = h('section', { class: 'panel mc', 'aria-label': T.eyebrow },
      h('span', { class: 'zhmark', 'aria-hidden': 'true' }, '開口'),
      h('div', { class: 'mc-eyebrow' },
        h('span', { class: 'label' }, hwk ? T.hwEyebrow : T.eyebrow),
        h('span', { class: 'chip holds' }, T.youArgue(sideLabel(m.side)))),
      h('h1', { class: 'pitch', id: 'pitch-title' }, 'Homework you do out loud.'),
      h('p', { class: 'pitch-sub' }, "AI can write the essay. It can't think out loud for you. Say your answer, get challenged, fix the weak spot, then take the question home."),
      h('p', { class: 'small pitch-note' }, T.sideNote),
      h('h2', { class: 'q-line', id: 'motion-title' }, m.motion),
      toggle, modeHelp,
      h('div', null, h('span', { class: 'label' }, mode === 'defend' ? T.theirAttack : (mode === 'challenge' ? T.theChallenge : T.theirArgument))),
      pointCards(m, mode),
      go);

    let side = null;
    if (needName) {
      // homework link: ask for a first name once, then start that motion and mode
      const input = h('input', { id: 'hw-name', type: 'text', name: 'given-name', autocomplete: 'given-name', maxlength: '30', placeholder: T.hwNamePh, required: true, 'aria-labelledby': 'hw-name-label', 'aria-describedby': 'hw-name-help' });
      side = h('aside', { class: 'panel entry', 'aria-label': T.hwEyebrow },
        h('span', { class: 'label' }, T.hwEyebrow),
        h('h2', null, "Who's practising?"),
        h('form', {
          class: 'field', novalidate: true,
          onsubmit: (e) => {
            e.preventDefault();
            const name = input.value.trim().split(/\s+/)[0] || '';
            if (!name) { input.focus(); input.setAttribute('aria-invalid', 'true'); return; }
            state.student = name.slice(0, 30);
            try { localStorage.setItem('bp-student-' + hwk.id, state.student); } catch (err) { /* private window */ }
            startLive();
          }
        },
          h('label', { for: 'hw-name', id: 'hw-name-label', class: 'field-label' }, T.hwName),
          input,
          h('p', { class: 'small', id: 'hw-name-help' }, T.hwNameHelper),
          h('button', { type: 'submit', class: 'btn primary', style: { 'justify-self': 'start' } }, T.hwStart)),
        h('p', { class: 'small priv-foot' }, "Your camera video never leaves this device. Your voice is transcribed by the browser's speech service."));
    } else if (state.pickerOpen && !hwk) {
      side = h('aside', { class: 'panel entry', id: 'motion-picker', 'aria-label': T.newMotion },
        h('span', { class: 'label' }, T.newMotion),
        h('div', { class: 'picker' },
          state.motions.map((mm) => h('button', { type: 'button', 'aria-pressed': String(mm.id === m.id), onclick: () => pickMotion(mm.id) },
            h('span', { class: 'small' }, sideLabel(mm.side)), h('span', null, mm.motion)))));
    }

    root.append(h('div', { class: 'stage' + (side ? '' : ' is-solo') }, card, side));
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
    const b = $('.modes button[aria-pressed="true"]');
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
    $('#live-status').classList.toggle('is-idle', !!idle);
  }
  function liveMsg(text, actions) {
    const box = $('#live-msg');
    if (!text) { box.hidden = true; return; }
    $('#live-msg-text').textContent = text;
    const acts = $('#live-msg-actions');
    acts.textContent = '';
    (actions || []).forEach((a) => acts.append(h('button', { type: 'button', class: 'btn ' + (a.primary ? 'primary' : 'ghost'), onclick: a.onclick }, a.label)));
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
    argsOf(m).forEach((a, i) => { add(el, [h('span', { class: 'lp' }, T.point(i + 1) + ': ', h('b', null, a.claim))]); });
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
    startAscii(L);
    await initBody(L);
    if (L !== state.live) return;
    runLive(L);
  }

  // The camera as glowing text (design: live.html). The real <video> stays in the page, hidden,
  // because body tracking reads its frames. Nothing here leaves the browser.
  function startAscii(L) {
    const v = $('#cam-video'), pre = $('#ascii');
    if (!v || !pre) return;
    const W = 96, H = 50, chars = ' .:-=+*#%@';
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const g = c.getContext('2d', { willReadFrequently: true });
    const ratio = (W * 8.1) / (H * 11); // the text block's shape on screen
    let last = 0;
    function frame(now) {
      if (state.live !== L || L.ended || !L.stream) { pre.textContent = ''; return; }
      L.asciiRaf = requestAnimationFrame(frame);
      if (now - last < 80 || v.readyState < 2 || !v.videoWidth) return;
      last = now;
      try {
        const vw = v.videoWidth, vh = v.videoHeight;
        const sw = Math.min(vw, vh * ratio), sh = Math.min(vh, vw / ratio);
        g.save(); g.translate(W, 0); g.scale(-1, 1);
        g.drawImage(v, (vw - sw) / 2, (vh - sh) / 2, sw, sh, 0, 0, W, H);
        g.restore();
        const d = g.getImageData(0, 0, W, H).data;
        let out = '';
        for (let y = 0; y < H; y++) {
          for (let x = 0; x < W; x++) {
            const i = (y * W + x) * 4;
            const lum = (0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]) / 255;
            out += chars[Math.min(chars.length - 1, Math.floor(Math.pow(lum, 0.85) * chars.length))];
          }
          out += '\n';
        }
        pre.textContent = out;
      } catch (e) { /* frame not ready yet */ }
    }
    L.asciiRaf = requestAnimationFrame(frame);
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
    submitAttempt({ transcript: text, body: L.body, sampleBody: false, recorded: false, typed: !!L.typed });
  }

  function stopCamera(L) {
    if (L && L.stream) { L.stream.getTracks().forEach((t) => { try { t.stop(); } catch (e) { /* ignore */ } }); L.stream = null; }
    const v = $('#cam-video');
    if (v) v.srcObject = null;
    if (L && L.asciiRaf) { cancelAnimationFrame(L.asciiRaf); L.asciiRaf = 0; }
    const pre = $('#ascii');
    if (pre) pre.textContent = '';
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
      recorded: !!P.recorded, typed: !!P.typed, sampleId: P.sampleId || null, mode: state.mode, motionId: m.id
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
      transcript: entry.transcript, recorded: entry.recorded, typed: !!entry.typed, attempt: n,
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
    if (view.chainBox) drawChain(view.chainBox, motionById(a.motionId) || currentMotion(), a.result, a.mode);
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
        h('button', { type: 'button', class: 'btn primary', onclick: () => { const P = state.pending; if (!P) return; P.failed = false; P.slow = false; renderReport(); runAnalyze(); } }, T.tryAgain),
        state.assignment ? null : h('button', { type: 'button', class: 'btn ghost', onclick: useRecordedExample }, T.useRecorded)));
  }

  // One row per opponent point: their point, a wire, the student's answer (design: report.html).
  function pointRows(motion, r, anim) {
    const brk = r.break || {};
    const type = breakType(r);
    const unsure = isUnsure(r);
    const attacks = Array.isArray(r.attacks) ? r.attacks : [];
    const both = type === 'dropped_argument' && /both/i.test(String(brk.label || ''));
    return argsOf(motion).map((arg, i) => {
      const mine = attacks.filter((x) => x.arg === arg.id);
      const best = mine.find((x) => x.holds) || mine[0] || null;
      const isBreak = !unsure && type !== 'none' && type !== 'not_a_rebuttal' && (brk.arg === arg.id || both);
      const dropped = isBreak && type === 'dropped_argument';
      const d = { '--d': (anim ? 250 + i * 450 : 0) + 'ms' };
      const their = h('div', { class: 'their' },
        h('span', { class: 'label' }, 'Their point ' + (i + 1)),
        h('div', { class: 'claim' }, textOf(arg.claim)),
        h('div', { class: 'links' },
          hasText(arg.reason) ? h('div', { class: 'ln' }, h('b', null, 'REASON'), h('span', null, arg.reason)) : null,
          hasText(arg.evidence) ? h('div', { class: 'ln' }, h('b', null, 'EVIDENCE'), h('span', null, arg.evidence)) : null,
          hasText(arg.impact) ? h('div', { class: 'ln' }, h('b', null, 'IMPACT'), h('span', null, arg.impact)) : null));
      let wire, yours;
      if (isBreak) {
        wire = h('div', { class: 'wire cut', style: d }, h('span', { class: 'w-line' }), h('span', { class: 'warm' }), h('span', { class: 'ember big', 'aria-hidden': 'true' }));
        yours = h('div', { class: 'yours empty', style: d },
          h('span', { class: 'chip breaks', style: { 'align-self': 'flex-start' } }, h('span', { class: 'ember', 'aria-hidden': 'true' }), T.breaks),
          h('div', { class: 'what' }, breakLabel(brk, 'attack')),
          (!dropped && best) ? h('div', { class: 'quote' }, best.quote) : null,
          breakWhy(brk) ? h('div', { class: 'why' }, breakWhy(brk)) : null);
      } else if (best) {
        const holds = !!best.holds;
        wire = h('div', { class: 'wire ' + (holds ? 'ok' : 'open'), style: d }, h('span', { class: 'w-line' }), holds ? h('span', { class: 'w-end' }) : null);
        yours = h('div', { class: 'yours', style: d },
          h('div', { class: 'yours-head' }, h('span', { class: 'label' }, 'Your answer'),
            holds ? h('span', { class: 'chip holds' }, h('span', { class: 'tick', 'aria-hidden': 'true' }), T.holds)
              : h('span', { class: 'chip standing' }, 'Not yet')),
          h('div', { class: 'quote' }, best.quote));
      } else {
        wire = h('div', { class: 'wire open', style: d }, h('span', { class: 'w-line' }));
        yours = h('div', { class: 'yours empty', style: d },
          h('span', { class: 'chip standing', style: { 'align-self': 'flex-start' } }, 'Still standing'),
          h('div', { class: 'why' }, 'No answer to this point yet.'));
      }
      return h('div', { class: 'rrow' }, their, wire, yours);
    });
  }

  function takeHomeCard(motion, attempt) {
    const q = (motion && motion.take_home) || 'Ask someone at home: when did a phone help you learn something, and when did it get in the way?';
    const card = h('section', { class: 'panel take-home-card', 'aria-labelledby': 'th-title' });
    let saidText = '';
    let changedVal = '';
    let status = 'idle'; // 'idle' | 'saving' | 'saved' | 'skipped'
    let errorMsg = '';

    function paint() {
      card.textContent = '';
      if (status === 'skipped') {
        card.append(h('div', { class: 'th-skipped' },
          h('span', { class: 'muted' }, 'Take-home question skipped for now.'),
          h('button', { type: 'button', class: 'btn ghost btn-sm', onclick: () => { status = 'idle'; paint(); } }, 'Open question')));
        return;
      }
      if (status === 'saved') {
        card.append(h('div', { class: 'th-saved', role: 'status' },
          h('div', { class: 'th-head' },
            h('span', { class: 'chip chip-hold' }, h('span', { class: 'tick', 'aria-hidden': 'true' }), 'Saved'),
            h('h2', { id: 'th-title', class: 'th-title' }, 'Take it home: ask someone tonight')),
          h('p', { class: 'th-q' }, q),
          saidText ? h('p', { class: 'th-ans' }, '“' + saidText + '”') : null,
          changedVal ? h('p', { class: 'muted' }, 'Did it change your view? ' + changedVal) : null));
        return;
      }

      const choices = ['No', 'A little', 'Yes'];
      const choiceGroup = h('div', { class: 'th-choices', role: 'group', 'aria-label': 'Did it change your view?' },
        choices.map((c) => h('button', {
          type: 'button',
          class: 'btn ' + (changedVal === c ? 'primary' : 'ghost') + ' th-choice-btn',
          'aria-pressed': String(changedVal === c),
          onclick: () => { changedVal = c; paint(); }
        }, c)));

      const textarea = h('textarea', {
        id: 'th-said',
        class: 'th-textarea',
        rows: 3,
        placeholder: 'Type what they told you…',
        oninput: (e) => { saidText = e.target.value; }
      });
      textarea.value = saidText;

      async function saveTakeHome() {
        if (status === 'saving') return;
        status = 'saving';
        errorMsg = '';
        paint();
        try {
          await postJSON('/api/takehome', {
            assignment_id: state.assignment ? state.assignment.id : null,
            student: (state.assignment && state.student) ? state.student : (state.student || 'You'),
            motion_id: (motion && motion.id) || state.motionId,
            said: saidText.trim(),
            changed: changedVal
          }, 8000);
          status = 'saved';
        } catch (err) {
          status = 'idle';
          errorMsg = "Couldn't save right now. Try again.";
        }
        paint();
      }

      function skipTakeHome() {
        status = 'skipped';
        paint();
      }

      add(card, [
        h('div', { class: 'th-head' },
          h('h2', { id: 'th-title', class: 'th-title' }, 'Take it home: ask someone tonight')),
        h('p', { class: 'th-q' }, q),
        h('div', { class: 'field' },
          h('label', { for: 'th-said', class: 'field-label' }, 'What did they say?'),
          textarea),
        h('div', { class: 'field' },
          h('span', { class: 'field-label' }, 'Did it change your view?'),
          choiceGroup),
        errorMsg ? h('p', { class: 'hw-error', role: 'alert' }, errorMsg) : null,
        h('div', { class: 'th-actions' },
          h('button', { type: 'button', class: 'btn primary', 'aria-busy': status === 'saving' ? 'true' : null, onclick: saveTakeHome }, 'Save'),
          h('button', { type: 'button', class: 'btn ghost', onclick: skipTakeHome }, 'Skip for now'))
      ]);
    }

    paint();
    return card;
  }

  function reportView(a) {
    const r = a.result;
    const brk = r.break || {};
    const type = breakType(r);
    const none = type === 'none';
    const unsure = isUnsure(r);
    const n = state.attempts.indexOf(a) + 1 || r.attempt || 1;
    const anim = !reducedMotion();
    const motion = motionById(a.motionId) || currentMotion();
    const useRows = a.mode !== 'defend' && argsOf(motion).length > 0 && !(motion && motion.kind === 'challenge');

    let h1;
    if (unsure) h1 = h('h1', { class: 'is-unsure' }, T.coachLine);
    else if (none) h1 = h('h1', null, T.titleHolds);
    else if (type === 'not_a_rebuttal') h1 = h('h1', { class: 'is-unsure' }, brk.label);
    else h1 = h('h1', null, T.titleBroke, h('span', { class: 'ember big', 'aria-hidden': 'true' }));
    const sub = type === 'not_a_rebuttal' ? (brk.why || '') : (hasText(r.landed) ? r.landed.trim() : '');

    let chainBox = null;
    let body;
    if (useRows) {
      body = h('div', { class: 'rows' }, pointRows(motion, r, anim));
    } else {
      chainBox = h('div', { class: 'chain-box' });
      body = h('div', { class: 'rows' },
        (!none && !unsure) ? h('div', { class: 'yours empty' },
          h('span', { class: 'chip breaks', style: { 'align-self': 'flex-start' } }, h('span', { class: 'ember', 'aria-hidden': 'true' }), T.breaks),
          h('div', { class: 'what' }, breakLabel(brk, a.mode)),
          breakWhy(brk) ? h('div', { class: 'why' }, breakWhy(brk)) : null) : null,
        chainBox);
    }

    const heardText = h('p', { class: 'is-clamped' }, '“' + a.transcript + '”');
    const heard = h('div', { class: 'heard' },
      h('span', { class: 'label' }, T.heardTitle), heardText,
      h('span', { class: 'heard-note' }, a.recorded ? 'sample speech (recorded run)' : a.typed ? 'typed by you' : "transcribed by the browser's speech service"));
    const heardBtn = h('button', {
      type: 'button', class: 'btn ghost', 'aria-expanded': 'false',
      onclick: (e) => { const open = heardText.classList.toggle('is-clamped'); e.currentTarget.setAttribute('aria-expanded', String(!open)); heard.scrollIntoView({ block: 'nearest', behavior: anim ? 'smooth' : 'auto' }); }
    }, T.seeHeard);

    const hint = hasText(r.hint) ? r.hint.trim() : ((BREAK_COPY[type] && BREAK_COPY[type].hint) || '');
    const done = none && !unsure;
    const primary = done
      ? (state.assignment ? doneLine() : h('button', { type: 'button', class: 'btn primary', onclick: nextMotion }, T.nextMotion, h('span', { class: 'arrow', 'aria-hidden': 'true' }, '→')))
      : h('button', { type: 'button', class: 'btn primary', onclick: () => tryAgain(a) }, T.tryAgain, h('span', { class: 'arrow', 'aria-hidden': 'true' }, '→'));
    const again = done ? h('button', { type: 'button', class: 'btn ghost', onclick: () => tryAgain(a) }, T.tryAgain) : null;

    const side = h('aside', { class: 'panel rp-hint', 'aria-label': T.hintTitle },
      h('span', { class: 'label' }, done ? 'One more question' : T.hintTitle),
      hint ? h('q', null, hint) : null,
      (!done && n === 1) ? h('p', { class: 'lock' }, h('span', { class: 'kbd' }, 'after 1 retry'), 'Model answer unlocks after you try once more.') : null,
      h('div', { class: 'tries' },
        [1, 2, 3].map((k) => h('span', { class: 'dot' + (k <= n ? ' on' : '') })),
        h('span', { class: 'tries-l' }, done ? 'Try ' + n + ' · it holds' : 'Try ' + n + ' · fix it in your own words')),
      h('p', { class: 'why-ask' }, 'We ask instead of telling. Tutors that hand over answers can leave students worse off once the tool is gone (Bastani et al., ', h('i', null, 'PNAS'), ', 2025).'),
      h('div', { class: 'actions' }, primary, again));

    const delivery = a.body ? deliveryView(a.body, { sample: a.sampleBody }) : null;

    const el = h('div', { class: 'rp' + (anim ? ' anim' : '') },
      h('section', { class: 'panel rp-map', 'aria-label': 'Argument map' },
        h('div', { class: 'rp-head' },
          h('div', null, h1, sub ? h('p', { class: 'rp-sub' }, sub) : null),
          h('div', { class: 'badges' },
            a.recorded ? h('span', { class: 'badge' }, T.recorded) : null,
            n > 1 ? h('span', { class: 'badge' }, 'Try ' + n) : null)),
        body, heard,
        done ? takeHomeCard(motion, a) : null),
      side,
      delivery,
      h('footer', { class: 'rp-foot' }, h('span', null, footerText(r)), a.recorded && r.source !== 'replay' ? h('span', null, T.recorded + ' · sample speech') : null));
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
      n: Number(m.n) || 0,
      type: m.type,
      label: m.label || MARK_LABEL[m.type] || ''
    }));
    const lines = deliveryLines(body);
    if (!marks.length && !lines.length) return null;
    // the second label drops below the axis when two marks sit close together
    const close = marks.length === 2 && Math.abs(marks[0].sec - marks[1].sec) < 22;
    const time = h('div', { class: 'time' + (close ? ' has-below' : ''), role: 'img', 'aria-label': 'Timeline 0:00 to 1:00' + (marks.length ? ': ' + marks.map((m) => m.t + ' ' + m.label).join(', ') : '') },
      h('div', { class: 'axis' }),
      h('div', { class: 'ticks' }, ['0:00', '0:15', '0:30', '0:45', '1:00'].map((t) => h('span', null, t))),
      marks.map((m, i) => {
        const p = m.sec / 60;
        const text = (m.type === 'face_touch' && m.n > 1) ? m.label + ' ×' + m.n : m.t + ' · ' + m.label;
        return h('div', { class: 'mark' + (p < 0.15 ? ' is-start' : p > 0.85 ? ' is-end' : '') + (close && i === 1 ? ' is-below' : ''), style: { '--p': String(p) } }, h('b', null, text), h('i'));
      }));
    const count = marks.length;
    return h('section', { class: 'panel rp-strip', 'aria-label': T.delivery },
      h('div', null,
        h('span', { class: 'label' }, T.delivery),
        h('div', { class: 'strip-sub' }, count + (count === 1 ? ' note' : ' notes') + ' · on this device'),
        opts.sample ? h('span', { class: 'badge', style: { 'margin-top': '8px', display: 'inline-block' } }, T.sample) : null),
      time,
      h('div', { class: 'notes' }, lines.map((l) => h('p', null, l))));
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
  // One try as a column (design: retry.html): their points, a wire, what the student said.
  function tryColumn(motion, attempt, n, isAfter, firstBody) {
    const r = attempt.result;
    const brk = r.break || {};
    const type = breakType(r);
    const unsure = isUnsure(r);
    const ok = type === 'none' && !unsure;
    const attacks = Array.isArray(r.attacks) ? r.attacks : [];
    const both = type === 'dropped_argument' && /both/i.test(String(brk.label || ''));
    const rows = (attempt.mode !== 'defend' && !(motion && motion.kind === 'challenge')) ? argsOf(motion).map((arg, i) => {
      const mine = attacks.filter((x) => x.arg === arg.id);
      const best = mine.find((x) => x.holds) || mine[0] || null;
      const isBreak = !unsure && type !== 'none' && (brk.arg === arg.id || both);
      const their = h('div', { class: 'rt-card' }, h('span', { class: 'label' }, 'Their point ' + (i + 1)), h('span', { class: 'claim' }, textOf(arg.claim)));
      let wire, yours;
      if (isBreak) {
        wire = h('div', { class: 'wire cut' }, h('span', { class: 'w-line' }), h('span', { class: 'ember', 'aria-hidden': 'true' }));
        yours = h('div', { class: 'rt-card empty' }, breakLabel(brk, 'attack'));
      } else if (best) {
        wire = h('div', { class: 'wire ' + (best.holds ? 'ok' : 'open') }, h('span', { class: 'w-line' }), best.holds ? h('span', { class: 'w-end' }) : null);
        yours = h('div', { class: 'rt-card' }, h('span', { class: 'clamp' }, '“' + best.quote + '”'));
      } else {
        wire = h('div', { class: 'wire open' }, h('span', { class: 'w-line' }));
        yours = h('div', { class: 'rt-card empty' }, 'No answer yet');
      }
      return h('div', { class: 'rt-pt' }, their, wire, yours);
    }) : [h('div', { class: 'rt-card' + (ok ? '' : ' empty') }, ok ? breakLabel(brk, attempt.mode) : breakLabel(brk, attempt.mode))];

    const note = ok ? (hasText(r.landed) ? r.landed.trim() : breakLabel(brk, attempt.mode))
      : unsure ? T.lowConf
        : (breakWhy(brk) || breakLabel(brk, attempt.mode));
    const body = attempt.body;
    const deliv = [];
    if (body) {
      const face = isAfter ? faceChangeText(firstBody, body) : null;
      if (face) {
        const parts = face.split(':');
        deliv.push(h('span', null, parts[0], ' ', h('b', null, (parts[1] || '').trim())));
      } else {
        (body.marks || []).slice(0, 2).forEach((m) => {
          const cnt = Number(m.n) || 0;
          deliv.push(m.type === 'face_touch' && cnt > 1
            ? h('span', null, (m.label || MARK_LABEL[m.type] || '') + ' ', h('b', null, '×' + cnt))
            : h('span', null, (m.t != null ? m.t + ' ' : ''), h('b', null, String(m.label || MARK_LABEL[m.type] || '').toLowerCase())));
        });
      }
      if (isAfter && !(body.marks || []).some((m) => m.type === 'slouch')) deliv.push(h('span', null, 'Posture ', h('b', null, 'held')));
    }
    return h('section', { class: 'panel rt-col ' + (isAfter ? 'after' : 'before'), 'aria-label': 'Try ' + n },
      h('h2', null, 'Try ' + n,
        ok ? h('span', { class: 'chip holds' }, h('span', { class: 'tick', 'aria-hidden': 'true' }), T.holds)
          : unsure ? h('span', { class: 'chip standing' }, 'Check with coach')
            : h('span', { class: 'chip breaks' }, h('span', { class: 'ember', 'aria-hidden': 'true' }), T.breaks)),
      rows,
      h('p', { class: 'jn' }, h('span', { class: 'label' }, "The check's note"), note),
      deliv.length ? h('div', { class: 'deliv' }, deliv, (attempt.sampleBody ? h('span', { class: 'badge' }, T.sample) : null)) : null);
  }

  function renderSecond() {
    const root = $('#screen-second');
    root.textContent = '';
    const first = state.attempts[0];
    const latest = state.attempts[state.attempts.length - 1];
    if (!first || !latest) { go('motion', { replace: true }); return; }
    const r1 = first.result, r2 = latest.result;
    const n = state.attempts.length;
    const fixed = breakType(r2) === 'none';
    const unsure = isUnsure(r2);
    const firstHeld = breakType(r1) === 'none';
    const motion = motionById(latest.motionId) || currentMotion();
    const ruleFired = unsure || (!fixed && n >= 2);

    let big;
    if (ruleFired) big = h('div', { class: 'big' }, h('b', null, T.coachLine));
    else if (fixed && !firstHeld) big = h('div', { class: 'big' }, h('b', null, T.fixed(n)), argsOf(motion).length > 1 && latest.mode !== 'defend' ? ' Both points answered.' : '');
    else if (fixed) big = h('div', { class: 'big' }, h('b', null, T.titleHolds));
    else big = h('div', { class: 'big' }, h('b', null, T.closer));

    const hint = (!fixed && hasText(r2.hint)) ? r2.hint.trim() : '';
    const modelId = 'model-answer';
    const model = (!fixed && hasText(r2.model_answer) && n >= 2)
      ? h('section', { class: 'panel model-answer', id: modelId, hidden: true },
        h('span', { class: 'label' }, T.oneWay), h('p', { class: 'ma-text' }, r2.model_answer.trim()), h('p', { class: 'small' }, T.compareHelper))
      : null;

    const arrow = () => h('span', { class: 'arrow', 'aria-hidden': 'true' }, '→');
    const btns = fixed
      ? [state.assignment ? doneLine() : h('button', { type: 'button', class: 'btn primary', onclick: nextMotion }, T.nextMotion, arrow())]
      : [
        model ? h('button', {
          type: 'button', class: 'btn ghost', 'aria-expanded': 'false', 'aria-controls': modelId,
          onclick: (e) => { const open = model.hidden; model.hidden = !open; e.currentTarget.setAttribute('aria-expanded', String(open)); }
        }, T.showModel) : null,
        state.assignment ? null : h('button', { type: 'button', class: 'btn ghost', onclick: nextMotion }, T.nextMotion),
        h('button', { type: 'button', class: 'btn primary', onclick: () => tryAgain(latest) }, T.tryAgain, arrow())
      ];
    const noteText = fixed ? footerText(r2) : (hint || (model ? 'Model answer is now unlocked: compare it with yours.' : ''));

    root.append(h('div', { class: 'rt' + (reducedMotion() ? '' : ' anim') },
      h('div', { class: 'rt-head' },
        h('h1', null, T.secondTitle),
        h('div', null, big,
          h('div', { class: 'badges', style: { 'justify-content': 'flex-end', 'margin-top': '8px' } },
            latest.recorded ? h('span', { class: 'badge' }, T.recorded) : null))),
      h('div', { class: 'rt-cols' },
        tryColumn(motion, first, 1, false, null),
        tryColumn(motion, latest, n, true, first.body)),
      takeHomeCard(motion, latest),
      h('div', { class: 'rt-bottom' }, h('span', { class: 'note' }, noteText), h('div', { class: 'btns' }, btns)),
      model,
      fixed ? null : h('footer', { class: 'rp-foot' }, h('span', null, footerText(r2)))));
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
    const listBox = h('section', { class: 'panel hw-list', 'aria-busy': 'true' }, h('div', { class: 'wait-line', 'aria-hidden': 'true' }));
    const classBox = h('div', { class: 'coach-col', 'aria-busy': 'true' }, h('div', { class: 'wait-line', 'aria-hidden': 'true' }));
    root.append(h('div', { class: 'coach' },
      h('div', { class: 'coach-bar' },
        h('h1', { class: 'sr-only' }, 'Coach view'),
        h('nav', { class: 'coach-tabs', 'aria-label': 'Coach navigation' },
          h('span', { class: 'coach-tab is-active', 'aria-current': 'page' }, T.classOverviewTab),
          h('a', { href: '#next', class: 'coach-tab', onclick: (e) => { e.preventDefault(); go('next'); } }, T.whatsNext)
        )
      ),
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
    const card = h('section', { class: 'panel hw-card', 'aria-labelledby': 'hw-card-title' });

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
        ? h('div', { class: 'modes', role: 'group', 'aria-labelledby': 'hw-mode-label' }, modes.map((md) =>
          h('button', { type: 'button', 'aria-pressed': String(md === hw.mode), onclick: () => { hw.mode = md; hw.link = null; paint(); const b = $('.hw-card .modes button[aria-pressed="true"]'); if (b) b.focus(); } }, md === 'defend' ? T.modeDefend : T.modeAttack)))
        : h('p', { class: 'muted' }, hw.mode === 'defend' ? T.modeDefend : T.modeAttack);
      add(card, [
        h('div', { class: 'coach-head' }, h('h2', { id: 'hw-card-title' }, T.hwLinkLabel)),
        h('div', { class: 'field' }, h('label', { for: 'hw-motion', class: 'field-label' }, T.hwMotion), select),
        h('div', { class: 'field' }, h('span', { class: 'field-label', id: 'hw-mode-label' }, T.hwMode), modeCtl),
        h('div', { class: 'hw-create' },
          h('button', { type: 'button', class: 'btn primary', 'aria-busy': hw.busy ? 'true' : null, onclick: createLink }, T.hwCreate),
          h('span', { class: 'help' }, T.hwHelper)),
        hw.error ? h('p', { class: 'hw-error', role: 'alert' }, hw.error) : null,
        hw.link ? h('div', { class: 'hw-link' },
          h('label', { for: 'hw-url', class: 'sr-only' }, T.hwLinkLabel),
          h('input', { id: 'hw-url', class: 'mono', type: 'text', readonly: true, value: hw.link, onfocus: (e) => e.target.select() }),
          h('button', { type: 'button', class: 'btn ghost', onclick: copyLink }, T.hwCopy)) : null
      ]);
    }
    paint();
    return card;
  }

  function submissionLine(s) {
    const tries = Number(s.tries) || 0;
    const head = (s.name || 'Student') + ' · ' + T.hwTries(tries) + ' · ' + (s.typed ? 'Typed' : 'Spoken');
    if (!s.first_break) return [head];
    if (s.first_break === 'none') return [head + ' · ' + T.hwHeld];
    const first = shortLabel(s.first_break);
    if (s.fixed) return [head + ' · ' + first + ' → ', h('span', { class: 'chip chip-hold' }, T.hwFixed)];
    if (tries <= 1 || !s.last_break) return [head + ' · ' + first];
    return [head + ' · ' + first + ' → ' + shortLabel(s.last_break)];
  }

  // Coach side of the parent page: a short note per student per assignment, and the link to send.
  function parentNoteControl(assignmentId, sub) {
    const name = typeof sub.name === 'string' ? sub.name : '';
    if (!name) return null;
    const uid = 'pn-' + assignmentId + '-' + name.replace(/[^A-Za-z0-9]/g, '_');
    const input = h('textarea', { id: uid, class: 'pn-input', rows: 2, maxlength: 280, placeholder: T.pnPh, spellcheck: 'true' });
    input.value = typeof sub.note === 'string' ? sub.note : '';
    const count = h('span', { class: 'helper pn-count' }, T.pnCount(input.value.length));
    const status = h('span', { class: 'helper', role: 'status' });
    input.addEventListener('input', () => { count.textContent = T.pnCount(input.value.length); status.textContent = ''; });
    const busy = [];
    async function send(after) {
      busy.forEach((b) => { b.disabled = true; });
      status.textContent = '';
      try {
        const r = await postJSON('/api/parent-note', { assignment_id: assignmentId, student: name, note: input.value }, 8000);
        if (!r || typeof r.url !== 'string') throw new Error('no link');
        await after(r);
      } catch (e) { status.textContent = T.pnError; }
      busy.forEach((b) => { b.disabled = false; });
    }
    const save = h('button', { type: 'button', class: 'btn ghost pn-btn', onclick: () => send(() => { status.textContent = T.pnSaved; }) }, T.pnSave);
    const copy = h('button', { type: 'button', class: 'btn ghost pn-btn', onclick: () => send(async (r) => {
      let ok = false;
      try { if (navigator.clipboard && navigator.clipboard.writeText) { await navigator.clipboard.writeText(r.url); ok = true; } } catch (e) { ok = false; }
      if (ok) toast(T.pnCopied); else { status.textContent = r.url; }
    }) }, T.pnCopy);
    busy.push(save, copy);
    return h('div', { class: 'pn' },
      h('label', { for: uid, class: 'field-label' }, T.pnLabel),
      input,
      h('div', { class: 'pn-row' }, save, copy, count, status));
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
        subs.length ? h('ul', { class: 'hw-subs is-hero' }, subs.map((s) => h('li', null, submissionLine(s), parentNoteControl(a.id, s)))) : null,
        top ? h('p', { class: 'hw-foot' }, T.hwFirstBreak(shortLabel(top), firsts[top])) : null));
    });
  }

  function firstName(s) {
    if (!s) return 'Student';
    const clean = String(s).replace(/^SAMPLE\s+/i, '').trim();
    return clean.split(/\s+/)[0] || 'Student';
  }

  function fillSampleClass(box, data) {
    box.removeAttribute('aria-busy');
    box.textContent = '';
    if (!data || !Array.isArray(data.students)) {
      box.append(h('div', { class: 'card' }, h('p', { class: 'muted' }, T.classError),
        h('div', { class: 'state-actions', style: { 'margin-top': '12px' } }, h('button', { type: 'button', class: 'btn ghost', onclick: renderCoach }, T.tryAgain))));
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

    let review = Array.isArray(data.office_hours || data.review) ? (data.office_hours || data.review).filter((x) => x && !x.verdict) : [];
    if (!review.length) review = SAMPLE_OFFICE_HOURS;
    const reviewCard = h('section', { class: 'card', 'aria-labelledby': 'office-hours' },
      h('h2', { class: 'eyebrow', id: 'office-hours' }, T.officeHours),
      h('p', { class: 'helper', style: { 'margin-top': '4px' } }, T.officeHoursHelper),
      h('ul', { class: 'review-list' }, review.slice(0, 6).map(reviewItem)));

    const tookCount = (data.took_home_count != null) ? data.took_home_count : (data.students || []).filter((s) => hasText(s.said)).length;
    const classCard = h('section', { class: 'card', 'aria-labelledby': 'class-list' },
      h('div', { class: 'coach-head', style: { 'margin-bottom': '12px' } },
        h('h2', { class: 'eyebrow', id: 'class-list' }, T.classList),
        h('span', { class: 'badge took-home-badge' }, 'Took it home: ' + tookCount),
        h('span', { class: 'badge' }, T.sample)),
      h('table', { class: 'ctable' },
        h('thead', null, h('tr', null, h('th', { scope: 'col' }, T.colStudent), h('th', { scope: 'col' }, T.colBreak), h('th', { scope: 'col', class: 'num' }, T.colTries))),
        h('tbody', null, data.students.map((s) => h('tr', null,
          h('td', null,
            h('div', { class: 's-name' }, s.name || ''),
            hasText(s.said) ? h('p', { class: 's-takehome' }, '“' + s.said + '”') : null),
          h('td', null, s.last_break === 'none' ? h('span', { class: 'chip chip-hold' }, T.holds) : shortLabel(s.last_break)),
          h('td', { class: 'num' }, s.tries != null ? String(s.tries) : ''))))));

    add(box, [reviewCard, classCard, breaksCard]);
    requestAnimationFrame(() => requestAnimationFrame(() => {
      $$('.bar-fill', box).forEach((b) => b.style.setProperty('--w', b.getAttribute('data-w')));
    }));
  }

  function reviewItem(item) {
    const r = item.result || {};
    const brk = r.break || {};
    const m = motionById(item.motion_id);
    const motionName = item.motion || motionShort(m) || item.motion_id || 'Question';
    const sName = firstName(item.student || item.name || 'Student');
    const label = item.break_label || breakLabel(brk, item.mode);
    const triesCount = item.tries || item.attempt || 1;
    const triesLabel = triesCount + (triesCount === 1 ? ' try' : ' tries');
    const reasonLabel = item.reason || (isUnsure(r) ? "The AI wasn't sure" : "Not fixed in 2 tries");

    const actions = h('div', { class: 'review-actions' });
    function paintActions() {
      actions.textContent = '';
      const v = state.reviewed[item.id];
      if (v) { actions.append(h('p', { class: 'review-done', role: 'status' }, T.saved(v))); return; }
      ['agree', 'disagree'].forEach((verdict) => {
        actions.append(h('button', {
          type: 'button', class: 'btn ghost',
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
        h('span', { class: 'r-name' }, sName),
        h('span', { class: 'r-motion' }, motionName),
        item.sample ? h('span', { class: 'badge' }, T.sample) : null),
      h('p', { class: 'r-verdict' },
        h('span', { class: 'chip chip-break' }, label),
        h('span', { class: 'chip chip-standing r-tries' }, triesLabel),
        h('span', { class: 'chip chip-standing r-reason' }, reasonLabel)),
      hasText(item.transcript) ? h('p', { class: 'r-quote' }, '“' + item.transcript + '”') : null,
      actions);
  }

  // ---------------------------------------------------------------- parent page (/p/<token>)
  async function renderParent(token) {
    const root = $('#screen-parent');
    root.textContent = '';
    let d = null;
    try { d = await getJSON('/api/parent/' + encodeURIComponent(token), 8000); } catch (e) { d = null; }
    if (!d || typeof d.first_name !== 'string') {
      root.append(h('div', { class: 'parent' }, h('section', { class: 'card' }, h('p', { class: 'muted' }, T.pBad))));
      return;
    }
    const ask = d.ask_at_home || {};
    const section = (id, title, kids) => h('section', { class: 'card pr-card', 'aria-labelledby': id },
      h('h2', { class: 'eyebrow', id: id }, title), kids);
    document.title = T.pTitle(d.first_name);
    const tries = Number(d.tries) || 0;
    root.append(h('div', { class: 'parent' },
      h('h1', { class: 'pr-title' }, T.pTitle(d.first_name)),
      section('pr-q', T.pQuestion, h('p', { class: 'pr-big' }, typeof d.question === 'string' ? d.question : '')),
      section('pr-did', T.pDid, tries
        ? h('ul', { class: 'pr-list' },
          h('li', null, T.pTries(tries) + ' · ' + (d.how === 'Typed' ? 'Typed' : 'Spoken')),
          hasText(d.weak_spot) ? h('li', null, h('b', null, T.pWeak + ': '), d.weak_spot) : null,
          hasText(d.outcome) ? h('li', null, d.fixed ? h('span', { class: 'chip chip-hold' }, d.outcome) : d.outcome) : null)
        : h('p', { class: 'muted' }, hasText(d.outcome) ? d.outcome : '')),
      section('pr-coach', T.pCoach, hasText(d.coach_note) ? h('p', { class: 'pr-note' }, d.coach_note) : h('p', { class: 'muted' }, T.pNoNote)),
      section('pr-ask', T.pAsk,
        [hasText(ask.question) ? h('p', { class: 'pr-big' }, ask.question) : null,
          h('p', { class: 'eyebrow pr-sub' }, T.pWrote),
          hasText(ask.answer) ? h('p', { class: 'pr-note' }, '“' + ask.answer + '”') : h('p', { class: 'muted' }, T.pNoAnswer)]),
      h('p', { class: 'helper pr-foot' }, T.pFoot)));
  }

  // ---------------------------------------------------------------- 6. What's next preview
  const NEXT_CARDS = [
    {
      id: 'small-group',
      title: 'Small-group rounds',
      line: "Three kids, one question. Each one challenges another's answer.",
      render: renderSmallGroupPanel
    },
    {
      id: 'book-ten-minutes',
      title: 'Book ten minutes',
      line: "One-on-one or small-group office hours with the coach, booked from the kid's weak spot.",
      render: renderBookPanel
    },
    {
      id: 'community-questions',
      title: 'Community questions',
      line: "Homework that sends kids to a real person: a grandparent, a shop owner, a neighbour.",
      render: renderCommunityPanel
    }
  ];

  function renderSmallGroupPanel() {
    return h('section', { id: 'next-panel-content', class: 'panel next-preview-panel', 'aria-labelledby': 'sgr-panel-title' },
      h('div', { class: 'next-panel-header' },
        h('div', { class: 'next-panel-title-group' },
          h('h3', { id: 'sgr-panel-title', class: 'next-panel-title serif' }, T.cardSmallGroupTitle),
          h('span', { class: 'badge preview-badge' }, T.previewNotBuilt),
          h('span', { class: 'badge' }, T.sample)
        ),
        h('p', { class: 'muted next-panel-desc' }, T.cardSmallGroupLine)
      ),
      h('div', { class: 'sgr-round-card' },
        h('div', { class: 'sgr-students-row', 'aria-label': 'Sample round' },
          h('div', { class: 'sgr-student' },
            h('span', { class: 'avatar', 'aria-hidden': 'true' }, 'A'),
            h('span', { class: 'sgr-name' }, 'Amy'),
            h('span', { class: 'badge sample-tag' }, T.sample)
          ),
          h('div', { class: 'sgr-arrow', 'aria-hidden': 'true' },
            h('span', { class: 'sgr-arrow-text' }, 'challenges'),
            h('span', { class: 'sgr-arrow-icon' }, '→')
          ),
          h('div', { class: 'sgr-student' },
            h('span', { class: 'avatar', 'aria-hidden': 'true' }, 'B'),
            h('span', { class: 'sgr-name' }, 'Ben'),
            h('span', { class: 'badge sample-tag' }, T.sample)
          ),
          h('div', { class: 'sgr-arrow', 'aria-hidden': 'true' },
            h('span', { class: 'sgr-arrow-text' }, 'challenges'),
            h('span', { class: 'sgr-arrow-icon' }, '→')
          ),
          h('div', { class: 'sgr-student' },
            h('span', { class: 'avatar', 'aria-hidden': 'true' }, 'C'),
            h('span', { class: 'sgr-name' }, 'Chloe'),
            h('span', { class: 'badge sample-tag' }, T.sample)
          )
        ),
        h('div', { class: 'sgr-loop-note', 'aria-hidden': 'true' },
          h('span', { class: 'sgr-loop-icon' }, '↩'),
          h('span', null, 'Chloe challenges Amy to complete the round.')
        ),
        h('div', { class: 'sgr-challenge' },
          h('span', { class: 'label' }, 'Sample challenge line'),
          h('p', { class: 'sgr-quote' }, '“Amy challenges Ben: If phones are banned for everyone, how do kids who take the bus alone reach home safely?”')
        )
      )
    );
  }

  function renderBookPanel() {
    const slots = ['Tue 4:00 pm', 'Wed 4:30 pm', 'Fri 5:00 pm'];
    return h('section', { id: 'next-panel-content', class: 'panel next-preview-panel', 'aria-labelledby': 'bk-panel-title' },
      h('div', { class: 'next-panel-header' },
        h('div', { class: 'next-panel-title-group' },
          h('h3', { id: 'bk-panel-title', class: 'next-panel-title serif' }, T.cardBookTitle),
          h('span', { class: 'badge preview-badge' }, T.previewNotBuilt),
          h('span', { class: 'badge' }, T.sample)
        ),
        h('p', { class: 'muted next-panel-desc' }, T.cardBookLine)
      ),
      h('article', { class: 'pv-note-card' },
        h('div', { class: 'pv-note-head' },
          h('span', { class: 'label' }, 'Sample time slots'),
          h('span', { class: 'badge' }, T.sample)
        ),
        h('ul', { class: 'bk-slots' }, slots.map((t) => h('li', { class: 'bk-slot' }, t))),
        h('p', { class: 'pv-body' }, 'Suggested because: second point left standing')
      )
    );
  }

  function renderCommunityPanel() {
    return h('section', { id: 'next-panel-content', class: 'panel next-preview-panel', 'aria-labelledby': 'cq-panel-title' },
      h('div', { class: 'next-panel-header' },
        h('div', { class: 'next-panel-title-group' },
          h('h3', { id: 'cq-panel-title', class: 'next-panel-title serif' }, T.cardCommunityTitle),
          h('span', { class: 'badge preview-badge' }, T.previewNotBuilt),
          h('span', { class: 'badge' }, T.sample)
        ),
        h('p', { class: 'muted next-panel-desc' }, T.cardCommunityLine)
      ),
      h('article', { class: 'cq-task-card' },
        h('div', { class: 'cq-task-header' },
          h('span', { class: 'label' }, 'Task card · Sample only'),
          h('span', { class: 'badge' }, T.sample)
        ),
        h('h4', { class: 'cq-task-title serif' }, 'Ask someone who was at school before phones existed'),
        h('p', { class: 'cq-task-sub muted' }, 'Find a grandparent, neighbour, or shop owner. Ask them how people made plans or stayed in touch before phones existed.'),
        h('div', { class: 'field cq-box-field' },
          h('label', { for: 'cq-sample-box', class: 'field-label' }, 'What did they say?'),
          h('textarea', {
            id: 'cq-sample-box',
            rows: 3,
            disabled: true,
            class: 'cq-sample-textarea mono',
            readonly: true
          }, 'My grandmother told me: “If you wanted to meet friends after class, you agreed on a spot before leaving school. If someone was late, you waited ten minutes and then went ahead.”'),
          h('p', { class: 'cq-disabled-note muted' }, 'Disabled · sample only')
        )
      )
    );
  }

  // More kinds of homework: same loop, different practice (samples only)
  const NEXT_MORE_CARDS = [
    { id: 'pitch-it', title: 'Pitch it', line: T.cardPitchLine, render: renderPitchPanel },
    { id: 'negotiate', title: 'Negotiate', line: T.cardNegotiateLine, render: renderNegotiatePanel },
    { id: 'team-case', title: 'Team case', line: T.cardTeamLine, render: renderTeamPanel }
  ];

  function morePanelHead(idBase, title, line) {
    return h('div', { class: 'next-panel-header' },
      h('div', { class: 'next-panel-title-group' },
        h('h3', { id: idBase + '-panel-title', class: 'next-panel-title serif' }, title),
        h('span', { class: 'badge preview-badge' }, T.previewNotBuilt),
        h('span', { class: 'badge' }, T.sample)
      ),
      h('p', { class: 'muted next-panel-desc' }, line)
    );
  }

  function renderPitchPanel() {
    return h('section', { id: 'next-more-panel-content', class: 'panel next-preview-panel', 'aria-labelledby': 'pi-panel-title' },
      morePanelHead('pi', T.cardPitchTitle, T.cardPitchLine),
      h('div', { class: 'mk-chat' },
        h('div', { class: 'mk-bubble them' },
          h('span', { class: 'label' }, 'AI customer · Sample'),
          h('p', null, '“Why would I pay for that?”')),
        h('div', { class: 'mk-bubble you' },
          h('span', { class: 'label' }, 'Kid’s reply · Sample'),
          h('p', null, '“It’s a lunchbox that keeps food cold for six hours. It has two parts and it folds flat.”'))
      ),
      h('div', { class: 'mk-weak' },
        h('span', { class: 'label' }, 'The one weak spot'),
        h('p', null, 'You said what it is, not why they need it.'))
    );
  }

  function renderNegotiatePanel() {
    return h('section', { id: 'next-more-panel-content', class: 'panel next-preview-panel', 'aria-labelledby': 'ng-panel-title' },
      morePanelHead('ng', T.cardNegotiateTitle, T.cardNegotiateLine),
      h('div', { class: 'mk-sides' },
        h('article', { class: 'mk-side' },
          h('span', { class: 'label' }, 'You want'),
          h('p', null, 'The class runs the school snack stall on Fridays.')),
        h('article', { class: 'mk-side' },
          h('span', { class: 'label' }, 'The AI counterpart wants'),
          h('p', null, 'The stall for the art club, to raise money for paint.'))
      ),
      h('div', { class: 'mk-chat' },
        h('div', { class: 'mk-bubble you' },
          h('span', { class: 'label' }, 'Offer · Sample'),
          h('p', null, '“We take Fridays, and we give the art club 10% of what we make.”')),
        h('div', { class: 'mk-bubble them' },
          h('span', { class: 'label' }, 'Counter-offer · Sample'),
          h('p', null, '“We need Fridays more than money. What if we take every second Friday?”'))
      ),
      h('p', { class: 'mk-hint' }, 'Hint: ask what matters most to them.')
    );
  }

  const TEAM_LINE = 'The class trip budget is short by 2,000. What do we cut?';
  const TEAM_CHOICES = [
    { text: 'Take the train, not the bus', reply: 'The train saves 1,200. We are still 800 short. What else?' },
    { text: 'Skip the museum tickets', reply: 'That covers it, but the museum was the reason for the trip. Is that worth it?' },
    { text: 'Ask each family for 100 more', reply: 'Some families can pay that, some can’t. How do we make it fair?' }
  ];
  let teamTimer = null;

  function typeLine(el, text) {
    if (teamTimer) { clearInterval(teamTimer); teamTimer = null; }
    if (reducedMotion()) { el.textContent = text; return; }
    let i = 0;
    el.textContent = '';
    teamTimer = setInterval(() => {
      i += 1;
      el.textContent = text.slice(0, i);
      if (i >= text.length) { clearInterval(teamTimer); teamTimer = null; }
    }, 28);
  }

  function teamCharacter() {
    const ns = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('viewBox', '0 0 64 64');
    svg.setAttribute('class', 'tc-face');
    svg.setAttribute('aria-hidden', 'true');
    [['circle', { cx: 32, cy: 24, r: 13 }], ['path', { d: 'M10 62c0-14 10-22 22-22s22 8 22 22z' }],
      ['circle', { cx: 27, cy: 23, r: 1.6, class: 'eye' }], ['circle', { cx: 37, cy: 23, r: 1.6, class: 'eye' }],
      ['path', { d: 'M27 30q5 3 10 0', class: 'mouth' }]].forEach(([tag, attrs]) => {
      const el = document.createElementNS(ns, tag);
      Object.keys(attrs).forEach((k) => el.setAttribute(k, String(attrs[k])));
      svg.append(el);
    });
    return svg;
  }

  function renderTeamPanel() {
    const says = h('p', { class: 'tc-says', 'aria-live': 'polite' });
    const after = h('div', { class: 'tc-after', hidden: true });
    const choices = TEAM_CHOICES.map((c) => h('button', {
      type: 'button',
      class: 'btn ghost tc-choice',
      onclick: (e) => {
        choices.forEach((b) => b.setAttribute('aria-pressed', String(b === e.currentTarget)));
        typeLine(says, c.reply);
        after.hidden = false;
      }
    }, c.text));
    choices.forEach((b) => b.setAttribute('aria-pressed', 'false'));
    after.append(h('p', { class: 'tc-typing' }, h('span', { class: 'tc-dots', 'aria-hidden': 'true' }), 'Your teammate Ben is typing…'));

    const panel = h('section', { id: 'next-more-panel-content', class: 'panel next-preview-panel', 'aria-labelledby': 'tc-panel-title' },
      morePanelHead('tc', T.cardTeamTitle, T.cardTeamLine),
      h('div', { class: 'tc-scene' },
        h('div', { class: 'tc-char' },
          teamCharacter(),
          h('span', { class: 'tc-name' }, 'Mr Chen'),
          h('span', { class: 'small' }, 'Trip organiser · Sample')),
        h('div', { class: 'tc-bubble' }, says)
      ),
      h('div', { class: 'tc-choices', role: 'group', 'aria-label': 'Sample answers' }, choices),
      h('p', { class: 'tc-own' }, micIcon(), 'Or say your own answer'),
      after
    );
    typeLine(says, TEAM_LINE);
    return panel;
  }

  function micIcon() {
    const ns = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('class', 'tc-mic');
    svg.setAttribute('aria-hidden', 'true');
    const p = document.createElementNS(ns, 'path');
    p.setAttribute('d', 'M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3zM6 11a6 6 0 0 0 12 0M12 17v4M9 21h6');
    svg.append(p);
    return svg;
  }

  function renderNext() {
    const root = $('#screen-next');
    if (!root) return;
    root.textContent = '';

    const navBar = h('div', { class: 'next-bar' },
      h('nav', { class: 'coach-tabs', 'aria-label': 'Coach navigation' },
        h('a', { href: '#coach', class: 'coach-tab', onclick: (e) => { e.preventDefault(); go('coach'); } }, T.backToCoach),
        h('span', { class: 'coach-tab is-active', 'aria-current': 'page' }, T.whatsNext)
      )
    );

    const head = h('header', { class: 'next-head' },
      h('div', { class: 'next-title-row' },
        h('h1', { class: 'next-heading' }, T.whatsNext),
        h('span', { class: 'badge preview-badge' }, T.previewNotBuilt)
      ),
      h('p', { class: 'next-subline' }, T.nextSubline)
    );

    const cardsContainer = h('div', { class: 'next-cards', role: 'region', 'aria-label': "What's next preview cards" });
    NEXT_CARDS.forEach((card, idx) => {
      cardsContainer.append(nextCard(card, state.nextSelected === idx, 'next-panel-container', () => {
        state.nextSelected = state.nextSelected === idx ? null : idx;
      }));
    });

    const panelContainer = h('div', { id: 'next-panel-container', class: 'next-panel-container' });
    if (state.nextSelected != null && NEXT_CARDS[state.nextSelected]) {
      panelContainer.append(NEXT_CARDS[state.nextSelected].render());
    } else {
      panelContainer.append(
        h('div', { class: 'panel next-empty-panel' },
          h('p', { class: 'muted' }, 'Select a card above to see its preview.')
        )
      );
    }

    if (teamTimer) { clearInterval(teamTimer); teamTimer = null; }
    const moreHead = h('header', { class: 'next-head next-more-head' },
      h('h2', { class: 'next-more-heading' }, T.moreKinds),
      h('p', { class: 'next-subline' }, T.moreKindsSub)
    );
    const moreCards = h('div', { class: 'next-cards', role: 'region', 'aria-label': 'More kinds of homework preview cards' });
    NEXT_MORE_CARDS.forEach((card, idx) => {
      moreCards.append(nextCard(card, state.nextMoreSelected === idx, 'next-more-panel-container', () => {
        state.nextMoreSelected = state.nextMoreSelected === idx ? null : idx;
      }));
    });
    const morePanel = h('div', { id: 'next-more-panel-container', class: 'next-panel-container' });
    if (state.nextMoreSelected != null && NEXT_MORE_CARDS[state.nextMoreSelected]) {
      morePanel.append(NEXT_MORE_CARDS[state.nextMoreSelected].render());
    }

    const wrap = h('div', { class: 'next-screen-wrap' }, navBar, head, cardsContainer, panelContainer, moreHead, moreCards, morePanel);
    root.append(wrap);
    // re-rendering replaces the cards: put keyboard focus back on the one just clicked
    const f = state.nextFocus && root.querySelector('[data-card="' + state.nextFocus + '"]');
    state.nextFocus = null;
    if (f) f.focus();
  }

  function nextCard(card, isSelected, controls, toggle) {
    return h('button', {
      type: 'button',
      class: 'card next-card' + (isSelected ? ' is-active' : ''),
      'data-card': card.id,
      'aria-expanded': String(isSelected),
      'aria-controls': controls,
      onclick: () => {
        toggle();
        state.nextFocus = card.id;
        renderNext();
      }
    },
      h('div', { class: 'next-card-top' },
        h('span', { class: 'badge preview-badge' }, T.previewNotBuilt),
        isSelected ? h('span', { class: 'badge is-active-badge' }, 'Open') : null
      ),
      h('h2', { class: 'next-card-title' }, card.title),
      h('p', { class: 'next-card-desc' }, card.line),
      h('span', { class: 'next-card-hint' }, isSelected ? 'Close preview' : 'Click to preview →')
    );
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
    // A parent link: /p/<token> shows one calm page and nothing else of the app.
    const pm = location.pathname.match(/^\/p\/([A-Za-z0-9_-]+)\/?$/);
    if (pm) {
      const nav = $('#topnav'); if (nav) nav.hidden = true;
      const brand = $('.brand'); if (brand) brand.removeAttribute('href');
      $$('.screen').forEach((sc) => { sc.hidden = sc.getAttribute('data-screen') !== 'parent'; });
      state.screen = 'parent';
      renderParent(pm[1]);
      return;
    }
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
    if ((first.name === 'coach' || first.name === 'next') && !state.assignment) route(); else { show('motion'); renderMotion(); }
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
    if (p.name === 'motion' || p.name === 'coach' || p.name === 'next') route();
    else go('motion', { replace: true });
    // Team check and screenshots only: ?demo=dropped runs the recorded sample into the report,
    // ?demo=retry also runs the second try. Everything it shows is labelled "Recorded run".
    const demo = new URLSearchParams(location.search).get('demo');
    if (demo === 'dropped' || demo === 'retry') {
      startRecorded();
      if (demo === 'retry') {
        const t = setInterval(() => {
          if (state.pending) return;
          if (state.attempts.length === 1) tryAgain(state.attempts[0]);
          else if (state.attempts.length >= 2) clearInterval(t);
        }, 400);
      }
    }
  }

  // Exposed for the team's console checks only.
  window.BreakpointUI = { state: state, runRecorded: runRecorded, go: go };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
