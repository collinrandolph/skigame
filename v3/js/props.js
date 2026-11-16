// What stands on Hale: one builder per kind of site (world.js SITES). Each returns a THREE.Group with its origin on the
// ground, y up, -z the way it faces. After the concept art: Frostline-3's outpost, Frostveil's ruins, the moose court,
// the mine, the Heartcrystal. Colours are sRGB hex, converted to linear here; lights are colours brighter than 1,
// which the bloom pass picks up.
function createProps(THREE){
  const C = hex => new THREE.Color(hex).convertSRGBToLinear();
  const std = (hex, o = {}) => new THREE.MeshStandardMaterial(Object.assign({ color: C(hex), roughness: 0.8, metalness: 0, flatShading: true }, o));
  const glow = (r, g, b) => new THREE.MeshBasicMaterial({ color: new THREE.Color(r, g, b), fog: false });
  const MAT = {
    steel: std(0x8f9aa6, { roughness: 0.55, metalness: 0.3 }), dark: std(0x39414b, { roughness: 0.7 }), panel: std(0xe4e9ef, { roughness: 0.6 }), orange: std(0xe8732a, { roughness: 0.6 }),
    glass: new THREE.MeshStandardMaterial({ color: C(0x9fd4ee), roughness: 0.08, metalness: 0.2, transparent: true, opacity: 0.38, side: THREE.DoubleSide }),
    bone: std(0xc7d3e2, { roughness: 0.92 }), boneDark: std(0x55647a, { roughness: 0.95 }), stone: std(0xdfe5ee, { roughness: 0.9 }), white: std(0xf3f5f8, { roughness: 0.55, flatShading: false }),
    gold: std(0xe6bf4f, { roughness: 0.35, metalness: 0.7 }), hide: std(0x3b2b47, { roughness: 0.9 }), antler: std(0x2a2033, { roughness: 0.8 }), tarp: std(0xd9622b, { roughness: 0.9, side: THREE.DoubleSide }), tarp2: std(0x8e3b2a, { roughness: 0.9, side: THREE.DoubleSide }),
    crystal: new THREE.MeshStandardMaterial({ color: C(0x8a5ce6), emissive: new THREE.Color(0.30, 0.10, 0.80), emissiveIntensity: 0.42, roughness: 0.12, metalness: 0.25, flatShading: true }),
    ore: new THREE.MeshStandardMaterial({ color: C(0x2f9fd8), emissive: new THREE.Color(0.1, 0.75, 1.5), emissiveIntensity: 1.0, roughness: 0.2, flatShading: true }),
    warm: glow(3.2, 1.7, 0.55), cyan: glow(0.6, 2.2, 2.8), red: glow(3.0, 0.35, 0.25), off: std(0x2a3038, { roughness: 0.4 }), goldGlow: glow(2.6, 1.9, 0.5), violet: glow(1.9, 0.8, 3.2),
    robes: [0xc2318f, 0x2f7fd0, 0x7a3fd6, 0x2aa7a0].map(h => std(h, { roughness: 0.85, side: THREE.DoubleSide })),
  };
  const lampMat = () => new THREE.MeshBasicMaterial({ color: new THREE.Color(0.05, 0.06, 0.08), fog: false });      // a light that is off until its group is lit
  const mesh = (geo, mat, x = 0, y = 0, z = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); return m; };
  const box = (w, h, d, mat, x, y, z) => mesh(new THREE.BoxGeometry(w, h, d), mat, x, y, z);
  const cyl = (r0, r1, h, mat, x = 0, y = 0, z = 0, seg = 10) => mesh(new THREE.CylinderGeometry(r1, r0, h, seg), mat, x, y + h/2, z);
  const G = (...kids) => { const g = new THREE.Group(); kids.forEach(k => k && g.add(k)); return g; };
  // a tube along points [[x,y,z]...], radius r (or a function of 0..1)
  const tube = (pts, r, mat, seg = 7) => { const curve = new THREE.CatmullRomCurve3(pts.map(p => new THREE.Vector3(...p))), n = Math.max(8, pts.length*5), g = new THREE.TubeGeometry(curve, n, 1, seg, false), p = g.attributes.position, c = new THREE.Vector3();
    const rf = typeof r === 'function' ? r : () => r;
    for (let i = 0; i <= n; i++){ curve.getPointAt(i/n, c); const rr = rf(i/n); for (let j = 0; j <= seg; j++){ const k = i*(seg + 1) + j; p.setXYZ(k, c.x + (p.getX(k) - c.x)*rr, c.y + (p.getY(k) - c.y)*rr, c.z + (p.getZ(k) - c.z)*rr); } }
    g.computeVertexNormals(); return new THREE.Mesh(g, mat); };
  // a pointed six-sided crystal, base at the origin, leaning by (lx, lz)
  const shard = (r, h, mat, lx = 0, lz = 0, x = 0, z = 0) => { const g = new THREE.CylinderGeometry(r*0.72, r, h*0.72, 6, 1), tip = new THREE.ConeGeometry(r*0.72, h*0.28, 6); g.translate(0, h*0.36, 0); tip.translate(0, h*0.86, 0);
    const a = new THREE.Mesh(g, mat), b = new THREE.Mesh(tip, mat), grp = G(a, b); grp.rotation.set(lz, r*7.3, -lx); grp.position.set(x, -h*0.03, z); return grp; };

  const B = {};
  // ---------------- wayfinding and power
  B.relay = () => { const lamp = lampMat(), g = G(cyl(2.2, 1.9, 1.2, MAT.dark, 0, 0, 0, 12), cyl(1.5, 0.95, 8.5, MAT.panel, 0, 1.2, 0, 12), cyl(1.42, 1.3, 1.1, MAT.orange, 0, 3.6, 0, 12), cyl(1.5, 1.5, 0.25, MAT.dark, 0, 9.7, 0, 12),
      cyl(0.95, 0.95, 1.7, lamp, 0, 9.95, 0, 10), cyl(1.25, 0.2, 1.0, MAT.orange, 0, 11.65, 0, 10), cyl(0.05, 0.05, 2.6, MAT.steel, 0, 12.6, 0, 5));
    const beam = mesh(new THREE.CylinderGeometry(0.5, 1.1, 420, 10, 1, true), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.5, 1.5, 2.0), transparent: true, opacity: 0.0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false }), 0, 222, 0);
    g.add(beam); g.userData = { lamp, beam, lit(on){ lamp.color.setRGB(on ? 0.6 : 0.05, on ? 2.2 : 0.06, on ? 2.8 : 0.08); beam.material.opacity = on ? 0.5 : 0; beam.visible = on; } }; g.userData.lit(false); return g; };
  B.pylon = () => { const lamp = lampMat(), g = G(box(0.35, 9.5, 0.35, MAT.steel, -1.1, 4.75, 0), box(0.35, 9.5, 0.35, MAT.steel, 1.1, 4.75, 0), box(5.2, 0.3, 0.3, MAT.steel, 0, 9.2, 0), box(2.6, 0.2, 0.2, MAT.steel, 0, 6, 0),
      box(0.3, 0.9, 0.3, lamp, -2.4, 8.6, 0), box(0.3, 0.9, 0.3, lamp, 2.4, 8.6, 0));
    g.children[0].rotation.z = -0.1; g.children[1].rotation.z = 0.1; g.userData = { lit(on){ lamp.color.setRGB(on ? 0.6 : 0.05, on ? 2.2 : 0.06, on ? 2.8 : 0.08); } }; return g; };
  B.sign = () => G(cyl(0.09, 0.09, 2.6, MAT.dark), box(1.5, 0.5, 0.08, MAT.orange, 0, 2.5, 0), box(1.2, 0.4, 0.08, MAT.panel, 0, 1.9, 0));
  B.portal = () => { const lamp = lampMat(), ring = mesh(new THREE.TorusGeometry(4.6, 0.22, 8, 40), lamp, 0, 4.6, 0), g = G(ring, cyl(0.7, 0.45, 5.5, MAT.white, -4.6, 0, 0, 8), cyl(0.7, 0.45, 5.5, MAT.white, 4.6, 0, 0, 8));
    for (const x of [-4.6, 4.6]) g.add(shard(0.55, 2.0, MAT.crystal, 0, 0, x, 0).translateY(5.4));
    g.userData = { lit(on){ lamp.color.setRGB(on ? 1.9 : 0.05, on ? 0.8 : 0.06, on ? 3.2 : 0.08); } }; return g; };

  // ---------------- the story's furniture: terminals, gates, bridge posts (main.js sets their state from the rules)
  // a terminal: a console by the trail and a beacon mast behind it. 0 asleep, 1 running (amber), 2 powered (cyan, and a column of light)
  B.terminal = () => { const scr = lampMat(), lamp = lampMat(), g = G(box(1.5, 1.0, 0.8, MAT.dark, 0, 0.5, 0), box(1.3, 0.75, 0.1, scr, 0, 1.35, -0.18), box(1.5, 0.12, 0.9, MAT.orange, 0, 1.05, 0), cyl(0.5, 0.36, 8.5, MAT.panel, 0, 0, 1.6, 10), cyl(0.5, 0.46, 0.8, MAT.orange, 0, 3.4, 1.6, 10),
      cyl(0.55, 0.55, 1.1, lamp, 0, 8.5, 1.6, 10), cyl(0.7, 0.1, 0.7, MAT.orange, 0, 9.6, 1.6, 10)); g.children[1].rotation.x = -0.45;
    const beam = mesh(new THREE.CylinderGeometry(0.35, 0.8, 320, 10, 1, true), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.45, 1.4, 1.9), transparent: true, opacity: 0.42, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false }), 0, 170, 1.6); g.add(beam);
    g.userData = { set(v){ scr.color.setRGB(v === 2 ? 0.5 : v === 1 ? 2.6 : 0.06, v === 2 ? 2.1 : v === 1 ? 1.5 : 0.07, v === 2 ? 2.7 : v === 1 ? 0.3 : 0.09); lamp.color.copy(scr.color); beam.visible = v === 2; } }; g.userData.set(0); return g; };
  // a gate across a cut in the ridge: two towers, a lintel, and a wall of light while it is shut
  const gateOf = (span, high, bar, crystal) => () => { const lamp = lampMat(), wall = mesh(new THREE.PlaneGeometry(span*2 - 1.5, high), new THREE.MeshBasicMaterial({ color: new THREE.Color(...bar), transparent: true, opacity: 0.2, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false }), 0, high/2 + 0.2, 0);
    const g = G(wall, box(span*2 + 3, 1.2, 2.4, crystal ? MAT.white : MAT.steel, 0, high + 0.9, 0), box(span*2 - 2, 0.3, 0.3, lamp, 0, high + 0.1, -1.25));
    for (const sd of [-1, 1]){ g.add(cyl(1.7, 1.25, high + 0.4, crystal ? MAT.white : MAT.dark, sd*span, 0, 0, crystal ? 12 : 6), box(0.5, 1.6, 0.5, lamp, sd*(span - 1.5), high - 1.4, -1.0));
      if (crystal) g.add(shard(0.9, 4.2, MAT.crystal, 0, 0, sd*span, 0).translateY(high + 1.4)); else g.add(box(3.2, 1.0, 3.2, MAT.orange, sd*span, high + 2.0, 0)); }
    g.userData = { open(on){ wall.visible = !on; lamp.color.setRGB(on ? 0.4 : 2.8, on ? 2.4 : 0.35, on ? 1.2 : 0.2); } }; g.userData.open(false); return g; };
  B.gate = gateOf(13.5, 9, [2.4, 0.5, 0.25], false);
  B.crystalgate = gateOf(13.5, 12, [1.5, 0.6, 2.8], true);
  // the post that lowers a drawbridge
  B.post = () => { const lamp = lampMat(), g = G(cyl(0.3, 0.24, 1.5, MAT.dark, 0, 0, 0, 8), box(0.7, 0.5, 0.5, MAT.orange, 0, 1.6, 0), box(0.5, 0.3, 0.08, lamp, 0, 1.62, -0.27), cyl(0.05, 0.05, 1.3, MAT.steel, 0, 1.8, 0, 5), mesh(new THREE.SphereGeometry(0.16, 8, 6), lamp, 0, 3.15, 0));
    g.userData = { set(v){ lamp.color.setRGB(v === 2 ? 0.4 : v === 1 ? 2.6 : 2.4, v === 2 ? 2.4 : v === 1 ? 1.5 : 0.3, v === 2 ? 1.2 : 0.3); } }; g.userData.set(0); return g; };
  // ---------------- Frostline-3
  B.dome = () => { const r = 12, g = G(cyl(r + 0.6, r + 0.2, 1.4, MAT.panel, 0, 0, 0, 24), mesh(new THREE.IcosahedronGeometry(r, 2), MAT.glass, 0, 1.2, 0));
    const frame = mesh(new THREE.IcosahedronGeometry(r*1.005, 2), new THREE.MeshBasicMaterial({ color: C(0x5b6978), wireframe: true }), 0, 1.2, 0); g.add(frame);
    g.add(mesh(new THREE.SphereGeometry(3.2, 10, 8), MAT.warm, 0, 2.6, 0), box(4.5, 3.4, 5, MAT.panel, 0, 1.7, -r - 0.8), box(1.8, 2.3, 0.2, MAT.warm, 0, 1.3, -r - 3.35), cyl(2.2, 2.2, 5, MAT.steel, r*0.55, 1.2, r*0.2, 10)); return g; };
  B.tower = () => { const g = G(cyl(5, 4.4, 5, MAT.panel, 0, 0, 0, 12), cyl(2.6, 2.3, 17, MAT.steel, 0, 5, 0, 12), cyl(4.2, 3.6, 2.6, MAT.panel, 0, 21, 0, 14), cyl(4.25, 4.25, 0.5, MAT.cyan, 0, 22.0, 0, 14), cyl(3.2, 0.8, 2.4, MAT.orange, 0, 23.6, 0, 12), cyl(0.12, 0.05, 9, MAT.steel, 0, 26, 0, 5), cyl(0.08, 0.05, 5, MAT.steel, 1.2, 25.5, 0.6, 5));
    for (let k = 0; k < 4; k++) g.add(box(0.5, 1.1, 0.5, MAT.warm, Math.cos(k*1.57)*2.5, 9 + k*2.6, Math.sin(k*1.57)*2.5)); g.add(mesh(new THREE.SphereGeometry(0.35, 8, 6), MAT.red, 0, 35.2, 0)); return g; };
  B.dish = () => { const prof = []; for (let i = 0; i <= 10; i++){ const t = i/10; prof.push(new THREE.Vector2(0.3 + 6.2*t, 2.2*t*t)); }
    const bowl = mesh(new THREE.LatheGeometry(prof, 20), new THREE.MeshStandardMaterial({ color: C(0xe4e9ef), roughness: 0.5, side: THREE.DoubleSide, flatShading: true })), head = G(bowl, cyl(0.1, 0.1, 5, MAT.steel, 0, 0, 0, 5), mesh(new THREE.SphereGeometry(0.45, 8, 6), MAT.orange, 0, 5, 0));
    head.position.y = 8.5; head.rotation.x = -0.75; return G(cyl(2.4, 1.6, 3, MAT.dark, 0, 0, 0, 10), cyl(0.9, 0.7, 6, MAT.steel, 0, 3, 0, 8), head, box(3.5, 2.4, 3, MAT.panel, 4.5, 1.2, 1)); };
  B.pad = () => { const g = G(cyl(11, 10.4, 0.7, MAT.dark, 0, 0, 0, 8), mesh(new THREE.TorusGeometry(6.5, 0.18, 6, 32), MAT.orange, 0, 0.75, 0), box(8, 0.06, 0.7, MAT.orange, 0, 0.74, 0), box(0.7, 0.06, 8, MAT.orange, 0, 0.74, 0)); g.children[1].rotation.x = Math.PI/2;
    for (let k = 0; k < 8; k++) g.add(box(0.3, 0.3, 0.3, k % 2 ? MAT.cyan : MAT.warm, Math.cos(k*0.785 + 0.39)*10.2, 0.85, Math.sin(k*0.785 + 0.39)*10.2));
    // the shuttle that brought you
    const hull = mesh(new THREE.CylinderGeometry(1.5, 2.0, 11, 10), MAT.panel, 0, 3.0, 0); hull.rotation.x = Math.PI/2; hull.scale.set(1.25, 1, 0.8);
    const nose = mesh(new THREE.ConeGeometry(1.5, 4, 10), MAT.panel, 0, 3.0, -7.5); nose.rotation.x = -Math.PI/2; nose.scale.set(1.25, 1, 0.8);
    g.add(hull, nose, box(11, 0.3, 4, MAT.steel, 0, 2.7, 2.2), box(0.3, 3.2, 3, MAT.orange, 0, 5.0, 4), box(2.2, 0.9, 2.2, MAT.visor || MAT.dark, 0, 3.9, -4.2), box(0.3, 2.2, 0.3, MAT.dark, -3.5, 1.4, 1.5), box(0.3, 2.2, 0.3, MAT.dark, 3.5, 1.4, 1.5), box(0.3, 2.2, 0.3, MAT.dark, 0, 1.4, -5),
      mesh(new THREE.CylinderGeometry(0.9, 1.2, 1.2, 8), MAT.dark, -1.4, 3, 5.9), mesh(new THREE.CylinderGeometry(0.9, 1.2, 1.2, 8), MAT.dark, 1.4, 3, 5.9)); g.children[g.children.length - 1].rotation.x = g.children[g.children.length - 2].rotation.x = Math.PI/2; return g; };
  B.mast = () => { const g = G(); for (const [x, z] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]){ const leg = box(0.22, 24, 0.22, MAT.steel, x*1.3, 12, z*1.3); leg.rotation.set(z*0.045, 0, -x*0.045); g.add(leg); }
    for (let k = 1; k < 6; k++){ const s = 2.5 - k*0.33; g.add(box(s, 0.12, 0.12, MAT.steel, 0, k*4, s/2), box(s, 0.12, 0.12, MAT.steel, 0, k*4, -s/2), box(0.12, 0.12, s, MAT.steel, s/2, k*4, 0), box(0.12, 0.12, s, MAT.steel, -s/2, k*4, 0)); }
    g.add(box(3, 0.3, 3, MAT.dark, 0, 20, 0), cyl(0.08, 0.04, 7, MAT.steel, 0, 24, 0, 5), mesh(new THREE.SphereGeometry(0.4, 8, 6), MAT.red, 0, 31.2, 0), box(1.4, 1.0, 0.1, MAT.tarp, 0.9, 22, 0)); return g; };
  B.camp = () => { const tent = (w, h, d, mat, x, z, ry) => { const m = mesh(new THREE.ConeGeometry(w, h, 4), mat, x, h/2, z); m.rotation.y = ry; m.scale.z = d; return m; };
    return G(tent(2.6, 2.6, 1.3, MAT.tarp, 0, 0, 0.4), tent(1.9, 2.0, 1.2, MAT.tarp2, 3.4, 1.2, 1.2), box(1.0, 0.7, 0.8, MAT.dark, -2.6, 0.35, 0.8), box(0.8, 0.6, 0.8, MAT.steel, -2.4, 0.95, 0.9), cyl(0.05, 0.05, 4.2, MAT.dark, 1.6, 0, -1.6, 5), box(1.1, 0.6, 0.04, MAT.tarp, 2.2, 3.8, -1.6),
      mesh(new THREE.SphereGeometry(0.28, 6, 5), MAT.warm, 1.4, 0.3, 2.4)); };
  B.excavator = () => { const boom = G(box(1.0, 1.0, 17, MAT.orange, 0, 0, -8.5), box(0.5, 0.5, 15, MAT.steel, 0, 1.6, -8)), wheel = mesh(new THREE.TorusGeometry(2.6, 0.7, 6, 12), MAT.steel, 0, 0, -17.5); wheel.rotation.y = Math.PI/2; boom.add(wheel); boom.position.set(0, 6.5, -1); boom.rotation.x = 0.42;
    return G(box(7, 1.8, 9, MAT.dark, 0, 0.9, 0), box(5.2, 3.6, 6, MAT.orange, 0, 3.6, 0.6), box(2.4, 2.2, 2.4, MAT.panel, 1.6, 6.5, -1.4), box(2.0, 1.0, 0.1, MAT.warm, 1.6, 6.7, -2.65), boom, box(0.4, 7, 0.4, MAT.steel, 0, 8.5, 2.8), box(0.5, 0.5, 0.5, MAT.red, 0, 12.2, 2.8)); };

  // ---------------- Frostveil: what they left
  B.arch = () => { const pts = []; for (let i = 0; i <= 12; i++){ const a = Math.PI*i/12; pts.push([-Math.cos(a)*15, Math.sin(a)*21 + Math.sin(a*3)*0.8, Math.sin(a*2)*1.2]); }
    const g = G(tube(pts, t => 2.4 - 1.1*Math.sin(t*Math.PI)*0.6 + 0.5*Math.sin(t*38), MAT.bone, 8));
    for (let i = 2; i <= 10; i++){ const a = Math.PI*i/12; g.add(mesh(new THREE.OctahedronGeometry(1.5 + 0.5*Math.sin(i), 0), MAT.bone, -Math.cos(a)*15.8, Math.sin(a)*22.6, 0)); }
    for (const sd of [-1, 1]) g.add(tube([[sd*15, 0, 0], [sd*19, 5, 3], [sd*20, 12, 5], [sd*17, 17, 4]], t => 1.2*(1 - t*0.7), MAT.bone, 6)); return g; };
  B.ribs = () => { const g = G(); const n = 7;
    for (let k = 0; k < n; k++){ const z = (k - (n - 1)/2)*8.5, H = 38*(0.55 + 0.45*Math.sin((k + 0.6)/n*Math.PI)), Wd = H*0.62;
      for (const sd of [-1, 1]){ const pts = []; for (let i = 0; i <= 8; i++){ const t = i/8, a = t*Math.PI*0.62; pts.push([sd*(Wd*Math.cos(a*0.9) + (1 - t)*2), H*Math.sin(a), z + Math.sin(t*3)*1.2]); }
        g.add(tube(pts, t => 1.9*(1 - t*0.72) + 0.25*Math.sin(t*30), k % 3 === 2 && sd > 0 ? MAT.boneDark : MAT.bone, 6)); } }
    const sp = []; for (let k = -1; k <= n; k++) sp.push([0, 30 + 8*Math.sin((k + 0.6)/n*Math.PI), (k - (n - 1)/2)*8.5]); g.add(tube(sp, 2.3, MAT.bone, 7));
    for (let k = 0; k < n; k++) g.add(mesh(new THREE.DodecahedronGeometry(2.9, 0), MAT.bone, 0, 31.5 + 8*Math.sin((k + 0.6)/n*Math.PI), (k - (n - 1)/2)*8.5)); return g; };
  B.watcher = () => { const prof = [[5.5, 0], [4.6, 6], [3.6, 16], [3.9, 24], [2.8, 36], [3.1, 44], [1.8, 54], [0.3, 62]].map(([r, y]) => new THREE.Vector2(r, y));
    const body = mesh(new THREE.LatheGeometry(prof, 9), MAT.bone); body.geometry.computeVertexNormals();
    const g = G(body); for (let k = 0; k < 3; k++){ const pts = []; for (let i = 0; i <= 10; i++){ const t = i/10, a = k*2.09 + t*2.2, r = 5.8*(1 - t*0.82); pts.push([Math.cos(a)*r, t*56, Math.sin(a)*r]); } g.add(tube(pts, t => 1.1*(1 - t*0.7), MAT.bone, 5)); }
    for (let k = 0; k < 7; k++){ const y = 10 + k*6.5, a = k*1.7, r = 3.9 - k*0.42; const eye = mesh(new THREE.SphereGeometry(1.25 - k*0.08, 8, 6), MAT.boneDark, Math.cos(a)*r, y, Math.sin(a)*r); eye.scale.set(1, 1.6, 1); g.add(eye); }
    g.add(mesh(new THREE.OctahedronGeometry(0.9, 0), MAT.cyan, 0, 62.6, 0)); return g; };

  // ---------------- the court
  B.crystal = () => { const g = G(shard(1.0, 5.2, MAT.crystal), shard(0.7, 3.3, MAT.crystal, 0.35, 0.1, 0.9, 0.3), shard(0.55, 2.6, MAT.crystal, -0.3, 0.25, -0.8, 0.5), shard(0.45, 1.9, MAT.crystal, 0.1, -0.4, 0.2, -0.9)); return g; };
  B.ore = () => { const g = G(mesh(new THREE.DodecahedronGeometry(1.6, 0), MAT.boneDark, 0, 0.5, 0), shard(0.5, 2.4, MAT.ore, 0.3, 0.1, 0.4, 0.2), shard(0.4, 1.7, MAT.ore, -0.4, 0.2, -0.5, 0.1), shard(0.3, 1.3, MAT.ore, 0.1, -0.5, 0, -0.6)); g.children[0].scale.y = 0.6; return g; };
  B.column = () => G(cyl(1.0, 0.9, 0.6, MAT.white, 0, 0, 0, 12), cyl(0.68, 0.6, 8.2, MAT.white, 0, 0.6, 0, 14), cyl(0.85, 0.95, 0.5, MAT.white, 0, 8.8, 0, 12), shard(0.42, 1.7, MAT.crystal).translateY(9.3));
  B.circle = () => { const g = G(mesh(new THREE.CylinderGeometry(13, 13.4, 0.35, 40), MAT.stone, 0, 0.17, 0)); const ring = mesh(new THREE.TorusGeometry(10.5, 0.09, 6, 64), MAT.goldGlow, 0, 0.4, 0); ring.rotation.x = Math.PI/2; const ring2 = mesh(new THREE.TorusGeometry(5.2, 0.07, 6, 48), MAT.violet, 0, 0.4, 0); ring2.rotation.x = Math.PI/2; g.add(ring, ring2);
    for (let k = 0; k < 8; k++){ const l = mesh(new THREE.BoxGeometry(0.08, 0.04, 5.2), MAT.violet, 0, 0.4, 0); l.rotation.y = k*Math.PI/8; g.add(l); } return g; };
  B.temple = () => { const g = G(cyl(8.6, 8.2, 0.5, MAT.white, 0, 0, 0, 24), cyl(7.6, 7.4, 0.5, MAT.white, 0, 0.5, 0, 24), cyl(5.0, 5.0, 5.6, MAT.white, 0, 1.0, 0, 20), cyl(6.9, 6.9, 0.6, MAT.white, 0, 6.6, 0, 24));
    const dome = mesh(new THREE.SphereGeometry(6.2, 24, 12, 0, Math.PI*2, 0, Math.PI/2), MAT.white, 0, 7.2, 0); g.add(dome, shard(0.7, 3.0, MAT.crystal).translateY(13.2), box(2.4, 4.0, 0.5, MAT.violet, 0, 3.0, -4.9));
    for (let k = 0; k < 8; k++){ const a = k*Math.PI/4 + Math.PI/8; g.add(cyl(0.5, 0.45, 5.6, MAT.white, Math.cos(a)*6.6, 1.0, Math.sin(a)*6.6, 10)); } return g; };
  B.moose = (site) => { const robed = site && site.robe !== undefined, hide = MAT.hide, g = G();
    const body = mesh(new THREE.BoxGeometry(0.95, 1.15, 2.3, 1, 1, 2), hide, 0, 1.75, 0); { const p = body.geometry.attributes.position; for (let i = 0; i < p.count; i++){ if (p.getZ(i) < -0.5 && p.getY(i) > 0) p.setY(i, p.getY(i) + 0.32); if (p.getZ(i) > 0.5) p.setX(i, p.getX(i)*0.82); } body.geometry.computeVertexNormals(); }
    g.add(body); for (const [x, z] of [[-0.3, -0.85], [0.3, -0.85], [-0.28, 0.9], [0.28, 0.9]]) g.add(box(0.2, 1.3, 0.22, hide, x, 0.65, z));
    const neck = box(0.5, 1.0, 0.6, hide, 0, 2.35, -1.35); neck.rotation.x = 0.7; const head = box(0.46, 0.5, 1.0, hide, 0, 2.6, -2.05); head.rotation.x = 0.25; const nose = box(0.5, 0.42, 0.5, hide, 0, 2.38, -2.6); g.add(neck, head, nose);
    for (const sd of [-1, 1]){ const palm = mesh(new THREE.CylinderGeometry(0.62, 0.3, 0.07, 7), MAT.antler, sd*0.85, 3.25, -1.75); palm.rotation.set(0.25, 0, sd*-0.95); palm.scale.z = 1.5; g.add(palm, box(0.5, 0.09, 0.09, MAT.antler, sd*0.42, 2.95, -1.8));
      for (let k = 0; k < 4; k++){ const tine = mesh(new THREE.ConeGeometry(0.06, 0.5, 5), MAT.antler, sd*(1.05 + k*0.12), 3.6 + (k % 2)*0.1, -2.3 + k*0.36); tine.rotation.z = sd*-0.5; g.add(tine); } }
    for (let k = 0; k < 3; k++) g.add(cyl(0.03, 0.012, 1.1, MAT.violet, (k - 1)*0.12, 1.25, -2.5, 4));          // the long beard, faintly lit
    if (robed){ const robe = mesh(new THREE.BoxGeometry(1.16, 1.25, 1.9), MAT.robes[site.robe % 4], 0, 1.72, 0.05); robe.scale.y = 1.0; g.add(robe, box(1.2, 0.1, 1.94, MAT.gold, 0, 1.1, 0.05), box(1.2, 0.1, 1.94, MAT.gold, 0, 2.36, 0.05));
      const crown = mesh(new THREE.CylinderGeometry(0.3, 0.26, 0.2, 8, 1, true), MAT.gold, 0, 3.0, -2.0); g.add(crown); for (let k = 0; k < 5; k++) g.add(mesh(new THREE.ConeGeometry(0.06, 0.24, 4), MAT.gold, Math.cos(k*1.257)*0.27, 3.2, -2.0 + Math.sin(k*1.257)*0.27)); }
    return g; };
  // ---------------- the Heartcrystal: 190 m of it, on the mound
  B.heart = () => { const mat = MAT.crystal.clone(); mat.emissiveIntensity = 0.4; const g = G(shard(26, 196, mat));
    const side = [[13, 120, 0.16, 0.05, 22, 6], [10, 92, -0.2, 0.12, -20, 10], [15, 140, 0.05, -0.18, 6, -24], [9, 70, -0.1, 0.24, -8, 24], [8, 58, 0.28, -0.1, 26, -12], [11, 104, -0.24, -0.14, -24, -12], [6, 44, 0.3, 0.2, 14, 26]];
    for (const [r, h, lx, lz, x, z] of side) g.add(shard(r, h, mat, lx, lz, x, z));
    g.userData = { wake(k){ mat.emissiveIntensity = 0.4 + 1.9*k; } }; return g; };

  // ---------------- instanced things: one geometry each, with vertex colours
  function merged(parts){ // [{ geo, color }]: one non-indexed geometry with position, normal, color
    const pos = [], nor = [], col = [];
    for (const { geo, color } of parts){ const g = geo.index ? geo.toNonIndexed() : geo; g.computeVertexNormals(); const p = g.attributes.position, n = g.attributes.normal, c = C(color);
      for (let i = 0; i < p.count; i++){ pos.push(p.getX(i), p.getY(i), p.getZ(i)); nor.push(n.getX(i), n.getY(i), n.getZ(i)); col.push(c.r, c.g, c.b); } }
    const out = new THREE.BufferGeometry(); out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); out.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); out.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); return out; }
  const at = (geo, x, y, z) => { geo.translate(x, y, z); return geo; };
  // a spruce carrying snow: three tiers, each with a white cap; and a frosted one for the cold hollows
  const treeGeo = (green, snow) => merged([{ geo: at(new THREE.CylinderGeometry(0.13, 0.2, 1.4, 5), 0, 0.7, 0), color: 0x4a3a34 },
    { geo: at(new THREE.ConeGeometry(1.5, 2.6, 7), 0, 2.2, 0), color: green }, { geo: at(new THREE.ConeGeometry(1.52, 0.9, 7), 0, 3.07, 0), color: snow },
    { geo: at(new THREE.ConeGeometry(1.15, 2.2, 7), 0, 3.9, 0), color: green }, { geo: at(new THREE.ConeGeometry(1.17, 0.8, 7), 0, 4.61, 0), color: snow },
    { geo: at(new THREE.ConeGeometry(0.75, 1.9, 7), 0, 5.5, 0), color: green }, { geo: at(new THREE.ConeGeometry(0.77, 1.0, 7), 0, 5.96, 0), color: snow }]);
  const poleGeo = () => merged([{ geo: at(new THREE.CylinderGeometry(0.035, 0.045, 2.0, 5), 0, 1.0, 0), color: 0xe8732a }, { geo: at(new THREE.CylinderGeometry(0.04, 0.04, 0.3, 5), 0, 1.45, 0), color: 0xf3f5f8 }]);
  const lampGeo = () => at(new THREE.SphereGeometry(0.09, 6, 5), 0, 2.08, 0);
  return { build: B, MAT, treeGeo, poleGeo, lampGeo, C, std, glow, shard };
}
