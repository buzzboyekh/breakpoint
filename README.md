# Breakpoint

**An AI sparring partner that shows kids exactly where their argument breaks, then makes them fix it themselves.**

Work in progress at c0mpiled-18 (YC Startup School Hackathon, Taipei, 2026-11-11). Everything in this repo was written during the build session (from 18:45). The team's planning notes (idea, research, design tokens and on-screen copy) were drafted before the build session started, as the rules allow.

## Run
```bash
python3 server.py
```
Open http://127.0.0.1:8765 in Chrome. AI calls use GMI Cloud; put `GMI_API_KEY=...` in `~/hack/.gmi.env` (never committed). Without a key the app replays recorded runs, labelled "Recorded run".

See CONTRACT.md for the data shapes.
