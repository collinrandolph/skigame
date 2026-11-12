// Opens the planetoid game in headless Chromium against a local server, with three.js served from a local copy.
const { chromium } = require('playwright'), fs = require('fs'), http = require('http'), path = require('path');
const ROOT = path.join(__dirname, '../../..'), THREE_JS = fs.readFileSync(process.env.THREE_JS || '/home/claude/mrdoob/three.js/build/three.min.js');
const TYPES = { '.html': 'text/html', '.js': 'application/javascript', '.json': 'application/json', '.png': 'image/png', '.wav': 'audio/wav' };
exports.open = async function(url, { width = 1280, height = 800, wait = true } = {}){
  const server = http.createServer((req, res) => { const p = path.join(ROOT, decodeURIComponent(req.url.split('?')[0])); fs.readFile(p, (e, d) => { if (e){ res.writeHead(404); res.end(); return; } res.writeHead(200, { 'Content-Type': TYPES[path.extname(p)] || 'application/octet-stream' }); res.end(d); }); });
  await new Promise(r => server.listen(0, r)); const port = server.address().port;
  const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const page = await browser.newPage({ viewport: { width, height } }); const errors = [], logs = [];
  page.on('pageerror', e => errors.push(String(e.stack || e).slice(0, 600))); page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text().slice(0, 300)); else logs.push(m.text().slice(0, 300)); });
  await page.route('**/*', r => { const u = r.request().url(); if (u.includes('three.min.js')) return r.fulfill({ body: THREE_JS, contentType: 'application/javascript' }); if (!u.startsWith('http://localhost')) return r.abort(); r.continue(); });
  await page.goto(`http://localhost:${port}/${url}`);
  if (wait) await page.waitForFunction(() => window.__planetoid && document.getElementById('loading').style.display === 'none', null, { timeout: 180000 });
  return { page, errors, logs, close: async () => { await browser.close(); server.close(); } };
};
