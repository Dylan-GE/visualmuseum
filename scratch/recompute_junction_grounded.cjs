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

// Same PRE_ROTATION as before (Euler XYZ, matches three.js Object3D.rotation.set order).
const EULER = [-0.311674, 1.567808, 0];
function buildEulerMatrix([ex, ey, ez]) {
  const cx = Math.cos(ex), sx = Math.sin(ex);
  const cy = Math.cos(ey), sy = Math.sin(ey);
  const cz = Math.cos(ez), sz = Math.sin(ez);
  // three.js Euler 'XYZ' order rotation matrix (matches compute_obb.cjs's R).
  return [
    [cy * cz, -cy * sz, sy],
    [cx * sz + sx * sy * cz, cx * cz - sx * sy * sz, -sx * cy],
    [sx * sz - cx * sy * cz, sx * cz + cx * sy * sz, cx * cy],
  ];
}
function applyMatrix(M, [x, y, z]) {
  return [
    M[0][0] * x + M[0][1] * y + M[0][2] * z,
    M[1][0] * x + M[1][1] * y + M[1][2] * z,
    M[2][0] * x + M[2][1] * y + M[2][2] * z,
  ];
}

const M = buildEulerMatrix(EULER);
const verts = loadVerts('tunnel_pieces/JunctionCandidate/piece.obj');
const rotated = verts.map((v) => applyMatrix(M, v));

let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity, minZ = Infinity, maxZ = -Infinity;
for (const [x, y, z] of rotated) {
  if (x < minX) minX = x; if (x > maxX) maxX = x;
  if (y < minY) minY = y; if (y > maxY) maxY = y;
  if (z < minZ) minZ = z; if (z > maxZ) maxZ = z;
}
// Same anchor useGroundedParts computes: box3.getCenter() for X/Z, box.min.y for Y.
const anchor = [(minX + maxX) / 2, minY, (minZ + maxZ) / 2];
console.log('bounding box (post PRE_ROTATION): x', minX.toFixed(3), maxX.toFixed(3), 'y', minY.toFixed(3), maxY.toFixed(3), 'z', minZ.toFixed(3), maxZ.toFixed(3));
console.log('grounding anchor (center X/Z, min Y):', anchor.map((v) => v.toFixed(3)));

// Opening centers in the ORIGINAL (pre-rotation) raw frame, then rotated the
// same way, then expressed relative to the grounding anchor.
const OPEN0_RAW = [-79.91, -14.50, -90.42];
const OPEN1_RAW = [-91.31, -18.51, -100.33];
const OPEN2_RAW = [-96.64, -19.89, -90.37];
for (const [label, raw] of [['throughA (OPEN0)', OPEN0_RAW], ['branch (OPEN1)', OPEN1_RAW], ['throughB (OPEN2)', OPEN2_RAW]]) {
  const r = applyMatrix(M, raw);
  const relToAnchor = [r[0] - anchor[0], r[1] - anchor[1], r[2] - anchor[2]];
  console.log(label, '-> rotated:', r.map((v) => v.toFixed(3)), ' relative to grounding anchor:', relToAnchor.map((v) => v.toFixed(3)));
}
