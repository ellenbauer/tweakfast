/* Tooltips: a shape says its word after a rest, a worded button says nothing, Undo shows its key, a neighbour opens at once,
   centred above, gone on a press, none for a finger. Serve the repo on 8787 first. */
const { chromium } = await import(process.env.TF_PLAYWRIGHT || new URL('../node_modules/playwright-core/index.mjs', import.meta.url).pathname);
const b = await chromium.launch({ executablePath: process.env.TF_CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
const p = await b.newPage({ viewport: { width: 1100, height: 800 } });
p.on('pageerror', e => console.log('PAGEERROR', e.message));
await p.goto('http://127.0.0.1:8787/demo/index.html#edit=test'); await p.waitForTimeout(400);
const tip = () => p.$eval('.tf-tip', t => getComputedStyle(t).display === 'none' ? '' : t.textContent).catch(() => '');
const where = sel => p.evaluate(sel => { const t = document.querySelector('.tf-tip').getBoundingClientRect(), c = document.querySelector(sel).getBoundingClientRect(); return { gapAbove: Math.round(c.top - t.bottom), centred: Math.abs((t.left + t.width / 2) - (c.left + c.width / 2)) < 1.5, font: getComputedStyle(document.querySelector('.tf-tip')).font }; }, sel);
console.log('no title attributes left in the editor parts:', (await p.$$('[data-tweakfast] [title], [data-tweakfast][title]')).length === 0);
const PREVIEW = '.tf-bar button[aria-label="Preview"]';
await p.hover(PREVIEW); await p.waitForTimeout(250); console.log('250 ms: nothing yet:', (await tip()) === '');
await p.waitForTimeout(400); console.log('after the rest, the shape says:', await tip(), '|', await where(PREVIEW));
await p.hover('.tf-bar .tf-quiet'); await p.waitForTimeout(700); console.log('Leave, a word on its face: none:', (await tip()) === '');
await p.hover('.tf-bar .tf-pages'); await p.waitForTimeout(700); console.log('the page name: none:', (await tip()) === '');
await p.click('h1'); await p.waitForTimeout(60); await p.click('h1'); await p.keyboard.type('x'); await p.keyboard.press('Enter'); await p.waitForTimeout(200);
await p.hover('.tf-bar button:has-text("Undo")'); await p.waitForTimeout(650); console.log('Undo with its key:', await tip(), '| key muted:', await p.$eval('.tf-tip .tf-tip-key', e => e.textContent + ' ' + getComputedStyle(e).fontWeight));
await p.hover(PREVIEW); await p.waitForTimeout(80); console.log('a neighbour at once:', await tip());
await p.mouse.down(); console.log('gone on the press:', (await tip()) === ''); await p.mouse.up(); await p.waitForTimeout(300); await p.keyboard.press('Escape'); await p.waitForTimeout(300);
await p.click('.card:nth-child(1)'); await p.waitForTimeout(300); const HIDE = '.tf-tools button[aria-label="Hide"]'; await p.hover(HIDE); await p.waitForTimeout(650); console.log('a block tool:', await tip(), '|', await where(HIDE));
await p.hover('.tf-tools .tf-name'); await p.waitForTimeout(650); console.log('the handle:', await tip());
await p.mouse.move(5, 400); await p.waitForTimeout(300); console.log('off everything: none:', (await tip()) === '');
await p.click('.tf-bar .tf-pages'); await p.waitForTimeout(400); const HELP = '.tf-sheet-head button[aria-label="Help"]'; await p.hover(HELP); await p.waitForTimeout(650); console.log('in the sheet head:', await tip(), '|', await where(HELP));
await p.keyboard.press('Escape'); await p.waitForTimeout(300); console.log('gone on a key:', (await tip()) === '');
/* keyboard: Tab onto a shape shows it */
await p.mouse.move(5, 400); await p.mouse.down(); await p.mouse.up(); let seen = '';
for (let i = 0; i < 12 && !seen; i++) { await p.keyboard.press('Tab'); await p.waitForTimeout(60); if (await p.evaluate(() => document.activeElement && document.activeElement.classList.contains('tf-icon'))) seen = await tip(); }
console.log('Tab onto a shape shows it:', seen);
/* a finger */
const m = await (await b.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true })).newPage();
await m.goto('http://127.0.0.1:8787/demo/index.html#edit=test'); await m.waitForTimeout(400);
await m.hover('.tf-bar .tf-icon >> nth=0').catch(() => {}); await m.waitForTimeout(700);
console.log('a finger: no tooltip at all:', !(await m.$('.tf-tip')));
await b.close();
