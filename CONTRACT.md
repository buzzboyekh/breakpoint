# Breakpoint build contract (owner: lead; workers read it, never edit it)

Breakpoint is an AI sparring partner for kids 9-15 practising debate in English: they give a 60-second rebuttal against an opponent's argument, Breakpoint shows exactly which link of the argument chain broke, gives ONE hint (never the answer), they try again, and a body-language track (on device) adds at most two movement notes. Design kit: ~/Claude/Projects/hackathons/c0mpiled-18/design-marketing/ (design-spec.md, tokens.css). Hackathon rule: everything in this repo is written after 18:45 tonight.

## Keep the core loop generic (lead decision, 18:44)
Buz may widen the product from debate to public speaking and critical thinking. So the engine and data model are generic:
exercise (prompt or claim) -> challenge (opponent points or a challenge question) -> spoken response -> checks -> one hint -> retry.
"Debate attack" and "Debate defend" are presets of that loop; a third preset "Challenge" (critical thinking: a claim plus a pointed challenge question) uses the same shapes with these checks: answered the challenge; added a condition or limit; covered the other side's best point; because-chain; stayed on point. Extra break types for it: missed_the_challenge, no_condition, ignored_best_counterpoint, off_point (plus no_link). Build the debate presets first; the Challenge preset only needs a motion entry and the extra break types in the prompt.

## Folder ownership (edit only your own files)
| Owner | Files |
|---|---|
| lead | server.py, CONTRACT.md, README.md, samples/, tests/ |
| api | engine/ (gmi.py, analyze.py, motions.py, replay/) |
| ui | web/index.html, web/app.js, web/styles.css, web/speech.js |
| chain | web/chain.js |
| body | web/body.js |
| design kit (copied by lead) | web/tokens.css, web/logo.svg |

## Run
`python3 server.py` serves web/ at http://127.0.0.1:8765 and the API under /api. Python 3.9 standard library only. Chrome only.
GMI key: read from env GMI_API_KEY or the file ~/hack/.gmi.env (line GMI_API_KEY=...). Never print it, never log it, never commit it.

## Data shapes
Motion: {"id":"ai-tutors","motion":"This house would replace cram school with AI tutors.","side":"CON",
         "opponent":{"args":[{"id":"A1","claim":"...","reason":"...","evidence":"...","impact":"..."},
                             {"id":"A2","claim":"...","reason":"...","evidence":"...","impact":"..."}]}}
(The student argues `side` and rebuts the opponent's two arguments.)

AnalyzeRequest (POST /api/analyze): {"motion_id":"...","motion":{...Motion},"transcript":"student words","attempt":1,"previous":AnalyzeResult|null}
AnalyzeResult:
{"attempt":1,
 "attacks":[{"arg":"A1","link":"claim|reason|evidence|impact","quote":"exact student words","holds":true|false}],
 "links":[{"arg":"A1","link":"claim","status":"untouched|attacked|broken"}, ... 8 entries: A1/A2 x claim/reason/evidence/impact],
 "break":{"type":"dropped_argument|no_link|new_argument_while_defending|number_without_so_what|none",
          "arg":"A2","link":"reason",
          "label":"Dropped their second argument",
          "why":"one sentence that quotes the student"},
 "hint":"ONE question, <= 20 words, ends with '?', never a model answer, never rewritten speech",
 "landed":"one short sentence on what worked (specific, no generic praise)",
 "confidence":0.0-1.0,
 "source":"gmi|replay",
 "model":"model id","tokens":{"in":0,"out":0},"ms":0}
Status meaning on the chain: an opponent link is "broken" when the student's attack on it holds (the student broke the opponent's link); "attacked" when the student tried but the attack did not hold; "untouched" when never addressed. The student's own break (the "break" object) is what the report headlines: where the STUDENT's rebuttal broke.

Two exchange modes (the check is the exchange, not the whole speech; research stream, verified):
- mode "attack": the student rebuts the opponent's two arguments. Checks: covered every opposing argument? because-chain from claim to impact?
- mode "defend": the opponent attacks the student's own argument (Motion.attack_on_you = {"target":"your claim","attack":"..."}). Checks: did the student answer the attack actually made? did they switch to a new argument instead?
AnalyzeRequest gains "mode":"attack|defend".

Break labels (generic; never SNAPS names; observations, never scores):
- dropped_argument -> "You answered their first argument, not their second" (attack)
- no_link -> "No link: <X> does not prove <Y>" (attack or defend)
- number_without_so_what -> "Attacked a number without saying why it matters" (attack)
- missed_the_attack -> "You answered a different point, not their attack" (defend)
- new_argument_while_defending -> "You switched to a new argument instead of answering" (defend)
- none -> "Every link you attacked holds" / "Your defence answered their attack"

Feedback rules (research stream, verified):
- Never a number or score on screen. Holds / Breaks per link only.
- Prompt first: ONE hint question; the kid must try again (forced redo of the same exchange).
- A model answer ("one way to say it", <= 40 words) is returned only when attempt >= 2 and the break is still there; the UI shows it behind a button.
- confidence < 0.6 -> the report shows "Check this one with your coach" instead of a verdict, and the attempt goes to the coach review queue.
AnalyzeResult gains "model_answer": string|null (null unless attempt >= 2 and still broken).

## Demo defaults (design session, 2026-11-11 ~18:44)
- Default motion (first preset, id "phones"): "This house would ban phones in middle-school classrooms." Student side: AGAINST (side "CON").
  A1: claim "Phones in class make students learn less" / reason "Notifications pull attention away from the lesson" / evidence "" / impact "Every lesson loses minutes of focus".
  A2: claim "Phones bring bullying into the classroom" / reason "Group chats keep running during school" / evidence "" / impact "Students who are targeted can't escape it, even in class".
  `evidence` may be an empty string: the chain then shows three nodes (claim, reason, impact); links for an empty evidence get status "untouched" and are not drawn.
- The judge checks coverage of EVERY opponent point first: attacking only A1 must produce break "dropped_argument" on A2 (the video depends on it). Holds/Breaks per point.
- "Recorded run" button: replays a saved good attempt, labelled "Recorded run" on screen.
- Report footer: "Judged by {model} on GMI · {cost}" (cost from tokens; show "~" if price unknown).
- Exact UI strings: ~/Claude/Projects/hackathons/c0mpiled-18/design-marketing/copy.md (ui uses them as written), including the mode toggle ("Attack their argument" / "Defend your point"), "Show a model answer" (after one retry only, helper "Compare it with yours."), and the low-confidence line "Not sure about this one. Check with your coach."
- Second-try screen: same motion, same exchange; shows the before/after body line "Face touches: 4 → 1" (from BodyTrack counts of attempt 1 and 2) next to the chain comparison. The body beat is REQUIRED in the video.

## Homework first (the product is speaking homework; the app is the delivery)
- The hero is the STUDENT improving: hint -> retry -> the weak link holds. The coach view is a small supporting panel, never the hero.
- Launch-tomorrow test: a teacher makes a shareable assignment link (pasteable into LINE, Google Classroom or Canvas); the student opens it, enters a first name, does the exercise with retries; the coach sees who did it and what broke. No platform plugins.
- Assignment API (server, lead):
  - POST /api/assignments {"motion_id","mode","title","due"} -> {"id","motion_id","mode","title","due","created","url":"http://host/a/<id>"}
  - GET  /api/assignments -> [assignment + {"submissions":[{"name","tries","first_break","last_break","fixed"}],"attempts":n}]
  - GET  /api/assignments/<id> -> one assignment with submissions
  - GET  /a/<id> serves index.html; the app reads location.pathname "/a/<id>" and opens that assignment.
  - POST /api/attempts also takes "assignment_id", "attempt" and "student" (first name only).

## API
- GET  /api/health -> {"gmi":true|false,"model":"...","mode":"live|replay"}
- GET  /api/motions -> [Motion] (at least 3 presets)
- POST /api/analyze -> AnalyzeResult (gmi live; if no key or model error: replay for the SAMPLE transcripts, else {"error":"..."} with 503)
- POST /api/attempts {result, motion_id, student:"You", body:{...}} -> {"ok":true}
- GET  /api/class -> {"students":[{"name":"SAMPLE Student A","last_break":"dropped_argument","tries":3}...], "breaks":{"dropped_argument":9,...}, "review":[{id, transcript, result}]}
- POST /api/review {id, verdict:"agree|disagree"} -> {"ok":true}

## Body track (web/body.js) exposes window.BodyTrack
- async init(videoEl) -> {ok:true} | {ok:false, reason}
- start() : 3 s baseline, then detection; onStatus(cb) gives live {posture,hands,facing} as "ok"|"off"
- stop() -> {"marks":[{"t":"0:42","type":"slouch|sway|face_touch","label":"Shoulders forward"}] (max 2),
            "counts":{"face_touch":4,"sway":1,"slouch":0}, "line":"one safe on-screen line"}
Rules and thresholds: design-spec.md section "Body language", with the research stream's defaults (all heuristics, tune live; every distance normalised by shoulder width = |landmark 11 - 12|):
- MediaPipe Pose Landmarker lite, runningMode VIDEO, ~12 fps. Landmarks: 0-10 face (ears 7, 8), 11-16 shoulders to wrists, 17-22 hand points; ignore 23-32 (seated).
- Baseline: first 3 s of each attempt ("sit tall").
- Slouch: ear height above the shoulder line drops >= 18% below baseline for 4+ s (nose dropping vs ears = looking down, not slouching).
- Sway: detrended shoulder-midpoint x reverses direction 3+ times by > 0.1 shoulder widths within 10 s.
- Face/hair touch: any of 15-22 within 0.4 shoulder widths of any of 0-10 for >= 1 s; count events.
- Facing the screen: nose centred between the ears; never call it eye contact.
- Hands out of frame = unknown, never "no gestures".
- Feedback tone: open with a strength; one "try this" after the speech; no live nagging during the speech (the live dots only show that tracking is on); compare to the child's own baseline; describe movements as "distracting to your listener", never "nervous"; no power-pose, hormone, lying or eye-contact claims.
- Safe lines: "Sit tall: it can help you feel calmer and more confident." / "Show it with your hands: gestures help people follow you." / "Hands near your face pull attention from your words." / "You probably did better than it felt."
Never "eye contact", never "nervous".

## UI calls chain.js
window.Chain.render(svgContainer, motion, result, {animate:true}) and window.Chain.compare(container, motion, resultA, resultB).

## Done means
A judge can: pick a motion, speak 60 s (or type), see the report with the broken link marked and one hint, try again, see before/after with "Fixed in 2 tries", see two body marks, open the coach view. Every synthetic thing on screen says SAMPLE.
