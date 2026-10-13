import { Box3, Vector3 } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { BCD_PLACEMENTS } from './tunnelLayout';
import { MAP_SIZE, worldToMap } from './minimapProjection';
import { assetUrl } from './assetUrl';

// Rasterizes the real tunnel floor plan from the same GLB pieces and
// placements the 3D scene renders, so the minimap can never drift from the
// geometry. Up-facing triangles within ~1.3m of each piece's lowest point are
// the walkable floor (plus the banks beside it). They are drawn as a hard mask
// at 2x resolution, then shaded from blurred copies of that mask: a ~1px smooth
// silhouette, a bright rim, an inner "depth" gradient (lighter along the
// center, darker toward the walls) and a soft outer glow.
const FLOOR_BAND = 1.3;
const FLAT_NORMAL = 0.6;
const SS = 2;

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

// Separable box blur on a Float32 image; out-of-range pixels count as 0.
function boxBlur(src, w, h, r, passes) {
  const norm = 1 / (2 * r + 1);
  let a = src;
  for (let p = 0; p < passes; p++) {
    const b = new Float32Array(w * h);
    for (let y = 0; y < h; y++) {
      const row = y * w;
      let sum = 0;
      for (let x = 0; x <= r && x < w; x++) sum += a[row + x];
      for (let x = 0; x < w; x++) {
        b[row + x] = sum * norm;
        const add = x + r + 1;
        const sub = x - r;
        if (add < w) sum += a[row + add];
        if (sub >= 0) sum -= a[row + sub];
      }
    }
    const c = new Float32Array(w * h);
    for (let x = 0; x < w; x++) {
      let sum = 0;
      for (let y = 0; y <= r && y < h; y++) sum += b[y * w + x];
      for (let y = 0; y < h; y++) {
        c[y * w + x] = sum * norm;
        const add = y + r + 1;
        const sub = y - r;
        if (add < h) sum += b[add * w + x];
        if (sub >= 0) sum -= b[sub * w + x];
      }
    }
    a = c;
  }
  return a;
}

const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
const smoothstep = (e0, e1, x) => {
  const t = clamp01((x - e0) / (e1 - e0));
  return t * t * (3 - 2 * t);
};
const lerp = (a, b, t) => a + (b - a) * t;

function shade(ctx) {
  const { width: w, height: h } = ctx.canvas;
  const px = ctx.getImageData(0, 0, w, h).data;
  const mask = new Float32Array(w * h);
  for (let i = 0; i < mask.length; i++) mask[i] = px[i * 4 + 3] / 255;

  const rim = boxBlur(mask, w, h, 4, 3);
  const wide = boxBlur(mask, w, h, 7, 2);

  const out = new ImageData(w, h);
  for (let i = 0; i < mask.length; i++) {
    const m1 = rim[i];
    const m2 = wide[i];
    const cover = smoothstep(0.4, 0.6, m1);
    const depth = clamp01((m2 - 0.5) / 0.45);

    let r = 0;
    let g = 0;
    let b = 0;
    let a = 0;
    const over = (cr, cg, cb, ca) => {
      if (ca <= 0) return;
      const outA = ca + a * (1 - ca);
      r = cr * ca + r * (1 - ca);
      g = cg * ca + g * (1 - ca);
      b = cb * ca + b * (1 - ca);
      a = outA;
    };

    over(56, 189, 248, (1 - cover) * m2 * 0.5);
    over(lerp(24, 59, depth), lerp(58, 130, depth), lerp(92, 184, depth), cover * lerp(0.62, 0.86, depth));
    over(165, 224, 255, clamp01(1 - Math.abs(m1 - 0.5) / 0.08) * 0.95);

    if (a <= 0.004) continue;
    const o = i * 4;
    out.data[o] = r / a;
    out.data[o + 1] = g / a;
    out.data[o + 2] = b / a;
    out.data[o + 3] = Math.min(255, a * 255);
  }
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  canvas.getContext('2d').putImageData(out, 0, 0);
  return canvas.toDataURL('image/png');
}

async function build() {
  const loader = new GLTFLoader();
  const draco = new DRACOLoader();
  draco.setDecoderPath(assetUrl('/draco/'));
  loader.setDRACOLoader(draco);

  const canvas = document.createElement('canvas');
  canvas.width = MAP_SIZE.width * SS;
  canvas.height = MAP_SIZE.height * SS;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.scale(SS, SS);
  ctx.fillStyle = '#fff';

  const pieces = [...new Set(BCD_PLACEMENTS.map((p) => p.name))];
  const gltfs = await Promise.all(pieces.map((name) => loader.loadAsync(assetUrl(`/models/tunnel_pieces/${name}.glb`))));
  BCD_PLACEMENTS.forEach((placement) => drawFloor(ctx, gltfs[pieces.indexOf(placement.name)], placement));
  draco.dispose();
  return shade(ctx);
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
