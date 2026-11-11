#!/usr/bin/env python3
"""Tests for the Parent view: coach note, /p/<token> link, GET /api/parent/<token>.

Starts the server on a free port with a temp data dir (nothing in data/ is touched).
"""
import json
import pathlib
import shutil
import sys
import tempfile
import threading
import unittest
import urllib.error
import urllib.request
from http.server import ThreadingHTTPServer

ROOT = pathlib.Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

import server

TRANSCRIPT = "SECRET-WORDS the phone thing is bad because reasons"


class TestParentView(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.tmp = pathlib.Path(tempfile.mkdtemp())
        cls.saved = {k: getattr(server, k) for k in ("ATTEMPTS", "ASSIGNMENTS", "TAKEHOME", "PARENT")}
        server.ATTEMPTS = cls.tmp / "attempts.json"
        server.ASSIGNMENTS = cls.tmp / "assignments.json"
        server.TAKEHOME = cls.tmp / "takehome.json"
        server.PARENT = cls.tmp / "parent.json"
        server.save_assignments([{"id": "hw1", "motion_id": "phones", "mode": "attack", "title": "", "due": "", "created": "x"}])

        def brk(t):
            return {"break": {"type": t, "label": "L", "why": "w"}, "confidence": 0.9}

        server.save_attempts([
            {"id": "a1", "assignment_id": "hw1", "student": "Maya Lin", "typed": False, "attempt": 1,
             "transcript": TRANSCRIPT, "result": brk("dropped_argument")},
            {"id": "a2", "assignment_id": "hw1", "student": "Maya Lin", "typed": True, "attempt": 2,
             "transcript": TRANSCRIPT, "result": brk("none")},
            {"id": "a3", "assignment_id": "hw1", "student": "Sam", "result": {"break": "oops"}},  # malformed break
        ])
        server.save_takehomes([{"assignment_id": "hw1", "student": "Maya Lin", "said": "Mum said focus mode helps."}])
        # malformed stored parent rows must not crash anything
        server.PARENT.write_text(json.dumps([{"token": 5}, "junk", {"token": "x", "assignment_id": 1, "student": 2}]))
        cls.httpd = ThreadingHTTPServer(("127.0.0.1", 0), server.Handler)  # port 0: any free port
        cls.base = f"http://127.0.0.1:{cls.httpd.server_address[1]}"
        threading.Thread(target=cls.httpd.serve_forever, daemon=True).start()

    @classmethod
    def tearDownClass(cls):
        cls.httpd.shutdown()
        cls.httpd.server_close()
        for k, v in cls.saved.items():
            setattr(server, k, v)
        shutil.rmtree(cls.tmp, ignore_errors=True)

    def _call(self, method, path, body=None, raw=None):
        data = raw if raw is not None else (json.dumps(body).encode() if body is not None else None)
        req = urllib.request.Request(self.base + path, data=data, method=method,
                                     headers={"Content-Type": "application/json"})
        try:
            with urllib.request.urlopen(req, timeout=10) as r:
                return r.status, json.loads(r.read().decode())
        except urllib.error.HTTPError as e:
            return e.code, json.loads(e.read().decode() or "{}")

    def _note(self, note, student="Maya Lin"):
        return self._call("POST", "/api/parent-note", {"assignment_id": "hw1", "student": student, "note": note})

    def test_note_saves_and_comes_back(self):
        status, res = self._note("Great fix tonight.")
        self.assertEqual(status, 200)
        token = res["token"]
        self.assertGreaterEqual(len(token), 16)
        self.assertTrue(res["url"].endswith("/p/" + token))
        status, page = self._call("GET", "/api/parent/" + token)
        self.assertEqual(status, 200)
        self.assertEqual(page["coach_note"], "Great fix tonight.")
        self.assertEqual(page["first_name"], "Maya")
        self.assertEqual(page["tries"], 2)
        self.assertEqual(page["how"], "Typed")
        self.assertTrue(page["fixed"])
        self.assertIn("phones", page["question"].lower())
        self.assertEqual(page["ask_at_home"]["answer"], "Mum said focus mode helps.")
        self.assertTrue(page["ask_at_home"]["question"])
        # the coach list shows the saved note, never the token
        _, listing = self._call("GET", "/api/assignments")
        maya = next(s for s in listing[0]["submissions"] if s["name"] == "Maya Lin")
        self.assertEqual(maya["note"], "Great fix tonight.")
        self.assertNotIn(token, json.dumps(listing))
        # saving again keeps the same link and replaces the note
        _, res2 = self._note("")
        self.assertEqual(res2["token"], token)
        self.assertEqual(self._call("GET", "/api/parent/" + token)[1]["coach_note"], "")

    def test_bad_token_is_404(self):
        self.assertEqual(self._call("GET", "/api/parent/not-a-real-token-1234")[0], 404)
        self.assertEqual(self._call("GET", "/api/parent/..%2F..%2Fserver")[0], 404)
        self.assertEqual(self._call("GET", "/api/parent/")[0], 404)

    def test_bad_input_is_400(self):
        self.assertEqual(self._note(123)[0], 400)
        self.assertEqual(self._note(None)[0], 400)
        self.assertEqual(self._note("x" * 281)[0], 400)
        self.assertEqual(self._note("ok", student=7)[0], 400)
        self.assertEqual(self._call("POST", "/api/parent-note", {"assignment_id": ["a"], "student": "Sam", "note": "hi"})[0], 400)
        self.assertEqual(self._call("POST", "/api/parent-note", raw=b"[1,2]")[0], 400)
        self.assertEqual(self._call("POST", "/api/parent-note", raw=b"not json")[0], 400)
        self.assertEqual(self._note("x" * 280)[0], 200)  # exactly the limit is fine
        self.assertEqual(self._note("hi", student="Nobody")[0], 404)

    def test_payload_has_no_transcript_or_scores(self):
        token = self._note("hello")[1]["token"]
        text = json.dumps(self._call("GET", "/api/parent/" + token)[1]).lower()
        self.assertNotIn("transcript", text)
        self.assertNotIn("secret-words", text)
        for word in ("confidence", "score", "body", "debate", "judge", "rebuttal"):
            self.assertNotIn(word, text)

    def test_malformed_attempt_does_not_crash(self):
        token = self._note("fine", student="Sam")[1]["token"]
        status, page = self._call("GET", "/api/parent/" + token)
        self.assertEqual(status, 200)
        self.assertEqual(page["first_name"], "Sam")
        self.assertEqual(page["ask_at_home"]["answer"], "")

    def test_parent_page_is_served(self):
        with urllib.request.urlopen(self.base + "/p/abcdefghij1234", timeout=10) as r:
            self.assertEqual(r.status, 200)
            self.assertIn(b"screen-parent", r.read())


if __name__ == "__main__":
    unittest.main()
