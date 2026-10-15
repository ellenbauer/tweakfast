/* Tweakfast worker. Lives in the owner's own space and serves the pages itself.

   Layout of a Tweakfast site:
     _site/<page>.html      the pages as the maker published them (originals)
     style.css, pictures/…  static files, served by the host as usual
     tweakfast.js           the one line on every page: a tiny loader
     tweakfast-editor.js    the editor, fetched only on the owner's computer
     functions/[...rest].js this file

   The host serves a static file when one exists at the path; everything else
   comes here. So "/" and "/<page>.html" arrive here and are answered from the
   database (an edited page) or from _site/ (the original). New pictures are
   uploaded to the space's storage and served at /pictures/<name>.

   One environment variable: TWEAKFAST_KEY, the secret after #edit= in the
   owner's link. No Spacefast credentials are needed. Without it the site is
   served as usual, and the editing routes say the site is not set up yet.
   A public demo also sets TWEAKFAST_DEMO=1: Done answers as usual but writes
   nothing, and every page is served as the maker published it, so each
   visitor starts fresh. */

var MAX_PAGE = 2 * 1024 * 1024;        /* bytes of HTML per page */
var MAX_PICTURE = 5 * 1024 * 1024;     /* the storage limit */

export default {
    async fetch(request, env, ctx) {
        var url = new URL(request.url), path = url.pathname;
        try {
            /* awaited here, so a failure inside lands in the catch below */
            if (path === '/api/save') return request.method === 'POST' ? await save(request, env) : Response.json({ tweakfast: 'save' });
            if (path === '/api/history') return request.method === 'POST' ? await history(request, env) : notFound(path);
            if (path === '/api/pages') return request.method === 'POST' ? await pages(request, env) : notFound(path);
            if (path === '/api/check') return request.method === 'POST' ? await check(request, env) : notFound(path);
            if (request.method !== 'GET' && request.method !== 'HEAD') return new Response('Method not allowed', { status: 405 });
            if (path === '/' || /^\/[\w-]+\.html$/.test(path)) return await page(path === '/' ? 'index.html' : path.slice(1), url, env);
            if (/^\/pictures\/tf-[\w-]+\.(jpe?g|png|gif|webp)$/i.test(path)) return await picture(path.slice(1), env);
            return notFound(path);
        } catch (e) {
            console.error('Tweakfast ' + path + ': ' + (e && e.stack || e));
            if (path === '/api/save') return answer(500, 'The site could not save right now. Wait a moment, then press Done again.');
            if (path === '/api/history') return answer(500, 'The saved versions could not be reached right now. Wait a moment, then try again.');
            if (path === '/api/pages') return answer(500, 'The list of saved pages could not be read right now. Wait a moment, then run the command again.');
            if (path === '/api/check') return answer(500, 'The site could not check the link right now. Wait a moment, then reload the page.');
            return new Response('Tweakfast: ' + (e && e.message || e), { status: 500 });
        }
    }
};

/* ---- serving ---- */
async function page(name, url, env) {
    if (!demo(env)) {
        await ready(env);
        var row = await env.DB.prepare('select html, updated from tf_pages where path = ?').bind(name).first();
        if (row && row.html) return html(stamp(row.html, row.updated));
        if (row) return notFound('/' + name); /* removed by the owner: the original stays in _site/, but is not served */
    }
    var r = await fetch(url.origin + '/_site/' + name, { headers: { 'x-tweakfast': 'origin' } });
    if (r.status === 200) return html(hostClean(await r.text()));
    return notFound('/' + name);
}
/* the host adds marked blocks to every page it serves, the original included; served again they would double */
function hostClean(text) {
    return text.replace(/<!-- spacefast:([\w-]+) -->[\s\S]*?<!-- \/spacefast:\1 -->\n?/g, '');
}
/* a saved page says when it was saved, so the editor can tell when it was changed elsewhere in between */
function stamp(text, updated) {
    var tag = '<meta name="tweakfast-updated" content="' + escape(updated || '') + '">';
    return /<head[^>]*>/i.test(text) ? text.replace(/<head[^>]*>/i, function (m) { return m + '\n' + tag; }) : tag + text;
}
function html(text) {
    return new Response(text, { headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-cache' } });
}
async function picture(name, env) {
    await ready(env);
    var row = await env.DB.prepare('select object_id, content_type from tf_pictures where path = ?').bind(name).first();
    if (!row) return notFound('/' + name);
    var obj = await env.STORAGE.get(row.object_id);
    if (!obj) return notFound('/' + name);
    return new Response(obj.body, { headers: { 'content-type': row.content_type || 'application/octet-stream', 'cache-control': 'public, max-age=31536000, immutable' } });
}
function notFound(path) {
    return new Response('<!doctype html><title>Page not found</title><h1>Page not found</h1><p>There is nothing at ' + escape(path) + '.</p>', { status: 404, headers: { 'content-type': 'text/html; charset=utf-8' } });
}
function escape(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

/* the editor asks on arrival whether its link still works */
async function check(request, env) {
    var body;
    try { body = await request.json(); } catch (e) { return answer(400, 'The request was not readable.'); }
    var no = locked(body, env); if (no) return no;
    return demo(env) ? Response.json({ ok: true, demo: true }) : Response.json({ ok: true });
}

/* ---- saving ---- */
async function save(request, env) {
    var body;
    try { body = await request.json(); } catch (e) { return answer(400, 'The request was not readable.'); }
    var no = locked(body, env); if (no) return no;
    var files = body.files || {}, pictures = body.pictures || {}, path;
    for (path in files) {
        if (!pagePath(path) || typeof files[path] !== 'string') return answer(400, 'A page had a bad name: ' + path);
        if (files[path].length > MAX_PAGE) return answer(413, 'A page is too large to save: ' + path);
    }
    for (path in pictures) if (!picturePath(path)) return answer(400, 'A picture had a bad name: ' + path);
    var drop = Array.isArray(body.drop) ? body.drop : [];
    for (var i = 0; i < drop.length; i++) {
        if (!pagePath(drop[i])) return answer(400, 'A page had a bad name: ' + drop[i]);
        if (drop[i] === 'index.html') return answer(400, 'The home page cannot be removed.');
    }
    if (!Object.keys(files).length && !Object.keys(pictures).length && !drop.length) return answer(400, 'Nothing to save.');
    var bytes = {};
    for (path in pictures) {
        bytes[path] = fromBase64(pictures[path]);
        if (!bytes[path]) return answer(400, 'A picture could not be read: ' + path);
        if (bytes[path].length > MAX_PICTURE) return answer(413, 'A picture is too large: ' + path);
    }
    if (demo(env)) return Response.json({ ok: true, demo: true, saved: { pages: Object.keys(files).length, pictures: Object.keys(pictures).length }, at: new Date().toISOString() });
    await ready(env);
    /* each page carries the stamp the editor saw: '' for a page it never saw saved. A removal is checked the same way
       when the editor sends its stamp; without one (or with force) it goes through. */
    var seen = body.updated || {}, force = !!body.force, conflicts = [];
    function checked(p) { return !force && Object.prototype.hasOwnProperty.call(seen, p); }
    function expected(p) { return typeof seen[p] === 'string' ? seen[p] : ''; }
    var asked = Object.keys(files).concat(drop.filter(checked));
    if (!force) { /* told early and in one sentence; the writes below check again, so a save in between is caught too */
        for (i = 0; i < asked.length; i++) {
            var cur = await env.DB.prepare('select html, updated from tf_pages where path = ?').bind(asked[i]).first();
            if ((cur && cur.html ? cur.updated : '') !== expected(asked[i])) conflicts.push(asked[i]); /* a removed page (an empty row) counts as no page */
        }
        if (conflicts.length) return changedElsewhere(conflicts, Object.keys(files), {}, '');
    }
    /* pictures first: storage is not the database, and a picture nobody points to yet harms nothing */
    var now = new Date().toISOString(), steps = [];
    for (path in pictures) {
        var type = typeOf(path), obj = await env.STORAGE.upload(new Blob([bytes[path]], { type: type }));
        steps.push({ picture: path, stmts: [env.DB.prepare('insert into tf_pictures (path, object_id, content_type, created) values (?, ?, ?, ?) on duplicate key update object_id = values(object_id), content_type = values(content_type), created = values(created)')
            .bind(path, obj.id, type, now)] });
    }
    /* a removed page keeps its saved versions and is marked gone (an empty row), so it is not served again; Versions can bring it back */
    for (i = 0; i < drop.length; i++) steps.push(pageWrite(env, drop[i], '', now, checked(drop[i]) ? expected(drop[i]) : null));
    for (path in files) steps.push(pageWrite(env, path, files[path], now, force ? null : expected(path)));
    var failed = await apply(env, steps);
    var written = {}, lost = [], saved = { pages: 0, pictures: 0 };
    steps.forEach(function (st) {
        if (!st.done) return;
        if (st.picture) { saved.pictures++; return; }
        if (!landed(st)) { lost.push(st.page); return; }
        written[st.page] = now;
        if (st.html) saved.pages++;
    });
    if (failed) { /* with a batch nothing went through; one by one, what did is said with its stamp, so the next Done is not taken for a change made elsewhere */
        console.error('Tweakfast /api/save: ' + (failed && failed.stack || failed));
        return Response.json({ ok: false, message: 'The site could not save right now. Wait a moment, then press Done again.', written: written, at: now }, { status: 500 });
    }
    if (lost.length) return changedElsewhere(lost, Object.keys(files), written, now);
    return Response.json({ ok: true, saved: saved, written: written, at: now });
}
function changedElsewhere(pages, sent, written, at) {
    return Response.json({ ok: false, conflict: true, pages: pages, written: written, at: at, message: pages.length === 1 && pages[0] === sent[0]
        ? 'This page was changed elsewhere since you opened it.'
        : 'Changed elsewhere since you opened this: ' + pages.join(', ') + '.' }, { status: 409 });
}
/* One page's write, '' html for a removal. With a stamp it lands only on the row the editor saw, so a save made
   elsewhere in between is never overwritten: a stamp of '' lands only where there is no page (or a removed one);
   null writes whatever is there. The saved copy is taken from the row only when the write landed. */
function pageWrite(env, path, html, now, stamp) {
    var stmts;
    if (stamp === null) stmts = [env.DB.prepare('insert into tf_pages (path, html, updated) values (?, ?, ?) on duplicate key update html = values(html), updated = values(updated)').bind(path, html, now)];
    else if (stamp === '') stmts = [
        env.DB.prepare("update tf_pages set html = ?, updated = ? where path = ? and html = ''").bind(html, now, path),
        env.DB.prepare('insert ignore into tf_pages (path, html, updated) values (?, ?, ?)').bind(path, html, now)];
    else stmts = [env.DB.prepare('update tf_pages set html = ?, updated = ? where path = ? and updated = ?').bind(html, now, path, stamp)];
    var writes = stmts.length;
    if (html) stmts.push(env.DB.prepare('insert into tf_history (path, html, saved) select path, html, updated from tf_pages where path = ? and updated = ?').bind(path, now));
    return { page: path, html: html, stmts: stmts, writes: writes };
}
/* Rows changed by a statement, or null when the host does not say (then the check before the writes stands). */
function changes(r) {
    var m = r && (r.meta || r);
    return m && typeof m.changes === 'number' ? m.changes : m && typeof m.affectedRows === 'number' ? m.affectedRows : m && typeof m.rows_written === 'number' ? m.rows_written : null;
}
function landed(st) {
    if (st.picture) return true;
    var sum = 0;
    for (var i = 0; i < st.writes; i++) { var n = changes(st.results[i]); if (n === null) return true; sum += n; }
    return sum > 0;
}
/* All writes in one batch when the host has one (one transaction: all or nothing); otherwise one by one, and the
   steps that went through are marked done. Returns the error that stopped it, or null. */
async function apply(env, steps) {
    var all = [];
    steps.forEach(function (st) { st.stmts.forEach(function (x) { all.push(x); }); });
    if (typeof env.DB.batch === 'function') {
        var res, k = 0;
        try { res = await env.DB.batch(all); } catch (e) { return e; } /* nothing went through */
        steps.forEach(function (st) { st.results = (res || []).slice(k, k += st.stmts.length); st.done = true; });
        return null;
    }
    for (var i = 0; i < steps.length; i++) {
        var st = steps[i]; st.results = [];
        try { for (var j = 0; j < st.stmts.length; j++) st.results.push(await st.stmts[j].run()); }
        catch (e) { if (st.results.length >= st.writes) st.done = true; return e; } /* the page itself went through, only its saved copy did not */
        st.done = true;
    }
    return null;
}
/* Yesterday's version: {key, path, list:true} lists saved times; {key, path, at} puts back that saved copy; {key, path, before} the newest one older than that time; {key, path} alone the original. */
/* for the maker's command: which pages the owner has saved (their version is the one shown) */
async function pages(request, env) {
    var body;
    try { body = await request.json(); } catch (e) { return answer(400, 'The request was not readable.'); }
    var no = locked(body, env); if (no) return no;
    if (demo(env)) return Response.json({ ok: true, pages: [] });
    await ready(env);
    var rows = await env.DB.prepare("select path, updated from tf_pages where html <> '' order by path").all(); /* an empty row is a page the owner removed */
    return Response.json({ ok: true, pages: (rows.results || []).map(function (r) { return { path: r.path, updated: r.updated }; }) });
}
async function history(request, env) {
    var body;
    try { body = await request.json(); } catch (e) { return answer(400, 'The request was not readable.'); }
    var no = locked(body, env); if (no) return no;
    if (!pagePath(body.path)) return answer(400, 'A page had a bad name.');
    if (demo(env)) { /* a demo has no saved copies: only the original, and nothing is written */
        if (body.list) return Response.json({ ok: true, demo: true, saved: [], original: true });
        if (body.get) {
            var d = await fetch(new URL(request.url).origin + '/_site/' + body.path, { headers: { 'x-tweakfast': 'origin' } });
            return d.status === 200 ? Response.json({ ok: true, html: hostClean(await d.text()), updated: '' }) : answer(404, 'The original could not be read.');
        }
        return Response.json({ ok: true, at: new Date().toISOString() });
    }
    await ready(env);
    if (body.list) {
        var rows = await env.DB.prepare('select saved from tf_history where path = ? order by saved desc limit 50').bind(body.path).all();
        var orig = await fetch(new URL(request.url).origin + '/_site/' + body.path, { method: 'HEAD', headers: { 'x-tweakfast': 'origin' } });
        return Response.json({ ok: true, saved: (rows.results || []).map(function (r) { return r.saved; }), original: orig.status === 200 });
    }
    /* the editor asks for a version to show as a change; nothing is written */
    if (body.get) {
        var live = await env.DB.prepare('select html, updated from tf_pages where path = ?').bind(body.path).first();
        var html = null;
        if (body.at) {
            var v = await env.DB.prepare('select html from tf_history where path = ? and saved = ? limit 1').bind(body.path, String(body.at)).first();
            if (!v) return answer(404, 'No saved copy from then.');
            html = live && live.html ? keepMenu(v.html, live.html) : v.html;
        } else {
            var o = await fetch(new URL(request.url).origin + '/_site/' + body.path, { headers: { 'x-tweakfast': 'origin' } });
            if (o.status !== 200) return answer(404, 'The original could not be read.');
            var ot = hostClean(await o.text());
            html = live && live.html ? keepMenu(ot, live.html) : ot;
        }
        return Response.json({ ok: true, html: html, updated: live && live.updated ? live.updated : '' });
    }
    var now = new Date().toISOString();
    if (body.at || body.before) {
        var old = body.at
            ? await env.DB.prepare('select html from tf_history where path = ? and saved = ? limit 1').bind(body.path, String(body.at)).first()
            : await env.DB.prepare('select html from tf_history where path = ? and saved < ? order by saved desc limit 1').bind(body.path, String(body.before)).first();
        if (!old) return answer(404, 'No saved copy from before then.');
        var cur = await env.DB.prepare('select html from tf_pages where path = ?').bind(body.path).first();
        var back = cur && cur.html ? keepMenu(old.html, cur.html) : old.html;
        await env.DB.prepare('insert into tf_history (path, html, saved) values (?, ?, ?)').bind(body.path, back, now).run();
        await env.DB.prepare('insert into tf_pages (path, html, updated) values (?, ?, ?) on duplicate key update html = values(html), updated = values(updated)').bind(body.path, back, now).run();
    } else {
        /* the original: the page as the maker published it, but with the current menu */
        var row = await env.DB.prepare('select html from tf_pages where path = ?').bind(body.path).first();
        var r = row && row.html ? await fetch(new URL(request.url).origin + '/_site/' + body.path, { headers: { 'x-tweakfast': 'origin' } }) : null;
        var orig = r && r.status === 200 ? hostClean(await r.text()) : null, kept = orig ? keepMenu(orig, row.html) : null;
        if (kept && kept !== orig) {
            await env.DB.prepare('insert into tf_history (path, html, saved) values (?, ?, ?)').bind(body.path, kept, now).run();
            await env.DB.prepare('insert into tf_pages (path, html, updated) values (?, ?, ?) on duplicate key update html = values(html), updated = values(updated)').bind(body.path, kept, now).run();
        } else {
            await env.DB.prepare('delete from tf_pages where path = ?').bind(body.path).run();
        }
    }
    return Response.json({ ok: true, at: now });
}

/* The menu is shared by every page and hidden pages are marked in all of them, so an old copy of one page keeps
   the current menu and the current noindex mark; otherwise the menus would drift apart. */
function keepMenu(old, cur) {
    var nav = /<nav[\s\S]*?<\/nav>/i, meta = /<meta name="robots"[^>]*data-tf-noindex[^>]*>\n?/i;
    var curNav = cur.match(nav), curMeta = cur.match(meta);
    if (curNav && nav.test(old)) old = old.replace(nav, function () { return curNav[0]; });
    old = old.replace(meta, '');
    if (curMeta) old = old.replace(/<\/head>/i, function (m) { return curMeta[0] + m; });
    return old;
}

/* ---- tables ---- */
var readyOnce = null;
function ready(env) {
    if (!readyOnce) readyOnce = Promise.all([
        env.DB.prepare('create table if not exists tf_pages (path varchar(255) primary key, html longtext, updated varchar(40))').run(),
        env.DB.prepare('create table if not exists tf_history (id int auto_increment primary key, path varchar(255), html longtext, saved varchar(40), index by_path (path, saved))').run(),
        env.DB.prepare('create table if not exists tf_pictures (path varchar(255) primary key, object_id varchar(64), content_type varchar(100), created varchar(40))').run()
    ]).catch(function (e) { readyOnce = null; throw e; });
    return readyOnce;
}

/* ---- small helpers ---- */
/* the owner's key: a site without one is not set up for editing yet; a wrong one is a stopped link */
function locked(body, env) {
    if (!env.TWEAKFAST_KEY) return answer(503, 'This site is not set up for editing yet.');
    if (!same(body && body.key, env.TWEAKFAST_KEY)) return answer(403, 'This link no longer works. Ask the person who set up the site for a new one.');
    return null;
}
function demo(env) { return env.TWEAKFAST_DEMO === '1' || env.TWEAKFAST_DEMO === 'true'; }
function answer(status, message) { return Response.json({ ok: false, message: message }, { status: status }); }
function same(a, b) {
    if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
    var diff = 0;
    for (var i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
    return diff === 0;
}
function pagePath(p) { return typeof p === 'string' && p.length < 200 && /^[\w-]+\.html$/.test(p); }
function picturePath(p) { return typeof p === 'string' && p.length < 200 && /^pictures\/tf-[\w-]+\.(jpe?g|png|gif|webp)$/i.test(p); }
function typeOf(p) {
    var ext = p.split('.').pop().toLowerCase();
    return { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif', webp: 'image/webp' }[ext] || 'application/octet-stream';
}
function fromBase64(s) {
    if (typeof s !== 'string') return null;
    s = s.replace(/^data:[^,]*,/, '');
    try {
        var bin = atob(s), out = new Uint8Array(bin.length);
        for (var i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
        return out;
    } catch (e) { return null; }
}
