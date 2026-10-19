/* needs playwright-core: `npm install playwright-core` in the repo, or TF_PLAYWRIGHT=<path to its index.mjs>; TF_CHROME overrides the browser */
const { chromium } = await import(process.env.TF_PLAYWRIGHT || new URL('../node_modules/playwright-core/index.mjs', import.meta.url).pathname);
const b = await chromium.launch({ executablePath: process.env.TF_CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
const p = await b.newPage({ viewport: { width: 1100, height: 900 } });
p.on('pageerror', e => console.log('PAGEERROR', e.message));
const edit = async (sel, o) => { await p.click(sel, o); await p.waitForTimeout(60); await p.click(sel, o); }; /* one click picks, the second edits */
const act = async (row, word) => { await p.hover(row); await p.click(row + ' button[aria-label="More"]'); await p.click('.tf-menu button:has-text("' + word + '")'); };
await p.goto('http://127.0.0.1:8787/demo/about.html#edit=test');
const nav = () => p.evaluate(() => [...document.querySelectorAll('header nav a')].map(a => a.textContent + (a.hasAttribute('data-tf-hidden') ? '(hidden)' : '')).join(' | '));
if (!(await p.$('.tf-panel:not(.tf-pal):not(.tf-out)'))) { await p.click('.tf-pages'); await p.waitForTimeout(150); }
console.log('panel rows:', await p.evaluate(() => [...document.querySelectorAll('.tf-row')].map(r => r.textContent.trim()).join(' / ')));
/* the name is the way to the page, the current one is marked, the buttons show on the hovered row only */
console.log('current page marked:', await p.$eval('.tf-row.tf-here .tf-row-name', e => e.textContent + ' bold=' + (getComputedStyle(e).fontWeight >= 600)), '| filled + check, no dot:', await p.$eval('.tf-row.tf-here', r => getComputedStyle(r).backgroundColor !== 'rgba(0, 0, 0, 0)' && !!r.querySelector('.tf-row-check svg') && getComputedStyle(r.querySelector('.tf-row-name'), '::before').content === 'none'), '| names are links:', await p.$$eval('.tf-row-name', es => es.every(e => e.tagName === 'A' && /\.html$/.test(e.getAttribute('href')))));
console.log('buttons hidden at rest:', await p.$eval('.tf-row:not(.tf-here) .tf-row-acts', e => getComputedStyle(e).opacity === '0'));
await p.hover('.tf-row:has-text("Home")'); await p.waitForTimeout(200);
console.log('shown on the hovered row:', await p.$eval('.tf-row:has-text("Home") .tf-row-acts', e => getComputedStyle(e).opacity === '1'));
await edit('h1'); await p.keyboard.press('End'); await p.keyboard.type(' G'); await p.keyboard.press('Enter'); await p.waitForTimeout(100);
if (!(await p.$('.tf-panel:not(.tf-pal):not(.tf-out)'))) { await p.click('.tf-pages'); await p.waitForTimeout(150); } await p.click('.tf-row-name:has-text("Home")'); await p.waitForTimeout(100);
await p.waitForURL(/index\.html/); await p.waitForTimeout(400);
console.log('with a change, the name just goes and the change comes along: on Home', /index\.html/.test(p.url()), '| count', await p.$eval('.tf-count', e => e.textContent), '| quiet:', !(await p.textContent('.tf-status')).includes('came back'), '| bar there:', !!(await p.$('.tf-bar')));
await p.click('.tf-button:has-text("Undo")'); await p.waitForTimeout(200);
if (!(await p.$('.tf-panel:not(.tf-pal):not(.tf-out)'))) { await p.click('.tf-pages'); await p.waitForTimeout(150); } await p.click('.tf-row-name:has-text("About")'); await p.waitForLoadState(); await p.waitForTimeout(300);
console.log('clean, the name just goes: back on About:', /about\.html/.test(p.url()));
if (!(await p.$('.tf-panel:not(.tf-pal):not(.tf-out)'))) { await p.click('.tf-pages'); await p.waitForTimeout(150); }

// hide Contact
await act('.tf-row:has-text("Contact")', 'Hide from the menu');
await p.waitForFunction(() => /Hidden from the menu|Could not/.test(document.querySelector('.tf-status').textContent));
console.log('status:', await p.textContent('.tf-status'));
console.log('nav here:', await nav());
console.log('changes:', await p.evaluate(() => Object.keys(window.__tf ? window.__tf() : {})) );
// add a page like Events
await p.click('.tf-sheet-head button[aria-label="Add a page"]'); await p.selectOption('.tf-select', 'events.html');
await p.fill('.tf-add .tf-input', 'Plant list');
await p.click('.tf-add button:has-text("Add")');
await p.waitForFunction(() => /Page added|Could not|already/.test(document.querySelector('.tf-status').textContent));
console.log('status:', await p.textContent('.tf-status'));
console.log('nav here:', await nav());
console.log('panel rows:', await p.evaluate(() => [...document.querySelectorAll('.tf-row')].map(r => r.textContent.trim()).join(' / ')));
// Done: collect every file
await p.evaluate(() => { window._blobs = {}; window._names = {}; const c = URL.createObjectURL; URL.createObjectURL = b => { const u = c(b); window._blobs[u] = b; return u; }; HTMLAnchorElement.prototype.click = function () { window._names[this.href] = this.download; }; });
await p.click('.tf-button:has-text("Done")');
const files = await p.evaluate(async () => { const out = {}; for (const u in window._names) out[window._names[u]] = await window._blobs[u].text(); return out; });
console.log('files written:', Object.keys(files).sort().join(', '));
for (const name of Object.keys(files).sort()) {
  const h = files[name];
  const navLinks = (h.match(/<nav>([\s\S]*?)<\/nav>/) || [])[1]?.match(/<a [^>]*>[^<]*<\/a>/g) || [];
  console.log(' ', name, '| nav:', navLinks.map(a => a.replace(/<a |<\/a>/g, '').replace(/href="([^"]+)"/, '$1')).join(' ; '), '| noindex:', /name="robots" content="noindex"/.test(h), '| h1:', (h.match(/<h1>([^<]*)<\/h1>/) || [])[1], '| clean:', !/\btf-(?!hidden|pos|noindex)|data-tf-block|data-tweakfast|contenteditable/.test(h));
}
console.log('plant list placeholders:', (files['plant-list.html'].match(/New heading|Date and time|Your text here\./g) || []).length, '| title:', (files['plant-list.html'].match(/<title>([^<]*)/) || [])[1]);
/* Rename: the name becomes a field; Enter keeps; the menu says it on every page. Order: a row dragged by its grip; the menu follows on every page. */
await p.goto('http://127.0.0.1:8787/demo/about.html?v=' + Date.now() + '#edit=test'); await p.waitForTimeout(400); /* a fresh load, not a hash change */
if (!(await p.$('.tf-panel:not(.tf-pal):not(.tf-out)'))) { await p.click('.tf-pages'); await p.waitForTimeout(150); } await p.waitForTimeout(200);
await act('.tf-row:has-text("Events")', 'Rename'); await p.waitForTimeout(100);
await p.keyboard.type('What is on'); await p.keyboard.press('Enter'); await p.waitForTimeout(600);
console.log('renamed here:', await nav(), '| row says:', await p.$eval('.tf-row[data-path="events.html"] .tf-row-name', e => e.textContent), '| count:', await p.$eval('.tf-count', c => c.textContent));
const other = await p.evaluate(() => window.__tf ? Object.keys(window.__tf()) : null);
await act('.tf-row:has-text("Contact")', 'Rename'); await p.keyboard.type('Nope'); await p.keyboard.press('Escape'); await p.waitForTimeout(100);
console.log('Esc keeps the old name:', await p.$eval('.tf-row[data-path="contact.html"] .tf-row-name', e => e.textContent) === 'Contact');
{ const g = await p.$eval('.tf-row[data-path="contact.html"] .tf-row-grip', e => { const r = e.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
  const t = await p.$eval('.tf-row[data-path="about.html"]', e => { const r = e.getBoundingClientRect(); return { y: r.top - 8 }; });
  await p.mouse.move(g.x, g.y); await p.mouse.down(); await p.mouse.move(g.x, g.y - 10); await p.mouse.move(g.x, t.y, { steps: 8 }); await p.mouse.up(); await p.waitForTimeout(700); }
console.log('dragged Contact up: rows', await p.$$eval('.tf-row', rs => rs.map(r => (r.getAttribute('data-path') || '-').replace('.html', '')).join(' ')), '| menu here:', await nav());
await p.click('.tf-button:has-text("Undo")'); await p.waitForTimeout(100);
console.log('Undo: menu back:', await nav());
await p.click('.tf-button:has-text("Undo")'); await p.waitForTimeout(100);
console.log('Undo again: name back:', await nav());
/* a logo link and the menu's Home to the same page are one row, named by the menu */
await p.goto('http://127.0.0.1:8787/tools/check-pages.html#edit=test'); await p.waitForTimeout(300);
if (!(await p.$('.tf-panel:not(.tf-pal):not(.tf-out)'))) { await p.click('.tf-pages'); await p.waitForTimeout(150); } await p.waitForTimeout(200);
console.log('marks of an earlier build healed at start:', await p.$eval('main', m => !m.getAttribute('style')), '| the page\'s own style kept:', await p.$eval('main h1', h => h.getAttribute('style') === 'color: rgb(20, 20, 20);'));
console.log('one row per page:', await p.$$eval('.tf-row', rs => rs.map(r => r.querySelector('.tf-row-name').textContent + (r.classList.contains('tf-here') ? '*' : '')).join(' / ')));
/* a logo link outside the menu group is not a menu entry: rows, Home, rename and order leave it alone */
await p.goto('http://127.0.0.1:8787/tools/check-menu.html#edit=test'); await p.waitForTimeout(300);
if (!(await p.$('.tf-panel:not(.tf-pal):not(.tf-out)'))) { await p.click('.tf-pages'); await p.waitForTimeout(150); } await p.waitForTimeout(200);
console.log('rows from the menu group only:', await p.$$eval('.tf-row', rs => rs.map(r => r.querySelector('.tf-row-name').textContent + (r.querySelector('.tf-row-note') ? '(Home)' : '')).join(' / ')), '| names have room:', await p.$eval('.tf-row-name', e => e.scrollWidth <= e.clientWidth + 1));
await act('.tf-row[data-path="index.html"]', 'Rename'); await p.keyboard.type('Start'); await p.keyboard.press('Enter'); await p.waitForTimeout(300);
console.log('rename Home: logo untouched:', await p.$eval('.logo', e => e.textContent === 'signal/coffee'), '| menu says Start:', await p.$eval('.navlinks a[href="index.html"]', e => e.textContent === 'Start'));
{ const g = await p.$eval('.tf-row[data-path="index.html"] .tf-row-grip', e => { const r = e.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
  const t = await p.$eval('.tf-row[data-path="check-pages.html"]', e => { const r = e.getBoundingClientRect(); return { y: r.bottom + 8 }; });
  await p.mouse.move(g.x, g.y); await p.mouse.down(); await p.mouse.move(g.x, g.y + 10); await p.mouse.move(g.x, t.y, { steps: 8 }); await p.mouse.up(); await p.waitForTimeout(700); }
console.log('order Home last: nav still starts with the logo:', await p.$eval('nav', n => n.firstElementChild.classList.contains('logo')), '| menu group order:', await p.$$eval('.navlinks a', as => as.map(a => a.textContent).join(' ')), '| button still last:', await p.$eval('nav', n => n.lastElementChild.tagName === 'BUTTON'));
await b.close();
