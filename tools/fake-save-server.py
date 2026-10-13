# Serves the repo and fakes the saving route, so Done can be checked without Spacefast.
# Saved pages are kept in memory and served back with the tweakfast-updated tag, like the worker does.
import os, json, sys, http.server, re, datetime
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LOG = os.path.join(os.environ.get('TMPDIR', '/tmp'), 'tweakfast-fake-save.json')
ROWS = {}   # path -> {'html', 'updated'}
HIST = {}   # path -> [(saved, html)]
class H(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **k): super().__init__(*a, directory=ROOT, **k)
    def log_message(self, *a): pass
    def do_GET(self):
        if self.path.startswith('/api/save'):
            self.send_response(200); self.send_header('content-type', 'application/json'); self.end_headers()
            self.wfile.write(b'{"tweakfast":"save"}'); return
        name = self.path.split('?')[0].split('#')[0].split('/')[-1]
        if (self.path.startswith('/demo/') or self.path.startswith('/tools/')) and name in ROWS:
            if not ROWS[name]['html']:
                self.send_response(404); self.end_headers(); return  # removed by the owner
            tag = '<meta name="tweakfast-updated" content="%s">' % ROWS[name]['updated']
            body = re.sub(r'<head[^>]*>', lambda m: m.group(0) + '\n' + tag, ROWS[name]['html'], count=1).encode()
            self.send_response(200); self.send_header('content-type', 'text/html; charset=utf-8'); self.send_header('cache-control', 'no-cache'); self.end_headers()
            self.wfile.write(body); return
        super().do_GET()
    def do_POST(self):
        if self.path.startswith('/api/check'):
            body = json.loads(self.rfile.read(int(self.headers['content-length'])))
            if body.get('key') == 'boom':
                self.send_response(500); self.send_header('content-type', 'text/plain'); self.end_headers(); self.wfile.write(b'Internal error'); return
            if body.get('key') != 'test':
                self.reply(403, {'ok': False, 'message': 'This link no longer works. Ask the person who set up the site for a new one.'}); return
            self.reply(200, {'ok': True}); return
        if self.path.startswith('/api/save'):
            body = json.loads(self.rfile.read(int(self.headers['content-length'])))
            json.dump(body, open(LOG, 'w'))
            if body.get('key') == 'boom':
                self.send_response(500); self.send_header('content-type', 'text/plain'); self.end_headers(); self.wfile.write(b'Internal error'); return
            if body.get('key') != 'test':
                self.reply(403, {'ok': False, 'message': 'This link no longer works. Ask the person who set up the site for a new one.'}); return
            if body.get('key') == 'test' and (body.get('files') or {}).get('big.html'):
                self.reply(413, {'ok': False, 'message': 'A page is too large to save: big.html'}); return
            files = body.get('files') or {}; seen = body.get('updated') or {}
            if not body.get('force'):
                conflicts = [p for p in files if p in ROWS and ROWS[p]['updated'] != seen.get(p, '')]
                if conflicts:
                    self.reply(409, {'ok': False, 'conflict': True, 'pages': conflicts, 'message': 'This page was changed elsewhere since you opened it.' if conflicts == list(files)[:1] else 'Changed elsewhere since you opened this: ' + ', '.join(conflicts) + '.'}); return
            now = datetime.datetime.now(datetime.timezone.utc).isoformat()
            for p in body.get('drop') or []:
                ROWS.pop(p, None); HIST.pop(p, None)
                if os.path.exists(os.path.join(ROOT, 'demo', p)): ROWS[p] = {'html': '', 'updated': now}  # an original: marked gone, not served
            for p in files:
                ROWS[p] = {'html': files[p], 'updated': now}
                HIST.setdefault(p, []).append((now, files[p]))
            self.reply(200, {'ok': True, 'saved': {'pages': len(files), 'pictures': len(body.get('pictures') or {})}, 'at': now}); return
        if self.path.startswith('/api/history'):
            body = json.loads(self.rfile.read(int(self.headers['content-length'])))
            if body.get('key') != 'test':
                self.reply(403, {'ok': False, 'message': 'This link may not save here.'}); return
            p = body.get('path'); hist = HIST.get(p, [])
            if body.get('list'):
                self.reply(200, {'ok': True, 'saved': [t for t, _ in reversed(hist)], 'original': os.path.exists(os.path.join(ROOT, 'demo', p))}); return
            if body.get('get'):
                if body.get('at'):
                    m = [h for t, h in hist if t == body['at']]
                    if not m: self.reply(404, {'ok': False, 'message': 'No saved copy from then.'}); return
                    self.reply(200, {'ok': True, 'html': m[0], 'updated': ROWS.get(p, {}).get('updated', '')}); return
                try: self.reply(200, {'ok': True, 'html': open(os.path.join(ROOT, 'demo', p), encoding='utf-8').read(), 'updated': ROWS.get(p, {}).get('updated', '')}); return
                except OSError: self.reply(404, {'ok': False, 'message': 'The original could not be read.'}); return
            if body.get('before'):
                m = [(t, h) for t, h in hist if t < body['before']]
                if not m: self.reply(404, {'ok': False, 'message': 'No saved copy from before then.'}); return
                t, h = m[-1]; now = datetime.datetime.now(datetime.timezone.utc).isoformat()
                ROWS[p] = {'html': h, 'updated': now}; HIST[p].append((now, h))
                self.reply(200, {'ok': True}); return
            self.reply(400, {'ok': False, 'message': 'Not understood.'}); return
        self.send_response(404); self.end_headers()
    def reply(self, status, obj):
        self.send_response(status); self.send_header('content-type', 'application/json'); self.end_headers()
        self.wfile.write(json.dumps(obj).encode())
http.server.ThreadingHTTPServer(('127.0.0.1', int(sys.argv[1]) if len(sys.argv) > 1 else 8788), H).serve_forever()
