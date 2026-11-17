// HALE, v4: the owner's planet (the v2 sculpt, radius 550) under v3's engine. Everything about the world that is not
// drawing. Plain maths on arrays, so it runs in Node as well as the page.
//
//   data/terrain.js   the sculpt as a height map (tools/v4/bake.js). The ground is exactly the owner's; this file only
//                     cuts the trails' beds into it.
//   data/layout.js    the trail network fitted into each zone's skiable ground, and the story's fixed points from v2:
//                     gates, drawbridges, light bridges, the pit, the court (tools/v4/build.py).
// From those it builds the trails, the bridges (the steps of light to the summit among them), where everything stands,
// the mine at the bottom of the pit, the station overhead, and the block the rules read (GAME).
(function(root){
'use strict';
const node = typeof module !== 'undefined' && module.exports;
const TER = node ? require('../data/terrain.js') : root.HALE_TERRAIN, LAY = node ? require('../data/layout.js') : root.HALE_LAYOUT;
const R = TER.radius, D2R = Math.PI/180;
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

// ================================================================ the ground: the sculpt, read from the height map
const HM = (() => { if (node){ const b = Buffer.from(TER.b64, 'base64'); return new Int16Array(b.buffer, b.byteOffset, b.length/2); } const s = atob(TER.b64), u = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i); return new Int16Array(u.buffer); })();
const HW = TER.w, HH = TER.h, HU = TER.unit;
function base(x, y, z){
  const fx = (Math.atan2(-z, x)/(2*Math.PI) + 0.5)*HW - 0.5, fy = (0.5 - Math.asin(Math.max(-1, Math.min(1, y)))/Math.PI)*HH - 0.5;
  const i = Math.floor(fx), j = Math.max(0, Math.min(HH - 2, Math.floor(fy))), u = fx - i, v = Math.max(0, Math.min(1, fy - j)), i0 = ((i % HW) + HW) % HW, i1 = (i0 + 1) % HW, r0 = j*HW, r1 = r0 + HW;
  return ((HM[r0 + i0]*(1 - u) + HM[r0 + i1]*u)*(1 - v) + (HM[r1 + i0]*(1 - u) + HM[r1 + i1]*u)*v)*HU;
}
const baseD = d => base(d[0], d[1], d[2]);
const baseSlope = d => { const [e, n] = basis(d), s = 2.2/R, f = (v, k) => baseD(norm([d[0] + v[0]*k, d[1] + v[1]*k, d[2] + v[2]*k])); return Math.hypot(f(e, s) - f(e, -s), f(n, s) - f(n, -s))/4.4; };
const P2 = p => ll(p[0], p[1]);
const SUMMIT = P2(LAY.summit), PIT = (() => { let mi = 0; for (let k = 0; k < HM.length; k++) if (HM[k] < HM[mi]) mi = k; return ll((mi % HW + 0.5)/HW*360 - 180, 90 - (Math.floor(mi/HW) + 0.5)/HH*180); })();

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

// ================================================================ trails: the fitted network, and the road down the pit
const TRAILS = LAY.trails.map(t => ({ name: t.name, z: t.z, closed: t.closed, pts: densify(t.pts.map(P2), t.closed) })).filter(t => t.pts.length > 7);      // (a lane a few metres long is a stub of the routing: drop it)
const trailNamed = n => TRAILS.find(t => t.name === n);
function nearestIndex(pts, d){ let bi = 0, bd = -2; for (let i = 0; i < pts.length; i++){ const q = dot(pts[i], d); if (q > bd){ bd = q; bi = i; } } return bi; }
// the Pit Road: from the mine portal on the rim, round and down the pit's wall at 20%, to its floor. laid by the wall's
// own shape: at each step it goes on round the pit and moves in to wherever the wall is at the height it has come down to
const PIT_GRADE = 0.20;
const PIT_ROAD = (() => { const top = trailNamed('Adit Lane'), start = top.pts[top.pts.length - 1], pts = [start]; let b = bearing(PIT, start), r = dist(PIT, start), h = baseD(start);
  const wallR = (brg, want, r0) => { let lo = 8, hi = r0 + 6; for (let k = 0; k < 22; k++){ const m = (lo + hi)/2; if (baseD(offset(PIT, m, brg)) > want) hi = m; else lo = m; } return (lo + hi)/2; };
  for (let n = 0; n < 900 && r > 16; n++){ const ds = 6; h -= ds*PIT_GRADE; b += ds/Math.max(r, 12)/D2R; r = Math.min(r, wallR(b, h, r)); pts.push(offset(PIT, r, b)); }
  const t = { name: 'Pit Road', z: '3', closed: false, pit: true, pts: densify(pts, false) }; TRAILS.push(t); return t; })();
const JUNCTIONS = []; for (const t of TRAILS) if (!t.closed) JUNCTIONS.push(t.pts[0], t.pts[t.pts.length - 1]);
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

// each trail's own height profile: the sculpt along it, smoothed, and held to a grade a skier can climb (the Pit Road: its own)
for (const t of TRAILS){
  const M = t.pts.length, raw = t.pts.map(baseD), win = t.pit ? 4 : 9; let h = raw.slice();
  for (let pass = 0; pass < 2; pass++){ const o = h.slice();
    for (let i = 0; i < M; i++){ let s = 0, c = 0; for (let k = -win; k <= win; k++){ let j = i + k; if (t.closed) j = ((j % M) + M) % M; else j = Math.max(0, Math.min(M - 1, j)); s += o[j]; c++; } h[i] = s/c; } }
  if (t.pit){ const h0 = raw[0]; h = h.map((v, i) => Math.max(v, h0 - i*3*PIT_GRADE - 2)); }
  const maxStep = (t.pit ? 0.24 : 0.12)*3;
  for (let pass = 0; pass < 80; pass++){ let moved = false;
    for (let i = 0; i < (t.closed ? M : M - 1); i++){ const j = (i + 1) % M, dlt = h[j] - h[i];
      if (Math.abs(dlt) > maxStep){ const e = (Math.abs(dlt) - maxStep)/2*Math.sign(dlt); h[i] += e; h[j] -= e; moved = true; } }
    if (!moved) break; }
  t.h = h;
}
// where a trail ends on another, it takes that trail's height there
for (const t of TRAILS){ if (t.closed) continue; const M = t.pts.length;
  for (const end of [0, M - 1]){ let best = null; for (const o of TRAILS){ if (o === t) continue; const j = nearestIndex(o.pts, t.pts[end]), d = dist(o.pts[j], t.pts[end]); if (d < 7 && (!best || d < best.d)) best = { d, h: o.h[j] }; }
    if (!best) continue; const n = Math.min(30, M - 1); for (let k = 0; k <= n; k++){ const i = end === 0 ? k : M - 1 - k, w = 1 - sstep(0, n, k); t.h[i] = t.h[i]*(1 - w) + best.h*w; } } }
const BED = 3.6, SHOULDER = 13;
const trailBlend = nt => nt.d >= SHOULDER ? 0 : 1 - sstep(BED, SHOULDER, nt.d);
function trailHeightAt(nt){ const t = TRAILS[nt.ti], M = t.pts.length, j = t.closed ? (nt.i + 1) % M : Math.min(M - 1, nt.i + 1); return t.h[nt.i] + (t.h[j] - t.h[nt.i])*nt.u; }
function height(x, y, z){ const nt = nearestTrail(x, y, z), h = base(x, y, z), w = trailBlend(nt); return w > 0 ? h + (trailHeightAt(nt) - h)*w : h; }
const heightD = d => height(d[0], d[1], d[2]);
// for the ground mesh: height, how far the nearest trail is, and how far into the pit (its walls show the ore)
function sample(x, y, z){ const nt = nearestTrail(x, y, z), h0 = base(x, y, z), w = trailBlend(nt), dp = R*Math.acos(Math.max(-1, Math.min(1, x*PIT[0] + y*PIT[1] + z*PIT[2])));
  return { h: w > 0 ? h0 + (trailHeightAt(nt) - h0)*w : h0, dT: nt.d, ice: 0, cut: 1 - sstep(150, 210, dp) }; }
function slopeAt(d){ const [e, n] = basis(d), s = 1.5/R, f = (v, k) => heightD(norm([d[0] + v[0]*k, d[1] + v[1]*k, d[2] + v[2]*k])); return Math.hypot(f(e, s) - f(e, -s), f(n, s) - f(n, -s))/3; }

// ================================================================ bridges: a deck from A to B, level with the ground at each end
// a span is straight if a straight deck clears the ground and is no steeper than `grade`; otherwise it swings out to one
// side, further and further, until it is long enough to climb gently and nothing stands in its way
function span(name, A, B, o = {}){
  const grade = o.grade || 0.22, hA = heightD(A), hB = heightD(B), side = norm(cross(A, B));
  const tryOne = bulge => { const ctrl = []; for (let k = 0; k <= 12; k++){ const t = k/12, m = mix(A, B, t), s = Math.sin(t*Math.PI)*bulge/R; ctrl.push(norm([m[0] + side[0]*s, m[1] + side[1]*s, m[2] + side[2]*s])); }
    const pts = densify(ctrl, false), n = pts.length, s = [0]; for (let i = 1; i < n; i++) s.push(s[i - 1] + dist(pts[i - 1], pts[i])); const Lt = s[n - 1];
    // the deck: a straight climb from end to end, lifted wherever the ground comes up to it (a bridge of light can lie along a slope), then eased
    const g = pts.map(heightD); let h = s.map((v, i) => Math.max(hA + (hB - hA)*v/Lt, g[i] + (v < 8 || v > Lt - 8 ? 0 : 2)));
    for (let pass = 0; pass < 30; pass++){ const q = h.slice(); for (let i = 2; i < n - 2; i++) h[i] = Math.max(g[i], (q[i - 2] + q[i - 1] + q[i] + q[i + 1] + q[i + 2])/5); }
    let mx = 0; for (let i = 1; i < n; i++) mx = Math.max(mx, Math.abs(h[i] - h[i - 1])/Math.max(0.5, s[i] - s[i - 1]));
    return mx > grade ? null : { name, pts, s, h, L: Lt, halfW: o.halfW || 2.6, kind: o.kind || 'light', when: o.when, foot: A, top: B, rise: hB - hA, steepest: mx }; };
  for (let b = 0; b <= 520; b += 20) for (const sg of b ? [1, -1] : [1]){ const r = tryOne(b*sg); if (r) return r; }
  return null;
}
const DRAWS = LAY.draws.map(b => { const z2 = b.zones[0] === '2' ? 0 : 1, A = P2(z2 === 0 ? b.a : b.b), B = P2(z2 === 0 ? b.b : b.a), pts = densify([A, mix(A, B, 0.5), B], false), s = [0]; for (let i = 1; i < pts.length; i++) s.push(s[i - 1] + dist(pts[i - 1], pts[i]));
  const hA = heightD(A), hB = heightD(B); return { name: b.name, kind: 'draw', when: { zone: 2 }, pts, s, h: s.map(v => hA + (hB - hA)*v/s[s.length - 1]), halfW: 3, foot: A, top: B }; });
const lightOf = n => LAY.lights.find(b => b.name === n);
const HIGHLAND = (() => { const b = lightOf('Highland bridge'), z1 = b.zones[0] === '1'; return span('Highland bridge', P2(z1 ? b.a : b.b), P2(z1 ? b.b : b.a), { when: { flag: 'altar' }, grade: 0.34 }); })();
const CRYSTALB = (() => { const b = lightOf('Crystal bridge'), e = b.zones[0] === 'E'; return span('Crystal bridge', P2(e ? b.a : b.b), P2(e ? b.b : b.a), { when: { flag: 'offered' }, grade: 0.34 }); })();
// the steps of light: from the court's plain, shelf to shelf up the mountain, to the summit. the shelves are the ones the
// owner sculpted; a chain is used if every one of its spans can be built
const COURT_AT = P2(LAY.court);
const level = (d, reach) => { let best = d, bs = baseSlope(d); for (let k = 0; k < 40; k++){ const q = offset(d, reach*Math.sqrt((k + 1)/40), k*137.5), s = baseSlope(q); if (s < bs){ bs = s; best = q; } } return best; };
const STEPS = (() => { const top = level(offset(SUMMIT, 14, bearing(SUMMIT, COURT_AT)), 10);
  const chains = [[[-175.1, -29.6], [175.8, -36.7]], [[-127.1, -58.8], [-136.5, -39.0]], [[-125.7, -24.4], [-136.9, -15.5], [-150.0, -13.8]], [[-175.1, -29.6]], [[-136.5, -39.0]]];
  for (const ch of chains){ const stops = ch.map(p => level(P2(p), 14)), first = stops[0];
    // the foot: on the plain's nearest trail to the first shelf
    let foot = null, bd = 1e9; for (const t of TRAILS){ if (t.z !== '4' && t.z !== '3') continue; const i = nearestIndex(t.pts, first), d = dist(t.pts[i], first); if (d < bd && d > 40){ bd = d; foot = { t, i }; } }
    const way = [offset(foot.t.pts[foot.i], 7, bearing(foot.t.pts[foot.i], first))].concat(stops, [top]), out = [];
    for (let k = 0; k < way.length - 1; k++){ const a = k ? offset(way[k], 5, bearing(way[k], way[k + 1])) : way[k], b = k < way.length - 2 ? offset(way[k + 1], 5, bearing(way[k + 1], way[k])) : way[k + 1];
      const sp = span(['First Step', 'Second Step', 'Third Step', 'Fourth Step'][k], a, b, { when: { flag: 'ceremony' }, grade: 0.34 }); if (!sp){ out.length = 0; break; } out.push(sp); }
    if (out.length){ out.zone = foot.t.z; out.footTrail = foot.t.name; return out; } }
  return []; })();
const LIGHTS = [HIGHLAND, CRYSTALB].filter(Boolean).concat(STEPS), BRIDGES = LIGHTS.concat(DRAWS);

// ================================================================ what stands where
const SITES = [], SOLIDS = [];
const put = (kind, d, o = {}) => { const s = Object.assign({ kind, d, rot: 0, scale: 1 }, o); SITES.push(s); if (o.r) SOLIDS.push({ d, r: o.r }); return s; };
const beside = (t, i, off) => { const M = t.pts.length, a = t.pts[Math.max(0, i - 1)], b = t.pts[Math.min(M - 1, i + 1)], p = t.pts[i], tan = norm([b[0] - a[0], b[1] - a[1], b[2] - a[2]]), s = cross(p, tan); return norm([p[0] + s[0]*off/R, p[1] + s[1]*off/R, p[2] + s[2]*off/R]); };
const tanBearing = (t, i) => { const M = t.pts.length; return i >= M - 1 ? bearing(t.pts[i - 1], t.pts[i]) : bearing(t.pts[i], t.pts[i + 1]); };
const along = (name, f) => { const t = trailNamed(name); return t ? { t, i: Math.round(f*(t.pts.length - 1)) } : null; };
// a place for something of radius r near d: the most level ground within reach that is clear of every trail and of what is already there
function spot(d, r, reach = 45){ let best = null, bs = 1e9; for (let k = 0; k < 60; k++){ const q = k ? offset(d, reach*Math.sqrt(k/60), k*137.5) : d, nt = nearestTrail(q[0], q[1], q[2]); if (nt.d < r + 6) continue; if (SOLIDS.some(s => dist(s.d, q) < s.r + r + 2)) continue;
    const s = baseSlope(q) + dist(q, d)/reach*0.04; if (s < bs){ bs = s; best = q; } } return bs < 0.3 ? best : null; }
const LANDMARKS = [];
const landmark = (kind, name, d, o = {}) => { if (!d) return null; LANDMARKS.push({ kind, name, d }); return put(kind, d, Object.assign({ name, landmark: true }, o)); };
const centre = t => norm(t.pts.reduce((a, p) => [a[0] + p[0], a[1] + p[1], a[2] + p[2]], [0, 0, 0]));
const ZONES = LAY.zones.map(z => ({ id: z.id === 'E' ? 'highlands' : +z.id, key: z.id, name: z.name })), zid = k => k === 'E' ? 'highlands' : +k;
// ---- gates: where the roads go through the passes (v2's places)
const GWHEN = { 'East gate': { zone: 1 }, 'North gate': { zone: 1 }, 'South pass gate': { flag: 'southGate' }, 'Crystal gate': { flag: 'offered' } };
const GATES = LAY.gates.map(g => { const d = P2(g.at); let bt = null, bi = 0, bd = 1e9; for (const t of TRAILS){ const i = nearestIndex(t.pts, d), q = dist(t.pts[i], d); if (q < bd){ bd = q; bt = t; bi = Math.max(1, Math.min(t.pts.length - 2, i)); } }
  const rot = tanBearing(bt, bi); put(g.name === 'Crystal gate' ? 'crystalgate' : 'gate', bt.pts[bi], { rot, name: g.name, gate: g.name });
  for (let k = -5; k <= 5; k++) SOLIDS.push({ d: beside(bt, bi, k*2.6), r: 1.5, gate: g.name });
  return { name: g.name, d: bt.pts[bi], when: GWHEN[g.name], opens: '', trail: bt.name, i: bi }; });
// the mine portal: a little way down the Pit Road, where it is a ledge on the pit's wall and there is no way round
{ const t = PIT_ROAD, i = 16; put('mineportal', beside(t, i, 0), { rot: tanBearing(t, i), name: 'Mine portal', gate: 'Mine portal', scale: 1 }); for (let k = -4; k <= 4; k++) SOLIDS.push({ d: beside(t, i, k*2.4), r: 1.5, gate: 'Mine portal' });
  GATES.push({ name: 'Mine portal', d: t.pts[i], when: { zone: 3 }, opens: '' }); }
// ---- terminals: two in the Bowl, three on each plain; each on its own loop, its orbs round that loop
const orbsAlong = (t, i0, i1, n) => { const out = [], M = t.pts.length; for (let k = 1; k <= n; k++){ let i = Math.round(i0 + (i1 - i0)*k/n); if (t.closed) i = ((i % M) + M) % M; out.push(t.pts[Math.max(0, Math.min(M - 1, i))]); } return out; };
const TERMINALS = [];
function terminal(zone, name, f, n){ const t = trailNamed(name); if (!t) return; const M = t.pts.length, i = Math.round(f*(M - 1)), tn = 'Terminal ' + (TERMINALS.length + 1), side = TERMINALS.length % 2 ? 5.2 : -5.2, d = beside(t, i, side);
  const orbs = t.closed ? orbsAlong(t, i, i + M, n + 1).slice(0, n) : orbsAlong(t, i, i < M/2 ? M - 4 : 3, n);
  TERMINALS.push({ name: tn, zone, d, at: t.pts[i], loop: [name], orbs }); put('terminal', d, { rot: tanBearing(t, i) + (side > 0 ? -90 : 90), name: tn, r: 0.9 }); }
{ const inZone = z => TRAILS.filter(t => t.z === z && t.closed).sort((a, b) => b.pts.length - a.pts.length), z1 = inZone('1'), z2 = inZone('2'), z3 = inZone('3'), open1 = TRAILS.filter(t => t.z === '1' && !t.closed && !/Road|Bridge/.test(t.name)).sort((a, b) => b.pts.length - a.pts.length);
  terminal(1, z1[0].name, 0.5, 6); if (z1[1]) terminal(1, z1[1].name, 0.3, 5); else if (open1[0]) terminal(1, open1[0].name, 0.12, 5); else terminal(1, z1[0].name, 0.0, 6);
  for (let k = 0; k < 3; k++) terminal(2, z2[k % z2.length].name, 0.15 + 0.3*k, 6);
  for (let k = 0; k < 3; k++) terminal(3, z3[k % z3.length].name, 0.2 + 0.3*k, 6); }
// ---- drawbridge posts, on the home plain's side
const DRAW_POSTS = {};
for (const D of DRAWS){ let bt = null, bi = 0, bd = 1e9; for (const t of TRAILS){ if (t.z !== '2') continue; const i = nearestIndex(t.pts, D.foot), q = dist(t.pts[i], D.foot); if (q < bd){ bd = q; bt = t; bi = i; } }
  const i = Math.max(1, Math.min(bt.pts.length - 2, bi < bt.pts.length/2 ? bi + 5 : bi - 5)), d = beside(bt, i, 4.6); DRAW_POSTS[D.name] = d; put('post', d, { rot: tanBearing(bt, i), name: D.name + ' post', r: 0.5 }); }
// ---- lamps on every trail, power lines on the roads, a sign at every junction: all switch on with their zone
for (const t of TRAILS){ const M = t.pts.length, group = t.z;
  for (let i = 4, k = 0; i < M - 3; i += 9, k++) put('pole', beside(t, i, k % 2 ? 3.5 : -3.5), { group, r: 0.12 });
  if (/Road|Pass/.test(t.name) && !t.pit) for (let i = 10; i < M - 8; i += 20){ const d = beside(t, i, 10); if (baseSlope(d) < 0.3) put('pylon', d, { rot: tanBearing(t, i), group, r: 0.8 }); } }
JUNCTIONS.forEach((j, k) => { if (k % 2 === 0) put('sign', offset(j, 5.5, 45 + k*90), { r: 0.3 }); });
// ---- the landmarks, after the concept art, each by the loop it belongs to
const by = (name, f, kind, title, r, off, o = {}) => { const s = along(name, f); if (!s) return; const d = spot(beside(s.t, s.i, off), r); landmark(kind, title, d, Object.assign({ rot: tanBearing(s.t, s.i) + (o.turn || 0), r }, o)); };
by('Frostline Loop', 0.52, 'pad', 'Landing Pad', 10, -20, { turn: 25 }); by('Frostline Loop', 0.25, 'dome', 'Habitat Dome', 13, 28); by('Frostline Loop', 0.8, 'tower', 'Research Tower', 5, 18); by('Frostline Loop', 0.05, 'dish', 'The Ear', 6, -24, { turn: 90 });
by('Ribs Rise', 0.3, 'ribs', 'The Sleeping Ribs', 12, -46, { turn: 90 }); by('South Veil', 0.5, 'watcher', 'The Low Watcher', 6, 30, { scale: 1.1 }); by('Signal Loop', 0.4, 'mast', 'Signal Tower', 1.5, 14); by("Watcher's Round", 0.6, 'mast', 'Relay Mast', 1.5, -14);
{ const t = trailNamed('Frostveil'); if (t) landmark('watcher', 'The Watcher', spot(centre(t), 13, 80), { r: 13, scale: 2.4 }); }
for (const n of ['East Road, beyond', 'North Road, beyond', 'South Pass']){ const s = along(n, 0.5); if (s && baseSlope(s.t.pts[s.i]) < 0.25) landmark('arch', n === 'South Pass' ? 'Shard Arch' : n.startsWith('East') ? 'Spine Arch' : 'North Arch', s.t.pts[s.i], { rot: tanBearing(s.t, s.i), scale: n === 'South Pass' ? 0.8 : 1 }); }
by('The Cut', 0.75, 'excavator', 'The Digger', 7, 24, { turn: 60 }); by("Digger's Loop", 0.3, 'excavator', 'The Old Digger', 7, -24, { turn: 200 }); by('Pit Ring', 0.5, 'mast', 'Headframe', 1.5, 14);
for (const [n, cnt] of [['The Cut', 6], ['Ore Round', 5], ['Pit Ring', 4]]){ const t = trailNamed(n); if (!t) continue; for (let k = 0; k < cnt; k++){ const i = Math.round((k + 0.5)/cnt*(t.pts.length - 1)), d = spot(beside(t, i, k % 2 ? 15 : -15), 1.5, 14); if (d) landmark('ore', 'Ore scar', d, { rot: k*70, scale: 1 + (k % 3)*0.5, r: 1 }); } }
JUNCTIONS.forEach((j, k) => { if (k % 5) return; const d = spot(offset(j, 16, 200 + k*70), 3.5, 20); if (d) put('camp', d, { rot: k*70, r: 3.5 }); });
// the highlands: crystal growing wild, thicker than anywhere else
for (const t of TRAILS.filter(q => q.z === 'E')) for (let i = 8; i < t.pts.length - 6; i += 26){ const d = spot(beside(t, i, (i % 52 ? 1 : -1)*11), 1.6, 12); if (d) landmark('crystal', 'Highland crystal', d, { scale: 1 + (i % 4)*0.6, rot: i*37, r: 1.3 }); }
// the summit: a crown of crystal on the peak, lit by the ceremony
landmark('heart', 'The Heartcrystal', SUMMIT, { r: 0, scale: 0.3 });

// ---- the Court, on the south plain at v2's Broken Circle
const COURT = (() => { const c = COURT_AT, out = bearing(c, SUMMIT);
  landmark('circle', 'The Broken Circle', c, { rot: 0 }); landmark('temple', 'The Temple', spot(offset(c, 34, out + 180), 9, 20), { rot: out, r: 8 });
  for (let k = 0; k < 10; k++) if (k !== 3) put('column', offset(c, 15, k*36), { r: 0.8, scale: k % 4 === 1 ? 0.55 : 1 });
  put('giant', c, { name: 'Giant', rot: out + 90, r: 0 }); const up = spot(offset(c, 50, out + 70), 5, 25) || offset(c, 50, out + 70); put('giantup', up, { name: 'Giant, standing', rot: bearing(up, c), r: 5 });
  const diamonds = [0, 1, 2].map(k => offset(c, 8.5, out + 180 + (k - 1)*70)); diamonds.forEach((d, k) => put('diamond', d, { name: 'Court diamond ' + (k + 1) })); put('altar', c, { name: 'Altar', r: 2.0 });
  // two herds out on the plain's trails; three calves with each
  const calves = [], z4 = TRAILS.filter(t => t.z === '4').sort((a, b) => b.pts.length - a.pts.length), far = z4.map(t => ({ t, i: t.pts.reduce((bi, p, i) => dist(p, c) > dist(t.pts[bi], c) ? i : bi, 0) })).sort((a, b) => dist(b.t.pts[b.i], c) - dist(a.t.pts[a.i], c));
  for (const h of [far[0], { t: z4[0], i: Math.round(z4[0].pts.length*0.5) }]){ const at = spot(beside(h.t, h.i, 14), 6, 18) || beside(h.t, h.i, 14); for (let k = 0; k < 3; k++) put('moose', offset(at, 5 + k*2.5, k*120), { rot: k*90 + 20, r: 1.2 }); for (let k = 0; k < 3; k++) calves.push(offset(at, 7.5, 60 + k*120)); }
  return { d: c, diamonds, calves, giant: c }; })();
// the 20 crystals: on the highlands' trails
const CRYSTALS = (() => { const ts = TRAILS.filter(t => t.z === 'E'), tot = ts.reduce((a, t) => a + t.pts.length, 0), out = []; for (const t of ts){ const n = Math.max(1, Math.round(20*t.pts.length/tot)); for (let k = 0; k < n; k++) out.push(t.pts[Math.round((k + 0.5)/n*(t.pts.length - 1))]); } return out.slice(0, 20); })();

// trees: groves beside the trails, thinner further out; none on steep ground or down the pit
const TREES = (() => { const rnd = rng(77), out = [];
  for (let n = 0; n < 70000 && out.length < 9000; n++){
    const z = 2*rnd() - 1, a = rnd()*Math.PI*2, rr = Math.sqrt(1 - z*z), d = [rr*Math.cos(a), z, rr*Math.sin(a)];
    const nt = nearestTrail(d[0], d[1], d[2]); if (nt.d < 6.5) continue;
    const grove = fbm(d[0]*R/120 + 5, d[1]*R/120, d[2]*R/120 - 2, 2), nearK = nt.d < 90 ? 1 : nt.d < 220 ? 0.4 : 0.08;
    if (rnd() > sstep(-0.04, 0.22, grove)*nearK) continue;
    if (dist(d, PIT) < 190 || baseSlope(d) > 0.3 || baseD(d) > 110) continue;
    if (SOLIDS.some(s => s.r > 1 && dist(s.d, d) < s.r + 3)) continue;
    out.push({ d, s: 0.8 + rnd()*0.9, rot: rnd()*360, kind: grove > 0.3 && rnd() < 0.5 ? 1 : 0 }); }
  return out; })();
for (const t of TREES) SOLIDS.push({ d: t.d, r: 0.22*t.s });

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

// ================================================================ the mine, and the station
// A realm is another floor in the same directions: the skier's code is given its height function (and, for the station,
// its radius) and nothing else changes. The mine's floor continues the pit's: you ski off the end of the Pit Road, through
// the door in the pit's wall, and are in it, with no step and no jump. The station is reached only by the rings.
const ellipse = (a, b, n, ph = 0) => { const p = []; for (let i = 0; i < n; i++){ const t = i/n*Math.PI*2 + ph; p.push([a*Math.sin(t), b*Math.cos(t)]); } return p; };
// the door: at the Pit Road's end, facing on the way it was going. the mine is laid out from there: v north = straight on in
const DOOR = (() => { const t = PIT_ROAD, M = t.pts.length; return { d: t.pts[M - 1], brg: bearing(t.pts[M - 4], t.pts[M - 1]), h: t.h[M - 1] }; })();
const MINE = (() => { const C = offset(DOOR.d, R*Math.atan(176/R), DOOR.brg), FL = DOOR.h;        // the hall's middle: 176 m in from the door, on the realm's own flat map
  // (u, v) on that map are metres east and north of C. the mine is drawn in the door's frame (a across, b along the way in);
  // the way in, as seen from C, is the bearing back to the door turned about (bearings swing as you go, this far north)
  const way = (bearing(C, DOOR.d) + 180) % 360, ca = Math.cos(way*D2R), sa = Math.sin(way*D2R);
  const M = makeRealm({ key: 'mine', name: 'The mine', layer: 0, depth: 0, C, extent: 230,
    sdf(u0, v0){ const u = u0*ca - v0*sa, v = u0*sa + v0*ca; return this.sd(u, v); },
    sd(u, v){ return Math.min((Math.hypot(u/52, v/113) - 1)*52, capsule(u, v, 0, -110, 0, -182, 8), capsule(u, v, -48, 20, -96, 40, 8), Math.hypot(u + 112, v - 44) - 24,
      capsule(u, v, 48, 30, 100, 48, 8), Math.hypot(u - 122, v - 55) - 27, Math.hypot(u, v - 128) - 34); },
    floor(u, v){ const d = this.sdf(u, v), f = FL + 0.45*noise(u/9 + 40, v/9, 3.3); return d <= 0 ? f : f + Math.min(46, d*5); },
    ceiling(u, v){ const d = this.sdf(u, v); return FL + 0.45*noise(u/9 + 40, v/9, 3.3) + (d >= 0 ? 6.5 : Math.min(42, 6.5 + (-d)*0.95)) + 1.6*noise(u/14, v/14, 9.1); } });
  // lay things out in the door's frame: (a across, b along) > the realm's (u, v)
  const T = (a, b) => [a*ca + b*sa, -a*sa + b*ca], tr = (name, pts, closed) => M.trail(name, pts.map(p => T(p[0], p[1])), closed), at = (a, b) => M.F.to(...T(a, b)), putAt = (kind, a, b, o) => M.put(kind, ...T(a, b), o);
  const sd = (v, s) => [s*30*Math.sqrt(1 - (v/92)*(v/92)), v];
  tr('Central Street', ellipse(30, 92, 28), true); tr('The Adit', [[0, -176], [0, -150], [0, -120], [0, -92]]); tr('Altar Passage', [sd(20, -1), [-52, 21], [-78, 33], [-104, 43]]); tr('Crown Passage', [sd(30, 1), [52, 31], [78, 40], [104, 49]]); tr('Terrace Road', [[0, 92], [0, 110], [4, 128], [0, 146]]);
  M.door = at(0, -176); M.altar = at(-114, 45); M.crownDoor = at(76, 39.5); M.ring = at(0, 156); M.ringArrive = { d: at(0, 148), to: at(0, 120) };
  const rnd = rng(31);
  for (let v = -66; v <= 66; v += 15) putAt('dwelling', (rnd() - 0.5)*8, v, { rot: way + (rnd() < 0.5 ? 90 : 270), r: 6.5, seed: Math.floor(rnd()*1e6), storeys: 2 + Math.floor(rnd()*3) });
  for (let k = 0; k < 20; k++){ const a = k/20*Math.PI*2 + 0.16, u = 43.5*Math.sin(a), v = 104*Math.cos(a); if (Math.abs(u) < 9 || (u < 0 && Math.abs(v - 20) < 13) || (u > 0 && Math.abs(v - 30) < 13)) continue; putAt('dwelling', u, v, { rot: way + Math.atan2(u, v)/D2R + 180, r: 5.5, seed: Math.floor(rnd()*1e6), storeys: 1 + Math.floor(rnd()*3) }); }
  for (let k = 0; k < 14; k++){ const a = k/14*Math.PI*2; putAt('lamp', 22.5*Math.sin(a), 84*Math.cos(a), { r: 0.2 }); }
  putAt('altar', -114, 45, { name: 'Mine altar', r: 2.2 }); for (let k = 0; k < 7; k++){ const a = k/7*Math.PI*2; putAt('crystal', -112 + 19*Math.sin(a), 44 + 19*Math.cos(a), { rot: k*50, scale: 0.9 + (k % 3)*0.5, r: 1.2 }); }
  putAt('crystalgate', 76, 39.5, { rot: bearing(at(70, 37), at(82, 42)), name: 'Crown door', scale: 0.52 });
  for (let k = -3; k <= 3; k++){ const q = k*2.3; M.solids.push({ d: at(76 - q*0.33, 39.5 + q*0.94), r: 1.5, tag: 'crowndoor' }); }
  // the crown room, behind the crown door: the thirty crown crystals, in two rings
  M.crown = []; for (let k = 0; k < 12; k++){ const a = k/12*Math.PI*2; M.crown.push(at(122 + 9*Math.sin(a), 55 + 9*Math.cos(a))); } for (let k = 0; k < 18; k++){ const a = (k + 0.5)/18*Math.PI*2; M.crown.push(at(122 + 20*Math.sin(a), 55 + 20*Math.cos(a))); }
  putAt('column', 122, 55, { r: 0.9 });
  // the terraces, the digger, the ore; and at the far end the ring that goes to the station
  putAt('excavator', 18, 140, { rot: way + 200, r: 7, scale: 0.9 }); for (let k = 0; k < 14; k++){ const a = (k/14 - 0.5)*Math.PI*1.4, u = 31*Math.sin(a), v = 128 + 31*Math.cos(a); if (Math.abs(u) < 7 && v > 150) continue; putAt('ore', u, v, { rot: k*70, scale: 1.6 + (k % 4)*0.8, r: 1.4 }); }
  putAt('telepad', 0, 156, { name: 'Mine ring' }); putAt('mineportal', 0, -182, { rot: way, name: 'Way out' });
  return M; })();
// ---- the Orbital Gateway: 900 m over the pit. for looking at and skiing round; a ring at each end of its long axis
const STATION = makeRealm({ key: 'station', name: 'Orbital Gateway', layer: 1, depth: -900, C: PIT, extent: 150,
  sdf(u, v){ const r = Math.hypot(u, v); return Math.min(Math.abs(r - 90) - 5.5, r - 24, capsule(u, v, 0, 20, 0, 88, 4.5), capsule(u, v, 0, -20, 0, -88, 4.5), capsule(u, v, 20, 0, 88, 0, 4.5), capsule(u, v, -20, 0, -88, 0, 4.5), capsule(u, v, 92, 0, 122, 0, 6), capsule(u, v, -92, 0, -122, 0, 6)); },
  floor(u, v){ const d = this.sdf(u, v); return d <= 0 ? 0 : -Math.min(80, d*8); } });
{ const S = STATION;
  S.trail('Ring Deck', ellipse(90, 90, 36), true); S.trail('Hub Walk', ellipse(16, 16, 12), true);
  S.trail('Spoke North', [[0, 16], [0, 50], [0, 90]]); S.trail('Spoke South', [[0, -16], [0, -50], [0, -90]]); S.trail('Mine Arm', [[-16, 0], [-50, 0], [-90, 0], [-118, 0]]); S.trail('Far Arm', [[16, 0], [50, 0], [90, 0], [118, 0]]);
  S.mineRing = S.F.to(-122, 0); S.mineArrive = { d: S.F.to(-112, 0), to: S.F.to(-90, 0) }; S.farRing = S.F.to(122, 0); S.farArrive = { d: S.F.to(112, 0), to: S.F.to(90, 0) };
  S.put('telepad', -122, 0, { name: 'Mine ring' }); S.put('telepad', 122, 0, { name: 'Far ring' }); }
const REALMS = { mine: MINE, station: STATION };
put('mineportal', DOOR.d, { rot: DOOR.brg, name: 'Mine door' }); put('portal', STEPS.length ? STEPS[0].foot : COURT_AT, { rot: STEPS.length ? bearing(STEPS[0].pts[0], STEPS[0].pts[4]) : 0, name: 'Foot of the steps' });
// the surface ring: in the open beside the mine portal on the rim. dark until you have come down to it from the station
const SURFACE_RING = (() => { const t = trailNamed('Adit Lane'), i = Math.max(2, t.pts.length - 14), d = spot(beside(t, i, 16), 4, 18) || beside(t, i, 16); put('telepad', d, { name: 'Surface ring', surface: true });
  return { d, arrive: { d: offset(d, 7, bearing(d, t.pts[i])), to: t.pts[i] } }; })();

// ================================================================ the block the rules read (js/game-core.js), in v2's shape
const top = STEPS.length ? STEPS[STEPS.length - 1] : null;
const GAME = { version: 1, note: 'Hale v4: the v2 planet and story, on the v3 engine.',
  zones: ZONES.map(z => ({ id: z.id, name: z.name })), trailZones: Object.fromEntries(TRAILS.map(t => [t.name, zid(t.z)])),
  terminals: TERMINALS.map(t => ({ name: t.name, zone: t.zone, d: t.d, loop: t.loop, orbs: t.orbs })),
  gates: GATES.map(g => ({ name: g.name, d: g.d, when: g.when })),
  bridges: DRAWS.map(D => ({ name: D.name, kind: 'draw', when: D.when, post: DRAW_POSTS[D.name] })).concat(LIGHTS.map(b => ({ name: b.name, kind: 'light', when: b.when, foot: b.foot }))),
  crystals: CRYSTALS, altar: MINE.altar, giant: COURT.giant, calves: COURT.calves, court: { d: COURT.d, diamonds: COURT.diamonds, calvesNeeded: 3 },
  starway: top ? { foot: STEPS[0].foot, top: top.top } : null,
  underground: { layers: [{ name: MINE.name, depth: 0 }, { name: STATION.name, depth: STATION.depth }], crystalAltar: { layer: 0, d: MINE.altar }, crownDoor: { layer: 0, d: MINE.crownDoor }, crownCrystals: { layer: 0, d: MINE.crown } } };
const START = (() => { const t = trailNamed('Frostline Loop') || TRAILS[0]; return { d: t.pts[0], heading: tanBearing(t, 0) }; })();
const W = { R, ll, toLL, dot, norm, cross, mix, dist, offset, bearing, basis, sstep, noise, fbm, rng,
  SUMMIT, PIT, TRAILS, JUNCTIONS, BRIDGES, LIGHTS, STEPS, DRAWS, GATES, TERMINALS, ZONES, GAME, REALMS, DOOR, SURFACE_RING, COURT, CRYSTALS, SITES, SOLIDS, LANDMARKS, TREES, START,
  TRAIL_W: 5, STOP: LAY.stop, height, base, sample, slopeAt, baseSlope, nearestTrail, zid };
if (node) module.exports = W; else root.Hale = W;
})(typeof window !== 'undefined' ? window : globalThis);
