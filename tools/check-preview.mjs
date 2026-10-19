/* Preview: the page as readers see it. Every editor piece gone, hidden blocks gone, nothing edits; Back to editing or Esc
   brings the editor back with the changes still counted. Serve the repo on 8787 first. */
const { chromium } = await import(process.env.TF_PLAYWRIGHT || new URL('../node_modules/playwright-core/index.mjs', import.meta.url).pathname);
const b = await chromium.launch({ executablePath: process.env.TF_CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
const p = await b.newPage({ viewport: { width: 1100, height: 800 } });
p.on('pageerror', e => console.log('PAGEERROR', e.message));
const pickBlock = async (page, sel) => { /* a click on the block itself, off its words and pictures: selected, its toolbar up */
  const at = await page.$eval(sel, e => { const b = e.getBoundingClientRect(), pr = window.__tweakfastProbe, tries = [[b.width - 6, b.height - 6], [b.width - 6, 6], [6, b.height - 6], [b.width / 2, b.height - 4], [b.width - 4, b.height / 2], [b.width / 2, 4]];
    for (const [x, y] of tries) { const hit = document.elementFromPoint(b.left + x, b.top + y); if (hit && e.contains(hit) && !pr.textTarget(hit) && !pr.pictureTarget(hit) && !hit.closest('a[href],button,.tf-plus,[data-tweakfast]') && (pr.blockTarget(hit) || e) === e) return { x, y }; }
    return { x: b.width - 6, y: b.height - 6 }; });
  await page.click(sel, { position: at }); await page.waitForTimeout(150);
  if (await page.$eval('.tf-edit-box', e => getComputedStyle(e).display === 'block').catch(() => false)) { await page.keyboard.press('Escape'); await page.waitForTimeout(120); } }; /* a block covered by its picture or words: the click took those; Esc steps out to the block */
const edit = async (sel, o) => { await p.click(sel, o); await p.waitForTimeout(60); await p.click(sel, o); }; /* one click picks, the second edits */
const count = () => p.$eval('.tf-count', c => c.style.visibility === 'hidden' ? '-' : c.textContent);
const shown = sel => p.$eval(sel, e => getComputedStyle(e).display !== 'none').catch(() => false);
await p.goto('http://127.0.0.1:8787/demo/events.html#edit=test'); await p.waitForTimeout(400);
await p.click('.tf-button:has-text("Got it")').catch(() => {});
await edit('h1'); await p.keyboard.press('End'); await p.keyboard.type(' P'); await p.keyboard.press('Enter'); await p.waitForTimeout(300);
await pickBlock(p, '.card:nth-child(2)'); await p.click('.tf-tools button[aria-label="Hide"]'); await p.waitForTimeout(300);
console.log('before: count', await count(), '| hidden card faded', await p.$eval('[data-tf-hidden]', e => getComputedStyle(e).display === 'block' && getComputedStyle(e).opacity === '0.35'));
await p.click('.tf-bar button[aria-label="Preview"]'); await p.waitForTimeout(300);
console.log('preview: bar gone', !(await shown('.tf-bar')), '| plus gone', !(await shown('.tf-plus')), '| hidden card gone', !(await shown('[data-tf-hidden]')), '| pill says', await p.$eval('.tf-peek', e => e.textContent), '| edit kept', /P$/.test(await p.$eval('h1', e => e.textContent)));
await p.hover('h1'); await p.waitForTimeout(200);
console.log('hover shows no line', !(await shown('.tf-hover-box')), '| cursor plain', await p.$eval('h1', e => getComputedStyle(e).cursor) !== 'text');
await p.click('h1'); await p.waitForTimeout(200);
console.log('click edits nothing', !(await p.$('[contenteditable]')), '| tools stay away', !(await shown('.tf-tools')));
await p.click('.tf-peek button'); await p.waitForTimeout(300);
console.log('back: bar there', await shown('.tf-bar'), '| count', await count(), '| hidden card faded again', await p.$eval('[data-tf-hidden]', e => getComputedStyle(e).display === 'block'), '| pill gone', !(await p.$('.tf-peek')));
await p.click('.tf-bar button[aria-label="Preview"]'); await p.waitForTimeout(200); await p.keyboard.press('Escape'); await p.waitForTimeout(200);
console.log('Esc leaves the preview too', await shown('.tf-bar'), '| count', await count());
await b.close();
