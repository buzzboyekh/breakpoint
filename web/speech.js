/* Breakpoint speech: a small wrapper around Chrome's webkitSpeechRecognition (owner: ui).
   window.Speech = {
     supported,                        // true when the browser has speech recognition
     start(onText, onState) -> bool,   // onText(text, {segments, interim}); onState({type, message})
     stop()   -> text,                 // stops now, returns the words so far (final + last interim)
     finish() -> Promise<text>,        // stops and waits (max 900 ms) for the last words to settle
     abort(),                          // stops and drops everything
     text()   -> text
   }
   onState types: listening | hearing | no-speech | mic-blocked | network | unsupported | error.
   Messages are the exact strings from copy.md. */
(function () {
  'use strict';

  var SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  var MSG = {
    listening: 'Listening…',
    micBlocked: "We can't hear you. Allow the microphone, or type your answer.",
    noWords: "We didn't catch any words. Try again a little louder."
  };

  var rec = null;            // current recogniser
  var recording = false;     // true while the speaker should be heard
  var fatal = false;         // permission or device error: stop restarting
  var heardAny = false;
  var committed = [];        // final phrases from earlier recogniser sessions
  var sessionFinal = [];     // final phrases from the current session
  var interim = '';
  var restarts = [];
  var endWaiters = [];
  var onTextCb = null;
  var onStateCb = null;

  function clean(s) { return String(s || '').replace(/\s+/g, ' ').trim(); }

  function fullText() {
    var parts = committed.concat(sessionFinal);
    if (interim) parts.push(interim);
    return clean(parts.join(' '));
  }

  function segments() {
    var out = committed.concat(sessionFinal).map(function (t) { return { text: clean(t), final: true }; });
    if (clean(interim)) out.push({ text: clean(interim), final: false });
    return out.filter(function (s) { return s.text; });
  }

  function emitText() {
    if (!onTextCb) return;
    try { onTextCb(fullText(), { segments: segments(), interim: clean(interim) }); } catch (e) { console.error(e); }
  }

  function emitState(type, message) {
    if (!onStateCb) return;
    try { onStateCb({ type: type, message: message || '' }); } catch (e) { console.error(e); }
  }

  function flushEnd() {
    var t = fullText();
    var w = endWaiters; endWaiters = [];
    w.forEach(function (fn) { try { fn(t); } catch (e) { /* ignore */ } });
  }

  function build() {
    var r = new SR();
    r.lang = 'en-US';
    r.continuous = true;
    r.interimResults = true;
    r.maxAlternatives = 1;

    r.onstart = function () { if (r === rec && recording) emitState('listening', MSG.listening); };

    r.onresult = function (e) {
      if (r !== rec) return;
      var f = [], im = '';
      for (var i = 0; i < e.results.length; i++) {
        var res = e.results[i];
        var t = res && res[0] ? res[0].transcript : '';
        if (res.isFinal) { if (clean(t)) f.push(clean(t)); } else { im += t; }
      }
      sessionFinal = f;
      interim = clean(im);
      if (!heardAny && fullText()) { heardAny = true; emitState('hearing', ''); }
      emitText();
    };

    r.onerror = function (e) {
      if (r !== rec) return;
      var err = e && e.error;
      if (err === 'aborted') return;
      if (err === 'no-speech') { if (!heardAny) emitState('no-speech', MSG.noWords); return; }
      if (err === 'not-allowed' || err === 'service-not-allowed' || err === 'audio-capture') {
        fatal = true;
        emitState('mic-blocked', MSG.micBlocked);
        return;
      }
      if (err === 'network') { emitState('network', MSG.micBlocked); return; } // may recover on restart
      emitState('error', MSG.micBlocked);
    };

    r.onend = function () {
      if (r !== rec) return;
      // fold this session's words into the committed list before any restart
      committed = committed.concat(sessionFinal);
      if (interim) committed.push(interim);
      sessionFinal = []; interim = '';
      if (recording && !fatal) {
        var now = Date.now();
        restarts = restarts.filter(function (t) { return now - t < 10000; });
        restarts.push(now);
        if (restarts.length > 8) { // the recogniser keeps dying: give up and offer typing
          fatal = true;
          emitState('mic-blocked', MSG.micBlocked);
          flushEnd();
          return;
        }
        setTimeout(function () {
          if (recording && r === rec) { try { r.start(); } catch (x) { /* already running */ } }
        }, 120);
        return;
      }
      emitText();
      flushEnd();
    };
    return r;
  }

  var Speech = {
    supported: !!SR,
    messages: MSG,

    start: function (onText, onState) {
      onTextCb = typeof onText === 'function' ? onText : null;
      onStateCb = typeof onState === 'function' ? onState : null;
      committed = []; sessionFinal = []; interim = ''; restarts = [];
      fatal = false; heardAny = false;
      if (!SR) { emitState('unsupported', MSG.micBlocked); return false; }
      if (rec) { try { rec.abort(); } catch (e) { /* ignore */ } }
      rec = build();
      recording = true;
      try { rec.start(); } catch (e) { emitState('error', MSG.micBlocked); return false; }
      return true;
    },

    stop: function () {
      var t = fullText();
      recording = false;
      if (rec) { try { rec.stop(); } catch (e) { /* ignore */ } }
      return t;
    },

    finish: function () {
      var wasRunning = recording && !!rec;
      var t = this.stop();
      if (!wasRunning) return Promise.resolve(t);
      return new Promise(function (resolve) {
        var done = false;
        function once(v) { if (!done) { done = true; resolve(clean(v) || t); } }
        endWaiters.push(once);
        setTimeout(function () { once(fullText()); }, 900);
      });
    },

    abort: function () {
      recording = false;
      onTextCb = null; onStateCb = null;
      if (rec) { try { rec.abort(); } catch (e) { /* ignore */ } }
      flushEnd();
    },

    text: fullText
  };

  window.Speech = Speech;
})();
