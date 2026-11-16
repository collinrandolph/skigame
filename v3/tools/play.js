// Plays the v3 prototype in headless Chromium and checks the loop works end to end: it boots, the skier skis with the
// keyboard, ore cells light a beacon, four beacons open the Ascent, the Ascent carries you up, the top ends the game.
const { open } = require('../../tools/test/browser/harness');
let pass = 0, fail = 0; const ok = (c, m) => { if (c) pass++; else { fail++; console.log('FAIL', m); } };
(async () => {
  const h = await open('v3/index.html?q=low', { wait: false }), page = h.page;
  await page.waitForFunction(() => window.__hale, null, { timeout: 240000 });
  await page.evaluate(() => { localStorage.clear(); });
  const st = () => page.evaluate(() => { const H = window.__hale, s = H.sk; return { v: s.speed(), trail: s.trailName, off: s.S.off, mode: s.mode, lit: H.game.lit.slice(), cells: H.game.cells.map(c => c.filter(Boolean).length), onB: !!s.onBridge, bi: s.onBridge ? s.onBridge.i : -1, r: s.surfaceR() - H.W.R, ended: H.game.ended, locked: s.bridges[0].locked, dist: s.S.dist }; });
  let s = await st(); ok(s.trail === 'Frostline Loop', 'starts on Frostline Loop: ' + s.trail); ok(s.v < 0.01, 'starts at rest');
  // skate: alternate kicks, holding each for the glide
  for (let i = 0; i < 14; i++){ const k = i % 2 ? 'ArrowRight' : 'ArrowLeft'; await page.keyboard.down(k); await page.waitForTimeout(420); await page.keyboard.up(k); }
  s = await st(); ok(s.v > 1.5, 'kicking builds speed: ' + s.v.toFixed(2)); ok(s.dist > 8, 'and covers ground: ' + s.dist.toFixed(1)); ok(s.off < 0.5, 'trail assist keeps you on the trail: off ' + s.off.toFixed(2));
  await page.keyboard.down('ArrowUp'); await page.waitForTimeout(300); s = await st(); ok(s.mode === 'tuck', 'up tucks'); await page.keyboard.up('ArrowUp');
  await page.keyboard.down('ArrowDown'); await page.waitForTimeout(5000); { const v0 = s.v; s = await st(); ok(s.mode === 'plow' && s.v < v0*0.5, 'down plows you slower: ' + v0.toFixed(2) + ' > ' + s.v.toFixed(2)); } await page.keyboard.up('ArrowDown');
  // ore cells: stand on each of the first loop's six
  for (let c = 0; c < 6; c++){ await page.evaluate(c => { const H = window.__hale, d = H.W.RELAYS[0].cells[c], ll = H.W.toLL(d); H.place(ll[0], ll[1]); }, c); await page.waitForTimeout(350); }
  s = await st(); ok(s.cells[0] === 6, 'six cells collected: ' + s.cells[0]); ok(s.lit[0] && !s.lit[1], 'the first beacon lights'); ok(s.locked, 'the Ascent is still shut');
  // the Ascent is shut: skiing at its foot does not take you up
  const toFoot = () => page.evaluate(() => { const H = window.__hale, B = H.W.BRIDGE, t = H.W.TRAILS[H.W.TRAILS.length - 1], p = t.pts[t.pts.length - 8], ll = H.W.toLL(p); H.place(ll[0], ll[1], H.W.bearing(p, t.pts[t.pts.length - 5])); });
  const skate = async n => { for (let i = 0; i < n; i++){ const k = i % 2 ? 'ArrowRight' : 'ArrowLeft'; await page.keyboard.down(k); await page.waitForTimeout(380); await page.keyboard.up(k); } };
  await toFoot(); await skate(12); s = await st(); ok(!s.onB, 'shut: not on the bridge');
  await page.evaluate(() => { const H = window.__hale; for (let i = 1; i < 4; i++) H.setLit(i, true); });
  s = await st(); ok(!s.locked, 'four beacons open the Ascent');
  await toFoot(); const r0 = (await st()).r; await skate(26); s = await st(); ok(s.onB, 'open: onto the bridge'); await skate(40); { const q = await st(); ok(q.onB && q.bi > s.bi + 6 && q.v > 1.5, 'the bridge assist carries you round the curve: sample ' + s.bi + ' > ' + q.bi + ' at ' + q.v.toFixed(1) + ' m/s'); } ok(s.r > r0 + 1.5, 'and climbing: ' + r0.toFixed(1) + ' > ' + s.r.toFixed(1));
  // near the top
  await page.evaluate(() => { const H = window.__hale, B = H.sk.onBridge; if (!B) return; const V = B.b.V, i = V.length - 14, s = H.sk; s.n.copy(V[i]); B.i = i; s.ex.addScaledVector(s.n, -s.ex.dot(s.n)).normalize(); s.ey.crossVectors(s.ex, s.n).normalize(); const tn = V[i + 1].clone().sub(V[i]).normalize(); s.S.th = s.S.tgt = Math.atan2(tn.dot(s.ex), -tn.dot(s.ey)); s.S.vx = s.S.vy = 0; });
  await skate(30); s = await st(); ok(s.ended, 'the top ends the game (at ' + s.bi + ', ' + s.r.toFixed(0) + ' m up)');
  ok(await page.evaluate(() => document.getElementById('end').style.display === 'flex'), 'the end card shows');
  ok(h.errors.length === 0, 'no page errors: ' + h.errors.join(' | '));
  console.log(`${pass} checks passed, ${fail} failed`); await h.close(); process.exit(fail ? 1 : 0);
})();
