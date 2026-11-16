// Screenshots of the v3 prototype in headless Chromium (needs Playwright and a local three.js r128: THREE_JS=path).
//   node tools/shot.js out-prefix "lon,lat,bearing[,dayPhase]" ...      with no spots: one shot from the start
const { open } = require('../../tools/test/browser/harness');
(async () => {
  const out = process.argv[2] || 'shot', spots = process.argv.slice(3).map(s => s.split(',').map(Number));
  const h = await open('v3/index.html?q=' + (process.env.Q || 'high'), { wait: false, width: +process.env.W || 1280, height: +process.env.H || 720 }), page = h.page;
  try { await page.waitForFunction(() => window.__hale, null, { timeout: 240000 }); } catch (e){ console.log('did not boot:', h.errors.join('\n')); await h.close(); process.exit(1); }
  if (process.env.CLEAN) await page.evaluate(() => document.body.classList.add('clean'));
  if (process.env.EVAL) await page.evaluate(process.env.EVAL);
  if (!spots.length) spots.push(null);
  for (let i = 0; i < spots.length; i++){
    if (spots[i]) await page.evaluate(([lo, la, b, ph]) => { if (ph !== undefined) window.__hale.dayPhase = ph; window.__hale.place(lo, la, b); }, spots[i]);
    await page.waitForTimeout(+process.env.WAIT || 2500);
    await page.screenshot({ path: `${out}-${i + 1}.png` });
  }
  console.log('errors:', h.errors.length ? h.errors.join('\n') : 'none'); console.log(await page.evaluate(() => JSON.stringify({ tris: window.__hale.renderer.info.render.triangles, calls: window.__hale.renderer.info.render.calls })));
  await h.close();
})();
