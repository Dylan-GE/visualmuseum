import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { OrbitControls, useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import './SiteModelViewer.css';
import './LoadingScreen.css';
import loadingLogo from '../assets/loading.svg';
import { BASE_HREF } from '../utils/assetUrl';

// 純展示的三維模型頁（國英坑、昇福坑、瑞欣石礦）：只能旋轉、縮放、平移，不能走動。
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

const POINT_SIZE = 0.15; // metres; the point cloud is thinned to one point per 0.12 m voxel

function Tunnel({ url, visible, onBounds }) {
  const { scene } = useGLTF(url);

  // Recolour/resize the point cloud in place, on the glTF's own object: the compressed GLB keeps
  // its positions quantized and restores the real scale through that object's transform, so a
  // fresh THREE.Points would lose it.
  const ready = useMemo(() => {
    let found = null;
    scene.traverse((o) => {
      if (o.isPoints) found = o;
    });
    if (!found) return false;
    if (!found.userData.siteTuned) {
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
      found.geometry.setAttribute('color', new THREE.BufferAttribute(rgb, 3));
      // Points are kept one per 0.12 m voxel, so they must be drawn a bit wider than that (and as
      // discs, not squares) or the walls look like gapped mosaic tiles when seen up close.
      found.material = new THREE.PointsMaterial({ size: POINT_SIZE, sizeAttenuation: true, vertexColors: true, toneMapped: false });
      found.material.onBeforeCompile = (shader) => {
        shader.fragmentShader = shader.fragmentShader.replace(
          '#include <clipping_planes_fragment>',
          '#include <clipping_planes_fragment>\n  if (length(gl_PointCoord - vec2(0.5)) > 0.5) discard;',
        );
      };
      found.material.color.setRGB(1.8, 1.8, 1.8); // scanned in dim light; lift it so the walls are readable
      found.userData.siteTuned = true;
    }
    return true;
  }, [scene]);

  useEffect(() => {
    if (!ready) return;
    scene.updateMatrixWorld(true);
    onBounds(new THREE.Box3().setFromObject(scene));
  }, [ready, scene, onBounds]);

  if (!ready) return null;
  return <primitive object={scene} visible={visible} />;
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

const MB = (n) => (n / 1e6).toFixed(n >= 1e7 ? 0 : 1);

// 自己下載檔案以取得「真實的位元組進度」（three.js 的載入進度只會從 0% 跳到 100%）。
// 下載完成後交給 GLTFLoader 用 blob 網址解析，不會再下載第二次。
function useBlobDownload(url, enabled = true) {
  const [state, setState] = useState({ blobUrl: null, loaded: 0, total: 0, error: false });

  useEffect(() => {
    if (!enabled || !url) return undefined;
    const ctrl = new AbortController();
    (async () => {
      try {
        const res = await fetch(url, { signal: ctrl.signal });
        if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);
        const total = Number(res.headers.get('content-length')) || 0;
        const reader = res.body.getReader();
        const chunks = [];
        let loaded = 0;
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          chunks.push(value);
          loaded += value.length;
          setState((s) => ({ ...s, loaded, total: Math.max(total, loaded) }));
        }
        const blob = new Blob(chunks, { type: 'model/gltf-binary' });
        setState({ blobUrl: URL.createObjectURL(blob), loaded, total: Math.max(total, loaded), error: false });
      } catch {
        if (!ctrl.signal.aborted) setState((s) => ({ ...s, error: true }));
      }
    })();
    return () => ctrl.abort();
  }, [url, enabled]);

  return state;
}

// 等待時輪流顯示的操作小提示（只講這個頁面怎麼用）
function useRotatingTip(tips) {
  const [i, setI] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setI((n) => (n + 1) % tips.length), 3800);
    return () => clearInterval(t);
  }, [tips.length]);
  return tips[i % tips.length];
}

function SiteLoader({ title, label, loaded, total, parsing, tips }) {
  const tip = useRotatingTip(tips);
  const pct = total ? Math.min(100, Math.round((loaded / total) * 100)) : 0;
  const busy = parsing || !total;
  return (
    <div className="site-loader" role="status" aria-live="polite">
      <img className="site-loader__logo" src={loadingLogo} alt="" aria-hidden="true" />
      <p className="site-loader__title">{title}</p>
      <p className="site-loader__label">{parsing ? '整理模型中…' : label}</p>
      <div className="site-bar" aria-hidden="true">
        <div className={`site-bar-fill${busy ? ' is-busy' : ''}`} style={{ width: parsing ? '100%' : `${Math.max(3, pct)}%` }} />
      </div>
      <p className="site-loader__size">
        {parsing ? '快好了' : total ? `${MB(loaded)} / ${MB(total)} MB（${pct}%）` : `${MB(loaded)} MB`}
      </p>
      <p className="site-loader__tip" key={tip}>
        {tip}
      </p>
    </div>
  );
}

export default function SiteModelViewer({ site }) {
  const [view, setView] = useState('outside');
  const [terrainBox, setTerrainBox] = useState(null);
  const [tunnelBox, setTunnelBox] = useState(null);
  const [tunnelWanted, setTunnelWanted] = useState(false);
  const controlsRef = useRef(null);
  const hasTunnel = !!site.model.tunnel;
  const spec = VIEWS[view];

  // 坑道掃描（點雲）只有切到「坑道內部／疊合」時才下載，第一次進來只下載山坡。
  useEffect(() => {
    if (view !== 'outside') setTunnelWanted(true);
  }, [view]);

  const terrainDl = useBlobDownload(site.model.terrain);
  const tunnelDl = useBlobDownload(site.model.tunnel, hasTunnel && tunnelWanted);

  // 取景範圍：外觀看地形、坑道內部看點雲、疊合看兩者聯集
  const fitBox = useMemo(() => {
    if (!terrainBox) return null;
    if (view === 'inside' && tunnelBox) return tunnelBox;
    if (view === 'overlay' && tunnelBox) return terrainBox.clone().union(tunnelBox);
    return terrainBox;
  }, [view, terrainBox, tunnelBox]);

  const waitingTerrain = !terrainBox;
  const waitingTunnel = !waitingTerrain && spec.tunnel && !tunnelBox;
  const dl = waitingTerrain ? terrainDl : tunnelDl;
  const failed = terrainDl.error || (spec.tunnel && tunnelDl.error);
  const tips = hasTunnel
    ? [
        '拖曳滑鼠旋轉模型，滾輪縮放',
        '按住右鍵（手機用雙指）可以平移',
        '「坑道內部」是雷射掃描出來的坑道點雲',
        '「疊合」可以看山坡和坑道的相對位置',
        '左上角「返回入口」可以回到首頁',
      ]
    : ['拖曳滑鼠旋轉模型，滾輪縮放', '按住右鍵（手機用雙指）可以平移', '左上角「返回入口」可以回到首頁'];

  return (
    <div className="site-page">
      <Canvas flat dpr={[1, 2]} camera={{ fov: 45, position: [0, 200, 300], near: 0.5, far: 5000 }}>
        <color attach="background" args={['#0e1013']} />
        <Suspense fallback={null}>
          {terrainDl.blobUrl && <Terrain url={terrainDl.blobUrl} opacity={spec.terrain} onBounds={setTerrainBox} />}
          {hasTunnel && tunnelDl.blobUrl && <Tunnel url={tunnelDl.blobUrl} visible={spec.tunnel} onBounds={setTunnelBox} />}
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

      {hasTunnel && terrainBox && (
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

      {failed && (
        <div className="site-status site-status--error" role="alert">
          模型載入失敗，請重新整理頁面再試一次。
        </div>
      )}
      {!failed && (waitingTerrain || waitingTunnel) && (
        <SiteLoader
          title={site.title}
          label={waitingTerrain ? '正在載入三維模型' : '正在載入坑道雷射掃描'}
          loaded={dl.loaded}
          total={dl.total}
          parsing={!!dl.blobUrl}
          tips={tips}
        />
      )}
      {terrainBox && !waitingTunnel && <p className="site-hint">拖曳旋轉・滾輪縮放・按住右鍵或雙指平移</p>}
    </div>
  );
}
