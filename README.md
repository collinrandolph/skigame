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
- **Touch screens:** tap the labelled **Left kick** / **Right kick** pads at the bottom of the screen. Between them sits the only other control, a toggle: **\/** means skate and **||** means classic. Double-tap and pinch zoom, text selection and the long-press Copy/Share menu are all disabled so fast kicking doesn't disturb the page on iOS.

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
  - Six groomed trails with green, blue and black ratings, plus scattered trees.
  - Ungroomed snow is slower, except in classic. Double poles keep their full push off the trail.
- **Trail assist:** gently steers your stride toward the trail ahead. It lets go when you lean, kick-turn or steer away.
- **Skier:** V2 for stick strokes (load tall, push and compress, recover) and V1 offset poling for trigger and key kicks, with tuck, snow plow and classic poses.
- **Tuning:** every setting is a slider in the Tuning panel and is remembered in your browser. The stick debug recorder logs your stick input so you can tune the input thresholds.

## Files

- `index.html` is the current game.
- `prototypes/top-down-2d.html` is the earlier top-down canvas version.
