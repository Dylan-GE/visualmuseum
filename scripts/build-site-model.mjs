// Turns a ContextCapture OBJ export (Data/Tile_N/Tile_N.obj + jpg atlases, 2 GB
// of triangles) into one small, unlit GLB for the "三維模型" viewer pages.
//
//   node --max-old-space-size=12000 scripts/build-site-model.mjs \
//        <obj-root> <out.glb> [--ratio 0.05] [--tex-size 1024] [--tiles 1,2]
//
// Steps per tile: stream-parse the OBJ, weld (v, vt) pairs into vertices, simplify
// with meshoptimizer (material id is a heavily weighted attribute so triangles
// never merge across atlases), split by material, then write everything into a
// single GLB with KHR_materials_unlit (the photos already contain the lighting).
// Z-up local coordinates (metres, EPSG:3826 offset) become Y-up, centred on the
// footprint with the lowest point at y = 0.
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import { execFileSync } from 'node:child_process';
import { MeshoptSimplifier } from 'meshoptimizer';

const args = process.argv.slice(2);
const positional = args.filter((a, i) => !a.startsWith('--') && !(args[i - 1] ?? '').startsWith('--'));
const flag = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : fallback;
};
const [objRoot, outPath] = positional;
if (!objRoot || !outPath) {
  console.error('usage: build-site-model.mjs <obj-root> <out.glb> [--ratio 0.05] [--tex-size 1024] [--tiles 1,2]');
  process.exit(1);
}
const RATIO = Number(flag('ratio', 0.05));
const TEX_SIZE = Number(flag('tex-size', 1024));
const TEX_QUALITY = Number(flag('tex-quality', 80));
const tileFilter = flag('tiles', '')
  .split(',')
  .filter(Boolean)
  .map(Number);

const dataDir = path.join(objRoot, 'Data');
const tiles = fs
  .readdirSync(dataDir)
  .filter((d) => /^Tile_\d+$/.test(d))
  .sort((a, b) => Number(a.slice(5)) - Number(b.slice(5)))
  .filter((d) => !tileFilter.length || tileFilter.includes(Number(d.slice(5))));

await MeshoptSimplifier.ready;

async function parseTile(tileName) {
  const file = path.join(dataDir, tileName, `${tileName}.obj`);
  const pos = [];
  const uv = [];
  const faces = []; // v0,vt0,v1,vt1,v2,vt2, material
  const materials = [];
  let mat = -1;
  const rl = readline.createInterface({ input: fs.createReadStream(file, { highWaterMark: 1 << 22 }), crlfDelay: Infinity });
  for await (const line of rl) {
    const c = line.charCodeAt(0);
    if (c === 118 /* v */) {
      const t = line.charCodeAt(1);
      if (t === 32) {
        const p = line.split(' ');
        pos.push(+p[1], +p[2], +p[3]);
      } else if (t === 116) {
        const p = line.split(' ');
        uv.push(+p[1], +p[2]);
      }
    } else if (c === 102 /* f */) {
      const p = line.split(' ');
      const a = p[1].split('/');
      const b = p[2].split('/');
      const d = p[3].split('/');
      faces.push(+a[0] - 1, +a[1] - 1, +b[0] - 1, +b[1] - 1, +d[0] - 1, +d[1] - 1, mat);
    } else if (c === 117 /* usemtl */ && line.startsWith('usemtl ')) {
      const name = line.slice(7).trim();
      mat = materials.indexOf(name);
      if (mat < 0) {
        materials.push(name);
        mat = materials.length - 1;
      }
    }
  }
  return { pos: Float32Array.from(pos), uv: Float32Array.from(uv), faces: Int32Array.from(faces), materials };
}

function simplifyTile(tile) {
  const { pos, uv, faces, materials } = tile;
  const faceCount = faces.length / 7;

  // weld (v, vt) pairs into single vertices
  const lookup = new Map();
  const vPos = [];
  const vUv = [];
  const vMat = [];
  const indices = new Uint32Array(faceCount * 3);
  for (let f = 0; f < faceCount; f++) {
    const m = faces[f * 7 + 6];
    for (let k = 0; k < 3; k++) {
      const v = faces[f * 7 + k * 2];
      const t = faces[f * 7 + k * 2 + 1];
      const key = (v * 4194304 + t) * 8 + m; // vertex+uv+material fit well inside 2^53
      let id = lookup.get(key);
      if (id === undefined) {
        id = vMat.length;
        lookup.set(key, id);
        vPos.push(pos[v * 3], pos[v * 3 + 1], pos[v * 3 + 2]);
        vUv.push(uv[t * 2], uv[t * 2 + 1]);
        vMat.push(m);
      }
      indices[f * 3 + k] = id;
    }
  }
  lookup.clear();

  const n = vMat.length;
  const positions = Float32Array.from(vPos);
  const attrs = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    attrs[i * 3] = vUv[i * 2];
    attrs[i * 3 + 1] = vUv[i * 2 + 1];
    attrs[i * 3 + 2] = vMat[i];
  }

  const target = Math.max(300, Math.floor(faceCount * RATIO)) * 3;
  const [simplified, err] = MeshoptSimplifier.simplifyWithAttributes(
    indices,
    positions,
    3,
    attrs,
    3,
    [1, 1, 400],
    null,
    target,
    0.05,
    ['Prune'],
  );
  console.log(`  ${faceCount} tris / ${n} verts -> ${simplified.length / 3} tris (err ${err.toFixed(4)})`);

  // split into per-material meshes, compact vertices
  const parts = materials.map(() => ({ remap: new Map(), pos: [], uv: [], idx: [] }));
  for (let i = 0; i < simplified.length; i += 3) {
    const part = parts[vMat[simplified[i]]];
    for (let k = 0; k < 3; k++) {
      const old = simplified[i + k];
      let id = part.remap.get(old);
      if (id === undefined) {
        id = part.pos.length / 3;
        part.remap.set(old, id);
        // Z-up -> Y-up
        part.pos.push(positions[old * 3], positions[old * 3 + 2], -positions[old * 3 + 1]);
        part.uv.push(vUv[old * 2], 1 - vUv[old * 2 + 1]); // glTF has a top-left UV origin
      }
      part.idx.push(id);
    }
  }
  return parts.map((p, i) => ({ name: materials[i], pos: Float32Array.from(p.pos), uv: Float32Array.from(p.uv), idx: Uint32Array.from(p.idx) })).filter((p) => p.idx.length);
}

// ---- main ----
const primitives = [];
for (const tileName of tiles) {
  console.log(tileName);
  const t0 = Date.now();
  const tile = await parseTile(tileName);
  console.log(`  parsed in ${((Date.now() - t0) / 1000).toFixed(0)}s`);
  for (const p of simplifyTile(tile)) primitives.push({ tile: tileName, ...p });
}

// centre on the footprint, lowest point at y = 0
let minX = Infinity, maxX = -Infinity, minY = Infinity, minZ = Infinity, maxZ = -Infinity, maxY = -Infinity;
for (const p of primitives) {
  for (let i = 0; i < p.pos.length; i += 3) {
    minX = Math.min(minX, p.pos[i]); maxX = Math.max(maxX, p.pos[i]);
    minY = Math.min(minY, p.pos[i + 1]); maxY = Math.max(maxY, p.pos[i + 1]);
    minZ = Math.min(minZ, p.pos[i + 2]); maxZ = Math.max(maxZ, p.pos[i + 2]);
  }
}
const cx = (minX + maxX) / 2;
const cz = (minZ + maxZ) / 2;
for (const p of primitives) {
  for (let i = 0; i < p.pos.length; i += 3) {
    p.pos[i] -= cx;
    p.pos[i + 1] -= minY;
    p.pos[i + 2] -= cz;
  }
}
console.log(`size ${(maxX - minX).toFixed(0)} x ${(maxY - minY).toFixed(0)} x ${(maxZ - minZ).toFixed(0)} m`);

// textures: resize with Pillow (one jpg per atlas actually used)
const texDir = path.join(path.dirname(outPath), `.tex-${path.basename(outPath, '.glb')}`);
fs.mkdirSync(texDir, { recursive: true });
const jobs = [];
for (const p of primitives) {
  const src = path.join(dataDir, p.tile, `${p.name}.jpg`);
  if (fs.existsSync(src)) jobs.push([src, path.join(texDir, `${p.name}.jpg`)]);
}
const py = `
import sys, json
from PIL import Image
Image.MAX_IMAGE_PIXELS = None
size, quality = int(sys.argv[1]), int(sys.argv[2])
for src, dst in json.loads(sys.stdin.read()):
    im = Image.open(src).convert('RGB')
    im.thumbnail((size, size), Image.LANCZOS)
    im.save(dst, quality=quality, optimize=True)
`;
execFileSync('python', ['-I', '-c', py, String(TEX_SIZE), String(TEX_QUALITY)], { input: JSON.stringify(jobs), stdio: ['pipe', 'inherit', 'inherit'] });

// ---- GLB ----
const chunks = [];
let byteLength = 0;
const bufferViews = [];
const accessors = [];
function addView(buf, target) {
  const pad = (4 - (byteLength % 4)) % 4;
  if (pad) { chunks.push(Buffer.alloc(pad)); byteLength += pad; }
  const view = { buffer: 0, byteOffset: byteLength, byteLength: buf.byteLength };
  if (target) view.target = target;
  chunks.push(Buffer.from(buf.buffer, buf.byteOffset, buf.byteLength));
  byteLength += buf.byteLength;
  bufferViews.push(view);
  return bufferViews.length - 1;
}
function addAccessor(view, componentType, count, type, extra = {}) {
  accessors.push({ bufferView: view, componentType, count, type, ...extra });
  return accessors.length - 1;
}

const images = [];
const textures = [];
const gltfMaterials = [];
const materialIndex = new Map();
function materialFor(p) {
  if (materialIndex.has(p.name)) return materialIndex.get(p.name);
  const texFile = path.join(texDir, `${p.name}.jpg`);
  const mat = { name: p.name, doubleSided: true, extensions: { KHR_materials_unlit: {} } };
  if (fs.existsSync(texFile)) {
    const jpg = fs.readFileSync(texFile);
    const view = addView(new Uint8Array(jpg.buffer, jpg.byteOffset, jpg.byteLength));
    images.push({ bufferView: view, mimeType: 'image/jpeg' });
    textures.push({ source: images.length - 1, sampler: 0 });
    mat.pbrMetallicRoughness = { baseColorTexture: { index: textures.length - 1 }, metallicFactor: 0, roughnessFactor: 1 };
  } else {
    mat.pbrMetallicRoughness = { baseColorFactor: [0.5, 0.5, 0.5, 1], metallicFactor: 0, roughnessFactor: 1 };
  }
  gltfMaterials.push(mat);
  materialIndex.set(p.name, gltfMaterials.length - 1);
  return gltfMaterials.length - 1;
}

const meshPrimitives = [];
for (const p of primitives) {
  const mat = materialFor(p);
  const posView = addView(p.pos, 34962);
  const uvView = addView(p.uv, 34962);
  const idxView = addView(p.idx, 34963);
  const posAcc = addAccessor(posView, 5126, p.pos.length / 3, 'VEC3', {
    min: [Math.min(...minMax(p.pos, 0)), Math.min(...minMax(p.pos, 1)), Math.min(...minMax(p.pos, 2))],
    max: [Math.max(...minMax(p.pos, 0)), Math.max(...minMax(p.pos, 1)), Math.max(...minMax(p.pos, 2))],
  });
  const uvAcc = addAccessor(uvView, 5126, p.uv.length / 2, 'VEC2');
  const idxAcc = addAccessor(idxView, 5125, p.idx.length, 'SCALAR');
  meshPrimitives.push({ attributes: { POSITION: posAcc, TEXCOORD_0: uvAcc }, indices: idxAcc, material: mat });
}

// min/max without spreading millions of values into Math.min()
function minMax(arr, axis) {
  let lo = Infinity, hi = -Infinity;
  for (let i = axis; i < arr.length; i += 3) {
    if (arr[i] < lo) lo = arr[i];
    if (arr[i] > hi) hi = arr[i];
  }
  return [lo, hi];
}

const json = {
  asset: { version: '2.0', generator: 'build-site-model.mjs' },
  extensionsUsed: ['KHR_materials_unlit'],
  scene: 0,
  scenes: [{ nodes: [0] }],
  nodes: [{ mesh: 0, name: path.basename(outPath, '.glb') }],
  meshes: [{ primitives: meshPrimitives }],
  materials: gltfMaterials,
  textures,
  images,
  samplers: [{ magFilter: 9729, minFilter: 9987, wrapS: 33071, wrapT: 33071 }],
  accessors,
  bufferViews,
  buffers: [{ byteLength }],
};
let jsonBuf = Buffer.from(JSON.stringify(json));
jsonBuf = Buffer.concat([jsonBuf, Buffer.alloc((4 - (jsonBuf.length % 4)) % 4, 0x20)]);
const binPad = (4 - (byteLength % 4)) % 4;
const bin = Buffer.concat([...chunks, Buffer.alloc(binPad)]);
const total = 12 + 8 + jsonBuf.length + 8 + bin.length;
const header = Buffer.alloc(12);
header.writeUInt32LE(0x46546c67, 0);
header.writeUInt32LE(2, 4);
header.writeUInt32LE(total, 8);
const jsonHead = Buffer.alloc(8);
jsonHead.writeUInt32LE(jsonBuf.length, 0);
jsonHead.writeUInt32LE(0x4e4f534a, 4);
const binHead = Buffer.alloc(8);
binHead.writeUInt32LE(bin.length, 0);
binHead.writeUInt32LE(0x004e4942, 4);
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, Buffer.concat([header, jsonHead, jsonBuf, binHead, bin]));
fs.rmSync(texDir, { recursive: true, force: true });
const tris = primitives.reduce((s, p) => s + p.idx.length / 3, 0);
console.log(`wrote ${outPath}: ${(total / 1e6).toFixed(1)} MB, ${tris} triangles, ${gltfMaterials.length} materials`);
