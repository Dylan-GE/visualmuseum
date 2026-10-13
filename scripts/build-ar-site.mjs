// Builds the TEMPORARY public AR test site into dist-ar/ (published by the
// "Publish temporary AR test site" GitHub Actions workflow, run by hand).
//
// The museum's content is not meant to be public, so this site ships only what
// the AR pages need: the AR model GLBs and a trimmed copy of the item data
// (names, descriptions, AR sizes). It does NOT ship the tunnel scans, the
// in-museum scene, the original OBJ models, item positions or quiz answers —
// the root page is a plain item list instead of the museum. It is marked
// noindex so search engines skip it.
//
// Usage: npm run build:ar-site         (base path defaults to /<repo>/ on GitHub,
//                                       /visualmuseum/ locally; override VITE_BASE)
import { spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'dist-ar');

const repoName = process.env.GITHUB_REPOSITORY?.split('/')[1] ?? 'visualmuseum';
const base = process.env.VITE_BASE || `/${repoName}/`;

const vite = path.join(ROOT, 'node_modules', 'vite', 'bin', 'vite.js');
const build = spawnSync(process.execPath, [vite, 'build', '--outDir', 'dist-ar', '--emptyOutDir'], {
  cwd: ROOT,
  stdio: 'inherit',
  env: { ...process.env, VITE_AR_ONLY: 'true', VITE_BASE: base },
});
if (build.status !== 0) process.exit(build.status ?? 1);

// 1) Keep only the AR models from public/models; drop the draco decoder (unused here).
const modelsDir = path.join(OUT, 'models');
for (const entry of fs.existsSync(modelsDir) ? fs.readdirSync(modelsDir) : []) {
  if (entry !== 'ar') fs.rmSync(path.join(modelsDir, entry), { recursive: true, force: true });
}
fs.rmSync(path.join(OUT, 'draco'), { recursive: true, force: true });

// 2) Replace the item data with a trimmed copy.
const dataPath = path.join(OUT, 'data', 'museum_data.json');
const full = JSON.parse(fs.readFileSync(path.join(ROOT, 'public', 'data', 'museum_data.json'), 'utf8'));
const trimmed = {
  items: full.items
    .filter((i) => i.ar?.glb)
    .map((i) => ({
      id: i.id,
      name: i.name,
      type: i.type,
      rarity: i.rarity,
      spec: i.spec,
      history: i.history && { mining_story: i.history.mining_story, use_value: i.history.use_value },
      ar: i.ar,
    })),
};
fs.mkdirSync(path.dirname(dataPath), { recursive: true });
for (const stale of fs.readdirSync(path.dirname(dataPath))) fs.rmSync(path.join(path.dirname(dataPath), stale), { force: true });
fs.writeFileSync(dataPath, JSON.stringify(trimmed));

// 3) noindex, SPA fallback for /<base>/ar/<id> (GitHub Pages serves 404.html for
//    unknown paths) and no Jekyll processing.
const indexPath = path.join(OUT, 'index.html');
const html = fs.readFileSync(indexPath, 'utf8').replace('<head>', '<head>\n    <meta name="robots" content="noindex,nofollow" />');
fs.writeFileSync(indexPath, html);
fs.writeFileSync(path.join(OUT, '404.html'), html);
fs.writeFileSync(path.join(OUT, '.nojekyll'), '');

// Summary
let files = 0;
let bytes = 0;
const walk = (dir) => {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p);
    else {
      files++;
      bytes += fs.statSync(p).size;
    }
  }
};
walk(OUT);
console.log(`\nAR test site: ${files} files, ${(bytes / 1048576).toFixed(1)} MB, base ${base}`);
console.log('top level:', fs.readdirSync(OUT).join(', '));
console.log(`items published: ${trimmed.items.length}`);
