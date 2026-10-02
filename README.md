# Skate Ski

A cross-country skate-skiing game prototype that plays in the browser. You don't hold a key to accelerate. You skate the way you would on snow: alternate left and right kicks to move your weight from ski to ski.

Open `index.html` in a browser. It loads three.js from cdnjs, so it needs an internet connection.

## Controls

| Input | Keyboard | Controller | Touch |
|---|---|---|---|
| Left kick | A / ← | LT | Left half of screen |
| Right kick | D / → | RT | Right half of screen |
| Snow plow | S / ↓ | Left stick down | — |
| Double pole / tuck | W / ↑ | Left stick up | — |

- **Kicks:** hold a kick to push it all the way out and to ride the glide. A quick tap only gives part of the power.
- **Turning:** each kick turns you one step away from the kicking leg, so a right kick turns you left. Alternating legs makes the steps cancel. Kicking the same leg repeatedly turns you further each time but pushes you forward less.
- **Leaving a mode:** a kick on either leg ends snow plow or double pole.

## Mechanics

- **Skating:** your body rides along the gliding ski at the skate angle, so you weave from ski to ski around your heading. The skate angle gets wider when you're slow and narrower when you're fast.
- **Ski tracks:** marks are straight, the way a ski is. If you drift too far off a ski's line, it's lifted and set down again.
- **Hills:** gravity acts along the skis. Friction and top speed change with the grade.
- **Trails:** a network of six groomed trails, rated green, blue and black. Off the trail, the snow is ungroomed and much slower.
- **Camera:** it runs one kick behind. Alternating kicks cancel out, so it only follows real turns.
- **Tuning:** every setting is a slider in the Tuning panel, and your changes are remembered in your browser.

## Files

- `index.html` is the current 2.5D game, built with three.js.
- `prototypes/top-down-2d.html` is the earlier top-down canvas version.
