import {
  AmbientLight,
  DirectionalLight,
  HemisphereLight,
  PerspectiveCamera,
  Scene,
  Vector3,
  WebGLRenderer,
} from 'three';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { MTLLoader } from 'three/examples/jsm/loaders/MTLLoader.js';
import { applyColorOverride, fitObjectToGround } from './bimModel';

// Collection-grid tabs can hold 20+ items, and each needing its own live WebGL
// canvas quickly exhausts the browser's per-page context budget (commonly ~16),
// which can evict OTHER contexts on the page — including the main scene's.
// Instead, every thumbnail is rendered once to a static PNG using a single
// shared renderer, cached, and displayed as a plain <img>.
const SIZE = 160;
const VIEW_DIR = new Vector3(1, 0.8, 1).normalize();

let renderer = null;
let scene = null;
let camera = null;

function ensureRenderer() {
  if (renderer) return;
  renderer = new WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
  renderer.setSize(SIZE, SIZE);
  renderer.setPixelRatio(1);
  renderer.toneMappingExposure = 1.4;

  scene = new Scene();
  scene.add(new HemisphereLight(0xffffff, 0x8a94a6, 1.4));
  scene.add(new AmbientLight(0xffffff, 1));
  const key = new DirectionalLight(0xffffff, 1.8);
  key.position.set(3, 5, 2);
  scene.add(key);
  const fill = new DirectionalLight(0xffffff, 0.6);
  fill.position.set(-3, 2, -3);
  scene.add(fill);

  camera = new PerspectiveCamera(40, 1, 0.01, 100);
}

function disposeObject(object) {
  object.traverse((child) => {
    child.geometry?.dispose();
    const materials = Array.isArray(child.material) ? child.material : [child.material];
    materials.forEach((m) => m?.dispose());
  });
}

function loadObj(objUrl, mtlUrl) {
  return new Promise((resolve, reject) => {
    const mtlLoader = new MTLLoader();
    mtlLoader.load(
      mtlUrl,
      (materials) => {
        materials.preload();
        const objLoader = new OBJLoader();
        objLoader.setMaterials(materials);
        objLoader.load(objUrl, resolve, undefined, reject);
      },
      undefined,
      reject,
    );
  });
}

async function renderOne(objUrl, mtlUrl, color) {
  ensureRenderer();
  const obj = await loadObj(objUrl, mtlUrl);
  applyColorOverride(obj, color);
  const { size, center } = fitObjectToGround(obj);
  scene.add(obj);
  try {
    const maxDim = Math.max(size.x, size.y, size.z, 0.05);
    camera.position.copy(center.clone().addScaledVector(VIEW_DIR, maxDim * 1.8));
    camera.near = Math.max(maxDim / 100, 0.01);
    camera.far = Math.max(maxDim * 50, 50);
    camera.lookAt(center);
    camera.updateProjectionMatrix();
    renderer.render(scene, camera);
    return renderer.domElement.toDataURL('image/png');
  } finally {
    scene.remove(obj);
    disposeObject(obj);
  }
}

const cache = new Map();
let queue = Promise.resolve();

// Renders (or reuses a cached render of) the given OBJ/MTL as a small PNG data URL.
// Requests are serialized through a shared renderer/scene, so only one extra
// WebGL context ever exists for the whole gallery regardless of item count.
export function getModelThumbnail(objUrl, mtlUrl, color) {
  const key = `${objUrl}::${color || ''}`;
  if (cache.has(key)) return cache.get(key);
  const result = queue.then(() => renderOne(objUrl, mtlUrl, color));
  queue = result.then(
    () => undefined,
    () => undefined,
  );
  cache.set(key, result);
  return result;
}
