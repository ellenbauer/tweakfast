/* A section whose ground is a photo takes a colour: COLOUR offers Picture (the way it came, ticked) and the site's colours;
   a colour puts the photo away (kept in the page, unseen: the room stays), Picture or Undo brings it back; a wash over the
   photo goes with it; words straight on the photo grey the rows they would not read on; Done keeps it for readers.
   Needs tools/fake-save-server.py on 8788. */
const { chromium } = await import(process.env.TF_PLAYWRIGHT || new URL('../node_modules/playwright-core/index.mjs', import.meta.url).pathname);
const b = await chromium.launch({ executablePath: process.env.TF_CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
const p = await b.newPage({ viewport: { width: 1200, height: 900 } });
p.on('pageerror', e => console.log('PAGEERROR', e.message));
await p.goto('http://127.0.0.1:8788/tools/check-picture-ground.html?v=' + Date.now() + '#edit=test'); await p.waitForTimeout(1500);
await p.click('.tf-button:has-text("Got it")').catch(() => {});
const rows = () => p.$$eval('.tf-menu .tf-item', es => es.map(e => (e.getAttribute('aria-current') ? 'now:' : '') + (e.classList.contains('tf-off') ? 'off:' : '') + e.textContent.trim().toLowerCase().replace(/\s+/g, ' ')));
const state = sel => p.$eval(sel, s => { const img = s.querySelector('img'), st = s.querySelector('style[data-tf-tint]'); return { bg: getComputedStyle(s).backgroundColor, h: Math.round(s.getBoundingClientRect().height), img: getComputedStyle(img).visibility, wash: s.querySelector('.wash') ? getComputedStyle(s.querySelector('.wash')).visibility : '-', away: !!st && st.hasAttribute('data-tf-away'), tint: !!st }; });
const pick = async (sel, x, y) => { await p.mouse.move(5, 5); const r = await (await p.$(sel)).boundingBox(); await p.mouse.click(r.x + x, r.y + y); await p.waitForTimeout(400); };
const buttons = () => p.$$eval('.tf-tools .tf-button', es => es.filter(e => getComputedStyle(e).display !== 'none').map(e => e.textContent.trim()).join(','));
const open = async () => { await p.click('.tf-look-open'); await p.waitForTimeout(300); return rows(); };
const take = async word => { await p.click('.tf-menu .tf-item:has-text("' + word + '")'); await p.waitForTimeout(900); };

/* the hero: a card on the photo */
await pick('.hero', 60, 200);
const was = await state('.hero');
console.log('hero picked: buttons', await buttons(), '| picture showing', was.img === 'visible', 'no tint', !was.tint);
let list = await open(); console.log('menu:', list.join(' '), '| Picture first and ticked', list[0] === 'now:picture', '| its strip is the photo', await p.$eval('.tf-menu .tf-swatch-pic', c => /father-and-son/.test(getComputedStyle(c).backgroundImage)));
await take('Light');
let now = await state('.hero');
console.log('Light: photo away', now.img === 'hidden', '| room kept', now.h === was.h, '(' + was.h + ')', '| ground', now.bg, '| away in tint', now.away, '| buttons', await buttons());
list = await open(); console.log('menu again:', list.join(' '), '| Light ticked', list.includes('now:light'));
await take('Picture');
now = await state('.hero'); console.log('Picture: photo back', now.img === 'visible', '| no tint', !now.tint);
list = await open(); await take('Dark'); now = await state('.hero'); console.log('Dark: photo away', now.img === 'hidden', 'ground', now.bg);
await p.click('.tf-button:has-text("Undo")'); await p.waitForTimeout(600);
now = await state('.hero'); console.log('Undo: photo back', now.img === 'visible', '| no tint', !now.tint);

/* words straight on the photo, a wash over it */
await pick('.words', 600, 280);
list = await open(); console.log('words menu:', list.join(' '), '| Picture ticked', list[0] === 'now:picture');
const reads = () => p.$eval('.words h2', h => { const c = s => s.match(/\d+/g).map(Number), L = v => { const f = x => { x /= 255; return x <= .03928 ? x / 12.92 : Math.pow((x + .055) / 1.055, 2.4); }; return .2126 * f(v[0]) + .7152 * f(v[1]) + .0722 * f(v[2]); }; let n = h; for (; n; n = n.parentElement) { const bg = getComputedStyle(n).backgroundColor; if (!/rgba\(0, 0, 0, 0\)|transparent/.test(bg)) break; } const a = L(c(getComputedStyle(h).color)), z = L(c(getComputedStyle(n).backgroundColor)); return Math.round((Math.max(a, z) + .05) / (Math.min(a, z) + .05) * 10) / 10; });
await take('Light'); now = await state('.words');
console.log('words Light: photo away', now.img === 'hidden', '| wash away', now.wash === 'hidden', '| ground', now.bg, '| white words took the ink: contrast', await reads());
await p.screenshot({ path: (process.env.TMPDIR || '/tmp') + '/words-light.png', clip: { x: 0, y: 0, width: 1200, height: 900 } });
await open(); await take('Dark'); now = await state('.words');
console.log('words Dark: photo away', now.img === 'hidden', '| wash away', now.wash === 'hidden', '| ground', now.bg, '| contrast', await reads());

/* a plain section: as before */
await pick('.plain', 600, 60); list = await open(); console.log('plain menu unchanged:', list.join(' '), '| no picture row', !list.some(r => r.includes('picture')));
await p.keyboard.press('Escape');

/* Done: readers get the photo away */
await pick('.hero', 60, 200); await open(); await take('Light');
await p.click('.tf-button:has-text("Done")'); await p.waitForTimeout(2500);
const r = await b.newPage({ viewport: { width: 1200, height: 900 } });
await r.goto('http://127.0.0.1:8788/tools/check-picture-ground.html#view'); await r.waitForTimeout(800);
console.log('readers: hero photo away', await r.$eval('.hero img', i => getComputedStyle(i).visibility) === 'hidden', '| words photo + wash away', await r.$eval('.words', s => getComputedStyle(s.querySelector('img')).visibility + '/' + getComputedStyle(s.querySelector('.wash')).visibility), '| hero room', await r.$eval('.hero', s => Math.round(s.getBoundingClientRect().height)) === was.h, '| saved rule', await r.$eval('.hero style[data-tf-tint]', s => /visibility:hidden/.test(s.textContent) && s.hasAttribute('data-tf-away')));
await b.close();
