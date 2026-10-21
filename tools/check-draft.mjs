/* Nothing is lost: what is not live yet comes back after a reload or a closed tab, as one change, said so,
   with Throw away; Done, Undo to nothing, Leave anyway and Go anyway end it. Serve the repo on 8787 first. */
const { chromium } = await import(process.env.TF_PLAYWRIGHT || new URL('../node_modules/playwright-core/index.mjs', import.meta.url).pathname);
const b = await chromium.launch({ executablePath: process.env.TF_CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
const ctx = await b.newContext({ viewport: { width: 1100, height: 900 } });
let p = await ctx.newPage();
p.on('pageerror', e => console.log('PAGEERROR', e.message)); p.on('dialog', d => d.accept());
const edit = async (sel) => { await p.click(sel); await p.waitForTimeout(60); await p.click(sel); };
const U = 'http://127.0.0.1:8787/demo/index.html';
const h1 = async () => (await p.textContent('main h1')).replace(/\s+/g, ' ').trim();
const count = () => p.$eval('.tf-count', c => c.style.visibility === 'hidden' ? '0' : c.textContent);
const say = () => p.textContent('.tf-status');
const open = async (url) => { await p.goto(url); await p.waitForTimeout(600); };
await open(U + '#edit=test');
const original = await h1();
await edit('main h1'); await p.keyboard.type(' today'); await p.keyboard.press('Enter');
await edit('main section:nth-of-type(2) h2'); await p.keyboard.type(' too'); await p.keyboard.press('Enter'); await p.waitForTimeout(500);
const typed = await h1();
/* the tab closes, a new one opens the site */
await p.close(); p = await ctx.newPage(); p.on('pageerror', e => console.log('PAGEERROR', e.message)); p.on('dialog', d => d.accept());
await open(U);
console.log('after a closed tab: heading back:', await h1() === typed && typed !== original, '| count', await count(), '|', (await say()).replace(/\d+:\d+( [AP]M)?/, 'HH:MM'));
/* on a phone the words take the bubble's width and the button drops under them: never a column of single words */
await p.setViewportSize({ width: 390, height: 800 }); await p.waitForTimeout(200);
console.log('phone: words wide, button below:', await p.$eval('.tf-status', s => { const w = s.querySelector('.tf-status-text').getBoundingClientRect(), b = s.querySelector('.tf-offer').getBoundingClientRect(), r = s.getBoundingClientRect(); return w.width > r.width * .7 && b.top >= w.bottom - 2; }));
await p.screenshot({ path: process.env.TF_SHOT || '/dev/null' }).catch(() => {});
await p.setViewportSize({ width: 1100, height: 800 }); await p.waitForTimeout(200);
await p.click('.tf-offer:has-text("Throw away")'); await p.waitForTimeout(200);
console.log('Throw away: heading as served:', await h1() === original, '| count', await count());
await open(U); console.log('and gone for good: bubble:', JSON.stringify((await say()).trim()));
/* typing that was never kept still comes back */
await edit('main h1'); await p.keyboard.type(' mid'); await p.waitForTimeout(600);
const mid = await h1();
await open(U); console.log('mid-typing: back:', await h1() === mid && mid !== original, '| count', await count());
await p.keyboard.press('Meta+z'); await p.waitForTimeout(200);
await open(U); console.log('Undo to nothing ends it: heading', await h1() === original, '| count', await count());
/* a change on every page (a page hidden from the menu) comes back on another page too */
if (!(await p.$('.tf-panel:not(.tf-pal):not(.tf-out)'))) { await p.click('.tf-pages'); await p.waitForTimeout(150); } await p.hover('.tf-row:has-text("Contact")'); await p.click('.tf-row:has-text("Contact") button[aria-label="More"]'); await p.click('.tf-menu button:has-text("Hide from the menu")'); await p.waitForTimeout(800);
await open('http://127.0.0.1:8787/demo/about.html');
console.log('other pages too: Contact hidden here:', await p.$eval('nav a[href="contact.html"]', a => a.hidden), '| count', await count());
/* Done ends it */
await p.evaluate(() => { const c = URL.createObjectURL; URL.createObjectURL = x => c(x); });
await p.click('.tf-button:has-text("Done")'); await p.waitForTimeout(500);
await open(U); console.log('after Done: count', await count());
/* Leave anyway ends it */
await edit('main h1'); await p.keyboard.type(' x'); await p.keyboard.press('Enter');
await p.click('.tf-button:has-text("Leave")'); await p.click('.tf-offer:has-text("Leave anyway")'); await p.waitForTimeout(600);
await open(U + '#edit=test'); console.log('after Leave anyway: heading', await h1() === original, '| count', await count());
await b.close();
