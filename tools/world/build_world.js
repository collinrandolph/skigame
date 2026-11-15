// Merges the surface build (additions.json) into the reference planet, digs the underground with the planet's own
// tools (two layers, a spiral ramp down the deep pit, tunnels and chambers), writes the layout, and checks it by
// building the terrain exactly as the game does.
//   node build_world.js <reference.json> <work dir> <out.json>
globalThis.window = globalThis;
const path = require('path'), fs = require('fs');
require(path.join(__dirname, '../../prototypes/planet-terrain.js'));
const PT = globalThis.PlanetTerrain, [REF, WORK, OUT] = process.argv.slice(2);
const o = JSON.parse(fs.readFileSync(REF, 'utf8')), A = JSON.parse(fs.readFileSync(path.join(WORK, 'additions.json'), 'utf8')), R = o.radius;
const norm = v => { const l = Math.hypot(...v); return v.map(x => x/l); }, dot = (a, b) => a[0]*b[0] + a[1]*b[1] + a[2]*b[2], cross = (a, b) => [a[1]*b[2] - a[2]*b[1], a[2]*b[0] - a[0]*b[2], a[0]*b[1] - a[1]*b[0]];
const ang = (a, b) => Math.acos(Math.max(-1, Math.min(1, dot(a, b)))), r6 = p => p.map(v => Math.round(v*1e6)/1e6);
const ll = d => [Math.atan2(-d[2], d[0])*180/Math.PI, Math.asin(d[1])*180/Math.PI].map(v => Math.round(v*10)/10);
// a step of `m` metres from p along the unit tangent t, on a shell of radius Rk; returns the new point and tangent
const step = (p, t, m, Rk) => { const a = m/Rk, q = norm(p.map((v, i) => v*Math.cos(a) + t[i]*Math.sin(a))), t2 = norm(t.map((v, i) => v*Math.cos(a) - p[i]*Math.sin(a))); return [q, t2]; };
const turn = (p, t, deg) => { const a = deg*Math.PI/180, s = cross(p, t); return norm(t.map((v, i) => v*Math.cos(a) + s[i]*Math.sin(a))); };
// a tunnel's centre line: from p heading t, a list of [metres, degrees to turn after]
const walk = (p, t, legs, Rk, every = 12) => { const pts = [p]; for (const [m, deg] of legs){ const n = Math.max(1, Math.round(m/every)); for (let i = 0; i < n; i++){ [p, t] = step(p, t, m/n, Rk); t = turn(p, t, deg/n); pts.push(p); } } return { pts, p, t }; };

o.name = 'Skate Ski v2 world';
o.trails = o.trails.concat(A.trails);
o.landmarks = A.landmarks; o.models = A.models; o.start = A.start;
o.bridges = A.bridges.map(b => ({ name: b.name, pts: b.pts, clearance: b.clearance, ramp: b.ramp, width: b.width, maxGrade: b.maxGrade, kind: b.kind }));
o.scatter = Object.assign({}, o.scatter, { buildings: 0 });      // every building is placed on purpose now
o.game = A.game;

// ---------------- the underground ----------------
const report = { warnings: A.report.warnings.slice(), surface: A.report };
const warn = s => { report.warnings.push(s); console.log('  !!', s); };
if (A.mine){
  const DEPTH = [90, 170], GRADE = 0.12, pit = norm(o.stamps[0].pts[0]);
  o.layers = [{ name: 'The mine', depth: DEPTH[0] }, { name: 'The deep', depth: DEPTH[1] }];
  const top = Math.round((A.mine.h - 0.5)*10)/10;
  o.ramps = [{ name: 'Mine spiral', c: r6(pit), turn: 1, start: A.mine.deg, top, width: 7, maxGrade: 0.16, rMax: A.mine.r + 8, segs: [
    { k: 'slope', len: Math.round((top + DEPTH[0])/GRADE), grade: GRADE }, { k: 'plateau', len: 36, wide: 14, link: 0, lead: 'layer', door: { at: 18 } },
    { k: 'slope', len: Math.round((DEPTH[1] - DEPTH[0])/GRADE), grade: GRADE }, { k: 'plateau', len: 36, wide: 14, link: 1, lead: 'layer', door: { at: 18 } }] }];
  o.tunnels = []; o.caveStamps = [];
  const L0 = PT.parse(o), T0 = PT.terrain(L0, R), B = T0.ramps[0];
  for (const sg of B.segs) if (sg.warn) warn('ramp: ' + sg.k + ' ' + sg.warn);
  if (B.off) warn('ramp: ' + B.off + ' points where the pit wall could not be followed');
  const doors = B.doors.map(d => ({ d: d.d, mouth: d.mouth, out: d.out, link: d.link, end: norm(d.mouth.map((v, i) => v + d.out[i]*14/R)) }));
  report.ramp = { length: Math.round(B.L), top, segs: B.segs.map(s => ({ k: s.k, len: s.len, grade: Math.round((s.eff || 0)*1000)/10, from: Math.round(s.h0), to: Math.round(s.h1), gap: isFinite(s.gap) ? Math.round(s.gap) : null })),
    doors: doors.map(d => ({ layer: d.link, at: ll(d.d), fromPitCentre: Math.round(ang(d.d, pit)*R) })), startsAt: ll(B.pts[0]), fromMineHead: Math.round(ang(B.pts[0], norm(A.mine.d))*R) };
  const tang = (p, out) => norm(out.map((v, i) => v - p[i]*dot(out, p)));
  const chamber = (layer, d, radius, height) => o.caveStamps.push({ type: 'chamber', layer, d: r6(d), radius, height });
  // pillars on a ring round c, at these angles from the way you came in (0 = straight ahead, 180 = the way back)
  const pillars = (layer, c, t, ringR, angles, r, Rk) => { for (const a of angles){ const [q] = step(c, turn(c, t, a), ringR, Rk); o.caveStamps.push({ type: 'pillar', layer, d: r6(q), radius: r, height: 0 }); } };
  const tunnel = (name, layer, pts, width, height, h0 = 0, h1 = 0) => o.tunnels.push({ name, layer, pts: pts.map(r6), width, height, h0, h1 });
  const UG = {};
  { // layer 0, the mine: a gallery in to the teleporter hall, the old workings on to the crystal altar's cave, a drift to the ore bay and round
    const k = 0, Rk = R - DEPTH[k], d = doors.find(x => x.link === k), t = tang(d.end, d.out);
    const g = walk(d.end, t, [[36, 10], [40, -10]], Rk); tunnel('Main gallery', k, g.pts, 9, 7);
    const [hall, th] = step(g.p, g.t, 26, Rk); chamber(k, hall, 32, 17); pillars(k, hall, th, 21, [31, 121, 235, 325], 2.6, Rk);
    const w = walk(step(hall, turn(hall, th, 62), 26, Rk)[0], turn(hall, th, 62), [[40, -22], [46, 30], [36, -12]], Rk); tunnel('Old workings', k, [hall].concat(w.pts), 8, 7, 0, 0);
    const [cave, tc] = step(w.p, w.t, 30, Rk); chamber(k, cave, 40, 24); pillars(k, cave, tc, 27, [0, 72, 144, 216, 288], 3.2, Rk);
    const dr = walk(step(hall, turn(hall, th, -70), 26, Rk)[0], turn(hall, th, -70), [[44, 24], [40, 26]], Rk); tunnel('Lower drift', k, [hall].concat(dr.pts), 7, 6);
    const [bay, tb] = step(dr.p, dr.t, 16, Rk); chamber(k, bay, 20, 11);
    const bk = walk(step(bay, turn(bay, tb, 96), 16, Rk)[0], turn(bay, tb, 96), [[44, 30], [40, 34]], Rk);
    tunnel('Back drift', k, [bay].concat(bk.pts, [g.pts[Math.floor(g.pts.length/2)]]), 6, 5.5);
    UG.rampStart = r6(B.pts[0]); UG.mineDoor = { layer: 0, d: r6(d.d) }; UG.teleporter = { layer: 0, d: r6(hall), name: 'Teleporter hall' }; UG.crystalAltar = { layer: 0, d: r6(cave), name: 'Altar cave' }; UG.oreBay = { layer: 0, d: r6(bay) };
  }
  { // layer 1, the deep: behind the crown door, one long passage winding to the crown room
    const k = 1, Rk = R - DEPTH[k], d = doors.find(x => x.link === k), t = tang(d.end, d.out);
    const g = walk(d.end, t, [[44, -26], [52, 40], [48, -22]], Rk); tunnel('Crown passage', k, g.pts, 9, 8);
    const [room, tr] = step(g.p, g.t, 34, Rk); chamber(k, room, 46, 28); pillars(k, room, tr, 30, [30, 90, 150, 210, 270, 330], 3.4, Rk);
    UG.crownDoor = { layer: 1, d: r6(d.d), opens: 'crowned at the Broken Circle' }; UG.crownRoom = { layer: 1, d: r6(room), name: 'Crown room' };
    // the 30 crown crystals: two rings round the room, clear of the pillars (at 30 m)
    const cc = []; for (let i = 0; i < 12; i++) cc.push(r6(step(room, turn(room, tr, 15 + 30*i), 17, Rk)[0])); for (let i = 0; i < 18; i++) cc.push(r6(step(room, turn(room, tr, 10 + 20*i), 39, Rk)[0]));
    UG.crownCrystals = { layer: 1, d: cc };
  }
  o.game.underground = Object.assign({ layers: o.layers.map((l, i) => ({ index: i, name: l.name, depth: l.depth })), ramp: 'Mine spiral' }, UG);
}

// ---------------- write, then check it as the game would build it ----------------
fs.writeFileSync(OUT, JSON.stringify(o));
const L = PT.parse(fs.readFileSync(OUT, 'utf8')), t0 = Date.now(), T = PT.terrain(L, R), STOP = T.stop;
const H = p => T.height(p[0], p[1], p[2]);
const slopeAt = p => { const a = Math.abs(p[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0], e = norm(cross(a, p)), n = cross(p, e), q = (v, m) => norm(p.map((x, i) => x + v[i]*m/R)); return Math.hypot((H(q(e, 1.5)) - H(q(e, -1.5)))/3, (H(q(n, 1.5)) - H(q(n, -1.5)))/3); };
report.trails = []; let total = 0, steepTotal = 0;
T.trails.forEach((t, i) => {
  if (t.build) return;
  const line = T.net.lines[i], M = line.length, hs = line.map(H); let len = 0, steep = 0, worst = 0, gmax = 0;
  for (let k = 0; k < M; k++){ if (k) len += ang(line[k], line[k - 1])*R; const s = slopeAt(line[k]); if (s > STOP) steep++; worst = Math.max(worst, s); if (k >= 5) gmax = Math.max(gmax, Math.abs(hs[k] - hs[k - 5])/10); }
  if (t.closed) len += ang(line[0], line[M - 1])*R;
  total += len; steepTotal += steep;
  report.trails.push({ name: t.name, isNew: i >= o.trails.length - A.trails.length, closed: !!t.closed, metres: Math.round(len), maxGrade: Math.round(gmax*100), steepPoints: steep, worstSlope: Math.round(worst*100) });
});
report.trailMetres = Math.round(total);
report.bridges = L.bridges.map(b => { const D = PT.bridgeDeck(b, T.height, R); return { name: b.name, kind: b.kind, metres: Math.round(D.L), climb: Math.round(D.climb*100), descent: Math.round(D.desc*100), highest: Math.round(D.highest), ends: [Math.round(D.g[0]), Math.round(D.g[D.g.length - 1])] }; });
report.caves = [];
(L.layers || []).forEach((ly, k) => {
  const F = PT.caveField(L, k, R, T.under, T.ramps), Rk = R - ly.depth; let shut = 0, n = 0, low = Infinity, sky = 0, pitHit = 0;
  for (const t of L.tunnels.filter(t => t.layer === k)) for (const p of PT.evenCurve(t.pts, false, 2, Rk)){ const a = F.at(p[0], p[1], p[2]); n++; if (!a.open) shut++; else low = Math.min(low, a.ceil - a.floor); if (a.sky) sky++; if (a.voidPit) pitHit++; }
  const rooms = L.caveStamps.filter(c => c.layer === k && c.type === 'chamber').map(c => { const a = F.at(c.d[0], c.d[1], c.d[2]); return { radius: c.radius, open: a.open, headroom: Math.round(a.ceil - a.floor), rockAbove: Math.round(H(c.d) + ly.depth - a.ceil) }; });
  const doorOpen = T.ramps.flatMap(B => B.doors.filter(d => d.link === k)).map(d => { const e = norm(d.mouth.map((v, i) => v + d.out[i]*10/R)); return F.at(e[0], e[1], e[2]).open; });
  report.caves.push({ layer: ly.name, depth: ly.depth, tunnelMetres: n*2, closedPoints: shut, lowestHeadroom: Math.round(low*10)/10, skylightPoints: sky, intoThePit: pitHit, rooms, doorsOpen: doorOpen });
});
if (o.game.underground && o.game.underground.crownCrystals){ const cc = o.game.underground.crownCrystals, F = PT.caveField(L, cc.layer, R, T.under, T.ramps); report.crownCrystalsOpen = cc.d.filter(p => { const a = F.at(p[0], p[1], p[2]); return a.open && a.ceil - a.floor > 3; }).length + ' of ' + cc.d.length; console.log('crown crystals standing in open cave:', report.crownCrystalsOpen); }
{ const b = L.bridges.find(x => x.name === 'Starway'); if (b){ const D = PT.bridgeDeck(b, T.height, R); let lo = Infinity; for (let i = 0; i < D.g.length; i++) if (D.s[i] > 30 && D.L - D.s[i] > 30) lo = Math.min(lo, D.h[i] - D.g[i]); console.log('starway: ' + Math.round(D.L) + ' m, climbs at most ' + Math.round(D.climb*100) + '%, drops at most ' + Math.round(D.desc*100) + '%, never less than ' + lo.toFixed(1) + ' m over the ground, up to ' + Math.round(D.highest) + ' m; top at ' + Math.round(D.h[D.h.length - 1]) + ' m'); } }
report.counts = { trails: L.trails.length, newTrails: A.trails.length, models: L.models.length, landmarks: L.landmarks.length, bridges: L.bridges.length, tunnels: L.tunnels.length, caveStamps: L.caveStamps.length, bytes: fs.statSync(OUT).size };
{ const L2 = PT.parse(PT.serialize(L)); report.roundTrip = !!L2.game && L2.game.terminals.length === 8 && L2.bridges[0].kind === 'draw'; if (!report.roundTrip) console.log('round trip:', !!L.game, !!L2.game, L.bridges[0].kind, L2.bridges[0].kind); }
fs.writeFileSync(path.join(WORK, 'report.json'), JSON.stringify(report, null, 1));
// the built lines, for the map
fs.writeFileSync(path.join(WORK, 'built.json'), JSON.stringify({ ramp: T.ramps[0] ? T.ramps[0].pts.filter((p, i) => i % 3 === 0) : [], tunnels: (L.tunnels || []).map(t => ({ name: t.name, layer: t.layer, pts: PT.evenCurve(t.pts, false, 4, R) })), stamps: L.caveStamps, decks: L.bridges.map(b => { const D = PT.bridgeDeck(b, T.height, R); return { name: b.name, s: Array.from(D.s), h: Array.from(D.h), g: Array.from(D.g) }; }) }));
console.log('built in', Date.now() - t0, 'ms;', report.trailMetres, 'm of trail;', steepTotal, 'steep points;', report.warnings.length, 'warnings');
console.log('ramp', JSON.stringify(report.ramp));
for (const b of report.bridges) console.log('bridge', JSON.stringify(b));
for (const c of report.caves) console.log('cave', JSON.stringify(c));
console.log('counts', JSON.stringify(report.counts), 'round trip through the editor keeps game data:', report.roundTrip);
const bad = report.trails.filter(t => t.steepPoints || t.maxGrade > 20); console.log('trails over the limits:'); for (const t of bad) console.log('  ', JSON.stringify(t));
