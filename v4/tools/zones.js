// Are Hale's zones sealed? (v4: the owner's terrain; the walls are the sculpt's own ranges.) Floods the skiable ground from each loop with every gate shut and every bridge up, and
// reports which places end up joined. Skiable: ground no steeper than the game's stop rule.
//   node tools/zones.js [stop]        (default: the game's STOP, and 1.3 times it for margin; both must hold)
const W = require('../js/world.js'), NX = 1440, NY = 720, D2R = Math.PI/180;
const H = new Float32Array(NX*NY), blocked = new Uint8Array(NX*NY);
const dirAt = (i, j) => W.ll(-180 + (i + 0.5)*360/NX, 90 - (j + 0.5)*180/NY);
for (let j = 0; j < NY; j++) for (let i = 0; i < NX; i++){ const d = dirAt(i, j); H[j*NX + i] = W.height(d[0], d[1], d[2]); }
const cellOf = d => { const [lo, la] = W.toLL(d); return Math.min(NY - 1, Math.floor((90 - la)/180*NY))*NX + ((Math.floor((lo + 180)/360*NX) % NX) + NX) % NX; };
for (const s of W.SOLIDS) if (s.gate){ const c = cellOf(s.d), j0 = Math.floor(c/NX), i0 = c % NX; for (let dj = -2; dj <= 2; dj++) for (let di = -3; di <= 3; di++){ const j = j0 + dj, i = ((i0 + di) % NX + NX) % NX; if (j >= 0 && j < NY && W.dist(dirAt(i, j), s.d) < s.r + 1.3) blocked[j*NX + i] = 1; } }
// the game stops a skier entering ground whose slope (the size of the gradient) is over STOP, whichever way they face.
// so: skiable ground is the cells whose slope is at or under that, and zones are what is joined through them
const dy = Math.PI*W.R/NY, S = new Float32Array(NX*NY);
for (let j = 0; j < NY; j++){ const dx = dy*Math.max(0.02, Math.cos((90 - (j + 0.5)*180/NY)*D2R)), k = Math.max(1, Math.round(dy/dx));
  for (let i = 0; i < NX; i++){ const gx = (H[j*NX + (i + k) % NX] - H[j*NX + (i + NX - k) % NX])/(2*k*dx), gy = (H[Math.min(NY - 1, j + 1)*NX + i] - H[Math.max(0, j - 1)*NX + i])/(2*dy); S[j*NX + i] = Math.hypot(gx, gy); } }
function flood(stop){
  const lab = new Int32Array(NX*NY).fill(-1); let n = 0;
  for (let s = 0; s < NX*NY; s++){
    if (lab[s] >= 0 || blocked[s] || S[s] > stop) continue; const q = [s]; lab[s] = n;
    while (q.length){ const c = q.pop(), j = Math.floor(c/NX), i = c % NX, dx = dy*Math.max(0.02, Math.cos((90 - (j + 0.5)*180/NY)*D2R)), k = Math.max(1, Math.round(dy/dx));
      const tryTo = c2 => { if (lab[c2] >= 0 || blocked[c2] || S[c2] > stop) return; lab[c2] = n; q.push(c2); };
      for (let o = 1; o <= k; o++){ tryTo(j*NX + (i + o) % NX); tryTo(j*NX + (i + NX - o) % NX); } if (j > 0) tryTo(c - NX); if (j < NY - 1) tryTo(c + NX);
    } n++; }
  return lab;
}
const first = k => W.TRAILS.find(t => t.z === k && t.closed).pts[0];
const places = [['zone 1', first('1')], ['zone 2', first('2')], ['zone 3', first('3')], ['zone 4', first('4')], ['highlands', first('E')], ['summit', W.offset(W.SUMMIT, 8, 0)], ['pit floor', W.DOOR.d],
  ...W.TERMINALS.map(t => [t.name + ' (zone ' + t.zone + ')', t.at])];
const names = ['zone 1', 'zone 2', 'zone 3', 'zone 4', 'highlands', 'summit'];
let bad = 0;
for (const stop of process.argv[2] ? [+process.argv[2]] : [W.STOP, W.STOP*1.2]){
  const lab = flood(stop), id = Object.fromEntries(places.map(([n, d]) => [n, lab[cellOf(d)]])), six = names.map(n => id[n]);
  const sealed = new Set(six).size === 6 && !six.includes(-1);
  console.log(`stop ${stop.toFixed(2)}: ${sealed ? 'SEALED: the four zones, the highlands and the summit are six separate grounds' : 'LEAK: ' + JSON.stringify(Object.fromEntries(names.map(n => [n, id[n]])))}`);
  if (!sealed) bad++;
  console.log('  the pit floor is', id['pit floor'] === id['zone 3'] ? 'joined to zone 3 by the Pit Road (with the mine portal shut: a LEAK)' : 'its own ground while the mine portal is shut');
  for (const t of W.TERMINALS) if (id[t.name + ' (zone ' + t.zone + ')'] !== id['zone ' + t.zone]){ console.log('  ' + t.name + ' is not on its zone\'s ground'); bad++; }
}
process.exit(bad ? 1 : 0);
