# Skate Ski v2 migration map

Goal: one game on a real sphere, with v1's story and progression, the planet's terrain, weather and day/night.
Written against commit `a4d441f`. The world is `planets/v2-world.json`. Line numbers are approximate.

## 1. The trunk

**`prototypes/planetoid.html` becomes the game. `index.html` becomes the reference to port from.**

- The planet side is already data-driven: `planet-terrain.js` turns a layout file into ground, trails, bridges, caves and model placements, and the editor writes that file.
- The flat game hard-codes its world as math on (x, y): `zone2Height`, `riverY`, `GATE`, `BRIDGE`, `MINE`, about 69 `WORLD.` references. None of that survives a sphere.
- The planetoid already has the skating model, collisions, light bridges, an underground (`PT.caveField`, ramps, layers), weather, day/night and auroras.
- What it lacks is everything in section 3.

Naming to settle: the README calls `index.html` "2.0" and the planetoid "3.0". Pick one numbering before the first commit.

## 2. The seam

Ported game code may only talk to the world through this small interface. No flat (x, y), no direct terrain math.

| Need | Sphere form |
|---|---|
| A place | unit vector `d` from the planet's centre (as the layout already stores) |
| Distance | `R * angle(d1, d2)` |
| Ground | `heightAt(d)`, surface kind (trail, lawn, open) |
| Trails | nearest trail to `d`; a trail's polyline by name; walk a distance along it |
| Skier | position `n`, speed, `spawnAt(d, heading)` |
| Things | `place(modelId, d, rot)`, register and remove a solid |
| Player feedback | `toast`, `openPrompt`, `chime`, `save` |

Put the ported logic in a new `game-core.js` with a global namespace, the same pattern as `PlanetTerrain` and `SkiModels`. No build step.

## 3. Port order

| # | System | From `index.html` | Difficulty | Notes |
|---|---|---|---|---|
| 1 | Core: state, save/load, prompts, toasts, checkpoints, `checkInteract` | 2252–2340, 5896–5960 | Medium | Rewrite distance checks on `d`. One save key, versioned. |
| 2 | Terminals, orbs, gate and bridge controls | 3768–3890, 4010–4170 | Medium | The first slice. Loop finding can reuse `PT.trailNetwork`. |
| 3 | HUD goal label, minimap, big map | 6541–6670, 6740–6820 | Medium | Needs a sphere map; the editor's flat map is a starting point. |
| 4 | Altar, 20 crystals, crystal gate | 4416–4560 | Easy | Mostly placement plus state. |
| 5 | Audio, tutorial, twin-stick and touch input | 2342–2640, 2738–2960, 7984+ | Easy | Lift nearly verbatim; no world maths. |
| 6 | Moose, NPCs, herd, pet calf, giant | 4252–4860 | Hard | Path following and crumbs are flat today. |
| 7 | Starway, zone 5, court, ceremony, cosmic moose, black hole | 4867–5890 | Hard | Likely redesigned for the sphere rather than ported. |
| 8 | Underground | 1066–1730, 6853–7840 | Rebuild | Do not port. Author it as layout layers with the planet's cave tools. |
| 9 | Space station and teleporter rendering | 1098–1136, 6970–7140, 7640–7700 | Medium | The station is its own flat world, so it can stay flat. |

**Not ported:** the flat height functions (498–800), the tile ground renderer (3123–3470), the hard-coded trail list (903–1000).

## 4. What the layout must carry

New fields in the layout, so the editor stays the source of truth:

- **`zone`** on each terminal, trail and gate. `zoneAt(d)` becomes "the zone of the nearest trail".
- **Terminals:** `zone`, orb count, and optionally `loop` (trail names). Without `loop`, the game picks a loop from the trail network as v1 does.
- **Gates:** light bridges gain `gatedBy: <zone>` and a control post. On a sphere, a dark light bridge across unskiable ground is the natural gate.
- **Story props:** models gain a `role` (`altar`, `observatory`, `crystal-gate`, `mine-gate`, `ship`) so the game finds them without coordinates.
- **Crystals:** placed by rule beside landmarks, as in v1, or painted.

## 5. First slice: done when

On `planets/v2-world.json`, served over http:

1. Start, ski to Terminal 1, prompt appears, start it.
2. Ten orbs appear on a loop, magnet in, HUD counts them.
3. Return, terminal powers on. Repeat for Terminal 2.
4. With both powered, the East and North gates open.
5. Reload restores all of it and respawns at the last terminal.

## 6. The world

Built: `planets/v2-world.json`, described in `planets/V2-WORLD.md`. It carries a `game` block (section 4's fields:
zones, terminals with orbs, gates, bridge kinds, crystals, underground rooms), so the first slice has data to run on.

## 7. Conventions for later sessions

- Every new system registers `save()`, `load(data)`, `reset()` and `update(dt)` with the core.
- Every placement comes from the layout. A coordinate literal in game code is a bug.
- Each ported system gets a dev toggle in the Testing group, as v1 does.
- Keep `v1/` frozen. Keep `index.html` playable until the planet game passes the Ceremony 3 checkpoint.
