#!/usr/bin/env python3
"""Makes a page plain for Tweakfast.

    tools/clean.py <page.html> [<page.html> ...]

Takes out the programs an app-building tool attached (every script loaded from the web or a module,
inline scripts that are app machinery, and script files bigger than 1 KB; a small plain one of the site's own stays), badges and watermarks of such tools with their styles,
the tool's own comment markers, and adds the Tweakfast script line when it is missing. Written back in
place. Exits 2 with one sentence when a page carries no text of its own after that: it is an app, not a
plain page. No tool is named here; the rules are the same for every source."""
import os, re, sys

# a tool's mark: named so outright, or a "badge" whose words say who made it (a site's own "New" badge stays)
MARK = re.compile(r"""(?:id|class)=["'][^"']*(?:watermark|made-with|built-with|powered-by)[^"']*["']""", re.I)
BADGE = re.compile(r"""(?:id|class)=["'][^"']*badge[^"']*["']""", re.I)
MADE_BY = re.compile(r'\b(?:made|built|edit|created|powered)\s+(?:with|in|by|on)\b', re.I)
MACHINERY = re.compile(r'hydrat|\$R\b|\$_|sessionStorage|currentScript|badge|analytics|gtag|dataLayer|serviceWorker|__[A-Z]', re.I)
LINE = '<script src="/tweakfast.js"></script>'

def element_end(s, start):
    """index just past the element whose start tag begins at `start`"""
    m = re.match(r'<([a-zA-Z][\w-]*)', s[start:])
    tag = m.group(1).lower()
    depth, i, open_re, close_re = 0, start, re.compile(r'<' + tag + r'\b[^>]*>', re.I), re.compile(r'</' + tag + r'\s*>', re.I)
    while True:
        o, c = open_re.search(s, i), close_re.search(s, i)
        if not c: return len(s)
        if o and o.start() < c.start():
            depth += 0 if o.group(0).endswith('/>') else 1; i = o.end()
        else:
            depth -= 1; i = c.end()
            if depth <= 0: return i

SMALL = 1024  # a small script file of the site's own (a phone menu, the year in the footer) stays

def own_file(src, where):
    """the text of a small script file next to the page (or in the folder above, where the bundle keeps
    the site's files), else None: loaded from the web, a module or bigger than SMALL = not the site's own"""
    if not where or re.match(r'(?:[a-z]+:)?//', src) or src.endswith('.mjs'): return None
    for d in (where, os.path.dirname(where.rstrip('/'))):
        f = os.path.normpath(os.path.join(d, src.lstrip('/')))
        if os.path.isfile(f) and os.path.getsize(f) <= SMALL:
            return open(f, encoding='utf-8', errors='replace').read()
    return None

def clean(s, where=None):
    out = {'scripts': 0, 'badges': 0}
    def drop_script(m):
        attrs, body = m.group(1), m.group(2)
        if 'tweakfast.js' in attrs: return m.group(0)
        src = re.search(r"""\bsrc=["']([^"']*)["']""", attrs) or re.search(r"""\bsrc=([^\s>"']+)""", attrs)
        module = re.search(r"""type=["']?module""", attrs)
        if src and not module:
            text = own_file(src.group(1), where)
            if text is not None and not MACHINERY.search(text): return m.group(0)
        keep = not src and not module and len(body) < 2000 and not MACHINERY.search(body)
        if keep: return m.group(0)
        out['scripts'] += 1; return ''
    s = re.sub(r'<script\b([^>]*)>([\s\S]*?)</script\s*>\n?', drop_script, s, flags=re.I)
    s = re.sub(r'<link\b[^>]*rel="(?:modulepreload|preload)"[^>]*(?:as="script"|\.m?js")[^>]*>\n?', '', s)
    s = re.sub(r'<noscript\b[^>]*>[\s\S]*?</noscript>\n?', '', s)
    removed = []
    while True:
        m = None
        for cand in re.finditer(r'<(?:div|aside|a|span|section|footer)\b[^>]*>', s):
            tag = cand.group(0)
            if MARK.search(tag) or (BADGE.search(tag) and MADE_BY.search(re.sub(r'<[^>]+>', ' ', s[cand.start():element_end(s, cand.start())]))):
                m = cand; break
        if not m: break
        ids = re.findall(r'id="([^"]+)"', s[m.start():element_end(s, m.start())]); removed += ids
        s = s[:m.start()] + s[element_end(s, m.start()):]; out['badges'] += 1
    if removed:  # a style block that only dresses what went: out
        def drop_style(m):
            rules = [r.split('{')[0].strip() for r in m.group(1).split('}') if '{' in r]
            own = lambda r: r.startswith('@') or any('#' + i in r for i in removed)
            return '' if rules and all(own(r) for r in rules) else m.group(0)
        s = re.sub(r'<style\b[^>]*>([\s\S]*?)</style>\n?', drop_style, s)
    s = re.sub(r'<!--/?\$[^>]*-->', '', s)
    if 'tweakfast.js' not in s:
        end = re.search(r'</body\s*>', s, re.I)
        s = s[:end.start()] + LINE + '\n' + s[end.start():] if end else s + '\n' + LINE + '\n'
    main = re.search(r'<main\b[\s\S]*?</main>', s, re.I)
    text = re.sub(r'<[^>]+>', ' ', main.group(0) if main else '')
    out['main'] = bool(main)
    out['plain'] = bool(main) and len(text.split()) >= 20
    return s, out

if __name__ == '__main__':
    bad, nomain = [], []
    for path in sys.argv[1:]:
        s = open(path, encoding='utf-8').read()
        s, out = clean(s, os.path.dirname(os.path.abspath(path)))
        open(path, 'w', encoding='utf-8').write(s)
        note = [k for k in ('scripts', 'badges') if out[k]]
        if note: print(path.split('/')[-1] + ': taken out ' + ', '.join('%d %s' % (out[k], k if out[k] != 1 else k[:-1]) for k in note))
        if not out['main']: nomain.append(path.split('/')[-1])
        elif not out['plain']: bad.append(path.split('/')[-1])
    if nomain:
        print('No <main> in: ' + ', '.join(nomain) + '. Put the page\'s own content inside one <main> element (site/RULES.md).')
    if bad:
        print('Not a plain page: ' + ', '.join(bad) + '. The text is drawn by a program, not written in the file. Ask the maker for plain HTML (site/RULES.md).')
    if bad or nomain: sys.exit(2)
