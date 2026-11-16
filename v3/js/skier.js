// The skier: controls, ski physics, chase camera and input for Hale (v3).
//
// THE CODE BETWEEN THE "lifted" MARKERS IS THE GAME'S OWN, UNCHANGED: copied from prototypes/planetoid.html on the v2
// branch (the port of index.html's control scheme), so v3 skis exactly as the game does. Do not edit it here; if the
// controls change, change them there and copy the blocks across again. Everything outside the
// markers is the adapter that lets that code run on v3's world: createSkier(env) gives it the ground, the trails, the
// one bridge, the solids and the figure.
function createSkier(env){
'use strict';
const THREE = env.THREE, scene = env.scene, camera = env.camera;
const $ = id => document.getElementById(id);
const D2R = Math.PI / 180, G = 9.81;
const smooth01 = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a)/(b - a))); return t*t*(3 - 2*t); };
// tuning: the main game's defaults
const P = {
  push: 2.5, tap: 80, klen: 50, turn: 5, turn2: 5, turn3: 15, k180: 8, k180t: 6, kfloor: 15, kwin: 450,
  tfStop: 180, tfMove: 90, tfVlo: 1, tfVhi: 14, decay: 20, snap: 160, splay: 11, fric: 0.4, glide: 0.25, grip: 25,
  gwin: 600, gcut: 95, max: 38, lboost: 1.4, plow: 2.5, tuck: 50, lean: 50, camd: 15, sway: 0.8, cam: 0.6,
  rumble: 5, rumble2: 25, rumbleL: 1, swait: 90, sthrow: 34, rest: 250, tmin: 0.7, fedge: 0.92, offglide: 100,
  assist: 0.5, acap: 25, alook: 1.2, acenter: 1.5, ajunc: 18, bsnap: 20, aswitch: 1500, aramp: 1500,
  R: env.R, lift: false, off: 1.5, windPush: false,
};
let UG = null, LAWN = null, LAWN_T = null;
const WX = { vel: new THREE.Vector3() };
const TERRAIN = { stop: env.stop, links: { fillets: env.junctions.map(j => ({ wedge: [[j.x, j.y, j.z]] })) } };
const heightAt = (x, y, z) => env.height(x, y, z);
const groundR = d => P.R + heightAt(d.x, d.y, d.z);
const flatPatch = m => m;
const ugStep = () => {};
// trails, as the lifted code expects them: { name, closed, pts: [unit Vector3] }, and a grid of their segments
const TRAIL_W = 5;
const offTrail = d => { const e = d - TRAIL_W/2; return e <= -0.5 ? 0 : e >= 0 ? 1 : (e + 0.5)/0.5; };
const trails = env.trails, tgrid = new Map(), TG = Math.max(16, Math.min(160, Math.round(Math.PI/2*P.R/8)));
function cellOf(x, y, z){
  const ax = Math.abs(x), ay = Math.abs(y), az = Math.abs(z); let f, u, v, m;
  if (ax >= ay && ax >= az){ f = x > 0 ? 0 : 1; m = ax; u = y; v = z; }
  else if (ay >= az){ f = y > 0 ? 2 : 3; m = ay; u = x; v = z; }
  else { f = z > 0 ? 4 : 5; m = az; u = x; v = y; }
  const i = Math.min(TG - 1, Math.floor((u/m + 1)/2*TG)), j = Math.min(TG - 1, Math.floor((v/m + 1)/2*TG));
  return (f*TG + i)*TG + j;
}
{ const tmp = new THREE.Vector3(), reach = 14/P.R;
  trails.forEach((tr, ti) => { const M = tr.pts.length, segN = tr.closed ? M : M - 1;
    for (let k = 0; k < segN; k++){ const a = tr.pts[k], seen = new Set();
      for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) for (let dz = -1; dz <= 1; dz++){
        tmp.set(a.x + dx*reach, a.y + dy*reach, a.z + dz*reach).normalize(); const c = cellOf(tmp.x, tmp.y, tmp.z);
        if (seen.has(c)) continue; seen.add(c); let l = tgrid.get(c); if (!l) tgrid.set(c, l = []); l.push(ti, k); } } }); }
function nearestTrailAt(d){
  const list = tgrid.get(cellOf(d.x, d.y, d.z)); if (!list) return { d: Infinity, t: null };
  let best = Infinity, bt = null; const per = new Map();
  for (let i = 0; i < list.length; i += 2){
    const tr = trails[list[i]], k = list[i + 1], a = tr.pts[k], b = tr.pts[(k + 1) % tr.pts.length];
    const bx = b.x - a.x, by = b.y - a.y, bz = b.z - a.z, L2 = bx*bx + by*by + bz*bz || 1e-12;
    const u = Math.max(0, Math.min(1, ((d.x - a.x)*bx + (d.y - a.y)*by + (d.z - a.z)*bz)/L2));
    const dist = Math.hypot(d.x - a.x - u*bx, d.y - a.y - u*by, d.z - a.z - u*bz)*P.R;
    if (dist < best){ best = dist; bt = tr; }
    if (!(per.get(tr) <= dist)) per.set(tr, dist);
  }
  return { d: best, t: bt, names: bt ? [...per].filter(([, x]) => x < best + 0.6).map(([t]) => t.name) : [] };
}
// the bridge, in the shape the lifted bridge code expects
const bridgesG = env.bridges.map(b => { const V = b.pts, M = V.length;
  const tIn = [V[1].clone().sub(V[0]).normalize(), V[M - 2].clone().sub(V[M - 1]).normalize()];
  return { V, D: { s: b.s, h: b.h }, w: b.halfW, tIn, locked: true, src: b }; });
let ONB = null, exitLock = null;
const local3 = (x, y) => new THREE.Vector3().addScaledVector(ex, x).addScaledVector(ey, y);
const GAME = null; let AT_ONCE = null;
const START_N = env.start.clone();
const rocks = [], beaconList = [], pylons = [], gameBlocks = [];
const gameConfirm = () => env.confirm ? env.confirm() : false, toggleDev = () => {}, toggleSize = () => {};
function toggleView(){ viewOn = !viewOn; }
// solids: circles, in a grid
const sgrid = new Map();
for (const o of env.solids){ const c = cellOf(o.d.x, o.d.y, o.d.z); let l = sgrid.get(c); if (!l) sgrid.set(c, l = []); l.push(o); }
function collide(){
  if (TEST.ghost) return;
  const R = P.R, reach = 10/R, seen = new Set(), t = new THREE.Vector3();
  const hit = (o) => {
    const x = o.d.x, y = o.d.y, z = o.d.z, rr = o.r;
    const ox = ((x - n.x)*ex.x + (y - n.y)*ex.y + (z - n.z)*ex.z)*R, oy = ((x - n.x)*ey.x + (y - n.y)*ey.y + (z - n.z)*ey.z)*R;
    const d = Math.hypot(ox, oy), min = rr + 0.3;
    if (d >= min || d < 1e-6) return;
    const ux = ox/d, uy = oy/d, push = min - d;
    S.x -= ux*push; S.y -= uy*push; moveLocal(-ux*push, -uy*push);
    const vn = S.vx*ux + S.vy*uy; if (vn > 0){ S.vx -= ux*vn; S.vy -= uy*vn; }
  };
  for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++){ t.copy(n).addScaledVector(ex, a*reach).addScaledVector(ey, b*reach).normalize(); const c = cellOf(t.x, t.y, t.z); if (seen.has(c)) continue; seen.add(c);
    const l = sgrid.get(c); if (l) for (const o of l) if (!o.off && o.d.dot(n) > Math.cos((o.r + 2)/R)) hit(o); }
}
// >>>> lifted: the skier's frame on the planet (planetoid.html)
const n = new THREE.Vector3(), ex = new THREE.Vector3(), ey = new THREE.Vector3();
{ const a = new URLSearchParams(location.search).get('at'); if (a){ const v = a.split(',').map(Number); if (v.length === 3 && v.every(isFinite)) AT_ONCE = new THREE.Vector3(...v).normalize(); } }
function placeAtStart(){
  const cp = env.checkpoint ? env.checkpoint() : null;
  n.copy(cp || START_N); ONB = null; exitLock = null;
  ex.set(1, 0, 0).addScaledVector(n, -n.x).normalize();
  ey.crossVectors(ex, n).normalize();        // as in the game's 3D: X east, Y up, Z south (east × up = south)
}
const _d = new THREE.Vector3(), _ax = new THREE.Vector3(), _q = new THREE.Quaternion(), _t = new THREE.Vector3();
// move the skier (and their frame) along the surface by (mx, my) metres of the 2D model
function moveLocal(mx, my){
  _d.set(0, 0, 0).addScaledVector(ex, mx).addScaledVector(ey, my);
  const L = _d.length(); if (L < 1e-9) return;
  _ax.crossVectors(n, _d).normalize();
  _q.setFromAxisAngle(_ax, L / groundR(n));
  n.applyQuaternion(_q).normalize(); ex.applyQuaternion(_q);
  ex.addScaledVector(n, -ex.dot(n)).normalize(); ey.crossVectors(ex, n).normalize();
}
// the direction from the centre of a point (ox, oy) metres away in the skier's frame
function dirLocal(ox, oy, out = new THREE.Vector3()){
  return out.copy(n).multiplyScalar(P.R).addScaledVector(ex, ox).addScaledVector(ey, oy).normalize();
}
function hLocal(ox, oy){ dirLocal(ox, oy, _t); return heightAt(_t.x, _t.y, _t.z); }
// the ground's slope in the 2D model's axes (positive = rising that way)
function grad(){ const e = 0.5; return [(hLocal(e, 0) - hLocal(-e, 0))/(2*e), (hLocal(0, e) - hLocal(0, -e))/(2*e)]; }
// <<<< lifted

let steepT = 0;

// >>>> lifted: on and off a bridge, and its railings
function bridgeAt(){
  const B = ONB.b, Vs = B.V, M = Vs.length; let bi = ONB.i, bd = Infinity;
  for (let k = Math.max(0, ONB.i - 8); k <= Math.min(M - 1, ONB.i + 8); k++){ const a = Vs[k].angleTo(n); if (a < bd){ bd = a; bi = k; } }
  ONB.i = bi;
  const k1 = Math.max(0, bi - 1), k2 = Math.min(M - 1, bi + 1), D = B.D;
  const t3 = Vs[k2].clone().sub(Vs[k1]).normalize(), along = n.clone().sub(Vs[bi]).dot(t3)*P.R;
  const nb = along >= 0 ? k2 : k1, seg = Math.max(0.01, Math.abs(D.s[nb] - D.s[bi])), u = Math.min(1, Math.abs(along)/seg);
  return { bi, t3, h: D.h[bi] + (D.h[nb] - D.h[bi])*u, grade: (D.h[k2] - D.h[k1])/Math.max(0.01, D.s[k2] - D.s[k1]) };
}
const surfaceR = () => ONB ? P.R + bridgeAt().h : groundR(n);
// on and off, and the railings (after each move)
function bridgeStep(){
  const R = P.R;
  if (ONB){
    const B = ONB.b, M = B.V.length, at = bridgeAt(), bi = at.bi;
    if (bi === 0 || bi === M - 1){
      const out = B.tIn[bi === 0 ? 0 : 1].clone().negate(), mv = local3(S.vx, S.vy);
      if (mv.dot(out) > 0 || speed() < 0.05){ exitLock = { B, foot: bi === 0 ? 0 : 1 }; ONB = null; return; }
    }
    const side3 = new THREE.Vector3().crossVectors(at.t3, B.V[bi]).normalize(), lat = n.clone().sub(B.V[bi]).dot(side3)*R, lim = B.w - 0.35;
    if (Math.abs(lat) > lim){
      const sx = side3.dot(ex), sy = side3.dot(ey), L2 = Math.hypot(sx, sy) || 1, ux = sx/L2*Math.sign(lat), uy = sy/L2*Math.sign(lat), push = Math.abs(lat) - lim;
      S.x -= ux*push; S.y -= uy*push; moveLocal(-ux*push, -uy*push);
      const vn = S.vx*ux + S.vy*uy; if (vn > 0){ S.vx -= ux*vn; S.vy -= uy*vn; }
    }
    return;
  }
  const v = speed(); if (v < 0.3 || !bridgesG.length) return;
  const mv = local3(S.vx/v, S.vy/v);
  for (const B of bridgesG) if (!B.locked) for (const f of [0, 1]){
    const foot = f ? B.V[B.V.length - 1] : B.V[0], d = foot.angleTo(n)*R;
    if (exitLock && exitLock.B === B && exitLock.foot === f){ if (d > 10) exitLock = null; else continue; }
    if (d > B.w + 0.6 || mv.dot(B.tIn[f]) < Math.cos(55*D2R)) continue;
    ONB = { b: B, i: f ? B.V.length - 1 : 0 }; return;
  }
}
// <<<< lifted

// >>>> lifted: the skating model: kicks, kick turns, glide, tuck, plow
const S = { x: 0, y: 0, vx: 0, vy: 0, th: 0, thv: 0, tgt: 0, dist: 0, grade: 0, weight: 1, off: 0, trail: null };
const PUSH_LEN = 0.7, REACH = 0.6, STANCE = 0.12, PLOW_STANCE = 0.35, CAM_RELEASE_MS = 1500;
let skis = [], lastSki = { L: null, R: null }, weightLeg = null, lastLeg = null, lastKickAt = 0, camPending = 0, mode = null;
let kickDrive = null, streak = 0, kickPrevT = -1e9, streakKmh = 0, streakTrig = false, snapSkip = 0, sideRun = 0, runTurn = 0, turnRestart = false, lastTurnDeg = 0;
// the instant part of the last push, so a touch kick that turns out to be a swipe can be topped up to a loaded stroke
// (kickTop is that top-up, spread over a short time); the arms wait (armPending) while a touch decides which it is
let lastPush = null, kickTop = null, lastPushAt = 0, armAt = 0, armPending = false, junctionTurnAt = -1e9, assistQuietUntil = 0;
let tuckDeep = 0;      // 0..1: a deeper tuck (Space, sticks forward, thumbs forward), up to half the remaining drag gone
const held = { L: false, R: false }, legFlash = { L: 0, R: 0 };
let glideLeg = null, glideStart = 0;
const speed = () => Math.hypot(S.vx, S.vy);

function splayNow(){ const v = speed(); return Math.min(60, P.splay * Math.min(1.6, Math.max(0.55, Math.sqrt(4 / Math.max(v, 1.2))))); }
function fullTurnDeg(kmh = speed()*3.6){ return P.tfStop + (P.tfMove - P.tfStop) * smooth01(P.tfVlo, P.tfVhi, kmh); }
function sameSideTurn(k){
  if (k <= 1) return P.turn;
  if (k === 2) return P.turn2;
  if (streakTrig){
    const nn = Math.max(3, Math.round(P.k180t)), m = nn - 2, need = fullTurnDeg(streakKmh) - P.turn - P.turn2;
    const step = Math.max(0, (need - P.turn2*m) / (m*(m + 1)/2));
    return Math.min(90, P.turn2 + step*(k - 2));
  }
  const nn = Math.max(3, Math.round(P.k180)), rest = nn - 2, need = fullTurnDeg(streakKmh) - P.turn - P.turn2;
  const step = rest > 1 ? Math.max(0, (need - P.turn3*rest) / (rest*(rest - 1)/2)) : 0;
  return Math.min(90, P.turn3 + step*(k - 3));
}
const sameLegPower = () => Math.max(0.15, 1 - (P.decay/100) * (streak - 1));
function moveDir(){ const v = speed(); return v > 0.05 ? [S.vx/v, S.vy/v] : [Math.sin(S.th), -Math.cos(S.th)]; }
const headingOf = (dx, dy) => Math.atan2(dx, -dy);
function footAt(side, th){ return [S.x + Math.cos(th)*side*STANCE, S.y + Math.sin(th)*side*STANCE]; }

// a ski mark: straight, set down at an anchor and growing along its line. besides the 2D model's numbers it keeps its
// place on the planet (p3: direction from the centre, t3: its direction along the surface) for drawing
const MARKS = 1200;
let markSlot = 0;
function newSki(side, ang, ax = S.x, ay = S.y){
  const s = { ax, ay, dx: Math.sin(ang), dy: -Math.cos(ang), len: 0, live: true, side, dirty: true, slot: markSlot++ % MARKS, w: 0.09, rFix: ONB ? surfaceR() + 0.08 : null };
  s.p3 = dirLocal(ax - S.x, ay - S.y);
  s.t3 = new THREE.Vector3().addScaledVector(ex, s.dx).addScaledVector(ey, s.dy).normalize();
  skis.push(s); if (skis.length > MARKS) skis.shift();
  return s;
}
function setParallel(side, alongHeading = false){
  let [mx, my] = (mode === 'tuck' || alongHeading) ? [Math.sin(S.th), -Math.cos(S.th)] : moveDir();
  if (mx*Math.sin(S.th) - my*Math.cos(S.th) < 0){ mx = -mx; my = -my; }
  const st = mode === 'plow' ? PLOW_STANCE : STANCE;
  const s = newSki(side, headingOf(mx, my), S.x + (-my)*side*st, S.y + mx*side*st);
  if (mode === 'plow') s.w = 0.16;
  return s;
}
function enterMode(m){
  const fresh = mode !== m;
  if (!mode) S.tgt -= camPending;     // a mode runs straight along the stride's centre line
  mode = m; weightLeg = null; camPending = 0;
  if (fresh) for (const k of ['L', 'R']){ if (lastSki[k]) lastSki[k].live = false; lastSki[k] = setParallel(k === 'L' ? -1 : 1); }
  legFlash.L = legFlash.R = 0.6;
}

function kick(leg, opt = {}){
  // leg 'L' pushes off the left ski: heading steps right (+). leg 'R' pushes off the right ski: steps left (-)
  const side = leg === 'L' ? 1 : -1, out = -side, sameSide = leg === lastLeg;
  // (a loaded stroke counts from when you began it, so its longer wind-up doesn't break a kick turn's build)
  const tNow = performance.now(), quick = (opt.startT !== undefined ? Math.min(opt.startT, tNow) : tNow) - kickPrevT <= P.kwin;
  streak = sameSide && quick ? streak + 1 : 1;
  sideRun = sameSide ? sideRun + 1 : 1;
  kickPrevT = tNow;
  if (streak === 1){ streakKmh = speed()*3.6; streakTrig = opt.src === 'trigger'; snapSkip = 0; }
  const thPre = S.tgt;
  // 1. the push prints first: the kicking ski's line carries straight on
  const sp0 = splayNow(), bst = opt.boost || 1;
  const sp = bst > 1 ? Math.asin(Math.sin(sp0*D2R) / bst) / D2R : sp0;
  const mine = lastSki[leg];
  if (mine && mine.live){ mine.len += PUSH_LEN; mine.dirty = true; mine.live = false; }
  else { const s = newSki(out, thPre + out*sp*D2R, ...footAt(out, thPre)); s.len = PUSH_LEN; s.live = false; }
  // 2. rotate: same-leg kicks build into a kick turn from your heading; an opposite kick is measured from the camera heading
  lastTurnDeg = sameSideTurn(streak - snapSkip);
  if (sameSide && sideRun >= 3) lastTurnDeg = Math.max(lastTurnDeg, P.kfloor);
  if (!sameSide || sideRun === 1){ runTurn = 0; turnRestart = false; }
  if (sameSide && turnRestart){ lastTurnDeg = P.kfloor; turnRestart = false; }
  let a = side * lastTurnDeg * D2R;
  let camRef = S.tgt - camPending; const prev = S.tgt;
  if (sameSide){
    // near a junction, a kick turn that would swing past one of its trails stops lined up with it (and doesn't use up
    // a step of the build)
    const sn = branchSnap(prev, side, lastTurnDeg);
    if (sn !== null){ a = sn; lastTurnDeg = Math.abs(sn)/D2R; snapSkip++; }
    runTurn += lastTurnDeg;
    if (runTurn >= fullTurnDeg(streakKmh) - 0.5){ runTurn = 0; turnRestart = true; snapSkip = streak - 2; }
    S.tgt = prev + a; camRef = prev;
    // you're steering: the trail assist stands back (near a junction, only for the kick-turn window, then settles you)
    const nearJ = P.bsnap > 0 && nearestJunction() < P.bsnap;
    if (nearJ) junctionTurnAt = performance.now();
    assistQuietUntil = performance.now() + (nearJ ? P.kwin : 800);
  } else { S.tgt = camRef + a; runTurn = lastTurnDeg; }
  camPending = S.tgt - camRef;
  // 3. impulse, limited by top speed. part lands now, the rest over the kick length while the key is held
  const ang = S.tgt + side*sp*D2R, v = speed(), vmax = P.max/3.6;
  const eff = Math.max(0.08, 1 - v/vmax) * (1 - 0.5*S.off) * sameLegPower(), tap = P.tap/100, push = P.push*bst;   // half the push sinks into loose snow
  S.vx += Math.sin(ang)*push*eff*tap; S.vy += -Math.cos(ang)*push*eff*tap;
  lastPush = { dx: Math.sin(ang), dy: -Math.cos(ang), amt: P.push*eff*tap };
  kickDrive = { leg, dx: Math.sin(ang), dy: -Math.cos(ang), base: push*(1 - 0.5*S.off)*sameLegPower()*(1 - tap), done: 0 };
  // 4. the other ski takes the weight (re-set along the new heading in a kick turn)
  const other = leg === 'L' ? 'R' : 'L', o = lastSki[other];
  if (!o || !o.live || !o.glide || sameSide){
    if (o) o.live = false;
    lastSki[other] = newSki(side, S.tgt + side*sp*D2R, ...footAt(side, S.tgt));
    lastSki[other].glide = true;
  }
  weightLeg = other; lastSki[leg] = null;
  lastLeg = leg; lastKickAt = lastPushAt = armAt = performance.now(); armPending = false; legFlash[leg] = 1;
}
// any kick goes back to skating, whatever was held
function press(leg, boost = 1, src = null, startT){ hold.tuck.clear(); hold.plow.clear(); mode = null; strideV1 = boost <= 1; held[leg] = true; kick(leg, { boost, src, startT }); glideLeg = leg; glideStart = performance.now(); rumble(leg, kickBuzz(boost)); }
function release(leg){ held[leg] = false; }
function glideMult(){
  if (!glideLeg || !held[glideLeg]) return 1;
  const t = (performance.now() - glideStart) / Math.max(1, P.gwin);
  if (t >= 1) return 1;
  const f = t < 0.6 ? 0 : (t - 0.6)/0.4, e = f*f*(3 - 2*f);
  return 1 - (P.gcut/100) * (1 - e);
}

// tuck and snow plow are held; letting go of the plow returns you to a tuck if that's still held
const hold = { tuck: new Set(), plow: new Set() };
function setTuck(on, src){ on ? hold.tuck.add(src) : hold.tuck.delete(src); syncMode(); }
function setPlow(on, src){ on ? hold.plow.add(src) : hold.plow.delete(src); syncMode(); }
function syncMode(){
  const want = hold.plow.size ? 'plow' : hold.tuck.size ? 'tuck' : null;
  if (want && want !== mode) enterMode(want);
  else if (!want && mode) mode = null;           // both skis stay down until your next stroke
}
let keyLean = 0, touchLean = 0, lean = 0;      // -1..1 while tucked: the keys, both thumbs, or the sticks lean you that way
// <<<< lifted

// >>>> lifted: trail assist and junction snapping
let JUNCS = null;      // each junction: where it is, and the ways out of it (10 m along every trail through it, both ways)
function buildJunctions(){
  JUNCS = [];
  const fl = (typeof TERRAIN !== 'undefined' && TERRAIN && TERRAIN.links && TERRAIN.links.fillets) || [], R = P.R, V = THREE.Vector3;
  for (const f of fl){ const c = new V(...f.wedge[0]).normalize(); if (!JUNCS.some(j => j.d.distanceTo(c)*R < 8)) JUNCS.push({ d: c, b: [] }); }
  for (const J of JUNCS) for (const tr of trails){
    if (tr.fillet) continue;
    const p = tr.pts, M = p.length; let bi = -1, bd = 4;
    for (let i = 0; i < M; i++){ const d = p[i].distanceTo(J.d)*R; if (d < bd){ bd = d; bi = i; } }
    if (bi < 0) continue;
    const at = k => tr.closed ? p[((k % M) + M) % M] : p[k];
    for (const dir of [-1, 1]){
      let i = bi, steps = 0;
      while ((tr.closed || (i + dir >= 0 && i + dir < M)) && steps < M && at(i).distanceTo(J.d)*R < 10){ i += dir; steps++; }
      if (i === bi || at(i).distanceTo(J.d)*R < 5) continue;                 // the trail ends here
      const t = at(i).clone().sub(J.d); t.addScaledVector(J.d, -t.dot(J.d)).normalize();
      if (!J.b.some(q => q.angleTo(t) < 8*D2R)) J.b.push(t);
    }
  }
}
const juncs = () => JUNCS || (buildJunctions(), JUNCS);
function nearestJunction(){ if (ONB || UG) return Infinity; let m = Infinity; for (const j of juncs()){ const d = j.d.distanceTo(n)*P.R; if (d < m) m = d; } return m; }
// near a junction, a kick turn that would swing past (or end just short of) one of its trails stops lined up with it.
// returns the turn to use instead, in radians (signed like side), or null to turn as normal
function branchSnap(heading, side, stepDeg){
  if (!(P.bsnap > 0) || ONB || UG) return null;
  let J = null, jd = P.bsnap;
  for (const j of juncs()){ const d = j.d.distanceTo(n)*P.R; if (d < jd){ jd = d; J = j; } }
  if (!J) return null;
  let best = null;
  for (const b3 of J.b){
    let r = (Math.atan2(b3.dot(ex), -b3.dot(ey)) - heading)*side; r = Math.atan2(Math.sin(r), Math.cos(r))/D2R;   // how far round, in the turn's direction
    if (r > 1.5 && r <= stepDeg + 4 && (best === null || r < best)) best = r;
  }
  return best === null ? null : side*best*D2R;
}
// the point m metres along a trail from its segment i (a fraction u along it), one way or the other: [x, y] in your frame
const _wk = new THREE.Vector3();
function walkTrail(tr, i, u, dir, m){
  const p = tr.pts, M = p.length, segN = tr.closed ? M : M - 1, R = P.R; let k = i, f = u, left = m;
  for (let guard = 0; guard < 600; guard++){
    const L = p[k].distanceTo(p[(k + 1) % M])*R || 1e-6, room = dir > 0 ? (1 - f)*L : f*L;
    if (left <= room){ f += dir*left/L; break; }
    left -= room;
    const nk = k + dir;
    if (nk < 0 || nk >= segN){ if (!tr.closed){ f = dir > 0 ? 1 : 0; break; } k = (nk + segN) % segN; } else k = nk;
    f = dir > 0 ? 0 : 1;
  }
  _wk.copy(p[k]).lerp(p[(k + 1) % M], f).sub(n);
  return [_wk.dot(ex)*R, _wk.dot(ey)*R];
}
// the look-ahead bearing on whichever nearby trail (and direction along it) best matches where you're pointed
function trailAssistTarget(heading, ahead, prefer, centring = 1){
  const list = tgrid.get(cellOf(n.x, n.y, n.z)); if (!list) return null;
  const near = new Map(), R = P.R;                       // each trail in reach: its nearest segment
  for (let q = 0; q < list.length; q += 2){
    const tr = trails[list[q]], k = list[q + 1], a = tr.pts[k], b = tr.pts[(k + 1) % tr.pts.length];
    const bx = b.x - a.x, by = b.y - a.y, bz = b.z - a.z, L2 = bx*bx + by*by + bz*bz || 1e-12;
    const u = Math.max(0, Math.min(1, ((n.x - a.x)*bx + (n.y - a.y)*by + (n.z - a.z)*bz)/L2));
    const d = Math.hypot(n.x - a.x - u*bx, n.y - a.y - u*by, n.z - a.z - u*bz)*R, o = near.get(tr);
    if (!o || d < o.d) near.set(tr, { d, k, u });
  }
  const wrap = a => a - Math.round(a/(2*Math.PI))*2*Math.PI, bearing = (ax, ay, bx, by) => Math.atan2(bx - ax, -(by - ay));
  const W = TRAIL_W, capR = P.acap*D2R; let best = null;
  for (const [t, o] of near){
    if (o.d > W*1.5) continue;
    for (const dir of [1, -1]){
      const [cx, cy] = walkTrail(t, o.k, o.u, dir, 0), [nx, ny] = walkTrail(t, o.k, o.u, dir, 1.5);
      if (Math.hypot(nx - cx, ny - cy) < 0.5) continue;                 // at the very end of this trail
      const tanNear = bearing(cx, cy, nx, ny);
      // look ahead, but less far through a bend, so the target stays on the curve you're actually skiing
      let look = ahead, tx, ty, ux, uy;
      for (let k = 0; k < 3; k++){
        [tx, ty] = walkTrail(t, o.k, o.u, dir, look); [ux, uy] = walkTrail(t, o.k, o.u, dir, look + 1);
        const bend = Math.abs(wrap(bearing(tx, ty, ux, uy) - tanNear));
        if (bend <= 0.35) break;
        look = Math.max(3, look*0.35/bend);
      }
      if (Math.hypot(tx, ty) < 1) continue;                             // ran off the end of this trail
      // centring: aim across the centre line, at the mirror of your own offset, so you're drawn back through the middle
      const tl = Math.hypot(nx - cx, ny - cy), nrx = -(ny - cy)/tl, nry = (nx - cx)/tl, lat = -cx*nrx - cy*nry;
      const shift = Math.max(-W/2, Math.min(W/2, -Math.max(-W/2, Math.min(W/2, lat))*P.acenter*centring));
      const off = wrap(bearing(0, 0, tx + nrx*shift, ty + nry*shift) - heading), offRaw = wrap(bearing(0, 0, tx, ty) - heading);
      // how far you are from lined up: against the trail's direction here and the look-ahead bearing, whichever is closer
      const lineup = Math.min(Math.abs(offRaw), Math.abs(wrap(tanNear - heading)));
      const c = { off, lineup, t, d: o.d, w: W };
      // stick with the trail you were already following while it's still within reach
      const ok = x => x <= capR, closer = lineup < (best ? best.lineup : Infinity); let better;
      if (!best) better = true;
      else if (t === prefer && best.t !== prefer) better = ok(lineup) || (!ok(best.lineup) && closer);
      else if (t !== prefer && best.t === prefer) better = !ok(best.lineup) && closer;
      else better = closer;
      if (better) best = c;
    }
  }
  return best;
}
let assistTrail = null, assistPrev = null, assistSince = 0, assistSwitch = false, assistW = 0;
function trailAssist(dt){
  assistW = 0;
  if (P.assist <= 0 || ONB || UG){ assistTrail = null; return; }
  // hands off while you lean and for a moment after, and forget which trail you were on: you're steering yourself
  const now = performance.now();
  if (lean || keyLean || touchLean){ assistQuietUntil = now + 800; assistTrail = null; return; }
  if (now < assistQuietUntil){ assistTrail = null; return; }
  const v = speed(); if (v < 0.5) return;
  const skating = !mode, ref = skating ? S.tgt - camPending : S.tgt;     // the stride's centre line, not the ski you're on
  // centring is eased off near a junction and eased back in after changing trails
  const jd = nearestJunction(), jFade = P.ajunc > 0 ? smooth01(P.ajunc*0.35, P.ajunc, jd) : 1;
  const cRamp = Math.min(1, (now - assistSince)/Math.max(1, P.aswitch));
  const tg = trailAssistTarget(ref, Math.max(4, v*P.alook), assistTrail, jFade*cRamp*cRamp);
  if (!tg){ assistTrail = null; return; }
  const cap = P.acap*D2R, a = tg.lineup;
  if (a > cap){ assistTrail = null; return; }                            // pointed well away: you meant it, let go
  if (assistTrail !== tg.t){ assistSince = now; assistSwitch = !!assistPrev && assistPrev !== tg.t; }
  assistTrail = tg.t; assistPrev = tg.t;
  // it eases in slowly after you steered yourself, over the trail-switch time between trails, quickly after a kick turn
  // at a junction, and otherwise within a few tenths of a second
  const settle = now - junctionTurnAt < 2500;
  const rampMs = settle ? 300 : (assistSince - assistQuietUntil < 1500) ? P.aramp : assistSwitch ? P.aswitch : 300;
  const ramp = Math.min(1, (now - assistSince)/Math.max(1, rampMs));
  const fade = 1 - (a/cap)**2, near = Math.max(0, Math.min(1, (tg.w*1.5 - tg.d)/tg.w));
  const r = Math.max(-cap, Math.min(cap, tg.off))*Math.min(1, P.assist*2.5*fade*ramp*ramp*near*dt);
  assistW = Math.min(1, P.assist*2)*fade*ramp*ramp*near;
  if (skating) camPending -= r;                                          // shift where the next alternating stroke is centred
  else S.tgt += r;                                                       // tuck and plow: turn the heading
}
// <<<< lifted

// >>>> lifted: rumble, and the step
let padIndex = null, buzzAt = 0;
function buzz(leg, mag, ms){
  if (mag <= 0) return;
  const gp = padIndex !== null && navigator.getGamepads ? (() => { try { return navigator.getGamepads()[padIndex]; } catch (e){ return null; } })() : null;
  const act = gp && gp.vibrationActuator; if (!act || !act.playEffect) return;
  const effect = (act.effects && act.effects.includes && act.effects.includes('trigger-rumble')) ? 'trigger-rumble' : 'dual-rumble';
  const m = Math.min(1, mag), params = effect === 'trigger-rumble'
    ? { duration: ms, leftTrigger: leg !== 'R' ? m : 0, rightTrigger: leg !== 'L' ? m : 0 }
    : { duration: ms, strongMagnitude: m*0.5, weakMagnitude: m };
  try { const r = act.playEffect(effect, params); if (r && r.catch) r.catch(() => {}); } catch (e){}
}
// a short buzz on the side that kicked: its level is the snow you're on (groomed 5%, ungroomed 25%), k shapes it
function rumble(leg, k = 1){ const level = (P.rumble + (P.rumble2 - P.rumble)*Math.max(0, Math.min(1, S.off)))/100; buzzAt = performance.now(); buzz(leg, level*k, Math.round(45 + 30*Math.min(1.2, k))); }
// a plain kick from a standstill is the level itself, a loaded stroke 30% more, pushes at speed up to 30% lighter, kick
// turns a little firmer, and never quite the same twice
function kickBuzz(boost){ const fast = Math.min(1, speed()*3.6/Math.max(1, P.max)); return (boost > 1 ? 1.3 : 1)*(1 - 0.3*fast)*(1 + 0.06*Math.min(3, streak - 1))*(0.9 + 0.2*Math.random()); }

function step(dt){
  if (kickTop){
    const f = Math.min(kickTop.left, dt)/0.15; kickTop.left -= dt;
    S.vx += kickTop.dx*kickTop.amt*f; S.vy += kickTop.dy*kickTop.amt*f;
    if (kickTop.left <= 1e-6) kickTop = null;
  }
  // the rest of the kick, pushed out while the key is held
  if (kickDrive){
    if (!held[kickDrive.leg] || mode) kickDrive = null;
    else {
      const frac = Math.min(1 - kickDrive.done, dt / Math.max(0.02, P.klen/1000));
      const amt = kickDrive.base * frac * Math.max(0.08, 1 - speed()/(P.max/3.6));
      S.vx += kickDrive.dx*amt; S.vy += kickDrive.dy*amt; kickDrive.done += frac;
      if (kickDrive.done >= 1 - 1e-6) kickDrive = null;
    }
  }
  // leaning in a tuck carves you round (fading out below about 10 km/h)
  trailAssist(dt);
  const steer = keyLean || lean || touchLean;
  if (mode === 'tuck' && steer) S.tgt += steer * P.lean * D2R * dt * Math.min(1, speed()/3);
  if (mode !== 'tuck'){ lean = 0; tuckDeep = 0; }
  // the heading eases toward the kick's heading on a critically damped spring
  if (P.snap <= 0){ S.th = S.tgt; S.thv = 0; }
  else { const w = 5000/P.snap, h = dt/4; for (let i = 0; i < 4; i++){ S.thv += (w*w*(S.tgt - S.th) - 2*w*S.thv)*h; S.th += S.thv*h; } }

  // the hill: gravity pulls along the skis, by the slope under you (measured in your own frame)
  // (on a bridge, the deck's slope along its line instead of the ground's)
  const [hx, hy] = ONB ? (() => { const a = bridgeAt(), tx = a.t3.dot(ex), ty = a.t3.dot(ey), Lt = Math.hypot(tx, ty) || 1; return [tx/Lt*a.grade, ty/Lt*a.grade]; })() : grad(), [mx, my] = moveDir();
  S.grade = hx*mx + hy*my;
  // how heavy you are: going round a planet this small, part of gravity just keeps you on the curve
  const r = groundR(n);
  S.weight = Math.max(0, 1 - speed()*speed()/(G*r));
  const wK = P.lift ? S.weight : 1;
  const gm = glideMult();
  // groomed or not: ungroomed snow multiplies friction and drag (a held glide works off the trail too, as in the game)
  const tq = nearestTrailAt(n); S.off = offTrail(tq.d); S.trail = tq.t; S.trailNames = tq.names;
  // a lawn glides like a trail (the same half-metre soft edge)
  if (LAWN && S.off > 0){ const lw = LAWN.at(n.x, n.y, n.z), lo = lw >= 0.5 ? 0 : lw <= 0 ? 1 : 1 - lw/0.5; if (lo < S.off){ S.off = lo; if (lo < 0.5){ S.trail = LAWN_T; S.trailNames = null; } } }
  if (ONB){ S.off = 0; S.trail = null; }      // the deck glides like groomed trail
  if (UG){ S.off = 0; S.trail = UG.trail; S.trailNames = null; }      // a cave's floor glides like groomed trail
  // (a held glide's friction cut works off the trail at the share set by offglide: 100 = the same as on it)
  const surf = (1 + (P.off - 1)*S.off) * (gm + (1 - gm)*S.off*(1 - P.offglide/100));

  const ws = weightLeg && lastSki[weightLeg], onSki = ws && ws.live && ws.glide;
  const fx = (onSki && !mode) ? ws.dx : Math.sin(S.th), fy = (onSki && !mode) ? ws.dy : -Math.cos(S.th);
  let fwd = S.vx*fx + S.vy*fy, lat = S.vx*(-fy) + S.vy*fx;
  const plowHold = mode === 'plow' && Math.abs(fwd) < 0.15 && Math.abs(lat) < 0.15;
  if (plowHold){ fwd = 0; lat = 0; }
  else {
    { const gp = G*(hx*fx + hy*fy)*dt; if (!ONB || gp*fwd < 0 || Math.abs(fwd) < 0.05) fwd -= gp; }   // on a bridge a climb costs no speed
    // wind: the air drag of moving through moving air, less the still-air drag the glide already counts (so no wind,
    // no change). a skier's drag area ~0.5 m² upright, ~0.3 tucked, 75 kg: a 10 m/s headwind at speed costs ~1 m/s²
    if (P.windPush){ const wf = WX.vel.dot(ex)*fx + WX.vel.dot(ey)*fy, kd = 0.004*(mode === 'tuck' ? 0.6 : 1), rel = wf - fwd;
      fwd += kd*(Math.abs(rel)*rel + Math.abs(fwd)*fwd)*dt; }
    fwd *= Math.exp(-P.glide * surf * (mode === 'tuck' ? 1 - P.tuck/100 - (1 - P.tuck/100)*0.5*tuckDeep : 1) * dt);
    const dec = (P.fric * surf * wK + (mode === 'plow' ? P.plow : 0)) * dt;
    fwd = Math.abs(fwd) <= dec ? 0 : fwd - Math.sign(fwd)*dec;
  }
  lat = mode === 'tuck' ? 0 : lat * Math.exp(-P.grip*dt);
  S.vx = fx*fwd + (-fy)*lat; S.vy = fy*fwd + fx*lat;

  // too steep to ski: ground just ahead that's steeper than the limit (a cliff edge going down, a cliff face going up)
  // stops you there. only the part of your speed across it is taken away, so you can slide along its edge
  { const v = speed();
    // (only from skiable ground: if you're already on a face that steep, nothing holds you and you slide off it)
    if (v > 0.02 && !TEST.ghost && !ONB && Math.hypot(hx, hy) <= TERRAIN.stop){
      const a = Math.max(0.6, v*dt*1.5), px = S.vx/v*a, py = S.vy/v*a, e = 0.5;
      const gx = (hLocal(px + e, py) - hLocal(px - e, py))/(2*e), gy = (hLocal(px, py + e) - hLocal(px, py - e))/(2*e), g = Math.hypot(gx, gy);
      if (g > TERRAIN.stop){ const nx = gx/g, ny = gy/g, vn = S.vx*nx + S.vy*ny; S.vx -= nx*vn; S.vy -= ny*vn; if (Math.abs(vn) > 0.3) steepT = 1.2; }
    } }
  // move: in the 2D model, and round the planet
  const mvx = S.vx*dt, mvy = S.vy*dt;
  S.x += mvx; S.y += mvy; moveLocal(mvx, mvy);
  frameMove[0] += mvx; frameMove[1] += mvy;
  if (!ONB) collide();
  bridgeStep();
  ugStep();
  S.dist += Math.hypot(mvx, mvy);

  // planted skis: the mark grows along the ski as the body travels; lifted and re-set when the body drifts off it
  for (const k of ['L', 'R']){
    const sk = lastSki[k]; if (!sk || !sk.live) continue;
    const rx = S.x - sk.ax, ry = S.y - sk.ay, along = rx*sk.dx + ry*sk.dy, off = Math.abs(rx*sk.dy - ry*sk.dx);
    if (along > sk.len){ sk.len = along; sk.dirty = true; }
    const bend = mode ? Math.abs(Math.atan2(sk.dx*Math.cos(S.th) + sk.dy*Math.sin(S.th), sk.dx*Math.sin(S.th) - sk.dy*Math.cos(S.th))) : 0;
    const reach = mode ? (mode === 'plow' ? PLOW_STANCE : STANCE) + 0.1 : REACH;
    if (off > reach || along < sk.len - 0.5 || (bend > 2*D2R && sk.len > 0.05)){ sk.live = false; lastSki[k] = setParallel(sk.side); continue; }
    // (planet only) a long run on one ski carries on as a fresh mark every 4 m along the same line, so the marks follow
    // the curve of the ground instead of cutting straight across it. the ski, its glide and its line don't change
    if (sk.len > 4){ const c = newSki(sk.side, headingOf(sk.dx, sk.dy), sk.ax + sk.dx*sk.len, sk.ay + sk.dy*sk.len); c.glide = sk.glide; c.w = sk.w; sk.live = false; lastSki[k] = c; }
  }
  if (mode || speed() < 0.05) for (const k of ['L', 'R']){ if (lastSki[k] && lastSki[k].live) continue; lastSki[k] = setParallel(k === 'L' ? -1 : 1); }
  legFlash.L = Math.max(0, legFlash.L - dt*5); legFlash.R = Math.max(0, legFlash.R - dt*5);
}
// <<<< lifted

// >>>> lifted: ski marks
const markPos = new Float32Array(MARKS*6*3);
const markGeo = new THREE.BufferGeometry(); markGeo.setAttribute('position', new THREE.BufferAttribute(markPos, 3));
const markMesh = new THREE.Mesh(markGeo, flatPatch(new THREE.MeshBasicMaterial({ color: 0x7d93a8, transparent: true, opacity: 0.5, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2, side: THREE.DoubleSide })));
markMesh.frustumCulled = false; scene.add(markMesh);
const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _s = new THREE.Vector3(), _c = new THREE.Vector3();
function updateMarks(){
  let any = false;
  for (const s of skis){
    if (!s.dirty) continue; s.dirty = false; any = true;
    const R = P.R, len = Math.max(0.05, s.len);
    _a.copy(s.p3); _b.copy(s.p3).multiplyScalar(R).addScaledVector(s.t3, len).normalize();
    _s.crossVectors(s.t3, s.p3).normalize().multiplyScalar(s.w/2/R);
    const corner = (base, sign, o) => { _c.copy(base).addScaledVector(_s, sign).normalize(); const rr = s.rFix !== null && s.rFix !== undefined ? s.rFix : groundR(_c) + 0.09; markPos[o] = _c.x*rr; markPos[o+1] = _c.y*rr; markPos[o+2] = _c.z*rr; };
    const o = s.slot*18;
    corner(_a, -1, o); corner(_b, -1, o + 3); corner(_a, 1, o + 6);
    corner(_b, -1, o + 9); corner(_b, 1, o + 12); corner(_a, 1, o + 15);
  }
  if (any) markGeo.attributes.position.needsUpdate = true;
}
function clearMarks(){ markPos.fill(0); markGeo.attributes.position.needsUpdate = true; skis = []; lastSki = { L: null, R: null }; }

const TEST = { ghost: false,     // test hook: ghost turns collisions off; place(dir) puts the skier there
  place(d){ ONB = null; exitLock = null; n.copy(d).normalize(); ex.set(1, 0, 0).addScaledVector(n, -n.x).normalize(); ey.crossVectors(ex, n).normalize(); camR = null; } };

// <<<< lifted

// >>>> lifted: the figure's place and pose call
const fig = new THREE.Group(); scene.add(fig);
const SKIER = env.buildSkier(); fig.add(SKIER.rig);
const shadow = new THREE.Mesh(new THREE.CircleGeometry(0.45, 24), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.16, depthWrite: false }));
shadow.rotation.x = -Math.PI/2; shadow.scale.set(0.8, 1.3, 1); fig.add(shadow);
const youMark = new THREE.Mesh(new THREE.ConeGeometry(1, 2.4, 12), new THREE.MeshBasicMaterial({ color: 0xd2462e })); youMark.geometry.rotateX(Math.PI); youMark.geometry.translate(0, 1.2, 0); scene.add(youMark);
const _m4 = new THREE.Matrix4(), _up = new THREE.Vector3(0, 1, 0), _f = new THREE.Vector3();
const NO_LOAD = { depth: 0, leg: null, both: false };
let rock = 0, rockV = 0, strideV1 = true;     // plain kicks animate as V1 (offset), boosted ones as V2, as in the game
function poseFigure(dt){
  _m4.makeBasis(ex, n, ey);
  fig.quaternion.setFromRotationMatrix(_m4);
  const sr = surfaceR(), h0 = sr - P.R;
  fig.position.copy(n).multiplyScalar(sr);
  // the hips rock over the ski you're gliding on alone, and back to the middle when both are down (as the game)
  const ws = weightLeg && lastSki[weightLeg], other = weightLeg && lastSki[weightLeg === 'L' ? 'R' : 'L'];
  const single = !mode && ws && ws.live && ws.glide && !(other && other.live);
  const target = single ? ws.side*STANCE : 0;
  const w = 9, h = Math.min(0.05, dt)/4; for (let i = 0; i < 4; i++){ rockV += (w*w*(target - rock) - 2*w*rockV)*h; rock += rockV*h; }
  rock = Math.max(-STANCE, Math.min(STANCE, rock));
  const now = performance.now();
  const th = SKIER.pose({ x: S.x, y: S.y, h0, ground: ONB ? () => h0 : (x, y) => hLocal(x - S.x, y - S.y), face: S.th, now, dt, mode, tuckDeep,
    ld: loadState(), tk: (now - lastPushAt)/1000, tka: armPending ? null : (now - armAt)/1000, rock, lastSki, lastLeg, legFlash, v1: strideV1, v1side: false });
  SKIER.rig.position.set(0, 0, 0); SKIER.rig.rotation.y = -th;
  shadow.position.set(Math.cos(th)*rock, 0.04, Math.sin(th)*rock); shadow.rotation.z = -th;
}

// <<<< lifted

// >>>> lifted: the chase camera
let camTh = 0, camVel = 0, focusLat = 0, focusV = 0, camR = null, viewOn = false, viewK = 0;
const frameMove = [0, 0];
const _cp = new THREE.Vector3(), _cl = new THREE.Vector3(), _cd = new THREE.Vector3(), _oq = new THREE.Quaternion(), _cq = new THREE.Quaternion();
const chaseCam = new THREE.PerspectiveCamera(), orbitCam = new THREE.PerspectiveCamera();
function camTarget(){
  const midStride = glideLeg && held[glideLeg];
  if (camPending && !midStride && performance.now() - lastKickAt > CAM_RELEASE_MS) camPending = 0;
  return S.tgt - camPending;
}
function placeCamera(dt){
  const R = P.R;
  // heading: a critically damped spring that filters out the kick-to-kick sway
  const w = 3 / Math.max(0.05, P.cam), h = dt/4;
  for (let i = 0; i < 4; i++){ camVel += (w*w*(camTarget() - camTh) - 2*w*camVel)*h; camTh += camVel*h; }
  const dx = Math.sin(camTh), dy = -Math.cos(camTh), back = P.camd, up = P.camd*0.62, ahead = P.camd*0.55;
  // side-to-side the camera follows slowly, so you see the body weave from ski to ski
  focusLat -= frameMove[0]*(-dy) + frameMove[1]*dx; frameMove[0] = frameMove[1] = 0;
  const ws = 3 / Math.max(0.1, P.sway), hs = dt/4;
  for (let i = 0; i < 4; i++){ focusV += (ws*ws*(0 - focusLat) - 2*ws*focusV)*hs; focusLat += focusV*hs; }
  focusLat = Math.max(-3, Math.min(3, focusLat));
  const fox = -dy*focusLat, foy = dx*focusLat;
  const gr0 = surfaceR(); camR = camR === null ? gr0 : camR + (gr0 - camR)*Math.min(1, dt*4);
  dirLocal(fox - dx*back, foy - dy*back, _cd);
  _cp.copy(_cd).multiplyScalar(Math.max(camR + up, groundR(_cd) + 1.5));
  // underground: the camera stays in the cave, under its ceiling (pulled in closer where the cave behind you is short)
  if (UG){ const base = R - UG.depth; let ok = false;
    for (const f of [1, 0.75, 0.5, 0.3, 0.15]){ dirLocal(fox - dx*back*f, foy - dy*back*f, _cd); const a = UG.CF.at(_cd.x, _cd.y, _cd.z);
      if (a.open && a.ceil - a.floor > 1.6){ _cp.copy(_cd).multiplyScalar(Math.min(base + a.ceil - 0.45, Math.max(base + a.floor + 1.1, camR + up*f))); ok = true; break; } }
    if (!ok) _cp.copy(n).multiplyScalar(camR + 1.5); }
  dirLocal(fox + dx*ahead, foy + dy*ahead, _cl).multiplyScalar(camR + 0.4);
  chaseCam.position.copy(_cp); chaseCam.up.copy(n); chaseCam.lookAt(_cl);
  // planet view: well out above you, looking at the centre with your heading up the screen
  _f.set(0, 0, 0).addScaledVector(ex, dx).addScaledVector(ey, dy);
  orbitCam.position.copy(n).multiplyScalar(0.9).addScaledVector(_f, -0.45).normalize().multiplyScalar(R*3.1);
  orbitCam.up.copy(_f); orbitCam.lookAt(0, 0, 0);
  viewK += ((viewOn ? 1 : 0) - viewK) * Math.min(1, dt*2.5);
  const k = viewK*viewK*(3 - 2*viewK);
  camera.position.lerpVectors(chaseCam.position, orbitCam.position, k);
  _cq.copy(chaseCam.quaternion); _oq.copy(orbitCam.quaternion); camera.quaternion.copy(_cq).slerp(_oq, k);
  camera.far = R*12; camera.updateProjectionMatrix();
  return k;
}

// <<<< lifted

// >>>> lifted: input: keyboard, controller, touch
const kb = { up: false, down: false, space: false, left: false, right: false };
const keyLeg = k => (k === 'a' || k === 'arrowleft') ? 'L' : (k === 'd' || k === 'arrowright') ? 'R' : null;
function updKeyLean(){ keyLean = kb.up ? (kb.right ? 1 : 0) - (kb.left ? 1 : 0) : 0; }
const keyDeep = () => { tuckDeep = mode === 'tuck' && kb.up && kb.space ? 1 : 0; };
addEventListener('keydown', e => {
  if (e.target && e.target.closest && e.target.closest('input,textarea,select')) return;
  const k = e.key.toLowerCase(), leg = keyLeg(k);
  if (k === ' '){ e.preventDefault(); kb.space = true; keyDeep(); return; }
  if (k === 'arrowup' || k === 'w'){ e.preventDefault(); if (e.repeat) return; kb.up = true; setTuck(true, 'key'); updKeyLean(); keyDeep(); return; }
  if (k === 'arrowdown' || k === 's'){ e.preventDefault(); if (e.repeat) return; kb.down = true; setPlow(true, 'key'); tuckDeep = 0; return; }
  if (leg){
    e.preventDefault(); if (leg === 'L') kb.left = true; else kb.right = true;
    if (kb.up){ updKeyLean(); return; }                    // tucking: lean, don't kick
    if (e.repeat) return;                                  // holding doesn't kick again; you have to press
    press(leg, kb.space ? P.lboost : 1, 'key');            // Space held: a loaded stroke, like a swipe on a phone
    return;
  }
  if ((k === 'enter' || k === 'e') && !e.repeat){ if (gameConfirm()) e.preventDefault(); return; }
  if (k === 'v' && !e.repeat) toggleView();
  if (k === 'h' && !e.repeat) toggleDev();
  if (k === 'r' && !e.repeat) resetSkier();
  if (k === 'p' && !e.repeat) toggleSize();
});
addEventListener('keyup', e => {
  const k = e.key.toLowerCase(), leg = keyLeg(k);
  if (leg){ if (leg === 'L') kb.left = false; else kb.right = false; release(leg); updKeyLean(); return; }
  if (k === ' '){ kb.space = false; keyDeep(); return; }
  if (k === 'arrowup' || k === 'w'){ kb.up = false; setTuck(false, 'key'); updKeyLean(); tuckDeep = 0; return; }
  if (k === 'arrowdown' || k === 's'){ kb.down = false; setPlow(false, 'key'); keyDeep(); }      // back in the tuck if ↑ is still down
});
addEventListener('blur', () => { held.L = held.R = false; kb.up = kb.down = kb.space = kb.left = kb.right = false; keyLean = 0; tuckDeep = 0; hold.tuck.clear(); hold.plow.clear(); syncMode(); });

// ---- the controller (standard mapping). pulling a trigger past halfway kicks; keep it pulled to hold the glide.
// each stick is one leg. load: pull the stick down and in to sink onto that ski. throw: drive it up and out to push
// off and send your weight onto the other ski. a flick straight out from rest is exactly a trigger press
const PAD_ON = 0.5, PAD_OFF = 0.3, padDown = { L: false, R: false }, padBtn = {}, padTuck = { on: false };
const twin = { L: { phase: 'idle', load: null, x: 0, y: 0, armed: false, loadT: 0, restSince: 0 }, R: { phase: 'idle', load: null, x: 0, y: 0, armed: false, loadT: 0, restSince: 0 } };
const pushLeg = stickLeg => stickLeg === 'L' ? 'R' : 'L';     // a stick's throw steps that foot's ski out, so the push comes off the other leg
addEventListener('gamepadconnected', e => { padIndex = e.gamepad.index; });
addEventListener('gamepaddisconnected', e => { if (e.gamepad.index === padIndex){ padIndex = null; release('L'); release('R'); padDown.L = padDown.R = false; } });
// loading: while a stick is pulled into its load the skier sinks and moves their weight onto the leg about to push
function loadState(){ for (const k of ['L', 'R']){ const t = twin[k]; if (t.phase === 'loading') return { depth: Math.min(1, Math.hypot(t.x, t.y)), leg: pushLeg(k), both: false }; } return NO_LOAD; }
// a stroke is a kick, exactly as if you'd pulled the trigger for that leg; thrown from a load it has the loaded boost
function strokeThrow(leg, t, loaded){ t.phase = 'thrown'; t.armed = false; press(pushLeg(leg), loaded ? P.lboost : 1, null, loaded ? t.loadT : undefined); }
function pollPad(){
  let pads; try { pads = navigator.getGamepads ? navigator.getGamepads() : []; } catch (err){ return; }
  let gp = padIndex !== null ? pads[padIndex] : null;
  if (!gp) for (const p of pads) if (p && p.connected !== false){ gp = p; padIndex = p.index; break; }
  if (!gp){ if (padTuck.on){ padTuck.on = false; setPlow(false, 'twin'); setTuck(false, 'pad'); } return; }
  const trig = i => { const b = gp.buttons[i]; return b ? (typeof b === 'object' ? (b.value || (b.pressed ? 1 : 0)) : b) : 0; };
  const edge = (i, fn) => { const on = trig(i) > 0.5; if (on && !padBtn[i]) fn(); padBtn[i] = on; };
  edge(0, gameConfirm);            // A: agree to what's offered
  edge(3, toggleView);             // Y: planet view
  const ax = gp.axes || [], sticks = { L: [ax[0] || 0, ax[1] || 0], R: [ax[2] || 0, ax[3] || 0] };
  const [lx, ly] = sticks.L, [rx, ry] = sticks.R, dz = v => Math.abs(v) < 0.15 ? 0 : v;
  const setPhase = p => { for (const k of ['L', 'R']){ twin[k].phase = p; twin[k].load = null; twin[k].armed = false; } };
  lean = 0;
  // ---- LB or RB held: tuck, the same as both thumbs down on a phone. while it's held the sticks shape it: pull them
  // both back for a snow plow (push forward again to tuck), push them forward for a deeper tuck, tilt them left or
  // right to lean. no kicks while it's held: let go to skate again
  const bump = trig(4) > 0.5 || trig(5) > 0.5, avgY = (ly + ry)/2;
  if (bump){
    if (!padTuck.on){ padTuck.on = true; setTuck(true, 'pad'); setPhase('idle'); }
    for (const leg of ['L', 'R']){ twin[leg].x = sticks[leg][0]; twin[leg].y = sticks[leg][1]; }
    if (mode === 'tuck' && avgY > 0.55){ setPlow(true, 'twin'); tuckDeep = 0; }
    else if (mode === 'plow' && hold.plow.has('twin') && avgY < 0.25) setPlow(false, 'twin');
    if (mode === 'tuck'){ tuckDeep = Math.max(0, Math.min(1, (-avgY - 0.2)/0.7)); lean = Math.max(-1, Math.min(1, dz((lx + rx)/2)/0.6)); }
    for (const leg of ['L', 'R']) if (padDown[leg] && trig(leg === 'L' ? 6 : 7) <= PAD_OFF){ padDown[leg] = false; release(leg); }
    return;
  }
  if (padTuck.on){ padTuck.on = false; setPlow(false, 'twin'); setTuck(false, 'pad'); tuckDeep = 0; setPhase('idle'); }
  // ---- triggers kick (LT left leg, RT right leg; hold to push the kick all the way out and ride the glide)
  for (const [leg, i] of [['L', 6], ['R', 7]]){
    const v = trig(i);
    if (!padDown[leg] && v >= PAD_ON){ padDown[leg] = true; press(leg, 1, 'trigger'); }
    else if (padDown[leg] && v <= PAD_OFF){ padDown[leg] = false; release(leg); }
  }
  // ---- sticks stroke
  for (const leg of ['L', 'R']){
    const t = twin[leg], [x, y] = sticks[leg], inSign = leg === 'L' ? 1 : -1, mag = Math.hypot(x, y);      // inward is toward the other leg
    t.x = x; t.y = y;
    const inLoad = mag > 0.5 && y > 0.25 && x*inSign > -0.25;          // down, and not outward
    if (inLoad && t.phase !== 'loading'){
      if (t.phase === 'thrown') release(pushLeg(leg));
      t.phase = 'loading'; t.load = [x, y]; t.loadT = performance.now(); t.restSince = 0;
      if (performance.now() - buzzAt > 120) buzz(leg, P.rumbleL/100, 50);   // one short buzz on that side as the load starts
    }
    if (t.phase === 'loading'){
      if (inLoad && mag > Math.hypot(t.load[0], t.load[1])) t.load = [x, y];   // deepest point of the load
      // throw: judged by the stroke itself, not by where the stick ends up. it has to travel far enough from the load
      // point, out toward the rim, and leave the load zone, so a flat, sideways stroke counts too
      if (!inLoad && mag > 0.55 && Math.hypot(x - t.load[0], y - t.load[1]) >= P.tmin){ strokeThrow(leg, t, true); strideV1 = false; }
      else if (mag < 0.25){
        // the stroke passes through the centre on its way, so only give up on the load if the stick rests there
        t.restSince = t.restSince || performance.now();
        if (performance.now() - t.restSince > P.rest){ t.phase = 'idle'; t.load = null; t.restSince = 0; }
      } else t.restSince = 0;
    } else if (t.phase === 'thrown' && (mag < 0.3 || y > 0)){ t.phase = 'idle'; release(pushLeg(leg)); }
    if (t.phase === 'idle'){
      // a flick without a load, from rest straight out to the edge of the stick's range (and not while both sticks are up)
      if (mag < 0.3) t.armed = true;
      else if (t.armed && !inLoad && mag >= P.fedge && !(y < -0.3 && sticks[pushLeg(leg)][1] < -0.4)) strokeThrow(leg, t, false);
    }
  }
}

// ---- touch pads: the kick goes through the moment your finger touches down. if the finger then swipes up the pad,
// the same kick is upgraded to a loaded stroke: the extra push is added over the next 150 ms (and the rest of the held
// push grows to match). a swipe counts once it has travelled the swipe distance, or on lifting if it got at least
// halfway, as long as that's within 400 ms.
// both thumbs down together (the second within 150 ms of the first) is a two-pad gesture instead, and the first
// thumb's kick is taken back: both thumbs down is a tuck straight away, pulling both back (down the screen) turns it
// into a snow plow and pushing forward again back into the tuck, and spreading or closing them sideways moves the
// camera like a pinch. the plow and tuck last until a thumb lifts
const padTouch = { L: null, R: null }, DUAL_MS = 150;
let dual = null;
// everything a kick changes, so a kick that turns out to be half of a two-pad gesture can be undone
function snapKick(){
  return { vx: S.vx, vy: S.vy, tgt: S.tgt, camPending, streak, sideRun, kickPrevT, streakKmh, streakTrig, snapSkip, runTurn, turnRestart, lastTurnDeg, kickDrive, kickTop,
    lastSki: { ...lastSki }, ski: ['L', 'R'].map(k => lastSki[k] && { live: lastSki[k].live, len: lastSki[k].len }), tail: skis[skis.length - 1],
    weightLeg, lastLeg, lastKickAt, lastPushAt, glideLeg, glideStart, held: { ...held }, strideV1, mode, armAt, armPending, junctionTurnAt, assistQuietUntil, legFlash: { ...legFlash } };
}
function undoKick(q){
  ({ camPending, streak, sideRun, kickPrevT, streakKmh, streakTrig, snapSkip, runTurn, turnRestart, lastTurnDeg, kickDrive, kickTop, weightLeg, lastLeg, lastKickAt, lastPushAt,
     glideLeg, glideStart, strideV1, mode, armAt, armPending, junctionTurnAt, assistQuietUntil } = q);
  S.vx = q.vx; S.vy = q.vy; S.tgt = q.tgt;
  for (let i = skis.indexOf(q.tail) + 1; i < skis.length; i++){ skis[i].len = 0; skis[i].live = false; skis[i].dirty = true; }   // the new prints vanish
  lastSki = { ...q.lastSki }; ['L', 'R'].forEach((k, i) => { if (lastSki[k] && q.ski[i]){ lastSki[k].live = q.ski[i].live; lastSki[k].len = q.ski[i].len; lastSki[k].dirty = true; } });
  Object.assign(held, q.held); Object.assign(legFlash, q.legFlash);
}
function dualMove(){
  const { a, b } = dual, ua = a.y0 - a.y, ub = b.y0 - b.y, T = 18, span = Math.abs(a.x - b.x), mid = (a.x + b.x)/2;
  // thumbs moving apart or together (not both the same way) is a pinch: it takes over from the tuck
  if (dual.act === 'tuck' && !dual.leaned && Math.abs(span - dual.s0) > 40 && Math.abs(mid - dual.lx) < 15 && Math.abs(ua) < T*1.5 && Math.abs(ub) < T*1.5){
    setTuck(false, 'dual'); touchLean = 0; tuckDeep = 0; dual.act = 'pinch'; dual.s0 = span; dual.c0 = P.camd;
  }
  // pulling both thumbs back switches a tuck to a plow, and pushing them forward again switches back, without lifting.
  // a tuck turns into a plow only once both thumbs are well behind where the tuck began (72 px; 24 px in the first
  // 400 ms, before any lean). a plow turns back into a tuck after 18 px forward from wherever the thumbs got to
  if (dual.act === 'plow' || dual.act === 'tuck'){
    if (dual.act === 'tuck'){
      const early = !dual.leaned && performance.now() - dual.t0 < 400, TS = early ? 24 : 72;
      if (a.y - dual.ay > TS && b.y - dual.by > TS){ dual.act = 'plow'; setPlow(true, 'dual'); setTuck(false, 'dual'); touchLean = 0; tuckDeep = 0; dual.ea = -ua; dual.eb = -ub; }
    } else {
      const pa = -ua, pb = -ub;                                           // how far back the thumbs are
      dual.ea = Math.max(dual.ea ?? pa, pa); dual.eb = Math.max(dual.eb ?? pb, pb);
      if (dual.ea - pa > T && dual.eb - pb > T){ dual.act = 'tuck'; setTuck(true, 'dual'); setPlow(false, 'dual'); dual.lx = mid; dual.fy = (a.y + b.y)/2; dual.ay = a.y; dual.by = b.y; }
    }
    // while tucking, sliding both thumbs left or right leans that way (full lean at 60 px from where the tuck began),
    // and pushing them further forward is a deeper tuck (full at 120 px)
    if (dual.act === 'tuck'){ const d = mid - dual.lx; touchLean = Math.abs(d) < 6 ? 0 : Math.max(-1, Math.min(1, d/60)); if (Math.abs(d) > 15) dual.leaned = true;
      tuckDeep = Math.max(0, Math.min(1, (dual.fy - (a.y + b.y)/2 - 10)/110)); }
    return;
  }
  if (dual.act === 'pinch'){
    const el = env.camdInput, lo = +el.min, hi = +el.max, st = +el.step || 0.5;
    const v = Math.max(lo, Math.min(hi, Math.round(dual.c0*Math.max(40, dual.s0)/Math.max(40, span)/st)*st));
    if (+el.value !== v){ el.value = v; el.dispatchEvent(new Event('input')); }
  }
}
function dualEnd(){ if (!dual) return; setPlow(false, 'dual'); setTuck(false, 'dual'); dual = null; touchLean = 0; tuckDeep = 0; }
function padSettle(t){ if (t.timer){ clearTimeout(t.timer); t.timer = null; } if (t.state !== 'done'){ t.state = 'done'; if (t.kicked){ armPending = false; armAt = performance.now(); } } }
function padLoaded(leg, t){
  const ok = t.state !== 'done' && t.kicked && t.push && performance.now() - t.t0 < 400;
  padSettle(t);
  if (!ok || P.lboost <= 1) return;
  kickTop = { dx: t.push.dx, dy: t.push.dy, amt: t.push.amt*(P.lboost - 1), left: 0.15 };
  if (kickDrive && kickDrive.leg === leg) kickDrive.base *= P.lboost;
  strideV1 = false; rumble(leg, kickBuzz(P.lboost));
}
for (const [id, leg] of [['padL', 'L'], ['padR', 'R']]){
  const el = $(id), other = leg === 'L' ? 'R' : 'L';
  el.addEventListener('pointerdown', e => {
    e.preventDefault(); try { el.setPointerCapture(e.pointerId); } catch (_){} el.classList.add('on');
    const old = padTouch[leg]; if (old){ padSettle(old); if (old.dual) dualEnd(); }
    const now = performance.now();
    const t = padTouch[leg] = { id: e.pointerId, x0: e.clientX, y0: e.clientY, x: e.clientX, y: e.clientY, state: 'wait', timer: null, t0: now };
    const o = padTouch[other];
    if (o && !o.dual && !dual && now - o.t0 < DUAL_MS && Math.hypot(o.x - o.x0, o.y - o.y0) < 20){
      // the second thumb: a two-pad gesture. take back the first thumb's kick
      if (o.timer){ clearTimeout(o.timer); o.timer = null; }
      if (o.kicked && o.snap){ undoKick(o.snap); kickTop = null; }
      o.state = t.state = 'done'; o.kicked = false; o.dual = t.dual = true; armPending = false;
      $(other === 'L' ? 'padL' : 'padR').classList.remove('pull');
      dual = { a: o, b: t, act: 'tuck', s0: Math.abs(t.x - o.x), c0: P.camd, lx: (t.x + o.x)/2, fy: (t.y + o.y)/2, ay: o.y, by: t.y, t0: now, leaned: false };
      setTuck(true, 'dual');                    // both thumbs down: tuck straight away
      return;
    }
    t.snap = snapKick();
    const before = lastKickAt; lastPush = null; press(leg, 1, 'touch');
    t.kicked = lastKickAt !== before; t.push = lastPush;
    if (t.kicked) armPending = true;
    if (P.swait > 0) t.timer = setTimeout(() => padSettle(t), P.swait); else padSettle(t);
  });
  el.addEventListener('pointermove', e => {
    const t = padTouch[leg]; if (!t || t.id !== e.pointerId) return;
    t.x = e.clientX; t.y = e.clientY;
    if (t.dual){ if (dual) dualMove(); return; }
    const dx = e.clientX - t.x0, up = t.y0 - e.clientY;
    if (t.state === 'wait'){
      if (up > 8 && up > Math.abs(dx)*0.6){ clearTimeout(t.timer); t.timer = setTimeout(() => padSettle(t), 400); t.state = 'swipe'; el.classList.add('pull'); }
      else if (Math.hypot(dx, up) > 12) padSettle(t);        // a slide that isn't upward: just the kick
    }
    if (t.state === 'swipe' && up >= P.sthrow){ el.classList.remove('pull'); padLoaded(leg, t); }
  });
  for (const ev of ['pointerup', 'pointercancel']) el.addEventListener(ev, e => {
    const t = padTouch[leg];
    if (t && t.id === e.pointerId){
      if (t.dual) dualEnd();
      else if (t.state === 'swipe'){ if (ev === 'pointerup' && t.y0 - e.clientY >= P.sthrow/2) padLoaded(leg, t); else padSettle(t); }   // a short flick up still counts
      else padSettle(t);
      padTouch[leg] = null;
    }
    el.classList.remove('on', 'pull'); release(leg);
  });
}
document.addEventListener('contextmenu', e => e.preventDefault());
document.addEventListener('dblclick', e => e.preventDefault());

// <<<< lifted

function faceTrail(){
  let best = null, bd = 8/P.R;
  for (const tr of trails){ const p = tr.pts; for (let k = 0; k < p.length; k++){ const a = p[k].angleTo(n); if (a < bd){ bd = a; best = [tr, k]; } } }
  if (!best) return;
  const [tr, k] = best, p = tr.pts, M = p.length;
  const a = tr.closed ? p[(k + 1) % M] : p[Math.min(M - 1, k + 1)], b = tr.closed ? p[(k - 1 + M) % M] : p[Math.max(0, k - 1)];
  const t = a.clone().sub(b).normalize();
  S.th = S.tgt = camTh = Math.atan2(t.dot(ex), -t.dot(ey)); S.thv = 0; camVel = 0;
}
function resetSkier(){
  placeAtStart(); Object.assign(S, { x: 0, y: 0, vx: 0, vy: 0, th: 0, thv: 0, tgt: 0, dist: 0 });
  camTh = camVel = camPending = focusLat = focusV = 0; camR = null; mode = null; weightLeg = null; lastLeg = null; kickDrive = null;
  clearMarks(); faceTrail();
}
// (v3, not from the game) the Ascent winds round the crystal for a kilometre, and the game's trail assist stands down on
// a bridge. this is the same nudge, taken from the bridge's own line: it turns the stride's centre line toward the deck's
// direction, in the way you are already going, and lets go if you point well away from it
function bridgeAssist(dt){
  if (!ONB || P.assist <= 0 || lean || keyLean || touchLean || performance.now() < assistQuietUntil) return;
  const a = bridgeAt(), wrap = x => x - Math.round(x/(2*Math.PI))*2*Math.PI, skating = !mode, ref = skating ? S.tgt - camPending : S.tgt;
  let tb = Math.atan2(a.t3.dot(ex), -a.t3.dot(ey)); if (Math.cos(tb - ref) < 0) tb += Math.PI;
  const off = wrap(tb - ref), cap = 40*D2R; if (Math.abs(off) > cap) return;
  const r = off*Math.min(1, 3.2*dt);
  if (skating) camPending -= r; else S.tgt += r;
}
resetSkier();
return { bridgeAssist, S, P, n, ex, ey, TEST, fig, SKIER, step, poseFigure, placeCamera, pollPad, updateMarks, reset: resetSkier, speed, press, release, setTuck, setPlow,
  bridges: bridgesG, surfaceR, heading: () => camTh,
  get mode(){ return mode; }, get onBridge(){ return ONB; }, get steep(){ return steepT; }, set steep(v){ steepT = v; }, get view(){ return viewOn; }, toggleView,
  get assist(){ return assistW; }, get trailName(){ return S.trailNames && S.trailNames.length ? S.trailNames.join(' / ') : (S.trail ? S.trail.name : null); } };
}
