import { useCallback, useEffect, useState } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { Vector3 } from 'three';
import ItemModel from './ItemModel';

const VIEW_DIR = new Vector3(1, 0.8, 1).normalize();
const DEFAULT_MAX_DIM = 1.5;

function PlaceholderMesh() {
  return (
    <mesh>
      <icosahedronGeometry args={[0.4, 0]} />
      <meshStandardMaterial color="#64748b" emissive="#334155" emissiveIntensity={0.6} />
    </mesh>
  );
}

// Models range from ~0.1m hand tools to ~3m machinery, so the camera distance
// has to be derived from each model's actual bounding box, not a fixed position.
function CameraFit({ bounds }) {
  const { camera } = useThree();

  useEffect(() => {
    if (!bounds) return;
    const maxDim = Math.max(bounds.size.x, bounds.size.y, bounds.size.z, 0.05);
    const distance = maxDim * 1.8;
    camera.position.copy(bounds.center.clone().addScaledVector(VIEW_DIR, distance));
    camera.near = Math.max(maxDim / 100, 0.01);
    camera.far = Math.max(maxDim * 50, 50);
    camera.lookAt(bounds.center);
    camera.updateProjectionMatrix();
  }, [bounds, camera]);

  return null;
}

export default function ModelPreview({ item, background = '#0586c7' }) {
  const [bounds, setBounds] = useState(null);
  const handleBounds = useCallback((size, center) => setBounds({ size, center }), []);

  useEffect(() => {
    setBounds(null);
  }, [item?.id]);

  if (!item) return null;
  const hasRealModel = item.model_url?.endsWith('.obj');
  const maxDim = bounds ? Math.max(bounds.size.x, bounds.size.y, bounds.size.z, 0.05) : DEFAULT_MAX_DIM;
  const target = bounds?.center ?? new Vector3(0, DEFAULT_MAX_DIM * 0.3, 0);

  return (
    <div style={{ width: '100%', height: '100%', background }}>
      <Canvas key={item.id} camera={{ position: [2.5, 2, 2.5], fov: 45 }} gl={{ toneMappingExposure: 1.4 }}>
        <hemisphereLight intensity={1.4} groundColor="#8a94a6" />
        <ambientLight intensity={1} />
        <directionalLight position={[3, 5, 2]} intensity={1.8} />
        <directionalLight position={[-3, 2, -3]} intensity={0.6} />
        <gridHelper args={[50, 50, '#f1f1f1', '#e6e8ec']} />
        {hasRealModel ? (
          <ItemModel
            objUrl={item.model_url}
            mtlUrl={item.model_url.replace(/\.obj$/, '.mtl')}
            color={item.color}
            fallback={<PlaceholderMesh />}
            onBounds={handleBounds}
          />
        ) : (
          <PlaceholderMesh />
        )}
        <CameraFit bounds={bounds} />
        <OrbitControls
          autoRotate
          autoRotateSpeed={1.2}
          target={[target.x, target.y, target.z]}
          minDistance={maxDim * 0.1}
          maxDistance={maxDim * 8}
        />
      </Canvas>
    </div>
  );
}
