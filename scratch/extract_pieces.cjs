// Extracts a handful of representative modular tunnel pieces out of the huge
// bg.obj scene (13,836 objects sharing ~40 base part types) into small
// standalone OBJ+MTL+texture sets, for a validation pass before committing to
// extracting the full part library.
const fs = require('fs');
const path = require('path');

const SRC_DIR = 'S:/Project/14049/FlyingData/Scene_BIM/olddata/地下礦場';
const OBJ_PATH = path.join(SRC_DIR, 'bg.obj');
const MTL_PATH = path.join(SRC_DIR, 'bg.mtl');
const OUT_DIR = 'D:/Project/VirtualMuseum/scratch/tunnel_pieces';

const TARGET_BASES = [
  'BoxWoodA',
  'BoxWoodB',
  'BoxWoodC',
  'BoxWoodA_S',
  'BoxWoodB_S',
  'BoxWoodC_S',
  'SupportWoodA',
  'SupportWoodB',
  'SupportWoodC',
  'SupportWoodA_S',
  'SupportWoodB_S',
  'SupportWoodC_S',
  'SW_A_lo',
  'SW_B_lo',
  'SW_C_lo',
  'SW_AS_lo',
  'SW_BS_lo',
  'SW_CS_lo',
  'TS_Lo_up',
  'TS_Lo_L',
  'TS_Lo_R',
  'ThreeSupportAA',
  'ThreeSupportAB',
  'ThreeSupportAC',
  'ThreeSupportBB',
  'ThreeSupportBC',
  'ThreeSupportBD',
  'SteelSupportAA',
  'SteelSupportBB',
  'Rock1',
  'Rock2',
  'Rock3',
  'Rock4',
  'Rock5',
  'rockAA',
  'rockAB',
  'miningWinches_A',
  'well_wood',
  'Card',
  // Tunnel shell / wall+ceiling segments — missed on the first pass because
  // these are large, mostly single-occurrence background pieces, not the
  // small high-repeat-count modular props the initial `uniq -c` scan favored.
  'TunnelA1',
  'TunnelA2',
  'TunnelA3',
  'TunnelA4',
  'TunnelA5',
  'TunnelA6',
  'TunnelA7',
  'TunnelA8__1_',
  'TunnelA9',
  'TunnelA10',
  'TunnelB',
  'TunnelC',
  'TunnelD',
  'SlopeA',
  'SlopeB',
  'SlopeG',
  'Slope18',
  'POP',
];

function baseName(objName) {
  return objName.replace(/_+\d+(__\d+)?$/, '');
}

console.log('Reading', OBJ_PATH, '...');
const objText = fs.readFileSync(OBJ_PATH, 'utf8');
const lines = objText.split('\n');
console.log('Total lines:', lines.length);

const vList = [];
const vtList = [];
const vnList = [];

const captured = {}; // base -> { objName, faceLines: [{mtl, f}], done }
TARGET_BASES.forEach((b) => { captured[b] = null; });

let currentTargetBase = null;
let currentMtl = null;

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  if (line.startsWith('v ')) {
    vList.push(line);
  } else if (line.startsWith('vt ')) {
    vtList.push(line);
  } else if (line.startsWith('vn ')) {
    vnList.push(line);
  } else if (line.startsWith('o ')) {
    const name = line.slice(2).trim();
    const base = baseName(name);
    if (TARGET_BASES.includes(base) && captured[base] === null) {
      currentTargetBase = base;
      captured[base] = { objName: name, faces: [] };
      currentMtl = null;
    } else {
      currentTargetBase = null;
    }
  } else if (line.startsWith('usemtl ')) {
    currentMtl = line.slice(7).trim();
  } else if (line.startsWith('f ') && currentTargetBase) {
    captured[currentTargetBase].faces.push({ mtl: currentMtl, f: line });
  }
}

console.log('Global v/vt/vn counts:', vList.length, vtList.length, vnList.length);
TARGET_BASES.forEach((b) => {
  console.log(b, '->', captured[b] ? captured[b].objName + ' (' + captured[b].faces.length + ' faces)' : 'NOT FOUND');
});

// ---- Parse bg.mtl into a dict of raw text blocks keyed by material name ----
console.log('Reading', MTL_PATH, '...');
const mtlText = fs.readFileSync(MTL_PATH, 'utf8');
const mtlLines = mtlText.split('\n');
const mtlBlocks = {};
let curMtlName = null;
let curBlockLines = [];
for (const line of mtlLines) {
  if (line.startsWith('newmtl ')) {
    if (curMtlName) mtlBlocks[curMtlName] = curBlockLines;
    curMtlName = line.slice(7).trim();
    curBlockLines = [line];
  } else if (curMtlName) {
    curBlockLines.push(line);
  }
}
if (curMtlName) mtlBlocks[curMtlName] = curBlockLines;
console.log('Parsed', Object.keys(mtlBlocks).length, 'materials from bg.mtl');

// ---- Emit each target piece ----
fs.mkdirSync(OUT_DIR, { recursive: true });

function parseIdx(tok) {
  // "78/124/29" -> [78,124,29] (1-based, some parts may be empty)
  return tok.split('/').map((s) => (s === '' ? null : parseInt(s, 10)));
}

for (const base of TARGET_BASES) {
  const data = captured[base];
  if (!data) continue;
  const pieceDir = path.join(OUT_DIR, base);
  fs.mkdirSync(pieceDir, { recursive: true });

  const vMap = new Map(); // globalIdx -> newIdx
  const vtMap = new Map();
  const vnMap = new Map();
  const usedMtls = new Set();

  const outFaceLines = [];
  let lastMtl = undefined;
  for (const { mtl, f } of data.faces) {
    if (mtl !== lastMtl) {
      outFaceLines.push('usemtl ' + mtl);
      lastMtl = mtl;
      if (mtl) usedMtls.add(mtl);
    }
    const parts = f.trim().split(/\s+/).slice(1); // skip 'f'
    const newParts = parts.map((tok) => {
      const [vi, vti, vni] = parseIdx(tok);
      if (!vMap.has(vi)) vMap.set(vi, vMap.size + 1);
      let out = String(vMap.get(vi));
      if (vti != null) {
        if (!vtMap.has(vti)) vtMap.set(vti, vtMap.size + 1);
        out += '/' + vtMap.get(vti);
      } else {
        out += '/';
      }
      if (vni != null) {
        if (!vnMap.has(vni)) vnMap.set(vni, vnMap.size + 1);
        out += '/' + vnMap.get(vni);
      }
      return out;
    });
    outFaceLines.push('f ' + newParts.join(' '));
  }

  const outV = [...vMap.keys()].map((gi) => vList[gi - 1]);
  const outVt = [...vtMap.keys()].map((gi) => vtList[gi - 1]);
  const outVn = [...vnMap.keys()].map((gi) => vnList[gi - 1]);

  const objOut = [
    '# extracted piece: ' + data.objName,
    'mtllib piece.mtl',
    'o ' + base,
    ...outV,
    ...outVt,
    ...outVn,
    ...outFaceLines,
  ].join('\n') + '\n';
  fs.writeFileSync(path.join(pieceDir, 'piece.obj'), objOut, 'utf8');

  // ---- MTL + texture copy ----
  const mtlOutLines = [];
  const texturesToCopy = new Set();
  for (const mtlName of usedMtls) {
    const block = mtlBlocks[mtlName];
    if (!block) {
      console.warn('  ! material not found in bg.mtl:', mtlName);
      continue;
    }
    for (const l of block) {
      const m = l.match(/^(map_\w+)(\s+-bm\s+[\d.]+)?\s+(bg\.fbm\/.+)$/);
      if (m) {
        const texRel = m[3].trim();
        const texBase = path.basename(texRel);
        texturesToCopy.add(texRel);
        mtlOutLines.push(l.replace(texRel, texBase));
      } else {
        mtlOutLines.push(l);
      }
    }
  }
  fs.writeFileSync(path.join(pieceDir, 'piece.mtl'), mtlOutLines.join('\n') + '\n', 'utf8');

  for (const texRel of texturesToCopy) {
    const src = path.join(SRC_DIR, texRel);
    const dst = path.join(pieceDir, path.basename(texRel));
    try {
      fs.copyFileSync(src, dst);
    } catch (e) {
      console.warn('  ! failed to copy texture', texRel, e.message);
    }
  }

  console.log(
    base, ': verts=' + outV.length, 'faces=' + outFaceLines.filter((l) => l.startsWith('f ')).length,
    'materials=' + [...usedMtls].join(','), 'textures=' + texturesToCopy.size,
  );
}

console.log('Done. Output in', OUT_DIR);
