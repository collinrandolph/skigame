# Hale: the v3 prototype

A playable prototype of the skate ski game on a new base: a new planet, a new renderer, a new skier model. Only the controls, the ski physics and the skier's animation come from the game, and those are unchanged.

## Play

```sh
python3 -m http.server 8000        # from the repo root, on branch v3
# open http://localhost:8000/v3/index.html
```

- `?q=low`, `?q=mid` or `?q=high` sets the quality. Touch devices start on low; everything else on high.
- Controls are the game's: arrows or A/D to kick, hold to glide, Space for a loaded stroke, Up to tuck, Down to snow plow. Controller and touch pads as in the game.
- `V` planet view, `R` back to the last lit beacon, `H` hide the interface.

## The game in the prototype

1. Each of the four loops has six ore cells on it. Collect all six and that loop's beacon lights.
2. Lighting a beacon also lights the lamps round its loop and the pylons on the road that leads to it.
3. With all four lit, the Heartcrystal wakes and the Ascent opens: a bridge of light that winds up the crystal.
4. The top of the Ascent ends the game.

Progress saves in the browser.

## The world

Hale is 600 m in radius with about 8.3 km of trail, designed trails-first: the trails are laid out by hand, the ground is shaped round them, and every prop is there for a reason. It follows the concept art.

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
| `js/skier.js` | Controls, ski physics, camera, input. **The blocks between `lifted` markers are the game's own code, copied unchanged from `prototypes/planetoid.html` on `v2`.** The rest is the adapter to v3's world |
| `js/skier-anim.js` | The skier's animation, unchanged from `models.js` |
| `js/figure.js` | The new, higher-detail skier, built on the same joints so the animation drives it |
| `js/props.js` | Every building, ruin, crystal and creature |
| `js/main.js` | Renderer, shaders (ground, sky, Mother), bloom, scenery, the game, the frame |
| `tools/play.js` | Plays the game in headless Chromium: 18 checks from boot to the ending |
| `tools/shot.js` | Screenshots from given spots and times of day |
| `tools/map.js`, `map.py` | A flat map of the layout |

One thing in `skier.js` is new and not from the game: `bridgeAssist`. The game's trail assist stands down on bridges, and the Ascent is a kilometre of curve, so the same kind of nudge follows the bridge's line.

## What has and has not been checked

Checked, in headless Chromium with a software renderer:

- It boots with no page errors; `tools/play.js` passes 18 of 18.
- Keyboard skating builds speed and stays on the trail; tuck and plow work.
- Cells light a beacon; four beacons open the Ascent; the Ascent carries you up; the top ends the game.

Not checked:

- **No person has played it.** How it feels is unknown.
- **Frame rate on real hardware**, phones above all. The software renderer says nothing about it.
- **Controller and touch.** That code is copied unchanged, but nothing in v3 has exercised it.
- **The view audit** has not been run on this world, so the claim that it is less monotonous than v2 is a design intention, not a measurement.

## Known gaps

- No sound, minimap or tutorial.
- No story beyond the beacons: no mine interior, no cave dwelling, no crystal search, no moose puzzle.
- Trees and props cast shadows only near the skier.
- The ground mesh is a few centimetres off the ground the physics uses, in places.
- Night at the Court is brighter than the art.

## Next steps, in order of value

Each is self-contained. The suggested model is the minimum.

| Step | Model |
|---|---|
| Playtest, then tune: trail lengths, cell spacing, the Ascent's length and grade (`world.js`: `LOOPS`, `LINKS`, `BRIDGE`) | Owner, then Sonnet |
| Port the view audit to read `world.js` and score this world (`tools/world/audit_views.py` on `v2` is the model) | Opus |
| Measure frame rate on a phone; cut tree count, ground resolution or bloom for `?q=low` as needed | Sonnet |
| Exercise controller and touch in `tools/play.js` (the v2 `controls.js` test is the model) | Sonnet |
| Sound: skis, wind, a tone per beacon, the crystal waking | Sonnet |
| A second act: the Cut's canyon as a skiable cave with the cave dwelling inside | Fable or Opus |
| The moose puzzle at the Court, in this world | Opus |
