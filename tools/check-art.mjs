/* A drawn box (painted by the stylesheet, no words, no picture) takes a photo as its background; an unpainted one does not. Needs tools/fake-save-server.py on 8788. */
import fs from 'node:fs';
const { chromium } = await import(process.env.TF_PLAYWRIGHT || new URL('../node_modules/playwright-core/index.mjs', import.meta.url).pathname);
const LOG = (process.env.TMPDIR || '/tmp') + '/tweakfast-fake-save.json';
const b = await chromium.launch({ executablePath: process.env.TF_CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
const p = await b.newPage({ viewport: { width: 1100, height: 800 } });
p.on('pageerror', e => console.log('PAGEERROR', e.message));
await p.goto('http://127.0.0.1:8788/tools/check-art.html#edit=test'); await p.waitForTimeout(400);
/* an earlier run may have saved this page on the fake server: the page as the maker made it goes back first */
await p.evaluate(async (html) => { await fetch('/api/save', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ key: 'test', force: true, files: { 'check-art.html': html } }) }); }, fs.readFileSync(new URL('check-art.html', import.meta.url).pathname, 'utf8'));
await p.goto('http://127.0.0.1:8788/tools/check-art.html?v=' + Date.now() + '#edit=test'); await p.waitForTimeout(400);
await p.hover('.art'); await p.waitForTimeout(100);
console.log('hover on the drawn box: line', await p.$eval('.tf-hover-box', e => getComputedStyle(e).display === 'block'), '| pointer', await p.$eval('.art', e => getComputedStyle(e).cursor), '| no tag', await p.$eval('.tf-tag', e => getComputedStyle(e).display === 'none').catch(() => true));
await p.hover('.plain'); await p.waitForTimeout(100);
console.log('an unpainted box: no line', await p.$eval('.tf-hover-box', e => getComputedStyle(e).display === 'none'));
await p.click('.art'); await p.waitForTimeout(200);
console.log('click selects: solid line', await p.$eval('.tf-edit-box', e => getComputedStyle(e).display === 'block'), '| bar: Replace only', await p.$eval('.tf-link', e => e.classList.contains('tf-art') && getComputedStyle(e.querySelector('.tf-input')).display === 'none' && [...e.querySelectorAll('button')].map(x => x.textContent).join() === 'Replace'));
const styleBefore = await p.$eval('.art', e => e.getAttribute('style') || ''); /* a second run on the same fake server starts from the saved page */
const [chooser] = await Promise.all([p.waitForEvent('filechooser'), p.click('.tf-link button:has-text("Replace")')]);
await chooser.setFiles(new URL('pic.png', import.meta.url).pathname); await p.waitForTimeout(800);
console.log('photo laid in as a picture over the box:', await p.$eval('.art', e => { const i = e.querySelector('img'); return !!i && i.src.startsWith('data:') && getComputedStyle(i).position === 'absolute' && i.getBoundingClientRect().width === e.getBoundingClientRect().width; }), '| covers the drawing:', await p.evaluate(() => { const e = document.querySelector('.art'), r = e.getBoundingClientRect(); return document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2).tagName === 'IMG'; }), '| now selected as a picture, Describes shown:', await p.$eval('.tf-link', e => !e.classList.contains('tf-art')), '| count', await p.$eval('.tf-count', c => c.textContent));
await p.click('.tf-button:has-text("Undo")'); await p.waitForTimeout(100);
console.log('Undo brings the drawing back:', (await p.$eval('.art', e => e.getAttribute('style') || '')) === styleBefore && !(await p.$('.art img')));
await p.keyboard.press('Shift+Meta+z'); await p.waitForTimeout(100);
await p.click('.tf-button:has-text("Done")');
await p.waitForFunction(() => /Live|failed|right now|wrong|elsewhere|large/.test(document.querySelector('.tf-status').textContent), null, { timeout: 8000 }).catch(() => {}); await p.waitForTimeout(100);
console.log('after Done:', await p.$eval('.tf-status', s => s.textContent.trim()));
const sent = JSON.parse(fs.readFileSync(LOG, 'utf8'));
console.log('Done: picture file sent', Object.keys(sent.pictures).join(','), '| page refers to the file', /<img[^>]*src="pictures\/tf-\d+-0\.png"/.test(sent.files['check-art.html']), '| no data url left', !/data:image/.test(sent.files['check-art.html']), '| no art mark', !/data-tf-art/.test(sent.files['check-art.html']), '| live picture renamed', await p.$eval('.art img', e => /pictures\/tf-/.test(e.getAttribute('src'))));
/* an inline SVG mark is a picture: Replace puts a picture in its place; the box with words drawn on it says so once */
await p.goto('http://127.0.0.1:8788/tools/check-art.html#edit=test'); await p.waitForTimeout(400);
await p.hover('header a.mark'); await p.waitForTimeout(80);
console.log('svg mark: hover tag', await p.$eval('.tf-tag', t => t.textContent), '| line', await p.$eval('.tf-hover-box', e => getComputedStyle(e).display === 'block'));
await p.click('header a.mark'); await p.waitForTimeout(150);
console.log('click selects it, Replace only:', await p.$eval('.tf-link', e => e.classList.contains('tf-art') && [...e.querySelectorAll('button')].map(x => x.textContent).join() === 'Replace'), '| no navigation', /check-art/.test(p.url()));
const [ch] = await Promise.all([p.waitForEvent('filechooser'), p.click('.tf-link button:has-text("Replace")')]);
await ch.setFiles(new URL('pic.png', import.meta.url).pathname); await p.waitForTimeout(800);
console.log('picture in its place:', await p.$eval('header a.mark', a => !a.querySelector('svg') && !!a.querySelector('img') && a.querySelector('img').src.startsWith('data:') && a.querySelector('img').style.width === '120px'), '| said:', await p.$eval('.tf-status', s => s.textContent.trim()));
await p.click('.tf-button:has-text("Undo")'); await p.waitForTimeout(100);
console.log('Undo brings the mark back:', await p.$eval('header a.mark', a => !!a.querySelector('svg') && !a.querySelector('img')));
await p.goto('http://127.0.0.1:8787/tools/check-art.html#edit=test'); await p.waitForTimeout(400); /* the page as the maker made it, not the saved one */
await p.evaluate(() => sessionStorage.clear());
await p.click('.art'); await p.waitForTimeout(200);
console.log('drawn words notice:', await p.$eval('.tf-status', s => s.textContent.trim()));
await b.close();
