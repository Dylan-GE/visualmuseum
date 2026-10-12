import { useMemo, useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import MinimapView from './MinimapView';
import { MAP_SIZE } from '../utils/minimapProjection';
import { zoneGlow } from '../utils/zoneTheme';

export default function MinimapHUD({ zones, items, connections, unlockedItems, currentZoneId, pose, onSelectZone }) {
  const [collapsed, setCollapsed] = useState(true);
  const currentZone = zones?.find((z) => z.id === currentZoneId);
  const total = items?.length ?? 0;
  const collected = useMemo(() => (items ?? []).filter((i) => unlockedItems?.[i.id]).length, [items, unlockedItems]);

  return (
    <div className="minimap-hud">
      {!collapsed && (
        <div className="minimap-panel">
          <div className="minimap-header">
            <span className="minimap-title">坑道地圖</span>
            {currentZone && (
              <span className="minimap-here" style={{ '--zone-glow': zoneGlow(currentZone.id) }}>
                <i />
                {currentZone.name}
              </span>
            )}
          </div>
          <div className="minimap-map" style={{ aspectRatio: `${MAP_SIZE.width} / ${MAP_SIZE.height}` }}>
            <MinimapView
              zones={zones}
              items={items}
              connections={connections}
              unlockedItems={unlockedItems}
              currentZoneId={currentZoneId}
              pose={pose}
              onSelectZone={onSelectZone}
            />
          </div>
          <div className="minimap-legend">
            <span>
              <i className="minimap-diamond got" />
              已收藏 {collected}
            </span>
            <span>
              <i className="minimap-diamond" />
              未收藏 {total - collected}
            </span>
            <span className="minimap-legend-hint">點區域名稱可跳轉</span>
          </div>
        </div>
      )}
      <button className="minimap-toggle" onClick={() => setCollapsed((v) => !v)}>
        <span>🗺️ 地圖</span>
        {collapsed ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </button>
    </div>
  );
}
