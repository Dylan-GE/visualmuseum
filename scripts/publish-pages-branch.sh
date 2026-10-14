#!/usr/bin/env bash
# Publishes dist-pages/ (from `npm run build:pages`) as the single commit of the gh-pages
# branch, replacing whatever was there. The rest of the repository is not touched: a
# throw-away git repo is created next to the project just for this push.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SRC="$ROOT/dist-pages"
WORK="${PAGES_WORKDIR:-$ROOT/../.pages-publish}"
REMOTE="$(git -C "$ROOT" remote get-url origin)"

[ -d "$SRC" ] || { echo "dist-pages/ not found - run: npm run build:pages"; exit 1; }

rm -rf "$WORK"
mkdir -p "$WORK"
cp -R "$SRC"/. "$WORK"/
cd "$WORK"
git init -q -b gh-pages
git add -A
git -c user.name="museum-publish" -c user.email="museum-publish@users.noreply.github.com" \
  commit -q -m "Publish museum test site"
git remote add origin "$REMOTE"
git push --force origin gh-pages
echo "Pushed gh-pages. Now run the 'Publish museum to GitHub Pages' workflow."
