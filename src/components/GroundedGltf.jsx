import { Suspense, useEffect, useMemo } from 'react';
import { useLoader } from '@react-three/fiber';
import { Box3, Vector3 } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import ErrorBoundary from './ErrorBoundary';
import { assetUrl } from '../utils/assetUrl';

function withDraco(loader) {
  const dracoLoader = new DRACOLoader();
  dracoLoader.setDecoderPath(assetUrl('/draco/'));
  loader.setDRACOLoader(dracoLoader);
}

function LoadedPiece({ url, onBounds, preRotation }) {
  const gltf = useLoader(GLTFLoader, url, withDraco);

  // Every extracted tunnel piece keeps its original (huge, arbitrary) world
  // coordinates from the source scene, so it must be recentered in X/Z and
  // grounded in Y (lowest point at y=0) before it's usable at a new position.
  // Some pieces (e.g. BoxWood*) also come out of the source scene tilted at an
  // arbitrary angle (baked into their vertex positions, not a separate
  // transform) rather than lying flat — `preRotation` (a fixed Euler [x,y,z],
  // computed offline via PCA on the raw vertices, see scratch/compute_obb.cjs)
  // corrects that tilt. It's applied BEFORE the bounding box is computed so
  // the recenter/ground math operates on the corrected orientation.
  // Do NOT also pass a `position` prop on the returned <primitive> — R3F
  // reapplies that prop on every render and will stomp this adjustment back to it.
  const { instance, size } = useMemo(() => {
    const clone = gltf.scene.clone();
    if (preRotation) clone.rotation.set(...preRotation);
    clone.updateMatrixWorld(true);
    const box = new Box3().setFromObject(clone);
    const center = new Vector3();
    const sizeVec = new Vector3();
    box.getCenter(center);
    box.getSize(sizeVec);
    clone.position.x -= center.x;
    clone.position.z -= center.z;
    clone.position.y -= box.min.y;
    return { instance: clone, size: sizeVec };
  }, [gltf, preRotation]);

  useEffect(() => {
    onBounds?.(size);
  }, [size, onBounds]);

  return <primitive object={instance} />;
}

// Loads a tunnel-piece .glb, recenters/grounds it, and wraps loading in
// Suspense + ErrorBoundary so one missing/broken piece doesn't take down
// the rest of the scene.
export default function GroundedGltf({ url, onBounds, fallback = null, preRotation = null }) {
  return (
    <ErrorBoundary fallback={fallback}>
      <Suspense fallback={fallback}>
        <LoadedPiece url={url} onBounds={onBounds} preRotation={preRotation} />
      </Suspense>
    </ErrorBoundary>
  );
}
