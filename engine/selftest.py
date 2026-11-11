#!/usr/bin/env python3
"""Breakpoint engine selftest (Python 3.9 stdlib). Never prints the key.

  python3 engine/selftest.py                 replay run + offline guard tests, plus a live run if a GMI key exists
  python3 engine/selftest.py --replay        replay run + guard tests only (no network)
  python3 engine/selftest.py --models a,b    live run of every SAMPLE on each model (latency, tokens)
  python3 engine/selftest.py --live-only     skip replay and guards
Exit code 0 when every check passes.
"""
import argparse
import json
import os
import pathlib
import sys
import time

ROOT = pathlib.Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from engine import analyze as A          # noqa: E402
from engine import gmi                   # noqa: E402
from engine import motions as M          # noqa: E402

SAMPLES = json.loads((ROOT / "samples" / "transcripts.json").read_text(encoding="utf-8"))
FAILS = []


def check(ok, what):
    if not ok:
        FAILS.append(what)
    return ok


def contract_problems(res, transcript, motion, attempt):
    p = []
    for k in ("attempt", "attacks", "links", "break", "hint", "landed", "confidence", "model_answer",
              "source", "model", "tokens", "ms"):
        if k not in res:
            p.append("missing " + k)
    if p:
        return p
    n_args = len(motion["opponent"]["args"])
    if len(res["links"]) != 4 * n_args:
        p.append("links has %d entries, want %d" % (len(res["links"]), 4 * n_args))
    for ln in res["links"]:
        if ln.get("status") not in ("untouched", "attacked", "broken"):
            p.append("bad link status %r" % ln.get("status"))
    low = " ".join(transcript.lower().split())
    for a in res["attacks"]:
        if " ".join(a["quote"].lower().split()) not in low:
            p.append("attack quote not in transcript: %r" % a["quote"][:60])
    h = res["hint"]
    if len(h.split()) > 20 or not h.endswith("?"):
        p.append("hint breaks the rule (<=20 words, ends with ?): %r" % h)
    if not (0 <= res["confidence"] <= 1):
        p.append("confidence out of range")
    broken = res["break"]["type"] != "none"
    if res["model_answer"] is not None:
        if attempt < 2 or not broken:
            p.append("model_answer present but attempt < 2 or not broken")
        elif len(res["model_answer"].split()) > 40:
            p.append("model_answer over 40 words")
    if '"' not in res["break"]["why"]:
        p.append("why does not quote the student")
    return p


def run_samples(title, model=None, replay=False):
    if model:
        os.environ["BREAKPOINT_MODEL"] = model
    else:
        os.environ.pop("BREAKPOINT_MODEL", None)
    print("\n== %s" % title)
    rows, total_ms, all_right, n_right = [], 0, True, 0
    for s in SAMPLES:
        if replay and not (A.REPLAY_DIR / ("%s.json" % s["id"])).exists():
            print("  %-22s live only (no recorded run), skipped in replay" % s["id"])
            continue
        motion = M.get_motion(s["motion_id"])
        req = {"motion_id": s["motion_id"], "motion": motion, "transcript": s["transcript"],
               "attempt": s.get("attempt", 1), "mode": s.get("mode", "attack"), "previous": None}
        if replay:
            req["replay"] = True
        t = time.time()
        res = A.analyze(req)
        ms = int((time.time() - t) * 1000)
        total_ms += ms
        if "error" in res:
            all_right = False
            check(False, "%s [%s]: error %s" % (s["id"], title, res["error"]))
            print("  %-22s expected %-28s ERROR %s (%d ms)" % (s["id"], s["expected_break"], res["error"], ms))
            continue
        b = res["break"]
        got = b["type"] + ((" " + b["arg"]) if b.get("arg") else "")
        right = b["type"] == s["expected_break"]
        if s["id"] == "phones-attack-dropped":
            right = right and b.get("arg") == "A2"          # the demo's money shot
        calls = (A.last_trace or {}).get("calls") or []
        extra = []
        if not replay:
            if res.get("source") != "gmi":                  # a live run that fell back is a failure
                right = False
                got += " (FELL BACK TO REPLAY: %s)" % (A.last_trace or {}).get("fallback_reason", "?")
            extra.append("      calls: " + ", ".join(
                "%s %s %d ms%s" % (c["kind"], c.get("model") or "", c["ms"],
                                   (" ERROR " + c["error"]) if c.get("error") else "") for c in calls))
            fc = (A.last_trace or {}).get("first_check") or {}
            if fc.get("hard") or fc.get("soft"):
                extra.append("      first answer failed checks: %s" % "; ".join((fc.get("hard") or []) + (fc.get("soft") or [])))
        all_right = all_right and right
        n_right += 1 if right else 0
        probs = contract_problems(res, s["transcript"], motion, req["attempt"])
        check(right, "%s [%s]: expected %s, got %s" % (s["id"], title, s["expected_break"], got))
        for pr in probs:
            check(False, "%s [%s]: %s" % (s["id"], title, pr))
        print("  %-22s expected %-28s got %-30s %s  conf %.2f  %s/%s  %d ms  tok %s/%s" % (
            s["id"], s["expected_break"], got, "PASS" if right and not probs else "FAIL",
            res["confidence"], res["source"], res["model"], ms, res["tokens"]["in"], res["tokens"]["out"]))
        print("      label: %s" % b["label"])
        print("      why:   %s" % b["why"])
        print("      hint:  %s" % res["hint"])
        print("      landed: %s" % res["landed"])
        if res.get("model_answer"):
            print("      model answer: %s" % res["model_answer"])
        for line in extra:
            print(line)
        rows.append(ms)
    if rows:
        print("  -> %s: %d/%d right, mean %d ms, max %d ms" % (
            title, n_right, len(SAMPLES), total_ms // max(1, len(SAMPLES)), max(rows)))
    return all_right, total_ms


# ---------------------------------------------------------------- guard tests (fake model, offline)
class Fake:
    def __init__(self, *outputs):
        self.outputs, self.calls = list(outputs), 0

    def __call__(self, messages, json=True, timeout=40, deadline=None):
        self.calls += 1
        out = self.outputs[min(self.calls - 1, len(self.outputs) - 1)]
        if isinstance(out, Exception):
            raise out
        text = out if isinstance(out, str) else __import__("json").dumps(out)
        return {"text": text, "model": "fake/model", "tokens": {"in": 10, "out": 5}, "ms": 1}


def sample(i):
    return SAMPLES[i]


def req_for(s, **kw):
    r = {"motion_id": s["motion_id"], "transcript": s["transcript"], "attempt": s.get("attempt", 1),
         "mode": s.get("mode", "attack")}
    r.update(kw)
    return r


def good_dropped(**over):
    o = {"coverage": [{"arg": "A1", "quote": "But the problem is the notifications, not the phone."},
                      {"arg": "A2", "quote": None}],
         "attacks": [{"arg": "A1", "link": "reason", "quote": "But the problem is the notifications, not the phone.",
                      "holds": True}],
         "break": {"type": "dropped_argument", "arg": "A2", "link": "claim",
                   "why": "You answered their first point with \"the problem is the notifications, not the phone\", but their second point is still standing."},
         "landed": "You split their reason from their claim: \"the problem is the notifications, not the phone\".",
         "hint": "Their second point is still standing. What happens to it if you say nothing?",
         "confidence": 0.9, "model_answer": None}
    o.update(over)
    return o


def guard_tests():
    print("\n== guard tests (fake model, offline)")
    d = sample(0)    # phones-attack-dropped
    tests = []

    def t(name, fake, req, want):
        A._chat = fake
        try:
            res = A.analyze(req)
        finally:
            A._chat = None
        ok, detail = want(res, fake)
        check(ok, "guard: " + name + " -> " + detail)
        print("  %s  %s  (%s)" % ("PASS" if ok else "FAIL", name, detail))

    # 1. the judge credits A2 with a generic conclusion and says "none": code must still drop A2
    t("generic sentence credited to A2 -> dropped_argument on A2",
      Fake(good_dropped(coverage=[{"arg": "A1", "quote": "But the problem is the notifications, not the phone."},
                                  {"arg": "A2", "quote": "So a full ban goes too far."}],
                        **{"break": {"type": "none", "arg": None, "link": None,
                                     "why": "You answered \"So a full ban goes too far\" for both points."}},
                        hint="Which of your answers would they attack first?")),
      req_for(d),
      lambda r, f: (r.get("break", {}).get("type") == "dropped_argument" and r["break"].get("arg") == "A2"
                    and r["hint"].startswith("Their second point"), "%s %s" % (r.get("break", {}).get("type"),
                                                                              r.get("break", {}).get("arg"))))
    # 2. the judge invents a quote that is not in the transcript
    t("invented A2 quote -> dropped, quote not shown",
      Fake(good_dropped(coverage=[{"arg": "A1", "quote": "But the problem is the notifications, not the phone."},
                                  {"arg": "A2", "quote": "Bullying happens outside school too, so a ban changes nothing."}],
                        attacks=[{"arg": "A2", "link": "claim", "quote": "Bullying happens outside school too",
                                  "holds": True}],
                        **{"break": {"type": "none", "arg": None, "link": None, "why": "x \"I disagree with the ban\""}})),
      req_for(d),
      lambda r, f: (r["break"]["type"] == "dropped_argument" and r["break"]["arg"] == "A2"
                    and all("Bullying happens outside" not in a["quote"] for a in r["attacks"]),
                    "%s %s, %d attacks" % (r["break"]["type"], r["break"]["arg"], len(r["attacks"]))))
    # 3. a hint that gives the answer is rejected; the repair call fixes it
    t("leaky hint -> repair call -> clean hint",
      Fake(good_dropped(hint="You should say that the group chat keeps running after school, so the ban does nothing?"),
           good_dropped(hint="What happens to their second point if you say nothing about it?")),
      req_for(d),
      lambda r, f: (f.calls == 2 and r["hint"] == "What happens to their second point if you say nothing about it?",
                    "%d calls, hint %r" % (f.calls, r["hint"])))
    # 4. still leaky after repair: copy.md template hint
    leaky = good_dropped(hint="Say that bullying happens in the group chat after school because the chat never stops?")
    t("leaky hint twice -> copy.md template",
      Fake(leaky, leaky), req_for(d),
      lambda r, f: (r["hint"] == "Their second point is still standing. What happens to it if you say nothing?",
                    r["hint"]))
    # 5. hint over 20 words
    t("22-word hint -> rejected",
      Fake(good_dropped(hint="What do you think would happen to their second point about bullying in group chats if you never answered it at all?")),
      req_for(d), lambda r, f: (len(r["hint"].split()) <= 20, "%d words" % len(r["hint"].split())))
    # 6. broken JSON twice: SAMPLE -> replay, anything else -> error
    t("bad JSON twice on a SAMPLE -> recorded run",
      Fake("not json", "still not json"), req_for(d),
      lambda r, f: (r.get("source") == "replay" and r["break"]["type"] == "dropped_argument", r.get("source", r)))
    t("bad JSON twice on a new transcript -> error",
      Fake("not json", "{\"oops\": 1}"), req_for(d, transcript="Phones are good because we can learn. I disagree."),
      lambda r, f: ("error" in r, str(r.get("error", "no error"))[:60]))
    # 7. GMI down
    t("GMI error on a SAMPLE -> recorded run",
      Fake(gmi.GMIError("GMI timed out after 40 s", retryable=True)), req_for(d),
      lambda r, f: (r.get("source") == "replay", r.get("source", r)))
    # 8. model answer only on a retry that is still broken
    t("model_answer on attempt 1 -> null",
      Fake(good_dropped(model_answer="Their second point is bullying, but the chat runs after school anyway.")),
      req_for(d), lambda r, f: (r["model_answer"] is None, repr(r["model_answer"])))
    t("model_answer on attempt 2, still broken -> kept",
      Fake(good_dropped(model_answer="Their second point is bullying, but the chat runs after school anyway.")),
      req_for(d, attempt=2), lambda r, f: (r["model_answer"] is not None, repr(r["model_answer"])[:50]))
    # 9. coverage quote that needs its neighbour sentence ("Their first point is wrong.") stays covered
    nl = sample(2)
    t("no_link sample: dismissal of A1 still counts as coverage",
      Fake({"coverage": [{"arg": "A1", "quote": "Phones are not bad, everyone has a phone now."},
                         {"arg": "A2", "quote": "And bullying happens anyway."}],
            "attacks": [{"arg": "A1", "link": "claim", "quote": "Phones are not bad, everyone has a phone now.", "holds": False},
                        {"arg": "A2", "link": "claim", "quote": "And bullying happens anyway.", "holds": False}],
            "break": {"type": "no_link", "arg": "A1", "link": "claim",
                      "why": "You said \"everyone has a phone now\", but never showed why that means students learn more."},
            "landed": "You named both of their points.", "hint": "What would have to be true for \"everyone has a phone\" to mean students learn more?",
            "confidence": 0.8, "model_answer": None}),
      req_for(nl), lambda r, f: (r["break"]["type"] == "no_link" and r["break"]["arg"] == "A1",
                                 "%s %s" % (r["break"]["type"], r["break"]["arg"])))
    # 10. defend: the judge credits the new safety argument as an answer -> switched
    sw = sample(3)
    t("defend: new argument credited as an answer -> new_argument_while_defending",
      Fake({"answer": {"quote": "Okay but phones are really important for safety.", "holds": True},
            "break": {"type": "none", "why": "You said \"phones are really important for safety\"."},
            "landed": "Clear reason.", "hint": "What else could you add?", "confidence": 0.8, "model_answer": None}),
      req_for(sw), lambda r, f: (r["break"]["type"] == "new_argument_while_defending", r["break"]["type"]))
    # 11. scores never pass through
    t("score in why -> template why",
      Fake(good_dropped(**{"break": {"type": "dropped_argument", "arg": "A2", "link": "claim",
                                     "why": "Score 6/10: you said \"I disagree with the ban\" but dropped point two."}})),
      req_for(d), lambda r, f: ("6/10" not in r["break"]["why"], r["break"]["why"][:70]))
    # 12. no key and not a SAMPLE -> error (simulated: replay=True on a new transcript still needs GMI)
    print("  (no-key path is exercised by --replay on a machine without ~/hack/.gmi.env)")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--replay", action="store_true", help="no network: replay + guard tests only")
    ap.add_argument("--models", default="", help="comma-separated GMI model ids to test live")
    ap.add_argument("--live-only", action="store_true")
    a = ap.parse_args()
    key = gmi.have_key()
    print("Breakpoint engine selftest  key: %s  (value never printed)" % ("present" if key else "absent"))
    if not a.live_only:
        run_samples("replay (recorded runs)", replay=True)
        guard_tests()
    if not a.replay and key:
        ids = gmi.list_models()
        print("\nGMI /v1/models: %d models listed" % len(ids))
        models = [m.strip() for m in a.models.split(",") if m.strip()] or [gmi.pick_model()]
        summary = []
        for m in models:
            if ids and m not in ids:
                print("\n== %s: not in the model list, skipped" % m)
                continue
            right, total = run_samples("live %s" % m, model=m)
            summary.append((m, right, total))
        if summary:
            print("\n== live summary")
            for m, right, total in sorted(summary, key=lambda x: (not x[1], x[2])):
                print("  %-34s all four right: %-5s  total %5d ms  mean %5d ms" % (m, right, total, total // len(SAMPLES)))
    elif not a.replay:
        print("\n(no GMI key: live run skipped)")
    print("\n%s: %d problem(s)" % ("PASS" if not FAILS else "FAIL", len(FAILS)))
    for f in FAILS:
        print("  - " + f)
    return 0 if not FAILS else 1


if __name__ == "__main__":
    sys.exit(main())
