/* Versions: a version comes in as a change, Undo takes it back, Done makes it live. Needs tools/fake-save-server.py on 8788, freshly started. */
import fs from 'node:fs';
const { chromium } = await import(process.env.TF_PLAYWRIGHT || new URL('../node_modules/playwright-core/index.mjs', import.meta.url).pathname);
const LOG = (process.env.TMPDIR || '/tmp') + '/tweakfast-fake-save.json';
const b = await chromium.launch({ executablePath: process.env.TF_CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
const p = await b.newPage({ viewport: { width: 1100, height: 800 } });
p.on('pageerror', e => console.log('PAGEERROR', e.message)); p.on('dialog', d => { console.log('BROWSER DIALOG', d.message()); d.dismiss(); });
const edit = async (sel, o) => { await p.click(sel, o); await p.waitForTimeout(60); await p.click(sel, o); }; /* one click picks, the second edits */
const act = async (row, word) => { await p.hover(row); await p.click(row + ' button[aria-label="More"]'); await p.click('.tf-menu button:has-text("' + word + '")'); };
const status = () => p.$eval('.tf-status', s => s.textContent.trim());
const openSite = async () => { if (!(await p.$('.tf-panel'))) if (!(await p.$('.tf-panel:not(.tf-pal):not(.tf-out)'))) { await p.click('.tf-pages'); await p.waitForTimeout(150); } };
const count = () => p.$eval('.tf-count', c => c.style.visibility === 'hidden' ? 0 : +c.textContent);
await p.goto('http://127.0.0.1:8788/demo/events.html?v=' + Date.now() + '#edit=test'); await p.waitForTimeout(500);
const h1 = () => p.$eval('h1', e => e.textContent);
const original = /<h1[^>]*>([^<]*)<\/h1>/.exec(fs.readFileSync(new URL('../demo/events.html', import.meta.url).pathname, 'utf8'))[1]; /* from the file: other checks may have saved this page before */
await edit('h1'); await p.keyboard.press('End'); await p.keyboard.type(' V1'); await p.keyboard.press('Enter');
await p.click('.tf-button:has-text("Done")'); await p.waitForFunction(() => /Live/.test(document.querySelector('.tf-status').textContent)); await p.waitForTimeout(100);
await openSite(); await act('.tf-row:has-text("Events")', 'Versions'); await p.waitForTimeout(400);
console.log('versions listed:', await p.$$eval('.tf-versions .tf-row', rs => rs.map(r => (r.querySelector('.tf-row-tag') ? '[' : '') + r.querySelector('.tf-row-name').textContent.replace(/\d/g, '0') + (r.querySelector('.tf-row-tag') ? ']' : '')).join(' / ')));
await p.click('.tf-versions .tf-row:has-text("The original") button'); await p.waitForTimeout(500);
console.log('the original comes in as a change: h1', JSON.stringify(await h1()), '= original', (await h1()) === original, '| count', await count(), '| says:', await status());
console.log('no browser dialog, bar still there:', !!(await p.$('.tf-bar')), '| editor script kept:', await p.$$eval('script[src*="tweakfast"]', s => s.map(x => x.src.split('/').pop().split('?')[0]).sort().join()) === 'tweakfast-editor.js,tweakfast-mend.js,tweakfast.js', '| blocks marked again:', await p.$$eval('[data-tf-block]', e => e.length) > 0, '| plus there:', (await p.$$('.tf-plus')).length === 1);
await p.click('.tf-button:has-text("Undo")'); await p.waitForTimeout(100);
console.log('Undo takes it back: h1 has V1:', /V1$/.test(await h1()), '| count', await count());
await openSite(); await act('.tf-row:has-text("Events")', 'Versions'); await p.waitForTimeout(400);
await p.click('.tf-versions .tf-row:has-text("The original") button'); await p.waitForTimeout(500);
await p.click('.tf-button:has-text("Done")'); await p.waitForFunction(() => /Live/.test(document.querySelector('.tf-status').textContent)); await p.waitForTimeout(100);
const sent = JSON.parse(fs.readFileSync(LOG, 'utf8'));
console.log('Done makes it live: served h1 is the original:', new RegExp('<h1[^>]*>' + original.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '</h1>').test(sent.files['events.html']), '| clean:', !/data-tf-block|tf-plus|contenteditable/.test(sent.files['events.html']), '| script kept in the file:', /tweakfast\.js/.test(sent.files['events.html']));
/* another page: from About, a version of Events waits in the changes until Done; put back again once live, it is no change */
await p.goto('http://127.0.0.1:8788/demo/events.html?v=' + Date.now()); await p.waitForTimeout(500);
await edit('main h1'); await p.keyboard.press('Control+A'); await p.keyboard.press('Meta+A'); await p.keyboard.type('V2'); await p.keyboard.press('Enter'); await p.waitForTimeout(400);
await p.click('.tf-button:has-text("Done")'); await p.waitForFunction(() => /Live/.test(document.querySelector('.tf-status').textContent)); await p.waitForTimeout(100);
await p.goto('http://127.0.0.1:8788/demo/about.html?v=' + Date.now()); await p.waitForTimeout(500);
await openSite(); await act('.tf-row:has-text("Events")', 'Versions'); await p.waitForTimeout(400);
await p.click('.tf-versions .tf-row:has-text("The original") button'); await p.waitForTimeout(500);
console.log('another page: says:', await status(), '| count', await count(), '| this page untouched:', /About/.test(await h1()));
await p.click('.tf-button:has-text("Done")'); await p.waitForFunction(() => /Live/.test(document.querySelector('.tf-status').textContent)); await p.waitForTimeout(100);
const sent2 = JSON.parse(fs.readFileSync(LOG, 'utf8'));
console.log('Done wrote it:', Object.keys(sent2.files).join(', '));
await openSite(); await act('.tf-row:has-text("Events")', 'Versions'); await p.waitForTimeout(400);
await p.click('.tf-versions .tf-row:has-text("The original") button'); await p.waitForTimeout(500);
console.log('another page, the original it already is: says:', await status(), '| count', await count());
/* a page the owner added has no original: it can be removed, out of the menu now, gone for good at Done */
await openSite(); await p.click('.tf-sheet-head button[aria-label="Add a page"]'); await p.selectOption('.tf-select', 'events.html'); await p.fill('.tf-add .tf-input', 'Zed'); await p.click('.tf-add button:has-text("Add")');
await p.waitForFunction(() => /Page added/.test(document.querySelector('.tf-status').textContent));
await p.click('.tf-button:has-text("Done")'); await p.waitForFunction(() => /Live/.test(document.querySelector('.tf-status').textContent)); await p.waitForTimeout(100);
console.log('Zed saved:', (await fetch('http://127.0.0.1:8788/demo/zed.html')).status === 200);
await openSite(); await act('.tf-row:has-text("Zed")', 'Versions'); await p.waitForTimeout(400);
console.log('an added page offers:', await p.$$eval('.tf-versions .tf-row', rs => rs.map(r => r.querySelector('.tf-row-name').textContent.replace(/\d/g, '0')).join(' / ')));
await p.click('.tf-sheet-head button[aria-label="Back"]'); await p.waitForTimeout(100);
await act('.tf-row:has-text("Zed")', 'Remove the page'); await p.waitForFunction(() => /out of the menu|Could not/.test(document.querySelector('.tf-status').textContent)); await p.waitForTimeout(200);
console.log('removed:', await status(), '| Zed out of this menu:', !(await p.$('nav a[href="zed.html"]')), '| count', await count());
await p.click('.tf-button:has-text("Undo")'); await p.waitForTimeout(100);
console.log('Undo brings it back:', !!(await p.$('nav a[href="zed.html"]')));
await openSite(); await act('.tf-row:has-text("Zed")', 'Remove the page'); await p.waitForFunction(() => /out of the menu/.test(document.querySelector('.tf-status').textContent)); await p.waitForTimeout(200);
await p.click('.tf-button:has-text("Done")'); await p.waitForFunction(() => /Live/.test(document.querySelector('.tf-status').textContent)); await p.waitForTimeout(100);
console.log('Done took it away:', (await fetch('http://127.0.0.1:8788/demo/zed.html')).status === 404, '| menus saved without it:', !/zed\.html/.test(JSON.parse(fs.readFileSync(LOG, 'utf8')).files['about.html'] || 'zed.html'));
/* an original page (the maker shipped it) can go too: out of the menu, not served after Done; Home has no Remove */
await openSite();
const offers = async (row) => { await p.hover(row); await p.click(row + ' button[aria-label="More"]'); const w = await p.$$eval('.tf-menu button', bs => bs.map(x => x.textContent)); await p.keyboard.press('Escape'); return w; };
console.log('Home has no Remove:', !(await offers('.tf-row[data-path="index.html"]')).includes('Remove the page'), '| Events has:', (await offers('.tf-row[data-path="events.html"]')).includes('Remove the page'));
await act('.tf-row:has-text("Events")', 'Remove the page'); await p.waitForFunction(() => /out of the menu|Could not/.test(document.querySelector('.tf-status').textContent)); await p.waitForTimeout(200);
await p.click('.tf-button:has-text("Done")'); await p.waitForFunction(() => /Live/.test(document.querySelector('.tf-status').textContent)); await p.waitForTimeout(100);
console.log('original removed: not served:', (await fetch('http://127.0.0.1:8788/demo/events.html')).status === 404, '| out of the saved menu:', !/events\.html/.test(JSON.parse(fs.readFileSync(LOG, 'utf8')).files['about.html'] || 'events.html'));
await b.close();
