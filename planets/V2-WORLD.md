# Skate Ski v2 world

`v2-world.json` is a planet layout for the editor and the planetoid game. The ground is the reference planet
(`reference/planet-ai-pass.json`) untouched: same noise, stamps, sculpt and detail. Everything else is new or rearranged.

Maps: `v2-world-map.png` (surface), `v2-underground.png` (the mine). Checks: `v2-world-report.json`.

To see it: open `prototypes/planet-editor.html`, Import `v2-world.json`, then Ski here.

## Progression

| # | Chapter | Where | What opens |
|---|---|---|---|
| 1 | Zone 1 | The Bowl (7 ha), 2 terminals | East gate and North gate, both on Trail 10 |
| 2 | Zone 2 | Home plain (115 ha), 3 terminals | West and East drawbridges over the river |
| 3 | Zone 3 | Far plain (90 ha), 3 terminals | Mine portal at the deep pit |
| 4 | The mine | Layer 1, 90 m down | Teleporter hall (dead); waking the crystal altar lights the Highland bridge |
| 5 | Crystal search | Highlands (7 ha, 45–105 m up) | 20 crystals beside 2.6 km of trail |
| 6 | Crystal gate | Highlands end of the Crystal bridge | Lights the Crystal bridge down into zone 4 |
| 7 | Zone 4 | South plain (18 ha) | Moose puzzle and altar at the Broken Circle; South pass gate opens as a shortcut |
| 8 | Crown door | Layer 2, 170 m down | Crown passage and crown room |
| 9 | Starway | Broken Circle side of zone 4 | Up to the observatory on the 186 m peak |

## Decisions made to fit the terrain

- **The Bowl has two ways out**, so it has two gates. Trail 10 leaves by the east mouth and again over the north pass.
- **The Highland bridge starts inside the Bowl**, from Trail 10 in the west valley. It was the only span to the
  highlands that a light bridge deck can fly at 16% or less (searched from every zone). The crystal search begins at home.
- **The Crystal bridge is your Light bridge 1**, unchanged. The crystal gate stands at its highlands end.
- **The drawbridges are your Light bridges 2 and 3**, unchanged in position, marked `kind: "draw"`.
- **The South pass** (7 m half-width, on Trail 8) is the only ground link between zones 3 and 4, so it is gated.
- **The mine uses the pit's north-west notch**, where your Trail 17 already ends.

## Trails

26.9 km in all: your 14.3 km kept as they were, plus 12.5 km new in 36 trails (14 of them loops).

| Zone | Trail |
|---|---|
| 1 | 0.9 km |
| 2 | 12.1 km |
| 3 | 9.1 km |
| Highlands | 2.6 km |
| 4 | 2.2 km |

- New trails are routed over the real ground: no grade over 20%, no ground steeper than 26% underfoot.
- Each terminal has an orb circuit of 530–1,150 m. Zone 1's two share Trail 12 and take half of Trail 11 each.
- New trails are uncarved, like yours.

## Underground

| Layer | Depth | Contents |
|---|---|---|
| The mine | 90 m | Main gallery, teleporter hall, old workings to the altar cave, a drift round by the ore bay (580 m of tunnel) |
| The deep | 170 m | Crown passage (146 m) to the crown room |

One spiral ramp, 1.5 km at 12%, winds down the pit wall from the mine portal with a landing and door at each layer.

## Game data

The layout carries a `game` block the editor keeps but does not edit: zones, each trail's zone, terminals with orb
positions, gates and what opens them, bridge kinds, crystals, altar, giant, Starway, and the underground's rooms.
`prototypes/planet-terrain.js` was changed (5 lines) to pass it through, along with a bridge's `kind`.

## Not done, or needs your eye

- **Not skied.** Checked by building the terrain with the game's own code, not by playing. three.js loads from a CDN
  this build environment can't reach.
- **Drawbridges still draw as light bridges.** The data says drawbridge; the game code to lower them is part of the port.
- **Gates, terminals and crystals are props for now.** Nothing locks or collects until the game core is ported.
- **The Starway is game data only**: 247 m long rising 193 m, too steep for the bridge builder.
- **Random buildings are off** (`scatter.buildings: 0`), so only placed ones appear.
- **Your Trail 8** has one point on ground steeper than the 40% stop (it was there before).
- **Underground props** (teleporter, altars, crown) have positions in `game.underground` but no models: the model
  list places on the surface only.

## Rebuilding

See `tools/world/README.md`. The world is generated, so edit the script and rerun, or edit the result in the planet editor.
