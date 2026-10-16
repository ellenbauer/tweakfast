#!/bin/sh
# Builds a Tweakfast site bundle ready for `sf publish`.
#   tools/bundle.sh <site folder with the pages> <output folder>
# Pages go to _site/ and are made plain (tools/clean.py: programs and badges out, the script line in),
# static files stay at the root, the script and the worker are added.
set -e
SRC="$1"; OUT="$2"; HERE="$(cd "$(dirname "$0")/.." && pwd)"
[ -d "$SRC" ] && [ -n "$OUT" ] || { echo "usage: tools/bundle.sh <site folder> <output folder>"; exit 1; }
rm -rf "$OUT"; mkdir -p "$OUT/_site" "$OUT/functions"
# the site's files, without what is not for readers: hidden files (.git, .env, .spacefast) and node_modules
rsync -a --include='.well-known/' --exclude='.*' --exclude='node_modules' "$SRC"/ "$OUT"/
for f in "$OUT"/*.html; do
  [ -f "$f" ] || continue
  sed -e 's|<script src="[^"]*tweakfast.js"></script>|<script src="/tweakfast.js"></script>|' "$f" > "$OUT/_site/$(basename "$f")"
  rm "$f"
done
python3 "$HERE/tools/clean.py" "$OUT"/_site/*.html
# the editor's version is a short hash of its text and the mender's: a changed editor is never an old one from a cache, committed or not
STAMP="$(cat "$HERE/src/tweakfast-editor.js" "$HERE/src/tweakfast-mend.js" | python3 -c 'import hashlib,sys; print(hashlib.sha256(sys.stdin.buffer.read()).hexdigest()[:10])')"
# the loader, on every page: its comments stay in the source, readers get only the code
sed -e "s/var BUILD = 'dev';/var BUILD = '$STAMP';/" "$HERE/src/tweakfast.js" | python3 -c 'import re,sys; s=re.sub(r"/\*[\s\S]*?\*/", "", sys.stdin.read()); print("\n".join(l.strip() for l in s.splitlines() if l.strip()))' > "$OUT/tweakfast.js"
sed -e "s/var BUILD = 'dev';/var BUILD = '$STAMP';/" "$HERE/src/tweakfast-editor.js" > "$OUT/tweakfast-editor.js"   # the editor, owner only
cp "$HERE/src/tweakfast-mend.js" "$OUT/tweakfast-mend.js"   # what the cleaning took away, mended for readers
cp "$HERE/site/functions/[...rest].js" "$OUT/functions/[...rest].js"
echo "bundle ready in $OUT: $(ls "$OUT/_site" | wc -l | tr -d ' ') pages"
