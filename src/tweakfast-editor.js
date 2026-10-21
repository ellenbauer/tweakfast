/* Tweakfast. Ring 1: click text and type, swap a picture, Undo, Done.
   Ring 2: blocks move up and down, hide, copy as a twin; repeated items get a plus.
   Ring 3: a new page is a twin of an existing one and joins the menu on every page; a page can be hidden. Home stays.
   Saving: Done posts to the site's own /api/save route when there is one (see site/functions/[...rest].js); otherwise it downloads the files.
   A page served from a save carries <meta name="tweakfast-updated">; Done sends it back, and the route refuses when the page was saved from elsewhere in between.
   One script line on a plain HTML site. The bar appears when the link carries
   a key after the hash (#edit=word); the browser remembers it. */
(function () {
    'use strict';
    var STORE = 'tweakfast:key';
    var BUILD = 'dev';         /* the bundler writes a hash of this file here */
    var firstVisit = false;
    var key = readKey();
    /* the owner's bookmark opened while this page is already showing: only the address changes, so load again with it */
    /* also when the editor is locked by an old link and the new one is pasted: the new key is read on the way in */
    window.addEventListener('hashchange', function () { var m = /[#&]edit=([^&]+)/.exec(location.hash); if (m && (!bar || locked || m[1] !== key)) location.reload(); });
    if (!key) return;

    var bar, status, undoBtn, doneBtn, doneCount, pagesBtn, previewBtn, card = null, noteTimer = 0;
    var previewing = false, peek = null; /* Preview: the page as readers see it, every editor piece gone, one pill to come back */
    var steps = [];            /* undo stack: functions that put things back */
    var saves = [];            /* each Done in this visit: the pages as they were before it, so Undo can reach back */
    var loaded = {};           /* each page as it was when this visit read it, or after the last Done */
    var pageUpdated = '';      /* when this page was last saved, from the served meta tag; '' for an original */
    var realTitle = '';        /* the page's own title; the tab shows "Edit · title" while the editor is open */
    var locked = false;        /* the link no longer works: nothing can be edited */
    var editing = null;        /* the text element being edited */
    var held = null;           /* the text picked by one click: a solid line, no caret; a second click or Enter edits it */
    var sharedBefore = null;   /* the edited element as it was, when it sits in a shared part */
    var before = '';           /* its HTML when the edit began */
    var TEXT = 'h1,h2,h3,h4,h5,h6,p,li,figcaption,time,blockquote,dt,dd,td,th,summary,label,a,span,strong,em,small,cite,[data-tf="text"]';
    /* the icons: solid shapes with fine cut-outs, drawn by hand, 16 on a side, the button's colour */
    var ICON = {
        chev: '<svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M3.6 6.9 5 5.5l3 3 3-3 1.4 1.4L8 11.3z"/></svg>',
        play: '<svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M4.5 2.9c0-.8.9-1.3 1.6-.9l7.2 4.9c.6.4.6 1.3 0 1.7L6.1 13.5c-.7.5-1.6 0-1.6-.9z"/></svg>',
        grip: '<svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><circle cx="5.5" cy="4" r="1.5"/><circle cx="10.5" cy="4" r="1.5"/><circle cx="5.5" cy="8" r="1.5"/><circle cx="10.5" cy="8" r="1.5"/><circle cx="5.5" cy="12" r="1.5"/><circle cx="10.5" cy="12" r="1.5"/></svg>',
        up: '<svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M8 2.2l4.8 4.9-1.3 1.3-2.6-2.7v8.1H7.1V5.7L4.5 8.4 3.2 7.1z"/></svg>',
        down: '<svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M8 13.8 3.2 8.9l1.3-1.3 2.6 2.7V2.2h1.8v8.1l2.6-2.7 1.3 1.3z"/></svg>',
        left: '<svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M2.2 8 7.1 12.8 8.4 11.5 5.7 8.9H13.8V7.1H5.7L8.4 4.5 7.1 3.2z"/></svg>',
        right: '<svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M13.8 8 8.9 12.8 7.6 11.5 10.3 8.9H2.2V7.1H10.3L7.6 4.5 8.9 3.2z"/></svg>',
        swap: '<svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M2 4.1H11V2l3.6 2.85L11 7.7V5.6H2zM14 10.4H5V8.3L1.4 11.15 5 14v-2.1h9z"/></svg>',
        eye: '<svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path fill-rule="evenodd" d="M8 3.2c-3.4 0-6 2.6-7 4.8 1 2.2 3.6 4.8 7 4.8s6-2.6 7-4.8c-1-2.2-3.6-4.8-7-4.8zm0 7.9a3.1 3.1 0 1 1 0-6.2 3.1 3.1 0 0 1 0 6.2z"/><circle cx="8" cy="8" r="1.8"/></svg>',
        eyeOff: '<svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path fill-rule="evenodd" d="M8 3.2c-3.4 0-6 2.6-7 4.8 1 2.2 3.6 4.8 7 4.8s6-2.6 7-4.8c-1-2.2-3.6-4.8-7-4.8zm0 7.9a3.1 3.1 0 1 1 0-6.2 3.1 3.1 0 0 1 0 6.2zM3.1 1.9 14.6 13.4l-1.3 1.3L1.8 3.2z"/><circle cx="8" cy="8" r="1.8"/><path d="M2.9 1.3 14.7 13.1l-.9.9L2 2.2z"/></svg>',
        copy: '<svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M3 1.5h7.5A1.5 1.5 0 0 1 12 3v.8H5.8A2.3 2.3 0 0 0 3.5 6.1V11H3a1.5 1.5 0 0 1-1.5-1.5V3A1.5 1.5 0 0 1 3 1.5z"/><rect x="5" y="5" width="9.5" height="9.5" rx="1.5"/></svg>',
        trash: '<svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M6.2 1.5h3.6l.6 1.3h3.1v1.6H2.5V2.8h3.1z"/><path fill-rule="evenodd" d="M3.3 5.5h9.4l-.7 8a1.5 1.5 0 0 1-1.5 1.4H5.5A1.5 1.5 0 0 1 4 13.5zm3 1.8v5.4h1V7.3zm2.4 0v5.4h1V7.3z"/></svg>',
        pencil: '<svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M11.3 1.9a1.6 1.6 0 0 1 2.3 0l.5.5a1.6 1.6 0 0 1 0 2.3l-1 1-2.8-2.8zM9.4 3.8l2.8 2.8-6.6 6.6-3.5.7.7-3.5z"/></svg>',
        search: '<svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path fill-rule="evenodd" d="M6.8 1.5a5.3 5.3 0 1 1 0 10.6 5.3 5.3 0 0 1 0-10.6zm0 1.9a3.4 3.4 0 1 0 0 6.8 3.4 3.4 0 0 0 0-6.8z"/><path d="M10.2 11.5l1.3-1.3 3 3-1.3 1.3z"/></svg>',
        clock: '<svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path fill-rule="evenodd" d="M8 1.3a6.7 6.7 0 1 1 0 13.4A6.7 6.7 0 0 1 8 1.3zm0 1.8a4.9 4.9 0 1 0 0 9.8 4.9 4.9 0 0 0 0-9.8z"/><path d="M7.2 4.2h1.6v3.6l2.4 1.5-.8 1.4-3.2-2z"/></svg>',
        more: '<svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><circle cx="3.2" cy="8" r="1.6"/><circle cx="8" cy="8" r="1.6"/><circle cx="12.8" cy="8" r="1.6"/></svg>',
        back: '<svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M10.4 2.2l1.4 1.4L7.4 8l4.4 4.4-1.4 1.4L4.6 8z"/></svg>',
        plus: '<svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M7.1 2.5h1.8v4.6h4.6v1.8H8.9v4.6H7.1V8.9H2.5V7.1h4.6z"/></svg>',
        page: '<svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path fill-rule="evenodd" d="M4 1.5h5l3.5 3.5v9.5H4zm1.6 1.6v9.8h5.3V6.1H8.4V3.1zM10 3.4v1.2h1.2z"/></svg>',
        share: '<svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M8 1l3.2 3.2-1.1 1.1-1.3-1.3v6.3H7.2V4L5.9 5.3 4.8 4.2z"/><path d="M3 6.8h2.6v1.6H4.6v5.1h6.8V8.4h-1V6.8H13V15H3z"/></svg>',
        help: '<svg viewBox="0 0 16 16" aria-hidden="true"><mask id="tf-help-cut"><rect width="16" height="16" fill="#fff"/><path d="M5.9 6.1a2.1 2.1 0 1 1 3 1.9c-.6.3-.9.7-.9 1.3v.5" fill="none" stroke="#000" stroke-width="1.6" stroke-linecap="round"/><circle cx="8" cy="11.8" r="1" fill="#000"/></mask><circle cx="8" cy="8" r="7.2" fill="currentColor" mask="url(#tf-help-cut)"/></svg>',
        undo: '<svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M5.6 2.6 7 4 5.3 5.7H9a4.1 4.1 0 1 1 0 8.2H5v-1.9h4a2.2 2.2 0 1 0 0-4.4H5.3L7 9.3 5.6 10.7 1.5 6.6z"/></svg>',
        leave: '<svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M2 2h6v1.8H3.8v8.4H8V14H2zm8.1 2.2 1.3-1.3L15.5 7 11.4 11.1l-1.3-1.3L12 7.9H6V6.1h6z"/></svg>',
        check: '<svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M6.3 12.6 2 8.3l1.4-1.4 2.9 2.9 6.3-6.3L14 4.9z"/></svg>',
        picture: '<svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path fill-rule="evenodd" d="M3 2.5h10A1.5 1.5 0 0 1 14.5 4v8a1.5 1.5 0 0 1-1.5 1.5H3A1.5 1.5 0 0 1 1.5 12V4A1.5 1.5 0 0 1 3 2.5zm.4 9.1h9.2L9.5 7.4l-2.1 2.7-1.5-1.4zM5.3 4.4a1.2 1.2 0 1 0 0 2.4 1.2 1.2 0 0 0 0-2.4z"/></svg>',
        link: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="M6.9 9.1a2.7 2.7 0 0 0 3.9 0l2.3-2.3a2.7 2.7 0 0 0-3.9-3.9l-1 1M9.1 6.9a2.7 2.7 0 0 0-3.9 0L2.9 9.2a2.7 2.7 0 0 0 3.9 3.9l1-1"/></svg>',
        keys: '<svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path fill-rule="evenodd" d="M2.5 3.5h11A1.5 1.5 0 0 1 15 5v6a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 1 11V5a1.5 1.5 0 0 1 1.5-1.5zM3.3 5.6v1.5h1.5V5.6zm2.6 0v1.5h1.5V5.6zm2.7 0v1.5h1.5V5.6zm2.6 0v1.5h1.5V5.6zM4.6 9.1v1.5h6.8V9.1z"/></svg>',
        bookmark: '<svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M4.5 1.5h7A1 1 0 0 1 12.5 2.5v12L8 11.2 3.5 14.5v-12a1 1 0 0 1 1-1z"/></svg>'
    };
    /* a maker's overrides: data-tf="fixed" (never editable), data-tf="text" (edit this), data-tf="block" (a block with its own tools) */

    document.addEventListener('DOMContentLoaded', start);
    if (document.readyState !== 'loading') setTimeout(start, 0); /* loaded late by the loader: start once this whole script has run, not halfway through it */

    function readKey() {
        if (/^#view$/.test(location.hash)) return null; /* "See the page": the page as readers see it, no editor in that tab */
        var m = /[#&]edit=([^&]+)/.exec(location.hash);
        try {
            /* the address keeps the key, so a bookmark of this page is the owner's way back */
            if (m) { firstVisit = !localStorage.getItem('tweakfast:seen'); localStorage.setItem(STORE, m[1]); return m[1]; }
            return localStorage.getItem(STORE);
        } catch (e) { return m ? m[1] : null; }
    }

    /* checks only: the unbundled editor lends its rules to the check scripts; a built editor never does */
    if (BUILD === 'dev') window.__tweakfastProbe = { textTarget: textTarget, isTextLeaf: isTextLeaf, pinned: pinned, isButton: isButton, looks: looks, blockTarget: blockTarget, sharedRootOf: sharedRootOf, grounds: grounds, groundClasses: groundClasses, choicesFor: choicesFor, readings: readings, layoutOf: layoutOf, staysReadable: staysReadable, retint: retint, untint: untint, pictureTarget: function (n) { return pictureTarget(n); } };
    /* a page of the site typed with a part after it (index.html#services) once got https:// in front and led nowhere:
       such links are set right as the page opens, and go out with the next Done */
    function mendPageLinks() {
        Array.prototype.forEach.call(document.querySelectorAll('a[href^="https://"], a[href^="http://"]'), function (a) {
            var m = /^https?:\/\/([^\/?#]+)(.*)$/.exec(a.getAttribute('href')); if (m && /\.html?$/i.test(m[1])) a.setAttribute('href', m[1] + m[2]);
        });
    }
    function start() {
        if (bar) return;
        mendPageLinks();
        injectStyle();
        bar = el('div', 'tf-bar');
        bar.setAttribute('data-tweakfast', '');
        bar.setAttribute('data-build', BUILD); /* the bar itself says nothing on hover: its buttons do, see tip() */
        /* the bar holds buttons only, so nothing moves; sentences appear in a bubble above it */
        status = el('div', 'tf-status', ''); status.setAttribute('data-tweakfast', ''); status.setAttribute('role', 'status');
        var mac = /Mac|iPhone|iPad/.test(navigator.platform);
        undoBtn = button('Undo', undo); tip(undoBtn, 'Undo', mac ? '\u2318Z' : 'Ctrl+Z'); /* Redo is taught in Help */
        doneBtn = button('Done', function () { save(false); }); tip(doneBtn, 'Done', mac ? '\u2318S' : 'Ctrl+S');
        doneBtn.className += ' tf-primary';
        doneCount = el('span', 'tf-count', '0'); doneBtn.appendChild(doneCount); /* how many changes Done makes live */
        tip(doneCount, 'See the changes');
        doneCount.addEventListener('click', function (e) { e.stopPropagation(); e.preventDefault(); toggleChanges(); }); /* the count opens the list; the rest of the button is Done */
        var leave = button('Leave', leave_); leave.className += ' tf-quiet'; symbolize(leave, 'leave');
        symbolize(undoBtn, 'undo');
        /* the page you are on; its menu lists the site's pages, Add a page and the door to the Site sheet */
        pagesBtn = el('button', 'tf-button tf-pages'); pagesBtn.type = 'button'; pagesBtn.appendChild(el('span', 'tf-page-name', '')); pagesBtn.insertAdjacentHTML('beforeend', ICON.chev);
        pagesBtn.addEventListener('click', togglePages); pagesBtn.setAttribute('aria-haspopup', 'dialog'); /* the one door to the pages: the sheet, where a row jumps and More holds the rest */
        previewBtn = iconButton('play', 'Preview', enterPreview);
        bar.appendChild(leave); bar.appendChild(pagesBtn); bar.appendChild(undoBtn); bar.appendChild(el('span', 'tf-sep')); bar.appendChild(previewBtn); bar.appendChild(doneBtn);
        document.body.appendChild(bar); document.body.appendChild(status);
        tipsOn();
        window.addEventListener('resize', placeNote);
        pageUpdated = takeUpdated(document);
        realTitle = document.title; setTab();
        refresh();
        document.addEventListener('click', onClick, true);
        document.addEventListener('keydown', onKey, true);
        document.addEventListener('paste', onPaste, true);
        document.addEventListener('input', function () { if (editing && !locked && !saving) doneBtn.disabled = false; }, true); /* the first change can be made live while it is still being typed */
        if (coarse()) longPress();
        document.addEventListener('dragover', onDragOver, true);
        document.addEventListener('dragleave', function (e) { if (!e.relatedTarget) { dropOn = null; hoverNone(); } }, true);
        document.addEventListener('drop', onDrop, true);
        document.addEventListener('mousemove', onMove, true);
        document.addEventListener('mouseout', function (e) { if (!e.relatedTarget) hoverNone(); }); /* the pointer left the window */
        window.addEventListener('beforeunload', function (e) { if (steps.length && !carrying) { e.preventDefault(); e.returnValue = ''; } });
        /* a page of the site opened by its link: what is not live yet goes along, as from the Site sheet */
        document.addEventListener('click', function (e) { var a = !e.defaultPrevented && e.target.closest && e.target.closest('a[href]'); if (a && isPageLink(a) && !a.target && !locked && !editing && !held && !a.closest('[contenteditable]')) carry(); });
        document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'visible') stillCurrent(); else keepDraft(); });
        window.addEventListener('pagehide', keepDraft);
        document.addEventListener('input', function () { if (editing) laterDraft(); }, true); /* words being typed are kept too */
        scrub(document.documentElement); /* heals a page an earlier build left marks on */
        liveHidden(document.body);
        markPictures();
        markBlocks();
        if (firstVisit) welcome();
        loaded[here()] = pageHtml();
        findSaver(function () { if (saver) checkKey(); setTimeout(findPages, 600); }); /* the site's pages are looked up early, out of the way of the page's own loading */
        bringBack();
    }

    /* ---- nothing is lost ----
       What is not live yet is kept in this browser as it is made: a tab closed, a reload, a crash, and the next visit
       brings it back as one change, said so, with a way to throw it away. Done, Undo and Leave anyway end it; going to another page of the site carries it along quietly. */
    var DRAFT = 'tweakfast:draft', draftTimer = 0, carrying = false, brought = null;
    /* a demo keeps no draft: it saves nothing, its visitors share one browser at a kiosk, and the site behind its address
       may be another one tomorrow (a draft of one site laid on another). Known from the site's answer, and remembered
       here so the next visit skips the draft before the answer comes */
    function demoHere() { try { return localStorage.getItem('tweakfast:demo') === '1'; } catch (e) { return false; } }
    function forgetDraft() {
        try { localStorage.removeItem(DRAFT); } catch (e) {}
        if (!brought) return;
        var i = steps.lastIndexOf(brought); brought = null;
        if (i >= 0) { if (i === steps.length - 1) undo(); else undoOne(i); say(''); }
    }
    var TAB = (function () { try { var t = sessionStorage.getItem('tweakfast:tab'); if (!t) { t = Math.random().toString(36).slice(2); sessionStorage.setItem('tweakfast:tab', t); } return t; } catch (e) { return ''; } })();
    /* going to another page of the site in this tab: the changes are kept for it, and it carries on with them quietly */
    function carry() { carrying = true; keepDraft(); try { sessionStorage.setItem('tweakfast:carry', '1'); } catch (e) {} }
    function laterDraft() { clearTimeout(draftTimer); draftTimer = setTimeout(keepDraft, 400); }
    function keepDraft() {
        clearTimeout(draftTimer);
        if (!bar || locked) return;
        if (demo || demoHere()) { try { localStorage.removeItem(DRAFT); } catch (e) {} return; }
        try {
            var typing = editing && editing.innerHTML !== before ? 1 : 0; /* words being typed, not yet kept, count too */
            if (!steps.length && !typing) { /* only this tab's own: another tab's unsaved work stays */
                var old = JSON.parse(localStorage.getItem(DRAFT) || 'null'); if (old && (!old.tab || old.tab === TAB)) localStorage.removeItem(DRAFT); return;
            }
            var pages = {}, k;
            for (k in changes) if (!drops[k]) pages[k] = changes[k];
            var h = pageHtml();
            if (h !== loaded[here()]) { var d = parse(h); putMeta(d, 'meta[name="tweakfast-updated"]', 'name', 'tweakfast-updated', pageUpdated); pages[here()] = serialize(d); } /* with its stamp, so a page saved elsewhere meanwhile is still asked about at Done */
            localStorage.setItem(DRAFT, JSON.stringify({ at: new Date().toISOString(), tab: TAB, n: steps.length + typing, pages: pages, drops: Object.keys(drops), fresh: Object.keys(freshPages) }));
        } catch (e) { once('draftfull', 'These changes are too large to keep if this tab closes. Press Done to be safe.'); }
    }
    function bringBack() {
        if (demoHere()) { try { localStorage.removeItem(DRAFT); } catch (e) {} return; }
        var d, carried = false; try { d = JSON.parse(localStorage.getItem(DRAFT) || 'null'); carried = !!sessionStorage.getItem('tweakfast:carry'); sessionStorage.removeItem('tweakfast:carry'); } catch (e) { d = null; }
        if (!d || !d.pages || (!Object.keys(d.pages).length && !(d.drops || []).length)) return;
        var now = snapshot(), wasUpdated = pageUpdated, wasDrops = copy(drops), wasFresh = copy(freshPages), path;
        var next = copy(changes);
        for (path in d.pages) if (path !== here()) next[path] = d.pages[path];
        if (d.pages[here()]) {
            var doc = parse(d.pages[here()]), stamp = takeUpdated(doc);
            restore({ html: serialize(doc), words: wordsOf(doc), changes: next }); pageUpdated = stamp;
        } else changes = next;
        (d.drops || []).forEach(function (x) { drops[x] = true; });
        (d.fresh || []).forEach(function (x) { freshPages[x] = true; });
        var mine = function () { restore(now); pageUpdated = wasUpdated; drops = wasDrops; freshPages = wasFresh; };
        steps.push(mine); brought = mine;
        refresh();
        if (carried && d.tab === TAB) return; /* came along from the page before: the count on Done says it */
        /* they come back as one step (one Undo, one row, 1 on Done), so the words name no other number */
        say('Your ' + (d.n === 1 ? 'change' : d.n + ' changes') + ' from ' + backWhen(d.at) + ' ' + (d.n === 1 ? 'is' : 'are') + ' back. Press Done to make ' + (d.n === 1 ? 'it' : 'them') + ' live.', 'stay');
        offer('Throw away', function () { if (steps[steps.length - 1] === mine) undo(); else { var i = steps.lastIndexOf(mine); if (i >= 0) undoOne(i); } say(''); });
    }

    /* the first arrival on this computer: one card above the bar with the one thing the owner cannot find out by trying */
    function welcome() {
        if (demo) return;
        card = el('div', 'tf-card');
        card.setAttribute('data-tweakfast', ''); card.setAttribute('role', 'dialog');
        card.appendChild(el('h2', 'tf-card-title', 'Bookmark this page.'));
        card.appendChild(el('p', 'tf-card-text', 'It is your only way back in. There is no login.'));
        card.appendChild(button('Got it', function () { fade(card); card = null; placeNote(); }));
        try { localStorage.setItem('tweakfast:seen', '1'); } catch (e) {} /* once per computer, also after Leave */
        card.appendChild(el('span', 'tf-card-tip'));
        document.body.appendChild(card);
        function placeCard() { if (!card) return; var r = bar.getBoundingClientRect(); card.style.bottom = (window.innerHeight - r.top + 12) + 'px'; }
        placeCard(); window.addEventListener('resize', placeCard); placeNote();
    }
    function setTab() { document.title = realTitle ? 'Edit \u00b7 ' + realTitle : 'Edit'; }
    /* the link's key is wrong or old: say so once, and let nothing be edited */
    function lock(message) {
        hoverNone(); if (tools) hideTools(); if (panel) closePages();
        if (card) { fade(card); card = null; } /* "Bookmark this page" is not true of a link that no longer works */
        try { localStorage.removeItem(STORE); } catch (e) {}
        say(message || 'This link no longer works. Ask the person who set up the site for a new one.', 'error'); locked = true;
        undoBtn.disabled = doneBtn.disabled = pagesBtn.disabled = previewBtn.disabled = true;
    }

    /* ---- what can be edited ---- */
    function pinned(node) {
        if (node.closest('[data-tweakfast],[data-tf="fixed"]')) return true;
        var nav = menuOf(document); if (!nav || !nav.contains(node)) return false;
        var menu = menuLinks(nav), a = node.closest('a[href]');
        if (a && menu.indexOf(a) >= 0) return true; /* the menu's own links: renamed in the Site panel, not here */
        for (var i = 0; i < menu.length; i++) if (node.contains(menu[i])) return true; /* nor the group that holds them: one text there could unlink an entry */
        return false;
    }
    /* shared parts: the header that holds the menu, and the footers. A change inside one is made on every page. */
    function sharedParts(doc) {
        var out = [], nav = menuOf(doc);
        if (nav) out.push(nav.closest('header') || nav);
        var feet = doc.querySelectorAll('footer');
        for (var i = 0; i < feet.length; i++) if (!feet[i].closest('main') && out.indexOf(feet[i]) < 0) out.push(feet[i]);
        return out;
    }
    function sharedRootOf(node) {
        var parts = sharedParts(document);
        for (var i = 0; i < parts.length; i++) if (parts[i].contains(node)) return parts[i];
        return null;
    }
    /* the same element on another page: the same part, then the same way down (child index and tag at each step) */
    function pathFrom(root, el) {
        var path = [];
        for (var n = el; n && n !== root; n = n.parentElement) path.unshift({ i: Array.prototype.indexOf.call(n.parentElement.children, n), tag: n.tagName });
        return path;
    }
    function walkPath(root, path) {
        var n = root;
        for (var i = 0; i < path.length; i++) { n = n.children[path[i].i]; if (!n || n.tagName !== path[i].tag) return null; }
        return n;
    }
    /* an element as it would be saved: none of our marks on it */
    function cleanOuter(el) {
        var c = el.cloneNode(true), junk = c.querySelectorAll('[data-tweakfast]'), i;
        for (i = 0; i < junk.length; i++) junk[i].remove();
        var all = [c].concat(Array.prototype.slice.call(c.querySelectorAll('*')));
        for (i = 0; i < all.length; i++) {
            var n = all[i];
            n.removeAttribute('contenteditable'); n.removeAttribute('data-tf-block'); n.removeAttribute('data-tf-art'); n.removeAttribute('data-tf-mend');
            n.classList.remove('tf-picture', 'tf-editing', 'tf-hover', 'tf-moving'); if (!n.className) n.removeAttribute('class');
            if (n.getAttribute('style') === '') n.removeAttribute('style');
        }
        scrub(c); savedHidden(c);
        return c.outerHTML;
    }
    /* ---- work on the other pages ----
       A change made here that reaches other pages (a shared part, the menu, the page's background, a version put back)
       loads them one after another. Such jobs run one at a time, each on what the one before wrote, and while one runs
       Undo, Redo and Done wait, so a change is never half on the other pages. Each job writes through its own ledger,
       and its Undo puts back only the pages it wrote, never what other changes did meanwhile. */
    var busy = 0, jobs = [];
    function job(fn) {
        jobs.push(fn); busy++; refresh();
        if (jobs.length === 1) fn(nextJob);
    }
    function nextJob() {
        jobs.shift(); busy--; refresh();
        if (jobs.length) jobs[0](nextJob);
    }
    function waitWork() { if (!busy) return false; say('One moment: the other pages are still being changed.'); return true; }
    function ledger() {
        var was = {};
        return {
            put: function (path, html) { if (!(path in was)) was[path] = changes[path]; changes[path] = html; },
            back: function () { for (var p in was) { if (was[p] === undefined) delete changes[p]; else changes[p] = was[p]; } },
            wrote: function () { return Object.keys(was).length > 0; },
            paths: function () { return Object.keys(was); }
        };
    }
    /* the step made here takes the other pages' Undo with it, wherever it now sits among the steps */
    function fold(local, back) {
        var i = local ? steps.lastIndexOf(local) : -1;
        if (i >= 0) { steps[i] = function () { local(); back(); }; if (notes[i] && notes[i].fn === local) notes[i].fn = steps[i]; }
        else steps.push(back);
    }
    /* every other page of the site: the menu's, the ones found through the site's links and saves, the ones changed */
    function otherPages() {
        var paths = pageList().map(function (p) { return p.path; });
        (found || []).forEach(function (p) { if (paths.indexOf(p) < 0) paths.push(p); });
        Object.keys(changes).forEach(function (p) { if (paths.indexOf(p) < 0) paths.push(p); });
        return paths.filter(function (p) { return p !== here() && !drops[p]; });
    }
    /* each path loaded in turn, fn(path, html, missing) on each, then end() */
    function eachPage(paths, fn, end) {
        var i = 0;
        (function next() {
            if (i >= paths.length) { end(); return; }
            var path = paths[i++];
            loadPage(path, function (html, missing) { try { fn(path, html, missing); } catch (e) { console.error(e); } next(); });
        })();
    }
    /* a change inside a shared part, made on every other page whose part still matches; the page's own step
       takes the mirrored changes with it, so one Undo takes everything back */
    function mirror(el, beforeOuter, local) {
        var part = sharedRootOf(el); if (!part) return;
        var parts = sharedParts(document), which = parts.indexOf(part), path = pathFrom(part, el), afterOuter = cleanOuter(el);
        if (beforeOuter === afterOuter) return;
        var paths = otherPages(); if (!paths.length) return;
        local = local || steps[steps.length - 1];
        job(function (finish) {
            var led = ledger(), differ = [];
            eachPage(paths, function (path_, html) {
                if (html === null) return;
                var doc = parse(html), there = sharedParts(doc)[which], target = there && walkPath(there, path);
                if (target && target.outerHTML === beforeOuter) { target.outerHTML = afterOuter; led.put(path_, serialize(doc)); }
                else differ.push(path_);
            }, function () {
                if (led.wrote()) fold(local, led.back);
                finish();
                if (differ.length) say(exceptPages(differ, 'this part'));
            });
        });
    }
    /* text is known by what it holds, not by its tag: an element with words and only inline bits inside (no blocks,
       no pictures) is text, whatever it is called. A bare div holding a label is as editable as a paragraph. */
    var INLINE = /^(A|SPAN|EM|STRONG|B|I|SMALL|CITE|BR|SUP|SUB|CODE|MARK|TIME|ABBR|U|S|Q|WBR)$/;
    function isTextLeaf(n) {
        if (!n || n.nodeType !== 1 || n === document.body || /^(IMG|STYLE|SCRIPT)$/.test(n.tagName) || n.closest('svg') || n.closest('[data-tweakfast]')) return false;
        if (!n.textContent.trim() && n.querySelector('img,svg')) return false; /* a link or span that only holds a picture is that picture's frame, not text */
        if (n.tagName !== 'A' && n.tagName !== 'BUTTON' && n.firstElementChild && buttonHolder(n)) return false; /* a row of buttons: each button is its own words */
        if (n.matches(TEXT)) return true;
        if (!n.textContent.trim() || n.tagName === 'NAV') return false;
        var nav = menuOf(document); if (nav && n.contains(nav)) return false; /* the menu, or what holds it, is never one text */
        for (var c = n.firstElementChild; c; c = c.nextElementSibling) { if (!INLINE.test(c.tagName) || !isTextLeaf(c) && c.tagName !== 'BR' && c.tagName !== 'WBR') return false; }
        return true;
    }
    /* a button is a link (or button) drawn as a shape: a fill, a line or a shadow. A link inside a sentence, a link that
       wraps a whole card, and everything in the header with the menu are not buttons. */
    function isButton(n) {
        if (!n || n.nodeType !== 1 || !(n.tagName === 'A' && n.hasAttribute('href') || n.tagName === 'BUTTON' && !n.closest('form'))) return false;
        if (!n.textContent.trim() || n.closest('nav,[data-tweakfast]') || pinned(n) || ownWords(n.parentElement)) return false;
        var nav = menuOf(document), head = nav && (nav.closest('header') || nav); if (head && head.contains(n)) return false;
        if (!isTextLeaf(n)) return false;
        if (n.hasAttribute('data-tf-hidden')) return true; /* hidden by the owner: still a button, so it can be shown again */
        return hasShape(getComputedStyle(n));
    }
    function hasShape(cs) {
        var seen = function (c) { return !seeThrough(c); };
        if (seen(cs.backgroundColor) || cs.backgroundImage !== 'none' || cs.boxShadow !== 'none') return true;
        return ['Top', 'Right', 'Bottom', 'Left'].some(function (s) { return parseFloat(cs['border' + s + 'Width']) > 0 && cs['border' + s + 'Style'] !== 'none' && seen(cs['border' + s + 'Color']); });
    }
    function ownWords(n) {
        if (!n) return false;
        for (var c = n.firstChild; c; c = c.nextSibling) if (c.nodeType === 3 && c.nodeValue.trim()) return true;
        return false;
    }
    /* an element that only holds buttons, with no words of its own */
    function buttonHolder(n) {
        if (ownWords(n)) return false;
        var any = false;
        for (var c = n.firstElementChild; c; c = c.nextElementSibling) {
            if (c.hasAttribute('data-tweakfast') || !c.textContent.trim()) continue;
            if (!isButton(c)) return false;
            any = true;
        }
        return any;
    }
    function textTarget(node) {
        var t = node.nodeType === 1 ? node : node.parentElement;
        while (t && !isTextLeaf(t)) t = t.parentElement;
        if (!t || pinned(t)) return null;
        /* climb to the outermost text element inside the block, so a word in
           a link in a paragraph edits the paragraph */
        var up = t;
        while (up.parentElement && isTextLeaf(up.parentElement)) up = up.parentElement;
        return up;
    }
    /* the words whose line the pointer is on, through whatever ink lies on top: a huge heading's letters can reach
       into the small label above it and take its clicks; the label's own line box still holds the point */
    function textUnder(e) {
        if (!document.elementsFromPoint) return textTarget(e.target);
        var list = document.elementsFromPoint(e.clientX, e.clientY), i, first = null;
        for (i = 0; i < list.length; i++) {
            if (list[i].closest('[data-tweakfast]')) break;
            var t = textTarget(list[i]); if (!t) continue;
            if (!first) first = t;
            if (onLine(t, e.clientX, e.clientY)) return t;
        }
        return first;
    }
    function onLine(t, x, y) {
        var rg = document.createRange(); rg.selectNodeContents(t);
        var rects = rg.getClientRects(), i;
        for (i = 0; i < rects.length; i++) if (x >= rects[i].left - 2 && x <= rects[i].right + 2 && y >= rects[i].top - 2 && y <= rects[i].bottom + 2) return true;
        return false;
    }
    function pictureTarget(node) {
        var p = node.closest('img');
        return p && !pinned(p) ? p : null;
    }
    /* a drawn box: a large element the stylesheet paints, with no words and no picture of its own. It can take a
       photo as its background, the way a shape takes a fill. Marked data-tf-art once it is known. */
    function artTarget(node) {
        if (!node || node.nodeType !== 1) return null;
        var n = node.closest('[data-tf-art]'); if (n) return n;
        for (n = node; n && n !== document.body; n = n.parentElement) {
            if (pinned(n) || n.matches(TEXT) || n.tagName === 'IMG' || n.closest('svg') || n.hasAttribute('data-tf-block')) continue;
            if (n.textContent.trim() || n.querySelector('img,svg,video,iframe')) return null; /* words or a picture inside: a block, not a box */
            var r = n.getBoundingClientRect(); if (r.width < 120 || r.height < 120) continue;
            var cs = getComputedStyle(n);
            if (cs.backgroundImage === 'none' && seeThrough(cs.backgroundColor)) continue; /* nothing painted on it */
            n.setAttribute('data-tf-art', '');
            return n;
        }
        return null;
    }
    function isArt(n) { return !!n && n.tagName !== 'IMG'; }
    /* a mark drawn as inline SVG (a logo): big enough to be a picture, not a small icon; Replace puts a picture in its place */
    function svgTarget(node) {
        var sv = node.closest ? node.closest('svg') : null; if (!sv || pinned(sv)) return null;
        var r = sv.getBoundingClientRect(); if (r.width < 24 || r.height < 24) return null;
        return sv;
    }
    function fillSvg(sv, url, wasOuter) {
        var r = sv.getBoundingClientRect(), img = document.createElement('img'); img.alt = ''; img.src = url;
        img.style.width = Math.round(r.width) + 'px'; img.style.height = 'auto'; img.style.display = getComputedStyle(sv).display === 'inline' ? 'inline-block' : getComputedStyle(sv).display; img.style.verticalAlign = 'middle';
        if (sv.getAttribute('class')) img.setAttribute('class', sv.getAttribute('class'));
        var parent = sv.parentNode;
        parent.replaceChild(img, sv); markPictures(); enableDrag(img);
        steps.push(function () { img.parentNode.replaceChild(sv, img); });
        refresh();
        if (picked === sv) { unpick(); pick(img); }
        say('');
        mirror(img, wasOuter);
    }
    /* a picture behind an empty box (a hero with its text laid over it): what lies under the pointer, through
       anything that is not itself text or a picture */
    function pictureUnder(e) {
        if (!document.elementsFromPoint) return null;
        var list = document.elementsFromPoint(e.clientX, e.clientY), top = list[0] && ownPart(list[0]);
        for (var i = 0; i < list.length; i++) {
            if (list[i].closest('[data-tweakfast]')) return null; /* never through our own bar, bubble or tools */
            var pic = pictureTarget(list[i]); if (pic) return top && !top.contains(pic) ? null : pic; /* what is clicked is what changes: a floating header is not the photo under it */
            if (list[i].matches(TEXT)) return null;
            var cs = getComputedStyle(list[i]); if (opaque(cs.backgroundColor) || cs.backgroundImage !== 'none') return null; /* a box with its own colour hides the picture there: only where the picture shows can it be picked */
        }
        return null;
    }
    /* the part a point belongs to on its own: the header, a footer, or a part pinned to the screen; null inside the page */
    function ownPart(n) {
        for (; n && n.nodeType === 1 && n !== document.body; n = n.parentElement) {
            if (/^(HEADER|FOOTER)$/.test(n.tagName)) return n;
            var pos = getComputedStyle(n).position; if (pos === 'fixed' || pos === 'sticky') return n;
        }
        return null;
    }

    /* ---- text ---- */
    var clickAt = null; /* where the last click fell, to put the caret under it */
    function onClick(e) {
        clickAt = { x: e.clientX, y: e.clientY, t: Date.now() };
        if (previewing) { if (peek && peek.contains(e.target)) return; e.preventDefault(); return; } /* nothing edits while previewing; links are not followed either */
        if (dragging) { e.preventDefault(); e.stopPropagation(); return; }
        if (locked) { if (!bar.contains(e.target)) { e.preventDefault(); e.stopPropagation(); } return; }
        if (skipClick) { skipClick = false; if (!bar.contains(e.target) && !(tools && tools.contains(e.target))) { e.preventDefault(); e.stopPropagation(); return; } } /* the click born of the release */
        if (asking && !status.contains(e.target)) say('');
        if (bar.contains(e.target) || status.contains(e.target) || (tools && tools.contains(e.target)) || (panel && panel.contains(e.target)) || (pal && pal.contains(e.target)) || (menu && menu.contains(e.target)) || (linkBox && linkBox.contains(e.target)) || (linkList && linkList.contains(e.target)) || (altBox && altBox.contains(e.target))) return;
        if (panel) closePages(); if (pal) closePal();
        if (editing && editing.contains(e.target)) { if (editing.closest('button')) e.preventDefault(); return; } /* a click in a button's words places the caret; it never sends the form */
        if (editing) commit();
        if (tools && !textTarget(e.target)) { var blk = toolAt(e.target, e.clientY); if (blk) showTools(blk); else hideTools(); } /* a tap works where there is no hover */
        var link = e.target.closest('a[href]');
        if (link && freshPages[link.getAttribute('href')] && !editing && !held) {
            e.preventDefault(); e.stopPropagation();
            say('That page is new and not saved yet. Press Done first, then open it.', 'error');
            return;
        }
        var plus = e.target.closest('.tf-plus');
        if (plus) { e.preventDefault(); e.stopPropagation(); addItem(plus); return; }
        var t = textUnder(e);
        var pic = pictureTarget(e.target) || (!t && (pictureUnder(e) || artTarget(e.target) || svgTarget(e.target)));
        if (picked && picked !== pic) unpick();
        if (held && (pic || !t)) unhold();
        if (pic) { e.preventDefault(); e.stopPropagation(); if (picked === pic) swapPicture(pic); else pick(pic); return; }
        if (!t) { if (held) unhold(); fixedTold(e.target); return; }
        e.preventDefault(); e.stopPropagation();
        begin(t); /* one click: type here */
    }
    /* a text kept with Enter or put back with Esc stays picked: the solid line, the block's tools, no caret. Enter or a click edits it again, Esc lets go. */
    function hold(t) {
        hoverNone(); if (picked) unpick();
        held = t; if (editBox && !editing && !picked) editBox.style.display = 'none'; /* Enter edits it again, Tab moves on; the eye sees its block selected, its toolbar up */
        var b = toolTarget(t); if (tools) { if (b) showTools(b); else hideTools(); }
    }
    function unhold() { held = null; if (editBox && !editing && !picked) editBox.style.display = 'none'; giveRoom(); }
    /* a click on a fixed part (header, menu, footer) is answered once per visit; links there still work */
    function fixedTold(node) {
        if (!node.closest('[data-tf="fixed"]') || node.closest('a[href]')) return;
        try { if (sessionStorage.getItem('tweakfast:fixed')) return; sessionStorage.setItem('tweakfast:fixed', '1'); } catch (e) {}
        say('This part is the same on every page, so it stays as it is.');
    }
    /* the hover line turns solid and stays while the text is edited; it follows the text as it grows */
    var editBox = null;
    function placeEdit() {
        var on = editing || picked;
        if (!on || !editBox) return;
        frame(editBox, on.getBoundingClientRect(), on); editBox.style.display = 'block';
    }
    function showEditBox() {
        if (!editBox) { editBox = el('span', 'tf-edit-box'); editBox.setAttribute('data-tweakfast', ''); document.body.appendChild(editBox); }
        placeEdit();
    }
    /* words drawn one box per letter or per word (left by an entry animation: each an inline-block of its own) take no
       caret, and typed letters land at a box's edge: while they are edited they are plain words again, spaces kept.
       Nothing typed: the boxes come back as they were. */
    var flat = null;
    function words(n) { return n.textContent.replace(/\s+/g, ' ').trim(); }
    /* the words as written (not as drawn in capitals), a space where a line of its own begins */
    function spoken(t) {
        var out = '', w = document.createTreeWalker(t, NodeFilter.SHOW_TEXT), x, lastBlock = null;
        while ((x = w.nextNode())) {
            var blk = x.parentElement; while (blk && blk !== t && !/^(block|flex|grid|list-item|table)/.test(getComputedStyle(blk).display)) blk = blk.parentElement;
            if (lastBlock && blk !== lastBlock) out += ' ';
            out += x.nodeValue; lastBlock = blk;
        }
        return out.replace(/\s+/g, ' ').trim();
    }
    function unbox(t) {
        var boxes = Array.prototype.filter.call(t.querySelectorAll('span,div'), function (s) {
            if (s.children.length || !s.textContent || getComputedStyle(s).display !== 'inline-block') return false;
            var kin = 0; for (var c = s.parentElement.firstElementChild; c; c = c.nextElementSibling) if (signature(c) === signature(s)) kin++;
            return kin >= 2;
        });
        if (boxes.length < 2) return null;
        var text = words(t), label = t.getAttribute('aria-label');
        boxes.forEach(function (s) {
            var cs = getComputedStyle(s), gap = parseFloat(cs.marginRight) > 0 || parseFloat(cs.marginLeft) > 0, next = s.nextSibling;
            var piece = s.textContent + (gap && next && !(next.nodeType === 3 && /^\s/.test(next.nodeValue)) ? ' ' : '');
            s.parentNode.replaceChild(document.createTextNode(piece), s);
        });
        Array.prototype.forEach.call(t.querySelectorAll('[aria-hidden="true"]'), function (n) { n.removeAttribute('aria-hidden'); }); /* the words are the words now */
        t.normalize();
        return { text: words(t) === text ? text : words(t), label: label };
    }
    /* the caret as a count of the letters before it (spaces not counted, so it holds when spaces are added), and back */
    function lettersBefore(t) {
        var node = null, off = 0, sel = document.getSelection();
        if (clickAt && Date.now() - clickAt.t < 1000) { /* the letter under the click: a word drawn as a box gives the browser's caret its start */
            var hit = document.caretRangeFromPoint ? document.caretRangeFromPoint(clickAt.x, clickAt.y) : document.caretPositionFromPoint ? document.caretPositionFromPoint(clickAt.x, clickAt.y) : null;
            if (hit) { node = hit.startContainer || hit.offsetNode; off = hit.startOffset !== undefined ? hit.startOffset : hit.offset; }
            if (node && node.nodeType === 1) { var inBox = letterAt(node, clickAt.x, clickAt.y); if (inBox) { node = inBox.node; off = inBox.off; } } /* a box gives its start, not the letter: measured here */
        }
        if (!node || !t.contains(node)) { if (!sel || !sel.rangeCount || !t.contains(sel.anchorNode)) return -1; node = sel.anchorNode; off = sel.anchorOffset; }
        var r = document.createRange(); r.selectNodeContents(t); r.setEnd(node, off);
        return r.toString().replace(/\s+/g, '').length;
    }
    function letterAt(el, x, y) {
        var w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT), tx, best = null, bestD = Infinity, r = document.createRange();
        while ((tx = w.nextNode())) for (var i = 0; i < tx.nodeValue.length; i++) {
            r.setStart(tx, i); r.setEnd(tx, i + 1); var q = r.getBoundingClientRect(); if (!q.width && !q.height) continue;
            var dy = y < q.top ? q.top - y : y > q.bottom ? y - q.bottom : 0, dx = x < q.left ? q.left - x : x > q.right ? x - q.right : 0, d = dy * 4 + dx; /* the nearest letter, its line first */
            if (d < bestD) { bestD = d; best = { node: tx, off: x < q.left + q.width / 2 ? i : i + 1 }; }
        }
        return best;
    }
    function caretAfter(t, n) {
        var w = document.createTreeWalker(t, NodeFilter.SHOW_TEXT), x, left = n;
        while ((x = w.nextNode())) {
            for (var i = 0; i <= x.nodeValue.length; i++) {
                if (left === 0) { var r = document.createRange(); r.setStart(x, i); r.collapse(true); var sel = document.getSelection(); sel.removeAllRanges(); sel.addRange(r); return; }
                if (i < x.nodeValue.length && !/\s/.test(x.nodeValue[i])) left--;
            }
        }
    }
    function begin(t) {
        hoverNone();
        sharedBefore = sharedRootOf(t) ? cleanOuter(t) : null;
        held = null; editing = t; before = t.innerHTML; hrefBefore = t.getAttribute('href'); sizeBegin(t); fieldsBegin(t);
        var at = lettersBefore(t); flat = unbox(t); if (flat && at >= 0) caretAfter(t, at); /* the caret stays where the click put it */
        stripBegin(t);
        wrapHold(t);
        t.setAttribute('contenteditable', 'true');
        t.classList.add('tf-editing');
        if (picked) unpick();
        if (tools) { var bk = toolTarget(t); if (bk) showTools(bk); else hideTools(); } /* the block's tools stay in reach, beside the words, never on them */
        showEditBox();
        clearBar(t);
        t.focus();
        var sel = document.getSelection(); /* a click on a link leaves no caret in it: the caret goes to the end of the words */
        if (sel && !(sel.rangeCount && t.contains(sel.anchorNode))) { var rg = document.createRange(); rg.selectNodeContents(t); rg.collapse(false); sel.removeAllRanges(); sel.addRange(rg); }
        else if (sel) { var keep = sel.getRangeAt(0).cloneRange(); sel.removeAllRanges(); sel.addRange(keep); } /* the caret the click left in the words is set again now that they are editable, so the keys move it */
        hint();
        if (sharedBefore !== null) once('shared', 'Changes here are made on every page.'); /* said over the typing hint */
        showLink();
    }
    /* said on the first three edits, then no more */
    function hint() {
        if (coarse()) { once('touchhint', 'Tap outside the text when you are done.'); return; } /* a phone has no Esc */
        var n = 0; try { n = +sessionStorage.getItem('tweakfast:hints') || 0; } catch (e) {}
        if (n >= 3) return;
        try { sessionStorage.setItem('tweakfast:hints', n + 1); } catch (e) {}
        say('Enter keeps it, Shift+Enter starts a new line, Esc puts it back.');
    }
    /* Enter ending a title says how to start a new line instead, the first three times; never again once Shift+Enter was used */
    function breakTip(t) {
        var n = 0; try { n = +localStorage.getItem('tweakfast:breaktip') || 0; } catch (e) {}
        if (!t) { try { localStorage.setItem('tweakfast:breaktip', 3); } catch (e) {} return; }
        if (n >= 3 || coarse() || status.textContent || !t.matches('h1,h2,h3,h4,h5,h6')) return;
        try { localStorage.setItem('tweakfast:breaktip', n + 1); } catch (e) {}
        say('Kept. For a new line, press Shift+Enter while typing.');
    }
    var hrefBefore = null; /* the address of a link that is itself the edited text: part of the text's one step */
    function commit() {
        var t = editing; if (!t) return;
        applyLink(); hideLink();
        editing = null;
        if (editBox) editBox.style.display = 'none';
        giveRoom();
        keepFields(); fieldsEnd();
        t.removeAttribute('contenteditable');
        t.classList.remove('tf-editing');
        if (!t.className) t.removeAttribute('class');
        wrapFree();
        stripEnd(t);
        sizeFit(t); /* as the words stand without the caret: a long word that still spills is broken now, not left out of the page */
        var sizeWas = sizeEnd(t);
        var flatWas = flat; flat = null;
        if (flatWas && words(t) === flatWas.text) { t.innerHTML = before; flatWas = null; } /* nothing typed: the words keep their boxes as made */
        if (!t.textContent.trim() && !t.querySelector('img,svg') && /^(\s|<br\s*\/?>)*$/i.test(t.innerHTML)) t.innerHTML = ''; /* an emptied text is empty, not a stray line break */
        var after = t.innerHTML, was = before, hrefWas = hrefBefore, hrefNow = t.getAttribute('href');
        var fix = stripFix; stripFix = null;
        if (flatWas && flatWas.label !== null) t.setAttribute('aria-label', spoken(t)); /* read aloud as now written */
        if (after !== was || hrefNow !== hrefWas) {
            steps.push(function () { t.innerHTML = was; if (hrefWas !== null) t.setAttribute('href', hrefWas); if (flatWas && flatWas.label !== null) t.setAttribute('aria-label', flatWas.label); if (fix) fix(); if (sizeWas) sizeWas(); });
            refresh();
            if (sharedBefore !== null) mirror(t, sharedBefore);
        }
        sharedBefore = null;
        say('');
        if (after !== was && !t.textContent.trim() && !t.querySelector('img')) say('Emptied. Undo brings it back.');
    }
    /* the browser lets any edited text break its long words (overflow-wrap: break-word while contenteditable), so a
       word wider than its column wrapped nicely while typed and jumped out of the page the moment it was kept. While
       edited, the words keep the page's own rule, so what is seen is what is kept; a spill is then the fit's to mend. */
    var wrapPin = null;
    function wrapHold(t) {
        if (!wrapPin) { wrapPin = document.createElement('style'); wrapPin.setAttribute('data-tweakfast', ''); }
        wrapPin.textContent = '.tf-editing{overflow-wrap:' + getComputedStyle(t).overflowWrap + '}';
        document.head.appendChild(wrapPin);
    }
    function wrapFree() { if (wrapPin && wrapPin.parentNode) wrapPin.parentNode.removeChild(wrapPin); }
    /* a label that holds its field (First name, then the box to type in): only its words are typed in. The field
       takes no caret, and one taken away with the words (all selected, then typed over) comes back where it was */
    var fields = [];
    function fieldsBegin(t) {
        fields = Array.prototype.map.call(t.querySelectorAll('input,textarea,select,button'), function (n) {
            var o = { n: n, parent: n.parentNode, next: n.nextSibling, ce: n.getAttribute('contenteditable') };
            n.setAttribute('contenteditable', 'false'); return o;
        });
    }
    function keepFields() {
        var t = editing; if (!t) return;
        fields.forEach(function (o) {
            if (t.contains(o.n)) return;
            var parent = t.contains(o.parent) ? o.parent : t;
            if (o.next && parent.contains(o.next) && o.next.parentNode === parent) parent.insertBefore(o.n, o.next); else if (o.next === null) parent.appendChild(o.n); else parent.insertBefore(o.n, parent.firstChild);
        });
    }
    function fieldsEnd() { fields.forEach(function (o) { if (o.ce === null) o.n.removeAttribute('contenteditable'); else o.n.setAttribute('contenteditable', o.ce); }); fields = []; }
    /* a box made to the size of its words (a pill of a fixed width and height): longer words would spill out of it.
       While typing it grows instead, keeping its look: one line as made stays one line and widens, with the room it
       had at its sides; when it meets the column it takes more lines and grows in height, with the room it had above
       and below. Its size as made is its least. Words that fit the box as made leave it as made. */
    var size = null;
    function sizeBegin(t) {
        size = null;
        if (strip) return;
        var rg = document.createRange(); rg.selectNodeContents(t);
        var w = rg.getBoundingClientRect(), tops = {};
        Array.prototype.forEach.call(rg.getClientRects(), function (q) { if (q.width) tops[Math.round(q.top)] = 1; });
        var par = t.parentElement, pcs = getComputedStyle(par), col = par.clientWidth - (parseFloat(pcs.paddingLeft) || 0) - (parseFloat(pcs.paddingRight) || 0);
        /* one line in a box of its own width (narrower than its column, a pill): it widens; a line as wide as the column only wraps */
        var bx = t.getBoundingClientRect();
        size = { ow: bx.width, w: t.offsetWidth, h: t.offsetHeight, tw: w.width, th: w.height, gl: Math.max(0, w.left - bx.left), gr: Math.max(0, bx.right - w.right), gt: Math.max(0, w.top - bx.top), gb: Math.max(0, bx.bottom - w.bottom), one: Object.keys(tops).length <= 1 && t.offsetWidth < col - 1, sx: t.scrollWidth - t.clientWidth, sy: t.scrollHeight - t.clientHeight, touched: [], holders: [] };
        /* the boxes holding the words, up to the page: how far each already spilled as made (a picture set past its edge,
           a picture breathing), so only spilling more than that is the words' doing */
        for (var n = t.parentElement; n && n !== document.body; n = n.parentElement) {
            var ox = getComputedStyle(n).overflowY;
            if (ox === 'auto' || ox === 'scroll') break; /* a box made to scroll: its words scroll in it */
            size.holders.push({ el: n, spill: n.scrollHeight - n.clientHeight, below: n.getBoundingClientRect().bottom - t.getBoundingClientRect().bottom });
        }
    }
    /* spilling more than as made: letters taller than their line already reach past the box a little */
    function spills(t, z) { return t.scrollHeight - t.clientHeight > (z ? z.sy : 0) + 1 || t.scrollWidth - t.clientWidth > (z ? z.sx : 0) + 1; }
    function touch(n) { if (!size.touched.some(function (x) { return x.el === n; })) size.touched.push({ el: n, style: n.getAttribute('style') }); }
    function sizeFit(t) {
        if (!size) return;
        var cs = getComputedStyle(t), s = t.style;
        if (cs.display !== 'inline' && spills(t, size)) { /* a run of words in a line has no size of its own */
            touch(t); s.boxSizing = 'border-box'; s.maxWidth = '100%';
            if (size.one && !size.side) { /* sideways first */
                size.side = true;
                /* the room the words had at each side stays as it was: centred words keep their even sides, words set
                   flush left keep their left (an even share of a wide box would push them in from its edge) */
                s.width = 'max-content'; s.minWidth = size.w + 'px'; s.paddingLeft = size.gl + 'px'; s.paddingRight = size.gr + 'px';
            }
            /* words kept on one line as made (white-space: nowrap) at the column's width: they take more lines */
            var ws = cs.whiteSpace;
            if (t.scrollWidth - t.clientWidth > size.sx + 1 && /^(nowrap|pre)$/.test(ws)) s.whiteSpace = ws === 'pre' ? 'pre-wrap' : 'normal';
            /* one word wider than the column (a long name, letters typed without a space): it breaks where the column ends */
            if (t.scrollWidth - t.clientWidth > size.sx + 1 && getComputedStyle(t).overflowWrap === 'normal') s.overflowWrap = 'anywhere';
            if (!size.down && spills(t, size)) { /* then downwards */
                size.down = true;
                /* the words keep the room they had above them; below them the same room, never more. Words centred in a
                   pill keep their even room; words set at the top of a box made tall (a quote box) get none added */
                var above = Math.max(parseFloat(cs.paddingTop) || 0, size.gt), below = Math.max(parseFloat(cs.paddingBottom) || 0, Math.min(size.gb, above));
                s.height = 'auto'; s.minHeight = size.h + 'px'; s.paddingTop = above + 'px'; s.paddingBottom = below + 'px';
            }
        }
        /* one word wider than its column, where the column gives way instead (a grid or flex column sized by its longest
           word): the words widen without spilling and push what stands beside them off the page. The word may break
           wherever it must; kept only when that brings the column back */
        if (cs.display !== 'inline' && !size.side && cs.overflowWrap !== 'anywhere' && t.getBoundingClientRect().width > size.ow + 1) {
            var wide = t.getBoundingClientRect().width; touch(t); s.overflowWrap = 'anywhere';
            if (t.getBoundingClientRect().width >= wide - 1) s.overflowWrap = '';
        }
        /* a box around the words made to a fixed height (a section, a card): it grows with them, from its size as made */
        size.holders.forEach(function (x) {
            var n = x.el;
            if (n.scrollHeight - n.clientHeight <= x.spill + 1) return;
            var made = n.offsetHeight, ns = getComputedStyle(n); touch(n);
            n.style.height = 'auto'; n.style.maxHeight = 'none'; n.style.minHeight = made + 'px';
            /* the room under the words as made, up to the room the box gives at its top: the words never end on its edge */
            var want = Math.min(x.below, Math.max(parseFloat(ns.paddingTop) || 0, 24)), gap = n.getBoundingClientRect().bottom - t.getBoundingClientRect().bottom;
            if (gap < want) n.style.paddingBottom = (parseFloat(ns.paddingBottom) || 0) + want - gap + 'px';
        });
    }
    /* at the end: words that fit the boxes as made put them back as made; else the grown boxes stay. Gives the undo for it. */
    function sizeEnd(t) {
        var was = size; size = null;
        if (!was || !was.touched.length) return null;
        var put = function (list) { list.forEach(function (x) { if (x.style === null) x.el.removeAttribute('style'); else x.el.setAttribute('style', x.style); }); };
        var now = was.touched.map(function (x) { return { el: x.el, style: x.el.getAttribute('style') }; });
        put(was.touched);
        var over = (getComputedStyle(t).display !== 'inline' && (spills(t, was) || (!was.side && t.getBoundingClientRect().width > was.ow + 1))) || was.holders.some(function (x) { return x.el.scrollHeight - x.el.clientHeight > x.spill + 1; });
        if (!over) return null;
        put(now);
        return function () { put(was.touched); };
    }
    /* Tab keeps and opens the next text on the page, Shift+Tab the one before */
    function nextText(from, dir) {
        var all = document.body.querySelectorAll('*'), list = [];
        for (var i = 0; i < all.length; i++) {
            var t = all[i];
            if (textTarget(t) !== t || t.closest('[data-tweakfast],[data-tf-hidden]') || !t.getClientRects().length) continue;
            list.push(t);
        }
        var at = list.indexOf(from);
        return at < 0 ? null : list[at + dir] || null;
    }
    /* a moving strip (a ticker, a marquee): words that slide sideways in a loop, held twice or more so the loop
       is seamless. While edited it stands still and shows the sentence once; at the end the sentence is repeated
       as before and the slide time follows the new width, so the pace stays whatever is typed. */
    var strip = null, stripFix = null;
    function stripBegin(t) {
        strip = null;
        var m = keepsWords(t); if (!m) return;
        var cs = getComputedStyle(m), t0 = t; t = m;
        var html = t.innerHTML.replace(/\s+/g, ' ').trim(), unit = html, sep = '', k = 1, head = html.slice(0, 12);
        for (var at = html.indexOf(head, 1); at > 0 && k === 1; at = html.indexOf(head, at + 1)) {
            var u = html.slice(0, at), n = Math.round(html.length / at), body = u.replace(/\s+$/, '');
            if (n < 2) break;
            var joined = []; for (var i = 0; i < n; i++) joined.push(body);
            if (joined.join(' ') === html) { unit = body; sep = ' '; k = n; }
            else if (joined.join('') === html) { unit = body; sep = ''; k = n; }
        }
        strip = { el: m, k: k, sep: sep, orig: t.innerHTML, unit: unit, width: t.offsetWidth, time: parseFloat(cs.animationDuration) || 0, inline: t.style.animation, dur: t.style.animationDuration };
        t.style.animation = 'none';
        if (k > 1) t.innerHTML = unit;
    }
    /* THE RULE for special text: a text whose words must not be treated as free prose is known by ONE detector,
       keepsWords(), that editing (stripBegin) and copying (makeTwin) both ask. A new kind of such text goes in here,
       and its check gets a Copy case. Today the only kind is the moving strip. */
    function keepsWords(node) { return mover(node); }
    /* the edited text itself, or the one moving part inside it (a strip's div holds the sliding span) */
    function mover(t) {
        var list = [t].concat([].slice.call(t.querySelectorAll('*')));
        for (var i = 0; i < list.length; i++) {
            var n = list[i], p = n.parentElement; if (!p || n.closest('[data-tweakfast]')) continue;
            var cs = getComputedStyle(n), pc = getComputedStyle(p);
            if (cs.animationName && cs.animationName !== 'none' && (pc.overflowX === 'hidden' || pc.overflowX === 'clip' || pc.overflow === 'hidden') && n.textContent.trim()) return n;
        }
        return null;
    }
    function stripEnd(t) {
        var st = strip; strip = null; if (!st) return;
        var outer = t; t = st.el;
        t.style.animation = st.inline; if (!t.style.animation) t.style.removeProperty('animation'); if (st.dur) t.style.animationDuration = st.dur;
        if (st.k > 1 && t.innerHTML.trim() === st.unit) t.innerHTML = st.orig; /* not changed: exactly as it was, spaces and all */
        else if (outer.innerHTML !== before && st.k > 1) {
            var unit = t.innerHTML.trim(), copies = []; for (var i = 0; i < st.k; i++) copies.push(unit);
            t.innerHTML = copies.join(st.sep);
        }
        if (st.width && st.time && t.offsetWidth !== st.width) {
            t.style.animationDuration = Math.round(st.time * t.offsetWidth / st.width * 10) / 10 + 's';
            stripFix = function () { t.style.animationDuration = st.dur; if (!t.getAttribute('style')) t.removeAttribute('style'); }; /* Undo brings the old pace back with the old words */
        }
        if (!t.getAttribute('style')) t.removeAttribute('style');
    }
    function cancel() {
        var t = editing; if (!t) return;
        fieldsEnd(); /* the fields come back with the words as they were */
        t.innerHTML = before;
        if (hrefBefore !== null) { t.setAttribute('href', hrefBefore); if (linkInput && linkFor === t) linkInput.value = hrefBefore; } /* Esc puts the address back too */
        commit();
    }
    function onKey(e) {
        if (e.isComposing || e.keyCode === 229) return; /* Enter that chooses a word in Japanese or Chinese input is not ours */
        if (previewing) { if (e.key === 'Escape') { e.preventDefault(); leavePreview(); } return; }
        if (dragging) return; /* Esc while a block is held puts it back, and only that (the drag's own listener) */
        var meta = e.metaKey || e.ctrlKey, inField = /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName);
        if (meta && !e.shiftKey && (e.key === 'k' || e.key === 'K')) { e.preventDefault(); openPal(); return; }
        if (pal) { palKey(e); return; }
        if (meta && !e.shiftKey && (e.key === 's' || e.key === 'S')) { e.preventDefault(); save(false); return; }
        if (!editing) {
            if (meta && !e.shiftKey && (e.key === 'z' || e.key === 'Z') && !inField) { e.preventDefault(); undo(); return; }
            if (meta && e.shiftKey && (e.key === 'z' || e.key === 'Z') && !inField) { e.preventDefault(); redo(); return; }
            if (e.key === 'Enter' && held && !inField) { e.preventDefault(); begin(held); return; }
            /* a block is selected: the keys do what its toolbar buttons do. Undo takes any of it back. */
            if (!inField && !e.target.closest('[data-tweakfast]') && toolsFor && tools.style.display !== 'none' && (!picked || groundPicture(toolsFor, picked)) && !menu && !panel && !pal && toolsFor.hasAttribute('data-tf-block')) {
                if (meta && !e.shiftKey && (e.key === 'd' || e.key === 'D')) { e.preventDefault(); copyBlock(); return; }
                if ((e.key === 'Backspace' || e.key === 'Delete') && !meta) { e.preventDefault(); removeBlock(); return; }
                if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') { e.preventDefault(); if (!upBtn.disabled) move(-1); return; }
                if (e.key === 'ArrowDown' || e.key === 'ArrowRight') { e.preventDefault(); if (!downBtn.disabled) move(1); return; }
            }
            if (e.key === 'Tab' && !e.shiftKey && toolsFor && tools.style.display !== 'none' && !e.target.closest('[data-tweakfast]')) { /* from what is picked, Tab goes into its tools */
                var tb = Array.prototype.filter.call(tools.querySelectorAll('button'), function (n) { return !n.disabled && n.getClientRects().length; })[0];
                if (tb) { e.preventDefault(); tb.focus({ preventScroll: true }); return; }
            }
            if (e.key === 'Escape' && !inField) { if (menu) closeMenu(); else if (panel) closePages(); else if (held) { unhold(); if (tools) hideTools(); } else if (picked) unpick(); else { if (tools) hideTools(); hideAlt(); } say(''); }
            if (e.key === 'Escape' && asking) say('');
            return;
        }
        if (linkBox && linkBox.contains(e.target)) {
            if (pagesKey(e)) return;
            if (e.key === 'Escape') { e.preventDefault(); linkInput.value = linkFor ? linkFor.getAttribute('href') || '' : ''; editing.focus(); }
            if (e.key === 'Enter') { e.preventDefault(); var tl = editing; commit(); hold(tl); } /* as Enter in the words: kept, still picked */
            if (e.key === 'Tab' && e.shiftKey) { e.preventDefault(); applyLink(); editing.focus(); }
            else if (e.key === 'Tab') { e.preventDefault(); applyLink(); moveOn(1); }
            return;
        }
        if (e.key === 'Escape') { e.preventDefault(); var tc = editing; cancel(); hold(tc); }
        if (e.key === 'Enter' && e.shiftKey) breakTip(null);
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); var tk = editing; commit(); hold(tk); breakTip(tk); }
        if (e.key === ' ' && !meta && editing.closest('button')) { e.preventDefault(); document.execCommand('insertText', false, ' '); return; } /* in a button's words the space is a space, not a press of the button */
        if (e.key === 'Tab') {
            e.preventDefault();
            /* from a link's words, Tab walks into its Goes-to field first */
            if (!e.shiftKey && linkBox && linkBox.parentNode && (linkFor || linkRange)) { linkInput.focus(); linkInput.select(); return; }
            moveOn(e.shiftKey ? -1 : 1);
        }
    }
    function moveOn(dir) {
        var next = nextText(editing, dir), t = editing;
        commit();
        if (!next) { hold(t); return; } /* the last text: kept and still picked, not lost */
        if (next) { begin(next); next.scrollIntoView({ block: 'nearest' }); placeEdit(); }
    }
    function onPaste(e) {
        if (!editing) return;
        e.preventDefault();
        var text = (e.clipboardData || window.clipboardData).getData('text/plain').replace(/\r\n?/g, '\n');
        if (/^H[1-6]$/.test(editing.tagName)) text = text.replace(/\s*\n\s*/g, ' '); /* a heading is one line */
        var lines = text.split('\n');
        for (var i = 0; i < lines.length; i++) { if (i) document.execCommand('insertLineBreak'); if (lines[i]) document.execCommand('insertText', false, lines[i]); } /* line breaks, not paragraphs inside a paragraph */
    }

    /* ---- what the mouse is over ---- */
    /* A thin outline on the text or picture under the mouse, and a small tag above it saying what it is.
       Nothing is shown over fixed parts, so the owner never guesses; on a phone there is no hover and
       nothing changes. */
    var hoverEl = null, tag = null, moveTick = false;
    var ptPrev = null, ptNow = null, lastMove = null;
    function onMove(ev) {
        if (previewing) return;
        ptPrev = ptNow; ptNow = { x: ev.clientX, y: ev.clientY }; lastMove = ev;
        if (moveTick) return; moveTick = true;
        requestAnimationFrame(function () {
            moveTick = false;
            var e = lastMove; /* the newest position in this frame, not the first */
            if (dragging || locked) return;
            var t = e.target;
            if (!t || t.nodeType !== 1 || editing || bar.contains(t) || (tools && tools.contains(t)) || (panel && panel.contains(t)) || (menu && menu.contains(t)) || (linkBox && linkBox.contains(t)) || (altBox && altBox.contains(t)) || t.closest('.tf-plus')) { hoverNone(); return; }
            var el_ = pictureTarget(t) || textUnder(e) || pictureUnder(e) || artTarget(t) || svgTarget(t);
            if (el_ && el_ === held) { hoverNone(); return; }
            if (!el_ || el_ === picked) { hoverNone(); return; }
            if (el_ === hoverEl) { placeTag(); return; }
            hoverNone();
            hoverEl = el_; el_.classList.add('tf-hover');
            if (el_.tagName === 'IMG' && !el_.contains(t)) document.getElementById('tf-style').classList.add('tf-through'); /* the picture lies under empty boxes: the hand shows all the same */
            if (!tag) { tag = el('span', 'tf-tag'); tag.setAttribute('data-tweakfast', ''); document.body.appendChild(tag); }
            /* the tag names the thing a click will take */
            var lk = t.closest('a[href]'), what = lk && el_ !== lk && el_.contains(lk) ? 'Link' : nameOf(el_);
            tag.textContent = what;
            tag.style.display = what ? 'block' : 'none';
            placeTag(); syncBlockHover();
        });
    }
    var hoverBox = null;
    function placeTag() {
        if (!hoverEl || !tag) return;
        var r = hoverEl.getBoundingClientRect();
        placeTagAt(r, hoverEl, false);
        if (!hoverBox) { hoverBox = el('span', 'tf-hover-box'); hoverBox.setAttribute('data-tweakfast', ''); document.body.appendChild(hoverBox); }
        frame(hoverBox, r, hoverEl); hoverBox.style.display = toolsHover ? 'none' : 'block'; /* one line at a time */
    }
    /* a line drawn on a part's edge, just inside it, with the part's own corners: never off the edge, never on its
       neighbour. The lines are ours, so a site's own transitions cannot delay them */
    function frame(box, r, of, at) {
        /* a full-width element's box stays inside the page's sides: past the edge made the page scroll sideways. And
           6 px in from them: a line on the window's very edge is lost in the bezel and under the scrollbar, and on a
           band taller than the window those two sides are all that says it is selected */
        var edge = -window.scrollX, far = document.documentElement.clientWidth - window.scrollX;
        var left = r.left <= edge ? edge + 6 : r.left, right = r.right >= far ? far - 6 : r.right;
        put(box, left, r.top, at || of);
        box.style.width = Math.max(0, right - left) + 'px'; box.style.height = r.height + 'px';
        box.style.borderRadius = of ? getComputedStyle(of).borderRadius : '';
    }
    /* our overlays sit in the page (absolute), so they scroll with it as one piece; a window-fixed box moved by
       scroll events lags a frame behind on a phone. Window coordinates in, page coordinates set. A part that stays put
       in the window while the page scrolls (in a fixed header, a stuck sticky one) is framed in the window instead: in
       the page, its line rode off with the scroll for a frame and snapped back. */
    function put(node, x, y, of) {
        var b = document.body;
        if (of && inWindow(of)) { node.style.position = 'fixed'; node.style.left = x + 'px'; node.style.top = y + 'px'; return; }
        if (node.style.position === 'fixed' && node !== tools) node.style.position = '';
        if (getComputedStyle(b).position !== 'static') { var br = b.getBoundingClientRect(); x -= br.left + b.clientLeft; y -= br.top + b.clientTop; }
        else { x += window.scrollX; y += window.scrollY; }
        node.style.left = x + 'px'; node.style.top = y + 'px';
    }
    /* held in the window while the page scrolls: inside something fixed, or something sticky that has reached its stop */
    /* a part that rides with the screen (fixed, or sticky whether stuck right now or not): what is under it changes with every scroll */
    function pinned(n) {
        for (; n && n.nodeType === 1 && n !== document.body; n = n.parentElement) { var pos = getComputedStyle(n).position; if (pos === 'fixed' || pos === 'sticky') return true; }
        return false;
    }
    function inWindow(n) {
        if (n && n.nodeType !== 1) n = n.commonAncestorContainer || n.parentElement; /* a range of words: the part holding it */
        if (n && n.nodeType !== 1) n = n.parentElement;
        for (; n && n !== document.body && n !== document.documentElement; n = n.parentElement) {
            var cs = getComputedStyle(n);
            if (cs.position === 'fixed') return true;
            if (cs.position === 'sticky') { var stop = parseFloat(cs.top); if (!isNaN(stop) && Math.abs(n.getBoundingClientRect().top - stop) < 1) return true; }
        }
        return false;
    }
    function hoverNone() {
        var st = document.getElementById('tf-style'); if (st) st.classList.remove('tf-through');
        if (hoverEl) { hoverEl.classList.remove('tf-hover'); if (!hoverEl.className) hoverEl.removeAttribute('class'); hoverEl = null; }
        if (tag) tag.style.display = 'none';
        if (hoverBox) hoverBox.style.display = 'none';
        syncBlockHover();
    }
    /* what a thing is called, on its hover tag and at the front of its toolbar */
    function nameOf(n) {
        var tg = n.tagName;
        if (tg === 'IMG' || tg === 'svg' || tg === 'PICTURE' || n.hasAttribute('data-tf-art')) return 'Picture';
        if (/^H[1-6]$/.test(tg)) return 'Heading';
        if (tg === 'BUTTON' || isButton(n)) return 'Button';
        if (tg === 'A') return 'Link';
        if (tg === 'FIGCAPTION') return 'Caption';
        if (tg === 'TIME') return 'Date';
        if (tg === 'HEADER') return 'Header'; if (tg === 'FOOTER') return 'Footer'; if (tg === 'NAV') return 'Menu';
        if (tg === 'TR') return 'Row';
        if (/^(LI|DT|DD)$/.test(tg)) return n.hasAttribute('data-tf-block') ? 'Item' : 'Text';
        if (n.hasAttribute('data-tf-block')) return isRepeated(n) && n.getBoundingClientRect().width < n.ownerDocument.documentElement.clientWidth - 1 ? 'Card' : 'Section'; /* two sections alike are still sections: a card is narrower than the page */
        return isTextLeaf(n) ? 'Text' : 'Block';
    }
    /* the pointer over a block, not over words or a picture in it: a dashed line round the block and its name.
       The selected block has its own solid line, so no hover line on it. */
    var blockHover = null, blockHoverEl = null;
    function hoverBlock(b) { blockHoverEl = b; syncBlockHover(); }
    function syncBlockHover() {
        var b = blockHoverEl;
        if (!blockHover) { if (!b) return; blockHover = el('span', 'tf-block-hover'); blockHover.setAttribute('data-tweakfast', ''); document.body.appendChild(blockHover); }
        if (!b || !b.isConnected || hoverEl || editing || dragging || b === toolsFor || toolsHover) { blockHover.style.display = 'none'; if (!hoverEl && tag) tag.style.display = 'none'; return; }
        var r = b.getBoundingClientRect();
        frame(blockHover, r, columnOf(b) && !onPicture(b) ? null : b, b); blockHover.style.display = 'block';
        if (!tag) { tag = el('span', 'tf-tag'); tag.setAttribute('data-tweakfast', ''); document.body.appendChild(tag); }
        tag.textContent = nameOf(b); tag.style.display = 'block';
        placeTagAt(r, b, true);
    }
    /* the name label: a block's sits inside its top-left corner, on its line, so it never leaves the block, never
       covers a neighbour or the menu, and scrolls with it as one piece; a thing inside a block (words, a picture)
       keeps its label just above. Once the top has gone under the fixed menu or off the window while some of the
       part still shows, the label waits just under the menu (held in the window, as the toolbar does); gone with it. */
    function placeTagAt(r, of, inside) {
        if (!tag) return;
        var cover = topCover(), floor = cover && !cover.contains(of) ? cover.getBoundingClientRect().bottom + 4 : 4;
        var edge = -window.scrollX, x = inside ? (r.left <= edge ? edge + 6 : r.left) + 4 : Math.max(4, r.left), y = inside ? r.top + 4 : r.top - 22;
        if (r.bottom < floor + 22 || r.top > window.innerHeight) { tag.style.visibility = 'hidden'; return; } /* nothing left to name */
        tag.style.visibility = '';
        if (y < floor && !inWindow(of)) { tag.style.position = 'fixed'; tag.style.left = x + 'px'; tag.style.top = floor + 'px'; return; }
        put(tag, x, Math.max(floor, y), of);
    }

    /* ---- where a link goes ---- */
    /* While a link, or text with a link under the caret, is being edited, a small field under it shows the
       address. A new address is kept on Enter or when the edit ends; an empty field changes nothing. */
    var linkBox = null, linkInput = null, linkFor = null, linkList = null, linkRange = null, linkLabel = null, linkRemove = null, linkTyped = false; /* typed by the owner since the field last turned to its words */
    function linkAt() {
        if (!editing) return null;
        if (editing.matches('a[href]')) return editing;
        var sel = document.getSelection(), n = sel && sel.anchorNode;
        if (!n || !editing.contains(n)) return null;
        var a = (n.nodeType === 1 ? n : n.parentElement).closest('a[href]');
        return a && editing.contains(a) ? a : null;
    }
    /* selected words with no link yet can become one: the bar appears with an empty field */
    function selectedWords() {
        var sel = document.getSelection();
        if (!editing || !sel || sel.rangeCount !== 1 || sel.isCollapsed) return null;
        var r = sel.getRangeAt(0);
        if (!editing.contains(r.commonAncestorContainer) || !r.toString().trim()) return null;
        return r.cloneRange();
    }
    /* the field is part of the toolbar whenever words are edited: "Goes to" with the address for a link, "Link to" empty for
       plain words (an address typed there makes the chosen words a link, or all of them when nothing is chosen). The toolbar
       away (a part with nothing else to offer), the field stands by the words on its own, as it did before. */
    function linkHome() { return tools && tools.style.display === 'flex' && toolsFor && editing && toolsFor.contains(editing) ? tools : document.body; }
    function showLink() {
        if (!editing) { hideLink(); return; }
        var a = linkAt(), rg = a ? null : selectedWords();
        if (!linkBox) {
            linkBox = el('div', 'tf-link'); linkBox.setAttribute('data-tweakfast', '');
            linkLabel = el('span', 'tf-link-label', 'Goes to'); linkBox.appendChild(linkLabel);
            linkInput = el('input', 'tf-input'); linkInput.type = 'text'; linkInput.autocomplete = 'off'; linkInput.spellcheck = false;
            var field = el('span', 'tf-link-field'), mark = el('span', 'tf-link-mark'); mark.innerHTML = ICON.link; field.appendChild(mark); field.appendChild(linkInput); /* in the toolbar the field has no label: a link mark inside it says what it is */
            linkBox.appendChild(field);
            var open = el('button', 'tf-link-open'); open.type = 'button'; tip(open, 'Open in a new tab'); open.setAttribute('aria-label', 'Open in a new tab');
            open.innerHTML = '<svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9 9 3M4 3h5v5"/></svg>';
            open.addEventListener('click', function () { applyLink(); var to = linkFor && linkFor.getAttribute('href'); if (to) window.open(to, '_blank'); linkInput.focus(); });
            linkBox.appendChild(open);
            linkRemove = el('button', 'tf-button tf-small', 'Remove'); linkRemove.type = 'button';
            linkRemove.addEventListener('click', removeLink);
            linkBox.appendChild(linkRemove);
            linkInput.addEventListener('input', function () { linkTyped = true; showPages(); });
            linkInput.addEventListener('focus', showPages);
            linkInput.addEventListener('blur', function () { applyLink(); hidePages(); });
            window.addEventListener('scroll', function () { placeLink(); placePages(); }, true); window.addEventListener('resize', function () { placeLink(); placePages(); });
        }
        if (a && a !== linkFor) { applyLink(); linkFor = a; linkRange = null; linkInput.value = a.getAttribute('href') || ''; linkTyped = false; }
        if (!a) { linkFor = null; linkRange = rg; linkInput.value = ''; linkTyped = false; }
        linkLabel.textContent = a ? 'Goes to' : 'Link to'; linkInput.placeholder = a ? 'Page, address or phone' : 'A page of the site, or an address';
        linkRemove.style.display = a ? '' : 'none'; linkBox.querySelector('.tf-link-open').style.display = a ? '' : 'none';
        var home = linkHome();
        if (linkBox.parentNode !== home) {
            linkBox.classList.toggle('tf-link-in', home === tools);
            if (home === tools) { tools.appendChild(linkBox); linkBox.style.width = ''; linkBox.style.left = linkBox.style.top = ''; sepSync(); fitRows(); } /* a second row under the tools: one toolbar, one surface, the name and the tools above, the address below */
            else document.body.appendChild(linkBox);
        }
        if (linkBox.parentNode === tools) placeTools(); else placeLink();
    }
    /* a wrapping toolbar grows to the width of both rows side by side (how a browser sizes it), so it is held at the
       width of the tools row and the address row takes that. On a phone the strip has the bar's width already. */
    function fitRows() {
        tools.style.width = '';
        if (!linkBox || linkBox.parentNode !== tools || coarse()) return;
        var w = 0, n = 0; /* the tools row, summed: the toolbar sits absolute, so its own width could be cut by the window's right edge */
        Array.prototype.forEach.call(tools.children, function (c) { if (c === linkBox || !c.getClientRects().length) return; var cs = getComputedStyle(c), auto = c === moreBtn; w += c.getBoundingClientRect().width + (auto ? 0 : (parseFloat(cs.marginLeft) || 0) + (parseFloat(cs.marginRight) || 0)); n++; }); /* More's margin is the slack, not a width of its own */
        tools.style.width = Math.max(280, Math.ceil(w + 3 * Math.max(0, n - 1) + 8)) + 'px'; /* never narrower than the address row needs */
    }
    function placeLink() {
        if (!linkBox || !linkBox.parentNode || linkBox.parentNode === tools || !editing) return; /* in the toolbar it goes where the toolbar goes */
        var r = (linkFor || linkRange || editing).getBoundingClientRect(), w = Math.min(360, window.innerWidth - 16);
        linkBox.style.width = w + 'px';
        put(linkBox, Math.max(8, Math.min(r.left, window.innerWidth - w - 8)), bubbleTop(r, linkBox.offsetHeight || 40), linkFor || editing);
    }
    /* the site's pages under the link field: our own list in the menu's glass, not the browser's datalist. It opens when the field
       takes focus with every page (the menu's first, then the others), narrows as the owner types with the palette's matching, and goes
       away for an address. A row is lit once something is typed; arrows move, Enter takes the lit row, Esc closes; a row keeps the focus in the field. */
    var pageRows = [], pageAt = 0;
    function showPages() {
        if (!linkInput || !linkBox.parentNode) return;
        var q = linkInput.value.trim().toLowerCase();
        if (q && (/^(https?:|mailto:|tel:|#|\/|\.|www\.)/.test(q) || q.indexOf('@') >= 0)) { hidePages(); return; } /* an address: no list */
        if (!linkList) { linkList = el('div', 'tf-menu tf-pages-list'); linkList.setAttribute('data-tweakfast', ''); linkList.setAttribute('role', 'listbox'); document.body.appendChild(linkList); }
        linkList.textContent = ''; pageRows = []; pageAt = q ? 0 : -1; /* a row is lit once something is typed; Enter in an untouched field keeps the words as before */
        findPages();
        var items = pageList().concat(otherList()).map(function (pg) { pg.rank = Math.max(palHit(pg.name, q), palHit(pg.path, q)); return pg; }).filter(function (pg) { return pg.rank; });
        if (q) items.sort(function (a, b) { return b.rank - a.rank; });
        if (!items.length) linkList.appendChild(el('div', 'tf-pages-none', 'No page for “' + linkInput.value.trim() + '”. An address works too.'));
        items.forEach(function (pg, i) {
            var row = el('button', 'tf-item tf-page-item'); row.type = 'button'; row.setAttribute('role', 'option'); row.tabIndex = -1; row.innerHTML = ICON.page;
            row.appendChild(el('span', 'tf-page-name', pg.name)); row.appendChild(el('span', 'tf-page-file', pg.path));
            row.addEventListener('pointerdown', function (e) { e.preventDefault(); }); /* the field keeps the focus */
            row.addEventListener('click', function () { takePage(pg.path); });
            row.addEventListener('mousemove', function () { if (pageAt !== i) { pageAt = i; litPage(); } });
            linkList.appendChild(row); pageRows.push(row);
        });
        litPage(); placePages();
    }
    function litPage() { for (var i = 0; i < pageRows.length; i++) pageRows[i].classList.toggle('tf-lit', i === pageAt); if (pageRows[pageAt]) pageRows[pageAt].scrollIntoView({ block: 'nearest' }); }
    function takePage(path) { linkInput.value = path; linkTyped = true; hidePages(); applyLink(); linkInput.focus(); }
    function placePages() {
        if (!linkList || !linkBox || !linkBox.parentNode) return;
        var r = linkBox.getBoundingClientRect(), w = Math.max(240, Math.min(360, r.width, window.innerWidth - 16)), h = linkList.offsetHeight;
        var left = Math.max(8, Math.min(r.left, window.innerWidth - w - 8)), top = r.bottom + 6, floor = window.innerHeight - 8;
        if (bar && bar.getBoundingClientRect().top < floor) floor = bar.getBoundingClientRect().top - 8;
        if (top + h > floor && r.top - 6 - h >= 8) top = r.top - 6 - h; /* no room below: above the field */
        linkList.style.width = w + 'px'; linkList.style.left = left + 'px'; linkList.style.top = top + 'px';
    }
    function hidePages() { if (linkList) fade(linkList); linkList = null; pageRows = []; pageAt = 0; }
    /* keys in the field while the list is open: arrows move the lit row, Enter takes it, Esc closes the list only */
    function pagesKey(e) {
        if (!linkList) return false;
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); if (pageRows.length) { pageAt = pageAt < 0 ? (e.key === 'ArrowDown' ? 0 : pageRows.length - 1) : (pageAt + (e.key === 'ArrowDown' ? 1 : pageRows.length - 1)) % pageRows.length; litPage(); } return true; }
        if (e.key === 'Enter' && pageAt >= 0 && pageRows[pageAt]) { e.preventDefault(); pageRows[pageAt].click(); return true; }
        if (e.key === 'Escape') { e.preventDefault(); hidePages(); return true; }
        return false;
    }
    /* a bubble goes under its element; at the foot of the window, or over the bar, it goes above instead.
       Under the page's end it would lengthen the page: the white strip below the footer. */
    /* a field or menu opened from the toolbar: 8 under it, its left edge on the button that opened it; no room below:
       8 above the toolbar. On a phone the toolbar is docked at the bottom, so the field keeps to its element instead. */
    function popAt(box, anchor) {
        if (!tools || tools.style.display === 'none' || tools.classList.contains('tf-tools-dock') || !anchor || anchor.style.display === 'none') return false;
        var tr = tools.getBoundingClientRect(), ar = anchor.getBoundingClientRect(), w = box.offsetWidth, h = box.offsetHeight || 40;
        var left = Math.max(8, Math.min(ar.left, window.innerWidth - w - 8)), top = tr.bottom + 8, floor = window.innerHeight - 8;
        if (bar && bar.getBoundingClientRect().top < floor) floor = bar.getBoundingClientRect().top - 8;
        if (top + h > floor) top = tr.top - h - 8;
        put(box, left, Math.max(8, top), toolsFor); return true;
    }
    function bubbleTop(r, h) {
        var floor = window.innerHeight - 8;
        if (bar && bar.getBoundingClientRect().top < floor) floor = bar.getBoundingClientRect().top - 8;
        if (r.bottom + 6 + h <= floor) return r.bottom + 6;
        if (r.top - 6 - h >= 8) return r.top - 6 - h;
        return Math.max(8, floor - h);
    }
    function hideLink() {
        hidePages();
        var was = linkBox && linkBox.parentNode; if (was) linkBox.remove(); linkFor = null; linkRange = null; linkTyped = false; if (linkInput) linkInput.value = '';
        tools.style.width = ''; if (was === tools && toolsFor && toolsFor.isConnected && tools.style.display === 'flex') { sepSync(); placeTools(); } /* the toolbar shrinks back and re-centres */
    }
    /* the words become a link; the text step at the end of the edit carries it, so Undo takes it back as one */
    function makeLink(to) {
        var rg = linkRange, a = document.createElement('a'); a.setAttribute('href', to);
        try { rg.surroundContents(a); } catch (e) { a.appendChild(rg.extractContents()); rg.insertNode(a); }
        linkRange = null; linkFor = a; linkInput.value = to; placeEdit(); showLink();
    }
    /* the link goes, the words stay; a link that is the edited element itself becomes plain words in a span */
    function removeLink() {
        var a = linkFor; if (!a) return;
        if (a === editing) {
            commit();
            var wasOuter = cleanOuter(a), sp = document.createElement('span');
            for (var i = 0; i < a.attributes.length; i++) if (!/^(href|target|rel|download|hreflang|ping|referrerpolicy|type)$/i.test(a.attributes[i].name)) sp.setAttribute(a.attributes[i].name, a.attributes[i].value); /* the words keep their look */
            while (a.firstChild) sp.appendChild(a.firstChild);
            a.parentNode.replaceChild(sp, a);
            steps.push(function () { while (sp.firstChild) a.appendChild(sp.firstChild); sp.parentNode.replaceChild(a, sp); });
            refresh(); hideLink(); mirror(sp, wasOuter); return;
        }
        var parent = a.parentNode; while (a.firstChild) parent.insertBefore(a.firstChild, a); parent.removeChild(a);
        linkFor = null; hideLink(); editing.focus();
    }
    function applyLink() {
        if (!linkFor && !linkRange && linkTyped && editing && linkInput && linkInput.value.trim()) { linkRange = document.createRange(); linkRange.selectNodeContents(editing); } /* nothing chosen: all the words become the link */
        if (linkRange && linkInput) { var dest = address(linkInput.value); if (dest) makeLink(dest); else linkRange = null; return; }
        var a = linkFor; if (!a || !linkInput) return;
        var to = address(linkInput.value), was = a.getAttribute('href');
        if (!to || to === was) return;
        a.setAttribute('href', to);
        linkInput.value = to;
        /* inside edited text the text step covers it; a link that is the edited element needs its own step */
        /* a link that is the edited text: its address is kept with the words, in the text's one step, when the text is kept */
    }
    /* forgiving: www.shop.com gets https://, a mail address gets mailto:, a page of the site stays as typed */
    function address(v) {
        v = String(v || '').trim();
        if (!v) return '';
        if (/^(https?:|mailto:|tel:|#|\/|\.\/|\.\.\/)/i.test(v)) return v;
        if (/^[\w.+-]+@[\w-]+\.[\w.-]+$/.test(v)) return 'mailto:' + v;
        if (/^\+?[\d\s()\/.-]+$/.test(v) && v.replace(/\D/g, '').length >= 6) return 'tel:' + v.replace(/[^\d+]/g, ''); /* a phone number */
        var low = v.toLowerCase(), pages = pageList();
        for (var i = 0; i < pages.length; i++) if (pages[i].name.trim().toLowerCase() === low || pages[i].path.toLowerCase() === low || pages[i].path.replace(/\.html$/, '').toLowerCase() === low) return pages[i].path; /* a page by its name */
        if (/^www\./i.test(v)) return 'https://' + v;
        var host = v.split(/[\/?#]/)[0];
        if (/\.html?$/i.test(host) || pages.some(function (pg) { return pg.path.toLowerCase() === host.toLowerCase(); })) return v; /* a page of the site with a part after it: index.html#services */
        if (/^[\w-]+(\.[\w-]+)+(:\d+)?$/.test(host) && (host !== v || !/\.html?$/i.test(v))) return 'https://' + v; /* shop.com, shop.com/menu.html */
        return v;
    }
    document.addEventListener('selectionchange', function () { if (editing && !(linkBox && linkBox.contains(document.activeElement))) showLink(); });

    /* ---- what a picture shows ---- */
    /* A clicked picture gets a small field under it with its description (the alt text): what a screen reader
       says and what search engines read. Enter or clicking away keeps it; empty is allowed. */
    var ALT_ON = false; /* the Describes field is out for now (2026-10-19): the field and the toolbar button wait on this flag; true brings both back */
    var altBox = null, altInput = null, altFor = null;
    function showAlt(img) {
        if (!ALT_ON) return;
        if (!altBox) {
            altBox = el('div', 'tf-link'); altBox.setAttribute('data-tweakfast', '');
            altBox.appendChild(el('span', 'tf-link-label', 'Describes'));
            altInput = el('input', 'tf-input'); altInput.type = 'text'; altInput.autocomplete = 'off'; altInput.placeholder = 'What the picture shows, for blind readers and Google';
            altBox.appendChild(altInput);
            altInput.addEventListener('blur', function () { applyAlt(); });
            altInput.addEventListener('keydown', function (e) {
                if (e.key === 'Enter') { e.preventDefault(); applyAlt(); unpick(); }
                if (e.key === 'Escape') { e.preventDefault(); altInput.value = altFor.getAttribute('alt') || ''; unpick(); }
            });
            window.addEventListener('scroll', placeAlt, true); window.addEventListener('resize', placeAlt);
        }
        if (altFor && altFor !== img) applyAlt();
        altFor = img; altInput.value = isArt(img) ? '' : (img.getAttribute('alt') || '');
        if (isArt(img)) { if (altBox.parentNode) altBox.remove(); return; } /* a drawn box has no words to describe: Replace, in the toolbar, is all */
        if (!altBox.parentNode) document.body.appendChild(altBox);
        placeAlt();
    }
    function placeAlt() {
        if (!altBox || !altBox.parentNode || !altFor) return;
        var r = altFor.getBoundingClientRect(), w = Math.min(420, Math.max(240, r.width), window.innerWidth - 16);
        altBox.style.width = w + 'px';
        if (popAt(altBox, altBtn)) return;
        put(altBox, Math.max(8, Math.min(r.left, window.innerWidth - w - 8)), bubbleTop(r, altBox.offsetHeight || 48), altFor);
    }
    function hideAlt() { applyAlt(); if (altBox && altBox.parentNode) altBox.remove(); altFor = null; }
    /* a click selects a picture: the solid line and its small bar; a second click, Replace, or a dropped file swaps it */
    var picked = null;
    function pick(img) {
        hoverNone(); picked = img; showEditBox(); clearBar(img);
        if (tools) { var bk = toolTarget(img); if (bk) showTools(bk); else hideTools(); } /* the toolbar first: the Describes field hangs from it */
        showAlt(img);
        if (isArt(img) && img.tagName !== 'svg' && drawnWords(img)) once('drawn', 'The words on this box are drawn by the site\'s style and cannot be changed here. A photo covers them.');
    }
    function drawnWords(n) {
        var a = getComputedStyle(n, '::after').content, b = getComputedStyle(n, '::before').content;
        return /^"(?:[^"]*[A-Za-z0-9][^"]*)"$/.test(a) || /^"(?:[^"]*[A-Za-z0-9][^"]*)"$/.test(b);
    }
    /* the bar hides the page's last words: while something is edited the page gets room under its end, in the
       footer's own colour, and the edited element is scrolled up from under the bar */
    var room = null;
    function clearBar(t) {
        if (!bar) return;
        if (!room) {
            room = el('div'); room.setAttribute('data-tweakfast', ''); room.setAttribute('aria-hidden', 'true');
            room.style.cssText = 'height:0;transition:none;pointer-events:none';
            document.body.appendChild(room);
        }
        var last = room.previousElementSibling; while (last && (last.hasAttribute('data-tweakfast') || !last.offsetHeight)) last = last.previousElementSibling;
        var ground = last ? getComputedStyle(last).backgroundColor : '';
        if (!ground || ground === 'rgba(0, 0, 0, 0)' || ground === 'transparent') ground = getComputedStyle(document.body).backgroundColor;
        room.style.background = ground;
        room.style.height = (bar.offsetHeight + 32) + 'px';
        var r = t.getBoundingClientRect(), top = bar.getBoundingClientRect().top - 8;
        if (r.bottom > top && r.top > 8) window.scrollBy({ top: Math.min(r.bottom - top, r.top - 8), behavior: motion() });
    }
    function giveRoom() { if (room && !editing && !picked) room.style.height = '0'; }
    function unpick() { picked = null; if (editBox && !editing) editBox.style.display = 'none'; hideAlt(); giveRoom(); if (tools && toolsFor) showTools(toolsFor); }
    function applyAlt() {
        var img = altFor; if (!img || !altInput || isArt(img)) return;
        var to = altInput.value.trim(), was = img.getAttribute('alt');
        if (to === (was || '')) return;
        var wasOuter = cleanOuter(img);
        img.setAttribute('alt', to);
        steps.push(function () { if (was === null) img.removeAttribute('alt'); else img.setAttribute('alt', was); });
        refresh();
        mirror(img, wasOuter);
    }

    /* ---- pictures ---- */
    function markPictures() {
        var imgs = document.querySelectorAll('img');
        for (var i = 0; i < imgs.length; i++) if (!pinned(imgs[i])) imgs[i].classList.add('tf-picture');
    }
    function swapPicture(img) {
        var input = el('input'); input.type = 'file'; input.accept = 'image/*';
        input.addEventListener('change', function () { var file = input.files && input.files[0]; if (file) usePicture(img, file); });
        input.click();
    }
    /* a file dragged in from the desktop: the line shows on the picture it would replace; dropped, it replaces it */
    var dropOn = null;
    function fileDrag(e) {
        var dt = e.dataTransfer; if (!dt || !dt.types || Array.prototype.indexOf.call(dt.types, 'Files') < 0) return null;
        e.preventDefault();
        if (locked || previewing || saving) return null; /* nothing changes while the link is dead, in Preview or while saving */
        var t = e.target && e.target.nodeType === 1 ? e.target : null;
        return t && !bar.contains(t) ? (pictureTarget(t) || pictureUnder(e) || artTarget(t) || svgTarget(t)) : null;
    }
    function onDragOver(e) {
        var pic = fileDrag(e); if (!e.defaultPrevented) return;
        e.dataTransfer.dropEffect = pic ? 'copy' : 'none';
        if (pic !== dropOn) {
            dropOn = pic; hoverNone();
            if (pic && pic !== picked) {
                hoverEl = pic; pic.classList.add('tf-hover');
                if (!tag) { tag = el('span', 'tf-tag'); tag.setAttribute('data-tweakfast', ''); document.body.appendChild(tag); }
                tag.textContent = 'Picture'; tag.style.display = 'block'; placeTag();
            }
        }
    }
    function onDrop(e) {
        var pic = fileDrag(e); if (!e.defaultPrevented) return;
        dropOn = null; hoverNone();
        if (locked || previewing || saving) return;
        if (!pic) { say('Drop it on a picture to replace that one.'); return; }
        var file = e.dataTransfer.files[0];
        if (!file || !/^image\//.test(file.type)) { say('That is not a picture.', 'error'); return; }
        if (editing) commit(); if (held) unhold();
        if (picked !== pic) { if (picked) unpick(); pick(pic); }
        usePicture(pic, file);
    }
    /* the other sizes of a picture (srcset, sizes, a <picture>'s sources) taken away, so the new one is what shows;
       the function given back puts them back */
    function loseSets(img) {
        var at = { srcset: img.getAttribute('srcset'), sizes: img.getAttribute('sizes') }, box = img.parentElement, srcs = [];
        if (box && box.tagName === 'PICTURE') Array.prototype.forEach.call(box.querySelectorAll(':scope > source'), function (n) { srcs.push({ n: n, next: n.nextSibling }); n.remove(); });
        img.removeAttribute('srcset'); img.removeAttribute('sizes');
        return function () {
            putAttr(img, 'srcset', at.srcset); putAttr(img, 'sizes', at.sizes);
            srcs.slice().reverse().forEach(function (x) { box.insertBefore(x.n, x.next && x.next.parentNode === box ? x.next : img); });
        };
    }
    function usePicture(img, file) {
        var wasOuter = cleanOuter(img);
        (function () {
            say('Reading the picture…');
            shrink(file, (img.getBoundingClientRect().width || img.clientWidth || 400) * 2, function (url, err) {
                if (err) { say(err, 'error'); return; }
                if (!img.isConnected || saving || locked) { say(''); return; } /* taken away (an Undo) or saving meanwhile */
                if (img.tagName === 'svg') { fillSvg(img, url, wasOuter); return; }
                if (isArt(img)) { fillArt(img, url, wasOuter); return; }
                var was = { src: img.getAttribute('src'), style: img.getAttribute('style'), pos: img.getAttribute('data-tf-pos'), alt: img.getAttribute('alt') };
                var sets = loseSets(img); /* a srcset or a <picture>'s sources would keep showing the old photo */
                keepFrame(img);
                img.src = url;
                img.setAttribute('alt', ''); /* the old words no longer fit; one step with the picture */
                img.setAttribute('data-tf-pos', '50% 50%');
                img.style.objectPosition = '50% 50%';
                steps.push(function () {
                    sets();
                    img.setAttribute('src', was.src);
                    putAttr(img, 'style', was.style);
                    putAttr(img, 'data-tf-pos', was.pos);
                    putAttr(img, 'alt', was.alt);
                });
                refresh();
                say(''); picHint();
                enableDrag(img);
                if (altFor === img) { altInput.value = ''; placeAlt(); }
                placeEdit();
                /* on the desk the caret goes into the empty field, the one thing left to do; on a phone no keyboard pops up */
                if (altFor === img && !coarse()) altInput.focus();
                mirror(img, wasOuter);
            });
        })();
    }
    function picHint() { once('pichint', 'Drag inside the picture to choose the part shown.'); }
    /* the photo becomes a real picture laid over the box, covering what the stylesheet paints on it; from then on it is
       a picture like any other (swap, Describes, drag to choose the part shown). Undo takes the picture out. */
    function fillArt(box, url, wasOuter) {
        wasOuter = wasOuter || cleanOuter(box);
        var img = document.createElement('img'); img.alt = ''; img.src = url;
        img.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;object-fit:cover;object-position:50% 50%;z-index:1;margin:0;max-width:none;border-radius:inherit';
        img.setAttribute('data-tf-pos', '50% 50%');
        var wasPos = box.style.position;
        if (getComputedStyle(box).position === 'static') box.style.position = 'relative';
        box.insertBefore(img, box.firstChild); box.removeAttribute('data-tf-art');
        markPictures(); enableDrag(img);
        steps.push(function () { img.remove(); box.style.position = wasPos; if (box.getAttribute('style') === '') box.removeAttribute('style'); });
        refresh();
        if (picked === box) { unpick(); pick(img); }
        say(''); picHint();
        mirror(box, wasOuter);
    }
    /* a sentence said once per visit */
    /* pages answer in the order they load; the sentence names them in the menu's order, the same every time */
    function exceptPages(differ, what) {
        var list = pageList(), at = function (p) { for (var i = 0; i < list.length; i++) if (list[i].path === p) return i; return list.length; };
        var names = differ.slice().sort(function (a, b) { return at(a) - at(b) || (a < b ? -1 : 1); }).map(function (p) { var i = at(p); return i < list.length ? list[i].name : p; });
        return 'Made on every page except ' + names.join(', ') + ', where ' + what + ' is different.';
    }
    function once(name, text) {
        try { if (sessionStorage.getItem('tweakfast:' + name)) return; sessionStorage.setItem('tweakfast:' + name, '1'); } catch (e) {}
        say(text);
    }
    function keepFrame(img) {
        var w = img.clientWidth, h = img.clientHeight;
        if (!w || !h) return;
        img.style.aspectRatio = w + ' / ' + h;
        img.style.objectFit = 'cover';
        img.style.width = getComputedStyle(img).width;
    }
    var PICTURE_ROOM = 4.5 * 1024 * 1024; /* under the site's 5 MB, with room to spare */
    function bytesOf(dataUrl) { return Math.floor((dataUrl.length - dataUrl.indexOf(',') - 1) * 3 / 4); }
    function hasClearPixels(c) {
        var d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data, i;
        for (i = 3; i < d.length; i += 16) if (d[i] < 255) return true; /* every fourth pixel is enough to tell */
        return false;
    }
    function shrink(file, maxW, cb) {
        if (file.type === 'image/gif' && file.size < 4 * 1024 * 1024) { /* a GIF may move: kept as it is */
            var fr = new FileReader(); fr.onload = function () { cb(fr.result); }; fr.onerror = function () { cb(null, 'This picture could not be read.'); }; fr.readAsDataURL(file); return;
        }
        var url = URL.createObjectURL(file), im = new Image();
        im.onload = function () {
            var nw = im.naturalWidth || 1200, nh = im.naturalHeight || 800, s = Math.min(1, maxW / nw), tries = 0;
            var png = /png|gif|webp|svg/.test(file.type); /* what may be see-through stays see-through */
            var c = document.createElement('canvas');
            URL.revokeObjectURL(url);
            /* the site keeps pictures up to 5 MB: one that comes out larger is drawn smaller (a PNG with nothing
               see-through becomes a JPEG first), so it is known now, not refused at Done */
            (function draw() {
                c.width = Math.max(1, Math.round(nw * s)); c.height = Math.max(1, Math.round(nh * s));
                c.getContext('2d').drawImage(im, 0, 0, c.width, c.height);
                var out = c.toDataURL(png ? 'image/png' : 'image/jpeg', 0.86);
                if (bytesOf(out) <= PICTURE_ROOM) { cb(out); return; }
                if (png && !hasClearPixels(c)) { png = false; draw(); return; }
                if (++tries > 6) { cb(null, 'This picture is too large to save, even made smaller. Choose a smaller one.'); return; }
                s *= 0.7; draw();
            })();
        };
        im.onerror = function () { URL.revokeObjectURL(url); cb(null, /hei[cf]/i.test(file.type + ' ' + file.name) ? 'This picture could not be read. HEIC photos may need to be saved as JPEG first.' : 'This picture could not be read. Try a JPEG or PNG.'); };
        im.src = url;
    }
    function enableDrag(img) {
        if (img._tfDrag) return; img._tfDrag = true;
        var startX, startY, startPos, moved;
        img.addEventListener('pointerdown', function (e) {
            if (e.button !== 0 || locked || previewing || saving || editing) return;
            startX = e.clientX; startY = e.clientY; moved = false;
            startPos = (img.style.objectPosition || '50% 50%').split(' ').map(parseFloat);
            img.setPointerCapture(e.pointerId);
            img.addEventListener('pointermove', move);
            img.addEventListener('pointerup', up);
            img.addEventListener('pointercancel', cancel); /* a phone scroll that took over: the picture stays as it was */
        });
        function move(e) {
            if (!moved && Math.abs(e.clientX - startX) + Math.abs(e.clientY - startY) < 5) return; /* a hand's jitter is a click, not a move */
            moved = true;
            var dx = (e.clientX - startX) / img.clientWidth * 100, dy = (e.clientY - startY) / img.clientHeight * 100;
            img.style.objectPosition = clamp(startPos[0] - dx) + '% ' + clamp(startPos[1] - dy) + '%';
        }
        function stop() { img.removeEventListener('pointermove', move); img.removeEventListener('pointerup', up); img.removeEventListener('pointercancel', cancel); }
        function cancel() { stop(); if (moved) img.style.objectPosition = startPos[0] + '% ' + startPos[1] + '%'; moved = false; }
        function up(e) {
            stop();
            if (moved && img.style.objectPosition !== startPos[0] + '% ' + startPos[1] + '%') {
                var was = startPos[0] + '% ' + startPos[1] + '%', now = img.style.objectPosition;
                var wasOuter = (function () { var keep = img.style.objectPosition; img.style.objectPosition = was; img.setAttribute('data-tf-pos', was); var o = cleanOuter(img); img.style.objectPosition = keep; return o; })();
                img.setAttribute('data-tf-pos', now);
                steps.push(function () { img.style.objectPosition = was; img.setAttribute('data-tf-pos', was); });
                refresh();
                mirror(img, wasOuter);
                img._tfSkipClick = true;
            }
        }
        img.addEventListener('click', function (e) { if (img._tfSkipClick) { img._tfSkipClick = false; e.stopPropagation(); e.preventDefault(); } }, true);
    }
    function clamp(v) { return Math.max(0, Math.min(100, v)); }
    function putAttr(node, name, value) { if (value === null || value === '') node.removeAttribute(name); else node.setAttribute(name, value); }


    /* ---- blocks ---- */
    var tools, toolsFor = null, hideBtn;
    var upBtn = null, downBtn = null; /* the block tools' Move up and Move down; Move left and Move right when the block sits beside its own */
    var moreBtn = null, inMore = []; /* the block tools behind More on a desk */
    var MORE_KEYS = { 'Move up': ['\u2191'], 'Move down': ['\u2193'], 'Move left': ['\u2190'], 'Move right': ['\u2192'], 'Copy': ['\u2318D'], 'Remove': ['\u232B'] };
    function openMore() {
        var items = [];
        inMore.forEach(function (b) {
            if (b.style.display === 'none') return;
            var word = b.getAttribute('aria-label');
            if (b === inMore[inMore.length - 1]) items.push('gap');
            items.push({ icon: b.getAttribute('data-icon'), word: word, keys: MORE_KEYS[word], disabled: b.disabled, danger: b.classList.contains('tf-danger'), fn: function () { b.click(); } });
        });
        openMenu(moreBtn, items, null, { left: false });
    }
    var swapBtn = null; /* Swap sides, on a block of two big parts side by side */
    var lookBtn = null; /* Look: a button takes another button's look, a section another background, both from the site */
    var blockOnly = [], nameTile = null, nameWord = null, replaceBtn = null, altBtn = null; /* the tools a block has and the header or a footer has not: they only take a Look */
    function isRepeated(node) {
        var p = node.parentElement; if (!p) return false;
        var kin = 0;
        for (var c = p.firstElementChild; c; c = c.nextElementSibling) if (sameKind(c, node) && !c.hasAttribute('data-tweakfast')) kin++;
        return kin >= 2;
    }
    /* two of a kind: the same tag and classes; or a kind with a colour or a side of its own (benefit benefit-lime,
       benefit benefit-cream benefit-flip): a class in common and the same parts inside, in the same order */
    function sameKind(a, b) {
        if (signature(a) === signature(b)) return true;
        if (a.tagName !== b.tagName || !Array.prototype.some.call(a.classList, function (c) { return c.indexOf('tf-') !== 0 && b.classList.contains(c); })) return false;
        var inside = function (n) { return Array.prototype.map.call(n.children, function (k) { return k.tagName + '.' + (k.classList[0] || ''); }).join(' '); };
        return a.children.length > 0 && inside(a) === inside(b);
    }
    function signature(n) { return n.tagName + '.' + Array.prototype.slice.call(n.classList).filter(function (c) { return c.indexOf('tf-') !== 0; }).sort().join('.'); }
    /* what the tools are for: a block, else the header or a footer the pointer is in */
    function toolTarget(node) {
        var b = blockTarget(node); if (b) return boxOn(b, node) || b; /* a card laid on the part's picture is a part of its own */
        if (!node || node.nodeType !== 1 || node.closest('[data-tweakfast],[data-tf="fixed"]')) return null;
        return sharedRootOf(node);
    }
    /* a section laid out as a column is outlined edge to edge, the band the eye sees; beside its column the pointer is
       over the page around it (main or what holds it), and the band at that height is the block */
    function bandAt(node, y) {
        if (!node || node.nodeType !== 1 || node.closest('[data-tweakfast]')) return null;
        var main = sectionsIn(document.querySelector('main') || document.body);
        if (!node.contains(main)) return null;
        for (var c = main.firstElementChild; c; c = c.nextElementSibling) {
            if (!c.hasAttribute('data-tf-block') || !columnOf(c)) continue;
            var r = c.getBoundingClientRect(); if (y >= r.top && y < r.bottom) return c;
        }
        return null;
    }
    function toolAt(node, y) { return toolTarget(node) || bandAt(node, y); }
    function blockTarget(node) {
        if (pinned(node)) return null;
        var main = document.querySelector('main') || document.body;
        var n = node, found = null;
        while (n && n !== main && n !== document.body) {
            if (n.hasAttribute('data-tf-block') && !found) found = n;
            n = n.parentElement;
        }
        return found;
    }
    var listening = false;
    function markBlocks() {
        var main = document.querySelector('main') || document.body;
        markBlocksIn(main, true);
        sharedParts(document).forEach(function (part) { if (!main.contains(part) && part.tagName === 'FOOTER') markBlocksIn(part, false); }); /* repeated things in footers too (columns, rows of links); the header is one part with one Look: its logo, menu and buttons are edited by click, never moved one by one */
    }
    /* what holds the page's sections: the main part, or the one plain wrapper a site put inside it (no ground, no
       frame of its own), as deep as such wrappers go */
    function sectionsIn(main) {
        for (var n = main; ;) {
            var kids = Array.prototype.filter.call(n.children, function (c) { return !/^(SCRIPT|STYLE|TEMPLATE)$/.test(c.tagName) && !c.hasAttribute('data-tweakfast'); });
            if (kids.length !== 1 || kids[0].children.length < 2 || !/^(DIV|ARTICLE)$/.test(kids[0].tagName)) return n;
            var cs = getComputedStyle(kids[0]);
            if (cs.backgroundImage !== 'none' || !seeThrough(cs.backgroundColor) || parseFloat(cs.borderTopWidth) > 0 || cs.boxShadow !== 'none') return n;
            n = kids[0];
        }
    }
    function markBlocksIn(main, sections) {
        if (sections) for (var c = sectionsIn(main).firstElementChild; c; c = c.nextElementSibling) {
            if (pinned(c) || c.tagName === 'SCRIPT' || c.tagName === 'STYLE') continue;
            c.setAttribute('data-tf-block', '');
        }
        var menu = menuOf(document);
        var all = main.querySelectorAll('*');
        var parents = [];
        for (var i = 0; i < all.length; i++) {
            var n = all[i];
            if (pinned(n) || n.hasAttribute('data-tf-block') || n.closest('[data-tweakfast]') || (menu && (n === menu || n.contains(menu)))) continue;
            if (n.getAttribute('data-tf') === 'block') { n.setAttribute('data-tf-block', ''); if (isRepeated(n) && parents.indexOf(n.parentElement) < 0) parents.push(n.parentElement); continue; }
            if (isButton(n)) { n.setAttribute('data-tf-block', ''); continue; } /* a button is words and a block: copy, remove, move among its own; no plus, Copy makes the next */
            if (buttonHolder(n)) continue; /* what only holds buttons is not one of a kind */
            if (n.tagName === 'A' && n.hasAttribute('href') && n.textContent.trim() && isRepeated(n) && !ownWords(n.parentElement) && !n.parentElement.closest(TEXT)) { n.setAttribute('data-tf-block', ''); if (parents.indexOf(n.parentElement) < 0) parents.push(n.parentElement); continue; } /* a row of links (a footer's, a list of links): each link a row, copied by the plus; never the menu (pinned) */
            if (/^(LI|DT|DD)$/.test(n.tagName) && isRepeated(n) && !n.closest('nav')) { n.setAttribute('data-tf-block', ''); if (parents.indexOf(n.parentElement) < 0) parents.push(n.parentElement); continue; } /* a list item is text and a block */
            if (isTextLeaf(n) || n.tagName === 'IMG' || n.closest('svg')) continue;
            if (!n.textContent.trim() && !n.querySelector('img')) continue; /* icons and decoration are not blocks */
            if (isRepeated(n) && !n.parentElement.closest(TEXT)) { n.setAttribute('data-tf-block', ''); if (parents.indexOf(n.parentElement) < 0) parents.push(n.parentElement); }
        }
        for (i = 0; i < parents.length; i++) addPlus(parents[i]);
        if (!tools) buildTools();
        if (listening) return; /* the page's listeners are bound once, however often the page is marked again */
        listening = true;
        /* the tools sit above their block; on the way up to them the mouse may cross another block, so while it
           heads toward the tools a new block takes over only after a short rest. Heading anywhere else, at once. */
        /* hover draws the line and the name; the tools come with a click (a tap on a phone), and stay until Esc or a click elsewhere */
        function offer(b) {
            if (coarse()) return;
            if (b === blockHoverEl) { syncBlockHover(); return; }
            hoverBlock(b || null);
        }
        document.addEventListener('mouseover', function (e) {
            if (previewing) return;
            if (tools.contains(e.target) || e.target.closest('[data-tweakfast]')) { hoverBlock(null); return; }
            offer(toolAt(e.target, e.clientY));
        });
        /* beside a column the pointer stays over the page around it, which sends no new mouseover going up or down:
           the band under it is read as it moves, once a frame */
        var sideMove = null;
        document.addEventListener('mousemove', function (e) {
            var first = !sideMove; sideMove = e; if (!first) return;
            requestAnimationFrame(function () {
                var m = sideMove; sideMove = null;
                if (previewing || dragging || toolTarget(m.target)) return;
                offer(bandAt(m.target, m.clientY));
            });
        }, true);
        document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !editing && !held && !picked && !menu && !dragging) hideTools(); });
        /* the lines and tools follow the page once a frame, however many scroll events the frame brings */
        var placeTick = false, placeAll = function () { if (placeTick) return; placeTick = true; requestAnimationFrame(function () { placeTick = false; if (toolsFor) placeTools(); placeTag(); syncBlockHover(); placeEdit(); }); };
        window.addEventListener('scroll', placeAll, { passive: true });
        window.addEventListener('resize', placeAll);
        /* the page's own motion (a card lifting on hover, a fade, a slide) carries the words away from our lines:
           while a transition or animation runs on what we frame, or on anything holding it, the lines follow it each frame */
        var moving = [], following = false;
        var framed = function (t) { return [editing, picked, held, hoverEl, toolsFor].some(function (x) { return x && x.isConnected && (t === x || t.contains(x)); }); };
        var follow = function (e) {
            var t = e.target; if (!t || !t.contains || !framed(t)) return;
            moving.push(t);
            if (following) return; following = true;
            requestAnimationFrame(function tick() {
                moving = moving.filter(function (n) { return n.isConnected && framed(n); });
                if (toolsFor) placeTools(); placeTag(); syncBlockHover(); placeEdit();
                if (moving.length) requestAnimationFrame(tick); else following = false;
            });
        };
        var still = function (e) { var i = moving.indexOf(e.target); if (i >= 0) moving.splice(i, 1); placeAll(); };
        ['transitionrun', 'animationstart'].forEach(function (k) { document.addEventListener(k, follow, true); });
        ['transitionend', 'transitioncancel', 'animationend', 'animationcancel'].forEach(function (k) { document.addEventListener(k, still, true); });
        document.addEventListener('input', function (e) { if (editing && editing.contains(e.target)) { keepFields(); sizeFit(editing); placeEdit(); if (toolsFor) placeTools(); } }, true);
        window.addEventListener('resize', function () { if (toolsFor) placeTools(); placePanel(); });
    }
    function addPlus(parent) {
        var had = parent.querySelector(':scope > .tf-plus');
        if (had) { if (had !== parent.lastElementChild) parent.appendChild(had); return; } /* items moved by a restore: the plus goes back to the end */
        var last = parent.lastElementChild;
        var plus = el(last && /^(LI|TR|OPTION|DT|DD)$/.test(last.tagName) ? last.tagName.toLowerCase() : 'div', 'tf-plus');
        plus.setAttribute('data-tweakfast', '');
        plus.setAttribute('role', 'button');
        tip(plus, 'Add one more');
        var cross = '<span><svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M7 1.5v11M1.5 7h11"/></svg></span>';
        if (plus.tagName === 'TR') { var cells = last.querySelectorAll('td,th').length || 1; plus.innerHTML = '<td colspan="' + cells + '">' + cross + '</td>'; }
        else plus.innerHTML = cross;
        parent.appendChild(plus);
    }
    /* the page a row leads to, when every row of its list leads to a page of its own (a list of projects, of posts):
       else null (a list of links to one page, to parts of a page, to other sites) */
    function rowPage(row) {
        var lead = function (r) { var a = r.matches('a[href]') ? r : r.querySelector('a[href]'); return a && isPageLink(a) ? pathOf(a) : null; };
        var mine = lead(row); if (!mine || sharedParts(row.ownerDocument).some(function (p) { return p.contains(row); })) return null; /* the header's and footers' links are copied as links */
        var seen = [], sig = signature(row);
        for (var c = row.parentElement.firstElementChild; c; c = c.nextElementSibling) if (signature(c) === sig && !c.hasAttribute('data-tweakfast')) { var p = lead(c); if (!p || seen.indexOf(p) >= 0) return null; seen.push(p); }
        return seen.length >= 2 ? mine : null;
    }
    function addItem(plus) {
        var parent = plus.parentElement, last = null;
        for (var c = plus.previousElementSibling; c; c = c.previousElementSibling) if (c.hasAttribute('data-tf-block') && !c.hasAttribute('data-tf-hidden')) { last = c; break; }
        if (!last) for (c = plus.previousElementSibling; c; c = c.previousElementSibling) if (c.hasAttribute('data-tf-block')) { last = c; break; }
        if (!last) return;
        var leads = rowPage(last); if (leads) { if (!panel) togglePages(); if (panel) openView({ kind: 'add', like: leads }); return; } /* each row leads to its own page: a new row is a new page */
        var twin = makeTwin(last), parentWas = cleanOuter(parent);
        parent.insertBefore(twin, plus); frameTwin(last, twin);
        var back = rowRoom(parent);
        steps.push(function () { unTwin(twin); if (back) back(); });
        mirror(parent, parentWas);
        refresh();
        showTools(twin);
        twin.scrollIntoView({ block: 'nearest', behavior: motion() });
        /* the new one is ready to type: its first words open at once */
        var first = firstText(twin);
        if (first) begin(first);
        once('add', 'A new one, with placeholders. Click each to fill it in.');
    }
    function firstText(block) {
        var all = block.querySelectorAll('*');
        for (var i = 0; i < all.length; i++) if (textTarget(all[i]) === all[i] && all[i].getClientRects().length) return all[i];
        return block.matches(TEXT) && textTarget(block) === block ? block : null;
    }
    function makeTwin(block) {
        var twin = block.cloneNode(true), own = twin.querySelectorAll('[data-tweakfast]'), holders = [];
        /* a decoration keeps its words: what screen readers skip (below), and what can be neither clicked nor selected */
        var from = block.querySelectorAll('*'), to = twin.querySelectorAll('*');
        for (var d = 0; d < from.length; d++) { var fs = getComputedStyle(from[d]); if (fs.pointerEvents === 'none' && (fs.userSelect || fs.webkitUserSelect) === 'none' && from[d].textContent.trim() && !from[d].closest('[data-tweakfast]')) to[d].setAttribute('data-tf-deco', ''); }
        for (var j = 0; j < own.length; j++) { /* the editor's own parts are not the page's: a plus inside a copied section is drawn fresh below */
            if (own[j].classList.contains('tf-plus')) holders.push(own[j].parentElement);
            own[j].remove();
        }
        twin.removeAttribute('data-tf-hidden'); twin.removeAttribute('data-tf-frame'); Array.prototype.forEach.call(twin.querySelectorAll('style[data-tf-frame]'), function (n) { n.remove(); }); /* a frame is measured anew for each copy */
        freshIds(twin);
        /* a moving strip keeps its words: its loop needs the sentence repeated, a placeholder would break it */
        var m = keepsWords(block), keep = null;
        if (m) { var all = block.querySelectorAll('*'), at = Array.prototype.indexOf.call(all, m); keep = at < 0 ? twin : twin.querySelectorAll('*')[at]; if (keep) keep.setAttribute('data-tf-keep', ''); }
        var nums = numbersIn(twin);
        fillPlaceholders(twin);
        nextNumbers(twin, nums, block);
        if (keep) keep.removeAttribute('data-tf-keep');
        Array.prototype.forEach.call(twin.querySelectorAll('[data-tf-deco]'), function (n) { n.removeAttribute('data-tf-deco'); });
        holders.forEach(addPlus);
        return twin;
    }
    /* a row's number (01, 2., 3)) is no words to fill in: a copy takes the next one in its list, written the same way */
    function numbersIn(root) {
        var out = [];
        [root].concat(Array.prototype.slice.call(root.querySelectorAll('*'))).forEach(function (n) { if (!n.children.length && /^\d{1,3}[.)]?$/.test(n.textContent.trim())) out.push({ path: pathFrom(root, n), text: n.textContent.trim() }); });
        return out;
    }
    function nextNumbers(twin, nums, model) {
        if (!nums.length || !model.parentElement) return;
        var sig = signature(model);
        nums.forEach(function (x) {
            var top = 0, n = walkPath(twin, x.path); if (!n) return;
            for (var c = model.parentElement.firstElementChild; c; c = c.nextElementSibling) if (signature(c) === sig) { var m = walkPath(c, x.path), v = m && /^(\d{1,3})[.)]?$/.exec(m.textContent.trim()); if (v) top = Math.max(top, +v[1]); }
            var digits = /^\d+/.exec(x.text)[0], next = String(top + 1); while (next.length < digits.length) next = '0' + next;
            n.textContent = next + x.text.slice(digits.length);
        });
    }
    function fillPlaceholders(root) {
        if (root.hasAttribute('data-tf-keep')) return;
        /* a title drawn one box per letter, with its words said by a label: one placeholder, shown and said */
        Array.prototype.forEach.call(root.querySelectorAll('[aria-label]'), function (t) {
            if (!t.matches(TEXT) || t.closest('[data-tf-keep]') || t.querySelector('img,svg') || !t.querySelector('[aria-hidden="true"]')) return;
            var w = document.createTreeWalker(t, NodeFilter.SHOW_TEXT), x; while ((x = w.nextNode())) if (x.data.trim() && !x.parentElement.closest('[aria-hidden="true"]')) return;
            t.textContent = placeholder(t); t.removeAttribute('aria-label');
        });
        var texts = Array.prototype.slice.call(root.querySelectorAll(TEXT)).filter(function (t) { return !t.closest('[data-tf-keep]'); });
        if (root.matches(TEXT)) { /* a list item: its inner parts get placeholders, its own words one too; icons, pictures and wrappers stay */
            Array.prototype.forEach.call(root.children, function (c) { if (c.matches(TEXT) && !c.querySelector('img,svg')) c.textContent = placeholder(c); });
            var own = Array.prototype.filter.call(root.childNodes, function (n) { return n.nodeType === 3 && n.data.trim(); });
            own.forEach(function (n, i) { n.data = i ? '' : placeholder(root); });
            texts = Array.prototype.slice.call(root.querySelectorAll(TEXT)).filter(function (t) { return t.parentElement !== root && !t.closest('[data-tf-keep]'); });
        }
        for (var i = 0; i < texts.length; i++) {
            var t = texts[i];
            var up = t.parentElement && t.parentElement.closest(TEXT);
            if (t !== root && up && up !== root && root.contains(up)) continue; /* inner spans follow their block */
            var hid = t.closest('[aria-hidden="true"],[data-tf-deco]'); if (hid && hid !== root && root.contains(hid)) continue; /* a decoration (a big letter behind, a badge's mark) keeps its look */
            var inner = t.querySelector('a');
            if (inner) { /* keep a link inside, blank the rest */
                var words = false;
                for (var k = t.childNodes.length - 1; k >= 0; k--) {
                    var ch = t.childNodes[k];
                    if (ch.nodeType === 3) { words = words || !!ch.data.trim(); t.removeChild(ch); }
                    else if (ch.nodeType === 1 && ch.matches(TEXT) && !ch.matches('a') && !ch.querySelector('a,img,svg')) { words = true; t.removeChild(ch); } /* words of their own beside the link go with the rest */
                }
                if (words) t.insertBefore(document.createTextNode(placeholder(t) + ' '), t.firstChild);
                continue;
            }
            t.textContent = placeholder(t);
        }
        /* the pictures: a neutral placeholder in the old one's frame, so the owner sees what to replace */
        var imgs = root.querySelectorAll('img');
        for (i = 0; i < imgs.length; i++) {
            var im = imgs[i], w = im.clientWidth || im.width || 400, h = im.clientHeight || im.height || 300;
            im.setAttribute('src', PLACEHOLDER); im.removeAttribute('srcset'); im.removeAttribute('sizes'); if (im.parentElement && im.parentElement.tagName === 'PICTURE') Array.prototype.forEach.call(im.parentElement.querySelectorAll(':scope > source'), function (n) { n.remove(); }); im.setAttribute('alt', '');
            im.removeAttribute('data-tf-pos'); im.style.objectPosition = '';
            if (!im.style.aspectRatio) im.style.aspectRatio = w + ' / ' + h;
            im.style.objectFit = 'cover';
        }
    }
    var PLACEHOLDER = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300"><rect width="400" height="300" fill="#e9e9eb"/><g fill="none" stroke="#a1a1a6" stroke-width="6" stroke-linejoin="round"><rect x="150" y="112" width="100" height="76" rx="8"/><path d="M150 176l28-30 24 22 18-16 30 24"/><circle cx="228" cy="132" r="8" fill="#a1a1a6" stroke="none"/></g></svg>');
    function placeholder(t) {
        var tag = t.tagName;
        if (/^H[1-6]$/.test(tag)) return 'New heading';
        if (tag === 'TIME') return 'Date and time';
        if (tag === 'A') return 'Link';
        if (tag === 'FIGCAPTION') return 'Caption';
        if (tag === 'STRONG' || tag === 'B') return 'New item';
        return 'Your text here.';
    }
    function buildTools() {
        tools = el('div', 'tf-tools');
        tools.setAttribute('data-tweakfast', '');
        /* the name of the thing leads the toolbar; for a block the tile is also the handle: grip dots before the name, drag it to move */
        nameTile = el('span', 'tf-name'); var grip = el('span', 'tf-grip'); grip.innerHTML = ICON.grip; nameTile.appendChild(grip); nameWord = el('span', 'tf-name-word', ''); nameTile.appendChild(nameWord);
        nameTile.addEventListener('pointerdown', function (e) { if (nameTile.classList.contains('tf-handle')) startDrag(e); });
        tools.appendChild(nameTile); tools.appendChild(el('span', 'tf-sep'));
        blockOnly = [];
        replaceBtn = button('Replace', function () { if (picked) swapPicture(picked); }); tools.appendChild(replaceBtn);
        altBtn = button('Describes', function () { var i = altBox && altBox.querySelector('input'); if (i) { i.focus(); i.select(); } }); tools.appendChild(altBtn);
        lookBtn = button('Colour', openLooks); /* the word on the button: what the owner changes, a section's background or a button's colours */ lookBtn.className += ' tf-look-open'; tools.appendChild(lookBtn);
        upBtn = iconButton('up', 'Move up', function () { move(-1); }); tools.appendChild(upBtn);
        downBtn = iconButton('down', 'Move down', function () { move(1); }); tools.appendChild(downBtn);
        swapBtn = iconButton('swap', 'Swap sides', swapSides); tools.appendChild(swapBtn);
        hideBtn = iconButton('eyeOff', 'Hide', toggleHidden); hideBtn.className += ' tf-hide';
        tools.appendChild(hideBtn);
        var cp = iconButton('copy', 'Copy', copyBlock); tools.appendChild(cp);
        var rm = iconButton('trash', 'Remove', removeBlock); rm.className += ' tf-danger'; tools.appendChild(rm);
        /* on a desk the block tools wait behind More, so the toolbar reads name · Colour · More (three things, not seven);
           on a phone the strip has the width for them all and a menu would be one more tap */
        inMore = [upBtn, downBtn, swapBtn, hideBtn, cp, rm]; inMore.forEach(function (b) { b.className += ' tf-in-more'; });
        moreBtn = iconButton('more', 'More', openMore); moreBtn.className += ' tf-more'; tools.appendChild(moreBtn);
        blockOnly = blockOnly.concat([upBtn, downBtn, hideBtn, cp, rm, moreBtn]);
        document.body.appendChild(tools);
        tools.addEventListener('mouseenter', function () { toolsHover = true; placeTools(); });
        tools.addEventListener('mouseleave', function () { toolsHover = false; placeTools(); }); /* the tools stay until another block is hovered */
    }
    /* the hairline only parts the name from something: a button that shows, or the link field */
    function sepSync() {
        if (!tools) return;
        var any = Array.prototype.some.call(tools.querySelectorAll(':scope > .tf-button'), function (b) { return b.style.display !== 'none'; });
        nameTile.nextElementSibling.style.display = any ? '' : 'none';
    }
    function showTools(block) {
        if (!block || !block.isConnected) { hideTools(); return; }
        /* the header or a footer itself: it stays where it is, on every page; only its Look */
        var part = !block.hasAttribute('data-tf-block'), ch = part ? choicesFor(block) : lookKnown(block);
        if (part && !ch) { hideTools(); return; }
        toolsFor = block;
        /* words or a picture inside the block are the thing: the toolbar names them and carries only what is theirs */
        var on = editing || picked, inner = on && on !== block && block.contains(on), ground = inner && on === picked && groundPicture(block, on);
        if (ground) inner = false; /* a photo that is the section's whole ground: picking it is picking the section, Replace beside its own tools */
        nameWord.textContent = nameOf(inner ? on : block);
        nameTile.classList.toggle('tf-handle', !part && !inner); tip(nameTile, !part && !inner ? 'Drag to move' : '');
        blockOnly.forEach(function (n) { n.style.display = part || inner ? 'none' : ''; });
        tools.classList.toggle('tf-less', !coarse());
        replaceBtn.style.display = (inner || ground) && on === picked ? '' : 'none'; altBtn.style.display = ALT_ON && (inner || ground) && on === picked && !isArt(on) ? '' : 'none'; /* a drawn box has no words to describe */
        if (inner) { lookBtn.style.display = on === editing && isButton(on) && choicesFor(on) ? '' : 'none'; swapBtn.style.display = 'none'; }
        sepSync();
        if (inner) { clearTimeout(lookTimer); tools.style.display = 'flex'; placeTools(); return; }
        var hidden = block.hasAttribute('data-tf-hidden'); relabel(hideBtn, hidden ? 'eye' : 'eyeOff', hidden ? 'Show' : 'Hide');
        var kin = kinOf(block), at = kin.indexOf(block); upBtn.disabled = at <= 0; downBtn.disabled = at >= kin.length - 1; /* at an end, that way is off */
        /* the arrows point the way the block's own sit: beside each other, left and right */
        var prev = kin[at - 1], next = kin[at + 1], beside = prev && sameRow(prev, block) ? prev : next && sameRow(next, block) ? next : null;
        if (!beside) { relabel(upBtn, 'up', 'Move up'); relabel(downBtn, 'down', 'Move down'); }
        else {
            var backLeft = (beside === prev) === (beside.getBoundingClientRect().left < block.getBoundingClientRect().left);
            relabel(upBtn, backLeft ? 'left' : 'right', backLeft ? 'Move left' : 'Move right'); relabel(downBtn, backLeft ? 'right' : 'left', backLeft ? 'Move right' : 'Move left');
        }
        swapBtn.style.display = !part && twoSides(block) ? '' : 'none';
        lookBtn.style.display = ch ? '' : 'none';
        tools.style.display = 'flex';
        placeTools();
        clearTimeout(lookTimer);
        if (ch === undefined) lookTimer = setTimeout(function () { /* not yet known: worked out once the pointer rests, so a pass over many cards stays smooth */
            if (toolsFor !== block || !block.isConnected) return;
            lookBtn.style.display = lookKnown(block, true) ? '' : 'none'; placeTools();
        }, coarse() ? 0 : 120);
    }
    /* whether a block has a Look, remembered until the next change; undefined when not yet worked out and not asked to */
    var lookTimer = 0;
    function lookKnown(block, work) {
        if (block._tfLook && block._tfLook.at === era) return block._tfLook.has;
        if (!work) return undefined;
        var has = !!choicesFor(block); block._tfLook = { at: era, has: has }; return has;
    }
    var blockBox = null, toolsHover = false;
    function hideTools() { toolsFor = null; tools.style.display = 'none'; if (blockBox) blockBox.style.display = 'none'; hidePlusUnder(null); }
    function placeTools() {
        if (!toolsFor || !toolsFor.isConnected) { hideTools(); return; }
        if (linkBox && linkBox.parentNode === tools) fitRows(); /* once the buttons for this block are set, before the width is read */
        var r = toolsFor.getBoundingClientRect();
        if (columnOf(toolsFor) && !onPicture(toolsFor)) { var pw = document.documentElement.clientWidth; r = { left: 0, right: pw, width: pw, top: r.top, bottom: r.bottom, height: r.height }; } /* a section is the band the eye sees, edge to edge */
        if (!blockBox) { blockBox = el('span', 'tf-block-box'); blockBox.setAttribute('data-tweakfast', ''); document.body.appendChild(blockBox); }
        /* the words or picture being worked on inside the block: the tools sit just by it, and its line is the only one
           drawn; the block's own outline shows while the pointer is on the tools, to say what they act on */
        var on = editing || held || picked, at = on && on !== toolsFor && toolsFor.contains(on) && !groundPicture(toolsFor, on) ? on.getBoundingClientRect() : null;
        frame(blockBox, r, columnOf(toolsFor) && !onPicture(toolsFor) ? null : toolsFor, toolsFor);
        var inner = (editing || picked) && toolsFor !== (editing || picked) && toolsFor.contains(editing || picked) && !groundPicture(toolsFor, picked);
        blockBox.style.display = toolsFor.hasAttribute('data-tf-block') || sharedParts(document).indexOf(toolsFor) >= 0 || onPicture(toolsFor) ? 'block' : 'none'; /* the selected thing keeps its line */
        blockBox.classList.toggle('tf-block-inner', !!inner); blockBox.classList.toggle('tf-block-selected', !inner);
        if (hoverBox) hoverBox.style.display = toolsHover || !hoverEl ? 'none' : 'block'; /* one line at a time */ blockBox.classList.toggle('tf-block-moving', dragging); syncBlockHover();
        if (coarse()) { /* a finger: the tools wait in a strip just above the bar, where the thumb is, never over the words a tap is meant for */
            tools.classList.add('tf-tools-dock'); tools.style.left = tools.style.top = tools.style.position = tools.style.width = '';
            blockBox.style.visibility = ''; placeNote(); return;
        }
        tools.classList.remove('tf-tools-dock'); tools.style.bottom = '';
        var w = tools.offsetWidth, h = tools.offsetHeight, floor = 8, cover = topCover(), under = null;
        if (cover && !cover.contains(toolsFor)) { /* a menu fixed at the top: the tools and the outline stay below it, never on it */
            floor = cover.getBoundingClientRect().bottom + 8; under = zUnder(cover);
            /* the outline slides under the menu as the page scrolls, drawn just beneath it: moved by the page itself, it
               cannot lag. Cut short by us each frame it ran a frame behind the scroll; only when the menu has no layer of its own */
            if (r.top < floor - 8) { var cut = floor - 8 - r.top; r = { left: r.left, right: r.right, width: r.width, top: floor - 8, bottom: r.bottom, height: Math.max(0, r.height - cut) }; if (under === null) frame(blockBox, r, columnOf(toolsFor) && !onPicture(toolsFor) ? null : toolsFor, toolsFor); }
        }
        blockBox.style.zIndex = under === null ? '' : String(under);
        /* the toolbar is the block's: centred above its line, 8 off it, and it stays there while the owner clicks around
           inside; no room above (the header, the top of the window): below the line instead */
        var left = Math.max(8, Math.min(r.left + (r.width - w) / 2, window.innerWidth - w - 8));
        if (at && inner) left = Math.max(8, Math.min(Math.max(r.left, Math.min(at.left + (at.width - w) / 2, r.right - w)), window.innerWidth - w - 8)); /* words or a picture inside the block: centred on them, kept within the block's width */
        var vb = at && inner ? at : r; /* words or a picture inside the block: above them, not above the whole block */
        var top = vb.top - h - 8;
        if (top < floor) top = vb.bottom + 8 <= window.innerHeight - h - 8 ? vb.bottom + 8 : floor;
        var barTop = bar.getBoundingClientRect().top; if (card) barTop = Math.min(barTop, card.getBoundingClientRect().top); barTop -= 8; /* the bar and the welcome card: never under them, the band just above instead */
        if (top + h > barTop && top < window.innerHeight) top = Math.max(floor, barTop - h);
        var held_ = top < floor; top = Math.max(floor, top);
        var gone = r.bottom < floor || r.top > window.innerHeight; /* scrolled away, or up under the menu: nothing left of it to work on */
        tools.style.visibility = blockBox.style.visibility = gone ? 'hidden' : '';
        /* held below the menu, the tools stay put in the window while the page scrolls: fixed there, they need no moving */
        if (held_ && cover) { tools.style.position = 'fixed'; tools.style.left = Math.max(8, left) + 'px'; tools.style.top = top + 'px'; }
        else { tools.style.position = ''; put(tools, Math.max(8, left), top, toolsFor); }
        placeLink(); placeAlt(); /* the fields hang from the toolbar, so they go where it goes */
        hidePlusUnder(gone ? null : { left: left, top: top, right: left + w, bottom: top + h });
    }
    /* an "add one more" mark the toolbar would cover is out of the way while the toolbar is there */
    function hidePlusUnder(box) {
        Array.prototype.forEach.call(document.querySelectorAll('.tf-plus'), function (pl) {
            var q = pl.getBoundingClientRect(), under = !!box && q.left < box.right && q.right > box.left && q.top < box.bottom && q.bottom > box.top;
            pl.classList.toggle('tf-plus-under', under);
        });
    }
    /* the layer just beneath a fixed menu, for our outline to pass under it; null when the menu has no layer of its own */
    function zUnder(cover) {
        var z = null;
        for (var n = cover; n && n !== document.body; n = n.parentElement) { var cs = getComputedStyle(n); if (cs.position !== 'static' && /^\d+$/.test(cs.zIndex)) z = +cs.zIndex; }
        return z !== null && z > 1 ? z - 1 : null;
    }
    /* the part fixed to the top of the window that the page scrolls under (a fixed or sticky header), else null */
    function topCover() {
        var w = document.documentElement.clientWidth, hits = [document.elementFromPoint(w / 2, 2), document.elementFromPoint(12, 2), document.elementFromPoint(w - 12, 2)];
        for (var i = 0; i < hits.length; i++) {
            for (var n = hits[i]; n && n !== document.body && n !== document.documentElement; n = n.parentElement) {
                if (n.closest('[data-tweakfast]')) break;
                var pos = getComputedStyle(n).position;
                if (pos === 'fixed' || pos === 'sticky') { var b = n.getBoundingClientRect(); if (b.top <= 2 && b.height < window.innerHeight / 2) return n; break; }
            }
        }
        return null;
    }
    function sameRow(a, b) { var r = a.getBoundingClientRect(), q = b.getBoundingClientRect(); return Math.min(r.bottom, q.bottom) - Math.max(r.top, q.top) > Math.min(r.height, q.height) / 2; }
    /* two big parts side by side, the block itself or inside its only child: a picture and words, a box and a map */
    function twoSides(block) {
        if (isButton(block)) return null;
        var row = block;
        for (var depth = 0; depth < 4; depth++) {
            var kids = Array.prototype.filter.call(row.children, function (c) { return !c.hasAttribute('data-tweakfast') && !/^(SCRIPT|STYLE|TEMPLATE)$/.test(c.tagName) && c.getClientRects().length; });
            if (kids.length === 1) { row = kids[0]; continue; }
            if (kids.length !== 2 || !/flex|grid/.test(getComputedStyle(row).display)) return null;
            var a = kids[0].getBoundingClientRect(), b = kids[1].getBoundingClientRect(), w = row.getBoundingClientRect().width;
            var apart = a.right <= b.left + 2 || b.right <= a.left + 2;
            return sameRow(kids[0], kids[1]) && apart && a.width > w / 4 && b.width > w / 4 ? { row: row, parts: kids } : null;
        }
        return null;
    }
    /* the row is mirrored, not reordered: the page keeps its order, so on a phone, where the two stack, the first stays
       on top; each side keeps the widths it had and reads as before */
    function swapSides() {
        if (editing && toolsFor && toolsFor.contains(editing)) commit(); /* typed words are kept before the block acts */
        var b = toolsFor, two = b && twoSides(b); if (!two) return;
        var all = [two.row].concat(two.parts), was = all.map(function (n) { return n.getAttribute('style'); }), from = all.map(function (n) { return n.getBoundingClientRect(); }), outerWas = cleanOuter(b);
        var mirrored = two.row.style.direction && two.parts[0].style.direction && two.row.style.direction !== two.parts[0].style.direction;
        if (mirrored) all.forEach(function (n) { n.style.direction = ''; });
        else { var dir = getComputedStyle(two.row).direction; two.row.style.direction = dir === 'rtl' ? 'ltr' : 'rtl'; two.parts.forEach(function (n) { n.style.direction = dir; }); }
        all.forEach(function (n) { if (n.getAttribute('style') === '') n.removeAttribute('style'); });
        steps.push(function () { all.forEach(function (n, i) { putAttr(n, 'style', was[i]); }); });
        two.parts.forEach(function (n, i) { slide(n, from[i + 1], ''); });
        refresh();
        mirror(b, outerWas);
        showTools(b);
        once('swap', 'Swapped. On a phone the two still stack as before, the first one on top.');
    }
    /* ---- looks ---- */
    /* the owner never makes a look: a button takes the look of another button on this page (the quieter one, the
       outlined one). Each choice is measured in place, so what the menu draws is what the page will show, and two
       that would look the same here are one choice. */
    var LOOK = ['fontFamily', 'fontSize', 'fontWeight', 'fontStyle', 'textTransform', 'letterSpacing', 'color', 'textDecorationLine', 'backgroundColor', 'backgroundImage', 'borderTopWidth', 'borderTopColor', 'borderBottomWidth', 'borderBottomColor', 'borderLeftWidth', 'borderRadius', 'paddingTop', 'paddingLeft'];
    function lookOf(n) { var cs = getComputedStyle(n), o = {}; LOOK.forEach(function (k) { o[k] = cs[k]; }); return o; }
    /* the choices for one button, the current one first: [{ cls, look, word, now }]. Only its classes change: it stays
       the link or button it is. The look it had when the page was opened is always offered, so the way back is there
       when it was the only one of its kind. */
    function looks(t) {
        var was = t.getAttribute('class'), out = [{ cls: was, look: lookOf(t), now: true }], keys = [JSON.stringify(out[0].look)], kinds = [];
        if (t._tfLookFrom === undefined) t._tfLookFrom = was;
        var seen = {}; seen[was || ''] = true;
        if (!seen[t._tfLookFrom || '']) { seen[t._tfLookFrom || ''] = true; kinds.push(t._tfLookFrom); }
        var main = document.querySelector('main') || document.body, roots = [main], part = sharedRootOf(t);
        if (part && !main.contains(part)) roots.push(part);
        roots.forEach(function (root) {
            Array.prototype.forEach.call(root.querySelectorAll(t.tagName), function (n) {
                var c = Array.prototype.filter.call(n.classList, function (x) { return x.indexOf('tf-') !== 0; }).join(' ');
                if (seen[c] || !isButton(n) || !n.getClientRects().length) return;
                seen[c] = true; kinds.push(c);
            });
        });
        kinds.forEach(function (c) {
            if (out.length >= 8) return;
            putAttr(t, 'class', c); var look = lookOf(t); putAttr(t, 'class', was);
            var key = JSON.stringify(look); if (keys.indexOf(key) >= 0) return;
            keys.push(key); out.push({ cls: c, look: look });
        });
        out.forEach(function (o) { o.word = buttonWord(o.look); });
        out.forEach(function (o, i) { /* one name, one look */
            for (var j = 0; j < i; j++) if (out[j].word === o.word) { o.word += parseFloat(o.look.fontSize) !== parseFloat(out[j].look.fontSize) ? (parseFloat(o.look.fontSize) < parseFloat(out[j].look.fontSize) ? ', smaller' : ', larger') : ', other colour'; j = -1; }
        });
        return out;
    }
    function buttonWord(look) {
        var seen = function (c) { return !seeThrough(c); };
        if (seen(look.backgroundColor) || look.backgroundImage !== 'none') return 'filled';
        if (parseFloat(look.borderTopWidth) > 0 && parseFloat(look.borderLeftWidth) > 0) return 'outlined';
        return parseFloat(look.borderBottomWidth) > 0 ? 'underlined' : 'link';
    }
    /* the ground a text or button sits on, so a light look on a dark section is drawn on that dark */
    function groundOf(n) {
        for (; n && n.nodeType === 1; n = n.parentElement) { var bg = getComputedStyle(n).backgroundColor; if (!seeThrough(bg)) return bg; }
        return '#fff';
    }
    function lookSample(look, words, ground) {
        var g = el('span', 'tf-look-ground'), s = el('span', 'tf-look-sample', words), size = parseFloat(look.fontSize), fit = Math.min(size, 18); /* large words drawn at 18 px */
        g.style.background = ground;
        ['fontFamily', 'fontWeight', 'fontStyle', 'textTransform', 'color', 'textDecorationLine', 'backgroundColor', 'backgroundImage', 'borderRadius'].forEach(function (k) { s.style[k] = look[k]; });
        s.style.fontSize = fit + 'px';
        if (/px$/.test(look.letterSpacing)) s.style.letterSpacing = parseFloat(look.letterSpacing) * fit / size + 'px';
        s.style.borderTop = look.borderTopWidth + ' solid ' + look.borderTopColor; s.style.borderBottom = look.borderBottomWidth + ' solid ' + look.borderBottomColor;
        s.style.borderLeft = s.style.borderRight = look.borderLeftWidth + ' solid ' + look.borderTopColor;
        s.style.padding = Math.min(parseFloat(look.paddingTop) || 0, 8) + 'px ' + Math.min(parseFloat(look.paddingLeft) || 0, 14) + 'px';
        g.appendChild(s);
        return g;
    }
    /* what Look offers for the block under the tools: a button's looks, or the block's grounds */
    function choicesFor(block) {
        if (!block) return null;
        var list;
        if (isButton(block)) { list = still(function () { return looks(block); }); return list.length > 1 ? { t: block, list: list } : null; }
        if (!block.getClientRects().length || block.matches('li,tr,td,th,dt,dd')) return null;
        var big = isBig(block);
        /* a small part with no ground of its own (a picture with words under it, on the section's ground) is not a card:
           it has no Look, so a colour never lands as a box behind it */
        var sides;
        if (!big && openToPage(block)) {
            /* unless its ground is drawn by what it holds, all in one colour (a card and the round badge beside it):
               then that is the card, and its parts take a new ground together */
            var inner = groundedKids(block); if (!inner) return null;
            sides = [{ part: inner[0], also: inner.slice(1) }];
        }
        /* parts that cover the block's ground (two halves) are chosen for one by one */
        else sides = covered(block) ? coverParts(block) : [{ part: block }];
        /* a Look with nothing to offer is not there at all (a section whose ground is its picture, or one ground only):
           a button that only says no is noise */
        sides = sides.filter(function (s) { return groundRows(s.part).some(function (r) { return !r.off && !r.o.now; }); }); /* only the one it has: nothing to choose either */
        return sides.length ? { t: block, sides: sides } : null;
    }
    /* the parts straight inside a block that draw a ground of their own, all one colour, the biggest first; else null */
    function groundedKids(b) {
        var kids = Array.prototype.filter.call(b.children, function (c) { if (c.hasAttribute('data-tweakfast') || !c.getClientRects().length) return false; var cs = getComputedStyle(c); return cs.backgroundImage === 'none' && opaque(cs.backgroundColor); });
        if (!kids.length || kids.some(function (c) { return same(getComputedStyle(c).backgroundColor) !== same(getComputedStyle(kids[0]).backgroundColor); })) return null;
        var area = function (c) { var r = c.getBoundingClientRect(); return r.width * r.height; };
        return kids.sort(function (x, y) { return area(y) - area(x); });
    }
    /* a big part: a section, the header, a footer, a block straight in main */
    function isBig(b) { var d = b.ownerDocument, m = d.querySelector('main'); return !!(b.parentElement && (b.parentElement.matches('main') || m && b.parentElement === sectionsIn(m)) || b.matches('section,header,footer') || sharedParts(d).indexOf(b) >= 0 || onPicture(b)); }
    function openLooks() {
        hideLink();
        var b = editing && isButton(editing) && toolsFor !== editing ? editing : toolsFor, ch = choicesFor(b); if (!ch) { lookBtn.style.display = 'none'; return; }
        var t = ch.t;
        var wordsOf = function (n) { var w = (n || t).textContent.replace(/\s+/g, ' ').trim(); return !w ? 'Aa' : w.length > 26 ? w.slice(0, 24).trim() + '\u2026' : w; };
        if (!ch.sides) {
            var words = wordsOf(t), ground = groundOf(t.parentElement || t);
            openMenu(lookBtn, ch.list.map(function (o) { return { sample: lookSample(o.look, words, ground), word: o.word, now: o.now, fn: o.now ? function () {} : function () { takeLook(t, o.cls); } }; }));
            return;
        }
        var items = [];
        ch.sides.forEach(function (s, n) {
            if (s.label) { if (n) items.push('gap'); items.push({ label: s.label }); }
            var rows = groundRows(s.part).filter(function (r) { return !r.off; });
            if (!rows.length) items.push({ note: grounds(s.part).picture ? PICTURE_GROUND : 'This part cannot take another background.' });
            rows.forEach(function (r) { items.push(swatchItem(r, function (o) { takeGround(s.part, o, t, s.also); })); });
        });
        openMenu(lookBtn, items);
    }
    /* only what can be had and looks different is offered: a row that cannot be had here is left out */
    function swatchItem(r, take) {
        var sw = r.word === 'clear' ? { clear: true } : { ground: r.o.ground, ink: nameInk(r.o.ground, r.o.look.color) }; /* clear: the see-through grid of a colour picker, not the picture under it */
        return { swatch: sw, word: r.word, now: r.o.now, fn: r.o.now ? function () {} : function () { take(r.o); } };
    }
    /* the row's name is written in the words' colour on that ground; where the part has no words to judge it by (a
       picture), that colour may not read, and the name takes the site's colour that reads best there */
    function nameInk(ground, ink) {
        var g = rgbOf(ground), i = rgbOf(ink); if (!g || !i || contrast(g, i) >= 3) return ink;
        var best = i; sitePairs().forEach(function (p) { [p.g, p.i].forEach(function (c) { var v = rgbOf(c); if (v && contrast(g, v) > contrast(g, best)) best = v; }); });
        return contrast(g, best) >= 3 ? rgbText(best) : (lum(g) > .4 ? '#1d1d1f' : '#fff');
    }
    /* the Look of a ground is the same four rows everywhere: light, dark, accent and inverted. A row that cannot be had
       here stays, greyed, and says why. Each of the first three is the site's own: the ground the block has now, else
       the one it came with, else the first that keeps every word readable. A part that came see-through over a picture
       has one more row before them, clear: the way it came, the picture showing through. */
    var KINDS = ['light', 'dark', 'accent']; /* accent: the site's own colour as a background; it names where the colour comes from and asks for no partner the way Light asks for Dark */
    function kindOf(bg) {
        var c = rgbOf(bg); if (!c || c.a === 0) return null;
        var mx = Math.max(c.r, c.g, c.b), mn = Math.min(c.r, c.g, c.b);
        return mx - mn > 40 ? 'accent' : (0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b) / 255 > .5 ? 'light' : 'dark';
    }
    var PICTURE_GROUND = 'Its background is the picture. Click the picture to replace it.';
    var WHY = { move: 'It would move things here.', read: 'Some words would be hard to read on it.' };
    /* two grounds the eye cannot tell apart: the background and its words both close */
    function sameByEye(a, b) {
        var d = function (p, q) { var x = rgbOf(p), y = rgbOf(q); return x && y ? Math.abs(x.r - y.r) + Math.abs(x.g - y.g) + Math.abs(x.b - y.b) : 999; };
        return d(a.ground, b.ground) < 45 && d(a.look.color, b.look.color) < 90;
    }
    function groundRows(b) {
        var list = grounds(b);
        if (!list.length) return KINDS.concat('inverted').map(function (k) { return { word: k, off: list.picture ? PICTURE_GROUND : 'This part cannot take another background.' }; });
        var rows = KINDS.map(function (k) {
            var here = list.filter(function (o) { return !o.flip && !o.see && kindOf(o.ground) === k; }), ok = here.filter(function (o) { return o.ok; });
            var pick = ok.filter(function (o) { return o.orig; })[0] || ok[0]; /* the same every time: what it came with, else the site's first */
            if (pick) return { o: pick, word: k };
            var bad = here.filter(function (o) { return o.why === 'read'; })[0] || here[0];
            return { word: k, off: bad ? WHY[bad.why] : 'This site has no ' + k + ' background.' };
        });
        var f = list.filter(function (o) { return o.flip; })[0];
        var bare = !b.innerText.trim(); /* no words (a picture): only the ground shows, so the ground alone tells rows apart */
        var groundAlike = function (x, y) { var p = rgbOf(x.ground), q = rgbOf(y.ground); return !!p && !!q && Math.abs(p.r - q.r) + Math.abs(p.g - q.g) + Math.abs(p.b - q.b) < 45; };
        var twin = f && f.ok && rows.filter(function (r) { return r.o && (alike(r.o, f) || sameByEye(r.o, f) || bare && groundAlike(r.o, f)); })[0]; /* swapped, it is a row already there */
        rows.push(twin ? { word: 'inverted', off: 'Same as ' + twin.word + ' here.' } : f && f.ok ? { o: f, word: 'inverted' } : { word: 'inverted', off: f ? WHY[f.why] : list.flipWhy || 'The background here is a picture.' });
        var see = list.filter(function (o) { return o.orig && o.ok && (o.see || o.plain && !rgbOf(o.ground)); })[0];
        if (see) rows.unshift({ o: see, word: 'clear' });
        return rows;
    }
    /* the parts that cover a block's ground, named by where they sit */
    function coverParts(b) {
        var parts = Array.prototype.filter.call(b.children, function (c) { return !c.hasAttribute('data-tweakfast') && !/^(STYLE|SCRIPT|TEMPLATE)$/.test(c.tagName) && c.getClientRects().length && !seeThrough(getComputedStyle(c).backgroundColor) && !covered(c); });
        if (parts.length === 2) {
            var r = parts[0].getBoundingClientRect(), q = parts[1].getBoundingClientRect(), beside = sameRow(parts[0], parts[1]);
            var firstLeads = beside ? r.left < q.left : r.top < q.top;
            parts[0]._tfSide = beside ? (firstLeads ? 'Left side' : 'Right side') : (firstLeads ? 'Top' : 'Bottom');
            parts[1]._tfSide = beside ? (firstLeads ? 'Right side' : 'Left side') : (firstLeads ? 'Bottom' : 'Top');
            if (!firstLeads) parts.reverse();
        } else parts.forEach(function (p, i) { p._tfSide = 'Part ' + (i + 1); });
        return parts.map(function (p) { return { part: p, label: p._tfSide }; });
    }
    /* ---- grounds ---- */
    /* a block takes another ground the site's own style sheet has: a class that alone sets a background (.section-dark,
       .bg-muted). Each is tried on the block in place and offered only when nothing but the ground and the ink change,
       so no ground can shift a layout; the block's own ground classes are taken off first, and plain is one choice. */
    var groundNames = null, inkNames = [];
    /* the text colour the site itself puts with a ground (bg-primary goes with text-primary-foreground): the class of
       colour seen most often beside it in the page */
    function inkWith(c) {
        var count = {}, best = null;
        Array.prototype.forEach.call(document.getElementsByClassName(c), function (n) { n.classList.forEach(function (k) { if (inkNames.indexOf(k) >= 0) { count[k] = (count[k] || 0) + 1; if (!best || count[k] > count[best]) best = k; } }); });
        return best;
    }
    function groundClasses() {
        if (groundNames) return groundNames;
        groundNames = []; inkNames = [];
        var walk = function (rules) {
            for (var i = 0; i < rules.length; i++) {
                var r = rules[i];
                if (r.cssRules && !r.selectorText) { if (!r.media || window.matchMedia(r.media.mediaText).matches) walk(r.cssRules); continue; }
                if (!r.style) continue;
                var ground = r.style.backgroundColor || r.style.backgroundImage || r.style.background, list = ground ? groundNames : r.style.color ? inkNames : null;
                if (!list) continue;
                (r.selectorText || '').split(',').forEach(function (sel) {
                    var m = /^\s*\.((?:\\.|[\w-])+)\s*$/.exec(sel); /* one class alone, escapes allowed (.hover\:bg-x is not one, it has a colon state) */
                    if (!m) return; var name = m[1].replace(/\\(.)/g, '$1');
                    if (ground && /destructive|danger|error|warning/.test(name)) return; /* a site's warning colour is not a background to choose */
                    if (list.indexOf(name) < 0) list.push(name);
                });
            }
        };
        for (var i = 0; i < document.styleSheets.length; i++) { var sh = document.styleSheets[i]; if (sh.ownerNode && sh.ownerNode.closest && sh.ownerNode.closest('[data-tweakfast]') || sh.ownerNode && sh.ownerNode.id === 'tf-style') continue; try { walk(sh.cssRules); } catch (e) {} } /* another site's sheet cannot be read */
        return groundNames;
    }
    var LAYOUT = ['display', 'position', 'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft', 'marginTop', 'marginBottom', 'gridTemplateColumns', 'flexDirection', 'borderTopWidth', 'borderLeftWidth', 'borderRadius', 'width', 'maxWidth'];
    /* the block's box and where each part inside it sits: a ground class that moves anything is not a ground */
    function layoutOf(n) {
        /* boxes as laid out, not as drawn: a sliding strip or a floating part moves on screen but not in the layout */
        var cs = getComputedStyle(n), out = LAYOUT.map(function (k) { return cs[k]; }).join('|') + '|' + n.offsetWidth + 'x' + Math.round(n.offsetHeight / 4);
        for (var c = n.firstElementChild; c; c = c.nextElementSibling) { if (c.hasAttribute('data-tweakfast') || /^(STYLE|SCRIPT)$/.test(c.tagName)) continue; out += '|' + (c.offsetParent === n ? '' : 'o') + c.offsetLeft + ',' + c.offsetTop + ',' + c.offsetWidth + ',' + c.offsetHeight; }
        return out;
    }
    /* the block's loudest words (its heading), so the menu's sample reads as the block does */
    function mainText(b) {
        var best = null, size = 0, all = b.querySelectorAll('*');
        for (var i = 0; i < all.length && i < 400; i++) { var n = all[i]; if (textTarget(n) !== n || !n.getClientRects().length) continue; var f = parseFloat(getComputedStyle(n).fontSize); if (f > size) { size = f; best = n; } }
        return best || firstText(b);
    }
    function groundLook(b) {
        var cs = getComputedStyle(b), t = mainText(b), ts = getComputedStyle(t || b), o = {};
        LOOK.forEach(function (k) { o[k] = ts[k]; });
        o.borderTopWidth = o.borderBottomWidth = o.borderLeftWidth = '0px'; o.paddingTop = o.paddingLeft = '0px'; o.backgroundColor = 'transparent'; o.backgroundImage = 'none';
        var fit = Math.min(parseFloat(ts.fontSize), 18); if (/px$/.test(ts.letterSpacing)) o.letterSpacing = parseFloat(ts.letterSpacing) * fit / parseFloat(ts.fontSize) + 'px'; /* tight heading letters stay tight, not on top of each other */
        o.fontSize = fit + 'px';
        var own = cs.backgroundImage !== 'none' ? cs.backgroundImage : cs.backgroundColor, clear = cs.backgroundImage === 'none' && !opaque(cs.backgroundColor);
        var pic = clear && pictureBehind(b);
        var g = { look: o, ground: pic || (clear ? groundOf(b.parentElement || b) : own), plain: clear }; g.key = same(g.ground) + '|' + same(cs.color); return g; /* a choice is the ground the eye sees, and its ink */
    }
    /* a see-through part over a picture that is not one of its own boxes (a header floating on the first photo): the
       eye sees the picture, not the colour of the boxes it sits in. Five points of the part are looked under; when most
       show a picture, that picture (as a background, for its swatch) is its ground, else null */
    function pictureBehind(b) {
        var r = b.getBoundingClientRect(), hits = 0, pic = null;
        if (!r.width || !r.height) return null;
        [[.5, .5], [.15, .3], [.85, .3], [.15, .7], [.85, .7]].forEach(function (f) {
            var x = r.left + r.width * f[0], y = r.top + r.height * f[1];
            if (x < 0 || y < 0 || x >= innerWidth || y >= innerHeight) return;
            var under = document.elementsFromPoint(x, y);
            for (var i = 0; i < under.length; i++) {
                var n = under[i];
                if (n === b || b.contains(n) || n.closest('[data-tweakfast]')) continue;
                if (n.contains(b)) break; /* down to its own boxes: their colour shows */
                var ns = getComputedStyle(n);
                if (n.tagName === 'IMG' && n.currentSrc) { hits++; pic = pic || 'url("' + n.currentSrc + '") center / cover'; break; }
                if (/url\(/.test(ns.backgroundImage)) { hits++; pic = pic || ns.backgroundImage + ' center / cover'; break; }
                if (opaque(ns.backgroundColor)) break;
            }
        });
        return hits >= 3 ? pic : null;
    }
    /* ---- reading ---- */
    function same(c) { var v = rgbOf(c); return v ? [v.r, v.g, v.b, v.a].map(function (x) { return Math.round(x * 100) / 100; }).join(',') : c; }
    /* any colour the browser reports (rgb, oklch, lab, color(), a name) as red, green, blue and alpha; null for a picture
       or a gradient. Browsers hand back modern colours as written, so the ones that are not rgb are painted once and read. */
    var paint = null, painted = {};
    function rgbOf(c) {
        if (!c || c === 'none') return null;
        var m = /^rgba?\(([^)]*)\)$/.exec(c);
        if (m) { var v = m[1].split(/[\s,\/]+/).filter(Boolean).map(parseFloat); return { r: v[0], g: v[1], b: v[2], a: v.length > 3 ? v[3] : 1 }; }
        if (c === 'transparent') return { r: 0, g: 0, b: 0, a: 0 };
        if (/gradient|url\(/.test(c)) return null;
        if (painted[c] !== undefined) return painted[c];
        if (!paint) { var cv = document.createElement('canvas'); cv.width = cv.height = 1; paint = cv.getContext('2d', { willReadFrequently: true }); }
        paint.fillStyle = '#010203'; paint.fillStyle = c; var ok = paint.fillStyle !== '#010203';
        paint.fillStyle = '#030201'; paint.fillStyle = c; ok = ok || paint.fillStyle !== '#030201'; /* not a colour: the canvas kept what it had */
        if (!ok) return (painted[c] = null);
        paint.clearRect(0, 0, 1, 1); paint.fillRect(0, 0, 1, 1); var d = paint.getImageData(0, 0, 1, 1).data;
        return (painted[c] = { r: d[0], g: d[1], b: d[2], a: Math.round(d[3] / 255 * 100) / 100 });
    }
    function seeThrough(c) { var v = rgbOf(c); return v ? v.a === 0 : c === 'transparent'; }
    function opaque(c) { var v = rgbOf(c); return !!v && v.a >= .5; }
    function lum(v) { var f = function (x) { x /= 255; return x <= .03928 ? x / 12.92 : Math.pow((x + .055) / 1.055, 2.4); }; return .2126 * f(v.r) + .7152 * f(v.g) + .0722 * f(v.b); }
    function contrast(a, b) { var x = lum(a), y = lum(b); return (Math.max(x, y) + .05) / (Math.min(x, y) + .05); }
    /* what a text sits on: the first solid colour behind it; a picture or a gradient behind it cannot be judged */
    function behind(n) {
        for (; n && n.nodeType === 1; n = n.parentElement) { var cs = getComputedStyle(n); if (cs.backgroundImage !== 'none') return null; if (opaque(cs.backgroundColor)) return rgbOf(cs.backgroundColor); }
        return { r: 255, g: 255, b: 255, a: 1 };
    }
    /* a see-through colour as it shows on what lies under it */
    function blend(fg, bg) { var a = fg.a; return { r: fg.r * a + bg.r * (1 - a), g: fg.g * a + bg.g * (1 - a), b: fg.b * a + bg.b * (1 - a), a: 1 }; }
    /* what a reader sees of a block, in a fixed order: each text's contrast on what it sits on ('t'), and each drawn
       line's contrast on what lies around it ('l'). Taken at rest and again with each of the site's own hover looks
       laid on the part it belongs to, so a ground that only breaks under the pointer is caught too. */
    function readings(b) {
        var out = [];
        measure(b, out);
        hoverRules().forEach(function (h) {
            var hit = []; try { hit = (b.matches(h.base) ? [b] : []).concat(Array.prototype.slice.call(b.querySelectorAll(h.base))); } catch (e) {}
            hit.slice(0, 12).forEach(function (el) {
                var was = el.getAttribute('style');
                el.style.transition = 'none'; el.setAttribute('data-tf-hover', ''); /* the hover look at once, not halfway through the site's fade */
                for (var i = 0; i < h.style.length; i++) { var k = h.style[i]; if (!/^transition|^animation|^transform|^translate|^scale|^rotate/.test(k)) el.style.setProperty(k, h.style.getPropertyValue(k), h.style.getPropertyPriority(k)); }
                measure(el, out);
                calm(el, was);
            });
        });
        return out;
    }
    /* the hover look taken off without the site's fade, so the next reading sees the part at rest, not on its way back */
    function calm(el, was) { el.removeAttribute('data-tf-hover'); el.setAttribute('style', 'transition:none'); getComputedStyle(el).backgroundColor; putAttr(el, 'style', was); }
    function measure(root, out) {
        var seen = [], w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT), t, el, cs, bg;
        while ((t = w.nextNode()) && seen.length < 120) {
            el = t.parentElement; if (!t.nodeValue.trim() || !el || seen.indexOf(el) >= 0 || el.closest('[data-tweakfast]') || !el.getClientRects().length) continue;
            seen.push(el); bg = behind(el); cs = getComputedStyle(el); var fill = rgbOf(cs.webkitTextFillColor), fg = rgbOf(fill && fill.a === 0 && parseFloat(cs.webkitTextStrokeWidth) > 0 ? cs.webkitTextStrokeColor : cs.color); /* outlined words read by their outline */
            out.push({ k: 't', v: bg && fg ? contrast(blend(fg, bg), bg) : null, el: el });
        }
        var all = [root].concat(Array.prototype.slice.call(root.querySelectorAll('*'))).slice(0, 200);
        for (var i = 0; i < all.length; i++) {
            el = all[i]; if (el.closest('[data-tweakfast]')) continue; cs = getComputedStyle(el);
            var side = ['Top', 'Right', 'Bottom', 'Left'].filter(function (s) { return parseFloat(cs['border' + s + 'Width']) > 0 && cs['border' + s + 'Style'] !== 'none'; })[0];
            if (!side) continue;
            bg = behind(el.parentElement); var line = rgbOf(cs['border' + side + 'Color']);
            out.push({ k: 'l', v: bg && line ? contrast(blend(line, bg), bg) : null, el: el });
        }
    }
    /* the site's own hover looks: each rule with :hover, and the parts it is for */
    var hovers = null, hoverObjs = [], stilled = 0;
    /* the colours at rest, wherever the pointer is: while the editor reads them, the site's hover rules match nothing
       (a card under the pointer would read as its hover look otherwise) */
    function still(fn) {
        hoverRules();
        var calmAll = null;
        if (!stilled++) {
            hoverObjs.forEach(function (r) { r._tfSel = r.selectorText; r.selectorText = r.selectorText.replace(/:hover/g, ':hover:not(:hover)'); });
            /* and no fades: a colour the editor tries and takes back must not set the site's transitions going */
            calmAll = document.createElement('style'); calmAll.setAttribute('data-tweakfast', ''); calmAll.textContent = '*,*::before,*::after{transition:none!important}'; document.head.appendChild(calmAll);
        }
        try { return fn(); } finally {
            if (!--stilled) { hoverObjs.forEach(function (r) { if (r._tfSel) r.selectorText = r._tfSel; }); }
            if (calmAll) { document.body.offsetHeight; calmAll.remove(); /* every part settled before fades come back */ }
        }
    }
    function hoverRules() {
        if (hovers) return hovers;
        hovers = [];
        var walk = function (rules) {
            for (var i = 0; i < rules.length; i++) {
                var r = rules[i];
                if (r.cssRules && !r.selectorText) { if (!r.media || window.matchMedia(r.media.mediaText).matches) walk(r.cssRules); continue; }
                if (!r.selectorText || r.selectorText.indexOf(':hover') < 0 || !r.style) continue;
                hoverObjs.push(r);
                r.selectorText.split(',').forEach(function (sel) { if (sel.indexOf(':hover') >= 0) { var base = sel.replace(/:hover/g, '').trim(); if (base && !/[>+~]\s*$/.test(base)) hovers.push({ base: base, sel: sel.trim(), style: r.style }); } });
            }
        };
        for (var i = 0; i < document.styleSheets.length; i++) { var sh = document.styleSheets[i]; if (sh.ownerNode && (sh.ownerNode.id === 'tf-style' || sh.ownerNode.hasAttribute && sh.ownerNode.hasAttribute('data-tf-tint') || sh.ownerNode.closest && sh.ownerNode.closest('[data-tweakfast]'))) continue; try { walk(sh.cssRules); } catch (e) {} } /* the editor's own, and the tints it wrote, are not the site's */
        return hovers;
    }
    /* a ground keeps the block readable when no text that read well (3:1 and up) falls below that, and no line that
       showed (1.15:1 and up) fades away (below 1.08:1), at rest or under the pointer */
    function staysReadable(was, now) {
        if (was.length !== now.length) return false;
        for (var i = 0; i < was.length; i++) {
            var a = was[i].v, z = now[i].v; if (a === null || z === null) continue;
            if (was[i].k === 't' ? a >= 3 && z < 3 : a >= 1.15 && z < 1.08) return false;
        }
        return true;
    }
    /* parts that fill the block with their own grounds hide its ground: then there is nothing to choose */
    function covered(b) {
        var r = b.getBoundingClientRect(), area = 0;
        for (var c = b.firstElementChild; c; c = c.nextElementSibling) {
            if (c.hasAttribute('data-tweakfast') || seeThrough(getComputedStyle(c).backgroundColor)) continue; /* a see-through part shows the block's ground */
            var q = c.getBoundingClientRect(); area += q.width * q.height;
        }
        return r.width * r.height > 0 && area >= r.width * r.height * .9;
    }
    /* the grounds a block can take, the one it has first; classOnly leaves out the site's colours laid on as a pair
       (cheaper: enough to know whether a card has a Look at all) */
    function grounds(b, classOnly) {
        var at = classOnly ? '_tfGroundsC' : '_tfGrounds';
        if (b[at] && b[at].at === era) return b[at].list;
        return still(function () { return groundsNow(b, classOnly); });
    }
    /* the choices are worked out from the block as the page came, never from what it took since: the same rows every
       time the menu opens, and the one it has now is ticked */
    function groundsNow(b, classOnly) {
        var list = [], off = [], full = !isButton(b) && fullPicture(b);
        if (full) list.picture = true; /* its own picture covers all of its ground: a colour there would never show */
        if (!full && !isButton(b) && !b.matches('li,tr,td,th,dt,dd') && b.getClientRects().length && !covered(b)) {
            var was = b.getAttribute('class'), tintWas = tintState(b), held = tintPair(b), from = groundFrom(b);
            untint(b); putAttr(b, 'class', from); /* as it came */
            var names = groundClasses(), own = names.filter(function (c) { return b.classList.contains(c); }), base = layoutOf(b), first = groundLook(b), read = readings(b);
            var cs = getComputedStyle(b), ink = cs.color;
            var choice = function (cls, pair, g, extra) { var o = { cls: cls, pair: pair, look: g.look, ground: g.ground, plain: g.plain, key: g.key, ok: true }; for (var k in extra) o[k] = extra[k]; return o; };
            /* a choice that reads well is kept unless one like it is there; one that does not, only to say why its row is grey */
            var put = function (o) {
                if (o.flip) { list.push(o); return; }
                if (o.ok) { if (!list.some(function (x) { return !x.flip && !x.see && !o.see && alike(x, o); })) list.push(o); } else off.push(o);
            };
            /* a see-through part pinned to the screen (a header riding over the page): what shows through it changes
               with every scroll, so the way it came is one row, Clear, whatever is under it right now; the other rows
               are the site's own colours laid on it, the same at the top of the page and at its end */
            var see = first.plain && pinned(b);
            /* the ground it came with is always a choice: the way back needs no checking */
            put(choice(from, null, first, { orig: true, see: see }));
            var bare = Array.prototype.filter.call(b.classList, function (c) { return own.indexOf(c) < 0; });
            var tried = 0;
            [''].concat(names).forEach(function (c) {
                if (c && own.indexOf(c) >= 0 || tried >= 40) return;
                tried++;
                if (!c && !own.length) return; /* plain: only when it has a ground class to take off */
                /* in place of its own ground class; or, when that class also lays the block out (a footer, a strip), beside it */
                var inkC = c && inkWith(c), add = c ? [c].concat(inkC && !b.classList.contains(inkC) ? [inkC] : []) : [], keep = bare.filter(function (k) { return !inkC || inkNames.indexOf(k) < 0; }); /* its own text colour class makes way for the ground's */
                var tries = [keep.concat(add).join(' ')]; if (c && own.length) tries.push(Array.prototype.slice.call(b.classList).filter(function (k) { return !inkC || inkNames.indexOf(k) < 0; }).concat(add).join(' '));
                tries.some(function (cls, n) {
                    b.setAttribute('class', cls); retint(b, from);
                    var fits = layoutOf(b) === base, ok = fits && staysReadable(read, readings(b)), g = groundLook(b); /* nothing moves, and every text still reads */
                    untint(b); putAttr(b, 'class', from);
                    if (fits || n === tries.length - 1) put(choice(cls, null, g, { ok: ok, why: fits ? 'read' : 'move' }));
                    return fits;
                });
            });
            if (!classOnly) {
                var picture = cs.backgroundImage !== 'none' || !see && !rgbOf(first.ground);
                /* the site's own colour pairs laid on the block as they are: no class, so nothing can move */
                if (!picture) sitePairs().forEach(function (p) {
                    if (list.some(function (x) { return x.ok && same(x.ground) === same(p.g); })) return; /* a class gives it already */
                    retint(b, from, p); var ok = staysReadable(read, readings(b)), g = groundLook(b); untint(b);
                    put(choice(from, p, g, { ok: ok, why: 'read' }));
                });
                /* inverted: the ground it came with becomes its ink, and that ink its ground */
                var gv = rgbOf(first.ground), iv = rgbOf(ink);
                if (see) list.flipWhy = 'It has no background of its own to swap.';
                else if (picture || !gv || !iv) list.flipWhy = 'The background here is a picture.';
                else if (contrast(blend(iv, gv), gv) < 3) list.flipWhy = 'Its words and background are too close to swap.';
                if (!see && !picture && gv && iv && contrast(blend(iv, gv), gv) >= 3) {
                    var fp = { g: rgbText(blend(iv, gv)), i: rgbText(gv), flip: true };
                    retint(b, from, fp); var okF = staysReadable(read, readings(b)), gF = groundLook(b); untint(b);
                    put(choice(from, fp, gF, { ok: okF, why: 'read', flip: true }));
                }
            }
            putAttr(b, 'class', was); setTint(b, tintWas);
            off.forEach(function (o, n) { if (!list.some(function (x) { return !x.flip && alike(x, o); }) && !off.slice(0, n).some(function (x) { return alike(x, o); })) list.push(o); });
            /* the tick: the choice that is what the block has now */
            var samePair = function (x, y) { return !x && !y || !!x && !!y && !x.flip === !y.flip && same(x.g) === same(y.g) && same(x.i) === same(y.i); };
            list.forEach(function (o) { o.now = o.ok && (o.cls || '') === (was || '') && samePair(o.pair, held); });
            if (!list.some(function (o) { return o.now; })) { var seen = groundLook(b), tick = list.filter(function (o) { return o.ok && !o.flip && (alike(o, seen) || sameByEye(o, seen)); })[0]; if (tick) tick.now = true; } /* a Look that now looks as the part came: that row */
        }
        b[classOnly ? '_tfGroundsC' : '_tfGrounds'] = { at: era, list: list };
        return list;
    }
    /* a part whose own picture covers all of it (a first photo with the words laid over it): what the eye sees as its
       ground is that picture, so another ground colour would change nothing on the screen */
    function fullPicture(b) {
        var r = b.getBoundingClientRect(), area = r.width * r.height; if (!area) return false;
        return Array.prototype.some.call(b.querySelectorAll('img'), function (img) {
            var q = img.getBoundingClientRect(), w = Math.min(q.right, r.right) - Math.max(q.left, r.left), h = Math.min(q.bottom, r.bottom) - Math.max(q.top, r.top);
            return w > 0 && h > 0 && w * h >= area * .95;
        });
    }
    /* the photo that is a section's whole ground (a first photo with the words laid over it): the section has no bare
       spot left to click, so picking the photo picks the section too */
    function groundPicture(b, img) {
        if (!b || !img || img.tagName !== 'IMG' || !b.hasAttribute('data-tf-block') || !b.contains(img)) return false;
        var r = b.getBoundingClientRect(), q = img.getBoundingClientRect(), area = r.width * r.height;
        var w = Math.min(q.right, r.right) - Math.max(q.left, r.left), h = Math.min(q.bottom, r.bottom) - Math.max(q.top, r.top);
        return area > 0 && w > 0 && h > 0 && w * h >= area * .95;
    }
    /* the boxes laid on a part whose ground is its own picture (the card on a first photo): the colour the eye sees
       there. Each is a part of its own, with its own Look: what is pointed at is what changes. Null when the part's
       ground is not a picture */
    function pictureBoxes(b) {
        if (!fullPicture(b)) return null;
        var r = b.getBoundingClientRect(), area = r.width * r.height, out = [];
        Array.prototype.forEach.call(b.querySelectorAll('*'), function (n) {
            if (n.tagName === 'IMG' || n.closest('[data-tweakfast]') || isButton(n) || out.some(function (o) { return o.contains(n); })) return;
            var cs = getComputedStyle(n); if (cs.backgroundImage !== 'none' || !opaque(cs.backgroundColor)) return;
            var q = n.getBoundingClientRect(), a = q.width * q.height; if (a < area * .04 || a >= area * .95) return; /* a field or a tag is too small to be a ground */
            out.push(n);
        });
        if (out.length === 2) {
            var p = out[0].getBoundingClientRect(), q = out[1].getBoundingClientRect(), beside = sameRow(out[0], out[1]), firstLeads = beside ? p.left < q.left : p.top < q.top;
            if (!firstLeads) out.reverse();
            return [{ part: out[0], label: beside ? 'Left' : 'Top' }, { part: out[1], label: beside ? 'Right' : 'Bottom' }];
        }
        return out.map(function (n, i) { return out.length > 1 ? { part: n, label: 'Part ' + (i + 1) } : { part: n }; });
    }
    function boxesOf(b) {
        if (b._tfBoxes && b._tfBoxes.at === era) return b._tfBoxes.list;
        var list = (pictureBoxes(b) || []).map(function (o) { return o.part; }); b._tfBoxes = { at: era, list: list }; return list;
    }
    /* the box on the block's picture that holds the node, else null */
    function boxOn(b, node) { var l = boxesOf(b); for (var i = 0; i < l.length; i++) if (l[i].contains(node)) return l[i]; return null; }
    function onPicture(n) { var b = n.parentElement && n.parentElement.closest('[data-tf-block]'); return !!b && boxesOf(b).indexOf(n) >= 0; }
    function rgbText(v) { return 'rgb(' + Math.round(v.r) + ', ' + Math.round(v.g) + ', ' + Math.round(v.b) + ')'; }
    /* the colour pairs this site paints with: the page's own, and each ground class's background with the ink it brings */
    var pairsSeen = null;
    function sitePairs() {
        if (pairsSeen) return pairsSeen;
        pairsSeen = [];
        var lone = [], colours = [];
        var add = function (bg, ink) {
            var g = rgbOf(bg), i = rgbOf(ink); if (!g || !i || g.a < 1) return;
            i = blend(i, g); colours.push(g, i);
            if (contrast(g, i) < 4.5) { lone.push(g); return; } /* a pair the site reads its words on; a ground alone waits for an ink */
            var p = { g: rgbText(g), i: rgbText(i) };
            if (!pairsSeen.some(function (q) { return same(q.g) === same(p.g) && same(q.i) === same(p.i); })) pairsSeen.push(p);
        };
        var bs = getComputedStyle(document.body), hs = getComputedStyle(document.documentElement);
        add(opaque(bs.backgroundColor) ? bs.backgroundColor : opaque(hs.backgroundColor) ? hs.backgroundColor : '#fff', bs.color);
        groundClasses().forEach(function (c) {
            var probe = document.createElement('div'), inkC = inkWith(c);
            probe.setAttribute('data-tweakfast', ''); probe.style.display = 'none'; probe.className = c + (inkC ? ' ' + inkC : '');
            document.body.appendChild(probe); var ps = getComputedStyle(probe); add(ps.backgroundImage === 'none' ? ps.backgroundColor : 'none', ps.color); probe.remove();
        });
        /* a ground the site never writes on (its light ink used as a ground): the site's colour that reads best on it */
        lone.forEach(function (g) {
            var best = null; colours.forEach(function (c) { if (!best || contrast(g, c) > contrast(g, best)) best = c; });
            if (!best || contrast(g, best) < 4.5) return;
            var p = { g: rgbText(g), i: rgbText(best) };
            if (!pairsSeen.some(function (q) { return same(q.g) === same(p.g); })) pairsSeen.push(p);
        });
        return pairsSeen;
    }
    /* two grounds the eye cannot tell apart (a white and an off-white, under the same ink) are one choice */
    function alike(a, b) {
        if (a.key === b.key) return true;
        var x = rgbOf(a.ground), y = rgbOf(b.ground), ka = a.key.split('|')[1], kb = b.key.split('|')[1];
        return !!x && !!y && ka === kb && Math.abs(x.r - y.r) + Math.abs(x.g - y.g) + Math.abs(x.b - y.b) < 18;
    }
    /* a ground taken: its class, and the colours laid on it when it is a pair (inverted, or a colour of the site);
       holder is the block whose tools stay up (a section, when one of its halves took it) */
    function takeGround(b, o, holder, also) {
        /* parts that go with it (the badge beside a card) take their own choice of the same colour, in the same step */
        var list = [{ b: b, o: o }].concat((also || []).map(function (n) {
            var m = grounds(n).filter(function (x) { return x.ok && !x.flip === !o.flip && same(x.ground) === same(o.ground); })[0];
            return m ? { b: n, o: m } : null;
        }).filter(Boolean));
        var saved = list.map(function (x) { return { b: x.b, was: x.b.getAttribute('class'), outerWas: cleanOuter(x.b), tintWas: tintState(x.b), from: groundFrom(x.b) }; });
        list.forEach(function (x, i) { putAttr(x.b, 'class', x.o.cls); retint(x.b, saved[i].from, x.o.pair); });
        steps.push(function () { saved.forEach(function (v) { putAttr(v.b, 'class', v.was); setTint(v.b, v.tintWas); }); });
        refresh();
        saved.forEach(function (v) { if (sharedParts(document).indexOf(v.b) >= 0) mirrorGround(v.b, v.was, v.tintWas); else mirror(v.b, v.outerWas); });
        showTools(holder || b);
        once('ground', 'The colours come from this site. Undo brings the old ones back.');
    }
    /* the header or a footer took a ground: every other page's takes the same, when its ground was the same before
       (its insides may differ, the menu marks another page as the current one) */
    function mirrorGround(part, classWas, tintWas) {
        var which = sharedParts(document).indexOf(part), cls = part.getAttribute('class'), st = tintStyle(part), id = part.getAttribute('data-tf-tint');
        var marked = st ? ownMarks(part).map(function (n) { return { path: pathFrom(part, n), m: markOf(n, id) }; }) : [];
        var paths = otherPages(); if (!paths.length) return;
        var local = steps[steps.length - 1];
        var tintText = function (n) { var t = tintStyle(n); return t ? t.textContent : ''; };
        job(function (finish) {
            var led = ledger(), differ = [];
            eachPage(paths, function (path_, html) {
                if (html === null) return;
                var doc = parse(html), there = sharedParts(doc)[which];
                if (there && (there.getAttribute('class') || '') === (classWas || '') && tintText(there) === (tintWas ? tintWas.style.textContent : '')) {
                    untint(there); putAttr(there, 'class', cls);
                    if (st) { there.appendChild(doc.importNode(st, true)); there.setAttribute('data-tf-tint', id); marked.forEach(function (x) { var n = walkPath(there, x.path); if (n) mark(n, x.m); }); }
                    led.put(path_, serialize(doc));
                } else differ.push(path_);
            }, function () {
                if (led.wrote()) fold(local, led.back);
                finish();
                if (differ.length) say(exceptPages(differ, 'this part'));
            });
        });
    }
    /* the page's ground: the first part around the page's content that paints one from edge to edge (a wrapper the maker
       put around everything), else the body. Sections narrower than the page show it on both sides. */
    function pageGround() {
        var page = document.documentElement.clientWidth;
        for (var n = document.querySelector('main') || document.querySelector('section'); n && n !== document.body && n !== document.documentElement; n = n.parentElement) {
            var cs = getComputedStyle(n); if (cs.backgroundImage === 'none' && seeThrough(cs.backgroundColor)) continue;
            if (n.getBoundingClientRect().width >= page - 1) return n;
        }
        return document.body;
    }
    /* the page's ground taken here, then on every other page whose ground was the same. Each other page is laid out
       unseen (no scripts run in it), so its quiet words and lines follow the new ground as they do here. */
    /* a Look is a choice (light, dark, a colour), not colours fixed for the ground around it when it was made: when the
       page's ground changes, every part inside it that has a Look of its own takes the same choice again against the
       new ground, so its words keep reading. Answers the way back. */
    function relook(page, doc, change) {
        var back = Array.prototype.filter.call(doc.querySelectorAll('[data-tf-tint]'), function (t) { return t.tagName !== 'STYLE' && t !== page && !t.contains(page); }) /* parts, not our own style elements */
            .map(function (t) { return { t: t, state: tintState(t), from: groundFrom(t), pair: tintPair(t) }; });
        still(function () {
            back.forEach(function (x) { untint(x.t); }); /* set aside, so the page's colours reach them as they came */
            change();
            back.forEach(function (x) { retintNow(x.t, x.from, x.pair); }); /* outer first: document order */
        });
        return function () { back.slice().reverse().forEach(function (x) { setTint(x.t, x.state); }); };
    }
    function takePageGround(b, o) {
        var was = b.getAttribute('class'), tintWas = tintState(b), from = groundFrom(b), path = pathFrom(document.body, b);
        var tintText = function (n) { var t = tintStyle(n); return t ? t.textContent : ''; }, before = tintText(b);
        putAttr(b, 'class', o.cls); var relooked = relook(b, document, function () { retintNow(b, from, o.pair); });
        var local = function () { putAttr(b, 'class', was); setTint(b, tintWas); relooked(); };
        steps.push(local);
        refresh(); if (panel && view && view.kind === 'pages') renderPages();
        once('ground', 'The colours come from this site. Undo brings the old ones back.');
        /* every page of the site, not only the menu's: the pages the menu names, those changed already, and each page
           any of them links to (a project page, a legal page), as far as the links go */
        var seen = [here()], queue = [];
        var add = function (p) { if (p && !drops[p] && seen.indexOf(p) < 0 && seen.length < 60) { seen.push(p); queue.push(p); } };
        var linksIn = function (doc) { Array.prototype.forEach.call(doc.querySelectorAll('a[href]'), function (a) { if (isPageLink(a)) add(pathOf(a)); }); };
        pageList().forEach(function (p) { add(p.path); });
        Object.keys(changes).forEach(add);
        linksIn(document);
        if (!queue.length) return;
        say('Working…');
        job(function (finish) {
            /* three pages at a time: each is laid out unseen, so all at once would stall a phone */
            var led = ledger(), differ = [], running = 0;
            var pump = function () {
                while (running < 3 && queue.length) one(queue.shift());
                if (!running && !queue.length) end();
            };
            var one = function (path_) {
                running++;
                var after = function () { running--; pump(); };
                loadPage(path_, function (html) {
                    if (html === null) { after(); return; }
                    linksIn(parse(html));
                    unseen(html, function (doc) {
                        var there = doc && walkPath(doc.body, path);
                        if (!there || there.tagName !== b.tagName || (there.getAttribute('class') || '') !== (was || '') || tintText(there) !== before) { differ.push(path_); return; }
                        var calmIt = doc.createElement('style'); calmIt.textContent = '*,*::before,*::after{transition:none!important;animation:none!important}'; doc.head.appendChild(calmIt);
                        var fromThere = groundFrom(there); putAttr(there, 'class', o.cls); relook(there, doc, function () { retintNow(there, fromThere, o.pair); }); roomsNow(doc); coverGround(doc);
                        calmIt.remove(); scrub(doc.body);
                        led.put(path_, serialize(doc));
                    }, after);
                });
            };
            var end = function () {
                if (led.wrote()) fold(local, led.back);
                finish(); say('');
                if (differ.length) say(exceptPages(differ, 'the background'));
            };
            pump();
        });
    }
    /* a page laid out out of sight, at this window's width, with the site's styles and none of its scripts.
       A page that has not loaded in 8 seconds is not read at all: without its stylesheet its colours would be wrong. */
    function unseen(html, fn, after, width) {
        var f = document.createElement('iframe'); f.setAttribute('data-tweakfast', ''); f.setAttribute('sandbox', 'allow-same-origin'); f.setAttribute('aria-hidden', 'true'); f.tabIndex = -1;
        f.style.cssText = 'position:fixed;left:-20000px;top:0;width:' + (width || window.innerWidth) + 'px;height:' + window.innerHeight + 'px;border:0;visibility:hidden;pointer-events:none';
        var done = false, end = function (late) { if (done) return; done = true; var d = null; try { d = late ? null : f.contentDocument; } catch (e) {} try { fn(d && d.body ? d : null); } catch (e) { fn(null); } f.remove(); after(); };
        f.addEventListener('load', function () { end(false); }); setTimeout(function () { end(true); }, 8000);
        f.srcdoc = html; document.body.appendChild(f);
    }
    /* ---- tint: the parts of a block follow its new ground ----
       A site colours a section's parts for the ground it was made on: grey for quiet words, a faint ink for lines, a
       slightly darker ground under the pointer. On another ground they keep those colours and fade. Each colour that
       is a mix of the old ground and the old ink is laid again as the same mix of the new ones, so quiet words stay
       quiet and lines stay faint, in the site's own two colours. A part on a ground of another colour (a lime sticker)
       keeps the ink it had. The colours sit in one style element inside the block: the way back takes it out. */
    var TINT = { color: 'color', backgroundColor: 'background-color', accentColor: 'accent-color', borderTopColor: 'border-top-color', borderRightColor: 'border-right-color', borderBottomColor: 'border-bottom-color', borderLeftColor: 'border-left-color', webkitTextStrokeColor: '-webkit-text-stroke-color' }; /* the outline of outlined words too */
    function tintStyle(b) { for (var c = b.firstElementChild; c; c = c.nextElementSibling) if (c.tagName === 'STYLE' && c.hasAttribute('data-tf-tint')) return c; return null; }
    /* the class the block's colours were made for: kept in its tint, so it lasts past a reload */
    /* the colours laid on a block as a pair, kept in its tint: { g, i, flip } */
    function tintPair(b) { var st = tintStyle(b), v = st && st.getAttribute('data-tf-pair'); if (!v) return null; v = v.split('|'); return { g: v[0], i: v[1], flip: st.hasAttribute('data-tf-flip') }; }
    function groundFrom(b) { var st = tintStyle(b); if (st) return st.getAttribute('data-tf-from'); if (b._tfGroundFrom === undefined) b._tfGroundFrom = b.getAttribute('class'); return b._tfGroundFrom; }
    function tintState(b) {
        var st = tintStyle(b); if (!st) return null;
        var id = b.getAttribute('data-tf-tint');
        return { style: st.cloneNode(true), id: id, marks: ownMarks(b).map(function (n) { return [n, markOf(n, id)]; }) };
    }
    /* a part may carry marks of more than one tint (a section's and a card's inside it): each tint adds and takes away
       only its own word in the attribute */
    function marks(n) { return (n.getAttribute('data-tf-t') || '').split(' ').filter(Boolean); }
    function markOf(n, id) { return marks(n).filter(function (m) { return m.indexOf(id + '-') === 0; })[0]; }
    function mark(n, m) { var all = marks(n); if (all.indexOf(m) < 0) all.push(m); n.setAttribute('data-tf-t', all.join(' ')); }
    function unmark(n, id) { var all = marks(n).filter(function (m) { return m.indexOf(id + '-') !== 0; }); putAttr(n, 'data-tf-t', all.join(' ')); }
    function ownMarks(b) { var id = b.getAttribute('data-tf-tint'); return id ? Array.prototype.filter.call(b.querySelectorAll('[data-tf-t]'), function (n) { return !!markOf(n, id); }) : []; }
    function untint(b) {
        var id = b.getAttribute('data-tf-tint');
        ownMarks(b).forEach(function (n) { unmark(n, id); });
        var st = tintStyle(b); if (st) st.remove();
        b.removeAttribute('data-tf-tint');
    }
    function setTint(b, state) {
        untint(b); if (!state) return;
        b.appendChild(state.style.cloneNode(true)); b.setAttribute('data-tf-tint', state.id);
        state.marks.forEach(function (m) { mark(m[0], m[1]); });
    }
    function tintParts(b) { return [b].concat(Array.prototype.slice.call(b.querySelectorAll('*'))).filter(function (n) { return !n.closest('[data-tweakfast],svg') && !/^(STYLE|SCRIPT)$/.test(n.tagName); }).slice(0, b.tagName === 'BODY' || b.tagName === 'MAIN' ? 3000 : 400); } /* the page's own ground reaches its footer too */
    function tintRead(n) { var cs = getComputedStyle(n), o = { under: behind(n) }; for (var k in TINT) o[k] = cs[k]; o.stroke = parseFloat(cs.webkitTextStrokeWidth) > 0; o.image = cs.backgroundImage !== 'none'; o.lines = ['Top', 'Right', 'Bottom', 'Left'].map(function (s) { return parseFloat(cs['border' + s + 'Width']) > 0 && cs['border' + s + 'Style'] !== 'none'; }); return o; }
    /* each of the site's hover looks on the block's parts, read as it shows */
    function tintHovers(b) {
        var out = [];
        hoverRules().forEach(function (h) {
            var hit = []; try { hit = (b.matches(h.base) ? [b] : []).concat(Array.prototype.slice.call(b.querySelectorAll(h.base))); } catch (e) {}
            hit.slice(0, 12).forEach(function (el) {
                var was = el.getAttribute('style'); el.style.transition = 'none'; el.setAttribute('data-tf-hover', '');
                for (var i = 0; i < h.style.length; i++) { var k = h.style[i]; if (!/^transition|^animation|^transform|^translate|^scale|^rotate/.test(k)) el.style.setProperty(k, h.style.getPropertyValue(k), h.style.getPropertyPriority(k)); }
                var r = tintRead(el); calm(el, was);
                r.rest = tintRead(el); r.h = h; out.push(r);
            });
        });
        return out;
    }
    /* another of the part's kind (its tag and a class in common), outside the block, with a ground of its own and on
       the ground g: its ground and ink as they show, or null */
    function kinOn(n, g, b) {
        var names = Array.prototype.filter.call(n.classList, function (c) { return c.indexOf('tf-') !== 0; }); if (!names.length || !g) return null;
        var hit = null;
        names.some(function (c) {
            var list; try { list = document.querySelectorAll(n.tagName + '.' + CSS.escape(c)); } catch (e) { return false; }
            for (var i = 0; i < list.length && i < 60; i++) {
                var m = list[i]; if (m === n || b.contains(m) || m.closest('[data-tweakfast]') || !m.getClientRects().length) continue;
                var cs = getComputedStyle(m), under = behind(m.parentElement);
                if (cs.backgroundImage !== 'none' || !opaque(cs.backgroundColor) || !under || contrast(under, g) > 1.05) continue;
                if (contrast(rgbOf(cs.backgroundColor), g) < 1.15) continue; /* one that melts into it is no example */
                hit = { bg: cs.backgroundColor, ink: cs.color }; return true;
            }
            return false;
        });
        return hit;
    }
    /* a picture drawn in one colour on a see-through ground (a logo, an icon as a file): that colour, else null. Such a
       picture is part of the words around it: when the ground changes, it takes the new ink as the words do */
    function flatInk(img) {
        if (img._tfFlat !== undefined && img._tfFlat.src === img.currentSrc) return img._tfFlat.ink;
        var ink = null;
        try {
            if (img.complete && img.naturalWidth) {
                var w = 48, h = Math.max(1, Math.round(w * img.naturalHeight / img.naturalWidth)), c = document.createElement('canvas'); c.width = w; c.height = h;
                var x = c.getContext('2d'); x.drawImage(img, 0, 0, w, h);
                var d = x.getImageData(0, 0, w, h).data, n = 0, clear = 0, sum = [0, 0, 0], all = [];
                for (var i = 0; i < d.length; i += 4) { if (d[i + 3] < 24) { clear++; continue; } if (d[i + 3] < 200) continue; n++; sum[0] += d[i]; sum[1] += d[i + 1]; sum[2] += d[i + 2]; all.push(i); }
                if (n > 8 && clear > (w * h) * .1) {
                    var m = sum.map(function (v) { return Math.round(v / n); });
                    if (all.every(function (i) { return Math.abs(d[i] - m[0]) + Math.abs(d[i + 1] - m[1]) + Math.abs(d[i + 2] - m[2]) < 40; })) ink = 'rgb(' + m.join(', ') + ')';
                }
            }
        } catch (e) {} /* a picture from another site cannot be read: it stays as it is */
        img._tfFlat = { src: img.currentSrc, ink: ink };
        return ink;
    }
    /* the picture's own shape, painted in a colour: its pixels move out of sight, its shape lets the colour through */
    function paintedIn(img, colour) {
        var fit = getComputedStyle(img).objectFit, size = fit === 'contain' || fit === 'cover' || fit === 'scale-down' ? (fit === 'cover' ? 'cover' : 'contain') : '100% 100%';
        var url = 'url("' + (img.getAttribute('src') || '').replace(/"/g, '%22') + '") 50% 50%/' + size + ' no-repeat';
        return ['object-position:-99999px 0', 'background:' + colour, '-webkit-mask:' + url, 'mask:' + url].map(function (x) { return x + '!important'; });
    }
    /* a colour as the same mix of ground and ink on the new pair, or null when it is a colour of its own */
    function remix(c, g0, i0, g1, i1) {
        var v = rgbOf(c); if (!v || v.a === 0) return null;
        var d = [i0.r - g0.r, i0.g - g0.g, i0.b - g0.b], x = [v.r - g0.r, v.g - g0.g, v.b - g0.b], len = d[0] * d[0] + d[1] * d[1] + d[2] * d[2];
        var t = (x[0] * d[0] + x[1] * d[1] + x[2] * d[2]) / len, off = Math.sqrt(Math.pow(x[0] - t * d[0], 2) + Math.pow(x[1] - t * d[1], 2) + Math.pow(x[2] - t * d[2], 2));
        if (off > 24 || t < -.2 || t > 1.2) return null;
        /* the same distance from the ground as the eye reads it (contrast), not as the numbers run: a grey that read 4:1 reads 4:1 again */
        return towards(contrast(blend(v, g0), g0), v.a, g1, i1);
    }
    /* the colour between the new ground and the new ink that stands off the ground by this much */
    function towards(want, alpha, g1, i1) {
        var at = function (u) { return { r: g1.r + u * (i1.r - g1.r), g: g1.g + u * (i1.g - g1.g), b: g1.b + u * (i1.b - g1.b), a: alpha }; }, lo = 0, hi = 1;
        for (var n = 0; n < 24; n++) { var mid = (lo + hi) / 2; if (contrast(blend(at(mid), g1), g1) < want) lo = mid; else hi = mid; }
        var c = at(hi);
        /* faint words that the full ink cannot lift that far at their faintness: a little less faint */
        if (alpha < 1 && contrast(blend(c, g1), g1) < want) { lo = alpha; hi = 1; for (n = 0; n < 16; n++) { c.a = (lo + hi) / 2; if (contrast(blend(c, g1), g1) < want) lo = c.a; else hi = c.a; } alpha = Math.round(hi * 100) / 100; c.a = alpha; }
        return 'rgba(' + Math.round(c.r) + ',' + Math.round(c.g) + ',' + Math.round(c.b) + ',' + alpha + ')';
    }
    /* pair: a ground and an ink laid on the block itself (inverted, or a colour of the site), past what its class gives */
    function retint(b, from, pair) { still(function () { retintNow(b, from, pair); }); }
    function retintNow(b, from, pair) {
        untint(b);
        var to = b.getAttribute('class'); if (from === undefined) { if (!pair) return; from = to; }
        if (!pair && (from || '') === (to || '')) return;
        var parts = tintParts(b), A, B, HA, HB;
        putAttr(b, 'class', from || null); A = parts.map(tintRead); HA = tintHovers(b); var g0 = behind(b), i0 = rgbOf(getComputedStyle(b).color), bare0 = !A[0].image && seeThrough(A[0].backgroundColor);
        putAttr(b, 'class', to);
        var styleWas = b.getAttribute('style');
        if (pair) { b.style.setProperty('background-color', pair.g, 'important'); b.style.setProperty('color', pair.i, 'important'); }
        B = parts.map(tintRead); HB = tintHovers(b); var g1 = behind(b), i1 = rgbOf(getComputedStyle(b).color), band = bare0 && bandOf(b);
        if (pair) putAttr(b, 'style', styleWas);
        var id = Math.random().toString(36).slice(2, 7), rules = [], own = [], depth = 1;
        for (var up = b.parentElement; up; up = up.parentElement) if (up.hasAttribute('data-tf-tint')) depth++;
        if (pair) rules.push('[data-tf-tint="' + id + '"]{background-color:' + pair.g + '!important;color:' + pair.i + '!important}');
        var mixes = g0 && g1 && i0 && i1 && contrast(g0, i0) >= 2 && contrast(g1, i1) >= 2 /* not a picture ground, and an ink to read a mix from */
            && !(same('rgba(' + [g0.r, g0.g, g0.b, g0.a] + ')') === same('rgba(' + [g1.r, g1.g, g1.b, g1.a] + ')') && same('rgba(' + [i1.r, i1.g, i1.b, i1.a] + ')') === same('rgba(' + [i0.r, i0.g, i0.b, i0.a] + ')')); /* the same pair: nothing to bring along */
        /* a block whose own ink is no ink to read from (a see-through header over the page's green whose words all sit
           on a pill and a button of their own, so it never writes on its ground): nothing in it is a mix of ground and ink
           to carry over, but a part with a ground of its own still keeps the ink made for that ground, so a menu's pill
           does not take the new ink its words were not made for */
        var ownOnly = !mixes && !!pair;
        if (mixes || ownOnly) parts.forEach(function (n, j) {
            if (own.some(function (o) { return o.contains(n); })) return; /* inside a part with its own ground: that part keeps its ink */
            if (n !== b && n.hasAttribute('data-tf-tint')) { own.push(n); return; } /* a part with a Look of its own keeps it: it is its choice, not the page's colours */
            var a = A[j], z = B[j], set = [];
            if (n === b) return; /* the block's own ground and ink are the class's */
            if (ownOnly) {
                if (!(a.image || opaque(a.backgroundColor))) return;
                own.push(n); if (z.color !== a.color) set.push('color:' + a.color + '!important');
                if (set.length) { mark(n, id + '-' + j); rules.push(new Array(depth + 1).join('[data-tf-t~="' + id + '-' + j + '"]') + '{' + set.join(';') + '}'); }
                return;
            }
            /* a part with a ground of its own that the site also shows on the new ground (a label: lime on the green
               sections, green on the light ones) takes the site's own look for it there, where its own would melt into the
               new ground or be worked out from it */
            var ownBg = !a.image && opaque(a.backgroundColor) && rgbOf(a.backgroundColor);
            var kin = ownBg && (contrast(ownBg, g1) < 1.15 || remix(a.backgroundColor, g0, i0, g1, i1)) && kinOn(n, g1, b); /* only where its own would melt in or be worked out */
            if (kin) {
                own.push(n);
                if (same(kin.bg) !== same(z.backgroundColor)) set.push('background-color:' + kin.bg + '!important');
                if (same(kin.ink) !== same(z.color)) set.push('color:' + kin.ink + '!important');
                if (set.length) { mark(n, id + '-' + j); rules.push(new Array(depth + 1).join('[data-tf-t~="' + id + '-' + j + '"]') + '{' + set.join(';') + '}'); }
                return;
            }
            var bgOwn = a.image || opaque(a.backgroundColor) && !remix(a.backgroundColor, g0, i0, g1, i1);
            if (bgOwn) { own.push(n); if (z.color !== a.color) set.push('color:' + a.color + '!important'); }
            if (n.tagName === 'IMG') { var flat = flatInk(n), mf = flat && remix(flat, g0, i0, g1, i1); if (mf && same(mf) !== same(flat)) set = set.concat(paintedIn(n, mf)); }
            for (var k in TINT) {
                if (bgOwn && !/^border/.test(k)) continue; /* its own ground and ink stay; its edge meets the block's ground */
                if (/^border/.test(k) && !a.lines[['borderTopColor', 'borderRightColor', 'borderBottomColor', 'borderLeftColor'].indexOf(k)]) continue;
                if (k === 'webkitTextStrokeColor' && !a.stroke) continue;
                if (z[k] !== a[k]) continue; /* it follows the new ground already */
                var m = remix(a[k], g0, i0, g1, i1);
                if (!m && k === 'color' && n.firstChild && a.under && z.under && same('rgba(' + [z.under.r, z.under.g, z.under.b, z.under.a] + ')') === same('rgba(' + [g1.r, g1.g, g1.b, g1.a] + ')')) {
                    /* words in a colour of their own (an accent) that the new ground swallows, as an accent label on a ground of that accent: they take the new ink, as far off the ground as they stood before */
                    var fg = rgbOf(a[k]), was_ = fg && contrast(blend(fg, a.under), a.under), now_ = fg && contrast(blend(fg, g1), g1);
                    if (fg && was_ >= 3 && now_ < 3) m = towards(Math.min(was_, contrast(i1, g1)), fg.a, g1, i1);
                }
                if (m && m !== a[k]) set.push(TINT[k] + ':' + m + '!important');
            }
            if (set.length) { mark(n, id + '-' + j); rules.push(new Array(depth + 1).join('[data-tf-t~="' + id + '-' + j + '"]') + '{' + set.join(';') + '}'); } /* a Look inside another Look wins over it */
        });
        if (mixes) HA.forEach(function (a, j) {
            var z = HB[j], h = a.h, set = []; if (!z || z.h !== h) return;
            var dec = function (p) { return h.style.getPropertyValue(p) || p === 'background-color' && h.style.getPropertyValue('background'); };
            if (dec('background-color') && opaque(a.backgroundColor)) {
                var m = remix(a.backgroundColor, g0, i0, g1, i1);
                if (m) { if (z.backgroundColor === a.backgroundColor) set.push('background-color:' + m + '!important'); }
                else if (z.color !== a.color) set.push('color:' + a.color + '!important'); /* a hover ground of its own: its ink stays */
            }
            if (dec('color') && z.color === a.color) { var mc = remix(a.color, g0, i0, g1, i1); if (mc && mc !== a.color) set.push('color:' + mc + '!important'); }
            if (dec('border-color') && z.borderTopColor === a.borderTopColor) { var mb = remix(a.borderTopColor, g0, i0, g1, i1); if (mb) set.push('border-color:' + mb + '!important'); }
            if (set.length) rules.push(':is([data-tf-tint="' + id + '"],[data-tf-tint="' + id + '"] *):is(' + h.sel + ',' + h.base + '[data-tf-hover]){' + set.join(';') + '}');
        });
        if (band) rules.push('[data-tf-tint="' + id + '"]{box-shadow:0 0 0 100vw ' + band + '!important;clip-path:inset(0 -100vw)!important}'); /* edge to edge; the room above and below is the page's, per screen size */
        var seen = {}; rules = rules.filter(function (r) { return seen[r] ? false : (seen[r] = true); });
        if (!rules.length) return;
        var st = document.createElement('style'); st.setAttribute('data-tf-tint', ''); st.setAttribute('data-tf-from', from || ''); st.textContent = rules.join('\n');
        if (pair) { st.setAttribute('data-tf-pair', pair.g + '|' + pair.i); if (pair.flip) st.setAttribute('data-tf-flip', ''); }
        b.setAttribute('data-tf-tint', id); b.appendChild(st);
    }
    /* a menu fixed to the top of the window must read over whatever scrolls under it. As the site was made, a see-through
       menu's words were chosen for what passes under it; once colours change here (the page, a section, the menu's own
       Look) its words change and what passes under does not. So from the first colour change on a page, such a menu
       wears glass in its own colour (its Look, else the page's ground): the colour at 85% with a blur, drawn behind its
       words. When that colour is the page's own, the glass comes in over the first 64 px of scroll, so an opening picture
       under the menu stays as the site made it; browsers without scroll timelines show it from the start. A menu with a
       ground of its own as made, or one that scrolls away, is left alone. A rule in the head, not a mark in the menu:
       the menu is the same on every page. */
    function coverGround(doc) {
        if (!doc.head) return;
        var main = doc.querySelector('main') || doc.body, old = doc.head.querySelector('style[data-tf-cover]'), rules = [];
        if (doc.querySelector('[data-tf-tint]')) {
            if (old) old.media = 'not all'; /* read the page without our glass */
            var tall = (doc.defaultView || window).innerHeight, seen = [];
            Array.prototype.forEach.call(doc.querySelectorAll('header,nav,[role="banner"]'), function (n) {
                for (; n && n !== doc.body && n !== doc.documentElement; n = n.parentElement) {
                    var pos = getComputedStyle(n).position; if (pos !== 'fixed' && pos !== 'sticky') continue;
                    if (seen.indexOf(n) >= 0 || n.contains(main)) return; seen.push(n);
                    var r = n.getBoundingClientRect(); if (r.top > 2 || r.height >= tall / 2) return;
                    if (!bareAsMade(n)) return;
                    var cs = getComputedStyle(n), under = behind(n.parentElement), own = cs.backgroundImage === 'none' && opaque(cs.backgroundColor) ? rgbOf(cs.backgroundColor) : null, g = own || under;
                    if (!g) return;
                    var sel = steadySel(n), rgb = [g.r, g.g, g.b].join(',');
                    var sameAs = function (c) { return c && same('rgb(' + rgb + ')') === same('rgb(' + [c.r, c.g, c.b].join(',') + ')'); };
                    var atTop = (doc._tfTop || []).filter(function (x) { return x.top < r.height; }); /* grounds given here that reach under the menu at the page's top */
                    var fades = (!own || sameAs(under)) && atTop.every(function (x) { return sameAs(x.g); });
                    rules.push(sel + '::before{content:"";position:absolute;inset:0;z-index:-1;pointer-events:none;background:rgba(' + rgb + ',.85);-webkit-backdrop-filter:saturate(1.8) blur(20px);backdrop-filter:saturate(1.8) blur(20px)}');
                    if (fades) rules.push('@supports (animation-timeline:scroll()){' + sel + '::before{animation:tf-glass linear both;animation-timeline:scroll(root);animation-range:0 64px}}');
                    return;
                }
            });
            if (rules.some(function (x) { return /tf-glass/.test(x); })) rules.push('@keyframes tf-glass{from{opacity:0}to{opacity:1}}');
            if (old) old.removeAttribute('media');
        }
        var text = rules.join('\n');
        if ((old ? old.textContent : '') === text) return;
        if (old) old.remove();
        if (!text) return;
        var st = doc.createElement('style'); st.setAttribute('data-tf-cover', ''); st.textContent = text; doc.head.appendChild(st);
    }
    /* the free space around the parts given a ground here, worked out again after every change, so the order of the
       changes does not matter: toward a neighbour on the same ground the ground reaches all the way, so no strip of
       the page's ground is left between them (a section and the footer, two light sections); toward anything else
       halfway, up to 64 px for a band, 24 px for a card; with nothing past it, to the page's edge. The neighbour is the next thing on the page above or below,
       in whatever holds it; beside a card, its own siblings. One rule per part in the head, over the one in its tint. */
    /* the room is measured on this screen, and once more on a page laid out out of sight at the other kind of width (a
       phone's, or a computer's when this is a phone): each set is used only at its own screen size. A page measured at
       one size alone keeps its room to that size; elsewhere its grounds keep to their own boxes. */
    var PHONE = 767, roomOther = '', roomTimer = 0;
    function roomsNow(doc, settled) {
        if (!doc.head) return;
        var old = doc.head.querySelector('style[data-tf-room]'), w = (doc.defaultView || window).innerWidth, wide = w > PHONE;
        if (old) old.media = 'not all';
        var mine = roomRules(doc).join('\n'), other = doc === document ? roomOther : '';
        if (old) old.removeAttribute('media');
        var size = function (big) { return '@media (' + (big ? 'min-width:' + (PHONE + 1) : 'max-width:' + PHONE) + 'px)'; };
        var text = (mine ? size(wide) + '{\n' + mine + '\n}' : '') + (mine && other ? '\n' + size(!wide) + '{\n' + other + '\n}' : '');
        if (doc === document && !settled) { clearTimeout(roomTimer); if (mine) roomTimer = setTimeout(function () { otherRoom(wide); }, 700); else roomOther = ''; }
        if ((old ? old.textContent : '') === text) return;
        if (old) old.remove();
        if (!text) return;
        var st = doc.createElement('style'); st.setAttribute('data-tf-room', ''); st.textContent = text; doc.head.appendChild(st);
    }
    function otherRoom(wide) {
        if (locked || previewing) return;
        unseen(quietHtml(), function (d) {
            if (!d) return;
            var was = d.head && d.head.querySelector('style[data-tf-room]'); if (was) was.remove(); /* measured as the site has it, not with the room drawn already */
            var rules = roomRules(d).join('\n'); if (rules === roomOther) return;
            roomOther = rules;
            var notedNow = lastHtml !== null && lastHtml === quietHtml(); /* the room is part of the last change, not a change of its own */
            still(function () { roomsNow(document, true); });
            if (notedNow) lastHtml = quietHtml();
            laterDraft();
        }, function () {}, wide ? 390 : 1280);
    }
    function roomRules(doc) {
        var rules = [], shared = sharedParts(doc); doc._tfTop = [];
        Array.prototype.forEach.call(doc.querySelectorAll('[data-tf-tint]'), function (b) {
            if (b.tagName === 'STYLE' || shared.some(function (p) { return p.contains(b); }) || b.contains(doc.querySelector('main') || doc.body)) return;
            var cs = getComputedStyle(b); if (/^(fixed|sticky)$/.test(cs.position) || cs.backgroundImage !== 'none' || seeThrough(cs.backgroundColor)) return;
            if (!bareAsMade(b, true)) return;
            var band = columnOf(b, true), g = rgbOf(cs.backgroundColor), cap = band ? 64 : 24, r = b.getBoundingClientRect(), o = { t: cap, r: cap, b: cap, l: cap };
            var sameG = function (n) { var v = behind(n); return v && Math.abs(v.r - g.r) + Math.abs(v.g - g.g) + Math.abs(v.b - g.b) < 12; };
            if (band) [['t', -1], ['b', 1]].forEach(function (side) {
                var n = nextOnPage(b, side[1]), w = doc.defaultView || window;
                if (!n) { o[side[0]] = Math.max(0, side[1] > 0 ? doc.documentElement.scrollHeight - (r.bottom + w.scrollY) : r.top + w.scrollY); return; } /* nothing past it: the page's edge */
                var q = n.getBoundingClientRect(), gap = side[1] > 0 ? q.top - r.bottom : r.top - q.bottom; if (gap < 0) { o[side[0]] = 0; return; }
                o[side[0]] = sameG(n) ? gap : Math.min(cap, gap / 2);
            });
            /* room is the air a bare part lacks around its words once it has a colour: a part that draws its own edge (a
               line on any side) is a box already and the colour ends at the line; one with padding of its own needs only
               what that padding lacks of the 24 px */
            if (!band) {
                var sides = ['Top', 'Right', 'Bottom', 'Left'];
                if (sides.some(function (k) { return parseFloat(cs['border' + k + 'Width']) > 0 && !seeThrough(cs['border' + k + 'Color']); })) return;
                sides.forEach(function (k) { o[k.charAt(0).toLowerCase()] = Math.min(o[k.charAt(0).toLowerCase()], Math.max(0, cap - (parseFloat(cs['padding' + k]) || 0))); });
            }
            if (!band) for (var s = b.parentElement && b.parentElement.firstElementChild; s; s = s.nextElementSibling) { /* a card: halfway to its siblings across from it, at most 24 px */
                if (s === b || s.closest('[data-tweakfast]') || /^(SCRIPT|STYLE)$/.test(s.tagName)) continue;
                var q = s.getBoundingClientRect(); if (!q.width || !q.height) continue;
                var acrossX = Math.min(r.right, q.right) - Math.max(r.left, q.left) > 0, acrossY = Math.min(r.bottom, q.bottom) - Math.max(r.top, q.top) > 0;
                if (acrossY && q.right <= r.left + 1) o.l = Math.min(o.l, (r.left - q.right) / 2); else if (acrossY && q.left >= r.right - 1) o.r = Math.min(o.r, (q.left - r.right) / 2);
                if (acrossX && q.bottom <= r.top + 1) o.t = Math.min(o.t, (r.top - q.bottom) / 2); else if (acrossX && q.top >= r.bottom - 1) o.b = Math.min(o.b, (q.top - r.bottom) / 2);
            }
            var par = b.parentElement, ps = par && getComputedStyle(par);
            if (ps && (ps.backgroundImage !== 'none' || !seeThrough(ps.backgroundColor))) { var pr = par.getBoundingClientRect(); o.t = Math.min(o.t, r.top - pr.top); o.b = Math.min(o.b, pr.bottom - r.bottom); o.l = Math.min(o.l, r.left - pr.left); o.r = Math.min(o.r, pr.right - r.right); }
            ['t', 'r', 'b', 'l'].forEach(function (k) { o[k] = Math.max(0, Math.ceil(o[k])); });
            doc._tfTop.push({ top: r.top + (doc.defaultView || window).scrollY - o.t, g: g }); /* where its ground begins on the page */
            var sel = 'html body [data-tf-tint="' + b.getAttribute('data-tf-tint') + '"]', col = cs.backgroundColor;
            if (band) rules.push(sel + '{box-shadow:0 0 0 100vw ' + col + '!important;clip-path:inset(-' + o.t + 'px -100vw -' + o.b + 'px)!important}');
            else { var R = Math.max(o.t, o.r, o.b, o.l); if (R) rules.push(sel + '{box-shadow:0 0 0 ' + R + 'px ' + col + '!important;clip-path:inset(-' + o.t + 'px -' + o.r + 'px -' + o.b + 'px -' + o.l + 'px)!important}'); }
        });
        return rules;
    }
    /* the next part on the page above (-1) or below (1): a sibling, else its holder's, as far up as it takes; only parts
       that are drawn */
    function nextOnPage(b, dir) {
        for (var n = b; n && n !== n.ownerDocument.body; n = n.parentElement) {
            for (var s = dir > 0 ? n.nextElementSibling : n.previousElementSibling; s; s = dir > 0 ? s.nextElementSibling : s.previousElementSibling) {
                if (s.hasAttribute('data-tweakfast') || /^(SCRIPT|STYLE|TEMPLATE)$/.test(s.tagName) || s.classList.contains('tf-plus')) continue;
                var cs = getComputedStyle(s); if (/^(fixed|absolute)$/.test(cs.position)) continue;
                var q = s.getBoundingClientRect(); if (q.width && q.height) return s;
            }
        }
        return null;
    }
    /* a selector for one part that holds when the site's own scripts add things to the page (a cookie bar before the
       header): its id; else its tag and classes when they name it alone; else that, from the nearest holder that has an
       id or a name of its own; the count of children from the top only as the last way */
    function steadySel(n) {
        var doc = n.ownerDocument, esc = function (x) { return window.CSS && CSS.escape ? CSS.escape(x) : x.replace(/([^\w-])/g, '\\$1'); };
        var own = function (x) { if (x.id) return '#' + esc(x.id); var c = Array.prototype.filter.call(x.classList, function (k) { return k.indexOf('tf-') !== 0; }); return x.tagName.toLowerCase() + c.map(function (k) { return '.' + esc(k); }).join(''); };
        var one = function (sel) { try { return doc.querySelectorAll(sel).length === 1 && doc.querySelector(sel) === n; } catch (e) { return false; } };
        if (one(own(n))) return own(n);
        for (var up = n.parentElement; up && up !== doc.body; up = up.parentElement) { var sel = own(up) + ' ' + own(n); if (one(sel)) return sel; }
        return 'body' + pathFrom(doc.body, n).map(function (s) { return '>:nth-child(' + (s.i + 1) + ')'; }).join('');
    }
    /* no background, shadow or line of its own as the site made it: the ground around shows through */
    function openToPage(n) {
        if (!bareAsMade(n, true)) return false;
        var cs = getComputedStyle(n);
        return ['Top', 'Right', 'Bottom', 'Left'].every(function (k) { return !(parseFloat(cs['border' + k + 'Width']) > 0) || seeThrough(cs['border' + k + 'Color']); });
    }
    /* a part as the site made it, before any Look here: no ground of its own, so the page shows through */
    function bareAsMade(n, plain) {
        var st = tintStyle(n), cls = n.getAttribute('class'), from = groundFrom(n);
        if (st) st.media = 'not all';
        if ((from || '') !== (cls || '')) putAttr(n, 'class', from || null);
        var cs = getComputedStyle(n), bare = cs.backgroundImage === 'none' && seeThrough(cs.backgroundColor) && (!plain || cs.boxShadow === 'none' && cs.clipPath === 'none' && !(parseFloat(cs.borderTopLeftRadius) > 0)); /* plain: nor a shadow, a clip or round corners of its own */
        if ((from || '') !== (cls || '')) putAttr(n, 'class', cls);
        if (st) st.removeAttribute('media');
        return bare;
    }
    /* a section laid out as a column in the middle of the page, with no ground of its own, shows the page's ground on
       both sides. Given a ground, it takes it from edge to edge as a band, the way a reader sees a section; its words stay
       in their column. Drawn as a shadow outside its box, so nothing moves. Not when the page around it is itself a
       column on a ground of its own, nor on a part with a shadow or a clip of its own. */
    function bandOf(b) {
        var cs = getComputedStyle(b);
        if (cs.backgroundImage !== 'none' || seeThrough(cs.backgroundColor) || cs.boxShadow !== 'none' || cs.clipPath !== 'none') return null;
        return columnOf(b, true) ? cs.backgroundColor : null;
    }
    /* a big part laid out as a column in the middle of a page that is itself edge to edge; wide: also when this screen
       (a phone) shows the column full width */
    function columnOf(b, wide) {
        if (!b || !isBig(b) || sharedParts(b.ownerDocument).indexOf(b) >= 0) return false;
        var doc = b.ownerDocument, cs = getComputedStyle(b), page = doc.documentElement.clientWidth, w = b.getBoundingClientRect().width; /* the page it is on: a page laid out out of sight has its own width */
        if (w >= page - 1 && !(wide && cs.maxWidth !== 'none')) return false;
        if (w < page / 3) return false; /* a narrow block beside others is not a section */
        for (var n = b.parentElement; n && n !== doc.body && n !== doc.documentElement; n = n.parentElement) {
            var ns = getComputedStyle(n); if (ns.backgroundImage === 'none' && seeThrough(ns.backgroundColor)) continue;
            return n.getBoundingClientRect().width >= page - 1;
        }
        return true;
    }
    function takeLook(t, cls) {
        var was = t.getAttribute('class'), outerWas = cleanOuter(t);
        putAttr(t, 'class', cls);
        steps.push(function () { putAttr(t, 'class', was); });
        refresh(); mirror(t, outerWas); showTools(t);
        once('look', 'It takes that look from this page. Undo brings the old one back.');
    }
    function kinOf(block) {
        var list = [];
        for (var c = block.parentElement.firstElementChild; c; c = c.nextElementSibling) if (c.hasAttribute('data-tf-block')) list.push(c);
        return list;
    }
    /* the block follows the pointer among its kin: when the pointer is over another block of the same
       group, the dragged one takes that place */
    var dragging = false;
    /* a block that changed place slides there from where it was, 150 ms, so the eye follows what happened */
    function slide(el, from, keep, follow) {
        var to = el.getBoundingClientRect(), dx = from.left - to.left, dy = from.top - to.top;
        if (Math.abs(dx) < 1 && Math.abs(dy) < 1) return;
        var until = Date.now() + 170;
        if (el._tfSlide) clearTimeout(el._tfSlide); else { el._tfT0 = el.style.transform; el._tfTr0 = el.style.transition; } /* one memory of its own styles, however many slides overlap */
        el.style.transition = 'none'; el.style.transform = 'translate(' + dx + 'px,' + dy + 'px) ' + keep;
        void el.offsetWidth;
        el.style.transition = slideTime(); el.style.transform = keep;
        if (follow) requestAnimationFrame(function tick() { follow(); if (Date.now() < until) requestAnimationFrame(tick); });
        var done = function () { clearTimeout(el._tfSlide); el._tfSlide = null; transients.splice(transients.indexOf(done), 1); el.style.transition = el._tfTr0; el.style.transform = el._tfT0; if (el.getAttribute('style') === '') el.removeAttribute('style'); };
        transients.push(done); el._tfSlide = setTimeout(done, 170);
    }
    /* styles of ours that live on a block for 170 ms while it slides or settles; finished at once before the page is read */
    var transients = [];
    function finishTransients() { while (transients.length) transients[0](); }
    /* inline styles an earlier build may have left on a page (a Done pressed inside those 170 ms): ours, by their exact values */
    function slideTime() { return motion() === 'auto' ? 'transform 0s ease' : 'transform .15s ease'; }
    var OURS = /^(transition: transform 0(?:\.15)?s(?: ease)?|transform: (?:scale\(1\.015\)|translate\([^)]*\) scale\(1\.015\))|will-change: transform|z-index: 2147482998)$/;
    function scrub(root) {
        var all = root.querySelectorAll('[style]'), i, j;
        for (i = 0; i < all.length; i++) {
            var parts = (all[i].getAttribute('style') || '').split(/;(?![^(]*\))/), kept = []; /* not the ; inside url(data:image/png;base64,…) */
            for (j = 0; j < parts.length; j++) { var d = parts[j].trim(); if (d && !OURS.test(d)) kept.push(d); }
            if (kept.length) all[i].setAttribute('style', kept.join('; ') + ';'); else all[i].removeAttribute('style');
        }
        if (root.getAttribute && root.getAttribute('style') === '') root.removeAttribute('style');
    }
    function startDrag(e, byTouch) {
        if (editing && toolsFor && toolsFor.contains(editing)) commit();
        var b = toolsFor; if (!b || e.button) return;
        if (!byTouch) e.preventDefault();
        var grip = byTouch ? null : e.currentTarget, parent = b.parentElement, prevNext = b.nextElementSibling, order = orderOf(parent), moved = false, parentWas = sharedRootOf(b) ? cleanOuter(parent) : null;
        dragging = true; hoverNone(); document.body.classList.add('tf-dragging'); b.classList.add('tf-moving');
        /* the held block follows the finger: it stays in its slot for the layout, but is drawn where the finger is */
        if (b._tfRestore) b._tfRestore(); /* a settle still under way from the last drag finishes now */
        var r0 = b.getBoundingClientRect(), start = { x: e.clientX, y: e.clientY }, c0 = { x: r0.left + r0.width / 2, y: r0.top + r0.height / 2 }, tx = 0, ty = 0;
        var inline = { transform: b.style.transform, transition: b.style.transition, position: b.style.position, zIndex: b.style.zIndex, willChange: b.style.willChange };
        b.style.transition = 'none'; b.style.willChange = 'transform';
        if (getComputedStyle(b).position === 'static') b.style.position = 'relative';
        b.style.zIndex = '2147482998';
        function follow(pt) {
            var r = b.getBoundingClientRect(), slot = { x: r.left + r.width / 2 - tx, y: r.top + r.height / 2 - ty };
            tx = c0.x + (pt.clientX - start.x) - slot.x; ty = c0.y + (pt.clientY - start.y) - slot.y;
            b.style.transform = 'translate(' + tx + 'px,' + ty + 'px) scale(1.015)';
        }
        function slotRect() { var r = b.getBoundingClientRect(); return { left: r.left - tx, right: r.right - tx, top: r.top - ty, bottom: r.bottom - ty }; }
        placeTools(); /* the line turns solid and lifts at once */
        var anchorWas = document.documentElement.style.overflowAnchor; document.documentElement.style.overflowAnchor = 'none'; /* the browser must not shift the page to keep a block in place after a swap */
        if (grip) grip.setPointerCapture(e.pointerId);
        var last = null, swapAt = 0, swapPt = null;
        function at(ev) {
            if (!dragging) return; /* ended already (the window lost focus): later moves move nothing */
            if (ev.buttons === 0 && ev.pointerType !== 'touch' && !byTouch) { end(); return; } /* the release was missed: no button is held any more */
            last = { clientX: ev.clientX, clientY: ev.clientY };
            edge = ev.clientY < 48 ? -1 : ev.clientY > window.innerHeight - 48 ? 1 : 0;
            if (edge && !scrolling) { scrolling = true; requestAnimationFrame(glide); }
            follow(last); place(last); placeTools();
        }
        function place(ev) {
            /* after a swap, a short moment and a little distance must pass before the next, so nothing can oscillate */
            if (swapPt && (Date.now() - swapAt < 160 || Math.abs(ev.clientX - swapPt.x) + Math.abs(ev.clientY - swapPt.y) < 12)) return;
            var kin = kinOf(b), i, r, own = slotRect();
            /* over the dragged block's own slot nothing happens, so a swap cannot swap straight back */
            if (ev.clientX >= own.left && ev.clientX <= own.right && ev.clientY >= own.top && ev.clientY <= own.bottom) return;
            for (i = 0; i < kin.length; i++) {
                if (kin[i] === b) continue;
                r = kin[i].getBoundingClientRect();
                if (ev.clientX >= r.left && ev.clientX <= r.right && ev.clientY >= r.top && ev.clientY <= r.bottom) {
                    var before = kin.indexOf(kin[i]) < kin.indexOf(b), rowwise = Math.abs(r.top - own.top) > Math.min(r.height, own.height) / 2;
                    /* a little way into the other block, in the direction of travel: enough that a tall block is not a long
                       journey, and the guard above keeps a swap from flipping back */
                    var m = Math.min(40, r.height / 2), mx = Math.min(40, r.width / 2);
                    var past = rowwise ? (before ? ev.clientY <= r.bottom - m : ev.clientY >= r.top + m)
                                       : (before ? ev.clientX <= r.right - mx : ev.clientX >= r.left + mx);
                    if (!past) return;
                    var k = kin.indexOf(b), to = kin.indexOf(kin[i]), step = to > k ? 1 : -1; /* one neighbour at a time, so the spaces between them stay put */
                    for (var at2 = k; at2 !== to; at2 += step) exchange(b, kin[at2 + step]);
                    slide(kin[i], r, ''); follow(ev); /* the other steps aside; the held one stays under the finger */
                    moved = true; swapAt = Date.now(); swapPt = { x: ev.clientX, y: ev.clientY }; placeTools(); return;
                }
            }
        }
        /* near the top or bottom of the window the page glides, a few pixels a frame, instead of jumping with every move */
        var edge = 0, scrolling = false;
        function glide() {
            if (!dragging || !edge) { scrolling = false; return; }
            var y = window.scrollY, max = document.documentElement.scrollHeight - window.innerHeight;
            if ((edge < 0 && y <= 0) || (edge > 0 && y >= max)) { scrolling = false; return; } /* at the end already */
            window.scrollBy({ top: edge * 4, left: 0, behavior: 'instant' }); /* a site's smooth scrolling would turn each step into a stutter */
            if (last) { follow(last); place(last); } placeTools(); /* the page moved under a still pointer */
            requestAnimationFrame(glide);
        }
        function end() {
            if (!dragging) return;
            if (grip) { grip.removeEventListener('pointermove', at); grip.removeEventListener('pointerup', end); grip.removeEventListener('pointercancel', end); grip.removeEventListener('lostpointercapture', end); }
            window.removeEventListener('pointerup', end, true); window.removeEventListener('pointercancel', end, true); window.removeEventListener('blur', end); document.removeEventListener('keydown', escEnd, true);
            try { if (grip) grip.releasePointerCapture(e.pointerId); } catch (err) {}
            skipClick = true; setTimeout(function () { skipClick = false; }, 400); /* the release is not a click on what lies under it */
            dragging = false; edge = 0; document.body.classList.remove('tf-dragging'); document.documentElement.style.overflowAnchor = anchorWas; b.classList.remove('tf-moving'); if (!b.className) b.removeAttribute('class');
            settle();
            if (moved && b.nextElementSibling !== prevNext) { var st = function () { putOrder(parent, order); }; steps.push(st); refresh(); if (parentWas !== null) { busy++; refresh(); setTimeout(function () { busy--; mirror(parent, parentWas, st); refresh(); }, 180); } } /* after the settle, so no animation styles are mirrored */
            placeTools();
        }
        /* on release the block glides from under the finger into its slot, then carries nothing of ours */
        function settle() {
            var until = Date.now() + 170;
            b.style.transition = slideTime(); b.style.transform = inline.transform; /* back to its own transform, animated */
            requestAnimationFrame(function tick() { placeTools(); if (Date.now() < until) requestAnimationFrame(tick); });
            var timer = setTimeout(restore, 170);
            b._tfRestore = restore; transients.push(restore);
            function restore() {
                clearTimeout(timer); b._tfRestore = null; transients.splice(transients.indexOf(restore), 1);
                b.style.transition = inline.transition; b.style.transform = inline.transform; b.style.position = inline.position; b.style.zIndex = inline.zIndex; b.style.willChange = inline.willChange;
                if (b.getAttribute('style') === '') b.removeAttribute('style');
                placeTools();
            }
        }
        function escEnd(ev) { if (ev.key === 'Escape') { putOrder(parent, order); moved = false; end(); } }
        if (grip) { grip.addEventListener('pointermove', at); grip.addEventListener('pointerup', end); grip.addEventListener('pointercancel', end); grip.addEventListener('lostpointercapture', end); }
        if (!byTouch) { window.addEventListener('pointerup', end, true); window.addEventListener('pointercancel', end, true); }
        window.addEventListener('blur', end); document.addEventListener('keydown', escEnd, true);
        return { at: at, end: end };
    }
    /* on a phone, holding a block lifts it: half a second still, then it is carried by the finger, the way things are
       moved by hand on a phone's home screen. A tap or a scroll that starts sooner is left alone. */
    function longPress() {
        var timer = 0, b = null, x0 = 0, y0 = 0, drive = null;
        document.addEventListener('touchstart', function (e) {
            if (e.touches.length !== 1) { if (timer || drive) done(); return; } /* a second finger: a pinch, never a lift */
            if (editing || locked || dragging || previewing) return;
            var t = e.touches[0], target = e.target;
            b = (target.nodeType === 1 ? target : target.parentElement); b = b && !b.closest('[data-tweakfast]') ? blockTarget(b) : null;
            if (!b) return;
            x0 = t.clientX; y0 = t.clientY;
            b.style.webkitUserSelect = 'none'; b.style.webkitTouchCallout = 'none'; /* no selection or callout while held */
            clearTimeout(timer);
            timer = setTimeout(function () {
                timer = 0; if (!b) return;
                showTools(b);
                drive = startDrag({ clientX: x0, clientY: y0, button: 0, pointerType: 'touch' }, true) || null;
            }, 500);
        }, { passive: true });
        document.addEventListener('touchmove', function (e) {
            if (drive) { var t = e.touches[0]; e.preventDefault(); drive.at({ clientX: t.clientX, clientY: t.clientY, buttons: 1, pointerType: 'touch' }); return; }
            if (timer && e.touches.length > 1) { done(); return; }
            if (timer && e.touches.length === 1) { var m = e.touches[0]; if (Math.abs(m.clientX - x0) + Math.abs(m.clientY - y0) > 10) { clearTimeout(timer); timer = 0; release(); } } /* a scroll, not a hold */
        }, { passive: false });
        function done() { clearTimeout(timer); timer = 0; if (drive) { drive.end(); drive = null; } release(); }
        function release() { if (b) { b.style.webkitUserSelect = ''; b.style.webkitTouchCallout = ''; if (b.getAttribute('style') === '') b.removeAttribute('style'); b = null; } }
        document.addEventListener('touchend', done, { passive: true }); document.addEventListener('touchcancel', done, { passive: true });
    }
    var skipClick = false;
    function move(dir) {
        if (editing && toolsFor && toolsFor.contains(editing)) commit(); /* typed words are kept before the block acts */
        var b = toolsFor; if (!b) return;
        var kin = kinOf(b), i = kin.indexOf(b), j = i + dir;
        if (j < 0 || j >= kin.length) { say(dir < 0 ? 'Already at the top.' : 'Already at the bottom.'); return; }
        var parent = b.parentElement, order = orderOf(parent), parentWas = cleanOuter(parent);
        exchange(b, kin[j]); /* the two trade places; what lies between them (the space between two buttons) stays between */
        steps.push(function () { putOrder(parent, order); });
        refresh();
        mirror(parent, parentWas);
        b.scrollIntoView({ block: 'nearest', behavior: motion() });
        showTools(b);
    }
    function exchange(a, c) { var m = document.createComment(''); a.parentNode.replaceChild(m, a); c.parentNode.replaceChild(a, c); m.parentNode.replaceChild(c, m); }
    function orderOf(parent) { return Array.prototype.slice.call(parent.childNodes); }
    function putOrder(parent, order) { order.forEach(function (n) { parent.appendChild(n); }); }
    function toggleHidden() {
        if (editing && toolsFor && toolsFor.contains(editing)) commit(); /* typed words are kept before the block acts */
        var b = toolsFor; if (!b) return;
        var wasHidden = b.hasAttribute('data-tf-hidden'), parentWas = cleanOuter(b.parentElement);
        setHidden(b, !wasHidden);
        steps.push(function () { setHidden(b, wasHidden); });
        refresh();
        showTools(b);
        mirror(b.parentElement, parentWas);
        if (!wasHidden) once('hide', 'Hidden. Readers will not see it; it is kept here, faded, until you show it again.');
    }
    /* Remove takes the block out at once: no faded ghost; Undo brings it back, after Done the page's versions do */
    function removeBlock() {
        if (editing && toolsFor && toolsFor.contains(editing)) commit(); /* typed words are kept before the block acts */
        var b = toolsFor; if (!b) return;
        if (b.parentElement.querySelector(':scope > .tf-plus') && kinOf(b).length < 2) { say('This is the last one, and the plus makes more from it. Hide it instead.', 'error'); return; }
        var parent = b.parentNode, next = b.nextElementSibling, parentWas = cleanOuter(parent);
        hideTools();
        b.remove();
        steps.push(function () { parent.insertBefore(b, next && next.parentNode === parent ? next : null); });
        refresh();
        mirror(parent, parentWas); /* in a footer, gone from every page */
        once('remove', 'Removed. Undo brings it back; after Done, the page\u2019s versions under Site do.');
    }
    /* a hidden block, here: only marked, so it keeps its own shape (a list item, a table row, a grid card) and shows faded.
       In the saved page it is hidden for readers: the hidden attribute and display none, which beats a site's own display
       rule; a display the block had in its own style waits in data-tf-display and comes back when it is shown again. */
    function setHidden(b, on) { if (on) b.setAttribute('data-tf-hidden', ''); else b.removeAttribute('data-tf-hidden'); }
    var HIDDEN = '[data-tf-hidden]:not(nav a)';
    function savedHidden(root) {
        var all = Array.prototype.slice.call(root.querySelectorAll(HIDDEN)); if (root.matches && root.matches(HIDDEN)) all.push(root);
        all.forEach(function (n) {
            if (n.hasAttribute('hidden')) return;
            var d = n.style.display; if (d && d !== 'none') n.setAttribute('data-tf-display', d);
            n.setAttribute('hidden', ''); n.style.display = 'none';
        });
    }
    function liveHidden(root) {
        var all = Array.prototype.slice.call(root.querySelectorAll('[hidden]')); if (root.matches && root.matches('[hidden]')) all.push(root);
        all.forEach(function (n) {
            if (!n.matches(HIDDEN)) return;
            n.removeAttribute('hidden'); n.style.display = n.getAttribute('data-tf-display') || ''; n.removeAttribute('data-tf-display');
            if (n.getAttribute('style') === '') n.removeAttribute('style');
        });
    }
    function copyBlock() {
        if (editing && toolsFor && toolsFor.contains(editing)) commit(); /* typed words are kept before the block acts */
        var b = toolsFor; if (!b) return;
        if (isButton(b)) { copyButton(b); return; }
        var twin = makeTwin(b), parentWas = cleanOuter(b.parentElement);
        b.parentElement.insertBefore(twin, b.nextSibling); frameTwin(b, twin);
        var back = rowRoom(b.parentElement);
        steps.push(function () { unTwin(twin); if (back) back(); });
        mirror(b.parentElement, parentWas);
        refresh();
        showTools(twin);
        twin.scrollIntoView({ block: 'nearest', behavior: motion() });
        once('copy', 'A copy, with placeholders. Click each to fill it in.');
    }

    /* a second button: its own words to type at once, the same address until the owner changes it under Goes to.
       Where the site already pairs a button with a second, quieter one, the copy takes that look. */
    function copyButton(b) {
        var twin = b.cloneNode(true), parent = b.parentElement, parentWas = cleanOuter(parent), texts = [], t;
        twin.removeAttribute('id'); twin.removeAttribute('data-tf-hidden'); twin.classList.remove('tf-hover');
        var walk = document.createTreeWalker(twin, NodeFilter.SHOW_TEXT);
        while ((t = walk.nextNode())) if (t.nodeValue.trim()) texts.push(t);
        texts.forEach(function (t, i) { t.nodeValue = i ? '' : (b.tagName === 'A' ? 'Link' : 'Button'); }); /* icons inside stay */
        var look = secondLook(b); if (look !== null) { if (look) twin.className = look; else twin.removeAttribute('class'); }
        var gap = document.createTextNode(' ');
        parent.insertBefore(gap, b.nextSibling); parent.insertBefore(twin, gap.nextSibling);
        var back = buttonRow(parent, b);
        /* buttons in running text with other things beside them: one space is too tight between two, so a few more,
           between them, so the gap stays between whichever way they are moved later */
        if (!back && !/flex|grid/.test(getComputedStyle(parent).display) && sameRow(b, twin) && Math.abs(twin.getBoundingClientRect().left - b.getBoundingClientRect().right) < 12) gap.nodeValue = '\u00a0\u00a0\u00a0 ';
        if (twin.getAttribute('style') === '') twin.removeAttribute('style');
        newButtons.push({ el: twin, word: b.tagName === 'A' ? 'Link' : 'Button' });
        steps.push(function () { twin.remove(); gap.remove(); if (back) back(); });
        mirror(parent, parentWas);
        refresh();
        showTools(twin);
        var words = firstText(twin); if (words) begin(words); /* the words open at once, and Goes to with them */
        once('copybutton', 'A new button. Type its words; Goes to sets where it leads.');
    }
    /* a box holding only buttons becomes a row that wraps, with the same space between lines as between buttons, so a
       button that runs onto a new line never lands on the one above. The space is the one the site already puts between
       its buttons; without one, a quarter of the button's height. A row the site laid out wraps as it was made, and only
       gets the space between lines when it has none. Gives back what puts the box as it was, or null. */
    var newButtons = []; /* buttons added in this visit, with the word they came with: Done says which still have it */
    function buttonRow(box, b) {
        for (var c = box.firstElementChild; c; c = c.nextElementSibling) if (!c.hasAttribute('data-tweakfast') && !isButton(c)) return null;
        var cs = getComputedStyle(box), styleWas = box.getAttribute('style'), texts = [];
        var restore = function () { if (styleWas === null) box.removeAttribute('style'); else box.setAttribute('style', styleWas); texts.forEach(function (t) { t.n.nodeValue = t.was; }); };
        if (/flex|grid/.test(cs.display)) {
            if (cs.display.indexOf('flex') >= 0 && cs.flexWrap === 'nowrap' || parseFloat(cs.rowGap) > 0) return null;
            box.style.rowGap = (parseFloat(cs.columnGap) > 0 ? cs.columnGap : siteGap(b) + 'px');
            return restore;
        }
        for (var n = box.firstChild; n; n = n.nextSibling) if (n.nodeType === 3 && n.nodeValue !== ' ') { texts.push({ n: n, was: n.nodeValue }); n.nodeValue = ' '; } /* spaces made wider earlier would stand as a word of their own in the row */
        var align = cs.textAlign;
        box.style.display = cs.display.indexOf('inline') === 0 ? 'inline-flex' : 'flex';
        box.style.flexWrap = 'wrap'; box.style.alignItems = 'center'; box.style.gap = siteGap(b) + 'px';
        if (align === 'center') box.style.justifyContent = 'center';
        else if (align === 'right' || align === 'end' && cs.direction !== 'rtl') box.style.justifyContent = 'flex-end';
        return restore;
    }
    /* a row of cards laid out side by side, made for one line: when a new one runs onto a second line, the lines get the
       same space between them as the cards have side by side, so it never sits right under the one above. Only where the
       site put none; gives back what puts the row as it was, or null. */
    function rowRoom(box) {
        var cs = getComputedStyle(box);
        if (!/flex|grid/.test(cs.display) || parseFloat(cs.rowGap) > 0 || !(parseFloat(cs.columnGap) > 0) || box.hasAttribute('data-tf-rows')) return null;
        var seen = Array.prototype.filter.call(box.children, function (c) { return !c.hasAttribute('data-tweakfast') && c.getClientRects().length; });
        if (seen.length < 2 || seen[seen.length - 1].getBoundingClientRect().top < seen[0].getBoundingClientRect().bottom - 1) return null; /* still one line */
        var id = 'r' + Math.random().toString(36).slice(2, 8), rules = rowRules(box, id);
        if (!rules.length) return null;
        var st = rowStyle(id, rules);
        box.setAttribute('data-tf-rows', id);
        return function () { st.remove(); box.removeAttribute('data-tf-rows'); };
    }
    /* the site's own rules for the row, in their order and at their widths: where one sets the space between lines, that
       space; where one sets only the space side by side, the same between lines. So a phone layout with one card a line
       keeps its own spacing, and the space grows and shrinks with the page as the site's does */
    function rowRules(box, id) {
        var rules = [];
        var walk = function (list, media) {
            Array.prototype.forEach.call(list, function (r) {
                if (r.cssRules && r.media) { walk(r.cssRules, media.concat(r.media.mediaText)); return; }
                if (!r.selectorText || !r.style) return;
                try { if (!box.matches(r.selectorText)) return; } catch (e) { return; }
                var v = r.style.getPropertyValue('row-gap') || r.style.getPropertyValue('column-gap'); if (!v) return;
                var rule = '[data-tf-rows="' + id + '"]{row-gap:' + v + '}';
                rules.push(media.reduce(function (inner, m) { return '@media ' + m + '{' + inner + '}'; }, rule));
            });
        };
        Array.prototype.forEach.call(document.styleSheets, function (sh) { if (sh.ownerNode && sh.ownerNode.closest && sh.ownerNode.closest('[data-tweakfast],[data-tf-rows]')) return; try { walk(sh.cssRules, []); } catch (e) {} });
        return rules;
    }
    function rowStyle(id, rules) { /* in the head: a style inside the row would count as one of its children */
        var st = document.createElement('style'); st.setAttribute('data-tf-rows', id); st.textContent = rules.join('\n');
        document.head.appendChild(st); return st;
    }
    /* a row marked for its space between lines whose rule is missing gets it again: a draft brought back and a Redo put
       the page's body back without the head, so the copied card sat right under the one above until Done and a reload */
    function mendRows() {
        var sheets = Array.prototype.slice.call(document.querySelectorAll('style[data-tf-rows]')), worn = [];
        Array.prototype.forEach.call(document.querySelectorAll('[data-tf-rows]'), function (box) {
            var id = box.getAttribute('data-tf-rows'); if (box.tagName === 'STYLE' || !id) return;
            worn.push(id);
            if (sheets.some(function (s) { return s.textContent.indexOf('"' + id + '"') >= 0; })) return;
            var rules = rowRules(box, id); if (rules.length) rowStyle(id, rules); else box.removeAttribute('data-tf-rows');
        });
        sheets.forEach(function (s) { if (!worn.some(function (id) { return s.textContent.indexOf('"' + id + '"') >= 0; })) s.remove(); }); /* a rule no row wears any more (an Undo took the row back) goes, so Done does not save it */
    }
    /* ---- the ids of a copy ----
       A site often styles a part by its id (#team { padding-top: … }) or names it from elsewhere in the part (a heading
       the section is labelled by, a label's for, a link to #faq-3). A copy cannot carry the same id twice, and without it
       such a rule or reference is lost: the copy of a section sat with no top padding. So an id that a rule or a
       reference inside the copy depends on lives on under a fresh name (team-2): the references inside follow, and the
       site's rules naming it are written again for the new name, only those, at their widths, in one style in the head,
       which the saved page keeps. An id nothing depends on goes, as before. */
    var REFS = ['aria-labelledby', 'aria-describedby', 'aria-controls', 'aria-owns', 'for', 'href'];
    function idRe(id, all) { return new RegExp('#' + id.replace(/[^\w-]/g, '\\$&') + '(?![\\w-])', all ? 'g' : ''); }
    /* the site's sheets, ours left out (a copy's own rules count: a copy of a copy reads them) */
    function siteSheets() { return Array.prototype.filter.call(document.styleSheets, function (sh) { return !(sh.ownerNode && sh.ownerNode.closest && sh.ownerNode.closest('[data-tweakfast]')); }); }
    function eachRule(fn) {
        var walk = function (list, media) {
            Array.prototype.forEach.call(list, function (r) {
                if (r.media && r.cssRules) { walk(r.cssRules, media.concat(r.media.mediaText)); return; }
                if (r.selectorText && r.style) fn(r, media);
                else if (r.cssRules) walk(r.cssRules, media); /* @supports, @layer */
            });
        };
        siteSheets().forEach(function (sh) { try { walk(sh.cssRules, []); } catch (e) {} });
    }
    /* every selector of the site in one text: whether a rule names #id is one test */
    function selectorsText() { var out = []; eachRule(function (r) { out.push(r.selectorText); }); return out.join('\n'); }
    function idNamed(id, text) { return idRe(id).test(text === undefined ? selectorsText() : text); }
    /* the site's rules naming #id, written for #to: only the selectors that name it, at their widths */
    function idRules(id, to) {
        var re = idRe(id), all = idRe(id, true), rules = [];
        eachRule(function (r, media) {
            if (!re.test(r.selectorText)) return;
            var sel = r.selectorText.split(/,(?![^(]*\))/).filter(function (x) { return re.test(x); }).map(function (x) { return x.trim().replace(all, '#' + to); });
            if (!sel.length || !r.style.cssText) return;
            rules.push(media.reduce(function (inner, m) { return '@media ' + m + '{' + inner + '}'; }, sel.join(',') + '{' + r.style.cssText + '}'));
        });
        return rules;
    }
    function idStyle(id, rules, doc) {
        var st = (doc || document).createElement('style'); st.setAttribute('data-tf-id', id); st.textContent = rules.join('\n');
        (doc || document).head.appendChild(st); return st;
    }
    function freshIds(twin, doc) {
        doc = doc || document;
        var text = selectorsText(), refSel = REFS.map(function (a) { return '[' + a + ']'; }).join(','), refs = (twin.matches(refSel) ? [twin] : []).concat(Array.prototype.slice.call(twin.querySelectorAll(refSel))); /* the copy itself may be labelled by a heading inside */
        var named = [twin].concat(Array.prototype.slice.call(twin.querySelectorAll('[id]'))).filter(function (n) { return n.id; });
        twin._tfSheets = [];
        named.forEach(function (n) {
            var id = n.id;
            var refd = Array.prototype.some.call(refs, function (r) { return REFS.some(function (a) { var v = r.getAttribute(a); return !!v && (a === 'href' ? v === '#' + id : v.split(/\s+/).indexOf(id) >= 0); }); });
            if (!refd && !idNamed(id, text)) { n.removeAttribute('id'); return; }
            var base = id.replace(/-\d+$/, ''), k = 2, to;
            while (doc.getElementById(to = base + '-' + k) || document.getElementById(to) || idNamed(to, text)) k++; /* no element, no rule of the site's own by that name */
            n.id = to;
            Array.prototype.forEach.call(refs, function (r) { REFS.forEach(function (a) { var v = r.getAttribute(a); if (!v) return; if (a === 'href') { if (v === '#' + id) r.setAttribute(a, '#' + to); } else if (v.split(/\s+/).indexOf(id) >= 0) r.setAttribute(a, v.split(/\s+/).map(function (w) { return w === id ? to : w; }).join(' ')); }); });
            var rules = idRules(id, to); if (rules.length) twin._tfSheets.push(idStyle(to, rules, doc));
        });
    }
    /* a copy taken back by Undo takes its rules with it */
    function unTwin(twin) { twin.remove(); (twin._tfSheets || []).forEach(function (st) { st.remove(); }); }
    /* a copy keeps the frame of its original, the way its pictures do: placeholder words are shorter than the words they
       stand for, and a box laid out by its words would come out lower, squeezing what the site draws from the box's size
       (a shape of 50% width and height, a picture that covers). So a copy that comes out lower than its original keeps
       the original's height as its least, on wide screens, where the original's height was measured; longer words
       grow it as they would the original, and a phone lays it out by its words as always */
    function frameTwin(block, twin) {
        var was = block.getBoundingClientRect().height, now = twin.getBoundingClientRect().height;
        if (!(was > now + 2) || /^(fixed|sticky|absolute)$/.test(getComputedStyle(twin).position)) return;
        var id = Math.random().toString(36).slice(2, 7), st = document.createElement('style');
        st.setAttribute('data-tf-frame', ''); st.textContent = '@media (min-width:' + (PHONE + 1) + 'px){[data-tf-frame="' + id + '"]{min-height:' + Math.ceil(was) + 'px}}';
        twin.setAttribute('data-tf-frame', id); twin.appendChild(st);
    }
    /* a copy whose rules are missing gets them again (a draft brought back and a Redo put the body back without the
       head): the copy wears base-N, the site has #base with rules and no rule for #base-N. A rule no copy wears goes. */
    function mendIds() {
        var sheets = Array.prototype.slice.call(document.querySelectorAll('style[data-tf-id]')), worn = [], text = selectorsText();
        Array.prototype.forEach.call(document.querySelectorAll('[id]'), function (n) {
            var id = n.id, m = /^(.+)-(\d+)$/.exec(id); if (!m || n.closest('[data-tweakfast]')) return;
            if (sheets.some(function (s) { return s.getAttribute('data-tf-id') === id; })) { worn.push(id); return; }
            var model = document.getElementById(m[1]);
            if (!model || model.tagName !== n.tagName || (model.getAttribute('class') || '') !== (n.getAttribute('class') || '') || idNamed(id, text) || !idNamed(m[1], text)) return;
            var rules = idRules(m[1], id); if (rules.length) { idStyle(id, rules); worn.push(id); }
        });
        sheets.forEach(function (s) { if (worn.indexOf(s.getAttribute('data-tf-id')) < 0) s.remove(); });
    }
    function siteGap(b) {
        var all = document.querySelectorAll('body *');
        for (var i = 0; i < all.length; i++) {
            var n = all[i], cs;
            if (n.childElementCount < 2 || n.closest('[data-tweakfast]') || !isButton(n.firstElementChild) || !isButton(n.firstElementChild.nextElementSibling)) continue;
            cs = getComputedStyle(n); if (/flex|grid/.test(cs.display) && parseFloat(cs.columnGap) > 0 && n.style.gap === '') return Math.round(parseFloat(cs.columnGap));
        }
        return Math.round(Math.min(24, Math.max(8, b.getBoundingClientRect().height / 4)));
    }
    function stillPlaceholder() {
        newButtons = newButtons.filter(function (x) { return document.contains(x.el); });
        return newButtons.filter(function (x) { return !x.el.hasAttribute('data-tf-hidden') && x.el.textContent.trim() === x.word; });
    }
    function secondLook(b) {
        var sig = signature(b), all = document.querySelectorAll('[data-tf-block]');
        for (var i = 0; i < all.length; i++) {
            var n = all[i], p = n.previousElementSibling;
            while (p && p.hasAttribute('data-tweakfast')) p = p.previousElementSibling;
            if (n !== b && p && n.tagName === b.tagName && signature(p) === sig && signature(n) !== sig && isButton(n) && isButton(p)) return Array.prototype.filter.call(n.classList, function (c) { return c.indexOf('tf-') !== 0; }).join(' ');
        }
        return null;
    }

    /* ---- pages ---- */
    var changes = {};          /* other pages that Done must write: path -> html */
    var freshPages = {};       /* pages added in this visit and not saved yet: they cannot be opened before Done */
    var saver = null;          /* '/api/save' when the site has the saving route */
    var saverKnown = false;    /* whether the site has answered that yet */
    var noRoute = false;       /* the site answered, and has no saving route: Done saves files */
    var demo = false;          /* a public demo: Done shows the change to this visitor only, nothing is written */
    function findSaver(then) {
        fetch('/api/save', { cache: 'no-store' }).then(function (r) { return r.ok ? r.json().catch(function () { return null; }) : (r.status === 404 || r.status === 405 ? null : Promise.reject()); }).then(function (j) {
            if (j && j.tweakfast === 'save') { saver = '/api/save'; noRoute = false; if (panel) renderPages(); if (!then) checkKey(); }
            else noRoute = true;
            saverKnown = true;
            if (then) then();
        }, function () { saverKnown = true; if (then) then(); });
    }
    /* a wrong or old link is told on arrival, not after twenty minutes of edits */
    function checkKey() {
        fetch('/api/check', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ key: key }), cache: 'no-store' }).then(function (r) {
            if (r.status === 403) r.json().then(function (j) { lock(j && j.message); }, function () { lock(); });
            else if (r.status === 503) r.json().then(function (j) { if (j && /not set up/i.test(j.message || '')) lock(j.message + ' Ask the person who set up the site.'); }, function () {}); /* no key stored on the site: nothing could be saved */
            else if (r.ok) r.json().then(function (j) {
                if (j && j.demo) { demo = true; try { localStorage.setItem('tweakfast:demo', '1'); } catch (e) {} forgetDraft(); if (card) { fade(card); card = null; placeNote(); } } /* "Bookmark this page" is not true of a demo */
                else { try { localStorage.removeItem('tweakfast:demo'); } catch (e) {} }
            }, function () {});
        }, function () {});
    }
    var panel = null;
    function here() { return location.pathname.split('/').pop() || 'index.html'; }
    function menuOf(root) {
        var navs = root.querySelectorAll('header nav, nav');
        for (var i = 0; i < navs.length; i++) if (navs[i].querySelector('a[href]')) return navs[i];
        return null;
    }
    function isPageLink(a) { var h = a.getAttribute('href') || ''; return /^[\w-]+\.html$/.test(h) || h === './' || h === '/'; }
    function pathOf(a) { var h = a.getAttribute('href'); return (h === './' || h === '/') ? 'index.html' : h; }
    /* the menu proper: the page links in the group that holds most of them; a logo link elsewhere in the nav, or a
       first link to a page that the menu lists again later, is not a menu entry. Everything that renames, hides,
       orders or removes a page touches these links only, so a logo never moves or changes its words. */
    function menuLinks(nav) {
        var all = nav.querySelectorAll('a[href]'), groups = [], best = null, i;
        for (i = 0; i < all.length; i++) if (isPageLink(all[i])) {
            var parent = entryOf(all[i]).parentElement, g = null;
            for (var k = 0; k < groups.length; k++) if (groups[k].parent === parent) g = groups[k];
            if (!g) { g = { parent: parent, links: [] }; groups.push(g); }
            g.links.push(all[i]);
            if (!best || g.links.length > best.links.length) best = g;
        }
        if (!best) return [];
        var out = [], paths = best.links.map(pathOf);
        for (i = 0; i < best.links.length; i++) if (paths.indexOf(paths[i], i + 1) < 0) out.push(best.links[i]); /* the same page again later: this one is the logo */
        return out;
    }
    /* a menu entry: the link, or the list item that holds it */
    function entryOf(a) { return a.parentElement && a.parentElement.tagName === 'LI' ? a.parentElement : a; }
    /* the menu's entries that are words: a logo's letter or picture alone is no menu to add to */
    function menuEntries(nav) { return nav ? menuLinks(nav).filter(function (a) { return a.textContent.replace(/\s+/g, '').length > 2; }) : []; }
    /* a new entry is a twin of the menu's own: the same wrapper and look, its words and address new, never marked as
       the page being read. Placed after the last entry, with the same spacing the menu has between its entries. */
    function addEntry(nav, d, path, name, current) {
        var list = menuEntries(nav); if (!list.length) return false;
        var plain = list.filter(function (a) { return !a.hasAttribute('aria-current') && !a.hasAttribute('data-tf-hidden') && !/\b(active|current|selected|is-active)\b/i.test((a.getAttribute('class') || '') + ' ' + (entryOf(a).getAttribute('class') || '')); });
        var model = (plain.length ? plain : list)[(plain.length ? plain : list).length - 1], last = entryOf(list[list.length - 1]);
        var twin = entryOf(model).cloneNode(true), a = twin.tagName === 'A' ? twin : twin.querySelector('a[href]');
        [twin].concat(Array.prototype.slice.call(twin.querySelectorAll('*'))).forEach(function (n) {
            n.removeAttribute('id'); n.removeAttribute('aria-current'); n.removeAttribute('data-tf-hidden'); n.removeAttribute('hidden');
            if (n.getAttribute('style')) n.style.removeProperty('display');
            var c = n.getAttribute('class'); if (c) putAttr(n, 'class', c.split(/\s+/).filter(function (k) { return !/^(active|current|selected|is-active)$/i.test(k); }).join(' '));
        });
        a.setAttribute('href', path);
        var texts = [], walk = d.createTreeWalker(a, 4), t; while ((t = walk.nextNode())) if (t.nodeValue.trim()) texts.push(t);
        /* the words take the name; an icon or a mark beside them (no letters) stays */
        var letters = function (n) { return (n.nodeValue.match(/[\p{L}\p{N}]/gu) || []).length; }, words = texts.filter(letters).sort(function (x, y) { return letters(y) - letters(x); });
        if (words.length) { words[0].nodeValue = words[0].nodeValue.replace(/\S[\s\S]*\S|\S/, name); words.slice(1).forEach(function (n) { n.nodeValue = ''; }); } else a.appendChild(d.createTextNode(name));
        if (current) a.setAttribute('aria-current', 'page');
        var gap = last.previousSibling && last.previousSibling.nodeType === 3 && !last.previousSibling.nodeValue.trim() ? last.previousSibling.nodeValue : '';
        last.parentNode.insertBefore(twin, last.nextSibling); if (gap) last.parentNode.insertBefore(d.createTextNode(gap), twin);
        return true;
    }
    function homePath() {
        var nav = menuOf(document);
        if (nav) {
            var menu = menuLinks(nav), all = nav.querySelectorAll('a[href]');
            for (var i = 0; i < all.length; i++) if (isPageLink(all[i]) && menu.indexOf(all[i]) < 0) return pathOf(all[i]); /* the logo's page */
        }
        var logo = document.querySelector('header a[href]');
        return logo && isPageLink(logo) ? pathOf(logo) : 'index.html';
    }
    /* a page's name is its link's words; a logo's letter or picture is no name: its label, else Home or the file's name */
    function pageName(a) {
        var t = a.textContent.replace(/\s+/g, ' ').trim(); if (t.length > 2) return t;
        var l = (a.getAttribute('aria-label') || a.getAttribute('title') || '').trim(); if (l.length > 2) return l;
        var p = pathOf(a).split(/[?#]/)[0].replace(/\/$/, '').split('/').pop().replace(/\.html?$/, '');
        if (!p || p === 'index') return 'Home';
        p = p.replace(/[-_]+/g, ' '); return p.charAt(0).toUpperCase() + p.slice(1);
    }
    function pageList() {
        var nav = menuOf(document), list = [];
        if (!nav) return list;
        menuLinks(nav).forEach(function (a) { list.push({ path: pathOf(a), name: pageName(a), hidden: a.hasAttribute('data-tf-hidden'), link: a }); });
        return list;
    }
    /* every page of the site, not only the menu's: a site without a menu (a portfolio, a landing page) links its pages
       from its words. Found once, when first asked for: the pages the menu names, each page any of them links to, as far
       as the links go, and the pages saved here. Until then (and on a site that cannot be read) the menu's alone. */
    var found = null, finding = false;
    function findPages() {
        if (found || finding || !saverKnown) return; finding = true; /* the saved pages are asked for once the site says it saves; asked earlier, they would be missed for good */
        var seen = [here()], queue = [], all = [here()];
        var add = function (p) { if (p && seen.indexOf(p) < 0 && seen.length < 60) { seen.push(p); queue.push(p); } };
        var linksIn = function (doc) { Array.prototype.forEach.call(doc.querySelectorAll('a[href]'), function (a) { if (isPageLink(a) && !a.closest('[data-tweakfast]')) add(pathOf(a)); }); };
        pageList().forEach(function (pg) { add(pg.path); });
        linksIn(document);
        var end = function () { finding = false; found = all; if (panel && view.kind === 'pages') renderPages(); if (pagesBtn) pageLabel(); };
        var running = 0, crawl = function () { /* four at a time */
            while (running < 4 && queue.length) (function (path) {
                running++;
                loadPage(path, function (html) { running--; if (html !== null) { all.push(path); linksIn(parse(html)); } crawl(); });
            })(queue.shift());
            if (!running && !queue.length) end();
        };
        if (!saver) { crawl(); return; }
        fetch('/api/pages', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ key: key }) })
            .then(function (r) { return r.ok ? r.json() : null; }, function () { return null; })
            .then(function (j) { ((j && j.pages) || []).forEach(function (pg) { if (/^[\w-]+\.html$/.test(pg.path)) add(pg.path); }); crawl(); });
    }
    /* the pages outside the menu: found ones, those added here, and this one when the menu does not name it */
    function otherList() {
        var menu = pageList().map(function (pg) { return pg.path; }), paths = (found || [here()]).slice();
        Object.keys(changes).forEach(function (p) { if (paths.indexOf(p) < 0) paths.push(p); });
        return paths.filter(function (p) { return menu.indexOf(p) < 0 && !drops[p]; }).sort().map(function (p) {
            var title = freshPages[p] && changes[p] ? (parse(changes[p]).title || '').trim() : '';
            return { path: p, name: title || fileName(p), fresh: !!freshPages[p], other: true };
        });
    }
    function fileName(p) {
        p = p.replace(/\.html?$/, ''); if (!p || p === 'index') return 'Home';
        p = p.replace(/[-_]+/g, ' '); return p.charAt(0).toUpperCase() + p.slice(1);
    }
    /* the sheet shows one view at a time: the pages, or one page's words for Google, its versions, or Add a page */
    var view = { kind: 'pages' }, menu = null;
    /* a floating piece leaves: a short fade, then the node goes; the state says it is gone at once */
    function fade(n) {
        if (!n || !n.parentNode) return;
        var done = function () { clearTimeout(t); n.remove(); }, t = setTimeout(done, 200);
        n.classList.add('tf-out'); n.addEventListener('animationend', done, { once: true });
    }
    function openView(v) { var back = view && view.kind !== 'pages' && v.kind === 'pages'; view = v; if (panel) renderPages(back ? 'back' : 'forward'); }
    /* More on a row: a small menu under the button; a click elsewhere, Esc or a scroll takes it away */
    function openMenu(anchor, items, row, opts) {
        var back = document.activeElement; opts = opts || {};
        closeMenu();
        menu = el('div', 'tf-menu'); menu.back = back; menu.setAttribute('data-tweakfast', ''); menu.setAttribute('role', 'menu');
        items.forEach(function (it) {
            if (it === 'gap') { menu.appendChild(el('div', 'tf-gap')); return; }
            if (it.note) { menu.appendChild(el('div', 'tf-note', it.note)); return; }
            if (it.label) { menu.appendChild(el('div', 'tf-menu-label', it.label)); return; }
            if (it.swatch) { /* a background: a wide strip of it with its name written in its words' colour, always in our own font; a tick on the one it has */
                menu.className += ' tf-grounds';
                var sw = el('button', 'tf-item tf-swatch-row'); sw.setAttribute('role', 'menuitem');
                var name_ = it.word.charAt(0).toUpperCase() + it.word.slice(1), chip = el('span', 'tf-swatch', it.swatch.clear ? '' : name_);
                if (it.swatch.clear) { chip.className += ' tf-swatch-clear'; chip.appendChild(el('span', 'tf-swatch-name', name_)); } else { chip.style.background = it.swatch.ground; chip.style.color = it.swatch.ink; } /* clear: its name on a small white label, so it reads on the grid */
                sw.appendChild(chip);
                sw.type = 'button'; if (it.now) { var tk = el('span', 'tf-swatch-tick'); tk.innerHTML = ICON.check; chip.appendChild(tk); sw.setAttribute('aria-current', 'true'); }
                sw.addEventListener('click', function () { closeMenu(); it.fn(); }); menu.appendChild(sw); return;
            }
            if (it.off) { /* a look that cannot be had here: its name, greyed, and why in place of the sample */
                var o = el('div', 'tf-item tf-look tf-off'); o.setAttribute('role', 'menuitem'); o.setAttribute('aria-disabled', 'true'); menu.className += ' tf-looks';
                o.appendChild(el('span', 'tf-look-why', it.off)); o.appendChild(el('span', 'tf-look-word', it.word)); menu.appendChild(o); return;
            }
            var b = el('button', 'tf-item' + (it.danger ? ' tf-danger' : '')); b.type = 'button'; b.setAttribute('role', 'menuitem');
            if (it.sample) { /* a look: drawn as it is, its plain name on the right, a tick on the one it has now */
                b.className += ' tf-look'; menu.className += ' tf-looks'; b.appendChild(it.sample);
                var w = el('span', 'tf-look-word', it.word); if (it.now) { w.innerHTML = ICON.check; w.appendChild(document.createTextNode(it.word)); b.setAttribute('aria-current', 'true'); }
                b.appendChild(w);
            } else {
                b.innerHTML = it.icon ? ICON[it.icon] : ''; b.appendChild(document.createTextNode(it.word));
                if (it.tag) b.appendChild(el('span', 'tf-row-tag', it.tag));
                if (it.keys) { var ks = el('span', 'tf-keys'); it.keys.forEach(function (k) { ks.appendChild(el('span', 'tf-key', k)); }); b.appendChild(ks); }
                if (it.disabled) b.disabled = true;
                if (it.here) { b.className += ' tf-here'; b.setAttribute('aria-current', 'page'); var ck = el('span', 'tf-item-check'); ck.innerHTML = ICON.check; b.appendChild(ck); }
            }
            b.addEventListener('click', function () { closeMenu(); it.fn(); });
            menu.appendChild(b);
        });
        document.body.appendChild(menu);
        var r = anchor.getBoundingClientRect(), w = menu.offsetWidth, h = menu.offsetHeight, gap = 6, fromTools = tools && tools.contains(anchor);
        if (fromTools) { var tr = tools.getBoundingClientRect(); r = { left: r.left, right: r.right, top: tr.top, bottom: tr.bottom }; gap = 8; if (opts.left !== false) opts.left = true; } /* from the toolbar: 8 under it, left edge on its button (More, the last one: right edge on it) */
        var left = Math.max(8, Math.min(opts.left ? r.left : r.right - w, window.innerWidth - w - 8)), top = r.bottom + gap;
        if (top + h > window.innerHeight - 8) top = Math.max(8, r.top - h - gap); /* no room below: above the button */
        menu.style.left = left + 'px'; menu.style.top = top + 'px';
        menu.row = row; if (row) row.classList.add('tf-open');
        setTimeout(function () { if (menu) { document.addEventListener('pointerdown', menuAway, true); window.addEventListener('scroll', menuScroll, true); } }, 0);
        var first = menu.querySelector("button"); if (first) first.focus();
    }
    function menuAway(e) { if (menu && !menu.contains(e.target) && e.target !== doneCount) closeMenu(); } /* the count toggles its own list */
    function menuScroll(e) { if (menu && e.target && e.target.nodeType === 1 && menu.contains(e.target)) return; closeMenu(); } /* a long list scrolls in itself */
    function closeMenu() {
        if (!menu) return;
        document.removeEventListener('pointerdown', menuAway, true); window.removeEventListener('scroll', menuScroll, true);
        if (menu.row) menu.row.classList.remove('tf-open');
        var m = menu; fade(menu); menu = null;
        if (m.contains(document.activeElement) && m.back && m.back.isConnected && m.back.getClientRects().length) m.back.focus({ preventScroll: true }); /* closed from the keyboard: back where it was opened */
    }
    /* a word on the desktop, its shape on a phone: the word stays in the button for the tooltip, screen readers and the checks */
    function symbolize(b, icon) { var w = b.textContent; b.innerHTML = '<span class="tf-sym">' + ICON[icon] + '</span>'; b.appendChild(el('span', 'tf-bw', w)); b.className += ' tf-phone-sym'; }
    function nameOfPath(path) { var p = path.split(/[?#]/)[0].replace(/\.html?$/, ''); if (!p || p === 'index') return 'Home'; p = p.replace(/[-_]+/g, ' '); return p.charAt(0).toUpperCase() + p.slice(1); }
    function siteName() {
        var logo = document.querySelector('header a[href]'), t = logo ? logo.textContent.replace(/\s+/g, ' ').trim() : '';
        if (!t && logo) { var pic = logo.querySelector('img[alt]'); t = pic ? pic.alt.replace(/[.\s]+$/, '').trim() : ''; } /* a logo that is a picture: its alt names the site */
        if (t.length > 2 && t.length < 40) return t;
        /* the site's own title, never the tab's "Edit · ..." that setTab writes */
        return (realTitle || document.title || 'This site').replace(/^Edit\s*\u00b7\s*/, '').split(/\s+[|\u2013\u2014\-\u00b7]\s+/)[0].trim() || 'This site';
    }
    /* the bar names the page you are on; a site with one page shows its own name */
    /* every page the Pages sheet knows: the menu's, then the found and the added ones */
    function allPages() { findPages(); var home = homePath(); return pageList().concat(otherList()).sort(function (a, b) { return (a.path === home ? 0 : 1) - (b.path === home ? 0 : 1); }); } /* Home first; the rest as the menu, then the others by name */
    function pageLabel() {
        var cur = here(), list = allPages(), name = null;
        list.forEach(function (pg) { if (pg.path === cur) name = pg.name; });
        if (!name) name = list.length ? (cur === homePath() ? 'Home' : nameOfPath(cur)) : siteName();
        var n = pagesBtn.querySelector('.tf-page-name'); if (n && n.textContent !== name) n.textContent = name;
    }
    function togglePages() {
        if (panel) { closePages(); return; }
        if (!menuOf(document)) { say('This site has no menu, so there are no pages to add.', 'error'); return; }
        panel = el('div', 'tf-panel');
        panel.setAttribute('data-tweakfast', '');
        view = { kind: 'pages' };
        renderPages();
        document.body.appendChild(panel);
        placePanel();
        pagesBtn.classList.add('tf-on');
        var f = panel.querySelector('button,input'); if (f) f.focus({ preventScroll: true }); /* a keyboard goes straight on into the sheet */
    }
    /* the panel sits just above the bar, whatever the bar's height (two rows on a phone) */
    function placePanel() { if (panel) placeSheet(panel); if (pal) placeSheet(pal); }
    function placeSheet(n) {
        var h = bar.offsetHeight + (window.innerWidth <= 600 ? 16 : 24);
        n.style.bottom = h + 'px';
        n.style.maxHeight = 'calc(100% - ' + (h + 16) + 'px)';
        placeNote();
    }
    function closePages() { closeMenu(); var inside = panel && panel.contains(document.activeElement); if (panel) fade(panel); panel = null; if (inside) pagesBtn.focus({ preventScroll: true }); pagesBtn.classList.remove('tf-on'); placeNote(); }
    /* Rename: the name becomes a field in place; Enter keeps, Esc puts it back; the menu says the new name on every page */
    function renameRow(pg, row, name) {
        var field = el('input', 'tf-input tf-rename'); field.value = pg.name; field.autocomplete = 'off';
        row.replaceChild(field, name); field.focus(); field.select();
        var done = false;
        function keep() {
            if (done) return; done = true;
            var to = field.value.trim();
            if (!to || to === pg.name) { row.replaceChild(name, field); return; }
            var twin = pageList().filter(function (p) { return p.path !== pg.path && p.name.trim().toLowerCase() === to.toLowerCase(); })[0];
            if (twin) { row.replaceChild(name, field); say('There is already a page called ' + twin.name + '.', 'error'); return; }
            say('Working…');
            everyMenu(function (nav) {
                var links = menuLinks(nav);
                for (var i = 0; i < links.length; i++) if (pathOf(links[i]) === pg.path && links[i].textContent.replace(/\s+/g, ' ').trim().length > 2) links[i].textContent = to; /* a logo keeps its mark */
            }, function (failed, again, step) { if (!failed.length) { say(''); if (step) step.label = 'Renamed ' + pg.name + ' to ' + to; } });
        }
        function back() { if (done) return; done = true; row.replaceChild(name, field); }
        field.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); keep(); } if (e.key === 'Escape') { e.preventDefault(); back(); } e.stopPropagation(); });
        field.addEventListener('blur', keep);
    }
    /* Order: a row is dragged by its grip, the others slide aside; on release the menu takes that order on every page */
    function dragRow(e, row) {
        if (e.button) return;
        e.preventDefault(); e.stopPropagation();
        var grip = e.currentTarget, list0 = row.parentNode, rows = function () { return Array.prototype.slice.call(list0.querySelectorAll(':scope > .tf-row')); };
        var startY = e.clientY, r0 = row.getBoundingClientRect(), was = rows().map(function (r) { return r.getAttribute('data-path'); }), ty = 0;
        row.classList.add('tf-row-moving'); row.style.transition = 'none'; row.style.position = 'relative'; row.style.zIndex = '1';
        try { grip.setPointerCapture(e.pointerId); } catch (err) {}
        function follow(ev) { /* drawn under the finger; its slot (the rect without the transform) stays in the list */
            var slot = row.getBoundingClientRect().top - ty;
            ty = r0.top + (ev.clientY - startY) - slot;
            row.style.transform = 'translateY(' + ty + 'px)';
        }
        function at(ev) {
            follow(ev);
            var mid = r0.top + (ev.clientY - startY) + r0.height / 2, list = rows(), i, at = list.indexOf(row);
            for (i = 0; i < list.length; i++) {
                if (list[i] === row) continue;
                var r = list[i].getBoundingClientRect();
                if (mid < r.top + r.height / 2 && at > i) { slide(list[i], r, ''); list0.insertBefore(row, list[i]); follow(ev); break; }
                if (mid > r.top + r.height / 2 && at < i) { slide(list[i], r, ''); list0.insertBefore(row, list[i].nextSibling); follow(ev); break; }
            }
        }
        var ended = false;
        function end() {
            if (ended) return; ended = true;
            grip.removeEventListener('pointermove', at); grip.removeEventListener('pointerup', end); grip.removeEventListener('pointercancel', end);
            window.removeEventListener('pointerup', end, true); window.removeEventListener('pointercancel', end, true);
            try { grip.releasePointerCapture(e.pointerId); } catch (err) {}
            row.classList.remove('tf-row-moving'); row.style.transition = 'transform .15s ease'; row.style.transform = '';
            setTimeout(function () { row.style.transition = ''; row.style.position = ''; row.style.zIndex = ''; if (row.getAttribute('style') === '') row.removeAttribute('style'); }, 170);
            var now = rows().map(function (r) { return r.getAttribute('data-path'); });
            if (now.join() === was.join()) return;
            say('Working…');
            everyMenu(function (nav) { reorderMenu(nav, now); }, function (failed, again, step) { if (!failed.length) { say(''); if (step) step.label = 'Menu in a new order'; } });
        }
        grip.addEventListener('pointermove', at); grip.addEventListener('pointerup', end); grip.addEventListener('pointercancel', end);
        window.addEventListener('pointerup', end, true); window.addEventListener('pointercancel', end, true);
    }
    /* the menu's links, or the list items that hold them, in the given order */
    function reorderMenu(nav, order) {
        var links = menuLinks(nav), items = {}, i;
        for (i = 0; i < links.length; i++) items[pathOf(links[i])] = links[i].parentElement.tagName === 'LI' ? links[i].parentElement : links[i];
        for (i = 0; i < order.length; i++) { var it = items[order[i]]; if (it) it.parentNode.appendChild(it); }
    }
    /* to another page of the site from the panel; with changes not live yet it asks, the way Leave does */
    function goTo(path) {
        if (path === here()) { closePages(); return; }
        if (freshPages[path]) { say('That page is new and not saved yet. Press Done first, then open it.', 'error'); return; }
        if (waitWork()) return;
        if (editing) commit();
        carry(); location.href = path; /* what is not live yet goes along, kept in this browser */
    }
    /* ---- the command palette ---- */
    /* Cmd+K (Ctrl+K elsewhere): one search over every page and every action, in the sheet's place. A keyboard thing:
       no button opens it and nothing changes on a phone. Arrows move, Enter does it, Esc closes; a click outside closes too. */
    var pal = null, palField = null, palRows = [], palAt = 0, MAC = /Mac|iPhone|iPad/.test(navigator.platform);
    function palItems() {
        var list = pageList(), home = homePath(), out = [], n = steps.length;
        findPages();
        list.concat(otherList()).forEach(function (pg) {
            out.push({ group: 'Pages', icon: 'page', word: pg.name, tag: pg.path === here() ? 'This page' : pg.path === home ? 'Home' : pg.hidden ? 'hidden' : '', fn: function () { goTo(pg.path); } });
        });
        out.push({ group: 'Actions', icon: 'play', word: 'Preview', fn: enterPreview });
        if (list.length) out.push({ group: 'Actions', icon: 'plus', word: 'Add a page', fn: function () { if (!panel) togglePages(); openView({ kind: 'add' }); } });
        out.push({ group: 'Actions', icon: 'share', word: 'Share the site', fn: function () { if (!panel) togglePages(); if (panel) openView({ kind: 'share' }); } });
        out.push({ group: 'Actions', icon: 'help', word: 'Help', fn: function () { if (!panel) togglePages(); if (panel) openView({ kind: 'help' }); } });
        if (n) out.push({ group: 'Actions', icon: 'clock', word: n === 1 ? 'See the change' : 'See the ' + n + ' changes', fn: showChanges });
        if (n) out.push({ group: 'Actions', icon: 'undo', word: 'Undo', keys: [MAC ? '⌘' : 'Ctrl', 'Z'], fn: undo });
        if (n) out.push({ group: 'Actions', icon: 'check', word: 'Done, make ' + (n === 1 ? 'one change' : n + ' changes') + ' live', keys: [MAC ? '⌘' : 'Ctrl', 'S'], fn: function () { save(false); } });
        out.push({ group: 'Actions', icon: 'leave', word: 'Leave', fn: leave_ });
        return out;
    }
    /* the letters typed, in that order, anywhere in the word; a run of them in one piece ranks first */
    function palHit(word, q) {
        var w = word.toLowerCase(), i = 0;
        if (!q) return 1;
        if (w.indexOf(q) >= 0) return 2;
        for (var k = 0; k < w.length && i < q.length; k++) if (w[k] === q[i]) i++;
        return i === q.length ? 1 : 0;
    }
    function renderPal() {
        var body = pal.lastChild, q = palField.value.trim().toLowerCase(), group = null;
        body.innerHTML = ''; palRows = []; palAt = 0;
        var items = palItems().map(function (it) { it.rank = palHit(it.word, q); return it; }).filter(function (it) { return it.rank; });
        if (q) items.sort(function (a, b) { return b.rank - a.rank; });
        if (!items.length) { body.appendChild(el('div', 'tf-pal-none', 'Nothing for “' + palField.value.trim() + '”.')); return; }
        items.forEach(function (it, i) {
            if (!q && it.group !== group) { group = it.group; body.appendChild(el('div', 'tf-caption', group)); }
            var row = el('button', 'tf-item tf-pal-row'); row.type = 'button'; row.innerHTML = ICON[it.icon];
            row.appendChild(el('span', 'tf-pal-name', it.word));
            if (it.tag) row.appendChild(el('span', 'tf-row-tag', it.tag));
            if (it.keys) { var ks = el('span', 'tf-keys'); it.keys.forEach(function (k) { ks.appendChild(el('span', 'tf-key', k)); }); row.appendChild(ks); }
            row.addEventListener('click', function () { closePal(); it.fn(); });
            row.addEventListener('mousemove', function () { if (palAt !== i) { palAt = i; litPal(); } });
            body.appendChild(row); palRows.push(row);
        });
        litPal();
    }
    function litPal() {
        for (var i = 0; i < palRows.length; i++) palRows[i].classList.toggle('tf-lit', i === palAt);
        if (palRows[palAt]) palRows[palAt].scrollIntoView({ block: 'nearest' });
    }
    function openPal() {
        if (pal) { closePal(); return; }
        if (locked) return;
        palWas = { sheet: !!panel, focus: document.activeElement }; /* Esc goes back to where the owner was */
        if (editing) commit(); closeMenu(); closePages(); if (held) unhold(); if (picked) unpick(); if (tools) hideTools(); hoverNone(); hideLink(); say('');
        pal = el('div', 'tf-panel tf-pal'); pal.setAttribute('data-tweakfast', ''); pal.setAttribute('role', 'dialog'); pal.setAttribute('aria-label', 'Search pages and actions');
        var f = el('div', 'tf-pal-field'); f.innerHTML = ICON.search;
        palField = el('input', 'tf-pal-input'); palField.placeholder = 'Search pages and actions'; palField.autocomplete = 'off'; palField.spellcheck = false;
        f.appendChild(palField);
        if (coarse()) { var cancel = button('Cancel', function () { closePal(true); }); cancel.className += ' tf-quiet tf-pal-cancel'; f.appendChild(cancel); } /* no Esc key on a phone */
        else f.appendChild(el('span', 'tf-key', 'esc'));
        pal.appendChild(f); pal.appendChild(el('div', 'tf-sheet-body'));
        palField.addEventListener('input', renderPal);
        document.body.appendChild(pal); placeSheet(pal); renderPal(); palField.focus();
    }
    var palWas = null;
    function closePal(back) {
        if (!pal) return; fade(pal); pal = null; palRows = []; placeNote();
        var w = palWas; palWas = null;
        if (!back || !w) return;
        if (w.sheet && !panel) togglePages();
        if (w.focus && w.focus !== document.body && w.focus.isConnected && !w.focus.closest('.tf-pal')) try { w.focus.focus(); } catch (e) {}
        else if (panel) { var f = panel.querySelector('button,input'); if (f) f.focus(); }
    }
    function palKey(e) {
        if (e.key === 'Escape') { e.preventDefault(); closePal(true); return; }
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); if (palRows.length) { palAt = (palAt + (e.key === 'ArrowDown' ? 1 : palRows.length - 1)) % palRows.length; litPal(); } return; }
        if (e.key === 'Enter') { e.preventDefault(); if (palRows[palAt]) palRows[palAt].click(); }
    }
    /* a redraw keeps the keyboard where it was: the same button in the same view, else the sheet's first */
    var drawnView = null;
    function renderPages(dir) {
        closeMenu();
        var a = document.activeElement, had = panel.contains(a), same = view === drawnView;
        var FOCUSABLE = 'button,input,a[href],[tabindex]', at = had ? Array.prototype.indexOf.call(panel.querySelectorAll(FOCUSABLE), a) : -1, word = had ? a.getAttribute('aria-label') || a.textContent : '';
        drawPages(dir); drawnView = view;
        if (!had || panel.contains(document.activeElement)) return;
        var all = panel.querySelectorAll(FOCUSABLE), to = null, i;
        if (same && all[at] && (all[at].getAttribute('aria-label') || all[at].textContent) === word) to = all[at];
        for (i = 0; !to && same && i < all.length; i++) if ((all[i].getAttribute('aria-label') || all[i].textContent) === word) to = all[i];
        to = to || all[0]; if (to) to.focus({ preventScroll: true });
    }
    function drawPages(dir) {
        panel.innerHTML = '';
        findPages();
        var list = pageList(), home = homePath(), others = otherList();
        if (list.length && !menuEntries(menuOf(document)).length) { /* no menu of words (a logo alone): one plain list, Home first, nothing to order */
            others = list.map(function (pg) { return { path: pg.path, name: pg.name, other: true }; }).concat(others.filter(function (o) { return !list.some(function (pg) { return pg.path === o.path; }); }));
            list = [];
        }
        var menuless = !list.length;
        var head = el('div', 'tf-sheet-head'), body = el('div', 'tf-sheet-body' + (dir ? ' tf-' + dir : ''));
        panel.appendChild(head); panel.appendChild(body);
        if (view.kind !== 'pages') { /* a page's view: a chevron back to the list, the page's name as the title */
            head.appendChild(iconButton('back', 'Back', function () { openView({ kind: 'pages' }); }));
            head.appendChild(el('h3', 'tf-panel-title', view.kind === 'add' ? 'Add a page' : view.kind === 'help' ? 'Help' : view.kind === 'share' ? 'Share the site' : view.pg.name));
            if (view.kind === 'help') showHelp(body);
            else if (view.kind === 'share') showShare(body);
            else if (view.kind === 'words') showWords(view.pg, body);
            else if (view.kind === 'versions') showVersions(view.pg, body);
            else renderAdd(body, list.concat(others.filter(function (pg) { return !pg.fresh; })));
            return;
        }
        head.appendChild(el('h3', 'tf-panel-title', 'Pages'));
        if (!menuless || others.length > 1) head.appendChild(iconButton('plus', 'Add a page', function () { openView({ kind: 'add' }); }));
        if (coarse()) head.appendChild(iconButton('search', 'Search', function () { openPal(); })); /* Cmd+K needs a keyboard; on a phone the search is here */
        head.appendChild(iconButton('share', 'Share the site', function () { openView({ kind: 'share' }); }));
        var helpBtn = iconButton('help', 'Help', function () { openView({ kind: 'help' }); }); head.appendChild(helpBtn);
        function more(row, items) {
            var acts = el('span', 'tf-row-acts'), b = iconButton('more', 'More', function () { openMenu(b, items, row); });
            acts.appendChild(b); row.appendChild(acts); return acts;
        }
        if (menuless && others.length < 2) { /* a one-page site: the menu only jumps within the page; new pages come from the maker */
            var one = { path: here(), name: 'This page' }, only = el('div', 'tf-row');
            only.appendChild(el('span', 'tf-row-name', 'This site has one page.'));
            var oneItems = [{ icon: 'search', word: 'Words for Google', fn: function () { openView({ kind: 'words', pg: one }); } }];
            if (saver) oneItems.push({ icon: 'clock', word: 'Versions', fn: function () { openView({ kind: 'versions', pg: one }); } });
            more(only, oneItems);
            body.appendChild(only);
            pageGroundRow(body);
            return;
        }
        list.forEach(function (pg) {
            var row = el('div', 'tf-row' + (pg.path === here() ? ' tf-here' : '') + (pg.hidden ? ' tf-row-hidden' : '')); row.setAttribute('data-path', pg.path);
            /* a grip to drag the row: the menu takes that order on every page */
            var grip = el('span', 'tf-grip tf-row-grip'); grip.innerHTML = ICON.grip; tip(grip, 'Drag to change the order'); grip.setAttribute('aria-label', 'Drag to change the order');
            grip.addEventListener('pointerdown', function (e) { dragRow(e, row); });
            if (list.length < 2) grip.style.visibility = 'hidden'; /* one page in the menu: nothing to order */
            row.appendChild(grip);
            /* the name is the way to the page; the one you are on is marked */
            var name = el('a', 'tf-row-name', pg.name); name.href = pg.path;
            name.addEventListener('click', function (e) { e.preventDefault(); goTo(pg.path); });
            row.appendChild(name);
            if (pg.path === home) row.appendChild(el('span', 'tf-row-note', 'Home'));
            if (pg.hidden) row.appendChild(el('span', 'tf-row-tag', 'hidden'));
            if (pg.path === here()) { var mark = el('span', 'tf-row-check'); mark.innerHTML = ICON.check; tip(mark, 'The page you are on'); row.appendChild(mark); } /* the row is filled and bold too; no dot: a dot would say "changed" */
            var items = [
                { icon: 'pencil', word: 'Rename', fn: function () { renameRow(pg, row, name); } },
                { icon: 'search', word: 'Words for Google', fn: function () { openView({ kind: 'words', pg: pg }); } }
            ];
            if (saver) items.push({ icon: 'clock', word: 'Versions', fn: function () { openView({ kind: 'versions', pg: pg }); } });
            if (pg.path !== home) {
                items.push('gap');
                items.push(pg.hidden ? { icon: 'eye', word: 'Show in the menu', fn: function () { setPageHidden(pg.path, false); } }
                                     : { icon: 'eyeOff', word: 'Hide from the menu', fn: function () { setPageHidden(pg.path, true); } });
                items.push({ icon: 'trash', word: 'Remove the page', danger: true, fn: function () { removePage(pg); } });
            }
            more(row, items);
            body.appendChild(row);
        });
        /* pages the menu does not name, in the same list after the menu's: open, words for Google, versions; one made
           here and not saved can go again. Where the site has a menu they say so; where it has none, nothing to say */
        others.sort(function (a, b) { return (b.path === home) - (a.path === home); });
        others.forEach(function (pg) {
            var row = el('div', 'tf-row' + (pg.path === here() ? ' tf-here' : '')); row.setAttribute('data-path', pg.path);
            if (!menuless) { var gap = el('span', 'tf-grip tf-row-grip'); gap.style.visibility = 'hidden'; row.appendChild(gap); } /* lined up with the menu's names */
            var name = el('a', 'tf-row-name', pg.name); name.href = pg.path;
            name.addEventListener('click', function (e) { e.preventDefault(); goTo(pg.path); });
            row.appendChild(name);
            if (pg.path === home) row.appendChild(el('span', 'tf-row-note', 'Home'));
            var unlinked = !isLinked(pg.path); /* a page nothing leads to: the owner would think it was never made */
            if (unlinked) row.appendChild(el('span', 'tf-row-tag', 'not linked yet'));
            else if (pg.fresh) row.appendChild(el('span', 'tf-row-tag', 'new'));
            else if (!menuless) row.appendChild(el('span', 'tf-row-tag', 'not in menu'));
            if (pg.path === here()) { var mark = el('span', 'tf-row-check'); mark.innerHTML = ICON.check; tip(mark, 'The page you are on'); row.appendChild(mark); }
            var items = [{ icon: 'search', word: 'Words for Google', fn: function () { openView({ kind: 'words', pg: pg }); } }];
            if (unlinked && footerLinkRow()) items.unshift({ icon: 'link', word: 'Link it from the footer', fn: function () { linkFromFooter(pg.path, pg.name); } });
            if (saver && !pg.fresh) items.push({ icon: 'clock', word: 'Versions', fn: function () { openView({ kind: 'versions', pg: pg }); } });
            if (pg.fresh) { items.push('gap'); items.push({ icon: 'trash', word: 'Remove the page', danger: true, fn: function () { dropFresh(pg); } }); }
            more(row, items);
            body.appendChild(row);
        });
        pageGroundRow(body);
    }
    /* does anything on the site lead to this page: a link on this page, or on any page this visit has read or changed */
    function isLinked(path) {
        var on = Array.prototype.some.call(document.querySelectorAll('a[href]'), function (a) { return !a.closest('[data-tweakfast]') && isPageLink(a) && pathOf(a) === path; });
        if (on) return true;
        var mark = 'href="' + path + '"', pages = {}, k;
        for (k in loaded) pages[k] = loaded[k]; for (k in changes) pages[k] = changes[k];
        for (k in pages) if (k !== path && k !== here() && pages[k] && pages[k].indexOf(mark) >= 0) return true;
        return false;
    }
    /* the last row of a footer's row of links (Privacy, Imprint…): the outermost part of the footer that is just that one
       page link and its words, a block or a text alike */
    function footerLinkRow() {
        var rows = [];
        Array.prototype.forEach.call(document.querySelectorAll('footer a[href]'), function (a) {
            if (!isPageLink(a) || !a.textContent.trim() || a.closest('nav,[data-tweakfast]') || a.hasAttribute('data-tf-hidden')) return;
            var row = a, words = a.textContent.trim();
            while (row.parentElement && row.parentElement.tagName !== 'FOOTER' && row.parentElement.textContent.trim() === words) row = row.parentElement;
            if (row.parentElement && row.parentElement.tagName !== 'FOOTER' && rows.indexOf(row) < 0) rows.push(row); /* a lone link straight in the footer has no list to add to */
        });
        return rows.length ? rows[rows.length - 1] : null;
    }
    /* a new row after the footer's last page link, named for the page and leading to it, on every page (footers are shared) */
    function linkFromFooter(path, name) {
        var last = footerLinkRow(); if (!last) return;
        var parent = last.parentElement, parentWas = cleanOuter(parent), twin = makeTwin(last);
        var a = twin.tagName === 'A' ? twin : twin.querySelector('a[href]');
        a.setAttribute('href', path); a.textContent = name;
        var gap = last.nextSibling && last.nextSibling.nodeType === 3 && !last.nextSibling.nodeValue.trim() ? last.nextSibling.nodeValue : '';
        parent.insertBefore(twin, last.nextSibling); if (gap) parent.insertBefore(document.createTextNode(gap), twin);
        var st = function () { twin.remove(); }; st.label = 'Linked ' + name + ' from the footer'; steps.push(st);
        mirror(parent, parentWas);
        refresh(); if (panel) renderPages();
        say(name + ' is now linked from the footer on every page. Press Done to make it live.');
        twin.scrollIntoView({ block: 'nearest', behavior: motion() });
    }
    /* a page added here and not saved yet goes again, with the rows and menu entries made for it; Undo brings all back */
    var freshWays = {};
    function dropFresh(pg) {
        var w = freshWays[pg.path], html = changes[pg.path];
        var st = w ? function () { w.again(); markBlocks(); } : function () { changes[pg.path] = html; freshPages[pg.path] = true; };
        if (w) { w.back(); markBlocks(); } else { delete changes[pg.path]; delete freshPages[pg.path]; }
        st.label = 'Removed page ' + pg.name; steps.push(st);
        refresh(); if (panel) renderPages();
        say(pg.name + ' is gone, with its rows and links. Undo brings it back.');
    }
    /* how much of the page's ground the reader sees: the share of the page's height along which some of it is left bare
       by the parts that paint over it (a colour, a picture). A page whose sections each own their ground leaves the body
       showing nowhere, or in one strip behind the menu; a change to it would recolour that strip and call itself the
       page. Boxes narrower than the page show it down both sides, on every row. Rects are taken as laid out in the page. */
    function groundShows(b) {
        var r = b.getBoundingClientRect(), top = r.top + pageYOffset, left = r.left + pageXOffset;
        if (!r.width || !r.height) return 1;
        var boxes = [], all = b.querySelectorAll('*');
        for (var i = 0; i < all.length && boxes.length < 400; i++) {
            var n = all[i]; if (n.hasAttribute('data-tweakfast') || n.closest('[data-tweakfast]') || !n.getClientRects().length) continue;
            var cs = getComputedStyle(n); if (cs.visibility === 'hidden' || parseFloat(cs.opacity) < .5 || cs.position === 'fixed') continue;
            var paints = n.tagName === 'IMG' && n.currentSrc || /url\(|gradient/.test(cs.backgroundImage) || opaque(cs.backgroundColor);
            if (!paints) continue;
            var q = n.getBoundingClientRect(); if (q.width < 2 || q.height < 2) continue;
            boxes.push({ l: q.left + pageXOffset, t: q.top + pageYOffset, r: q.right + pageXOffset, b: q.bottom + pageYOffset });
        }
        var cols = 24, rows = Math.max(12, Math.min(120, Math.round(r.height / 60))), bare = 0;
        for (var y = 0; y < rows; y++) for (var x = 0; x < cols; x++) {
            var px = left + r.width * (x + .5) / cols, py = top + r.height * (y + .5) / rows, hit = false;
            for (var k = 0; k < boxes.length && !hit; k++) { var o = boxes[k]; hit = px >= o.l && px < o.r && py >= o.t && py < o.b; }
            if (!hit) { bare++; break; } /* one bare spot on this row is enough: the row shows the ground */
        }
        return bare / rows;
    }
    var EACH_PART = 'Each part of this page has its own background. Click a part to change it.';
    /* the page's own ground, under the pages: the four rows of Look, made on every page. Where that ground is all but
       hidden under the parts, there is no page background to offer: the row says so, and sends the owner to the parts */
    function pageGroundRow(body) {
        var b = pageGround(), now = kindOf(groundLook(b).ground);
        body.appendChild(el('div', 'tf-caption tf-ground-caption', 'Every page'));
        if (groundShows(b) < .25) { var hid = el('div', 'tf-row tf-row-plain'); hid.appendChild(el('span', 'tf-row-name', EACH_PART)); body.appendChild(hid); return; }
        var row = el('div', 'tf-row'), name = el('a', 'tf-row-name', 'Page background'); name.href = '#';
        row.appendChild(name);
        if (now) row.appendChild(el('span', 'tf-row-note', now));
        name.addEventListener('click', function (e) {
            e.preventDefault();
            var rows = groundRows(b).filter(function (r) { return !r.off; });
            openMenu(name, rows.length ? rows.map(function (r) { return swatchItem(r, function (o) { takePageGround(b, o); }); }) : [{ note: 'This page cannot take another background.' }], row);
        });
        body.appendChild(row);
    }
    /* Add a page: like one of the pages, with a name; the view the plus in the head opens */
    function renderAdd(body, list) {
        var add = el('div', 'tf-add');
        add.appendChild(el('div', 'tf-caption', 'Like'));
        var like = el('select', 'tf-select');
        list.forEach(function (pg) { var o = el('option', null, pg.name); o.value = pg.path; like.appendChild(o); });
        if (view.like) { if (!list.some(function (pg) { return pg.path === view.like; })) { var o = el('option', null, fileName(view.like)); o.value = view.like; like.appendChild(o); } like.value = view.like; } /* from a list's plus: like the row above */
        add.appendChild(like);
        add.appendChild(el('div', 'tf-caption', 'Name'));
        var name = el('input', 'tf-input'); name.placeholder = 'Name of the new page'; name.autocomplete = 'off';
        add.appendChild(name);
        var go = button('Add', function () { if (addPage(like.value, name.value)) openView({ kind: 'pages' }); });
        go.className += ' tf-primary';
        add.appendChild(go);
        name.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); go.click(); } });
        body.appendChild(add);
        name.focus();
    }
    /* Share: the address readers use, to copy or to scan; never the editing link */
    function showShare(body) {
        var hp = homePath(), url = new URL(!hp || /^(index\.html|\.\/|\/)$/.test(hp) ? './' : hp, location.href).href; /* the home page beside this one, also in a folder */
        body.appendChild(el('div', 'tf-caption', 'Address'));
        var line = el('div', 'tf-share-line'), field = el('input', 'tf-input'); field.readOnly = true; field.value = url; field.setAttribute('aria-label', 'Address');
        field.addEventListener('focus', function () { field.select(); });
        var copyBtn = button('Copy', function () {
            var ok = function () { copyBtn.textContent = 'Copied'; setTimeout(function () { copyBtn.textContent = 'Copy'; }, 1600); };
            if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(url).then(ok, function () { field.select(); say('Press ' + (MAC ? '⌘' : 'Ctrl+') + 'C to copy.'); });
            else { field.select(); try { if (document.execCommand('copy')) ok(); } catch (e) {} }
        });
        line.appendChild(field); line.appendChild(copyBtn); body.appendChild(line);
        var code = qrSvg(url);
        if (code) { body.appendChild(el('div', 'tf-caption', 'For phones')); var box = el('div', 'tf-qr'); box.innerHTML = code; body.appendChild(box); }
        body.appendChild(el('p', 'tf-share-note', 'This is the address readers use. Keep the address of this editing page to yourself: anyone with it can change the site.'));
    }
    /* ---- a QR code, drawn here: byte mode, error level M, sizes 1 to 10 (up to 213 letters), mask 0 ---- */
    var QR_M = [null, [10, 1, 16, 0, 0], [16, 1, 28, 0, 0], [26, 1, 44, 0, 0], [18, 2, 32, 0, 0], [24, 2, 43, 0, 0], [16, 4, 27, 0, 0], [18, 4, 31, 0, 0], [22, 2, 38, 2, 39], [22, 3, 36, 2, 37], [26, 4, 43, 1, 44]]; /* ecc per block, blocks and data of group 1, of group 2 */
    var QR_ALIGN = [null, [], [6, 18], [6, 22], [6, 26], [6, 30], [6, 34], [6, 22, 38], [6, 24, 42], [6, 26, 46], [6, 28, 50]];
    function gfMul(x, y) { var z = 0; for (var i = 7; i >= 0; i--) { z = (z << 1) ^ ((z >>> 7) * 0x11D); z ^= ((y >>> i) & 1) * x; } return z; }
    function rsGen(deg) {
        var r = [], i, j, root = 1;
        for (i = 0; i < deg - 1; i++) r.push(0); r.push(1);
        for (i = 0; i < deg; i++) { for (j = 0; j < r.length; j++) { r[j] = gfMul(r[j], root); if (j + 1 < r.length) r[j] ^= r[j + 1]; } root = gfMul(root, 2); }
        return r;
    }
    function rsRem(data, gen) {
        var r = gen.map(function () { return 0; });
        data.forEach(function (b) { var f = b ^ r.shift(); r.push(0); gen.forEach(function (c, i) { r[i] ^= gfMul(c, f); }); });
        return r;
    }
    function qrMatrix(text) {
        var data = Array.prototype.map.call(unescape(encodeURIComponent(text)), function (c) { return c.charCodeAt(0); });
        var ver, t, cap, i, j, x, y;
        for (ver = 1; ver <= 10; ver++) { t = QR_M[ver]; cap = t[1] * t[2] + t[3] * t[4]; if (4 + (ver < 10 ? 8 : 16) + data.length * 8 <= cap * 8) break; }
        if (ver > 10) return null;
        var bits = [], put = function (v, n) { for (var k = n - 1; k >= 0; k--) bits.push((v >>> k) & 1); };
        put(4, 4); put(data.length, ver < 10 ? 8 : 16); data.forEach(function (b) { put(b, 8); });
        put(0, Math.min(4, cap * 8 - bits.length)); while (bits.length % 8) bits.push(0);
        for (var pad = 0xEC; bits.length < cap * 8; pad ^= 0xEC ^ 0x11) put(pad, 8);
        var cw = []; for (i = 0; i < bits.length; i += 8) { var v = 0; for (j = 0; j < 8; j++) v = (v << 1) | bits[i + j]; cw.push(v); }
        var blocks = [], eccs = [], at = 0, gen = rsGen(t[0]);
        for (i = 0; i < t[1] + t[3]; i++) { var len = i < t[1] ? t[2] : t[4]; blocks.push(cw.slice(at, at + len)); at += len; eccs.push(rsRem(blocks[i], gen)); }
        var out = [];
        for (i = 0; i < Math.max(t[2], t[4]); i++) blocks.forEach(function (bl) { if (i < bl.length) out.push(bl[i]); });
        for (i = 0; i < t[0]; i++) eccs.forEach(function (ec) { out.push(ec[i]); });
        var size = ver * 4 + 17, m = [], fn = [];
        for (i = 0; i < size * size; i++) { m.push(0); fn.push(false); }
        var set = function (px, py, d) { m[py * size + px] = d ? 1 : 0; fn[py * size + px] = true; };
        for (i = 0; i < size; i++) { set(6, i, i % 2 === 0); set(i, 6, i % 2 === 0); }
        [[3, 3], [size - 4, 3], [3, size - 4]].forEach(function (c) {
            for (var dy = -4; dy <= 4; dy++) for (var dx = -4; dx <= 4; dx++) { var px = c[0] + dx, py = c[1] + dy, d = Math.max(Math.abs(dx), Math.abs(dy)); if (px >= 0 && px < size && py >= 0 && py < size) set(px, py, d !== 2 && d !== 4); }
        });
        var al = QR_ALIGN[ver], last = al.length - 1;
        al.forEach(function (a, ai) { al.forEach(function (b, bi) {
            if ((ai === 0 && bi === 0) || (ai === 0 && bi === last) || (ai === last && bi === 0)) return;
            for (var dy = -2; dy <= 2; dy++) for (var dx = -2; dx <= 2; dx++) set(a + dx, b + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
        }); });
        var format = function (mask) {
            var k, rem = mask; for (k = 0; k < 10; k++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537); /* level M is 00 */
            var f = ((mask << 10) | rem) ^ 0x5412, bit = function (n) { return (f >>> n) & 1; };
            for (k = 0; k <= 5; k++) set(8, k, bit(k));
            set(8, 7, bit(6)); set(8, 8, bit(7)); set(7, 8, bit(8));
            for (k = 9; k < 15; k++) set(14 - k, 8, bit(k));
            for (k = 0; k < 8; k++) set(size - 1 - k, 8, bit(k));
            for (k = 8; k < 15; k++) set(8, size - 15 + k, bit(k));
            set(8, size - 8, 1);
        };
        format(0);
        if (ver >= 7) {
            var vr = ver; for (i = 0; i < 12; i++) vr = (vr << 1) ^ ((vr >>> 11) * 0x1F25);
            var vb = (ver << 12) | vr;
            for (i = 0; i < 18; i++) { var bt = (vb >>> i) & 1, a = size - 11 + i % 3, b = Math.floor(i / 3); set(a, b, bt); set(b, a, bt); }
        }
        var n = 0;
        for (var right = size - 1; right >= 1; right -= 2) {
            if (right === 6) right = 5;
            for (var vert = 0; vert < size; vert++) for (j = 0; j < 2; j++) {
                x = right - j; y = ((right + 1) & 2) === 0 ? size - 1 - vert : vert;
                if (!fn[y * size + x] && n < out.length * 8) { m[y * size + x] = (out[n >>> 3] >>> (7 - (n & 7))) & 1; n++; }
            }
        }
        for (y = 0; y < size; y++) for (x = 0; x < size; x++) if (!fn[y * size + x] && (x + y) % 2 === 0) m[y * size + x] ^= 1;
        format(0);
        return { size: size, dark: function (px, py) { return m[py * size + px] === 1; } };
    }
    function qrSvg(text) {
        var q = qrMatrix(text); if (!q) return '';
        var d = '', w = q.size + 8;
        for (var y = 0; y < q.size; y++) for (var x = 0; x < q.size; x++) if (q.dark(x, y)) d += 'M' + (x + 4) + ' ' + (y + 4) + 'h1v1h-1z';
        return '<svg viewBox="0 0 ' + w + ' ' + w + '" shape-rendering="crispEdges" role="img" aria-label="QR code of the address"><rect width="' + w + '" height="' + w + '" fill="#fff"/><path d="' + d + '" fill="#000"/></svg>';
    }
    /* Yesterday's version: the saved copies of a page, and the original */
    /* Words for Google: a page's title and description, what a search result and a shared link show. The
       current page is changed in place; another page is loaded, changed and kept in `changes` until Done. */
    /* Help: what the editor does, in a minute's reading, one row a topic (icon, name, the sentence); the keys as this computer writes them, drawn as keycaps */
    function showHelp(body) {
        var mod = MAC ? '\u2318' : 'Ctrl+', shift = MAC ? '\u21e7\u2318' : 'Ctrl+Shift+', list = el('div', 'tf-helps');
        [['pencil', 'Words', 'Click any text to type. Enter keeps it, Shift+Enter starts a new line, Esc puts it back. Tab goes on to the next text.'],
         ['grip', 'Blocks', 'Point at a part of the page to see its tools: Colour, Move, Hide, Copy, Remove. Drag the dots to move it anywhere.'],
         ['picture', 'Pictures', ALT_ON ? 'Click a picture once to describe it, twice to choose a new one. Drag inside it to pick the part that shows.' : 'Click a picture once to select it, twice to choose a new one. Drag inside it to pick the part that shows.'],
         ['link', 'Links', 'While you edit words, the toolbar says where they lead. Type a page or an address under Link to and the words become a link.'],
         ['page', 'Pages', 'Site lists your pages. Use More on a page to rename it, hide it, remove it, set its words for Google, or bring back an older version.'],
         ['check', 'Making it live', 'Nothing changes for readers until you press Done. The number on Done shows your changes; click it to see them. Undo takes back the last one, even after Done.'],
         ['keys', 'Keys', [[mod + 'Z', 'Undo'], [shift + 'Z', 'Redo'], [mod + 'S', 'Done'], [mod + 'K', 'Search everything']]],
         ['bookmark', 'Coming back', 'Bookmark this page. Its address is your key; there is no login. If the tab closes, your changes wait here for you.']
        ].forEach(function (h) {
            var row = el('div', 'tf-help-row'), mark = el('span', 'tf-help-icon'), words = el('div', 'tf-help-words');
            mark.innerHTML = ICON[h[0]]; row.appendChild(mark);
            words.appendChild(el('div', 'tf-help-title', h[1]));
            if (typeof h[2] === 'string') words.appendChild(el('p', 'tf-help', h[2]));
            else { var keys = el('p', 'tf-help tf-help-keys'); h[2].forEach(function (k) { var one = el('span'); one.appendChild(el('kbd', 'tf-kbd', k[0])); one.appendChild(document.createTextNode(k[1])); keys.appendChild(one); }); words.appendChild(keys); }
            row.appendChild(words); list.appendChild(row);
        });
        body.appendChild(list);
    }
    function showWords(pg, body) {
        var box = el('div', 'tf-words');
        body.appendChild(box);
        var title = el('input', 'tf-input'), desc = el('textarea', 'tf-input tf-area'); desc.rows = 1;
        function grow() { desc.style.height = ''; desc.style.height = desc.scrollHeight + 'px'; } /* one line that grows with the words */
        title.placeholder = 'Title, as in the browser tab'; desc.placeholder = 'One or two sentences about this page';
        title.autocomplete = desc.autocomplete = 'off';
        box.appendChild(captioned('Title', title)); box.appendChild(captioned('Description', desc));
        /* the page as a search result shows it, cut where Google cuts */
        box.appendChild(el('div', 'tf-caption', 'As Google shows it'));
        var view_ = el('div', 'tf-preview'), vTitle = el('div', 'tf-preview-title'), vUrl = el('div', 'tf-preview-url'), vDesc = el('div', 'tf-preview-desc');
        vUrl.textContent = location.host + (pg.path === 'index.html' ? '' : ' › ' + pg.path.replace(/\.html$/, ''));
        view_.appendChild(vTitle); view_.appendChild(vUrl); view_.appendChild(vDesc); box.appendChild(view_);
        function preview() {
            vTitle.textContent = cut(title.value.trim() || title.placeholder, 60);
            vDesc.textContent = cut(desc.value.trim() || 'Without a description, Google picks some words from the page.', 155);
        }
        function cut(t, n) { return t.length > n ? t.slice(0, n - 1).replace(/\s+\S*$/, '') + '…' : t; }
        var origin = null, was = null, step = null, prev = changes[pg.path];
        withPage(pg.path, function (doc) {
            if (!doc) { box.textContent = 'Could not read that page.'; return; }
            origin = was = wordsOf(doc); title.value = was.title; desc.value = was.description; preview(); grow();
        });
        /* one Undo for the box, however many fields were changed */
        function keep() {
            if (!was) return;
            var now = { title: title.value.trim(), description: desc.value.trim() };
            if (now.title === was.title && now.description === was.description) return;
            was = now;
            if (step && steps[steps.length - 1] === step) steps.pop();
            step = pg.path === here()
                ? function () { setWords(pg.path, origin, null); }
                : function () { if (prev === undefined) delete changes[pg.path]; else changes[pg.path] = prev; };
            step.label = 'Name and description of ' + pg.name; setWords(pg.path, now, step);
        }
        [title, desc].forEach(function (f) {
            f.addEventListener('input', function () { preview(); if (f === desc) grow(); });
            f.addEventListener('blur', keep);
            f.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); keep(); openView({ kind: 'pages' }); } });
        });
        title.focus();
    }
    function captioned(text, field) { var w = el('label', 'tf-captioned'); w.appendChild(el('span', 'tf-caption', text)); w.appendChild(field); return w; }
    function wordsOf(doc) {
        var m = doc.querySelector('meta[name="description"]') || doc.querySelector('meta[property="og:description"]');
        return { title: (doc === document ? realTitle : doc.title || '').trim(), description: m ? (m.getAttribute('content') || '').trim() : '' };
    }
    function withPage(path, cb) {
        if (path === here()) { cb(document); return; }
        loadPage(path, function (html) { cb(html ? parse(html) : null); });
    }
    /* writes the words into a page; the current page in place (an undo step restores it), another page into changes */
    function setWords(path, w, undoFn) {
        withPage(path, function (doc) {
            if (!doc) return;
            if (doc === document) { realTitle = w.title; setTab(); } else doc.title = w.title;
            putMeta(doc, 'meta[name="description"]', 'name', 'description', w.description);
            ['meta[property="og:title"]', 'meta[name="twitter:title"]'].forEach(function (q) { var m = doc.querySelector(q); if (m) m.setAttribute('content', w.title); });
            ['meta[property="og:description"]', 'meta[name="twitter:description"]'].forEach(function (q) { var m = doc.querySelector(q); if (m) m.setAttribute('content', w.description); });
            if (doc !== document) changes[path] = serialize(doc);
            if (undoFn) { /* not refresh(): it would redraw the panel and close the fields; the count is set here instead */
                steps.push(undoFn); redos.length = 0; stepsSeen = steps.length;
                undoBtn.disabled = doneBtn.disabled = false; doneCount.textContent = steps.length; doneCount.style.visibility = 'visible'; laterDraft();
            }
        });
    }
    function putMeta(doc, q, attr, name, value) {
        var m = doc.querySelector(q);
        if (!value) { if (m) m.remove(); return; }
        if (!m) { m = doc.createElement('meta'); m.setAttribute(attr, name); (doc.head || doc.documentElement).appendChild(m); }
        m.setAttribute('content', value);
    }
    function showVersions(pg, body) {
        var box = el('div', 'tf-versions', 'Looking…');
        body.appendChild(box);
        function entry(label, now, fn) {
            var r = el('div', 'tf-row'); r.appendChild(el('span', 'tf-row-name', label));
            if (now) r.appendChild(el('span', 'tf-row-tag', 'now'));
            else { var acts = el('span', 'tf-row-acts'); acts.appendChild(button('Put back', fn)); r.appendChild(acts); }
            box.appendChild(r);
        }
        fetch('/api/history', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ key: key, path: pg.path, list: true }) })
            .then(function (r) { return r.json(); })
            .then(function (j) {
                box.textContent = '';
                if (!j.ok) { box.textContent = j.message || 'Could not read the versions.'; return; }
                var times = j.saved || [];
                if (demo || j.demo) { /* a demo saves nothing: no versions, but the original can always come back */
                    box.appendChild(el('div', 'tf-caption', 'This demo saves nothing, so there are no versions.'));
                    entry('The original', false, function () { putBack(pg, null, box); });
                    return;
                }
                if (!times.length && j.original !== false) { box.textContent = 'No saved versions yet; this is the original.'; return; }
                var seen = {}; /* saves in the same minute fold into one entry, the newest */
                times = times.filter(function (t) { var m = String(t).slice(0, 16); if (seen[m]) return false; seen[m] = true; return true; });
                box.appendChild(el('div', 'tf-caption', 'Saved versions'));
                times.forEach(function (t, i) { entry(when(t), i === 0, function () { putBack(pg, t, box); }); });
                if (j.original !== false) entry('The original', false, function () { putBack(pg, null, box); });
                else if (!times.length) box.textContent = 'No saved versions yet.';
            }, function () { box.textContent = 'Could not read the versions.'; });
    }
    /* any page but Home can be removed: out of every menu now, taken away for good at Done, Undo brings it back */
    var drops = {};
    function removePage(pg) {
        if (pg.path === homePath()) { say('Home cannot be removed.', 'error'); return; }
        if (pg.path === here()) { say('Open another page to remove this one.', 'error'); return; }
        say('Working…');
        everyMenu(function (nav) {
            var links = menuLinks(nav);
            for (var i = 0; i < links.length; i++) if (pathOf(links[i]) === pg.path) links[i].remove();
        }, function (failed) {
            if (failed.length) return;
            delete changes[pg.path]; drops[pg.path] = true;
            var st = steps.pop(), st2 = function () { st(); delete drops[pg.path]; }; st2.label = 'Removed page ' + pg.name; steps.push(st2); refresh();
            say(pg.name + ' is out of the menu. Done takes the page away; Undo brings it back.');
        });
    }
    /* a version comes in as a change: shown at once, Undo takes it back, Done makes it live; nothing is written yet.
       The header and footers are the site's, not one page's: the version's come back on every page, and each page
       keeps its menu as it is now, so pages added, renamed or hidden since stay so. */
    function putBack(pg, at, box) {
        box.textContent = 'Getting it…';
        var label = at ? when(at) : 'the original';
        fetch('/api/history', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(at ? { key: key, path: pg.path, at: at, get: true } : { key: key, path: pg.path, get: true }) })
            .then(function (r) { return r.json(); })
            .then(function (j) {
                if (!j.ok) { box.textContent = j.message || 'Could not get that version.'; return; }
                if (busy) { box.textContent = 'One moment: the other pages are still being changed.'; return; }
                if (editing) commit(); if (held) unhold(); if (picked) unpick(); hideTools(); hoverNone();
                var vd = parse(j.html), parts = sharedParts(vd);
                var paths = otherPages(); if (paths.indexOf(pg.path) < 0 && pg.path !== here()) paths.push(pg.path);
                job(function (finish) {
                    var was = pageHtml(), wasWords = wordsOf(document), led = ledger();
                    var bare = function (html) { /* the stamp sits wherever the server put it: compared without it, the head's blank space set aside */
                        var d = parse(html), m = d.querySelector('meta[name="tweakfast-updated"]'); if (m) m.remove();
                        if (d.head) Array.prototype.slice.call(d.head.childNodes).forEach(function (n) { if (n.nodeType === 3 && !n.data.trim()) n.remove(); });
                        return serialize(d);
                    };
                    var into = function (path, doc, now) { /* the version's page, or another page taking the version's shared parts; `now` = that page as it is, so an unchanged page is not written */
                        if (path === pg.path) { if (path !== here()) putMeta(doc, 'meta[name="tweakfast-updated"]', 'name', 'tweakfast-updated', j.updated || ''); } /* the live page's stamp, so Done is not refused as stale */
                        if (path === here()) { putContent(doc); if (path === pg.path) setWords(here(), wordsOf(doc), null); }
                        else { var out = serialize(doc); if (now === undefined || bare(now) !== bare(out)) led.put(path, out); }
                    };
                    if (pg.path === here()) { giveParts(vd, sharedParts(parse(pageHtml()))); into(here(), vd); }
                    else { var mine = parse(pageHtml()); if (giveParts(mine, null, parts)) into(here(), mine); }
                    eachPage(paths, function (path, html) {
                        if (html === null) return;
                        if (path === pg.path) { giveParts(vd, sharedParts(parse(html))); into(path, vd, html); }
                        else { var doc = parse(html); if (giveParts(doc, null, parts)) into(path, doc); }
                    }, function () {
                        if (pageHtml() === was && !led.wrote()) { /* already so: no change to count, nothing for Done */
                            view = { kind: 'pages' }; finish();
                            say((pg.path === here() ? 'The page' : pg.name) + ' is already ' + (at ? 'as it was at ' + label : label) + '. Nothing to make live.');
                            return;
                        }
                        var st = function () { putContent(parse(was)); setWords(here(), wasWords, null); led.back(); }; st.label = 'Put back ' + label + (pg.path === here() ? '' : ' on ' + pg.name); steps.push(st);
                        view = { kind: 'pages' }; finish();
                        say(pg.path === here() ? 'The page is as it was at ' + label + '. Done makes it live, Undo takes it back.'
                            : pg.name + ' is as it was at ' + label + '. Open it to see; Done makes it live, Undo takes it back.');
                    });
                });
            }, function () { box.textContent = 'Could not get that version.'; });
    }
    /* shared parts into a page: with `from`, the page's own menu goes into its own parts (they come from a version);
       with `parts`, those parts take the page's place, each keeping the page's menu; says if anything changed */
    function giveParts(doc, from, parts) {
        var mine = sharedParts(doc);
        if (from) { mine.forEach(function (p, i) { if (from[i]) ownMenu(p, from[i]); }); return; }
        var changed = false;
        parts.forEach(function (p, i) {
            if (!mine[i]) return;
            var c = doc.importNode(p, true); ownMenu(c, mine[i]);
            if (c.outerHTML !== mine[i].outerHTML) { mine[i].replaceWith(c); changed = true; }
        });
        return changed; /* the page needs saving only when a part is different */
    }
    function ownMenu(part, from) { /* the links only: a logo beside them stays the version's */
        var a = menuIn(part), b = menuIn(from);
        if (!a.length || !b.length) return;
        b.forEach(function (l) { a[0].parentElement.insertBefore(part.ownerDocument.importNode(l, true), a[0]); });
        a.forEach(function (l) { l.remove(); });
    }
    function menuIn(part) {
        var nav = part.matches('nav') && part.querySelector('a[href]') ? part : menuOf(part);
        return nav ? menuLinks(nav) : [];
    }
    /* the page's own content (everything in the body that is not ours) made like another document's, IN PLACE: what is the
       same stays the same node, what moved is moved, what changed is changed where it is. So every Undo step, the site's own
       scripts and our listeners still hold the elements they knew; swapping the nodes would leave them all pointing at nothing. */
    function putContent(doc) {
        morphKids(document.body, doc.body, true); /* both sides compared in the saved form */
        liveHidden(document.body);
        markPictures(); markBlocks();
        mendRows(); mendIds();
        var pics = document.querySelectorAll('img[data-tf-pos]'); for (var i = 0; i < pics.length; i++) enableDrag(pics[i]);
    }
    function ours(n) { return n.nodeType === 1 && (n.hasAttribute('data-tweakfast') || n.id === 'tf-style'); }
    function keyOf(n) { return n.nodeType === 1 ? cleanOuter(n) : n.nodeType + ':' + n.data; }
    function morphKids(live, next, top) {
        var skip = function (n) { return ours(n) || (top && n.nodeType === 1 && n.tagName === 'SCRIPT'); }; /* the page's scripts stay, ours among them */
        var lk = Array.prototype.filter.call(live.childNodes, function (n) { return !skip(n); });
        var nk = Array.prototype.filter.call(next.childNodes, function (n) { return !skip(n); });
        var lkeys = lk.map(keyOf), nkeys = nk.map(function (n) { return n.nodeType === 1 ? n.outerHTML : n.nodeType + ':' + n.data; });
        var used = lk.map(function () { return false; }), at = 0, i, j;
        for (i = 0; i < nk.length; i++) {
            while (at < lk.length && used[at]) at++;
            var anchor = at < lk.length ? lk[at] : null, n = nk[i], got = -1;
            for (j = at; j < lk.length + at && got < 0; j++) { var q = j % lk.length; if (!used[q] && lkeys[q] === nkeys[i]) got = q; } /* the same thing, the nearest first: kept, moved here if it was elsewhere */
            if (got < 0 && anchor && anchor.nodeType === n.nodeType && (n.nodeType !== 1 || (anchor.tagName === n.tagName && anchor.id === n.id)) && nkeys.indexOf(lkeys[at], i + 1) < 0) got = at; /* changed where it is */
            if (got < 0) { live.insertBefore(document.importNode(n, true), anchor); continue; }
            used[got] = true;
            var node = lk[got];
            if (node !== anchor) live.insertBefore(node, anchor);
            if (lkeys[got] === nkeys[i]) continue;
            if (node.nodeType !== 1) { node.data = n.data; continue; }
            var a, names = [];
            for (j = 0; j < node.attributes.length; j++) names.push(node.attributes[j].name);
            names.forEach(function (nm) { if (!n.hasAttribute(nm)) node.removeAttribute(nm); });
            for (j = 0; j < n.attributes.length; j++) { a = n.attributes[j]; if (node.getAttribute(a.name) !== a.value) node.setAttribute(a.name, a.value); }
            morphKids(node, n, false);
        }
        for (j = 0; j < lk.length; j++) if (!used[j]) lk[j].remove();
    }
    /* "10:34 today", "yesterday at 10:34", "3 Oct at 10:34": for the sentence about work that came back */
    function backWhen(iso) {
        var d = new Date(iso); if (isNaN(d)) return iso;
        var t = d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }), now = new Date(), y = new Date(now); y.setDate(now.getDate() - 1);
        if (d.toDateString() === now.toDateString()) return t + ' today';
        if (d.toDateString() === y.toDateString()) return 'yesterday at ' + t;
        return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: d.getFullYear() === now.getFullYear() ? undefined : 'numeric' }) + ' at ' + t;
    }
    function when(iso) {
        var d = new Date(iso); if (isNaN(d)) return iso;
        var today = new Date(), same = d.toDateString() === today.toDateString();
        return (same ? 'Today' : d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: d.getFullYear() === today.getFullYear() ? undefined : 'numeric' })) + ', ' + d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
    }
    function slugOf(name) {
        var s = name.toLowerCase().replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss');
        s = s.normalize ? s.normalize('NFD').replace(/[̀-ͯ]/g, '') : s;
        return s.replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    }
    var stampOf = {};          /* each other page's saved stamp as this visit read it */
    function loadPage(path, cb) {
        if (path === here()) { cb(pageHtml()); return; }
        if (changes[path] !== undefined) { cb(changes[path]); return; }
        fetch(path, { cache: 'no-store' }).then(function (r) { if (!r.ok) throw r.status; return r.text(); }).then(function (html) {
            if (loaded[path] === undefined) { var d = parse(html); stampOf[path] = takeUpdated(d); loaded[path] = serialize(d); } /* as it was, for Undo past Done */
            cb(html);
        }, function (st) { cb(null, st === 404 || st === 410); }); /* the second answer: there is no such page (not: it could not be reached) */
    }
    function parse(html) { return new DOMParser().parseFromString(html, 'text/html'); }
    function serialize(doc) { return '<!doctype html>\n' + doc.documentElement.outerHTML.replace(/ data-tf-mend="[^"]*"/g, ''); } /* a mend's mark that came along with a part never lands */
    /* run fn(nav, doc) on the menu of every page; the current page in place, the others into changes */
    function everyMenu(fn, after) {
        var cur = here(), paths = otherPages();
        job(function (finish) {
            var navBefore = menuOf(document).innerHTML, headBefore = robotsOf(document), led = ledger(), failed = [];
            var core = pageList().map(function (p) { return p.path; }).concat(Object.keys(changes)), sig = function (nav) { return menuLinks(nav).map(pathOf).sort().join('|'); }, mine = sig(menuOf(document));
            fn(menuOf(document), document);
            eachPage(paths, function (path, html, missing) {
                var named = core.indexOf(path) >= 0; /* a page the menu names, or one changed here; else one only found through links */
                if (html === null) { if (!missing && named) failed.push(path); return; } /* a menu link to a page that does not exist has no menu to keep in step */
                var doc = parse(html), nav = menuOf(doc); if (nav && (named || sig(nav) === mine)) { fn(nav, doc); led.put(path, serialize(doc)); } /* a found page only when its menu is this one (not a pager, not a breadcrumb) */
            }, function () {
                var back = function () { menuOf(document).innerHTML = navBefore; putRobots(document, headBefore); led.back(); };
                var navAfter = menuOf(document).innerHTML, headAfter = robotsOf(document), afterCh = {}; led.paths().forEach(function (k) { afterCh[k] = changes[k]; });
                var again = function () { menuOf(document).innerHTML = navAfter; putRobots(document, headAfter); for (var k in afterCh) changes[k] = afterCh[k]; };
                if (failed.length) { /* all pages or none: a menu that differs from page to page is worse than no change */
                    back(); finish(); if (panel) renderPages();
                    say('Could not reach ' + failed.join(', ') + ', so nothing was changed. Check the connection, then try again.', 'error');
                    after(failed); return;
                }
                var step = function () { back(); if (panel) renderPages(); }; steps.push(step);
                finish();
                after(failed, again, step);
            });
        });
    }
    /* fn(doc) on this page and on every other page of the site (the menu's, the ones found, the ones changed); this
       page in place, the others into changes. One step: a page that cannot be read leaves everything as it was. */
    function everyPage(fn, after) {
        var paths = otherPages();
        job(function (finish) {
            var led = ledger(), failed = [], added = [];
            var mark = new MutationObserver(function (list) { list.forEach(function (m) { Array.prototype.forEach.call(m.addedNodes, function (n) { added.push(n); }); }); });
            mark.observe(document.body, { childList: true, subtree: true }); fn(document, here()); mark.takeRecords().forEach(function (m) { Array.prototype.forEach.call(m.addedNodes, function (n) { added.push(n); }); }); mark.disconnect();
            added = added.filter(function (n) { return !(n.nodeType === 1 && n.closest && n.closest('[data-tweakfast]')); });
            if (added.length) { markBlocks(); }
            eachPage(paths, function (path, html, missing) {
                if (html === null) { if (!missing) failed.push(path); return; }
                var doc = parse(html); if (fn(doc, path)) led.put(path, serialize(doc));
            }, function () {
                var where = [], afterCh = {}; led.paths().forEach(function (k) { afterCh[k] = changes[k]; });
                var back = function () { where = added.map(function (n) { return { n: n, parent: n.parentNode, next: n.nextSibling }; }); added.forEach(function (n) { if (n.parentNode) n.parentNode.removeChild(n); }); led.back(); };
                var again = function () { where.forEach(function (x) { if (x.parent && !x.n.parentNode) x.parent.insertBefore(x.n, x.next && x.next.parentNode === x.parent ? x.next : null); }); for (var k in afterCh) changes[k] = afterCh[k]; };
                if (failed.length) { back(); finish(); say('Could not reach ' + failed.join(', ') + ', so nothing was changed. Check the connection, then try again.', 'error'); after(failed); return; }
                var step = function () { back(); if (panel) renderPages(); }; steps.push(step);
                finish(); after(failed, again, step);
            });
        });
    }
    /* the rows of a list that link to a page (repeated items, outside the header, menu and footers): after the last of
       each list, a twin of that page's row, its words placeholders, its name the new page's, its link the new page */
    function listRows(d, likePath, path, name) {
        var shared = sharedParts(d), nav = menuOf(d), seen = [], n = 0;
        Array.prototype.forEach.call(d.querySelectorAll('a[href]'), function (a) {
            if (pathOf(a) !== likePath || !isPageLink(a) || a.closest('[data-tweakfast]') || (nav && nav.contains(a)) || shared.some(function (p) { return p.contains(a); })) return;
            var item = a; while (item && item !== d.body && !(item.parentElement && isRepeated(item))) item = item.parentElement;
            if (!item || item === d.body || seen.indexOf(item.parentElement) >= 0 || rowPage(item) !== likePath) return; /* a list whose rows each lead to a page of their own, not a sentence or a section that mentions it */
            seen.push(item.parentElement);
            var sig = signature(item), last = item; for (var c = item.parentElement.firstElementChild; c; c = c.nextElementSibling) if (signature(c) === sig && !c.hasAttribute('data-tweakfast')) last = c;
            var twin = item.cloneNode(true);
            freshIds(twin, d);
            [twin].concat(Array.prototype.slice.call(twin.querySelectorAll('*'))).forEach(function (x) { x.removeAttribute('aria-current'); x.removeAttribute('data-tf-hidden'); x.removeAttribute('hidden'); x.classList && x.classList.remove('tf-hover', 'tf-editing', 'tf-picture', 'tf-moving'); });
            [twin].concat(Array.prototype.slice.call(twin.querySelectorAll('a[href]'))).forEach(function (x) { if (x.tagName === 'A' && pathOf(x) === likePath) x.setAttribute('href', path); });
            var label = Array.prototype.filter.call(twin.querySelectorAll('*'), function (x) { return !x.children.length && x.textContent.trim().toLowerCase() === fileName(likePath).toLowerCase(); })[0] || twin.querySelector('h1,h2,h3,h4,h5,h6');
            var nums = numbersIn(twin);
            fillPlaceholders(twin); nextNumbers(twin, nums, item);
            if (label) label.textContent = name; /* the row is named for its page; the rest waits for the owner's words */
            var gap = last.nextSibling && last.nextSibling.nodeType === 3 && !last.nextSibling.nodeValue.trim() ? last.nextSibling.nodeValue : '';
            last.parentNode.insertBefore(twin, last.nextSibling); if (gap) last.parentNode.insertBefore(d.createTextNode(gap), twin);
            n++;
        });
        return n;
    }
    /* the robots line of a page's head (a hidden page says noindex), kept and put back with the menu */
    function robotsOf(doc) { var m = doc.querySelector('meta[name="robots"]'); return m ? m.outerHTML : null; }
    function putRobots(doc, outer) {
        var m = doc.querySelector('meta[name="robots"]'); if (m) m.remove();
        if (outer) { var t = doc.createElement('template'); t.innerHTML = outer; doc.head.appendChild(doc.importNode(t.content, true)); }
    }
    function motion() { return matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth'; } /* reduced motion: the page jumps, it does not glide */
    function copy(o) { var c = {}; for (var k in o) c[k] = o[k]; return c; }
    function setPageHidden(path, on) {
        if (path === homePath()) { say('Home cannot be hidden.', 'error'); return; }
        say('Working…');
        everyMenu(function (nav, doc) {
            var links = menuLinks(nav);
            for (var i = 0; i < links.length; i++) if (pathOf(links[i]) === path) {
                if (on) { links[i].setAttribute('hidden', ''); links[i].setAttribute('data-tf-hidden', ''); }
                else { links[i].removeAttribute('hidden'); links[i].removeAttribute('data-tf-hidden'); }
            }
            if (pageOf(doc) === path) noindex(doc, on);
        }, function (failed, again, step) {
            if (!failed.length) say((on ? 'Hidden from the menu on every page. The page itself is kept.' : 'Back in the menu on every page.'));
            if (!failed.length && step) { var nm = (pageList().concat(otherList()).filter(function (pg) { return pg.path === path; })[0] || { name: fileName(path) }).name; step.label = (on ? 'Hid page ' : 'Showed page ') + nm; }
        });
        /* the page itself, when it is not in the list of menus (it always is, but be safe) */
    }
    function pageOf(doc) {
        if (doc === document) return here();
        var cur = doc.querySelector('nav a[aria-current]');
        return cur ? pathOf(cur) : null;
    }
    function noindex(doc, on) {
        var m = doc.querySelector('meta[name="robots"]');
        if (on) { if (!m) { m = doc.createElement('meta'); m.setAttribute('name', 'robots'); doc.head.appendChild(m); } m.setAttribute('content', 'noindex'); m.setAttribute('data-tf-noindex', ''); }
        else if (m && m.hasAttribute('data-tf-noindex')) m.remove();
    }
    function addPage(likePath, name) {
        name = (name || '').trim();
        if (!name) { say('Give the new page a name first.', 'error'); return; }
        var slug = slugOf(name); if (!slug) { say('That name needs some letters or numbers.', 'error'); return; }
        var path = slug + '.html';
        var taken = pageList().filter(function (p) { return p.path === path; })[0];
        if (taken || changes[path] !== undefined) { say('There is already a page called ' + (taken ? taken.name : name) + '.', 'error'); return; }
        say('Working…');
        /* a file of that name may exist outside the menu (a legal page linked from the footer): never written over */
        fetch(path, { method: 'HEAD', cache: 'no-store' }).then(function (r) { return r.ok; }, function () { return false; }).then(function (exists) {
        if (exists) { say('This site already has a page at ' + path + '. Choose another name.', 'error'); return; }
        loadPage(likePath, function (html) {
            if (html === null) { say('Could not read ' + likePath + '.', 'error'); return; }
            var doc = parse(html);
            doc.title = name;
            var main = doc.querySelector('main') || doc.body;
            var kids = main.children, keep = [];
            for (var i = 0; i < kids.length; i++) if (!/^(SCRIPT|STYLE|HEADER|NAV|FOOTER)$/.test(kids[i].tagName)) keep.push(kids[i]);
            keep.forEach(function (k) { if (k.hasAttribute('data-tf-hidden')) k.remove(); else fillPlaceholders(k); });
            var h1 = main.querySelector('h1'); if (h1) h1.textContent = name;
            noindex(doc, false);
            var nav = menuOf(doc), cur = nav && nav.querySelectorAll('a[aria-current]');
            for (i = 0; cur && i < cur.length; i++) cur[i].removeAttribute('aria-current');
            changes[path] = serialize(doc);
            /* the new page goes where the page it is like is linked: the menu when that page is in it, and every list on
               the site that links to it (a list of projects, of posts, of rooms) gets a row of its own, a twin of that
               page's row. With neither, the menu still takes it when there is one; else words the owner picks link to it. */
            var hasMenu = menuEntries(menuOf(document)).length > 0, inMenu = menuEntries(menuOf(document)).some(function (a) { return pathOf(a) === likePath; });
            var rows = [], likeName = (pageList().concat(otherList()).filter(function (pg) { return pg.path === likePath; })[0] || { name: fileName(likePath) }).name;
            var agains = [], mine = []; /* the steps this made, found by themselves: a word typed meanwhile stays its own step */
            var outNotes = [], takeOut = function () { mine.forEach(function (f) { var i = steps.lastIndexOf(f); if (i >= 0) { steps.splice(i, 1); if (notes.length > i) outNotes.push(notes.splice(i, 1)[0]); } }); };
            var finished = function (failed, viaMenu) {
                if (failed.length) { takeOut(); mine.slice().reverse().forEach(function (f) { f(); }); delete changes[path]; refresh(); return; }
                freshPages[path] = true;
                var at = mine.length ? steps.lastIndexOf(mine[0]) : -1, html0 = changes[path], parts = mine.slice(), undoAll = function () { parts.slice().reverse().forEach(function (f) { f(); }); delete changes[path]; delete freshPages[path]; };
                undoAll.label = 'Added page ' + name; takeOut(); if (at >= 0 && at <= steps.length) { steps.splice(at, 0, undoAll); if (notes.length >= at && outNotes[0]) { outNotes[0].fn = undoAll; outNotes[0].label = undoAll.label; notes.splice(at, 0, outNotes[0]); } else if (notes.length > at) notes.length = at; } /* its name in the changes list goes with it */ else steps.push(undoAll);
                refresh(); /* one Undo takes the links, the rows and the new file */
                freshWays[path] = { back: undoAll, again: function () { agains.forEach(function (f) { f(); }); changes[path] = html0; freshPages[path] = true; } }; /* Remove the page, and Undo of that */
                if (panel) openView({ kind: 'pages' });
                var where = rows.length ? 'a new row where ' + likeName + ' is listed' + (rows.indexOf(here()) < 0 ? ' (on ' + rows.map(function (p) { var pg = pageList().concat(otherList()).filter(function (x) { return x.path === p; })[0]; return pg ? pg.name : fileName(p); }).join(', ') + ')' : '') + '; fill in its words there' : '';
                if (viaMenu && where) say('Page added, in the menu on every page and with ' + where + '. Press Done to save it.');
                else if (viaMenu) say('Page added and in the menu on every page. Press Done to save it, then open it from the menu.');
                else if (where) say('Page added, with ' + where + '. Press Done to save it.');
                else if (footerLinkRow()) say('Page added. Nothing links to it yet: its row\u2019s menu can link it from the footer, or pick it under Goes to on any words. Press Done to save it.');
                else say('Page added to Pages. Nothing on this site lists ' + likeName + ', so to link to the new page, click any words, then choose it under Goes to. Press Done to save it.');
            };
            everyPage(function (d, at) { var n = listRows(d, likePath, path, name); if (n && at !== path && rows.indexOf(at) < 0) rows.push(at); return n > 0; }, function (failed, again, step) {
                if (again) agains.push(again); if (step) mine.push(step);
                if (failed.length) { finished(failed); return; }
                if (!hasMenu || (!inMenu && rows.length)) { finished([], false); return; }
                everyMenu(function (nav, d) {
                    addEntry(nav, d, path, name, d !== document && pageOf(d) === null && d.title === name);
                }, function (failed2, again2, step2) { if (!failed2.length) { mine.push(step2); agains.push(again2); } finished(failed2, true); });
            });
        });
        });
        return true;
    }

    /* ---- undo, done ---- */
    /* Redo: before an Undo runs, the page as it is now is kept; Shift+Cmd+Z puts it back, until a new change is made */
    var redos = [], stepsSeen = 0;
    function snapshot() { return { html: pageHtml(), words: wordsOf(document), changes: copy(changes), drops: copy(drops), fresh: copy(freshPages), robots: robotsOf(document) }; }
    function restore(sn) {
        if (editing) commit(); if (held) unhold(); if (picked) unpick(); hideTools(); hoverNone();
        putContent(parse(sn.html)); setWords(here(), sn.words, null); changes = sn.changes;
        if (sn.drops) drops = sn.drops; if (sn.fresh) freshPages = sn.fresh; if (sn.robots !== undefined) putRobots(document, sn.robots);
    }
    /* after an Undo or Redo: nothing stays picked, framed or asked about on an element that is no longer on the page */
    function settle() {
        var gone = function (n) { return n && !document.contains(n); };
        if (gone(altFor)) { if (altBox && altBox.parentNode) altBox.remove(); altFor = null; }
        if (gone(picked)) unpick();
        if (gone(held)) unhold();
        if (gone(linkFor)) hideLink();
        if (gone(toolsFor)) hideTools();
        if (gone(hoverEl)) hoverNone();
    }
    function undo() {
        if (saving || waitWork()) return;
        if (editing) cancel();
        if (!steps.length) { if (saves.length) undoSave(); return; }
        var step = steps.pop(), sn = snapshot();
        if (step) { step(); sn.label = step.label; }
        redos.push(sn); stepsSeen = steps.length;
        settle(); refresh(); say('');
        if (altFor) altInput.value = altFor.getAttribute('alt') || ''; /* the open field shows what Undo put back */
        if (toolsFor) showTools(toolsFor);
    }
    function redo() {
        if (saving || waitWork() || !redos.length) return;
        var sn = redos.pop(), now = snapshot();
        restore(sn);
        var st = function () { restore(now); }; st.label = sn.label; steps.push(st);
        stepsSeen = steps.length; settle(); refresh(); say('');
    }
    /* Undo past Done: the site goes back to how it was before the last Done of this visit */
    /* Undo past Done: the site as it was before the last Done comes back as a change; Done makes it live, Undo takes it back */
    function undoSave() {
        var last = saves.pop(); if (!last) return;
        var now = snapshot(), fresh = [], path, n = 0;
        for (path in last.files) {
            if (last.files[path] === null) { fresh.push(path); continue; } /* a page that Done created stays; it cannot be taken away here */
            n++;
            if (path === here()) { restore({ html: last.files[path], words: wordsOf(parse(last.files[path])), changes: changes }); }
            else { var d = parse(last.files[path]); putMeta(d, 'meta[name="tweakfast-updated"]', 'name', 'tweakfast-updated', last.at || ''); changes[path] = serialize(d); }
        }
        if (!n) { saves.push(last); say('That Done only added pages, and pages are not taken away here.', 'error'); return; }
        var st = function () { restore(now); saves.push(last); }; st.label = 'Back to before the last Done'; steps.push(st);
        stepsSeen = steps.length; refresh();
        say('The site is as it was before the last Done. Done makes it live, Undo takes it back.' + (fresh.length ? ' Pages added then stay.' : ''));
    }
    var era = 0;               /* goes up with every change and every Undo: what was worked out before is stale */
    function refresh() {
        era++;
        if (locked) return;
        still(function () { roomsNow(document); coverGround(document); });
        if (steps.length > stepsSeen) redos.length = 0; /* a new change: what Undo took away is gone for good */
        stepsSeen = steps.length;
        undoBtn.disabled = saving || busy > 0 || (!steps.length && !saves.length);
        doneBtn.disabled = saving || busy > 0 || !steps.length;
        doneCount.textContent = steps.length; doneCount.style.visibility = steps.length ? 'visible' : 'hidden';
        noteSteps();
        if (menu && menu.classList.contains('tf-changes')) { if (steps.length) showChanges(); else closeMenu(); }
        if (panel) renderPages();
        pageLabel();
        laterDraft();
    }
    /* ---- the changes list ----
       The count on Done opens a list of what is not live yet, newest first: each change named by what it did, Show
       goes to it, Undo takes back that one alone. Undo steps are plain functions, so each one is named here by
       comparing the page before and after it: the smallest part that changed, and how. */
    var notes = [], lastHtml = null, lastChanges = '';
    function changesSig() { return Object.keys(changes).sort().map(function (k) { return k + '\u0000' + changes[k]; }).join('\u0001'); }
    function noteSteps() {
        if (notes.length > steps.length) notes.length = steps.length;
        if (!steps.length) { notes.length = 0; lastHtml = quietHtml(); lastChanges = changesSig(); return; } /* where the next change starts from */
        var now = quietHtml(), nowCh = changesSig(), i;
        if (lastHtml === null) lastHtml = now;
        var top = notes[notes.length - 1];
        if (notes.length === steps.length && top && top.fn !== steps[steps.length - 1]) { /* the last step took in more (merged): named again from where it began */
            notes[notes.length - 1] = noteOf(top.from, now, top.fromCh !== nowCh, steps[steps.length - 1], top.fromCh);
        }
        for (i = notes.length; i < steps.length; i++) notes.push(noteOf(lastHtml, now, lastChanges !== nowCh, steps[i], lastChanges));
        notes.forEach(function (n) { if (n.fn && n.fn.label) n.label = n.fn.label; }); /* a step named after its note was made (the menu steps name themselves once every page answered) */
        lastHtml = now; lastChanges = nowCh;
    }
    function snippet(n) {
        var h = n.querySelector && n.querySelector('h1,h2,h3,h4,h5,h6'); /* a card or section goes by its heading */
        var t = ((h || n).textContent || '').replace(/\s+/g, ' ').trim();
        if (t) return '“' + (t.length > 34 ? t.slice(0, 33).trim() + '…' : t) + '”';
        if (n.tagName === 'IMG' || n.querySelector && n.querySelector('img')) return 'a picture';
        return /^(SECTION|HEADER|FOOTER|ARTICLE|MAIN|ASIDE)$/.test(n.tagName) ? 'a section' : 'a part';
    }
    function ownSig(n) {
        var a = [], i;
        for (i = 0; i < n.attributes.length; i++) a.push(n.attributes[i].name + '=' + n.attributes[i].value);
        for (i = 0; i < n.childNodes.length; i++) if (n.childNodes[i].nodeType === 3) a.push('#' + n.childNodes[i].data);
        return a.join('\u0000');
    }
    /* a step that names itself (fn.label: a version put back, a page added or removed) keeps that name; the diff still finds what to Show */
    function noteOf(fromHtml, toHtml, others, fn, fromCh) {
        var note = noteDiff(fromHtml, toHtml, others, fn, fromCh);
        if (fn && fn.label) note.label = fn.label;
        return note;
    }
    function noteDiff(fromHtml, toHtml, others, fn, fromCh) {
        var note = { fn: fn, from: fromHtml, fromCh: fromCh, others: others, label: others ? 'Changed other pages' : 'Changed the page', area: null, before: null, show: null };
        var a = parse(fromHtml).body, b = parse(toHtml).body;
        if (!a || !b || a.outerHTML === b.outerHTML) return note;
        var ak, bk, diff, i;
        for (;;) {
            ak = a.children; bk = b.children;
            if (ak.length !== bk.length || ownSig(a) !== ownSig(b)) break;
            diff = [];
            for (i = 0; i < ak.length; i++) if (ak[i].outerHTML !== bk[i].outerHTML) diff.push(i);
            if (diff.length !== 1) break;
            a = ak[diff[0]]; b = bk[diff[0]];
        }
        note.area = b.outerHTML; note.before = a.outerHTML; note.tag = b.tagName; note.show = note.area; note.showTag = b.tagName;
        var label;
        if (ak.length !== bk.length && ownSig(a) === ownSig(b)) {
            for (i = 0; i < Math.min(ak.length, bk.length) && ak[i].outerHTML === bk[i].outerHTML; i++) {}
            if (bk.length > ak.length) { label = 'Added ' + snippet(bk[i]); note.show = bk[i].outerHTML; note.showTag = bk[i].tagName; }
            else label = 'Removed ' + snippet(ak[i]);
        } else if (diff && diff.length > 1 && ownSig(a) === ownSig(b) && Array.prototype.map.call(ak, function (n) { return n.outerHTML; }).sort().join() === Array.prototype.map.call(bk, function (n) { return n.outerHTML; }).sort().join()) {
            label = 'Moved ' + snippet(bk[diff[0]]); note.show = bk[diff[0]].outerHTML; note.showTag = bk[diff[0]].tagName;
        } else {
            var srcs = function (n) { return Array.prototype.map.call(n.tagName === 'IMG' ? [n] : n.querySelectorAll('img'), function (m) { return m.getAttribute('src') + '|' + m.getAttribute('alt'); }); };
            var sa = srcs(a), sb = srcs(b), hidden = b.hasAttribute('hidden') && !a.hasAttribute('hidden');
            var shown = a.hasAttribute('hidden') && !b.hasAttribute('hidden');
            if (hidden) label = 'Hid ' + snippet(b);
            else if (shown) label = 'Showed ' + snippet(b);
            else if (a.textContent.replace(/\s+/g, ' ') !== b.textContent.replace(/\s+/g, ' ')) label = 'Changed words ' + snippet(b);
            else if (sa.map(function (x) { return x.split('|')[0]; }).join() !== sb.map(function (x) { return x.split('|')[0]; }).join()) label = 'New picture';
            else if (sa.join() !== sb.join()) label = 'Picture description';
            else if (Array.prototype.map.call(a.querySelectorAll('a'), function (n) { return n.getAttribute('href'); }).join() !== Array.prototype.map.call(b.querySelectorAll('a'), function (n) { return n.getAttribute('href'); }).join() || a.getAttribute('href') !== b.getAttribute('href')) label = 'New link on ' + snippet(b);
            else label = 'New look on ' + snippet(b);
        }
        note.label = label;
        return note;
    }
    /* the live element that is this clean HTML, found by its tag; null when it is not there, or not once */
    function liveOf(outer, tag) {
        if (!outer) return null;
        var all = document.body.getElementsByTagName(tag), hit = null, i;
        for (i = 0; i < all.length; i++) if (!all[i].closest('[data-tweakfast]') && cleanOuter(all[i]) === outer) { if (hit) return null; hit = all[i]; }
        return hit;
    }
    function toggleChanges() { if (menu && menu.classList.contains('tf-changes')) closeMenu(); else showChanges(); }
    function showChanges() {
        if (!steps.length) return;
        if (editing) commit();
        noteSteps();
        var keep = menu && menu.classList.contains('tf-changes') ? menu.scrollTop : 0;
        closeMenu(); closePal();
        menu = el('div', 'tf-menu tf-changes'); menu.back = doneBtn; menu.setAttribute('data-tweakfast', ''); menu.setAttribute('role', 'dialog'); menu.setAttribute('aria-label', 'Changes not live yet');
        menu.appendChild(el('div', 'tf-menu-label', steps.length === 1 ? 'One change, not live yet' : steps.length + ' changes, not live yet'));
        for (var k = notes.length - 1; k >= 0; k--) (function (k) {
            var note = notes[k], row = el('div', 'tf-row'), acts = el('span', 'tf-row-acts');
            var name = el('span', 'tf-row-name', note.label); row.appendChild(name);
            if (note.show) acts.appendChild(button('Show', function () { showChange(note); }));
            acts.appendChild(button('Undo', function () { undoOne(k); }));
            row.appendChild(acts); menu.appendChild(row);
        })(k);
        document.body.appendChild(menu);
        var r = doneBtn.getBoundingClientRect(), w = menu.offsetWidth, h = menu.offsetHeight;
        menu.style.left = Math.max(8, Math.min(r.right - w, window.innerWidth - w - 8)) + 'px';
        menu.style.top = Math.max(8, bar.getBoundingClientRect().top - h - 8) + 'px';
        menu.scrollTop = keep;
        setTimeout(function () { if (menu) { document.addEventListener('pointerdown', menuAway, true); window.addEventListener('scroll', menuScroll, true); } }, 0);
        var first = menu.querySelector('button'); if (first && !keep) first.focus();
    }
    function showChange(note) {
        closeMenu();
        var t = liveOf(note.show, note.showTag) || liveOf(note.area, note.tag);
        if (!t || t === document.body) { say(t ? 'That change is the whole page.' : 'That part has changed again since.', t ? '' : 'error'); return; }
        while (t.parentElement && t.parentElement !== document.body && !t.getClientRects().length) t = t.parentElement; /* a hidden part: its place */
        t.scrollIntoView({ block: 'center', behavior: motion() });
        var box = el('span', 'tf-hover-box tf-flash'); box.setAttribute('data-tweakfast', ''); document.body.appendChild(box);
        var tick = function () { if (box.parentNode) { frame(box, t.getBoundingClientRect(), t); box.style.display = 'block'; } };
        tick(); var iv = setInterval(tick, 50);
        setTimeout(function () { clearInterval(iv); fade(box); }, 1600);
    }
    /* Undo on a row: the newest is a plain Undo; an older one alone, when its part is as it left it and only this page changed */
    function undoOne(k) {
        if (saving || waitWork()) return;
        if (k === steps.length - 1) { undo(); return; }
        var note = notes[k], after = steps.length - 1 - k;
        var cur = note.area && !note.others && note.tag !== 'BODY' ? parse(pageHtml()) : null, hit = null, all, i;
        if (cur) { all = cur.body.getElementsByTagName(note.tag); for (i = 0; i < all.length; i++) if (all[i].outerHTML === note.area) { if (hit) { hit = null; break; } hit = all[i]; } }
        if (!hit) {
            closeMenu();
            say(note.others ? 'That change also reached other pages, so it goes back with the ' + (after === 1 ? 'change' : after + ' changes') + ' after it.' : 'A later change touched the same part, so it goes back with the ' + (after === 1 ? 'change' : after + ' changes') + ' after it.', 'stay');
            offer('Undo ' + (after + 1) + ' changes', function () { for (var n = 0; n <= after; n++) undo(); });
            asking = true;
            return;
        }
        var tmp = cur.createElement('template'); tmp.innerHTML = note.before; hit.parentNode.replaceChild(cur.importNode(tmp.content, true), hit);
        var now = snapshot();
        restore({ html: serialize(cur), words: now.words, changes: now.changes });
        steps.splice(k, 1); notes.splice(k, 1); redos.length = 0; stepsSeen = steps.length;
        lastHtml = quietHtml();
        refresh(); say('Taken back: ' + note.label.charAt(0).toLowerCase() + note.label.slice(1) + '.');
        if (steps.length) showChanges();
    }
    var saving = false;        /* Done and Undo rest while a save is in flight */
    function save(force, then) { /* then: what to do once the save has gone through (Make live and leave) */
        if (saving || waitWork()) return;
        if (editing) commit();
        if (!steps.length) return;
        if (!saver) { /* the route did not answer on arrival: asked once more before falling back to files */
            if (noRoute) { downloadAll(); return; }
            say('Saving…');
            findSaver(function () { if (saver) save(force, then); else if (noRoute) downloadAll(); else say('Could not reach the site. Check the connection, then press Done again.', 'error'); });
            return;
        }
        var files = {}, pictures = {}, updated = {}, stamp = Date.now(), count = 0;
        var html = pageHtml(), cur = parse(html), hereChanged = html !== loaded[here()];
        var same = {}, named = extractPictures(cur, pictures, stamp, function () { return count++; }, same);
        if (hereChanged) { files[here()] = serialize(cur); updated[here()] = pageUpdated; } /* a page that did not change is not written again */
        for (var k in changes) { if (drops[k]) continue; var d = parse(changes[k]); updated[k] = takeUpdated(d); extractPictures(d, pictures, stamp, function () { return count++; }, same); files[k] = serialize(d); }
        var drop = Object.keys(drops);
        drop.forEach(function (d) { if (stampOf[d] !== undefined && updated[d] === undefined) updated[d] = stampOf[d]; }); /* a page removed is checked like one saved */
        if (!Object.keys(files).length && !drop.length) { steps.length = 0; refresh(); say('Nothing has changed, so nothing needed saving.'); return; }
        var before = {}; for (var f in files) before[f] = loaded[f] === undefined ? null : loaded[f];
        say('Saving ' + countLine().replace(/\.$/, '…')); saving = true; refresh();
        var sentSteps = steps.length, sentChanges = {}; for (var c in changes) sentChanges[c] = changes[c]; /* edits made while saving stay counted */
        fetch(saver, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ key: key, files: files, pictures: pictures, updated: updated, force: !!force, drop: drop }) })
            .then(function (r) {
                return r.text().then(function (t) {
                    var j; try { j = JSON.parse(t); } catch (e) { j = { ok: false }; }
                    j.status = r.status; return j;
                });
            })
            .then(function (j) {
                saving = false;
                tookWritten(j, files);
                if (j.conflict) {
                    refresh();
                    say(j.message || 'This page was changed elsewhere since you opened it.');
                    offer('Keep mine', function () { save(true, then); });
                    offer('Take theirs', function () { steps.length = 0; location.reload(); });
                    return;
                }
                if (!j.ok) { var f = failure(j); refresh(); say(f.text, 'error'); if (f.files) offer('Save as files', function () { downloadAll(true); }); return; }
                if (j.demo) demo = true;
                /* the new pictures now exist on the host under their names (a demo keeps them in the page as they are) */
                if (!demo) named.forEach(function (n) { if (n.img) n.img.setAttribute('src', n.path); else n.box.setAttribute('style', n.box.getAttribute('style').replace(n.from, 'url("' + n.path + '")')); });
                if (j.at && hereChanged && !demo) pageUpdated = j.at; /* only this page's stamp: when only others were saved, it is still what it was */
                saves.push({ files: before, at: j.at }); for (var f in files) loaded[f] = files[f];
                if (hereChanged) loaded[here()] = named.reduce(function (h, n) { return n.src ? h.split(n.src).join(n.path) : h; }, html); /* the page as it went live (not as it is now: an edit made while saving is still to come) */
                steps.splice(0, sentSteps);
                for (var c in sentChanges) if (changes[c] === sentChanges[c]) delete changes[c];
                drop.forEach(function (d) { delete drops[d]; delete loaded[d]; });
                for (var fp in files) { delete freshPages[fp]; if (found && found.indexOf(fp) < 0) found.push(fp); } /* saved: a page of the site now, listed as found */
                refresh();
                if (then) { then(); return; }
                var left = stillPlaceholder(), word = left.every(function (x) { return x.word === left[0].word; }) ? '\u201c' + (left.length && left[0].word) + '\u201d' : 'their placeholder', still = !left.length ? '' : ' ' + (left.length === 1 ? 'One new button still says' : left.length + ' new buttons still say') + ' ' + word + '.';
                if (demo) { say('Done. In this demo only you see it. On your own site, everyone would.' + still, 'live'); later(8000); return; }
                say('Live.' + still, 'live');
                offer('See the page', function () { window.open(location.pathname + location.search + '#view', '_blank'); });
                later(8000);
            }).catch(function (e) {
                saving = false; refresh();
                say(e instanceof TypeError ? 'Could not reach the site. Check the connection, then press Done again.' : ((e && e.message) || 'Saving failed. Your changes are still here; press Done again.'), 'error');
            });
    }
    /* when the tab comes back to the front: was this page saved elsewhere meanwhile? Told early, not at Done. */
    var warnedStamp = '';
    function stillCurrent() {
        if (!saver || locked || saving || asking) return;
        fetch(location.pathname + location.search, { cache: 'no-store' }).then(function (r) { return r.ok ? r.text() : null; }).then(function (t) {
            if (t === null) return;
            var m = /<meta name="tweakfast-updated" content="([^"]*)"/.exec(t), now = m ? m[1] : '';
            if (now === pageUpdated || now === warnedStamp) return;
            warnedStamp = now;
            if (!steps.length) {
                say('This page was changed elsewhere. Reload to see it.', 'stay');
                offer('Reload', function () { location.reload(); });
            } else say('This page was changed elsewhere since you opened it. Your changes are kept here; Done will ask which to keep.', 'stay');
        }, function () {});
    }
    /* what happened, then what to do; never a code or a file name. The detail goes to the console. */
    /* pages that went live although the save as a whole did not: they carry their new stamps, so the next Done is not
       refused as "changed elsewhere" over the owner's own half-save */
    function tookWritten(j, files) {
        var w = j && j.written; if (!w || j.ok) return;
        for (var p in w) {
            if (!(p in files)) continue;
            loaded[p] = files[p];
            if (p === here()) pageUpdated = w[p];
            else if (changes[p] !== undefined) { var d = parse(changes[p]); putMeta(d, 'meta[name="tweakfast-updated"]', 'name', 'tweakfast-updated', w[p]); changes[p] = serialize(d); }
        }
    }
    function failure(j) {
        var m = j.message || '', st = j.status;
        if (m) try { console.warn('Tweakfast: ' + st + ' ' + m); } catch (e) {}
        if (st === 403) return { text: 'This link no longer works. Ask the person who set up the site for a new one. Your changes can be saved as files meanwhile.', files: true };
        if (st === 413) return { text: /picture/i.test(m) ? 'A picture is too large to save. Choose a smaller one.' : 'This page is too large to save. Undo the last big change.' };
        if (st === 503 && /not set up/i.test(m)) return { text: m + ' Ask the person who set up the site.', files: true };
        if (st >= 500 || st === 0) return { text: 'The site could not save right now. Wait a moment, then press Done again.' };
        return { text: 'Something went wrong and nothing was saved. Press Done again; if it keeps happening, ask the person who set up the site.' };
    }
    /* the served page says when it was last saved; the tag is taken out so it is never saved back */
    function takeUpdated(doc) {
        var m = doc.querySelector('meta[name="tweakfast-updated"]');
        if (!m) return '';
        var v = m.getAttribute('content') || '';
        m.remove();
        return v;
    }
    /* the pages as files, pictures written into them (a file on its own computer has nowhere else to keep them) */
    function downloadAll(dead) {
        var files = {}; files[here()] = pageHtml();
        for (var k in changes) if (!drops[k]) { var d = parse(changes[k]); takeUpdated(d); files[k] = serialize(d); }
        download(files, dead);
    }
    function download(files, dead) {
        Object.keys(files).forEach(function (path) {
            var blob = new Blob([files[path]], { type: 'text/html' });
            var a = el('a'); a.href = URL.createObjectURL(blob); a.download = path;
            document.body.appendChild(a); a.click(); a.remove();
        });
        steps.length = 0; changes = {}; refresh();
        say(dead ? 'Saved as files on your computer.' : 'Saved as files on your computer. This site has no saving route yet.', 'stay');
    }
    /* data-URL pictures become files: pictures/tf-<stamp>-<n>.<ext>; returns the live imgs to rename after a save */
    function extractPictures(doc, pictures, stamp, next, same) { /* same: one file for one picture, however many pages hold it (a new logo) */
        same = same || {};
        var imgs = doc.querySelectorAll('img[src^="data:"]'), out = [];
        for (var i = 0; i < imgs.length; i++) {
            var src = imgs[i].getAttribute('src'), m = /^data:image\/(png|jpeg|gif|webp);base64,/.exec(src);
            if (!m) continue;
            var path = same[src] || (same[src] = 'pictures/tf-' + stamp + '-' + next() + '.' + (m[1] === 'jpeg' ? 'jpg' : m[1]));
            pictures[path] = src.slice(m[0].length);
            imgs[i].setAttribute('src', path);
            if (doc !== document) { /* find the same picture in the live page, to rename after the save */
                var live = document.querySelectorAll('img[src^="data:"]');
                for (var j = 0; j < live.length; j++) if (live[j].getAttribute('src') === src) { out.push({ img: live[j], src: src, path: path }); break; }
            }
        }
        /* a photo laid into a drawn box is in its inline style; it becomes a file the same way */
        var boxes = doc.querySelectorAll('[style*="data:image"]');
        for (i = 0; i < boxes.length; i++) {
            var st = boxes[i].getAttribute('style'), mm = /url\("?(data:image\/(png|jpeg|gif|webp);base64,([^")]+))"?\)/.exec(st);
            if (!mm) continue;
            var bpath = same[mm[1]] || (same[mm[1]] = 'pictures/tf-' + stamp + '-' + next() + '.' + (mm[2] === 'jpeg' ? 'jpg' : mm[2]));
            pictures[bpath] = mm[3];
            boxes[i].setAttribute('style', st.replace(mm[0], 'url("' + bpath + '")'));
            if (doc !== document) { var lb = document.querySelectorAll('[style*="data:image"]'); for (j = 0; j < lb.length; j++) if (lb[j].getAttribute('style') === st) { out.push({ box: lb[j], from: mm[0], path: bpath }); break; } }
        }
        return out;
    }
    function pageHtml() { finishTransients(); return quietHtml(); }
    function quietHtml() { /* the page as it is, without finishing a move mid-way */
        var doc = document.documentElement.cloneNode(true);
        scrub(doc);
        var junk = doc.querySelectorAll('[data-tweakfast],[contenteditable]');
        for (var i = 0; i < junk.length; i++) junk[i].hasAttribute('data-tweakfast') ? junk[i].remove() : junk[i].removeAttribute('contenteditable');
        var cls = doc.querySelectorAll('.tf-picture,.tf-editing,.tf-hover,.tf-moving');
        for (i = 0; i < cls.length; i++) { cls[i].classList.remove('tf-picture', 'tf-editing', 'tf-hover', 'tf-moving'); if (!cls[i].className) cls[i].removeAttribute('class'); }
        var s = doc.querySelector('#tf-style'); if (s) s.remove();
        Array.prototype.forEach.call(doc.querySelectorAll('style[data-tf-id]'), function (st) { if (!doc.querySelector('[id="' + st.getAttribute('data-tf-id') + '"]')) st.remove(); }); /* a copy's rules after the copy was removed */
        if (doc.querySelector('body')) savedHidden(doc.querySelector('body'));
        var t = doc.querySelector('title'); if (t) t.textContent = realTitle;
        var cls2 = doc.querySelectorAll('.tf-on'); for (i = 0; i < cls2.length; i++) cls2[i].classList.remove('tf-on');
        var marks = doc.querySelectorAll('[data-tf-block],[data-tf-art],[data-tf-mend]'); /* data-tf-mend: tweakfast-mend.js */
        for (i = 0; i < marks.length; i++) { marks[i].removeAttribute('data-tf-block'); marks[i].removeAttribute('data-tf-art'); marks[i].removeAttribute('data-tf-mend'); }
        var empty = doc.querySelectorAll('[style=""],[class=""]');
        for (i = 0; i < empty.length; i++) { empty[i].removeAttribute('style'); empty[i].removeAttribute('class'); }
        return hostClean('<!doctype html>\n' + doc.outerHTML);
    }
    /* the host adds marked blocks to every page it serves; they must not be saved, or they would pile up */
    function hostClean(html) {
        return html.replace(/<!-- spacefast:([\w-]+) -->[\s\S]*?<!-- \/spacefast:\1 -->\n?/g, '');
    }
    /* nothing unsaved: leave at once. Otherwise the bubble asks; a click elsewhere or Esc stays. */
    var asking = false;
    /* Preview: the editor steps out of the way, hidden blocks are gone as readers would find them, nothing can be
       clicked or typed; one small pill at the bottom, or Esc, brings the editor back with every change still there */
    function enterPreview() {
        if (previewing || locked) return;
        if (editing) commit(); if (held) unhold(); if (picked) unpick(); hideTools(); hoverNone(); closePages(); closePal(); hideLink(); say('');
        previewing = true;
        document.getElementById('tf-style').classList.add('tf-previewing');
        peek = el('div', 'tf-peek'); peek.setAttribute('data-tweakfast', '');
        peek.appendChild(button('Back to editing', leavePreview));
        document.body.appendChild(peek);
        peek.firstChild.focus();
    }
    function leavePreview() {
        if (!previewing) return;
        previewing = false;
        document.getElementById('tf-style').classList.remove('tf-previewing');
        if (peek) fade(peek); peek = null;
        refresh();
        previewBtn.focus();
    }
    function leave_() {
        if (editing) commit();
        if (!steps.length) { go(); return; }
        var n = steps.length;
        say(n === 1 ? 'One change is not live yet.' : n + ' changes are not live yet.', 'stay');
        offer('Make live and leave', function () { save(false, go); });
        offer('Leave anyway', function () { steps.length = 0; go(); });
        asking = true;
        function go() {
            try { localStorage.removeItem(STORE); } catch (e) {}
            location.replace(location.pathname + location.search); /* without the key in the address */
        }
    }

    /* ---- small helpers ---- */
    /* a sentence in the bubble above the bar. A plain one goes after a few seconds; an error, or one that
       gets buttons (offer), stays until the next sentence. An empty one takes the bubble away. */
    function say(t, kind) {
        if (locked) return;
        clearTimeout(noteTimer); noteTimer = 0; asking = false;
        status.textContent = ''; /* the words in a span of their own: a grid row of their own beside the mark; a button sits on its own row under the words, never beside them */
        if (t) { var words = el('span', 'tf-status-text'); words.textContent = t; status.appendChild(words); }
        status.classList.toggle('tf-error', kind === 'error');
        status.classList.toggle('tf-live', kind === 'live');
        status.classList.toggle('tf-show', !!t);
        if (t) { placeNote(); if (kind !== 'error' && kind !== 'stay') later(6000); }
    }
    function later(ms) { clearTimeout(noteTimer); noteTimer = setTimeout(function () { noteTimer = 0; if (!status.querySelector('button') || ms > 6000) say(''); }, ms); }
    function placeNote() {
        if (toolsFor && tools.classList.contains('tf-tools-dock')) { /* the phone's tool strip: just above the bar (and the welcome card); it steps aside while a sheet is up, and when its block has scrolled away */
            var r = toolsFor.getBoundingClientRect(), under = bar.getBoundingClientRect().top;
            if (card) under = Math.min(under, card.getBoundingClientRect().top);
            tools.style.bottom = (window.innerHeight - under + 8) + 'px';
            tools.style.visibility = r.bottom < 0 || r.top > window.innerHeight || panel || pal ? 'hidden' : '';
        }
        if (!status.classList.contains('tf-show')) return;
        var top = bar.getBoundingClientRect().top;
        if (card) top = Math.min(top, card.getBoundingClientRect().top);
        if (panel) top = Math.min(top, panel.getBoundingClientRect().top);
        if (toolsFor && tools.classList.contains('tf-tools-dock') && tools.style.visibility !== 'hidden') top = Math.min(top, tools.getBoundingClientRect().top); /* the phone's tool strip */
        status.style.bottom = (window.innerHeight - top + 12) + 'px';
    }
    function countLine() {
        var n = steps.length, pg = Object.keys(changes).filter(function (k) { return !drops[k]; }).length;
        if (n && pageHtml() !== loaded[here()]) pg++; /* this page only when it changed */
        pg = Math.max(pg, 1);
        return n + (n === 1 ? ' change' : ' changes') + ' on ' + pg + (pg === 1 ? ' page.' : ' pages.');
    }
    function offer(label, fn) { clearTimeout(noteTimer); noteTimer = 0; var b = button(label, fn); b.className += ' tf-offer'; status.appendChild(document.createTextNode(' ')); status.appendChild(b); placeNote(); }
    function coarse() { return !!(window.matchMedia && matchMedia('(pointer: coarse)').matches); } /* a finger, not a mouse */
    function el(tag, cls, text) { var n = document.createElement(tag); if (cls) n.className = cls; if (text) n.textContent = text; return n; }
    function button(label, fn) { var b = el('button', 'tf-button', label); b.type = 'button'; b.addEventListener('click', fn); return b; }
    /* a button that shows a shape and says its word to the tooltip, to screen readers and to the checks */
    function iconButton(icon, word, fn) { var b = el('button', 'tf-button tf-icon'); b.type = 'button'; b.addEventListener('click', fn); relabel(b, icon, word); return b; }
    function relabel(b, icon, word) { b.innerHTML = ICON[icon] + '<span class="tf-word"></span>'; b.lastChild.textContent = word; tip(b, word); b.setAttribute('aria-label', word); b.setAttribute('data-icon', icon); }
    /* Tooltips, one rule. A tooltip says the word a control has no room for, and its key; it never explains (sentences belong in Help).
       It opens over a shape: the icon buttons, the grip, the check mark, the plus, the count on Done. A worded button gets one only
       to show its key (Undo, Done); a button whose word is on its face gets none, and the bar, the name of the page and the
       fields get none. A finger never sees one (nothing to rest). The pointer rests 500 ms first; once one is open, a neighbour
       opens at once (300 ms of warmth). A Tab onto a shape shows it too. It sits centred 6 above the control, below only when
       there is no room above, and goes on a press, a key, a scroll, a resize or when the control goes. One element, the bar's glass. */
    var tipEl, tipFor, tipTimer = 0, tipWarm = 0;
    function tip(n, word, key) { n.removeAttribute('title'); if (!word) { n.removeAttribute('data-tf-tip'); n.removeAttribute('data-tf-key'); return; } n.setAttribute('data-tf-tip', word); if (key) n.setAttribute('data-tf-key', key); else n.removeAttribute('data-tf-key'); }
    function tipOf(n) { return n && n.closest ? n.closest('[data-tf-tip]') : null; }
    function showTip(n) {
        clearTimeout(tipTimer); tipTimer = 0;
        if (!tipEl) { tipEl = el('div', 'tf-tip'); tipEl.setAttribute('data-tweakfast', ''); tipEl.setAttribute('role', 'tooltip'); document.body.appendChild(tipEl); }
        var fresh = !tipFor; tipFor = n;
        tipEl.textContent = n.getAttribute('data-tf-tip'); var k = n.getAttribute('data-tf-key'); if (k) tipEl.appendChild(el('span', 'tf-tip-key', k));
        tipEl.classList.remove('tf-out'); if (fresh) { tipEl.classList.remove('tf-show'); void tipEl.offsetWidth; } /* fresh: the rise plays again; a neighbour: it only moves */
        tipEl.classList.add('tf-show'); placeTip();
    }
    function placeTip() {
        if (!tipFor || !tipFor.isConnected || !tipFor.getClientRects().length) { hideTip(true); return; }
        var r = tipFor.getBoundingClientRect(), w = tipEl.offsetWidth, h = tipEl.offsetHeight, x = Math.round(r.left + r.width / 2 - w / 2), y = Math.round(r.top - 6 - h), below = y < 8;
        if (below) y = Math.round(r.bottom + 6);
        tipEl.style.left = Math.max(8, Math.min(x, window.innerWidth - 8 - w)) + 'px'; tipEl.style.top = y + 'px'; tipEl.classList.toggle('tf-tip-below', below);
    }
    function hideTip(now) {
        clearTimeout(tipTimer); tipTimer = 0;
        if (!tipFor) return;
        tipFor = null; tipWarm = Date.now();
        if (now) { tipEl.classList.remove('tf-show'); tipEl.classList.remove('tf-out'); return; }
        tipEl.classList.add('tf-out'); tipEl.addEventListener('animationend', function () { if (!tipFor) { tipEl.classList.remove('tf-show'); tipEl.classList.remove('tf-out'); } }, { once: true });
    }
    function tipsOn() {
        if (!(window.matchMedia && matchMedia('(hover: hover) and (pointer: fine)').matches)) return; /* a finger has nothing to rest */
        document.addEventListener('pointerover', function (e) {
            var n = tipOf(e.target); if (n === tipFor) return; clearTimeout(tipTimer); tipTimer = 0;
            if (!n) { hideTip(); return; }
            if (tipFor || Date.now() - tipWarm < 300) showTip(n); else tipTimer = setTimeout(function () { showTip(n); }, 500);
        }, true);
        document.addEventListener('pointerout', function (e) { if (!e.relatedTarget) hideTip(); }, true); /* the pointer left the window */
        document.addEventListener('focusin', function (e) { var n = tipOf(e.target), vis = false; try { vis = !!n && n.matches(':focus-visible'); } catch (x) {} if (vis) showTip(n); }, true);
        document.addEventListener('focusout', function (e) { if (tipFor && tipOf(e.target) === tipFor) hideTip(true); }, true);
        ['pointerdown', 'keydown', 'wheel', 'scroll'].forEach(function (k) { document.addEventListener(k, function () { hideTip(true); }, true); });
        window.addEventListener('resize', function () { hideTip(true); });
    }
    function injectStyle() {
        var s = el('style', darkGround() ? 'tf-light' : ''); s.id = 'tf-style';
        s.textContent =
            '.tf-bar,.tf-status,.tf-link,.tf-tools,.tf-panel,.tf-card,.tf-menu,.tf-peek,.tf-tip{--tf-time:.25s;--tf-spring:cubic-bezier(.3,1.2,.4,1);--tf-x:0;--tf-y:6px;--tf-accent:#0a84ff;--tf-ok:#30d158;--tf-bad:#ff453a;--tf-font:-apple-system,BlinkMacSystemFont,"Segoe UI",system-ui,sans-serif;--tf-fill:rgba(255,255,255,.1);--tf-fill-hover:rgba(255,255,255,.18);--tf-fill-press:rgba(255,255,255,.26);--tf-muted:rgba(245,245,247,.6);--tf-hairline:rgba(255,255,255,.12);--tf-primary:#fff;--tf-primary-ink:#1d1d1f;--tf-lift:rgba(58,58,62,.96);--tf-result:#8ab4f8;--tf-bad-ink:#ff6b61;--tf-on-fill:rgba(10,132,255,.24);--tf-on-ink:#9ccaff;--tf-bad-fill:rgba(255,69,58,.18);--tf-bad-fill-hover:rgba(255,69,58,.3);color:#f5f5f7;background:rgba(28,28,30,.78);-webkit-backdrop-filter:blur(24px) saturate(1.6);backdrop-filter:blur(24px) saturate(1.6);box-shadow:0 10px 30px rgba(0,0,0,.22),0 1px 2px rgba(0,0,0,.12),inset 0 0 0 1px rgba(255,255,255,.1);box-sizing:border-box;-webkit-font-smoothing:antialiased}' +
            ':root:has(#tf-style.tf-light) :is(.tf-bar,.tf-status,.tf-link,.tf-tools,.tf-panel,.tf-card,.tf-menu,.tf-peek,.tf-tip){--tf-fill:rgba(0,0,0,.06);--tf-fill-hover:rgba(0,0,0,.1);--tf-fill-press:rgba(0,0,0,.16);--tf-muted:rgba(29,29,31,.55);--tf-hairline:rgba(0,0,0,.08);--tf-primary:#1d1d1f;--tf-primary-ink:#fff;--tf-lift:rgba(255,255,255,.98);--tf-result:#1a0dab;--tf-bad-ink:#d70015;--tf-on-fill:rgba(10,132,255,.16);--tf-on-ink:#0a84ff;--tf-bad-fill:rgba(255,69,58,.14);--tf-bad-fill-hover:rgba(255,69,58,.26);color:#1d1d1f;background:rgba(250,250,252,.82);box-shadow:0 10px 30px rgba(0,0,0,.22),0 1px 2px rgba(0,0,0,.12),inset 0 0 0 1px rgba(0,0,0,.08)}' +
            '@keyframes tf-in{from{opacity:0;transform:translate(var(--tf-x),var(--tf-y)) scale(.96)}to{opacity:1;transform:translate(var(--tf-x),0) scale(1)}}@keyframes tf-out{to{opacity:0;transform:translate(var(--tf-x),var(--tf-y)) scale(.97)}}@keyframes tf-view{from{opacity:0;transform:translateX(var(--tf-dx,14px))}}' +
            '.tf-bar,.tf-panel,.tf-card,.tf-menu,.tf-tools,.tf-link,.tf-peek{animation:tf-in var(--tf-time) var(--tf-spring) both}.tf-bar,.tf-panel,.tf-card,.tf-peek,.tf-status{--tf-x:-50%}.tf-panel{--tf-y:10px;transform-origin:50% 100%}.tf-menu{--tf-y:-6px;transform-origin:100% 0}.tf-tools{transform-origin:50% 100%}.tf-link{--tf-y:-6px;transform-origin:0 0}.tf-out{animation:tf-out .15s ease-in both;pointer-events:none}.tf-sheet-body.tf-forward{animation:tf-view var(--tf-time) var(--tf-spring) both}.tf-sheet-body.tf-back{--tf-dx:-14px;animation:tf-view var(--tf-time) var(--tf-spring) both}' +
            '.tf-status{opacity:0;visibility:hidden;transform:translate(-50%,6px) scale(.97);transition:opacity .15s ease-in,visibility .15s,transform .15s ease-in}.tf-status.tf-show{opacity:1;visibility:visible;transform:translate(-50%,0) scale(1);transition:opacity var(--tf-time),visibility 0s,transform var(--tf-time) var(--tf-spring)}' +
            /* the site's own rules for plain tags (button, input, a, p) must not reach the editor's parts; one class deep, so every rule below still wins */
            '[data-tweakfast],[data-tweakfast] :where(*){letter-spacing:normal;word-spacing:normal;text-transform:none;text-shadow:none;text-indent:0;float:none;font-style:normal}[data-tweakfast]{text-align:left}[data-tweakfast] :where(button,input,select,textarea){margin:0;min-width:0;max-width:none;box-shadow:none}[data-tweakfast] :where(a){text-decoration:none}' +
            /* the tooltip: 12px on the glass of the bar, a smaller shadow than the menus (it is a word, not a sheet), the key in the muted ink; no apostrophe in these comments, the lab tools read the quotes */
            '.tf-tip{position:fixed;left:0;top:0;display:none;z-index:2147483002;padding:5px 8px;border-radius:6px;font:500 12px/1.25 var(--tf-font);white-space:nowrap;pointer-events:none;--tf-time:.15s;--tf-y:4px;animation:tf-in var(--tf-time) var(--tf-spring) both;box-shadow:0 4px 14px rgba(0,0,0,.18),0 1px 2px rgba(0,0,0,.12),inset 0 0 0 1px rgba(255,255,255,.1)}.tf-tip.tf-show{display:block}.tf-tip.tf-tip-below{--tf-y:-4px}.tf-tip.tf-out{animation:tf-out .15s ease-in both}.tf-tip-key{margin-left:6px;color:var(--tf-muted);font-weight:400}:root:has(#tf-style.tf-light) .tf-tip{box-shadow:0 4px 14px rgba(0,0,0,.14),0 1px 2px rgba(0,0,0,.1),inset 0 0 0 1px rgba(0,0,0,.08)}' +
            '@media(prefers-reduced-motion:reduce){[data-tweakfast],[data-tweakfast] *{animation-duration:0s!important;transition-duration:0s!important}}' +
            '.tf-bar{position:fixed;left:50%;bottom:16px;transform:translateX(-50%);display:flex;align-items:center;gap:3px;max-width:calc(100% - 32px);padding:4px;border-radius:12px;font:13.5px/1.3 var(--tf-font);z-index:2147483000}' +
            '.tf-bar .tf-button{height:32px;font-size:13.5px}.tf-sep{flex:none;width:1px;height:18px;margin:0 4px;background:var(--tf-hairline)}.tf-bar .tf-sym{display:none}.tf-pages{gap:5px}.tf-pages>svg{width:16px;height:16px;opacity:.7;margin:0 -4px 0 -2px;flex:none}.tf-page-name{max-width:220px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.tf-item .tf-row-tag,.tf-item-check{margin-left:auto}.tf-item-check{display:inline-flex;color:var(--tf-muted)}.tf-item-check svg{width:16px;height:16px}.tf-item.tf-here{font-weight:600}' +
            '.tf-button{appearance:none;display:inline-flex;align-items:center;justify-content:center;gap:6px;height:32px;padding:0 11px;border:0;border-radius:8px;background:transparent;color:inherit;font:400 13.5px/1 var(--tf-font);cursor:pointer;transition:background .12s,transform .08s;white-space:nowrap;box-sizing:border-box}' +
            '.tf-button:hover{background:var(--tf-fill-hover)}.tf-button:active{background:var(--tf-fill-press);transform:scale(.98)}.tf-button:focus-visible{outline:2px solid var(--tf-accent);outline-offset:2px}.tf-button:disabled{opacity:.38;cursor:default;transform:none}.tf-button:disabled:hover{background:transparent}' +
            '.tf-button.tf-primary{background:var(--tf-primary);color:var(--tf-primary-ink);font-weight:600}.tf-button.tf-primary:hover{background:var(--tf-primary);filter:brightness(.94)}.tf-button.tf-primary:disabled{background:transparent;color:inherit}.tf-button.tf-primary:disabled:hover{background:transparent}.tf-button.tf-quiet{background:transparent;color:inherit;opacity:.7}.tf-button.tf-quiet:hover{background:var(--tf-fill-hover);opacity:1}.tf-button.tf-on,.tf-button.tf-on:hover{background:var(--tf-on-fill);color:var(--tf-on-ink)}' +
            '.tf-count{display:inline-block;min-width:18px;height:18px;padding:0 5px;border-radius:6px;background:var(--tf-accent);color:#fff;font-size:11px;font-weight:600;line-height:18px;text-align:center;visibility:hidden;box-sizing:border-box}' +
            '.tf-status{position:fixed;left:50%;width:max-content;display:grid;grid-template-columns:auto 1fr;column-gap:8px;row-gap:8px;align-items:start;max-width:min(460px,calc(100% - 32px));padding:11px 14px;border-radius:12px;font:13.5px/1.4 var(--tf-font);z-index:2147483000;text-align:left;text-wrap:pretty}' +
            '.tf-status.tf-error::before{content:"";display:block;grid-column:1;margin-top:2.5px;width:14px;height:14px;background:url("data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 viewBox=%270 0 14 14%27%3E%3Ccircle cx=%277%27 cy=%277%27 r=%277%27 fill=%27%23ff453a%27/%3E%3Cpath d=%27M7 3.6v4.2%27 stroke=%27%23fff%27 stroke-width=%271.7%27 stroke-linecap=%27round%27/%3E%3Ccircle cx=%277%27 cy=%2710.4%27 r=%27.95%27 fill=%27%23fff%27/%3E%3C/svg%3E") center/contain no-repeat}' +
            '.tf-status.tf-live::before{content:"";display:block;grid-column:1;margin-top:2.5px;width:14px;height:14px;background:url("data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 viewBox=%270 0 14 14%27%3E%3Ccircle cx=%277%27 cy=%277%27 r=%277%27 fill=%27%2330d158%27/%3E%3Cpath d=%27M4 7.2l2 2 4-4.4%27 fill=%27none%27 stroke=%27%23fff%27 stroke-width=%271.6%27 stroke-linecap=%27round%27 stroke-linejoin=%27round%27/%3E%3C/svg%3E") center/contain no-repeat}' +
            '.tf-status .tf-status-text{grid-column:1/-1;min-width:0}.tf-status:is(.tf-error,.tf-live) .tf-status-text{grid-column:2}.tf-offer{grid-column:1/-1;justify-self:start;height:26px;padding:0 10px;margin:0;font-size:13.5px}.tf-status:is(.tf-error,.tf-live) .tf-offer{grid-column:2}' +
            '.tf-editing{min-height:1em;outline:0}.tf-edit-box{position:absolute;display:none;box-sizing:border-box;border:2px solid #0a84ff;border-radius:4px;pointer-events:none;z-index:2147482999}' +
            '.tf-hover{cursor:text}img.tf-hover,[data-tf-art].tf-hover{cursor:pointer}.tf-link.tf-art .tf-link-label,.tf-link.tf-art .tf-input{display:none}.tf-link.tf-art{padding-left:4px}.tf-hover-box,.tf-block-hover,.tf-block-box{position:absolute;display:none;box-sizing:border-box;border:1px dashed #0a84ff;opacity:1;border-radius:4px;pointer-events:none;z-index:2147482999}.tf-block-box.tf-block-selected{border:2px solid #0a84ff;opacity:1}.tf-block-box.tf-block-inner{border:1px dashed #0a84ff;opacity:1}.tf-block-box.tf-block-moving{border:2px solid #0a84ff;opacity:1;box-shadow:0 12px 32px rgba(0,0,0,.18)}' +
            '.tf-tag{position:absolute;display:none;height:18px;padding:0 6px;border-radius:6px;background:#0a84ff;color:#fff;font:500 11px/18px -apple-system,BlinkMacSystemFont,"Segoe UI",system-ui,sans-serif;letter-spacing:.02em;white-space:nowrap;pointer-events:none;z-index:2147483000}' +
            '.tf-link{position:absolute;display:flex;align-items:center;gap:6px;padding:4px 4px 4px 12px;border-radius:12px;font:13.5px/1.2 var(--tf-font);z-index:2147483000}' +
            ':root:has(#tf-style) .tf-tools .tf-link.tf-link-in{position:static;transform:none;animation:none;background:none;-webkit-backdrop-filter:none;backdrop-filter:none;box-shadow:none;flex:1 0 100%;order:99;min-width:0;margin-top:4px;padding:4px 0 0;border-top:1px solid var(--tf-hairline);gap:3px;z-index:auto}.tf-tools:has(.tf-link-in){flex-wrap:wrap}:root:has(#tf-style) .tf-tools.tf-less>.tf-in-more{display:none}:root:has(#tf-style) .tf-tools:not(.tf-less)>.tf-more{display:none}.tf-tools.tf-less>.tf-more{margin-left:auto}.tf-item:disabled{opacity:.4;cursor:default}.tf-item .tf-keys{margin-left:auto}.tf-link-in .tf-link-label{display:none}.tf-link-field{position:relative;display:flex;flex:1 1 0;width:0;min-width:72px;align-items:center}.tf-link-mark{display:none;position:absolute;left:10px;top:50%;transform:translateY(-50%);width:14px;height:14px;color:var(--tf-muted);pointer-events:none}.tf-link-mark svg{width:14px;height:14px;display:block}.tf-link-in .tf-link-mark{display:block}.tf-link.tf-link-in .tf-input{flex:1 1 auto;width:100%;min-width:0;padding:0 10px 0 31px;border-radius:8px}' +
            /* the list of pages under the link field: our own, not the datalist of the browser; the glass of the menu, rows like the palette */
            '.tf-menu.tf-pages-list{--tf-y:-6px;transform-origin:0 0;width:auto;min-width:240px;max-width:360px;max-height:264px;overflow:auto;padding:4px}.tf-page-item{height:40px;gap:10px;border-radius:8px}.tf-page-item:hover{background:none}.tf-page-item.tf-lit{background:var(--tf-fill)}.tf-page-item .tf-page-name{flex:0 1 auto;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.tf-page-file{margin-left:auto;flex:none;color:var(--tf-muted);font-size:12px}.tf-pages-none{padding:10px 10px 8px;color:var(--tf-muted);font-size:13px}' +
            '.tf-link-label{white-space:nowrap;color:var(--tf-muted)}.tf-link .tf-input{flex:1;height:32px;padding:0 10px;font-size:13.5px;border-radius:8px}.tf-link .tf-small{flex:none;height:32px;padding:0 10px;background:var(--tf-fill)}.tf-link-open{appearance:none;flex:none;display:flex;align-items:center;justify-content:center;width:32px;height:32px;border:0;border-radius:8px;background:var(--tf-fill);color:inherit;cursor:pointer;transition:background .12s}.tf-link-open:hover{background:var(--tf-fill-hover)}.tf-link-open:focus-visible{outline:2px solid var(--tf-accent);outline-offset:2px}' +
            '.tf-words{padding:4px 6px 6px;font-size:13px}.tf-captioned{display:block}.tf-caption{display:block;margin:10px 0 6px 2px;font:500 11px/1.2 var(--tf-font);letter-spacing:.02em;text-transform:uppercase;color:var(--tf-muted)}.tf-words .tf-input,.tf-add .tf-input,.tf-add .tf-select{display:block;width:100%}.tf-words .tf-area{height:32px;min-height:32px;padding:7px 10px;resize:none;line-height:18px;overflow:hidden;box-sizing:border-box}.tf-preview{padding:10px 12px;border-radius:10px;background:var(--tf-fill);font:13px/1.4 arial,sans-serif}.tf-preview-title{color:var(--tf-result);font-size:15px;line-height:1.3;overflow-wrap:anywhere}.tf-preview-url{color:var(--tf-muted);font-size:12px;margin:2px 0 4px}.tf-preview-desc{color:var(--tf-muted)}' +
            '.tf-tools{position:absolute;display:none;align-items:center;gap:3px;padding:4px;border-radius:12px;font:13.5px/1 var(--tf-font);z-index:2147483000}' +
            '.tf-tools.tf-tools-dock{position:fixed;left:8px;right:8px;--tf-x:0;transform:none;max-width:none;justify-content:space-between;overflow-x:auto;scrollbar-width:none}' +
            '.tf-name{display:inline-flex;align-items:center;gap:2px;height:32px;padding:0 8px 0 10px;border-radius:8px;color:var(--tf-muted);font-size:13.5px;white-space:nowrap;flex:none}.tf-name .tf-grip{display:none;width:16px;height:16px;border-radius:0;color:inherit}.tf-name.tf-handle{padding-left:6px;cursor:grab;touch-action:none;user-select:none}.tf-name.tf-handle .tf-grip{display:inline-flex;margin-right:3px}.tf-name.tf-handle:hover{background:var(--tf-fill-hover);color:inherit}.tf-name.tf-handle:active{cursor:grabbing}.tf-name .tf-grip:hover{background:none}' +
            '.tf-tools .tf-button{height:32px;padding:0 11px;font-size:13.5px}.tf-tools .tf-icon{width:32px}.tf-button.tf-icon{padding:0;position:relative}.tf-button svg{width:16px;height:16px;flex:none}.tf-tools .tf-button svg{width:16px;height:16px}.tf-word{position:absolute;width:1px;height:1px;margin:-1px;padding:0;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap;border:0}.tf-button.tf-danger{background:var(--tf-bad-fill);color:var(--tf-bad-ink)}.tf-button.tf-danger:hover{background:var(--tf-bad-fill-hover);color:var(--tf-bad-ink)}' +
            '.tf-grip{display:inline-flex;align-items:center;justify-content:center;width:32px;height:32px;border-radius:8px;color:var(--tf-muted);cursor:grab;touch-action:none;user-select:none;box-sizing:border-box;transition:background .12s,color .12s}.tf-grip svg{width:16px;height:16px}.tf-grip:hover{color:inherit;background:var(--tf-fill-hover)}.tf-grip:active{cursor:grabbing}' +
            '.tf-card{position:fixed;left:50%;transform:translateX(-50%);width:min(340px,calc(100% - 32px));padding:18px 20px 16px;border-radius:18px;font:14px/1.45 var(--tf-font);z-index:2147483000;text-align:left}' +
            '.tf-card-title{margin:0 0 4px;font:600 16px/1.3 var(--tf-font);letter-spacing:-.01em;color:inherit}.tf-card-text{margin:0 0 12px;font:inherit;color:var(--tf-muted)}' +
            '.tf-card .tf-button{background:var(--tf-primary);color:var(--tf-primary-ink);font-weight:600;padding:0 14px}.tf-card .tf-button:hover{filter:brightness(.94)}.tf-card-tip{display:none}' +
            'body.tf-dragging{user-select:none;cursor:grabbing}.tf-moving{opacity:.92;transform:scale(1.015)}' +
            '.tf-plus.tf-plus-under span{visibility:hidden}.tf-plus{display:flex;align-items:center;justify-content:center;padding:8px 0;cursor:pointer;list-style:none}li.tf-plus,dd.tf-plus,dt.tf-plus{justify-content:flex-start;padding:6px 0}tr.tf-plus{display:table-row}tr.tf-plus td{padding:6px 0;border:0}tr.tf-plus td span{margin:0}' +
            '.tf-plus span,tr.tf-plus td span{display:flex;align-items:center;justify-content:center;width:28px;height:28px;box-sizing:border-box;border:1.5px dashed #0a84ff;border-radius:50%;color:#0a84ff;font:300 22px/1 -apple-system,BlinkMacSystemFont,system-ui,sans-serif;background:transparent;transition:background .12s,color .12s,border-color .12s}' +
            '.tf-plus:hover span{background:#0a84ff;color:#fff;border-style:solid}' +
            '.tf-panel{position:fixed;left:50%;bottom:76px;transform:translateX(-50%);display:flex;flex-direction:column;width:min(460px,calc(100% - 32px));padding:0;border-radius:18px;overflow:hidden;font:13px/1.4 var(--tf-font);z-index:2147483000}.tf-sheet-head{display:flex;align-items:center;gap:6px;flex:none;height:48px;padding:0 10px 0 16px;border-bottom:1px solid var(--tf-hairline)}.tf-sheet-head .tf-icon{width:32px;height:32px}.tf-sheet-head .tf-icon:first-child{margin-left:-6px}.tf-sheet-body{overflow:auto;min-height:0;padding:6px 8px 10px}' +
            '.tf-panel-title{flex:1;min-width:0;margin:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font:600 15px/1.2 var(--tf-font)}' +
            '.tf-row{position:relative;display:flex;align-items:center;gap:8px;min-height:40px;padding:0 6px 0 10px;border-radius:10px;font-size:14px;transition:background .12s}.tf-row:has(.tf-row-grip){padding-left:4px}.tf-row:hover,.tf-row.tf-open,.tf-row:focus-within{background:var(--tf-fill)}.tf-row-grip{opacity:0;transition:opacity .12s}.tf-row:hover .tf-row-grip,.tf-row.tf-open .tf-row-grip,.tf-row-moving .tf-row-grip{opacity:1}.tf-row-moving{background:var(--tf-lift);box-shadow:0 8px 24px rgba(0,0,0,.35)}.tf-rename{flex:1;min-width:0;height:28px}.tf-row-note,.tf-row-tag{color:var(--tf-muted);flex:none;height:18px;line-height:18px;font-size:11px;font-weight:600;padding:0 6px;border-radius:6px;background:var(--tf-fill)}.tf-row-hidden .tf-row-name{color:var(--tf-muted)}.tf-row-plain{padding:6px 6px 6px 10px}.tf-row-plain:hover{background:none}.tf-row-plain .tf-row-name{white-space:normal;line-height:1.4;font-size:13px;color:var(--tf-muted);cursor:default}.tf-row-plain .tf-row-name:hover{text-decoration:none}' +
            '.tf-row-name{flex:0 1 auto;min-width:0;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:inherit;text-decoration:none;padding:2px 0}.tf-row-name:hover{text-decoration:underline}.tf-row-name:focus{outline:none}.tf-row-name:focus-visible{outline:2px solid var(--tf-accent);outline-offset:2px;border-radius:4px}.tf-row.tf-here{background:var(--tf-fill)}.tf-row.tf-here:hover{background:var(--tf-fill-hover)}.tf-row.tf-here .tf-row-name{font-weight:600}.tf-row-check{display:inline-flex;align-items:center;justify-content:center;width:28px;height:28px;margin-left:auto;color:var(--tf-muted);flex:none}.tf-row-check svg{width:14px;height:14px}.tf-row-check+.tf-row-acts{margin-left:0}' +
            '.tf-row-acts{display:flex;gap:2px;align-items:center;flex:none;margin-left:auto;opacity:0;transition:opacity .12s}.tf-row:hover .tf-row-acts,.tf-row.tf-open .tf-row-acts,.tf-row:focus-within .tf-row-acts,.tf-versions .tf-row-acts{opacity:1}.tf-row-acts .tf-button{height:28px;padding:0 10px;font-size:13px}.tf-row-acts .tf-icon{width:28px}.tf-versions{padding:2px 0 0;font-size:13px}.tf-versions .tf-row-name{cursor:default}.tf-versions .tf-row-name:hover{text-decoration:none}.tf-versions .tf-caption{margin-left:10px}.tf-menu{position:fixed;width:220px;padding:4px;border-radius:12px;font:13.5px/1 var(--tf-font);z-index:2147483001}.tf-item{appearance:none;display:flex;align-items:center;gap:10px;width:100%;height:32px;padding:0 10px;border:0;border-radius:8px;background:none;color:inherit;font:inherit;text-align:left;cursor:pointer}.tf-item:hover,.tf-item:focus-visible{background:var(--tf-fill);outline:0}.tf-item:focus-visible{box-shadow:inset 0 0 0 2px var(--tf-accent)}.tf-item svg{width:16px;height:16px;color:var(--tf-muted);flex:none}.tf-item.tf-danger{color:var(--tf-bad-ink)}.tf-item.tf-danger svg{color:currentColor}.tf-helps{display:grid;gap:16px;padding:10px 8px 8px}.tf-help-row{display:grid;grid-template-columns:30px 1fr;gap:12px;align-items:start}.tf-help-icon{display:grid;place-items:center;width:30px;height:30px;border-radius:8px;background:var(--tf-fill);color:var(--tf-accent)}.tf-help-icon svg{width:16px;height:16px}.tf-help-title{font:600 13.5px/1.3 var(--tf-font);margin:1px 0 3px}.tf-help{margin:0;font-size:13px;line-height:1.45;color:var(--tf-muted)}.tf-help-keys{display:flex;flex-wrap:wrap;gap:6px 14px}.tf-help-keys span{display:inline-flex;align-items:center;gap:6px}.tf-kbd{display:inline-flex;align-items:center;justify-content:center;min-width:24px;height:20px;padding:0 6px;border-radius:5px;background:var(--tf-fill);box-shadow:0 0 0 1px var(--tf-hairline),0 1px 0 var(--tf-hairline);font:500 11.5px/1 var(--tf-font);color:inherit}.tf-share-line{display:flex;gap:6px;align-items:center}.tf-share-line .tf-input{flex:1;min-width:0}.tf-qr{width:168px;margin:2px 0 10px;border-radius:12px;overflow:hidden;line-height:0}.tf-qr svg{width:100%;height:auto;display:block}.tf-share-note{margin:4px 2px 2px;font-size:13px;line-height:1.45;color:var(--tf-muted)}.tf-changes{width:340px;max-width:calc(100vw - 16px);max-height:50vh;overflow:auto}.tf-changes .tf-row{min-height:36px;padding-right:2px;font-size:13px}.tf-changes .tf-row-name{flex:1 1 auto;font-weight:400;color:inherit}.tf-changes .tf-row-acts{opacity:1}.tf-count{cursor:pointer}.tf-gap{height:1px;background:var(--tf-hairline);margin:6px 4px}.tf-note{padding:6px 10px 4px;color:var(--tf-muted);font-size:12px;line-height:1.4}' +
            '.tf-menu.tf-looks{width:min(340px,calc(100vw - 16px))}.tf-item.tf-look{height:auto;min-height:44px;padding:5px 6px;gap:12px}.tf-look-ground{flex:1 1 auto;min-width:0;display:flex;align-items:center;padding:8px 10px;border-radius:8px;overflow:hidden}.tf-look-sample{display:inline-block;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;line-height:1.2;box-sizing:border-box}.tf-look-word{display:flex;align-items:center;justify-content:flex-end;gap:4px;flex:none;width:92px;color:var(--tf-muted);font-size:12px}.tf-look-word svg{width:13px;height:13px;color:var(--tf-primary)}.tf-item.tf-off{cursor:default}.tf-item.tf-off:hover{background:none}.tf-look-why{flex:1 1 auto;min-width:0;padding:4px 10px;color:var(--tf-muted);font-size:12px;line-height:1.35}.tf-menu.tf-grounds{width:min(280px,calc(100vw - 16px))}.tf-swatch-row{height:auto;min-height:52px;padding:4px;gap:10px}.tf-swatch{flex:1 1 auto;min-width:0;display:flex;align-items:center;height:44px;padding:0 14px;border-radius:9px;box-shadow:inset 0 0 0 1px rgba(127,127,127,.28);font:500 14px/1 var(--tf-font)}.tf-swatch{justify-content:space-between}.tf-swatch-tick{flex:none;display:flex}.tf-swatch-clear{color:#1d1d1f;background-color:#fff;background-image:linear-gradient(45deg,#e5e5ea 25%,transparent 25%,transparent 75%,#e5e5ea 75%),linear-gradient(45deg,#e5e5ea 25%,transparent 25%,transparent 75%,#e5e5ea 75%);background-size:12px 12px;background-position:0 0,6px 6px}.tf-swatch-name{padding:3px 6px;margin-left:-6px;border-radius:5px;background:rgba(255,255,255,.9)}.tf-swatch-tick svg{width:15px;height:15px;color:currentColor}.tf-off .tf-look-word{opacity:.55}.tf-menu-label{padding:8px 10px 4px;color:var(--tf-muted);font-size:12px;font-weight:600}' +
            '.tf-pal-field{display:flex;align-items:center;gap:10px;flex:none;height:48px;padding:0 12px 0 16px;border-bottom:1px solid var(--tf-hairline)}.tf-pal-field svg{width:16px;height:16px;color:var(--tf-muted);flex:none}.tf-pal-input{flex:1;min-width:0;border:0;padding:0;background:none;color:inherit;font:15px/1 var(--tf-font);outline:0}.tf-pal-input::placeholder{color:var(--tf-muted)}' +
            '.tf-key{display:inline-flex;align-items:center;justify-content:center;min-width:20px;height:20px;padding:0 5px;border-radius:5px;background:var(--tf-fill);color:var(--tf-muted);font:500 11px/1 var(--tf-font);box-shadow:inset 0 -1px 0 var(--tf-hairline);flex:none}.tf-keys{display:flex;gap:3px;margin-left:auto}' +
            '.tf-pal .tf-sheet-body{padding:8px 8px 10px}.tf-pal .tf-caption{margin:6px 0 4px 10px}.tf-pal-row{height:40px;padding:0 10px;border-radius:10px;font-size:14px}.tf-pal-row:hover{background:none}.tf-pal-row.tf-lit{background:var(--tf-fill)}.tf-pal-name{flex:0 1 auto;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.tf-pal-row .tf-row-tag{margin-left:auto}.tf-pal-none{padding:10px 10px 6px;color:var(--tf-muted);font-size:13px}' +
            '.tf-add{padding:4px 6px 6px}.tf-add .tf-button{margin-top:14px}' +
            '.tf-select,.tf-input{appearance:none;border:0;border-radius:10px;height:32px;padding:0 10px;font:inherit;background:var(--tf-fill);color:inherit;min-width:0;outline:0;box-sizing:border-box;transition:box-shadow .12s}.tf-select{flex:1}.tf-input{flex:2}.tf-select:focus,.tf-input:focus{outline:0;box-shadow:0 0 0 2px var(--tf-accent)}.tf-input::placeholder{color:var(--tf-muted)}' +
            '[data-tf-hidden]{opacity:.35}nav a[data-tf-hidden]{display:inline!important}' +
            '.tf-bar .tf-icon{width:32px}.tf-peek{position:fixed;left:50%;bottom:16px;transform:translateX(-50%);display:flex;padding:4px;border-radius:12px;font:13.5px/1.3 var(--tf-font);z-index:2147483000}.tf-peek .tf-button{height:32px;padding:0 14px;font-size:13.5px;background:transparent}.tf-peek .tf-button:hover{background:var(--tf-fill-hover)}' +
            ':root:has(#tf-style.tf-previewing) [data-tweakfast]:not(.tf-peek){display:none!important}:root:has(#tf-style.tf-previewing) [data-tf-hidden]{display:none!important}:root:has(#tf-style.tf-previewing) .tf-hover,:root:has(#tf-style.tf-previewing) img.tf-picture{cursor:auto}' +
            'img.tf-picture{cursor:pointer}:root:has(#tf-style.tf-through) body *:not([data-tweakfast]):not([data-tweakfast] *){cursor:pointer}' +
            '@media(max-width:600px){.tf-bar{--tf-x:0;left:8px;right:8px;bottom:8px;transform:none;max-width:none;justify-content:space-between;gap:3px;border-radius:12px}.tf-bar .tf-button{height:32px;padding:0 11px}.tf-bar .tf-sym{display:inline-flex}.tf-bar .tf-phone-sym{aspect-ratio:1;padding:0}.tf-bar .tf-phone-sym .tf-bw{position:absolute;width:1px;height:1px;margin:-1px;overflow:hidden;clip:rect(0 0 0 0)}.tf-page-name{max-width:34vw}.tf-panel{width:calc(100% - 16px)}}@media(pointer:coarse){.tf-bar .tf-button,.tf-tools .tf-button,.tf-status .tf-offer,.tf-row-acts .tf-button,.tf-link .tf-small,.tf-versions .tf-button,.tf-add .tf-button{height:40px}.tf-grip{width:40px;height:40px}.tf-name{height:40px}.tf-tools .tf-icon{width:40px}.tf-count{position:relative}.tf-count::after{content:"";position:absolute;inset:-11px -11px -11px -8px}.tf-link-open{width:40px;height:40px}.tf-plus span,tr.tf-plus td span{width:40px;height:40px}.tf-plus span svg{width:18px;height:18px}.tf-link .tf-input{height:40px}.tf-row-acts{opacity:1}.tf-row-acts .tf-icon{width:40px}.tf-row-grip{opacity:1}.tf-sheet-head .tf-icon{width:40px;height:40px}.tf-item{height:40px}.tf-bar .tf-icon{width:40px}.tf-peek .tf-button{height:40px}}';
        document.head.appendChild(s);
    }
    /* the page's ground, read once at the start: a light site gets dark glass, a dark site light glass */
    function darkGround() {
        var n = document.body, v;
        while (n) {
            v = rgbOf(getComputedStyle(n).backgroundColor);
            if (v && v.a > .5) return (v.r * .299 + v.g * .587 + v.b * .114) < 110;
            n = n === document.body ? document.documentElement : null;
        }
        return false;
    }
})();
