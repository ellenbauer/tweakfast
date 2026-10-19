/* The Every page row: on a page whose body shows (the demo) it offers Page background; on one whose sections each own
   their ground (the Spring Widget copy in tools/_sw: home, and the legal pages where the body shows only behind the
   menu, where the cream legal area is the page's ground and shows) it says so and offers nothing on the home page only. Needs a FRESH tools/fake-save-server.py on 8788 (a saved demo page would be served for the copy) and tools/_sw (a copy of the site). */
const { chromium } = await import(process.env.TF_PLAYWRIGHT || new URL('../node_modules/playwright-core/index.mjs', import.meta.url).pathname);
const b = await chromium.launch({ executablePath: process.env.TF_CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
const want = { 'demo': true, 'demo about': true, 'spring widget': false, 'spring widget privacy': true };
for (const [name, path] of [['demo', '/demo/index.html'], ['demo about', '/demo/about.html'], ['spring widget', '/tools/_sw/index.html'], ['spring widget privacy', '/tools/_sw/privacy-policy.html']]) {
  const p = await b.newPage({ viewport: { width: 1300, height: 850 } });
  p.on('pageerror', e => console.log('PAGEERROR', e.message));
  await p.goto('http://127.0.0.1:8788' + path + '?v=' + Date.now() + '#edit=test'); await p.waitForSelector('.tf-pages', { timeout: 15000 }); await p.waitForTimeout(800);
  await p.click('.tf-button:has-text("Got it")').catch(() => {});
  if (!(await p.$('.tf-panel:not(.tf-pal):not(.tf-out)'))) { await p.click('.tf-pages'); await p.waitForTimeout(150); } await p.waitForTimeout(400);
  const row = await p.$eval('.tf-ground-caption + .tf-row', e => ({ offers: !!e.querySelector('a'), text: e.textContent.replace(/light|dark|colour$/, '').trim(), fits: e.scrollWidth <= e.clientWidth + 1 }));
  console.log(name + ': offers Page background', row.offers, '(want ' + want[name] + ')', row.offers === want[name], '| fits', row.fits, '|', row.text);
  await p.close();
}
await b.close();
