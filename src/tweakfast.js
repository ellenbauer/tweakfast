/* Tweakfast. The one line on every page loads this; readers get nothing more than titles that end their lines evenly. The editor itself
   (tweakfast-editor.js, next to this file) is fetched only on the owner's computer: when the address
   carries #edit=<key>, or a key from an earlier visit is kept in this browser. "#view" is the page as
   readers see it, even there. */
(function () {
    var BUILD = 'dev'; /* the bundler writes a short hash of the editor here, so a new editor is never an old one from a cache */
    /* titles end their lines about evenly at every width, so no word is left alone; a site that sets its own wrapping wins */
    var bal = document.createElement('style');
    bal.setAttribute('data-tweakfast', '');
    bal.textContent = ':where(h1,h2,h3){text-wrap:balance}';
    (document.head || document.documentElement).appendChild(bal);
    var me = document.currentScript, base = me && me.src ? me.src.replace(/[^\/]*$/, '') : '/';
    function owner() {
        if (location.hash === '#view') return false;
        if (/[#&]edit=/.test(location.hash)) return true;
        try { return !!localStorage.getItem('tweakfast:key'); } catch (e) { return false; }
    }
    if (owner()) {
        var s = document.createElement('script');
        s.src = base + 'tweakfast-editor.js?v=' + encodeURIComponent(BUILD);
        s.setAttribute('data-tweakfast', ''); /* ours: never saved into the page */
        (document.head || document.documentElement).appendChild(s);
    } else {
        /* the owner's link pasted into a tab that shows the plain page: load again, with the editor */
        window.addEventListener('hashchange', function () { if (/[#&]edit=/.test(location.hash)) location.reload(); });
    }
})();
