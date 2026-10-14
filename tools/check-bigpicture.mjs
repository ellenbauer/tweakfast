/* A picture too large for the site (5 MB) is made to fit when it is chosen, not refused at Done: a PNG with nothing
   see-through becomes a JPEG, one with see-through parts is drawn smaller. Pass two big PNG paths: opaque, see-through.
   Needs the repo served on TF_PORT (default 8787). */
const { chromium } = await import(process.env.TF_PLAYWRIGHT || new URL('../node_modules/playwright-core/index.mjs', import.meta.url).pathname);
const PORT = process.env.TF_PORT || 8787, [opaque, clear] = process.argv.slice(2);
const b = await chromium.launch({ executablePath: process.env.TF_CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
const p = await b.newPage({ viewport: { width: 1100, height: 800 } });
p.on('pageerror', e => console.log('PAGEERROR', e.message));
const size = () => p.$eval('main img', i => { const s = i.getAttribute('src'); return s.slice(5, s.indexOf(';')) + ' ' + (Math.floor((s.length - s.indexOf(',') - 1) * 3 / 4) / 1048576).toFixed(2) + ' MB, ' + i.naturalWidth + ' wide'; });
await p.goto('http://127.0.0.1:' + PORT + '/demo/about.html?v=' + Date.now() + '#edit=test'); await p.waitForTimeout(500);
await p.click('.tf-button:has-text("Got it")').catch(() => {});
for (const f of [clear, opaque]) {
  await p.click('main img'); await p.waitForTimeout(200);
  const [ch] = await Promise.all([p.waitForEvent('filechooser'), p.click('main img')]);
  await ch.setFiles(f); await p.waitForFunction(() => !/Reading/.test(document.querySelector(".tf-status").textContent), null, { timeout: 60000 }); await p.waitForTimeout(300);
  console.log(f.split('/').pop(), '->', await size(), '| said:', JSON.stringify(await p.$eval('.tf-status', s => s.textContent.trim())));
  await p.keyboard.press('Escape'); await p.keyboard.press('Escape');
}
await b.close();
