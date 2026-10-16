/* Tweakfast, on every page. The editor beside it loads only for the owner (#edit=<key>, or a key kept here); #view = as readers see it. */
(function () {
    var BUILD = 'dev'; /* the editor's hash, by the bundler: never an old editor from a cache */
    /* titles end lines evenly; a site's own wrapping wins */
    var bal = document.createElement('style'), at = document.head || document.documentElement;
    bal.setAttribute('data-tweakfast', ''); bal.textContent = ':where(h1,h2,h3){text-wrap:balance}'; at.appendChild(bal);
    var me = document.currentScript, base = me && me.src ? me.src.replace(/[^\/]*$/, '') : '/';
    function owner() {
        if (location.hash === '#view') return false;
        if (/[#&]edit=/.test(location.hash)) return true;
        try { return !!localStorage.getItem('tweakfast:key'); } catch (e) { return false; }
    }
    function add(name) {
        var s = document.createElement('script');
        s.src = base + name + '.js?v=' + encodeURIComponent(BUILD);
        s.setAttribute('data-tweakfast', ''); /* ours: never saved */
        at.appendChild(s);
    }
    /* what the cleaning took away with the site's own scripts is mended where it shows: on pages left without
       scripts of their own, and always for the owner (the pointer) */
    function mend() {
        if (owner() || ![].some.call(document.scripts, function (x) { return x != me && !/tweakfast/.test(x.src) && !/json/.test(x.type) && (x.src || x.text.trim()); })) add('tweakfast-mend');
    }
    if (document.readyState == 'loading') addEventListener('DOMContentLoaded', mend); else mend();
    if (owner()) add('tweakfast-editor');
    else {
        /* the owner's link pasted here: load again, with the editor */
        addEventListener('hashchange', function () { if (/[#&]edit=/.test(location.hash)) location.reload(); });
    }
})();
