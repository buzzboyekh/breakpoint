#!/usr/bin/env python3
"""Tests for the 'What's next' preview feature.

Checks:
- The three preview card titles exist in the served app.js and/or HTML:
    1. "Small-group rounds"
    2. "Parent view"
    3. "Community questions"
- The label "Preview · not built yet" exists in the served files.
- The section heading "What's next" and sub-line exist.
- Panel sample content exists:
    - Small-group: sample first names, challenge arrows, sample challenge line
    - Parent view: "This week's question", "Where their thinking changed", "Ask at dinner"
    - Community questions: "Ask someone who was at school before phones existed", "What did they say?" (disabled)
- Coach view links to #next.
- No prohibited words (debate, motion, rebuttal, ai-proof, cheat-proof) in visible text.
- prefers-reduced-motion is honoured in styles.
"""
import pathlib
import re
import sys
import threading
import time
import unittest
import urllib.request
from http.server import ThreadingHTTPServer

ROOT = pathlib.Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

import server


class TestNextPreview(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.port = 8794
        cls.base = f"http://127.0.0.1:{cls.port}"
        cls.httpd = ThreadingHTTPServer(("127.0.0.1", cls.port), server.Handler)
        cls.thread = threading.Thread(target=cls.httpd.serve_forever, daemon=True)
        cls.thread.start()
        time.sleep(0.5)

    @classmethod
    def tearDownClass(cls):
        cls.httpd.shutdown()
        cls.httpd.server_close()

    def _get(self, path):
        req = urllib.request.Request(self.base + path, method="GET")
        with urllib.request.urlopen(req, timeout=10) as r:
            return r.status, r.read().decode("utf-8")

    def test_served_index_html_has_screen_next(self):
        status, html = self._get("/")
        self.assertEqual(status, 200)
        self.assertIn('id="screen-next"', html)
        self.assertIn('data-screen="next"', html)

    def test_served_app_js_has_titles_and_preview_label(self):
        status, js = self._get("/app.js")
        self.assertEqual(status, 200)

        # 1. Three preview titles
        self.assertIn("Small-group rounds", js)
        self.assertIn("Parent view", js)
        self.assertIn("Community questions", js)

        # 2. Preview label
        self.assertIn("Preview · not built yet", js)

    def test_served_app_js_has_section_heading_and_subline(self):
        status, js = self._get("/app.js")
        self.assertEqual(status, 200)

        self.assertIn("What's next", js)
        self.assertIn("AI finds the gap. People close it. These are the next ways we send kids to people.", js)

    def test_served_app_js_has_card_descriptions(self):
        status, js = self._get("/app.js")
        self.assertEqual(status, 200)

        self.assertIn("Three kids, one question. Each one challenges another's answer.", js)
        self.assertIn("One short note a week: what your kid argued, and the question to ask at dinner.", js)
        self.assertIn("Homework that sends kids to a real person: a grandparent, a shop owner, a neighbour.", js)

    def test_served_app_js_has_panel_contents(self):
        status, js = self._get("/app.js")
        self.assertEqual(status, 200)

        # Small-group rounds panel: sample first names, arrows, challenge line
        self.assertIn("Amy", js)
        self.assertIn("Ben", js)
        self.assertIn("Chloe", js)
        self.assertIn("challenges", js)

        # Parent view panel: the three exact headings
        self.assertIn("This week's question", js)
        self.assertIn("Where their thinking changed", js)
        self.assertIn("Ask at dinner", js)

        # Community questions panel: task card and disabled question box
        self.assertIn("Ask someone who was at school before phones existed", js)
        self.assertIn("What did they say?", js)

    def test_coach_view_and_hash_routing(self):
        status, js = self._get("/app.js")
        self.assertEqual(status, 200)

        # Reachable from coach view
        self.assertIn('href: \'#next\'', js)
        # Hash routing handles #next
        self.assertIn("r.name === 'next'", js)

    def test_no_prohibited_words_in_preview_visible_text(self):
        # Read the preview section from app.js
        app_js = (ROOT / "web" / "app.js").read_text(encoding="utf-8")
        idx1 = app_js.find("6. What's next preview")
        idx2 = app_js.find("// ---------------------------------------------------------------- boot", idx1)
        preview_code = app_js[idx1:idx2]

        t_idx1 = app_js.find("// What's next preview")
        t_idx2 = app_js.find("};", t_idx1)
        t_code = app_js[t_idx1:t_idx2]

        full_preview_code = preview_code + "\n" + t_code

        for prohibited in ["debate", "motion", "rebuttal", "ai-proof", "cheat-proof"]:
            matches = re.findall(rf"\b{prohibited}\b", full_preview_code, re.IGNORECASE)
            self.assertEqual(len(matches), 0, f"Prohibited word '{prohibited}' found in preview text: {matches}")

    def test_css_styles_exist_and_honour_reduced_motion(self):
        status, css = self._get("/styles.css")
        self.assertEqual(status, 200)

        self.assertIn(".next-card", css)
        self.assertIn(".preview-badge", css)
        self.assertIn("prefers-reduced-motion", css)
        self.assertIn("transform: translateY(-2px)", css)


if __name__ == "__main__":
    unittest.main()
