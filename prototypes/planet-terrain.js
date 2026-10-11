// planet-terrain.js: the planet's ground, shared by planetoid.html (the game) and planet-editor.html (the editor), so
// what you shape in the editor is exactly what you ski.
//
// A layout (planet.json, or the editor's autosave) is plain data:
//   radius        metres
//   noise.amp     how much of the base lumpy noise to use (1 = the procedural planet, 0 = smooth)
//   stamps        shapes laid on the ground, all in metres: peak, ridge, plateau, crater. a negative height turns them
//                 into a pit, a valley, a basin or a crater-shaped dome. each has a centre (or, for a ridge, points), a
//                 radius (half-width for a ridge), a height and a sharpness (0 = rounded, 1 = straight-sided)
//   sculpt        a hand-sculpted height layer: n x n points on each of the cube's 6 faces, in centimetres
//   trails        named lines of control points (a smooth curve runs through them), closed into loops or not. a trail
//                 can carve its own bed into the ground: level across, its height smoothed along the line (with a
//                 steepest grade), cutting into rises and building up over dips, with shoulders back to the land
//   landmarks     named places with a height and a colour
//   bridges       light bridges: a line of points from the start ramp's foot to the end ramp's foot. the deck rises at
//                 the ramps to `clearance` metres above the ground (over `ramp` metres), keeps at least that over the
//                 ground in between (smoothed, its descents no steeper than `maxGrade`), and is `width` metres either side
//   start         where the skier starts
//   detail        a fine sculpt layer (about a metre between points), stored only in the 32 x 32 tiles that have been
//                 painted: the cliff-erator brush writes here
//   cliffs        `stop` is the steepest grade you can ski (1 = 100%): anything steeper stops you at its edge. `from`,
//                 `band` and `sharp` are the cliff-erator brush's settings (it steps ground steeper than `from` into
//                 cliff bands `band` metres high, with risers about `sharp` times steeper than the slope was)
//   scatter       how many random mountains, buildings and trees the game adds (mountains default to none, since
//                 the layout has its own topography)
// Directions are unit vectors [x, y, z] from the planet's centre (y is the planet's north).
(function(){
'use strict';
const PT = {};

// ---------- gradient noise (the same noise and seed as the procedural planet) ----------
const PERM = (() => {
  const p = new Uint8Array(256); for (let i = 0; i < 256; i++) p[i] = i;
  let s = 20261010; const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
  for (let i = 255; i > 0; i--){ const j = Math.floor(rnd()*(i + 1)); const t = p[i]; p[i] = p[j]; p[j] = t; }
  const q = new Uint8Array(512); for (let i = 0; i < 512; i++) q[i] = p[i & 255]; return q;
})();
const fade = t => t*t*t*(t*(t*6 - 15) + 10), lerp = (t, a, b) => a + t*(b - a);
function gr(h, x, y, z){ h &= 15; const u = h < 8 ? x : y, v = h < 4 ? y : (h === 12 || h === 14) ? x : z; return ((h & 1) ? -u : u) + ((h & 2) ? -v : v); }
function noise3(x, y, z){
  const X = Math.floor(x), Y = Math.floor(y), Z = Math.floor(z);
  x -= X; y -= Y; z -= Z;
  const xi = X & 255, yi = Y & 255, zi = Z & 255, u = fade(x), v = fade(y), w = fade(z);
  const A = PERM[xi] + yi, AA = PERM[A] + zi, AB = PERM[A + 1] + zi, B = PERM[xi + 1] + yi, BA = PERM[B] + zi, BB = PERM[B + 1] + zi;
  return lerp(w,
    lerp(v, lerp(u, gr(PERM[AA], x, y, z), gr(PERM[BA], x - 1, y, z)), lerp(u, gr(PERM[AB], x, y - 1, z), gr(PERM[BB], x - 1, y - 1, z))),
    lerp(v, lerp(u, gr(PERM[AA + 1], x, y, z - 1), gr(PERM[BA + 1], x - 1, y, z - 1)), lerp(u, gr(PERM[AB + 1], x, y - 1, z - 1), gr(PERM[BB + 1], x - 1, y - 1, z - 1))));
}
PT.noise3 = noise3;
// broad swells (~150 m), rolling hills (~60 m) and small humps (~24 m), the same size on any radius
PT.baseNoise = function(x, y, z, R){
  const a = R/150, b = R/60, c = R/24;
  return 7*noise3(x*a, y*a, z*a) + 2.5*noise3(x*b + 31.7, y*b + 5.1, z*b - 12.3) + 0.7*noise3(x*c - 77.3, y*c + 41.9, z*c + 8.8);
};

// ---------- cube faces (for the sculpt grid). face 0..5 = +x -x +y -y +z -z; u, v in [-1, 1] ----------
PT.faceUV = function(x, y, z){
  const ax = Math.abs(x), ay = Math.abs(y), az = Math.abs(z);
  if (ax >= ay && ax >= az) return [x > 0 ? 0 : 1, y/ax, z/ax];
  if (ay >= az) return [y > 0 ? 2 : 3, x/ay, z/ay];
  return [z > 0 ? 4 : 5, x/az, y/az];
};
PT.dirFromFace = function(f, u, v, out){
  let x, y, z;
  switch (f){ case 0: x = 1; y = u; z = v; break; case 1: x = -1; y = u; z = v; break; case 2: x = u; y = 1; z = v; break;
    case 3: x = u; y = -1; z = v; break; case 4: x = u; y = v; z = 1; break; default: x = u; y = v; z = -1; }
  const L = Math.hypot(x, y, z); out = out || [0, 0, 0]; out[0] = x/L; out[1] = y/L; out[2] = z/L; return out;
};

// ---------- stamp shapes ----------
// profile across a stamp: 1 at its centre line, 0 at its edge. sharpness blends a rounded hill into a straight cone
function profile(t, sharp){
  if (t >= 1) return 0; if (t <= 0) return 1;
  const round = 1 - t*t*(3 - 2*t), cone = 1 - t;
  return round + (cone - round)*sharp;
}
PT.profile = profile;
PT.STAMP_TYPES = {
  peak:    { label: 'Peak',    sign: 1,  line: false, desc: 'a hill or mountain' },
  pit:     { label: 'Pit',     sign: -1, line: false, shape: 'peak', desc: 'a hollow' },
  ridge:   { label: 'Ridge',   sign: 1,  line: true,  desc: 'a ridge along a line' },
  valley:  { label: 'Valley',  sign: -1, line: true,  shape: 'ridge', desc: 'a valley along a line' },
  plateau: { label: 'Plateau', sign: 1,  line: false, desc: 'a flat-topped table' },
  basin:   { label: 'Basin',   sign: -1, line: false, shape: 'plateau', desc: 'a flat-bottomed bowl' },
  crater:  { label: 'Crater',  sign: 1,  line: false, desc: 'a raised rim round a bowl' },
};
const shapeOf = t => (PT.STAMP_TYPES[t] && PT.STAMP_TYPES[t].shape) || t;
// height contribution of one compiled stamp at direction (x, y, z); R is the radius
function stampAt(s, x, y, z, R){
  if (x*s.bx + y*s.by + z*s.bz < s.cosB) return 0;                      // outside its bounding cap
  let d;
  if (s.segs){
    d = Infinity; const g = s.segs;
    for (let i = 0; i < g.length; i += 6){
      const ax = g[i], ay = g[i+1], az = g[i+2], ex = g[i+3] - ax, ey = g[i+4] - ay, ez = g[i+5] - az, L2 = ex*ex + ey*ey + ez*ez || 1e-12;
      const u = Math.max(0, Math.min(1, ((x - ax)*ex + (y - ay)*ey + (z - az)*ez)/L2));
      const q = Math.hypot(x - ax - u*ex, y - ay - u*ey, z - az - u*ez); if (q < d) d = q;
    }
    d *= R;
  } else d = Math.hypot(x - s.cx, y - s.cy, z - s.cz)*R;
  const r = s.r, h = s.h;
  switch (s.shape){
    case 'peak': case 'ridge': return h*profile(d/r, s.sharp);
    case 'plateau': { const e = 0.08 + 0.4*(1 - s.sharp), t = d/r; return t <= 1 - e ? h : h*profile((t - (1 - e))/e, 0); }
    case 'crater': { const w = 0.35*r; return h*profile(Math.abs(d - r)/w, s.sharp) - (d < r ? 0.8*h*profile(d/r, 0) : 0); }
  }
  return 0;
}
// a ridge's points become chord segments through a smooth curve (so a ridge bends gently through its points)
function compileStamp(st, R){
  const shape = shapeOf(st.type), sign = (PT.STAMP_TYPES[st.type] || {}).sign || 1;
  const s = { shape, r: Math.max(1, st.radius), h: sign*Math.abs(st.height), sharp: Math.max(0, Math.min(1, st.sharp ?? 0.3)) };
  const reach = (s.shape === 'crater' ? s.r*1.4 : s.r) + 2;
  if (PT.STAMP_TYPES[st.type] && PT.STAMP_TYPES[st.type].line){
    const pts = PT.curve(st.pts, false, Math.max(3, s.r/4), R);
    const segs = []; for (let i = 0; i + 1 < pts.length; i++) segs.push(...pts[i], ...pts[i + 1]);
    if (!segs.length){ const p = pts[0] || st.pts[0]; segs.push(...p, ...p); }
    s.segs = new Float64Array(segs);
    // bounding cap: the mean direction, out to the farthest point plus the radius
    let mx = 0, my = 0, mz = 0; for (const p of pts){ mx += p[0]; my += p[1]; mz += p[2]; }
    const L = Math.hypot(mx, my, mz) || 1; s.bx = mx/L; s.by = my/L; s.bz = mz/L;
    let ang = 0; for (const p of pts) ang = Math.max(ang, Math.acos(Math.min(1, p[0]*s.bx + p[1]*s.by + p[2]*s.bz)));
    s.cosB = Math.cos(Math.min(Math.PI, ang + reach/R));
  } else {
    const c = st.pts[0]; s.cx = c[0]; s.cy = c[1]; s.cz = c[2]; s.bx = c[0]; s.by = c[1]; s.bz = c[2];
    s.cosB = Math.cos(Math.min(Math.PI, reach/R));
  }
  return s;
}

// ---------- a smooth curve through control points on the sphere (Catmull-Rom in 3D, back onto the sphere) ----------
// returns unit directions about `spacing` metres apart
PT.curve = function(pts, closed, spacing, R){
  const n = pts.length; if (!n) return []; if (n === 1) return [pts[0].slice()];
  const P = i => closed ? pts[(i + n) % n] : pts[Math.max(0, Math.min(n - 1, i))];
  const out = [], segs = closed ? n : n - 1;
  for (let i = 0; i < segs; i++){
    const p0 = P(i - 1), p1 = P(i), p2 = P(i + 1), p3 = P(i + 2);
    const len = Math.hypot(p2[0] - p1[0], p2[1] - p1[1], p2[2] - p1[2])*R, steps = Math.max(1, Math.ceil(len/spacing));
    for (let k = 0; k < steps; k++){
      const u = k/steps, u2 = u*u, u3 = u2*u, q = [0, 0, 0];
      for (let a = 0; a < 3; a++) q[a] = 0.5*((2*p1[a]) + (-p0[a] + p2[a])*u + (2*p0[a] - 5*p1[a] + 4*p2[a] - p3[a])*u2 + (-p0[a] + 3*p1[a] - 3*p2[a] + p3[a])*u3);
      const L = Math.hypot(q[0], q[1], q[2]) || 1; out.push([q[0]/L, q[1]/L, q[2]/L]);
    }
  }
  if (!closed){ const e = pts[n - 1], L = Math.hypot(e[0], e[1], e[2]); out.push([e[0]/L, e[1]/L, e[2]/L]); }
  return out;
};
// the same curve, resampled to an even spacing (metres) along its length
PT.evenCurve = function(pts, closed, spacing, R){ return PT.resampleLine(PT.curve(pts, closed, spacing/3, R), closed, spacing, R); };
// a line of unit directions, resampled to an even spacing (metres)
PT.resampleLine = function(raw, closed, spacing, R){
  if (raw.length < 2) return raw;
  const seq = closed ? raw.concat([raw[0]]) : raw, cum = [0];
  for (let i = 1; i < seq.length; i++){ const a = seq[i - 1], b = seq[i]; cum.push(cum[i - 1] + Math.acos(Math.min(1, a[0]*b[0] + a[1]*b[1] + a[2]*b[2]))*R); }
  const total = cum[cum.length - 1], M = Math.max(2, Math.round(total/spacing)), out = []; let j = 0;
  const count = closed ? M : M + 1;
  for (let k = 0; k < count; k++){
    const sd = k*total/M; while (j < cum.length - 2 && cum[j + 1] < sd) j++;
    const u = (sd - cum[j])/Math.max(1e-9, cum[j + 1] - cum[j]), a = seq[j], b = seq[j + 1];
    const q = [a[0] + (b[0] - a[0])*u, a[1] + (b[1] - a[1])*u, a[2] + (b[2] - a[2])*u], L = Math.hypot(q[0], q[1], q[2]);
    out.push([q[0]/L, q[1]/L, q[2]/L]);
  }
  return out;
};

// ---------- the sculpt layer: n x n heights (metres) on each cube face, sampled smoothly ----------
PT.newSculpt = n => ({ n, data: new Float32Array(6*n*n) });
PT.sampleSculpt = function(sc, x, y, z){
  if (!sc) return 0;
  const [f, u, v] = PT.faceUV(x, y, z), n = sc.n, gx = (u + 1)/2*(n - 1), gy = (v + 1)/2*(n - 1);
  const i = Math.min(n - 2, Math.floor(gx)), j = Math.min(n - 2, Math.floor(gy)), fx = gx - i, fy = gy - j, o = f*n*n, d = sc.data;
  const a = d[o + j*n + i], b = d[o + j*n + i + 1], c = d[o + (j + 1)*n + i], e = d[o + (j + 1)*n + i + 1];
  return (a*(1 - fx) + b*fx)*(1 - fy) + (c*(1 - fx) + e*fx)*fy;
};
// ---------- the detail layer: n x n points per cube face (1024: about a metre apart), kept in 32 x 32 tiles, only
// where painted ----------
const DT = 32;
PT.newDetail = n => ({ n: n || 1024, tiles: new Map() });
const dKey = (dl, f, ti, tj) => (f*(dl.n/DT) + tj)*(dl.n/DT) + ti;
PT.detailGet = function(dl, f, i, j){ const t = dl.tiles.get(dKey(dl, f, i >> 5, j >> 5)); return t ? t[(j & 31)*DT + (i & 31)] : 0; };
PT.detailAdd = function(dl, f, i, j, v){
  const k = dKey(dl, f, i >> 5, j >> 5); let t = dl.tiles.get(k);
  if (!t){ t = new Float32Array(DT*DT); dl.tiles.set(k, t); }
  t[(j & 31)*DT + (i & 31)] += v; return t[(j & 31)*DT + (i & 31)];
};
PT.sampleDetail = function(dl, x, y, z){
  if (!dl || !dl.tiles.size) return 0;
  const [f, u, v] = PT.faceUV(x, y, z), n = dl.n, gx = (u + 1)/2*(n - 1), gy = (v + 1)/2*(n - 1);
  const i = Math.min(n - 2, Math.floor(gx)), j = Math.min(n - 2, Math.floor(gy));
  // nothing painted in this tile or its neighbours: skip the lookups
  const ti0 = i >> 5, ti1 = (i + 1) >> 5, tj0 = j >> 5, tj1 = (j + 1) >> 5, T = dl.tiles;
  if (!T.has(dKey(dl, f, ti0, tj0)) && !T.has(dKey(dl, f, ti1, tj0)) && !T.has(dKey(dl, f, ti0, tj1)) && !T.has(dKey(dl, f, ti1, tj1))) return 0;
  const fx = gx - i, fy = gy - j, g = (a, b) => PT.detailGet(dl, f, a, b);
  return (g(i, j)*(1 - fx) + g(i + 1, j)*fx)*(1 - fy) + (g(i, j + 1)*(1 - fx) + g(i + 1, j + 1)*fx)*fy;
};
// ---------- seams: the points along a cube-face edge are kept twice (once on each face; three times at a corner). they
// must hold the same height or the ground steps where the faces meet. weld: set every twin to their average. with
// `heal` rows, the change at the edge is eased back into each face over that many rows, so an old step becomes a slope
const FAX = [[0, 1, 2, 1], [0, 1, 2, -1], [1, 0, 2, 1], [1, 0, 2, -1], [2, 0, 1, 1], [2, 0, 1, -1]];   // normal axis, u axis, v axis, sign
const twinCache = new Map();
// groups of [face, i, j, inward di, inward dj] that are the same point, for an n x n grid per face
function twinGroups(n){
  if (twinCache.has(n)) return twinCache.get(n);
  const seen = new Set(), groups = [], q = [0, 0, 0], key = (f, i, j) => (f*n + j)*n + i;
  for (let f = 0; f < 6; f++) for (let j = 0; j < n; j++) for (let i = 0; i < n; i++){
    if (i && j && i < n - 1 && j < n - 1) continue;
    if (seen.has(key(f, i, j))) continue;
    PT.dirFromFace(f, -1 + 2*i/(n - 1), -1 + 2*j/(n - 1), q);
    const m = Math.max(Math.abs(q[0]), Math.abs(q[1]), Math.abs(q[2])), g = [];
    for (let f2 = 0; f2 < 6; f2++){
      const [na, ua, va, sg] = FAX[f2], comp = q[na]*sg; if (comp < m - 1e-9) continue;
      const i2 = Math.round((q[ua]/comp + 1)/2*(n - 1)), j2 = Math.round((q[va]/comp + 1)/2*(n - 1));
      seen.add(key(f2, i2, j2));
      g.push([f2, i2, j2, i2 === 0 ? 1 : i2 === n - 1 ? -1 : 0, j2 === 0 ? 1 : j2 === n - 1 ? -1 : 0]);
    }
    if (g.length > 1) groups.push(g);
  }
  twinCache.set(n, groups); return groups;
}
function weld(n, get, add, heal){
  let worst = 0;
  for (const g of twinGroups(n)){
    let sum = 0; const v = g.map(([f, i, j]) => { const x = get(f, i, j); sum += x; return x; }); const avg = sum/g.length;
    g.forEach(([f, i, j, di, dj], k) => {
      const dv = avg - v[k]; if (Math.abs(dv) < 1e-4) return; worst = Math.max(worst, Math.abs(dv));
      add(f, i, j, dv);
      // ease it in along the row going into the face (a corner point only along one of its two edges)
      if (heal) for (let r = 1; r < heal; r++){ const ii = i + di*r, jj = j + (di ? 0 : dj*r); if (ii < 0 || jj < 0 || ii >= n || jj >= n) break; add(f, ii, jj, dv*(1 - r/heal)*(1 - r/heal)); }
    });
  }
  return worst;
}
// returns the biggest correction made (metres)
PT.weldSculpt = function(sc, heal){ const n = sc.n, d = sc.data; return weld(n, (f, i, j) => d[(f*n + j)*n + i], (f, i, j, v) => { d[(f*n + j)*n + i] += v; }, heal || 0); };
PT.weldDetail = function(dl, heal){ if (!dl.tiles.size) return 0; return weld(dl.n, (f, i, j) => PT.detailGet(dl, f, i, j), (f, i, j, v) => PT.detailAdd(dl, f, i, j, v), heal || 0); };
PT.cloneDetail = dl => ({ n: dl.n, tiles: new Map([...dl.tiles].map(([k, t]) => [k, t.slice()])) });
function b64FromBytes(bytes){ let s = ''; for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000)); return btoa(s); }
function bytesFromB64(b){ const s = atob(b), out = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i); return out; }
PT.encodeDetail = function(dl){
  const tiles = [];
  for (const [k, t] of dl.tiles){
    const q = new Int16Array(t.length); let any = false;
    for (let i = 0; i < q.length; i++){ q[i] = Math.max(-32767, Math.min(32767, Math.round(t[i]*100))); if (q[i]) any = true; }
    if (any) tiles.push([k, b64FromBytes(new Uint8Array(q.buffer))]);
  }
  return { n: dl.n, tiles };
};
PT.decodeDetail = function(o){
  const dl = PT.newDetail(o && o.n || 1024);
  if (o && o.tiles) for (const [k, b] of o.tiles){ const q = new Int16Array(bytesFromB64(b).buffer), t = new Float32Array(DT*DT); for (let i = 0; i < t.length; i++) t[i] = q[i]/100; dl.tiles.set(k, t); }
  return dl;
};
PT.encodeSculpt = function(sc){
  const q = new Int16Array(sc.data.length); let any = false;
  for (let i = 0; i < q.length; i++){ const v = Math.round(sc.data[i]*100); q[i] = Math.max(-32767, Math.min(32767, v)); if (q[i]) any = true; }
  return any ? { n: sc.n, cm: b64FromBytes(new Uint8Array(q.buffer)) } : { n: sc.n };
};
PT.decodeSculpt = function(o){
  const sc = PT.newSculpt(o && o.n || 128);
  if (o && o.cm){ const q = new Int16Array(bytesFromB64(o.cm).buffer); for (let i = 0; i < Math.min(q.length, sc.data.length); i++) sc.data[i] = q[i]/100; }
  return sc;
};

// ---------- trail carving ----------
// bed: half-width of the level bed (m). shoulder: how far it blends back to the land (m). smooth: how far along the line
// its height is averaged (m). maxGrade: the steepest the bed may climb or drop (0.2 = 20%)
PT.carveDefaults = () => ({ carve: true, bed: 4, shoulder: 10, smooth: 40, maxGrade: 0.2 });
const pick = (o, keys) => { const r = {}; for (const k of keys) if (o[k] !== undefined && o[k] !== null && isFinite(o[k])) r[k] = +o[k]; return r; };
// the bed's height along a trail: the ground under it, averaged over `smooth` metres, then held to the steepest grade
function carveProfile(pts, closed, under, smooth, maxGrade, step){
  const M = pts.length, raw = new Float64Array(M);
  for (let i = 0; i < M; i++) raw[i] = under(pts[i][0], pts[i][1], pts[i][2]);
  const w = Math.max(0, Math.round(smooth/2/step)), prof = new Float64Array(M);
  for (let i = 0; i < M; i++){
    let sum = 0, n = 0;
    for (let k = -w; k <= w; k++){ let j = i + k; if (closed) j = (j % M + M) % M; else if (j < 0 || j >= M) continue; const wt = 1 - Math.abs(k)/(w + 1); sum += raw[j]*wt; n += wt; }
    prof[i] = sum/n;
  }
  // hold the grade: relax forward and back a few times (round the loop, for a closed trail)
  const g = Math.max(0.01, maxGrade)*step;
  for (let it = 0; it < 4; it++){
    for (let i = 1; i < M + (closed ? M : 0); i++){ const a = prof[(i - 1) % M], j = i % M; prof[j] = Math.max(a - g, Math.min(a + g, prof[j])); }
    for (let i = M - 2 + (closed ? M : 0); i >= 0; i--){ const a = prof[(i + 1) % M], j = i % M; prof[j] = Math.max(a - g, Math.min(a + g, prof[j])); }
  }
  return prof;
}
// a cube-sphere grid for finding the carved segments near a point (cells about 12 m across)
function carveGrid(R){
  const G = Math.max(16, Math.min(256, Math.round(Math.PI/2*R/12)));
  return { G, map: new Map(), key(x, y, z){ const [f, u, v] = PT.faceUV(x, y, z); return (f*G + Math.min(G - 1, Math.floor((u + 1)/2*G)))*G + Math.min(G - 1, Math.floor((v + 1)/2*G)); } };
}

// ---------- light bridges ----------
PT.bridgeDefaults = () => ({ clearance: 10, ramp: 50, width: 2.5, maxGrade: 0.25 });
// the deck along a bridge: points 2 m apart (unit directions), the deck's and the ground's height at each (metres above
// the base radius), the distance along it, and its length. `height(x, y, z)` is the ground (terrain.height)
PT.bridgeDeck = function(b, height, R){
  const STEP = 2, pts = PT.evenCurve(b.pts, false, STEP, R), M = pts.length;
  const g = new Float64Array(M), s = new Float64Array(M), h = new Float64Array(M);
  for (let i = 0; i < M; i++){ g[i] = height(pts[i][0], pts[i][1], pts[i][2]); if (i) s[i] = s[i - 1] + Math.acos(Math.min(1, pts[i][0]*pts[i - 1][0] + pts[i][1]*pts[i - 1][1] + pts[i][2]*pts[i - 1][2]))*R; }
  const L = s[M - 1], C = Math.max(1, b.clearance ?? 10), W = 4, A = 10;
  // clear the highest ground a little either way, then even it out along the line, never closer than 60% of the clearance
  const top = new Float64Array(M);
  for (let i = 0; i < M; i++){ let m = -Infinity; for (let j = Math.max(0, i - W); j <= Math.min(M - 1, i + W); j++) m = Math.max(m, g[j]); top[i] = m + C; }
  for (let i = 0; i < M; i++){ let sum = 0, n = 0; for (let j = Math.max(0, i - A); j <= Math.min(M - 1, i + A); j++){ sum += top[j]; n++; } h[i] = Math.max(sum/n, g[i] + C*0.6); }
  // descents no steeper than maxGrade: raise the low points (forward and back)
  const G = Math.max(0.02, b.maxGrade ?? 0.25);
  for (let it = 0; it < 2; it++){
    for (let i = 1; i < M; i++) h[i] = Math.max(h[i], h[i - 1] - G*(s[i] - s[i - 1]));
    for (let i = M - 2; i >= 0; i--) h[i] = Math.max(h[i], h[i + 1] - G*(s[i + 1] - s[i]));
  }
  // the ramps: up from each foot at clearance/ramp, until they meet the deck
  const k = C/Math.max(5, b.ramp ?? 50);
  // (where the ground climbs faster than a ramp can, the deck keeps 1.5 m over it, less only right at the feet)
  for (let i = 0; i < M; i++) h[i] = Math.max(g[i] + Math.min(1.5, 0.3*Math.min(s[i], L - s[i])), Math.min(h[i], g[0] + s[i]*k, g[M - 1] + (L - s[i])*k));
  let climb = 0, desc = 0, high = 0;
  for (let i = 1; i < M; i++){ const gr = (h[i] - h[i - 1])/Math.max(1e-6, s[i] - s[i - 1]); climb = Math.max(climb, gr); desc = Math.max(desc, -gr); high = Math.max(high, h[i] - g[i]); }
  return { pts, g, s, h, L, width: Math.max(0.8, b.width ?? 2.5), rampGrade: k, climb, desc, highest: high };
};

// ---------- the trail network ----------
// join: trails closer than this (m) are made one. patch: the steep bits smaller than this across (m) are eased
PT.networkDefaults = () => ({ join: 8, patch: 15 });
const ang3 = (a, b) => Math.acos(Math.max(-1, Math.min(1, a[0]*b[0] + a[1]*b[1] + a[2]*b[2])));
// a spatial hash of a line's points (cells `cell` metres), for finding the nearest point of the line quickly
function lineHash(pts, R, cell){
  const map = new Map(), k = (x, y, z) => Math.floor(x*R/cell) + ',' + Math.floor(y*R/cell) + ',' + Math.floor(z*R/cell);
  pts.forEach((p, i) => { const key = k(p[0], p[1], p[2]); let l = map.get(key); if (!l) map.set(key, l = []); l.push(i); });
  return { map, cell, R, pts, near(p){
    const cx = Math.floor(p[0]*R/cell), cy = Math.floor(p[1]*R/cell), cz = Math.floor(p[2]*R/cell), out = [];
    for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) for (let c = -1; c <= 1; c++){ const l = map.get((cx + a) + ',' + (cy + b) + ',' + (cz + c)); if (l) for (const i of l) out.push(i); }
    return out;
  } };
}
// the nearest point of a line (within about a cell): distance (m), the point, its direction along the line, where (k, u)
function nearestOn(H, p, closed){
  const P = H.pts, M = P.length, R = H.R; let best = null;
  for (const i of H.near(p)) for (const k of [i - 1, i]){
    if (k < 0 && !closed) continue; const k0 = (k + M) % M, k1 = (k0 + 1) % M; if (!closed && k0 === M - 1) continue;
    const a = P[k0], b = P[k1], ex = b[0] - a[0], ey = b[1] - a[1], ez = b[2] - a[2], L2 = ex*ex + ey*ey + ez*ez || 1e-18;
    const u = Math.max(0, Math.min(1, ((p[0] - a[0])*ex + (p[1] - a[1])*ey + (p[2] - a[2])*ez)/L2));
    const q = [a[0] + ex*u, a[1] + ey*u, a[2] + ez*u], d = Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2])*R;
    if (!best || d < best.d){ const Ll = Math.sqrt(L2); best = { d, q, t: [ex/Ll, ey/Ll, ez/Ll], k: k0, u }; }
  }
  if (best){ const l = Math.hypot(...best.q); best.q = best.q.map(v => v/l); }
  return best;
}
const tangentAt = (P, i, closed) => {
  const M = P.length, a = closed ? P[(i + 1) % M] : P[Math.min(M - 1, i + 1)], b = closed ? P[(i - 1 + M) % M] : P[Math.max(0, i - 1)];
  const t = [a[0] - b[0], a[1] - b[1], a[2] - b[2]], l = Math.hypot(...t) || 1; return [t[0]/l, t[1]/l, t[2]/l];
};
// every trail as an even line of points `spacing` m apart, with the runs where a trail goes alongside an earlier one
// (within `join` m, for at least twice that, roughly the same way) pulled onto it, eased in and out over 2 x join.
// shared[t][i] is 1 + the earlier trail point i of trail t now lies on (0 if none): draw it once, name both
const netCache = new Map();
PT.trailNetwork = function(trails, R, join, spacing){
  const key = JSON.stringify([R, join, spacing, trails.map(t => [t.pts, !!t.closed])]);
  if (netCache.has(key)) return netCache.get(key);
  const lines = trails.map(t => t.pts && t.pts.length >= 2 ? PT.evenCurve(t.pts, !!t.closed, spacing, R) : []);
  const shared = lines.map(l => new Uint8Array(l.length)), merged = [];
  if (join > 0) for (let b = 1; b < lines.length; b++){
    const closed = !!trails[b].closed;
    for (let a = 0; a < b; a++){
      const A = lines[a], B = lines[b], M = B.length; if (A.length < 2 || M < 3) continue;
      const H = lineHash(A, R, Math.max(4, join*1.5)), raw = new Uint8Array(M), Q = new Array(M);
      for (let i = 0; i < M; i++){
        const nq = nearestOn(H, B[i], !!trails[a].closed); if (!nq || nq.d > join*3) continue;
        Q[i] = nq.q; const tb = tangentAt(B, i, closed);
        if (nq.d < join && Math.abs(tb[0]*nq.t[0] + tb[1]*nq.t[1] + tb[2]*nq.t[2]) > 0.8) raw[i] = 1;
      }
      // keep only the runs at least 2 x join long (so a crossing stays a crossing)
      const need = Math.max(2, Math.round(2*join/spacing)); let any = false, start = 0;
      if (closed){ start = raw.indexOf(0); if (start < 0) start = 0; }
      for (let s0 = 0; s0 < M; ){
        const i0 = (start + s0) % M; if (!raw[i0]){ s0++; continue; }
        let len = 0; while (s0 + len < M && raw[(start + s0 + len) % M]) len++;
        if (len < need) for (let k = 0; k < len; k++) raw[(start + s0 + k) % M] = 0; else any = true;
        s0 += len;
      }
      if (!any) continue;
      // ease: a running average of the runs, then smoothstep
      const E = Math.max(1, Math.round(2*join/spacing)), w = new Float64Array(M);
      for (let i = 0; i < M; i++){
        let sum = 0, n = 0;
        for (let k = -E; k <= E; k++){ let j = i + k; if (closed) j = (j % M + M) % M; else if (j < 0 || j >= M) continue; sum += raw[j]; n++; }
        const t = Math.min(1, 2*sum/n); w[i] = t*t*(3 - 2*t);
      }
      for (let i = 0; i < M; i++) if (w[i] > 0 && Q[i]){
        const p = B[i], q = Q[i], x = p[0] + (q[0] - p[0])*w[i], y = p[1] + (q[1] - p[1])*w[i], z = p[2] + (q[2] - p[2])*w[i], l = Math.hypot(x, y, z);
        B[i] = [x/l, y/l, z/l];
      }
      lines[b] = PT.resampleLine(B, closed, spacing, R);
      merged.push([a, b]);
    }
    // which of its points now lie on an earlier trail
    const B = lines[b], sh = shared[b] = new Uint8Array(B.length);
    for (let a = 0; a < b; a++){
      if (lines[a].length < 2) continue; const H = lineHash(lines[a], R, 4);
      for (let i = 0; i < B.length; i++){ if (sh[i]) continue; const nq = nearestOn(H, B[i], !!trails[a].closed); if (nq && nq.d < 0.3) sh[i] = a + 1; }
    }
  }
  const out = { lines, shared, merged };
  if (netCache.size > 6) netCache.delete(netCache.keys().next().value);
  netCache.set(key, out); return out;
};

// ---------- cleanup: what a layout's trails and steep bits need before skiing ----------
// thin crowded points, join a trail's ends into a loop when they meet, bring control points of different trails that
// nearly meet together (a junction), snap loose ends onto the trail they stop short of, and ease the small patches of
// ground too steep to ski (leaving painted cliffs alone). returns a new layout and what changed
PT.cleanup = function(L0, opt){
  const L = PT.parse(PT.serialize(L0)), R = L.radius, net = Object.assign(PT.networkDefaults(), L.network || {}, opt || {});
  const join = net.join, rep = { thinned: 0, closed: 0, junctions: 0, ends: 0, patches: 0, patchesLeft: 0 };
  const dist = (a, b) => ang3(a, b)*R;
  if (join > 0){
    // thin: drop a point closer than join/2 to the last one kept (an open trail keeps its ends)
    for (const t of L.trails){
      const P = t.pts, min = t.closed ? 3 : 2; if (P.length <= min) continue;
      const keep = [P[0]];
      for (let i = 1; i < P.length; i++){
        const last = !t.closed && i === P.length - 1;
        if (dist(P[i], keep[keep.length - 1]) >= join/2) keep.push(P[i]);
        else if (last && keep.length > 1) keep[keep.length - 1] = P[i];
        else if (last) keep.push(P[i]);
      }
      if (t.closed && keep.length > min && dist(keep[keep.length - 1], keep[0]) < join/2) keep.pop();
      if (keep.length >= min && keep.length < P.length){ rep.thinned += P.length - keep.length; t.pts = keep; }
    }
    // an open trail whose ends meet becomes a loop
    for (const t of L.trails) if (!t.closed && t.pts.length >= 4 && dist(t.pts[0], t.pts[t.pts.length - 1]) < join){ t.pts.pop(); t.closed = true; rep.closed++; }
    // junctions: control points of different trails within join of each other move to where they meet
    const all = []; L.trails.forEach((t, ti) => t.pts.forEach((p, pi) => all.push([ti, pi])));
    const par = all.map((_, i) => i), find = i => par[i] === i ? i : (par[i] = find(par[i]));
    for (let i = 0; i < all.length; i++) for (let j = i + 1; j < all.length; j++){
      const [ti, pi] = all[i], [tj, pj] = all[j]; if (ti === tj) continue;
      if (dist(L.trails[ti].pts[pi], L.trails[tj].pts[pj]) < join) par[find(i)] = find(j);
    }
    const groups = new Map(); all.forEach((_, i) => { const r = find(i); if (!groups.has(r)) groups.set(r, []); groups.get(r).push(all[i]); });
    const inJunction = new Set();
    for (const g of groups.values()){
      if (g.length < 2) continue;
      const c = [0, 0, 0]; for (const [ti, pi] of g){ const p = L.trails[ti].pts[pi]; c[0] += p[0]; c[1] += p[1]; c[2] += p[2]; }
      const l = Math.hypot(...c), q = [c[0]/l, c[1]/l, c[2]/l]; let moved = false;
      for (const [ti, pi] of g){ if (dist(L.trails[ti].pts[pi], q) > 0.01) moved = true; L.trails[ti].pts[pi] = q.slice(); inJunction.add(ti + ':' + pi); }
      if (moved) rep.junctions++;
    }
    // loose ends: an open trail's end within join of another trail (and not already at a junction) goes onto it
    const lines = L.trails.map(t => t.pts.length >= 2 ? PT.evenCurve(t.pts, !!t.closed, 1, R) : []), hashes = lines.map(l => l.length ? lineHash(l, R, Math.max(4, join*1.5)) : null);
    L.trails.forEach((t, ti) => {
      if (t.closed || t.pts.length < 2) return;
      for (const pi of [0, t.pts.length - 1]){
        if (inJunction.has(ti + ':' + pi)) continue;
        let best = null;
        L.trails.forEach((o, oi) => { if (oi === ti || !hashes[oi]) return; const nq = nearestOn(hashes[oi], t.pts[pi], !!o.closed); if (nq && nq.d < join && nq.d > 0.05 && (!best || nq.d < best.d)) best = nq; });
        if (best){ t.pts[pi] = best.q; rep.ends++; }
      }
    });
  }
  if (net.patch > 0){ const r = easePatches(L, R, net.patch); rep.patches = r.eased; rep.patchesLeft = r.left; }
  return { L, report: rep };
};
PT.cleanupSummary = function(r){
  const parts = [];
  if (r.thinned) parts.push(r.thinned + ' crowded point' + (r.thinned > 1 ? 's' : '') + ' thinned');
  if (r.closed) parts.push(r.closed + ' trail' + (r.closed > 1 ? 's' : '') + ' closed into a loop');
  if (r.junctions) parts.push(r.junctions + ' junction' + (r.junctions > 1 ? 's' : '') + ' joined');
  if (r.ends) parts.push(r.ends + ' loose end' + (r.ends > 1 ? 's' : '') + ' snapped on');
  if (r.patches) parts.push(r.patches + ' small steep patch' + (r.patches > 1 ? 'es' : '') + ' eased');
  if (r.patchesLeft) parts.push(r.patchesLeft + ' left steep (too big or painted cliffs)');
  return parts.length ? parts.join(', ') : 'nothing needed tidying';
};
// find the patches of ground too steep to ski (on a grid about 5 m apart), and those smaller than `size` across that
// aren't painted cliffs, ease: on the detail layer, relax the ground there a little at a time until it's just under
// the ski limit, fading out round the patch
function easePatches(L, R, size){
  const T = PT.terrain(L, R), stop = T.stop, n = Math.max(48, Math.min(640, Math.round(Math.PI/2*R/2.5))), N2 = n*n;
  const H = new Float32Array(6*N2), D = new Float32Array(6*N2*3), q = [0, 0, 0];
  for (let f = 0; f < 6; f++) for (let j = 0; j < n; j++) for (let i = 0; i < n; i++){
    PT.dirFromFace(f, -1 + 2*i/(n - 1), -1 + 2*j/(n - 1), q); const o = f*N2 + j*n + i;
    D[o*3] = q[0]; D[o*3 + 1] = q[1]; D[o*3 + 2] = q[2]; H[o] = T.height(q[0], q[1], q[2]);
  }
  const dir = o => [D[o*3], D[o*3 + 1], D[o*3 + 2]];
  const grade = new Float32Array(6*N2);
  for (let f = 0; f < 6; f++) for (let j = 0; j < n; j++) for (let i = 0; i < n; i++){
    const o = f*N2 + j*n + i, i0 = Math.max(0, i - 1), i1 = Math.min(n - 1, i + 1), j0 = Math.max(0, j - 1), j1 = Math.min(n - 1, j + 1);
    const a = f*N2 + j*n + i0, b = f*N2 + j*n + i1, c = f*N2 + j0*n + i, d = f*N2 + j1*n + i;
    const gx = (H[b] - H[a])/(ang3(dir(a), dir(b))*R), gy = (H[d] - H[c])/(ang3(dir(c), dir(d))*R);
    grade[o] = Math.hypot(gx, gy);
  }
  // the steep points, joined into patches (across face edges too)
  const lim = stop*0.75, par = new Int32Array(6*N2).map((_, i) => i), find = i => { while (par[i] !== i){ par[i] = par[par[i]]; i = par[i]; } return i; };
  const steep = i => grade[i] > lim, uni = (a, b) => { a = find(a); b = find(b); if (a !== b) par[a] = b; };
  for (let f = 0; f < 6; f++) for (let j = 0; j < n; j++) for (let i = 0; i < n; i++){
    const o = f*N2 + j*n + i; if (!steep(o)) continue;
    if (i + 1 < n && steep(o + 1)) uni(o, o + 1); if (j + 1 < n && steep(o + n)) uni(o, o + n);
    if (i + 1 < n && j + 1 < n && steep(o + n + 1)) uni(o, o + n + 1); if (i > 0 && j + 1 < n && steep(o + n - 1)) uni(o, o + n - 1);
  }
  for (const g of twinGroups(n)) for (let k = 1; k < g.length; k++){ const a = g[0][0]*N2 + g[0][2]*n + g[0][1], b = g[k][0]*N2 + g[k][2]*n + g[k][1]; if (steep(a) && steep(b)) uni(a, b); }
  const comps = new Map();
  for (let o = 0; o < 6*N2; o++) if (steep(o)){ const r = find(o); let c = comps.get(r); if (!c) comps.set(r, c = []); c.push(o); }
  const dl = L.detail; let eased = 0, left = 0;
  for (const c of comps.values()){
    let top = 0; for (const o of c) top = Math.max(top, grade[o]);
    if (top < stop*0.9) continue;                                               // never quite unskiable here
    const m = [0, 0, 0]; for (const o of c){ m[0] += D[o*3]; m[1] += D[o*3 + 1]; m[2] += D[o*3 + 2]; }
    const ml = Math.hypot(...m), cen = [m[0]/ml, m[1]/ml, m[2]/ml]; let rad = 0; for (const o of c) rad = Math.max(rad, ang3(cen, dir(o))*R);
    if (2*rad + 5 > size){ left++; continue; }                                  // a real slope: leave it
    let painted = false; for (const o of c){ const p = dir(o); if (Math.abs(PT.sampleDetail(dl, p[0], p[1], p[2])) > 0.05){ painted = true; break; } }
    if (painted){ left++; continue; }                                           // a cliff-erator cliff: leave it
    if (easeAt(T, dl, cen, rad + 3, Math.max(5, size*0.4), stop, R)) eased++;
  }
  PT.weldDetail(dl);
  return { eased, left };
}
// relax the ground on the detail grid within `core` m of cen (fading to nothing `margin` m further out) until no
// point in the core is steeper than 80% of the limit (node to node, about a metre)
function easeAt(T, dl, cen, core, margin, stop, R){
  const [f, u, v] = PT.faceUV(cen[0], cen[1], cen[2]), n = dl.n, ci = (u + 1)/2*(n - 1), cj = (v + 1)/2*(n - 1);
  const rr = core + margin, half = Math.ceil(rr/R*(n - 1)/2*1.6) + 2;
  const i0 = Math.max(0, Math.floor(ci - half)), i1 = Math.min(n - 1, Math.ceil(ci + half)), j0 = Math.max(0, Math.floor(cj - half)), j1 = Math.min(n - 1, Math.ceil(cj + half));
  const W = i1 - i0 + 1, Hh = j1 - j0 + 1, h0 = new Float64Array(W*Hh), wt = new Float64Array(W*Hh), q = [0, 0, 0];
  for (let j = 0; j < Hh; j++) for (let i = 0; i < W; i++){
    PT.dirFromFace(f, -1 + 2*(i0 + i)/(n - 1), -1 + 2*(j0 + j)/(n - 1), q); const k = j*W + i, d = ang3(q, cen)*R;
    h0[k] = T.height(q[0], q[1], q[2]); const t = d <= core ? 0 : Math.min(1, (d - core)/margin); wt[k] = 1 - t*t*(3 - 2*t);
  }
  // node spacing (m) across and along, at the middle
  const mid = (a, b) => { const p = [0, 0, 0], r = [0, 0, 0]; PT.dirFromFace(f, -1 + 2*a/(n - 1), -1 + 2*b/(n - 1), p); return p; };
  const sx = ang3(mid(ci, cj), mid(ci + 1, cj))*R, sy = ang3(mid(ci, cj), mid(ci, cj + 1))*R;
  const h = h0.slice(), worst = () => { let g = 0; for (let j = 1; j < Hh - 1; j++) for (let i = 1; i < W - 1; i++){ const k = j*W + i; if (wt[k] < 0.99) continue; g = Math.max(g, Math.hypot((h[k + 1] - h[k])/sx, (h[k + W] - h[k])/sy), Math.hypot((h[k] - h[k - 1])/sx, (h[k] - h[k - W])/sy)); } return g; };
  if (worst() <= stop) return false;
  for (let it = 0; it < 200 && worst() > stop*0.8; it++){
    const o = h.slice();
    for (let j = 1; j < Hh - 1; j++) for (let i = 1; i < W - 1; i++){ const k = j*W + i; if (!wt[k]) continue; h[k] += 0.5*wt[k]*((o[k - 1] + o[k + 1] + o[k - W] + o[k + W])/4 - o[k]); }
  }
  for (let j = 0; j < Hh; j++) for (let i = 0; i < W; i++){ const k = j*W + i, d = h[k] - h0[k]; if (Math.abs(d) > 0.005) PT.detailAdd(dl, f, i0 + i, j0 + j, d); }
  return true;
}

// ---------- layouts ----------
const norm = p => { const L = Math.hypot(p[0], p[1], p[2]) || 1; return [p[0]/L, p[1]/L, p[2]/L]; };
PT.START = norm([0.15, 1, 0.25]);
PT.cliffDefaults = () => ({ from: 0.6, band: 12, sharp: 8, stop: 1.0 });
PT.blankLayout = R => ({ version: 1, name: 'Untitled planet', radius: R || 800, noise: { amp: 1 }, stamps: [], sculpt: PT.newSculpt(128), detail: PT.newDetail(1024), trails: [], landmarks: [], bridges: [], start: { d: PT.START.slice() }, scatter: { mountains: 0, buildings: 1, trees: 1 }, cliffs: PT.cliffDefaults(), network: PT.networkDefaults() });
// a small example so every tool has something to show: a peak, a ridge, a crater, a basin and a trail past them
PT.exampleLayout = function(R){
  R = R || 800;
  const L = PT.blankLayout(R); L.name = 'Example planet';
  const at = (lat, lon) => { const a = lat*Math.PI/180, b = lon*Math.PI/180; return norm([Math.cos(a)*Math.sin(b), Math.sin(a), Math.cos(a)*Math.cos(b)]); };
  L.start.d = at(60, 10);
  L.stamps.push({ type: 'peak', pts: [at(52, 32)], radius: 110, height: 140, sharp: 0.55 });
  L.stamps.push({ type: 'ridge', pts: [at(70, -40), at(62, -15), at(48, -5), at(38, -25)], radius: 45, height: 35, sharp: 0.3 });
  L.stamps.push({ type: 'crater', pts: [at(35, 30)], radius: 70, height: 18, sharp: 0.4 });
  L.stamps.push({ type: 'basin', pts: [at(50, 60)], radius: 90, height: 14, sharp: 0.5 });
  L.trails.push(Object.assign({ name: 'Summit Loop', closed: true, pts: [at(60, 10), at(56, 22), at(44, 18), at(40, 2), at(48, -14), at(58, -8)] }, PT.carveDefaults()));
  L.trails.push(Object.assign({ name: 'Long Way Round', closed: true, pts: Array.from({ length: 12 }, (_, i) => at(45 + 12*Math.sin(i*1.7), i*30 + 10)) }, PT.carveDefaults()));
  L.landmarks.push({ name: 'The Spire', type: 'spire', d: at(44, 18), height: 60, color: '#8a5cd6' });
  L.landmarks.push({ name: 'Camp', type: 'camp', d: at(60, 13), height: 8, color: '#d2462e' });
  return L;
};
PT.LANDMARK_TYPES = { beacon: 'Beacon', spire: 'Spire', tower: 'Tower', camp: 'Camp', terminal: 'Terminal', altar: 'Altar', marker: 'Marker' };
// to and from JSON (the sculpt layer goes as base64 centimetres)
PT.serialize = function(L){
  const r5 = p => p.map(v => Math.round(v*1e6)/1e6);
  return JSON.stringify({
    version: 1, name: L.name, radius: L.radius, noise: { amp: L.noise.amp },
    stamps: L.stamps.map(s => ({ type: s.type, pts: s.pts.map(r5), radius: s.radius, height: s.height, sharp: s.sharp })),
    sculpt: PT.encodeSculpt(L.sculpt), detail: PT.encodeDetail(L.detail),
    trails: L.trails.map(t => ({ name: t.name, closed: !!t.closed, pts: t.pts.map(r5), carve: !!t.carve, bed: t.bed, shoulder: t.shoulder, smooth: t.smooth, maxGrade: t.maxGrade })),
    landmarks: L.landmarks.map(m => ({ name: m.name, type: m.type, d: r5(m.d), height: m.height, color: m.color })),
    bridges: (L.bridges || []).map(b => ({ name: b.name, pts: b.pts.map(r5), clearance: b.clearance, ramp: b.ramp, width: b.width, maxGrade: b.maxGrade })),
    start: { d: r5(L.start.d) }, scatter: Object.assign({}, L.scatter), cliffs: Object.assign({}, L.cliffs), network: Object.assign(PT.networkDefaults(), L.network || {}),
  });
};
PT.parse = function(json){
  const o = typeof json === 'string' ? JSON.parse(json) : json, B = PT.blankLayout(o.radius || 800);
  const L = {
    version: 1, name: o.name || B.name, radius: o.radius || 800, noise: { amp: o.noise && o.noise.amp !== undefined ? o.noise.amp : 1 },
    stamps: (o.stamps || []).map(s => ({ type: s.type, pts: s.pts.map(norm), radius: +s.radius, height: +s.height, sharp: s.sharp ?? 0.3 })),
    sculpt: PT.decodeSculpt(o.sculpt), detail: PT.decodeDetail(o.detail),
    trails: (o.trails || []).map(t => Object.assign({ name: t.name || 'Trail', closed: !!t.closed, pts: t.pts.map(norm) }, PT.carveDefaults(), { carve: !!t.carve }, pick(t, ['bed', 'shoulder', 'smooth', 'maxGrade']))),
    landmarks: (o.landmarks || []).map(m => ({ name: m.name || 'Landmark', type: m.type || 'marker', d: norm(m.d), height: +m.height || 10, color: m.color || '#d2462e' })),
    bridges: (o.bridges || []).filter(b => b.pts && b.pts.length >= 2).map(b => Object.assign({ name: b.name || 'Light bridge', pts: b.pts.map(norm) }, PT.bridgeDefaults(), pick(b, ['clearance', 'ramp', 'width', 'maxGrade']))),
    start: { d: norm(o.start && o.start.d || B.start.d) }, scatter: Object.assign({}, B.scatter, o.scatter || {}),
    cliffs: Object.assign(PT.cliffDefaults(), pick(o.cliffs || {}, ['from', 'band', 'sharp', 'stop'])),
    network: Object.assign(PT.networkDefaults(), pick(o.network || {}, ['join', 'patch'])),
  };
  // older layouts may have steps where the cube faces meet: weld them, easing the change back into each face
  PT.weldSculpt(L.sculpt, 3); PT.weldDetail(L.detail, 8);
  return L;
};

// ---------- the ground: height (metres above the base radius) at a unit direction ----------
// with no layout it's the procedural planet. R may differ from the layout's radius (stamps stay in metres)
PT.terrain = function(L, R){
  const amp = L ? L.noise.amp : 1, stamps = L ? L.stamps.filter(s => s.pts && s.pts.length).map(s => compileStamp(s, R)) : [], sc = L ? L.sculpt : null;
  // everything but the trails' carving
  const shaped = (x, y, z) => { let h = amp ? amp*PT.baseNoise(x, y, z, R) : 0; for (let i = 0; i < stamps.length; i++) h += stampAt(stamps[i], x, y, z, R); return h; };
  const dl = L && L.detail && L.detail.tiles.size ? L.detail : null;
  const under = (x, y, z) => shaped(x, y, z) + (sc ? PT.sampleSculpt(sc, x, y, z) : 0) + (dl ? PT.sampleDetail(dl, x, y, z) : 0);
  // carved trails: each one's line (2 m apart) and bed profile, and a grid of its segments
  const carves = [], grid = carveGrid(R), STEP = 2;
  // the trails as one network (runs alongside each other made one), so carved beds that share ground agree
  const join = L && L.network ? L.network.join : 0, net = L && L.trails.length ? PT.trailNetwork(L.trails, R, join, STEP) : null;
  if (L) L.trails.forEach((t, ti) => {
    if (!t.carve || !t.pts || t.pts.length < 2) return;
    const pts = net.lines[ti], M = pts.length; if (M < 2) return;
    const c = { ti, pts, closed: !!t.closed, M, bed: Math.max(0.5, t.bed ?? 4), sh: Math.max(0.5, t.shoulder ?? 10), smooth: t.smooth ?? 40, P: new Float64Array(M*3),
      prof: carveProfile(pts, !!t.closed, under, t.smooth ?? 40, t.maxGrade ?? 0.2, STEP) };
    pts.forEach((p, i) => { c.P[i*3] = p[0]; c.P[i*3 + 1] = p[1]; c.P[i*3 + 2] = p[2]; });
    const ci = carves.length; carves.push(c);
    const reach = c.bed + c.sh + 1, segN = c.closed ? M : M - 1, q = [0, 0, 0];
    for (let k = 0; k < segN; k++){
      const a = pts[k], b = pts[(k + 1) % M], m = [a[0] + b[0], a[1] + b[1], a[2] + b[2]], Lm = Math.hypot(m[0], m[1], m[2]); m[0] /= Lm; m[1] /= Lm; m[2] /= Lm;
      const ax = Math.abs(m[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
      const t1 = [ax[1]*m[2] - ax[2]*m[1], ax[2]*m[0] - ax[0]*m[2], ax[0]*m[1] - ax[1]*m[0]], L1 = Math.hypot(t1[0], t1[1], t1[2]); t1[0] /= L1; t1[1] /= L1; t1[2] /= L1;
      const t2 = [m[1]*t1[2] - m[2]*t1[1], m[2]*t1[0] - m[0]*t1[2], m[0]*t1[1] - m[1]*t1[0]];
      const keys = new Set([grid.key(m[0], m[1], m[2])]);
      for (const rr of [reach/2, reach]) for (let i = 0; i < 12; i++){
        const an = i/12*Math.PI*2, ox = Math.cos(an)*rr/R, oy = Math.sin(an)*rr/R;
        q[0] = m[0] + t1[0]*ox + t2[0]*oy; q[1] = m[1] + t1[1]*ox + t2[1]*oy; q[2] = m[2] + t1[2]*ox + t2[2]*oy; keys.add(grid.key(q[0], q[1], q[2]));
      }
      for (const key of keys){ let l = grid.map.get(key); if (!l) grid.map.set(key, l = []); l.push(ci, k); }
    }
  });
  // junctions: where a carved trail meets or runs along an earlier one, its bed takes the earlier one's height there,
  // eased back to its own over its smoothing length either side
  for (let b = 1; b < carves.length; b++){
    const B = carves[b], cor = new Float64Array(B.M), has = new Uint8Array(B.M);
    for (let a = 0; a < b; a++){
      const A = carves[a], H = lineHash(A.pts, R, Math.max(4, A.bed + B.bed));
      for (let i = 0; i < B.M; i++){
        const nq = nearestOn(H, B.pts[i], A.closed); if (!nq || nq.d > Math.min(A.bed, B.bed)) continue;
        const k2 = (nq.k + 1) % A.M; cor[i] = A.prof[nq.k] + (A.prof[k2] - A.prof[nq.k])*nq.u - B.prof[i]; has[i] = 1;
      }
    }
    if (!has.some(x => x)) continue;
    // spread: each point takes the correction of the nearest junction point along the line, faded by distance
    const span = Math.max(20, B.smooth)/STEP, M = B.M, out = new Float64Array(M), dist = new Float64Array(M).fill(Infinity), val = new Float64Array(M);
    const sweep = (dirn) => {
      let d = Infinity, v = 0; const n = B.closed ? 2*M : M;
      for (let s = 0; s < n; s++){ const i = dirn > 0 ? s % M : (M - 1 - (s % M)); if (has[i]){ d = 0; v = cor[i]; } else d++; if (d < dist[i]){ dist[i] = d; val[i] = v; } }
    };
    sweep(1); sweep(-1);
    for (let i = 0; i < M; i++){ const t = Math.min(1, dist[i]/span), w = 1 - t*t*(3 - 2*t); B.prof[i] += val[i]*w; }
  }
  // the bed under a point: the carved trail it's most inside (distance across, the bed's height there)
  const carveAt = (x, y, z) => {
    const list = grid.map.get(grid.key(x, y, z)); if (!list) return null;
    let best = null, bs = Infinity;
    for (let i = 0; i < list.length; i += 2){
      const c = carves[list[i]], k = list[i + 1], k2 = (k + 1) % c.M, P = c.P;
      const ax = P[k*3], ay = P[k*3 + 1], az = P[k*3 + 2], ex = P[k2*3] - ax, ey = P[k2*3 + 1] - ay, ez = P[k2*3 + 2] - az, L2 = ex*ex + ey*ey + ez*ez || 1e-12;
      const u = Math.max(0, Math.min(1, ((x - ax)*ex + (y - ay)*ey + (z - az)*ez)/L2));
      const d = Math.hypot(x - ax - u*ex, y - ay - u*ey, z - az - u*ez)*R, score = d - c.bed;
      if (score < bs && d < c.bed + c.sh){ bs = score; best = { d, hb: c.prof[k] + (c.prof[k2] - c.prof[k])*u, bed: c.bed, sh: c.sh }; }
    }
    return best;
  };
  return {
    R, stamps, carves: carves.length, net, stop: L && L.cliffs ? L.cliffs.stop : 1.0,
    height(x, y, z){
      let h = under(x, y, z);
      if (carves.length){ const q = carveAt(x, y, z); if (q){ const t = q.d <= q.bed ? 0 : (q.d - q.bed)/q.sh, w = t*t*(3 - 2*t); h = q.hb + (h - q.hb)*w; } }
      return h;
    },
    // everything but the sculpt and detail layers and the carving
    shaped,
    // the ground before the trails carve it
    under,
  };
};
// the cliff-erator's target for a height h on ground of grade s: stepped into bands `band` high (a flat ledge, then a
// riser), by as much as the ground is steep (none below 3/4 of `from`, all of it from `from` up)
PT.cliffTarget = function(h, s, c){
  const t = (s - c.from*0.75)/(c.from*0.25); if (t <= 0) return h;
  const w = t >= 1 ? 1 : t*t*(3 - 2*t), S = Math.max(1, c.band), base = Math.floor(h/S)*S, f = (h - base)/S;
  return h + (base + S*Math.pow(f, Math.max(1, c.sharp)) - h)*w;
};
PT.STORE = 'skate-planet-layout';
window.PlanetTerrain = PT;
})();
