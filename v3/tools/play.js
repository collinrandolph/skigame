// Plays v3 in headless Chromium and checks the story so far works end to end: it boots, the skier skis with the
// keyboard, a shut gate holds, a terminal runs and powers, the gate opens, the drawbridge stays up until its post lowers
// it and then carries you over the canyon, progress survives a reload, and (with the ceremony cheated) the Ascent
// carries you to the ending.
const { open } = require('../../tools/test/browser/harness');
let pass = 0, fail = 0; const ok = (c, m) => { if (c) pass++; else { fail++; console.log('FAIL', m); } };
(async () => {
  const h = await open('v3/index.html?q=low', { wait: false }); const page = h.page;
  await page.waitForFunction(() => window.__hale, null, { timeout: 240000 });
  await page.evaluate(() => { localStorage.clear(); window.__hale.G.reset(); });
  const st = () => page.evaluate(() => { const H = window.__hale, s = H.sk, g = H.G.state(), n = [s.n.x, s.n.y, s.n.z]; return { v: s.speed(), trail: s.trailName, off: s.S.off, mode: s.mode, onB: s.onBridge ? s.onBridge.b.src.src.name : null, bi: s.onBridge ? s.onBridge.i : -1, r: s.surfaceR() - H.W.R,
    prompt: H.G.prompt ? H.G.prompt.text : null, hint: H.G.hint, active: g.active, got: g.got.length, powered: Object.keys(g.powered), orbs: H.G.orbs().length, river: H.W.riverDist(...n), inCap: H.W.dot(n, H.W.RIVER.n) > H.W.RIVER.off, ended: H.ended, dist: s.S.dist, n }; });
  const skate = async (n, ms = 380) => { for (let i = 0; i < n; i++){ const k = i % 2 ? 'ArrowRight' : 'ArrowLeft'; await page.keyboard.down(k); await page.waitForTimeout(ms); await page.keyboard.up(k); } };
  const placeOn = (name, i, back) => page.evaluate(([name, i, back]) => { const H = window.__hale, W = H.W, t = W.TRAILS.find(q => q.name === name), M = t.pts.length, k = i < 0 ? M + i : i, p = t.pts[k], q = t.pts[Math.max(0, Math.min(M - 1, k + (back ? -2 : 2)))], ll = W.toLL(p); H.place(ll[0], ll[1], W.bearing(p, q)); H.sk.S.vx = H.sk.S.vy = 0; }, [name, i, back]);
  const placeAt = d => page.evaluate(d => { const H = window.__hale, ll = H.W.toLL(d); H.place(ll[0], ll[1]); H.sk.S.vx = H.sk.S.vy = 0; }, d);
  const wait = ms => page.waitForTimeout(ms);
  const W = await page.evaluate(() => { const W = window.__hale.W; return { terms: W.TERMINALS.map(t => ({ name: t.name, at: t.at, orbs: t.orbs })), gates: W.GATES.map(g => ({ name: g.name, trail: g.trail, i: g.i, d: g.d })) }; });

  let s = await st(); ok(s.trail === 'Frostline Loop', 'starts on Frostline Loop: ' + s.trail); ok(s.v < 0.01, 'starts at rest');
  await skate(14, 420); s = await st(); ok(s.v > 1.5, 'kicking builds speed: ' + s.v.toFixed(2)); ok(s.dist > 8, 'and covers ground: ' + s.dist.toFixed(1)); ok(s.off < 0.5, 'trail assist keeps you on the trail: off ' + s.off.toFixed(2));
  await page.keyboard.down('ArrowUp'); await wait(300); s = await st(); ok(s.mode === 'tuck', 'up tucks'); await page.keyboard.up('ArrowUp');
  await page.keyboard.down('ArrowDown'); await wait(5000); { const v0 = s.v; s = await st(); ok(s.mode === 'plow' && s.v < v0*0.5, 'down plows you slower: ' + v0.toFixed(2) + ' > ' + s.v.toFixed(2)); } await page.keyboard.up('ArrowDown');

  // the East gate is shut: skating at it from 25 m does not get you past it
  const eg = W.gates.find(g => g.name === 'East gate'), beyond = n => page.evaluate(([n, name, i]) => { const W = window.__hale.W, t = W.TRAILS.find(q => q.name === name); let bi = 0, bd = -2; t.pts.forEach((p, k) => { const c = W.dot(p, n); if (c > bd){ bd = c; bi = k; } }); return bi - i; }, [n, eg.trail, eg.i]);
  await placeOn(eg.trail, eg.i - 9); await skate(22); s = await st(); ok(await beyond(s.n) <= 0, 'the shut East gate holds (ended ' + await beyond(s.n) + ' samples past it)'); ok(/East gate: locked/.test(s.hint || ''), 'and says why: ' + s.hint);
  // Terminal 1: offered, started with Enter, its orbs fetched, powered on return
  const t1 = W.terms[0]; await placeAt(t1.at); await wait(500); s = await st(); ok(s.prompt === 'Start Terminal 1', 'at the terminal the offer shows: ' + s.prompt);
  ok(await page.evaluate(() => getComputedStyle(document.getElementById('offer')).display !== 'none'), 'and is on screen');
  await page.keyboard.press('Enter'); await wait(400); s = await st(); ok(s.active === 'Terminal 1' && s.orbs === t1.orbs.length, 'Enter starts it: ' + s.orbs + ' orbs out');
  for (const o of t1.orbs){ await placeAt(o); await wait(300); } s = await st(); ok(s.got === t1.orbs.length, 'every orb fetched: ' + s.got);
  await placeAt(t1.at); await wait(500); s = await st(); ok(s.powered.includes('Terminal 1'), 'back at the terminal it powers');
  // the second terminal done, the gate opens and lets you through
  await page.evaluate(() => window.__hale.G.cheat('zone1')); await wait(400);
  await placeOn(eg.trail, eg.i - 6); await skate(36); s = await st(); ok(await beyond(s.n) > 2, 'zone 1 live: through the East gate (' + await beyond(s.n) + ' samples past)');
  // the canyon: bridge up, you stay on the near bank; lowered at the post, it carries you across
  await placeOn('Haul Road', -7); await skate(24); s = await st(); ok(!s.inCap && !s.onB, 'the raised drawbridge does not carry you: river ' + s.river.toFixed(0) + ' m off');
  await page.evaluate(() => window.__hale.G.cheat('zone2')); const post = await page.evaluate(() => window.__hale.W.GAME.bridges[0].post); await placeAt(post); await wait(500);
  s = await st(); ok(s.prompt === 'Lower the East drawbridge', 'the post offers: ' + s.prompt); await page.keyboard.press('e'); await wait(2500);
  await placeOn('Haul Road', -4); await skate(80); s = await st(); ok(s.inCap && !s.onB, 'lowered, it carries you over the canyon to the far bank (' + (s.trail || 'no trail') + ')');
  // a reload keeps it
  await page.reload(); await page.waitForFunction(() => window.__hale, null, { timeout: 240000 });
  s = await st(); const kept = s.powered.length;
  // the Ascent: dark until the ceremony; then up it to the ending
  const toFoot = () => page.evaluate(() => { const H = window.__hale, W = H.W, t = W.TRAILS[W.TRAILS.length - 1], p = t.pts[t.pts.length - 8], ll = W.toLL(p); H.place(ll[0], ll[1], W.bearing(p, t.pts[t.pts.length - 5])); });
  await toFoot(); await skate(12); s = await st(); ok(!s.onB, 'the Ascent is dark: not on the bridge');
  await page.evaluate(() => window.__hale.G.cheat('ceremony')); await wait(300);
  await toFoot(); const r0 = (await st()).r; await skate(26); s = await st(); ok(s.onB === 'The Ascent', 'lit: onto the Ascent'); ok(s.r > r0 + 1.5, 'and climbing: ' + r0.toFixed(1) + ' > ' + s.r.toFixed(1));
  await skate(40); { const q = await st(); ok(q.onB && q.bi > s.bi + 6 && q.v > 1.5, 'the bridge assist carries you round the curve: sample ' + s.bi + ' > ' + q.bi + ' at ' + q.v.toFixed(1) + ' m/s'); }
  await page.evaluate(() => { const H = window.__hale, B = H.sk.onBridge; if (!B) return; const V = B.b.V, i = V.length - 14, s = H.sk; s.n.copy(V[i]); B.i = i; s.ex.addScaledVector(s.n, -s.ex.dot(s.n)).normalize(); s.ey.crossVectors(s.ex, s.n).normalize(); const tn = V[i + 1].clone().sub(V[i]).normalize(); s.S.th = s.S.tgt = Math.atan2(tn.dot(s.ex), -tn.dot(s.ey)); s.S.vx = s.S.vy = 0; });
  await skate(30); s = await st(); ok(s.ended, 'the top ends the game (at ' + s.bi + ', ' + s.r.toFixed(0) + ' m up)');
  ok(kept >= 5, 'a reload kept the progress: ' + kept + ' terminals powered');
  ok(h.errors.length === 0, 'no page errors: ' + h.errors.join(' | '));
  console.log(`${pass} checks passed, ${fail} failed`); await h.close(); process.exit(fail ? 1 : 0);
})();
