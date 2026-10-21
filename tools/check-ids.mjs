/* A copied section keeps the look its id gave it (Bary's #team { padding-top } in tools/_sw): the copy wears team-2 with
   the site's #team rules written for it in one style in the head, through a draft brought back after a reload, Undo (rules
   gone with the copy), Redo (back), Done and a reload, and the readers' view; a reference inside the copy follows the new
   id; an id nothing depends on goes. Needs a FRESH tools/fake-save-server.py on 8788 and tools/_sw. */
const { chromium } = await import(process.env.TF_PLAYWRIGHT || new URL('../node_modules/playwright-core/index.mjs', import.meta.url).pathname);
const b = await chromium.launch({ executablePath: process.env.TF_CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
const p = await b.newPage({ viewport: { width: 1600, height: 1000 } });
p.on('pageerror', e => console.log('PAGEERROR', e.message));
const PORT = process.env.TF_PORT || 8788;
let fails = 0;
const state = () => p.evaluate(() => {
  const a = document.getElementById('team'), n = a && a.nextElementSibling, c = n && n.tagName === 'SECTION' && n.id !== 'testimonials' && !n.hasAttribute('data-tweakfast') ? n : null;
  const pad = n => n ? Math.round(parseFloat(getComputedStyle(n).paddingTop)) : null;
  const sheets = [...document.head.querySelectorAll('style[data-tf-id]')].map(s => s.getAttribute('data-tf-id'));
  return { copy: !!c, id: c && c.id, pad: pad(a), copyPad: pad(c), sheets, h2: c && c.querySelector('h2') ? Math.round(parseFloat(getComputedStyle(c.querySelector('h2')).marginTop)) : null, h2was: a.querySelector('h2') ? Math.round(parseFloat(getComputedStyle(a.querySelector('h2')).marginTop)) : null };
});
const say = async (label, want) => {
  const r = await state(), ok = want.copy === r.copy && (!want.copy || (r.id === 'team-2' && r.copyPad === r.pad && r.h2 === r.h2was)) && r.sheets.join() === (want.copy ? 'team-2' : '');
  if (!ok) fails++;
  console.log((ok ? 'ok   ' : 'FAIL ') + label + ': copy', r.copy, '| id', r.id, '| padding', r.pad, '→', r.copyPad, '| h2 margin', r.h2was, '→', r.h2, '| sheets', JSON.stringify(r.sheets));
};
const load = async (h) => { await p.goto('http://127.0.0.1:' + PORT + '/tools/_sw/index.html?v=' + Date.now() + h); await p.waitForSelector('.tf-bar, .tf-pages', { timeout: 15000 }); await p.waitForTimeout(900); await p.click('.tf-button:has-text("Got it")').catch(() => {}); };
await load('#edit=test');
await say('before', { copy: false });
const pickBlock = async (page, sel) => { /* a click on the block itself, off its words and pictures: selected, its toolbar up */
  await page.$eval(sel, e => e.scrollIntoView({ block: 'center' })); await page.waitForTimeout(200);
  const at = await page.$eval(sel, e => { const b = e.getBoundingClientRect(), pr = window.__tweakfastProbe, tries = [[b.width - 6, b.height - 6], [b.width - 6, 6], [6, b.height - 6], [b.width / 2, b.height - 4], [b.width - 4, b.height / 2], [b.width / 2, 4]];
    for (const [x, y] of tries) { const hit = document.elementFromPoint(b.left + x, b.top + y); if (hit && e.contains(hit) && !pr.textTarget(hit) && !pr.pictureTarget(hit) && !hit.closest('a[href],button,.tf-plus,[data-tweakfast]') && (pr.blockTarget(hit) || e) === e) return { x, y }; }
    return { x: b.width - 6, y: b.height - 6 }; });
  await page.click(sel, { position: at }); await page.waitForTimeout(300);
  if (await page.$eval('.tf-edit-box', e => getComputedStyle(e).display === 'block').catch(() => false)) { await page.keyboard.press('Escape'); await page.waitForTimeout(120); } };
await pickBlock(p, '#team');
await p.click('.tf-tools button[aria-label="More"]'); await p.click('.tf-menu button:has-text("Copy")'); await p.waitForTimeout(800); /* the block tools wait behind More on a desk */
await say('copied', { copy: true });
await p.reload(); await p.waitForSelector('.tf-bar, .tf-pages', { timeout: 15000 }); await p.waitForTimeout(1200);
await say('draft back after reload', { copy: true });
await p.keyboard.press('Meta+z'); await p.waitForTimeout(400); await say('after Undo', { copy: false });
await p.keyboard.press('Meta+Shift+z'); await p.waitForTimeout(400); await say('after Redo', { copy: true });
await p.keyboard.press('Escape'); await p.keyboard.press('Escape');
await p.click('.tf-button:has-text("Done")'); await p.waitForTimeout(2500);
await load('#edit=test'); await say('after Done and reload', { copy: true });
await p.goto('http://127.0.0.1:' + PORT + '/tools/_sw/index.html?v=' + Date.now() + '#view'); await p.waitForTimeout(900); await say('readers', { copy: true });
/* a reference inside follows, an unused id goes: one block in a scratch page */
await p.setContent('<!doctype html><style>#faq{padding-top:40px}#faq-2{color:red}</style><section id="faq" aria-labelledby="faq-title"><h2 id="faq-title">Q</h2><p id="loose">A</p><a href="#faq-title">top</a></section>');
const ref = await p.evaluate(async () => {
  const s = await (await fetch('http://127.0.0.1:' + location.port + '/src/tweakfast-editor.js')).text(); /* the functions alone */
  const pick = name => { const i = s.indexOf('    function ' + name + '('); let d = 0, j = i; do { const ch = s[j]; if (ch === '{') d++; else if (ch === '}') d--; j++; } while (d || s[j - 1] !== '}'); return s.slice(i, j); };
  const src = ['idRe', 'siteSheets', 'eachRule', 'selectorsText', 'idNamed', 'idRules', 'idStyle', 'freshIds'].map(pick).join('\n');
  const fn = new Function("var REFS = ['aria-labelledby', 'aria-describedby', 'aria-controls', 'aria-owns', 'for', 'href'];" + src + '; return freshIds;')();
  const twin = document.getElementById('faq').cloneNode(true); fn(twin); document.body.appendChild(twin);
  return { id: twin.id, by: twin.getAttribute('aria-labelledby'), h2: twin.querySelector('h2').id, href: twin.querySelector('a').getAttribute('href'), loose: twin.querySelector('p').hasAttribute('id'), pad: getComputedStyle(twin).paddingTop, sheet: document.head.querySelector('style[data-tf-id]') && document.head.querySelector('style[data-tf-id]').textContent };
});
const okRef = ref.id === 'faq-3' && ref.by === 'faq-title-2' && ref.h2 === 'faq-title-2' && ref.href === '#faq-title-2' && !ref.loose && ref.pad === '40px';
if (!okRef) fails++;
console.log((okRef ? 'ok   ' : 'FAIL ') + 'references: ', JSON.stringify(ref));
await b.close();
console.log(fails ? fails + ' FAILED' : 'ALL GREEN');
process.exit(fails ? 1 : 0);
