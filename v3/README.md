# Hale: the v3 prototype

A playable prototype of the skate ski game on a new base: a new planet, a new renderer, a new skier model. Only the controls, the ski physics and the skier's animation come from the game, and those are unchanged.

## Play

```sh
python3 -m http.server 8000        # from the repo root, on branch v3
# open http://localhost:8000/v3/index.html
```

- `?q=low`, `?q=mid` or `?q=high` sets the quality. Touch devices start on low; everything else on high.
- Controls are the game's: arrows or A/D to kick, hold to glide, Space for a loaded stroke, Up to tuck, Down to snow plow. Controller and touch pads as in the game.
- `V` planet view, `R` back to the last terminal you powered, `H` hide the interface.

## The game so far

v3 is being built in stages toward the full story (see "The plan" below). Stage 1 is in: the first three chapters.

1. **Frostline.** Two terminals. Ski up to one, agree to start it (Enter, E, the controller's A, or tap the offer), fetch its orbs from along the trail, come back. With both live, the East gate opens.
2. **Frostveil.** Three terminals. With all live, the post at the end of Haul Road will lower the East drawbridge over the canyon.
3. **The Cut.** Three terminals, across the canyon.

The rules are `js/game-core.js`, the same module v2 uses: v3's world describes itself in the block that module reads (`W.GAME` in `world.js`). Progress saves in the browser. `R` returns you to the last terminal you powered.

Not built yet: the mine, the crystal search, the Court's moose puzzle, the crown, the ceremony. The Crystal gate, the South pass gate and the Crown gate are in place and shut. For testing, `?cheat=zone1,zone2,bridges,ceremony` skips ahead (the ceremony lights the Ascent, which ends the game at its top).

## The world

Hale is 600 m in radius with about 8.3 km of trail, designed trails-first, in four zones walled off from each other by ridges and by a canyon that only the drawbridges cross: the trails are laid out by hand, the ground is shaped round them, and every prop is there for a reason. It follows the concept art.

| Place | What is there | From the art |
|---|---|---|
| Frostline Loop (start) | Landing pad and shuttle, habitat dome, research tower, dish | Frostline-3 outpost |
| Frostveil | The Sleeping Ribs, the Watcher (150 m), the Spine Arch over the road in, a signal tower | Frostveil ruins |
| Court Round | The Broken Circle, the temple, columns with crystal finials, robed and crowned moose, purple crystals | Moose ritual |
| The Cut | Ore scars, the digger, ore veins glowing in the canyon walls | Cave dwelling (the mining) |
| The Heartcrystal | A 190 m crystal on a mound, the Ascent spiralling up it, four moose of light at the end | Spiral crystal vault, ritual |
| The sky | Mother (the purple ringed giant), a moon, the Orbital Gateway in orbit | Ritual, Orbital Gateway |

The planet turns under the sun once every 24 minutes, so day, dusk and night are places you ski through.

## Files

| File | What it is |
|---|---|
| `index.html` | The page and the interface |
| `js/world.js` | The planet: ground, trails, sites, the bridge, the trees. Plain maths; runs in Node |
| `js/game-core.js` | The story's rules: a copy of v2's `prototypes/game-core.js` (only the goal text differs). No drawing in it; runs in Node |
| `js/skier.js` | Controls, ski physics, camera, input. **The blocks between `lifted` markers are the game's own code, copied unchanged from `prototypes/planetoid.html` on `v2`.** The rest is the adapter to v3's world |
| `js/skier-anim.js` | The skier's animation, unchanged from `models.js` |
| `js/figure.js` | The new, higher-detail skier, built on the same joints so the animation drives it |
| `js/props.js` | Every building, ruin, crystal and creature |
| `js/main.js` | Renderer, shaders (ground, sky, Mother), bloom, scenery, the game, the frame |
| `tools/play.js` | Plays the game in headless Chromium: 25 checks from boot through chapters 1 to 3 to the ending |
| `tools/zones.js` | Proves the zones are sealed: floods the skiable ground with every gate shut and every bridge up |
| `tools/shot.js` | Screenshots from given spots and times of day |
| `tools/map.js`, `map.py` | A flat map of the layout |

One thing in `skier.js` is new and not from the game: `bridgeAssist`. The game's trail assist stands down on bridges, and the Ascent is a kilometre of curve, so the same kind of nudge follows the bridge's line.

## What has and has not been checked

Checked, in headless Chromium with a software renderer:

- It boots with no page errors; `tools/play.js` passes 25 of 25.
- Keyboard skating builds speed and stays on the trail; tuck and plow work.
- A shut gate holds and says why. A terminal is offered, started with Enter, its orbs fetched, and powered on return. With the zone live the gate lets you through.
- A raised drawbridge does not carry you; lowered at its post, it carries you across the canyon.
- Progress survives a reload.
- With the ceremony cheated, the Ascent carries you up and its top ends the game.
- `tools/zones.js`: the four zones and the crown are five separate grounds, at the game's steepness limit and at 1.3 times it, and every terminal and orb is on its own zone's ground.

Not checked:

- **No person has played it.** How it feels is unknown.
- **Frame rate on real hardware**, phones above all. The software renderer says nothing about it.
- **Controller and touch.** That code is copied unchanged, but nothing in v3 has exercised it.
- **The view audit** has not been run on this world, so the claim that it is less monotonous than v2 is a design intention, not a measurement.

## Known gaps

- No sound, minimap or tutorial.
- Chapters 4 to 9 are not built (see the plan).
- Each zone has one loop, so two terminals in a zone send you round the same loop. More loops per zone would fix it.
- Trees and props cast shadows only near the skier.
- The ground mesh is a few centimetres off the ground the physics uses, in places.
- Night at the Court is brighter than the art.

## The plan

Each stage ends playable. Update this table and the sections above when a stage lands.

| Stage | What | State | Model |
|---|---|---|---|
| 1 | Zones, gates, terminals, drawbridges; chapters 1 to 3 on v2's rules | **Done** | |
| 2 | The mine: an underground for this base (the cave dwelling from the art, the teleporter, the altar cave), entered from the Cut | Not started | Fable or Opus |
| 3 | Crystal search: highlands reached by a light bridge, 20 crystals, offered at the Crystal gate; the Court opens | Not started | Opus |
| 4 | The Court: calves, the sleeping giant, the crown; the crown room in the mine; the ceremony; the Ascent as the Starway | Not started | Opus |
| 5 | Sound, minimap, tutorial; the view audit ported to score Hale; a frame-rate pass for phones; controller and touch tests | Not started | Sonnet (audit: Opus) |

### Notes for whoever does the next stage

- **The rules already cover chapters 4 to 9.** `game-core.js` reads optional parts of `W.GAME`: `underground` (layers, `crystalAltar`, `teleporter`, `crownDoor`, `crownCrystals`, `rampStart`), `crystals`, `calves`, `court`, `giant`, `starway`. Add those to `GAME` in `world.js` as each stage builds the places, and the rules switch on. v2's `planets/v2-world.json` on branch `v2` shows the shape of every field.
- **Pages tell the rules where the skier is** with `G.update({ n, ug })`; `ug` is the cave layer, or -1 on the surface. v3 always passes -1 today.
- **A new zone wall or road must keep the zones sealed.** Run `node tools/zones.js` after any change to `RIDGES`, `RIVER`, `LINKS` or `GATES`.
- **The skier's code is not to be edited** between the `lifted` markers in `skier.js`. Bridges, solids and the ground reach it through `createSkier(env)`.
- **Gates** stop you with a row of solids tagged with the gate's name; `main.js` switches them off when `G.gateOpen(name)`. Bridges are locked the same way through `sk.bridges[i].locked`.
- **Run `node tools/play.js`** (needs Playwright and `THREE_JS=path/to/three.min.js`, r128) before committing.
