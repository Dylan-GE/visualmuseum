import { useCallback, useMemo, useRef, useState } from 'react';
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
import { useMuseumData } from './hooks/useMuseumData';
import { loadUnlockedItems, saveUnlockedItems } from './utils/progress';

function App() {
  const params = new URLSearchParams(window.location.search);
  const isTunnelTest = params.has('tunnelTest');
  const isTunnelSegment = params.has('tunnelSegment');
  const { data, error } = useMuseumData();
  const sceneRef = useRef(null);
  const [currentZone, setCurrentZone] = useState(null);
  const [pose, setPose] = useState(null);
  const [selectedItem, setSelectedItem] = useState(null);
  const [unlockedItems, setUnlockedItems] = useState(() => loadUnlockedItems());
  const [collectionOpen, setCollectionOpen] = useState(false);

  const zoneNames = useMemo(
    () => Object.fromEntries((data?.zones ?? []).map((z) => [z.id, z.name])),
    [data],
  );

  const handleSelectZone = useCallback((zone) => {
    setCurrentZone(zone);
  }, []);

  const handleJumpToZone = useCallback((zoneId) => {
    sceneRef.current?.flyToZone(zoneId);
  }, []);

  const handleSelectItem = useCallback((item) => {
    setSelectedItem(item);
  }, []);

  const handleCorrectAnswer = useCallback((item) => {
    setUnlockedItems((prev) => {
      if (prev[item.id]) return prev;
      const next = { ...prev, [item.id]: true };
      saveUnlockedItems(next);
      return next;
    });
  }, []);

  const handleOpenCollection = useCallback(() => {
    setSelectedItem(null);
    setCollectionOpen(true);
  }, []);

  if (isTunnelTest) {
    return <TunnelPieceTest />;
  }

  if (isTunnelSegment) {
    return <TunnelSegmentTest />;
  }

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
      <ControlHintHUD />
      <External2DToggle
        items={data?.items ?? []}
        zoneNames={zoneNames}
      />
      <LocationBanner zoneName={currentZone?.name} />
      <AIGuideHUD />
      <MinimapHUD
        zones={data?.zones}
        items={data?.items}
        connections={data?.connections}
        unlockedItems={unlockedItems}
        currentZoneId={currentZone?.id}
        pose={pose}
        onSelectZone={handleJumpToZone}
      />
      {data && (
        <SceneThumbnailStrip
          zones={data.zones}
          route={data.route}
          currentZoneId={currentZone?.id}
          onSelectZone={handleJumpToZone}
        />
      )}
      {data && (
        <CollectionHUD
          items={data.items}
          unlockedItems={unlockedItems}
          open={collectionOpen}
          onToggle={() => setCollectionOpen((v) => !v)}
        />
      )}
      <ItemDetailModal
        item={selectedItem}
        unlocked={selectedItem ? !!unlockedItems[selectedItem.id] : false}
        onClose={() => setSelectedItem(null)}
        onOpenCollection={handleOpenCollection}
        onCorrectAnswer={handleCorrectAnswer}
      />
      {error && (
        <div style={{ position: 'absolute', top: 16, left: 16, color: '#f87171' }}>
          museum_data.json 載入失敗：{error.message}
        </div>
      )}
    </div>
  );
}

export default App;
