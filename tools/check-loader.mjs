/* The loader: readers get the one small file and nothing more; the editor comes only on the owner's computer.
   Serve the repo on 8787 first. */
const { chromium } = await import(process.env.TF_PLAYWRIGHT || new URL('../node_modules/playwright-core/index.mjs', import.meta.url).pathname);
const b = await chromium.launch({ executablePath: process.env.TF_CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
const U = 'http://127.0.0.1:8787/demo/index.html';
const visit = async (ctx, url) => {
  const p = await ctx.newPage(), got = [];
  p.on('pageerror', e => console.log('PAGEERROR', e.message));
  p.on('request', r => { if (/tweakfast/.test(r.url())) got.push(r.url().split('/').pop().split('?')[0]); });
  await p.goto(url); await p.waitForTimeout(500);
  return { p, got: got.join(' + '), bar: await p.locator('.tf-bar').count() };
};
const reader = await b.newContext();
let v = await visit(reader, U);
const size = await v.p.evaluate(async () => (await (await fetch('../src/tweakfast.js', { cache: 'no-store' })).text()).length);
console.log('a reader loads:', v.got, '| editor bar:', v.bar, '| loader source bytes:', size < 2000);
await v.p.evaluate(() => { location.hash = '#edit=test'; }); await v.p.waitForTimeout(800);
console.log('the owner\'s link pasted into that tab: editor bar:', await v.p.locator('.tf-bar').count());
const owner = await b.newContext();
v = await visit(owner, U + '#edit=test');
console.log('the owner\'s link loads:', v.got, '| editor bar:', v.bar);
await v.p.evaluate(() => { window._blob = null; const c = URL.createObjectURL; URL.createObjectURL = x => { window._blob = x; return c(x); }; });
await v.p.click('h2'); await v.p.waitForTimeout(60); await v.p.click('h2'); await v.p.keyboard.type(' now'); await v.p.keyboard.press('Enter');
await v.p.click('.tf-button:has-text("Done")'); await v.p.waitForTimeout(400);
const file = await v.p.evaluate(() => window._blob ? window._blob.text() : '');
console.log('saved page: the one line kept:', /<script src="\.\.\/src\/tweakfast\.js"><\/script>/.test(file), '| the editor not saved in:', !/tweakfast-editor/.test(file));
v = await visit(owner, 'http://127.0.0.1:8787/demo/about.html');
console.log('later, a plain address on the owner\'s computer:', v.got, '| editor bar:', v.bar);
v = await visit(owner, 'http://127.0.0.1:8787/demo/about.html#view');
console.log('#view on the owner\'s computer:', v.got, '| editor bar:', v.bar);
await b.close();
