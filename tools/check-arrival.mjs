/* arrival: the tab says Edit, a wrong link is told at once and locks the editor, the saved page keeps its own title.
   Needs tools/fake-save-server.py on 8788 (serving the repo). TF_PLAYWRIGHT / TF_CHROME as in the other checks. */
const { chromium } = await import(process.env.TF_PLAYWRIGHT || new URL('../node_modules/playwright-core/index.mjs', import.meta.url).pathname);
const fs = await import('node:fs');
const LOG = (process.env.TMPDIR || '/tmp') + '/tweakfast-fake-save.json';
const b = await chromium.launch({ executablePath: process.env.TF_CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
const p = await b.newPage({ viewport: { width: 1100, height: 900 } });
p.on('pageerror', e => console.log('PAGEERROR', e.message));
const edit = async (sel, o) => { await p.click(sel, o); await p.waitForTimeout(60); await p.click(sel, o); }; /* one click picks, the second edits */
const act = async (row, word) => { await p.hover(row); await p.click(row + ' button[title="More"]'); await p.click('.tf-menu button:has-text("' + word + '")'); };
await p.goto('http://127.0.0.1:8788/demo/index.html#edit=test'); await p.waitForTimeout(400);
console.log('tab title:', await p.title(), '| bar quiet:', (await p.textContent('.tf-status')) === '');
console.log('first visit card:', await p.textContent('.tf-card-title'), await p.textContent('.tf-card-text'), '| above the bar:', await p.evaluate(() => document.querySelector('.tf-card').getBoundingClientRect().bottom < document.querySelector('.tf-bar').getBoundingClientRect().top));
await p.click('.tf-card .tf-button'); await p.waitForTimeout(300); /* the card fades first */ console.log('Got it removes it:', await p.evaluate(() => !document.querySelector('.tf-card')));
await p.reload(); await p.waitForTimeout(300); console.log('not shown again:', await p.evaluate(() => !document.querySelector('.tf-card')));
await edit('h1'); await p.keyboard.type('A'); await p.keyboard.press('Enter');
await p.hover('.tf-button:has-text("Site")'); await p.click('.tf-button:has-text("Site")'); await act('.tf-row.tf-here', 'Words for Google'); await p.waitForTimeout(200);
console.log('Google title field shows the real title:', await p.inputValue('.tf-words input >> nth=0'));
await p.keyboard.press('Escape');
try { fs.unlinkSync(LOG); } catch (e) {}
await p.click('.tf-button:has-text("Done")'); await p.waitForTimeout(600);
const saved = JSON.parse(fs.readFileSync(LOG, 'utf8'));
const m = /<title>([^<]*)<\/title>/.exec(saved.files['index.html'] || '');
console.log('saved title has no Edit prefix:', m && m[1], '|', m && !/^Edit/.test(m[1]));
await p.evaluate(() => localStorage.clear());
await p.goto('http://127.0.0.1:8788/demo/about.html#edit=wrong-old-link'); await p.waitForTimeout(500);
console.log('wrong link told:', await p.textContent('.tf-status'), '| as an error, above the bar:', await p.evaluate(() => { const s = document.querySelector('.tf-status'); return s.classList.contains('tf-error') && s.getBoundingClientRect().bottom < document.querySelector('.tf-bar').getBoundingClientRect().top; }));
console.log('Done disabled:', await p.$eval('.tf-button:has-text("Done")', b => b.disabled), '| Pages disabled:', await p.$eval('.tf-button:has-text("Site")', b => b.disabled));
await p.click('h1'); await p.waitForTimeout(100);
console.log('click edits nothing:', await p.evaluate(() => !document.querySelector('[contenteditable]')));
await p.hover('p'); await p.waitForTimeout(100);
console.log('no hover outline:', await p.evaluate(() => !document.querySelector('.tf-hover')));
console.log('key forgotten:', await p.evaluate(() => !localStorage.getItem('tweakfast:key')));
await b.close();
