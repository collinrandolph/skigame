# Tests

```sh
node tools/test/game-core.test.js          # the game's rules, in Node (no browser)
THREE_JS=/path/to/three.min.js node tools/test/browser/play.js   # chapters 1 to 6 in the real page, headless Chromium
THREE_JS=/path/to/three.min.js node tools/test/browser/controls.js   # keyboard, a mocked controller, touch, trail assist
```

The browser tests need Playwright with Chromium, and a local copy of three.js r128 (`three.min.js`): the page asks a CDN
for it, and the harness answers from the local file. They write screenshots into the current directory.
