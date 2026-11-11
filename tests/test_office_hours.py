#!/usr/bin/env python3
"""Tests for the Office hours rule (pure function).

Rule: an attempt goes to the coach's "Office hours" list when:
  (a) the break is still not fixed after the student's 2nd try ("Not fixed in 2 tries")
  (b) the engine's confidence for that attempt is below 0.6 ("The AI wasn't sure")
"""
import pathlib
import sys
import unittest

ROOT = pathlib.Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from engine.office_hours import check_office_hours, should_go_to_office_hours, office_hours_reason
import server


class TestOfficeHoursRule(unittest.TestCase):
    def test_not_fixed_after_second_try(self):
        # 2nd try with active break and normal confidence
        go, reason = check_office_hours(2, "dropped_argument", 0.85)
        self.assertTrue(go)
        self.assertEqual(reason, "Not fixed in 2 tries")

        # 3rd try with active break
        go, reason = check_office_hours(3, "no_link", 0.9)
        self.assertTrue(go)
        self.assertEqual(reason, "Not fixed in 2 tries")

        # Dict format
        attempt = {
            "attempt": 2,
            "result": {"break": {"type": "new_argument_while_defending", "label": "Switched"}, "confidence": 0.8}
        }
        go, reason = check_office_hours(attempt)
        self.assertTrue(go)
        self.assertEqual(reason, "Not fixed in 2 tries")

    def test_fixed_after_second_try_does_not_trigger_rule_a(self):
        # 2nd try fixed ("none") with normal confidence
        go, reason = check_office_hours(2, "none", 0.9)
        self.assertFalse(go)
        self.assertIsNone(reason)

        attempt = {
            "attempt": 2,
            "result": {"break": {"type": "none", "label": "Every link holds"}, "confidence": 0.85}
        }
        go, reason = check_office_hours(attempt)
        self.assertFalse(go)
        self.assertIsNone(reason)

    def test_first_try_broken_does_not_trigger_rule_a(self):
        # 1st try broken: student still has retry, so does NOT go to office hours if confidence is normal
        go, reason = check_office_hours(1, "dropped_argument", 0.9)
        self.assertFalse(go)
        self.assertIsNone(reason)

        attempt = {
            "attempt": 1,
            "result": {"break": {"type": "no_link"}, "confidence": 0.8}
        }
        self.assertFalse(should_go_to_office_hours(attempt))
        self.assertIsNone(office_hours_reason(attempt))

    def test_low_confidence_triggers_rule_b(self):
        # Confidence < 0.6 triggers "The AI wasn't sure" even on attempt 1
        go, reason = check_office_hours(1, "no_link", 0.52)
        self.assertTrue(go)
        self.assertEqual(reason, "The AI wasn't sure")

        # Confidence < 0.6 even if break was marked "none" on attempt 2
        go, reason = check_office_hours(2, "none", 0.45)
        self.assertTrue(go)
        self.assertEqual(reason, "The AI wasn't sure")

        # Confidence boundary checks
        go, reason = check_office_hours(1, "no_link", 0.599)
        self.assertTrue(go)
        self.assertEqual(reason, "The AI wasn't sure")

        go, reason = check_office_hours(1, "no_link", 0.60)
        self.assertFalse(go)
        self.assertIsNone(reason)

    def test_server_module_exports(self):
        # Ensure server.py re-exports the pure functions as well
        self.assertTrue(hasattr(server, "check_office_hours"))
        go, reason = server.check_office_hours(2, "dropped_argument", 0.8)
        self.assertTrue(go)
        self.assertEqual(reason, "Not fixed in 2 tries")


if __name__ == "__main__":
    unittest.main()
