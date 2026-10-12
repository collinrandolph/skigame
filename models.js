// models.js: every model in the game, made of three.js primitives (no model files). shared by the game (index.html),
// the model gallery (gallery.html) and the prototypes. each builder returns a new THREE.Object3D (or a rig: the root plus
// the parts the game animates) with its origin at ground level and nothing added to any scene; the game places them.
// load after three.js: window.SkiModels holds the materials, the helpers and the builders; SkiModels.CATALOG lists them
(() => {
'use strict';
const M = window.SkiModels = {};

// ---- shared materials (the frost palette) and primitive shorthands
const lam = c => new THREE.MeshLambertMaterial({ color: c });
const SM = {
  hull: lam(0xe3e8ec), steel: lam(0x9fb0c1), slate: lam(0x4f6276), blue: lam(0x4f6f8f), blue2: lam(0x7c97b0),
  dark: lam(0x2f3b48), orange: lam(0xc98a3e), green: lam(0x5d7a68), ice: lam(0xc3d4e0),
  glass: new THREE.MeshLambertMaterial({ color: 0xa9c4d8, transparent: true, opacity: 0.36, depthWrite: false, side: THREE.DoubleSide }),
  lamp: new THREE.MeshBasicMaterial({ color: 0xf0b867 }),
  window: new THREE.MeshBasicMaterial({ color: 0xf3d9a4 }),
  line: new THREE.LineBasicMaterial({ color: 0x6f849a }),
};
for (const k of ['hull', 'steel', 'slate', 'blue', 'blue2', 'dark', 'ice']) SM[k].flatShading = true;
const bx = (w, h, d) => new THREE.BoxGeometry(w, h, d);
const cy = (rt, rb, h, n = 16, open = false) => new THREE.CylinderGeometry(rt, rb, h, n, 1, open);
SM.strip = new THREE.MeshBasicMaterial({ color: 0x9cc8e8 });     // cool light strips on gates and bridges

// the glow on orbs, antenna lights and beacons
const orbGlowTex = (() => {
  const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d');
  const r = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(0.18, 'rgba(255,236,170,.95)'); r.addColorStop(0.45, 'rgba(255,190,60,.38)'); r.addColorStop(1, 'rgba(255,170,40,0)');
  g.fillStyle = r; g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
})();

// ---- structure models: the outpost kit, then zone 3's ruins and camps
const dome = (r, ws = 20, hs = 8) => new THREE.SphereGeometry(r, ws, hs, 0, Math.PI*2, 0, Math.PI/2);
function pt(g, geo, mat, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0){ const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.set(rx, ry, rz); g.add(m); return m; }
function lines(g, geo, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, keep = null){
  // the edges of a shape as a wire frame (struts on glass); keep() can drop segments, e.g. below a dome's base
  let e = new THREE.EdgesGeometry(geo, 1);
  if (keep){
    const a = e.attributes.position.array, out = [];
    for (let i = 0; i < a.length; i += 6) if (keep(a[i], a[i+1], a[i+2]) && keep(a[i+3], a[i+4], a[i+5])) out.push(...a.slice(i, i + 6));
    e = new THREE.BufferGeometry(); e.setAttribute('position', new THREE.Float32BufferAttribute(out, 3));
  }
  const l = new THREE.LineSegments(e, SM.line); l.position.set(x, y, z); l.rotation.set(rx, ry, rz); g.add(l); return l;
}
function geoDome(g, r, x = 0, y = 0, z = 0){
  // glass hemisphere with a geodesic frame over it
  pt(g, dome(r, 24, 10), SM.glass, x, y, z);
  lines(g, new THREE.IcosahedronGeometry(r * 1.004, 2), x, y, z, 0, 0, 0, (a, b, c) => b > -0.01);
  pt(g, cy(r + 0.15, r + 0.25, 0.5, 24), SM.steel, x, y + 0.25, z);
}
function arch(g, r, len, x, y, z, ry = 0){
  // a barrel-vaulted glass hall running along z, with ribs and end walls
  const a = new THREE.CylinderGeometry(r, r, len, 14, 6, true, Math.PI/2, Math.PI);
  pt(g, a, SM.glass, x, y, z, Math.PI/2, ry, 0);
  lines(g, new THREE.CylinderGeometry(r * 1.01, r * 1.01, len, 7, 6, true, Math.PI/2, Math.PI), x, y, z, Math.PI/2, ry, 0);
  for (const e of [-1, 1]) pt(g, new THREE.CircleGeometry(r, 14, 0, Math.PI), SM.glass, x + Math.sin(ry)*e*len/2, y, z + Math.cos(ry)*e*len/2, 0, ry, 0);
  pt(g, bx(2*r + 0.6, 0.6, len + 0.6), SM.steel, x, y + 0.3, z, 0, ry, 0);
}
const BUILD = {
  dome(){
    const g = new THREE.Group();
    pt(g, cy(15, 15.6, 3, 32), SM.hull, 0, 1.5, 0);
    pt(g, cy(15.08, 15.08, 0.7, 32), SM.slate, 0, 1.9, 0);
    pt(g, cy(15.12, 15.12, 0.25, 32), SM.window, 0, 1.9, 0);
    geoDome(g, 14, 0, 3, 0);
    // inside: two blocks of quarters and a garden
    pt(g, bx(8, 4, 6), SM.steel, -3, 5, -2); pt(g, bx(5, 6, 5), SM.blue2, 4, 6, 3); pt(g, cy(4, 4, 0.6, 16), SM.green, -2, 3.3, 6);
    // entrance tunnels with orange doors, a mast on the crown
    for (const a of [0, Math.PI*0.75, -Math.PI*0.7]){
      const c = Math.cos(a), s = Math.sin(a);
      pt(g, bx(4, 3.2, 7), SM.hull, s*17, 1.6, c*17, 0, a, 0);
      pt(g, bx(2, 2.2, 0.2), SM.orange, s*20.6, 1.4, c*20.6, 0, a, 0);
    }
    pt(g, cy(0.12, 0.12, 6, 6), SM.steel, 0, 19, 0); pt(g, new THREE.SphereGeometry(0.3, 8, 6), SM.lamp, 0, 22, 0);
    return g;
  },
  tower(){
    const g = new THREE.Group();
    pt(g, bx(14, 4, 10), SM.hull, 0, 2, 0);
    for (const z of [-5.06, 5.06]) pt(g, bx(12, 0.8, 0.1), SM.window, 0, 2.6, z);
    pt(g, bx(8, 3.5, 7), SM.slate, -2, 5.7, 0);
    pt(g, cy(2.6, 3.2, 18, 8), SM.hull, 2, 13, 0);
    for (const y of [9, 15, 19]) pt(g, cy(3.4, 3.4, 0.5, 8), SM.slate, 2, y, 0);
    pt(g, cy(4.8, 4.2, 1.6, 8), SM.blue2, 2, 22.6, 0);
    pt(g, cy(4.85, 4.85, 0.4, 8), SM.window, 2, 22.6, 0);
    pt(g, cy(2.2, 2.8, 4, 8), SM.hull, 2, 25.4, 0);
    pt(g, bx(2, 15, 2), SM.slate, 6.2, 7.5, -2.5);
    pt(g, bx(0.3, 9, 0.3), SM.steel, 2, 31.5, 0);
    pt(g, bx(3, 0.15, 0.15), SM.steel, 2, 30, 0); pt(g, bx(2, 0.15, 0.15), SM.steel, 2, 32.5, 0);
    pt(g, new THREE.SphereGeometry(0.35, 8, 6), SM.lamp, 2, 36.2, 0);
    pt(g, bx(0.6, 0.6, 10.2), SM.orange, -7.1, 3.6, 0);
    return g;
  },
  pad(){
    const g = new THREE.Group();
    pt(g, cy(12, 12.6, 1.2, 6), SM.slate, 0, 0.4, 0);
    pt(g, cy(11.4, 11.4, 0.06, 6), SM.dark, 0, 1.02, 0);
    const ring = new THREE.RingGeometry(6.6, 7.2, 36); ring.rotateX(-Math.PI/2);
    pt(g, ring, SM.orange, 0, 1.06, 0);
    pt(g, bx(0.7, 0.04, 6), SM.orange, -1.6, 1.07, 0); pt(g, bx(0.7, 0.04, 6), SM.orange, 1.6, 1.07, 0); pt(g, bx(3.2, 0.04, 0.7), SM.orange, 0, 1.07, 0);
    for (let k = 0; k < 6; k++){ const a = k/6*Math.PI*2 + Math.PI/6; pt(g, bx(0.5, 0.4, 0.5), SM.lamp, Math.sin(a)*11.2, 1.2, Math.cos(a)*11.2); }
    // a shuttle parked off-centre
    const sh = new THREE.Group(); sh.position.set(3, 1, -2); sh.rotation.y = 0.6; g.add(sh);
    pt(sh, cy(1.1, 1.4, 9, 12), SM.hull, 0, 1.9, 0, Math.PI/2);
    pt(sh, new THREE.ConeGeometry(1.1, 2.6, 12), SM.hull, 0, 1.9, -5.8, -Math.PI/2);
    pt(sh, bx(1.4, 0.5, 1.6), SM.window, 0, 2.7, -4.2);
    pt(sh, bx(9, 0.25, 3), SM.slate, 0, 1.6, 1.4);
    pt(sh, bx(0.25, 2.4, 2.2), SM.slate, 0, 3.6, 3.6);
    pt(sh, bx(9.1, 0.1, 0.5), SM.orange, 0, 1.75, 0.3);
    for (const x of [-0.7, 0.7]) pt(sh, cy(0.5, 0.65, 1.2, 10), SM.dark, x, 1.9, 5.1, Math.PI/2);
    for (const [x, z] of [[-1.5, -3], [1.5, -3], [-2.5, 2], [2.5, 2]]) pt(sh, bx(0.2, 1.2, 0.2), SM.steel, x, 0.6, z);
    return g;
  },
  plant(){
    const g = new THREE.Group();
    pt(g, bx(18, 7, 10), SM.steel, 0, 3.5, 0); pt(g, bx(18.4, 0.5, 10.4), SM.slate, 0, 7.2, 0);
    for (const z of [-5.06, 5.06]) for (let x = -7; x <= 7; x += 3.5) pt(g, bx(1.6, 1.0, 0.1), SM.window, x, 5, z);
    for (const [x, z, h] of [[-6, -2, 22], [-2.5, -3, 18], [1, -2.5, 25]]){
      pt(g, cy(0.9, 1.2, h, 10), SM.hull, x, h/2, z);
      pt(g, cy(1.0, 1.0, 0.8, 10), SM.orange, x, h - 2, z);
      pt(g, cy(1.3, 1.3, 0.5, 10), SM.slate, x, h * 0.55, z);
    }
    for (const x of [5, 9.5]){ pt(g, cy(2.3, 2.3, 10, 14), SM.blue2, x, 5, 8); pt(g, dome(2.3, 14, 5), SM.blue2, x, 10, 8); pt(g, cy(2.35, 2.35, 0.4, 14), SM.slate, x, 7, 8); }
    pt(g, cy(0.35, 0.35, 16, 8), SM.slate, 0, 8.5, 6.2, 0, 0, Math.PI/2);
    pt(g, cy(0.35, 0.35, 16, 8), SM.orange, 0, 9.3, 6.6, 0, 0, Math.PI/2);
    pt(g, cy(1.6, 1.6, 8, 12), SM.hull, -12, 1.8, 2, Math.PI/2);       // a horizontal tank
    pt(g, bx(1.4, 0.7, 18), SM.dark, 8, 4.5, -10, 0.42, 0, 0);         // conveyor down to the yard
    pt(g, bx(6, 2.2, 5), SM.slate, 8, 1.1, -17);
    return g;
  },
  excavator(rnd){
    const g = new THREE.Group();
    // the bench of ice and rock it's cutting into
    for (let k = 0; k < 14; k++){
      const a = rnd()*Math.PI*1.2 - Math.PI*1.1, d = 10 + rnd()*5, s = 2 + rnd()*3.5;
      pt(g, bx(s, s*(0.6 + rnd()*0.8), s*(0.7 + rnd()*0.6)), SM.ice, Math.sin(a)*d, s*0.35, Math.cos(a)*d, rnd()*0.4, rnd()*3, rnd()*0.4);
    }
    for (const x of [-2.6, 2.6]) pt(g, bx(1.8, 1.6, 8), SM.dark, x, 0.8, 0);
    pt(g, bx(6, 3, 7), SM.steel, 0, 3.1, 0.5); pt(g, bx(6.05, 0.4, 7.05), SM.orange, 0, 2.0, 0.5);
    pt(g, bx(2.6, 2.4, 2.6), SM.hull, 1.6, 5.8, -1.6); pt(g, bx(2.4, 0.9, 0.06), SM.window, 1.6, 6.1, -2.93);
    pt(g, bx(5, 2.6, 3), SM.slate, 0, 3.4, 4.8);
    for (const x of [-1, 1]) pt(g, bx(0.3, 7, 0.3), SM.steel, x*1.2, 7.5, 1.5, 0.25, 0, x*0.12);
    // the boom reaching out to the cutting wheel
    const boom = new THREE.Group(); boom.position.set(-0.8, 4.6, -1.5); boom.rotation.x = 0.42; g.add(boom);
    pt(boom, bx(1.3, 1.3, 17), SM.steel, 0, 0, -8.5);
    pt(boom, bx(1.32, 0.3, 17), SM.orange, 0, 0.7, -8.5);
    const wheel = new THREE.Group(); wheel.position.set(0, 0, -17); boom.add(wheel);
    pt(wheel, cy(3.2, 3.2, 1.0, 18), SM.slate, 0, 0, 0, 0, 0, Math.PI/2);
    for (let k = 0; k < 9; k++){ const a = k/9*Math.PI*2; pt(wheel, bx(1.3, 0.9, 1.1), SM.dark, 0, Math.sin(a)*3.4, Math.cos(a)*3.4, a); }
    // a cable stay from the mast to the boom
    const cable = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 10.8, 1.5), new THREE.Vector3(-0.8, 4.6 + Math.sin(0.42)*12, -1.5 - Math.cos(0.42)*12)]);
    g.add(new THREE.LineSegments(cable, SM.line));
    return g;
  },
  haul(){
    const g = new THREE.Group();
    pt(g, bx(3, 1, 7), SM.dark, 0, 1.4, 0);
    for (const x of [-1.75, 1.75]) for (const z of [-2.4, 0.2, 2.5]){ pt(g, cy(0.9, 0.9, 0.7, 14), SM.dark, x, 0.9, z, 0, 0, Math.PI/2); pt(g, cy(0.45, 0.45, 0.72, 10), SM.steel, x, 0.9, z, 0, 0, Math.PI/2); }
    pt(g, bx(2.9, 1.6, 4.6), SM.hull, 0, 2.7, 1.1); pt(g, bx(2.5, 0.8, 4.1), SM.slate, 0, 3.6, 1.2);
    pt(g, bx(2.7, 1.8, 1.9), SM.hull, 0, 2.8, -2.4); pt(g, bx(2.3, 0.7, 0.06), SM.window, 0, 3.2, -3.37);
    pt(g, bx(3.05, 0.3, 7.05), SM.orange, 0, 2.0, 0);
    pt(g, bx(0.3, 0.3, 0.3), SM.lamp, 0.9, 3.85, -2.4);
    return g;
  },
  greenhouse(){
    const g = new THREE.Group();
    for (const x of [-9, 0, 9]){
      arch(g, 4, 20, x, 0.6, 0);
      for (const dx of [-2, 0, 2]) pt(g, bx(1.1, 0.6, 18), SM.green, x + dx, 0.9, 0);
    }
    pt(g, bx(26, 3.4, 4), SM.hull, 0, 1.7, -12); pt(g, bx(26.1, 0.5, 4.1), SM.orange, 0, 2.6, -12);
    for (let x = -11; x <= 11; x += 2.75) pt(g, bx(1.2, 0.8, 0.06), SM.window, x, 1.8, -14.05);
    pt(g, cy(0.12, 0.12, 6, 6), SM.steel, 11, 6, -12); pt(g, new THREE.SphereGeometry(0.25, 8, 6), SM.lamp, 11, 9.1, -12);
    return g;
  },
  biolab(){
    const g = new THREE.Group();
    pt(g, cy(7, 7.3, 1.4, 24), SM.hull, 0, 0.7, 0); geoDome(g, 6.5, 0, 1.4, 0);
    pt(g, cy(5, 5.2, 1.2, 20), SM.hull, 10, 0.6, 3); geoDome(g, 4.6, 10, 1.2, 3);
    pt(g, cy(4.4, 4.6, 1.2, 20), SM.hull, -9.5, 0.6, 4); geoDome(g, 4, -9.5, 1.2, 4);
    for (const [x, z, r] of [[0, 0, 3], [10, 3, 2], [-9.5, 4, 2]]) pt(g, cy(r, r, 0.8, 14), SM.green, x, 1.8, z);
    // glass walkways between the domes
    for (const [ax, az, bx2, bz] of [[5, 1.2, 6, 2.2], [-5.5, 2, -6, 3]]){
      const L = Math.hypot(bx2 - ax, bz - az) + 3, a = Math.atan2(bx2 - ax, bz - az);
      const w = pt(g, cy(1.1, 1.1, L, 10, true), SM.glass, (ax + bx2)/2, 1.5, (az + bz)/2); w.rotation.order = 'YXZ'; w.rotation.set(Math.PI/2, a, 0);
    }
    pt(g, bx(6, 4, 4.5), SM.hull, 2, 2, -8.5); pt(g, bx(6.05, 0.5, 4.55), SM.orange, 2, 3.4, -8.5);
    pt(g, bx(5, 0.7, 0.06), SM.window, 2, 2.3, -10.78);
    pt(g, cy(0.12, 0.12, 9, 6), SM.steel, 4, 8.5, -8.5); pt(g, bx(1.6, 0.12, 0.12), SM.steel, 4, 11, -8.5); pt(g, new THREE.SphereGeometry(0.25, 8, 6), SM.lamp, 4, 13.1, -8.5);
    return g;
  },
  comms(){
    const g = new THREE.Group();
    pt(g, cy(2.4, 2.8, 0.6, 10), SM.slate, 0, 0.3, 0);
    pt(g, cy(0.9, 1.3, 4, 10), SM.steel, 0, 2.6, 0);
    pt(g, bx(3.4, 0.9, 1.2), SM.slate, 0, 4.8, 0);
    const dish = new THREE.Group(); dish.position.set(0, 5.6, 0); dish.rotation.x = -0.75; g.add(dish);
    const bowl = new THREE.SphereGeometry(5, 24, 6, 0, Math.PI*2, Math.PI - 0.85, 0.85);   // a shallow cap, open side up
    pt(dish, bowl, SM.hull, 0, 5, 0).material = SM.hull;
    lines(dish, new THREE.SphereGeometry(5.02, 12, 3, 0, Math.PI*2, Math.PI - 0.85, 0.85), 0, 5, 0);
    for (let k = 0; k < 3; k++){ const a = k/3*Math.PI*2; const st = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(Math.cos(a)*3.6, 1.6, Math.sin(a)*3.6), new THREE.Vector3(0, 3.6, 0)]); dish.add(new THREE.LineSegments(st, SM.line)); }
    pt(dish, cy(0.3, 0.3, 0.8, 8), SM.orange, 0, 3.8, 0);
    return g;
  },
  weather(){
    const g = new THREE.Group();
    pt(g, bx(3, 0.4, 3), SM.slate, 0, 0.2, 0);
    const H = 10, b = 0.9, t = 0.35;
    for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]){
      const leg = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(sx*b, 0.4, sz*b), new THREE.Vector3(sx*t, H, sz*t)]);
      g.add(new THREE.LineSegments(leg, SM.line));
      pt(g, cy(0.07, 0.1, H - 0.4, 4), SM.steel, sx*(b + t)/2, (H + 0.4)/2, sz*(b + t)/2, sz*Math.atan((b - t)/H), 0, -sx*Math.atan((b - t)/H));
    }
    // cross bracing on each face
    const br = [];
    for (let y = 0.4; y < H - 1; y += 1.6){
      const w0 = b - (b - t)*(y/H), w1 = b - (b - t)*((y + 1.6)/H);
      for (const [ax, az, cx, cz] of [[-1, -1, 1, -1], [1, -1, 1, 1], [1, 1, -1, 1], [-1, 1, -1, -1]]){
        br.push(ax*w0, y, az*w0, cx*w1, y + 1.6, cz*w1, cx*w0, y, cz*w0, ax*w1, y + 1.6, az*w1);
      }
    }
    const bg = new THREE.BufferGeometry(); bg.setAttribute('position', new THREE.Float32BufferAttribute(br, 3)); g.add(new THREE.LineSegments(bg, SM.line));
    pt(g, bx(1.6, 0.2, 1.6), SM.slate, 0, H, 0);
    pt(g, bx(0.9, 0.7, 0.6), SM.hull, 0.3, H + 0.45, 0);
    pt(g, cy(0.05, 0.05, 1.4, 4), SM.steel, -0.5, H + 0.8, 0);
    for (let k = 0; k < 3; k++){ const a = k/3*Math.PI*2; pt(g, new THREE.SphereGeometry(0.13, 6, 4, 0, Math.PI*2, 0, Math.PI/2), SM.orange, -0.5 + Math.cos(a)*0.35, H + 1.5, Math.sin(a)*0.35, 0, 0, Math.PI/2); }
    pt(g, new THREE.SphereGeometry(0.22, 8, 6), SM.lamp, 0, H + 1.9, 0.5);
    pt(g, bx(1.2, 1.5, 1.0), SM.hull, 1.3, 0.95, 0.9);
    return g;
  },
  fuel(){
    const g = new THREE.Group();
    pt(g, bx(15, 0.6, 6.5), SM.slate, 0, 0.3, 0);
    for (const x of [-4.8, 0, 4.8]){
      pt(g, cy(2.1, 2.1, 6, 18), SM.hull, x, 3.6, 0); pt(g, dome(2.1, 18, 6), SM.hull, x, 6.6, 0);
      pt(g, cy(2.15, 2.15, 0.45, 18), SM.orange, x, 5.2, 0); pt(g, cy(2.15, 2.15, 0.25, 18), SM.slate, x, 1.4, 0);
      pt(g, bx(0.08, 6, 0.4), SM.steel, x + 2.15, 3.6, 0);
    }
    pt(g, cy(0.25, 0.25, 12, 8), SM.blue2, 0, 1.2, 2.6, 0, 0, Math.PI/2);
    pt(g, cy(0.25, 0.25, 12, 8), SM.slate, 0, 8.4, 0, 0, 0, Math.PI/2);
    for (const x of [-4.8, 0, 4.8]) pt(g, cy(0.2, 0.2, 1.4, 6), SM.slate, x, 7.8, 0);
    return g;
  },
  solar(){
    const g = new THREE.Group();
    for (const z of [-2.2, 2.2]) for (const x of [-3.3, 0, 3.3]){
      pt(g, cy(0.1, 0.1, 1.4, 6), SM.steel, x, 0.7, z);
      pt(g, bx(3, 0.08, 1.9), SM.blue, x, 1.5, z, -0.55);
      pt(g, bx(3.02, 0.02, 1.92), SM.slate, x, 1.45, z, -0.55);
    }
    pt(g, bx(1.2, 1, 0.8), SM.hull, 5.5, 0.5, 0); pt(g, bx(1.22, 0.2, 0.82), SM.orange, 5.5, 0.9, 0);
    return g;
  },
  beacon(rnd){
    const g = new THREE.Group();
    for (let k = 0; k < 6; k++){ const a = rnd()*Math.PI*2, d = 1 + rnd()*2.5, s = 1.4 + rnd()*1.8; pt(g, new THREE.DodecahedronGeometry(s, 0), SM.ice, Math.cos(a)*d, s*0.3, Math.sin(a)*d, rnd(), rnd(), rnd()); }
    pt(g, cy(1.1, 1.8, 14, 10), SM.hull, 0, 8, 0);
    for (const y of [4, 8, 12]) pt(g, cy(1.85 - y*0.05, 1.9 - y*0.05, 0.6, 10), SM.slate, 0, y, 0);
    pt(g, cy(1.9, 1.9, 0.25, 10), SM.steel, 0, 15.1, 0);
    pt(g, cy(1.2, 1.2, 1.8, 10, true), SM.glass, 0, 16.1, 0);
    lines(g, cy(1.22, 1.22, 1.8, 10), 0, 16.1, 0);
    pt(g, new THREE.SphereGeometry(0.55, 10, 8), SM.lamp, 0, 16.1, 0);
    pt(g, new THREE.ConeGeometry(1.5, 1.6, 10), SM.orange, 0, 17.8, 0);
    pt(g, cy(0.06, 0.06, 2.4, 4), SM.steel, 0, 19.6, 0);
    pt(g, bx(0.5, 1.6, 0.06), SM.window, 0, 7, 1.62);
    return g;
  },
};
// ---- zone 3: the ruins (organic, bone-pale, grown rather than built) and the camps around them (scrap timber,
// tarpaulin, rope and lantern light)
Object.assign(SM, {
  bone: lam(0xe4e6e2), bone2: lam(0xc8ccc8), hole: new THREE.MeshBasicMaterial({ color: 0x2c3a49 }), glow: new THREE.MeshBasicMaterial({ color: 0xa9c4d8 }),
  timber: lam(0x6e5a4a), timber2: lam(0x4d3f35), tarp: lam(0xb8703f), tarpRed: lam(0x9b4a3e), rust: lam(0x8a5c45), scrap: lam(0x7d868f),
  flag: new THREE.MeshLambertMaterial({ color: 0xb5523b, side: THREE.DoubleSide }),
});
for (const k of ['bone', 'bone2', 'timber', 'timber2', 'tarp', 'tarpRed', 'rust', 'scrap']) SM[k].flatShading = true;
// detail pieces (trim, panels, windows, lights) often lie flush on a bigger surface, and two flush faces flicker as the
// depth buffer flips between them. each material gets its own small depth nudge, bodies furthest back and lights
// furthest forward, so flush faces always draw in the same order and never fight
['hull', 'bone', 'timber', 'slate', 'steel', 'bone2', 'timber2', 'ice', 'blue', 'blue2', 'green', 'scrap', 'rust', 'dark', 'orange',
 'tarp', 'tarpRed', 'flag', 'hole', 'window', 'lamp', 'glow', 'strip'].forEach((k, i) => {
  const m = SM[k]; if (!m) return; m.polygonOffset = true; m.polygonOffsetFactor = -i*0.25; m.polygonOffsetUnits = -i; m.needsUpdate = true;
});
const V = (x, y, z) => new THREE.Vector3(x, y, z);
function tube(g, pts, r, mat, seg = 24, rs = 7){
  const c = new THREE.CatmullRomCurve3(pts.map(p => V(...p)));
  const m = new THREE.Mesh(new THREE.TubeGeometry(c, seg, r, rs, false), mat); g.add(m); return c;
}
function beam(g, a, b, r, mat, n = 6){
  // a round strut from point a to point b
  const A = V(...a), B = V(...b), d = B.clone().sub(A), L = d.length();
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, L, n), mat);
  m.position.copy(A).add(B).multiplyScalar(0.5); m.quaternion.setFromUnitVectors(V(0, 1, 0), d.normalize()); g.add(m); return m;
}
function flag(g, x, y, z, mat = SM.flag, ry = 0){
  pt(g, cy(0.05, 0.05, y, 5), SM.timber2, x, y/2, z);
  const f = new THREE.PlaneGeometry(1.1, 0.6); f.translate(0.55, 0, 0);
  pt(g, f, mat, x, y - 0.4, z, 0, ry, 0);
}
Object.assign(BUILD, {
  ribs(rnd){
    // the sleeping ribs: the bones of a full-grown purple moose, about eleven times the size of the living ones, lying
    // where it lay down to sleep and never got up. six legs folded under it and splayed as the body fell in, the long
    // shoulder hump of spines, the rib cage still arched over the empty snow where its heart was, the
    // skull on the snow with its palmate antlers, and the tentacle beard a scatter of bead-like bones
    const root = new THREE.Group(), g = new THREE.Group(); g.position.z = 8; root.add(g);   // centred on its footprint
    const knob = (x, y, z, r, mat = SM.bone2) => pt(g, new THREE.SphereGeometry(r, 8, 6), mat, x, y, z);
    // the spine: tail, pelvis, the long back, up over the shoulders, then the neck sweeping down to the skull
    const spinePts = [[0, 1, 25], [0, 7, 21], [0, 12, 16], [0, 15.5, 7], [0, 17, -2], [0, 19, -10], [0, 17.5, -16], [0.5, 13, -21], [1.5, 8, -26], [2.5, 4.5, -30]];
    const spine = tube(g, spinePts, 1.25, SM.bone2, 60, 8);
    for (let k = 0; k <= 26; k++){
      const p = spine.getPoint(k/26), z = p.z;
      knob(p.x, p.y, p.z, 1.6 - 0.5*(k/26 > 0.75 ? (k/26 - 0.75)*4 : 0), SM.bone);                  // vertebrae
      if (z < 20 && z > -19){
        // neural spines: the moose hump. tallest over the shoulders, leaning back
        const h = 1.8 + 7.5*Math.exp(-Math.pow((z + 9)/7, 2)) + 1.2*Math.exp(-Math.pow((z - 15)/4, 2));
        beam(g, [p.x, p.y, p.z], [p.x, p.y + h, p.z + h*0.35], 0.42, SM.bone);
        knob(p.x, p.y + h, p.z + h*0.35, 0.55);
      }
    }
    // the rib cage: arched pairs from the spine out and down to the snow, sweeping back a little; a few broken or fallen
    for (let k = 0; k < 9; k++){
      const z = -12 + k*3.1, top = spine.getPoint(0.18 + 0.34*(1 - k/8)).y;
      const w = 10.5 * Math.sqrt(Math.max(0.2, 1 - Math.pow((z + 1)/18, 2)));
      for (const sx of [-1, 1]){
        const id = k*2 + (sx > 0 ? 1 : 0), broken = id === 5 || id === 12, fallen = id === 9 || id === 16;
        const ys = Math.min(top, 17) - 0.5;
        let pts = [[0, ys, z], [sx*w*0.6, ys - 1, z + 0.6], [sx*w, ys*0.55, z + 1.3], [sx*w*0.92, ys*0.15, z + 1.8], [sx*w*0.72, -1, z + 2]];
        if (broken) pts = pts.slice(0, 3);
        if (fallen) pts = [[sx*3, 0.2, z + 1], [sx*(w*0.6), 0.6, z + 3], [sx*(w + 3), 0.4, z + 5], [sx*(w + 6), 0, z + 6]];
        tube(g, pts, 0.75 + 0.2*Math.sin(k*1.9), SM.bone, 30, 7);
        if (!broken && !fallen && rnd() < 0.5) pt(g, new THREE.ConeGeometry(0.2, 1.0 + rnd()*1.4, 5), SM.ice, sx*w*0.7, ys*0.8, z + 1, Math.PI);   // icicles
      }
    }
    // shoulder blades and the pelvis
    for (const sx of [-1, 1]){
      const sc = pt(g, new THREE.SphereGeometry(1, 10, 8), SM.bone, sx*6.5, 12.5, -9, 0, 0, sx*0.35); sc.scale.set(0.7, 5.5, 3.6);
      const il = pt(g, new THREE.SphereGeometry(1, 10, 8), SM.bone, sx*4.2, 11, 17, 0.5, 0, -sx*0.6); il.scale.set(3.6, 1.2, 3.2);
      tube(g, [[sx*4.5, 10, 18], [sx*4.8, 5, 20], [sx*4, 1, 21.5]], 0.9, SM.bone2, 12, 6);
    }
    // six legs: thigh bones down from the hip and shin bones laid along the snow, folded under as it slept, splayed
    // outward as the body sank; knuckled joints and split hooves
    for (const [z, sx, fold] of [[-9, -1, 1], [-9, 1, 0.8], [2, -1, 0.9], [2, 1, 1.2], [14, -1, 1.1], [14, 1, 0.9]]){
      const hip = [sx*5, 8.5, z], knee = [sx*(9.5 + 2*fold), 0.6, z + 3], hoof = [sx*(12 + 3*fold), 0.3, z - 8*fold];
      knob(...hip, 1.7, SM.bone); knob(...knee, 1.4, SM.bone);
      tube(g, [hip, [sx*(7.5 + fold), 4.5, z + 1.8], knee], 1.0, SM.bone2, 12, 7);
      tube(g, [knee, [(knee[0] + hoof[0])/2, 0.6, (knee[2] + hoof[2])/2], hoof], 0.75, SM.bone2, 12, 7);
      for (const h of [-1, 1]){ const c = pt(g, new THREE.ConeGeometry(0.7, 2.4, 6), SM.bone, hoof[0] + h*0.6, 0.3, hoof[2] - 1.2, -Math.PI/2); c.scale.set(1, 1, 0.7); }
    }
    // the skull, lying turned on the snow: a long drooping muzzle, dark eye sockets and nostril, the jaw fallen loose
    const sk = new THREE.Group(); sk.position.set(3.5, 3.6, -33); sk.rotation.set(0.1, 0.35, 0.3); g.add(sk);
    pt(sk, new THREE.SphereGeometry(1, 14, 10), SM.bone, 0, 0.6, 0).scale.set(3.4, 3.3, 4.2);
    pt(sk, new THREE.SphereGeometry(1, 14, 10), SM.bone, 0, -0.8, -5.5).scale.set(2.3, 2.2, 5.2);
    pt(sk, new THREE.SphereGeometry(1, 10, 8), SM.bone2, 0, -1.4, -9.6).scale.set(2.0, 1.8, 1.6);
    for (const sx of [-1, 1]){ const e = pt(sk, new THREE.CircleGeometry(1.1, 12), SM.hole, sx*3.1, 1.3, -1.6, 0, sx*Math.PI/2.4, 0); e.scale.set(1, 0.8, 1); }
    pt(sk, new THREE.CircleGeometry(0.9, 12), SM.hole, 0, -1.2, -11.15, 0, Math.PI, 0);
    tube(g, [[0.5, 0.3, -31], [2.5, 0.4, -37], [5, 0.3, -43]], 0.8, SM.bone2, 12, 6);   // the jaw
    // palmate antlers: a beam out to a broad flat palm edged with tines. one still on the skull, one broken off
    const antler = (par, x, y, z, sx, ry, rz) => {
      const a = new THREE.Group(); a.position.set(x, y, z); a.rotation.set(0, ry, rz); par.add(a);
      beam(a, [0, 0, 0], [sx*4, 2.2, 0.5], 0.7, SM.bone2);
      const palm = pt(a, new THREE.SphereGeometry(1, 12, 8), SM.bone, sx*8.5, 3.6, 1); palm.scale.set(5, 0.55, 3.6); palm.rotation.z = sx*0.3;
      for (let k = 0; k < 7; k++){ const t = k/6; pt(a, new THREE.ConeGeometry(0.42, 3.2, 5), SM.bone2, sx*(5 + t*8), 5.1 + Math.sin(t*3)*1.2, -1.6 + t*4.6, 0, 0, -sx*0.35); }
      return a;
    };
    antler(sk, 2, 2.8, 0.5, 1, 0, -0.15);
    antler(g, -14, 0.4, -38, -1, 0.9, 1.25);                    // the broken one, lying flat on the snow
    // the beard: tentacles of small bead bones, curling out over the snow from under the jaw
    for (let k = 0; k < 6; k++){
      let x = 1 + (k - 2.5)*1.5, z = -40 - (k % 2)*1.5, a = -Math.PI/2 + (k - 2.5)*0.45, r = 0.75;
      for (let i = 0; i < 11; i++){ knob(x, r*0.6, z, r, i % 2 ? SM.bone2 : SM.bone); a += (k % 2 ? 0.28 : -0.24); x += Math.cos(a)*1.35*(r + 0.5); z += Math.sin(a)*1.35*(r + 0.5); r *= 0.9; }
    }
    // (no heart: the crystal that grew where it lay, and its glow, are gone. crystals are scarce out here)
    return root;
  },
  arch(rnd){
    // the spine arch: one vertebral span over the trail, knobbed and spined, with a fallen piece beside it
    const g = new THREE.Group();
    const c = tube(g, [[-12, -1.5, 0], [-12.5, 7, 0.8], [-8, 15.5, 1.2], [0, 19, 0], [8, 16, -1.2], [12.4, 8, -0.4], [12, -1.5, 0]], 1.5, SM.bone, 60, 9);
    for (let k = 1; k < 18; k++){
      const p = c.getPoint(k/18), tn = c.getTangent(k/18);
      pt(g, new THREE.SphereGeometry(1.75, 8, 6), SM.bone2, p.x, p.y, p.z);
      const out = V(-tn.y, tn.x, 0).normalize();            // the outside of the curve
      const sp = new THREE.Mesh(new THREE.ConeGeometry(0.45, 2.6 + (k % 3), 6), SM.bone); sp.position.copy(p).add(out.clone().multiplyScalar(2.6));
      sp.quaternion.setFromUnitVectors(V(0, 1, 0), out.add(V(0, 0, (k % 2 ? 0.5 : -0.5))).normalize()); g.add(sp);
    }
    tube(g, [[15, -1, 6], [19, 6, 7], [23, 10, 3], [24, 9, -2]], 1.1, SM.bone2, 20, 7);
    return g;
  },
  watcher(rnd){
    // the watcher: a tall, ribbed spire, slits up its sides and a pale light near the top
    const g = new THREE.Group(), H = 40, prof = [];
    for (let i = 0; i <= 24; i++){ const y = i/24*H; prof.push(new THREE.Vector2(Math.max(0.3, 6.5*Math.pow(1 - y/H, 0.75) + 0.7*Math.sin(y*0.55) + 0.4), y - 1.5)); }
    pt(g, new THREE.LatheGeometry(prof, 11), SM.bone);
    for (const ph of [0, Math.PI*2/3, Math.PI*4/3]){
      const pts = []; for (let i = 0; i <= 10; i++){ const y = i/10*(H - 8), r = 6.5*Math.pow(1 - y/H, 0.75) + 1.4, a = ph + i*0.5; pts.push([Math.cos(a)*r, y, Math.sin(a)*r]); }
      tube(g, pts, 0.55, SM.bone2, 40, 6);
    }
    for (let k = 0; k < 7; k++){ const y = 6 + k*4.4, r = 6.5*Math.pow(1 - y/H, 0.75) + 0.55, a = k*1.9; pt(g, bx(0.25, 2.4, 0.8), SM.hole, Math.cos(a)*r, y, Math.sin(a)*r, 0, -a, 0); }
    pt(g, new THREE.SphereGeometry(0.9, 10, 8), SM.glow, 0, H - 7, 0);
    for (let k = 0; k < 5; k++){ const a = rnd()*Math.PI*2, d = 9 + rnd()*5; pt(g, new THREE.DodecahedronGeometry(1 + rnd()*1.6, 0), SM.bone2, Math.cos(a)*d, 0, Math.sin(a)*d, rnd(), rnd(), rnd()); }
    return g;
  },
  circle(rnd){
    // the broken circle: a ring of curved standing pieces around a low dais, gaps where some have fallen
    const g = new THREE.Group(), R = 19;
    pt(g, cy(6.5, 7.5, 1.2, 12), SM.bone2, 0, 0.3, 0);
    pt(g, new THREE.TorusGeometry(4, 0.35, 6, 24), SM.glow, 0, 1, 0, Math.PI/2);
    for (let k = 0; k < 14; k++){
      if (k === 3 || k === 9 || k === 10) continue;
      const a = k/14*Math.PI*2, h = 4 + ((k*7) % 5)*1.6, len = 6.2;
      const pc = new THREE.Group(); pc.position.set(Math.cos(a)*R, 0, Math.sin(a)*R); pc.rotation.y = -a; g.add(pc);
      pt(pc, bx(1.6, h, len), SM.bone, 0, h/2 - 0.5, 0, 0, 0, (k % 4 === 1) ? 0.18 : 0);
      pt(pc, new THREE.ConeGeometry(0.7, 2.2, 6), SM.bone2, 0, h + 0.5, len*0.25);
      pt(pc, new THREE.ConeGeometry(0.55, 1.6, 6), SM.bone2, 0, h + 0.2, -len*0.3);
      if (k % 3 === 0) pt(pc, new THREE.CircleGeometry(0.9, 10), SM.hole, 0.82, h*0.55, 0, 0, Math.PI/2);
    }
    for (const a of [3/14*Math.PI*2 + 0.1, 9.5/14*Math.PI*2]) pt(g, bx(6, 1.4, 1.8), SM.bone2, Math.cos(a)*(R + 3), 0.3, Math.sin(a)*(R + 3), 0.1, -a + 1.2, 0.15);
    return g;
  },
  shard(rnd){
    // a fragment: bone spikes pushing out of the snow, and half a rib
    const g = new THREE.Group();
    for (let k = 0; k < 3 + (rnd()*3 | 0); k++){ const h = 3 + rnd()*5; pt(g, new THREE.ConeGeometry(0.5 + rnd()*0.5, h, 6), k % 2 ? SM.bone2 : SM.bone, (rnd() - 0.5)*4, h/2 - 0.6, (rnd() - 0.5)*4, (rnd() - 0.5)*0.6, 0, (rnd() - 0.5)*0.6); }
    tube(g, [[-4, -1, 0], [-3.6, 3, 0.4], [-1, 6, 0.6], [2, 6.5, 0.2]], 0.6, SM.bone, 16, 6);
    return g;
  },
  camp(rnd){
    // a ridge camp: tents and a tarp lean-to, crates, a fire, flags, and a little lookout platform
    const g = new THREE.Group();
    const tent = (x, z, ry, mat) => { pt(g, new THREE.ConeGeometry(2, 2.4, 4), mat, x, 1.2, z, 0, ry + Math.PI/4); pt(g, cy(0.04, 0.04, 3.2, 4), SM.timber2, x, 1.6, z); };
    tent(-2.5, 0.5, 0, SM.tarp); tent(1.8, -2.2, 0.6, SM.tarpRed);
    beam(g, [2, 0, 2], [2, 2.2, 2], 0.07, SM.timber2); beam(g, [5, 0, 2], [5, 2.2, 2], 0.07, SM.timber2);
    pt(g, bx(3.4, 0.06, 2.6), SM.tarp, 3.5, 1.6, 3, -0.55);
    for (let k = 0; k < 4; k++) pt(g, bx(0.9, 0.7, 0.7), SM.timber, 3 + (k % 2)*1.0, 0.35 + (k > 1 ? 0.7 : 0), 3.4 + (k % 2)*0.2, 0, rnd(), 0);
    pt(g, cy(0.35, 0.35, 0.9, 8), SM.rust, -1, 0.45, 3.5);
    for (let k = 0; k < 6; k++){ const a = k/6*Math.PI*2; pt(g, new THREE.DodecahedronGeometry(0.22, 0), SM.scrap, -0.5 + Math.cos(a)*0.6, 0.1, 1.5 + Math.sin(a)*0.6); }
    pt(g, new THREE.SphereGeometry(0.28, 8, 6), SM.lamp, -0.5, 0.35, 1.5);
    // lookout: four posts, a deck, a ladder, a lantern
    for (const [x, z] of [[-4.5, -2.5], [-2.7, -2.5], [-4.5, -4.3], [-2.7, -4.3]]) beam(g, [x, 0, z], [x, 3.2, z], 0.09, SM.timber2);
    pt(g, bx(2.2, 0.15, 2.2), SM.timber, -3.6, 3.2, -3.4);
    beam(g, [-2.4, 0, -1.6], [-2.6, 3.2, -2.4], 0.05, SM.timber2); beam(g, [-1.9, 0, -1.6], [-2.1, 3.2, -2.4], 0.05, SM.timber2);
    pt(g, new THREE.SphereGeometry(0.18, 8, 6), SM.lamp, -3.6, 3.7, -3.4);
    flag(g, -4.5, 5.2, -4.3); flag(g, 0.5, 4, 3.8, SM.tarp, 0.8);
    return g;
  },
  harvester(rnd){
    // an ice harvester: a timber tripod over the shore with a block of lake ice hanging from it, a sled of cut blocks
    const g = new THREE.Group(), top = [0, 7, 0];
    for (let k = 0; k < 3; k++){ const a = k/3*Math.PI*2; beam(g, [Math.cos(a)*2.4, 0, Math.sin(a)*2.4], top, 0.11, SM.timber2); }
    pt(g, bx(0.8, 0.5, 0.5), SM.rust, 0, 6.8, 0);
    const rope = new THREE.BufferGeometry().setFromPoints([V(0, 6.6, 0), V(0, 2.6, 0)]); g.add(new THREE.LineSegments(rope, SM.line));
    pt(g, bx(1.3, 1.1, 1.3), SM.ice, 0, 2.0, 0, 0, 0.4, 0);
    pt(g, bx(1.4, 0.9, 1.2), SM.scrap, 2.8, 0.45, -1.8); pt(g, cy(0.3, 0.3, 1.3, 8), SM.rust, 2.8, 1.0, -1.8, 0, 0, Math.PI/2);
    pt(g, bx(1.8, 0.25, 3.4), SM.timber, -3, 0.35, 1.5);
    for (let k = 0; k < 4; k++) pt(g, bx(0.75, 0.6, 0.75), SM.ice, -3 + (k % 2)*0.8 - 0.4, 0.8 + (k > 1 ? 0.6 : 0), 1 + (k % 2)*0.9, 0, rnd(), 0);
    flag(g, 2.2, 4.2, 1.6, SM.tarp, 1.2);
    pt(g, new THREE.SphereGeometry(0.16, 8, 6), SM.lamp, 0, 6.2, 0.35);
    return g;
  },
  signal(rnd){
    // a signal tower: a rickety lattice mast with antennas and pennants, a scrap hut at its foot
    const g = new THREE.Group(), H = 15, b = 1.4, t = 0.4;
    for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) beam(g, [sx*b, 0, sz*b], [sx*t, H, sz*t], 0.08, SM.rust);
    const br = [];
    for (let y = 0; y < H - 1; y += 1.8){
      const w0 = b - (b - t)*(y/H), w1 = b - (b - t)*((y + 1.8)/H);
      for (const [ax, az, cx, cz] of [[-1, -1, 1, -1], [1, -1, 1, 1], [1, 1, -1, 1], [-1, 1, -1, -1]]) br.push(ax*w0, y, az*w0, cx*w1, y + 1.8, cz*w1);
    }
    const bg = new THREE.BufferGeometry(); bg.setAttribute('position', new THREE.Float32BufferAttribute(br, 3)); g.add(new THREE.LineSegments(bg, SM.line));
    pt(g, bx(1.6, 0.15, 1.6), SM.timber, 0, H*0.62, 0); pt(g, bx(1.1, 0.15, 1.1), SM.timber, 0, H, 0);
    beam(g, [0, H, 0], [0, H + 4, 0], 0.05, SM.scrap); beam(g, [-0.9, H + 2.6, 0], [0.9, H + 2.6, 0], 0.03, SM.scrap); beam(g, [0, H + 1.6, -0.7], [0, H + 1.6, 0.7], 0.03, SM.scrap);
    pt(g, new THREE.SphereGeometry(0.9, 10, 4, 0, Math.PI*2, 0, 0.9), SM.scrap, 0.9, H*0.62 + 0.9, 0.3, -1.6).material = SM.scrap;
    pt(g, new THREE.SphereGeometry(0.2, 8, 6), SM.lamp, 0, H + 4.1, 0);
    flag(g, 0.6, H + 2.2, 0.6, SM.tarp); flag(g, -0.6, H - 1, -0.6);
    pt(g, bx(2.6, 2, 2.2), SM.timber, 2.6, 1, 1.8); pt(g, bx(3.0, 0.08, 2.6), SM.tarpRed, 2.6, 2.2, 1.8, 0.18);
    pt(g, bx(0.6, 0.5, 0.05), SM.window, 2.6, 1.2, 2.92);
    return g;
  },
  shacks(rnd){
    // a cluster of stilt shacks joined by plank walkways, tarps for roofs, lit windows
    const g = new THREE.Group(), huts = [[-5, 2, 0.8], [0.5, -3.5, 2.2], [5.5, 1.5, 1.2], [0, 5, 0.4]];
    for (const [x, z, lift] of huts){
      for (const [dx, dz] of [[-1.4, -1.2], [1.4, -1.2], [-1.4, 1.2], [1.4, 1.2]]) beam(g, [x + dx, -0.5, z + dz], [x + dx, lift + 0.1, z + dz], 0.09, SM.timber2);
      pt(g, bx(3.2, 2.3, 2.8), rnd() < 0.5 ? SM.timber : SM.scrap, x, lift + 1.25, z, 0, (rnd() - 0.5)*0.3, 0);
      pt(g, bx(3.8, 0.08, 3.4), rnd() < 0.5 ? SM.tarp : SM.tarpRed, x, lift + 2.6, z, 0.22, 0, 0);
      pt(g, bx(0.7, 0.55, 0.05), SM.window, x, lift + 1.4, z + 1.42);
    }
    for (let k = 0; k < huts.length - 1; k++){
      const [ax, az, al] = huts[k], [bx2, bz, bl] = huts[k + 1];
      const L = Math.hypot(bx2 - ax, bz - az), a = Math.atan2(bx2 - ax, bz - az);
      const w = pt(g, bx(0.9, 0.08, L), SM.timber, (ax + bx2)/2, (al + bl)/2 + 0.12, (az + bz)/2); w.rotation.order = 'YXZ'; w.rotation.set(-Math.atan2(bl - al, L), a, 0);
    }
    flag(g, 6.5, 6.5, 3, SM.tarp); pt(g, new THREE.SphereGeometry(0.18, 8, 6), SM.lamp, -5, 3.6, 3.6);
    beam(g, [0.5, 4.5, -3.5], [0.5, 8, -3.5], 0.05, SM.scrap);
    return g;
  },
});

// merge a model into one mesh per material (and one set of lines), so a building costs a handful of draw calls
function mergeModel(src){
  src.updateMatrixWorld(true);
  const meshes = new Map(), segs = [];
  src.traverse(o => {
    if (o.isMesh){
      const geo = (o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone()); geo.applyMatrix4(o.matrixWorld);
      if (!meshes.has(o.material)) meshes.set(o.material, { p: [], n: [] });
      const m = meshes.get(o.material); m.p.push(geo.attributes.position.array); m.n.push(geo.attributes.normal.array);
    } else if (o.isLineSegments){
      const geo = o.geometry.clone(); geo.applyMatrix4(o.matrixWorld); segs.push(geo.attributes.position.array);
    }
  });
  const cat = arrs => { const n = arrs.reduce((a, b) => a + b.length, 0), out = new Float32Array(n); let i = 0; for (const a of arrs){ out.set(a, i); i += a.length; } return out; };
  const out = new THREE.Group();
  for (const [mat, m] of meshes){
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(cat(m.p), 3)); geo.setAttribute('normal', new THREE.BufferAttribute(cat(m.n), 3));
    geo.computeBoundingSphere(); const mesh = new THREE.Mesh(geo, mat); if (mat === SM.glass) mesh.renderOrder = 2; out.add(mesh);
  }
  if (segs.length){ const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(cat(segs), 3)); geo.computeBoundingSphere(); out.add(new THREE.LineSegments(geo, SM.line)); }
  return out;
}

// ---- orbs: a glow sprite round a small bright core
const orbCoreGeo = new THREE.SphereGeometry(0.2, 16, 12);
const orbCoreMat = new THREE.MeshBasicMaterial({ color: 0xfff1c4, fog: false });
function buildOrb(){
  const g = new THREE.Group();
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: orbGlowTex, color: 0xffffff, transparent: true, depthWrite: false, fog: false }));
  halo.scale.set(1.5, 1.5, 1);
  const core = new THREE.Mesh(orbCoreGeo, orbCoreMat);
  g.add(halo, core);
  return { g, halo, core };
}

// ---- the kiosks: outpost terminals beside the trail, a slate foot, a white column, an angled screen (-z, facing the
// trail), a row of progress lights (one per orb), and a beacon on a mast you can spot from a distance
const KIOSK_LOOK = { dormant: 0x2f3b48, active: 0xe0a252, powered: 0x5cc87a };      // screen and progress lights
function buildKiosk(nLights = 10){
  const g = new THREE.Group();
  const screen = new THREE.MeshBasicMaterial({ color: KIOSK_LOOK.dormant }), beaconMat = new THREE.MeshBasicMaterial({ color: 0xdce8f0 });
  pt(g, bx(1.5, 0.5, 1.1), SM.slate, 0, 0.2, 0);
  pt(g, bx(0.7, 2.0, 0.55), SM.hull, 0, 1.4, 0.05);
  pt(g, bx(1.25, 0.85, 0.16), SM.steel, 0, 2.2, -0.12, -0.45);
  pt(g, bx(1.1, 0.7, 0.04), screen, 0, 2.2, -0.21, -0.45);
  const lights = [];
  { const NO = nLights, w = 0.9/(NO - 1); for (let k = 0; k < NO; k++){ const m = new THREE.MeshBasicMaterial({ color: KIOSK_LOOK.dormant }); lights.push(m); pt(g, bx(w*0.7, 0.07, 0.04), m, -0.45 + k*w, 1.6, -0.3); } }
  pt(g, cy(0.04, 0.05, 2.4, 6), SM.steel, 0.3, 3.4, 0.2);
  pt(g, new THREE.SphereGeometry(0.16, 10, 8), beaconMat, 0.3, 4.65, 0.2);
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: orbGlowTex, color: 0xdce8f0, transparent: true, depthWrite: false, fog: false, opacity: 0.5 }));
  halo.position.set(0.3, 4.65, 0.2); halo.scale.set(1.6, 1.6, 1); g.add(halo);
  return { g, screen, lights, beaconMat, halo };
}

// ---- the zone gates (east and south): outpost tech. tall white pylons either side of the doorway with light strips up
// their faces, a barrier of slate-footed panels out to the slopes, a steel lintel with a status light, and two armoured
// door leaves that swing out. hw: half the opening's width; reach: how far the barrier runs out each side;
// ground(lx, lz): the ground's height relative to the gate's foot at a local point (flat if left out). the doors open
// toward local +x; returns the group, the door hinges, the status light and its halo
function buildGate({ hw, reach, ground = () => 0 }){
  const g = new THREE.Group();
  const P = (geo, mat, x, y, z, par = g) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); par.add(m); return m; };
  const status = new THREE.MeshBasicMaterial({ color: 0xd9534a });   // the gate control's antenna light: red until opened
  for (const sz of [-1, 1]){
    const z = sz*(hw + 0.5);
    P(bx(1.3, 1.0, 1.3), SM.slate, 0, 0.3, z);                                  // footing
    P(bx(1.0, 5.4, 1.0), SM.hull, 0, 2.9, z);                                  // pylon
    P(bx(1.12, 0.35, 1.12), SM.steel, 0, 5.75, z);                             // cap
    for (const fx of [-1, 1]) P(bx(0.04, 4.2, 0.14), SM.strip, fx*0.51, 3.0, z); // light strips up both faces
    P(bx(0.9, 0.1, 0.9), SM.strip, 0, 5.98, z);
  }
  // barrier panels out to the slopes, stepped to follow the ground: a slate foot, a white panel, a light line on top
  for (const side of [-1, 1]) for (let z = hw + 1; z < reach; z += 1.5){
    const hz = ground(0, side*(z + 0.75)), zc = side*(z + 0.75);
    P(bx(1.2, 1.1, 1.5), SM.slate, 0, hz - 0.05, zc);
    P(bx(0.7, 1.6, 1.42), SM.hull, 0, hz + 1.3, zc);
    P(bx(0.74, 0.07, 1.42), SM.strip, 0, hz + 2.13, zc);
    P(bx(0.06, 0.08, 1.42), SM.dark, 0.36, hz + 0.75, zc); P(bx(0.06, 0.08, 1.42), SM.dark, -0.36, hz + 0.75, zc);
  }
  // lintel across the doorway with a light strip under it and the status light in the middle
  P(bx(0.8, 0.55, 2*hw + 2.4), SM.steel, 0, 5.0, 0);
  P(bx(0.5, 0.06, 2*hw - 0.2), SM.strip, 0, 4.7, 0);
  P(cy(0.05, 0.07, 2.2, 6), SM.steel, 0, 6.35, 0);                       // antenna mast on the lintel
  P(new THREE.SphereGeometry(0.24, 10, 8), status, 0, 7.55, 0);
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: orbGlowTex, color: 0xd9534a, transparent: true, depthWrite: false, fog: false, opacity: 0.8 }));
  halo.position.set(0, 7.55, 0); halo.scale.set(2, 2, 1); g.add(halo);
  const doors = [];
  for (const side of [-1, 1]){
    // each leaf hinges on its pylon and spans half the opening: a white armoured panel in a slate frame,
    // with a light seam down the leading edge and a dark chevron band
    const hinge = new THREE.Group(); hinge.position.set(0, 0, side*hw); g.add(hinge);
    const w = hw - 0.06, mid = -side*w/2;
    P(bx(0.22, 2.5, w), SM.hull, 0, 1.4, mid, hinge);
    P(bx(0.28, 0.22, w), SM.slate, 0, 0.2, mid, hinge); P(bx(0.28, 0.22, w), SM.slate, 0, 2.62, mid, hinge);
    P(bx(0.28, 2.6, 0.18), SM.slate, 0, 1.4, -side*0.09, hinge);
    P(bx(0.3, 2.3, 0.08), SM.strip, 0, 1.4, -side*(w - 0.04), hinge);
    P(bx(0.26, 0.3, w*0.8), SM.dark, 0, 1.6, mid, hinge);
    doors.push({ hinge, side });
  }
  return { g, doors, status, halo };
}
// the gate and drawbridge controls: a post with one light per terminal in its zone (red until powered), and an antenna
// light. its face (-z) turns toward what it controls
function buildControlPost(nLights = 3, lightColor = 0xd9534a){
  const g = new THREE.Group();
  pt(g, bx(1.3, 0.5, 1.1), SM.slate, 0, 0.2, 0);
  pt(g, bx(0.8, 2.6, 0.6), SM.hull, 0, 1.7, 0);
  pt(g, bx(0.85, 0.2, 0.65), SM.steel, 0, 3.05, 0);
  const n = nLights, mats = [];
  for (let k = 0; k < n; k++){ const m = new THREE.MeshBasicMaterial({ color: lightColor }); mats.push(m); pt(g, bx(0.22, 0.3, 0.06), m, (k - (n - 1)/2)*0.26, 2.3, -0.32); }
  pt(g, cy(0.04, 0.05, 2.0, 6), SM.steel, 0, 4.1, 0);
  const status = new THREE.MeshBasicMaterial({ color: lightColor });
  pt(g, new THREE.SphereGeometry(0.2, 10, 8), status, 0, 5.15, 0);
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: orbGlowTex, color: lightColor, transparent: true, depthWrite: false, fog: false, opacity: 0.8 }));
  halo.position.set(0, 5.15, 0); halo.scale.set(1.8, 1.8, 1); g.add(halo);
  return { g, lights: mats, status, halo };
}

// ---- the wild: spruces (a trunk and two cone tiers; the game draws thousands as instances) and ice boulders (four
// shapes in three tints, also instanced)
const treeMats = {
  trunk: new THREE.MeshLambertMaterial({ color: 0x4d3f35 }),
  low: new THREE.MeshLambertMaterial({ color: 0x2f4a43 }),
  high: new THREE.MeshLambertMaterial({ color: 0x3e5c53 }),
};
const TREE_PARTS = [
  { geo: new THREE.CylinderGeometry(0.12, 0.18, 1.6, 6), mat: treeMats.trunk, y: 0.8 },
  { geo: new THREE.ConeGeometry(1.5, 3.4, 8), mat: treeMats.low, y: 2.7 },
  { geo: new THREE.ConeGeometry(1.05, 2.6, 8), mat: treeMats.high, y: 4.4 },
];
function buildTree(){ const g = new THREE.Group(); for (const p of TREE_PARTS){ const m = new THREE.Mesh(p.geo, p.mat); m.position.y = p.y; g.add(m); } return g; }
// shapes: rounded boulder, rougher boulder, tall shard, flat slab; tints: the beacon's ice, a deeper blue, a frosty white
const BOULDER = (() => {
  const geos = [new THREE.DodecahedronGeometry(1, 0), new THREE.IcosahedronGeometry(1, 0), new THREE.OctahedronGeometry(1, 0), new THREE.DodecahedronGeometry(1, 0)];
  const scaleOf = [[1, 0.8, 1], [1, 0.75, 0.9], [0.45, 1.8, 0.4], [1.4, 0.35, 1.1]];
  const tints = [0xc3d4e0, 0xa9c9dc, 0xdfe9f0].map(c => { const m = new THREE.MeshLambertMaterial({ color: c }); m.flatShading = true; return m; });
  return { geos, scaleOf, tints };
})();
// one boulder part as the game sets it: shape 0-3, tint 0-2, size s, sitting on the ground
function buildBoulder(shape = 0, tint = 0, s = 1){
  const m = new THREE.Mesh(BOULDER.geos[shape], BOULDER.tints[tint]), S0 = BOULDER.scaleOf[shape];
  m.scale.set(S0[0]*s, S0[1]*s, S0[2]*s); m.position.y = (shape === 2 ? S0[1]*s*0.55 : shape === 3 ? 0.05 : s*0.3) - 0.15;
  const g = new THREE.Group(); g.add(m); return g;
}

// ---- creatures and people
const MOOSE_MAT = {
  hide: lam(0x6c5a8e), dark: lam(0x4a3d66), belly: lam(0x8e7cb0), tent: lam(0x9a86bf), tip: lam(0xc3b5dc),
  antler: lam(0x3f3550), eye: new THREE.MeshBasicMaterial({ color: 0xe8d38a }),
};
for (const k of ['hide', 'dark', 'belly', 'tent', 'tip', 'antler']) MOOSE_MAT[k].flatShading = true;
const MG = {
  ball: new THREE.SphereGeometry(1, 14, 10), small: new THREE.SphereGeometry(1, 8, 6),
  thigh: (() => { const g = new THREE.CylinderGeometry(0.17, 0.12, 1.0, 7); g.translate(0, -0.5, 0); return g; })(),
  shin: (() => { const g = new THREE.CylinderGeometry(0.11, 0.07, 1.0, 7); g.translate(0, -0.5, 0); return g; })(),
  hoof: new THREE.CylinderGeometry(0.1, 0.14, 0.14, 7),
  seg: [0.085, 0.07, 0.057, 0.045, 0.034, 0.024].map((r, i, a) => { const g = new THREE.CylinderGeometry(a[i + 1] ?? r*0.7, r, 0.36, 6); g.translate(0, -0.15, 0); return g; /* a little longer than the joint spacing, so bends don't open gaps */ }),
  tine: new THREE.ConeGeometry(0.07, 0.5, 5), beam: new THREE.CylinderGeometry(0.07, 0.09, 0.7, 6),
};
function mpart(parent, geo, mat, x, y, z, sx = 1, sy = 1, sz = 1){ const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.scale.set(sx, sy, sz); parent.add(m); return m; }
function buildMoose(calf = false){
  // faces -z (north) at rotation 0, like the skier; feet on y = 0
  const root = new THREE.Group(), body = new THREE.Group(); root.add(body);
  mpart(body, MG.ball, MOOSE_MAT.hide, 0, 2.1, 0.1, 0.85, 0.8, 1.65);          // barrel
  mpart(body, MG.ball, MOOSE_MAT.belly, 0, 1.8, 0.1, 0.7, 0.55, 1.4);
  mpart(body, MG.ball, MOOSE_MAT.hide, 0, 2.6, -0.85, 0.7, 0.65, 0.8);        // shoulder hump
  mpart(body, MG.ball, MOOSE_MAT.dark, 0, 2.3, 1.55, 0.35, 0.3, 0.3);          // stubby tail
  const head = new THREE.Group(); head.position.set(0, 2.75, -1.7); body.add(head);
  { const n = mpart(head, MG.ball, MOOSE_MAT.hide, 0, 0, -0.35, 0.38, 0.42, 0.65); n.rotation.x = 0.5; }   // neck
  mpart(head, MG.ball, MOOSE_MAT.hide, 0, 0.15, -0.95, 0.4, 0.45, 0.6);       // skull
  mpart(head, MG.ball, MOOSE_MAT.dark, 0, -0.15, -1.5, 0.32, 0.32, 0.45);     // long drooping muzzle
  for (const sx of [-1, 1]) mpart(head, MG.small, MOOSE_MAT.eye, sx*0.3, 0.3, -1.12, 0.07, 0.07, 0.07);
  if (!calf) for (const sx of [-1, 1]){
    // palmate antlers: a beam out to a broad flat palm with tines round its edge
    const a = new THREE.Group();
    const bm = mpart(a, MG.beam, MOOSE_MAT.antler, sx*0.3, 0.2, 0); bm.rotation.z = -sx*1.0;
    const palm = mpart(a, MG.ball, MOOSE_MAT.antler, sx*0.85, 0.45, 0.05, 0.7, 0.08, 0.45); palm.rotation.z = sx*0.35;
    for (let k = 0; k < 5; k++){ const t = mpart(a, MG.tine, MOOSE_MAT.antler, sx*(0.4 + k*0.25), 0.75 + Math.sin(k)*0.1, -0.25 + k*0.12); t.rotation.z = -sx*0.25; }
    const merged = mergeModel(a); merged.position.set(sx*0.28, 0.5, -0.85); merged.rotation.z = -sx*0.5; head.add(merged);   // one mesh per antler
  }
  // the beard: tentacles hanging from the muzzle and jaw, each a chain of tapering segments
  const tentacles = [];
  const tentacle = (parent, x, y, z, n, phase) => {
    let p = parent; const segs = [];
    for (let k = 0; k < n; k++){
      const g = new THREE.Group(); g.position.set(k ? 0 : x, k ? -0.3 : y, k ? 0 : z); p.add(g);
      mpart(g, MG.seg[Math.min(k, MG.seg.length - 1)], k >= n - 2 ? MOOSE_MAT.tip : MOOSE_MAT.tent, 0, 0, 0);
      segs.push(g); p = g;
    }
    tentacles.push({ segs, phase });
  };
  for (let k = 0; k < 6; k++){ const a = (k/5 - 0.5)*2.2; tentacle(head, Math.sin(a)*0.26, -0.38, -1.55 + Math.cos(a)*0.22, 4 + (k % 3), k*0.9); }
  for (const sx of [-1, 1]) tentacle(body, sx*0.35, 1.45, -0.6, 4, sx*2);         // two on the chest
  tentacle(body, 0, 2.2, 1.75, 4, 5);                                            // and one for a tail
  // six legs in three pairs; each a hip joint, thigh, knee joint, shin and hoof
  const legs = [];
  for (const [z, sx, set] of [[-0.95, -1, 0], [-0.95, 1, 1], [0.1, -1, 1], [0.1, 1, 0], [1.1, -1, 0], [1.1, 1, 1]]){
    const hip = new THREE.Group(); hip.position.set(sx*0.55, 2.0, z); body.add(hip);
    mpart(hip, MG.thigh, MOOSE_MAT.dark, 0, 0, 0);
    const knee = new THREE.Group(); knee.position.set(0, -1.0, 0); hip.add(knee);
    mpart(knee, MG.shin, MOOSE_MAT.dark, 0, 0, 0);
    mpart(knee, MG.hoof, MOOSE_MAT.antler, 0, -1.0, 0);
    legs.push({ hip, knee, set });
  }
  return { root, body, head, legs, tentacles };
}

const NPC_MAT = {
  skin: lam(0xd9b8a0), skin2: lam(0xa38068), pants: lam(0x2f3b48), boot: lam(0x222a33), pack: lam(0x4f6276),
  parka: [0xc98a3e, 0x4f6f8f, 0xb5523b, 0x7c97b0, 0x6f7f63, 0xd6dde4, 0x7a6250].map(c => lam(c)),
  hat: [0x2f3b48, 0xc98a3e, 0xb5523b, 0xe3e8ec].map(c => lam(c)),
  alien: lam(0x5f86a8), alien2: lam(0x4a6d8c), robe: lam(0x6e5a4a), robe2: lam(0x4d3f35), sash: lam(0xa88c5c),
  eye: new THREE.MeshBasicMaterial({ color: 0x1e2a36 }),
};
for (const k of ['robe', 'robe2', 'alien', 'alien2']) NPC_MAT[k].flatShading = true;
const NG = {
  ball: new THREE.SphereGeometry(1, 12, 9), leg: (() => { const g = new THREE.CylinderGeometry(0.075, 0.06, 0.86, 7); g.translate(0, -0.43, 0); return g; })(),
  arm: (() => { const g = new THREE.CylinderGeometry(0.06, 0.05, 0.6, 7); g.translate(0, -0.3, 0); return g; })(),
  sleeve: (() => { const g = new THREE.CylinderGeometry(0.06, 0.12, 0.5, 8); g.translate(0, -0.25, 0); return g; })(),
  torso: new THREE.CylinderGeometry(0.2, 0.25, 0.62, 10), boot: new THREE.BoxGeometry(0.13, 0.1, 0.24),
  robe: new THREE.ConeGeometry(0.42, 1.0, 12), ear: (() => { const g = new THREE.ConeGeometry(0.035, 0.42, 6); g.translate(0, 0.21, 0); return g; })(),
};
function npart(parent, geo, mat, x, y, z, sx = 1, sy = 1, sz = 1){ const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.scale.set(sx, sy, sz); parent.add(m); return m; }
function buildHuman(rnd){
  // ~1.8 m tall, facing -z; parka, beanie, some with a backpack
  const root = new THREE.Group(), body = new THREE.Group(); root.add(body);
  const parka = NPC_MAT.parka[(rnd()*NPC_MAT.parka.length) | 0], skin = rnd() < 0.5 ? NPC_MAT.skin : NPC_MAT.skin2;
  const legs = [-1, 1].map(sx => { const h = new THREE.Group(); h.position.set(sx*0.11, 0.9, 0); body.add(h); npart(h, NG.leg, NPC_MAT.pants, 0, 0, 0); npart(h, NG.boot, NPC_MAT.boot, 0, -0.86, -0.05); return h; });
  npart(body, NG.torso, parka, 0, 1.22, 0);
  npart(body, NG.ball, parka, 0, 1.52, 0, 0.24, 0.1, 0.17);                     // shoulders
  const head = new THREE.Group(); head.position.set(0, 1.66, 0); body.add(head);
  npart(head, NG.ball, skin, 0, 0, 0, 0.115, 0.13, 0.12);
  npart(head, NG.ball, NPC_MAT.hat[(rnd()*NPC_MAT.hat.length) | 0], 0, 0.05, 0.01, 0.125, 0.1, 0.13);
  if (rnd() < 0.45) npart(body, new THREE.BoxGeometry(0.3, 0.38, 0.16), NPC_MAT.pack, 0, 1.25, 0.2);
  const arms = [-1, 1].map(sx => { const s = new THREE.Group(); s.position.set(sx*0.25, 1.5, 0); s.rotation.z = sx*0.12; body.add(s); npart(s, NG.arm, parka, 0, 0, 0); npart(s, NG.ball, NPC_MAT.pants, 0, -0.62, 0, 0.055, 0.055, 0.055); return s; });
  return { root, body, head, legs, arms };
}
function buildAlien(rnd){
  // ~1.3 m: a long brown robe whose train drags behind, a blue head with long swept-back ears
  const root = new THREE.Group(), body = new THREE.Group(); root.add(body);
  npart(body, NG.robe, rnd() < 0.5 ? NPC_MAT.robe : NPC_MAT.robe2, 0, 0.5, 0);
  const train = new THREE.Group(); train.position.set(0, 0.04, 0.15); body.add(train);
  npart(train, NG.ball, NPC_MAT.robe2, 0, 0, 0.55, 0.36, 0.05, 0.75);           // the hem trailing over the snow
  npart(train, NG.ball, NPC_MAT.robe2, 0, 0.02, 1.15, 0.24, 0.035, 0.4);
  npart(body, NG.ball, NPC_MAT.robe, 0, 0.98, 0, 0.24, 0.16, 0.22);             // mantle over the shoulders
  npart(body, NG.ball, NPC_MAT.sash, 0, 0.72, 0, 0.27, 0.035, 0.25);
  const head = new THREE.Group(); head.position.set(0, 1.17, -0.02); body.add(head);
  const skin = rnd() < 0.6 ? NPC_MAT.alien : NPC_MAT.alien2;
  npart(head, NG.ball, skin, 0, 0, 0, 0.14, 0.17, 0.14);
  for (const sx of [-1, 1]){
    npart(head, NG.ball, NPC_MAT.eye, sx*0.055, 0.02, -0.125, 0.03, 0.04, 0.02);
    const ear = npart(head, NG.ear, skin, sx*0.12, 0.03, 0.02); ear.rotation.set(0.55, 0, -sx*1.15);   // long, out and swept back
  }
  npart(head, NG.ball, NPC_MAT.robe2, 0, 0.06, 0.09, 0.15, 0.13, 0.1);           // a hood fallen back
  const arms = [-1, 1].map(sx => { const s = new THREE.Group(); s.position.set(sx*0.2, 0.98, 0); s.rotation.z = sx*0.18; body.add(s); npart(s, NG.sleeve, NPC_MAT.robe, 0, 0, 0); npart(s, NG.ball, skin, 0, -0.52, 0, 0.045, 0.05, 0.045); return s; });
  return { root, body, head, arms, train, ears: head.children.filter(c => c.geometry === NG.ear) };
}


// ---- the crystal hunt and the crystal gate (zones 1 to 4)
const CRYSTAL_MAT = {
  gem: new THREE.MeshLambertMaterial({ color: 0x7e66b4, emissive: 0x352659, flatShading: true }),
  gem2: new THREE.MeshLambertMaterial({ color: 0xa993d6, emissive: 0x4a3a7a, flatShading: true }),
  beam: new THREE.MeshBasicMaterial({ color: 0xa993d6, transparent: true, opacity: 0.32, depthWrite: false, fog: false, side: THREE.DoubleSide }),
  core: new THREE.MeshBasicMaterial({ color: 0xddd3f0, transparent: true, opacity: 0.55, depthWrite: false, fog: false }),
};

// ---- the court's regalia: drapes and gold crowns (the elders, crowned calves, and you in the reward outfit)
const GOLD = lam(0xe6bf4f); GOLD.flatShading = true; const GOLD_2S = GOLD.clone(); GOLD_2S.side = THREE.DoubleSide;
const ROYAL = 0x7b3fe0, ROYAL_MAT = lam(ROYAL); ROYAL_MAT.flatShading = true;      // the trio's leader wears it, and so do you once you've been through the black hole
const DRAPES = [0xd9468f, 0x2bb3a3, 0xf0a83a, 0xe0533d, 0x3f8fe0].map(c => { const m = lam(c); m.flatShading = true; return m; });
const DG = {
  drape: new THREE.SphereGeometry(1, 20, 8, 0, Math.PI*2, 0, Math.PI*0.56), hem: new THREE.TorusGeometry(1, 0.045, 5, 32),
  band: cy(0.3, 0.27, 0.2, 12, true), spike: new THREE.ConeGeometry(0.055, 0.24, 5), knob: new THREE.SphereGeometry(0.04, 6, 5),
  emblem: new THREE.OctahedronGeometry(1, 0), tassel: new THREE.SphereGeometry(0.07, 6, 5),
};
function dressMoose(rig, k, mat){
  // a drape over the barrel with a gold hem, a gold diamond on each flank and tassels at the corners; a gold crown
  // of spikes with a crystal at its brow. built hidden at zero size so it can be popped on
  const drape = new THREE.Group(); drape.position.set(0, 2.1, 0.1); rig.body.add(drape);
  drape.add(new THREE.Mesh(DG.drape, mat || DRAPES[k % DRAPES.length])).scale.set(0.93, 0.88, 1.73);
  const hem = new THREE.Mesh(DG.hem, GOLD); hem.position.y = -0.88*0.187; hem.rotation.x = Math.PI/2; hem.scale.set(0.93*0.982, 1.73*0.982, 1); drape.add(hem);
  for (const sx of [-1, 1]){
    const e = new THREE.Mesh(DG.emblem, GOLD); e.position.set(sx*0.9, 0.28, 0); e.scale.set(0.05, 0.3, 0.22); drape.add(e);
    for (const sz of [-1, 1]){ const t = new THREE.Mesh(DG.tassel, GOLD); t.position.set(sx*0.62, -0.32, sz*1.15); drape.add(t); }
  }
  const crown = buildCrown(); crown.position.set(0, 0.56, -0.92); rig.head.add(crown);
  return { drape, crown };
}
function buildCrown(){
  // the court's crown: a gold band, six spikes tipped with gold beads, and a crystal diamond at the brow (facing -z)
  const crown = new THREE.Group();
  const band = new THREE.Mesh(DG.band, GOLD_2S); band.position.y = 0.1; crown.add(band);
  for (let i = 0; i < 6; i++){
    const a = i/6*Math.PI*2, s = new THREE.Mesh(DG.spike, GOLD); s.position.set(Math.sin(a)*0.27, 0.3, -Math.cos(a)*0.27); crown.add(s);
    const kb = new THREE.Mesh(DG.knob, GOLD); kb.position.set(Math.sin(a)*0.27, 0.43, -Math.cos(a)*0.27); crown.add(kb);
  }
  const gem = new THREE.Mesh(DG.emblem, CRYSTAL_MAT.gem); gem.position.set(0, 0.13, -0.3); gem.scale.set(0.08, 0.12, 0.05); crown.add(gem);
  return crown;
}

// the altars: the Broken Circle's (and the cave's twin), and the ceremony's in the crowned court (gold studs, its heart
// already lit). a bone plinth with four horns round a crystal heart, a column of light that shows once it's done
function buildAltar(ceremony = false, { lit = ceremony, beam: withBeam = true } = {}){   // (the cave's twin: lit, no column)
  const g = new THREE.Group();
  pt(g, cy(1.5, 1.9, 0.9, 8), SM.bone2, 0, 0.45, 0);
  pt(g, cy(0.75, 1.05, 1.5, 8), SM.bone, 0, 1.6, 0);
  pt(g, cy(1.35, 1.0, 0.35, 8), SM.bone2, 0, 2.5, 0);
  for (let k = 0; k < 4; k++){ const a = k/4*Math.PI*2 + 0.4; pt(g, new THREE.ConeGeometry(0.25, 1.6, 5), SM.bone, Math.cos(a)*1.25, 3.1, Math.sin(a)*1.25, Math.sin(a)*0.35, 0, -Math.cos(a)*0.35); }
  if (ceremony) for (let k = 0; k < 6; k++){ const a = k/6*Math.PI*2; pt(g, new THREE.BoxGeometry(0.16, 0.05, 0.16), GOLD, Math.cos(a)*1.0, 2.69, Math.sin(a)*1.0); }
  // the heart crystal: dull while asleep, glowing once woken (the ceremony's is lit from the start)
  const heart = lit ? new THREE.MeshLambertMaterial({ color: 0xa993d6, emissive: 0x4a3a7a, flatShading: true }) : new THREE.MeshLambertMaterial({ color: 0x6c5a8e, emissive: 0x000000, flatShading: true });
  const gem = pt(g, new THREE.OctahedronGeometry(0.55, 0), heart, 0, 3.5, 0); gem.scale.set(1, 1.8, 1);
  let beam = null; if (withBeam){ beam = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.8, 14, 14, 1, true), CRYSTAL_MAT.beam); beam.position.y = 10; if (!ceremony) beam.visible = false; g.add(beam); }
  return { g, gem, heart, beam };
}
// one of the twenty hunt crystals: a cluster of long faceted crystals leaning out of the snow under a 10 m column of light
function buildCrystal(){
  const g = new THREE.Group();
    // a cluster of long faceted crystals leaning out of the snow
    for (let k = 0; k < 5; k++){
      const h = k ? 0.8 + ((k*37) % 7)/7 : 1.8, m = new THREE.Mesh(new THREE.OctahedronGeometry(0.35, 0), k % 2 ? CRYSTAL_MAT.gem2 : CRYSTAL_MAT.gem);
      m.scale.set(k ? 0.6 : 0.8, h*1.6, k ? 0.6 : 0.8); const a = k*1.3;
      m.position.set(k ? Math.cos(a)*0.45 : 0, h*0.45, k ? Math.sin(a)*0.45 : 0); m.rotation.set(k ? Math.sin(a)*0.5 : 0, a, k ? Math.cos(a)*0.5 : 0); g.add(m);
    }
    // the column of light: a soft outer beam and a brighter thread up its middle, 10 m tall
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 1.05, 10, 16, 1, true), CRYSTAL_MAT.beam); beam.position.y = 5; g.add(beam);
    const core = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.2, 10, 8, 1, true), CRYSTAL_MAT.core); core.position.y = 5; g.add(core);
  return { g, beam };
}
// the crystal gate: two tall pale pylons grown like the ruins, a lintel at 21 m, and two great doors seamed with purple
// light that swing inward. W: half the opening
function buildCrystalGate(W = 9, H = 21){
  const g = new THREE.Group();
  for (const sx of [-1, 1]){
    const p = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 1.6, H + 3, 9), SM.bone); p.position.set(sx*(W + 1.4), (H + 3)/2 - 0.5, 0); g.add(p);
    for (let k = 0; k < 5; k++){ const r = new THREE.Mesh(new THREE.TorusGeometry(1.45 - k*0.08, 0.18, 6, 14), SM.bone2); r.rotation.x = Math.PI/2; r.position.set(sx*(W + 1.4), 3 + k*4.2, 0); g.add(r); }
    // flanking walls from the pylon into the notch's sides, so nothing beyond shows past the gate: a tall ribbed slab,
    // its foot sunk in the snow, running well into the rock
    const wl = 26, wall = new THREE.Mesh(new THREE.BoxGeometry(wl, H + 6, 2.6), SM.bone); wall.position.set(sx*(W + 2.2 + wl/2), (H + 6)/2 - 3, 0.3); g.add(wall);
    for (let k = 0; k < 6; k++){ const rib = new THREE.Mesh(new THREE.BoxGeometry(0.9, H + 4, 3.2), SM.bone2); rib.position.set(sx*(W + 4.5 + k*3.6), (H + 4)/2 - 3, 0.3); g.add(rib); }
    const sp = new THREE.Mesh(new THREE.ConeGeometry(0.7, 4, 7), SM.bone2); sp.position.set(sx*(W + 1.4), H + 4, 0); g.add(sp);
  }
  const lintel = new THREE.Mesh(new THREE.BoxGeometry(2*W + 6, 1.6, 2.2), SM.bone); lintel.position.set(0, H + 0.6, 0); g.add(lintel);
  const glowBar = new THREE.Mesh(new THREE.BoxGeometry(2*W, 0.3, 2.3), CRYSTAL_MAT.core); glowBar.position.set(0, H - 0.4, 0); g.add(glowBar);
  const gemTop = new THREE.Mesh(new THREE.OctahedronGeometry(1.4, 0), CRYSTAL_MAT.gem); gemTop.scale.set(1, 1.6, 1); gemTop.position.set(0, H + 3.2, 0); g.add(gemTop);
  const doors = [];
  for (const sx of [-1, 1]){
    // each door hinges on its pylon and reaches the middle; a slab with ribs and a glowing seam
    const hinge = new THREE.Group(); hinge.position.set(sx*W, 0, 0); g.add(hinge);
    const slab = new THREE.Mesh(new THREE.BoxGeometry(W, H - 0.4, 0.7), SM.bone); slab.position.set(-sx*W/2, (H - 0.4)/2, 0); hinge.add(slab);
    for (let k = 0; k < 7; k++){ const rib = new THREE.Mesh(new THREE.BoxGeometry(W - 0.6, 0.35, 0.95), SM.bone2); rib.position.set(-sx*W/2, 1.6 + k*2.8, 0); hinge.add(rib); }
    const seam = new THREE.Mesh(new THREE.BoxGeometry(0.25, H - 1, 0.8), CRYSTAL_MAT.core); seam.position.set(-sx*(W - 0.2), (H - 0.4)/2, 0); hinge.add(seam);
    const glyph = new THREE.Mesh(new THREE.OctahedronGeometry(0.9, 0), CRYSTAL_MAT.gem2); glyph.scale.set(0.6, 1.4, 0.4); glyph.position.set(-sx*W*0.55, H*0.55, -0.45); hinge.add(glyph);
    doors.push({ hinge, sx });
  }
  return { g, doors, gemTop };
}

// zone 4's outcrops: a cluster of long faceted crystals and a few stones, merged into one mesh (size about 1-3, seed fixes the shape)
const OUTCROP_MATS = [lam(0x6c5a8e), lam(0x9a86bf), lam(0x4a3d66)]; for (const k of OUTCROP_MATS) k.flatShading = true;
function buildOutcrop(size = 2, seed = 1){
  const [m1, m2, m3] = OUTCROP_MATS, o = { size };
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    const g = new THREE.Group(), n = 4 + (rnd()*6 | 0);
    for (let k = 0; k < n; k++){
      const h = (k ? 0.6 + rnd()*1.2 : 1.6) * o.size, w = (0.25 + rnd()*0.2) * o.size, a = rnd()*Math.PI*2, d = k ? (0.3 + rnd()*0.7)*o.size : 0;
      const m = new THREE.Mesh(new THREE.OctahedronGeometry(1, 0), [m1, m2, m3][k % 3]);
      m.scale.set(w, h, w*(0.7 + rnd()*0.5)); m.position.set(Math.cos(a)*d, h*0.55 - 0.2, Math.sin(a)*d);
      m.rotation.set((rnd() - 0.5)*0.9, rnd()*3, (rnd() - 0.5)*0.9); g.add(m);
    }
    for (let k = 0; k < 3; k++){ const r = new THREE.Mesh(new THREE.DodecahedronGeometry(0.35*o.size, 0), SM.scrap); r.position.set((rnd() - 0.5)*o.size*2, 0, (rnd() - 0.5)*o.size*2); g.add(r); }
  return mergeModel(g);
}
// zone 5's plateau crystals: n long crystals round a big one, now and then one glowing (the plateau has about 110,
// merged into one mesh). takes the game's random stream, so it draws its numbers in the game's order
const PLATEAU_MATS = [0x6c5a8e, 0x9a86bf, 0x4a3d66].map(c => { const m = lam(c); m.flatShading = true; return m; });
function buildPlateauCrystal(size = 1.5, rnd = Math.random){
  const c = new THREE.Group(), mats = PLATEAU_MATS;
  const n = 3 + (rnd()*5 | 0), glow = rnd() < 0.18;
  for (let i = 0; i < n; i++){
    const hgt = (i ? 0.5 + rnd()*1.1 : 1.5) * size, w = (0.22 + rnd()*0.2)*size, a = rnd()*Math.PI*2, d = i ? (0.25 + rnd()*0.7)*size : 0;
    const m = new THREE.Mesh(new THREE.OctahedronGeometry(1, 0), glow && i === 0 ? CRYSTAL_MAT.gem : mats[i % 3]);
    m.scale.set(w, hgt, w); m.position.set(Math.cos(a)*d, hgt*0.55, Math.sin(a)*d); m.rotation.set((rnd() - 0.5)*0.8, rnd()*3, (rnd() - 0.5)*0.8); c.add(m);
  }
  return c;
}
// the giant asleep: a grown moose's rig (scaled up 11 times by the game), legs folded under, head down to the snow
function poseGiant(rig){
  rig.body.position.y = -1.3;
  for (const L of rig.legs){ L.hip.rotation.x = 1.25; L.knee.rotation.x = -2.5; }
  rig.head.rotation.set(-0.3, 0.45, 0.2);                        // muzzle down toward the snow
  for (const T of rig.tentacles) T.segs.forEach((g, k) => { g.rotation.x = 0.35; });
  return rig;
}
// ---- zone 5: the observatory. a stepped bone platform, a ring of columns capped with glowing crystals, a domed hall
// (open north and south), and the gateway on the plateau side. domeM fades while you ride through
function buildObservatory(){
  const g = new THREE.Group();
  const gem = CRYSTAL_MAT.gem, gem2 = CRYSTAL_MAT.gem2;
  pt(g, cy(16, 17, 1.2, 28), SM.bone2, 0, 0.6, 0); pt(g, cy(12.5, 13.5, 1.2, 28), SM.bone, 0, 1.8, 0); pt(g, cy(9.5, 10.5, 1.2, 28), SM.bone2, 0, 3.0, 0);
  for (let k = 0; k < 10; k++){
    const a = k/10*Math.PI*2, x = Math.cos(a)*14.4, z = Math.sin(a)*14.4, hgt = 8 + (k % 3)*1.5;
    pt(g, cy(0.55, 0.85, hgt, 9), SM.bone, x, 1.2 + hgt/2, z);
    pt(g, new THREE.TorusGeometry(0.9, 0.16, 6, 14), SM.bone2, x, 1.2 + hgt*0.35, z, Math.PI/2);
    const c = pt(g, new THREE.OctahedronGeometry(0.75, 0), k % 2 ? gem : gem2, x, 1.2 + hgt + 0.9, z); c.scale.set(1, 1.7, 1);
  }
  // the hall: a tall drum with a wide doorway north and south (the Starway runs straight through), under the dome
  const hallM = SM.bone.clone(), domeM = SM.bone2.clone(); hallM.side = THREE.DoubleSide; domeM.transparent = true;   // the dome fades while you ride through, so you can see yourself
  for (const t0 of [Math.PI/6, Math.PI*7/6]) pt(g, new THREE.CylinderGeometry(7.6, 8, 5.4, 14, 1, true, t0, Math.PI*2/3), hallM, 0, 6.3, 0);
  for (const sz of [-1, 1]) for (const sx of [-1, 1]) pt(g, cy(0.5, 0.6, 5.4, 8), SM.bone2, sx*3.8, 6.3, sz*6.6);      // door jambs
  pt(g, dome(7.6, 28, 12), domeM, 0, 9.0, 0);
  pt(g, new THREE.TorusGeometry(7.7, 0.3, 6, 32), SM.bone2, 0, 9.0, 0, Math.PI/2);
  // the gateway on the plateau side
  for (const sx of [-1, 1]) pt(g, cy(0.7, 1, 9, 9), SM.bone, sx*4.5, 4.5, -17);
  tube(g, [[-4.5, 9, -17], [-2.5, 12, -17.3], [0, 13, -17.4], [2.5, 12, -17.3], [4.5, 9, -17]], 0.55, SM.bone2, 20, 7);
  pt(g, new THREE.OctahedronGeometry(0.9, 0), gem, 0, 13.4, -17.4).scale.set(1, 1.6, 1);
  return { g, domeM };
}

// the musicians: zone 5's natives (buildAlien) in bright robes with drums, long horns, harps or crystal chimes.
// i picks the robe colours
  const robes = [[0xd9468f, 0x9e2f66], [0x2bb3a3, 0x1d7d72], [0xf0a83a, 0xb87a22], [0x8a5ce6, 0x5f3ea8], [0xe0533d, 0xa3392a], [0x3f8fe0, 0x2a63a0]].map(([a, b]) => [lam(a), lam(b)]);
  const sash = lam(0xf2d36b), brass = lam(0xd4a64a), hide = lam(0xe9dcc0), wood = lam(0x7a5236);
  for (const r of robes) for (const m of r) m.flatShading = true;
const MUSIC_KINDS = ['drum', 'horn', 'harp', 'chimes'];
function dressMusician(rig, kind, i = 0){
  const [ra, rb] = robes[i % robes.length];
    rig.root.traverse(o => { if (!o.isMesh) return; if (o.material === NPC_MAT.robe) o.material = ra; else if (o.material === NPC_MAT.robe2) o.material = rb; else if (o.material === NPC_MAT.sash) o.material = sash; });
    const b = rig.body, inst = new THREE.Group(); b.add(inst);
    if (kind === 'drum'){ pt(inst, cy(0.24, 0.2, 0.42, 14), wood, 0, 0.62, -0.32); pt(inst, cy(0.245, 0.245, 0.02, 14), hide, 0, 0.84, -0.32); }
    if (kind === 'horn'){ const hg = new THREE.Group(); hg.position.set(0, 1.12, -0.18); hg.rotation.x = -1.15; b.add(hg); pt(hg, new THREE.ConeGeometry(0.16, 1.6, 12, 1, true), brass, 0, 0.85, 0).material.side = THREE.DoubleSide; pt(hg, cy(0.03, 0.03, 0.3, 6), brass, 0, 0.0, 0); }
    if (kind === 'harp'){ pt(inst, new THREE.TorusGeometry(0.32, 0.03, 6, 18, Math.PI*1.2), wood, 0, 0.95, -0.3, 0, 0, 0.4); for (let k = 0; k < 5; k++) pt(inst, cy(0.006, 0.006, 0.45 - k*0.05, 4), hide, -0.15 + k*0.07, 0.95, -0.3); }
    if (kind === 'chimes'){ pt(inst, cy(0.02, 0.02, 1.5, 6), wood, 0.25, 1.0, -0.25); for (let k = 0; k < 4; k++){ const c = pt(inst, new THREE.OctahedronGeometry(0.07, 0), CRYSTAL_MAT.gem2, 0.25 + (k - 1.5)*0.09, 1.55, -0.32); c.scale.set(1, 2.2, 1); } pt(inst, cy(0.01, 0.01, 0.3, 4), wood, 0.25, 1.72, -0.32, 0, 0, Math.PI/2); }
  return rig;
}
// the court's attendants: robed in white and gold, a slim gold staff tipped with a crystal (in the hand i: 0 left, 1 right)
const white = lam(0xf1ece0), white2 = lam(0xd4ccba); white.flatShading = white2.flatShading = true;
function dressAttendant(rig, i = 0){
  rig.root.traverse(o => { if (!o.isMesh) return; if (o.material === NPC_MAT.robe) o.material = white; else if (o.material === NPC_MAT.robe2) o.material = white2; else if (o.material === NPC_MAT.sash) o.material = GOLD; });
  pt(rig.arms[i], cy(0.02, 0.02, 1.5, 6), GOLD, 0, -0.5, 0);                // a slim gold staff
  pt(rig.arms[i], new THREE.OctahedronGeometry(0.08, 0), CRYSTAL_MAT.gem, 0, 0.27, 0).scale.set(1, 1.8, 1);
  return rig;
}
// the court's diamond insignias: a dark inlay round a pale stone that lights (mat) when a calf stands on it
const rhomb = (L, W) => { const sh = new THREE.Shape(); sh.moveTo(0, L); sh.lineTo(W, 0); sh.lineTo(0, -L); sh.lineTo(-W, 0); sh.closePath(); const geo = new THREE.ShapeGeometry(sh); geo.rotateX(-Math.PI/2); return geo; };
const offset = m => { m.polygonOffset = true; m.polygonOffsetFactor = -2; m.polygonOffsetUnits = -2; return m; };
const courtInlay = offset(new THREE.MeshLambertMaterial({ color: 0x3a3052 }));
function buildCourtDiamond(){
  const grp = new THREE.Group();
  grp.add(new THREE.Mesh(rhomb(1.9, 1.15), courtInlay));
  const mat = offset(new THREE.MeshBasicMaterial({ color: 0x6c5a8e })); mat.polygonOffsetFactor = -3;
  const stone = new THREE.Mesh(rhomb(1.35, 0.78), mat); stone.position.y = 0.01; grp.add(stone);
  return { grp, mat };
}

// the warm lamp light (the mine's lanterns and lamp posts)
const lampMat = new THREE.MeshBasicMaterial({ color: 0xffd08a });

// ---- the mine: the miners' things left about the cave floor (each builder fills a group and returns its radius)
const MINE_MATS = { wood: lam(0x7a5a3a), rust: lam(0x8a4b2e), paint: lam(0xd9a63a), steel: new THREE.MeshLambertMaterial({ color: 0x5d6876 }), dark: lam(0x2f3640),
  tent: lam(0xc98a3e), tent2: lam(0x4f6f8f), white: lam(0xd6dde4), red: lam(0xc0453a) };
for (const k in MINE_MATS) MINE_MATS[k].flatShading = true;
const mB = (g, w, h, d, m, x, y, z, ry = 0) => { const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); o.position.set(x, y, z); o.rotation.y = ry; g.add(o); return o; };
const mCy = (g, rt, rb, h, m, x, y, z, rx = 0, rz = 0, n = 10) => { const o = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, n), m); o.position.set(x, y, z); o.rotation.set(rx, 0, rz); g.add(o); return o; };
const MINE_KIT = {
  drill: g => { for (let k = 0; k < 3; k++){ const a = k/3*Math.PI*2; const l = mCy(g, 0.09, 0.12, 6.2, MINE_MATS.paint, Math.cos(a)*1.3, 2.9, Math.sin(a)*1.3); l.rotation.set(Math.sin(a)*0.22, 0, -Math.cos(a)*0.22); }
    mB(g, 1.1, 0.9, 0.9, MINE_MATS.dark, 0, 5.6, 0); mCy(g, 0.12, 0.12, 4.5, MINE_MATS.steel, 0, 2.6, 0); const bit = new THREE.Mesh(new THREE.ConeGeometry(0.25, 0.6, 8), MINE_MATS.steel); bit.rotation.x = Math.PI; bit.position.y = 0.3; g.add(bit); mB(g, 1.4, 0.7, 1.0, MINE_MATS.paint, 1.9, 0.35, 0.6); return 2.2; },
  cart: g => { mB(g, 1.8, 0.9, 1.1, MINE_MATS.rust, 0, 0.85, 0); mB(g, 1.6, 0.06, 0.9, MINE_MATS.dark, 0, 1.28, 0);         // (empty: the mine's been worked out)
    for (const [x, z] of [[-0.6, -0.55], [0.6, -0.55], [-0.6, 0.55], [0.6, 0.55]]) mCy(g, 0.22, 0.22, 0.12, MINE_MATS.dark, x, 0.25, z, Math.PI/2); return 1.3; },
  crates: g => { mB(g, 1.2, 1.2, 1.2, MINE_MATS.wood, 0, 0.6, 0, 0.1); mB(g, 1.0, 1.0, 1.0, MINE_MATS.wood, 1.3, 0.5, 0.2, -0.2); mB(g, 0.9, 0.9, 0.9, MINE_MATS.wood, 0.4, 1.65, 0.1, 0.4); mB(g, 1.2, 0.7, 0.8, MINE_MATS.tent2, -1.1, 0.35, 0.6, 0.3); return 1.8; },
  barrels: g => { const ms = [MINE_MATS.rust, MINE_MATS.tent2, MINE_MATS.red]; for (let k = 0; k < 5; k++){ const a = k*1.3; mCy(g, 0.32, 0.32, 0.95, ms[k % 3], Math.cos(a)*(k ? 0.75 : 0), 0.48, Math.sin(a)*(k ? 0.75 : 0)); } const lying = mCy(g, 0.32, 0.32, 0.95, MINE_MATS.rust, 1.6, 0.32, 0.2, 0, Math.PI/2); lying.rotation.y = 0.6; return 1.4; },
  hut: g => { mB(g, 4.2, 2.6, 3.2, MINE_MATS.white, 0, 1.3, 0); const roof = mB(g, 4.6, 0.25, 3.6, MINE_MATS.tent2, 0, 2.75, 0); roof.rotation.z = 0.06; mB(g, 0.9, 1.9, 0.08, MINE_MATS.dark, 0.8, 0.95, -1.62); mB(g, 1.0, 0.6, 0.08, MINE_MATS.tent, -1.0, 1.6, -1.62);
    mCy(g, 0.05, 0.05, 1.5, MINE_MATS.steel, 1.9, 3.5, 1.2); mB(g, 0.6, 0.4, 0.1, MINE_MATS.red, 1.9, 4.2, 1.2); return 2.8; },
  compressor: g => { mB(g, 2.2, 1.2, 1.2, MINE_MATS.paint, 0, 0.6, 0); mCy(g, 0.45, 0.45, 2.0, MINE_MATS.steel, 0, 1.6, 0, 0, Math.PI/2); for (let k = 0; k < 3; k++) mB(g, 0.08, 0.5, 1.21, MINE_MATS.dark, -0.7 + k*0.7, 0.75, 0);
    const hose = new THREE.Mesh(new THREE.TorusGeometry(0.6, 0.06, 6, 16, Math.PI*1.4), MINE_MATS.dark); hose.position.set(1.4, 0.2, 0); hose.rotation.x = Math.PI/2; g.add(hose); return 1.5; },
  conveyor: g => { const bed = mB(g, 7, 0.3, 1.1, MINE_MATS.dark, 0, 1.6, 0); bed.rotation.z = 0.28; for (let x = -3; x <= 3; x += 2) mCy(g, 0.08, 0.1, 1.8 + x*0.28, MINE_MATS.paint, x, (1.8 + x*0.28)/2, 0.4), mCy(g, 0.08, 0.1, 1.8 + x*0.28, MINE_MATS.paint, x, (1.8 + x*0.28)/2, -0.4);
    return 3.4; },
  lamp: g => { mCy(g, 0.07, 0.09, 4.2, MINE_MATS.steel, 0, 2.1, 0); mB(g, 0.9, 0.08, 0.08, MINE_MATS.steel, 0.4, 4.15, 0); const l = new THREE.Mesh(new THREE.SphereGeometry(0.2, 10, 8), lampMat); l.position.set(0.8, 3.95, 0); g.add(l); mB(g, 0.5, 0.2, 0.5, MINE_MATS.dark, 0, 0.1, 0); return 0.5; },
  reel: g => { mCy(g, 0.9, 0.9, 0.12, MINE_MATS.wood, 0, 0.9, -0.45, Math.PI/2); mCy(g, 0.9, 0.9, 0.12, MINE_MATS.wood, 0, 0.9, 0.45, Math.PI/2); mCy(g, 0.6, 0.6, 0.8, MINE_MATS.dark, 0, 0.9, 0, Math.PI/2); return 1.0; },
  bin: g => { mB(g, 3.2, 1.6, 2.2, MINE_MATS.rust, 0, 1.0, 0); mB(g, 3.0, 0.1, 2.0, MINE_MATS.dark, 0, 1.82, 0); for (const x of [-1.4, 1.4]) for (const z of [-0.9, 0.9]) mB(g, 0.2, 0.4, 0.2, MINE_MATS.steel, x, 0.2, z); return 2.0; },
  barrier: g => { for (const x of [-1.4, 1.4]) mCy(g, 0.06, 0.06, 1.1, MINE_MATS.steel, x, 0.55, 0); for (let k = 0; k < 6; k++) mB(g, 0.5, 0.22, 0.06, k % 2 ? MINE_MATS.white : MINE_MATS.red, -1.25 + k*0.5, 1.0, 0); return 1.5; },
};
function buildMineProp(kind){ const g = new THREE.Group(), r = MINE_KIT[kind](g); return { g, r }; }

// ---- the space station: its hull materials, the domed hub, the ships at the docks (the waiting one bigger, its
// engines red), and the cargo bin for the waiting ship's crystals (its seven crystals hidden until delivered)
const STATION_MATS = { strip: new THREE.MeshBasicMaterial({ color: 0x9fd0ff }), steel: new THREE.MeshLambertMaterial({ color: 0x5c6773 }), hull: new THREE.MeshLambertMaterial({ color: 0xd9dde2 }), hull2: new THREE.MeshLambertMaterial({ color: 0x8e97a2 }), glow: new THREE.MeshBasicMaterial({ color: 0x6fb6ff }) };
function buildStationHub(hubR = 28){
  const { hull, hull2, glow } = STATION_MATS, hb = new THREE.Group();
  const drum = new THREE.Mesh(new THREE.CylinderGeometry(hubR, hubR + 2, 26, 64), hull); drum.position.y = 7; hb.add(drum);
  const band = new THREE.Mesh(new THREE.CylinderGeometry(hubR + 0.2, hubR + 0.2, 1.4, 64, 1, true), glow); band.position.y = 14; hb.add(band);
  const dome = new THREE.Mesh(new THREE.SphereGeometry(hubR - 2, 48, 16, 0, Math.PI*2, 0, Math.PI/2), hull2); dome.scale.y = 0.45; dome.position.y = 20; hb.add(dome);
  for (const [r, y, ht] of [[3, 34, 16], [1.6, 46, 14], [0.6, 58, 12]]){ const c = new THREE.Mesh(new THREE.CylinderGeometry(r*0.8, r, ht, 12), hull); c.position.y = y; hb.add(c); }
  const under = new THREE.Mesh(new THREE.SphereGeometry(hubR + 2, 48, 12, 0, Math.PI*2, Math.PI/2, Math.PI/2), hull2); under.scale.y = 0.35; under.position.y = -6; hb.add(under);
  return hb;
}
function buildShip(L = 60, big = false){
  const { hull, hull2, glow } = STATION_MATS;
  const Wd = big ? 15 : 10, g = new THREE.Group(), r = Wd*0.42;
  const body = new THREE.Mesh(new THREE.CylinderGeometry(r, r*1.1, L*0.72, 16), hull); body.rotation.z = Math.PI/2; g.add(body);
  const nose = new THREE.Mesh(new THREE.ConeGeometry(r, L*0.16, 16), hull); nose.rotation.z = -Math.PI/2; nose.position.x = L*0.44; g.add(nose);
  const eng = new THREE.Mesh(new THREE.BoxGeometry(L*0.12, r*2.2, r*2.4), hull2); eng.position.x = -L*0.42; g.add(eng);
  const eglow = big ? new THREE.MeshBasicMaterial({ color: 0xff4a36 }) : glow;      // the waiting ship's engines glow red
  const jet = new THREE.Mesh(new THREE.CylinderGeometry(r*0.7, r*0.7, 0.4, 16), eglow); jet.rotation.z = Math.PI/2; jet.position.x = -L*0.49; g.add(jet);
  if (big) for (const sd of [-1, 1]){ const j2 = new THREE.Mesh(new THREE.CylinderGeometry(r*0.3, r*0.3, 0.42, 12), eglow); j2.rotation.z = Math.PI/2; j2.position.set(-L*0.49, -r*0.2, sd*r*1.15); g.add(j2); }
  for (const sd of [-1, 1]){ const pod = new THREE.Mesh(new THREE.BoxGeometry(L*0.4, r*0.7, r*0.5), hull2); pod.position.set(-L*0.05, -r*0.2, sd*r*1.15); g.add(pod); }
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(L*0.6, 0.3, r*2.05), big ? new THREE.MeshBasicMaterial({ color: 0xb79cff }) : glow); stripe.position.set(0, r*0.3, 0); g.add(stripe);
  return g;
}
function buildCargoBin(){
  const bg = new THREE.Group(), gems = [];
  const binM = new THREE.MeshLambertMaterial({ color: 0x55606e, side: THREE.DoubleSide });
  for (const [w, d, x, z] of [[3.2, 0.15, 0, -1.6], [3.2, 0.15, 0, 1.6], [0.15, 3.2, -1.6, 0], [0.15, 3.2, 1.6, 0]]){ const m = new THREE.Mesh(new THREE.BoxGeometry(w, 1.8, d), binM); m.position.set(x, 0.3, z); bg.add(m); }
  const fl = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.2, 3.2), binM); fl.position.y = -0.6; bg.add(fl);
  const brk = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.3, 1.0), binM); brk.position.set(-2.0, -0.65, 0); bg.add(brk);     // its bracket to the deck
  const inner = new THREE.Mesh(new THREE.PlaneGeometry(2.9, 2.9), new THREE.MeshBasicMaterial({ color: 0xc9a6ff })); inner.rotation.x = -Math.PI/2; inner.position.y = -0.45; bg.add(inner);
  const glowS = new THREE.Sprite(new THREE.SpriteMaterial({ map: orbGlowTex, color: 0xb48cff, transparent: true, depthWrite: false, fog: false, opacity: 0.9 })); glowS.position.y = 1.0; glowS.scale.set(7, 7, 1); bg.add(glowS);
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.3, 40, 16, 1, true), CRYSTAL_MAT.beam); beam.position.y = 20; bg.add(beam);
  for (const sd of [-1, 1]){ const lab = new THREE.Mesh(new THREE.OctahedronGeometry(0.6, 0), GOLD); lab.scale.set(1, 1.5, 0.08); lab.position.set(0, 0.35, sd*1.7); bg.add(lab);
    const lab2 = new THREE.Mesh(new THREE.OctahedronGeometry(0.6, 0), GOLD); lab2.scale.set(0.08, 1.5, 1); lab2.position.set(1.7, 0.35, 0); bg.add(lab2); }
  for (let k = 0; k < 7; k++){ const c = new THREE.Mesh(new THREE.OctahedronGeometry(0.3, 0), CRYSTAL_MAT.gem2); c.scale.set(1, 1.6, 1); c.position.set(-0.9 + (k % 3)*0.9, -0.1, -0.8 + Math.floor(k/3)*0.8); c.visible = false; bg.add(c); gems.push(c); }
  return { g: bg, gems };
}

// ---- the energy bridges' on-ramp portals: two slender posts and an arch of light over the foot of each ramp. before the
// network is lit just two white poles (lit: the caps, arch and diamond); the arrows on the snow say which way through
// works (both: either way). SKY_W: the deck's width
function portalArrowGeo(both, R){
  // drawn in the shape's plane, pointing toward -y, which the pad's -90° tilt turns into +z: into the ramp
  const B = R*1.1, L = R*0.75, g = R*0.12, tri = (y0, dir) => { const s = new THREE.Shape(); s.moveTo(-B/2, y0); s.lineTo(B/2, y0); s.lineTo(0, y0 + dir*L); s.lineTo(-B/2, y0); return s; };
  return new THREE.ShapeGeometry(both ? [tri(-g, -1), tri(g, 1)] : [tri(L/2, -1)]);
}
function buildSkyPortal(SKY_W = 5, both = false){
  const g = new THREE.Group();
  const post = new THREE.MeshLambertMaterial({ color: 0xe3e8ec }), lite = new THREE.MeshBasicMaterial({ color: 0xc9b8ee }), lit = [];
  for (const sx of [-1, 1]){ const p = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.32, 6.5, 8), post); p.position.set(sx*(SKY_W/2 + 0.6), 3.25, 0); g.add(p);
    const c = new THREE.Mesh(new THREE.SphereGeometry(0.35, 10, 8), lite); c.position.set(sx*(SKY_W/2 + 0.6), 6.7, 0); g.add(c); lit.push(c); }
  const arch = new THREE.Mesh(new THREE.TorusGeometry(SKY_W/2 + 0.6, 0.12, 6, 24, Math.PI), lite); arch.position.set(0, 6.5, 0); g.add(arch); lit.push(arch);
  const gem = new THREE.Mesh(new THREE.OctahedronGeometry(1, 0), lite); gem.scale.set(0.3, 0.5, 0.12); gem.position.set(0, 6.5 + SKY_W/2 + 0.6 + 0.55, 0); g.add(gem); lit.push(gem);   // a small diamond at the crown of the arch
  const pad = new THREE.Mesh(portalArrowGeo(both, SKY_W/2 + 1), new THREE.MeshBasicMaterial({ color: 0xa993d6, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide }));
  pad.rotation.x = -Math.PI/2; pad.position.y = 0.06; g.add(pad);
  return { g, lite, pad, lit };
}

// ---- the mine's portal: two timber posts and a heavy lintel, braced, with a lantern on each post, and the gate: two
// barred halves that sink into the floor once there's power
function buildMinePortal(){
  const wood = new THREE.MeshLambertMaterial({ color: 0x6b4b33 }), dark = new THREE.MeshLambertMaterial({ color: 0x4a3424 });
  const g = new THREE.Group();
  const add = (geo, mat, x, y, z, rx = 0, rz = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.set(rx, 0, rz); g.add(m); return m; };
  for (const sd of [-1, 1]){
    add(new THREE.BoxGeometry(0.7, 7.2, 0.7), wood, 0, 2.8, sd*4.6);
    add(new THREE.BoxGeometry(0.35, 2.6, 0.35), dark, 0.1, 4.6, sd*3.65, sd*0.62, 0);
    add(new THREE.BoxGeometry(0.3, 0.45, 0.3), lampMat, 0.45, 3.2, sd*4.15);
  }
  add(new THREE.BoxGeometry(0.9, 0.8, 11.2), wood, 0, 6.1, 0);
  add(new THREE.BoxGeometry(0.95, 0.12, 11.4), dark, 0, 6.55, 0);
  // the gate: two barred halves just inside the posts, sinking into the floor once there's power
  const steel = new THREE.MeshLambertMaterial({ color: 0x59626e }), bar = new THREE.CylinderGeometry(0.07, 0.07, 5.6, 6);
  const gates = [-1, 1].map(sd => { const h = new THREE.Group(); h.position.x = -0.6; g.add(h);
    for (let k = 0; k < 7; k++){ const m = new THREE.Mesh(bar, steel); m.position.set(0, 2.8, sd*(0.25 + k*0.65)); h.add(m); }
    for (const y of [0.6, 2.8, 5.0]){ const m = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.22, 4.4), steel); m.position.set(0, y, sd*2.2); h.add(m); }
    return h; });
  return { g, gates };
}

// ---- the skier: a simple jointed figure built from boxes and cylinders, posed every frame from the game's state. the
// pose is for looks only and never feeds back into movement. buildSkier() makes one; its pose(G) poses it (see there).
// the game and the planetoid both use it
const SK_UP = new THREE.Vector3(0, 1, 0), _ska = new THREE.Vector3(), _skb = new THREE.Vector3(), _skd = new THREE.Vector3();
function setLimb(m, a, b){
  // stretch a unit cylinder between two points in the rig's frame
  _ska.set(...a); _skb.set(...b); _skd.subVectors(_skb, _ska); const L = _skd.length() || 1e-3;
  m.position.addVectors(_ska, _skb).multiplyScalar(0.5); m.quaternion.setFromUnitVectors(SK_UP, _skd.divideScalar(L)); m.scale.set(1, L, 1);
}
function buildSkier(){
  const rig = new THREE.Group();                                  // the body, turned to the torso's heading
  const jacket = new THREE.MeshLambertMaterial({ color: 0xd2462e });   // jacket and hat, the theme's skier colour
  const pants = new THREE.MeshLambertMaterial({ color: 0x2f3b48 });
  const skin = new THREE.MeshLambertMaterial({ color: 0xd9b8a0 });
  const ski = new THREE.MeshLambertMaterial({ color: 0x2c3a49, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -6 });   // always in front of the marks
  const pole = new THREE.MeshLambertMaterial({ color: 0x8a939c });
  const limb = (r, mat) => { const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 1, 8), mat); rig.add(m); return m; };
  const body = {
    torso: limb(0.13, jacket), head: new THREE.Mesh(new THREE.SphereGeometry(0.11, 14, 10), skin),
    hat: new THREE.Mesh(new THREE.SphereGeometry(0.115, 14, 8, 0, Math.PI*2, 0, Math.PI/2), jacket),
    thigh: { L: limb(0.065, pants), R: limb(0.065, pants) }, shin: { L: limb(0.05, pants), R: limb(0.05, pants) },
    upper: { L: limb(0.045, jacket), R: limb(0.045, jacket) }, fore: { L: limb(0.04, jacket), R: limb(0.04, jacket) },
    pole: { L: limb(0.012, pole), R: limb(0.012, pole) },
    ski: { L: new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.025, 1.75), ski), R: new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.025, 1.75), ski) },
  };
  rig.add(body.head, body.hat, body.ski.L, body.ski.R);
  // the reward outfit: the court's crown, a gold belt and the court's diamond on your back (purple jacket: setOutfit)
  const regalia = (() => {
    const gold = new THREE.MeshLambertMaterial({ color: 0xe6bf4f }); gold.flatShading = true;
    const crown = buildCrown(); crown.scale.setScalar(0.42); crown.position.y = 0.035; body.hat.add(crown);   // the court's crown, sized to your hat
    const belt = new THREE.Mesh(new THREE.CylinderGeometry(0.1335, 0.1335, 1, 16, 1, true), gold); belt.scale.y = 0.085; belt.position.y = -0.36; body.torso.add(belt);
    const emblem = new THREE.Mesh(new THREE.OctahedronGeometry(1, 0), gold); emblem.position.set(0, 0.08, 0.128); emblem.scale.set(0.06, 0.16, 0.012); body.torso.add(emblem);   // the court's diamond, on your back
    return { crown, belt, emblem };
  })();
  for (const k of ['L','R']) body.ski[k].geometry.translate(0, 0, -0.15);   // binding a little behind the ski's middle
  const sk = { rig, body, regalia, mats: { jacket, pants, skin, ski, pole }, state: { bodyVis: null, poleT: 0, loadW: 0 } };
  sk.setOutfit = (on, colour = 0xd2462e) => { regalia.crown.visible = regalia.belt.visible = regalia.emblem.visible = on; jacket.color.setHex(on ? 0x7b3fe0 : colour); };
  sk.pose = G => poseSkier(sk, G);
  return sk;
}
// pose the figure. frame: x to the skier's right, y up, -z forward along the torso heading. it doesn't place the rig:
// it returns the heading the body faces (th), and the caller puts the rig at the skier, turned to -th about its up.
// G, the game's state:
//   x, y        where the skier is (the 2D model: x east, y south), h0 the snow's height there
//   ground(x,y) the snow's height anywhere near, in the same frame
//   face        the heading the body turns toward (it eases after it)
//   now         the time (ms); dt the frame (s, 1/60 by default)
//   mode        null (skating), 'tuck', 'plow' or 'classic'; tuckDeep 0..1
//   ld          the loading pose: { depth 0..1, leg 'L'/'R' or null, both } (a stick pulled into its load)
//   tk          seconds since the last push (legs); tka seconds since the arms' last push, or null while undecided
//   rock        how far the hips sit over the gliding ski (m, + right)
//   lastSki     { L, R }: each ski's current mark { live, ax, ay, dx, dy, len } or null; lastLeg the leg that last pushed
//   legFlash    { L, R }: 1 at a kick, fading
//   v1, v1side  V1 (offset) arms, and the hang side (true: right); classicFwd(k) each foot's fore/aft in classic
// st.poleT is set to 1 at a double pole (it drives the arm swing as it counts down)
function poseSkier(sk, G){
  const { body } = sk, st = sk.state, now = G.now, mode = G.mode, ld = G.ld, lastSki = G.lastSki, legFlash = G.legFlash, lastLeg = G.lastLeg, ground = G.ground, h0 = G.h0;
  const fdt = G.dt || 1/60;
  const faceTh = G.face;
  if (st.bodyVis === null) st.bodyVis = faceTh;
  let dv = faceTh - st.bodyVis; dv -= Math.round(dv/(2*Math.PI))*2*Math.PI;
  st.bodyVis += dv * Math.min(1, fdt * 8);
  const th = st.bodyVis;
  st.poleT = Math.max(0, st.poleT - fdt * 2);
  const poleT = st.poleT;
  // skating follows the V2 cycle (a double pole with every skate):
  //   load   - before the push: tall, hips high, legs nearly straight, arms up and forward, recovering foot drawn in
  //            beside the gliding foot, weight fully over the gliding ski
  //   push   - poles plant and drive back while the leg extends; the body compresses and the hips move across
  //   recover- rising again as the arms swing forward and up past the hips
  //   glide  - riding the new ski, mid height, arms relaxed forward
  const tk = G.tk;
  let v2 = 'glide', vp = 0;
  if (!mode){
    // timing from reference footage (10 fps, about 1.2 s per skate): high/load ~25%, pole push ~45%, recovery ~30%
    if (tk < 0.5){ v2 = 'push'; vp = tk / 0.5; }
    else if (tk < 0.85){ v2 = 'recover'; vp = (tk - 0.5) / 0.35; }
  }
  // the arms run the same cycle from their own start, and hold the glide pose while a touch kick is still undecided
  const tka = G.tka;
  let v2a = 'glide', vpa = 0;
  if (!mode && tka !== null){
    if (tka < 0.5){ v2a = 'push'; vpa = tka / 0.5; }
    else if (tka < 0.85){ v2a = 'recover'; vpa = (tka - 0.5) / 0.35; }
  }
  const ease = x => x*x*(3 - 2*x);
  let crouch, leanDeg;
  if (mode === 'tuck'){ crouch = 0.42 + 0.06*G.tuckDeep; leanDeg = 62 + 8*G.tuckDeep; }
  else if (mode === 'plow'){ crouch = 0.14; leanDeg = 8; }
  else if (mode === 'classic'){ crouch = 0.1; leanDeg = 18; }
  else if (ld.both){ crouch = 0.04 + 0.04*ld.depth; leanDeg = 10 + 6*ld.depth; }          // double-pole load: tall
  else if (v2 === 'push'){ crouch = 0.02 + 0.3*ease(vp); leanDeg = 8 + 42*ease(vp); }    // folding at the hips to about 50°
  else if (v2 === 'recover'){ crouch = 0.32 - 0.24*ease(vp); leanDeg = 50 - 34*ease(vp); }
  else { crouch = 0.08; leanDeg = 16; }
  // loading blends in over the cycle instead of replacing it: it eases toward the stick's depth over about a tenth
  // of a second, and can't take over a pole push until that push is mostly done, so there's no snap between poses
  const cap = v2 === 'push' ? ease(vp) : 1;
  const want = (!mode && ld.leg) ? ld.depth : 0;
  st.loadW += (Math.min(want, cap) - st.loadW) * Math.min(1, fdt * 9);
  const loadW = st.loadW;
  if (!mode){ crouch += (0.01 - crouch) * loadW; leanDeg += (8 - leanDeg) * loadW; }   // tall, legs nearly straight
  const lean = leanDeg * Math.PI/180;
  // full weight transfer: nose, knee and toe over the gliding ski
  const hip = [G.rock * 2.2, 0.95 - crouch*0.55, 0.05 + crouch*0.15];
  const side = { L: -1, R: 1 };
  const classicFwd = G.classicFwd || (() => 0);
  const feet = {};
  for (const k of ['L','R']){
    const sd = side[k], sk = lastSki[k], down = mode || (sk && sk.live);
    // where the foot is: under its hip, wider in a plow, pushed out to the side on a kick, fore/aft in classic
    let fx = sd * (mode === 'plow' ? 0.32 : 0.14), fy = 0.05, fz = classicFwd(k);
    if (sk && sk.live && sk.len > 0.05){
      // a planted ski sits on the end of its own track: the track grows to the ski, so the binding goes at the
      // track's leading point (converted into the skier's frame), kept within a leg's reach of the hips
      const hx = sk.ax + sk.dx*sk.len - G.x, hy = sk.ay + sk.dy*sk.len - G.y;
      const lx = hx*Math.cos(th) + hy*Math.sin(th), lz = -(hx*Math.sin(th) - hy*Math.cos(th));
      fx = Math.max(-0.7, Math.min(0.7, lx)); fz += Math.max(-0.6, Math.min(0.6, lz));
      fx = sd > 0 ? Math.max(fx, 0.05) : Math.min(fx, -0.05);   // a foot never crosses to the other side of the body
    }
    // the pushing leg extends out and back through the pole push, then is drawn in during recovery
    const ext = (!mode && k === lastLeg) ? (v2 === 'push' ? ease(vp) : v2 === 'recover' ? 1 - ease(vp) : 0) : 0;
    fx += sd * 0.42 * ext; fz += 0.3 * ext;
    if (!down){ fy = 0.05 + (v2 === 'push' ? 0.08 * Math.max(0, vp - 0.6) / 0.4 : 0.11); fz += 0.12; }   // lifted ski, carried a little behind
    if (!mode && !down && ld.leg && loadW > 0){                              // load: recovering foot comes in beside the gliding one
      const gk = ld.leg, g = lastSki[gk];
      const gx = (g && g.live) ? Math.max(-0.7, Math.min(0.7, (g.ax + g.dx*g.len - G.x)*Math.cos(th) + (g.ay + g.dy*g.len - G.y)*Math.sin(th))) : side[gk]*0.14;
      const w = ease(loadW);
      fx = fx + (gx + sd*0.16 - fx) * w; fy = fy + (0.05 - fy) * w; fz = fz * (1 - w);
    }
    // the snow under this foot can sit higher or lower than under the body on a slope: lift or drop the foot to it
    const cT = Math.cos(th), sT = Math.sin(th), wx = G.x + fx*cT - fz*sT, wy = G.y + fx*sT + fz*cT;
    const gB = ground(wx, wy);
    fy += gB - h0;
    feet[k] = [fx, fy, fz];
    // ski: planted skis point exactly along their tracks; a plow turns the tips in; lifted skis follow the body
    let yaw = 0;
    if (mode === 'plow') yaw = sd * 0.38;   // tips together, tails apart
    else if (sk && sk.live){ let r = Math.atan2(sk.dx, -sk.dy) - th; r -= Math.round(r/(2*Math.PI))*2*Math.PI; yaw = -r; }
    else if (ext > 0) yaw = sd * 0.35 * ext;                              // pushing ski angled out as it leaves
    const ski = body.ski[k];
    // a ski on the snow lies along the slope under it: pitched to the ground at tip and tail, rolled to the ground
    // either side, its base a little above its own track so the mark never shows through it
    let pitch = -0.12, roll = 0;
    if (down){
      const ph = yaw - th, fwx = -Math.sin(ph), fwy = -Math.cos(ph), rx = Math.cos(ph), ry = -Math.sin(ph);
      const tip = ground(wx + fwx*1.0, wy + fwy*1.0), tail = ground(wx - fwx*0.72, wy - fwy*0.72);
      pitch = Math.atan2(tip - tail, 1.72);
      roll = Math.atan2(ground(wx + rx*0.2, wy + ry*0.2) - ground(wx - rx*0.2, wy - ry*0.2), 0.4);
      fy = gB - h0 + 0.05;
    }
    ski.rotation.order = 'YXZ';
    ski.position.set(fx, fy - (down ? 0 : 0.005), fz);
    ski.rotation.set(pitch, yaw, roll);
    // leg: hip to knee to foot, the knee pushed forward more the deeper the crouch
    const hp = [hip[0] + sd*0.1, hip[1], hip[2]];
    const kb = 0.06 + crouch*0.45;
    const knee = [(hp[0] + fx)/2, (hp[1] + fy)/2 + 0.02, (hp[2] + fz)/2 - kb];
    setLimb(body.thigh[k], hp, knee); setLimb(body.shin[k], knee, [fx, fy + 0.06, fz]);
  }
  // torso and head, leaning forward from the hips and a little toward the gliding ski
  const tl = 0.55, side_lean = G.rock * 0.8;
  const sh = [hip[0] + side_lean, hip[1] + Math.cos(lean)*tl, hip[2] - Math.sin(lean)*tl];
  setLimb(body.torso, hip, sh);
  const hd = [sh[0], sh[1] + Math.cos(lean*0.7)*0.18, sh[2] - Math.sin(lean*0.7)*0.18];
  body.head.position.set(...hd); body.hat.position.set(hd[0], hd[1] + 0.01, hd[2]);
  // arms and poles
  for (const k of ['L','R']){
    const v2 = v2a, vp = vpa;
    const sd = side[k];
    const s0 = [sh[0] + sd*0.2, sh[1] - 0.04, sh[2]];
    let hand, tip;
    if (ld.both && poleT <= 0){
      hand = [s0[0], s0[1] + 0.05*ld.depth, s0[2] - 0.5*ld.depth - 0.1];   // double-pole load: poles reaching forward
      tip = [hand[0] + sd*0.05, 0.02, hand[2] - 0.15];
    } else if (mode === 'tuck' && poleT <= 0){
      hand = [s0[0] - sd*0.08, hip[1] + 0.05, hip[2] - 0.45];        // hands in front of the knees, poles tucked under the arms
      tip = [hand[0] + sd*0.05, hand[1] + 0.15, hand[2] + 1.15];
    } else if (poleT > 0){
      const p = 1 - poleT;                                            // double pole: reach forward, then drive down and back
      hand = [s0[0], s0[1] - 0.15 - 0.45*p, s0[2] - 0.45 + 0.85*p];
      tip = [hand[0] + sd*0.05, 0.02, hand[2] + 0.2 + 0.6*p];
    } else if (!mode && G.v1){
      // V1 (offset), for trigger and key kicks in either scheme: one staggered double pole every second skate, made as you step onto the hang-side
      // ski, with the two poles and that ski landing together. the hang-side hand is high, just ahead of the head,
      // its pole near vertical; the other hand is lower with its pole angled back. follow-through stops just past the
      // hips. on the off-side skate the arms just come back up to the ready position.
      const hang = G.v1side ? 'R' : 'L', mine = k === hang;
      const onto = lastLeg === 'L' ? 'R' : 'L';               // the ski just stepped onto
      const poling = onto === hang;
      const READY = mine
        ? { h: [s0[0] - sd*0.02, s0[1] + 0.28, s0[2] - 0.32], t: [s0[0] + sd*0.06, 0.03, s0[2] - 0.12] }   // high, pole near vertical by the foot
        : { h: [s0[0] - sd*0.06, s0[1] + 0.06, s0[2] - 0.42], t: [s0[0] + sd*0.22, 0.03, s0[2] + 0.3] };   // lower, pole angled back
      const BACK = { h: [s0[0] + sd*0.05, hip[1] + 0.05, hip[2] + 0.22], t: [s0[0] + sd*0.12, hip[1] + 0.25, hip[2] + 1.05] };  // short follow-through
      const mix = (a, b, f) => a.map((v, i) => v + (b[i] - v) * f);
      let A = READY, B = READY, f = 0;
      if (poling){
        if (v2 === 'push'){ A = READY; B = BACK; f = ease(vp); }
        else if (v2 === 'recover'){ A = BACK; B = READY; f = ease(vp); }
      }
      hand = mix(A.h, B.h, f); tip = mix(A.t, B.t, f);
      if (poling && v2 === 'push' && vp < 0.5) tip[1] = 0.02;              // planted with the ski
      if (!poling || v2 === 'glide'){ tip[1] = 0.25; }                       // carried just off the snow, ready
    } else if (!mode){
      // V2 arms: both together. key poses, blended by phase
      // from the footage: hands come right up to chin height with elbows bent before the plant, and at the end of the
      // push the arm is straight back with the pole close to horizontal
      const HIGH = { h: [s0[0] + sd*0.02, s0[1] + 0.2, s0[2] - 0.3], t: [s0[0] + sd*0.14, 0.03, s0[2] + 0.05] };     // hands at the chin, tips by the feet
      const BACK = { h: [s0[0] + sd*0.05, hip[1] + 0.12, hip[2] + 0.55], t: [s0[0] + sd*0.1, hip[1] + 0.3, hip[2] + 1.75] }; // arm straight back, pole level
      const MID  = { h: [s0[0] + sd*0.06, s0[1] - 0.22, s0[2] - 0.32], t: [s0[0] + sd*0.14, 0.3, s0[2] + 0.35] };   // relaxed, tips off the snow
      const mix = (a, b, f) => a.map((v, i) => v + (b[i] - v) * f);
      let A, B, f;
      if (v2 === 'push'){ A = HIGH; B = BACK; f = ease(vp); }
      else if (v2 === 'recover'){ A = BACK; B = MID; f = ease(vp); }
      else { A = MID; B = MID; f = 0; }
      hand = mix(A.h, B.h, f); tip = mix(A.t, B.t, f);
      if (v2 === 'push' && vp < 0.55) tip[1] = 0.02;                        // poles stay planted for about half the push
      if (loadW > 0){ const w = ease(loadW); hand = mix(hand, HIGH.h, w); tip = mix(tip, HIGH.t, w); }   // arms rising for the plant
    } else {
      // classic: the arm opposite the forward leg swings forward
      const other = k === 'L' ? 'R' : 'L';
      const swing = mode === 'classic' ? -classicFwd(other) * 0.9 : (legFlash[other] - legFlash[k]) * 0.35;
      hand = [s0[0] + sd*0.05, s0[1] - 0.5, s0[2] - 0.15 - swing];
      tip = [hand[0] + sd*0.12, 0.02, hand[2] + 0.55];
    }
    const elbow = [(s0[0] + hand[0])/2 + sd*0.06, (s0[1] + hand[1])/2, (s0[2] + hand[2])/2 + 0.06];
    setLimb(body.upper[k], s0, elbow); setLimb(body.fore[k], elbow, hand); setLimb(body.pole[k], hand, tip);
  }
  return th;
}

Object.assign(M, { lam, SM, bx, cy, orbGlowTex, dome, pt, lines, geoDome, arch, BUILD, V, tube, beam, flag, mergeModel,
  buildOrb, orbCoreGeo, orbCoreMat, KIOSK_LOOK, buildKiosk, buildGate, buildControlPost, treeMats, TREE_PARTS, buildTree, BOULDER, buildBoulder,
  MOOSE_MAT, MG, mpart, buildMoose, NPC_MAT, NG, npart, buildHuman, buildAlien,
  CRYSTAL_MAT, GOLD, GOLD_2S, ROYAL, ROYAL_MAT, DRAPES, DG, dressMoose, buildCrown, buildAltar, buildCrystal, buildCrystalGate,
  OUTCROP_MATS, buildOutcrop, PLATEAU_MATS, buildPlateauCrystal, poseGiant, buildObservatory, MUSICIAN_MATS: { robes, sash, brass, hide, wood }, MUSIC_KINDS, dressMusician,
  ATTEND_MATS: { white, white2 }, dressAttendant, buildCourtDiamond,
  lampMat, MINE_MATS, MINE_KIT, buildMineProp, STATION_MATS, buildStationHub, buildShip, buildCargoBin, portalArrowGeo, buildSkyPortal, buildMinePortal,
  setLimb, buildSkier, poseSkier });

// ---- the catalogue: every model, for the gallery (gallery.html). build(v, rnd) makes variant v (an index into
// variants) with a seeded random stream rnd for the ones that vary; random: re-rolling gives a different one
const seeded = seed => () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const rootOf = r => r.isObject3D ? r : r.root || r.g;
const dressed = (rig, f) => { f(rig); return rig.root; };
const KIOSK_STATE = ['dormant', 'active', 'powered'], ANT = [0xd9534a, 0xf2c14e, 0x5cc87a];
const C = [];
const add = (group, id, name, where, about, build, extra = {}) => C.push(Object.assign({ group, id, name, where, about, build }, extra));
// the outpost kit
const OUT = [
  ['dome', 'Research dome', 'Zones 1 and 2: a key building', 'A 30 m glass geodesic dome on a hull ring, quarters and a garden inside, three entrance tunnels with orange doors and a mast on the crown.'],
  ['tower', 'Command tower', 'Zones 1 and 2: a key building', 'A low block with a 36 m tower: control ring, antenna mast and a lamp at the top.'],
  ['pad', 'Landing pad', 'Zones 1 and 2', 'A hexagonal pad with an orange landing ring and lights, a shuttle parked off-centre.'],
  ['plant', 'Processing plant', 'Zones 1 and 2', 'A long hall with three stacks, two domed silos, pipes, a tank and a conveyor down to the yard.'],
  ['excavator', 'Bucket-wheel excavator', 'Zones 1 and 2', 'Tracks, cab and mast, a 17 m boom with a cutting wheel, and the bench of ice and rock it is cutting into.', { random: true }],
  ['haul', 'Haul truck', 'Zones 1 and 2; three more (1.6 times the size) in the mine basement', 'Six wheels, a cab and a tipping bed.'],
  ['greenhouse', 'Greenhouses', 'Zones 1 and 2', 'Three barrel-vaulted glass halls with planting beds and a service block.'],
  ['biolab', 'Biolab', 'Zones 1 and 2', 'Three geodesic domes joined by glass walkways, a lab block and a mast.'],
  ['comms', 'Comms dish', 'Zones 1 and 2', 'A pedestal and a 10 m dish tilted to the sky, its feed on struts.'],
  ['weather', 'Weather mast', 'Zones 1 and 2', 'A 10 m braced lattice mast with instruments, a cup anemometer and a beacon.'],
  ['fuel', 'Fuel depot', 'Zones 1 and 2', 'Three domed tanks on a slab with orange bands and pipework.'],
  ['solar', 'Solar array', 'Zones 1 and 2', 'Six tilted panels on posts and an inverter box.'],
  ['beacon', 'Beacon', 'Zones 1 and 2', 'A tapering tower with a lit lantern under an orange cap, in a scatter of ice boulders.', { random: true }],
];
for (const [id, name, where, about, x] of OUT) add('Outpost buildings', id, name, where, about, (v, rnd) => mergeModel(BUILD[id](rnd)), x || {});
const RUIN = [
  ['ribs', 'The sleeping ribs', 'Zone 3: the ruins', 'The bones of a full-grown purple moose eleven times life size, lying where it fell asleep: spine and hump, rib cage, folded legs, the skull with its palmate antlers, the tentacle beard a scatter of bead bones.'],
  ['arch', 'Spine arch', 'Zone 3: the ruins, over the trail', 'One vertebral span over the trail, knobbed and spined, a fallen piece beside it.'],
  ['watcher', 'The watcher', 'Zone 3: the ruins', 'A 40 m ribbed spire with slits up its sides and a pale light near the top.', { random: true }],
  ['circle', 'The Broken Circle', 'Zone 3 (the altar stands at its heart); its twin is in the mine', 'A ring of curved standing pieces round a low glowing dais, gaps where some have fallen.', { random: true }],
  ['shard', 'Bone shard', 'Zone 3: the ruins', 'Bone spikes pushing out of the snow, and half a rib.', { random: true }],
];
for (const [id, name, where, about, x] of RUIN) add('Zone 3 ruins', id, name, where, about, (v, rnd) => mergeModel(BUILD[id](rnd)), x || {});
const CAMP = [
  ['camp', 'Ridge camp', 'Zone 3; five more round Plateau 1 in the mine', 'Two tents and a tarp lean-to, crates, a fire, flags and a lookout platform.'],
  ['harvester', 'Ice harvester', 'Zone 3, on the lake shore', 'A timber tripod with a block of lake ice hanging from it, a sled of cut blocks.'],
  ['signal', 'Signal tower', 'Zone 3', 'A rickety 15 m lattice mast with antennas and pennants, a scrap hut at its foot.'],
  ['shacks', 'Stilt shacks', 'Zone 3', 'Four stilt shacks with tarp roofs and lit windows, joined by plank walkways.'],
];
for (const [id, name, where, about] of CAMP) add('Zone 3 camps', id, name, where, about, (v, rnd) => mergeModel(BUILD[id](rnd)), { random: true });
// outpost tech
add('Outpost tech', 'kiosk', 'Terminal', 'Beside the trails: 2 in zone 1, 3 in zone 2, 3 in zone 3', 'A slate foot, a white column, an angled screen facing the trail, a row of progress lights (one per orb: 10, or 15 in zone 3), and an antenna light: red dormant, yellow running, green powered.',
  v => { const k = buildKiosk(v === 3 ? 15 : 10), st = KIOSK_STATE[Math.min(v, 2)], c = KIOSK_LOOK[st];
    k.screen.color.setHex(c); k.lights.forEach((m, i) => m.color.setHex(st === 'powered' ? KIOSK_LOOK.powered : st === 'active' && i < 4 ? KIOSK_LOOK.active : KIOSK_LOOK.dormant));
    k.beaconMat.color.setHex(ANT[Math.min(v, 2)]); k.halo.material.color.setHex(ANT[Math.min(v, 2)]); return k.g; },
  { variants: ['Dormant', 'Running', 'Powered', 'Zone 3 (15 lights)'] });
add('Outpost tech', 'orb', 'Orb', 'On a terminal\'s loop while it runs (20 in zone 1, 30 in zone 2, 45 in zone 3)', 'A glow round a small bright core, 1.1 m over the snow.', () => { const o = buildOrb(); o.g.position.y = 1.1; const g = new THREE.Group(); g.add(o.g); return g; });
add('Outpost tech', 'gate', 'Zone gate', 'The east gate (zone 1 to 2) and the south gate (zone 2 to 3)', 'Tall white pylons with light strips, a stepped barrier out to the slopes, a steel lintel with a status light, and two armoured doors that swing out once the zone\'s terminals are powered.',
  v => { const r = buildGate({ hw: 4, reach: 12 }); if (v) for (const d of r.doors) d.hinge.rotation.y = -d.side*1.75; if (v){ r.status.color.setHex(0x5cc87a); r.halo.material.color.setHex(0x5cc87a); } return r.g; }, { variants: ['Shut', 'Open'] });
add('Outpost tech', 'post', 'Control post', 'One on each bank of both drawbridges', 'A white post with one light per terminal in the zone and an antenna light: red until every terminal is powered and you ski up to it.',
  v => { const r = buildControlPost(3, v ? 0x5cc87a : 0xd9534a); return r.g; }, { variants: ['Locked', 'Opened'] });
// the wild
add('The wild', 'tree', 'Spruce', 'Everywhere off the trails, in woods and clearings (thousands, drawn as instances)', 'A trunk and two cone tiers, 5.7 m tall at full size (the game scales each one).', () => buildTree());
add('The wild', 'boulder', 'Ice boulder', 'Scattered through the open snow and among the trees', 'Four shapes in three ice tints; each boulder in the world is a cluster of a few.',
  v => { const g = new THREE.Group(); for (let t = 0; t < 3; t++){ const b = buildBoulder(v, t, 1.6); b.position.x = (t - 1)*4.2; g.add(b); } return g; }, { variants: ['Rounded', 'Rough', 'Shard', 'Slab'] });
add('The wild', 'outcrop', 'Crystal outcrop', 'Zone 4, over the snowfields', 'A cluster of long faceted purple crystals and a few stones (just rock, no glow), merged into one mesh.', (v, rnd) => buildOutcrop(2.2, 1 + ((rnd()*1e6) | 0)), { random: true });
add('The wild', 'plateau', 'Plateau crystals', 'Zone 5, across the plateau and along the cliff (about 110)', 'Three to seven long crystals round a big one; now and then the big one glows.', (v, rnd) => buildPlateauCrystal(1.8, rnd), { random: true });
// creatures and people
{ // your skier, posed by the game's own code from a made-up moment of the game
  const planted = x => ({ live: true, ax: x, ay: 0.6, dx: 0, dy: -1, len: 0.6 });
  const POSES = [['Gliding', {}], ['Pushing off', { tk: 0.25, lastLeg: 'R', R: null }], ['V1 (ready)', { v1: true }], ['Tuck', { mode: 'tuck', tuckDeep: 0.5 }], ['Snow plow', { mode: 'plow' }], ['Reward outfit', { outfit: true }]];
  add('Creatures and people', 'skier', 'Your skier', 'Everywhere: you', 'A jointed figure in the theme\'s red (purple in the reward outfit, with the court\'s crown, a gold belt and the diamond on the back), posed every frame from the skating: kicks, the V1 and V2 arms, tuck and plow.',
    v => { const o = POSES[v][1], sk = buildSkier(), tk = o.tk === undefined ? 2 : o.tk; sk.setOutfit(!!o.outfit);
      sk.pose({ x: 0, y: 0, h0: 0, ground: () => 0, face: 0, now: 0, mode: o.mode || null, tuckDeep: o.tuckDeep || 0, ld: { depth: 0, leg: null, both: false },
        tk, tka: tk, rock: 0, lastSki: { L: planted(-0.14), R: 'R' in o ? o.R : planted(0.14) }, lastLeg: o.lastLeg || 'L', legFlash: { L: 0, R: 0 }, v1: !!o.v1, v1side: false });
      return sk.rig; }, { variants: POSES.map(p => p[0]) });
}
add('Creatures and people', 'moose', 'Tentacle moose', 'One roams zone 2, ten roam zone 3, and the herds of zone 4', 'Six-legged and purple, palmate antlers, a beard of tentacles on the muzzle and chest. Walks a tripod gait, three legs at a time.', () => buildMoose(false).root);
add('Creatures and people', 'calf', 'Moose calf', 'Zone 4\'s herds; the one that follows you', 'A grown moose without antlers, shown here at the herd\'s calf size (0.75).', () => { const r = buildMoose(true).root; r.scale.setScalar(0.75); return r; });
add('Creatures and people', 'giant', 'The sleeping giant', 'Zone 4', 'A grown moose eleven times over, legs folded under, head down, breathing slow clouds of vapour (shown here at 1/11 size).', () => poseGiant(buildMoose(false)).root);
add('Creatures and people', 'elder', 'Crowned elder', 'Zone 5: the trio before the Starway, and every calf you crown', 'A moose in a ceremonial drape with a gold hem, gold diamonds on its flanks, tassels, and a gold crown with a crystal at the brow. The trio\'s leader wears royal purple.',
  v => dressed(buildMoose(v === 2), r => { const d = dressMoose(r, v === 2 ? 1 : 0, v === 1 ? ROYAL_MAT : null); if (v === 1) d.crown.scale.setScalar(1.25); }), { variants: ['Elder', 'Royal (the leader)', 'Crowned calf'] });
add('Creatures and people', 'human', 'Outpost crew', 'Zones 1 to 3, by the buildings and camps; the space station\'s crews', 'About 1.8 m: a parka in one of seven colours, beanie, boots, some with a backpack.', (v, rnd) => buildHuman(rnd).root, { random: true });
add('Creatures and people', 'alien', 'Native', 'Zone 3\'s ruins; Plateau 1 in the mine', 'About 1.3 m: a long brown robe with a trailing hem, a blue head with long swept-back ears.', (v, rnd) => buildAlien(rnd).root, { random: true });
add('Creatures and people', 'musician', 'Musician', 'Zone 5, round the observatory and at the cliff\'s edge', 'A native in a bright robe, playing a drum, a long horn, a harp or crystal chimes.', (v, rnd) => dressed(buildAlien(rnd), r => dressMusician(r, MUSIC_KINDS[v], (rnd()*6) | 0)), { variants: ['Drum', 'Horn', 'Harp', 'Chimes'], random: true });
add('Creatures and people', 'attendant', 'Court attendant', 'Zone 5, by the crowned court', 'A native robed in white and gold with a slim gold staff tipped with a crystal.', (v, rnd) => dressed(buildAlien(rnd), r => dressAttendant(r, 1)), { random: true });
// the crystal hunt
add('The crystal hunt', 'crystal', 'Purple crystal', 'Twenty beside landmarks in zones 1 to 3, once the altar wakes', 'A cluster of long faceted crystals under a 10 m column of light.', () => buildCrystal().g);
add('The crystal hunt', 'altar', 'Altar', 'The Broken Circle (zone 3); its twin in the mine; the ceremony\'s in the crowned court', 'A bone plinth with four horns round a crystal heart: dull while asleep, lit once woken; a column of light when done. The ceremony\'s has gold studs.',
  v => { const r = v === 0 ? buildAltar() : v === 1 ? buildAltar(false, { lit: true, beam: false }) : buildAltar(true); if (v === 2) r.g.scale.setScalar(1.25); return r.g; }, { variants: ['Asleep', 'The cave\'s (lit)', 'The ceremony\'s'] });
add('The crystal hunt', 'crystalgate', 'The crystal gate', 'The southern divide, into zone 4', 'Two pale ribbed pylons grown like the ruins, a lintel at 21 m with a crystal on top, and two great doors seamed with purple light that swing inward once every crystal is in.',
  v => { const r = buildCrystalGate(9, 21); if (v) for (const d of r.doors) d.hinge.rotation.y = d.sx*1.6; return r.g; }, { variants: ['Shut', 'Open'] });
// zone 5
add('Zone 5', 'observatory', 'The observatory', 'Zone 5, at the cliff\'s edge', 'A stepped bone platform, a ring of ten columns capped with glowing crystals, a domed hall open north and south (the Starway runs through), and a gateway on the plateau side.', () => buildObservatory().g);
add('Zone 5', 'diamond', 'Court diamond', 'The crowned court\'s ring (six)', 'A dark inlay round a pale stone that lights when a calf stands on it.', v => { const r = buildCourtDiamond(); if (v) r.mat.color.setHex(0xe6bf4f); r.grp.position.y = 0.05; return r.grp; }, { variants: ['Dark', 'Lit'] });
add('Zone 5', 'crown', 'Crown', 'The elders and crowned calves; yours with the reward outfit', 'A gold band, six spikes tipped with gold beads, a crystal diamond at the brow (shown here at four times size).', () => { const c = buildCrown(); c.scale.setScalar(4); return c; });
// the mine
const MINE_NAMES = { drill: 'Drill rig', cart: 'Ore cart', crates: 'Crate stack', barrels: 'Barrels', hut: 'Prefab hut', compressor: 'Compressor', conveyor: 'Conveyor', lamp: 'Lamp post', reel: 'Cable reel', bin: 'Ore bin', barrier: 'Striped barrier' };
for (const k of Object.keys(MINE_KIT)) add('The mine', 'mine-' + k, MINE_NAMES[k] || k, 'Left about the mine\'s rooms, thickest round the transport rooms', 'The miners\' things (the mine\'s been worked out: no ore, no crystals).', () => buildMineProp(k).g);
add('The mine', 'mineportal', 'Mine portal', 'The way into the mine, on the ridge\'s east face', 'Two timber posts and a heavy lintel, braced, with a lantern on each post; the gate, two barred halves, sinks into the floor once there\'s power.', v => { const r = buildMinePortal(); if (v) for (const h of r.gates) h.position.y = -5.8; return r.g; }, { variants: ['Gate up', 'Gate down'] });
// the space station
add('The space station', 'hub', 'Station hub', 'The space station', 'A broad drum with a band of light, a low dome and a spire of antennas (56 m across).', () => buildStationHub(28));
add('The space station', 'ship', 'Docked ship', 'The station\'s docks', 'A long hull, a nose, an engine block glowing blue, and side pods. The one waiting for your crystals is bigger, its engines red.', v => buildShip(v ? 46 : 38, !!v), { variants: ['Ship', 'The waiting ship'] });
add('The space station', 'cargobin', 'Cargo bin', 'Dock 1, behind the waiting ship', 'An open-topped bin glowing purple inside, the court\'s diamond on its sides, a column of light; the crystals show as you deliver them.', v => { const r = buildCargoBin(); if (v) for (const c of r.gems) c.visible = true; return r.g; }, { variants: ['Empty', 'Full'] });
// the energy bridges
add('Energy bridges', 'skyportal', 'Bridge portal', 'The foot of every energy bridge on-ramp', 'Two slender posts; once the network is lit, caps of light, an arch with a diamond at its crown, and arrows on the snow (one way in, or both ways).',
  v => { const r = buildSkyPortal(5, v === 2); for (const m of r.lit) m.visible = v > 0; r.pad.material.opacity = v > 0 ? 0.3 : 0; return r.g; }, { variants: ['Unlit', 'Lit (one way)', 'Lit (both ways)'] });
// what's built in place, fitted to the ground or the route, and so not in this file
const IN_PLACE = [
  ['Drawbridges', 'Their ramps are fitted to the river banks; the leaf, lifting towers and chains are built with them.'],
  ['Energy bridge decks and pylons', 'Laid along each route: the decks follow the route\'s heights, the pylons stand where there\'s room.'],
  ['The mine\'s terraces, village and ruins', 'Fitted to the cave: the terraces are light bridges along their routes; Plateau 2\'s adobe houses and Plateau 3\'s ruins are instanced boxes laid out from the village plan.'],
  ['The station\'s decks and walkways', 'Built from the station\'s plan: the ring decks, walkways, railings and the spiral ramp.'],
  ['The ice planet, the black hole, the Starway and fireworks', 'Effects of zone 5 and the station: drawn, not modelled.'],
];
Object.assign(M, { CATALOG: C, IN_PLACE, seeded, rootOf });
})();
