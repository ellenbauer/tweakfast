/* The last row of the page: the link bubble stays in the window, the page gets no white strip, no sideways scroll, words come out from under the bar. Serve the repo on 8787 first. */
const { chromium } = await import(process.env.TF_PLAYWRIGHT || new URL('../node_modules/playwright-core/index.mjs', import.meta.url).pathname);
const b = await chromium.launch({ executablePath: process.env.TF_CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
const p = await b.newPage({ viewport: { width: 1100, height: 700 } });
p.on('pageerror', e => console.log('PAGEERROR', e.message));
const edit = async (sel, o) => { await p.click(sel, o); await p.waitForTimeout(60); await p.click(sel, o); }; /* one click picks, the second edits */
await p.goto('http://127.0.0.1:8787/tools/check-footer.html#edit=test'); await p.waitForTimeout(400);
const sideways = () => p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
const docH = () => p.evaluate(() => document.documentElement.scrollHeight);
const h0 = await docH();
await p.evaluate(() => window.scrollTo(0, 1e6)); await p.waitForTimeout(100);
await p.hover('.row', { position: { x: 20, y: 10 } }); await p.waitForTimeout(100);
console.log('hover full-width row: sideways scroll', await sideways(), '(want 0)');
await edit('.row a'); await p.waitForTimeout(500);
await p.evaluate(() => { var a = document.querySelector('.row a'), rg = document.createRange(); rg.selectNodeContents(a); var s = getSelection(); s.removeAllRanges(); s.addRange(rg); }); await p.waitForTimeout(300);
const link = await p.$eval('.tf-link', e => e.getBoundingClientRect().toJSON());
const barTop = await p.$eval('.tf-bar', e => e.getBoundingClientRect().top);
const words = await p.$eval('.row a', e => e.getBoundingClientRect().toJSON());
console.log('link bubble: top', Math.round(link.top), 'bottom', Math.round(link.bottom), '| window', 700, '| bar top', Math.round(barTop), '| words top', Math.round(words.top), '(bubble whole and clear of the bar: want bottom <=', Math.round(barTop) - 8, 'or above the words)');
console.log('bubble inside window:', link.top >= 0 && link.bottom <= 700, '| clear of bar:', link.bottom <= barTop - 8 || link.top >= barTop, '| no sideways:', (await sideways()) === 0);
console.log('words above the bar:', words.bottom <= barTop - 8, '| room under the page:', await p.$eval('body > [data-tweakfront], body > div[data-tweakfast][aria-hidden]', e => e.offsetHeight + 'px ' + getComputedStyle(e).backgroundColor).catch(() => 'none'));
await p.keyboard.press('Escape'); await p.waitForTimeout(300); await p.evaluate(() => window.scrollTo(0, 1e6)); await edit('.row span:first-child'); await p.waitForTimeout(500);
const mid = await p.$eval('.row span:nth-child(2)', e => e.getBoundingClientRect().toJSON());
console.log('editing the row again:', await p.$$eval('[contenteditable]', e => e.length), '| middle words above the bar:', mid.bottom <= (await p.$eval('.tf-bar', e => e.getBoundingClientRect().top)) - 8);
await p.keyboard.press('Escape'); await p.keyboard.press('Escape'); await p.waitForTimeout(300); /* out of the typing, then off the picked text */
console.log('after the edit: room', await p.$eval('body > div[data-tweakfast][aria-hidden]', e => e.offsetHeight), '| page height back to', await docH(), '(was', h0 + ')');
await b.close();
