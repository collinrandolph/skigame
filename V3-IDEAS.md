# v3 ideas log

Things found while working on v2 that are out of v2's scope: they need the terrain, the planet size, the trail network or the look to change. Add to this as they come up. Each entry says what was seen and what v3 could do about it.

The measurable goal for v3, if it is built, is in section "Goal" at the end.

## Terrain

| Seen in v2 | v3 idea |
|---|---|
| The mountain ranges are too low to show from the plains. A 60 m ridge is below the horizon 460 m away, and "mountain view" is only 6% of the ride. | Raise the main ranges to 100 m or more, so each zone has a skyline. |
| The summit is on screen for 5% of the ride, even after the scenery pass. Props cannot fix this: it is where the trails point. | Sculpt valleys that aim at the summit, and make it taller or lit, so the story's goal is in view from at least half the ride. |
| Zone 1 is the only zone that scored well before any scenery was added (1% bare). It is small, enclosed, and the trails curve past things. | Use zone 1 as the template: several enclosed bowls joined by passes, not two open plains. |
| The summit's shelves are small (0.03 to 0.7 ha) and the rises between them are 35 to 50 m over about 100 m, too steep for straight bridges. | Sculpt the staircase for the bridges: shelves 60 m across, rises a bridge can climb at 15%. |
| The river trench has no water. | A water or ice surface in the trench, with its own shader. |

## Trails

| Seen in v2 | v3 idea |
|---|---|
| Trails were routed through finished terrain, so views are accidental. 55 of 115 crests still have nothing in line after the scenery pass, because there is no room where the landmark would need to stand. | Design trails and sightlines first, then sculpt terrain to serve them. |
| 27 km of trail is more than the story needs. Zones 2 and 3 hold 21 km of it. | About 12 to 15 km, denser. |
| Long straight stretches score worst. Curves bring new things on screen. | Prefer curving trails; cap straights at about 150 m. |
| A stretch often needs one landmark for each direction of travel. | Loops meant to be skied one way, signposted, so each view is composed once. |

## Props and models

| Seen in v2 | v3 idea |
|---|---|
| Few models are tall. The scenery pass scales up existing ones (outcrops, shards, watchers, masts), which repeats. | A landmark kit per zone: rock arch, mast with a light, wind turbine, frozen waterfall, lantern posts, ruined pylons. |
| The fossil (`ribs`) looks wrong scaled above 2x: its spheres read as blobs. | Models built at landmark size, with detail that holds up close. |
| Nothing moves in the distance. | Turning, blinking and drifting things: turbines, beacons, herds crossing, birds. |
| The sky is empty of landmarks. | Sky bodies fixed over regions (ringed planet, moon, station, black hole). On a small planet the sky turns as you travel, so they work as geography. |

## Look

| Seen in v2 | v3 idea |
|---|---|
| Night screenshots are close to black; props vanish. | Night as its own look: lit lanterns on trails, glowing crystals, aurora, a dense star field. |
| Day is flat white and grey. | Atmosphere with rim glow and a visible day and night line, blue snow shadows, sparkle, corduroy on trails, ski tracks that stay. |
| Zones look alike. | A palette, tree species and rock type per zone. |
| Trees are one spruce, scattered evenly by noise. | Several species; dense woods and open glades placed on purpose, to alternate enclosure and open views. |

## Tools

| Seen in v2 | v3 idea |
|---|---|
| The audit does not know about trees, sky or light. | Move the woods test into `planet-terrain.js`; add sky bodies to the audit. |
| The audit scores what is visible, not whether it looks good. | A contact sheet: `tools/test/browser/views.js` screenshots at every scored crest, for a person to scan. |
| Planet radius was never tested. | Generate candidate worlds at a few radii and compare audit scores before choosing. |

## Goal

- Something new on screen at least every 20 seconds of skiing, on every trail, both ways.
- Every crest and forest exit has a landmark in line.
- The summit on screen for at least half the ride.
- A screenshot tells you which zone you are in.
- 60 fps on a phone at the low setting.
