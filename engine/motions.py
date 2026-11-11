"""Breakpoint motion presets (CONTRACT.md Motion shape).

Additive fields the UI may use or ignore:
  kind           "debate" or "challenge"
  modes          the exchange modes the preset supports ("attack", "defend", "challenge")
  attack_on_you  {"target", "attack"}: the attack the student must answer in defend mode
  challenge      {"claim", "question"}: the Challenge preset (critical thinking)
The engine keeps per-point keyword hints here (not in the API payload); analyze.py uses
them to double-check that a quoted sentence really deals with that point.
"""
import copy

MOTIONS = [
    {   # demo default: must stay first and exactly as in CONTRACT.md
        "id": "phones",
        "kind": "debate",
        "motion": "This house would ban phones in middle-school classrooms.",
        "side": "CON",
        "opponent": {"args": [
            {"id": "A1", "claim": "Phones in class make students learn less",
             "reason": "Notifications pull attention away from the lesson",
             "evidence": "",
             "impact": "Every lesson loses minutes of focus"},
            {"id": "A2", "claim": "Phones bring bullying into the classroom",
             "reason": "Group chats keep running during school",
             "evidence": "",
             "impact": "Students who are targeted can't escape it, even in class"},
        ]},
        "attack_on_you": {"target": "Phones help students learn faster",
                          "attack": "Students mostly use phones for games, not research"},
        "modes": ["attack", "defend"],
    },
    {   # one statistic in evidence so "number_without_so_what" can fire
        "id": "homework",
        "kind": "debate",
        "motion": "This house believes homework does more harm than good.",
        "side": "CON",
        "opponent": {"args": [
            {"id": "A1", "claim": "Homework takes away sleep and rest",
             "reason": "After a full school day, hours of homework push bedtime later",
             "evidence": "A class survey found students do 3 hours of homework a night (SAMPLE figure)",
             "impact": "Tired students learn less the next day"},
            {"id": "A2", "claim": "Homework makes learning unfair",
             "reason": "Some students get help at home and some get none",
             "evidence": "",
             "impact": "The gap between students grows every night"},
        ]},
        "attack_on_you": {"target": "Homework helps students remember what they learned",
                          "attack": "Most students just copy the answers, so they remember nothing"},
        "modes": ["attack", "defend"],
    },
    {
        "id": "uniforms",
        "kind": "debate",
        "motion": "This house would make school uniforms optional.",
        "side": "PRO",
        "opponent": {"args": [
            {"id": "A1", "claim": "Uniforms stop teasing about clothes",
             "reason": "When everyone dresses the same, no one is picked on for cheap clothes",
             "evidence": "",
             "impact": "Students from poorer families feel safe at school"},
            {"id": "A2", "claim": "Uniforms save families money",
             "reason": "Parents buy a few uniforms instead of many outfits",
             "evidence": "",
             "impact": "Families have more to spend on books and food"},
        ]},
        "attack_on_you": {"target": "Uniforms stop students from showing who they are",
                          "attack": "Students can show who they are through their ideas and hobbies, not their clothes"},
        "modes": ["attack", "defend"],
    },
    {   # Challenge preset: a claim plus a pointed challenge question (generic loop)
        "id": "challenge-screens",
        "kind": "challenge",
        "motion": "Claim: Screens are bad for kids.",
        "side": "PRO",
        "challenge": {"claim": "Screens are bad for kids.",
                      "question": "Is a video call with your grandma bad for you too?"},
        "opponent": {"args": [
            {"id": "A1", "claim": "Some screen time is good for kids",
             "reason": "A video call with your grandma is screen time too",
             "evidence": "",
             "impact": "So \"screens are bad\" is too big a claim"},
            {"id": "A2", "claim": "Screens help kids learn",
             "reason": "Kids look things up and join lessons online",
             "evidence": "",
             "impact": "Cutting screens can cut learning too"},
        ]},
        "attack_on_you": {"target": "Screens are bad for kids.",
                          "attack": "Is a video call with your grandma bad for you too?"},
        "modes": ["challenge"],
    },
]

# Words a student uses when they really deal with a point (prefix match, lower case).
# "attack" = words that show a defence engages the attack itself.
_KEYWORDS = {
    "phones": {
        "A1": ["learn", "notification", "attention", "distract", "focus", "lesson", "buzz",
               "concentrat", "study", "studies", "ring", "alert", "pay attention"],
        "A2": ["bully", "bullies", "group chat", "chat", "message", "target", "escape", "harass",
               "cyber", "tease", "teasing", "victim", "picked on", "mean to"],
        "attack": ["game", "gaming", "play", "research", "look up", "looking up", "search",
                   "fun", "tiktok", "youtube", "video", "entertain"],
    },
    "homework": {
        "A1": ["sleep", "rest", "tired", "bed", "late", "night", "hour", "3", "three", "exhaust", "time"],
        "A2": ["unfair", "fair", "help at home", "get help", "parent", "tutor", "gap", "rich", "poor",
               "equal", "family", "families", "nobody helps", "no help"],
        "attack": ["copy", "copies", "copying", "cheat", "answer", "remember", "memory", "forget"],
    },
    "uniforms": {
        "A1": ["tease", "teasing", "bully", "picked on", "pick on", "cheap", "brand", "poor",
               "poorer", "safe", "same", "rich", "judge"],
        "A2": ["money", "cost", "expensive", "cheap", "save", "saving", "price", "afford", "buy",
               "spend", "pay", "dollar", "family", "families", "parent"],
        "attack": ["idea", "hobby", "hobbies", "clothes", "show who", "express", "style", "wear"],
    },
    "challenge-screens": {
        "A1": ["video call", "call", "grandma", "grandmother", "grandpa", "grandparent", "family",
               "talk", "facetime", "chat", "some screen", "not all", "depends", "kind of screen"],
        "A2": ["learn", "lesson", "online", "look up", "looking up", "homework", "study", "school",
               "research", "class", "teach"],
        "attack": ["video call", "call", "grandma", "grandmother", "grandparent", "family", "talk"],
    },
}


def list_motions():
    """All presets; the first is the demo default ("phones")."""
    return copy.deepcopy(MOTIONS)


def get_motion(motion_id):
    for m in MOTIONS:
        if m["id"] == motion_id:
            return copy.deepcopy(m)
    return None


def keywords_for(motion):
    """Keyword hints for a preset, or None when the motion is not an unmodified preset."""
    if not isinstance(motion, dict):
        return None
    preset = next((m for m in MOTIONS if m["id"] == motion.get("id")), None)
    if not preset:
        return None
    try:
        theirs = [(a.get("id"), a.get("claim")) for a in motion["opponent"]["args"]]
    except (KeyError, TypeError, AttributeError):
        return None
    mine = [(a["id"], a["claim"]) for a in preset["opponent"]["args"]]
    if theirs != mine:
        return None
    return copy.deepcopy(_KEYWORDS.get(preset["id"]))
