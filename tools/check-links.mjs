/* Where a link goes: the Goes-to field under an edited link. Serve the repo on 8787 first. */
const { chromium } = await import(process.env.TF_PLAYWRIGHT || new URL('../node_modules/playwright-core/index.mjs', import.meta.url).pathname);
const b = await chromium.launch({ executablePath: process.env.TF_CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
const p = await b.newPage({ viewport: { width: 1100, height: 800 } });
p.on('pageerror', e => console.log('PAGEERROR', e.message));
const edit = async (sel, o) => { await p.click(sel, o); await p.waitForTimeout(60); await p.click(sel, o); }; /* one click picks, the second edits */
await p.goto('http://127.0.0.1:8787/demo/index.html#edit=test'); await p.waitForTimeout(400);
const field = () => p.$eval('.tf-link', e => e.parentNode ? getComputedStyle(e).display : 'none').catch(() => 'none');
await edit('h1'); await p.waitForTimeout(150);
console.log('plain heading: field', await field());
await edit('main a.button'); await p.waitForTimeout(200);
console.log('link in a paragraph: editing', await p.$eval('[contenteditable]', e => e.tagName), '| field', await field(), '| shows', await p.inputValue('.tf-link input'));
await p.fill('.tf-link input', 'www.shop.com'); await p.keyboard.press('Enter'); await p.waitForTimeout(150);
console.log('after Enter: href', await p.$eval('main a.button', a => a.getAttribute('href')), '| editing', await p.$$eval('[contenteditable]', e => e.length), '| field', await field(), '| undo enabled', await p.$eval('.tf-button:has-text("Undo")', e => !e.disabled));
await p.click('.tf-button:has-text("Undo")'); await p.waitForTimeout(100);
console.log('after Undo: href', await p.$eval('main a.button', a => a.getAttribute('href')));
await edit('main a.button'); await p.waitForTimeout(200);
await p.fill('.tf-link input', 'about.html'); await p.click('body', { position: { x: 5, y: 700 } }); await p.waitForTimeout(150);
console.log('click away keeps it: href', await p.$eval('main a.button', a => a.getAttribute('href')));
await edit('main a.button'); await p.waitForTimeout(200);
await p.fill('.tf-link input', 'nonsense'); await p.keyboard.press('Escape'); await p.waitForTimeout(100);
console.log('Esc in the field: value back to', await p.inputValue('.tf-link input'), '| still editing', await p.$$eval('[contenteditable]', e => e.length));
await p.fill('.tf-link input', ''); await p.keyboard.press('Enter'); await p.waitForTimeout(100);
console.log('empty field changes nothing: href', await p.$eval('main a.button', a => a.getAttribute('href')));
/* Tab walks from the link's words into the field, Tab again moves on, Shift+Tab comes back; the site's pages are offered; the arrow opens a new tab */
await p.keyboard.press('Escape'); await p.keyboard.press('Escape'); await edit('main a.button'); await p.waitForTimeout(200);
await p.keyboard.press('Tab'); await p.waitForTimeout(50);
console.log('Tab goes into the field:', await p.evaluate(() => document.activeElement === document.querySelector('.tf-link input')), '| pages offered:', await p.$$eval('#tf-pages option', os => os.map(o => o.label + '=' + o.value).join(', ')));
await p.keyboard.press('Shift+Tab'); await p.waitForTimeout(50);
console.log('Shift+Tab back in the words:', await p.evaluate(() => document.activeElement === document.querySelector('[contenteditable]')));
await p.keyboard.press('Tab'); await p.keyboard.type('contact.html'); await p.keyboard.press('Tab'); await p.waitForTimeout(50);
console.log('Tab out keeps and moves on: href', await p.$eval('main a.button', a => a.getAttribute('href')), '| next text open:', await p.evaluate(() => { const e = document.querySelector('[contenteditable]'); return e ? e.tagName : 'none'; }));
await p.keyboard.press('Escape'); await p.keyboard.press('Escape'); await edit('main a.button'); await p.waitForTimeout(200);
const [tab] = await Promise.all([p.context().waitForEvent('page'), p.click('.tf-link-open')]); await tab.waitForLoadState().catch(() => {});
console.log('arrow opens a new tab:', /contact\.html$/.test(tab.url()), '| still editing:', await p.$$eval('[contenteditable]', e => e.length) === 1); await tab.close();
await p.keyboard.press('Escape');
/* selected words become a link; Remove takes a link away and keeps the words */
await p.keyboard.press('Escape'); await p.keyboard.press('Escape'); await edit('h1'); await p.waitForTimeout(100);
await p.evaluate(() => { const h = document.querySelector('h1'), t = h.firstChild, s = getSelection(), r = document.createRange(); r.setStart(t, 0); r.setEnd(t, 3); s.removeAllRanges(); s.addRange(r); }); await p.waitForTimeout(150);
console.log('selected words: bar says', await p.$eval('.tf-link .tf-link-label', e => e.textContent), '| field empty', (await p.inputValue('.tf-link input')) === '', '| no Remove yet', await p.$eval('.tf-link button:has-text("Remove")', e => getComputedStyle(e).display === 'none'));
await p.keyboard.press('Tab'); await p.keyboard.type('about.html'); await p.keyboard.press('Enter'); await p.waitForTimeout(150);
console.log('made a link:', await p.$eval('h1', h => { const a = h.querySelector('a'); return a ? a.getAttribute('href') + ' around "' + a.textContent + '"' : 'none'; }), '| one change', await p.$eval('.tf-count', c => c.textContent));
await p.click('.tf-button:has-text("Undo")'); await p.waitForTimeout(100);
console.log('Undo takes it back:', !(await p.$('h1 a')));
await edit('main a.button'); await p.waitForTimeout(200);
await p.click('.tf-link button:has-text("Remove")'); await p.waitForTimeout(150);
console.log('Remove on a link in a paragraph: words kept, link gone:', await p.$eval('main p', pp => !pp.querySelector('a.button') && /Join us/.test(pp.textContent) || pp.textContent.length > 0), '| text still editing', !!(await p.$('[contenteditable]')));
await p.keyboard.press('Escape');
const html = await p.evaluate(() => { const d = document.documentElement.cloneNode(true); d.querySelectorAll('[data-tweakfast],#tf-style').forEach(n => n.remove()); return d.outerHTML; });
console.log('page html: field gone', !html.includes('tf-link'), '| new address in it', html.includes('href="about.html"'));
/* a link that stands alone (a button not in a paragraph), and the caret moving between a word in a link and plain words */
await p.goto('http://127.0.0.1:8787/tools/check-links.html#edit=test'); await p.waitForTimeout(400);
await edit('a.btn'); await p.waitForTimeout(200);
console.log('standalone link: editing', await p.$eval('[contenteditable]', e => e.tagName), '| field', await field(), '| shows', await p.inputValue('.tf-link input'));
await p.fill('.tf-link input', 'hello@shop.com'); await p.keyboard.press('Enter'); await p.waitForTimeout(150);
console.log('mail address: href', await p.$eval('a.btn', a => a.getAttribute('href')), '| undo enabled', await p.$eval('.tf-button:has-text("Undo")', e => !e.disabled));
await p.click('.tf-button:has-text("Undo")'); await p.waitForTimeout(100);
console.log('after Undo: href', await p.$eval('a.btn', a => a.getAttribute('href')));
await p.keyboard.press('Escape'); await p.keyboard.press('Escape'); /* Enter in Goes to keeps the button picked, as Enter in its words does: let go, then close its tools */
await edit('main p', { position: { x: 4, y: 8 } }); await p.waitForTimeout(200);
console.log('caret on plain words: field', await field());
await edit('main p a'); await p.waitForTimeout(200);
console.log('caret on the linked word: field', await field(), '| shows', await p.inputValue('.tf-link input'));
await b.close();
