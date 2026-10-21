/* A copied card that starts a second line of a row keeps the row's own space between lines (the Spring Widget copy in
   tools/_sw: 45 u between the testimonial cards side by side, so 50 px at 1600 wide) through a draft brought back after a
   reload, Undo and Redo, Done and a reload, and the readers' view; a rule no row wears is gone after an Undo. Needs a FRESH
   tools/fake-save-server.py on 8788 and tools/_sw. TF_PLAYWRIGHT / TF_CHROME as in the other checks. */
const { chromium } = await import(process.env.TF_PLAYWRIGHT || new URL('../node_modules/playwright-core/index.mjs', import.meta.url).pathname);
const b = await chromium.launch({ executablePath: process.env.TF_CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
const p = await b.newPage({ viewport: { width: 1600, height: 1000 } });
p.on('pageerror', e => console.log('PAGEERROR', e.message));
const PORT = process.env.TF_PORT || 8788;
const rows = () => p.$eval('.quotes', q => {
  const c = [...q.children].filter(x => !x.hasAttribute('data-tweakfast')).map(x => x.getBoundingClientRect());
  const sheets = [...document.head.querySelectorAll('style[data-tf-rows]')], id = q.getAttribute('data-tf-rows');
  return { cards: c.length, space: c.length > 3 ? Math.round(c[3].top - c[0].bottom) : null, side: Math.round(c[1].left - c[0].right), orphan: sheets.some(s => !id || s.textContent.indexOf('"' + id + '"') < 0) };
});
const say = async (label, want) => { const r = await rows(); console.log(label + ': cards', r.cards, '| between lines', r.space, '| side by side', r.side, '| same', r.space === r.side, want === undefined ? '' : '| orphan rule ' + r.orphan + ' (want false) ' + !r.orphan); };
const load = async (h) => { await p.goto('http://127.0.0.1:' + PORT + '/tools/_sw/index.html?v=' + Date.now() + h); await p.waitForSelector('.tf-bar, .tf-pages', { timeout: 15000 }); await p.waitForTimeout(900); await p.click('.tf-button:has-text("Got it")').catch(() => {}); };
await load('#edit=test');
const card = (await p.$$('.quotes > .quote'))[2]; await card.scrollIntoViewIfNeeded(); const r = await card.boundingBox(); await p.mouse.click(r.x + r.width / 2, r.y + 20); await p.waitForTimeout(400);
await p.click('.tf-tools button[aria-label="More"]'); await p.click('.tf-menu button:has-text("Copy")'); await p.waitForTimeout(600); /* the block tools wait behind More on a desk */
await say('copied');
await p.reload(); await p.waitForSelector('.tf-bar, .tf-pages', { timeout: 15000 }); await p.waitForTimeout(1200);
await say('draft back after reload');
await p.keyboard.press('Meta+z'); await p.waitForTimeout(400); await say('after Undo', false);
await p.keyboard.press('Meta+Shift+z'); await p.waitForTimeout(400); await say('after Redo', false);
await p.keyboard.press('Escape'); await p.keyboard.press('Escape');
await p.click('.tf-button:has-text("Done")'); await p.waitForTimeout(2500);
await load('#edit=test'); await say('after Done and reload');
await p.goto('http://127.0.0.1:' + PORT + '/tools/_sw/index.html?v=' + Date.now() + '#view'); await p.waitForTimeout(900); await say('readers');
await b.close();
