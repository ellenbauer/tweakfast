/* Fit: a box made to the size of its words (a pill) grows with longer words instead of spilling them; words that fit leave it as made; Undo and Esc put it back. Serve the repo on 8787 first. */
const { chromium } = await import(process.env.TF_PLAYWRIGHT || new URL('../node_modules/playwright-core/index.mjs', import.meta.url).pathname);
const b = await chromium.launch({ executablePath: process.env.TF_CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
const p = await b.newPage({ viewport: { width: 1100, height: 800 } });
p.on('pageerror', e => console.log('PAGEERROR', e.message));
await p.goto('http://127.0.0.1:8787/tools/check-fit.html#edit=test'); await p.waitForTimeout(400);
const fit = sel => p.$eval(sel, t => { const r = t.getBoundingClientRect(), rg = document.createRange(); rg.selectNodeContents(t); const w = rg.getBoundingClientRect(); return { inside: w.left >= r.left - 1 && w.right <= r.right + 1 && w.top >= r.top - 1 && w.bottom <= r.bottom + 1, w: Math.round(r.width), h: Math.round(r.height), style: t.getAttribute('style') || '' }; });
const edit = async sel => { await p.click(sel); await p.waitForTimeout(60); await p.click(sel); await p.waitForTimeout(60); await p.keyboard.press('End'); };
await edit('.tag'); await p.keyboard.type(' for you and your whole family');
let f = await fit('.tag'); console.log('one line, wider: words inside', f.inside, '| height kept', f.h === 40, '| wider', f.w > 159);
await p.keyboard.type(' at home, every day of the week, with care from our whole team of nurses');
f = await fit('.tag'); console.log('at the column, taller: words inside', f.inside, '| width at most the column', f.w <= 600, '| taller', f.h > 40);
await p.keyboard.press('Enter'); await p.waitForTimeout(80); f = await fit('.tag'); console.log('kept grown:', f.inside && f.h > 40);
await p.click('.tf-bar >> text=Undo'); await p.waitForTimeout(120); f = await fit('.tag'); console.log('Undo: as made', f.w === 159 && f.h === 40 && !f.style);
await edit('.tag'); await p.keyboard.type(' and many more words'); await p.keyboard.press('Escape'); await p.waitForTimeout(80); f = await fit('.tag'); console.log('Esc: as made', f.w === 159 && f.h === 40 && !f.style);
await edit('.tag'); await p.keyboard.type(' and more'); for (let i = 0; i < 9; i++) await p.keyboard.press('Backspace'); await p.keyboard.press('Enter'); await p.waitForTimeout(80); f = await fit('.tag'); console.log('typed and taken back: as made', f.w === 159 && !f.style);
await edit('.free'); await p.keyboard.type(' And more, and more, and more, and more, and more, and more words.'); await p.keyboard.press('Enter'); await p.waitForTimeout(80); f = await fit('.free'); console.log('free paragraph: no style added', !f.style);
await edit('.long'); for (let i = 0; i < 4; i++) await p.keyboard.type(' Our experienced team of professionals provides compassionate and reliable care to enhance your quality of life.');
let sec = await p.$eval('.fixed', n => ({ h: n.offsetHeight, inside: n.scrollHeight <= n.clientHeight + 1 }));
console.log('fixed-height section grows with its words:', sec.inside && sec.h > 200);
await p.keyboard.press('Enter'); await p.waitForTimeout(80); sec = await p.$eval('.fixed', n => ({ inside: n.scrollHeight <= n.clientHeight + 1, next: document.querySelector('.next').getBoundingClientRect().top >= n.getBoundingClientRect().bottom - 1 })); console.log('kept: words inside', sec.inside, '| next part below it', sec.next);
await p.click('.tf-bar >> text=Undo'); await p.waitForTimeout(120); console.log('Undo: section as made', await p.$eval('.fixed', n => n.offsetHeight === 200 && !n.getAttribute('style')));
await edit('.one'); await p.keyboard.type(' Services and much more for you');
let one = await p.$eval('.one', n => ({ inside: n.scrollWidth <= n.clientWidth + 1, wide: n.offsetWidth, sideways: document.documentElement.scrollWidth > innerWidth }));
console.log('one-line heading at the column wraps: words inside', one.inside, '| no sideways page', !one.sideways, '| not widened', one.wide <= 600);
await p.keyboard.press('Escape'); await p.waitForTimeout(80); console.log('Esc: heading as made', await p.$eval('.one', n => !n.getAttribute('style')));
/* one word wider than the column (letters typed without a space): while edited it breaks exactly as it will be kept; kept, it stays in the page */
await edit('.one'); await p.keyboard.type(' ServicesServicesServicesServicesServicesServicesServicesServicesServices');
let word = await p.$eval('.one', n => ({ inside: n.scrollWidth <= n.clientWidth + 1, sideways: document.documentElement.scrollWidth > innerWidth, wrap: getComputedStyle(n).overflowWrap, h: n.offsetHeight }));
console.log('long word while edited: inside', word.inside, '| no sideways page', !word.sideways, '| broken by the fit, not the browser', word.wrap === 'anywhere');
await p.keyboard.press('Enter'); await p.waitForTimeout(80);
let kept = await p.$eval('.one', n => ({ inside: n.scrollWidth <= n.clientWidth + 1, sideways: document.documentElement.scrollWidth > innerWidth, h: n.offsetHeight }));
console.log('kept: inside', kept.inside, '| no sideways page', !kept.sideways, '| same height as while edited', kept.h === word.h);
await p.click('.tf-bar >> text=Undo'); await p.waitForTimeout(120); console.log('Undo: heading as made', await p.$eval('.one', n => !n.getAttribute('style')));
/* a column sized by its longest word (a grid's fr column): a long word widens the column without spilling and pushes the art beside it away */
const split = () => p.evaluate(() => ({ col: Math.round(document.querySelector('.col').getBoundingClientRect().width), art: Math.round(document.querySelector('.art').getBoundingClientRect().left), wrap: getComputedStyle(document.querySelector('.col')).overflowWrap }));
await p.click('.tf-card .tf-button', { timeout: 1000 }).catch(() => {}); await p.waitForTimeout(100); /* the welcome card sits low, over this heading */
const made = await split();
await edit('.col'); await p.keyboard.type('dddddddddddddddd');
const grown = await split();
console.log('long word in a grid column: column kept', grown.col === made.col, '| art stays', grown.art === made.art, '| broken by the fit', grown.wrap === 'anywhere');
await p.keyboard.press('Enter'); await p.waitForTimeout(80);
const keptCol = await split(); console.log('kept: column kept', keptCol.col === made.col, '| art stays', keptCol.art === made.art);
await p.click('.tf-bar >> text=Undo'); await p.waitForTimeout(120); console.log('Undo: heading as made', await p.$eval('.col', n => !n.getAttribute('style')));
await p.click('.col'); await p.waitForTimeout(60); await p.click('.col'); await p.waitForTimeout(60); await p.keyboard.press('End'); await p.keyboard.type(' and tea'); await p.keyboard.press('Enter'); await p.waitForTimeout(80);
console.log('words with spaces: no break rule added', await p.$eval('.col', n => getComputedStyle(n).overflowWrap !== 'anywhere'));
await b.close();
