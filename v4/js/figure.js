// The v3 skier: a higher-detail figure on the game's own joints. The animation (skier-anim.js: poseSkier) is unchanged;
// it stretches each limb between two joints with setLimb, so every limb here is a shape one unit long on +y (its -y
// end at the first joint, +y at the second) and anything that must not stretch with it (a glove, a knee, a pole
// basket) is a child whose y scale is undone after each pose.
//
// After the concept art: orange shell jacket, dark tights, a pack on the back, a helmet with a visor.
function buildSkierV3(THREE){
  const rig = new THREE.Group(), fixes = [];
  const M = (color, o = {}) => new THREE.MeshStandardMaterial(Object.assign({ color, roughness: 0.75, metalness: 0.0 }, o));
  const mats = {
    jacket: M(0xe8542a, { roughness: 0.62 }), trim: M(0xf4f1ea, { roughness: 0.7 }), pants: M(0x161a21, { roughness: 0.55 }), pack: M(0x2d333c, { roughness: 0.85 }),
    glove: M(0x101216, { roughness: 0.9 }), boot: M(0xd9dde2, { roughness: 0.5 }), helmet: M(0xe8542a, { roughness: 0.35 }), visor: M(0x0b1220, { roughness: 0.08, metalness: 0.9 }),
    skin: M(0xd9b8a0), ski: M(0xe9eef4, { roughness: 0.3, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -6 }), skiTip: M(0xe8542a, { roughness: 0.4 }),
    pole: M(0x20242b, { roughness: 0.3, metalness: 0.6 }), glow: new THREE.MeshBasicMaterial({ color: 0x7fe6ff }),
  };
  // a limb: a tapered tube, with rounded joints at its ends that keep their shape however long the limb is drawn
  const limb = (r0, r1, mat, joint0 = true, joint1 = true) => {
    const g = new THREE.Group(), tube = new THREE.Mesh(new THREE.CylinderGeometry(r1, r0, 1, 16, 1), mat); g.add(tube);
    const cap = (r, y) => { const s = new THREE.Mesh(new THREE.SphereGeometry(r, 14, 10), mat); s.position.y = y; g.add(s); fixes.push([g, s, 1]); return s; };
    if (joint0) cap(r0, -0.5); if (joint1) cap(r1, 0.5);
    rig.add(g); return g;
  };
  const keep = (parent, child, base = 1) => { parent.add(child); fixes.push([parent, child, base]); return child; };

  // ---- torso: hips to shoulders, shaped (narrow waist, deeper chest), flattened front to back
  const torso = new THREE.Group(); rig.add(torso);
  { const g = new THREE.CylinderGeometry(1, 1, 1, 24, 10), p = g.attributes.position;
    const prof = y => { const t = y + 0.5; return 0.122 + 0.030*Math.sin(Math.min(1, t*1.15)*Math.PI*0.5)*t - 0.012*Math.sin(t*Math.PI)*(1 - t) - 0.045*Math.max(0, t - 0.86)/0.14; };
    for (let i = 0; i < p.count; i++){ const y = p.getY(i), r = prof(y), a = Math.atan2(p.getZ(i), p.getX(i)), flat = Math.hypot(p.getX(i), p.getZ(i)) < 0.5 ? 0 : 1;
      p.setXYZ(i, Math.cos(a)*r*1.12*flat, y, Math.sin(a)*r*0.78*flat); }
    g.computeVertexNormals(); torso.add(new THREE.Mesh(g, mats.jacket));
    // a pale yoke across the shoulders and a light strip down the back of the pack
    const yoke = new THREE.Mesh(new THREE.CylinderGeometry(0.151, 0.158, 0.09, 24, 1, true), mats.trim); yoke.scale.set(1.12, 1, 0.78); yoke.position.y = 0.33; torso.add(yoke);
    const belt = new THREE.Mesh(new THREE.CylinderGeometry(0.127, 0.127, 0.05, 24, 1, true), mats.pack); belt.scale.set(1.12, 1, 0.8); belt.position.y = -0.4; torso.add(belt);
    const pack = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.5, 0.1, 3, 4, 2), mats.pack);
    { const q = pack.geometry.attributes.position; for (let i = 0; i < q.count; i++){ const x = q.getX(i), y = q.getY(i), z = q.getZ(i), k = 1 - 0.35*Math.pow(Math.abs(y)/0.25, 3); q.setXYZ(i, x*k*(z > 0 ? 0.86 : 1), y, z*(1 - 0.3*Math.pow(Math.abs(x)/0.1, 2))); } pack.geometry.computeVertexNormals(); }
    pack.position.set(0, 0.08, 0.135); torso.add(pack);
    const strip = new THREE.Mesh(new THREE.BoxGeometry(0.022, 0.3, 0.012), mats.glow); strip.position.set(0, 0.08, 0.19); torso.add(strip);
    const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.062, 0.075, 0.09, 16), mats.pants); collar.position.y = 0.53; keep(torso, collar);
    for (const sd of [-1, 1]){ const strap = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.52, 0.012), mats.pack); strap.position.set(sd*0.075, 0.1, -0.118); strap.rotation.x = 0.06; torso.add(strap); }
  }
  // ---- head: a helmet with a visor, facing -z (forward)
  const head = new THREE.Group(), hat = new THREE.Group(); rig.add(head, hat);
  { const face = new THREE.Mesh(new THREE.SphereGeometry(0.098, 20, 14), mats.skin); face.scale.set(0.92, 1.05, 0.95); face.position.y = -0.012; head.add(face);
    const shell = new THREE.Mesh(new THREE.SphereGeometry(0.122, 24, 16, 0, Math.PI*2, 0, Math.PI*0.62), mats.helmet); shell.scale.set(0.97, 1.0, 1.08); shell.position.set(0, -0.012, 0.006); hat.add(shell);
    const visor = new THREE.Mesh(new THREE.SphereGeometry(0.113, 24, 10, Math.PI*1.02, Math.PI*0.96, Math.PI*0.36, Math.PI*0.2), mats.visor); visor.rotation.y = Math.PI/2*0; visor.position.set(0, -0.012, 0); visor.scale.set(1, 1, 1.06);
    // (SphereGeometry's phi 0 is +x going round toward -z, so 1.02pi .. 1.98pi spans the -z half: the front)
    head.add(visor);
    const ridge = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.02, 0.2), mats.trim); ridge.position.set(0, 0.105, 0.01); hat.add(ridge);
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.014, 8, 6), mats.glow); lamp.position.set(0, 0.07, -0.118); hat.add(lamp);
    const gaiter = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.08, 0.07, 16), mats.pants); gaiter.position.y = -0.105; head.add(gaiter); }
  // ---- arms and legs
  const body = { torso, head, hat, thigh: {}, shin: {}, upper: {}, fore: {}, pole: {}, ski: {} };
  for (const k of ['L', 'R']){
    body.thigh[k] = limb(0.082, 0.062, mats.pants);
    body.shin[k] = limb(0.058, 0.043, mats.pants, false, false);
    { const cuff = new THREE.Mesh(new THREE.CylinderGeometry(0.052, 0.05, 0.1, 14), mats.boot); cuff.position.y = 0.46; keep(body.shin[k], cuff);
      const band = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.018, 14), mats.jacket); band.position.y = -0.2; keep(body.shin[k], band); }
    body.upper[k] = limb(0.064, 0.05, mats.jacket);
    body.fore[k] = limb(0.05, 0.04, mats.jacket, false, false);
    { const glove = new THREE.Mesh(new THREE.SphereGeometry(0.048, 12, 10), mats.glove); glove.scale.set(0.9, 1.25, 1); glove.position.y = 0.5; keep(body.fore[k], glove, 1.25);
      const cuff = new THREE.Mesh(new THREE.CylinderGeometry(0.047, 0.045, 0.03, 12), mats.trim); cuff.position.y = 0.42; keep(body.fore[k], cuff); }
    // the pole: shaft from hand to tip, a grip and strap at the hand, a basket just above the tip
    body.pole[k] = new THREE.Group(); rig.add(body.pole[k]);
    { const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.0055, 0.009, 1, 8), mats.pole); body.pole[k].add(shaft);
      const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.012, 0.13, 8), mats.jacket); grip.position.y = -0.46; keep(body.pole[k], grip);
      const basket = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.03, 10), mats.skiTip); basket.position.y = 0.45; basket.rotation.x = Math.PI; keep(body.pole[k], basket); }
    // the ski: a long thin board with an upturned tip, a binding plate and the boot on it (the binding is the origin)
    const ski = new THREE.Group(); rig.add(ski); body.ski[k] = ski;
    { const len = 1.78, g = new THREE.BoxGeometry(0.052, 0.018, len, 2, 1, 28), p = g.attributes.position;
      for (let i = 0; i < p.count; i++){ let x = p.getX(i), y = p.getY(i), z = p.getZ(i) - 0.15; const f = (-(z + 0.15) + len/2)/len;      // 0 tail .. 1 tip
        const tip = Math.max(0, (f - 0.86)/0.14), tail = Math.max(0, (0.05 - f)/0.05), w = 1 - 0.45*tip*tip - 0.25*tail + 0.06*Math.sin(f*Math.PI)*-1;
        p.setXYZ(i, x*w, y + 0.075*tip*tip + 0.012*tail + 0.004*Math.sin(f*Math.PI), z); }
      g.computeVertexNormals(); const board = new THREE.Mesh(g, mats.ski); board.position.y = 0.009; ski.add(board);
      const tipCap = new THREE.Mesh(new THREE.BoxGeometry(0.034, 0.012, 0.2), mats.skiTip); tipCap.position.set(0, 0.07, -0.15 - len/2 + 0.07); tipCap.rotation.x = 0.55; ski.add(tipCap);
      const plate = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.014, 0.3), mats.pole); plate.position.set(0, 0.025, 0.02); ski.add(plate);
      const boot = new THREE.Mesh(new THREE.BoxGeometry(0.085, 0.075, 0.27, 2, 2, 4), mats.boot);
      { const q = boot.geometry.attributes.position; for (let i = 0; i < q.count; i++){ const z = q.getZ(i), y = q.getY(i), toe = Math.max(0, (-z - 0.04)/0.095); q.setXYZ(i, q.getX(i)*(1 - 0.3*toe*toe)*(y > 0 ? 0.86 : 1), y*(1 - 0.5*toe*toe) - (y > 0 ? 0 : 0), z); } boot.geometry.computeVertexNormals(); }
      boot.position.set(0, 0.07, 0.0); ski.add(boot);
      const toe = new THREE.Mesh(new THREE.BoxGeometry(0.087, 0.02, 0.06), mats.jacket); toe.position.set(0, 0.045, -0.1); ski.add(toe); }
  }
  // the court's reward (kept from the game): purple shell, gold trim
  const sk = { rig, body, mats, state: { bodyVis: null, poleT: 0, loadW: 0 } };
  sk.setOutfit = (on, colour = 0xe8542a) => { mats.jacket.color.setHex(on ? 0x7b3fe0 : colour); mats.helmet.color.setHex(on ? 0x7b3fe0 : colour); mats.trim.color.setHex(on ? 0xe6bf4f : 0xf4f1ea); mats.glow.color.setHex(on ? 0xd9a8ff : 0x7fe6ff); };
  sk.pose = G => { const th = poseSkier(sk, G); for (const [p, c, base] of fixes) c.scale.y = base/Math.max(0.05, p.scale.y); return th; };
  rig.traverse(o => { if (o.isMesh){ o.castShadow = true; } });
  return sk;
}
