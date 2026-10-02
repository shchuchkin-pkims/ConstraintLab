/* Вспомогательный инструмент разработчика: снимки экрана ConstraintLab в Chrome (headless) через DevTools Protocol.
   node tools/screenshot.js "file:///…/index.html?bank=50_my.js#q=my.id" steps.json <каталог> */
// Мини-драйвер Chrome DevTools Protocol: node cdp.js <url> <script.json>
const { spawn } = require('child_process');
const fs = require('fs');
const url = process.argv[2];
const steps = JSON.parse(fs.readFileSync(process.argv[3], 'utf8'));
const outDir = process.argv[4] || '.';
const port = 9300 + Math.floor(Math.random() * 500);
const chrome = spawn('google-chrome', ['--headless=new', '--disable-gpu', '--no-sandbox', `--remote-debugging-port=${port}`, '--allow-file-access-from-files',
  '--user-data-dir=' + outDir + '/chrome-prof', '--window-size=' + (steps.size || '1600,1000'), 'about:blank'], { stdio: 'ignore' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  let ws, id = 0; const pend = new Map(); const logs = [];
  for (let i = 0; i < 50; i++) { try { const r = await fetch(`http://127.0.0.1:${port}/json`); const j = await r.json(); const pg = j.find((x) => x.type === 'page'); if (pg) { ws = new WebSocket(pg.webSocketDebuggerUrl); break; } } catch (e) {} await sleep(200); }
  await new Promise((r) => ws.addEventListener('open', r));
  ws.addEventListener('message', (ev) => { const m = JSON.parse(ev.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); } else if (m.method === 'Runtime.consoleAPICalled') logs.push('[console.' + m.params.type + '] ' + m.params.args.map((a) => a.value ?? a.description).join(' ')); else if (m.method === 'Runtime.exceptionThrown') logs.push('[exception] ' + JSON.stringify(m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text)); });
  const send = (method, params) => new Promise((r) => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
  await send('Runtime.enable'); await send('Page.enable');
  const [w, h] = (steps.size || '1600,1000').split(',').map(Number);
  await send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile: w < 700 });
  if (steps.dark) await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: 'dark' }] });
  await send('Page.navigate', { url });
  await sleep(1500);
  for (const s of steps.steps) {
    if (s.eval) { const r = await send('Runtime.evaluate', { expression: s.eval, awaitPromise: true, returnByValue: true }); if (s.print) console.log('EVAL:', JSON.stringify(r.result.result?.value ?? r.result.exceptionDetails?.exception?.description)); }
    if (s.wait) await sleep(s.wait);
    if (s.shot) { const r = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: !!s.full }); fs.writeFileSync(outDir + '/' + s.shot, Buffer.from(r.result.data, 'base64')); console.log('shot', s.shot); }
  }
  if (logs.length) console.log(logs.join('\n'));
  ws.close(); chrome.kill(); process.exit(0);
})().catch((e) => { console.error(e); chrome.kill(); process.exit(1); });
