// Builds the hand-over package into release/ :
//
//   release/museum-site/      the website, ready to copy to the web server
//   release/server-configs/   nginx / Apache / IIS examples (also copied into museum-site/)
//   release/DEPLOY.md         deployment manual
//   release/THIRD_PARTY_LICENSES.csv, MANIFEST.txt
//
// Usage:  node scripts/build-release.mjs [--base /museum/] [--public-url https://example.gov.tw] [--index]
//   --base        sub-path the site is served from (default "/": the site sits at the domain root)
//   --public-url  force the origin used inside the AR QR codes (default: whatever domain the
//                 visitor is on, which is almost always what you want)
//   --index       allow search engines (default: noindex while the site is not public yet)
import { spawnSync, execFileSync } from 'child_process';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const REL = path.join(ROOT, 'release');
const SITE = path.join(REL, 'museum-site');

const args = process.argv.slice(2);
const opt = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : fallback;
};
let base = opt('base', '/');
if (!base.startsWith('/')) base = `/${base}`;
if (!base.endsWith('/')) base += '/';
const publicUrl = opt('public-url', '');
const allowIndex = args.includes('--index');

fs.rmSync(REL, { recursive: true, force: true });
fs.mkdirSync(REL, { recursive: true });

// 1) production build
const vite = path.join(ROOT, 'node_modules', 'vite', 'bin', 'vite.js');
const build = spawnSync(process.execPath, [vite, 'build', '--outDir', SITE, '--emptyOutDir'], {
  cwd: ROOT,
  stdio: 'inherit',
  env: { ...process.env, VITE_BASE: base, ...(publicUrl ? { VITE_PUBLIC_BASE_URL: publicUrl } : {}) },
});
if (build.status !== 0) process.exit(build.status ?? 1);

// 2) drop public/ files the site never loads (Revit files, a 275 MB compressor OBJ ...):
//    under models/tools keep only what museum_data.json references.
const data = JSON.parse(fs.readFileSync(path.join(ROOT, 'public', 'data', 'museum_data.json'), 'utf8'));
const keep = new Set();
const norm = (p) => path.normalize(p);
for (const item of data.items) {
  if (!item.model_url?.endsWith('.obj')) continue;
  const obj = path.join(SITE, item.model_url);
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
(function prune(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      prune(full);
      if (!fs.readdirSync(full).length) fs.rmdirSync(full);
    } else if (!keep.has(norm(full))) fs.rmSync(full);
  }
})(path.join(SITE, 'models', 'tools'));

// 3) index.html tweaks + SPA fallback copy + robots
const indexPath = path.join(SITE, 'index.html');
let html = fs.readFileSync(indexPath, 'utf8');
if (!allowIndex && !html.includes('name="robots"')) html = html.replace('<head>', '<head>\n    <meta name="robots" content="noindex, nofollow" />');
fs.writeFileSync(indexPath, html);
fs.copyFileSync(indexPath, path.join(SITE, '404.html'));
fs.writeFileSync(path.join(SITE, 'robots.txt'), allowIndex ? 'User-agent: *\nAllow: /\n' : 'User-agent: *\nDisallow: /\n');

// 4) server configuration examples
const cfgDir = path.join(REL, 'server-configs');
fs.mkdirSync(cfgDir, { recursive: true });
const baseNoSlash = base.replace(/\/$/, '');
const nginx = `# nginx — site files in /var/www/museum${base === '/' ? '' : ` (served under ${base})`}
server {
    listen 443 ssl http2;
    server_name museum.example.gov.tw;            # <- change
    ssl_certificate     /etc/ssl/museum.crt;      # <- change (HTTPS is required for phone AR)
    ssl_certificate_key /etc/ssl/museum.key;

    root /var/www/museum;
    index index.html;

    # 3D / data file types
    types {
        model/gltf-binary            glb;
        model/gltf+json              gltf;
        text/plain                   obj mtl;
        application/wasm             wasm;
    }
    include /etc/nginx/mime.types;

    gzip on;
    gzip_types text/plain text/css application/javascript application/json application/wasm image/svg+xml;
    # .glb / .jpg / .webp are already compressed

    # Hashed build files never change: cache hard
    location ${baseNoSlash}/assets/ { add_header Cache-Control "public, max-age=31536000, immutable"; }
    location ${baseNoSlash}/models/ { add_header Cache-Control "public, max-age=604800"; }

    # Single-page app: unknown paths (/ruisan, /guoying, /ar/<id> ...) -> index.html
    location ${base} {
        try_files $uri $uri/ ${base}index.html;
    }
}
`;
const htaccess = `# Apache (mod_rewrite, mod_mime). Place in the site root.
AddType model/gltf-binary .glb
AddType model/gltf+json   .gltf
AddType text/plain        .obj .mtl
AddType application/wasm  .wasm

RewriteEngine On
RewriteBase ${base}
RewriteRule ^index\\.html$ - [L]
RewriteCond %{REQUEST_FILENAME} !-f
RewriteCond %{REQUEST_FILENAME} !-d
RewriteRule . ${base}index.html [L]
`;
const webConfig = `<?xml version="1.0" encoding="UTF-8"?>
<!-- IIS (URL Rewrite module required). Place in the site root. -->
<configuration>
  <system.webServer>
    <staticContent>
      <remove fileExtension=".glb" />   <mimeMap fileExtension=".glb"  mimeType="model/gltf-binary" />
      <remove fileExtension=".gltf" />  <mimeMap fileExtension=".gltf" mimeType="model/gltf+json" />
      <remove fileExtension=".obj" />   <mimeMap fileExtension=".obj"  mimeType="text/plain" />
      <remove fileExtension=".mtl" />   <mimeMap fileExtension=".mtl"  mimeType="text/plain" />
      <remove fileExtension=".wasm" />  <mimeMap fileExtension=".wasm" mimeType="application/wasm" />
      <remove fileExtension=".webp" />  <mimeMap fileExtension=".webp" mimeType="image/webp" />
    </staticContent>
    <rewrite>
      <rules>
        <rule name="SPA fallback" stopProcessing="true">
          <match url=".*" />
          <conditions logicalGrouping="MatchAll">
            <add input="{REQUEST_FILENAME}" matchType="IsFile" negate="true" />
            <add input="{REQUEST_FILENAME}" matchType="IsDirectory" negate="true" />
          </conditions>
          <action type="Rewrite" url="${base}index.html" />
        </rule>
      </rules>
    </rewrite>
  </system.webServer>
</configuration>
`;
fs.writeFileSync(path.join(cfgDir, 'nginx.conf'), nginx);
fs.writeFileSync(path.join(cfgDir, 'apache.htaccess'), htaccess);
fs.writeFileSync(path.join(cfgDir, 'iis.web.config'), webConfig);
fs.writeFileSync(path.join(SITE, '.htaccess'), htaccess);
fs.writeFileSync(path.join(SITE, 'web.config'), webConfig);

// 5) third-party licences (production dependency closure from package-lock.json)
const lock = JSON.parse(fs.readFileSync(path.join(ROOT, 'package-lock.json'), 'utf8'));
const rows = [['package', 'version', 'license', 'homepage']];
for (const [key, info] of Object.entries(lock.packages ?? {})) {
  if (!key || info.dev || info.optional) continue;
  const pj = path.join(ROOT, key, 'package.json');
  if (!fs.existsSync(pj)) continue;
  const meta = JSON.parse(fs.readFileSync(pj, 'utf8'));
  const lic = typeof meta.license === 'string' ? meta.license : meta.license?.type ?? (meta.licenses ?? []).map((l) => l.type).join(' OR ');
  let licence = lic;
  if (!licence) {
    // no "license" field: fall back to the licence file shipped with the package
    const file = ['LICENSE', 'LICENSE.md', 'LICENSE.txt', 'license'].map((f) => path.join(ROOT, key, f)).find((f) => fs.existsSync(f));
    const head = file ? fs.readFileSync(file, 'utf8').slice(0, 400) : '';
    licence = /MIT License/i.test(head) ? 'MIT (from LICENSE file)' : /Apache License/i.test(head) ? 'Apache-2.0 (from LICENSE file)' : 'UNKNOWN';
  }
  rows.push([meta.name, meta.version, licence, meta.homepage ?? '']);
}
fs.writeFileSync(
  path.join(REL, 'THIRD_PARTY_LICENSES.csv'),
  '﻿' + rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n') + '\n',
);

// 6) manifest (every file, size, sha256) so the receiver can verify the copy
const manifest = [];
let total = 0;
(function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else {
      const buf = fs.readFileSync(full);
      total += buf.length;
      manifest.push(`${crypto.createHash('sha256').update(buf).digest('hex')}  ${String(buf.length).padStart(10)}  ${path.relative(SITE, full).replace(/\\/g, '/')}`);
    }
  }
})(SITE);
const commit = execFileSync('git', ['rev-parse', '--short', 'HEAD'], { cwd: ROOT }).toString().trim();
fs.writeFileSync(
  path.join(REL, 'MANIFEST.txt'),
  `Virtual Mining Museum - release manifest\nbuilt: ${new Date().toISOString()}\ngit commit: ${commit}\nbase path: ${base}\nAR QR origin: ${publicUrl || '(the visitor\'s own domain)'}\nsearch engines: ${allowIndex ? 'allowed' : 'noindex'}\nfiles: ${manifest.length}, ${(total / 1e6).toFixed(0)} MB\n\nsha256  bytes  path\n${manifest.join('\n')}\n`,
);

console.log(`\nrelease/museum-site: ${manifest.length} files, ${(total / 1e6).toFixed(0)} MB, base ${base}`);

// 7) documents + source archive
for (const doc of ['DEPLOY.md', 'IIS_上架步驟.md']) {
  const src = path.join(ROOT, 'docs', doc);
  if (fs.existsSync(src)) fs.copyFileSync(src, path.join(REL, doc));
}
// scratch/ holds ~230 MB of intermediate tunnel exports; the full history stays in the git repository.
execFileSync('git', ['archive', '--format=zip', '-o', path.join(REL, `source-code-${commit}.zip`), 'HEAD', '--', '.', ':(exclude)scratch'], { cwd: ROOT });
console.log(`release/source-code-${commit}.zip (tracked source files without scratch/; the large model files are inside museum-site/models/)`);
