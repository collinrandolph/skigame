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
  { const toFoot0 = () => page.evaluate(() => { const H = window.__hale, W = H.W, t = W.TRAILS[W.TRAILS.length - 1], p = t.pts[t.pts.length - 8], ll = W.toLL(p); H.place(ll[0], ll[1], W.bearing(p, t.pts[t.pts.length - 5])); }); await toFoot0(); await skate(12); s = await st(); ok(!s.onB, 'the Ascent is dark: not on the bridge'); }
  // ---- chapters 4 to 9, played through the rules (placing the skier, pressing Enter at the offers)
  const flags = () => page.evaluate(() => { const H = window.__hale, g = H.G.state(); return { realm: H.realm, altar: g.altar, crystals: g.crystals.length, offered: g.offered, calf: g.calf, giantUp: g.giantUp, taken: g.taken.length, crowned: g.crowned, crown: g.crown.length, ceremony: g.ceremony, prompt: H.G.prompt ? H.G.prompt.text : null, goal: H.G.goal().title, purple: H.sk.SKIER.mats.jacket.color.getHex() === 0x7b3fe0,
    door: H.G.doorOpen(0), crownGate: H.G.gateOpen('Crown gate'), crystalGate: H.G.gateOpen('Crystal gate'), R: H.sk.P.R }; });
  const inRealm = async r => { await page.waitForFunction(r => window.__hale.realm === r && +document.getElementById('fade').style.opacity < 0.2, r, { timeout: 90000 }); await wait(300); };
  const WD = await page.evaluate(() => { const W = window.__hale.W; return { altar: W.REALMS.mine.altar, tele: W.REALMS.mine.tele, crown: W.GAME.underground.crownCrystals.d, crystals: W.CRYSTALS, cgate: W.GATES.find(g => g.name === 'Crystal gate').d, calves: W.COURT.calves, court: W.COURT.d }; });
  await page.evaluate(() => { const G = window.__hale.G; G.cheat('zone3'); G.cheat('bridges'); }); await wait(300);
  let f = await flags(); ok(f.goal === 'Go down the mine', 'the Cut live: the goal is the mine (' + f.goal + ')');
  await placeOn('Adit Lane', -7); await skate(40); await inRealm('mine'); f = await flags(); ok(f.realm === 'mine' && f.R === 480, 'skiing into the portal takes you down the mine (shell ' + f.R + ' m)');
  s = await st(); ok(s.trail === 'The Adit', 'and sets you on the Adit: ' + s.trail);
  await skate(16); s = await st(); ok(s.v > 1 && s.off < 0.6, 'you can ski down there: ' + s.v.toFixed(1) + ' m/s, on the trail');
  await placeAt(WD.altar); await wait(500); f = await flags(); ok(f.prompt === 'Wake the altar', 'the altar offers: ' + f.prompt); await page.keyboard.press('Enter'); await wait(400); f = await flags(); ok(f.altar, 'and wakes');
  await placeAt(WD.tele); await wait(600); f = await flags(); ok(f.realm === 'mine' && !f.door, 'the crown door is shut, and the teleporter beyond it does nothing yet');
  await page.evaluate(() => window.__hale.go(null)); await inRealm(null);
  for (const c of WD.crystals){ await placeAt(c); await wait(220); } f = await flags(); ok(f.crystals === 20, 'the 20 crystals it raised are all found: ' + f.crystals);
  await placeAt(WD.cgate); await wait(500); f = await flags(); ok(f.prompt === 'Offer the crystals', 'the Crystal gate offers: ' + f.prompt); await page.keyboard.press('Enter'); await wait(400); f = await flags(); ok(f.offered && f.crystalGate, 'and opens on the Court');
  await placeAt(WD.calves[0]); await wait(400); f = await flags(); ok(f.calf === 0, 'a calf follows'); await placeAt(WD.court); await wait(700); f = await flags(); ok(f.giantUp, 'the giant wakes for it'); ok(f.taken === 1, 'and the calf takes a diamond');
  for (const i of [1, 2]){ await placeAt(WD.calves[i]); await wait(400); await placeAt(WD.court); await wait(500); } f = await flags(); ok(f.taken === 3 && f.crowned, 'three calves crowned: you are crowned'); ok(f.purple, 'and wear the purple'); ok(f.door, 'the crown door knows you');
  await page.evaluate(() => window.__hale.go('mine')); await inRealm('mine'); await placeAt(WD.tele); await inRealm('station'); f = await flags(); ok(f.realm === 'station' && f.R === 1500, 'the teleporter lifts you to the Orbital Gateway (shell ' + f.R + ' m)');
  await skate(20); s = await st(); ok(s.v > 1 && !!s.trail, 'you can ski up there: ' + s.v.toFixed(1) + ' m/s on ' + s.trail);
  for (const c of WD.crown){ await placeAt(c); await wait(200); } f = await flags(); ok(f.crown === 30, 'all 30 crown crystals: ' + f.crown);
  await page.evaluate(() => window.__hale.go(null)); await inRealm(null);
  await placeAt(WD.court); await wait(600); f = await flags(); ok(f.prompt === 'Offer the crown crystals', 'the Court\'s altar offers: ' + f.prompt); await page.keyboard.press('Enter'); await wait(500); f = await flags(); ok(f.ceremony && f.crownGate, 'the ceremony: the Crown gate opens');
  await page.reload(); await page.waitForFunction(() => window.__hale, null, { timeout: 240000 }); f = await flags(); ok(f.ceremony && f.crowned && f.purple, 'and a reload keeps all of it');
  // the Ascent, lit by the ceremony: up it to the ending
  const toFoot = () => page.evaluate(() => { const H = window.__hale, W = H.W, t = W.TRAILS[W.TRAILS.length - 1], p = t.pts[t.pts.length - 8], ll = W.toLL(p); H.place(ll[0], ll[1], W.bearing(p, t.pts[t.pts.length - 5])); });
  await toFoot(); const r0 = (await st()).r; await skate(26); s = await st(); ok(s.onB === 'The Ascent', 'lit: onto the Ascent'); ok(s.r > r0 + 1.5, 'and climbing: ' + r0.toFixed(1) + ' > ' + s.r.toFixed(1));
  await skate(40); { const q = await st(); ok(q.onB && q.bi > s.bi + 6 && q.v > 1.5, 'the bridge assist carries you round the curve: sample ' + s.bi + ' > ' + q.bi + ' at ' + q.v.toFixed(1) + ' m/s'); }
  await page.evaluate(() => { const H = window.__hale, B = H.sk.onBridge; if (!B) return; const V = B.b.V, i = V.length - 14, s = H.sk; s.n.copy(V[i]); B.i = i; s.ex.addScaledVector(s.n, -s.ex.dot(s.n)).normalize(); s.ey.crossVectors(s.ex, s.n).normalize(); const tn = V[i + 1].clone().sub(V[i]).normalize(); s.S.th = s.S.tgt = Math.atan2(tn.dot(s.ex), -tn.dot(s.ey)); s.S.vx = s.S.vy = 0; });
  await skate(30); s = await st(); ok(s.ended, 'the top ends the game (at ' + s.bi + ', ' + s.r.toFixed(0) + ' m up)');
  ok(kept >= 5, 'a reload kept the progress: ' + kept + ' terminals powered');
  ok(h.errors.length === 0, 'no page errors: ' + h.errors.join(' | '));
  console.log(`${pass} checks passed, ${fail} failed`); await h.close(); process.exit(fail ? 1 : 0);
})();
