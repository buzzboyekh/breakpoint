#!/bin/sh
# Clear saved attempts and homework links (data/ is not in git). Run before recording the demo.
cd "$(dirname "$0")/.." && rm -f data/attempts.json data/assignments.json && echo "demo data cleared"
