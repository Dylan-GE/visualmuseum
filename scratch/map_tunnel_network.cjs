// Systematically maps the real connectivity graph among every large
// extracted piece (TunnelA1..A10, TunnelB/C/D, SlopeA/B/G, Slope18) by
// matching open-boundary-loop centroids across pieces in raw bg.obj
// coordinate space (extraction never recenters, see PROGRESS.md) — instead
// of continuing to ask the user to check one candidate connection at a time.
const fs = require('fs');
const path = require('path');

function loadObj(file) {
  const verts = [];
  const faces = [];
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    if (line.startsWith('v ')) {
      const [, x, y, z] = line.trim().split(/\s+/);
      verts.push([parseFloat(x), parseFloat(y), parseFloat(z)]);
    } else if (line.startsWith('f ')) {
      faces.push(line.trim().split(/\s+/).slice(1).map((t) => parseInt(t.split('/')[0], 10) - 1));
    }
  }
  return { verts, faces };
}

function bbox(verts) {
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  for (const v of verts) for (let i = 0; i < 3; i++) { if (v[i] < min[i]) min[i] = v[i]; if (v[i] > max[i]) max[i] = v[i]; }
  return { min, max };
}

function boundaryEdges({ verts, faces }) {
  const edgeCount = new Map();
  const key = (a, b) => (a < b ? `${a}_${b}` : `${b}_${a}`);
  for (const f of faces) for (let i = 0; i < f.length; i++) {
    const a = f[i], b = f[(i + 1) % f.length];
    const k = key(a, b);
    edgeCount.set(k, (edgeCount.get(k) || 0) + 1);
  }
  const openIdx = new Set();
  for (const [k, c] of edgeCount) if (c === 1) { const [a, b] = k.split('_').map(Number); openIdx.add(a); openIdx.add(b); }
  return [...openIdx].map((i) => verts[i]);
}

function clusterPoints(points, threshold) {
  const clusters = [];
  for (const p of points) {
    let placed = false;
    for (const c of clusters) {
      const cx = c.reduce((s, q) => s + q[0], 0) / c.length;
      const cy = c.reduce((s, q) => s + q[1], 0) / c.length;
      const cz = c.reduce((s, q) => s + q[2], 0) / c.length;
      if (Math.hypot(p[0] - cx, p[1] - cy, p[2] - cz) < threshold) { c.push(p); placed = true; break; }
    }
    if (!placed) clusters.push([p]);
  }
  return clusters;
}

function centroid(points) {
  const c = [0, 0, 0];
  for (const p of points) { c[0] += p[0]; c[1] += p[1]; c[2] += p[2]; }
  return c.map((v) => v / points.length);
}

const PIECES_DIR = path.join(__dirname, 'tunnel_pieces');
const NAMES = fs.readdirSync(PIECES_DIR).filter((n) => fs.existsSync(path.join(PIECES_DIR, n, 'piece.obj')));

const pieceOpenings = []; // { name, loopIndex, centroid, size }
for (const name of NAMES) {
  const mesh = loadObj(path.join(PIECES_DIR, name, 'piece.obj'));
  const box = bbox(mesh.verts);
  const size = [0, 1, 2].map((i) => box.max[i] - box.min[i]);
  const diag = Math.hypot(...size) || 1;
  const openPts = boundaryEdges(mesh);
  const clusters = clusterPoints(openPts, diag * 0.15);
  clusters.forEach((c, i) => {
    if (c.length < 4) return; // ignore tiny/degenerate boundary fragments
    pieceOpenings.push({ name, loopIndex: i, count: c.length, centroid: centroid(c) });
  });
}

console.log(`Analyzed ${NAMES.length} pieces, ${pieceOpenings.length} openings total.\n`);

// Match openings across DIFFERENT pieces whose centroids coincide within a
// tight absolute tolerance (real shared seams should match near-exactly,
// unlike the loose per-piece clustering threshold above).
const MATCH_TOL = 0.5;
const matches = [];
for (let i = 0; i < pieceOpenings.length; i++) {
  for (let j = i + 1; j < pieceOpenings.length; j++) {
    const a = pieceOpenings[i], b = pieceOpenings[j];
    if (a.name === b.name) continue;
    const d = Math.hypot(a.centroid[0] - b.centroid[0], a.centroid[1] - b.centroid[1], a.centroid[2] - b.centroid[2]);
    if (d < MATCH_TOL) matches.push({ a, b, d });
  }
}

console.log('=== Confirmed connections (shared opening within 0.5 units) ===');
matches
  .sort((m1, m2) => m1.d - m2.d)
  .forEach((m) => console.log(`${m.a.name}(loop${m.a.loopIndex}) <-> ${m.b.name}(loop${m.b.loopIndex})  dist=${m.d.toFixed(4)}  at ${m.a.centroid.map((v) => v.toFixed(2))}`));

console.log('\n=== Every piece, every opening (unmatched = dead end or connects to something not yet extracted) ===');
const matchedKeys = new Set();
matches.forEach((m) => { matchedKeys.add(`${m.a.name}#${m.a.loopIndex}`); matchedKeys.add(`${m.b.name}#${m.b.loopIndex}`); });
for (const name of NAMES) {
  const openings = pieceOpenings.filter((o) => o.name === name);
  if (!openings.length) continue;
  console.log(`\n${name}:`);
  openings.forEach((o) => {
    const matched = matchedKeys.has(`${o.name}#${o.loopIndex}`);
    console.log(`  loop${o.loopIndex} (${o.count} verts) @ ${o.centroid.map((v) => v.toFixed(2))} ${matched ? '' : '<-- UNMATCHED (dead end / not yet extracted)'}`);
  });
}
