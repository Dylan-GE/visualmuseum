import { useEffect, useMemo, useState } from 'react';
import { MAP_SIZE, headingToMapDegrees, worldToMap } from '../utils/minimapProjection';
import { loadMinimapFootprint } from '../utils/minimapFootprint';

export default function MinimapView({ zones = [], items = [], unlockedItems = {}, currentZoneId, pose, onSelectZone }) {
  const [footprint, setFootprint] = useState(null);

  useEffect(() => {
    let cancelled = false;
    loadMinimapFootprint()
      .then((url) => {
        if (!cancelled) setFootprint(url);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const zoneNodes = useMemo(
    () => zones.map((z) => ({ id: z.id, name: z.name, point: worldToMap(z.coordinates.x, z.coordinates.z) })),
    [zones],
  );
  const currentZone = zoneNodes.find((z) => z.id === currentZoneId);
  const player = pose ? worldToMap(pose.x, pose.z) : currentZone?.point;

  return (
    <svg
      viewBox={`0 0 ${MAP_SIZE.width} ${MAP_SIZE.height}`}
      width="100%"
      height="100%"
      preserveAspectRatio="xMidYMid meet"
      style={{ display: 'block' }}
      role="img"
      aria-label="坑道平面小地圖"
    >
      {footprint && <image href={footprint} width={MAP_SIZE.width} height={MAP_SIZE.height} />}

      {items.map((item) => {
        const [x, y] = worldToMap(item.position[0], item.position[2]);
        return (
          <circle
            key={item.id}
            cx={x}
            cy={y}
            r={2.6}
            fill={unlockedItems[item.id] ? '#4ade80' : '#94a3b8'}
            opacity={0.9}
          />
        );
      })}

      {zoneNodes.map((z) => {
        const active = z.id === currentZoneId;
        return (
          <g key={z.id} onClick={() => onSelectZone?.(z.id)} style={{ cursor: 'pointer' }}>
            <circle cx={z.point[0]} cy={z.point[1]} r={14} fill="transparent" />
            <circle
              cx={z.point[0]}
              cy={z.point[1]}
              r={active ? 7 : 5}
              fill={active ? '#38bdf8' : '#0f172a'}
              stroke="#e2e8f0"
              strokeWidth={1.5}
            />
            <text
              x={z.point[0] + 10}
              y={z.point[1] + 4}
              fontSize={13}
              fill="#e2e8f0"
              stroke="#0a0e14"
              strokeWidth={3}
              paintOrder="stroke"
              style={{ pointerEvents: 'none' }}
            >
              {z.name}
            </text>
          </g>
        );
      })}

      {player && (
        <g transform={`translate(${player[0]} ${player[1]}) rotate(${headingToMapDegrees(pose?.heading ?? 0)})`} style={{ pointerEvents: 'none' }}>
          <path d="M 0 0 L 30 -16 A 34 34 0 0 1 30 16 Z" fill="rgba(250,204,21,0.55)" stroke="#facc15" strokeWidth={1} />
          <circle r={5.5} fill="#facc15" stroke="#0a0e14" strokeWidth={1.5} />
        </g>
      )}
    </svg>
  );
}
