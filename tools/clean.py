#!/usr/bin/env python3
"""Makes a page plain for Tweakfast.

    tools/clean.py <page.html> [<page.html> ...]

Takes out the programs an app-building tool attached (every script loaded from the web or a module,
inline scripts that are app machinery, and script files bigger than 1 KB; a small plain one of the site's own stays), badges and watermarks of such tools with their styles,
the tool's own comment markers, and adds the Tweakfast script line when it is missing. Written back in
place. Nothing inside <main> is touched, and a badge goes only when it links to another site or is pinned
to the screen. A page without <main> or without text of its own is named with one sentence and published
as it is; only when no page has text of its own (an app, not a plain site) it exits 2. No tool is named
here; the rules are the same for every source."""
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
    src = re.split(r'[?#]', src)[0]  # menu.js?v=2 is menu.js
    if not where or not src or re.match(r'(?:[a-z]+:)?//', src) or src.endswith('.mjs'): return None
    for d in (where, os.path.dirname(where.rstrip('/'))):
        f = os.path.normpath(os.path.join(d, src.lstrip('/')))
        if os.path.isfile(f) and os.path.getsize(f) <= SMALL:
            return open(f, encoding='utf-8', errors='replace').read()
    return None

def fixed(s, start, end):
    """the element is pinned to the screen: position fixed in its own style or in a rule naming its id or class"""
    tag = s[start:end]
    if re.search(r'position\s*:\s*fixed', tag, re.I): return True
    first = re.match(r'<[^>]*>', tag).group(0)
    names = ['#' + i for i in re.findall(r"""\bid=["']([^"']+)["']""", first)]
    for c in re.findall(r"""\bclass=["']([^"']+)["']""", first): names += ['.' + n for n in c.split()]
    for block in re.findall(r'<style\b[^>]*>([\s\S]*?)</style>', s, re.I):
        for sel, body in re.findall(r'([^{}]+)\{([^{}]*)\}', block):
            if re.search(r'position\s*:\s*fixed', body, re.I) and any(re.search(re.escape(n) + r'(?![\w-])', sel) for n in names): return True
    return False

def outside_link(s, start, end):
    """the element links to another site (a tool's badge sends its readers home)"""
    return bool(re.search(r"""\bhref=["']?(?:https?:)?//""", s[start:end], re.I))

def clean(s, where=None):
    out = {'scripts': 0, 'badges': 0, 'names': []}
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
        out['scripts'] += 1; out['names'].append(re.sub(r'^(?:[a-z]+:)?//', '', re.split(r'[?#]', src.group(1))[0]) if src else '')
        return ''
    s = re.sub(r'<script\b([^>]*)>([\s\S]*?)</script\s*>\n?', drop_script, s, flags=re.I)
    s = re.sub(r'<link\b[^>]*rel="(?:modulepreload|preload)"[^>]*(?:as="script"|\.m?js")[^>]*>\n?', '', s)
    # a noscript that dresses the page or shows a picture stays; a tracking pixel (1 by 1) or a frame goes
    def drop_noscript(m):
        body = m.group(0)
        if re.search(r'<iframe\b', body, re.I) or re.search(r"""<img\b[^>]*\b(?:width|height)=["']?1["'\s>]""", body, re.I): return ''
        return body if re.search(r'<(?:style|img)\b', body, re.I) else ''
    s = re.sub(r'<noscript\b[^>]*>[\s\S]*?</noscript>\n?', drop_noscript, s)
    removed = []
    while True:
        m = None
        mains = [(x.start(), x.end()) for x in re.finditer(r'<main\b[\s\S]*?</main\s*>', s, re.I)]
        for cand in re.finditer(r'<(?:div|aside|a|span|section|footer)\b[^>]*>', s):
            if any(a <= cand.start() < b for a, b in mains): continue  # the page's own content is never touched
            tag, end = cand.group(0), element_end(s, cand.start())
            if not (MARK.search(tag) or (BADGE.search(tag) and MADE_BY.search(re.sub(r'<[^>]+>', ' ', s[cand.start():end])))): continue
            if outside_link(s, cand.start(), end) or fixed(s, cand.start(), end):  # a site's own "Made in Italy" does neither
                m = cand; break
        if not m: break
        ids = re.findall(r'id="([^"]+)"', s[m.start():element_end(s, m.start())]); removed += ids
        s = s[:m.start()] + s[element_end(s, m.start()):]; out['badges'] += 1
    if removed:  # a style block that only dresses what went: out
        names = lambda sel: any(re.search('#' + re.escape(i) + r'(?![\w-])', sel) for i in removed)
        def drop_style(m):
            css = re.sub(r'/\*[\s\S]*?\*/', '', m.group(1))
            rules = [r for r in css.split('}') if '{' in r]
            # a rule is the badge's when every selector in it names a removed id; an @-rule (fonts, @media) only when it holds such a rule
            def own(r):
                sels = [x.strip() for x in r.split('{')[:-1] if not x.strip().startswith('@')]
                return bool(sels) and all(names(x) for x in sels)
            return '' if rules and all(own(r) for r in rules) else m.group(0)
        s = re.sub(r'<style\b[^>]*>([\s\S]*?)</style>\n?', drop_style, s)
    s = re.sub(r'<!--/?\$[^>]*-->', '', s)
    if 'tweakfast.js' not in s:
        end = re.search(r'</body\s*>', s, re.I)
        s = s[:end.start()] + LINE + '\n' + s[end.start():] if end else s + '\n' + LINE + '\n'
    main = re.search(r'<main\b[\s\S]*?</main>', s, re.I)
    body = main or re.search(r'<body\b[\s\S]*?(?:</body>|$)', s, re.I)
    text = re.sub(r'<[^>]+>', ' ', re.sub(r'<(script|style)\b[\s\S]*?</\1\s*>', ' ', body.group(0) if body else s, flags=re.I))
    out['main'] = bool(main)
    out['plain'] = len(text.split()) >= 20
    return s, out

if __name__ == '__main__':
    plain = 0
    for path in sys.argv[1:]:
        s = open(path, encoding='utf-8').read()
        s, out = clean(s, os.path.dirname(os.path.abspath(path)))
        open(path, 'w', encoding='utf-8').write(s)
        name = path.split('/')[-1]
        note = []
        if out['scripts']:
            files, inline = [n for n in out['names'] if n], out['names'].count('')
            files += ['%d inline' % inline] if inline else []
            note.append('%d %s (%s)' % (out['scripts'], 'script' if out['scripts'] == 1 else 'scripts', ', '.join(files)))
        if out['badges']: note.append('%d %s' % (out['badges'], 'badge' if out['badges'] == 1 else 'badges'))
        if note: print(name + ': taken out ' + ', '.join(note))
        if not out['plain']: print(name + ': not a plain page. Its text is drawn by a program, so it shows little and has nothing to edit. Ask the maker for plain HTML (site/RULES.md).')
        elif not out['main']: print(name + ': no <main>, so its blocks cannot be moved or hidden. Put the page\'s own content inside one <main> element (site/RULES.md).')
        if out['plain']: plain += 1
    if sys.argv[1:] and not plain:
        print('No page has text of its own: this is an app, not a plain site. Ask the maker for plain HTML (site/RULES.md).')
        sys.exit(2)
