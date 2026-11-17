# Concept gallery

Standalone models after the concept art, and a turntable to look at every model in the project.

Open `concept/gallery.html` from a local server at the repo root (`python3 -m http.server 8000`, then `http://localhost:8000/concept/gallery.html`). Pick a model, step with Prev and Next, and switch day and night.

- `models.js`: 14 models not yet in the game: greenhouse complex, fuel store, haul vehicle, processing plant (Frostline-3); dome ruin, cliffside village, ice harvester, a colossal spine arch (Frostveil); a cosmic moose, robed court moose, the temple with its avenue (the ritual); the crystal vault's spiral; a cave street; the Orbital Gateway.
- `models2.js`: 40 more, ten of each kind, each made from a seed so more variations come from changing it: sci-fi buildings, alien-settlement buildings, natural landscapes (needle peaks, a leaning horn, an ice-cliff mesa, an arch ridge, a frozen crater), and winter alien flora (frost fans, glow bulbs, ice coral, snow-cap shelf trees, tendril reeds).
- The gallery also shows the 33 props the game uses (`v4/js/props.js`) and the skier.

All 88 build with no errors in headless Chromium. None has been judged by eye against the art beyond a quick look. To put one in the game, add its builder to `v4/js/props.js` and place it from `v4/js/world.js`.
