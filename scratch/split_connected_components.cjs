const fs = require('fs');
const path = require('path');

const p = path.join('tunnel_pieces', 'SlopeB', 'piece.obj');
const text = fs.readFileSync(p, 'utf8');
const lines = text.split('\n');

const verts = [[0,0,0]];
const vts = [[0,0]];
const vns = [[0,0,0]];
const faces = []; // {mtl, tokens: [vIdx strings], vIdxs:[int]}
let currentMtl = null;

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
  } else if (line.startsWith('usemtl ')) {
    currentMtl = line.trim();
  } else if (line.startsWith('f ')) {
    const tokens = line.trim().split(/\s+/).slice(1);
    const vIdxs = tokens.map(t => parseInt(t.split('/')[0], 10));
    faces.push({ mtl: currentMtl, tokens, vIdxs });
  }
}

// Union-Find over vertex indices
const parent = new Map();
function find(x) { while (parent.get(x) !== x) { parent.set(x, parent.get(parent.get(x))); x = parent.get(x); } return x; }
function union(a,b) { const ra=find(a), rb=find(b); if (ra!==rb) parent.set(ra, rb); }

for (const f of faces) {
  for (const vi of f.vIdxs) if (!parent.has(vi)) parent.set(vi, vi);
  for (let i = 1; i < f.vIdxs.length; i++) union(f.vIdxs[0], f.vIdxs[i]);
}

// Group faces by root
const groups = new Map();
for (const f of faces) {
  const root = find(f.vIdxs[0]);
  if (!groups.has(root)) groups.set(root, []);
  groups.get(root).push(f);
}

const groupList = [...groups.entries()].map(([root, fs_]) => {
  const vSet = new Set();
  fs_.forEach(f => f.vIdxs.forEach(vi => vSet.add(vi)));
  let minX=Infinity,minY=Infinity,minZ=Infinity,maxX=-Infinity,maxY=-Infinity,maxZ=-Infinity;
  for (const vi of vSet) {
    const [x,y,z] = verts[vi];
    if(x<minX)minX=x; if(x>maxX)maxX=x;
    if(y<minY)minY=y; if(y>maxY)maxY=y;
    if(z<minZ)minZ=z; if(z>maxZ)maxZ=z;
  }
  const cx=(minX+maxX)/2, cy=(minY+maxY)/2, cz=(minZ+maxZ)/2;
  return { root, faces: fs_, vCount: vSet.size, size: [maxX-minX, maxY-minY, maxZ-minZ], center: [cx,cy,cz] };
}).sort((a,b) => b.faces.length - a.faces.length);

console.log('Number of connected components:', groupList.length);
groupList.slice(0, 20).forEach((g, i) => {
  console.log(`Component ${i}: faces=${g.faces.length} verts=${g.vCount} size=(${g.size.map(s=>s.toFixed(1)).join(', ')}) center=(${g.center.map(c=>c.toFixed(1)).join(', ')})`);
});

// Save each of the top few (excluding the giant main-network one) for inspection
fs.mkdirSync('components_out', { recursive: true });
function writeComponent(g, name) {
  const vMap = new Map(), vtMap = new Map(), vnMap = new Map();
  const outFaceLines = [];
  let lastMtl = undefined;
  for (const f of g.faces) {
    if (f.mtl !== lastMtl) { if (f.mtl) outFaceLines.push(f.mtl); lastMtl = f.mtl; }
    const newToks = f.tokens.map(tok => {
      const [viS, vtiS, vniS] = tok.split('/');
      const vi = parseInt(viS, 10);
      if (!vMap.has(vi)) vMap.set(vi, vMap.size + 1);
      let out = String(vMap.get(vi));
      if (vtiS) { const vti=parseInt(vtiS,10); if(!vtMap.has(vti)) vtMap.set(vti, vtMap.size+1); out += '/'+vtMap.get(vti); } else out += '/';
      if (vniS) { const vni=parseInt(vniS,10); if(!vnMap.has(vni)) vnMap.set(vni, vnMap.size+1); out += '/'+vnMap.get(vni); }
      return out;
    });
    outFaceLines.push('f ' + newToks.join(' '));
  }
  const outV = [...vMap.keys()].map(gi => 'v ' + verts[gi].join(' '));
  const outVt = [...vtMap.keys()].map(gi => 'vt ' + vts[gi].join(' '));
  const outVn = [...vnMap.keys()].map(gi => 'vn ' + vns[gi].join(' '));
  const objOut = ['o ' + name, ...outV, ...outVt, ...outVn, ...outFaceLines].join('\n') + '\n';
  fs.writeFileSync(path.join('components_out', name + '.obj'), objOut, 'utf8');
}

groupList.slice(0, 15).forEach((g, i) => writeComponent(g, 'comp' + i));
console.log('Wrote top 15 components to scratch/components_out/');
