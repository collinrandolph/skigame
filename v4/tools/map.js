// A flat map of Hale for checking the layout: node tools/map.js > /tmp/hale.json ; python3 tools/map.py
const W = require('../js/world.js'), Wd = 720, Hd = 360, h = [];
for (let j = 0; j < Hd; j++) for (let i = 0; i < Wd; i++){ const d = W.ll(-180 + (i + 0.5)*360/Wd, 90 - (j + 0.5)*180/Hd); h.push(+W.height(d[0], d[1], d[2]).toFixed(1)); }
const L = p => W.toLL(p).map(v => +v.toFixed(2));
console.log(JSON.stringify({ Wd, Hd, h, trails: W.TRAILS.map(t => ({ name: t.name, pts: t.pts.filter((_, i) => i % 3 === 0).map(L) })), sites: W.SITES.filter(s => s.landmark || s.kind === 'relay').map(s => ({ kind: s.kind, name: s.name, at: L(s.d) })),
  bridge: W.BRIDGE.pts.filter((_, i) => i % 3 === 0).map(L), trees: W.TREES.filter((_, i) => i % 3 === 0).map(t => L(t.d)), start: L(W.START.d) }));
