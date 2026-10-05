import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import MinimapImage from './MinimapImage';

export default function MinimapHUD({ currentZoneId, heading = 0, onSelectZone }) {
  const [collapsed, setCollapsed] = useState(true);

  return (
    <div className="minimap-hud">
      {!collapsed && (
        <div className="minimap-viewport">
          <MinimapImage currentZoneId={currentZoneId} heading={heading} onSelectZone={onSelectZone} />
        </div>
      )}
      <button className="minimap-toggle" onClick={() => setCollapsed((v) => !v)}>
        <span>🗺️ 地圖</span>
        {collapsed ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </button>
    </div>
  );
}
