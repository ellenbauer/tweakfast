/* The command palette: Cmd+K opens one search over every page and every action in the sheet's place; letters match in
   order, arrows move, Enter does it, Esc or a click outside closes; Cmd+K while typing commits first. Serve the repo on 8787 first. */
const { chromium } = await import(process.env.TF_PLAYWRIGHT || new URL('../node_modules/playwright-core/index.mjs', import.meta.url).pathname);
const b = await chromium.launch({ executablePath: process.env.TF_CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
const p = await b.newPage({ viewport: { width: 1100, height: 800 } });
p.on('pageerror', e => console.log('PAGEERROR', e.message));
const edit = async (sel, o) => { await p.click(sel, o); await p.waitForTimeout(60); await p.click(sel, o); };
const rows = () => p.$$eval('.tf-pal-row', rs => rs.map(r => r.querySelector('.tf-pal-name').textContent + (r.classList.contains('tf-lit') ? '*' : '')).join(', '));
const open = async () => { await p.keyboard.press('Meta+k'); await p.waitForTimeout(350); };
await p.goto('http://127.0.0.1:8787/demo/events.html#edit=test'); await p.waitForTimeout(400);
await p.click('.tf-button:has-text("Got it")').catch(() => {});
await open();
console.log('opens:', !!(await p.$('.tf-pal')), '| field focused', await p.evaluate(() => document.activeElement.className === 'tf-pal-input'), '| groups', await p.$$eval('.tf-pal .tf-caption', c => c.map(x => x.textContent).join('/')));
console.log('rows:', await rows());
console.log('in the sheet\'s place:', await p.evaluate(() => { const r = document.querySelector('.tf-pal').getBoundingClientRect(), b = document.querySelector('.tf-bar').getBoundingClientRect(); return r.bottom < b.top && Math.abs((r.left + r.right) / 2 - (b.left + b.right) / 2) < 2; }));
await p.keyboard.type('ev'); await p.waitForTimeout(100);
console.log('"ev":', await rows(), '| no captions', !(await p.$('.tf-pal .tf-caption')));
await p.keyboard.press('ArrowDown'); await p.waitForTimeout(50); console.log('down:', await rows());
await p.keyboard.press('ArrowUp'); await p.keyboard.press('ArrowUp'); await p.waitForTimeout(50); console.log('up wraps:', await rows());
await p.keyboard.press('Backspace'); await p.keyboard.press('Backspace'); await p.keyboard.type('zebra'); await p.waitForTimeout(100);
console.log('no match says:', await p.$eval('.tf-pal-none', e => e.textContent));
await p.keyboard.press('Escape'); await p.waitForTimeout(300);
console.log('Esc closes:', !(await p.$('.tf-pal')));
/* Preview by name */
await open(); await p.keyboard.type('prev'); await p.keyboard.press('Enter'); await p.waitForTimeout(350);
console.log('Enter on Preview: pill', !!(await p.$('.tf-peek')), '| palette gone', !(await p.$('.tf-pal')));
await p.keyboard.press('Escape'); await p.waitForTimeout(300);
/* a change, then Undo and Done appear with their keys; Cmd+K while typing commits first */
await edit('h1'); await p.keyboard.type(' P'); await open();
console.log('while typing: committed', !(await p.$('[contenteditable]')), '| h1 has P', /P$/.test(await p.$eval('h1', e => e.textContent)), '| count', await p.$eval('.tf-count', c => c.textContent));
console.log('rows now:', await rows(), '| keys', await p.$$eval('.tf-keys', k => k.map(x => x.textContent).join(' ')));
await p.keyboard.type('undo'); await p.keyboard.press('Enter'); await p.waitForTimeout(300);
console.log('Undo by name: h1 back', !/P$/.test(await p.$eval('h1', e => e.textContent)));
/* Add a page lands in the sheet's Add view; a click outside closes the palette */
await open(); await p.keyboard.type('add'); await p.keyboard.press('Enter'); await p.waitForTimeout(400);
console.log('Add a page: sheet title', await p.$eval('.tf-panel-title', e => e.textContent).catch(() => '-'));
await p.keyboard.press('Escape'); await p.waitForTimeout(300);
await open(); await p.mouse.click(300, 300); await p.waitForTimeout(300);
console.log('click outside closes:', !(await p.$('.tf-pal')), '| Cmd+K again toggles', await (async () => { await open(); const a = !!(await p.$('.tf-pal')); await open(); return a && !(await p.$('.tf-pal')); })());
/* a page by name goes there */
await open(); await p.keyboard.type('abo'); await p.keyboard.press('Enter'); await p.waitForTimeout(600);
console.log('About by name: now on', p.url().split('/').pop().split('#')[0]);
await b.close();
