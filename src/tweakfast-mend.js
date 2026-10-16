/* Tweakfast mends what a cleaned page lost with the scripts the app-building tool attached. The loader brings it to
   pages without scripts of their own, and to the owner's computer. Nothing here is saved: its marks are the
   data-tf-mend attribute and one style sheet of ours, and the editor leaves both out of every page it writes.
     - a pointer hidden for one a removed script drew returns
     - a part that slid sideways as the page scrolled shows its steps one under another
     - a Menu button opens the menu's links; it steps aside where they all show already
     - any other button that can no longer do anything is hidden, for readers and the owner alike */
(function () {
    var me = document.currentScript, owner = /[#&]edit=/.test(location.hash) || (function () { try { return !!localStorage.getItem('tweakfast:key'); } catch (e) { return false; } })();
    if (location.hash === '#view') owner = false;
    var sheet, rules = {};
    function rule(css) { if (rules[css]) return; rules[css] = 1; if (!sheet) { sheet = document.createElement('style'); sheet.setAttribute('data-tweakfast', ''); document.head.appendChild(sheet); } sheet.textContent += css + '\n'; }
    function mark(el, word) { var w = (el.getAttribute('data-tf-mend') || '').split(' ').filter(Boolean); if (w.indexOf(word) < 0) w.push(word); el.setAttribute('data-tf-mend', w.join(' ')); }
    function ours(el) { return el.closest('[data-tweakfast]'); }

    function mend() {
        var own = [].some.call(document.scripts, function (x) { return x != me && !/tweakfast/.test(x.src) && !/json/.test(x.type) && (x.src || x.text.trim()); });
        pointer();
        if (own) return; /* the page's own scripts still do their work */
        slides();
        buttons();
    }

    /* the pointer: rules that hid it are lifted */
    function pointer() {
        var go = function (rs) { [].forEach.call(rs, function (r) { if (r.cssRules) go(r.cssRules); if (r.style && r.style.cursor == 'none') r.style.cursor = ''; }); };
        [].forEach.call(document.styleSheets, function (h) { try { go(h.cssRules); } catch (e) {} });
    }

    /* a tall part holding a part stuck to the screen, in which a row of steps several screens wide was slid along by a
       script as the page scrolled: without it the first step stands still and the rest never come. The steps go one
       under another, each as tall as the screen showed it. */
    function slides() {
        var all = document.body.querySelectorAll('*'), vh = innerHeight;
        for (var i = 0; i < all.length; i++) {
            var stuck = all[i], cs = getComputedStyle(stuck), tall = stuck.parentElement;
            if (cs.position !== 'sticky' || !tall || tall === document.body || tall.offsetHeight < 1.8 * vh || ours(stuck)) continue;
            var rows = stuck.querySelectorAll('*');
            for (var j = 0; j < rows.length; j++) {
                var row = rows[j], rs = getComputedStyle(row), steps = [].filter.call(row.children, function (c) { return c.getClientRects().length; });
                if (rs.display.indexOf('flex') < 0 || rs.flexDirection !== 'row' || steps.length < 2 || row.scrollWidth < 1.5 * stuck.clientWidth || rs.animationName !== 'none') continue;
                if (steps.some(function (s) { return s.offsetWidth < 0.6 * stuck.clientWidth; })) continue; /* steps a screen wide each, not a strip of small things */
                var h = Math.max(30, Math.min(100, Math.round(row.offsetHeight / vh * 100)));
                rule('[data-tf-mend~=tall]{height:auto!important;min-height:0!important}');
                rule('[data-tf-mend~=stuck]{position:relative!important;height:auto!important;overflow:visible!important}');
                rule('[data-tf-mend~=row]{flex-direction:column!important;width:auto!important;height:auto!important;transform:none!important}');
                rule('[data-tf-mend~=step' + h + ']{width:auto!important;max-width:none!important;min-height:' + h + 'vh;flex:none!important}');
                mark(tall, 'tall'); mark(stuck, 'stuck'); mark(row, 'row');
                steps.forEach(function (s) { mark(s, 'step' + h); });
                break;
            }
        }
    }

    /* buttons: on a page without scripts a button outside a form does nothing, unless the browser itself gives it a job */
    function dead(b) { return !b.form && !b.hasAttribute('onclick') && !b.hasAttribute('popovertarget') && !b.hasAttribute('commandfor') && !b.disabled && !ours(b) && !b.closest('dialog,details'); }
    function buttons() {
        rule('[data-tf-mend~=gone]{display:none!important}');
        var bs = [].filter.call(document.querySelectorAll('button'), dead), menus = 0;
        bs.forEach(function (b) {
            var links = b.hasAttribute('aria-expanded') || b.hasAttribute('aria-controls') || /\bmenu\b|☰|≡|navigation/i.test(b.textContent + ' ' + (b.getAttribute('aria-label') || '')) ? linksFor(b) : [];
            if (links.length >= 2 && !menus++) menu(b, links);
            else mark(b, 'gone');
        });
    }
    /* the menu's links: those of the nav beside the button, else every link of the top part but the name that leads home */
    function linksFor(b) {
        var top = b.closest('header,[role=banner],nav');
        for (var n = b.parentElement; !top && n && n !== document.body; n = n.parentElement) if (n.querySelectorAll('a[href]').length >= 3) top = n;
        if (!top) return [];
        var navs = [].filter.call(top.querySelectorAll('nav'), function (n) { return n.querySelectorAll('a[href]').length >= 2; });
        var links = [].slice.call((navs[0] || top).querySelectorAll('a[href]'));
        if (!navs.length && links[0] && (links[0].querySelector('img,svg') || /^(\.?\/|index\.html?)?$/.test(links[0].getAttribute('href')))) links.shift();
        var seen = {};
        return links.filter(function (a) { var k = a.href.replace(/#.*$/, ''); if (seen[k] || /^(mailto|tel):/.test(a.protocol)) return false; return seen[k] = 1; });
    }
    function menu(b, links) {
        var top = b.closest('header,[role=banner],nav') || links[0].parentElement, ground = top, box = null;
        while (ground && ground !== document.documentElement && /rgba\(0, 0, 0, 0\)|transparent/.test(getComputedStyle(ground).backgroundColor)) ground = ground.parentElement;
        /* where every link shows already, the button is not needed */
        function fit() { var all = links.every(function (a) { return a.getClientRects().length && getComputedStyle(a).visibility !== 'hidden'; }); if (all) { mark(b, 'gone'); shut(); } else unmark(b, 'gone'); }
        function unmark(el, word) { var w = (el.getAttribute('data-tf-mend') || '').split(' ').filter(function (x) { return x && x !== word; }); w.length ? el.setAttribute('data-tf-mend', w.join(' ')) : el.removeAttribute('data-tf-mend'); }
        fit(); addEventListener('resize', fit);
        if (owner) return; /* while the owner edits, a click picks the button */
        /* the links drop down under the bar holding the button, over the page, in the top part's own ground and lettering */
        box = document.createElement('div'); var row = b; while (row.parentElement !== top) row = row.parentElement;
        var r = top.getBoundingClientRect(), first = top.querySelector('a[href]') || row, inset = Math.max(16, Math.round(first.getBoundingClientRect().left - r.left)), over = getComputedStyle(top).position !== 'static';
        box.setAttribute('data-tweakfast', ''); box.id = 'tf-menu'; box.hidden = true; rule('#tf-menu[hidden]{display:none!important}');
        box.style.cssText = 'display:flex;flex-direction:column;padding:8px ' + inset + 'px 20px;background:' + (ground && ground !== document.documentElement ? getComputedStyle(ground).backgroundColor : getComputedStyle(document.body).backgroundColor) + ';color:' + getComputedStyle(top).color + (parseFloat(getComputedStyle(row).borderBottomWidth) ? ';border-bottom:' + getComputedStyle(row).borderBottom : '');
        links.forEach(function (a) {
            var c = a.cloneNode(true), cs = getComputedStyle(a);
            c.removeAttribute('id'); c.className = ''; c.style.cssText = 'display:block;padding:12px 0;color:inherit;font:' + cs.font + ';letter-spacing:' + cs.letterSpacing + ';text-transform:' + cs.textTransform;
            box.appendChild(c);
        });
        box.addEventListener('keydown', function (e) { if (e.key === 'Escape') { shut(); b.focus(); } });
        if (over) box.style.cssText += ';position:absolute;left:0;right:0;z-index:1;max-height:80vh;overflow:auto';
        row.after(box);
        b.setAttribute('aria-controls', 'tf-menu'); b.setAttribute('aria-expanded', 'false');
        function shut() { if (box && !box.hidden) { box.hidden = true; b.setAttribute('aria-expanded', 'false'); } }
        b.addEventListener('click', function (e) { e.preventDefault(); if (over) box.style.top = row.offsetTop + row.offsetHeight + 'px'; box.hidden = !box.hidden; b.setAttribute('aria-expanded', String(!box.hidden)); if (!box.hidden && box.firstChild) box.firstChild.focus({ preventScroll: true }); });
        document.addEventListener('click', function (e) { if (!box.hidden && !box.contains(e.target) && !b.contains(e.target)) shut(); });
        document.addEventListener('keydown', function (e) { if (e.key === 'Escape') shut(); });
    }

    if (document.readyState == 'complete') mend(); else addEventListener('load', mend);
})();
