/* needs playwright-core: `npm install playwright-core` in the repo, or TF_PLAYWRIGHT=<path to its index.mjs>; TF_CHROME overrides the browser */
const { chromium } = await import(process.env.TF_PLAYWRIGHT || new URL('../node_modules/playwright-core/index.mjs', import.meta.url).pathname);
import fs from 'fs';
const LOG = (process.env.TMPDIR || '/tmp') + '/tweakfast-fake-save.json';
const b = await chromium.launch({ executablePath: process.env.TF_CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
const p = await b.newPage({ viewport: { width: 1100, height: 900 } });
p.on('pageerror', e => console.log('PAGEERROR', e.message));
const edit = async (sel, o) => { await p.click(sel, o); await p.waitForTimeout(60); await p.click(sel, o); }; /* one click picks, the second edits */
const act = async (row, word) => { await p.hover(row); await p.click(row + ' button[title="More"]'); await p.click('.tf-menu button:has-text("' + word + '")'); };
await p.goto('http://127.0.0.1:8788/demo/events.html#edit=test');
await p.waitForTimeout(300);
await edit('h1'); await p.keyboard.type('!'); await p.keyboard.press('Enter');
await p.click('.card:nth-child(1) img'); await p.waitForTimeout(100); /* first click picks */
const [chooser] = await Promise.all([p.waitForEvent('filechooser'), p.click('.card:nth-child(1) img')]);
await chooser.setFiles(new URL('pic.png', import.meta.url).pathname);
await p.waitForFunction(() => document.querySelector('.card:nth-child(1) img').src.startsWith('data:'));
await p.click('.tf-button:has-text("Site")'); await act('.tf-row:has-text("Contact")', 'Hide from the menu');
await p.waitForFunction(() => /Hidden from the menu/.test(document.querySelector('.tf-status').textContent));
await p.click('.tf-button:has-text("Done")');
await p.waitForFunction(() => /Saved|Live|failed|may not/.test(document.querySelector('.tf-status').textContent));
console.log('status:', await p.textContent('.tf-status'));
const sent = JSON.parse(fs.readFileSync(LOG, 'utf8'));
console.log('key sent:', sent.key, '| files:', Object.keys(sent.files).sort().join(', '), '| pictures:', Object.keys(sent.pictures).join(', '), 'bytes', Object.values(sent.pictures)[0]?.length);
console.log('events.html references the file:', /pictures\/tf-\d+-0\.png/.test(sent.files['events.html']), '| no data url left:', !/src="data:/.test(sent.files['events.html']), '| h1 edited:', /Events!/.test(sent.files['events.html']), '| contact hidden in index:', /contact\.html" hidden/.test(sent.files['index.html']));
console.log('live img renamed:', await p.evaluate(() => document.querySelector('.card:nth-child(1) img').getAttribute('src')), '| undo disabled:', await p.locator('.tf-button:has-text("Undo")').isDisabled());
const status = () => p.textContent('.tf-status');
/* offline: a plain sentence, changes kept, Done works again once back */
await edit('h1'); await p.keyboard.type('?'); await p.keyboard.press('Enter');
await p.context().setOffline(true);
await p.click('.tf-button:has-text("Done")');
await p.waitForFunction(() => /reach|Saved|Live/.test(document.querySelector('.tf-status').textContent));
console.log('offline:', await status(), '| done enabled again:', !(await p.locator('.tf-button:has-text("Done")').isDisabled()));
await p.context().setOffline(false);
await p.click('.tf-button:has-text("Done")');
await p.waitForFunction(() => /Saved|Live|failed|reach/.test(document.querySelector('.tf-status').textContent));
console.log('back online:', await status());
/* a broken route: still a sentence, not a parse error */
await p.evaluate(() => localStorage.setItem('tweakfast:key', 'boom'));
await p.goto('http://127.0.0.1:8788/demo/events.html?v=2'); await p.waitForTimeout(300); /* past the browser's cache; the fake serves by name */
console.log('served page carries the updated tag:', await p.evaluate(() => /<meta name="tweakfast-updated"/.test(document.documentElement.outerHTML) === false && /[!?]/.test(document.querySelector('h1').textContent)), '(tag taken out of the live page, saved text served)');
await edit('h1'); await p.keyboard.type('x'); await p.keyboard.press('Enter');
await p.click('.tf-button:has-text("Done")');
await p.waitForFunction(() => /right now|Saved|Live/.test(document.querySelector('.tf-status').textContent));
console.log('500:', await status(), '| no code in it:', !/\d{3}/.test(await status()));
/* a dead link at Done: the arrival sentence, and the work can be saved as files */
await p.evaluate(() => localStorage.setItem('tweakfast:key', 'dead'));
await p.route('**/api/check', route => route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' })); /* the key dies after arrival */
await p.goto('http://127.0.0.1:8788/demo/events.html?v=2b'); await p.waitForTimeout(300);
await edit('h1'); await p.keyboard.type('d'); await p.keyboard.press('Enter');
await p.click('.tf-button:has-text("Done")');
await p.waitForFunction(() => /no longer works|Live/.test(document.querySelector('.tf-status').textContent));
console.log('dead link at Done:', await status(), '| offer:', await p.$$eval('.tf-status button', bs => bs.map(x => x.textContent).join(',')), '| changes kept:', await p.$eval('.tf-count', c => c.textContent));
await p.unroute('**/api/check');
/* changed elsewhere: refused, then Keep mine */
await p.evaluate(() => localStorage.setItem('tweakfast:key', 'test'));
await p.goto('http://127.0.0.1:8788/demo/events.html?v=3'); await p.waitForTimeout(300);
const other = await p.evaluate(async () => { const r = await fetch('/api/save', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ key: 'test', force: true, files: { 'events.html': '<!doctype html>\n<html><head><title>x</title></head><body><main><h1>From the other device</h1></main></body></html>' } }) }); return (await r.json()).ok; });
await edit('h1'); await p.keyboard.type('y'); await p.keyboard.press('Enter');
await p.click('.tf-button:has-text("Done")');
await p.waitForFunction(() => /elsewhere|Saved|Live/.test(document.querySelector('.tf-status').textContent));
console.log('other device saved:', other, '| stale:', await status(), '| offers:', await p.evaluate(() => [...document.querySelectorAll('.tf-status .tf-offer')].map(b => b.textContent).join(' / ')));
await p.click('.tf-offer:has-text("Keep mine")');
await p.waitForFunction(() => /Saved|Live/.test(document.querySelector('.tf-status').textContent));
const forced = JSON.parse(fs.readFileSync(LOG, 'utf8'));
console.log('after Keep mine:', await status(), '| force sent:', forced.force, '| h1 saved:', /<h1>[^<]*y<\/h1>/.test(forced.files['events.html']), '| updated sent:', forced.updated['events.html'] !== '', '| no updated tag saved back:', !/tweakfast-updated/.test(forced.files['events.html']));
/* edits made while saving stay counted; Undo rests while saving; Live carries the check */
await p.evaluate(() => localStorage.setItem('tweakfast:key', 'test'));
await p.goto('http://127.0.0.1:8788/demo/events.html?v=4'); await p.waitForTimeout(300);
await p.route('**/api/save', async route => { await new Promise(r => setTimeout(r, 900)); route.continue(); });
await edit('h1'); await p.keyboard.press('End'); await p.keyboard.type(' S'); await p.keyboard.press('Enter');
await p.click('.tf-button:has-text("Done")'); await p.waitForTimeout(150);
console.log('while saving: undo rests:', await p.locator('.tf-button:has-text("Undo")').isDisabled(), '| done rests:', await p.locator('.tf-button:has-text("Done")').isDisabled());
await edit('.card:nth-child(1) p'); await p.keyboard.press('End'); await p.keyboard.type(' late'); await p.keyboard.press('Enter');
await p.waitForFunction(() => /Live/.test(document.querySelector('.tf-status').textContent)); await p.waitForTimeout(100);
console.log('after Live: the late edit still counted:', await p.$eval('.tf-count', c => c.textContent + (c.style.visibility === 'hidden' ? ' (hidden)' : '')), '| check mark:', await p.$eval('.tf-status', s => s.classList.contains('tf-live') && getComputedStyle(s, '::before').backgroundImage.includes('svg')));
await p.unroute('**/api/save');
await p.click('.tf-button:has-text("Done")'); await p.waitForFunction(() => /Live/.test(document.querySelector('.tf-status').textContent)); await p.waitForTimeout(100);
const late = JSON.parse(fs.readFileSync(LOG, 'utf8'));
console.log('second Done saved the late edit:', / late/.test(late.files['events.html']), '| h1 kept S:', /S<\/h1>/.test(late.files['events.html']));
/* told early: when the tab comes back to the front and the page was saved elsewhere */
await p.goto('http://127.0.0.1:8788/demo/events.html?v=5'); await p.waitForTimeout(300);
await p.evaluate(async () => { await fetch('/api/save', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ key: 'test', force: true, files: { 'events.html': '<!doctype html>\n<html><head><title>x</title></head><body><main><h1>From the phone</h1></main><script src="../src/tweakfast.js"></script></body></html>' } }) }); });
await p.evaluate(() => document.dispatchEvent(new Event('visibilitychange'))); await p.waitForTimeout(400);
console.log('back to the front, nothing unsaved:', await status(), '| offer:', await p.$$eval('.tf-status button', bs => bs.map(x => x.textContent).join(',')));
await p.goto('http://127.0.0.1:8788/demo/events.html?v=6'); await p.waitForTimeout(300);
await edit('h1'); await p.keyboard.type('w'); await p.keyboard.press('Enter');
await p.evaluate(async () => { await fetch('/api/save', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ key: 'test', force: true, files: { 'events.html': '<!doctype html>\n<html><head><title>x</title></head><body><main><h1>From the phone again</h1></main><script src="../src/tweakfast.js"></script></body></html>' } }) }); });
await p.evaluate(() => document.dispatchEvent(new Event('visibilitychange'))); await p.waitForTimeout(400);
console.log('back to the front, with changes:', await status(), '| count kept:', await p.$eval('.tf-count', c => c.textContent));
await p.evaluate(() => document.dispatchEvent(new Event('visibilitychange'))); await p.waitForTimeout(400);
console.log('said once per stamp:', await p.$eval('.tf-status', s => s.textContent.trim()) !== '' );
/* the real page back on the fake server, for the checks that run after this one */
const real = fs.readFileSync(new URL('../demo/events.html', import.meta.url).pathname, 'utf8');
await p.evaluate(async (html) => { await fetch('/api/save', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ key: 'test', force: true, files: { 'events.html': html } }) }); }, real);
await b.close();
