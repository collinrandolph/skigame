# v2 handoff guide

For whoever picks this up next, person or model. Read this first, then `V2-MIGRATION.md` (the port map) and `planets/V2-WORLD.md` (the world as built). Problems that v2 cannot fix (terrain, planet size, trail layout, look) are logged in `V3-IDEAS.md`: add to it when you hit one.

Everything is on branch `v2`. Nothing here needs a build step.

## 1. Run, play, test

```sh
# play
python3 -m http.server 8000
# open http://localhost:8000/prototypes/planetoid.html?layout=../planets/v2-world.json

# rules tests (Node only)
node tools/test/game-core.test.js

# browser tests (Playwright + Chromium + a local three.js r128 build)
cd tools/test/browser
THREE_JS=/path/to/three.min.js node play.js       # chapters 1 to 6 in the real page
THREE_JS=/path/to/three.min.js node controls.js   # keyboard, controller, touch, trail assist

# rebuild the world and audit it (Node, Python 3 with numpy, scipy, matplotlib)
cd tools/world
export WORLD_WORK=/tmp/world && mkdir -p $WORLD_WORK
REF=../../planets/reference/planet-ai-pass.json
(cd $WORLD_WORK && node "$OLDPWD/sample_terrain.js" "$OLDPWD/$REF")
python3 build_surface.py
node build_world.js $REF $WORLD_WORK ../../planets/v2-world.json
python3 verify_zones.py
cp $WORLD_WORK/report.json ../../planets/v2-world-report.json
python3 draw_world.py ../../planets/v2-world-map.png
python3 draw_underground.py ../../planets/v2-underground.png ../../planets/v2-world.json
node dump_lines.js ../../planets/v2-world.json $WORLD_WORK/v2lines.json
python3 audit_views.py ../../planets/v2-world.json ../../planets/v2-view-audit

# or, in one step: build and audit (prints the audit's summary)
./round.sh
# add scenery wishes for whatever the audit still calls bare, then build again
python3 fill_views.py && ./round.sh

# look at a spot in the real page: lon,lat,compass bearing (writes view-1.png ...)
cd ../test/browser && node views.js "-77.73,-16.51,2"
```

## 2. Rules that do not change

1. **The terrain is the owner's.** `planets/reference/planet-ai-pass.json` supplies the ground. Never edit its sculpt, stamps or noise. Trails, props, bridges and the underground are ours to design.
2. **Generated files are never edited by hand.** `planets/v2-world.json`, `v2-world-report.json`, the map PNGs and `v2-view-audit.*` come from `tools/world/`. Change the generator and rebuild.
3. **One control scheme** for keyboard, controller and touch: the base game's (`index.html`). Classic and double-pole modes are deprecated. Do not add control modes.
4. **Game rules live in `prototypes/game-core.js`** and must run in Node with no drawing code. The page (`prototypes/planetoid.html`) only draws what the rules report.
5. **The ship choice is cut** from the ending.
6. Every change ends with: unit tests pass, both browser tests pass, `verify_zones.py` reports all zones separate, and the audit has been re-run if the world changed.
7. Commit to `v2` only. Describe what changed and why in the message.

## 3. Where things stand

| Area | State |
|---|---|
| World on the owner's terrain: zones, gates, 8 terminals, drawbridges, light bridges, mine, crystals | Done, committed |
| Chapters 1 to 6 playable in the page, with save and checkpoints | Done, tested |
| Controls port (base game scheme on keyboard, controller, touch) | Done, tested |
| Chapters 7 to 9 (moose puzzle, crown crystals, ceremony, Starway) | **On hold.** Rules are in `game-core.js` and the props are in the world, but the page draws none of it and there are no tests for it. The owner wants this redesigned using the audit (section 6, task F) before more is built. |
| View audit | Tool written (section 4) |
| Scenery pass | Done: 147 landmarks and trailside props placed from the audit. Bare ride 38% to 3% |
| Minimap, sound, tutorial, set dressing, drawbridge animation, tilt, pinch | Not started |
| New visual look | Not started (section 6, task H) |

## 4. What the audit found

Full numbers: `planets/v2-view-audit.md`. Map: `planets/v2-view-audit.png`.

The owner's playtest complaint was long stretches of monotony. The first audit agreed, and the scenery pass was built from it.

| Zone | Trail | Bare before | Bare now |
|---|---|---|---|
| 1, the Bowl | 0.9 km | 1% | 1% |
| 2 | 12.0 km | 42% | 2% |
| 3 | 9.0 km | 50% | 2% |
| 4 | 2.2 km | 15% | 4% |
| Highlands | 2.5 km | 12% | 11% |

- Before: 38% of the ride bare, 63 bare stretches of 120 m or more, the longest 610 m.
- Now: 3% bare, no bare stretch of 120 m or more.
- Crests and openings with a landmark in line: 21 of 115 before, 60 now. The other 55 have no room where the landmark would need to stand.
- The summit is still on screen for only 5% of the ride. Props cannot change that (see `V3-IDEAS.md`).

The scores say something is on screen. They do not say it looks good: the owner has not playtested the scenery pass yet.

**Why.** The planet is small. The camera sits 9.3 m up and the page draws the planet as if it were 917 m in radius. Level ground drops out of sight 131 m away. How far off a thing can be seen depends on its height:

| Height | Seen from up to |
|---|---|
| 5 m | 227 m |
| 10 m | 266 m |
| 15 m | 297 m |
| 30 m | 366 m |
| 60 m | 462 m |
| 100 m | 559 m |
| 186 m (the summit) | 715 m |

Most current props are under 10 m, and the mountain ranges are too low to show from the plains. So a vista on this planet has to be tall, lit, or in the sky.

**What the audit cannot see yet:** the woods (the page scatters trees from its own noise field), the sky, weather and light. Model heights in `audit_views.py` (`HEIGHT`) are estimates.

## 5. The summit and the Starway

Two findings.

1. **Fixed.** The Starway used to set the skier down on the summit's rim, on ground too steep to stand on (slope 0.62; the limit is 0.4). `build_surface.py` now lands it on level ground 24 m from the peak.
2. **Open, needs the owner's decision.** The owner sculpted shelves around the summit as stepping stones for light bridges. The current Starway ignores them: it is one 1.2 km spiral over the plain. The shelves:

| Shelf | Centre (lon, lat) | Height | Area |
|---|---|---|---|
| S1 | -127.1, -58.8 | 31–54 m | 0.68 ha |
| S2 | -136.5, -39.0 | 77–87 m | 0.55 ha |
| E1 | -125.7, -24.4 | 43–57 m | 0.53 ha |
| E2 | -136.9, -15.5 | 95–111 m | 0.07 ha |
| E3 | -150.0, -13.8 | 148–153 m | 0.03 ha |
| W1 | -175.1, -29.6 | 23–44 m | 0.71 ha |
| W2 | 175.8, -36.7 | 90–95 m | 0.07 ha |
| N1 | -155.4, -1.8 | 63–69 m | 0.06 ha |
| N2 | -135.0, -6.4 | 63–72 m | 0.16 ha |
| Summit | -150.5, -23.0 | 180–186 m | 0.35 ha |

Straight spans that clear the ground, found so far: S1 to S2 (241 m at 15%), W2 to summit (290 m at 32%), plain to N1 (503 m at 13%). The others need curved decks, because the rise between shelves is 35 to 50 m over about 100 m. A skier can climb about 20 to 24% on a bridge.

Recommended redesign (not built): replace the spiral with a staircase of light bridges, plain to S1 to S2 to summit or plain to E1 to E2 to E3 to summit, each shelf a rest stop with something on it. This gives the ending a rhythm and a view at every step. Ask the owner which chain they sculpted for before building.

## 6. Work queue

Each task is self-contained. "Model" is the suggested minimum; a stronger model is always fine.

### A. Scenery pass (done once; repeat after any trail or terrain change) (Sonnet)

The scenery is a wish list, `tools/world/scenery.json`. `build_surface.py` places each entry near its point if there is room, after all story props. `fill_views.py` writes wishes from the audit: a tall landmark on the heading of each bare stretch and each empty crest, and a small prop beside the trail every 90 m. Each zone has its own kit (`KIT` in `fill_views.py`).

To repeat: `./round.sh`, then `python3 fill_views.py && ./round.sh` until the summary stops changing (two or three rounds).

To tune by hand:

- Edit `scenery.json` directly. An entry is `{id, lon, lat, zone, scale, reach, off, far, kind}`. `reach` is how far from the point it may stand; `off` and `far` are the least and most it may stand from a trail.
- To change what a zone gets, edit `KIT`, delete that zone's entries from `scenery.json`, and run the rounds again.
- Use the height table in section 4. A landmark meant to be seen from 250 m or more must be 15 m or taller.
- Look at the result with `tools/test/browser/views.js` before trusting a score. The fossil (`ribs`) was dropped from the kit because it looked wrong scaled up.
- Run both browser tests afterwards.

Still open: the highlands are 11% bare, and 55 crests have nothing in line.

The owner's verdict on the first pass: it looks random. That is fair: models were picked in rotation to fill gaps. What should replace it, zone by zone, is in `V3-IDEAS.md` under "Replacing the v2 scenery pass". Any further v2 scenery work should follow those rules (sites, one motif per trail, named landmarks, lines that lead somewhere).

### B. Tall landmark models (Fable or Opus for the first three; Sonnet for the rest)

`models.js` has few tall things. Add new ids in the existing style (flat-shaded, low-poly, built from `bx`, `cy`, `tube`). Wanted, each 15 to 40 m tall:

- a rock arch the trail passes through
- a leaning radio mast with a blinking light
- a wind turbine that turns
- a frozen waterfall for cliff faces
- a lantern post (3 m, for trailside rhythm, lit at night)
- a ruined pylon pair (dormant light-bridge feet, to stand at every future bridge)

Register each in `BUILD`, add its height to `SIZE` in `build_surface.py` and `HEIGHT` in `audit_views.py`, and add it to `gallery.html`.

### C. Terminal beacons (Sonnet)

When a terminal is activated, it throws a column of light 60 m high that stays on. Rules side: `G.modelVariant` already reports terminal state. Page side: add the column in `syncModels`. This makes progress visible on the horizon and fills the sky as the player goes. Add a `play.js` check that the column exists after activation.

### D. Sky bodies (Fable or Opus)

Three or four large bodies fixed in the sky (a ringed planet, a moon, the station, the black hole). Because the planet is small the sky turns as the skier travels, so each body hangs over one region and works as a landmark. Place them so the longest bare stretches in zones 2 and 3 point at one. The audit does not measure the sky; add a pass to `audit_views.py` that reports, per bare stretch, which body is within 20° of the heading and above the horizon.

### E. Teach the audit about the woods (Sonnet)

Move the woods test out of `buildTrees` in `planetoid.html` (the `noise3` field and thresholds) into `planet-terrain.js` as `PT.woodsAt(d)`. The page calls it; `dump_lines.js` writes a woods mask; `audit_views.py` adds a class "in the woods" and stops counting forest as bare. Check the page still plants the same trees (same seed, same count).

### F. Redesign chapters 7 to 9 (Fable or Opus, after the owner answers section 5)

The rules as written: a calf follows the skier; a calf wakes the giant asleep on the Broken Circle; three calves on the court's diamonds crown the skier; the crown opens the crown door in the mine; 30 crown crystals offered at the altar light the Starway; reaching the top ends the game. State and cheats are in `game-core.js` (`calf`, `giant`, `crowned`, `crown`, `ceremony`).

Change it so the ending uses the shelves and can be seen from far off:

- the Starway becomes the staircase from section 5
- the giant should stand where it shows on the skyline from zone 3 (it is 26 m long; standing it is about 25 m tall)
- each stage should light something tall, so the player sees the ending assemble

Then the page work: honour `G.modelHidden`, draw calves from `G.calves()`, purple outfit when crowned (`SKIER.setOutfit(true)`), crown crystals on the crown layer, an end screen. Add unit tests and extend `play.js`.

### G. Remaining port (see `V2-MIGRATION.md` section 3)

| Item | Model |
|---|---|
| Minimap and big map on a sphere | Opus |
| Drawbridge towers and lifting animation | Opus |
| Mine props, teleporter, space station | Opus |
| Sound, tutorial | Sonnet |
| Set dressing: attendants, musicians, fireworks | Sonnet |
| Tilt to lean, pinch zoom on the scene | Sonnet |
| Docs, map redraws, test upkeep | Haiku |

### H. The new look (Fable if any is left; otherwise Opus, one piece at a time)

Do it on zone 1 only, behind a quality setting, and let the owner playtest before rolling out. In order of value:

1. Tone mapping, and bloom kept for lights only.
2. Atmosphere: rim glow, a visible day and night line, valley fog.
3. Snow: blue shadows, sparkle, corduroy on trails, ski tracks that stay.
4. Night: lit lanterns, aurora, a dense star field.
5. The river as ice with dark open water.

Must hold 60 fps on a phone at the low setting. The page uses three.js r128 from a CDN; do not change the version without running both browser tests.

## 7. Things that will trip you up

- **Places are unit vectors** `d` from the planet's centre. Distance is `R * angle`. The tools speak (lon, lat) in degrees; `geo.py` has `d_of` and `ll_of`.
- **Model `rot`** is the compass bearing of the model's −z. Gates and the mine portal have their doorway across z, so `rot = trail bearing − 90`. The crystal gate's passage runs along z.
- **Bridges** are `{name, pts, clearance, ramp, width, kind}`. `kind: 'draw'` is a drawbridge, `'light'` a light bridge. `PT.bridgeDeck(bridge, T.height, R)` gives the deck.
- **The `game` block** in the layout carries zones, terminals, gates, bridges and story data. `planet-terrain.js` passes it through untouched.
- **The headless page is slow.** In browser tests, send timed input sequences inside one `page.evaluate`, or timers expire between calls.
- **Test hooks** are on `window.__planetoid` (`game`, `TEST.place`, `TEST.ghost`, `ctl()`). Use `game.cheat(...)` to jump chapters.
- **Zones are sealed by cliffs** steeper than 0.4. A prop or trail edit cannot break that, but a new bridge can: `verify_zones.py` lists what each bridge joins.
- **`v2-world.json` is 4 MB.** Do not open it in an editor or paste it into a prompt. Query it with a short script.
