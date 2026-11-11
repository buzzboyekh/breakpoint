#!/usr/bin/env python3
"""Breakpoint server: serves web/ and the JSON API described in CONTRACT.md.

Python 3.9 standard library only.  Run:  python3 server.py   ->  http://127.0.0.1:8765
"""
import json
import os
import pathlib
import re
import secrets
import sys
import threading
import time
import uuid
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse

ROOT = pathlib.Path(__file__).resolve().parent
WEB = ROOT / "web"
DATA = ROOT / "data"
DATA.mkdir(exist_ok=True)
ATTEMPTS = DATA / "attempts.json"
ASSIGNMENTS = DATA / "assignments.json"
TAKEHOME = DATA / "takehome.json"
PARENT = DATA / "parent.json"
NOTE_MAX = 280
TOKEN_RE = re.compile(r"^[A-Za-z0-9_-]{10,64}$")
PORT = int(os.environ.get("PORT", "8765"))

sys.path.insert(0, str(ROOT))
try:
    from engine import analyze as engine_analyze  # owned by the api stream
    from engine import motions as engine_motions
    from engine import gmi as engine_gmi
    from engine import office_hours as engine_office_hours
except Exception as e:  # the engine is still being written: keep the server up
    print(f"engine not ready yet: {e}", file=sys.stderr)
    engine_analyze = engine_motions = engine_gmi = engine_office_hours = None

if engine_office_hours and hasattr(engine_office_hours, "check_office_hours"):
    check_office_hours = engine_office_hours.check_office_hours
    should_go_to_office_hours = engine_office_hours.should_go_to_office_hours
    office_hours_reason = engine_office_hours.office_hours_reason
else:
    def check_office_hours(attempt_or_num, break_type=None, confidence=None):
        if isinstance(attempt_or_num, dict):
            attempt_num = attempt_or_num.get("attempt") or 1
            res = attempt_or_num.get("result") or {}
            brk_obj = res.get("break") or {}
            brk = brk_obj.get("type") if isinstance(brk_obj, dict) else str(brk_obj)
            conf = res.get("confidence")
        else:
            attempt_num = attempt_or_num or 1
            brk = break_type
            conf = confidence
        is_fixed = brk in (None, "none", "")
        if attempt_num >= 2 and not is_fixed:
            return True, "Not fixed in 2 tries"
        if conf is not None and conf < 0.6:
            return True, "The AI wasn't sure"
        return False, None

    def should_go_to_office_hours(attempt_or_num, break_type=None, confidence=None):
        should_go, _ = check_office_hours(attempt_or_num, break_type, confidence)
        return should_go

    def office_hours_reason(attempt_or_num, break_type=None, confidence=None):
        _, reason = check_office_hours(attempt_or_num, break_type, confidence)
        return reason

_lock = threading.Lock()

CONTENT_TYPES = {
    ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8",
    ".mjs": "text/javascript; charset=utf-8",
    ".css": "text/css; charset=utf-8", ".svg": "image/svg+xml", ".json": "application/json",
    ".png": "image/png", ".jpg": "image/jpeg", ".wasm": "application/wasm",
    ".task": "application/octet-stream", ".ico": "image/x-icon", ".woff2": "font/woff2",
}

# SAMPLE class data for the coach view (never real students).
SAMPLE_CLASS = {
    "students": [
        {"name": "SAMPLE Student A", "last_break": "dropped_argument", "tries": 3},
        {"name": "SAMPLE Student B", "last_break": "no_link", "tries": 2,
         "said": "My dad said phones help him in meetings but distract him at dinner.", "changed": "A little"},
        {"name": "SAMPLE Student C", "last_break": "dropped_argument", "tries": 4},
        {"name": "SAMPLE Student D", "last_break": "new_argument_while_defending", "tries": 1},
        {"name": "SAMPLE Student E", "last_break": "number_without_so_what", "tries": 2},
        {"name": "SAMPLE Student F", "last_break": "none", "tries": 2,
         "said": "My sister said she uses focus mode to study without notifications.", "changed": "Yes"},
    ],
    "breaks": {"dropped_argument": 9, "no_link": 4, "new_argument_while_defending": 3,
               "number_without_so_what": 2, "missed_the_attack": 1},
    "total": 14,
    "took_home_count": 2,
    "office_hours": [
        {"id": "sample-oh-1", "student": "Student B", "name": "SAMPLE Student B", "motion_id": "phones",
         "motion": "Phones in class", "break_label": "No link", "tries": 2,
         "reason": "Not fixed in 2 tries", "sample": True},
        {"id": "sample-oh-2", "student": "Student D", "name": "SAMPLE Student D", "motion_id": "phones",
         "motion": "Phones in class", "break_label": "Switched arguments while defending", "tries": 1,
         "reason": "The AI wasn't sure", "sample": True},
    ]
}


def load_attempts():
    """Saved attempts; rows that are not well-formed are skipped so the coach view never breaks."""
    try:
        rows = json.loads(ATTEMPTS.read_text())
    except Exception:
        return []
    if not isinstance(rows, list):
        return []
    return [a for a in rows if isinstance(a, dict) and isinstance(a.get("result"), dict)
            and isinstance(a.get("id"), str)]


def save_attempts(items):
    tmp = ATTEMPTS.with_suffix(".tmp")
    tmp.write_text(json.dumps(items, ensure_ascii=False, indent=1))
    os.replace(tmp, ATTEMPTS)


def load_takehomes():
    try:
        rows = json.loads(TAKEHOME.read_text())
    except Exception:
        return []
    return [r for r in rows if isinstance(r, dict)] if isinstance(rows, list) else []


def save_takehomes(items):
    tmp = TAKEHOME.with_suffix(".tmp")
    tmp.write_text(json.dumps(items, ensure_ascii=False, indent=1))
    os.replace(tmp, TAKEHOME)


def load_assignments():
    try:
        return json.loads(ASSIGNMENTS.read_text())
    except Exception:
        return []


def save_assignments(items):
    tmp = ASSIGNMENTS.with_suffix(".tmp")
    tmp.write_text(json.dumps(items, ensure_ascii=False, indent=1))
    os.replace(tmp, ASSIGNMENTS)


def load_parent_rows():
    """One row per student per assignment: {token, assignment_id, student, note}. Bad rows are skipped."""
    try:
        rows = json.loads(PARENT.read_text())
    except Exception:
        return []
    if not isinstance(rows, list):
        return []
    return [r for r in rows if isinstance(r, dict) and isinstance(r.get("token"), str)
            and isinstance(r.get("assignment_id"), str) and isinstance(r.get("student"), str)]


def save_parent_rows(items):
    tmp = PARENT.with_suffix(".tmp")
    tmp.write_text(json.dumps(items, ensure_ascii=False, indent=1))
    os.replace(tmp, PARENT)


def _break_type(attempt):
    res = attempt.get("result")
    brk = res.get("break") if isinstance(res, dict) else None
    t = brk.get("type") if isinstance(brk, dict) else None
    return t if isinstance(t, str) else None


# Plain words for a parent. No scores, no quotes from the child's answer.
PARENT_WEAK_SPOT = {
    "dropped_argument": "Answered one of the two points and skipped the other.",
    "no_link": "Made a point without showing how it leads to the answer.",
    "number_without_so_what": "Questioned a number without saying why it matters.",
    "missed_the_attack": "Answered a different point from the one raised.",
    "new_argument_while_defending": "Moved to a new point instead of answering the one raised.",
    "missed_the_challenge": "Did not answer the question that was asked.",
    "no_condition": "Did not say when their answer might not be true.",
    "ignored_best_counterpoint": "Left out the strongest point on the other side.",
    "off_point": "Wandered away from the question.",
    "none": "No weak spot found on the first try.",
}


def parent_view(row, attempts, assignments, takehomes):
    """Everything a parent may see. Deliberately no transcript, scores or body notes."""
    a = next((x for x in assignments if isinstance(x, dict) and x.get("id") == row["assignment_id"]), None)
    mine = [t for t in attempts if t.get("assignment_id") == row["assignment_id"] and t.get("student") == row["student"]]
    motion = None
    if a and engine_motions and hasattr(engine_motions, "list_motions"):
        try:
            motion = next((m for m in engine_motions.list_motions() if m.get("id") == a.get("motion_id")), None)
        except Exception:
            motion = None
    first = _break_type(mine[0]) if mine else None
    last = _break_type(mine[-1]) if mine else None
    if not mine:
        outcome = "No tries yet."
    elif first in (None, "none"):
        outcome = "Held up the first time."
    elif last == "none":
        outcome = "Fixed it."
    else:
        outcome = "Not fixed yet."
    th = [t for t in takehomes if t.get("assignment_id") == row["assignment_id"] and t.get("student") == row["student"]
          and isinstance(t.get("said"), str) and t["said"].strip()]
    note = row.get("note") if isinstance(row.get("note"), str) else ""
    name = row["student"].split()
    return {
        "first_name": name[0] if name else "Student",
        "question": (motion or {}).get("motion") if isinstance((motion or {}).get("motion"), str) else "",
        "tries": len(mine),
        "how": ("Typed" if mine[-1].get("typed") else "Spoken") if mine else None,
        "weak_spot": PARENT_WEAK_SPOT.get(first, "One weak spot found on the first try.") if mine else None,
        "outcome": outcome,
        "fixed": bool(mine) and first not in (None, "none") and last == "none",
        "coach_note": note,
        "ask_at_home": {
            "question": (motion or {}).get("take_home") if isinstance((motion or {}).get("take_home"), str) else "",
            "answer": th[-1]["said"][:2000] if th else "",
        },
    }


def assignment_summary(a, attempts, parent_rows=()):
    """Who did the homework and where it broke: per student, tries and whether the last try held."""
    mine = [t for t in attempts if t.get("assignment_id") == a["id"]]
    people = {}
    for t in mine:
        p = people.setdefault(t.get("student") or "Student", {"name": t.get("student") or "Student", "tries": 0,
                                                              "first_break": None, "last_break": None})
        p["tries"] += 1
        p["typed"] = bool(t.get("typed"))   # how the LAST try was given
        b = _break_type(t)
        if p["first_break"] is None:
            p["first_break"] = b
        p["last_break"] = b
    notes = {r["student"]: r.get("note") for r in parent_rows if r.get("assignment_id") == a["id"]}
    for p in people.values():
        n = notes.get(p["name"])
        p["note"] = n if isinstance(n, str) else ""
        p["fixed"] = p["first_break"] not in (None, "none") and p["last_break"] == "none"
    return {**a, "submissions": list(people.values()), "attempts": len(mine)}


class Handler(BaseHTTPRequestHandler):
    server_version = "Breakpoint/0.1"

    def log_message(self, fmt, *args):  # quiet, and never log request bodies
        sys.stderr.write("%s %s\n" % (time.strftime("%H:%M:%S"), fmt % args))

    def _json(self, code, obj):
        body = json.dumps(obj, ensure_ascii=False).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def _body(self):
        n = int(self.headers.get("Content-Length") or 0)
        if n > 2_000_000:
            raise ValueError("request too large")
        raw = self.rfile.read(n) if n else b"{}"
        return json.loads(raw.decode("utf-8") or "{}")

    def do_GET(self):
        path = urlparse(self.path).path
        if path == "/api/health":
            info = {"gmi": False, "model": None, "mode": "replay"}
            if engine_gmi and hasattr(engine_gmi, "health"):
                try:
                    info.update(engine_gmi.health())
                except Exception as e:
                    info["error"] = str(e)[:200]
            return self._json(200, info)
        if path == "/api/motions":
            if engine_motions and hasattr(engine_motions, "list_motions"):
                return self._json(200, engine_motions.list_motions())
            return self._json(503, {"error": "motions not ready"})
        if path == "/api/assignments":
            with _lock:
                items, attempts, prows = load_assignments(), load_attempts(), load_parent_rows()
            return self._json(200, [assignment_summary(a, attempts, prows) for a in reversed(items)])
        if path.startswith("/api/assignments/"):
            aid = path.rsplit("/", 1)[-1]
            with _lock:
                items, attempts, prows = load_assignments(), load_attempts(), load_parent_rows()
            for a in items:
                if a["id"] == aid:
                    return self._json(200, assignment_summary(a, attempts, prows))
            return self._json(404, {"error": "assignment not found"})
        if path.startswith("/a/"):  # a shareable assignment link opens the app with that assignment
            return self._static("/index.html")
        if path.startswith("/p/"):  # a parent link opens the app on the parent page
            return self._static("/index.html")
        if path.startswith("/api/parent/"):
            token = path[len("/api/parent/"):]
            if not TOKEN_RE.match(token):
                return self._json(404, {"error": "link not found"})
            with _lock:
                rows, attempts, assignments, takehomes = (load_parent_rows(), load_attempts(),
                                                          load_assignments(), load_takehomes())
            row = next((r for r in rows if secrets.compare_digest(r["token"], token)), None)
            if not row:
                return self._json(404, {"error": "link not found"})
            return self._json(200, parent_view(row, attempts, assignments if isinstance(assignments, list) else [], takehomes))
        if path == "/api/takehome":
            with _lock:
                items = load_takehomes()
            return self._json(200, items)
        if path == "/api/class":
            with _lock:
                items = load_attempts()
                takehomes = load_takehomes()
            data = json.loads(json.dumps(SAMPLE_CLASS))
            for a in items:
                b = ((a.get("result") or {}).get("break") or {}).get("type")
                if b:
                    data["breaks"][b] = data["breaks"].get(b, 0) + 1
                    data["total"] += 1

            # Attach student takehome responses
            for th in takehomes:
                stu_name = th.get("student") or "Student"
                found = next((s for s in data["students"] if s.get("name") == stu_name), None)
                if found:
                    found["said"] = th.get("said")
                    found["changed"] = th.get("changed")
                else:
                    mine = [x for x in items if x.get("student") == stu_name]
                    lb = ((mine[-1].get("result") or {}).get("break") or {}).get("type") if mine else None
                    data["students"].append({
                        "name": stu_name,
                        "last_break": lb,
                        "tries": len(mine),
                        "said": th.get("said"),
                        "changed": th.get("changed")
                    })
            data["took_home_count"] = sum(1 for s in data["students"] if s.get("said"))

            # Build office hours queue using the office-hours rule
            oh_items = []
            last_by = {}
            for a in items:   # later rows replace earlier ones: only a student's last attempt can queue them
                last_by[(a.get("student"), a.get("motion_id"), a.get("assignment_id"))] = a
            for a in last_by.values():
                should_go, reason = check_office_hours(a)
                if should_go and not a.get("verdict"):
                    res = a.get("result") or {}
                    brk = res.get("break") or {}
                    mid = a.get("motion_id") or "phones"
                    oh_items.append({
                        "id": a["id"],
                        "student": (a.get("student") or "You").split()[0],
                        "name": a.get("student") or "You",
                        "motion_id": mid,
                        "motion": mid,
                        "break_label": brk.get("label") or brk.get("type") or "none",
                        "tries": a.get("attempt") or 1,
                        "typed": bool(a.get("typed")),
                        "reason": reason,
                        "transcript": a.get("transcript", ""),
                        "result": res,
                        "verdict": a.get("verdict")
                    })
            data["office_hours"] = oh_items if oh_items else data.get("office_hours", [])
            data["review"] = data["office_hours"]
            data["mine"] = items[-10:]
            return self._json(200, data)
        return self._static(path)

    def do_POST(self):
        path = urlparse(self.path).path
        try:
            body = self._body()
        except Exception as e:
            return self._json(400, {"error": f"bad request: {e}"})
        if path == "/api/analyze":
            if not engine_analyze or not hasattr(engine_analyze, "analyze"):
                return self._json(503, {"error": "engine not ready"})
            try:
                result = engine_analyze.analyze(body)
            except Exception as e:
                return self._json(503, {"error": str(e)[:300]})
            code = 200 if "error" not in result else 503
            return self._json(code, result)
        if path == "/api/attempts":
            if not isinstance(body.get("result"), dict) or not isinstance(body["result"].get("break"), dict):
                return self._json(400, {"error": "result must be an analysis result object"})
            if body.get("body") is not None and not isinstance(body.get("body"), dict):
                body["body"] = None
            with _lock:
                items = load_attempts()
                item = {"id": uuid.uuid4().hex[:10], "at": time.strftime("%Y-%m-%dT%H:%M:%S"),
                        "motion_id": body.get("motion_id"), "transcript": body.get("transcript", "")[:5000],
                        "result": body.get("result"), "body": body.get("body"),
                        "assignment_id": body.get("assignment_id"), "attempt": body.get("attempt"),
                        "typed": bool(body.get("typed")),
                        "student": (body.get("student") or "You")[:40]}
                items.append(item)
                save_attempts(items[-200:])
            return self._json(200, {"ok": True, "id": item["id"]})
        if path == "/api/assignments":
            motion_id = body.get("motion_id")
            if not motion_id:
                return self._json(400, {"error": "motion_id required"})
            item = {"id": uuid.uuid4().hex[:6], "motion_id": motion_id, "mode": body.get("mode") or "attack",
                    "title": (body.get("title") or "")[:120], "due": (body.get("due") or "")[:40],
                    "created": time.strftime("%Y-%m-%dT%H:%M:%S")}
            with _lock:
                items = load_assignments()
                items.append(item)
                save_assignments(items[-200:])
            host = self.headers.get("Host") or f"127.0.0.1:{PORT}"
            return self._json(200, {**item, "url": f"http://{host}/a/{item['id']}"})
        if path == "/api/takehome":
            with _lock:
                items = load_takehomes()
                item = {
                    "id": uuid.uuid4().hex[:10],
                    "at": time.strftime("%Y-%m-%dT%H:%M:%S"),
                    "assignment_id": body.get("assignment_id"),
                    "student": (body.get("student") or "You")[:40],
                    "motion_id": body.get("motion_id") or "",
                    "said": (body.get("said") or "")[:2000],
                    "changed": (body.get("changed") or "")[:20]
                }
                items.append(item)
                save_takehomes(items[-200:])
            return self._json(200, {"ok": True, "id": item["id"]})
        if path == "/api/parent-note":
            if not isinstance(body, dict):
                return self._json(400, {"error": "body must be an object"})
            aid, student, note = body.get("assignment_id"), body.get("student"), body.get("note")
            if not isinstance(aid, str) or not 0 < len(aid) <= 40:
                return self._json(400, {"error": "assignment_id must be a short string"})
            if not isinstance(student, str) or not 0 < len(student.strip()) <= 40:
                return self._json(400, {"error": "student must be a name of 1 to 40 characters"})
            if not isinstance(note, str):
                return self._json(400, {"error": "note must be a string"})
            note = note.strip()
            if len(note) > NOTE_MAX:
                return self._json(400, {"error": f"note must be {NOTE_MAX} characters or fewer"})
            with _lock:
                assignments = load_assignments()
                known = isinstance(assignments, list) and any(isinstance(a, dict) and a.get("id") == aid for a in assignments)
                did = any(t.get("assignment_id") == aid and t.get("student") == student for t in load_attempts())
                if not (known and did):
                    return self._json(404, {"error": "no homework from that student"})
                rows = load_parent_rows()
                row = next((r for r in rows if r["assignment_id"] == aid and r["student"] == student), None)
                if row is None:
                    row = {"token": secrets.token_urlsafe(16), "assignment_id": aid, "student": student}
                    rows.append(row)
                row["note"] = note
                row["at"] = time.strftime("%Y-%m-%dT%H:%M:%S")
                save_parent_rows(rows[-500:])
            host = self.headers.get("Host") or f"127.0.0.1:{PORT}"
            return self._json(200, {"ok": True, "token": row["token"], "url": f"http://{host}/p/{row['token']}"})
        if path == "/api/review":
            with _lock:
                items = load_attempts()
                for a in items:
                    if a["id"] == body.get("id"):
                        a["verdict"] = body.get("verdict")
                save_attempts(items)
            return self._json(200, {"ok": True})
        return self._json(404, {"error": "not found"})

    def _static(self, path):
        if path in ("", "/"):
            path = "/index.html"
        target = (WEB / path.lstrip("/")).resolve()
        if WEB not in target.parents and target != WEB or not target.is_file():
            return self._json(404, {"error": "not found"})
        data = target.read_bytes()
        self.send_response(200)
        self.send_header("Content-Type", CONTENT_TYPES.get(target.suffix, "application/octet-stream"))
        self.send_header("Content-Length", str(len(data)))
        self.send_header("Cache-Control", "no-cache")
        self.end_headers()
        self.wfile.write(data)


def main():
    httpd = ThreadingHTTPServer(("127.0.0.1", PORT), Handler)
    print(f"Breakpoint on http://127.0.0.1:{PORT}", flush=True)
    httpd.serve_forever()


if __name__ == "__main__":
    main()
