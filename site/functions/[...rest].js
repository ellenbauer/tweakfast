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
   owner's link. No Spacefast credentials are needed. */

var MAX_PAGE = 2 * 1024 * 1024;        /* bytes of HTML per page */
var MAX_PICTURE = 5 * 1024 * 1024;     /* the storage limit */

export default {
    async fetch(request, env, ctx) {
        var url = new URL(request.url), path = url.pathname;
        try {
            if (path === '/api/save') return request.method === 'POST' ? save(request, env) : Response.json({ tweakfast: 'save' });
            if (path === '/api/history') return request.method === 'POST' ? history(request, env) : notFound(path);
            if (path === '/api/pages') return request.method === 'POST' ? pages(request, env) : notFound(path);
            if (path === '/api/check') return request.method === 'POST' ? check(request, env) : notFound(path);
            if (request.method !== 'GET' && request.method !== 'HEAD') return new Response('Method not allowed', { status: 405 });
            if (path === '/' || /^\/[\w-]+\.html$/.test(path)) return page(path === '/' ? 'index.html' : path.slice(1), url, env);
            if (/^\/pictures\/tf-[\w-]+\.(jpe?g|png|gif|webp)$/i.test(path)) return picture(path.slice(1), env);
            return notFound(path);
        } catch (e) {
            if (path.indexOf('/api/') === 0) return answer(500, 'The site could not save right now. Wait a moment, then press Done again.');
            return new Response('Tweakfast: ' + (e && e.message || e), { status: 500 });
        }
    }
};

/* ---- serving ---- */
async function page(name, url, env) {
    await ready(env);
    var row = await env.DB.prepare('select html, updated from tf_pages where path = ?').bind(name).first();
    if (row && row.html) return html(stamp(row.html, row.updated));
    if (row) return notFound('/' + name); /* removed by the owner: the original stays in _site/, but is not served */
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
    if (!env.TWEAKFAST_KEY || !same(body.key, env.TWEAKFAST_KEY)) return answer(403, 'This link no longer works. Ask the person who set up the site for a new one.');
    return Response.json({ ok: true });
}

/* ---- saving ---- */
async function save(request, env) {
    var body;
    try { body = await request.json(); } catch (e) { return answer(400, 'The request was not readable.'); }
    if (!env.TWEAKFAST_KEY || !same(body.key, env.TWEAKFAST_KEY)) return answer(403, 'This link no longer works. Ask the person who set up the site for a new one.');
    var files = body.files || {}, pictures = body.pictures || {}, path;
    for (path in files) {
        if (!pagePath(path) || typeof files[path] !== 'string') return answer(400, 'A page had a bad name: ' + path);
        if (files[path].length > MAX_PAGE) return answer(413, 'A page is too large to save: ' + path);
    }
    for (path in pictures) if (!picturePath(path)) return answer(400, 'A picture had a bad name: ' + path);
    var drop = Array.isArray(body.drop) ? body.drop : [];
    for (var i = 0; i < drop.length; i++) if (!pagePath(drop[i])) return answer(400, 'A page had a bad name: ' + drop[i]);
    if (!Object.keys(files).length && !Object.keys(pictures).length && !drop.length) return answer(400, 'Nothing to save.');
    await ready(env);
    if (!body.force) { /* a page saved from elsewhere since the editor opened it is not overwritten in silence */
        var seen = body.updated || {}, conflicts = [];
        for (path in files) {
            var cur = await env.DB.prepare('select updated from tf_pages where path = ?').bind(path).first();
            if (cur && cur.updated !== (seen[path] || '')) conflicts.push(path);
        }
        if (conflicts.length) return Response.json({ ok: false, conflict: true, pages: conflicts, message: conflicts.length === 1 && conflicts[0] === Object.keys(files)[0]
            ? 'This page was changed elsewhere since you opened it.'
            : 'Changed elsewhere since you opened this: ' + conflicts.join(', ') + '.' }, { status: 409 });
    }
    var now = new Date().toISOString(), saved = { pages: 0, pictures: 0 };
    for (path in pictures) {
        var bytes = fromBase64(pictures[path]);
        if (!bytes) return answer(400, 'A picture could not be read: ' + path);
        if (bytes.length > MAX_PICTURE) return answer(413, 'A picture is too large: ' + path);
        var type = typeOf(path);
        var obj = await env.STORAGE.upload(new Blob([bytes], { type: type }));
        await env.DB.prepare('insert into tf_pictures (path, object_id, content_type, created) values (?, ?, ?, ?) on duplicate key update object_id = values(object_id), content_type = values(content_type), created = values(created)')
            .bind(path, obj.id, type, now).run();
        saved.pictures++;
    }
    /* pages the owner removed: gone with their history; a page the maker shipped keeps its original in _site/ and is marked gone (an empty row), so it is not served again */
    var origin = new URL(request.url).origin;
    for (i = 0; i < drop.length; i++) {
        await env.DB.prepare('delete from tf_pages where path = ?').bind(drop[i]).run();
        await env.DB.prepare('delete from tf_history where path = ?').bind(drop[i]).run();
        var orig = await fetch(origin + '/_site/' + drop[i], { method: 'HEAD', headers: { 'x-tweakfast': 'origin' } });
        if (orig.status === 200) await env.DB.prepare('insert into tf_pages (path, html, updated) values (?, ?, ?)').bind(drop[i], '', now).run();
    }
    for (path in files) {
        await env.DB.prepare('insert into tf_history (path, html, saved) values (?, ?, ?)').bind(path, files[path], now).run();
        await env.DB.prepare('insert into tf_pages (path, html, updated) values (?, ?, ?) on duplicate key update html = values(html), updated = values(updated)')
            .bind(path, files[path], now).run();
        saved.pages++;
    }
    return Response.json({ ok: true, saved: saved, at: now });
}
/* Yesterday's version: {key, path, list:true} lists saved times; {key, path, at} puts back that saved copy; {key, path, before} the newest one older than that time; {key, path} alone the original. */
/* for the maker's command: which pages the owner has saved (their version is the one shown) */
async function pages(request, env) {
    var body;
    try { body = await request.json(); } catch (e) { return answer(400, 'The request was not readable.'); }
    if (!env.TWEAKFAST_KEY || !same(body.key, env.TWEAKFAST_KEY)) return answer(403, 'This link no longer works. Ask the person who set up the site for a new one.');
    await ready(env);
    var rows = await env.DB.prepare("select path, updated from tf_pages where html <> '' order by path").all(); /* an empty row is a page the owner removed */
    return Response.json({ ok: true, pages: (rows.results || []).map(function (r) { return { path: r.path, updated: r.updated }; }) });
}
async function history(request, env) {
    var body;
    try { body = await request.json(); } catch (e) { return answer(400, 'The request was not readable.'); }
    if (!env.TWEAKFAST_KEY || !same(body.key, env.TWEAKFAST_KEY)) return answer(403, 'This link no longer works. Ask the person who set up the site for a new one.');
    if (!pagePath(body.path)) return answer(400, 'A page had a bad name.');
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
