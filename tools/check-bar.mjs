/* The bar: counts what Done will make live, keyboard, the publish moment, Undo past Done. Needs tools/fake-save-server.py on 8788. */
const { chromium } = await import(process.env.TF_PLAYWRIGHT || new URL('../node_modules/playwright-core/index.mjs', import.meta.url).pathname);
const b = await chromium.launch({ executablePath: process.env.TF_CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
const p = await b.newPage({ viewport: { width: 1100, height: 800 } });
p.on('pageerror', e => console.log('PAGEERROR', e.message));
const edit = async (sel, o) => { await p.click(sel, o); await p.waitForTimeout(60); await p.click(sel, o); }; /* one click picks, the second edits */
const status = () => p.$eval('.tf-status', s => s.textContent.trim());
await p.goto('http://127.0.0.1:8788/demo/events.html?v=' + Date.now() + '#edit=test'); await p.waitForTimeout(500);
console.log('at rest the bar says:', JSON.stringify(await status()), '| buttons:', await p.$$eval('.tf-bar .tf-button', bs => bs.map(x => x.textContent).join(',')));
await edit('h1'); console.log('editing says:', await status());
await p.keyboard.press('End'); await p.keyboard.type(' A'); await p.keyboard.press('Enter'); await p.waitForTimeout(100);
const count = () => p.$eval('.tf-count', c => c.style.visibility === 'hidden' ? '-' : c.textContent);
console.log('one edit, count on Done:', await count(), '| bubble gone at rest:', ['', 'Kept. For a new line, press Shift+Enter while typing.'].includes(await status()) || await p.$eval('.tf-status', s => !s.classList.contains('tf-show')));
await p.hover('.card:nth-child(3) h3'); await p.waitForTimeout(400); await p.click('.tf-tools button:has-text("Hide")'); await p.waitForTimeout(100);
await p.click('body', { position: { x: 5, y: 700 } }); await p.waitForTimeout(100);
console.log('two edits, count on Done:', await count());
await p.keyboard.press('Meta+z'); await p.waitForTimeout(100);
console.log('Cmd+Z, count:', await count(), '| hidden left:', await p.$$eval('[data-tf-hidden]', e => e.length));
await p.keyboard.press('Meta+s'); await p.waitForTimeout(800);
console.log('Cmd+S:', await status(), '| offer:', await p.$$eval('.tf-status button', bs => bs.map(x => x.textContent).join(',')), '| undo enabled after Done:', await p.$eval('.tf-button:has-text("Undo")', e => !e.disabled));
const served = await (await fetch('http://127.0.0.1:8788/demo/events.html')).text();
console.log('saved h1 has A:', /<h1[^>]*>[^<]*A<\/h1>/.test(served));
/* Redo: Shift+Cmd+Z brings back what Undo took away, until a new change */
await edit('h1'); await p.keyboard.press('End'); await p.keyboard.type(' R'); await p.keyboard.press('Enter'); await p.waitForTimeout(100);
await p.keyboard.press('Meta+z'); await p.waitForTimeout(100);
const afterUndo = await p.$eval('h1', e => e.textContent);
await p.keyboard.press('Shift+Meta+z'); await p.waitForTimeout(100);
console.log('Redo: undo took R away:', !/R$/.test(afterUndo), '| redo brought it back:', /R$/.test(await p.$eval('h1', e => e.textContent)), '| count', await count());
await p.keyboard.press('Meta+z'); await edit('.card:nth-child(1) p'); await p.keyboard.type('n'); await p.keyboard.press('Enter'); await p.keyboard.press('Shift+Meta+z'); await p.waitForTimeout(100);
console.log('a new change ends the redo:', !/R$/.test(await p.$eval('h1', e => e.textContent)));
await p.keyboard.press('Meta+z'); await p.waitForTimeout(100);
/* Undo past Done: the site as before the last Done comes back as a change */
await p.click('.tf-button:has-text("Undo")'); await p.waitForTimeout(200);
console.log('Undo past Done:', await status(), '| h1 without A now:', !/A$/.test(await p.$eval('h1', e => e.textContent)), '| count', await count(), '| still served with A:', /<h1[^>]*>[^<]*A<\/h1>/.test(await (await fetch('http://127.0.0.1:8788/demo/events.html')).text()));
await p.click('.tf-button:has-text("Undo")'); await p.waitForTimeout(100);
console.log('Undo takes it back: h1 has A again:', /A$/.test(await p.$eval('h1', e => e.textContent)));
await p.click('.tf-button:has-text("Undo")'); await p.waitForTimeout(200); await p.click('.tf-button:has-text("Done")'); await p.waitForTimeout(800);
const back = await (await fetch('http://127.0.0.1:8788/demo/events.html')).text();
console.log('Done makes the put-back live: served h1 has A:', /<h1[^>]*>[^<]*A<\/h1>/.test(back), '| undo still there for the next Undo past Done:', await p.$eval('.tf-button:has-text("Undo")', e => !e.disabled));
await p.click('.tf-button:has-text("Site")'); await p.waitForTimeout(200); await p.keyboard.press('Escape'); await p.waitForTimeout(100);
await p.waitForTimeout(300); /* the panel fades first */ console.log('Esc closes the panel:', (await p.$$('.tf-panel')).length === 0);
/* Leave: with changes the bubble asks; a click elsewhere stays; Make live and leave saves first; clean, it just leaves */
await edit('h1'); await p.keyboard.press('End'); await p.keyboard.type(' L'); await p.keyboard.press('Enter'); await p.waitForTimeout(100);
await p.click('.tf-button:has-text("Leave")'); await p.waitForTimeout(100);
console.log('Leave asks:', await status(), '| offers:', await p.$$eval('.tf-status button', bs => bs.map(x => x.textContent).join(' / ')));
await p.click('body', { position: { x: 5, y: 300 } }); await p.waitForTimeout(100);
console.log('a click elsewhere stays:', (await status()) === '' && !!(await p.$('.tf-bar')) && /edit=/.test(await p.evaluate(() => location.hash)));
await p.click('.tf-button:has-text("Leave")'); await p.click('.tf-status button:has-text("Make live and leave")'); await p.waitForTimeout(1500);
const left = await (await fetch('http://127.0.0.1:8788/demo/events.html')).text();
console.log('made live and left: served h1 has L:', /<h1[^>]*>[^<]*L<\/h1>/.test(left), '| no bar, no key:', !(await p.$('.tf-bar')) && !/edit=/.test(await p.evaluate(() => location.hash)) && !(await p.evaluate(() => localStorage.getItem('tweakfast:key'))));
await p.goto('http://127.0.0.1:8788/demo/events.html?v=' + Date.now() + '#edit=test'); await p.waitForTimeout(400);
await p.click('.tf-button:has-text("Leave")'); await p.waitForTimeout(400);
console.log('clean Leave just leaves:', !(await p.$('.tf-bar')));
await b.close();
