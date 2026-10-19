/* The 2026-10-14 sweep, one line each: Undo waits for the other pages; a hidden block keeps its own shape and its own
   display; a picture with other sizes really changes; a list item's copy keeps its icon; a moving strip clicked and
   left is no change; Undo of a hidden page takes its noindex too; nothing drops in Preview; the site's rules for plain
   tags do not reach the editor; the changes list says Hid. Needs the repo on 8787 and a fresh tools/fake-save-server.py on 8788. */
const { chromium } = await import(process.env.TF_PLAYWRIGHT || new URL('../node_modules/playwright-core/index.mjs', import.meta.url).pathname);
const b = await chromium.launch({ executablePath: process.env.TF_CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
const p = await b.newPage({ viewport: { width: 1100, height: 800 } });
p.on('pageerror', e => console.log('PAGEERROR', e.message));
const edit = async (sel, o) => { await p.click(sel, o); await p.waitForTimeout(60); await p.click(sel, o); };
const count = () => p.$eval('.tf-count', e => e.style.visibility === 'hidden' ? '0' : e.textContent);
const tool = async (title) => p.click(`.tf-tools button[aria-label="${title}"]`);
const html = () => p.evaluate(() => { const c = document.documentElement.cloneNode(true); return c.outerHTML; });

/* 1. a footer change, then Undo at once: Undo waits, then takes it from every page */
await p.goto('http://127.0.0.1:8788/demo/events.html#edit=test'); await p.waitForTimeout(400);
await p.click('.tf-button:has-text("Got it")').catch(() => {});
await edit('footer p'); await p.keyboard.press('End'); await p.keyboard.type(' Z'); await p.keyboard.press('Enter');
await p.keyboard.press('Meta+z'); /* while the other pages are still loading */
await p.waitForTimeout(600); await p.keyboard.press('Meta+z'); await p.waitForTimeout(300);
console.log('footer, Undo at once: count', await count(), '| footer back:', !/ Z$/.test(await p.textContent('footer p')));
await p.click('.tf-button:has-text("Done")').catch(() => {}); await p.waitForTimeout(300);
const about = await (await fetch('http://127.0.0.1:8788/demo/about.html?x=' + Date.now())).text();
console.log('no footer change reached About:', !/ Z<\/p>/.test(about));

/* 2-8 on the fixture */
await p.goto('http://127.0.0.1:8787/tools/check-sweep.html#edit=test'); await p.waitForTimeout(500);
await p.click('.feats li:nth-child(1) span'); await p.waitForTimeout(150);
const liDisplay = () => p.$eval('.feats li', e => getComputedStyle(e).display);
const before = await liDisplay();
await tool('Hide'); await p.waitForTimeout(150);
const live = await p.$eval('.feats li', e => ({ d: getComputedStyle(e).display, op: getComputedStyle(e).opacity, hidden: e.hasAttribute('hidden') }));
const saved = await p.evaluate(() => { const c = document.querySelector('.feats li').cloneNode(true); return c; }).catch(() => null);
console.log('hidden list item keeps its shape here:', live.d === before, '| faded:', live.op < 1, '| no hidden attr live:', !live.hidden);
await tool('Show'); await p.waitForTimeout(100);
await p.click('.card:nth-child(1) h3'); await p.waitForTimeout(150); await p.keyboard.press('Escape');
await p.click('.card:nth-child(1) p'); await p.waitForTimeout(150);
const cardTools = await p.$$eval('.tf-tools button', bs => bs.map(x => x.getAttribute('aria-label')).join(','));
await tool('Hide'); await p.waitForTimeout(100);
console.log('hidden grid card stays flex here:', await p.$eval('.card', e => getComputedStyle(e).display), '| tools were:', cardTools);
await tool('Show'); await p.waitForTimeout(100);
console.log('shown again, own inline display kept:', await p.$eval('.card', e => e.getAttribute('style')));
/* the saved form, through Done with no route: the downloaded file */
await p.evaluate(() => { window._blobs = []; const c = URL.createObjectURL; URL.createObjectURL = x => { window._blobs.push(x); return c(x); }; });
await tool('Hide'); await p.waitForTimeout(100);
await p.click('.tf-button:has-text("Done")'); await p.waitForTimeout(500);
const out = await p.evaluate(async () => window._blobs.length ? await window._blobs[window._blobs.length - 1].text() : '');
const card = out.slice(out.indexOf('<div class="cards"'), out.indexOf('</article>', out.indexOf('<div class="cards"')));
console.log('saved hidden card: hidden', /hidden=""/.test(card), '| display none', /display: none/.test(card), '| own display kept aside', /data-tf-display="flex"/.test(card));
/* the changes list names it */
await p.goto('http://127.0.0.1:8787/tools/check-sweep.html?b#edit=test'); await p.waitForTimeout(500);
await p.click('.card:nth-child(2) p'); await p.waitForTimeout(150); await tool('Hide'); await p.waitForTimeout(100);
await p.click('.tf-count'); await p.waitForTimeout(200);
console.log('changes list:', await p.$$eval('.tf-changes .tf-row-name', rs => rs.map(r => r.textContent).join(' / ')));
await p.keyboard.press('Escape'); await p.click('.tf-button:has-text("Undo")');
/* 4. a list item's copy keeps its icon */
await p.click('.feats li:nth-child(2) span'); await p.waitForTimeout(150); await p.keyboard.press('Escape');
await p.click('.feats li:nth-child(2) span'); await p.waitForTimeout(150);
const n0 = await p.$$eval('.feats li:not([data-tweakfast])', l => l.length);
const plus = await p.$('.feats .tf-plus');
if (plus) { await p.click('.feats .tf-plus span'); } else { await tool('Copy'); }
await p.waitForTimeout(200);
console.log('list item copy:', await p.$$eval('.feats li:not([data-tweakfast])', l => l.length) - n0, 'more | icon kept:', await p.$eval('.feats li:nth-child(3)', e => !!e.querySelector('svg')), '| words:', await p.$eval('.feats li:nth-child(3)', e => e.textContent.trim()));
await p.keyboard.press('Escape'); await p.keyboard.press('Escape');
await p.click('.tf-button:has-text("Undo")'); await p.waitForTimeout(100);
/* 5. a moving strip clicked and left alone is no change */
const c0 = await count();
await edit('.ticker span', { force: true }); await p.waitForTimeout(150); await p.keyboard.press('Enter'); await p.waitForTimeout(150); await p.mouse.click(1000, 30);
console.log('strip clicked and left: count before', c0, 'after', await count());
/* 3. a picture with other sizes: the new one is what shows */
await p.click('img.resp'); await p.waitForTimeout(150);
const [ch] = await Promise.all([p.waitForEvent('filechooser'), p.click('img.resp')]);
await ch.setFiles(new URL('pic.png', import.meta.url).pathname);
await p.waitForFunction(() => document.querySelector('img.resp').src.startsWith('data:'));
await p.waitForTimeout(200);
console.log('srcset picture: shows the new one:', await p.$eval('img.resp', i => i.currentSrc.startsWith('data:')), '| srcset gone:', await p.$eval('img.resp', i => !i.hasAttribute('srcset')));
await p.keyboard.press('Escape'); await p.click('.tf-button:has-text("Undo")'); await p.waitForTimeout(100);
console.log('Undo: srcset back:', await p.$eval('img.resp', i => i.getAttribute('srcset')));
/* 8. the site's button rule does not reach the bar */
console.log('bar buttons untouched by the site:', await p.$eval('.tf-bar .tf-button', e => { const c = getComputedStyle(e); return c.textTransform + ' ' + c.letterSpacing + ' ' + c.marginTop; }));
/* 7. nothing drops in Preview */
await p.keyboard.press('Escape');
await p.click('.tf-bar button[aria-label="Preview"]').catch(() => p.click('.tf-bar .tf-button:nth-child(3)'));
await p.waitForTimeout(200);
const c1 = await count();
await p.evaluate(() => { const dt = new DataTransfer(); dt.items.add(new File([new Uint8Array([137,80,78,71])], 'x.png', { type: 'image/png' })); const img = document.querySelector('img.resp'); for (const t of ['dragover', 'drop']) img.dispatchEvent(new DragEvent(t, { bubbles: true, cancelable: true, dataTransfer: dt })); });
await p.waitForTimeout(400);
console.log('drop in Preview: picture kept:', await p.$eval('img.resp', i => !i.src.startsWith('data:')), '| count', c1, '->', await count());
await p.keyboard.press('Escape');
/* 6. a page hidden, then Undo: its noindex goes too */
await p.goto('http://127.0.0.1:8788/demo/contact.html?n#edit=test'); await p.waitForTimeout(500);
if (!(await p.$('.tf-panel:not(.tf-pal):not(.tf-out)'))) { await p.click('.tf-pages'); await p.waitForTimeout(150); } await p.waitForTimeout(200);
await p.hover('.tf-row[data-path="contact.html"]'); await p.click('.tf-row[data-path="contact.html"] button[aria-label="More"], .tf-row[data-path="contact.html"] button:has-text("More")'); await p.waitForTimeout(200);
await p.click('.tf-menu button:has-text("Hide")').catch(e => console.log('no Hide in the row menu:', e.message.split('\n')[0]));
await p.waitForTimeout(800);
const ni = () => p.evaluate(() => !!document.querySelector('meta[name="robots"][content="noindex"]'));
console.log('hidden: noindex here', await ni());
await p.keyboard.press('Escape'); await p.keyboard.press('Escape');
await p.click('.tf-button:has-text("Undo")'); await p.waitForTimeout(200);
console.log('Undo: noindex gone', !(await ni()), '| count', await count());
await b.close();
