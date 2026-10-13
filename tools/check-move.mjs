/* Move up and Move down on the block tools (Move left and Move right when the block sits beside its own): the block changes place with its neighbour, one step for Undo, off at an end,
   and inside a shared part the new order is made on every page. Serve the repo on 8787 first. */
const { chromium } = await import(process.env.TF_PLAYWRIGHT || new URL('../node_modules/playwright-core/index.mjs', import.meta.url).pathname);
const b = await chromium.launch({ executablePath: process.env.TF_CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
const p = await b.newPage({ viewport: { width: 1100, height: 900 } });
p.on('pageerror', e => console.log('PAGEERROR', e.message));
const titles = () => p.evaluate(() => [...document.querySelectorAll('.cards > *')].filter(n => !n.classList.contains('tf-plus')).map(n => n.querySelector('h3').textContent).join(','));
const count = () => p.$eval('.tf-count', c => c.style.visibility === 'hidden' ? '-' : c.textContent);
const BACK = '.tf-tools button:is([title="Move up"],[title="Move left"])', FWD = '.tf-tools button:is([title="Move down"],[title="Move right"])';
const off = sel => p.$eval(sel, e => e.disabled);
await p.goto('http://127.0.0.1:8787/demo/events.html#edit=test'); await p.waitForTimeout(400);
await p.click('.tf-button:has-text("Got it")').catch(() => {});
console.log('tools in order:', await p.$$eval('.tf-tools button', bs => bs.map(x => x.title).join(',')), '| every one a shape with its word:', await p.$$eval('.tf-tools button', bs => bs.every(x => x.querySelector('svg') && x.textContent === x.title)));
await p.hover('.card:nth-child(1) h3'); await p.waitForTimeout(400);
console.log('cards in a row, arrows sideways:', await p.$eval(BACK, e => e.title) === 'Move left' && await p.$eval(FWD, e => e.title) === 'Move right');
console.log('first card: up off', await off(BACK), '| down on', !(await off(FWD)));
await p.click(FWD); await p.waitForTimeout(300);
console.log('moved down:', await titles(), '| count', await count(), '| tools follow it: up on now', !(await off(BACK)));
await p.click(FWD); await p.waitForTimeout(300);
console.log('and again:', await titles(), '| last: down off', await off(FWD));
await p.click('.tf-button:has-text("Undo")'); await p.waitForTimeout(100); await p.click('.tf-button:has-text("Undo")'); await p.waitForTimeout(100);
console.log('two Undos put it back:', await titles(), '| count', await count());
/* in a shared footer the order is made on every page */
await p.goto('http://127.0.0.1:8787/tools/check-menu.html#edit=test'); await p.waitForTimeout(300);
await p.hover('footer .col:nth-child(1) h4'); await p.waitForTimeout(400);
await p.evaluate(() => { window._blobs = {}; window._names = {}; const c = URL.createObjectURL; URL.createObjectURL = b => { const u = c(b); window._blobs[u] = b; return u; }; HTMLAnchorElement.prototype.click = function () { window._names[this.href] = this.download; }; });
await p.click(FWD); await p.waitForTimeout(900);
console.log('footer column moved:', await p.$$eval('footer .col h4', hs => hs.map(h => h.textContent).join(',')));
await p.click('.tf-button:has-text("Done")'); await p.waitForTimeout(300);
const files = await p.evaluate(async () => { const out = {}; for (const u in window._names) out[window._names[u]] = await window._blobs[u].text(); return out; });
const order = h => [...h.matchAll(/<h4>([^<]*)<\/h4>/g)].map(m => m[1]).join(',');
console.log('Done writes:', Object.keys(files).sort().join(','), '| same order on every page:', Object.values(files).every(h => order(h) === 'Hours,Visit,Follow'));
await b.close();
