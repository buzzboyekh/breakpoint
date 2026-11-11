"""Breakpoint office hours rule (CONTRACT.md Feature 1).

Rule: an attempt goes to the coach's "Office hours" list when:
  (a) the break is still not fixed after the student's 2nd try -> "Not fixed in 2 tries"
  (b) the engine's confidence for that attempt is below 0.6 -> "The AI wasn't sure"

Pure functions, Python 3.9 standard library only.
"""


def check_office_hours(attempt_or_num, break_type=None, confidence=None):
    """Evaluate whether an attempt goes to the coach's Office hours list.

    Returns (should_go: bool, reason: str or None).

    Accepts either:
      check_office_hours(attempt_dict)
    or
      check_office_hours(attempt_number, break_type, confidence)
    """
    if isinstance(attempt_or_num, dict):
        att = attempt_or_num
        attempt_num = att.get("attempt") or 1
        res = att.get("result") or {}
        brk_obj = res.get("break") or {}
        if isinstance(brk_obj, dict):
            brk = brk_obj.get("type")
        elif isinstance(brk_obj, str):
            brk = brk_obj
        else:
            brk = None
        conf = res.get("confidence")
    else:
        attempt_num = attempt_or_num or 1
        brk = break_type
        conf = confidence

    # Is the break resolved?
    is_fixed = brk in (None, "none", "")

    # Rule (a): break is still not fixed after student's 2nd try
    not_fixed_after_2 = (attempt_num >= 2 and not is_fixed)

    # Rule (b): engine's confidence for that attempt is below 0.6
    low_confidence = (conf is not None and conf < 0.6)

    if not_fixed_after_2:
        return True, "Not fixed in 2 tries"
    if low_confidence:
        return True, "The AI wasn't sure"
    return False, None


def should_go_to_office_hours(attempt_or_num, break_type=None, confidence=None):
    """Returns True if the attempt goes to Office hours, else False."""
    should_go, _ = check_office_hours(attempt_or_num, break_type, confidence)
    return should_go


def office_hours_reason(attempt_or_num, break_type=None, confidence=None):
    """Returns the Office hours reason string ('Not fixed in 2 tries' or 'The AI wasn't sure') or None."""
    _, reason = check_office_hours(attempt_or_num, break_type, confidence)
    return reason
