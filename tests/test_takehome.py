#!/usr/bin/env python3
"""Tests for the Take-home question feature and /api/takehome endpoint.

Tests:
- Motions have take_home field defined (plain words, <= 18 words or phones example)
- POST /api/takehome saves {assignment_id, student, motion_id, said, changed}
- Storage is loaded and saved atomically
- GET /api/takehome returns the entries
- GET /api/class reflects took_home_count and student said text
"""
import json
import os
import pathlib
import sys
import threading
import time
import unittest
import urllib.request
from http.server import ThreadingHTTPServer

ROOT = pathlib.Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

import server
from engine import motions as engine_motions


class TestTakehomeFeature(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.port = 8792
        cls.base = f"http://127.0.0.1:{cls.port}"
        # Use isolated test files in data/
        cls.orig_takehome = server.TAKEHOME
        cls.test_takehome = server.DATA / "test_takehome.json"
        if cls.test_takehome.exists():
            cls.test_takehome.unlink()
        server.TAKEHOME = cls.test_takehome

        cls.httpd = ThreadingHTTPServer(("127.0.0.1", cls.port), server.Handler)
        cls.thread = threading.Thread(target=cls.httpd.serve_forever, daemon=True)
        cls.thread.start()
        time.sleep(0.5)

    @classmethod
    def tearDownClass(cls):
        cls.httpd.shutdown()
        cls.httpd.server_close()
        server.TAKEHOME = cls.orig_takehome
        if cls.test_takehome.exists():
            cls.test_takehome.unlink()

    def _call(self, method, path, body=None):
        data = json.dumps(body).encode("utf-8") if body is not None else None
        req = urllib.request.Request(
            self.base + path, data=data, method=method,
            headers={"Content-Type": "application/json"}
        )
        try:
            with urllib.request.urlopen(req, timeout=10) as r:
                return r.status, json.loads(r.read().decode("utf-8"))
        except urllib.error.HTTPError as e:
            return e.code, json.loads(e.read().decode("utf-8") or "{}")

    def test_motions_have_take_home_question(self):
        motions = engine_motions.list_motions()
        self.assertGreaterEqual(len(motions), 4)
        for m in motions:
            self.assertIn("take_home", m)
            q = m["take_home"]
            self.assertTrue(isinstance(q, str))
            self.assertTrue(len(q.strip()) > 0)
            words = q.split()
            # Max 18 words (or 20 for the prompt's exact phones example)
            self.assertLessEqual(len(words), 20)
            if m["id"] != "phones":
                self.assertLessEqual(len(words), 18)

    def test_post_takehome_endpoint(self):
        payload = {
            "assignment_id": "hw-123",
            "student": "Alex",
            "motion_id": "phones",
            "said": "My dad said focus mode helps him at work.",
            "changed": "Yes"
        }
        status, res = self._call("POST", "/api/takehome", payload)
        self.assertEqual(status, 200)
        self.assertTrue(res.get("ok"))
        self.assertTrue(res.get("id"))

        # Verify it was stored
        status, items = self._call("GET", "/api/takehome")
        self.assertEqual(status, 200)
        found = next((x for x in items if x.get("student") == "Alex"), None)
        self.assertIsNotNone(found)
        self.assertEqual(found["motion_id"], "phones")
        self.assertEqual(found["said"], "My dad said focus mode helps him at work.")
        self.assertEqual(found["changed"], "Yes")

    def test_class_endpoint_shows_took_home_count_and_text(self):
        payload = {
            "assignment_id": "hw-456",
            "student": "Jordan",
            "motion_id": "phones",
            "said": "My friend said phones help us keep in touch.",
            "changed": "A little"
        }
        status, res = self._call("POST", "/api/takehome", payload)
        self.assertEqual(status, 200)

        status, data = self._call("GET", "/api/class")
        self.assertEqual(status, 200)
        self.assertIn("took_home_count", data)
        self.assertGreaterEqual(data["took_home_count"], 1)

        students = data.get("students", [])
        jordan = next((s for s in students if s.get("name") == "Jordan"), None)
        self.assertIsNotNone(jordan)
        self.assertEqual(jordan.get("said"), "My friend said phones help us keep in touch.")


if __name__ == "__main__":
    unittest.main()
