/* The tightening pass: Undo you can trust after Redo, menus all or nothing, links and paste that keep the page whole,
   the last item kept, Esc back from the palette, files that hold their pictures, a readers' tab without the editor.
   Needs the repo on 8787 and tools/fake-save-server.py on 8788 (fresh). */
const { chromium } = await import(process.env.TF_PLAYWRIGHT || new URL('../node_modules/playwright-core/index.mjs', import.meta.url).pathname);
const b = await chromium.launch({ executablePath: process.env.TF_CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
const ctx = await b.newContext({ viewport: { width: 1100, height: 900 } });
const p = await ctx.newPage();
p.on('pageerror', e => console.log('PAGEERROR', e.message));
const pickBlock = async (page, sel) => { /* a click on the block itself, off its words and pictures: selected, its toolbar up */
  const at = await page.$eval(sel, e => { const b = e.getBoundingClientRect(), pr = window.__tweakfastProbe, tries = [[b.width - 6, b.height - 6], [b.width - 6, 6], [6, b.height - 6], [b.width / 2, b.height - 4], [b.width - 4, b.height / 2], [b.width / 2, 4]];
    for (const [x, y] of tries) { const hit = document.elementFromPoint(b.left + x, b.top + y); if (hit && e.contains(hit) && !pr.textTarget(hit) && !pr.pictureTarget(hit) && !hit.closest('a[href],button,.tf-plus,[data-tweakfast]') && (pr.blockTarget(hit) || e) === e) return { x, y }; }
    return { x: b.width - 6, y: b.height - 6 }; });
  await page.click(sel, { position: at }); await page.waitForTimeout(150);
  if (await page.$eval('.tf-edit-box', e => getComputedStyle(e).display === 'block').catch(() => false)) { await page.keyboard.press('Escape'); await page.waitForTimeout(120); } }; /* a block covered by its picture or words: the click took those; Esc steps out to the block */
p.on('dialog', d => d.accept());
await p.addInitScript(() => { /* how many page listeners are bound: must not grow */
  window.__L = 0; const o = EventTarget.prototype.addEventListener;
  EventTarget.prototype.addEventListener = function (t, f, x) { if (t === 'mouseover' && this === document) window.__L++; return o.call(this, t, f, x); };
});
const edit = async (sel, o) => { await p.click(sel, o); await p.waitForTimeout(60); await p.click(sel, o); }; /* one click picks, the second edits */
const act = async (row, word) => { await p.hover(row); await p.click(row + ' button[aria-label="More"]'); await p.click('.tf-menu button:has-text("' + word + '")'); };
const say = () => p.textContent('.tf-status');
const count = () => p.$eval('.tf-count', c => c.style.visibility === 'hidden' ? '0' : c.textContent);
const order = () => p.$$eval('main > section', s => s.map(e => (e.querySelector('h1,h2') || e).textContent.trim().split(' ').slice(0, 2).join(' ')).join(' | '));
const S = 'http://127.0.0.1:8788/demo/';

/* 1 Undo after Redo takes back what it says; nothing is bound twice; the site's own listeners live on */
await p.goto(S + 'index.html#edit=test'); await p.waitForTimeout(500);
await p.evaluate(() => document.querySelector('header').addEventListener('click', () => { window.__site = (window.__site || 0) + 1; }));
const first = await order();
await pickBlock(p, 'main > section:nth-of-type(1)');
await p.click('.tf-tools button[aria-label="Move down"]'); await p.waitForTimeout(200);
await p.click('.tf-tools button[aria-label="Copy"]'); await p.waitForTimeout(200);
await p.keyboard.press('Escape');
for (const k of ['Meta+z', 'Meta+Shift+z', 'Meta+z', 'Meta+z']) { await p.keyboard.press(k); await p.waitForTimeout(200); }
console.log('undo after redo: back to the start:', await order() === first, '| count', await count(), '| hover listeners', await p.evaluate(() => window.__L));
await p.evaluate(() => document.querySelector('header').click());
console.log('the site\'s own listener still hears:', await p.evaluate(() => window.__site === 1));

/* 2 paste of several lines: line breaks, not blocks inside the paragraph */
await edit('main section:nth-of-type(2) p');
await p.evaluate(() => { const dt = new DataTransfer(); dt.setData('text/plain', 'one\ntwo\n\nfour'); document.activeElement.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true })); });
await p.keyboard.press('Enter'); await p.waitForTimeout(100);
const para = await p.$eval('main section:nth-of-type(2) p', e => e.innerHTML);
console.log('paste: no block inside:', !/<div|<p/i.test(para), '| line breaks:', (para.match(/<br>/g) || []).length >= 3);
await p.keyboard.press('Escape'); await p.keyboard.press('Meta+z'); await p.waitForTimeout(100);

/* 3 Goes-to: a page by its name, a shop's page, a phone; Esc puts the address back with the words */
const href = () => p.$eval('main a.button', a => a.getAttribute('href'));
const goTo = async v => { await edit('main a.button'); await p.waitForTimeout(150); await p.fill('.tf-link input', v); await p.keyboard.press('Enter'); await p.waitForTimeout(150); await p.keyboard.press('Escape'); return href(); };
console.log('"About" goes to:', await goTo('About'), '| shop page:', await goTo('www.shop.com/menu.html'), '| phone:', await goTo('+49 30 1234567'));
const before = await count(), was = await href();
await edit('main a.button'); await p.waitForTimeout(150);
await p.fill('.tf-link input', 'contact.html'); await p.keyboard.press('Shift+Tab'); await p.waitForTimeout(100);
await p.keyboard.press('Escape'); await p.waitForTimeout(150);
console.log('Esc puts the address back:', await href() === was, '| count unchanged:', await count() === before);
await p.keyboard.press('Meta+z'); await p.waitForTimeout(150);
console.log('one Undo for words and address:', await href());

/* 4 Tab from the last text keeps the place; Done can be pressed while the first change is typed */
await p.goto(S + 'about.html#edit=test'); await p.waitForTimeout(500);
await edit('footer p'); await p.keyboard.press('Tab'); await p.waitForTimeout(100);
console.log('Tab at the end: the block stays selected:', await p.$eval('.tf-block-box', e => getComputedStyle(e).display === 'block'), '| typing over:', await p.$$eval('[contenteditable]', e => e.length) === 0);
await p.keyboard.press('Escape');
await edit('main h1'); await p.keyboard.type('x');
console.log('Done while the first change is typed:', !(await p.locator('.tf-button:has-text("Done")').isDisabled()));
await p.keyboard.press('Escape');

/* 5 the last of a group stays: the plus makes more from it */
await p.goto(S + 'events.html#edit=test'); await p.waitForTimeout(500);
for (let i = 0; i < 3; i++) { await pickBlock(p, '.card >> nth=0'); await p.click('.tf-tools button[aria-label="Remove"]'); await p.waitForTimeout(150); }
console.log('last card kept:', await p.$$eval('.card', c => c.length), '|', await say());

/* 6 pages: a rename to a name in use is refused; Add a page is one Undo; a file outside the menu is never written over */
await p.goto(S + 'index.html#edit=test'); await p.waitForTimeout(500);
if (!(await p.$('.tf-panel:not(.tf-pal):not(.tf-out)'))) { await p.click('.tf-pages'); await p.waitForTimeout(150); }
await act('.tf-row:has-text("About")', 'Rename'); await p.keyboard.press('Meta+a'); await p.keyboard.type('events'); await p.keyboard.press('Enter'); await p.waitForTimeout(300);
console.log('rename to a name in use:', await say(), '| About still there:', await p.locator('.tf-row:has-text("About")').count());
await p.click('.tf-sheet-head button[aria-label="Add a page"]'); await p.selectOption('.tf-select', 'events.html');
await p.fill('.tf-add .tf-input', 'Plant list'); await p.click('.tf-add button:has-text("Add")'); await p.waitForTimeout(800);
console.log('added: count', await count(), '| in the menu:', await p.locator('nav a:has-text("Plant list")').count());
await p.keyboard.press('Meta+z'); await p.waitForTimeout(300);
console.log('one Undo takes link and page: count', await count(), '| in the menu:', await p.locator('nav a:has-text("Plant list")').count());
await p.route('**/demo/rules.html', r => r.fulfill({ status: 200, contentType: 'text/html', body: '<p>rules</p>' }));
await p.click('.tf-sheet-head button[aria-label="Add a page"]'); await p.selectOption('.tf-select', 'events.html');
await p.fill('.tf-add .tf-input', 'Rules'); await p.click('.tf-add button:has-text("Add")'); await p.waitForTimeout(500);
console.log('a file outside the menu:', await say(), '| count', await count());

/* 7 Esc from the palette goes back to the sheet */
if (!(await p.locator('.tf-panel:not(.tf-pal):not(.tf-out)').count())) { if (!(await p.$('.tf-panel:not(.tf-pal):not(.tf-out)'))) { await p.click('.tf-pages'); await p.waitForTimeout(150); } }
await p.keyboard.press('Meta+k'); await p.waitForTimeout(300); await p.keyboard.press('Escape'); await p.waitForTimeout(300);
console.log('Esc from the palette: sheet back:', await p.locator('.tf-panel:not(.tf-pal):not(.tf-out)').count() === 1, '| focus in it:', await p.evaluate(() => !!document.activeElement.closest('.tf-panel')));
await p.waitForTimeout(300);

/* 8 the count follows Words for Google on another page */
await act('.tf-row:has-text("About")', 'Words for Google'); await p.waitForTimeout(600);
await p.fill('.tf-words textarea', 'Who we are.'); await p.keyboard.press('Enter'); await p.waitForTimeout(300);
console.log('count after words on another page:', await count());

/* 9 See the page: the readers' page, no editor in that tab */
await p.click('.tf-button:has-text("Done")'); await p.waitForFunction(() => /Live/.test(document.querySelector('.tf-status').textContent));
const [tab] = await Promise.all([ctx.waitForEvent('page'), p.click('.tf-offer:has-text("See the page")')]);
await tab.waitForLoadState(); await tab.waitForTimeout(400);
console.log('readers\' tab: editor bar:', await tab.locator('.tf-bar').count(), '| title:', await tab.title());
await tab.close();

/* 10 no saving route: files keep their new pictures inside, and the sentence is true */
await p.goto('http://127.0.0.1:8787/demo/index.html#edit=test'); await p.waitForTimeout(500);
await p.click('.hero img'); await p.waitForTimeout(100);
const [chooser] = await Promise.all([p.waitForEvent('filechooser'), p.click('.hero img')]);
await chooser.setFiles(new URL('pic.png', import.meta.url).pathname);
await p.waitForFunction(() => document.querySelector('.hero img').src.startsWith('data:'));
await p.keyboard.press('Escape');
await p.evaluate(() => { window._blob = null; const c = URL.createObjectURL; URL.createObjectURL = b => { window._blob = b; return c(b); }; });
await p.click('.tf-button:has-text("Done")'); await p.waitForTimeout(500);
const file = await p.evaluate(() => window._blob ? window._blob.text() : '');
console.log('file holds its picture:', /src="data:image\/png;base64,/.test(file), '| no missing picture file:', !/pictures\/tf-/.test(file), '|', await say());
await b.close();
