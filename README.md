# Skate Ski

A cross-country skiing game prototype that runs in the browser, built with three.js. You don't hold a key to accelerate. You ski the way you would on snow: shifting your weight from ski to ski, and timing your kicks and pole pushes.

Open `index.html` in a browser. It loads three.js from cdnjs, so it needs an internet connection.

## Controls

The keyboard and both controller schemes share one layout. Choose the controller scheme under **Controller scheme** in the Tuning panel.

| Action | Keyboard | Controller |
|---|---|---|
| Kick (left / right) | ← / → or A / D | LT / RT |
| Snow plow (hold) | ↓ or S | Left stick down (triggers scheme) / both sticks down (twin-stick) |
| Double pole | Space | LB or RB |
| Switch skating / classic | C | A button |
| Music on / off | M | — |
| Tuck (hold, classic) | ↑ or W | Left stick up / both sticks up |
| Steer (classic and tuck) | Q / E | Left stick left / right |

- **Skating kicks:** hold a skating kick to push it all the way out and ride the glide. Each kick turns you a step away from the kicking leg.
  - Same-leg kicks build into a kick turn, measured from your current heading.
  - An opposite-leg kick is measured from the camera heading, so alternating kicks swing evenly around a steady line.
- **Classic kicks:** these must alternate legs. Letting go of a snow plow returns you to the mode you started it from.
- **Twin-stick strokes:** each stick is one foot.
  - Pull a stick down and inward to load, then throw it up and outward to step onto that foot's ski. The stroke's angle sets the ski angle, and stick strokes carry a bigger push to make up for being slower to perform.
  - Flick a stick from centre to the edge for a passive step (other foot) or a kick turn (same foot).
  - In classic, swap one stick up and one down to kick.
- **Animation:** trigger and key kicks animate as V1 (offset), and stick strokes as V2.
- **Touch screens:** the orb counter shows at the top. Tap the labelled **Left kick** / **Right kick** pads at the bottom of the screen. Between them sits the only other control, a toggle: **\/** means skate and **||** means classic. A speaker button in the top-left corner mutes the music on any device. Double-tap and pinch zoom, text selection and the long-press Copy/Share menu are all disabled so fast kicking doesn't disturb the page on iOS.

## Levels

The map is four times its old area and split into zones, each locked until you clear the one before it. Progress isn't saved yet, and **Reset skier** in dev view resets the orbs, the gate and the bridge. For testing, the **Zone 1 / 2 / 3 orbs collected** sliders in dev view's Tuning panel set the counts directly; maxing one opens that zone's gate or lowers its bridge.

- **Zone 1 (north-west):** the original trail network, enclosed by an irregular range of impassable mountains. 20 glowing orbs sit along its trails. Collect them all to open the **East Gate** in the wide, flat pass on the east side. The counter at the top of the screen tracks them, and the map shows the orbs that are left.
- **Zone 2 (north-east):** past the gate. It's hillier, with five winding trails (green to black) that all lead to the river. Collect its 30 orbs to lower the **drawbridge** into zone 3. Stone ramps on both banks meet the snow flush, and the lowered deck skis like groomed trail. A spur ridge runs from zone 1's mountains to the river, so zone 2 can't reach the strip below zone 1 without crossing the river first.
- **Outpost:** zones 1 and 2 hold a sci-fi research outpost. Zone 1 has a habitat dome, a research tower and a landing pad. Zone 2 has a processing plant, a mine excavator, a greenhouse complex, a bio lab and a comms array. Smaller equipment (weather stations, fuel tanks, solar arrays, haul vehicles) sits just off the trails. Buildings are solid and show on the map.
- **Zone 3 (the southern half):** across the river, around a frozen lake you can ski across (the ice runs like groomed trail). Six trails circle and cross the lake, with 50 orbs. Instead of outpost buildings, it holds the remnants of an alien civilisation: the Sleeping Ribs, the Spine Arch (which Bridge Road passes under), the Watcher spire and the Broken Circle, plus bone shards. Makeshift camps sit among them: tents and tarps, stilt shacks, ice harvesters on the shore and signal towers. Collecting all 50 orbs opens the **South Gate**.
- **Wildlife:** six-legged purple tentacle moose walk back and forth on their own paths beside the trails, one in zone 2 and ten in zone 3. They walk with an alternating tripod gait, and their tentacle beards sway as they go. They're solid, so ski round them, and they show as purple dots on the map.
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
- **Trail assist:** gently steers your stride toward the trail ahead. It lets go when you lean, kick-turn or steer away.
- **Skier:** V2 for stick strokes (load tall, push and compress, recover) and V1 offset poling for trigger and key kicks, with tuck, snow plow and classic poses.
- **Tuning:** every setting is a slider in the Tuning panel and is remembered in your browser. The stick debug recorder logs your stick input so you can tune the input thresholds.

## Files

- `index.html` is the current game.
- `prototypes/top-down-2d.html` is the earlier top-down canvas version.
