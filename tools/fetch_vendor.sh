#!/bin/sh
# Optional: host the MediaPipe pose files locally so body tracking works offline (about 25 MB).
set -e
V=0.10.14
D="$(dirname "$0")/../web/vendor/mediapipe"
mkdir -p "$D/wasm"
B="https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@$V"
curl -sfL -o "$D/vision_bundle.mjs" "$B/vision_bundle.mjs"
for f in vision_wasm_internal.js vision_wasm_internal.wasm vision_wasm_nosimd_internal.js vision_wasm_nosimd_internal.wasm; do
  curl -sfL -o "$D/wasm/$f" "$B/wasm/$f"
done
curl -sfL -o "$D/pose_landmarker_lite.task" "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task"
echo "saved to $D"
