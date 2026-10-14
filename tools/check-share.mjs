/* Share: Site's head has Share the site; it shows the address readers use (never the editing link), Copy, and a QR code; Cmd+K has it too.
   Needs the repo served on TF_PORT (default 8787). */
const { chromium } = await import(process.env.TF_PLAYWRIGHT || new URL('../node_modules/playwright-core/index.mjs', import.meta.url).pathname);
const PORT = process.env.TF_PORT || 8787;
const b = await chromium.launch({ executablePath: process.env.TF_CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
const ctx = await b.newContext({ viewport: { width: 1100, height: 900 }, permissions: ['clipboard-read', 'clipboard-write'] });
const p = await ctx.newPage();
p.on('pageerror', e => console.log('PAGEERROR', e.message));
await p.goto('http://127.0.0.1:' + PORT + '/demo/index.html?v=' + Date.now() + '#edit=test'); await p.waitForTimeout(500);
await p.click('.tf-button:has-text("Got it")').catch(() => {});
await p.click('.tf-bar .tf-button:has-text("Site")'); await p.waitForTimeout(300);
console.log('head buttons:', await p.$$eval('.tf-sheet-head button', bs => bs.map(x => x.getAttribute('aria-label')).join(',')));
await p.click('.tf-sheet-head button[aria-label="Share the site"]'); await p.waitForTimeout(300);
const addr = await p.inputValue('.tf-share-line input');
console.log('title:', await p.$eval('.tf-panel-title', e => e.textContent), '| address:', addr, '| no key in it:', !/edit=|test/.test(addr), '| QR drawn:', !!(await p.$('.tf-qr svg path')));
await p.click('.tf-share-line .tf-button'); await p.waitForTimeout(200);
console.log('Copy says:', await p.$eval('.tf-share-line .tf-button', e => e.textContent), '| clipboard:', await p.evaluate(() => navigator.clipboard.readText()));
if (process.env.TF_SHOT) await (await p.$('.tf-panel')).screenshot({ path: process.env.TF_SHOT });
await p.keyboard.press('Escape'); await p.keyboard.press('Escape'); await p.waitForTimeout(200);
await p.keyboard.press('Meta+k'); await p.waitForTimeout(200); await p.keyboard.type('share'); await p.keyboard.press('Enter'); await p.waitForTimeout(400);
console.log('Cmd+K share opens:', await p.$eval('.tf-panel-title', e => e.textContent).catch(() => 'nothing'));
await b.close();
