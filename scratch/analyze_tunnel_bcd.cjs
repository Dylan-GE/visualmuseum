// Inspects TunnelB/TunnelC/TunnelD (extracted early in the session, see
// PROGRESS.md's "modular tunnel pieces" discovery) to check the user's claim
// that they connect seamlessly and that TunnelD contains a real junction/
// transition. Extraction preserves ABSOLUTE bg.obj coordinates (no
// recentering), so if two pieces share an opening, their vertex clouds at
// that opening should coincide in raw OBJ space — a much stronger,
// ground-truth check than anything we could do with the hand-cropped
// SlopeB piece (which was never part of this modular system).
const fs = require('fs');
const path = require('path');

function loadObj(file) {
  const verts = [];
  const faces = [];
  const lines = fs.readFileSync(file, 'utf8').split('\n');
  for (const line of lines) {
    if (line.startsWith('v ')) {
      const [, x, y, z] = line.trim().split(/\s+/);
      verts.push([parseFloat(x), parseFloat(y), parseFloat(z)]);
    } else if (line.startsWith('f ')) {
      const idx = line.trim().split(/\s+/).slice(1).map((tok) => parseInt(tok.split('/')[0], 10) - 1);
      faces.push(idx);
    }
  }
  return { verts, faces };
}

function bbox(verts) {
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  for (const v of verts) {
    for (let i = 0; i < 3; i++) {
      if (v[i] < min[i]) min[i] = v[i];
      if (v[i] > max[i]) max[i] = v[i];
    }
  }
  return { min, max };
}

// Boundary edges = edges used by exactly 1 face (open mesh boundary loops,
// i.e. the "openings" where this piece was cut/connects to a neighbor).
function boundaryEdges({ verts, faces }) {
  const edgeCount = new Map();
  const key = (a, b) => (a < b ? `${a}_${b}` : `${b}_${a}`);
  for (const f of faces) {
    for (let i = 0; i < f.length; i++) {
      const a = f[i], b = f[(i + 1) % f.length];
      const k = key(a, b);
      edgeCount.set(k, (edgeCount.get(k) || 0) + 1);
    }
  }
  const openVertIdx = new Set();
  for (const [k, count] of edgeCount) {
    if (count === 1) {
      const [a, b] = k.split('_').map(Number);
      openVertIdx.add(a);
      openVertIdx.add(b);
    }
  }
  return [...openVertIdx].map((i) => verts[i]);
}

// Cluster open-boundary vertices into loops by proximity (simple greedy
// clustering — good enough to separate distinct openings that are far apart
// relative to a loop's own diameter).
function clusterPoints(points, threshold) {
  const clusters = [];
  for (const p of points) {
    let placed = false;
    for (const c of clusters) {
      const cx = c.reduce((s, q) => s + q[0], 0) / c.length;
      const cy = c.reduce((s, q) => s + q[1], 0) / c.length;
      const cz = c.reduce((s, q) => s + q[2], 0) / c.length;
      const d = Math.hypot(p[0] - cx, p[1] - cy, p[2] - cz);
      if (d < threshold) { c.push(p); placed = true; break; }
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

for (const name of ['TunnelB', 'TunnelC', 'TunnelD']) {
  const objPath = path.join(__dirname, 'tunnel_pieces', name, 'piece.obj');
  const mesh = loadObj(objPath);
  const box = bbox(mesh.verts);
  console.log(`\n=== ${name} ===`);
  console.log('verts:', mesh.verts.length, 'faces:', mesh.faces.length);
  console.log('bbox min:', box.min.map((v) => v.toFixed(3)), 'max:', box.max.map((v) => v.toFixed(3)));
  const size = [0, 1, 2].map((i) => box.max[i] - box.min[i]);
  console.log('size (x,y,z):', size.map((v) => v.toFixed(3)));

  const openPts = boundaryEdges(mesh);
  console.log('open boundary verts:', openPts.length);
  const diag = Math.hypot(...size);
  const clusters = clusterPoints(openPts, diag * 0.15);
  console.log('open loops found:', clusters.length);
  clusters
    .sort((a, b) => b.length - a.length)
    .forEach((c, i) => {
      const cen = centroid(c);
      console.log(`  loop ${i}: ${c.length} verts, centroid=`, cen.map((v) => v.toFixed(3)));
    });
}
