/* Hover: outline and tag on the thing under the mouse, nothing on fixed parts. Serve the repo on 8787 first. */
const { chromium } = await import(process.env.TF_PLAYWRIGHT || new URL('../node_modules/playwright-core/index.mjs', import.meta.url).pathname);
const b = await chromium.launch({ executablePath: process.env.TF_CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
const p = await b.newPage({ viewport: { width: 1100, height: 800 } });
p.on('pageerror', e => console.log('PAGEERROR', e.message));
const edit = async (sel, o) => { await p.click(sel, o); await p.waitForTimeout(60); await p.click(sel, o); }; /* one click picks, the second edits */
await p.goto('http://127.0.0.1:8787/demo/index.html#edit=test'); await p.waitForTimeout(400);
const tag = () => p.$eval('.tf-tag', t => getComputedStyle(t).display === 'none' ? 'none' : t.textContent).catch(() => 'none');
const outlined = () => p.$$eval('.tf-hover', es => es.map(e => e.tagName.toLowerCase()).join(',') || 'none');
console.log('check button gone:', (await p.$$('.tf-button:has-text("Check")')).length === 0);
await p.hover('h1'); await p.waitForTimeout(100); console.log('heading: tag', await tag(), '| outlined', await outlined());
/* the line is a box of ours around the element, drawn at once, not an outline a site's transitions could fade in */
await p.mouse.move(5, 5); await p.waitForTimeout(100); const h = await p.$eval('h1', e => { const r = e.getBoundingClientRect(); return { x: r.left + 10, y: r.top + 10, top: r.top, left: r.left }; });
await p.mouse.move(h.x, h.y); await p.waitForTimeout(40);
console.log('line drawn at once, fits the heading:', await p.evaluate(h => { const b = document.querySelector('.tf-hover-box'); if (!b || getComputedStyle(b).display === 'none') return false; const r = b.getBoundingClientRect(); return Math.abs(r.top - h.top) < 1 && Math.abs(r.left - h.left) < 1 && getComputedStyle(b).transitionDuration === '0s'; }, h));
await p.hover('main img'); await p.waitForTimeout(100); console.log('picture: tag', await tag(), '| outlined', await outlined());
await p.hover('main a.button'); await p.waitForTimeout(100); console.log('link in a paragraph: tag', await tag(), '| outlined', await outlined());
await p.hover('nav a >> nth=1'); await p.waitForTimeout(100); console.log('menu (fixed): tag', await tag(), '| outlined', await outlined());
await p.hover('.tf-bar'); await p.waitForTimeout(100); console.log('the bar: tag', await tag(), '| outlined', await outlined());
/* a click on fixed text is answered once; a menu link still works */
const status = () => p.$eval('.tf-status', s => s.classList.contains('tf-show') ? s.textContent.trim() : '');
await edit('footer p'); await p.waitForTimeout(100); console.log('click on the footer (a shared part) says:', await status(), '| edits:', !!(await p.$('footer p[contenteditable]')));
await p.keyboard.press('Escape'); await p.keyboard.press('Escape'); await edit('footer p'); await p.waitForTimeout(100); console.log('second click: the shared sentence not again', !/every page/.test(await status())); await p.keyboard.press('Escape');
await p.click('nav a >> nth=1'); await p.waitForTimeout(400); console.log('menu link still goes:', !/index\.html/.test(p.url()), '| bar there:', !!(await p.$('.tf-bar')));
await p.goto('http://127.0.0.1:8787/demo/index.html#edit=test'); await p.waitForTimeout(400);
await edit('h1'); await p.waitForTimeout(100); await p.mouse.move(300, 300); await p.waitForTimeout(100);
console.log('while editing: tag', await tag(), '| outlined', await outlined());
await p.keyboard.press('Escape'); await p.hover('h1'); await p.waitForTimeout(100);
const html = await p.evaluate(() => { const d = document.documentElement.cloneNode(true); d.querySelectorAll('[data-tweakfast],#tf-style').forEach(n => n.remove()); d.querySelectorAll('.tf-hover').forEach(e => { e.classList.remove('tf-hover'); if (!e.className) e.removeAttribute('class'); }); return d.outerHTML; });
console.log('page html: no hover class', !html.includes('tf-hover'), '| no tag', !html.includes('tf-tag'));
await b.close();
