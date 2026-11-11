# v2 world builder

Generates `planets/v2-world.json` from a reference planet. Needs Node, Python 3 with numpy, scipy and matplotlib.

```sh
cd tools/world
export WORLD_WORK=/tmp/world && mkdir -p $WORLD_WORK
REF=../../planets/reference/planet-ai-pass.json
(cd $WORLD_WORK && node "$OLDPWD/sample_terrain.js" "$OLDPWD/$REF")   # the ground, as the game builds it
python3 build_surface.py                                              # trails, zones, gates, terminals, props
node build_world.js $REF $WORLD_WORK ../../planets/v2-world.json      # underground, merge, checks
python3 verify_zones.py                                               # zones sealed, everything in its zone
python3 draw_world.py ../../planets/v2-world-map.png
python3 draw_underground.py ../../planets/v2-underground.png ../../planets/v2-world.json
```

| File | Does |
|---|---|
| `sample_terrain.js` | Samples the reference planet's heights with `planet-terrain.js` |
| `geo.py` | The height grid and a routing graph over it |
| `build_surface.py` | The world's content. Edit the section headed "the world" to move loops, links and props |
| `build_world.js` | Digs the mine with the planet's ramp, tunnel and chamber tools; writes and checks the layout |
| `find_bridge_span.py` | Searches every zone for a light-bridge span up to the highlands |
