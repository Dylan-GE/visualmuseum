// Derives each piece's actual centerline shape by binning vertices along
// its dominant axis and averaging each bin — reveals whether a piece is a
// straight tube (2-point line is exact) or genuinely bent (needs a
// multi-point spine), instead of assuming. This is the check that was
// skipped for the old SlopeB-derived junction and caused most of this
// session's junction bugs — doing it up front this time for TunnelB/C/D
// and SlopeA before any placement math is written.
const fs = require('fs');
const path = require('path');

function loadObj(file) {
  const verts = [];
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    if (line.startsWith('v ')) {
      const [, x, y, z] = line.trim().split(/\s+/);
      verts.push([parseFloat(x), parseFloat(y), parseFloat(z)]);
    }
  }
  return verts;
}

function mean(vs) {
  const m = [0, 0, 0];
  for (const v of vs) { m[0] += v[0]; m[1] += v[1]; m[2] += v[2]; }
  return m.map((x) => x / vs.length);
}

function sub(a, b) { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; }
function dot(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
function norm(a) { return Math.hypot(...a); }

// PCA via the covariance matrix's dominant eigenvector (power iteration —
// good enough for a clear dominant axis like a tube's length).
function dominantAxis(verts, centroid) {
  const cov = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
  for (const v of verts) {
    const d = sub(v, centroid);
    for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) cov[i][j] += d[i] * d[j];
  }
  let vec = [1, 1, 1];
  for (let iter = 0; iter < 100; iter++) {
    const next = [
      cov[0][0] * vec[0] + cov[0][1] * vec[1] + cov[0][2] * vec[2],
      cov[1][0] * vec[0] + cov[1][1] * vec[1] + cov[1][2] * vec[2],
      cov[2][0] * vec[0] + cov[2][1] * vec[1] + cov[2][2] * vec[2],
    ];
    const n = norm(next) || 1;
    vec = next.map((x) => x / n);
  }
  return vec;
}

function spineFor(name, bins = 12) {
  const verts = loadObj(path.join(__dirname, 'tunnel_pieces', name, 'piece.obj'));
  const c = mean(verts);
  const axis = dominantAxis(verts, c);
  const projections = verts.map((v) => dot(sub(v, c), axis));
  const minP = Math.min(...projections), maxP = Math.max(...projections);
  const buckets = Array.from({ length: bins }, () => []);
  verts.forEach((v, i) => {
    const t = (projections[i] - minP) / (maxP - minP || 1);
    const bi = Math.min(bins - 1, Math.floor(t * bins));
    buckets[bi].push(v);
  });
  console.log(`\n=== ${name} spine (${bins} bins along PCA axis, axis=${axis.map((v) => v.toFixed(3))}) ===`);
  const spine = [];
  buckets.forEach((b, i) => {
    if (!b.length) { console.log(` bin ${i}: (empty)`); return; }
    const bc = mean(b);
    spine.push(bc);
    console.log(` bin ${i}: n=${b.length}, centroid=${bc.map((v) => v.toFixed(2))}`);
  });
  // Deviation of each spine point from the straight line between the first
  // and last spine points — near-zero everywhere means genuinely straight.
  if (spine.length >= 2) {
    const p0 = spine[0], p1 = spine[spine.length - 1];
    const dir = sub(p1, p0);
    const dirLen = norm(dir) || 1;
    const unit = dir.map((v) => v / dirLen);
    let maxDev = 0;
    spine.forEach((p) => {
      const rel = sub(p, p0);
      const along = dot(rel, unit);
      const proj = unit.map((v) => v * along);
      const dev = norm(sub(rel, proj));
      if (dev > maxDev) maxDev = dev;
    });
    console.log(` max deviation from straight line (p0->pN): ${maxDev.toFixed(3)} units`);
  }
  return spine;
}

['TunnelB', 'TunnelC', 'TunnelD', 'SlopeA'].forEach((n) => spineFor(n));
