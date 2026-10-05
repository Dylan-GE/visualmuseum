// Checks whether a tunnel-shell piece has a closed "cap" face at either end
// of its Z extent, or is an open tube (just stops, no wall spanning the
// cross-section) — the earlier bbox-based analysis couldn't tell these apart,
// and the user physically walking into a wall despite removing/buffering the
// trunk's own shell strongly suggests the branch's own shell has a real cap.
const fs = require('fs');

function analyze(name, objPath) {
  const lines = fs.readFileSync(objPath, 'utf8').split('\n');
  const verts = [];
  const faces = [];
  for (const line of lines) {
    if (line.startsWith('v ')) {
      const [, x, y, z] = line.trim().split(/\s+/);
      verts.push([parseFloat(x), parseFloat(y), parseFloat(z)]);
    } else if (line.startsWith('f ')) {
      const idx = line
        .trim()
        .split(/\s+/)
        .slice(1)
        .map((tok) => parseInt(tok.split('/')[0], 10) - 1);
      faces.push(idx);
    }
  }

  let zmin = Infinity, zmax = -Infinity;
  for (const v of verts) {
    if (v[2] < zmin) zmin = v[2];
    if (v[2] > zmax) zmax = v[2];
  }
  const eps = (zmax - zmin) * 0.01; // within 1% of the Z extent counts as "at the boundary"

  function capFacesNear(zBoundary) {
    let capFaceCount = 0;
    let touchingFaceCount = 0;
    for (const idx of faces) {
      const zs = idx.map((i) => verts[i][2]);
      const nearCount = zs.filter((z) => Math.abs(z - zBoundary) < eps).length;
      if (nearCount === zs.length) capFaceCount++;
      else if (nearCount > 0) touchingFaceCount++;
    }
    return { capFaceCount, touchingFaceCount };
  }

  const near = capFacesNear(zmin);
  const far = capFacesNear(zmax);
  console.log(`== ${name} == zmin=${zmin.toFixed(3)} zmax=${zmax.toFixed(3)} totalFaces=${faces.length}`);
  console.log(
    `  near-zmin: ${near.capFaceCount} full-cap faces, ${near.touchingFaceCount} faces touching that boundary`,
  );
  console.log(
    `  near-zmax: ${far.capFaceCount} full-cap faces, ${far.touchingFaceCount} faces touching that boundary`,
  );
  console.log(
    `  verdict: zmin end is`, near.capFaceCount > 0 ? 'CLOSED (cap present)' : 'OPEN (no cap face)',
    ' / zmax end is', far.capFaceCount > 0 ? 'CLOSED (cap present)' : 'OPEN (no cap face)',
  );
}

analyze('TunnelA1', 'D:/Project/VirtualMuseum/scratch/tunnel_pieces/TunnelA1/piece.obj');
