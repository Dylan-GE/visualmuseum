import { ZONE_THEME, DEFAULT_THEME } from '../utils/zoneTheme';

export default function SceneThumbnailStrip({ zones, route = [], currentZoneId, onSelectZone }) {
  if (!zones?.length) return null;
  const zoneById = Object.fromEntries(zones.map((z) => [z.id, z]));
  const ordered = route.length ? route.map((id) => zoneById[id]).filter(Boolean) : zones;

  return (
    <div className="scene-strip">
      {ordered.map((zone) => {
        const theme = ZONE_THEME[zone.id] ?? DEFAULT_THEME;
        const isCurrent = zone.id === currentZoneId;
        return (
          <button
            key={zone.id}
            className={`scene-thumb${isCurrent ? ' scene-thumb-active' : ''}`}
            onClick={() => onSelectZone(zone.id)}
            title={zone.name}
          >
            <span className="scene-thumb-swatch" style={{ background: theme.glow }} />
            {zone.name}
          </button>
        );
      })}
    </div>
  );
}
