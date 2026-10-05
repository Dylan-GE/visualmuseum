// Same math three.js's Box3.setFromObject/expandByObject actually does:
// for each mesh, take its LOCAL bounding box's 8 corners, transform by the
// mesh's matrixWorld (here: just JUNCTION_PRE_ROTATION, since the GLB's
// node hierarchy is identity — confirmed via inspect_junction_glb.cjs),
// then union all transformed corners into one overall box.
const EULER = [-0.311674, 1.567808, 0];
function buildEulerMatrix([ex, ey, ez]) {
  const cx = Math.cos(ex), sx = Math.sin(ex);
  const cy = Math.cos(ey), sy = Math.sin(ey);
  const cz = Math.cos(ez), sz = Math.sin(ez);
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

// Real per-mesh local bboxes read directly out of TunnelJunction.glb via
// inspect_junction_glb.cjs (NOT hand-derived from the raw OBJ opening
// centers this time — ground truth from the actual shipped asset).
const MESH_BBOXES = [
  { min: [-86.991, -17.763, -91.982], max: [-79.545, -13.585, -88.939] },
  { min: [-96.651, -20.901, -100.372], max: [-86.358, -15.787, -88.956] },
  { min: [-96.689, -21.112, -91.960], max: [-96.026, -18.952, -88.803] },
];

let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity, minZ = Infinity, maxZ = -Infinity;
for (const { min, max } of MESH_BBOXES) {
  for (const x of [min[0], max[0]]) {
    for (const y of [min[1], max[1]]) {
      for (const z of [min[2], max[2]]) {
        const [rx, ry, rz] = applyMatrix(M, [x, y, z]);
        if (rx < minX) minX = rx; if (rx > maxX) maxX = rx;
        if (ry < minY) minY = ry; if (ry > maxY) maxY = ry;
        if (rz < minZ) minZ = rz; if (rz > maxZ) maxZ = rz;
      }
    }
  }
}
const anchor = [(minX + maxX) / 2, minY, (minZ + maxZ) / 2];
console.log('rotated bbox: x[', minX.toFixed(3), maxX.toFixed(3), '] y[', minY.toFixed(3), maxY.toFixed(3), '] z[', minZ.toFixed(3), maxZ.toFixed(3), ']');
console.log('grounding anchor:', anchor.map((v) => v.toFixed(3)));

const OPEN0_RAW = [-79.91, -14.50, -90.42];
const OPEN1_RAW = [-91.31, -18.51, -100.33];
const OPEN2_RAW = [-96.64, -19.89, -90.37];
for (const [label, raw] of [['throughA (OPEN0)', OPEN0_RAW], ['branch (OPEN1)', OPEN1_RAW], ['throughB (OPEN2)', OPEN2_RAW]]) {
  const r = applyMatrix(M, raw);
  const rel = [r[0] - anchor[0], r[1] - anchor[1], r[2] - anchor[2]];
  console.log(label, 'relative to grounding anchor:', rel.map((v) => v.toFixed(3)));
}
