/* Click to edit: the hover line turns solid and follows the text, the hint is said three times, Tab moves on, an emptied text says so. */
const { chromium } = await import(process.env.TF_PLAYWRIGHT || new URL('../node_modules/playwright-core/index.mjs', import.meta.url).pathname);
const b = await chromium.launch({ executablePath: process.env.TF_CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
const p = await b.newPage({ viewport: { width: 1100, height: 800 } });
p.on('pageerror', e => console.log('PAGEERROR', e.message));
const edit = async (sel, o) => { await p.click(sel, o); await p.waitForTimeout(60); await p.click(sel, o); }; /* one click picks, the second edits */
const status = () => p.$eval('.tf-status', s => s.classList.contains('tf-show') ? s.textContent.trim() : '');
const fits = (sel) => p.evaluate(sel => { const r = document.querySelector(sel).getBoundingClientRect(), e = document.querySelector('.tf-edit-box').getBoundingClientRect(); return getComputedStyle(document.querySelector('.tf-edit-box')).display === 'block' && Math.abs(e.left - r.left + 3) < 1 && Math.abs(e.width - r.width - 6) < 1 && Math.abs(e.height - r.height - 6) < 1; }, sel);
await p.goto('http://127.0.0.1:8787/demo/events.html#edit=test'); await p.waitForTimeout(300);
await p.hover('h1'); await p.waitForTimeout(50);
const hoverRect = await p.$eval('.tf-hover-box', e => JSON.stringify(e.getBoundingClientRect()));
await edit('h1'); await p.waitForTimeout(50);
const editRect = await p.$eval('.tf-edit-box', e => JSON.stringify(e.getBoundingClientRect()));
console.log('hover line becomes the editing line:', hoverRect === editRect, '| hover line gone:', await p.$eval('.tf-hover-box', e => getComputedStyle(e).display === 'none'), '| no outline on the element:', await p.$eval('h1', e => getComputedStyle(e).outlineStyle === 'none'));
console.log('hint 1:', await status());
const h = await p.$eval('h1', e => e.getBoundingClientRect().height);
await p.keyboard.press('End'); await p.keyboard.press('Shift+Enter'); await p.keyboard.type('second line'); await p.waitForTimeout(50);
console.log('Shift+Enter makes a line:', await p.$eval('h1', e => e.innerHTML.includes('<br>')), '| text grew:', await p.$eval('h1', e => e.getBoundingClientRect().height) > h, '| line follows:', await fits('h1'));
await p.keyboard.press('Escape'); await p.waitForTimeout(50);
console.log('Esc put back:', await p.$eval('h1', e => !e.innerHTML.includes('<br>')), '| still picked, line stays:', await p.$eval('.tf-edit-box', e => getComputedStyle(e).display === 'block'));
await p.keyboard.press('Escape'); await p.waitForTimeout(50);
console.log('Esc again: line gone:', await p.$eval('.tf-edit-box', e => getComputedStyle(e).display === 'none'));
/* Tab keeps and opens the next text */
await edit('h1'); await p.keyboard.press('End'); await p.keyboard.type(' T'); await p.keyboard.press('Tab'); await p.waitForTimeout(50);
console.log('Tab kept:', await p.$eval('h1', e => /T$/.test(e.textContent)), '| next text open:', await p.evaluate(() => { const e = document.querySelector('[contenteditable]'); return e && e !== document.querySelector('h1') ? e.tagName + ' ' + e.textContent.slice(0, 20) : 'none'; }), '| line on it:', await p.evaluate(() => { const e = document.querySelector('[contenteditable]'), r = e.getBoundingClientRect(), b = document.querySelector('.tf-edit-box').getBoundingClientRect(); return Math.abs(b.top - r.top + 3) < 1; }));
await p.keyboard.press('Shift+Tab'); await p.waitForTimeout(50);
console.log('Shift+Tab back on the h1:', await p.evaluate(() => document.querySelector('[contenteditable]') === document.querySelector('h1')));
console.log('hint said on the first three edits only:', await p.evaluate(() => sessionStorage.getItem('tweakfast:hints')) === '3', '| fourth edit (Shift+Tab) quiet:', (await status()) === '');
await p.keyboard.press('Escape');
/* a fifth edit: quiet */
await edit('.card:nth-child(1) p'); await p.waitForTimeout(50);
console.log('fifth edit, no hint:', (await status()) === '');
/* emptied: the box keeps a line of height, and keeping it says so */
await p.keyboard.press('Meta+a'); await p.keyboard.press('Backspace'); await p.waitForTimeout(50);
console.log('emptied, still a line high:', await p.$eval('.card:nth-child(1) p', e => e.getBoundingClientRect().height >= 14));
await p.keyboard.press('Enter'); await p.waitForTimeout(50);
console.log('kept empty says:', await status());
await p.click('.tf-button:has-text("Undo")'); await p.waitForTimeout(50);
console.log('Undo brought it back:', await p.$eval('.card:nth-child(1) p', e => e.textContent.length > 10));
/* text by what it holds: a bare div with words is text; a div holding blocks is not; a div of spans edits as one */
await p.goto('http://127.0.0.1:8787/tools/check-text.html#edit=test'); await p.waitForTimeout(300);
console.log('the heading\'s ink reaches the label:', await p.$eval('.eyebrow', e => { const r = e.getBoundingClientRect(); return document.elementFromPoint(r.left + 20, r.top + r.height / 2).tagName === 'H1'; }));
await p.hover('.eyebrow'); await p.waitForTimeout(50);
console.log('bare div label: hover line on the label, not the heading', await p.evaluate(() => { const b = document.querySelector('.tf-hover-box').getBoundingClientRect(), r = document.querySelector('.eyebrow').getBoundingClientRect(); return getComputedStyle(document.querySelector('.tf-hover-box')).display === 'block' && Math.abs(b.top - (r.top - 3)) < 1; }));
await edit('.eyebrow'); await p.waitForTimeout(50);
console.log('click edits it:', await p.evaluate(() => document.querySelector('[contenteditable]') === document.querySelector('.eyebrow')));
await p.keyboard.press('Escape');
await p.click('.card', { position: { x: 4, y: 4 } }); await p.waitForTimeout(50);
console.log('a div of blocks is not text:', !(await p.$('[contenteditable]')), '| it has block tools:', await p.evaluate(() => getComputedStyle(document.querySelector('.tf-tools')).display === 'flex'));
await p.keyboard.press('Escape'); await p.keyboard.press('Escape'); await edit('.ticker span'); await p.waitForTimeout(50);
console.log('a div of spans edits as one:', await p.evaluate(() => document.querySelector('[contenteditable]') === document.querySelector('.ticker')));
await p.keyboard.press('Shift+Tab'); await p.waitForTimeout(50);
console.log('Shift+Tab from it goes back to the card text:', await p.evaluate(() => { const e = document.querySelector('[contenteditable]'); return e ? e.tagName : 'none'; }) === 'P');
await b.close();
