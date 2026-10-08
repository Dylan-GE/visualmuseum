import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import MinimapView from './MinimapView';

export default function MinimapHUD({ zones, items, unlockedItems, currentZoneId, pose, onSelectZone }) {
  const [collapsed, setCollapsed] = useState(true);

  return (
    <div className="minimap-hud">
      {!collapsed && (
        <div className="minimap-viewport">
          <MinimapView
            zones={zones}
            items={items}
            unlockedItems={unlockedItems}
            currentZoneId={currentZoneId}
            pose={pose}
            onSelectZone={onSelectZone}
          />
        </div>
      )}
      <button className="minimap-toggle" onClick={() => setCollapsed((v) => !v)}>
        <span>🗺️ 地圖</span>
        {collapsed ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </button>
    </div>
  );
}
