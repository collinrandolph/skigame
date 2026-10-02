# Skate Ski

A cross-country skiing game prototype that runs in the browser, built with three.js. You don't hold a key to accelerate. You ski the way you would on snow: shifting your weight from ski to ski, and timing your kicks and pole pushes.

Open `index.html` in a browser. It loads three.js from cdnjs, so it needs an internet connection.

## Controls

There are two controller schemes. Switch between them under **Controller scheme** in the Tuning panel.

### Triggers scheme (also keyboard and touch)

| Action | Keyboard | Controller | Touch |
|---|---|---|---|
| Left kick | A / ← | LT | Left half of screen |
| Right kick | D / → | RT | Right half of screen |
| Snow plow | S / ↓ | Left stick down | — |
| Double pole | W / ↑ | Left stick up | — |

- **Kicks:** hold a kick to push it all the way out and ride the glide.
- **Turning:** each kick turns you a step away from the kicking leg. Alternating kicks cancel out, and repeated same-side kicks build into a kick turn.

### Twin-stick scheme (experimental)

Each stick is one foot.

**Skating**

| Action | Input |
|---|---|
| Stroke | Pull a stick down and inward to load, then throw it up and outward to step onto that foot's ski. The stroke's angle sets the ski angle, and its length sets the power. |
| Passive step / kick turn | Flick a stick from centre out to the edge without loading. On the other stick it's a passive step with no push; on the same stick it's a kick turn. |
| Double pole | Both sticks down, then quickly both up. Ends in a tuck. |
| Snow plow | Hold both sticks down. Letting go puts you in a tuck. |
| Tuck | Both sticks up from rest. Tilt both sticks to lean. |
| Kicks | LT / RT, exactly as in the triggers scheme. |
| Switch to classic | RB |

**Classic**

| Action | Input |
|---|---|
| Diagonal stride | One stick up and one down, then swap them. The kick comes once both have switched. |
| Kick with triggers | Alternate LT / RT. |
| Steer | Left stick left / right. |
| Double pole | Push both sticks forward. |
| Snow plow | Hold both sticks down. Letting go returns you to classic. |
| Switch to skating | RB |

## Mechanics

- **Skating:** your body rides the ski you're on, so your path weaves around the line between your skis. The skate V widens or narrows in fixed steps with speed and slope, so both sides stay even.
- **Camera:** it follows the line between your skis, so alternating strides cancel out and only real turns move the view.
- **Ski tracks:** marks are straight, the way a ski is, and are reset when you drift off a ski's line. Kick turns leave a herringbone pattern.
- **Terrain and trails:**
  - Rolling terrain with a ridge and a valley, and gravity acts along the skis.
  - Six groomed trails with green, blue and black ratings, plus scattered trees.
  - Ungroomed snow is slower, except in classic.
- **Trail assist:** gently steers your stride toward the trail ahead. It lets go when you lean, kick-turn or steer away.
- **Skier:** animated through a V2 cycle (load tall, push and compress, recover), with tuck, snow plow and classic poses.
- **Tuning:** every setting is a slider in the Tuning panel and is remembered in your browser. The stick debug recorder logs your stick input so you can tune the input thresholds.

## Files

- `index.html` is the current game.
- `prototypes/top-down-2d.html` is the earlier top-down canvas version.
