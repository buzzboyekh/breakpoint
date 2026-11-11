#!/usr/bin/env python3
"""Breakpoint server: serves web/ and the JSON API described in CONTRACT.md.

Python 3.9 standard library only.  Run:  python3 server.py   ->  http://127.0.0.1:8765
"""
import json
import os
import pathlib
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
PORT = int(os.environ.get("PORT", "8765"))

sys.path.insert(0, str(ROOT))
try:
    from engine import analyze as engine_analyze  # owned by the api stream
    from engine import motions as engine_motions
    from engine import gmi as engine_gmi
except Exception as e:  # the engine is still being written: keep the server up
    print(f"engine not ready yet: {e}", file=sys.stderr)
    engine_analyze = engine_motions = engine_gmi = None

_lock = threading.Lock()

CONTENT_TYPES = {
    ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8",
    ".css": "text/css; charset=utf-8", ".svg": "image/svg+xml", ".json": "application/json",
    ".png": "image/png", ".jpg": "image/jpeg", ".wasm": "application/wasm",
    ".task": "application/octet-stream", ".ico": "image/x-icon", ".woff2": "font/woff2",
}

# SAMPLE class data for the coach view (never real students).
SAMPLE_CLASS = {
    "students": [
        {"name": "SAMPLE Student A", "last_break": "dropped_argument", "tries": 3},
        {"name": "SAMPLE Student B", "last_break": "no_link", "tries": 2},
        {"name": "SAMPLE Student C", "last_break": "dropped_argument", "tries": 4},
        {"name": "SAMPLE Student D", "last_break": "new_argument_while_defending", "tries": 1},
        {"name": "SAMPLE Student E", "last_break": "number_without_so_what", "tries": 2},
        {"name": "SAMPLE Student F", "last_break": "none", "tries": 2},
    ],
    "breaks": {"dropped_argument": 9, "no_link": 4, "new_argument_while_defending": 3,
               "number_without_so_what": 2, "missed_the_attack": 1},
    "total": 14,
}


def load_attempts():
    try:
        return json.loads(ATTEMPTS.read_text())
    except Exception:
        return []


def save_attempts(items):
    tmp = ATTEMPTS.with_suffix(".tmp")
    tmp.write_text(json.dumps(items, ensure_ascii=False, indent=1))
    os.replace(tmp, ATTEMPTS)


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
        if path == "/api/class":
            with _lock:
                items = load_attempts()
            data = json.loads(json.dumps(SAMPLE_CLASS))
            for a in items:
                b = ((a.get("result") or {}).get("break") or {}).get("type")
                if b:
                    data["breaks"][b] = data["breaks"].get(b, 0) + 1
                    data["total"] += 1
            data["review"] = [
                {"id": a["id"], "transcript": a.get("transcript", ""), "result": a.get("result"),
                 "verdict": a.get("verdict")}
                for a in items
                if (a.get("result") or {}).get("confidence", 1) < 0.6 and not a.get("verdict")
            ]
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
            with _lock:
                items = load_attempts()
                item = {"id": uuid.uuid4().hex[:10], "at": time.strftime("%Y-%m-%dT%H:%M:%S"),
                        "motion_id": body.get("motion_id"), "transcript": body.get("transcript", "")[:5000],
                        "result": body.get("result"), "body": body.get("body"),
                        "student": "You"}
                items.append(item)
                save_attempts(items[-200:])
            return self._json(200, {"ok": True, "id": item["id"]})
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
