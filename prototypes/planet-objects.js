// planet-objects.js: the shapes of the painted objects (PT.OBJECT_KINDS in planet-terrain.js), shared by the planet
// editor and the planetoid so both draw the same thing. load after three.js and planet-terrain.js.
// PlanetObjects.parts(k): kind k's parts, each { geo, color }: one geometry per colour, at size 1, standing on y = 0
// with y up (each object is drawn instanced: a part per kind, its colour times the object's tint).
// PlanetObjects.tint(k, part, t): that part's colour for an object with tint t (0..1), as a hex number.
// PlanetObjects.height(k): how tall kind k is at size 1 (metres)
(function(){
'use strict';
const PT = window.PlanetTerrain, V = THREE.Vector3;
// a shape placed: geometry g moved to (x, y, z), scaled (sx, sy, sz), tipped by (rx, rz) radians, turned ry
function put(g, x = 0, y = 0, z = 0, sx = 1, sy = 1, sz = 1, rx = 0, ry = 0, rz = 0){
  const m = new THREE.Matrix4().compose(new V(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), new V(sx, sy, sz));
  const out = (g.index ? g.toNonIndexed() : g.clone()).applyMatrix4(m); out.deleteAttribute('uv'); return out;
}
// several placed shapes as one geometry, with flat (faceted) normals
function merge(list){
  let n = 0; for (const g of list) n += g.attributes.position.count;
  const pos = new Float32Array(n*3); let o = 0;
  for (const g of list){ pos.set(g.attributes.position.array, o); o += g.attributes.position.array.length; }
  const out = new THREE.BufferGeometry(); out.setAttribute('position', new THREE.BufferAttribute(pos, 3)); out.computeVertexNormals();
  out.computeBoundingSphere(); return out;
}
const cyl = (r0, r1, h, s = 6) => new THREE.CylinderGeometry(r0, r1, h, s, 1), cone = (r, h, s = 8) => new THREE.ConeGeometry(r, h, s, 1);
const ico = (r, d = 0) => new THREE.IcosahedronGeometry(r, d), dod = r => new THREE.DodecahedronGeometry(r, 0);
const SNOW = 0xeef3f7;
// each kind: [[colour, [shapes]], ...]
const BUILD = {
  spruce: () => [[0x4d3f35, [put(cyl(0.12, 0.18, 1.6), 0, 0.8)]], [0x2f4a43, [put(cone(1.5, 3.4), 0, 2.7)]], [0x3e5c53, [put(cone(1.05, 2.6), 0, 4.4)]]],
  fir: () => [[0x4a3b30, [put(cyl(0.1, 0.14, 1.2), 0, 0.6)]],
    [0x24403b, [put(cone(1.0, 2.6, 7), 0, 2.2), put(cone(0.78, 2.2, 7), 0, 3.5, 1, 1, 1, 0, 0.4), put(cone(0.5, 1.8, 7), 0, 4.7, 1, 1, 1, 0, 0.9)]],
    [SNOW, [put(cone(0.24, 0.5, 7), 0, 5.45)]]],
  pine: () => [[0x6b4a33, [put(cyl(0.13, 0.22, 5.4), 0, 2.7), put(cyl(0.05, 0.08, 1.4), 0.45, 4.7, 0, 1, 1, 1, 0, 0, -1.0)]],
    [0x34503a, [put(ico(1.6), 0, 5.7, 0, 1, 0.5, 1), put(ico(1.15), 1.0, 5.0, 0.3, 1, 0.55, 1), put(ico(1.0), -0.75, 5.2, -0.55, 1, 0.55, 1)]]],
  birch: () => [[0xe9e5dc, [put(cyl(0.09, 0.13, 4.0), 0, 2.0)]], [0x3a3631, [put(cyl(0.135, 0.135, 0.12), 0, 1.1), put(cyl(0.12, 0.12, 0.1), 0, 2.3), put(cyl(0.11, 0.11, 0.1), 0, 3.2)]],
    [0xd2b84f, [put(ico(1.3, 1), 0, 4.7, 0, 1, 1.45, 1), put(ico(0.8, 1), 0.55, 3.9, 0.2, 1, 1.2, 1)]]],
  oak: () => [[0x5a4632, [put(cyl(0.22, 0.32, 2.8, 7), 0, 1.4), put(cyl(0.1, 0.16, 1.6), 0.6, 2.8, 0, 1, 1, 1, 0, 0, -0.8), put(cyl(0.1, 0.15, 1.5), -0.5, 2.9, -0.3, 1, 1, 1, 0.3, 0, 0.8)]],
    [0x56703d, [put(ico(2.2), 0, 4.2), put(ico(1.5), 1.6, 3.6, 0.4), put(ico(1.6), -1.4, 3.7, -0.6), put(ico(1.4), 0.2, 3.7, 1.5)]]],
  aspen: () => [[0xc9cbbe, [put(cyl(0.07, 0.11, 4.6), 0, 2.3)]], [0xe0a43a, [put(ico(0.9, 1), 0, 5.0, 0, 1, 1.9, 1)]]],
  bare: () => [[0x5a4a3e, [put(cyl(0.12, 0.2, 3.4), 0, 1.7),
    put(cyl(0.04, 0.08, 1.9), 0.65, 3.3, 0, 1, 1, 1, 0, 0, -0.75), put(cyl(0.04, 0.08, 1.8), -0.6, 3.2, 0.2, 1, 1, 1, 0.2, 0, 0.8),
    put(cyl(0.035, 0.07, 1.6), 0.1, 3.4, 0.6, 1, 1, 1, 0.8, 0, 0), put(cyl(0.035, 0.07, 1.5), -0.1, 3.0, -0.55, 1, 1, 1, -0.85, 0, 0.1),
    put(cyl(0.02, 0.05, 1.1), 0.05, 3.85, 0, 1, 1, 1, 0, 0, -0.2)]]],
  snag: () => [[0x7a6a5c, [put(cyl(0.12, 0.2, 3.4, 5), 0.1, 1.7, 0, 1, 1, 1, 0, 0, -0.06),
    put(cyl(0.03, 0.06, 0.9, 5), 0.35, 2.3, 0, 1, 1, 1, 0, 0, -1.1), put(cyl(0.03, 0.05, 0.7, 5), -0.15, 2.8, 0.2, 1, 1, 1, 0.9, 0, 0.4)]]],
  shrub: () => [[0x46603f, [put(ico(0.8), 0, 0.4, 0, 1, 0.6, 1), put(ico(0.55), 0.6, 0.3, 0.3, 1, 0.65, 1), put(ico(0.5), -0.45, 0.28, -0.4, 1, 0.65, 1)]],
    [SNOW, [put(ico(0.6), 0, 0.68, 0, 1, 0.3, 1)]]],
  boulder: () => [[0x7d8a96, [put(dod(1), 0, 0.3, 0, 1, 0.72, 0.9)]]],
  slab: () => [[0x6f7b86, [put(dod(1), 0, 0.2, 0, 1.5, 0.42, 1.0, 0.08, 0, 0.05)]], [SNOW, [put(dod(0.9), 0.05, 0.42, 0, 1.25, 0.12, 0.8)]]],
  pile: () => [[0x82909c, [put(dod(0.7), 0, 0.38), put(dod(0.5), 0.78, 0.26, 0.3, 1, 0.8, 1), put(dod(0.45), -0.55, 0.22, 0.6, 1, 0.8, 1), put(dod(0.38), 0.1, 0.18, -0.8, 1, 0.8, 1)]]],
  cairn: () => [[0x8b949c, [put(dod(0.5), 0, 0.22, 0, 1, 0.55, 1), put(dod(0.4), 0.03, 0.6, 0, 1, 0.55, 1, 0, 0.6), put(dod(0.3), -0.02, 0.9, 0.02, 1, 0.6, 1, 0, 1.3), put(dod(0.2), 0, 1.13, 0, 1, 0.7, 1)]]],
};
const cache = new Map();
function parts(k){
  if (cache.has(k)) return cache.get(k);
  const kind = PT.OBJECT_KINDS[k], b = kind && BUILD[kind.id];
  const list = b ? b().map(([color, shapes]) => ({ color, geo: merge(shapes) })) : [];
  let h = 0; for (const p of list){ p.geo.computeBoundingBox(); h = Math.max(h, p.geo.boundingBox.max.y); }
  list.h = h; cache.set(k, list); return list;
}
const _c = new THREE.Color();
// a part's colour, a little darker or lighter by the object's tint (snow stays snow)
function tint(k, pi, t){
  const p = parts(k)[pi]; if (!p) return 0xffffff; if (p.color === SNOW) return SNOW;
  _c.setHex(p.color).multiplyScalar(0.82 + 0.36*(t ?? 0.5)); _c.r = Math.min(1, _c.r); _c.g = Math.min(1, _c.g); _c.b = Math.min(1, _c.b);
  return _c.getHex();
}
window.PlanetObjects = { parts, tint, height: k => parts(k).h, SNOW };
})();
