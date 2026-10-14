/* The keyboard: Tab from a picked text (a click types, Esc keeps it picked) goes into its tools; the Site sheet takes focus and gives it back to Site;
   a menu closed with Esc gives focus back to its button; a redraw keeps focus where it was; focus rings show.
   Needs the repo served on TF_PORT (default 8787). */
const { chromium } = await import(process.env.TF_PLAYWRIGHT || new URL('../node_modules/playwright-core/index.mjs', import.meta.url).pathname);
const PORT = process.env.TF_PORT || 8787;
const b = await chromium.launch({ executablePath: process.env.TF_CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
const p = await b.newPage({ viewport: { width: 1100, height: 800 } });
p.on('pageerror', e => console.log('PAGEERROR', e.message));
const focus = () => p.evaluate(() => { const a = document.activeElement; return a === document.body ? 'body' : (a.closest('.tf-tools') ? 'tools:' : a.closest('.tf-panel') ? 'sheet:' : a.closest('.tf-menu') ? 'menu:' : a.closest('.tf-bar') ? 'bar:' : '?:') + (a.getAttribute('aria-label') || a.textContent.trim()); });
const ring = () => p.evaluate(() => { const s = getComputedStyle(document.activeElement); return s.outlineStyle !== 'none' && s.outlineWidth !== '0px' || /inset/.test(s.boxShadow); });
await p.goto('http://127.0.0.1:' + PORT + '/demo/index.html?v=' + Date.now() + '#edit=test'); await p.waitForTimeout(500);
await p.click('.tf-button:has-text("Got it")').catch(() => {});
await p.click('section:nth-of-type(2) h2'); await p.waitForTimeout(200);
await p.keyboard.press('Escape'); await p.waitForTimeout(100); /* typing ends, the text stays picked */
await p.keyboard.press('Tab'); console.log('Tab from a picked text:', await focus(), '| ring', await ring());
await p.keyboard.press('Tab'); console.log('Tab again:', await focus());
await p.keyboard.press('Escape'); await p.keyboard.press('Escape');
await p.focus('.tf-bar .tf-button:has-text("Site")'); await p.keyboard.press('Enter'); await p.waitForTimeout(250);
console.log('Site opened by keyboard, focus:', await focus(), '| ring', await ring());
await p.keyboard.press('Tab'); await p.keyboard.press('Tab'); const more = await focus(); console.log('Tab into a row:', more);
await p.keyboard.press('Enter'); await p.waitForTimeout(150); console.log('More opened, focus:', await focus(), '| ring', await ring());
await p.keyboard.press('Escape'); await p.waitForTimeout(250); console.log('Esc closes menu, focus back:', await focus());
await p.keyboard.press('Escape'); await p.waitForTimeout(250); console.log('Esc closes sheet, focus:', await focus());
await b.close();
