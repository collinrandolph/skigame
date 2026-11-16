// HALE: the v3 planetoid (after the concept art: Frostline-3, Frostveil, the moose court, the crystal vault). Everything about the world that is not drawing: the ground, the trails, where things stand,
// what the player is asked to do. Plain maths on arrays, so it runs in Node as well as the page (tools/map.js).
//
// Designed trails-first: the trails are laid out by hand (LOOPS, LINKS), the ground is shaped round them (gentle
// beside a trail, ridges rising away from it), and every prop is placed for a reason (see sites()).
(function(root){
'use strict';
const R = 600, D2R = Math.PI/180;
const ll = (lon, lat) => { const a = lon*D2R, b = lat*D2R; return [Math.cos(b)*Math.cos(a), Math.sin(b), -Math.cos(b)*Math.sin(a)]; };
const toLL = d => [Math.atan2(-d[2], d[0])/D2R, Math.asin(Math.max(-1, Math.min(1, d[1])))/D2R];
const dot = (a, b) => a[0]*b[0] + a[1]*b[1] + a[2]*b[2];
const norm = a => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0]/l, a[1]/l, a[2]/l]; };
const cross = (a, b) => [a[1]*b[2] - a[2]*b[1], a[2]*b[0] - a[0]*b[2], a[0]*b[1] - a[1]*b[0]];
const mix = (a, b, t) => norm([a[0] + (b[0] - a[0])*t, a[1] + (b[1] - a[1])*t, a[2] + (b[2] - a[2])*t]);
const ang = (a, b) => Math.acos(Math.max(-1, Math.min(1, dot(a, b))));
const dist = (a, b) => R*ang(a, b);
const sstep = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a)/(b - a))); return t*t*(3 - 2*t); };
// east and north at a point; a point `m` metres from c on compass bearing `brg` (degrees, 0 = north, 90 = east)
const basis = c => { const up = Math.abs(c[1]) < 0.95 ? [0, 1, 0] : [1, 0, 0], e = norm(cross(up, c)); return [e, cross(c, e)]; };
const offset = (c, m, brg) => { const [e, n] = basis(c), b = brg*D2R, a = m/R, s = Math.sin(a), k = Math.cos(a); return norm([c[0]*k + (e[0]*Math.sin(b) + n[0]*Math.cos(b))*s, c[1]*k + (e[1]*Math.sin(b) + n[1]*Math.cos(b))*s, c[2]*k + (e[2]*Math.sin(b) + n[2]*Math.cos(b))*s]); };
const bearing = (a, b) => { const [e, n] = basis(a); return (Math.atan2(dot(b, e), dot(b, n))/D2R + 360) % 360; };

// ---- noise: 3D gradient noise from an integer hash, and a few octaves of it
function hash3(x, y, z){ let h = (x*374761393 + y*668265263 + z*2147483647) | 0; h = (h ^ (h >>> 13))*1274126177 | 0; return (h ^ (h >>> 16)) >>> 0; }
const GR = [[1,1,0],[-1,1,0],[1,-1,0],[-1,-1,0],[1,0,1],[-1,0,1],[1,0,-1],[-1,0,-1],[0,1,1],[0,-1,1],[0,1,-1],[0,-1,-1]];
function noise(x, y, z){
  const X = Math.floor(x), Y = Math.floor(y), Z = Math.floor(z), fx = x - X, fy = y - Y, fz = z - Z;
  const u = fx*fx*fx*(fx*(fx*6 - 15) + 10), v = fy*fy*fy*(fy*(fy*6 - 15) + 10), w = fz*fz*fz*(fz*(fz*6 - 15) + 10);
  const g = (i, j, k) => { const q = GR[hash3(X + i, Y + j, Z + k) % 12]; return q[0]*(fx - i) + q[1]*(fy - j) + q[2]*(fz - k); };
  const l = (a, b, t) => a + (b - a)*t;
  return l(l(l(g(0,0,0), g(1,0,0), u), l(g(0,1,0), g(1,1,0), u), v), l(l(g(0,0,1), g(1,0,1), u), l(g(0,1,1), g(1,1,1), u), v), w);
}
const fbm = (x, y, z, o = 4) => { let s = 0, a = 0.5, f = 1; for (let i = 0; i < o; i++){ s += a*noise(x*f, y*f, z*f); a *= 0.5; f *= 2.03; } return s; };
function rng(seed){ let s = seed >>> 0; return () => { s = (s + 0x6D2B79F5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0)/4294967296; }; }

// ================================================================ the layout, by hand
const SPIRE = ll(0, 58);
const REALM_AT = [[ll(-40, -78), 190/480], [ll(-150, 70), 130/1500]];      // where the mine and the station sit (see the realms, below), and how wide: no trees there
// every zone is a small network: a main loop, one or two more loops beside or inside it, and lanes between them, so there
// is more than one way round and each terminal sends you somewhere new. z: the zone (1 Frostline, 2 Frostveil, 3 the Cut, 4 the Court)
const LOOPS = [
  { name: 'Frostline Loop', z: 1, c: ll(0, -8),   r: 185, wob: [0.10, 3, 0.4] },
  { name: 'Frostveil',      z: 2, c: ll(72, 6),   r: 245, wob: [0.13, 4, 1.7] },
  { name: 'Court Round',    z: 4, c: ll(-76, 2),  r: 225, wob: [0.12, 3, 2.6] },
  { name: 'The Cut',        z: 3, c: ll(178, -6), r: 265, wob: [0.11, 5, 0.9] },
  { name: 'Dome Ring',      z: 1, c: ll(0, -8),   r: 82,  wob: [0.06, 2, 1.0] },      // 4: round the outpost, inside the Frostline Loop
  { name: 'Ribs Rise',      z: 2, c: ll(90, 46),  r: 110, wob: [0.10, 3, 0.2] },      // 5: north of Frostveil, under the Sleeping Ribs
  { name: 'South Veil',     z: 2, c: ll(66, -38), r: 125, wob: [0.10, 3, 2.2] },      // 6: south of it, round the Low Watcher
  { name: 'Pit Ring',       z: 3, c: ll(178, -6), r: 105, wob: [0.07, 3, 0.5] },      // 7: inside the Cut, round the mine's pit
  { name: 'Circle Walk',    z: 4, c: ll(-76, 2),  r: 96,  wob: [0.06, 2, 2.0] },      // 8: inside the Court Round
];
// a link leaves loop `a` at compass bearing `ab` from its centre and joins loop `b` at bearing `bb` (or ends at `to`)
const LINKS = [
  { name: 'Veil Road',   a: 0, ab: 82,  b: 1, bb: 262, bend: 30,  power: 1 },
  { name: 'Antler Way',   a: 0, ab: 276, b: 2, bb: 98,  bend: -26, power: 2 },
  { name: 'Haul Road', far: 'Haul Road, far bank', draw: 'East drawbridge',   a: 1, ab: 96,  b: 3, bb: 280, bend: -55, power: 3 },
  { name: 'Shard Way', far: 'Shard Way, far bank', draw: 'West drawbridge',   a: 2, ab: 264, b: 3, bb: 84,  bend: 50,  power: 3 },
  // lanes inside the zones. `spoke`: from an inner ring out to the loop round it, at one bearing from their shared centre
  { name: 'Pad Lane',    a: 4, ab: 165, b: 0, bb: 165, bend: 8, spoke: true },
  { name: 'Tower Lane',  a: 4, ab: 45,  b: 0, bb: 45,  bend: -8, spoke: true },
  { name: 'Dish Lane',   a: 4, ab: 285, b: 0, bb: 285, bend: 8, spoke: true },
  { name: 'Ribs Climb',  a: 1, ab: 24,  b: 5, bb: 204, bend: 14 },
  { name: 'Low Road',    a: 1, ab: 188, b: 6, bb: 8,   bend: -14 },
  { name: 'Pit Lane',    a: 7, ab: 100, b: 3, bb: 100, bend: 10, spoke: true },
  { name: 'Ore Lane',    a: 7, ab: 220, b: 3, bb: 220, bend: -10, spoke: true },
  { name: 'Shaft Lane',  a: 7, ab: 340, b: 3, bb: 340, bend: 10, spoke: true },
  { name: 'Adit Lane',   a: 7, ab: 160, to: offset(ll(178, -6), 17, 160), inward: true, bend: 0 },      // in from the Pit Ring to the mine's mouth
  { name: 'Temple Lane', a: 8, ab: 60,  b: 2, bb: 60,  bend: 8, spoke: true },
  { name: 'Herd Lane',   a: 8, ab: 230, b: 2, bb: 230, bend: -8, spoke: true },
  { name: 'Crystal Road',  a: 0, ab: 2,   to: offset(SPIRE, 150, 184), arrive: 276, bend: 34, power: 'all' },      // arrives heading west, the way the Ascent sets off
];
// ridges: lines of high ground between the loops. [points], height, half-width
const ring = (c, r, n, wob = 0) => { const p = []; for (let i = 0; i <= n; i++) p.push(offset(c, r*(1 + wob*Math.sin(i*2.1)), i*360/n)); return p; };
// the walls of the world. every zone is shut in by ridges too steep to ski (and, for the far side, the river canyon);
// a road gets through a ridge by a narrow cut, which is where the gates stand
const RIM = 345, CROWN = 300;
const RIDGES = [
  { pts: ring(LOOPS[0].c, RIM, 40, 0.06), H: 62, w: 42 },                                            // 0 the rim round the Frostline bowl
  { pts: [ll(127, 62), ll(124, 30), ll(128, 0), ll(123, -30), ll(127, -62)], H: 135, w: 78 },        // 1 the Wall, east: the last range before the canyon
  { pts: [ll(-130, 62), ll(-126, 30), ll(-131, 0), ll(-126, -30), ll(-129, -62)], H: 135, w: 78 },   // 2 the Teeth, west
  { pts: ring(SPIRE, CROWN, 30, 0.08), H: 64, w: 45 },                                               // 3 the crown round the Heartcrystal
  { pts: [offset(LOOPS[0].c, RIM, 38), offset(SPIRE, CROWN, 146)], H: 80, w: 50 },                   // 4, 5 the corridor: Crystal Road runs between these, from the bowl to the crown
  { pts: [offset(LOOPS[0].c, RIM, 322), offset(SPIRE, CROWN, 214)], H: 80, w: 50 },
  { pts: [offset(SPIRE, CROWN, 0), ll(180, 76), ll(180, 58), ll(180, 41)], H: 95, w: 55 },           // 6 the north spine: over the pole to the canyon, parting east from west
  { pts: [offset(LOOPS[0].c, RIM, 180), ll(0, -66), ll(0, -89), ll(180, -72), ll(180, -53)], H: 95, w: 55 },   // 7 the south spine, the same
];
// the river: a canyon cut 16 m down round the whole far side, ice at the bottom, ore in the walls. only the drawbridges cross it
const RIVER = { n: norm(LOOPS[3].c), off: Math.cos(44*D2R), half: 11, level: -16, bank: 24 };

// ================================================================ trails
function densify(ctrl, closed, step = 3){
  // Catmull-Rom through the control points (on the sphere), then resampled every `step` metres
  const n = ctrl.length, P = i => closed ? ctrl[((i % n) + n) % n] : ctrl[Math.max(0, Math.min(n - 1, i))], raw = [];
  const segs = closed ? n : n - 1;
  for (let i = 0; i < segs; i++){
    const p0 = P(i - 1), p1 = P(i), p2 = P(i + 1), p3 = P(i + 2), m = Math.max(4, Math.ceil(dist(p1, p2)/2));
    for (let k = 0; k < m; k++){ const t = k/m, t2 = t*t, t3 = t2*t, q = [0, 0, 0];
      for (let a = 0; a < 3; a++) q[a] = 0.5*((2*p1[a]) + (-p0[a] + p2[a])*t + (2*p0[a] - 5*p1[a] + 4*p2[a] - p3[a])*t2 + (-p0[a] + 3*p1[a] - 3*p2[a] + p3[a])*t3);
      raw.push(norm(q)); }
  }
  if (!closed) raw.push(ctrl[n - 1]);
  const out = [raw[0]]; let acc = 0;
  const M = raw.length, lim = closed ? M : M - 1;
  for (let i = 0; i < lim; i++){ const a = raw[i], b = raw[(i + 1) % M], L = dist(a, b); let t = step - acc;
    while (t <= L){ out.push(mix(a, b, t/L)); t += step; } acc = (acc + L) % step; }
  if (closed && dist(out[out.length - 1], out[0]) < step*0.5) out.pop();
  if (!closed && dist(out[out.length - 1], raw[M - 1]) > 0.5) out.push(raw[M - 1]);
  return out;
}
const loopPoint = (L, brg) => offset(L.c, L.r*(1 + L.wob[0]*Math.sin(L.wob[1]*brg*D2R + L.wob[2])), brg);
const TRAILS = [];
for (const L of LOOPS){ const c = []; for (let b = 0; b < 360; b += 15) c.push(loopPoint(L, b)); TRAILS.push({ name: L.name, closed: true, loop: TRAILS.length, pts: densify(c, true) }); }
function nearestIndex(pts, d){ let bi = 0, bd = -2; for (let i = 0; i < pts.length; i++){ const q = dot(pts[i], d); if (q > bd){ bd = q; bi = i; } } return bi; }
const JUNCTIONS = [], DRAWS = [];
const riverDist = (x, y, z) => Math.abs(Math.asin(Math.max(-1, Math.min(1, x*RIVER.n[0] + y*RIVER.n[1] + z*RIVER.n[2]))) - Math.asin(RIVER.off))*R;
for (const K of LINKS){
  const A = LOOPS[K.a], pa = TRAILS[K.a].pts[nearestIndex(TRAILS[K.a].pts, loopPoint(A, K.ab))];
  const pb = K.to || TRAILS[K.b].pts[nearestIndex(TRAILS[K.b].pts, loopPoint(LOOPS[K.b], K.bb))];
  // leave square to the loop, swing out by `bend` metres on the way, arrive square
  const L = dist(pa, pb), side = norm(cross(pa, pb)), c = [pa, offset(pa, Math.min(40, L*0.2), K.inward ? (K.ab + 180) % 360 : K.ab)];
  for (const t of [0.35, 0.65]){ const m = mix(pa, pb, t), s = Math.sin(t*Math.PI)*K.bend/R; c.push(norm([m[0] + side[0]*s, m[1] + side[1]*s, m[2] + side[2]*s])); }
  if (!K.to) c.push(offset(pb, Math.min(40, L*0.2), K.spoke ? (K.bb + 180) % 360 : K.bb));
  if (K.to && K.arrive !== undefined) c.push(offset(pb, 46, (K.arrive + 180) % 360));
  c.push(pb);
  const pts = densify(c, false), wet = []; pts.forEach((p, i) => { if (riverDist(p[0], p[1], p[2]) < RIVER.bank) wet.push(i); });
  if (wet.length && K.draw){     // the road stops at each bank; a drawbridge carries it over
    const a = wet[0], b = wet[wet.length - 1];
    TRAILS.push({ name: K.name, closed: false, link: K, part: 'a', pts: pts.slice(0, a + 1) });
    DRAWS.push({ name: K.draw, link: K, pts: pts.slice(a, b + 1) });
    TRAILS.push({ name: K.far, closed: false, link: K, part: 'b', pts: pts.slice(b) });
  } else TRAILS.push({ name: K.name, closed: false, link: K, pts });
  JUNCTIONS.push(pa); if (!K.to) JUNCTIONS.push(pb);
}
// every trail sample in one flat list, and a coarse list (every 4th) for the first pass of "how far is the nearest trail"
const TS = []; const COARSE = [];
TRAILS.forEach((t, ti) => { t.first = TS.length; t.pts.forEach((p, i) => { TS.push({ p, ti, i }); if (i % 4 === 0) COARSE.push(TS.length - 1); }); });
const CX = new Float64Array(COARSE.length), CY = new Float64Array(COARSE.length), CZ = new Float64Array(COARSE.length), CLOOP = Uint8Array.from(COARSE, k => TRAILS[TS[k].ti].closed ? 1 : 0);
COARSE.forEach((k, j) => { CX[j] = TS[k].p[0]; CY[j] = TS[k].p[1]; CZ[j] = TS[k].p[2]; });
// the nearest trail to a direction: { d metres from its centre line, ti trail, i sample, u how far to the next sample }
function nearestTrail(x, y, z){
  let bj = 0, bd = -2, bl = -2;
  for (let j = 0; j < CX.length; j++){ const q = CX[j]*x + CY[j]*y + CZ[j]*z; if (q > bd){ bd = q; bj = j; } if (CLOOP[j] && q > bl) bl = q; }
  const k0 = COARSE[bj], s0 = TS[k0], t = TRAILS[s0.ti], M = t.pts.length, dLoop = R*Math.acos(Math.max(-1, Math.min(1, bl))); let best = null;
  if (bd < Math.cos(260/R)) return { d: R*Math.acos(Math.max(-1, bd)), dLoop, ti: s0.ti, i: s0.i, u: 0 };
  for (let o = -4; o <= 4; o++){
    let i = s0.i + o; if (t.closed) i = ((i % M) + M) % M; else if (i < 0 || i >= M - 1) continue;
    const a = t.pts[i], b = t.pts[(i + 1) % M], bx = b[0] - a[0], by = b[1] - a[1], bz = b[2] - a[2], L2 = bx*bx + by*by + bz*bz || 1e-12;
    const u = Math.max(0, Math.min(1, ((x - a[0])*bx + (y - a[1])*by + (z - a[2])*bz)/L2));
    const d = Math.hypot(x - a[0] - u*bx, y - a[1] - u*by, z - a[2] - u*bz)*R;
    if (!best || d < best.d) best = { d, dLoop, ti: s0.ti, i, u };
  }
  return best || { d: R*Math.acos(Math.max(-1, bd)), dLoop, ti: s0.ti, i: s0.i, u: 0 };
}

// ================================================================ the ground
const RP = RIDGES.map(r => { const p = densify(r.pts, false, 14); return { H: r.H, w: r.w, x: Float64Array.from(p, q => q[0]), y: Float64Array.from(p, q => q[1]), z: Float64Array.from(p, q => q[2]) }; });
// the Heartcrystal stands on a mound: the ground rises 70 m to a flat top 40 m across, and the crystal itself (drawn, not
// ground) goes up another 190 m from there. SPIRE_H is the height the Ascent ends at
const MOUND_H = 70, MOUND_TOP = 40, SPIRE_H = 215, CRYSTAL_R = 36;
function spireAt(r){ const rr = Math.max(0, r - MOUND_TOP); return MOUND_H*Math.exp(-(rr/62)*(rr/62)) + 14*Math.exp(-(r/235)*(r/235)); }
// the ground with no trail cut into it. dT: how far the nearest trail is (the land is gentle beside a trail)
// dLoop: how far the nearest loop is. beside a loop the ridges stand well back; a road is let through by a narrow cut
// dry: leave the river out (for laying a road's own profile up to the bank)
function rawHeight(x, y, z, dT, dLoop, dry){
  const tf = sstep(28, 125, dT), k = R/170, tr = Math.min(sstep(9, 26, dT), sstep(40, 125, dLoop === undefined ? dT : dLoop));
  let h = 11*fbm(x*k + 3.1, y*k - 7.7, z*k + 1.3, 4)*(0.3 + 0.7*tf) + 0.9*noise(x*R/22, y*R/22, z*R/22);
  for (let q = 0; q < RP.length; q++){
    const r = RP[q]; let bd = -2; for (let j = 0; j < r.x.length; j++){ const c = r.x[j]*x + r.y[j]*y + r.z[j]*z; if (c > bd) bd = c; }
    const d = R*Math.acos(Math.min(1, bd)), g = Math.exp(-(d/r.w)*(d/r.w));
    if (g > 0.004) h += r.H*g*(0.8 + 0.5*Math.abs(noise(x*R/95 + q*9.1, y*R/95, z*R/95 - q*4.7)))*tr;
  }
  const rs = R*Math.acos(Math.max(-1, Math.min(1, x*SPIRE[0] + y*SPIRE[1] + z*SPIRE[2])));
  if (rs < 700) h += spireAt(rs);
  if (dry) return h;
  const dr = riverDist(x, y, z); if (dr > 200) return h;
  h *= 1 - 0.5*Math.exp(-(dr/70)*(dr/70));                           // the land sinks toward the canyon
  const c = 1 - sstep(RIVER.half, RIVER.half + 8, dr);               // and then drops into it
  return h*(1 - c) + RIVER.level*c;
}
function ridgeAt(q, d){ const r = RP[q]; let bd = -2; for (let j = 0; j < r.x.length; j++){ const c = r.x[j]*d[0] + r.y[j]*d[1] + r.z[j]*d[2]; if (c > bd) bd = c; } return R*Math.acos(Math.min(1, bd)); }
// each trail's own height profile: the raw ground along it, smoothed and held to a grade a skier can climb
for (const t of TRAILS){
  const M = t.pts.length, raw = t.pts.map(p => rawHeight(p[0], p[1], p[2], 0, 0, true)), win = 14; let h = raw.slice();
  for (let pass = 0; pass < 3; pass++){ const o = h.slice();
    for (let i = 0; i < M; i++){ let s = 0, c = 0; for (let k = -win; k <= win; k++){ let j = i + k; if (t.closed) j = ((j % M) + M) % M; else j = Math.max(0, Math.min(M - 1, j)); s += o[j]; c++; } h[i] = s/c; } }
  const maxStep = 0.09*3;
  for (let pass = 0; pass < 60; pass++){ let moved = false;
    for (let i = 0; i < (t.closed ? M : M - 1); i++){ const j = (i + 1) % M, dlt = h[j] - h[i];
      if (Math.abs(dlt) > maxStep){ const e = (Math.abs(dlt) - maxStep)/2*Math.sign(dlt); h[i] += e; h[j] -= e; moved = true; } }
    if (!moved) break; }
  t.h = h;
}
// where a link meets a loop, take the loop's height there (so the junction is level)
TRAILS.forEach(t => { if (!t.link) return; const K = t.link, M = t.pts.length;
  const join = (end, loopT) => { const j = nearestIndex(loopT.pts, t.pts[end]), target = loopT.h[j], n = Math.min(40, M - 1);
    for (let k = 0; k <= n; k++){ const i = end === 0 ? k : M - 1 - k, w = 1 - sstep(0, n, k); t.h[i] = t.h[i]*(1 - w) + target*w; } };
  if (t.part !== 'b') join(0, TRAILS[K.a]); if (!K.to && t.part !== 'a') join(M - 1, TRAILS[K.b]); });
// a drawbridge's deck runs level from bank to bank
for (const D of DRAWS){ const A = TRAILS.find(t => t.link === D.link && t.part === 'a'), B = TRAILS.find(t => t.link === D.link && t.part === 'b'), h0 = A.h[A.h.length - 1], h1 = B.h[0], n = D.pts.length;
  D.s = [0]; for (let i = 1; i < n; i++) D.s.push(D.s[i - 1] + dist(D.pts[i - 1], D.pts[i])); D.h = D.s.map(v => h0 + (h1 - h0)*v/D.s[n - 1]); D.halfW = 3; D.kind = 'draw'; }
const BED = 3.6, SHOULDER = 16;
function trailBlend(nt, x, y, z){ if (nt.d >= SHOULDER) return 0; const dr = riverDist(x, y, z); return (1 - sstep(BED, SHOULDER, nt.d))*(dr > RIVER.bank ? 1 : sstep(RIVER.half + 7, RIVER.bank, dr)); }      // no road bed in the canyon: the bridge is the road there
function trailHeightAt(nt){ const t = TRAILS[nt.ti], M = t.pts.length, j = t.closed ? (nt.i + 1) % M : Math.min(M - 1, nt.i + 1); return t.h[nt.i] + (t.h[j] - t.h[nt.i])*nt.u; }
function height(x, y, z){
  const nt = nearestTrail(x, y, z), h = rawHeight(x, y, z, nt.d, nt.dLoop), w = trailBlend(nt, x, y, z);
  return w > 0 ? h + (trailHeightAt(nt) - h)*w : h;
}
// what the ground is, for the shader and for sound: trail 0..1, ice 0..1, how far along the trail
function surface(x, y, z){
  const nt = nearestTrail(x, y, z), w = trailBlend(nt, x, y, z), dr = riverDist(x, y, z);
  return { trail: nt.d < 2.5 ? 1 : nt.d > 3.4 ? 0 : 1 - (nt.d - 2.5)/0.9, dTrail: nt.d, ti: nt.ti, i: nt.i, ice: (1 - sstep(RIVER.half - 2, RIVER.half + 3, dr))*(1 - w), carve: w };
}
// everything the ground mesh needs at a point, in one pass: height, how far the nearest trail is, ice, how deep in the cut
function sample(x, y, z){
  const nt = nearestTrail(x, y, z), h0 = rawHeight(x, y, z, nt.d, nt.dLoop), w = trailBlend(nt, x, y, z), dr = riverDist(x, y, z);
  return { h: w > 0 ? h0 + (trailHeightAt(nt) - h0)*w : h0, dT: nt.d, ice: 1 - sstep(RIVER.half - 1, RIVER.half + 2, dr), cut: Math.exp(-(dr/34)*(dr/34)) };
}
function slopeAt(d){ const [e, n] = basis(d), s = 1.5/R, f = (v, k) => norm([d[0] + v[0]*k, d[1] + v[1]*k, d[2] + v[2]*k]);
  const a = f(e, s), b = f(e, -s), c = f(n, s), g = f(n, -s);
  return Math.hypot(height(a[0], a[1], a[2]) - height(b[0], b[1], b[2]), height(c[0], c[1], c[2]) - height(g[0], g[1], g[2]))/3; }

// ================================================================ the Ascent: a bridge of light winding up the Spire
const BRIDGE = (() => {
  // from the end of Crystal Road, most of two turns round the crystal, ending on a platform against its side
  const foot = TRAILS[TRAILS.length - 1].pts[TRAILS[TRAILS.length - 1].pts.length - 1], r0 = dist(foot, SPIRE), b0 = bearing(SPIRE, foot), r1 = CRYSTAL_R + 12, turns = 1.7;
  const ctrl = []; const N = 160;
  for (let i = 0; i <= N; i++){ const t = i/N, r = r0 + (r1 - r0)*Math.pow(t, 0.8); ctrl.push(offset(SPIRE, r, b0 + 360*turns*t)); }
  const pts = densify(ctrl, false, 3), s = [0]; for (let i = 1; i < pts.length; i++) s.push(s[i - 1] + dist(pts[i - 1], pts[i]));
  const L = s[s.length - 1], g = pts.map(p => height(p[0], p[1], p[2])), h0 = g[0], flat = 18;
  let h = s.map((v, i) => Math.max(h0 + (SPIRE_H - h0)*Math.min(1, v/(L - flat)), g[i] + (v < 10 ? 0 : 2.5)));
  for (let pass = 0; pass < 40; pass++){ const o = h.slice(); for (let i = 2; i < h.length - 2; i++) h[i] = Math.max(g[i], (o[i - 2] + o[i - 1] + o[i] + o[i + 1] + o[i + 2])/5); }
  return { name: 'The Ascent', pts, s, h, L, halfW: 2.6, foot, top: pts[pts.length - 1], topH: h[h.length - 1], rise: h[h.length - 1] - h0 };
})();

// ================================================================ what stands where, and why
// every entry has a kind (what to draw), a place, and a group (what switches it on). nothing is here to fill a gap:
//   pole      a snow pole with a lamp, both sides of every trail: the trail's edge at night, and a sense of speed
//   pylon     the power line: along each link, lit when the relay it feeds is lit
//   relay     the thing to relight, one per loop; cell: the charge cells round its loop
//   sign      at every junction
//   landmark  one of a kind, on the heading of the trails that approach it
const SITES = []; const SOLIDS = [];
const put = (kind, d, o = {}) => { const s = Object.assign({ kind, d, rot: 0, scale: 1 }, o); SITES.push(s); if (o.r) SOLIDS.push({ d, r: o.r }); return s; };
const beside = (t, i, off) => { const M = t.pts.length, a = t.pts[Math.max(0, i - 1)], b = t.pts[Math.min(M - 1, i + 1)], p = t.pts[i], tan = norm([b[0] - a[0], b[1] - a[1], b[2] - a[2]]), s = cross(p, tan); return norm([p[0] + s[0]*off/R, p[1] + s[1]*off/R, p[2] + s[2]*off/R]); };
const tanBearing = (t, i) => { const M = t.pts.length; return bearing(t.pts[i], t.pts[Math.min(M - 1, i + 1)] === t.pts[i] ? t.pts[i - 1] : t.pts[Math.min(M - 1, i + 1)]); };
// ---- the story's furniture (the rules that use it are game-core.js; GAME below is the block they read)
// zones: 1 the Frostline bowl and its corridor north, 2 Frostveil, 3 the Cut across the canyon, 4 the Court
const ZONE_OF_LOOP = LOOPS.map(L => L.z), ZONES = [{ id: 1, name: 'Frostline' }, { id: 2, name: 'Frostveil' }, { id: 3, name: 'The Cut' }, { id: 4, name: 'The Court' }];
const trailNamed = n => TRAILS.find(t => t.name === n);
const zoneOfTrail = t => t.link ? (t.part === 'b' ? ZONE_OF_LOOP[t.link.b] : ZONE_OF_LOOP[t.link.a]) : ZONE_OF_LOOP[t.loop];
// gates: where a road goes through a ridge, at the ridge's crest
const GATES = [
  { name: 'East gate', trail: 'Veil Road', ridge: 0, when: { zone: 1 }, opens: 'Frostline terminals powered' },
  { name: 'Crystal gate', trail: 'Antler Way', ridge: 0, when: { flag: 'offered' }, opens: 'the crystals offered', kind: 'crystalgate' },
  { name: 'South pass gate', trail: 'Shard Way', ridge: 2, when: { flag: 'southGate' }, opens: 'after the Crystal gate' },
  { name: 'Crown gate', trail: 'Crystal Road', ridge: 3, when: { flag: 'ceremony' }, opens: 'the ceremony' },
];
for (const g of GATES){ const t = trailNamed(g.trail); let bi = 0, bd = 1e9; t.pts.forEach((p, i) => { const d = ridgeAt(g.ridge, p); if (d < bd){ bd = d; bi = i; } });
  g.d = t.pts[bi]; g.rot = tanBearing(t, bi); g.i = bi;
  put(g.kind || 'gate', g.d, { rot: g.rot, name: g.name, gate: g.name });
  // what actually stops you while it is shut: a row of posts across the cut (main.js switches them off when the gate opens)
  for (let k = -5; k <= 5; k++) SOLIDS.push({ d: beside(t, bi, k*2.6), r: 1.5, gate: g.name }); }
// terminals: each has a console by the trail and orbs along a stretch of trail to fetch. the out-and-back ones lead to a
// shut gate or a raised bridge, so you see what comes next before you can reach it
const orbsAlong = (t, i0, i1, n) => { const out = [], M = t.pts.length; for (let k = 1; k <= n; k++){ let i = Math.round(i0 + (i1 - i0)*k/n); if (t.closed) i = ((i % M) + M) % M; out.push(t.pts[Math.max(0, Math.min(M - 1, i))]); } return out; };
const TERMINALS = [];
const terminal = (zone, t, f, side, orbs, loopName) => { const M = t.pts.length, i = Math.round(f*(M - 1)), name = 'Terminal ' + (TERMINALS.length + 1), d = beside(t, i, side*5.2);
  TERMINALS.push({ name, zone, d, at: t.pts[i], loop: [loopName || t.name], orbs: orbs(i, M), loopLength: 0 }); put('terminal', d, { rot: tanBearing(t, i) + (side > 0 ? -90 : 90), name, r: 0.9 }); };
{ const L0 = TRAILS[0], L1 = TRAILS[1], L3 = TRAILS[3], dome = trailNamed('Dome Ring'), pad = trailNamed('Pad Lane'), ribs = trailNamed('Ribs Rise'), sv = trailNamed('South Veil'), pit = trailNamed('Pit Ring'), sw = trailNamed('Shard Way, far bank');
  const round = (t, n) => (i, M) => orbsAlong(t, i, i + M, n + 1).slice(0, n);
  terminal(1, L0, 0.56, -1, round(L0, 7));                                                                              // 1: once round the bowl
  terminal(1, dome, 0.30, 1, (i, M) => round(dome, 4)(i, M).concat(orbsAlong(pad, 2, pad.pts.length - 3, 2)), 'Dome Ring');     // 2: round the outpost and down Pad Lane
  terminal(2, L1, 0.10, 1, (i, M) => orbsAlong(L1, i, i + M*0.55, 6));                                                  // 3: half of Frostveil
  terminal(2, ribs, 0.75, -1, round(ribs, 6), 'Ribs Rise');                                                             // 4: up the Ribs Climb and round the Rise
  terminal(2, sv, 0.25, 1, round(sv, 6), 'South Veil');                                                                 // 5: down the Low Road and round South Veil
  terminal(3, L3, 0.05, 1, (i, M) => orbsAlong(L3, i, i + M*0.55, 7));                                                  // 6: half of the Cut
  terminal(3, pit, 0.6, -1, round(pit, 5), 'Pit Ring');                                                                 // 7: in to the Pit Ring
  terminal(3, sw, 0.9, 1, () => orbsAlong(sw, sw.pts.length - 8, 5, 5), 'Shard Way');                                   // 8: out to the west bridge
}
// drawbridge posts: on the side you first reach each from
const DRAW_POSTS = {};
for (const D of DRAWS){ const east = D.name === 'East drawbridge', t = TRAILS.find(q => q.link === D.link && q.part === (east ? 'a' : 'b')), i = east ? t.pts.length - 6 : 5, d = beside(t, i, 4.6);
  DRAW_POSTS[D.name] = d; D.when = { zone: east ? 2 : 3 }; put('post', d, { rot: tanBearing(t, i), name: D.name + ' post', r: 0.5 }); }
// lamps and power lines switch on with their zone
TRAILS.forEach((t, ti) => {
  const M = t.pts.length, group = zoneOfTrail(t);
  for (let i = 4, k = 0; i < M - 3; i += 9, k++) put('pole', beside(t, i, k % 2 ? 3.5 : -3.5), { group, r: 0.12 });
  if (t.link) for (let i = 10, k = 0; i < M - 8; i += 20, k++) put('pylon', beside(t, i, 10), { rot: tanBearing(t, i), group, r: 0.8 });
});
JUNCTIONS.forEach((j, k) => put('sign', offset(j, 5.5, 45 + k*90), { r: 0.3 }));
// the one-offs. each sits where a trail points at it
const along = (name, f) => { const t = TRAILS.find(q => q.name === name); return { t, i: Math.round(f*(t.pts.length - 1)) }; };
const LANDMARKS = [];
const landmark = (kind, name, d, o) => { LANDMARKS.push({ kind, name, d }); return put(kind, d, Object.assign({ name, landmark: true }, o)); };
// (after the concept art: the Frostline-3 outpost at the landing, the Frostveil ruins east, the crystal court west, the
// mine scars on the far side)
{ const s = along('Frostline Loop', 0.52); landmark('pad', 'Landing Pad', beside(s.t, s.i, -20), { rot: tanBearing(s.t, s.i) + 25, r: 9 }); }
{ const s = along('Frostline Loop', 0.30); landmark('dome', 'Habitat Dome', beside(s.t, s.i, 26), { rot: tanBearing(s.t, s.i), r: 13 }); }
{ const s = along('Frostline Loop', 0.80); landmark('tower', 'Research Tower', beside(s.t, s.i, 18), { rot: tanBearing(s.t, s.i), r: 5 }); }
{ const s = along('Frostline Loop', 0.05); landmark('dish', 'The Ear', beside(s.t, s.i, 24), { rot: tanBearing(s.t, s.i) + 90, r: 6 }); }
{ const s = along('Veil Road', 0.5); landmark('arch', 'Spine Arch', s.t.pts[s.i], { rot: tanBearing(s.t, s.i) }); }
{ const s = along('Ribs Rise', 0.3); landmark('ribs', 'The Sleeping Ribs', beside(s.t, s.i, -44), { rot: tanBearing(s.t, s.i) + 90, r: 12 }); }
{ const s = along('Ribs Climb', 0.5); landmark('arch', 'Rise Arch', s.t.pts[s.i], { rot: tanBearing(s.t, s.i), scale: 0.7 }); }
landmark('watcher', 'The Low Watcher', LOOPS[6].c, { rot: 0, r: 6, scale: 1.1 });
landmark('mast', 'Frostline Mast', offset(LOOPS[0].c, 6, 90), { rot: 0, r: 1.5 });
{ const s = along('South Veil', 0.6); for (let k = 0; k < 4; k++) landmark('ore', 'Veil ore ' + (k + 1), beside(s.t, (s.i + k*9) % s.t.pts.length, k % 2 ? 11 : -11), { rot: k*80, scale: 1.2, r: 1 }); }
landmark('watcher', 'The Watcher', offset(LOOPS[1].c, 30, 200), { rot: 0, r: 13, scale: 2.4 });
{ const s = along('Frostveil', 0.85); landmark('mast', 'Signal Tower', beside(s.t, s.i, 14), { rot: 0, r: 1.5 }); }
{ const s = along('Court Round', 0.45); for (let k = 0; k < 11; k++){ const i = (s.i + k*10) % s.t.pts.length; landmark('crystal', 'Glass ' + (k + 1), beside(s.t, i, (k % 2 ? 1 : -1)*(12 + (k*7) % 13)), { scale: 1.4 + ((k*5) % 4)*1.1, rot: k*77, r: 2 }); } }
{ const s = along('Court Round', 0.95), c = beside(s.t, s.i, -34); landmark('circle', 'The Broken Circle', c, { rot: 0 }); landmark('temple', 'The Temple', offset(c, 30, bearing(c, LOOPS[2].c)), { rot: bearing(c, LOOPS[2].c), r: 8 });
  for (let k = 0; k < 10; k++) if (k !== 3) put('column', offset(c, 15, k*36), { r: 0.8, scale: k % 4 === 1 ? 0.55 : 1 });
  for (let k = 0; k < 4; k++) put('moose', offset(c, 7 + k*2.2, 60 + k*85), { rot: 240 + k*85, r: 1, robe: k }); }
{ const s = along('Antler Way', 0.5); landmark('arch', 'West Arch', s.t.pts[s.i], { rot: tanBearing(s.t, s.i), scale: 0.8 }); }
{ const s = along('The Cut', 0.35); for (let k = 0; k < 6; k++){ const i = (s.i + k*13) % s.t.pts.length; landmark('ore', 'Ore scar ' + (k + 1), beside(s.t, i, (k % 2 ? 15 : -15)), { rot: tanBearing(s.t, i), scale: 1 + 0.4*Math.sin(k*1.9), r: 3 }); } }
{ const s = along('The Cut', 0.75); landmark('excavator', 'The Digger', beside(s.t, s.i, 24), { rot: tanBearing(s.t, s.i) + 60, r: 7 }); }
{ const s = along('Haul Road', 0.5); landmark('watcher', 'The Far Watcher', beside(s.t, s.i, -30), { rot: 0, r: 5, scale: 0.8 }); }
{ const s = along('Shard Way', 0.5); landmark('arch', 'Shard Arch', s.t.pts[s.i], { rot: tanBearing(s.t, s.i) }); }
// a camp at every junction: people settle where roads meet
JUNCTIONS.forEach((j, k) => { if (k % 3) return; for (let q = 0; q < 12; q++){ const d = offset(j, 15, 200 + k*70 + q*30); if (nearestTrail(d[0], d[1], d[2]).d > 9.5){ put('camp', d, { rot: k*70, r: 3.5 }); break; } } });
// a herd on the open snow west of the garden
{ const s = along('Court Round', 0.7); for (let k = 0; k < 5; k++) put('moose', offset(beside(s.t, s.i, 30), 4 + k*3, k*75), { rot: k*50, r: 1 }); }
landmark('heart', 'The Heartcrystal', SPIRE, { r: CRYSTAL_R }); put('portal', BRIDGE.foot, { rot: bearing(BRIDGE.pts[0], BRIDGE.pts[4]), name: 'Ascent foot' });

// trees: groves beside the trails (so the trail runs through cover, then breaks into the open), thinner further out
const TREES = (() => {
  const rnd = rng(77), out = [];
  for (let n = 0; n < 60000 && out.length < 9000; n++){
    const z = 2*rnd() - 1, a = rnd()*Math.PI*2, rr = Math.sqrt(1 - z*z), d = [rr*Math.cos(a), z, rr*Math.sin(a)];
    const nt = nearestTrail(d[0], d[1], d[2]); if (nt.d < 6.5) continue;
    const grove = fbm(d[0]*R/120 + 5, d[1]*R/120, d[2]*R/120 - 2, 2), nearK = nt.d < 90 ? 1 : nt.d < 220 ? 0.45 : 0.12;
    if (rnd() > sstep(-0.04, 0.22, grove)*nearK) continue;
    if (riverDist(d[0], d[1], d[2]) < RIVER.half + 6 || dist(d, SPIRE) < 120) continue;
    if (SOLIDS.some(s => dist(s.d, d) < s.r + 3)) continue;
    if (REALM_AT.some(([c, a]) => dot(c, d) > Math.cos(a + 0.03)) || dist(d, LOOPS[3].c) < 22) continue;
    if (slopeAt(d) > 0.34) continue;
    out.push({ d, s: 0.8 + rnd()*0.9, rot: rnd()*360, kind: grove > 0.3 && rnd() < 0.5 ? 1 : 0 });
  }
  return out;
})();
for (const t of TREES) SOLIDS.push({ d: t.d, r: 0.22*t.s });

// ================================================================ other shells of the same sphere: the mine below, the station above
// A realm is a place at another radius. The skier's code only knows directions from the planet's centre, a radius and a
// height function, so a realm is: a centre direction C (somewhere no surface trail runs), a shell radius, a floor
// described in metres east (u) and north (v) of C, and its own trails. You change realm at a portal, never by skiing.
function realmFrame(C, Rk){ const [e, n] = basis(C);
  return { to: (u, v) => norm([C[0] + (e[0]*u + n[0]*v)/Rk, C[1] + (e[1]*u + n[1]*v)/Rk, C[2] + (e[2]*u + n[2]*v)/Rk]), from: (x, y, z) => { const k = Rk/(x*C[0] + y*C[1] + z*C[2]); return [(x*e[0] + y*e[1] + z*e[2])*k, (x*n[0] + y*n[1] + z*n[2])*k]; } }; }
const capsule = (u, v, ax, ay, bx, by, r) => { const dx = bx - ax, dy = by - ay, t = Math.max(0, Math.min(1, ((u - ax)*dx + (v - ay)*dy)/(dx*dx + dy*dy || 1))); return Math.hypot(u - ax - dx*t, v - ay - dy*t) - r; };
function makeRealm(o){
  const Rk = R - o.depth, F = realmFrame(o.C, Rk), step = 3*R/Rk, rl = Object.assign({ R: Rk, F, trails: [], sites: [], solids: [], junctions: [] }, o);
  rl.height = (x, y, z) => { const [u, v] = F.from(x, y, z); return o.floor(u, v); };
  rl.inside = (x, y, z) => x*o.C[0] + y*o.C[1] + z*o.C[2] > Math.cos(o.extent/Rk);
  rl.trail = (name, pts, closed) => { const t = { name, closed: !!closed, realm: o.key, pts: densify(pts.map(p => F.to(p[0], p[1])), !!closed, step) }; t.h = t.pts.map(p => rl.height(p[0], p[1], p[2])); rl.trails.push(t); if (!closed){ rl.junctions.push(t.pts[0], t.pts[t.pts.length - 1]); } return t; };
  rl.put = (kind, u, v, q = {}) => { const d = F.to(u, v), s = Object.assign({ kind, d, rot: 0, scale: 1, realm: o.key }, q); rl.sites.push(s); if (q.r) rl.solids.push({ d, r: q.r*R/Rk, tag: q.tag }); return s; };      // (solids are measured on the surface's scale by the skier's grid)
  return rl;
}
const ellipse = (a, b, n, ph = 0) => { const p = []; for (let i = 0; i < n; i++){ const t = i/n*Math.PI*2 + ph; p.push([a*Math.sin(t), b*Math.cos(t)]); } return p; };
// ---- the mine: 120 m down. a long hall with a street of dwellings round its middle (after the cave dwelling painting),
// an adit in from the south, the altar's cave off to the west, the mined terraces at the north end, and to the east a
// passage shut by the crown door, with the teleporter beyond it
const MINE = makeRealm({ key: 'mine', name: 'The mine', layer: 0, depth: 120, C: REALM_AT[0][0], extent: 190,
  sdf(u, v){ return Math.min((Math.hypot(u/52, v/113) - 1)*52, capsule(u, v, 0, -110, 0, -162, 8), capsule(u, v, -48, 20, -96, 40, 8), Math.hypot(u + 112, v - 44) - 24,
    capsule(u, v, 48, 30, 100, 48, 8), Math.hypot(u - 116, v - 52) - 20, Math.hypot(u, v - 128) - 34); },
  floor(u, v){ const d = this.sdf(u, v), f = 0.45*noise(u/9 + 40, v/9, 3.3); return d <= 0 ? f : f + Math.min(46, d*5); },
  ceiling(u, v){ const d = this.sdf(u, v); return 0.45*noise(u/9 + 40, v/9, 3.3) + (d >= 0 ? 6.5 : Math.min(42, 6.5 + (-d)*0.95)) + 1.6*noise(u/14, v/14, 9.1); } });
{ const M = MINE, st = ellipse(30, 92, 28), at = (v, sd) => [sd*30*Math.sqrt(1 - (v/92)*(v/92)), v];
  M.trail('Central Street', st, true);
  M.trail('The Adit', [[0, -152], [0, -130], [0, -110], [0, -92]]);
  M.trail('Altar Passage', [at(20, -1), [-52, 21], [-78, 33], [-104, 43]]);
  M.trail('Lift Passage', [at(30, 1), [52, 31], [78, 40], [108, 50]]);
  M.trail('Terrace Road', [[0, 92], [0, 110], [4, 128], [0, 146]]);
  M.entry = { d: M.F.to(0, -146), to: M.F.to(0, -120) }; M.exit = M.F.to(0, -158); M.altar = M.F.to(-114, 45); M.crownDoor = M.F.to(76, 39.5); M.tele = M.F.to(118, 53); M.teleArrive = { d: M.F.to(106, 49.5), to: M.F.to(90, 44) };
  // dwellings: a row down the middle of the street's loop, and more against the hall's walls
  const rnd = rng(31);
  for (let v = -66; v <= 66; v += 15) M.put('dwelling', (rnd() - 0.5)*8, v, { rot: rnd() < 0.5 ? 90 : 270, r: 6.5, seed: Math.floor(rnd()*1e6), storeys: 2 + Math.floor(rnd()*3) });
  for (let k = 0; k < 20; k++){ const a = k/20*Math.PI*2 + 0.16, u = 43.5*Math.sin(a), v = 104*Math.cos(a); if (Math.abs(u) < 9 || (u < 0 && Math.abs(v - 20) < 13) || (u > 0 && Math.abs(v - 30) < 13)) continue;
    M.put('dwelling', u, v, { rot: (Math.atan2(u, v)/D2R + 180) % 360, r: 5.5, seed: Math.floor(rnd()*1e6), storeys: 1 + Math.floor(rnd()*3) }); }
  for (let k = 0; k < 14; k++){ const a = k/14*Math.PI*2, u = 22.5*Math.sin(a), v = 84*Math.cos(a); M.put('lamp', u, v, { r: 0.2 }); }
  M.put('altar', -114, 45, { name: 'Mine altar', r: 2.2 });
  for (let k = 0; k < 7; k++){ const a = k/7*Math.PI*2; M.put('crystal', -112 + 19*Math.sin(a), 44 + 19*Math.cos(a), { rot: k*50, scale: 0.9 + (k % 3)*0.5, r: 1.2 }); }
  M.put('crystalgate', 76, 39.5, { rot: bearing(M.F.to(70, 37), M.F.to(82, 42)), name: 'Crown door', scale: 0.52 });
  for (let k = -3; k <= 3; k++){ const q = k*2.3; M.solids.push({ d: M.F.to(76 - q*0.33, 39.5 + q*0.94), r: 1.5*R/M.R, tag: 'crowndoor' }); }
  M.put('telepad', 118, 53, { name: 'Teleporter' });
  M.put('excavator', 16, 150, { rot: 200, r: 7, scale: 0.9 });
  for (let k = 0; k < 16; k++){ const a = (k/16 - 0.5)*Math.PI*1.5, u = 31*Math.sin(a), v = 128 + 31*Math.cos(a); M.put('ore', u, v, { rot: k*70, scale: 1.6 + (k % 4)*0.8, r: 1.4 }); }
  M.put('mineportal', 0, -162, { rot: 0, name: 'Way out' });
}
// ---- the Orbital Gateway: 900 m up. a ring deck 90 m out from a hub, four spokes between them, the transit portal off
// one side and ships docked on the arms (after the station painting). the crown crystals are here
const STATION = makeRealm({ key: 'station', name: 'Orbital Gateway', layer: 1, depth: -900, C: REALM_AT[1][0], extent: 130,
  sdf(u, v){ const r = Math.hypot(u, v); return Math.min(Math.abs(r - 90) - 5.5, r - 24, capsule(u, v, 0, 20, 0, 88, 4.5), capsule(u, v, 0, -20, 0, -88, 4.5), capsule(u, v, 20, 0, 88, 0, 4.5), capsule(u, v, -20, 0, -88, 0, 4.5)); },
  floor(u, v){ const d = this.sdf(u, v); return d <= 0 ? 0 : -Math.min(80, d*8); } });
{ const S = STATION;
  S.trail('Ring Deck', ellipse(90, 90, 36), true); S.trail('Hub Walk', ellipse(16, 16, 12), true);
  S.trail('Spoke North', [[0, 16], [0, 50], [0, 90]]); S.trail('Spoke East', [[16, 0], [50, 0], [90, 0]]); S.trail('Spoke South', [[0, -16], [0, -50], [0, -90]]); S.trail('Spoke West', [[-16, 0], [-50, 0], [-90, 0]]);
  S.tele = S.F.to(0, 0); S.teleArrive = { d: S.F.to(0, -9), to: S.F.to(0, -16) };
  S.crown = []; for (let k = 0; k < 18; k++){ const a = (k + 0.5)/18*Math.PI*2; S.crown.push(S.F.to(90*Math.sin(a), 90*Math.cos(a))); }
  for (const [x, y] of [[0, 1], [1, 0], [0, -1], [-1, 0]]) for (const r of [38, 56, 74]) S.crown.push(S.F.to(x*r, y*r));
  S.put('telepad', 0, 0, { name: 'Teleporter' });
}
const REALMS = { mine: MINE, station: STATION };
// the mine's mouth on the surface: at the middle of the Pit Ring, at the end of Adit Lane
const PORTAL = (() => { const t = trailNamed('Adit Lane'), M = t.pts.length, c = LOOPS[3].c, out = bearing(c, t.pts[M - 1]);
  put('mineportal', offset(c, 4, out), { rot: out, name: 'Mine portal', gate: 'Mine portal' }); put('mast', offset(c, 12, out + 180), { rot: 0, r: 1.5, name: 'Headframe' });
  for (let k = -2; k <= 2; k++) SOLIDS.push({ d: beside(t, M - 2, k*2.4), r: 1.4, gate: 'Mine portal' });
  for (let k = 0; k < 9; k++) if (k !== 0) SOLIDS.push({ d: offset(c, 9, out + k*40), r: 3.2 });          // the mound round the mouth
  GATES.push({ name: 'Mine portal', d: t.pts[M - 1], when: { zone: 3 }, opens: 'the Cut\'s terminals powered', noSite: true });
  return { d: offset(c, 9, out), back: { d: t.pts[M - 5], to: t.pts[M - 9] } }; })();

// ---- the Court's ceremony (chapters 7 to 9): the giant asleep across the Broken Circle, the herds and their calves, the
// three diamonds a calf is crowned on, the altar that rises there, and the crystals the mine's altar raises on the trails
const COURT = (() => { const c = LANDMARKS.find(l => l.name === 'The Broken Circle').d, out = bearing(LOOPS[2].c, c);
  put('giant', c, { name: 'Giant', rot: out + 90, r: 0 }); put('giantup', offset(c, 46, out + 60), { name: 'Giant, standing', rot: out + 240, r: 5 });
  const diamonds = [0, 1, 2].map(k => offset(c, 8.5, out + 180 + (k - 1)*70)); diamonds.forEach((d, k) => put('diamond', d, { name: 'Court diamond ' + (k + 1) }));
  put('altar', c, { name: 'Altar', r: 2.0 });
  // two herds, on the Circle Walk's far side and out by Herd Lane; three calves with each
  const calves = [], herd = (t, f, side) => { const i = Math.round(f*(t.pts.length - 1)), h = beside(t, i, side); for (let k = 0; k < 3; k++) put('moose', offset(h, 5 + k*2.5, k*120), { rot: k*90 + 20, r: 1.2 }); for (let k = 0; k < 3; k++) calves.push(offset(h, 7.5, 60 + k*120)); };
  herd(trailNamed('Circle Walk'), 0.55, 14); herd(trailNamed('Herd Lane'), 0.55, -13);
  return { d: c, diamonds, calves, giant: c }; })();
const CRYSTALS = (() => { const out = [], on = (name, ...fs) => { const t = trailNamed(name); for (const f of fs) out.push(t.pts[Math.round(f*(t.pts.length - 1))]); };
  on('Dome Ring', 0.1, 0.6); on('Tower Lane', 0.5); on('Dish Lane', 0.5); on('Frostline Loop', 0.15, 0.85); on('Frostveil', 0.3, 0.5, 0.8); on('Ribs Rise', 0.1, 0.5); on('Ribs Climb', 0.5);
  on('South Veil', 0.0, 0.5); on('Low Road', 0.5); on('The Cut', 0.3, 0.8); on('Pit Ring', 0.2); on('Ore Lane', 0.5); on('Shaft Lane', 0.5); return out; })();

const GAME = { version: 1, note: 'Hale (v3): the same block game-core.js reads from a v2 layout.',
  zones: ZONES.map(z => ({ id: z.id, name: z.name })), trailZones: Object.fromEntries(TRAILS.map(t => [t.name, zoneOfTrail(t)])),
  terminals: TERMINALS.map(t => ({ name: t.name, zone: t.zone, d: t.d, loop: t.loop, orbs: t.orbs })),
  gates: GATES.map(g => ({ name: g.name, d: g.d, opens: g.opens, when: g.when })),
  bridges: DRAWS.map(D => ({ name: D.name, kind: 'draw', when: D.when, post: DRAW_POSTS[D.name], opens: 'zone ' + D.when.zone + ' terminals powered' }))
    .concat([{ name: 'The Ascent', kind: 'light', when: { flag: 'ceremony' }, foot: BRIDGE.foot, opens: 'the ceremony' }]),
  underground: { layers: [{ name: MINE.name, depth: MINE.depth }, { name: STATION.name, depth: STATION.depth }], crystalAltar: { layer: 0, d: MINE.altar }, crownDoor: { layer: 0, d: MINE.crownDoor }, crownCrystals: { layer: 1, d: STATION.crown } },
  crystals: CRYSTALS, altar: MINE.altar, giant: COURT.giant, calves: COURT.calves, court: { d: COURT.d, diamonds: COURT.diamonds, calvesNeeded: 3 }, starway: { foot: BRIDGE.foot, top: BRIDGE.top, length: Math.round(BRIDGE.L), rise: Math.round(BRIDGE.rise) },
  chapters: ['Frostline: power 2 terminals; the East gate opens', 'Frostveil: power 3 terminals; the East drawbridge answers at its post', 'The Cut: power 3 terminals; the mine portal opens',
    'The mine: wake the altar', 'Find the 20 crystals it raises on the trails', 'Offer them at the Crystal gate; the Court opens', 'The Court: a calf wakes the giant; three calves crowned and you wear the purple',
    'The crown door in the mine opens on the teleporter: 30 crown crystals on the Orbital Gateway', 'Offered at the Court\'s altar they light the Ascent; its top ends the story'] };
const BRIDGES = [BRIDGE].concat(DRAWS);
const START = (() => { const t = TRAILS[0], i = nearestIndex(t.pts, loopPoint(LOOPS[0], 180)); return { d: t.pts[i], heading: tanBearing(t, i) }; })();

const W = { R, ll, toLL, dot, norm, cross, mix, dist, offset, bearing, basis, sstep, noise, fbm, rng,
  SPIRE, SPIRE_H, MOUND_H, CRYSTAL_R, LOOPS, LINKS, RIDGES, RIVER, TRAILS, JUNCTIONS, BRIDGE, BRIDGES, DRAWS, GATES, TERMINALS, ZONES, GAME, REALMS, PORTAL, COURT, CRYSTALS, zoneOfTrail, SITES, SOLIDS, LANDMARKS, TREES, START,
  TRAIL_W: 5, STOP: 0.55, height, rawHeight, sample, surface, slopeAt, nearestTrail, riverDist };
if (typeof module !== 'undefined' && module.exports) module.exports = W; else root.Hale = W;
})(typeof window !== 'undefined' ? window : globalThis);
