/* needs playwright-core: `npm install playwright-core` in the repo, or TF_PLAYWRIGHT=<path to its index.mjs>; TF_CHROME overrides the browser */
const { chromium } = await import(process.env.TF_PLAYWRIGHT || new URL('../node_modules/playwright-core/index.mjs', import.meta.url).pathname);
const b = await chromium.launch({ executablePath: process.env.TF_CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
const p = await b.newPage({ viewport: { width: 1100, height: 900 } });
p.on('pageerror', e => console.log('PAGEERROR', e.message));
const edit = async (sel, o) => { await p.click(sel, o); await p.waitForTimeout(60); await p.click(sel, o); }; /* one click picks, the second edits */
await p.goto('http://127.0.0.1:8787/demo/events.html#edit=test');
/* drag the grip over another block of the same group: the dragged one takes that place */
async function dragTo(page, targetSel) {
  const g = await page.$eval('.tf-grip', e => { const r = e.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
  const t = await page.$eval(targetSel, e => { const r = e.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width, h: r.height }; });
  await page.mouse.move(g.x, g.y); await page.mouse.down(); await page.mouse.move(g.x + 5, g.y + 5);
  /* a little past the other block's middle, the way a hand does it */
  const dx = Math.sign(t.x - g.x) * t.w * 0.15, dy = Math.sign(t.y - g.y) * t.h * 0.15;
  await page.mouse.move(t.x + dx, t.y + dy, { steps: 8 }); await page.mouse.up();
}
const titles = () => p.evaluate(() => [...document.querySelectorAll('.cards > *')].map(n => n.classList.contains('tf-plus') ? '+' : (n.querySelector('h3').textContent + (n.hasAttribute('data-tf-hidden') ? '(hidden)' : ''))).join(' | '));
console.log('blocks:', await p.evaluate(() => document.querySelectorAll('[data-tf-block]').length), 'sections:', await p.evaluate(() => document.querySelectorAll('main > section[data-tf-block]').length), 'cards:', await p.evaluate(() => document.querySelectorAll('.card[data-tf-block]').length), 'plus:', await p.evaluate(() => document.querySelectorAll('.tf-plus').length));
console.log('start:', await titles());
await p.hover('.card:nth-child(1) h3');
console.log('tools shown:', await p.evaluate(() => getComputedStyle(document.querySelector('.tf-tools')).display), await p.evaluate(() => [...document.querySelectorAll('.tf-tools button')].map(b => b.textContent).join(',')));
/* the tools and lines sit in the page, so a scroll carries them along with no lag */
console.log('tools scroll with the page:', await p.evaluate(() => getComputedStyle(document.querySelector('.tf-tools')).position === 'absolute' && getComputedStyle(document.querySelector('.tf-block-box')).position === 'absolute'), '| plus is a drawn cross:', await p.$eval('.tf-plus span', e => !!e.querySelector('svg') && Math.abs((e.getBoundingClientRect().left + e.getBoundingClientRect().width / 2) - (e.querySelector('svg').getBoundingClientRect().left + e.querySelector('svg').getBoundingClientRect().width / 2)) < 1));
/* heading away from the tools, the next block takes them at once; heading toward them, it waits */
{ const c3 = await p.$eval('.card:nth-child(3)', e => { const r = e.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.bottom - 10 }; });
  await p.mouse.move(c3.x, c3.y - 30); await p.mouse.move(c3.x, c3.y); await p.waitForTimeout(30);
  console.log('tools switch at once:', await p.evaluate(() => document.querySelector('.tf-tools').getBoundingClientRect().top < document.querySelector('.card:nth-child(3)').getBoundingClientRect().top + 2 && document.querySelector('.tf-tools').getBoundingClientRect().top > document.querySelector('.card:nth-child(3)').getBoundingClientRect().top - 20));
  const t = await p.$eval('.tf-tools', e => { const r = e.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
  /* now up through card 2 toward the tools of card 3: card 2 must not take over right away */
  const c2 = await p.$eval('.card:nth-child(2)', e => { const r = e.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
  const sameRow = Math.abs(c2.y - t.y) < 60;
  if (!sameRow) {
    await p.mouse.move(c2.x, c2.y + 30); await p.mouse.move(c2.x + (t.x - c2.x) * 0.2, c2.y + 30 + (t.y - c2.y - 30) * 0.2); await p.waitForTimeout(30);
    console.log('toward the tools it waits:', await p.evaluate(() => { const r = document.querySelector('.tf-tools').getBoundingClientRect(), c = document.querySelector('.card:nth-child(3)').getBoundingClientRect(); return Math.abs(r.top - (c.top - 14)) < 2; }));
  } else console.log('toward the tools it waits: (skipped, same row)');
  await p.hover('.card:nth-child(1) h3'); await p.waitForTimeout(400); }
await dragTo(p, ".card:nth-child(2)"); await p.waitForTimeout(300); /* the settle takes 170 ms; a hand never re-grabs sooner */
console.log('after drag down:', await titles());
await dragTo(p, ".card:nth-child(1)"); await p.waitForTimeout(300);
console.log('after drag up:', await titles());
await p.hover('.card:nth-child(2) h3'); await p.waitForTimeout(400);
await p.click('.tf-tools button:has-text("Hide")');
const status = () => p.$eval('.tf-status', s => s.classList.contains('tf-show') ? s.textContent.trim() : '');
console.log('after hide:', await titles(), '| hide button now:', await p.textContent('.tf-tools .tf-hide'), '| faded:', await p.evaluate(() => getComputedStyle(document.querySelector('[data-tf-hidden]')).opacity), '| said:', await status());
const quiet = () => p.evaluate(() => document.querySelector('.tf-status').classList.remove('tf-show')); /* the bubble would fade by itself in 6 s */
await quiet(); await p.click('.tf-tools button:has-text("Show")'); await p.waitForTimeout(50); console.log('Show says nothing:', (await status()) === '');
await quiet(); await p.click('.tf-tools button:has-text("Hide")'); await p.waitForTimeout(50); console.log('second Hide quiet:', (await status()) === '');
/* Remove: gone at once, no ghost; Undo brings it back in its place */
await quiet(); await p.hover('.card:nth-child(3) h3'); await p.waitForTimeout(400);
await p.click('.tf-tools button:has-text("Remove")'); await p.waitForTimeout(50);
console.log('after remove:', await titles(), '| tools gone:', await p.evaluate(() => getComputedStyle(document.querySelector('.tf-tools')).display === 'none'), '| said:', await status());
await p.click('.tf-button:has-text("Undo")'); await p.waitForTimeout(50);
console.log('undo brings it back:', await titles());
await p.hover('.card:nth-child(3) h3'); await p.waitForTimeout(400);
await p.click('.tf-tools button:has-text("Copy")');
await p.waitForTimeout(700);
console.log('copy said once:', await status(), '| copy in view:', await p.evaluate(() => { const r = document.querySelector('.cards > :nth-child(4)').getBoundingClientRect(); return r.top >= 0 && r.bottom <= innerHeight; }));
console.log('after copy:', await titles(), '| placeholders:', await p.evaluate(() => { const c = document.querySelector('.cards > :nth-child(4)'); return [c.querySelector('h3').textContent, c.querySelector('time').textContent, c.querySelector('p').textContent, c.querySelector('img').getAttribute('src').startsWith('data:image/svg') ? 'placeholder picture' : c.querySelector('img').getAttribute('src')].join(' / '); }));
const quiet2 = () => p.evaluate(() => document.querySelector('.tf-status').classList.remove('tf-show'));
console.log('plus is small and round:', await p.$eval('.tf-plus span', e => { const r = e.getBoundingClientRect(), c = getComputedStyle(e); return Math.round(r.width) === 28 && Math.round(r.height) === 28 && c.borderRadius === '50%'; }), '| no dashed box:', await p.$eval('.tf-plus', e => getComputedStyle(e).borderStyle === 'none'));
await p.click('.tf-plus'); await p.waitForTimeout(100);
console.log('after plus:', await titles(), '| first words open for typing:', await p.evaluate(() => { const e = document.querySelector('[contenteditable]'); return e ? e.textContent : 'none'; }), '| said:', await p.$eval('.tf-status', s => s.textContent.trim()));
await p.keyboard.press('Escape'); await quiet2(); await p.click('.tf-plus'); await p.waitForTimeout(100);
console.log('second plus quiet:', await p.$eval('.tf-status', s => !s.classList.contains('tf-show') || !/A new one/.test(s.textContent)), '| cards now:', await titles());
await p.keyboard.press('Escape'); await p.click('.tf-button:has-text("Undo")'); await p.waitForTimeout(100);
/* a click into a card's text starts the edit and takes the block tools away; the next hover brings them back */
await edit('.card:nth-child(1) p'); await p.waitForTimeout(50);
console.log('typing: tools gone:', await p.evaluate(() => getComputedStyle(document.querySelector('.tf-tools')).display === 'none'), '| block line gone:', await p.evaluate(() => getComputedStyle(document.querySelector('.tf-block-box')).display === 'none'));
await p.keyboard.press('Escape'); await p.mouse.move(5, 5); await p.hover('.card:nth-child(2) h3'); await p.waitForTimeout(400);
console.log('after Esc and a hover: tools back:', await p.evaluate(() => getComputedStyle(document.querySelector('.tf-tools')).display === 'flex'));
await p.hover('main > section:nth-of-type(2) h2'); await p.waitForTimeout(400);
await dragTo(p, "main > section:nth-of-type(1)"); await p.waitForTimeout(300);
console.log('sections after drag up:', await p.evaluate(() => [...document.querySelectorAll('main > section')].map(s => s.querySelector('h1,h2').textContent).join(' | ')));
await p.click('.tf-button:has-text("Undo")'); await p.click('.tf-button:has-text("Undo")'); await p.click('.tf-button:has-text("Undo")');
console.log('after 3 undos:', await titles(), '| sections:', await p.evaluate(() => [...document.querySelectorAll('main > section')].map(s => s.querySelector('h1,h2').textContent).join(' | ')));
await p.evaluate(() => { window._blob = null; const c = URL.createObjectURL; URL.createObjectURL = b => { window._blob = b; return c(b); }; });
await p.click('.tf-button:has-text("Done")');
const html = await p.evaluate(() => window._blob.text());
console.log('output clean:', !/\btf-(?!hidden|pos)|data-tf-block|data-tweakfast|contenteditable/.test(html), '| hidden card kept:', /<article class="card" data-tf-hidden="" hidden="" style="display: none;">/.test(html), '| cards in output:', (html.match(/<article class="card"/g) || []).length);
await p.screenshot({ path: '/tmp/tweakfast-ring2.png' });
/* touch: no hover on a phone; a tap on a block shows its tools, a tap in the header shows only its Look */
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
const m = await ctx.newPage();
m.on('pageerror', e => console.log('PAGEERROR', e.message));
await m.goto('http://127.0.0.1:8787/demo/events.html#edit=test'); await m.waitForTimeout(300);
const mtitles = () => m.evaluate(() => [...document.querySelectorAll('.cards > *')].map(n => n.classList.contains('tf-plus') ? '+' : n.querySelector('h3').textContent).join(' | '));
await m.tap('.card:nth-child(1)', { position: { x: 6, y: 6 } }); await m.waitForTimeout(100);
console.log('touch tools shown:', await m.evaluate(() => getComputedStyle(document.querySelector('.tf-tools')).display), '| for the first card:', await m.evaluate(() => { const r = document.querySelector('.card:nth-child(1)').getBoundingClientRect(), t = document.querySelector('.tf-tools').getBoundingClientRect(); return Math.abs(t.top - (r.top - 14)) < 2; }), '| editing started:', await m.evaluate(() => !!document.querySelector('[contenteditable]')));
{ const g = await m.$eval('.tf-grip', e => { const r = e.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
  const t = await m.$eval('.card:nth-child(2)', e => { const r = e.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
  const cdp = await ctx.newCDPSession(m);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: g.x, y: g.y }] });
  for (let i = 1; i <= 8; i++) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: g.x + (t.x - g.x) * i / 6, y: g.y + (t.y - g.y) * i / 6 }] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await m.waitForTimeout(100); }
console.log('touch after drag down:', await mtitles());
/* a long press lifts a block on the phone: half a second still, then the finger carries it */
{ const c = await m.$eval('.card:nth-child(1)', e => { const r = e.getBoundingClientRect(); return { x: r.left + 8, y: r.top + 8 }; });
  const t = await m.$eval('.card:nth-child(2)', e => { const r = e.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
  const cdp = await ctx.newCDPSession(m);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: c.x, y: c.y }] });
  await m.waitForTimeout(650);
  console.log('held half a second: lifted', await m.evaluate(() => !!document.querySelector('.tf-moving')), '| tools shown', await m.evaluate(() => getComputedStyle(document.querySelector('.tf-tools')).display === 'flex'));
  for (let i = 1; i <= 8; i++) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: c.x + (t.x - c.x) * i / 6, y: c.y + (t.y - c.y) * i / 6 }] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await m.waitForTimeout(300);
  console.log('long press drag:', await mtitles(), '| settled', await m.evaluate(() => !document.querySelector('.tf-moving')));
  /* a quick tap or an early move is left alone */
  const c2 = await m.$eval('.card:nth-child(1)', e => { const r = e.getBoundingClientRect(); return { x: r.left + 8, y: r.top + 8 }; });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: c2.x, y: c2.y }] }); await m.waitForTimeout(150);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: c2.x, y: c2.y + 40 }] }); await m.waitForTimeout(500);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await m.waitForTimeout(100);
  console.log('an early move is a scroll, not a lift:', await m.evaluate(() => !document.querySelector('.tf-moving')), '|', await mtitles());
  await m.evaluate(() => scrollTo({ top: 0, behavior: 'instant' })); await m.waitForTimeout(300); /* the synthetic scroll's momentum would keep the page moving */ }
await m.waitForTimeout(450); /* a tap right after a drop is the click born of the release, swallowed for 400 ms */
/* after synthetic touch gestures Playwright's own tap hangs on scrolling into view; a touch by hand does not */
const tapAt = async (sel) => { const pt = await m.$eval(sel, e => { const r = e.getBoundingClientRect(); return { x: r.left + Math.min(20, r.width / 2), y: r.top + r.height / 2 }; }); const c = await ctx.newCDPSession(m); await c.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: pt.x, y: pt.y }] }); await c.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await c.detach(); };
await m.keyboard.press('Escape'); await m.waitForTimeout(100); /* the synthetic scroll gesture ends in a click that selects the card's picture; its bar would cover the heading */
await tapAt('.card:nth-child(1) h3'); await m.waitForTimeout(100); await tapAt('.card:nth-child(1) h3'); await m.waitForTimeout(100); /* one tap picks, the second edits */
console.log('tap on text: editing:', await m.evaluate(() => !!document.querySelector('[contenteditable]')), '| tools while typing:', await m.evaluate(() => getComputedStyle(document.querySelector('.tf-tools')).display));
await tapAt('header .logo'); await m.waitForTimeout(100);
console.log('tap in the header: only its Look:', await m.evaluate(() => [...document.querySelectorAll('.tf-tools > *')].filter(e => getComputedStyle(e).display !== 'none').map(e => e.textContent).join(',') === 'Look'), '| bar fits:', await m.evaluate(() => { const r = document.querySelector('.tf-bar').getBoundingClientRect(); return r.left >= 0 && r.right <= innerWidth; }));
/* a finger needs 40 px: tools, grip, plus, row buttons; the Site panel shows its buttons; the hint speaks of taps */
await m.tap('.card:nth-child(1)', { position: { x: 6, y: 6 } }); await m.waitForTimeout(100);
await m.waitForTimeout(350); /* the tools spring in first */ console.log('finger sizes: tools', await m.$$eval('.tf-tools button', bs => bs.filter(x => x.getClientRects().length && x.getBoundingClientRect().width).every(x => x.getBoundingClientRect().height >= 40)), '| grip', await m.$eval('.tf-grip', e => e.getBoundingClientRect().height >= 40 && e.getBoundingClientRect().width >= 40), '| plus', await m.$eval('.tf-plus span', e => e.getBoundingClientRect().width >= 40), '| bar buttons', await m.$$eval('.tf-bar .tf-button', bs => bs.every(x => x.getBoundingClientRect().height >= 40)), '| bar fits', await m.evaluate(() => { const r = document.querySelector('.tf-bar').getBoundingClientRect(); return r.left >= 0 && r.right <= innerWidth; }));
await m.tap('.tf-button:has-text("Site")'); await m.waitForTimeout(200);
console.log('panel on a phone: row buttons shown:', await m.$eval('.tf-row:not(.tf-here) .tf-row-acts', e => getComputedStyle(e).opacity === '1'), '| 40 px:', await m.$$eval('.tf-row-acts .tf-button', bs => bs.every(x => x.getBoundingClientRect().height >= 40)));
await m.tap('.tf-button:has-text("Site")'); await m.waitForTimeout(100);
await m.evaluate(() => sessionStorage.clear());
await m.tap('.card:nth-child(1) p'); await m.waitForTimeout(100); await m.tap('.card:nth-child(1) p'); await m.waitForTimeout(100);
console.log('phone hint:', await m.$eval('.tf-status', s => s.textContent.trim()));
await m.screenshot({ path: '/tmp/tweakfast-touch.png' });
await ctx.close();
await b.close();
