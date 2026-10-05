// Computes the oriented bounding box (via PCA on raw OBJ vertices) of a
// tunnel piece, to figure out how much it's tilted from world axes and what
// rotation would lay it flat (long axis horizontal, thin axis vertical).
const fs = require('fs');

function loadVerts(objPath) {
  const lines = fs.readFileSync(objPath, 'utf8').split('\n');
  const verts = [];
  for (const line of lines) {
    if (line.startsWith('v ')) {
      const [, x, y, z] = line.trim().split(/\s+/);
      verts.push([parseFloat(x), parseFloat(y), parseFloat(z)]);
    }
  }
  return verts;
}

function mean(verts) {
  const c = [0, 0, 0];
  for (const v of verts) { c[0] += v[0]; c[1] += v[1]; c[2] += v[2]; }
  return c.map((s) => s / verts.length);
}

function covariance(verts, c) {
  const cov = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
  for (const v of verts) {
    const d = [v[0] - c[0], v[1] - c[1], v[2] - c[2]];
    for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) cov[i][j] += d[i] * d[j];
  }
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) cov[i][j] /= verts.length;
  return cov;
}

function jacobiEigen(a) {
  const A = a.map((row) => row.slice());
  const V = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
  for (let sweep = 0; sweep < 100; sweep++) {
    const off = Math.abs(A[0][1]) + Math.abs(A[0][2]) + Math.abs(A[1][2]);
    if (off < 1e-12) break;
    for (const [p, q] of [[0, 1], [0, 2], [1, 2]]) {
      if (Math.abs(A[p][q]) < 1e-14) continue;
      const theta = (A[q][q] - A[p][p]) / (2 * A[p][q]);
      const sign = theta >= 0 ? 1 : -1;
      const t = sign / (Math.abs(theta) + Math.sqrt(theta * theta + 1));
      const c = 1 / Math.sqrt(t * t + 1);
      const s = t * c;
      const App = A[p][p], Aqq = A[q][q], Apq = A[p][q];
      A[p][p] = App - t * Apq;
      A[q][q] = Aqq + t * Apq;
      A[p][q] = A[q][p] = 0;
      for (let k = 0; k < 3; k++) {
        if (k !== p && k !== q) {
          const Akp = A[k][p], Akq = A[k][q];
          A[k][p] = A[p][k] = c * Akp - s * Akq;
          A[k][q] = A[q][k] = s * Akp + c * Akq;
        }
      }
      for (let k = 0; k < 3; k++) {
        const Vkp = V[k][p], Vkq = V[k][q];
        V[k][p] = c * Vkp - s * Vkq;
        V[k][q] = s * Vkp + c * Vkq;
      }
    }
  }
  const values = [A[0][0], A[1][1], A[2][2]];
  const vectors = [
    [V[0][0], V[1][0], V[2][0]],
    [V[0][1], V[1][1], V[2][1]],
    [V[0][2], V[1][2], V[2][2]],
  ];
  return { values, vectors };
}

function normalize(v) {
  const len = Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]);
  return [v[0] / len, v[1] / len, v[2] / len];
}

function cross(a, b) {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}

function analyze(name, objPath, targetOrder = [1, 2, 0]) {
  const verts = loadVerts(objPath);
  const c = mean(verts);
  const cov = covariance(verts, c);
  const { values, vectors } = jacobiEigen(cov);
  const order = [0, 1, 2].sort((i, j) => values[j] - values[i]);
  let sortedVecs = order.map((i) => normalize(vectors[i]));
  // force right-handed basis
  if (
    Math.abs(
      cross(sortedVecs[0], sortedVecs[1]).reduce((s, v, i) => s + v * sortedVecs[2][i], 0) - 1,
    ) > 0.5
  ) {
    sortedVecs[2] = cross(sortedVecs[0], sortedVecs[1]);
  }

  const extents = sortedVecs.map((axis) => {
    let min = Infinity, max = -Infinity;
    for (const v of verts) {
      const d = [v[0] - c[0], v[1] - c[1], v[2] - c[2]];
      const proj = d[0] * axis[0] + d[1] * axis[1] + d[2] * axis[2];
      if (proj < min) min = proj;
      if (proj > max) max = proj;
    }
    return { min, max, size: max - min };
  });

  console.log('==', name, '==');
  console.log('centroid', c.map((x) => x.toFixed(3)));
  sortedVecs.forEach((axis, i) => {
    console.log(
      `  axis${i} (${i === 0 ? 'longest' : i === 1 ? 'mid' : 'shortest'}):`,
      axis.map((x) => x.toFixed(4)),
      'size', extents[i].size.toFixed(3),
    );
  });

  // Target: v_new[k] = dot(v-c, axis[targetOrder[k]]) for k in {X,Y,Z}.
  // Default [1,2,0] (mid->X, shortest->Y, longest->Z) suits an elongated
  // beam lying flat along the tunnel's length. A frame/truss shape (flat in
  // its own thin direction, not elongated along it) instead wants its
  // SHORTEST axis on Z (perpendicular to the tunnel, like the arch's 0.12m
  // thickness) — pass targetOrder=[1,0,2] for that (mid->X width,
  // longest->Y height, shortest->Z thickness). Whichever order is used, the
  // determinant is checked below and sign-flipped if needed, so any
  // permutation still comes out as a proper rotation.
  const M = [sortedVecs[targetOrder[0]].slice(), sortedVecs[targetOrder[1]].slice(), sortedVecs[targetOrder[2]].slice()];
  const det =
    M[0][0] * (M[1][1] * M[2][2] - M[1][2] * M[2][1]) -
    M[0][1] * (M[1][0] * M[2][2] - M[1][2] * M[2][0]) +
    M[0][2] * (M[1][0] * M[2][1] - M[1][1] * M[2][0]);
  if (det < 0) M[2] = M[2].map((v) => -v);
  console.log('  det before fix:', det.toFixed(3));
  console.log('  rotation matrix M (v_new = M * (v - centroid) + centroid):');
  M.forEach((row) => console.log('   ', row.map((x) => x.toFixed(4))));

  // sanity check: apply M to a few sample verts and recompute bbox
  let ymin = Infinity, ymax = -Infinity, xmin = Infinity, xmax = -Infinity, zmin = Infinity, zmax = -Infinity;
  for (const v of verts) {
    const d = [v[0] - c[0], v[1] - c[1], v[2] - c[2]];
    const nx = M[0][0] * d[0] + M[0][1] * d[1] + M[0][2] * d[2];
    const ny = M[1][0] * d[0] + M[1][1] * d[1] + M[1][2] * d[2];
    const nz = M[2][0] * d[0] + M[2][1] * d[1] + M[2][2] * d[2];
    if (nx < xmin) xmin = nx; if (nx > xmax) xmax = nx;
    if (ny < ymin) ymin = ny; if (ny > ymax) ymax = ny;
    if (nz < zmin) zmin = nz; if (nz > zmax) zmax = nz;
  }
  console.log('  after rotation, local extents: x=', (xmax - xmin).toFixed(3), 'y=', (ymax - ymin).toFixed(3), 'z=', (zmax - zmin).toFixed(3));

  // Decompose M into three.js XYZ-order Euler angles (radians), so we can
  // apply this as a fixed `rotation` prop on the piece's wrapping <group>.
  const m11 = M[0][0], m12 = M[0][1], m13 = M[0][2];
  const m23 = M[1][2];
  const m32 = M[2][1], m33 = M[2][2];
  let ex, ey, ez;
  ey = Math.asin(Math.max(-1, Math.min(1, m13)));
  if (Math.abs(m13) < 0.9999999) {
    ex = Math.atan2(-m23, m33);
    ez = Math.atan2(-m12, m11);
  } else {
    ex = Math.atan2(m32, m22);
    ez = 0;
  }
  console.log('  euler XYZ (rad):', [ex, ey, ez].map((v) => v.toFixed(4)), ' (deg):', [ex, ey, ez].map((v) => (v * 180 / Math.PI).toFixed(1)));

  // round-trip check: rebuild rotation matrix from euler XYZ and compare to M
  const cx = Math.cos(ex), sx = Math.sin(ex);
  const cy = Math.cos(ey), sy = Math.sin(ey);
  const cz = Math.cos(ez), sz = Math.sin(ez);
  const R = [
    [cy * cz, -cy * sz, sy],
    [cx * sz + sx * sy * cz, cx * cz - sx * sy * sz, -sx * cy],
    [sx * sz - cx * sy * cz, sx * cz + cx * sy * sz, cx * cy],
  ];
  let maxDiff = 0;
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) maxDiff = Math.max(maxDiff, Math.abs(R[i][j] - M[i][j]));
  console.log('  round-trip max diff vs M:', maxDiff.toFixed(6), maxDiff < 1e-3 ? '(OK)' : '(MISMATCH!)');
}

analyze('BoxWoodA', 'D:/Project/VirtualMuseum/scratch/tunnel_pieces/BoxWoodA/piece.obj');
analyze('BoxWoodB', 'D:/Project/VirtualMuseum/scratch/tunnel_pieces/BoxWoodB/piece.obj');
analyze('SupportWoodA', 'D:/Project/VirtualMuseum/scratch/tunnel_pieces/SupportWoodA/piece.obj');
analyze('SupportWoodB', 'D:/Project/VirtualMuseum/scratch/tunnel_pieces/SupportWoodB/piece.obj');
analyze('SupportWoodC', 'D:/Project/VirtualMuseum/scratch/tunnel_pieces/SupportWoodC/piece.obj');
// ThreeSupportComposite is a frame (crossbeam + 2 angled legs), not an
// elongated beam — it should lie FLAT like the arch (thinnest axis on Z),
// not run lengthwise along Z, so use targetOrder [1,0,2]: mid->X (width),
// longest->Y (height, the legs), shortest->Z (thickness, perpendicular to
// the tunnel like the arch's 0.12m).
analyze(
  'ThreeSupportComposite (longest->X)',
  'D:/Project/VirtualMuseum/scratch/tunnel_pieces/ThreeSupportComposite/piece.obj',
  [0, 1, 2],
);
