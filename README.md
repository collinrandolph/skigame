# Skate Ski

A cross-country skiing game prototype that runs in the browser, built with three.js. You don't hold a key to accelerate. You ski the way you would on snow: shifting your weight from ski to ski, and timing your kicks and pole pushes.

Open `index.html` in a browser. It loads three.js from cdnjs, so it needs an internet connection.

## Controls

The keyboard, controller and touch screen share one layout. On a controller the sticks stroke and the triggers kick, and you can mix them freely.

| Action | Keyboard | Controller |
|---|---|---|
| Kick (left / right) | ← / → or A / D | LT / RT |
| Snow plow (hold) | ↓ or S | Both sticks down |
| Double pole | Space | LB or RB |
| Switch skating / classic | C | A button |
| Music on / off | M | — |
| Tuck (hold, classic) | ↑ or W | Left stick up / both sticks up |
| Steer (classic and tuck) | Q / E | Left stick left / right |

- **Skating kicks:** hold a skating kick to push it all the way out and ride the glide. Each kick turns you a step away from the kicking leg.
  - Same-leg kicks build into a kick turn, measured from your current heading: the 1st and 2nd turn 5°, the 3rd 15°, and from there each grows by a fixed step (33.3°, 51.7°, 70°) so six on one side make a 180° about-turn. The 2nd and 3rd turns and the number of kicks for 180° are sliders.
  - An opposite-leg kick is measured from the camera heading, so alternating kicks swing evenly around a steady line.
- **Classic kicks:** these must alternate legs. Letting go of a snow plow returns you to the mode you started it from.
- **Twin-stick strokes:** each stick is one foot.
  - Pull a stick down and inward to load, then throw it up and outward to step onto that foot's ski. A throw is exactly a trigger kick for the other leg: the same turn per kick, same-leg build, skate angle and push. The stroke's angle and length don't change anything.
  - Flick a stick from centre to the edge for a passive step (other foot) or a kick turn (same foot).
  - In classic, swap one stick up and one down to kick.
- **Animation:** trigger and key kicks animate as V1 (offset), and stick strokes as V2.
- **Touch screens:** the orb counter shows at the top, and a map button in the top-right corner opens a full-screen map of all four zones. Tap the labelled **Left kick** / **Right kick** pads at the bottom of the screen. Between them sits the only other control, a toggle: **\/** means skate and **||** means classic. A speaker button in the top-left corner mutes the music on any device. Double-tap and pinch zoom, text selection and the long-press Copy/Share menu are all disabled so fast kicking doesn't disturb the page on iOS.

## Levels

The map is four times its old area and split into zones, each locked until you clear the one before it. Collected orbs and crystals are saved in your browser, so gates and the bridge stay open between visits. **Reset skier** in dev view clears that progress. For testing, the **Zone 1 / 2 / 3 orbs collected** and **Crystals collected** sliders in dev view's Tuning panel set the counts directly; maxing one opens that zone's gate or lowers its bridge.

- **Zone 1 (north-west):** the original trail network, enclosed by an irregular range of impassable mountains. 20 glowing orbs sit along its trails. Collect them all to open the **East Gate** in the wide, flat pass on the east side. The counter at the top of the screen tracks them, and the map shows the orbs that are left.
- **Zone 2 (north-east):** past the gate. It's hillier, with five winding trails (green to black) that all lead to the river. Collect its 30 orbs to lower the **drawbridge** into zone 3. Stone ramps on both banks meet the snow flush, and the lowered deck skis like groomed trail. A spur ridge runs from zone 1's mountains to the river, so zone 2 can't reach the strip below zone 1 without crossing the river first.
- **Outpost:** zones 1 and 2 hold a sci-fi research outpost. Zone 1 has a habitat dome, a research tower and a landing pad. Zone 2 has a processing plant, a mine excavator, a greenhouse complex, a bio lab and a comms array. Smaller equipment (weather stations, fuel tanks, solar arrays, haul vehicles) sits just off the trails. Buildings are solid and show on the map.
- **Zone 3 (the southern half):** across the river, around a frozen lake you can ski across (the ice runs like groomed trail). Six trails circle and cross the lake, with 50 orbs. Instead of outpost buildings, it holds the remnants of an alien civilisation: the Sleeping Ribs, the Spine Arch (which Bridge Road passes under), the Watcher spire and the Broken Circle, plus bone shards. Makeshift camps sit among them: tents and tarps, stilt shacks, ice harvesters on the shore and signal towers. Collecting all 50 orbs opens the **South Gate**.
- **Lawns:** every off-trail landmark sits on a broad groomed lawn with a wandering, non-circular outline. A curving groomed tongue joins it to the nearest trail; the tongue is about as wide as the lawn, swells and narrows along its length, and tapers toward the trail. Lawns and tongues that come close melt together into one shape. They ski like trail, stop at water and rock, and aren't signed or shown on the map.
- **Purple crystals:** once zone 3's orbs are all in, 20 crystals appear: 5 in zone 1, 5 in zone 2 and 10 in zone 3. Each sits beside an off-trail landmark (a building, ruin or camp), marked by a 10 m column of purple light you can see from far off. The counter switches to crystals, and the map shows them as purple diamonds.
- **Zone 4:** south of zone 3 beyond a mountain divide across the whole map, the same size as zone 3. Collecting all 20 crystals swings open the 15 m **Crystal Gate** in the divide, south of the Broken Circle. Zone 4 is open snowfields with no buildings or people: winding Frost Road (blue), scattered outcrops of purple crystal, and at the far southern end a herd of purple moose reached by the Herd Trail. Some of the herd graze and wander, some lie asleep in the snow, and there are antlerless calves.
- **Wildlife:** six-legged purple tentacle moose walk back and forth on their own paths beside the trails, one in zone 2 and ten in zone 3. They walk with an alternating tripod gait, and their tentacle beards sway as they go. They're solid, so ski round them. People and animals aren't shown on the map.
- **People:** outpost crews and settlers in parkas stand about by the buildings and camps, or walk slow loops around them. In zone 3, the short, blue-skinned natives keep to the ruins: they have long swept-back ears and brown robes whose trains drag behind them. They glide round the big ruins and stand near them and the bone shards. Everyone is solid, so ski round them.
- **The way back:** a fixed lower bridge crosses from zone 3 to the strip below zone 1. From there, black-rated **Switchbacks** climb benches cut into the mountainside to a saddle, where the South Gate leads down into zone 1's Home Stretch.

## Interface

- **Play view (default):**
  - Map and distance in the bottom left.
  - Grade, cadence and speed in the bottom right.
  - Stick diagrams with LT / RT readouts and the current mode in the centre. Trigger kicks show on the opposite stick, and when you're idle the diagrams demo the intended rhythm.
  - A controller-layout panel in the top right.
- **Dev view:** the full HUD, Tuning and stick debug tools. Toggle it with the **Dev** button or the **`** key.

## Mechanics

- **Skating:** your body rides the ski you're on, so your path weaves around the line between your skis. The skate V widens or narrows in fixed steps with speed and slope, so both sides stay even.
- **Camera:** it follows the line between your skis, so alternating strides cancel out and only real turns move the view.
- **Ski tracks:** marks are straight, the way a ski is, and are reset when you drift off a ski's line. Kick turns leave a herringbone pattern.
- **Terrain and trails:**
  - Rolling terrain with a ridge and a valley, and gravity acts along the skis.
  - Groomed trails with green, blue and black ratings, and scattered trees: six in zone 1, the East Gate connector, and five in zone 2.
  - Mountains, the river and the map edge stop you. The ground loads in tiles as you ski, and a coarse mesh carries the distant skyline.
  - Ungroomed snow is slower, except in classic. Double poles keep their full push off the trail.
- **Trail assist:** gently steers your stride toward the trail ahead. It aims across the centre line at the mirror of your offset (the **centring** slider sets how far), so drifting to one edge pulls you back through the middle instead of letting you settle off to the side. Centring fades out near junctions and trail ends, and after switching trails the assist (and its centring) eases back in over the trail-switch time, so changing trails never yanks you sideways. It lets go when you lean, kick-turn or steer away.
- **Skier:** V2 for stick strokes (load tall, push and compress, recover) and V1 offset poling for trigger and key kicks, with tuck, snow plow and classic poses.
- **Tuning:** every setting is a slider in the Tuning panel, grouped into Controller, Kicks and strides, Skate angle, Snow and glide, Classic/poling/braking, Trail assist, Camera and Testing. Only sliders you've moved are remembered in your browser; the rest follow the current defaults. Physics runs in fixed steps of at most 1/60 s, so it behaves the same at any frame rate. The stick debug recorder logs your stick input so you can tune the input thresholds.

## Files

- `index.html` is the current game.
- `prototypes/top-down-2d.html` is the earlier top-down canvas version.
