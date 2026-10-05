// Fine-grained spine analysis for TunnelD and SlopeA specifically, to
// derive a proper multi-point walkable path for 斜坑(zone_incline) <->
// 天車間(zone_hoist_room), replacing the single-via-point + instant-cut
// "junction crossing" hack. That hack was a precaution from the OLD
// SlopeB-derived junction where a straight lerp genuinely walked outside
// solid geometry; the user (2026-08-14) points out 斜坑 IS TunnelD, a real
// modeled tunnel that should be walkable normally the whole way through to
// 天車間, not skipped. This script traces the REAL centerline so normal
// step-by-step walking can follow it safely.
//
// Unlike spine_analysis.cjs (single global PCA axis — fine for straight
// tubes like TunnelB/C, wrong for TunnelD/SlopeA which bend), this bins
// along the raw Z axis (both pieces are all elongated far more in Z than
// X/Y per their bounding boxes — confirmed below) so the bend shows up
// as a changing X per Z-bin, instead of being flattened into one axis.
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

function mean(vs) {
  const m = [0, 0, 0];
  for (const v of vs) { m[0] += v[0]; m[1] += v[1]; m[2] += v[2]; }
  return m.map((x) => x / vs.length);
}

function zSpine(name, bins) {
  const verts = loadObj(path.join(__dirname, 'tunnel_pieces', name, 'piece.obj'));
  const box = bbox(verts);
  console.log(`\n=== ${name} bbox === min=${box.min.map((v) => v.toFixed(2))} max=${box.max.map((v) => v.toFixed(2))}`);
  console.log(`extent: x=${(box.max[0] - box.min[0]).toFixed(2)} y=${(box.max[1] - box.min[1]).toFixed(2)} z=${(box.max[2] - box.min[2]).toFixed(2)}`);
  const [zmin, zmax] = [box.min[2], box.max[2]];
  const buckets = Array.from({ length: bins }, () => []);
  verts.forEach((v) => {
    const t = (v[2] - zmin) / (zmax - zmin || 1);
    const bi = Math.min(bins - 1, Math.max(0, Math.floor(t * bins)));
    buckets[bi].push(v);
  });
  const spine = [];
  buckets.forEach((b, i) => {
    if (!b.length) { console.log(` bin ${i}: (empty)`); return; }
    const bc = mean(b);
    // Also report X spread within the bin (floor+wall vertices span X
    // fully at a given Z, so std/half-range tells us the TUBE's X extent
    // at that Z slice, vs bc[0] being the tube's CENTERLINE X there).
    const xs = b.map((v) => v[0]);
    const xr = [Math.min(...xs), Math.max(...xs)];
    spine.push({ z: bc[2], x: bc[0], y: bc[1], n: b.length, xrange: xr });
    console.log(` bin ${i}: n=${b.length}, centroid=(${bc[0].toFixed(2)}, ${bc[1].toFixed(2)}, ${bc[2].toFixed(2)}), x-range=[${xr[0].toFixed(2)}, ${xr[1].toFixed(2)}]`);
  });
  return spine;
}

zSpine('TunnelD', 16);
zSpine('SlopeA', 24);
