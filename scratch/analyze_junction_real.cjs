const fs = require('fs');
const path = require('path');

const p = path.join('tunnel_pieces', 'JunctionCandidate', 'piece.obj');
const text = fs.readFileSync(p, 'utf8');
const lines = text.split('\n');

const verts = [[0,0,0]];
for (const line of lines) {
  if (line.startsWith('v ')) {
    const [,x,y,z] = line.trim().split(/\s+/);
    verts.push([parseFloat(x), parseFloat(y), parseFloat(z)]);
  }
}
console.log('Vertex count:', verts.length - 1);

let minX=Infinity,minY=Infinity,minZ=Infinity,maxX=-Infinity,maxY=-Infinity,maxZ=-Infinity;
for (let i=1;i<verts.length;i++) {
  const [x,y,z]=verts[i];
  if(x<minX)minX=x; if(x>maxX)maxX=x;
  if(y<minY)minY=y; if(y>maxY)maxY=y;
  if(z<minZ)minZ=z; if(z>maxZ)maxZ=z;
}
console.log('Bounding box size:', (maxX-minX).toFixed(2), (maxY-minY).toFixed(2), (maxZ-minZ).toFixed(2));
console.log('Bounding box min:', minX.toFixed(2), minY.toFixed(2), minZ.toFixed(2));
console.log('Bounding box max:', maxX.toFixed(2), maxY.toFixed(2), maxZ.toFixed(2));

const edgeCount = new Map();
function key(a,b) { return a<b ? a+'_'+b : b+'_'+a; }
for (const line of lines) {
  if (line.startsWith('f ')) {
    const toks = line.trim().split(/\s+/).slice(1);
    const idxs = toks.map(t => parseInt(t.split('/')[0], 10));
    for (let i = 0; i < idxs.length; i++) {
      const a = idxs[i], b = idxs[(i+1)%idxs.length];
      const k = key(a,b);
      edgeCount.set(k, (edgeCount.get(k)||0)+1);
    }
  }
}
const boundaryEdges = [];
for (const [k, c] of edgeCount) {
  if (c === 1) { const [a,b] = k.split('_').map(Number); boundaryEdges.push([a,b]); }
  else if (c > 2) console.log('WARNING non-manifold edge used', c, 'times:', k);
}
console.log('Boundary edges:', boundaryEdges.length);

const adj = new Map();
for (const [a,b] of boundaryEdges) {
  (adj.get(a) ?? adj.set(a, []).get(a)).push(b);
  (adj.get(b) ?? adj.set(b, []).get(b)).push(a);
}
const visited = new Set();
const loops = [];
for (const start of adj.keys()) {
  if (visited.has(start)) continue;
  const stack = [start]; const comp = [];
  visited.add(start);
  while (stack.length) {
    const v = stack.pop(); comp.push(v);
    for (const n of adj.get(v) ?? []) if (!visited.has(n)) { visited.add(n); stack.push(n); }
  }
  loops.push(comp);
}
console.log('Number of open boundary loops:', loops.length);
loops.forEach((loop, i) => {
  const pts = loop.map(vi => verts[vi]);
  const cx = pts.reduce((s,p)=>s+p[0],0)/pts.length;
  const cy = pts.reduce((s,p)=>s+p[1],0)/pts.length;
  const cz = pts.reduce((s,p)=>s+p[2],0)/pts.length;
  const r = pts.reduce((s,p)=>s+Math.hypot(p[0]-cx,p[1]-cy,p[2]-cz),0)/pts.length;
  console.log(`  Opening ${i}: verts=${loop.length} center=(${cx.toFixed(2)}, ${cy.toFixed(2)}, ${cz.toFixed(2)}) avgRadius=${r.toFixed(2)}`);
});
