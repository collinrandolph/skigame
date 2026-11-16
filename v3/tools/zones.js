// Are Hale's zones sealed? Floods the skiable ground from each loop with every gate shut and every bridge up, and
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
const places = [['Frostline Loop', W.TRAILS[0].pts[0]], ['Frostveil', W.TRAILS[1].pts[0]], ['Court Round', W.TRAILS[2].pts[0]], ['The Cut', W.TRAILS[3].pts[0]], ['Ascent foot', W.BRIDGE.foot],
  ...W.TERMINALS.map(t => [t.name + ' (zone ' + t.zone + ')', t.at]), ...W.DRAWS.flatMap(D => [[D.name + ' near end', D.pts[0]], [D.name + ' far end', D.pts[D.pts.length - 1]]])];
const want = { 'Frostline Loop': 'A', 'Frostveil': 'B', 'Court Round': 'C', 'The Cut': 'D', 'Ascent foot': 'E' };
let bad = 0;
for (const stop of process.argv[2] ? [+process.argv[2]] : [W.STOP, W.STOP*1.3]){
  const lab = flood(stop), id = Object.fromEntries(places.map(([n, d]) => [n, lab[cellOf(d)]])), five = ['Frostline Loop', 'Frostveil', 'Court Round', 'The Cut', 'Ascent foot'].map(n => id[n]);
  const sealed = new Set(five).size === 5 && !five.includes(-1);
  console.log(`stop ${stop}: ${sealed ? 'SEALED: the four zones and the crown are five separate grounds' : 'LEAK: ' + JSON.stringify(Object.fromEntries(Object.keys(want).map(n => [n, id[n]])))}`);
  if (!sealed) bad++;
  const zoneLab = { 1: id['Frostline Loop'], 2: id['Frostveil'], 3: id['The Cut'] };
  for (const t of W.TERMINALS) if (id[t.name + ' (zone ' + t.zone + ')'] !== zoneLab[t.zone]){ console.log('  ' + t.name + ' is not on its zone\'s ground'); bad++; }
  for (const t of W.TERMINALS) for (const o of t.orbs) if (lab[cellOf(o)] !== zoneLab[t.zone]){ console.log('  an orb of ' + t.name + ' is outside zone ' + t.zone); bad++; break; }
}
process.exit(bad ? 1 : 0);
