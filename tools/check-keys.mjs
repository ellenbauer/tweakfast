/* The keyboard: Tab from a picked text (a click types, Esc keeps it picked) goes into its tools; the Site sheet takes focus and gives it back to Site;
   a menu closed with Esc gives focus back to its button; a redraw keeps focus where it was; focus rings show.
   Needs the repo served on TF_PORT (default 8787). */
const { chromium } = await import(process.env.TF_PLAYWRIGHT || new URL('../node_modules/playwright-core/index.mjs', import.meta.url).pathname);
const PORT = process.env.TF_PORT || 8787;
const b = await chromium.launch({ executablePath: process.env.TF_CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
const p = await b.newPage({ viewport: { width: 1100, height: 800 } });
p.on('pageerror', e => console.log('PAGEERROR', e.message));
const pickBlock = async (page, sel) => { /* a click on the block itself, off its words and pictures: selected, its toolbar up */
  const at = await page.$eval(sel, e => { const b = e.getBoundingClientRect(), pr = window.__tweakfastProbe, tries = [[b.width - 6, b.height - 6], [b.width - 6, 6], [6, b.height - 6], [b.width / 2, b.height - 4], [b.width - 4, b.height / 2], [b.width / 2, 4]];
    for (const [x, y] of tries) { const hit = document.elementFromPoint(b.left + x, b.top + y); if (hit && e.contains(hit) && !pr.textTarget(hit) && !pr.pictureTarget(hit) && !hit.closest('a[href],button,.tf-plus,[data-tweakfast]') && (pr.blockTarget(hit) || e) === e) return { x, y }; }
    return { x: b.width - 6, y: b.height - 6 }; });
  await page.click(sel, { position: at }); await page.waitForTimeout(150);
  if (await page.$eval('.tf-edit-box', e => getComputedStyle(e).display === 'block').catch(() => false)) { await page.keyboard.press('Escape'); await page.waitForTimeout(120); } }; /* a block covered by its picture or words: the click took those; Esc steps out to the block */
const focus = () => p.evaluate(() => { const a = document.activeElement; return a === document.body ? 'body' : (a.closest('.tf-tools') ? 'tools:' : a.closest('.tf-panel') ? 'sheet:' : a.closest('.tf-menu') ? 'menu:' : a.closest('.tf-bar') ? 'bar:' : '?:') + (a.getAttribute('aria-label') || a.textContent.trim()); });
const ring = () => p.evaluate(() => { const s = getComputedStyle(document.activeElement); return s.outlineStyle !== 'none' && s.outlineWidth !== '0px' || /inset/.test(s.boxShadow); });
await p.goto('http://127.0.0.1:' + PORT + '/demo/index.html?v=' + Date.now() + '#edit=test'); await p.waitForTimeout(500);
await p.click('.tf-button:has-text("Got it")').catch(() => {});
await p.click('section:nth-of-type(2) h2'); await p.waitForTimeout(200);
await p.keyboard.press('Escape'); await p.waitForTimeout(100); /* typing ends, the text stays picked */
await p.keyboard.press('Tab'); console.log('Tab from a picked text:', await focus(), '| ring', await ring());
await p.keyboard.press('Tab'); console.log('Tab again:', await focus());
await p.keyboard.press('Escape'); await p.keyboard.press('Escape');
await p.focus('.tf-bar .tf-pages'); await p.keyboard.press('Enter'); await p.waitForTimeout(250); /* the Pages sheet, by keyboard: Enter on the page button */
console.log('Site opened by keyboard, focus:', await focus(), '| ring', await ring());
for (let i = 0; i < 8 && (await focus()) !== 'sheet:More'; i++) await p.keyboard.press('Tab'); console.log('Tab into a row:', await focus());
await p.keyboard.press('Enter'); await p.waitForTimeout(150); console.log('More opened, focus:', await focus(), '| ring', await ring());
await p.keyboard.press('Escape'); await p.waitForTimeout(250); console.log('Esc closes menu, focus back:', await focus());
await p.keyboard.press('Escape'); await p.waitForTimeout(250); console.log('Esc closes sheet, focus:', await focus());
/* a selected block takes the keys: arrows move it, Cmd+D copies it, Backspace removes it; Undo takes each back */
await p.keyboard.press('Escape'); await p.keyboard.press('Escape'); await p.goto('http://127.0.0.1:8788/demo/events.html?v=' + Date.now() + '#edit=test'); await p.waitForTimeout(500); await p.click('.tf-button:has-text("Got it")').catch(() => {});
const order = () => p.$$eval('.cards > *', es => es.filter(n => !n.classList.contains('tf-plus')).map(n => n.querySelector('h3').textContent.split(' ')[0]).join(','));
const was = await order(); await pickBlock(p, '.card:nth-child(1)');
await p.keyboard.press('ArrowRight'); await p.waitForTimeout(200); console.log('arrow moves the selected card:', (await order()) !== was, '|', await order());
await p.keyboard.press('Meta+d'); await p.waitForTimeout(300); console.log('Cmd+D copies it:', (await order()).split(',').length === was.split(',').length + 1);
await p.keyboard.press('Backspace'); await p.waitForTimeout(200); console.log('Backspace removes the copy:', (await order()).split(',').length === was.split(',').length, '| tools gone', await p.$eval('.tf-tools', t => getComputedStyle(t).display === 'none'));
for (let i = 0; i < 3; i++) { await p.keyboard.press('Meta+z'); await p.waitForTimeout(150); } console.log('three Undos put it all back:', (await order()) === was);
await b.close();
