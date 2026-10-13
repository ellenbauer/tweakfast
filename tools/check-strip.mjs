/* A moving strip: edited as one sentence, standing still; at the end repeated as before, the pace kept. Serve the repo on 8787 first. */
const { chromium } = await import(process.env.TF_PLAYWRIGHT || new URL('../node_modules/playwright-core/index.mjs', import.meta.url).pathname);
const b = await chromium.launch({ executablePath: process.env.TF_CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
const p = await b.newPage({ viewport: { width: 1100, height: 700 } });
p.on('pageerror', e => console.log('PAGEERROR', e.message));
await p.goto('http://127.0.0.1:8787/tools/check-strip.html#edit=test'); await p.waitForTimeout(400);
const state = () => p.evaluate(() => { const s = document.querySelector('.ticker span'), cs = getComputedStyle(s); return { copies: s.innerHTML.split('OPEN DAILY').length - 1, anim: cs.animationName, dur: cs.animationDuration, w: s.offsetWidth, style: s.getAttribute('style') }; });
const w0 = (await state()).w;
{ const y = (await p.$eval('.ticker', e => e.getBoundingClientRect().top)) + 20; await p.mouse.click(60, y); await p.waitForTimeout(60); await p.mouse.click(60, y); } await p.waitForTimeout(200);
let st = await state();
console.log('edited: sentence once', st.copies === 1, '| stands still', st.anim === 'none', '| editing', await p.$$eval('[contenteditable]', e => e.length));
await p.keyboard.press('End'); await p.keyboard.type(' SOFT SERVE AND VINYL SETS AFTER SIX'); await p.keyboard.press('Enter'); await p.waitForTimeout(200);
st = await state();
console.log('kept: twice again', st.copies === 2, '| moves again', st.anim === 'marquee', '| time', st.dur, 'for', st.w, 'px (was 20s for', w0 + 'px) | pace kept', Math.abs(st.w / parseFloat(st.dur) - w0 / 20) < 1, '| style', st.style);
console.log('page html holds it twice:', await p.evaluate(() => document.documentElement.outerHTML.split('SOFT SERVE').length - 1));
{ const y = (await p.$eval('.ticker', e => e.getBoundingClientRect().top)) + 20; await p.mouse.click(60, y); await p.waitForTimeout(60); await p.mouse.click(60, y); } await p.waitForTimeout(200);
await p.keyboard.type('zzz'); await p.keyboard.press('Escape'); await p.waitForTimeout(200);
st = await state();
console.log('Esc puts it back: twice', st.copies === 2, '| no zzz', !(await p.$eval('.ticker span', e => e.textContent)).includes('zzz'), '| time kept', st.dur);
await p.click('.tf-button:has-text("Undo")'); await p.waitForTimeout(200);
st = await state();
console.log('Undo: original words', !(await p.$eval('.ticker span', e => e.textContent)).includes('SOFT'), '| twice', st.copies === 2, '| old pace back', st.dur === '20s');
/* a copy of the strip keeps its words and its slide: a placeholder would leave one short sentence in an empty loop */
await p.hover('.ticker'); await p.waitForTimeout(400);
await p.click('.tf-tools button[title="Copy"]'); await p.waitForTimeout(300);
console.log('copied strip: two strips', (await p.$$('.ticker')).length === 2, '| same words', await p.$$eval('.ticker span', ss => ss[0].innerHTML === ss[1].innerHTML), '| still sliding', await p.$eval('.ticker:nth-of-type(2) span', e => getComputedStyle(e).animationName !== 'none'), '| no placeholder', !(await p.$eval('.ticker:nth-of-type(2)', e => e.textContent)).includes('Your text'));
await b.close();
