/* The changes list: the count on Done opens it, newest first, each change named; Show goes to it; Undo on an older row takes back that one alone.
   Needs tools/fake-save-server.py on TF_PORT (default 8788). */
const { chromium } = await import(process.env.TF_PLAYWRIGHT || new URL('../node_modules/playwright-core/index.mjs', import.meta.url).pathname);
const PORT = process.env.TF_PORT || 8788;
const b = await chromium.launch({ executablePath: process.env.TF_CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
const p = await b.newPage({ viewport: { width: 1100, height: 800 } });
const pickBlock = async (page, sel) => { /* a click on the block itself, off its words and pictures: selected, its toolbar up */
  const at = await page.$eval(sel, e => { const b = e.getBoundingClientRect(), pr = window.__tweakfastProbe, tries = [[b.width - 6, b.height - 6], [b.width - 6, 6], [6, b.height - 6], [b.width / 2, b.height - 4], [b.width - 4, b.height / 2], [b.width / 2, 4]];
    for (const [x, y] of tries) { const hit = document.elementFromPoint(b.left + x, b.top + y); if (hit && e.contains(hit) && !pr.textTarget(hit) && !pr.pictureTarget(hit) && !hit.closest('a[href],button,.tf-plus,[data-tweakfast]') && (pr.blockTarget(hit) || e) === e) return { x, y }; }
    return { x: b.width - 6, y: b.height - 6 }; });
  await page.click(sel, { position: at }); await page.waitForTimeout(150);
  if (await page.$eval('.tf-edit-box', e => getComputedStyle(e).display === 'block').catch(() => false)) { await page.keyboard.press('Escape'); await page.waitForTimeout(120); } }; /* a block covered by its picture or words: the click took those; Esc steps out to the block */
p.on('pageerror', e => console.log('PAGEERROR', e.message)); p.on('dialog', d => { console.log('BROWSER DIALOG', d.message()); d.dismiss(); });
const edit = async (sel) => { await p.click(sel); await p.waitForTimeout(60); await p.click(sel); };
const rows = () => p.$$eval('.tf-changes .tf-row-name', rs => rs.map(r => r.textContent));
await p.goto('http://127.0.0.1:' + PORT + '/demo/index.html?v=' + Date.now() + '#edit=test'); await p.waitForTimeout(500);
await p.click('.tf-button:has-text("Got it")').catch(() => {});
await edit('h1'); await p.keyboard.press('Meta+ArrowRight'); await p.keyboard.type(' today'); await p.keyboard.press('Enter'); await p.waitForTimeout(100);
await edit('section:nth-of-type(2) h2'); await p.keyboard.press('Meta+ArrowRight'); await p.keyboard.type(' and next'); await p.keyboard.press('Enter'); await p.waitForTimeout(100);
await pickBlock(p, '.card:nth-child(1)'); await p.click('.tf-tools button[aria-label="Move right"]'); await p.waitForTimeout(400);
await p.click('.tf-count'); await p.waitForTimeout(200);
console.log('list open, Done not pressed:', !!(await p.$('.tf-changes')), '| count', await p.$eval('.tf-count', c => c.textContent));
console.log('rows newest first:', JSON.stringify(await rows()));
await p.click('.tf-count'); await p.waitForTimeout(250);
console.log('count again closes it:', !(await p.$('.tf-changes')));
await p.click('.tf-count'); await p.waitForTimeout(200);
await p.click('.tf-changes .tf-row:last-child button:has-text("Undo")'); await p.waitForTimeout(300);
console.log('oldest undone alone: h1 =', JSON.stringify(await p.$eval('h1', e => e.textContent)), '| h2 =', JSON.stringify(await p.$eval('section:nth-of-type(2) h2', e => e.textContent)), '| first card', JSON.stringify(await p.$eval('.card h3', e => e.textContent)), '| count', await p.$eval('.tf-count', c => c.textContent));
console.log('rows now:', JSON.stringify(await rows()));
await p.click('.tf-changes .tf-row:last-child button:has-text("Show")'); await p.waitForTimeout(300);
console.log('show draws a box:', !!(await p.$('.tf-flash')), '| list closed:', !(await p.$('.tf-changes')));
await p.keyboard.press(process.platform === 'darwin' ? 'Meta+z' : 'Control+z'); await p.waitForTimeout(300);
await p.keyboard.press(process.platform === 'darwin' ? 'Meta+z' : 'Control+z'); await p.waitForTimeout(300);
console.log('two Undos after: h2 =', JSON.stringify(await p.$eval('section:nth-of-type(2) h2', e => e.textContent)), '| first card', JSON.stringify(await p.$eval('.card h3', e => e.textContent)), '| h1 still', JSON.stringify(await p.$eval('h1', e => e.textContent)), '| count hidden', await p.$eval('.tf-count', c => c.style.visibility));
/* the same part changed twice: the older one goes back with the newer */
await edit('h1'); await p.keyboard.press('End'); await p.keyboard.type(' A'); await p.keyboard.press('Enter'); await p.waitForTimeout(100);
await edit('h1'); await p.keyboard.press('End'); await p.keyboard.type(' B'); await p.keyboard.press('Enter'); await p.waitForTimeout(100);
await p.click('.tf-count'); await p.waitForTimeout(200);
await p.click('.tf-changes .tf-row:last-child button:has-text("Undo")'); await p.waitForTimeout(200);
console.log('same part: says so and offers:', JSON.stringify(await p.$eval('.tf-status', s => s.textContent.trim())));
await b.close();
