// planet-cleanup.js: the terrain cleanup for a planet layout (the planet editor uses it; the game doesn't need it).
// step 1, the reading: the land as sculpted (before the trails carve it), on a grid over the whole planet (about 1.5 m
// apart, linked across the cube faces' seams), read as landforms:
//   steep regions (steeper than you can ski): each measured (height, area, thickest width, how much was painted with
//     the cliff brush) and kept as a cliff or mountain if it has real height and isn't tiny (or was painted), otherwise
//     a mistake that cleanup would smooth away
//   skiable ground (mistakes counted as skiable): the regions the trails run through, pockets enclosed by steep
//     ground with no trail (out of reach: left as they are), and big regions no trail reaches
//   narrow skiable strips between two cliffs, by their middle line: raised (ridge, spur, bridge), low (valley, pass)
//     or level (bench, ledge)
//   the ground just beside a cliff: its foot (where an apron goes) or its top (a crest)
//   where trails cross steep ground: a bench (across a slope), a notch (through a ridge) or a causeway (along a crest),
//     and where one runs along a raised strip narrower than its bed + 1 m either side
// PC.analyse is async: it hands back to the page between stages (progress(text, share done)) so the editor keeps
// responding while it works (a few seconds to a few tens of seconds, by the planet's size)
(function(){
'use strict';
const PT = (typeof window !== 'undefined' ? window : globalThis).PlanetTerrain;
const PC = {};

PC.defaults = () => ({ relief: 6, area: 60, painted: 0.3, narrow: 12, near: 6, trap: 3000 });

// what each grid point is (cls), with its colour and name for the overlay and the legend
PC.CLASSES = [
  ['flat', 'Flat (under 8%)', [236, 240, 243]],
  ['rolling', 'Rolling (8–25%)', [205, 222, 205]],
  ['steepski', 'Steep but skiable (25% to the limit)', [232, 214, 150]],
  ['cliff', 'Kept cliff / mountain', [112, 104, 118]],
  ['mistake', 'Steep mistake: cleanup smooths it away', [235, 40, 200]],
  ['pocket', 'Pocket enclosed by steep ground (out of reach)', [245, 130, 30]],
  ['foot', 'Cliff foot (apron)', [196, 160, 120]],
  ['top', 'Cliff top (crest)', [150, 190, 225]],
  ['raised', 'Narrow strip, raised (ridge, spur, bridge)', [0, 200, 210]],
  ['low', 'Narrow strip, low (valley, pass)', [40, 80, 230]],
  ['level', 'Narrow strip, level (bench, ledge)', [120, 120, 255]],
  ['unreached', 'Skiable, no trail in this region', [190, 196, 206]],
];

const tick = () => new Promise(r => setTimeout(r, 0));
const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());

PC.analyse = async function(L, T, opt, progress){
  opt = Object.assign(PC.defaults(), opt || {}); progress = progress || (() => {});
  const R = L.radius, STOP = L.cliffs ? L.cliffs.stop : 1.0;
  const N = Math.min(800, Math.round(2*R/1.5)), NN = N*N, NC = 6*NN, CS = 2*R/N;
  const say = async (t, f) => { progress(t, f); await tick(); last = now(); };
  let last = now(); const due = () => now() - last > 50;   // (time to hand back to the page)
  // ---- the grid: cell centres as directions, the land's height, what the cliff brush painted
  await say('Reading the land…', 0);
  const dir = new Float32Array(NC*3), H = new Float32Array(NC), painted = new Uint8Array(NC), q = [0, 0, 0];
  const dl = L.detail && L.detail.tiles.size ? L.detail : null;
  for (let f = 0; f < 6; f++){
    for (let j = 0; j < N; j++){ if (due()) await say('Reading the land…', 0.05 + 0.3*(f + j/N)/6); for (let i = 0; i < N; i++){
      const id = f*NN + j*N + i; PT.dirFromFace(f, -1 + (i + 0.5)*2/N, -1 + (j + 0.5)*2/N, q); dir[id*3] = q[0]; dir[id*3 + 1] = q[1]; dir[id*3 + 2] = q[2];
      H[id] = T.under(q[0], q[1], q[2]); if (dl && Math.abs(PT.sampleDetail(dl, q[0], q[1], q[2])) > 0.3) painted[id] = 1;
    } }
    await say('Reading the land…', 0.05 + 0.3*(f + 1)/6);
  }
  const cellOf = (x, y, z) => { const fuv = PT.faceUV(x, y, z), i = Math.min(N - 1, Math.max(0, Math.floor((fuv[1] + 1)/2*N))), j = Math.min(N - 1, Math.max(0, Math.floor((fuv[2] + 1)/2*N))); return fuv[0]*NN + j*N + i; };
  // neighbours (8: E W N S, then the diagonals), across the faces' seams too
  const DX = [1, -1, 0, 0, 1, 1, -1, -1], DY = [0, 0, 1, -1, 1, -1, 1, -1], seam = new Map();
  const nbr = (id, k) => { const f = (id/NN) | 0, r = id - f*NN, j = (r/N) | 0, i = r - j*N, ii = i + DX[k], jj = j + DY[k];
    if (ii >= 0 && ii < N && jj >= 0 && jj < N) return f*NN + jj*N + ii;
    const key = id*8 + k; let v = seam.get(key); if (v === undefined){ PT.dirFromFace(f, -1 + (ii + 0.5)*2/N, -1 + (jj + 0.5)*2/N, q); v = cellOf(q[0], q[1], q[2]); seam.set(key, v); } return v; };
  const dist = (a, b) => { const x = dir[a*3] - dir[b*3], y = dir[a*3 + 1] - dir[b*3 + 1], z = dir[a*3 + 2] - dir[b*3 + 2]; return Math.sqrt(x*x + y*y + z*z)*R; };
  // ---- each cell's real area (cells shrink toward a face's corners), and the slope
  await say('Measuring slopes…', 0.36);
  const AREA = new Float32Array(NC), S = new Float32Array(NC);
  for (let id = 0; id < NC; id++){
    if ((id & 0xFFFF) === 0 && due()) await say('Measuring slopes…', 0.36 + 0.09*id/NC);
    const e = nbr(id, 0), w = nbr(id, 1), n = nbr(id, 2), s = nbr(id, 3);
    AREA[id] = dist(id, e)*dist(id, n);
    const gx = (H[e] - H[w])/(dist(e, w) || 1), gy = (H[n] - H[s])/(dist(n, s) || 1); S[id] = Math.sqrt(gx*gx + gy*gy);
  }
  // ---- steep regions, measured and classified
  await say('Finding cliffs and mountains…', 0.45);
  const steepComp = new Int32Array(NC).fill(-1), comps = [], queue = new Int32Array(NC);
  for (let s0 = 0; s0 < NC; s0++){
    if ((s0 & 0xFFFF) === 0 && due()) await say('Finding cliffs and mountains…', 0.45 + 0.1*s0/NC);
    if (S[s0] <= STOP || steepComp[s0] >= 0) continue;
    const c = { id: comps.length, n: 0, lo: Infinity, hi: -Infinity, painted: 0, area: 0, cells: [] }; let qh = 0, qt = 0; queue[qt++] = s0; steepComp[s0] = c.id;
    while (qh < qt){ const a = queue[qh++]; c.n++; c.area += AREA[a]; c.cells.push(a); if (painted[a]) c.painted++; if (H[a] < c.lo) c.lo = H[a]; if (H[a] > c.hi) c.hi = H[a];
      for (let k = 0; k < 8; k++){ const b = nbr(a, k); if (S[b] > STOP){ if (steepComp[b] < 0){ steepComp[b] = c.id; queue[qt++] = b; } } else { if (H[b] < c.lo) c.lo = H[b]; if (H[b] > c.hi) c.hi = H[b]; } } }
    c.relief = c.hi - c.lo; c.pf = c.painted/c.n; comps.push(c);
  }
  // thickest width: how far into each region from its edge (a flood from the edges inward)
  const depth = new Uint16Array(NC);
  { let qh = 0, qt = 0; for (let id = 0; id < NC; id++) if (S[id] > STOP){ for (let k = 0; k < 4; k++) if (S[nbr(id, k)] <= STOP){ depth[id] = 1; queue[qt++] = id; break; } }
    while (qh < qt){ const a = queue[qh++]; for (let k = 0; k < 4; k++){ const b = nbr(a, k); if (S[b] > STOP && !depth[b]){ depth[b] = depth[a] + 1; queue[qt++] = b; } } } }
  const kept = new Uint8Array(NC);
  for (const c of comps){ let m = 0; for (const a of c.cells) if (depth[a] > m) m = depth[a]; c.thick = (2*m - 1)*CS;
    c.keep = (c.relief >= opt.relief && c.area >= opt.area) || c.pf >= opt.painted; if (c.keep) for (const a of c.cells) kept[a] = 1; }
  // ---- skiable ground (mistakes count as skiable): its connected regions, and which the trails run through
  await say('Following the skiable ground…', 0.55);
  const skiComp = new Int32Array(NC).fill(-1), skis = [];
  for (let s0 = 0; s0 < NC; s0++){ if ((s0 & 0xFFFF) === 0 && due()) await say('Following the skiable ground…', 0.55 + 0.07*s0/NC); if (kept[s0] || skiComp[s0] >= 0) continue;
    const c = { id: skis.length, n: 0, trail: 0, area: 0, mid: s0 }; let qh = 0, qt = 0; queue[qt++] = s0; skiComp[s0] = c.id;
    while (qh < qt){ const a = queue[qh++]; c.n++; c.area += AREA[a]; for (let k = 0; k < 8; k++){ const b = nbr(a, k); if (!kept[b] && skiComp[b] < 0){ skiComp[b] = c.id; queue[qt++] = b; } } }
    c.mid = queue[qt >> 1]; skis.push(c); }
  const lines = T.net ? T.net.lines : [];
  for (const l of lines) for (const p of l){ const id = cellOf(p[0], p[1], p[2]); if (skiComp[id] >= 0) skis[skiComp[id]].trail++; }
  const onTrail = c => c.trail > 0;
  // ---- how far each skiable point is from a kept cliff, and the nearest cliff point (a flood, adding real distances)
  await say('Measuring the ground between cliffs…', 0.62);
  const D = new Float32Array(NC).fill(1e9), srcCell = new Int32Array(NC).fill(-1);
  { let qh = 0, qt = 0; const inQ = new Uint8Array(NC);
    for (let id = 0; id < NC; id++) if (kept[id]){ D[id] = 0; srcCell[id] = id; queue[qt++] = id; }
    // (a ring buffer: a point can be improved and queued again)
    let steps = 0;
    while (qh !== qt){ if ((++steps & 0xFFFF) === 0 && due()) await say('Measuring the ground between cliffs…', 0.66); const a = queue[qh]; qh = (qh + 1) % NC; inQ[a] = 0;
      for (let k = 0; k < 8; k++){ const b = nbr(a, k), d = D[a] + dist(a, b); if (d < D[b] - 1e-3 && d <= opt.narrow + opt.near + 2){ D[b] = d; srcCell[b] = srcCell[a]; if (!inQ[b]){ inQ[b] = 1; queue[qt] = b; qt = (qt + 1) % NC; } } } } }
  const ringMean = (id, r, onlyKept) => { const x = dir[id*3], y = dir[id*3 + 1], z = dir[id*3 + 2], ax = Math.abs(y) < 0.9 ? [0, 1, 0] : [1, 0, 0];
    let t1 = [ax[1]*z - ax[2]*y, ax[2]*x - ax[0]*z, ax[0]*y - ax[1]*x]; const l1 = Math.hypot(t1[0], t1[1], t1[2]); t1 = [t1[0]/l1, t1[1]/l1, t1[2]/l1]; const t2 = [y*t1[2] - z*t1[1], z*t1[0] - x*t1[2], x*t1[1] - y*t1[0]];
    let s = 0, n = 0; for (let k = 0; k < 16; k++){ const an = k/16*Math.PI*2, o1 = Math.cos(an)*r/R, o2 = Math.sin(an)*r/R; const c = cellOf(x + t1[0]*o1 + t2[0]*o2, y + t1[1]*o1 + t2[1]*o2, z + t1[2]*o1 + t2[2]*o2); if (!onlyKept || kept[c]){ s += H[c]; n++; } } return n ? s/n : null; };
  // narrow strips: the middle line, a point at least as far from the cliffs as both neighbours across it, whose nearest
  // cliff points on those two sides lie on opposite sides of it (over 120° apart). lines under about 9 m are dropped
  await say('Finding ridges, valleys and benches…', 0.72);
  const mid = new Uint8Array(NC), PAIRS = [[0, 1], [2, 3], [4, 7], [5, 6]];
  for (let id = 0; id < NC; id++){
    if ((id & 0xFFFF) === 0 && due()) await say('Finding ridges, valleys and benches…', 0.72 + 0.08*id/NC);
    if (kept[id] || D[id] > opt.narrow || D[id] < CS*0.75) continue;
    let on = false;
    for (const [ka, kb] of PAIRS){ const a = nbr(id, ka), b = nbr(id, kb); if (kept[a] || kept[b]) continue;
      if (!(D[id] >= D[a] - 0.01 && D[id] >= D[b] - 0.01)) continue;
      const sa = srcCell[a], sb = srcCell[b], o = id*3; if (sa < 0 || sb < 0) continue;
      const ax = dir[sa*3] - dir[o], ay = dir[sa*3 + 1] - dir[o + 1], az = dir[sa*3 + 2] - dir[o + 2], bx = dir[sb*3] - dir[o], by = dir[sb*3 + 1] - dir[o + 1], bz = dir[sb*3 + 2] - dir[o + 2];
      if ((ax*bx + ay*by + az*bz)/(Math.hypot(ax, ay, az)*Math.hypot(bx, by, bz) || 1) < -0.5){ on = true; break; } }
    if (!on) continue;
    const dh = H[id] - ringMean(id, D[id] + 5); mid[id] = dh > 1.5 ? 1 : dh < -1.5 ? 2 : 3;
  }
  { const seen = new Uint8Array(NC), comp = [];
    for (let s0 = 0; s0 < NC; s0++){ if (!mid[s0] || seen[s0]) continue; comp.length = 0; comp.push(s0); seen[s0] = 1;
      for (let h = 0; h < comp.length; h++){ const a = comp[h]; for (let k = 0; k < 8; k++){ const b = nbr(a, k); if (mid[b] && !seen[b]){ seen[b] = 1; comp.push(b); } } }
      if (comp.length < 6) for (const a of comp) mid[a] = 0; } }
  // the ground just beside a cliff: lower than the cliff a few metres in (its foot) or higher (its top)
  await say('Finding cliff feet and tops…', 0.8);
  const edge = new Uint8Array(NC);
  for (let id = 0; id < NC; id++){ if ((id & 0xFFFF) === 0 && due()) await say('Finding cliff feet and tops…', 0.8 + 0.06*id/NC); if (kept[id] || D[id] > opt.near) continue; const m = ringMean(id, D[id] + 6, true); if (m !== null) edge[id] = H[id] < m ? 1 : 2; }
  // ---- where trails cross steep ground, by the land 9 m either side of the line against the bed
  await say('Checking the trails…', 0.86);
  const issues = [], nrm = p => { const l = Math.hypot(p[0], p[1], p[2]); return [p[0]/l, p[1]/l, p[2]/l]; };
  lines.forEach((l, ti) => { const t = L.trails[ti], bed = t.bed ?? 4; let run = null;
    l.forEach((p, i) => { const id = cellOf(p[0], p[1], p[2]); let what = null, depth = 0;
      if (kept[id] || S[id] > STOP){
        const q2 = l[Math.min(l.length - 1, i + 1)], q1 = l[Math.max(0, i - 1)], tg = nrm([q2[0] - q1[0], q2[1] - q1[1], q2[2] - q1[2]]), sd = nrm([p[1]*tg[2] - p[2]*tg[1], p[2]*tg[0] - p[0]*tg[2], p[0]*tg[1] - p[1]*tg[0]]);
        const hb = T.height(p[0], p[1], p[2]), side = sg => H[cellOf(...nrm([p[0] + sg*9/R*sd[0], p[1] + sg*9/R*sd[1], p[2] + sg*9/R*sd[2]]))] - hb, a = side(-1), b = side(1);
        what = a > 2 && b > 2 ? 'notch' : a < -2 && b < -2 ? 'causeway' : 'bench'; depth = Math.max(Math.abs(a), Math.abs(b));
      } else if (D[id] < bed + 1 && H[id] > (ringMean(id, D[id] + 5) ?? H[id]) + 1.5) what = 'narrow';
      if (what && run && run.what === what && i === run.i1 + 1){ run.i1 = i; run.depth = Math.max(run.depth, depth); return; }
      if (run) issues.push(run); run = what ? { ti, name: t.name, what, i0: i, i1: i, depth } : null; });
    if (run) issues.push(run); });
  const WORD = { bench: 'benched into a slope', notch: 'notched through a ridge', causeway: 'along a crest (causeway)', narrow: 'on a raised strip narrower than its bed + 1 m' };
  const crossings = issues.filter(r => r.i1 - r.i0 >= 2).map(r => ({ trail: r.name, ti: r.ti, what: r.what, text: WORD[r.what], length: (r.i1 - r.i0 + 1)*2, depth: +r.depth.toFixed(1), at: lines[r.ti][(r.i0 + r.i1) >> 1] }))
    .sort((a, b) => b.length - a.length);
  // ---- what each point is
  await say('Drawing the map…', 0.94);
  const cls = new Uint8Array(NC);
  for (let id = 0; id < NC; id++){
    if (kept[id]){ cls[id] = 3; continue; }
    if (S[id] > STOP){ cls[id] = 4; continue; }
    const sk = skis[skiComp[id]];
    if (!onTrail(sk)){ if (sk.area >= 20 && sk.area < opt.trap){ cls[id] = 5; continue; } if (sk.area >= opt.trap){ cls[id] = 11; continue; } }
    cls[id] = S[id] < 0.08 ? 0 : S[id] < 0.25 ? 1 : 2;
    if (edge[id]) cls[id] = 5 + edge[id];
  }
  for (let id = 0; id < NC; id++) if (mid[id]){ cls[id] = 7 + mid[id]; for (let k = 0; k < 4; k++){ const b = nbr(id, k); if (!kept[b]) cls[b] = 7 + mid[id]; } }
  // ---- the summary
  const at = id => [dir[id*3], dir[id*3 + 1], dir[id*3 + 2]];
  const keptC = comps.filter(c => c.keep), mis = comps.filter(c => !c.keep);
  const pockets = skis.filter(c => !onTrail(c) && c.area >= 20 && c.area < opt.trap).sort((a, b) => b.area - a.area);
  const unreached = skis.filter(c => !onTrail(c) && c.area >= opt.trap);
  const count = v => { let n = 0; for (let id = 0; id < NC; id++) if (mid[id] === v) n++; return n; };
  const summary = {
    grid: { N, spacing: +CS.toFixed(2) },
    cliffs: { count: keptC.length, area: Math.round(keptC.reduce((a, c) => a + c.area, 0)), biggest: keptC.map(c => ({ area: Math.round(c.area), height: Math.round(c.relief) })).sort((a, b) => b.area - a.area).slice(0, 5) },
    mistakes: { count: mis.length, area: Math.round(mis.reduce((a, c) => a + c.area, 0)), at: mis.map(c => ({ area: Math.round(c.area), height: +c.relief.toFixed(1), at: at(c.cells[c.cells.length >> 1]) })).sort((a, b) => b.area - a.area) },
    trailRegions: skis.filter(onTrail).map(c => ({ area: Math.round(c.area), points: c.trail })).sort((a, b) => b.area - a.area),
    pockets: { count: pockets.length, area: Math.round(pockets.reduce((a, c) => a + c.area, 0)), at: pockets.map(c => ({ area: Math.round(c.area), at: at(c.mid) })) },
    unreached: { count: unreached.length, area: Math.round(unreached.reduce((a, c) => a + c.area, 0)) },
    strips: { raised: count(1), low: count(2), level: count(3) },
    crossings,
  };
  await say('Done', 1);
  // (the grids are kept for the later steps)
  return { N, NN, NC, R, CS, STOP, cls, summary, grid: { dir, H, S, kept, steepComp, skiComp, D, srcCell, mid, edge, AREA, comps, skis }, cellOf, nbr, dist, lines, opt };
};

// the overlay: one RGBA texture holding all six faces (3 across, 2 down), each N x N, coloured by class
PC.overlayAtlas = function(A, alpha = 215, cls = A.cls, table = PC.CLASSES){
  const N = A.N, W = 3*N, Hh = 2*N, out = new Uint8Array(W*Hh*4);
  for (let f = 0; f < 6; f++){ const tx = (f % 3)*N, ty = ((f/3) | 0)*N;
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++){ const c = table[cls[f*A.NN + j*N + i]][2], o = ((ty + j)*W + tx + i)*4; out[o] = c[0]; out[o + 1] = c[1]; out[o + 2] = c[2]; out[o + 3] = alpha; } }
  return { data: out, width: W, height: Hh };
};


// ============================================================================================================
// step 2, the plan: the target map, which ground should end up skiable and which unskiable, built from the reading.
// nothing is changed. made as an image:
//   start from the reading (kept cliffs and mountains unskiable, steep mistakes skiable)
//   the trails: each bed skiable, and an apron beside it (1-6 m, varying slowly along the trail, so where a trail
//     benches into a mountain the bench is cut back by a varying amount and the mountain's edge stays wherever it
//     already lies further out). along a crest or a raised strip, 1 m (a bridge, widened to the bed + 1 m). through a
//     ridge, a slot: the bed + 1 m, its walls kept; a saddle (a wider cut) where that slot would be deeper than 25 m
//     or longer than 40 m
//   cleaned: unskiable strips thinner than the minimum become skiable unless they're tall walls (6 m or more of
//     height, like a switchback's); skiable gaps narrower than the minimum with no trail become unskiable; small
//     unskiable bits (under 60 m², under 6 m high) become skiable, tiny skiable holes (under 20 m²) unskiable;
//     pockets out of reach are left as they are
//   checked: no strip under the minimums but the kept walls, and every trail bed skiable
// ============================================================================================================
PC.planDefaults = () => ({ minUnski: 6, minSki: 6, wall: 6, apronMin: 1, apronMax: 6, slotDepth: 25, slotLength: 40 });
PC.PLAN_CLASSES = [
  ['ski', 'Skiable', [232, 237, 241]],
  ['unski', 'Unskiable (cliff or mountain)', [112, 104, 118]],
  ['bed', 'Trail bed', [255, 250, 225]],
  ['apron', 'Trail apron', [236, 214, 150]],
  ['toski', 'Becomes skiable (smoothed away or cut back)', [80, 195, 105]],
  ['tounski', 'Becomes unskiable (thin gap closed)', [175, 95, 205]],
  ['wall', 'Thin wall kept (tall)', [60, 40, 85]],
  ['pocket', 'Pocket, left as it is', [245, 130, 30]],
  ['unreached', 'Skiable, no trail in this region', [190, 196, 206]],
  ['slot', 'Slot walls (a trail through a ridge)', [160, 40, 60]],
  ['saddle', 'Saddle (a ridge cut wider for the trail)', [40, 165, 150]],
];
PC.plan = async function(A, L, T, opt, progress){
  opt = Object.assign(PC.planDefaults(), opt || {}); progress = progress || (() => {});
  const { NC, R, CS, nbr, dist, cellOf, lines } = A, g = A.grid, H = g.H, dir = g.dir, AREA = g.AREA, PT_ = PT;
  let last = now(); const due = () => now() - last > 50, say = async (t, f) => { progress(t, f); await tick(); last = now(); };
  await say('Planning: the trails…', 0);
  // the target: 1 unskiable. F: what forced it (1 bed, 2 apron, 3 slot or saddle cut: always skiable)
  const U = new Uint8Array(NC), F = new Uint8Array(NC), slotBed = new Uint8Array(NC), was = g.kept;
  for (let id = 0; id < NC; id++) U[id] = was[id];
  // ---- a flood from seed cells out to a limit, by real distance (each cell's nearest seed): used to rasterise and to
  // widen or narrow the masks
  const queue = new Int32Array(NC), inQ = new Uint8Array(NC);
  const flood = async (seeds, limit, pass, out, label) => {   // pass(id): may the flood enter id; out: Float32Array of distances
    out.fill(1e9); let qh = 0, qt = 0, steps = 0;
    for (const id of seeds){ out[id] = 0; if (!inQ[id]){ inQ[id] = 1; queue[qt] = id; qt = (qt + 1) % NC; } }
    while (qh !== qt){ if ((++steps & 0xFFFF) === 0 && due()) await say(label, 0.5); const a = queue[qh]; qh = (qh + 1) % NC; inQ[a] = 0;
      for (let k = 0; k < 8; k++){ const b = nbr(a, k); if (!pass(b)) continue; const d = out[a] + dist(a, b); if (d < out[b] - 1e-3 && d <= limit){ out[b] = d; if (!inQ[b]){ inQ[b] = 1; queue[qt] = b; qt = (qt + 1) % NC; } } } }
    return out;
  };
  // ---- the trails: per point of each line, its bed, apron and kind (from the land 9 m either side against the bed)
  const nrm = p => { const l = Math.hypot(p[0], p[1], p[2]); return [p[0]/l, p[1]/l, p[2]/l]; };
  const notes = [];
  const tmpD = new Float32Array(NC);
  for (let ti = 0; ti < lines.length; ti++){
    const l = lines[ti], t = L.trails[ti], M = l.length; if (M < 2) continue;
    const bed = t.bed ?? 4, kind = new Uint8Array(M), depth = new Float32Array(M), hbA = new Float32Array(M);
    for (let i = 0; i < M; i++){
      const p = l[i], q2 = l[Math.min(M - 1, i + 1)], q1 = l[Math.max(0, i - 1)], tg = nrm([q2[0] - q1[0], q2[1] - q1[1], q2[2] - q1[2]]), sd = nrm([p[1]*tg[2] - p[2]*tg[1], p[2]*tg[0] - p[0]*tg[2], p[0]*tg[1] - p[1]*tg[0]]);
      const hb = T.height(p[0], p[1], p[2]), side = sg => H[cellOf(...nrm([p[0] + sg*9/R*sd[0], p[1] + sg*9/R*sd[1], p[2] + sg*9/R*sd[2]]))] - hb, a = side(-1), b = side(1);
      // (only where the trail crosses steep ground: a trail along a gentle gully isn't in a notch)
      const pc = cellOf(p[0], p[1], p[2]), steep = was[pc] || g.S[pc] > A.STOP;
      hbA[i] = hb; kind[i] = steep && a > 4 && b > 4 ? 1 : steep && a < -2 && b < -2 ? 3 : 0; depth[i] = kind[i] === 1 ? Math.min(a, b) : 0;
      if (!kind[i] && g.D[cellOf(p[0], p[1], p[2])] < bed + 1 && !was[cellOf(p[0], p[1], p[2])]) kind[i] = 3;   // a raised strip too narrow for it: a bridge
    }
    // notch runs: a slot, or a saddle if the slot would be too deep or too long
    for (let i = 0; i < M; ){ if (kind[i] !== 1){ i++; continue; } let j = i, dmax = 0; while (j < M && kind[j] === 1){ dmax = Math.max(dmax, depth[j]); j++; }
      const len = (j - i)*2, saddle = dmax > opt.slotDepth || len > opt.slotLength;
      for (let k = i; k < j; k++){ kind[k] = saddle ? 2 : 1; depth[k] = dmax; }
      notes.push({ what: saddle ? 'saddle' : 'slot', text: `${t.name}: a ${saddle ? 'saddle' : 'slot'} through a ridge, ${len} m long, ${Math.round(dmax)} m deep`, at: l[(i + j) >> 1] }); i = j; }
    // rasterise: each point marks the cells within its reach as bed, apron or cut
    for (let i = 0; i < M; i++){
      const p = l[i], x = p[0]*R, y = p[1]*R, z = p[2]*R;
      const n1 = PT_.noise3(p[0]*R/35 + 3.1, p[1]*R/35 - 7.7, p[2]*R/35 + 1.9), e1 = Math.max(0, Math.min(1, (n1 + 0.35)/0.7));
      const aw = kind[i] === 3 || kind[i] === 1 ? opt.apronMin : opt.apronMin + (opt.apronMax - opt.apronMin)*e1*e1*(3 - 2*e1);
      const reach = kind[i] === 2 ? bed + Math.min(25, depth[i]) : bed + aw;
      // a small flood from the point's cell (cells within reach, by straight distance to the point)
      const c0 = cellOf(p[0], p[1], p[2]), stack = [c0], seen = new Set([c0]);
      while (stack.length){ const a = stack.pop(); const d = Math.hypot(dir[a*3]*R - x, dir[a*3 + 1]*R - y, dir[a*3 + 2]*R - z);
        if (d > reach + CS) continue;
        if (d <= reach){ const f = d <= bed ? 1 : kind[i] === 2 ? 3 : 2; if (!F[a] || f < F[a]) F[a] = f; U[a] = 0; if (kind[i] === 1 && d <= bed + 1) slotBed[a] = 1; }
        for (let k = 0; k < 8; k++){ const b = nbr(a, k); if (!seen.has(b)){ seen.add(b); stack.push(b); } } }
    }
    if (due()) await say('Planning: the trails…', 0.1 + 0.2*ti/lines.length);
  }
  // ---- clean the map
  // unskiable strips thinner than minUnski: what an opening (narrow, then widen again by half the minimum) removes,
  // unless it's a tall wall
  await say('Planning: thin strips…', 0.35);
  const r1 = opt.minUnski/2, dIn = new Float32Array(NC), dCore = new Float32Array(NC);
  const notU = []; for (let id = 0; id < NC; id++) if (!U[id]){ for (let k = 0; k < 8; k++) if (U[nbr(id, k)]){ notU.push(id); break; } }
  await flood(notU, r1 + 2*CS, b => U[b] === 1, dIn, 'Planning: thin strips…');
  const core = []; for (let id = 0; id < NC; id++) if (U[id] && dIn[id] > r1) core.push(id);
  await flood(core, r1 + CS, b => U[b] === 1, dCore, 'Planning: thin strips…');
  const thin = new Uint8Array(NC); for (let id = 0; id < NC; id++) if (U[id] && dCore[id] > r1 + 0.5*CS) thin[id] = 1;
  // group the thin bits: a tall one (a wall) stays
  const keepWall = new Uint8Array(NC); let walls = 0, thinRemoved = 0;
  { const seen = new Uint8Array(NC);
    for (let s0 = 0; s0 < NC; s0++){ if (!thin[s0] || seen[s0]) continue; const comp = [s0]; seen[s0] = 1; let lo = H[s0], hi = H[s0], area = 0;
      for (let h = 0; h < comp.length; h++){ const a = comp[h]; area += AREA[a]; if (H[a] < lo) lo = H[a]; if (H[a] > hi) hi = H[a];
        for (let k = 0; k < 8; k++){ const b = nbr(a, k); if (thin[b] && !seen[b]){ seen[b] = 1; comp.push(b); } } }
      if (hi - lo >= opt.wall && area >= 30){ for (const a of comp) keepWall[a] = 1; walls++; notes.push({ what: 'wall', text: `Thin wall kept: ${Math.round(hi - lo)} m high, ${Math.round(area)} m²`, at: [dir[comp[0]*3], dir[comp[0]*3 + 1], dir[comp[0]*3 + 2]], area }); }
      else { for (const a of comp) U[a] = 0; thinRemoved += area; } } }
  // skiable gaps narrower than minSki with no trail in them: what a closing would fill
  await say('Planning: narrow gaps…', 0.55);
  const r2 = opt.minSki/2, onU = []; for (let id = 0; id < NC; id++) if (U[id]){ for (let k = 0; k < 8; k++) if (!U[nbr(id, k)]){ onU.push(id); break; } }
  await flood(onU, r2 + 2*CS, b => !U[b], dIn, 'Planning: narrow gaps…');
  const coreS = []; for (let id = 0; id < NC; id++) if (!U[id] && (dIn[id] > r2 || F[id])) coreS.push(id);
  await flood(coreS, r2 + CS, b => !U[b], dCore, 'Planning: narrow gaps…');
  let gapsClosed = 0; for (let id = 0; id < NC; id++) if (!U[id] && !F[id] && dCore[id] > r2 + 0.5*CS){ U[id] = 2; gapsClosed += AREA[id]; }
  for (let id = 0; id < NC; id++) if (U[id] === 2) U[id] = 1;
  // small unskiable bits and tiny skiable holes
  await say('Planning: specks…', 0.7);
  let specks = 0, holes = 0;
  { const seen = new Uint8Array(NC);
    for (let s0 = 0; s0 < NC; s0++){ if (seen[s0]) continue; const u = U[s0]; const comp = [s0]; seen[s0] = 1; let lo = H[s0], hi = H[s0], area = 0, trail = false;
      for (let h = 0; h < comp.length; h++){ const a = comp[h]; area += AREA[a]; if (F[a]) trail = true; if (H[a] < lo) lo = H[a]; if (H[a] > hi) hi = H[a];
        for (let k = 0; k < 8; k++){ const b = nbr(a, k); if (!seen[b] && U[b] === u){ seen[b] = 1; comp.push(b); } } }
      if (u && area < 60 && hi - lo < opt.wall && !comp.some(a => keepWall[a])){ for (const a of comp) U[a] = 0; specks++; }
      else if (!u && !trail && area < 20){ for (const a of comp) U[a] = 1; holes++; }
      if ((s0 & 0xFFFF) === 0 && due()) await say('Planning: specks…', 0.7 + 0.1*s0/NC); } }
  // ---- check: thin strips left (besides the kept walls), and trail beds that aren't skiable
  await say('Planning: checking…', 0.85);
  const bU = []; for (let id = 0; id < NC; id++) if (!U[id]){ for (let k = 0; k < 8; k++) if (U[nbr(id, k)]){ bU.push(id); break; } }
  await flood(bU, r1 + 2*CS, b => U[b] === 1, dIn, 'Planning: checking…');
  const core2 = []; for (let id = 0; id < NC; id++) if (U[id] && dIn[id] > r1) core2.push(id);
  await flood(core2, r1 + CS, b => U[b] === 1, dCore, 'Planning: checking…');
  let thinLeft = 0; for (let id = 0; id < NC; id++) if (U[id] && !keepWall[id] && dCore[id] > r1 + 0.5*CS) thinLeft += AREA[id];
  let bedsBlocked = 0; for (let id = 0; id < NC; id++) if (F[id] === 1 && U[id]) bedsBlocked++;
  // ---- the map's colours
  const pcls = new Uint8Array(NC), skis = g.skis, skiComp = g.skiComp;
  let toSki = 0, toUnski = 0;
  for (let id = 0; id < NC; id++){
    const u = U[id], w = was[id];
    if (u){ pcls[id] = keepWall[id] ? 6 : !w ? 5 : 1; if (!w) toUnski += AREA[id]; continue; }
    if (F[id] === 1){ pcls[id] = 2; if (w) toSki += AREA[id]; continue; }
    if (F[id] === 3){ pcls[id] = 10; if (w) toSki += AREA[id]; continue; }
    if (F[id] === 2){ pcls[id] = w ? 4 : 3; if (w) toSki += AREA[id]; continue; }
    if (w || A.grid.S[id] > A.STOP){ pcls[id] = 4; toSki += AREA[id]; continue; }
    const sk = skis[skiComp[id]]; pcls[id] = sk && sk.trail === 0 ? (sk.area < A.opt.trap ? 7 : 8) : 0;
  }
  // slot walls: unskiable ground within 4 m of a slot's floor
  { const seeds = []; for (let id = 0; id < NC; id++) if (slotBed[id]) seeds.push(id);
    if (seeds.length){ await flood(seeds, 4, () => true, dIn, 'Planning: checking…'); for (let id = 0; id < NC; id++) if (U[id] && dIn[id] <= 4) pcls[id] = 9; } }
  const summary = { toSkiable: Math.round(toSki), toUnskiable: Math.round(toUnski), thinRemoved: Math.round(thinRemoved), gapsClosed: Math.round(gapsClosed), walls, specks, holes,
    slots: notes.filter(n => n.what === 'slot').length, saddles: notes.filter(n => n.what === 'saddle').length, check: { thinLeft: Math.round(thinLeft), bedsBlocked } };
  await say('Planned', 1);
  return { U, F, keepWall, pcls, summary, notes: notes.sort((a, b) => (a.what === 'wall') - (b.what === 'wall') || (b.area || 0) - (a.area || 0)), opt };
};

(typeof window !== 'undefined' ? window : globalThis).PlanetCleanup = PC;
})();
