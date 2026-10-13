// Builds one real-size (100%) GLB per exhibit item for the AR viewer (/ar/:itemId)
// and records its size info in public/data/museum_data.json under `ar`.
//
// It reuses the museum's own model pipeline (src/utils/bimModel.js: BIM Z-up ->
// Y-up rotation, grounding, per-item colour override) so the AR model looks
// exactly like the one in the tunnel, then centres it on the origin and scales
// it. The model is NOT resized: AR shows every item at its true size (a 3m
// winch really is 3m long). Only the `ar` field (and the unused legacy
// `usdz_url`) of each item is touched — all hand edits in museum_data.json are
// preserved. iOS needs no USDZ: <model-viewer> generates one from the GLB.
//
// Usage: npm run ar:build
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { Box3, DoubleSide, Group, MeshStandardMaterial, Vector3 } from 'three';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { MTLLoader } from 'three/examples/jsm/loaders/MTLLoader.js';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import { applyColorOverride, fitObjectToGround } from '../src/utils/bimModel.js';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const DATA_PATH = path.join(ROOT, 'public', 'data', 'museum_data.json');
const OUT_DIR = path.join(ROOT, 'public', 'models', 'ar');

// Uniform scale applied to every AR model (1 = true size).
const AR_SCALE = 1;

// GLTFExporter reads blobs with FileReader, which Node doesn't have.
globalThis.FileReader = class {
  readAsArrayBuffer(blob) {
    blob.arrayBuffer().then((buf) => {
      this.result = buf;
      this.onloadend?.();
    });
  }
  readAsDataURL(blob) {
    blob.arrayBuffer().then((buf) => {
      this.result = `data:${blob.type || 'application/octet-stream'};base64,${Buffer.from(buf).toString('base64')}`;
      this.onloadend?.();
    });
  }
};

function loadObject(item) {
  const objPath = path.join(ROOT, 'public', item.model_url);
  const mtlPath = objPath.replace(/\.obj$/i, '.mtl');
  const loader = new OBJLoader();
  if (fs.existsSync(mtlPath)) {
    const materials = new MTLLoader().parse(fs.readFileSync(mtlPath, 'utf8'), path.dirname(mtlPath) + path.sep);
    materials.preload();
    loader.setMaterials(materials);
  }
  return loader.parse(fs.readFileSync(objPath, 'utf8'));
}

// MTL materials are Phong, which glTF has no equivalent for — swap in PBR with
// the same colour so every viewer shades it the same way.
function toStandardMaterials(object) {
  object.traverse((child) => {
    if (!child.isMesh) return;
    const convert = (m) => {
      const std = new MeshStandardMaterial({
        name: m.name,
        color: m.color,
        roughness: 0.65,
        metalness: 0.15,
        side: DoubleSide,
      });
      if (m.opacity < 1) {
        std.transparent = true;
        std.opacity = m.opacity;
      }
      return std;
    };
    child.material = Array.isArray(child.material) ? child.material.map(convert) : convert(child.material);
  });
}

async function buildOne(item) {
  const model = loadObject(item);
  applyColorOverride(model, item.color);
  const { size: realSize } = fitObjectToGround(model);

  const box = new Box3().setFromObject(model);
  const center = box.getCenter(new Vector3());
  model.position.x -= center.x;
  model.position.z -= center.z;
  toStandardMaterials(model);

  const scale = AR_SCALE;
  const root = new Group();
  root.name = item.id;
  root.scale.setScalar(scale);
  root.add(model);
  root.updateMatrixWorld(true);

  const glb = await new GLTFExporter().parseAsync(root, { binary: true });
  const file = path.join(OUT_DIR, `${item.id}.glb`);
  fs.writeFileSync(file, Buffer.from(glb));

  const r = (n) => Math.round(n * 1000) / 1000;
  return {
    glb: `/models/ar/${item.id}.glb`,
    scale: r(scale),
    real_size_m: [r(realSize.x), r(realSize.y), r(realSize.z)],
    bytes: fs.statSync(file).size,
  };
}

const data = JSON.parse(fs.readFileSync(DATA_PATH, 'utf8'));
fs.mkdirSync(OUT_DIR, { recursive: true });

let built = 0;
for (const item of data.items) {
  delete item.usdz_url;
  if (!item.model_url?.toLowerCase().endsWith('.obj')) {
    console.warn(`skip ${item.id}: no .obj model`);
    delete item.ar;
    continue;
  }
  try {
    const { bytes, ...ar } = await buildOne(item);
    item.ar = ar;
    built++;
    console.log(`${item.id.padEnd(26)} x${String(ar.scale).padEnd(7)} real ${ar.real_size_m.join(' x ')} m  ${(bytes / 1024).toFixed(0)} KB`);
  } catch (err) {
    console.error(`FAILED ${item.id}: ${err.message}`);
    delete item.ar;
  }
}

fs.writeFileSync(DATA_PATH, JSON.stringify(data, null, 2) + '\n', 'utf8');
console.log(`\n${built}/${data.items.length} AR models written to public/models/ar, manifest updated.`);
