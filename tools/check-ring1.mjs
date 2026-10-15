/* needs playwright-core: `npm install playwright-core` in the repo, or TF_PLAYWRIGHT=<path to its index.mjs>; TF_CHROME overrides the browser */
const { chromium } = await import(process.env.TF_PLAYWRIGHT || new URL('../node_modules/playwright-core/index.mjs', import.meta.url).pathname);
const b = await chromium.launch({ executablePath: process.env.TF_CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
const p = await b.newPage({ viewport: { width: 1100, height: 800 }, acceptDownloads: true });
p.on('pageerror', e => console.log('PAGEERROR', e.message));
const edit = async (sel, o) => { await p.click(sel, o); await p.waitForTimeout(60); await p.click(sel, o); }; /* one click picks, the second edits */
p.on('console', m => { if (m.type() === 'error') console.log('console error:', m.text()); });
await p.goto('http://127.0.0.1:8787/demo/index.html#edit=test');
console.log('bar:', await p.locator('.tf-bar').count(), 'hash kept for a bookmark:', await p.evaluate(() => location.hash), 'stored:', await p.evaluate(() => localStorage.getItem('tweakfast:key')), '| first visit says:', (await p.textContent('.tf-status')).slice(0, 40));
console.log('undo disabled at start:', await p.locator('.tf-button', { hasText: 'Undo' }).isDisabled());
// 1 edit the h1
await edit('h1');
console.log('editing h1:', await p.evaluate(() => document.activeElement.tagName + ' ' + document.activeElement.getAttribute('contenteditable')));
await p.evaluate(() => { const r = document.createRange(); r.selectNodeContents(document.activeElement); r.collapse(false); const s = getSelection(); s.removeAllRanges(); s.addRange(r); }); await p.keyboard.type(" and friends"); await p.keyboard.press('Enter');
console.log('h1 after:', await p.textContent('h1'), '| undo enabled:', !(await p.locator('.tf-button', { hasText: 'Undo' }).isDisabled()));
// 2 click a button that a paragraph only holds -> edits the button's own words, no navigation
await edit('section:nth-of-type(2) p a.button');
console.log('link click edits:', await p.evaluate(() => document.activeElement.tagName), 'url still index:', p.url().endsWith('index.html'));
await p.keyboard.press('Escape');
// 3 nav stays a link (pinned)
console.log('nav pinned, goes, the change comes along:', await (async () => { await p.click('nav a[href="about.html"]'); await p.waitForURL(/about\.html/); await p.waitForTimeout(400); return p.url().replace(/^.*\//, '') + ' | count ' + await p.$eval('.tf-count', e => e.textContent) + ' | quiet: ' + !(await p.textContent('.tf-status')).includes('came back'); })());
p.on('dialog', d => d.accept()); /* the plain address below leaves with that change unsaved */
await p.goto('http://127.0.0.1:8787/demo/index.html');
console.log('bar on plain link (stored key):', await p.locator('.tf-bar').count());
// 4 picture swap through the file chooser
await p.click('.hero img'); await p.waitForTimeout(100); /* first click picks */
const [chooser] = await Promise.all([p.waitForEvent('filechooser'), p.click('.hero img')]);
await chooser.setFiles(new URL('pic.png', import.meta.url).pathname);
await p.waitForFunction(() => document.querySelector('.hero img').src.startsWith('data:'));
console.log('picture swapped:', await p.evaluate(() => { const i = document.querySelector('.hero img'); return i.src.slice(0, 22) + ' fit=' + i.style.objectFit + ' ratio=' + i.style.aspectRatio; }));
// 5 undo puts the old picture back
await p.click('.tf-button:has-text("Undo")');
console.log('after undo src:', await p.evaluate(() => document.querySelector('.hero img').getAttribute('src')), 'style:', await p.evaluate(() => document.querySelector('.hero img').getAttribute('style')));
// 6 edit text then Done downloads clean HTML
await edit('h2'); await p.keyboard.press('End'); await p.keyboard.type(' (October)'); await p.keyboard.press('Enter');
await p.evaluate(() => { window._blob = null; const c = URL.createObjectURL; URL.createObjectURL = b => { window._blob = b; return c(b); }; });
await p.click('.tf-button:has-text("Done")');
const html = await p.evaluate(() => window._blob ? window._blob.text() : null);
console.log('blob bytes:', html && html.length, 'clean:', html && !/\btf-|contenteditable|data-tweakfast|style=""/.test(html), 'has edit:', html && html.includes('This month (October)'), 'script kept:', html && html.includes('tweakfast.js'));
console.log('status:', await p.textContent('.tf-status'), '| undo disabled:', await p.locator('.tf-button', { hasText: 'Undo' }).isDisabled());
await p.screenshot({ path: '/tmp/tweakfast-ring1.png' });
await b.close();
