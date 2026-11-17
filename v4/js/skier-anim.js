// The skier's animation: the game's own pose code, UNCHANGED (lifted from models.js on the v2 branch). It poses any figure
// whose `body` has these parts, each a unit-long thing along +y that setLimb stretches between two joints:
//   torso, head, hat, thigh.L/R, shin.L/R, upper.L/R, fore.L/R, pole.L/R, ski.L/R
// v3's higher-detail figure (figure.js) is built to that contract.
const SK_UP = new THREE.Vector3(0, 1, 0), _ska = new THREE.Vector3(), _skb = new THREE.Vector3(), _skd = new THREE.Vector3();
function setLimb(m, a, b){
  // stretch a unit cylinder between two points in the rig's frame
  _ska.set(...a); _skb.set(...b); _skd.subVectors(_skb, _ska); const L = _skd.length() || 1e-3;
  m.position.addVectors(_ska, _skb).multiplyScalar(0.5); m.quaternion.setFromUnitVectors(SK_UP, _skd.divideScalar(L)); m.scale.set(1, L, 1);
}
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
