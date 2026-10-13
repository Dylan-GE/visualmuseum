import { ZONE_THEME, DEFAULT_THEME } from '../utils/zoneTheme';

// 「場景列表」：點場景卡的工具列開啟，列出各區域，點一下跳過去。
export default function SceneThumbnailStrip({ zones, route = [], currentZoneId, onSelectZone, onClose }) {
  if (!zones?.length) return null;
  const zoneById = Object.fromEntries(zones.map((z) => [z.id, z]));
  const ordered = route.length ? route.map((id) => zoneById[id]).filter(Boolean) : zones;

  return (
    <div className="scene-list glass-panel" role="menu" aria-label="場景列表">
      <div className="scene-list__header">
        <h3>場景列表</h3>
        <button className="scene-list__close" type="button" aria-label="關閉場景列表" onClick={onClose}>
          ✕
        </button>
      </div>
      <ul>
        {ordered.map((zone) => {
          const theme = ZONE_THEME[zone.id] ?? DEFAULT_THEME;
          const isCurrent = zone.id === currentZoneId;
          return (
            <li key={zone.id}>
              <button
                type="button"
                role="menuitem"
                className={`scene-list__item${isCurrent ? ' is-current' : ''}`}
                onClick={() => {
                  onSelectZone(zone.id);
                  onClose();
                }}
              >
                <span className="scene-list__swatch" style={{ background: theme.glow }} />
                {zone.name}
                {isCurrent && <small>目前位置</small>}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
