/* needs playwright-core: `npm install playwright-core` in the repo, or TF_PLAYWRIGHT=<path to its index.mjs>; TF_CHROME overrides the browser */
const { chromium } = await import(process.env.TF_PLAYWRIGHT || new URL('../node_modules/playwright-core/index.mjs', import.meta.url).pathname);
const b = await chromium.launch({ executablePath: process.env.TF_CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
const p = await b.newPage({ viewport: { width: 1100, height: 900 } });
p.on('pageerror', e => console.log('PAGEERROR', e.message));
const pickBlock = async (page, sel) => { /* a click on the block itself, off its words and pictures: selected, its toolbar up */
  const at = await page.$eval(sel, e => { const b = e.getBoundingClientRect(), pr = window.__tweakfastProbe, tries = [[b.width - 6, b.height - 6], [b.width - 6, 6], [6, b.height - 6], [b.width / 2, b.height - 4], [b.width - 4, b.height / 2], [b.width / 2, 4]];
    for (const [x, y] of tries) { const hit = document.elementFromPoint(b.left + x, b.top + y); if (hit && e.contains(hit) && !pr.textTarget(hit) && !pr.pictureTarget(hit) && !hit.closest('a[href],button,.tf-plus,[data-tweakfast]') && (pr.blockTarget(hit) || e) === e) return { x, y }; }
    return { x: b.width - 6, y: b.height - 6 }; });
  await page.click(sel, { position: at }); await page.waitForTimeout(150);
  if (await page.$eval('.tf-edit-box', e => getComputedStyle(e).display === 'block').catch(() => false)) { await page.keyboard.press('Escape'); await page.waitForTimeout(120); } }; /* a block covered by its picture or words: the click took those; Esc steps out to the block */
const edit = async (sel, o) => { await p.click(sel, o); await p.waitForTimeout(60); await p.click(sel, o); }; /* one click picks, the second edits */
const viaMore = async (pg, word) => { await pg.click('.tf-tools button[aria-label="More"]'); await pg.click('.tf-menu button:has-text("' + word + '")'); await pg.waitForTimeout(60); }; /* the block tools wait behind More on a desk */
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
await pickBlock(p, '.card:nth-child(1)');
console.log('tools shown:', await p.evaluate(() => getComputedStyle(document.querySelector('.tf-tools')).display), await p.evaluate(() => [...document.querySelectorAll('.tf-tools button')].map(b => b.textContent).join(',')));
/* the tools and lines sit in the page, so a scroll carries them along with no lag */
console.log('tools scroll with the page:', await p.evaluate(() => getComputedStyle(document.querySelector('.tf-tools')).position === 'absolute' && getComputedStyle(document.querySelector('.tf-block-box')).position === 'absolute'), '| plus is a drawn cross:', await p.$eval('.tf-plus span svg', e => !!e));
/* hover draws the next block's dashed line and its name; the tools stay with the selected block until a click */
await p.mouse.move(5, 5); { const c3 = await p.$eval('.card:nth-child(3)', e => { const r = e.getBoundingClientRect(); return { x: r.right - 8, y: r.bottom - 8 }; }); await p.mouse.move(c3.x, c3.y); await p.waitForTimeout(80); }
console.log('hover on another card: its dashed line', await p.evaluate(() => { const b = document.querySelector('.tf-block-hover'); return !!b && getComputedStyle(b).display === 'block' && getComputedStyle(b).borderStyle === 'dashed'; }), '| named', await p.$eval('.tf-tag', t => getComputedStyle(t).display === 'block' ? t.textContent : 'none'), '| tools still on the first:', await p.evaluate(() => document.querySelector('.tf-tools').getBoundingClientRect().top < document.querySelector('.card:nth-child(1)').getBoundingClientRect().top + 2), '| selected line solid 2:', await p.$eval('.tf-block-box', e => getComputedStyle(e).borderStyle === 'solid' && getComputedStyle(e).borderTopWidth === '2px'));
await pickBlock(p, '.card:nth-child(1)');
await dragTo(p, ".card:nth-child(2)"); await p.waitForTimeout(300); /* the settle takes 170 ms; a hand never re-grabs sooner */
console.log('after drag down:', await titles());
await dragTo(p, ".card:nth-child(1)"); await p.waitForTimeout(300);
console.log('after drag up:', await titles());
await pickBlock(p, '.card:nth-child(2)');
await viaMore(p, 'Hide');
const status = () => p.$eval('.tf-status', s => s.classList.contains('tf-show') ? s.textContent.trim() : '');
console.log('after hide:', await titles(), '| hide button now:', await p.$eval('.tf-tools .tf-hide', e => e.getAttribute('aria-label')), '| faded:', await p.evaluate(() => getComputedStyle(document.querySelector('[data-tf-hidden]')).opacity), '| said:', await status());
const quiet = () => p.evaluate(() => document.querySelector('.tf-status').classList.remove('tf-show')); /* the bubble would fade by itself in 6 s */
await quiet(); await viaMore(p, 'Show'); await p.waitForTimeout(50); console.log('Show says nothing:', (await status()) === '');
await quiet(); await viaMore(p, 'Hide'); await p.waitForTimeout(50); console.log('second Hide quiet:', (await status()) === '');
/* Remove: gone at once, no ghost; Undo brings it back in its place */
await quiet(); await pickBlock(p, '.card:nth-child(3)');
await viaMore(p, 'Remove'); await p.waitForTimeout(50);
console.log('after remove:', await titles(), '| tools gone:', await p.evaluate(() => getComputedStyle(document.querySelector('.tf-tools')).display === 'none'), '| said:', await status());
await p.click('.tf-button:has-text("Undo")'); await p.waitForTimeout(50);
console.log('undo brings it back:', await titles());
await pickBlock(p, '.card:nth-child(3)');
await viaMore(p, 'Copy');
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
console.log('typing: the toolbar stays with the block:', await p.evaluate(() => getComputedStyle(document.querySelector('.tf-tools')).display !== 'none'), '| the block\'s line dashed behind the words:', await p.evaluate(() => { const b = document.querySelector('.tf-block-box'); return getComputedStyle(b).display === 'block' && getComputedStyle(b).borderStyle === 'dashed'; }));
await p.keyboard.press('Escape'); await p.mouse.move(5, 5); await pickBlock(p, '.card:nth-child(2)');
console.log('after Esc and a hover: tools back:', await p.evaluate(() => getComputedStyle(document.querySelector('.tf-tools')).display === 'flex'));
await pickBlock(p, 'main > section:nth-of-type(2)');
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
console.log('tap in the header: only its Colour:', await m.evaluate(() => [...document.querySelectorAll('.tf-tools > *')].filter(e => getComputedStyle(e).display !== 'none').map(e => e.textContent).join(',') === 'Colour'), '| bar fits:', await m.evaluate(() => { const r = document.querySelector('.tf-bar').getBoundingClientRect(); return r.left >= 0 && r.right <= innerWidth; }));
/* a finger needs 40 px: tools, grip, plus, row buttons; the Site panel shows its buttons; the hint speaks of taps */
await m.tap('.card:nth-child(1)', { position: { x: 6, y: 6 } }); await m.waitForTimeout(100);
await m.waitForTimeout(350); /* the tools spring in first */ console.log('finger sizes: tools', await m.$$eval('.tf-tools button', bs => bs.filter(x => x.getClientRects().length && x.getBoundingClientRect().width).every(x => x.getBoundingClientRect().height >= 40)), '| grip', await m.$eval('.tf-grip', e => e.getBoundingClientRect().height >= 40 && e.getBoundingClientRect().width >= 40), '| plus', await m.$eval('.tf-plus span', e => e.getBoundingClientRect().width >= 40), '| bar buttons', await m.$$eval('.tf-bar .tf-button', bs => bs.every(x => x.getBoundingClientRect().height >= 40)), '| bar fits', await m.evaluate(() => { const r = document.querySelector('.tf-bar').getBoundingClientRect(); return r.left >= 0 && r.right <= innerWidth; }));
if (!(await m.$('.tf-panel:not(.tf-pal):not(.tf-out)'))) { await m.tap('.tf-pages'); await m.waitForTimeout(150); } await m.waitForTimeout(200);
console.log('panel on a phone: row buttons shown:', await m.$eval('.tf-row:not(.tf-here) .tf-row-acts', e => getComputedStyle(e).opacity === '1'), '| 40 px:', await m.$$eval('.tf-row-acts .tf-button', bs => bs.every(x => x.getBoundingClientRect().height >= 40)));
if (!(await m.$('.tf-panel:not(.tf-pal):not(.tf-out)'))) { await m.tap('.tf-pages'); await m.waitForTimeout(150); } await m.waitForTimeout(100);
await m.evaluate(() => sessionStorage.clear());
await m.tap('.card:nth-child(1) p'); await m.waitForTimeout(100); await m.tap('.card:nth-child(1) p'); await m.waitForTimeout(100);
console.log('phone hint:', await m.$eval('.tf-status', s => s.textContent.trim()));
await m.screenshot({ path: '/tmp/tweakfast-touch.png' });
await ctx.close();
await b.close();
