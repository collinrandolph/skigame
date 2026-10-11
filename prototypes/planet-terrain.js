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
PT.evenCurve = function(pts, closed, spacing, R){
  const raw = PT.curve(pts, closed, spacing/3, R); if (raw.length < 2) return raw;
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

// ---------- layouts ----------
const norm = p => { const L = Math.hypot(p[0], p[1], p[2]) || 1; return [p[0]/L, p[1]/L, p[2]/L]; };
PT.START = norm([0.15, 1, 0.25]);
PT.cliffDefaults = () => ({ from: 0.6, band: 12, sharp: 8, stop: 1.0 });
PT.blankLayout = R => ({ version: 1, name: 'Untitled planet', radius: R || 800, noise: { amp: 1 }, stamps: [], sculpt: PT.newSculpt(128), detail: PT.newDetail(1024), trails: [], landmarks: [], bridges: [], start: { d: PT.START.slice() }, scatter: { mountains: 0, buildings: 1, trees: 1 }, cliffs: PT.cliffDefaults() });
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
    start: { d: r5(L.start.d) }, scatter: Object.assign({}, L.scatter), cliffs: Object.assign({}, L.cliffs),
  });
};
PT.parse = function(json){
  const o = typeof json === 'string' ? JSON.parse(json) : json, B = PT.blankLayout(o.radius || 800);
  return {
    version: 1, name: o.name || B.name, radius: o.radius || 800, noise: { amp: o.noise && o.noise.amp !== undefined ? o.noise.amp : 1 },
    stamps: (o.stamps || []).map(s => ({ type: s.type, pts: s.pts.map(norm), radius: +s.radius, height: +s.height, sharp: s.sharp ?? 0.3 })),
    sculpt: PT.decodeSculpt(o.sculpt), detail: PT.decodeDetail(o.detail),
    trails: (o.trails || []).map(t => Object.assign({ name: t.name || 'Trail', closed: !!t.closed, pts: t.pts.map(norm) }, PT.carveDefaults(), { carve: !!t.carve }, pick(t, ['bed', 'shoulder', 'smooth', 'maxGrade']))),
    landmarks: (o.landmarks || []).map(m => ({ name: m.name || 'Landmark', type: m.type || 'marker', d: norm(m.d), height: +m.height || 10, color: m.color || '#d2462e' })),
    bridges: (o.bridges || []).filter(b => b.pts && b.pts.length >= 2).map(b => Object.assign({ name: b.name || 'Light bridge', pts: b.pts.map(norm) }, PT.bridgeDefaults(), pick(b, ['clearance', 'ramp', 'width', 'maxGrade']))),
    start: { d: norm(o.start && o.start.d || B.start.d) }, scatter: Object.assign({}, B.scatter, o.scatter || {}),
    cliffs: Object.assign(PT.cliffDefaults(), pick(o.cliffs || {}, ['from', 'band', 'sharp', 'stop'])),
  };
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
  if (L) for (const t of L.trails){
    if (!t.carve || !t.pts || t.pts.length < 2) continue;
    const pts = PT.evenCurve(t.pts, !!t.closed, STEP, R), M = pts.length; if (M < 2) continue;
    const c = { closed: !!t.closed, M, bed: Math.max(0.5, t.bed ?? 4), sh: Math.max(0.5, t.shoulder ?? 10), P: new Float64Array(M*3),
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
    R, stamps, carves: carves.length, stop: L && L.cliffs ? L.cliffs.stop : 1.0,
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
