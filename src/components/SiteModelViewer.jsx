import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { OrbitControls, useGLTF, useProgress } from '@react-three/drei';
import * as THREE from 'three';
import './SiteModelViewer.css';
import { BASE_HREF } from '../utils/assetUrl';

// 純展示的三維模型頁（國英坑、昇福坑、太白山）：只能旋轉、縮放、平移，不能走動。
// 地形是無人機實景（terrain），坑道內部是雷射掃描點雲（tunnel）；兩者座標已對齊，可以疊合。
const VIEWS = {
  outside: { label: '坑口外觀', terrain: 1, tunnel: false },
  inside: { label: '坑道內部', terrain: 0, tunnel: true },
  overlay: { label: '疊合', terrain: 0.28, tunnel: true },
};

function Terrain({ url, opacity, onBounds }) {
  const { scene } = useGLTF(url);
  const root = useMemo(() => scene.clone(true), [scene]);

  useEffect(() => {
    const box = new THREE.Box3().setFromObject(root);
    onBounds(box);
  }, [root, onBounds]);

  useEffect(() => {
    root.visible = opacity > 0;
    root.traverse((o) => {
      if (!o.isMesh) return;
      const m = o.material;
      m.toneMapped = false;
      m.transparent = opacity < 1;
      m.opacity = opacity;
      m.depthWrite = opacity >= 1;
      m.needsUpdate = true;
    });
  }, [root, opacity]);

  return <primitive object={root} />;
}

function Tunnel({ url, visible, onBounds }) {
  const { scene } = useGLTF(url);
  const points = useMemo(() => {
    let found = null;
    scene.traverse((o) => {
      if (o.isPoints) found = o;
    });
    if (!found) return null;
    // LAS colours are sRGB; glTF vertex colours are read as linear, so convert once.
    const src = found.geometry.getAttribute('color');
    const rgb = new Float32Array(src.count * 3);
    const c = new THREE.Color();
    for (let i = 0; i < src.count; i++) {
      c.setRGB(src.getX(i), src.getY(i), src.getZ(i), THREE.SRGBColorSpace);
      rgb[i * 3] = c.r;
      rgb[i * 3 + 1] = c.g;
      rgb[i * 3 + 2] = c.b;
    }
    const geometry = found.geometry.clone();
    geometry.setAttribute('color', new THREE.BufferAttribute(rgb, 3));
    const material = new THREE.PointsMaterial({ size: 0.09, sizeAttenuation: true, vertexColors: true, toneMapped: false });
    material.color.setRGB(1.8, 1.8, 1.8); // the tunnel was scanned in dim light; lift it so the walls are readable
    return new THREE.Points(geometry, material);
  }, [scene]);

  useEffect(() => {
    if (!points) return;
    points.geometry.computeBoundingBox();
    onBounds(points.geometry.boundingBox.clone());
  }, [points, onBounds]);

  if (!points) return null;
  return <primitive object={points} visible={visible} />;
}

// 依目前檢視的範圍擺好相機（切換檢視時重新取景），之後交給 OrbitControls。
function Rig({ box, controlsRef, fitKey }) {
  const camera = useThree((s) => s.camera);

  useEffect(() => {
    if (!box) return;
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const radius = Math.max(size.length() * 0.5, 10);
    // 從南偏東、斜上方看過去
    const dir = new THREE.Vector3(0.45, 0.8, 0.95).normalize();
    camera.position.copy(center).addScaledVector(dir, radius * 2.3);
    camera.near = Math.max(0.1, radius / 2000);
    camera.far = radius * 40;
    camera.updateProjectionMatrix();
    const c = controlsRef.current;
    if (c) {
      c.target.copy(center);
      c.maxDistance = radius * 6;
      c.update();
    }
  }, [box, fitKey, camera, controlsRef]);

  return null;
}

export default function SiteModelViewer({ site }) {
  const [view, setView] = useState('outside');
  const [terrainBox, setTerrainBox] = useState(null);
  const [tunnelBox, setTunnelBox] = useState(null);
  const controlsRef = useRef(null);
  const { progress, active } = useProgress();
  const hasTunnel = !!site.model.tunnel;
  const spec = VIEWS[view];

  // 取景範圍：外觀看地形、坑道內部看點雲、疊合看兩者聯集
  const fitBox = useMemo(() => {
    if (!terrainBox) return null;
    if (view === 'inside' && tunnelBox) return tunnelBox;
    if (view === 'overlay' && tunnelBox) return terrainBox.clone().union(tunnelBox);
    return terrainBox;
  }, [view, terrainBox, tunnelBox]);
  const box = terrainBox;

  return (
    <div className="site-page">
      <Canvas flat dpr={[1, 2]} camera={{ fov: 45, position: [0, 200, 300], near: 0.5, far: 5000 }}>
        <color attach="background" args={['#0e1013']} />
        <Suspense fallback={null}>
          <Terrain url={site.model.terrain} opacity={spec.terrain} onBounds={setTerrainBox} />
          {hasTunnel && <Tunnel url={site.model.tunnel} visible={spec.tunnel} onBounds={setTunnelBox} />}
        </Suspense>
        <Rig box={fitBox} controlsRef={controlsRef} fitKey={view} />
        <OrbitControls
          ref={controlsRef}
          makeDefault
          enableDamping
          dampingFactor={0.12}
          screenSpacePanning
          maxPolarAngle={Math.PI * 0.495}
          minDistance={3}
        />
      </Canvas>

      <header className="site-topbar">
        <a className="site-back" href={BASE_HREF}>
          ← 返回入口
        </a>
        <div className="site-title">
          <strong>{site.title}</strong>
          <small>三維模型</small>
        </div>
      </header>

      {hasTunnel && box && (
        <div className="site-views" role="tablist" aria-label="檢視內容">
          {Object.entries(VIEWS).map(([key, v]) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={view === key}
              className={`site-view${view === key ? ' is-active' : ''}`}
              onClick={() => setView(key)}
            >
              {v.label}
            </button>
          ))}
        </div>
      )}

      {(active || !box) && (
        <div className="site-status" role="status">
          模型載入中… {Math.round(progress)}%
          <div className="site-bar">
            <div className="site-bar-fill" style={{ width: `${Math.round(progress)}%` }} />
          </div>
        </div>
      )}
      {box && !active && <p className="site-hint">拖曳旋轉・滾輪縮放・按住右鍵或雙指平移</p>}
    </div>
  );
}
