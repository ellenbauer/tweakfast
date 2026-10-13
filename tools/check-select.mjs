/* One click picks a text (solid line, the block's tools, no caret); a second click or Enter edits it; Enter and Esc end the typing
   and keep it picked; Esc then lets go; a click elsewhere lets go; a picked picture takes the pick over. Serve the repo on 8787 first. */
const { chromium } = await import(process.env.TF_PLAYWRIGHT || new URL('../node_modules/playwright-core/index.mjs', import.meta.url).pathname);
const b = await chromium.launch({ executablePath: process.env.TF_CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
const p = await b.newPage({ viewport: { width: 1100, height: 800 } });
p.on('pageerror', e => console.log('PAGEERROR', e.message));
const shown = sel => p.$eval(sel, e => getComputedStyle(e).display !== 'none').catch(() => false);
const editing = () => p.evaluate(() => { const e = document.querySelector('[contenteditable]'); return e ? e.tagName : null; });
const lineOn = sel => p.evaluate(sel => { const r = document.querySelector(sel).getBoundingClientRect(), e = document.querySelector('.tf-edit-box'); if (!e || getComputedStyle(e).display === 'none') return false; const b = e.getBoundingClientRect(); return Math.abs(b.top - r.top + 3) < 1 && Math.abs(b.left - r.left + 3) < 1; }, sel);
const count = () => p.$eval('.tf-count', c => c.style.visibility === 'hidden' ? '-' : c.textContent);
await p.goto('http://127.0.0.1:8787/demo/events.html#edit=test'); await p.waitForTimeout(400);
await p.click('.tf-button:has-text("Got it")').catch(() => {});
await p.click('h1'); await p.waitForTimeout(150);
console.log('one click: solid line on it', await lineOn('h1'), '| no caret', (await editing()) === null, '| no hover line', !(await shown('.tf-hover-box')));
await p.hover('.card:nth-child(1) h3'); await p.waitForTimeout(200);
console.log('hovering elsewhere: hover line there', await shown('.tf-hover-box'), '| the pick stays', await lineOn('h1'));
await p.hover('h1'); await p.waitForTimeout(200);
console.log('hovering the picked text: no hover line', !(await shown('.tf-hover-box')));
await p.keyboard.press('Enter'); await p.waitForTimeout(100);
console.log('Enter: editing', (await editing()) === 'H1');
await p.keyboard.type('zz'); await p.keyboard.press('Escape'); await p.waitForTimeout(100);
console.log('Esc: put back', !(await p.$eval('h1', e => e.textContent)).includes('zz'), '| still picked', await lineOn('h1'), '| not editing', (await editing()) === null);
await p.keyboard.press('Escape'); await p.waitForTimeout(100);
console.log('Esc again: let go', !(await shown('.tf-edit-box')));
await p.click('h1', { position: { x: 30, y: 20 } }); await p.waitForTimeout(60); await p.click('h1', { position: { x: 30, y: 20 } }); await p.waitForTimeout(100);
const caretAtStart = await p.evaluate(() => { const s = getSelection(); return s.rangeCount && s.anchorOffset < 4; });
console.log('two clicks: editing', (await editing()) === 'H1', '| caret where clicked', caretAtStart);
await p.keyboard.type('Q'); await p.keyboard.press('Enter'); await p.waitForTimeout(100);
console.log('Enter: kept', (await p.$eval('h1', e => e.textContent)).includes('Q'), '| count', await count(), '| picked again', await lineOn('h1'), '| not editing', (await editing()) === null);
await p.click('body', { position: { x: 5, y: 700 } }); await p.waitForTimeout(100);
console.log('click elsewhere: let go', !(await shown('.tf-edit-box')));
await p.click('.card:nth-child(1) p'); await p.waitForTimeout(100); await p.click('.card:nth-child(1) img'); await p.waitForTimeout(200);
console.log('a picture click takes the pick: line on the picture', await lineOn('.card:nth-child(1) img'), '| Describes shown', await shown('.tf-link'));
await p.keyboard.press('Escape'); await p.waitForTimeout(100);
await p.hover('.card:nth-child(2) h3'); await p.waitForTimeout(300); await p.click('.card:nth-child(2) h3'); await p.waitForTimeout(100);
console.log('picked text in a block: tools shown', await shown('.tf-tools'));
/* a phone: two taps */
const m = await b.newPage({ viewport: { width: 390, height: 760 }, hasTouch: true, isMobile: true });
await m.goto('http://127.0.0.1:8787/demo/events.html#edit=test'); await m.waitForTimeout(400); await m.tap('.tf-button:has-text("Got it")').catch(() => {});
await m.tap('h1', { position: { x: 20, y: 24 } }); await m.waitForTimeout(100); /* at the left: the block's tools sit at the right */
const held1 = await m.evaluate(() => !document.querySelector('[contenteditable]') && getComputedStyle(document.querySelector('.tf-edit-box')).display === 'block');
await m.tap('h1', { position: { x: 20, y: 24 } }); await m.waitForTimeout(100);
console.log('phone: one tap picks', held1, '| second tap edits', !!(await m.$('h1[contenteditable]')));
await b.close();
