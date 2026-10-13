/* A block taller than the window dragged below the next one: hold the grip near the bottom edge, the page glides,
   the swap comes as soon as the pointer is a little way into the next block. Serve the repo on 8787 first. */
const { chromium } = await import(process.env.TF_PLAYWRIGHT || new URL('../node_modules/playwright-core/index.mjs', import.meta.url).pathname);
const b = await chromium.launch({ executablePath: process.env.TF_CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
const p = await b.newPage({ viewport: { width: 1000, height: 700 } });
p.on('pageerror', e => console.log('PAGEERROR', e.message));
await p.goto('http://127.0.0.1:8787/tools/check-drag.html#edit=test'); await p.waitForTimeout(400);
const order = () => p.$$eval('main > section', es => es.map(e => e.className).join(' '));
await p.hover('section.a h2'); await p.waitForTimeout(400);
const g = await p.$eval('.tf-grip', e => { const r = e.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
await p.mouse.move(g.x, g.y); await p.mouse.down(); await p.mouse.move(g.x, g.y + 10);
/* lifted: the held block grows a little and its line carries a shadow */
console.log('lifted:', await p.evaluate(() => getComputedStyle(document.querySelector('.tf-moving')).transform !== 'none'), '| shadow on the line:', await p.evaluate(() => getComputedStyle(document.querySelector('.tf-block-box')).boxShadow !== 'none'));
/* the held block follows the pointer: moved 80 px down, it is drawn 80 px lower, and its line with it */
{ const c1 = await p.$eval('.tf-moving', e => e.getBoundingClientRect().top);
  await p.mouse.move(g.x, g.y + 90, { steps: 4 });
  const c2 = await p.$eval('.tf-moving', e => e.getBoundingClientRect().top), box = await p.$eval('.tf-block-box', e => e.getBoundingClientRect().top);
  console.log('follows the pointer:', Math.abs((c2 - c1) - 80) < 3, '| line follows:', Math.abs(box - (c2 - 6)) < 2);
  await p.mouse.move(g.x, g.y + 10, { steps: 4 }); }
/* after a swap the block that stepped aside slides, then is clean again */
{ const kin = await p.evaluate(() => [...document.querySelectorAll('.tf-moving ~ [data-tf-block], [data-tf-block]')].filter(e => !e.classList.contains('tf-moving')).length);
  const other = await p.$eval('.tf-moving + [data-tf-block], .tf-moving', e => { const o = e.nextElementSibling && e.nextElementSibling.hasAttribute('data-tf-block') ? e.nextElementSibling : null; if (!o) return null; const r = o.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height - 8, tag: o.tagName }; });
  if (other) {
    await p.mouse.move(other.x, other.y, { steps: 6 });
    const during = await p.evaluate(() => [...document.querySelectorAll('[data-tf-block]')].some(e => !e.classList.contains('tf-moving') && /^matrix\(1, 0, 0, 1, /.test(getComputedStyle(e).transform) && getComputedStyle(e).transform !== 'matrix(1, 0, 0, 1, 0, 0)'));
    await p.waitForTimeout(300);
    const after = await p.evaluate(() => [...document.querySelectorAll('[data-tf-block]')].every(e => e.classList.contains('tf-moving') || !e.style.transform));
    console.log('the other block slides:', during, '| clean after the slide:', after, '| swapped:', await order());
    await p.mouse.move(g.x, g.y + 10, { steps: 6 }); await p.waitForTimeout(300); /* back to where the glide check expects it */
    console.log('moved back for the next step:', await order());
  } else console.log('slide: (no block below to swap with)'); }
await p.mouse.move(g.x, 690, { steps: 10 });
let t = 0; while (t < 4000 && (await order()).startsWith('a')) { await p.waitForTimeout(50); t += 50; } /* the pointer holds still */
console.log('tall block below the short one after', t, 'ms of gliding:', await order());
await p.mouse.up(); await p.waitForTimeout(100);
await p.waitForTimeout(250);
console.log('after drop:', await order(), '| undo enabled:', await p.$eval('.tf-button:has-text("Undo")', e => !e.disabled), '| settled, nothing of ours left on it:', await p.$$eval('main > section', es => es.every(e => !/transition|transform|z-index|will-change/.test(e.getAttribute('style') || '') && !e.classList.contains('tf-moving'))));
await p.click('.tf-button:has-text("Undo")'); await p.waitForTimeout(100);
console.log('after Undo:', await order());
/* letting go without a swap is not a click on what lies under the pointer */
await p.hover('section.b h2'); await p.waitForTimeout(400);
const g2 = await p.$eval('.tf-grip', e => { const r = e.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
let clicks = 0; await p.exposeFunction('tfClicked', () => clicks++); await p.evaluate(() => document.querySelector('section.b h2').addEventListener('click', () => window.tfClicked()));
await p.mouse.move(g2.x, g2.y); await p.mouse.down(); await p.mouse.move(g2.x - 30, g2.y + 30, { steps: 3 }); await p.mouse.up(); await p.waitForTimeout(100);
console.log('release without a swap: editing started', (await p.$$('[contenteditable]')).length, '| dragging class left', await p.$eval('body', b => b.classList.contains('tf-dragging')));
/* a missed release: the grip is held, then a move arrives with no button */
await p.hover('section.a h2'); await p.waitForTimeout(400);
const g3 = await p.$eval('.tf-grip', e => { const r = e.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
await p.mouse.move(g3.x, g3.y); await p.mouse.down(); await p.mouse.move(g3.x, g3.y + 20);
await p.evaluate(() => document.querySelector('.tf-grip').dispatchEvent(new PointerEvent('pointermove', { clientX: 300, clientY: 690, buttons: 0, pointerId: 1, bubbles: true })));
await p.waitForTimeout(600);
console.log('after a move with no button: dragging', await p.$eval('body', b => b.classList.contains('tf-dragging')), '| order unchanged:', await order());
await p.mouse.up();
/* a Done inside the settle's 170 ms must not save our animation styles */
{ await p.keyboard.press('Escape'); await p.mouse.move(5, 5); await p.waitForTimeout(100); await p.hover('section.a h2'); await p.waitForTimeout(400);
  const g4 = await p.$eval('.tf-grip', e => { const r = e.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
  const t4 = await p.$eval('section.b', e => { const r = e.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.bottom - 20 }; });
  await p.mouse.move(g4.x, g4.y); await p.mouse.down(); await p.mouse.move(g4.x, g4.y + 10); await p.mouse.move(t4.x, t4.y, { steps: 6 });
  await p.mouse.up();
  await p.evaluate(() => { window._blob = null; const c = URL.createObjectURL; URL.createObjectURL = b => { window._blob = b; return c(b); }; });
  await p.click('.tf-button:has-text("Done")');
  const out = await p.evaluate(() => window._blob ? window._blob.text() : '');
  console.log('Done right after a drop: nothing of ours in the file:', !/transition: transform|scale\(1\.015\)|will-change|2147482998/.test(out), '| moved:', /class="b"[\s\S]*class="a"/.test(out)); }
await b.close();
