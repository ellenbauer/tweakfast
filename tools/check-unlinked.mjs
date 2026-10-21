/* A new page nothing leads to (a site whose menu is in-page links, tools/_sw): its row says "not linked yet" and More
   offers "Link it from the footer", which adds a footer row leading to it on every page; Undo takes the row away.
   Serve the repo on 8787 first. */
const { chromium } = await import(process.env.TF_PLAYWRIGHT || new URL('../node_modules/playwright-core/index.mjs', import.meta.url).pathname);
const b = await chromium.launch({ executablePath: process.env.TF_CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
p.on('pageerror', e => console.log('PAGEERROR', e.message));
const act = async (row, word) => { await p.hover(row); await p.click(row + ' button[aria-label="More"]'); await p.click('.tf-menu button:has-text("' + word + '")'); };
await p.goto('http://127.0.0.1:8787/tools/_sw/index.html?v=' + Date.now() + '#edit=test'); await p.waitForSelector('.tf-bar', { timeout: 15000 }); await p.waitForTimeout(1200); await p.click('.tf-button:has-text("Got it")').catch(() => {});
if (!(await p.$('.tf-panel:not(.tf-pal):not(.tf-out)'))) { await p.click('.tf-pages'); await p.waitForTimeout(150); }
await p.click('.tf-sheet-head button[aria-label="Add a page"]'); await p.selectOption('.tf-select', 'privacy-policy.html');
await p.fill('.tf-add .tf-input', 'Hawaii'); await p.click('.tf-add button:has-text("Add")');
await p.waitForFunction(() => /Page added|Could not|already/.test(document.querySelector('.tf-status').textContent)); await p.waitForTimeout(300);
const row = '.tf-row[data-path="hawaii.html"]';
console.log('row says not linked yet:', await p.$eval(row + ' .tf-row-tag', t => t.textContent).catch(() => 'no tag'));
await act(row, 'Link it from the footer'); await p.waitForTimeout(500);
const footerLink = () => p.$$eval('footer a[href="hawaii.html"]', as => as.map(a => a.textContent.trim()).join(','));
console.log('footer links to it:', await footerLink(), '| row tag now:', await p.$eval(row + ' .tf-row-tag', t => t.textContent).catch(() => 'none'), '| status:', await p.textContent('.tf-status'));
console.log('footer row after Privacy, Accessibility:', await p.$eval('.footer-links', f => [...f.querySelectorAll('a')].map(a => a.textContent.trim()).join(' / ')));
await p.keyboard.press('Meta+z'); await p.waitForTimeout(300);
console.log('Undo: footer link gone:', (await footerLink()) === '', '| row tag:', await p.$eval(row + ' .tf-row-tag', t => t.textContent).catch(() => 'none'));
await b.close();
