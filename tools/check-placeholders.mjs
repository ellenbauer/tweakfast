/* A copy's placeholders: a decoration keeps its look (one screen readers skip, one that can be neither clicked nor
   selected), a title drawn one box per letter becomes one New heading, words inside a text are blanked with it, a link
   inside keeps its place. Serve the repo on 8787 first. */
const { chromium } = await import(process.env.TF_PLAYWRIGHT || new URL('../node_modules/playwright-core/index.mjs', import.meta.url).pathname);
const b = await chromium.launch({ executablePath: process.env.TF_CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
const p = await b.newPage({ viewport: { width: 1000, height: 700 } }); p.on('pageerror', e => console.log('PAGEERROR', e.message));
await p.goto('http://127.0.0.1:8787/tools/check-placeholders.html#edit=test'); await p.waitForTimeout(1200);
const r = await (await p.$('section')).boundingBox(); await p.mouse.move(r.x + r.width - 30, r.y + 20); await p.waitForTimeout(600);
await p.click('.tf-tools [aria-label="Copy"]'); await p.waitForTimeout(800);
const c = await p.evaluate(() => { const s = document.querySelectorAll('main > section')[1]; return { big: s.querySelector('.big').textContent, mark: s.querySelector('[aria-hidden]').textContent, h2: s.querySelector('h2').textContent, said: s.querySelector('h2').getAttribute('aria-label'), p: s.querySelector('p').textContent, marks: !!s.querySelector('[data-tf-deco]') }; });
console.log('decorations kept:', c.big === '波' && c.mark === '✦', '| boxed title:', c.h2 === 'New heading' && c.said === null, '| inner words blanked, link kept:', !/Words|inner/.test(c.p) && /a link/.test(c.p), '| no marks left:', !c.marks);
await b.close();
