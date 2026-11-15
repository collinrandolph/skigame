#!/bin/sh
# One round of: build the world, audit its views. Needs WORLD_WORK set and the terrain sampled (see README.md).
set -e
cd "$(dirname "$0")"
REF=../../planets/reference/planet-ai-pass.json
python3 build_surface.py | grep -i "scenery\|!!\|warnings" || true
node build_world.js $REF $WORLD_WORK ../../planets/v2-world.json | grep -i "warn\|steep" || true
node dump_lines.js ../../planets/v2-world.json $WORLD_WORK/v2lines.json > /dev/null
python3 audit_views.py ../../planets/v2-world.json ../../planets/v2-view-audit | tail -2
