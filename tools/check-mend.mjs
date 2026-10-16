/* What the cleaning took away is mended for readers: a Menu button opens the menu's links where they are hidden and
   steps aside where they show, other buttons left with nothing to do are hidden, a part that slid sideways shows its
   steps one under another, the pointer is back. The owner sees the same page; nothing of it is saved. Serve the repo on
   8787 and tools/fake-save-server.py on 8788 first. */
const { chromium } = await import(process.env.TF_PLAYWRIGHT || new URL('../node_modules/playwright-core/index.mjs', import.meta.url).pathname);
const b = await chromium.launch({ executablePath: process.env.TF_CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
const U = 'http://127.0.0.1:8787/tools/check-mend.html';
const shown = (p, s) => p.evaluate(s => { const e = [...document.querySelectorAll('button')].find(b => b.textContent.trim() === s); return !!(e && e.getClientRects().length); }, s);
for (const w of [390, 1280]) {
  const ctx = await b.newContext({ viewport: { width: w, height: 800 } });
  const p = await ctx.newPage(); p.on('pageerror', e => console.log('PAGEERROR', e.message));
  await p.goto(U); await p.waitForTimeout(600);
  console.log(w, '| Menu shown:', await shown(p, 'Menu +'), '| Bag hidden:', !(await shown(p, 'Bag (0)')), '| Join kept:', await shown(p, 'Join'),
    '| pointer back:', await p.evaluate(() => getComputedStyle(document.body).cursor !== 'none'));
  const steps = await p.evaluate(() => [...document.querySelectorAll('.row h3')].map(h => Math.round(h.getBoundingClientRect().left)));
  console.log('  steps one under another:', steps.every(x => x === steps[0] && x < w), '| page not wider:', await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  if (w < 600) {
    await p.click('button:has-text("Menu +")'); await p.waitForTimeout(200);
    console.log('  opened:', await p.evaluate(() => { const m = document.getElementById('tf-menu'); return m && m.getClientRects().length ? [...m.querySelectorAll('a')].map(a => a.textContent).join(',') : 'no'; }), '| expanded:', await p.getAttribute('button:has-text("Menu +")', 'aria-expanded'));
    await p.keyboard.press('Escape'); await p.waitForTimeout(100);
    console.log('  Esc closes:', await p.evaluate(() => !document.getElementById('tf-menu').getClientRects().length));
  }
  await ctx.close();
}
const ctx = await b.newContext({ viewport: { width: 390, height: 800 } });
const p = await ctx.newPage(); p.on('pageerror', e => console.log('PAGEERROR', e.message));
await p.goto(U + '#edit=test'); await p.waitForTimeout(900);
console.log('owner sees what readers see: Bag hidden:', !(await shown(p, 'Bag (0)')), '| steps stacked:', await p.evaluate(() => !!document.querySelector('[data-tf-mend~=row]')));
await p.evaluate(() => { window._blob = null; const c = URL.createObjectURL; URL.createObjectURL = x => { window._blob = x; return c(x); }; });
await p.click('h1'); await p.waitForTimeout(60); await p.click('h1'); await p.keyboard.type(' now'); await p.keyboard.press('Enter');
await p.click('.tf-button:has-text("Done")'); await p.waitForTimeout(500);
const file = await p.evaluate(() => window._blob ? window._blob.text() : '');
console.log('saved without the mends:', !!file && !/data-tf-mend|tf-menu|tweakfast-mend/.test(file), '| aria-expanded as made:', /<button aria-expanded="false">Menu \+<\/button>/.test(file));
await b.close();
