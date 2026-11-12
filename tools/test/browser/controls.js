// The base game's control scheme on the planet, in the real page: keyboard, a mocked controller, touch events on the
// pads, the trail assist and junction snapping.
const { open } = require('./harness.js'), fs = require('fs'), path = require('path');
const L = JSON.parse(fs.readFileSync(path.join(__dirname, '../../../planets/v2-world.json'), 'utf8')), R = L.radius;
let pass = 0, fail = 0; const ok = (c, m) => { c ? pass++ : fail++; console.log((c ? '  ok   ' : '  FAIL ') + m); };
const norm = v => { const l = Math.hypot(...v); return v.map(x => x/l); }, dot = (a, b) => a[0]*b[0] + a[1]*b[1] + a[2]*b[2];
(async () => {
  const h = await open('prototypes/planetoid.html?layout=../planets/v2-world.json'), page = h.page, E = (f, a) => page.evaluate(f, a), wait = ms => page.waitForTimeout(ms);
  await E(() => { localStorage.clear(); window.__planetoid.game().reset(); window.__planetoid.game().cheat('zone1'); });
  const ctl = () => E(() => window.__planetoid.ctl()), spd = () => E(() => Math.hypot(window.__planetoid.S.vx, window.__planetoid.S.vy));
  const stop = async () => { await E(() => { const S = window.__planetoid.S; S.vx = S.vy = 0; }); await wait(520); await E(() => { const S = window.__planetoid.S; S.vx = S.vy = 0; }); };   // (past the kick-turn window too)
  // a straight stretch of a home-plain loop: stand on it, facing along it
  const tr = L.trails.find(t => t.name === 'Northfield loop'), P_ = tr.pts.map(norm); let bi = 2, bb = 9;
  for (let i = 1; i < P_.length - 3; i++){ const t = k => norm(P_[k + 1].map((v, j) => v - P_[k][j])), b = Math.max(Math.acos(Math.min(1, dot(t(i - 1), t(i)))), Math.acos(Math.min(1, dot(t(i), t(i + 1))))); if (b < bb){ bb = b; bi = i; } }
  const at = P_[bi], tan = norm(P_[bi + 1].map((v, j) => v - at[j]));
  const place = (offDeg = 0, v = 0) => E(([at, tan, offDeg, v]) => { const p = window.__planetoid, V = THREE.Vector3, d = new V(...at); p.TEST.place(d); const f = new V(...tan), th = Math.atan2(f.dot(p.ex), -f.dot(p.ey)) + offDeg*Math.PI/180; p.S.th = p.S.tgt = th; p.S.thv = 0; p.S.vx = v*Math.sin(th); p.S.vy = -v*Math.cos(th); }, [at, tan, offDeg, v]);
  console.log('straightest stretch of Northfield loop: bends', (bb*180/Math.PI).toFixed(1), 'deg');

  console.log('keyboard');
  await place(); await stop();
  await page.keyboard.down('ArrowLeft'); await wait(150); let c = await ctl(); const vPlain = await spd();
  ok(c.lastLeg === 'L' && c.held.L && vPlain > 1.5, 'left arrow kicks off the left leg and holds the glide (' + vPlain.toFixed(2) + ' m/s)');
  await page.keyboard.up('ArrowLeft'); c = await ctl(); ok(!c.held.L, 'letting go releases the glide');
  await stop(); await page.keyboard.down('Space'); await page.keyboard.down('ArrowRight'); await wait(150); const vLoaded = await spd(); c = await ctl();
  ok(vLoaded > vPlain*1.25 && c.v1 === false, 'Space held: a loaded stroke, ' + (vLoaded/vPlain).toFixed(2) + ' times the push, poling as V2');
  await page.keyboard.up('ArrowRight'); await page.keyboard.up('Space');
  await place(0, 6); await page.keyboard.down('ArrowUp'); await wait(80); c = await ctl(); ok(c.mode === 'tuck', 'up arrow tucks');
  const tg0 = await E(() => window.__planetoid.S.tgt), k0 = c.streak; await page.keyboard.down('ArrowRight'); await wait(500); c = await ctl(); const tg1 = await E(() => window.__planetoid.S.tgt);
  ok(c.keyLean === 1 && tg1 - tg0 > 0.1 && c.mode === 'tuck', 'in a tuck, right arrow leans right instead of kicking (turned ' + ((tg1 - tg0)*180/Math.PI).toFixed(0) + ' deg)');
  await page.keyboard.up('ArrowRight'); await page.keyboard.down('Space'); await wait(60); c = await ctl(); ok(c.tuckDeep === 1, 'Space in a tuck: a deep tuck');
  await page.keyboard.up('Space'); await page.keyboard.down('ArrowDown'); await wait(60); c = await ctl(); ok(c.mode === 'plow', 'down arrow: snow plow, from a tuck too');
  await page.keyboard.up('ArrowDown'); await wait(60); c = await ctl(); ok(c.mode === 'tuck', 'letting go of the plow: back in the tuck while up is held');
  await page.keyboard.up('ArrowUp'); await wait(60); c = await ctl(); ok(c.mode === null && c.tuckDeep === 0, 'letting go of the tuck: skating again');
  await page.keyboard.down('ArrowDown'); await wait(60); await page.keyboard.down('ArrowLeft'); await wait(60); c = await ctl(); ok(c.mode === null, 'a kick out of a snow plow goes back to skating');
  await page.keyboard.up('ArrowLeft'); await page.keyboard.up('ArrowDown');

  console.log('controller (mocked)');
  await E(() => { window.__buzz = []; window.__gp = { index: 0, connected: true, mapping: 'standard', axes: [0, 0, 0, 0], buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })),
    vibrationActuator: { effects: ['dual-rumble'], playEffect: (e, q) => { window.__buzz.push([e, q]); return Promise.resolve(); } } }; navigator.getGamepads = () => [window.__gp]; });
  const btn = (i, v) => E(([i, v]) => { window.__gp.buttons[i] = { pressed: v > 0.5, value: v }; }, [i, v]), axes = a => E(a => { window.__gp.axes = a; }, a);
  await place(); await stop(); await wait(60);
  await btn(6, 1); await wait(120); c = await ctl(); const nb = await E(() => window.__buzz.length);
  ok(c.lastLeg === 'L' && c.held.L && nb > 0, 'left trigger kicks off the left leg, and the controller buzzes');
  await btn(6, 0); await wait(60); c = await ctl(); ok(!c.held.L, 'trigger released');
  await stop(); await axes([0, 0, 1, 0]); await wait(100); c = await ctl(); ok(c.lastLeg === 'L' && c.twin[1] === 'thrown' && c.v1 === true, 'a flick of the right stick steps onto the right ski: a plain kick off the left leg');
  await axes([0, 0, 0, 0]); await wait(100); c = await ctl(); ok(c.twin[1] === 'idle' && !c.held.L, 'stick back at rest: released');
  await stop(); await axes([0.5, 0.7, 0, 0]); await wait(100); c = await ctl(); ok(c.twin[0] === 'loading', 'left stick pulled down and in: loading');
  await axes([-0.7, -0.7, 0, 0]); await wait(100); c = await ctl(); const vThrow = await spd();
  ok(c.twin[0] === 'thrown' && c.lastLeg === 'R' && c.v1 === false && vThrow > vPlain*1.2, 'thrown up and out: a loaded stroke off the right leg (' + vThrow.toFixed(2) + ' m/s)');
  await axes([0, 0, 0, 0]); await wait(80);
  await place(0, 6); await btn(4, 1); await wait(80); c = await ctl(); ok(c.mode === 'tuck', 'LB held: tuck');
  await axes([0, -0.9, 0, -0.9]); await wait(80); c = await ctl(); ok(c.tuckDeep > 0.95, 'both sticks forward: a deep tuck');
  await axes([0.6, 0, 0.6, 0]); await wait(80); c = await ctl(); ok(c.lean > 0.95, 'both sticks right: lean right');
  await axes([0, 0.8, 0, 0.8]); await wait(80); c = await ctl(); ok(c.mode === 'plow', 'both sticks back: snow plow');
  await axes([0, 0, 0, 0]); await wait(80); c = await ctl(); ok(c.mode === 'tuck', 'sticks forward again: back to the tuck');
  await btn(6, 1); await wait(80); c = await ctl(); ok(c.mode === 'tuck', 'no kicks while LB is held'); await btn(6, 0);
  await btn(4, 0); await wait(80); c = await ctl(); ok(c.mode === null, 'LB released: skating again');
  await E(() => { navigator.getGamepads = () => []; });

  console.log('touch pads');
  // (several events in one go: a thumb's first moves come within milliseconds, quicker than this script can send them one at a time)
  const ptrs = list => E(list => { for (const [id, type, pid, x, y] of list) document.getElementById(id).dispatchEvent(new PointerEvent(type, { pointerId: pid, clientX: x, clientY: y, bubbles: true, pointerType: 'touch' })); }, list);
  const ptr = (id, type, pid, x, y) => ptrs([[id, type, pid, x, y]]);
  await place(); await stop();
  await ptr('padL', 'pointerdown', 11, 100, 500); await wait(150); c = await ctl(); const vTap = await spd(); ok(c.lastLeg === 'L' && c.held.L && Math.abs(vTap - vPlain) < 0.4, 'a tap on the left pad is a plain kick (' + vTap.toFixed(2) + ' m/s)');
  await ptr('padL', 'pointerup', 11, 100, 500); c = await ctl(); ok(!c.held.L, 'lifting the thumb releases');
  await stop(); await ptrs([['padR', 'pointerdown', 12, 300, 500], ['padR', 'pointermove', 12, 300, 488], ['padR', 'pointermove', 12, 300, 460]]); c = await ctl();
  ok(c.kickTop && c.v1 === false, 'swiping up the pad upgrades that kick to a loaded stroke');
  await wait(220); const vSwipe = await spd(); ok(vSwipe > vTap*1.2, 'and the extra push arrives (' + vSwipe.toFixed(2) + ' m/s)'); await ptr('padR', 'pointerup', 12, 300, 460);
  await place(0, 6); await wait(60);
  // (speeds read in the same instant as the touches: this page runs slowly here, and a tuck's own glide would blur it)
  const dv = await E(() => { const S = window.__planetoid.S, sp = () => Math.hypot(S.vx, S.vy), ev = (id, pid, x) => document.getElementById(id).dispatchEvent(new PointerEvent('pointerdown', { pointerId: pid, clientX: x, clientY: 500, bubbles: true, pointerType: 'touch' }));
    const v0 = sp(); ev('padL', 21, 100); const v1 = sp(); ev('padR', 22, 300); return [v0, v1, sp()]; });
  await wait(40); c = await ctl();
  ok(c.dual === 'tuck' && c.mode === 'tuck' && dv[1] > dv[0] + 0.3 && Math.abs(dv[2] - dv[0]) < 1e-9, 'both thumbs down: a tuck, and the first thumb\'s kick is taken back (' + dv.map(v => v.toFixed(2)).join(', ') + ' m/s)');
  await ptr('padL', 'pointermove', 21, 140, 500); await ptr('padR', 'pointermove', 22, 340, 500); c = await ctl(); ok(c.touchLean > 0.6, 'both thumbs slid right: lean right (' + c.touchLean.toFixed(2) + ')');
  await ptr('padL', 'pointermove', 21, 140, 375); await ptr('padR', 'pointermove', 22, 340, 375); c = await ctl(); ok(c.tuckDeep > 0.95, 'both thumbs pushed forward: a deep tuck');
  await ptr('padL', 'pointermove', 21, 140, 580); await ptr('padR', 'pointermove', 22, 340, 580); c = await ctl(); ok(c.dual === 'plow' && c.mode === 'plow', 'both thumbs pulled back: snow plow');
  await ptr('padL', 'pointermove', 21, 140, 555); await ptr('padR', 'pointermove', 22, 340, 555); c = await ctl(); ok(c.dual === 'tuck' && c.mode === 'tuck', 'pushed forward again: back to the tuck');
  await ptr('padL', 'pointerup', 21, 140, 555); await ptr('padR', 'pointerup', 22, 340, 555); c = await ctl(); ok(c.mode === null && c.dual === null, 'thumbs lifted: skating again');
  const cam0 = await E(() => window.__planetoid.P.camd);
  await ptrs([['padL', 'pointerdown', 31, 100, 500], ['padR', 'pointerdown', 32, 300, 500]]); await ptr('padL', 'pointermove', 31, 70, 500); await ptr('padR', 'pointermove', 32, 330, 500); await ptr('padL', 'pointermove', 31, 40, 500); await ptr('padR', 'pointermove', 32, 360, 500);
  c = await ctl(); const cam1 = await E(() => window.__planetoid.P.camd); ok(c.dual === 'pinch' && c.mode === null && cam1 < cam0, 'thumbs spread apart: the camera comes closer (' + cam0 + ' to ' + cam1 + ' m)');
  await ptr('padL', 'pointerup', 31, 40, 500); await ptr('padR', 'pointerup', 32, 360, 500); await E(c0 => { const el = document.getElementById('tCamd'); el.value = c0; el.dispatchEvent(new Event('input')); }, cam0);

  console.log('trail assist and junctions');
  // tucked, 10 degrees off the trail's line: with the assist you're brought back onto it; without, you run off
  const run = async assist => { await E(a => { window.__planetoid.P.assist = a; }, assist); await place(10, 6); await page.keyboard.down('ArrowUp');
    for (let k = 0; k < 14; k++){ await wait(200); await E(() => { const S = window.__planetoid.S, v = Math.hypot(S.vx, S.vy) || 1; S.vx *= 6/v; S.vy *= 6/v; }); }
    const r = await E(() => ({ d: window.__planetoid.nearestTrailAt(window.__planetoid.n).d, c: window.__planetoid.ctl() })); await page.keyboard.up('ArrowUp'); return r; };
  const off = await run(0), on = await run(0.5);
  console.log('  after 17 m: ' + off.d.toFixed(1) + ' m from the trail\'s centre without the assist, ' + on.d.toFixed(1) + ' m with it');
  ok(off.d > on.d + 1 && on.d < 1.0 && on.c.assist === 'Northfield loop' && on.c.assistW > 0.3, 'the assist holds you on the trail you\'re following');
  const J = await E(() => window.__planetoid.junctionList()); ok(J.length > 20 && J.every(j => j.b.length >= 2), J.length + ' junctions found, each with its ways out');
  const j = J.find(q => q.b.length >= 3) || J[0];
  const sn = await E(([d, b]) => { const p = window.__planetoid, V = THREE.Vector3; p.TEST.place(new V(...d)); const v = new V(...b), br = Math.atan2(v.dot(p.ex), -v.dot(p.ey)), D = Math.PI/180;
    return { near: p.nearestJunction(), a: p.branchSnap(br - 20*D, 1, 25)/D, b: p.branchSnap(br - 20*D, 1, 10), c: p.branchSnap(br + 20*D, -1, 25)/D }; }, [j.d, j.b[0]]);
  ok(sn.near < 1 && Math.abs(sn.a - 20) < 0.5 && sn.b === null && Math.abs(sn.c + 20) < 0.5, 'at a junction a 25 degree kick turn stops at the trail 20 degrees round; a 10 degree one turns as normal');
  console.log('controls: ' + pass + ' of ' + (pass + fail) + ' checks passed; page errors: ' + JSON.stringify(h.errors.filter(e => !/ERR_FAILED/.test(e)).slice(0, 4)));
  await h.close(); process.exit(fail ? 1 : 0);
})().catch(e => { console.error('FAILED', e); process.exit(1); });
