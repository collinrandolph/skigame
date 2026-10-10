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
//   trails        named lines of control points (a smooth curve runs through them), closed into loops or not
//   landmarks     named places with a height and a colour
//   start         where the skier starts
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
function b64FromBytes(bytes){ let s = ''; for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000)); return btoa(s); }
function bytesFromB64(b){ const s = atob(b), out = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i); return out; }
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

// ---------- layouts ----------
const norm = p => { const L = Math.hypot(p[0], p[1], p[2]) || 1; return [p[0]/L, p[1]/L, p[2]/L]; };
PT.START = norm([0.15, 1, 0.25]);
PT.blankLayout = R => ({ version: 1, name: 'Untitled planet', radius: R || 800, noise: { amp: 1 }, stamps: [], sculpt: PT.newSculpt(128), trails: [], landmarks: [], start: { d: PT.START.slice() }, scatter: { mountains: 0, buildings: 1, trees: 1 } });
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
  L.trails.push({ name: 'Summit Loop', closed: true, pts: [at(60, 10), at(56, 22), at(44, 18), at(40, 2), at(48, -14), at(58, -8)] });
  L.trails.push({ name: 'Long Way Round', closed: true, pts: Array.from({ length: 12 }, (_, i) => at(45 + 12*Math.sin(i*1.7), i*30 + 10)) });
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
    sculpt: PT.encodeSculpt(L.sculpt),
    trails: L.trails.map(t => ({ name: t.name, closed: !!t.closed, pts: t.pts.map(r5) })),
    landmarks: L.landmarks.map(m => ({ name: m.name, type: m.type, d: r5(m.d), height: m.height, color: m.color })),
    start: { d: r5(L.start.d) }, scatter: Object.assign({}, L.scatter),
  });
};
PT.parse = function(json){
  const o = typeof json === 'string' ? JSON.parse(json) : json, B = PT.blankLayout(o.radius || 800);
  return {
    version: 1, name: o.name || B.name, radius: o.radius || 800, noise: { amp: o.noise && o.noise.amp !== undefined ? o.noise.amp : 1 },
    stamps: (o.stamps || []).map(s => ({ type: s.type, pts: s.pts.map(norm), radius: +s.radius, height: +s.height, sharp: s.sharp ?? 0.3 })),
    sculpt: PT.decodeSculpt(o.sculpt),
    trails: (o.trails || []).map(t => ({ name: t.name || 'Trail', closed: !!t.closed, pts: t.pts.map(norm) })),
    landmarks: (o.landmarks || []).map(m => ({ name: m.name || 'Landmark', type: m.type || 'marker', d: norm(m.d), height: +m.height || 10, color: m.color || '#d2462e' })),
    start: { d: norm(o.start && o.start.d || B.start.d) }, scatter: Object.assign({}, B.scatter, o.scatter || {}),
  };
};

// ---------- the ground: height (metres above the base radius) at a unit direction ----------
// with no layout it's the procedural planet. R may differ from the layout's radius (stamps stay in metres)
PT.terrain = function(L, R){
  const amp = L ? L.noise.amp : 1, stamps = L ? L.stamps.filter(s => s.pts && s.pts.length).map(s => compileStamp(s, R)) : [], sc = L ? L.sculpt : null;
  return {
    R, stamps,
    height(x, y, z){
      let h = amp ? amp*PT.baseNoise(x, y, z, R) : 0;
      for (let i = 0; i < stamps.length; i++) h += stampAt(stamps[i], x, y, z, R);
      if (sc) h += PT.sampleSculpt(sc, x, y, z);
      return h;
    },
    // everything but the sculpt layer (the flatten brush needs it)
    shaped(x, y, z){ let h = amp ? amp*PT.baseNoise(x, y, z, R) : 0; for (let i = 0; i < stamps.length; i++) h += stampAt(stamps[i], x, y, z, R); return h; },
  };
};
PT.STORE = 'skate-planet-layout';
window.PlanetTerrain = PT;
})();
