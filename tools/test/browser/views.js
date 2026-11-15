// Screenshots from given viewpoints, to eyeball what the view audit scores.
//   node views.js "lon,lat,bearing" ...     writes view-1.png, view-2.png, ...
const { open } = require('./harness');
(async () => {
  const h = await open('prototypes/planetoid.html?layout=../planets/v2-world.json'), page = h.page;
  const spots = process.argv.slice(2).map(s => s.split(',').map(Number));
  for (let i = 0; i < spots.length; i++){
    await page.evaluate(([lo, la, bearing]) => { const p = window.__planetoid, V = THREE.Vector3, a = lo*Math.PI/180, b = la*Math.PI/180, u = new V(Math.cos(b)*Math.cos(a), Math.sin(b), -Math.cos(b)*Math.sin(a));
      const up = Math.abs(u.y) < 0.9 ? new V(0, 1, 0) : new V(1, 0, 0), e = up.clone().cross(u).normalize(), nn = u.clone().cross(e), r = bearing*Math.PI/180, f = nn.clone().multiplyScalar(Math.cos(r)).addScaledVector(e, Math.sin(r));
      p.TEST.place(u); const ex = new V(1, 0, 0).addScaledVector(u, -u.x).normalize(), ey = ex.clone().cross(u).normalize();
      p.S.vx = p.S.vy = 0; p.S.th = p.S.tgt = Math.atan2(f.dot(ex), -f.dot(ey)); }, spots[i]);
    await page.evaluate(() => { const p = window.__planetoid; if (p.P) p.P.daynight = false; });
    await page.waitForTimeout(2500);
    await page.screenshot({ path: `view-${i + 1}.png` });
  }
  console.log('errors:', h.errors); await h.close();
})();
