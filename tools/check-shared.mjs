/* Shared parts: header (with the menu) and footer edit like anywhere; a change is made on every page. Serve the repo on 8787 first. */
const { chromium } = await import(process.env.TF_PLAYWRIGHT || new URL('../node_modules/playwright-core/index.mjs', import.meta.url).pathname);
const b = await chromium.launch({ executablePath: process.env.TF_CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
const p = await b.newPage({ viewport: { width: 1100, height: 800 } });
p.on('pageerror', e => console.log('PAGEERROR', e.message));
const pickBlock = async (page, sel) => { /* a click on the block itself, off its words and pictures: selected, its toolbar up */
  const at = await page.$eval(sel, e => { const b = e.getBoundingClientRect(), pr = window.__tweakfastProbe, tries = [[b.width - 6, b.height - 6], [b.width - 6, 6], [6, b.height - 6], [b.width / 2, b.height - 4], [b.width - 4, b.height / 2], [b.width / 2, 4]];
    for (const [x, y] of tries) { const hit = document.elementFromPoint(b.left + x, b.top + y); if (hit && e.contains(hit) && !pr.textTarget(hit) && !pr.pictureTarget(hit) && !hit.closest('a[href],button,.tf-plus,[data-tweakfast]') && (pr.blockTarget(hit) || e) === e) return { x, y }; }
    return { x: b.width - 6, y: b.height - 6 }; });
  await page.click(sel, { position: at }); await page.waitForTimeout(150);
  if (await page.$eval('.tf-edit-box', e => getComputedStyle(e).display === 'block').catch(() => false)) { await page.keyboard.press('Escape'); await page.waitForTimeout(120); } }; /* a block covered by its picture or words: the click took those; Esc steps out to the block */
const edit = async (sel, o) => { await p.click(sel, o); await p.waitForTimeout(60); await p.click(sel, o); }; /* one click picks, the second edits */
const status = () => p.$eval('.tf-status', s => s.classList.contains('tf-show') ? s.textContent.trim() : '');
/* Done without a saving route writes files: caught here to read what every page would get */
const captured = async () => { await p.evaluate(() => { window._blobs = {}; window._names = {}; const c = URL.createObjectURL; URL.createObjectURL = b => { const u = c(b); window._blobs[u] = b; return u; }; HTMLAnchorElement.prototype.click = function () { window._names[this.href] = this.download; }; }); await p.click('.tf-button:has-text("Done")'); await p.waitForTimeout(300); return p.evaluate(async () => { const out = {}; for (const u in window._names) out[window._names[u]] = await window._blobs[u].text(); return out; }); };
await p.goto('http://127.0.0.1:8787/demo/index.html#edit=test'); await p.waitForTimeout(400);
await edit('footer p'); await p.waitForTimeout(100);
console.log('footer text edits:', !!(await p.$('footer p[contenteditable]')), '| said:', await status());
await p.keyboard.press('End'); await p.keyboard.type(' Everyone welcome.'); await p.keyboard.press('Enter'); await p.waitForTimeout(900);
console.log('count after one footer edit:', await p.$eval('.tf-count', c => c.textContent));
await p.click('.tf-button:has-text("Undo")'); await p.waitForTimeout(100);
console.log('one Undo takes it back:', await p.$eval('footer p', e => !/Everyone welcome/.test(e.textContent)), '| count hidden:', await p.$eval('.tf-count', c => c.style.visibility === 'hidden'));
await p.keyboard.press('Shift+Meta+z'); await p.waitForTimeout(900);
await edit('header .logo'); await p.waitForTimeout(100);
console.log('text logo edits:', await p.evaluate(() => { const e = document.querySelector('[contenteditable]'); return e ? e.className : 'none'; }), '| no navigation:', /index\.html/.test(p.url()));
await p.keyboard.press('Meta+ArrowDown'); await p.keyboard.type('!'); await p.keyboard.press('Enter'); await p.waitForTimeout(900);
const files = await captured();
console.log('Done writes every page:', Object.keys(files).sort().join(','), '| footer line on every page:', Object.values(files).every(h => /Everyone welcome/.test(h)), '| logo on every page:', Object.values(files).every(h => /class="logo"[^>]*>Elm Street Garden Club!<\/a>/.test(h)));
await p.hover('nav a[href="about.html"]'); await p.waitForTimeout(100);
console.log('menu links stay the menu: no hover line', await p.evaluate(() => { const b = document.querySelector('.tf-hover-box'); return !b || getComputedStyle(b).display === 'none'; }));
await p.click('nav a[href="about.html"]'); await p.waitForLoadState(); await p.waitForTimeout(300);
console.log('a menu link still goes to its page:', /about\.html/.test(p.url()));
/* a page header that is not the site header is page content */
await p.goto('http://127.0.0.1:8787/tools/check-menu.html#edit=test'); await p.waitForTimeout(300);
await edit('.page-head h1'); await p.waitForTimeout(100);
console.log('a page-head title edits:', !!(await p.$('.page-head h1[contenteditable]')), '| no shared sentence:', !/every page/.test(await status()));
/* blocks in a footer: tools like anywhere; Hide is made on every page whose footer matches, the others are named */
await pickBlock(p, 'footer .col:nth-child(2)');
console.log('footer blocks have tools:', await p.evaluate(() => getComputedStyle(document.querySelector('.tf-tools')).display === 'flex'));
await p.click('.tf-tools button:has-text("Hide")', { force: true }); await p.waitForTimeout(900);
console.log('hidden here:', await p.$eval('footer .col:nth-child(2)', e => e.hasAttribute('data-tf-hidden')), '| other pages named:', await status());
await b.close();
