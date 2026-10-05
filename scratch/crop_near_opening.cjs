const fs = require('fs');
const path = require('path');

const p = path.join('tunnel_pieces', 'SlopeB', 'piece.obj');
const text = fs.readFileSync(p, 'utf8');
const lines = text.split('\n');

const CENTER = [-92.33, -19.01, -108.88];
const RADIUS = 20; // generous neighborhood so we see the junction plus a bit of each connecting arm

const verts = [[0,0,0]]; // 1-indexed
const vts = [[0,0]];
const vns = [[0,0,0]];
for (const line of lines) {
  if (line.startsWith('v ')) {
    const [,x,y,z] = line.trim().split(/\s+/);
    verts.push([parseFloat(x), parseFloat(y), parseFloat(z)]);
  } else if (line.startsWith('vt ')) {
    const parts = line.trim().split(/\s+/);
    vts.push([parseFloat(parts[1]), parseFloat(parts[2]||0)]);
  } else if (line.startsWith('vn ')) {
    const [,x,y,z] = line.trim().split(/\s+/);
    vns.push([parseFloat(x), parseFloat(y), parseFloat(z)]);
  }
}

function dist(a,b) { return Math.hypot(a[0]-b[0], a[1]-b[1], a[2]-b[2]); }

const keptFaces = [];
let currentMtl = null;
for (const line of lines) {
  if (line.startsWith('usemtl ')) {
    currentMtl = line.trim();
  } else if (line.startsWith('f ')) {
    const toks = line.trim().split(/\s+/).slice(1);
    const vIdxs = toks.map(t => parseInt(t.split('/')[0], 10));
    const allNear = vIdxs.every(vi => dist(verts[vi], CENTER) <= RADIUS);
    if (allNear) keptFaces.push({ mtl: currentMtl, tokens: toks });
  }
}

console.log('Kept faces within radius', RADIUS, ':', keptFaces.length);

// Remap indices
const vMap = new Map(), vtMap = new Map(), vnMap = new Map();
const outFaceLines = [];
let lastMtl = undefined;
for (const { mtl, tokens } of keptFaces) {
  if (mtl !== lastMtl) { if (mtl) outFaceLines.push(mtl); lastMtl = mtl; }
  const newToks = tokens.map(tok => {
    const [viS, vtiS, vniS] = tok.split('/');
    const vi = parseInt(viS, 10);
    if (!vMap.has(vi)) vMap.set(vi, vMap.size + 1);
    let out = String(vMap.get(vi));
    if (vtiS) {
      const vti = parseInt(vtiS, 10);
      if (!vtMap.has(vti)) vtMap.set(vti, vtMap.size + 1);
      out += '/' + vtMap.get(vti);
    } else out += '/';
    if (vniS) {
      const vni = parseInt(vniS, 10);
      if (!vnMap.has(vni)) vnMap.set(vni, vnMap.size + 1);
      out += '/' + vnMap.get(vni);
    }
    return out;
  });
  outFaceLines.push('f ' + newToks.join(' '));
}

const outV = [...vMap.keys()].map(gi => 'v ' + verts[gi].join(' '));
const outVt = [...vtMap.keys()].map(gi => 'vt ' + vts[gi].join(' '));
const outVn = [...vnMap.keys()].map(gi => 'vn ' + vns[gi].join(' '));

const outDir = path.join('tunnel_pieces', 'JunctionCandidate');
fs.mkdirSync(outDir, { recursive: true });
const objOut = [
  '# cropped neighborhood of SlopeB large opening, radius ' + RADIUS,
  'o JunctionCandidate',
  ...outV, ...outVt, ...outVn, ...outFaceLines,
].join('\n') + '\n';
fs.writeFileSync(path.join(outDir, 'piece.obj'), objOut, 'utf8');
console.log('Wrote', path.join(outDir, 'piece.obj'), 'verts=', outV.length, 'faces=', outFaceLines.filter(l=>l.startsWith('f ')).length);
