const { open } = require('./harness.js');
(async () => {
  const t0 = Date.now(), h = await open('prototypes/planetoid.html?layout=../planets/v2-world.json');
  await h.page.waitForTimeout(1500);
  const info = await h.page.evaluate(() => { const p = window.__planetoid; return { note: document.getElementById('layoutNote').textContent, models: p.models().length, counts: p.counts(), doors: p.doors().length, caves: p.caveMeshes(), snow: document.getElementById('hSnow').textContent, n: [p.n.x, p.n.y, p.n.z] }; });
  console.log('loaded in', Date.now() - t0, 'ms'); console.log(JSON.stringify(info)); console.log('errors:', h.errors.length, h.errors.slice(0, 5));
  await h.page.screenshot({ path: 'smoke.png' }); await h.close();
})().catch(e => { console.error('FAILED', e); process.exit(1); });
