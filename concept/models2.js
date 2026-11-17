// Forty more standalone pieces, ten of each kind, each a variation made from a seed (so more can be had by changing it):
// sci-fi buildings, alien-settlement buildings, natural landscapes (the alien mountains of the art), winter alien flora.
function createConcept2(THREE, P){
  const M = P.MAT, R = s => { let x = s*9301 + 49297; return () => (x = (x*16807) % 2147483647)/2147483647; };
  const mesh = (g, m, x = 0, y = 0, z = 0) => { const o = new THREE.Mesh(g, m); o.position.set(x, y, z); return o; };
  const box = (w, h, d, m, x, y, z) => mesh(new THREE.BoxGeometry(w, h, d), m, x, y, z), cyl = (r0, r1, h, m, x = 0, y = 0, z = 0, s = 12) => mesh(new THREE.CylinderGeometry(r1, r0, h, s), m, x, y + h/2, z);
  const tube = (pts, r, m, seg = 6) => { const c = new THREE.CatmullRomCurve3(pts.map(p => new THREE.Vector3(...p))), n = pts.length*6, g = new THREE.TubeGeometry(c, n, 1, seg, false), p = g.attributes.position, q = new THREE.Vector3(), rf = typeof r === 'function' ? r : () => r;
    for (let i = 0; i <= n; i++){ c.getPointAt(i/n, q); const rr = rf(i/n); for (let j = 0; j <= seg; j++){ const k = i*(seg + 1) + j; p.setXYZ(k, q.x + (p.getX(k) - q.x)*rr, q.y + (p.getY(k) - q.y)*rr, q.z + (p.getZ(k) - q.z)*rr); } } g.computeVertexNormals(); return new THREE.Mesh(g, m); };
  const snow = new THREE.MeshStandardMaterial({ color: P.C(0xf2f6fb), roughness: 0.9, flatShading: true }), rock = new THREE.MeshStandardMaterial({ color: P.C(0x566277), roughness: 0.95, flatShading: true }), iceM = new THREE.MeshStandardMaterial({ color: P.C(0x8fc8e6), roughness: 0.12, metalness: 0.15, flatShading: true });
  const frost = new THREE.MeshStandardMaterial({ color: P.C(0xbfe3f2), roughness: 0.5, flatShading: true }), bark = new THREE.MeshStandardMaterial({ color: P.C(0x3a3350), roughness: 0.9, flatShading: true }), glowC = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.5, 2.0, 2.6) }), glowV = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.9, 0.8, 3.0) });
  const B = {};
  // ---- 10 sci-fi buildings: a base, a body of one of five kinds, and fittings, all from the seed
  for (let s = 1; s <= 10; s++) B['Sci-fi building ' + s] = () => { const r = R(s), g = new THREE.Group(), kind = s % 5, w = 8 + r()*10, h = 5 + r()*14; g.add(cyl(w*0.75, w*0.7, 0.8, M.dark, 0, 0, 0, 8 + (s % 3)*4));
    if (kind === 0){ g.add(cyl(w*0.35, w*0.28, h*1.6, M.panel, 0, 0.8, 0, 14), cyl(w*0.6, w*0.5, 2.4, M.steel, 0, h*1.2, 0, 16), cyl(w*0.61, w*0.61, 0.4, M.cyan, 0, h*1.2 + 1, 0, 16), cyl(0.1, 0.05, 8, M.steel, 0, h*1.6 + 0.8, 0, 5)); }
    else if (kind === 1){ g.add(mesh(new THREE.IcosahedronGeometry(w*0.6, 1), M.glass, 0, 0.8, 0), mesh(new THREE.IcosahedronGeometry(w*0.605, 1), new THREE.MeshBasicMaterial({ color: P.C(0x5b6978), wireframe: true }), 0, 0.8, 0), mesh(new THREE.SphereGeometry(w*0.18, 8, 6), M.warm, 0, 2, 0)); }
    else if (kind === 2){ for (let k = 0; k < 3; k++) g.add(box(w*(1 - k*0.22), h*0.4, w*0.7*(1 - k*0.18), k % 2 ? M.steel : M.panel, 0, 0.8 + h*0.2 + k*h*0.4, k*0.6), box(w*(1 - k*0.22) + 0.1, 0.5, 0.2, M.warm, 0, 0.8 + h*0.25 + k*h*0.4, -w*0.35*(1 - k*0.18) + k*0.6)); }
    else if (kind === 3){ for (let k = 0; k < 4; k++){ const x = (k - 1.5)*w*0.32; g.add(cyl(w*0.14, w*0.14, h, M.panel, x, 0.8, 0, 12), mesh(new THREE.SphereGeometry(w*0.14, 12, 6, 0, Math.PI*2, 0, Math.PI/2), M.panel, x, 0.8 + h, 0), cyl(w*0.145, w*0.145, 0.4, M.orange, x, h*0.5, 0, 12)); } g.add(box(w*1.2, 0.3, 0.3, M.steel, 0, h + 2, w*0.2)); }
    else { g.add(box(w, h*0.5, w*0.6, M.panel, 0, 0.8 + h*0.25, 0)); const v = mesh(new THREE.CylinderGeometry(w*0.3, w*0.3, w, 14, 1, false, 0, Math.PI), M.glass, 0, 0.8 + h*0.5, 0); v.rotation.z = Math.PI/2; v.rotation.y = Math.PI/2; g.add(v); }
    for (let k = 0; k < 2 + (s % 3); k++){ const a = r()*6.28, d = w*0.62; g.add(cyl(0.9, 0.9, 2 + r()*3, M.steel, Math.cos(a)*d, 0.8, Math.sin(a)*d, 8)); }
    g.add(box(2.2, 2.6, 1.6, M.panel, 0, 2.1, -w*0.62), box(1.2, 1.9, 0.1, M.cyan, 0, 1.8, -w*0.62 - 0.82), mesh(new THREE.SphereGeometry(0.3, 8, 6), M.red, w*0.3, h*1.7 + 2, 0), box(0.12, h*0.7 + 2, 0.12, M.steel, w*0.3, h*1.35 + 1, 0)); return g; };
  // ---- 10 alien-settlement buildings: makeshift, on and around old bone (tarps, scrap, lamps), after Frostveil's camps
  for (let s = 1; s <= 10; s++) B['Settlement building ' + s] = () => { const r = R(s + 40), g = new THREE.Group(), n = 1 + (s % 4);
    if (s % 2){ const pts = []; for (let i = 0; i <= 8; i++){ const a = i/8*Math.PI*(0.55 + r()*0.25); pts.push([-10 + Math.cos(a)*-0 + i*0.2, Math.sin(a)*(9 + s), -6 + i*1.6]); } g.add(tube([[-9, 0, -5], [-10, 7 + s*0.6, -2], [-6, 12 + s*0.7, 2], [1, 13 + s*0.6, 4]], t => 1.5*(1 - t*0.6), M.bone, 6)); }
    else g.add(mesh(new THREE.DodecahedronGeometry(5 + r()*3, 0), M.boneDark, -7, 2.5, 3));
    let x = -4; for (let k = 0; k < n; k++){ const w = 3.5 + r()*3, h = 2.4 + r()*1.4, d = 3 + r()*2, y = k % 2 && n > 2 ? 2.8 : 0; g.add(box(w, h, d, k % 2 ? M.adobe2 : M.adobe, x + w/2, y + h/2, 0), box(0.7, 0.9, 0.1, M.warm, x + w/2 - 0.5, y + h*0.55, -d/2 - 0.03));
      const aw = box(w*0.9, 0.07, 2.2, r() < 0.5 ? M.tarp : M.tarp2, x + w/2, y + h - 0.2, -d/2 - 1); aw.rotation.x = 0.3; g.add(aw); if (y) g.add(box(w + 0.6, 0.18, d + 1.4, M.steel, x + w/2, y - 0.1, -0.4), box(0.18, y, 0.18, M.dark, x + 0.2, y/2, -d/2 - 1), box(0.18, y, 0.18, M.dark, x + w - 0.2, y/2, -d/2 - 1)); x += w*(y ? 0.3 : 1.02); }
    const tent = mesh(new THREE.ConeGeometry(2 + r(), 2.4 + r(), 4 + (s % 3)), s % 3 ? M.tarp : M.tarp2, x + 2.5, 1.3, -1.5); tent.rotation.y = r()*3; g.add(tent, cyl(0.05, 0.05, 5 + r()*3, M.dark, x + 0.5, 0, 2, 4), box(1.2, 0.7, 0.05, M.tarp, x + 1.1, 5.2, 2), mesh(new THREE.SphereGeometry(0.3, 6, 5), M.warm, x + 3.5, 0.3, -3.6));
    for (let k = 0; k < 3; k++) g.add(box(0.8 + r()*0.6, 0.6 + r()*0.5, 0.8, k % 2 ? M.dark : M.steel, -2 + k*1.1 + r(), 0.4, -3.4)); if (s > 5) g.add(cyl(0.06, 0.03, 9, M.steel, x + 5, 0, 0, 4), mesh(new THREE.SphereGeometry(0.22, 6, 5), M.red, x + 5, 9.2, 0)); return g; };
  // ---- 10 natural landscapes: a patch of the alien mountains. a height field shaped by the seed into one of five forms
  // (needle peaks, a leaning horn, an ice-cliff mesa, a holed arch ridge, a frozen crater), rock on the steep, snow on the rest
  for (let s = 1; s <= 10; s++) B['Landscape ' + s] = () => { const r = R(s + 90), kind = s % 5, N = 56, S = 160, pos = [], col = [], idx = [], H = [], g = new THREE.Group();
    const pk = []; for (let k = 0; k < 3 + (s % 3); k++) pk.push([(r() - 0.5)*S*0.6, (r() - 0.5)*S*0.6, 30 + r()*60, 9 + r()*16]);
    const nz = (x, z) => Math.sin(x*0.09 + s)*Math.cos(z*0.07 - s*2)*3 + Math.sin(x*0.23 + z*0.19 + s)*1.4;
    const hf = (x, z) => { const d = Math.hypot(x, z), edge = Math.max(0, 1 - Math.pow(d/(S*0.5), 4)); let h = nz(x, z);
      if (kind === 0) for (const [px, pz, ph, pw] of pk){ const q = Math.hypot(x - px, z - pz); h += ph*Math.exp(-Math.pow(q/pw, 1.4)); }
      else if (kind === 1){ const q = Math.hypot(x - 10, z); h += 85*Math.exp(-Math.pow(q/26, 2))*(1 + 0.5*Math.max(0, x/40)) + 22*Math.exp(-Math.pow(Math.hypot(x + 35, z - 20)/22, 2)); }
      else if (kind === 2){ const q = Math.max(Math.abs(x)*0.9, Math.abs(z)); h += 34*(1 - 1/(1 + Math.exp(-(q - 38)*0.6))) + (q < 38 ? nz(z, x)*1.5 : 0); }
      else if (kind === 3){ const ridge = Math.exp(-Math.pow(z/14, 2)), gap = 1 - 0.95*Math.exp(-Math.pow(x/13, 2)); h += 58*ridge*(0.7 + 0.3*Math.sin(x*0.11 + s))*gap; }
      else { h += 30*Math.exp(-Math.pow((d - 42)/11, 2)) - 10*Math.exp(-Math.pow(d/30, 2)); }
      return h*edge; };
    for (let j = 0; j <= N; j++) for (let i = 0; i <= N; i++){ const x = (i/N - 0.5)*S, z = (j/N - 0.5)*S, h = hf(x, z); H.push(h); pos.push(x, h, z); }
    for (let j = 0; j <= N; j++) for (let i = 0; i <= N; i++){ const k = j*(N + 1) + i, dx = (H[k + (i < N ? 1 : 0)] - H[k - (i > 0 ? 1 : 0)])/(S/N*2), dz = (H[k + (j < N ? N + 1 : 0)] - H[k - (j > 0 ? N + 1 : 0)])/(S/N*2), sl = Math.hypot(dx, dz), t = Math.max(0, Math.min(1, (sl - 0.55)/0.5)), band = 0.85 + 0.15*Math.sin(H[k]*0.7);
      col.push(0.90*(1 - t) + 0.16*band*t, 0.93*(1 - t) + 0.19*band*t, 0.97*(1 - t) + 0.27*band*t); if (i < N && j < N) idx.push(k, k + N + 1, k + 1, k + 1, k + N + 1, k + N + 2); }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); geo.setIndex(idx); geo.computeVertexNormals(); g.add(new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92, flatShading: true })));
    if (kind === 3){ const pts = []; for (let i = 0; i <= 10; i++){ const a = Math.PI*i/10; pts.push([-Math.cos(a)*17, 30 + Math.sin(a)*26, 0]); } g.add(tube(pts, t => 4.5 - 2*Math.sin(t*Math.PI), rock, 7)); }
    if (kind === 2) for (let k = 0; k < 12; k++){ const a = k/12*6.28, ic = mesh(new THREE.ConeGeometry(1.2 + r(), 9 + r()*8, 5), iceM, Math.cos(a)*39, 14 + r()*6, Math.sin(a)*39*0.95); ic.rotation.x = Math.PI; g.add(ic); }
    if (kind === 4){ const lake = mesh(new THREE.CircleGeometry(24, 30), iceM, 0, hf(0, 0) + 1.2, 0); lake.rotation.x = -Math.PI/2; g.add(lake); }
    for (let k = 0; k < 14; k++){ const x = (r() - 0.5)*S*0.8, z = (r() - 0.5)*S*0.8; g.add(mesh(new THREE.DodecahedronGeometry(1 + r()*2.4, 0), k % 3 ? rock : snow, x, hf(x, z) + 0.5, z)); } return g; };
  // ---- 10 winter alien flora: five forms, two of each
  for (let s = 1; s <= 10; s++) B['Winter flora ' + s] = () => { const r = R(s + 140), g = new THREE.Group(), kind = s % 5, big = s > 5 ? 1.6 : 1;
    if (kind === 0){ // frost fan: a trunk that splits and splits, each tip a pale disc
      const grow = (p, dir, len, d) => { const e = [p[0] + dir[0]*len, p[1] + dir[1]*len, p[2] + dir[2]*len]; g.add(tube([p, [(p[0] + e[0])/2 + (r() - 0.5)*0.3, (p[1] + e[1])/2, (p[2] + e[2])/2 + (r() - 0.5)*0.3], e], t => 0.16*d*(1 - t*0.4), bark, 5));
        if (d <= 1){ const f = mesh(new THREE.CircleGeometry(0.5 + r()*0.4, 7), frost, ...e); f.material = frost; f.rotation.set(-1.2 + r()*0.6, r()*3, 0); f.material.side = THREE.DoubleSide; g.add(f, mesh(new THREE.SphereGeometry(0.07, 5, 4), glowC, ...e)); return; }
        for (let k = 0; k < 2 + (r() < 0.4 ? 1 : 0); k++){ const a = r()*6.28, t = 0.5 + r()*0.4, nd = [dir[0] + Math.cos(a)*t, dir[1] + 0.4, dir[2] + Math.sin(a)*t], l = Math.hypot(...nd); grow(e, nd.map(v => v/l), len*0.72, d - 1); } };
      grow([0, 0, 0], [0, 1, 0], 2.2*big, 4); }
    else if (kind === 1){ // glow bulbs: curling stalks hung with lit pods, snow on the caps
      for (let k = 0; k < 4 + (s % 3); k++){ const a = k*1.7 + r(), h = (2.5 + r()*3)*big, lean = 0.6 + r(), pts = [[0, 0, 0]]; for (let i = 1; i <= 5; i++){ const t = i/5; pts.push([Math.cos(a)*lean*t*t*2.4, h*t - t*t*h*0.25, Math.sin(a)*lean*t*t*2.4]); } g.add(tube(pts, t => 0.13*(1 - t*0.6), bark, 5));
        const e = pts[5]; g.add(mesh(new THREE.SphereGeometry(0.34*big, 8, 6), s % 2 ? glowV : glowC, e[0], e[1] - 0.3, e[2])); const cap = mesh(new THREE.SphereGeometry(0.4*big, 8, 5, 0, 6.28, 0, 1.4), snow, e[0], e[1] - 0.22, e[2]); g.add(cap); } }
    else if (kind === 2){ // ice coral: a spray of clear spikes on a frosted mound
      g.add(mesh(new THREE.SphereGeometry(1.3*big, 9, 6, 0, 6.28, 0, 1.5), snow, 0, -0.2, 0)); for (let k = 0; k < 16 + s; k++){ const a = r()*6.28, t = r()*1.1, l = (1.2 + r()*3)*big, c = mesh(new THREE.ConeGeometry(0.1 + r()*0.16, l, 5), k % 4 ? iceM : frost, Math.cos(a)*Math.sin(t)*(0.4 + l/2), Math.cos(t)*(0.4 + l/2), Math.sin(a)*Math.sin(t)*(0.4 + l/2)); c.rotation.set(Math.sin(a)*t, 0, -Math.cos(a)*t); g.add(c); } }
    else if (kind === 3){ // snow-cap shelf tree: a dark stem with wide flat tiers, each carrying snow, a light beneath each
      const h = (5 + r()*4)*big; g.add(tube([[0, 0, 0], [0.3, h*0.5, 0.2], [-0.2, h, 0]], t => 0.3*(1 - t*0.6), bark, 6)); for (let k = 0; k < 4 + (s % 2); k++){ const y = h*(0.3 + k*0.17), rr = (2.4 - k*0.42)*big, a = k*1.9; g.add(cyl(rr, rr*0.9, 0.12, bark, Math.cos(a)*0.4, y, Math.sin(a)*0.4, 9), cyl(rr*0.98, rr*0.7, 0.3, snow, Math.cos(a)*0.4, y + 0.12, Math.sin(a)*0.4, 9), mesh(new THREE.SphereGeometry(0.09, 5, 4), glowV, Math.cos(a)*0.4 + rr*0.7, y - 0.12, Math.sin(a)*0.4)); } }
    else { // tendril reed: a clump of tall thin stems that bow at the tip, beaded with light (after the moose's tendrils)
      for (let k = 0; k < 9 + s; k++){ const a = r()*6.28, d = r()*0.9, h = (3 + r()*4)*big, bx = Math.cos(a)*d, bz = Math.sin(a)*d, pts = []; for (let i = 0; i <= 5; i++){ const t = i/5; pts.push([bx + Math.cos(a)*t*t*t*1.8, h*(t - 0.18*t*t*t), bz + Math.sin(a)*t*t*t*1.8]); } g.add(tube(pts, t => 0.045*(1 - t*0.5), k % 3 ? frost : bark, 4)); const e = pts[5]; if (k % 2) g.add(mesh(new THREE.SphereGeometry(0.08, 5, 4), k % 4 === 1 ? glowC : glowV, ...e)); }
      g.add(mesh(new THREE.SphereGeometry(1.0*big, 8, 5, 0, 6.28, 0, 1.5), snow, 0, -0.35, 0)); }
    return g; };
  return B;
}
