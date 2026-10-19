/* What a picture shows: the Describes field under a clicked picture. Serve the repo on 8787 first. */
const { chromium } = await import(process.env.TF_PLAYWRIGHT || new URL('../node_modules/playwright-core/index.mjs', import.meta.url).pathname);
const b = await chromium.launch({ executablePath: process.env.TF_CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
const p = await b.newPage({ viewport: { width: 1100, height: 800 } });
p.on('pageerror', e => console.log('PAGEERROR', e.message));
await p.goto('http://127.0.0.1:8787/demo/index.html#edit=test'); await p.waitForTimeout(400);
const field = () => p.$$eval('.tf-link', es => es.filter(e => e.textContent.indexOf('Describes') === 0).length);
const alt = () => p.$eval('main img', i => i.getAttribute('alt'));
console.log('before: field', await field(), '| alt:', await alt());
/* a click selects: solid line, the small bar with Describes and Replace; no chooser yet */
let opened = false; p.on('filechooser', () => { opened = true; });
await p.click('main img'); await p.waitForTimeout(200);
console.log('picture clicked: no chooser', !opened, '| line on it:', await p.evaluate(() => { const r = document.querySelector('main img').getBoundingClientRect(), b = document.querySelector('.tf-edit-box').getBoundingClientRect(); return getComputedStyle(document.querySelector('.tf-edit-box')).display === 'block' && Math.abs(b.top - r.top) < 1; }), '| field', await field(), '| shows:', await p.inputValue('.tf-link input'), '| Replace there:', (await p.$$('.tf-tools button:has-text("Replace")')).length === 1);
const [chooser] = await Promise.all([p.waitForEvent('filechooser'), p.click('main img')]); await p.waitForTimeout(200);
console.log('second click opens the chooser:', !!chooser);
await p.fill('.tf-link input', 'A cup on the garden table'); await p.keyboard.press('Enter'); await p.waitForTimeout(150);
console.log('after Enter: alt:', await alt(), '| field', await field(), '| undo enabled', await p.$eval('.tf-button:has-text("Undo")', e => !e.disabled));
await p.click('.tf-button:has-text("Undo")'); await p.waitForTimeout(100);
console.log('after Undo: alt:', await alt());
await p.click('main img'); await p.waitForTimeout(200);
await p.fill('.tf-link input', 'Typed then clicked away'); await p.click('h1'); await p.waitForTimeout(150);
console.log('click away keeps it: alt:', await alt(), '| field gone', (await field()) === 0, '| line moved to the text:', await p.evaluate(() => { const r = document.querySelector('h1').getBoundingClientRect(), b = document.querySelector('.tf-edit-box').getBoundingClientRect(); return Math.abs(b.top - r.top) < 1; }));
await p.keyboard.press('Escape');
/* Replace opens the chooser */
await p.click('main img'); await p.waitForTimeout(200);
const [c3] = await Promise.all([p.waitForEvent('filechooser'), p.click('.tf-tools button:has-text("Replace")')]); await p.waitForTimeout(200);
await c3.setFiles(new URL('pic.png', import.meta.url).pathname); await p.waitForTimeout(800);
console.log('new picture: field', await field(), '| emptied:', (await p.inputValue('.tf-link input')) === '', '| caret in it:', await p.evaluate(() => document.activeElement === document.querySelector('.tf-link input')), '| placeholder says why:', /blind readers/.test(await p.$eval('.tf-link input', i => i.placeholder)), '| src is new:', (await p.$eval('main img', i => i.src)).startsWith('data:'), '| hint:', await p.$eval('.tf-status', s => s.textContent.trim()));
/* a file dropped from the desktop replaces the picture; the hint is not said again; a drop elsewhere is told */
const png = (await import('node:fs')).readFileSync(new URL('pic.png', import.meta.url).pathname).toString('base64');
const dropFile = async (sel, x, y) => p.evaluate(async ({ sel, png, x, y }) => {
  const bin = atob(png), arr = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  const dt = new DataTransfer(); dt.items.add(new File([arr], 'drop.png', { type: 'image/png' }));
  const el = sel ? document.querySelector(sel) : document.elementFromPoint(x, y);
  const r = el.getBoundingClientRect(); const o = { bubbles: true, cancelable: true, clientX: r.left + 10, clientY: r.top + 10, dataTransfer: dt };
  el.dispatchEvent(new DragEvent('dragenter', o)); el.dispatchEvent(new DragEvent('dragover', o));
  const line = getComputedStyle(document.querySelector('.tf-hover-box')).display === 'block';
  el.dispatchEvent(new DragEvent('drop', o)); return line;
}, { sel, png, x, y });
await p.keyboard.press('Escape'); await p.click('.tf-button:has-text("Undo")'); await p.waitForTimeout(100);
const count = () => p.$eval('.tf-count', c => c.style.visibility === 'hidden' ? 0 : +c.textContent);
const before = await count();
const lineWhileDragging = await dropFile('main img'); await p.waitForTimeout(800);
console.log('dropped on the picture: line while dragging', lineWhileDragging, '| replaced (one more change):', (await count()) === before + 1 && (await p.$eval('main img', i => i.src)).startsWith('data:'), '| picked:', await p.$eval('.tf-edit-box', e => getComputedStyle(e).display === 'block'), '| status:', await p.$eval('.tf-status', s => s.textContent.trim()), '| hint not said again:', !/part shown/.test(await p.$eval('.tf-status', s => s.classList.contains('tf-show') ? s.textContent : '')));
await dropFile(null, 5, 5); await p.waitForTimeout(100);
console.log('dropped elsewhere says:', await p.$eval('.tf-status', s => s.textContent.trim()), '| page still here:', /index\.html/.test(p.url()));
await p.fill('.tf-link input', 'The new one'); await p.keyboard.press('Enter'); await p.waitForTimeout(100);
const html = await p.evaluate(() => { const d = document.documentElement.cloneNode(true); d.querySelectorAll('[data-tweakfast],#tf-style').forEach(n => n.remove()); return d.outerHTML; });
console.log('page html: field gone', !html.includes('Describes'), '| description in it', html.includes('alt="The new one"'));
await b.close();
