// Final derivation for the TunnelB/TunnelC/TunnelD/SlopeA layout (see
// PROGRESS.md 2026-08-12 "換成真實密合的模組化零件" section). Unlike the old
// SlopeB-derived junction, these 4 pieces are mutually aligned ALREADY in
// raw bg.obj space (confirmed via spine_analysis.cjs — TunnelB/C are
// straight to within 0.1 units, and no rotation is needed between pieces),
// so no PRE_ROTATION/JUNCTION_SCALE-style correction is needed — just one
// shared global translation, applied consistently to every piece's own
// groundOffsetAnchor (replicating InstancedTunnelPiece's Box3().setFromObject
// + center.x/z, min.y grounding) and to every zone/via coordinate.
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
function bbox(verts) {
  const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
  for (const v of verts) for (let i = 0; i < 3; i++) { if (v[i] < min[i]) min[i] = v[i]; if (v[i] > max[i]) max[i] = v[i]; }
  return { min, max };
}
function groundAnchor(name) {
  const verts = loadObj(path.join(__dirname, 'tunnel_pieces', name, 'piece.obj'));
  const box = bbox(verts);
  return [(box.min[0] + box.max[0]) / 2, box.min[1], (box.min[2] + box.max[2]) / 2];
}

const anchors = {
  TunnelB: groundAnchor('TunnelB'),
  TunnelC: groundAnchor('TunnelC'),
  TunnelD: groundAnchor('TunnelD'),
  SlopeA: groundAnchor('SlopeA'),
};

// Raw bg.obj coordinates measured by map_tunnel_network.cjs / spine_analysis.cjs.
const RAW = {
  tunnelD_bOpening: [1.31, 0.74, -103.15],
  tunnelD_cOpening: [1.22, 0.80, -108.66],
  mainKengB: [1.23, 0.66, -54.98], // TunnelB far end (主坑1)
  mainKengC: [1.19, 0.56, -156.06], // TunnelC far/capped end (主坑2)
  slopeA_straightStart: [-25.58, 0.71, -90.65], // where SlopeA's bend ends (bin3)
  slopeA_farEnd: [-35.32, -0.01, -90.43], // SlopeA's own far mouth (天車間)
};

// No rotation needed (confirmed already axis-aligned) — one shared
// translation. Anchors world (0,0,0) at TunnelD's B-opening (i.e. right
// where TunnelB and TunnelD meet), Y left unshifted (raw Y values are
// already reasonable small floor-ish numbers throughout this cluster).
const T = RAW.tunnelD_bOpening.map((v) => -v);
const add = (p) => [p[0] + T[0], p[1] + T[1], p[2] + T[2]];

console.log('Global translation (world = raw + T):', T.map((v) => v.toFixed(3)));

console.log('\n--- Piece placements (position, rotationY=0, scale=[1,1,1]) ---');
for (const [name, anchor] of Object.entries(anchors)) {
  console.log(name, ':', add(anchor).map((v) => v.toFixed(3)));
}

console.log('\n--- Zone coordinates ---');
console.log('主坑1 (TunnelB far end):', add(RAW.mainKengB).map((v) => v.toFixed(3)));
console.log('主坑2 (TunnelC far/capped end):', add(RAW.mainKengC).map((v) => v.toFixed(3)));
const xiekeng = [
  (RAW.tunnelD_bOpening[0] + RAW.tunnelD_cOpening[0]) / 2,
  (RAW.tunnelD_bOpening[1] + RAW.tunnelD_cOpening[1]) / 2,
  (RAW.tunnelD_bOpening[2] + RAW.tunnelD_cOpening[2]) / 2,
];
console.log('斜坑 (TunnelD, midpoint of B/C openings):', add(xiekeng).map((v) => v.toFixed(3)));
console.log('天車間 (SlopeA far end):', add(RAW.slopeA_farEnd).map((v) => v.toFixed(3)));

console.log('\n--- via point for 斜坑<->天車間 edge (where SlopeA becomes straight) ---');
console.log('via:', add(RAW.slopeA_straightStart).map((v) => v.toFixed(3)));

console.log('\n--- sanity: edge lengths (XZ distance) ---');
function distXZ(a, b) { return Math.hypot(a[0] - b[0], a[2] - b[2]); }
const p1 = add(RAW.mainKengB), p2 = add(xiekeng), p3 = add(RAW.mainKengC), via = add(RAW.slopeA_straightStart), p4 = add(RAW.slopeA_farEnd);
console.log('主坑1 <-> 斜坑:', distXZ(p1, p2).toFixed(2));
console.log('主坑2 <-> 斜坑:', distXZ(p3, p2).toFixed(2));
console.log('斜坑 <-> via:', distXZ(p2, via).toFixed(2));
console.log('via <-> 天車間:', distXZ(via, p4).toFixed(2));
