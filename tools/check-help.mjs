/* Help: a ? in the Site sheet's head opens it, Back returns to the pages; Cmd+K has Help too. Needs the repo served on TF_PORT (default 8787). */
const { chromium } = await import(process.env.TF_PLAYWRIGHT || new URL('../node_modules/playwright-core/index.mjs', import.meta.url).pathname);
const PORT = process.env.TF_PORT || 8787;
const b = await chromium.launch({ executablePath: process.env.TF_CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
const p = await b.newPage({ viewport: { width: 1100, height: 900 } });
p.on('pageerror', e => console.log('PAGEERROR', e.message));
await p.goto('http://127.0.0.1:' + PORT + '/demo/index.html?v=' + Date.now() + '#edit=test'); await p.waitForTimeout(500);
await p.click('.tf-button:has-text("Got it")').catch(() => {});
await p.click('.tf-bar .tf-button:has-text("Site")'); await p.waitForTimeout(300);
console.log('head buttons:', await p.$$eval('.tf-sheet-head button', bs => bs.map(x => x.getAttribute('aria-label')).join(',')));
await p.click('.tf-sheet-head button[aria-label="Help"]'); await p.waitForTimeout(400);
console.log('help title:', await p.$eval('.tf-panel-title', e => e.textContent), '| sections:', await p.$$eval('.tf-panel .tf-caption', cs => cs.map(c => c.textContent).join(', ')));
if (process.env.TF_SHOT) await p.screenshot({ path: process.env.TF_SHOT });
await p.click('.tf-sheet-head button[aria-label="Back"]'); await p.waitForTimeout(300);
console.log('back to:', await p.$eval('.tf-panel-title', e => e.textContent));
await p.keyboard.press('Escape'); await p.waitForTimeout(200);
await p.keyboard.press('Meta+k'); await p.waitForTimeout(200); await p.keyboard.type('help'); await p.keyboard.press('Enter'); await p.waitForTimeout(400);
console.log('Cmd+K help opens:', await p.$eval('.tf-panel-title', e => e.textContent).catch(() => 'nothing'));
await b.close();
