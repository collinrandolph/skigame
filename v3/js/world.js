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
// four loops, each with a relay to relight; links between them; a road north to the Spire
const SPIRE = ll(0, 58);
const LOOPS = [
  { name: 'Frostline Loop',    c: ll(0, -8),    r: 185, wob: [0.10, 3, 0.4],  relay: 'Frostline Beacon',  relayAt: 200, zone: 'outpost' },
  { name: 'Frostveil',    c: ll(72, 6),    r: 245, wob: [0.13, 4, 1.7],  relay: 'Veil Beacon',    relayAt: 60,  zone: 'ruins' },
  { name: 'Court Round', c: ll(-76, 2),   r: 225, wob: [0.12, 3, 2.6],  relay: 'Court Beacon',   relayAt: 300, zone: 'court' },
  { name: 'The Cut',     c: ll(178, -6),  r: 265, wob: [0.11, 5, 0.9],  relay: 'Cut Beacon',     relayAt: 150, zone: 'mine' },
];
// a link leaves loop `a` at compass bearing `ab` from its centre and joins loop `b` at bearing `bb` (or ends at `to`)
const LINKS = [
  { name: 'Veil Road',   a: 0, ab: 82,  b: 1, bb: 262, bend: 30,  power: 1 },
  { name: 'Antler Way',   a: 0, ab: 276, b: 2, bb: 98,  bend: -26, power: 2 },
  { name: 'Haul Road',   a: 1, ab: 96,  b: 3, bb: 280, bend: -55, power: 3 },
  { name: 'Shard Way',   a: 2, ab: 264, b: 3, bb: 84,  bend: 50,  power: 3 },
  { name: 'Crystal Road',  a: 0, ab: 2,   to: offset(SPIRE, 150, 184), arrive: 276, bend: 34, power: 'all' },      // arrives heading west, the way the Ascent sets off
];
// ridges: lines of high ground between the loops. [points], height, half-width
const ring = (c, r, n, wob = 0) => { const p = []; for (let i = 0; i <= n; i++) p.push(offset(c, r*(1 + wob*Math.sin(i*2.1)), i*360/n)); return p; };
const RIDGES = [
  { pts: ring(LOOPS[0].c, 345, 40, 0.06), H: 62, w: 62 },                          // the rim round the landing bowl
  { pts: [ll(127, 62), ll(124, 30), ll(128, 0), ll(123, -30), ll(127, -62)], H: 135, w: 78 },     // the Wall, between the Reach and the far side
  { pts: [ll(-130, 62), ll(-126, 30), ll(-131, 0), ll(-126, -30), ll(-129, -62)], H: 135, w: 78 },  // the Teeth, west
  { pts: ring(SPIRE, 300, 30, 0.08), H: 48, w: 55 },                               // the crown round the Spire
  { pts: [ll(40, -52), ll(10, -60), ll(-25, -56), ll(-55, -48)], H: 95, w: 90 },   // the south shelf
  { pts: [ll(150, 44), ll(180, 52), ll(-150, 46)], H: 80, w: 80 },                 // far north
];
const RIVER = { n: norm(ll(118, 62)), off: Math.sin(-20*D2R), half: 11, level: -8 };     // a ring of ice round the planet

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
const JUNCTIONS = [];
for (const K of LINKS){
  const A = LOOPS[K.a], pa = TRAILS[K.a].pts[nearestIndex(TRAILS[K.a].pts, loopPoint(A, K.ab))];
  const pb = K.to || TRAILS[K.b].pts[nearestIndex(TRAILS[K.b].pts, loopPoint(LOOPS[K.b], K.bb))];
  // leave square to the loop, swing out by `bend` metres on the way, arrive square
  const L = dist(pa, pb), side = norm(cross(pa, pb)), c = [pa, offset(pa, Math.min(40, L*0.2), K.ab)];
  for (const t of [0.35, 0.65]){ const m = mix(pa, pb, t), s = Math.sin(t*Math.PI)*K.bend/R; c.push(norm([m[0] + side[0]*s, m[1] + side[1]*s, m[2] + side[2]*s])); }
  if (!K.to) c.push(offset(pb, Math.min(40, L*0.2), K.bb));
  if (K.to && K.arrive !== undefined) c.push(offset(pb, 46, (K.arrive + 180) % 360));
  c.push(pb);
  TRAILS.push({ name: K.name, closed: false, link: K, pts: densify(c, false) });
  JUNCTIONS.push(pa); if (!K.to) JUNCTIONS.push(pb);
}
// every trail sample in one flat list, and a coarse list (every 4th) for the first pass of "how far is the nearest trail"
const TS = []; const COARSE = [];
TRAILS.forEach((t, ti) => { t.first = TS.length; t.pts.forEach((p, i) => { TS.push({ p, ti, i }); if (i % 4 === 0) COARSE.push(TS.length - 1); }); });
const CX = new Float64Array(COARSE.length), CY = new Float64Array(COARSE.length), CZ = new Float64Array(COARSE.length);
COARSE.forEach((k, j) => { CX[j] = TS[k].p[0]; CY[j] = TS[k].p[1]; CZ[j] = TS[k].p[2]; });
// the nearest trail to a direction: { d metres from its centre line, ti trail, i sample, u how far to the next sample }
function nearestTrail(x, y, z){
  let bj = 0, bd = -2;
  for (let j = 0; j < CX.length; j++){ const q = CX[j]*x + CY[j]*y + CZ[j]*z; if (q > bd){ bd = q; bj = j; } }
  const k0 = COARSE[bj], s0 = TS[k0], t = TRAILS[s0.ti], M = t.pts.length; let best = null;
  if (bd < Math.cos(260/R)) return { d: R*Math.acos(Math.max(-1, bd)), ti: s0.ti, i: s0.i, u: 0 };
  for (let o = -4; o <= 4; o++){
    let i = s0.i + o; if (t.closed) i = ((i % M) + M) % M; else if (i < 0 || i >= M - 1) continue;
    const a = t.pts[i], b = t.pts[(i + 1) % M], bx = b[0] - a[0], by = b[1] - a[1], bz = b[2] - a[2], L2 = bx*bx + by*by + bz*bz || 1e-12;
    const u = Math.max(0, Math.min(1, ((x - a[0])*bx + (y - a[1])*by + (z - a[2])*bz)/L2));
    const d = Math.hypot(x - a[0] - u*bx, y - a[1] - u*by, z - a[2] - u*bz)*R;
    if (!best || d < best.d) best = { d, ti: s0.ti, i, u };
  }
  return best || { d: R*Math.acos(Math.max(-1, bd)), ti: s0.ti, i: s0.i, u: 0 };
}

// ================================================================ the ground
const RP = RIDGES.map(r => { const p = densify(r.pts, false, 14); return { H: r.H, w: r.w, x: Float64Array.from(p, q => q[0]), y: Float64Array.from(p, q => q[1]), z: Float64Array.from(p, q => q[2]) }; });
const riverDist = (x, y, z) => Math.abs(Math.asin(Math.max(-1, Math.min(1, x*RIVER.n[0] + y*RIVER.n[1] + z*RIVER.n[2]))) - Math.asin(RIVER.off))*R;
// the Heartcrystal stands on a mound: the ground rises 70 m to a flat top 40 m across, and the crystal itself (drawn, not
// ground) goes up another 190 m from there. SPIRE_H is the height the Ascent ends at
const MOUND_H = 70, MOUND_TOP = 40, SPIRE_H = 215, CRYSTAL_R = 36;
function spireAt(r){ const rr = Math.max(0, r - MOUND_TOP); return MOUND_H*Math.exp(-(rr/62)*(rr/62)) + 14*Math.exp(-(r/235)*(r/235)); }
// the ground with no trail cut into it. dT: how far the nearest trail is (the land is gentle beside a trail)
function rawHeight(x, y, z, dT){
  const tf = sstep(28, 125, dT), k = R/170;
  let h = 11*fbm(x*k + 3.1, y*k - 7.7, z*k + 1.3, 4)*(0.3 + 0.7*tf) + 0.9*noise(x*R/22, y*R/22, z*R/22);
  for (let q = 0; q < RP.length; q++){
    const r = RP[q]; let bd = -2; for (let j = 0; j < r.x.length; j++){ const c = r.x[j]*x + r.y[j]*y + r.z[j]*z; if (c > bd) bd = c; }
    const d = R*Math.acos(Math.min(1, bd)), g = Math.exp(-(d/r.w)*(d/r.w));
    if (g > 0.004) h += r.H*g*(0.55 + 0.9*Math.abs(noise(x*R/95 + q*9.1, y*R/95, z*R/95 - q*4.7)))*tf;
  }
  const rs = R*Math.acos(Math.max(-1, Math.min(1, x*SPIRE[0] + y*SPIRE[1] + z*SPIRE[2])));
  if (rs < 700) h += spireAt(rs);
  const dr = riverDist(x, y, z), trench = Math.exp(-(dr/30)*(dr/30));
  h = h*(1 - 0.9*trench) + (RIVER.level - 1.5)*trench;
  const ice = 1 - sstep(RIVER.half - 2, RIVER.half + 3, dr);
  return h*(1 - ice) + RIVER.level*ice;
}
// each trail's own height profile: the raw ground along it, smoothed and held to a grade a skier can climb
for (const t of TRAILS){
  const M = t.pts.length, raw = t.pts.map(p => rawHeight(p[0], p[1], p[2], 0)), win = 14; let h = raw.slice();
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
  join(0, TRAILS[K.a]); if (!K.to) join(M - 1, TRAILS[K.b]); });
const BED = 3.6, SHOULDER = 16;
function trailBlend(nt){ return nt.d >= SHOULDER ? 0 : 1 - sstep(BED, SHOULDER, nt.d); }
function trailHeightAt(nt){ const t = TRAILS[nt.ti], M = t.pts.length, j = t.closed ? (nt.i + 1) % M : Math.min(M - 1, nt.i + 1); return t.h[nt.i] + (t.h[j] - t.h[nt.i])*nt.u; }
function height(x, y, z){
  const nt = nearestTrail(x, y, z), h = rawHeight(x, y, z, nt.d), w = trailBlend(nt);
  return w > 0 ? h + (trailHeightAt(nt) - h)*w : h;
}
// what the ground is, for the shader and for sound: trail 0..1, ice 0..1, how far along the trail
function surface(x, y, z){
  const nt = nearestTrail(x, y, z), w = trailBlend(nt), dr = riverDist(x, y, z);
  return { trail: nt.d < 2.5 ? 1 : nt.d > 3.4 ? 0 : 1 - (nt.d - 2.5)/0.9, dTrail: nt.d, ti: nt.ti, i: nt.i, ice: (1 - sstep(RIVER.half - 2, RIVER.half + 3, dr))*(1 - w), carve: w };
}
// everything the ground mesh needs at a point, in one pass: height, how far the nearest trail is, ice, how deep in the cut
function sample(x, y, z){
  const nt = nearestTrail(x, y, z), h0 = rawHeight(x, y, z, nt.d), w = trailBlend(nt), dr = riverDist(x, y, z);
  return { h: w > 0 ? h0 + (trailHeightAt(nt) - h0)*w : h0, dT: nt.d, ice: (1 - sstep(RIVER.half - 2, RIVER.half + 3, dr))*(1 - w), cut: Math.exp(-(dr/30)*(dr/30)) };
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
const RELAYS = [];
LOOPS.forEach((L, li) => {
  const t = TRAILS[li], M = t.pts.length, ri = nearestIndex(t.pts, loopPoint(L, L.relayAt)), d = beside(t, ri, li % 2 ? 9 : -9);
  const cells = []; for (let k = 1; k <= 6; k++){ const i = (ri + Math.round(k*M/7)) % M; cells.push(t.pts[i]); }
  RELAYS.push({ name: L.relay, loop: L.name, zone: L.zone, d, cells, at: t.pts[ri] });
  put('relay', d, { rot: tanBearing(t, ri), group: li, r: 2.2, name: L.relay });
});
TRAILS.forEach((t, ti) => {
  const M = t.pts.length, group = t.link ? t.link.power : ti;
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
{ const s = along('Frostveil', 0.2); landmark('ribs', 'The Sleeping Ribs', beside(s.t, s.i, 42), { rot: tanBearing(s.t, s.i) + 90, r: 12 }); }
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
JUNCTIONS.forEach((j, k) => put('camp', offset(j, 13, 200 + k*70), { rot: k*70, r: 3.5 }));
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
    if (slopeAt(d) > 0.34) continue;
    out.push({ d, s: 0.8 + rnd()*0.9, rot: rnd()*360, kind: grove > 0.3 && rnd() < 0.5 ? 1 : 0 });
  }
  return out;
})();
for (const t of TREES) SOLIDS.push({ d: t.d, r: 0.22*t.s });

const START = (() => { const t = TRAILS[0], i = nearestIndex(t.pts, loopPoint(LOOPS[0], 180)); return { d: t.pts[i], heading: tanBearing(t, i) }; })();

const W = { R, ll, toLL, dot, norm, cross, mix, dist, offset, bearing, basis, sstep, noise, fbm, rng,
  SPIRE, SPIRE_H, MOUND_H, CRYSTAL_R, LOOPS, LINKS, RIDGES, RIVER, TRAILS, JUNCTIONS, BRIDGE, RELAYS, SITES, SOLIDS, LANDMARKS, TREES, START,
  TRAIL_W: 5, STOP: 0.55, height, rawHeight, sample, surface, slopeAt, nearestTrail, riverDist };
if (typeof module !== 'undefined' && module.exports) module.exports = W; else root.Hale = W;
})(typeof window !== 'undefined' ? window : globalThis);
