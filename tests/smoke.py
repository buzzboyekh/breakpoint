#!/usr/bin/env python3
"""Lead's end-to-end smoke test against a running server (default http://127.0.0.1:8765).

Checks: health, motions (default motion shape), analyze on every SAMPLE transcript (expected break),
the money shot (attacking only A1 of "phones" -> dropped_argument on A2), hint rules, attempts and class.
Run:  /usr/bin/python3 tests/smoke.py [base_url]
"""
import json
import pathlib
import sys
import urllib.request

BASE = sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:8765"
ROOT = pathlib.Path(__file__).resolve().parent.parent
FAILS = []


def call(method, path, body=None, timeout=90):
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(BASE + path, data=data, method=method,
                                 headers={"Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return r.status, json.loads(r.read().decode())
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read().decode() or "{}")


def check(cond, msg):
    print(("  ok   " if cond else "  FAIL ") + msg)
    if not cond:
        FAILS.append(msg)


def main():
    code, health = call("GET", "/api/health")
    print("health:", health)
    code, motions = call("GET", "/api/motions")
    check(code == 200 and isinstance(motions, list) and len(motions) >= 3, "motions: at least 3 presets")
    by_id = {m.get("id"): m for m in motions} if isinstance(motions, list) else {}
    phones = by_id.get("phones")
    check(bool(phones) and motions[0].get("id") == "phones", "default motion is 'phones' and first")
    if phones:
        args = phones.get("opponent", {}).get("args", [])
        check(len(args) == 2 and all(a.get("claim") and a.get("reason") and a.get("impact") for a in args),
              "phones has A1/A2 with claim/reason/impact")
        check(bool(phones.get("attack_on_you")), "phones has attack_on_you for defend mode")

    samples = json.loads((ROOT / "samples" / "transcripts.json").read_text())
    for s in samples:
        motion = by_id.get(s["motion_id"]) or {}
        req = {"motion_id": s["motion_id"], "motion": motion, "mode": s["mode"],
               "transcript": s["transcript"], "attempt": s["attempt"], "previous": None}
        code, res = call("POST", "/api/analyze", req)
        brk = (res.get("break") or {}).get("type")
        hint = res.get("hint") or ""
        print(f"- {s['id']}: http {code}, break={brk}, source={res.get('source')}, model={res.get('model')}, "
              f"conf={res.get('confidence')}, ms={res.get('ms')}")
        print(f"    label: {(res.get('break') or {}).get('label')}\n    hint: {hint}\n    landed: {res.get('landed')}")
        check(code == 200, f"{s['id']}: analyze returns 200")
        check(brk == s["expected_break"], f"{s['id']}: expected {s['expected_break']}, got {brk}")
        if s["id"] == "phones-attack-dropped":
            check((res.get("break") or {}).get("arg") == "A2", "money shot: dropped argument is A2")
        if brk and brk != "none":
            check(hint.strip().endswith("?") and len(hint.split()) <= 20, f"{s['id']}: hint is one question <= 20 words")
        check(res.get("model_answer") in (None, "") or s["attempt"] >= 2, f"{s['id']}: no model answer on attempt 1")
        check(len(res.get("links") or []) >= 6, f"{s['id']}: links per point present")

    code, r = call("POST", "/api/attempts", {"motion_id": "phones", "transcript": "SAMPLE smoke", "result": {"break": {"type": "none"}, "confidence": 0.9}})
    check(code == 200 and r.get("ok"), "attempts: save")
    code, cls = call("GET", "/api/class")
    check(code == 200 and cls.get("students"), "class: SAMPLE students")
    print("\nRESULT:", "PASS" if not FAILS else f"{len(FAILS)} failing")
    return 0 if not FAILS else 1


if __name__ == "__main__":
    sys.exit(main())
