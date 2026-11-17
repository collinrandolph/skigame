// Plays v4 in headless Chromium, start to ending, through the rules: skating; a shut gate; a terminal; the gate opening; a
// drawbridge up, then lowered and crossed; the mine's door skied through at the bottom of the pit; the altar; the Highland
// bridge and the crystals; the Crystal gate; the calves, the giant, the crown; the crown room; the rings (mine > station >
// surface, and the surface ring waking); the ceremony; the steps of light to the summit; and a reload keeping it all.
// For the later chapters it puts the skier down at each place; it does not ski the distances between.
const { open } = require('../../tools/test/browser/harness');
let pass = 0, fail = 0; const ok = (c, m) => { if (c) pass++; else { fail++; console.log('FAIL', m); } };
(async () => {
  const h = await open('v4/index.html?q=low', { wait: false }); const page = h.page;
  await page.waitForFunction(() => window.__hale, null, { timeout: 300000 });
  await page.evaluate(() => { localStorage.clear(); window.__hale.G.reset(); });
  const st = () => page.evaluate(() => { const H = window.__hale, s = H.sk, g = H.G.state(), n = [s.n.x, s.n.y, s.n.z]; return { v: s.speed(), trail: s.trailName, off: s.S.off, mode: s.mode, onB: s.onBridge ? s.onBridge.b.src.src.name : null, bi: s.onBridge ? s.onBridge.i : -1, r: s.surfaceR() - H.sk.P.R,
    prompt: H.G.prompt ? H.G.prompt.text : null, hint: H.G.hint, active: g.active, got: g.got.length, powered: Object.keys(g.powered), orbs: H.G.orbs().length, ended: H.ended, dist: s.S.dist, n, realm: H.realm, R: s.P.R,
    altar: g.altar, crystals: g.crystals.length, offered: g.offered, calf: g.calf, giantUp: g.giantUp, taken: g.taken.length, crowned: g.crowned, crown: g.crown.length, ceremony: g.ceremony, goal: H.G.goal().title, purple: s.SKIER.mats.jacket.color.getHex() === 0x7b3fe0, door: H.G.doorOpen(0), ring: H.ringAwake }; });
  const skate = async (n, ms = 380) => { for (let i = 0; i < n; i++){ const k = i % 2 ? 'ArrowRight' : 'ArrowLeft'; await page.keyboard.down(k); await page.waitForTimeout(ms); await page.keyboard.up(k); } };
  const placeOn = (name, i, back) => page.evaluate(([name, i, back]) => { const H = window.__hale, W = H.W, t = W.TRAILS.find(q => q.name === name), M = t.pts.length, k = i < 0 ? M + i : i, p = t.pts[k], q = t.pts[Math.max(0, Math.min(M - 1, k + (back ? -2 : 2)))], ll = W.toLL(p); H.place(ll[0], ll[1], W.bearing(p, q)); H.sk.S.vx = H.sk.S.vy = 0; }, [name, i, back]);
  const placeAt = (d, to) => page.evaluate(([d, to]) => { const H = window.__hale, ll = H.W.toLL(d); H.place(ll[0], ll[1], to ? H.W.bearing(d, to) : undefined); H.sk.S.vx = H.sk.S.vy = 0; }, [d, to]);
  const wait = ms => page.waitForTimeout(ms), open_ = n => page.evaluate(n => window.__hale.G.bridgeOpen(n), n), gate = n => page.evaluate(n => window.__hale.G.gateOpen(n), n);
  const inRealm = async r => { await page.waitForFunction(r => window.__hale.realm === r && +document.getElementById('fade').style.opacity < 0.2, r, { timeout: 90000 }); await wait(300); };
  const W = await page.evaluate(() => { const W = window.__hale.W, M = W.REALMS.mine, S = W.REALMS.station, D = W.DRAWS[0], road = W.TRAILS.find(t => t.z === '2' && !t.closed && (W.dist(t.pts[t.pts.length - 1], D.foot) < 3 || W.dist(t.pts[0], D.foot) < 3)), pit = W.TRAILS.find(t => t.pit);
    return { terms: W.TERMINALS.map(t => ({ name: t.name, at: t.at, orbs: t.orbs })), eg: W.GATES.find(g => g.name === 'East gate'), draw: { name: D.name, foot: D.foot, top: D.top, post: W.GAME.bridges.find(b => b.name === D.name).post, road: road.name, atEnd: W.dist(road.pts[0], D.foot) > 3 },
      pit: pit.pts.length, altar: M.altar, mring: M.ring, crown: W.GAME.underground.crownCrystals.d, crystals: W.CRYSTALS, cgate: W.GATES.find(g => g.name === 'Crystal gate').d, calves: W.COURT.calves, court: W.COURT.d, farRing: S.farRing, sring: W.SURFACE_RING.d,
      steps: W.STEPS.map(b => ({ name: b.name, foot: b.foot, next: b.pts[5] })), last: W.STEPS[W.STEPS.length - 1].name }; });

  let s = await st(); ok(s.trail === 'Frostline Loop', 'starts on Frostline Loop: ' + s.trail); ok(s.v < 0.8, 'starts near rest: ' + s.v.toFixed(2));
  await skate(14, 420); s = await st(); ok(s.v > 1.5, 'kicking builds speed: ' + s.v.toFixed(2)); ok(s.dist > 8, 'and covers ground: ' + s.dist.toFixed(1)); ok(s.off < 0.5, 'trail assist keeps you on the trail: off ' + s.off.toFixed(2));
  await page.keyboard.down('ArrowUp'); await wait(300); s = await st(); ok(s.mode === 'tuck', 'up tucks'); await page.keyboard.up('ArrowUp');
  await page.keyboard.down('ArrowDown'); await wait(5000); { const v0 = s.v; s = await st(); ok(s.mode === 'plow' && s.v < Math.max(1, v0*0.6), 'down plows you slower: ' + v0.toFixed(2) + ' > ' + s.v.toFixed(2)); } await page.keyboard.up('ArrowDown');
  // chapter 1: the East gate shut, a terminal, the gate open
  const eg = W.eg, beyond = n => page.evaluate(([n, name, i]) => { const W = window.__hale.W, t = W.TRAILS.find(q => q.name === name); let bi = 0, bd = -2; t.pts.forEach((p, k) => { const c = W.dot(p, n); if (c > bd){ bd = c; bi = k; } }); return bi - i; }, [n, eg.trail, eg.i]);
  const from = eg.i > 12 ? eg.i - 9 : eg.i + 9, sgn = eg.i > 12 ? 1 : -1;
  await placeOn(eg.trail, from, sgn < 0); await skate(22); s = await st(); ok(sgn*(await beyond(s.n)) <= 0, 'the shut East gate holds'); ok(/East gate: locked/.test(s.hint || ''), 'and says why: ' + s.hint);
  const t1 = W.terms[0]; await placeAt(t1.at); await wait(500); s = await st(); ok(s.prompt === 'Start Terminal 1', 'at the terminal the offer shows: ' + s.prompt);
  await page.keyboard.press('Enter'); await wait(400); s = await st(); ok(s.active === 'Terminal 1' && s.orbs === t1.orbs.length, 'Enter starts it: ' + s.orbs + ' orbs out');
  for (const o of t1.orbs){ await placeAt(o); await wait(300); } s = await st(); ok(s.got === t1.orbs.length, 'every orb fetched: ' + s.got);
  await placeAt(t1.at); await wait(500); s = await st(); ok(s.powered.includes('Terminal 1'), 'back at the terminal it powers');
  await page.evaluate(() => window.__hale.G.cheat('zone1')); await wait(400);
  await placeOn(eg.trail, eg.i - 6*sgn, sgn < 0); await skate(40); s = await st(); ok(sgn*(await beyond(s.n)) > 0, 'zone 1 live: through the East gate (' + sgn*(await beyond(s.n)) + ' samples past)');
  // chapter 2: the drawbridge
  const D = W.draw, toBridge = () => placeOn(D.road, D.atEnd ? -4 : 3, !D.atEnd), across = n => page.evaluate(([n, a, b]) => { const W = window.__hale.W; return W.dist(n, b) < W.dist(n, a); }, [n, D.foot, D.top]);
  await toBridge(); await skate(24); s = await st(); ok(!(await across(s.n)) && !s.onB, 'the raised ' + D.name + ' does not carry you');
  await page.evaluate(() => window.__hale.G.cheat('zone2')); await placeAt(D.post); await wait(500); s = await st(); ok(s.prompt === 'Lower the ' + D.name, 'its post offers: ' + s.prompt); await page.keyboard.press('e'); await wait(2500);
  await toBridge(); await skate(90); s = await st(); ok(s.onB === D.name || await across(s.n), 'lowered, it carries you out over the river (' + (s.onB || s.trail || 'open ground') + ')');
  await page.reload(); await page.waitForFunction(() => window.__hale, null, { timeout: 300000 }); s = await st(); ok(s.powered.length >= 5, 'a reload keeps the progress: ' + s.powered.length + ' terminals powered');
  // the steps are dark
  const toSteps = k => placeAt(W.steps[k].foot, W.steps[k].next);
  ok(!(await open_('First Step')), 'the steps of light are dark');
  // chapter 4: down the pit and through the door
  await page.evaluate(() => { const G = window.__hale.G; G.cheat('zone3'); G.cheat('bridges'); }); await wait(300); s = await st(); ok(s.goal === 'Go down the mine', 'the far plain live: the goal is the mine'); ok(await gate('Mine portal'), 'and the mine portal on the Pit Road is open');
  await placeOn('Pit Road', -9); await skate(40); await inRealm('mine'); s = await st(); ok(s.realm === 'mine', 'skiing off the end of the Pit Road, through the door, you are in the mine'); ok(s.r < -200, 'at the bottom of the pit: ' + s.r.toFixed(0) + ' m');
  ok(s.trail === 'The Adit', 'on the Adit: ' + s.trail); await skate(16); s = await st(); ok(s.v > 1 && s.off < 0.7, 'you can ski down there: ' + s.v.toFixed(1) + ' m/s');
  await placeAt(W.altar); await wait(500); s = await st(); ok(s.prompt === 'Wake the altar', 'the altar offers: ' + s.prompt); await page.keyboard.press('Enter'); await wait(400); s = await st(); ok(s.altar, 'and wakes'); ok(!s.door, 'the crown door is shut');
  ok(await open_('Highland bridge'), 'the Highland bridge lights');
  // the rings: mine > station > the surface (waking the surface ring) > station again
  ok(!s.ring, 'the surface ring is dark'); await placeAt(W.mring); await inRealm('station'); s = await st(); ok(s.realm === 'station' && s.R === 1450, 'the mine\'s ring lifts you to the Orbital Gateway (shell ' + s.R + ' m)');
  await skate(20); s = await st(); ok(s.v > 1 && !!s.trail, 'you can ski up there: ' + s.v.toFixed(1) + ' m/s on ' + s.trail);
  await placeAt(W.farRing); await inRealm(null); s = await st(); ok(s.realm === null && s.ring, 'the far ring sets you down by the mine portal, and the surface ring wakes');
  await wait(400); await placeAt(W.sring); await inRealm('station'); ok(true, 'the surface ring takes you back up'); await placeAt(W.farRing); await inRealm(null);
  // chapters 5 and 6
  for (const c of W.crystals){ await placeAt(c); await wait(220); } s = await st(); ok(s.crystals === 20, 'the 20 highland crystals: ' + s.crystals);
  await placeAt(W.cgate); await wait(500); s = await st(); ok(s.prompt === 'Offer the crystals', 'the Crystal gate offers: ' + s.prompt); await page.keyboard.press('Enter'); await wait(400); s = await st(); ok(s.offered && await gate('Crystal gate') && await open_('Crystal bridge'), 'and opens, and the Crystal bridge lights');
  // chapter 7
  await placeAt(W.calves[0]); await wait(400); s = await st(); ok(s.calf === 0, 'a calf follows'); await placeAt(W.court); await wait(700); s = await st(); ok(s.giantUp, 'the giant wakes for it'); ok(s.taken === 1, 'and the calf takes a diamond');
  for (const i of [1, 2]){ await placeAt(W.calves[i]); await wait(400); await placeAt(W.court); await wait(500); } s = await st(); ok(s.taken === 3 && s.crowned, 'three calves crowned: you are crowned'); ok(s.purple, 'and wear the purple'); ok(s.door, 'the crown door knows you');
  // chapter 8: the crown room, in the mine
  await page.evaluate(() => window.__hale.go('mine')); await inRealm('mine'); for (const c of W.crown){ await placeAt(c); await wait(200); } s = await st(); ok(s.crown === 30, 'the 30 crown crystals, in the crown room: ' + s.crown);
  await page.evaluate(() => window.__hale.go(null)); await inRealm(null);
  // chapter 9
  await placeAt(W.court); await wait(600); s = await st(); ok(s.prompt === 'Offer the crown crystals', 'the altar on the Broken Circle offers: ' + s.prompt); await page.keyboard.press('Enter'); await wait(500); s = await st(); ok(s.ceremony, 'the ceremony'); ok(await open_('First Step') && await open_(W.last), 'the steps of light wake, all ' + W.steps.length);
  await page.reload(); await page.waitForFunction(() => window.__hale, null, { timeout: 300000 }); s = await st(); ok(s.ceremony && s.crowned && s.purple && s.ring, 'a reload keeps all of it');
  await toSteps(0); const r0 = (await st()).r; await skate(30); s = await st(); ok(s.onB === 'First Step', 'onto the First Step: ' + s.onB); ok(s.r > r0 + 1, 'and climbing: ' + r0.toFixed(1) + ' > ' + s.r.toFixed(1));
  await page.evaluate(last => { const H = window.__hale, s = H.sk, B = s.bridges.find(b => b.src.src.name === last), V = B.V, i = V.length - 12; s.n.copy(V[i]); s.ex.addScaledVector(s.n, -s.ex.dot(s.n)).normalize(); s.ey.crossVectors(s.ex, s.n).normalize(); const tn = V[i + 1].clone().sub(V[i]).normalize(); s.S.th = s.S.tgt = Math.atan2(tn.dot(s.ex), -tn.dot(s.ey)); s.S.vx = s.S.vy = 0; s.putOnBridge(B, i); }, W.last);
  await skate(30); s = await st(); ok(s.ended, 'the top of the ' + W.last + ' is the summit, and the end (' + s.r.toFixed(0) + ' m up)');
  ok(h.errors.length === 0, 'no page errors: ' + h.errors.join(' | '));
  console.log(`${pass} checks passed, ${fail} failed`); await h.close(); process.exit(fail ? 1 : 0);
})();
