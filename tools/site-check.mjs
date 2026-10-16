/* What a site's own scripts did, and what is left of it once they are taken out.
   tools/site-check.mjs <site address>          every page the home page leads to, at a computer's width and a phone's

   Cleaning a site for Tweakfast takes out the programs an app-building tool attached. Whatever they did is gone:
   a pointer drawn in their place, words that faded in, a menu button that opened the menu, pictures loaded late.
   Each page is opened as readers see it, with what Tweakfast mends on its own (the pointer, a Menu button, a part that
   slid sideways, buttons left with nothing to do), and what still does not work is named in plain words. Nothing is changed. Needs Chrome (TF_CHROME) and playwright-core
   (TF_PLAYWRIGHT, else ../node_modules). */
const { chromium } = await import(process.env.TF_PLAYWRIGHT || new URL('../node_modules/playwright-core/index.mjs', import.meta.url).pathname);
const start = process.argv[2];
if (!start) { console.log('usage: tools/site-check.mjs <site address>'); process.exit(1); }
const home = new URL(start.endsWith('/') || /\.html?$/.test(start) ? start : start + '/');
const b = await chromium.launch({ executablePath: process.env.TF_CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
const found = {}; /* kind -> [{ page, width, what }] */
const note = (kind, page, width, what) => { (found[kind] = found[kind] || []).push({ page, width, what }); };

/* the pages: the home page and every page of the same site it links to, as far as the links go */
const same = u => { u = new URL(u); u.hash = ''; u.search = ''; if (/\/index\.html?$/.test(u.pathname)) u.pathname = u.pathname.replace(/index\.html?$/, ''); return u.href; }; /* / and /index.html are one page */
const pages = [same(home.href)], seen = new Set(pages);
async function open(url, width) {
    const ctx = await b.newContext({ viewport: { width, height: width > 600 ? 900 : 844 }, isMobile: width <= 600, hasTouch: width <= 600 });
    await ctx.route(/tweakfast-editor\.js/, r => r.abort()); /* a reader's view: never the editor */
    const p = await ctx.newPage();
    try { await p.goto(url, { waitUntil: 'load', timeout: 20000 }); } catch (e) { await ctx.close(); return null; }
    await p.waitForTimeout(1200);
    return p;
}
for (let i = 0; i < pages.length && i < 40; i++) {
    const p = await open(pages[i], 1440); if (!p) continue;
    const links = await p.$$eval('a[href]', as => as.map(a => a.href));
    for (const h of links) { const u = same(h); if (new URL(u).origin === home.origin && /(\.html?|\/)$/.test(new URL(u).pathname) && !seen.has(u)) { seen.add(u); pages.push(u); } }
    await p.context().close();
}

for (const url of pages) for (const width of [1440, 390]) {
    const name = new URL(url).pathname.replace(/^\//, '') || 'index.html (home)';
    let p = await open(url, width); if (!p) { note('unreachable', name, width, 'the page did not load'); continue; }
    const r = await p.evaluate(() => {
        const out = { pointer: [], unseen: [], late: [], wide: 0, boxes: 0 };
        const vis = el => { for (let n = el; n && n.nodeType === 1; n = n.parentElement) { const cs = getComputedStyle(n); if (cs.display === 'none' || n.hidden) return 'gone'; } return 'drawn'; };
        const opacity = el => { let o = 1; for (let n = el; n && n.nodeType === 1; n = n.parentElement) o *= +getComputedStyle(n).opacity; return o; };
        const words = el => el.textContent.replace(/\s+/g, ' ').trim().slice(0, 40);
        /* a pointer hidden for one drawn by a script */
        for (const el of [document.body, ...document.querySelectorAll('a[href],button')].slice(0, 300)) if (getComputedStyle(el).cursor === 'none') { out.pointer.push(el === document.body ? 'the whole page' : words(el) || el.tagName.toLowerCase()); }
        /* words left invisible or out of reach: faded out, hidden, or moved off the page, waiting for a script */
        const texts = new Set(); const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT); let t;
        while ((t = w.nextNode())) { const el = t.parentElement; if (el && t.nodeValue.trim() && !el.closest('script,style,noscript,[aria-hidden="true"],template')) texts.add(el); }
        for (const el of texts) {
            if (vis(el) === 'gone') continue;
            const cs = getComputedStyle(el), r = el.getBoundingClientRect(), page = document.documentElement;
            const strip = n => { for (; n && n.nodeType === 1; n = n.parentElement) { const c = getComputedStyle(n); if (c.overflowX === 'auto' || c.overflowX === 'scroll' || c.animationName !== 'none') return true; } return false; }; /* a row that scrolls sideways shows the rest when swiped; a moving strip brings it round by itself */
            const why = opacity(el) < 0.05 ? 'faded out' : cs.visibility === 'hidden' ? 'hidden' : (r.right < 0 || r.left > page.scrollWidth || r.bottom < -window.scrollY - 50) && r.width && !strip(el.parentElement) ? 'off the page' : '';
            if (why && cs.position !== 'fixed' && !el.closest('[role=dialog],dialog,[aria-modal]')) out.unseen.push(why + ': ' + words(el));
        }
        /* pictures a script was to load */
        for (const img of document.images) if (vis(img) === 'drawn' && (!img.getAttribute('src') && (img.dataset.src || img.dataset.srcset) || img.complete && !img.naturalWidth && img.getAttribute('src'))) out.late.push(img.getAttribute('alt') || img.dataset.src || img.getAttribute('src') || 'a picture');
        /* a page wider than the screen: it slides sideways on a phone */
        out.wide = Math.max(0, document.documentElement.scrollWidth - document.documentElement.clientWidth);
        /* words drawn one box per letter or word, left by an entry animation */
        for (const el of document.querySelectorAll('h1,h2,h3,h4,p')) { const k = [...el.querySelectorAll('span,div')].filter(s => !s.children.length && getComputedStyle(s).display === 'inline-block').length; if (k >= 4) out.boxes++; }
        return out;
    });
    if (r.pointer.length) note('pointer', name, width, r.pointer.slice(0, 3).join(', '));
    [...new Set(r.unseen)].slice(0, 6).forEach(x => note('unseen', name, width, x));
    [...new Set(r.late)].slice(0, 4).forEach(x => note('late', name, width, x));
    if (r.wide > 1) note('wide', name, width, r.wide + ' px wider than the screen');
    if (r.boxes) note('boxes', name, width, r.boxes + (r.boxes === 1 ? ' text' : ' texts'));
    /* buttons that do nothing: each one clicked; nothing on the page changes, nothing opens, the address stays */
    const buttons = await p.$$eval('button, a[href="#"], a:not([href]), [role=button]', els => els.filter(e => !e.closest('form') && e.getClientRects().length && getComputedStyle(e).visibility !== 'hidden').map((e, i) => { e.setAttribute('data-site-check', i); return i + '|' + (e.textContent.replace(/\s+/g, ' ').trim().slice(0, 30) || e.getAttribute('aria-label') || e.tagName.toLowerCase()); }));
    for (const one of buttons.slice(0, 20)) {
        const [i, label] = one.split('|');
        const el = await p.$(`[data-site-check="${i}"]`); if (!el || !(await el.isVisible())) continue;
        const before = p.url();
        await p.evaluate(() => { window.__changed = 0; window.__watch = new MutationObserver(l => { window.__changed += l.filter(m => !(m.target.nodeType === 1 && m.target.hasAttribute('data-site-check') && m.attributeName === 'data-site-check')).length; }); window.__watch.observe(document.documentElement, { subtree: true, childList: true, attributes: true, characterData: true }); window.__y = scrollY; });
        try { await el.click({ timeout: 2000 }); } catch (e) { continue; }
        await p.waitForTimeout(400);
        const moved = p.url() !== before || await p.evaluate(() => window.__changed > 0 || Math.abs(scrollY - window.__y) > 2).catch(() => true);
        if (!moved) note('dead', name, width, label);
        else if (p.url() !== before) { await p.context().close(); p = await open(url, width); if (!p) break; }
    }
    if (p) await p.context().close();
}
await b.close();

const KINDS = {
    pointer: ['The mouse pointer is hidden', 'A page script hides it. Ask the maker to leave the pointer as it is.'],
    unseen: ['Words that never show', 'They waited for a script to bring them in. Ask the maker to show them as they are, or remove them.'],
    dead: ['Buttons that do nothing', 'A script opened or did something here. Ask the maker for a version that works without it, or remove the button.'],
    late: ['Pictures that never load', 'A script was to load them. Ask the maker to give them their address directly.'],
    wide: ['Pages wider than a phone', 'They slide sideways on a phone.'],
    boxes: ['Titles drawn one box per letter or word', 'Tweakfast makes them plain words while the owner types; nothing to do.'],
    unreachable: ['Pages that did not load', '']
};
const kinds = Object.keys(KINDS).filter(k => found[k]);
console.log(`Checked ${pages.length} page${pages.length === 1 ? '' : 's'} of ${home.origin}, at a computer's width (1440) and a phone's (390).`);
if (!kinds.length) console.log('Nothing left broken by the cleaning.');
for (const k of kinds) {
    console.log(`\n${KINDS[k][0]}${KINDS[k][1] ? ' — ' + KINDS[k][1] : ''}`);
    const byWhat = new Map();
    for (const f of found[k]) { const key = f.page + ': ' + f.what; byWhat.set(key, (byWhat.get(key) || []).concat(f.width)); }
    for (const [what, widths] of [...byWhat].slice(0, 14)) console.log(`  ${what}  (${widths.length === 2 ? 'both widths' : widths[0] > 600 ? 'computer' : 'phone'})`);
    if (byWhat.size > 14) console.log(`  …and ${byWhat.size - 14} more`);
}
