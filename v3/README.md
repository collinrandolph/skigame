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

## The game

The whole story is in, on the rules module v2 uses (`js/game-core.js`). Nine chapters:

1. **Frostline.** Two terminals. Ski up to one, agree to start it (Enter, E, the controller's A, or tap the offer), fetch its orbs from the trails, come back. Both live: the East gate opens.
2. **Frostveil.** Three terminals. All live: the post at the end of Haul Road lowers the East drawbridge over the canyon.
3. **The Cut.** Three terminals. All live: the mine's mouth opens, at the middle of the Pit Ring.
4. **The mine.** Ski in. A hall with a street of cave dwellings; the altar is in a cave off its west side. Wake it.
5. **Crystals.** Twenty rise on the trails of the first three zones. Find them.
6. **The Crystal gate**, on Antler Way. Offer them and the Court opens.
7. **The Court.** A calf from the herds follows you. Bring it to the giant asleep on the Broken Circle and the giant gets up. Three calves crowned on the diamonds and the court dresses you in purple.
8. **The Orbital Gateway.** The crown door in the mine now opens on a teleporter. It lifts you to the station: 30 crown crystals round its ring deck and spokes.
9. **The ceremony.** Offer them at the altar on the Broken Circle. The Crown gate opens and the Ascent lights; its top ends the story.

Progress saves in the browser. `R` returns you to the last terminal you powered (or, underground or in orbit, to where you came in). For testing, `?cheat=` takes any of `zone1,zone2,zone3,bridges,altar,crystals,offered,crowned,crown,ceremony`.

## The world

Hale is 600 m in radius with about 8.3 km of trail, designed trails-first, in four zones walled off from each other by ridges and by a canyon that only the drawbridges cross. Each zone is a small network: a main loop, a ring or second loop, and lanes between them (12.9 km of trail in all).

Two more places are "realms": other shells of the same sphere, reached only through a portal. The mine is 120 m down; the Orbital Gateway is 900 m up and can be seen from the surface.

The surface: the trails are laid out by hand, the ground is shaped round them, and every prop is there for a reason. It follows the concept art.

| Place | What is there | From the art |
|---|---|---|
| Frostline Loop (start) | Landing pad and shuttle, habitat dome, research tower, dish | Frostline-3 outpost |
| Frostveil | The Sleeping Ribs, the Watcher (150 m), the Spine Arch over the road in, a signal tower | Frostveil ruins |
| Court Round | The Broken Circle, the temple, columns with crystal finials, robed and crowned moose, purple crystals | Moose ritual |
| The Cut | Ore scars, the digger, ore veins glowing in the canyon walls | Cave dwelling (the mining) |
| The Heartcrystal | A 190 m crystal on a mound, the Ascent spiralling up it, four moose of light at the end | Spiral crystal vault, ritual |
| The mine | The adit, a hall with a street of dwellings, the altar's cave, the mined terraces, the crown door and teleporter | Cave dwelling |
| The Orbital Gateway | Hub, ring deck, four spokes, docked ships, the transit portal | Orbital Gateway |
| The sky | Mother (the purple ringed giant), a moon | Ritual |

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
| `tools/play.js` | Plays the game in headless Chromium: 47 checks, from boot through all nine chapters to the ending |
| `tools/zones.js` | Proves the zones are sealed: floods the skiable ground with every gate shut and every bridge up |
| `tools/shot.js` | Screenshots from given spots and times of day |
| `tools/map.js`, `map.py` | A flat map of the layout |

One thing in `skier.js` is new and not from the game: `bridgeAssist`. The game's trail assist stands down on bridges, and the Ascent is a kilometre of curve, so the same kind of nudge follows the bridge's line.

## What has and has not been checked

Checked, in headless Chromium with a software renderer (`tools/play.js`, 47 of 47, no page errors):

- Keyboard skating, tuck and plow; trail assist.
- Chapters 1 to 3: a shut gate holds and says why; a terminal from offer to powered; the gate opens; the drawbridge up, then lowered and crossed.
- Chapter 4: skiing into the portal takes you down; you can ski there; the altar is offered and wakes; the crown door is shut.
- Chapters 5 and 6: twenty crystals found; the Crystal gate takes them and opens.
- Chapter 7: a calf follows; the giant wakes; three calves crowned; the skier wears purple; the crown door opens.
- Chapter 8: the teleporter lifts you to the station; you can ski there; thirty crown crystals.
- Chapter 9: the altar takes them; the Crown gate opens; the Ascent carries you up; its top ends the game.
- Progress survives a reload, early and late.
- `tools/zones.js`: the four zones and the crown are five separate grounds, at the game's steepness limit and at 1.3 times it.

The test moves the skier from place to place for the later chapters; it does not ski the distances between them.

Not checked:

- **No person has played it.** How it feels, how long it takes, and whether the later chapters are clear without the test's knowledge are all unknown.
- **Frame rate on real hardware**, phones above all.
- **Controller and touch.** That code is copied unchanged, but nothing in v3 has exercised it.
- **The view audit** has not been run on this world.

## Known gaps

- No sound, minimap or tutorial.
- The mine is one hall, not the layered cavern of the painting; its dwellings are plain stacked boxes.
- From the station the planet is under the deck, so you mostly see it past the rim. A glass floor or a lower camera would show it better.
- The calves slide rather than walk, and the giant gets up by vanishing and reappearing.
- A reload while in the mine or on the station puts you back on the surface.
- Trees and props cast shadows only near the skier.
- Night at the Court is brighter than the art.

## The plan

| Stage | What | State |
|---|---|---|
| 1 | Zones, gates, terminals, drawbridges; chapters 1 to 3 | Done |
| 1b | A trail network in every zone | Done |
| 2 | The mine and the Orbital Gateway, as realms | Done |
| 3 | Crystals and the Crystal gate | Done (the crystals are on the first three zones' trails, not in a highland zone) |
| 4 | The Court, the crown, the ceremony, the Ascent | Done |
| 5 | Sound, minimap, tutorial; the view audit ported to score Hale; a frame-rate pass for phones; controller and touch tests | Not started (Sonnet; the audit: Opus) |
| 6 | Polish from playtesting: the mine's look, creature animation, the station's view of the planet | Not started |

### Notes for whoever does the next stage

- **The rules read `W.GAME`** (`world.js`): zones, terminals, gates, bridges, `underground` (the realms as layers: 0 the mine, 1 the station), `crystals`, `calves`, `court`, `giant`, `starway`.
- **A realm** (`makeRealm` in `world.js`) is a centre direction where no surface trail runs, a shell radius, and a floor given in metres east and north of the centre. The skier's code is told the realm's radius (`sk.P.R`) and height function, and nothing else changes for it. `main.js` `go(key, at)` moves between realms; `portals()` lists what triggers it.
- **The page tells the rules where the skier is** with `G.update({ n, ug })`; `ug` is the realm's layer, or -1 on the surface.
- **A new zone wall or road must keep the zones sealed.** Run `node tools/zones.js` after any change to `RIDGES`, `RIVER`, `LINKS` or `GATES`.
- **The skier's code is not to be edited** between the `lifted` markers in `skier.js`. Bridges, solids and the ground reach it through `createSkier(env)`.
- **Gates** stop you with a row of solids tagged with the gate's name; `main.js` switches them off when `G.gateOpen(name)`. Bridges are locked the same way through `sk.bridges[i].locked`.
- **Run `node tools/play.js`** (needs Playwright and `THREE_JS=path/to/three.min.js`, r128) before committing.
