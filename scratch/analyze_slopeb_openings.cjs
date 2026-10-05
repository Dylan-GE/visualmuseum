const fs = require('fs');
const path = require('path');

const p = path.join('tunnel_pieces', 'SlopeB', 'piece.obj');
const text = fs.readFileSync(p, 'utf8');
const lines = text.split('\n');

const verts = [[0,0,0]]; // 1-indexed
for (const line of lines) {
  if (line.startsWith('v ')) {
    const [,x,y,z] = line.trim().split(/\s+/);
    verts.push([parseFloat(x), parseFloat(y), parseFloat(z)]);
  }
}

// Build edge -> face count map to find boundary edges (used by exactly 1 face)
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
  if (c === 1) {
    const [a,b] = k.split('_').map(Number);
    boundaryEdges.push([a,b]);
  }
}
console.log('Total boundary edges (used by exactly 1 face):', boundaryEdges.length);

// Group boundary edges into connected loops (each loop = one opening)
const adj = new Map();
for (const [a,b] of boundaryEdges) {
  (adj.get(a) ?? adj.set(a, []).get(a)).push(b);
  (adj.get(b) ?? adj.set(b, []).get(b)).push(a);
}
const visited = new Set();
const loops = [];
for (const start of adj.keys()) {
  if (visited.has(start)) continue;
  const stack = [start];
  const comp = [];
  visited.add(start);
  while (stack.length) {
    const v = stack.pop();
    comp.push(v);
    for (const n of adj.get(v) ?? []) {
      if (!visited.has(n)) { visited.add(n); stack.push(n); }
    }
  }
  loops.push(comp);
}
console.log('Number of distinct boundary loops (openings):', loops.length);

loops.forEach((loop, i) => {
  const pts = loop.map(vi => verts[vi]);
  const cx = pts.reduce((s,p)=>s+p[0],0)/pts.length;
  const cy = pts.reduce((s,p)=>s+p[1],0)/pts.length;
  const cz = pts.reduce((s,p)=>s+p[2],0)/pts.length;
  // rough radius estimate
  const r = pts.reduce((s,p)=>s+Math.hypot(p[0]-cx,p[1]-cy,p[2]-cz),0)/pts.length;
  console.log(`Opening ${i}: verts=${loop.length} center=(${cx.toFixed(2)}, ${cy.toFixed(2)}, ${cz.toFixed(2)}) avgRadius=${r.toFixed(2)}`);
});
