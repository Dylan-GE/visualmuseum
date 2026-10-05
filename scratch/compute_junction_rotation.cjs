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

function sub(a,b){return [a[0]-b[0],a[1]-b[1],a[2]-b[2]];}
function normalize(v){const l=Math.hypot(v[0],v[1],v[2]);return [v[0]/l,v[1]/l,v[2]/l];}
function cross(a,b){return [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]];}
function dot(a,b){return a[0]*b[0]+a[1]*b[1]+a[2]*b[2];}

// Opening centers measured earlier from boundary-loop analysis of the
// exported piece (same raw coordinate space as the piece.obj file).
const OPEN0 = [-79.91, -14.50, -90.42]; // "through" end A
const OPEN1 = [-91.31, -18.51, -100.33]; // branch end
const OPEN2 = [-96.64, -19.89, -90.37]; // "through" end B
const CENTROID_HINT = [(-79.91-91.31-96.64)/3, (-14.50-18.51-19.89)/3, (-90.42-100.33-90.37)/3];

const forward = normalize(sub(OPEN0, OPEN2)); // local "through" direction, OPEN2 -> OPEN0
console.log('forward (local):', forward.map(v=>v.toFixed(4)));

const worldUp = [0,1,0];
let right = normalize(cross(forward, worldUp));
let up = cross(right, forward); // already unit length since right,forward orthonormal
console.log('right:', right.map(v=>v.toFixed(4)));
console.log('up:', up.map(v=>v.toFixed(4)));

// M maps local direction v -> world direction: M*forward=(0,0,-1), M*right=(1,0,0), M*up=(0,1,0)
const M = [
  [right[0], right[1], right[2]],
  [up[0], up[1], up[2]],
  [-forward[0], -forward[1], -forward[2]],
];
const det = M[0][0]*(M[1][1]*M[2][2]-M[1][2]*M[2][1]) - M[0][1]*(M[1][0]*M[2][2]-M[1][2]*M[2][0]) + M[0][2]*(M[1][0]*M[2][1]-M[1][1]*M[2][0]);
console.log('det:', det.toFixed(6));

const m11=M[0][0],m12=M[0][1],m13=M[0][2];
const m22=M[1][1],m23=M[1][2];
const m32=M[2][1],m33=M[2][2];
let ex,ey,ez;
ey = Math.asin(Math.max(-1,Math.min(1,m13)));
if (Math.abs(m13) < 0.9999999) {
  ex = Math.atan2(-m23, m33);
  ez = Math.atan2(-m12, m11);
} else {
  ex = Math.atan2(m32, m22);
  ez = 0;
}
console.log('euler XYZ (rad):', [ex,ey,ez].map(v=>v.toFixed(6)));
console.log('euler XYZ (deg):', [ex,ey,ez].map(v=>(v*180/Math.PI).toFixed(2)));

// round-trip verify
const cx=Math.cos(ex),sx=Math.sin(ex),cy=Math.cos(ey),sy=Math.sin(ey),cz=Math.cos(ez),sz=Math.sin(ez);
const R = [
  [cy*cz, -cy*sz, sy],
  [cx*sz+sx*sy*cz, cx*cz-sx*sy*sz, -sx*cy],
  [sx*sz-cx*sy*cz, sx*cz+cx*sy*sz, cx*cy],
];
let maxDiff=0;
for(let i=0;i<3;i++) for(let j=0;j<3;j++) maxDiff=Math.max(maxDiff, Math.abs(R[i][j]-M[i][j]));
console.log('round-trip max diff:', maxDiff.toFixed(6), maxDiff<1e-3?'(OK)':'(MISMATCH)');

// Apply M to the branch direction to see where it points in world space
// AFTER this PRE_ROTATION is applied to the piece.
const branchLocal = normalize(sub(OPEN1, CENTROID_HINT));
function applyM(v){ return [dot(M[0],v), dot(M[1],v), dot(M[2],v)]; }
const branchWorld = applyM(branchLocal);
console.log('branch direction in LOCAL space:', branchLocal.map(v=>v.toFixed(4)));
console.log('branch direction AFTER PRE_ROTATION (piece local frame post-rotation):', branchWorld.map(v=>v.toFixed(4)));
const branchAngleFromForwardDeg = Math.atan2(branchWorld[0], -branchWorld[2]) * 180/Math.PI;
console.log('branch angle from forward (-Z), measured like rotationY (deg):', branchAngleFromForwardDeg.toFixed(2));
console.log('branch vertical component (Y) after rotation:', branchWorld[1].toFixed(4));

// Also report opening radii/positions relative to centroid, post-rotation,
// for placing connecting arms at the exact opening locations later.
function applyMPoint(p){ const d=sub(p,CENTROID_HINT); return applyM(d); }
console.log('OPEN0 post-rotation local pos (relative to centroid):', applyMPoint(OPEN0).map(v=>v.toFixed(3)));
console.log('OPEN1 post-rotation local pos (relative to centroid):', applyMPoint(OPEN1).map(v=>v.toFixed(3)));
console.log('OPEN2 post-rotation local pos (relative to centroid):', applyMPoint(OPEN2).map(v=>v.toFixed(3)));

console.log('\n--- corrected branch rotationY calculation ---');
// transformSegment's exact convention: local forward (0,0,-1) rotated by
// angle phi -> world direction (worldX, worldZ) = (-sin(phi), -cos(phi)).
// Solve for phi given the branch's post-PRE_ROTATION local direction.
const dx = branchWorld[0], dz = branchWorld[2];
const phi = Math.atan2(-dx, -dz);
console.log('branch rotationY (rad):', phi.toFixed(6), '(deg):', (phi*180/Math.PI).toFixed(2));
// numeric verification: rotate local (0,0,-1) by phi using the exact same
// formula as transformSegment and confirm it reproduces branchWorld's x,z.
const checkX = 0*Math.cos(phi) + (-1)*Math.sin(phi);
const checkZ = -0*Math.sin(phi) + (-1)*Math.cos(phi);
console.log('check worldX,worldZ from phi:', checkX.toFixed(4), checkZ.toFixed(4));
console.log('target dx,dz was:', dx.toFixed(4), dz.toFixed(4));
console.log('match:', Math.abs(checkX-dx)<1e-3 && Math.abs(checkZ-dz)<1e-3 ? 'OK' : 'MISMATCH');

// Also compute the "throughB" exit direction (continuing past OPEN2, i.e.
// the OTHER through end) the same way, for completeness — should be exactly
// rotationY=PI (180 deg) from throughA since both through ends lie on the
// same straight line through the centroid by construction.
