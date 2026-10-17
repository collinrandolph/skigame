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
//   models        the game's own models (models.js), each by its catalogue id, version `v` and `seed` (for the ones
//                 that vary), turned `rot` degrees clockwise from facing north and scaled by `scale`; `solid` unless
//                 set false
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
    if (!any) continue;
    // mostly empty: a bit per point saying which hold a value, then just those values
    let nz = 0; for (let i = 0; i < q.length; i++) if (q[i]) nz++;
    if (nz < q.length*0.6){ const m = new Uint8Array(q.length/8), v = new Int16Array(nz); let j = 0;
      for (let i = 0; i < q.length; i++) if (q[i]){ m[i >> 3] |= 1 << (i & 7); v[j++] = q[i]; }
      const out = new Uint8Array(m.length + v.length*2); out.set(m); out.set(new Uint8Array(v.buffer), m.length); tiles.push([k, b64FromBytes(out), 1]); }
    else tiles.push([k, b64FromBytes(new Uint8Array(q.buffer))]);
  }
  return { n: dl.n, tiles };
};
PT.decodeDetail = function(o){
  const dl = PT.newDetail(o && o.n || 1024);
  if (o && o.tiles) for (const [k, b, sparse] of o.tiles){
    const bytes = bytesFromB64(b), t = new Float32Array(DT*DT);
    if (sparse){ const m = bytes.subarray(0, t.length/8), v = new Int16Array(bytes.buffer.slice(t.length/8)); let j = 0; for (let i = 0; i < t.length; i++) if (m[i >> 3] & (1 << (i & 7))) t[i] = v[j++]/100; }
    else { const q = new Int16Array(bytes.buffer); for (let i = 0; i < t.length; i++) t[i] = q[i]/100; }
    dl.tiles.set(k, t); }
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
// join: trails closer than this run as one; patch: ease steep patches smaller than this (cleanup). corridor: how far
// past a carved trail's bed the trail takes over the ground, and side: the steepest the ground beside it may be there
PT.networkDefaults = () => ({ join: 8, patch: 15, corridor: 30, side: 0.25 });
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
// (skip(k): leave out segment k, for a line measured against another part of itself)
function nearestOn(H, p, closed, skip){
  const P = H.pts, M = P.length, R = H.R; let best = null;
  for (const i of H.near(p)) for (const k of [i - 1, i]){
    if (k < 0 && !closed) continue; const k0 = (k + M) % M, k1 = (k0 + 1) % M; if (!closed && k0 === M - 1) continue;
    if (skip && skip(k0)) continue;
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
// (within `join` m, roughly the same line) pulled onto it, eased in and out over 2 x join. a trail that goes back over
// its own earlier path (a retrace) is pulled onto that the same way: the same way round within join, the other way
// round (out and back) within join/2, so a switchback's legs stay apart. crossings stay crossings (the lines must run
// within about 37° of each other), but a shallow approach to a junction is zipped onto the trail it joins, however
// short. shared[t][i] is 1 + the trail point i of trail t now lies on (0 if none; t + 1 for its own earlier path):
// draw it once, name both
const netCache = new Map();
PT.trailNetwork = function(trails, R, join, spacing){
  const key = JSON.stringify([R, join, spacing, trails.map(t => [t.pts, !!t.closed])]);
  if (netCache.has(key)) return netCache.get(key);
  const lines = trails.map(t => t.pts && t.pts.length >= 2 ? PT.evenCurve(t.pts, !!t.closed, spacing, R) : []);
  const shared = lines.map(l => new Uint8Array(l.length)), merged = [];
  const gapN = Math.max(4, Math.ceil(3*join/spacing));            // a trail's own path counts as "earlier" this far back
  // (each line's bounding cap, to skip pairs of trails too far apart to meet)
  const caps = lines.map(l => { if (!l.length) return null; const m = [0, 0, 0]; for (const p of l){ m[0] += p[0]; m[1] += p[1]; m[2] += p[2]; } const n = Math.hypot(...m) || 1, c = m.map(v => v/n); let r = 0; for (const p of l) r = Math.max(r, ang3(p, c)); return [c, r]; });
  const apart = (a, b) => !caps[a] || !caps[b] || ang3(caps[a][0], caps[b][0]) > caps[a][1] + caps[b][1] + 3*join/R;
  const earlierOnly = (i, M, closed) => k => !(k < i - gapN && !(closed && i - k > M - gapN));
  if (join > 0) for (let b = 0; b < lines.length; b++){
    const closed = !!trails[b].closed;
    for (let a = 0; a <= b; a++){
      const self = a === b, A = lines[a], B = lines[b], M = B.length; if (A.length < 2 || M < 3 || (!self && apart(a, b))) continue;
      const H = lineHash(A, R, Math.max(4, join*1.5)), raw = new Uint8Array(M), Q = new Array(M);
      for (let i = 0; i < M; i++){
        const nq = nearestOn(H, B[i], !!trails[a].closed, self ? earlierOnly(i, M, closed) : null); if (!nq || nq.d > join*3) continue;
        Q[i] = nq.q; const tb = tangentAt(B, i, closed), c = tb[0]*nq.t[0] + tb[1]*nq.t[1] + tb[2]*nq.t[2];
        if (Math.abs(c) > 0.8 && nq.d < (self && c < 0 ? join/2 : join)) raw[i] = 1;
      }
      // drop only stray points (a run shorter than about join/2): a shallow approach is zipped however short
      const need = Math.max(3, Math.round(join/2/spacing)); let any = false, start = 0;
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
      const B2 = B.slice();
      for (let i = 0; i < M; i++) if (w[i] > 0 && Q[i]){
        const p = B[i], q = Q[i], x = p[0] + (q[0] - p[0])*w[i], y = p[1] + (q[1] - p[1])*w[i], z = p[2] + (q[2] - p[2])*w[i], l = Math.hypot(x, y, z);
        B2[i] = [x/l, y/l, z/l];
      }
      lines[b] = PT.resampleLine(B2, closed, spacing, R);
      merged.push([a, b]);
    }
    // which of its points now lie on an earlier trail, or on its own earlier path
    const B = lines[b], sh = shared[b] = new Uint8Array(B.length);
    for (let a = 0; a <= b; a++){
      if (lines[a].length < 2 || (a !== b && apart(a, b))) continue; const H = lineHash(lines[a], R, 4);
      for (let i = 0; i < B.length; i++){ if (sh[i]) continue; const nq = nearestOn(H, B[i], !!trails[a].closed, a === b ? earlierOnly(i, B.length, closed) : null); if (nq && nq.d < 0.3) sh[i] = a + 1; }
    }
  }
  const out = { lines, shared, merged };
  if (netCache.size > 6) netCache.delete(netCache.keys().next().value);
  netCache.set(key, out); return out;
};

// ---------- junctions: where trails really meet, each corner between two neighbouring arms rounded ----------
// a junction is where two trails cross (or a trail crosses itself), where a trail leaves or joins another it runs
// along (a fork), or where a trail's end sits on another trail. it's real only if the trails meet at the same height
// there (their beds within `dh` m: not one passing over the other). round it, each pair of neighbouring arms gets a
// curve meeting both smoothly: its radius from rMin (arms close together) to rMax (nearly straight on), starting no
// further than tMax m out along the arms, so a shallow fork's curve is small and a crossing's about 5 m. the corner
// inside each curve (the wedge between it and the two arms) is groomed with it: at a crossing the four wedges make a
// small groomed island. heightOf(ti, fi): a trail's bed height at (fractional) point fi of its line in net.lines
PT.junctionDefaults = () => ({ rMin: 3, rMax: 8, tMax: 8, dh: 1.5 });
PT.trailLinks = function(trails, net, R, heightOf, opt){
  opt = Object.assign(PT.junctionDefaults(), opt || {});
  const lines = net.lines, junctions = [], fillets = [];
  // (a trail that only touches another for a point or two is crossing it, not running along it)
  const spc = (() => { const l = lines.find(l => l.length > 1); return l ? Math.max(0.3, ang3(l[0], l[1])*R) : 2; })(), minRun = Math.max(3, Math.ceil(5/spc));
  const shared = net.shared.map((sh, ti) => { const o = Uint8Array.from(sh), M = o.length, closed = !!trails[ti].closed;
    for (let i = 0; i < M; ){ if (!o[i]){ i++; continue; } let j = i; while (j < M && o[j]) j++;
      const wraps = closed && (i === 0 || j === M) && o[0] && o[M - 1];
      if (j - i < minRun && !wraps) for (let k = i; k < j; k++) o[k] = 0; i = j; }
    return o; });
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], dot = (a, b) => a[0]*b[0] + a[1]*b[1] + a[2]*b[2];
  const lerpP = (l, closed, fi) => { const M = l.length, k = Math.floor(fi), u = fi - k, a = l[closed ? ((k % M) + M) % M : Math.max(0, Math.min(M - 1, k))], b = l[closed ? (((k + 1) % M) + M) % M : Math.max(0, Math.min(M - 1, k + 1))];
    return norm([a[0] + (b[0] - a[0])*u, a[1] + (b[1] - a[1])*u, a[2] + (b[2] - a[2])*u]); };
  // walk s metres along a trail's line from fi, one way (dir ±1): the point, where (fi), and whether it got that far
  const walk = (ti, fi, dir, s) => {
    const l = lines[ti], M = l.length, closed = !!trails[ti].closed; let pos = fi, left = s, p = lerpP(l, closed, pos);
    for (let n = 0; n < 4*M && left > 1e-6; n++){
      let nxt = dir > 0 ? Math.floor(pos + 1e-9) + 1 : Math.ceil(pos - 1e-9) - 1;
      if (!closed && (nxt < 0 || nxt > M - 1)) return { p, fi: pos, ok: false, s: s - left };
      const q = lerpP(l, closed, nxt), d = ang3(p, q)*R;
      if (d >= left){ const t = left/d; pos = pos + (nxt - pos)*t; return { p: lerpP(l, closed, pos), fi: pos, ok: true, s }; }
      left -= d; pos = nxt; p = q;
    }
    return { p, fi: pos, ok: true, s: s - left };
  };
  const frame = c => { const a = Math.abs(c[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0], e = norm([a[1]*c[2] - a[2]*c[1], a[2]*c[0] - a[0]*c[2], a[0]*c[1] - a[1]*c[0]]); return [e, [c[1]*e[2] - c[2]*e[1], c[2]*e[0] - c[0]*e[2], c[0]*e[1] - c[1]*e[0]]]; };
  const to2 = (c, F, p) => { const d = sub(p, c); return [dot(d, F[0])*R, dot(d, F[1])*R]; };
  const from2 = (c, F, x, y) => norm([c[0] + (F[0][0]*x + F[1][0]*y)/R, c[1] + (F[0][1]*x + F[1][1]*y)/R, c[2] + (F[0][2]*x + F[1][2]*y)/R]);
  const near = (p, list, r) => list.some(j => ang3(j.c, p)*R < r);
  const add = (c, kind, arms) => { if (near(c, junctions, 4)) return; junctions.push({ c, kind, arms }); };
  // ---- crossings: segments of different trails (or far-apart stretches of one) that cross, off any shared stretch
  const CELL = 4, key = p => Math.floor(p[0]*R/CELL) + ',' + Math.floor(p[1]*R/CELL) + ',' + Math.floor(p[2]*R/CELL), hash = new Map();
  lines.forEach((l, ti) => { const segN = trails[ti].closed ? l.length : l.length - 1; for (let k = 0; k < segN; k++){ const m = norm(l[k].map((v, q) => v + l[(k + 1) % l.length][q])), kk = key(m); let h = hash.get(kk); if (!h) hash.set(kk, h = []); h.push(ti, k); } });
  const gapN = Math.max(6, Math.ceil(12/spc));
  lines.forEach((B, b) => { const segN = trails[b].closed ? B.length : B.length - 1, MB = B.length;
    for (let k = 0; k < segN; k++){
      const k1 = (k + 1) % MB; if (shared[b][k] || shared[b][k1]) continue;
      const m = norm(B[k].map((v, q) => v + B[k1][q])), F = frame(m), p0 = to2(m, F, B[k]), p1 = to2(m, F, B[k1]);
      const cx = Math.floor(m[0]*R/CELL), cy = Math.floor(m[1]*R/CELL), cz = Math.floor(m[2]*R/CELL);
      for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) for (let dz = -1; dz <= 1; dz++){
        const h = hash.get((cx + dx) + ',' + (cy + dy) + ',' + (cz + dz)); if (!h) continue;
        for (let n = 0; n < h.length; n += 2){
          const a = h[n], j = h[n + 1]; if (a > b) continue; const A = lines[a], MA = A.length, j1 = (j + 1) % MA;
          if (a === b){ if (j >= k) continue; const dd = Math.min(k - j, trails[b].closed ? MA - (k - j) : Infinity); if (dd < gapN) continue; }
          if (shared[a][j] || shared[a][j1]) continue;
          const q0 = to2(m, F, A[j]), q1 = to2(m, F, A[j1]), rx = p1[0] - p0[0], ry = p1[1] - p0[1], sx = q1[0] - q0[0], sy = q1[1] - q0[1], den = rx*sy - ry*sx;
          if (Math.abs(den) < 1e-9) continue;
          const u = ((q0[0] - p0[0])*sy - (q0[1] - p0[1])*sx)/den, v = ((q0[0] - p0[0])*ry - (q0[1] - p0[1])*rx)/den;
          if (u < 0 || u >= 1 || v < 0 || v >= 1) continue;
          const c = lerpP(B, !!trails[b].closed, k + u);
          add(c, 'crossing', [{ ti: b, fi: k + u, dir: 1 }, { ti: b, fi: k + u, dir: -1 }, { ti: a, fi: j + v, dir: 1 }, { ti: a, fi: j + v, dir: -1 }]);
        }
      }
    } });
  // ---- forks: where a trail leaves or joins one it runs along (its shared stretch starts or ends), and a trail's end
  // sitting on another trail
  const hashes = new Map(), lh = a => { if (!hashes.has(a)) hashes.set(a, lineHash(lines[a], R, 6)); return hashes.get(a); };
  const hostArms = (a, p, skip) => { const nq = nearestOn(lh(a), p, !!trails[a].closed, skip); if (!nq || nq.d > 1.5) return null; const fi = nq.k + nq.u; return [{ ti: a, fi, dir: 1 }, { ti: a, fi, dir: -1 }]; };
  lines.forEach((B, b) => { const sh = shared[b], M = B.length, closed = !!trails[b].closed; if (M < 3) return;
    for (let i = 0; i < M; i++){
      const n = i + 1; if (!closed && n >= M) break; const nn = n % M;
      if (!!sh[i] === !!sh[nn]) continue;
      const leaving = !!sh[i], at = leaving ? i : nn, a = sh[at] - 1;
      const host = hostArms(a, B[at], a === b ? k => Math.abs(k - at) < gapN || (closed && M - Math.abs(k - at) < gapN) : null); if (!host) continue;
      add(B[at], 'fork', host.concat([{ ti: b, fi: at, dir: leaving ? 1 : -1 }]));
    }
    if (!closed) for (const end of [0, M - 1]){ if (sh[end]) continue;
      for (let a = 0; a < lines.length; a++){ if (lines[a].length < 2 || a === b) continue; const host = hostArms(a, B[end]); if (host){ add(B[end], 'end', host.concat([{ ti: b, fi: end, dir: end ? -1 : 1 }])); break; } } }
  });
  // ---- round each real junction
  for (const J of junctions){
    const hs = J.arms.map(A => heightOf(A.ti, A.fi)); J.real = Math.max(...hs) - Math.min(...hs) <= opt.dh; if (!J.real) continue;
    J.h = hs.reduce((s, v) => s + v, 0)/hs.length;
    const F = frame(J.c);
    // each arm: how far it goes (up to 12 m) and its direction, from the point 3 m out
    const arms = J.arms.map(A => { const w = walk(A.ti, A.fi, A.dir, 12), d3 = walk(A.ti, A.fi, A.dir, Math.min(3, w.s)), v = to2(J.c, F, d3.p); return Object.assign({}, A, { len: w.s, ang: Math.atan2(v[1], v[0]) }); })
      .filter(A => A.len > 1);
    // (the same arm twice, e.g. a fork's shared stretch: keep one)
    const uniq = []; for (const A of arms) if (!uniq.some(B => Math.abs(Math.atan2(Math.sin(A.ang - B.ang), Math.cos(A.ang - B.ang))) < 0.09)) uniq.push(A);
    uniq.sort((x, y) => x.ang - y.ang); J.armCount = uniq.length; if (uniq.length < 2) continue;
    for (let i = 0; i < uniq.length; i++){
      const A = uniq[i], B = uniq[(i + 1) % uniq.length]; let phi = B.ang - A.ang; if (i === uniq.length - 1) phi += 2*Math.PI;
      if (phi >= Math.PI - 0.02 || phi <= 0.01) continue;
      let r = opt.rMin + (opt.rMax - opt.rMin)*phi/Math.PI, t = r/Math.tan(phi/2);
      t = Math.min(t, opt.tMax, 0.7*A.len, 0.7*B.len); r = t*Math.tan(phi/2); if (t < 0.3) continue;
      const wa = walk(A.ti, A.fi, A.dir, t), wb = walk(B.ti, B.fi, B.dir, t);
      const pa = to2(J.c, F, wa.p), pb = to2(J.c, F, wb.p), ia = to2(J.c, F, walk(A.ti, A.fi, A.dir, Math.max(0, t - 0.5)).p), ib = to2(J.c, F, walk(B.ti, B.fi, B.dir, Math.max(0, t - 0.5)).p);
      const ua = norm([ia[0] - pa[0], ia[1] - pa[1], 0]), ub = norm([ib[0] - pb[0], ib[1] - pb[1], 0]);
      const hl = 4/3*Math.tan((Math.PI - phi)/4)*r, c1 = [pa[0] + ua[0]*hl, pa[1] + ua[1]*hl], c2 = [pb[0] + ub[0]*hl, pb[1] + ub[1]*hl];
      const n = Math.max(4, Math.ceil(((Math.PI - phi)*r + 0.5))), pts = [], h = [], ha = heightOf(A.ti, wa.fi), hb = heightOf(B.ti, wb.fi);
      for (let s = 0; s <= n; s++){ const u = s/n, v = 1 - u, x = v*v*v*pa[0] + 3*v*v*u*c1[0] + 3*v*u*u*c2[0] + u*u*u*pb[0], y = v*v*v*pa[1] + 3*v*v*u*c1[1] + 3*v*u*u*c2[1] + u*u*u*pb[1];
        pts.push(from2(J.c, F, x, y)); h.push(ha + (hb - ha)*u); }
      // the wedge: the junction, out along one arm to the curve, round it, back along the other
      const wedge = [J.c]; for (let s = 1; s < t; s += 1) wedge.push(walk(A.ti, A.fi, A.dir, s).p);
      wedge.push(...pts); for (let s = Math.floor(t - 1e-6); s >= 1; s -= 1) wedge.push(walk(B.ti, B.fi, B.dir, s).p);
      const tA = trails[A.ti], tB = trails[B.ti];
      fillets.push({ pts, h, wedge, hc: J.h, r: +r.toFixed(2), t: +t.toFixed(2), turn: +((Math.PI - phi)*180/Math.PI).toFixed(1), kind: J.kind,
        tis: [A.ti, B.ti], names: [...new Set([tA.name, tB.name])], bed: Math.min(tA.bed ?? 4, tB.bed ?? 4), carved: !!(tA.carve && tB.carve) });
    }
  }
  return { junctions, fillets };
};
// is unit direction p inside a fillet's wedge (on the plane at its junction)?
PT.inWedge = function(f, p, R){
  if (!f._2){ const c = f.wedge[0], a = Math.abs(c[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0], e = norm([a[1]*c[2] - a[2]*c[1], a[2]*c[0] - a[0]*c[2], a[0]*c[1] - a[1]*c[0]]), n = [c[1]*e[2] - c[2]*e[1], c[2]*e[0] - c[0]*e[2], c[0]*e[1] - c[1]*e[0]];
    f._F = [c, e, n]; f._2 = f.wedge.map(q => { const d = [q[0] - c[0], q[1] - c[1], q[2] - c[2]]; return [(d[0]*e[0] + d[1]*e[1] + d[2]*e[2])*R, (d[0]*n[0] + d[1]*n[1] + d[2]*n[2])*R]; });
    f._r = Math.max(...f._2.map(v => Math.hypot(v[0], v[1]))); }
  const [c, e, n] = f._F, d = [p[0] - c[0], p[1] - c[1], p[2] - c[2]], x = (d[0]*e[0] + d[1]*e[1] + d[2]*e[2])*R, y = (d[0]*n[0] + d[1]*n[1] + d[2]*n[2])*R;
  if (Math.hypot(x, y) > f._r || p[0]*c[0] + p[1]*c[1] + p[2]*c[2] < 0) return false;
  let ins = false; const P = f._2; for (let i = 0, j = P.length - 1; i < P.length; j = i++){ const [xi, yi] = P[i], [xj, yj] = P[j]; if ((yi > y) !== (yj > y) && x < (xj - xi)*(y - yi)/(yj - yi) + xi) ins = !ins; }
  return ins;
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
  if (net.patch > 0 && !(L.clean && L.clean.tiles.size)){ const r = easePatches(L, R, net.patch); rep.patches = r.eased; rep.patchesLeft = r.left; }
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
PT.blankLayout = R => ({ version: 1, name: 'Untitled planet', radius: R || 800, noise: { amp: 1 }, stamps: [], sculpt: PT.newSculpt(128), detail: PT.newDetail(1024), trails: [], landmarks: [], models: [], bridges: [], start: { d: PT.START.slice() }, scatter: { mountains: 0, buildings: 1, trees: 1 }, cliffs: PT.cliffDefaults(), network: PT.networkDefaults() });
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
// a placed model's frame at unit direction d: x, y (up) and z, as arrays. at rot 0 the model's front (-z) faces north;
// rot turns it clockwise seen from above, in degrees
PT.modelBasis = function(d, rot){
  const u = norm(d), a = Math.abs(u[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
  let e = [a[1]*u[2] - a[2]*u[1], a[2]*u[0] - a[0]*u[2], a[0]*u[1] - a[1]*u[0]]; e = norm(e);          // east
  const n = [u[1]*e[2] - u[2]*e[1], u[2]*e[0] - u[0]*e[2], u[0]*e[1] - u[1]*e[0]];                     // north
  const r = (rot || 0)*Math.PI/180, c = Math.cos(r), s = Math.sin(r);
  const x = [0, 1, 2].map(i => c*e[i] - s*n[i]), f = [0, 1, 2].map(i => c*n[i] + s*e[i]);
  return [x, u, f.map(v => -v)];
};
// where a model of footprint radius r (metres) sits: the lowest ground under it (its middle and a ring at 85% of r),
// a little lower so nothing floats. returns metres above the base radius, and how much the ground varies under it
PT.modelSeat = function(d, r, height, R){
  const [x, , z] = PT.modelBasis(d, 0), u = norm(d);
  let lo = height(u[0], u[1], u[2]), hi = lo;
  for (let k = 0; k < 12; k++){
    const a = k/12*Math.PI*2, ox = Math.cos(a)*r*0.85, oz = Math.sin(a)*r*0.85;
    const p = norm([u[0]*R + x[0]*ox + z[0]*oz, u[1]*R + x[1]*ox + z[1]*oz, u[2]*R + x[2]*ox + z[2]*oz]);
    const h = height(p[0], p[1], p[2]); lo = Math.min(lo, h); hi = Math.max(hi, h);
  }
  return { base: lo - 0.15, spread: hi - lo };
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
    models: (L.models || []).map(m => ({ name: m.name, id: m.id, v: m.v, seed: m.seed, d: r5(m.d), rot: m.rot, scale: m.scale, solid: m.solid !== false })),
    bridges: (L.bridges || []).map(b => ({ name: b.name, pts: b.pts.map(r5), clearance: b.clearance, ramp: b.ramp, width: b.width, maxGrade: b.maxGrade })),
    start: { d: r5(L.start.d) }, scatter: Object.assign({}, L.scatter), cliffs: Object.assign({}, L.cliffs), network: Object.assign(PT.networkDefaults(), L.network || {}),
    clean: L.clean && L.clean.tiles.size ? Object.assign(PT.encodeDetail(L.clean), { sig: L.clean.sig || '', stale: !!L.clean.stale }) : undefined,
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
    models: (o.models || []).filter(m => m && m.id && m.d).map(m => ({ name: m.name || m.id, id: String(m.id), v: Math.max(0, m.v | 0), seed: Math.max(1, m.seed | 0), d: norm(m.d), rot: +m.rot || 0, scale: +m.scale > 0 ? +m.scale : 1, solid: m.solid !== false })),
    bridges: (o.bridges || []).filter(b => b.pts && b.pts.length >= 2).map(b => Object.assign({ name: b.name || 'Light bridge', pts: b.pts.map(norm) }, PT.bridgeDefaults(), pick(b, ['clearance', 'ramp', 'width', 'maxGrade']))),
    start: { d: norm(o.start && o.start.d || B.start.d) }, scatter: Object.assign({}, B.scatter, o.scatter || {}),
    cliffs: Object.assign(PT.cliffDefaults(), pick(o.cliffs || {}, ['from', 'band', 'sharp', 'stop'])),
    network: Object.assign(PT.networkDefaults(), pick(o.network || {}, ['join', 'patch', 'corridor', 'side'])),
    clean: o.clean && o.clean.tiles && o.clean.tiles.length ? Object.assign(PT.decodeDetail(o.clean), { sig: o.clean.sig || '', stale: !!o.clean.stale }) : null,
  };
  // older layouts may have steps where the cube faces meet: weld them, easing the change back into each face
  PT.weldSculpt(L.sculpt, 3); PT.weldDetail(L.detail, 8);
  return L;
};

// ---------- the ground: height (metres above the base radius) at a unit direction ----------
// with no layout it's the procedural planet. R may differ from the layout's radius (stamps stay in metres)
// ---------- trail corridors (see PT.terrain): baked on a grid per cube face ----------
const CT = 16;     // corridor grid tiles, CT x CT points
// prev, caps: an earlier bake with the same settings, and the caps ([direction, angle]) where anything has changed since:
// only the corridors within reach of those are worked out again (with room round them), the rest kept as they were
function bakeCorridors(carves, under, R, side, corridor, FADE, allow, prev, caps){
  const CS = 2, NG = Math.max(65, Math.round(2*R/CS) + 1), TN = Math.ceil(NG/CT), key = JSON.stringify([NG, side, corridor, FADE, R]);
  const inc = !!(prev && caps && prev.key === key), tiles = inc ? new Map(prev.tiles) : new Map(), owned = new Set();
  const tileFor = k => { let t = tiles.get(k); if (t && inc && !owned.has(k)){ t = t.slice(); tiles.set(k, t); } if (!t){ t = new Float32Array(CT*CT*3).fill(NaN); tiles.set(k, t); } owned.add(k); return t; };
  const capList = inc ? caps.map(([d, a]) => { const v = d.isVector3 ? [d.x, d.y, d.z] : d, l = Math.hypot(v[0], v[1], v[2]) || 1; return [[v[0]/l, v[1]/l, v[2]/l], a]; }) : null;
  const bedMax = Math.max(...carves.map(c => c.bed)), reach = bedMax + corridor + FADE + 2, lim = corridor + FADE;
  const LMAX = 3;                                    // the steepest the corridor's edge may get as it meets the land
  // the margin, in grid steps (the grid is finest, about half as far apart, toward a face's edges)
  const M = Math.ceil(reach/(CS*0.45)) + 2, W = NG + 2*M, du = 2/(NG - 1), N = W*W;
  const dir = new Float32Array(N*3), cd = new Float32Array(N), lo = new Float32Array(N), hi = new Float32Array(N);
  const h0 = new Float32Array(N), hl = new Float32Array(N), hu = new Float32Array(N), Lc = new Float32Array(N), inR = new Uint8Array(N), dI = new Float32Array(N), dJ = new Float32Array(N), dok = new Uint8Array(N), sw = new Float32Array(N), swh = new Float32Array(N);
  const q = [0, 0, 0];
  for (let f = 0; f < 6; f++){
    const [na, ua, va, sg] = FAX[f];
    // which segments reach this face (its plane, extended past its edges by the margin)
    const segs = [];
    carves.forEach((c, ci) => { const segN = c.closed ? c.M : c.M - 1, P = c.P;
      for (let k = 0; k < segN; k++){ const den = sg*P[k*3 + na]; if (den < 0.35) continue; const u = P[k*3 + ua]/den, v = P[k*3 + va]/den;
        if (Math.abs(u) < 1 + (M + 4)*du*2 && Math.abs(v) < 1 + (M + 4)*du*2) segs.push(ci, k); } });
    if (!segs.length) continue;
    // the part of the face the corridors can reach (its grid points as directions)
    let bi0 = W, bi1 = -1, bj0 = W, bj1 = -1;
    for (let s = 0; s < segs.length; s += 2){ const P = carves[segs[s]].P, k = segs[s + 1], den = sg*P[k*3 + na], cu = P[k*3 + ua]/den, cv = P[k*3 + va]/den;
      const r = Math.ceil(reach/R*(1 + cu*cu + cv*cv)/du) + 3, gi = (cu + 1)/du + M, gj = (cv + 1)/du + M;
      bi0 = Math.min(bi0, gi - r); bi1 = Math.max(bi1, gi + r); bj0 = Math.min(bj0, gj - r); bj1 = Math.max(bj1, gj + r); }
    // (redoing only round the changes: keep the corridors within their reach of a change, working them out with 20 m more)
    let wb = null;
    if (inc){
      let a0 = W, a1 = -1, b0 = W, b1 = -1, c0 = W, c1 = -1, e0 = W, e1 = -1;
      for (let [d, ang] of capList){
        // (a cap centred off this face reaches it only if it comes within its reach of the face's edge: measure from the
        // nearest point of the face's square instead)
        const den = sg*d[na]; if (den < 0.05) continue; let cu = d[ua]/den, cv = d[va]/den;
        if (Math.abs(cu) > 1 || Math.abs(cv) > 1){ const e = [0, 0, 0]; e[na] = sg; e[ua] = Math.max(-1, Math.min(1, cu)); e[va] = Math.max(-1, Math.min(1, cv));
          const el = Math.hypot(e[0], e[1], e[2]), gap = Math.acos(Math.max(-1, Math.min(1, (e[0]*d[0] + e[1]*d[1] + e[2]*d[2])/el)));
          if (gap*R > ang*R + reach + 20) continue; cu = e[ua]; cv = e[va]; ang = Math.max(0, ang - gap); }
        const sc = (1 + cu*cu + cv*cv)/(R*du);
        const gi = (cu + 1)/du + M, gj = (cv + 1)/du + M, rw = (ang*R + reach + 20)*sc + 3, rk = (ang*R + reach)*sc + 2;
        a0 = Math.min(a0, gi - rw); a1 = Math.max(a1, gi + rw); b0 = Math.min(b0, gj - rw); b1 = Math.max(b1, gj + rw);
        c0 = Math.min(c0, gi - rk); c1 = Math.max(c1, gi + rk); e0 = Math.min(e0, gj - rk); e1 = Math.max(e1, gj + rk); }
      if (a1 < a0) continue;
      bi0 = Math.max(bi0, a0); bi1 = Math.min(bi1, a1); bj0 = Math.max(bj0, b0); bj1 = Math.min(bj1, b1);
      wb = [Math.max(M, Math.floor(c0)), Math.min(M + NG - 1, Math.ceil(c1)), Math.max(M, Math.floor(e0)), Math.min(M + NG - 1, Math.ceil(e1))];
    }
    bi0 = Math.max(1, Math.floor(bi0)); bi1 = Math.min(W - 2, Math.ceil(bi1)); bj0 = Math.max(1, Math.floor(bj0)); bj1 = Math.min(W - 2, Math.ceil(bj1));
    if (bi0 > bi1 || bj0 > bj1) continue;
    cd.fill(1e9); lo.fill(-1e9); hi.fill(1e9); inR.fill(0); dok.fill(0); sw.fill(0); swh.fill(0);
    // a grid point as a direction, worked out the first time it's wanted
    const need = id => { if (dok[id]) return; dok[id] = 1; const i = id % W, j = (id/W) | 0, o = id*3; PT.dirFromFace(f, -1 + (i - M)*du, -1 + (j - M)*du, q); dir[o] = q[0]; dir[o + 1] = q[1]; dir[o + 2] = q[2]; };
    // each segment marks the points within its reach: how far past the bed (cd), and the beds' limits (lo, hi)
    for (let s = 0; s < segs.length; s += 2){
      const c = carves[segs[s]], k = segs[s + 1], k2 = (k + 1) % c.M, P = c.P;
      if (inc){ const d0 = sg*P[k*3 + na], u0 = P[k*3 + ua]/d0, v0 = P[k*3 + va]/d0, r0 = reach*(1 + u0*u0 + v0*v0)/(R*du) + 4, g0 = (u0 + 1)/du + M, h0_ = (v0 + 1)/du + M;
        if (g0 + r0 < bi0 || g0 - r0 > bi1 || h0_ + r0 < bj0 || h0_ - r0 > bj1) continue; }
      const ax = P[k*3], ay = P[k*3 + 1], az = P[k*3 + 2], ex = P[k2*3] - ax, ey = P[k2*3 + 1] - ay, ez = P[k2*3 + 2] - az, L2 = ex*ex + ey*ey + ez*ez || 1e-12;
      const p0 = c.prof[k], p1 = c.prof[k2], bed = c.bed, Ls = Math.sqrt(L2)*R;
      // the strip square to this piece (a quarter of its length past each end, out to its reach either side). on a cube
      // face a great circle is a straight line, so the strip is a four-sided shape on the grid: fill it row by row
      const mx = ax + ex/2, my = ay + ey/2, mz = az + ez/2;
      let nx = my*ez - mz*ey, ny = mz*ex - mx*ez, nz = mx*ey - my*ex; const nl = Math.sqrt(nx*nx + ny*ny + nz*nz) || 1; nx /= nl; ny /= nl; nz /= nl;
      // (past each end, as far as the bend there needs, so the strips leave no gaps on the outside of a bend)
      const bend = kk => { const k0 = c.closed ? (kk + c.M) % c.M : Math.max(0, Math.min(c.M - 2, kk)), k1 = (k0 + 1) % c.M;
        const fx = P[k1*3] - P[k0*3], fy = P[k1*3 + 1] - P[k0*3 + 1], fz = P[k1*3 + 2] - P[k0*3 + 2], fl = Math.sqrt(fx*fx + fy*fy + fz*fz) || 1e-12;
        return Math.acos(Math.max(-1, Math.min(1, (fx*ex + fy*ey + fz*ez)/(fl*Math.sqrt(L2))))); };
      const tw = (bed + lim + 1)/R, ext0 = 0.3 + (0.8 + (bed + lim)*Math.min(1, 1.3*bend(k - 1)))/Ls, ext1 = 0.3 + (0.8 + (bed + lim)*Math.min(1, 1.3*bend(k + 1)))/Ls, cg = [];
      let ok = true;
      for (const [sa, tb] of [[-ext0, -tw], [1 + ext1, -tw], [1 + ext1, tw], [-ext0, tw]]){
        const px = ax + ex*sa + nx*tb, py = ay + ey*sa + ny*tb, pz = az + ez*sa + nz*tb, dn = sg*(na === 0 ? px : na === 1 ? py : pz); if (dn <= 0.05){ ok = false; break; }
        cg.push(((ua === 0 ? px : ua === 1 ? py : pz)/dn + 1)/du + M, ((va === 0 ? px : va === 1 ? py : pz)/dn + 1)/du + M);
      }
      if (!ok) continue;
      if (Math.max(cg[0], cg[2], cg[4], cg[6]) < bi0 - 1 || Math.min(cg[0], cg[2], cg[4], cg[6]) > bi1 + 1 || Math.max(cg[1], cg[3], cg[5], cg[7]) < bj0 - 1 || Math.min(cg[1], cg[3], cg[5], cg[7]) > bj1 + 1) continue;
      const rj0 = Math.max(bj0, Math.floor(Math.min(cg[1], cg[3], cg[5], cg[7])) - 1), rj1 = Math.min(bj1, Math.ceil(Math.max(cg[1], cg[3], cg[5], cg[7])) + 1);
      for (let j = rj0; j <= rj1; j++){
        // where this row crosses the shape's sides (with a point's slack either way)
        let x0 = Infinity, x1 = -Infinity;
        for (let e = 0; e < 4; e++){
          const xa = cg[e*2], ya = cg[e*2 + 1], xb = cg[((e + 1) % 4)*2], yb = cg[((e + 1) % 4)*2 + 1];
          const y0 = Math.min(ya, yb) - 1, y1 = Math.max(ya, yb) + 1; if (j < y0 || j > y1) continue;
          const t = yb === ya ? 0.5 : Math.max(0, Math.min(1, (j - ya)/(yb - ya))), xx = xa + (xb - xa)*t;
          if (xx < x0) x0 = xx; if (xx > x1) x1 = xx; if (xa < x0 && Math.abs(j - ya) <= 1) x0 = xa; if (xa > x1 && Math.abs(j - ya) <= 1) x1 = xa;
        }
        if (x0 > x1) continue;
        const ri0 = Math.max(bi0, Math.floor(x0) - 1), ri1 = Math.min(bi1, Math.ceil(x1) + 1);
        for (let i = ri0; i <= ri1; i++){
        const id = j*W + i; need(id);
        const o = id*3, x = dir[o], y = dir[o + 1], z = dir[o + 2];
        // past a piece's ends the trail climbs or falls on (at most its steepest grade), so the limit loosens by that much:
        // a stretch further along the same trail never pins the ground beside this one
        const u0 = ((x - ax)*ex + (y - ay)*ey + (z - az)*ez)/L2;
        const u = u0 < 0 ? 0 : u0 > 1 ? 1 : u0, qx = x - ax - u*ex, qy = y - ay - u*ey, qz = z - az - u*ez, dd = Math.sqrt(qx*qx + qy*qy + qz*qz)*R - bed; if (dd > lim) continue;
        if (dd < cd[id]) cd[id] = dd;
        const hb = p0 + (p1 - p0)*u, a = allow(c, dd) + c.gA*(u0 < 0 ? -u0 : u0 > 1 ? u0 - 1 : 0)*Ls;
        if (hb - a > lo[id]) lo[id] = hb - a; if (hb + a < hi[id]) hi[id] = hb + a;
        // (the beds near, by nearness; along a trail each piece's share fades out past its ends, so the pieces blend evenly)
        const wu = 1 - Math.abs(u0 - 0.5); if (wu > 0){ const wd = wu/Math.max(1, (dd + bed)*(dd + bed)); sw[id] += wd; swh[id] += wd*hb; }
        }
      }
    }
    // the land under the corridors, clamped into the beds' limits (where trails disagree, halfway between them)
    const reg = [];
    for (let j = bj0; j <= bj1; j++) for (let i = bi0; i <= bi1; i++){ const id = j*W + i; if (cd[id] <= lim) reg.push(id); }
    // where trails disagree (beds too far apart in height for the side grade between them, like a switchback's legs),
    // the ground ramps evenly from one bed to the other (each bed counting by how near it is), eased in from where
    // they start to disagree; those points are held there
    for (const id of reg){
      inR[id] = 1; const o = id*3, h = under(dir[o], dir[o + 1], dir[o + 2]); h0[id] = h;
      const l = lo[id], u = hi[id]; let hc;
      if (l > u){ const m = (l + u)/2, t = Math.min(1, (l - u)/2), r = sw[id] > 0 ? swh[id]/sw[id] : m; hc = m + (r - m)*t*t*(3 - 2*t); inR[id] = 3; }
      else hc = h < l ? l : h > u ? u : h;
      hl[id] = hu[id] = hc;
      Lc[id] = cd[id] <= corridor ? side : side + (LMAX - side)*Math.min(1, (cd[id] - corridor)/FADE);
    }
    // no steeper than the side grade: the least fill (hu, raised to it) and the least cut (hl, lowered to it), by
    // sweeping the grid both ways (twice), each point taking what its neighbours allow
    // (a bed's points don't move, and nothing goes outside the beds' limits: those are no steeper than the side grade)
    // (the distances to the neighbours, worked out once: across (dI), down (dJ), and the diagonals from those)
    for (const id of reg){ const o = id*3; need(id + 1); need(id + W);
      let x = dir[o + 3] - dir[o], y = dir[o + 4] - dir[o + 1], z = dir[o + 5] - dir[o + 2]; dI[id] = Math.sqrt(x*x + y*y + z*z)*R;
      const w = o + W*3; x = dir[w] - dir[o]; y = dir[w + 1] - dir[o + 1]; z = dir[w + 2] - dir[o + 2]; dJ[id] = Math.sqrt(x*x + y*y + z*z)*R; }
    const relax = (id, nb, dist) => { if (!inR[nb]) return;
      const cst = 0.5*(Lc[id] + Lc[nb])*dist;
      const a = hl[nb] + cst; if (a < hl[id]) hl[id] = a > lo[id] ? a : lo[id]; const b = hu[nb] - cst; if (b > hu[id]) hu[id] = b < hi[id] ? b : hi[id]; };
    for (const id of reg) if (inR[id] === 1 && lo[id] >= hi[id] - 0.01) inR[id] = 2;      // the beds: fixed
    // smooth the ramps where trails disagree (on the inside of a tight bend which points disagree can flicker)
    { const ramp = Int32Array.from(reg.filter(id => inR[id] === 3));
      for (let it = 0; it < 6; it++){
        for (const id of ramp) hu[id] = hl[id];
        for (const id of ramp){ let sm = hu[id], n = 1;
          for (const nb of [id - 1, id + 1, id - W, id + W, id - W - 1, id - W + 1, id + W - 1, id + W + 1]) if (inR[nb] === 3){ sm += hu[nb]; n++; }
          hl[id] = sm/n; }
      }
      for (const id of ramp) hu[id] = hl[id]; }
    const free = Int32Array.from(reg.filter(id => inR[id] === 1)), nf = free.length;
    for (let it = 0; it < 3; it++){
      for (let r = 0; r < nf; r++){ const id = free[r], di = dI[id], dj = dJ[id], dg = Math.sqrt(di*di + dj*dj); relax(id, id - 1, di); relax(id, id - W - 1, dg); relax(id, id - W, dj); relax(id, id - W + 1, dg); }
      for (let r = nf - 1; r >= 0; r--){ const id = free[r], di = dI[id], dj = dJ[id], dg = Math.sqrt(di*di + dj*dj); relax(id, id + 1, di); relax(id, id + W + 1, dg); relax(id, id + W, dj); relax(id, id + W - 1, dg); }
    }
    // average the two, keep within the beds' limits, round the corners (twice), keeping within the limits
    const F = hl;
    for (const id of reg){ if (inR[id] === 3) continue; const v = (hl[id] + hu[id])/2, l = lo[id], u = hi[id]; F[id] = l > u ? (l + u)/2 : v < l ? l : v > u ? u : v; }
    for (let it = 0; it < 2; it++){
      for (const id of reg) hu[id] = F[id];
      for (let r = 0; r < nf; r++){
        const id = free[r];       // (a bed stays as it is)
        let sm = 0, n = 0; if (inR[id - 1]){ sm += hu[id - 1]; n++; } if (inR[id + 1]){ sm += hu[id + 1]; n++; } if (inR[id - W]){ sm += hu[id - W]; n++; } if (inR[id + W]){ sm += hu[id + W]; n++; }
        const v = n ? 0.5*hu[id] + 0.5*sm/n : hu[id], l = lo[id], u = hi[id]; F[id] = v < l ? l : v > u ? u : v;
      }
    }
    // keep this face's own points: the corridor's height, the land's, and how much the corridor counts there (redoing
    // round a change: clear what was kept there first)
    if (wb) for (let j = wb[2]; j <= wb[3]; j++) for (let i = wb[0]; i <= wb[1]; i++){
      const gi = i - M, gj = j - M, k = (f*TN + (gj/CT | 0))*TN + (gi/CT | 0); if (!tiles.has(k)) continue;
      const t = tileFor(k), t0 = ((gj % CT)*CT + (gi % CT))*3; t[t0] = t[t0 + 1] = t[t0 + 2] = NaN; }
    for (const id of reg){
      const i = id % W, j = (id/W) | 0; if (i < M || i >= M + NG || j < M || j >= M + NG) continue;
      if (wb && (i < wb[0] || i > wb[1] || j < wb[2] || j > wb[3])) continue;
      const gi = i - M, gj = j - M, t = tileFor((f*TN + (gj/CT | 0))*TN + (gi/CT | 0));
      const t0 = ((gj % CT)*CT + (gi % CT))*3, e = cd[id] <= corridor ? 1 : Math.max(0, 1 - (cd[id] - corridor)/FADE), w = e*e*(3 - 2*e);
      t[t0] = F[id]; t[t0 + 1] = h0[id]; t[t0 + 2] = w;
    }
  }
  return { NG, TN, tiles, key };
}
// the ground at a point near a corridor: the corridor's height where it counts in full, the land's own (h) where it
// doesn't, eased between; the land's detail finer than the grid shows only as it fades out
function corridorAt(C, x, y, z, h){
  const fuv = PT.faceUV(x, y, z), f = fuv[0], NG = C.NG, TN = C.TN, gx = (fuv[1] + 1)/2*(NG - 1), gy = (fuv[2] + 1)/2*(NG - 1);
  const i = Math.max(0, Math.min(NG - 2, Math.floor(gx))), j = Math.max(0, Math.min(NG - 2, Math.floor(gy))), fx = gx - i, fy = gy - j;
  let Fb = 0, Hb = 0, Wb = 0, any = false;
  for (let c = 0; c < 4; c++){
    const ii = i + (c & 1), jj = j + (c >> 1), wt = ((c & 1) ? fx : 1 - fx)*((c >> 1) ? fy : 1 - fy);
    const t = C.tiles.get((f*TN + (jj/CT | 0))*TN + (ii/CT | 0)), o = ((jj % CT)*CT + (ii % CT))*3;
    if (t && t[o] === t[o]){ Fb += t[o]*wt; Hb += t[o + 1]*wt; Wb += t[o + 2]*wt; any = true; }
    else { Fb += h*wt; Hb += h*wt; }
  }
  return any ? Fb + (h - Hb)*(1 - Wb) : h;
}

PT.terrain = function(L, R, prev, caps){
  const amp = L ? L.noise.amp : 1, stamps = L ? L.stamps.filter(s => s.pts && s.pts.length).map(s => compileStamp(s, R)) : [], sc = L ? L.sculpt : null;
  // everything but the trails' carving
  const shaped = (x, y, z) => { let h = amp ? amp*PT.baseNoise(x, y, z, R) : 0; for (let i = 0; i < stamps.length; i++) h += stampAt(stamps[i], x, y, z, R); return h; };
  const dl = L && L.detail && L.detail.tiles.size ? L.detail : null;
  const under = (x, y, z) => shaped(x, y, z) + (sc ? PT.sampleSculpt(sc, x, y, z) : 0) + (dl ? PT.sampleDetail(dl, x, y, z) : 0);
  // carved trails: each one's line (2 m apart) and bed profile
  // a carved trail takes over the ground beside it, out to `corridor` m past its bed: the ground there may rise or fall
  // from the bed no faster than `side` (rounding off from the level bed over the trail's shoulder width), so nothing
  // beside a trail is steeper than that, however the trail cuts across the land. where the ground is gentler it's left
  // as it is. every carved trail near a point has its say (the ground keeps within all their limits), so parallel
  // trails, junctions and forks share one smooth surface. past the corridor it eases back into the land over FADE m
  const carves = [], STEP = 2, FADE = 10;
  const NW = Object.assign(PT.networkDefaults(), L && L.network || {});
  const stopG = L && L.cliffs ? L.cliffs.stop : 1.0, side = Math.max(0.02, Math.min(NW.side, stopG*0.9)), corridor = Math.max(0, NW.corridor);
  // the trails as one network (runs alongside each other made one), so carved beds that share ground agree
  const join = L && L.network ? L.network.join : 0, net = L && L.trails.length ? PT.trailNetwork(L.trails, R, join, STEP) : null;
  if (L) L.trails.forEach((t, ti) => {
    if (!t.carve || !t.pts || t.pts.length < 2) return;
    const pts = net.lines[ti], M = pts.length; if (M < 2) return;
    const c = { ti, pts, closed: !!t.closed, M, bed: Math.max(0.5, t.bed ?? 4), sh: Math.max(0.5, t.shoulder ?? 10), smooth: t.smooth ?? 40, P: new Float64Array(M*3),
      prof: carveProfile(pts, !!t.closed, under, t.smooth ?? 40, t.maxGrade ?? 0.2, STEP), gA: (t.maxGrade ?? 0.2) + 0.03 };
    pts.forEach((p, i) => { c.P[i*3] = p[0]; c.P[i*3 + 1] = p[1]; c.P[i*3 + 2] = p[2]; });
    carves.push(c);
  });
  // how far the ground may differ from a bed at dd m past its edge: level at the edge, rounding into the side grade over
  // the shoulder, then that grade out to the corridor, then easing off quickly (by FADE m past it, 100 m)
  const allow = (c, dd) => {
    if (dd <= 0) return 0;
    let a = dd < c.sh ? side*dd*dd/(2*c.sh) : side*(dd - c.sh/2);
    const f = dd - corridor; if (f > 0) a += 0.1*f*f*f;
    return a;
  };
  // junctions and neighbours: where a carved trail meets, runs along or passes near an earlier one, its bed moves toward
  // the earlier one's height as far as it must for the ground between them to keep within the side grade (on a shared
  // stretch, all the way), eased back to its own over its smoothing length either side
  // (each trail's bounding sphere, to skip pairs too far apart to matter)
  for (const c of carves){ const m = [0, 0, 0]; for (const p of c.pts){ m[0] += p[0]; m[1] += p[1]; m[2] += p[2]; } const l = Math.hypot(...m) || 1; c.mid = m.map(v => v/l); c.rad = Math.max(...c.pts.map(p => ang3(p, c.mid))); }
  for (let b = 1; b < carves.length; b++){
    const B = carves[b], cor = new Float64Array(B.M), has = new Uint8Array(B.M);
    for (let a = 0; a < b; a++){
      const A = carves[a], far = A.bed + B.bed + corridor; if (ang3(A.mid, B.mid) > A.rad + B.rad + far/R) continue;
      const H = A.hash || (A.hash = lineHash(A.pts, R, Math.max(4, far/1.5)));
      for (let i = 0; i < B.M; i++){
        const nq = nearestOn(H, B.pts[i], A.closed); if (!nq || nq.d > far) continue;
        const k2 = (nq.k + 1) % A.M, dh = A.prof[nq.k] + (A.prof[k2] - A.prof[nq.k])*nq.u - B.prof[i];
        const ok = nq.d < Math.min(A.bed, B.bed) ? 0 : allow(A, nq.d - A.bed - B.bed), need = Math.sign(dh)*Math.max(0, Math.abs(dh) - ok);
        if (need && (!has[i] || Math.abs(need) > Math.abs(cor[i]))){ cor[i] = need; has[i] = 1; }
      }
    }
    if (!has.some(x => x)) continue;
    // spread: each point takes the correction of the nearest point along the line that has one, faded by distance
    const span = Math.max(20, B.smooth)/STEP, M = B.M, dist = new Float64Array(M).fill(Infinity), val = new Float64Array(M);
    const sweep = (dirn) => {
      let d = Infinity, v = 0; const n = B.closed ? 2*M : M;
      for (let s = 0; s < n; s++){ const i = dirn > 0 ? s % M : (M - 1 - (s % M)); if (has[i]){ d = 0; v = cor[i]; } else d++; if (d < dist[i] || (d === dist[i] && Math.abs(v) > Math.abs(val[i]))){ dist[i] = d; val[i] = v; } }
    };
    sweep(1); sweep(-1);
    for (let i = 0; i < M; i++){ const t = Math.min(1, dist[i]/span), w = 1 - t*t*(3 - 2*t); B.prof[i] += val[i]*w; }
  }
  // the corridors, worked out once on a grid (about 1.5 m apart, per cube face, each face with a margin past its edges so
  // faces agree where they meet). on the grid: the beds are held level, and the ground in each corridor is cut and
  // filled as little as it can be so that nowhere is it steeper than the side grade (the steepest the land beside a
  // trail may be): the least fill that does it and the least cut that does it, averaged. then the corners are rounded,
  // everything is kept within the beds' limits, and past the corridor it eases back into the land over FADE m. the
  // ground then reads the grid: the corridor's height, with the land's own finer detail where it fades out
  // an applied terrain cleanup (planet-cleanup.js) takes over from the corridors: its layer of changes is added to the
  // land as sculpted (L.cleanOff: show the land without it, in the editor)
  const cl = L && L.clean && L.clean.tiles.size && !L.cleanOff ? L.clean : null;
  // the junctions, rounded (bed heights: a carved trail's profile, otherwise the land)
  let links = null;
  if (net){ const prof = new Map(carves.map(c => [c.ti, c.prof]));
    links = PT.trailLinks(L.trails, net, R, (ti, fi) => { const pr = prof.get(ti), l = net.lines[ti], M = l.length, k = Math.floor(fi), u = fi - k, cl2 = !!L.trails[ti].closed;
      const ix = i => cl2 ? ((i % M) + M) % M : Math.max(0, Math.min(M - 1, i));
      if (pr) return pr[ix(k)]*(1 - u) + pr[ix(k + 1)]*u;
      const a = l[ix(k)], b = l[ix(k + 1)], q = norm([a[0] + (b[0] - a[0])*u, a[1] + (b[1] - a[1])*u, a[2] + (b[2] - a[2])*u]); return under(q[0], q[1], q[2]); }); }
  const corr = carves.length && !cl ? bakeCorridors(carves, under, R, side, corridor, FADE, allow, prev && prev.corr, caps) : null;
  return {
    R, stamps, carves: carves.length, net, links, corr, clean: !!cl, stop: L && L.cliffs ? L.cliffs.stop : 1.0,
    // each carved trail's bed profile along its line in net.lines (for the cleanup)
    beds: carves.map(c => ({ ti: c.ti, prof: c.prof, bed: c.bed })),
    height(x, y, z){
      const h = under(x, y, z);
      return cl ? h + PT.sampleDetail(cl, x, y, z) : corr ? corridorAt(corr, x, y, z, h) : h;
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
