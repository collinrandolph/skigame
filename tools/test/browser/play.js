// Plays the v2 world in the real page: chapters 1 to 3 by standing where things are, and the gates and a drawbridge by skiing at them.
const { open } = require('./harness.js'), fs = require('fs');
const L = JSON.parse(fs.readFileSync(require('path').join(__dirname, '../../../planets/v2-world.json'), 'utf8')), game = L.game, R = L.radius;
let fails = 0, n = 0; const ok = (c, m) => { n++; if (!c){ fails++; console.log('  FAIL:', m); } };
(async () => {
  const h = await open('prototypes/planetoid.html?layout=../planets/v2-world.json'), page = h.page;
  const E = (f, a) => page.evaluate(f, a), tick = async (ms = 250) => { await page.waitForTimeout(ms); await page.waitForFunction(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(() => r(window.__planetoid.gameSynced())))), null, { timeout: 60000 }); };
  const place = async d => { await E(d => { const p = window.__planetoid; p.TEST.place(new THREE.Vector3(...d)); p.S.vx = p.S.vy = 0; }, d); await tick(); };
  const ui = () => E(() => ({ goal: document.getElementById('gTitle').textContent, detail: document.getElementById('gDetail').textContent, prompt: document.getElementById('gPrompt').hidden ? null : document.getElementById('gPromptT').textContent, hint: document.getElementById('gHint').hidden ? null : document.getElementById('gHint').textContent, toast: document.getElementById('gToast').hidden ? null : document.getElementById('gToast').textContent, snow: document.getElementById('hSnow').textContent }));
  const variant = name => E(name => (window.__planetoid.modelVariants().find(m => m[0] === name) || [])[1], name), locks = () => E(() => Object.fromEntries(window.__planetoid.bridgeLocks().map(b => [b[0], b[1]])));
  // ski from `back` metres behind a spot along a compass bearing, kicking for `secs`; returns how far along you got
  const skiAt = async (d, bearing, back, secs) => {
    await E(([d, bearing, back, R]) => { const p = window.__planetoid, V = THREE.Vector3, u = new V(...d).normalize(), a = Math.abs(u.y) < 0.9 ? new V(0, 1, 0) : new V(1, 0, 0), e = a.clone().cross(u).normalize(), nn = u.clone().cross(e), r = bearing*Math.PI/180;
      const f = nn.clone().multiplyScalar(Math.cos(r)).addScaledVector(e, Math.sin(r)), from = u.clone().multiplyScalar(R).addScaledVector(f, -back).normalize();
      p.TEST.place(from); const ex = new V(1, 0, 0).addScaledVector(from, -from.x).normalize(), ey = ex.clone().cross(from).normalize();
      p.S.vx = p.S.vy = 0; p.S.th = p.S.tgt = Math.atan2(f.dot(ex), -f.dot(ey)); window.__run = { from: from.toArray(), f: f.toArray() }; }, [d, bearing, back, R]);
    // (pushed along at a steady 5 m/s: whatever stands in the way takes that speed off, as it would a skier's)
    for (let t = 0; t < secs*1000; t += 100){ await E(() => { const p = window.__planetoid; p.S.vx = 5*Math.sin(p.S.th); p.S.vy = -5*Math.cos(p.S.th); }); await page.waitForTimeout(100); }
    return E(R => { const p = window.__planetoid, r = window.__run; return (p.n.x - r.from[0])*r.f[0]*R + (p.n.y - r.from[1])*r.f[1]*R + (p.n.z - r.from[2])*r.f[2]*R; }, R);
  };
  const model = name => L.models.find(m => m.name === name);

  // ---- a fresh game
  let u = await ui(); ok(/Bowl/.test(u.goal) && /0 of 2/.test(u.detail), 'goal shows: ' + JSON.stringify(u));
  ok(Object.values(await locks()).every(Boolean), 'all four bridges start locked'); ok(await variant('East gate') === 0 && await variant('Terminal 1') === 0, 'gate shut, terminal dormant');
  // the shut East gate stops a skier; (both ways along the trail, in case the model faces the other way)
  const eg = model('East gate'); const shut1 = await skiAt(eg.d, eg.rot + 90, 10, 6), shut2 = await skiAt(eg.d, eg.rot + 270, 10, 6);
  console.log('  shut East gate: got', shut1.toFixed(1), 'and', shut2.toFixed(1), 'm of the 10 m to it'); ok(shut1 < 10.5 && shut2 < 10.5, 'the shut gate holds');
  u = await ui(); ok(u.hint && /locked/.test(u.hint), 'and says it is locked: ' + u.hint);
  // a dark light bridge and a raised drawbridge can't be skied onto
  const wd = L.bridges.find(b => b.name === 'West drawbridge'), post = game.bridges[0].post;
  const bearingTo = (a, b) => { const nrm = v => { const l = Math.hypot(...v); return v.map(x => x/l); }, u = nrm(a), up = Math.abs(u[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0], cr = (p, q) => [p[1]*q[2] - p[2]*q[1], p[2]*q[0] - p[0]*q[2], p[0]*q[1] - p[1]*q[0]], e = nrm(cr(up, u)), nn = cr(u, e), dt = b.map((x, i) => x - u[i]); return Math.atan2(dt[0]*e[0] + dt[1]*e[1] + dt[2]*e[2], dt[0]*nn[0] + dt[1]*nn[1] + dt[2]*nn[2])*180/Math.PI; };
  const farEnd = wd.pts.find(p => Math.hypot(p[0] - post[0], p[1] - post[1], p[2] - post[2]) > 0.05), brg = bearingTo(post, farEnd);
  await skiAt(post, brg, 5, 4); u = await ui(); ok(!/bridge/i.test(u.snow), 'the raised drawbridge is not there to ski: ' + u.snow);

  // ---- chapter 1
  for (const name of ['Terminal 1', 'Terminal 2']){
    const t = game.terminals.find(x => x.name === name);
    await place(t.d); u = await ui(); ok(u.prompt === 'Start ' + name, name + ' offers: ' + u.prompt);
    await page.keyboard.press('Enter'); await tick(); ok(await variant(name) === 1, name + ' shows running'); ok(await E(() => window.__planetoid.gameItems()) === t.orbs.length, 'its orbs are drawn');
    if (name === 'Terminal 1') await page.screenshot({ path: 'play-orbs.png' });
    for (const o of t.orbs) await place(o);
    ok(await E(() => window.__planetoid.gameItems()) === 0, 'orbs collected'); await place(t.d); await tick(400); ok(await variant(name) === 2, name + ' powered');
  }
  ok(await variant('East gate') === 1 && await variant('North gate') === 1, 'both gates open'); u = await ui(); ok(/home plain/.test(u.goal), 'goal: ' + u.goal);
  const open1 = await skiAt(eg.d, eg.rot + 90, 10, 6), open1b = await skiAt(eg.d, eg.rot + 270, 10, 6); console.log('  open East gate: got', open1.toFixed(1), 'and', open1b.toFixed(1), 'm (the gate is at 10)'); ok(open1 > 15 && open1b > 15, 'you can ski through the open gate');
  await page.screenshot({ path: 'play-gate.png' });
  const ng = model('North gate'); const open2 = await skiAt(ng.d, ng.rot + 90, 10, 6), open3 = await skiAt(ng.d, ng.rot + 270, 10, 6); console.log('  open North gate: got', open2.toFixed(1), 'and', open3.toFixed(1), 'm (the gate is at 10)'); ok(Math.max(open2, open3) > 19, 'and through the North gate');

  // ---- chapter 2 (terminals by the rules' shortcut, then the post by hand)
  await place(post); u = await ui(); ok(u.hint && /no power/.test(u.hint), 'dead post: ' + u.hint);
  await E(() => window.__planetoid.game().cheat('zone2')); await tick(); await place(post); u = await ui(); ok(u.prompt === 'Lower the West drawbridge', 'post offers: ' + u.prompt);
  await page.keyboard.press('e'); await tick(); let lk = await locks(); ok(lk['West drawbridge'] === false && lk['East drawbridge'] === true && lk['Highland bridge'] === true, 'only the West drawbridge is down: ' + JSON.stringify(lk)); ok(await variant('West drawbridge post') === 1, 'its post shows open');
  const over = await skiAt(post, brg, 5, 8); u = await ui(); console.log('  drawbridge: got', over.toFixed(1), 'm along;', u.snow); ok(/West drawbridge/.test(u.snow) || over > 100, 'you can ski onto the lowered drawbridge');
  await page.screenshot({ path: 'play-bridge.png' });

  // ---- chapter 3 and the mine's lock
  ok(await E(() => window.__planetoid.game().blockers().length) === 1, 'mine ramp blocked'); await E(() => window.__planetoid.game().cheat('zone3')); await tick();
  ok(await variant('Mine portal') === 1 && await E(() => window.__planetoid.game().blockers().length) === 0, 'mine portal open'); u = await ui(); ok(/mine/.test(u.goal), 'goal: ' + u.goal);

  // ---- chapters 4 to 6 through the rules, drawn here
  await E(() => window.__planetoid.game().cheat('altar')); await tick(); lk = await locks(); ok(lk['Highland bridge'] === false && lk['Crystal bridge'] === true, 'Highland bridge lit'); ok(await E(() => window.__planetoid.gameItems()) === 20, '20 crystals drawn');
  await place(game.crystals[0]); ok(await E(() => window.__planetoid.gameItems()) === 19, 'a crystal collected by skiing to it'); await page.screenshot({ path: 'play-crystals.png' });

  // ---- saved, and back at the last terminal after a reload
  await page.reload(); await page.waitForFunction(() => window.__planetoid && document.getElementById('loading').style.display === 'none', null, { timeout: 180000 }); await tick(600);
  ok(await variant('East gate') === 1 && (await locks())['West drawbridge'] === false && await E(() => window.__planetoid.gameItems()) === 19, 'progress survives a reload');
  const cp = await E(() => { const p = window.__planetoid, c = p.game().checkpoint(); return Math.acos(Math.min(1, p.n.x*c[0] + p.n.y*c[1] + p.n.z*c[2]))*p.P.R; }); ok(cp < 3, 'you start at the checkpoint (' + cp.toFixed(1) + ' m off)');
  console.log(`play test: ${n - fails} of ${n} checks passed; page errors:`, h.errors.filter(e => !/ERR_FAILED/.test(e)));
  await h.close(); process.exit(fails ? 1 : 0);
})().catch(e => { console.error('FAILED', e); process.exit(1); });
