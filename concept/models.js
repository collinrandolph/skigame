// Standalone models after the concept art, not yet in the game. Each builder returns a THREE.Group, origin on the ground,
// y up, metres. Uses the palette and helpers of v4/js/props.js (createProps). See gallery.html.
function createConcept(THREE, P){
  const M = P.MAT, mesh = (g, m, x = 0, y = 0, z = 0) => { const o = new THREE.Mesh(g, m); o.position.set(x, y, z); return o; };
  const box = (w, h, d, m, x, y, z) => mesh(new THREE.BoxGeometry(w, h, d), m, x, y, z), cyl = (r0, r1, h, m, x = 0, y = 0, z = 0, s = 12) => mesh(new THREE.CylinderGeometry(r1, r0, h, s), m, x, y + h/2, z);
  const G = (...k) => { const g = new THREE.Group(); k.forEach(o => o && g.add(o)); return g; };
  const tube = (pts, r, m, seg = 7) => { const c = new THREE.CatmullRomCurve3(pts.map(p => new THREE.Vector3(...p))), n = pts.length*6, g = new THREE.TubeGeometry(c, n, 1, seg, false), p = g.attributes.position, q = new THREE.Vector3(), rf = typeof r === 'function' ? r : () => r;
    for (let i = 0; i <= n; i++){ c.getPointAt(i/n, q); const rr = rf(i/n); for (let j = 0; j <= seg; j++){ const k = i*(seg + 1) + j; p.setXYZ(k, q.x + (p.getX(k) - q.x)*rr, q.y + (p.getY(k) - q.y)*rr, q.z + (p.getZ(k) - q.z)*rr); } } g.computeVertexNormals(); return new THREE.Mesh(g, m); };
  const glass = M.glass, ice = new THREE.MeshStandardMaterial({ color: P.C(0x9fd0ea), roughness: 0.15, metalness: 0.1, flatShading: true }), light = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.55, 0.3, 1.25), transparent: true, opacity: 0.38, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
  const B = {};
  // ---- Frostline-3
  B['Greenhouse complex'] = () => { const g = G(box(30, 0.6, 12, M.dark, 0, 0.3, 0)); for (let k = 0; k < 3; k++){ const v = mesh(new THREE.CylinderGeometry(5, 5, 9.4, 14, 1, false, 0, Math.PI), glass, -10 + k*10, 0.6, 0); v.rotation.set(Math.PI/2, 0, Math.PI/2); g.add(v);
      for (let r = 0; r < 4; r++){ const rib = mesh(new THREE.TorusGeometry(5, 0.09, 5, 16, Math.PI), M.steel, -10 + k*10, 0.6, -4.5 + r*3); g.add(rib); } g.add(box(8, 0.5, 8.6, M.robes[3], -10 + k*10, 0.9, 0)); }
    g.add(box(4, 3.4, 5, M.panel, 17, 1.7, 0), box(1.4, 2.2, 0.2, M.warm, 17, 1.3, -2.55)); return g; };
  B['Fuel and chem storage'] = () => { const g = G(box(16, 0.5, 9, M.dark, 0, 0.25, 0)); for (let k = 0; k < 3; k++){ g.add(cyl(2.2, 2.2, 7, M.panel, -5 + k*5, 0.5, 0, 14), mesh(new THREE.SphereGeometry(2.2, 14, 8, 0, Math.PI*2, 0, Math.PI/2), M.panel, -5 + k*5, 7.5, 0), cyl(2.26, 2.26, 0.5, M.orange, -5 + k*5, 3, 0, 14)); }
    g.add(box(15, 0.2, 0.2, M.steel, 0, 8.4, 2.4), box(0.2, 8, 0.2, M.steel, 7.4, 4.2, 2.4), cyl(0.9, 0.9, 2.4, M.steel, 7, 0.5, -3, 10)); return g; };
  B['Haul vehicle'] = () => { const g = G(box(3.4, 1.2, 7.5, M.dark, 0, 1.7, 0), box(3.6, 1.8, 4.6, M.orange, 0, 3.0, 1.2), box(3.0, 1.6, 2.0, M.panel, 0, 3.1, -2.7), box(2.6, 0.8, 0.1, M.cyan, 0, 3.3, -3.72));
    for (const x of [-1.9, 1.9]) for (const z of [-2.6, 0, 2.6]){ const w = cyl(1.1, 1.1, 0.9, M.dark, x, 0, z, 12); w.rotation.z = Math.PI/2; w.position.set(x, 1.1, z); g.add(w); } return g; };
  B['Processing plant'] = () => { const g = G(box(22, 5, 12, M.panel, 0, 2.5, 0), box(10, 4, 8, M.steel, -4, 7, 0)); for (let k = 0; k < 4; k++) g.add(cyl(1.1, 0.8, 16 + (k % 2)*5, M.steel, 4 + k*2.6, 5, -2 + (k % 2)*4, 10), cyl(1.3, 1.3, 0.5, M.orange, 4 + k*2.6, 14, -2 + (k % 2)*4, 10));
    g.add(tube([[-10, 9, 3], [-14, 11, 3], [-16, 6, 3], [-16, 0.5, 3]], 0.5, M.orange), box(0.6, 0.6, 12.2, M.warm, -11.1, 3, 0), box(24, 0.4, 14, M.dark, 0, 0.2, 0)); return g; };
  // ---- Frostveil
  B['Dome ruin'] = () => { const g = G(); for (let k = 0; k < 9; k++){ const a = k/9*Math.PI*2, broken = k === 3 || k === 6, pts = []; for (let i = 0; i <= (broken ? 5 : 9); i++){ const t = i/9*Math.PI/2; pts.push([Math.cos(a)*28*Math.cos(t), 28*Math.sin(t), Math.sin(a)*28*Math.cos(t)]); } g.add(tube(pts, t => 1.8*(1 - t*0.5), M.bone, 6)); }
    for (let r = 1; r < 4; r++){ const t = r/4*Math.PI/2, ring = mesh(new THREE.TorusGeometry(28*Math.cos(t), 0.9 - r*0.15, 6, 40, Math.PI*1.55), M.bone, 0, 28*Math.sin(t), 0); ring.rotation.x = Math.PI/2; ring.rotation.z = r; g.add(ring); }
    g.add(mesh(new THREE.DodecahedronGeometry(3.4, 0), M.bone, 0, 28.6, 0)); return g; };
  B['Cliffside village'] = () => { const g = G(mesh(new THREE.DodecahedronGeometry(12, 1), M.boneDark, 0, 5, 6)); g.children[0].scale.set(1.6, 1.1, 0.8); let s = 5;
    for (let lv = 0; lv < 4; lv++) for (let k = 0; k < 4 - lv; k++){ s = (s*16807) % 2147483647; const x = -9 + k*6 + lv*2.6 + (s % 5)*0.3, y = 1.2 + lv*3.4, w = 4 + (s % 3); g.add(box(w, 2.6, 3.4, lv % 2 ? M.adobe2 : M.adobe, x, y + 1.3, -1.5 - lv*0.3), box(0.8, 1, 0.1, M.warm, x - 0.6, y + 1.3, -3.25 - lv*0.3));
      const aw = box(w*0.8, 0.08, 2, k % 2 ? M.tarp : M.tarp2, x, y + 2.5, -4 - lv*0.3); aw.rotation.x = 0.3; g.add(aw, box(w + 1, 0.2, 1.6, M.steel, x, y, -3.6 - lv*0.3)); }
    for (let k = 0; k < 3; k++) g.add(cyl(0.06, 0.06, 5, M.dark, -8 + k*8, 12, -2, 4), box(1.2, 0.7, 0.05, M.tarp, -7.4 + k*8, 16.4, -2)); return g; };
  B['Ice harvester'] = () => { const g = G(box(7, 0.5, 7, M.dark, 0, 0.25, 0)); for (const [x, z] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]){ const l = box(0.25, 15, 0.25, M.steel, x*2.2, 7.5, z*2.2); l.rotation.set(z*0.1, 0, -x*0.1); g.add(l); }
    g.add(cyl(0.5, 0.2, 9, M.steel, 0, 0.5, 0, 8), cyl(1.6, 1.6, 2.6, M.panel, 4.6, 0.5, 2, 12), cyl(1.6, 1.6, 2.6, M.panel, 4.6, 0.5, -2, 12), box(2.2, 2.2, 2.2, ice, -5, 1.6, 1), box(2, 2, 2, ice, -5.2, 1.5, -1.6), box(1.8, 1.8, 1.8, ice, -5, 3.6, -0.2), box(1.3, 0.8, 0.05, M.tarp, 0.8, 15.2, 0), mesh(new THREE.SphereGeometry(0.3, 8, 6), M.red, 0, 15.6, 0)); return g; };
  B['Spine arch (colossal)'] = () => { const pts = []; for (let i = 0; i <= 16; i++){ const a = Math.PI*i/16; pts.push([-Math.cos(a)*42, Math.sin(a)*52*(0.75 + 0.25*Math.sin(a)), Math.sin(a*2)*5]); } const g = G(tube(pts, t => 5.5 - 3.4*Math.sin(t*Math.PI) + 0.7*Math.sin(t*60), M.bone, 9));
    for (let i = 2; i <= 14; i++){ const a = Math.PI*i/16, x = -Math.cos(a)*44, y = Math.sin(a)*55*(0.75 + 0.25*Math.sin(a)); g.add(mesh(new THREE.OctahedronGeometry(3 + Math.sin(i)*0.8, 0), M.bone, x, y, 0)); if (i % 2) g.add(tube([[x, y, 0], [x*0.9, y - 9, 6], [x*0.85, y - 20, 9]], t => 1.3*(1 - t*0.8), M.bone, 5)); }
    for (let k = 0; k < 7; k++){ const h = mesh(new THREE.SphereGeometry(2.2 + (k % 3), 8, 6), M.boneDark, -30 + k*10, 34 + Math.sin(k*1.3)*8, 0.5); h.scale.z = 0.3; g.add(h); } return g; };
  // ---- the ritual
  B['Cosmic moose'] = () => { const m = P.build.moose({}); m.traverse(o => { if (o.isMesh) o.material = light; }); m.scale.setScalar(12); const g = G(m);
    for (let k = 0; k < 9; k++){ const x = (k - 4)*0.9, pts = []; for (let i = 0; i <= 6; i++) pts.push([x + Math.sin(i*0.9 + k)*1.6, 27 - i*4.2, -30 - Math.sin(i*0.7 + k*2)*2.2]); g.add(tube(pts, t => 0.5*(1 - t*0.8), light, 5)); }
    for (let k = 0; k < 40; k++){ const s = mesh(new THREE.OctahedronGeometry(0.25 + (k % 3)*0.12, 0), M.violet, Math.sin(k*2.4)*9, 8 + (k*7.3) % 26, -22 + (k*5.1) % 34); g.add(s); } return g; };
  B['Robed court moose'] = () => { const g = G(P.build.moose({ robe: 0 })); const m = P.build.moose({ robe: 1 }); m.position.set(3.4, 0, 1); m.rotation.y = -0.5; const n = P.build.moose({ robe: 2 }); n.position.set(-3.6, 0, 1.4); n.rotation.y = 0.5; g.add(m, n); g.scale.setScalar(1.6); return g; };
  B['Temple of the court'] = () => { const g = G(P.build.temple(), P.build.circle()); g.children[1].position.z = -24; for (let k = 0; k < 6; k++){ const c = P.build.column(); c.position.set(k % 2 ? 9 : -9, 0, -10 - Math.floor(k/2)*9); g.add(c); } return g; };
  // ---- the crystal vault
  B['Crystal vault spiral'] = () => { const heart = P.build.heart(); heart.scale.setScalar(0.42); const g = G(heart), pts = []; for (let i = 0; i <= 90; i++){ const a = i/90*Math.PI*5.2, r = 34 - i*0.12; pts.push([Math.cos(a)*r, 2 + i*0.78, Math.sin(a)*r]); }
    const c = new THREE.CatmullRomCurve3(pts.map(p => new THREE.Vector3(...p))), n = 360, pos = [], idx = []; for (let i = 0; i <= n; i++){ const p = c.getPointAt(i/n), rad = new THREE.Vector3(p.x, 0, p.z).normalize(); for (const s of [-3, 3]) pos.push(p.x + rad.x*s, p.y, p.z + rad.z*s); if (i < n){ const q = i*2; idx.push(q, q + 1, q + 2, q + 1, q + 3, q + 2); } }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setIndex(idx); geo.computeVertexNormals(); g.add(new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: P.C(0xcfd3e6), roughness: 0.7, side: THREE.DoubleSide })));
    for (let i = 0; i <= 44; i++){ const p = c.getPointAt(i/44), rad = new THREE.Vector3(p.x, 0, p.z).normalize(); g.add(mesh(new THREE.BoxGeometry(0.3, 1.1, 0.3), M.warm, p.x + rad.x*3.1, p.y + 0.55, p.z + rad.z*3.1)); } return g; };
  // ---- the cave dwelling
  B['Cave street'] = () => { const g = G(box(14, 0.3, 80, M.adobe2, 0, 0.15, 0)); let s = 11; for (let k = 0; k < 10; k++) for (const sd of [-1, 1]){ s = (s*16807) % 2147483647; const d = P.build.dwelling({ seed: s, storeys: 2 + (s % 3) }); d.position.set(sd*13, 0, -36 + k*8); d.rotation.y = sd > 0 ? -Math.PI/2 : Math.PI/2; g.add(d); }
    for (let k = 0; k < 6; k++){ const l = P.build.lamp(); l.position.set(k % 2 ? 6 : -6, 0, -34 + k*13); g.add(l); } const fire = mesh(new THREE.SphereGeometry(0.7, 8, 6), M.warm, 3, 0.6, 30); g.add(fire);
    for (let k = 0; k < 12; k++){ const o = P.build.ore(); o.position.set(26 + (k % 3)*4, k*2.2, -30 + k*5); o.scale.setScalar(2 + (k % 3)); g.add(o); } return g; };
  // ---- the Orbital Gateway, small
  B['Orbital Gateway'] = () => { const hull = new THREE.MeshStandardMaterial({ color: P.C(0xb9c2cf), roughness: 0.5, metalness: 0.4, flatShading: true }), g = G(), ring = mesh(new THREE.TorusGeometry(40, 2.6, 8, 60), hull); ring.rotation.x = Math.PI/2; g.add(ring, cyl(14, 9, 10, hull, 0, -3, 0, 20), mesh(new THREE.SphereGeometry(11, 20, 10, 0, Math.PI*2, 0, Math.PI/2), hull, 0, 7, 0));
    for (let k = 0; k < 5; k++) g.add(cyl(1.4, 0.3, 14 + (k % 2)*10, hull, Math.cos(k*1.26)*5, 14, Math.sin(k*1.26)*5, 8)); const band = mesh(new THREE.TorusGeometry(40.2, 0.5, 6, 60), M.cyan, 0, 2.8, 0); band.rotation.x = Math.PI/2; g.add(band);
    for (let k = 0; k < 8; k++){ const a = k*Math.PI/4, arm = box(2.4, 2.4, 62, hull, Math.sin(a)*31, 0, Math.cos(a)*31); arm.rotation.y = a; g.add(arm); if (k % 3 !== 2){ const sh = cyl(3, 4.5, 26, k % 2 ? hull : M.orange, 0, 0, 0, 8); sh.rotation.z = Math.PI/2; sh.rotation.y = a + Math.PI/2; sh.position.set(Math.sin(a)*74, 0, Math.cos(a)*74); g.add(sh); } }
    const hoop = mesh(new THREE.TorusGeometry(20, 2, 8, 40), hull, 96, 0, 0); hoop.rotation.y = Math.PI/2; const disc = mesh(new THREE.CircleGeometry(18, 40), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.35, 1.0, 2.6), side: THREE.DoubleSide }), 96, 0, 0); disc.rotation.y = Math.PI/2; g.add(hoop, disc); g.position.y = 30; return G(g); };
  return B;
}
