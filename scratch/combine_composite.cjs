// Combines the three already-extracted TS_Lo_up/TS_Lo_L/TS_Lo_R pieces (a
// horizontal crossbeam + two angled leg braces) into one composite support
// unit. Extraction never recentered anything (v/vt/vn values are the
// original absolute world coordinates straight from bg.obj), so simply
// concatenating them with index-offsetting preserves their real relative
// positions — no coordinate math needed, this is purely OBJ index bookkeeping.
const fs = require('fs');
const path = require('path');

const SRC_DIR = 'D:/Project/VirtualMuseum/scratch/tunnel_pieces';
const PARTS = ['TS_Lo_up', 'TS_Lo_L', 'TS_Lo_R'];
const OUT_DIR = path.join(SRC_DIR, 'ThreeSupportComposite');

function parseObj(objPath) {
  const lines = fs.readFileSync(objPath, 'utf8').split('\n');
  const v = [], vt = [], vn = [];
  const body = []; // o / usemtl / f lines, in order
  for (const line of lines) {
    if (line.startsWith('v ')) v.push(line);
    else if (line.startsWith('vt ')) vt.push(line);
    else if (line.startsWith('vn ')) vn.push(line);
    else if (line.startsWith('o ') || line.startsWith('usemtl ') || line.startsWith('f ')) body.push(line);
  }
  return { v, vt, vn, body };
}

fs.mkdirSync(OUT_DIR, { recursive: true });

let vOffset = 0, vtOffset = 0, vnOffset = 0;
const outV = [], outVt = [], outVn = [], outBody = [];

for (const part of PARTS) {
  const objPath = path.join(SRC_DIR, part, 'piece.obj');
  const { v, vt, vn, body } = parseObj(objPath);
  outV.push(...v);
  outVt.push(...vt);
  outVn.push(...vn);
  for (const line of body) {
    if (line.startsWith('f ')) {
      const parts = line.trim().split(/\s+/).slice(1);
      const remapped = parts.map((tok) => {
        const [vi, vti, vni] = tok.split('/').map((s) => (s === '' ? null : parseInt(s, 10)));
        let out = String(vi + vOffset);
        if (vti != null) out += '/' + (vti + vtOffset);
        else if (vni != null) out += '/';
        if (vni != null) out += '/' + (vni + vnOffset);
        return out;
      });
      outBody.push('f ' + remapped.join(' '));
    } else {
      outBody.push(line);
    }
  }
  vOffset += v.length;
  vtOffset += vt.length;
  vnOffset += vn.length;
}

const objOut = [
  '# composite piece: TS_Lo_up + TS_Lo_L + TS_Lo_R (relative positions preserved from bg.obj)',
  'mtllib piece.mtl',
  ...outV,
  ...outVt,
  ...outVn,
  ...outBody,
].join('\n') + '\n';
fs.writeFileSync(path.join(OUT_DIR, 'piece.obj'), objOut, 'utf8');

// All three parts share the exact same material (ThreeSupportBB), so just
// reuse one of the existing .mtl files verbatim.
fs.copyFileSync(path.join(SRC_DIR, 'TS_Lo_up', 'piece.mtl'), path.join(OUT_DIR, 'piece.mtl'));
const texSrc = path.join(SRC_DIR, 'TS_Lo_up');
for (const file of fs.readdirSync(texSrc)) {
  if (file.endsWith('.png')) fs.copyFileSync(path.join(texSrc, file), path.join(OUT_DIR, file));
}

console.log('Combined', PARTS.join(' + '), '->', OUT_DIR);
console.log('verts:', outV.length, 'faces:', outBody.filter((l) => l.startsWith('f ')).length);
