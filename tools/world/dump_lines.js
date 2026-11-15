// The trails as the game lays them (smoothed, joined at junctions) and the bridges' decks, for the view audit.
// usage: node dump_lines.js <layout.json> <out.json>
globalThis.window = globalThis;
require(require('path').join(__dirname, '../../prototypes/planet-terrain.js'));
const fs = require('fs'), PT = globalThis.PlanetTerrain;
const L = PT.parse(fs.readFileSync(process.argv[2], 'utf8')), T = PT.terrain(L, L.radius);
const r5 = p => [p.x ?? p[0], p.y ?? p[1], p.z ?? p[2]].map(v => +v.toFixed(6));
const lines = T.net.lines.map((l, i) => ({ name: T.trails[i].name, closed: !!T.trails[i].closed, pts: l.map(r5) }));
const bridges = (L.bridges || []).map(b => { const B = PT.bridgeDeck(b, T.height, L.radius); return { name: b.name, kind: b.kind, pts: B.pts.map(r5), h: Array.from(B.h, v => +v.toFixed(1)) }; });
fs.writeFileSync(process.argv[3], JSON.stringify({ radius: L.radius, lines, bridges }));
console.log(lines.length, 'trails,', bridges.length, 'bridges');
