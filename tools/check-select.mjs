/* One click edits a text, the caret where clicked; the block's tools sit beside the words, never on them, and only the words' line is drawn
   until the pointer is on the tools; Esc puts back and keeps it picked, Enter edits again, Esc lets go; a picture click takes the pick. Serve the repo on 8787 first. */
const { chromium } = await import(process.env.TF_PLAYWRIGHT || new URL('../node_modules/playwright-core/index.mjs', import.meta.url).pathname);
const b = await chromium.launch({ executablePath: process.env.TF_CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
const p = await b.newPage({ viewport: { width: 1100, height: 800 } });
p.on('pageerror', e => console.log('PAGEERROR', e.message));
const shown = sel => p.$eval(sel, e => getComputedStyle(e).display !== 'none').catch(() => false);
const editing = () => p.evaluate(() => { const e = document.querySelector('[contenteditable]'); return e ? e.tagName : null; });
const lineOn = sel => p.evaluate(sel => { const r = document.querySelector(sel).getBoundingClientRect(), e = document.querySelector('.tf-edit-box'); if (!e || getComputedStyle(e).display === 'none') return false; const b = e.getBoundingClientRect(); return Math.abs(b.top - r.top) < 1 && Math.abs(b.left - r.left) < 1; }, sel);
const count = () => p.$eval('.tf-count', c => c.style.visibility === 'hidden' ? '-' : c.textContent);
await p.goto('http://127.0.0.1:8787/demo/events.html#edit=test'); await p.waitForTimeout(400);
await p.click('.tf-button:has-text("Got it")').catch(() => {});
await p.click('h1', { position: { x: 30, y: 20 } }); await p.waitForTimeout(150);
const caretAtStart = await p.evaluate(() => { const s = getSelection(); return s.rangeCount && s.anchorOffset < 4; });
console.log('one click: editing', (await editing()) === 'H1', '| caret where clicked', caretAtStart, '| solid line on it', await lineOn('h1'), '| no hover line', !(await shown('.tf-hover-box')));
console.log('tools beside the words, not on them:', await p.evaluate(() => { const t = document.querySelector('.tf-tools').getBoundingClientRect(), h = document.querySelector('h1').getBoundingClientRect(); return getComputedStyle(document.querySelector('.tf-tools')).display !== 'none' && (t.bottom <= h.top || t.top >= h.bottom); }), '| the block\'s line dashed behind it:', await p.$eval('.tf-block-box', e => getComputedStyle(e).display === 'block' && getComputedStyle(e).borderStyle === 'dashed'));
await p.hover('.tf-name'); await p.waitForTimeout(100);
console.log('pointer on the tools: the block\'s line shows', await shown('.tf-block-box'));
await p.keyboard.type('zz'); await p.keyboard.press('Escape'); await p.waitForTimeout(100);
console.log('Esc: put back', !(await p.$eval('h1', e => e.textContent)).includes('zz'), '| no line on the words', !(await lineOn('h1')), '| the block selected, tools up', await shown('.tf-block-box') && await shown('.tf-tools'), '| not editing', (await editing()) === null);
await p.keyboard.press('Enter'); await p.waitForTimeout(100);
console.log('Enter: editing', (await editing()) === 'H1');
await p.keyboard.press('Escape'); await p.keyboard.press('Escape'); await p.waitForTimeout(100);
console.log('Esc again: let go', !(await shown('.tf-edit-box')) && !(await shown('.tf-tools')));
await p.click('h1', { position: { x: 30, y: 20 } }); await p.waitForTimeout(100);
await p.keyboard.type('Q'); await p.keyboard.press('Enter'); await p.waitForTimeout(100);
console.log('Enter: kept', (await p.$eval('h1', e => e.textContent)).includes('Q'), '| count', await count(), '| the block selected again', await shown('.tf-block-box') && !(await lineOn('h1')), '| not editing', (await editing()) === null);
await p.click('body', { position: { x: 5, y: 700 } }); await p.waitForTimeout(100);
console.log('click elsewhere: let go', !(await shown('.tf-edit-box')));
await p.click('.card:nth-child(1) p'); await p.waitForTimeout(100); await p.click('.card:nth-child(1) img'); await p.waitForTimeout(200);
console.log('a picture click takes the pick: line on the picture', await lineOn('.card:nth-child(1) img'), '| Describes shown', await shown('.tf-link'));
await p.keyboard.press('Escape'); await p.waitForTimeout(100);
/* a phone: one tap */
const m = await b.newPage({ viewport: { width: 390, height: 760 }, hasTouch: true, isMobile: true });
await m.goto('http://127.0.0.1:8787/demo/events.html#edit=test'); await m.waitForTimeout(400); await m.tap('.tf-button:has-text("Got it")').catch(() => {});
await m.tap('h1', { position: { x: 20, y: 24 } }); await m.waitForTimeout(150);
console.log('phone: one tap edits', !!(await m.$('h1[contenteditable]')), '| tools clear of the words', await m.evaluate(() => { const t = document.querySelector('.tf-tools').getBoundingClientRect(), h = document.querySelector('h1').getBoundingClientRect(); return getComputedStyle(document.querySelector('.tf-tools')).display === 'none' || t.bottom <= h.top || t.top >= h.bottom; }));
await b.close();
