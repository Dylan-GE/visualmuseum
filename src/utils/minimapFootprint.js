import { Box3, Vector3 } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { BCD_PLACEMENTS } from './tunnelLayout';
import { MAP_SIZE, worldToMap } from './minimapProjection';

// Rasterizes the real tunnel floor plan from the same GLB pieces and
// placements the 3D scene renders, so the minimap can never drift from the
// geometry (the old hand-drawn map image depicted a layout that no longer
// existed). Triangles that face up and sit within ~1.3m of each piece's lowest
// point are the walkable floor (plus the banks beside it); they are filled,
// then the edge pixels are tinted as the tunnel outline.
const FLOOR_BAND = 1.3;
const FLAT_NORMAL = 0.6;

function drawFloor(ctx, gltf, placement) {
  const root = gltf.scene;
  root.updateMatrixWorld(true);
  const box = new Box3().setFromObject(root);
  const center = box.getCenter(new Vector3());
  const v = [new Vector3(), new Vector3(), new Vector3()];
  const e1 = new Vector3();
  const e2 = new Vector3();

  root.traverse((child) => {
    if (!child.isMesh) return;
    const pos = child.geometry.attributes.position;
    const index = child.geometry.index;
    const triCount = (index ? index.count : pos.count) / 3;
    for (let t = 0; t < triCount; t++) {
      for (let k = 0; k < 3; k++) {
        v[k].fromBufferAttribute(pos, index ? index.getX(t * 3 + k) : t * 3 + k).applyMatrix4(child.matrixWorld);
      }
      e1.subVectors(v[1], v[0]);
      e2.subVectors(v[2], v[0]);
      const n = e1.cross(e2);
      if (Math.abs(n.y) / (n.length() || 1) < FLAT_NORMAL) continue;
      const localY = (v[0].y + v[1].y + v[2].y) / 3 - box.min.y;
      if (localY > FLOOR_BAND) continue;
      ctx.beginPath();
      v.forEach((p, k) => {
        const [sx, sy] = worldToMap(placement.x + (p.x - center.x), placement.z + (p.z - center.z));
        if (k === 0) ctx.moveTo(sx, sy);
        else ctx.lineTo(sx, sy);
      });
      ctx.closePath();
      ctx.fill();
    }
  });
}

function tint(source) {
  const { width, height } = source.canvas;
  const src = source.getImageData(0, 0, width, height);
  const out = new ImageData(width, height);
  const solid = (x, y) => x >= 0 && y >= 0 && x < width && y < height && src.data[(y * width + x) * 4 + 3] > 100;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (!solid(x, y)) continue;
      const i = (y * width + x) * 4;
      const edge = !solid(x - 1, y) || !solid(x + 1, y) || !solid(x, y - 1) || !solid(x, y + 1);
      out.data[i] = edge ? 125 : 56;
      out.data[i + 1] = edge ? 211 : 140;
      out.data[i + 2] = edge ? 252 : 200;
      out.data[i + 3] = edge ? 235 : 120;
    }
  }
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  canvas.getContext('2d').putImageData(out, 0, 0);
  return canvas.toDataURL('image/png');
}

async function build() {
  const loader = new GLTFLoader();
  const draco = new DRACOLoader();
  draco.setDecoderPath('/draco/');
  loader.setDRACOLoader(draco);

  const canvas = document.createElement('canvas');
  canvas.width = MAP_SIZE.width;
  canvas.height = MAP_SIZE.height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.fillStyle = '#fff';

  const pieces = [...new Set(BCD_PLACEMENTS.map((p) => p.name))];
  const gltfs = await Promise.all(pieces.map((name) => loader.loadAsync(`/models/tunnel_pieces/${name}.glb`)));
  BCD_PLACEMENTS.forEach((placement) => drawFloor(ctx, gltfs[pieces.indexOf(placement.name)], placement));
  draco.dispose();
  return tint(ctx);
}

let cached = null;

export function loadMinimapFootprint() {
  if (!cached) {
    cached = build().catch((err) => {
      cached = null;
      throw err;
    });
  }
  return cached;
}
