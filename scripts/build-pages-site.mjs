// Builds the FULL museum (portal, 瑞三本鑛, the three site model pages, AR pages)
// into dist-pages/ for a TEMPORARY test publish on GitHub Pages.
//
// Everything in dist-pages becomes PUBLIC once published. The pages are marked
// noindex (meta + robots.txt), but anyone with the URL can open them.
//
// Usage:  node scripts/build-pages-site.mjs
//   PAGES_OWNER   GitHub user/org that serves the site   (default: Dylan-GE)
//   PAGES_REPO    repository name = base path             (default: visualmuseum)
//   MSYS_NO_PATHCONV is not needed: the base path is built here, not passed in.
//
// Then publish with scripts/publish-pages-branch.sh (pushes dist-pages to the
// gh-pages branch) and run the "Publish museum to GitHub Pages" workflow.
import { spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'dist-pages');
const owner = process.env.PAGES_OWNER ?? 'Dylan-GE';
const repo = process.env.PAGES_REPO ?? 'visualmuseum';
const base = `/${repo}/`;
const publicUrl = `https://${owner.toLowerCase()}.github.io`;

const vite = path.join(ROOT, 'node_modules', 'vite', 'bin', 'vite.js');
const build = spawnSync(process.execPath, [vite, 'build', '--outDir', 'dist-pages', '--emptyOutDir'], {
  cwd: ROOT,
  stdio: 'inherit',
  env: { ...process.env, VITE_BASE: base, VITE_PUBLIC_BASE_URL: publicUrl + base.replace(/\/$/, '') },
});
if (build.status !== 0) process.exit(build.status ?? 1);

// 1) public/ is copied wholesale by Vite, including things the site never loads (Revit
//    files, a 275 MB compressor OBJ that is not in museum_data.json...). Keep only the
//    files under models/tools that the item data actually references.
const data = JSON.parse(fs.readFileSync(path.join(ROOT, 'public', 'data', 'museum_data.json'), 'utf8'));
const keep = new Set();
const norm = (p) => path.normalize(p);
for (const item of data.items) {
  if (!item.model_url?.endsWith('.obj')) continue;
  const obj = path.join(OUT, item.model_url);
  const mtl = obj.replace(/\.obj$/, '.mtl');
  keep.add(norm(obj));
  keep.add(norm(mtl));
  if (fs.existsSync(mtl)) {
    for (const line of fs.readFileSync(mtl, 'utf8').split(/\r?\n/)) {
      const m = line.match(/^\s*map_\w+\s+(?:-\S+\s+)*(.+?)\s*$/);
      if (m) keep.add(norm(path.join(path.dirname(mtl), m[1].replace(/\\/g, '/'))));
    }
  }
}
function prune(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      prune(full);
      if (!fs.readdirSync(full).length) fs.rmdirSync(full);
    } else if (!keep.has(norm(full))) {
      fs.rmSync(full);
    }
  }
}
prune(path.join(OUT, 'models', 'tools'));

// 2) noindex everywhere + SPA fallback (GitHub Pages serves 404.html for unknown
//    paths such as /<repo>/ruisan or /<repo>/ar/<id>) + no Jekyll processing.
const indexPath = path.join(OUT, 'index.html');
let html = fs.readFileSync(indexPath, 'utf8');
if (!html.includes('name="robots"')) {
  html = html.replace('<head>', '<head>\n    <meta name="robots" content="noindex, nofollow" />');
}
fs.writeFileSync(indexPath, html);
fs.copyFileSync(indexPath, path.join(OUT, '404.html'));
fs.writeFileSync(path.join(OUT, 'robots.txt'), 'User-agent: *\nDisallow: /\n');
fs.writeFileSync(path.join(OUT, '.nojekyll'), '');

// 3) Size report (GitHub Pages: site <= 1 GB, individual files should stay < 100 MB).
let total = 0;
let biggest = [];
(function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else {
      const size = fs.statSync(full).size;
      total += size;
      biggest.push([size, path.relative(OUT, full)]);
    }
  }
})(OUT);
biggest.sort((a, b) => b[0] - a[0]);
console.log(`\ndist-pages: ${(total / 1e6).toFixed(0)} MB, base ${base}, QR links -> ${publicUrl}${base}ar/<id>`);
for (const [size, file] of biggest.slice(0, 6)) console.log(`  ${(size / 1e6).toFixed(1).padStart(7)} MB  ${file}`);
if (biggest[0][0] > 100e6) console.warn('WARNING: a file is over 100 MB; GitHub will reject it.');
