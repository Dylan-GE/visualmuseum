import { Suspense, useLayoutEffect, useMemo, useRef } from 'react';
import { useLoader } from '@react-three/fiber';
import { Box3, Matrix4, Quaternion, Vector3 } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import ErrorBoundary from './ErrorBoundary';
import { patchAtlasMaterial } from '../utils/atlasTextureFix';
import { tunnelPieceUrl, withDraco } from '../utils/tunnelPieceLoader';


// Loads a tunnel-piece .glb once and extracts {geometry, material, matrix}
// for every mesh inside it, with `matrix` already carrying the same
// recenter-X/Z + ground-Y (and optional corrective preRotation) that
// GroundedGltf applies per-instance — but computed ONCE here, so any number
// of placements can share one InstancedMesh per submesh instead of one full
// scene-graph clone per placement.
function useGroundedParts(name, preRotation) {
  const gltf = useLoader(GLTFLoader, tunnelPieceUrl(name), withDraco);
  return useMemo(() => {
    // .clone() shares geometry/material by reference (that's what we want —
    // one buffer per submesh, reused across all instances) and only deep-copies
    // the transform hierarchy, so mutating rotation here is safe and doesn't
    // touch three's cached/shared gltf.scene.
    const root = gltf.scene.clone(true);
    if (preRotation) root.rotation.set(...preRotation);
    root.updateMatrixWorld(true);
    const box = new Box3().setFromObject(root);
    const center = new Vector3();
    box.getCenter(center);
    const groundOffset = new Matrix4().makeTranslation(-center.x, -box.min.y, -center.z);

    const parts = [];
    root.traverse((child) => {
      if (child.isMesh) {
        parts.push({
          geometry: child.geometry,
          material: patchAtlasMaterial(child.material, name),
          matrix: groundOffset.clone().multiply(child.matrixWorld),
        });
      }
    });
    return parts;
  }, [gltf, preRotation, name]);
}

const UP_AXIS = new Vector3(0, 1, 0);

function InstancedPart({ geometry, material, baseMatrix, placements }) {
  const meshRef = useRef(null);

  useLayoutEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    const quat = new Quaternion();
    const pos = new Vector3();
    const scale = new Vector3();
    const placementMatrix = new Matrix4();
    const finalMatrix = new Matrix4();
    placements.forEach((p, i) => {
      pos.set(p.x, p.y, p.z);
      scale.set(p.scale?.[0] ?? 1, p.scale?.[1] ?? 1, p.scale?.[2] ?? 1);
      quat.setFromAxisAngle(UP_AXIS, p.rotationY ?? 0);
      placementMatrix.compose(pos, quat, scale);
      finalMatrix.multiplyMatrices(placementMatrix, baseMatrix);
      mesh.setMatrixAt(i, finalMatrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [placements, baseMatrix]);

  return (
    <instancedMesh ref={meshRef} args={[geometry, material, placements.length]} frustumCulled={false} />
  );
}

function LoadedInstances({ name, placements, preRotation }) {
  const parts = useGroundedParts(name, preRotation);
  return parts.map((part, i) => (
    <InstancedPart
      key={i}
      geometry={part.geometry}
      material={part.material}
      baseMatrix={part.matrix}
      placements={placements}
    />
  ));
}

// Renders every placement of one tunnel-piece type as real GPU instancing
// (one draw call per submesh, shared geometry/material) instead of one loaded
// scene-graph clone per placement. `placements` is
// [{x,y,z,rotationY?,scale?:[sx,sy,sz]}] — `rotationY` (radians, around the
// world Y axis) lets the same piece be reused on a branch that heads off in a
// different horizontal direction than the segment it was authored for.
// Wrapped in Suspense + ErrorBoundary (useLoader requires a Suspense ancestor,
// and one missing/broken piece type shouldn't take down the rest of the scene
// — same pattern as GroundedGltf.jsx).
export default function InstancedTunnelPiece({ name, placements, preRotation = null }) {
  if (!placements.length) return null;
  return (
    <ErrorBoundary fallback={null}>
      <Suspense fallback={null}>
        <LoadedInstances name={name} placements={placements} preRotation={preRotation} />
      </Suspense>
    </ErrorBoundary>
  );
}
