/* On a phone (no Cmd+K) the Site sheet's head has Search: it opens the same search, Cancel goes back to the sheet; a desk shows no Search there.
   Needs the repo served on TF_PORT (default 8787). */
const { chromium, devices } = await import(process.env.TF_PLAYWRIGHT || new URL('../node_modules/playwright-core/index.mjs', import.meta.url).pathname);
const PORT = process.env.TF_PORT || 8787, url = 'http://127.0.0.1:' + PORT + '/demo/index.html?v=' + Date.now() + '#edit=test';
const b = await chromium.launch({ executablePath: process.env.TF_CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
const phone = await (await b.newContext({ ...devices['iPhone 13'] })).newPage();
phone.on('pageerror', e => console.log('PAGEERROR', e.message));
await phone.goto(url); await phone.waitForTimeout(600);
await phone.tap('.tf-button:has-text("Got it")', { timeout: 2000 }).catch(() => {});
await phone.tap('.tf-bar .tf-button:has-text("Site")'); await phone.waitForTimeout(300);
console.log('phone head:', await phone.$$eval('.tf-sheet-head button', bs => bs.map(x => x.getAttribute('aria-label')).join(',')));
await phone.tap('.tf-sheet-head button[aria-label="Search"]'); await phone.waitForTimeout(300);
console.log('search open:', !!(await phone.$('.tf-pal')), '| Cancel there:', !!(await phone.$('.tf-pal-cancel')));
await phone.fill('.tf-pal-input', 'even'); await phone.waitForTimeout(200);
console.log('typing finds:', await phone.$$eval('.tf-pal .tf-sheet-body button', r => r.map(x => x.textContent.trim()).slice(0, 2).join(' / ')));
if (process.env.TF_SHOT) await phone.screenshot({ path: process.env.TF_SHOT });
await phone.tap('.tf-pal-cancel'); await phone.waitForTimeout(300);
console.log('Cancel: search gone', !(await phone.$('.tf-pal')), '| sheet back', !!(await phone.$('.tf-panel:not(.tf-pal)')));
const desk = await (await b.newContext({ viewport: { width: 1100, height: 800 } })).newPage();
await desk.goto(url); await desk.waitForTimeout(500); await desk.click('.tf-button:has-text("Got it")', { timeout: 2000 }).catch(() => {});
await desk.click('.tf-bar .tf-button:has-text("Site")'); await desk.waitForTimeout(300);
console.log('desk head:', await desk.$$eval('.tf-sheet-head button', bs => bs.map(x => x.getAttribute('aria-label')).join(',')));
await b.close();
