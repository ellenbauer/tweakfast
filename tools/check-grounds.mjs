/* Look on the header and a footer: the four fixed rows (light, dark, colour, inverted), a greyed one says why;
   the change is made on every page. Needs tools/fake-save-server.py on 8788. */
import { readFileSync } from 'fs';
import { join } from 'path';
const { chromium } = await import(process.env.TF_PLAYWRIGHT || new URL('../node_modules/playwright-core/index.mjs', import.meta.url).pathname);
const b = await chromium.launch({ executablePath: process.env.TF_CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
const p = await b.newPage({ viewport: { width: 1300, height: 850 } });
p.on('pageerror', e => console.log('PAGEERROR', e.message));
await p.goto('http://127.0.0.1:8788/demo/index.html#edit=test'); await p.waitForTimeout(1200);
const rows = () => p.$$eval('.tf-menu .tf-item', es => es.map(e => (e.classList.contains('tf-off') ? 'off:' : e.getAttribute('aria-current') ? 'now:' : '') + e.querySelector('.tf-look-word').textContent));
const grounds = {};
for (const sel of ['header', 'footer']) {
  await p.mouse.move(5, 5); const el = await p.$(sel); await el.scrollIntoViewIfNeeded(); const r = await el.boundingBox();
  await p.mouse.move(r.x + r.width - 10, r.y + 6); await p.waitForTimeout(500);
  const shown = await p.$$eval('.tf-tools > *', es => es.filter(e => getComputedStyle(e).display !== 'none').map(e => e.textContent).join(','));
  await p.click('.tf-look-open'); await p.waitForTimeout(200);
  const list = await rows();
  console.log(sel + ': only Look', shown === 'Look', '| four rows in order', list.map(w => w.split(':').pop()).join(',') === 'light,dark,colour,inverted', '|', list.join(' '),
    '| greyed say why', await p.$$eval('.tf-off', es => es.every(e => e.querySelector('.tf-look-why').textContent.length > 10)));
  await p.click('.tf-menu .tf-item:not(.tf-off):not([aria-current]) >> nth=-1'); await p.waitForTimeout(1500); /* inverted */
  grounds[sel] = await p.$eval(sel, e => getComputedStyle(e).backgroundColor);
}
await p.click('.tf-button:has-text("Done")'); await p.waitForTimeout(2500);
const saved = JSON.parse(readFileSync(join(process.env.TMPDIR || '/tmp', 'tweakfast-fake-save.json'), 'utf8')).files;
console.log('made on every page:', Object.keys(saved).sort().join(','), Object.values(saved).every(h => /<header[^>]* data-tf-tint="\w+"/.test(h) && /<footer[^>]* data-tf-tint="\w+"/.test(h)), '| grounds', JSON.stringify(grounds));
await b.close();
