/* a card that lifts on hover carries the words being typed: the editing line goes with them (same setup as check-ring1) */
const { chromium } = await import(process.env.TF_PLAYWRIGHT || new URL('../node_modules/playwright-core/index.mjs', import.meta.url).pathname);
const b = await chromium.launch({ executablePath: process.env.TF_CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
const p = await b.newPage({ viewport: { width: 1100, height: 800 } });
p.on('pageerror', e => console.log('PAGEERROR', e.message));
await p.goto('http://127.0.0.1:8787/tools/check-lift.html#edit=test');
await p.waitForSelector('.tf-bar');
const sel = '.card .eyebrow';
await p.click(sel); await p.waitForTimeout(60); await p.click(sel); await p.waitForTimeout(500);
const gap = () => p.evaluate(s => { const t = document.querySelector(s).getBoundingClientRect(), box = document.querySelector(".tf-edit-box"), r = box && box.style.display === "block" && box.getBoundingClientRect(); return r ? Math.round((t.top - r.top) * 10) / 10 + ' (words at ' + Math.round(t.top) + ')' : 'no ring'; }, sel);
console.log('editing, ring top to words top:', await gap());
await p.mouse.move(300, 300); await p.waitForTimeout(700);
console.log('card lifted, same distance:', await gap());
await p.mouse.move(20, 760); await p.waitForTimeout(700);
console.log('card back down, same distance:', await gap());
await p.hover(sel); await p.waitForTimeout(700);
console.log('lifted again, same distance:', await gap());
await b.close();
