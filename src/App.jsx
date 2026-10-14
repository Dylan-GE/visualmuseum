import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useProgress } from '@react-three/drei';
import SceneCanvas from './components/SceneCanvas';
import TunnelPieceTest from './components/TunnelPieceTest';
import TunnelSegmentTest from './components/TunnelSegmentTest';
import MinimapHUD from './components/MinimapHUD';
import LocationBanner from './components/LocationBanner';
import SceneThumbnailStrip from './components/SceneThumbnailStrip';
import CollectionHUD from './components/CollectionHUD';
import AIGuideHUD from './components/AIGuideHUD';
import ControlHintHUD from './components/ControlHintHUD';
import External2DToggle from './components/External2DToggle';
import ItemDetailModal from './components/ItemDetailModal';
import LoadingScreen from './components/LoadingScreen';
import MuseumTopbar from './components/MuseumTopbar';
import QuickActions from './components/QuickActions';
import SceneCard from './components/SceneCard';
import MobileMenu from './components/MobileMenu';
import Toast from './components/Toast';
import './museum-ui.css';
import { useMuseumData } from './hooks/useMuseumData';
import { loadUnlockedItems, saveUnlockedItems } from './utils/progress';
import { parseARPath } from './utils/arLink';

const ARViewer = lazy(() => import('./components/ARViewer'));

// 載入畫面至少停留的時間，以及「沒有新資源在載入」要持續多久才算場景準備好。
// 場景的模型是一個個陸續載入、陸續冒出來的，不擋住的話訪客會看到零碎的畫面。
const MIN_LOADING_MS = 1500;
const SETTLE_MS = 1500;
const GIVE_UP_MS = 30000;

function useSceneReady(dataLoaded) {
  const { active, progress } = useProgress();
  const [ready, setReady] = useState(false);
  const startedAt = useRef(Date.now());

  useEffect(() => {
    if (ready) return undefined;
    const t = setTimeout(() => setReady(true), GIVE_UP_MS);
    return () => clearTimeout(t);
  }, [ready]);

  useEffect(() => {
    if (ready || !dataLoaded || active) return undefined;
    const wait = Math.max(SETTLE_MS, MIN_LOADING_MS - (Date.now() - startedAt.current));
    const t = setTimeout(() => setReady(true), wait);
    return () => clearTimeout(t);
  }, [ready, dataLoaded, active]);

  return { ready, progress: dataLoaded ? progress : Math.min(progress, 5) };
}

function Museum() {
  const { data, error } = useMuseumData();
  const { ready, progress } = useSceneReady(!!data);
  const sceneRef = useRef(null);
  const [currentZone, setCurrentZone] = useState(null);
  const [pose, setPose] = useState(null);
  const [selectedItem, setSelectedItem] = useState(null);
  const [unlockedItems, setUnlockedItems] = useState(() => loadUnlockedItems());
  const [collectionOpen, setCollectionOpen] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const [view2dOpen, setView2dOpen] = useState(false);
  const [sceneListOpen, setSceneListOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [mobilePanel, setMobilePanel] = useState(null); // 'hints' | 'minimap' | null
  const [toast, setToast] = useState({ title: '', text: '', visible: false });
  const toastTimer = useRef(null);

  const zoneNames = useMemo(
    () => Object.fromEntries((data?.zones ?? []).map((z) => [z.id, z.name])),
    [data],
  );

  const items = useMemo(() => data?.items ?? [], [data]);
  const collected = useMemo(() => items.filter((i) => unlockedItems[i.id]).length, [items, unlockedItems]);
  const zoneItemCount = useMemo(
    () => items.filter((i) => i.zone_id === currentZone?.id).length,
    [items, currentZone],
  );

  const showToast = useCallback((title, text) => {
    setToast({ title, text, visible: true });
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast((t) => ({ ...t, visible: false })), 3200);
  }, []);

  const handleSelectZone = useCallback((zone) => {
    setCurrentZone(zone);
  }, []);

  const handleJumpToZone = useCallback((zoneId) => {
    sceneRef.current?.flyToZone(zoneId);
  }, []);

  const handleSelectItem = useCallback((item) => {
    setSelectedItem(item);
  }, []);

  const handleCorrectAnswer = useCallback(
    (item) => {
      setUnlockedItems((prev) => {
        if (prev[item.id]) return prev;
        const next = { ...prev, [item.id]: true };
        saveUnlockedItems(next);
        return next;
      });
      showToast('已加入圖鑑', `「${item.name}」已收錄至您的圖鑑，可在「我的圖鑑」查看。`);
    },
    [showToast],
  );

  const handleOpenCollection = useCallback(() => {
    setSelectedItem(null);
    setAiOpen(false);
    setCollectionOpen(true);
  }, []);

  const handleOpenAI = useCallback(() => {
    setCollectionOpen(false);
    setAiOpen(true);
  }, []);

  // 圖鑑裡點已收藏的展品 → 關掉圖鑑、打開展品詳細資料
  const handleSelectFromCollection = useCallback((item) => {
    setCollectionOpen(false);
    setSelectedItem(item);
  }, []);

  const handleMenuPick = useCallback(
    (id) => {
      setMenuOpen(false);
      if (id === 'ai') handleOpenAI();
      else if (id === 'collection') handleOpenCollection();
      else setMobilePanel(id);
    },
    [handleOpenAI, handleOpenCollection],
  );

  useEffect(() => () => clearTimeout(toastTimer.current), []);

  return (
    <div style={{ position: 'fixed', inset: 0 }}>
      <SceneCanvas
        ref={sceneRef}
        data={data}
        onSelectZone={handleSelectZone}
        onPoseChange={setPose}
        onSelectItem={handleSelectItem}
        unlockedItems={unlockedItems}
      />

      <div className="mu">
        <div className="scene-vignette" aria-hidden="true" />
        <MuseumTopbar
          onOpen2D={() => setView2dOpen(true)}
          onOpenMenu={() => setMenuOpen(true)}
          menuOpen={menuOpen}
        />
        <ControlHintHUD mobileOpen={mobilePanel === 'hints'} onCloseMobile={() => setMobilePanel(null)} />
        <MinimapHUD
          zones={data?.zones}
          items={data?.items}
          connections={data?.connections}
          unlockedItems={unlockedItems}
          currentZoneId={currentZone?.id}
          pose={pose}
          onSelectZone={handleJumpToZone}
          mobileOpen={mobilePanel === 'minimap'}
          onCloseMobile={() => setMobilePanel(null)}
        />
        <LocationBanner zoneName={currentZone?.name} />
        <QuickActions onOpenAI={handleOpenAI} onOpenCollection={handleOpenCollection} />
        {sceneListOpen && data && (
          <SceneThumbnailStrip
            zones={data.zones}
            route={data.route}
            currentZoneId={currentZone?.id}
            onSelectZone={handleJumpToZone}
            onClose={() => setSceneListOpen(false)}
          />
        )}
        <SceneCard
          zoneName={currentZone?.name}
          zoneItemCount={zoneItemCount}
          collected={collected}
          total={items.length}
          listOpen={sceneListOpen}
          onToggleList={() => setSceneListOpen((v) => !v)}
        />
        <Toast toast={toast} />
        <AIGuideHUD
          open={aiOpen}
          onClose={() => setAiOpen(false)}
          zone={currentZone}
          items={items}
          zones={data?.zones}
        />
        {data && (
          <CollectionHUD
            items={data.items}
            unlockedItems={unlockedItems}
            open={collectionOpen}
            onClose={() => setCollectionOpen(false)}
            onSelectItem={handleSelectFromCollection}
          />
        )}
        <ItemDetailModal
          item={selectedItem}
          unlocked={selectedItem ? !!unlockedItems[selectedItem.id] : false}
          onClose={() => setSelectedItem(null)}
          onOpenCollection={handleOpenCollection}
          onCorrectAnswer={handleCorrectAnswer}
        />
        <External2DToggle
          open={view2dOpen}
          onClose={() => setView2dOpen(false)}
          items={items}
          zoneNames={zoneNames}
        />
        <MobileMenu open={menuOpen} onClose={() => setMenuOpen(false)} onPick={handleMenuPick} />
        {mobilePanel && (
          <div className="mobile-overlay-backdrop" aria-hidden="true" onClick={() => setMobilePanel(null)} />
        )}
      </div>

      {error && (
        <div style={{ position: 'absolute', top: 16, left: 16, color: '#f87171' }}>
          museum_data.json 載入失敗：{error.message}
        </div>
      )}

      <LoadingScreen done={ready} progress={progress} />
    </div>
  );
}

function ARRoute({ itemId }) {
  const { data, error } = useMuseumData();
  return (
    <Suspense fallback={null}>
      <ARViewer itemId={itemId} data={data} error={error} />
    </Suspense>
  );
}

function App() {
  const params = new URLSearchParams(window.location.search);
  const isTunnelTest = params.has('tunnelTest');
  const isTunnelSegment = params.has('tunnelSegment');
  const arItemId = parseARPath(window.location.pathname);

  if (arItemId) {
    return <ARRoute itemId={arItemId} />;
  }

  if (isTunnelTest) {
    return <TunnelPieceTest />;
  }

  if (isTunnelSegment) {
    return <TunnelSegmentTest />;
  }

  return <Museum />;
}

export default App;
