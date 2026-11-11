globalThis.window = globalThis;
require('/home/claude/collinrandolph/skigame/prototypes/planet-terrain.js');
const fs = require('fs'), PT = globalThis.PlanetTerrain;
const L = PT.parse(fs.readFileSync(process.argv[2], 'utf8'));
const t0 = Date.now(), T = PT.terrain(L, L.radius);
console.log('terrain built', Date.now() - t0, 'ms; R', L.radius, 'stop', T.stop, 'layers', L.layers.length, 'ramps', L.ramps.length, 'tunnels', L.tunnels.length, 'models', L.models.length, 'objects', (L.objects||[]).length, 'lawn', !!L.lawn, 'clean', !!L.clean);
const W = 1728, H = 864, out = new Float32Array(W*H);
for (let j = 0; j < H; j++){ const lat = (0.5 - (j + 0.5)/H)*Math.PI, cy = Math.sin(lat), c = Math.cos(lat);
  for (let i = 0; i < W; i++){ const lon = ((i + 0.5)/W - 0.5)*2*Math.PI; out[j*W + i] = T.height(c*Math.cos(lon), cy, -c*Math.sin(lon)); } }
fs.writeFileSync('h.f32', Buffer.from(out.buffer));
// the trails' lines (network), bridges' decks
const lines = T.net ? T.net.lines.map((l, i) => ({ name: T.trails[i].name, closed: !!T.trails[i].closed, pts: l.filter((_, k) => k % 3 === 0) })) : [];
fs.writeFileSync('lines.json', JSON.stringify({ lines, landmarks: L.landmarks, bridges: L.bridges, start: L.start, stamps: L.stamps, cliffs: L.cliffs, network: L.network, scatter: L.scatter }));
console.log('sampled', Date.now() - t0, 'ms');
