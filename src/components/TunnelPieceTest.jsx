import { Component, Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { Canvas, useLoader, useThree } from '@react-three/fiber';
import { OrbitControls, Text } from '@react-three/drei';
import { Box3, Vector3 } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';

const PIECE_NAMES = [
  'BoxWoodA',
  'BoxWoodB',
  'SupportWoodA',
  'TS_Lo_up',
  'Rock1',
  'Rock2',
  'ThreeSupportAA',
  'well_wood',
];

const GRID_COLS = 4;
const CELL_SIZE = 2.4;

function withDraco(loader) {
  const dracoLoader = new DRACOLoader();
  dracoLoader.setDecoderPath('/draco/');
  loader.setDRACOLoader(dracoLoader);
}

class ReportingErrorBoundary extends Component {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error) {
    this.props.onError?.(error?.message || String(error));
  }

  render() {
    if (this.state.hasError) return null;
    return this.props.children;
  }
}

function GroundedPiece({ url, onBounds, onDebug }) {
  const gltf = useLoader(GLTFLoader, url, withDraco);

  const { instance, size, min } = useMemo(() => {
    const clone = gltf.scene.clone();
    clone.updateMatrixWorld(true);
    const box = new Box3().setFromObject(clone);
    const center = new Vector3();
    const sizeVec = new Vector3();
    box.getCenter(center);
    box.getSize(sizeVec);
    const minBefore = box.min.clone();
    clone.position.x -= center.x;
    clone.position.z -= center.z;
    clone.position.y -= box.min.y;
    return { instance: clone, size: sizeVec, min: minBefore };
  }, [gltf]);

  useEffect(() => {
    onBounds?.(size);
    onDebug?.(`size=(${size.x.toFixed(2)},${size.y.toFixed(2)},${size.z.toFixed(2)}) rawMinY=${min.y.toFixed(2)} newPosY=${instance.position.y.toFixed(2)}`);
  }, [size, onBounds]);

  return <primitive object={instance} />;
}

function CameraFit({ bounds }) {
  const { camera } = useThree();
  useEffect(() => {
    if (!bounds) return;
    const maxDim = Math.max(bounds.x, bounds.z, 3);
    const distance = maxDim * 1.1;
    camera.position.set(bounds.centerX, distance * 0.55, bounds.centerZ + distance);
    camera.near = 0.05;
    camera.far = Math.max(distance * 10, 100);
    camera.lookAt(bounds.centerX, 0.5, bounds.centerZ);
    camera.updateProjectionMatrix();
  }, [bounds, camera]);
  return null;
}

// Validation prototype: lay every extracted piece out on a tight grid with
// labels so we can eyeball scale/orientation/texture quality before committing
// to a full procedural placement system. Toggle with ?tunnelTest=1 in the URL.
export default function TunnelPieceTest() {
  const [sizes, setSizes] = useState({});
  const [statuses, setStatuses] = useState({});

  const positions = useMemo(
    () =>
      PIECE_NAMES.map((name, i) => {
        const col = i % GRID_COLS;
        const row = Math.floor(i / GRID_COLS);
        return {
          name,
          x: (col - (GRID_COLS - 1) / 2) * CELL_SIZE,
          z: row * CELL_SIZE,
        };
      }),
    [],
  );

  const bounds = useMemo(() => {
    const reported = Object.keys(sizes);
    if (reported.length === 0) return null;
    let minX = Infinity;
    let maxX = -Infinity;
    let minZ = Infinity;
    let maxZ = -Infinity;
    for (const p of positions) {
      const size = sizes[p.name];
      const halfX = size ? size.x / 2 : 0.5;
      const halfZ = size ? size.z / 2 : 0.5;
      minX = Math.min(minX, p.x - halfX);
      maxX = Math.max(maxX, p.x + halfX);
      minZ = Math.min(minZ, p.z - halfZ);
      maxZ = Math.max(maxZ, p.z + halfZ);
    }
    return {
      x: maxX - minX,
      z: maxZ - minZ,
      centerX: (minX + maxX) / 2,
      centerZ: (minZ + maxZ) / 2,
    };
  }, [sizes, positions]);

  const handleBounds = useCallback((name, size) => {
    setSizes((prev) => (prev[name] ? prev : { ...prev, [name]: size }));
  }, []);

  const setStatus = useCallback((name, msg) => {
    setStatuses((prev) => ({ ...prev, [name]: msg }));
  }, []);

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#1a2233' }}>
      <Canvas camera={{ position: [4, 4, 10], fov: 50 }} gl={{ toneMappingExposure: 1.3 }}>
        <hemisphereLight intensity={1.4} groundColor="#4a4a4a" />
        <ambientLight intensity={0.8} />
        <directionalLight position={[5, 8, 5]} intensity={1.6} />
        <gridHelper args={[40, 40, '#556', '#334']} />
        {positions.map(({ name, x, z }) => (
          <group key={name} position={[x, 0, z]}>
            <ReportingErrorBoundary onError={(msg) => setStatus(name, 'ERROR: ' + msg)}>
              <Suspense fallback={null}>
                <GroundedPiece
                  url={`/models/tunnel_pieces/${name}.glb`}
                  onBounds={(size) => handleBounds(name, size)}
                  onDebug={(msg) => setStatus(name, msg)}
                />
              </Suspense>
            </ReportingErrorBoundary>
            <Text position={[0, -0.15, 0.6]} fontSize={0.16} color="#9fe870" anchorX="center" anchorY="top">
              {name}
            </Text>
          </group>
        ))}
        <CameraFit bounds={bounds} />
        <OrbitControls target={[bounds?.centerX ?? 0, 0.5, bounds?.centerZ ?? 0]} makeDefault />
      </Canvas>
      <div style={{ position: 'absolute', top: 12, left: 12, color: '#fff', fontFamily: 'monospace', fontSize: 11, background: 'rgba(0,0,0,0.7)', padding: 8, borderRadius: 6, maxWidth: 480 }}>
        <div>坑道零件驗證：{PIECE_NAMES.join(' / ')}</div>
        {PIECE_NAMES.map((n) => (
          <div key={n}>{n}: {statuses[n] ?? '(pending)'}</div>
        ))}
      </div>
    </div>
  );
}
